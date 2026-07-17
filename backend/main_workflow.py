"""
Vision-Forge 智能体调度器

核心原则：四个智能体是独立的，按需调用，不强制顺序执行。
- Architect：场景探索 + 任务翻译 + 苏格拉底引导 + 架构规划
- Tutor：源码讲解（用户搭完模型后、或遇到知识盲区时）
- Evaluator：Canvas 沙盒评估（独立于对话框，由 /api/v1/agent/evaluate 触发）
- Generator：讲义生成（由 /api/learning-materials/generate 触发）

调度逻辑由 main.py 的 /api/chat 端点根据意图 + 黑板状态决定调用哪个智能体，
每次请求只执行一个智能体，返回结果后等待用户下一步操作。
"""

import json
from typing import Callable, Optional, Dict, Any
from core.state import state_manager, TaskState
from core.logger import logger

from agents.architect_agent import ArchitectAgent
from agents.tutor_agent import TutorAgent
from agents.evaluator_agent import EvaluatorAgent
from agents.generator_agent import GeneratorAgent

architect = ArchitectAgent()
tutor = TutorAgent()
evaluator = EvaluatorAgent()
generator = GeneratorAgent()


def _emit_content(emit_fn, delta: Dict[str, Any]):
    """只推送本轮调度中新产生的内容，不从旧状态回放。"""
    er = delta.get("evaluation_results", {}) or {}
    if er.get("tutor_response"):
        emit_fn({"event": "content", "type": "tutor", "text": er["tutor_response"]})
    if er.get("report"):
        emit_fn({"event": "content", "type": "evaluation", "text": er["report"]})


def dispatch_agent(session_id: str, user_intent: str,
                   intent_type: str,  # "chat" | "explore" | "build"
                   on_progress: Optional[Callable[[dict], None]] = None) -> dict:
    """根据意图类型和当前黑板状态，调度一个智能体执行。

    每次调用只执行一个智能体，执行完返回。
    不会自动链式调用下一个智能体。
    """

    def emit(event: dict):
        if on_progress:
            try:
                on_progress(event)
            except Exception:
                pass

    state = state_manager.get_state(session_id)
    logger.info(f"🎯 [Dispatch] intent={intent_type}, socratic={state.socratic_state}, step={state.current_step}")

    # ============================================================
    # 情况 1：苏格拉底对话进行中 → 续接 Architect
    # ============================================================
    if state.socratic_state == "probing":
        # 将用户消息作为本轮回答写入
        if state.socratic_history:
            state.socratic_history[-1]["answer"] = user_intent
        # 苏格拉底对话期间绝不覆盖原始 user_intent
        # 用户的原始场景描述（如"从卫星图像中区分水稻"）必须保留
        state_manager.update_state(session_id, {
            "current_step": "socratic_stage",
        })
        emit({"event": "stage", "agent": "architect", "status": "running"})
        try:
            delta = architect.run(state_manager.get_state(session_id))
            state_manager.update_state(session_id, delta)
            emit({"event": "stage", "agent": "architect", "status": "done"})
            new_state = state_manager.get_state(session_id)
            _emit_content(emit, delta)
            # 检查是否引导去 Canvas
            if delta.get("current_step") == "canvas_guide":
                emit({"event": "navigate", "target": "canvas",
                      "message": "请前往模型工坊搭建模型"})
            return new_state.model_dump()
        except Exception as e:
            logger.error(f"💥 Architect 苏格拉底对话失败: {e}")
            emit({"event": "error", "message": str(e), "agent": "architect"})
            return state.model_dump()

    # ============================================================
    # 情况 1.5：Canvas 回传 — 用户已去过 Canvas，现在回来聊
    # ============================================================
    if state.socratic_state == "done" and state.sandbox_config and getattr(state.sandbox_config, "nodes", []):
        nodes = state.sandbox_config.nodes
        logger.info(f"🎨 [Dispatch] Canvas回传，sandbox有{len(nodes)}个节点")

        # 用户想了解搭建的架构 → 调 Tutor 讲解
        if any(w in user_intent for w in ["看看", "怎么样", "讲解", "讲一下", "帮我讲", "搭好了", "搭完"]):
            emit({"event": "stage", "agent": "tutor", "status": "running"})
            try:
                state_manager.update_state(session_id, {"user_intent": user_intent, "current_step": "tutor_stage"})
                delta = tutor.run(state_manager.get_state(session_id))
                state_manager.update_state(session_id, delta)
                emit({"event": "stage", "agent": "tutor", "status": "done"})
                _emit_content(emit, delta)
                return state_manager.get_state(session_id).model_dump()
            except Exception as e:
                logger.error(f"💥 Tutor 失败: {e}")
                emit({"event": "error", "message": str(e), "agent": "tutor"})
                return state.model_dump()

        # 用户想评估 → 引导提交评估
        logger.info(f"🎨 [Dispatch] Canvas回传但未识别为讲解请求，返回当前状态")
        # 返回当前黑板信息
        node_names = [getattr(n, "name", "?") for n in nodes]
        msg = f"我看到你在模型工坊搭建了 {len(nodes)} 个节点：{' → '.join(node_names)}。\n\n想让我帮你讲解这些算子的源码？还是先提交评估看看架构合不合理？"
        emit({"event": "content", "type": "tutor", "text": msg})
        return state.model_dump()

    # ============================================================
    # 情况 2：场景探索（explore）→ Architect 启动苏格拉底引导
    # ============================================================
    if intent_type == "explore":
        emit({"event": "stage", "agent": "architect", "status": "running"})
        try:
            # 全新探索：先手动清空内存中的旧评估残留（dict merge 无法清空）
            state = state_manager.get_state(session_id)
            state.evaluation_results = {}
            # 重置苏格拉底状态
            state_manager.update_state(session_id, {
                "user_intent": user_intent,
                "socratic_state": "idle",
                "socratic_turn": 0,
                "socratic_track": {},
                "current_step": "architect_stage",
            })
            delta = architect.run(state_manager.get_state(session_id))
            state_manager.update_state(session_id, delta)
            emit({"event": "stage", "agent": "architect", "status": "done"})
            new_state = state_manager.get_state(session_id)
            _emit_content(emit, delta)
            return new_state.model_dump()
        except Exception as e:
            logger.error(f"💥 Architect 探索启动失败: {e}")
            emit({"event": "error", "message": str(e), "agent": "architect"})
            return state.model_dump()

    # ============================================================
    # 情况 3：Canvas 回传（已有 sandbox_config + 评估结果）
    #   用户说"讲一下"→ Tutor，用户说"继续"→ 根据状态调度
    # ============================================================
    if state.sandbox_config and getattr(state.sandbox_config, "nodes", []):
        # 用户从 Canvas 回来，有沙盒配置在手
        has_eval = bool(getattr(state, "evaluation_results", {}).get("report"))

        if intent_type == "build" or ("讲解" in user_intent or "源码" in user_intent or "讲一下" in user_intent):
            # → 调用 Tutor 讲解源码
            emit({"event": "stage", "agent": "tutor", "status": "running"})
            try:
                state_manager.update_state(session_id, {
                    "user_intent": user_intent,
                    "current_step": "tutor_stage",
                })
                delta = tutor.run(state_manager.get_state(session_id))
                state_manager.update_state(session_id, delta)
                emit({"event": "stage", "agent": "tutor", "status": "done"})
                new_state = state_manager.get_state(session_id)
                _emit_content(emit, delta)
                return new_state.model_dump()
            except Exception as e:
                logger.error(f"💥 Tutor 失败: {e}")
                emit({"event": "error", "message": str(e), "agent": "tutor"})
                return state.model_dump()

    # ============================================================
    # 情况 4：明确搭建请求（build）→ Architect 综合模式
    # ============================================================
    if intent_type == "build":
        emit({"event": "stage", "agent": "architect", "status": "running"})
        try:
            # build 模式：用户已明确要搭模型，跳过苏格拉底反问，直接综合
            state_manager.update_state(session_id, {
                "user_intent": user_intent,
                "socratic_state": "synthesizing",
                "current_step": "architect_stage",
            })
            delta = architect.run(state_manager.get_state(session_id))
            state_manager.update_state(session_id, delta)
            emit({"event": "stage", "agent": "architect", "status": "done"})
            new_state = state_manager.get_state(session_id)
            _emit_content(emit, delta)
            if delta.get("current_step") == "canvas_guide":
                emit({"event": "navigate", "target": "canvas",
                      "message": "请前往模型工坊搭建模型"})
            return new_state.model_dump()
        except Exception as e:
            logger.error(f"💥 Architect 失败: {e}")
            emit({"event": "error", "message": str(e), "agent": "architect"})
            return state.model_dump()

    # ============================================================
    # 情况 5：兜底 → 返回当前状态
    # ============================================================
    logger.info(f"🎯 [Dispatch] 无匹配调度规则，返回当前状态")
    _emit_content(emit, {})  # 兜底：无新内容
    return state.model_dump()
