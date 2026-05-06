import threading
from abc import ABC, abstractmethod
from core.state import TaskState
from core.logger import logger
from typing import Any

# 全局线程安全的会话取消信号（避免多线程冲突）
session_cancel_signals = threading.local()

class AgentBase(ABC):
    def __init__(self, name: str):
        self.name = name

    def update_history(self, state: TaskState, message: str) -> TaskState:
        """统一记录智能体行动日志"""
        logger.info(f"Agent [{self.name}]: {message}")
        state["history"].append(f"[{self.name}] {message}")
        return state

    def read_blackboard(self, state: TaskState, key: str) -> Any:
        """从黑板读取状态（统一入口+日志追溯）"""
        value = state.get(key, None)
        logger.debug(f"Agent [{self.name}] read blackboard key [{key}]: {value}")
        return value

    def write_blackboard(self, state: TaskState, key: str, value: Any) -> TaskState:
        """写入黑板状态（统一入口+强制返回更新后的state）"""
        state[key] = value
        logger.debug(f"Agent [{self.name}] write blackboard key [{key}]: {value}")
        return state

    def get_session_id(self, state: TaskState) -> str:
        """统一获取当前会话ID（封装入口，便于后续逻辑扩展）"""
        session_id = self.read_blackboard(state, "session_id")
        if not session_id:
            logger.warning(f"Agent [{self.name}] get empty session_id from blackboard")
        return session_id

    def is_session_cancelled(self, state: TaskState) -> bool:
        """检查当前会话是否被用户取消（智能体执行中轮询此方法）"""
        session_id = self.get_session_id(state)
        return getattr(session_cancel_signals, session_id, False)

    def cancel_session(self, state: TaskState) -> None:
        """触发当前会话的取消信号（供前端/外部调用）"""
        session_id = self.get_session_id(state)
        setattr(session_cancel_signals, session_id, True)
        logger.info(f"Agent [{self.name}] cancelled session: {session_id}")

    def reset_session_cancel(self, state: TaskState) -> None:
        """重置会话取消信号（会话重新执行时调用）"""
        session_id = self.get_session_id(state)
        setattr(session_cancel_signals, session_id, False)

    @abstractmethod
    def call_llm(self, prompt: str):
        """抽象方法：具体的LLM调用逻辑由子类实现或在此封装"""
        pass

    @abstractmethod
    def execute(self, state: TaskState) -> TaskState:
        """智能体的主运行逻辑"""
        pass