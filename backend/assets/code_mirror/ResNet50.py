"""
ResNet50.py — 残差网络 50 层实现

论文: "Deep Residual Learning for Image Recognition" (He et al., CVPR 2016)
核心创新: 残差连接 (Skip Connection) 解决了深层网络退化问题

架构: 50层 = 1(conv1) + 9(conv2_x) + 12(conv3_x) + 18(conv4_x) + 9(conv5_x) + 1(FC)
参数量: ~25.5M

残差块的数学形式: output = F(x) + x
  其中 F(x) 是两层/三层卷积，x 是恒等映射
  当 F(x) 的梯度消失时，信息仍可通过 x 直接传递——
  这就是 ResNet 能堆到 152 层还不退化的秘密
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================
# 1. Bottleneck 瓶颈块：ResNet50 的核心单元
# ============================================
class Bottleneck(nn.Module):
    """
    三层卷积的瓶颈设计:

    输入 (in_channels)
      ↓ 1×1 卷积降维 (in → mid = in/4)    ← 减少计算量
      ↓ 3×3 卷积特征提取 (mid → mid)       ← 空间信息处理
      ↓ 1×1 卷积升维 (mid → out)           ← 恢复通道数
      ↓ + shortcut (恒等或1×1投影)
      ↓ ReLU

    为什么叫"瓶颈"？
    中间层的通道数被压缩到 1/4，形成一个"瓶颈"结构——
    就像沙漏一样，先收缩再扩展，在不损失太多信息的前提下大幅节省计算量。

    expansion = 4 意味着输出通道是中间层的 4 倍。
    """
    expansion = 4

    def __init__(self, inplanes, planes, stride=1, downsample=None):
        super().__init__()
        # 1×1 压缩
        self.conv1 = nn.Conv2d(inplanes, planes, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(planes)
        # 3×3 特征提取
        self.conv2 = nn.Conv2d(planes, planes, kernel_size=3, stride=stride,
                               padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(planes)
        # 1×1 扩展
        self.conv3 = nn.Conv2d(planes, planes * self.expansion, kernel_size=1, bias=False)
        self.bn3 = nn.BatchNorm2d(planes * self.expansion)
        self.relu = nn.ReLU(inplace=True)

        # shortcut：通道或尺寸不匹配时用 1×1 卷积投影匹配
        self.downsample = downsample
        self.stride = stride

    def forward(self, x):
        identity = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)

        out = self.conv2(out)
        out = self.bn2(out)
        out = self.relu(out)

        out = self.conv3(out)
        out = self.bn3(out)

        # ★ 残差连接：恒等映射绕过卷积层
        if self.downsample is not None:
            identity = self.downsample(x)

        out += identity  # F(x) + x
        out = self.relu(out)

        return out


# ============================================
# 2. ResNet50 主体
# ============================================
class ResNet50(nn.Module):
    """
    ResNet50 完整结构:

    conv1:  7×7 卷积, stride=2, 64 通道    (输入降采样 2x)
    conv2_x: 3×Bottleneck(64→256) ×3      (共 9 层)
    conv3_x: 4×Bottleneck(256→512) ×4     (共 12 层)
    conv4_x: 6×Bottleneck(512→1024) ×6    (共 18 层)
    conv5_x: 3×Bottleneck(1024→2048) ×3   (共 9 层)
    avgpool + FC(2048→num_classes)

    每个 stage 的第一个 block 负责 stride=2 的下采样，
    后面的 block 保持分辨率不变做深度特征提取。
    """
    def __init__(self, num_classes=1000, zero_init_residual=False):
        super().__init__()
        self.inplanes = 64

        # Stem: 初始卷积 + 最大池化
        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        # 经过 conv1 + maxpool: (B,3,224,224) → (B,64,56,56)

        # 四个残差阶段
        self.layer1 = self._make_layer(Bottleneck, 64, 3, stride=1)    # → (B,256,56,56)
        self.layer2 = self._make_layer(Bottleneck, 128, 4, stride=2)   # → (B,512,28,28)
        self.layer3 = self._make_layer(Bottleneck, 256, 6, stride=2)   # → (B,1024,14,14)
        self.layer4 = self._make_layer(Bottleneck, 512, 3, stride=2)   # → (B,2048,7,7)

        # 分类头
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(512 * Bottleneck.expansion, num_classes)

        # 权重初始化
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

        # 零初始化最后一个 BN 的 gamma → 让残差块初始时接近恒等映射
        if zero_init_residual:
            for m in self.modules():
                if isinstance(m, Bottleneck):
                    nn.init.constant_(m.bn3.weight, 0)

    def _make_layer(self, block, planes, blocks, stride=1):
        """构建一个残差阶段（多个 bottleneck block 堆叠）"""
        downsample = None
        # 当 stride≠1 或通道数变化时，shortcut 需要 1×1 投影匹配维度
        if stride != 1 or self.inplanes != planes * block.expansion:
            downsample = nn.Sequential(
                nn.Conv2d(self.inplanes, planes * block.expansion,
                          kernel_size=1, stride=stride, bias=False),
                nn.BatchNorm2d(planes * block.expansion),
            )

        layers = []
        # 第一个 block 可能带下采样
        layers.append(block(self.inplanes, planes, stride, downsample))
        self.inplanes = planes * block.expansion
        # 后续 block 保持分辨率
        for _ in range(1, blocks):
            layers.append(block(self.inplanes, planes))

        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)

        x = self.avgpool(x)
        x = torch.flatten(x, 1)
        x = self.fc(x)

        return x


# ============================================
# 快速测试
# ============================================
if __name__ == "__main__":
    model = ResNet50(num_classes=1000)
    dummy = torch.randn(2, 3, 224, 224)
    out = model(dummy)
    print(f"输入: {dummy.shape}")
    print(f"输出: {out.shape}  (B, num_classes)")
    print(f"参数量: {sum(p.numel() for p in model.parameters()) / 1e6:.1f}M")
