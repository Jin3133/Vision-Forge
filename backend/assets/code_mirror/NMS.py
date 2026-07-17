"""
NMS.py — 非极大值抑制 (Non-Maximum Suppression) 后处理算子

功能: 对目标检测输出的重叠边界框进行去重，保留置信度最高的框，抑制高度重叠的冗余框。
这是几乎所有目标检测模型的后处理标配步骤。

核心算法流程:
    1. 按置信度降序排列所有候选框
    2. 选取置信度最高的框，将其与其余框逐一计算 IoU
    3. 抑制 IoU > threshold 的框（移除或降低置信度）
    4. 对剩余框重复步骤 2-3，直到所有框被处理

TorchVision 实现:
    torchvision.ops.nms(boxes, scores, iou_threshold)  → 返回保留框的索引
    torchvision.ops.batched_nms(boxes, scores, class_ids, iou_threshold) → 按类别分别NMS

论文: "Efficient Non-Maximum Suppression" (Neubeck & Van Gool, ICPR 2006)
"""

import torch
import torch.nn as nn


class NMSOp(nn.Module):
    """非极大值抑制算子。

    参数:
        iou_threshold (float): IoU 阈值，超过此值的重叠框被抑制，默认 0.5
        max_detections (int):  每张图最多保留的检测框数，默认 300
        class_wise     (bool):  是否按类别独立做 NMS，默认 True
    """

    def __init__(self, iou_threshold: float = 0.5, max_detections: int = 300, class_wise: bool = True):
        super().__init__()
        self.iou_threshold = iou_threshold
        self.max_detections = max_detections
        self.class_wise = class_wise

    @staticmethod
    def _box_area(boxes: torch.Tensor) -> torch.Tensor:
        """计算框面积。boxes 格式: [x1, y1, x2, y2]"""
        return (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])

    @staticmethod
    def _box_iou(boxes1: torch.Tensor, boxes2: torch.Tensor) -> torch.Tensor:
        """计算两组框之间的 IoU 矩阵。

        boxes1: (N, 4), boxes2: (M, 4)
        返回:   (N, M) IoU 矩阵
        """
        area1 = NMSOp._box_area(boxes1)
        area2 = NMSOp._box_area(boxes2)

        lt = torch.max(boxes1[:, None, :2], boxes2[:, :2])  # (N, M, 2) 左上角
        rb = torch.min(boxes1[:, None, 2:], boxes2[:, 2:])  # (N, M, 2) 右下角

        wh = (rb - lt).clamp(min=0)  # 宽高不能为负
        inter = wh[:, :, 0] * wh[:, :, 1]  # (N, M)

        union = area1[:, None] + area2 - inter
        return inter / (union + 1e-6)

    def _nms_per_class(self, boxes: torch.Tensor, scores: torch.Tensor) -> torch.Tensor:
        """对单类的框执行纯 Python NMS（教学版，演示算法逻辑）。"""
        if boxes.numel() == 0:
            return torch.tensor([], dtype=torch.long)

        # 按置信度降序
        order = scores.argsort(descending=True)
        keep = []

        while order.numel() > 0:
            if len(keep) >= self.max_detections:
                break
            idx = order[0].item()
            keep.append(idx)

            if order.numel() == 1:
                break

            # 计算当前最高分框与其余框的 IoU
            ious = self._box_iou(boxes[idx:idx+1], boxes[order[1:]])[0]
            # 保留 IoU <= threshold 的框
            mask = ious <= self.iou_threshold
            order = order[1:][mask]

        return torch.tensor(keep, dtype=torch.long)

    def forward(self, boxes: torch.Tensor, scores: torch.Tensor,
                class_ids: torch.Tensor = None) -> torch.Tensor:
        """
        输入:
            boxes:     (N, 4)  — 格式 [x1, y1, x2, y2]
            scores:    (N,)    — 置信度
            class_ids: (N,)    — 类别ID（可选，class_wise=True 时必需）

        输出:
            keep_indices: (K,) — 保留框的索引，K ≤ max_detections
        """
        if boxes.numel() == 0:
            return torch.tensor([], dtype=torch.long)

        if self.class_wise and class_ids is not None:
            # 按类别分别做 NMS
            keep_all = []
            for cid in class_ids.unique():
                cls_mask = (class_ids == cid)
                keep = self._nms_per_class(boxes[cls_mask], scores[cls_mask])
                # 映射回原始索引
                orig_indices = cls_mask.nonzero(as_tuple=True)[0]
                keep_all.append(orig_indices[keep])
            if keep_all:
                result = torch.cat(keep_all)
                # 重新按置信度排序并截断
                result = result[scores[result].argsort(descending=True)]
                return result[:self.max_detections]
            return torch.tensor([], dtype=torch.long)
        else:
            return self._nms_per_class(boxes, scores)[:self.max_detections]


# ==================== 单元测试 ====================
if __name__ == "__main__":
    print("=" * 50)
    print("NMS 算子测试")
    print("=" * 50)

    nms = NMSOp(iou_threshold=0.5, max_detections=10)

    # 构造 4 个框：2 个高度重叠的狗，2 个不重叠的猫
    boxes = torch.tensor([
        [10, 10, 100, 100],    # 狗1 (高分)
        [15, 15, 105, 105],    # 狗2 (低分，与狗1 IoU≈0.85，应被抑制)
        [200, 200, 300, 300],  # 猫1 (高分)
        [210, 210, 310, 310],  # 猫2 (低分，与猫1 IoU≈0.83，应被抑制)
    ], dtype=torch.float32)

    scores = torch.tensor([0.95, 0.60, 0.90, 0.55])
    class_ids = torch.tensor([0, 0, 1, 1])  # 狗=0, 猫=1

    keep = nms(boxes, scores, class_ids)
    print(f"输入 {len(boxes)} 个框 → NMS 后保留 {len(keep)} 个框")
    print(f"保留框索引: {keep.tolist()}")
    print(f"保留框分数: {scores[keep].tolist()}")

    # 期望结果：狗保留高分框 (0.95)，猫保留高分框 (0.90)，共 2 个
    expected_scores = [0.95, 0.90]
    assert sorted(scores[keep].tolist(), reverse=True) == expected_scores, "NMS 结果不匹配！"

    print(f"✓ 符合预期：每类各保留一个最高分框")
    print("\n✅ NMS 算子测试全部通过！")
