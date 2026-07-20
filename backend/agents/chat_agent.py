"""
轻量级对话智能体 —— 用于纯聊天场景，不走完整流水线。
"""

from typing import Dict, Any
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase


class ChatAgent(AgentBase):
    """纯对话智能体：回答概念性问题，不触发架构评估/讲义生成。"""

    def __init__(self):
        role_prompt = """你是 Vision-Forge 平台的 AI 知识助手，专注于计算机视觉与深度学习领域。

【领域限定】
- 你只回答计算机视觉、深度学习、模型架构、图像处理相关的问题
- 如果用户问非技术问题（如天气、娱乐、政治），友好地引导回 CV/AI 领域
- 例如："我是 CV 学习助手，对这个话题不太了解。你想了解计算机视觉的什么知识呢？"

【对话风格】
- 回答概念性问题（什么是CNN、Transformer怎么工作等）
- 解释算法原理和论文要点
- 用通俗易懂的中文和恰当的比喻
- 保持回答简洁，每次不超过 300 字

【输出格式】
- 用自然段落，重点用 **加粗** 标注
- 代码块用 ```python 包裹"""
        super().__init__(name="ChatAgent", role_prompt=role_prompt)

    def run(self, state: TaskState) -> Dict[str, Any]:
        """执行纯对话，带对话记忆。"""
        user_intent = state.user_intent
        logger.info(f"[{self.name}] 收到对话请求: {user_intent[:80]}...")

        # 构建带历史上下文的 prompt
        prompt = user_intent
        history = getattr(state, "history", []) or []
        recent = history[-6:]  # 最近 6 条对话记录
        if recent:
            context = "\n".join([f"- {h}" for h in recent[-6:]])
            prompt = f"【最近对话记录】\n{context}\n\n【当前问题】\n{user_intent}"

        response_text = self.call_llm(user_input=prompt, temperature=0.5)

        return {
            "evaluation_results": {
                "tutor_response": response_text
            },
            "current_step": "completed",
            "history": [
                f"[ChatAgent] Q: {user_intent[:60]} → A: {response_text[:60]}..."
            ]
        }
