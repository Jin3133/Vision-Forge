import json
from typing import Dict, Any
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase
from services.external_services.render_service import render_service
from services.data_services.benchmark_service import benchmark_service


class GeneratorAgent(AgentBase):
    def __init__(self):
        # 💡 核心提示词：化身"讲义排版大师"，强制输出 Mermaid
        role_prompt = """你是一个专业的学术讲义排版引擎。
你的任务是：将用户的任务配置和专家的评估报告，整合为一份多模态的 HTML 学术讲义片段。

【排版强制要求】
1. 必须使用 <h3> 等 HTML 标签划分层级（不需要 <html><body> 等外层包裹，直接输出内容片段即可）。
2. 必须包含一段 Mermaid 架构图代码，用 <pre class="mermaid"> 包裹，展示用户配置的模型拓扑结构。
3. 将专家的评估报告转化为"改进建议"列表。

【严格格式约束】
- 直接输出 HTML 源码，严禁用 ```html 或任何 markdown 代码围栏包裹
- 严禁在 HTML 中使用 '***'、'---' 等纯文本装饰线
- 如需分隔视觉区域，使用 <hr> 标签或 CSS border
- 不要输出任何 HTML 片段之外的解释性文字"""
        super().__init__(name="Generator", role_prompt=role_prompt)

    def run(self, state: TaskState) -> Dict[str, Any]:
        logger.info(f"[{self.name}] 启动 Tool-First 多模态讲义渲染引擎...")

        # 1. 收集黑板物料
        sandbox_config = self.read_blackboard(state, "sandbox_config")
        evaluation_results = self.read_blackboard(state, "evaluation_results") or {}
        evaluation = evaluation_results.get("report", "暂无评估报告")

        # 2. Tool-First 渲染：Mermaid 拓扑图（确定性工具，不依赖 LLM）
        logger.info(f"[{self.name}] 🔧 Tool: render_mermaid")
        mermaid_diagram = render_service.render_mermaid(sandbox_config)

        # 3. Tool-First 渲染：消融图表（如果有匹配的 benchmark 数据）
        ablation_chart = ""
        try:
            benchmark = benchmark_service.find_best_match(sandbox_config)
            if benchmark:
                logger.info(f"[{self.name}] 🔧 Tool: render_ablation_chart (exp: {benchmark.get('id')})")
                ablation_chart = render_service.render_ablation_chart(benchmark)
        except Exception as e:
            logger.warning(f"[{self.name}] 消融图表渲染失败（非致命）: {e}")

        # 4. LLM 补充：让模型解释评估报告中的改进建议（仅用于文本润色）
        sandbox_config_dict = sandbox_config.model_dump() if hasattr(sandbox_config, "model_dump") else {}
        task_type = sandbox_config_dict.get("task_type", "视觉任务")
        eval_summary = evaluation[:800] if evaluation else "暂无风险评估"

        llm_sections_prompt = f"""请基于以下评估报告，提取"改进建议"并整理成 HTML 列表格式（<ul><li>...）。

评估报告摘要：
{eval_summary}

只输出 HTML 片段（<h4>改进建议</h4><ul>...），不要有任何额外文字。"""

        try:
            improvement_html = self.call_llm(user_input=llm_sections_prompt, temperature=0.3)
        except Exception as e:
            logger.warning(f"[{self.name}] LLM 补充生成失败: {e}")
            improvement_html = "<p>改进建议生成失败，请参考上方评估报告。</p>"

        # 5. Tool-First 拼装：将工具产出 + LLM 文本组装为最终 HTML
        logger.info(f"[{self.name}] 🔧 Tool: compose_html")
        title = f"{task_type} 学习讲义"
        html_report = render_service.compose_html(
            title=title,
            mermaid_diagram=mermaid_diagram,
            ablation_chart_b64=ablation_chart,
            evaluation_text=improvement_html,
            sections=[
                {"heading": "配置详情", "body": f"<pre>{json.dumps(sandbox_config_dict, ensure_ascii=False, indent=2)}</pre>"},
            ],
        )

        return {
            "evaluation_results": {
                "final_report_html": html_report
            },
            "current_step": "completed",
            "history": [
                f"[{self.name}] Tool-First 讲义生成完成 (Mermaid + {'图表' if ablation_chart else '无图表'} + LLM文本)",
                f"[{self.name}] 最终多模态讲义已生成"
            ]
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
