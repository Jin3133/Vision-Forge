import React, { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { useLearn } from '../../LearnContext.jsx'

const DIM_COLORS = {
  '知识掌握': '#3b82f6', '认知风格': '#22c55e', '易错点': '#ef4444',
  '学习节奏': '#eab308', '兴趣程度': '#a855f7', '代码能力': '#06b6d4',
}

/* 能力变化：近 7 天 6 维度提升量（数据来源：LearnContext.learnerPortrait） */
export default function AbilityDelta() {
  const learn = useLearn()
  const portrait = learn.learnerPortrait || { dimensions: {} }

  const delta = useMemo(() => {
    return Object.entries(portrait.dimensions || {}).map(([key, d]) => {
      const trend = d.trend || []
      const last = trend.length > 0 ? trend[trend.length - 1] : 0
      const prev = trend.length > 1 ? trend[trend.length - 2] : last
      return { dim: key, delta: last - prev, color: DIM_COLORS[key] || '#3b82f6' }
    })
  }, [portrait.dimensions])

  const totalDelta = delta.reduce((s, d) => s + d.delta, 0)
  const bestDelta = delta.length > 0 ? delta.reduce((best, d) => d.delta > best.delta ? d : best, delta[0]) : { dim: '--', delta: 0 }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
      border: '1px solid #f1f5f9', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>
          📈 能力变化
        </h3>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>最近变化 · 各维度净变化</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={delta} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="dim" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
          <Tooltip
            cursor={{ fill: 'rgba(59,130,246,0.06)' }}
            contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${v > 0 ? '+' : ''}${v} 分`, '变化']}
          />
          <Bar dataKey="delta" radius={[6, 6, 0, 0]} maxBarSize={36}>
            {delta.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#64748b' }}>
        <span>综合：<strong style={{ color: totalDelta >= 0 ? '#10b981' : '#ef4444' }}>{totalDelta >= 0 ? '+' : ''}{totalDelta} 分</strong></span>
        <span>亮点：<strong style={{ color: bestDelta.color }}>{bestDelta.dim} {bestDelta.delta >= 0 ? '+' : ''}{bestDelta.delta}</strong></span>
      </div>
    </div>
  )
}
