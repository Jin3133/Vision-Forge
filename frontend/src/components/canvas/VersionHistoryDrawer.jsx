// src/components/canvas/VersionHistoryDrawer.jsx
// 版本记录：列出自动/手动保存的所有快照，支持回滚 + 删除
import React from 'react';

const fmtTime = (iso) => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
};

const REASON_LABEL = {
  manual: '手动',
  auto: '自动',
};

const REASON_COLOR = {
  manual: { bg: '#eff6ff', fg: '#3b82f6', icon: '💾' },
  auto:   { bg: '#f0fdf4', fg: '#10b981', icon: '⏱' },
};

export function VersionHistoryDrawer({ open, versions, onClose, onRestore, onRemove }) {
  if (!open) return null;

  return (
    <>
      <div onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.18)',
          zIndex: 1900, animation: 'vhFade .2s ease',
        }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '92vw',
        background: '#fff', zIndex: 1950,
        boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
        display: 'flex', flexDirection: 'column',
        animation: 'vhSlide .26s cubic-bezier(.2,.7,.3,1)',
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
        }}>
          <span style={{ fontSize: 22 }}>🕘</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>版本记录</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              共 {versions.length} 个历史版本 · 自动保存最近 20 个
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

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {versions.length === 0 ? (
            <div style={{
              padding: '60px 20px', textAlign: 'center', color: '#94a3b8',
              fontSize: 13,
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div>暂无版本记录</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>每次自动保存 / 手动保存都会留下快照</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {versions.map((v, i) => {
                const t = REASON_COLOR[v.reason] || REASON_COLOR.auto;
                return (
                  <div key={v.id}
                    style={{
                      background: '#fff', border: '1px solid #e2e8f0',
                      borderRadius: 10, padding: 12,
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 10.5, padding: '2px 8px', borderRadius: 999,
                          background: t.bg, color: t.fg, fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          {t.icon} {REASON_LABEL[v.reason] || v.reason}
                        </span>
                        {i === 0 && (
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                            background: '#fef3c7', color: '#b45309', fontWeight: 700,
                          }}>最新</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {fmtTime(v.savedAt)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 12, color: '#475569', marginBottom: 10,
                      display: 'flex', gap: 12,
                    }}>
                      <span>🔵 {v.nodeCount} 节点</span>
                      <span>🔗 {v.edgeCount} 连线</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => onRestore?.(v)}
                        style={{
                          flex: 1, padding: '7px 10px', borderRadius: 8,
                          border: 'none', background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                          color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}>↺ 恢复此版本</button>
                      <button onClick={() => onRemove?.(v.id)}
                        style={{
                          padding: '7px 12px', borderRadius: 8,
                          border: '1px solid #fecaca', background: '#fef2f2',
                          color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>删除</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes vhSlide {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes vhFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}