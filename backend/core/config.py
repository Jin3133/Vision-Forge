import os
import sys
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# PyInstaller 打包后，使用 sys._MEIPASS 作为资源路径基础
if getattr(sys, 'frozen', False):
    _BASE_DIR = Path(sys._MEIPASS)
else:
    _BASE_DIR = Path(__file__).resolve().parent  # backend/ 目录


class Settings(BaseSettings):
    # === 基础配置 ===
    PROJECT_NAME: str = "Vision-Forge V2.0"
    DEBUG_MODE: bool = True

    # === 黑板状态持久化 ===
    STATE_PERSIST_ENABLED: bool = True
    STATE_DB_PATH: str = str(_BASE_DIR / "vision_forge_state.db")

    # === RAG 知识库配置 ===
    # RAG_BACKEND 可选: "chroma"(本地向量库, 默认) | "ragflow"(远程服务) | "none"(关闭检索)
    RAG_BACKEND: str = "chroma"
    CHROMA_PERSIST_DIR: str = str(_BASE_DIR / "assets" / "vector_database")
    CHROMA_COLLECTION: str = "vision_forge_papers"

    # === 数据库与安全 (加上默认值，彻底解决启动报错) ===
    DATABASE_URL: str = "sqlite:///./vision_forge.db"
    SECRET_KEY: str = "dev_key_only_for_testing_12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    # === 大模型配置 (统一从 .env 读取，切勿把真实 Key 写进源码) ===
    OPENAI_API_KEY: str = ""
    OPENAI_API_BASE: str = "https://spark-api-open.xf-yun.com/v1"
    SPARK_MODEL_VERSION: str = "generalv3.5"
    LLM_MAX_RETRIES: int = 2  # LLM 调用失败时的重试次数

    # 其他默认占位 (防止 KeyError)
    SPARK_APP_ID: str = ""
    SPARK_API_SECRET: str = ""
    SPARK_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    KIMI_API_KEY: str = ""
    CHATGLM_API_KEY: str = ""
    RAGFLOW_API_KEY: str = ""
    RAGFLOW_BASE_URL: str = "http://127.0.0.1:9380/v1/api"
    RAGFLOW_KB_ID: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
print("✅ 配置加载成功！")