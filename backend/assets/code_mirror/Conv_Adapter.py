"""
Conv_Adapter.py -- 1x1 卷积瓶颈适配器

论文: "Parameter-Efficient Transfer Learning for NLP" (Houlsby et al., ICML 2019)
核心思想: 将 NLP Adapter 迁移到视觉领域，用 1x1 卷积替代全连接层做通道级特征适配。
         只微调新增的适配器参数，主干网络权重冻结，实现参数高效的迁移学习。

结构: input -> 1x1 Conv(C -> C//r) -> ReLU -> 1x1 Conv(C//r -> C) -> +x -> output
瓶颈压缩比 r 默认 4，适配器参数量仅为原网络的 O(1/r)。
"""

import torch
import torch.nn as nn


class ConvAdapter(nn.Module):
    """
    1x1 卷积瓶颈适配器 —— 在主干网络层后插入的小型残差模块。

    参数:
        in_channels: 输入特征图的通道数
        reduction:   瓶颈压缩比（默认 4），越小表达力越强、参数越多
    """

    def __init__(self, in_channels: int, reduction: int = 4):
        super(ConvAdapter, self).__init__()

        mid = max(1, in_channels // reduction)

        # 降维: in_channels -> in_channels // reduction
        self.down = nn.Conv2d(in_channels, mid, kernel_size=1, bias=True)

        # 激活: 引入非线性
        self.act = nn.ReLU(inplace=True)

        # 升维: in_channels // reduction -> in_channels, 恢复原始通道数
        self.up = nn.Conv2d(mid, in_channels, kernel_size=1, bias=True)

        # 初始化策略: 接近零初始化, 使适配器初始时近似恒等映射
        nn.init.normal_(self.down.weight, std=1e-4)
        nn.init.zeros_(self.down.bias)
        nn.init.zeros_(self.up.weight)
        nn.init.zeros_(self.up.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """前向传播: adapt(x) = W_up * ReLU(W_down * x) + x"""
        return self.up(self.act(self.down(x))) + x


def apply_conv_adapter(model: nn.Module, reduction: int = 4) -> nn.Module:
    """
    遍历模型的 nn.Conv2d 层，在非 1x1 卷积之后插入 ConvAdapter。

    跳过 1x1 卷积的原因是:
    1. 避免对投影层/适配器自身重复插入
    2. 1x1 卷积本身已是最简变换，再加瓶颈无意义

    参数:
        model    : 待插入适配器的 PyTorch 模型（原地修改）
        reduction: 适配器瓶颈压缩比
    返回:
        插入适配器后的模型
    """
    for name, child in model.named_children():
        if isinstance(child, nn.Conv2d) and child.kernel_size != (1, 1):
            adapter = ConvAdapter(child.out_channels, reduction=reduction)
            setattr(model, name, nn.Sequential(child, adapter))
        elif not isinstance(child, nn.Conv2d):
            apply_conv_adapter(child, reduction=reduction)
    return model


# ============================================
# 快速测试
# ============================================
if __name__ == "__main__":
    print("=" * 60)
    print("ConvAdapter 单元测试")
    print("=" * 60)

    # 1. 单模块测试
    adapter = ConvAdapter(in_channels=64, reduction=4)
    dummy = torch.randn(2, 64, 32, 32)
    out = adapter(dummy)
    print(f"\n[ConvAdapter 单模块]")
    print(f"  输入: {dummy.shape}  ->  输出: {out.shape}")
    print(f"  参数量: {sum(p.numel() for p in adapter.parameters()):,}")

    # 2. 插入测试: 验证 apply_conv_adapter
    net = nn.Sequential(
        nn.Conv2d(3, 16, kernel_size=3, padding=1),
        nn.ReLU(inplace=True),
        nn.Conv2d(16, 32, kernel_size=3, padding=1),
        nn.ReLU(inplace=True),
        nn.Conv2d(32, 32, kernel_size=1),  # 1x1 应被跳过
    )
    print(f"\n[apply_conv_adapter 插入测试]")
    before = sum(p.numel() for p in net.parameters())
    print(f"  原始参数量: {before:,}")

    apply_conv_adapter(net, reduction=4)
    after = sum(p.numel() for p in net.parameters())
    print(f"  插入后参数量: {after:,}")
    print(f"  新增参数: +{after - before:,} (仅增加 {(after - before) / after * 100:.1f}%)")

    test_out = net(torch.randn(2, 3, 32, 32))
    print(f"  输出形状: {test_out.shape}")
    print(f"\n  所有测试通过!")
    print("=" * 60)
