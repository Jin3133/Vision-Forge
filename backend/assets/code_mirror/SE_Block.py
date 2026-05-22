import torch
import torch.nn as nn


class SE_Block(nn.Module):
    """
    Squeeze-and-Excitation (SE) 注意力机制模块

    【教研核心逻辑】
    该模块的核心思想是让网络自己学习特征图中各个通道的“重要程度”。
    就像人在看风景时，会自动聚焦在重要的目标上，忽略背景。
    包含两个核心步骤：
    1. Squeeze (挤压)：全局平均池化，将每个通道的二维空间特征压缩成一个实数。
    2. Excitation (激发)：通过全连接层计算出每个通道的权重，然后乘回原特征图。
    """

    def __init__(self, in_channels, reduction=16):
        super(SE_Block, self).__init__()

        # Squeeze 阶段：全局平均池化 (Global Average Pooling)
        # 输入维度: [Batch, Channels, Height, Width] -> 输出维度: [Batch, Channels, 1, 1]
        self.squeeze = nn.AdaptiveAvgPool2d(1)

        # Excitation 阶段：两层全连接神经网络 (用 1x1 卷积实现)
        # 目的：学习通道间的非线性关系，并输出每个通道的权重 (0到1之间)
        self.excitation = nn.Sequential(
            # 第一层：降维，减少计算量 (in_channels -> in_channels // reduction)
            nn.Conv2d(in_channels, in_channels // reduction, kernel_size=1, bias=False),
            nn.ReLU(inplace=True),
            # 第二层：升维，恢复到原来的通道数
            nn.Conv2d(in_channels // reduction, in_channels, kernel_size=1, bias=False),
            # Sigmoid 函数：将最终输出映射到 (0, 1) 区间，作为权重系数
            nn.Sigmoid()
        )

    def forward(self, x):
        """
        前向传播函数
        x: 来自上一层的输入特征图，张量形状为 [B, C, H, W]
        """
        # 保存原始输入，方便后续做乘法
        b, c, _, _ = x.size()

        # 1. 挤压：获取全局感受野
        # y 的形状变为 [B, C, 1, 1]
        y = self.squeeze(x)

        # 2. 激发：获取各个通道的注意力权重
        # weight 的形状仍为 [B, C, 1, 1]，但里面的数值变成了 0-1 之间的小数
        weight = self.excitation(y)

        # 3. 特征重标定 (Scale)：将权重广播并乘回原特征图
        # PyTorch 会自动将 [B, C, 1, 1] 的权重扩充并与 [B, C, H, W] 相乘
        out = x * weight.expand_as(x)

        return out