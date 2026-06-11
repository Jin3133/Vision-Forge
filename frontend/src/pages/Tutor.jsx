import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/* ───────── 预设数据 ───────── */
const QA_PAIRS = [
  {
    q: '什么是注意力机制？',
    type: 'text',
    answer: `注意力机制（Attention Mechanism）是深度学习中模拟人类视觉注意力的技术，它允许模型在处理序列数据时动态地关注输入的不同部分。

核心思想：通过计算Query和Key的相似度来加权聚合Value，从而提取最相关的信息。

数学公式：`,
    latex: 'Attention(Q, K, V) = softmax( QK^T / \\sqrt{d_k} ) V',
    code: `import torch
import torch.nn as nn

class SelfAttention(nn.Module):
    def __init__(self, embed_size, heads):
        super().__init__()
        self.embed_size = embed_size
        self.heads = heads
        self.head_dim = embed_size // heads
        
        self.values = nn.Linear(embed_size, embed_size)
        self.keys = nn.Linear(embed_size, embed_size)
        self.queries = nn.Linear(embed_size, embed_size)
        self.fc_out = nn.Linear(embed_size, embed_size)
    
    def forward(self, x):
        N, seq_length, _ = x.shape
        values = self.values(x).view(N, seq_length, self.heads, self.head_dim)
        keys = self.keys(x).view(N, seq_length, self.heads, self.head_dim)
        queries = self.queries(x).view(N, seq_length, self.heads, self.head_dim)
        
        # QK^T / sqrt(d_k)
        energy = torch.einsum('nqhd,nkhd->nhqk', [queries, keys])
        attention = torch.softmax(energy / (self.head_dim ** 0.5), dim=3)
        
        # weighted sum of values
        out = torch.einsum('nhql,nlhd->nqhd', [attention, values])
        out = out.reshape(N, seq_length, self.embed_size)
        return self.fc_out(out)`,
  },
  {
    q: 'SAM模型原理',
    type: 'text',
    answer: `SAM（Segment Anything Model）是Meta发布的图像分割基础模型，核心架构包含三个组件：

1. 图像编码器（Image Encoder）：使用Vision Transformer提取图像特征
2. 提示编码器（Prompt Encoder）：支持点、框、文本等多种提示输入
3. 掩码解码器（Mask Decoder）：根据图像特征和提示生成分割掩码

SAM的训练采用了"提示分割"范式，通过1100万张图像和11亿个掩码进行大规模训练。`,
    latex: '',
    code: `class SAM(nn.Module):
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
            image_features, 
            prompt_embeddings
        )
        return masks, scores`,
  },
  {
    q: '如何微调模型？',
    type: 'text',
    answer: `模型微调（Fine-tuning）是在预训练模型基础上，针对特定下游任务进行适配的过程。常用方法包括：

1. 全参数微调：训练所有参数，适合数据充足的场景
2. LoRA：低秩适配，只训练少量参数，高效且节省显存
3. Prompt Tuning：通过软提示引导模型，适合少样本场景
4. Adapter：在层间插入适配器模块，保持主干冻结

推荐流程：加载预训练权重 → 冻结部分层 → 替换分类头 → 小学习率训练 → 评估验证`,
    latex: '',
    code: `from peft import LoraConfig, get_peft_model
import torch

# LoRA 微调配置
lora_config = LoraConfig(
    r=16,                    # 低秩维度
    lora_alpha=32,           # 缩放参数
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="FEATURE_EXTRACTION"
)

# 应用LoRA
model = load_pretrained_model()
model = get_peft_model(model, lora_config)

# 训练（只更新LoRA参数）
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
for epoch in range(5):
    for batch in dataloader:
        loss = model(**batch).loss
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()`,
  },
  {
    q: '图像分割方法',
    type: 'table',
    answer: '',
    latex: '',
    code: '',
    table: {
      headers: ['方法', '代表模型', '特点', '适用场景'],
      rows: [
        ['语义分割', 'DeepLab, PSPNet', '像素级分类，同类物体不分个体', '场景理解'],
        ['实例分割', 'Mask R-CNN', '区分不同个体，逐实例掩码', '物体检测+分割'],
        ['全景分割', 'PanopticFPN', '语义+实例的统一分割', '完整场景解析'],
        ['交互式分割', 'SAM', '用户提示驱动，零样本能力', '任意图像分割'],
        ['医学图像分割', 'UNet, nnU-Net', 'U型编码解码，细节保留', '病灶/器官分割'],
      ],
    },
  },
];

const FILE_TREE = [
  {
    folder: 'SAM',
    files: [
      { name: 'model.py', code: `class SAM(nn.Module):
    """
    Segment Anything Model (SAM) 主模型类。
    包含图像编码器、提示编码器和掩码解码器三个核心组件。
    """
    
    def __init__(
        self,
        image_encoder: ImageEncoderViT,
        prompt_encoder: PromptEncoder,
        mask_decoder: MaskDecoder,
        pixel_mean: List[float] = [123.675, 116.28, 103.53],
        pixel_std: List[float] = [58.395, 57.12, 57.375],
    ) -> None:
        super().__init__()
        self.image_encoder = image_encoder
        self.prompt_encoder = prompt_encoder
        self.mask_decoder = mask_decoder
        self.register_buffer("pixel_mean", torch.Tensor(pixel_mean).view(-1, 1, 1), False)
        self.register_buffer("pixel_std", torch.Tensor(pixel_std).view(-1, 1, 1), False)
    
    @property
    def device(self) -> Any:
        return self.pixel_mean.device
    
    def forward(
        self,
        batched_input: List[Dict[str, Any]],
        multimask_output: bool,
    ) -> List[Dict[str, torch.Tensor]]:
        """
        前向传播函数。
        
        Args:
            batched_input: 输入批次，包含图像和提示
            multimask_output: 是否输出多个掩码候选
            
        Returns:
            每个输入对应的掩码和分数
        """
        input_images = torch.stack([
            self.preprocess(x["image"]) for x in batched_input
        ], dim=0)
        
        # 1. 图像编码 → 提取特征
        image_embeddings = self.image_encoder(input_images)
        
        outputs = []
        for image_record, curr_embedding in zip(batched_input, image_embeddings):
            # 2. 提示编码 → 点/框/文本转嵌入
            sparse_emb, dense_emb = self.prompt_encoder(
                points=image_record.get("point_coords"),
                boxes=image_record.get("boxes"),
                masks=image_record.get("mask_inputs"),
            )
            
            # 3. 掩码解码 → 生成最终分割掩码
            low_res_masks, iou_predictions = self.mask_decoder(
                image_embeddings=curr_embedding.unsqueeze(0),
                image_pe=self.prompt_encoder.get_dense_pe(),
                sparse_prompt_embeddings=sparse_emb,
                dense_prompt_embeddings=dense_emb,
                multimask_output=multimask_output,
            )
            
            masks = self.postprocess_masks(
                low_res_masks,
                input_size=image_record["image"].shape[-2:],
                original_size=image_record["original_size"],
            )
            
            outputs.append({
                "masks": masks,
                "iou_predictions": iou_predictions,
                "low_res_logits": low_res_masks,
            })
        
        return outputs
    
    def preprocess(self, x: torch.Tensor) -> torch.Tensor:
        """归一化预处理"""
        x = (x - self.pixel_mean) / self.pixel_std
        # 填充到1024x1024
        h, w = x.shape[-2:]
        pad_h = 1024 - h
        pad_w = 1024 - w
        x = F.pad(x, (0, pad_w, 0, pad_h))
        return x` },
      { name: 'image_encoder.py', code: `class ImageEncoderViT(nn.Module):
    """
    SAM图像编码器 — 基于Vision Transformer。
    使用窗口化注意力处理高分辨率图像。
    """
    
    def __init__(
        self,
        img_size: int = 1024,
        patch_size: int = 16,
        in_chans: int = 3,
        embed_dim: int = 768,
        depth: int = 12,
        num_heads: int = 12,
        mlp_ratio: float = 4.0,
        out_chans: int = 256,
    ):
        super().__init__()
        self.patch_embed = PatchEmbed(
            kernel_size=patch_size,
            stride=patch_size,
            in_chans=in_chans,
            embed_dim=embed_dim,
        )
        
        self.blocks = nn.ModuleList([
            Block(embed_dim, num_heads, mlp_ratio, qkv_bias=True)
            for _ in range(depth)
        ])
        
        self.neck = nn.Sequential(
            nn.Conv2d(embed_dim, out_chans, 1, bias=False),
            LayerNorm2d(out_chans),
            nn.Conv2d(out_chans, out_chans, 3, padding=1, bias=False),
            LayerNorm2d(out_chans),
        )
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.patch_embed(x)
        
        #  Transformer blocks
        for blk in self.blocks:
            x = blk(x)
        
        # 通道降维 neck
        x = self.neck(x.permute(0, 3, 1, 2))
        
        return x` },
      { name: 'prompt_encoder.py', code: `class PromptEncoder(nn.Module):
    """
    SAM提示编码器 — 支持多种提示类型：
    - 点（前景/背景）
    - 边界框
    - 掩码（低分辨率）
    """
    
    def __init__(
        self,
        embed_dim: int = 256,
        image_embedding_size: Tuple[int, int] = (64, 64),
        input_image_size: Tuple[int, int] = (1024, 1024),
        mask_in_chans: int = 16,
    ):
        super().__init__()
        self.embed_dim = embed_dim
        self.image_embedding_size = image_embedding_size
        self.input_image_size = input_image_size
        
        # 点嵌入
        self.point_embeddings = nn.ModuleList([
            nn.Embedding(1, embed_dim) for _ in range(4)
        ])
        
        # 边界框嵌入
        self.not_a_point_embed = nn.Embedding(1, embed_dim)
        
        # 掩码下采样
        self.mask_downscaling = nn.Sequential(
            nn.Conv2d(1, mask_in_chans // 4, kernel_size=2, stride=2),
            LayerNorm2d(mask_in_chans // 4),
            nn.GELU(),
            nn.Conv2d(mask_in_chans // 4, mask_in_chans, kernel_size=2, stride=2),
            LayerNorm2d(mask_in_chans),
            nn.GELU(),
            nn.Conv2d(mask_in_chans, embed_dim, kernel_size=1),
        )
        
        # 位置编码
        self.pe_layer = PositionEmbeddingRandom(embed_dim // 2)
    
    def forward(
        self,
        points: Optional[torch.Tensor],
        boxes: Optional[torch.Tensor],
        masks: Optional[torch.Tensor],
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        
        bs = self._get_batch_size(points, boxes, masks)
        sparse_embeddings = torch.zeros(
            (bs, 0, self.embed_dim), device=self._get_device()
        )
        
        if points is not None:
            point_embeddings = self._embed_points(points)
            sparse_embeddings = torch.cat([sparse_embeddings, point_embeddings], dim=1)
        
        if boxes is not None:
            box_embeddings = self._embed_boxes(boxes)
            sparse_embeddings = torch.cat([sparse_embeddings, box_embeddings], dim=1)
        
        if masks is not None:
            dense_embeddings = self._embed_masks(masks)
        else:
            dense_embeddings = self.no_mask_embed.weight.view(1, -1, 1, 1).expand(
                bs, -1, self.image_embedding_size[0], self.image_embedding_size[1]
            )
        
        return sparse_embeddings, dense_embeddings` },
      { name: 'mask_decoder.py', code: `class MaskDecoder(nn.Module):
    """
    SAM掩码解码器 — 使用Transformer的双向注意力机制，
    将图像嵌入和提示嵌入融合，生成分割掩码。
    """
    
    def __init__(
        self,
        transformer_dim: int = 256,
        transformer: TwoWayTransformer,
        num_multimask_outputs: int = 3,
        activation: Type[nn.Module] = nn.GELU,
        iou_head_depth: int = 3,
        iou_head_hidden_dim: int = 256,
    ):
        super().__init__()
        self.transformer_dim = transformer_dim
        self.transformer = transformer
        self.num_multimask_outputs = num_multimask_outputs
        
        # IoU预测头
        self.iou_prediction_head = MLP(
            transformer_dim, iou_head_hidden_dim, num_multimask_outputs + 1, iou_head_depth
        )
        
        # 掩码上采样
        self.output_upscaling = nn.Sequential(
            nn.ConvTranspose2d(transformer_dim, transformer_dim // 4, kernel_size=2, stride=2),
            LayerNorm2d(transformer_dim // 4),
            activation(),
            nn.ConvTranspose2d(transformer_dim // 4, transformer_dim // 8, kernel_size=2, stride=2),
            activation(),
        )
        
        # 掩码预测头
        self.output_hypernetworks_mlps = nn.ModuleList([
            MLP(transformer_dim, transformer_dim, transformer_dim // 8, 3)
            for _ in range(num_multimask_outputs + 1)
        ])
    
    def forward(
        self,
        image_embeddings: torch.Tensor,
        image_pe: torch.Tensor,
        sparse_prompt_embeddings: torch.Tensor,
        dense_prompt_embeddings: torch.Tensor,
        multimask_output: bool,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        
        masks, iou_pred = self.predict_masks(
            image_embeddings, image_pe,
            sparse_prompt_embeddings, dense_prompt_embeddings
        )
        
        # 选择输出掩码数量
        mask_slice = slice(1, None) if multimask_output else slice(0, 1)
        masks = masks[:, mask_slice, :, :]
        iou_pred = iou_pred[:, mask_slice]
        
        return masks, iou_pred
    
    def predict_masks(
        self,
        image_embeddings: torch.Tensor,
        image_pe: torch.Tensor,
        sparse_prompt_embeddings: torch.Tensor,
        dense_prompt_embeddings: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        
        # 融合图像和提示特征
        src = image_embeddings + dense_prompt_embeddings
        b, c, h, w = src.shape
        
        src = src.flatten(2).permute(2, 0, 1)
        image_pe = image_pe.flatten(2).permute(2, 0, 1)
        
        # Transformer解码
        hs, src = self.transformer(src, image_pe, sparse_prompt_embeddings)
        
        # 上采样生成掩码
        upscaled_embedding = self.output_upscaling(src.permute(1, 2, 0).view(b, c, h, w))
        
        hyper_in_list = [
            mlp(hs[:, i, :]) for i, mlp in enumerate(self.output_hypernetworks_mlps)
        ]
        hyper_in = torch.stack(hyper_in_list, dim=1)
        b, c, h, w = upscaled_embedding.shape
        
        masks = (hyper_in @ upscaled_embedding.view(b, c, h * w)).view(b, -1, h, w)
        
        # IoU预测
        iou_pred = self.iou_prediction_head(hs[:, 0, :])
        
        return masks, iou_pred` },
    ],
  },
  {
    folder: 'DINO',
    files: [
      { name: 'dino.py', code: `class DINO(nn.Module):
    """
    DINO: Emerging Properties in Self-Supervised Vision Transformers
    自监督学习的知识蒸馏框架
    """
    
    def __init__(
        self,
        student: nn.Module,
        teacher: nn.Module,
        embed_dim: int = 768,
        num_prototypes: int = 65536,
        temp_student: float = 0.1,
        temp_teacher: float = 0.04,
    ):
        super().__init__()
        self.student = student
        self.teacher = teacher
        
        # 教师网络参数不参与梯度更新
        for p in self.teacher.parameters():
            p.requires_grad = False
        
        # 原型向量（用于对比学习）
        self.prototypes = nn.Linear(embed_dim, num_prototypes, bias=False)
        
        self.temp_student = temp_student
        self.temp_teacher = temp_teacher
        
        # Center用于居中化
        self.register_buffer("center", torch.zeros(1, num_prototypes))
        self.register_buffer("center_momentum", torch.tensor(0.9))
    
    def forward(self, x1, x2):
        """
        x1, x2: 同一图像的两个不同增强视图
        """
        # 学生网络输出
        s1 = F.normalize(self.prototypes(self.student(x1)), dim=-1)
        s2 = F.normalize(self.prototypes(self.student(x2)), dim=-1)
        
        # 教师网络输出（无梯度）
        with torch.no_grad():
            t1 = F.normalize(self.prototypes(self.teacher(x1)), dim=-1)
            t2 = F.normalize(self.prototypes(self.teacher(x2)), dim=-1)
        
        # 交叉熵损失
        loss = self.dino_loss(s1, t2, self.temp_student, self.temp_teacher)
        loss += self.dino_loss(s2, t1, self.temp_student, self.temp_teacher)
        
        return loss / 2
    
    @torch.no_grad()
    def update_teacher(self, momentum=0.996):
        """EMA更新教师网络"""
        for s_p, t_p in zip(self.student.parameters(), self.teacher.parameters()):
            t_p.data.mul_(momentum).add_(s_p.data, alpha=1 - momentum)` },
      { name: 'transformer.py', code: `class MultiHeadAttention(nn.Module):
    """
    多头自注意力机制 — Transformer的核心组件
    """
    
    def __init__(self, d_model, num_heads, dropout=0.1):
        super().__init__()
        assert d_model % num_heads == 0
        
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads  # 每个头的维度
        
        # Q, K, V 线性投影
        self.W_q = nn.Linear(d_model, d_model)
        self.W_k = nn.Linear(d_model, d_model)
        self.W_v = nn.Linear(d_model, d_model)
        
        # 输出投影
        self.W_o = nn.Linear(d_model, d_model)
        
        self.dropout = nn.Dropout(dropout)
        self.scale = self.d_k ** -0.5
    
    def forward(self, query, key, value, mask=None):
        batch_size = query.size(0)
        
        # 1. 线性投影并分头
        Q = self.W_q(query).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        K = self.W_k(key).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        V = self.W_v(value).view(batch_size, -1, self.num_heads, self.d_k).transpose(1, 2)
        
        # 2. 计算注意力分数
        scores = torch.matmul(Q, K.transpose(-2, -1)) * self.scale
        
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))
        
        attn_weights = F.softmax(scores, dim=-1)
        attn_weights = self.dropout(attn_weights)
        
        # 3. 加权聚合Value
        attn_output = torch.matmul(attn_weights, V)
        
        # 4. 合并多头的输出
        attn_output = attn_output.transpose(1, 2).contiguous().view(
            batch_size, -1, self.d_model
        )
        
        return self.W_o(attn_output)` },
    ],
  },
];

const OPEN_SOURCE_ITEMS = [
  { icon: '⚛️', name: 'React', desc: '用于构建用户界面的JavaScript库', license: 'MIT', link: 'https://react.dev' },
  { icon: '⚡', name: 'Vite', desc: '下一代前端构建工具，极速开发体验', license: 'MIT', link: 'https://vitejs.dev' },
  { icon: '🌊', name: 'React Flow', desc: '节点式图形编辑与可视化库', license: 'MIT', link: 'https://reactflow.dev' },
  { icon: '📊', name: 'Recharts', desc: '基于React的声明式图表库', license: 'MIT', link: 'https://recharts.org' },
  { icon: '🔥', name: 'PyTorch', desc: '开源深度学习框架', license: 'BSD', link: 'https://pytorch.org' },
  { icon: '🎯', name: 'SAM', desc: 'Segment Anything Model 图像分割', license: 'Apache 2.0', link: 'https://segment-anything.com' },
  { icon: '🧠', name: 'DeepSeek', desc: '大语言模型推理 API 服务', license: '商业API', link: 'https://deepseek.com' },
  { icon: '⭐', name: '讯飞星火', desc: '认知大模型 API 服务', license: '商业API', link: 'https://xinghuo.xfyun.cn' },
];

const SAFETY_CARDS = [
  { icon: '🛡️', title: '内容安全过滤', desc: '所有AI生成内容经过安全过滤，防止有害信息输出' },
  { icon: '📋', title: '真实数据溯源', desc: '知识库内容可追溯至权威教材与官方文档' },
  { icon: '✅', title: '学术内容校验', desc: '学术概念和公式经过多轮校验确保准确性' },
];

/* ───────── 工具函数 ───────── */
const highlightPython = (code) => {
  const keywords = ['class', 'def', 'return', 'if', 'else', 'elif', 'for', 'in', 'while', 'import', 'from', 'as', 'try', 'except', 'with', 'yield', 'lambda', 'raise', 'assert', 'pass', 'break', 'continue', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'self', 'super'];
  const types = ['int', 'float', 'str', 'list', 'dict', 'tuple', 'set', 'bool', 'Any', 'Optional', 'Tuple', 'List', 'nn.Module', 'torch.Tensor'];
  const decorators = ['@torch.no_grad', '@property', '@staticmethod'];

  return code.split('\n').map((line, i) => {
    let html = line
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/(".*?"|'.*?')/g, '<span style="color:#a5d6ff">$1</span>')
      .replace(/(#.*$)/gm, '<span style="color:#8b949e">$1</span>')
      .replace(new RegExp(`\\b(${keywords.join('|')})\\b`, 'g'), '<span style="color:#ff7b72">$1</span>')
      .replace(new RegExp(`\\b(${types.join('|')})\\b`, 'g'), '<span style="color:#79c0ff">$1</span>')
      .replace(/(\d+\.?\d*)/g, '<span style="color:#79c0ff">$1</span>')
      .replace(new RegExp(`(${decorators.join('|')})`, 'g'), '<span style="color:#d2a8ff">$1</span>');
    return { __html: `<span style="color:#8b949e;display:inline-block;width:30px;text-align:right;padding-right:12px;border-right:1px solid #334155;margin-right:12px;user-select:none">${i + 1}</span>${html || '&nbsp;'}` };
  });
};

const EXPLANATIONS = {
  'model.py': `SAM主模型类（model.py）的核心作用是将图像编码器、提示编码器和掩码解码器三大组件串联起来，形成完整的推理管线。

关键流程：
1. preprocess() — 对输入图像进行归一化和尺寸统一（1024×1024）
2. image_encoder() — ViT提取图像特征，输出256维特征图
3. prompt_encoder() — 将用户点击的点/框等提示转为嵌入向量
4. mask_decoder() — 融合图像特征和提示嵌入，生成分割掩码
5. postprocess() — 将低分辨率掩码还原为原始图像尺寸

设计亮点：
- 支持批量处理，每个图像可有独立的提示
- 可输出多个掩码候选（multimask_output）
- 位置编码使用随机高斯分布`,
  'image_encoder.py': `图像编码器（image_encoder.py）采用Vision Transformer架构，是SAM中最重的组件。

核心结构：
1. PatchEmbed — 将1024×1024图像切分为64×64的patch，每patch 16×16像素
2. 12个Transformer Block — 自注意力+FFN的堆叠
3. Neck — 4层卷积将768维降至256维，便于后续解码

技术细节：
- 使用绝对位置编码（sine-cosine）
- 窗口注意力（windowed attention）处理高分辨率
- 最后的neck层起到特征压缩作用`,
  'prompt_encoder.py': `提示编码器（prompt_encoder.py）负责将用户的交互输入转换为模型可理解的嵌入向量。

支持的提示类型：
1. 点提示 — 编码为4种embedding（前景/背景+2种corner case）
2. 边界框 — 编码左上角和右下角2个点
3. 掩码提示 — 通过卷积下采样为dense embedding

关键设计：
- sparse_embeddings: 点/框的稀疏表示
- dense_embeddings: 掩码的稠密表示
- 无提示时输出可学习的no_mask_embed`,
  'mask_decoder.py': `掩码解码器（mask_decoder.py）是SAM的轻量化解码头，负责融合图像和提示特征生成分割掩码。

核心流程：
1. TwoWayTransformer — 双向注意力：提示token→图像token→提示token
2. 输出上采样 — 2次转置卷积，64×64→256×256
3. Hypernetwork — 为每个掩码候选生成独立的预测权重
4. IoU Head — 预测每个掩码的质量分数

特点：
- 默认输出4个掩码候选（3个multimask + 1个singlemask）
- 根据IoU分数自动选择最佳掩码`,
  'dino.py': `DINO（dino.py）是自监督视觉表示学习的经典框架，通过知识蒸馏让学生网络学习教师网络的表示。

核心机制：
1. 教师网络 — 通过EMA更新，参数不参与梯度
2. 学生网络 — 正常反向传播更新
3. 原型向量（prototypes）— 将特征映射到离散原型空间
4. 居中化（centering）— 防止模式坍塌

损失函数采用交叉熵+温度缩放的对比损失，同一个图像的两个增强视图互为正样本。`,
  'transformer.py': `多头注意力（transformer.py）是Transformer架构的核心组件，SAM中大量使用。

计算过程：
1. 将输入通过W_q/W_k/W_v投影为Query/Key/Value
2. 将Q/K/V按num_heads切分为多组
3. 每组独立计算注意力：softmax(QK^T/√d_k)·V
4. 合并多头输出并通过W_o投影

关键参数：
- d_k = d_model / num_heads，每个头的维度
- scale factor = 1/√d_k 防止点积过大
- dropout在softmax后应用`,
};

const QUICK_QUESTIONS = ['什么是注意力机制？', 'SAM模型原理', '如何微调模型？', '图像分割方法'];

/* ───────── 主组件 ───────── */
export default function Tutor() {
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const urlTab = urlParams.get('tab') || 'qa';
  const activeTab = urlTab;
  const setActiveTab = (tab) => {
    navigate(`/tutor?tab=${tab}`);
  };

  /* -- Tab1: 智能答疑 -- */
  const [messages, setMessages] = useState([
    { from: 'ai', text: '你好！我是你的AI学习助手 🤖\n\n你可以问我关于深度学习、SAM模型、PyTorch等方面的问题。我会提供文字解答、图解说明和代码示例。' },
  ]);
  const [inputText, setInputText] = useState('');
  const [currentTopic, setCurrentTopic] = useState('深度学习基础');
  const msgEndRef = useRef(null);

  const scrollToBottom = () => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  // 改写后：调用后端 17077 端口的 /api/chat 接口
const sendQuestion = async (text) => {
  if (!text.trim()) return;
  const q = text.trim();

  // 先把用户消息显示到页面
  setMessages((prev) => [...prev, { from: 'user', text: q }]);
  setInputText('');

  try {
    // 调用后端接口（自动转发到 17077 端口）
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: q }]
      })
    });

    const data = await response.json();
    // AI回复消息（保持原有格式，页面直接渲染）
    const aiReply = {
      from: 'ai',
      text: data.content || "抱歉，我暂时无法回答这个问题~"
    };
    setMessages((prev) => [...prev, aiReply]);

  } catch (error) {
    // 请求失败提示
    console.error("后端请求失败：", error);
    setMessages((prev) => [...prev, {
      from: 'ai',
      text: `请求后端服务失败，请检查后端是否启动！`
    }]);
  }
};

  /* -- Tab2: 源码阅读 -- */
  const [selectedFile, setSelectedFile] = useState('model.py');
  const [showExplain, setShowExplain] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentFileData = useMemo(() => {
    for (const folder of FILE_TREE) {
      for (const file of folder.files) {
        if (file.name === selectedFile) return file;
      }
    }
    return null;
  }, [selectedFile]);

  const currentExplanation = EXPLANATIONS[selectedFile] || '暂无说明';
  const currentCodeLines = useMemo(() => currentFileData ? highlightPython(currentFileData.code) : [], [currentFileData]);

  const copyCode = () => {
    if (currentFileData) {
      navigator.clipboard.writeText(currentFileData.code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  /* ───────── 渲染 ───────── */
  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, margin: 0, color: '#1e293b' }}>📖 AI 知识辅导</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>智能答疑 · 源码阅读 · 开源声明</p>
      </div>

      {/* Tab导航 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e2e8f0', paddingBottom: 2 }}>
        {[
          { key: 'qa', label: '🎓 智能答疑' },
          { key: 'code', label: '💻 源码阅读' },
          { key: 'about', label: '📋 关于开源' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none',
              borderBottom: activeTab === t.key ? '3px solid #3b82f6' : '3px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 15,
              fontWeight: activeTab === t.key ? 700 : 400,
              color: activeTab === t.key ? '#3b82f6' : '#64748b',
              marginBottom: -2, transition: 'all .2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab1: 智能答疑 ── */}
      {activeTab === 'qa' && (
        <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 180px)', minHeight: 500 }}>
          {/* 左侧对话区 70% */}
          <div style={{ flex: '0 0 70%', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
            {/* 顶部标题条 */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>🎓 智能辅导</span>
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 10 }}>文字解答 · 图解说明 · 代码示例</span>
              </div>
              <span style={{ fontSize: 11, color: '#22c55e', background: '#f0fdf4', padding: '2px 8px', borderRadius: 6 }}>在线</span>
            </div>

            {/* 消息列表 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#f8fafc' }}>
              {messages.map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '80%' }}>
                    {/* 气泡 */}
                    <div style={{
                      padding: '10px 14px', borderRadius: msg.from === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: msg.from === 'user' ? '#3b82f6' : '#fff',
                      color: msg.from === 'user' ? '#fff' : '#334155',
                      fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                      boxShadow: msg.from === 'user' ? 'none' : '0 1px 2px rgba(0,0,0,.06)',
                    }}>
                      {msg.text}

                      {/* LaTeX公式 */}
                      {msg.latex && (
                        <div style={{
                          marginTop: 10, padding: 10, background: '#f1f5f9', borderRadius: 8,
                          fontFamily: '"Times New Roman", serif', fontStyle: 'italic', color: '#1e293b', textAlign: 'center',
                        }}>
                          {msg.latex}
                        </div>
                      )}

                      {/* 代码块 */}
                      {msg.code && (
                        <div style={{ marginTop: 10, position: 'relative' }}>
                          <div style={{ background: '#1e293b', color: '#e2e8f0', padding: '8px 12px', borderRadius: '8px 8px 0 0', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Python</span>
                            <span style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => { navigator.clipboard.writeText(msg.code); }}>📋</span>
                          </div>
                          <pre style={{ margin: 0, padding: 12, background: '#0f172a', color: '#e2e8f0', borderRadius: '0 0 8px 8px', overflowX: 'auto', fontSize: 12, lineHeight: 1.6, maxHeight: 300, overflowY: 'auto' }}>
                            <code>{msg.code}</code>
                          </pre>
                        </div>
                      )}

                      {/* 表格 */}
                      {msg.table && (
                        <div style={{ marginTop: 10, overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9' }}>
                                {msg.table.headers.map((h, i) => (
                                  <th key={i} style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 700, color: '#475569' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {msg.table.rows.map((row, ri) => (
                                <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  {row.map((cell, ci) => (
                                    <td key={ci} style={{ padding: '8px 10px', color: '#334155' }}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={msgEndRef} />
            </div>

            {/* 快捷问题 */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, overflowX: 'auto' }}>
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendQuestion(q)}
                  style={{ padding: '4px 12px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: 12, fontSize: 12, color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* 输入框 */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendQuestion(inputText)}
                placeholder="输入你的问题..."
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' }}
              />
              <button
                onClick={() => sendQuestion(inputText)}
                style={{ padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 700 }}
              >
                发送
              </button>
            </div>
          </div>

          {/* 右侧辅助面板 30% */}
          <div style={{ flex: '0 0 30%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 知识点卡片 */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>当前主题</h4>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>{currentTopic}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>难度</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#eab308' }}>中级</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>相关度</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>92%</span>
              </div>
              <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                <div style={{ width: '92%', height: '100%', background: '#3b82f6', borderRadius: 3 }} />
              </div>
            </div>

            {/* 相关资源 */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>相关资源</h4>
              {[
                { icon: '📄', title: '官方文档', desc: 'PyTorch Docs' },
                { icon: '📚', title: '推荐教程', desc: '动手学深度学习' },
                { icon: '🔬', title: '论文原文', desc: 'Attention Is All You Need' },
              ].map((r) => (
                <div key={r.title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                  <span>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, color: '#334155' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 学习状态 */}
            <div style={{ background: '#eff6ff', borderRadius: 12, padding: 16, border: '1px solid #bfdbfe' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#1d4ed8' }}>学习状态</h4>
              <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                今日已完成 <strong>3</strong> 个知识点的学习，建议继续深入「注意力机制」章节。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab2: 源码阅读 ── */}
      {activeTab === 'code' && (
        <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 180px)', minHeight: 500 }}>
          {/* 左侧文件树 25% */}
          <div style={{ flex: '0 0 25%', background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#1e293b' }}>📁 项目文件</h3>
            {FILE_TREE.map((folder) => (
              <div key={folder.folder} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6, paddingLeft: 4 }}>📁 {folder.folder}/</div>
                {folder.files.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => { setSelectedFile(file.name); setShowExplain(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px 6px 24px',
                      border: 'none', background: selectedFile === file.name ? '#eff6ff' : 'transparent',
                      borderRadius: 6, fontSize: 12, cursor: 'pointer', color: selectedFile === file.name ? '#3b82f6' : '#64748b',
                      fontWeight: selectedFile === file.name ? 700 : 400, marginBottom: 2,
                    }}
                  >
                    📄 {file.name}
                    {selectedFile === file.name && <span style={{ float: 'right' }}>←</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* 右侧代码区 75% */}
          <div style={{ flex: 1, display: 'flex', background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* 顶部文件名 */}
              <div style={{ padding: '10px 16px', background: '#0f172a', color: '#94a3b8', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📄 {selectedFile}</span>
                <span style={{ fontSize: 11 }}>Python</span>
              </div>

              {/* 代码展示区 */}
              <div style={{ flex: 1, overflow: 'auto', background: '#0f172a', padding: '12px 0' }}>
                {currentCodeLines.map((line, i) => (
                  <div
                    key={i}
                    style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre' }}
                    dangerouslySetInnerHTML={line}
                  />
                ))}
              </div>

              {/* 底部操作栏 */}
              <div style={{ padding: '8px 16px', background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', gap: 12 }}>
                <button
                  onClick={copyCode}
                  style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  📋 {copied ? '已复制' : '复制代码'}
                </button>
                <button
                  onClick={() => setShowExplain(!showExplain)}
                  style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  💡 {showExplain ? '关闭解释' : '查看解释'}
                </button>
              </div>
            </div>

            {/* 解释面板 — 从右侧滑出 */}
            <div style={{
              width: showExplain ? 320 : 0,
              background: '#1e293b',
              borderLeft: '1px solid #334155',
              overflow: 'hidden',
              transition: 'width 0.3s ease',
              flexShrink: 0,
            }}>
              <div style={{ padding: 16, minWidth: 288 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#e2e8f0' }}>💡 代码注释说明</h4>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {currentExplanation}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab3: 关于开源 ── */}
      {activeTab === 'about' && (
        <div>
          {/* 顶部说明卡片 */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1e293b' }}>📋 开源声明</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
              本系统使用了以下开源项目和前沿AI工具。我们感谢开源社区的所有贡献者，
              他们的工作让AI教育变得更加普惠和高效。
            </p>
          </div>

          {/* 项目卡片网格 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
            {OPEN_SOURCE_ITEMS.map((item) => (
              <div key={item.name} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 28 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{item.name}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 4,
                      background: item.license.includes('MIT') ? '#f0fdf4' : item.license.includes('Apache') ? '#eff6ff' : item.license.includes('BSD') ? '#fefce8' : '#f8fafc',
                      color: item.license.includes('MIT') ? '#22c55e' : item.license.includes('Apache') ? '#3b82f6' : item.license.includes('BSD') ? '#eab308' : '#64748b',
                    }}>
                      {item.license}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{item.desc}</p>
                  <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>
                    {item.link} →
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* 底部防幻觉说明 */}
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#1e293b' }}>🔒 内容安全与质量保障</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {SAFETY_CARDS.map((card) => (
                <div key={card.title} style={{ background: '#fff', borderRadius: 10, padding: 16, textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{card.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>{card.title}</div>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
