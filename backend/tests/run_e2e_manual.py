# -*- coding: utf-8 -*-
"""端到端测试执行脚本 — 重新进行端到端实现验证，保存中间结果"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from core.state import state_manager
from datetime import datetime
import json
import time
import re

client = TestClient(app)
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 全局 run_id 标识本次完整执行
RUN_ID = datetime.now().strftime("%Y%m%d_%H%M%S")
RUN_DIR = os.path.join(OUTPUT_DIR, f"run_{RUN_ID}")
os.makedirs(RUN_DIR, exist_ok=True)
os.makedirs(os.path.join(RUN_DIR, "llm_intermediates"), exist_ok=True)
os.makedirs(os.path.join(RUN_DIR, "animations"), exist_ok=True)
os.makedirs(os.path.join(RUN_DIR, "reports"), exist_ok=True)


def _strip_html_to_text(html: str) -> str:
    """简易 HTML 转纯文本（仅用于摘要展示）"""
    if not html:
        return ""
    text = re.sub(r'<script.*?</script>', '', html, flags=re.DOTALL)
    text = re.sub(r'<style.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def _save_llm_intermediates(scenario_name: str, data: dict, state):
    """保存 LLM 中间结果到独立文件"""
    intermediates = {
        "scenario": scenario_name,
        "timestamp": datetime.now().isoformat(),
        "intent_classification": {
            "intent": data.get("intent", ""),
            "confidence": data.get("confidence", 0.0),
        },
        "learner_profile": data.get("learner_profile", {}),
        "sandbox_config": data.get("sandbox_config", {}),
        "tutor_response": data.get("tutor_response", ""),
        "evaluation_report": data.get("evaluation_report", ""),
        "current_step": state.current_step,
        "history": list(state.history),
    }
    filepath = os.path.join(RUN_DIR, "llm_intermediates", f"{scenario_name}_llm_intermediates.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(intermediates, f, ensure_ascii=False, indent=2, default=str)
    return filepath


def _save_animation(scenario_name: str, animation_html: str) -> str | None:
    """保存动画 HTML 到独立文件"""
    if not animation_html:
        return None
    filepath = os.path.join(RUN_DIR, "animations", f"{scenario_name}_animation.html")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(animation_html)
    return filepath


def _save_report(scenario_name: str, report_html: str) -> str | None:
    """保存报告 HTML 到独立文件"""
    if not report_html:
        return None
    filepath = os.path.join(RUN_DIR, "reports", f"{scenario_name}_report.html")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(report_html)
    return filepath


def _save_summary_doc(scenario_results: list, run_id: str) -> str:
    """保存 Markdown 格式的总结报告"""
    passed = sum(1 for r in scenario_results if r.get("passed"))
    total = len(scenario_results)
    failed = total - passed

    md_lines = [
        f"# 端到端验证总结报告",
        f"",
        f"**Run ID**: {run_id}",
        f"**执行时间**: {datetime.now().isoformat()}",
        f"**总场景数**: {total}",
        f"**通过**: {passed}",
        f"**失败**: {failed}",
        f"",
        f"## 验证场景",
        f"",
    ]

    for r in scenario_results:
        status = "[PASS]" if r.get("passed") else "[FAIL]"
        md_lines.append(f"### {r.get('scenario', 'unknown')}")
        md_lines.append(f"- **状态**: {status}")
        md_lines.append(f"- **耗时**: {r.get('elapsed_seconds', 0)}s")

        if "data_keys" in r:
            md_lines.append(f"- **返回数据 keys**: {', '.join(r['data_keys'])}")

        if "intent" in r or r.get("turn1_intent"):
            if "intent" in r:
                md_lines.append(f"- **意图分类**: {r.get('intent', '')} (confidence={r.get('confidence', 0)})")
            if "turn1_intent" in r:
                md_lines.append(f"- **第一轮意图**: {r.get('turn1_intent', '')}")
                md_lines.append(f"- **第二轮意图**: {r.get('turn2_intent', '')}")
            if "dialogue_turn" in r:
                md_lines.append(f"- **dialogue_turn**: {r.get('dialogue_turn', 0)}")

        if "saved_files" in r:
            md_lines.append(f"- **保存文件**:")
            for kind, path in r["saved_files"].items():
                md_lines.append(f"  - {kind}: `{os.path.basename(path) if path else 'N/A'}`")

        if r.get("error"):
            md_lines.append(f"- **错误**: {r['error']}")

        md_lines.append(f"")
        md_lines.append(f"---")
        md_lines.append(f"")

    md_lines.extend([
        f"## 文件输出结构",
        f"",
        f"```",
        f"output/run_{run_id}/",
        f"  llm_intermediates/    # LLM 中间结果（意图、tutor、evaluator）",
        f"    {{scenario}}_llm_intermediates.json",
        f"  animations/           # 生成的动画 HTML",
        f"    {{scenario}}_animation.html",
        f"  reports/              # 生成的报告 HTML",
        f"    {{scenario}}_report.html",
        f"  SUMMARY.md            # 本文档",
        f"  e2e_validation_report.json  # 完整 JSON 报告",
        f"```",
        f"",
    ])

    filepath = os.path.join(RUN_DIR, "SUMMARY.md")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    return filepath


def run_scenario(name, session_id, intent_text, assertions):
    """运行单个测试场景，保存中间结果"""
    print(f"\n{'='*70}")
    print(f"场景: {name}")
    print(f"session_id: {session_id}")
    print(f"user_intent: {intent_text}")
    print(f"{'='*70}")

    state_manager.clear_state(session_id)
    start = time.time()
    saved_files = {}

    try:
        response = client.post(
            "/api/chat",
            json={"user_intent": intent_text, "session_id": session_id},
        )
        elapsed = time.time() - start

        print(f"  状态码: {response.status_code}")
        print(f"  耗时: {elapsed:.1f}s")

        assert response.status_code == 200, f"请求失败: {response.text}"
        data = response.json()
        assert data.get("code") == 200, f"业务错误: {data}"

        # 获取黑板状态
        state = state_manager.get_state(session_id)

        # 保存 LLM 中间结果
        saved_files["llm_intermediates"] = _save_llm_intermediates(name, data, state)
        print(f"  [SAVE] LLM intermediates: {os.path.basename(saved_files['llm_intermediates'])}")

        # 保存动画 HTML
        animation_html = data.get("data", {}).get("animation_html", "")
        anim_path = _save_animation(name, animation_html)
        if anim_path:
            saved_files["animation"] = anim_path
            print(f"  [SAVE] Animation: {os.path.basename(anim_path)} ({len(animation_html)} bytes)")
        else:
            print(f"  [SKIP] No animation generated")

        # 保存报告 HTML
        report_html = data.get("data", {}).get("final_report_html", "")
        report_path = _save_report(name, report_html)
        if report_path:
            saved_files["report"] = report_path
            print(f"  [SAVE] Report: {os.path.basename(report_path)} ({len(report_html)} bytes)")
        else:
            print(f"  [SKIP] No report generated")

        # 运行断言
        result = {
            "scenario": name,
            "elapsed_seconds": round(elapsed, 1),
            "passed": True,
            "intent": data.get("data", {}).get("intent", ""),
            "confidence": data.get("data", {}).get("confidence", 0.0),
            "saved_files": saved_files,
        }
        for key, expected, actual in assertions(data, state):
            status = "[OK]" if expected == actual else "[FAIL]"
            print(f"  {status} {key}: expected={expected!r}, actual={actual!r}")
            if expected != actual:
                result["passed"] = False
                result["failure"] = f"{key}: expected={expected!r}, actual={actual!r}"

        result["data_keys"] = list(data.get("data", {}).keys())
        return result
    except Exception as e:
        elapsed = time.time() - start
        print(f"  [EXCEPTION] {e}")
        return {"scenario": name, "elapsed_seconds": round(elapsed, 1), "passed": False, "error": str(e), "saved_files": saved_files}
    finally:
        state_manager.clear_state(session_id)


def main():
    print(f"Run ID: {RUN_ID}")
    print(f"Output Dir: {RUN_DIR}")
    results = []

    # 场景 1: 报告意图
    results.append(run_scenario(
        "test_report_intent_e2e",
        "e2e-report",
        "请帮我生成总结报告",
        lambda d, s: [
            ("final_report_html 非空", True, len(d["data"].get("final_report_html", "")) > 0),
            ("animation_html 为空", True, len(d["data"].get("animation_html", "")) == 0),
            ("intent=report_generation", "report_generation", d["data"].get("intent", "")),
            ("current_step=completed", "completed", s.current_step),
        ],
    ))

    # 场景 2: 动画意图
    results.append(run_scenario(
        "test_animation_intent_e2e",
        "e2e-animation",
        "请帮我生成动画演示",
        lambda d, s: [
            ("animation_html 非空", True, len(d["data"].get("animation_html", "")) > 0),
            ("final_report_html 为空", True, len(d["data"].get("final_report_html", "")) == 0),
            ("intent=animation_generation", "animation_generation", d["data"].get("intent", "")),
            ("current_step=completed", "completed", s.current_step),
        ],
    ))

    # 场景 3: 混合意图
    results.append(run_scenario(
        "test_mixed_intent_e2e",
        "e2e-mixed",
        "请帮我生成报告和动画",
        lambda d, s: [
            ("final_report_html 非空", True, len(d["data"].get("final_report_html", "")) > 0),
            ("animation_html 非空", True, len(d["data"].get("animation_html", "")) > 0),
            ("intent=mixed_generation", "mixed_generation", d["data"].get("intent", "")),
            ("current_step=completed", "completed", s.current_step),
        ],
    ))

    # 场景 4: 多轮对话
    print(f"\n{'='*70}")
    print(f"场景: test_multi_turn_dialogue_e2e")
    print(f"{'='*70}")
    session_id = "e2e-multi-turn"
    state_manager.clear_state(session_id)
    saved_files = {}

    try:
        # 第一轮
        start = time.time()
        resp1 = client.post("/api/chat", json={"user_intent": "请帮我生成报告", "session_id": session_id})
        t1 = time.time() - start
        data1 = resp1.json()
        state1 = state_manager.get_state(session_id)
        report1_len = len(data1["data"].get("final_report_html", ""))

        # 保存第一轮中间结果
        saved_files["turn1_llm"] = _save_llm_intermediates("multi_turn_turn1", data1["data"], state1)
        if data1["data"].get("final_report_html"):
            saved_files["turn1_report"] = _save_report("multi_turn_turn1", data1["data"]["final_report_html"])
        print(f"  第一轮: status={resp1.status_code}, 耗时={t1:.1f}s, report_len={report1_len}")
        print(f"  [SAVE] turn1 intermediates + report")

        history1_len = len(state1.history)

        # 第二轮
        start = time.time()
        resp2 = client.post("/api/chat", json={"user_intent": "现在帮我生成动画", "session_id": session_id})
        t2 = time.time() - start
        data2 = resp2.json()
        state2 = state_manager.get_state(session_id)

        # 保存第二轮中间结果
        saved_files["turn2_llm"] = _save_llm_intermediates("multi_turn_turn2", data2["data"], state2)
        if data2["data"].get("animation_html"):
            saved_files["turn2_animation"] = _save_animation("multi_turn_turn2", data2["data"]["animation_html"])
        print(f"  第二轮: status={resp2.status_code}, 耗时={t2:.1f}s")
        print(f"  [SAVE] turn2 intermediates + animation")

        passed = True
        checks = [
            ("第一轮 final_report_html 非空", True, report1_len > 0),
            ("dialogue_turn=2", 2, state2.dialogue_turn),
            ("第二轮 animation_html 非空", True, len(data2["data"].get("animation_html", "")) > 0),
            ("第二轮 final_report_html 保留", True, len(state2.final_report_html) > 0),
            ("history 增长", True, len(state2.history) > history1_len),
        ]
        for name, expected, actual in checks:
            status = "[OK]" if expected == actual else "[FAIL]"
            print(f"  {status} {name}: expected={expected!r}, actual={actual!r}")
            if expected != actual:
                passed = False

        results.append({
            "scenario": "test_multi_turn_dialogue_e2e",
            "passed": passed,
            "turn1_elapsed": round(t1, 1),
            "turn2_elapsed": round(t2, 1),
            "elapsed_seconds": round(t1 + t2, 1),
            "turn1_intent": data1["data"].get("intent", ""),
            "turn2_intent": data2["data"].get("intent", ""),
            "dialogue_turn": state2.dialogue_turn,
            "saved_files": saved_files,
        })
    except Exception as e:
        print(f"  [EXCEPTION] {e}")
        results.append({"scenario": "test_multi_turn_dialogue_e2e", "passed": False, "error": str(e), "saved_files": saved_files})
    finally:
        state_manager.clear_state(session_id)

    # 场景 5: 话题切换
    print(f"\n{'='*70}")
    print(f"场景: test_topic_switch_e2e")
    print(f"{'='*70}")
    session_id = "e2e-topic-switch"
    state_manager.clear_state(session_id)
    saved_files = {}

    try:
        # 第一轮
        start = time.time()
        resp1 = client.post("/api/chat", json={"user_intent": "讲解排序算法", "session_id": session_id})
        t1 = time.time() - start
        data1 = resp1.json()
        state1 = state_manager.get_state(session_id)
        saved_files["turn1_llm"] = _save_llm_intermediates("topic_switch_turn1", data1["data"], state1)
        if data1["data"].get("final_report_html"):
            saved_files["turn1_report"] = _save_report("topic_switch_turn1", data1["data"]["final_report_html"])
        if data1["data"].get("animation_html"):
            saved_files["turn1_animation"] = _save_animation("topic_switch_turn1", data1["data"]["animation_html"])
        print(f"  第一轮: status={resp1.status_code}, 耗时={t1:.1f}s")
        print(f"  [SAVE] turn1 intermediates + report/animation")

        # 第二轮
        start = time.time()
        resp2 = client.post("/api/chat", json={"user_intent": "生成动画", "session_id": session_id})
        t2 = time.time() - start
        data2 = resp2.json()
        state2 = state_manager.get_state(session_id)
        saved_files["turn2_llm"] = _save_llm_intermediates("topic_switch_turn2", data2["data"], state2)
        if data2["data"].get("animation_html"):
            saved_files["turn2_animation"] = _save_animation("topic_switch_turn2", data2["data"]["animation_html"])
        print(f"  第二轮: status={resp2.status_code}, 耗时={t2:.1f}s")
        print(f"  [SAVE] turn2 intermediates + animation")

        passed = True
        checks = [
            ("第二轮 intent=animation_generation", "animation_generation", data2["data"].get("intent", "")),
            ("dialogue_turn=2", 2, state2.dialogue_turn),
        ]
        for name, expected, actual in checks:
            status = "[OK]" if expected == actual else "[FAIL]"
            print(f"  {status} {name}: expected={expected!r}, actual={actual!r}")
            if expected != actual:
                passed = False

        results.append({
            "scenario": "test_topic_switch_e2e",
            "passed": passed,
            "turn1_elapsed": round(t1, 1),
            "turn2_elapsed": round(t2, 1),
            "elapsed_seconds": round(t1 + t2, 1),
            "turn1_intent": data1["data"].get("intent", ""),
            "turn2_intent": data2["data"].get("intent", ""),
            "dialogue_turn": state2.dialogue_turn,
            "saved_files": saved_files,
        })
    except Exception as e:
        print(f"  [EXCEPTION] {e}")
        results.append({"scenario": "test_topic_switch_e2e", "passed": False, "error": str(e), "saved_files": saved_files})
    finally:
        state_manager.clear_state(session_id)

    # 汇总
    print(f"\n{'='*70}")
    print(f"汇总")
    print(f"{'='*70}")
    total = len(results)
    passed = sum(1 for r in results if r.get("passed"))
    print(f"总场景数: {total}")
    print(f"通过: {passed}")
    print(f"失败: {total - passed}")

    # 保存完整 JSON 报告
    report_path = os.path.join(RUN_DIR, "e2e_validation_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "run_id": RUN_ID,
            "timestamp": datetime.now().isoformat(),
            "total": total,
            "passed": passed,
            "failed": total - passed,
            "results": results,
        }, f, ensure_ascii=False, indent=2, default=str)
    print(f"\nJSON 报告: {report_path}")

    # 保存 Markdown 总结
    summary_path = _save_summary_doc(results, RUN_ID)
    print(f"Markdown 总结: {summary_path}")

    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
