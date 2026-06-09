"""统一LLM调用服务"""

import openai
from openai import APIError, RateLimitError, APITimeoutError

from core.config import settings as _settings
from core.logger import logger
from core.exceptions import LLMServiceError, LLMRateLimitError, LLMTimeoutError

# 模块级名称，供 @patch 测试打桩使用
# 条件赋值：首次 import 时设置真实值；importlib.reload 时保留被 patch 的值
if "OpenAI" not in globals():
    OpenAI = openai.OpenAI
if "settings" not in globals():
    settings = _settings


class LLMService:
    """统一LLM调用服务 — 所有LLM调用的唯一入口"""

    _client_cache: dict = {}  # 按provider缓存客户端实例

    @classmethod
    def get_client(cls, provider: str) -> OpenAI:
        """获取指定provider的OpenAI兼容客户端，按provider缓存复用"""
        if provider in cls._client_cache:
            return cls._client_cache[provider]

        if provider == "spark":
            client = OpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_API_BASE,
            )
        elif provider == "deepseek":
            client = OpenAI(
                api_key=settings.DEEPSEEK_API_KEY,
                base_url=settings.DEEPSEEK_BASE_URL,
            )
        else:
            raise LLMServiceError(
                f"不支持的LLM provider: {provider}",
                provider=provider,
            )

        cls._client_cache[provider] = client
        return client

    @classmethod
    def chat(cls, messages: list, provider: str = "spark",
             model: str = None, temperature: float = 0.7,
             tools: list = None, **kwargs) -> str:
        """统一聊天接口，返回content字符串"""
        client = cls.get_client(provider)

        # 默认model从settings读取
        if model is None:
            if provider == "spark":
                model = settings.SPARK_MODEL_VERSION
            elif provider == "deepseek":
                model = settings.DEEPSEEK_REPORT_MODEL

        params = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            params["tools"] = tools
            params["tool_choice"] = "auto"
        params.update(kwargs)

        try:
            response = client.chat.completions.create(**params)
            return response.choices[0].message.content or ""
        except RateLimitError as e:
            raise LLMRateLimitError(
                f"LLM限频: {e}",
                provider=provider,
            ) from e
        except APITimeoutError as e:
            raise LLMTimeoutError(
                f"LLM超时: {e}",
                provider=provider,
            ) from e
        except APIError as e:
            raise LLMServiceError(
                f"LLM调用失败: {e}",
                provider=provider,
            ) from e
        except Exception as e:
            raise LLMServiceError(
                f"LLM调用异常: {e}",
                provider=provider,
            ) from e

    @classmethod
    def reset_cache(cls):
        """重置客户端缓存（测试用）"""
        cls._client_cache = {}
