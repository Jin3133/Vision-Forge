// src/components/canvas/CanvasTopBar.jsx
// 画布顶栏：自动保存状态 + Undo/Redo + 版本/模板 按钮
import React from 'react';

const STATUS_TEXT = {
  idle:   { text: '空闲',     color: '#94a3b8', dot: '#cbd5e1' },
  saving: { text: '保存中…',  color: '#3b82f6', dot: '#3b82f6' },
  saved:  { text: '已保存',   color: '#10b981', dot: '#10b981' },
  error:  { text: '保存失败', color: '#ef4444', dot: '#ef4444' },
};

const fmtRel = (iso) => {
  if (!iso) return '尚未保存';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))} 秒前`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    return new Date(iso).toLocaleTimeString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
};

export function CanvasTopBar({
  autosaveStatus,
  lastSavedAt,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenVersions,
  onOpenTemplates,
  versionCount,
}) {
  const s = STATUS_TEXT[autosaveStatus] || STATUS_TEXT.idle;
  return (
    <div className="canvas-topbar">
      <div className="canvas-topbar-left">
        <button
          className="canvas-topbar-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="撤销 (Ctrl+Z)"
        >
          ↶ 撤销
        </button>
        <button
          className="canvas-topbar-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="重做 (Ctrl+Shift+Z)"
        >
          ↷ 重做
        </button>
        <div className="canvas-topbar-divider" />
        <button
          className="canvas-topbar-btn"
          onClick={onOpenTemplates}
          title="打开模板库"
        >
          📚 模板库
        </button>
        <button
          className="canvas-topbar-btn"
          onClick={onOpenVersions}
          title="查看历史版本"
        >
          🕘 版本记录
          {versionCount > 0 && (
            <span className="canvas-topbar-badge">{versionCount}</span>
          )}
        </button>
      </div>

      <div className="canvas-topbar-right">
        <span className="canvas-topbar-save" title={lastSavedAt || ''}>
          <span className="canvas-topbar-dot" style={{ background: s.dot }} />
          <span className="canvas-topbar-save-text" style={{ color: s.color }}>
            {autosaveStatus === 'saving' ? s.text : `自动保存 · ${fmtRel(lastSavedAt)}`}
          </span>
        </span>
      </div>
    </div>
  );
}