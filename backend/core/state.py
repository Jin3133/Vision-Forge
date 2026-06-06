import threading
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from core.logger import logger


# ==========================================
# 1. 匹配前端JSON契约
# ==========================================
class NodeModel(BaseModel):
    id: str
    type: str
    name: str
    data: Dict[str, Any] = Field(default_factory=dict)


class EdgeModel(BaseModel):
    source: str
    target: str


class SandboxConfig(BaseModel):
    task_type: str = ""
    suggested_backbone: str = ""
    nodes: List[NodeModel] = Field(default_factory=list)
    edges: List[EdgeModel] = Field(default_factory=list)


# ==========================================
# 2. 全局黑板状态
# ==========================================
class TaskState(BaseModel):
    # 基础信息
    session_id: str
    user_intent: str = ""

    # 业务数据
    learner_profile: Dict[str, Any] = Field(default_factory=dict)
    sandbox_config: SandboxConfig = Field(default_factory=SandboxConfig)

    # 智能体流转中间件
    missing_knowledge: List[str] = Field(default_factory=list)
    evaluation_results: Dict[str, Any] = Field(default_factory=dict)

    # 系统追踪
    history: List[str] = Field(default_factory=list)
    current_step: str = "init"  # 代替 current_agent，作为状态机指针


# ==========================================
# 3. 线程安全的黑板管理器
# ==========================================
class StateManager:
    def __init__(self):
        self._states: Dict[str, TaskState] = {}
        self._lock = threading.Lock()

    def get_state(self, session_id: str) -> TaskState:
        """获取或初始化指定会话的黑板"""
        with self._lock:
            if session_id not in self._states:
                logger.info(f"[StateManager] 初始化全新会话黑板: {session_id}")
                self._states[session_id] = TaskState(session_id=session_id)
            return self._states[session_id]

    def update_state(self, session_id: str, delta: Dict[str, Any]) -> TaskState:
        """
        核心机制：增量合并 (Delta Merge)
        智能体运行完只返回修改的字段，管理器负责将其定向合并进黑板
        """
        with self._lock:
            if session_id not in self._states:
                self._states[session_id] = TaskState(session_id=session_id)

            current_state = self._states[session_id]
            # 将当前状态转为字典便于操作
            state_data = current_state.model_dump()

            # 遍历增量并进行合并
            for key, value in delta.items():
                if key not in state_data:
                    continue

                # 针对历史记录和缺失知识点的追加
                if key in ["history", "missing_knowledge"]:
                    if isinstance(value, list):
                        state_data[key].extend(value)
                    elif isinstance(value, str):
                        state_data[key].append(value)

                # 针对字典的深度合并 (如 learner_profile, evaluation_results)
                elif isinstance(state_data[key], dict) and isinstance(value, dict):
                    state_data[key].update(value)

                # 针对 SandboxConfig 的特殊处理 (如果传入的是字典，合并后重新解析)
                elif key == "sandbox_config" and isinstance(value, dict):
                    # 允许部分更新 config
                    current_config_dict = state_data[key]
                    current_config_dict.update(value)
                    state_data[key] = current_config_dict

                # 基础类型直接覆盖 (如 user_intent, current_step)
                else:
                    state_data[key] = value

            # 重新通过 Pydantic 校验并写回缓存
            updated_state = TaskState(**state_data)
            self._states[session_id] = updated_state
            logger.info(f"[StateManager] 黑板更新成功 | 当前步骤: {updated_state.current_step}")
            return updated_state

    def clear_state(self, session_id: str):
        with self._lock:
            if session_id in self._states:
                del self._states[session_id]
                logger.info(f"[StateManager] 会话 {session_id} 已销毁")


# 实例化全局单例
state_manager = StateManager()

