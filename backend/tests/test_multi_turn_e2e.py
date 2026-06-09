# -*- coding: utf-8 -*-
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from main import app
from core.state import state_manager

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


@pytest.mark.integration
class TestMultiTurnE2E:
    """多轮对话意图驱动系统端到端测试"""

    def test_report_intent_e2e(self, spark_available):
        """用户发送报告意图，验证 final_report_html 非空且 animation_html 为空"""
        session_id = "test-report-intent-e2e"
        state_manager.clear_state(session_id)

        try:
            response = client.post(
                "/api/chat",
                json={"user_intent": "请帮我生成总结报告", "session_id": session_id},
            )
            assert response.status_code == 200, f"请求失败: {response.text}"
            data = response.json()
            assert data.get("code") == 200, f"业务错误: {data}"

            report_html = data["data"].get("final_report_html", "")
            animation_html = data["data"].get("animation_html", "")
            assert report_html != "", "final_report_html 不应为空"
            assert animation_html == "", "animation_html 应为空"

            _save_result("TestMultiTurnE2E", "test_report_intent_e2e", {
                "session_id": session_id,
                "user_intent": "请帮我生成总结报告",
                "has_final_report_html": bool(report_html),
                "has_animation_html": bool(animation_html),
                "timestamp": datetime.now().isoformat(),
            })
        finally:
            state_manager.clear_state(session_id)

    def test_animation_intent_e2e(self, spark_available):
        """用户发送动画意图，验证 animation_html 非空且 final_report_html 为空"""
        session_id = "test-animation-intent-e2e"
        state_manager.clear_state(session_id)

        try:
            response = client.post(
                "/api/chat",
                json={"user_intent": "请帮我生成动画演示", "session_id": session_id},
            )
            assert response.status_code == 200, f"请求失败: {response.text}"
            data = response.json()
            assert data.get("code") == 200, f"业务错误: {data}"

            report_html = data["data"].get("final_report_html", "")
            animation_html = data["data"].get("animation_html", "")
            assert animation_html != "", "animation_html 不应为空"
            assert report_html == "", "final_report_html 应为空"

            _save_result("TestMultiTurnE2E", "test_animation_intent_e2e", {
                "session_id": session_id,
                "user_intent": "请帮我生成动画演示",
                "has_final_report_html": bool(report_html),
                "has_animation_html": bool(animation_html),
                "timestamp": datetime.now().isoformat(),
            })
        finally:
            state_manager.clear_state(session_id)

    def test_mixed_intent_e2e(self, spark_available):
        """用户发送混合意图，验证 final_report_html 和 animation_html 均非空"""
        session_id = "test-mixed-intent-e2e"
        state_manager.clear_state(session_id)

        try:
            response = client.post(
                "/api/chat",
                json={"user_intent": "请帮我生成报告和动画", "session_id": session_id},
            )
            assert response.status_code == 200, f"请求失败: {response.text}"
            data = response.json()
            assert data.get("code") == 200, f"业务错误: {data}"

            report_html = data["data"].get("final_report_html", "")
            animation_html = data["data"].get("animation_html", "")
            assert report_html != "", "final_report_html 不应为空"
            assert animation_html != "", "animation_html 不应为空"

            _save_result("TestMultiTurnE2E", "test_mixed_intent_e2e", {
                "session_id": session_id,
                "user_intent": "请帮我生成报告和动画",
                "has_final_report_html": bool(report_html),
                "has_animation_html": bool(animation_html),
                "timestamp": datetime.now().isoformat(),
            })
        finally:
            state_manager.clear_state(session_id)

    def test_multi_turn_dialogue_e2e(self, spark_available):
        """两轮对话：第一轮生成报告，第二轮生成动画。
        验证第二轮黑板保留第一轮的 history 和 final_report_html，
        dialogue_turn 为 2，animation_html 非空"""
        session_id = "test-multi-turn-dialogue-e2e"
        state_manager.clear_state(session_id)

        try:
            # 第一轮：生成报告
            resp1 = client.post(
                "/api/chat",
                json={"user_intent": "请帮我生成报告", "session_id": session_id},
            )
            assert resp1.status_code == 200, f"第一轮请求失败: {resp1.text}"
            data1 = resp1.json()
            assert data1.get("code") == 200, f"第一轮业务错误: {data1}"

            report_html_1 = data1["data"].get("final_report_html", "")
            assert report_html_1 != "", "第一轮 final_report_html 不应为空"

            # 记录第一轮黑板状态
            state_after_turn1 = state_manager.get_state(session_id)
            history_after_turn1 = list(state_after_turn1.history)

            # 第二轮：生成动画
            resp2 = client.post(
                "/api/chat",
                json={"user_intent": "现在帮我生成动画", "session_id": session_id},
            )
            assert resp2.status_code == 200, f"第二轮请求失败: {resp2.text}"
            data2 = resp2.json()
            assert data2.get("code") == 200, f"第二轮业务错误: {data2}"

            # 验证第二轮黑板状态
            state_after_turn2 = state_manager.get_state(session_id)

            # dialogue_turn 应为 2
            assert state_after_turn2.dialogue_turn == 2, (
                f"dialogue_turn 应为 2, 实际为 {state_after_turn2.dialogue_turn}"
            )

            # 第二轮黑板保留第一轮的 history
            for h in history_after_turn1:
                assert h in state_after_turn2.history, (
                    f"第一轮 history 条目 '{h}' 在第二轮黑板中丢失"
                )

            # 第二轮黑板保留第一轮的 final_report_html
            assert state_after_turn2.final_report_html != "", (
                "第二轮黑板应保留第一轮的 final_report_html"
            )

            # animation_html 非空
            animation_html = data2["data"].get("animation_html", "")
            assert animation_html != "", "第二轮 animation_html 不应为空"

            _save_result("TestMultiTurnE2E", "test_multi_turn_dialogue_e2e", {
                "session_id": session_id,
                "turn1": {
                    "user_intent": "请帮我生成报告",
                    "has_final_report_html": bool(report_html_1),
                    "history_count_after": len(history_after_turn1),
                },
                "turn2": {
                    "user_intent": "现在帮我生成动画",
                    "dialogue_turn": state_after_turn2.dialogue_turn,
                    "has_final_report_html": bool(state_after_turn2.final_report_html),
                    "has_animation_html": bool(animation_html),
                    "history_count_after": len(state_after_turn2.history),
                },
                "timestamp": datetime.now().isoformat(),
            })
        finally:
            state_manager.clear_state(session_id)

    def test_topic_switch_e2e(self, spark_available):
        """话题切换：第一轮讲解排序算法，第二轮生成动画。
        验证第二轮意图分类为 animation_generation，dialogue_turn 为 2"""
        session_id = "test-topic-switch-e2e"
        state_manager.clear_state(session_id)

        try:
            # 第一轮：讲解排序算法
            resp1 = client.post(
                "/api/chat",
                json={"user_intent": "讲解排序算法", "session_id": session_id},
            )
            assert resp1.status_code == 200, f"第一轮请求失败: {resp1.text}"
            data1 = resp1.json()
            assert data1.get("code") == 200, f"第一轮业务错误: {data1}"

            # 第二轮：生成动画（话题切换）
            resp2 = client.post(
                "/api/chat",
                json={"user_intent": "生成动画", "session_id": session_id},
            )
            assert resp2.status_code == 200, f"第二轮请求失败: {resp2.text}"
            data2 = resp2.json()
            assert data2.get("code") == 200, f"第二轮业务错误: {data2}"

            # 验证第二轮意图分类为 animation_generation
            intent = data2["data"].get("intent", "")
            assert intent == "animation_generation", (
                f"第二轮意图分类应为 animation_generation, 实际为 {intent}"
            )

            # 验证 dialogue_turn 为 2
            state_after_turn2 = state_manager.get_state(session_id)
            assert state_after_turn2.dialogue_turn == 2, (
                f"dialogue_turn 应为 2, 实际为 {state_after_turn2.dialogue_turn}"
            )

            _save_result("TestMultiTurnE2E", "test_topic_switch_e2e", {
                "session_id": session_id,
                "turn1": {
                    "user_intent": "讲解排序算法",
                    "intent": data1["data"].get("intent", ""),
                },
                "turn2": {
                    "user_intent": "生成动画",
                    "intent": intent,
                    "dialogue_turn": state_after_turn2.dialogue_turn,
                },
                "timestamp": datetime.now().isoformat(),
            })
        finally:
            state_manager.clear_state(session_id)
