import os
import threading
from abc import ABC, abstractmethod
from typing import Any, Dict
from openai import OpenAI
from dotenv import load_dotenv

from core.state import TaskState
from core.logger import logger

load_dotenv()

# 💡 修复：使用全局字典 + 线程锁（Lock），确保跨线程读写的绝对安全
_cancel_signals_lock = threading.Lock()
_global_cancel_signals: Dict[str, bool] = {}


class AgentBase(ABC):
    def __init__(self, name: str, role_prompt: str = ""):
        self.name = name
        self.role_prompt = role_prompt

        # 💡 优化：大模型客户端直接在基类初始化，所有继承的智能体天生自带“大脑”
        self.llm_client = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_API_BASE")
        )
        self.model_version = os.getenv("SPARK_MODEL_VERSION", "generalv3.5")

    # ================= 状态机黑板读写 =================

    def update_history(self, state: TaskState, message: str) -> TaskState:
        logger.info(f"Agent [{self.name}]: {message}")
        if "history" not in state:
            state["history"] = []
        state["history"].append(f"[{self.name}] {message}")
        return state

    def read_blackboard(self, state: TaskState, key: str) -> Any:
        value = state.get(key, None)
        logger.debug(f"Agent [{self.name}] read blackboard [{key}]: {value}")
        return value

    def write_blackboard(self, state: TaskState, key: str, value: Any) -> TaskState:
        state[key] = value
        logger.debug(f"Agent [{self.name}] write blackboard [{key}]: {value}")
        return state

    # ================= 跨线程会话中断控制 =================

    def get_session_id(self, state: TaskState) -> str:
        session_id = self.read_blackboard(state, "session_id")
        if not session_id:
            logger.warning(f"Agent [{self.name}] get empty session_id")
        return session_id

    def is_session_cancelled(self, state: TaskState) -> bool:
        session_id = self.get_session_id(state)
        with _cancel_signals_lock:
            return _global_cancel_signals.get(session_id, False)

    @classmethod
    def cancel_session(cls, session_id: str) -> None:
        """
        💡 修正为类方法：FastAPI 路由可以直接调用 AgentBase.cancel_session("session_123")
        而不需要实例化某个具体的智能体
        """
        with _cancel_signals_lock:
            _global_cancel_signals[session_id] = True
        logger.warning(f"🚨 接收到外部中断信号，会话已标记取消: {session_id}")

    @classmethod
    def reset_session_cancel(cls, session_id: str) -> None:
        with _cancel_signals_lock:
            _global_cancel_signals.pop(session_id, None)

    # ================= 核心能力封装 =================

    def call_llm(self, user_input: str, temperature: float = 0.7) -> str:
        """
        💡 优化：移除 @abstractmethod，提供默认实现。
        队员写子类时，直接 self.call_llm("分析这段代码") 即可。
        """
        logger.info(f"[{self.name}] 正在向大模型发起请求...")
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
    def run(self, state: TaskState) -> dict:
        """
        智能体的主运行逻辑
        💡 注意：LangGraph 的标准节点函数要求返回一个 partial dict（状态更新增量），而不是完整的 state
        """
        pass