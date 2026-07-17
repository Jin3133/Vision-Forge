"""
PPM.py -- 金字塔池化模块 (Pyramid Pooling Module)

论文: "Pyramid Scene Parsing Network" (Zhao et al., CVPR 2017)
核心贡献: 通过多尺度池化聚合不同区域的上下文信息，大幅提升场景解析精度

解决问题: 普通 CNN 的感受野有限，对全局场景布局理解不足——
大物体需要大感受野才能完整识别，小物体需要精细的局部信息。
PPM 用多个不同大小的池化核并行提取上下文，然后融合在一起。

架构流程 (以 in_channels=2048, pool_sizes=[1,2,3,6] 为例):
  输入特征图 (B, 2048, H, W)
    ├─ AdaptiveAvgPool2d(1) → 1×1 Conv(2048→512) → Upsample → (B, 512, H, W)  ← 全局上下文
    ├─ AdaptiveAvgPool2d(2) → 1×1 Conv(2048→512) → Upsample → (B, 512, H, W)  ← 子区域上下文
    ├─ AdaptiveAvgPool2d(3) → 1×1 Conv(2048→512) → Upsample → (B, 512, H, W)  ← 中尺度上下文
    ├─ AdaptiveAvgPool2d(6) → 1×1 Conv(2048→512) → Upsample → (B, 512, H, W)  ← 细粒度上下文
    └─ 原始输入 (B, 2048, H, W)
  → Concat → (B, 4096, H, W) → 3×3 Conv → (B, 512, H, W)

关键洞察:
  - pool_size=1 等于全局平均池化，提供整张图的"粗粒度"信息
  - pool_size=6 将图像划分为 6×6=36 个格子，保留更精细的空间结构
  - 四个尺度拼在一起，模型可以同时看到"森林"和"树木"
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================
# 1. 金字塔池化模块
# ============================================
class PyramidPoolingModule(nn.Module):
    """
    PPM 核心实现 —— PSPNet 的灵魂模块

    参数:
      in_channels:  输入特征图的通道数（ResNet50 输出为 2048）
      out_channels: 最终融合后的输出通道数
      pool_sizes:   金字塔各层的池化尺寸，越小越全局，越大越局部
    """
    def __init__(self, in_channels=2048, out_channels=512, pool_sizes=(1, 2, 3, 6)):
        super().__init__()
        num_levels = len(pool_sizes)

        # 每个金字塔分支的通道压缩比: 2048 / 4 = 512
        # 这样做是因为 concat 后通道会膨胀（各分支 + 原图 = 2048×2=4096）
        # 提前压缩可以显著节省计算量
        reduced_dim = in_channels // num_levels

        # =====================================================
        # 金字塔池化分支列表
        # 每个分支 = AdaptiveAvgPool2d → 1×1 Conv → BatchNorm → ReLU
        # =====================================================
        self.pyramid_branches = nn.ModuleList([
            nn.Sequential(
                # 步骤 1: 自适应平均池化
                # 无论输入尺寸多大，都统一池化到 pool_size × pool_size
                nn.AdaptiveAvgPool2d(ps),
                # 步骤 2: 1×1 卷积压缩通道
                # 这里的卷积不仅降维，还能学习如何"浓缩"池化信息
                nn.Conv2d(in_channels, reduced_dim, kernel_size=1, bias=False),
                nn.BatchNorm2d(reduced_dim),
                nn.ReLU(inplace=True),
            )
            for ps in pool_sizes
        ])

        # =====================================================
        # 最终融合层
        # Concat 后通道数: 原图通道(2048) + 各分支压缩后通道(512×4) = 4096
        # =====================================================
        concat_channels = in_channels + reduced_dim * num_levels
        self.final_conv = nn.Sequential(
            # 3×3 卷积将拼接后的特征融合成统一的输出
            nn.Conv2d(concat_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        """
        前向传播

        参数:
          x: 输入特征图，形状 [B, C, H, W]，典型值 [B, 2048, 64, 64]

        返回:
          融合了多尺度上下文的特征图，形状 [B, out_channels, H, W]
        """
        h, w = x.shape[2:]  # 记录原始空间尺寸，用于后续上采样对齐

        # =====================================================
        # Step 1: 各金字塔分支并行处理
        #
        # 每个分支独立操作:
        #   pool(输入) → 1×1 Conv 压缩 → 上采样回原始尺寸
        #
        # 上采样使用双线性插值 (bilinear) 而非最近邻，
        # 因为池化后的特征网格较粗，bilinear 能更平滑地
        # 将"大格子"的语义信息还原到"小像素"上。
        # =====================================================
        pyramid_feats = []
        for branch in self.pyramid_branches:
            # 池化 + 1×1 卷积压缩通道
            pooled = branch(x)  # [B, reduced_dim, ps, ps]
            # 双线性插值上采样回原始 H×W
            upsampled = F.interpolate(
                pooled, size=(h, w), mode="bilinear", align_corners=True
            )
            pyramid_feats.append(upsampled)

        # =====================================================
        # Step 2: 拼接所有金字塔层级 + 原始输入
        #
        # 为什么保留原始输入？
        # 池化操作会丢失精细的空间位置信息。
        # 把原始特征图也拼回去，相当于同时保留了:
        #   - 原始输入的像素级细节
        #   - 四个金字塔层级的多尺度上下文
        # 两者互补，缺一不可。
        # =====================================================
        all_feats = [x] + pyramid_feats
        concat = torch.cat(all_feats, dim=1)  # [B, 4096, H, W]

        # Step 3: 3×3 卷积融合所有信息
        out = self.final_conv(concat)  # [B, out_channels, H, W]

        return out


# ============================================
# 2. 快速测试
# ============================================
if __name__ == "__main__":
    # 模拟 ResNet50 的 conv5_x 输出特征图
    # 典型场景: 输入 512×512 的图像，经过 5 次下采样得到 64×64
    dummy = torch.randn(1, 2048, 64, 64)

    ppm = PyramidPoolingModule(in_channels=2048, out_channels=512, pool_sizes=(1, 2, 3, 6))
    ppm.eval()  # 测试模式：冻结 BatchNorm 统计量，避免 batch_size=1 时报错

    with torch.no_grad():
        out = ppm(dummy)

    print("=== PPM 金字塔池化模块 ===")
    print(f"输入形状:  {dummy.shape}  (B=1, C=2048, H=64, W=64)")
    print(f"输出形状:  {out.shape}   (B=1, C=512, H=64, W=64)")
    print(f"参数量:    {sum(p.numel() for p in ppm.parameters()) / 1e6:.3f}M")
    print()
    print("各分支处理流程:")
    for i, ps in enumerate((1, 2, 3, 6)):
        print(f"  分支 {i + 1} (pool_size={ps:2d}): AdaptiveAvgPool2d → 1×1 Conv 压缩 → Upsample({ps}×{ps} → 64×64)")
    print(f"\n★ Concat 通道: 2048(原图) + 512×4(金字塔) = 4096 → 3×3 Conv → 512")
