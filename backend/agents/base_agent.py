import threading
from abc import ABC, abstractmethod
from typing import Any, Dict

from core.config import settings
from core.state import TaskState
from core.logger import logger
from services.external_services.llm_service import LLMService

_cancel_signals_lock = threading.Lock()
_global_cancel_signals: Dict[str, bool] = {}


class AgentBase(ABC):
    def __init__(self, name: str, role_prompt: str = ""):
        self.name = name
        self.role_prompt = role_prompt
        self._llm_provider = "spark"
        self._llm_model = settings.SPARK_MODEL_VERSION
        logger.info(f"[{self.name}] Agent初始化完成 (provider={self._llm_provider})")

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

    def call_llm(self, user_input: str, temperature: float = 0.7) -> str:
        try:
            messages = [
                {"role": "system", "content": self.role_prompt},
                {"role": "user", "content": user_input}
            ]
            return LLMService.chat(
                messages=messages,
                provider=self._llm_provider,
                model=self._llm_model,
                temperature=temperature,
            )
        except Exception as e:
            logger.error(f"[{self.name}] 大模型调用失败: {e}")
            return f"Error: {e}"

    @abstractmethod
    def run(self, state: TaskState) -> Dict[str, Any]:
        pass
