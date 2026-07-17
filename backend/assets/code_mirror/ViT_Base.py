"""
ViT_Base.py — Vision Transformer (ViT-Base) 图像分类模型实现

论文: "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale"
      (Dosovitskiy et al., ICLR 2021)
核心创新: 首次将纯 Transformer 架构直接应用于图像分类，完全摒弃卷积归纳偏置

架构流程:
  输入 (B,3,224,224) → PatchEmbed(16x16→196 patches) → [CLS] + 位置编码
  → 12层 Pre-Norm Transformer Encoder → LayerNorm → [CLS] → Linear → (B,1000)

关键参数: img_size=224, patch_size=16, dim=768, depth=12, heads=12, num_classes=1000
"""

import torch
import torch.nn as nn


# ============================================
# 1. PatchEmbed：Conv2d 滑窗切分 + 线性投影
# ============================================
class PatchEmbed(nn.Module):
    """将图像切分为 16x16 patch 并投影到 dim 维。Conv2d 一步完成切分与投影。
    输入: (B,3,224,224) → 输出: (B,196,768)"""
    def __init__(self, img_size=224, patch_size=16, in_chans=3, dim=768):
        super().__init__()
        self.img_size = img_size
        self.grid_size = img_size // patch_size  # 14
        self.num_patches = self.grid_size ** 2   # 196
        self.proj = nn.Conv2d(in_chans, dim, kernel_size=patch_size, stride=patch_size)

    def forward(self, x):
        x = self.proj(x)             # (B,3,H,W) → (B,dim,14,14)
        x = x.flatten(2).transpose(1, 2)  # → (B,196,dim)
        return x


# ============================================
# 2. MultiHeadSelfAttention：多头缩放点积注意力
# ============================================
class MultiHeadSelfAttention(nn.Module):
    """标准多头自注意力。QKV 一次性生成后拆分为 num_heads 个头并行计算，
    每个头独立执行 softmax(QK^T/sqrt(d_k))V，最后拼接投影输出。
    多头让模型同时关注语义、空间、颜色等不同维度的 token 间依赖。"""
    def __init__(self, dim=768, num_heads=12, qkv_bias=True):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = dim // num_heads     # 64
        self.scale = self.head_dim ** -0.5   # 1/sqrt(d_k)，防止点积过大梯度消失

        self.qkv = nn.Linear(dim, dim * 3, bias=qkv_bias)
        self.proj = nn.Linear(dim, dim)

    def forward(self, x):
        B, N, C = x.shape
        # 一步生成 Q,K,V → 拆分为多头 → (3, B, num_heads, N, head_dim)
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]

        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)

        x = (attn @ v).transpose(1, 2).reshape(B, N, C)
        x = self.proj(x)
        return x


# ============================================
# 3. MLP：两层全连接 + GELU，扩张比 4
# ============================================
class MLP(nn.Module):
    """结构: Linear(dim→4*dim) → GELU → Linear(4*dim→dim)。
    注意力负责 token 间"通信"，MLP 负责 token 内"思考"。扩张比 4 是经验最优。"""
    def __init__(self, dim=768, expansion=4):
        super().__init__()
        self.fc1 = nn.Linear(dim, dim * expansion)
        self.act = nn.GELU()
        self.fc2 = nn.Linear(dim * expansion, dim)

    def forward(self, x):
        return self.fc2(self.act(self.fc1(x)))


# ============================================
# 4. TransformerEncoderBlock：Pre-Norm 残差块
# ============================================
class TransformerEncoderBlock(nn.Module):
    """Pre-Norm Transformer 块:
      x = x + MHA(LayerNorm(x))   ← 自注意力 + 残差
      x = x + MLP(LayerNorm(x))   ← 前馈网络 + 残差
    Pre-Norm 把 LN 放残差之前，梯度直通底层，训练更稳定、收敛更快。"""
    def __init__(self, dim=768, num_heads=12, expansion=4, qkv_bias=True):
        super().__init__()
        self.norm1 = nn.LayerNorm(dim, eps=1e-6)
        self.attn = MultiHeadSelfAttention(dim, num_heads, qkv_bias)
        self.norm2 = nn.LayerNorm(dim, eps=1e-6)
        self.mlp = MLP(dim, expansion)

    def forward(self, x):
        x = x + self.attn(self.norm1(x))
        x = x + self.mlp(self.norm2(x))
        return x


# ============================================
# 5. ViT_Base：完整 Vision Transformer 分类模型
# ============================================
class ViT_Base(nn.Module):
    """ViT-B/16 完整实现，参数量 ~86.6M。

    数据流全景:
      (B,3,224,224) → PatchEmbed → (B,196,768)
      → 拼接可学习 [CLS] token → (B,197,768)
      → + 可学习绝对位置编码 → 12 层 Pre-Norm Transformer
      → LayerNorm → 取 [CLS] → Linear 分类头 → (B,1000)

    [CLS] 思路来自 BERT：初始不携带 patch 信息，经 12 层自注意力逐步
    聚合所有 patch 的全局表示，最终直接用于分类，无需额外池化。"""
    def __init__(self, img_size=224, patch_size=16, in_chans=3,
                 dim=768, depth=12, heads=12, num_classes=1000,
                 expansion=4, qkv_bias=True):
        super().__init__()
        # Patch 切分与投影
        self.patch_embed = PatchEmbed(img_size, patch_size, in_chans, dim)

        # [CLS] Token (1, 1, dim)，可学习分类令牌
        self.cls_token = nn.Parameter(torch.zeros(1, 1, dim))

        # 位置编码 (1, 197, dim)，覆盖 [CLS] + 196 patches
        self.pos_embed = nn.Parameter(
            torch.zeros(1, self.patch_embed.num_patches + 1, dim)
        )

        # 12 层 Transformer 编码器堆叠
        self.blocks = nn.ModuleList([
            TransformerEncoderBlock(dim=dim, num_heads=heads,
                                    expansion=expansion, qkv_bias=qkv_bias)
            for _ in range(depth)
        ])

        # 最终归一化 + 分类头
        self.norm = nn.LayerNorm(dim, eps=1e-6)
        self.head = nn.Linear(dim, num_classes)

        self._init_weights()

    def _init_weights(self):
        """trunc_normal(std=0.02) 初始化 Linear，常量初始化 LayerNorm"""
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.trunc_normal_(m.weight, std=0.02)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.LayerNorm):
                nn.init.constant_(m.weight, 1.0)
                nn.init.constant_(m.bias, 0)

    def forward(self, x):
        B = x.shape[0]

        # Step 1: Patch Embedding
        x = self.patch_embed(x)                     # (B, 196, dim)

        # Step 2: 拼接 [CLS] token
        cls_tokens = self.cls_token.expand(B, -1, -1)
        x = torch.cat([cls_tokens, x], dim=1)        # (B, 197, dim)

        # Step 3: 添加位置编码
        x = x + self.pos_embed

        # Step 4: 逐层 Transformer 前向
        for blk in self.blocks:
            x = blk(x)

        # Step 5: LayerNorm → 取 [CLS] → 分类头
        x = self.norm(x)
        logits = self.head(x[:, 0])                  # (B, num_classes)

        return logits


# ============================================
# 快速测试
# ============================================
if __name__ == "__main__":
    model = ViT_Base(
        img_size=224, patch_size=16, in_chans=3,
        dim=768, depth=12, heads=12, num_classes=1000
    )

    dummy = torch.randn(1, 3, 224, 224)
    out = model(dummy)

    print(f"输入: {dummy.shape}")
    print(f"输出: {out.shape}  (B={out.shape[0]}, num_classes={out.shape[1]})")
    print(f"参数量: {sum(p.numel() for p in model.parameters()) / 1e6:.1f}M")
    print(f"Patch 数量: {model.patch_embed.num_patches}")
    print(f"序列长度 (含 [CLS]): {model.patch_embed.num_patches + 1}")
