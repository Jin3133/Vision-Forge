# backend/core/utils.py
import json
import re


def extract_json_from_llm(raw_text: str) -> dict:
    """
    通用工具：从大模型返回的杂乱文本中安全提取 JSON 对象。
    非常适合用于 EvaluatorAgent 或 ArchitectAgent 的结构化输出解析。
    """
    try:
        # 正则匹配第一个 { 和最后一个 } 之间的所有内容
        match = re.search(r'(\{.*?\})', raw_text, re.DOTALL)
        if not match:
            print(f"⚠️ 警告: 未能在模型输出中找到 JSON。原始输出: {raw_text}")
            return {}

        json_str = match.group(1)
        parsed_data = json.loads(json_str)
        return parsed_data
    except Exception as e:
        print(f"❌ JSON 提取解析失败: {e}")
        return {}