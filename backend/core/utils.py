# backend/core/utils.py
"""LLM 输出解析工具集 — 四级兜底 JSON 提取器。"""
import json
import re
from typing import Any, Dict


def _strip_code_fence(text: str) -> str:
    """去掉 ```json ... ``` 或 ``` ... ``` 代码围栏。"""
    cleaned = re.sub(r"```[a-zA-Z]*\s*", "", text)
    cleaned = cleaned.replace("```", "")
    return cleaned.strip()


def _light_fix(text: str) -> str:
    """第 3 级：对常见的 LLM JSON 瑕疵做轻量修复（缺失逗号、尾逗号）。"""
    # 对象/数组元素间缺失逗号
    text = re.sub(r"\}\s*\{", "}, {", text)
    text = re.sub(r"\]\s*\[", "], [", text)
    # 属性字符串间缺失逗号: "a" "b" -> "a", "b"
    text = re.sub(r'"\s+"', '", "', text)
    # 去掉对象/数组的尾随逗号: ,} -> }   ,] -> ]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return text


def _deep_fix(text: str) -> str:
    """第 4 级：激进修复 — 应对更严重的 LLM 格式错误。

    涵盖场景：
    - 单引号代替双引号
    - 无引号的 key（JavaScript 对象风格）
    - 行尾/行内注释 (// ... 或 /* ... */)
    - 布尔值/空值的非标准写法 (True/False/None -> true/false/null)
    - value 后缺逗号（下一行直接是新 key）
    """
    # 1. 去掉行注释 // ...（注意不要误伤 URL 中的 //）
    text = re.sub(r'(?<!:)//[^\n]*', '', text)
    # 2. 去掉块注释 /* ... */
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)

    # 3. 单引号 → 双引号（简单替换，足以应对大多数情况）
    text = text.replace("'", '"')

    # 4. 无引号的 key 加上双引号: { key: "value" } -> { "key": "value" }
    #    匹配模式：行首/逗号/花括号后面跟着 标识符:
    text = re.sub(
        r'(?<=[{,\n])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:',
        r' "\1":',
        text
    )

    # 5. Python 风格布尔/空值 → JSON 标准
    text = re.sub(r'\bTrue\b', 'true', text)
    text = re.sub(r'\bFalse\b', 'false', text)
    text = re.sub(r'\bNone\b', 'null', text)

    # 6. value 后缺逗号：一行末尾是 "..." 或 数字 或 } 或 ]，下一行开头是 "
    #    示例:  "name": "SAM"\n  "type": "BACKBONE"  ->  加逗号
    text = re.sub(
        r'(["}\]\d])\s*\n(\s*")',
        r'\1,\n\2',
        text
    )

    # 7. 最后再做一次尾逗号清理（前面的补逗号可能多补）
    text = re.sub(r",\s*([}\]])", r"\1", text)

    return text


def extract_json_from_llm(raw_text: str) -> Dict[str, Any]:
    """从大模型返回的杂乱文本中稳健地提取 JSON 对象。

    四级兜底策略：
    1. 去围栏后直接 json.loads（json_mode 下通常一次成功）
    2. 抽取第一个 { 到最后一个 } 的子串再解析（贪婪匹配，支持嵌套）
    3. 对子串做轻量修复（补逗号/去尾逗号）后再解析
    4. 激进修复（单引号/无引号key/注释/Python布尔/缺逗号）后再解析

    全部失败返回 {}，由调用方决定如何降级。
    """
    if not raw_text or not isinstance(raw_text, str):
        return {}

    cleaned = _strip_code_fence(raw_text)

    # 第 1 级：直接解析
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 第 2 级：贪婪抽取最外层对象（注意用贪婪 .* 以支持嵌套结构）
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        print(f"⚠️ 未能在模型输出中定位 JSON 对象。原始输出前 200 字: {raw_text[:200]}")
        return {}
    candidate = match.group(0)

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # 第 3 级：轻量修复后再解析
    try:
        return json.loads(_light_fix(candidate))
    except json.JSONDecodeError:
        pass

    # 第 4 级：激进修复后再解析
    try:
        deep_fixed = _deep_fix(candidate)
        return json.loads(deep_fixed)
    except json.JSONDecodeError:
        pass

    # 第 4.5 级：同时应用 light + deep（顺序不同可能修复不同问题）
    try:
        return json.loads(_light_fix(_deep_fix(candidate)))
    except json.JSONDecodeError as e:
        print(f"❌ JSON 四级兜底解析仍失败: {e} | 片段: {candidate[:200]}")
        return {}
