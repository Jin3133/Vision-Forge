"""
LoRA.py -- 低秩适配 (Low-Rank Adaptation) 实现

论文: "LoRA: Low-Rank Adaptation of Large Language Models" (Hu et al., ICLR 2022)
核心创新: 将预训练权重的更新量分解为两个低秩矩阵的乘积 ΔW = B·A，
        训练时冻结原权重，仅更新低秩矩阵，参数量减少数百至数千倍。

数学原理:
  假设原始全连接层为 h = W₀·x (W₀ ∈ R^{d_out × d_in}, 冻结)
  LoRA 引入两个低秩矩阵: A ∈ R^{r × d_in}, B ∈ R^{d_out × r}, 其中 r << min(d_in, d_out)
  前向传播变为: h = W₀·x + (α/r)·B·A·x

  初始化策略: A 用 Kaiming 均匀初始化, B 初始化为全零 ——
  保证训练开始时 ΔW = 0, 模型行为与原始预训练模型完全一致。

  缩放因子 α/r 的作用: 将秩 r 与学习率解耦。调整 α 近似于调整学习率，
  当 r 加倍时无需重新调参 —— 这一点在论文 Section 4.2 中有详细讨论。

典型应用:
  - 微调 GPT/Llama 等大语言模型 (原论文)
  - 视觉 Transformer (ViT) 微调
  - Stable Diffusion 个性化生成 (DreamBooth + LoRA)
  - 本教学平台的 LoRA_Sampler 算子即基于此实现
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================
# 1. LoRALinear: 带低秩适配的全连接层
# ============================================
class LoRALinear(nn.Module):
    """
    低秩适配线性层 —— 在冻结的原权重旁挂两个可训练的低秩矩阵。

    结构示意:
        输入 x (d_in)
          ├──→ W₀ (冻结) ──→ h_base
          └──→ A (r×d_in) → B (d_out×r) ──→ h_lora
                             ↓
                    h = h_base + h_lora × (α/r)

    参数量对比:
        原始 Linear: d_in × d_out
        LoRA:        r × (d_in + d_out)   ← 当 r=8, d_in=d_out=1024 时仅约 1.6 万参数
    """

    def __init__(self, in_features, out_features, rank=8, alpha=16, bias=True):
        """
        参数:
            in_features:  输入特征维度 d_in
            out_features: 输出特征维度 d_out
            rank:         低秩矩阵的秩 r (默认 8)
            alpha:        缩放系数 (默认 16)
            bias:         是否保留原线性层的偏置
        """
        super().__init__()

        # 原始全连接层 —— 权重冻结，不参与梯度更新
        self.linear = nn.Linear(in_features, out_features, bias=bias)
        self.linear.weight.requires_grad = False
        if bias:
            self.linear.bias.requires_grad = False

        self.rank = rank
        self.alpha = alpha
        self.out_features = out_features
        self.in_features = in_features

        # 缩放因子: α / r, 缓存在运行时属性中避免每次前向计算除法
        self.scaling = alpha / rank

        # ★ 低秩矩阵 A: 将 d_in 维输入压缩到 r 维瓶颈 (down-projection)
        #    形状 (rank, in_features) —— 与 nn.Linear 权重形状约定一致
        self.lora_A = nn.Parameter(torch.empty(rank, in_features))

        # ★ 低秩矩阵 B: 将 r 维瓶颈扩展到 d_out 维输出 (up-projection)
        #    形状 (out_features, rank)
        self.lora_B = nn.Parameter(torch.empty(out_features, rank))

        # 初始化: A 用 Kaiming 均匀分布, B 置零 (保证训练起始 ΔW=0)
        self._reset_lora_parameters()

    def _reset_lora_parameters(self):
        """按照 LoRA 论文的初始化策略初始化 A 和 B 矩阵"""
        # A: Kaiming 均匀初始化 —— 保证前向传播时激活值方差稳定
        nn.init.kaiming_uniform_(self.lora_A, a=5 ** 0.5)
        # B: 全零初始化 —— 保证训练开始时 ΔW = B·A = 0
        nn.init.zeros_(self.lora_B)

    def forward(self, x):
        """
        前向传播: h = W₀·x + (α/r) · B · A · x

        x: 输入张量, 形状为 (..., in_features)
        返回: 形状为 (..., out_features)
        """
        # 原始冻结权重的输出
        result = self.linear(x)

        # 低秩适配增量: 先降维再升维, 最后乘以缩放因子
        # 步骤: x → (x·A^T) → 通过 B 升维 → 缩放
        lora_out = F.linear(x, self.lora_A)          # (..., rank)
        lora_out = F.linear(lora_out, self.lora_B)    # (..., out_features)
        result = result + lora_out * self.scaling

        return result


# ============================================
# 2. 辅助函数: 将模型中所有 nn.Linear 替换为 LoRALinear
# ============================================
def apply_lora_to_linear(model, rank=8, alpha=16):
    """
    递归遍历模型, 将所有 nn.Linear 层替换为 LoRALinear。

    注意: 通过 isinstance(child, LoRALinear) 守卫跳过已适配的层,
         不会把 LoRALinear 内部的 self.linear 再嵌套替换一层。

    参数:
        model: nn.Module 模型实例
        rank:  低秩矩阵的秩 r
        alpha: 缩放系数

    返回:
        model: 原地修改后的模型引用 (用于链式调用)
    """
    for name, child in model.named_children():
        if isinstance(child, nn.Linear):
            # 读取原层的参数
            in_features = child.in_features
            out_features = child.out_features
            has_bias = child.bias is not None

            # 创建对应的 LoRALinear 并拷贝原权重
            lora_layer = LoRALinear(in_features, out_features,
                                    rank=rank, alpha=alpha, bias=has_bias)
            lora_layer.linear.weight.data.copy_(child.weight.data)
            if has_bias:
                lora_layer.linear.bias.data.copy_(child.bias.data)

            setattr(model, name, lora_layer)
        elif isinstance(child, LoRALinear):
            # 已经是 LoRALinear, 跳过 (避免递归替换其内部的 self.linear)
            continue
        else:
            # 递归处理子模块
            apply_lora_to_linear(child, rank=rank, alpha=alpha)

    return model


# ============================================
# 3. 快速测试
# ============================================
if __name__ == "__main__":
    print("=" * 60)
    print("LoRA (Low-Rank Adaptation) 功能测试")
    print("论文: Hu et al., ICLR 2022")
    print("=" * 60)

    # 构造一个简单的 3 层 MLP
    class SimpleMLP(nn.Module):
        def __init__(self):
            super().__init__()
            self.fc1 = nn.Linear(128, 256)
            self.fc2 = nn.Linear(256, 128)
            self.fc3 = nn.Linear(128, 10)
            self.relu = nn.ReLU()

        def forward(self, x):
            x = self.relu(self.fc1(x))
            x = self.relu(self.fc2(x))
            x = self.fc3(x)
            return x

    model = SimpleMLP()

    # 统计原始参数量
    orig_total = sum(p.numel() for p in model.parameters())
    orig_trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\n[原始 MLP]")
    print(f"  总参数量:     {orig_total:,}")
    print(f"  可训练参数:   {orig_trainable:,}")

    # 应用 LoRA
    apply_lora_to_linear(model, rank=8, alpha=16)

    # 统计 LoRA 后的参数量
    lora_total = sum(p.numel() for p in model.parameters())
    lora_trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\n[应用 LoRA 后 (rank=8, alpha=16)]")
    print(f"  总参数量:     {lora_total:,}")
    print(f"  可训练参数:   {lora_trainable:,}")
    print(f"  可训练/原始:  {lora_trainable / orig_trainable * 100:.1f}%")

    # 验证前向传播
    dummy = torch.randn(4, 128)
    out = model(dummy)
    print(f"\n[前向传播验证]")
    print(f"  输入形状:  {dummy.shape}")
    print(f"  输出形状:  {out.shape}")

    # 验证梯度流向 (仅 A 和 B 有 grad, 原权重无 grad)
    loss = out.sum()
    loss.backward()
    print(f"\n[梯度验证]")
    for name, param in model.named_parameters():
        has_grad = param.grad is not None
        requires = param.requires_grad
        marker = "  ← 可训练" if requires else ""
        print(f"  {name:30s} requires_grad={requires}  has_grad={has_grad}{marker}")

    print(f"\n测试完成! LoRA 将可训练参数从 {orig_trainable:,} 降至 {lora_trainable:,}")
    print(f"压缩比: {orig_trainable / lora_trainable:.1f}x")
