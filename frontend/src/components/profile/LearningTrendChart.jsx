// src/components/profile/LearningTrendChart.jsx
//
// 学习趋势图 —— 7天/30天/90天 切换 + 学习时长 + 完成度 双线
// 数据源预留：GET /api/profile/trend?range=7d|30d|90d

import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

/**
 * @param {{
 *   data7d:  Array<{ date: string, duration: number, score: number }>,
 *   data30d: Array<{ date: string, duration: number, score: number }>,
 *   data90d: Array<{ date: string, duration: number, score: number }>,
 * }} props
 */
export default function LearningTrendChart({ data7d = [], data30d = [], data90d = [] }) {
  const [range, setRange] = useState('30d')
  const data = range === '7d' ? data7d : range === '90d' ? data90d : data30d

  const ranges = [
    { key: '7d',  label: '近 7 天' },
    { key: '30d', label: '近 30 天' },
    { key: '90d', label: '近 90 天' },
  ]

  const summary = useMemo(() => {
    if (data.length === 0) return { hours: 0, avgScore: 0 }
    const total = data.reduce((s, d) => s + (d.duration || 0), 0)
    const avg = data.reduce((s, d) => s + (d.score || 0), 0) / data.length
    return { hours: (total / 60).toFixed(1), avgScore: Math.round(avg) }
  }, [data])

  return (
    <div>
      {/* 顶部：范围切换 + 摘要 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff',
          }}>📈</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>学习趋势</span>
        </div>
        <div style={{
          display: 'inline-flex', padding: 3,
          background: '#f1f5f9', borderRadius: 10, gap: 2,
        }}>
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{
                padding: '5px 12px', borderRadius: 7, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: range === r.key ? '#fff' : 'transparent',
                color: range === r.key ? '#3b82f6' : '#64748b',
                boxShadow: range === r.key ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
              }}
            >{r.label}</button>
          ))}
        </div>
      </div>

      {/* 摘要数据 */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>累计学习</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#3b82f6' }}>{summary.hours}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>小时</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>平均得分</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#8b5cf6' }}>{summary.avgScore}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>/ 100</span>
          </div>
        </div>
      </div>

      {/* 图表 */}
      <ResponsiveContainer width="100%" height={260}>
        {range === '7d' ? (
          // 7 天用面积图，更直观
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradDuration" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" minTickGap={28} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" />
            <Area type="monotone" dataKey="duration" name="时长(分钟)"
              stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradDuration)" />
            <Area type="monotone" dataKey="score" name="得分"
              stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gradScore)" />
          </AreaChart>
        ) : (
          // 30/90 天用折线图，避免太密
          <LineChart data={data} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" minTickGap={28} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" />
            <Line type="monotone" dataKey="duration" name="时长(分钟)"
              stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="score" name="得分"
              stroke="#8b5cf6" strokeWidth={2} dot={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

/* 默认 Mock —— 7 / 30 / 90 天三套数据 */
function buildMockData(days) {
  const result = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    /* 制造一点波动 + 趋势 */
    const base = 60 + Math.sin(i / 4) * 25 + Math.random() * 15
    const score = Math.max(40, Math.min(100, Math.round(78 + Math.sin(i / 6) * 10 + (Math.random() - 0.5) * 6)))
    result.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      duration: Math.max(10, Math.round(base)),
      score,
    })
  }
  return result
}

export const MOCK_TREND = {
  data7d: buildMockData(7),
  data30d: buildMockData(30),
  data90d: buildMockData(90),
}