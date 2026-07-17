"""
Mask_Decoder.py — SAM 轻量级掩码解码器

论文: "Segment Anything" (Kirillov et al., ICCV 2023)
核心设计: 轻量级解码器，将图像编码器特征 + 提示编码器特征融合后生成分割掩码

架构流程:
  图像特征 (B, 256, 64, 64)        ← 编码器输出经过降维
  提示特征 (B, N_prompts, 256)     ← 稀疏提示(点/框) + 密集提示(mask)
    ↓ 交叉注意力: 提示 tokens → 图像特征
    ↓ 自注意力: 提示 tokens 之间交互
    ↓ 两层转置卷积上采样 (2x → 4x)
    ↓ 输出掩码 + IoU 分数

关键设计:
  - 两层交叉注意力机制，让提示信息充分融入图像特征
  - 使用转置卷积而非插值上采样，保留更多细节信息
  - 同时预测多个掩码（处理模糊提示），附带 IoU 置信度
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import math


# ============================================
# 1. 交叉注意力：提示 → 图像特征
# ============================================
class TwoWayAttention(nn.Module):
    """
    双向交叉注意力机制

    - Token-to-Image: 提示 token 查询图像特征中的相关信息
    - Image-to-Token: 图像特征查询提示 token 中的语义信息

    这就像"拿着问题（提示）去找答案（图像），
    同时用图像内容来确认问题的意图"——
    双向交互确保提示和图像充分对齐，生成精准的掩码。
    """

    def __init__(self, embedding_dim=256, num_heads=8):
        super().__init__()
        self.num_heads = num_heads
        self.embedding_dim = embedding_dim
        self.head_dim = embedding_dim // num_heads
        self.scale = self.head_dim ** -0.5

    def forward(self, queries, keys, values):
        """
        queries: 提示 tokens (B, N_q, 256)
        keys/values: 图像特征 (B, H*W, 256)
        """
        B, N_q, C = queries.shape
        _, N_kv, _ = keys.shape

        # 提示 token 查询图像 → 找到图像中最相关的区域
        attn_weights = torch.bmm(queries, keys.transpose(1, 2)) * self.scale
        attn_weights = F.softmax(attn_weights, dim=-1)
        output = torch.bmm(attn_weights, values)

        return output  # (B, N_q, 256)


# ============================================
# 2. MLP + LayerNorm 基础块
# ============================================
class MLPBlock(nn.Module):
    """
    Transformer 风格的 MLP 块

    LayerNorm → Linear(256→2048) → GELU → Linear(2048→256)
    残差连接帮助梯度传播，防止深层网络退化。
    """
    def __init__(self, dim=256, hidden_dim=2048):
        super().__init__()
        self.fc1 = nn.Linear(dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, dim)
        self.act = nn.GELU()

    def forward(self, x):
        shortcut = x
        x = self.fc2(self.act(self.fc1(x)))
        return x + shortcut


# ============================================
# 3. 转置卷积上采样：恢复空间分辨率
# ============================================
class UpsampleBlock(nn.Module):
    """
    使用转置卷积进行 2x 上采样

    为什么要用转置卷积而非双线性插值？
    转置卷积有可学习的参数，能学会"如何在放大时保留细节"——
    对于分割任务，这意味着边缘更锐利、轮廓更精确。
    """
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.conv_transpose = nn.ConvTranspose2d(
            in_channels, out_channels,
            kernel_size=2, stride=2
        )
        self.norm = nn.LayerNorm(out_channels)

    def forward(self, x):
        # x: (B, C, H, W)
        x = self.conv_transpose(x)
        # LayerNorm 需要 channel-last 格式
        x = x.permute(0, 2, 3, 1)  # → (B, H, W, C)
        x = self.norm(x)
        x = x.permute(0, 3, 1, 2)  # → (B, C, H, W)
        return x


# ============================================
# 4. SAM Mask Decoder：完整解码器
# ============================================
class SAMMaskDecoder(nn.Module):
    """
    SAM 的掩码解码器 —— 轻量但高效

    完整数据流:
      图像嵌入 (B, 256, 64, 64)           ← Image Encoder 输出
      提示嵌入 (B, N_prompts, 256)        ← Prompt Encoder 输出
        ↓ 双向交叉注意力（2层）
        ↓ 残差 MLP 处理
        ↓ 2x 转置卷积上采样 (64×64 → 128×128)
        ↓ 2x 转置卷积上采样 (128×128 → 256×256)
        ↓ 输出: 分割掩码 (B, 1, 256, 256)
        ↓ 输出: IoU 预测分数

    设计哲学：编码器已经很强大（ViT-H），解码器只需轻量处理即可。
    这种"重编码器 + 轻解码器"的非对称设计正是 SAM 高效的关键。
    """
    def __init__(self, embed_dim=256, num_multimask_outputs=3,
                 iou_head_depth=3, iou_head_hidden_dim=256):
        super().__init__()
        self.embed_dim = embed_dim

        # 编码器特征降维：768 → 256
        self.input_proj = nn.Conv2d(768, embed_dim, kernel_size=1)

        # 交叉注意力层（提示 ↔ 图像交互）
        self.cross_attn = TwoWayAttention(embed_dim)

        # 提示 token 自注意力
        self.self_attn = nn.MultiheadAttention(embed_dim, num_heads=8, batch_first=True)

        # MLP 处理
        self.mlp = MLPBlock(dim=embed_dim)

        # 两次 2x 上采样：总共 4x 放大
        self.upsample1 = UpsampleBlock(embed_dim, embed_dim // 2)
        self.upsample2 = UpsampleBlock(embed_dim // 2, embed_dim // 4)

        # 掩码预测头
        self.mask_head = nn.Sequential(
            nn.ConvTranspose2d(embed_dim // 4, embed_dim // 8, kernel_size=2, stride=2),
            nn.GELU(),
            nn.Conv2d(embed_dim // 8, num_multimask_outputs, kernel_size=1),
        )

        # IoU 预测头：估计每个预测掩码的质量
        self.iou_head = nn.Sequential(
            nn.Linear(embed_dim, iou_head_hidden_dim),
            nn.ReLU(),
            nn.Linear(iou_head_hidden_dim, num_multimask_outputs),
        )

    def forward(self, image_embeddings, prompt_embeddings):
        # Step 1: 编码器特征降维
        image_feats = self.input_proj(image_embeddings)  # (B, 256, 64, 64)
        B, C, H, W = image_feats.shape
        image_feats_flat = image_feats.flatten(2).transpose(1, 2)  # (B, 4096, 256)

        # Step 2: 交叉注意力——提示信息注入图像
        attn_out = self.cross_attn(prompt_embeddings, image_feats_flat, image_feats_flat)

        # Step 3: 自注意力——提示 token 之间交互
        self_attn_out, _ = self.self_attn(prompt_embeddings, prompt_embeddings, prompt_embeddings)

        # Step 4: 残差连接 + MLP
        prompt_feats = prompt_embeddings + attn_out + self_attn_out
        prompt_feats = self.mlp(prompt_feats)

        # Step 5: 上采样恢复分辨率
        x = image_feats
        x = self.upsample1(x)  # 64×64 → 128×128
        x = self.upsample2(x)  # 128×128 → 256×256

        # Step 6: 生成掩码和 IoU
        masks = self.mask_head(x)  # (B, 3, 512, 512) — 3 个候选掩码
        iou_pred = self.iou_head(prompt_feats.mean(dim=1))  # (B, 3)

        return masks, iou_pred


# ============================================
# 快速测试
# ============================================
if __name__ == "__main__":
    decoder = SAMMaskDecoder(embed_dim=256)
    # 模拟编码器输出
    img_emb = torch.randn(1, 768, 64, 64)
    # 模拟提示编码器输出（稀疏 + 密集）
    prompt_emb = torch.randn(1, 5, 256)  # 5 个提示 token

    masks, iou = decoder(img_emb, prompt_emb)
    print(f"图像特征: {img_emb.shape}")
    print(f"提示特征: {prompt_emb.shape}")
    print(f"输出掩码: {masks.shape}  (B, 3个候选, 512×512)")
    print(f"IoU 预测: {iou.shape}  (B, 3)")
    print(f"参数量: {sum(p.numel() for p in decoder.parameters()) / 1e6:.1f}M")
