// src/components/resources/EmptyState.jsx
// 通用空状态：支持多种 variant（no-search / no-favorites / no-pack）

import React from 'react';

const VARIANT = {
  'no-search': {
    icon: '🔍',
    title: '没有找到匹配的资源',
    desc: '换个关键词试试，或清除分类筛选',
    action: null,
  },
  'no-favorites': {
    icon: '⭐',
    title: '暂无收藏资源',
    desc: '在「推荐资源」中点击星星图标收藏喜欢的内容',
    action: { label: '去浏览推荐资源 →', tab: 'recommend' },
  },
  'no-pack': {
    icon: '📦',
    title: '学习包未生成',
    desc: '一键生成后，AI 导师会围绕你的目标 + 当前阶段 + 易错点，组装一份端到端的学习包',
    action: null,
  },
  'ready': {
    icon: '🎯',
    title: '准备就绪',
    desc: '点击右上角「🎁 一键生成学习包」开始',
    action: null,
  },
};

export function EmptyState({ variant = 'no-search', onAction }) {
  const v = VARIANT[variant] || VARIANT['no-search'];
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '60px 40px',
      textAlign: 'center',
      color: '#94a3b8',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px', fontSize: 32,
      }}>{v.icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
        {v.title}
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: v.action ? 16 : 0, maxWidth: 320, margin: '0 auto 16px' }}>
        {v.desc}
      </div>
      {v.action && (
        <button
          onClick={() => onAction?.(v.action.tab)}
          style={{
            padding: '8px 18px', borderRadius: 10,
            border: '1px solid #e2e8f0',
            background: '#f8fafc', color: '#475569',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'all .15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#3b82f6';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = '#3b82f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f8fafc';
            e.currentTarget.style.color = '#475569';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >{v.action.label}</button>
      )}
    </div>
  );
}