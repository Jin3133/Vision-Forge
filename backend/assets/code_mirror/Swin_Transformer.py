"""Swin_Transformer.py -- Swin Transformer (Liu et al., ICCV 2021)
核心创新: 移位窗口自注意力 -- W-MSA + SW-MSA 交替，跨窗口信息交互不增开销。
默认(Swin-T): window_size=7, dim=96->192->384->768, depths=[2,2,6,2], heads=[3,6,12,24]
"""

import torch
import torch.nn as nn


# ---- 窗口切分 / 还原 ----
def window_partition(x, window_size):
    """ (B,H,W,C) -> (B*nW, ws, ws, C) """
    B, H, W, C = x.shape
    x = x.view(B, H // window_size, window_size, W // window_size, window_size, C)
    return x.permute(0, 1, 3, 2, 4, 5).contiguous().view(-1, window_size, window_size, C)

def window_reverse(windows, window_size, H, W):
    """ (B*nW, ws, ws, C) -> (B,H,W,C) """
    B = int(windows.shape[0] / (H * W / window_size / window_size))
    x = windows.view(B, H // window_size, W // window_size, window_size, window_size, -1)
    return x.permute(0, 1, 3, 2, 4, 5).contiguous().view(B, H, W, -1)

# ---- 1. 窗口多头自注意力 + 相对位置偏置 ----
class WindowAttention(nn.Module):
    """窗口内多头自注意力: 引入可学习相对位置偏置 B，Attention = softmax(QK^T/sqrt(d)+B)*V"""
    def __init__(self, dim, window_size, num_heads, qkv_bias=True):
        super().__init__()
        self.window_size = window_size
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.scale = self.head_dim ** -0.5
        # 相对位置偏置表 (2*ws-1)^2 x num_heads
        self.relative_position_bias_table = nn.Parameter(
            torch.zeros((2 * window_size - 1) ** 2, num_heads))
        nn.init.trunc_normal_(self.relative_position_bias_table, std=0.02)
        # 构建相对位置索引 (ws^2, ws^2)，查表获得每对 token 的偏置
        coords = torch.stack(torch.meshgrid(
            torch.arange(window_size), torch.arange(window_size), indexing="ij"))
        coords = coords.flatten(1)
        rel = coords[:, :, None] - coords[:, None, :]
        rel = rel.permute(1, 2, 0).contiguous()
        rel[:, :, 0] += window_size - 1
        rel[:, :, 1] += window_size - 1
        rel[:, :, 0] *= 2 * window_size - 1
        self.register_buffer("relative_position_index", rel.sum(-1))
        self.qkv = nn.Linear(dim, dim * 3, bias=qkv_bias)
        self.proj = nn.Linear(dim, dim)
        self.softmax = nn.Softmax(dim=-1)

    def forward(self, x, mask=None):
        B_, N, C = x.shape
        qkv = self.qkv(x).reshape(B_, N, 3, self.num_heads, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]
        attn = (q @ k.transpose(-2, -1)) * self.scale
        # 加相对位置偏置
        bias = self.relative_position_bias_table[self.relative_position_index.view(-1)]
        bias = bias.view(N, N, self.num_heads).permute(2, 0, 1).contiguous()
        attn = attn + bias.unsqueeze(0)
        # SW-MSA 掩码: 阻止移位后不同区域 token 互注意 (softmax(-100) -> 0)
        if mask is not None:
            nW = mask.shape[0]
            attn = attn.view(B_ // nW, nW, self.num_heads, N, N)
            attn = attn + mask.unsqueeze(1).unsqueeze(0)
            attn = attn.view(-1, self.num_heads, N, N)
        attn = self.softmax(attn)
        x = (attn @ v).transpose(1, 2).reshape(B_, N, C)
        return self.proj(x)

# ---- 2. Swin Block: (W-MSA 或 SW-MSA) + MLP (Pre-Norm) ----
class SwinBlock(nn.Module):
    """x = x + (W-MSA|SW-MSA)(LN(x)); x = x + MLP(LN(x)). shift_size=0->W-MSA, shift=ws//2->SW-MSA"""
    def __init__(self, dim, num_heads, window_size=7, shift_size=0, mlp_ratio=4.0):
        super().__init__()
        self.window_size = window_size
        self.shift_size = shift_size
        self.norm1 = nn.LayerNorm(dim, eps=1e-6)
        self.attn = WindowAttention(dim, window_size=window_size, num_heads=num_heads)
        self.norm2 = nn.LayerNorm(dim, eps=1e-6)
        hidden = int(dim * mlp_ratio)
        self.mlp = nn.Sequential(
            nn.Linear(dim, hidden), nn.GELU(), nn.Linear(hidden, dim),
        )

    def forward(self, x):
        B, H, W, C = x.shape
        shortcut = x
        x = self.norm1(x)
        # 填充至 window_size 整数倍
        ws = self.window_size
        pad_r, pad_b = (ws - W % ws) % ws, (ws - H % ws) % ws
        if pad_r or pad_b:
            x = nn.functional.pad(x, (0, 0, 0, pad_r, 0, pad_b))
        Hp, Wp = H + pad_b, W + pad_r
        # SW-MSA: 循环移位
        if self.shift_size > 0:
            x = torch.roll(x, shifts=(-self.shift_size, -self.shift_size), dims=(1, 2))
        # 窗口切分 -> 注意力 -> 还原
        x = window_partition(x, ws).view(-1, ws * ws, C)
        mask = self._build_mask(Hp, Wp, x.device) if self.shift_size > 0 else None
        x = window_reverse(self.attn(x, mask).view(-1, ws, ws, C), ws, Hp, Wp)
        # 逆循环移位 + 切除填充
        if self.shift_size > 0:
            x = torch.roll(x, shifts=(self.shift_size, self.shift_size), dims=(1, 2))
        if pad_r or pad_b:
            x = x[:, :H, :W, :]
        x = shortcut + x
        x = x + self.mlp(self.norm2(x))
        return x

    def _build_mask(self, H, W, device):
        """SW-MSA 掩码: 移位边界划为9区域编号，同区可互注意、异区置 -100"""
        img_mask = torch.zeros((1, H, W, 1), device=device)
        shift, ws = self.shift_size, self.window_size
        cnt = 0
        for h in (slice(0, -ws), slice(-ws, -shift), slice(-shift, None)):
            for w in (slice(0, -ws), slice(-ws, -shift), slice(-shift, None)):
                img_mask[:, h, w, :] = cnt
                cnt += 1
        mask_w = window_partition(img_mask, ws).view(-1, ws * ws)
        attn_mask = mask_w.unsqueeze(1) - mask_w.unsqueeze(2)
        return attn_mask.masked_fill(attn_mask != 0, float(-100.0))

# ---- 3. Patch Merging: 2x 空间下采样 ----
class PatchMerging(nn.Module):
    """拼接 2x2 邻域 patch 后线性投影: (B,H,W,C) -> (B,H/2,W/2,2C)"""
    def __init__(self, in_dim, out_dim):
        super().__init__()
        self.reduction = nn.Linear(4 * in_dim, out_dim, bias=False)
        self.norm = nn.LayerNorm(4 * in_dim, eps=1e-6)

    def forward(self, x):
        B, H, W, C = x.shape
        x = x.view(B, H // 2, 2, W // 2, 2, C)
        x = x.permute(0, 1, 3, 4, 2, 5).contiguous().view(B, H // 2, W // 2, 4 * C)
        return self.reduction(self.norm(x))

# ---- 4. 完整 Swin Transformer 骨干 ----
class SwinTransformer(nn.Module):
    """层次化视觉骨干。关键: ①窗口注意力O(N); ②PatchMerging层次化; ③移位窗口跨窗口交互"""
    def __init__(self, img_size=224, patch_size=4, in_chans=3,
                 embed_dim=96, depths=(2, 2, 6, 2), num_heads=(3, 6, 12, 24),
                 window_size=7, mlp_ratio=4.0):
        super().__init__()
        self.patch_embed = nn.Conv2d(in_chans, embed_dim,
                                     kernel_size=patch_size, stride=patch_size)
        self.layers = nn.ModuleList()
        self.downsamples = nn.ModuleList()
        dim = embed_dim
        for i in range(len(depths)):
            self.layers.append(nn.ModuleList([
                SwinBlock(dim=dim, num_heads=num_heads[i],
                          window_size=window_size,
                          shift_size=0 if j % 2 == 0 else window_size // 2,
                          mlp_ratio=mlp_ratio)
                for j in range(depths[i])
            ]))
            if i < len(depths) - 1:
                self.downsamples.append(PatchMerging(dim, dim * 2))
                dim *= 2
            else:
                self.downsamples.append(None)
        self.num_features = dim

    def forward(self, x):
        x = self.patch_embed(x).permute(0, 2, 3, 1).contiguous()  # (B,H/4,W/4,C)
        features = []
        for i, blocks in enumerate(self.layers):
            for blk in blocks:
                x = blk(x)
            features.append(x.permute(0, 3, 1, 2).contiguous())
            if self.downsamples[i] is not None:
                x = self.downsamples[i](x)
        return features


# ---- 测试 ----
if __name__ == "__main__":
    model = SwinTransformer(img_size=224, patch_size=4, in_chans=3,
                            embed_dim=96, depths=[2, 2, 6, 2],
                            num_heads=[3, 6, 12, 24], window_size=7)
    dummy = torch.randn(1, 3, 224, 224)
    feats = model(dummy)
    print("=" * 56)
    print("  Swin Transformer (Swin-T) -- Liu et al., ICCV 2021")
    print("  核心: 移位窗口自注意力 (W-MSA + SW-MSA 交替)")
    print("=" * 56)
    print(f"  输入:     {dummy.shape}")
    for i, f in enumerate(feats):
        print(f"  Stage {i+1}:  {f.shape}  (C={f.shape[1]}, H={f.shape[2]}, W={f.shape[3]})")
    print(f"  参数量:   {sum(p.numel() for p in model.parameters()) / 1e6:.2f}M")
    print(f"  window=7 | depths={[2,2,6,2]} | heads={[3,6,12,24]}")
    print(f"  通道: 96 -> 192 -> 384 -> 768")
    print("=" * 56)
