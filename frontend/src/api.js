// src/api.js

/**
 * 调用后端的对话与流程处理接口
 * 对应 FastAPI: POST /api/chat
 *
 * ⚠️ 后端端口提示：
 *    - dev 环境走 Vite 代理（vite.config.js → /api → http://127.0.0.1:17077）
 *    - 生产环境需确保反向代理把 /api 转发到 FastAPI 17077 端口
 *    - 联调前请确认后端 main.py 已启动并监听 17077
 */
export const fetchPipelineResult = async (userIntent, sessionId = "default_session_01") => {
  try {
    // ⬇️ 真实后端调用：POST /api/chat → FastAPI 17077（走 Vite /api 代理）
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // 严格对齐 main.py 中的 ChatRequest
      body: JSON.stringify({ 
        user_intent: userIntent,
        session_id: sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    return json;
  } catch (error) {
    console.error("API调用崩溃:", error);
    throw error;
  }
};