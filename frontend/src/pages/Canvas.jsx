import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge, Handle, Position, MiniMap } from '@xyflow/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import '@xyflow/react/dist/style.css'

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

// 节点分组（用于折叠面板）
const nodeGroups = [
  { name: '基础模块', key: 'foundation', nodes: ['input', 'encoder', 'prompt_encoder'] },
  { name: '特征提取', key: 'extract', nodes: ['conv', 'attention', 'extract', 'pooling'] },
  { name: '融合层', key: 'fusion', nodes: ['aggregate', 'norm', 'activation', 'dropout'] },
  { name: '输出模块', key: 'output', nodes: ['decoder', 'fc', 'output', 'base'] },
]

const BaseNode = ({ data, type, selected }) => {
  const { bg, border, icon } = nodeColors[type] || nodeColors.base
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
      <Handle type="source" position={Position.Right} style={{
        background: '#fff', border: `2.5px solid ${border}`,
        width: 10, height: 10, borderRadius: '50%',
      }} />
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
  const location = useLocation()
  const urlParams = new URLSearchParams(location.search)
  const activeTab = urlParams.get('tab') || 'build'

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [evalResult, setEvalResult] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)
  const [savedModels, setSavedModels] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('vf_savedModels')
    if (saved) setSavedModels(JSON.parse(saved))
  }, [])

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds))
  }, [setEdges])

  const addNode = (type, label) => {
    const newNode = {
      id: `node-${Date.now()}`,
      type,
      data: { label },
      position: { x: 200 + Math.random() * 120, y: 120 + Math.random() * 120 },
    }
    setNodes((prev) => [...prev, newNode])
  }

  const loadExample = () => {
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
  }

  const clearCanvas = () => {
    setNodes([])
    setEdges([])
    setEvalResult(null)
  }

  const evaluateModel = () => {
    if (nodes.length === 0) { setEvalResult({ valid: false, score: '0%', suggest: '❌ 画布为空，请先添加节点' }); return }
    if (edges.length === 0) { setEvalResult({ valid: false, score: '0%', suggest: '⚠️ 请连接节点完成模型搭建' }); return }
    const hasOutput = nodes.some(n => n.type === 'output')
    if (!hasOutput) { setEvalResult({ valid: false, score: '0%', suggest: '⚠️ 模型缺少输出层，请添加输出节点' }); return }
    const accuracy = Math.min(94.2, 85 + nodes.length * 2.1 + edges.length * 0.5).toFixed(1)
    setEvalResult({ valid: true, score: accuracy + '%', suggest: '✅ 结构合理，可生成学习方案' })
  }

  const saveCurrentModel = () => {
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
    setTimeout(() => setSaveStatus(null), 2000)
  }

  const navigate = useNavigate()
  const loadPresetModel = (model) => {
    // 保存到 localStorage 以便跨页面加载
    localStorage.setItem('vf_pendingModel', JSON.stringify({
      type: model.type, name: model.name, accuracy: model.accuracy
    }))
    // 跳转到模型搭建页面
    navigate('/canvas')
  }

  // 检查是否有待加载的模型（从模型库跳转过来）
  useEffect(() => {
    if (activeTab === 'build') {
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
    setNodes(model.nodes.map((n, i) => ({
      id: `load-${Date.now()}-${i}`,
      type: n.type,
      data: { label: n.label },
      position: { x: 100 + i * 180, y: 140 + (i % 2) * 80 },
    })))
    setEdges([])
    setEvalResult(null)
  }

  const deleteSavedModel = (id) => {
    const newModels = savedModels.filter(m => m.id !== id)
    setSavedModels(newModels)
    localStorage.setItem('vf_savedModels', JSON.stringify(newModels))
  }

  // 节点类型分布数据
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

  // ==================== Tab切换栏 ====================
  const TabNav = () => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e8ecf1', paddingBottom: 12 }}>
      {[
        { key: 'build', name: '模型搭建', icon: '🔧' },
        { key: 'library', name: '模型库', icon: '📦' },
        { key: 'evaluate', name: '模型评估', icon: '📊' },
      ].map(tab => (
        <Link key={tab.key} to={`/canvas?tab=${tab.key}`}>
          <button style={{
            padding: '8px 22px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            background: activeTab === tab.key ? '#3b82f6' : '#f1f5f9',
            color: activeTab === tab.key ? '#fff' : '#64748b',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: activeTab === tab.key ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
          }}>{tab.icon} {tab.name}</button>
        </Link>
      ))}
    </div>
  )

  // ==================== 左侧面板（折叠分组） ====================
  const LeftPanel = () => {
    const [openGroups, setOpenGroups] = useState(['foundation', 'extract', 'fusion', 'output'])
    const toggleGroup = (key) => {
      setOpenGroups(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
    }
    return (
      <div style={{ background: '#fff', borderRadius: 12, padding: '14px 10px', overflowY: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10, padding: '0 6px' }}>📦 节点库</h3>

        {nodeGroups.map(group => (
          <div key={group.key} style={{ marginBottom: 6 }}>
            {/* 分组标题 — 可点击折叠 */}
            <div
              onClick={() => toggleGroup(group.key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 6px', borderRadius: 8, cursor: 'pointer', userSelect: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{group.name}</span>
              <span style={{
                fontSize: 10, color: '#94a3b8',
                transform: openGroups.includes(group.key) ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: '0.2s',
              }}>▶</span>
            </div>

            {/* 分组成员 */}
            {openGroups.includes(group.key) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 0 4px 4px' }}>
                {group.nodes.map(type => {
                  const cfg = nodeColors[type]
                  if (!cfg) return null
                  return (
                    <button key={type} onClick={() => addNode(type, cfg.label)} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
                      background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                      borderLeft: `3px solid ${cfg.border}`, fontSize: 11,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = cfg.bg }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
                    >
                      <span style={{ fontSize: 15 }}>{cfg.icon}</span>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{cfg.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}

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

  // ==================== 右侧面板 ====================
  const RightPanel = () => (
    <div style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', overflowY: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>⚙️ 操作</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <button onClick={evaluateModel} style={{
          padding: '10px 6px', borderRadius: 10, border: 'none', background: '#eff6ff', color: '#3b82f6',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>🔍 检查模型</button>
        <button onClick={saveCurrentModel} style={{
          padding: '10px 6px', borderRadius: 10, border: 'none', background: '#f0fdf4', color: '#10b981',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>💾 保存模型</button>
      </div>

      {saveStatus === 'success' && (
        <div style={{ marginBottom: 12, padding: '10px', background: '#f0fdf4', borderRadius: 10, fontSize: 12, color: '#10b981', fontWeight: 600 }}>
          ✅ 模型已保存！
        </div>
      )}

      {evalResult && (
        <div style={{
          marginBottom: 14, padding: '14px 12px',
          background: evalResult.valid ? '#f0fdf4' : '#fef2f2',
          borderRadius: 10, border: `1px solid ${evalResult.valid ? '#bbf7d0' : '#fecaca'}`,
        }}>
          <div style={{ fontSize: 12, color: evalResult.valid ? '#10b981' : '#ef4444', fontWeight: 600, marginBottom: 6 }}>
            {evalResult.suggest}
          </div>
          {evalResult.valid && (
            <div style={{ fontSize: 12, color: '#1e293b' }}>
              🎯 预估精度：<span style={{ fontWeight: 700, color: '#3b82f6', fontSize: 16 }}>{evalResult.score}</span>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>
                💡 折中方案：基于轻量级效果模拟（避免直接修改基座源码导致兼容性问题，5.21会议决议）
              </div>
            </div>
          )}
        </div>
      )}

      {/* 模型统计 */}
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

  // ==================== 模型搭建 Tab ====================
  const BuildTab = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 240px', gap: 14, height: 'calc(100vh - 160px)' }}>
      <LeftPanel />
      {/* 中间画布 */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {nodes.length === 0 && <EmptyCanvasHint />}
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          fitView
        >
          <Background color="#cbd5e1" gap={20} size={1.5} variant="dots" />
          <Controls />
          <MiniMap style={{ borderRadius: 8, overflow: 'hidden' }} pannable zoomable />
        </ReactFlow>
      </div>
      <RightPanel />
    </div>
  )

  // ==================== 模型库 Tab ====================
  const LibraryTab = () => (
    <div style={{ overflowY: 'auto', height: 'calc(100vh - 160px)', paddingRight: 4 }}>
      {/* 预置模型 */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>📦 预置模型库</h3>
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
              }}>🔧 在工坊中打开 →</button>
            </div>
          ))}
        </div>
      </div>

      {/* 我保存的模型 */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>💾 我保存的模型</h3>
        {savedModels.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center', color: '#94a3b8',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <span style={{ fontSize: 40 }}>📭</span>
            <div style={{ marginTop: 8, fontSize: 13 }}>暂无保存的模型，去「模型搭建」保存一个吧</div>
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
                }}>加载模型</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ==================== 模型评估 Tab ====================
  const EvaluateTab = () => (
    <div style={{ overflowY: 'auto', height: 'calc(100vh - 160px)', paddingRight: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 精度对比 */}
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

        {/* 性能指标 */}
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

      {/* 当前评估结果 */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>🔍 当前模型评估</h3>
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

  return (
    <div>
      <TabNav />
      {activeTab === 'build' && <BuildTab />}
      {activeTab === 'library' && <LibraryTab />}
      {activeTab === 'evaluate' && <EvaluateTab />}
    </div>
  )
}