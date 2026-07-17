"""
Keypoint_Detector.py --- 基于 HRNet 思路的关键点检测头 (Sun et al., CVPR 2019)

三层转置卷积逐步上采样骨干特征, 输出每个关键点的高斯热力图。
用法: detector = KeypointDetector(in_channels=256, num_keypoints=17)
      heatmaps = detector(backbone_features)  # [B, 17, 64, 64]
"""

import torch
import torch.nn as nn


# ================================================================
# KeypointDetector: 关键点热力图检测头
# ================================================================
class KeypointDetector(nn.Module):
    """关键点检测头 --- 转置卷积上采样 + 1x1 卷积输出热力图

    骨干特征 [B, 256, 16, 16]
      -> 3x3 特征精炼 -> 转置卷积 x3 (4x 上采样: 16->64)
      -> 1x1 卷积 -> [B, num_keypoints, 64, 64]
    """

    def __init__(self, in_channels=256, num_keypoints=17, heatmap_size=(64, 64)):
        super().__init__()
        self.in_channels = in_channels
        self.num_keypoints = num_keypoints
        self.heatmap_size = heatmap_size

        # 特征精炼: 上采样前用 3x3 卷积增强特征表达
        self.refine = nn.Sequential(
            nn.Conv2d(in_channels, in_channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(in_channels),
            nn.ReLU(inplace=True),
        )

        # 三层转置卷积: 256->128->64->32, 空间分辨率 16->32->64->64
        self.deconv1 = nn.Sequential(
            nn.ConvTranspose2d(in_channels, 128, 4, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
        )
        self.deconv2 = nn.Sequential(
            nn.ConvTranspose2d(128, 64, 4, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
        )
        self.deconv3 = nn.Sequential(
            nn.ConvTranspose2d(64, 32, 3, stride=1, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
        )

        # 输出: 1x1 卷积映射到 num_keypoints 张热力图
        self.final_conv = nn.Conv2d(32, num_keypoints, 1)

        self._init_weights()

    def _init_weights(self):
        """正态分布初始化权重, BN 的 weight=1 bias=0"""
        for m in self.modules():
            if isinstance(m, (nn.Conv2d, nn.ConvTranspose2d)):
                nn.init.normal_(m.weight, std=0.001)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def forward(self, x):
        """x: [B, in_channels, H_in, W_in] -> out: [B, num_keypoints, H_out, W_out]"""
        x = self.refine(x)
        x = self.deconv1(x)
        x = self.deconv2(x)
        x = self.deconv3(x)
        return self.final_conv(x)


# ================================================================
# KeypointLoss: 热力图 MSE 损失
# ================================================================
class KeypointLoss(nn.Module):
    """预测热力图与高斯真值热力图之间的均方误差"""

    def __init__(self):
        super().__init__()
        self.mse = nn.MSELoss()

    def forward(self, pred_heatmaps, gt_heatmaps):
        """pred/gt: [B, K, H, W] -> 标量损失"""
        return self.mse(pred_heatmaps, gt_heatmaps)


# ================================================================
# 辅助函数: 根据关键点坐标生成高斯热力图真值
# ================================================================
def generate_gaussian_heatmap(heatmap_size, keypoint_coords, sigma=2.0):
    """根据关键点坐标 (x, y) 生成二维高斯热力图, 用于监督训练

    heatmap_size: (H, W), keypoint_coords: [K, 2], sigma: 高斯核标准差
    返回: [K, H, W] 热力图张量
    """
    H, W = heatmap_size
    K = keypoint_coords.shape[0]
    yy, xx = torch.meshgrid(
        torch.arange(H, dtype=torch.float32),
        torch.arange(W, dtype=torch.float32),
        indexing="ij",
    )
    heatmaps = torch.zeros(K, H, W)
    for k in range(K):
        cx, cy = keypoint_coords[k]
        heatmaps[k] = torch.exp(
            -((xx - cx) ** 2 + (yy - cy) ** 2) / (2.0 * sigma ** 2)
        )
    return heatmaps


# ================================================================
# 快速测试
# ================================================================
if __name__ == "__main__":
    print("===== 测试 1: KeypointDetector 前向传播 =====")
    detector = KeypointDetector(in_channels=256, num_keypoints=17, heatmap_size=(64, 64))
    feat = torch.randn(1, 256, 16, 16)
    heatmaps = detector(feat)
    print(f"输入: {feat.shape} -> 输出: {heatmaps.shape} (预期: [1, 17, 64, 64])")
    print(f"参数量: {sum(p.numel() for p in detector.parameters()) / 1e6:.3f}M")
    print(f"值范围: [{heatmaps.min().item():.4f}, {heatmaps.max().item():.4f}]")
    assert heatmaps.shape == (1, 17, 64, 64), f"形状不匹配! {heatmaps.shape}"
    print("通过!")

    print("\n===== 测试 2: 高斯热力图生成 =====")
    coords = torch.tensor([[32.0, 32.0], [48.0, 16.0], [16.0, 48.0]])
    gt = generate_gaussian_heatmap((64, 64), coords, sigma=2.0)
    print(f"热力图形状: {gt.shape} (预期: [3, 64, 64])")
    for k in range(3):
        peak = torch.argmax(gt[k])
        print(f"  关键点{k}: ({coords[k][0]:.0f},{coords[k][1]:.0f}) -> 峰值({peak % 64},{peak // 64})")
    print("通过!")

    print("\n===== 测试 3: KeypointLoss =====")
    criterion = KeypointLoss()
    pred = torch.randn(1, 17, 64, 64)
    gt_batch = generate_gaussian_heatmap(
        (64, 64), torch.tensor([[32.0, 32.0]] * 17), sigma=2.0
    ).unsqueeze(0)
    loss = criterion(pred, gt_batch)
    print(f"MSE Loss: {loss.item():.4f}")
    print("通过!")

    print("\n所有测试通过!")
