import React from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'

/* 能力变化：近 7 天 6 维度提升量（Mock）
   风格：渐变蓝紫，柱状图直观展示 +/0/-  */
const DELTA = [
  { dim: '知识掌握', delta: +6, color: '#3b82f6' },
  { dim: '认知风格', delta: +3, color: '#22c55e' },
  { dim: '易错点',   delta: -2, color: '#ef4444' },
  { dim: '学习节奏', delta: +4, color: '#eab308' },
  { dim: '兴趣程度', delta: +5, color: '#a855f7' },
  { dim: '代码能力', delta: +7, color: '#06b6d4' },
]

export default function AbilityDelta() {
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
        <span style={{ fontSize: 12, color: '#94a3b8' }}>近 7 天 · 各维度净变化</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={DELTA} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="dim" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
          <Tooltip
            cursor={{ fill: 'rgba(59,130,246,0.06)' }}
            contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${v > 0 ? '+' : ''}${v} 分`, '变化']}
          />
          <Bar dataKey="delta" radius={[6, 6, 0, 0]} maxBarSize={36}>
            {DELTA.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#64748b' }}>
        <span>综合：<strong style={{ color: '#10b981' }}>+23 分</strong>（6 维加权和）</span>
        <span>亮点：<strong style={{ color: '#06b6d4' }}>代码能力 +7</strong></span>
      </div>
    </div>
  )
}
