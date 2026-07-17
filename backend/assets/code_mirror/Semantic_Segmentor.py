"""
Semantic_Segmentor.py -- 语义分割预测头

论文: "Fully Convolutional Networks for Semantic Segmentation" (Long et al., CVPR 2015)
      "DeepLab: Semantic Image Segmentation with Deep Convolutional Nets" (Chen et al., TPAMI 2018)

核心贡献: 将传统 CNN 的全连接层替换为全卷积层 + 上采样，实现端到端的像素级分类。
DeepLab 系列在此基础上引入空洞卷积和 ASPP 模块，进一步扩大感受野。

架构流程:
  主干特征 (B, in_channels, H/32, W/32)
    -> 3x3 Conv(in_ch -> mid_ch) + BN + ReLU    (通道压缩 + 特征精炼)
    -> 3x3 Conv(mid_ch -> mid_ch) + BN + ReLU   (深度语义建模)
    -> 1x1 Conv(mid_ch -> num_classes)           (逐像素分类 logits)
    -> BilinearInterpolate -> 原始分辨率         (上采样恢复空间尺寸)
    -> 输出: (B, num_classes, H, W) 逐像素类别预测

可选辅助损失分支: 在中间特征层额外引出分类头，帮助梯度传播，加速训练收敛。
这一技巧源自 DeepLab 系列，对深层网络的语义分割训练有显著帮助。

关键参数:
  - in_channels: 主干网络输出通道数 (ResNet50/101 -> 2048, VGG16 -> 512)
  - mid_channels: 中间特征通道数 (默认 512)
  - num_classes: 语义类别数 (PASCAL VOC -> 21, ADE20K -> 150, Cityscapes -> 19)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================
# 1. 基础卷积块: Conv2d + BatchNorm + ReLU
# ============================================
class ConvBlock(nn.Module):
    """
    标准卷积块，用于构建分割头的主体部分。

    3x3 卷积保持空间分辨率不变 (padding=1)，
    BatchNorm 稳定训练、加速收敛，
    ReLU 引入非线性，增强特征表示能力。
    """
    def __init__(self, in_ch, out_ch, kernel_size=3, padding=1):
        super().__init__()
        self.conv = nn.Conv2d(in_ch, out_ch, kernel_size, padding=padding, bias=False)
        self.bn = nn.BatchNorm2d(out_ch)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        return self.relu(self.bn(self.conv(x)))


# ============================================
# 2. 语义分割头主体: SemanticSegmentor
# ============================================
class SemanticSegmentor(nn.Module):
    """
    基于 FCN + DeepLab 设计理念的语义分割预测头。

    输入: 主干网络提取的高层语义特征 (B, C, H_s, W_s)
    输出: 逐像素类别预测 (B, num_classes, H, W) —— 已上采样至原始图像尺寸

    设计思路:
      - 前两个 3x3 卷积负责将高维主干特征压缩并精炼成语义信息
      - 1x1 卷积将通道数映射到类别数，得到每个空间位置的类别 logits
      - 双线性插值上采样恢复到原始分辨率，计算逐像素交叉熵损失

    参数:
      in_channels:  主干网络输出通道数，如 ResNet50 的 2048
      mid_channels: 中间特征通道数，默认 512 (平衡表达能力与计算量)
      num_classes:  语义类别总数 (含背景类)
      use_aux:      是否启用辅助损失分支 (默认 True，参考 DeepLab 系列做法)
    """
    def __init__(self, in_channels=2048, mid_channels=512, num_classes=21, use_aux=True):
        super().__init__()
        self.in_channels = in_channels
        self.mid_channels = mid_channels
        self.num_classes = num_classes
        self.use_aux = use_aux

        # ---- 主体分割头 ----
        # 两层 3x3 卷积做特征精炼 + 一层 1x1 卷积做逐像素分类
        self.conv1 = ConvBlock(in_channels, mid_channels, kernel_size=3, padding=1)
        self.conv2 = ConvBlock(mid_channels, mid_channels, kernel_size=3, padding=1)
        self.classifier = nn.Conv2d(mid_channels, num_classes, kernel_size=1)

        # ---- 辅助损失分支 (可选) ----
        # 在 conv1 之后引出，帮助中间层学到更强的语义特征
        # DeepLab 论文实验表明辅助损失可提升 1-2 mIoU
        if self.use_aux:
            self.aux_classifier = nn.Sequential(
                ConvBlock(mid_channels, mid_channels // 2),
                nn.Conv2d(mid_channels // 2, num_classes, kernel_size=1),
            )

        # ---- 权重初始化 ----
        self._init_weights()

    def _init_weights(self):
        """Kaiming 初始化卷积权重，BatchNorm 初始化为标准正态。"""
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def forward(self, x, original_size=None):
        """
        前向传播。

        参数:
          x: 主干特征图 (B, in_channels, H_s, W_s)，如 (1, 2048, 32, 32)
          original_size: 原始图像尺寸 (H, W) 的元组，用于双线性插值目标尺寸。
                         若为 None，默认上采样 8x (常见于 stride=8 的设置)。

        返回:
          若 use_aux=True:  (主输出 logits, 辅助输出 logits)
          若 use_aux=False: 主输出 logits
        """
        # 记录输入尺寸，用于辅助分支上采样
        input_h, input_w = x.shape[2:]

        # Step 1: 特征精炼 —— 两层 3x3 卷积深入提取语义信息
        x = self.conv1(x)    # (B, mid_ch, H_s, W_s)

        # Step 2: 辅助分支 (在主体 conv1 之后引出)
        if self.use_aux:
            aux_out = self.aux_classifier(x)  # (B, num_classes, H_s, W_s)

        # Step 3: 继续主体分支的深度特征提取
        x = self.conv2(x)    # (B, mid_ch, H_s, W_s)

        # Step 4: 1x1 卷积 -> 逐像素类别 logits
        x = self.classifier(x)  # (B, num_classes, H_s, W_s)

        # Step 5: 双线性插值上采样 -> 恢复至原始分辨率
        if original_size is not None:
            x = F.interpolate(x, size=original_size, mode='bilinear', align_corners=True)
        else:
            # 默认 8x 上采样 (常见于 backbone stride=8 的场景)
            x = F.interpolate(x, scale_factor=8, mode='bilinear', align_corners=True)

        if self.use_aux:
            return x, aux_out
        return x


# ============================================
# 3. 快速测试
# ============================================
if __name__ == "__main__":
    # 模拟 ResNet50 主干输出: stride=32, 通道数 2048
    # 输入图像假设为 256x256
    dummy_feat = torch.randn(1, 2048, 32, 32)

    # PASCAL VOC (21 类，含背景)
    model_voc = SemanticSegmentor(in_channels=2048, mid_channels=512, num_classes=21, use_aux=True)
    main_out, aux_out = model_voc(dummy_feat, original_size=(256, 256))

    print("=== Semantic Segmentor 语义分割头 ===")
    print(f"主干特征输入: {dummy_feat.shape}")
    print(f"主输出 logits: {main_out.shape}   (预期: [1, 21, 256, 256])")
    print(f"辅助分支输出: {aux_out.shape}   (预期: [1, 21, 32, 32])")
    print(f"参数量: {sum(p.numel() for p in model_voc.parameters()) / 1e6:.2f}M")

    # ADE20K (150 类)
    model_ade = SemanticSegmentor(in_channels=2048, mid_channels=512, num_classes=150, use_aux=False)
    out_ade = model_ade(dummy_feat, original_size=(256, 256))
    print(f"\nADE20K 输出: {out_ade.shape}   (预期: [1, 150, 256, 256])")

    # 不使用辅助损失时的输出
    print(f"\n★ 设计亮点:")
    print(f"  1. FCN 思想: 全卷积 + 双线性上采样实现端到端像素分类")
    print(f"  2. DeepLab 技巧: 辅助损失分支帮助梯度传播，加速深层网络收敛")
    print(f"  3. 通道压缩: 2048 -> 512 -> num_classes，兼顾效率与精度")
