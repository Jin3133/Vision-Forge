"""统一配置管理

优先级: .env.local > .env > 代码默认值

- 项目主目录的 .env       —— 团队共享模板（提交到版本控制）
- 项目主目录的 .env.local —— 本地敏感信息（已在 .gitignore 忽略）

代码中所有字符串字段的默认值为空字符串 ""；数值/布尔类型因无法用空串
表达，保留合理的工程兜底值（0 / False）。pydantic-settings 在文件不存在
时不会抛错，会自动跳过，所以即使 .env 与 .env.local 都缺失，也能正常
import 本模块。
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# 项目主目录 = config.py 所在目录向上三级 (backend/core/ -> 项目主目录)
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # === 基础配置 ===
    PROJECT_NAME: str = ""
    DEBUG_MODE: bool = True

    # === 数据库与安全 ===
    DATABASE_URL: str = ""
    SECRET_KEY: str = ""
    ALGORITHM: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 0

    # === 大模型配置 ===
    OPENAI_API_KEY: str = ""
    OPENAI_API_BASE: str = ""
    SPARK_MODEL_VERSION: str = ""

    # === 星火 WebSocket 旧接口 (备用) ===
    SPARK_APP_ID: str = ""
    SPARK_API_SECRET: str = ""
    SPARK_API_KEY: str = ""

    # === 其他大模型 (备用) ===
    DEEPSEEK_API_KEY: str = ""
    KIMI_API_KEY: str = ""
    CHATGLM_API_KEY: str = ""

    # === RAGFlow 知识库 ===
    RAGFLOW_API_KEY: str = ""
    RAGFLOW_BASE_URL: str = ""
    RAGFLOW_KB_ID: str = ""

    # === MinerU 文档解析 ===
    MINERU_BASE_URL: str = ""
    MINERU_MAX_FILE_SIZE: int = 0
    MINERU_TIMEOUT: int = 0
    MINERU_POLL_INTERVAL: int = 0

    # === DeepSeek 模型配置 ===
    DEEPSEEK_BASE_URL: str = ""
    DEEPSEEK_REPORT_MODEL: str = ""
    DEEPSEEK_ANIMATION_MODEL: str = ""

    # === 报告生成配置 ===
    REPORT_MAX_ITERATIONS: int = 0
    REPORT_TEMPERATURE: float = 0.0

    # === 动画生成配置 ===
    ANIMATION_TEMPERATURE: float = 0.0
    ANIMATION_MAX_TOKENS: int = 0

    model_config = SettingsConfigDict(
        # pydantic-settings v2 的 env_file 列表中后者覆盖前者
        env_file=[
            str(BASE_DIR / ".env"),
            str(BASE_DIR / ".env.local"),
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
print("配置加载成功")
