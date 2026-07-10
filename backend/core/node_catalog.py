# backend/core/node_catalog.py
"""算子节点白名单（唯一事实来源，对齐 docs/API_SCHEMA_CONTRACT.md）。

Architect 生成配置时只能从这里挑选 type/name；
Evaluator 校验时用它判断节点是否合法；
Tutor 用它把算子 name 映射到源码文件。
"""
from typing import Dict, List

# type -> [算子 name 列表]
NODE_CATALOG: Dict[str, List[str]] = {
    "BACKBONE": [
        "SAM_ViT_H", "SAM_ViT_B", "MobileSAM", "FastSAM", "DINO_v2",
        "Swin_Transformer", "ViT_Base", "ResNet50", "EfficientNetV2",
    ],
    "ADAPTER": ["LoRA_Sampler", "Conv_Adapter", "IA3", "AdapterFormer", "BitFit"],
    "NECK": ["Feature_Pyramid", "BiFPN", "ASPP", "PPM", "PAN"],
    "HEAD": [
        "Classification_Head", "Instance_Segmentor", "Semantic_Segmentor",
        "YOLO_Detect_Head", "BBox_Predictor", "Anomaly_Detector",
        "Keypoint_Detector", "Mask_Decoder",
    ],
    "PROCESSING": ["Resize", "Normalize", "Random_Flip", "NMS"],
}

# 扁平化：name -> type，便于快速校验
NAME_TO_TYPE: Dict[str, str] = {
    name: node_type for node_type, names in NODE_CATALOG.items() for name in names
}


def is_valid_node(node_type: str, name: str) -> bool:
    """校验 (type, name) 是否在白名单内。"""
    return name in NODE_CATALOG.get(node_type, [])


def catalog_as_prompt() -> str:
    """把白名单渲染成给 LLM 的紧凑说明文本。"""
    lines = []
    for node_type, names in NODE_CATALOG.items():
        lines.append(f"- {node_type}: {', '.join(names)}")
    return "\n".join(lines)
