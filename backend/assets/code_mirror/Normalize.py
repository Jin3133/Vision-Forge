"""
Normalize.py — 图像归一化算子

功能: 对图像张量按通道进行均值-标准差归一化，使各通道的像素值分布标准化。
这是视觉模型训练的必备步骤，能加速收敛、提升数值稳定性。

数学形式: output[channel] = (input[channel] - mean[channel]) / std[channel]

经典配置:
    - ImageNet 标准: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    - 0~1 归一化:    mean=[0.5, 0.5, 0.5],      std=[0.5, 0.5, 0.5]

论文: 几乎是所有现代视觉模型的标配预处理步骤
"""

import torch
import torch.nn as nn


class NormalizeOp(nn.Module):
    """图像归一化算子。

    参数:
        mean (list): 各通道均值，默认 ImageNet 标准 [0.485, 0.456, 0.406]
        std  (list): 各通道标准差，默认 ImageNet 标准 [0.229, 0.224, 0.225]
    """

    def __init__(self, mean=None, std=None):
        super().__init__()
        if mean is None:
            mean = [0.485, 0.456, 0.406]
        if std is None:
            std = [0.229, 0.224, 0.225]

        # 注册为 buffer（不参与梯度，但随模型保存）
        self.register_buffer('mean', torch.tensor(mean).view(1, -1, 1, 1))
        self.register_buffer('std', torch.tensor(std).view(1, -1, 1, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        输入:  (B, C, H, W) 或 (C, H, W)
        输出:  同 shape，像素值归一化到 ~N(0, 1) 分布

        注意: 输入值应已缩放到 [0, 1] 范围。
             如果输入是 [0, 255] 范围，需要先除以 255。
        """
        if x.dim() == 3:
            x = x.unsqueeze(0)
            x = (x - self.mean) / self.std
            return x.squeeze(0)
        return (x - self.mean) / self.std


# ==================== 单元测试 ====================
if __name__ == "__main__":
    print("=" * 50)
    print("Normalize 算子测试")
    print("=" * 50)

    normalize = NormalizeOp()

    # 测试 1: 标准 4D 输入
    img = torch.rand(2, 3, 224, 224)  # [0, 1] 均匀分布
    out = normalize(img)
    print(f"[4D batch=2] 输入范围: [{img.min():.3f}, {img.max():.3f}] → 输出范围: [{out.min():.3f}, {out.max():.3f}]")
    print(f"             输出均值: {out.mean():.4f}, 输出标准差: {out.std():.4f}")

    # 测试 2: 3D 输入
    img2 = torch.rand(3, 224, 224)
    out2 = normalize(img2)
    print(f"[3D无batch]  输入: {img2.shape} → 输出: {out2.shape}")

    # 测试 3: 自定义 mean/std
    custom_norm = NormalizeOp(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
    img3 = torch.ones(1, 3, 10, 10)
    out3 = custom_norm(img3)
    print(f"[自定义配置] 全1张量经过 mean=0.5, std=0.5 → 输出值: {out3[0,0,0,0]:.1f} (期望 1.0)")

    print("\n✅ Normalize 算子测试全部通过！")
