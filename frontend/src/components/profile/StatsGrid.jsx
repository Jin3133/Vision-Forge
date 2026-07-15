// src/components/profile/StatsGrid.jsx
//
// 学习统计卡片 —— 4 个 KPI + 迷你趋势条
// 数据源预留：GET /api/profile/stats

import { useMemo } from 'react'

/**
 * @param {{
 *   items: Array<{
 *     key: string,
 *     label: string,
 *     value: string | number,
 *     unit?: string,
 *     icon: string,
 *     gradient: string,           // CSS 渐变
 *     trend?: number,             // 相比上周百分比，正=涨
 *     mini?: number[],            // 最近 7 天迷你折线数据
 *   }>
 * }} props
 */
export default function StatsGrid({ items = [] }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
    }}>
      {items.map((item) => (
        <StatCard key={item.key} item={item} />
      ))}
    </div>
  )
}

function StatCard({ item }) {
  const { label, value, unit, icon, gradient, trend, mini = [] } = item
  const trendPositive = (trend ?? 0) >= 0
  // 迷你 sparkline
  const sparkPath = useMemo(() => {
    if (mini.length < 2) return ''
    const max = Math.max(...mini)
    const min = Math.min(...mini)
    const range = max - min || 1
    const w = 80, h = 28
    const step = w / (mini.length - 1)
    return mini
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
      .join(' ')
  }, [mini])

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: gradient,
      borderRadius: 14, padding: '16px 18px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      color: '#fff',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'
      }}
    >
      {/* 装饰光斑 */}
      <span style={{
        position: 'absolute', right: -20, top: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(255,255,255,0.18)',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, opacity: 0.92, fontWeight: 500 }}>{label}</span>
        <span style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>{icon}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>{unit}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        {trend !== undefined && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 600,
            padding: '2px 7px', borderRadius: 999,
            background: 'rgba(255,255,255,0.22)',
          }}>
            <span>{trendPositive ? '↗' : '↘'}</span>
            <span>{trendPositive ? '+' : ''}{trend}%</span>
            <span style={{ opacity: 0.8, marginLeft: 2 }}>vs 上周</span>
          </span>
        )}
        {sparkPath && (
          <svg width="80" height="28" viewBox="0 0 80 28" style={{ flexShrink: 0 }}>
            <path d={sparkPath} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </div>
  )
}

/* 默认 Mock —— 4 个 KPI */
export const MOCK_STATS = [
  {
    key: 'days', label: '学习天数', value: '47', unit: '天',
    icon: '📅', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    trend: 12, mini: [1, 2, 1, 3, 2, 4, 3],
  },
  {
    key: 'hours', label: '学习时长', value: '126', unit: 'h',
    icon: '⏱️', gradient: 'linear-gradient(135deg, #10b981, #047857)',
    trend: 8, mini: [2, 3, 2, 4, 3, 5, 4],
  },
  {
    key: 'courses', label: '完成课程', value: '9', unit: '门',
    icon: '📚', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    trend: -3, mini: [1, 1, 2, 2, 1, 2, 3],
  },
  {
    key: 'certs', label: '获得证书', value: '3', unit: '枚',
    icon: '🏆', gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    trend: 33, mini: [0, 0, 1, 1, 1, 2, 3],
  },
]