"""
Instance_Segmentor.py — Mask R-CNN 实例分割预测头

论文: "Mask R-CNN" (He et al., ICCV 2017)
核心贡献: 在 Faster R-CNN 的检测分支旁并联一个掩码预测分支，
         以极小的额外计算量实现高质量的实例分割。

架构流程:
  FPN 特征 (B, 256, H, W) + proposals (N, 5)
    → RoIAlign @ 7×7  → BoxHead (FC)   → 分类 + 框回归
    → RoIAlign @ 28×28 → MaskHead (FCN) → 逐类掩码 (56×56)

关键设计:
  - RoIAlign 替代 RoIPool：双线性插值消除两次量化误差，掩码 AP 提升 ~3%
  - 掩码与分类解耦：sigmoid + 二值交叉熵，每类独立预测，避免类间压制
  - "重检测 + 轻分割"：mask 分支仅 4 层卷积，无 BN（论文发现加 BN 降精度）
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.ops import roi_align


# ============================================
# 1. Box 分支：分类 + 边界框回归（继承 Faster R-CNN）
# ============================================
class BoxHead(nn.Module):
    """Faster R-CNN 检测头：RoIAlign @ 7×7 → 两层 FC → 分类 + 回归"""

    def __init__(self, in_channels=256, num_classes=80, fc_dim=1024):
        super().__init__()
        self.num_classes = num_classes
        input_dim = in_channels * 7 * 7

        self.fc1 = nn.Linear(input_dim, fc_dim)
        self.fc2 = nn.Linear(fc_dim, fc_dim)
        self.cls_score = nn.Linear(fc_dim, num_classes + 1)  # +1 为背景类
        self.bbox_pred = nn.Linear(fc_dim, num_classes * 4)  # (dx,dy,dw,dh) 每类 4 个

        # 高斯初始化 std=0.01（Detectron2 默认配置）
        for m in [self.fc1, self.fc2, self.cls_score, self.bbox_pred]:
            nn.init.normal_(m.weight, std=0.01)
            nn.init.constant_(m.bias, 0)

    def forward(self, x):
        """x: (N, 256, 7, 7) → cls_logits: (N, num_classes+1), bbox_deltas: (N, num_classes*4)"""
        x = x.flatten(1)
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        return self.cls_score(x), self.bbox_pred(x)


# ============================================
# 2. Mask 分支：全卷积网络预测逐类掩码
# ============================================
class MaskHead(nn.Module):
    """Mask R-CNN 掩码头：4 层 Conv3×3 → 转置卷积 2× → 1×1 per-class sigmoid"""

    def __init__(self, in_channels=256, num_classes=80):
        super().__init__()
        self.num_classes = num_classes

        # 4 层 3×3 卷积，padding=1 保持分辨率不变
        self.conv1 = nn.Conv2d(in_channels, 256, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(256, 256, kernel_size=3, padding=1)
        self.conv3 = nn.Conv2d(256, 256, kernel_size=3, padding=1)
        self.conv4 = nn.Conv2d(256, 256, kernel_size=3, padding=1)

        # 转置卷积 2× 上采样：28×28 → 56×56
        self.deconv = nn.ConvTranspose2d(256, 256, kernel_size=2, stride=2)

        # 1×1 卷积 → num_classes 个逐类二值掩码
        self.mask_pred = nn.Conv2d(256, num_classes, kernel_size=1)

        # Kaiming 初始化（针对 ReLU 优化）
        for m in self.modules():
            if isinstance(m, (nn.Conv2d, nn.ConvTranspose2d)):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def forward(self, x):
        """x: (N, 256, 28, 28) → masks: (N, num_classes, 56, 56) 未经过 sigmoid"""
        x = F.relu(self.conv1(x))
        x = F.relu(self.conv2(x))
        x = F.relu(self.conv3(x))
        x = F.relu(self.conv4(x))
        x = F.relu(self.deconv(x))
        return self.mask_pred(x)


# ============================================
# 3. Instance Segmentor：完整 Mask R-CNN 预测头
# ============================================
class InstanceSegmentor(nn.Module):
    """
    Mask R-CNN 实例分割预测头全集

    同一个 FPN 特征 + 同一组 proposals 分别送入两个并行分支：
      - Box 分支  (RoIAlign 7×7 → FC)  → 分类 + 边界框回归
      - Mask 分支 (RoIAlign 28×28 → FCN) → 逐类前景掩码

    训练时两个分支的损失加权求和（L = L_cls + L_box + L_mask）；
    推理时先用 box 分支确定类别，取该类对应的掩码通道作为最终结果。

    参数:
      in_channels:     FPN 输出通道数（默认 256）
      num_classes:     目标类别数不含背景（MS COCO 默认 80）
      mask_resolution: Mask 分支 RoIAlign 池化尺寸（默认 28，输出 56×56）
    """

    def __init__(self, in_channels=256, num_classes=80, mask_resolution=28):
        super().__init__()
        self.in_channels = in_channels
        self.num_classes = num_classes
        self.mask_resolution = mask_resolution
        self.box_head = BoxHead(in_channels, num_classes)
        self.mask_head = MaskHead(in_channels, num_classes)

    def forward(self, feature_map, proposals):
        """
        feature_map: FPN 单层特征图 (B, 256, H, W)
        proposals:   候选框 (N, 5)，每行 [batch_idx, x1, y1, x2, y2]
        返回: cls_logits (N, 81), bbox_deltas (N, 320), masks (N, 80, 56, 56)
        """
        # Box 分支: 7×7 RoIAlign → FC
        box_feats = roi_align(feature_map, proposals, output_size=7,
                              spatial_scale=1.0, aligned=True)
        cls_logits, bbox_deltas = self.box_head(box_feats)

        # Mask 分支: 28×28 RoIAlign → 4 层 Conv → Deconv → 逐类掩码
        mask_feats = roi_align(feature_map, proposals, output_size=self.mask_resolution,
                               spatial_scale=1.0, aligned=True)
        masks = self.mask_head(mask_feats)
        return cls_logits, bbox_deltas, masks

    def inference(self, feature_map, proposals):
        """推理模式：返回 softmax 概率、reshape 后的框偏移量、sigmoid 掩码概率"""
        cls_logits, bbox_deltas, masks = self.forward(feature_map, proposals)
        cls_probs = F.softmax(cls_logits, dim=-1)
        bbox_deltas = bbox_deltas.view(-1, self.num_classes, 4)
        mask_probs = torch.sigmoid(masks)
        return cls_probs, bbox_deltas, mask_probs


# ============================================
# 4. 快速测试
# ============================================
if __name__ == "__main__":
    # 模拟 FPN 输出特征图（800×800 输入 → P3 层 1/8 缩比）
    feature_map = torch.randn(1, 256, 64, 64)
    print(f"输入特征图: {feature_map.shape}")

    # 模拟 4 个候选框 [batch_idx, x1, y1, x2, y2]
    proposals = torch.tensor([
        [0, 10.0, 10.0, 50.0, 50.0],
        [0,  5.0,  5.0, 30.0, 35.0],
        [0, 20.0, 15.0, 60.0, 55.0],
        [0,  0.0,  0.0, 63.0, 63.0],
    ])
    print(f"候选框: {proposals.shape[0]} 个")

    model = InstanceSegmentor(in_channels=256, num_classes=80, mask_resolution=28)
    num_params = sum(p.numel() for p in model.parameters())
    print(f"参数量: {num_params / 1e6:.2f}M")

    # 训练模式
    cls_logits, bbox_deltas, masks = model(feature_map, proposals)
    print(f"\n训练模式: cls={cls_logits.shape}, bbox={bbox_deltas.shape}, mask={masks.shape}")

    # 推理模式
    cls_probs, bbox_deltas_inf, mask_probs = model.inference(feature_map, proposals)
    print(f"推理模式: cls_probs={cls_probs.shape}, bbox={bbox_deltas_inf.shape}, mask={mask_probs.shape}")

    print(f"\nsoftmax 概率和: {cls_probs.sum(dim=-1)[0].item():.4f}")
    print(f"掩码概率范围: [{mask_probs.min().item():.3f}, {mask_probs.max().item():.3f}]")
    print(f"\n★ Mask R-CNN: 以 ~{num_params / 1e6:.1f}M 参数，将检测器升级为实例分割！")
