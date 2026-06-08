import json
import re
from typing import Dict, Any
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase


class ArchitectAgent(AgentBase):
    def __init__(self):
        # ✅ 强化 Prompt：Few-Shot 示例 + 严格禁止 Markdown
        role_prompt = """你是一个视觉算法架构师。
        请输出一个纯 JSON，不要任何其他文字。
        JSON 结构必须包含：
        {
          "learner_profile": {"domain": "农业"},
          "sandbox_config": {
            "task_type": "病害检测",
            "nodes": [{"id": "n1", "type": "input", "name": "输入"}, {"id": "n2", "type": "model", "name": "YOLO"}],
            "edges": [{"source": "n1", "target": "n2"}]
          },
          "next_step": "tutor_stage"
        }
        """
        super().__init__(name="Architect", role_prompt=role_prompt)

    def run(self, state: TaskState) -> Dict[str, Any]:
        user_intent = state.user_intent
        logger.info(f"[{self.name}] 正在向大模型发起请求...")

        # 1. 获取响应
        response_text = self.call_llm(user_input=user_intent, temperature=0.0)

        # 2. 清理 Markdown 干扰
        cleaned = re.sub(r"```json\s*", "", response_text)
        cleaned = re.sub(r"```", "", cleaned).strip()

        # ✅ 核心补丁：强制修复逗号缺失
        # 修复 1: 对象间缺失逗号 } { -> }, {
        cleaned = re.sub(r'\}\s*\{', '}, {', cleaned)
        # 修复 2: 属性间缺失逗号 " " -> ", " (这是最容易出错的地方)
        # 将 "key": "value" "key2" 改为 "key": "value", "key2"
        cleaned = re.sub(r'"\s+"', '", "', cleaned)
        # 修复 3: 数组元素间缺失逗号 ] [ -> ], [
        cleaned = re.sub(r'\]\s*\[', '], [', cleaned)

        logger.info(f"[{self.name}] 修复后的文本: {cleaned[:100]}...")

        try:
            parsed_result = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"❌ 补丁修正后依然解析失败: {e}")
            # ✅ 彻底阻断：出错直接跳到 error_stage，绝不回到 init
            return {
                "current_step": "error_stage",
                "history": [f"[{self.name}] 格式解析失败，模型输出不符合 JSON 规范。"]
            }

        return {
            "learner_profile": parsed_result.get("learner_profile", {}),
            "sandbox_config": parsed_result.get("sandbox_config", {}),
            "current_step": parsed_result.get("next_step", "tutor_stage"),
            "history": [f"[{self.name}] 成功生成算子配置。"]
        }