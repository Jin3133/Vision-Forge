# -*- coding: utf-8 -*-
"""基于 LLM function_call 的意图分类器"""

import json
from typing import Tuple

from core.config import settings
from core.logger import logger
from services.external_services.llm_service import LLMService

# function_call 工具 schema
CLASSIFY_INTENT_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "classify_intent",
        "description": "根据用户意图和文档内容，分类用户的核心意图",
        "parameters": {
            "type": "object",
            "properties": {
                "intent": {
                    "type": "string",
                    "enum": ["report_generation", "animation_generation", "mixed_generation"],
                    "description": "用户的核心意图类型",
                },
                "confidence": {
                    "type": "number",
                    "description": "意图分类的置信度，0.0-1.0之间",
                },
            },
            "required": ["intent", "confidence"],
        },
    },
}

# 置信度阈值
CONFIDENCE_THRESHOLD = 0.7

_VALID_INTENTS = {"report_generation", "animation_generation", "mixed_generation"}


class IntentClassifier:
    """基于 LLM function_call 的意图分类器"""

    def __init__(self, provider: str = "spark"):
        self.provider = provider

    def classify(self, user_intent: str, doc_content: str = "") -> Tuple[str, float]:
        """
        分类用户意图

        Args:
            user_intent: 用户输入的意图文本
            doc_content: 可选的文档内容，作为上下文

        Returns:
            (intent, confidence) 元组
        """
        messages = [
            {"role": "system", "content": self._build_system_prompt()},
            {"role": "user", "content": self._build_user_message(user_intent, doc_content)},
        ]

        try:
            client = LLMService.get_client(self.provider)
            model = settings.SPARK_MODEL_VERSION if self.provider == "spark" else settings.DEEPSEEK_REPORT_MODEL
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=[CLASSIFY_INTENT_TOOL_SCHEMA],
                tool_choice={"type": "function", "function": {"name": "classify_intent"}},
                temperature=0.0,
            )

            message = response.choices[0].message
            if not message.tool_calls:
                logger.warning("[IntentClassifier] LLM 未返回 tool_calls，回退到 mixed_generation")
                return "mixed_generation", 0.5

            arguments = json.loads(message.tool_calls[0].function.arguments)
            intent = arguments.get("intent", "mixed_generation")
            confidence = float(arguments.get("confidence", 0.5))

            if confidence < CONFIDENCE_THRESHOLD:
                logger.info(
                    f"[IntentClassifier] 置信度 {confidence} 低于阈值 {CONFIDENCE_THRESHOLD}，回退到 mixed_generation"
                )
                intent = "mixed_generation"

            if intent not in _VALID_INTENTS:
                logger.warning(f"[IntentClassifier] 无效意图 {intent}，回退到 mixed_generation")
                intent = "mixed_generation"

            logger.info(f"[IntentClassifier] 分类结果: intent={intent}, confidence={confidence}")
            return intent, confidence

        except Exception as e:
            logger.error(f"[IntentClassifier] 分类失败: {e}")
            return "mixed_generation", 0.0

    def _build_system_prompt(self) -> str:
        return """你是一个意图分类器。根据用户的输入，判断用户的核心意图。

意图类型说明：
- report_generation：用户想要生成报告、总结、评估文档等文字性输出
- animation_generation：用户想要生成动画、演示、可视化等动态展示
- mixed_generation：用户同时需要报告和动画，或意图不明确

分类依据：
- 包含"报告"、"总结"、"评估"、"分析"等关键词 → report_generation
- 包含"动画"、"演示"、"可视化"、"展示"等关键词 → animation_generation
- 同时包含两类关键词，或意图不明确 → mixed_generation

请调用 classify_intent 函数返回分类结果。"""

    def _build_user_message(self, user_intent: str, doc_content: str = "") -> str:
        message = f"用户意图：{user_intent}"
        if doc_content:
            message += f"\n\n文档内容摘要：{doc_content[:500]}"
        return message
