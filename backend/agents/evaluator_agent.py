import json
from typing import Dict, Any
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase
from services.external_services.rag_service import rag_service


class EvaluatorAgent(AgentBase):
    def __init__(self):
        # 💡 核心提示词：化身"论文评审专家"，专门挑刺
        role_prompt = """你是一个严苛的计算机视觉论文评审专家与架构评估师。
你的任务是：对比用户配置的沙盒模型结构 与 真实论文基准（Ground Truth），指出配置中的逻辑冲突，并给出改进建议。

【评估维度】
1. 算子搭配合理性（例如：用了轻量级主干网络，却配了极耗算力的解码器）。
2. 参数设置合规性（例如：降维通道数是否符合论文规范）。
3. 架构完整性（是否有必要的组件缺失，如缺少 Neck 导致多尺度信息丢失）。

请直接输出你的评估报告，要求：
- 语气严谨专业，直指痛点。
- 必须引用"基准数据检索结果"中的真实数据作为你的论据支撑。
- 最后给出 1-3 条具体可操作的改进建议。"""
        super().__init__(name="Evaluator", role_prompt=role_prompt)

    def run(self, state: TaskState) -> Dict[str, Any]:
        logger.info(f"[{self.name}] 启动学情与配置评估引擎...")

        # 1. 读取架构师生成的 JSON 配置 (这是一个 Pydantic 对象)
        sandbox_config = self.read_blackboard(state, "sandbox_config")

        # 2. 构建检索 query 并调用 RagService 双通道检索
        task = getattr(sandbox_config, "task_type", "目标检测")
        model = getattr(sandbox_config, "suggested_backbone", "未知模型")

        # 提取所有节点名称用于丰富检索 query
        nodes = getattr(sandbox_config, "nodes", []) or []
        node_names = [getattr(n, "name", "") for n in nodes if getattr(n, "name", "")]
        nodes_str = "、".join(node_names[:5]) if node_names else model

        search_query = f"{model} {nodes_str} 在 {task} 中的最佳实践与算子搭配"
        logger.info(f"[{self.name}] RAG 检索 query: {search_query}")

        # ✅ 使用 RagService 双通道检索（替代旧的 _mock_rag_search）
        retrieved_knowledge = rag_service.search(search_query, top_k=3)

        # 3. 组装评估 Prompt
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

        # 5. 严格遵守黑板模式的"增量合并"原则
        return {
            "evaluation_results": {
                "report": response_text,
                "retrieved_sources": retrieved_knowledge
            },
            "current_step": "generator_stage",
            "history": [
                f"[{self.name}] 通过 RagService 完成知识检索（通道: {rag_service._backend}）",
                f"[{self.name}] 完成架构评估报告生成"
            ]
        }


# ================= 单元测试 =================
if __name__ == "__main__":
    from core.state import SandboxConfig, NodeModel

    mock_state = TaskState(
        session_id="test_session_003",
        user_intent="我要做玉米病斑检测",
        sandbox_config=SandboxConfig(
            task_type="目标检测",
            suggested_backbone="YOLOv8",
            nodes=[
                NodeModel(id="n1", type="BACKBONE", name="ResNet50"),
                NodeModel(id="n2", type="HEAD", name="YOLO_Detect_Head"),
            ]
        ),
        current_step="evaluator_stage"
    )

    print("--- 评估智能体 测试开始 ---")
    evaluator = EvaluatorAgent()
    delta = evaluator.run(mock_state)
    print("\n--- 评估报告 ---")
    print(delta.get("evaluation_results", {}).get("report", "无输出"))
