// src/components/resources/Toast.jsx
// 资源中心用轻量 Toast：右下角弹出，自动消失
// 不依赖任何外部库 / 上下文

import React, { useCallback, useEffect, useRef, useState } from 'react';

let _id = 0;
const nextId = () => `rt_${Date.now()}_${++_id}`;

const THEME = {
  success: { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', shadow: 'rgba(16,185,129,0.35)' },
  info:    { bg: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', shadow: 'rgba(59,130,246,0.35)' },
  warning: { bg: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', shadow: 'rgba(245,158,11,0.35)' },
  error:   { bg: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', shadow: 'rgba(239,68,68,0.35)' },
};

const ICON = {
  success: '✅', info: '💡', warning: '⚠️', error: '❌',
};

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current[id];
    if (tm) { clearTimeout(tm); delete timers.current[id]; }
  }, []);

  const push = useCallback((toast) => {
    const id = nextId();
    const item = { id, type: 'info', duration: 2200, ...toast };
    setToasts((prev) => [...prev, item]);
    if (item.duration > 0) {
      timers.current[id] = setTimeout(() => remove(id), item.duration);
    }
    return id;
  }, [remove]);

  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  }, []);

  return { toasts, push, remove };
}

export function ToastItem({ item, onClose }) {
  const t = THEME[item.type] || THEME.info;
  const icon = item.icon || ICON[item.type] || '💡';
  return (
    <div
      role="status"
      style={{
        background: t.bg,
        color: '#fff',
        padding: '10px 14px',
        borderRadius: 12,
        boxShadow: `0 10px 26px ${t.shadow}, 0 3px 10px rgba(0,0,0,0.1)`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        minWidth: 240,
        maxWidth: 360,
        animation: 'rtIn 0.22s cubic-bezier(.2,.7,.3,1.4)',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
        {item.detail && (
          <div style={{ fontSize: 11.5, opacity: 0.95, marginTop: 2, lineHeight: 1.55, wordBreak: 'break-word' }}>
            {item.detail}
          </div>
        )}
      </div>
      <button
        onClick={() => onClose?.(item.id)}
        aria-label="关闭"
        style={{
          background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
          width: 20, height: 20, borderRadius: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, lineHeight: 1, padding: 0, flexShrink: 0,
        }}
      >×</button>
      <style>{`
        @keyframes rtIn {
          from { opacity: 0; transform: translateX(36px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}

export function ToastStack({ toasts, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        right: 22,
        bottom: 22,
        zIndex: 2100,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem item={t} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}