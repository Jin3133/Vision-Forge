// src/components/chat/QuickQuestions.jsx
import React from 'react';

const ICONS = ['💡', '📝', '🧪', '🧠', '🔁', '🎯'];

/**
 * 快捷问题面板
 * 默认展示：
 *   继续解释 / 举例说明 / 生成练习 / 生成思维导图
 * 兼容老逻辑：sendQuestion(q)
 */
export function QuickQuestions({ onPick, extra = [] }) {
  const base = ['继续解释', '举例说明', '生成练习', '生成思维导图'];
  const list = [...base, ...extra];

  return (
    <div className="quick-questions">
      <div className="quick-questions-label">快捷问题</div>
      <div className="quick-questions-row">
        {list.map((q, i) => (
          <button
            key={q}
            className="quick-questions-chip"
            onClick={() => onPick?.(q)}
          >
            <span className="quick-questions-chip-icon">{ICONS[i % ICONS.length]}</span>
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}