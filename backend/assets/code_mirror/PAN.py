"""
PAN.py — 路径聚合网络

论文: "Path Aggregation Network for Instance Segmentation" (Liu et al., CVPR 2018)
核心贡献: 在 FPN 基础上增加自底向上路径增强，缩短浅层→深层的信息流动距离

解决问题: FPN 只有自顶向下信息流，浅层特征要经过长路径才能到达顶层。
PAN 新增 N2→N5 快捷通道，让浅层精确定位信息直达顶层。

架构流程 (ResNet50):
  FPN 自顶向下: C_i → lateral → + Up(P_{i+1}) → output_conv → P_i
  PAN 自底向上: N2=P2, N_i = P_i + Down(N_{i-1})  (3x3 conv stride=2)
  输出 [N2, N3, N4, N5]，统一 256 通道

关键洞察:
  - FPN 把强语义从上往下传 → 解决小物体语义弱
  - PAN 把精确定位从下往上送 → 解决大物体定位漂移
  - 信息通路从单向变双向，路径长度减半
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================
# 1. PAN 主体
# ============================================
class PathAggregationNetwork(nn.Module):
    """
    PAN: FPN 自顶向下 + 自底向上双路径特征融合

    参数:
      in_channels_list: 主干各阶段通道数，如 ResNet50: [256, 512, 1024, 2048]
      out_channels: 输出统一通道数，默认 256
    """

    def __init__(self, in_channels_list, out_channels=256):
        super().__init__()
        self.out_channels = out_channels
        num_layers = len(in_channels_list)

        # 横向连接: 1x1 卷积统一通道数，不改变分辨率
        self.lateral_convs = nn.ModuleList([
            nn.Conv2d(in_ch, out_channels, kernel_size=1)
            for in_ch in in_channels_list
        ])

        # FPN 输出卷积: 3x3 卷积消除上采样混叠伪影
        self.fpn_output_convs = nn.ModuleList([
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
            for _ in range(num_layers)
        ])

        # PAN 自底向上: 3x3 s=2 下采样 + 3x3 输出卷积平滑融合
        self.pan_downsample_convs = nn.ModuleList([
            nn.Conv2d(out_channels, out_channels, kernel_size=3, stride=2, padding=1)
            for _ in range(num_layers - 1)
        ])
        self.pan_output_convs = nn.ModuleList([
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1)
            for _ in range(num_layers - 1)
        ])

    def forward(self, features):
        """
        features: 从低层到高层的特征图 [C2, C3, C4, C5]
                  分辨率依次减半: [H/4, H/8, H/16, H/32]
        返回: 多尺度增强特征 [N2, N3, N4, N5]
        """
        num_layers = len(features)

        # ---- 阶段一: FPN 自顶向下路径 ----
        # C_i → lateral → + Up(P_{i+1}) → output_conv → P_i
        laterals = [
            conv(feat) for conv, feat in zip(self.lateral_convs, features)
        ]
        fpn_feats = [None] * num_layers
        fpn_feats[-1] = self.fpn_output_convs[-1](laterals[-1])

        for i in range(num_layers - 2, -1, -1):
            up_feat = F.interpolate(
                fpn_feats[i + 1],
                size=laterals[i].shape[2:],
                mode="nearest"
            )
            fpn_feats[i] = self.fpn_output_convs[i](laterals[i] + up_feat)

        # ---- 阶段二: PAN 自底向上路径 ----
        # N_0 = P_0, N_i = output_conv(P_i + Down(N_{i-1}))
        pan_feats = [None] * num_layers
        pan_feats[0] = fpn_feats[0]  # 起点 N2 = P2

        for i in range(1, num_layers):
            down_feat = self.pan_downsample_convs[i - 1](pan_feats[i - 1])
            merged = fpn_feats[i] + down_feat
            pan_feats[i] = self.pan_output_convs[i - 1](merged)

        return pan_feats


# ============================================
# 2. 快速测试（模拟 ResNet50 的四个阶段输出）
# ============================================
if __name__ == "__main__":
    # 模拟输入图像 800x800，经过 ResNet50 四个残差阶段
    c2 = torch.randn(2, 256, 200, 200)   # stride=4,  C2
    c3 = torch.randn(2, 512, 100, 100)   # stride=8,  C3
    c4 = torch.randn(2, 1024, 50, 50)    # stride=16, C4
    c5 = torch.randn(2, 2048, 25, 25)    # stride=32, C5

    pan = PathAggregationNetwork(
        in_channels_list=[256, 512, 1024, 2048],
        out_channels=256
    )

    n2, n3, n4, n5 = pan([c2, c3, c4, c5])

    print("=== PAN 路径聚合网络 — 多尺度增强特征 ===")
    print(f"主干输出 C2: {c2.shape}  → PAN 输出 N2: {n2.shape}")
    print(f"主干输出 C3: {c3.shape}  → PAN 输出 N3: {n3.shape}")
    print(f"主干输出 C4: {c4.shape}  → PAN 输出 N4: {n4.shape}")
    print(f"主干输出 C5: {c5.shape}  → PAN 输出 N5: {n5.shape}")
    print(f"\n全部输出统一通道数 = 256, 分辨率逐层减半")
    print(f"参数量: {sum(p.numel() for p in pan.parameters()) / 1e6:.3f}M")
    print(f"\n★ 对比 FPN: 增加 <0.5M 参数，实例分割 mask AP 提升 ~2-3 点!")
    print(f"★ 核心创新: 自底向上路径让 N5 直接聚合了 N2→N3→N4 的定位信息")
