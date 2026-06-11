// src/api.js

/**
 * 调用后端的对话与流程处理接口
 * 对应 FastAPI: POST /api/chat
 */
export const fetchPipelineResult = async (userIntent, sessionId = "default_session_01") => {
  try {
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