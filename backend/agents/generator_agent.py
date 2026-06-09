import json
import re
from typing import Dict, Any

from core.state import TaskState
from core.logger import logger
from core.config import settings
from core.exceptions import ReportGenerationError, AnimationGenerationError, LLMServiceError
from agents.base_agent import AgentBase
from services.external_services.llm_service import LLMService


class GeneratorAgent(AgentBase):
    def __init__(self):
        role_prompt = """你是一个专业的学术讲义排版引擎。
你的任务是：将用户的任务配置和专家的评估报告，整合为一份多模态的 HTML 学术讲义片段。

【排版强制要求】
1. 必须使用 <h3> 等 HTML 标签划分层级（不需要 <html><body> 等外层包裹，直接输出内容片段即可）。
2. 必须包含一段 Mermaid 架构图代码，用 <pre class="mermaid"> 包裹，展示用户配置的模型拓扑结构。
3. 将专家的评估报告转化为"改进建议"列表。

请直接输出 HTML 源码，不要包含任何 markdown 代码块标记（如 ```html）。"""
        super().__init__(name="Generator", role_prompt=role_prompt)
        # 使用已验证稳定的 Spark LLM 替代 deepseek（避免 deepseek-v4-pro 偶发连接错误）
        self._llm_provider = "spark"
        self._llm_model = settings.SPARK_MODEL_VERSION

    def _generate_report(self, state: TaskState) -> str:
        """从黑板读取数据，生成HTML实验报告"""
        logger.info(f"[{self.name}] 启动报告生成引擎...")

        sandbox_config = self.read_blackboard(state, "sandbox_config")
        evaluation = self.read_blackboard(state, "evaluation_results")
        evaluation_report = evaluation.get("report", "暂无评估报告") if evaluation else "暂无评估报告"

        config_dict = sandbox_config.model_dump() if sandbox_config else {}

        prompt = f"""请基于以下数据生成 HTML 实验报告：

【沙盒配置】：
{json.dumps(config_dict, ensure_ascii=False, indent=2)}

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

    def _generate_animation(self, state: TaskState) -> str:
        """从黑板读取用户意图，生成HTML动画"""
        logger.info(f"[{self.name}] 启动动画生成引擎...")

        user_intent = self.read_blackboard(state, "user_intent") or ""

        prompt = f"""请你生成一个动态动画，讲解以下概念：{user_intent}
要动态的，要像一个完整的、正在播放的视频。包含一个完整的过程，能把知识点讲清楚。
页面精美，有设计感。附带一些旁白式的文字解说。
不需要任何互动按钮，直接开始播放。
html+css+js+svg，放进一个html里，确保文件结构完整。"""

        try:
            result = LLMService.chat(
                messages=[{"role": "user", "content": prompt}],
                provider="spark",
                model=settings.SPARK_MODEL_VERSION,
                temperature=settings.ANIMATION_TEMPERATURE,
                max_tokens=settings.ANIMATION_MAX_TOKENS,
            )
            return self._extract_html(result)
        except LLMServiceError as e:
            raise AnimationGenerationError(f"动画生成失败: {e}") from e

    @staticmethod
    def _extract_html(text: str) -> str:
        """从LLM输出中提取HTML代码"""
        text = text.strip()
        code_block_pattern = r'```(?:html)?\s*\n(.*?)```'
        matches = re.findall(code_block_pattern, text, re.DOTALL)
        if matches:
            for match in reversed(matches):
                content = match.strip()
                if '<html' in content or '<!DOCTYPE' in content:
                    return content
            return matches[-1].strip()
        if '<!DOCTYPE' in text or '<html' in text:
            doctype_pos = text.find('<!DOCTYPE')
            html_pos = text.find('<html')
            start_pos = min(pos for pos in [doctype_pos, html_pos] if pos != -1)
            return text[start_pos:].strip()
        return text

    def run(self, state: TaskState) -> Dict[str, Any]:
        logger.info(f"[{self.name}] 启动多模态生成引擎...")

        intent = self.read_blackboard(state, "intent") or "mixed_generation"
        result = {"current_step": "completed", "history": []}

        if intent in ("report_generation", "mixed_generation"):
            report_html = self._generate_report(state)
            result["final_report_html"] = report_html
            result["history"].append(f"[{self.name}] 报告生成完毕")

        if intent in ("animation_generation", "mixed_generation"):
            animation_html = self._generate_animation(state)
            result["animation_html"] = animation_html
            result["history"].append(f"[{self.name}] 动画生成完毕")

        if not result["history"]:
            result["history"].append(f"[{self.name}] 无生成任务执行")

        return result
