"""
DINO_v2.py -- DINOv2 自监督视觉 Transformer 实现

论文: "DINOv2: Learning Robust Visual Features without Supervision"
      (Oquab et al., TMLR 2023)

核心创新: iBOT + DINO 联合自监督训练。教师网络是学生网络的 EMA，
学生输出强制匹配教师输出，无需标注即可学习强线性可分的通用视觉特征。

架构: 输入->PatchEmbed(14x14)->1369 patches->[CLS]+位置编码
  ->24层 Transformer->LayerNorm->L2归一化->输出
参数: img_size=518 patch_size=14 dim=1024 depth=24 heads=16
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

# ============================================
# 1. Patch Embedding: 大卷积核切片 + 线性映射
# ============================================
class PatchEmbed(nn.Module):
    """stride=patch_size 卷积一次性切片并映射到 embed_dim。"""
    def __init__(self, img_size=518, patch_size=14, in_chans=3, embed_dim=1024):
        super().__init__()
        self.img_size = img_size
        self.patch_size = patch_size
        self.grid_size = img_size // patch_size  # 37
        self.num_patches = self.grid_size ** 2   # 1369
        self.proj = nn.Conv2d(in_chans, embed_dim,
                              kernel_size=patch_size, stride=patch_size)

    def forward(self, x):
        x = self.proj(x)          # (B, 1024, 37, 37)
        x = x.flatten(2)          # (B, 1024, 1369)
        x = x.transpose(1, 2)     # (B, 1369, 1024)
        return x

# ============================================
# 2. Multi-Head Self-Attention
# ============================================
class Attention(nn.Module):
    """多头缩放点积注意力。head_dim=1024/16=64, scale 防梯度饱和。"""
    def __init__(self, dim=1024, num_heads=16, qkv_bias=True):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.scale = self.head_dim ** -0.5
        self.qkv = nn.Linear(dim, dim * 3, bias=qkv_bias)  # Q,K,V 合并
        self.proj = nn.Linear(dim, dim)

    def forward(self, x):
        B, N, C = x.shape
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)  # (3, B, heads, N, head_dim)
        q, k, v = qkv[0], qkv[1], qkv[2]
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)
        x = (attn @ v).transpose(1, 2).reshape(B, N, C)
        x = self.proj(x)
        return x

# ============================================
# 3. MLP: 升维-降维瓶颈 + GELU
# ============================================
class Mlp(nn.Module):
    """dim -> 4*dim -> dim。DINOv2 大模型可用 SwiGLU，此处 GELU。"""
    def __init__(self, in_features=1024, hidden_features=None, out_features=None):
        super().__init__()
        out_features = out_features or in_features
        hidden_features = hidden_features or in_features * 4
        self.fc1 = nn.Linear(in_features, hidden_features)
        self.act = nn.GELU()
        self.fc2 = nn.Linear(hidden_features, out_features)

    def forward(self, x):
        x = self.fc1(x)
        x = self.act(x)
        x = self.fc2(x)
        return x

# ============================================
# 4. Transformer Block (Pre-Norm)
# ============================================
class Block(nn.Module):
    """Pre-Norm: x = x + Attn(Norm(x)), x = x + MLP(Norm(x))。"""
    def __init__(self, dim=1024, num_heads=16, mlp_ratio=4.0, qkv_bias=True):
        super().__init__()
        self.norm1 = nn.LayerNorm(dim, eps=1e-6)
        self.attn = Attention(dim=dim, num_heads=num_heads, qkv_bias=qkv_bias)
        self.norm2 = nn.LayerNorm(dim, eps=1e-6)
        self.mlp = Mlp(in_features=dim, hidden_features=int(dim * mlp_ratio))

    def forward(self, x):
        x = x + self.attn(self.norm1(x))
        x = x + self.mlp(self.norm2(x))
        return x

# ============================================
# 5. DINOv2 ViT 主模型
# ============================================
class DINOv2ViT(nn.Module):
    """
    DINOv2 视觉 Transformer -- 自监督通用特征提取器。

    [CLS] Token 经 24 层自注意力与所有 Patch Token 交互，聚合全局信息。
    L2 归一化后特征在单位超球面上，余弦相似度可直接比较，线性可分性极强。

    ViT-L/14@518: depth=24 dim=1024 heads=16 ~304M
    ViT-B/14@518: depth=12 dim=768  heads=12  ~86M
    """
    def __init__(
        self, img_size=518, patch_size=14, in_chans=3,
        embed_dim=1024, depth=24, num_heads=16,
        mlp_ratio=4.0, qkv_bias=True, l2_normalize=True,
    ):
        super().__init__()
        self.embed_dim = embed_dim
        self.l2_normalize = l2_normalize
        self.num_patches = (img_size // patch_size) ** 2  # 1369

        self.patch_embed = PatchEmbed(img_size, patch_size, in_chans, embed_dim)

        # [CLS] Token: 可学习全局表征，不含空间位置信息
        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        # 位置编码: [CLS] + num_patches 个 token
        self.pos_embed = nn.Parameter(
            torch.zeros(1, self.num_patches + 1, embed_dim))

        self.blocks = nn.ModuleList([
            Block(embed_dim, num_heads, mlp_ratio, qkv_bias)
            for _ in range(depth)
        ])
        self.norm = nn.LayerNorm(embed_dim, eps=1e-6)
        self._init_weights()

    def _init_weights(self):
        """截断正态初始化 (std=0.02) 所有线性层、卷积层、位置编码。"""
        nn.init.trunc_normal_(self.patch_embed.proj.weight, std=0.02)
        if self.patch_embed.proj.bias is not None:
            nn.init.constant_(self.patch_embed.proj.bias, 0)
        nn.init.trunc_normal_(self.pos_embed, std=0.02)
        nn.init.trunc_normal_(self.cls_token, std=0.02)
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.trunc_normal_(m.weight, std=0.02)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.LayerNorm):
                nn.init.constant_(m.bias, 0)
                nn.init.constant_(m.weight, 1.0)

    def forward(self, x, return_mode="both"):
        """x:(B,3,518,518). return_mode: "cls"|"patch"|"both" -> (B,dim)|(B,1369,dim)|元组"""
        B = x.shape[0]

        x = self.patch_embed(x)                              # (B, 1369, 1024)
        x = torch.cat((self.cls_token.expand(B, -1, -1), x), dim=1)
        x = x + self.pos_embed                               # (B, 1370, 1024)

        for blk in self.blocks:
            x = blk(x)

        x = self.norm(x)
        cls_out = x[:, 0]     # (B, 1024)
        patch_out = x[:, 1:]  # (B, 1369, 1024)

        # L2 归一化: 特征映射到单位超球面，消除模长差异
        if self.l2_normalize:
            cls_out = F.normalize(cls_out, p=2, dim=-1)
            patch_out = F.normalize(patch_out, p=2, dim=-1)

        if return_mode == "cls":
            return cls_out
        elif return_mode == "patch":
            return patch_out
        return cls_out, patch_out

# ============================================
# 快速测试
# ============================================
if __name__ == "__main__":
    print("=" * 54)
    print("  DINOv2 ViT-L/14 @ 518  模型测试")
    print("=" * 54)
    model = DINOv2ViT(img_size=518, patch_size=14, embed_dim=1024,
                      depth=24, num_heads=16, l2_normalize=True)
    dummy = torch.randn(1, 3, 518, 518)
    c = model(dummy, return_mode="cls")
    print(f"[CLS]   {dummy.shape} -> {c.shape}  L2={c.norm(dim=-1).item():.4f}")
    p = model(dummy, return_mode="patch")
    print(f"[PATCH] {dummy.shape} -> {p.shape}  L2均值={p.norm(dim=-1).mean().item():.4f}")
    c2, p2 = model(dummy, return_mode="both")
    n = sum(pm.numel() for pm in model.parameters()) / 1e6
    print(f"[BOTH]  CLS={c2.shape}  PATCH={p2.shape}")
    print(f"参数量: {n:.1f}M | Patches: {model.num_patches} | 序列长: {model.num_patches+1}")
    print("=" * 54)
    print("  测试通过! DINOv2 特征提取成功。")
    print("=" * 54)
