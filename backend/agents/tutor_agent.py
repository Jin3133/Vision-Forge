import os
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
3. 输出必须是清晰的 Markdown 格式。"""
        super().__init__(name="Tutor", role_prompt=role_prompt)

    def _resolve_source_files(self, state: TaskState) -> List[str]:
        """根据 sandbox_config 中的 nodes 动态确定要讲解的源码文件列表。

        策略：
        1. 遍历 sandbox_config.nodes，对每个算子 name 查 NODE_TO_SOURCE 映射
        2. 去重并按出现顺序返回（最多取前 3 个，避免一次塞太多源码）
        3. 若全部未命中，回退到 suggested_backbone 或默认兜底文件
        """
        sandbox_config = self.read_blackboard(state, "sandbox_config")
        resolved: List[str] = []
        seen = set()

        # 从 nodes 列表中解析
        nodes = getattr(sandbox_config, "nodes", []) or []
        for node in nodes:
            node_name = getattr(node, "name", "") if hasattr(node, "name") else node.get("name", "")
            if node_name in NODE_TO_SOURCE:
                fname = NODE_TO_SOURCE[node_name]
                if fname not in seen:
                    resolved.append(fname)
                    seen.add(fname)

        # 如果 nodes 中没命中，尝试 suggested_backbone
        if not resolved:
            backbone = getattr(sandbox_config, "suggested_backbone", "")
            if backbone and backbone in NODE_TO_SOURCE:
                resolved.append(NODE_TO_SOURCE[backbone])

        # 最终兜底
        if not resolved:
            resolved.append(_FALLBACK_SOURCE)

        # 限制最多 3 个文件，控制上下文长度
        return resolved[:3]

    def _read_source_code(self, filename: str) -> str:
        """工具函数：从本地物理资产库读取真实源码"""
        try:
            current_dir = Path(__file__).resolve().parent
            file_path = current_dir.parent / "assets" / "code_mirror" / filename

            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            logger.warning(f"[{self.name}] 源码文件不存在: {filename}，尝试兜底")
            # 尝试兜底读取默认文件
            if filename != _FALLBACK_SOURCE:
                return self._read_source_code(_FALLBACK_SOURCE)
            return ""

    def run(self, state: TaskState) -> Dict[str, Any]:
        logger.info(f"[{self.name}] 启动源码教研引擎...")

        # 1. 从黑板读取上一棒 (Architect) 留下的学习画像
        profile = self.read_blackboard(state, "learner_profile") or {}
        cognitive_style = profile.get("cognitive_style", "标准模式")

        # 2. 动态解析需要讲解的源码文件
        target_files = self._resolve_source_files(state)
        logger.info(f"[{self.name}] 动态定位到源码文件: {target_files}")

        # 3. 读取所有源码并拼接
        code_sections = []
        for fname in target_files:
            code = self._read_source_code(fname)
            if code:
                code_sections.append(f"# ===== 文件: {fname} =====\n{code}")

        if not code_sections:
            return {
                "current_step": "error_stage",
                "history": [f"[{self.name}] 所有源码文件均读取失败，已中断流程"]
            }

        combined_source = "\n\n".join(code_sections)

        # 4. 组装"强力 Prompt" (将源码和学习画像一起喂给大模型)
        file_list_str = "、".join(target_files)
        prompt = f"""
当前学生的认知风格偏好为：【{cognitive_style}】。

以下是我们要讲解的核心算子真实源码（涉及文件：{file_list_str}）：
```python
{combined_source}
```

请用启发式的口吻，结合源码中的中文注释，为该学生详细拆解这些代码的核心执行流程。
如果涉及多个文件，请分模块讲解并说明它们之间的协作关系。
"""

        # 5. 调用星火大脑 (适度提高 temperature 让讲解更生动)
        response_text = self.call_llm(user_input=prompt, temperature=0.5)

        # 6. 返回增量数据，写回全局黑板
        return {
            "evaluation_results": {
                "tutor_response": response_text
            },
            "current_step": "evaluator_stage",
            "history": [
                f"[{self.name}] 动态定位并讲解源码: {file_list_str}",
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
