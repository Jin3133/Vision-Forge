"""
Vision-Forge 多模态报告生成工具库
====================================

预定义可视化组件 CSS 样式 + Python Tool 函数
用于 LangChain Agent 的 ReAct 工具调用

使用方法:
    from render_tools import (
        render_table,
        render_comparison_table,
        render_bar_chart,
        render_mermaid_diagram,
        render_metrics_card,
        render_ordered_list,
        render_code_block,
        assemble_html
    )
"""

from typing import Any
import json
import re


VF_CSS_PRESET = """
:root {
    --vf-primary: #4a90d9;
    --vf-secondary: #16213e;
    --vf-accent: #667eea;
    --vf-bg: #ffffff;
    --vf-bg-alt: #fafafa;
    --vf-text: #1a1a2e;
    --vf-text-muted: #6c757d;
    --vf-border: #e9ecef;
    --vf-success: #28a745;
    --vf-warning: #ffc107;
    --vf-danger: #dc3545;
}

.vf-report {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: var(--vf-text);
    background: var(--vf-bg);
    line-height: 1.6;
}

.vf-section {
    margin-bottom: 2.5rem;
    padding: 1.5rem;
    background: var(--vf-bg);
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.vf-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--vf-secondary);
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 3px solid var(--vf-primary);
}

.vf-subtitle {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--vf-secondary);
    margin: 1.5rem 0 0.75rem;
}

.vf-text p {
    margin-bottom: 1rem;
    text-align: justify;
}

/* 表格样式 */
.vf-table-wrapper {
    overflow-x: auto;
    margin: 1rem 0;
    border-radius: 8px;
    border: 1px solid var(--vf-border);
}

.vf-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
}

.vf-table th {
    background: linear-gradient(135deg, var(--vf-primary) 0%, var(--vf-accent) 100%);
    color: white;
    padding: 0.875rem 1rem;
    text-align: left;
    font-weight: 600;
}

.vf-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--vf-border);
}

.vf-table tr:last-child td {
    border-bottom: none;
}

.vf-table tr:hover td {
    background: var(--vf-bg-alt);
}

.vf-table .highlight-best {
    background: rgba(40, 167, 69, 0.1);
    font-weight: 600;
    color: var(--vf-success);
}

/* 图表容器 */
.vf-chart-container {
    background: var(--vf-bg);
    border-radius: 12px;
    padding: 1.5rem;
    margin: 1rem 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.vf-chart-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--vf-secondary);
    margin-bottom: 1rem;
    text-align: center;
}

.vf-chart-canvas {
    max-width: 100%;
    height: auto;
}

/* 指标卡片 */
.vf-metrics-grid {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin: 1rem 0;
}

.vf-metric-card {
    flex: 1;
    min-width: 140px;
    background: linear-gradient(135deg, var(--vf-primary) 0%, var(--vf-accent) 100%);
    color: white;
    padding: 1.25rem;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(74, 144, 217, 0.3);
}

.vf-metric-card.secondary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.vf-metric-label {
    font-size: 0.85rem;
    opacity: 0.9;
    margin-bottom: 0.5rem;
}

.vf-metric-value {
    font-size: 1.75rem;
    font-weight: 700;
}

.vf-metric-trend {
    font-size: 0.75rem;
    margin-top: 0.25rem;
}

.vf-metric-trend.up::before { content: "▲ "; }
.vf-metric-trend.down::before { content: "▼ "; }
.vf-metric-trend.neutral::before { content: "● "; }

/* Mermaid 流程图容器 */
.vf-mermaid-container {
    background: var(--vf-bg-alt);
    padding: 1.5rem;
    border-radius: 12px;
    margin: 1rem 0;
    text-align: center;
    border: 1px solid var(--vf-border);
    overflow-x: auto;
}

.vf-mermaid-container pre.mermaid {
    display: inline-block;
    text-align: left;
    max-width: 100%;
}

.vf-mermaid-container svg {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto;
}

/* 布局系统 */
.vf-layout-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    margin: 1rem 0;
}

.vf-layout-grid.single-col {
    grid-template-columns: 1fr;
}

.vf-layout-item {
    min-width: 0;
}

/* 内联图表样式 */
.vf-chart-inline,
.vf-mermaid-inline {
    margin: 1.5rem 0;
}

.vf-chart-inline .vf-chart-container,
.vf-mermaid-inline .vf-mermaid-container {
    margin: 0;
}

/* 响应式布局 */
@media (max-width: 768px) {
    .vf-layout-grid {
        grid-template-columns: 1fr;
    }
}

/* 有序列表 */
.vf-list {
    margin: 1rem 0;
    padding-left: 1.5rem;
}

.vf-list li {
    margin-bottom: 0.75rem;
    padding-left: 0.5rem;
    position: relative;
}

.vf-list li::marker {
    color: var(--vf-primary);
    font-weight: 600;
}

/* 代码块 */
.vf-code-block {
    background: #1e1e1e;
    border-radius: 8px;
    margin: 1rem 0;
    overflow: hidden;
}

.vf-code-header {
    background: #2d2d2d;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    color: #9e9e9e;
    border-bottom: 1px solid #3d3d3d;
}

.vf-code-block pre {
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
}

.vf-code-block code {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    color: #d4d4d4;
}

/* 代码高亮 - Python */
.language-python .keyword { color: #569cd6; }
.language-python .string { color: #ce9178; }
.language-python .number { color: #b5cea8; }
.language-python .comment { color: #6a9955; }
.language-python .function { color: #dcdcaa; }
.language-python .class { color: #4ec9b0; }

/* 引用块 */
.vf-quote {
    border-left: 4px solid var(--vf-primary);
    padding: 1rem 1.5rem;
    margin: 1rem 0;
    background: var(--vf-bg-alt);
    border-radius: 0 8px 8px 0;
    font-style: italic;
}

/* 警告框 */
.vf-alert {
    padding: 1rem 1.25rem;
    border-radius: 8px;
    margin: 1rem 0;
}

.vf-alert.info {
    background: rgba(74, 144, 217, 0.1);
    border: 1px solid var(--vf-primary);
    color: var(--vf-primary);
}

.vf-alert.warning {
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid var(--vf-warning);
    color: #856404;
}

.vf-alert.danger {
    background: rgba(220, 53, 69, 0.1);
    border: 1px solid var(--vf-danger);
    color: var(--vf-danger);
}

/* 分割线 */
.vf-divider {
    border: none;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--vf-border), transparent);
    margin: 2rem 0;
}
"""


def render_table(headers: list, rows: list) -> str:
    """
    生成 HTML 表格

    Args:
        headers: 表头列表 ["模型", "mIoU", "FPS"]
        rows: 数据行 [[SAM_ViT_B, 0.72, 45], [SAM_ViT_H, 0.78, 28]]

    Returns:
        HTML 字符串: <div class="vf-table-wrapper"><table class="vf-table">...</table></div>
    """
    header_html = "".join(f"<th>{h}</th>" for h in headers)
    rows_html = ""
    for row in rows:
        cells = "".join(f"<td>{cell}</td>" for cell in row)
        rows_html += f"<tr>{cells}</tr>"

    return f"""
<div class="vf-table-wrapper">
    <table class="vf-table">
        <thead><tr>{header_html}</tr></thead>
        <tbody>{rows_html}</tbody>
    </table>
</div>
"""


def render_comparison_table(data: dict) -> str:
    """
    生成带颜色标注的对比表格（高亮最佳值）

    Args:
        data: {
            "models": ["SAM_ViT_B", "SAM_ViT_H", "MobileSAM"],
            "metrics": {
                "mIoU": [0.72, 0.78, 0.65],
                "FPS": [45, 28, 120]
            }
        }

    Returns:
        HTML 字符串: <div class="vf-table-wrapper"><table class="vf-table vf-comparison">...</table></div>
    """
    models = data.get("models", [])
    metrics = data.get("metrics", {})

    headers = ["指标"] + models
    header_html = "".join(f"<th>{h}</th>" for h in headers)

    rows_html = ""
    for metric_name, values in metrics.items():
        if not values:
            continue
        best_idx = values.index(max(values))
        cells = ""
        for i, v in enumerate(values):
            cls = "highlight-best" if i == best_idx else ""
            cells += f'<td class="{cls}">{v}</td>'
        rows_html += f"<tr><td><strong>{metric_name}</strong></td>{cells}</tr>"

    return f"""
<div class="vf-table-wrapper">
    <table class="vf-table vf-comparison">
        <thead><tr>{header_html}</tr></thead>
        <tbody>{rows_html}</tbody>
    </table>
</div>
<div class="vf-alert info">
    <strong>图例：</strong><span class="highlight-best">绿色高亮</span> 表示该指标最优值
</div>
"""


def render_bar_chart(
    labels: list,
    datasets: list,
    title: str = "",
    xlabel: str = "",
    ylabel: str = "",
    chart_id: str = None
) -> str:
    """
    生成柱状图 HTML

    Args:
        labels: x 轴标签 ["Epoch 1", "Epoch 2", "Epoch 3"]
        datasets: [{"label": "mIoU", "data": [0.65, 0.70, 0.72], "color": "#4a90d9"}]
        title: 图表标题
        xlabel: x 轴名称
        ylabel: y 轴名称
        chart_id: 可选，指定 canvas ID

    Returns:
        HTML 字符串（包含 <canvas> 和 Chart.js 初始化代码）
    """
    import uuid
    cid = chart_id or f"chart_{uuid.uuid4().hex[:8]}"

    chartjs_config = {
        "type": "bar",
        "data": {
            "labels": labels,
            "datasets": [
                {
                    "label": d.get("label", "Dataset"),
                    "data": d.get("data", []),
                    "backgroundColor": d.get("color", "#4a90d9"),
                    "borderRadius": 4
                }
                for d in datasets
            ]
        },
        "options": {
            "responsive": True,
            "plugins": {
                "legend": {"position": "top"},
                "title": {"display": bool(title), "text": title}
            },
            "scales": {
                "y": {"beginAtZero": False, "title": {"display": bool(ylabel), "text": ylabel}},
                "x": {"title": {"display": bool(xlabel), "text": xlabel}}
            }
        }
    }

    return f"""
<div class="vf-chart-container">
    {f'<div class="vf-chart-title">{title}</div>' if title else ''}
    <canvas id="{cid}" class="vf-chart-canvas"></canvas>
</div>
<script>
(function() {{
    new Chart(document.getElementById("{cid}").getContext('2d'), {json.dumps(chartjs_config, ensure_ascii=False)});
}})();
</script>
"""


def render_line_chart(
    labels: list,
    datasets: list,
    title: str = "",
    xlabel: str = "",
    ylabel: str = "",
    chart_id: str = None
) -> str:
    """
    生成折线图 HTML

    Args:
        labels: x 轴标签
        datasets: [{"label": "mIoU", "data": [0.65, 0.70, 0.72], "color": "#4a90d9"}]
        title: 图表标题
        xlabel: x 轴名称
        ylabel: y 轴名称
        chart_id: 可选，指定 canvas ID

    Returns:
        HTML 字符串
    """
    import uuid
    cid = chart_id or f"line_{uuid.uuid4().hex[:8]}"

    chartjs_config = {
        "type": "line",
        "data": {
            "labels": labels,
            "datasets": [
                {
                    "label": d.get("label", "Dataset"),
                    "data": d.get("data", []),
                    "borderColor": d.get("color", "#4a90d9"),
                    "backgroundColor": d.get("color", "#4a90d9") + "33",
                    "fill": True,
                    "tension": 0.3
                }
                for d in datasets
            ]
        },
        "options": {
            "responsive": True,
            "plugins": {
                "legend": {"position": "top"},
                "title": {"display": bool(title), "text": title}
            },
            "scales": {
                "y": {"beginAtZero": False, "title": {"display": bool(ylabel), "text": ylabel}},
                "x": {"title": {"display": bool(xlabel), "text": xlabel}}
            }
        }
    }

    return f"""
<div class="vf-chart-container">
    {f'<div class="vf-chart-title">{title}</div>' if title else ''}
    <canvas id="{cid}" class="vf-chart-canvas"></canvas>
</div>
<script>
(function() {{
    new Chart(document.getElementById("{cid}").getContext('2d'), {json.dumps(chartjs_config, ensure_ascii=False)});
}})();
</script>
"""


def render_pie_chart(
    labels: list,
    data: list,
    title: str = "",
    colors: list = None,
    chart_id: str = None
) -> str:
    """
    生成饼图 HTML

    Args:
        labels: 标签列表 ["类别A", "类别B", "类别C"]
        data: 数据列表 [30, 45, 25]（百分比或绝对值）
        title: 图表标题
        colors: 可选颜色列表，默认使用预设调色板
        chart_id: 可选，指定 canvas ID

    Returns:
        HTML 字符串（包含 <canvas> 和 Chart.js 初始化代码）
    """
    import uuid
    cid = chart_id or f"pie_{uuid.uuid4().hex[:8]}"

    default_colors = ["#4a90d9", "#667eea", "#f5365c", "#fb6340", "#ffd600", "#2dce89", "#11cdef", "#8f9cc2"]
    color_list = colors or default_colors

    chartjs_config = {
        "type": "pie",
        "data": {
            "labels": labels,
            "datasets": [{
                "data": data,
                "backgroundColor": color_list[:len(data)],
                "borderWidth": 2,
                "borderColor": "#ffffff"
            }]
        },
        "options": {
            "responsive": True,
            "plugins": {
                "legend": {"position": "bottom"},
                "title": {"display": bool(title), "text": title}
            }
        }
    }

    return f"""
<div class="vf-chart-container">
    {f'<div class="vf-chart-title">{title}</div>' if title else ''}
    <canvas id="{cid}" class="vf-chart-canvas"></canvas>
</div>
<script>
(function() {{
    new Chart(document.getElementById("{cid}").getContext('2d'), {json.dumps(chartjs_config, ensure_ascii=False)});
}})();
</script>
"""


def render_metrics_card(metrics: list, layout: str = "horizontal") -> str:
    """
    生成关键指标展示卡片

    Args:
        metrics: [
            {"label": "最终 mIoU", "value": "0.72", "trend": "up", "color": "primary"},
            {"label": "训练时间", "value": "2h 15m", "trend": "neutral", "color": "secondary"}
        ]
        layout: "horizontal" | "vertical"

    Returns:
        HTML 字符串: <div class="vf-metrics-grid">...</div>
    """
    cards_html = ""
    for m in metrics:
        color_cls = "secondary" if m.get("color") == "secondary" else ""
        trend = m.get("trend", "neutral")
        cards_html += f"""
        <div class="vf-metric-card {color_cls}">
            <div class="vf-metric-label">{m.get('label', '')}</div>
            <div class="vf-metric-value">{m.get('value', '')}</div>
            {f'<div class="vf-metric-trend {trend}">{m.get("trend_note", "")}</div>' if trend != "neutral" else ''}
        </div>"""

    return f'<div class="vf-metrics-grid">{cards_html}</div>'


def validate_mermaid_syntax(mermaid_code: str) -> tuple:
    """
    验证 Mermaid 代码语法（基础验证）

    Returns:
        (is_valid, error_message)
    """
    if not mermaid_code:
        return False, "Mermaid 代码为空"

    valid_types = ["flowchart", "sequenceDiagram", "stateDiagram", "classDiagram", "erDiagram", "gantt", "pie"]
    lines = mermaid_code.strip().split("\n")
    first_line = lines[0].strip()

    # 跳过 %%{init} 配置行
    if first_line.startswith("%%{"):
        for line in lines[1:]:
            stripped = line.strip()
            if stripped:
                first_line = stripped
                break

    if not any(t in first_line for t in valid_types):
        return False, f"未知的图表类型: {first_line}"

    lines = mermaid_code.strip().split("\n")
    if len(lines) < 2:
        return False, "Mermaid 代码不完整（缺少节点或连接定义）"

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        if line.startswith("-->") or line.startswith("-->"):
            return False, f"第 {i+1} 行：连接符开头不完整（缺少源节点）"
        if "-->|" in line and line.endswith("|-->"):
            return False, f"第 {i+1} 行：连接符格式错误"
        if "->>:" in line and line.strip().endswith("->>:"):
            return False, f"第 {i+1} 行：sequenceDiagram 消息不完整"

    if "sequenceDiagram" in first_line:
        has_participant = any("participant" in line for line in lines)
        has_message = any("-->" in line or "->>" in line for line in lines)
        if has_message and not has_participant:
            return False, "sequenceDiagram 缺少 participant 声明"

    return True, ""


def render_mermaid_diagram(
    diagram_type: str,
    nodes: list,
    edges: list,
    title: str = ""
) -> str:
    """
    生成 Mermaid 图表（结构化数据 → Mermaid 代码 → HTML）

    Args:
        diagram_type: "flowchart" | "sequencediagram" | "statediagram"
        nodes: [{"id": "A", "label": "数据加载"}, {"id": "B", "label": "特征提取"}]
        edges: [{"from": "A", "to": "B", "label": "Tensor"}]
        title: 可选标题

    Returns:
        HTML 字符串: <div class="vf-mermaid-container"><pre class="mermaid">...</pre></div>
    """
    if diagram_type == "flowchart":
        node_defs = ""
        for i, n in enumerate(nodes):
            label = n.get("label", n["id"]).replace("\n", " ")
            node_defs += f'\n    {n["id"]}["{label}"]'
        edge_defs = ""
        for e in edges:
            label = e.get("label", "").replace("\n", " ")
            if label:
                edge_defs += f'\n    {e["from"]} -->|"{label}"| {e["to"]}'
            else:
                edge_defs += f'\n    {e["from"]} --> {e["to"]}'

        class_defs = """\n    classDef inputClass fill:#0ea5e9,stroke:#38bdf8,stroke-width:2px,color:#fff
    classDef processClass fill:#f59e0b,stroke:#fbbf24,stroke-width:2px,color:#fff
    classDef outputClass fill:#10b981,stroke:#34d399,stroke-width:2px,color:#fff
    classDef defaultClass fill:#1e293b,stroke:#475569,stroke-width:2px,color:#e2e8f0"""

        class_assigns = ""
        for i, n in enumerate(nodes):
            if i == 0:
                class_assigns += f'\n    class {n["id"]} inputClass'
            elif i == len(nodes) - 1:
                class_assigns += f'\n    class {n["id"]} outputClass'
            else:
                class_assigns += f'\n    class {n["id"]} processClass'

        init_config = "%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#1e293b', 'primaryTextColor': '#e2e8f0', 'primaryBorderColor': '#475569', 'lineColor': '#94a3b8', 'secondaryColor': '#334155', 'tertiaryColor': '#0f172a' }}}%%"
        mermaid_code = init_config + "\nflowchart TD" + node_defs + edge_defs + class_defs + class_assigns

    elif diagram_type == "sequencediagram":
        participants = "".join(f'\n    participant {n["id"]}' for n in nodes)
        interactions = "".join(
            f'\n    {e["from"]}->>{e["to"]}: {e.get("label", "")}'
            for e in edges
        )
        mermaid_code = f"sequenceDiagram{participants}{interactions}"

    elif diagram_type == "statediagram":
        states = "".join(f'\n    [*] --> {nodes[0]["id"]}' if i == 0 else f'\n    {nodes[i-1]["id"]} --> {n["id"]}' for i, n in enumerate(nodes))
        transitions = "".join(f'\n    {e["from"]} --> {e["to"]}: {e.get("label", "")}' for e in edges)
        mermaid_code = f"stateDiagram-v2{states}{transitions}"

    else:
        mermaid_code = f"flowchart TD\n    A[Unknown type]"

    is_valid, error_msg = validate_mermaid_syntax(mermaid_code)
    if not is_valid:
        return f"""
<div class="vf-mermaid-container" style="border: 2px solid #dc3545;">
    <div class="vf-alert danger">
        <strong>Mermaid 语法错误</strong>: {error_msg}<br>
        <small>生成的代码: <code>{mermaid_code[:100]}...</code></small>
    </div>
</div>
"""

    return f"""
<div class="vf-mermaid-container">
    {f'<div class="vf-chart-title">{title}</div>' if title else ''}
    <pre class="mermaid">{mermaid_code}</pre>
</div>
"""


def render_ordered_list(items: list, title: str = "", ordered: bool = True) -> str:
    """
    生成有序/无序列表 HTML

    Args:
        items: ["步骤1内容", "步骤2内容", "步骤3内容"]
        title: 可选列表标题
        ordered: True 为有序列表，False 为无序列表

    Returns:
        HTML 字符串
    """
    tag = "ol" if ordered else "ul"
    list_items = "".join(f"<li>{item}</li>" for item in items)
    title_html = f'<div class="vf-subtitle">{title}</div>' if title else ''
    return f"{title_html}<{tag} class=\"vf-list\">{list_items}</{tag}>"


def render_paragraph(text: str, title: str = "") -> str:
    title_html = f'<div class="vf-subtitle">{title}</div>' if title else ''
    clean_text = re.sub(r'<[^>]+>', '', text)
    paragraphs = clean_text.split("\n\n")
    content = "".join(f"<p>{p.strip()}</p>" for p in paragraphs if p.strip())
    return f'{title_html}<div class="vf-text">{content}</div>'


def render_code_block(code: str, language: str = "python", title: str = "") -> str:
    """
    生成带语法高亮的代码块

    Args:
        code: 源码字符串
        language: "python" | "javascript" | "bash" | "json"
        title: 可选代码块标题（如文件名）

    Returns:
        HTML 字符串: <div class="vf-code-block">...</div>
    """
    import html
    escaped_code = html.escape(code)
    title_html = f'<div class="vf-code-header">{title}</div>' if title else ''
    return f"""
<div class="vf-code-block">
    {title_html}
    <pre><code class="language-{language}">{escaped_code}</code></pre>
</div>
"""


def render_quote(text: str, source: str = "") -> str:
    """
    生成引用块

    Args:
        text: 引用文本
        source: 来源（如论文标题、作者）

    Returns:
        HTML 字符串
    """
    source_html = f'<cite>—— {source}</cite>' if source else ''
    return f'<div class="vf-quote">{text}{source_html}</div>'


def render_alert(message: str, alert_type: str = "info") -> str:
    """
    生成警告/提示框

    Args:
        message: 提示内容
        alert_type: "info" | "warning" | "danger"

    Returns:
        HTML 字符串
    """
    return f'<div class="vf-alert {alert_type}">{message}</div>'


def assemble_html(
    title: str,
    sections: list = None,
    charts: list = None,
    mermaid_diagrams: list = None,
    extra_css: str = "",
    extra_js: str = "",
    html_content: str = None,
) -> str:
    """
    将所有组件组装为完整 HTML 报告

    Args:
        title: 报告标题
        sections: [{"type": "text"|"html", "content": "...", "title": "可选标题"}, ...]
        charts: 图表 HTML 片段列表
        mermaid_diagrams: Mermaid 图表 HTML 片段列表
        extra_css: 额外 CSS
        extra_js: 额外 JS
        html_content: 直接传入一段 HTML 内容作为报告主体（兜底兼容）

    Returns:
        完整 HTML 字符串
    """
    charts = charts or []
    mermaid_diagrams = mermaid_diagrams or []
    sections = sections or []

    # 构建内容块列表，保持交错顺序
    content_blocks = []
    chart_idx = 0
    mermaid_idx = 0

    for s in sections:
        content_type = s.get("type", "text")
        content = s.get("content", "")
        section_title = s.get("title", "")

        block_html = ""
        if section_title:
            block_html += f'<div class="vf-subtitle">{section_title}</div>'

        if content_type == "html":
            block_html += content
        else:
            paragraphs = content.split("\n\n")
            text_content = "".join(f"<p>{p.strip()}</p>" for p in paragraphs if p.strip())
            block_html += f'<div class="vf-text">{text_content}</div>'

        content_blocks.append(block_html)

        # 根据 section 标题关键词，智能插入对应的图表
        title_lower = (section_title or "").lower()
        if chart_idx < len(charts):
            if any(k in title_lower for k in ["训练", "曲线", "损失", "消融", "对比", "结果", "性能"]):
                content_blocks.append(f'<div class="vf-chart-inline">{charts[chart_idx]}</div>')
                chart_idx += 1
        if mermaid_idx < len(mermaid_diagrams):
            if any(k in title_lower for k in ["流程", "架构", "调用", "方法", "步骤", "模块"]):
                content_blocks.append(f'<div class="vf-mermaid-inline">{mermaid_diagrams[mermaid_idx]}</div>')
                mermaid_idx += 1

    # 追加剩余的图表
    while chart_idx < len(charts):
        content_blocks.append(f'<div class="vf-chart-inline">{charts[chart_idx]}</div>')
        chart_idx += 1
    while mermaid_idx < len(mermaid_diagrams):
        content_blocks.append(f'<div class="vf-mermaid-inline">{mermaid_diagrams[mermaid_idx]}</div>')
        mermaid_idx += 1

    # 将内容块分组为 section（每 2-3 个块一个 section）
    sections_html = ""
    current_section = ""
    block_count = 0

    for block in content_blocks:
        current_section += block
        block_count += 1
        # 遇到图表或满3个块就结束当前 section
        if "vf-chart-inline" in block or "vf-mermaid-inline" in block or block_count >= 3:
            sections_html += f'<div class="vf-section">{current_section}</div>'
            current_section = ""
            block_count = 0

    if current_section:
        sections_html += f'<div class="vf-section">{current_section}</div>'

    if html_content and not sections_html:
        sections_html = f'<div class="vf-section">{html_content}</div>'

    mermaid_js = """
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.5/dist/mermaid.min.js"></script>
<script>
    mermaid.initialize({
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
        sequenceDiagram: { useMaxWidth: true },
        onError: function(error) {
            console.error('Mermaid 渲染错误:', error);
            var container = document.querySelector('.vf-mermaid-container');
            if (container) {
                container.style.border = '2px solid #dc3545';
                container.innerHTML = '<div style="padding: 1rem; color: #dc3545;"><strong>Mermaid 图表渲染失败</strong><br><small style="color: #666;">' + error.str + '</small><pre style="background: #f8f8f8; padding: 0.5rem; margin-top: 0.5rem; overflow: auto;">' + error.str + '</pre></div>';
            }
        }
    });
</script>
"""

    chartjs_js = """<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>"""

    font_link = ''
    hljs_css = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">'
    hljs_js = '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>'
    init_js = '<script>document.addEventListener("DOMContentLoaded", function() { if (typeof hljs !== \'undefined\') hljs.highlightAll(); });</script>'

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    {font_link}
    {hljs_css}
    {chartjs_js}
    <style>
{VF_CSS_PRESET}
{extra_css}
    </style>
</head>
<body>
    <div class="vf-report">
        <div class="vf-section">
            <h1 class="vf-title">{title}</h1>
        </div>

        {sections_html}
    </div>

    {mermaid_js}
    {hljs_js}
    {init_js}
    {extra_js}
</body>
</html>
"""


def create_context(
    model_name: str = "",
    img_size: int = 0,
    batch_size: int = 0,
    epochs: int = 0,
    learning_rate: float = 0,
    benchmark_metrics: dict = None,
    operator_mappings: dict = None,
    learning_progress: dict = None
) -> dict:
    """
    创建报告生成的上下文数据

    这是一个辅助函数，用于构造符合 Report Agent 输入格式的上下文字典

    Args:
        model_name: 模型名称
        img_size: 输入图像尺寸
        batch_size: 批大小
        epochs: 训练轮数
        learning_rate: 学习率
        benchmark_metrics: 基准测试指标 {"mIoU": [...], "FPS": [...]}
        operator_mappings: 算子映射关系
        learning_progress: 学习进度

    Returns:
        上下文字典
    """
    return {
        "model_name": model_name,
        "img_size": img_size,
        "batch_size": batch_size,
        "epochs": epochs,
        "learning_rate": learning_rate,
        "benchmark_metrics": benchmark_metrics or {},
        "operator_mappings": operator_mappings or {},
        "learning_progress": learning_progress or {}
    }
