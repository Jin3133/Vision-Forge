import React, { useMemo } from 'react'
import { useLearn } from '../../LearnContext.jsx'

/* 学习统计卡片（5 项：综合评分 / 知识掌握 / 代码能力 / 易错点 / 学习节奏）
   数据来源：LearnContext.learnerPortrait */
export default function LearningStats() {
  const learn = useLearn()
  const portrait = learn.learnerPortrait || { dimensions: {}, overallScore: 0 }
  const dims = portrait.dimensions || {}

  const stats = useMemo(() => {
    const knowledgeVal = dims['知识掌握']?.value ?? 0
    const codingVal = dims['代码能力']?.value ?? 0
    const pitfallVal = dims['易错点']?.value ?? 0
    const paceVal = dims['学习节奏']?.value ?? 0
    const interestVal = dims['兴趣程度']?.value ?? 0

    return [
      { key: 'overall', icon: '🎯', label: '综合评分', value: portrait.overallScore || Math.round(
        Object.values(dims).reduce((s, d) => s + (d.value || 0), 0) / Math.max(1, Object.keys(dims).length)
      ), suffix: '分', hint: '6 维平均', color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' },
      { key: 'knowledge', icon: '📚', label: '知识掌握', value: knowledgeVal, suffix: '分', hint: '概念理解', color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' },
      { key: 'coding', icon: '💻', label: '代码能力', value: codingVal, suffix: '分', hint: '工程实践', color: '#06b6d4', bg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)' },
      { key: 'pace', icon: '⏱️', label: '学习节奏', value: paceVal, suffix: '分', hint: `${learn.learningPace || 0}h/周`, color: '#eab308', bg: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)' },
      { key: 'interest', icon: '⭐', label: '兴趣程度', value: interestVal, suffix: '分', hint: '内驱力指标', color: '#a855f7', bg: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)' },
    ]
  }, [portrait.overallScore, dims, learn.learningPace])

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
      border: '1px solid #f1f5f9', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>
          📊 学习统计
        </h3>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>6 维画像关键指标</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {stats.map((s) => (
          <div
            key={s.key}
            style={{
              background: s.bg,
              borderRadius: 12,
              padding: '14px 14px',
              border: `1px solid ${s.color}22`,
              transition: 'transform .25s, box-shadow .25s',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)'
              e.currentTarget.style.boxShadow = `0 10px 24px -8px ${s.color}44`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{
                fontSize: 30, fontWeight: 800, color: s.color, lineHeight: 1,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              }}>{s.value}</span>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{s.suffix}</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{s.hint}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
