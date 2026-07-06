// src/components/chat/chatService.js
// 与后端联调时的对接说明（保持原 /api/chat 接口名不变）：
//
// 1) 普通请求：POST /api/chat
//    body: { messages: [{role, content}], session_id? }
//    res : { content: string }   ← 现有后端契约（不要改）
//
// 2) 流式请求（推荐新增，SSE/ReadableStream）：
//    POST /api/chat/stream
//    body: { messages: [{role, content}], session_id? }
//    res : text/event-stream，事件类型：
//      - event: delta   data: {"content": "..."}      ← 增量片段
//      - event: thinking data: {"content": "..."}      ← 思考过程（可选）
//      - event: done    data: {}
//
// 联调开关：USE_MOCK_STREAM = false 时走真实 /api/chat/stream
//          当前默认 true，即本地 Mock 数据；后端就绪后改为 false 即可。

import { USE_MOCK_STREAM, mockStreamChat } from './chatMock';

const STREAM_ENDPOINT = '/api/chat/stream';
const FALLBACK_ENDPOINT = '/api/chat';

/**
 * 流式聊天（带思考过程 + 增量片段）
 * onDelta(content)         - 每次正文片段到来
 * onThinking(content)      - 每次思考片段到来
 * onDone(fullText)         - 正常结束
 * onError(err)             - 异常
 * abortSignal              - 外部传入的 AbortSignal（用于"停止生成"）
 *
 * 返回一个 abort() 方法，主动中断流。
 */
export async function streamChat(
  { messages, sessionId = 'default_session_01' },
  { onDelta, onThinking, onDone, onError, abortSignal } = {},
) {
  // —— Mock 模式（默认）——
  if (USE_MOCK_STREAM) {
    return mockStreamChat(
      { messages },
      { onDelta, onThinking, onDone, onError, abortSignal },
    );
  }

  // —— 真实后端流式 ——（后端就绪后启用）
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  abortSignal?.addEventListener?.('abort', onAbort);

  try {
    const resp = await fetch(STREAM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, session_id: sessionId }),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const obj = JSON.parse(payload);
          if (obj.content) onDelta?.(obj.content);
          if (obj.thinking) onThinking?.(obj.thinking);
        } catch (_) {}
      }
    }
    onDone?.();
  } catch (e) {
    if (e?.name !== 'AbortError') onError?.(e);
  } finally {
    abortSignal?.removeEventListener?.('abort', onAbort);
  }

  return {
    abort: () => ctrl.abort(),
  };
}

/**
 * 非流式回退（兼容原 /api/chat 契约 —— 不修改）
 * 在 streamChat 失败时自动降级到非流式。
 */
export async function plainChat({ messages, sessionId = 'default_session_01' }) {
  try {
    const resp = await fetch(FALLBACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, session_id: sessionId }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data?.content || '';
  } catch (e) {
    throw e;
  }
}