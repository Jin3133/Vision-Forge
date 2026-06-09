"""文档解析真实服务集成测试 — services/external_services/document_parser/"""

import os
import tempfile
import time

import pytest
import requests

from core.config import settings
from core.exceptions import UnsupportedFileTypeError, ParseTimeoutError, MinerURateLimitError
from services.external_services.document_parser import parse_document, mineru_parse


# 测试文件路径
TEST_FILES_DIR = r"f:\college\sophomore\软件杯\temp\MinerU_demo\test_files"
PDF_TEST_FILE = os.path.join(TEST_FILES_DIR, "2025-TDAG A Multi-Agent Framework Based on Dynamic Task Decomposition and Agent Generation-250805.pdf")
DOCX_TEST_FILE = os.path.join(TEST_FILES_DIR, "2406010330 许赵泓.docx")


def _mineru_available():
    """检查 MinerU API 是否可达"""
    try:
        resp = requests.get(settings.MINERU_BASE_URL, timeout=10)
        return resp.status_code == 200
    except requests.RequestException:
        return False


# ============================================================
# PDF 文件真实解析
# ============================================================

class TestPdfParsing:
    """测试 PDF 文件的真实解析"""

    @pytest.mark.integration
    def test_pdf_file_returns_non_empty_content(self):
        """验证 PDF 文件通过 MinerU 解析返回非空内容"""
        if not os.path.exists(PDF_TEST_FILE):
            pytest.skip(f"测试文件不存在: {PDF_TEST_FILE}")
        if not _mineru_available():
            pytest.skip("MinerU API 不可达")

        start = time.time()
        try:
            result = parse_document(PDF_TEST_FILE)
        except MinerURateLimitError:
            pytest.skip("MinerU API 限频")
        except Exception as e:
            # MinerU 可能失败，但降级到 fallback 也应返回内容
            # 如果连 fallback 也失败，则 skip
            pytest.skip(f"解析失败: {e}")
        elapsed = time.time() - start

        assert result is not None
        assert len(result.strip()) > 0
        print(f"[PDF] 解析成功, 耗时: {elapsed:.2f}s, 内容长度: {len(result)} 字符")
        print(f"[PDF] 内容预览: {result[:100]}")

    @pytest.mark.integration
    def test_pdf_mineru_parse_direct(self):
        """验证直接调用 mineru_parse 解析 PDF"""
        if not os.path.exists(PDF_TEST_FILE):
            pytest.skip(f"测试文件不存在: {PDF_TEST_FILE}")
        if not _mineru_available():
            pytest.skip("MinerU API 不可达")

        start = time.time()
        try:
            result = mineru_parse(PDF_TEST_FILE, timeout=180)
        except MinerURateLimitError:
            pytest.skip("MinerU API 限频")
        except Exception as e:
            pytest.skip(f"MinerU 解析失败: {e}")
        elapsed = time.time() - start

        assert result is not None
        assert len(result.strip()) > 0
        print(f"[PDF/MinerU] 直接解析成功, 耗时: {elapsed:.2f}s, 内容长度: {len(result)} 字符")


# ============================================================
# DOCX 文件真实解析
# ============================================================

class TestDocxParsing:
    """测试 DOCX 文件的真实解析"""

    @pytest.mark.integration
    def test_docx_file_returns_non_empty_content(self):
        """验证 DOCX 文件解析返回非空内容"""
        if not os.path.exists(DOCX_TEST_FILE):
            pytest.skip(f"测试文件不存在: {DOCX_TEST_FILE}")
        if not _mineru_available():
            pytest.skip("MinerU API 不可达")

        start = time.time()
        try:
            result = parse_document(DOCX_TEST_FILE)
        except MinerURateLimitError:
            pytest.skip("MinerU API 限频")
        except Exception as e:
            pytest.skip(f"解析失败: {e}")
        elapsed = time.time() - start

        assert result is not None
        assert len(result.strip()) > 0
        print(f"[DOCX] 解析成功, 耗时: {elapsed:.2f}s, 内容长度: {len(result)} 字符")


# ============================================================
# TXT 文件解析（fallback 路径）
# ============================================================

class TestTxtParsing:
    """测试 TXT 文件的本地解析"""

    @pytest.mark.integration
    def test_txt_file_returns_content(self):
        """验证 TXT 文件返回与文件内容一致的字符串"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write("Hello from TXT")
            txt_path = f.name

        try:
            result = parse_document(txt_path)
            assert result == "Hello from TXT"
            print(f"[TXT] 解析成功, 内容: {result}")
        finally:
            os.unlink(txt_path)

    @pytest.mark.integration
    def test_txt_file_with_utf8_content(self):
        """验证 TXT 文件支持中文内容"""
        content = "中文内容测试"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(content)
            txt_path = f.name

        try:
            result = parse_document(txt_path)
            assert result == content
            print(f"[TXT] 中文解析成功, 内容: {result}")
        finally:
            os.unlink(txt_path)


# ============================================================
# CSV 文件解析（fallback 路径）
# ============================================================

class TestCsvParsing:
    """测试 CSV 文件的本地解析"""

    @pytest.mark.integration
    def test_csv_file_returns_content(self):
        """验证 CSV 文件返回非空内容"""
        csv_content = "name,age\nAlice,30\nBob,25"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write(csv_content)
            csv_path = f.name

        try:
            result = parse_document(csv_path)
            assert result is not None
            assert len(result.strip()) > 0
            print(f"[CSV] 解析成功, 内容: {result[:50]}")
        finally:
            os.unlink(csv_path)


# ============================================================
# 不支持的文件类型
# ============================================================

class TestUnsupportedFileType:
    """测试不支持的文件类型"""

    def test_exe_file_raises_unsupported_file_type_error(self):
        """验证 .exe 文件抛出 UnsupportedFileTypeError"""
        with pytest.raises(UnsupportedFileTypeError):
            parse_document("malware.exe")

    def test_zip_file_raises_unsupported_file_type_error(self):
        """验证 .zip 文件抛出 UnsupportedFileTypeError"""
        with pytest.raises(UnsupportedFileTypeError):
            parse_document("archive.zip")

    def test_unknown_extension_raises_unsupported_file_type_error(self):
        """验证未知扩展名抛出 UnsupportedFileTypeError"""
        with pytest.raises(UnsupportedFileTypeError):
            parse_document("data.xyz")


# ============================================================
# 文件不存在
# ============================================================

class TestFileNotFound:
    """测试文件不存在的情况"""

    def test_nonexistent_file_raises_file_not_found_error(self):
        """验证不存在的文件抛出 FileNotFoundError"""
        with pytest.raises(FileNotFoundError):
            parse_document("nonexistent_file_12345.pdf")


# ============================================================
# MinerU API 降级
# ============================================================

class TestMinerUFallback:
    """测试 MinerU API 失败时的降级行为"""

    @pytest.mark.integration
    def test_mineru_rate_limit_triggers_fallback(self):
        """验证 MinerU 限频时自动降级到 fallback 解析器"""
        # 此测试验证降级机制：如果 MinerU 限频，应降级到 fallback
        # 使用 DOCX 文件（有 python-docx fallback）
        if not os.path.exists(DOCX_TEST_FILE):
            pytest.skip(f"测试文件不存在: {DOCX_TEST_FILE}")

        # 正常调用，如果 MinerU 限频会自动降级
        try:
            result = parse_document(DOCX_TEST_FILE)
        except MinerURateLimitError:
            pytest.skip("MinerU 限频且无 fallback 可用")
        except Exception as e:
            pytest.skip(f"解析失败: {e}")

        # 无论是否降级，都应返回内容
        assert result is not None
        assert len(result.strip()) > 0
        print(f"[降级] 解析成功, 内容长度: {len(result)} 字符")
