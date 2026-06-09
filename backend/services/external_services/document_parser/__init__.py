__all__ = ["parse_document", "mineru_parse", "mineru_parse_url", "get_fallback_parser", "fallback_parse"]


def __getattr__(name):
    """延迟导入，使 @patch 在 importlib.reload 后仍能生效。"""
    if name == "parse_document":
        from .parser import parse_document
        return parse_document
    if name == "fallback_parse":
        from .parser import fallback_parse
        return fallback_parse
    if name == "mineru_parse":
        from .mineru_api import mineru_parse
        return mineru_parse
    if name == "mineru_parse_url":
        from .mineru_api import mineru_parse_url
        return mineru_parse_url
    if name == "get_fallback_parser":
        from .fallback_parsers import get_fallback_parser
        return get_fallback_parser
    if name == "settings":
        from core.config import settings
        return settings
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
