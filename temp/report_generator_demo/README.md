# Vision-Forge 多模态报告生成系统

基于 DeepSeek API 的实验报告自动生成工具，支持表格、图表、Mermaid 流程图等可视化组件。

## 快速开始

```bash
# 设置 API Key
$env:DEEPSEEK_API_KEY = "your-api-key"

# 运行报告生成
python run.py
```

## 文件结构

| 文件 | 说明 |
|------|------|
| `run.py` | 一键运行脚本，包含演示上下文数据 |
| `agent.py` | ReportAgent 核心实现，支持 Function Calling |
| `render_tools.py` | 可视化组件库（表格、图表、流程图等） |
| `requirements.txt` | 依赖：`openai>=1.0.0` |

## 核心功能

### 工具类型

| 工具 | 用途 |
|------|------|
| `render_table` | HTML 表格 |
| `render_comparison_table` | 对比表格（自动高亮最优值） |
| `render_bar_chart` | Chart.js 柱状图 |
| `render_line_chart` | Chart.js 折线图 |
| `render_pie_chart` | Chart.js 饼图 |
| `render_metrics_card` | 指标卡片 |
| `render_mermaid_diagram` | Mermaid 流程图 |
| `render_code_block` | 语法高亮代码块 |
| `render_paragraph` | 文本段落 |
| `assemble_html` | 组装完整报告 |

### 使用示例

```python
from agent import ReportAgent

context = {
    "model_name": "SAM_ViT_B",
    "epochs": 50,
    "benchmark_metrics": {
        "models": ["SAM_ViT_B", "SAM_ViT_H"],
        "metrics": {"mIoU": [0.72, 0.78], "FPS": [45, 28]}
    }
}

agent = ReportAgent()
html = agent.run(context)

with open("output/report.html", "w", encoding="utf-8") as f:
    f.write(html)
```

## 依赖

- Python 3.8+
- `openai>=1.0.0`
- `DEEPSEEK_API_KEY` 环境变量

## 查看报告

报告输出到 `output/report_*.html`，建议通过 HTTP 服务查看：

```bash
python -m http.server 8000
# 访问 http://localhost:8000/output/
```
