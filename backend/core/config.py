import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # === 基础配置 ===
    PROJECT_NAME: str = "Vision-Forge V2.0"
    DEBUG_MODE: bool = True

    # === 数据库与安全 (加上默认值，彻底解决启动报错) ===
    DATABASE_URL: str = "sqlite:///./vision_forge.db"
    SECRET_KEY: str = "dev_key_only_for_testing_12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    # === 大模型配置 (填入你的真实 Key，以后就不用管 .env 了) ===
    OPENAI_API_KEY: str = "7ba874a7eae6c25f2bae72e7eace2aba"
    OPENAI_API_BASE: str = "https://spark-api-open.xf-yun.com/v1"
    SPARK_MODEL_VERSION: str = "generalv3.5"

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