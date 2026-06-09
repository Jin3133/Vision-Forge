# -*- coding: utf-8 -*-
"""函数工具单元测试 — agents/tools/report_tool.py & animation_tool.py"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pytest
from unittest.mock import patch, MagicMock

from agents.tools.report_tool import REPORT_TOOL_SCHEMA, generate_report
from agents.tools.animation_tool import ANIMATION_TOOL_SCHEMA, generate_animation
from core.exceptions import ReportGenerationError, AnimationGenerationError, LLMServiceError


# ============================================================
# report_tool
# ============================================================

class TestReportToolSchema:
    def test_report_tool_schema(self):
        schema = REPORT_TOOL_SCHEMA
        assert schema["type"] == "function"
        func = schema["function"]
        assert func["name"] == "generate_report"
        assert "sandbox_config" in func["parameters"]["properties"]
        assert "evaluation_report" in func["parameters"]["properties"]
        assert func["parameters"]["required"] == ["sandbox_config", "evaluation_report"]


class TestGenerateReport:
    @patch("agents.tools.report_tool.LLMService")
    def test_generate_report_success(self, mock_llm_cls):
        mock_llm_cls.chat.return_value = "<html><body>report</body></html>"
        result = generate_report(
            sandbox_config={"task_type": "sort", "nodes": []},
            evaluation_report="评估结果良好",
        )
        assert "<html>" in result
        mock_llm_cls.chat.assert_called_once()

    def test_generate_report_empty_config(self):
        with pytest.raises(ValueError, match="sandbox_config"):
            generate_report(sandbox_config={}, evaluation_report="report")

    def test_generate_report_empty_report(self):
        with pytest.raises(ValueError, match="evaluation_report"):
            generate_report(sandbox_config={"a": 1}, evaluation_report="")

    @patch("agents.tools.report_tool.LLMService")
    def test_generate_report_llm_error(self, mock_llm_cls):
        mock_llm_cls.chat.side_effect = LLMServiceError("LLM down")
        with pytest.raises(ReportGenerationError):
            generate_report(
                sandbox_config={"task_type": "sort"},
                evaluation_report="report",
            )


# ============================================================
# animation_tool
# ============================================================

class TestAnimationToolSchema:
    def test_animation_tool_schema(self):
        schema = ANIMATION_TOOL_SCHEMA
        assert schema["type"] == "function"
        func = schema["function"]
        assert func["name"] == "generate_animation"
        assert "user_intent" in func["parameters"]["properties"]
        assert func["parameters"]["required"] == ["user_intent"]


class TestGenerateAnimation:
    @patch("agents.tools.animation_tool.LLMService")
    def test_generate_animation_success(self, mock_llm_cls):
        mock_llm_cls.chat.return_value = "```html\n<html><body>anim</body></html>\n```"
        result = generate_animation(user_intent="冒泡排序")
        assert "<html>" in result
        mock_llm_cls.chat.assert_called_once()

    def test_generate_animation_empty_intent(self):
        with pytest.raises(ValueError, match="user_intent"):
            generate_animation(user_intent="")

    @patch("agents.tools.animation_tool.LLMService")
    def test_generate_animation_llm_error(self, mock_llm_cls):
        mock_llm_cls.chat.side_effect = LLMServiceError("LLM down")
        with pytest.raises(AnimationGenerationError):
            generate_animation(user_intent="冒泡排序")
