import json
from typing import Dict, Any
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase


class ArchitectAgent(AgentBase):
    def __init__(self):
        # 💡 核心秘诀：通过强约束 Prompt，让大模型同时扮演“导师”和“JSON转换器”
        role_prompt = """你是一个顶级的视觉算法架构师兼启发式引导导师。
你的核心任务是：分析用户的非标准化诉求（如农作物检测、医学看片），提取他们的专业背景，并将任务映射为后端的视觉算子编排配置。

请严格以 JSON 格式输出，不要包含任何 markdown 代码块标记，不要有任何开场白或废话，确保输出能够被 Python 原生 json.loads() 解析。

输出的 JSON 结构必须严格包含以下两个主键：
{
  "learner_profile": {
    "domain": "所属领域，如农业、医学、电商等",
    "knowledge_level": "AI初学者 或 有深度学习经验",
    "cognitive_style": "代码底层探索 或 图表直观应用"
  },
  "sandbox_config": {
    "task_type": "任务本质，如 实例分割、目标检测、图像分类",
    "suggested_backbone": "推荐的基础大模型，如 SAM_ViT_B, ResNet50 等",
    "suggested_plugins": ["推荐的微调算子1", "推荐的微调算子2"]
  }
}"""
        super().__init__(name="Architect", role_prompt=role_prompt)

    def run(self, state: TaskState) -> Dict[str, Any]:
        """
        根据 LangGraph 的标准，run 方法通常返回需要更新的状态“增量 (Delta)”，
        而不是整个 state。
        """
        user_intent = self.read_blackboard(state, "user_intent")
        if not user_intent:
            logger.error(f"[{self.name}] 致命错误：黑板中没有找到用户意图 (user_intent)")
            return {}

        self.update_history(state, f"收到用户输入: {user_intent}")
        logger.info(f"[{self.name}] 正在分析诉求并生成学习画像与沙盒配置...")

        # 1. 调用基类已经连通的星火大模型
        # temperature=0.1 保证 JSON 输出的稳定性，减少幻觉
        response_text = self.call_llm(user_input=user_intent, temperature=0.1)

        # 2. 清洗并解析大模型的输出
        try:
            # 过滤掉大模型可能自作聪明加上的 ```json 标签
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            parsed_result = json.loads(clean_text)

            logger.info(f"[{self.name}] JSON 解析成功！")
            self.update_history(state, "成功提取学习画像与算子配置")

            # 3. 返回状态增量，供外部的主循环（或 LangGraph）将其合并进全局黑板
            return {
                "learner_profile": parsed_result.get("learner_profile", {}),
                "sandbox_config": parsed_result.get("sandbox_config", {}),
                "current_step": "evaluator_stage"  # 指针推向下一步
            }

        except json.JSONDecodeError as e:
            logger.error(f"[{self.name}] JSON 解析失败。大模型输出为:\n{response_text}\n错误信息:{e}")
            self.update_history(state, "意图解析失败，格式异常")

            return {
                "learner_profile": {"error": "解析失败"},
                "sandbox_config": {"error": "解析失败"}
            }


# ================= 单元测试 =================
if __name__ == "__main__":
    # 为了方便你单独测试这个 Agent，我加了一段测试代码
    # 初始化一个空的全局黑板，模拟前端传来的第一句话
    mock_state: TaskState = {
        "session_id": "test_session_001",
        "user_intent": "我是农学院的大三学生，我想做一个能自动识别无人机航拍图里玉米叶子生病（病斑）的系统。我对敲代码不是很懂，希望能直观一点。",
        "learner_profile": {},
        "sandbox_config": {},
        "evaluation_results": {},
        "history": [],
        "current_step": "init"
    }

    print("--- 测试开始 ---")
    architect = ArchitectAgent()

    # 运行智能体
    delta_updates = architect.run(mock_state)

    # 模拟 LangGraph 的状态合并机制
    mock_state.update(delta_updates)

    print("\n--- 最终的全局黑板 (TaskState) ---")
    print(json.dumps(mock_state, indent=2, ensure_ascii=False))