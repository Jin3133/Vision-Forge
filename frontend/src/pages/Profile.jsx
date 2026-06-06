import React, { useState, useEffect, useCallback } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

// ==================== 工具函数 ====================
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()

const isSameDay = (d1, d2) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate()

// 默认用户信息
const defaultUser = {
  name: '学习者',
  studentId: '2024001001',
  college: '计算机学院',
  major: '人工智能',
  avatar: '👤',
}

// ==================== 数据概览Mock数据 ====================
const DASHBOARD_STATS = [
  { label: '课程数', value: '9', icon: '📚', sub: '已完成' },
  { label: '综合成绩', value: '91', icon: '📊', sub: '优秀' },
  { label: '连续打卡', value: '5', icon: '🔥', sub: '天' },
  { label: '学习时长', value: '126h', icon: '⏱️', sub: '累计' },
]

const RADAR_DATA = [
  { subject: '知识掌握', A: 85, fullMark: 100 },
  { subject: '代码能力', A: 72, fullMark: 100 },
  { subject: '理论理解', A: 90, fullMark: 100 },
  { subject: '实践应用', A: 68, fullMark: 100 },
  { subject: '创新思维', A: 75, fullMark: 100 },
  { subject: '团队协作', A: 88, fullMark: 100 },
]

const TREND_DATA = [
  { day: '周一', score: 78 },
  { day: '周二', score: 82 },
  { day: '周三', score: 80 },
  { day: '周四', score: 85 },
  { day: '周五', score: 88 },
  { day: '周六', score: 91 },
  { day: '周日', score: 89 },
]

// 热力图数据 (7行 x 5列)
const HEATMAP_DATA = [
  [1, 3, 0, 4, 2],
  [2, 4, 3, 1, 0],
  [0, 2, 4, 3, 1],
  [3, 1, 2, 4, 3],
  [4, 3, 1, 0, 4],
  [2, 0, 3, 2, 1],
  [1, 4, 2, 3, 4],
]
const HEATMAP_LABELS_X = ['第1周', '第2周', '第3周', '第4周', '第5周']
const HEATMAP_LABELS_Y = ['一', '二', '三', '四', '五', '六', '日']

const RING_DATA = [
  { label: '出勤率', value: 96, color: '#3b82f6' },
  { label: '抬头率', value: 87, color: '#10b981' },
  { label: '点头率', value: 78, color: '#f59e0b' },
]

const PATH_STEPS = [
  { id: 1, title: 'Python基础', status: 'done', date: '已完成' },
  { id: 2, title: 'PyTorch入门', status: 'done', date: '已完成' },
  { id: 3, title: '模型理论', status: 'current', date: '进行中' },
  { id: 4, title: '代码实战', status: 'pending', date: '待开始' },
  { id: 5, title: '项目部署', status: 'pending', date: '待开始' },
]

const WEAK_POINTS = [
  { name: '反向传播算法', score: 45 },
  { name: '注意力机制数学推导', score: 52 },
  { name: '模型量化部署', score: 38 },
]

const TODAY_TASKS = [
  { text: '完成PyTorch第5章学习', done: true },
  { text: '阅读SAM论文第3节', done: true },
  { text: '编写注意力机制代码', done: false },
  { text: '整理学习笔记', done: false },
  { text: '完成课后练习题', done: false },
]

// ==================== 主组件 ====================
export default function Profile() {
  const [activeTab, setActiveTab] = useState('profile')
  const [showPath, setShowPath] = useState(false)
  const [user, setUser] = useState(defaultUser)
  const [avatar, setAvatar] = useState(defaultUser.avatar)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const [studyRecords, setStudyRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('vf_calendar')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  useEffect(() => {
    localStorage.setItem('vf_calendar', JSON.stringify(studyRecords))
  }, [studyRecords])

  const avatarList = ['👤', '😀', '😎', '🤓', '🧑‍💻', '👨‍🎓', '🦁', '🚀']

  const changeAvatar = (a) => {
    setAvatar(a)
    setUser(prev => ({ ...prev, avatar: a }))
  }

  const stats = [
    { label: '学习天数', value: '47', icon: '📅', color: '#3b82f6' },
    { label: '学习时长', value: '126h', icon: '⏱️', color: '#10b981' },
    { label: '完成课程', value: '9', icon: '📚', color: '#f59e0b' },
    { label: '获得证书', value: '3', icon: '🏆', color: '#8b5cf6' },
  ]

  const milestones = [
    { step: 1, title: '入门', achieved: true, date: '第1周' },
    { step: 2, title: '基础', achieved: true, date: '第3周' },
    { step: 3, title: '进阶', achieved: true, date: '第6周' },
    { step: 4, title: '精通', achieved: false, date: '进行中' },
    { step: 5, title: '专家', achieved: false, date: '未开始' },
  ]

  const achievements = [
    { name: '学习达人', icon: '🏆', desc: '累计学习100小时', achieved: true, date: '2024-01-15' },
    { name: '代码高手', icon: '💻', desc: '完成10个编程练习', achieved: true, date: '2024-01-20' },
    { name: '模型大师', icon: '🎨', desc: '搭建5个完整模型', achieved: true, date: '2024-02-10' },
    { name: '持之以恒', icon: '🔥', desc: '连续学习30天', achieved: false, progress: 73 },
  ]

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = new Date(year, month, 1).getDay()
  const today = new Date()

  const shiftMonth = (delta) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1))
  }

  const toggleStudyDay = useCallback((day) => {
    const key = `${year}-${month}-${day}`
    setStudyRecords(prev => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = true
      return next
    })
  }, [year, month])

  const getMonthStudyCount = () => {
    let count = 0
    for (let d = 1; d <= daysInMonth; d++) {
      if (studyRecords[`${year}-${month}-${d}`]) count++
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

  const clearCache = () => {
    if (window.confirm('确定要清理所有缓存数据吗？这将清除保存的模型、收藏、日历等数据。')) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('vf_'))
      keys.forEach(k => localStorage.removeItem(k))
      setStudyRecords({})
      alert('🗑️ 缓存已清理')
      window.location.reload()
    }
  }

  // ==================== 辅助组件 ====================
  const RingProgress = ({ value, color, label }) => {
    const r = 32
    const circumference = 2 * Math.PI * r
    const offset = circumference - (value / 100) * circumference
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
          <circle
            cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 40 40)"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
          <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="700" fill="#1e293b">{value}%</text>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</span>
      </div>
    )
  }

  const HeatmapCell = ({ level }) => {
    const colors = ['#e2e8f0', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8']
    return (
      <div style={{
        width: 28, height: 28, borderRadius: 5,
        background: colors[level] || colors[0],
        transition: 'all 0.2s',
      }} />
    )
  }

  // ==================== 样式常量 ====================
  const cardStyle = {
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  }

  const sectionTitle = {
    fontSize: 15,
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 16px 0',
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>个人中心</h2>
        <p style={{ fontSize: 13, color: '#64748b' }}>个人信息、学习成就、学习日历与数据概览</p>
      </div>

      {/* Tab切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e8ecf1', paddingBottom: 12 }}>
        <button onClick={() => setActiveTab('profile')} style={{
          padding: '8px 20px', borderRadius: 20, fontSize: 13, border: 'none', cursor: 'pointer',
          background: activeTab === 'profile' ? '#3b82f6' : '#f1f5f9',
          color: activeTab === 'profile' ? '#fff' : '#64748b',
          fontWeight: activeTab === 'profile' ? 600 : 500,
          transition: 'all .2s',
        }}>👤 我的档案</button>
        <button onClick={() => setActiveTab('overview')} style={{
          padding: '8px 20px', borderRadius: 20, fontSize: 13, border: 'none', cursor: 'pointer',
          background: activeTab === 'overview' ? '#3b82f6' : '#f1f5f9',
          color: activeTab === 'overview' ? '#fff' : '#64748b',
          fontWeight: activeTab === 'overview' ? 600 : 500,
          transition: 'all .2s',
        }}>📊 数据概览</button>
      </div>

      {/* ═══════════════════════════════════════════
          TAB 1: 我的档案 — 左右分栏布局
          左: 280px 用户信息面板
          右: 剩余空间 统计/里程碑/成就/日历
          ═══════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* ====== 左侧: 用户信息面板 ====== */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              {/* 头像 */}
              <div style={{
                width: 90, height: 90, borderRadius: '50%', margin: '0 auto 14px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 42, color: '#fff', boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
              }}>{avatar}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>{user.name}</h3>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 20px' }}>{user.studentId}</p>

              {/* 基本信息 */}
              <div style={{ textAlign: 'left', marginBottom: 20 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>基本信息</h4>
                <div style={{ fontSize: 13, lineHeight: 2.2, color: '#1e293b' }}>
                  <p style={{ margin: 0 }}><span style={{ color: '#94a3b8', display: 'inline-block', width: 48 }}>学院</span> {user.college}</p>
                  <p style={{ margin: 0 }}><span style={{ color: '#94a3b8', display: 'inline-block', width: 48 }}>专业</span> {user.major}</p>
                  <p style={{ margin: 0 }}><span style={{ color: '#94a3b8', display: 'inline-block', width: 48 }}>学号</span> {user.studentId}</p>
                  <p style={{ margin: 0 }}><span style={{ color: '#94a3b8', display: 'inline-block', width: 48 }}>注册</span> 2024-09-01</p>
                </div>
              </div>

              {/* 更换头像 */}
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>更换头像</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {avatarList.map((a, i) => (
                    <div key={i} onClick={() => changeAvatar(a)} style={{
                      width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
                      background: avatar === a ? '#3b82f6' : '#f1f5f9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, transition: 'all 0.2s',
                      boxShadow: avatar === a ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                      transform: avatar === a ? 'scale(1.08)' : 'scale(1)',
                    }}>{a}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ====== 右侧: 统计 + 里程碑 + 成就 + 日历 ====== */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 1. 学习统计 — 横向4列 */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              {stats.map((stat, i) => (
                <div key={i} style={{
                  ...cardStyle, flex: 1, textAlign: 'center', padding: '16px 10px',
                  minWidth: 0, // 防止flex子项溢出
                }}>
                  <span style={{ fontSize: 26, display: 'block', marginBottom: 6 }}>{stat.icon}</span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, whiteSpace: 'nowrap' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* 2. 学习里程碑 — 横向5步 */}
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <h3 style={sectionTitle}>🎯 学习里程碑</h3>
              <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', paddingTop: 4 }}>
                {/* 连接线 */}
                <div style={{
                  position: 'absolute', top: 22, left: '5%', right: '5%', height: 3,
                  background: '#e2e8f0', zIndex: 0, borderRadius: 2,
                }}>
                  <div style={{
                    width: `${(milestones.filter(m => m.achieved).length - 1) / (milestones.length - 1) * 100}%`,
                    height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: 2,
                    transition: 'width 0.5s',
                  }}></div>
                </div>
                {milestones.map((item, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: item.achieved ? '#10b981' : '#f1f5f9',
                      border: `3px solid ${item.achieved ? '#10b981' : '#e2e8f0'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: item.achieved ? '#fff' : '#94a3b8', fontSize: 14, fontWeight: 700,
                      transition: 'all 0.3s', boxShadow: item.achieved ? '0 2px 8px rgba(16,185,129,0.3)' : 'none',
                    }}>
                      {item.achieved ? '✓' : item.step}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: item.achieved ? '#1e293b' : '#94a3b8', marginTop: 8, whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: 10, color: item.achieved ? '#10b981' : '#cbd5e1', marginTop: 3, whiteSpace: 'nowrap' }}>{item.date}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 成就徽章 — 横向4列 */}
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <h3 style={sectionTitle}>🏅 成就徽章</h3>
              <div style={{ display: 'flex', gap: 12 }}>
                {achievements.map((ach, i) => (
                  <div key={i} style={{
                    flex: 1, minWidth: 0,
                    display: 'flex', gap: 10, padding: 12,
                    borderRadius: 10,
                    background: ach.achieved ? '#f0fdf4' : '#f8fafc',
                    border: `1px solid ${ach.achieved ? '#bbf7d0' : '#f1f5f9'}`,
                    opacity: ach.achieved ? 1 : 0.7,
                    transition: 'all 0.2s',
                  }}>
                    <span style={{ fontSize: 26, filter: ach.achieved ? 'none' : 'grayscale(100%)', opacity: ach.achieved ? 1 : 0.4, flexShrink: 0 }}>{ach.icon}</span>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ach.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ach.desc}</div>
                      {ach.achieved ? (
                        <div style={{ fontSize: 10, color: '#10b981', marginTop: 4, fontWeight: 600 }}>✓ {ach.date}</div>
                      ) : (
                        <div style={{ marginTop: 5 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                            <span style={{ color: '#94a3b8' }}>进度</span>
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{ach.progress}%</span>
                          </div>
                          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99 }}>
                            <div style={{ width: `${ach.progress}%`, height: '100%', background: '#f59e0b', borderRadius: 99, transition: 'width 0.3s' }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. 学习日历 */}
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ ...sectionTitle, margin: 0 }}>📅 学习日历</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => shiftMonth(-1)} style={{
                    padding: '4px 12px', fontSize: 14, borderRadius: 8, border: '1px solid #e2e8f0',
                    background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: 600,
                  }}>&#8249;</button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', minWidth: 80, textAlign: 'center' }}>
                    {year}年 {month + 1}月
                  </span>
                  <button onClick={() => shiftMonth(1)} style={{
                    padding: '4px 12px', fontSize: 14, borderRadius: 8, border: '1px solid #e2e8f0',
                    background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: 600,
                  }}>&#8250;</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', marginBottom: 4 }}>
                {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                  <div key={day} style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, padding: '4px' }}>{day}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
                {Array(firstDay).fill(null).map((_, i) => (
                  <div key={`empty-${i}`} style={{ padding: '6px 2px' }}></div>
                ))}
                {Array(daysInMonth).fill(null).map((_, i) => {
                  const day = i + 1
                  const key = `${year}-${month}-${day}`
                  const isStudied = studyRecords[key]
                  const isToday = isSameDay(new Date(year, month, day), today)
                  return (
                    <div key={day} onClick={() => toggleStudyDay(day)} style={{
                      padding: '6px 2px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: isToday ? 700 : 500,
                      background: isStudied ? '#3b82f6' : (isToday ? '#eff6ff' : 'transparent'),
                      color: isStudied ? '#fff' : (isToday ? '#3b82f6' : '#1e293b'),
                      border: isToday ? '2px solid #3b82f6' : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => { if (!isStudied) e.currentTarget.style.background = '#f1f5f9' }}
                      onMouseLeave={e => { if (!isStudied) e.currentTarget.style.background = isToday ? '#eff6ff' : 'transparent' }}
                      title={isStudied ? '点击取消打卡' : '点击打卡'}
                    >{day}</div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 14, fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, background: '#3b82f6', borderRadius: 4 }}></div>
                  <span style={{ color: '#64748b' }}>已学习</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, background: '#eff6ff', borderRadius: 4, border: '2px solid #3b82f6' }}></div>
                  <span style={{ color: '#64748b' }}>今天</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, background: '#f1f5f9', borderRadius: 4 }}></div>
                  <span style={{ color: '#64748b' }}>未学习</span>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: '10px', background: '#f8fafc', borderRadius: 10, textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  本月已学习 <strong style={{ color: '#3b82f6' }}>{getMonthStudyCount()}</strong> 天
                  {getStreak() > 0 && <>，连续打卡 <strong style={{ color: '#f59e0b' }}>{getStreak()}</strong> 天 🔥</>}
                </span>
              </div>
            </div>

            {/* 5. 系统设置 */}
            <div style={cardStyle}>
              <h3 style={sectionTitle}>⚙️ 系统设置</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 24 }}>📖</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>开源项目说明</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>了解 Vision-Forge 的开源信息</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 24 }}>🔒</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>隐私说明</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>数据仅存储于本地浏览器</div>
                  </div>
                </div>
                <div onClick={clearCache} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 10,
                  background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#fecaca' }}
                >
                  <span style={{ fontSize: 24 }}>🗑️</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>清理缓存</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>清除所有本地存储数据</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 24 }}>📌</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>版本号</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Vision-Forge v1.0.0</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TAB 2: 数据概览
          ═══════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div>
          {/* Row1: 4个蓝色渐变统计卡片 */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
            {DASHBOARD_STATS.map((s, i) => (
              <div key={i} style={{
                flex: 1,
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                borderRadius: 12, padding: '18px 16px',
                boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
                color: '#fff',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, opacity: 0.9 }}>{s.label}</span>
                  <span style={{ fontSize: 24 }}>{s.icon}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Row2: 雷达图 + 趋势面积图 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {/* 左：6维雷达图 */}
            <div style={{ ...cardStyle, flex: '1.15 1 0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>🎯 六维能力雷达</h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={RADAR_DATA}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="能力值" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 右：本周趋势面积图 */}
            <div style={{ ...cardStyle, flex: '0.85 1 0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>📈 本周学习趋势</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={TREND_DATA}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="score" stroke="#3b82f6" fillOpacity={1} fill="url(#colorScore)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row3: 热力图 + 环形进度 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {/* 左：GitHub风格热力图 */}
            <div style={{ ...cardStyle, flex: '1.15 1 0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>🔥 学习活跃度热力图</h3>
              <div style={{ display: 'flex', gap: 20 }}>
                {/* Y轴标签 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 24 }}>
                  {HEATMAP_LABELS_Y.map((d, i) => (
                    <div key={i} style={{ height: 28, display: 'flex', alignItems: 'center', fontSize: 11, color: '#94a3b8', width: 20 }}>{d}</div>
                  ))}
                </div>
                {/* 热力图网格 */}
                <div>
                  {/* X轴标签 */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    {HEATMAP_LABELS_X.map((w, i) => (
                      <div key={i} style={{ width: 28, textAlign: 'center', fontSize: 10, color: '#94a3b8' }}>{w}</div>
                    ))}
                  </div>
                  {/* 单元格 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {HEATMAP_DATA.map((row, ri) => (
                      <div key={ri} style={{ display: 'flex', gap: 6 }}>
                        {row.map((level, ci) => (
                          <HeatmapCell key={ci} level={level} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* 图例 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingLeft: 40 }}>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>少</span>
                {[0, 1, 2, 3, 4].map(l => (
                  <div key={l} style={{
                    width: 12, height: 12, borderRadius: 3,
                    background: ['#e2e8f0', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8'][l]
                  }} />
                ))}
                <span style={{ fontSize: 10, color: '#94a3b8' }}>多</span>
              </div>
            </div>

            {/* 右：3个SVG环形进度 */}
            <div style={{ ...cardStyle, flex: '0.85 1 0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>📊 课堂表现指标</h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0' }}>
                {RING_DATA.map((r, i) => (
                  <RingProgress key={i} value={r.value} color={r.color} label={r.label} />
                ))}
              </div>
            </div>
          </div>

          {/* Row4: 学习路径 — 可展开/收起折叠面板 */}
          <div style={{
            ...cardStyle,
            padding: showPath ? '16px 20px 20px' : '16px 20px',
            marginBottom: 20,
          }}>
            {/* 折叠面板头部 */}
            <div
              onClick={() => setShowPath(!showPath)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                  🛤️ 学习路径 {showPath ? '▲' : '▼'}
                </h3>
              </div>
              <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>
                当前：模型理论（进行中）
              </span>
            </div>

            {/* 折叠内容：5步时间线 */}
            {showPath && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
                  {/* 连接线 */}
                  <div style={{
                    position: 'absolute', top: 18, left: '5%', right: '5%', height: 3,
                    background: '#e2e8f0', zIndex: 0, borderRadius: 2,
                  }}>
                    <div style={{
                      width: `${(PATH_STEPS.filter(s => s.status === 'done').length) / (PATH_STEPS.length - 1) * 100}%`,
                      height: '100%', background: 'linear-gradient(90deg, #3b82f6, #10b981)', borderRadius: 2,
                    }} />
                  </div>
                  {PATH_STEPS.map((step, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: step.status === 'done' ? '#10b981' : step.status === 'current' ? '#3b82f6' : '#f1f5f9',
                        border: `3px solid ${step.status === 'done' ? '#10b981' : step.status === 'current' ? '#3b82f6' : '#e2e8f0'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: step.status === 'pending' ? '#94a3b8' : '#fff',
                        fontSize: 13, fontWeight: 700,
                        boxShadow: step.status === 'current' ? '0 2px 10px rgba(59,130,246,0.3)' : step.status === 'done' ? '0 2px 10px rgba(16,185,129,0.3)' : 'none',
                      }}>
                        {step.status === 'done' ? '✓' : step.id}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: step.status !== 'pending' ? '#1e293b' : '#94a3b8', marginTop: 8, textAlign: 'center' }}>{step.title}</div>
                      <div style={{ fontSize: 10, color: step.status === 'done' ? '#10b981' : step.status === 'current' ? '#3b82f6' : '#cbd5e1', marginTop: 3 }}>{step.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Row5: 薄弱知识点 + 今日任务 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {/* 左：薄弱知识点红色进度条 */}
            <div style={{ ...cardStyle, flex: '1.15 1 0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>⚠️ 薄弱知识点</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {WEAK_POINTS.map((wp, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{wp.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{wp.score}分</span>
                    </div>
                    <div style={{ height: 8, background: '#fee2e2', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${wp.score}%`, height: '100%',
                        background: 'linear-gradient(90deg, #ef4444, #f87171)',
                        borderRadius: 4,
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: '10px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
                💡 建议：针对以上薄弱点进行专项练习，推荐查看「注意力机制详解」讲义
              </div>
            </div>

            {/* 右：今日任务checklist */}
            <div style={{ ...cardStyle, flex: '0.85 1 0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>✅ 今日任务</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TODAY_TASKS.map((task, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    background: task.done ? '#f0fdf4' : '#f8fafc',
                    border: `1px solid ${task.done ? '#bbf7d0' : '#e2e8f0'}`,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: task.done ? '#10b981' : '#e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff', flexShrink: 0,
                    }}>{task.done ? '✓' : ''}</div>
                    <span style={{
                      fontSize: 13,
                      color: task.done ? '#15803d' : '#475569',
                      textDecoration: task.done ? 'line-through' : 'none',
                      fontWeight: 500,
                    }}>{task.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  已完成 <strong style={{ color: '#10b981' }}>{TODAY_TASKS.filter(t => t.done).length}</strong> / {TODAY_TASKS.length} 项
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}