// src/components/resources/PdfPreviewModal.jsx
// PDF 预览 / 下载（mock）
// 思路：
//   - 不引入新依赖（如 jsPDF、html2canvas）
//   - 弹窗内展示"模拟 PDF 渲染"（A4 比例纸张 + 简化 Markdown 排版）
//   - 提供"下载 PDF（HTML）"按钮：实际下载一个带打印样式的 .html，
//     用户在浏览器打开后 Ctrl+P → 另存为 PDF；满足"下载 PDF"的体验

import React, { useEffect, useState } from 'react';

export function PdfPreviewModal({ open, onClose, title = '学习包', sections = [] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, sections.length);

  useEffect(() => { if (open) setPage(1); }, [open]);
  if (!open) return null;

  const current = sections[page - 1] || { name: '（空）', content: '' };

  const handleDownload = () => {
    // 用打印样式包裹，文件名以 .html 保存；用户打印为 PDF
    const html = buildPrintableHtml(title, sections);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `${title}-${stamp}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          zIndex: 2000, animation: 'pdfFade .2s ease',
        }} />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(900px, 94vw)',
        height: 'min(720px, 90vh)',
        background: '#f1f5f9', borderRadius: 14, zIndex: 2050,
        boxShadow: '0 30px 80px rgba(15,23,42,0.35)',
        display: 'flex', flexDirection: 'column',
        animation: 'pdfPop .26s cubic-bezier(.2,.7,.3,1.3)',
        overflow: 'hidden',
      }}>
        {/* 顶部工具栏 */}
        <div style={{
          padding: '10px 14px', background: '#0f172a', color: '#fff',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>📄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{title} · PDF 预览</div>
            <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 1 }}>
              模拟 PDF 渲染（mock）· 共 {totalPages} 节
            </div>
          </div>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            style={toolbarBtn}>←</button>
          <span style={{ fontSize: 12, color: '#cbd5e1', minWidth: 60, textAlign: 'center' }}>
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={toolbarBtn}>→</button>
          <button onClick={handleDownload} style={{
            ...toolbarBtn,
            background: '#10b981', color: '#fff', borderColor: '#10b981', fontWeight: 700,
          }}>⬇ 下载 PDF</button>
          <button onClick={onClose} aria-label="关闭"
            style={{ ...toolbarBtn, background: 'transparent', color: '#94a3b8' }}>×</button>
        </div>

        {/* PDF 纸张区域 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 595,                     // A4 @ 96dpi ~ 595 × 842
            minHeight: 720,
            background: '#fff',
            boxShadow: '0 6px 24px rgba(15,23,42,0.18)',
            padding: '48px 56px',
            fontSize: 13, lineHeight: 1.7, color: '#1e293b',
          }}>
            <div style={{
              borderBottom: '2px solid #1e293b',
              paddingBottom: 10, marginBottom: 18,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h1>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {new Date().toLocaleDateString('zh-CN')}
              </span>
            </div>
            <h2 style={{
              fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: '#3b82f6',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {current.name}
              <span style={{
                fontSize: 10.5, padding: '2px 8px', borderRadius: 6,
                background: '#eff6ff', color: '#3b82f6', fontWeight: 600,
              }}>第 {page} 节 / 共 {totalPages} 节</span>
            </h2>
            <PdfBody content={current.content} />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pdfPop {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes pdfFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}

const toolbarBtn = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.18)',
  color: '#e2e8f0',
  padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
  fontSize: 12, fontWeight: 600,
};

/** 简化版"打印用 Markdown → HTML" */
function PdfBody({ content }) {
  if (!content) return <div style={{ color: '#94a3b8' }}>（暂无内容）</div>;
  const lines = content.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('# '))      out.push(<h1 key={i} style={pdf.h1}>{line.slice(2)}</h1>);
    else if (line.startsWith('## ')) out.push(<h2 key={i} style={pdf.h2}>{line.slice(3)}</h2>);
    else if (line.startsWith('### '))out.push(<h3 key={i} style={pdf.h3}>{line.slice(4)}</h3>);
    else if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      let code = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code += lines[i] + '\n'; i++; }
      out.push(
        <pre key={`code-${i}`} style={pdf.pre}>
          {lang && <div style={pdf.codeHead}>{lang}</div>}
          <code style={pdf.code}>{code}</code>
        </pre>,
      );
    }
    else if (line.startsWith('> '))  out.push(<blockquote key={i} style={pdf.q}>{line.slice(2)}</blockquote>);
    else if (line.startsWith('- '))  out.push(<div key={i} style={pdf.li}>• {line.slice(2)}</div>);
    else if (/^\d+\.\s/.test(line))  out.push(<div key={i} style={pdf.li}>{line}</div>);
    else if (line.trim()) {
      const formatted = line.split(/(\*\*.*?\*\*)/).map((p, pi) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={pi}>{p.slice(2, -2)}</strong>
          : p,
      );
      out.push(<p key={i} style={pdf.p}>{formatted}</p>);
    }
    i++;
  }
  return <>{out}</>;
}

const pdf = {
  h1: { fontSize: 22, fontWeight: 700, margin: '20px 0 12px', color: '#0f172a' },
  h2: { fontSize: 18, fontWeight: 700, margin: '18px 0 10px', color: '#0f172a' },
  h3: { fontSize: 14, fontWeight: 700, margin: '14px 0 8px', color: '#334155' },
  p:  { margin: '6px 0', color: '#334155' },
  li: { paddingLeft: 8, margin: '3px 0', color: '#334155' },
  q:  {
    borderLeft: '3px solid #3b82f6', padding: '6px 12px',
    background: '#eff6ff', borderRadius: 6, margin: '8px 0',
    color: '#1e293b',
  },
  pre: {
    background: '#0f172a', color: '#e2e8f0',
    padding: 12, borderRadius: 6, margin: '10px 0',
    fontFamily: '"JetBrains Mono", Consolas, monospace',
    fontSize: 11.5, lineHeight: 1.6, overflow: 'auto',
  },
  codeHead: {
    color: '#94a3b8', fontSize: 10, marginBottom: 6, letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  code: { color: '#e2e8f0' },
};

/** 生成可打印 HTML（用户下载后浏览器打开 → Ctrl+P → 另存为 PDF） */
function buildPrintableHtml(title, sections) {
  const renderSection = (s) => `
    <section class="page">
      <h2>${escapeHtml(s.name || '')}</h2>
      <pre class="md">${escapeHtml(s.content || '')}</pre>
    </section>
  `;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #0f172a; }
  h1.cover { font-size: 26px; margin: 0 0 8px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
  section.page { page-break-after: always; padding-top: 8mm; }
  section.page h2 { font-size: 18px; border-left: 4px solid #3b82f6; padding-left: 10px; margin: 0 0 14px; }
  pre.md { white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 13px; line-height: 1.75; color: #334155; }
  .footer { color: #94a3b8; font-size: 10.5px; text-align: center; margin-top: 12mm; }
</style>
</head>
<body>
  <header>
    <h1 class="cover">${escapeHtml(title)}</h1>
    <div class="meta">由 Vision-Forge AI 学习平台生成 · ${new Date().toLocaleString('zh-CN')}</div>
  </header>
  ${sections.map(renderSection).join('\n')}
  <div class="footer">Vision-Forge · 打开后按 Ctrl/Cmd + P 即可另存为 PDF</div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}