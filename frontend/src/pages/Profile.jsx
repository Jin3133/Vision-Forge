// src/pages/Profile.jsx
// 个人空间 — 基于 LearnContext 的真实学习数据仪表盘
import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLearn } from '../LearnContext.jsx'
import { UserContext } from '../App.jsx'
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import EditProfileModal from '../components/profile/EditProfileModal.jsx'
import FavoritesPanel from '../components/profile/FavoritesPanel.jsx'

const AVATAR_OPTIONS = ['👤', '😀', '😎', '🤓', '🧑‍💻', '👨‍🎓', '🦁', '🚀']

const cardStyle = {
  background: '#fff', borderRadius: 12, padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  border: '1px solid #f1f5f9',
}

export default function Profile() {
  const learn = useLearn()
  const { user: ctxUser, setUser: setCtxUser } = useContext(UserContext)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const [showEditModal, setShowEditModal] = useState(false)

  const user = useMemo(() => ({
    name: ctxUser?.name || '学习者',
    username: ctxUser?.username || 'demo_user',
    role: ctxUser?.role || '学生',
    studentId: ctxUser?.studentId || '—',
    college: ctxUser?.college || learn.goal || 'Vision-Forge',
    major: ctxUser?.major || 'AI 学习',
    avatar: ctxUser?.avatar || '👤',
  }), [ctxUser, learn.goal])

  const goTab = (tab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'overview') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  /* ══════════════ 从 LearnContext 派生数据 + 演示兜底 ══════════════ */
  const portrait = learn.learnerPortrait || { dimensions: {}, overallScore: 0 }
  const hasRealPortrait = Object.keys(portrait.dimensions || {}).length > 0
  // 6 维数据：真实数据为空时用演示数据
  const dims = hasRealPortrait ? (portrait.dimensions || {}) : {
    '知识掌握': { value: 62, trend: [42, 46, 50, 54, 56, 59, 62] },
    '代码能力': { value: 58, trend: [30, 34, 40, 45, 50, 54, 58] },
    '认知风格': { value: 70, trend: [50, 53, 57, 60, 63, 66, 70] },
    '学习节奏': { value: 65, trend: [48, 50, 53, 56, 59, 62, 65] },
    '兴趣程度': { value: 80, trend: [58, 62, 66, 70, 73, 77, 80] },
    '易错点': { value: 48, trend: [28, 32, 36, 38, 41, 44, 48] },
  }
  const completedStages = (learn.mainStages || []).filter(s => s.done).length
  const totalStages = Math.max(1, (learn.mainStages || []).length)
  const knowledgeEntries = Object.entries(learn.knowledgeMap || {})
  const masteredCount = knowledgeEntries.filter(([, v]) => v >= 80).length
  const totalKnowledge = Math.max(1, knowledgeEntries.length)

  // KPI 数据
  const stats = useMemo(() => [
    { key: 'stage', label: '学习进度', value: `${completedStages}/${totalStages}`, unit: '阶段', icon: '🎯', color: '#3b82f6', bg: '#eff6ff' },
    { key: 'knowledge', label: '知识点掌握', value: masteredCount, unit: `/${totalKnowledge}`, icon: '🧠', color: '#10b981', bg: '#ecfdf5' },
    { key: 'score', label: '综合评分', value: portrait.overallScore || Math.round(Object.values(dims).reduce((s, d) => s + (d.value || 0), 0) / Math.max(1, Object.keys(dims).length)), unit: '分', icon: '📊', color: '#8b5cf6', bg: '#faf5ff' },
    { key: 'pace', label: '学习节奏', value: learn.learningPace || 4.5, unit: 'h/周', icon: '⏱️', color: '#f59e0b', bg: '#fffbeb' },
  ], [completedStages, totalStages, masteredCount, totalKnowledge, portrait.overallScore, dims, learn.learningPace])

  // 学习趋势：30 天数据（真实 + 填充）
  const trendData = useMemo(() => {
    const firstDim = Object.values(dims)[0]
    const trend = firstDim?.trend || []
    const base = trend.length >= 7 ? trend : [42, 46, 50, 52, 55, 58, 60, 63, 65, 67, 69, 70, 72, 73, 75, 76, 74, 77, 78, 76, 79, 80, 78, 81, 82, 80, 83, 84, 82, 85]
    return base.slice(-30).map((v, i) => ({ day: `D${i + 1}`, 评分: v }))
  }, [dims])

  // 签到日历：当月每天签到状态（localStorage 持久化）
  const [checkins, setCheckins] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vf_checkins') || '{}') } catch (_) { return {} }
  })
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 0).getDay()
  const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const monthLabel = `${year}年${month + 1}月`
  const streakDays = useMemo(() => {
    let count = 0; const d = new Date(today)
    while (checkins[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`]) { count++; d.setDate(d.getDate() - 1) }
    return count
  }, [checkins, todayStr])

  // 成就：从学习阶段和知识点推导
  const achievements = useMemo(() => {
    const list = []
    if (learn.onboarded) list.push({ icon: '🚀', name: '启程', desc: '完成首启引导', earned: true, color: '#3b82f6' })
    if (completedStages >= 1) list.push({ icon: '🏗️', name: '架构师', desc: '完成第 1 个学习阶段', earned: true, color: '#10b981' })
    if (completedStages >= 2) list.push({ icon: '📖', name: '研学者', desc: '完成 2 个学习阶段', earned: true, color: '#8b5cf6' })
    if (completedStages >= 3) list.push({ icon: '🧪', name: '实验家', desc: '完成 3 个学习阶段', earned: true, color: '#f59e0b' })
    if (completedStages >= 4) list.push({ icon: '🏆', name: '毕业', desc: '完成全部主线阶段', earned: true, color: '#ef4444' })
    if (masteredCount >= 5) list.push({ icon: '⭐', name: '博学者', desc: `掌握 ${masteredCount} 个知识点`, earned: true, color: '#ec4899' })
    // 未解锁
    if (completedStages < 4) list.push({ icon: '🔒', name: '毕业', desc: '完成全部主线阶段', earned: false })
    if (masteredCount < 5) list.push({ icon: '🔒', name: '博学者', desc: '掌握 5 个以上知识点', earned: false })
    return list
  }, [learn.onboarded, completedStages, masteredCount])

  // 最近活动
  const activities = useMemo(() => {
    const acts = []
    if (learn.goal) acts.push({ time: '今日', text: `学习目标：${learn.goal}`, icon: '🎯' })
    if (completedStages > 0) acts.push({ time: '进度', text: `完成了 ${completedStages}/${totalStages} 个阶段`, icon: '✅' })
    const topK = knowledgeEntries.sort((a, b) => b[1] - a[1]).slice(0, 2)
    topK.forEach(([name, val]) => acts.push({ time: '掌握', text: `${name}（${val}%）`, icon: val >= 80 ? '⭐' : '📖' }))
    if (learn.weakTopics?.length > 0) acts.push({ time: '待攻克', text: learn.weakTopics[0], icon: '⚠️' })
    return acts
  }, [learn.goal, completedStages, totalStages, knowledgeEntries, learn.weakTopics])

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Hero — 用户信息 */}
      <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, cursor: 'pointer' }} onClick={() => setShowEditModal(true)}>
            {user.avatar}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0 }}>{user.name}</h1>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {user.college} · {user.major} · {user.role}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>学号 {user.studentId} · 用户名 {user.username}</div>
        </div>
        <button onClick={() => setShowEditModal(true)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✏️ 编辑资料</button>
      </div>

      {/* Tab */}
      <div style={{ display: 'inline-flex', padding: 4, background: '#f1f5f9', borderRadius: 12, marginBottom: 20, gap: 4 }}>
        {[
          { key: 'overview', label: '数据概览', icon: '📊' },
          { key: 'favorites', label: '我的收藏', icon: '❤️' },
        ].map(t => (
          <button key={t.key} onClick={() => goTab(t.key)} style={{
            padding: '8px 18px', borderRadius: 9, border: 'none', fontSize: 13,
            fontWeight: activeTab === t.key ? 700 : 500, cursor: 'pointer',
            background: activeTab === t.key ? '#fff' : 'transparent',
            color: activeTab === t.key ? '#3b82f6' : '#64748b',
            boxShadow: activeTab === t.key ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* 我的收藏 */}
      {activeTab === 'favorites' && (
        <div style={cardStyle}><FavoritesPanel /></div>
      )}

      {/* 数据概览 */}
      {activeTab === 'overview' && (
        <>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {stats.map(s => (
              <div key={s.key} style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}<span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 2 }}>{s.unit}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* 6维雷达 + 趋势 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>🎯 六维能力雷达</h3>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={Object.entries(dims).map(([k, d]) => ({ subject: k, A: d.value || 0, fullMark: 100 }))}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                  <Radar dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>📈 学习趋势（30天）</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160, padding: '0 4px' }}>
                {trendData.map((d, i) => {
                  const h = Math.max(3, (d.评分 / 100) * 140)
                  const showLabel = i % 5 === 0 || i === trendData.length - 1
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      {showLabel && <span style={{ fontSize: 8, fontWeight: 600, color: '#3b82f6' }}>{d.评分}</span>}
                      <div title={`D${i+1}: ${d.评分}分`} style={{ width: '100%', maxWidth: 8, height: h, borderRadius: '3px 3px 0 0', background: 'linear-gradient(180deg,#3b82f6,#60a5fa)', transition: 'height 0.5s' }} />
                    </div>
                  )
                })}
              </div>
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#94a3b8' }}>综合评分 30 天变化</div>
            </div>
          </div>

          {/* 签到日历 + 连续学习 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, marginBottom: 20 }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>📅 {monthLabel} 学习签到</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <div key={d} style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, padding: '4px 0' }}>{d}</div>
                ))}
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1
                  const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  const checked = checkins[ds]
                  const isToday = ds === todayStr
                  return (
                    <div key={d} onClick={() => {
                      if (ds <= todayStr) {
                        const next = { ...checkins }
                        next[ds] = !checked
                        setCheckins(next)
                        localStorage.setItem('vf_checkins', JSON.stringify(next))
                      }
                    }} style={{
                      padding: '4px 0', borderRadius: 4, cursor: ds <= todayStr ? 'pointer' : 'default',
                      background: checked ? '#1e293b' : isToday ? '#e2e8f0' : '#fff',
                      color: checked ? '#fff' : isToday ? '#3b82f6' : '#94a3b8',
                      fontWeight: isToday ? 700 : 500, fontSize: 11,
                      border: isToday && !checked ? '2px solid #3b82f6' : '1px solid #f1f5f9',
                      opacity: ds > todayStr ? 0.3 : 1,
                    }}>{d}</div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
                <span>⬛ 已签到</span><span>⬜ 未签到</span><span>🔵 今天</span><span>点击格子切换签到</span>
              </div>
            </div>
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🔥</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#1e293b' }}>{streakDays}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>连续学习天数</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                本月签到 <b style={{ color: '#3b82f6' }}>{Object.keys(checkins).filter(k => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length}</b> 天
              </div>
            </div>
          </div>

          {/* 成就 */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>🏆 学习成就</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {achievements.map((a, i) => (
                <div key={i} style={{
                  padding: '12px 14px', borderRadius: 10, border: '1px solid #f1f5f9',
                  opacity: a.earned ? 1 : 0.4, textAlign: 'center',
                  background: a.earned ? (a.color + '10') : '#f8fafc',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{a.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: a.earned ? '#1e293b' : '#94a3b8' }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 最近活动 */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>📋 最近活动</h3>
            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 13 }}>完成首启引导后，这里会显示你的学习动态</div>
            ) : (
              activities.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < activities.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8', width: 48, flexShrink: 0 }}>{a.time}</span>
                  <span style={{ fontSize: 13, color: '#334155' }}>{a.text}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {showEditModal && <EditProfileModal open={showEditModal} user={user} onSave={(u) => { setCtxUser?.(u); setShowEditModal(false) }} onClose={() => setShowEditModal(false)} />}
    </div>
  )
}
