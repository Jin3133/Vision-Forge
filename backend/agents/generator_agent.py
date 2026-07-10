import json
from typing import Dict, Any
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase


class GeneratorAgent(AgentBase):
    def __init__(self):
        # 💡 核心提示词：化身“讲义排版大师”，强制输出 Mermaid
        role_prompt = """你是一个专业的学术讲义排版引擎。
你的任务是：将用户的任务配置和专家的评估报告，整合为一份多模态的 HTML 学术讲义片段。

【排版强制要求】
1. 必须使用 <h3> 等 HTML 标签划分层级（不需要 <html><body> 等外层包裹，直接输出内容片段即可）。
2. 必须包含一段 Mermaid 架构图代码，用 <pre class="mermaid"> 包裹，展示用户配置的模型拓扑结构。
3. 将专家的评估报告转化为“改进建议”列表。

请直接输出 HTML 源码，不要包含任何 markdown 代码块标记（如 ```html）。"""
        super().__init__(name="Generator", role_prompt=role_prompt)

    def run(self, state: TaskState) -> Dict[str, Any]:
        logger.info(f"[{self.name}] 启动多模态讲义渲染引擎...")

        # 1. 把黑板上所有的“物料”收集起来
        sandbox_config = self.read_blackboard(state, "sandbox_config")
        evaluation = self.read_blackboard(state, "evaluation_results").get("report", "暂无评估报告")

        # 将 Pydantic 对象安全转为字典再序列化
        config_dict = sandbox_config.model_dump() if hasattr(sandbox_config, "model_dump") else sandbox_config

        # 2. 组装给大模型的排版指令
        prompt = f"""
请基于以下数据生成 HTML 讲义：

【沙盒配置】：
{json.dumps(config_dict, ensure_ascii=False, indent=2)}

【专家评估意见】：
{evaluation}

要求：必须根据沙盒配置画出 Mermaid 流程图（包含 Backbone 和 Plugins）。
"""
        # 3. 调用星火大脑 (temperature 调低，保证代码结构的稳定性)
        html_report = self.call_llm(user_input=prompt, temperature=0.2)

        # 4. 把最终的讲义挂在黑板上，流程结束
        # ✅ 修复：final_report_html 统一装进 evaluation_results（与 main.py 响应映射对齐）
        return {
            "evaluation_results": {
                "final_report_html": html_report
            },
            "current_step": "completed",
            "history": [f"[{self.name}] 最终多模态讲义已生成"]
        }


# ================= 单元测试 =================
if __name__ == "__main__":
    from core.state import SandboxConfig, NodeModel

    # ✅ 修复：必须实例化为 TaskState 对象，不能直接传字典
    mock_state = TaskState(
        session_id="test_session_final",
        user_intent="我要做玉米病斑检测",
        learner_profile={"domain": "农业", "cognitive_style": "图表直观应用"},
        sandbox_config=SandboxConfig(
            task_type="目标检测",
            suggested_backbone="ResNet50",
            nodes=[
                NodeModel(id="n1", type="BACKBONE", name="ResNet50"),
                NodeModel(id="n2", type="HEAD", name="YOLO_Detect_Head"),
            ]
        ),
        evaluation_results={
            "report": "建议将 reduction 参数调整为 16 以符合原论文规范。"
        },
        current_step="generator_stage"
    )

    print("--- 资源生成智能体 测试开始 ---")
    generator = GeneratorAgent()
    delta = generator.run(mock_state)
    print("\n--- 最终生成的 HTML 讲义源码 ---")
    print(delta.get("evaluation_results", {}).get("final_report_html", "生成失败"))
