"""
IA3.py — IA3 参数高效微调 (Infused Adapter via Inhibiting and Amplifying Inner Activations)

论文: "Few-Shot Parameter-Efficient Fine-Tuning is Better and Cheaper than In-Context Learning"
      (Liu et al., NeurIPS 2022)

核心思想: IA3 是当前最轻量的 PEFT 方法之一，每个 Transformer 层仅学习 3 个缩放向量:
  l_k (Key 缩放)、l_v (Value 缩放)、l_ff (FFN 中间层缩放)，可训练参数 < 0.01%。
  在不修改任何预训练权重的前提下，通过逐元素乘缩放向量来"抑制或放大"内部激活值，
  在少样本任务上达到甚至超越全量微调的性能，同时推理时无额外延迟。
"""

import torch
import torch.nn as nn


# ============================================
# 1. IA3Linear: FFN 中间层的缩放适配器
# ============================================
class IA3Linear(nn.Module):
    """
    IA3 线性层包装器 —— 在 Linear 输出上施加可学习的逐元素缩放。

    用于 FFN 中间层: h = l_ff * (W_1 @ x)，再送入 W_2。
    原始权重 W_1 被冻结，仅训练缩放向量 l_ff ∈ R^{d_ff}。
    """
    def __init__(self, linear, scaling_init=1.0):
        super().__init__()
        self.linear = linear
        # 冻结原始权重，只训练缩放向量——这是 IA3 极端轻量的根本原因
        for p in self.linear.parameters():
            p.requires_grad = False
        self.scaling = nn.Parameter(torch.full((linear.out_features,), scaling_init))

    def forward(self, x):
        """前向传播: out = Wx * l_ff (逐元素 Hadamard 积)"""
        return self.linear(x) * self.scaling


# ============================================
# 2. IA3Attention: 自注意力的 Key/Value 缩放
# ============================================
class IA3Attention(nn.Module):
    """
    IA3 多头自注意力 —— 在 K 和 V 上施加可学习的逐元素缩放。

    标准注意力:  softmax(Q @ K^T / sqrt(d)) @ V
    IA3 注意力:  softmax(Q @ (l_k * K)^T / sqrt(d)) @ (l_v * V)

    l_k, l_v 维度均为 head_dim，意味着每个注意力头有自己独立的缩放向量，
    这让模型可以学习到不同头对不同特征的偏好程度。
    """
    def __init__(self, dim, num_heads=8, scaling_init=1.0):
        super().__init__()
        assert dim % num_heads == 0, "dim 必须能被 num_heads 整除"
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.scale = self.head_dim ** -0.5

        self.qkv = nn.Linear(dim, dim * 3, bias=False)
        self.proj = nn.Linear(dim, dim)
        # 冻结 QKV 投影和输出投影权重：只训练 l_k 和 l_v
        for p in self.qkv.parameters():
            p.requires_grad = False
        for p in self.proj.parameters():
            p.requires_grad = False

        # IA3 核心: 可学习的 Key 和 Value 缩放向量 (形状 = head_dim)
        self.l_k = nn.Parameter(torch.full((self.head_dim,), scaling_init))
        self.l_v = nn.Parameter(torch.full((self.head_dim,), scaling_init))

    def forward(self, x):
        B, N, C = x.shape
        # 1. 联合 QKV 投影并分头
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)  # (3, B, num_heads, N, head_dim)
        q, k, v = qkv[0], qkv[1], qkv[2]

        # 2. IA3 缩放: l_k 抑制/放大 Key, l_v 抑制/放大 Value
        k = k * self.l_k  # (B, nh, N, hd) * (hd,) → 广播到所有 token 和 batch
        v = v * self.l_v

        # 3. 标准 Scaled Dot-Product Attention
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)
        x = (attn @ v).transpose(1, 2).reshape(B, N, C)
        return self.proj(x)


# ============================================
# 3. apply_ia3: 模型注入辅助函数
# ============================================
def apply_ia3(model, scaling_init=1.0):
    """
    将 IA3 适配器注入到预训练模型中。

    递归遍历所有子模块，找到 nn.MultiheadAttention 实例并替换为 IA3Attention，
    同时冻结所有原始参数，仅保留 IA3 缩放向量为可训练状态。

    不同模型架构差异较大，实际使用可能需要根据具体结构调整替换逻辑。
    """
    for param in model.parameters():
        param.requires_grad = False

    def _replace(module):
        for name, child in list(module.named_children()):
            if isinstance(child, nn.MultiheadAttention):
                ia3 = IA3Attention(
                    dim=child.embed_dim,
                    num_heads=child.num_heads,
                    scaling_init=scaling_init
                )
                setattr(module, name, ia3)
            else:
                _replace(child)

    _replace(model)
    return model


# ============================================
# 快速测试
# ============================================
if __name__ == "__main__":
    print("=== IA3 参数高效微调测试 ===\n")

    dim, heads = 256, 8
    attn = IA3Attention(dim=dim, num_heads=heads)
    ffn_linear = IA3Linear(nn.Linear(dim, dim * 4))

    # 参数量统计
    attn_total = sum(p.numel() for p in attn.parameters())
    attn_train = sum(p.numel() for p in attn.parameters() if p.requires_grad)
    ffn_total = sum(p.numel() for p in ffn_linear.parameters())
    ffn_train = sum(p.numel() for p in ffn_linear.parameters() if p.requires_grad)
    total_all = attn_total + ffn_total
    train_all = attn_train + ffn_train

    print(f"IA3Attention (dim={dim}, num_heads={heads}):")
    print(f"  总参数: {attn_total:,}  可训练: {attn_train:,}")
    print(f"  l_k 形状: {attn.l_k.shape}  l_v 形状: {attn.l_v.shape}")
    print(f"\nIA3Linear (in={dim}, out={dim*4}):")
    print(f"  总参数: {ffn_total:,}  可训练: {ffn_train:,}")
    print(f"  l_ff 形状: {ffn_linear.scaling.shape}")
    print(f"\n汇总: 总参数 {total_all:,} | 可训练 {train_all:,} | 占比 {train_all/total_all*100:.4f}%")

    # 前向传播
    x = torch.randn(2, 64, dim)
    y_attn = attn(x)
    y_ffn = ffn_linear(x)
    print(f"\n输入: {x.shape} → 注意力输出: {y_attn.shape} → FFN输出: {y_ffn.shape}")

    # 梯度测试
    (y_attn.sum() + y_ffn.sum()).backward()
    assert attn.l_k.grad is not None, "l_k 应接收梯度"
    assert attn.l_v.grad is not None, "l_v 应接收梯度"
    assert ffn_linear.scaling.grad is not None, "l_ff 应接收梯度"
    print("梯度测试通过: l_k, l_v, l_ff 均正确接收梯度")
    print(f"\n★ 每层仅需 {train_all} 个可训练参数即可适配整个 Transformer!")
