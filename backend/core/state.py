import threading
import json
import sqlite3
import os
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from core.logger import logger
from core.config import settings


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
# 3. SQLite 持久化层
# ==========================================
class StatePersistence:
    """基于 SQLite 的黑板状态持久化，支持进程重启后恢复会话。"""

    def __init__(self, db_path: str):
        self._db_path = db_path
        self._local = threading.local()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        """每个线程维护独立的 SQLite 连接（SQLite 不支持跨线程共享连接）。"""
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(self._db_path, timeout=10)
            self._local.conn.execute("PRAGMA journal_mode=WAL")
        return self._local.conn

    def _init_db(self):
        """创建存储表（幂等）。"""
        conn = self._get_conn()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS blackboard_states (
                session_id TEXT PRIMARY KEY,
                state_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        logger.info(f"[StatePersistence] SQLite 就绪 | 路径: {self._db_path}")

    def save(self, session_id: str, state: TaskState):
        """将状态序列化后写入 SQLite。"""
        conn = self._get_conn()
        state_json = state.model_dump_json()
        conn.execute(
            """INSERT OR REPLACE INTO blackboard_states (session_id, state_json, updated_at)
               VALUES (?, ?, CURRENT_TIMESTAMP)""",
            (session_id, state_json)
        )
        conn.commit()

    def load(self, session_id: str) -> Optional[TaskState]:
        """从 SQLite 恢复指定会话的状态，不存在则返回 None。"""
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT state_json FROM blackboard_states WHERE session_id = ?",
            (session_id,)
        )
        row = cursor.fetchone()
        if row:
            try:
                data = json.loads(row[0])
                return TaskState(**data)
            except Exception as e:
                logger.error(f"[StatePersistence] 反序列化失败 session={session_id}: {e}")
                return None
        return None

    def delete(self, session_id: str):
        """删除指定会话的持久化数据。"""
        conn = self._get_conn()
        conn.execute("DELETE FROM blackboard_states WHERE session_id = ?", (session_id,))
        conn.commit()

    def list_sessions(self) -> List[str]:
        """列出所有已持久化的会话 ID。"""
        conn = self._get_conn()
        cursor = conn.execute("SELECT session_id FROM blackboard_states ORDER BY updated_at DESC")
        return [row[0] for row in cursor.fetchall()]


# ==========================================
# 4. 线程安全的黑板管理器（集成持久化）
# ==========================================
class StateManager:
    def __init__(self):
        self._states: Dict[str, TaskState] = {}
        self._lock = threading.Lock()

        # 根据配置决定是否启用持久化
        self._persist_enabled = settings.STATE_PERSIST_ENABLED
        self._persistence: Optional[StatePersistence] = None

        if self._persist_enabled:
            db_path = settings.STATE_DB_PATH
            # 确保 db 文件所在目录存在
            os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)
            self._persistence = StatePersistence(db_path)
            # 启动时从 SQLite 预加载所有会话到内存
            self._preload_from_db()

    def _preload_from_db(self):
        """进程启动时从 SQLite 恢复所有会话状态到内存缓存。"""
        if not self._persistence:
            return
        sessions = self._persistence.list_sessions()
        loaded = 0
        for sid in sessions:
            state = self._persistence.load(sid)
            if state:
                self._states[sid] = state
                loaded += 1
        if loaded:
            logger.info(f"[StateManager] 从 SQLite 恢复了 {loaded} 个会话状态")

    def get_state(self, session_id: str) -> TaskState:
        """获取或初始化指定会话的黑板"""
        with self._lock:
            if session_id not in self._states:
                # 先尝试从持久化层恢复
                if self._persistence:
                    restored = self._persistence.load(session_id)
                    if restored:
                        self._states[session_id] = restored
                        logger.info(f"[StateManager] 从 SQLite 恢复会话: {session_id}")
                        return restored

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
                    current_config_dict = state_data[key]
                    current_config_dict.update(value)
                    state_data[key] = current_config_dict

                # 基础类型直接覆盖 (如 user_intent, current_step)
                else:
                    state_data[key] = value

            # 重新通过 Pydantic 校验并写回缓存
            updated_state = TaskState(**state_data)
            self._states[session_id] = updated_state

            # 持久化到 SQLite
            if self._persistence:
                try:
                    self._persistence.save(session_id, updated_state)
                except Exception as e:
                    logger.error(f"[StateManager] 持久化写入失败: {e}")

            logger.info(f"[StateManager] 黑板更新成功 | 当前步骤: {updated_state.current_step}")
            return updated_state

    def clear_state(self, session_id: str):
        with self._lock:
            if session_id in self._states:
                del self._states[session_id]
            if self._persistence:
                self._persistence.delete(session_id)
            logger.info(f"[StateManager] 会话 {session_id} 已销毁")


# 实例化全局单例
state_manager = StateManager()
