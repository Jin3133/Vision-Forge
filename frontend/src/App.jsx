import { useState, createContext, useEffect } from 'react'
import { HashRouter as Router, Routes, Route, useLocation, Link, Navigate, useSearchParams } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import Canvas from './pages/Canvas.jsx'
import Center from './pages/Center.jsx'
import Resources from './pages/Resources.jsx'
import Tutor from './pages/Tutor.jsx'
import Profile from './pages/Profile.jsx'

export const UserContext = createContext()

function getDynamicTitle(pathname, tab) {
  const baseMap = {
    '/': '💬 智能对话',
    '/chat': '💬 智能对话',
    '/canvas': '🎨 模型工坊',
    '/center': '📊 学情分析',
    '/resources': '📚 资源中心',
    '/tutor': '🎓 知识辅导',
    '/profile': '👤 个人中心',
  }
  const tabTitleMap = {
    '/canvas': { 'library': '📦 模型库', 'evaluate': '📊 模型评估' },
    '/center': { 'portrait': '🎯 学习画像', 'evaluate': '📋 能力测评', 'path': '🛤️ 学习路径' },
    '/resources': { 'courses': '📖 资源库', 'generate': '✨ 资源生成', 'favorites': '❤️ 我的收藏' },
    '/tutor': { 'qa': '💡 智能答疑', 'source': '📖 源码阅读', 'about': '📋 关于开源' },
  }
  if (tab && tabTitleMap[pathname]?.[tab]) return tabTitleMap[pathname][tab]
  return baseMap[pathname] || '💬 智能对话'
}

function getBreadcrumb(pathname, tab) {
  const crumbs = []
  const baseMap = {
    '/': ['💬 智能对话'], '/chat': ['💬 智能对话'], '/canvas': ['🎨 模型工坊'],
    '/center': ['📊 学情分析'], '/resources': ['📚 资源中心'],
    '/tutor': ['🎓 知识辅导'], '/profile': ['👤 个人中心'],
  }
  const tabNameMap = {
    '/canvas': { 'library': '模型库', 'evaluate': '模型评估' },
    '/center': { 'portrait': '学习画像', 'evaluate': '能力测评', 'path': '学习路径' },
    '/resources': { 'courses': '资源库', 'generate': '资源生成', 'favorites': '我的收藏' },
    '/tutor': { 'qa': '智能答疑', 'source': '源码阅读', 'about': '关于开源' },
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

  const toggleMenu = (name) => {
    setOpenMenus(prev => prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name])
  }

  /* 自动展开当前路由对应的父菜单 */
  useEffect(() => {
    const parentMap = {
      '/canvas': '模型工坊',
      '/center': '学情分析',
      '/resources': '资源中心',
      '/tutor': '知识辅导',
    }
    const parentName = parentMap[path]
    if (parentName && !openMenus.includes(parentName)) {
      setOpenMenus(prev => [...prev, parentName])
    }
  }, [path])

  const navGroups = [
    { name: '智能对话', icon: '💬', path: '/' },
    {
      name: '模型工坊', icon: '🎨',
      children: [
        { name: '模型搭建', path: '/canvas', icon: '🔧' },
        { name: '模型库', path: '/canvas?tab=library', icon: '📦' },
        { name: '模型评估', path: '/canvas?tab=evaluate', icon: '📊' }
      ]
    },
    {
      name: '学情分析', icon: '📊',
      children: [
        { name: '学习画像', path: '/center?tab=portrait', icon: '🎯' },
        { name: '能力测评', path: '/center?tab=evaluate', icon: '📋' },
        { name: '学习路径', path: '/center?tab=path', icon: '🛤️' }
      ]
    },
    {
      name: '资源中心', icon: '📚',
      children: [
        { name: '资源库', path: '/resources?tab=courses', icon: '📖' },
        { name: '资源生成', path: '/resources?tab=generate', icon: '✨' },
        { name: '我的收藏', path: '/resources?tab=favorites', icon: '❤️' }
      ]
    },
    {
      name: '知识辅导', icon: '🎓',
      children: [
        { name: '智能答疑', path: '/tutor?tab=qa', icon: '💡' },
        { name: '源码阅读', path: '/tutor?tab=source', icon: '📖' },
        { name: '关于开源', path: '/tutor?tab=about', icon: '📋' }
      ]
    },
    { name: '个人中心', icon: '👤', path: '/profile' }
  ]

  const dynamicTitle = getDynamicTitle(path, tab)
  const breadcrumb = getBreadcrumb(path, tab)

  const isActive = (itemPath) => {
    if (!itemPath) return false
    if (itemPath === '/') return path === '/' || path === '/chat'
    if (itemPath === '/profile') return path === '/profile'
    // 对有子菜单的路径，精确匹配 pathname + tab
    const itemUrl = new URL('http://x' + itemPath)
    const currentUrl = new URL('http://x' + location.pathname + location.search)
    if (itemPath.startsWith('/canvas')) {
      return path === '/canvas' && itemUrl.searchParams.get('tab') === currentUrl.searchParams.get('tab')
    }
    if (itemPath.startsWith('/center')) {
      return path === '/center' && itemUrl.searchParams.get('tab') === currentUrl.searchParams.get('tab')
    }
    if (itemPath.startsWith('/resources')) {
      // 资源库默认 tab=courses
      const itemTab = itemUrl.searchParams.get('tab') || 'courses'
      const currentTab = currentUrl.searchParams.get('tab') || 'courses'
      return path === '/resources' && itemTab === currentTab
    }
    if (itemPath.startsWith('/tutor')) {
      // 智能答疑默认 tab=qa
      const itemTab = itemUrl.searchParams.get('tab') || 'qa'
      const currentTab = currentUrl.searchParams.get('tab') || 'qa'
      return path === '/tutor' && itemTab === currentTab
    }
    return false
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f7fa' }}>
      {/* 左侧导航栏 */}
      <div style={{
        width: collapsed ? 68 : 260, background: '#ffffff', borderRight: '1px solid #e8ecf1',
        display: 'flex', flexDirection: 'column', transition: 'width 0.3s ease',
        overflowY: 'auto', overflowX: 'hidden', zIndex: 100,
        boxShadow: collapsed ? 'none' : '2px 0 8px rgba(0,0,0,0.05)', flexShrink: 0
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '16px 0' : '20px 16px', borderBottom: '1px solid #e8ecf1',
          textAlign: 'center', height: collapsed ? 60 : 72, boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {!collapsed ? (
            <div>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>Vision-Forge</span>
              <span style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginTop: 2 }}>多智能体学习平台</span>
            </div>
          ) : (
            <span style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>VF</span>
          )}
        </div>

        {/* 折叠按钮 */}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          margin: '12px', padding: '8px', background: '#f1f5f9', boxShadow: 'none',
          fontSize: 12, borderRadius: 8, width: 'auto', color: '#64748b',
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
                    <div style={{ marginLeft: 20, marginTop: 4 }}>
                      {group.children.map((child) => (
                        <Link key={child.path} to={child.path} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 8, fontSize: 13,
                          color: isActive(child.path) ? '#3b82f6' : '#64748b',
                          textDecoration: 'none',
                          background: isActive(child.path) ? '#eff6ff' : 'transparent',
                          transition: 'all 0.2s',
                          fontWeight: isActive(child.path) ? 600 : 400
                        }}>
                          <span style={{ fontSize: 14 }}>{child.icon}</span>
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

        {/* 底部用户信息 */}
        <div style={{
          padding: collapsed ? '12px 0' : '12px 16px', borderTop: '1px solid #e8ecf1',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start', gap: 12
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, flexShrink: 0
          }}>👤</div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>张明</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>学生</div>
            </div>
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
            <button onClick={() => setShowLogoutConfirm(true)} style={{
              padding: '6px 16px', fontSize: 12, background: '#ef4444',
              borderRadius: 8, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500
            }}>退出登录</button>
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
    </div>
  )
}

function PrivateRoute({ children }) {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  return isLoggedIn ? children : <Navigate to="/login" />
}

export default function App() {
  const [user, setUser] = useState({
    name: '张明', studentId: '2022105430066',
    college: '计算机与软件学院', major: '软件工程', avatar: '👤'
  })
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Layout><Home /></Layout></PrivateRoute>} />
          <Route path="/chat" element={<PrivateRoute><Layout><Home /></Layout></PrivateRoute>} />
          <Route path="/canvas" element={<PrivateRoute><Layout><Canvas /></Layout></PrivateRoute>} />
          <Route path="/center" element={<PrivateRoute><Layout><Center /></Layout></PrivateRoute>} />
          <Route path="/resources" element={<PrivateRoute><Layout><Resources /></Layout></PrivateRoute>} />
          <Route path="/tutor" element={<PrivateRoute><Layout><Tutor /></Layout></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
        </Routes>
      </Router>
    </UserContext.Provider>
  )
}