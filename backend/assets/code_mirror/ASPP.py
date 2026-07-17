"""
ASPP.py -- 空洞空间金字塔池化 (Atrous Spatial Pyramid Pooling)

论文: "Encoder-Decoder with Atrous Separable Convolution for Semantic Image
       Segmentation" (Chen et al., TPAMI 2018, DeepLabV3+)

核心创新: 多条并行空洞卷积分支，以不同膨胀率捕获多尺度上下文信息，
          在保持特征图空间分辨率的同时大幅扩展感受野。

分支结构 (5条并行路径):
  输入 (B, in_channels, H, W)
    ├─ 1x1 标准卷积           → (B, C//4, H, W)  ← 局部细节
    ├─ 3x3 空洞卷积 rate=6    → (B, C//4, H, W)  ← 中程上下文
    ├─ 3x3 空洞卷积 rate=12   → (B, C//4, H, W)  ← 远程上下文
    ├─ 3x3 空洞卷积 rate=18   → (B, C//4, H, W)  ← 超远程全局
    └─ 全局平均池化 + 1x1 Conv → Upsample → (B, C//4, H, W) ← 图像级特征
  → Concat (B, 5*C//4, H, W) → 1x1 Conv → (B, out_channels, H, W)

关键公式: 空洞卷积 padding == dilation, 保证输出尺寸 Output = Input
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class ASPP(nn.Module):
    """
    空洞空间金字塔池化模块 (DeepLabV3+ 标准配置)

    参数:
        in_channels=2048  (主干网络输出通道数, 如 ResNet-50 stage4)
        out_channels=256  (输出通道数)
        atrous_rates=(6,12,18)  (空洞卷积膨胀率)
    """

    def __init__(self, in_channels=2048, out_channels=256,
                 atrous_rates=(6, 12, 18)):
        super(ASPP, self).__init__()
        branch_ch = out_channels // 4  # 每条分支输出通道数

        # 分支 1: 1x1 标准卷积 -- 局部细节
        self.aspp1 = nn.Sequential(
            nn.Conv2d(in_channels, branch_ch, 1, bias=False),
            nn.BatchNorm2d(branch_ch), nn.ReLU(inplace=True))

        # 分支 2/3/4: 3x3 空洞卷积 -- 多尺度上下文
        self.aspp2 = self._make_branch(in_channels, branch_ch, atrous_rates[0])
        self.aspp3 = self._make_branch(in_channels, branch_ch, atrous_rates[1])
        self.aspp4 = self._make_branch(in_channels, branch_ch, atrous_rates[2])

        # 分支 5: 全局平均池化 + 1x1 卷积 -- 图像级特征
        self.global_avg_pool = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Conv2d(in_channels, branch_ch, 1, bias=False),
            nn.BatchNorm2d(branch_ch), nn.ReLU(inplace=True))

        # 融合层: 1x1 卷积压缩 5 分支拼接结果 → out_channels
        total_ch = out_channels + branch_ch  # 5 * C//4
        self.conv_fusion = nn.Sequential(
            nn.Conv2d(total_ch, out_channels, 1, bias=False),
            nn.BatchNorm2d(out_channels), nn.ReLU(inplace=True),
            nn.Dropout(0.5))

        self._init_weights()

    @staticmethod
    def _make_branch(in_ch, out_ch, rate):
        """构造 3x3 空洞卷积分支; padding == rate 保证输出尺寸不变"""
        return nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, stride=1, padding=rate,
                      dilation=rate, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True))

    def _init_weights(self):
        """Kaiming 正态初始化, 适配 ReLU 激活"""
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out",
                                        nonlinearity="relu")
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1.0)
                nn.init.constant_(m.bias, 0.0)

    def forward(self, x):
        """
        参数:
            x: (B, in_channels, H, W) -- 主干网络输出特征图
        返回:
            (B, out_channels, H, W) -- 多尺度融合特征图, 空间尺寸不变
        """
        h, w = x.shape[2], x.shape[3]

        # 4 条卷积分支并行前向
        out1 = self.aspp1(x)
        out2 = self.aspp2(x)
        out3 = self.aspp3(x)
        out4 = self.aspp4(x)

        # 全局池化分支: 1x1 特征 → 双线性插值恢复尺寸
        out5 = self.global_avg_pool(x)
        out5 = F.interpolate(out5, size=(h, w),
                             mode="bilinear", align_corners=True)

        # 通道拼接 → 1x1 卷积融合
        out = torch.cat([out1, out2, out3, out4, out5], dim=1)
        return self.conv_fusion(out)


# ============================================
# 单元测试
# ============================================
if __name__ == "__main__":
    # 模拟 ResNet-50 stage4 输出: (B=1, C=2048, H=64, W=64)
    dummy = torch.randn(1, 2048, 64, 64)

    model = ASPP(in_channels=2048, out_channels=256, atrous_rates=(6, 12, 18))
    model.eval()

    with torch.no_grad():
        out = model(dummy)

    print("=== ASPP 空洞空间金字塔池化模块 ===")
    print("输入:  {}  (B=1, C=2048, H=64, W=64)".format(dummy.shape))
    print("输出:  {}   (B=1, C=256, H=64, W=64)".format(out.shape))
    print("参数量: {:.3f}M".format(
        sum(p.numel() for p in model.parameters()) / 1e6))
    print()
    print("5条并行分支:")
    print("  1x1 卷积          → 局部细节 (感受野 3x3)")
    print("  3x3 空洞 rate=6   → 中程上下文 (感受野 13x13)")
    print("  3x3 空洞 rate=12  → 远程上下文 (感受野 25x25)")
    print("  3x3 空洞 rate=18  → 超远程全局 (感受野 37x37)")
    print("  全局池化 + 1x1    → 图像级全图特征")
    print("\n通道: 2048 → 各分支 64×5=320 → 1x1 Conv → 256")

    assert out.shape == (1, 256, 64, 64), "输出形状错误!"
    assert out.shape[2] == dummy.shape[2] and out.shape[3] == dummy.shape[3], \
        "空间分辨率必须保持不变!"

    if torch.cuda.is_available():
        out_cuda = model.cuda()(dummy.cuda())
        print("\nGPU 推理通过 -- {}, 输出 {}".format(
            torch.cuda.get_device_name(0), out_cuda.shape))

    print("\n所有测试通过!")
