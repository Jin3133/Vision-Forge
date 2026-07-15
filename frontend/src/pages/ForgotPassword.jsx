import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'

/**
 * ForgotPassword —— 重置密码（Mock）
 * 三步：
 *  ① 输入用户名 + 邮箱 → 发送验证码（Mock：固定 888888）
 *  ② 输入 6 位验证码 + 新密码 + 确认密码 → 提交
 *  ③ 成功 → 跳回 /login
 */

export default function ForgotPassword() {
  const navigate = useNavigate()
  const { resetPassword, sendCode } = useAuth()
  const { showToast } = useToast()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    username: '',
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(0)

  /* 倒计时 */
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const update = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => ({ ...p, [k]: '' }))
  }

  /* 步骤 1：发送验证码 */
  const handleSendCode = async () => {
    const newErrors = {}
    if (!form.username.trim()) newErrors.username = '请输入用户名'
    if (!form.email.trim()) newErrors.email = '请输入注册邮箱'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = '邮箱格式不正确'
    }
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setSending(true)
    try {
      const resp = await sendCode({ username: form.username, email: form.email })
      if (resp.code === 200) {
        showToast(resp.message, 'success', 4000)
        setCountdown(60)
        setStep(2)
      } else {
        showToast(resp.message, 'error', 3000)
      }
    } catch (e) {
      showToast('验证码发送失败，请稍后重试', 'error')
    } finally {
      setSending(false)
    }
  }

  /* 步骤 2：提交重置 */
  const handleSubmit = async () => {
    const newErrors = {}
    if (!form.code.trim()) newErrors.code = '请输入验证码'
    else if (form.code.length !== 6) newErrors.code = '验证码为 6 位'

    if (!form.newPassword) newErrors.newPassword = '请输入新密码'
    else if (form.newPassword.length < 6) newErrors.newPassword = '新密码至少 6 位'

    if (!form.confirmPassword) newErrors.confirmPassword = '请再次输入新密码'
    else if (form.newPassword !== form.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致'
    }
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setSubmitting(true)
    try {
      const resp = await resetPassword({
        username: form.username,
        code: form.code,
        newPassword: form.newPassword,
      })
      if (resp.code === 200) {
        showToast('密码重置成功，请使用新密码登录', 'success', 2500)
        setTimeout(() => navigate('/login'), 800)
      } else {
        showToast(resp.message, 'error', 3000)
      }
    } catch (e) {
      showToast('重置失败，请稍后重试', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  /* 密码强度 */
  const getStrength = (pwd) => {
    if (!pwd) return 0
    let s = 0
    if (pwd.length >= 6) s++
    if (pwd.length >= 10) s++
    if (/[a-zA-Z]/.test(pwd) && /\d/.test(pwd)) s++
    if (/[^a-zA-Z0-9]/.test(pwd)) s++
    return s
  }
  const strength = getStrength(form.newPassword)
  const sLabels = ['', '弱', '中', '强', '极强']
  const sColors = ['', '#ef4444', '#f59e0b', '#22c55e', '#10b981']
  const sWidths = ['0%', '25%', '50%', '75%', '100%']

  const inputStyle = (hasError) => ({
    width: '100%',
    padding: '10px 14px',
    fontSize: 13,
    border: hasError ? '1px solid #ef4444' : '1px solid #e2e8f0',
    borderRadius: 10,
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 480,
          background: '#ffffff', borderRadius: 20,
          boxShadow: '0 20px 60px -10px rgba(59, 130, 246, 0.18), 0 8px 24px -8px rgba(139, 92, 246, 0.12)',
          padding: '36px 36px 28px',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* 装饰光斑 */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 180, height: 180,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* 顶部：返回 + 标题 */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: '#64748b', textDecoration: 'none',
              marginBottom: 16, fontWeight: 500,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
          >
            <span>←</span>
            <span>返回登录</span>
          </Link>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 999,
            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
            color: '#b45309', fontSize: 11, fontWeight: 600,
            marginBottom: 14,
          }}>
            <span>🔒</span>
            <span>密码重置</span>
          </div>

          <h2 style={{
            fontSize: 22, fontWeight: 700, color: '#1e293b',
            margin: 0, letterSpacing: '-0.3px',
          }}>
            找回你的密码
          </h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0' }}>
            {step === 1 ? '填写账号信息，我们会把验证码发到你的邮箱' : '输入验证码并设置新密码'}
          </p>
        </div>

        {/* 步骤指示 */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', gap: 8,
          margin: '20px 0 22px',
        }}>
          {[1, 2].map((n) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: n === 1 ? 1 : 0 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: step >= n
                  ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                  : '#f1f5f9',
                color: step >= n ? '#fff' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                boxShadow: step >= n ? '0 4px 10px rgba(59,130,246,0.3)' : 'none',
                transition: 'all 0.2s',
              }}>{step > n ? '✓' : n}</div>
              <span style={{
                fontSize: 12, fontWeight: 500,
                color: step >= n ? '#1e293b' : '#94a3b8',
              }}>{n === 1 ? '验证账号' : '重置密码'}</span>
              {n === 1 && (
                <div style={{
                  flex: 1, height: 2, marginLeft: 4,
                  background: step >= 2
                    ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)'
                    : '#e2e8f0',
                  borderRadius: 1, transition: 'all 0.3s',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* 表单 */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {step === 1 && (
            <>
              {/* 用户名 */}
              <div style={{ marginBottom: 14 }}>
                <label style={{
                  display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#334155',
                }}>用户名</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => update('username', e.target.value)}
                  placeholder="请输入用户名"
                  style={inputStyle(errors.username)}
                  onFocus={focusIn} onBlur={focusOut}
                />
                {errors.username && (
                  <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                    ⚠️ {errors.username}
                  </div>
                )}
              </div>

              {/* 邮箱 */}
              <div style={{ marginBottom: 18 }}>
                <label style={{
                  display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#334155',
                }}>注册邮箱</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle(errors.email)}
                  onFocus={focusIn} onBlur={focusOut}
                />
                {errors.email && (
                  <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                    ⚠️ {errors.email}
                  </div>
                )}
              </div>

              <button
                onClick={handleSendCode}
                disabled={sending}
                style={{
                  width: '100%', padding: '11px', fontSize: 14, fontWeight: 600,
                  borderRadius: 10, color: '#fff', border: 'none',
                  background: sending
                    ? 'linear-gradient(90deg, #93c5fd, #c4b5fd)'
                    : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  boxShadow: sending ? 'none' : '0 6px 16px -2px rgba(59,130,246,0.4)',
                  transition: 'all 0.2s',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {sending ? (
                  <>
                    <span style={{
                      width: 14, height: 14,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid #fff', borderRadius: '50%',
                      display: 'inline-block', animation: 'spin 0.8s linear infinite',
                    }} />
                    <span>发送中...</span>
                  </>
                ) : (
                  <>
                    <span>📨</span>
                    <span>发送验证码</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {/* 验证码 */}
              <div style={{ marginBottom: 14 }}>
                <label style={{
                  display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#334155',
                }}>验证码</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => update('code', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6 位验证码"
                    style={{ ...inputStyle(errors.code), flex: 1, letterSpacing: 4, fontSize: 16, textAlign: 'center', fontWeight: 600 }}
                    onFocus={focusIn} onBlur={focusOut}
                    maxLength={6}
                  />
                  <button
                    onClick={handleSendCode}
                    disabled={sending || countdown > 0}
                    style={{
                      padding: '0 14px', fontSize: 12, fontWeight: 500,
                      borderRadius: 10, border: '1px solid #e2e8f0',
                      background: countdown > 0 ? '#f1f5f9' : '#fff',
                      color: countdown > 0 ? '#94a3b8' : '#3b82f6',
                      cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap', transition: 'all 0.2s',
                    }}
                  >
                    {countdown > 0 ? `${countdown}s 后重发` : '重新发送'}
                  </button>
                </div>
                {errors.code && (
                  <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                    ⚠️ {errors.code}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                  💡 Mock 演示验证码：<strong style={{ color: '#3b82f6', letterSpacing: 2 }}>888888</strong>
                </div>
              </div>

              {/* 新密码 */}
              <div style={{ marginBottom: 10 }}>
                <label style={{
                  display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#334155',
                }}>新密码</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.newPassword}
                    onChange={(e) => update('newPassword', e.target.value)}
                    placeholder="至少 6 位"
                    style={{ ...inputStyle(errors.newPassword), paddingRight: 38 }}
                    onFocus={focusIn} onBlur={focusOut}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 14, color: '#94a3b8', padding: 4,
                    }}
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
                {errors.newPassword && (
                  <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                    ⚠️ {errors.newPassword}
                  </div>
                )}
              </div>

              {/* 密码强度 */}
              {form.newPassword && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ height: 3, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: sWidths[strength],
                      background: sColors[strength], borderRadius: 2,
                      transition: 'all 0.3s',
                    }} />
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 10, marginTop: 4, color: sColors[strength], fontWeight: 500,
                  }}>
                    <span>密码强度：{sLabels[strength]}</span>
                    <span style={{ color: '#94a3b8' }}>{form.newPassword.length} 字符</span>
                  </div>
                </div>
              )}

              {/* 确认密码 */}
              <div style={{ marginBottom: 18 }}>
                <label style={{
                  display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#334155',
                }}>确认新密码</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  placeholder="再次输入新密码"
                  style={inputStyle(errors.confirmPassword)}
                  onFocus={focusIn} onBlur={focusOut}
                />
                {errors.confirmPassword && (
                  <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                    ⚠️ {errors.confirmPassword}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    flex: 1, padding: '11px', fontSize: 14, fontWeight: 500,
                    borderRadius: 10, background: '#f1f5f9', color: '#475569',
                    border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                >
                  上一步
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    flex: 2, padding: '11px', fontSize: 14, fontWeight: 600,
                    borderRadius: 10, color: '#fff', border: 'none',
                    background: submitting
                      ? 'linear-gradient(90deg, #93c5fd, #c4b5fd)'
                      : 'linear-gradient(90deg, #10b981, #059669)',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: submitting ? 'none' : '0 6px 16px -2px rgba(16,185,129,0.4)',
                    transition: 'all 0.2s',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {submitting ? (
                    <>
                      <span style={{
                        width: 14, height: 14,
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid #fff', borderRadius: '50%',
                        display: 'inline-block', animation: 'spin 0.8s linear infinite',
                      }} />
                      <span>提交中...</span>
                    </>
                  ) : (
                    <>
                      <span>🔐</span>
                      <span>确认重置</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 底部链接 */}
        <div style={{
          textAlign: 'center', fontSize: 13, color: '#64748b',
          marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9',
          position: 'relative', zIndex: 1,
        }}>
          想起密码了？
          <Link
            to="/login"
            style={{
              color: '#3b82f6', textDecoration: 'none', fontWeight: 600, marginLeft: 4,
            }}
          >
            立即登录
          </Link>
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