"""
SAM_ViT.py — SAM (Segment Anything) 的 ViT 图像编码器实现

论文: "Segment Anything" (Kirillov et al., ICCV 2023)
核心设计: 使用 MAE 预训练的 ViT 作为图像编码器，配合绝对位置编码和全局注意力机制

架构流程:
  输入图像 (B, 3, 1024, 1024)
    → Patch Embedding (16x16 patches → 64x64 grid)
    → 添加绝对位置编码
    → N 层 Transformer Encoder (多头自注意力 + MLP)
    → 输出多尺度特征图

关键参数:
  - img_size: 1024 (SAM 标准输入尺寸)
  - patch_size: 16
  - embed_dim: 768 (ViT-B) / 1024 (ViT-L) / 1280 (ViT-H)
  - depth: 12 (ViT-B) / 24 (ViT-L) / 32 (ViT-H)
  - num_heads: 12 (ViT-B) / 16 (ViT-L/H)
  - global_attn_indexes: 全局注意力层索引 (window attention 中穿插 global attention)
"""

import torch
import torch.nn as nn
import math


# ============================================
# 1. Patch Embedding：将图像切分成小块并展平
# ============================================
class PatchEmbed(nn.Module):
    """
    把图像切成 16×16 的 patch，每个 patch 映射为 embed_dim 维向量

    输入: (B, 3, 1024, 1024)
    输出: (B, 64*64, 768) = (B, 4096, 768)

    这一步的本质是"把连续像素空间的信息，压缩成离散的 token 序列"——
    就像把一幅画切割成 64×64=4096 个小方块，每个方块用一个 768 维向量表示其特征。
    """
    def __init__(self, img_size=1024, patch_size=16, in_chans=3, embed_dim=768):
        super().__init__()
        self.img_size = img_size
        self.patch_size = patch_size
        self.grid_size = img_size // patch_size  # 64
        self.num_patches = self.grid_size ** 2   # 4096

        self.proj = nn.Conv2d(
            in_chans, embed_dim,
            kernel_size=patch_size,
            stride=patch_size
        )

    def forward(self, x):
        # x: (B, 3, 1024, 1024)
        x = self.proj(x)  # → (B, 768, 64, 64)
        x = x.flatten(2)  # → (B, 768, 4096)
        x = x.transpose(1, 2)  # → (B, 4096, 768)
        return x


# ============================================
# 2. Multi-Head Attention：多头自注意力
# ============================================
class Attention(nn.Module):
    """
    标准的多头自注意力机制 (Scaled Dot-Product Attention)

    Q, K, V 的维度计算:
      - 每个头的维度: head_dim = embed_dim // num_heads
      - Q = X @ W_q, shape: (B, N, embed_dim)
      - 对 Q, K, V 分头: (B, num_heads, N, head_dim)
      - Attention = softmax(Q @ K^T / sqrt(head_dim)) @ V

    这是 Transformer 的灵魂——让每个 patch 能看到所有其他 patch，
    从而捕获全局上下文信息。多头设计让模型能同时关注不同类型的特征关联。
    """
    def __init__(self, dim, num_heads=12, qkv_bias=True):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.scale = self.head_dim ** -0.5  # 1/sqrt(d_k) 缩放因子

        self.qkv = nn.Linear(dim, dim * 3, bias=qkv_bias)
        self.proj = nn.Linear(dim, dim)

    def forward(self, x):
        B, N, C = x.shape
        # 一步生成 Q, K, V
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)  # → (3, B, num_heads, N, head_dim)
        q, k, v = qkv[0], qkv[1], qkv[2]

        # Scaled Dot-Product Attention
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)

        x = (attn @ v).transpose(1, 2).reshape(B, N, C)
        x = self.proj(x)
        return x


# ============================================
# 3. MLP：前馈网络
# ============================================
class Mlp(nn.Module):
    """
    两层全连接 + GELU 激活

    Transformer 的 FFN 部分——每个 token 独立经过相同的 MLP 处理。
    第一层升维（4x）增加表示能力，第二层降维回原始大小。
    """
    def __init__(self, in_features, hidden_features=None, out_features=None):
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
# 4. Transformer Block：注意力 + MLP
# ============================================
class Block(nn.Module):
    """
    Transformer 基本块:
      x = x + Attention(LayerNorm(x))   # 残差连接 + 注意力
      x = x + MLP(LayerNorm(x))         # 残差连接 + 前馈网络

    注意 LayerNorm 放在 Attention/MLP 之前（Pre-Norm 设计），
    这是现代 Transformer 的标准做法，比 Post-Norm 更稳定、更好训练。
    """
    def __init__(self, dim, num_heads, mlp_ratio=4.0, qkv_bias=True):
        super().__init__()
        self.norm1 = nn.LayerNorm(dim, eps=1e-6)
        self.attn = Attention(dim, num_heads=num_heads, qkv_bias=qkv_bias)
        self.norm2 = nn.LayerNorm(dim, eps=1e-6)
        self.mlp = Mlp(in_features=dim, hidden_features=int(dim * mlp_ratio))

    def forward(self, x):
        x = x + self.attn(self.norm1(x))
        x = x + self.mlp(self.norm2(x))
        return x


# ============================================
# 5. SAM Image Encoder：完整 ViT 编码器
# ============================================
class SAMImageEncoder(nn.Module):
    """
    SAM 的图像编码器 —— 完整的数据流:

    输入图像 (B, 3, 1024, 1024)
      ↓ PatchEmbed (16x16 卷积，stride=16)
    (B, 4096, 768) 个 patch tokens
      ↓ 添加绝对位置编码 (learnable)
      ↓ 12/24/32 层 Transformer Block
      ↓ 输出: (B, 4096, 768) 特征序列

    SAM 使用 ViT 作为编码器的原因是：
    ViT 的全局自注意力机制能让模型在浅层就建立图像级别的长程依赖，
    这对分割任务至关重要——网络需要理解"图像左侧的物体和右侧的物体是什么关系"。
    """
    def __init__(self, img_size=1024, patch_size=16, in_chans=3,
                 embed_dim=768, depth=12, num_heads=12,
                 mlp_ratio=4.0, qkv_bias=True):
        super().__init__()
        self.patch_embed = PatchEmbed(img_size, patch_size, in_chans, embed_dim)

        # 可学习的绝对位置编码：告诉模型每个 patch 在图像中的位置
        self.pos_embed = nn.Parameter(
            torch.zeros(1, self.patch_embed.num_patches, embed_dim)
        )
        nn.init.trunc_normal_(self.pos_embed, std=0.02)

        # N 层 Transformer Block 堆叠
        self.blocks = nn.ModuleList([
            Block(dim=embed_dim, num_heads=num_heads,
                  mlp_ratio=mlp_ratio, qkv_bias=qkv_bias)
            for _ in range(depth)
        ])

        self.norm = nn.LayerNorm(embed_dim, eps=1e-6)
        self.embed_dim = embed_dim

    def forward(self, x):
        # Step 1: Patch Embedding
        x = self.patch_embed(x)  # (B, 4096, 768)

        # Step 2: 加上位置编码
        x = x + self.pos_embed

        # Step 3: 逐层 Transformer 前向
        for blk in self.blocks:
            x = blk(x)

        # Step 4: 最终 LayerNorm
        x = self.norm(x)

        return x  # (B, 4096, 768)


# ============================================
# 快速测试
# ============================================
if __name__ == "__main__":
    encoder = SAMImageEncoder(embed_dim=768, depth=12, num_heads=12)
    dummy = torch.randn(1, 3, 1024, 1024)
    out = encoder(dummy)
    print(f"输入: {dummy.shape}")
    print(f"输出: {out.shape}  (B={out.shape[0]}, N_patches={out.shape[1]}, D={out.shape[2]})")
    print(f"参数量: {sum(p.numel() for p in encoder.parameters()) / 1e6:.1f}M")
