import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Resources() {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [showGenerator, setShowGenerator] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState(null)
  const [userPrompt, setUserPrompt] = useState('')
  const [resourceType, setResourceType] = useState('讲义')

  const courses = [
    { id:1, title: 'SAM模型从入门到实战', cate: 'cv', progress: 20, collect: false,
      desc:'从零掌握视觉分割模型', author:'算法教研智能体', time:'4.5小时', type: 'video' },
    { id:2, title: 'PyTorch深度学习基础', cate: 'code', progress: 50, collect: true,
      desc:'深度学习框架快速入门', author:'算法教研智能体', time:'6小时', type: 'course' },
    { id:3, title: '注意力机制详解', cate: 'theory', progress: 80, collect: true,
      desc:'模型核心原理解析', author:'算法教研智能体', time:'2.5小时', type: 'article' },
    { id:4, title: '遥感图像分割实战', cate: 'project', progress: 0, collect: false,
      desc:'行业案例手把手教学', author:'架构引导智能体', time:'3小时', type: 'project' },
    { id:5, title: '计算机视觉思维导图', cate: 'mindmap', progress: 0, collect: false,
      desc:'知识体系全景图', author:'资源生成智能体', time:'1小时', type: 'mindmap' },
    { id:6, title: 'SAM模型练习题集', cate: 'quiz', progress: 0, collect: false,
      desc:'巩固知识点', author:'学情评估智能体', time:'1.5小时', type: 'quiz' },
  ]

  const filtered = courses.filter(item =>
    (tab === 'all' || item.cate === tab) &&
    item.title.includes(search)
  )

  // 多模态资源生成
  const generateResource = () => {
    if (!userPrompt) {
      alert('请输入你想要生成的学习内容')
      return
    }
    setGenerating(true)
    setTimeout(() => {
      setGeneratedContent({
        type: resourceType,
        title: `${userPrompt} - 专属学习资料`,
        content: resourceType === '讲义' ? `
# ${userPrompt} 学习讲义

## 一、学习目标
- 掌握${userPrompt}的核心概念
- 理解${userPrompt}的应用场景
- 能够独立完成相关实践

## 二、知识点梳理
1. **基础概念**：深入理解${userPrompt}的基本原理
2. **核心算法**：掌握关键算法实现
3. **实践应用**：通过案例巩固知识

## 三、学习路径
\`\`\`
基础理论 → 代码实践 → 项目实战 → 总结提升
\`\`\`

## 四、推荐资源
- 📖 推荐论文：相关经典文献
- 💻 代码仓库：GitHub开源项目
- 🎥 视频教程：配套讲解视频

## 五、练习题
1. 简述${userPrompt}的核心思想
2. 如何优化${userPrompt}的性能？
` : resourceType === '思维导图' ? `
# ${userPrompt} 知识思维导图

\`\`\`mermaid
mindmap
  root((${userPrompt}))
    (基础概念)
      [定义与特点]
      [发展历程]
    (核心原理)
      [算法机制]
      [数学模型]
    (应用场景)
      [图像识别]
      [目标检测]
      [语义分割]
    (实践工具)
      [PyTorch实现]
      [TensorFlow实现]
    (进阶方向)
      [模型优化]
      [部署落地]
\`\`\`
` : resourceType === '练习题' ? `
# ${userPrompt} 练习题

## 一、选择题
1. 关于${userPrompt}的描述，正确的是？
   A. 选项一  B. 选项二  C. 选项三  D. 选项四

2. ${userPrompt}的核心创新点是？
   A. 创新点一  B. 创新点二  C. 创新点三  D. 创新点四

## 二、简答题
1. 简述${userPrompt}的主要工作原理
2. ${userPrompt}有哪些优缺点？

## 三、实践题
1. 使用PyTorch实现一个简单的${userPrompt}模型
2. 针对具体场景优化${userPrompt}的性能

## 参考答案
（智能体生成中...）
` : `
# ${userPrompt} 实操案例

## 项目背景
本案例将带你完成一个基于${userPrompt}的实际项目

## 环境配置
\`\`\`bash
pip install torch torchvision
pip install opencv-python
\`\`\`

## 核心代码
\`\`\`python
import torch
import torch.nn as nn

class YourModel(nn.Module):
    def __init__(self):
        super().__init__()
        # 模型定义
        pass
    
    def forward(self, x):
        # 前向传播
        return x

# 训练代码
model = YourModel()
# 继续编写...
\`\`\`

## 运行结果
（智能体将根据你的代码生成结果分析）
` })
      setGenerating(false)
    }, 2000)
  }

  const resourceTypes = ['讲义', '思维导图', '练习题', '实操案例']

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 600 }}>学习资源中心</h2>
        <button onClick={() => setShowGenerator(!showGenerator)} style={{ padding: '10px 20px', borderRadius: 12 }}>
          🎨 多模态资源生成
        </button>
      </div>

      {/* 多模态资源生成器 */}
      {showGenerator && (
        <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 20, padding: 24, marginBottom: 24, color: '#fff' }}>
          <h3 style={{ marginBottom: 16 }}>✨ 多智能体协同资源生成</h3>
          <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 20 }}>选择资源类型，输入学习内容，智能体将为你生成专属学习资料</p>
          
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {resourceTypes.map(type => (
              <button
                key={type}
                onClick={() => setResourceType(type)}
                style={{
                  padding: '8px 20px', borderRadius: 20, fontSize: 13,
                  background: resourceType === type ? '#fff' : 'rgba(255,255,255,0.2)',
                  color: resourceType === type ? '#667eea' : '#fff',
                  boxShadow: 'none'
                }}
              >
                📄 {type}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none', fontSize: 14 }}
              placeholder="输入你想要学习的内容，如：SAM模型、注意力机制、图像分割..."
              value={userPrompt}
              onChange={e => setUserPrompt(e.target.value)}
            />
            <button onClick={generateResource} style={{ padding: '0 24px', background: '#fff', color: '#667eea', boxShadow: 'none' }} disabled={generating}>
              {generating ? '生成中...' : '生成资源'}
            </button>
          </div>
          
          {generating && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <span>🤖 多智能体协同中... 架构引导 → 算法教研 → 资源生成</span>
            </div>
          )}
          
          {generatedContent && !generating && (
            <div style={{ marginTop: 20, background: '#fff', borderRadius: 16, padding: 20, color: '#1e293b', maxHeight: 400, overflow: 'auto' }}>
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
                {generatedContent.content}
              </div>
              <button style={{ marginTop: 16, background: '#10b981' }}>📥 下载资源</button>
            </div>
          )}
        </div>
      )}

      {/* 分类标签 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('all')} style={{ padding: '8px 20px', borderRadius: 20, background: tab === 'all' ? '#3b82f6' : '#f1f5f9', color: tab === 'all' ? '#fff' : '#333', boxShadow: 'none' }}>全部</button>
        <button onClick={() => setTab('cv')} style={{ padding: '8px 20px', borderRadius: 20, background: tab === 'cv' ? '#3b82f6' : '#f1f5f9', color: tab === 'cv' ? '#fff' : '#333', boxShadow: 'none' }}>计算机视觉</button>
        <button onClick={() => setTab('code')} style={{ padding: '8px 20px', borderRadius: 20, background: tab === 'code' ? '#3b82f6' : '#f1f5f9', color: tab === 'code' ? '#fff' : '#333', boxShadow: 'none' }}>编程开发</button>
        <button onClick={() => setTab('theory')} style={{ padding: '8px 20px', borderRadius: 20, background: tab === 'theory' ? '#3b82f6' : '#f1f5f9', color: tab === 'theory' ? '#fff' : '#333', boxShadow: 'none' }}>理论基础</button>
        <button onClick={() => setTab('project')} style={{ padding: '8px 20px', borderRadius: 20, background: tab === 'project' ? '#3b82f6' : '#f1f5f9', color: tab === 'project' ? '#fff' : '#333', boxShadow: 'none' }}>项目实战</button>
        <button onClick={() => setTab('quiz')} style={{ padding: '8px 20px', borderRadius: 20, background: tab === 'quiz' ? '#3b82f6' : '#f1f5f9', color: tab === 'quiz' ? '#fff' : '#333', boxShadow: 'none' }}>练习题</button>
      </div>

      {/* 搜索框 */}
      <input
        placeholder="搜索课程、讲义、项目..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24 }}
      />

      {/* 资源网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
        {filtered.map(item => (
          <div key={item.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'transform 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{
              height: 120,
              background: item.type === 'video' ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' :
                         item.type === 'course' ? 'linear-gradient(135deg,#10b981,#34d399)' :
                         item.type === 'project' ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' :
                         'linear-gradient(135deg,#8b5cf6,#c4b5fd)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 48
            }}>
              {item.type === 'video' ? '🎬' : item.type === 'course' ? '📚' : item.type === 'project' ? '🚀' : item.type === 'mindmap' ? '🗺️' : item.type === 'quiz' ? '📝' : '📄'}
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 16, margin: 0 }}>{item.title}</h3>
                <span style={{ color: item.collect ? '#f59e0b' : '#94a3b8', fontSize: 18, cursor: 'pointer' }}>⭐</span>
              </div>
              <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>{item.desc}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                <span>👨‍🏫 {item.author}</span>
                <span>⏱️ {item.time}</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>学习进度</span>
                  <span>{item.progress}%</span>
                </div>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99 }}>
                  <div style={{ width: `${item.progress}%`, height: '100%', background: '#3b82f6', borderRadius: 99 }}></div>
                </div>
              </div>
              <button style={{ width: '100%', padding: 10, borderRadius: 10 }}>开始学习 →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}