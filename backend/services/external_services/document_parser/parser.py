"""多模态文档解析主函数"""

import logging
import os

from core.exceptions import (
    UnsupportedFileTypeError,
    ParseTimeoutError,
    MinerUApiError,
    MinerURateLimitError,
    MinerUTimeoutError,
)
from .fallback_parsers import get_fallback_parser

logger = logging.getLogger(__name__)

# MinerU Agent 轻量解析 API 支持的文件扩展名
MINERU_SUPPORTED_EXTS = {
    ".pdf", ".doc", ".docx", ".ppt", ".pptx",
    ".png", ".jpg", ".jpeg", ".jp2", ".webp", ".gif", ".bmp",
}

# 所有支持的文件扩展名（MinerU + 备选方案）
ALL_SUPPORTED_EXTS = MINERU_SUPPORTED_EXTS | {
    ".txt", ".md", ".log", ".py", ".js", ".json", ".xml", ".html", ".css",
    ".yaml", ".yml", ".ini", ".cfg", ".conf", ".sh", ".bat", ".sql", ".r",
    ".java", ".c", ".cpp", ".h", ".hpp", ".go", ".rs", ".rb", ".php",
    ".swift", ".kt", ".ts", ".tsx", ".jsx", ".vue", ".svelte",
    ".csv", ".tsv",
    ".xlsx", ".xls",
}


def fallback_parse(file_path):
    """使用备选解析方案解析文件，无可用解析器时返回 None。"""
    parser = get_fallback_parser(file_path)
    if parser is not None:
        return parser(file_path)
    return None


def parse_document(file_path, language="ch", enable_table=True, enable_formula=True,
                   is_ocr=False, page_range=None, timeout=None, poll_interval=None):
    """多模态文档解析主函数。

    根据文件类型自动选择解析通道：
    1. MinerU 支持的文件类型（PDF/PPT/DOC/DOCX/图片）→ MinerU Agent 轻量解析 API
    2. 其他文件类型 → 备选解析方案
    3. MinerU API 失败时 → 自动降级到备选解析方案（如果存在）

    Args:
        file_path: 文件路径
        language: 解析语言，默认 "ch"
        enable_table: 是否启用表格识别，默认 True
        enable_formula: 是否启用公式识别，默认 True
        is_ocr: 是否启用 OCR，默认 False
        page_range: 页码范围，如 "1-5"
        timeout: MinerU API 轮询超时秒数
        poll_interval: 轮询间隔秒数

    Returns:
        str: 解析结果字符串

    Raises:
        FileNotFoundError: 文件不存在
        UnsupportedFileTypeError: 不支持的文件类型
        ParseTimeoutError: 解析超时且无备选方案
    """
    # 通过包模块访问，使 @patch 在 importlib.reload 后仍能生效
    import services.external_services.document_parser as _pkg
    _mineru_parse = _pkg.mineru_parse
    _fallback_parse = _pkg.fallback_parse
    _settings = _pkg.settings

    timeout = timeout or _settings.MINERU_TIMEOUT
    poll_interval = poll_interval or _settings.MINERU_POLL_INTERVAL

    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    if ext not in ALL_SUPPORTED_EXTS:
        raise UnsupportedFileTypeError(f"不支持的文件类型: {ext}")

    # MinerU 支持的文件类型 → 优先使用 MinerU API
    if ext in MINERU_SUPPORTED_EXTS:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        try:
            result = _mineru_parse(
                file_path,
                language=language,
                enable_table=enable_table,
                enable_formula=enable_formula,
                is_ocr=is_ocr,
                page_range=page_range,
                timeout=timeout,
                poll_interval=poll_interval,
                base_url=_settings.MINERU_BASE_URL,
            )
            return result
        except (MinerURateLimitError, MinerUTimeoutError) as e:
            logger.warning("MinerU API 失败 (%s: %s)，尝试降级到备选方案", type(e).__name__, e)
            fallback_result = _fallback_parse(file_path)
            if fallback_result is not None:
                return fallback_result
            if isinstance(e, MinerUTimeoutError):
                raise ParseTimeoutError(f"MinerU API 超时且无备选方案: {e}") from e
            raise
        except MinerUApiError as e:
            logger.warning("MinerU API 错误 (%s)，尝试降级到备选方案", e)
            fallback_result = _fallback_parse(file_path)
            if fallback_result is not None:
                return fallback_result
            raise
        except Exception as e:
            logger.warning("MinerU API 异常 (%s: %s)，尝试降级到备选方案", type(e).__name__, e)
            fallback_result = _fallback_parse(file_path)
            if fallback_result is not None:
                return fallback_result
            raise

    # 其他文件类型 → 使用备选解析方案
    fallback_result = _fallback_parse(file_path)
    if fallback_result is not None:
        return fallback_result

    # 理论上不会到达这里（前面已检查 ext in ALL_SUPPORTED_EXTS）
    raise UnsupportedFileTypeError(f"不支持的文件类型: {ext}")
