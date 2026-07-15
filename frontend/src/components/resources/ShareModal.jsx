// src/components/resources/ShareModal.jsx
// 分享弹窗：模拟生成可分享链接 + 复制

import React, { useEffect, useState } from 'react';

export function ShareModal({ open, onClose, title = '学习包', link }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const shareUrl = link || `https://vision-forge.example.com/share/${Date.now().toString(36)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const channels = [
    { key: 'wechat',  name: '微信',    icon: '💬', color: '#10b981' },
    { key: 'link',    name: '复制链接', icon: '🔗', color: '#3b82f6' },
    { key: 'email',   name: '邮件',    icon: '✉️', color: '#f59e0b' },
    { key: 'qrcode',  name: '二维码',  icon: '📱', color: '#8b5cf6' },
  ];

  return (
    <>
      <div onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
          zIndex: 2000, animation: 'shFade .2s ease',
        }} />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 380, maxWidth: '92vw',
        background: '#fff', borderRadius: 16, zIndex: 2050,
        boxShadow: '0 25px 60px rgba(15,23,42,0.3)',
        animation: 'shPop .26s cubic-bezier(.2,.7,.3,1.4)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>🔗</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>分享 · {title}</div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>把这份资源分享给同学 / 老师</div>
          </div>
          <button onClick={onClose} aria-label="关闭"
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
              width: 26, height: 26, borderRadius: 13, cursor: 'pointer',
              fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {channels.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  if (c.key === 'link') copyLink()
                  else if (c.key === 'qrcode') alert('二维码已生成（mock）')
                  else alert(`${c.name}分享（mock）`)
                }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 8px',
                  background: '#f8fafc',
                  border: `1px solid ${c.color}30`,
                  borderRadius: 12, cursor: 'pointer',
                  transition: 'all .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${c.color}30`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: c.color + '20', color: c.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>{c.icon}</span>
                <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{c.name}</span>
              </button>
            ))}
          </div>

          <div style={{
            padding: '10px 12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 2 }}>分享链接</div>
              <div style={{
                fontSize: 12, color: '#475569',
                fontFamily: '"JetBrains Mono", Consolas, monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{shareUrl}</div>
            </div>
            <button onClick={copyLink} style={{
              padding: '6px 12px', borderRadius: 8,
              border: 'none',
              background: copied ? '#10b981' : '#3b82f6',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'background .15s',
            }}>{copied ? '✓ 已复制' : '复制'}</button>
          </div>

          <div style={{
            marginTop: 12, fontSize: 10.5, color: '#94a3b8',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            🔒 该链接仅限有权限的用户访问 · 有效期 7 天
          </div>
        </div>
      </div>
      <style>{`
        @keyframes shPop {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.92); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes shFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}