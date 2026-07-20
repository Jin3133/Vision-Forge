import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, RadialBarChart, RadialBar, AreaChart, Area } from 'recharts'
import { useLearn } from '../LearnContext.jsx'

export default function Home() {
  const learn = useLearn()
  const navigate = useNavigate()

  /* ═══════════════ state ═══════════════ */
  const [messages, setMessagesRaw] = useState(() => {
    // 从 localStorage 恢复消息历史（按 session 隔离，切页面不丢失）
    const sid = localStorage.getItem('vf_session_id')
    if (sid) {
      const saved = localStorage.getItem(`vf_messages_${sid}`)
      if (saved) {
        try { return JSON.parse(saved) } catch (_) {}
      }
    }
    return [{
      role: 'assistant',
      text: `你好！我是你的 AI 导师。\n\n我看到你的学习目标是：**${learn.goal === '自定义目标' ? learn.customGoal || '自定义目标' : learn.goal}**\n当前主线任务阶段：${learn.currentStageIdx + 1} / ${learn.mainStages.length} — **${learn.stage}**\n\n我会调度 4 个智能体（架构引导 · 算法教研 · 资源生成 · 学情评估）围绕这条主线为你服务。请问你接下来想做什么？`,
      agent: 'system',
      time: formatTime(new Date()),
    }]
  })

  // 封装 setMessages，每次更新自动同步到 localStorage + 更新对话索引
  const setMessages = (valOrFn) => {
    setMessagesRaw(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn
      try { localStorage.setItem(`vf_messages_${sessionId}`, JSON.stringify(next)) } catch (_) {}
      return next
    })
  }
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState([]) // { name, type, size, dataUrl }
  const [isTyping, setIsTyping] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [currentAgent, setCurrentAgent] = useState(null)
  const [agentStage, setAgentStage] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(false)
  // 会话 ID 管理（支持开启新对话）
  const [sessionId, setSessionIdRaw] = useState(() => {
    const saved = localStorage.getItem('vf_session_id')
    if (saved) return saved
    return newSessionId()
  })
  function newSessionId() {
    const id = 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
    localStorage.setItem('vf_session_id', id)
    return id
  }

  // 对话索引管理
  function getConversations() {
    try { return JSON.parse(localStorage.getItem('vf_conversations') || '[]') } catch (_) { return [] }
  }
  function saveConversations(list) {
    try { localStorage.setItem('vf_conversations', JSON.stringify(list)) } catch (_) {}
  }

  // 当前会话标题（取第一条用户消息的前 20 字）
  const [conversationTitle, setConversationTitle] = useState(() => {
    const list = getConversations()
    const cur = list.find(c => c.sessionId === sessionId)
    return cur?.title || '新对话'
  })
  const messagesEndRef = useRef(null)
  const historyRef = useRef(null)
  /* historyRef 现在挂在对话 Tab 顶部的"📜 历史"按钮上 */

  /* 注：源码阅读已迁移到模型工坊（详见 Canvas.jsx 的 SourceCodeDrawer），首页只剩对话，不再需要 Tab 切换 */

  /* 画像评估状态（保留原逻辑） */
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

  /* 今日 PBL 学习任务（升级：可勾选 / 标阶段） */
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('vf_tasks')
    return saved ? JSON.parse(saved) : [
      { id: 1, text: '理解卷积运算原理', stage: '理论', done: true },
      { id: 2, text: '阅读 SAM 论文摘要', stage: '阅读', done: true },
      { id: 3, text: '搭建第一个 Encoder-Decoder', stage: '实践', done: false },
      { id: 4, text: '完成本周实验记录', stage: '复盘', done: false },
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

  /* 6 维画像（学习驾驶舱核心数据） */
  const portrait = useMemo(() => {
    const dims = learn.learnerPortrait?.dimensions || {}
    const colorMap = { '知识掌握': '#3b82f6', '代码能力': '#06b6d4', '认知风格': '#22c55e', '学习节奏': '#eab308', '兴趣程度': '#a855f7', '易错点': '#ef4444' }
    const iconMap = { '知识掌握': '📚', '代码能力': '💻', '认知风格': '🧠', '学习节奏': '⏱️', '兴趣程度': '⭐', '易错点': '⚠️' }
    return Object.entries(dims).map(([key, d]) => ({ key, value: d.value || 0, color: colorMap[key] || '#3b82f6', icon: iconMap[key] || '📊' }))
  }, [learn.learnerPortrait])
  const portraitAvg = Math.round(portrait.reduce((s, d) => s + d.value, 0) / Math.max(1, portrait.length))

  /* ═══════════════ Dashboard 数据（从 LearnContext 动态计算） ═══════════════ */
  const isNewUser = !learn.onboarded || !learn.goal
  const completedStages = learn.mainStages?.filter(s => s.done)?.length || 0
  const totalStages = isNewUser ? 0 : (learn.mainStages?.length || 4)
  const currentStage = learn.mainStages?.find(s => !s.done) || learn.mainStages?.[learn.mainStages?.length - 1] || {}

  /* 最近活动 */
  const recentActivities = useMemo(() => {
    if (isNewUser) return [{ time: '👋', text: '完成首启引导，选择你的学习目标', icon: '🚀', color: '#3b82f6' }]
    const acts = []
    if (learn.goal) acts.push({ time: '今日', text: `学习目标：${learn.goal === '自定义目标' ? (learn.customGoal || '自定义') : learn.goal}`, icon: '🎯', color: '#8b5cf6' })
    if (completedStages > 0) acts.push({ time: '进度', text: `已完成 ${completedStages}/${totalStages} 个学习阶段`, icon: '✅', color: '#10b981' })
    if (learn.weakTopics?.length > 0) acts.push({ time: '待攻克', text: `易错点：${learn.weakTopics[0]}`, icon: '⚠️', color: '#f59e0b' })
    return acts.length > 0 ? acts : [{ time: '💬', text: '在首页与 AI 导师对话开始学习', icon: '💬', color: '#8b5cf6' }]
  }, [isNewUser, learn.goal, learn.customGoal, completedStages, totalStages, learn.weakTopics])

  /* ① 今日学习数据 */
  const todayStats = useMemo(() => ({
    studyMinutes: isNewUser ? 0 : Math.round((learn.learningPace || 0) * 60 / 7),
    studyDays: isNewUser ? 0 : Math.max(1, completedStages),
    completedTasks: completedStages,
    totalTasks: totalStages || '—',
    points: isNewUser ? 0 : (learn.learnerPortrait?.overallScore || 0),
  }), [isNewUser, learn.learningPace, completedStages, totalStages, learn.learnerPortrait])

  /* ⑤ 继续学习 */
  const continueLearning = isNewUser
    ? { title: '欢迎来到 Vision-Forge', type: '新手引导', progress: 0, lastTime: '现在开始', from: '完成首启引导，解锁个性化学习路径' }
    : { title: currentStage.title || '继续学习', type: currentStage.agent || '学习任务', progress: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0, lastTime: '最近活跃', from: `阶段 ${(learn.currentStageIdx || 0) + 1} · ${learn.stage || ''}` }

  /* ② 最近学习（新用户不显示种子数据） */
  const recentLearnings = useMemo(() => {
    if (isNewUser) return []
    const entries = Object.entries(learn.knowledgeMap || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const colors = [{ color: '#3b82f6', bg: '#eff6ff', icon: '📖' }, { color: '#8b5cf6', bg: '#faf5ff', icon: '🎬' }, { color: '#10b981', bg: '#f0fdf4', icon: '📄' }]
    return entries.map(([name, val], i) => ({ id: i + 1, type: '知识点', title: `${name}（${val}%）`, meta: val >= 80 ? '已掌握' : '学习中', tag: val >= 80 ? '已掌握' : '学习中', color: colors[i].color, bg: colors[i].bg, icon: colors[i].icon }))
  }, [isNewUser, learn.knowledgeMap])

  /* ③ 最近实验 */
  const recentExperiments = useMemo(() => {
    if (isNewUser) return []
    const saved = (() => { try { return JSON.parse(localStorage.getItem('vf_canvas_snapshots') || '[]') } catch (_) { return [] } })()
    if (saved.length > 0) return saved.slice(0, 3).map((s, i) => ({ id: i + 1, name: s.label || `快照 ${i + 1}`, status: '已保存', score: null, accuracy: `${s.nodes || 0} 节点`, time: s.time || '', color: '#3b82f6', icon: '🧪' }))
    return [{ id: 1, name: '在模型工坊开始首次实验', status: '待开始', score: null, accuracy: '拖拽算子搭建模型', time: '新手指引', color: '#3b82f6', icon: '🧪' }]
  }, [isNewUser])

  /* ④ AI 推荐 */
  const aiRecommendations = useMemo(() => {
    if (isNewUser) return {
      task: { icon: '🎯', tag: '第一步', title: '完成首启引导', desc: '选择学习目标，AI 为你定制专属路径', cta: '去引导页', color: '#3b82f6', bg: '#eff6ff' },
      course: { icon: '🎬', tag: '推荐', title: '《SAM 入门到精通》P1', desc: '新手友好 · 从零理解视觉大模型', cta: '去学习', color: '#8b5cf6', bg: '#faf5ff' },
      resource: { icon: '📚', tag: '必读', title: '5 篇 CV 入门论文', desc: '为新学员精选的入门读物', cta: '去查看', color: '#ec4899', bg: '#fdf2f8' },
    }
    const recs = {}
    if (learn.weakTopics?.length > 0) recs.task = { icon: '🎯', tag: '巩固', title: `攻克：${learn.weakTopics[0]}`, desc: '基于学情分析推荐', cta: '去完成', color: '#3b82f6', bg: '#eff6ff' }
    else recs.task = { icon: '🎯', tag: '推荐', title: '在模型工坊搭建首个模型', desc: '拖拽算子，可视化构建', cta: '去完成', color: '#3b82f6', bg: '#eff6ff' }
    const lowK = Object.entries(learn.knowledgeMap || {}).filter(([, v]) => v > 0 && v < 40).sort((a, b) => a[1] - b[1])[0]
    recs.course = lowK ? { icon: '🎬', tag: '补强', title: `${lowK[0]}（${lowK[1]}%）`, desc: '知识掌握度分析推荐', cta: '去学习', color: '#8b5cf6', bg: '#faf5ff' } : { icon: '🎬', tag: '推荐', title: '《SAM 入门到精通》P3', desc: '模型微调实战', cta: '去学习', color: '#8b5cf6', bg: '#faf5ff' }
    recs.resource = learn.goal ? { icon: '📚', tag: '推荐', title: `${learn.goal} 拓展阅读`, desc: '精选论文与实操', cta: '去查看', color: '#ec4899', bg: '#fdf2f8' } : { icon: '📚', tag: '推荐', title: 'CV 必读论文合集', desc: '编辑精选', cta: '去查看', color: '#ec4899', bg: '#fdf2f8' }
    return recs
  }, [isNewUser, learn.weakTopics, learn.knowledgeMap, learn.goal])

  /* 本周进度 */
  const weekProgress = isNewUser ? 0 : (totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0)

  /* 任务阶段 */
  const stages = [
    { id: 1, name: '正在分析学习需求', agentId: 'architect' },
    { id: 2, name: '正在检索源码 / 论文', agentId: 'tutor' },
    { id: 3, name: '正在生成讲义 / 路径', agentId: 'generator' },
    { id: 4, name: '正在评估学习效果', agentId: 'evaluator' },
  ]

  const historyList = learn.goal
    ? [{ id: 1, title: `学习目标：${learn.goal}`, date: new Date().toISOString().slice(0, 10) }]
    : [{ id: 1, title: '欢迎来到 Vision-Forge', date: new Date().toISOString().slice(0, 10) }]

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

  /* ═══════════════ 发送消息 ═══════════════ */
  const sendMessage = async (overrideText) => {
    const text = overrideText !== undefined ? overrideText : input
    if (!text.trim()) return

    /* 画像评估流程 */
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
        // 更新 LearnContext 中的 6 维学习画像
        try {
          const portraitData = learn.computePortraitFromAnswers?.(newAnswers)
          if (portraitData) {
            setMessages(prev => [...prev, {
              role: 'assistant', text: `✅ 学习画像已更新！综合评分：${portraitData.overallScore} 分。前往「学习中心 → 学情分析」查看你的 6 维能力雷达图。`, agent: 'evaluator',
              time: formatTime(new Date()),
            }])
            setStreamText('')
            setIsTyping(false)
            setInput('')
            return
          }
        } catch (e) { console.warn('画像更新失败:', e) }
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

    setMessages(prev => [...prev, { role: 'user', text, time: formatTime(new Date()) }])
    setInput('')
    setIsTyping(true)
    setStreamText('')
    setAgentStage(1)

    // 发送对话请求（流式接收 SSE，逐段展示打字效果）
    ;(async () => {
      try {
        const resp = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_intent: text, session_id: sessionId }),
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let navEvent = null
        let contentAcc = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          // 解析每个完整的 SSE 事件
          const events = buf.split('\n\n')
          buf = events.pop() || ''
          for (const evt of events) {
            const lines = evt.split('\n')
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              try {
                const e = JSON.parse(line.slice(6))
                if (e.event === 'content') {
                  contentAcc += e.text
                  setStreamText(contentAcc)
                } else if (e.event === 'navigate') {
                  navEvent = e
                } else if (e.event === 'done') {
                  const data = e.data || {}
                  const final = contentAcc || data.evaluation_results?.tutor_response || ''
                  setAgentStage(0); setCurrentAgent(null); setStreamText(''); setIsTyping(false)
                  setMessages(prev => [...prev, {
                    role: 'assistant', text: final, agent: 'system', time: formatTime(new Date()),
                    ...(navEvent?.target === 'canvas' ? { _canvasGuide: true, _sessionId: data.session_id || sessionId } : {}),
                  }])
                  return
                } else if (e.event === 'error') {
                  throw new Error(e.message || '智能体执行失败')
                }
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        setAgentStage(0); setCurrentAgent(null); setStreamText(''); setIsTyping(false)
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: `❌ 请求失败: ${err.message}\n\n请检查后端是否正常运行。`,
          agent: 'system', time: formatTime(new Date()),
        }])
      }
    })()
  }

  /* 生成画像评估报告 */
  const generatePortraitReport = (answers) => {
    return `📈 【学情评估智能体】画像评估报告\n\n基于你的6轮回答，为你生成专属学习画像：\n\n🎯 **学习风格**：${answers[1]?.includes('实践') ? '实践驱动型' : '理论驱动型'}\n📊 **基础水平**：${answers[0]?.includes('深入') ? '进阶' : answers[0]?.includes('基础') ? '中等' : '入门'}\n💻 **代码能力**：${answers[2]?.includes('熟练') ? '熟练' : '待提升'}\n🧠 **核心概念**：${answers[3]?.includes('深入') ? '掌握良好' : '需加强'}\n⏰ **投入时间**：${answers[4]}\n🌟 **目标技能**：${answers[5]}\n\n**个性化建议**：\n1. 推荐从 ${answers[0]?.includes('初学者') ? '理论基础' : '源码阅读'} 开始\n2. 每周保持 ${answers[4]?.match(/\d+/)?.[0] || '5'}h 学习节奏\n3. 重点加强 ${answers[3]?.includes('注意力') ? '注意力机制' : '框架使用'} 练习\n\n已为你生成专属学习方案，可前往「资源中心」查看！`
  }

  /* 加载历史对话 */
  const loadHistory = (conv) => {
    try {
      const saved = localStorage.getItem(`vf_messages_${conv.sessionId}`)
      if (saved) {
        const msgs = JSON.parse(saved)
        setMessagesRaw(msgs)
        localStorage.setItem('vf_session_id', conv.sessionId)
        setSessionIdRaw(conv.sessionId)
        setConversationTitle(conv.title || '历史对话')
      }
    } catch (_) {
      setMessagesRaw([
        { role: 'assistant', text: '无法加载该对话记录', time: formatTime(new Date()), agent: 'system' }
      ])
    }
    setShowHistory(false)
  }

  const startNewConversation = () => {
    const sid = newSessionId()
    setSessionIdRaw(sid)
    setMessagesRaw([])
    setConversationTitle('新对话')
    setShowHistory(false)
    setInput('')
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

  /* 主线任务面板：单行紧凑进度条（信息密度+高度平衡） */
  const MainStages = () => {
    const total = learn.mainStages.length || 1
    const doneCount = learn.mainStages.filter(s => s.done).length
    const progress = Math.round((doneCount / total) * 100)
    const cur = learn.mainStages[learn.currentStageIdx]
    const next = learn.mainStages[learn.currentStageIdx + 1]
    const goalShort = learn.goal === '自定义目标'
      ? (learn.customGoal || '自定义')
      : (learn.goal || '尚未选择')
    return (
      <div style={{
        background: 'linear-gradient(90deg, #eff6ff 0%, #f5f3ff 50%, #fef3f8 100%)',
        border: '1px solid #c7d2fe', borderRadius: 10, padding: '6px 12px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {/* 左侧：图标 + 目标 + 阶段进度 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 0 }}>
          <span style={{ fontSize: 15 }}>🧭</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#1e293b',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: 160,
              }} title={goalShort}>
                🎯 {goalShort}
              </span>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: '#3b82f6', color: '#fff', fontWeight: 700, flexShrink: 0,
              }}>{progress}%</span>
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
              {cur
                ? <>阶段 <strong>{learn.currentStageIdx + 1}</strong> · {cur.title}</>
                : <>全部完成 🎉</>}
            </div>
          </div>
        </div>

        {/* 中间：5 个圆点 + 连接线（更醒目） */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative', minWidth: 0, padding: '0 4px' }}>
          {/* 进度条背景 */}
          <div style={{
            position: 'absolute', left: 4, right: 4, top: '50%',
            height: 4, background: '#e2e8f0', borderRadius: 3, transform: 'translateY(-50%)',
          }} />
          {/* 已完成部分（更粗更亮） */}
          <div style={{
            position: 'absolute', left: 4, top: '50%',
            width: `calc(${progress}% - 8px)`, maxWidth: 'calc(100% - 8px)',
            height: 4,
            background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
            borderRadius: 3, transform: 'translateY(-50%)',
            transition: 'width 0.5s ease',
            boxShadow: '0 0 8px rgba(99,102,241,0.4)',
          }} />
          {learn.mainStages.map((st, idx) => {
            const isDone = st.done
            const isCurrent = idx === learn.currentStageIdx && !isDone
            // 5 阶段对应跳转：理论→资源中心 / 源码（已并入工坊）→模型工坊 / 搭建→模型工坊 / 实验→实验记录 / 复盘→学习画像
            // 注：阶段 2「阅读关键源码」已迁移到模型工坊（点节点自动联动），点击阶段 2 也直接跳工坊
            const stageLinks = [
              '/resources?tab=recommend',     // 阶段1：理解基础概念 → 推荐资源讲义
              '/canvas?tab=workshop',         // 阶段2：阅读源码 + 搭建模型 → 模型工坊
              '/canvas?tab=record',           // 阶段3：完成实验记录 → 实验记录
              '/center?tab=portrait',         // 阶段4：项目实战复盘 → 学习画像（含学习路径时间线）
            ]
            const link = stageLinks[idx] || '/'
            const handleStageClick = (e) => {
              e.stopPropagation()
              window.location.hash = '#' + link
            }
            return (
              <div key={st.id} onClick={handleStageClick} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', zIndex: 1, cursor: 'pointer',
              }} title={`阶段${st.id} · ${st.title} — ${st.desc}（点击进入）`}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: isDone ? '#10b981' : isCurrent ? '#fff' : '#fff',
                  border: isCurrent ? '3px solid #6366f1' : isDone ? '3px solid #10b981' : '3px solid #cbd5e1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700,
                  color: isDone ? '#fff' : isCurrent ? '#6366f1' : '#94a3b8',
                  boxShadow: isCurrent ? '0 0 0 4px rgba(99,102,241,0.18)' : 'none',
                  animation: isCurrent ? 'pulse 2s infinite' : 'none',
                }}>
                  {isDone ? '✓' : st.id}
                </div>
              </div>
            )
          })}
        </div>

        {/* 右侧：下一阶段提示 + 完成按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {next ? (
            <span style={{
              fontSize: 10, color: '#94a3b8',
              padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.5)',
              whiteSpace: 'nowrap',
            }} title={next.desc}>
              下一站：<strong style={{ color: '#475569' }}>{next.title}</strong>
            </span>
          ) : null}
          {doneCount < learn.mainStages.length ? (
            <button
              onClick={() => learn.advanceStage()}
              style={{
                padding: '4px 10px', fontSize: 10, fontWeight: 700,
                background: '#3b82f6', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >完成 →</button>
          ) : (
            <span style={{
              fontSize: 10, padding: '4px 8px', borderRadius: 6,
              background: '#f0fdf4', color: '#15803d', fontWeight: 700,
            }}>🎉 全部完成</span>
          )}
        </div>

      </div>
    )
  }

  /* 共享黑板面板（美化 JSON） */
  const Blackboard = () => {
    const lines = JSON.stringify(learn.blackboard, null, 2).split('\n')
    return (
      <div style={{
        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
        width: 360, background: '#0f172a', color: '#e2e8f0',
        borderRadius: 12, padding: 14, fontSize: 11,
        fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 11 }}>📓 Task_State.json · 共享黑板</span>
          <span style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
            background: '#10b981', color: '#fff', fontWeight: 600,
          }}>实时</span>
        </div>
        <div style={{ lineHeight: 1.7 }}>
          {lines.map((line, i) => {
            const isKey = line.includes(':') && !line.trim().startsWith('[')
            const indent = (line.match(/^\s*/) || [''])[0].length
            return (
              <div key={i} style={{ paddingLeft: indent * 6 }}>
                <span style={{ color: isKey ? '#7dd3fc' : '#fbbf24' }}>
                  {line}
                </span>
              </div>
            )
          })}
        </div>
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: '1px solid #1e293b',
          fontSize: 10, color: '#64748b', lineHeight: 1.6,
        }}>
          💡 这就是 4 智能体共用的「中央状态机」：画像 / 资源 / 评估都围绕它在变化。
        </div>
      </div>
    )
  }

  /* ═══════════════ render ═══════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 96px)' }}>
      {/* ── 顶部：AI 导师主线任务（保留） ── */}
      <MainStages />

      {/* ── 中部：左对话区 + 右 Dashboard ── */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* ════ 左侧：对话大区（占主要空间） ════ */}
        <div style={{
          flex: 1, background: '#fff', borderRadius: 14, display: 'flex',
          flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          minWidth: 0,
        }}>
          {/* 顶部工具栏 */}
          <div style={{
            padding: '6px 16px', borderBottom: '1px solid #e8ecf1',
            background: '#fff', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
          }}>
            <span style={{ fontSize: 10, color: '#94a3b8', marginRight: 'auto' }}>{conversationTitle}</span>
            <button onClick={startNewConversation} title="开启新对话" style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 6,
              background: '#f0fdf4', color: '#059669',
              border: '1px solid #a7f3d0', cursor: 'pointer', fontWeight: 600,
            }}>➕ 新对话</button>
            <div style={{ position: 'relative' }} ref={historyRef}>
              <button onClick={() => setShowHistory(!showHistory)} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 6,
                background: showHistory ? '#eff6ff' : '#f8fafc',
                color: showHistory ? '#3b82f6' : '#475569',
                border: '1px solid ' + (showHistory ? '#bfdbfe' : '#e2e8f0'),
                cursor: 'pointer', fontWeight: 600,
              }}>📜 历史</button>
              {showHistory && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  width: 280, background: '#fff', borderRadius: 10, padding: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 30,
                  border: '1px solid #e2e8f0', maxHeight: 360, overflow: 'auto',
                }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', padding: '4px 6px', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>📋 历史对话</span>
                    <span style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => {
                      if (confirm('确定清空所有历史对话？')) { saveConversations([]); setShowHistory(false) }
                    }}>清空</span>
                  </div>
                  {getConversations().length === 0 ? (
                    <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 12 }}>暂无历史对话</div>
                  ) : getConversations().map(conv => (
                    <div key={conv.sessionId} onClick={() => loadHistory(conv)} style={{
                      padding: '8px 10px', borderRadius: 6,
                      background: conv.sessionId === sessionId ? '#eff6ff' : '#f8fafc',
                      marginBottom: 4, cursor: 'pointer', fontSize: 11,
                      color: conv.sessionId === sessionId ? '#3b82f6' : '#475569', fontWeight: 500,
                      border: conv.sessionId === sessionId ? '1px solid #bfdbfe' : '1px solid transparent',
                    }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.sessionId === sessionId && <span style={{ fontSize: 8, color: '#3b82f6', marginRight: 4 }}>●</span>}
                        {conv.title || '新对话'}
                      </div>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{conv.createdAt ? new Date(conv.createdAt).toLocaleDateString('zh-CN') : ''}</span>
                        <span>{conv.messageCount || 0} 条消息</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 消息列表 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 0 }}>
            {messages.map((m, i) => (
                  <div key={i} style={{
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{ maxWidth: '85%' }}>
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
                        {/* Canvas 引导按钮：苏格拉底对话完成后出现 */}
                        {m._canvasGuide && (
                          <div style={{ marginTop: 12, textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                const sid = m._sessionId || sessionId
                                navigate(`/canvas?tab=workshop&session=${encodeURIComponent(sid)}`)
                              }}
                              style={{
                                padding: '10px 28px',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: '#fff', border: 'none', borderRadius: 10,
                                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => e.target.style.transform = 'scale(1.03)'}
                              onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                            >
                              🏗️ 前往模型工坊，动手搭建
                            </button>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                              拖拽算子节点，亲手搭建你的模型架构 →
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

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

              {/* 输入区域 */}
              <div style={{ padding: '10px 16px 14px', borderTop: '1px solid #e8ecf1', flexShrink: 0, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: showQuickStart ? 10 : 0, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowQuickStart(!showQuickStart)}
                    style={{
                      padding: '4px 10px', fontSize: 11,
                      background: showQuickStart ? '#eff6ff' : '#f8fafc',
                      color: showQuickStart ? '#3b82f6' : '#64748b',
                      border: '1px solid ' + (showQuickStart ? '#bfdbfe' : '#e2e8f0'),
                      borderRadius: 12, cursor: 'pointer', fontWeight: 500,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >⚡ 快捷入口 <span style={{ fontSize: 9 }}>{showQuickStart ? '▲' : '▼'}</span></button>
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => { setInput(quickQuestions[0]) }} style={{
                      padding: '4px 10px', fontSize: 11, background: '#f8fafc', color: '#475569',
                      border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', fontWeight: 500,
                    }}>🏗️ 设计架构</button>
                    <span style={{
                      position: 'absolute', top: -4, right: -4, fontSize: 8, padding: '1px 4px',
                      background: '#f59e0b', color: '#fff', borderRadius: 6, fontWeight: 700,
                      boxShadow: '0 1px 3px rgba(245,158,11,0.4)',
                    }}>⚡直达</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => { setInput(quickQuestions[1]) }} style={{
                      padding: '4px 10px', fontSize: 11, background: '#f8fafc', color: '#475569',
                      border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', fontWeight: 500,
                    }}>📖 讲解 SAM</button>
                    <span style={{
                      position: 'absolute', top: -4, right: -4, fontSize: 8, padding: '1px 4px',
                      background: '#f59e0b', color: '#fff', borderRadius: 6, fontWeight: 700,
                      boxShadow: '0 1px 3px rgba(245,158,11,0.4)',
                    }}>⚡直达</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => { window.location.hash = '#/canvas?tab=workshop' }} style={{
                      padding: '4px 10px', fontSize: 11, background: '#eff6ff', color: '#3b82f6',
                      border: '1px solid #bfdbfe', borderRadius: 12, cursor: 'pointer', fontWeight: 600,
                    }}>🛠️ 打开工坊</button>
                    <span style={{
                      position: 'absolute', top: -4, right: -4, fontSize: 8, padding: '1px 4px',
                      background: '#f59e0b', color: '#fff', borderRadius: 6, fontWeight: 700,
                      boxShadow: '0 1px 3px rgba(245,158,11,0.4)',
                    }}>⚡直达</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button onClick={startPortraitEval} style={{
                      padding: '4px 10px', fontSize: 11, background: '#faf5ff', color: '#8b5cf6',
                      border: '1px solid #ddd6fe', borderRadius: 12, cursor: 'pointer', fontWeight: 600,
                    }}>🎯 画像评估</button>
                    <span style={{
                      position: 'absolute', top: -4, right: -4, fontSize: 8, padding: '1px 4px',
                      background: '#f59e0b', color: '#fff', borderRadius: 6, fontWeight: 700,
                      boxShadow: '0 1px 3px rgba(245,158,11,0.4)',
                    }}>⚡直达</span>
                  </div>
                </div>

                {showQuickStart && (
                  <div style={{
                    padding: 10, marginBottom: 10, borderRadius: 10,
                    background: '#f8fafc', border: '1px dashed #e2e8f0',
                    animation: 'fadeIn 0.2s ease',
                  }}>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>🌐 1+N 跨学科演示场景</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {demoScenarios.map((s) => (
                        <div key={s.name} style={{ position: 'relative', display: 'inline-block' }}>
                          <button onClick={() => { setInput(s.prompt); setShowQuickStart(false) }} style={{
                            padding: '4px 9px', fontSize: 11,
                            background: s.bg, color: s.color,
                            border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                            <span>{s.icon}</span>
                            <span>{s.name}</span>
                            <span style={{
                              fontSize: 9, padding: '1px 4px', borderRadius: 5,
                              background: 'rgba(255,255,255,0.7)', color: s.color, fontWeight: 700,
                            }}>{s.tag}</span>
                          </button>
                          <span style={{
                            position: 'absolute', top: -5, right: -5, fontSize: 8, padding: '1px 4px',
                            background: '#f59e0b', color: '#fff', borderRadius: 6, fontWeight: 700,
                            boxShadow: '0 1px 3px rgba(245,158,11,0.4)',
                          }}>⚡直达</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>💬 更多快捷问</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {quickQuestions.slice(2).map((q, i) => (
                        <button key={i} onClick={() => { setInput(q); setShowQuickStart(false) }} style={{
                          padding: '4px 10px', fontSize: 11, background: '#fff', color: '#475569',
                          border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', fontWeight: 500,
                        }}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: showQuickStart ? 0 : 8, alignItems: 'center' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 8,
                    background: 'linear-gradient(90deg, #ede9fe, #dbeafe)',
                    color: '#4f46e5', fontSize: 10, fontWeight: 700, flexShrink: 0,
                    border: '1px solid #c7d2fe',
                  }}>🤖 智能对话</div>
                  <input
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: 10,
                      border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
                    }}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder={portraitStep > 0 ? '请回答上述问题...' : '向 AI 导师提问，或点击下方主线任务阶段继续...'}
                  />
                  {/* 添加附件按钮 */}
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, borderRadius: 10,
                    background: attachments.length > 0 ? '#ede9fe' : '#f8fafc',
                    border: `1.5px solid ${attachments.length > 0 ? '#8b5cf6' : '#e2e8f0'}`,
                    cursor: 'pointer', fontSize: 16, flexShrink: 0, transition: 'all 0.2s',
                    position: 'relative',
                  }} title="添加附件（图片 / Word）">
                    📎
                    {attachments.length > 0 && (
                      <span style={{
                        position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%',
                        background: '#8b5cf6', color: '#fff', fontSize: 9, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{attachments.length}</span>
                    )}
                    <input type="file" accept="image/*,.doc,.docx" multiple
                      onChange={e => {
                        const files = Array.from(e.target.files || [])
                        Promise.all(files.map(f => new Promise(res => {
                          const reader = new FileReader()
                          reader.onload = () => res({ name: f.name, type: f.type, size: f.size, dataUrl: reader.result })
                          reader.readAsDataURL(f)
                        }))).then(newFiles => setAttachments(prev => [...prev, ...newFiles]).catch(() => {}))
                        e.target.value = ''
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button
                    onClick={() => sendMessage()}
                    style={{
                      padding: '0 24px', borderRadius: 10,
                      background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                      color: '#fff', border: 'none', fontWeight: 600,
                      cursor: 'pointer', fontSize: 13,
                      boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                    }}
                  >发送</button>
                </div>

                {/* 附件预览区 */}
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {attachments.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px 4px 4px', borderRadius: 8,
                        background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 11,
                      }}>
                        {f.type?.startsWith('image/') ? (
                          <img src={f.dataUrl} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 18 }}>📄</span>
                        )}
                        <span style={{ color: '#475569', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{
                          background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1,
                        }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
        </div>

        {/* ════ 右侧 Dashboard（极简紧凑） ════ */}
        <div style={{
          width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
          height: '100%', overflowY: 'auto', overflowX: 'hidden',
        }}>
          {/* ① 今日学习数据 · 一行 mini chips */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: '8px 10px',
            border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {[
              { icon: '⏱️', value: todayStats.studyMinutes, color: '#3b82f6', label: '分' },
              { icon: '🔥', value: todayStats.studyDays,     color: '#10b981', label: '天' },
              { icon: '✅', value: `${todayStats.completedTasks}/${todayStats.totalTasks}`, color: '#8b5cf6', label: '' },
              { icon: '⭐', value: todayStats.points,         color: '#f59e0b', label: '分' },
            ].map((s, i, arr) => (
              <div key={i} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                padding: '2px 0',
                borderRight: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
                minWidth: 0,
              }}>
                <span style={{ fontSize: 11 }}>{s.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</span>
                {s.label && <span style={{ fontSize: 9, color: '#94a3b8' }}>{s.label}</span>}
              </div>
            ))}
          </div>

          {/* ⑤ 继续学习 · 一行紧凑 chip（点击跳转到模型工坊，源码伴读已迁移到工坊） */}
          <div style={{
            background: '#fafbff', borderRadius: 10, padding: '8px 10px',
            border: '1px solid #e8ecf0', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onClick={() => { window.location.hash = '#/canvas?tab=workshop' }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e8ecf0'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11 }}>▶</span>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>继续学习</span>
              <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 'auto' }}>{continueLearning.lastTime}</span>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: '#1e293b', lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 5,
            }}>{continueLearning.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                flex: 1, height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${continueLearning.progress}%`,
                  background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: 2,
                }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', flexShrink: 0 }}>{continueLearning.progress}%</span>
            </div>
          </div>

          {/* ⑥ 今日任务 Checklist · 紧凑 */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: '8px 10px',
            border: '1px solid #f1f5f9',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11 }}>✅</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>今日任务</span>
              </div>
              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>
                {tasks.filter(t => t.done).length}/{tasks.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {tasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '3px 2px', cursor: 'pointer', fontSize: 10,
                    borderRadius: 4, transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 11, height: 11, borderRadius: 2,
                    border: task.done ? '2px solid #10b981' : '1.5px solid #cbd5e1',
                    background: task.done ? '#10b981' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, color: '#fff', flexShrink: 0,
                  }}>{task.done && '✓'}</div>
                  <span style={{
                    flex: 1, textDecoration: task.done ? 'line-through' : 'none',
                    color: task.done ? '#94a3b8' : '#1e293b',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{task.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ② 最近学习 · 极简列表 */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: '8px 10px',
            border: '1px solid #f1f5f9',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11 }}>📖</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>最近学习</span>
              </div>
              <span style={{ fontSize: 9, color: '#cbd5e1' }}>→</span>
            </div>
            <div>
              {recentLearnings.map((r, i) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 0',
                  borderBottom: i < recentLearnings.length - 1 ? '1px solid #f8fafc' : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.querySelector('span').style.color = '#3b82f6'}
                onMouseLeave={(e) => e.currentTarget.querySelector('span').style.color = '#475569'}
                >
                  <span style={{ fontSize: 11, flexShrink: 0 }}>{r.icon}</span>
                  <span style={{
                    flex: 1, fontSize: 10, color: '#475569',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    transition: 'color 0.15s',
                  }}>{r.title}</span>
                  <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>{r.meta.split('·')[1]?.trim() || r.meta}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ③ 最近实验 · 极简列表 */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: '8px 10px',
            border: '1px solid #f1f5f9',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11 }}>🧪</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>最近实验</span>
              </div>
              <Link to="/canvas?tab=record" style={{ textDecoration: 'none', fontSize: 9, color: '#cbd5e1' }}>
                →
              </Link>
            </div>
            <div>
              {recentExperiments.map((e, i) => (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 0',
                  borderBottom: i < recentExperiments.length - 1 ? '1px solid #f8fafc' : 'none',
                  cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 11, flexShrink: 0 }}>{e.icon}</span>
                  <span style={{
                    flex: 1, fontSize: 10, color: '#475569',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.name}</span>
                  <span style={{
                    fontSize: 9, padding: '0 5px', borderRadius: 3, fontWeight: 600,
                    color: e.color, flexShrink: 0, fontFamily: 'monospace',
                  }}>{e.accuracy}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ④ AI 推荐 · 一行三 chip */}
          <div style={{
            background: '#fff', borderRadius: 10, padding: '8px 10px',
            border: '1px solid #f1f5f9',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11 }}>✨</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>AI 推荐</span>
              </div>
              <span style={{ fontSize: 9, color: '#7c3aed', fontWeight: 600 }}>智能体</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { ...aiRecommendations.task,   onClick: () => { window.scrollTo({ top: 0, behavior: 'smooth' }) } },
                { ...aiRecommendations.course, onClick: () => window.location.hash = '#/resources?tab=recommend' },
                { ...aiRecommendations.resource, onClick: () => window.location.hash = '#/resources?tab=generate' },
              ].map((r, i) => (
                <div key={i} onClick={r.onClick} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px', borderRadius: 7,
                  background: r.bg, cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                >
                  <span style={{ fontSize: 13 }}>{r.icon}</span>
                  <span style={{
                    flex: 1, fontSize: 10, fontWeight: 600, color: '#1e293b',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{r.title}</span>
                  <span style={{ fontSize: 11, color: r.color, fontWeight: 700 }}>→</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes progressSlide {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  )
}
