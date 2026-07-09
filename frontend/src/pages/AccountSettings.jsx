/**
 * AccountSettings.jsx — 账户设置（修改密码 + 完善个人信息）
 *
 * 对应《使用手册》基本功能：
 *   - 修改密码：原密码、新密码、确认密码、提交后要求重新登录
 *   - 用户信息：用户名、姓名、用户身份、账户创建时间
 *
 * 设计：保持平台统一的"深蓝+浅灰+圆角"风格
 */

import { useState, useContext, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserContext } from '../App.jsx'

/* 8 个 emoji 头像（与 Profile 保持一致） */
const AVATAR_LIST = ['👤', '😀', '😎', '🤓', '🧑‍💻', '👨‍🎓', '🦁', '🚀', '🐯', '🌟']

/* 输入框统一样式（focus 高亮蓝，失焦还原） */
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

function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', marginBottom: 6, fontSize: 12,
        fontWeight: 500, color: '#334155',
      }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function StatusToast({ kind, message }) {
  if (!message) return null
  const palette = {
    success: { bg: '#f0fdf4', bd: '#bbf7d0', tx: '#15803d', icon: '✅' },
    error:   { bg: '#fef2f2', bd: '#fecaca', tx: '#dc2626', icon: '⚠️' },
    info:    { bg: '#eff6ff', bd: '#bfdbfe', tx: '#1d4ed8', icon: 'ℹ️' },
  }[kind] || { bg: '#f1f5f9', bd: '#e2e8f0', tx: '#475569', icon: 'ℹ️' }
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10,
      background: palette.bg, border: `1px solid ${palette.bd}`,
      color: palette.tx, fontSize: 13, fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span>{palette.icon}</span>
      <span>{message}</span>
    </div>
  )
}

export default function AccountSettings({ embedded = false, onClose }) {
  const { user, setUser } = useContext(UserContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'profile'
  const [tab, setTab] = useState(initialTab) // 'profile' | 'password' | 'security'

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'profile' || t === 'password' || t === 'security') setTab(t)
  }, [searchParams])

  const [profile, setProfile] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('vf_profile') || 'null')
      return cached || { ...user }
    } catch { return { ...user } }
  })

  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState({ kind: 'info', message: '' })
  const [pwdForm, setPwdForm] = useState({ old: '', next: '', confirm: '' })

  const accountCreatedAt = useMemo(() => {
    try {
      const ts = localStorage.getItem('vf_account_created_at')
      if (ts) return new Date(Number(ts)).toLocaleString('zh-CN')
      const now = Date.now()
      localStorage.setItem('vf_account_created_at', String(now))
      return new Date(now).toLocaleString('zh-CN')
    } catch { return '—' }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('vf_profile', JSON.stringify(profile)) } catch {}
  }, [profile])

  useEffect(() => {
    if (!toast.message) return
    const t = setTimeout(() => setToast({ kind: 'info', message: '' }), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const validateProfile = () => {
    const e = {}
    if (!profile.name?.trim()) e.name = '请输入姓名'
    else if (profile.name.length > 30) e.name = '姓名不能超过 30 字'
    if (!profile.studentId?.trim()) e.studentId = '请输入学号 / 工号'
    if (!profile.college?.trim()) e.college = '请输入学院 / 部门'
    if (!profile.major?.trim()) e.major = '请输入专业 / 岗位'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const saveProfile = () => {
    if (!validateProfile()) return
    setUser(profile)
    setToast({ kind: 'success', message: '个人信息已保存' })
  }

  const validatePwd = () => {
    const e = {}
    if (!pwdForm.old) e.old = '请输入原密码'
    if (!pwdForm.next) e.next = '请输入新密码'
    else if (pwdForm.next.length < 8) e.next = '新密码至少 8 位'
    else if (pwdForm.next === pwdForm.old) e.next = '新密码不能与原密码相同'
    if (!pwdForm.confirm) e.confirm = '请再次输入新密码'
    else if (pwdForm.confirm !== pwdForm.next) e.confirm = '两次输入的密码不一致'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submitPassword = () => {
    if (!validatePwd()) return
    try {
      const stored = JSON.parse(localStorage.getItem('vf_password') || 'null')
      const currentHash = stored?.hash || btoa('123456')
      if (btoa(pwdForm.old) !== currentHash) {
        setErrors({ old: '原密码不正确，默认密码为 123456' })
        return
      }
      localStorage.setItem('vf_password', JSON.stringify({
        hash: btoa(pwdForm.next),
        updatedAt: new Date().toISOString(),
      }))
      setToast({ kind: 'success', message: '密码修改成功，3 秒后将自动退出登录…' })
      setPwdForm({ old: '', next: '', confirm: '' })
      setTimeout(() => {
        localStorage.removeItem('isLoggedIn')
        window.location.hash = '#/login'
        window.location.reload()
      }, 3000)
    } catch (err) {
      setToast({ kind: 'error', message: '修改失败：' + (err.message || '未知错误') })
    }
  }

  return (
    <div style={{ maxWidth: embedded ? '100%' : 880, margin: '0 auto' }}>
      {!embedded && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>⚙️ 账户设置</h2>
          <p style={{ fontSize: 13, color: '#64748b' }}>管理个人信息、修改密码、查看账号安全</p>
        </div>
      )}

      <div style={{
        display: 'flex', gap: 8, marginBottom: 20,
        borderBottom: '1px solid #e8ecf1', paddingBottom: 12,
      }}>
        {[
          { id: 'profile', label: '👤 个人信息' },
          { id: 'password', label: '🔒 修改密码' },
          { id: 'security', label: '🛡️ 账号安全' },
        ].map(t => (
          <button key={t.id} onClick={() => {
            setTab(t.id); setErrors({}); setToast({ kind: 'info', message: '' })
            setSearchParams({ tab: t.id })
          }} style={{
            padding: '8px 18px', borderRadius: 20, fontSize: 13, border: 'none', cursor: 'pointer',
            background: tab === t.id ? '#3b82f6' : '#f1f5f9',
            color: tab === t.id ? '#fff' : '#64748b',
            fontWeight: tab === t.id ? 600 : 500,
            transition: 'all .2s',
          }}>{t.label}</button>
        ))}
      </div>

      {toast.message && (
        <div style={{ marginBottom: 16 }}>
          <StatusToast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div style={{
        background: '#fff', borderRadius: 12, padding: 28,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {tab === 'profile' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>完善你的基本信息</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>
              以下信息将显示在个人档案、学习报告、组卷关联等场景
            </p>

            <div style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, color: '#fff',
                boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
              }}>{profile.avatar || '👤'}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>选择头像</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 420 }}>
                  {AVATAR_LIST.map((a, i) => (
                    <div key={i} onClick={() => setProfile(p => ({ ...p, avatar: a }))} style={{
                      width: 36, height: 36, borderRadius: 9, cursor: 'pointer',
                      background: profile.avatar === a ? '#dbeafe' : '#f8fafc',
                      border: profile.avatar === a ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>{a}</div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="姓名" required>
                <input value={profile.name || ''} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  style={inputStyle(errors.name)}
                  placeholder="请输入真实姓名"
                  onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)' }}
                  onBlur={e => { if (!errors.name) { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' } }} />
                {errors.name && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>⚠️ {errors.name}</div>}
              </Field>
              <Field label="学号 / 工号" required>
                <input value={profile.studentId || ''} onChange={e => setProfile(p => ({ ...p, studentId: e.target.value }))}
                  style={inputStyle(errors.studentId)}
                  placeholder="例如：2022105430066" />
                {errors.studentId && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>⚠️ {errors.studentId}</div>}
              </Field>
              <Field label="学院 / 部门" required>
                <input value={profile.college || ''} onChange={e => setProfile(p => ({ ...p, college: e.target.value }))}
                  style={inputStyle(errors.college)}
                  placeholder="例如：计算机与软件学院" />
                {errors.college && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>⚠️ {errors.college}</div>}
              </Field>
              <Field label="专业 / 岗位" required>
                <input value={profile.major || ''} onChange={e => setProfile(p => ({ ...p, major: e.target.value }))}
                  style={inputStyle(errors.major)}
                  placeholder="例如：软件工程" />
                {errors.major && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>⚠️ {errors.major}</div>}
              </Field>
              <Field label="邮箱" hint="用于接收课程提醒与周报">
                <input value={profile.email || ''} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                  style={inputStyle(false)}
                  placeholder="example@school.edu.cn" />
              </Field>
              <Field label="手机号" hint="可用于找回密码">
                <input value={profile.phone || ''} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                  style={inputStyle(false)}
                  placeholder="选填" />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setProfile(user)} style={{
                padding: '10px 20px', borderRadius: 10, fontSize: 13,
                background: '#f1f5f9', color: '#475569',
                border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 500,
              }}>取消</button>
              <button onClick={saveProfile} style={{
                padding: '10px 20px', borderRadius: 10, fontSize: 13,
                background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600,
                boxShadow: '0 4px 12px -2px rgba(59,130,246,0.35)',
              }}>保存修改</button>
            </div>
          </div>
        )}

        {tab === 'password' && (
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>修改登录密码</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>
              修改成功后系统会要求你重新登录；首次登录的默认密码为 <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>123456</code>
            </p>

            <div style={{
              background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px',
              fontSize: 12, color: '#92400e', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>💡</span>
              <span>建议密码至少 8 位，包含大小写字母与数字；不要使用生日、手机号等简单组合。</span>
            </div>

            <Field label="原密码" required>
              <input type="password" value={pwdForm.old}
                onChange={e => setPwdForm(p => ({ ...p, old: e.target.value }))}
                style={inputStyle(errors.old)}
                placeholder="请输入当前密码" />
              {errors.old && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>⚠️ {errors.old}</div>}
            </Field>

            <Field label="新密码" required hint="至少 8 位，建议包含大小写字母与数字">
              <input type="password" value={pwdForm.next}
                onChange={e => setPwdForm(p => ({ ...p, next: e.target.value }))}
                style={inputStyle(errors.next)}
                placeholder="请输入新密码" />
              {errors.next && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>⚠️ {errors.next}</div>}
            </Field>

            <Field label="确认新密码" required>
              <input type="password" value={pwdForm.confirm}
                onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))}
                style={inputStyle(errors.confirm)}
                placeholder="请再次输入新密码" />
              {errors.confirm && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>⚠️ {errors.confirm}</div>}
            </Field>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setPwdForm({ old: '', next: '', confirm: '' })} style={{
                padding: '10px 20px', borderRadius: 10, fontSize: 13,
                background: '#f1f5f9', color: '#475569',
                border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 500,
              }}>清空</button>
              <button onClick={submitPassword} style={{
                padding: '10px 20px', borderRadius: 10, fontSize: 13,
                background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600,
                boxShadow: '0 4px 12px -2px rgba(59,130,246,0.35)',
              }}>提交修改</button>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 20px' }}>账号安全信息</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '🆔', label: '用户名', value: profile.username || user.name || 'demo_user', locked: true, note: '用户名一经创建不可修改' },
                { icon: '🛡️', label: '用户身份', value: '学生', locked: true, note: '由管理员维护，需要变更请联系管理员' },
                { icon: '📅', label: '账户创建时间', value: accountCreatedAt, locked: true, note: '账号首次登录时间' },
                { icon: '🔐', label: '密码最后修改时间', value: (() => { try { const s = JSON.parse(localStorage.getItem('vf_password') || 'null'); return s?.updatedAt ? new Date(s.updatedAt).toLocaleString('zh-CN') : '从未修改' } catch { return '从未修改' } })(), locked: true, note: '密码修改后请记得重新登录' },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9',
                }}>
                  <span style={{ fontSize: 24 }}>{row.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{row.label}</div>
                    <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, marginTop: 2 }}>{row.value}</div>
                    {row.note && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{row.note}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 20, padding: '14px 16px', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: 10,
              fontSize: 12, color: '#991b1b', lineHeight: 1.6,
            }}>
              <strong>⚠️ 注销账号</strong><br />
              注销后账号所有学习数据、上传资料、收藏内容将被永久清除且无法恢复。
              <div style={{ marginTop: 10 }}>
                <button onClick={() => {
                  if (window.confirm('确定要注销账号吗？此操作不可撤销！')) {
                    Object.keys(localStorage).filter(k => k.startsWith('vf_')).forEach(k => localStorage.removeItem(k))
                    localStorage.removeItem('isLoggedIn')
                    window.location.hash = '#/login'
                    window.location.reload()
                  }
                }} style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12,
                  background: '#ef4444', color: '#fff', border: 'none',
                  cursor: 'pointer', fontWeight: 600,
                }}>申请注销账号</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}