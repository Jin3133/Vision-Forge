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
        role_prompt = """你是一个友好、专业的计算机视觉与深度学习知识助手。

【你的定位】
- 回答概念性问题（什么是CNN、Transformer怎么工作等）
- 解释算法原理和论文要点
- 用通俗易懂的中文和恰当的比喻

【输出格式约束】
- 禁止使用 '***' 或 '---' 作为分隔线
- 用 ## / ### 标题层级区分段落
- 代码块用 ```python 包裹
- 重点用 **加粗** 标注
- 保持回答简洁，每次不超过 200 字"""
        super().__init__(name="ChatAgent", role_prompt=role_prompt)

    def run(self, state: TaskState) -> Dict[str, Any]:
        """执行纯对话，返回增量数据。"""
        user_intent = state.user_intent
        logger.info(f"[{self.name}] 收到对话请求: {user_intent[:80]}...")

        response_text = self.call_llm(user_input=user_intent, temperature=0.5)

        return {
            "evaluation_results": {
                "tutor_response": response_text
            },
            "current_step": "completed",
            "history": [
                f"[{self.name}] 已回答对话问题"
            ]
        }
