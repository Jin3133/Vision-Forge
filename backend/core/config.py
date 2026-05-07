import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    PROJECT_NAME: str = "Vision-Forge"
    # 从环境变量读取密钥
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "sk-xxx")
    DATABASE_PATH: str = os.path.join(os.getcwd(), "assets/vector_database")

    # 业务逻辑开关
    DEBUG_MODE: bool = True


settings = Settings()