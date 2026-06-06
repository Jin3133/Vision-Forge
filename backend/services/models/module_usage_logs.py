from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

# ✅ 1. 修正数据库基类导入路径
from core.database import Base


class AgentUsageLog(Base):
    # 升级表名为智能体调用日志
    __tablename__ = 'agent_usage_logs'

    id = Column(Integer, primary_key=True, autoincrement=True, comment="日志记录ID")

    # 关联用户
    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False, comment="用户ID")

    # ✅ 2. 全新设计的 AI 遥测字段
    action_type = Column(String(100), nullable=False, comment="动作类型(如: tutor_chat, sandbox_eval)")
    model_name = Column(String(50), nullable=True, comment="底层模型(如: spark_v3.5, deepseek)")

    # 记录时间与性能
    start_time = Column(DateTime, nullable=False, default=datetime.utcnow, comment="请求发起时间")
    duration_ms = Column(Integer, nullable=False, default=0, comment="大模型推理耗时(毫秒)")

    # ✅ 3. AI 时代特色：Token 消耗统计（方便你以后做成本监控）
    tokens_used = Column(Integer, nullable=True, default=0, comment="消耗的 Token 总量")
    status = Column(String(20), nullable=False, default="success", comment="调用状态(success/failed)")

    # 关联 User 表，方便查询时直接获取用户名
    user = relationship("User", backref="agent_logs")

    # ❌ 删除了旧版繁琐且容易报错的 Role CheckConstraint，因为 User 表里已经有 role 了。
