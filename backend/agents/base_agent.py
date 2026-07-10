import threading
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from openai import OpenAI

from core.config import settings
from core.state import TaskState
from core.logger import logger

_cancel_signals_lock = threading.Lock()
_global_cancel_signals: Dict[str, bool] = {}


class AgentBase(ABC):
    def __init__(self, name: str, role_prompt: str = ""):
        self.name = name
        self.role_prompt = role_prompt

        # ✅ 统一从 settings(.env) 读取凭证，不再硬编码
        api_key = settings.OPENAI_API_KEY
        base_url = settings.OPENAI_API_BASE
        if not api_key:
            logger.warning(
                f"[{self.name}] 未检测到 OPENAI_API_KEY，请在 .env 中配置，否则 LLM 调用将失败"
            )

        logger.info(f"[{self.name}] 正在初始化 LLM 客户端 (base_url={base_url})...")
        self.llm_client = OpenAI(api_key=api_key, base_url=base_url)
        self.model_version = settings.SPARK_MODEL_VERSION
        self.max_retries = settings.LLM_MAX_RETRIES

    # ... (read_blackboard, get_session_id 等方法保持不变) ...

    def read_blackboard(self, state: TaskState, key: str) -> Any:
        value = getattr(state, key, None)
        return value

    def get_session_id(self, state: TaskState) -> str:
        return state.session_id

    def is_session_cancelled(self, state: TaskState) -> bool:
        session_id = self.get_session_id(state)
        with _cancel_signals_lock:
            return _global_cancel_signals.get(session_id, False)

    @classmethod
    def cancel_session(cls, session_id: str) -> None:
        with _cancel_signals_lock:
            _global_cancel_signals[session_id] = True

    @classmethod
    def reset_session_cancel(cls, session_id: str) -> None:
        with _cancel_signals_lock:
            _global_cancel_signals.pop(session_id, None)

    def call_llm(
        self,
        user_input: str,
        temperature: float = 0.7,
        json_mode: bool = False,
        system_prompt: Optional[str] = None,
    ) -> str:
        """调用大模型。

        json_mode=True 时优先请求服务端返回严格 JSON；若上游不支持该参数则自动回退到普通模式。
        失败会按 settings.LLM_MAX_RETRIES 重试（指数退避）。
        """
        messages = [
            {"role": "system", "content": system_prompt or self.role_prompt},
            {"role": "user", "content": user_input},
        ]

        last_err: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                kwargs: Dict[str, Any] = {
                    "model": self.model_version,
                    "messages": messages,
                    "temperature": temperature,
                }
                if json_mode:
                    kwargs["response_format"] = {"type": "json_object"}

                try:
                    response = self.llm_client.chat.completions.create(**kwargs)
                except Exception as fmt_err:
                    # 上游(如星火某些版本)可能不认 response_format，去掉后再试一次
                    if json_mode:
                        logger.warning(
                            f"[{self.name}] json_mode 不被支持，回退普通模式: {fmt_err}"
                        )
                        kwargs.pop("response_format", None)
                        response = self.llm_client.chat.completions.create(**kwargs)
                    else:
                        raise

                return response.choices[0].message.content
            except Exception as e:
                last_err = e
                wait = 1.5 * (attempt + 1)
                logger.error(
                    f"[{self.name}] 大模型调用失败(第 {attempt + 1}/{self.max_retries + 1} 次): {e}"
                )
                if attempt < self.max_retries:
                    time.sleep(wait)

        logger.error(f"[{self.name}] 大模型调用重试耗尽，放弃。最后错误: {last_err}")
        return f"Error: {last_err}"

    @abstractmethod
    def run(self, state: TaskState) -> Dict[str, Any]:
        pass