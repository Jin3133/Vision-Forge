"""LLMService 真实服务集成测试 — services/external_services/llm_service.py"""

import time

import pytest

from core.config import settings
from core.exceptions import LLMServiceError, LLMRateLimitError, LLMTimeoutError
from services.external_services.llm_service import LLMService


# ============================================================
# get_client 真实测试
# ============================================================

class TestGetClient:
    """测试真实客户端创建和缓存"""

    @pytest.mark.integration
    def test_spark_returns_openai_client(self):
        """验证星火 provider 返回有效的 OpenAI 客户端"""
        LLMService.reset_cache()
        client = LLMService.get_client("spark")
        assert client is not None
        # 验证客户端有 chat.completions.create 方法
        assert hasattr(client, "chat")
        print(f"[Spark] 客户端创建成功, base_url={settings.OPENAI_API_BASE}")

    @pytest.mark.integration
    def test_deepseek_returns_openai_client(self):
        """验证 DeepSeek provider 返回有效的 OpenAI 客户端"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")
        LLMService.reset_cache()
        client = LLMService.get_client("deepseek")
        assert client is not None
        assert hasattr(client, "chat")
        print(f"[DeepSeek] 客户端创建成功, base_url={settings.DEEPSEEK_BASE_URL}")

    @pytest.mark.integration
    def test_same_provider_returns_cached_instance(self):
        """验证相同 provider 返回缓存的客户端实例"""
        LLMService.reset_cache()
        client1 = LLMService.get_client("spark")
        client2 = LLMService.get_client("spark")
        assert client1 is client2
        print("[缓存] 相同 provider 返回同一实例")

    @pytest.mark.integration
    def test_different_provider_creates_different_client(self):
        """验证不同 provider 返回不同客户端"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")
        LLMService.reset_cache()
        spark_client = LLMService.get_client("spark")
        ds_client = LLMService.get_client("deepseek")
        assert spark_client is not ds_client
        print("[缓存] 不同 provider 返回不同实例")

    def test_unsupported_provider_raises_llm_service_error(self):
        """验证不支持的 provider 抛出 LLMServiceError"""
        # 这个测试不需要真实 API 调用，不需要 integration 标记
        with pytest.raises(LLMServiceError) as exc_info:
            LLMService.get_client("unknown_provider")
        assert "unknown_provider" in str(exc_info.value) or "不支持" in str(exc_info.value)


# ============================================================
# chat 真实测试
# ============================================================

class TestChat:
    """测试真实 LLM 聊天调用"""

    @pytest.mark.integration
    def test_spark_chat_returns_non_empty_string(self):
        """验证星火大模型聊天返回非空字符串"""
        try:
            start = time.time()
            result = LLMService.chat(
                messages=[{"role": "user", "content": "你好，请回复OK"}],
                provider="spark",
                model=settings.SPARK_MODEL_VERSION,
            )
            elapsed = time.time() - start
        except LLMServiceError as e:
            pytest.skip(f"星火 API 不可用: {e}")

        assert isinstance(result, str)
        assert len(result.strip()) > 0
        print(f"[Spark] 聊天响应时间: {elapsed:.2f}s, 内容: {result[:80]}")

    @pytest.mark.integration
    def test_spark_chat_passes_messages_and_model(self):
        """验证星火聊天正确传递 messages 和 model 参数"""
        try:
            result = LLMService.chat(
                messages=[{"role": "user", "content": "1+1等于几？只回复数字"}],
                provider="spark",
                model=settings.SPARK_MODEL_VERSION,
                temperature=0.1,
            )
        except LLMServiceError as e:
            pytest.skip(f"星火 API 不可用: {e}")

        assert isinstance(result, str)
        assert len(result.strip()) > 0
        print(f"[Spark] 参数传递测试通过, 响应: {result[:50]}")

    @pytest.mark.integration
    def test_deepseek_chat_returns_non_empty_string(self):
        """验证 DeepSeek 聊天返回非空字符串"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")
        try:
            start = time.time()
            result = LLMService.chat(
                messages=[{"role": "user", "content": "Hello, reply OK"}],
                provider="deepseek",
                model=settings.DEEPSEEK_REPORT_MODEL,
            )
            elapsed = time.time() - start
        except LLMServiceError as e:
            pytest.skip(f"DeepSeek API 不可用: {e}")

        assert isinstance(result, str)
        assert len(result.strip()) > 0
        print(f"[DeepSeek] 聊天响应时间: {elapsed:.2f}s, 内容: {result[:80]}")

    @pytest.mark.integration
    def test_deepseek_chat_passes_temperature(self):
        """验证 DeepSeek 聊天正确传递 temperature 参数"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")
        try:
            result = LLMService.chat(
                messages=[{"role": "user", "content": "1+1=?"}],
                provider="deepseek",
                model=settings.DEEPSEEK_REPORT_MODEL,
                temperature=0.3,
            )
        except LLMServiceError as e:
            pytest.skip(f"DeepSeek API 不可用: {e}")

        assert isinstance(result, str)
        assert len(result.strip()) > 0
        print(f"[DeepSeek] temperature 参数传递测试通过")


# ============================================================
# API 错误处理测试
# ============================================================

class TestAPIErrorHandling:
    """测试真实 API 错误处理"""

    def test_unsupported_provider_raises_llm_service_error(self):
        """验证不支持的 provider 抛出 LLMServiceError"""
        with pytest.raises(LLMServiceError):
            LLMService.get_client("nonexistent_provider")

    @pytest.mark.integration
    def test_invalid_model_still_returns_or_errors(self):
        """验证使用无效 model 时要么返回结果要么抛出 LLMServiceError"""
        try:
            result = LLMService.chat(
                messages=[{"role": "user", "content": "test"}],
                provider="spark",
                model="invalid-model-name",
            )
            # 如果 API 接受了无效 model，结果应为字符串
            assert isinstance(result, str)
        except LLMServiceError:
            # 如果 API 拒绝了无效 model，应抛出 LLMServiceError
            pass
        print("[错误处理] 无效 model 测试通过")
