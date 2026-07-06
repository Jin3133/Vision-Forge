// src/components/chat/AIMessage.jsx
import React, { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ThinkingDots, StreamCursor } from './ThinkingDots';

/**
 * 单条 AI 消息气泡
 *
 * Props:
 *   message        : { from, text, thinking?, feedback?, id }
 *   isStreaming    : 当前是否处于"流式输出中"
 *   onRegenerate   : () => void   —— 重新生成
 *   onStop         : () => void   —— 停止生成
 *   onFeedback     : ('up'|'down') => void
 *   onCopy         : () => void   —— 自定义复制回调（可选）
 */
export function AIMessage({ message, isStreaming, onRegenerate, onStop, onFeedback, onCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = stripMarkdown(message?.text || '');
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
    onCopy?.();
  };

  return (
    <div className="ai-msg">
      <div className="ai-msg-avatar" aria-hidden="true">🤖</div>
      <div className="ai-msg-body">
        {/* 思考过程（折叠式） */}
        {message?.thinking && (
          <details className="ai-msg-thinking" open>
            <summary>
              <span className="ai-msg-thinking-tag">思考过程</span>
              <span className="ai-msg-thinking-preview">
                {oneLine(message.thinking)}
              </span>
            </summary>
            <div className="ai-msg-thinking-content">
              <MarkdownRenderer content={message.thinking} />
            </div>
          </details>
        )}

        {/* 思考动画：尚未产生任何正文时 */}
        {!message?.text && isStreaming && (
          <div className="ai-msg-text">
            <ThinkingDots text="AI 正在思考" />
          </div>
        )}

        {/* 正式回答 */}
        {message?.text && (
          <div className="ai-msg-text">
            <MarkdownRenderer content={message.text} />
            {isStreaming && <StreamCursor />}
          </div>
        )}

        {/* 操作栏 */}
        {!isStreaming && message?.text && (
          <div className="ai-msg-actions">
            <button
              className={`ai-msg-action ${message.feedback === 'up' ? 'is-active' : ''}`}
              onClick={() => onFeedback?.('up')}
              title="有帮助"
            >👍 赞</button>
            <button
              className={`ai-msg-action ${message.feedback === 'down' ? 'is-active' : ''}`}
              onClick={() => onFeedback?.('down')}
              title="没帮助"
            >👎 踩</button>
            <button className="ai-msg-action" onClick={handleCopy}>
              {copied ? '✓ 已复制' : '📋 复制'}
            </button>
            <button className="ai-msg-action" onClick={onRegenerate}>
              🔁 重新生成
            </button>
          </div>
        )}

        {/* 生成中：停止按钮 */}
        {isStreaming && (
          <div className="ai-msg-actions">
            <button className="ai-msg-action is-danger" onClick={onStop}>
              ⏹ 停止生成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 简易去 Markdown 标记，用于"复制纯文本"
function stripMarkdown(md = '') {
  return md
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-zA-Z]*\n?|```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\$\$[\s\S]*?\$\$/g, (b) => b.replace(/\$\$|\n/g, ''))
    .replace(/\$([^$]+)\$/g, '$1')
    .trim();
}

function oneLine(s = '') {
  return s.replace(/\s+/g, ' ').slice(0, 80);
}