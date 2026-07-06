// src/pages/Profile.jsx
//
// 个人空间 —— 现代 AI SaaS 风格仪表盘
// 布局：
//   ┌─────────────────────────────────────────────────────────────┐
//   │  Hero（用户信息 + 头像 + 关键数据）                          │
//   ├─────────────────────────────────────────────────────────────┤
//   │  4 个 KPI 统计卡（学习统计）                                 │
//   ├──────────────────────┬──────────────────────────────────────┤
//   │  连续学习天数（火焰）│  学习趋势图（7/30/90d）               │
//   ├──────────────────────┴──────────────────────────────────────┤
//   │  学习日历（月历 + 12 周热力条）                              │
//   ├─────────────────────────────────────────────────────────────┤
//   │  学习成就（6 个细分徽章）                                    │
//   ├──────────────────────┬──────────────────────────────────────┤
//   │  最近活动（时间线）  │  系统设置                              │
//   └──────────────────────┴──────────────────────────────────────┘

import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLearn } from '../LearnContext.jsx'
import { UserContext } from '../App.jsx'

import StatsGrid, { MOCK_STATS } from '../components/profile/StatsGrid.jsx'
import StreakCard from '../components/profile/StreakCard.jsx'
import LearningTrendChart, { MOCK_TREND } from '../components/profile/LearningTrendChart.jsx'
import StudyCalendar from '../components/profile/StudyCalendar.jsx'
import AchievementsList, { MOCK_ACHIEVEMENTS } from '../components/profile/AchievementsList.jsx'
import RecentActivity, { MOCK_ACTIVITIES } from '../components/profile/RecentActivity.jsx'
import EditProfileModal from '../components/profile/EditProfileModal.jsx'
import FavoritesPanel from '../components/profile/FavoritesPanel.jsx'

// ==================== 工具 ====================
const defaultUser = {
  name: '学习者',
  studentId: '2024001001',
  college: '计算机学院',
  major: '人工智能',
  avatar: '👤',
  bio: '在 Vision-Forge 上持续学习 AI',
}

const AVATAR_OPTIONS = ['👤', '😀', '😎', '🤓', '🧑‍💻', '👨‍🎓', '🦁', '🚀']

// ==================== 主组件 ====================
export default function Profile() {
  const learn = useLearn()
  const { user: ctxUser, setUser: setCtxUser } = useContext(UserContext)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const goTab = (tab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'overview') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const [user, setUser] = useState(() => ({ ...defaultUser, ...ctxUser }))
  const [showEditModal, setShowEditModal] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  /* 打卡记录（沿用原有 localStorage 持久化） */
  const [studyRecords, setStudyRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('vf_calendar')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  useEffect(() => {
    localStorage.setItem('vf_calendar', JSON.stringify(studyRecords))
  }, [studyRecords])

  /* ───── 操作 ───── */
  const changeAvatar = (a) => {
    setUser((prev) => ({ ...prev, avatar: a }))
    setCtxUser((prev) => ({ ...prev, avatar: a }))
  }

  const handleSaveProfile = (next) => {
    setUser(next)
    setCtxUser((prev) => ({ ...prev, ...next }))
  }

  const shiftMonth = (delta) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1))
  }

  const toggleStudyDay = useCallback((day) => {
    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth()
    const key = `${y}-${m}-${day}`
    setStudyRecords((prev) => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = true
      return next
    })
  }, [currentMonth])

  const getMonthStudyCount = () => {
    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth()
    const dim = new Date(y, m + 1, 0).getDate()
    let count = 0
    for (let d = 1; d <= dim; d++) {
      if (studyRecords[`${y}-${m}-${d}`]) count++
    }
    return count
  }

  const getStreak = () => {
    let streak = 0
    const d = new Date()
    while (true) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (studyRecords[key]) { streak++; d.setDate(d.getDate() - 1) }
      else break
    }
    return streak
  }

  /* 衍生数据：最近 7 天布尔数组 + 历史最长 + 本周新增 */
  const streakDerived = useMemo(() => {
    const days = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      days.push(!!studyRecords[key])
    }
    /* 历史最长（简化：最近 90 天最长的连续段） */
    const allKeys = Object.keys(studyRecords).filter((k) => studyRecords[k])
    let longest = 0
    if (allKeys.length > 0) {
      const sorted = allKeys.map((k) => {
        const [y, m, d] = k.split('-').map(Number)
        return new Date(y, m, d).getTime()
      }).sort((a, b) => a - b)
      let cur = 1
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] === 86400000) cur++
        else { longest = Math.max(longest, cur); cur = 1 }
      }
      longest = Math.max(longest, cur)
    }
    /* 本周新增：本月（含本周）已学天数 */
    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth()
    let weeklyGain = 0
    for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
      if (studyRecords[`${y}-${m}-${d}`]) weeklyGain++
    }
    return { days, longest, weeklyGain }
  }, [studyRecords, currentMonth])

  /* 缓存清理（保留原有功能） */
  const clearCache = () => {
    if (window.confirm('确定要清理所有缓存数据吗？\n这将清除保存的模型、收藏、日历等数据。')) {
      Object.keys(localStorage).filter((k) => k.startsWith('vf_')).forEach((k) => localStorage.removeItem(k))
      setStudyRecords({})
      alert('🗑️ 缓存已清理')
      window.location.reload()
    }
  }

  // ==================== 渲染 ====================
  const cardStyle = {
    background: '#fff',
    borderRadius: 14,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
    border: '1px solid #f1f5f9',
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* ═══════════════════════════════════════════
          HERO 区域 — 用户信息 + 头像 + 关键数据
          ═══════════════════════════════════════════ */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #6366f1 50%, #8b5cf6 100%)',
        borderRadius: 18,
        padding: '28px 32px',
        marginBottom: 20,
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(99,102,241,0.25)',
      }}>
        {/* 装饰：径向光斑 */}
        <span style={{
          position: 'absolute', right: -60, top: -80,
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <span style={{
          position: 'absolute', left: -40, bottom: -100,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, position: 'relative' }}>
          {/* 头像 */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'linear-gradient(135deg, #fde68a, #f97316)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 46,
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              border: '4px solid rgba(255,255,255,0.95)',
              overflow: 'hidden',
            }}>
              {typeof user.avatar === 'string' && user.avatar.startsWith('data:') ? (
                <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : user.avatar || '👤'}
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              title="修改头像 / 资料"
              style={{
                position: 'absolute', right: -4, bottom: -4,
                width: 32, height: 32, borderRadius: '50%',
                background: '#fff', border: '2px solid #6366f1',
                color: '#6366f1', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >✏️</button>
          </div>

          {/* 用户名 + 基本信息 */}
          <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>
                {user.name}
              </h2>
              <span style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 999,
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                fontWeight: 600, backdropFilter: 'blur(8px)',
              }}>✦ Lv.5 学习者</span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.7 }}>
              {user.college} · {user.major} · 学号 {user.studentId}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, opacity: 0.92 }}>
              <span>🎯</span>
              <span>
                学习目标：<strong style={{ color: '#fde68a' }}>
                  {learn.goal === '自定义目标' ? (learn.customGoal || '自定义') : (learn.goal || '尚未选择')}
                </strong>
              </span>
            </div>
            {user.bio && (
              <div style={{
                marginTop: 10, fontSize: 12, opacity: 0.85,
                maxWidth: 540, lineHeight: 1.55,
                fontStyle: 'italic',
              }}>
                "{user.bio}"
              </div>
            )}
          </div>

          {/* 快捷操作 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setShowEditModal(true)}
              style={{
                padding: '9px 18px', borderRadius: 10,
                background: '#fff', color: '#6366f1',
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              ✏️ 编辑资料
            </button>
            <button
              onClick={() => navigate('/settings')}
              style={{
                padding: '9px 18px', borderRadius: 10,
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                backdropFilter: 'blur(8px)',
              }}
            >
              ⚙️ 账户设置
            </button>
          </div>
        </div>

        {/* Hero 底栏 — 头像列表（快速切换） */}
        <div style={{
          marginTop: 20, paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'relative',
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
            快速切换头像：
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {AVATAR_OPTIONS.map((a) => (
              <button
                key={a}
                onClick={() => changeAvatar(a)}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: user.avatar === a ? '#fff' : 'rgba(255,255,255,0.15)',
                  border: 'none', cursor: 'pointer', fontSize: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  transform: user.avatar === a ? 'scale(1.1)' : 'scale(1)',
                  boxShadow: user.avatar === a ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                }}
              >{a}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          Tab 切换：数据概览 / 我的收藏
          ═══════════════════════════════════════════ */}
      <div style={{
        display: 'inline-flex', padding: 4,
        background: '#f1f5f9', borderRadius: 12,
        marginBottom: 20, gap: 4,
      }}>
        {[
          { key: 'overview',  label: '数据概览', icon: '📊' },
          { key: 'favorites', label: '我的收藏', icon: '❤️' },
        ].map((t) => {
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => goTab(t.key)}
              style={{
                padding: '8px 18px', borderRadius: 9, border: 'none',
                fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                background: active ? '#fff' : 'transparent',
                color: active ? '#3b82f6' : '#64748b',
                boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                transition: 'all 0.18s',
              }}
            ><span>{t.icon}</span><span>{t.label}</span></button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════
          我的收藏 Tab —— 整页切换
          ═══════════════════════════════════════════ */}
      {activeTab === 'favorites' && (
        <div style={cardStyle}>
          <FavoritesPanel />
        </div>
      )}

      {/* ═══════════════════════════════════════════
          数据概览 Tab —— 原有仪表盘内容
          ═══════════════════════════════════════════ */}
      {activeTab === 'overview' && (
      <>
      {/* ═══════════════════════════════════════════
          学习统计 — 4 个 KPI 卡
          ═══════════════════════════════════════════ */}
      <div style={{ marginBottom: 20 }}>
        <StatsGrid items={MOCK_STATS} />
      </div>

      {/* ═══════════════════════════════════════════
          连续学习 + 学习趋势（左右两栏）
          ═══════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginBottom: 20 }}>
        <StreakCard
          streak={getStreak()}
          longestStreak={streakDerived.longest}
          weeklyGain={streakDerived.weeklyGain}
          last7Days={streakDerived.days}
        />
        <div style={cardStyle}>
          <LearningTrendChart
            data7d={MOCK_TREND.data7d}
            data30d={MOCK_TREND.data30d}
            data90d={MOCK_TREND.data90d}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          学习日历
          ═══════════════════════════════════════════ */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <StudyCalendar
          currentMonth={currentMonth}
          onShiftMonth={shiftMonth}
          studyRecords={studyRecords}
          onToggleDay={toggleStudyDay}
          getMonthStudyCount={getMonthStudyCount}
          getStreak={getStreak}
        />
      </div>

      {/* ═══════════════════════════════════════════
          学习成就
          ═══════════════════════════════════════════ */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>🏅</span>
            学习成就
          </h3>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            点击查看完整成就墙（占位）
          </span>
        </div>
        <AchievementsList items={MOCK_ACHIEVEMENTS} />
      </div>

      {/* ═══════════════════════════════════════════
          最近活动 + 系统设置（左右两栏）
          ═══════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* 最近活动 */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>🕐</span>
            最近活动
          </h3>
          <RecentActivity activities={MOCK_ACTIVITIES} />
        </div>

        {/* 系统设置 */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #64748b, #475569)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>⚙️</span>
            系统设置
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SettingsItem icon="🎯" title="重新选择学习目标" sub="修改后将重置主线任务"
              onClick={() => {
                if (window.confirm('确定要重新选择学习目标吗？\n主线任务和画像进度会重置。')) {
                  learn.resetOnboarding()
                  window.location.hash = '#/'
                  window.location.reload()
                }
              }} />
            <SettingsItem icon="🔒" title="修改密码" sub="账号安全设置"
              onClick={() => navigate('/settings?tab=password')} />
            <SettingsItem icon="📖" title="开源项目说明" sub="了解 Vision-Forge" />
            <SettingsItem icon="🔒" title="隐私说明" sub="数据仅存储于本地浏览器" />
            <SettingsItem icon="🗑️" title="清理缓存" sub="清除所有本地存储数据" danger onClick={clearCache} />
            <SettingsItem icon="📌" title="版本号" sub="Vision-Forge v1.0.0" />
          </div>
        </div>
      </div>
      </>
      )}

      {/* ── 编辑资料 Modal ── */}
      <EditProfileModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        user={user}
        onSave={handleSaveProfile}
      />
    </div>
  )
}

// ==================== 子组件：系统设置项 ====================
function SettingsItem({ icon, title, sub, danger, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 10,
        background: danger ? '#fef2f2' : (hover ? '#f8fafc' : '#fafbfc'),
        border: '1px solid',
        borderColor: danger ? '#fecaca' : (hover ? '#e2e8f0' : '#f1f5f9'),
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 10,
        background: danger ? '#fee2e2' : '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: danger ? '#dc2626' : '#1e293b',
        }}>{title}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
      </div>
      {onClick && (
        <span style={{ color: '#cbd5e1', fontSize: 16 }}>›</span>
      )}
    </div>
  )
}