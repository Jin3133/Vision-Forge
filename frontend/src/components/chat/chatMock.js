// src/components/chat/chatMock.js

/**
 * 是否启用 Mock 流式（默认 true，方便本地无后端体验）
 * 后端 /api/chat/stream 就绪后改为 false
 */
export const USE_MOCK_STREAM = true;

/* ──────────── 知识库（与原 QA_PAIRS 对齐） ──────────── */
const KNOWLEDGE = {
  '注意力机制': {
    keyword: '注意力',
    answer: `**注意力机制（Attention Mechanism）** 是深度学习中模拟人类视觉注意力的核心技术，它允许模型在处理序列数据时动态地关注输入的不同部分。

### 核心思想
通过计算 Query 和 Key 的相似度来加权聚合 Value，从而提取最相关的信息。

### 数学公式

$$
\\mathrm{Attention}(Q, K, V) = \\mathrm{softmax}\\!\\left( \\frac{QK^{T}}{\\sqrt{d_k}} \\right) V
$$

其中 \\( d_k \\) 是 Key 向量的维度，\\(\\sqrt{d_k}\\) 用于防止点积过大导致 softmax 梯度消失。

### 关键优势
- **长距离依赖**：相比 RNN，能直接建模任意距离的关系
- **并行计算**：不像 RNN 必须顺序处理
- **可解释性**：注意力权重可可视化`,
    thinking: `用户问到"注意力机制"。需要从直觉 → 数学 → 代码 → 应用 四个层次回答。
直觉层用一句话给出比喻，再上公式，最后给一个 Self-Attention 的 PyTorch 实现片段，让用户能跑起来。`,
    code: `import torch
import torch.nn as nn

class SelfAttention(nn.Module):
    def __init__(self, embed_size, heads):
        super().__init__()
        self.embed_size = embed_size
        self.heads = heads
        self.head_dim = embed_size // heads

        self.values = nn.Linear(embed_size, embed_size)
        self.keys   = nn.Linear(embed_size, embed_size)
        self.queries = nn.Linear(embed_size, embed_size)
        self.fc_out  = nn.Linear(embed_size, embed_size)

    def forward(self, x):
        N, seq_length, _ = x.shape
        V = self.values(x).view(N, seq_length, self.heads, self.head_dim)
        K = self.keys(x).view(N, seq_length, self.heads, self.head_dim)
        Q = self.queries(x).view(N, seq_length, self.heads, self.head_dim)

        energy    = torch.einsum('nqhd,nkhd->nhqk', [Q, K])
        attention = torch.softmax(energy / (self.head_dim ** 0.5), dim=3)
        out       = torch.einsum('nhql,nlhd->nqhd', [attention, V])
        return self.fc_out(out.reshape(N, seq_length, self.embed_size))`,
    mermaid: `graph LR
    A[输入序列 X] --> B[线性投影]
    B --> Q[Query Q]
    B --> K[Key K]
    B --> V[Value V]
    Q --> D[相似度 QK^T / √d_k]
    K --> D
    D --> E[Softmax]
    E --> F[加权 V]
    V --> F
    F --> G[输出]`,
  },

  'sam': {
    keyword: 'sam',
    answer: `**SAM（Segment Anything Model）** 是 Meta 发布的图像分割基础模型，核心架构包含三个组件：

| 组件 | 作用 | 关键点 |
| --- | --- | --- |
| 图像编码器 | 提取图像特征 | ViT，每张图编码一次 |
| 提示编码器 | 处理用户提示 | 点 / 框 / 掩码 / 文本 |
| 掩码解码器 | 生成分割掩码 | 轻量 Transformer + IoU 头 |

### 训练数据
采用了"提示分割"范式，通过 **1100 万张图像 + 11 亿个掩码** 进行大规模训练，因此具有很强的零样本迁移能力。`,
    thinking: `用户问 SAM 原理。给出"三件套"框架图，再补一张架构示意 mermaid，让结构一目了然。`,
    code: `class SAM(nn.Module):
    def __init__(self, image_encoder, prompt_encoder, mask_decoder):
        super().__init__()
        self.image_encoder = image_encoder      # ViT backbone
        self.prompt_encoder = prompt_encoder    # 点/框/文本编码
        self.mask_decoder   = mask_decoder      # 轻量化解码器

    def forward(self, image, prompt):
        image_features      = self.image_encoder(image)
        prompt_embeddings   = self.prompt_encoder(prompt)
        masks, scores       = self.mask_decoder(image_features, prompt_embeddings)
        return masks, scores`,
    mermaid: `flowchart TB
    subgraph ENC[图像编码器 ViT]
      A[1024x1024 图像] --> B[Patch Embed]
      B --> C[12 x Transformer Block]
      C --> D[Neck: 768->256]
    end
    subgraph PE[提示编码器]
      E[点 / 框 / 掩码] --> F[Sparse + Dense Embedding]
    end
    ENC --> G[Mask Decoder]
    PE --> G
    G --> H[多个候选掩码 + IoU]`,
  },

  'finetune': {
    keyword: '微调',
    answer: `模型微调（Fine-tuning）是在预训练模型基础上，针对特定下游任务进行适配的过程。常用方法包括：

1. **全参数微调**：训练所有参数，适合数据充足的场景
2. **LoRA**：低秩适配，只训练少量参数，高效且节省显存
3. **Prompt Tuning**：通过软提示引导模型，适合少样本场景
4. **Adapter**：在层间插入适配器模块，保持主干冻结

推荐流程：
\`\`\`
加载预训练权重 → 冻结部分层 → 替换分类头 → 小学习率训练 → 评估验证
\`\`\``,
    thinking: `用户问微调。给出主流方法对比 + LoRA 代码片段，因为 LoRA 是目前最常用的 PEFT 方案。`,
    code: `from peft import LoraConfig, get_peft_model

lora_config = LoraConfig(
    r=16, lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="FEATURE_EXTRACTION",
)

model = get_peft_model(base_model, lora_config)`,
    mermaid: '',
  },

  'segmentation': {
    keyword: '分割',
    answer: `图像分割方法可以分为以下几类：

| 方法 | 代表模型 | 特点 | 适用场景 |
| --- | --- | --- | --- |
| 语义分割 | DeepLab / PSPNet | 像素级分类，同类物体不分个体 | 场景理解 |
| 实例分割 | Mask R-CNN | 区分不同个体，逐实例掩码 | 物体检测+分割 |
| 全景分割 | PanopticFPN | 语义+实例的统一分割 | 完整场景解析 |
| 交互式分割 | SAM | 用户提示驱动，零样本能力 | 任意图像分割 |
| 医学图像分割 | UNet / nnU-Net | U 型编码解码，细节保留 | 病灶/器官分割 |`,
    thinking: `用户问"图像分割方法"。直接给一张对比表，比文字描述更直观。`,
    code: '',
    mermaid: '',
  },
};

const DEFAULT_ANSWER = `这是一个关于 **"**{topic}**"** 的简要回答：

> 这里只是占位说明。真实接入后端后，会返回完整的 Markdown 内容，包含文字、代码、公式与流程图。

### 你可以进一步尝试
1. 让 AI **举例说明**
2. 让 AI **继续解释**某个细节
3. 让 AI **生成练习** 巩固知识
4. 让 AI **生成思维导图** 梳理结构

\`\`\`python
# 示例代码块
def hello(topic: str):
    print(f"Hello, {topic}!")
\`\`\`

$$
E = mc^2
\`\`\`
`;

const SHORTCUT_REPLIES = {
  '继续解释': (topic) => ({
    thinking: `用户希望"继续解释"。我针对上一个主题，再深入一层细节——例如公式推导 / 训练 trick / 常见误区。`,
    text: `好的，我们继续深入 **${topic}** 这一主题。

### 上次没展开的关键点

1. **数值稳定性**：温度参数 \\(\\tau\\) 选择过大会导致概率分布过于平滑，过小则过拟合
2. **计算复杂度**：标准自注意力的复杂度是 \\(O(n^2 d)\\)，长序列下代价高昂
3. **常见变体**：
   - Multi-Head Attention（并行多视角）
   - Flash Attention（IO 优化）
   - Linear Attention（线性复杂度）

\`\`\`python
# Flash Attention 伪代码
for block in q_blocks:
    scores = block @ K.T * scale
    weights = softmax(scores)
    out += weights @ V_block
\`\`\`

如果你感兴趣，我可以再展开 **Flash Attention 的分块计算原理**。`,
  }),
  '举例说明': (topic) => ({
    thinking: `用户希望"举例说明"。给一个具体场景 + 完整可运行的小例子，把抽象概念落到代码上。`,
    text: `好的，举一个具体例子。我们以 **机器翻译** 中"我爱自然语言处理" → "I love NLP" 为例：

| 步骤 | 输入 | 输出 |
| --- | --- | --- |
| Tokenize | 我爱 NLP | ['我','爱','NLP'] |
| Embedding | tokens | 768 维向量 |
| Self-Attention | 句子向量 | 加权后的上下文向量 |
| Decoder | 上下文向量 | 'I love NLP' |

### 完整代码

\`\`\`python
from transformers import MarianMTModel, MarianTokenizer

model_name = "Helsinki-NLP/opus-mt-zh-en"
tok = MarianTokenizer.from_pretrained(model_name)
model = MarianMTModel.from_pretrained(model_name)

zh = "我爱自然语言处理"
batch = tok([zh], return_tensors="pt", padding=True)
gen = model.generate(**batch)
print(tok.decode(gen[0], skip_special_tokens=True))
# => "I love natural language processing."
\`\`\``,
  }),
  '生成练习': (topic) => ({
    thinking: `用户希望"生成练习"。给 3 道由浅入深的题目，附参考答案与知识点对应，方便自测。`,
    text: `好的，围绕 **${topic}** 给你三道练习题，由易到难：

### 练习 1（基础）
Q: Self-Attention 中除以 \\(\\sqrt{d_k}\\) 的目的是什么？

<details>
<summary>参考答案</summary>

防止 Q·K 点积过大导致 softmax 梯度饱和（接近 one-hot），同时保留对数值差异的敏感性。
</details>

### 练习 2（进阶）
Q: Multi-Head Attention 中，"头"的数量是不是越多越好？为什么？

<details>
<summary>参考答案</summary>

不是。头数过多会导致每个头的维度 \\(d_k\\) 减小，表达能力下降；同时计算成本随头数线性增加。经验上 \\(d_k \\geq 64\\) 比较合适。
</details>

### 练习 3（实战）
Q: 给定一段 512 token 的文本，使用标准 Self-Attention 的显存占用与序列长度的关系是什么？如何优化？

<details>
<summary>参考答案</summary>

标准实现复杂度 \\(O(n^2)\\)，512 token 的注意力矩阵约为 1MB（fp32），序列越长增长越快。优化方法：
- Flash Attention（分块计算 + 重计算）
- Linear Attention（核函数近似）
- 稀疏 / 滑动窗口注意力
</details>`,
  }),
  '生成思维导图': (topic) => ({
    thinking: `用户希望"生成思维导图"。给一张 mermaid mindmap，结构清晰、可视化友好。`,
    text: `好的，下面是关于 **${topic}** 的思维导图（可双击节点展开）：

\`\`\`mermaid
mindmap
  root((${topic}))
    概念
      定义
      核心思想
      发展历史
    数学
      公式推导
      数值稳定性
      复杂度分析
    实现
      PyTorch
      TensorFlow
      HuggingFace
    应用
      NLP
      视觉
      多模态
    进阶
      变体
      优化技巧
      最新论文
\`\`\`

> 提示：思维导图节点可双击折叠/展开。如果想要更具体的子主题（例如把"应用"展开成 NLP 实战案例），跟我说一声。`,
  }),
};

/* ──────────── 匹配逻辑 ──────────── */
function matchKnowledge(text) {
  const t = text.toLowerCase();
  for (const [_, k] of Object.entries(KNOWLEDGE)) {
    if (t.includes(k.keyword)) return k;
  }
  // 兜底：返回注意力机制
  return KNOWLEDGE['注意力机制'];
}

function matchShortcut(text) {
  for (const [key, fn] of Object.entries(SHORTCUT_REPLIES)) {
    if (text.includes(key)) return { key, fn };
  }
  return null;
}

/* ──────────── 流式生成 ──────────── */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Mock 流式对话
 * - 先推送"思考过程"片段
 * - 再推送"正文"片段
 * - 全部结束调用 onDone
 *
 * 返回 { abort() }
 */
export async function mockStreamChat(
  { messages },
  { onDelta, onThinking, onDone, onError, abortSignal } = {},
) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  // 1) 思考阶段
  let knowledge = matchKnowledge(lastUser);
  const shortcut = matchShortcut(lastUser);

  // 快捷问题：复用上一条 AI 的主题（如有）
  let topic = lastUser;
  if (shortcut) {
    // 找上一条用户消息作为"上下文主题"
    const userMsgs = messages.filter((m) => m.role === 'user');
    const prevUser = userMsgs[userMsgs.length - 2]?.content || lastUser;
    topic = prevUser;
    knowledge = matchKnowledge(prevUser);
    const rep = shortcut.fn(topic);
    knowledge = { ...knowledge, ...rep };
  }

  const thinkingText = knowledge.thinking || '正在为你整理思路…';
  const mainText = (knowledge.answer || '').replace(/\{topic\}/g, topic);

  try {
    // 思考阶段
    if (onThinking && thinkingText) {
      await emitChars(thinkingText, onThinking, abortSignal, 12, 18);
    }
    await sleep(300, abortSignal);

    // 正文阶段
    if (onDelta && mainText) {
      await emitChars(mainText, onDelta, abortSignal, 8, 18);
    }

    // 代码块
    if (knowledge.code) {
      const codeBlock = `\n\n\`\`\`python\n${knowledge.code}\n\`\`\`\n`;
      await emitChars(codeBlock, onDelta, abortSignal, 4, 10);
    }

    // Mermaid 流程图
    if (knowledge.mermaid) {
      const mBlock = `\n\n\`\`\`mermaid\n${knowledge.mermaid}\n\`\`\`\n`;
      await emitChars(mBlock, onDelta, abortSignal, 6, 14);
    }

    onDone?.(mainText);
  } catch (e) {
    if (e?.name !== 'AbortError') onError?.(e);
  }

  return { abort: () => abortSignal?.abort?.() };
}

async function emitChars(text, cb, signal, minDelay = 8, maxDelay = 18) {
  // 智能分片：中文 / 英文 / 标点 单独切，避免把代码块搞乱
  // 这里用一个简单策略：按 1~3 个字符一帧
  let i = 0;
  while (i < text.length) {
    if (signal?.aborted) {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    }
    // 对 ``` 围栏代码块整段推，避免逐字符渲染破坏语法
    if (text.slice(i, i + 3) === '```') {
      const end = text.indexOf('```', i + 3);
      const stop = end === -1 ? text.length : end + 3;
      const block = text.slice(i, stop);
      cb?.(block);
      i = stop;
      await sleep(40, signal);
      continue;
    }
    // 数学公式整段推
    if (text[i] === '$') {
      const isBlock = text[i + 1] === '$';
      const endDelim = isBlock ? '$$' : '$';
      const end = text.indexOf(endDelim, i + endDelim.length);
      const stop = end === -1 ? text.length : end + endDelim.length;
      cb?.(text.slice(i, stop));
      i = stop;
      await sleep(30, signal);
      continue;
    }
    const chunkSize = 1 + Math.floor(Math.random() * 2);
    cb?.(text.slice(i, i + chunkSize));
    i += chunkSize;
    await sleep(minDelay + Math.random() * (maxDelay - minDelay), signal);
  }
}