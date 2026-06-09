import json

from core.config import settings
from core.exceptions import ReportGenerationError, LLMServiceError
from services.external_services.llm_service import LLMService

REPORT_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "generate_report",
        "description": "根据沙盒配置和评估报告生成HTML实验报告",
        "parameters": {
            "type": "object",
            "properties": {
                "sandbox_config": {
                    "type": "object",
                    "description": "沙盒模型配置，包含task_type、nodes、edges等",
                },
                "evaluation_report": {
                    "type": "string",
                    "description": "专家评估报告内容",
                },
            },
            "required": ["sandbox_config", "evaluation_report"],
        },
    },
}


def generate_report(sandbox_config: dict, evaluation_report: str) -> str:
    """根据沙盒配置和评估报告生成HTML实验报告"""
    # 参数验证
    if not isinstance(sandbox_config, dict) or not sandbox_config:
        raise ValueError("sandbox_config 必须是非空 dict")
    if not isinstance(evaluation_report, str) or not evaluation_report.strip():
        raise ValueError("evaluation_report 必须是非空 str")

    prompt = f"""请基于以下数据生成 HTML 实验报告：

【沙盒配置】：
{json.dumps(sandbox_config, ensure_ascii=False, indent=2)}

【专家评估意见】：
{evaluation_report}

要求：生成结构化的HTML报告，包含实验配置、评估结果和改进建议。"""

    try:
        result = LLMService.chat(
            messages=[{"role": "user", "content": prompt}],
            provider="spark",
            model=settings.SPARK_MODEL_VERSION,
            temperature=settings.REPORT_TEMPERATURE,
        )
        return result
    except LLMServiceError as e:
        raise ReportGenerationError(f"报告生成失败: {e}") from e
