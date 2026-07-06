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

const DEFAULT_STAGES_BY_GOAL = {
  'sam微调': [
    { id: 1, title: '理解基础概念',   desc: '图像分割与 SAM 模型原理',           agent: '📖 算法教研',     done: false },
    { id: 2, title: '阅读关键源码',   desc: 'model.py / image_encoder.py',        agent: '💻 源码阅读',     done: false },
    { id: 3, title: '搭建模型架构',   desc: '在模型工坊中拖出 Encoder-Attention-Decoder', agent: '🛠️ 模型实践', done: false },
    { id: 4, title: '完成实验记录',   desc: '保存模型并让评估智能体给出反馈',     agent: '📓 实验记录',     done: false },
    { id: 5, title: '项目实战复盘',   desc: '微调 SAM 并撰写总结报告',           agent: '🚀 项目实战',     done: false },
  ],
  '农业遥感': [
    { id: 1, title: '理解基础概念',   desc: '遥感图像与田块分割原理',             agent: '📖 算法教研',     done: false },
    { id: 2, title: '阅读 SAM 源码',  desc: 'Prompt Encoder 与 Mask Decoder',     agent: '💻 源码阅读',     done: false },
    { id: 3, title: '搭建分割模型',   desc: 'Image Encoder + Adapter',            agent: '🛠️ 模型实践',     done: false },
    { id: 4, title: '完成实验记录',   desc: '在田间数据上验证',                  agent: '📓 实验记录',     done: false },
    { id: 5, title: '项目实战复盘',   desc: '撰写农田长势监测方案',              agent: '🚀 项目实战',     done: false },
  ],
  '医学分割': [
    { id: 1, title: '理解基础概念',   desc: '医学影像特点与 UNet / SAM 选型',    agent: '📖 算法教研',     done: false },
    { id: 2, title: '阅读 SAM 源码',  desc: 'Mask Decoder 与 IoU Head',           agent: '💻 源码阅读',     done: false },
    { id: 3, title: '搭建分割模型',   desc: '针对 CT / MRI 调整 Encoder',        agent: '🛠️ 模型实践',     done: false },
    { id: 4, title: '完成实验记录',   desc: '在医学影像上验证',                  agent: '📓 实验记录',     done: false },
    { id: 5, title: '项目实战复盘',   desc: '撰写细胞分割报告',                  agent: '🚀 项目实战',     done: false },
  ],
  '目标检测': [
    { id: 1, title: '理解基础概念',   desc: 'YOLO / DETR 与 Anchor 机制',        agent: '📖 算法教研',     done: false },
    { id: 2, title: '阅读检测源码',   desc: 'Backbone + Neck + Head',            agent: '💻 源码阅读',     done: false },
    { id: 3, title: '搭建检测模型',   desc: 'CSPDarknet + PANet + Decoupled Head', agent: '🛠️ 模型实践',   done: false },
    { id: 4, title: '完成实验记录',   desc: '在 COCO 子集上验证',                agent: '📓 实验记录',     done: false },
    { id: 5, title: '项目实战复盘',   desc: '撰写目标检测方案',                  agent: '🚀 项目实战',     done: false },
  ],
  '自定义目标': [
    { id: 1, title: '理解基础概念',   desc: '梳理你的场景所需的算法原理',         agent: '📖 算法教研',     done: false },
    { id: 2, title: '阅读关键源码',   desc: '挑选 1-2 篇代表论文 / 仓库',        agent: '💻 源码阅读',     done: false },
    { id: 3, title: '搭建最小模型',   desc: '在模型工坊中拖出原型',              agent: '🛠️ 模型实践',     done: false },
    { id: 4, title: '完成实验记录',   desc: '保存模型并让 AI 评估',              agent: '📓 实验记录',     done: false },
    { id: 5, title: '项目实战复盘',   desc: '输出可交付的项目总结',              agent: '🚀 项目实战',     done: false },
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
  knowledgeMap: {
    'SAM': 30,
    'YOLO': 15,
    'Mask2Former': 5,
    'UNet': 25,
    'ViT': 40,
    'Transformer': 50,
    'ResNet': 60,
    'CNN': 70,
    'DINO': 10,
    'LoRA': 20,
    'Adapter': 15,
    'Attention': 55,
  },
  weakTopics: ['Attention 参数理解'],
  masteredTopics: ['CNN 基础', 'ResNet'],
  lastModelFeedback: null,
  learningPace: 4.5,
}

function loadInitial() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    /* 防御：必须同时具备 onboarded=true 且 mainStages 至少 1 条，否则视为未完成 onboarding */
    if (saved && saved.onboarded && Array.isArray(saved.mainStages) && saved.mainStages.length > 0) {
      return { ...DEFAULT_STATE, ...saved }
    }
  } catch (_) {}
  return DEFAULT_STATE
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
    setState(DEFAULT_STATE)
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
        knowledgeLevel: nextIdx >= 3 ? '中级' : nextIdx >= 1 ? '初级' : s.knowledgeLevel,
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
