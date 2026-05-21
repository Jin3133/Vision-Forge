import React, { useState, useCallback, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, addEdge, Handle, Position } from '@xyflow/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import '@xyflow/react/dist/style.css'

const BaseNode = ({ data, type }) => {
  const colors = {
    base: { bg: '#eff6ff', border: '#3b82f6', icon: '🧠' },
    extract: { bg: '#f0fdf4', border: '#10b981', icon: '🔍' },
    aggregate: { bg: '#fffbeb', border: '#f59e0b', icon: '🔗' },
    output: { bg: '#faf5ff', border: '#8b5cf6', icon: '📤' },
  }
  const { bg, border, icon } = colors[type] || colors.base
  return (
    <div style={{ background: bg, border: `2px solid ${border}`, borderRadius: 12, padding: 10, minWidth: 130, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{data.label}</div>
      <Handle type="target" position={Position.Left} style={{ background: border, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: border, width: 8, height: 8 }} />
    </div>
  )
}

const nodeTypes = {
  base: (p) => <BaseNode {...p} type="base" />,
  extract: (p) => <BaseNode {...p} type="extract" />,
  aggregate: (p) => <BaseNode {...p} type="aggregate" />,
  output: (p) => <BaseNode {...p} type="output" />,
}

const initialNodes = [{ id: 'sam', type: 'base', data: { label: 'SAM 基座' }, position: { x: 100, y: 150 } }]

// 预置模型库
const presetModels = [
  { id: 1, name: 'SAM 基础模型', type: 'base', accuracy: 89.2, size: '352MB', description: 'Segment Anything 基础模型' },
  { id: 2, name: 'SAM + 特征提取', type: 'extract', accuracy: 91.5, size: '428MB', description: '添加多尺度特征提取' },
  { id: 3, name: 'SAM + 注意力融合', type: 'aggregate', accuracy: 93.8, size: '486MB', description: '使用注意力机制融合' },
  { id: 4, name: 'SAM 完整版', type: 'output', accuracy: 94.2, size: '512MB', description: '完整分割模型' },
]

// 模型对比数据
const compareData = [
  { name: 'SAM基础', 精度: 89.2, 速度: 85, 内存: 352 },
  { name: 'SAM+特征', 精度: 91.5, 速度: 78, 内存: 428 },
  { name: 'SAM+注意力', 精度: 93.8, 速度: 72, 内存: 486 },
  { name: 'SAM完整', 精度: 94.2, 速度: 68, 内存: 512 },
]

export default function Canvas() {
  const location = useLocation()
  const urlParams = new URLSearchParams(location.search)
  const activeTab = urlParams.get('tab') || 'build'
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [evalResult, setEvalResult] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)
  const [savedModels, setSavedModels] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('savedModels')
    if (saved) setSavedModels(JSON.parse(saved))
  }, [])

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds))
  }, [setEdges])

  const addNode = (type, label) => {
    const newNode = { id: `node-${Date.now()}`, type, data: { label }, position: { x: 300 + Math.random() * 80, y: 150 + Math.random() * 80 } }
    setNodes((prev) => [...prev, newNode])
  }

  const loadExample = () => {
    setNodes([
      { id: '1', type: 'base', data: { label: 'SAM 基座' }, position: { x: 80, y: 150 } },
      { id: '2', type: 'extract', data: { label: '特征提取' }, position: { x: 350, y: 100 } },
      { id: '3', type: 'aggregate', data: { label: '特征融合' }, position: { x: 620, y: 150 } },
      { id: '4', type: 'output', data: { label: '分割结果' }, position: { x: 880, y: 150 } },
    ])
    setEdges([
      { id: 'e1-2', source: '1', target: '2', animated: true },
      { id: 'e2-3', source: '2', target: '3', animated: true },
      { id: 'e3-4', source: '3', target: '4', animated: true },
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
    setEvalResult({ valid: true, score: '89.2%', suggest: '✅ 结构合理，可生成学习方案' })
  }

  const saveCurrentModel = () => {
    const modelData = { id: Date.now(), name: `模型_${savedModels.length + 1}`, nodes: nodes.map(n => ({ type: n.type, label: n.data.label })), edges: edges.length, savedAt: new Date().toLocaleString() }
    const newModels = [...savedModels, modelData]
    setSavedModels(newModels)
    localStorage.setItem('savedModels', JSON.stringify(newModels))
    setSaveStatus('success')
    setTimeout(() => setSaveStatus(null), 2000)
  }

  const loadPresetModel = (model) => {
    setNodes([{ id: '1', type: model.type, data: { label: model.name }, position: { x: 100, y: 150 } }])
    setEdges([])
    setEvalResult({ valid: true, score: model.accuracy + '%', suggest: '✅ 模型已加载，可继续编辑' })
  }

  const deleteSavedModel = (id) => {
    const newModels = savedModels.filter(m => m.id !== id)
    setSavedModels(newModels)
    localStorage.setItem('savedModels', JSON.stringify(newModels))
  }

  return (
    <div>
      {/* Tab切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e8ecf1', paddingBottom: 12 }}>
        {[
          { key: 'build', name: '模型搭建', icon: '🔧' },
          { key: 'library', name: '模型库', icon: '📦' },
          { key: 'evaluate', name: '模型评估', icon: '📊' },
        ].map(tab => (
          <Link key={tab.key} to={`/canvas?tab=${tab.key}`}>
            <button style={{
              padding: '8px 20px', borderRadius: 20, fontSize: 13,
              background: activeTab === tab.key ? '#3b82f6' : '#f1f5f9',
              color: activeTab === tab.key ? '#fff' : '#64748b',
              boxShadow: 'none'
            }}>{tab.icon} {tab.name}</button>
          </Link>
        ))}
      </div>

      {/* 模型搭建 Tab */}
      {activeTab === 'build' && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 280px', gap: 16, height: 'calc(100vh - 140px)' }}>
          {/* 左侧节点库 */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>📦 节点库</h3>
            <button onClick={() => addNode('base', 'SAM 模型')} style={{ width: '100%', marginBottom: 8, padding: 8 }}>🧠 基座模型</button>
            <button onClick={() => addNode('extract', '特征提取')} style={{ width: '100%', marginBottom: 8, padding: 8 }}>🔍 特征提取</button>
            <button onClick={() => addNode('aggregate', '特征融合')} style={{ width: '100%', marginBottom: 8, padding: 8 }}>🔗 特征融合</button>
            <button onClick={() => addNode('output', '输出层')} style={{ width: '100%', marginBottom: 16, padding: 8 }}>📤 输出层</button>
            <div style={{ height: 1, background: '#e8ecf1', margin: '12px 0' }}></div>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>📌 模板</h3>
            <button onClick={loadExample} style={{ width: '100%', marginBottom: 8, padding: 8, background: '#10b981' }}>📌 加载示例模型</button>
            <button onClick={clearCanvas} style={{ width: '100%', padding: 8, background: '#ef4444' }}>🗑️ 清空画布</button>
          </div>

          {/* 画布 */}
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
              <Background color="#e2e8f0" gap={16} size={1} />
              <Controls />
            </ReactFlow>
          </div>

          {/* 右侧面板 */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>⚙️ 操作</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <button onClick={evaluateModel} style={{ padding: 8 }}>🔍 检查模型</button>
              <button onClick={saveCurrentModel} style={{ padding: 8, background: '#10b981' }}>💾 保存模型</button>
            </div>

            {saveStatus === 'success' && <div style={{ marginBottom: 12, padding: 8, background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#10b981' }}>✅ 模型已保存！</div>}

            {evalResult && (
              <div style={{ marginBottom: 16, padding: 12, background: evalResult.valid ? '#f0fdf4' : '#fef2f2', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: evalResult.valid ? '#10b981' : '#ef4444', marginBottom: 4 }}>{evalResult.suggest}</div>
                {evalResult.valid && <div style={{ fontSize: 12 }}>🎯 预估精度：{evalResult.score}</div>}
              </div>
            )}

            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>📊 模型统计</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>节点数量 <span style={{ fontWeight: 600 }}>{nodes.length}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>连接数量 <span style={{ fontWeight: 600 }}>{edges.length}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* 模型库 Tab */}
      {activeTab === 'library' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>📦 预置模型库</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {presetModels.map(model => (
                <div key={model.id} style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{model.name}</span>
                    <span style={{ fontSize: 12, color: '#10b981' }}>精度: {model.accuracy}%</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{model.description}</p>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>模型大小: {model.size}</div>
                  <button onClick={() => loadPresetModel(model)} style={{ width: '100%', padding: 8 }}>加载此模型</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>💾 我保存的模型</h3>
            {savedModels.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#94a3b8' }}>暂无保存的模型，去「模型搭建」保存一个吧</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {savedModels.map(model => (
                  <div key={model.id} style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{model.name}</span>
                      <button onClick={() => deleteSavedModel(model.id)} style={{ padding: '4px 8px', fontSize: 11, background: '#ef4444' }}>删除</button>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>节点数: {model.nodes.length} | 连接数: {model.edges}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>保存于: {model.savedAt}</div>
                    <button onClick={() => { setNodes(model.nodes.map((n, i) => ({ id: `load-${i}`, type: n.type, data: { label: n.label }, position: { x: 100 + i * 150, y: 150 } }))); setEdges([]) }} style={{ width: '100%', padding: 8, background: '#10b981' }}>加载模型</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 模型评估 Tab */}
      {activeTab === 'evaluate' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* 模型对比图表 */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>📊 模型精度对比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="精度" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 模型性能指标 */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>⚡ 模型性能指标</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {compareData.map(model => (
                  <div key={model.name} style={{ padding: 12, background: '#f8fafc', borderRadius: 10 }}>
                    <div style={{ fontWeight: 500, marginBottom: 8 }}>{model.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div>🎯 精度: {model.精度}%</div>
                      <div>⚡ 推理速度: {model.速度} FPS</div>
                      <div>💾 内存: {model.内存} MB</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 当前模型评估 */}
          <div style={{ marginTop: 20, background: '#fff', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>🔍 当前模型评估</h3>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, padding: 16, background: '#eff6ff', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>当前节点数</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{nodes.length}</div>
              </div>
              <div style={{ flex: 1, padding: 16, background: '#f0fdf4', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>预估精度</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>{evalResult?.score || '未评估'}</div>
              </div>
              <div style={{ flex: 1, padding: 16, background: '#fffbeb', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>模型状态</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{evalResult?.valid ? '✓ 合格' : '待检查'}</div>
              </div>
            </div>
            <button onClick={evaluateModel} style={{ marginTop: 20, width: '100%', padding: 10 }}>🔍 重新评估模型</button>
          </div>
        </div>
      )}
    </div>
  )
}