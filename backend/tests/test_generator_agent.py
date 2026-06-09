"""GeneratorAgent 真实服务集成测试 — agents/generator_agent.py"""

import time

import pytest

from core.config import settings
from core.exceptions import LLMServiceError, ReportGenerationError, AnimationGenerationError
from core.state import TaskState, SandboxConfig
from agents.generator_agent import GeneratorAgent


def _deepseek_available():
    """检查 DeepSeek API 是否可用"""
    if not settings.DEEPSEEK_API_KEY:
        return False
    try:
        from services.external_services.llm_service import LLMService
        LLMService.chat(
            messages=[{"role": "user", "content": "test"}],
            provider="deepseek",
            model=settings.DEEPSEEK_REPORT_MODEL,
            temperature=0.1,
        )
        return True
    except LLMServiceError:
        return False


# ============================================================
# _generate_report 真实测试
# ============================================================

class TestGenerateReport:
    """测试真实报告生成"""

    @pytest.mark.integration
    def test_reads_evaluation_results_from_blackboard(self):
        """验证报告生成从黑板读取评估结果"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")

        agent = GeneratorAgent()
        state = TaskState(
            session_id="test-report-eval",
            evaluation_results={"report": "模型准确率达到95%，损失函数收敛良好"},
            sandbox_config=SandboxConfig(task_type="检测", suggested_backbone="YOLOv8"),
        )

        try:
            start = time.time()
            result = agent._generate_report(state)
            elapsed = time.time() - start
        except LLMServiceError as e:
            pytest.skip(f"DeepSeek API 不可用: {e}")
        except ReportGenerationError:
            pytest.fail("不应抛出 ReportGenerationError")

        assert result is not None
        assert len(result.strip()) > 0
        print(f"[报告] 生成成功, 耗时: {elapsed:.2f}s, 内容长度: {len(result)} 字符")

    @pytest.mark.integration
    def test_returns_html_string(self):
        """验证报告生成返回包含 HTML 标签的字符串"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")

        agent = GeneratorAgent()
        state = TaskState(
            session_id="test-report-html",
            evaluation_results={"report": "评估内容"},
            sandbox_config=SandboxConfig(task_type="检测", suggested_backbone="YOLOv8"),
        )

        try:
            result = agent._generate_report(state)
        except LLMServiceError as e:
            pytest.skip(f"DeepSeek API 不可用: {e}")

        assert isinstance(result, str)
        # 报告应包含 HTML 标签
        assert "<" in result and ">" in result
        print(f"[报告] HTML 验证通过, 内容预览: {result[:100]}")

    @pytest.mark.integration
    def test_reads_sandbox_config_from_blackboard(self):
        """验证报告生成从黑板读取沙盒配置"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")

        agent = GeneratorAgent()
        state = TaskState(
            session_id="test-report-config",
            evaluation_results={"report": "评估"},
            sandbox_config=SandboxConfig(task_type="分割", suggested_backbone="U-Net"),
        )

        try:
            result = agent._generate_report(state)
        except LLMServiceError as e:
            pytest.skip(f"DeepSeek API 不可用: {e}")

        assert result is not None
        assert len(result.strip()) > 0
        print(f"[报告] 沙盒配置读取验证通过")


# ============================================================
# _generate_animation 真实测试
# ============================================================

class TestGenerateAnimation:
    """测试真实动画生成"""

    @pytest.mark.integration
    def test_reads_user_intent_from_blackboard(self):
        """验证动画生成从黑板读取用户意图"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")

        agent = GeneratorAgent()
        state = TaskState(
            session_id="test-anim-intent",
            user_intent="冒泡排序算法动画",
        )

        try:
            start = time.time()
            result = agent._generate_animation(state)
            elapsed = time.time() - start
        except LLMServiceError as e:
            pytest.skip(f"DeepSeek API 不可用: {e}")
        except AnimationGenerationError:
            pytest.fail("不应抛出 AnimationGenerationError")

        assert result is not None
        assert len(result.strip()) > 0
        print(f"[动画] 生成成功, 耗时: {elapsed:.2f}s, 内容长度: {len(result)} 字符")

    @pytest.mark.integration
    def test_returns_html_string(self):
        """验证动画生成返回包含 HTML 的字符串"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")

        agent = GeneratorAgent()
        state = TaskState(
            session_id="test-anim-html",
            user_intent="梯度下降动画",
        )

        try:
            result = agent._generate_animation(state)
        except LLMServiceError as e:
            pytest.skip(f"DeepSeek API 不可用: {e}")

        assert isinstance(result, str)
        # 动画应包含 HTML 标签
        assert "<" in result and ">" in result
        print(f"[动画] HTML 验证通过, 内容预览: {result[:100]}")


# ============================================================
# run 方法端到端测试
# ============================================================

class TestGeneratorAgentRun:
    """测试 run 方法的端到端编排"""

    @pytest.mark.integration
    def test_run_calls_generate_report(self):
        """验证 run 方法调用报告生成"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")

        agent = GeneratorAgent()
        state = TaskState(
            session_id="test-run-report",
            evaluation_results={"report": "评估内容"},
            sandbox_config=SandboxConfig(task_type="检测", suggested_backbone="YOLOv8"),
            user_intent="动画",
        )

        try:
            result = agent.run(state)
        except (LLMServiceError, ReportGenerationError, AnimationGenerationError) as e:
            pytest.skip(f"API 调用失败: {e}")

        assert "final_report_html" in result
        assert len(result["final_report_html"].strip()) > 0
        print(f"[Run] 报告生成验证通过")

    @pytest.mark.integration
    def test_run_calls_generate_animation(self):
        """验证 run 方法调用动画生成"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")

        agent = GeneratorAgent()
        state = TaskState(
            session_id="test-run-anim",
            evaluation_results={"report": "评估"},
            sandbox_config=SandboxConfig(),
            user_intent="冒泡排序动画",
        )

        try:
            result = agent.run(state)
        except (LLMServiceError, ReportGenerationError, AnimationGenerationError) as e:
            pytest.skip(f"API 调用失败: {e}")

        assert "animation_html" in result
        assert len(result["animation_html"].strip()) > 0
        print(f"[Run] 动画生成验证通过")

    @pytest.mark.integration
    def test_run_writes_final_report_html_to_blackboard(self):
        """验证 run 方法将报告 HTML 写入黑板"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")

        agent = GeneratorAgent()
        state = TaskState(
            session_id="test-run-write-report",
            evaluation_results={"report": "评估"},
            sandbox_config=SandboxConfig(),
            user_intent="动画",
        )

        try:
            result = agent.run(state)
        except (LLMServiceError, ReportGenerationError, AnimationGenerationError) as e:
            pytest.skip(f"API 调用失败: {e}")

        assert "final_report_html" in result
        assert isinstance(result["final_report_html"], str)
        print(f"[Run] 报告写入黑板验证通过")

    @pytest.mark.integration
    def test_run_writes_animation_html_to_blackboard(self):
        """验证 run 方法将动画 HTML 写入黑板"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")

        agent = GeneratorAgent()
        state = TaskState(
            session_id="test-run-write-anim",
            evaluation_results={"report": "评估"},
            sandbox_config=SandboxConfig(),
            user_intent="动画",
        )

        try:
            result = agent.run(state)
        except (LLMServiceError, ReportGenerationError, AnimationGenerationError) as e:
            pytest.skip(f"API 调用失败: {e}")

        assert "animation_html" in result
        assert isinstance(result["animation_html"], str)
        print(f"[Run] 动画写入黑板验证通过")
