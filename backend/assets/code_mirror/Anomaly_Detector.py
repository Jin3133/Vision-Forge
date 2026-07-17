"""
Anomaly_Detector: 基于 PaDiM (Defard et al., ICPR 2021) 的异常检测器（教学简化版）
核心思路：预训练骨干提取多层特征 -> 每空间位置拟合多元高斯 -> 马氏距离判异常
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import resnet50, ResNet50_Weights
import numpy as np


class FeatureExtractor(nn.Module):
    """通过前向钩子从 ResNet 指定层抓取中间特征图。"""

    def __init__(self, backbone: nn.Module, layer_names: list[str]):
        super().__init__()
        self.features: dict[str, torch.Tensor] = {}
        for name, module in backbone.named_modules():
            if name in layer_names:
                module.register_forward_hook(self._make_hook(name))

    def _make_hook(self, name: str):
        def hook(module, inp, out):
            self.features[name] = out
        return hook

    def forward(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        self.features = {}
        self.backbone(x)
        return {k: v.clone() for k, v in self.features.items()}


class AnomalyDetector:
    """PaDiM 风格异常检测器（教学简化版）。

    参数:
        backbone_name: 骨干网络，默认 'ResNet50'
        layers:       提取特征的层名，默认 ['layer1','layer2','layer3']
        threshold:    异常判定阈值（0~1），默认 0.5
        n_components: 通道随机采样数降低计算量，默认 100
    """

    def __init__(self, backbone_name: str = "ResNet50",
                 layers: list[str] | None = None,
                 threshold: float = 0.5, n_components: int = 100):
        self.layers = layers or ["layer1", "layer2", "layer3"]
        self.threshold = threshold
        self.n_components = n_components

        # 构建去分类头的冻结骨干网络
        base = resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)
        self.backbone = nn.Sequential(
            base.conv1, base.bn1, base.relu, base.maxpool,
            base.layer1, base.layer2, base.layer3, base.layer4,
        )
        self.extractor = FeatureExtractor(self.backbone, self.layers)
        self.backbone.eval()
        for p in self.backbone.parameters():
            p.requires_grad = False

        # 拟合后填充：每空间位置的均值向量 / 精度矩阵 / 通道降维索引
        self.means: dict[str, torch.Tensor] = {}
        self.precisions: dict[str, torch.Tensor] = {}
        self.channel_indices: dict[str, torch.Tensor] = {}

    def _reduce_channels(self, feat: torch.Tensor, layer: str) -> torch.Tensor:
        """随机采样部分通道，降低协方差矩阵计算开销。"""
        C = feat.shape[1]
        if layer not in self.channel_indices:
            if C <= self.n_components:
                self.channel_indices[layer] = torch.arange(C)
            else:
                self.channel_indices[layer] = torch.randperm(C)[:self.n_components]
        return feat[:, self.channel_indices[layer], :, :]

    @torch.no_grad()
    def fit(self, normal_images: torch.Tensor) -> None:
        """在正常样本 [N,3,224,224] 上拟合每个空间位置的多元高斯分布。"""
        N = normal_images.shape[0]
        device = next(self.backbone.parameters()).device
        self.extractor.to(device)

        # 第一遍：逐样本提取并收集各层特征
        accum: dict[str, list[torch.Tensor]] = {ly: [] for ly in self.layers}
        for i in range(N):
            feats = self.extractor(normal_images[i:i+1].to(device))
            for ly in self.layers:
                accum[ly].append(
                    self._reduce_channels(feats[ly], ly).squeeze(0).cpu())

        # 计算每个空间位置的均值向量 [H, W, C]
        for ly in self.layers:
            stacked = torch.stack(accum[ly], dim=0)       # [N, C, H, W]
            self.means[ly] = stacked.mean(dim=0).permute(1, 2, 0)

        # 计算每个空间位置的精度矩阵（协方差逆 + 正则化）
        for ly in self.layers:
            stacked = torch.stack(accum[ly], dim=0)
            H, W, C = self.means[ly].shape
            prec = torch.zeros(H, W, C, C)
            eye, eps = torch.eye(C), 1e-6 * torch.eye(C)
            for h in range(H):
                for w in range(W):
                    vecs = stacked[:, :, h, w]           # [N, C]
                    if vecs.shape[0] < 2:
                        prec[h, w] = eye
                        continue
                    cov = torch.cov(vecs.T) + eps
                    try:
                        prec[h, w] = torch.linalg.pinv(cov, hermitian=True)
                    except Exception:
                        prec[h, w] = eye
            self.precisions[ly] = prec

        print(f"[AnomalyDetector] 拟合完成，共 {len(self.layers)} 层")

    @torch.no_grad()
    def predict(self, image: torch.Tensor) -> tuple[float, np.ndarray]:
        """对单张图像 [1,3,224,224] 计算异常分数与热力图 [224,224]。"""
        device = next(self.backbone.parameters()).device
        self.extractor.to(device)
        image = image.to(device)
        feats = self.extractor(image)
        anomaly_maps: list[torch.Tensor] = []

        for ly in self.layers:
            f = self._reduce_channels(feats[ly], ly)
            f = f.squeeze(0).permute(1, 2, 0)         # [H, W, C]
            mean = self.means[ly].to(device)
            prec = self.precisions[ly].to(device)

            # 马氏距离: sqrt((x-μ)^T · Σ⁻¹ · (x-μ))
            diff = f - mean
            mahal = torch.sqrt(
                (diff.unsqueeze(-2) @ prec @ diff.unsqueeze(-1))
                .squeeze(-1).squeeze(-1).clamp(min=0))
            # 上采样至 224×224
            mahal_up = F.interpolate(
                mahal.unsqueeze(0).unsqueeze(0),
                size=(224, 224), mode="bilinear", align_corners=False,
            ).squeeze()
            anomaly_maps.append(mahal_up)

        # 逐像素取最大值融合多层，并 Min-Max 归一化
        fused = torch.stack(anomaly_maps, dim=0).max(dim=0).values
        fmin, fmax = fused.min(), fused.max()
        if fmax - fmin > 1e-8:
            fused = (fused - fmin) / (fmax - fmin)
        # 异常分数 = 前 5% 像素均值
        k = max(1, int(0.05 * fused.numel()))
        score = fused.flatten().topk(k).values.mean().item()
        return score, fused.cpu().numpy()

    def is_anomalous(self, score: float) -> bool:
        return score > self.threshold


# ======================== 单元测试 ========================
if __name__ == "__main__":
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[测试] 设备: {device}")

    detector = AnomalyDetector(threshold=0.5, n_components=100)
    detector.backbone.to(device)

    # 模拟正常样本训练（高斯噪声 = 正常分布）
    print("[测试] 拟合正常样本分布...")
    detector.fit(torch.randn(8, 3, 224, 224))

    # 正常图像：与训练分布一致
    s1, _ = detector.predict(torch.randn(1, 3, 224, 224))
    print(f"[正常] 分数={s1:.4f} -> {'异常' if detector.is_anomalous(s1) else '正常'}")

    # 均值偏移异常
    s2, _ = detector.predict(torch.randn(1, 3, 224, 224) + 2.5)
    print(f"[均值偏移] 分数={s2:.4f} -> {'异常' if detector.is_anomalous(s2) else '正常'}")

    # 纹理异常（大幅增加方差）
    ta = torch.randn(1, 3, 224, 224) + torch.randn(1, 3, 224, 224) * 3.0
    s3, _ = detector.predict(ta)
    print(f"[纹理异常] 分数={s3:.4f} -> {'异常' if detector.is_anomalous(s3) else '正常'}")

    print("[测试完成]")
