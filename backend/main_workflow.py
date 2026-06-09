from typing import TypedDict

from langgraph.graph import StateGraph, END

from core.state import state_manager
from core.logger import logger
from agents.architect_agent import ArchitectAgent
from agents.tutor_agent import TutorAgent
from agents.evaluator_agent import EvaluatorAgent
from agents.generator_agent import GeneratorAgent
from agents.intent_classifier import IntentClassifier

# 全局实例化
architect = ArchitectAgent()
tutor = TutorAgent()
evaluator = EvaluatorAgent()
generator = GeneratorAgent()
classifier = IntentClassifier()


class PipelineState(TypedDict):
    session_id: str
    current_step: str


# ==================== 节点函数 ====================

def intent_classify_node(state: PipelineState) -> PipelineState:
    session_id = state["session_id"]
    current_state = state_manager.get_state(session_id)

    if architect.is_session_cancelled(current_state):
        logger.warning(f"[Pipeline] 会话 {session_id} 已被手动终止")
        return {"session_id": session_id, "current_step": "cancelled"}

    try:
        intent, confidence = classifier.classify(
            current_state.user_intent,
            current_state.parsed_document_content
        )
        state_manager.update_state(session_id, {
            "intent": intent,
            "confidence": confidence,
            "current_step": "intent_classified"
        })
    except Exception as e:
        logger.error(f"[Pipeline] 意图分类异常: {e}")
        state_manager.update_state(session_id, {"current_step": "error_stage"})
        return {"session_id": session_id, "current_step": "error_stage"}

    return {"session_id": session_id, "current_step": "intent_classified"}


def architect_node(state: PipelineState) -> PipelineState:
    session_id = state["session_id"]
    current_state = state_manager.get_state(session_id)

    if architect.is_session_cancelled(current_state):
        logger.warning(f"[Pipeline] 会话 {session_id} 已被手动终止")
        return {"session_id": session_id, "current_step": "cancelled"}

    try:
        delta = architect.run(current_state)
        if delta:
            state_manager.update_state(session_id, delta)
        else:
            logger.warning(f"[Pipeline] architect 未返回任何增量")
    except Exception as e:
        logger.error(f"[Pipeline] architect 执行异常: {e}")
        state_manager.update_state(session_id, {"current_step": "error_stage"})
        return {"session_id": session_id, "current_step": "error_stage"}

    return {"session_id": session_id, "current_step": "architect_done"}


def tutor_node(state: PipelineState) -> PipelineState:
    session_id = state["session_id"]
    current_state = state_manager.get_state(session_id)

    if architect.is_session_cancelled(current_state):
        logger.warning(f"[Pipeline] 会话 {session_id} 已被手动终止")
        return {"session_id": session_id, "current_step": "cancelled"}

    try:
        delta = tutor.run(current_state)
        if delta:
            state_manager.update_state(session_id, delta)
        else:
            logger.warning(f"[Pipeline] tutor 未返回任何增量")
    except Exception as e:
        logger.error(f"[Pipeline] tutor 执行异常: {e}")
        state_manager.update_state(session_id, {"current_step": "error_stage"})
        return {"session_id": session_id, "current_step": "error_stage"}

    return {"session_id": session_id, "current_step": "tutor_done"}


def evaluator_node(state: PipelineState) -> PipelineState:
    session_id = state["session_id"]
    current_state = state_manager.get_state(session_id)

    if architect.is_session_cancelled(current_state):
        logger.warning(f"[Pipeline] 会话 {session_id} 已被手动终止")
        return {"session_id": session_id, "current_step": "cancelled"}

    try:
        delta = evaluator.run(current_state)
        if delta:
            state_manager.update_state(session_id, delta)
        else:
            logger.warning(f"[Pipeline] evaluator 未返回任何增量")
    except Exception as e:
        logger.error(f"[Pipeline] evaluator 执行异常: {e}")
        state_manager.update_state(session_id, {"current_step": "error_stage"})
        return {"session_id": session_id, "current_step": "error_stage"}

    return {"session_id": session_id, "current_step": "evaluator_done"}


def generator_node(state: PipelineState) -> PipelineState:
    session_id = state["session_id"]
    current_state = state_manager.get_state(session_id)

    if architect.is_session_cancelled(current_state):
        logger.warning(f"[Pipeline] 会话 {session_id} 已被手动终止")
        return {"session_id": session_id, "current_step": "cancelled"}

    try:
        delta = generator.run(current_state)
        if delta:
            state_manager.update_state(session_id, delta)
        else:
            logger.warning(f"[Pipeline] generator 未返回任何增量")
    except Exception as e:
        logger.error(f"[Pipeline] generator 执行异常: {e}")
        state_manager.update_state(session_id, {"current_step": "error_stage"})
        return {"session_id": session_id, "current_step": "error_stage"}

    return {"session_id": session_id, "current_step": "completed"}


# ==================== 条件边路由 ====================

def route_after_classify(state: PipelineState) -> str:
    session_id = state["session_id"]
    current_state = state_manager.get_state(session_id)

    if current_state.current_step == "error_stage":
        return END
    if current_state.current_step == "cancelled":
        return END

    intent = current_state.intent
    if intent in ("report_generation", "animation_generation"):
        return "generator"
    return "architect"


def route_after_architect(state: PipelineState) -> str:
    session_id = state["session_id"]
    current_state = state_manager.get_state(session_id)

    if current_state.current_step == "error_stage":
        return END
    if current_state.current_step == "cancelled":
        return END

    intent = current_state.intent
    if intent in ("report_generation", "animation_generation"):
        return "generator"
    return "tutor"


# ==================== 构建图 ====================

def build_pipeline_graph():
    graph = StateGraph(PipelineState)

    graph.add_node("intent_classify", intent_classify_node)
    graph.add_node("architect", architect_node)
    graph.add_node("tutor", tutor_node)
    graph.add_node("evaluator", evaluator_node)
    graph.add_node("generator", generator_node)

    graph.set_entry_point("intent_classify")

    graph.add_conditional_edges("intent_classify", route_after_classify)
    graph.add_conditional_edges("architect", route_after_architect)
    graph.add_edge("tutor", "evaluator")
    graph.add_edge("evaluator", "generator")
    graph.add_edge("generator", END)

    return graph.compile()


_pipeline_graph = None


def run_vision_forge_pipeline(session_id: str, user_intent: str) -> dict:
    global _pipeline_graph
    if _pipeline_graph is None:
        _pipeline_graph = build_pipeline_graph()

    logger.info(f"[Pipeline] 启动 Vision-Forge | Session: {session_id}")

    state_manager.update_state(session_id, {
        "user_intent": user_intent,
        "current_step": "intent_classify"
    })

    initial_state = {"session_id": session_id, "current_step": "intent_classify"}
    _pipeline_graph.invoke(initial_state)

    return state_manager.get_state(session_id).model_dump()
