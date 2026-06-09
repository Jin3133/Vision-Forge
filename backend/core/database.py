# ✅ SQLAlchemy 导入模块
from sqlalchemy import create_engine
from fastapi import Depends
from sqlalchemy.orm import Session
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 🚀 【修改点】：去掉了 'app.' 前缀，直接从同级的 core 目录导入
from core.config import settings

# === 🔧 创建数据库引擎（Engine） ===
engine = create_engine(
    settings.DATABASE_URL,  # 从配置文件加载数据库连接字符串
    pool_pre_ping=True,     # ✅ 在执行前测试连接可用性，防止连接池中出现“死连接”
    echo=False              # ✅ 设置为 True 时，会在控制台输出所有执行的 SQL，便于调试
)

# === 🏭 创建数据库会话工厂（每次请求获取独立会话） ===
# 🚀 【修改点】：把 SessionLocal 移到了 get_db 前面，防止 Python 报错找不到变量
SessionLocal = sessionmaker(
    autocommit=False,       # 不自动提交事务（由代码手动控制 commit）
    autoflush=False,          # 不自动刷新到数据库（提高性能）
    bind=engine             # 绑定上面创建的数据库引擎
)

# FastAPI 中使用的依赖注入
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# === 📦 ORM 基类，用于定义模型类（即数据库表结构） ===
Base = declarative_base()