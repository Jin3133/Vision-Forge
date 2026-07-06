// src/components/resources/MarkdownPreview.jsx
// Markdown 预览/源码 切换
// preview: 复用 MarkdownCard（保留原有逻辑）
// source: 高亮 + 等宽字体 + 行号

import React, { useState } from 'react';

export function MarkdownPreview({ content, renderPreview }) {
  const [mode, setMode] = useState('preview'); // 'preview' | 'source'

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 500,
    }}>
      <div style={{
        padding: '6px 10px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <TabButton active={mode === 'preview'} onClick={() => setMode('preview')}>👁 预览</TabButton>
          <TabButton active={mode === 'source'} onClick={() => setMode('source')}>{'</>'} 源码</TabButton>
        </div>
        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
          {content.length} 字符 · {content.split('\n').length} 行
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {mode === 'preview'
          ? renderPreview?.(content)
          : <SourceView content={content} />
        }
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        background: active ? '#fff' : 'transparent',
        color: active ? '#3b82f6' : '#64748b',
        border: active ? '1px solid #bfdbfe' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'all .15s',
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}
    >{children}</button>
  );
}

function SourceView({ content }) {
  const lines = content.split('\n');
  return (
    <pre style={{
      margin: 0,
      padding: '12px 0',
      background: '#0f172a',
      color: '#e2e8f0',
      fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
      fontSize: 12.5,
      lineHeight: 1.7,
      overflow: 'auto',
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', paddingRight: 12 }}>
          <span style={{
            color: '#475569',
            display: 'inline-block',
            width: 40,
            textAlign: 'right',
            paddingRight: 12,
            marginRight: 12,
            borderRight: '1px solid #1e293b',
            userSelect: 'none',
            flexShrink: 0,
          }}>{i + 1}</span>
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1 }}>
            {line || ' '}
          </span>
        </div>
      ))}
    </pre>
  );
}