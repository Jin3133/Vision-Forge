import os
import sys
from pathlib import Path
from typing import Dict, Any, List
from core.state import TaskState
from core.logger import logger
from agents.base_agent import AgentBase


# ==================== 算子 → 源码文件映射 ====================
# key: node_catalog 中的算子 name（或其前缀/关键词）
# value: assets/code_mirror/ 下对应的源码文件名
# 当新增源码资产时，只需在此字典中追加一条映射即可
NODE_TO_SOURCE: Dict[str, str] = {
    # BACKBONE
    "SAM_ViT_H": "SAM_ViT.py",
    "SAM_ViT_B": "SAM_ViT.py",
    "MobileSAM": "MobileSAM.py",
    "FastSAM": "FastSAM.py",
    "DINO_v2": "DINO_v2.py",
    "Swin_Transformer": "Swin_Transformer.py",
    "ViT_Base": "ViT_Base.py",
    "ResNet50": "ResNet50.py",
    "EfficientNetV2": "EfficientNetV2.py",
    # ADAPTER
    "LoRA_Sampler": "LoRA.py",
    "Conv_Adapter": "Conv_Adapter.py",
    "IA3": "IA3.py",
    "AdapterFormer": "AdapterFormer.py",
    "BitFit": "BitFit.py",
    # NECK
    "Feature_Pyramid": "FPN.py",
    "BiFPN": "BiFPN.py",
    "ASPP": "ASPP.py",
    "PPM": "PPM.py",
    "PAN": "PAN.py",
    # HEAD
    "Classification_Head": "Classification_Head.py",
    "Instance_Segmentor": "Instance_Segmentor.py",
    "Semantic_Segmentor": "Semantic_Segmentor.py",
    "YOLO_Detect_Head": "YOLO_Detect_Head.py",
    "BBox_Predictor": "BBox_Predictor.py",
    "Anomaly_Detector": "Anomaly_Detector.py",
    "Keypoint_Detector": "Keypoint_Detector.py",
    "Mask_Decoder": "Mask_Decoder.py",
    # PROCESSING
    "Resize": "Resize.py",
    "Normalize": "Normalize.py",
    "Random_Flip": "Random_Flip.py",
    "NMS": "NMS.py",
    # 兼容旧配置 / 别名
    "SE_Block": "SE_Block.py",
}

# 默认兜底文件（当所有映射都找不到时）
_FALLBACK_SOURCE = "SE_Block.py"


class TutorAgent(AgentBase):
    def __init__(self):
        # 💡 核心提示词：强调"因材施教"和"真实源码"
        role_prompt = """你是一个严谨且富有启发性的视觉算法底层源码助教。
你的核心任务是：结合真实的系统源码，向学生解释算法底层的运行机制。

【核心原则】
1. 坚决捍卫高密度源码的完整性，不要用"伪代码"糊弄学生。直接引用源码中的核心行。
2. 根据学生的认知风格（Cognitive Style）调整解释深度：
   - 如果是"图表直观应用"风格，请多用生活化比喻，重点讲输入输出特征图的变化。
   - 如果是"代码底层探索"风格，请硬核一点，重点讲张量拼接(concat)、注意力权重的具体维度计算。
3. 输出必须是清晰的 Markdown 格式。

【输出格式强制约束】
- 严禁使用 '***' 或 '---' 作为段落分隔线
- 使用 '##' 或 '###' 标题划分章节，使用空行分隔段落
- 代码块使用标准 ```python 围栏
- 重点用 **加粗** 标注，禁止使用 *** 三重星号
- 使用编号列表（1. 2. 3.）组织要点"""
        super().__init__(name="Tutor", role_prompt=role_prompt)

    def _resolve_source_files(self, state: TaskState) -> List[str]:
        """根据 sandbox_config 中的 nodes 动态确定要讲解的源码文件列表。

        策略：
        1. 遍历 sandbox_config.nodes，对每个算子 name 查 NODE_TO_SOURCE 映射
        2. 检查映射到的文件是否真实存在于 assets/code_mirror/ 下
        3. 去重并按出现顺序返回（最多取前 3 个，避免一次塞太多源码）
        4. 若全部未命中或不存在，返回空列表（由 run() 降级为纯 LLM 知识讲解）
        """
        sandbox_config = self.read_blackboard(state, "sandbox_config")
        resolved: List[str] = []
        seen = set()

        current_dir = Path(__file__).resolve().parent
        if getattr(sys, 'frozen', False):
            code_dir = Path(sys._MEIPASS) / "assets" / "code_mirror"
        else:
            code_dir = current_dir.parent / "assets" / "code_mirror"

        # 从 nodes 列表中解析，只保留真实存在的文件
        nodes = getattr(sandbox_config, "nodes", []) or []
        for node in nodes:
            node_name = getattr(node, "name", "") if hasattr(node, "name") else node.get("name", "")
            if node_name in NODE_TO_SOURCE:
                fname = NODE_TO_SOURCE[node_name]
                if fname not in seen:
                    # 检查文件是否真实存在
                    file_path = code_dir / fname
                    if file_path.exists():
                        resolved.append(fname)
                        seen.add(fname)
                    else:
                        logger.info(f"[{self.name}] 源码文件缺失，跳过: {fname}")

        # 如果 nodes 中没命中，尝试 suggested_backbone
        if not resolved:
            backbone = getattr(sandbox_config, "suggested_backbone", "")
            if backbone and backbone in NODE_TO_SOURCE:
                fname = NODE_TO_SOURCE[backbone]
                file_path = code_dir / fname
                if file_path.exists():
                    resolved.append(fname)

        # 不再是强制兜底 SE_Block——缺失时由 run() 降级处理
        return resolved[:3]

    def _read_source_code(self, filename: str) -> str:
        """工具函数：从本地物理资产库读取真实源码"""
        try:
            current_dir = Path(__file__).resolve().parent
            file_path = current_dir.parent / "assets" / "code_mirror" / filename
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            logger.warning(f"[{self.name}] 源码文件不存在: {filename}")
            return ""

    def run(self, state: TaskState) -> Dict[str, Any]:
        logger.info(f"[{self.name}] 启动源码教研引擎...")

        # 1. 从黑板读取上一棒 (Architect) 留下的学习画像
        profile = self.read_blackboard(state, "learner_profile") or {}
        cognitive_style = profile.get("cognitive_style", "标准模式")

        # 2. 收集需要讲解的算子名称（即使源码缺失也能用 LLM 知识讲）
        sandbox_config = self.read_blackboard(state, "sandbox_config")
        nodes = getattr(sandbox_config, "nodes", []) or []
        node_names = [
            getattr(n, "name", "") if hasattr(n, "name") else n.get("name", "")
            for n in nodes
        ]
        node_names = [n for n in node_names if n]  # 过滤空名

        # 3. 动态解析真实存在的源码文件
        target_files = self._resolve_source_files(state)
        logger.info(f"[{self.name}] 真实源码文件: {target_files} | 请求算子: {node_names}")

        # 4. 读取源码并拼接
        code_sections = []
        for fname in target_files:
            code = self._read_source_code(fname)
            if code:
                code_sections.append(f"# ===== 文件: {fname} =====\n{code}")

        # 5. 根据源码是否存在，选择不同的讲解策略
        if code_sections:
            # === 策略 A: 有真实源码 → 结合源码深度讲解 ===
            combined_source = "\n\n".join(code_sections)
            file_list_str = "、".join(target_files)
            prompt = f"""
当前学生的认知风格偏好为：【{cognitive_style}】。
学生想了解以下算子：{', '.join(node_names) if node_names else '视觉模型架构'}。

以下是核心算子的真实源码（涉及文件：{file_list_str}）：
```python
{combined_source}
```

请用启发式的口吻，结合源码中的中文注释，为该学生详细拆解这些代码的核心执行流程。
如果涉及多个文件，请分模块讲解并说明它们之间的协作关系。
"""
            history_msg = f"[{self.name}] 结合真实源码讲解: {file_list_str}"
        else:
            # === 策略 B: 源码缺失 → 用 LLM 训练知识直接讲解（不再兜底 SE_Block） ===
            operator_desc = ', '.join(node_names) if node_names else "视觉模型架构"
            backbone = getattr(sandbox_config, "suggested_backbone", "")
            task_type = getattr(sandbox_config, "task_type", "图像分割")

            prompt = f"""
当前学生的认知风格偏好为：【{cognitive_style}】。
学生想了解的算子：{operator_desc}（用于 {task_type} 任务{f'，推荐主干网络: {backbone}' if backbone else ''}）。

⚠️ 注意：这些算子的源码文件暂未纳入本地资产库，请基于你的训练知识进行详细讲解。

【讲解要求】
1. 对每个算子，阐述其核心原理、设计动机和适用场景
2. 说明算子之间的协作关系和数据流动方式
3. 结合 {task_type} 领域的最佳实践，给出搭配建议
4. 根据学生的认知风格（{cognitive_style}）调整讲解深度和语言风格
   - "图表直观应用" → 多用生活化比喻、强调输入输出变化
   - "代码底层探索" → 偏重维度计算、矩阵操作、底层实现细节
"""
            history_msg = f"[{self.name}] 基于 LLM 知识讲解: {operator_desc}（源码缺失，降级为知识讲解）"
            logger.warning(f"[{self.name}] 所有算子源码均缺失，降级为 LLM 知识讲解模式")

        # 6. 调用大模型
        response_text = self.call_llm(user_input=prompt, temperature=0.5)

        # 7. 返回增量数据
        return {
            "evaluation_results": {
                "tutor_response": response_text
            },
            "current_step": "evaluator_stage",
            "history": [
                history_msg,
                f"[{self.name}] 源码教研讲解生成完毕（认知风格: {cognitive_style}）"
            ]
        }


# ================= 单元测试 =================
if __name__ == "__main__":
    from core.state import TaskState, SandboxConfig, NodeModel

    # 测试动态源码定位：传入包含 SE_Block 的 nodes
    mock_state = TaskState(
        session_id="test_session_002",
        user_intent="我想看看注意力机制是怎么工作的",
        learner_profile={
            "cognitive_style": "代码底层探索，喜欢看矩阵维度计算"
        },
        sandbox_config=SandboxConfig(
            task_type="目标检测",
            suggested_backbone="ResNet50",
            nodes=[
                NodeModel(id="n1", type="BACKBONE", name="ResNet50"),
                NodeModel(id="n2", type="NECK", name="Feature_Pyramid"),
            ]
        ),
        current_step="tutor_stage"
    )

    print("--- 源码教研智能体 测试开始 ---")
    tutor = TutorAgent()

    # 先测试文件解析逻辑
    files = tutor._resolve_source_files(mock_state)
    print(f"动态解析到文件: {files}")

    delta_updates = tutor.run(mock_state)
    print("\n--- 助教讲解输出 ---")
    print(delta_updates.get("evaluation_results", {}).get("tutor_response", "无输出"))
