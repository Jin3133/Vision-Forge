import json
from typing import Dict, Any
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase


class EvaluatorAgent(AgentBase):
    def __init__(self):
        # 💡 核心提示词：化身“论文评审专家”，专门挑刺
        role_prompt = """你是一个严苛的计算机视觉论文评审专家与架构评估师。
你的任务是：对比用户配置的沙盒模型结构 与 真实论文基准（Ground Truth），指出配置中的逻辑冲突，并给出改进建议。

【评估维度】
1. 算子搭配合理性（例如：用了轻量级主干网络，却配了极耗算力的解码器）。
2. 参数设置合规性（例如：降维通道数是否符合论文规范）。

请直接输出你的评估报告，要求：
- 语气严谨专业，直指痛点。
- 必须引用“基准数据检索结果”中的真实数据作为你的论据支撑。"""
        super().__init__(name="Evaluator", role_prompt=role_prompt)

    def _mock_rag_search(self, query: str) -> str:
        """
        工具函数：模拟调用队员部署的 ragflow 接口。
        等队员的 VPN 和 API 搭好后，这里直接换成 requests.post() 请求他的接口。
        """
        logger.info(f"[{self.name}] 正在向 ragflow 知识库发起检索: '{query}'")
        # 这里模拟从你们的那 15 篇论文里搜出来的内容
        mock_retrieved_context = """
        [文献引用: YOLOv9 论文 Section 3.2]
        作者指出，在进行目标检测时，如果直接在浅层特征上使用大卷积核，会导致梯度信息丢失。
        实验数据显示，使用 PGI (Programmable Gradient Information) 模块可以使 AP50 指标提升 4.2%。
        [文献引用: SE-Net 原论文]
        降维系数(reduction ratio)通常设置为 16 是性能与计算量的最佳平衡点。
        """
        return mock_retrieved_context

    def run(self, state: TaskState) -> Dict[str, Any]:
        logger.info(f"[{self.name}] 启动学情与配置评估引擎...")

        # 1. 读取架构师生成的 JSON 配置 (这是一个 Pydantic 对象)
        sandbox_config = self.read_blackboard(state, "sandbox_config")

        # 2. 从本地/远程 RAG 数据库检索相关的论文基准
        # ✅ 修复：使用 getattr 安全读取 Pydantic 属性，而不是 dict.get()
        task = getattr(sandbox_config, "task_type", "目标检测")
        model = getattr(sandbox_config, "suggested_backbone", "未知模型")
        search_query = f"{model} 在 {task} 中的最佳实践与算子搭配"

        retrieved_knowledge = self._mock_rag_search(search_query)

        # 3. 组装评估 Prompt
        # ✅ 修复：先将 Pydantic 对象用 .model_dump() 转成字典，再 json.dumps，否则会报错
        config_dict = sandbox_config.model_dump() if sandbox_config else {}
        prompt = f"""
用户提交的沙盒配置如下：
{json.dumps(config_dict, ensure_ascii=False, indent=2)}

我们从底层论文向量库中检索到的真实基准数据如下：
{retrieved_knowledge}

请根据检索到的基准数据，评估用户的配置，指出不足，并给出修改建议。
"""

        # 4. 调用大模型
        response_text = self.call_llm(user_input=prompt, temperature=0.3)

        # ✅ 修复：严格遵守黑板模式的“增量合并”原则
        # 移除越权的 update_history，将日志统一放进返回的 history 列表里
        return {
            "evaluation_results": {
                "report": response_text,
                "retrieved_sources": retrieved_knowledge
            },
            "current_step": "generator_stage",  # 推向最终的报告生成环节
            "history": [
                f"[{self.name}] 成功从 ragflow 检索到论文基准数据",
                f"[{self.name}] 完成架构评估报告生成"
            ]
        }


# ================= 单元测试 =================
if __name__ == "__main__":
    from core.state import SandboxConfig
    # ✅ 修复测试用例：必须实例化为 TaskState 对象，不能直接传字典
    mock_state = TaskState(
        session_id="test_session_003",
        user_intent="我要做玉米病斑检测",
        sandbox_config=SandboxConfig(
            task_type="目标检测",
            suggested_backbone="YOLOv8"
        ),
        current_step="evaluator_stage"
    )

    print("--- 评估智能体 测试开始 ---")
    evaluator = EvaluatorAgent()
    delta = evaluator.run(mock_state)
    print("\n--- 评估报告 ---")
    print(delta.get("evaluation_results", {}).get("report", "无输出"))