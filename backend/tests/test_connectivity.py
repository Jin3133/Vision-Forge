"""基础连通性检查测试 — 验证 LLM_client 与 MinerU 服务的基本连接状态和响应能力"""

import time

import pytest
import requests

from core.config import settings
from core.exceptions import LLMServiceError
from services.external_services.llm_service import LLMService


# ============================================================
# 星火大模型 API 连通性
# ============================================================

class TestSparkConnectivity:
    """验证星火大模型 OpenAI 兼容接口的连通性"""

    @pytest.mark.integration
    def test_spark_client_creation(self):
        """验证能成功创建星火大模型客户端"""
        LLMService.reset_cache()
        client = LLMService.get_client("spark")
        assert client is not None
        print(f"[Spark] 客户端创建成功, base_url={settings.OPENAI_API_BASE}")

    @pytest.mark.integration
    def test_spark_chat_response(self):
        """验证星火大模型能返回非空响应"""
        try:
            start = time.time()
            result = LLMService.chat(
                messages=[{"role": "user", "content": "你好，请回复OK"}],
                provider="spark",
                model=settings.SPARK_MODEL_VERSION,
                temperature=0.1,
            )
            elapsed = time.time() - start
        except LLMServiceError as e:
            # 认证失败或服务不可用时 skip
            pytest.skip(f"星火大模型 API 不可用: {e}")

        assert result is not None
        assert len(result.strip()) > 0
        print(f"[Spark] 响应时间: {elapsed:.2f}s, 响应内容: {result[:50]}")

    @pytest.mark.integration
    def test_spark_client_cache(self):
        """验证星火客户端缓存复用"""
        LLMService.reset_cache()
        client1 = LLMService.get_client("spark")
        client2 = LLMService.get_client("spark")
        assert client1 is client2
        print("[Spark] 客户端缓存复用验证通过")


# ============================================================
# MinerU API 连通性
# ============================================================

class TestMinerUConnectivity:
    """验证 MinerU Agent 轻量解析 API 的连通性"""

    @pytest.mark.integration
    def test_mineru_base_url_reachable(self):
        """验证 MinerU API 基础地址可达"""
        try:
            start = time.time()
            resp = requests.get(settings.MINERU_BASE_URL, timeout=10)
            elapsed = time.time() - start
        except requests.RequestException as e:
            pytest.skip(f"MinerU API 不可达: {e}")

        assert resp.status_code == 200
        print(f"[MinerU] API 可达, base_url={settings.MINERU_BASE_URL}, 响应时间: {elapsed:.2f}s")

    @pytest.mark.integration
    def test_mineru_parse_endpoint_exists(self):
        """验证 MinerU 解析端点存在"""
        try:
            resp = requests.post(
                f"{settings.MINERU_BASE_URL}/api/v1/agent/parse/file",
                json={},
                timeout=10,
            )
        except requests.RequestException as e:
            pytest.skip(f"MinerU API 不可达: {e}")

        # 不期望成功（没有文件），但端点应存在（非 404）
        assert resp.status_code != 404
        print(f"[MinerU] 解析端点存在, status={resp.status_code}")


# ============================================================
# DeepSeek API 连通性
# ============================================================

class TestDeepSeekConnectivity:
    """验证 DeepSeek API 的连通性"""

    @pytest.mark.integration
    def test_deepseek_client_creation(self):
        """验证能成功创建 DeepSeek 客户端"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")
        LLMService.reset_cache()
        client = LLMService.get_client("deepseek")
        assert client is not None
        print(f"[DeepSeek] 客户端创建成功, base_url={settings.DEEPSEEK_BASE_URL}")

    @pytest.mark.integration
    def test_deepseek_chat_response(self):
        """验证 DeepSeek 能返回非空响应"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")
        try:
            start = time.time()
            result = LLMService.chat(
                messages=[{"role": "user", "content": "Hello, reply OK"}],
                provider="deepseek",
                model=settings.DEEPSEEK_REPORT_MODEL,
                temperature=0.1,
            )
            elapsed = time.time() - start
        except LLMServiceError as e:
            pytest.skip(f"DeepSeek API 不可用: {e}")

        assert result is not None
        assert len(result.strip()) > 0
        print(f"[DeepSeek] 响应时间: {elapsed:.2f}s, 响应内容: {result[:50]}")

    @pytest.mark.integration
    def test_deepseek_client_cache(self):
        """验证 DeepSeek 客户端缓存复用"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")
        LLMService.reset_cache()
        client1 = LLMService.get_client("deepseek")
        client2 = LLMService.get_client("deepseek")
        assert client1 is client2
        print("[DeepSeek] 客户端缓存复用验证通过")
