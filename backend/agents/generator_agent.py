import json
from typing import Dict, Any, List
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase
from services.external_services.render_service import render_service
from services.data_services.benchmark_service import benchmark_service

# 支持的全部资源类型
RESOURCE_TYPES = ["讲义", "思维导图", "练习题", "PPT大纲", "拓展阅读", "实操案例"]


class GeneratorAgent(AgentBase):
    def __init__(self):
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

    # ==================== 主入口：讲义生成（保持向后兼容） ====================

    def run(self, state: TaskState) -> Dict[str, Any]:
        logger.info(f"[{self.name}] 启动 Tool-First 多模态讲义渲染引擎...")

        sandbox_config = self.read_blackboard(state, "sandbox_config")
        evaluation_results = self.read_blackboard(state, "evaluation_results") or {}
        evaluation = evaluation_results.get("report", "暂无评估报告")

        logger.info(f"[{self.name}] 🔧 Tool: render_mermaid")
        mermaid_diagram = render_service.render_mermaid(sandbox_config)

        ablation_chart = ""
        try:
            benchmark = benchmark_service.find_best_match(sandbox_config)
            if benchmark:
                logger.info(f"[{self.name}] 🔧 Tool: render_ablation_chart (exp: {benchmark.get('id')})")
                ablation_chart = render_service.render_ablation_chart(benchmark)
        except Exception as e:
            logger.warning(f"[{self.name}] 消融图表渲染失败（非致命）: {e}")

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

    # ==================== 批量生成入口 ====================

    def run_multi(self, state: TaskState, material_types: List[str] = None) -> Dict[str, Any]:
        """批量生成多种学习材料，每种类型独立调用 LLM 确保质量。"""
        types_to_generate = material_types or RESOURCE_TYPES
        logger.info(f"[{self.name}] 批量生成 {len(types_to_generate)} 种资源: {types_to_generate}")

        generated = {}
        for mt in types_to_generate:
            try:
                if mt == "讲义":
                    content = self.run(state).get("evaluation_results", {}).get("final_report_html", "")
                    generated[mt] = content
                elif mt == "思维导图":
                    generated[mt] = self._generate_mindmap(state)
                elif mt == "练习题":
                    generated[mt] = self._generate_exercises(state)
                elif mt == "PPT大纲":
                    generated[mt] = self._generate_ppt_outline(state)
                elif mt == "拓展阅读":
                    generated[mt] = self._generate_extended_reading(state)
                elif mt == "实操案例":
                    generated[mt] = self._generate_practice_case(state)
                else:
                    logger.warning(f"[{self.name}] 未知资源类型: {mt}，跳过")
            except Exception as e:
                logger.error(f"[{self.name}] 生成 {mt} 失败: {e}")
                generated[mt] = f"<p>生成失败: {str(e)}</p>"

        return {
            "generated_materials": generated,
            "current_step": "completed",
            "history": [
                f"[{self.name}] 批量生成完成: {list(generated.keys())}"
            ]
        }

    # ==================== 5 种资源类型的专用生成方法 ====================

    def _get_context(self, state: TaskState) -> Dict[str, Any]:
        """提取黑板上下文（所有生成方法共用）。"""
        sandbox_config = self.read_blackboard(state, "sandbox_config")
        evaluation_results = self.read_blackboard(state, "evaluation_results") or {}
        learner_profile = self.read_blackboard(state, "learner_profile") or {}
        sc_dict = sandbox_config.model_dump() if hasattr(sandbox_config, "model_dump") else {}
        return {
            "task_type": sc_dict.get("task_type", "视觉任务"),
            "backbone": sc_dict.get("suggested_backbone", "未指定"),
            "nodes": sc_dict.get("nodes", []),
            "eval_report": evaluation_results.get("report", "暂无评估报告"),
            "domain": learner_profile.get("domain", "计算机视觉"),
            "knowledge_level": learner_profile.get("knowledge_level", "入门"),
        }

    def _generate_mindmap(self, state: TaskState) -> str:
        """生成思维导图（Markdown + Mermaid mindmap 格式）。"""
        ctx = self._get_context(state)
        prompt = f"""你是一个教学思维导图设计专家。请为以下学习内容生成一份思维导图。

【学习上下文】
- 任务类型：{ctx['task_type']}
- 主干网络：{ctx['backbone']}
- 知识等级：{ctx['knowledge_level']}
- 涉及领域：{ctx['domain']}

【输出要求】
1. 用 Markdown 格式，以 "# 学习思维导图" 开头
2. 核心主题 → 一级分支（4-6个）→ 二级知识点
3. 使用缩进列表（- **分支名**：知识点描述）的结构
4. 必须包含以下维度：核心概念、模型结构、关键技术、常见陷阱、实践建议
5. 每个分支下至少列出 3 个具体知识点
6. 内容要结合具体的 {ctx['task_type']} 和 {ctx['backbone']} 展开
7. 不要用 Mermaid 代码块（纯 Markdown 即可）

只输出 Markdown 内容，不要有其他解释。"""

        logger.info(f"[{self.name}] 🧠 生成思维导图...")
        result = self.call_llm(user_input=prompt, temperature=0.5)
        return result

    def _generate_exercises(self, state: TaskState) -> str:
        """生成练习题（选择题 + 简答题 + 编程实践）。"""
        ctx = self._get_context(state)
        prompt = f"""你是一个计算机视觉教学专家。请为以下学习内容生成一套练习题。

【学习上下文】
- 任务类型：{ctx['task_type']}
- 主干网络：{ctx['backbone']}
- 知识等级：{ctx['knowledge_level']}
- 评估报告要点：{ctx['eval_report'][:500]}

【输出要求 —— 严格使用以下 Markdown 格式】
# 练习题集

## 一、选择题（每题 4 个选项，标注正确答案）
1. 【题目描述】
   A. 选项A
   B. 选项B
   C. 选项C
   D. 选项D
   > 正确答案：X | 解析：...

（共 5 道选择题）

## 二、简答题
1. 【题目描述】
   > 参考答案：...（2-3 句话）

（共 3 道简答题）

## 三、编程实践题
1. 【题目描述 —— 结合 {ctx['backbone']} 的实际代码任务】
   > 提示：... | 预期输出：...

（共 2 道编程题）

【难度要求】
- 根据知识等级"{ctx['knowledge_level']}"调整难度
- 入门：侧重概念理解和基础代码
- 中等：侧重原理分析和调参实践
- 进阶：侧重论文复现和架构改进

只输出 Markdown，不要有其他解释。"""

        logger.info(f"[{self.name}] 📝 生成练习题...")
        result = self.call_llm(user_input=prompt, temperature=0.5)
        return result

    def _generate_ppt_outline(self, state: TaskState) -> str:
        """生成 PPT 大纲（结构化幻灯片大纲）。"""
        ctx = self._get_context(state)
        prompt = f"""你是一个教学 PPT 设计专家。请为以下学习内容生成一份 PPT 大纲。

【学习上下文】
- 任务类型：{ctx['task_type']}
- 主干网络：{ctx['backbone']}
- 知识等级：{ctx['knowledge_level']}
- 涉及领域：{ctx['domain']}

【输出要求 —— 严格使用以下 Markdown 格式】
# PPT 教学大纲：{ctx['task_type']} 详解

## 第 1 页：封面
- 标题：...
- 副标题：...
- 演讲人信息区域

## 第 2 页：目录
- 本章要点预览（3-5 条）

## 第 3 页：背景与动机
- 为什么需要 {ctx['task_type']}
- 应用场景举例

（继续 12-15 页幻灯片，覆盖以下主题）
- 核心概念与原理
- {ctx['backbone']} 架构详解
- 关键技术与创新点
- 实验设计与评估指标
- 常见问题与解决方案
- 实战案例演示
- 总结与展望
- Q&A

每页格式：
## 第 N 页：页面标题
- 要点 1（一句话）
- 要点 2（一句话）
- 要点 3（一句话）
- 【讲师备注】：...

只输出 Markdown，不要有其他解释。"""

        logger.info(f"[{self.name}] 📊 生成 PPT 大纲...")
        result = self.call_llm(user_input=prompt, temperature=0.5)
        return result

    def _generate_extended_reading(self, state: TaskState) -> str:
        """生成拓展阅读（论文推荐 + 阅读指南）。"""
        ctx = self._get_context(state)
        prompt = f"""你是一个学术文献导读专家。请为以下学习内容推荐拓展阅读材料。

【学习上下文】
- 任务类型：{ctx['task_type']}
- 主干网络：{ctx['backbone']}
- 知识等级：{ctx['knowledge_level']}
- 涉及领域：{ctx['domain']}

【输出要求 —— 严格使用以下 Markdown 格式】
# 拓展阅读指南

## 📖 必读经典论文（3 篇）
### 1. 【论文标题】
- 作者/年份：
- 核心贡献：（2-3 句话）
- 阅读重点：第 X 节的方法论部分
- 与当前学习的关系：...

## 📖 进阶推荐论文（2 篇）
### 4. 【论文标题】...（同上格式）

## 📖 相关综述与教程（2 篇）
### 6. 【标题】...（同上格式）

## 📖 阅读建议
- 阅读顺序：先读 X → 再读 Y → 最后 Z
- 预计总阅读时间：X 小时
- 每篇论文的阅读要点和思考题

请结合 {ctx['backbone']} 和 {ctx['task_type']} 推荐真实存在的经典论文（如 YOLO 系列、SAM、ResNet、ViT、DETR、FPN 等），确保论文名称和贡献描述准确。

只输出 Markdown，不要有其他解释。"""

        logger.info(f"[{self.name}] 📄 生成拓展阅读...")
        result = self.call_llm(user_input=prompt, temperature=0.5)
        return result

    def _generate_practice_case(self, state: TaskState) -> str:
        """生成实操案例（环境配置 + 代码 + 结果分析）。"""
        ctx = self._get_context(state)
        prompt = f"""你是一个深度学习实践教学专家。请为以下学习内容生成一个完整的实操案例。

【学习上下文】
- 任务类型：{ctx['task_type']}
- 主干网络：{ctx['backbone']}
- 知识等级：{ctx['knowledge_level']}
- 涉及领域：{ctx['domain']}

【输出要求 —— 严格使用以下 Markdown 格式】
# 实操案例：{ctx['task_type']} 实战

## 1. 案例目标
- 学习目标描述（2-3 点）
- 预期成果

## 2. 环境准备
```bash
# 必要的依赖安装
pip install torch torchvision ...

# 数据集下载（以公开数据集为例）
# 例如：COCO、VOC、自定义数据集等
```

## 3. 数据预处理
- 数据格式说明
- 预处理步骤（含代码示例）

## 4. 模型构建
- 基于 {ctx['backbone']} 的模型定义代码
- 关键参数说明

## 5. 训练配置
- 超参数设置（学习率、batch size、epoch 等）
- 损失函数选择
- 优化器配置

## 6. 训练与验证
- 训练循环代码示例
- 验证指标监控

## 7. 结果分析
- 预期实验结果
- 常见问题排查

## 8. 进阶挑战
- 改进方向建议

【代码风格】
- 使用 Python + PyTorch
- 关键行添加注释
- 代码块用 ```python 包裹

根据"{ctx['knowledge_level']}"调整代码复杂度：入门级别多注释、进阶级别多留改进空间。

只输出 Markdown，不要有其他解释。"""

        logger.info(f"[{self.name}] 💻 生成实操案例...")
        result = self.call_llm(user_input=prompt, temperature=0.5)
        return result


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
