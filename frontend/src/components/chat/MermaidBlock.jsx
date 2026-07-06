// src/components/chat/MermaidBlock.jsx
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// 全局只初始化一次
let mermaidInitialized = false;
function ensureMermaidInit() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
    themeVariables: {
      primaryColor: '#dbeafe',
      primaryTextColor: '#1e293b',
      primaryBorderColor: '#3b82f6',
      lineColor: '#64748b',
      secondaryColor: '#f1f5f9',
      tertiaryColor: '#f8fafc',
    },
  });
  mermaidInitialized = true;
}

/**
 * Mermaid 流程图 / 时序图 / 甘特图 / 类图等
 * 用法：```mermaid ... ```
 */
export function MermaidBlock({ code }) {
  const containerRef = useRef(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        ensureMermaidInit();
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: rendered } = await mermaid.render(id, code || 'graph TD\n  A[暂无内容]');
        if (!cancelled) {
          setSvg(rendered);
          setError('');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || '流程图渲染失败');
          setSvg('');
        }
      }
    }
    render();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div className="md-mermaid">
      <div className="md-pre-header">
        <span>mermaid</span>
      </div>
      <div className="md-mermaid-body" ref={containerRef}>
        {error ? (
          <pre className="md-mermaid-error">{`mermaid 语法错误：\n${error}\n\n源码：\n${code}`}</pre>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        )}
      </div>
    </div>
  );
}