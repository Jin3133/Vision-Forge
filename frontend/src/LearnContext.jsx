import { createContext, useContext, useState, useEffect, useCallback } from 'react'

/**
 * 学习闭环共享状态层（中央状态机 · Task_State.json 的前端镜像）
 * 任何页面都可以读写，所有联动都通过这里。
 *
 * 字段：
 *   onboarded            是否完成首启引导
 *   goal                 用户目标（SAM微调/农业遥感/医学分割/目标检测/自定义）
 *   customGoal           自定义目标文本
 *   mainStages           五阶段主线任务（含完成状态）
 *   currentStageIdx      当前阶段索引
 *   topic                当前学习主题
 *   stage                当前阶段名（算法理解阶段 / 模型搭建阶段 …）
 *   knowledgeLevel       初级 / 中级 / 进阶
 *   knowledgeMap         学习地图：每个模型的掌握度 0-100
 *   weakTopics           易错点 → 驱动今日推荐
 *   masteredTopics       已掌握
 *   lastModelFeedback    最近一次模型工坊评估的「已掌握/未掌握」反馈
 *   learningPace         本周学习时长（小时）
 */

const STORAGE_KEY = 'vf_learn_state_v2'
/* 阶段结构版本号：变更 DEFAULT_STAGES_BY_GOAL 时同步 +1，旧 localStorage 数据自动失效 */
const STAGES_VERSION = 2

const DEFAULT_STAGES_BY_GOAL = {
  'sam微调': [
    { id: 1, title: '理解基础概念',          desc: '图像分割与 SAM 模型原理',           agent: '📖 算法教研', done: false },
    { id: 2, title: '阅读关键源码 + 搭建模型', desc: '在模型工坊中伴读源码并拖出 Encoder-Attention-Decoder', agent: '🛠️ 模型实践', done: false },
    { id: 3, title: '完成实验记录',          desc: '保存模型并让评估智能体给出反馈',     agent: '📓 实验记录', done: false },
    { id: 4, title: '项目实战复盘',          desc: '微调 SAM 并撰写总结报告',           agent: '🚀 综合应用', done: false },
  ],
  '农业遥感': [
    { id: 1, title: '理解基础概念',          desc: '遥感图像与田块分割原理',             agent: '📖 算法教研', done: false },
    { id: 2, title: '阅读 SAM 源码 + 搭建',  desc: 'Prompt Encoder + Mask Decoder，在工坊中搭建 Encoder + Adapter', agent: '🛠️ 模型实践', done: false },
    { id: 3, title: '完成实验记录',          desc: '在田间数据上验证',                  agent: '📓 实验记录', done: false },
    { id: 4, title: '项目实战复盘',          desc: '撰写农田长势监测方案',              agent: '🚀 综合应用', done: false },
  ],
  '医学分割': [
    { id: 1, title: '理解基础概念',          desc: '医学影像特点与 UNet / SAM 选型',    agent: '📖 算法教研', done: false },
    { id: 2, title: '阅读 SAM 源码 + 搭建',  desc: 'Mask Decoder + IoU Head，在工坊中针对 CT / MRI 调整 Encoder', agent: '🛠️ 模型实践', done: false },
    { id: 3, title: '完成实验记录',          desc: '在医学影像上验证',                  agent: '📓 实验记录', done: false },
    { id: 4, title: '项目实战复盘',          desc: '撰写细胞分割报告',                  agent: '🚀 综合应用', done: false },
  ],
  '目标检测': [
    { id: 1, title: '理解基础概念',          desc: 'YOLO / DETR 与 Anchor 机制',        agent: '📖 算法教研', done: false },
    { id: 2, title: '阅读检测源码 + 搭建',  desc: 'Backbone + Neck + Head，在工坊中搭建 CSPDarknet + PANet + Decoupled Head', agent: '🛠️ 模型实践', done: false },
    { id: 3, title: '完成实验记录',          desc: '在 COCO 子集上验证',                agent: '📓 实验记录', done: false },
    { id: 4, title: '项目实战复盘',          desc: '撰写目标检测方案',                  agent: '🚀 综合应用', done: false },
  ],
  '自定义目标': [
    { id: 1, title: '理解基础概念',          desc: '梳理你的场景所需的算法原理',         agent: '📖 算法教研', done: false },
    { id: 2, title: '阅读关键源码 + 搭建',  desc: '挑选 1-2 篇代表论文 / 仓库，并在工坊中拖出原型', agent: '🛠️ 模型实践', done: false },
    { id: 3, title: '完成实验记录',          desc: '保存模型并让 AI 评估',              agent: '📓 实验记录', done: false },
    { id: 4, title: '项目实战复盘',          desc: '输出可交付的项目总结',              agent: '🚀 综合应用', done: false },
  ],
}

const DEFAULT_STATE = {
  onboarded: false,
  goal: '',
  customGoal: '',
  mainStages: [],
  currentStageIdx: 0,
  topic: '',
  stage: '',
  knowledgeLevel: '初级',
  knowledgeMap: {},
  weakTopics: [],
  masteredTopics: [],
  lastModelFeedback: null,
  learningPace: 0,
  learnerPortrait: {
    dimensions: {},
    overallScore: 0,
    aiReview: { highlight: '', weak: '', next: '', overall: '', level: '' },
    lastUpdated: null,
  },
}

function loadInitial() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    /* 防御：必须同时具备 onboarded=true 且 mainStages 至少 1 条，否则视为未完成 onboarding */
    if (saved && saved.onboarded && Array.isArray(saved.mainStages) && saved.mainStages.length > 0) {
      /* 阶段结构版本不匹配 → 丢弃旧数据，回到首启引导 */
      if (saved.stagesVersion !== STAGES_VERSION) {
        return { ...DEFAULT_STATE, stagesVersion: STAGES_VERSION }
      }
      return { ...DEFAULT_STATE, ...saved, stagesVersion: STAGES_VERSION }
    }
  } catch (_) {}
  return { ...DEFAULT_STATE, stagesVersion: STAGES_VERSION }
}

const LearnContext = createContext(null)

export function LearnProvider({ children }) {
  const [state, setState] = useState(loadInitial)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch (_) {}
  }, [state])

  /* ── 首启引导 ── */
  const finishOnboarding = useCallback((goal, customGoal = '') => {
    const stages = DEFAULT_STAGES_BY_GOAL[goal] || DEFAULT_STAGES_BY_GOAL['自定义目标']
    const topic = goal === '自定义目标' ? (customGoal || '自定义学习') : goal
    setState(s => ({
      ...s,
      onboarded: true,
      goal,
      customGoal,
      mainStages: stages,
      currentStageIdx: 0,
      topic,
      stage: stages[0].title,
      knowledgeLevel: '初级',
    }))
  }, [])

  const resetOnboarding = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch (_) {}
    setState({ ...DEFAULT_STATE, stagesVersion: STAGES_VERSION })
  }, [])

  // 暴露全局重置函数，供 AuthContext 调用
  useEffect(() => {
    window.__vf_resetLearnState = () => {
      try { localStorage.removeItem(STORAGE_KEY) } catch (_) {}
      setState({ ...DEFAULT_STATE, stagesVersion: STAGES_VERSION })
    }
    return () => { delete window.__vf_resetLearnState }
  }, [])

  /* ── 推进主线阶段 ── */
  const advanceStage = useCallback(() => {
    setState(s => {
      const stages = s.mainStages.map((st, i) =>
        i === s.currentStageIdx ? { ...st, done: true } : st
      )
      const nextIdx = Math.min(s.currentStageIdx + 1, stages.length - 1)
      return {
        ...s,
        mainStages: stages,
        currentStageIdx: nextIdx,
        stage: stages[nextIdx].title,
        knowledgeLevel: nextIdx >= 2 ? '中级' : nextIdx >= 1 ? '初级' : s.knowledgeLevel,
      }
    })
  }, [])

  const setCurrentStageByTitle = useCallback((title) => {
    setState(s => {
      const idx = s.mainStages.findIndex(st => st.title === title)
      if (idx === -1) return s
      return { ...s, currentStageIdx: idx, stage: title }
    })
  }, [])

  /* ── 学习地图（节点掌握度） ── */
  const updateKnowledge = useCallback((name, delta) => {
    setState(s => {
      const cur = s.knowledgeMap[name] ?? 0
      const v = Math.max(0, Math.min(100, cur + delta))
      const mastered = new Set(s.masteredTopics)
      const weak = new Set(s.weakTopics)
      if (v >= 80) mastered.add(name)
      if (v < 50) weak.add(name)
      return {
        ...s,
        knowledgeMap: { ...s.knowledgeMap, [name]: v },
        masteredTopics: [...mastered],
        weakTopics: [...weak],
      }
    })
  }, [])

  /* ── 模型工坊反馈 → 联动学习画像 ── */
  const submitModelFeedback = useCallback((feedback) => {
    setState(s => {
      const mastered = new Set(s.masteredTopics)
      const weak = new Set(s.weakTopics)
      feedback.mastered?.forEach(t => mastered.add(t))
      feedback.weak?.forEach(t => weak.add(t))
      // 推进主线阶段（如还在第 3 阶段「搭建」）
      let stages = s.mainStages
      let currentStageIdx = s.currentStageIdx
      let stage = s.stage
      if (currentStageIdx === 2) {
        stages = s.mainStages.map((st, i) => i === 2 ? { ...st, done: true } : st)
        currentStageIdx = 3
        stage = stages[3].title
      }
      // 自动提升知识地图掌握度
      const km = { ...s.knowledgeMap }
      feedback.mastered?.forEach(t => { km[t] = Math.max(km[t] ?? 0, 80) })
      feedback.weak?.forEach(t => { km[t] = Math.min(km[t] ?? 0, 50) })
      return {
        ...s,
        knowledgeMap: km,
        masteredTopics: [...mastered],
        weakTopics: [...weak],
        lastModelFeedback: feedback,
        mainStages: stages,
        currentStageIdx,
        stage,
      }
    })
  }, [])

  /* ── 6 维学习画像 ── */
  const updateLearnerPortrait = useCallback((portraitData) => {
    setState(s => ({
      ...s,
      learnerPortrait: {
        ...s.learnerPortrait,
        ...portraitData,
        dimensions: {
          ...s.learnerPortrait.dimensions,
          ...(portraitData.dimensions || {}),
        },
        lastUpdated: new Date().toISOString(),
      },
    }))
  }, [])

  const computePortraitFromAnswers = useCallback((answers) => {
    // 从 6 问答案计算 6 维能力数值（前端规则引擎）
    const dims = { ...DEFAULT_STATE.learnerPortrait.dimensions }

    // 问1: 领域了解程度 → 知识掌握
    const q1 = answers[0] || ''
    if (q1.includes('深入') || q1.includes('较深入')) dims['知识掌握'].value = 85
    else if (q1.includes('基础') || q1.includes('有基础')) dims['知识掌握'].value = 65
    else dims['知识掌握'].value = 35

    // 问2: 学习方式偏好 → 认知风格
    const q2 = answers[1] || ''
    if (q2.includes('动手实践') || q2.includes('实践')) dims['认知风格'].value = 80
    else if (q2.includes('读论文')) dims['认知风格'].value = 70
    else if (q2.includes('听课')) dims['认知风格'].value = 60
    else dims['认知风格'].value = 55

    // 问3: 框架熟练度 → 代码能力
    const q3 = answers[2] || ''
    if (q3.includes('熟练') || q3.includes('非常')) dims['代码能力'].value = 85
    else if (q3.includes('一般') || q3.includes('基本')) dims['代码能力'].value = 60
    else dims['代码能力'].value = 30

    // 问4: Attention 理解 → 计算易错点（反向）
    const q4 = answers[3] || ''
    if (q4.includes('深入') || q4.includes('非常')) dims['易错点'].value = 80  // 理解深 → 易错少
    else if (q4.includes('基本') || q4.includes('了解')) dims['易错点'].value = 50
    else dims['易错点'].value = 30

    // 问5: 每周学习时长 → 学习节奏
    const q5 = answers[4] || ''
    const hours = parseInt(q5.match(/\d+/)?.[0]) || 5
    dims['学习节奏'].value = Math.min(100, hours * 8)

    // 问6: 想掌握的技能 → 兴趣程度
    const q6 = answers[5] || ''
    if (q6.length > 10) dims['兴趣程度'].value = 85
    else dims['兴趣程度'].value = 70

    // 更新趋势：将当前值追加到趋势数组
    Object.keys(dims).forEach(key => {
      dims[key].trend = [...(dims[key].trend || []).slice(-7), dims[key].value]
    })

    const overallScore = Math.round(
      Object.values(dims).reduce((s, d) => s + d.value, 0) / Object.keys(dims).length
    )

    const portraitData = {
      dimensions: dims,
      overallScore,
      aiReview: {
        overall: overallScore >= 80 ? 'A' : overallScore >= 60 ? 'B+' : 'B',
        level: overallScore >= 80 ? '进阶学习者' : '成长型学习者',
        highlight: `评估完成！你的综合学习画像得分为 ${overallScore} 分。`,
        weak: `建议关注得分较低的维度（<60分），针对性提升。`,
        next: '继续在模型工坊中实践，学习画像会随学习进度动态更新。',
      },
    }

    updateLearnerPortrait(portraitData)
    return portraitData
  }, [updateLearnerPortrait])

  /* ── 共享黑板（Task_State.json 前端镜像，美化展示） ── */
  const blackboard = {
    CurrentTopic: state.topic,
    CurrentStage: state.stage,
    KnowledgeLevel: state.knowledgeLevel,
    LearningGoal: state.goal === '自定义目标' ? (state.customGoal || '自定义目标') : state.goal,
    CurrentStageIdx: state.currentStageIdx + 1,
    TotalStages: state.mainStages.length,
    WeakTopics: state.weakTopics,
    LearningPace: `${state.learningPace}h / 周`,
  }

  return (
    <LearnContext.Provider value={{
      ...state,
      blackboard,
      finishOnboarding,
      resetOnboarding,
      advanceStage,
      setCurrentStageByTitle,
      updateKnowledge,
      submitModelFeedback,
      updateLearnerPortrait,
      computePortraitFromAnswers,
    }}>
      {children}
    </LearnContext.Provider>
  )
}

export function useLearn() {
  const ctx = useContext(LearnContext)
  if (!ctx) throw new Error('useLearn must be used within LearnProvider')
  return ctx
}
