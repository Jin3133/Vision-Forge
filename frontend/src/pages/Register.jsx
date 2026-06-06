import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function Register() {
  const [form, setForm] = useState({
    realName: '',
    username: '',
    password: '',
    confirmPassword: '',
    studentId: '',
    major: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const navigate = useNavigate()

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const getPasswordStrength = (pwd) => {
    if (!pwd) return 0
    let score = 0
    if (pwd.length >= 6) score++
    if (pwd.length >= 10) score++
    if (/[a-zA-Z]/.test(pwd) && /\d/.test(pwd)) score++
    if (/[^a-zA-Z0-9]/.test(pwd)) score++
    return score
  }

  const strengthLabels = ['', '弱', '中', '强', '极强']
  const strengthColors = ['', '#ef4444', '#f59e0b', '#22c55e', '#10b981']
  const strengthWidths = ['0%', '25%', '50%', '75%', '100%']

  const strength = getPasswordStrength(form.password)

  const validate = () => {
    const newErrors = {}
    if (!form.realName.trim()) newErrors.realName = '请输入真实姓名'
    if (!form.username.trim()) newErrors.username = '请输入用户名'
    else if (form.username.length < 3) newErrors.username = '用户名至少 3 位'

    if (!form.password) newErrors.password = '请输入密码'
    else if (form.password.length < 6) newErrors.password = '密码至少 6 位'

    if (!form.confirmPassword) newErrors.confirmPassword = '请确认密码'
    else if (form.password !== form.confirmPassword) newErrors.confirmPassword = '两次输入的密码不一致'

    if (!form.studentId.trim()) newErrors.studentId = '请输入学号'
    if (!form.major.trim()) newErrors.major = '请输入所学专业'

    if (!agreed) newErrors.agreed = '请先同意用户协议'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleRegister = () => {
    if (!validate()) return
    setLoading(true)
    setTimeout(() => {
      /* 写入登录态并跳转到登录页 */
      localStorage.setItem('registeredUser', JSON.stringify({
        realName: form.realName,
        username: form.username,
        studentId: form.studentId,
        major: form.major,
      }))
      setLoading(false)
      navigate('/login')
    }, 900)
  }

  /* 输入框统一样式 */
  const inputStyle = (hasError) => ({
    width: '100%',
    padding: '9px 12px',
    fontSize: 13,
    border: hasError ? '1px solid #ef4444' : '1px solid #e2e8f0',
    borderRadius: 8,
    background: '#fafbfc',
    color: '#1e293b',
    outline: 'none',
    transition: 'all 0.2s',
    boxSizing: 'border-box',
  })

  const focusIn = (e) => {
    e.target.style.borderColor = '#3b82f6'
    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'
    e.target.style.background = '#fff'
  }
  const focusOut = (e) => {
    e.target.style.borderColor = '#e2e8f0'
    e.target.style.boxShadow = 'none'
    e.target.style.background = '#fafbfc'
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
          boxShadow: '0 20px 60px -10px rgba(139, 92, 246, 0.18), 0 8px 24px -8px rgba(59, 130, 246, 0.12)',
          display: 'flex',
          overflow: 'hidden',
          minHeight: 560,
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
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 500,
                borderRadius: 999,
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
              }}
            >
              <span>🚀</span>
              <span>开启学习之旅</span>
            </div>
          </div>

          {/* 标题 */}
          <div style={{ marginTop: 20, position: 'relative', zIndex: 1 }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: '#1e293b',
                margin: 0,
                letterSpacing: '-0.5px',
                lineHeight: 1.15,
              }}
            >
              加入 Vision-Forge
            </h1>
            <p
              style={{
                fontSize: 13,
                color: '#64748b',
                margin: '8px 0 0',
                fontWeight: 400,
              }}
            >
              与万千学习者一起探索AI世界
            </p>
            <div
              style={{
                width: 44,
                height: 3,
                background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
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

          {/* 数据统计 */}
          <div style={{ marginTop: 18, position: 'relative', zIndex: 1 }}>
            {[
              { num: '10,000+', label: '注册学员' },
              { num: '200+', label: '精品课程' },
              { num: '50+', label: 'AI模型' },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  padding: '4px 4px',
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#1e293b',
                    letterSpacing: '-0.5px',
                  }}
                >
                  {item.num}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{item.label}</span>
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
            padding: '36px 40px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: '#ffffff',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#1e293b',
                margin: 0,
                letterSpacing: '-0.3px',
              }}
            >
              创建账号
            </h2>
            <p
              style={{
                fontSize: 12,
                color: '#94a3b8',
                margin: '6px 0 0',
              }}
            >
              填写以下信息，开启AI学习之旅
            </p>
          </div>

          {/* 两列：姓名 / 用户名 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#334155' }}>
                姓名 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={form.realName}
                onChange={(e) => updateField('realName', e.target.value)}
                placeholder="真实姓名"
                style={inputStyle(errors.realName)}
                onFocus={focusIn}
                onBlur={focusOut}
              />
              {errors.realName && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>⚠️ {errors.realName}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#334155' }}>
                用户名 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                placeholder="3位以上"
                style={inputStyle(errors.username)}
                onFocus={focusIn}
                onBlur={focusOut}
              />
              {errors.username && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>⚠️ {errors.username}</div>}
            </div>
          </div>

          {/* 两列：密码 / 确认密码 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#334155' }}>
                密码 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  placeholder="至少6位"
                  style={{ ...inputStyle(errors.password), paddingRight: 34 }}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                    color: '#94a3b8', padding: 4,
                  }}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              {errors.password && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>⚠️ {errors.password}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#334155' }}>
                确认密码 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  placeholder="再次输入"
                  style={{ ...inputStyle(errors.confirmPassword), paddingRight: 34 }}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                    color: '#94a3b8', padding: 4,
                  }}
                >
                  {showConfirm ? '🙈' : '👁'}
                </button>
              </div>
              {errors.confirmPassword && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>⚠️ {errors.confirmPassword}</div>}
            </div>
          </div>

          {/* 密码强度 */}
          {form.password && (
            <div style={{ marginTop: -4, marginBottom: 10 }}>
              <div style={{ height: 3, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: strengthWidths[strength],
                  background: strengthColors[strength],
                  borderRadius: 2,
                  transition: 'all 0.3s',
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                marginTop: 3,
                color: strengthColors[strength],
                fontWeight: 500,
              }}>
                <span>密码强度：{strengthLabels[strength]}</span>
                <span style={{ color: '#94a3b8' }}>{form.password.length} 字符</span>
              </div>
            </div>
          )}

          {/* 两列：学号 / 专业 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#334155' }}>
                学号 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={form.studentId}
                onChange={(e) => updateField('studentId', e.target.value)}
                placeholder="你的学号"
                style={inputStyle(errors.studentId)}
                onFocus={focusIn}
                onBlur={focusOut}
              />
              {errors.studentId && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>⚠️ {errors.studentId}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#334155' }}>
                专业 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={form.major}
                onChange={(e) => updateField('major', e.target.value)}
                placeholder="所学专业"
                style={inputStyle(errors.major)}
                onFocus={focusIn}
                onBlur={focusOut}
              />
              {errors.major && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>⚠️ {errors.major}</div>}
            </div>
          </div>

          {/* 用户协议 */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              fontSize: 12,
              color: '#475569',
              cursor: 'pointer',
              marginBottom: 12,
              userSelect: 'none',
              lineHeight: 1.4,
            }}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked)
                setErrors((p) => ({ ...p, agreed: '' }))
              }}
              style={{ marginTop: 2, cursor: 'pointer', accentColor: '#3b82f6' }}
            />
            <span>
              我已阅读并同意
              <a href="#" onClick={(e) => e.preventDefault()} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>《用户服务协议》</a>
              和
              <a href="#" onClick={(e) => e.preventDefault()} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>《隐私政策》</a>
            </span>
          </label>
          {errors.agreed && <div style={{ fontSize: 11, color: '#ef4444', marginTop: -8, marginBottom: 8 }}>⚠️ {errors.agreed}</div>}

          {/* 创建账号按钮 */}
          <button
            onClick={handleRegister}
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 10,
              background: loading
                ? 'linear-gradient(90deg, #c4b5fd, #f9a8d4)'
                : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              color: '#fff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 6px 16px -2px rgba(139, 92, 246, 0.4)',
              letterSpacing: '2px',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: 0 }}>
                <span style={{
                  width: 16, height: 16,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid #fff',
                  borderRadius: '50%', display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }} />
                创建中...
              </span>
            ) : (
              '创建账号'
            )}
          </button>

          {/* 已有账号 */}
          <div
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: '#64748b',
              marginTop: 14,
            }}
          >
            已有账号？
            <Link
              to="/login"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              立即登录
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/* ═══════════ 大脑+人物插图（还原 Kimi 设计图风格 — 注册页紫粉调） ═══════════ */
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
        <linearGradient id="brainPurple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#ddd6fe" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#f5d0fe" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="brainPurpleInner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fae8ff" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="cubeTopP" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="100%" stopColor="#ddd6fe" />
        </linearGradient>
        <linearGradient id="cubeLeftP" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="cubeRightP" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      {/* ==== 装饰：左下角立方体 ==== */}
      <g transform="translate(20, 140)">
        <polygon points="0,8 14,0 28,8 14,16" fill="url(#cubeTopP)" />
        <polygon points="0,8 0,28 14,36 14,16" fill="url(#cubeLeftP)" />
        <polygon points="28,8 28,28 14,36 14,16" fill="url(#cubeRightP)" />
      </g>

      {/* ==== 装饰：左上角小立方体 ==== */}
      <g transform="translate(45, 30) scale(0.7)">
        <polygon points="0,8 14,0 28,8 14,16" fill="url(#cubeTopP)" />
        <polygon points="0,8 0,28 14,36 14,16" fill="url(#cubeLeftP)" />
        <polygon points="28,8 28,28 14,36 14,16" fill="url(#cubeRightP)" />
      </g>

      {/* ==== 装饰：右侧三角锥 ==== */}
      <g transform="translate(195, 35)">
        <polygon points="0,20 12,0 24,20" fill="#ddd6fe" />
        <polygon points="12,0 24,20 22,20" fill="#c4b5fd" />
        <polygon points="12,0 0,20 2,20" fill="#a78bfa" />
      </g>

      {/* ==== 装饰：右下小三角 ==== */}
      <polygon points="200,150 212,135 218,152" fill="#c4b5fd" opacity="0.7" />

      {/* ==== 装饰：散落的圆点 ==== */}
      <circle cx="35" cy="80" r="2.5" fill="#a78bfa" opacity="0.7" />
      <circle cx="55" cy="110" r="1.5" fill="#8b5cf6" opacity="0.6" />
      <circle cx="210" cy="90" r="2" fill="#d8b4fe" opacity="0.7" />
      <circle cx="195" cy="125" r="1.5" fill="#c084fc" opacity="0.6" />
      <circle cx="25" cy="115" r="1.5" fill="#c4b5fd" opacity="0.6" />
      <circle cx="220" cy="70" r="1.5" fill="#e9d5ff" opacity="0.7" />
      <circle cx="80" cy="25" r="1.5" fill="#c4b5fd" opacity="0.7" />
      <circle cx="175" cy="20" r="2" fill="#a78bfa" opacity="0.6" />
      <circle cx="115" cy="20" r="1.5" fill="#8b5cf6" opacity="0.6" />

      {/* ==== 装饰：十字星（白色） ==== */}
      <g transform="translate(165, 55)" stroke="#fff" strokeWidth="1.2" opacity="0.9">
        <line x1="-4" y1="0" x2="4" y2="0" />
        <line x1="0" y1="-4" x2="0" y2="4" />
      </g>
      <g transform="translate(30, 55)" stroke="#fff" strokeWidth="1.2" opacity="0.9">
        <line x1="-3" y1="0" x2="3" y2="0" />
        <line x1="0" y1="-3" x2="0" y2="3" />
      </g>
      <g transform="translate(220, 115)" stroke="#fff" strokeWidth="1.2" opacity="0.9">
        <line x1="-3" y1="0" x2="3" y2="0" />
        <line x1="0" y1="-3" x2="0" y2="3" />
      </g>
      <g transform="translate(100, 18)" stroke="#a78bfa" strokeWidth="1" opacity="0.7">
        <line x1="-3" y1="0" x2="3" y2="0" />
        <line x1="0" y1="-3" x2="0" y2="3" />
      </g>

      {/* ==== 核心：云朵状大脑（半透明+神经元网络 — 紫粉调） ==== */}
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
        fill="url(#brainPurple)"
        stroke="#c4b5fd"
        strokeWidth="0.8"
        strokeOpacity="0.4"
      />

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
        fill="url(#brainPurpleInner)"
        opacity="0.6"
      />

      {/* 神经元节点（紫粉） */}
      <g stroke="#a855f7" strokeWidth="0.6" fill="none" opacity="0.7">
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
      <g fill="#8b5cf6" opacity="0.85">
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

      {/* ==== 核心：盘腿而坐的学生（连帽卫衣+双肩包） ==== */}
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

        {/* 上身（深蓝连帽卫衣） */}
        <path
          d="M 18 32 Q 18 28, 35 28 Q 52 28, 52 32 L 54 50 L 16 50 Z"
          fill="#1e3a5f"
        />
        {/* 帽子（连帽） */}
        <path
          d="M 26 28 Q 28 24, 35 24 Q 42 24, 44 28 L 44 32 L 26 32 Z"
          fill="#1e293b"
        />

        {/* 手臂（抱着平板） */}
        <path d="M 16 38 Q 10 44, 16 50 L 22 48 Q 20 42, 20 38 Z" fill="#1e3a5f" />
        <path d="M 54 38 Q 60 44, 54 50 L 48 48 Q 50 42, 50 38 Z" fill="#1e3a5f" />
        <ellipse cx="18" cy="50" rx="4" ry="3" fill="#fcd9b6" />
        <ellipse cx="52" cy="50" rx="4" ry="3" fill="#fcd9b6" />

        {/* 平板 */}
        <rect x="22" y="44" width="26" height="14" rx="2" fill="#0f172a" />
        <rect x="24" y="46" width="22" height="10" rx="1" fill="#8b5cf6" />
        <rect x="26" y="48" width="6" height="1.5" fill="#fff" opacity="0.7" />
        <rect x="26" y="51" width="10" height="1" fill="#fff" opacity="0.5" />
        <rect x="26" y="53" width="8" height="1" fill="#fff" opacity="0.5" />

        {/* 腿（盘腿，深灰长裤） */}
        <ellipse cx="20" cy="62" rx="11" ry="6" fill="#374151" />
        <ellipse cx="50" cy="62" rx="11" ry="6" fill="#374151" />
        <ellipse cx="35" cy="66" rx="18" ry="5" fill="#374151" />

        {/* 脚（蓝白运动鞋） */}
        <ellipse cx="14" cy="64" rx="6" ry="4" fill="#fff" />
        <ellipse cx="56" cy="64" rx="6" ry="4" fill="#fff" />
        <ellipse cx="14" cy="65" rx="6" ry="2" fill="#3b82f6" />
        <ellipse cx="56" cy="65" rx="6" ry="2" fill="#3b82f6" />
        <line x1="14" y1="63" x2="14" y2="67" stroke="#1e40af" strokeWidth="0.8" />
        <line x1="56" y1="63" x2="56" y2="67" stroke="#1e40af" strokeWidth="0.8" />
      </g>

      {/* ==== 装饰：连接线（思维发散） ==== */}
      <g stroke="#c4b5fd" strokeWidth="0.8" fill="none" opacity="0.5" strokeDasharray="2,2">
        <path d="M 60 90 Q 40 100, 30 130" />
        <path d="M 180 80 Q 200 90, 215 110" />
      </g>
    </svg>
  )
}
