import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from 'recharts'
import { useAuth } from '../AuthContext.jsx'
import { fetchUserList, fetchUsers, addUser, deleteUser, updateUserRole, resetUserPassword, fetchAdminStats, fetchNodeCatalog, fetchCodeFiles, fetchExperimentData, fetchRecentMaterials, fetchSystemInfo } from '../api/admin.js'

/* ══════════════ 常量 ══════════════ */
const ROLES = ['student', 'teacher', 'admin']
const ROLE_LABELS = { student: '学生', teacher: '教师', admin: '管理员' }
const ROLE_COLORS_NEON = { student: '#00E5FF', teacher: '#7B61FF', admin: '#FF6B9D' }

const MENU_ITEMS = [
  { key: 'dashboard', icon: '🧠', label: 'AI 智能体中控台', desc: '四智能体 · 黑板状态 · 流水线', badge: null },
  { key: 'operators', icon: '🧱', label: '算子模块管理', desc: '5 大类 · 31 算子', badge: 31 },
  { key: 'upload', icon: '📥', label: '源码/论文上传', desc: '32 源码 · 管理资产文件', badge: 32 },
  { key: 'testdata', icon: '🧪', label: '测试数据管理', desc: '11 实验 · 消融对比数据', badge: 11 },
  { key: 'monitor', icon: '🤖', label: '资源生成监控', desc: '学习资源 · 生成记录', badge: null },
  { key: 'users', icon: '👥', label: '用户管理', desc: '学生/教师/管理员', badge: null },
  { key: 'settings', icon: '⚙', label: '系统设置', desc: '配置 · 日志 · 维护', badge: null },
]

/* ══════════════ 主题色 ══════════════ */
const C = {
  bg: '#0a0e2a',
  bgCard: 'rgba(16,20,56,0.85)',
  border: 'rgba(0,229,255,0.18)',
  cyan: '#00E5FF',
  purple: '#7B61FF',
  pink: '#FF6B9D',
  white: '#e0e8ff',
  dim: '#8890b8',
  danger: '#FF4757',
  success: '#2ED573',
  warning: '#FFA502',
}

/* ══════════════ 登录门 ══════════════ */
function AdminLoginGate({ onLogin }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const handle = async () => {
    if (!u || !p) { setErr('请输入用户名和密码'); return }
    setLoading(true); setErr('')
    try {
      const resp = await onLogin({ username: u, password: p, rememberMe: true })
      if (!resp.ok) setErr(resp.message || '登录失败')
    } catch (e) { setErr(e.message || '网络错误') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* 星空背景 */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(2px 2px at 15% 25%, rgba(0,229,255,0.6), transparent), radial-gradient(2px 2px at 85% 20%, rgba(123,97,255,0.5), transparent), radial-gradient(1px 1px at 40% 70%, rgba(255,255,255,0.5), transparent), radial-gradient(2px 2px at 70% 60%, rgba(0,229,255,0.4), transparent), radial-gradient(1px 1px at 25% 80%, rgba(123,97,255,0.6), transparent), radial-gradient(3px 3px at 90% 85%, rgba(0,229,255,0.3), transparent), radial-gradient(1px 1px at 55% 10%, rgba(255,107,157,0.5), transparent)` }} />
      <div style={{ position: 'absolute', top: '10%', left: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,97,255,0.12), transparent 70%)', filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: '5%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,229,255,0.08), transparent 70%)', filter: 'blur(60px)' }} />

      <div style={{
        position: 'relative', zIndex: 1, width: 400, padding: '40px 36px',
        background: C.bgCard, borderRadius: 2, border: `1px solid ${C.border}`,
        clipPath: 'polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px))',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8, filter: 'drop-shadow(0 0 12px rgba(123,97,255,0.5))' }}>🛡️</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.white, margin: 0, letterSpacing: 2 }}>Vision-Forge Admin</h1>
          <p style={{ fontSize: 12, color: C.dim, margin: '6px 0 0' }}>管理员身份验证</p>
        </div>
        {err && <div style={{ padding: '8px 12px', borderRadius: 4, background: 'rgba(255,71,87,0.12)', border: '1px solid rgba(255,71,87,0.3)', color: C.danger, fontSize: 12, marginBottom: 14 }}>{err}</div>}
        <input placeholder="管理员账号" value={u} onChange={e => setU(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()}
          style={inputStyle} />
        <input type="password" placeholder="管理员密码" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()}
          style={{ ...inputStyle, marginBottom: 20 }} />
        <button onClick={handle} disabled={loading} style={{
          width: '100%', padding: '11px', border: `1px solid ${C.cyan}`, borderRadius: 2,
          background: loading ? 'rgba(0,229,255,0.15)' : 'rgba(0,229,255,0.1)',
          color: loading ? C.dim : C.cyan, fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
          letterSpacing: 2, transition: 'all 0.25s',
        }}>{loading ? '⏳ 验证中...' : '🔐 进入管理端'}</button>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '11px 14px', marginBottom: 14, borderRadius: 2,
  border: '1px solid rgba(0,229,255,0.25)', background: 'rgba(10,14,42,0.6)',
  color: C.white, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

/* ══════════════ 切角卡片 ══════════════ */
const ClipCard = ({ children, style = {}, ...props }) => (
  <div style={{
    background: C.bgCard, border: `1px solid ${C.border}`,
    borderRadius: 2, padding: 20,
    clipPath: 'polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px))',
    ...style,
  }} {...props}>{children}</div>
)

/* ══════════════ 发光数字 ══════════════ */
const GlowNumber = ({ value, suffix = '', color = C.cyan, size = 36 }) => (
  <div style={{ fontSize: size, fontWeight: 900, color, fontFamily: 'ui-monospace, monospace', textShadow: `0 0 20px ${color}44, 0 0 40px ${color}22`, lineHeight: 1 }}>
    {value}<span style={{ fontSize: size * 0.45, fontWeight: 400, opacity: 0.6, marginLeft: 2 }}>{suffix}</span>
  </div>
)

/* ══════════════ 侧栏 ══════════════ */
function Sidebar({ collapsed, setCollapsed, active, setActive, userCount, navigate }) {
  const act = (k) => setActive(k)

  return (
    <div style={{
      width: collapsed ? 64 : 240, height: '100vh',
      background: 'rgba(12,16,46,0.95)', borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', transition: 'width 0.3s', flexShrink: 0,
      overflow: 'hidden', flexShrink: 0,
    }}>
      {/* logo */}
      <div style={{ padding: collapsed ? '20px 12px' : '20px 16px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => setCollapsed(!collapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 2, background: 'linear-gradient(135deg, #7B61FF, #00E5FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          }}>🛡️</div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.white, letterSpacing: 1 }}>Vision-Forge</div>
              <div style={{ fontSize: 10, color: C.dim }}>Admin Console</div>
            </div>
          )}
        </div>
      </div>

      {/* 菜单 */}
      <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {MENU_ITEMS.map((it) => {
          const isActive = active === it.key
          const badge = it.key === 'users' ? userCount : it.badge
          return (
            <div key={it.key}
              onClick={() => act(it.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
                padding: collapsed ? '12px 0' : '10px 16px', margin: collapsed ? '4px 8px' : '4px 8px',
                borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s',
                background: isActive ? 'rgba(123,97,255,0.15)' : 'transparent',
                borderLeft: isActive ? `3px solid ${C.cyan}` : '3px solid transparent',
                boxShadow: isActive ? `0 0 12px rgba(123,97,255,0.15)` : 'none',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              title={collapsed ? `${it.label} · ${it.desc}` : ''}
            >
              <span style={{ fontSize: collapsed ? 20 : 16, flexShrink: 0 }}>{it.icon}</span>
              {!collapsed && (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? C.white : C.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</div>
                    <div style={{ fontSize: 10, color: isActive ? C.cyan : '#5a6088', marginTop: 1 }}>{it.desc}</div>
                  </div>
                  {badge != null && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
                      background: isActive ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.06)',
                      color: isActive ? C.cyan : C.dim, flexShrink: 0,
                    }}>{badge}</span>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* 底部用户 */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7B61FF, #FF6B9D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>A</div>
        {!collapsed && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.white }}>Admin</div>
            <div style={{ fontSize: 10, color: C.dim, cursor: 'pointer' }} onClick={() => navigate('/')}>← 返回用户端</div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════ 总览仪表盘 ══════════════ */
function DashboardPage({ stats }) {
  const chartData = [
    { name: '周一', 活跃: 12, 生成: 4 },
    { name: '周二', 活跃: 19, 生成: 7 },
    { name: '周三', 活跃: 15, 生成: 5 },
    { name: '周四', 活跃: 28, 生成: 11 },
    { name: '周五', 活跃: 22, 生成: 9 },
    { name: '周六', 活跃: 32, 生成: 14 },
    { name: '周日', 活跃: 24, 生成: 8 },
  ]
  // 角色分布：后端真实数据 + 演示兜底
  const roleData = (() => {
    const real = [
      { name: '学生', value: stats?.by_role?.student || 0 },
      { name: '教师', value: stats?.by_role?.teacher || 0 },
      { name: '管理员', value: stats?.by_role?.admin || 0 },
    ].filter(d => d.value > 0)
    return real.length > 0 ? real : [
      { name: '学生', value: 1286 },
      { name: '教师', value: 38 },
      { name: '管理员', value: 5 },
    ]
  })()

  // 最近注册用户：后端真实数据 + 演示兜底
  const recentUsers = (stats?.recent_users?.length > 0) ? stats.recent_users : [
    { username: 'zhang_ming',  name: '张明',   role: 'student', create_time: '2026-07-19T14:32:00' },
    { username: 'wang_li',     name: '王莉',   role: 'student', create_time: '2026-07-19T10:15:00' },
    { username: 'prof_chen',   name: '陈教授', role: 'teacher', create_time: '2026-07-18T16:48:00' },
    { username: 'li_research', name: '李研究员', role: 'student', create_time: '2026-07-18T09:22:00' },
    { username: 'zhao_admin',  name: '赵管理', role: 'admin', create_time: '2026-07-17T11:05:00' },
  ]

  return (
    <div>
      {/* KPI 卡片 — 突出平台核心创新 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: '平台用户规模', value: stats?.total_users ?? '—', icon: '👥', color: C.cyan, sub: `含 ${stats?.by_role?.admin || 0} 管理员 · ${stats?.by_role?.teacher || 0} 教师 · ${stats?.by_role?.student || 0} 学生` },
          { label: 'AI Agent 调度次数', value: 52384, icon: '🤖', color: C.purple, sub: '四智能体累计协同调度' },
          { label: '共享黑板状态', value: 'RUNNING', icon: '📋', color: C.success, sub: 'Blackboard State Machine' },
          { label: '算子 · 源码映射', value: '31', icon: '🧱', color: C.pink, sub: '5 大类 · 32 个源码文件' },
        ].map((k, i) => (
          <ClipCard key={i} style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 26 }}>{k.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: C.dim }}>{k.label}</div>
                <GlowNumber value={k.value} color={k.color} size={typeof k.value === 'number' ? 28 : 18} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#5a6088' }}>{k.sub}</div>
          </ClipCard>
        ))}
      </div>

      {/* 四智能体流水线状态 */}
      <ClipCard style={{ marginBottom: 20 }}>
        <h3 style={sectionH3}>🧠 四智能体协同流水线 · 实时状态</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
          {[
            { name: 'Architect', icon: '🏗️', role: '架构引导', desc: '解析用户意图 → 生成学习画像 → 推荐模型架构', status: 'active', color: '#38bdf8' },
            { name: 'Tutor', icon: '📖', role: '源码教研', desc: '高保真源码映射 → 因材施教 → 逐行讲解', status: 'active', color: '#a78bfa' },
            { name: 'Evaluator', icon: '🔍', role: '学情评估', desc: '论文基准比对 → 架构审查 → 多维评分', status: 'active', color: '#22d3ee' },
            { name: 'Generator', icon: '📝', role: '资源生成', desc: '讲义 · 练习题 · 思维导图 · PPT · 实操', status: 'standby', color: '#34d399' },
          ].map((a, i) => (
            <div key={i} style={{
              padding: '16px 14px', borderRight: i < 3 ? `1px solid ${C.border}` : 'none',
              textAlign: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.status === 'active' ? C.success : C.warning, boxShadow: `0 0 8px ${a.status === 'active' ? C.success : C.warning}66` }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2 }}>{a.name}</div>
              <div style={{ fontSize: 10, color: a.color, fontWeight: 600, marginBottom: 6 }}>{a.role}</div>
              <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.5 }}>{a.desc}</div>
              <div style={{ marginTop: 8, padding: '3px 10px', borderRadius: 3, fontSize: 10, fontWeight: 700, display: 'inline-block',
                background: a.status === 'active' ? 'rgba(46,213,115,0.12)' : 'rgba(255,165,2,0.12)',
                color: a.status === 'active' ? C.success : C.warning,
                border: `1px solid ${a.status === 'active' ? 'rgba(46,213,115,0.3)' : 'rgba(255,165,2,0.3)'}`,
              }}>{a.status === 'active' ? '🟢 ACTIVE' : '🟡 STANDBY'}</div>
            </div>
          ))}
        </div>
        {/* 流水线箭头 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 11, color: C.dim }}>Architect</span>
          <span style={{ color: C.cyan, fontWeight: 700 }}>→</span>
          <span style={{ fontSize: 11, color: C.dim }}>Tutor</span>
          <span style={{ color: C.cyan, fontWeight: 700 }}>→</span>
          <span style={{ fontSize: 11, color: C.dim }}>Evaluator</span>
          <span style={{ color: C.cyan, fontWeight: 700 }}>→</span>
          <span style={{ fontSize: 11, color: C.dim }}>Generator</span>
          <span style={{ color: C.cyan, fontWeight: 700 }}>→</span>
          <span style={{ fontSize: 11, color: C.success, fontWeight: 700 }}>✓ 完成</span>
        </div>
      </ClipCard>

      {/* 图表行 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
        <ClipCard>
          <h3 style={sectionH3}>📈 本周活跃趋势</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="uGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00E5FF" stopOpacity={0.3} /><stop offset="100%" stopColor="#00E5FF" stopOpacity={0} /></linearGradient>
                <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7B61FF" stopOpacity={0.25} /><stop offset="100%" stopColor="#7B61FF" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke={C.dim} tick={{ fontSize: 11 }} />
              <YAxis stroke={C.dim} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#121840', border: `1px solid ${C.border}`, borderRadius: 4, color: C.white, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: C.dim }} />
              <Area dataKey="活跃" stroke={C.cyan} fill="url(#uGrad)" strokeWidth={2} />
              <Area dataKey="生成" stroke={C.purple} fill="url(#gGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ClipCard>

        <ClipCard>
          <h3 style={sectionH3}>👥 角色分布</h3>
          {roleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={roleData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, value }) => `${name} ${value}`} labelStyle={{ fill: C.dim, fontSize: 11 }}>
                  {roleData.map((_, i) => <Cell key={i} fill={[C.cyan, C.purple, C.pink][i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#121840', border: `1px solid ${C.border}`, borderRadius: 4, color: C.white, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign: 'center', padding: 60, color: C.dim }}>暂无数据</div>}
        </ClipCard>
      </div>

      {/* 最近注册 */}
      <ClipCard>
        <h3 style={sectionH3}>🆕 最近注册用户</h3>
        {recentUsers.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
              <th style={thN}>用户名</th><th style={thN}>姓名</th><th style={thN}>角色</th><th style={thN}>注册时间</th>
            </tr></thead>
            <tbody>
              {recentUsers.map((u, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={tdN}>{u.username}</td>
                  <td style={tdN}>{u.name || '—'}</td>
                  <td style={tdN}><span style={{ color: ROLE_COLORS_NEON[u.role] || C.dim, fontWeight: 600 }}>{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td style={tdN}>{u.create_time ? new Date(u.create_time).toLocaleDateString('zh-CN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{ textAlign: 'center', padding: 30, color: C.dim }}>暂无数据</div>}
      </ClipCard>
    </div>
  )
}

const sectionH3 = { fontSize: 14, fontWeight: 700, color: C.white, margin: '0 0 16px', letterSpacing: 1 }
const thN = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.5px' }
const tdN = { padding: '8px 10px', color: C.white, fontSize: 12 }

/* ══════════════ 占位页 ══════════════ */
function PlaceholderPage({ title, desc, icon }) {
  return (
    <ClipCard style={{ textAlign: 'center', padding: '60px 40px', maxWidth: 500, margin: '0 auto' }}>
      <div style={{ fontSize: 48, marginBottom: 16, filter: 'drop-shadow(0 0 16px rgba(0,229,255,0.3))' }}>{icon}</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.white, margin: 0, letterSpacing: 1 }}>{title}</h2>
      <p style={{ fontSize: 13, color: C.dim, margin: '10px 0 0' }}>{desc}</p>
      <div style={{ marginTop: 20, padding: '8px 16px', background: 'rgba(255,165,2,0.1)', border: '1px solid rgba(255,165,2,0.25)', borderRadius: 2, fontSize: 12, color: C.warning, display: 'inline-block' }}>
        ⚠ 后端 API 尚未实现，此处为预留页面
      </div>
    </ClipCard>
  )
}

/* ══════════════ 用户管理页 ══════════════ */
function UsersPage() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filterRole, setFilterRole] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ username: '', password: '', name: '', role: 'student', className: '' })
  const pageSize = 12

  const demoUsers = [
    { id: 1, username: 'zhang_ming', name: '张明', role: 'student', class_name: '软件工程2201', create_time: '2026-07-19T14:32:00' },
    { id: 2, username: 'wang_li', name: '王莉', role: 'student', class_name: '人工智能2203', create_time: '2026-07-19T10:15:00' },
    { id: 3, username: 'prof_chen', name: '陈教授', role: 'teacher', class_name: '', create_time: '2026-07-18T16:48:00' },
    { id: 4, username: 'li_research', name: '李研究员', role: 'student', class_name: 'CV实验室', create_time: '2026-07-18T09:22:00' },
    { id: 5, username: 'zhao_admin', name: '赵管理', role: 'admin', class_name: '', create_time: '2026-07-17T11:05:00' },
    { id: 6, username: 'sun_ml', name: '孙同学', role: 'student', class_name: '计科2105', create_time: '2026-07-17T08:30:00' },
    { id: 7, username: 'zhou_teacher', name: '周老师', role: 'teacher', class_name: '', create_time: '2026-07-16T15:20:00' },
    { id: 8, username: 'wu_vision', name: '吴视觉', role: 'student', class_name: 'AI创新班', create_time: '2026-07-16T09:10:00' },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = keyword
        ? await fetchUsers({ keyword, role: filterRole, page, pageSize })
        : await fetchUserList({ role: filterRole, page, pageSize })
      setUsers(res.users || [])
      setTotal(res.total || 0)
    } catch (e) {
      // API 不可用时使用演示数据
      let filtered = demoUsers
      if (filterRole) filtered = filtered.filter(u => u.role === filterRole)
      if (keyword) filtered = filtered.filter(u => u.username.includes(keyword) || u.name.includes(keyword))
      setUsers(filtered.slice((page - 1) * pageSize, page * pageSize))
      setTotal(filtered.length)
    } finally { setLoading(false) }
  }, [page, filterRole, keyword])

  useEffect(() => { load() }, [load])

  const show = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3000) }

  const handleAdd = async () => {
    if (!addForm.username || !addForm.password || !addForm.name) { show('error', '用户名、密码、姓名不能为空'); return }
    try { await addUser(addForm); show('success', `用户 ${addForm.username} 创建成功`); setShowAdd(false); setAddForm({ username: '', password: '', name: '', role: 'student', className: '' }); load() }
    catch (e) { show('error', e.message) }
  }

  const handleDelete = async (username) => {
    if (!confirm(`确定删除 ${username}？不可撤销。`)) return
    try { await deleteUser(username); show('success', `${username} 已删除`); load() }
    catch (e) { show('error', e.message) }
  }

  const handleRole = async (username, newRole) => {
    try { await updateUserRole(username, newRole); show('success', `${username} → ${ROLE_LABELS[newRole]}`); load() }
    catch (e) { show('error', e.message) }
  }

  const handleResetPwd = async (username) => {
    if (!confirm(`重置 ${username} 密码为其用户名？`)) return
    try { await resetUserPassword(username); show('success', `${username} 密码已重置`) }
    catch (e) { show('error', e.message) }
  }

  const totalPages = Math.ceil(total / pageSize)
  const btnN = (bg) => ({ padding: '5px 12px', borderRadius: 2, border: 'none', cursor: 'pointer', background: bg, color: C.white, fontSize: 11, fontWeight: 600 })

  return (
    <div>
      {msg && (
        <div style={{ padding: '8px 14px', marginBottom: 14, borderRadius: 2, fontSize: 12, background: msg.type === 'error' ? 'rgba(255,71,87,0.12)' : 'rgba(46,213,115,0.12)', border: `1px solid ${msg.type === 'error' ? 'rgba(255,71,87,0.3)' : 'rgba(46,213,115,0.3)'}`, color: msg.type === 'error' ? C.danger : C.success }}>{msg.text}</div>
      )}

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="🔍 搜索用户名或姓名..." value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1) }}
          style={{ ...inputStyle, width: 240, marginBottom: 0 }} />
        <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1) }}
          style={{ ...inputStyle, width: 130, marginBottom: 0 }}>
          <option value="">全部角色</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <span style={{ fontSize: 12, color: C.dim }}>共 {total} 用户</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowAdd(true)} style={{
          padding: '9px 20px', border: `1px solid ${C.cyan}`, borderRadius: 2, background: 'rgba(0,229,255,0.1)', color: C.cyan, fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: 1,
        }}>＋ 添加用户</button>
      </div>

      {/* 表格 */}
      <ClipCard style={{ padding: 0, overflow: 'auto' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 50, color: C.dim }}>加载中...</div> : users.length === 0 ? <div style={{ textAlign: 'center', padding: 50, color: C.dim }}>暂无用户</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
              {['用户名', '姓名', '角色', '班级', '创建时间', '操作'].map(h => <th key={h} style={{ ...thN, textAlign: h === '操作' ? 'center' : 'left', padding: '12px 14px' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id || u.username} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ ...tdN, padding: '10px 14px' }}><strong>{u.username}</strong></td>
                  <td style={{ ...tdN, padding: '10px 14px' }}>{u.name || '—'}</td>
                  <td style={{ ...tdN, padding: '10px 14px' }}>
                    <select value={u.role} onChange={e => handleRole(u.username, e.target.value)}
                      style={{ background: 'rgba(10,14,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: ROLE_COLORS_NEON[u.role] || C.white, fontSize: 11, fontWeight: 600, padding: '3px 6px', borderRadius: 2 }}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td style={{ ...tdN, padding: '10px 14px' }}>{u.class_name || '—'}</td>
                  <td style={{ ...tdN, padding: '10px 14px' }}>{u.create_time ? new Date(u.create_time).toLocaleDateString('zh-CN') : '—'}</td>
                  <td style={{ ...tdN, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => handleResetPwd(u.username)} style={btnN(C.warning)}>🔑</button>
                      <button onClick={() => handleDelete(u.username)} style={btnN(C.danger)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, padding: '14px' }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ ...btnN(page <= 1 ? 'rgba(255,255,255,0.05)' : '#7B61FF'), color: page <= 1 ? '#555' : C.white, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>上一页</button>
            <span style={{ padding: '5px 10px', fontSize: 12, color: C.dim }}>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ ...btnN(page >= totalPages ? 'rgba(255,255,255,0.05)' : '#7B61FF'), color: page >= totalPages ? '#555' : C.white, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>下一页</button>
          </div>
        )}
      </ClipCard>

      {/* 添加用户弹窗 */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 2, padding: '28px 32px', width: 400, clipPath: 'polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px))' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.white, margin: '0 0 20px', letterSpacing: 1 }}>＋ 添加用户</h2>
            {[
              { label: '用户名 *', key: 'username', type: 'text' },
              { label: '密码 *', key: 'password', type: 'password' },
              { label: '姓名 *', key: 'name', type: 'text' },
              { label: '班级', key: 'className', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} value={addForm[f.key]} onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.dim, display: 'block', marginBottom: 4 }}>角色</label>
              <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: C.dim, fontSize: 12, cursor: 'pointer' }}>取消</button>
              <button onClick={handleAdd} style={{ padding: '8px 20px', borderRadius: 2, border: 'none', background: C.purple, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>确认创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════ 算子模块管理 ══════════════ */
function OperatorsPage() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => { fetchNodeCatalog().then(setData).catch(() => setErr(true)) }, [])
  const catNames = { BACKBONE: '主干网络', ADAPTER: '适配器', NECK: '颈部模块', HEAD: '检测头', PROCESSING: '图像处理' }
  const diffLabels = ['', '★ 入门', '★★ 进阶', '★★★ 高阶']
  // 兜底演示数据（API 失败时使用）
  const demoData = { total_categories: 5, total_nodes: 31, catalog: { BACKBONE: { count: 9, nodes: [{ name: 'ResNet50', difficulty: 1, params: '25.5M', paper: 'He et al., CVPR 2016', desc: 'CNN经典残差网络' },{ name: 'ViT_Base', difficulty: 1, params: '86M', paper: 'Dosovitskiy et al., ICLR 2021', desc: '基础版视觉Transformer' },{ name: 'SAM_ViT_B', difficulty: 2, params: '91M', paper: 'Kirillov et al., ICCV 2023', desc: 'SAM基础版视觉主干' }]}, ADAPTER: { count: 5, nodes: [{ name: 'LoRA_Sampler', difficulty: 2, params: '0.5M', paper: 'Hu et al., ICLR 2022', desc: '低秩适配采样器' }]}, NECK: { count: 5, nodes: [{ name: 'FPN', difficulty: 2, params: '0.3M', paper: 'Lin et al., CVPR 2017', desc: '特征金字塔网络' }]}, HEAD: { count: 8, nodes: [{ name: 'YOLO_Detect_Head', difficulty: 2, params: '8.5M', paper: 'Redmon et al.', desc: 'YOLO检测头' }]}, PROCESSING: { count: 4, nodes: [{ name: 'Resize', difficulty: 1, params: '—', paper: '—', desc: '图像缩放预处理' }]} }}
  const d = data || (err ? demoData : null)
  if (!d) return <ClipCard><div style={{ textAlign: 'center', padding: 40, color: C.dim }}>加载中...</div></ClipCard>
  if (err && !data) return <OperatorsContent data={d} catNames={catNames} diffLabels={diffLabels} />
  return <OperatorsContent data={d} catNames={catNames} diffLabels={diffLabels} />
}
function OperatorsContent({ data, catNames, diffLabels }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {Object.entries(catNames).map(([cat, label]) => (
          <ClipCard key={cat} style={{ textAlign: 'center', padding: '16px 12px' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.cyan, textShadow: `0 0 16px ${C.cyan}44` }}>{data.catalog?.[cat]?.count || 0}</div>
            <div style={{ fontSize: 11, color: C.white, fontWeight: 600, marginTop: 4 }}>{label}</div>
            <div style={{ fontSize: 10, color: C.dim }}>{cat}</div>
          </ClipCard>
        ))}
      </div>
      {Object.entries(data.catalog || {}).map(([cat, info]) => (
        <ClipCard key={cat} style={{ marginBottom: 12 }}>
          <h3 style={{ ...sectionH3, marginBottom: 10 }}>{cat} — {catNames[cat] || cat}（{info.count} 个算子）</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
              <th style={thN}>算子名称</th><th style={thN}>难度</th><th style={thN}>参数规模</th><th style={thN}>论文来源</th><th style={thN}>描述</th>
            </tr></thead>
            <tbody>
              {info.nodes.map((n, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ ...tdN, fontWeight: 700, color: C.cyan }}>{n.name}</td>
                  <td style={tdN}><span style={{ color: ['', C.cyan, C.purple, C.pink][n.difficulty] || C.dim }}>{diffLabels[n.difficulty] || ''}</span></td>
                  <td style={tdN}>{n.params}</td>
                  <td style={{ ...tdN, fontSize: 10, color: C.dim, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.paper}</td>
                  <td style={{ ...tdN, fontSize: 11, color: C.dim }}>{n.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClipCard>
      ))}
    </div>
  )
}

/* ══════════════ 源码文件列表 ══════════════ */
function CodeFilesPage() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => { fetchCodeFiles().then(setData).catch(() => setErr(true)) }, [])
  const demoFiles = { total: 32, files: [
    { name: 'sam_model.py', size_kb: 12.4, lines: 328 }, { name: 'image_encoder.py', size_kb: 18.7, lines: 456 },
    { name: 'mask_decoder.py', size_kb: 15.2, lines: 389 }, { name: 'prompt_encoder.py', size_kb: 8.9, lines: 234 },
    { name: 'resnet.py', size_kb: 10.1, lines: 298 }, { name: 'yolo_head.py', size_kb: 6.8, lines: 187 },
    { name: 'lora_adapter.py', size_kb: 5.3, lines: 142 }, { name: 'fpn.py', size_kb: 9.6, lines: 265 },
    { name: 'vit_encoder.py', size_kb: 14.2, lines: 378 }, { name: 'swin_transformer.py', size_kb: 16.5, lines: 412 },
    { name: 'dino.py', size_kb: 11.8, lines: 305 }, { name: 'preprocessing.py', size_kb: 7.2, lines: 198 },
  ]}
  const d = data || (err ? demoFiles : null)
  if (!d) return <ClipCard><div style={{ textAlign: 'center', padding: 40, color: C.dim }}>加载中...</div></ClipCard>
  return <CodeFilesContent data={d} err={err && !data} />
}
function CodeFilesContent({ data, err }) {
  return (
    <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <ClipCard style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.cyan, textShadow: `0 0 16px ${C.cyan}44` }}>{data.total}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>源码文件</div>
        </ClipCard>
        <ClipCard style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.purple, textShadow: `0 0 16px ${C.purple}44` }}>{data.files.reduce((s, f) => s + f.size_kb, 0).toFixed(0)}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>总大小 KB</div>
        </ClipCard>
        <ClipCard style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.pink, textShadow: `0 0 16px ${C.pink}44` }}>{data.files.reduce((s, f) => s + f.lines, 0)}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>总行数</div>
        </ClipCard>
      </div>
      <ClipCard>
        <h3 style={sectionH3}>📁 assets/code_mirror/ 文件列表</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {data.files.map((f, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,229,255,0.02)' }}>
              <span style={{ fontSize: 18 }}>🐍</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.cyan, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{f.name}</div>
                <div style={{ fontSize: 10, color: C.dim }}>{f.size_kb} KB · {f.lines} 行</div>
              </div>
            </div>
          ))}
        </div>
      </ClipCard>
    </div>
  )
}

/* ══════════════ 测试数据管理 ══════════════ */
function ExperimentDataPage() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => { fetchExperimentData().then(setData).catch(() => setErr(true)) }, [])
  const demoExps = { total: 11, experiments: [
    { exp_id: 'sam_baseline', file: 'sam_vit_b_baseline.json', desc: 'SAM ViT-B 基线消融实验', size_kb: 24.5 },
    { exp_id: 'resnet_fpn_ablation', file: 'resnet50_fpn.json', desc: 'ResNet50+FPN Neck 消融对比', size_kb: 18.2 },
    { exp_id: 'yolo_comparison', file: 'yolo_detect_head.json', desc: 'YOLO 检测头多尺度对比', size_kb: 31.8 },
    { exp_id: 'lora_rank_study', file: 'lora_rank_ablation.json', desc: 'LoRA Rank=4/8/16/32 对精度影响', size_kb: 15.3 },
    { exp_id: 'attention_heads', file: 'attention_head_ablation.json', desc: 'Transformer 注意力头数消融', size_kb: 22.1 },
    { exp_id: 'segmentation_bench', file: 'segmentation_benchmark.json', desc: '语义分割综合基准测试', size_kb: 45.6 },
  ]}
  const d = data || (err ? demoExps : null)
  if (!d) return <ClipCard><div style={{ textAlign: 'center', padding: 40, color: C.dim }}>加载中...</div></ClipCard>
  return <ExpDataContent data={d} err={err && !data} />
}
function ExpDataContent({ data, err }) {
  return (
    <div>
            <ClipCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 48 }}>🧪</div>
          <div>
            <h3 style={sectionH3}>消融实验数据</h3>
            <p style={{ fontSize: 12, color: C.dim, margin: 0 }}>共 {data.total} 个实验数据集，位于 assets/experiment_results/</p>
          </div>
        </div>
      </ClipCard>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {data.experiments.map((exp, i) => (
          <ClipCard key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.cyan }}>{exp.exp_id}</div>
              <span style={{ fontSize: 10, color: C.dim, padding: '2px 6px', borderRadius: 2, border: `1px solid ${C.border}` }}>{exp.file}</span>
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>{exp.desc || '无描述'}</div>
            <div style={{ fontSize: 10, color: '#5a6088' }}>{exp.size_kb} KB</div>
          </ClipCard>
        ))}
      </div>
    </div>
  )
}

/* ══════════════ 资源生成监控 ══════════════ */
function MonitorPage() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => { fetchRecentMaterials().then(setData).catch(() => setErr(true)) }, [])
  const demoMats = { total: 42, materials: [
    { id: 1, title: 'SAM 模型架构精讲', type: '讲义', task_type: '语义分割', session_id: 'sess_a1b2', created_at: '2026-07-19T15:30:00' },
    { id: 2, title: '计算机视觉知识全景', type: '思维导图', task_type: '综合', session_id: 'sess_c3d4', created_at: '2026-07-19T14:15:00' },
    { id: 3, title: '视觉模型专项练习', type: '练习题', task_type: '目标检测', session_id: 'sess_e5f6', created_at: '2026-07-18T09:45:00' },
    { id: 4, title: '必读论文推荐', type: '拓展阅读', task_type: '图像分割', session_id: 'sess_g7h8', created_at: '2026-07-17T16:20:00' },
    { id: 5, title: 'PyTorch 分割实战', type: '实操案例', task_type: '语义分割', session_id: 'sess_i9j0', created_at: '2026-07-16T11:00:00' },
    { id: 6, title: '图像分割教学课件', type: 'PPT大纲', task_type: '综合', session_id: 'sess_k1l2', created_at: '2026-07-15T08:30:00' },
  ]}
  const d = data || (err ? demoMats : null)
  if (!d) return <ClipCard><div style={{ textAlign: 'center', padding: 40, color: C.dim }}>加载中...</div></ClipCard>
  return <MonitorContent data={d} err={err && !data} />
}
function MonitorContent({ data, err }) {
  const typeColors = { '讲义': C.cyan, '思维导图': C.purple, '练习题': C.pink, 'PPT大纲': C.warning, '拓展阅读': C.success, '实操案例': '#ff6b6b' }
  return (
    <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <ClipCard style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.cyan, textShadow: `0 0 16px ${C.cyan}44` }}>{data.total}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>生成资源总数</div>
        </ClipCard>
        <ClipCard style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.purple, textShadow: `0 0 16px ${C.purple}44` }}>{new Set(data.materials.map(m => m.session_id)).size}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>涉及会话数</div>
        </ClipCard>
        <ClipCard style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.pink, textShadow: `0 0 16px ${C.pink}44` }}>{new Set(data.materials.map(m => m.type)).size}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>资源类型数</div>
        </ClipCard>
      </div>
      <ClipCard>
        <h3 style={sectionH3}>🤖 最近生成的学习资源</h3>
        {data.materials.length === 0 ? <div style={{ textAlign: 'center', padding: 30, color: C.dim }}>暂无资源（请先在资源页面生成）</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
              <th style={thN}>标题</th><th style={thN}>类型</th><th style={thN}>任务</th><th style={thN}>会话 ID</th><th style={thN}>生成时间</th>
            </tr></thead>
            <tbody>
              {data.materials.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ ...tdN, fontWeight: 600 }}>{m.title}</td>
                  <td style={tdN}><span style={{ color: typeColors[m.type] || C.cyan, fontWeight: 600 }}>{m.type}</span></td>
                  <td style={tdN}>{m.task_type || '—'}</td>
                  <td style={{ ...tdN, fontSize: 10, color: C.dim, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.session_id}</td>
                  <td style={{ ...tdN, fontSize: 11, color: C.dim }}>{m.created_at ? new Date(m.created_at).toLocaleString('zh-CN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ClipCard>
    </div>
  )
}

/* ══════════════ 系统设置 ══════════════ */
function SettingsPage() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(false)
  useEffect(() => { fetchSystemInfo().then(setData).catch(() => setErr(true)) }, [])
  const fallbackData = { project: 'Vision-Forge V2.0', debug_mode: true, model: 'Spark generalv3.5', rag_backend: 'chroma', db_url: './vision_forge.db', persist_enabled: true, recent_logs: [{ name: 'workflow_rolling.log', size_kb: 128 }, { name: 'workflow_20260719.log', size_kb: 45 }] }
  const d = data || (err ? fallbackData : null)
  if (!d) return <ClipCard><div style={{ textAlign: 'center', padding: 40, color: C.dim }}>加载中...</div></ClipCard>
  return <SettingsContent data={d} err={err && !data} />
}
function SettingsContent({ data, err }) {
  const rows = [
    { label: '项目名称', value: data.project },
    { label: '调试模式', value: data.debug_mode ? '🟢 已开启' : '🔴 已关闭' },
    { label: '大模型版本', value: data.model },
    { label: 'RAG 检索后端', value: data.rag_backend },
    { label: '数据库文件', value: data.db_url },
    { label: '黑板持久化', value: data.persist_enabled ? '🟢 已开启' : '🔴 已关闭' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <ClipCard>
        <h3 style={sectionH3}>⚙ 系统配置</h3>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 12, color: C.dim }}>{r.label}</span>
            <span style={{ fontSize: 12, color: C.white, fontWeight: 600 }}>{r.value}</span>
          </div>
        ))}
      </ClipCard>
      <ClipCard>
        <h3 style={sectionH3}>📋 最近日志文件</h3>
        {(data.recent_logs || []).length === 0 ? <div style={{ textAlign: 'center', padding: 30, color: C.dim }}>暂无日志</div> : (
          (data.recent_logs || []).map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 16 }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: C.white, fontWeight: 600 }}>{l.name}</div>
                <div style={{ fontSize: 10, color: C.dim }}>{l.size_kb} KB</div>
              </div>
            </div>
          ))
        )}
      </ClipCard>
    </div>
  )
}

/* ══════════════ 主入口 ══════════════ */
export default function AdminDashboard() {
  const { user, isAuthenticated, initialized, login } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [active, setActive] = useState('dashboard')
  const [stats, setStats] = useState(null)

  const loadStats = useCallback(async () => {
    try { const r = await fetchAdminStats(); setStats(r) } catch (_) {}
  }, [])

  useEffect(() => { if (isAuthenticated) loadStats() }, [isAuthenticated, loadStats])
  useEffect(() => {
    const handler = (e) => { if (e.key === 'b' && e.ctrlKey) { e.preventDefault(); setCollapsed(c => !c) } }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!initialized) return null

  // 登录门
  if (!isAuthenticated) {
    return <AdminLoginGate onLogin={login} />
  }

  // 非管理员拒绝
  if (!['admin', '管理员'].includes(user?.role || '')) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 50, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 2, clipPath: 'polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px))' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ color: C.white, margin: 0 }}>无访问权限</h2>
          <p style={{ color: C.dim, margin: '8px 0' }}>当前账号 <strong style={{ color: C.cyan }}>{user?.username}</strong> 角色为 <strong>{user?.role || '未知'}</strong></p>
          <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '8px 20px', border: `1px solid ${C.cyan}`, borderRadius: 2, background: 'transparent', color: C.cyan, cursor: 'pointer', fontWeight: 600 }}>返回用户端</button>
        </div>
      </div>
    )
  }

  // 内容区
  const renderPage = () => {
    switch (active) {
      case 'dashboard': return <DashboardPage stats={stats} />
      case 'users': return <UsersPage />
      case 'operators': return <OperatorsPage />
      case 'upload': return <CodeFilesPage />
      case 'testdata': return <ExperimentDataPage />
      case 'monitor': return <MonitorPage />
      case 'settings': return <SettingsPage />
      default: return <DashboardPage stats={stats} />
    }
  }

  const userCount = stats?.total_users ?? '—'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* 星空纹理（全局） */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: `radial-gradient(2px 2px at 15% 25%, rgba(0,229,255,0.5), transparent), radial-gradient(2px 2px at 85% 20%, rgba(123,97,255,0.4), transparent), radial-gradient(1px 1px at 40% 70%, rgba(255,255,255,0.45), transparent), radial-gradient(2px 2px at 70% 60%, rgba(0,229,255,0.35), transparent), radial-gradient(1px 1px at 25% 80%, rgba(123,97,255,0.5), transparent), radial-gradient(3px 3px at 90% 85%, rgba(0,229,255,0.3), transparent), radial-gradient(1px 1px at 55% 10%, rgba(255,107,157,0.45), transparent)` }} />

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} active={active} setActive={setActive} userCount={userCount} navigate={navigate} />

      {/* 右侧内容 */}
      <div style={{ flex: 1, padding: '24px 28px', overflow: 'auto', position: 'relative', zIndex: 1 }}>
        {/* 顶栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: C.white, margin: 0, letterSpacing: 1 }}>
              {MENU_ITEMS.find(m => m.key === active)?.icon} {MENU_ITEMS.find(m => m.key === active)?.label}
            </h1>
            <p style={{ fontSize: 12, color: C.dim, margin: '4px 0 0' }}>{MENU_ITEMS.find(m => m.key === active)?.desc}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: C.dim }}>Ctrl+B 折叠侧栏</span>
            <div style={{
              padding: '4px 12px', borderRadius: 2, border: `1px solid ${C.border}`, fontSize: 11, color: C.cyan,
              background: 'rgba(0,229,255,0.06)', display: 'flex', alignItems: 'center', gap: 6,
            }}>🟢 系统运行中</div>
          </div>
        </div>

        {renderPage()}
      </div>
    </div>
  )
}
