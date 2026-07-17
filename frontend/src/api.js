// src/api.js

/**
 * 调用后端 SSE 流式接口
 * 对应 FastAPI: POST /api/chat (text/event-stream)
 *
 * ⚠️ 后端端口提示：
 *    - dev 环境走 Vite 代理（vite.config.js → /api → http://127.0.0.1:17077）
 *    - 生产环境需确保反向代理把 /api 转发到 FastAPI 17077 端口
 *    - 联调前请确认后端 main.py 已启动并监听 17077
 *
 * @param {string} userIntent - 用户输入
 * @param {string} sessionId - 会话ID
 * @param {object} callbacks - 回调函数 { onStage, onContent, onDone, onError }
 * @returns {AbortController} 用于取消请求
 */
export const fetchPipelineStream = (userIntent, sessionId, callbacks = {}) => {
  if (!sessionId) {
    sessionId = localStorage.getItem('vf_session_id') || 'session_' + Date.now().toString(36)
    localStorage.setItem('vf_session_id', sessionId)
  }
  const { onStage, onContent, onDone, onError } = callbacks;
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_intent: userIntent,
          session_id: sessionId
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 事件（以 \n\n 分隔）
        const parts = buffer.split('\n\n');
        // 最后一个可能不完整，保留在 buffer
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                switch (event.event) {
                  case 'stage':
                    onStage?.(event);
                    break;
                  case 'content':
                    onContent?.(event);
                    break;
                  case 'navigate':
                    onNavigate?.(event);
                    break;
                  case 'done':
                    onDone?.(event);
                    break;
                  case 'error':
                    onError?.(event);
                    break;
                }
              } catch (_) {
                // 忽略 JSON 解析错误
              }
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("SSE 流式调用失败:", error);
        onError?.({ event: 'error', message: error.message, agent: 'network' });
      }
    }
  })();

  return controller;
};

/**
 * 【已废弃】旧的阻塞式 API 调用 —— 保留以兼容旧代码
 * 新代码请使用 fetchPipelineStream
 */
export const fetchPipelineResult = async (userIntent, sessionId = "default_session_01") => {
  console.warn('[api.js] fetchPipelineResult 已废弃，请迁移到 fetchPipelineStream');
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_intent: userIntent, session_id: sessionId })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const json = await response.json();
    return json;
  } catch (error) {
    console.error("API调用崩溃:", error);
    throw error;
  }
};

// ==================== 学习讲义 API ====================

/**
 * 为指定 session 生成学习讲义（调用后端 Generator 智能体 + 存入数据库）
 * POST /api/learning-materials/generate
 */
export const generateLearningMaterial = async (sessionId, title = null) => {
  const res = await fetch('/api/learning-materials/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, title }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
};

/**
 * 获取讲义列表（可选 session_id 过滤）
 * GET /api/learning-materials
 */
export const fetchLearningMaterials = async (sessionId = null) => {
  const params = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
  const res = await fetch(`/api/learning-materials${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * 获取单条讲义完整内容
 * GET /api/learning-materials/{id}
 */
export const fetchLearningMaterialById = async (id) => {
  const res = await fetch(`/api/learning-materials/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * 删除讲义
 * DELETE /api/learning-materials/{id}
 */
export const deleteLearningMaterial = async (id) => {
  const res = await fetch(`/api/learning-materials/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};