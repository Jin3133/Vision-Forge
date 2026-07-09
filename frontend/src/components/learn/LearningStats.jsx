import React from 'react'

/* 学习统计卡片（5 项：连续学习 / 学习时长 / 完成知识点 / 练习正确率 / AI 生成资源数）
   风格：蓝白科技风 + 渐变悬浮 */
const STATS = [
  {
    key: 'streak', icon: '🔥', label: '连续学习', value: 14, suffix: '天',
    hint: '距 7 天里程碑 +1', color: '#f97316', bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
  },
  {
    key: 'hours', icon: '⏱️', label: '累计学习时长', value: 86, suffix: 'h',
    hint: '本周 +12.5h', color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
  },
  {
    key: 'topics', icon: '🎯', label: '完成知识点', value: 42, suffix: '个',
    hint: '总进度 68%', color: '#10b981', bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
  },
  {
    key: 'accuracy', icon: '🎯', label: '练习正确率', value: 78, suffix: '%',
    hint: '近 30 天均值', color: '#a855f7', bg: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)',
  },
  {
    key: 'ai', icon: '🤖', label: 'AI 生成资源', value: 23, suffix: '份',
    hint: '讲义 / 习题 / 实验', color: '#06b6d4', bg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
  },
]

export default function LearningStats() {
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
        <span style={{ fontSize: 12, color: '#94a3b8' }}>近 30 天汇总</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {STATS.map((s) => (
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
