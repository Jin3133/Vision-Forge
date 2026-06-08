import threading
from abc import ABC, abstractmethod
from typing import Any, Dict
from openai import OpenAI

# 依然保留 settings，但我们不再用它读取 Key
from core.config import settings
from core.state import TaskState
from core.logger import logger

_cancel_signals_lock = threading.Lock()
_global_cancel_signals: Dict[str, bool] = {}


class AgentBase(ABC):
    def __init__(self, name: str, role_prompt: str = ""):
        self.name = name
        self.role_prompt = role_prompt

        # ✅ 终极大法：彻底绕过 settings，直接硬编码！
        # ⚠️ 请把下面引号里的内容替换为你 test_spark.py 中那串成功的完整 Key
        REAL_KEY = "7ba874a7eae6c25f2bae72e7eace2aba:NmFlMTlmMGMyMmVmNzNiMWUxZmJhNTVh"
        REAL_URL = "https://spark-api-open.xf-yun.com/v1"

        logger.info(f"[{self.name}] 正在初始化 OpenAI 客户端 (强制硬编码模式)...")

        # 强制使用硬编码的 Key，彻底无视环境变量
        self.llm_client = OpenAI(
            api_key=REAL_KEY,
            base_url=REAL_URL
        )

        self.model_version = "generalv3.5"

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

    def call_llm(self, user_input: str, temperature: float = 0.7) -> str:
        try:
            response = self.llm_client.chat.completions.create(
                model=self.model_version,
                messages=[
                    {"role": "system", "content": self.role_prompt},
                    {"role": "user", "content": user_input}
                ],
                temperature=temperature
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"[{self.name}] 大模型调用失败: {e}")
            return f"Error: {e}"

    @abstractmethod
    def run(self, state: TaskState) -> Dict[str, Any]:
        pass