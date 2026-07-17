"""
FastSAM.py — Fast Segment Anything Model 实时分割模型

论文: "Fast Segment Anything" (Zhao et al., 2023)
核心创新: 用 YOLOv8-seg 的 CNN 主干替代 SAM 的 ViT 编码器，实现 50 倍加速

架构对比:
  SAM:   ViT-H 编码器 (632M 参数, ~6 FPS) → 重型 Transformer 解码器
  FastSAM: YOLOv8 CNN 主干 (~22M 参数, ~300 FPS) → 轻量掩码解码器

两阶段流程:
  第一阶段 — YOLOv8 实例分割: CNN 主干提取多尺度特征 → 分割头生成原型掩码 + 掩码系数
  第二阶段 — 提示引导掩码选择: 根据点/框提示，从所有实例掩码中选出最佳匹配

关键洞察:
  - SAM 的 ViT 擅长全局语义但推理极慢——每次分割都要跑完整 Transformer
  - YOLOv8 的 CNN 主干经过高度工程优化，一次前向就能输出所有实例掩码
  - 后续的"提示选择"只是对已生成掩码做轻量匹配，几乎不增加计算量
  - 精度略低于 SAM（尤其在复杂场景），但速度提升 50 倍，适合实时应用
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================
# 1. 基础卷积块: Conv + BatchNorm + SiLU
# ============================================
class ConvBlock(nn.Module):
    """
    YOLOv8 标准卷积块: Conv2d → BatchNorm2d → SiLU

    SiLU (Swish) 激活函数比 ReLU 更平滑，在 YOLO 系列中效果更好。
    """
    def __init__(self, in_ch, out_ch, kernel_size=3, stride=1, padding=None):
        super().__init__()
        padding = padding or kernel_size // 2
        self.conv = nn.Conv2d(in_ch, out_ch, kernel_size, stride, padding, bias=False)
        self.bn = nn.BatchNorm2d(out_ch)
        self.act = nn.SiLU(inplace=True)

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))


# ============================================
# 2. CSP 瓶颈块: 部分通道做变换，部分直连
# ============================================
class CSPBottleneck(nn.Module):
    """
    Cross Stage Partial Bottleneck — YOLOv8 的核心构建块

    将输入通道一分为二:
      一半直接短路（恒等映射，几乎零计算量）
      另一半经过两个 3x3 卷积做特征变换
    最后拼接两路输出，再用 1x1 卷积融合

    这种"部分变换 + 部分直连"的设计既减少了计算量，
    又通过特征复用增强了梯度流——是 YOLOv8 既快又准的关键。
    """
    def __init__(self, in_ch, out_ch, shortcut=True, expansion=0.5):
        super().__init__()
        hidden_ch = int(out_ch * expansion)
        self.cv1 = ConvBlock(in_ch, hidden_ch, kernel_size=1)
        self.cv2 = ConvBlock(hidden_ch, out_ch, kernel_size=3)
        self.shortcut = shortcut and in_ch == out_ch
        self.cv_out = ConvBlock(out_ch * 2, out_ch, kernel_size=1)

    def forward(self, x):
        # 通道减半: 1x1 降维 + 3x3 特征提取
        y = self.cv2(self.cv1(x))
        # 残差连接: 如果通道匹配就加回去
        if self.shortcut:
            y = y + x
        # 拼接原输入与变换后特征，再用 1x1 融合
        return self.cv_out(torch.cat([x, y], dim=1))


# ============================================
# 3. 轻量级 CNN 主干: 简化的 YOLOv8 风格特征提取器
# ============================================
class LightweightCNNBackbone(nn.Module):
    """
    简化的 YOLOv8 风格 CNN 主干网络

    设计目标: 在精度和速度之间找到最优平衡
      - 比 ResNet50 更轻（去掉沉重的 bottleneck 设计）
      - 比 MobileNet 更准（保留足够的特征维度）
      - 输出三个尺度的特征图用于后续多尺度分割

    下采样路径 (输入 640x640):
      Stem:   640x640 → 320x320 (stride=2, 64ch)
      Stage1: 320x320 → 160x160 (stride=2, 128ch)
      Stage2: 160x160 →  80x80  (stride=2, 256ch)  ← 输出 P3
      Stage3:  80x80  →  40x40  (stride=2, 512ch)  ← 输出 P4
      Stage4:  40x40  →  20x20  (stride=2, 512ch)  ← 输出 P5

    参数量约 7M，比 ViT-H 的 632M 少了近 100 倍。
    """
    def __init__(self, base_width=64):
        super().__init__()
        w = base_width

        # Stem: 初始卷积，快速降采样
        self.stem = nn.Sequential(
            ConvBlock(3, w, kernel_size=3, stride=2),        # 320x320
            ConvBlock(w, w, kernel_size=3, stride=1),
            ConvBlock(w, w * 2, kernel_size=3, stride=2),     # 160x160
        )

        # Stage 2: 80x80 输出 (P3)
        self.stage2 = nn.Sequential(
            CSPBottleneck(w * 2, w * 2),
            ConvBlock(w * 2, w * 4, kernel_size=3, stride=2),  # 80x80
        )

        # Stage 3: 40x40 输出 (P4)
        self.stage3 = nn.Sequential(
            CSPBottleneck(w * 4, w * 4),
            CSPBottleneck(w * 4, w * 4),
            ConvBlock(w * 4, w * 8, kernel_size=3, stride=2),  # 40x40
        )

        # Stage 4: 20x20 输出 (P5)
        self.stage4 = nn.Sequential(
            CSPBottleneck(w * 8, w * 8),
            ConvBlock(w * 8, w * 8, kernel_size=3, stride=2),  # 20x20
        )

        self.out_channels = [w * 4, w * 8, w * 8]  # [256, 512, 512]

    def forward(self, x):
        x = self.stem(x)       # (B, 128, 160, 160)
        p3 = self.stage2(x)    # (B, 256,  80,  80)
        p4 = self.stage3(p3)   # (B, 512,  40,  40)
        p5 = self.stage4(p4)   # (B, 512,  20,  20)
        return [p3, p4, p5]


# ============================================
# 4. 轻量掩码解码器: 从特征图生成实例掩码
# ============================================
class LightweightMaskDecoder(nn.Module):
    """
    FastSAM 的轻量掩码解码器——比 SAM 解码器更简洁

    输入: 多尺度特征 [P3, P4, P5] + 原型掩码系数
    流程:
      1. P5 上采样与 P4 融合 → P4' (40x40)
      2. P4' 上采样与 P3 融合 → P3' (80x80)
      3. P3' 上采样到 160x160，与可学习原型掩码做线性组合
      4. 输出: (B, num_prototypes, 160, 160) 原型掩码

    设计哲学:
      SAM 的解码器需要交叉注意力来处理提示——这是 O(N^2) 的计算
      FastSAM 的解码器只用卷积和上采样——O(N) 的计算
      提示匹配放在掩码生成之后做（第二阶段），解耦了"生成"和"选择"
    """
    def __init__(self, in_channels_list, num_prototypes=32, out_size=160):
        super().__init__()
        self.num_prototypes = num_prototypes
        self.out_size = out_size

        # 通道对齐: 将不同尺度的特征统一到 256 维
        self.lateral_p3 = nn.Conv2d(in_channels_list[0], 256, kernel_size=1)
        self.lateral_p4 = nn.Conv2d(in_channels_list[1], 256, kernel_size=1)
        self.lateral_p5 = nn.Conv2d(in_channels_list[2], 256, kernel_size=1)

        # 特征融合后的平滑卷积（类似 FPN 的 3x3 输出卷积）
        self.smooth_p4 = ConvBlock(256, 256, kernel_size=3)
        self.smooth_p3 = ConvBlock(256, 256, kernel_size=3)

        # 原型掩码生成: 将最高分辨率特征映射为 num_prototypes 个基础掩码
        self.proto_conv1 = ConvBlock(256, 256, kernel_size=3)
        self.proto_conv2 = nn.Conv2d(256, num_prototypes, kernel_size=1)

    def forward(self, features):
        p3, p4, p5 = features

        # 通道对齐
        p5 = self.lateral_p5(p5)  # (B, 256, 20, 20)
        p4 = self.lateral_p4(p4)  # (B, 256, 40, 40)
        p3 = self.lateral_p3(p3)  # (B, 256, 80, 80)

        # 自顶向下特征融合: P5 → P4 → P3
        p5_up = F.interpolate(p5, size=p4.shape[2:], mode="bilinear", align_corners=False)
        p4 = self.smooth_p4(p4 + p5_up)  # (B, 256, 40, 40)

        p4_up = F.interpolate(p4, size=p3.shape[2:], mode="bilinear", align_corners=False)
        p3 = self.smooth_p3(p3 + p4_up)  # (B, 256, 80, 80)

        # 生成原型掩码: 上采样到输出尺寸 + 卷积映射
        proto_feat = self.proto_conv1(p3)
        proto_feat = F.interpolate(proto_feat, size=(self.out_size, self.out_size),
                                   mode="bilinear", align_corners=False)
        prototypes = self.proto_conv2(proto_feat)  # (B, num_prototypes, 160, 160)

        return prototypes


# ============================================
# 5. 提示引导掩码选择器: 第二阶段——从实例掩码中选出最佳匹配
# ============================================
class PromptGuidedMaskSelector(nn.Module):
    """
    提示引导的掩码选择模块

    输入: 原型掩码 (B, K, H, W) + 提示坐标 (点或框)
    输出: 最匹配提示的分割掩码 (B, 1, H, W)

    工作原理:
      1. 根据提示类型（点/框）生成注意力图
      2. 对每个原型的掩码在提示区域求和，得到每个原型与提示的重叠程度
      3. 选择重叠度最高的原型掩码作为最终输出

    这比 SAM 的解码器中做交叉注意力高效得多——
    掩码已经在第一阶段生成完毕，第二阶段只是做轻量级的索引和筛选。
    """
    def __init__(self, num_prototypes=32):
        super().__init__()
        self.num_prototypes = num_prototypes

    def compute_prompt_heatmap(self, masks, points=None, boxes=None):
        """
        根据提示生成每个原型掩码的得分

        points: (B, N, 2) — 点坐标 [x, y]，归一化到 [0, 1]
        boxes:  (B, M, 4) — 框坐标 [x1, y1, x2, y2]，归一化到 [0, 1]
        """
        B, K, H, W = masks.shape
        scores = torch.zeros(B, K, device=masks.device)

        if points is not None:
            # 点提示: 取提示点位置处每个原型的掩码值作为得分
            for b in range(B):
                for pt in points[b]:
                    px = int(pt[0] * W)
                    py = int(pt[1] * H)
                    px = max(0, min(W - 1, px))
                    py = max(0, min(H - 1, py))
                    scores[b] += masks[b, :, py, px]

        if boxes is not None:
            # 框提示: 对框内区域的每个原型掩码值求和
            for b in range(B):
                for box in boxes[b]:
                    x1 = int(box[0] * W)
                    y1 = int(box[1] * H)
                    x2 = int(box[2] * W)
                    y2 = int(box[3] * H)
                    x1, x2 = max(0, min(W - 1, x1)), max(x1 + 1, min(W, x2))
                    y1, y2 = max(0, min(H - 1, y1)), max(y1 + 1, min(H, y2))
                    roi = masks[b, :, y1:y2, x1:x2]
                    scores[b] += roi.sum(dim=(1, 2))

        # 选择得分最高的原型掩码
        best_idx = scores.argmax(dim=1)  # (B,)
        selected = torch.stack([
            masks[b, best_idx[b]] for b in range(B)
        ]).unsqueeze(1)  # (B, 1, H, W)

        return torch.sigmoid(selected)


# ============================================
# 6. FastSAM 完整模型
# ============================================
class FastSAM(nn.Module):
    """
    FastSAM: 实时 Segment Anything 模型

    完整数据流:
      输入图像 (B, 3, 640, 640)
        ↓ Stage 1: CNN 主干提取多尺度特征
      [P3(80x80), P4(40x40), P5(20x20)]
        ↓ Stage 1: 轻量掩码解码器生成原型掩码
      原型掩码 (B, 32, 160, 160)
        ↓ Stage 2: 根据提示（点/框）选择最佳匹配掩码
      最终分割掩码 (B, 1, 160, 160)

    速度对比 (A100 GPU, 1024x1024 输入):
      SAM (ViT-H):  ~0.17s/image  (~6 FPS)  — 精度高但实时性差
      FastSAM:      ~0.003s/image (~333 FPS) — 精度稍降但可实时运行

    精度对比 (COCO mAP):
      SAM:  约 46.0 AP (box), 43.2 AP (mask)
      FastSAM: 约 42.0 AP (box), 39.5 AP (mask)
      差距约 8%，但速度提升 50 倍——这是实战中非常有价值的权衡。

    参数量对比:
      SAM (ViT-H):  ~636M
      FastSAM:       ~27M  (轻了 23 倍)
    """
    def __init__(self, base_width=64, num_prototypes=32):
        super().__init__()
        self.backbone = LightweightCNNBackbone(base_width=base_width)
        self.mask_decoder = LightweightMaskDecoder(
            in_channels_list=self.backbone.out_channels,
            num_prototypes=num_prototypes,
            out_size=160
        )
        self.selector = PromptGuidedMaskSelector(num_prototypes=num_prototypes)

    def forward(self, x, points=None, boxes=None):
        """
        x:      输入图像 (B, 3, H, W)
        points: 点提示，归一化坐标 (B, N, 2)
        boxes:  框提示，归一化坐标 (B, M, 4)
        返回:   分割掩码 (B, 1, 160, 160)
        """
        # 第一阶段: CNN 特征提取 + 原型掩码生成
        features = self.backbone(x)
        prototypes = self.mask_decoder(features)  # (B, 32, 160, 160)

        # 第二阶段: 提示引导的掩码选择
        masks = self.selector.compute_prompt_heatmap(
            prototypes, points=points, boxes=boxes
        )

        return masks


# ============================================
# 快速测试: 验证模型结构和推理速度
# ============================================
if __name__ == "__main__":
    model = FastSAM(base_width=64, num_prototypes=32)
    model.eval()

    # 模拟 640x640 输入图像
    dummy_img = torch.randn(1, 3, 640, 640)

    # 模拟点提示: 图像中心的一个点
    dummy_points = torch.tensor([[[0.5, 0.5]]])  # 归一化到 [0,1]

    # 模拟框提示: 图像中央 200x200 区域
    dummy_boxes = torch.tensor([[[0.3, 0.3, 0.6, 0.6]]])

    # --- 推理测试 (点提示) ---
    with torch.no_grad():
        mask_pt = model(dummy_img, points=dummy_points)
    print("=" * 60)
    print("FastSAM — Fast Segment Anything Model")
    print("=" * 60)
    print(f"输入图像:     {dummy_img.shape}")
    print(f"点提示掩码输出: {mask_pt.shape}   (B, 1, 160, 160)")
    print(f"掩码值范围:    [{mask_pt.min().item():.3f}, {mask_pt.max().item():.3f}]")

    # --- 推理测试 (框提示) ---
    with torch.no_grad():
        mask_box = model(dummy_img, boxes=dummy_boxes)
    print(f"框提示掩码输出: {mask_box.shape}   (B, 1, 160, 160)")

    # --- 模型统计 ---
    total_params = sum(p.numel() for p in model.parameters())
    backbone_params = sum(p.numel() for p in model.backbone.parameters())
    decoder_params = sum(p.numel() for p in model.mask_decoder.parameters())
    print(f"\n参数量统计:")
    print(f"  CNN 主干:       {backbone_params / 1e6:.1f}M")
    print(f"  掩码解码器:     {decoder_params / 1e6:.1f}M")
    print(f"  总计:           {total_params / 1e6:.1f}M")
    print(f"  SAM ViT-H 对比: 632M → FastSAM {total_params / 1e6:.1f}M "
          f"(缩小 {632 / (total_params / 1e6):.0f}x)")

    # --- 推理速度粗略测试 ---
    import time
    model.eval()
    # 预热
    for _ in range(10):
        _ = model(dummy_img, points=dummy_points)

    t0 = time.time()
    n_runs = 100
    for _ in range(n_runs):
        _ = model(dummy_img, points=dummy_points)
    t1 = time.time()
    fps = n_runs / (t1 - t0)
    print(f"\n推理速度 (CPU 粗略测试): {fps:.0f} FPS ({n_runs} 次平均)")
    print(f"SAM 对比: ~6 FPS → FastSAM ~{fps:.0f} FPS (加速 {fps / 6:.0f}x)")
    print("=" * 60)
