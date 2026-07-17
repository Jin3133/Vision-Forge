"""
三分类意图识别器：
- "chat"    — 纯概念问答（什么是CNN？ResNet多少层？）→ ChatAgent
- "explore" — 场景描述/问题探索（我想识别烂桃子）→ Architect 苏格拉底引导
- "build"   — 明确搭建请求（帮我搭模型/去工坊）→ Architect + 完整四智能体流水线

核心理念：架构引导智能体处理所有非纯概念的交互，
只有明确的概念问答才走 ChatAgent 快捷通道。
"""

# 纯概念问答关键词（触发 ChatAgent 快捷通道）
CHAT_KEYWORDS = [
    "什么是", "是什么", "解释", "原理", "为什么",
    "如何工作", "怎么工作", "区别", "对比",
    "多少层", "多少参数", "论文", "作者",
    "定义", "概念", "介绍一下",
]

# 明确搭建请求 → 触发完整流水线（用户已理解任务，准备好动手）
BUILD_KEYWORDS = [
    "设计架构", "搭建模型", "帮我设计", "搭模型",
    "沙盒", "模型架构", "配置节点", "架构设计",
    "搭一个模型", "帮我搭", "连一个模型",
    "添加节点", "添加模块", "修改架构", "调整架构",
    "去工坊", "开始搭建", "开始设计",
]

BUILD_PREFIXES = [
    "我想搭", "我要搭", "帮我搭", "帮我设计",
    "我想设计", "我要设计", "搭建模型",
    "做一个模型", "画一个模型",
    "开始搭建", "去搭模型", "去工坊",
]


def classify_intent(user_input: str) -> str:
    """三分类：chat / explore / build。

    - 包含纯概念问答关键词 → "chat"
    - 包含明确搭建请求关键词 → "build"
    - 其余（场景描述、问题探索等）→ "explore" → 交给 Architect 苏格拉底引导
    """
    if not user_input or not user_input.strip():
        return "chat"

    text = user_input.strip()
    lower = text.lower()

    # 1. 先检查是否是明确搭建请求（最高优先级）
    for prefix in BUILD_PREFIXES:
        if text.startswith(prefix):
            return "build"
    for kw in BUILD_KEYWORDS:
        if kw in lower:
            return "build"

    # 2. 再检查是否是纯概念问答
    for kw in CHAT_KEYWORDS:
        if kw in lower:
            return "chat"

    # 3. 其余全部交给 Architect 做场景探索
    #    （"我想识别烂桃子"、"玉米病斑怎么检测"、"我想做一个XX" 都走这里）
    return "explore"
