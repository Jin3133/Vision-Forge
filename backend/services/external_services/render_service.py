"""
RenderService — Tool-First 多模态讲义渲染引擎

提供原子化渲染工具，将结构化数据转为可视化资产：
- render_mermaid(): 将 sandbox_config 转为 Mermaid 拓扑图
- render_ablation_chart(): 消融实验对比柱状图 (matplotlib)
- compose_html(): 使用模板拼装最终 HTML 讲义

设计原则 (Tool-First):
  数据 → 工具渲染 → 资产 → 拼装 → 最终讲义
  避免让 LLM 生成图表代码，所有可视化由确定性工具产出。
"""

import json
import base64
import io
from pathlib import Path
from typing import Dict, Any, List, Optional
from core.logger import logger


class RenderService:
    """多模态讲义渲染引擎。"""

    # ==================== Mermaid 拓扑图 ====================

    @staticmethod
    def render_mermaid(sandbox_config) -> str:
        """将 sandbox_config 转为 Mermaid 流程图语法字符串。"""
        if hasattr(sandbox_config, "model_dump"):
            config = sandbox_config.model_dump()
        else:
            config = sandbox_config

        nodes = config.get("nodes", [])
        edges = config.get("edges", [])

        if not nodes:
            return "graph TD\n    A[输入图像] --> B[待配置]"

        lines = ["graph TD"]
        lines.append(f'    A["📷 输入图像"] --> Start["模型推理"]')

        for node in nodes:
            nid = node.get("id", "n?")
            ntype = node.get("type", "")
            nname = node.get("name", nid)
            lines.append(f'    {nid}["{ntype}\\n{nname}"]')
            lines.append(f"    style {nid} fill:#f0f4ff,stroke:#3b82f6,stroke-width:2px")

        if edges:
            for edge in edges:
                src = edge.get("source", "")
                tgt = edge.get("target", "")
                lines.append(f"    {src} --> {tgt}")
        else:
            for i in range(len(nodes) - 1):
                lines.append(f"    {nodes[i].get('id','')} --> {nodes[i+1].get('id','')}")

        return "\n".join(lines)

    # ==================== 消融对比图表 ====================

    @staticmethod
    def render_ablation_chart(benchmark_data: Dict[str, Any]) -> str:
        """基于消融实验数据渲染对比柱状图，返回 base64 PNG data URI。"""
        try:
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt

            ablations = benchmark_data.get("ablations", [])
            if not ablations:
                return ""

            variants = [a.get("variant", "")[:15] for a in ablations]
            metrics = benchmark_data.get("metrics", {})
            metric_name = list(metrics.keys())[0] if metrics else "score"
            values = []
            for a in ablations:
                base_val = next(iter(metrics.values()), 0) if metrics else 0
                val = a.get(metric_name, base_val + a.get("delta", 0))
                values.append(val)

            fig, ax = plt.subplots(figsize=(8, 4))
            colors = ['#4caf50' if v >= values[0] else '#ff9800' if v >= values[0]*0.9 else '#f44336'
                      for v in values]
            bars = ax.bar(range(len(variants)), values, color=colors, edgecolor='white', linewidth=1.5)

            for bar, val in zip(bars, values):
                ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
                        f'{val:.3f}', ha='center', va='bottom', fontsize=9, fontweight='bold')

            ax.set_xticks(range(len(variants)))
            ax.set_xticklabels(variants, rotation=15, ha='right', fontsize=8)
            ax.set_ylabel(metric_name, fontsize=11)
            ax.set_title(f'消融实验对比 ({benchmark_data.get("id", "")})', fontsize=12, fontweight='bold')
            ax.grid(axis='y', alpha=0.3)
            ax.set_ylim(bottom=min(values)*0.85, top=max(values)*1.08)

            plt.tight_layout()
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            plt.close()
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            return f"data:image/png;base64,{img_base64}"

        except ImportError:
            logger.warning("[RenderService] matplotlib 未安装，跳过图表渲染")
            return ""
        except Exception as e:
            logger.error(f"[RenderService] 图表渲染失败: {e}")
            return ""

    # ==================== HTML 拼装 ====================

    @staticmethod
    def compose_html(
        title: str,
        mermaid_diagram: str,
        ablation_chart_b64: str = "",
        evaluation_text: str = "",
        sections: List[Dict[str, str]] = None,
    ) -> str:
        """使用模板拼装最终 HTML 讲义。"""
        chart_html = ""
        if ablation_chart_b64:
            chart_html = f"""
            <div style="text-align:center;margin:20px 0;">
                <h4>📊 消融实验对比</h4>
                <img src="{ablation_chart_b64}" alt="消融对比图" style="max-width:100%;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.1);"/>
            </div>"""

        sections_html = ""
        if sections:
            for sec in sections:
                sections_html += f"<h4>{sec.get('heading', '')}</h4>\n{sec.get('body', '')}\n"

        evaluation_html = ""
        if evaluation_text:
            evaluation_html = f"""
            <div style="background:#fff3e0;padding:16px;border-radius:8px;margin:16px 0;">
                <h3>📋 专家评估意见</h3>
                <div style="font-size:14px;line-height:1.8;">{evaluation_text}</div>
            </div>"""

        html = f"""<div style="font-family:'Microsoft YaHei','PingFang SC',sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#333;">
<h2>{title}</h2>

<h3>🔧 模型拓扑架构</h3>
<pre class="mermaid" style="background:#f8f9fa;padding:16px;border-radius:8px;overflow-x:auto;">
{mermaid_diagram}
</pre>

{chart_html}

{evaluation_html}

{sections_html}

<hr style="margin:30px 0;border:none;border-top:1px solid #e0e0e0;"/>
<p style="font-size:11px;color:#999;text-align:center;">📚 由 Vision-Forge Tool-First 多模态讲义引擎自动生成</p>
</div>"""
        return html


render_service = RenderService()
