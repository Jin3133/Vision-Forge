import re

from core.config import settings
from core.exceptions import AnimationGenerationError, LLMServiceError
from services.external_services.llm_service import LLMService

ANIMATION_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "generate_animation",
        "description": "根据用户意图生成HTML动画演示",
        "parameters": {
            "type": "object",
            "properties": {
                "user_intent": {
                    "type": "string",
                    "description": "用户意图或概念描述",
                }
            },
            "required": ["user_intent"],
        },
    },
}


def generate_animation(user_intent: str) -> str:
    """根据用户意图生成HTML动画演示"""
    # 参数验证
    if not isinstance(user_intent, str) or not user_intent.strip():
        raise ValueError("user_intent 必须是非空 str")

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
        return _extract_html(result)
    except LLMServiceError as e:
        raise AnimationGenerationError(f"动画生成失败: {e}") from e


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
