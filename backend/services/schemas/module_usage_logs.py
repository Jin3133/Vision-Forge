from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# ✅ 1. 接收前端或系统内部创建日志时的数据格式
class AgentUsageLogCreate(BaseModel):
    user_id: int
    action_type: str                 # 动作类型 (如: tutor_chat)
    model_name: Optional[str] = None # 模型名称 (如: spark_v3.5)
    duration_ms: int = 0             # 耗时 (毫秒)
    tokens_used: int = 0             # 消耗的 Token
    status: str = "success"          # 状态

# ✅ 2. 数据库查询后，返回给前端的完整 JSON 格式
class AgentUsageLogOut(AgentUsageLogCreate):
    id: int
    start_time: datetime

    class Config:
        # 兼容 Pydantic V1 和 V2，允许直接把 SQLAlchemy 的对象转换成 JSON
        orm_mode = True
        from_attributes = True
