// src/components/chat/AgentStatusBar.jsx
import React from 'react';
import { STATUS, STATUS_LABEL } from './agentMock';

/**
 * 四智能体状态栏
 * Props:
 *   agents    - 当前 Agent 列表（来自 agentMock.js）
 *   compact   - 是否压缩模式（默认 false，4 列均分）
 *
 * 设计风格参考 Claude Code 的 sub-agent 运行状态：
 * - 横向 4 张卡片
 * - 每个 Agent：渐变头像 + 状态环（动画）+ 名称 + 状态徽标 + 当前消息 + 进度条
 * - 状态切换时整张卡片有 subtle 高亮动画
 */
export function AgentStatusBar({ agents = [], compact = false }) {
  const overall = computeOverall(agents);
  return (
    <div className="agent-bar">
      <div className="agent-bar-head">
        <div className="agent-bar-title">
          <span className="agent-bar-dot" data-state={overall} />
          <span>智能体协同</span>
          <span className="agent-bar-sub">{overallText(overall)}</span>
        </div>
        <div className="agent-bar-pipeline" aria-hidden="true">
          {agents.slice(0, -1).map((a, i) => {
            const next = agents[i + 1];
            const linkDone = a.status === STATUS.DONE && (next?.status === STATUS.DONE || next?.status === STATUS.RUNNING);
            const linkActive = a.status === STATUS.RUNNING || next?.status === STATUS.RUNNING;
            return (
              <span
                key={a.id + '->' + next.id}
                className={`agent-bar-link ${linkDone ? 'is-done' : ''} ${linkActive ? 'is-active' : ''}`}
              />
            );
          })}
        </div>
      </div>

      <div className={`agent-bar-grid ${compact ? 'is-compact' : ''}`}>
        {agents.map((a) => (
          <AgentCard key={a.id} agent={a} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ agent }) {
  const { status, progress, name, label, icon, gradient, color, message } = agent;
  return (
    <div className={`agent-card status-${status}`} data-agent={agent.id}>
      <div className="agent-card-avatar-wrap">
        <div className="agent-card-avatar" style={{ background: gradient }}>
          <span className="agent-card-avatar-icon">{icon}</span>
          {status === STATUS.RUNNING && <span className="agent-card-avatar-pulse" />}
          {status === STATUS.DONE && <span className="agent-card-avatar-check">✓</span>}
          {status === STATUS.FAILED && <span className="agent-card-avatar-cross">!</span>}
        </div>
        <StatusRing status={status} color={color} />
      </div>

      <div className="agent-card-meta">
        <div className="agent-card-row1">
          <span className="agent-card-name">{name}</span>
          <span className="agent-card-label">{label}</span>
        </div>
        <div className="agent-card-row2">
          <StatusBadge status={status} color={color} />
          <span className="agent-card-msg" title={message}>
            {status === STATUS.RUNNING && <span className="agent-card-spinner" aria-hidden="true" />}
            {message || STATUS_LABEL[status]}
          </span>
        </div>

        <div className="agent-card-progress">
          <div
            className="agent-card-progress-bar"
            style={{
              width: `${progress || 0}%`,
              background:
                status === STATUS.FAILED
                  ? 'linear-gradient(90deg, #fca5a5, #ef4444)'
                  : status === STATUS.DONE
                    ? `linear-gradient(90deg, ${color}, ${color}cc)`
                    : `linear-gradient(90deg, ${color}, ${color}80)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StatusRing({ status, color }) {
  if (status === STATUS.RUNNING) {
    return (
      <svg className="agent-card-ring is-spinning" viewBox="0 0 36 36">
        <circle className="ring-bg" cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
        <circle
          className="ring-fg"
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="70 30"
        />
      </svg>
    );
  }
  if (status === STATUS.DONE) {
    return (
      <svg className="agent-card-ring" viewBox="0 0 36 36">
        <circle className="ring-bg" cx="18" cy="18" r="15" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="2.5" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="2.5" />
      </svg>
    );
  }
  if (status === STATUS.FAILED) {
    return (
      <svg className="agent-card-ring" viewBox="0 0 36 36">
        <circle className="ring-bg" cx="18" cy="18" r="15" fill="none" stroke="#fecaca" strokeWidth="2.5" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="#ef4444" strokeWidth="2.5" />
      </svg>
    );
  }
  // idle / waiting
  return (
    <svg className="agent-card-ring" viewBox="0 0 36 36">
      <circle className="ring-bg" cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
    </svg>
  );
}

function StatusBadge({ status, color }) {
  const map = {
    [STATUS.IDLE]:    { label: '空闲',  cls: 'is-idle',    fg: '#94a3b8', bg: '#f1f5f9' },
    [STATUS.WAITING]: { label: '等待',  cls: 'is-waiting', fg: '#f59e0b', bg: '#fff7ed' },
    [STATUS.RUNNING]: { label: '执行中', cls: 'is-running', fg: color,    bg: hexToRgba(color, 0.12) },
    [STATUS.DONE]:    { label: '完成',  cls: 'is-done',    fg: '#10b981', bg: '#ecfdf5' },
    [STATUS.FAILED]:  { label: '失败',  cls: 'is-failed',  fg: '#ef4444', bg: '#fef2f2' },
  };
  const cfg = map[status] || map[STATUS.IDLE];
  return (
    <span className={`agent-status-badge ${cfg.cls}`} style={{ color: cfg.fg, background: cfg.bg }}>
      {status === STATUS.RUNNING && <span className="agent-status-dot" />}
      {cfg.label}
    </span>
  );
}

function computeOverall(agents) {
  if (agents.some((a) => a.status === STATUS.FAILED)) return 'failed';
  if (agents.some((a) => a.status === STATUS.RUNNING)) return 'running';
  if (agents.length && agents.every((a) => a.status === STATUS.DONE)) return 'done';
  if (agents.some((a) => a.status === STATUS.WAITING)) return 'waiting';
  return 'idle';
}

function overallText(s) {
  return {
    idle:    '待命中',
    waiting: '排队中',
    running: '协同中…',
    done:    '本轮已完成',
    failed:  '本轮异常终止',
  }[s];
}

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}