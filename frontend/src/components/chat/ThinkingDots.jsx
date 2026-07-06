// src/components/chat/ThinkingDots.jsx
import React from 'react';

/**
 * AI 思考中动画（三点呼吸 + 文字）
 * 视觉风格：现代 AI SaaS（DeepSeek / ChatGPT 风格）
 */
export function ThinkingDots({ text = 'AI 正在思考' }) {
  return (
    <span className="thinking-dots" aria-label={text}>
      <span className="thinking-dots-text">{text}</span>
      <span className="thinking-dots-dots">
        <span /><span /><span />
      </span>
    </span>
  );
}

/**
 * 流式输出末尾的闪烁光标
 */
export function StreamCursor() {
  return <span className="stream-cursor" aria-hidden="true" />;
}