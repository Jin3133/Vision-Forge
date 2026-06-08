import json
from core.state import state_manager
from core.logger import logger

# 引入四大金刚
from agents.architect_agent import ArchitectAgent
from agents.tutor_agent import TutorAgent
from agents.evaluator_agent import EvaluatorAgent
from agents.generator_agent import GeneratorAgent

# 全局实例化
architect = ArchitectAgent()
tutor = TutorAgent()
evaluator = EvaluatorAgent()
generator = GeneratorAgent()


def run_vision_forge_pipeline(session_id: str, user_intent: str) -> dict:
    logger.info(f"🚀 [Pipeline] 启动 Vision-Forge | Session: {session_id}")

    # 1. 初始化
    state_manager.update_state(session_id, {
        "user_intent": user_intent,
        "current_step": "architect_stage"
    })

    max_steps = 15
    step_count = 0

    while step_count < max_steps:
        # 获取当前状态
        current_state = state_manager.get_state(session_id)
        current_step = current_state.current_step

        # 🚨 检查是否需要终止
        if architect.is_session_cancelled(current_state):
            logger.warning(f"🚨 [Pipeline] 会话 {session_id} 已被手动终止")
            break

        # 🚨 逻辑死循环防守：如果进入了异常状态，必须停止并记录
        if current_step in ["init", "error_stage"]:
            logger.error(f"❌ [Pipeline] 流转到异常节点: {current_step}，强制中断！")
            break

        if current_step == "completed":
            logger.info(f"✅ [Pipeline] 工作流完美收官！")
            break

        logger.info(f"➡️ [Pipeline] 当前节点: {current_step}")

        # ================= 动态路由与防崩保护 =================
        delta = {}
        try:
            if current_step == "architect_stage":
                delta = architect.run(current_state)
            elif current_step == "tutor_stage":
                delta = tutor.run(current_state)
            elif current_step == "evaluator_stage":
                delta = evaluator.run(current_state)
            elif current_step == "generator_stage":
                delta = generator.run(current_state)
            else:
                logger.error(f"❌ [Pipeline] 逻辑漏洞：未找到对应路由: {current_step}")
                state_manager.update_state(session_id, {"current_step": "error_stage"})
                break
        except Exception as e:
            logger.error(f"💥 [Pipeline] 执行 Agent 发生致命异常: {str(e)}")
            state_manager.update_state(session_id, {"current_step": "error_stage"})
            break

        # ================= 状态增量合并 =================
        if delta:
            state_manager.update_state(session_id, delta)
            step_count += 1
        else:
            logger.warning(f"⚠️ [Pipeline] Agent {current_step} 未返回任何增量 (Delta)")
            break

    return state_manager.get_state(session_id).model_dump()