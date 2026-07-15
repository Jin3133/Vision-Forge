// src/components/canvas/ToastStack.jsx
// 全局 Toast：右下角浮层，支持 success / info / warning / error
// 用法：
//   const { toasts, push, remove } = useToasts();
//   push({ type: 'success', title: '保存成功', detail: '...', duration: 2500 });
//
// 也可渲染静态：<ToastItem item={...} onClose={...} />

import React, { useCallback, useEffect, useRef, useState } from 'react';

let _id = 0;
const nextId = () => `t_${Date.now()}_${++_id}`;

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current[id];
    if (tm) {
      clearTimeout(tm);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback((toast) => {
    const id = nextId();
    const item = {
      id,
      type: 'info',
      duration: 2400,
      ...toast,
    };
    setToasts((prev) => [...prev, item]);
    if (item.duration > 0) {
      timers.current[id] = setTimeout(() => remove(id), item.duration);
    }
    return id;
  }, [remove]);

  return { toasts, push, remove };
}

const ICON = {
  success: '✅',
  info: '💡',
  warning: '⚠️',
  error: '❌',
};

const THEME = {
  success: { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', shadow: 'rgba(16,185,129,0.4)' },
  info:    { bg: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', shadow: 'rgba(59,130,246,0.4)' },
  warning: { bg: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', shadow: 'rgba(245,158,11,0.4)' },
  error:   { bg: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', shadow: 'rgba(239,68,68,0.4)' },
};

export function ToastItem({ item, onClose }) {
  const t = THEME[item.type] || THEME.info;
  const icon = item.icon || ICON[item.type] || '💡';
  return (
    <div
      role="status"
      style={{
        background: t.bg,
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 12,
        boxShadow: `0 10px 30px ${t.shadow}, 0 4px 12px rgba(0,0,0,0.12)`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        minWidth: 280,
        maxWidth: 380,
        animation: 'toastIn 0.25s cubic-bezier(.2,.7,.3,1.4)',
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.title}</div>
        {item.detail && (
          <div style={{ fontSize: 11.5, opacity: 0.95, marginTop: 2, lineHeight: 1.55 }}>
            {item.detail}
          </div>
        )}
      </div>
      <button
        onClick={() => onClose?.(item.id)}
        aria-label="关闭"
        style={{
          background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
          width: 22, height: 22, borderRadius: 11, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, lineHeight: 1, padding: 0, flexShrink: 0,
        }}
      >×</button>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(40px) scale(0.96); }
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
        right: 24,
        bottom: 24,
        zIndex: 2200,
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