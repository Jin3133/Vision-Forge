# -*- coding: utf-8 -*-
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from core.state import state_manager, TaskState, SandboxConfig


class TestLangGraphWorkflow:
    """LangGraph 状态机集成测试"""

    def setup_method(self):
        """每个测试前清理可能残留的状态"""
        self.session_id = "test-langgraph-workflow"
        state_manager.clear_state(self.session_id)

    def teardown_method(self):
        """每个测试后清理状态"""
        state_manager.clear_state(self.session_id)

    @patch("main_workflow.generator")
    @patch("main_workflow.evaluator")
    @patch("main_workflow.tutor")
    @patch("main_workflow.architect")
    @patch("agents.intent_classifier.LLMService")
    def test_report_intent_skips_tutor_evaluator(self, mock_llm, mock_architect, mock_tutor, mock_evaluator, mock_generator):
        """报告意图应跳过 tutor 和 evaluator，直接到 generator"""
        from main_workflow import run_vision_forge_pipeline

        # Mock 意图分类器返回 report_generation
        mock_client = MagicMock()
        mock_llm.get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_message = MagicMock()
        mock_tool_call = MagicMock()
        mock_tool_call.function.name = "classify_intent"
        mock_tool_call.function.arguments = '{"intent": "report_generation", "confidence": 0.9}'
        mock_message.tool_calls = [mock_tool_call]
        mock_message.content = None
        mock_response.choices = [MagicMock(message=mock_message)]
        mock_client.chat.completions.create.return_value = mock_response

        # Mock architect - 不应该被调用（报告意图跳过）
        mock_architect.is_session_cancelled.return_value = False

        # Mock generator
        mock_generator.is_session_cancelled.return_value = False
        mock_generator.run.return_value = {
            "final_report_html": "<h1>Report</h1>",
            "current_step": "completed",
            "history": ["[Generator] 报告生成完毕"]
        }

        result = run_vision_forge_pipeline(self.session_id, "请帮我生成总结报告")

        # 验证 generator 被调用
        assert mock_generator.run.called

        # 验证 tutor 和 evaluator 没被调用
        assert not mock_tutor.run.called
        assert not mock_evaluator.run.called

        # 验证最终状态
        assert result.get("final_report_html") == "<h1>Report</h1>"

    @patch("main_workflow.generator")
    @patch("main_workflow.evaluator")
    @patch("main_workflow.tutor")
    @patch("main_workflow.architect")
    @patch("agents.intent_classifier.LLMService")
    def test_animation_intent_skips_tutor_evaluator(self, mock_llm, mock_architect, mock_tutor, mock_evaluator, mock_generator):
        """动画意图应跳过 tutor 和 evaluator"""
        from main_workflow import run_vision_forge_pipeline

        mock_client = MagicMock()
        mock_llm.get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_message = MagicMock()
        mock_tool_call = MagicMock()
        mock_tool_call.function.name = "classify_intent"
        mock_tool_call.function.arguments = '{"intent": "animation_generation", "confidence": 0.85}'
        mock_message.tool_calls = [mock_tool_call]
        mock_message.content = None
        mock_response.choices = [MagicMock(message=mock_message)]
        mock_client.chat.completions.create.return_value = mock_response

        mock_architect.is_session_cancelled.return_value = False
        mock_generator.is_session_cancelled.return_value = False
        mock_generator.run.return_value = {
            "animation_html": "<html>Animation</html>",
            "current_step": "completed",
            "history": ["[Generator] 动画生成完毕"]
        }

        result = run_vision_forge_pipeline(self.session_id, "请帮我生成动画演示")

        assert mock_generator.run.called
        assert not mock_tutor.run.called
        assert not mock_evaluator.run.called
        assert result.get("animation_html") == "<html>Animation</html>"

    @patch("main_workflow.generator")
    @patch("main_workflow.evaluator")
    @patch("main_workflow.tutor")
    @patch("main_workflow.architect")
    @patch("agents.intent_classifier.LLMService")
    def test_mixed_intent_goes_through_full_pipeline(self, mock_llm, mock_architect, mock_tutor, mock_evaluator, mock_generator):
        """混合意图应走完整流程：architect → tutor → evaluator → generator"""
        from main_workflow import run_vision_forge_pipeline

        mock_client = MagicMock()
        mock_llm.get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_message = MagicMock()
        mock_tool_call = MagicMock()
        mock_tool_call.function.name = "classify_intent"
        mock_tool_call.function.arguments = '{"intent": "mixed_generation", "confidence": 0.9}'
        mock_message.tool_calls = [mock_tool_call]
        mock_message.content = None
        mock_response.choices = [MagicMock(message=mock_message)]
        mock_client.chat.completions.create.return_value = mock_response

        mock_architect.is_session_cancelled.return_value = False
        mock_architect.run.return_value = {
            "intent": "mixed_generation",
            "confidence": 0.9,
            "learner_profile": {"domain": "农业"},
            "sandbox_config": SandboxConfig(task_type="目标检测").model_dump(),
            "current_step": "tutor_stage",
            "history": ["[Architect] 成功生成算子配置"]
        }

        mock_tutor.is_session_cancelled.return_value = False
        mock_tutor.run.return_value = {
            "evaluation_results": {"tutor_response": "讲解内容"},
            "current_step": "evaluator_stage",
            "history": ["[Tutor] 源码教研讲解生成完毕"]
        }

        mock_evaluator.is_session_cancelled.return_value = False
        mock_evaluator.run.return_value = {
            "evaluation_results": {"report": "评估报告"},
            "current_step": "generator_stage",
            "history": ["[Evaluator] 完成架构评估报告生成"]
        }

        mock_generator.is_session_cancelled.return_value = False
        mock_generator.run.return_value = {
            "final_report_html": "<h1>Report</h1>",
            "animation_html": "<html>Animation</html>",
            "current_step": "completed",
            "history": ["[Generator] 报告和动画生成完毕"]
        }

        result = run_vision_forge_pipeline(self.session_id, "请帮我生成报告和动画")

        # 验证所有 agent 都被调用
        assert mock_architect.run.called
        assert mock_tutor.run.called
        assert mock_evaluator.run.called
        assert mock_generator.run.called

        # 验证最终状态
        assert result.get("final_report_html") == "<h1>Report</h1>"
        assert result.get("animation_html") == "<html>Animation</html>"

    @patch("main_workflow.generator")
    @patch("main_workflow.evaluator")
    @patch("main_workflow.tutor")
    @patch("main_workflow.architect")
    @patch("agents.intent_classifier.LLMService")
    def test_session_cancellation(self, mock_llm, mock_architect, mock_tutor, mock_evaluator, mock_generator):
        """会话取消时应中断流程"""
        from main_workflow import run_vision_forge_pipeline

        mock_client = MagicMock()
        mock_llm.get_client.return_value = mock_client
        mock_response = MagicMock()
        mock_message = MagicMock()
        mock_tool_call = MagicMock()
        mock_tool_call.function.name = "classify_intent"
        mock_tool_call.function.arguments = '{"intent": "mixed_generation", "confidence": 0.9}'
        mock_message.tool_calls = [mock_tool_call]
        mock_message.content = None
        mock_response.choices = [MagicMock(message=mock_message)]
        mock_client.chat.completions.create.return_value = mock_response

        # 意图分类后，architect 检测到会话已取消
        mock_architect.is_session_cancelled.return_value = True

        result = run_vision_forge_pipeline(self.session_id, "测试取消")

        # 验证 architect.run 没被调用（因为会话已取消）
        assert not mock_architect.run.called
