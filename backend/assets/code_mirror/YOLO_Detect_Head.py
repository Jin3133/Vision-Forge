"""
YOLO_Detect_Head.py -- YOLOv8 解耦检测头 (Decoupled Head)

论文: YOLOv8 (Jocher et al., 2023) -- Ultralytics
核心贡献: 分类与回归分支完全解耦 + Anchor-Free 检测, 消除锚框超参数。

架构 (单层 FPN):
  输入 [B,C,H,W] --> Stem(3x3 Conv+BN+SiLU) --> 分类: 2xConv + Conv2d(num_classes)
                                            --> 回归: 2xConv + Conv2d(4*reg_max) + Conv2d(1)

创新点:
  - 解耦: 分类/定位各自优化, 避免共享卷积导致特征冲突
  - Anchor-Free: 每个网格直接回归 bbox, 无需锚框预设
  - DFL: 连续坐标离散化为概率分布, 提升定位精度
"""

import torch
import torch.nn as nn
import math


# ============================================
# 1. 标准卷积块 Conv2d + BN + SiLU
# ============================================
class Conv(nn.Module):
    """SiLU 比 ReLU 梯度更平滑, YOLOv8 全系统一使用"""
    def __init__(self, in_ch, out_ch, k=3, s=1, p=None):
        super().__init__()
        self.conv = nn.Conv2d(in_ch, out_ch, k, s, p or k // 2, bias=False)
        self.bn = nn.BatchNorm2d(out_ch)
        self.act = nn.SiLU(inplace=True)

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))


# ============================================
# 2. YOLOv8 解耦检测头
# ============================================
class YOLODetectHead(nn.Module):
    """
    YOLOv8 解耦检测头 -- 多尺度 Anchor-Free 检测

    对 FPN 三层 [P3,P4,P5] 分别经 Stem 对齐后, 分两路独立预测:
      分类分支: 2xConv(3x3) + Conv2d(1x1, num_classes) --> 各类别 logit
      回归分支: 2xConv(3x3) + Conv2d(1x1, 4*reg_max)  --> bbox 离散分布
                           + Conv2d(1x1, 1)            --> objectness

    参数:
      in_channels: FPN 输入通道, 默认 [256, 512, 1024]
      num_classes: 类别数, COCO 默认 80
      reg_max:     DFL 离散区间数, 默认 16 (4*16=64 通道)
    """
    def __init__(self, in_channels=None, num_classes=80, reg_max=16):
        super().__init__()
        if in_channels is None:
            in_channels = [256, 512, 1024]
        self.in_channels = in_channels
        self.num_classes = num_classes
        self.reg_max = reg_max
        nc = self.num_levels = len(in_channels)
        c = in_channels[0]  # stem 统一输出通道数

        # ---- Stem: 每层独立 Conv 对齐通道 + 聚合上下文 ----
        self.stems = nn.ModuleList([Conv(ch, c) for ch in in_channels])

        # ---- 分类分支: 2xConv 加深语义 + 1x1 映射到类别 logits ----
        self.cls_convs = nn.ModuleList([
            nn.Sequential(Conv(c, c), Conv(c, c), nn.Conv2d(c, num_classes, 1))
            for _ in range(nc)
        ])

        # ---- 回归分支: 2xConv 共享特征, 分两路输出 bbox 分布 + obj ----
        self.reg_convs = nn.ModuleList([
            nn.Sequential(Conv(c, c), Conv(c, c)) for _ in range(nc)
        ])
        self.reg_preds = nn.ModuleList([nn.Conv2d(c, 4 * reg_max, 1) for _ in range(nc)])
        self.obj_preds = nn.ModuleList([nn.Conv2d(c, 1, 1) for _ in range(nc)])
        self._init_weights()

    def _init_weights(self):
        """Kaiming 正态初始化卷积权重, 偏置置零"""
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def forward(self, features):
        """
        features: [P3, P4, P5] 三个 FPN 特征图
        返回: (cls_scores, reg_dists, obj_scores) 各为 3 层预测 list
        """
        cls_scores, reg_dists, obj_scores = [], [], []
        for i, feat in enumerate(features):
            x = self.stems[i](feat)
            cls_scores.append(self.cls_convs[i](x))       # [B, nc, H, W]
            reg_feat = self.reg_convs[i](x)
            reg_dists.append(self.reg_preds[i](reg_feat)) # [B, 4*reg_max, H, W]
            obj_scores.append(self.obj_preds[i](reg_feat))# [B, 1, H, W]
        return cls_scores, reg_dists, obj_scores


# ============================================
# 3. 损失函数
# ============================================

class DistributedFocalLoss(nn.Module):
    """
    DFL -- 离散化回归损失, YOLOv8 定位核心

    原理: bbox 坐标离散为 reg_max 个区间的概率分布。对坐标 y,
    邻接区间 y_i, y_{i+1} 满足: y = y_i*P(y_i) + y_{i+1}*P(y_{i+1})
    损失聚焦目标附近区间, 学习更精确的概率质量分配。
    """
    def __init__(self, reg_max=16):
        super().__init__()
        self.reg_max = reg_max

    def forward(self, pred_dist, target):
        """pred_dist: [N,4*reg_max] log_softmax, target: [N,4] 0~reg_max-1"""
        target = target.clamp(0, self.reg_max - 1)
        tl, tr = target.long(), target.long() + 1
        pred_dist = pred_dist.view(-1, 4, self.reg_max)
        lv = pred_dist.gather(-1, tl.unsqueeze(-1).clamp(0, self.reg_max - 1)).squeeze(-1)
        rv = pred_dist.gather(-1, tr.unsqueeze(-1).clamp(0, self.reg_max - 1)).squeeze(-1)
        wl, wr = (tr - target).float(), (target - tl).float()
        return -(wl * lv + wr * rv).mean()


class CIoULoss(nn.Module):
    """
    CIoU (Complete IoU) Loss -- 综合 IoU + 中心距 + 长宽比

    三项惩罚: (1) IoU 重叠面积  (2) d^2/c^2 中心点距离  (3) alpha*v 长宽比
    公式: L = 1 - IoU + d^2/c^2 + alpha*v
    """
    def __init__(self, eps=1e-7):
        super().__init__()
        self.eps = eps

    def forward(self, pred, target):
        """pred/target: [N,4] x1y1x2y2 格式"""
        # -- IoU --
        ix1, iy1 = torch.max(pred[:, 0], target[:, 0]), torch.max(pred[:, 1], target[:, 1])
        ix2, iy2 = torch.min(pred[:, 2], target[:, 2]), torch.min(pred[:, 3], target[:, 3])
        inter = (ix2 - ix1).clamp(0) * (iy2 - iy1).clamp(0)
        pw, ph = pred[:, 2] - pred[:, 0], pred[:, 3] - pred[:, 1]
        tw, th = target[:, 2] - target[:, 0], target[:, 3] - target[:, 1]
        iou = inter / (pw * ph + tw * th - inter + self.eps)

        # -- 中心距离 / 最小外接对角线 --
        pcx, pcy = (pred[:, 0] + pred[:, 2]) / 2, (pred[:, 1] + pred[:, 3]) / 2
        tcx, tcy = (target[:, 0] + target[:, 2]) / 2, (target[:, 1] + target[:, 3]) / 2
        rho2 = (pcx - tcx) ** 2 + (pcy - tcy) ** 2
        ex1, ey1 = torch.min(pred[:, 0], target[:, 0]), torch.min(pred[:, 1], target[:, 1])
        ex2, ey2 = torch.max(pred[:, 2], target[:, 2]), torch.max(pred[:, 3], target[:, 3])
        c2 = (ex2 - ex1) ** 2 + (ey2 - ey1) ** 2

        # -- 长宽比一致性 --
        v = (4 / math.pi ** 2) * ((torch.atan(pw / (ph + self.eps)) -
                                    torch.atan(tw / (th + self.eps))) ** 2)
        with torch.no_grad():
            alpha = v / (1 - iou + v + self.eps)
        return (1 - iou + rho2 / (c2 + self.eps) + alpha * v).mean()


# ============================================
# 4. 快速测试
# ============================================
if __name__ == "__main__":
    print("=" * 55 + "\nYOLOv8 解耦检测头 -- 单元测试\n" + "=" * 55)

    # P3(80x80,256ch)  P4(40x40,512ch)  P5(20x20,1024ch) -- 输入 640x640
    p3, p4, p5 = torch.randn(2, 256, 80, 80), torch.randn(2, 512, 40, 40), torch.randn(2, 1024, 20, 20)
    head = YOLODetectHead(num_classes=80)
    cls_scores, reg_dists, obj_scores = head([p3, p4, p5])

    print(f"输入: P3{p3.shape}  P4{p4.shape}  P5{p5.shape}")
    for i, (c, r, o) in enumerate(zip(cls_scores, reg_dists, obj_scores)):
        print(f"  P{i+3}: cls={list(c.shape)}  reg={list(r.shape)}  obj={list(o.shape)}")
    cells = sum(o.shape[2] * o.shape[3] for o in cls_scores)
    print(f"总网格: {cells}  参数量: {sum(p.numel() for p in head.parameters())/1e6:.2f}M")

    dfl = DistributedFocalLoss(16)
    print(f"DFL: {dfl(torch.randn(100, 64).softmax(-1).log(), torch.rand(100, 4) * 16).item():.4f}")

    ciou = CIoULoss()
    pb = torch.tensor([[10., 10., 50., 60.], [20., 30., 80., 90.]])
    tb = torch.tensor([[12., 12., 48., 58.], [18., 28., 82., 92.]])
    print(f"CIoU: {ciou(pb, tb).item():.4f}")
    print("=" * 55 + "\n所有测试通过!")
