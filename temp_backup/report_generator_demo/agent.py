"""
Vision-Forge 多模态报告生成 Agent
===================================

使用 MCP 协议风格工具定义 + OpenAI Function Calling
- 工具按 MCP 规范定义（inputSchema JSON Schema）
- 工具执行结果按 MCP 规范返回 content 列表
- DeepSeek API 通过 OpenAI SDK 直接调用（tool_calls 协议）

使用方法:
    from agent import ReportAgent
    agent = ReportAgent()
    html = agent.run(context_dict)
"""

import json
import os
import sys
import time
from datetime import datetime
from functools import wraps

import openai

from render_tools import (
    render_table,
    render_comparison_table,
    render_bar_chart,
    render_line_chart,
    render_pie_chart,
    render_metrics_card,
    render_mermaid_diagram,
    render_ordered_list,
    render_code_block,
    render_quote,
    render_alert,
    render_paragraph,
    assemble_html,
)


# =============================================================================
# MCP 协议风格工具定义
# inputSchema 符合 JSON Schema 2020-12
# =============================================================================

def _mcp_tools():
    return [
        {
            "name": "render_table",
            "description": "生成标准 HTML 表格。接收表头和数据行，输出 HTML table 片段。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "headers": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "表格列名列表"
                    },
                    "rows": {
                        "type": "array",
                        "items": {"type": "array"},
                        "description": "数据行二维列表，每行为一个列表"
                    }
                },
                "required": ["headers", "rows"]
            }
        },
        {
            "name": "render_comparison_table",
            "description": "生成多指标对比表格，自动将每列最优值标绿高亮。接收模型列表和指标字典。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "data": {
                        "type": "object",
                        "properties": {
                            "models": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "模型名称列表"
                            },
                            "metrics": {
                                "type": "object",
                                "description": "指标名到数值列表的映射，数值列表顺序对应 models"
                            }
                        },
                        "required": ["models", "metrics"]
                    }
                },
                "required": ["data"]
            }
        },
        {
            "name": "render_bar_chart",
            "description": "生成 Chart.js 柱状图，返回嵌入 Chart.js 初始化代码的 HTML 片段。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "labels": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "X 轴标签列表"
                    },
                    "datasets": {
                        "type": "array",
                        "description": "数据集列表，每项需含 label (str) 和 data (number[])，可选 color (str)"
                    },
                    "title": {"type": "string", "description": "图表标题"},
                    "xlabel": {"type": "string", "description": "X 轴标签"},
                    "ylabel": {"type": "string", "description": "Y 轴标签"}
                },
                "required": ["labels", "datasets"]
            }
        },
        {
            "name": "render_line_chart",
            "description": "生成 Chart.js 折线图，适合展示训练过程曲线（如 loss 和 mIoU 随 epoch 变化）。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "labels": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "X 轴标签（通常是 epoch 编号）"
                    },
                    "datasets": {
                        "type": "array",
                        "description": "数据集列表，每项需含 label (str) 和 data (number[])，可选 color (str)"
                    },
                    "title": {"type": "string", "description": "图表标题"},
                    "xlabel": {"type": "string", "description": "X 轴标签"},
                    "ylabel": {"type": "string", "description": "Y 轴标签"}
                },
                "required": ["labels", "datasets"]
            }
        },
        {
            "name": "render_pie_chart",
            "description": "生成 Chart.js 饼图，适合展示比例分布（如类别占比、训练时间分配等）。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "labels": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "标签列表"
                    },
                    "data": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "数据列表（百分比或绝对值）"
                    },
                    "title": {"type": "string", "description": "图表标题"},
                    "colors": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "可选颜色列表，如不提供则使用默认调色板"
                    }
                },
                "required": ["labels", "data"]
            }
        },
        {
            "name": "render_metrics_card",
            "description": "生成一行多个彩色指标卡片，适合展示关键数据（最优值、趋势、耗时等）。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "metrics": {
                        "type": "array",
                        "description": "指标列表，每项含 label (str)、value (str)、trend (up|down|neutral)、color (primary|secondary)"
                    },
                    "layout": {
                        "type": "string",
                        "enum": ["horizontal", "vertical"],
                        "description": "布局方向，默认 horizontal"
                    }
                },
                "required": ["metrics"]
            }
        },
        {
            "name": "render_mermaid_diagram",
            "description": "生成 Mermaid 流程图，接收节点和边的结构化数据，内部生成 Mermaid 代码并包装为 HTML。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "diagram_type": {
                        "type": "string",
                        "enum": ["flowchart", "sequencediagram", "statediagram"],
                        "description": "图表类型"
                    },
                    "nodes": {
                        "type": "array",
                        "description": "节点列表，每项需含 id (str) 和 label (str)"
                    },
                    "edges": {
                        "type": "array",
                        "description": "边列表，每项需含 from (str)、to (str)，可选 label (str)"
                    },
                    "title": {"type": "string", "description": "可选标题"}
                },
                "required": ["diagram_type", "nodes", "edges"]
            }
        },
        {
            "name": "render_ordered_list",
            "description": "生成有序或无序列表。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "列表项文本"
                    },
                    "title": {"type": "string", "description": "可选标题"},
                    "ordered": {
                        "type": "boolean",
                        "description": "True=有序（ol），False=无序（ul），默认 True"
                    }
                },
                "required": ["items"]
            }
        },
        {
            "name": "render_code_block",
            "description": "生成带语法高亮的代码块，适合展示源码。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "源代码文本"},
                    "language": {"type": "string", "description": "语言，如 python/javascript/bash"},
                    "title": {"type": "string", "description": "可选标题，如文件名"}
                },
                "required": ["code", "language"]
            }
        },
        {
            "name": "render_quote",
            "description": "生成引用块，适合展示结论性文字。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "引用文本"},
                    "source": {"type": "string", "description": "来源（如论文标题）"}
                },
                "required": ["text"]
            }
        },
        {
            "name": "render_alert",
            "description": "生成提示/警告框，适合展示注意事项或改进建议。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "提示内容"},
                    "alert_type": {
                        "type": "string",
                        "enum": ["info", "warning", "danger"],
                        "description": "提示类型"
                    }
                },
                "required": ["message"]
            }
        },
        {
            "name": "render_paragraph",
            "description": "生成带标题的段落文本，适合描述实验背景、方法、结论等。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "段落内容，支持多段落（用空行分隔）"},
                    "title": {"type": "string", "description": "可选标题"}
                },
                "required": ["text"]
            }
        },
        {
            "name": "assemble_html",
            "description": "【最后一步必须调用】将所有 HTML 片段组装为完整报告。title 必填，其余参数可传入之前各工具的输出片段。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "报告标题"},
                    "sections": {
                        "type": "array",
                        "description": "文字章节列表，每项含 type(content类型)/content(html或文本)/title(可选)"
                    },
                    "charts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "所有图表 HTML 片段（render_bar_chart / render_line_chart 的输出）"
                    },
                    "mermaid_diagrams": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "所有 Mermaid 图表 HTML 片段"
                    }
                },
                "required": ["title"]
            }
        },
    ]


# =============================================================================
# OpenAI-compatible 工具格式（DeepSeek 直接使用）
# =============================================================================

def _openai_tools():
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": {
                    "type": "object",
                    "properties": t["inputSchema"]["properties"],
                    "required": t["inputSchema"].get("required", [])
                }
            }
        }
        for t in _mcp_tools()
    ]


TOOL_MAP = {
    "render_table": render_table,
    "render_comparison_table": render_comparison_table,
    "render_bar_chart": render_bar_chart,
    "render_line_chart": render_line_chart,
    "render_pie_chart": render_pie_chart,
    "render_metrics_card": render_metrics_card,
    "render_mermaid_diagram": render_mermaid_diagram,
    "render_ordered_list": render_ordered_list,
    "render_code_block": render_code_block,
    "render_quote": render_quote,
    "render_alert": render_alert,
    "render_paragraph": render_paragraph,
    "assemble_html": assemble_html,
}


def retry_on_api_error(max_retries: int = 3, initial_delay: float = 1.0):
    """API 调用重试装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            delay = initial_delay
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except openai.APIError as e:
                    if attempt == max_retries - 1:
                        raise
                    error_str = str(e)
                    if "reasoning_content" in error_str:
                        print(f"[警告] reasoning_content 相关错误，重试中... (尝试 {attempt + 1}/{max_retries})")
                    else:
                        print(f"[警告] API 错误: {e}，重试中... (尝试 {attempt + 1}/{max_retries})")
                    time.sleep(delay)
                    delay *= 2
            return None
        return wrapper
    return decorator


SYSTEM_PROMPT = """你是一个专业的学术报告生成助手，负责为视觉大模型微调实验生成结构化、可视化的 HTML 报告。

## 工作方式
1. 分析上下文中的微调配置、实验数据、源码
2. 根据需要调用工具生成各类可视化 HTML 片段
3. 最后调用 assemble_html 把所有片段组装成完整报告
4. **禁止自己手写 HTML/JS/Mermaid 代码，禁止模板语法**

## 报告内容完整性要求
1. 每个章节必须有实质性文本描述，不允许只有标题没有内容
2. 优先使用 render_paragraph 生成文本描述，再调用图表工具
3. 实验配置章节必须包含：模型选择理由、数据集描述、训练策略说明
4. 实验结果章节必须包含：主要发现、性能分析、与基准对比结论
5. 调用 assemble_html 前，确保 sections 中包含至少 3 个 render_paragraph 生成的文本段落

## render_paragraph 使用规范
1. text 参数只包含纯文本内容，不要包含任何 HTML 标签
2. 不要在 text 中嵌套 <div>、<p>、<table> 等 HTML 元素
3. 如需生成表格、列表等，使用对应的 render_ 工具

## 报告应覆盖（根据上下文实际内容选择，不必全部覆盖）
- 实验配置（表格）
- 实验方法（流程图 + 步骤列表）
- 实验结果（折线图训练曲线 + 柱状图消融实验 + 指标卡片 + 对比表格）
- 源码分析（代码块 + 调用链流程图）
- 总结（引用块）

## 工具结果处理
工具执行后会返回 HTML 片段，请将所有 HTML 片段保留，最后调用 assemble_html 时全部传入。"""


class ReportAgent:
    """
    多模态报告生成 Agent
    MCP 协议风格工具定义 + OpenAI Function Calling + DeepSeek API
    """

    def __init__(self, temperature: float = 0.7):
        api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            print("错误：未找到环境变量 DEEPSEEK_API_KEY")
            print("请设置：$env:DEEPSEEK_API_KEY='your-api-key'  (PowerShell)")
            sys.exit(1)

        self.client = openai.OpenAI(
            base_url="https://api.deepseek.com/v1",
            api_key=api_key,
        )
        self.model = "deepseek-v4-pro"
        self.temperature = temperature
        self.openai_tools = _openai_tools()

    @retry_on_api_error(max_retries=3)
    def _call_api(self, messages: list) -> any:
        return self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=self.openai_tools,
            tool_choice="auto",
            temperature=self.temperature,
            extra_body={"thinking_disable": True},
        )

    def run(self, context: dict) -> str:
        context_str = json.dumps(context, ensure_ascii=False, indent=2)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"根据以下上下文生成 HTML 报告：\n{context_str}\n\n完成后调用 assemble_html 输出完整报告。"}
        ]

        chart_results = []
        mermaid_results = []
        sections = []

        for step in range(30):
            resp = self._call_api(messages)

            choice = resp.choices[0]

            if choice.finish_reason != "tool_calls":
                content = choice.message.content or ""
                if "<!DOCTYPE" in content or "<html" in content:
                    return content
                return content if content else "[错误：模型未返回有效内容]"

            tool_calls = choice.message.tool_calls

            messages.append({
                "role": "assistant",
                "content": choice.message.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in tool_calls
                ],
                "reasoning_content": getattr(choice.message, 'reasoning_content', None) or "",
            })

            for tc in tool_calls:
                fn = TOOL_MAP.get(tc.function.name)
                if fn is None:
                    result = f"[错误：未找到工具 '{tc.function.name}']"
                    is_error = True
                else:
                    try:
                        args = json.loads(tc.function.arguments) if isinstance(tc.function.arguments, str) else tc.function.arguments
                        result = fn(**args)
                        is_error = False
                    except Exception as e:
                        result = f"[参数错误: {e}]"
                        is_error = True

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })

                if tc.function.name in ("render_bar_chart", "render_line_chart", "render_pie_chart"):
                    chart_results.append(result)
                elif tc.function.name == "render_mermaid_diagram":
                    mermaid_results.append(result)
                elif tc.function.name in ("render_table", "render_comparison_table",
                                         "render_metrics_card", "render_ordered_list",
                                         "render_code_block", "render_quote", "render_alert",
                                         "render_paragraph"):
                    sections.append({"type": "html", "content": result})
                elif tc.function.name == "assemble_html":
                    try:
                        args = json.loads(tc.function.arguments) if isinstance(tc.function.arguments, str) else tc.function.arguments
                        final_sections = args.get("sections", []) or sections
                        html = assemble_html(
                            title=args.get("title", "实验报告"),
                            sections=final_sections,
                            charts=chart_results,
                            mermaid_diagrams=mermaid_results,
                        )
                        if not final_sections and not chart_results and not mermaid_results:
                            raise ValueError("No content accumulated yet")
                    except Exception:
                        if chart_results or mermaid_results or sections:
                            html = assemble_html(
                                title="实验报告",
                                sections=chart_results + mermaid_results + sections,
                                charts=[],
                                mermaid_diagrams=[],
                            )
                        else:
                            html = "[错误：报告内容为空]"
                    return html

        return "[错误：达到最大迭代次数]"


if __name__ == "__main__":
    context = {
        "model_name": "SAM_ViT_B",
        "img_size": 1024,
        "batch_size": 8,
        "epochs": 3,
        "learning_rate": 0.0001,
        "benchmark_metrics": {
            "models": ["SAM_ViT_B", "SAM_ViT_H", "MobileSAM"],
            "metrics": {"mIoU": [0.72, 0.78, 0.65], "FPS": [45, 28, 120]}
        },
        "learning_progress": {"best_mIoU": 0.72, "total_time": "2h 15m"}
    }

    agent = ReportAgent()
    html = agent.run(context)
    os.makedirs("output", exist_ok=True)
    out = "output/demo_test.html"
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"测试报告已生成: {out}")
