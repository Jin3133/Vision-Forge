// src/components/profile/StudyCalendar.jsx
//
// 学习日历 —— 月历打卡 + 12 周热力条 + 月度统计
// 数据源预留：GET /api/profile/calendar?year&month

import { useMemo, useState } from 'react'

const DAY_HEAD = ['日', '一', '二', '三', '四', '五', '六']

/**
 * @param {{
 *   currentMonth: Date,                  // 当前查看的月份
 *   onShiftMonth: (delta: number) => void,
 *   studyRecords: Record<string, boolean>,  // key = "y-m-d" → true=已学
 *   onToggleDay: (day: number) => void,
 *   getMonthStudyCount: () => number,
 *   getStreak: () => number,
 * }} props
 */
export default function StudyCalendar({
  currentMonth, onShiftMonth, studyRecords, onToggleDay,
  getMonthStudyCount, getStreak,
}) {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* ── 左：月历（占大头，约 1.1 份） */}
      <div style={{ flex: '1.1 1 0', minWidth: 0 }}>
        {/* 顶部：月切换 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: '#fff',
            }}>📅</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              {year} 年 {month + 1} 月
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <NavBtn onClick={() => onShiftMonth(-1)}>‹</NavBtn>
            <button
              onClick={() => onShiftMonth(0 - month + (new Date().getMonth() - month))}
              style={todayBtnStyle}
            >今天</button>
            <NavBtn onClick={() => onShiftMonth(1)}>›</NavBtn>
          </div>
        </div>

        {/* 星期头 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
          {DAY_HEAD.map((d, i) => (
            <div key={d} style={{
              textAlign: 'center', fontSize: 11, fontWeight: 600,
              color: (i === 0 || i === 6) ? '#ef4444' : '#94a3b8',
              padding: '4px 0',
            }}>{d}</div>
          ))}
        </div>

        {/* 日期格子 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const key = `${year}-${month}-${day}`
            const studied = !!studyRecords[key]
            const isToday = isCurrentMonth && today.getDate() === day
            return (
              <CalendarCell
                key={key}
                day={day}
                studied={studied}
                isToday={isToday}
                onClick={() => onToggleDay(day)}
              />
            )
          })}
        </div>

        {/* 月度统计 */}
        <div style={{
          marginTop: 14, padding: 12,
          background: 'linear-gradient(90deg, #eff6ff, #f5f3ff)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          fontSize: 12, color: '#475569',
        }}>
          <span>
            本月已学 <strong style={{ color: '#3b82f6', fontSize: 14 }}>{getMonthStudyCount()}</strong> 天
          </span>
          <span style={{ width: 1, height: 14, background: '#cbd5e1' }} />
          <span>
            连续打卡 <strong style={{ color: '#f59e0b', fontSize: 14 }}>{getStreak()}</strong> 天 🔥
          </span>
        </div>
      </div>

      {/* ── 右：12 周热力条（约 1 份）+ 图例，整体垂直居中对齐月历 */}
      <div style={{
        flex: '1 1 0', minWidth: 0, alignSelf: 'stretch',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '8px 4px 8px 0',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#1e293b',
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
        }}>
          <span>🔥</span> 最近 12 周活跃度
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <WeeklyHeatmap studyRecords={studyRecords} />
          </div>
          {/* 图例：垂直堆在右侧，跟热力图主体在视觉上「左图右注」 */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
            fontSize: 10, color: '#64748b', padding: '4px 0',
          }}>
            {[
              { color: '#e2e8f0', label: '未学' },
              { color: '#93c5fd', label: '少' },
              { color: '#3b82f6', label: '中' },
              { color: '#1d4ed8', label: '多' },
            ].map((l) => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2, flexShrink: 0 }} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── 子组件 ───────── */

function CalendarCell({ day, studied, isToday, onClick }) {
  const [hover, setHover] = useStateLite(false)
  let bg = studied ? '#3b82f6' : (isToday ? '#eff6ff' : 'transparent')
  let color = studied ? '#fff' : (isToday ? '#3b82f6' : '#1e293b')
  /* 用 box-shadow 模拟外圈，避免 hover 切边框时格子尺寸抖 1px */
  let outline = isToday ? '0 0 0 2px #3b82f6' : 'none'
  if (hover && !studied && !isToday) { bg = '#f8fafc'; outline = '0 0 0 1px #cbd5e1' }
  if (hover && studied) { bg = '#2563eb' }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, cursor: 'pointer',
        fontSize: 12, fontWeight: isToday ? 700 : 500,
        background: bg, color,
        boxShadow: outline,
        transition: 'all 0.15s',
      }}
      title={studied ? '点击取消打卡' : '点击打卡'}
    >
      {day}
      {studied && (
        <span style={{
          position: 'absolute', bottom: 3, fontSize: 7,
          opacity: 0.85,
        }}>●</span>
      )}
    </div>
  )
}

function WeeklyHeatmap({ studyRecords }) {
  const weeks = useMemo(() => {
    /* 取今天，往前推 12 周 = 84 天 */
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cells = []
    for (let i = 84 - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      cells.push({ date: d, studied: !!studyRecords[key] })
    }
    /* 按列分组：每列 7 天 */
    const cols = []
    for (let i = 0; i < cells.length; i += 7) {
      cols.push(cells.slice(i, i + 7))
    }
    return cols
  }, [studyRecords])

  return (
    /* 用 grid + 1fr 让热力图横向铺满父容器（与月历同宽），不再缩在角落 */
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
      gap: 3, alignItems: 'start',
    }}>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {week.map((cell, di) => {
            const color = cell.studied ? '#1d4ed8' : '#f1f5f9'
            return (
              <div
                key={di}
                title={cell.studied ? '已学' : '未学'}
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: 3,
                  background: color,
                  transition: 'all 0.15s',
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

function NavBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: 8,
        background: '#f1f5f9', border: '1px solid #e2e8f0',
        color: '#475569', cursor: 'pointer',
        fontSize: 14, fontWeight: 600,
      }}
    >{children}</button>
  )
}

const todayBtnStyle = {
  padding: '0 12px', height: 28, borderRadius: 8,
  background: '#eff6ff', border: '1px solid #bfdbfe',
  color: '#3b82f6', cursor: 'pointer',
  fontSize: 12, fontWeight: 600,
}

function useStateLite(v) { return useState(v) }