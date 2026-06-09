import time
from pathlib import Path

import pytest

from core.config import settings
from services.external_services.llm_service import LLMService


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "integration: marks tests that require real external services (LLM, MinerU)"
    )


@pytest.fixture
def test_files_dir():
    return Path(r"f:\college\sophomore\软件杯\temp\MinerU_demo\test_files")


@pytest.fixture
def pdf_test_file(test_files_dir):
    return test_files_dir / "2025-TDAG A Multi-Agent Framework Based on Dynamic Task Decomposition and Agent Generation-250805.pdf"


@pytest.fixture
def docx_test_file(test_files_dir):
    return test_files_dir / "2406010330 许赵泓.docx"


@pytest.fixture
def spark_available():
    try:
        client = LLMService.get_client("spark")
        client.chat.completions.create(
            model="spark",
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=5,
        )
    except Exception as e:
        pytest.skip(reason=f"Spark LLM API 不可用: {e}")


@pytest.fixture
def deepseek_available():
    if not settings.DEEPSEEK_API_KEY:
        pytest.skip(reason="DEEPSEEK_API_KEY 未配置")
    if not settings.DEEPSEEK_BASE_URL:
        pytest.skip(reason="DEEPSEEK_BASE_URL 未配置")
    try:
        LLMService.reset_cache()
        client = LLMService.get_client("deepseek")
        client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=5,
        )
    except Exception as e:
        pytest.skip(reason=f"DeepSeek API 不可用: {e}")


@pytest.fixture
def mineru_available():
    import requests

    try:
        requests.get(settings.MINERU_BASE_URL, timeout=10)
    except Exception as e:
        pytest.skip(reason=f"MinerU API 不可用: {e}")


@pytest.fixture
def response_timer():
    class _Timer:
        def __init__(self, name=""):
            self.name = name
            self.elapsed = 0.0

        def __enter__(self):
            self._start = time.monotonic()
            return self

        def __exit__(self, *args):
            self.elapsed = time.monotonic() - self._start

    return _Timer
