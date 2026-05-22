import os
from pathlib import Path
from typing import Dict, Any
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase


class TutorAgent(AgentBase):
    def __init__(self):
        # 💡 核心提示词：强调“因材施教”和“真实源码”
        role_prompt = """你是一个严谨且富有启发性的视觉算法底层源码助教。
你的核心任务是：结合真实的系统源码，向学生解释算法底层的运行机制。

【核心原则】
1. 坚决捍卫高密度源码的完整性，不要用“伪代码”糊弄学生。直接引用源码中的核心行。
2. 根据学生的认知风格（Cognitive Style）调整解释深度：
   - 如果是“图表直观应用”风格，请多用生活化比喻，重点讲输入输出特征图的变化。
   - 如果是“代码底层探索”风格，请硬核一点，重点讲张量拼接(concat)、注意力权重的具体维度计算。
3. 输出必须是清晰的 Markdown 格式。"""
        super().__init__(name="Tutor", role_prompt=role_prompt)

    def _read_source_code(self, filename: str) -> str:
        """工具函数：从本地物理资产库读取真实源码"""
        try:
            # 动态定位到 assets/code_mirror 目录
            current_dir = Path(__file__).resolve().parent
            file_path = current_dir.parent / "assets" / "code_mirror" / filename

            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            logger.error(f"[{self.name}] 找不到源码文件: {file_path}")
            return "源码文件读取失败，请检查资产库路径。"

    def run(self, state: TaskState) -> Dict[str, Any]:
        logger.info(f"[{self.name}] 启动源码教研引擎...")

        # 1. 从黑板读取上一棒 (Architect) 留下的学习画像
        profile = self.read_blackboard(state, "learner_profile") or {}
        cognitive_style = profile.get("cognitive_style", "标准模式")

        # ⚠️ 这里为了演示，我们先硬编码读取咱们昨天写的那个压测算子文件
        # 在真实流程中，这个文件名应该是由大模型根据用户意图从知识库中检索出来的
        target_file = "SE_Block.py"

        # 2. 读取真实的底层物理资产
        source_code = self._read_source_code(target_file)
        if "读取失败" in source_code:
            return {"current_step": "error_stage"}

        # 3. 组装“强力 Prompt” (将源码和学习画像一起喂给大模型)
        prompt = f"""
        当前学生的认知风格偏好为：【{cognitive_style}】。

        以下是我们要讲解的核心算子真实源码（文件：{target_file}）：
        ```python
        {source_code}
        请用启发式的口吻，结合源码中的中文注释，为该学生详细拆解这段代码的 forward 函数执行流。
        """
        self.update_history(state, f"准备讲解底层源码: {target_file}")
        # 4. 调用星火大脑 (适度提高 temperature 让讲解更生动)
        response_text = self.call_llm(user_input=prompt, temperature=0.5)

        self.update_history(state, "源码教研讲解生成完毕")

        # 5. 返回增量数据，写回全局黑板
        return {
            "tutor_response": response_text,
            "current_step": "evaluator_stage"  # 讲解完后，指针推向评估阶段
        }

#================= 单元测试 =================
if __name__ == "__main__":
# 测试前，请确保 backend/assets/code_mirror/ 目录下有 MAFE_Module.py 文件！
    mock_state: TaskState = {
    "session_id": "test_session_002",
    "user_intent": "我想看看特征金字塔是怎么融合的",
    "learner_profile": {
    "cognitive_style": "代码底层探索，喜欢看矩阵维度计算"
    },
    "sandbox_config": {},
    "evaluation_results": {},
    "history": [],
    "current_step": "tutor_stage"
    }

    print("--- 源码教研智能体 测试开始 ---")
    tutor = TutorAgent()
    delta_updates = tutor.run(mock_state)

    print("\n--- 助教讲解输出 ---")
    print(delta_updates.get("tutor_response", "无输出"))