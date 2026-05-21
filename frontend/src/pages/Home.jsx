import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '你好！我是 Vision-Forge 多智能体学习助手。\n\n我可以调用以下4个智能体为你服务：\n\n🏗️ **架构引导智能体** - 引导模型架构设计\n📖 **算法教研智能体** - 深入讲解算法原理\n📝 **资源生成智能体** - 生成专属学习资料\n📈 **学情评估智能体** - 评估学习效果\n\n请问你今天想学什么？', agent: 'system' }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentAgent, setCurrentAgent] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef(null)
  const historyRef = useRef(null)

  const agents = [
    { id: 'architect', name: '架构引导', icon: '🏗️', color: '#3b82f6', desc: '引导模型设计' },
    { id: 'tutor', name: '算法教研', icon: '📖', color: '#10b981', desc: '讲解算法原理' },
    { id: 'generator', name: '资源生成', icon: '📝', color: '#f59e0b', desc: '生成学习资料' },
    { id: 'evaluator', name: '学情评估', icon: '📈', color: '#8b5cf6', desc: '评估学习效果' },
  ]

  const historyList = [
    { id: 1, title: '如何学习计算机视觉？', date: '2024-01-15' },
    { id: 2, title: 'SAM 模型怎么用？', date: '2024-01-14' },
    { id: 3, title: '生成我的学习方案', date: '2024-01-13' },
    { id: 4, title: 'PyTorch入门教程', date: '2024-01-12' },
  ]

  const weeklyData = [
    { day: '周一', 时长: 4.5 },
    { day: '周二', 时长: 3.2 },
    { day: '周三', 时长: 5.1 },
    { day: '周四', 时长: 3.8 },
    { day: '周五', 时长: 4.2 },
    { day: '周六', 时长: 6.5 },
    { day: '周日', 时长: 5.5 },
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const sendMessage = () => {
    if (!input.trim()) return
    setMessages([...messages, { role: 'user', text: input }])
    setInput('')
    setIsTyping(true)
    setCurrentAgent(null)

    setTimeout(() => {
      setCurrentAgent('architect')
      setTimeout(() => {
        setCurrentAgent('tutor')
        setTimeout(() => {
          setCurrentAgent('generator')
          setTimeout(() => {
            let response = ''
            let agent = ''
            
            if (input.includes('模型') || input.includes('架构') || input.includes('搭建')) {
              agent = 'architect'
              response = '🏗️ 【架构引导智能体】\n\n根据你的需求，推荐使用 SAM 作为基础模型。\n\n**建议架构**：\n1. 图像编码器（ViT）\n2. 提示编码器\n3. 掩码解码器\n\n需要我继续讲解具体实现吗？'
            } else if (input.includes('算法') || input.includes('原理') || input.includes('源码')) {
              agent = 'tutor'
              response = '📖 【算法教研智能体】\n\nSAM 模型的核心代码结构：\n\n```python\nclass SAM(nn.Module):\n    def __init__(self):\n        self.image_encoder = ImageEncoder()\n        self.prompt_encoder = PromptEncoder()\n        self.mask_decoder = MaskDecoder()\n```\n\n核心创新：引入 Prompt 机制，实现可提示分割。'
            } else if (input.includes('生成') || input.includes('讲义') || input.includes('资源')) {
              agent = 'generator'
              response = '📝 【资源生成智能体】\n\n已为你生成专属学习资源：\n\n**📖 学习讲义**：SAM模型从入门到实战\n**📝 练习题**：5道选择题 + 3道编程题\n**🗺️ 思维导图**：知识体系全景图\n\n快去「资源中心」查看！'
            } else if (input.includes('评估') || input.includes('学情')) {
              agent = 'evaluator'
              response = '📈 【学情评估智能体】\n\n基于你的学习数据：\n\n**综合评分**：78分\n**优势**：知识掌握较好\n**待提升**：应用能力、创新思维\n**建议**：增加项目实战练习'
            } else {
              agent = 'architect'
              response = '🤖 我可以调用4个专业智能体为你服务：\n\n• 说 **"帮我设计模型架构"** → 🏗️ 架构引导智能体\n• 说 **"讲解算法原理"** → 📖 算法教研智能体\n• 说 **"生成学习资料"** → 📝 资源生成智能体\n• 说 **"评估学习效果"** → 📈 学情评估智能体\n\n试试问我这些问题吧！'
            }
            
            setMessages(prev => [...prev, { role: 'assistant', text: response, agent }])
            setCurrentAgent(null)
            setIsTyping(false)
          }, 800)
        }, 600)
      }, 600)
    }, 600)
  }

  const loadHistory = (title) => {
    setMessages([
      { role: 'user', text: title },
      { role: 'assistant', text: '已加载历史对话，你可以继续提问～' }
    ])
    setShowHistory(false)
  }

  const quickQuestions = ['帮我设计模型架构', '讲解SAM算法原理', '生成学习资料', '评估学习效果']

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* 左侧对话区域 */}
      <div style={{ flex: 2, background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* 多智能体协作状态条 */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ecf1', background: '#fafbfc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>🤖 多智能体协作中</span>
            <div style={{ display: 'flex', gap: 8, flex: 1 }}>
              {agents.map(agent => (
                <div key={agent.id} style={{
                  flex: 1, padding: '6px', background: currentAgent === agent.id ? agent.color + '20' : '#f1f5f9',
                  borderRadius: 8, textAlign: 'center', transition: 'all 0.3s'
                }}>
                  <span style={{ fontSize: 14 }}>{agent.icon}</span>
                  <div style={{ fontSize: 10, color: currentAgent === agent.id ? agent.color : '#94a3b8' }}>
                    {agent.name}
                    {currentAgent === agent.id && <span style={{ marginLeft: 4 }}>⚡</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 消息列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 400 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                background: m.role === 'user' ? '#3b82f6' : '#f1f5f9',
                color: m.role === 'user' ? '#fff' : '#1e293b',
                whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5
              }}>{m.text}</div>
            </div>
          ))}
          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: 12, background: '#f1f5f9' }}>
                <span className="dot">●</span><span className="dot">●</span><span className="dot">●</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div style={{ padding: 16, borderTop: '1px solid #e8ecf1' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {quickQuestions.map((q, i) => (
              <button key={i} onClick={() => { setInput(q); setTimeout(() => sendMessage(), 100) }} style={{
                padding: '6px 12px', fontSize: 11, background: '#f1f5f9', color: '#475569',
                boxShadow: 'none', borderRadius: 16
              }}>{q}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
              value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="输入你的问题，智能体会为你服务..." />
            <button onClick={sendMessage} style={{ padding: '0 24px', borderRadius: 10 }}>发送</button>
          </div>
        </div>
      </div>

      {/* 右侧面板 */}
      <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 历史对话按钮 */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowHistory(!showHistory)} style={{ width: '100%', padding: '10px', background: '#f1f5f9', color: '#475569', boxShadow: 'none' }}>
            📋 历史对话
          </button>
          {showHistory && (
            <div ref={historyRef} style={{ position: 'absolute', top: 50, left: 0, right: 0, background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10 }}>
              {historyList.map(item => (
                <div key={item.id} onClick={() => loadHistory(item.title)} style={{ padding: 8, borderRadius: 8, background: '#f8fafc', marginBottom: 8, cursor: 'pointer', fontSize: 12 }}>
                  {item.title}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 学习进度卡片 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h4 style={{ fontSize: 14, marginBottom: 12 }}>📊 学习进度</h4>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>总体完成度 <span>65%</span></div>
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99 }}><div style={{ width: '65%', height: '100%', background: '#3b82f6', borderRadius: 99 }}></div></div>
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>已完成 9/14 课程</div>
        </div>

        {/* 本周学习趋势 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h4 style={{ fontSize: 14, marginBottom: 12 }}>📈 本周学习趋势</h4>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={weeklyData}>
              <Tooltip />
              <Area type="monotone" dataKey="时长" stroke="#3b82f6" fill="#93c5fd" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 今日任务 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h4 style={{ fontSize: 14, marginBottom: 12 }}>📅 今日任务</h4>
          <div style={{ fontSize: 13, marginBottom: 8 }}>• 可视化模型搭建</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>• 查看学习方案</div>
          <div style={{ fontSize: 13 }}>• 学习推荐课程</div>
        </div>

        {/* 快捷入口 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h4 style={{ fontSize: 14, marginBottom: 12 }}>🚀 快捷入口</h4>
          <Link to="/canvas"><button style={{ width: '100%', marginBottom: 8, padding: 8 }}>🎨 模型工坊</button></Link>
          <Link to="/center"><button style={{ width: '100%', padding: 8, background: '#10b981' }}>📊 学情分析</button></Link>
        </div>
      </div>

      <style>{`
        .dot { display: inline-block; width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; margin: 0 2px; animation: pulse 1.2s infinite; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }
      `}</style>
    </div>
  )
}