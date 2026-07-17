"""
Classification_Head.py --- 通用图像分类头

支持两种池化模式:
  - gap (Global Average Pooling): 适用于 CNN 骨干（ResNet / VGG / EfficientNet 等）
  - cls_token: 适用于 ViT 类 Transformer 骨干，直接取 [CLS] token

典型用法:
  backbone = ResNet50(num_classes=None)       # 去掉原生 FC 层
  head = ClassificationHead(in_channels=2048) # 接上分类头
  model = nn.Sequential(backbone, head)
"""

import torch
import torch.nn as nn


# ============================================
# ClassificationHead: 通用分类头
# ============================================
class ClassificationHead(nn.Module):
    """
    分类头 --- 将骨干网络提取的特征映射到类别概率分布

    工作流程 (gap 模式):
      backbone 特征 [B, C, H, W]
        -> AdaptiveAvgPool2d(1)  挤压空间维度 -> [B, C, 1, 1]
        -> Flatten               展平         -> [B, C]
        -> Dropout               正则化防过拟合
        -> Linear                全连接分类   -> [B, num_classes]

    工作流程 (cls_token 模式):
      transformer 输出 [B, N, D]
        -> 取 [:, 0, :]         提取 [CLS] token -> [B, D]
        -> Dropout               正则化
        -> Linear                全连接分类      -> [B, num_classes]
    """

    def __init__(self, in_channels=2048, num_classes=1000, dropout=0.2, pool_mode="gap"):
        super().__init__()
        if pool_mode not in ("gap", "cls_token"):
            raise ValueError(f"pool_mode 必须是 'gap' 或 'cls_token'，收到了: {pool_mode}")

        self.pool_mode = pool_mode

        # GAP 模式需要的池化层（cls_token 模式不参与 forward，但仍创建以保持结构一致）
        self.pool = nn.AdaptiveAvgPool2d(1)

        # Dropout 正则化：随机置零一部分神经元，缓解过拟合
        self.dropout = nn.Dropout(dropout)

        # 全连接分类层：将特征向量映射到 num_classes 个 logits
        self.fc = nn.Linear(in_channels, num_classes)

    def forward(self, x):
        if self.pool_mode == "gap":
            # CNN 骨干输出: [B, C, H, W] -> 全局平均池化 -> 展平
            x = self.pool(x)          # [B, C, 1, 1]
            x = torch.flatten(x, 1)   # [B, C]
        elif self.pool_mode == "cls_token":
            # ViT 骨干输出: [B, N, D] -> 提取 [CLS] token
            x = x[:, 0, :]            # [B, D]

        x = self.dropout(x)
        x = self.fc(x)                # [B, num_classes]
        return x


# ============================================
# 快速测试
# ============================================
if __name__ == "__main__":
    print("===== 测试 1: GAP 模式 (CNN 骨干) =====")
    head_gap = ClassificationHead(in_channels=2048, num_classes=1000, dropout=0.2, pool_mode="gap")
    # 模拟 ResNet50 layer4 输出: [Batch=2, Channels=2048, H=7, W=7]
    cnn_feat = torch.randn(2, 2048, 7, 7)
    out_gap = head_gap(cnn_feat)
    print(f"输入形状: {cnn_feat.shape}")
    print(f"输出形状: {out_gap.shape}  (预期: [2, 1000])")
    print(f"参数量: {sum(p.numel() for p in head_gap.parameters()) / 1e6:.2f}M")

    print("\n===== 测试 2: CLS Token 模式 (ViT 骨干) =====")
    head_cls = ClassificationHead(in_channels=768, num_classes=1000, dropout=0.1, pool_mode="cls_token")
    # 模拟 ViT-B encoder 输出: [Batch=2, SeqLen=197, Dim=768]
    vit_feat = torch.randn(2, 197, 768)
    out_cls = head_cls(vit_feat)
    print(f"输入形状: {vit_feat.shape}")
    print(f"输出形状: {out_cls.shape}  (预期: [2, 1000])")
    print(f"参数量: {sum(p.numel() for p in head_cls.parameters()) / 1e6:.2f}M")

    print("\n===== 测试 3: 非法 pool_mode =====")
    try:
        ClassificationHead(pool_mode="invalid")
    except ValueError as e:
        print(f"正确抛出异常: {e}")

    print("\n所有测试通过!")
