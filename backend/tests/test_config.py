"""配置管理测试 — core/config.py 新增配置项"""

import pytest

from core.config import Settings, settings


class TestMinerUConfig:
    def test_mineru_base_url_exists(self):
        s = Settings()
        assert hasattr(s, "MINERU_BASE_URL")

    def test_mineru_base_url_default(self):
        s = Settings()
        assert s.MINERU_BASE_URL == "https://mineru.net"

    def test_mineru_max_file_size_exists(self):
        s = Settings()
        assert hasattr(s, "MINERU_MAX_FILE_SIZE")

    def test_mineru_max_file_size_default(self):
        s = Settings()
        assert s.MINERU_MAX_FILE_SIZE == 10 * 1024 * 1024

    def test_mineru_timeout_exists(self):
        s = Settings()
        assert hasattr(s, "MINERU_TIMEOUT")

    def test_mineru_timeout_default(self):
        s = Settings()
        assert s.MINERU_TIMEOUT == 120

    def test_mineru_poll_interval_exists(self):
        s = Settings()
        assert hasattr(s, "MINERU_POLL_INTERVAL")

    def test_mineru_poll_interval_default(self):
        s = Settings()
        assert s.MINERU_POLL_INTERVAL == 3


class TestDeepSeekModelConfig:
    def test_deepseek_report_model_exists(self):
        s = Settings()
        assert hasattr(s, "DEEPSEEK_REPORT_MODEL")

    def test_deepseek_report_model_default(self):
        s = Settings()
        assert s.DEEPSEEK_REPORT_MODEL == "deepseek-v4-pro"

    def test_deepseek_animation_model_exists(self):
        s = Settings()
        assert hasattr(s, "DEEPSEEK_ANIMATION_MODEL")

    def test_deepseek_animation_model_default(self):
        s = Settings()
        assert s.DEEPSEEK_ANIMATION_MODEL == "deepseek-v4-pro"


class TestReportConfig:
    def test_report_max_iterations_exists(self):
        s = Settings()
        assert hasattr(s, "REPORT_MAX_ITERATIONS")

    def test_report_max_iterations_default(self):
        s = Settings()
        assert s.REPORT_MAX_ITERATIONS == 30

    def test_report_temperature_exists(self):
        s = Settings()
        assert hasattr(s, "REPORT_TEMPERATURE")

    def test_report_temperature_default(self):
        s = Settings()
        assert s.REPORT_TEMPERATURE == 0.7


class TestAnimationConfig:
    def test_animation_temperature_exists(self):
        s = Settings()
        assert hasattr(s, "ANIMATION_TEMPERATURE")

    def test_animation_temperature_default(self):
        s = Settings()
        assert s.ANIMATION_TEMPERATURE == 0.7

    def test_animation_max_tokens_exists(self):
        s = Settings()
        assert hasattr(s, "ANIMATION_MAX_TOKENS")

    def test_animation_max_tokens_default(self):
        s = Settings()
        assert s.ANIMATION_MAX_TOKENS == 100000


class TestSettingsSingleton:
    def test_settings_instance_exists(self):
        assert settings is not None

    def test_settings_is_settings_instance(self):
        assert isinstance(settings, Settings)

    def test_settings_has_mineru_fields(self):
        assert settings.MINERU_BASE_URL == "https://mineru.net"
        assert settings.MINERU_TIMEOUT == 120

    def test_settings_has_deepseek_fields(self):
        assert settings.DEEPSEEK_REPORT_MODEL == "deepseek-v4-pro"
        assert settings.DEEPSEEK_ANIMATION_MODEL == "deepseek-v4-pro"
