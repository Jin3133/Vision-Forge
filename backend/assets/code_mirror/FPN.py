"""
FPN.py — 特征金字塔网络

论文: "Feature Pyramid Networks for Object Detection" (Lin et al., CVPR 2017)
核心贡献: 用极小的额外计算成本，构建多尺度特征金字塔

解决问题: 传统 CNN 只输出最后一层低分辨率特征，小物体信息丢失严重。
FPN 通过自顶向下路径 + 横向连接，将高层语义信息传递给低层高分辨率特征。

架构流程 (以 ResNet50 为例):
  C5 (2048ch, stride=32) → 1×1 conv → 256ch → M5 → 3×3 conv → P5
  C4 (1024ch, stride=16) → 1×1 conv → 256ch → + Up(M5) → M4 → 3×3 conv → P4
  C3 (512ch,  stride=8)  → 1×1 conv → 256ch → + Up(M4) → M3 → 3×3 conv → P3
  C2 (256ch,  stride=4)  → 1×1 conv → 256ch → + Up(M3) → M2 → 3×3 conv → P2

关键洞察:
  - 浅层特征分辨率高、语义弱 → 适合定位小物体
  - 深层特征分辨率低、语义强 → 适合分类和识别
  - 横向连接让两个优点融合在一起：高分辨率 + 强语义
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================
# 1. FPN 主体
# ============================================
class FeaturePyramidNetwork(nn.Module):
    """
    FPN 核心实现

    参数:
      in_channels_list: 输入特征图的通道数列表 [C2, C3, C4, C5]
      out_channels: 输出特征图的统一通道数（通常 256）
    """
    def __init__(self, in_channels_list, out_channels=256):
        super().__init__()
        self.out_channels = out_channels

        # =====================================================
        # 横向连接层 (Lateral Connections)
        # 1×1 卷积将不同通道数的输入统一到 out_channels
        # 不改变空间分辨率，只做通道对齐
        # =====================================================
        self.lateral_convs = nn.ModuleList([
            nn.Conv2d(in_ch, out_channels, kernel_size=1)
            for in_ch in in_channels_list
        ])

        # =====================================================
        # 输出卷积层 (Output Convolutions)
        # 3×3 卷积消除上采样产生的混叠伪影
        # 这也是 FPN 论文中提到的关键细节——
        # 不加这一步，上采样的棋盘格效应会影响小物体检测精度
        # =====================================================
        self.output_convs = nn.ModuleList([
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
            for _ in in_channels_list
        ])

    def forward(self, features):
        """
        features: 从底层到高层的特征图列表 [C2, C3, C4, C5]
                  分辨率依次减半: [H/4, H/8, H/16, H/32]

        返回: 多尺度特征金字塔 [P2, P3, P4, P5]
        """
        # Step 1: 所有层通过横向连接统一通道数
        laterals = [
            conv(feat)
            for conv, feat in zip(self.lateral_convs, features)
        ]

        # =====================================================
        # Step 2: 自顶向下路径 (Top-Down Pathway)
        #
        # 从最高层 P5 开始，逐层向下融合:
        #   P5 = lateral_C5 + output_conv
        #   P4 = lateral_C4 + Up(P5)
        #   P3 = lateral_C3 + Up(P4)
        #   P2 = lateral_C2 + Up(P3)
        #
        # 上采样使用最近邻插值（而非转置卷积），
        # FPN 论文实验表明这里简单的插值就够了，
        # 语义信息已经由深层特征提供，不需要学习上采样参数
        # =====================================================
        num_layers = len(laterals)
        pyramid = [None] * num_layers

        # 最高层: 直接走输出卷积
        pyramid[-1] = self.output_convs[-1](laterals[-1])

        # 逐层向下融合
        for i in range(num_layers - 2, -1, -1):
            # 将高层特征上采样到与当前层相同的空间尺寸
            up_feat = F.interpolate(
                pyramid[i + 1],
                size=laterals[i].shape[2:],  # 目标 H, W
                mode='nearest'
            )
            # 横向连接的特征 + 上采样的高层特征 → 逐元素相加
            merged = laterals[i] + up_feat
            # 3×3 卷积消除混叠
            pyramid[i] = self.output_convs[i](merged)

        return pyramid  # [P2, P3, P4, P5]


# ============================================
# 2. 快速测试（模拟 ResNet50 的四个阶段输出）
# ============================================
if __name__ == "__main__":
    # 模拟 ResNet50 的四个残差阶段输出
    # 输入图像假设为 800×800
    c2 = torch.randn(2, 256, 200, 200)   # stride=4,  C2
    c3 = torch.randn(2, 512, 100, 100)   # stride=8,  C3
    c4 = torch.randn(2, 1024, 50, 50)    # stride=16, C4
    c5 = torch.randn(2, 2048, 25, 25)    # stride=32, C5

    fpn = FeaturePyramidNetwork(
        in_channels_list=[256, 512, 1024, 2048],
        out_channels=256
    )

    p2, p3, p4, p5 = fpn([c2, c3, c4, c5])

    print("=== FPN 多尺度特征金字塔 ===")
    print(f"输入 C2: {c2.shape}  → 输出 P2: {p2.shape}")
    print(f"输入 C3: {c3.shape}  → 输出 P3: {p3.shape}")
    print(f"输入 C4: {c4.shape}  → 输出 P4: {p4.shape}")
    print(f"输入 C5: {c5.shape}  → 输出 P5: {p5.shape}")
    print(f"\n所有输出统一通道数 = 256, 分辨率逐层减半")
    print(f"参数量: {sum(p.numel() for p in fpn.parameters()) / 1e6:.3f}M")
    print(f"\n★ FPN 几乎不增加计算量，但 MS COCO 上提升了 ~2 AP!")
