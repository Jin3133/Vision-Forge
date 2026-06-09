import json
import re
from typing import Dict, Any
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase


class ArchitectAgent(AgentBase):
    def __init__(self):
        # ✅ 强化 Prompt：Few-Shot 示例 + 严格禁止 Markdown
        role_prompt = """你是一个视觉算法架构师和意图识别专家。
        请输出一个纯 JSON，不要任何其他文字。
        JSON 结构必须包含：
        {
          "intent": "report_generation",
          "confidence": 0.9,
          "learner_profile": {"domain": "农业"},
          "sandbox_config": {
            "task_type": "病害检测",
            "nodes": [{"id": "n1", "type": "input", "name": "输入"}, {"id": "n2", "type": "model", "name": "YOLO"}],
            "edges": [{"source": "n1", "target": "n2"}]
          },
          "next_step": "tutor_stage"
        }

        intent 字段说明：
        - "report_generation"：用户需要生成报告、总结、评估等文字性输出
        - "animation_generation"：用户需要生成动画、演示、可视化等动态展示
        - "mixed_generation"：用户同时需要报告和动画，或意图不明确

        next_step 规则：
        - "report_generation" 或 "animation_generation" → "generator_stage"（跳过 tutor 和 evaluator）
        - "mixed_generation" → "tutor_stage"（走完整流程）
        """
        super().__init__(name="Architect", role_prompt=role_prompt)

    def run(self, state: TaskState) -> Dict[str, Any]:
        user_intent = state.user_intent
        logger.info(f"[{self.name}] 正在向大模型发起请求...")

        # 如果有文档内容，追加到用户意图中作为上下文
        doc_content = state.parsed_document_content
        if doc_content:
            user_intent = f"{user_intent}\n\n以下是用户上传的文档内容，请结合文档内容分析用户意图：\n{doc_content}"

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
            "intent": parsed_result.get("intent", "mixed_generation"),
            "confidence": parsed_result.get("confidence", 0.0),
            "learner_profile": parsed_result.get("learner_profile", {}),
            "sandbox_config": parsed_result.get("sandbox_config", {}),
            "current_step": parsed_result.get("next_step", "tutor_stage"),
            "history": [f"[{self.name}] 成功生成算子配置，意图={parsed_result.get('intent', 'mixed_generation')}"]
        }