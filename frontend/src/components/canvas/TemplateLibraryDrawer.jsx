// src/components/canvas/TemplateLibraryDrawer.jsx
// 模板库：一键加载预设的 nodes/edges
import React from 'react';
import { TEMPLATES } from './templates';

export function TemplateLibraryDrawer({ open, onClose, onPick }) {
  if (!open) return null;

  return (
    <>
      <div onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.18)',
          zIndex: 1900, animation: 'tlFade .2s ease',
        }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 460, maxWidth: '92vw',
        background: '#fff', zIndex: 1950,
        boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
        display: 'flex', flexDirection: 'column',
        animation: 'tlSlide .26s cubic-bezier(.2,.7,.3,1)',
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        }}>
          <span style={{ fontSize: 22 }}>📚</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>模板库</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {TEMPLATES.length} 个经典模板 · 一键加载到画布
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭"
            style={{
              background: '#fff', border: '1px solid #e2e8f0',
              width: 28, height: 28, borderRadius: 14,
              cursor: 'pointer', fontSize: 16, color: '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto', padding: 14,
          display: 'grid', gridTemplateColumns: '1fr', gap: 10,
        }}>
          {TEMPLATES.map((t) => (
            <div key={t.id}
              onClick={() => onPick?.(t)}
              style={{
                cursor: 'pointer',
                background: '#fff',
                border: `1px solid #e2e8f0`,
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all .15s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = t.color;
                e.currentTarget.style.boxShadow = `0 4px 14px ${t.color}22`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: `${t.color}1a`, color: t.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>{t.cover}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4 }}>
                  {t.desc}
                </div>
                <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                  {t.nodes.length} 节点 · {t.edges.length} 连线
                </div>
              </div>
              <button style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: t.color, color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>使用 →</button>
            </div>
          ))}
        </div>

        <div style={{
          padding: '10px 16px', borderTop: '1px solid #e2e8f0',
          fontSize: 11, color: '#94a3b8', background: '#f8fafc',
        }}>
          💡 加载模板会替换当前画布，已有节点会被覆盖。
        </div>
      </div>
      <style>{`
        @keyframes tlSlide {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes tlFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}