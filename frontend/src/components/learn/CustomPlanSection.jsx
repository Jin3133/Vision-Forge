import React, { useState, useRef } from 'react'

/* ════════════════════════════════════════════════════════════
   CustomPlanSection —— 「定制我的学习方案」
   ─────────────────────────────────────────────
   风格：与项目其它卡片保持一致（白色科技风 + 浅蓝紫点缀）
   - 白底卡片 + 浅蓝紫渐变细边
   - 蓝色图标徽章（跟"路线时间轴"风格对齐）
   - 选中态用蓝紫渐变
   - 阴影克制，符合专业学习平台调性
   ════════════════════════════════════════════════════════════ */

const SKILL_TAGS = [
  'Python', 'PyTorch', '计算机视觉', '模型架构',
  '图像分割', '注意力机制', 'Transformer', 'SAM',
]

function buildPlan(skills) {
  if (!skills || skills.length === 0) return null
  const main = skills[0]
  const sub  = skills[1] || '核心概念'
  return {
    period: '4 周',
    difficulty: '中级',
    direction: skills.join('、'),
    weeks: [
      { week: '第 1 周', topic: `${main} 基础巩固 + 环境配置`,
        desc: '建立开发环境、复习前置知识、跑通最小 demo' },
      { week: '第 2 周', topic: `${main} 核心机制深入`,
        desc: `理解 ${main} 的关键原理，阅读 1 篇综述论文` },
      { week: '第 3 周', topic: `${sub} 专项训练`,
        desc: `围绕 ${sub} 做 5–8 题专项练习，输出错题归因表` },
      { week: '第 4 周', topic: '综合项目实战与评估',
        desc: '在「模型工坊」完成 1 个最小可运行项目 + 撰写总结' },
    ],
    links: ['模型搭建', '推荐课程', '模型评估', '错题归因'],
  }
}

export default function CustomPlanSection() {
  const [selected, setSelected] = useState([])
  const [plan, setPlan] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [generating, setGenerating] = useState(false)
  const planRef = useRef(null)

  const toggle = (s) => {
    setSelected((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }
  const generate = () => {
    if (selected.length === 0) return
    setGenerating(true)
    setTimeout(() => {
      const p = buildPlan(selected)
      setPlan(p)
      setShowDetail(true)
      setGenerating(false)
      setTimeout(() => planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
    }, 700)
  }
  const reset = () => {
    setSelected([])
    setPlan(null)
    setShowDetail(false)
  }

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 14,
      padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)',
    }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{
              fontSize: 16,
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, #eff6ff, #ede9fe)',
              border: '1px solid #c7d2fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✨</span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              定制我的学习方案
            </h3>
            <span style={{
              fontSize: 10, color: '#4f46e5', fontWeight: 600,
              padding: '3px 10px',
              background: 'linear-gradient(90deg, #eff6ff, #ede9fe)',
              borderRadius: 999, border: '1px solid #c7d2fe',
            }}>AI Agent 协同生成</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', paddingLeft: 40 }}>
            选 1–3 个想深入的技能 · Architect + Generator Agent 联合生成 4 周多维计划
          </div>
        </div>
        {plan && (
          <button
            onClick={reset}
            style={{
              fontSize: 11, color: '#64748b',
              background: '#f8fafc', border: '1px solid #e2e8f0',
              padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
              transition: 'all .2s', fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9'
              e.currentTarget.style.borderColor = '#cbd5e1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8fafc'
              e.currentTarget.style.borderColor = '#e2e8f0'
            }}
          >↻ 重新定制</button>
        )}
      </div>

      {/* 内容区 */}
      <div>
        {!plan ? (
          <>
            {/* 技能多选 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {SKILL_TAGS.map((s) => {
                const on = selected.includes(s)
                return (
                  <button
                    key={s}
                    onClick={() => toggle(s)}
                    style={{
                      padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                      border: '1px solid',
                      borderColor: on ? '#3b82f6' : '#e2e8f0',
                      background: on
                        ? 'linear-gradient(90deg, #3b82f6, #6366f1)'
                        : '#f8fafc',
                      color: on ? '#fff' : '#475569',
                      fontWeight: on ? 600 : 500,
                      transition: 'all .2s',
                      boxShadow: on ? '0 4px 12px -2px rgba(59,130,246,0.35)' : 'none',
                    }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = '#f1f5f9' }}
                    onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = '#f8fafc' }}
                  >{on ? '✓ ' : ''}{s}</button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={generate}
                disabled={selected.length === 0 || generating}
                style={{
                  padding: '10px 22px', fontSize: 13, fontWeight: 700,
                  background: selected.length === 0 || generating
                    ? '#e2e8f0'
                    : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                  color: selected.length === 0 || generating ? '#94a3b8' : '#fff',
                  border: 'none', borderRadius: 10,
                  cursor: selected.length === 0 || generating ? 'not-allowed' : 'pointer',
                  boxShadow: selected.length === 0 || generating
                    ? 'none'
                    : '0 6px 16px -4px rgba(59,130,246,0.4)',
                  transition: 'all .2s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {generating ? (
                  <>
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%',
                      border: '2px solid #cbd5e1',
                      borderTopColor: '#3b82f6',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    AI 正在生成方案...
                  </>
                ) : (
                  <>🚀 生成智能学习方案</>
                )}
              </button>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                已选 <strong style={{ color: '#3b82f6' }}>{selected.length}</strong> / 3 个技能
              </span>
            </div>
          </>
        ) : (
          /* 方案展示 */
          <div ref={planRef} style={{ scrollMarginTop: 20 }}>
            {/* 概要 */}
            <div style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
              border: '1px solid #c7d2fe',
              borderRadius: 10, padding: 12, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>📋 你的智能学习方案</span>
              <PlanMeta label="周期" value={plan.period} />
              <PlanMeta label="难度" value={plan.difficulty} />
              <PlanMeta label="方向" value={plan.direction} />
              <button
                onClick={() => setShowDetail((d) => !d)}
                style={{
                  marginLeft: 'auto', padding: '5px 14px',
                  background: '#fff',
                  border: '1px solid #3b82f6', color: '#3b82f6',
                  borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600,
                  transition: 'all .2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
              >{showDetail ? '收起方案 ▲' : '查看完整方案 ▼'}</button>
            </div>

            {/* 完整方案 */}
            {showDetail && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10, padding: 14,
              }}>
                {/* 快捷链接 */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {plan.links.map((link) => (
                    <a key={link} href="#" style={{
                      fontSize: 11, color: '#3b82f6', textDecoration: 'none',
                      padding: '4px 12px', background: '#fff',
                      border: '1px solid #bfdbfe', borderRadius: 6, fontWeight: 600,
                      transition: 'all .2s',
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >{link} →</a>
                  ))}
                </div>
                {/* 4 周计划 */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {plan.weeks.map((w, idx) => (
                    <div key={w.week} style={{
                      display: 'flex', gap: 12, padding: '10px 0',
                      borderBottom: idx < plan.weeks.length - 1 ? '1px solid #f1f5f9' : 'none',
                      alignItems: 'flex-start',
                    }}>
                      <div style={{
                        flexShrink: 0, width: 56,
                        fontWeight: 700, color: '#3b82f6', fontSize: 12,
                        paddingTop: 2,
                      }}>{w.week}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, marginBottom: 3 }}>
                          {w.topic}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.5 }}>
                          {w.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

function PlanMeta({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
      <span style={{ color: '#64748b' }}>{label}：</span>
      <span style={{ color: '#1e293b', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
