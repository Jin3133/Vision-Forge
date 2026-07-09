import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLearn } from '../../LearnContext.jsx'
import CustomPlanSection from './CustomPlanSection.jsx'

/* ════════════════════════════════════════════════════════════
   MapTab —— 学习地图（核心页面 · 承担「下一步怎么学」）
   ─────────────────────────────────────────────
   信息架构（自上而下）：
     ① 顶部  学习路线时间轴（横向 7 阶段）
              - 当前状态 / 掌握率 / AI 推荐原因 / 对应导师
     ② 中部左  今日学习任务（Today's Mission）
              - AI 学习计划 / 预计时长 / 目标 / 奖励 / 推荐资源
     ③ 中部右  4 智能体协同状态（Architect/Tutor/Generator/Evaluator）
              - 运行状态 / 最近任务 / 更新时间
     ④ 主区   节点 + 知识详情
              - 主区 = 当前选中节点的二级知识树（点击展开）
              - 右侧 = 知识详情 + 资源入口
     ⑤ Drawer  完整知识图谱（点击按钮右侧滑出，类似 Notion / Claude）
   ════════════════════════════════════════════════════════════ */

/* ─── 学习路径数据：7 阶段路线（顶层） ─── */
const ROAD_STEPS = [
  { id: 'py',    title: 'Python',     desc: '语言基础与科学计算',   agent: '🐍 Python 导师', status: 'done',    mastery: 95,
    rec: '基础扎实，可快速回顾', color: '#22c55e' },
  { id: 'cnn',   title: 'CNN',        desc: '卷积神经网络',         agent: '🧠 CNN 导师',    status: 'done',    mastery: 88,
    rec: '核心已掌握，建议复习 BN 与激活函数', color: '#22c55e' },
  { id: 'resnet',title: 'ResNet',     desc: '残差连接与深度网络',   agent: '🏗️ ResNet 导师', status: 'done',    mastery: 76,
    rec: '残差思想已理解，可继续深入', color: '#22c55e' },
  { id: 'attn',  title: 'Attention',  desc: '注意力机制',           agent: '👁️ 注意力导师',  status: 'current', mastery: 45,
    rec: '⏰ 你的易错点集中在 Attention，是当前最大瓶颈', color: '#3b82f6' },
  { id: 'trans', title: 'Transformer',desc: '编码器-解码器架构',    agent: '🔄 Transformer 导师', status: 'pending', mastery: 0,
    rec: '需先掌握 Attention', color: '#94a3b8' },
  { id: 'sam',   title: 'SAM',        desc: 'Segment Anything 模型',agent: '🌟 SAM 导师',     status: 'pending', mastery: 0,
    rec: '项目实战首选 · 与 Attention 强相关', color: '#a855f7' },
  { id: 'proj',  title: '项目实践',   desc: '完整项目开发与部署',   agent: '🚀 项目导师',    status: 'pending', mastery: 0,
    rec: '学完 SAM 后开启', color: '#94a3b8' },
]

/* ─── 二级知识树（每阶段下面的子知识点） ─── */
const SUB_TREE = {
  cnn: [
    { name: '卷积', mastery: 90, recommend: false, eta: 25,
      desc: '卷积核、步长、填充，感受野计算', deps: '线性代数基础' },
    { name: '池化', mastery: 85, recommend: false, eta: 15,
      desc: '最大池化 / 平均池化 / 全局池化', deps: '卷积' },
    { name: 'BN', mastery: 55, recommend: true, eta: 30,
      desc: 'Batch Normalization · 加速收敛、稳定训练', deps: '卷积' },
    { name: '激活函数', mastery: 70, recommend: false, eta: 20,
      desc: 'ReLU / Sigmoid / GELU / SwiGLU', deps: '微积分基础' },
  ],
  resnet: [
    { name: '残差块', mastery: 80, recommend: false, eta: 25,
      desc: 'y = F(x) + x · 解决网络退化', deps: 'CNN' },
    { name: '跳跃连接', mastery: 75, recommend: false, eta: 20,
      desc: 'Shortcut · 恒等映射与投影映射', deps: '残差块' },
    { name: '瓶颈结构', mastery: 40, recommend: true, eta: 35,
      desc: '1×1 → 3×3 → 1×1 · 减少计算量', deps: '残差块' },
  ],
  attn: [
    { name: 'Q / K / V', mastery: 60, recommend: false, eta: 30,
      desc: 'Query / Key / Value 三元组直觉', deps: '线性代数' },
    { name: 'Scaled Dot-Product', mastery: 35, recommend: true, eta: 40,
      desc: '注意力分数计算 · √d_k 缩放原因', deps: 'Q / K / V' },
    { name: 'Softmax 归一化', mastery: 50, recommend: false, eta: 20,
      desc: '把分数变成概率分布', deps: 'Scaled Dot-Product' },
    { name: '多头机制', mastery: 20, recommend: true, eta: 50,
      desc: 'Multi-Head · 多个子空间并行', deps: 'Scaled Dot-Product' },
  ],
  trans: [
    { name: '位置编码', mastery: 0, recommend: false, eta: 30,
      desc: 'Positional Encoding · 让模型感知顺序', deps: 'Attention' },
    { name: 'Encoder', mastery: 0, recommend: false, eta: 45,
      desc: '编码器层结构', deps: '位置编码 + Attention' },
    { name: 'Decoder', mastery: 0, recommend: false, eta: 50,
      desc: '解码器 + 交叉注意力', deps: 'Encoder' },
  ],
  sam: [
    { name: '图像编码器', mastery: 0, recommend: false, eta: 60,
      desc: 'ViT-H · 视觉骨干', deps: 'Transformer' },
    { name: '提示编码器', mastery: 0, recommend: true, eta: 45,
      desc: 'Prompt Encoder · 点 / 框 / mask', deps: '图像编码器' },
    { name: '掩码解码器', mastery: 0, recommend: false, eta: 50,
      desc: 'Mask Decoder · 输出分割结果', deps: '提示编码器' },
  ],
}

/* ─── 4 智能体协同状态 ─── */
const AGENTS = [
  { key: 'architect', name: 'Architect',  role: '架构引导 Agent',   status: 'running', last: '已为 CNN 阶段生成复习路径', time: '2 分钟前', icon: '🏛️', color: '#3b82f6' },
  { key: 'tutor',     name: 'Tutor',      role: '算法教研 Agent',   status: 'running', last: '正在讲解 Attention 缩放因子', time: '5 分钟前', icon: '🎓', color: '#22c55e' },
  { key: 'generator', name: 'Generator',  role: '资源生成 Agent',   status: 'idle',    last: '生成 SAM 入门讲义 v2', time: '1 小时前', icon: '✨', color: '#a855f7' },
  { key: 'evaluator', name: 'Evaluator',  role: '学情评估 Agent',   status: 'running', last: '评估完成 · 易错点维度 45', time: '8 分钟前', icon: '📊', color: '#f59e0b' },
]

/* ─── 资源类型 → 入口 ─── */
const RESOURCE_TYPES = [
  { key: 'doc',  icon: '📄', label: '官方文档', desc: 'PyTorch / TensorFlow 官方参考', color: '#3b82f6' },
  { key: 'paper',icon: '📑', label: '论文',     desc: 'arXiv 原文与导读', color: '#a855f7' },
  { key: 'video',icon: '🎥', label: '视频',     desc: '3Blue1Brown / CS231n', color: '#ef4444' },
  { key: 'note', icon: '📝', label: '讲义',     desc: 'AI 生成的个性化讲义', color: '#22c55e' },
  { key: 'exer', icon: '✏️', label: '练习',     desc: '5–10 题专项训练', color: '#f59e0b' },
  { key: 'lab',  icon: '🧪', label: '实验',     desc: '可在模型工坊直接跑', color: '#06b6d4' },
]

/* ───────────────────────────────────────────
   主组件
   ─────────────────────────────────────────── */
export default function MapTab() {
  const navigate = useNavigate()
  const learn = useLearn()
  const [selectedNode, setSelectedNode] = useState('attn')    // 当前选中的一级阶段
  const [selectedSub, setSelectedSub] = useState('Scaled Dot-Product') // 选中的子知识点
  const [drawerOpen, setDrawerOpen] = useState(false)           // 完整知识图谱 Drawer

  /* 默认选中当前阶段的第一个子节点 */
  useEffect(() => {
    const subs = SUB_TREE[selectedNode]
    if (subs && subs.length > 0) {
      setSelectedSub(subs[0].name)
    } else {
      setSelectedSub(null)
    }
  }, [selectedNode])

  const currentStep = ROAD_STEPS.find(s => s.id === selectedNode)
  const currentSub  = SUB_TREE[selectedNode]?.find(s => s.name === selectedSub)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ════════════════════════════════════════
          ① 顶部：学习路线时间轴（横向 7 阶段）
          ════════════════════════════════════════ */}
      <RoadmapTimeline
        steps={ROAD_STEPS}
        selectedId={selectedNode}
        onSelect={setSelectedNode}
        onOpenGraph={() => setDrawerOpen(true)}
      />

      {/* ════════════════════════════════════════
          ② 定制学习方案（独立卡片 · 深色渐变）
          ════════════════════════════════════════ */}
      <div style={{ marginTop: 16 }}>
        <CustomPlanSection />
      </div>

      {/* ════════════════════════════════════════
          ③ 今日学习任务 + ④ 4 Agent 协同状态
          ════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20, marginTop: 16 }}>
        <TodaysMission step={currentStep} />
        <AgentStatusBoard />
      </div>

      {/* ════════════════════════════════════════
          ④ 主区：节点 + 知识详情
          ─ 左：选中阶段的二级知识树
          ─ 右：知识详情 + 资源入口
          ════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        {/* 左侧：二级知识树（点击展开） */}
        <SubKnowledgeTree
          step={currentStep}
          subs={SUB_TREE[selectedNode] || []}
          selectedSub={selectedSub}
          onSelectSub={setSelectedSub}
        />

        {/* 右侧：知识详情 + 资源 + AI 推荐 */}
        <KnowledgeDetail
          step={currentStep}
          sub={currentSub}
          onStartLearning={() => navigate('/resources?tab=recommend')}
          onOpenWorkshop={() => navigate('/canvas?tab=workshop')}
        />
      </div>

      {/* ════════════════════════════════════════
          ⑤ Drawer：完整知识图谱（右侧滑出）
          ════════════════════════════════════════ */}
      <KnowledgeGraphDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeId={selectedNode}
        onSelect={setSelectedNode}
      />
    </div>
  )
}

/* ═══════════════════════════════════════
   ① RoadmapTimeline —— 横向 7 阶段时间轴
   ═══════════════════════════════════════ */
function RoadmapTimeline({ steps, selectedId, onSelect, onOpenGraph }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
      border: '1px solid #c7d2fe', borderRadius: 14, padding: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>
            🛤️ AI 学习路线
          </h3>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
            7 阶段 · 从 Python 基础到 SAM 项目实战 · 点击节点展开
          </div>
        </div>
        <button
          onClick={onOpenGraph}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            background: '#fff', color: '#4f46e5',
            border: '1px solid #c7d2fe', borderRadius: 8, cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(79,70,229,0.1)',
            transition: 'all .2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          🗺 展开知识图谱
        </button>
      </div>

      {/* 时间轴 —— 三段独立定位：圆圈行 / 文字行 */}
      <div style={{ position: 'relative', paddingTop: 4, paddingBottom: 4 }}>
        {/* 连接线 —— 严格穿过圆圈中心（圆圈 36px + 容差 18px） */}
        <div style={{
          position: 'absolute', left: 18, right: 18, top: 18,
          height: 3, borderRadius: 2, zIndex: 0,
          background: 'linear-gradient(90deg, #22c55e 0%, #22c55e 42%, #3b82f6 50%, #3b82f6 58%, #e2e8f0 70%, #e2e8f0 100%)',
        }} />
        {/* 圆圈行：高度 36px，与连接线严格对齐 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1, height: 36 }}>
          {steps.map((s) => {
            const isSelected = selectedId === s.id
            const isDone     = s.status === 'done'
            const isCurrent  = s.status === 'current'
            const dotBg      = isDone ? '#22c55e' : isCurrent ? '#3b82f6' : '#fff'
            const dotBorder  = isDone ? '#22c55e' : isCurrent ? '#3b82f6' : '#cbd5e1'
            const iconChar   = isDone ? '✓' : s.id === 'sam' ? '🌟' : s.id[0].toUpperCase()
            return (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                style={{
                  width: 36, height: 36, cursor: 'pointer', position: 'relative',
                  transition: 'transform .2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                title={s.title}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: dotBg, color: isDone || isCurrent ? '#fff' : '#94a3b8',
                  border: `3px solid ${isDone || isCurrent ? dotBorder : '#fff'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isCurrent ? 14 : 12, fontWeight: 700,
                  boxShadow: isCurrent ? '0 0 0 4px rgba(59,130,246,0.18)' :
                             isSelected ? `0 0 0 3px ${s.color}55` : '0 0 0 2px #fff',
                  transition: 'all .2s',
                }}>
                  {iconChar}
                </div>
              </div>
            )
          })}
        </div>
        {/* 文字行：与圆圈水平中心对齐 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1, marginTop: 10 }}>
          {steps.map((s) => {
            const isDone    = s.status === 'done'
            const isCurrent = s.status === 'current'
            return (
              <div key={s.id} style={{ width: 36, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  fontSize: 12, fontWeight: isCurrent ? 700 : 600,
                  color: isDone ? '#15803d' : isCurrent ? '#3b82f6' : '#475569',
                  whiteSpace: 'nowrap', marginBottom: 4,
                }}>
                  {s.title}
                </div>
                <div style={{
                  fontSize: 10, color: '#94a3b8',
                  background: '#fff', padding: '1px 6px', borderRadius: 8,
                  border: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                }}>
                  {isDone ? `${s.mastery}% ✓` : isCurrent ? `${s.mastery}% · 进行中` : '未开始'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════
   ② TodaysMission —— 今日学习任务
   ═══════════════════════════════════════ */
function TodaysMission({ step }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #f1f5f9', borderRadius: 12, padding: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>
          🎯 今日学习任务
        </h3>
        <span style={{
          fontSize: 11, color: '#fff', fontWeight: 600,
          padding: '3px 10px', borderRadius: 999,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
        }}>Today's Mission</span>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #eff6ff 0%, #faf5ff 100%)',
        border: '1px solid #c7d2fe', borderRadius: 10, padding: 14, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 11, color: '#4f46e5', fontWeight: 700,
            padding: '2px 8px', background: '#fff', borderRadius: 6, border: '1px solid #c7d2fe',
          }}>🤖 AI 学习计划</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>由 Architect Agent 每日生成</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
          主攻：{step.title} · {step.desc}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12 }}>
          <MissionItem icon="⏱" label="预计时长" value="45 分钟" color="#3b82f6" />
          <MissionItem icon="🎯" label="学习目标" value="掌握 2 个子知识点" color="#10b981" />
          <MissionItem icon="🏆" label="完成奖励" value="+5 分 易错点" color="#f59e0b" />
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#475569', marginBottom: 8, fontWeight: 600 }}>
        📚 推荐资源
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { icon: '🎥', name: '3Blue1Brown 注意力可视化', eta: '15min' },
          { icon: '📑', name: 'Attention Is All You Need 论文导读', eta: '20min' },
          { icon: '✏️', name: '5 题注意力专项练习', eta: '10min' },
        ].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', background: '#f8fafc', borderRadius: 8,
            border: '1px solid #f1f5f9',
          }}>
            <span style={{ fontSize: 14 }}>{r.icon}</span>
            <span style={{ fontSize: 12, color: '#334155', flex: 1 }}>{r.name}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{r.eta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MissionItem({ icon, label, value, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '8px 10px',
      border: `1px solid ${color}22`,
    }}>
      <div style={{ fontSize: 10, color: '#94a3b8' }}>{icon} {label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}

/* ═══════════════════════════════════════
   ③ AgentStatusBoard —— 4 智能体协同
   ═══════════════════════════════════════ */
function AgentStatusBoard() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #f1f5f9', borderRadius: 12, padding: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>
          🤖 4 智能体协同
        </h3>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>中央状态机驱动</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {AGENTS.map((a) => {
          const isRunning = a.status === 'running'
          return (
            <div key={a.key} style={{
              padding: 12, borderRadius: 10,
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${a.color}22, ${a.color}44)`,
                border: `1px solid ${a.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>{a.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{a.name}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>· {a.role}</span>
                </div>
                <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.last}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700,
                  color: isRunning ? '#10b981' : '#94a3b8',
                  padding: '2px 8px', borderRadius: 999,
                  background: isRunning ? '#ecfdf5' : '#f1f5f9',
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: isRunning ? '#10b981' : '#94a3b8',
                    animation: isRunning ? 'pulse 1.5s infinite' : 'none',
                  }} />
                  {isRunning ? '运行中' : '空闲'}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{a.time}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════
   ④a SubKnowledgeTree —— 二级知识树
   ═══════════════════════════════════════ */
function SubKnowledgeTree({ step, subs, selectedSub, onSelectSub }) {
  const getMasteryColor = (m) => {
    if (m >= 80) return { bg: '#ecfdf5', border: '#10b981', text: '#15803d' }
    if (m >= 50) return { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' }
    if (m > 0)   return { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' }
    return       { bg: '#f8fafc', border: '#cbd5e1', text: '#64748b' }
  }
  const getStatus = (s) => {
    if (s.mastery >= 80) return { label: '已掌握', color: '#10b981' }
    if (s.mastery > 0)   return { label: '学习中', color: '#3b82f6' }
    if (s.recommend)     return { label: '推荐学习', color: '#a855f7' }
    return                { label: '薄弱', color: '#ef4444' }
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #f1f5f9', borderRadius: 12, padding: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>
          🌿 {step.title} · 知识树
        </h3>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>点击子节点查看详情</span>
      </div>

      {/* 阶段当前状态 */}
      <div style={{
        padding: '10px 14px', marginBottom: 14,
        background: `linear-gradient(135deg, ${step.color}11, ${step.color}22)`,
        border: `1px solid ${step.color}33`, borderRadius: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: step.color }}>
            {step.status === 'done' ? '✓ 已完成' : step.status === 'current' ? '⚡ 进行中' : '○ 未开始'}
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>· {step.agent}</span>
        </div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>{step.rec}</div>
        {step.mastery > 0 && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 5, background: '#fff', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${step.mastery}%`, height: '100%',
                background: step.color, borderRadius: 3, transition: 'width .5s',
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: step.color }}>{step.mastery}%</span>
          </div>
        )}
      </div>

      {/* 二级子节点 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subs.map((s) => {
          const c = getMasteryColor(s.mastery)
          const st = getStatus(s)
          const isSelected = selectedSub === s.name
          return (
            <div
              key={s.name}
              onClick={() => onSelectSub(s.name)}
              style={{
                padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: isSelected ? c.bg : '#f8fafc',
                border: `2px solid ${isSelected ? c.border : 'transparent'}`,
                transition: 'all .2s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = '#f1f5f9'
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: st.color,
                  padding: '1px 6px', background: '#fff', borderRadius: 4,
                  border: `1px solid ${st.color}33`,
                }}>{st.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{s.name}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: c.text,
                  padding: '1px 6px', background: '#fff', borderRadius: 4,
                }}>{s.mastery}%</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{s.desc}</div>
              <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8' }}>
                ⏱ 预计 {s.eta} 分钟 · 依赖：{s.deps}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════
   ④b KnowledgeDetail —— 右侧详情
   ═══════════════════════════════════════ */
function KnowledgeDetail({ step, sub, onStartLearning, onOpenWorkshop }) {
  if (!sub) {
    return (
      <div style={{
        background: '#fff', border: '1px solid #f1f5f9', borderRadius: 12, padding: 32,
        textAlign: 'center', color: '#94a3b8',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👆</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>从左侧选择一个知识点</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>查看详情 / 资源 / AI 推荐</div>
      </div>
    )
  }

  /* AI 推荐原因（动态文案） */
  const recs = [
    { ok: true,  text: `已完成 ${step.title} 的前置知识` },
    { ok: true,  text: `YOLO / SAM 强依赖 ${sub.name}` },
    { ok: false, text: `当前掌握度 ${sub.mastery}%，是主要薄弱点` },
  ]
  const star = sub.mastery >= 50 ? 4 : sub.mastery > 0 ? 3 : 5

  return (
    <div style={{
      background: '#fff', border: '1px solid #f1f5f9', borderRadius: 12, padding: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* 标题 */}
      <div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>📍 知识点</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{sub.name}</span>
          <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>{step.title}</span>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{sub.desc}</div>
      </div>

      {/* 关键指标 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <Metric icon="📊" label="掌握度" value={`${sub.mastery}%`} color={sub.mastery >= 50 ? '#10b981' : '#ef4444'} />
        <Metric icon="⏱" label="预计时长" value={`${sub.eta} 分钟`} color="#3b82f6" />
        <Metric icon="⭐" label="收益" value={'★'.repeat(star) + '☆'.repeat(5 - star)} color="#f59e0b" />
      </div>

      {/* 资源入口 */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>📚 学习资源</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {RESOURCE_TYPES.map((r) => (
            <div key={r.key} style={{
              padding: '8px 10px', borderRadius: 8,
              background: '#f8fafc', border: `1px solid ${r.color}22`,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all .2s', cursor: 'pointer',
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${r.color}11`
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <span style={{ fontSize: 16 }}>{r.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: r.color }}>{r.label}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI 为什么推荐 */}
      <div style={{
        background: 'linear-gradient(135deg, #eff6ff 0%, #faf5ff 100%)',
        border: '1px solid #c7d2fe', borderRadius: 10, padding: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13 }}>🤖</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>为什么推荐 {sub.name}？</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {recs.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#334155' }}>
              <span style={{ color: r.ok ? '#10b981' : '#f59e0b', fontWeight: 700, flexShrink: 0 }}>
                {r.ok ? '✔' : '⚠'}
              </span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button
          onClick={onStartLearning}
          style={{
            flex: 2, padding: '11px 16px', fontSize: 13, fontWeight: 700,
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
            boxShadow: '0 4px 12px -2px rgba(59,130,246,0.4)',
            transition: 'transform .2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >🚀 开始学习 {sub.name}</button>
        <button
          onClick={onOpenWorkshop}
          style={{
            flex: 1, padding: '11px 16px', fontSize: 13, fontWeight: 600,
            background: '#fff', color: '#3b82f6',
            border: '1px solid #bfdbfe', borderRadius: 10, cursor: 'pointer',
            transition: 'all .2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
        >🛠 跑个实验</button>
      </div>
    </div>
  )
}

function Metric({ icon, label, value, color }) {
  return (
    <div style={{
      background: '#f8fafc', borderRadius: 8, padding: '8px 10px',
      border: `1px solid ${color}22`,
    }}>
      <div style={{ fontSize: 10, color: '#94a3b8' }}>{icon} {label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}

/* ═══════════════════════════════════════
   ⑤ KnowledgeGraphDrawer —— 完整知识图谱 Drawer
   ═══════════════════════════════════════ */
function KnowledgeGraphDrawer({ open, onClose, activeId, onSelect }) {
  if (!open) return null
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 999,
          animation: 'fadeIn .2s',
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
        background: '#fff', zIndex: 1000,
        boxShadow: '-10px 0 40px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight .3s',
      }}>
        {/* 顶部 */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>🗺 完整知识图谱</h3>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              7 阶段 × 多子知识点 · 整体一览
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#f1f5f9', border: 'none', color: '#64748b',
              fontSize: 16, cursor: 'pointer',
            }}
          >✕</button>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {ROAD_STEPS.map((s) => {
            const subs = SUB_TREE[s.id] || []
            return (
              <div key={s.id} style={{
                marginBottom: 14, padding: 12,
                background: s.id === activeId ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${s.id === activeId ? '#bfdbfe' : '#f1f5f9'}`,
                borderRadius: 10, cursor: 'pointer',
                transition: 'all .2s',
              }}
                onClick={() => onSelect(s.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: s.status === 'done' ? '#22c55e' : s.status === 'current' ? '#3b82f6' : '#cbd5e1',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {s.status === 'done' ? '✓' : s.id[0].toUpperCase()}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{s.title}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>· {s.agent}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: s.color, fontWeight: 700 }}>{s.mastery}%</span>
                </div>
                {subs.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginLeft: 30 }}>
                    {subs.map((sub) => (
                      <span key={sub.name} style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 6,
                        background: sub.recommend ? '#faf5ff' : '#fff',
                        color: sub.recommend ? '#7c3aed' : '#475569',
                        border: `1px solid ${sub.recommend ? '#c4b5fd' : '#e2e8f0'}`,
                        fontWeight: sub.recommend ? 600 : 500,
                      }}>
                        {sub.recommend && '⭐ '}{sub.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginLeft: 30 }}>— 待解锁 —</div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          ⭐ = AI 推荐学习
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  )
}
