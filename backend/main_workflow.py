import json
from core.state import TaskState
from core.logger import logger
from agents.architect_agent import ArchitectAgent
from agents.tutor_agent import TutorAgent
from agents.evaluator_agent import EvaluatorAgent
from agents.generator_agent import GeneratorAgent


def run_vision_forge_pipeline(user_input: str) -> dict:
    """
    Vision-Forge 多智能体协同主核心流水线
    负责指挥四大智能体按照业务逻辑顺序进行“黑板接力”
    """
    logger.info("=" * 50)
    logger.info("🚀 启动 Vision-Forge 多智能体流水线总控引擎")
    logger.info("=" * 50)

    # 1. 初始化全局共享黑板状态 (TaskState)
    state: TaskState = {
        "session_id": "api_session_current",
        "user_intent": user_input,
        "learner_profile": {},
        "sandbox_config": {},
        "evaluation_results": {},
        "history": [],
        "current_step": "start"
    }

    # 2. 实例化四大智能体
    architect = ArchitectAgent()
    evaluator = EvaluatorAgent()
    tutor = TutorAgent()
    generator = GeneratorAgent()

    try:
        # ==========================================
        # 第一棒：架构引导 (分析意图 -> 提取画像与沙盒配置)
        # ==========================================
        logger.info("▶️ [第一棒] 架构引导智能体介入...")
        delta_1 = architect.run(state)
        state.update(delta_1)  # 将增量更新合并进黑板

        # ==========================================
        # 第二棒：学情评估 (对比论文知识库基准 -> 挑刺纠错)
        # ==========================================
        logger.info("▶️ [第二棒] 评估智能体介入...")
        delta_2 = evaluator.run(state)
        state.update(delta_2)

        # ==========================================
        # 第三棒：底层教研 (读取 assets/code_mirror 源码进行拆解)
        # ==========================================
        logger.info("▶️ [第三棒] 教研智能体介入...")
        delta_3 = tutor.run(state)
        state.update(delta_3)

        # ==========================================
        # 第四棒：资源生成 (整合黑板所有数据 -> 排版 HTML 讲义)
        # ==========================================
        logger.info("▶️ [第四棒] 资源生成智能体介入...")
        delta_4 = generator.run(state)
        state.update(delta_4)

        logger.info("=" * 50)
        logger.info("🎉 核心流水线全线执行完毕，成功生成多模态资产！")
        logger.info("=" * 50)

        # 3. 返回经历过完整流水线洗礼后的最终黑板状态
        return state

    except Exception as e:
        logger.error(f"❌ 流水线内部流转发生致命崩溃: {e}")
        raise e