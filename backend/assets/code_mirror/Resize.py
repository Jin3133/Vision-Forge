"""
Resize.py — 图像尺寸缩放算子

功能: 将输入图像缩放到指定尺寸，支持保持宽高比（等比缩放）和强制尺寸两种模式。
常用作视觉模型的数据预处理第一步。

典型用法:
    Resize(target_size=640, keep_ratio=True)

数学原理:
    - keep_ratio=True:  设原图 (H, W)，target_size=T，则缩放比 r = T / max(H, W)
                        新尺寸 = (H*r, W*r)，短边 padding 到 T
    - keep_ratio=False: 直接 resize 到 (T, T)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class ResizeOp(nn.Module):
    """图像尺寸缩放算子。

    参数:
        target_size (int): 目标尺寸（正方形边长），默认 640
        keep_ratio  (bool): 是否保持宽高比，默认 True
    """

    def __init__(self, target_size: int = 640, keep_ratio: bool = True):
        super().__init__()
        self.target_size = target_size
        self.keep_ratio = keep_ratio

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        输入:  (B, C, H, W) 或 (C, H, W)
        输出:  (B, C, target_size, target_size)
        """
        has_batch = (x.dim() == 4)
        if not has_batch:
            x = x.unsqueeze(0)

        if self.keep_ratio:
            # 等比缩放：按最长边缩放到 target_size，短边 padding
            _, _, h, w = x.shape
            scale = self.target_size / max(h, w)
            new_h, new_w = int(h * scale), int(w * scale)
            resized = F.interpolate(x, size=(new_h, new_w), mode='bilinear', align_corners=False)

            # Padding 到 target_size × target_size
            pad_h = self.target_size - new_h
            pad_w = self.target_size - new_w
            padded = F.pad(resized, (0, pad_w, 0, pad_h), value=0)
        else:
            padded = F.interpolate(x, size=(self.target_size, self.target_size),
                                   mode='bilinear', align_corners=False)

        if not has_batch:
            padded = padded.squeeze(0)
        return padded


# ==================== 单元测试 ====================
if __name__ == "__main__":
    print("=" * 50)
    print("Resize 算子测试")
    print("=" * 50)

    # 测试 1: 等比缩放 (keep_ratio=True)
    resize = ResizeOp(target_size=640, keep_ratio=True)
    img = torch.randn(1, 3, 480, 800)  # 非正方形输入
    out = resize(img)
    print(f"[keep_ratio=True]  输入: {img.shape} → 输出: {out.shape}")  # 期望 (1,3,640,640)

    # 测试 2: 强制尺寸 (keep_ratio=False)
    resize2 = ResizeOp(target_size=224, keep_ratio=False)
    img2 = torch.randn(2, 3, 300, 500)
    out2 = resize2(img2)
    print(f"[keep_ratio=False] 输入: {img2.shape} → 输出: {out2.shape}")  # 期望 (2,3,224,224)

    # 测试 3: 3D 输入（无 batch 维度）
    img3 = torch.randn(3, 256, 512)
    out3 = resize(img3)
    print(f"[3D输入]            输入: {img3.shape} → 输出: {out3.shape}")  # 期望 (3,640,640)

    print("\n✅ Resize 算子测试全部通过！")
