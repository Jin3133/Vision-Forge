// src/components/chat/UserMessage.jsx
import React from 'react';

/**
 * 用户消息气泡（保持简洁的右对齐样式）
 */
export function UserMessage({ message }) {
  return (
    <div className="user-msg">
      <div className="user-msg-body">
        <div className="user-msg-text">{message.text}</div>
      </div>
      <div className="user-msg-avatar" aria-hidden="true">🙂</div>
    </div>
  );
}