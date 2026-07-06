import { createContext, useContext, useState, useCallback, useEffect } from 'react'

/**
 * Toast —— 全局轻量提示
 *  - success / error / info / warning 四种类型
 *  - 自动消失（默认 3 秒）
 *  - 同一时刻最多展示 3 条
 *  - 通过 useToast() 调用 showToast(message, type)
 */

const ToastContext = createContext(null)

let _idSeed = 0
function nextId() {
  _idSeed += 1
  return `toast_${Date.now()}_${_idSeed}`
}

const TYPE_STYLE = {
  success: {
    bg: 'linear-gradient(135deg, #ecfdf5, #f0fdf4)',
    border: '#86efac',
    color: '#15803d',
    icon: '✅',
  },
  error: {
    bg: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
    border: '#fca5a5',
    color: '#b91c1c',
    icon: '❌',
  },
  info: {
    bg: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
    border: '#93c5fd',
    color: '#1d4ed8',
    icon: 'ℹ️',
  },
  warning: {
    bg: 'linear-gradient(135deg, #fffbeb, #fef9c3)',
    border: '#fcd34d',
    color: '#b45309',
    icon: '⚠️',
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = nextId()
    const item = { id, message, type }
    setToasts((prev) => [...prev.slice(-2), item])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const value = { showToast, dismiss, toasts }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast 容器：固定在视口顶部 */}
      <div
        style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10,
          pointerEvents: 'none', maxWidth: '92vw',
        }}
      >
        {toasts.map((t) => {
          const s = TYPE_STYLE[t.type] || TYPE_STYLE.info
          return (
            <div
              key={t.id}
              onClick={() => dismiss(t.id)}
              style={{
                pointerEvents: 'auto',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 12,
                background: s.bg, border: `1px solid ${s.border}`,
                color: s.color, fontSize: 13, fontWeight: 500,
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                animation: 'toastSlideIn 0.25s ease',
                minWidth: 240, maxWidth: 480,
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
              <span style={{ fontSize: 11, opacity: 0.6, flexShrink: 0 }}>×</span>
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    /* 容错：未挂载 Provider 时退化为 no-op，避免报错 */
    return {
      showToast: () => '',
      dismiss: () => {},
      toasts: [],
    }
  }
  return ctx
}