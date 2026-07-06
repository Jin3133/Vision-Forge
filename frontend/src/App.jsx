import { useState, createContext, useEffect, useContext } from 'react'
import { HashRouter as Router, Routes, Route, useLocation, Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Welcome from './pages/Welcome.jsx'
import Home from './pages/Home.jsx'
import Canvas from './pages/Canvas.jsx'
import Center from './pages/Center.jsx'
import Resources from './pages/Resources.jsx'
import Profile from './pages/Profile.jsx'
import Onboarding from './pages/Onboarding.jsx'
import AccountSettings from './pages/AccountSettings.jsx'
import WrongBook from './pages/WrongBook.jsx'
import { LearnProvider, useLearn } from './LearnContext.jsx'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import NotificationCenter from './components/notifications/NotificationCenter.jsx'

/* Tutor.jsx 已并入首页 Tab（智能答疑/源码阅读/关于开源），保留文件作为源码参考。*/

export const UserContext = createContext()

function getDynamicTitle(pathname, tab) {
  const baseMap = {
    '/': '🏠 智能对话',
    '/chat': '🏠 智能对话',
    '/center': '📚 我的学习',
    '/canvas': '🛠️ 模型实践',
    '/resources': '📖 资源中心',
    '/profile': '👤 个人空间',
    '/settings': '⚙️ 账户设置',
  }
  const tabTitleMap = {
    '/center': { 'portrait': '🎯 学习画像', 'path': '🛤️ 学习路径', 'report': '📊 学习报告' },
    '/canvas': { 'workshop': '🧱 模型工坊', 'record': '📓 实验记录', 'compare': '📊 模型对比' },
    '/resources': { 'recommend': '⭐ 推荐资源', 'generate': '✨ 资源生成' },
    '/profile': { 'favorites': '❤️ 我的收藏' },
    '/settings': { 'profile': '个人信息', 'password': '修改密码', 'security': '账号安全' },
  }
  if (tab && tabTitleMap[pathname]?.[tab]) return tabTitleMap[pathname][tab]
  return baseMap[pathname] || '🏠 智能对话'
}

function getBreadcrumb(pathname, tab) {
  const crumbs = []
  const baseMap = {
    '/': ['🏠 智能对话'], '/chat': ['🏠 智能对话'],
    '/center': ['📚 我的学习'],
    '/canvas': ['🛠️ 模型实践'],
    '/resources': ['📖 资源中心'],
    '/profile': ['👤 个人空间'],
  }
  const tabNameMap = {
    '/center': { 'portrait': '学习画像', 'path': '学习路径', 'report': '学习报告' },
    '/canvas': { 'workshop': '模型工坊', 'record': '实验记录', 'compare': '模型对比' },
    '/resources': { 'recommend': '推荐资源', 'generate': '资源生成' },
    '/profile': { 'favorites': '我的收藏' },
  }
  const baseNames = baseMap[pathname]
  if (baseNames) crumbs.push(...baseNames)
  if (tab && tabNameMap[pathname]?.[tab]) crumbs.push(tabNameMap[pathname][tab])
  return crumbs
}

function Layout({ children }) {
  const location = useLocation()
  const path = location.pathname
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab') || ''
  const [collapsed, setCollapsed] = useState(false)
  const [openMenus, setOpenMenus] = useState([])
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const navigate = useNavigate()
  const { user } = useContext(UserContext)
  const { logout } = useAuth()

  const toggleMenu = (name) => {
    setOpenMenus(prev => prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name])
  }

  /* 自动展开当前路由对应的父菜单 */
  useEffect(() => {
    const parentMap = {
      '/center': '我的学习',
      '/canvas': '模型实践',
      '/resources': '资源中心',
    }
    const parentName = parentMap[path]
    if (parentName && !openMenus.includes(parentName)) {
      setOpenMenus(prev => [...prev, parentName])
    }
  }, [path])

  /* ─────────────────────────────────────────────
     侧栏按「学习闭环」重新分组（5 组）：
       🏠 智能对话 → 首页，AI 导师调度一切
       📚 我的学习 → 学习画像 / 学习路径 / 学习报告
       🛠️ 模型实践 → 模型工坊 / 实验记录 / 模型对比
       📖 资源中心 → 推荐资源 / 资源生成 / 我的收藏
       👤 个人空间 → 个人档案
     知识辅导（智能答疑 / 源码阅读 / 关于开源）并入首页 Tab，不再是独立菜单。
  ───────────────────────────────────────────── */
  const navGroups = [
    { name: '智能对话', icon: '🏠', path: '/' },
    {
      name: '我的学习', icon: '📚',
      children: [
        { name: '学习画像', path: '/center?tab=portrait', icon: '🎯' },
        { name: '学习路径', path: '/center?tab=path', icon: '🛤️' },
        { name: '学习报告', path: '/center?tab=report', icon: '📊' },
        { name: '错题本',   path: '/wrong-book',           icon: '📝' },
      ]
    },
    {
      name: '模型实践', icon: '🛠️',
      children: [
        { name: '模型工坊', path: '/canvas?tab=workshop', icon: '🧱' },
        { name: '实验记录', path: '/canvas?tab=record', icon: '📓' },
        { name: '模型对比', path: '/canvas?tab=compare', icon: '📊' }
      ]
    },
    {
      name: '资源中心', icon: '📖',
      children: [
        { name: '推荐资源', path: '/resources?tab=recommend', icon: '⭐' },
        { name: '资源生成', path: '/resources?tab=generate', icon: '✨' }
      ]
    },
    {
      name: '个人空间', icon: '👤',
      children: [
        { name: '个人档案', path: '/profile',                       icon: '👤' },
        { name: '我的收藏', path: '/profile?tab=favorites',         icon: '❤️' },
      ]
    }
  ]

  const dynamicTitle = getDynamicTitle(path, tab)
  const breadcrumb = getBreadcrumb(path, tab)

  const isActive = (itemPath) => {
    if (!itemPath) return false
    if (itemPath === '/') return path === '/' || path === '/chat'
    if (itemPath === '/profile') return path === '/profile' && !searchParams.get('tab')
    if (itemPath === '/wrong-book') return path === '/wrong-book'
    // 对有子菜单的路径，精确匹配 pathname + tab
    const itemUrl = new URL('http://x' + itemPath)
    const currentUrl = new URL('http://x' + location.pathname + location.search)
    if (itemPath.startsWith('/canvas')) {
      const itemTab = itemUrl.searchParams.get('tab') || 'workshop'
      const currentTab = currentUrl.searchParams.get('tab') || 'workshop'
      return path === '/canvas' && itemTab === currentTab
    }
    if (itemPath.startsWith('/center')) {
      const itemTab = itemUrl.searchParams.get('tab') || 'portrait'
      const currentTab = currentUrl.searchParams.get('tab') || 'portrait'
      return path === '/center' && itemTab === currentTab
    }
    if (itemPath.startsWith('/profile')) {
      const itemTab = itemUrl.searchParams.get('tab') || ''
      const currentTab = currentUrl.searchParams.get('tab') || ''
      return path === '/profile' && itemTab === currentTab
    }
    if (itemPath.startsWith('/resources')) {
      const itemTab = itemUrl.searchParams.get('tab') || 'recommend'
      const currentTab = currentUrl.searchParams.get('tab') || 'recommend'
      return path === '/resources' && itemTab === currentTab
    }
    return false
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f7fa' }}>
      {/* 左侧导航栏 */}
      <div style={{
        width: collapsed ? 64 : 220, background: '#ffffff', borderRight: '1px solid #e8ecf1',
        display: 'flex', flexDirection: 'column', transition: 'width 0.3s ease',
        overflowY: 'auto', overflowX: 'hidden', zIndex: 100,
        boxShadow: collapsed ? 'none' : '2px 0 8px rgba(0,0,0,0.05)', flexShrink: 0
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '14px 0' : '16px 12px', borderBottom: '1px solid #e8ecf1',
          textAlign: 'center', height: collapsed ? 56 : 64, boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {!collapsed ? (
            <div>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#3b82f6' }}>Vision-Forge</span>
              <span style={{ fontSize: 9, color: '#94a3b8', display: 'block', marginTop: 1 }}>多智能体学习平台</span>
            </div>
          ) : (
            <span style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>VF</span>
          )}
        </div>

        {/* 折叠按钮 */}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          margin: '10px', padding: '6px', background: '#f1f5f9', boxShadow: 'none',
          fontSize: 11, borderRadius: 8, width: 'auto', color: '#64748b',
          border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 500
        }}>
          {collapsed ? '☰ 展开' : '◀ 收起'}
        </button>

        {/* 导航菜单 */}
        <div style={{ flex: 1, padding: '8px 12px' }}>
          {navGroups.map((group) => (
            <div key={group.name} style={{ marginBottom: 4 }}>
              {group.children ? (
                <>
                  {/* 父菜单项：无背景色，不高亮 */}
                  <div onClick={() => toggleMenu(group.name)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    transition: 'all 0.2s',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    userSelect: 'none'
                  }}>
                    <span style={{ fontSize: 18 }}>{group.icon}</span>
                    {!collapsed && (
                      <>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#334155' }}>{group.name}</span>
                        <span style={{
                          fontSize: 10,
                          transform: openMenus.includes(group.name) ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: '0.2s', color: '#94a3b8'
                        }}>▶</span>
                      </>
                    )}
                  </div>
                  {/* 子菜单 */}
                  {!collapsed && openMenus.includes(group.name) && (
                    <div style={{ marginLeft: 16, marginTop: 4 }}>
                      {group.children.map((child) => (
                        <Link key={child.path} to={child.path} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 10px', borderRadius: 8, fontSize: 12,
                          color: isActive(child.path) ? '#3b82f6' : '#64748b',
                          textDecoration: 'none',
                          background: isActive(child.path) ? '#eff6ff' : 'transparent',
                          transition: 'all 0.2s',
                          fontWeight: isActive(child.path) ? 600 : 400
                        }}>
                          <span style={{ fontSize: 13 }}>{child.icon}</span>
                          <span>{child.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* 无子菜单的项 */
                <Link to={group.path} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10,
                  fontSize: 14, fontWeight: isActive(group.path) ? 600 : 500,
                  color: isActive(group.path) ? '#3b82f6' : '#334155',
                  textDecoration: 'none',
                  background: isActive(group.path) ? '#eff6ff' : 'transparent',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  transition: 'all 0.2s'
                }}>
                  <span style={{ fontSize: 18 }}>{group.icon}</span>
                  {!collapsed && <span>{group.name}</span>}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* 底部用户信息（点击弹出菜单） */}
        <div style={{
          padding: collapsed ? '12px 0' : '12px 16px', borderTop: '1px solid #e8ecf1',
          display: 'flex', alignItems: 'center', position: 'relative',
          justifyContent: collapsed ? 'center' : 'flex-start', gap: 12
        }}>
          <div onClick={() => setShowUserMenu(s => !s)} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, flexShrink: 0, cursor: 'pointer',
            boxShadow: showUserMenu ? '0 0 0 3px rgba(59,130,246,0.18)' : 'none',
          }}>{user?.avatar || '👤'}</div>
          {!collapsed && (
            <div onClick={() => setShowUserMenu(s => !s)} style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || '学习者'}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{user?.role || '学生'}</div>
            </div>
          )}
          {!collapsed && (
            <span onClick={() => setShowUserMenu(s => !s)} style={{
              fontSize: 10, color: '#94a3b8', cursor: 'pointer', padding: 4,
              transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s',
            }}>▲</span>
          )}

          {/* ── 用户下拉菜单 ── */}
          {showUserMenu && (
            <>
              <div onClick={() => setShowUserMenu(false)} style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99,
              }} />
              <div style={{
                position: 'absolute', bottom: collapsed ? 56 : 64, left: collapsed ? 64 : 'auto',
                right: collapsed ? 'auto' : 8, width: collapsed ? 200 : 220,
                background: '#fff', borderRadius: 12,
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                border: '1px solid #e8ecf1', padding: 6, zIndex: 101,
              }}>
                {/* 用户信息头 */}
                <div style={{
                  padding: '10px 12px', borderBottom: '1px solid #f1f5f9', marginBottom: 4,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>{user?.avatar || '👤'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || '学习者'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.studentId || ''}</div>
                  </div>
                </div>

                {[
                  { icon: '👤', label: '我的档案', path: '/profile' },
                  { icon: '⚙️', label: '账户设置', path: '/settings' },
                  { icon: '🔒', label: '修改密码', path: '/settings?tab=password' },
                ].map((item, i) => (
                  <div key={i} onClick={() => {
                    setShowUserMenu(false)
                    navigate(item.path)
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, color: '#334155',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}

                <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />

                <div onClick={() => {
                  setShowUserMenu(false)
                  setShowLogoutConfirm(true)
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, color: '#ef4444',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 16 }}>🚪</span>
                  <span>退出登录</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* 顶部栏 */}
        <div style={{
          height: 56, background: '#fff', borderBottom: '1px solid #e8ecf1',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 24px', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#1e293b' }}>{dynamicTitle}</span>
            {breadcrumb.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
                {breadcrumb.map((crumb, idx) => (
                  <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {idx > 0 && <span style={{ color: '#cbd5e1' }}>/</span>}
                    <span style={{ color: idx === breadcrumb.length - 1 ? '#3b82f6' : '#94a3b8', fontWeight: idx === breadcrumb.length - 1 ? 500 : 400 }}>{crumb}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 4-Agent架构标识 — 体现多智能体协同 */}
            <div
              title="架构引导 · 算法教研 · 资源生成 · 学情评估 — 4智能体通过中央状态机（Task_State.json）协同"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                background: 'linear-gradient(90deg, #eff6ff, #ede9fe)',
                color: '#4f46e5', borderRadius: 20,
                border: '1px solid #c7d2fe', cursor: 'help',
              }}
            >
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: '#10b981', animation: 'pulse 1.5s infinite',
              }} />
              <span>🤖 4-Agent · 中央状态机驱动</span>
            </div>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              📅 {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </span>
            <button onClick={() => navigate('/settings')} title="修改密码 / 完善个人信息 / 账号安全" style={{
              padding: '6px 14px', fontSize: 12, background: '#f1f5f9',
              borderRadius: 8, color: '#475569', border: '1px solid #e2e8f0',
              cursor: 'pointer', fontWeight: 500,
            }}>⚙️ 账户设置</button>
            {/* 通知中心 —— 顶栏右侧铃铛入口（不影响其它业务） */}
            <NotificationCenter />
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20, background: '#f5f7fa' }}>
          {children}
        </div>
      </div>

      {/* 退出登录确认弹窗 */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '32px 28px',
            width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center'
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚪</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>确认退出登录？</h3>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>退出后需要重新登录才能访问系统</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setShowLogoutConfirm(false)} style={{
                padding: '10px 24px', fontSize: 14, borderRadius: 10,
                background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0',
                cursor: 'pointer', fontWeight: 500
              }}>取消</button>
              <button onClick={() => {
                logout()
                localStorage.removeItem('isLoggedIn')
                setShowLogoutConfirm(false)
                window.location.hash = '#/login'
                window.location.reload()
              }} style={{
                padding: '10px 24px', fontSize: 14, borderRadius: 10,
                background: '#ef4444', color: '#fff', border: 'none',
                cursor: 'pointer', fontWeight: 500
              }}>确认退出</button>
            </div>
          </div>
        </div>
      )}

      {/* 全局动画 */}
      <style>{`
        @keyframes pulse {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { isAuthenticated, initialized } = useAuth()
  /* 兼容旧的 localStorage.isLoggedIn 标记，避免已登录用户被新逻辑误踢 */
  const legacyFlag = localStorage.getItem('isLoggedIn') === 'true'
  if (!initialized) return null
  if (!isAuthenticated && !legacyFlag) return <Navigate to="/login" replace />

  /* 引导合并到 Welcome 页：未完成引导的用户直接跳 /welcome，
     让 Welcome 一次性展示「4智能体介绍 + 学习流程 + 选目标」，
     完成后用户再回首页。避免首页被 Onboarding 盖住、又被 Welcome 二次拦截的混乱。 */
  const learn = useLearn()
  if (!learn.onboarded) {
    /* 兜底：登录态没有 onboarded=true → 强制走 Welcome（含选目标交互） */
    return <Navigate to="/welcome" replace />
  }
  return children
}

/* Welcome 路由：仅首次登录时强制展示，已看过的用户直接放行到首页 */
function WelcomeRoute() {
  const { isAuthenticated, initialized } = useAuth()
  if (!initialized) return null
  if (!isAuthenticated) {
    /* 兜底：兼容旧的 isLoggedIn 标记 */
    if (localStorage.getItem('isLoggedIn') === 'true') return <Welcome />
    return <Navigate to="/login" replace />
  }
  const seen = (() => {
    try { return localStorage.getItem('vf_welcome_seen') === '1' } catch (_) { return false }
  })()
  if (seen) return <Navigate to="/" replace />
  return <Welcome />
}

function OnboardingGate() {
  /* 已弃用：Onboarding 能力已合并到 /welcome 页一次性完成（4智能体介绍 + 选目标）。
     保留空壳以防外部旧引用，PrivateRoute 不再挂载它。 */
  return null
}

export default function App() {
  const [user, setUser] = useState({
    name: '张明', studentId: '2022105430066',
    college: '计算机与软件学院', major: '软件工程', avatar: '👤',
    username: 'demo_user', role: '学生', email: '', phone: '',
  })
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <AuthProvider>
        <ToastProvider>
          <LearnProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/welcome" element={<WelcomeRoute />} />
                <Route path="/" element={<PrivateRoute><Layout><Home /></Layout></PrivateRoute>} />
                <Route path="/chat" element={<PrivateRoute><Layout><Home /></Layout></PrivateRoute>} />
                <Route path="/canvas" element={<PrivateRoute><Layout><Canvas /></Layout></PrivateRoute>} />
                <Route path="/center" element={<PrivateRoute><Layout><Center /></Layout></PrivateRoute>} />
                <Route path="/resources" element={<PrivateRoute><Layout><Resources /></Layout></PrivateRoute>} />
                {/* 兼容旧路径：保留 /tutor，重定向到首页（知识辅导能力已并入智能对话 Tab） */}
                <Route path="/tutor" element={<PrivateRoute><Layout><Home /></Layout></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
                <Route path="/settings" element={<PrivateRoute><Layout><AccountSettings /></Layout></PrivateRoute>} />
                <Route path="/wrong-book" element={<PrivateRoute><Layout><WrongBook /></Layout></PrivateRoute>} />
              </Routes>
            </Router>
          </LearnProvider>
        </ToastProvider>
      </AuthProvider>
    </UserContext.Provider>
  )
}
