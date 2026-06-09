# -*- coding: utf-8 -*-
import sys
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from agents.intent_classifier import IntentClassifier, CLASSIFY_INTENT_TOOL_SCHEMA, CONFIDENCE_THRESHOLD


class TestIntentClassifier:
    """意图分类器单元测试"""

    def _mock_tool_call_response(self, intent: str, confidence: float):
        """创建模拟的 LLM tool_call 响应"""
        mock_response = MagicMock()
        mock_message = MagicMock()
        mock_tool_call = MagicMock()
        mock_tool_call.function.name = "classify_intent"
        mock_tool_call.function.arguments = json.dumps({
            "intent": intent,
            "confidence": confidence
        })
        mock_message.tool_calls = [mock_tool_call]
        mock_message.content = None
        mock_response.choices = [MagicMock(message=mock_message)]
        return mock_response

    @patch("agents.intent_classifier.LLMService")
    def test_report_intent(self, mock_llm_service):
        """测试报告意图识别"""
        mock_client = MagicMock()
        mock_llm_service.get_client.return_value = mock_client
        mock_client.chat.completions.create.return_value = self._mock_tool_call_response("report_generation", 0.9)

        classifier = IntentClassifier()
        intent, confidence = classifier.classify("请帮我生成总结报告")

        assert intent == "report_generation"
        assert confidence >= 0.7

    @patch("agents.intent_classifier.LLMService")
    def test_animation_intent(self, mock_llm_service):
        """测试动画意图识别"""
        mock_client = MagicMock()
        mock_llm_service.get_client.return_value = mock_client
        mock_client.chat.completions.create.return_value = self._mock_tool_call_response("animation_generation", 0.85)

        classifier = IntentClassifier()
        intent, confidence = classifier.classify("请帮我生成动画演示")

        assert intent == "animation_generation"
        assert confidence >= 0.7

    @patch("agents.intent_classifier.LLMService")
    def test_mixed_intent(self, mock_llm_service):
        """测试混合意图识别"""
        mock_client = MagicMock()
        mock_llm_service.get_client.return_value = mock_client
        mock_client.chat.completions.create.return_value = self._mock_tool_call_response("mixed_generation", 0.8)

        classifier = IntentClassifier()
        intent, confidence = classifier.classify("请帮我生成报告和动画")

        assert intent == "mixed_generation"
        assert confidence >= 0.7

    @patch("agents.intent_classifier.LLMService")
    def test_low_confidence_fallback(self, mock_llm_service):
        """测试低置信度回退到 mixed_generation"""
        mock_client = MagicMock()
        mock_llm_service.get_client.return_value = mock_client
        mock_client.chat.completions.create.return_value = self._mock_tool_call_response("report_generation", 0.5)

        classifier = IntentClassifier()
        intent, confidence = classifier.classify("帮我看看这个")

        assert intent == "mixed_generation"  # 回退
        assert confidence == 0.5  # 保留实际置信度

    @patch("agents.intent_classifier.LLMService")
    def test_no_tool_calls_fallback(self, mock_llm_service):
        """测试 LLM 未返回 tool_calls 时的回退"""
        mock_client = MagicMock()
        mock_llm_service.get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_message = MagicMock()
        mock_message.tool_calls = None  # 无 tool_calls
        mock_message.content = "这是一个报告请求"
        mock_response.choices = [MagicMock(message=mock_message)]
        mock_client.chat.completions.create.return_value = mock_response

        classifier = IntentClassifier()
        intent, confidence = classifier.classify("随便说点什么")

        assert intent == "mixed_generation"
        assert confidence == 0.5

    @patch("agents.intent_classifier.LLMService")
    def test_invalid_intent_fallback(self, mock_llm_service):
        """测试无效意图值回退"""
        mock_client = MagicMock()
        mock_llm_service.get_client.return_value = mock_client
        mock_client.chat.completions.create.return_value = self._mock_tool_call_response("unknown_intent", 0.9)

        classifier = IntentClassifier()
        intent, confidence = classifier.classify("测试无效意图")

        assert intent == "mixed_generation"

    @patch("agents.intent_classifier.LLMService")
    def test_exception_fallback(self, mock_llm_service):
        """测试异常时的安全回退"""
        mock_client = MagicMock()
        mock_llm_service.get_client.return_value = mock_client
        mock_client.chat.completions.create.side_effect = Exception("API Error")

        classifier = IntentClassifier()
        intent, confidence = classifier.classify("测试异常")

        assert intent == "mixed_generation"
        assert confidence == 0.0

    @patch("agents.intent_classifier.LLMService")
    def test_with_doc_content(self, mock_llm_service):
        """测试带文档内容的分类"""
        mock_client = MagicMock()
        mock_llm_service.get_client.return_value = mock_client
        mock_client.chat.completions.create.return_value = self._mock_tool_call_response("report_generation", 0.9)

        classifier = IntentClassifier()
        intent, confidence = classifier.classify("分析文档", "这是文档内容...")

        assert intent == "report_generation"
        # 验证调用时 user message 包含文档内容
        call_args = mock_client.chat.completions.create.call_args
        messages = call_args.kwargs.get("messages", call_args[1].get("messages", []))
        user_msg = messages[-1]["content"]
        assert "文档内容" in user_msg
