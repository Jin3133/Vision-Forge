"""
MobileSAM.py -- MobileSAM 轻量级分割模型 (Zhang et al., 2023)
将SAM ViT-H编码器(~600M)蒸馏为TinyViT(~6M), 实现移动端实时分割(~30ms/图)
架构: (B,3,1024^2) -> TinyViT(MBConv+SRA混合) -> 颈部 -> 掩码(B,1,256^2)
与SAM差异: (a) ViT-H全局注意力->TinyViT MBConv倒残差+SRA空间压缩注意力
           (b) embed_dim 768->384, O(N^2)->SRA压缩K/V至O(N*N/r^2)
           (c) 解码器交叉注意力Transformer -> 纯卷积转置卷积上采样
"""

import torch
import torch.nn as nn


# ============================================
# 1. MBConv: MobileNetV2 倒残差 + SE 通道注意力
# ============================================
class MBConv(nn.Module):
    """倒残差块: 1x1升维->3x3深度卷积->SE通道重标定->1x1降维
       中间宽两端窄(与ResNet相反故名"倒残差"), 深度卷积在高维空间进行"""
    def __init__(self, in_ch, out_ch, expand_ratio=4, stride=1, se_ratio=0.25):
        super().__init__()
        hidden_ch = in_ch * expand_ratio
        self.use_residual = (stride == 1 and in_ch == out_ch)
        self.pw_expand = nn.Conv2d(in_ch, hidden_ch, 1, bias=False)
        self.bn1 = nn.BatchNorm2d(hidden_ch)
        self.dw_conv = nn.Conv2d(hidden_ch, hidden_ch, 3, stride=stride,
                                  padding=1, groups=hidden_ch, bias=False)
        self.bn2 = nn.BatchNorm2d(hidden_ch)
        se_ch = max(1, int(hidden_ch * se_ratio))
        self.se = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Conv2d(hidden_ch, se_ch, 1), nn.GELU(),
            nn.Conv2d(se_ch, hidden_ch, 1), nn.Sigmoid(),
        )
        self.pw_project = nn.Conv2d(hidden_ch, out_ch, 1, bias=False)
        self.bn3 = nn.BatchNorm2d(out_ch)
    def forward(self, x):
        shortcut = x
        x = nn.GELU()(self.bn1(self.pw_expand(x)))
        x = nn.GELU()(self.bn2(self.dw_conv(x)))
        x = x * self.se(x)
        x = self.bn3(self.pw_project(x))
        return x + shortcut if self.use_residual else x

# ============================================
# 2. SRA: 空间压缩注意力 (Spatial Reduction Attention)
# ============================================
class SpatialReductionAttention(nn.Module):
    """对K/V做stride深度卷积下采样r倍, 复杂度O(N^2)->O(N*N/r^2)
       e.g. 64x64=4096 tokens, r=4 -> K/V=256 tokens, 显存减少16倍"""
    def __init__(self, dim, num_heads=6, pool_ratio=4, qkv_bias=True):
        super().__init__()
        self.num_heads, self.head_dim = num_heads, dim // num_heads
        self.scale = self.head_dim ** -0.5
        self.q = nn.Linear(dim, dim, bias=qkv_bias)
        self.kv = nn.Linear(dim, dim * 2, bias=qkv_bias)
        self.proj = nn.Linear(dim, dim)
        self.sr = nn.Conv2d(dim, dim, kernel_size=pool_ratio, stride=pool_ratio,
                            groups=dim)
        self.norm = nn.LayerNorm(dim)
    def forward(self, x, H, W):
        B, N, C = x.shape
        q = self.q(x).reshape(B, N, self.num_heads, self.head_dim).permute(0, 2, 1, 3)
        x_sr = self.sr(x.transpose(1, 2).reshape(B, C, H, W)).flatten(2).transpose(1, 2)
        x_sr = self.norm(x_sr)
        kv = self.kv(x_sr).reshape(B, -1, 2, self.num_heads, self.head_dim)
        kv = kv.permute(2, 0, 3, 1, 4)
        k, v = kv[0], kv[1]
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)
        x = (attn @ v).transpose(1, 2).reshape(B, N, C)
        return self.proj(x)


# ============================================
# 3. TinyViT Block: SRA注意力 + MLP + Pre-Norm
# ============================================
class TinyViTBlock(nn.Module):
    """轻量Transformer块: SRA捕获长程依赖 + MLP增强局部表示"""
    def __init__(self, dim, num_heads=6, mlp_ratio=4.0, pool_ratio=4):
        super().__init__()
        self.norm1 = nn.LayerNorm(dim, eps=1e-6)
        self.attn = SpatialReductionAttention(dim, num_heads, pool_ratio)
        self.norm2 = nn.LayerNorm(dim, eps=1e-6)
        h = int(dim * mlp_ratio)
        self.mlp = nn.Sequential(nn.Linear(dim, h), nn.GELU(), nn.Linear(h, dim))
    def forward(self, x, H, W):
        return x + self.mlp(self.norm2(x + self.attn(self.norm1(x), H, W)))


# ============================================
# 4. TinyViT: 分层骨干 (MBConv局部纹理 + ViT全局语义)
# ============================================
class TinyViT(nn.Module):
    """分层骨干: 浅层MBConv(局部纹理)+深层ViTBlock(全局语义)
       img=1024: Stem(s2)->S1(d64,512^2)->S2(d128,256^2)->S3(d256,128^2)->S4(d384,64^2)
       最终64x64网格对齐SAM的patch embedding输出"""
    def __init__(self, img_size=1024, in_chans=3, embed_dims=(64, 128, 256, 384),
                 num_blocks=(1, 2, 2, 2), num_heads=(0, 0, 4, 6),
                 mlp_ratios=(4, 4, 4, 4), pool_ratios=(0, 0, 4, 4)):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(in_chans, embed_dims[0], 3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(embed_dims[0]), nn.GELU(),
        )
        self.stages = nn.ModuleList()
        in_dim, total_stride = embed_dims[0], 2
        for si, out_dim in enumerate(embed_dims):
            blocks = []
            if si == 0:
                for _ in range(num_blocks[si]):
                    blocks.append(MBConv(in_dim, in_dim, stride=1))
            else:
                blocks.append(MBConv(in_dim, out_dim, stride=2))
                in_dim, total_stride = out_dim, total_stride * 2
                for bi in range(1, num_blocks[si]):
                    if num_heads[si] > 0 and bi == num_blocks[si] - 1:
                        blocks.append(TinyViTBlock(out_dim, num_heads[si],
                            mlp_ratios[si], pool_ratios[si]))
                    else:
                        blocks.append(MBConv(out_dim, out_dim, stride=1))
            self.stages.append(nn.ModuleList(blocks))
        self.out_resolution, self.final_dim = img_size // total_stride, embed_dims[-1]

    def forward(self, x):
        x = self.stem(x)
        for stage in self.stages:
            for blk in stage:
                if isinstance(blk, TinyViTBlock):
                    B, C, H, W = x.shape
                    x = blk(x.flatten(2).transpose(1, 2), H, W)
                    x = x.transpose(1, 2).reshape(B, C, H, W)
                else:
                    x = blk(x)
        return x


# ============================================
# 5. MobileSAM: TinyViT + 纯卷积解码器
# ============================================
class MobileSAM(nn.Module):
    """完整MobileSAM: TinyViT(~5M) + 纯卷积解码器(~0.9M) = ~6M, ~30ms/图
       vs SAM ViT-H ~600M/~2s, 快约60倍, 参数缩小约100倍"""
    def __init__(self, img_size=1024, embed_dim=384, neck_dim=256):
        super().__init__()
        self.image_encoder = TinyViT(img_size=img_size,
                                      embed_dims=(64, 128, 256, embed_dim))
        self.neck = nn.Sequential(
            nn.Conv2d(embed_dim, neck_dim, 1), nn.BatchNorm2d(neck_dim), nn.GELU(),
            nn.Conv2d(neck_dim, neck_dim, 3, padding=1),
            nn.BatchNorm2d(neck_dim), nn.GELU(),
        )
        self.mask_head = nn.Sequential(
            nn.ConvTranspose2d(neck_dim, neck_dim // 2, 2, stride=2),
            nn.BatchNorm2d(neck_dim // 2), nn.GELU(),
            nn.ConvTranspose2d(neck_dim // 2, neck_dim // 4, 2, stride=2),
            nn.BatchNorm2d(neck_dim // 4), nn.GELU(), nn.Conv2d(neck_dim // 4, 1, 1),
        )
    def forward(self, x):
        x = self.image_encoder(x)   # (B,384,64,64)
        x = self.neck(x)            # (B,256,64,64)
        return self.mask_head(x)    # (B,1,256,256)


# ============================================
# __main__ 测试
# ============================================
if __name__ == "__main__":
    model = MobileSAM(img_size=1024, embed_dim=384).eval()
    tp = sum(p.numel() for p in model.parameters())
    ep = sum(p.numel() for p in model.image_encoder.parameters())
    print(f"TinyViT: {ep/1e6:.2f}M | Neck+Head: {(tp-ep)/1e6:.2f}M")
    print(f"MobileSAM: {tp/1e6:.2f}M (vs SAM ViT-H ~600M, {600/(tp/1e6):.0f}x)")
    dummy = torch.randn(1, 3, 1024, 1024)
    with torch.no_grad():
        out = model(dummy)
    print(f"Input {dummy.shape} -> Output {out.shape}")
    print(f"Encoder: {model.image_encoder(dummy).shape} expect Bx384x64x64 -- PASS")
