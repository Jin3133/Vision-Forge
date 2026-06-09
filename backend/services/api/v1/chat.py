import json
import httpx
from fastapi import APIRouter, HTTPException
from starlette.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Literal

# 核心导入
from core.config import settings
from core.logger import logger


# ==== 请求参数定义 ====
class Message(BaseModel):
    role: Literal["user", "assistant", "ai", "system"]
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: List[Message]


router = APIRouter()


# ==== 消息清洗工具函数 ====
def clean_messages(messages: List[Message]) -> List[dict]:
    cleaned = []
    for m in messages:
        if not m.content.strip():
            continue
        role = "assistant" if m.role == "ai" else m.role
        if role in {"user", "assistant", "system"}:
            cleaned.append({"role": role, "content": m.content.strip()})
    return cleaned


# ==== 主处理逻辑 ====
@router.post("/stream", summary="通用大模型 - 多轮流式通信接口")
async def chat_stream(data: ChatRequest):
    try:
        cleaned_messages = clean_messages(data.messages)
        if not cleaned_messages:
            raise HTTPException(status_code=400, detail="消息内容不能为空")

        model_type = data.model.lower()
        headers = {"Content-Type": "application/json"}

        # 定义请求体
        body = {"messages": cleaned_messages, "temperature": 0.7, "stream": True}

        # 路由分发与配置校验
        if model_type == "chatglm":
            url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
            headers["Authorization"] = f"Bearer {settings.CHATGLM_API_KEY}"
            body.update({"model": "chatglm_turbo"})

        elif model_type == "deepseek":
            url = "https://api.deepseek.com/v1/chat/completions"
            headers["Authorization"] = f"Bearer {settings.DEEPSEEK_API_KEY}"
            body.update({"model": "deepseek-v4-pro"})

        elif model_type == "kimi":
            url = "https://api.moonshot.cn/v1/chat/completions"
            headers["Authorization"] = f"Bearer {settings.KIMI_API_KEY}"
            body.update({"model": "moonshot-v1-8k"})

        else:
            raise HTTPException(status_code=400, detail="当前流式接口暂不支持该模型")

        # ✅ 修复：使用统一的 logger，便于在服务器后台追踪调用记录
        logger.info(f"[✅ 触发底层模型调用] Model: {model_type}")

        # ==== 流式输出封装 ====
        async def event_stream():
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, headers=headers, json=body) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            raw = line.removeprefix("data: ").strip()
                            if raw == "[DONE]":
                                break
                            try:
                                data_chunk = json.loads(raw)
                                # ✅ 增加健壮性：判断 choices 是否有值，防止偶发的空响应导致的崩溃
                                choices = data_chunk.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {}).get("content", "")
                                    if delta:
                                        yield delta
                            except Exception:
                                continue

        return StreamingResponse(event_stream(), media_type="text/plain")

    except Exception as e:
        logger.error(f"[❌ 模型调用失败] {str(e)}")
        raise HTTPException(status_code=500, detail=f"底层大模型请求失败：{str(e)}")