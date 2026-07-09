// src/components/profile/EditProfileModal.jsx
//
// 编辑资料弹窗 —— 头像 + 基础字段，全部 Mock 保存到本地状态
// 预留后端接口：PUT /api/profile

import { useState, useEffect, useRef } from 'react'

const AVATAR_OPTIONS = [
  '👤', '😀', '😎', '🤓', '🧑‍💻', '👨‍🎓', '👩‍🎓', '🦁',
  '🐯', '🚀', '🎨', '🎯', '⚡', '🌟', '🔥', '🤖',
]

/**
 * Props:
 *   open:    boolean
 *   onClose: () => void
 *   user:    当前用户对象
 *   onSave:  (nextUser) => void
 */
export default function EditProfileModal({ open, onClose, user, onSave }) {
  const [form, setForm] = useState(() => ({ ...user }))
  const [customUrl, setCustomUrl] = useState('')
  const [activeMode, setActiveMode] = useState('emoji') // 'emoji' | 'url'
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setForm({ ...user })
      setActiveMode('emoji')
      setCustomUrl('')
    }
  }, [open, user])

  if (!open) return null

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('avatar', reader.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    setSaving(true)
    /* 预留真接口：
       // ⬇️ PUT /api/profile → FastAPI 17077 端口（Vite /api 代理，见 vite.config.js）
       //    ⚠️ 后端端口提示：dev 环境走代理；prod 需反向代理指向 17077
       //    联调前确认后端 main.py 已启动并监听 17077
       await fetch('/api/profile', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(form),
       })
    */
    await new Promise((r) => setTimeout(r, 350)) // Mock 网络延迟
    onSave?.(form)
    setSaving(false)
    onClose?.()
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    border: '1px solid #e2e8f0', borderRadius: 10,
    fontSize: 13, color: '#1e293b', background: '#fff',
    outline: 'none', transition: 'border-color 0.15s',
  }

  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: '#475569',
    display: 'block', marginBottom: 6,
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.18s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto',
          background: '#fff', borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
          animation: 'slideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* 顶部条 */}
        <div style={{
          padding: '18px 22px 14px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
          borderRadius: '16px 16px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>✏️</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>编辑个人资料</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>头像与基础信息</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'transparent', border: 'none',
              color: '#64748b', cursor: 'pointer', fontSize: 16,
            }}
          >✕</button>
        </div>

        <div style={{ padding: 22 }}>
          {/* ── 头像选择 ── */}
          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle}>头像</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* 当前预览 */}
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: typeof form.avatar === 'string' && form.avatar.startsWith('data:') ? 0 : 30,
                color: '#fff', boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {typeof form.avatar === 'string' && form.avatar.startsWith('data:') ? (
                  <img src={form.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  form.avatar || '👤'
                )}
              </div>

              {/* 切换：Emoji / URL / 上传 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[
                    { key: 'emoji', label: 'Emoji', icon: '😀' },
                    { key: 'url',   label: 'URL',   icon: '🔗' },
                  ].map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setActiveMode(m.key)}
                      style={{
                        padding: '5px 12px', borderRadius: 8,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: '1px solid',
                        borderColor: activeMode === m.key ? '#3b82f6' : '#e2e8f0',
                        background: activeMode === m.key ? '#eff6ff' : '#fff',
                        color: activeMode === m.key ? '#3b82f6' : '#64748b',
                      }}
                    >{m.icon} {m.label}</button>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '5px 12px', borderRadius: 8,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: '1px solid #e2e8f0', background: '#fff', color: '#64748b',
                    }}
                  >📁 上传图片</button>
                  <input
                    ref={fileInputRef} type="file" accept="image/*"
                    onChange={handleAvatarFile} style={{ display: 'none' }}
                  />
                </div>

                {activeMode === 'emoji' ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {AVATAR_OPTIONS.map((a) => (
                      <button
                        key={a}
                        onClick={() => set('avatar', a)}
                        style={{
                          width: 34, height: 34, borderRadius: 8,
                          background: form.avatar === a ? '#3b82f6' : '#f8fafc',
                          border: '1px solid',
                          borderColor: form.avatar === a ? '#3b82f6' : '#e2e8f0',
                          cursor: 'pointer', fontSize: 18,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                      >{a}</button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="url"
                    placeholder="https://example.com/avatar.png"
                    value={customUrl}
                    onChange={(e) => {
                      setCustomUrl(e.target.value)
                      set('avatar', e.target.value)
                    }}
                    style={inputStyle}
                  />
                )}
              </div>
            </div>
          </div>

          {/* ── 字段表单 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>姓名</label>
              <input
                value={form.name || ''}
                onChange={(e) => set('name', e.target.value)}
                style={inputStyle}
                placeholder="请输入姓名"
              />
            </div>
            <div>
              <label style={labelStyle}>学号</label>
              <input
                value={form.studentId || ''}
                onChange={(e) => set('studentId', e.target.value)}
                style={inputStyle}
                placeholder="请输入学号"
              />
            </div>
            <div>
              <label style={labelStyle}>学院</label>
              <input
                value={form.college || ''}
                onChange={(e) => set('college', e.target.value)}
                style={inputStyle}
                placeholder="请输入学院"
              />
            </div>
            <div>
              <label style={labelStyle}>专业</label>
              <input
                value={form.major || ''}
                onChange={(e) => set('major', e.target.value)}
                style={inputStyle}
                placeholder="请输入专业"
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>个人简介</label>
              <textarea
                value={form.bio || ''}
                onChange={(e) => set('bio', e.target.value)}
                rows={3}
                placeholder="一句话介绍下自己吧～"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
              />
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          background: '#fafbfc', borderRadius: '0 0 16px 16px',
        }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0',
            cursor: 'pointer',
          }}>取消</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: saving
              ? '#93c5fd'
              : 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: '#fff', border: 'none',
            cursor: saving ? 'wait' : 'pointer',
            boxShadow: '0 4px 12px rgba(59,130,246,0.25)',
          }}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96) }
          to   { opacity: 1; transform: translateY(0)    scale(1) }
        }
      `}</style>
    </div>
  )
}