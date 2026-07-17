import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, RadialBarChart, RadialBar, AreaChart, Area } from 'recharts'
import { fetchPipelineStream } from '../api' // ✅ SSE 流式后端请求接口
import { useLearn } from '../LearnContext.jsx'

export default function Home() {
  const learn = useLearn()

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

  // 封装 setMessages，每次更新自动同步到 localStorage
  const setMessages = (valOrFn) => {
    setMessagesRaw(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn
      const sid = localStorage.getItem('vf_session_id')
      if (sid) {
        try { localStorage.setItem(`vf_messages_${sid}`, JSON.stringify(next)) } catch (_) {}
      }
      return next
    })
  }
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [currentAgent, setCurrentAgent] = useState(null)
  const [agentStage, setAgentStage] = useState(0) // 0=空闲, 1=分析, 2=检索, 3=生成, 4=评估
  const [showHistory, setShowHistory] = useState(false)
  const [showBlackboard, setShowBlackboard] = useState(false)
  /* 4-Agent 阶段条：userToggle 是用户手动偏好；运行时（agentStage>0）强制展开覆盖 */
  const [stageBarUserOpen, setStageBarUserOpen] = useState(false)
  const showStageBar = agentStage > 0 || stageBarUserOpen
  const [showQuickStart, setShowQuickStart] = useState(false)
  // 每个浏览器生成唯一会话 ID，不同用户/刷新后仍保持独立
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem('vf_session_id')
    if (saved) return saved
    const id = 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
    localStorage.setItem('vf_session_id', id)
    return id
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
  const portrait = [
    { key: '知识掌握', value: 78, color: '#3b82f6', icon: '📚' },
    { key: '代码能力', value: 65, color: '#10b981', icon: '💻' },
    { key: '认知风格', value: 72, color: '#22c55e', icon: '🧠' },
    { key: '学习节奏', value: 70, color: '#eab308', icon: '⏱️' },
    { key: '兴趣程度', value: 88, color: '#a855f7', icon: '⭐' },
    { key: '易错点', value: 55, color: '#ef4444', icon: '⚠️' },
  ]
  const portraitAvg = Math.round(portrait.reduce((s, d) => s + d.value, 0) / portrait.length)

  /* 最近活动（演示用，可接入后端） */
  const recentActivities = [
    { time: '14:32', text: '完成阶段 3 · 搭建模型架构', icon: '🛠️', color: '#10b981' },
    { time: '13:05', text: '学情评估智能体更新画像', icon: '📈', color: '#8b5cf6' },
    { time: '11:20', text: '阅读源码 mask_decoder.py', icon: '💻', color: '#3b82f6' },
  ]

  /* ═══════════════ Dashboard Mock 数据 ═══════════════ */
  /* ① 今日学习数据 */
  const todayStats = {
    studyMinutes: 128,         /* 今日学习时长（分钟） */
    studyDays: 17,             /* 累计学习天数 */
    completedTasks: 6,         /* 今日完成任务数 */
    totalTasks: 8,             /* 今日任务总数 */
    points: 248,               /* 今日获得积分 */
    pointsDelta: 32,           /* 较昨日新增 */
  }

  /* ⑤ 继续学习（最近中断处） */
  const continueLearning = {
    title: 'SAM Mask Decoder 源码解读',
    type: '源码阅读',
    progress: 62,
    lastTime: '2 小时前',
    from: '模型工坊 · 源码伴读',
  }

  /* ② 最近学习（卡片） */
  const recentLearnings = [
    { id: 1, type: '章节',   title: '理解 ViT Patch 划分机制',          meta: '理论学习 · 14 分钟前', tag: '理论', color: '#3b82f6', bg: '#eff6ff', icon: '📖' },
    { id: 2, type: '课程',   title: 'SAM 模型微调实战',                 meta: '视频课程 · 2 小时前',   tag: '课程', color: '#8b5cf6', bg: '#faf5ff', icon: '🎬' },
    { id: 3, type: '文档',   title: 'PyTorch DataLoader 性能调优',     meta: '技术文档 · 昨天',       tag: '文档', color: '#10b981', bg: '#f0fdf4', icon: '📄' },
  ]

  /* ③ 最近实验（卡片） */
  const recentExperiments = [
    { id: 1, name: '图像分割基线实验',        status: '已完成', score: 0.87, accuracy: 'IoU 0.81', time: '今天 14:30', color: '#10b981', icon: '🧪' },
    { id: 2, name: 'Adapter 微调对比',        status: '已完成', score: 0.79, accuracy: 'mAP 0.74', time: '昨天 20:12', color: '#3b82f6', icon: '⚗️' },
    { id: 3, name: 'Prompt Encoder 消融',     status: '运行中', score: null,  accuracy: '已迭代 23/50', time: '正在跑 · 35min', color: '#f59e0b', icon: '🔬' },
  ]

  /* ④ AI 推荐学习 */
  const aiRecommendations = {
    task: { icon: '🎯', tag: '推荐任务', title: '完成 Encoder-Decoder 搭建', desc: '基于你当前阶段 3 的进度',     cta: '去完成', color: '#3b82f6', bg: '#eff6ff' },
    course: { icon: '🎬', tag: '推荐课程', title: '《SAM 入门到精通》P3',     desc: '与你薄弱点「Attention」相关', cta: '去学习', color: '#8b5cf6', bg: '#faf5ff' },
    resource: { icon: '📚', tag: '推荐资源', title: '5 篇必读论文合集',         desc: '本周社区热门 · Vision-Forge 编辑精选', cta: '去查看', color: '#ec4899', bg: '#fdf2f8' },
  }

  /* 本周进度（用于 mini 环） */
  const weekProgress = 68

  /* 任务阶段 */
  const stages = [
    { id: 1, name: '正在分析学习需求', agentId: 'architect' },
    { id: 2, name: '正在检索源码 / 论文', agentId: 'tutor' },
    { id: 3, name: '正在生成讲义 / 路径', agentId: 'generator' },
    { id: 4, name: '正在评估学习效果', agentId: 'evaluator' },
  ]

  const historyList = [
    { id: 1, title: '如何学习计算机视觉？', date: '2024-01-15' },
    { id: 2, title: 'SAM 模型怎么用？', date: '2024-01-14' },
    { id: 3, title: '生成我的学习方案', date: '2024-01-13' },
    { id: 4, title: 'PyTorch入门教程', date: '2024-01-12' },
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
    setAgentStage(1)    // 立即显示第一个阶段
    setStreamText('')    // 清空流式缓存

    // Agent 名称 → 阶段编号映射（用于进度条）
    const agentStageMap = { system: 0, architect: 1, tutor: 2, evaluator: 3, generator: 4 }
    // 累积收到的全部内容（最终一次性写入消息列表）
    let accumulatedContent = ''

    // ⬇️ 使用 SSE 流式接口 —— 每个 Agent 的真实执行进度与内容实时推送到前端
    fetchPipelineStream(text, sessionId, {
      onStage: (event) => {
        if (event.status === 'running') {
          const stageIdx = agentStageMap[event.agent] || 0
          setAgentStage(stageIdx)
          setCurrentAgent(event.agent)
        }
      },

      onNavigate: (event) => {
        // 收到 Canvas 引导事件：标记以便 onDone 中显示导航按钮
        window.__vf_lastNavigate = event
      },

      onContent: (event) => {
        // 根据内容类型选择前缀：chat 模式无前缀，pipeline 模式保留标签
        const prefix = event.type === 'chat'
          ? ''  // 对话模式：直接追加，无标题前缀
          : event.type === 'tutor'
            ? '\n\n---\n\n'
            : event.type === 'evaluation'
              ? '\n\n📊 **【评估报告】**:\n'
              : event.type === 'report'
                ? '\n\n📄 **【学习讲义】**:\n'
                : ''
        accumulatedContent += prefix + event.text
        setStreamText(accumulatedContent)
      },

      onDone: (event) => {
        const data = event.data || {}
        const finalContent = accumulatedContent || data.evaluation_results?.tutor_response || '四大智能体处理完毕。'
        const navEvent = window.__vf_lastNavigate
        window.__vf_lastNavigate = null

        setAgentStage(0)
        setCurrentAgent(null)
        setStreamText('')
        setIsTyping(false)

        // 检查是否需要引导去 Canvas
        if (navEvent && navEvent.target === 'canvas') {
          setMessages(prev => [...prev, {
            role: 'assistant',
            text: finalContent,
            agent: 'system',
            time: formatTime(new Date()),
            _canvasGuide: true,  // 标记此行需要显示 Canvas 按钮
            _sessionId: data.session_id || sessionId,
          }])
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            text: finalContent,
            agent: 'system',
            time: formatTime(new Date()),
          }])
        }
      },

      onError: (event) => {
        setAgentStage(0)
        setCurrentAgent(null)
        setStreamText('')
        setIsTyping(false)
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: `❌ **${event.agent || '系统'} 执行失败**: ${event.message}\n\n请检查后端网络或星火大模型配置。`,
          agent: 'system',
          time: formatTime(new Date()),
        }])
      },
    })
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
          {/* 4-Agent 任务阶段式状态条 */}
          <div style={{
            padding: agentStage > 0 ? '8px 16px 10px' : '6px 16px',
            borderBottom: '1px solid #e8ecf1',
            background: agentStage > 0 ? '#fafbfc' : '#fff',
            flexShrink: 0, transition: 'all 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: agentStage > 0 ? '#f59e0b' : '#10b981',
                  animation: 'pulse 1.5s infinite',
                }} />
                <span style={{ fontWeight: 600 }}>
                  4-Agent {agentStage > 0
                    ? `· 处理中（${agentStage}/${stages.length}）`
                    : '· 中央状态机待命中'}
                </span>
                {agentStage > 0 && (
                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>
                    {stages[Math.max(0, agentStage - 1)]?.name}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* 📜 历史（移到 4-Agent 状态条右侧，与黑板/展开同一行） */}
                <div style={{ position: 'relative' }} ref={historyRef}>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 6,
                      background: showHistory ? '#eff6ff' : '#f8fafc',
                      color: showHistory ? '#3b82f6' : '#475569',
                      border: '1px solid ' + (showHistory ? '#bfdbfe' : '#e2e8f0'),
                      cursor: 'pointer', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}
                  >📜 历史 <span style={{ fontSize: 8 }}>{showHistory ? '▲' : '▼'}</span></button>
                  {showHistory && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                      width: 240, background: '#fff', borderRadius: 10, padding: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 30,
                      border: '1px solid #e2e8f0',
                    }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', padding: '4px 6px', marginBottom: 4 }}>点击加载历史对话</div>
                      {historyList.map(item => (
                        <div
                          key={item.id}
                          onClick={() => { loadHistory(item.title); setShowHistory(false); }}
                          style={{
                            padding: 8, borderRadius: 6, background: '#f8fafc',
                            marginBottom: 4, cursor: 'pointer', fontSize: 11,
                            color: '#475569', fontWeight: 500,
                          }}
                        >
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{item.date}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowBlackboard(!showBlackboard)}
                  style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 6,
                    background: showBlackboard ? '#1e293b' : '#f8fafc',
                    color: showBlackboard ? '#fff' : '#64748b',
                    border: '1px solid ' + (showBlackboard ? '#1e293b' : '#e2e8f0'),
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >📓 黑板</button>
                <button
                  onClick={() => setStageBarUserOpen(!stageBarUserOpen)}
                  disabled={agentStage > 0}
                  title={agentStage > 0 ? '运行中不可收起' : ''}
                  style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 6,
                    background: showStageBar ? '#eff6ff' : '#f8fafc',
                    color: showStageBar ? '#3b82f6' : '#64748b',
                    border: '1px solid ' + (showStageBar ? '#bfdbfe' : '#e2e8f0'),
                    cursor: agentStage > 0 ? 'default' : 'pointer',
                    fontWeight: 600,
                    opacity: agentStage > 0 ? 0.7 : 1,
                  }}
                >{showStageBar ? '收起 ▲' : '展开 ▼'}</button>
              </div>
            </div>
            {showStageBar && (
              <>
                {showBlackboard && (
                  <div style={{ position: 'relative', marginTop: 8 }}>
                    <Blackboard />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 4, marginTop: 8, position: 'relative' }}>
                  {stages.map((stage, idx) => {
                    const agent = agents.find(a => a.id === stage.agentId)
                    const isDone = agentStage > stage.id
                    const isActive = agentStage === stage.id
                    const agentColor = agent?.color || '#94a3b8'
                    return (
                      <div key={stage.id} style={{
                        flex: 1, padding: '8px 10px', borderRadius: 10,
                        background: isActive
                          ? `linear-gradient(135deg, ${agentColor}25, ${agentColor}10)`
                          : isDone
                            ? `linear-gradient(135deg, ${agentColor}15, #f0fdf4)`
                            : '#f8fafc',
                        border: isActive
                          ? `2px solid ${agentColor}`
                          : isDone
                            ? `1.5px solid ${agentColor}50`
                            : '1.5px solid #e2e8f0',
                        display: 'flex', flexDirection: 'column', gap: 4,
                        transition: 'all 0.4s ease',
                        position: 'relative', overflow: 'hidden',
                        boxShadow: isActive ? `0 0 0 4px ${agentColor}22, 0 4px 12px ${agentColor}33` : 'none',
                      }}>
                        {isActive && (
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: `linear-gradient(90deg, transparent 0%, ${agentColor}30 50%, transparent 100%)`,
                            animation: 'shimmer 1.5s infinite linear',
                            pointerEvents: 'none',
                          }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: isActive ? '#fff' : isDone ? '#fff' : '#94a3b8',
                            background: isActive ? agentColor : isDone ? '#10b981' : '#e2e8f0',
                            width: 20, height: 20, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: isActive ? `0 0 0 3px ${agentColor}30` : 'none',
                          }}>
                            {isDone ? '✓' : isActive ? '●' : (idx + 1)}
                          </span>
                          <span style={{ fontSize: 12 }}>{agent?.icon}</span>
                          <span style={{
                            fontSize: 11,
                            color: isActive ? agentColor : isDone ? '#15803d' : '#64748b',
                            fontWeight: isActive ? 700 : isDone ? 600 : 500,
                            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {stage.name}
                          </span>
                        </div>
                        {isActive && (
                          <div style={{
                            height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', position: 'relative',
                          }}>
                            <div style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0,
                              width: '40%',
                              background: `linear-gradient(90deg, transparent, ${agentColor}, transparent)`,
                              animation: 'progressSlide 1.2s infinite linear',
                            }} />
                          </div>
                        )}
                        {isDone && (
                          <div style={{ height: 3, background: '#10b981', borderRadius: 2 }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            {showBlackboard && !showStageBar && (
              <div style={{ position: 'absolute', top: 40, right: 16, zIndex: 40 }}>
                <Blackboard />
              </div>
            )}
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
