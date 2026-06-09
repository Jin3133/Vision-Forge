from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime

from core.database import Base


class User(Base):
    __tablename__ = 'user'

    id = Column(Integer, primary_key=True, autoincrement=True, comment="用户ID")
    username = Column(String(50), unique=True, nullable=False, comment="用户名")
    password = Column(String(255), nullable=False, comment="密码")
    name = Column(String(100), default="", comment="姓名")
    role = Column(String(20), default="student", comment="角色")
    class_name = Column(String(100), nullable=True, comment="班级")
    create_time = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    last_login = Column(DateTime, nullable=True, comment="最后登录时间")
    login_ip = Column(String(50), nullable=True, comment="登录IP")
