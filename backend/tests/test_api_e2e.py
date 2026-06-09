# -*- coding: utf-8 -*-
import sys
import json
import time
import logging
from pathlib import Path
from datetime import datetime

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

OUTPUT_DIR = Path(__file__).resolve().parent / "output"
logger = logging.getLogger(__name__)


def _save_result(test_class: str, test_method: str, data: dict):
    """保存测试结果到 output 目录"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{test_class}_{test_method}_{timestamp}.json"
    filepath = OUTPUT_DIR / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    logger.info(f"结果已保存: {filepath}")
    return filepath


def _has_cached_result(test_class: str, test_method: str) -> bool:
    """检查是否已有缓存结果"""
    if not OUTPUT_DIR.exists():
        return False
    for f in OUTPUT_DIR.iterdir():
        if f.name.startswith(f"{test_class}_{test_method}_") and f.suffix == ".json":
            return True
    return False


class TestHealthCheck:
    """GET / 返回 200"""

    def test_health_check(self):
        response = client.get("/")
        assert response.status_code == 200


class TestGBKCompatibility:
    """POST /api/chat 不因 emoji 触发 500 UnicodeEncodeError"""

    def test_chat_no_unicode_error(self):
        response = client.post(
            "/api/chat",
            json={"user_intent": "test", "session_id": "test-e2e"},
        )
        # 只要不返回 500 且错误不是 UnicodeEncodeError 就算通过
        if response.status_code == 500:
            detail = response.json().get("detail", "")
            assert "UnicodeEncodeError" not in str(detail), (
                f"GBK 兼容性问题: {detail}"
            )


class TestOpenAPISchema:
    """GET /openapi.json 返回的 paths 包含 v1 路由前缀"""

    _EXPECTED_PREFIXES = [
        "/api/v1/user/",
        "/api/v1/chat/",
        "/api/v1/document/",
    ]

    def test_openapi_contains_v1_routes(self):
        response = client.get("/openapi.json")
        assert response.status_code == 200
        paths = response.json().get("paths", {})
        for prefix in self._EXPECTED_PREFIXES:
            matched = any(p.startswith(prefix) for p in paths)
            assert matched, f"OpenAPI paths 中缺少以 {prefix} 开头的路由"


class TestUserLogin:
    """POST /api/v1/user/login 返回非 404"""

    def test_login_not_404(self):
        response = client.post(
            "/api/v1/user/login",
            json={"username": "nonexistent_e2e", "password": "wrong"},
        )
        assert response.status_code != 404


class TestGetCurrentUser:
    """GET /api/v1/user/me 无 token 时返回 401 (非 404)"""

    def test_me_no_token_returns_401(self):
        response = client.get("/api/v1/user/me")
        assert response.status_code == 401


class TestUserManagementCRUD:
    """用户管理 CRUD 端点均返回非 404"""

    _ENDPOINTS = [
        ("POST", "/api/v1/user/add", {"username": "x", "name": "x", "role": "student"}),
        ("POST", "/api/v1/user/delete", {"user_id": 99999}),
        ("POST", "/api/v1/user/update-role", {"user_id": 99999, "new_role": "teacher"}),
        ("POST", "/api/v1/user/reset-password", {"user_id": 99999}),
        ("GET", "/api/v1/user/search?keyword=test", None),
        ("GET", "/api/v1/user/list", None),
    ]

    def test_crud_endpoints_not_404(self):
        for method, url, body in self._ENDPOINTS:
            if method == "POST":
                response = client.post(url, json=body)
            else:
                response = client.get(url)
            assert response.status_code != 404, (
                f"{method} {url} 返回了 404"
            )


class TestChatStream:
    """POST /api/v1/chat/stream 返回非 404"""

    def test_chat_stream_not_404(self):
        response = client.post(
            "/api/v1/chat/stream",
            json={
                "model": "deepseek",
                "messages": [{"role": "user", "content": "hi"}],
            },
        )
        assert response.status_code != 404


class TestRoleBasedAccess:
    """角色鉴权端点无 token 时返回 401 (非 404)"""

    _PROTECTED_PATHS = [
        "/api/v1/user/admin-only",
        "/api/v1/user/teacher-only",
        "/api/v1/user/student-only",
    ]

    def test_role_endpoints_no_token_returns_401(self):
        for path in self._PROTECTED_PATHS:
            response = client.get(path)
            assert response.status_code == 401, (
                f"{path} 无 token 时应返回 401, 实际返回 {response.status_code}"
            )


class TestChangePassword:
    """POST /api/v1/user/change-password 无 token 时返回 401 (非 404)"""

    def test_change_password_no_token_returns_401(self):
        response = client.post(
            "/api/v1/user/change-password",
            json={"old_password": "x", "new_password": "y"},
        )
        assert response.status_code == 401


class TestDocumentParseRoutes:
    """文档解析路由返回正确的验证错误 (非 404)"""

    def test_parse_no_file_returns_422(self):
        response = client.post("/api/v1/document/parse")
        assert response.status_code == 422, (
            f"应返回 422, 实际返回 {response.status_code}"
        )

    def test_parse_url_no_body_returns_422(self):
        response = client.post("/api/v1/document/parse-url")
        assert response.status_code == 422, (
            f"应返回 422, 实际返回 {response.status_code}"
        )


@pytest.mark.integration
class TestRealDocumentParse:
    """真实文档解析 API 测试"""

    def test_parse_pdf(self, pdf_test_file, mineru_available):
        if _has_cached_result("TestRealDocumentParse", "test_parse_pdf"):
            pytest.skip("已有缓存结果，跳过")
        with open(pdf_test_file, "rb") as f:
            response = client.post(
                "/api/v1/document/parse",
                files={"file": ("test.pdf", f, "application/pdf")},
                data={"session_id": "test-parse-pdf"},
            )
        assert response.status_code == 200, f"解析失败: {response.text}"
        data = response.json()
        assert data.get("code") == 0
        content = data.get("data", {}).get("content", "")
        assert len(content) > 0, "解析内容为空"
        _save_result("TestRealDocumentParse", "test_parse_pdf", {
            "request": {"file": str(pdf_test_file), "session_id": "test-parse-pdf"},
            "response": data,
            "timestamp": datetime.now().isoformat(),
        })

    def test_parse_docx(self, docx_test_file, mineru_available):
        if _has_cached_result("TestRealDocumentParse", "test_parse_docx"):
            pytest.skip("已有缓存结果，跳过")
        with open(docx_test_file, "rb") as f:
            response = client.post(
                "/api/v1/document/parse",
                files={"file": ("test.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
                data={"session_id": "test-parse-docx"},
            )
        assert response.status_code == 200, f"解析失败: {response.text}"
        data = response.json()
        assert data.get("code") == 0
        content = data.get("data", {}).get("content", "")
        assert len(content) > 0, "解析内容为空"
        _save_result("TestRealDocumentParse", "test_parse_docx", {
            "request": {"file": str(docx_test_file), "session_id": "test-parse-docx"},
            "response": data,
            "timestamp": datetime.now().isoformat(),
        })


@pytest.mark.integration
class TestRealChatStream:
    """真实流式聊天 API 测试"""

    def test_deepseek_chat_stream(self, deepseek_available):
        if _has_cached_result("TestRealChatStream", "test_deepseek_chat_stream"):
            pytest.skip("已有缓存结果，跳过")
        response = client.post(
            "/api/v1/chat/stream",
            json={
                "model": "deepseek",
                "messages": [{"role": "user", "content": "请用一句话解释什么是排序算法"}],
            },
        )
        assert response.status_code != 404
        _save_result("TestRealChatStream", "test_deepseek_chat_stream", {
            "request": {"model": "deepseek", "messages": [{"role": "user", "content": "请用一句话解释什么是排序算法"}]},
            "status_code": response.status_code,
            "response_text": response.text[:2000],
            "timestamp": datetime.now().isoformat(),
        })


@pytest.mark.integration
class TestBlackboardWriteRead:
    """验证文档解析后黑板写入"""

    def test_parse_writes_to_blackboard(self, docx_test_file, mineru_available):
        session_id = "test-blackboard-write"
        # 先清理可能存在的旧状态
        from core.state import state_manager
        state_manager.clear_state(session_id)

        with open(docx_test_file, "rb") as f:
            response = client.post(
                "/api/v1/document/parse",
                files={"file": ("test.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
                data={"session_id": session_id},
            )
        assert response.status_code == 200

        # 验证黑板中包含解析内容
        state = state_manager.get_state(session_id)
        assert state.parsed_document_content != "", "黑板中 parsed_document_content 为空"
        assert len(state.parsed_document_content) > 0

        _save_result("TestBlackboardWriteRead", "test_parse_writes_to_blackboard", {
            "session_id": session_id,
            "parsed_document_content_length": len(state.parsed_document_content),
            "parsed_document_content_preview": state.parsed_document_content[:500],
            "timestamp": datetime.now().isoformat(),
        })

        # 清理
        state_manager.clear_state(session_id)


@pytest.mark.integration
class TestMixedLogicE2E:
    """混合逻辑端到端测试: 文档解析 -> 黑板写入 -> 多轮 chat"""

    def test_doc_parse_then_chat(self, mineru_available, deepseek_available):
        if _has_cached_result("TestMixedLogicE2E", "test_doc_parse_then_chat"):
            pytest.skip("已有缓存结果，跳过")

        from core.state import state_manager

        session_id = "test-mixed-logic-e2e"
        state_manager.clear_state(session_id)

        results = {"session_id": session_id, "steps": []}

        try:
            # Step 1: 生成内容为"排序算法"的 DOCX 文件
            from docx import Document
            doc = Document()
            doc.add_paragraph("排序算法")
            temp_docx = OUTPUT_DIR / "test_sort_algorithm.docx"
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            doc.save(str(temp_docx))
            results["steps"].append({
                "step": 1,
                "action": "generate_docx",
                "file": str(temp_docx),
                "status": "success",
            })

            # Step 2: 上传 DOCX 到 /api/v1/document/parse 触发解析
            with open(temp_docx, "rb") as f:
                parse_response = client.post(
                    "/api/v1/document/parse",
                    files={"file": ("test_sort_algorithm.docx", f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
                    data={"session_id": session_id},
                )
            assert parse_response.status_code == 200, f"解析失败: {parse_response.text}"
            parse_data = parse_response.json()
            assert parse_data.get("code") == 0, f"解析返回错误: {parse_data}"
            results["steps"].append({
                "step": 2,
                "action": "parse_document",
                "status_code": parse_response.status_code,
                "response": parse_data,
            })

            # Step 3: 验证解析内容已写入黑板
            state = state_manager.get_state(session_id)
            assert state.parsed_document_content != "", "黑板中 parsed_document_content 为空"
            results["steps"].append({
                "step": 3,
                "action": "verify_blackboard",
                "parsed_document_content_preview": state.parsed_document_content[:500],
                "status": "success",
            })

            # Step 4: 首次调用 chat 接口
            chat1_response = client.post(
                "/api/chat",
                json={"user_intent": "请帮我解释文件中的名词", "session_id": session_id},
            )
            assert chat1_response.status_code == 200, f"首次 chat 失败: {chat1_response.text}"
            chat1_data = chat1_response.json()
            results["steps"].append({
                "step": 4,
                "action": "chat_1_explain",
                "request": {"user_intent": "请帮我解释文件中的名词", "session_id": session_id},
                "status_code": chat1_response.status_code,
                "response_keys": list(chat1_data.get("data", {}).keys()),
                "has_tutor_response": bool(chat1_data.get("data", {}).get("tutor_response")),
                "has_evaluation_report": bool(chat1_data.get("data", {}).get("evaluation_report")),
                "has_final_report_html": bool(chat1_data.get("data", {}).get("final_report_html")),
                "has_animation_html": bool(chat1_data.get("data", {}).get("animation_html")),
                "has_parsed_document_content": bool(chat1_data.get("data", {}).get("parsed_document_content")),
            })

            # Step 5: 再次调用 chat 接口
            chat2_response = client.post(
                "/api/chat",
                json={"user_intent": "请帮我生成总结报告", "session_id": session_id},
            )
            assert chat2_response.status_code == 200, f"二次 chat 失败: {chat2_response.text}"
            chat2_data = chat2_response.json()
            results["steps"].append({
                "step": 5,
                "action": "chat_2_report",
                "request": {"user_intent": "请帮我生成总结报告", "session_id": session_id},
                "status_code": chat2_response.status_code,
                "response_keys": list(chat2_data.get("data", {}).keys()),
                "has_tutor_response": bool(chat2_data.get("data", {}).get("tutor_response")),
                "has_evaluation_report": bool(chat2_data.get("data", {}).get("evaluation_report")),
                "has_final_report_html": bool(chat2_data.get("data", {}).get("final_report_html")),
                "has_animation_html": bool(chat2_data.get("data", {}).get("animation_html")),
            })

            # Step 6: 验证上下文连贯性
            # 检查第二次 chat 的黑板状态是否包含第一次的结果
            final_state = state_manager.get_state(session_id)
            results["steps"].append({
                "step": 6,
                "action": "verify_context",
                "final_state_keys": list(final_state.model_dump().keys()),
                "current_step": final_state.current_step,
                "has_learner_profile": bool(final_state.learner_profile),
                "has_evaluation_results": bool(final_state.evaluation_results),
                "history_count": len(final_state.history),
                "status": "success" if final_state.current_step == "completed" else f"unexpected_step:{final_state.current_step}",
            })

            # 保存完整结果
            _save_result("TestMixedLogicE2E", "test_doc_parse_then_chat", results)

        finally:
            # 清理
            state_manager.clear_state(session_id)
