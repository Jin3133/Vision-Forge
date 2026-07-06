import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLearn } from '../LearnContext.jsx'

import { useToasts, ToastStack } from '../components/resources/Toast'
import { ResourceCardSkeleton, ResourceGridSkeleton, ModuleContentSkeleton } from '../components/resources/Skeleton'
import { EmptyState } from '../components/resources/EmptyState'
import { MarkdownPreview } from '../components/resources/MarkdownPreview'
import { ShareModal } from '../components/resources/ShareModal'
import { PdfPreviewModal } from '../components/resources/PdfPreviewModal'
import { fetchFavorites, toggleFavorite, isFavorited } from '../api/favorites.js'

// ==================== 预设资源数据 ====================
const defaultResources = [
  { id: 1, title: 'SAM模型从入门到实战', cate: 'cv', progress: 20, collect: false, desc: '从零掌握视觉分割模型', author: '算法教研智能体', time: '4.5小时', type: '讲义', emoji: '📚', gradient: 'linear-gradient(135deg,#3b82f6,#60a5fa)' },
  { id: 2, title: '计算机视觉思维导图', cate: 'cv', progress: 0, collect: false, desc: '知识体系全景图', author: '资源生成智能体', time: '1小时', type: '思维导图', emoji: '🗺️', gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa)' },
  { id: 3, title: 'PyTorch深度学习基础', cate: 'code', progress: 50, collect: true, desc: '深度学习框架快速入门', author: '算法教研智能体', time: '6小时', type: '实操案例', emoji: '💻', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
  { id: 4, title: '注意力机制详解', cate: 'theory', progress: 80, collect: true, desc: '模型核心原理解析', author: '算法教研智能体', time: '2.5小时', type: '讲义', emoji: '📖', gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)' },
  { id: 5, title: '遥感图像分割实战', cate: 'project', progress: 0, collect: false, desc: '行业案例手把手教学', author: '架构引导智能体', time: '3小时', type: '实操案例', emoji: '🚀', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
  { id: 6, title: 'SAM模型练习题集', cate: 'quiz', progress: 0, collect: false, desc: '巩固知识点', author: '学情评估智能体', time: '1.5小时', type: '练习题', emoji: '📝', gradient: 'linear-gradient(135deg,#ef4444,#f87171)' },
  { id: 7, title: 'Transformer拓展阅读', cate: 'theory', progress: 0, collect: false, desc: '经典论文与最新进展', author: '算法教研智能体', time: '2小时', type: '拓展阅读', emoji: '📰', gradient: 'linear-gradient(135deg,#06b6d4,#22d3ee)' },
  { id: 8, title: '图像分割PPT大纲', cate: 'cv', progress: 0, collect: false, desc: '课件结构一键生成', author: '资源生成智能体', time: '30分钟', type: 'PPT大纲', emoji: '📊', gradient: 'linear-gradient(135deg,#ec4899,#f472b6)' },
]

const cateMap = {
  all: '全部',
  cv: '计算机视觉',
  code: '编程开发',
  theory: '理论基础',
  project: '项目实战',
  quiz: '练习题',
}

const resourceTypes = ['讲义', '思维导图', '练习题', '实操案例', '拓展阅读', 'PPT大纲']

const typeEmoji = {
  '讲义': '📚',
  '思维导图': '🗺️',
  '练习题': '📝',
  '实操案例': '💻',
  '拓展阅读': '📰',
  'PPT大纲': '📊',
}

// ==================== Markdown 渲染组件 ====================
const MarkdownCard = ({ content, title }) => {
  const lines = content.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // 标题
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '16px 0 10px', borderBottom: '2px solid #e2e8f0', paddingBottom: 6 }}>{line.slice(2)}</h1>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontSize: 16, fontWeight: 700, color: '#334155', margin: '14px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 4, height: 16, background: '#3b82f6', borderRadius: 2 }}></span>{line.slice(3)}
      </h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontSize: 14, fontWeight: 600, color: '#475569', margin: '10px 0 6px' }}>{line.slice(4)}</h3>)
    }
    // 代码块
    else if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      let code = ''
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        code += lines[i] + '\n'
        i++
      }
      elements.push(
        <div key={`code-${i}`} style={{ margin: '10px 0', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          {lang && <div style={{ background: '#f1f5f9', padding: '4px 12px', fontSize: 11, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{lang}</div>}
          <pre style={{ background: '#f8fafc', padding: '12px', fontSize: 12, overflow: 'auto', margin: 0, color: '#334155', lineHeight: 1.6 }}><code>{code}</code></pre>
        </div>
      )
    }
    // 表格
    else if (line.startsWith('|') && lines[i + 1]?.includes('|---')) {
      const headerCells = line.split('|').filter(c => c.trim()).map(c => c.trim())
      i += 2
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i].split('|').filter(c => c.trim()).map(c => c.trim()))
        i++
      }
      i--
      elements.push(
        <table key={`table-${i}`} style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0', fontSize: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <thead><tr style={{ background: '#f1f5f9' }}>
            {headerCells.map((h, hi) => <th key={hi} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}
          </tr></thead>
          <tbody>{rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
              {row.map((c, ci) => <td key={ci} style={{ padding: '8px 10px', color: '#334155', borderBottom: '1px solid #f1f5f9' }}>{c}</td>)}
            </tr>
          ))}</tbody>
        </table>
      )
    }
    // 列表
    else if (line.match(/^\s*[-*+]\s/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\s*[-*+]\s/)) {
        const text = lines[i].replace(/^\s*[-*+]\s/, '')
        // 粗体
        const formatted = text.split(/(\*\*.*?\*\*)/).map((p, pi) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={pi} style={{ color: '#1e293b' }}>{p.slice(2, -2)}</strong>
            : p
        )
        items.push(<li key={i} style={{ marginBottom: 4, color: '#475569', lineHeight: 1.6 }}>{formatted}</li>)
        i++
      }
      i--
      elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: 20, margin: '6px 0' }}>{items}</ul>)
    }
    // 有序列表
    else if (line.match(/^\s*\d+\.\s/)) {
      const items = []
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s/)) {
        const text = lines[i].replace(/^\s*\d+\.\s/, '')
        const formatted = text.split(/(\*\*.*?\*\*)/).map((p, pi) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={pi} style={{ color: '#1e293b' }}>{p.slice(2, -2)}</strong>
            : p
        )
        items.push(<li key={i} style={{ marginBottom: 4, color: '#475569', lineHeight: 1.6 }}>{formatted}</li>)
        i++
      }
      i--
      elements.push(<ol key={`ol-${i}`} style={{ paddingLeft: 20, margin: '6px 0' }}>{items}</ol>)
    }
    // 引用
    else if (line.startsWith('>')) {
      elements.push(
        <blockquote key={i} style={{
          borderLeft: '3px solid #3b82f6', margin: '8px 0', padding: '8px 12px',
          background: '#eff6ff', borderRadius: '0 8px 8px 0', color: '#475569', fontSize: 12, lineHeight: 1.6,
        }}>{line.slice(1).trim()}</blockquote>
      )
    }
    // 普通段落（非空）
    else if (line.trim()) {
      const formatted = line.split(/(\*\*.*?\*\*)/).map((p, pi) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={pi} style={{ color: '#1e293b' }}>{p.slice(2, -2)}</strong>
          : p
      )
      elements.push(<p key={i} style={{ margin: '6px 0', color: '#475569', lineHeight: 1.7, fontSize: 13 }}>{formatted}</p>)
    }
    i++
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0', maxHeight: 500, overflow: 'auto' }}>
      {elements}
    </div>
  )
}

// ==================== 生成内容模拟 ====================
const generateMockContent = (resourceType, userPrompt) => {
  const templates = {
    '讲义': `# ${userPrompt} 学习讲义

## 一、学习目标
- 掌握${userPrompt}的**核心概念**
- 理解${userPrompt}的**应用场景**
- 能够独立完成相关实践

## 二、知识点梳理
1. **基础概念**：深入理解${userPrompt}的基本原理
2. **核心算法**：掌握关键算法实现步骤
3. **实践应用**：通过案例巩固知识

## 三、核心代码示例
\`\`\`python
import torch
import torch.nn as nn

# ${userPrompt}核心实现
def core_algorithm(input_data):
    # 步骤1: 数据预处理
    processed = preprocess(input_data)
    # 步骤2: 特征提取
    features = extract_features(processed)
    # 步骤3: 模型推理
    output = model_inference(features)
    return output
\`\`\`

## 四、学习路径
> 基础理论 → 代码实践 → 项目实战 → 总结提升

## 五、推荐资源
- 📖 推荐论文：相关经典文献阅读
- 💻 代码仓库：GitHub开源项目参考
- 🎥 视频教程：配套讲解视频`,

    '思维导图': `# ${userPrompt} 知识思维导图

## 核心知识架构

| 模块 | 子主题 | 重要程度 |
|------|--------|----------|
| 基础概念 | 定义与发展历程 | ★★★ |
| 核心原理 | 算法机制与数学模型 | ★★★★★ |
| 应用场景 | 图像识别、目标检测 | ★★★★ |
| 实践工具 | PyTorch/TensorFlow实现 | ★★★★ |
| 进阶方向 | 模型优化与部署落地 | ★★★ |

## 知识节点关系

digraph ${userPrompt} {
  根节点 -> 基础概念
  根节点 -> 核心原理
  根节点 -> 应用场景
  核心原理 -> 实践工具
  应用场景 -> 进阶方向
}

## 学习建议
> 建议按**基础→原理→实践→进阶**的顺序系统学习`,

    '练习题': `# ${userPrompt} 练习题

## 一、选择题
1. 关于${userPrompt}的描述，正确的是？
   - A. 仅适用于图像分类任务
   - B. 核心思想是注意力机制
   - C. 需要大量标注数据训练
   - D. 以上都正确

2. ${userPrompt}的核心创新点是？
   - A. 提出新的损失函数
   - B. 引入多尺度特征融合
   - C. 使用Transformer架构
   - D. 实现零样本泛化

## 二、简答题
1. 简述${userPrompt}的主要工作原理
2. ${userPrompt}相比传统方法有哪些优缺点？

## 三、编程实践题
\`\`\`python
# 任务：完成${userPrompt}的核心函数
def implement_model(input_tensor):
    """
    实现${userPrompt}的核心逻辑
    Args:
        input_tensor: 输入张量 [B, C, H, W]
    Returns:
        output: 输出结果
    """
    # 请补全代码
    pass
\`\`\`

## 参考答案要点
> 关注模型的**输入输出格式**、**核心参数**和**推理流程**`,

    '实操案例': `# ${userPrompt} 实操案例

## 项目背景
本案例将带你完成一个基于${userPrompt}的实际项目，从环境配置到模型部署全流程。

## 环境配置
\`\`\`bash
pip install torch torchvision
pip install opencv-python numpy matplotlib
\`\`\`

## 核心代码
\`\`\`python
import torch
import torch.nn as nn
import cv2
import numpy as np

class ${userPrompt.replace(/\s/g, '')}Model(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Conv2d(3, 64, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
        )
        self.classifier = nn.Linear(64 * 14 * 14, num_classes)

    def forward(self, x):
        features = self.backbone(x)
        features = features.view(features.size(0), -1)
        return self.classifier(features)

# 训练循环
model = ${userPrompt.replace(/\s/g, '')}Model()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
\`\`\`

## 运行结果分析
| 指标 | 数值 | 说明 |
|------|------|------|
| 准确率 | 92.5% | 验证集表现 |
| 推理速度 | 45ms/张 | GPU环境下 |
| 模型大小 | 128MB | 可进一步优化 |

## 总结
> 通过本案例，你掌握了${userPrompt}的完整应用流程`,

    '拓展阅读': `# ${userPrompt} 拓展阅读

## 经典论文
1. **《${userPrompt}: A Comprehensive Survey》**
   - 发表时间：2023
   - 核心贡献：系统综述${userPrompt}的技术发展
   - 阅读建议：重点看**Related Work**部分

2. **《Advanced Techniques in ${userPrompt}》**
   - 发表时间：2024
   - 核心贡献：提出改进算法，精度提升5%

## 最新进展
> 2024年${userPrompt}领域的重要突破：
- 新的训练策略降低计算成本30%
- 多模态融合成为研究热点
- 轻量化部署方案日益成熟

## 推荐阅读顺序
\`\`\`
入门论文 → 核心方法论文 → 最新进展论文 → 代码实践
\`\`\`

## 相关资源
| 类型 | 链接 | 说明 |
|------|------|------|
| 官方仓库 | github.com/example/${userPrompt} | 开源实现 |
| 教程博客 | example.com/blog | 中文讲解 |
| 视频课程 | example.com/course | 配套视频 |`,

    'PPT大纲': `# ${userPrompt} PPT大纲

## 第1部分：引言（2页）
- ${userPrompt}的背景与意义
- 本课学习目标

## 第2部分：基础概念（4页）
- 核心定义与术语
- 发展历程时间线
- 与传统方法的对比

## 第3部分：核心原理（6页）
- 算法整体流程图
- 关键模块详解
- 数学公式推导
- 代码片段展示

## 第4部分：实验与应用（4页）
- 实验设置与数据集
- 定量结果表格
- 可视化效果展示

## 第5部分：总结与展望（2页）
- 关键技术要点回顾
- 未来研究方向
- 课后思考题目

## PPT制作建议
> - 每页控制在**3-5个要点**
> - 多用**图表**代替文字
> - 代码用**高亮主题**展示`,
  }
  return templates[resourceType] || templates['讲义']
}

// ==================== 学习包生成器 ====================
// 围绕用户目标 + 易错点，输出"一整套课程"：讲义 + 思维导图 + 练习任务 + 实验案例 + 源码阅读 + 推荐论文
const generateLearningPack = (goal, customGoal, weakTopics) => {
  const topic = goal === '自定义目标' ? (customGoal || '自定义学习') : (goal || '视觉模型')
  const weak = (weakTopics && weakTopics.length) ? weakTopics.join('、') : '暂无'
  return {
    title: `${topic} · 专属学习包`,
    summary: `围绕「${topic}」定制的端到端学习路径，含讲义、思维导图、练习、实验、源码、论文 6 大模块。`,
    modules: [
      {
        icon: '📚', name: '讲义模块', desc: `${topic} 核心概念与原理速通（约 30 min）`,
        content: `# ${topic} · 学习讲义

## 一、学习目标
- 掌握 **${topic}** 的核心概念与数学原理
- 能够独立完成一个最小可运行示例
- 形成对该方向的「知识地图」位置感

## 二、知识点大纲
1. **基础概念**：定义与发展历程
2. **核心算法**：${topic} 的关键步骤拆解
3. **实践路径**：从 demo 到生产环境的进阶

## 三、关键公式与代码
\`\`\`python
import torch
import torch.nn as nn

class ${topic.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')}Mini(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(nn.Conv2d(3, 16, 3, padding=1), nn.ReLU())
        self.decoder = nn.Sequential(nn.Conv2d(16, 3, 3, padding=1), nn.Sigmoid())

    def forward(self, x):
        return self.decoder(self.encoder(x))
\`\`\`

## 四、针对你的薄弱点
你最近的易错点：**${weak}**
建议重点阅读本章「${weak}」对应小节，再去「源码阅读」模块对照实现。
`,
      },
      {
        icon: '🗺️', name: '思维导图', desc: '5 大主题 × 12 节点的知识骨架',
        content: `# ${topic} · 知识思维导图

| 模块 | 子主题 | 重要程度 |
|------|--------|----------|
| 基础概念 | 定义与发展 | ★★★ |
| 核心原理 | ${topic} 算法机制 | ★★★★★ |
| 实践工具 | PyTorch / TensorFlow | ★★★★ |
| 应用场景 | 1+N 跨学科落地 | ★★★★ |
| 进阶方向 | 微调 / 蒸馏 / 部署 | ★★★ |

\`\`\`
${topic}
├─ 基础概念 ─┬─ 定义
│             └─ 发展历程
├─ 核心原理 ─┬─ 算法机制
│             └─ 数学模型
├─ 实践工具 ─┬─ PyTorch
│             └─ TensorFlow
└─ 进阶方向 ─┬─ 微调
              └─ 部署
\`\`\`
`,
      },
      {
        icon: '📝', name: '练习任务', desc: '4 道由 AI 导师出的诊断题（含易错点）',
        content: `# ${topic} · 练习任务

## 选择题（针对易错点：${weak}）
1. 关于 **${topic}** 的描述，下列正确的是？
   - A. 仅适用于图像分类
   - B. 核心思想是注意力机制  ← 重点
   - C. 不需要标注数据
   - D. 与 Transformer 无关

2. 在该方向中，最容易出错的一步是？
   - A. 数据增强
   - B. 学习率设置
   - C. 损失函数选择
   - D. 推理后处理

## 实操任务
- [ ] 复现官方 README 中的最小 demo
- [ ] 在自己的数据集上跑通
- [ ] 提交到「模型工坊」让评估智能体打分
`,
      },
      {
        icon: '💻', name: '实验案例', desc: '完整端到端项目（含数据集 / 训练 / 评估）',
        content: `# ${topic} · 实验案例

## 项目结构
\`\`\`
project/
├─ data/          # 数据集
├─ models/        # 模型定义
├─ train.py       # 训练脚本
├─ eval.py        # 评估脚本
└─ README.md
\`\`\`

## 训练核心
\`\`\`python
model = ${topic.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')}Mini()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
for epoch in range(10):
    for x, y in dataloader:
        loss = criterion(model(x), y)
        loss.backward()
        optimizer.step()
\`\`\`

## 评估指标
| 指标 | 目标 | 你的结果 |
|------|------|----------|
| 准确率 | > 85% | 待填写 |
| 推理速度 | < 50ms | 待填写 |
| 模型大小 | < 200MB | 待填写 |
`,
      },
      {
        icon: '💻', name: '源码阅读路线', desc: '3-5 个关键文件，按依赖顺序阅读',
        content: `# ${topic} · 源码阅读路线

## 推荐阅读顺序
1. **model.py** — 顶层入口，看懂 forward 数据流
2. **encoder.py** — 特征提取核心
3. **decoder.py** — 输出重建
4. **utils.py** — 数据预处理与损失函数

## 关键问题（带着问题去读）
- 模型如何处理变长输入？
- 注意力机制的 Q/K/V 维度怎么对齐？
- 训练和推理的 forward 有何不同？
`,
      },
      {
        icon: '📰', name: '推荐论文', desc: '经典 + 最新，4 篇代表论文',
        content: `# ${topic} · 推荐论文

## 经典论文
1. **《Attention Is All You Need》** — Transformer 奠基
2. **《Segment Anything》** — SAM 原论文

## 最新进展
3. **《${topic} 综述 2024》** — 把握前沿
4. **《多模态 ${topic}》** — 跨模态方向

## 阅读建议
- 第一遍：只看 abstract + 4 张图
- 第二遍：对照代码看公式
- 第三遍：自己复现最小版本
`,
      },
    ],
  }
}

// ==================== 今日推荐（按错点推送） ====================
const buildTodayRecommend = (weakTopics) => {
  const map = {
    'Attention 参数理解': [
      { title: 'Transformer 可视化讲解', tag: '视频', color: '#3b82f6' },
      { title: 'ViT 源码解析', tag: '源码', color: '#10b981' },
      { title: 'Attention 实验案例', tag: '案例', color: '#f59e0b' },
    ],
    'Encoder': [
      { title: '图像编码器全景', tag: '讲义', color: '#3b82f6' },
      { title: 'ViT 论文精读', tag: '论文', color: '#8b5cf6' },
    ],
    'Decoder': [
      { title: 'Mask Decoder 工作流', tag: '讲义', color: '#3b82f6' },
      { title: '从零搭建 Decoder', tag: '案例', color: '#f59e0b' },
    ],
  }
  const items = []
  weakTopics.forEach(t => {
    if (map[t]) items.push(...map[t])
  })
  // 默认兜底
  if (!items.length) {
    items.push(
      { title: 'CV 入门路线图', tag: '讲义', color: '#3b82f6' },
      { title: 'PyTorch 基础 30 题', tag: '练习', color: '#10b981' },
    )
  }
  return items
}

// ==================== 主组件 ====================
export default function Resources() {
  const location = useLocation()
  const navigate = useNavigate()
  const learn = useLearn()
  const urlParams = new URLSearchParams(location.search)
  const urlTab = urlParams.get('tab') || 'recommend'
  /* 兼容旧 courses/library → recommend */
  const activeTab = urlTab === 'courses' || urlTab === 'library' ? 'recommend' : urlTab
  const setActiveTab = (tab) => {
    const tabMap = { 'recommend': 'recommend', 'generate': 'generate', 'favorites': 'favorites' }
    navigate(`/resources?tab=${tabMap[tab] || tab}`)
  }
  const [cateTab, setCateTab] = useState('all')
  const [search, setSearch] = useState('')
  const [favorites, setFavorites] = useState([])

  /* 从统一收藏 store 同步"资源"分类下的 id 集合（用于卡片显示星标状态） */
  useEffect(() => {
    let alive = true
    const sync = async () => {
      const res = await fetchFavorites({ category: 'resource' })
      if (!alive) return
      if (res?.code === 0) {
        setFavorites((res.data || []).map((f) => f.id))
      }
    }
    sync()
    /* 跨 Tab 同步：监听 localStorage 变化（个人中心改动会触发） */
    const onStorage = (e) => {
      if (e.key === 'vf_favorites_v2') sync()
    }
    window.addEventListener('storage', onStorage)
    return () => { alive = false; window.removeEventListener('storage', onStorage) }
  }, [activeTab])

  // 资源中心 Toast（独立于 stageToast）
  const { toasts, push: pushToast, remove: removeToast } = useToasts()

  // 加载骨架开关：首次进入 + 切换 Tab 时短暂显示
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 450)
    return () => clearTimeout(t)
  }, [activeTab])

  // 持久化收藏 —— 已迁移到统一 store (vf_favorites_v2)，此处无需再写

  // 资源数据（保持收藏状态同步）
  const resources = useMemo(() => {
    return defaultResources.map(r => ({
      ...r,
      collect: favorites.includes(r.id),
    }))
  }, [favorites])

  // 筛选
  const filtered = resources.filter(item =>
    (cateTab === 'all' || item.cate === cateTab) &&
    (item.title.includes(search) || item.desc.includes(search))
  )

  // 切换收藏 —— 写入统一 store
  const toggleFavorite = async (id) => {
    const target = defaultResources.find(r => r.id === id)
    if (!target) return
    const existed = favorites.includes(id)
    setFavorites(prev => existed ? prev.filter(fid => fid !== id) : [...prev, id])
    try {
      await toggleFavorite({
        id: String(id),
        category: 'resource',
        title: target.title,
        desc: target.desc,
        cover: target.emoji,
        tags: [target.type, target.cate],
        author: target.author,
      })
    } catch (e) { console.error(e) }
    pushToast({
      type: existed ? 'info' : 'success',
      title: existed ? '已取消收藏' : '已加入收藏',
      detail: target?.title + ' · 可在「个人中心 → 我的收藏」查看',
      icon: existed ? '☆' : '★',
      duration: 1800,
    })
  }

  // ==================== 资源卡片组件 ====================
  const ResourceCard = ({ item }) => (
    <div style={{
      background: '#fff', borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      cursor: 'pointer',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.14)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      <div style={{
        height: 90, background: item.gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 36, position: 'relative',
      }}>
        {item.emoji}
        <span style={{
          position: 'absolute', top: 8, right: 8, fontSize: 11,
          background: 'rgba(255,255,255,0.25)', padding: '2px 8px',
          borderRadius: 20, fontWeight: 600,
        }}>{item.type}</span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: 0, lineHeight: 1.4, flex: 1 }}>{item.title}</h3>
          <span
            onClick={() => toggleFavorite(item.id)}
            style={{
              color: item.collect ? '#f59e0b' : '#cbd5e1',
              fontSize: 18, cursor: 'pointer', transition: 'color 0.2s', flexShrink: 0, marginLeft: 8,
            }}
            onMouseEnter={e => { if (!item.collect) e.currentTarget.style.color = '#fbbf24' }}
            onMouseLeave={e => { if (!item.collect) e.currentTarget.style.color = '#cbd5e1' }}
          >★</span>
        </div>
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>{item.desc}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
          <span>👨‍🏫 {item.author}</span>
          <span>⏱️ {item.time}</span>
        </div>
        {item.progress > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: '#64748b' }}>学习进度</span>
              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{item.progress}%</span>
            </div>
            <div style={{ height: 5, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${item.progress}%`, height: '100%', background: '#3b82f6', borderRadius: 99, transition: 'width 0.3s' }}></div>
            </div>
          </div>
        )}
        <button style={{
          width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #e2e8f0',
          background: '#f8fafc', color: '#475569', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#3b82f6' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#e2e8f0' }}
        >开始学习 →</button>
      </div>
    </div>
  )

  // ==================== Tab导航 ====================
  const TabNav = () => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e8ecf1', paddingBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <h2 style={{ fontSize: 18, color: '#1e293b', margin: '0 12px 0 0' }}>📖 资源中心</h2>
      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { key: 'recommend', name: '推荐资源', icon: '⭐' },
          { key: 'generate', name: '资源生成', icon: '✨' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '7px 18px', borderRadius: 18, fontSize: 12, fontWeight: 500,
            background: activeTab === tab.key ? '#3b82f6' : '#f1f5f9',
            color: activeTab === tab.key ? '#fff' : '#64748b',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: activeTab === tab.key ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
          }}>{tab.icon} {tab.name}</button>
        ))}
      </div>
    </div>
  )

  // ==================== Tab 1: 推荐资源（原资源库） ====================
  const RecommendTab = () => {
    const todayItems = useMemo(() => buildTodayRecommend(learn.weakTopics), [learn.weakTopics])
    return (
      <div style={{ maxWidth: '100%' }}>
        {/* 顶部说明：基于学习画像智能推荐 */}
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
          border: '1px solid #c7d2fe',
          borderRadius: 12, padding: '12px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>🎯</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>基于你的学习画像智能推荐</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              目标：{learn.goal === '自定义目标' ? (learn.customGoal || '自定义') : (learn.goal || '尚未选择')} · 阶段：{learn.stage}
            </div>
          </div>
        </div>

        {/* ── 今日推荐（按错点精准推送） ── */}
        {learn.weakTopics?.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '1px solid #fbbf24',
            borderRadius: 12, padding: '12px 16px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>💡</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>今日推荐 · 精准推送</div>
                  <div style={{ fontSize: 11, color: '#a16207', marginTop: 2 }}>
                    因为你在 <strong>{learn.weakTopics.join('、')}</strong> 上易错，AI 导师专门挑了这几份资源给你
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 6,
                background: '#fbbf24', color: '#fff', fontWeight: 700,
              }}>个性化</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {todayItems.map((it, idx) => (
                <div key={idx} style={{
                  background: '#fff', borderRadius: 10, padding: '12px 14px',
                  border: `1.5px solid ${it.color}30`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: it.color + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: it.color, fontWeight: 700, flexShrink: 0,
                  }}>📘</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.title}
                    </div>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 4,
                      background: it.color + '20', color: it.color, fontWeight: 600,
                    }}>{it.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 搜索与筛选 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(cateMap).map(([key, label]) => (
            <button key={key} onClick={() => setCateTab(key)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: cateTab === key ? '#3b82f6' : '#f1f5f9',
              color: cateTab === key ? '#fff' : '#64748b',
              border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            }}>{label}</button>
          ))}
          <input
            placeholder="🔍 搜索资源标题、描述..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 200, padding: '7px 12px', borderRadius: 10,
              border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {/* 资源卡片网格 */}
        {loading ? (
          <ResourceGridSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <EmptyState variant="no-search" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {filtered.map(item => <ResourceCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    )
  }

  // ==================== Tab 2: 学习包生成（Deep Research 风格 · 全过程可视化） ====================
  const GenerateTab = () => (
    <ResourceGenDeep
      learn={learn}
      generatePack={generateLearningPack}
      MarkdownCard={MarkdownCard}
      EmptyState={EmptyState}
      ModuleContentSkeleton={ModuleContentSkeleton}
      ShareModal={ShareModal}
      PdfPreviewModal={PdfPreviewModal}
      pushToast={pushToast}
    />
  )

  // 收藏 Tab 已迁移至「个人中心 → 我的收藏」(/profile?tab=favorites)
// 旧的 FavoritesTab 组件不再渲染；点击「我的收藏」请导航到 /profile?tab=favorites

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {activeTab === 'recommend' && <RecommendTab />}
      {activeTab === 'generate' && <GenerateTab />}

      {/* 全局 Toast 栈 */}
      <ToastStack toasts={toasts} onClose={removeToast} />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   ResourceGenDeep —— 学习包生成 · Deep Research 风格重做
   ────────────────────────────────────────────────────────────────
   4 步流水线 × 4 Agent：
     1. 架构分析  → Architect 智能体
     2. 算法教研  → Tutor 智能体
     3. 资源生成  → Generator 智能体（生成 6 模块）
     4. 质量校验  → Evaluator 智能体

   每步展示：当前 Agent · 执行进度（百分比+进度条）· 耗时（毫秒级）·
   完成状态（✓/执行中/待开始）· 过程日志（类似 Deep Research 思考链）

   阶段切换：
     生成中 → 实时显示流水线进度 + Agent 思考流
     生成后 → 6 模块网格卡片 + 单模块详情预览 + 5 操作按钮
   全 Mock，无需后端。
   ════════════════════════════════════════════════════════════════ */

// 4 步 Agent 流程定义（Mock · 全程耗时分配）
const RG_STEPS = [
  {
    key: 'arch',
    emoji: '🏗️',
    name: '架构分析',
    agent: 'Architect',
    color: '#38bdf8',
    duration: 1800,             // 该步总耗时 ms
    logs: [
      '正在解析学习目标…',
      '识别主题: {topic}',
      '从易错点 {weak} 推断需要加强的子模块',
      '已生成知识图谱骨架 (5 大主题 × 12 节点)',
      '→ 输出: 学习路径 JSON 至共享黑板',
    ],
  },
  {
    key: 'research',
    emoji: '📖',
    name: '算法教研',
    agent: 'Tutor',
    color: '#a78bfa',
    duration: 2400,
    logs: [
      '检索该方向的经典论文 (Top-5)…',
      '匹配你的认知风格: 视觉优先',
      '对照已有错题本，标记需要重点讲的 3 个易错点',
      '→ 输出: 教研要点 + 推荐论文清单',
    ],
  },
  {
    key: 'gen',
    emoji: '📝',
    name: '资源生成',
    agent: 'Generator',
    color: '#22d3ee',
    duration: 3200,
    logs: [
      '开始组装 6 大模块…',
      '  ✓ 讲义 — Markdown 已生成 (1247 字)',
      '  ✓ 思维导图 — Mermaid + 表格',
      '  ✓ 练习任务 — 含 4 道诊断题',
      '  ✓ 实验案例 — 最小可运行 PyTorch demo',
      '  ✓ 源码路线 — 关键文件路径 + 注释',
      '  ✓ 推荐论文 — Top-3 摘要',
      '→ 输出: 完整学习包',
    ],
  },
  {
    key: 'qa',
    emoji: '🔍',
    name: '质量校验',
    agent: 'Evaluator',
    color: '#34d399',
    duration: 1400,
    logs: [
      '校验 6 模块完整性…',
      '对照你的画像评分: 个性化匹配度 0.92',
      '→ 输出: 校验报告',
    ],
  },
]

// 6 个产出模块
const RG_OUTPUT_MODULES = [
  { key: 'lecture',     icon: '📚', name: '讲义',     desc: '核心概念与原理速通', color: '#3b82f6' },
  { key: 'mindmap',     icon: '🗺️', name: '思维导图', desc: '知识骨架全景',         color: '#a855f7' },
  { key: 'practice',    icon: '📝', name: '练习',     desc: '诊断题 + 实操任务',     color: '#22c55e' },
  { key: 'paper',       icon: '📄', name: '论文',     desc: 'Top 经典论文清单',     color: '#f59e0b' },
  { key: 'source',      icon: '🧭', name: '源码路线', desc: '关键文件 + 阅读顺序',   color: '#06b6d4' },
  { key: 'experiment',  icon: '🧪', name: '实验案例', desc: '最小可运行 Demo',       color: '#ef4444' },
]

function ResourceGenDeep({ learn, generatePack, MarkdownCard, EmptyState, ModuleContentSkeleton, ShareModal, PdfPreviewModal, pushToast }) {
  const [phase, setPhase] = useState('idle')   // idle | running | done
  const [stepIdx, setStepIdx] = useState(-1)   // 当前步骤下标，-1 表示未开始
  const [stepProgress, setStepProgress] = useState(0)   // 当前步骤 0-100
  const [elapsedTotal, setElapsedTotal] = useState(0)   // 总耗时 ms
  const [stepElapsed, setStepElapsed] = useState(0)     // 当前步耗时 ms
  const [visibleLogCount, setVisibleLogCount] = useState(0)
  const [activeModule, setActiveModule] = useState(0)
  const [pack, setPack] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState('preview')

  // 用 ref 计时，避免重复启动
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const stepStartRef = useRef(null)
  const stepAccumRef = useRef(0)
  const logsTimerRef = useRef(null)

  // 开始/重置：启动流水线
  const startPipeline = () => {
    setPhase('running')
    setStepIdx(0)
    setStepProgress(0)
    setElapsedTotal(0)
    setStepElapsed(0)
    setVisibleLogCount(0)
    setPack(null)
    setActiveModule(0)
    stepAccumRef.current = 0
    startRef.current = performance.now()
    stepStartRef.current = performance.now()

    // 计划逐步切换（按总耗时比例压缩到 ~8.8s 总耗时）
    const scale = 8800 / RG_STEPS.reduce((s, x) => s + x.duration, 0)
    let acc = 0
    RG_STEPS.forEach((step, i) => {
      const stepMs = step.duration * scale
      // 切到下一步
      setTimeout(() => {
        if (i > 0) {
          setStepIdx(i)
          setStepProgress(0)
          setVisibleLogCount(0)
          stepAccumRef.current = 0
          stepStartRef.current = performance.now()
        }
        // 当前步的 log 依次冒出
        const logInterval = stepMs / (step.logs.length + 1)
        step.logs.forEach((_, li) => {
          setTimeout(() => setVisibleLogCount(li + 1), logInterval * (li + 1))
        })
      }, acc)
      acc += stepMs
    })

    // 全部完成后产出 pack
    const totalMs = RG_STEPS.reduce((s, x) => s + x.duration, 0) * scale + 400
    setTimeout(() => {
      setStepIdx(RG_STEPS.length - 1)
      setStepProgress(100)
      setVisibleLogCount(RG_STEPS[RG_STEPS.length - 1].logs.length)
      const built = generatePack(learn.goal, learn.customGoal, learn.weakTopics)
      setPack(built)
      setTimeout(() => setPhase('done'), 500)
    }, totalMs)
  }

  // 主计时：requestAnimationFrame 驱动 elapsedTotal / stepElapsed
  useEffect(() => {
    if (phase !== 'running') return
    const tick = () => {
      const now = performance.now()
      setElapsedTotal(now - startRef.current)
      setStepElapsed(now - stepStartRef.current + stepAccumRef.current)
      // 当前步内进度
      const stepMs = (RG_STEPS[Math.max(0, stepIdx)]?.duration || 1) * (8800 / RG_STEPS.reduce((s, x) => s + x.duration, 0))
      setStepProgress(Math.min(100, ((now - stepStartRef.current + stepAccumRef.current) / stepMs) * 100))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [phase, stepIdx])

  // 主题/易错点字符串，供 log 模板替换
  const topic = learn.goal === '自定义目标' ? (learn.customGoal || '自定义学习') : (learn.goal || '视觉模型')
  const weak = (learn.weakTopics && learn.weakTopics.length) ? learn.weakTopics.join('、') : '暂无'

  // === 工具 ===
  const fmtMs = (ms) => {
    if (ms < 1000) return `${Math.round(ms)} ms`
    return `${(ms / 1000).toFixed(2)} s`
  }
  const fillLog = (s) => s.replace('{topic}', topic).replace('{weak}', weak)

  // === 子组件 ===
  const StepRow = ({ step, idx, isCompleted, isActive }) => {
    const stepMs = step.duration * (8800 / RG_STEPS.reduce((s, x) => s + x.duration, 0))
    const progress = isCompleted ? 100 : isActive ? stepProgress : 0
    const elapsed = isCompleted ? stepMs : isActive ? stepElapsed : 0
    return (
      <div style={{
        background: isActive ? `linear-gradient(135deg, ${step.color}10, transparent)` : 'rgba(15,23,42,0.5)',
        border: `1px solid ${isActive ? step.color + '55' : 'rgba(148,163,184,0.12)'}`,
        borderRadius: 10, padding: 12, transition: 'all .3s',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 步骤号/状态 */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: isCompleted ? '#10b981' : isActive ? `linear-gradient(135deg, ${step.color}, ${step.color}99)` : 'rgba(148,163,184,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#fff', fontWeight: 700,
            boxShadow: isActive ? `0 0 16px ${step.color}66` : 'none',
            transition: 'all .3s',
          }}>
            {isCompleted ? '✓' : step.emoji}
          </div>
          {/* 标题 + Agent */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>{step.name}</span>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: `${step.color}22`, color: step.color,
                fontWeight: 700, fontFamily: 'monospace',
              }}>AGENT · {step.agent}</span>
              <span style={{
                fontSize: 9.5, padding: '1px 6px', borderRadius: 4,
                background: isCompleted ? '#10b98122' : isActive ? '#3b82f622' : '#47556922',
                color:      isCompleted ? '#10b981'    : isActive ? '#3b82f6'    : '#64748b',
                fontWeight: 700,
              }}>
                {isCompleted ? '已完成' : isActive ? '执行中' : '待开始'}
              </span>
            </div>
            {/* Agent 当前在干什么（执行中时显示） */}
            {(isActive || isCompleted) && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                {isActive && <span style={{ color: step.color }}>▸ </span>}
                {fillLog(step.logs[Math.min(visibleLogCount, step.logs.length - 1) || 0])}
                {isActive && <span style={{ color: step.color, animation: 'rgBlink 1s steps(1) infinite' }}> ▍</span>}
              </div>
            )}
          </div>
          {/* 耗时 + 进度 */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: isCompleted ? '#10b981' : isActive ? step.color : '#64748b',
              fontFamily: 'monospace',
            }}>
              {fmtMs(elapsed)}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
              {isCompleted ? `100%` : isActive ? `${Math.round(progress)}%` : '0%'}
            </div>
          </div>
        </div>
        {/* 进度条 */}
        <div style={{
          marginTop: 8, height: 4, background: 'rgba(148,163,184,0.12)',
          borderRadius: 999, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: isCompleted ? '#10b981' : `linear-gradient(90deg, ${step.color}88, ${step.color})`,
            boxShadow: isActive ? `0 0 8px ${step.color}88` : 'none',
            borderRadius: 999, transition: 'width .15s',
          }} />
        </div>
      </div>
    )
  }

  const totalDuration = RG_STEPS.reduce((s, x) => s + x.duration, 0) * (8800 / RG_STEPS.reduce((s, x) => s + x.duration, 0))

  // ───────────── 渲染 ─────────────
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0b1220 0%, #0f172a 50%, #111827 100%)',
      borderRadius: 14, padding: 16, color: '#e2e8f0',
      border: '1px solid rgba(56,189,248,0.18)',
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes rgBlink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
        @keyframes rgPulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
        @keyframes rgScan  { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
      `}</style>

      {/* 顶部：标题 + 总耗时 + 状态徽标 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #a855f7, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, boxShadow: '0 0 16px rgba(168,85,247,0.45)',
          }}>✨</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.3 }}>
              学习包生成 <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>/ LEARNING PACK GEN</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              基于你的画像定制 · 4 智能体协同 · 全过程可视化
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 总耗时 */}
          <div style={{
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(56,189,248,0.25)',
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'monospace', fontSize: 11,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: phase === 'running' ? '#22d3ee' : phase === 'done' ? '#10b981' : '#475569',
              boxShadow: phase !== 'idle' ? `0 0 8px ${phase === 'running' ? '#22d3ee' : '#10b981'}` : 'none',
              animation: phase === 'running' ? 'rgPulse 1.2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ color: '#64748b' }}>ELAPSED</span>
            <span style={{ color: phase === 'running' ? '#22d3ee' : phase === 'done' ? '#10b981' : '#94a3b8', fontWeight: 700 }}>
              {fmtMs(elapsedTotal)}
            </span>
            <span style={{ color: '#475569' }}>/ {fmtMs(totalDuration)}</span>
          </div>
          {/* 状态徽标 */}
          <div style={{
            padding: '4px 10px', borderRadius: 999,
            background: phase === 'running' ? 'rgba(59,130,246,0.15)' : phase === 'done' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
            border: `1px solid ${phase === 'running' ? '#3b82f6' : phase === 'done' ? '#10b981' : '#6366f1'}55`,
            color:      phase === 'running' ? '#3b82f6'      : phase === 'done' ? '#10b981'      : '#a5b4fc',
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          }}>
            {phase === 'idle' ? '🟦 等待启动' : phase === 'running' ? '⚙️ 生成中' : '✅ 已完成'}
          </div>
        </div>
      </div>

      {/* 主题上下文条 */}
      <div style={{
        padding: '8px 12px', borderRadius: 8, marginBottom: 14,
        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.12)',
        display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11,
      }}>
        <span><span style={{ color: '#64748b' }}>🎯 目标</span> <span style={{ color: '#22d3ee', fontWeight: 700 }}>{topic}</span></span>
        <span><span style={{ color: '#64748b' }}>📍 阶段</span> <span style={{ color: '#a78bfa', fontWeight: 700 }}>{learn.stage || '主线中'}</span></span>
        <span><span style={{ color: '#64748b' }}>⚠️ 易错点</span> <span style={{ color: '#f87171', fontWeight: 700 }}>{weak}</span></span>
      </div>

      {/* ─── 生成中：左步骤 / 右 Agent 思考流 ─── */}
      {phase !== 'done' && (
        <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', gap: 14 }}>
          {/* 左：4 步流水线 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: '#22d3ee', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
              ⚡ AGENT PIPELINE <span style={{ color: '#475569', fontWeight: 500 }}>/ 4 步流水线</span>
            </div>
            {RG_STEPS.map((step, i) => (
              <StepRow
                key={step.key}
                step={step}
                idx={i}
                isCompleted={stepIdx > i}
                isActive={stepIdx === i && phase === 'running'}
              />
            ))}
          </div>

          {/* 右：思考流日志 */}
          <div style={{
            background: '#0b1220', borderRadius: 10,
            border: '1px solid rgba(56,189,248,0.18)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            minHeight: 360,
          }}>
            <div style={{
              padding: '8px 12px',
              background: 'linear-gradient(90deg, rgba(56,189,248,0.1), transparent)',
              borderBottom: '1px solid rgba(148,163,184,0.12)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#22d3ee', fontWeight: 700, letterSpacing: 1 }}>💭 AGENT THINKING</span>
                <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>/ 思考链</span>
              </div>
              {phase === 'running' && stepIdx >= 0 && (
                <span style={{ fontSize: 10, color: RG_STEPS[stepIdx].color, fontFamily: 'monospace', fontWeight: 700 }}>
                  {RG_STEPS[stepIdx].agent}
                </span>
              )}
            </div>
            <div style={{ flex: 1, padding: 12, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>
              {RG_STEPS.map((step, i) => {
                if (i > stepIdx) return null
                const visible = i < stepIdx ? step.logs.length : visibleLogCount
                return (
                  <div key={step.key} style={{ marginBottom: 12 }}>
                    <div style={{ color: step.color, fontWeight: 700, marginBottom: 4 }}>
                      [{String(i + 1).padStart(2, '0')}] {step.emoji} {step.name} · {step.agent}
                    </div>
                    {step.logs.slice(0, visible).map((l, li) => (
                      <div key={li} style={{
                        color: i < stepIdx ? '#64748b' : '#cbd5e1',
                        paddingLeft: 16, opacity: i < stepIdx ? 0.6 : 1,
                      }}>
                        <span style={{ color: step.color }}>›</span> {fillLog(l)}
                      </div>
                    ))}
                  </div>
                )
              })}
              {phase === 'running' && stepIdx >= 0 && (
                <div style={{ color: '#22d3ee', paddingLeft: 16, marginTop: 4 }}>
                  <span style={{ animation: 'rgBlink 1s steps(1) infinite' }}>▍</span>
                </div>
              )}
              {phase === 'idle' && (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '60px 0' }}>
                  点击下方「开始生成」按钮启动 4 智能体流水线 →
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 生成后：6 模块网格 + 详情 ─── */}
      {phase === 'done' && pack && (
        <div>
          {/* 弹窗 */}
          <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} title={pack.title} />
          <PdfPreviewModal open={pdfOpen} onClose={() => setPdfOpen(false)} title={pack.title} sections={pack.modules} />

          {/* 完成总结 */}
          <div style={{
            marginBottom: 14, padding: 12,
            background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(15,23,42,0.5))',
            border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 28 }}>🎁</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>
                {pack.title} <span style={{ color: '#64748b', fontSize: 11, fontWeight: 500 }}>· 生成完成</span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{pack.summary}</div>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#10b981', textAlign: 'right' }}>
              <div>总耗时 <b>{fmtMs(elapsedTotal)}</b></div>
              <div style={{ color: '#64748b', marginTop: 2 }}>4 Agent · {pack.modules.length} 模块</div>
            </div>
          </div>

          {/* 6 模块卡片网格 */}
          <div style={{ marginBottom: 12, fontSize: 11, color: '#22d3ee', fontWeight: 700, letterSpacing: 1 }}>
            📦 最终生成 · 6 大模块 <span style={{ color: '#475569', fontWeight: 500 }}>/ FINAL OUTPUT</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 }}>
            {RG_OUTPUT_MODULES.map((m, i) => {
              const matched = pack.modules.find(p => p.name.includes(m.name) || (m.key === 'lecture' && p.icon === '📚') || (m.key === 'mindmap' && p.icon === '🗺️') || (m.key === 'practice' && p.icon === '📝') || (m.key === 'experiment' && p.icon === '🧪') || (m.key === 'source' && p.icon === '🧭') || (m.key === 'paper' && p.icon === '📄'))
              const active = activeModule === i
              return (
                <button key={m.key} onClick={() => { setActiveModule(i); setPreviewMode('preview') }} style={{
                  padding: 12, borderRadius: 10,
                  border: `1px solid ${active ? m.color : 'rgba(148,163,184,0.15)'}`,
                  background: active ? `linear-gradient(135deg, ${m.color}22, transparent)` : 'rgba(15,23,42,0.5)',
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  transition: 'all .2s',
                  boxShadow: active ? `0 0 16px ${m.color}55` : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 22 }}>{m.icon}</span>
                    <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div style={{ color: active ? m.color : '#e2e8f0', fontSize: 13, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ color: '#64748b', fontSize: 10, lineHeight: 1.4 }}>{m.desc}</div>
                  <div style={{ marginTop: 4, fontSize: 10, color: matched ? '#10b981' : '#475569', fontFamily: 'monospace' }}>
                    {matched ? `✓ ${matched.content.length} 字` : '未生成'}
                  </div>
                </button>
              )
            })}
          </div>

          {/* 详情预览 */}
          <div style={{
            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)',
            borderRadius: 10, padding: 12, minHeight: 280,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: RG_OUTPUT_MODULES[activeModule].color, fontSize: 13, fontWeight: 700 }}>
                  {RG_OUTPUT_MODULES[activeModule].icon} {RG_OUTPUT_MODULES[activeModule].name}
                </span>
                <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                  / {RG_OUTPUT_MODULES[activeModule].key.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ k: 'preview', l: '👁 预览' }, { k: 'source', l: '</> 源码' }].map(t => (
                  <button key={t.k} onClick={() => setPreviewMode(t.k)} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: previewMode === t.k ? 'rgba(56,189,248,0.15)' : 'transparent',
                    color: previewMode === t.k ? '#22d3ee' : '#64748b',
                    border: `1px solid ${previewMode === t.k ? '#22d3ee55' : 'transparent'}`,
                    cursor: 'pointer',
                  }}>{t.l}</button>
                ))}
              </div>
            </div>
            {(() => {
              const matched = pack.modules[activeModule]
              if (!matched) return <div style={{ color: '#64748b', textAlign: 'center', padding: 60 }}>暂无内容</div>
              if (previewMode === 'preview') return (
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  <MarkdownCard content={matched.content} title={matched.name} />
                </div>
              )
              // 源码视图
              const lines = (matched.content || '').split('\n')
              return (
                <pre style={{
                  margin: 0, padding: '12px 0',
                  background: '#0b1220', color: '#e2e8f0',
                  borderRadius: 8, fontFamily: 'monospace',
                  fontSize: 12.5, lineHeight: 1.7, overflow: 'auto',
                  maxHeight: 360,
                }}>
                  {lines.map((line, i) => (
                    <div key={i} style={{ display: 'flex', paddingRight: 12 }}>
                      <span style={{ color: '#475569', display: 'inline-block', width: 40, textAlign: 'right', paddingRight: 12, marginRight: 12, borderRight: '1px solid #1e293b', userSelect: 'none', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1 }}>{line || ' '}</span>
                    </div>
                  ))}
                </pre>
              )
            })()}
          </div>

          {/* 5 操作按钮 */}
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {[
              { icon: '📋', label: '复制全部', onClick: async () => {
                const all = pack.modules.map(m => m.content).join('\n\n---\n\n')
                try { await navigator.clipboard.writeText(all) } catch (_) {}
                pushToast({ type: 'success', title: '已复制全部内容', detail: `${pack.modules.length} 个模块 · ${all.length} 字符`, icon: '📋', duration: 1800 })
              }},
              { icon: '📥', label: '下载 MD', onClick: () => {
                const all = pack.modules.map(m => m.content).join('\n\n---\n\n')
                const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
                const blob = new Blob([all], { type: 'text/markdown;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `${pack.title}-${stamp}.md`; a.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
                pushToast({ type: 'success', title: 'Markdown 已下载', detail: `${pack.title}.md`, icon: '📥', duration: 1800 })
              }},
              { icon: '📄', label: '下载 PDF', primary: true, onClick: () => setPdfOpen(true) },
              { icon: '🔗', label: '分享', onClick: () => setShareOpen(true) },
              { icon: '🔁', label: '重新生成', onClick: () => { pushToast({ type: 'info', title: '正在重新生成...', icon: '🔁', duration: 1500 }); startPipeline() } },
            ].map(b => (
              <button key={b.label} onClick={b.onClick} style={{
                padding: '10px 6px', borderRadius: 8,
                border: b.primary ? 'none' : '1px solid rgba(148,163,184,0.2)',
                background: b.primary
                  ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                  : 'rgba(15,23,42,0.6)',
                color: b.primary ? '#fff' : '#cbd5e1',
                fontSize: 11.5, fontWeight: 600,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'all .15s',
              }}>
                <span style={{ fontSize: 16 }}>{b.icon}</span>
                <span>{b.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 底部：CTA 按钮 */}
      {phase !== 'done' && (
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={startPipeline}
            disabled={phase === 'running'}
            style={{
              padding: '14px 36px', borderRadius: 12, border: 'none',
              background: phase === 'running'
                ? 'rgba(99,102,241,0.4)'
                : 'linear-gradient(90deg, #a855f7, #3b82f6, #06b6d4)',
              backgroundSize: '200% 100%',
              color: '#fff', fontSize: 14, fontWeight: 800,
              cursor: phase === 'running' ? 'not-allowed' : 'pointer',
              boxShadow: phase === 'running' ? 'none' : '0 8px 24px rgba(99,102,241,0.35)',
              letterSpacing: 0.5,
              position: 'relative', overflow: 'hidden',
            }}
          >
            {phase === 'running' ? '⏳ 4 智能体协同生成中...' : '🚀 一键生成学习包（基于你的画像）'}
          </button>
        </div>
      )}
    </div>
  )
}