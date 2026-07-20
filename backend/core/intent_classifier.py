"""
三分类意图识别器 — 增强版：
- "chat"    — 纯概念问答 / 闲聊 / 解释原理 → ChatAgent
- "explore" — 场景描述 / 问题探索 → Architect 苏格拉底引导
- "build"   — 明确搭建请求 → Architect + 完整流水线

核心原则：宁可误判为 chat（安全降级）也不误判为 build（过度干预）。
"""

# 纯对话/概念问答关键词（触发 ChatAgent）
CHAT_KEYWORDS = [
    "什么是", "是什么", "解释", "原理", "为什么",
    "如何工作", "怎么工作", "区别", "对比",
    "多少层", "多少参数", "论文", "作者",
    "定义", "概念", "介绍一下", "介绍",
    "讲讲", "讲一下", "说说", "说一下",
    "怎样", "怎么办", "怎么做",
    "能不能", "可以吗",
    "帮我理解", "帮我分析",
]

# 明确闲聊信号 → 绝对不走流水线
CASUAL_MARKERS = [
    "你好", "谢谢", "再见", "不客气",
    "你是谁", "你能做什么", "你会什么",
    "hello", "hi", "hey",
    "天气", "今天", "晚安", "早安",
]

# 明确搭建请求（最高优先级，触发完整流水线）
BUILD_KEYWORDS = [
    "设计架构", "搭建模型", "帮我设计", "搭模型",
    "沙盒", "模型架构", "配置节点", "架构设计",
    "搭一个模型", "帮我搭", "连一个模型",
    "添加节点", "添加模块", "修改架构", "调整架构",
    "去工坊", "开始搭建", "开始设计",
]

# 场景描述 / 问题探索 → "explore" → Architect 引导
# 包含农业/医学/遥感/自动驾驶等应用场景描述
EXPLORE_MARKERS = [
    "检测", "识别", "分割", "分类",
    "遥感", "医学", "农业", "病害",
    "自动驾驶", "工业", "缺陷",
    "我想做", "我要做", "能不能做",
    "模型选", "选什么", "推荐",
]


def classify_intent(user_input: str) -> str:
    """三分类：chat / explore / build。

    优先级：
    1. build_keywords / build_prefixes → "build"（明确搭建请求）
    2. casual / chat_keywords → "chat"（纯对话）
    3. explore_markers → "explore"（场景探索 → Architect）
    4. 默认 → "chat"（宁可走对话也不乱启动流水线）
    """
    if not user_input or not user_input.strip():
        return "chat"

    text = user_input.strip()
    lower = text.lower()

    # 1. 明确搭建请求 → 最高优先级
    build_prefixes = [
        "我想搭", "我要搭", "帮我搭", "帮我设计",
        "我想设计", "我要设计", "搭建模型",
        "做一个模型", "画一个模型", "连一个模型",
        "开始搭建", "去搭模型", "去工坊",
    ]
    for prefix in build_prefixes:
        if text.startswith(prefix):
            return "build"
    for kw in BUILD_KEYWORDS:
        if kw in lower:
            return "build"

    # 2. 明确闲聊 → 绝对不走流水线
    for kw in CASUAL_MARKERS:
        if kw in lower:
            return "chat"

    # 3. 纯概念问答 → ChatAgent
    for kw in CHAT_KEYWORDS:
        if kw in lower:
            return "chat"

    # 4. 场景探索 → Architect 引导
    for kw in EXPLORE_MARKERS:
        if kw in lower:
            return "explore"

    # 5. 短输入（<15 字）→ 默认聊天
    if len(text) < 15:
        return "chat"

    # 6. 包含问号 → 提问 → 聊天
    if "?" in text or "？" in text:
        return "chat"

    # 7. 其余未知意图 → 默认聊天（不启动流水线）
    return "chat"
