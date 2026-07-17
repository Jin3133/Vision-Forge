"""
AdapterFormer.py -- Transformer 适配器模块实现

论文: "VL-Adapter: Parameter-Efficient Transfer Learning for Vision-and-Language Tasks"
      (Sung et al., CVPR 2022) 及 Adapter 系列研究
核心思想: 在预训练 Transformer 的每一层插入轻量级瓶颈适配器 (Bottleneck Adapter)，
         微调时只更新适配器参数，冻结主干网络，极大降低微调成本。

架构:
  原始 Transformer Block:
    x = x + Attention(LayerNorm(x))
    x = x + FFN(LayerNorm(x))

  AdapterFormer 插入后:
    x = x + Attention(LayerNorm(x))
    x = x + FFN(LayerNorm(x))
    x = x + Adapter(x)          ← 新增：瓶颈适配器 + 残差连接

适配器内部结构 (Bottleneck):
  LayerNorm → Linear(dim, dim/reduction) → GELU → Linear(dim/reduction, dim)

为什么有效？
  - 适配器参数量仅为主干的 ~2%，训练成本大幅降低
  - 瓶颈结构迫使适配器学习紧凑的任务特定特征
  - 残差连接确保初始化时适配器输出接近零，不破坏预训练权重
"""

import torch
import torch.nn as nn


# ============================================
# 1. AdapterFormerBlock：瓶颈适配器核心单元
# ============================================
class AdapterFormerBlock(nn.Module):
    """
    轻量级瓶颈适配器 —— 插入到 Transformer Block 的 FFN 之后

    内部流程 (Bottleneck 设计):
      x → LayerNorm → Linear(dim → dim/reduction) → GELU → Linear(dim/reduction → dim)
      output = x + adapter(x)

    参数:
      hidden_dim: Transformer 的隐藏维度 (默认 768，对应 ViT-B)
      reduction: 瓶颈压缩比，值越大适配器越小 (默认 4)
    """
    def __init__(self, hidden_dim=768, reduction=4):
        super().__init__()
        bottleneck_dim = hidden_dim // reduction

        # 层归一化：稳定适配器输入分布，与 Transformer 内部 Norm 保持一致
        self.norm = nn.LayerNorm(hidden_dim, eps=1e-6)

        # 瓶颈结构：先降维（压缩信息）再升维（恢复维度）
        # 这种"沙漏"设计让适配器参数量极低：2 * hidden_dim * bottleneck_dim
        self.down_proj = nn.Linear(hidden_dim, bottleneck_dim)
        self.act = nn.GELU()
        self.up_proj = nn.Linear(bottleneck_dim, hidden_dim)

        # ★ 关键初始化策略：将近零初始化上投影权重，偏置置零
        # 这样训练初期 adapter(x) ≈ 0，输出 ≈ 恒等映射，
        # 确保预训练权重不会被随机初始化的适配器破坏
        nn.init.normal_(self.down_proj.weight, std=1e-2)
        nn.init.normal_(self.up_proj.weight, std=1e-2)
        nn.init.zeros_(self.down_proj.bias)
        nn.init.zeros_(self.up_proj.bias)

    def forward(self, x):
        """
        x: 输入特征，形状 (B, N, D)，其中 N 为 token 数量，D 为隐藏维度
        返回: (B, N, D) 与输入同形状
        """
        # 瓶颈适配器: Norm → Down → Act → Up
        adapted = self.norm(x)
        adapted = self.down_proj(adapted)
        adapted = self.act(adapted)
        adapted = self.up_proj(adapted)

        # 残差连接：适配器输出叠加回原始特征
        return x + adapted


# ============================================
# 2. AdapterFormerWrapper：包裹 ViT Block 插入适配器
# ============================================
class AdapterFormerWrapper(nn.Module):
    """
    将 AdapterFormer 注入到 ViT Transformer Block 中的包装器

    扩展后的 Block 数据流:
      1. x = x + Attention(LayerNorm(x))       ← 原始自注意力（主干冻结）
      2. x = x + FFN(LayerNorm(x))              ← 原始前馈网络（主干冻结）
      3. x = x + Adapter(x)                     ← ★ 新增适配器（仅此部分可训练）

    参数:
      vit_block: 预训练的 ViT Transformer Block (nn.Module)
      hidden_dim: 隐藏维度，需与 vit_block 匹配
      reduction: 适配器瓶颈压缩比
    """
    def __init__(self, vit_block, hidden_dim=768, reduction=4):
        super().__init__()
        self.vit_block = vit_block  # 原始 ViT Transformer Block
        self.adapter = AdapterFormerBlock(hidden_dim, reduction)

    def forward(self, x):
        # Step 1 & 2: 通过原始 ViT Block (Attention + FFN)
        x = self.vit_block(x)

        # Step 3: AdapterFormer 瓶颈适配（这是微调时唯一学习新知识的地方）
        x = self.adapter(x)

        return x

    def freeze_backbone(self):
        """
        冻结主干网络参数，仅保留适配器可训练

        这是 AdapterFormer 的核心优势：
        微调时冻结整个 ViT，只优化每层插入的小适配器，
        参数量通常只有主干网络的 1%~3%
        """
        for param in self.vit_block.parameters():
            param.requires_grad = False
        for param in self.adapter.parameters():
            param.requires_grad = True


# ============================================
# 快速测试：模拟 ViT Block 验证适配器插入
# ============================================
if __name__ == "__main__":
    # 构造一个简化的 ViT Transformer Block（仅用于测试适配器插入逻辑）
    class MockViTBlock(nn.Module):
        """模拟 ViT Block: Attention + FFN，均使用 Pre-Norm 设计"""
        def __init__(self, dim=768, mlp_ratio=4.0):
            super().__init__()
            self.norm1 = nn.LayerNorm(dim, eps=1e-6)
            self.attn = nn.Linear(dim, dim)  # 简化的 Attention
            self.norm2 = nn.LayerNorm(dim, eps=1e-6)
            self.mlp = nn.Sequential(
                nn.Linear(dim, int(dim * mlp_ratio)),
                nn.GELU(),
                nn.Linear(int(dim * mlp_ratio), dim),
            )

        def forward(self, x):
            x = x + self.attn(self.norm1(x))
            x = x + self.mlp(self.norm2(x))
            return x

    # 测试参数
    batch_size, num_tokens, dim = 2, 197, 768  # ViT-B: 196 patches + 1 CLS token

    # 创建包装了适配器的 ViT Block
    mock_block = MockViTBlock(dim=dim)
    adapted_block = AdapterFormerWrapper(mock_block, hidden_dim=dim, reduction=4)

    # 冻结主干、仅保留适配器可训练
    adapted_block.freeze_backbone()

    # 前向传播测试
    dummy_input = torch.randn(batch_size, num_tokens, dim)
    output = adapted_block(dummy_input)

    # 统计参数量
    total_params = sum(p.numel() for p in adapted_block.parameters())
    trainable_params = sum(p.numel() for p in adapted_block.parameters() if p.requires_grad)
    adapter_only = sum(p.numel() for p in adapted_block.adapter.parameters())

    print("=== AdapterFormer 适配器注入测试 ===")
    print(f"输入:  {dummy_input.shape}")
    print(f"输出:  {output.shape}")
    print(f"\n总参数量:       {total_params / 1e6:.3f}M")
    print(f"可训练参数:     {trainable_params / 1e6:.3f}M")
    print(f"适配器参数量:   {adapter_only / 1e6:.3f}M")
    print(f"可训练占比:     {trainable_params / total_params * 100:.1f}%")
    print(f"\n★ AdapterFormer 仅需微调 {trainable_params / total_params * 100:.1f}% 的参数，")
    print(f"  即可让预训练 ViT 适配下游视觉任务，大幅降低微调成本！")
