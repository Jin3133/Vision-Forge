"""
Spark Animation Generator 配置模块
"""

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

from exceptions import ConfigurationError

# 加载环境变量
load_dotenv()


@dataclass
class SparkConfig:
    """星火大模型配置类"""
    
    app_id: str
    api_key: str
    api_secret: str
    gpt_url: str = "wss://spark-api.xf-yun.com/v3.5/chat"
    domain: str = "generalv3.5"
    temperature: float = 0.5
    max_tokens: int = 8192
    
    @classmethod
    def from_env(cls) -> "SparkConfig":
        """从环境变量读取配置"""
        app_id = os.getenv("SPARK_APP_ID", "").strip()
        api_key = os.getenv("SPARK_API_KEY", "").strip()
        api_secret = os.getenv("SPARK_API_SECRET", "").strip()
        
        missing_keys = []
        if not app_id:
            missing_keys.append("SPARK_APP_ID")
        if not api_key:
            missing_keys.append("SPARK_API_KEY")
        if not api_secret:
            missing_keys.append("SPARK_API_SECRET")
        
        if missing_keys:
            raise ConfigurationError(
                f"缺少必要的环境变量: {', '.join(missing_keys)}",
                missing_keys=missing_keys
            )
        
        return cls(
            app_id=app_id,
            api_key=api_key,
            api_secret=api_secret,
            gpt_url=os.getenv("SPARK_GPT_URL", "wss://spark-api.xf-yun.com/v3.5/chat"),
            domain=os.getenv("SPARK_DOMAIN", "generalv3.5"),
            temperature=float(os.getenv("SPARK_TEMPERATURE", "0.5")),
            max_tokens=int(os.getenv("SPARK_MAX_TOKENS", "16384"))
        )
    
    def validate(self) -> None:
        """验证配置有效性"""
        if not self.app_id:
            raise ConfigurationError("app_id 不能为空", missing_keys=["app_id"])
        if not self.api_key:
            raise ConfigurationError("api_key 不能为空", missing_keys=["api_key"])
        if not self.api_secret:
            raise ConfigurationError("api_secret 不能为空", missing_keys=["api_secret"])
        if not self.gpt_url.startswith("wss://"):
            raise ConfigurationError("gpt_url 必须以 wss:// 开头")
        if not 0 <= self.temperature <= 1:
            raise ConfigurationError("temperature 必须在 0 到 1 之间")
        if self.max_tokens < 1:
            raise ConfigurationError("max_tokens 必须大于 0")
