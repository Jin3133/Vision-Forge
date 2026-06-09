"""
模型量化配置模块
支持 INT8、FP16 等量化方法
"""

from pathlib import Path
from typing import Dict, Any, Optional
import torch

# 量化配置
QUANTIZATION_CONFIG = {
    "enabled": True,                    # 是否启用量化
    "method": "fp16",                   # 量化方法: int8, int4, fp16, bf16
    "preserve_quality": True,           # 优先保证音质
    "calibration_samples": 10,          # 校准样本数（INT8需要）
    "dynamic_quantization": True,       # 是否使用动态量化
    
    # 量化保存路径
    "quantized_model_path": None,       # 量化模型保存路径（None表示不保存）
    
    # 性能对比配置
    "save_comparison_audio": True,      # 是否保存对比音频
    "comparison_audio_dir": "output/quantized_audio",  # 对比音频保存目录
}

# 不同量化方法的配置
QUANTIZATION_METHODS = {
    "int8": {
        "description": "INT8 动态量化",
        "expected_speedup": 1.5,        # 预期加速比
        "expected_memory_reduction": 0.5,  # 预期显存减少比例
        "quality_impact": "medium",     # 音质影响: low, medium, high
        "torch_dtype": torch.qint8,
        "requires_calibration": True,
    },
    "fp16": {
        "description": "FP16 半精度",
        "expected_speedup": 1.3,
        "expected_memory_reduction": 0.5,
        "quality_impact": "low",
        "torch_dtype": torch.float16,
        "requires_calibration": False,
    },
    "bf16": {
        "description": "BF16 脑浮点",
        "expected_speedup": 1.2,
        "expected_memory_reduction": 0.5,
        "quality_impact": "low",
        "torch_dtype": torch.bfloat16,
        "requires_calibration": False,
    },
    "int4": {
        "description": "INT4 量化（实验性）",
        "expected_speedup": 2.0,
        "expected_memory_reduction": 0.75,
        "quality_impact": "high",
        "torch_dtype": None,  # 需要特殊处理
        "requires_calibration": True,
    }
}


def get_quantization_config(method: Optional[str] = None) -> Dict[str, Any]:
    """
    获取量化配置
    
    Args:
        method: 量化方法，None则使用默认配置
        
    Returns:
        量化配置字典
    """
    if method is None:
        method = QUANTIZATION_CONFIG["method"]
    
    if method not in QUANTIZATION_METHODS:
        raise ValueError(f"不支持的量化方法: {method}，支持的方法: {list(QUANTIZATION_METHODS.keys())}")
    
    config = QUANTIZATION_CONFIG.copy()
    config.update(QUANTIZATION_METHODS[method])
    config["method"] = method
    
    return config


def apply_quantization(model, method: str = "fp16") -> torch.nn.Module:
    """
    对模型应用量化
    
    Args:
        model: 原始模型
        method: 量化方法
        
    Returns:
        量化后的模型
    """
    config = get_quantization_config(method)
    
    if method == "fp16":
        # FP16 半精度
        model = model.half()
    elif method == "bf16":
        # BF16 脑浮点
        model = model.to(torch.bfloat16)
    elif method == "int8":
        # INT8 动态量化
        model = torch.quantization.quantize_dynamic(
            model, {torch.nn.Linear}, dtype=torch.qint8
        )
    elif method == "int4":
        # INT4 量化（需要 bitsandbytes 或其他库）
        raise NotImplementedError("INT4 量化尚未实现，需要额外的库支持")
    
    return model


def get_comparison_audio_path(text_type: str, method: str, is_original: bool = False) -> Path:
    """
    获取对比音频保存路径
    
    Args:
        text_type: 文本类型 (short, medium, long)
        method: 量化方法
        is_original: 是否为原始音频
        
    Returns:
        音频文件路径
    """
    from datetime import datetime
    
    base_dir = Path(QUANTIZATION_CONFIG["comparison_audio_dir"])
    base_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if is_original:
        filename = f"original_{text_type}_{timestamp}.wav"
    else:
        filename = f"quantized_{method}_{text_type}_{timestamp}.wav"
    
    return base_dir / filename


# 导出配置
__all__ = [
    "QUANTIZATION_CONFIG",
    "QUANTIZATION_METHODS",
    "get_quantization_config",
    "apply_quantization",
    "get_comparison_audio_path",
]