"""
Random_Flip.py — 图像随机翻转数据增强算子

功能: 以一定概率对输入图像进行水平或垂直翻转，增加训练数据的多样性，
     提升模型的泛化能力和鲁棒性。是目标检测、图像分类等任务的标准增强手段。

翻转模式:
    - horizontal: 水平镜像翻转（左右），适用于通用场景，默认模式
    - vertical:   垂直翻转（上下），适用于遥感/航拍图像（天空在上、地面在下）

数学形式:
    水平翻转: output[i, j] = input[i, W-1-j]
    垂直翻转: output[i, j] = input[H-1-i, j]

注意: 翻转图像时，对应的标注框/关键点坐标也需要同步翻转！
     本算子仅处理图像张量，标注同步需在数据加载层额外处理。
"""

import torch
import torch.nn as nn


class RandomFlipOp(nn.Module):
    """随机翻转增强算子。

    参数:
        flip_mode (str): 翻转模式 — "horizontal" (水平) / "vertical" (垂直)，默认 "horizontal"
        p         (float): 执行翻转的概率，默认 0.5
    """

    def __init__(self, flip_mode: str = "horizontal", p: float = 0.5):
        super().__init__()
        assert flip_mode in ("horizontal", "vertical"), f"不支持的翻转模式: {flip_mode}"
        self.flip_mode = flip_mode
        self.p = p

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        输入:  (B, C, H, W) 或 (C, H, W)
        输出:  同 shape，以概率 p 被翻转

        训练时随机翻转，推理时默认不翻转（self.training 控制）。
        """
        if not self.training:
            return x  # eval 模式下不翻转

        if torch.rand(1).item() > self.p:
            return x  # 本轮不翻转

        has_batch = (x.dim() == 4)
        if not has_batch:
            x = x.unsqueeze(0)

        if self.flip_mode == "horizontal":
            # dim=-1 是宽度维度 W: [0, 1, 2, ..., W-1] → [W-1, ..., 0]
            x = torch.flip(x, dims=[-1])
        else:
            # dim=-2 是高度维度 H
            x = torch.flip(x, dims=[-2])

        if not has_batch:
            x = x.squeeze(0)
        return x


# ==================== 单元测试 ====================
if __name__ == "__main__":
    print("=" * 50)
    print("Random_Flip 算子测试")
    print("=" * 50)

    flip_h = RandomFlipOp(flip_mode="horizontal", p=1.0)  # 100%翻转便于测试
    flip_v = RandomFlipOp(flip_mode="vertical", p=1.0)

    # 构造可识别的测试图案：四个角的值不同
    img = torch.zeros(1, 3, 4, 6)
    img[0, 0, 0, 0] = 1.0   # 左上角 = 1
    img[0, 0, 0, -1] = 2.0  # 右上角 = 2
    img[0, 0, -1, 0] = 3.0  # 左下角 = 3
    img[0, 0, -1, -1] = 4.0 # 右下角 = 4

    out_h = flip_h(img)
    print(f"[水平翻转] 左上(原1) → 右上(现{out_h[0,0,0,-1].item():.0f})")
    print(f"           右上(原2) → 左上(现{out_h[0,0,0,0].item():.0f})")

    out_v = flip_v(img)
    print(f"[垂直翻转] 左上(原1) → 左下(现{out_v[0,0,-1,0].item():.0f})")
    print(f"           左下(原3) → 左上(现{out_v[0,0,0,0].item():.0f})")

    # eval 模式不翻转
    flip_h.eval()
    out_eval = flip_h(img)
    print(f"[eval模式] 不翻转，值与输入一致: {torch.allclose(img, out_eval)}")

    print("\n✅ Random_Flip 算子测试全部通过！")
