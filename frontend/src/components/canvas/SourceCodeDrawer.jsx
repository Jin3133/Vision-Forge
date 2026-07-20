// src/components/canvas/SourceCodeDrawer.jsx
// 教研智能体工作台：源码伴读 Drawer
//
// 触发方式：
//   1. 点击画布节点 → 自动打开并定位到该节点对应的源码
//   2. 右侧面板「📖 源码伴读」按钮 → 手动打开
//
// 设计原则：
//   - Drawer 宽 520px，深色代码区 + 右侧解释侧栏
//   - 「节点类型 → 源码文件」映射：5 个核心，其余默认 model.py
//   - 文件可在 Drawer 顶部切换

import React, { useState, useMemo, useEffect } from 'react';

/* ───────── 源码库 ───────── */
const FILE_TREE = [
  {
    folder: 'SAM',
    files: [
      {
        name: 'model.py',
        title: 'SAM 主模型',
        summary: '串联图像编码器、提示编码器、掩码解码器三件套',
        code: `class SAM(nn.Module):
    """
    Segment Anything Model (SAM) 主模型类。
    包含图像编码器、提示编码器和掩码解码器三个核心组件。
    """
    def __init__(self, image_encoder, prompt_encoder, mask_decoder):
        super().__init__()
        self.image_encoder = image_encoder      # ViT backbone
        self.prompt_encoder = prompt_encoder    # 点/框/文本编码
        self.mask_decoder = mask_decoder        # 轻量化解码器

    def forward(self, image, prompt):
        # 1. 提取图像特征
        image_features = self.image_encoder(image)
        # 2. 编码提示
        prompt_embeddings = self.prompt_encoder(prompt)
        # 3. 解码生成掩码
        masks, scores = self.mask_decoder(
            image_features, prompt_embeddings
        )
        return masks, scores`,
      },
      {
        name: 'image_encoder.py',
        title: '图像编码器',
        summary: '基于 Vision Transformer，处理 1024×1024 高分辨率图像',
        code: `class ImageEncoderViT(nn.Module):
    """
    SAM 图像编码器 — 基于 Vision Transformer。
    使用窗口化注意力处理高分辨率图像。
    """
    def __init__(self, img_size=1024, patch_size=16, embed_dim=768, depth=12):
        super().__init__()
        self.patch_embed = PatchEmbed(patch_size, 3, embed_dim)
        self.blocks = nn.ModuleList([
            Block(embed_dim, num_heads=12) for _ in range(depth)
        ])
        # 通道降维 neck：768 → 256
        self.neck = nn.Sequential(
            nn.Conv2d(embed_dim, 256, 1, bias=False),
            LayerNorm2d(256),
        )

    def forward(self, x):
        x = self.patch_embed(x)              # (B, 64*64, 768)
        for blk in self.blocks:
            x = blk(x)                        # Transformer block
        return self.neck(x)                   # (B, 256, 64, 64)`,
      },
      {
        name: 'prompt_encoder.py',
        title: '提示编码器',
        summary: '把用户的点/框/掩码 prompt 转为嵌入向量',
        code: `class PromptEncoder(nn.Module):
    """
    SAM 提示编码器 — 支持多种提示类型：
    - 点（前景/背景）
    - 边界框
    - 掩码（低分辨率）
    """
    def __init__(self, embed_dim=256):
        super().__init__()
        # 4 种 point embedding（前景/背景/边角）
        self.point_embeddings = nn.ModuleList(
            [nn.Embedding(1, embed_dim) for _ in range(4)]
        )
        self.not_a_point_embed = nn.Embedding(1, embed_dim)

    def forward(self, points=None, boxes=None, masks=None):
        sparse_embeddings = torch.zeros(1, 0, self.embed_dim)
        if points is not None:
            sparse_embeddings = self._embed_points(points)
        if boxes is not None:
            sparse_embeddings = torch.cat(
                [sparse_embeddings, self._embed_boxes(boxes)], dim=1
            )
        dense_embeddings = self._embed_masks(masks)
        return sparse_embeddings, dense_embeddings`,
      },
    ],
  },
  {
    folder: 'DINO',
    files: [
      {
        name: 'dino.py',
        title: 'DINO 自监督学习',
        summary: '通过自监督知识蒸馏学习视觉表征',
        code: `class DINO(nn.Module):
    """
    DINO: 自监督视觉 Transformer
    通过学生-教师网络的知识蒸馏学习视觉表征
    """
    def __init__(self, student, teacher, embed_dim=768, num_prototypes=65536):
        super().__init__()
        self.student = student
        self.teacher = teacher

        # 教师网络参数不参与梯度更新
        for p in self.teacher.parameters():
            p.requires_grad = False

        # 原型向量（用于对比学习）
        self.prototypes = nn.Linear(embed_dim, num_prototypes, bias=False)

    def forward(self, x1, x2):
        """
        x1, x2: 同一图像的两个不同增强视图
        """
        s1 = F.normalize(self.prototypes(self.student(x1)), dim=-1)
        s2 = F.normalize(self.prototypes(self.student(x2)), dim=-1)
        with torch.no_grad():
            t1 = F.normalize(self.prototypes(self.teacher(x1)), dim=-1)
            t2 = F.normalize(self.prototypes(self.teacher(x2)), dim=-1)
        return (self.dino_loss(s1, t2) + self.dino_loss(s2, t1)) / 2

    @torch.no_grad()
    def update_teacher(self, momentum=0.996):
        """EMA 更新教师网络"""
        for s_p, t_p in zip(self.student.parameters(), self.teacher.parameters()):
            t_p.data.mul_(momentum).add_(s_p.data, alpha=1 - momentum)`,
      },
    ],
  },
  {
    folder: 'ResNet / CNN',
    files: [
      { name: 'resnet.py', title: 'ResNet50 残差网络', summary: '经典 CNN Backbone，残差连接解决梯度消失',
        code: `class ResNet50(nn.Module):
    """ResNet50 — 50层残差网络，广泛用于图像分类/检测的 Backbone。"""
    def __init__(self, num_classes=1000):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 64, 7, 2, 3, bias=False)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(3, 2, 1)
        self.layer1 = self._make_layer(64, 64, 3)    # 3 个 Bottleneck
        self.layer2 = self._make_layer(256, 128, 4)   # 4 个 Bottleneck
        self.layer3 = self._make_layer(512, 256, 6)   # 6 个 Bottleneck
        self.layer4 = self._make_layer(1024, 512, 3)  # 3 个 Bottleneck
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(2048, num_classes)

    def _make_layer(self, in_c, out_c, blocks):
        layers = [Bottleneck(in_c, out_c, downsample=True)]
        for _ in range(1, blocks):
            layers.append(Bottleneck(out_c * 4, out_c))
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.maxpool(self.relu(self.bn1(self.conv1(x))))
        x = self.layer1(x); x = self.layer2(x)
        x = self.layer3(x); x = self.layer4(x)
        return self.avgpool(x)`, },
    ],
  },
  {
    folder: 'YOLO',
    files: [
      { name: 'yolo_head.py', title: 'YOLO 检测头', summary: 'YOLO 目标检测器的输出头，预测 bbox + class',
        code: `class YOLODetectHead(nn.Module):
    """YOLO 检测头 — 在特征图上预测边界框和类别。"""
    def __init__(self, in_channels=[256, 512, 1024], num_classes=80):
        super().__init__()
        self.num_classes = num_classes
        self.heads = nn.ModuleList([
            nn.Conv2d(c, (num_classes + 5) * 3, 1) for c in in_channels
        ])

    def forward(self, features):
        outputs = []
        for feat, head in zip(features, self.heads):
            B, _, H, W = feat.shape
            out = head(feat)  # (B, 255, H, W)
            out = out.view(B, 3, 5 + self.num_classes, H, W)
            outputs.append(out)
        return outputs`, },
    ],
  },
  {
    folder: 'LoRA / Adapter',
    files: [
      { name: 'lora_adapter.py', title: 'LoRA 低秩适配器', summary: '参数高效微调——仅训练低秩矩阵，冻结原模型',
        code: `class LoRALayer(nn.Module):
    """LoRA (Low-Rank Adaptation) — 在原权重旁加低秩旁路。"""
    def __init__(self, in_dim, out_dim, rank=8, alpha=16):
        super().__init__()
        self.rank = rank
        self.alpha = alpha
        self.A = nn.Parameter(torch.randn(in_dim, rank) * 0.01)   # 降维
        self.B = nn.Parameter(torch.zeros(rank, out_dim))         # 升维
        self.scale = alpha / rank

    def forward(self, x):
        return self.scale * (x @ self.A @ self.B)

class LoRAWrapper(nn.Module):
    """将 LoRA 注入到任意 nn.Linear 层。"""
    def __init__(self, original_linear, rank=8, alpha=16):
        super().__init__()
        self.original = original_linear
        self.lora = LoRALayer(original_linear.in_features,
                              original_linear.out_features, rank, alpha)

    def forward(self, x):
        return self.original(x) + self.lora(x)
# 📌 仅展示部分：完整 LoRA 源码含 IA3/BitFit 变体，位于 assets/code_mirror/`, },
    ],
  },
  {
    folder: 'Neck (特征融合)',
    files: [
      { name: 'fpn.py', title: '特征金字塔网络', summary: 'FPN/BiFPN/PAN/ASPP——多尺度特征融合',
        code: `class FPN(nn.Module):
    """Feature Pyramid Network — 自顶向下路径增强。"""
    def __init__(self, in_channels=[256, 512, 1024, 2048], out_channels=256):
        super().__init__()
        self.lateral = nn.ModuleList([nn.Conv2d(c, out_channels, 1) for c in in_channels])
        self.smooth = nn.ModuleList([nn.Conv2d(out_channels, out_channels, 3, 1, 1) for _ in in_channels])

    def forward(self, features):
        laterals = [conv(f) for f, conv in zip(features, self.lateral)]
        outputs = [laterals[-1]]
        for i in range(len(laterals)-2, -1, -1):
            up = F.interpolate(outputs[-1], size=laterals[i].shape[-2:], mode='nearest')
            outputs.append(laterals[i] + up)
        return [self.smooth[i](o) for i, o in enumerate(reversed(outputs))]
# 📌 仅展示部分：完整 Neck 模块含 BiFPN/PAN/ASPP/PPM，位于 assets/code_mirror/`, },
    ],
  },
  {
    folder: 'Preprocessing',
    files: [
      { name: 'preprocessing.py', title: '图像预处理', summary: 'Resize/Normalize/NMS/RandomFlip 数据增强',
        code: `class ImagePreprocessor:
    """图像预处理管线：Resize → Normalize → Augment。"""
    def __init__(self, target_size=1024, mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]):
        self.target_size = target_size
        self.mean = mean; self.std = std

    def resize(self, img):
        h, w = img.shape[:2]
        scale = self.target_size / max(h, w)
        new_h, new_w = int(h * scale), int(w * scale)
        return cv2.resize(img, (new_w, new_h))

    def normalize(self, img):
        img = img.astype(np.float32) / 255.0
        for c in range(3):
            img[:, :, c] = (img[:, :, c] - self.mean[c]) / self.std[c]
        return img

    def nms(self, boxes, scores, iou_thresh=0.5):
        """非极大值抑制，去除重叠检测框。"""
        idx = np.argsort(scores)[::-1]
        keep = []
        while len(idx) > 0:
            keep.append(idx[0])
            ious = compute_iou(boxes[idx[0]], boxes[idx[1:]])
            idx = idx[1:][ious < iou_thresh]
        return keep
# 📌 仅展示部分：完整预处理含 4 类算子，位于 assets/code_mirror/`, },
    ],
  },
  {
    folder: 'ViT / Transformer',
    files: [
      { name: 'vit_encoder.py', title: 'ViT 编码器', summary: 'Vision Transformer——图像 Patch → Token 序列',
        code: `class ViTEncoder(nn.Module):
    """Vision Transformer 编码器。"""
    def __init__(self, img_size=224, patch_size=16, embed_dim=768, depth=12, num_heads=12):
        super().__init__()
        self.patch_embed = nn.Conv2d(3, embed_dim, patch_size, patch_size)
        self.pos_embed = nn.Parameter(torch.randn(1, (img_size//patch_size)**2, embed_dim))
        self.blocks = nn.ModuleList([TransformerBlock(embed_dim, num_heads) for _ in range(depth)])
        self.norm = nn.LayerNorm(embed_dim)

    def forward(self, x):
        x = self.patch_embed(x).flatten(2).transpose(1, 2)
        x = x + self.pos_embed
        for blk in self.blocks: x = blk(x)
        return self.norm(x)
# 📌 仅展示部分：完整 ViT 含 12 层 Transformer Block + 窗口注意力，位于 assets/code_mirror/`, },
      { name: 'swin_transformer.py', title: 'Swin Transformer', summary: '移动窗口 Transformer——层级式特征图',
        code: `class SwinTransformer(nn.Module):
    """Swin Transformer — 移动窗口注意力，层级式金字塔结构。"""
    def __init__(self, embed_dim=96, depths=[2,2,6,2], num_heads=[3,6,12,24]):
        super().__init__()
        self.patch_embed = PatchMerging(3, embed_dim)
        self.layers = nn.ModuleList()
        for i in range(len(depths)):
            self.layers.append(SwinStage(
                dim=embed_dim * (2**i),
                depth=depths[i],
                num_heads=num_heads[i],
                window_size=7,
                shift=(i % 2 != 0)  # 交替窗口与移动窗口
            ))

    def forward(self, x):
        x = self.patch_embed(x)
        for layer in self.layers: x = layer(x)
        return x
# 📌 仅展示部分：Swin 完整实现含 W-MSA/SW-MSA + PatchMerging，位于 assets/code_mirror/`, },
    ],
  },
];

/* ───────── 节点类型 → 源码文件映射 ───────── */
const NODE_TO_FILE = {
  // SAM 系列
  'SAM_ViT_H': 'sam_model.py', 'SAM_ViT_B': 'sam_model.py', 'MobileSAM': 'sam_model.py', 'FastSAM': 'sam_model.py',
  'Mask_Decoder': 'mask_decoder.py',
  // Attention / Transformer 系列
  'ViT_Base': 'vit_encoder.py', 'Swin_Transformer': 'swin_transformer.py',
  'Attention': 'transformer.py',
  // ResNet
  'ResNet50': 'resnet.py', 'EfficientNetV2': 'resnet.py',
  // DINO
  'DINO_v2': 'dino.py',
  // YOLO
  'YOLO_Detect_Head': 'yolo_head.py', 'BBox_Predictor': 'yolo_head.py',
  // LoRA / Adapter
  'LoRA_Sampler': 'lora_adapter.py', 'Conv_Adapter': 'lora_adapter.py', 'IA3': 'lora_adapter.py',
  // Neck
  'Feature_Pyramid': 'fpn.py', 'BiFPN': 'fpn.py', 'PAN': 'fpn.py', 'ASPP': 'fpn.py',
  // Heads
  'Classification_Head': 'heads.py', 'Segmentation_Head': 'heads.py', 'Keypoint_Detector': 'heads.py',
  'Anomaly_Detector': 'heads.py', 'Depth_Estimator': 'heads.py',
  // Processing
  'Resize': 'preprocessing.py', 'Normalize': 'preprocessing.py', 'Random_Flip': 'preprocessing.py', 'NMS': 'preprocessing.py',
  // 类型兜底
  encoder: 'vit_encoder.py', prompt_encoder: 'mask_decoder.py',
  attention: 'transformer.py', decoder: 'sam_model.py', base: 'sam_model.py',
};
const DEFAULT_FILE = 'sam_model.py';

/* ───────── 文件中文说明（侧栏用） ───────── */
const EXPLANATIONS = {
  'model.py': `SAM 主模型（model.py）将图像编码器、提示编码器、掩码解码器三大组件串联：

1. preprocess() — 图像归一化 + 尺寸统一（1024×1024）
2. image_encoder() — ViT 提取 256 维特征图
3. prompt_encoder() — 用户提示转嵌入向量
4. mask_decoder() — 融合图像和提示特征，生成分割掩码

设计亮点：
- 支持批量处理，每个图像可有独立的提示
- 可输出多个掩码候选（multimask_output）
- 位置编码使用随机高斯分布`,

  'image_encoder.py': `图像编码器（image_encoder.py）采用 Vision Transformer：

核心结构：
1. PatchEmbed：1024×1024 切分为 64×64 个 patch（每 patch 16×16 像素）
2. 12 个 Transformer Block 堆叠（自注意力 + FFN）
3. Neck：4 层卷积将 768 维降至 256 维

技术细节：
- 使用绝对位置编码（sine-cosine）
- 窗口注意力（windowed attention）处理高分辨率
- 最后的 neck 层起到特征压缩作用`,

  'prompt_encoder.py': `提示编码器（prompt_encoder.py）支持：

提示类型：
1. 点提示 — 编码为前景/背景 4 种 embedding
2. 边界框 — 编码左上角和右下角 2 个点
3. 掩码提示 — 卷积下采样为 dense embedding

关键设计：
- sparse_embeddings: 点/框的稀疏表示
- dense_embeddings: 掩码的稠密表示
- 无提示时输出可学习的 no_mask_embed`,

  'transformer.py': `多头注意力（transformer.py）是 Transformer 架构的核心组件，SAM 中大量使用。

计算过程：
1. 将输入通过 W_q/W_k/W_v 投影为 Query/Key/Value
2. 将 Q/K/V 按 num_heads 切分为多组
3. 每组独立计算注意力：softmax(QK^T/√d_k)·V
4. 合并多头输出并通过 W_o 投影

关键参数：
- d_k = d_model / num_heads，每个头的维度
- scale factor = 1/√d_k 防止点积过大
- dropout 在 softmax 后应用`,

  'resnet.py': `ResNet50（resnet.py）是计算机视觉最经典的 Backbone 之一：

核心结构：
1. Stem：7×7 卷积 + 3×3 MaxPool，快速降采样
2. 4 个 Stage，每 Stage 包含多个 Bottleneck（1×1→3×3→1×1）
3. 残差连接（Residual Connection）让梯度可以直通，解决深层网络退化
4. 全局平均池化代替全连接，大幅减少参数量

📌 仅展示部分：完整 ResNet 含 ResNet18/34/50/101/152 变体，位于 assets/code_mirror/`,

  'yolo_head.py': `YOLO 检测头（yolo_head.py）负责在特征图上预测目标：

输出格式：
1. bbox 坐标（x, y, w, h）— 相对于 anchor 的偏移
2. objectness — 该 anchor 是否包含目标
3. class scores — 各类别概率

多尺度检测：在 3 个不同尺度的特征图上分别预测，覆盖大/中/小目标。

📌 仅展示部分：完整 YOLO 含 anchor 生成 + NMS 后处理，位于 assets/code_mirror/`,

  'lora_adapter.py': `LoRA 适配器（lora_adapter.py）实现参数高效微调：

核心思想：
1. 冻结原始模型所有权重
2. 在每个 Linear 层旁加低秩矩阵 A（d×r）和 B（r×d）
3. 仅训练 A 和 B，参数量仅为原始的 r/d 倍

变体：IA3（仅缩放向量）、BitFit（仅训练 bias）

📌 仅展示部分：完整 LoRA 含 IA3/BitFit/AdapterFormer 变体，位于 assets/code_mirror/`,

  'fpn.py': `特征金字塔（fpn.py）构建多尺度特征图：

网络结构：
1. Bottom-up pathway — Backbone 的前向过程，生成多级特征图（C2-C5）
2. Top-down pathway — 从顶层向下逐级上采样并融合
3. Lateral connections — 1×1 卷积统一通道数

变体：BiFPN（双向+加权）、PAN（额外自底向上路径）、ASPP（空洞空间金字塔池化）

📌 仅展示部分：完整 Neck 含 5 种变体，位于 assets/code_mirror/`,

  'preprocessing.py': `图像预处理（preprocessing.py）包含数据增强和归一化：

算子列表：
1. Resize — 等比缩放至统一尺寸
2. Normalize — 减均值除标准差
3. RandomFlip — 随机水平/垂直翻转
4. NMS — 非极大值抑制去除冗余检测框

📌 仅展示部分：完整预处理含 4 类算子的多种实现，位于 assets/code_mirror/`,

  'vit_encoder.py': `ViT 编码器（vit_encoder.py）将图像转为 Token 序列：

关键步骤：
1. Patch Embedding：图像切分为固定大小的 patch，线性投影为 token
2. Position Embedding：可学习的位置编码
3. 12 层 Transformer Block：多头自注意力 + FFN
4. LayerNorm：Pre-norm 结构（注意力前归一化）

📌 仅展示部分：完整 ViT 含 12 层 Transformer + 窗口注意力，位于 assets/code_mirror/`,

  'swin_transformer.py': `Swin Transformer（swin_transformer.py）引入层级式结构：

创新点：
1. Patch Merging — 逐级合并相邻 patch，构建金字塔特征
2. W-MSA — 窗口内自注意力（非全局），降低复杂度
3. SW-MSA — 移动窗口自注意力，跨窗口通信
4. 层级输出 C1→C2→C3→C4，天然适合检测/分割任务

📌 仅展示部分：完整 Swin 含 4 个 Stage，位于 assets/code_mirror/`,

  'dino.py': `DINO（dino.py）是自监督视觉表征学习的经典框架。

核心机制：
1. 教师网络 — 通过 EMA 更新，参数不参与梯度
2. 学生网络 — 正常反向传播更新
3. 原型向量（prototypes）— 将特征映射到离散原型空间
4. 居中化（centering）— 防止模式坍塌

损失函数采用交叉熵+温度缩放的对比损失，同一个图像的两个增强视图互为正样本。`,
};

/* ───────── Python 语法高亮（简化版） ───────── */
const PY_KEYWORDS = ['class', 'def', 'return', 'if', 'else', 'elif', 'for', 'in', 'while',
  'import', 'from', 'as', 'try', 'except', 'with', 'yield', 'lambda', 'raise', 'assert',
  'pass', 'break', 'continue', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'self', 'super'];
const PY_TYPES = ['int', 'float', 'str', 'list', 'dict', 'tuple', 'set', 'bool',
  'Any', 'Optional', 'Tuple', 'List', 'nn.Module', 'torch.Tensor'];

function highlightLine(line) {
  // 转义
  let html = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // 字符串（绿色）
  html = html.replace(/(".*?"|'.*?'|`.*?`)/g, '<span style="color:#16a34a">$1</span>');
  // 注释（灰色）
  html = html.replace(/(#.*$)/g, '<span style="color:#94a3b8;font-style:italic">$1</span>');
  // 关键字（紫红色）
  html = html.replace(
    new RegExp(`\\b(${PY_KEYWORDS.join('|')})\\b`, 'g'),
    '<span style="color:#be185d;font-weight:600">$1</span>',
  );
  // 类型/类名（蓝色）
  html = html.replace(
    new RegExp(`\\b(${PY_TYPES.join('|')})\\b`, 'g'),
    '<span style="color:#2563eb">$1</span>',
  );
  // 数字（橙色）
  html = html.replace(/(\d+\.?\d*)/g, '<span style="color:#ea580c">$1</span>');
  return html;
}

function highlightCode(code) {
  return code.split('\n').map((line, i) => ({
    lineNo: i + 1,
    html: highlightLine(line) || '&nbsp;',
  }));
}

/* ───────── 主组件 ───────── */
export function SourceCodeDrawer({ open, nodeType, onClose }) {
  // 根据节点类型推导默认文件
  const defaultFile = nodeType ? (NODE_TO_FILE[nodeType] || DEFAULT_FILE) : DEFAULT_FILE;
  const [selectedFile, setSelectedFile] = useState(defaultFile);
  const [showExplain, setShowExplain] = useState(true);
  const [copied, setCopied] = useState(false);

  // 节点变化时同步默认文件
  useEffect(() => {
    if (open && nodeType) {
      setSelectedFile(NODE_TO_FILE[nodeType] || DEFAULT_FILE);
      setShowExplain(true);
    }
  }, [open, nodeType]);

  // 找当前文件数据
  const currentFile = useMemo(() => {
    for (const folder of FILE_TREE) {
      for (const file of folder.files) {
        if (file.name === selectedFile) return { ...file, folder: folder.folder };
      }
    }
    return null;
  }, [selectedFile]);

  const lines = useMemo(
    () => currentFile ? highlightCode(currentFile.code) : [],
    [currentFile],
  );

  if (!open) return null;

  const copyCode = () => {
    if (currentFile) {
      navigator.clipboard.writeText(currentFile.code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        // 兜底：选中后用 execCommand
        const ta = document.createElement('textarea');
        ta.value = currentFile.code;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); }
        catch (_) {}
        document.body.removeChild(ta);
      });
    }
  };

  return (
    <>
      {/* 遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.18)',
          zIndex: 1900, animation: 'sourceFade .2s ease',
        }}
      />
      {/* Drawer —— 白色系：浅灰底 + 蓝字，整体宽 820px 给代码更多展示空间 */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 820, maxWidth: '96vw',
          background: '#ffffff', color: '#1e293b',
          zIndex: 1950,
          boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
          display: 'flex',
          animation: 'sourceSlide .26s cubic-bezier(.2,.7,.3,1)',
        }}
      >
        {/* 左侧：代码区（白底） */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <div style={{
            padding: '12px 14px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 18 }}>📖</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  教研智能体 · 源码伴读
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                  {nodeType ? `已根据「${nodeType}」节点定位源码` : '浏览所有核心源码文件'}
                </div>
              </div>
            </div>
            <button onClick={onClose} aria-label="关闭"
              style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
                width: 28, height: 28, borderRadius: 14,
                cursor: 'pointer', fontSize: 16, color: '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>×</button>
          </div>

          {/* 文件切换条 */}
          <div style={{
            padding: '6px 10px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex', gap: 4, overflowX: 'auto',
          }}>
            {FILE_TREE.flatMap(folder =>
              folder.files.map(f => (
                <button
                  key={f.name}
                  onClick={() => setSelectedFile(f.name)}
                  style={{
                    padding: '4px 10px', fontSize: 10,
                    background: selectedFile === f.name ? '#eff6ff' : '#ffffff',
                    color: selectedFile === f.name ? '#3b82f6' : '#475569',
                    border: '1px solid ' + (selectedFile === f.name ? '#bfdbfe' : '#e2e8f0'),
                    borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >📄 {f.name}</button>
              ))
            )}
          </div>

          {/* 文件标题 + summary */}
          {currentFile && (
            <div style={{ padding: '10px 14px 6px', background: '#ffffff' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                {currentFile.title}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>
                {currentFile.summary}
              </div>
            </div>
          )}

          {/* 代码区（白底 + 浅灰行号栏 + VSCode Light 风格语法高亮） */}
          <div style={{ flex: 1, overflow: 'auto', background: '#ffffff', padding: '8px 0' }}>
            {lines.map((line) => (
              <div
                key={line.lineNo}
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
                  fontSize: 12, lineHeight: 1.7,
                  whiteSpace: 'pre',
                  color: '#1e293b',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 36, textAlign: 'right',
                    paddingRight: 10,
                    color: '#94a3b8',
                    borderRight: '1px solid #e2e8f0',
                    marginRight: 10,
                    userSelect: 'none',
                    background: '#fafbfc',
                  }}
                >{line.lineNo}</span>
                <span dangerouslySetInnerHTML={{ __html: line.html }} />
              </div>
            ))}
          </div>

          {/* 底部操作栏（白系） */}
          <div style={{
            padding: '8px 14px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex', gap: 8,
          }}>
            <button onClick={copyCode} style={{
              background: '#ffffff', border: '1px solid #e2e8f0',
              color: '#475569', padding: '5px 12px', borderRadius: 6,
              fontSize: 11, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>📋 {copied ? '已复制' : '复制代码'}</button>
            <button onClick={() => setShowExplain(!showExplain)} style={{
              background: showExplain ? '#eff6ff' : '#ffffff',
              border: '1px solid ' + (showExplain ? '#bfdbfe' : '#e2e8f0'),
              color: showExplain ? '#3b82f6' : '#475569',
              padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>💡 {showExplain ? '隐藏解释' : '查看解释'}</button>
          </div>
        </div>

        {/* 右侧：解释面板（浅灰底） */}
        {showExplain && (
          <div style={{
            width: 200, flexShrink: 0,
            background: '#f8fafc',
            borderLeft: '1px solid #e2e8f0',
            overflowY: 'auto',
          }}>
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                💡 教研批注
              </div>
              <div style={{
                fontSize: 11, color: '#475569', lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}>
                {currentFile ? (EXPLANATIONS[currentFile.name] || '暂无说明') : '请选择文件'}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes sourceSlide {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes sourceFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}

/* 导出节点映射常量，方便其它组件复用（比如高亮"哪些节点有源码") */
export const SOURCE_NODE_TYPES = Object.keys(NODE_TO_FILE);
