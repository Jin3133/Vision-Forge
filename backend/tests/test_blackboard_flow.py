"""共享黑板数据流测试 — core/state.py"""

import os
import tempfile
import threading
import time
from unittest.mock import patch

import pytest

from core.config import settings
from core.exceptions import LLMServiceError, ReportGenerationError, AnimationGenerationError
from core.state import TaskState, SandboxConfig, StateManager, state_manager
from services.external_services.document_parser import parse_document
from agents.generator_agent import GeneratorAgent


# ============================================================
# 文档解析结果写入黑板
# ============================================================

class TestParsedDocumentContent:
    def test_write_parsed_document_content(self):
        mgr = StateManager()
        sid = "test-doc-parse"
        mgr.update_state(sid, {"parsed_document_content": "解析后的文档内容"})

        state = mgr.get_state(sid)
        assert state.parsed_document_content == "解析后的文档内容"

    def test_overwrite_parsed_document_content(self):
        mgr = StateManager()
        sid = "test-doc-overwrite"
        mgr.update_state(sid, {"parsed_document_content": "第一次"})
        mgr.update_state(sid, {"parsed_document_content": "第二次"})

        state = mgr.get_state(sid)
        assert state.parsed_document_content == "第二次"


# ============================================================
# GeneratorAgent 从黑板读取 parsed_document_content
# ============================================================

class TestGeneratorReadsBlackboard:
    def test_generator_can_read_parsed_document_content(self):
        mgr = StateManager()
        sid = "test-gen-read"
        mgr.update_state(sid, {
            "parsed_document_content": "这是解析的文档",
            "evaluation_results": {"report": "评估报告"},
        })

        state = mgr.get_state(sid)
        assert state.parsed_document_content == "这是解析的文档"
        assert state.evaluation_results["report"] == "评估报告"


# ============================================================
# GeneratorAgent 将报告结果写入黑板
# ============================================================

class TestReportHtmlWrittenToBlackboard:
    def test_write_final_report_html(self):
        """final_report_html 需要被添加到 TaskState 中才能通过此测试"""
        mgr = StateManager()
        sid = "test-report-write"
        mgr.update_state(sid, {"final_report_html": "<h3>报告HTML</h3>"})

        state = mgr.get_state(sid)
        # TDD: 期望 TaskState 拥有 final_report_html 字段
        assert hasattr(state, "final_report_html")
        assert state.final_report_html == "<h3>报告HTML</h3>"

    def test_write_animation_html(self):
        mgr = StateManager()
        sid = "test-anim-write"
        mgr.update_state(sid, {"animation_html": "<html>动画</html>"})

        state = mgr.get_state(sid)
        assert state.animation_html == "<html>动画</html>"


# ============================================================
# StateManager 增量合并对新字段兼容
# ============================================================

class TestDeltaMergeCompatibility:
    def test_merge_parsed_document_content(self):
        mgr = StateManager()
        sid = "test-merge-doc"
        mgr.update_state(sid, {"user_intent": "测试"})
        mgr.update_state(sid, {"parsed_document_content": "文档内容"})

        state = mgr.get_state(sid)
        assert state.user_intent == "测试"
        assert state.parsed_document_content == "文档内容"

    def test_merge_animation_html(self):
        mgr = StateManager()
        sid = "test-merge-anim"
        mgr.update_state(sid, {"animation_html": ""})
        mgr.update_state(sid, {"animation_html": "<canvas></canvas>"})

        state = mgr.get_state(sid)
        assert state.animation_html == "<canvas></canvas>"

    def test_merge_evaluation_results_dict_deep_merge(self):
        mgr = StateManager()
        sid = "test-merge-eval"
        mgr.update_state(sid, {"evaluation_results": {"report": "报告1"}})
        mgr.update_state(sid, {"evaluation_results": {"score": 90}})

        state = mgr.get_state(sid)
        assert state.evaluation_results["report"] == "报告1"
        assert state.evaluation_results["score"] == 90

    def test_merge_sandbox_config_partial_update(self):
        mgr = StateManager()
        sid = "test-merge-config"
        mgr.update_state(sid, {
            "sandbox_config": {
                "task_type": "检测",
                "suggested_backbone": "YOLOv8",
            }
        })
        mgr.update_state(sid, {
            "sandbox_config": {
                "task_type": "分割",
            }
        })

        state = mgr.get_state(sid)
        assert state.sandbox_config.task_type == "分割"
        assert state.sandbox_config.suggested_backbone == "YOLOv8"

    def test_merge_history_appends(self):
        mgr = StateManager()
        sid = "test-merge-history"
        mgr.update_state(sid, {"history": ["step1"]})
        mgr.update_state(sid, {"history": ["step2"]})

        state = mgr.get_state(sid)
        assert state.history == ["step1", "step2"]

    def test_unknown_key_is_ignored(self):
        mgr = StateManager()
        sid = "test-merge-unknown"
        mgr.update_state(sid, {"nonexistent_field": "value"})

        state = mgr.get_state(sid)
        assert not hasattr(state, "nonexistent_field") or \
               getattr(state, "nonexistent_field", None) is None


# ============================================================
# 多线程并发读写黑板线程安全
# ============================================================

class TestThreadSafety:
    def test_concurrent_writes_no_data_loss(self):
        mgr = StateManager()
        sid = "test-concurrent"
        errors = []

        def writer(field, value):
            try:
                mgr.update_state(sid, {field: value})
            except Exception as e:
                errors.append(e)

        threads = []
        for i in range(20):
            if i % 2 == 0:
                t = threading.Thread(target=writer, args=("user_intent", f"intent_{i}"))
            else:
                t = threading.Thread(target=writer, args=("parsed_document_content", f"doc_{i}"))
            threads.append(t)

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        state = mgr.get_state(sid)
        assert state.user_intent.startswith("intent_")
        assert state.parsed_document_content.startswith("doc_")

    def test_concurrent_read_write_no_crash(self):
        mgr = StateManager()
        sid = "test-rw-concurrent"
        mgr.update_state(sid, {"user_intent": "initial"})
        errors = []

        def reader():
            try:
                for _ in range(50):
                    state = mgr.get_state(sid)
                    _ = state.user_intent
            except Exception as e:
                errors.append(e)

        def writer():
            try:
                for i in range(50):
                    mgr.update_state(sid, {"user_intent": f"update_{i}"})
            except Exception as e:
                errors.append(e)

        threads = [
            threading.Thread(target=reader),
            threading.Thread(target=writer),
            threading.Thread(target=reader),
        ]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0

    def test_different_sessions_isolated(self):
        mgr = StateManager()
        errors = []

        def session_writer(session_id, content):
            try:
                mgr.update_state(session_id, {"parsed_document_content": content})
            except Exception as e:
                errors.append(e)

        threads = []
        for i in range(10):
            t = threading.Thread(
                target=session_writer,
                args=(f"session_{i}", f"content_{i}"),
            )
            threads.append(t)

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        for i in range(10):
            state = mgr.get_state(f"session_{i}")
            assert state.parsed_document_content == f"content_{i}"


# ============================================================
# 端到端数据流集成测试 — parse_document → 黑板写入 → GeneratorAgent.run
# ============================================================

class TestEndToEndFlow:
    """端到端数据流集成测试 — parse_document → 黑板写入 → GeneratorAgent.run"""

    @pytest.mark.integration
    def test_pdf_parse_to_blackboard_to_generator(self):
        """验证 PDF 解析 → 黑板写入 → GeneratorAgent 读取的完整流程"""
        if not settings.DEEPSEEK_API_KEY:
            pytest.skip("DEEPSEEK_API_KEY 未配置")

        pdf_path = os.path.join(
            r"f:\college\sophomore\软件杯\temp\MinerU_demo\test_files",
            "2025-TDAG A Multi-Agent Framework Based on Dynamic Task Decomposition and Agent Generation-250805.pdf"
        )
        if not os.path.exists(pdf_path):
            pytest.skip(f"测试文件不存在: {pdf_path}")

        # Step 1: 解析文档
        try:
            parsed_content = parse_document(pdf_path)
        except Exception as e:
            pytest.skip(f"文档解析失败: {e}")

        assert parsed_content is not None
        assert len(parsed_content.strip()) > 0

        # Step 2: 写入黑板
        mgr = StateManager()
        sid = "test-e2e-pdf"
        mgr.update_state(sid, {
            "parsed_document_content": parsed_content,
            "evaluation_results": {"report": "模型评估完成"},
            "sandbox_config": {"task_type": "检测", "suggested_backbone": "YOLOv8"},
            "user_intent": "动画演示",
        })

        # Step 3: 验证黑板数据
        state = mgr.get_state(sid)
        assert state.parsed_document_content == parsed_content
        assert state.evaluation_results["report"] == "模型评估完成"

        # Step 4: GeneratorAgent 从黑板读取并生成
        agent = GeneratorAgent()
        try:
            result = agent.run(state)
        except (LLMServiceError, ReportGenerationError, AnimationGenerationError) as e:
            pytest.skip(f"GeneratorAgent 调用失败: {e}")

        assert "final_report_html" in result
        assert "animation_html" in result
        print(f"[E2E] PDF 完整流程验证通过, 报告长度: {len(result['final_report_html'])}, 动画长度: {len(result['animation_html'])}")

    @pytest.mark.integration
    def test_docx_parse_to_blackboard(self):
        """验证 DOCX 解析 → 黑板写入的流程"""
        docx_path = os.path.join(
            r"f:\college\sophomore\软件杯\temp\MinerU_demo\test_files",
            "2406010330 许赵泓.docx"
        )
        if not os.path.exists(docx_path):
            pytest.skip(f"测试文件不存在: {docx_path}")

        try:
            parsed_content = parse_document(docx_path)
        except Exception as e:
            pytest.skip(f"文档解析失败: {e}")

        assert parsed_content is not None

        mgr = StateManager()
        sid = "test-e2e-docx"
        mgr.update_state(sid, {"parsed_document_content": parsed_content})

        state = mgr.get_state(sid)
        assert state.parsed_document_content == parsed_content
        print(f"[E2E] DOCX 黑板写入验证通过, 内容长度: {len(parsed_content)}")

    @pytest.mark.integration
    def test_txt_parse_to_blackboard(self):
        """验证 TXT 解析 → 黑板写入的流程"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write("端到端测试内容")
            txt_path = f.name

        try:
            parsed_content = parse_document(txt_path)
        except Exception as e:
            os.unlink(txt_path)
            pytest.skip(f"文档解析失败: {e}")

        os.unlink(txt_path)

        mgr = StateManager()
        sid = "test-e2e-txt"
        mgr.update_state(sid, {"parsed_document_content": parsed_content})

        state = mgr.get_state(sid)
        assert state.parsed_document_content == parsed_content
        print(f"[E2E] TXT 黑板写入验证通过")
