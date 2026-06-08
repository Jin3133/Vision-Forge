import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

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

// ==================== 主组件 ====================
export default function Resources() {
  const location = useLocation()
  const navigate = useNavigate()
  const urlParams = new URLSearchParams(location.search)
  const urlTab = urlParams.get('tab') || 'courses'
  const activeTab = urlTab === 'courses' ? 'library' : urlTab === 'generate' ? 'generate' : urlTab === 'favorites' ? 'favorites' : 'library'
  const setActiveTab = (tab) => {
    const tabMap = { 'library': 'courses', 'generate': 'generate', 'favorites': 'favorites' }
    navigate(`/resources?tab=${tabMap[tab] || tab}`)
  }
  const [cateTab, setCateTab] = useState('all')
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genStep, setGenStep] = useState(0)
  const [generatedContent, setGeneratedContent] = useState(null)
  const [userPrompt, setUserPrompt] = useState('')
  const [resourceType, setResourceType] = useState('讲义')
  const [showPreview, setShowPreview] = useState(false)
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vf_favorites') || '[]') }
    catch { return [] }
  })

  // 持久化收藏
  useEffect(() => {
    localStorage.setItem('vf_favorites', JSON.stringify(favorites))
  }, [favorites])

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

  // 收藏的资源
  const favoriteResources = resources.filter(item => favorites.includes(item.id))

  // 切换收藏
  const toggleFavorite = (id) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id])
  }

  // 生成资源
  const generateResource = () => {
    if (!userPrompt.trim()) {
      alert('请输入你想要生成的学习内容')
      return
    }
    setGenerating(true)
    setGenStep(0)
    setGeneratedContent(null)
    setShowPreview(false)

    const steps = [
      { emoji: '🏗️', name: '架构引导', desc: '分析需求，构建知识框架...' },
      { emoji: '📖', name: '算法教研', desc: '整理核心算法与原理...' },
      { emoji: '📝', name: '资源生成', desc: '编写学习材料内容...' },
      { emoji: '🔍', name: '质量校验', desc: '校验内容准确性与完整性...' },
    ]

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setGenStep(idx + 1)
        if (idx === steps.length - 1) {
          setTimeout(() => {
            setGeneratedContent({
              type: resourceType,
              title: `${userPrompt} - 专属${resourceType}`,
              content: generateMockContent(resourceType, userPrompt),
            })
            setGenerating(false)
          }, 600)
        }
      }, idx * 800)
    })
  }

  // 复制内容
  const copyContent = () => {
    if (generatedContent?.content) {
      navigator.clipboard?.writeText(generatedContent.content)
      alert('📋 内容已复制到剪贴板')
    }
  }

  // 下载内容
  const downloadContent = () => {
    if (generatedContent?.content) {
      const blob = new Blob([generatedContent.content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${generatedContent.title}.md`
      a.click()
      URL.revokeObjectURL(url)
    }
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
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e8ecf1', paddingBottom: 12 }}>
      {[
        { key: 'library', name: '资源库', icon: '📚' },
        { key: 'generate', name: '资源生成', icon: '🎨' },
        { key: 'favorites', name: '我的收藏', icon: '⭐' },
      ].map(tab => (
        <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
          padding: '8px 22px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          background: activeTab === tab.key ? '#3b82f6' : '#f1f5f9',
          color: activeTab === tab.key ? '#fff' : '#64748b',
          border: 'none', cursor: 'pointer', transition: 'all 0.2s',
          boxShadow: activeTab === tab.key ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
        }}>{tab.icon} {tab.name}</button>
      ))}
    </div>
  )

  // ==================== Tab 1: 资源库 ====================
  const LibraryTab = () => (
    <div style={{ maxWidth: '100%' }}>
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
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#fff', borderRadius: 12 }}>
          <span style={{ fontSize: 40 }}>🔍</span>
          <div style={{ marginTop: 8, fontSize: 13 }}>没有找到匹配的资源</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {filtered.map(item => <ResourceCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )

  // ==================== Tab 2: 资源生成（双栏 + 可展开预览） ====================
  const GenerateTab = () => {
    const genSteps = [
      { emoji: '🏗️', name: '架构引导', desc: '分析需求，构建知识框架...' },
      { emoji: '📖', name: '算法教研', desc: '整理核心算法与原理...' },
      { emoji: '📝', name: '资源生成', desc: '编写学习材料内容...' },
      { emoji: '🔍', name: '质量校验', desc: '校验内容准确性与完整性...' },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 上半部分：左右双栏 */}
        <div style={{ display: 'grid', gridTemplateColumns: '45% 55%', gap: 14 }}>
          {/* 左45%：类型选择 + 输入框 + 生成按钮 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 类型选择 */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>📋 选择资源类型</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {resourceTypes.map(type => (
                  <button key={type} onClick={() => setResourceType(type)} style={{
                    padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                    background: resourceType === type ? '#3b82f6' : '#f1f5f9',
                    color: resourceType === type ? '#fff' : '#64748b',
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: resourceType === type ? '0 2px 6px rgba(59,130,246,0.25)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>{typeEmoji[type]} {type}</button>
                ))}
              </div>
            </div>

            {/* 输入区域 */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>✏️ 输入学习内容</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  placeholder="输入你想要学习的内容，如：SAM模型、注意力机制、图像分割..."
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateResource()}
                />
                <button onClick={generateResource} disabled={generating} style={{
                  padding: '9px 20px', borderRadius: 10, border: 'none', width: '100%',
                  background: generating ? '#94a3b8' : '#3b82f6', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}>{generating ? '⏳ 生成中...' : '✨ 生成资源'}</button>
              </div>
            </div>

            {/* 生成结果信息 */}
            {generatedContent && !generating && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>{typeEmoji[generatedContent.type]} {generatedContent.type}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>{generatedContent.title}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={copyContent} style={{
                    flex: 1, padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                    background: '#f8fafc', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>📋 复制</button>
                  <button onClick={downloadContent} style={{
                    flex: 1, padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>📥 下载</button>
                </div>
              </div>
            )}
          </div>

          {/* 右55%：4步骤进度追踪（紧凑纵向列表） */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>🔄 多智能体协同生成进度</div>
              <span style={{ fontSize: 10, color: '#6366f1', background: '#eef2ff', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
                共享黑板驱动
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 12, lineHeight: 1.5 }}>
              🤖 架构引导 → 📖 算法教研 → 📝 资源生成 → 🔍 质量校验（4智能体通过 Task_State.json 协同）
            </div>

            {!generating && genStep === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 8 }}>
                <span style={{ fontSize: 36 }}>🎯</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>准备就绪</div>
                <div style={{ fontSize: 12, textAlign: 'center' }}>在左侧选择类型并输入内容<br />点击「生成资源」开始</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {genSteps.map((step, idx) => {
                  const isCompleted = genStep > idx
                  const isActive = genStep === idx && generating
                  const isPending = genStep <= idx && !isActive

                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', opacity: isPending && genStep === 0 ? 0.5 : 1 }}>
                      {/* 步骤图标 */}
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: isCompleted ? '#3b82f6' : isActive ? '#dbeafe' : '#f1f5f9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, transition: 'all 0.4s',
                        border: `2px solid ${isCompleted ? '#3b82f6' : isActive ? '#3b82f6' : '#e2e8f0'}`,
                      }}>
                        {isCompleted ? '✓' : <span style={{ fontSize: 12 }}>{step.emoji}</span>}
                      </div>
                      {/* 步骤文字 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600,
                          color: isCompleted ? '#3b82f6' : isActive ? '#3b82f6' : '#64748b',
                          transition: 'color 0.4s',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          {step.name}
                          {isActive && (
                            <span style={{
                              display: 'inline-block', width: 12, height: 12,
                              border: '2px solid #3b82f6', borderTopColor: 'transparent',
                              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                            }} />
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>
                          {isCompleted ? '已完成' : isActive ? step.desc : '等待中...'}
                        </div>
                      </div>
                      {/* 右侧状态指示 */}
                      <div style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: isCompleted ? '#dbeafe' : isActive ? '#fef3c7' : '#f1f5f9',
                        color: isCompleted ? '#3b82f6' : isActive ? '#f59e0b' : '#94a3b8',
                        flexShrink: 0,
                      }}>
                        {isCompleted ? '✓' : isActive ? '进行中' : '待开始'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 下半部分：可展开/收起的 Markdown 预览 */}
        {generatedContent && !generating && (
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            {/* 展开/收起头部 */}
            <button
              onClick={() => setShowPreview(v => !v)}
              style={{
                width: '100%', padding: '12px 16px', border: 'none', background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569',
              }}
            >
              <span>📄 {generatedContent.title}</span>
              <span style={{
                transform: showPreview ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s ease', fontSize: 12,
              }}>▼</span>
            </button>

            {/* 预览内容 */}
            {showPreview && (
              <div style={{ padding: '0 16px 16px', animation: 'fadeIn 0.3s ease' }}>
                <MarkdownCard content={generatedContent.content} title={generatedContent.title} />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ==================== Tab 3: 我的收藏 ====================
  const FavoritesTab = () => (
    <div style={{ maxWidth: '100%' }}>
      {favoriteResources.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 12, padding: '60px 40px', textAlign: 'center', color: '#94a3b8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            fontSize: 32,
          }}>⭐</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#475569', marginBottom: 6 }}>暂无收藏资源</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>在「资源库」中点击星星图标收藏喜欢的资源</div>
          <button
            onClick={() => setActiveTab('library')}
            style={{
              padding: '8px 20px', borderRadius: 10, border: '1px solid #e2e8f0',
              background: '#f8fafc', color: '#475569', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#3b82f6' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#e2e8f0' }}
          >📚 去浏览资源库 →</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>共收藏 {favoriteResources.length} 个资源</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {favoriteResources.map(item => <ResourceCard key={item.id} item={item} />)}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <TabNav />
      {activeTab === 'library' && <LibraryTab />}
      {activeTab === 'generate' && <GenerateTab />}
      {activeTab === 'favorites' && <FavoritesTab />}
    </div>
  )
}