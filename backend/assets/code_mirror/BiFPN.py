"""
BiFPN.py -- 双向特征金字塔网络

论文: "EfficientDet: Scalable and Efficient Object Detection" (Tan et al., CVPR 2020)
核心创新: 在 FPN 基础上引入可学习权重 + 双向（自顶向下 + 自底向上）特征流

架构流程:
  [P3,P4,P5,P6,P7] -> 通道投影 -> 自顶向下路径 -> 自底向上路径 -> 重复N次 -> [P3~P7]

快速归一化融合 (Fast Normalized Fusion):
  O = sum_i (w_i / (sum_j w_j + eps)) * I_i
  除法远快于 softmax，且每个 w_i >= 0 (ReLU 保证)，训练更稳定。

相比 FPN 的三项关键改进:
  1. 双向信息流: 自顶向下传语义 + 自底向上传细节，高层也能拿到低层的位置信息
  2. 可学习权重: 不再是简单逐元素相加，网络自己学会哪些层更重要
  3. 精简跨尺度连接: 去掉只有单一输入的冗余中间节点，减少参数量
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================
# 1. 加权特征融合 -- BiFPN 的核心算子
# ============================================
class WeightedFusion(nn.Module):
    """
    快速归一化加权融合: 每个输入分配可学习标量权重，ReLU + 归一化后加权求和

    参数: num_inputs=融合输入数(2或3), channels=特征通道数
    """
    def __init__(self, num_inputs, channels):
        super().__init__()
        self.weights = nn.Parameter(torch.ones(num_inputs, dtype=torch.float32))
        self.eps = 1e-4
        self.conv = nn.Sequential(
            nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, features):
        """features: List[Tensor], 每个 (B,C,H,W); 调用方负责提前 resize 到相同尺寸"""
        w = F.relu(self.weights)
        fused = sum(w[i] * features[i] for i in range(len(features))) / (torch.sum(w) + self.eps)
        return self.conv(fused)


# ============================================
# 2. 工具函数: 尺寸对齐
# ============================================
def _resize(source, target):
    """上采样用最近邻, 下采样用自适应平均池化, 尺寸相同时直接返回"""
    if source.shape[2:] == target.shape[2:]:
        return source
    if source.shape[2] < target.shape[2]:
        return F.interpolate(source, size=target.shape[2:], mode="nearest")
    return F.adaptive_avg_pool2d(source, target.shape[2:])


# ============================================
# 3. 单层 BiFPN Layer -- 一次完整的双向传播
# ============================================
class BiFPNLayer(nn.Module):
    """
    一层 BiFPN 包含两个子阶段:

    Stage A -- 自顶向下 (Top-Down): 将 P7 的高层语义逐层向下传递
      P7_td = Conv(P7)
      P6_td = Fusion(P6, Up(P7_td))   ...   P3_td = Fusion(P3, Up(P4_td))

    Stage B -- 自底向上 (Bottom-Up): 将 P3 的低层细节逐层向上回传
      P3_out = Fusion(P3, P3_td)
      P4_out = Fusion(P4, P4_td, Down(P3_out))   ...   P7_out 同理
    """
    def __init__(self, channels=256):
        super().__init__()
        # ---- 自顶向下融合模块 ----
        self.p7_td = nn.Sequential(                    # P7 单输入, 仅卷积
            nn.Conv2d(channels, channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(channels), nn.ReLU(inplace=True),
        )
        self.p6_td_fuse = WeightedFusion(2, channels)  # P6 + Up(P7_td)
        self.p5_td_fuse = WeightedFusion(2, channels)  # P5 + Up(P6_td)
        self.p4_td_fuse = WeightedFusion(2, channels)  # P4 + Up(P5_td)
        self.p3_td_fuse = WeightedFusion(2, channels)  # P3 + Up(P4_td)

        # ---- 自底向上融合模块 ----
        self.p3_out_fuse = WeightedFusion(2, channels)  # P3 + P3_td
        self.p4_out_fuse = WeightedFusion(3, channels)  # P4 + P4_td + Down(P3_out)
        self.p5_out_fuse = WeightedFusion(3, channels)
        self.p6_out_fuse = WeightedFusion(3, channels)
        self.p7_out_fuse = WeightedFusion(3, channels)

    def forward(self, features):
        p3, p4, p5, p6, p7 = features

        # ===== Stage A: 自顶向下 =====
        p7_td = self.p7_td(p7)
        p6_td = self.p6_td_fuse([p6, _resize(p7_td, p6)])
        p5_td = self.p5_td_fuse([p5, _resize(p6_td, p5)])
        p4_td = self.p4_td_fuse([p4, _resize(p5_td, p4)])
        p3_td = self.p3_td_fuse([p3, _resize(p4_td, p3)])

        # ===== Stage B: 自底向上 =====
        p3_out = self.p3_out_fuse([p3, p3_td])
        p4_out = self.p4_out_fuse([p4, p4_td, _resize(p3_out, p4)])
        p5_out = self.p5_out_fuse([p5, p5_td, _resize(p4_out, p5)])
        p6_out = self.p6_out_fuse([p6, p6_td, _resize(p5_out, p6)])
        p7_out = self.p7_out_fuse([p7, p7_td, _resize(p6_out, p7)])

        return [p3_out, p4_out, p5_out, p6_out, p7_out]


# ============================================
# 4. 完整 BiFPN -- 通道投影 + 多层堆叠
# ============================================
class BiFPN(nn.Module):
    """
    BiFPN 顶层模块: 1x1 通道对齐 -> N 层双向特征精炼

    参数:
      in_channels_list: 输入各层通道数, 如 [512, 1024, 2048, 256, 256]
      out_channels:     统一输出通道数, 默认 256
      num_repeats:      BiFPN Layer 重复次数, 默认 3 (EfficientDet 标准配置)

    使用: bifpn = BiFPN([256,512,1024,2048,256]); outputs = bifpn([p3,p4,p5,p6,p7])
    """
    def __init__(self, in_channels_list, out_channels=256, num_repeats=3):
        super().__init__()
        self.out_channels = out_channels
        self.num_repeats = num_repeats

        # 1x1 卷积将各层不同通道数投影到统一的 out_channels
        self.input_projs = nn.ModuleList([
            nn.Conv2d(in_ch, out_channels, kernel_size=1, bias=False)
            for in_ch in in_channels_list
        ])

        # 堆叠多个 BiFPN Layer, 逐步精炼多尺度特征
        self.layers = nn.ModuleList([
            BiFPNLayer(channels=out_channels) for _ in range(num_repeats)
        ])

    def forward(self, features):
        x = [proj(feat) for proj, feat in zip(self.input_projs, features)]
        for layer in self.layers:
            x = layer(x)
        return x


# ============================================
# 快速测试: 5 个随机特征图, stride 8/16/32/64/128
# ============================================
if __name__ == "__main__":
    p3 = torch.randn(2, 512,  128, 128)   # stride=8,  backbone C3
    p4 = torch.randn(2, 1024, 64,  64)    # stride=16, backbone C4
    p5 = torch.randn(2, 2048, 32,  32)    # stride=32, backbone C5
    p6 = torch.randn(2, 256,  16,  16)    # stride=64, P5 下采样
    p7 = torch.randn(2, 256,  8,   8)     # stride=128,P6 下采样

    bifpn = BiFPN([512, 1024, 2048, 256, 256], out_channels=256, num_repeats=3)
    p3o, p4o, p5o, p6o, p7o = bifpn([p3, p4, p5, p6, p7])

    print("=== BiFPN 双向特征金字塔 ===")
    for name, inp, out in [("P3", p3, p3o), ("P4", p4, p4o), ("P5", p5, p5o),
                            ("P6", p6, p6o), ("P7", p7, p7o)]:
        print(f"  {name}: {list(inp.shape)} -> {list(out.shape)}")
    print(f"  统一通道 = 256, 层数 = {bifpn.num_repeats}, "
          f"参数量 = {sum(p.numel() for p in bifpn.parameters()) / 1e6:.3f}M")
    print(f"  ★ EfficientDet-D0: 3.9M 参数, MS COCO 33.8 AP")
