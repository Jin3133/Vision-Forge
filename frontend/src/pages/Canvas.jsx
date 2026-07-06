import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge, Handle, Position, MiniMap, useReactFlow, ReactFlowProvider } from '@xyflow/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import '@xyflow/react/dist/style.css'
import { useLearn } from '../LearnContext.jsx'
import { useHistory } from '../components/canvas/useHistory'
import { useAutosave } from '../components/canvas/useAutosave'
import { useToasts, ToastStack } from '../components/canvas/ToastStack'
import { validateConnection } from '../components/canvas/connectionRules'
import { NodeDetailDrawer } from '../components/canvas/NodeDetailDrawer'
import { VersionHistoryDrawer } from '../components/canvas/VersionHistoryDrawer'
import { TemplateLibraryDrawer } from '../components/canvas/TemplateLibraryDrawer'
import { CanvasTopBar } from '../components/canvas/CanvasTopBar'
import { TEMPLATES } from '../components/canvas/templates'
import '../components/canvas/canvas-extras.css'

// ==================== 节点类型定义 ====================
const nodeColors = {
  // 基础模块
  input: { bg: '#f0f9ff', border: '#0ea5e9', icon: '📥', label: '输入层' },
  encoder: { bg: '#eff6ff', border: '#3b82f6', icon: '🏗️', label: '图像编码器' },
  prompt_encoder: { bg: '#eff6ff', border: '#2563eb', icon: '📝', label: '提示编码器' },
  // 特征提取
  conv: { bg: '#f0fdf4', border: '#10b981', icon: '🔲', label: '卷积层' },
  attention: { bg: '#f0fdf4', border: '#059669', icon: '👁️', label: '注意力层' },
  extract: { bg: '#f0fdf4', border: '#10b981', icon: '🔍', label: '特征提取' },
  pooling: { bg: '#f0fdf4', border: '#14b8a6', icon: '🔽', label: '池化层' },
  // 融合层
  aggregate: { bg: '#fffbeb', border: '#f59e0b', icon: '🔗', label: '特征融合' },
  norm: { bg: '#fffbeb', border: '#d97706', icon: '📐', label: '归一化层' },
  activation: { bg: '#fffbeb', border: '#f59e0b', icon: '⚡', label: '激活函数' },
  dropout: { bg: '#fff7ed', border: '#f97316', icon: '🎲', label: 'Dropout' },
  // 输出模块
  decoder: { bg: '#faf5ff', border: '#8b5cf6', icon: '🎯', label: '掩码解码器' },
  fc: { bg: '#faf5ff', border: '#7c3aed', icon: '🔗', label: '全连接层' },
  output: { bg: '#faf5ff', border: '#8b5cf6', icon: '📤', label: '输出层' },
  base: { bg: '#eff6ff', border: '#3b82f6', icon: '🧠', label: '基座模型' },
}

/* 节点类型 → 学习画像知识点（用于联动评估） */
const NODE_TO_KNOWLEDGE = {
  base: ['SAM', '基座模型'],
  encoder: ['Encoder', 'ViT'],
  prompt_encoder: ['Prompt Encoder'],
  conv: ['CNN', '卷积'],
  attention: ['Attention', 'Transformer'],
  pooling: ['CNN'],
  extract: ['特征提取'],
  aggregate: ['特征融合'],
  norm: ['归一化'],
  activation: ['激活函数'],
  dropout: ['正则化'],
  decoder: ['Decoder', '掩码解码'],
  fc: ['全连接层'],
  input: ['数据预处理'],
  output: ['输出层'],
}

/* 根据画布推导已掌握 / 待加强知识点 */
function deriveFeedbackFromCanvas(nodes, edges) {
  const used = new Set()
  nodes.forEach(n => {
    const keys = NODE_TO_KNOWLEDGE[n.type] || []
    keys.forEach(k => used.add(k))
  })
  const mastered = []
  const weak = []
  used.forEach(k => {
    if (edges.length >= 2 && nodes.length >= 3) {
      // 完整管线 → 视为掌握
      mastered.push(k)
    } else if (edges.length === 0 && nodes.length > 0) {
      // 没连线 → 弱
      weak.push(k)
    } else {
      mastered.push(k)
    }
  })
  // Attention 单独挑剔：单层不够，至少 2 层 attention 才算掌握
  const attnCount = nodes.filter(n => n.type === 'attention').length
  if (attnCount >= 2) mastered.push('Attention 参数理解')
  if (attnCount === 1) weak.push('Attention 参数理解')
  return {
    mastered: [...new Set(mastered)],
    weak: [...new Set(weak)],
    summary: nodes.length >= 4 && edges.length >= 3
      ? `已搭建 ${nodes.length} 节点 / ${edges.length} 连线的完整管线，模型工坊给出的反馈已写入学习画像。`
      : `画布还不完整（${nodes.length} 节点 / ${edges.length} 连线），AI 导师标记了待加强的知识点。`,
  }
}

// 节点分组（用于折叠面板）—— 4 大组：基础模块 / 特征提取 / 融合层 / 输出模块
// "输出层"节点置顶到"输出模块"组内并紫色高亮
const nodeGroups = [
  { name: '基础模块', key: 'foundation', nodes: ['input', 'encoder', 'prompt_encoder'] },
  { name: '特征提取', key: 'extract', nodes: ['conv', 'attention', 'extract', 'pooling'] },
  { name: '融合层', key: 'fusion', nodes: ['aggregate', 'norm', 'activation', 'dropout'] },
  { name: '输出模块', key: 'output_module', nodes: ['output', 'decoder', 'fc', 'base'], highlight: true },
] 

const BaseNode = ({ data, type, selected }) => {
  const { bg, border, icon } = nodeColors[type] || nodeColors.base
  const isOutput = type === 'output'
  const shadow = selected ? `0 0 0 3px ${border}40, 0 4px 12px rgba(0,0,0,0.15)` : '0 2px 8px rgba(0,0,0,0.1)'
  return (
    <div style={{
      background: bg, border: `2px solid ${border}`, borderRadius: 12, padding: '10px 14px',
      minWidth: 140, display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: shadow, transition: 'all 0.2s', cursor: 'grab',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{data.label}</div>
      <Handle type="target" position={Position.Left} style={{
        background: '#fff', border: `2.5px solid ${border}`,
        width: 10, height: 10, borderRadius: '50%',
      }} />
      {!isOutput && (
        <Handle type="source" position={Position.Right} style={{
          background: '#fff', border: `2.5px solid ${border}`,
          width: 10, height: 10, borderRadius: '50%',
        }} />
      )}
    </div>
  )
}

const nodeTypes = {
  base: (p) => <BaseNode {...p} type="base" />,
  extract: (p) => <BaseNode {...p} type="extract" />,
  aggregate: (p) => <BaseNode {...p} type="aggregate" />,
  output: (p) => <BaseNode {...p} type="output" />,
  input: (p) => <BaseNode {...p} type="input" />,
  encoder: (p) => <BaseNode {...p} type="encoder" />,
  prompt_encoder: (p) => <BaseNode {...p} type="prompt_encoder" />,
  conv: (p) => <BaseNode {...p} type="conv" />,
  attention: (p) => <BaseNode {...p} type="attention" />,
  pooling: (p) => <BaseNode {...p} type="pooling" />,
  norm: (p) => <BaseNode {...p} type="norm" />,
  activation: (p) => <BaseNode {...p} type="activation" />,
  dropout: (p) => <BaseNode {...p} type="dropout" />,
  decoder: (p) => <BaseNode {...p} type="decoder" />,
  fc: (p) => <BaseNode {...p} type="fc" />,
}

// ==================== 预置数据 ====================
const presetModels = [
  { id: 1, name: 'SAM 基础模型', type: 'base', accuracy: 89.2, size: '352MB', description: 'Segment Anything 基础模型' },
  { id: 2, name: 'SAM + 特征提取', type: 'extract', accuracy: 91.5, size: '428MB', description: '添加多尺度特征提取' },
  { id: 3, name: 'SAM + 注意力融合', type: 'aggregate', accuracy: 93.8, size: '486MB', description: '使用注意力机制融合' },
  { id: 4, name: 'SAM 完整版', type: 'output', accuracy: 94.2, size: '512MB', description: '完整分割模型' },
]

const compareData = [
  { name: 'SAM基础', 精度: 89.2, 速度: 85, 内存: 352 },
  { name: 'SAM+特征', 精度: 91.5, 速度: 78, 内存: 428 },
  { name: 'SAM+注意力', 精度: 93.8, 速度: 72, 内存: 486 },
  { name: 'SAM完整', 精度: 94.2, 速度: 68, 内存: 512 },
]

// ==================== 空状态组件 ====================
const EmptyCanvasHint = () => (
  <div style={{
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', zIndex: 1,
  }}>
    <div style={{
      border: '2px dashed #cbd5e1', borderRadius: 16, padding: '40px 60px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      background: 'rgba(241,245,249,0.5)',
    }}>
      <span style={{ fontSize: 48 }}>📐</span>
      <div style={{ fontSize: 15, color: '#64748b', fontWeight: 500 }}>拖拽节点到此处开始搭建</div>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>从左侧面板选择节点类型添加到画布</div>
    </div>
  </div>
)

// ==================== 主组件 ====================
export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

function CanvasInner() {
  const location = useLocation()
  const urlParams = new URLSearchParams(location.search)
  /* tab 映射：兼容旧 build → workshop */
  const rawTab = urlParams.get('tab') || 'workshop'
  const activeTab = rawTab === 'build' ? 'workshop' : rawTab === 'library' ? 'workshop' : rawTab === 'evaluate' ? 'compare' : rawTab
  const learn = useLearn()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [evalResult, setEvalResult] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)
  const [savedModels, setSavedModels] = useState([])
  const [stageToast, setStageToast] = useState(null) // 全局主线推进 toast
  const [aiReview, setAiReview] = useState(null) // AI 导师点评结果
  const [aiReviewLoading, setAiReviewLoading] = useState(false)
  const reactFlowWrapper = useRef(null)

  /* ───── 新增：撤销/重做 / 自动保存 / Toast / Drawer 状态 ───── */
  const { toasts, push: pushToast, remove: removeToast } = useToasts()

  // 历史快照：镜像 nodes/edges，撤销/重做时回写
  // 关键设计：用 useState 单独存一份"上一帧 + 下一帧"，避免和 useNodesState 的高频变更打架
  const historyRef = useRef({ past: [], future: [] })
  const [historyTick, setHistoryTick] = useState(0) // 仅用来触发 canUndo/canRedo 的 UI 更新
  const isApplyingHistory = useRef(false)

  // 自动保存 hook
  const {
    status: autosaveStatus,
    lastSavedAt,
    saveNow,
    versions,
    restoreVersion,
    removeVersion,
  } = useAutosave({
    nodes, edges,
    onSave: (record) => {
      if (record.reason === 'auto') {
        // 静默，仅顶部状态变化
      } else if (record.reason === 'manual') {
        pushToast({ type: 'success', title: '保存成功', detail: `已记录版本（${record.nodeCount} 节点 / ${record.edgeCount} 连线）`, icon: '💾' })
      }
    },
  })

  // Drawer 状态
  const [detailNodeId, setDetailNodeId] = useState(null)
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false)
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false)

  const detailNode = useMemo(
    () => detailNodeId ? nodes.find((n) => n.id === detailNodeId) : null,
    [detailNodeId, nodes],
  )

  /** 把当前快照入栈（程序化修改时调用，比如 addNode / loadExample 等） */
  const pushHistory = useCallback(() => {
    if (isApplyingHistory.current) return
    historyRef.current.past.push({ nodes, edges })
    if (historyRef.current.past.length > 100) historyRef.current.past.shift()
    historyRef.current.future = []
    setHistoryTick((t) => t + 1)
  }, [nodes, edges])

  const undo = useCallback(() => {
    const prev = historyRef.current.past.pop()
    if (!prev) return
    historyRef.current.future.push({ nodes, edges })
    isApplyingHistory.current = true
    setNodes(prev.nodes)
    setEdges(prev.edges)
    setTimeout(() => { isApplyingHistory.current = false }, 0)
    setHistoryTick((t) => t + 1)
    pushToast({ type: 'info', title: '已撤销', detail: '回到上一步', duration: 1200, icon: '↶' })
  }, [nodes, edges, setNodes, setEdges, pushToast])

  const redo = useCallback(() => {
    const next = historyRef.current.future.pop()
    if (!next) return
    historyRef.current.past.push({ nodes, edges })
    isApplyingHistory.current = true
    setNodes(next.nodes)
    setEdges(next.edges)
    setTimeout(() => { isApplyingHistory.current = false }, 0)
    setHistoryTick((t) => t + 1)
    pushToast({ type: 'info', title: '已重做', detail: '前进一步', duration: 1200, icon: '↷' })
  }, [nodes, edges, setNodes, setEdges, pushToast])

  const canUndo = historyRef.current.past.length > 0
  const canRedo = historyRef.current.future.length > 0
  const { screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    const saved = localStorage.getItem('vf_savedModels')
    if (saved) setSavedModels(JSON.parse(saved))
  }, [])

  const onConnect = useCallback((params) => {
    // ── 非法连线校验 ──
    const sourceNode = nodes.find((n) => n.id === params.source)
    const targetNode = nodes.find((n) => n.id === params.target)
    const result = validateConnection({
      source: params.source,
      target: params.target,
      sourceType: sourceNode?.type,
      targetType: targetNode?.type,
      edges,
      nodes,
    })
    if (result.level === 'error' || !result.ok) {
      pushToast({ type: 'error', title: '连线被拒绝', detail: result.message, icon: '🚫', duration: 3000 })
      return
    }
    pushHistory()
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds))
    if (result.level === 'warning') {
      pushToast({ type: 'warning', title: '连线建议', detail: result.message, icon: '⚠️', duration: 3000 })
    }
  }, [setEdges, nodes, edges, pushHistory, pushToast])

  // 共用的添加节点逻辑；可指定坐标（拖拽场景）或随机坐标（点击场景）
  const addNodeAt = useCallback((type, label, position) => {
    pushHistory()
    const newNode = {
      id: `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      data: { label },
      position: position || { x: 240 + Math.random() * 120, y: 140 + Math.random() * 120 },
    }
    setNodes((prev) => [...prev, newNode])
  }, [setNodes, pushHistory])

  // 点击侧栏按钮时的兜底：默认位置加入
  const addNode = (type, label) => addNodeAt(type, label)

  // 拖拽到画布：HTML5 drop 事件
  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/reactflow')
    if (!type || !nodeColors[type]) return
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })
    addNodeAt(type, nodeColors[type].label, position)
  }, [screenToFlowPosition, addNodeAt])

  const loadExample = () => {
    pushHistory()
    setNodes([
      { id: '1', type: 'base', data: { label: 'SAM 基座' }, position: { x: 60, y: 140 } },
      { id: '2', type: 'extract', data: { label: '特征提取' }, position: { x: 300, y: 80 } },
      { id: '3', type: 'aggregate', data: { label: '特征融合' }, position: { x: 540, y: 140 } },
      { id: '4', type: 'output', data: { label: '分割结果' }, position: { x: 780, y: 140 } },
    ])
    setEdges([
      { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
      { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
      { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } },
    ])
    setEvalResult(null)
    pushToast({ type: 'success', title: '已加载示例', detail: 'SAM 4 节点 / 3 连线', icon: '✨' })
  }

  const clearCanvas = () => {
    if (nodes.length === 0 && edges.length === 0) return
    pushHistory()
    setNodes([])
    setEdges([])
    setEvalResult(null)
    pushToast({ type: 'info', title: '画布已清空', icon: '🗑', duration: 1500 })
  }

  /** 从模板库加载 */
  const loadTemplate = useCallback((tpl) => {
    pushHistory()
    // 给节点 id 加一个时间戳后缀，避免与画布上现有 id 冲突
    const stamp = Date.now()
    const map = {}
    const newNodes = tpl.nodes.map((n) => {
      const newId = `${n.id}-${stamp}`
      map[n.id] = newId
      return { ...n, id: newId }
    })
    const newEdges = tpl.edges.map((e) => ({
      ...e,
      id: `${e.id}-${stamp}`,
      source: map[e.source],
      target: map[e.target],
    }))
    setNodes(newNodes)
    setEdges(newEdges)
    setEvalResult(null)
    setTemplateDrawerOpen(false)
    pushToast({
      type: 'success',
      title: '模板已加载',
      detail: `${tpl.name} · ${tpl.nodes.length} 节点 / ${tpl.edges.length} 连线`,
      icon: '📚',
    })
  }, [setNodes, setEdges, pushHistory, pushToast])

  /** 从版本记录恢复 */
  const restoreFromVersion = useCallback((v) => {
    pushHistory()
    setNodes(v.nodes)
    setEdges(v.edges)
    setVersionDrawerOpen(false)
    pushToast({
      type: 'info',
      title: '已恢复版本',
      detail: `${v.nodeCount} 节点 / ${v.edgeCount} 连线`,
      icon: '↺',
    })
  }, [setNodes, setEdges, pushHistory, pushToast])

  /** 手动保存：复用 useAutosave 的 saveNow，并触发"主线推进 toast"（保留原有行为） */
  const handleManualSave = useCallback(() => {
    if (nodes.length === 0) {
      pushToast({ type: 'warning', title: '画布为空', detail: '请先添加节点再保存', icon: '⚠️' })
      return
    }
    saveNow('manual')
    /* 保留原有联动逻辑（不破坏业务） */
    const fb = deriveFeedbackFromCanvas(nodes, edges)
    learn.submitModelFeedback(fb)
    const nextStageName = learn.mainStages?.[learn.currentStageIdx + 1]?.title
    if (nextStageName) {
      setStageToast({
        icon: '🎉',
        title: '主线任务已推进',
        detail: `${learn.mainStages[learn.currentStageIdx]?.title || '当前阶段'} → ${nextStageName}`,
      })
    } else {
      setStageToast({
        icon: '✅',
        title: '模型已保存',
        detail: '5 阶段主线已全部完成，可前往"实验记录"继续编辑',
      })
    }
    setTimeout(() => setStageToast(null), 3500)
  }, [nodes, edges, saveNow, learn, pushToast])

  // 🚨 核心修改 1：将写死的计分逻辑替换为真实的异步 API 请求
  const evaluateModel = async () => {
    if (nodes.length === 0) { setEvalResult({ valid: false, score: '0%', suggest: '❌ 画布为空，请先添加节点' }); return }
    if (edges.length === 0) { setEvalResult({ valid: false, score: '0%', suggest: '⚠️ 请连接节点完成模型搭建' }); return }

    // 设置请求中的 UI 状态
    setEvalResult({ valid: true, score: '计算中...', suggest: '⏳ 评估智能体正在分析拓扑结构...' })

    try {
      // 提取画布数据构造契约负载
      const payload = {
        session_id: "default_canvas_session",
        user_intent: "评估当前画板配置",
        sandbox_config: {
          nodes: nodes.map(n => ({
            id: n.id,
            type: n.type.toUpperCase(), // 契约要求如 BACKBONE, HEAD 等，这里做个简单映射转换
            name: n.data.label,
            data: {} 
          })),
          edges: edges.map(e => ({
            source: e.source,
            target: e.target
          }))
        }
      }

      // 发送真实请求给后端
      const response = await fetch('/api/v1/agent/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await response.json();

      if (resJson.status === "success") {
        const data = resJson.data;
        // 把后端的反馈完整存入 state
        setEvalResult({
          valid: data.is_valid,
          score: data.estimated_metrics?.optimized_value || 'N/A',
          suggest: data.is_valid ? '✅ 模型结构合理，评估完成' : '⚠️ 模型结构存在逻辑问题',
          details: data.feedback // 包含 strengths, warnings, learning_suggestions
        });
        /* 后端评估通过 → 联动学习画像（赛题闭环：模型工坊 → 学情评估） */
        const fb = deriveFeedbackFromCanvas(nodes, edges)
        learn.submitModelFeedback(fb)
      } else {
        setEvalResult({ valid: false, score: 'N/A', suggest: `❌ 评估失败: ${resJson.message}` });
      }
    } catch (error) {
      setEvalResult({ valid: false, score: 'N/A', suggest: `❌ 网络错误: ${error.message}` });
    }
  }

  const saveCurrentModel = () => {
    // 保存到实验记录（savedModels）
    const modelData = {
      id: Date.now(),
      name: `模型_${savedModels.length + 1}`,
      nodes: nodes.map(n => ({ type: n.type, label: n.data.label })),
      edges: edges.length,
      savedAt: new Date().toLocaleString(),
    }
    const newModels = [...savedModels, modelData]
    setSavedModels(newModels)
    localStorage.setItem('vf_savedModels', JSON.stringify(newModels))
    setSaveStatus('success')
    // 复用 useAutosave + 主线推进 toast
    handleManualSave()
    setTimeout(() => setSaveStatus(null), 2000)
  }

  /* 🤖 AI 导师点评：基于画布状态给出自然语言点评（mock，体现 LLM 应用点） */
  const requestAiReview = () => {
    if (nodes.length === 0) {
      setAiReview({ text: '画布是空的。先从左侧拖入一个"基座模型"开始吧，这是 SAM 微调的标准第一步。' })
      return
    }
    setAiReviewLoading(true)
    setTimeout(() => {
      const typeSet = new Set(nodes.map(n => n.type))
      let review = ''
      if (edges.length === 0) {
        review = `你目前添加了 ${nodes.length} 个节点，但还没有连线。模型的前向传播需要节点之间的数据流，连线是把节点串成"管线"的关键步骤。试试从节点右侧的圆点拖到下一个节点的左侧圆点。`
      } else if (typeSet.has('attention') && typeSet.has('output')) {
        review = `你搭出了一个相对完整的管线（${nodes.length} 节点 / ${edges.length} 连线），并且用了 Attention 机制提升特征权重——这是 SAM 完整版的核心思路。建议再加一个 Dropout 节点防止过拟合，或者尝试多尺度特征融合提升精度。`
      } else if (typeSet.has('output')) {
        review = `你搭了 ${nodes.length} 个节点 / ${edges.length} 连线，已经形成了基本的数据流。考虑在中间加一个 Attention 层，让模型学会关注图像的关键区域，这对 SAM 分割任务很重要。`
      } else {
        review = `当前画布有 ${nodes.length} 节点 / ${edges.length} 连线。建议补一个"输出层"节点形成完整闭环，或者加 Attention 层提升模型对图像关键区域的关注能力。`
      }
      setAiReview({ text: review })
      setAiReviewLoading(false)
    }, 800)
  }

  /* 不依赖后端，直接基于画布推导 → 联动画像（"用模型工坊评价学习效果"） */
  const syncFeedbackNow = () => {
    const fb = deriveFeedbackFromCanvas(nodes, edges)
    learn.submitModelFeedback(fb)
    setSaveStatus('feedback')
    setTimeout(() => setSaveStatus(null), 2200)
  }

  const navigate = useNavigate()
  const loadPresetModel = (model) => {
    localStorage.setItem('vf_pendingModel', JSON.stringify({
      type: model.type, name: model.name, accuracy: model.accuracy
    }))
    navigate('/canvas')
  }

  useEffect(() => {
    if (activeTab === 'workshop') {
      const pending = localStorage.getItem('vf_pendingModel')
      if (pending) {
        try {
          const model = JSON.parse(pending)
          localStorage.removeItem('vf_pendingModel')
          setNodes([{ id: `preset-${Date.now()}`, type: model.type, data: { label: model.name }, position: { x: 200, y: 150 } }])
          setEdges([])
          setEvalResult({ valid: true, score: model.accuracy + '%', suggest: '✅ 模型已从模型库加载，可继续编辑' })
        } catch (_) { /* ignore */ }
      }
    }
  }, [activeTab])

  const loadSavedModel = (model) => {
    pushHistory()
    setNodes(model.nodes.map((n, i) => ({
      id: `load-${Date.now()}-${i}`,
      type: n.type,
      data: { label: n.label },
      position: { x: 100 + i * 180, y: 140 + (i % 2) * 80 },
    })))
    setEdges([])
    setEvalResult(null)
    pushToast({ type: 'info', title: '已加载实验', detail: model.name, icon: '📦', duration: 1500 })
  }

  /** 节点更新（来自 Drawer） */
  const handleNodeChange = useCallback((id, patch) => {
    pushHistory()
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }, [setNodes, pushHistory])

  /** 删除节点（来自 Drawer） */
  const handleNodeDelete = useCallback((id) => {
    pushHistory()
    setNodes((prev) => prev.filter((n) => n.id !== id))
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id))
    setDetailNodeId(null)
    pushToast({ type: 'info', title: '节点已删除', icon: '🗑', duration: 1500 })
  }, [setNodes, setEdges, pushHistory, pushToast])

  const deleteSavedModel = (id) => {
    const newModels = savedModels.filter(m => m.id !== id)
    setSavedModels(newModels)
    localStorage.setItem('vf_savedModels', JSON.stringify(newModels))
  }

  const nodeTypeDist = useMemo(() => {
    const dist = { base: 0, extract: 0, aggregate: 0, output: 0 }
    nodes.forEach(n => { if (dist[n.type] !== undefined) dist[n.type]++ })
    return [
      { type: 'base', count: dist.base, label: '基座', color: '#3b82f6' },
      { type: 'extract', count: dist.extract, label: '提取', color: '#10b981' },
      { type: 'aggregate', count: dist.aggregate, label: '融合', color: '#f59e0b' },
      { type: 'output', count: dist.output, label: '输出', color: '#8b5cf6' },
    ]
  }, [nodes])

  const TabNav = () => null

  const LeftPanel = () => {
    const [openGroups, setOpenGroups] = useState(['output', 'foundation', 'extract', 'fusion', 'output_module'])
    const toggleGroup = (key) => {
      setOpenGroups(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
    }

    // 通用按钮渲染（支持高亮态）
    const renderNodeBtn = (type) => {
      const cfg = nodeColors[type]
      if (!cfg) return null
      const isHighlight = type === 'output'
      return (
        <div
          key={type}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/reactflow', type)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onClick={() => addNode(type, cfg.label)}
          title="拖到画布或点击添加"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: isHighlight ? '12px 12px' : '8px 10px',
            borderRadius: isHighlight ? 10 : 8,
            border: isHighlight ? `2px solid ${cfg.border}` : '1px solid #e2e8f0',
            background: isHighlight ? cfg.bg : '#fff',
            cursor: 'grab',
            textAlign: 'left',
            transition: 'all 0.15s',
            borderLeft: isHighlight ? `4px solid ${cfg.border}` : `3px solid ${cfg.border}`,
            fontSize: isHighlight ? 13 : 11,
            boxShadow: isHighlight ? `0 4px 12px ${cfg.border}30` : 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = cfg.bg }}
          onMouseLeave={e => { e.currentTarget.style.background = isHighlight ? cfg.bg : '#fff' }}
        >
          <span style={{ fontSize: isHighlight ? 22 : 15 }}>{cfg.icon}</span>
          <span style={{ fontWeight: 700, color: '#1e293b' }}>{cfg.label}</span>
        </div>
      )
    }

    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: '14px 10px', overflowY: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6, padding: '0 6px' }}>📦 节点库</h3>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10, padding: '0 6px' }}>按住拖拽到画布 · 点击也可添加</div>

        {nodeGroups.map(group => {
          const isHighlight = group.highlight
          return (
            <div key={group.key} style={{ marginBottom: 6 }}>
              <div
                onClick={() => toggleGroup(group.key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: isHighlight ? '8px 8px' : '7px 6px',
                  borderRadius: 8,
                  cursor: 'pointer', userSelect: 'none',
                  transition: 'all 0.2s',
                  background: isHighlight ? '#faf5ff' : 'transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isHighlight ? '#f3e8ff' : '#f8fafc' }}
                onMouseLeave={e => { e.currentTarget.style.background = isHighlight ? '#faf5ff' : 'transparent' }}
              >
                <span style={{
                  fontSize: isHighlight ? 12 : 11,
                  fontWeight: 700,
                  color: isHighlight ? '#7c3aed' : '#475569',
                }}>{group.name}</span>
                <span style={{
                  fontSize: 10, color: isHighlight ? '#7c3aed' : '#94a3b8',
                  transform: openGroups.includes(group.key) ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: '0.2s',
                }}>▶</span>
              </div>

              {openGroups.includes(group.key) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 0 4px 4px' }}>
                  {group.nodes.map(renderNodeBtn)}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ height: 1, background: '#e8ecf1', margin: '10px 0' }}></div>

        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10, padding: '0 6px' }}>📌 模板</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={loadExample} style={{
            width: '100%', padding: '10px', borderRadius: 10, border: 'none',
            background: '#f0fdf4', color: '#10b981', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>📌 加载示例模型</button>
          <button onClick={clearCanvas} style={{
            width: '100%', padding: '10px', borderRadius: 10, border: 'none',
            background: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>🗑️ 清空画布</button>
        </div>
      </div>
    )
  }

  const RightPanel = () => (
    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', overflowY: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>⚙️ 操作</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <button onClick={evaluateModel} style={{
          padding: '10px 6px', borderRadius: 10, border: 'none', background: '#eff6ff', color: '#3b82f6',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>🔍 检查模型</button>
        <button onClick={saveCurrentModel} style={{
          padding: '10px 6px', borderRadius: 10, border: 'none', background: '#f0fdf4', color: '#10b981',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>💾 保存模型</button>
      </div>
      <button onClick={syncFeedbackNow} style={{
        width: '100%', padding: '9px 6px', borderRadius: 10, border: 'none',
        background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
        color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8,
        boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
      }}>🔗 联动学情评估（基于画布）</button>

      {/* 🤖 AI 导师点评按钮 —— 体现 LLM 应用点 */}
      <button onClick={requestAiReview} disabled={aiReviewLoading} style={{
        width: '100%', padding: '9px 6px', borderRadius: 10, border: 'none',
        background: aiReviewLoading ? '#cbd5e1' : 'linear-gradient(90deg, #f59e0b, #ef4444)',
        color: '#fff', fontSize: 12, fontWeight: 700,
        cursor: aiReviewLoading ? 'wait' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 12,
        boxShadow: aiReviewLoading ? 'none' : '0 2px 8px rgba(245,158,11,0.3)',
      }}>{aiReviewLoading ? '🤖 AI 导师分析中...' : '🤖 让 AI 导师点评画布'}</button>

      {/* AI 导师点评结果卡 */}
      {aiReview && (
        <div style={{
          marginBottom: 12, padding: '12px 12px',
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          borderRadius: 10, border: '1px solid #fbbf24',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>🤖 AI 导师点评</span>
            <button onClick={() => setAiReview(null)} style={{
              background: 'none', border: 'none', color: '#92400e',
              cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1,
            }}>×</button>
          </div>
          <div style={{ fontSize: 11, color: '#78350f', lineHeight: 1.7 }}>{aiReview.text}</div>
        </div>
      )}

      {saveStatus === 'success' && (
        <div style={{ marginBottom: 12, padding: '10px', background: '#f0fdf4', borderRadius: 10, fontSize: 12, color: '#10b981', fontWeight: 600 }}>
          ✅ 模型已保存！反馈已写入学习画像。
        </div>
      )}
      {saveStatus === 'feedback' && (
        <div style={{ marginBottom: 12, padding: '10px', background: 'linear-gradient(90deg, #ede9fe, #eff6ff)', borderRadius: 10, fontSize: 12, color: '#4338ca', fontWeight: 600 }}>
          🔗 学情评估已联动！查看首页「主线任务」右侧反馈。
        </div>
      )}

      {/* 🚨 核心修改 2：支持渲染后端返回的详细 feedback */}
          {evalResult && (
            <div style={{
              marginBottom: 14, padding: '14px 12px',
              background: evalResult.valid ? '#f0fdf4' : '#fef2f2',
              borderRadius: 10, border: `1px solid ${evalResult.valid ? '#bbf7d0' : '#fecaca'}`,
            }}>
              <div style={{ fontSize: 12, color: evalResult.valid ? '#10b981' : '#ef4444', fontWeight: 600, marginBottom: 6 }}>
                {evalResult.suggest}
              </div>

              {/* 动态渲染从后端拿到的详情数据 */}
              {evalResult.details && (
                 <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                   {evalResult.details.warnings?.length > 0 && (
                     <div style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', padding: '8px', borderRadius: 6, lineHeight: 1.5 }}>
                       <strong>⚠️ 警告:</strong> {evalResult.details.warnings.join(' ')}
                     </div>
                   )}
                   {evalResult.details.strengths?.length > 0 && (
                     <div style={{ fontSize: 11, color: '#047857', background: '#d1fae5', padding: '8px', borderRadius: 6, lineHeight: 1.5 }}>
                       <strong>👍 优点:</strong> {evalResult.details.strengths.join(' ')}
                     </div>
                   )}
                   {evalResult.details.learning_suggestions?.length > 0 && (
                     <div style={{ fontSize: 11, color: '#1d4ed8', background: '#dbeafe', padding: '8px', borderRadius: 6, lineHeight: 1.5 }}>
                       <strong>💡 建议:</strong> {evalResult.details.learning_suggestions.join(' ')}
                     </div>
                   )}
                 </div>
               )}

              {evalResult.score !== 'N/A' && evalResult.score !== '计算中...' && (
                <div style={{ fontSize: 12, color: '#1e293b', marginTop: 10 }}>
                  🎯 预估精度：<span style={{ fontWeight: 700, color: '#3b82f6', fontSize: 16 }}>{evalResult.score}</span>
                </div>
              )}
            </div>
          )}

          {/* 🎓 AI 导师建议条 — 让模型工坊从「工具」变「学习闭环」 */}
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
            border: '1px solid #c7d2fe',
            borderRadius: 10, padding: 12, marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>🎓</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>AI 导师建议</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>· 实时</span>
            </div>
            <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.6 }}>
              {nodes.length === 0
                ? <>💬 <strong>提示：</strong>从左侧拖入「基座模型」开始，这是 SAM 微调的标准第一步。</>
                : nodes.length < 3
                ? <>💬 <strong>当前阶段：</strong>已添加 {nodes.length} 个节点。继续添加特征提取或融合层以构建完整管线。</>
                : edges.length === 0
                ? <>💬 <strong>建议：</strong>节点已就位，但缺少连接。从左侧节点拖出连线，构建数据流动路径。</>
                : <>✅ <strong>当前状态：</strong>模型结构 {nodes.length} 节点 / {edges.length} 连接。可以点击「🔍 检查模型」让评估智能体给出评分与改进建议。</>
              }
            </div>
          </div>

      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>📊 模型统计</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
          <span style={{ color: '#64748b' }}>节点数量</span>
          <span style={{ fontWeight: 700, color: '#3b82f6' }}>{nodes.length}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
          <span style={{ color: '#64748b' }}>连接数量</span>
          <span style={{ fontWeight: 700, color: '#10b981' }}>{edges.length}</span>
        </div>
        <div style={{ height: 1, background: '#e2e8f0', margin: '10px 0' }}></div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>节点类型分布</div>
        {nodeTypeDist.map(item => (
          item.count > 0 && (
            <div key={item.type} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: '#64748b' }}>{item.icon || nodeColors[item.type]?.icon} {item.label}</span>
                <span style={{ fontWeight: 600 }}>{item.count}</span>
              </div>
              <div style={{ height: 5, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(8, (item.count / Math.max(nodes.length, 1)) * 100)}%`,
                  height: '100%', background: item.color, borderRadius: 99,
                  transition: 'width 0.3s',
                }}></div>
              </div>
            </div>
          )
        ))}
        {nodes.length === 0 && <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>暂无节点</div>}
      </div>
    </div>
  )

  const BuildTab = () => {
    // 键盘快捷键：Ctrl+Z / Ctrl+Shift+Z（绑定到容器，避免污染全局）
    const containerRef = useRef(null)
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const onKey = (e) => {
        // 防止在 input / textarea 中触发
        const tag = (e.target?.tagName || '').toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault(); undo()
        } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
          e.preventDefault(); redo()
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault(); saveNow('manual')
          pushToast({ type: 'success', title: '已手动保存', icon: '💾', duration: 1500 })
        }
      }
      el.addEventListener('keydown', onKey)
      return () => el.removeEventListener('keydown', onKey)
    }, [undo, redo, saveNow, pushToast])

    // 节点点击回调：包一层 setNodesChange，在选中时同时打开 Drawer
    const handleNodeClick = useCallback((_, node) => {
      setDetailNodeId(node.id)
    }, [])
    const handlePaneClick = useCallback(() => {
      setDetailNodeId(null)
    }, [])

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: 14, height: 'calc(100vh - 160px)' }} ref={containerRef} tabIndex={-1}>
        <LeftPanel />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <CanvasTopBar
            autosaveStatus={autosaveStatus}
            lastSavedAt={lastSavedAt}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onOpenVersions={() => setVersionDrawerOpen(true)}
            onOpenTemplates={() => setTemplateDrawerOpen(true)}
            versionCount={versions.length}
          />
          <div
            ref={reactFlowWrapper}
            onDragOver={onDragOver}
            onDrop={onDrop}
            style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flex: 1 }}
          >
            {nodes.length === 0 && <EmptyCanvasHint />}
            <ReactFlow
              nodes={nodes} edges={edges} nodeTypes={nodeTypes}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              fitView
            >
              <Background color="#cbd5e1" gap={20} size={1.5} variant="dots" />
              <Controls />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => {
                  const c = nodeColors[n.type]
                  return c?.border || '#94a3b8'
                }}
                nodeStrokeWidth={2}
                maskColor="rgba(59,130,246,0.06)"
                style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}
              />
            </ReactFlow>
          </div>
        </div>
        <RightPanel />

        {/* Drawer 层 */}
        <NodeDetailDrawer
          open={!!detailNode}
          node={detailNode}
          edges={edges}
          onClose={() => setDetailNodeId(null)}
          onChange={handleNodeChange}
          onDelete={handleNodeDelete}
        />
        <VersionHistoryDrawer
          open={versionDrawerOpen}
          versions={versions}
          onClose={() => setVersionDrawerOpen(false)}
          onRestore={restoreFromVersion}
          onRemove={removeVersion}
        />
        <TemplateLibraryDrawer
          open={templateDrawerOpen}
          onClose={() => setTemplateDrawerOpen(false)}
          onPick={loadTemplate}
        />

        {/* 全局 Toast 栈 */}
        <ToastStack toasts={toasts} onClose={removeToast} />
      </div>
    )
  }

  /* 实验记录：保留我保存的模型 + 预置模型库作为参考模板，
     重点呈现「保存的实验」是学生的学习足迹 */
  const RecordTab = () => (
    <div style={{ overflowY: 'auto', height: 'calc(100vh - 180px)', paddingRight: 4 }}>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>📓 我的实验记录</h3>
        {savedModels.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center', color: '#94a3b8',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <span style={{ fontSize: 40 }}>📭</span>
            <div style={{ marginTop: 8, fontSize: 13 }}>暂无实验记录，去「模型工坊」保存你的第一个模型吧</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {savedModels.map(model => (
              <div key={model.id} style={{
                background: '#fff', borderRadius: 12, padding: '16px 14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{model.name}</span>
                  <button onClick={() => deleteSavedModel(model.id)} style={{
                    padding: '4px 10px', fontSize: 11, borderRadius: 8, border: 'none',
                    background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontWeight: 600,
                  }}>删除</button>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                  节点: {model.nodes.length} | 连接: {model.edges}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>保存于 {model.savedAt}</div>
                <button onClick={() => loadSavedModel(model)} style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                  background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>在工坊中继续编辑 →</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>📦 参考模板</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {presetModels.map(model => (
            <div key={model.id} style={{
              background: '#fff', borderRadius: 12, padding: '16px 14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9',
            }}>
              <div style={{
                display: 'inline-flex', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                marginBottom: 10,
                background: nodeColors[model.type]?.bg || '#f1f5f9',
                color: nodeColors[model.type]?.border || '#64748b',
              }}>
                {nodeColors[model.type]?.icon} {nodeColors[model.type]?.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>{model.name}</div>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 6, lineHeight: 1.5 }}>{model.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>💾 {model.size}</span>
                <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>🎯 {model.accuracy}%</span>
              </div>
              <button onClick={() => loadPresetModel(model)} style={{
                width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
              }}>🧱 在工坊中打开 →</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const EvaluateTab = () => (
    <div style={{ overflowY: 'auto', height: 'calc(100vh - 180px)', paddingRight: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>📊 模型精度对比</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={compareData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={11} tick={{ fill: '#64748b' }} />
              <YAxis fontSize={11} tick={{ fill: '#64748b' }} domain={[80, 100]} />
              <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="精度" radius={[8, 8, 0, 0]}>
                {compareData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>⚡ 模型性能指标</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {compareData.map((model, i) => (
              <div key={model.name} style={{
                padding: '12px 14px', background: '#f8fafc', borderRadius: 10,
                borderLeft: `3px solid ${['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i]}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 6 }}>{model.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 12, color: '#64748b' }}>
                  <div>🎯 <span style={{ fontWeight: 600, color: '#3b82f6' }}>{model.精度}%</span></div>
                  <div>⚡ <span style={{ fontWeight: 600, color: '#10b981' }}>{model.速度}FPS</span></div>
                  <div>💾 <span style={{ fontWeight: 600, color: '#8b5cf6' }}>{model.内存}MB</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>🔍 当前画板模型评估</h3>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: '当前节点数', value: nodes.length, color: '#3b82f6', bg: '#eff6ff', icon: '🔵' },
            { label: '预估精度', value: evalResult?.score || '未评估', color: '#10b981', bg: '#f0fdf4', icon: '🎯' },
            { label: '模型状态', value: evalResult?.valid ? '✓ 合格' : '待检查', color: evalResult?.valid ? '#f59e0b' : '#94a3b8', bg: '#fffbeb', icon: '📋' },
            { label: '连接数', value: edges.length, color: '#8b5cf6', bg: '#faf5ff', icon: '🔗' },
          ].map(item => (
            <div key={item.label} style={{ flex: '1 1 160px', padding: '18px 16px', background: item.bg, borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{item.icon} {item.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
        <button onClick={evaluateModel} style={{
          width: '100%', padding: '12px', borderRadius: 12, border: 'none',
          background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.2s',
        }}>🔍 重新评估模型</button>
      </div>
    </div>
  )

  /* 当前 Tab 对应的中文标题（用于 PageHeader 面包屑） */
  const TAB_META = {
    workshop: { icon: '🧱', label: '模型工坊' },
    record:   { icon: '📓', label: '实验记录' },
    compare:  { icon: '📊', label: '模型对比' },
  }
  const curTabMeta = TAB_META[activeTab] || TAB_META.workshop

  return (
    <div style={{ position: 'relative' }}>
      <TabNav />
      {activeTab === 'workshop' && <BuildTab />}
      {activeTab === 'record' && <RecordTab />}
      {activeTab === 'compare' && <EvaluateTab />}

      {/* 🎉 全局主线推进 toast（右下角浮层，3.5 秒淡出） */}
      {stageToast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 2000,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff', padding: '14px 20px', borderRadius: 14,
          boxShadow: '0 10px 40px rgba(16,185,129,0.4), 0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: 12, minWidth: 280,
          animation: 'slideUpFade 0.3s ease',
        }}>
          <span style={{ fontSize: 28 }}>{stageToast.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{stageToast.title}</div>
            <div style={{ fontSize: 11, opacity: 0.95, marginTop: 2 }}>{stageToast.detail}</div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}