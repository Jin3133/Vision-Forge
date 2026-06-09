"""统一异常体系测试 — core/exceptions.py"""

import pytest

from core.exceptions import (
    VisionForgeError,
    LLMServiceError,
    LLMRateLimitError,
    LLMTimeoutError,
    DocumentParseError,
    UnsupportedFileTypeError,
    ParseTimeoutError,
    MinerUApiError,
    MinerURateLimitError,
    MinerUTimeoutError,
    ReportGenerationError,
    AnimationGenerationError,
    ConfigurationError,
)


# ============================================================
# 1. VisionForgeError 基类
# ============================================================

class TestVisionForgeError:
    def test_has_message_attribute(self):
        err = VisionForgeError("something went wrong")
        assert err.message == "something went wrong"

    def test_has_code_attribute(self):
        err = VisionForgeError("err", code="E001")
        assert err.code == "E001"

    def test_code_defaults_none(self):
        err = VisionForgeError("err")
        assert err.code is None

    def test_has_details_attribute(self):
        err = VisionForgeError("err", details={"key": "val"})
        assert err.details == {"key": "val"}

    def test_details_defaults_none(self):
        err = VisionForgeError("err")
        assert err.details is None

    def test_str_returns_message(self):
        err = VisionForgeError("hello")
        assert str(err) == "hello"

    def test_is_exception_subclass(self):
        assert issubclass(VisionForgeError, Exception)

    def test_can_be_raised_and_caught(self):
        with pytest.raises(VisionForgeError, match="boom"):
            raise VisionForgeError("boom")

    def test_caught_by_base_exception(self):
        with pytest.raises(Exception):
            raise VisionForgeError("any")


# ============================================================
# 2. LLMServiceError
# ============================================================

class TestLLMServiceError:
    def test_inherits_vision_forge_error(self):
        assert issubclass(LLMServiceError, VisionForgeError)

    def test_has_provider_attribute(self):
        err = LLMServiceError("fail", provider="spark")
        assert err.provider == "spark"

    def test_provider_defaults_empty(self):
        err = LLMServiceError("fail")
        assert err.provider == ""

    def test_passes_code_and_details(self):
        err = LLMServiceError("fail", provider="deepseek", code="E002", details={"a": 1})
        assert err.code == "E002"
        assert err.details == {"a": 1}
        assert err.provider == "deepseek"

    def test_can_be_raised_and_caught(self):
        with pytest.raises(LLMServiceError):
            raise LLMServiceError("llm error")

    def test_caught_by_vision_forge_error(self):
        with pytest.raises(VisionForgeError):
            raise LLMServiceError("llm error")


# ============================================================
# 3. LLMRateLimitError / LLMTimeoutError
# ============================================================

class TestLLMRateLimitError:
    def test_inherits_llm_service_error(self):
        assert issubclass(LLMRateLimitError, LLMServiceError)

    def test_inherits_vision_forge_error(self):
        assert issubclass(LLMRateLimitError, VisionForgeError)

    def test_can_be_raised_and_caught(self):
        with pytest.raises(LLMRateLimitError):
            raise LLMRateLimitError("rate limited")

    def test_caught_by_llm_service_error(self):
        with pytest.raises(LLMServiceError):
            raise LLMRateLimitError("rate limited")


class TestLLMTimeoutError:
    def test_inherits_llm_service_error(self):
        assert issubclass(LLMTimeoutError, LLMServiceError)

    def test_can_be_raised_and_caught(self):
        with pytest.raises(LLMTimeoutError):
            raise LLMTimeoutError("timeout")

    def test_caught_by_llm_service_error(self):
        with pytest.raises(LLMServiceError):
            raise LLMTimeoutError("timeout")


# ============================================================
# 4. DocumentParseError
# ============================================================

class TestDocumentParseError:
    def test_inherits_vision_forge_error(self):
        assert issubclass(DocumentParseError, VisionForgeError)

    def test_can_be_raised_and_caught(self):
        with pytest.raises(DocumentParseError):
            raise DocumentParseError("parse error")


# ============================================================
# 5. UnsupportedFileTypeError / ParseTimeoutError
# ============================================================

class TestUnsupportedFileTypeError:
    def test_inherits_document_parse_error(self):
        assert issubclass(UnsupportedFileTypeError, DocumentParseError)

    def test_caught_by_document_parse_error(self):
        with pytest.raises(DocumentParseError):
            raise UnsupportedFileTypeError(".xyz not supported")

    def test_caught_by_vision_forge_error(self):
        with pytest.raises(VisionForgeError):
            raise UnsupportedFileTypeError(".xyz")


class TestParseTimeoutError:
    def test_inherits_document_parse_error(self):
        assert issubclass(ParseTimeoutError, DocumentParseError)

    def test_caught_by_document_parse_error(self):
        with pytest.raises(DocumentParseError):
            raise ParseTimeoutError("timeout")


# ============================================================
# 6. MinerUApiError 及其子类
# ============================================================

class TestMinerUApiError:
    def test_inherits_document_parse_error(self):
        assert issubclass(MinerUApiError, DocumentParseError)

    def test_caught_by_document_parse_error(self):
        with pytest.raises(DocumentParseError):
            raise MinerUApiError("mineru api error")


class TestMinerURateLimitError:
    def test_inherits_mineru_api_error(self):
        assert issubclass(MinerURateLimitError, MinerUApiError)

    def test_caught_by_mineru_api_error(self):
        with pytest.raises(MinerUApiError):
            raise MinerURateLimitError("rate limited")

    def test_caught_by_document_parse_error(self):
        with pytest.raises(DocumentParseError):
            raise MinerURateLimitError("rate limited")


class TestMinerUTimeoutError:
    def test_inherits_mineru_api_error(self):
        assert issubclass(MinerUTimeoutError, MinerUApiError)

    def test_caught_by_mineru_api_error(self):
        with pytest.raises(MinerUApiError):
            raise MinerUTimeoutError("timeout")


# ============================================================
# 7. ReportGenerationError / AnimationGenerationError
# ============================================================

class TestReportGenerationError:
    def test_inherits_vision_forge_error(self):
        assert issubclass(ReportGenerationError, VisionForgeError)

    def test_can_be_raised_and_caught(self):
        with pytest.raises(ReportGenerationError):
            raise ReportGenerationError("report failed")


class TestAnimationGenerationError:
    def test_inherits_vision_forge_error(self):
        assert issubclass(AnimationGenerationError, VisionForgeError)

    def test_can_be_raised_and_caught(self):
        with pytest.raises(AnimationGenerationError):
            raise AnimationGenerationError("animation failed")


# ============================================================
# 8. ConfigurationError
# ============================================================

class TestConfigurationError:
    def test_inherits_vision_forge_error(self):
        assert issubclass(ConfigurationError, VisionForgeError)

    def test_has_missing_keys_attribute(self):
        err = ConfigurationError("missing config", missing_keys=["API_KEY", "BASE_URL"])
        assert err.missing_keys == ["API_KEY", "BASE_URL"]

    def test_missing_keys_defaults_empty_list(self):
        err = ConfigurationError("missing config")
        assert err.missing_keys == []

    def test_passes_code_and_details(self):
        err = ConfigurationError("err", missing_keys=["X"], code="CFG001", details={"env": "prod"})
        assert err.code == "CFG001"
        assert err.details == {"env": "prod"}
        assert err.missing_keys == ["X"]

    def test_can_be_raised_and_caught(self):
        with pytest.raises(ConfigurationError):
            raise ConfigurationError("bad config")

    def test_caught_by_vision_forge_error(self):
        with pytest.raises(VisionForgeError):
            raise ConfigurationError("bad config")
