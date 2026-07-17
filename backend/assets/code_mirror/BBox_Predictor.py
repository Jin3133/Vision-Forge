"""
BBox_Predictor.py -- 边界框回归预测头

论文: "Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks"
      (Ren et al., NeurIPS 2015)
核心贡献: 提出 Region Proposal Network (RPN)，用单个卷积网络同时预测边界框坐标
         和物体存在置信度，实现端到端的区域提议。

架构流程 (以 RPN 为蓝本):
  输入特征图 (B, C, H, W)        ← 来自主干网络/FPN 的某一层
    ↓ 3x3 卷积 + ReLU: 空间特征融合，扩大感受野
    ↓ 共享特征 (B, mid_ch, H, W)
    ↓ ┌─ 1x1 Conv → 4*A 通道   ← 边界框回归分支 (dx, dy, dw, dh per anchor)
    ↓ └─ 1x1 Conv → A 通道    ← 物体置信度分支 (foreground score per anchor)

关键设计:
  - 全卷积架构: 对输入尺寸无限制，天然支持多尺度训练和测试
  - 共享卷积层: 3x3 卷积为两个分支提供统一的局部上下文信息
  - 锚点机制: 每个空间位置预测 A 个锚框的偏移量和置信度
  - 回归目标: 预测的是相对于锚框的参数化偏移 (tx, ty, tw, th)，
    而非绝对坐标——这让不同尺度的锚框能用统一的损失函数优化
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================
# 1. BBoxPredictor: RPN 风格的双分支预测头
# ============================================
class BBoxPredictor(nn.Module):
    """
    边界框预测头 -- Faster R-CNN RPN 的核心组件

    从 Backbone/FPN 输出的特征图中，为每个空间位置上的每个锚框，
    同时预测:
      1) 边界框坐标偏移量 (bbox_deltas): 4 个参数 (dx, dy, dw, dh)
      2) 物体存在置信度 (objectness): 该锚框包含前景物体的概率

    参数:
      in_channels:  输入特征图通道数 (默认 256，对齐 FPN 输出)
      num_anchors:  每个空间位置的锚框数量 (默认 3，对应 1:1, 1:2, 2:1 三种比例)
      mid_channels: 中间共享卷积层通道数 (默认 256)

    输入:
      x: 来自 Backbone/FPN 的特征图，形状 (B, C, H, W)

    输出:
      bbox_deltas: 边界框参数化偏移，形状 (B, 4*A, H, W)
                   每 4 个通道对应一个锚框的 (dx, dy, dw, dh)
      objectness:  物体存在置信度 (logits)，形状 (B, A, H, W)
                   每个通道对应一个锚框的前景分数
    """

    def __init__(self, in_channels=256, num_anchors=3, mid_channels=256):
        super().__init__()
        self.in_channels = in_channels
        self.num_anchors = num_anchors
        self.mid_channels = mid_channels

        # =====================================================
        # 共享卷积层: 3x3 卷积 + ReLU
        #
        # 3x3 卷积的作用是聚合每个空间位置周围的局部上下文信息。
        # 对于边界框回归来说，仅仅看单个点的特征是远远不够的——
        # 你需要看到周围的像素才能判断这里是否有一个物体的"边缘"或"角点"。
        # 这一步相当于给每个位置提供了一个小的"感受野扩展"。
        # =====================================================
        self.shared_conv = nn.Sequential(
            nn.Conv2d(in_channels, mid_channels, kernel_size=3, padding=1),
            nn.ReLU(inplace=True)
        )

        # =====================================================
        # 边界框回归分支: 1x1 卷积 → 4*A 通道
        #
        # 输出 A 个锚框各自的 4 个回归参数 (dx, dy, dw, dh):
        #   dx = (Gx - Ax) / Aw   -- 中心 x 偏移量，归一化到锚框宽度
        #   dy = (Gy - Ay) / Ah   -- 中心 y 偏移量，归一化到锚框高度
        #   dw = log(Gw / Aw)     -- 宽度对数缩放比
        #   dh = log(Gh / Ah)     -- 高度对数缩放比
        #
        # 这里输出的是未经过任何激活函数的原始偏移值 (logits)。
        # 训练时使用 Smooth L1 Loss 计算回归误差。
        # =====================================================
        self.bbox_pred = nn.Conv2d(mid_channels, 4 * num_anchors, kernel_size=1)

        # =====================================================
        # 物体置信度分支: 1x1 卷积 → A 通道
        #
        # 输出 A 个锚框各自的前景/背景分数。
        # 这里输出的是 logits (未经 sigmoid)，训练时使用
        # Binary Cross Entropy with Logits Loss (BCEWithLogitsLoss)。
        #
        # 每个锚框一个分数: 越接近 +inf → 越可能是前景物体
        #                       越接近 -inf → 越可能是背景
        # =====================================================
        self.objectness_pred = nn.Conv2d(mid_channels, num_anchors, kernel_size=1)

        # 权重初始化
        self._init_weights()

    def _init_weights(self):
        """
        使用 Kaiming 正态分布初始化卷积权重。
        因为是 ReLU 激活，使用 fan_out 模式。
        偏置全部初始化为 0，让模型从小数值开始学习。
        """
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def forward(self, x):
        """
        前向传播

        x: (B, C, H, W) 输入特征图

        返回:
          bbox_deltas: (B, 4*A, H, W) 边界框坐标偏移量
          objectness:  (B, A, H, W)   物体存在置信度 logits
        """
        # Step 1: 共享 3x3 卷积提取局部上下文特征
        # 输入 (B, C, H, W) → 输出 (B, mid_ch, H, W)
        shared_feat = self.shared_conv(x)

        # Step 2: 两个兄弟分支各自预测
        # 边界框回归: (B, mid_ch, H, W) → (B, 4*A, H, W)
        bbox_deltas = self.bbox_pred(shared_feat)

        # 物体置信度: (B, mid_ch, H, W) → (B, A, H, W)
        objectness = self.objectness_pred(shared_feat)

        return bbox_deltas, objectness


# ============================================
# 2. 快速测试
# ============================================
if __name__ == "__main__":
    # 模拟 FPN P3 层输出: 典型的特征图尺寸
    # B=2, C=256, H=50, W=50 (对应约 800×800 输入图像的 stride=16 层)
    model = BBoxPredictor(in_channels=256, num_anchors=3, mid_channels=256)
    dummy = torch.randn(2, 256, 50, 50)

    bbox_deltas, objectness = model(dummy)

    print("=== BBoxPredictor 边界框预测头 ===")
    print(f"输入特征图:  {dummy.shape}  (B={dummy.shape[0]}, C={dummy.shape[1]}, H={dummy.shape[2]}, W={dummy.shape[3]})")
    print(f"边界框偏移:  {bbox_deltas.shape}  (B, 4*A={4*model.num_anchors}, H, W)")
    print(f"物体置信度:  {objectness.shape}  (B, A={model.num_anchors}, H, W)")
    print(f"参数量:      {sum(p.numel() for p in model.parameters()) / 1e3:.1f}K")
    print(f"\n★ 总提议数 = {dummy.shape[2] * dummy.shape[3] * model.num_anchors} 个锚框/图 (单层)")
