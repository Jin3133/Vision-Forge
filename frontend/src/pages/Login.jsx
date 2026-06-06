import { useState, useContext, useEffect } from 'react'
import { UserContext } from '../App'
import { useNavigate, Link } from 'react-router-dom'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState({})
  const { setUser } = useContext(UserContext)
  const navigate = useNavigate()

  /* 进入页面时回填记住的用户名 */
  useEffect(() => {
    const saved = localStorage.getItem('rememberUsername')
    if (saved) {
      setUsername(saved)
      setRememberMe(true)
    }
  }, [])

  const validate = () => {
    const newErrors = {}
    if (!username.trim()) newErrors.username = '请输入用户名'
    if (!password) newErrors.password = '请输入密码'
    else if (password.length < 6) newErrors.password = '密码至少 6 位'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const doLogin = (uname, pwd) => {
    setLoading(true)
    setTimeout(() => {
      localStorage.setItem('isLoggedIn', 'true')
      if (rememberMe || uname) {
        localStorage.setItem('rememberUsername', uname)
      } else {
        localStorage.removeItem('rememberUsername')
      }
      setUser({
        name: uname || '学习者',
        studentId: '2022105430066',
        college: '计算机与软件学院',
        major: '软件工程',
        avatar: '👤',
      })
      setLoading(false)
      navigate('/')
    }, 800)
  }

  const handleLogin = () => {
    if (!validate()) return
    doLogin(username, password)
  }

  /* 测试账号一键登录 */
  const handleDemoLogin = () => {
    setUsername('demo_user')
    setPassword('123456')
    setRememberMe(true)
    setErrors({})
    doLogin('demo_user', '123456')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 50%, #fdf2f8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 20px 60px -10px rgba(59, 130, 246, 0.18), 0 8px 24px -8px rgba(139, 92, 246, 0.12)',
          display: 'flex',
          overflow: 'hidden',
          minHeight: 540,
        }}
      >
        {/* ═══════════ 左侧品牌区 ═══════════ */}
        <div
          style={{
            width: '50%',
            background: 'linear-gradient(160deg, #eff6ff 0%, #ede9fe 50%, #fae8ff 100%)',
            padding: '36px 32px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 装饰光斑 */}
          <div style={{
            position: 'absolute', top: -80, right: -80, width: 240, height: 240,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, left: -60, width: 200, height: 200,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)',
          }} />

          {/* 顶部 chip */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 500,
                borderRadius: 999,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
              }}
            >
              <span>🎓</span>
              <span>AI Learning Platform</span>
            </div>
          </div>

          {/* 标题区 */}
          <div style={{ marginTop: 20, position: 'relative', zIndex: 1 }}>
            <h1
              style={{
                fontSize: 34,
                fontWeight: 800,
                color: '#1e293b',
                margin: 0,
                letterSpacing: '-0.5px',
                lineHeight: 1.1,
              }}
            >
              Vision-Forge
            </h1>
            <p
              style={{
                fontSize: 13,
                color: '#64748b',
                margin: '8px 0 0',
                fontWeight: 400,
              }}
            >
              多智能体学习平台
            </p>
            <div
              style={{
                width: 44,
                height: 3,
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                borderRadius: 2,
                marginTop: 10,
              }}
            />
          </div>

          {/* 大脑+人物插图卡片 */}
          <div
            style={{
              marginTop: 20,
              background: 'linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%)',
              borderRadius: 16,
              padding: '12px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 1,
              border: '1px solid rgba(255,255,255,0.6)',
            }}
          >
            <BrainIllustration />
          </div>

          {/* 三个特性 */}
          <div style={{ marginTop: 18, position: 'relative', zIndex: 1 }}>
            {[
              { icon: '🤖', text: 'AI驱动的个性化学习' },
              { icon: '🎨', text: '可视化模型搭建' },
              { icon: '📊', text: '智能学情分析' },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 4px',
                  fontSize: 13,
                  color: '#334155',
                  fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          {/* 底部版权 */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 20,
              fontSize: 11,
              color: '#94a3b8',
              position: 'relative',
              zIndex: 1,
            }}
          >
            © 2025 Vision-Forge
          </div>
        </div>

        {/* ═══════════ 右侧表单区 ═══════════ */}
        <div
          style={{
            width: '50%',
            padding: '40px 44px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: '#ffffff',
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#1e293b',
                margin: 0,
                letterSpacing: '-0.3px',
              }}
            >
              欢迎回来
            </h2>
            <p
              style={{
                fontSize: 13,
                color: '#94a3b8',
                margin: '6px 0 0',
              }}
            >
              登录你的 Vision-Forge 账号
            </p>
          </div>

          {/* 用户名 */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: 500,
                color: '#334155',
              }}
            >
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setErrors((p) => ({ ...p, username: '' }))
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="请输入用户名"
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 13,
                border: errors.username ? '1px solid #ef4444' : '1px solid #e2e8f0',
                borderRadius: 10,
                background: '#fafbfc',
                color: '#1e293b',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                if (!errors.username) {
                  e.target.style.borderColor = '#3b82f6'
                  e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'
                  e.target.style.background = '#fff'
                }
              }}
              onBlur={(e) => {
                if (!errors.username) {
                  e.target.style.borderColor = '#e2e8f0'
                  e.target.style.boxShadow = 'none'
                  e.target.style.background = '#fafbfc'
                }
              }}
            />
            {errors.username && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                ⚠️ {errors.username}
              </div>
            )}
          </div>

          {/* 密码 */}
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: 500,
                color: '#334155',
              }}
            >
              密码
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setErrors((p) => ({ ...p, password: '' }))
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="至少6位"
                style={{
                  width: '100%',
                  padding: '10px 38px 10px 14px',
                  fontSize: 13,
                  border: errors.password ? '1px solid #ef4444' : '1px solid #e2e8f0',
                  borderRadius: 10,
                  background: '#fafbfc',
                  color: '#1e293b',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  if (!errors.password) {
                    e.target.style.borderColor = '#3b82f6'
                    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'
                    e.target.style.background = '#fff'
                  }
                }}
                onBlur={(e) => {
                  if (!errors.password) {
                    e.target.style.borderColor = '#e2e8f0'
                    e.target.style.boxShadow = 'none'
                    e.target.style.background = '#fafbfc'
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                  color: '#94a3b8',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            {errors.password && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                ⚠️ {errors.password}
              </div>
            )}
          </div>

          {/* 记住我 + 找回密码 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: '#475569',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#3b82f6' }}
              />
              记住我
            </label>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                fontSize: 12,
                color: '#3b82f6',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              找回密码？
            </a>
          </div>

          {/* 登录按钮 */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 10,
              background: loading
                ? 'linear-gradient(90deg, #93c5fd, #c4b5fd)'
                : 'linear-gradient(90deg, #3b82f6, #6366f1)',
              color: '#fff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading
                ? 'none'
                : '0 6px 16px -2px rgba(59, 130, 246, 0.4)',
              letterSpacing: '3px',
            }}
          >
            {loading ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  letterSpacing: 0,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid #fff',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                登录中...
              </span>
            ) : (
              '登 录'
            )}
          </button>

          {/* 还没有账号 */}
          <div
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: '#64748b',
              marginTop: 14,
            }}
          >
            还没有账号？
            <Link
              to="/register"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              立即注册
            </Link>
          </div>

          {/* 快速体验分割线 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '16px 0 10px',
              color: '#cbd5e1',
              fontSize: 11,
            }}
          >
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ color: '#94a3b8' }}>快速体验</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          {/* 测试账号快速登录 */}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 10,
              background: '#f8fafc',
              color: '#475569',
              border: '1px solid #e2e8f0',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9'
              e.currentTarget.style.borderColor = '#cbd5e1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8fafc'
              e.currentTarget.style.borderColor = '#e2e8f0'
            }}
          >
            <span style={{ fontSize: 15 }}>⚡</span>
            <span>测试账号快速登录</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/* ═══════════ 大脑+人物插图（还原 Kimi 设计图风格） ═══════════ */
function BrainIllustration() {
  return (
    <svg
      width="200"
      height="170"
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 大脑渐变（蓝→紫，半透明云朵） */}
        <linearGradient id="brainBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#c7d2fe" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ddd6fe" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="brainInner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ede9fe" stopOpacity="0.95" />
        </linearGradient>
        {/* 立方体渐变 */}
        <linearGradient id="cubeTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#bfdbfe" />
        </linearGradient>
        <linearGradient id="cubeLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="cubeRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {/* ==== 装饰：左下角立方体 ==== */}
      <g transform="translate(20, 140)">
        <polygon points="0,8 14,0 28,8 14,16" fill="url(#cubeTop)" />
        <polygon points="0,8 0,28 14,36 14,16" fill="url(#cubeLeft)" />
        <polygon points="28,8 28,28 14,36 14,16" fill="url(#cubeRight)" />
      </g>

      {/* ==== 装饰：左上角小立方体 ==== */}
      <g transform="translate(45, 30) scale(0.7)">
        <polygon points="0,8 14,0 28,8 14,16" fill="url(#cubeTop)" />
        <polygon points="0,8 0,28 14,36 14,16" fill="url(#cubeLeft)" />
        <polygon points="28,8 28,28 14,36 14,16" fill="url(#cubeRight)" />
      </g>

      {/* ==== 装饰：右侧三角锥 ==== */}
      <g transform="translate(195, 35)">
        <polygon points="0,20 12,0 24,20" fill="#c7d2fe" />
        <polygon points="12,0 24,20 22,20" fill="#a5b4fc" />
        <polygon points="12,0 0,20 2,20" fill="#818cf8" />
      </g>

      {/* ==== 装饰：右下小三角 ==== */}
      <polygon points="200,150 212,135 218,152" fill="#a5b4fc" opacity="0.7" />

      {/* ==== 装饰：散落的圆点 ==== */}
      <circle cx="35" cy="80" r="2.5" fill="#60a5fa" opacity="0.7" />
      <circle cx="55" cy="110" r="1.5" fill="#3b82f6" opacity="0.6" />
      <circle cx="210" cy="90" r="2" fill="#a78bfa" opacity="0.7" />
      <circle cx="195" cy="125" r="1.5" fill="#8b5cf6" opacity="0.6" />
      <circle cx="25" cy="115" r="1.5" fill="#93c5fd" opacity="0.6" />
      <circle cx="220" cy="70" r="1.5" fill="#c4b5fd" opacity="0.6" />
      <circle cx="80" cy="25" r="1.5" fill="#a5b4fc" opacity="0.7" />
      <circle cx="175" cy="20" r="2" fill="#818cf8" opacity="0.6" />
      <circle cx="115" cy="20" r="1.5" fill="#60a5fa" opacity="0.6" />

      {/* ==== 装饰：十字星 ==== */}
      <g transform="translate(165, 55)" stroke="#a78bfa" strokeWidth="1.2" opacity="0.8">
        <line x1="-4" y1="0" x2="4" y2="0" />
        <line x1="0" y1="-4" x2="0" y2="4" />
      </g>
      <g transform="translate(30, 55)" stroke="#60a5fa" strokeWidth="1.2" opacity="0.8">
        <line x1="-3" y1="0" x2="3" y2="0" />
        <line x1="0" y1="-3" x2="0" y2="3" />
      </g>
      <g transform="translate(220, 115)" stroke="#c4b5fd" strokeWidth="1.2" opacity="0.8">
        <line x1="-3" y1="0" x2="3" y2="0" />
        <line x1="0" y1="-3" x2="0" y2="3" />
      </g>

      {/* ==== 核心：云朵状大脑（半透明+神经元网络） ==== */}
      {/* 大脑外轮廓（云朵状） */}
      <path
        d="M 70 50
           C 55 50, 50 65, 55 78
           C 45 82, 48 100, 62 102
           C 60 115, 75 122, 90 115
           C 95 125, 115 125, 120 115
           C 130 122, 145 118, 148 105
           C 165 105, 170 88, 160 80
           C 168 70, 162 55, 148 55
           C 145 42, 125 40, 118 50
           C 110 40, 90 40, 85 50
           C 80 48, 75 48, 70 50 Z"
        fill="url(#brainBlue)"
        stroke="#a5b4fc"
        strokeWidth="0.8"
        strokeOpacity="0.4"
      />

      {/* 大脑内部浅色背景 */}
      <path
        d="M 75 58
           C 65 58, 62 70, 66 80
           C 58 85, 60 98, 72 100
           C 70 110, 82 116, 94 110
           C 100 118, 115 118, 120 110
           C 128 116, 140 112, 142 102
           C 154 102, 158 90, 150 84
           C 156 76, 152 65, 142 65
           C 138 55, 124 54, 118 62
           C 110 54, 94 54, 90 62
           C 84 58, 80 58, 75 58 Z"
        fill="url(#brainInner)"
        opacity="0.6"
      />

      {/* 大脑内部神经元节点和连接线 */}
      <g stroke="#818cf8" strokeWidth="0.6" fill="none" opacity="0.7">
        <line x1="80" y1="70" x2="95" y2="75" />
        <line x1="95" y1="75" x2="110" y2="68" />
        <line x1="110" y1="68" x2="125" y2="72" />
        <line x1="125" y1="72" x2="138" y2="80" />
        <line x1="95" y1="75" x2="100" y2="92" />
        <line x1="110" y1="68" x2="115" y2="88" />
        <line x1="125" y1="72" x2="120" y2="92" />
        <line x1="100" y1="92" x2="115" y2="88" />
        <line x1="115" y1="88" x2="120" y2="92" />
        <line x1="100" y1="92" x2="108" y2="100" />
        <line x1="120" y1="92" x2="112" y2="100" />
      </g>
      <g fill="#6366f1" opacity="0.8">
        <circle cx="80" cy="70" r="2" />
        <circle cx="95" cy="75" r="2.5" />
        <circle cx="110" cy="68" r="2" />
        <circle cx="125" cy="72" r="2.5" />
        <circle cx="138" cy="80" r="2" />
        <circle cx="100" cy="92" r="2" />
        <circle cx="115" cy="88" r="3" />
        <circle cx="120" cy="92" r="2" />
        <circle cx="108" cy="100" r="2" />
        <circle cx="112" cy="100" r="2" />
      </g>

      {/* ==== 核心：盘腿而坐的学生（抱着平板） ==== */}
      <g transform="translate(85, 120)">
        {/* 双肩包（背后） */}
        <ellipse cx="35" cy="32" rx="14" ry="18" fill="#3b82f6" opacity="0.9" />
        <rect x="22" y="20" width="6" height="20" rx="2" fill="#1e40af" />
        <rect x="42" y="20" width="6" height="20" rx="2" fill="#1e40af" />

        {/* 头 */}
        <circle cx="35" cy="14" r="12" fill="#fcd9b6" />
        {/* 头发（深蓝） */}
        <path
          d="M 23 12 Q 23 2, 35 2 Q 47 2, 47 12 Q 47 9, 42 7 Q 38 5, 35 5 Q 32 5, 28 7 Q 23 9, 23 12 Z"
          fill="#1e293b"
        />
        {/* 脖子 */}
        <rect x="32" y="24" width="6" height="4" fill="#fcd9b6" />

        {/* 上身（浅蓝短袖） */}
        <path
          d="M 20 32 Q 20 28, 35 28 Q 50 28, 50 32 L 52 50 L 18 50 Z"
          fill="#93c5fd"
        />

        {/* 手臂（抱着平板） */}
        <path d="M 18 38 Q 12 44, 18 50 L 24 48 Q 22 42, 22 38 Z" fill="#93c5fd" />
        <path d="M 52 38 Q 58 44, 52 50 L 46 48 Q 48 42, 48 38 Z" fill="#93c5fd" />
        <ellipse cx="20" cy="50" rx="4" ry="3" fill="#fcd9b6" />
        <ellipse cx="50" cy="50" rx="4" ry="3" fill="#fcd9b6" />

        {/* 平板 */}
        <rect x="22" y="44" width="26" height="14" rx="2" fill="#1e293b" />
        <rect x="24" y="46" width="22" height="10" rx="1" fill="#60a5fa" />
        <rect x="26" y="48" width="6" height="1.5" fill="#fff" opacity="0.7" />
        <rect x="26" y="51" width="10" height="1" fill="#fff" opacity="0.5" />
        <rect x="26" y="53" width="8" height="1" fill="#fff" opacity="0.5" />

        {/* 腿（盘腿，深蓝长裤） */}
        <ellipse cx="20" cy="62" rx="11" ry="6" fill="#1e3a5f" />
        <ellipse cx="50" cy="62" rx="11" ry="6" fill="#1e3a5f" />
        <ellipse cx="35" cy="66" rx="18" ry="5" fill="#1e3a5f" />

        {/* 脚（运动鞋） */}
        <ellipse cx="14" cy="64" rx="6" ry="4" fill="#fff" />
        <ellipse cx="56" cy="64" rx="6" ry="4" fill="#fff" />
        <ellipse cx="14" cy="65" rx="6" ry="2" fill="#3b82f6" />
        <ellipse cx="56" cy="65" rx="6" ry="2" fill="#3b82f6" />
      </g>

      {/* ==== 装饰：连接线（思维发散） ==== */}
      <g stroke="#a5b4fc" strokeWidth="0.8" fill="none" opacity="0.5" strokeDasharray="2,2">
        <path d="M 60 90 Q 40 100, 30 130" />
        <path d="M 180 80 Q 200 90, 215 110" />
      </g>
    </svg>
  )
}
