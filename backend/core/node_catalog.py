# backend/core/node_catalog.py
"""算子节点白名单（唯一事实来源，对齐 docs/API_SCHEMA_CONTRACT.md）。

Architect 生成配置时只能从这里挑选 type/name；
Evaluator 校验时用它判断节点是否合法；
Tutor 用它把算子 name 映射到源码文件。

难度分级：1 = ★ 入门必学 | 2 = ★★ 进阶应用 | 3 = ★★★ 高阶拓展
"""
from typing import Dict, List, Optional, Any

# type -> [算子元数据列表]
NODE_CATALOG: Dict[str, List[Dict[str, Any]]] = {
    "BACKBONE": [
        {"name": "ResNet50",         "difficulty": 1, "params": "25.5M",
         "paper": "He et al., CVPR 2016", "desc": "CNN经典残差网络"},
        {"name": "ViT_Base",         "difficulty": 1, "params": "86M",
         "paper": "Dosovitskiy et al., ICLR 2021", "desc": "基础版视觉Transformer"},
        {"name": "SAM_ViT_B",        "difficulty": 2, "params": "91M",
         "paper": "Kirillov et al., ICCV 2023", "desc": "SAM基础版(Base)视觉主干"},
        {"name": "MobileSAM",        "difficulty": 2, "params": "9.7M",
         "paper": "Zhang et al., 2023", "desc": "移动端优化版轻量级SAM底座"},
        {"name": "FastSAM",          "difficulty": 2, "params": "11M",
         "paper": "Zhao et al., 2023", "desc": "高速轻量化SAM底座"},
        {"name": "Swin_Transformer", "difficulty": 2, "params": "88M",
         "paper": "Liu et al., ICCV 2021", "desc": "移动窗口式视觉骨干网络"},
        {"name": "EfficientNetV2",   "difficulty": 2, "params": "24M",
         "paper": "Tan & Le, ICML 2021", "desc": "轻量高效视觉主干"},
        {"name": "SAM_ViT_H",        "difficulty": 3, "params": "636M",
         "paper": "Kirillov et al., ICCV 2023", "desc": "SAM强力版(Huge)视觉主干"},
        {"name": "DINO_v2",          "difficulty": 3, "params": "304M",
         "paper": "Oquab et al., 2023", "desc": "自监督视觉特征提取基座"},
    ],
    "ADAPTER": [
        {"name": "BitFit",           "difficulty": 1, "params": "<0.1M",
         "paper": "Zaken et al., ACL 2022", "desc": "仅偏置微调"},
        {"name": "LoRA_Sampler",     "difficulty": 2, "params": "0.3-3M",
         "paper": "Hu et al., ICLR 2022", "desc": "低秩自适应微调模块"},
        {"name": "Conv_Adapter",     "difficulty": 2, "params": "0.5-2M",
         "paper": "Houlsby et al., ICML 2019", "desc": "卷积形式参数高效微调层"},
        {"name": "IA3",              "difficulty": 2, "params": "0.01-0.1M",
         "paper": "Liu et al., NeurIPS 2022", "desc": "极致轻量化激活值缩放微调"},
        {"name": "AdapterFormer",    "difficulty": 3, "params": "2-8M",
         "paper": "Chen et al., ECCV 2022", "desc": "Transformer专用注意力适配器"},
    ],
    "NECK": [
        {"name": "Feature_Pyramid",  "difficulty": 1, "params": "~2M",
         "paper": "Lin et al., CVPR 2017", "desc": "经典FPN特征金字塔网络"},
        {"name": "BiFPN",            "difficulty": 2, "params": "~3M",
         "paper": "Tan et al., CVPR 2020", "desc": "加权双向特征金字塔"},
        {"name": "ASPP",             "difficulty": 2, "params": "~5M",
         "paper": "Chen et al., TPAMI 2018", "desc": "空洞空间金字塔池化"},
        {"name": "PPM",              "difficulty": 2, "params": "~2M",
         "paper": "Zhao et al., CVPR 2017", "desc": "金字塔池化模块"},
        {"name": "PAN",              "difficulty": 2, "params": "~3M",
         "paper": "Liu et al., CVPR 2018", "desc": "路径聚合网络"},
    ],
    "HEAD": [
        {"name": "Classification_Head", "difficulty": 1, "params": "~0.5M",
         "paper": "标准视觉分类头", "desc": "图像分类头"},
        {"name": "BBox_Predictor",  "difficulty": 1, "params": "~0.5M",
         "paper": "Faster R-CNN, Ren et al., NeurIPS 2015", "desc": "边界框预测基础头"},
        {"name": "Instance_Segmentor", "difficulty": 2, "params": "~2M",
         "paper": "Mask R-CNN, He et al., ICCV 2017", "desc": "实例分割任务专用预测头"},
        {"name": "Semantic_Segmentor", "difficulty": 2, "params": "~1.5M",
         "paper": "FCN, Long et al., CVPR 2015", "desc": "语义分割头（遥感/医学影像专用）"},
        {"name": "YOLO_Detect_Head", "difficulty": 2, "params": "~3M",
         "paper": "YOLOv8, Jocher et al., 2023", "desc": "工业界主流目标检测头"},
        {"name": "Anomaly_Detector", "difficulty": 2, "params": "~1M",
         "paper": "PaDiM, Defard et al., ICPR 2021", "desc": "工业缺陷/异常检测专用头"},
        {"name": "Keypoint_Detector", "difficulty": 2, "params": "~1.5M",
         "paper": "HRNet, Sun et al., CVPR 2019", "desc": "关键点检测头（农业/医学专用）"},
        {"name": "Mask_Decoder",     "difficulty": 2, "params": "~4M",
         "paper": "SAM, Kirillov et al., ICCV 2023", "desc": "SAM系列掩码解码器"},
    ],
    "PROCESSING": [
        {"name": "Resize",           "difficulty": 0, "params": "0",
         "paper": "标准预处理", "desc": "图像尺寸缩放"},
        {"name": "Normalize",        "difficulty": 0, "params": "0",
         "paper": "标准预处理", "desc": "图像归一化"},
        {"name": "Random_Flip",      "difficulty": 0, "params": "0",
         "paper": "标准数据增强", "desc": "图像翻转数据增强"},
        {"name": "NMS",              "difficulty": 0, "params": "0",
         "paper": "Neubeck & Van Gool, ICPR 2006", "desc": "非极大值抑制"},
    ],
}

# 扁平化：name → type，便于快速校验
NAME_TO_TYPE: Dict[str, str] = {
    item["name"]: node_type
    for node_type, items in NODE_CATALOG.items()
    for item in items
}

# name → difficulty 快速查询
NAME_TO_DIFFICULTY: Dict[str, int] = {
    item["name"]: item["difficulty"]
    for items in NODE_CATALOG.values()
    for item in items
}


def is_valid_node(node_type: str, name: str) -> bool:
    """校验 (type, name) 是否在白名单内。"""
    items = NODE_CATALOG.get(node_type, [])
    return any(item["name"] == name for item in items)


def get_difficulty(name: str) -> int:
    """获取指定算子的难度等级（0=无评级, 1=★入门, 2=★★进阶, 3=★★★高阶）。"""
    return NAME_TO_DIFFICULTY.get(name, 0)


def get_node_info(name: str) -> Optional[Dict[str, Any]]:
    """获取指定算子的完整元数据。"""
    for items in NODE_CATALOG.values():
        for item in items:
            if item["name"] == name:
                return item
    return None


def catalog_as_prompt() -> str:
    """把白名单渲染成给 LLM 的紧凑说明文本。"""
    lines = []
    for node_type, items in NODE_CATALOG.items():
        names = [it["name"] for it in items]
        lines.append(f"- {node_type}: {', '.join(names)}")
    return "\n".join(lines)


def catalog_as_prompt_with_difficulty() -> str:
    """把白名单渲染成带难度评级的 LLM prompt 片段。"""
    lines = []
    difficulty_map = {0: "", 1: "★入门", 2: "★★进阶", 3: "★★★高阶"}
    for node_type, items in NODE_CATALOG.items():
        entries = [
            f"{it['name']}({difficulty_map.get(it['difficulty'], '')})"
            for it in items
        ]
        lines.append(f"- {node_type}: {', '.join(entries)}")
    return "\n".join(lines)
