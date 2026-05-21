import { useState, createContext } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, Link, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import Canvas from './pages/Canvas'
import Center from './pages/Center'
import Resources from './pages/Resources'
import Profile from './pages/Profile'

export const UserContext = createContext()

function Layout({ children }) {
  const location = useLocation()
  const path = location.pathname
  const [collapsed, setCollapsed] = useState(false)
  const [openMenus, setOpenMenus] = useState(['智能对话', '模型工坊', '学情分析', '资源中心', '个人中心'])

  const toggleMenu = (name) => {
    setOpenMenus(prev => prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name])
  }

    const navGroups = [
    {
      name: '智能对话',
      icon: '💬',
      path: '/'
    },
    {
      name: '模型工坊',
      icon: '🎨',
      children: [
        { name: '模型搭建', path: '/canvas', icon: '🔧' },
        { name: '模型库', path: '/canvas?tab=library', icon: '📦' },
        { name: '模型评估', path: '/canvas?tab=evaluate', icon: '📊' }
      ]
    },
    {
      name: '学情分析',
      icon: '📊',
      children: [
        { name: '学习画像', path: '/center?tab=portrait', icon: '🎯' },
        { name: '效果评估', path: '/center?tab=evaluate', icon: '📈' },
        { name: '学习路径', path: '/center?tab=path', icon: '🛤️' }
      ]
    },
    {
      name: '资源中心',
      icon: '📚',
      children: [
        { name: '课程资源', path: '/resources?tab=courses', icon: '📖' },
        { name: '资源生成', path: '/resources?tab=generate', icon: '✨' },
        { name: '我的收藏', path: '/resources?tab=favorites', icon: '❤️' }
      ]
    },
    {
      name: '个人中心',
      icon: '👤',
      path: '/profile'
    }
  ]

  const titleMap = {
    '/': 'AI 智能对话',
    '/canvas': '模型工坊',
    '/center': '学情分析',
    '/resources': '资源中心',
    '/profile': '个人中心',
  }

  const logout = () => {
    localStorage.removeItem('isLoggedIn')
    window.location.href = '/login'
  }

  // 判断当前页面是否匹配
  const isActive = (itemPath) => {
    if (itemPath === '/') return path === '/'
    if (itemPath === '/canvas') return path === '/canvas' || path.startsWith('/canvas?')
    if (itemPath === '/center') return path === '/center' || path.startsWith('/center?')
    if (itemPath === '/resources') return path === '/resources' || path.startsWith('/resources?')
    if (itemPath === '/profile') return path === '/profile'
    return false
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f7fa' }}>
      {/* 左侧导航栏 */}
      <div style={{
        width: collapsed ? 72 : 240,
        background: '#ffffff',
        borderRight: '1px solid #e8ecf1',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflowY: 'auto',
        zIndex: 100
      }}>
        {/* Logo区域 */}
        <div style={{
          padding: collapsed ? '16px 0' : '20px 16px',
          borderBottom: '1px solid #e8ecf1',
          textAlign: 'center'
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
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            margin: '12px',
            padding: '6px',
            background: '#f1f5f9',
            boxShadow: 'none',
            fontSize: 12,
            borderRadius: 8,
            width: 'auto'
          }}
        >
          {collapsed ? '→ 展开' : '← 收起'}
        </button>

        {/* 导航菜单 */}
        <div style={{ flex: 1, padding: '8px 12px' }}>
          {navGroups.map((group) => (
            <div key={group.name} style={{ marginBottom: 4 }}>
              {/* 主菜单项 */}
              {group.children ? (
                <>
                  <div
                    onClick={() => toggleMenu(group.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      background: openMenus.includes(group.name) ? '#f1f5f9' : 'transparent'
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{group.icon}</span>
                    {!collapsed && (
                      <>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{group.name}</span>
                        <span style={{
                          fontSize: 10,
                          transform: openMenus.includes(group.name) ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: '0.2s',
                          color: '#94a3b8'
                        }}>▶</span>
                      </>
                    )}
                  </div>
                  {/* 子菜单 */}
                  {!collapsed && openMenus.includes(group.name) && (
                    <div style={{ marginLeft: 20, marginTop: 4 }}>
                      {group.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            borderRadius: 8,
                            fontSize: 13,
                            color: isActive(child.path) ? '#3b82f6' : '#64748b',
                            textDecoration: 'none',
                            background: isActive(child.path) ? '#eff6ff' : 'transparent',
                            transition: 'all 0.2s'
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{child.icon}</span>
                          <span>{child.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={group.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    color: isActive(group.path) ? '#3b82f6' : '#64748b',
                    textDecoration: 'none',
                    background: isActive(group.path) ? '#eff6ff' : 'transparent',
                    justifyContent: collapsed ? 'center' : 'flex-start'
                  }}
                >
                  <span style={{ fontSize: 18 }}>{group.icon}</span>
                  {!collapsed && <span>{group.name}</span>}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* 底部用户信息 */}
        <div style={{
          padding: collapsed ? '12px 0' : '12px 16px',
          borderTop: '1px solid #e8ecf1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 12
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#3b82f6', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14
          }}>👤</div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>张明</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>学生</div>
            </div>
          )}
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 顶部栏 */}
        <div style={{
          height: 56,
          background: '#fff',
          borderBottom: '1px solid #e8ecf1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px'
        }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#1e293b' }}>{titleMap[path.split('?')[0]]}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              📅 {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
            </span>
            <button onClick={logout} style={{ padding: '6px 16px', fontSize: 12, background: '#ef4444', borderRadius: 8 }}>
              退出登录
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20, background: '#f5f7fa' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  return isLoggedIn ? children : <Navigate to="/login" />
}

export default function App() {
  const [user, setUser] = useState({
    name: '张明',
    studentId: '2022105430066',
    college: '计算机与软件学院',
    major: '软件工程',
    avatar: '👤'
  })

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Layout><Home /></Layout></PrivateRoute>} />
          <Route path="/canvas" element={<PrivateRoute><Layout><Canvas /></Layout></PrivateRoute>} />
          <Route path="/center" element={<PrivateRoute><Layout><Center /></Layout></PrivateRoute>} />
          <Route path="/resources" element={<PrivateRoute><Layout><Resources /></Layout></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
        </Routes>
      </Router>
    </UserContext.Provider>
  )
}