// src/components/chat/MarkdownRenderer.jsx
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import { MermaidBlock } from './MermaidBlock';

/**
 * AI 消息的 Markdown 渲染器
 * 支持：标题/列表/表格/行内代码/代码高亮/数学公式/Mermaid 流程图
 * 保持现代 AI SaaS 排版风格（参考 ChatGPT / Claude / DeepSeek）
 */
export function MarkdownRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          // 段落
          p: ({ children }) => <p className="md-p">{children}</p>,
          // 标题
          h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
          h4: ({ children }) => <h4 className="md-h4">{children}</h4>,
          // 列表
          ul: ({ children }) => <ul className="md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="md-ol">{children}</ol>,
          li: ({ children }) => <li className="md-li">{children}</li>,
          // 引用
          blockquote: ({ children }) => <blockquote className="md-quote">{children}</blockquote>,
          // 行内代码
          code: ({ inline, className, children }) => {
            if (inline) {
              return <code className="md-code-inline">{children}</code>;
            }
            return <code className={className}>{children}</code>;
          },
          // 代码块（由 pre 接管，注入 Mermaid / 复制按钮）
          pre: ({ children }) => {
            // 取出 code 的 className，识别语言
            const child = React.Children.toArray(children)[0];
            let lang = '';
            try {
              const className = child?.props?.className || '';
              const m = /language-([\w-]+)/.exec(className);
              if (m) lang = m[1];
            } catch (_) {}
            const rawText = extractText(children);

            if (lang === 'mermaid') {
              return <MermaidBlock code={rawText} />;
            }
            return (
              <div className="md-pre">
                <div className="md-pre-header">
                  <span>{lang || 'text'}</span>
                  <CopyButton text={rawText} />
                </div>
                <pre className={`md-pre-body language-${lang || 'plaintext'}`}>
                  <code className={`language-${lang || 'plaintext'}`}>{children}</code>
                </pre>
              </div>
            );
          },
          // 表格
          table: ({ children }) => <div className="md-table-wrap"><table className="md-table">{children}</table></div>,
          thead: ({ children }) => <thead className="md-thead">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th>{children}</th>,
          td: ({ children }) => <td>{children}</td>,
          // 链接
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">{children}</a>
          ),
          // 水平线
          hr: () => <hr className="md-hr" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// 把 react-markdown 给出的 code 节点递归拍平成纯文本
function extractText(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node?.props?.children) return extractText(node.props.children);
  return '';
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="md-copy-btn"
      onClick={() => {
        navigator.clipboard?.writeText(text || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? '✓ 已复制' : '📋 复制'}
    </button>
  );
}