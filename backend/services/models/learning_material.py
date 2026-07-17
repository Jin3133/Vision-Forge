"""
学习讲义持久化 ORM 模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from core.database import Base


class LearningMaterial(Base):
    __tablename__ = 'learning_materials'

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    session_id = Column(String(100), nullable=False, index=True, comment="关联的会话ID")
    title = Column(String(255), nullable=False, comment="讲义标题")
    material_type = Column(String(50), nullable=False, default="讲义", comment="类型: 讲义/评估报告/架构图")
    content_html = Column(Text, nullable=False, comment="讲义HTML内容")
    sandbox_config_json = Column(Text, nullable=True, comment="关联的沙盒配置JSON快照")
    task_type = Column(String(50), nullable=True, comment="视觉任务类型")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
