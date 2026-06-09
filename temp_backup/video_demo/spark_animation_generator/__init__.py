"""
Spark Animation Generator - 基于星火LLM的HTML动画生成器
"""

from .llm_agent import SparkLLMAgent
from .prompts import PromptTemplate, DEFAULT_ANIMATION_PROMPT
from .config import SparkConfig
from .exceptions import LLMGenerationError, ConfigurationError, PromptTemplateError

__version__ = "1.0.0"
__all__ = [
    "SparkLLMAgent",
    "PromptTemplate",
    "DEFAULT_ANIMATION_PROMPT",
    "SparkConfig",
    "LLMGenerationError",
    "ConfigurationError",
    "PromptTemplateError",
]
