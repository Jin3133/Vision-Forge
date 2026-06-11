import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchPipelineResult } from '../api' // ✅ 引入真实的后端请求接口

export default function Home() {
  /* ═══════════════ state ═══════════════ */
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '你好！我是 Vision-Forge 多智能体学习助手。\n\n我可以调用以下4个智能体为你服务：\n\n🏗️ **架构引导智能体** - 引导模型架构设计\n📖 **算法教研智能体** - 深入讲解算法原理\n📝 **资源生成智能体** - 生成专属学习资料\n📈 **学情评估智能体** - 评估学习效果\n\n请问你今天想学什么？',
      agent: 'system',
      time: formatTime(new Date()),
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [currentAgent, setCurrentAgent] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef(null)
  const historyRef = useRef(null)

  /* 画像评估状态 */
  const [portraitStep, setPortraitStep] = useState(0)
  const [portraitAnswers, setPortraitAnswers] = useState([])
  const portraitQuestions = [
    '🎯 第1/6问：你对计算机视觉领域的整体了解程度如何？（初学者/有基础/较深入）',
    '🎯 第2/6问：你更偏好的学习方式是什么？（看视频/读论文/动手实践/听课）',
    '🎯 第3/6问：你在深度学习框架（PyTorch/TensorFlow）上的熟练度如何？',
    '🎯 第4/6问：你对注意力机制（Attention）的理解程度如何？',
    '🎯 第5/6问：你每周能投入多少小时进行模型相关的学习？',
    '🎯 第6/6问：你最希望掌握的技能是什么？（模型设计/调参优化/论文复现/工程部署）',
  ]

  /* 今日任务 */
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('vf_tasks')
    return saved ? JSON.parse(saved) : [
      { id: 1, text: '可视化模型搭建', done: false },
      { id: 2, text: '查看学习方案', done: false },
      { id: 3, text: '学习推荐课程', done: false },
    ]
  })

  useEffect(() => {
    localStorage.setItem('vf_tasks', JSON.stringify(tasks))
  }, [tasks])

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  /* 智能体配置 */
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

  /* ═══════════════ helpers ═══════════════ */
  function formatTime(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages, streamText])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* 流式打字输出 */
  const typeMessage = (fullText, callback) => {
    let i = 0
    const interval = setInterval(() => {
      callback(fullText.slice(0, i + 1))
      i++
      if (i >= fullText.length) {
        clearInterval(interval)
        callback(null) // 表示结束
      }
    }, 15)
    return () => clearInterval(interval)
  }

  /* 渲染消息文本（支持代码块） */
  const renderMessageText = (text) => {
    const parts = text.split(/(```[\s\S]*?```)/g)
    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^(\w+)\n/, '')
        return (
          <pre key={idx} style={{
            background: '#1e293b', color: '#e2e8f0', padding: 12,
            borderRadius: 8, fontSize: 12, lineHeight: 1.6,
            overflowX: 'auto', margin: '8px 0', fontFamily: 'monospace',
          }}>
            <code>{code}</code>
          </pre>
        )
      }
      return <span key={idx} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
    })
  }

  /* ═══════════════ ✅ 发送消息 (核心修改区) ═══════════════ */
  const sendMessage = async (overrideText) => {
    const text = overrideText !== undefined ? overrideText : input
    if (!text.trim()) return

    /* 画像评估流程 (保持纯前端 UI 逻辑不变) */
    if (portraitStep > 0) {
      const newAnswers = [...portraitAnswers, text.trim()]
      setPortraitAnswers(newAnswers)
      setMessages(prev => [...prev, { role: 'user', text, time: formatTime(new Date()) }])
      setInput('')

      if (portraitStep < 6) {
        const nextQ = portraitQuestions[portraitStep]
        setPortraitStep(portraitStep + 1)
        setIsTyping(true)
        setStreamText('')
        typeMessage(nextQ, (chunk) => {
          if (chunk === null) {
            setMessages(prev => [...prev, {
              role: 'assistant', text: nextQ, agent: 'evaluator',
              time: formatTime(new Date()),
            }])
            setStreamText('')
            setIsTyping(false)
          } else {
            setStreamText(chunk)
          }
        })
      } else {
        setPortraitStep(0)
        setPortraitAnswers([])
        const report = generatePortraitReport(newAnswers)
        setIsTyping(true)
        setStreamText('')
        typeMessage(report, (chunk) => {
          if (chunk === null) {
            setMessages(prev => [...prev, {
              role: 'assistant', text: report, agent: 'evaluator',
              time: formatTime(new Date()),
            }])
            setStreamText('')
            setIsTyping(false)
          } else {
            setStreamText(chunk)
          }
        })
      }
      return
    }

    /* 真实业务对话流程：调用后端 API */
    setMessages(prev => [...prev, { role: 'user', text, time: formatTime(new Date()) }])
    setInput('')
    setIsTyping(true)

    // UI 特效：在等待后端返回时，循环点亮智能体图标
    let agentSequence = ['architect', 'tutor', 'generator', 'evaluator']
    let seqIndex = 0
    const agentInterval = setInterval(() => {
      setCurrentAgent(agentSequence[seqIndex % agentSequence.length])
      seqIndex++
    }, 600)

    try {
      // 1. 发起真实请求
      const result = await fetchPipelineResult(text)
      
      // 请求结束，关闭 UI 特效
      clearInterval(agentInterval)
      setCurrentAgent(null)

      // 2. 解析后端数据
      if (result.code === 200 && result.data) {
        const data = result.data
        const tutorReply = data.tutor_response || "四大智能体处理完毕，暂无文字输出。"
        const evalReport = data.evaluation_report || ""
        
        // 拼装后端返回的报文
        let finalContent = tutorReply
        if (evalReport) {
            finalContent += `\n\n📊 **【评估报告】**:\n${evalReport}`
        }

        // 3. 将后端数据传入原有的打字机函数
        setStreamText('')
        typeMessage(finalContent, (chunk) => {
          if (chunk === null) {
            setMessages(prev => [...prev, {
              role: 'assistant', text: finalContent, agent: 'system',
              time: formatTime(new Date()),
            }])
            setStreamText('')
            setIsTyping(false)
          } else {
            setStreamText(chunk)
          }
        })
      } else {
        throw new Error(result.message || "后端返回状态异常")
      }
    } catch (error) {
      clearInterval(agentInterval)
      setCurrentAgent(null)
      setIsTyping(false)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: `❌ 后端连接失败: ${error.message}\n请检查网络环境或跨域(CORS)配置。`, 
        agent: 'system', 
        time: formatTime(new Date()) 
      }])
    }
  }

  /* 生成画像评估报告 */
  const generatePortraitReport = (answers) => {
    return `📈 【学情评估智能体】画像评估报告\n\n基于你的6轮回答，为你生成专属学习画像：\n\n🎯 **学习风格**：${answers[1]?.includes('实践') ? '实践驱动型' : '理论驱动型'}\n📊 **基础水平**：${answers[0]?.includes('深入') ? '进阶' : answers[0]?.includes('基础') ? '中等' : '入门'}\n💻 **代码能力**：${answers[2]?.includes('熟练') ? '熟练' : '待提升'}\n🧠 **核心概念**：${answers[3]?.includes('深入') ? '掌握良好' : '需加强'}\n⏰ **投入时间**：${answers[4]}\n🌟 **目标技能**：${answers[5]}\n\n**个性化建议**：\n1. 推荐从 ${answers[0]?.includes('初学者') ? '理论基础' : '源码阅读'} 开始\n2. 每周保持 ${answers[4]?.match(/\d+/)?.[0] || '5'}h 学习节奏\n3. 重点加强 ${answers[3]?.includes('注意力') ? '注意力机制' : '框架使用'} 练习\n\n已为你生成专属学习方案，可前往「资源中心」查看！`
  }

  /* 加载历史对话 */
  const loadHistory = (title) => {
    setMessages([
      { role: 'user', text: title, time: formatTime(new Date()) },
      { role: 'assistant', text: '已加载历史对话，你可以继续提问～', time: formatTime(new Date()), agent: 'system' }
    ])
    setShowHistory(false)
  }

  /* 开始画像评估 */
  const startPortraitEval = () => {
    setPortraitStep(1)
    setPortraitAnswers([])
    setIsTyping(true)
    setStreamText('')
    const firstQ = portraitQuestions[0]
    typeMessage(firstQ, (chunk) => {
      if (chunk === null) {
        setMessages(prev => [...prev, {
          role: 'assistant', text: firstQ, agent: 'evaluator',
          time: formatTime(new Date()),
        }])
        setStreamText('')
        setIsTyping(false)
      } else {
        setStreamText(chunk)
      }
    })
  }

  const quickQuestions = [
    '帮我设计模型架构',
    '讲解SAM算法原理',
    '生成学习资料',
    '评估学习效果',
  ]

  /* 1+N 跨学科演示场景（农业遥感为旗舰标杆，N为可拓展领域） */
  const demoScenarios = [
    { icon: '🌾', name: '农业遥感', tag: '旗舰标杆', color: '#10b981', bg: '#f0fdf4', prompt: '我想用SAM做农作物长势监测和田块分割，请引导我设计模型架构' },
    { icon: '🩺', name: '医学影像', tag: '拓展', color: '#ef4444', bg: '#fef2f2', prompt: '帮我设计一个细胞分割的医学影像分析流程' },
    { icon: '🛒', name: '电商视觉', tag: '拓展', color: '#f59e0b', bg: '#fffbeb', prompt: '我想做商品视觉特征检测，帮我设计模型' },
    { icon: '🚗', name: '自动驾驶', tag: '拓展', color: '#3b82f6', bg: '#eff6ff', prompt: '帮我设计一个车道线和障碍物检测方案' },
  ]

  /* ═══════════════ render ═══════════════ */
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', height: 'calc(100vh - 96px)' }}>
      {/* ═══════ 左侧对话区 ═══════ */}
      <div style={{
        flex: 1, background: '#fff', borderRadius: 16, display: 'flex',
        flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        minWidth: 0,
      }}>
        {/* 多智能体协作状态条 + 中央状态机共享黑板 */}
        <div style={{ padding: '10px 16px 12px', borderBottom: '1px solid #e8ecf1', background: '#fafbfc', flexShrink: 0 }}>
          {/* 顶部：架构标识 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontWeight: 600 }}>4-Agent 协同架构 · 中央状态机（Task_State.json）· 共享黑板</span>
            </div>
            <span style={{ color: '#94a3b8' }}>基座：星火大模型 + LangGraph</span>
          </div>
          {/* 4个智能体状态卡 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>🤖 协作中</span>
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              {agents.map(agent => (
                <div key={agent.id} style={{
                  flex: 1, padding: '6px 8px',
                  background: currentAgent === agent.id ? agent.color + '20' : '#f1f5f9',
                  borderRadius: 8, textAlign: 'center', transition: 'all 0.3s',
                  border: currentAgent === agent.id ? `1.5px solid ${agent.color}` : '1.5px solid transparent',
                }}>
                  <span style={{ fontSize: 13 }}>{agent.icon}</span>
                  <div style={{ fontSize: 10, color: currentAgent === agent.id ? agent.color : '#94a3b8', fontWeight: currentAgent === agent.id ? 600 : 400 }}>
                    {agent.name}
                    {currentAgent === agent.id && <span style={{ marginLeft: 3 }}>⚡</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 消息列表 — 独立滚动 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 0 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              marginBottom: 16,
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{ maxWidth: '85%' }}>
                {/* 时间戳 */}
                <div style={{
                  fontSize: 10, color: '#94a3b8', marginBottom: 4,
                  textAlign: m.role === 'user' ? 'right' : 'left',
                  padding: m.role === 'user' ? '0 4px' : '0 4px',
                }}>
                  {m.time || ''}
                </div>
                <div style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: m.role === 'user' ? '#3b82f6' : '#f1f5f9',
                  color: m.role === 'user' ? '#fff' : '#1e293b',
                  fontSize: 13, lineHeight: 1.6,
                }}>
                  {renderMessageText(m.text)}
                </div>
              </div>
            </div>
          ))}

          {/* 流式输出中的消息 */}
          {isTyping && streamText && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
              <div style={{ maxWidth: '85%' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4, padding: '0 4px' }}>
                  {formatTime(new Date())}
                </div>
                <div style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: '#f1f5f9', color: '#1e293b',
                  fontSize: 13, lineHeight: 1.6,
                }}>
                  {renderMessageText(streamText)}
                  <span className="cursor-blink">▊</span>
                </div>
              </div>
            </div>
          )}

          {/* 正在输入提示（等待后端响应，无流式文本时） */}
          {isTyping && !streamText && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: 12, background: '#f1f5f9' }}>
                <span className="dot">●</span>
                <span className="dot">●</span>
                <span className="dot">●</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域（固定在底部） */}
        <div style={{ padding: 16, borderTop: '1px solid #e8ecf1', flexShrink: 0, background: '#fff' }}>
          {/* 1+N 跨学科演示场景 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>🌐 1+N 跨学科演示场景</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {demoScenarios.map((s) => (
                <button key={s.name} onClick={() => { setInput(s.prompt) }} style={{
                  padding: '5px 10px', fontSize: 11,
                  background: s.bg, color: s.color,
                  border: 'none', borderRadius: 14, cursor: 'pointer', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <span>{s.icon}</span>
                  <span>{s.name}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.7)', color: s.color, fontWeight: 700,
                  }}>{s.tag}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {quickQuestions.map((q, i) => (
              <button key={i} onClick={() => { setInput(q) }} style={{
                padding: '6px 12px', fontSize: 11, background: '#f1f5f9', color: '#475569',
                border: 'none', borderRadius: 16, cursor: 'pointer', fontWeight: 500,
              }}>{q}</button>
            ))}
            <button onClick={startPortraitEval} style={{
              padding: '6px 12px', fontSize: 11, background: '#eff6ff', color: '#3b82f6',
              border: 'none', borderRadius: 16, cursor: 'pointer', fontWeight: 600,
            }}>🎯 开始画像评估</button>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10,
                border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
              }}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={portraitStep > 0 ? '请回答上述问题...' : '输入你的问题，智能体会为你服务...'}
            />
            <button
              onClick={() => sendMessage()}
              style={{
                padding: '0 24px', borderRadius: 10, background: '#3b82f6',
                color: '#fff', border: 'none', fontWeight: 600,
                cursor: 'pointer', fontSize: 13,
              }}
            >发送</button>
          </div>
        </div>
      </div>

      {/* ═══════ 右侧面板 ═══════ — 固定高度独立滚动 */}
      <div style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12,
        height: '100%', overflowY: 'auto', overflowX: 'hidden',
      }}>
        {/* 历史对话按钮 */}
        <div style={{ position: 'relative' }} ref={historyRef}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              width: '100%', padding: '10px', background: '#f1f5f9', color: '#475569',
              border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 13,
              fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            📋 历史对话
            <span style={{ fontSize: 10, marginLeft: 'auto' }}>{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: '#fff', borderRadius: 12, padding: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10,
            }}>
              {historyList.map(item => (
                <div
                  key={item.id}
                  onClick={() => loadHistory(item.title)}
                  style={{
                    padding: 8, borderRadius: 8, background: '#f8fafc',
                    marginBottom: 8, cursor: 'pointer', fontSize: 12,
                    color: '#475569', fontWeight: 500,
                  }}
                >
                  <div>{item.title}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{item.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 今日任务 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 12px 0' }}>📅 今日任务</h4>
          {tasks.map(task => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0', cursor: 'pointer', fontSize: 12,
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4,
                border: task.done ? '2px solid #10b981' : '2px solid #cbd5e1',
                background: task.done ? '#10b981' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#fff', flexShrink: 0,
              }}>{task.done && '✓'}</div>
              <span style={{
                textDecoration: task.done ? 'line-through' : 'none',
                color: task.done ? '#94a3b8' : '#1e293b',
              }}>{task.text}</span>
            </div>
          ))}
        </div>

        {/* 本周学习趋势 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 12px 0' }}>📈 本周学习趋势</h4>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={weeklyData}>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none' }} />
              <Area type="monotone" dataKey="时长" stroke="#3b82f6" fill="#93c5fd" fillOpacity={0.3} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 快捷入口 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 12px 0' }}>🚀 快捷入口</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/canvas" style={{ textDecoration: 'none' }}>
              <button style={{
                width: '100%', padding: '8px 10px', fontSize: 12, background: '#f1f5f9', color: '#475569',
                border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 500,
              }}>🎨 模型工坊</button>
            </Link>
            <Link to="/center" style={{ textDecoration: 'none' }}>
              <button style={{
                width: '100%', padding: '8px 10px', fontSize: 12, background: '#eff6ff', color: '#3b82f6',
                border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 500,
              }}>📊 学情分析</button>
            </Link>
            <Link to="/resources" style={{ textDecoration: 'none' }}>
              <button style={{
                width: '100%', padding: '8px 10px', fontSize: 12, background: '#f0fdf4', color: '#10b981',
                border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 500,
              }}>📁 资源中心</button>
            </Link>
            <Link to="/tutor" style={{ textDecoration: 'none' }}>
              <button style={{
                width: '100%', padding: '8px 10px', fontSize: 12, background: '#fefce8', color: '#ca8a04',
                border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 500,
              }}>📚 知识辅导</button>
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════ styles ═══════ */}
      <style>{`
        .dot {
          display: inline-block;
          width: 6px; height: 6px;
          background: #3b82f6;
          border-radius: 50%;
          margin: 0 2px;
          animation: pulse 1.2s infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
        .cursor-blink {
          display: inline-block;
          color: #3b82f6;
          font-weight: bold;
          animation: blink 1s step-end infinite;
          margin-left: 1px;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}