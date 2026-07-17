"""
BitFit.py -- 仅微调偏置项的参数高效微调方法

论文: "BitFit: Simple Parameter-efficient Fine-tuning for
       Transformer-based Masked Language-models" (Zaken et al., ACL 2022)

核心思想:
  BitFit 冻结所有权重参数，只训练偏置项（bias）。
  对于 nn.Linear:  冻结 weight，只优化 bias
  对于 nn.Conv2d:  冻结卷积核 weight，只优化 bias
  对于 BatchNorm / LayerNorm: weight(γ) 和 bias(β) 均可训练

原理直觉:
  神经网络的"知识"主要存储在权重矩阵中，偏置项负责微调激活阈值。
  只调偏置就能让模型适配新任务，可训练参数量降至 < 0.1%。
"""

import torch
import torch.nn as nn


def apply_bitfit(model: nn.Module, verbose: bool = True) -> nn.Module:
    """
    对任意 nn.Module 递归应用 BitFit 策略：
      - Linear / Conv1d/2d/3d : 冻结 weight，只训练 bias
      - BatchNorm / LayerNorm / GroupNorm : 全部可训练
      - Embedding : 完全冻结
    返回原地修改后的模型引用。
    """
    norm_types = (nn.BatchNorm1d, nn.BatchNorm2d, nn.BatchNorm3d,
                  nn.LayerNorm, nn.GroupNorm, nn.InstanceNorm1d,
                  nn.InstanceNorm2d, nn.InstanceNorm3d)
    weight_types = (nn.Linear, nn.Conv1d, nn.Conv2d, nn.Conv3d)

    for name, module in model.named_modules():
        if isinstance(module, norm_types):
            for param in module.parameters():
                param.requires_grad = True
            continue
        if isinstance(module, nn.Embedding):
            for param in module.parameters():
                param.requires_grad = False
            continue
        if isinstance(module, weight_types):
            if hasattr(module, "weight") and module.weight is not None:
                module.weight.requires_grad = False
            if hasattr(module, "bias") and module.bias is not None:
                module.bias.requires_grad = True

    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    if verbose:
        print(f"BitFit 应用完成: 可训练 {trainable:,} / 总计 {total:,}"
              f" ({trainable/total*100:.4f}%)")
    return model


# ============================================
# 快速测试：两层 MLP 上演示 BitFit
# ============================================
if __name__ == "__main__":
    print("=" * 56)
    print("BitFit 参数高效微调  |  Zaken et al., ACL 2022")
    print("=" * 56)

    # 简单两层 MLP
    model = nn.Sequential(
        nn.Linear(256, 128, bias=True),
        nn.BatchNorm1d(128),
        nn.ReLU(),
        nn.Linear(128, 10, bias=True),
        nn.BatchNorm1d(10),
    )
    print(f"\n原始参数量: {sum(p.numel() for p in model.parameters()):,}")
    apply_bitfit(model)

    # 验证前向 + 反向传播
    x = torch.randn(4, 256)
    y = torch.randint(0, 10, (4,))
    loss = nn.CrossEntropyLoss()(model(x), y)
    loss.backward()
    print(f"Loss: {loss.item():.4f}  (梯度回传正常)")
    print(f"可训练张量数: {sum(1 for p in model.parameters() if p.requires_grad)}")
    print("=" * 56)
