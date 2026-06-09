"""
模型量化测试脚本
测试不同量化方法的性能和音质
"""

import sys
import time
import json
from pathlib import Path

# 添加 core 目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "core"))

from local_moss_tts import moss_tts
from quantization_config import QUANTIZATION_CONFIG, QUANTIZATION_METHODS

# 测试文本
test_texts = {
    'short': '你好，我是AI助手。',
    'medium': '人工智能是计算机科学的一个分支，它企图了解智能的实质。',
    'long': 'Python是一种解释型、面向对象、动态数据类型的高级程序设计语言。'
}


def test_quantization_method(method, text_type='short'):
    """
    测试指定量化方法
    
    Args:
        method: 量化方法 (fp16, bf16, int8)
        text_type: 文本类型
        
    Returns:
        dict: 测试结果
    """
    print(f"\n{'='*60}")
    print(f"测试量化方法: {method}")
    print(f"{'='*60}")
    
    # 卸载现有模型
    if moss_tts.is_loaded:
        print("[测试] 卸载现有模型...")
        moss_tts.unload_model()
        time.sleep(2)  # 等待资源释放
    
    # 使用量化加载模型
    print(f"[测试] 使用 {method} 量化加载模型...")
    start_time = time.time()
    success = moss_tts.warm_start(quantization_method=method)
    load_time = time.time() - start_time
    
    if not success:
        print(f"[错误] {method} 量化模型加载失败")
        return None
    
    print(f"[测试] 模型加载完成，耗时: {load_time:.2f}s")
    
    # 生成音频
    text = test_texts[text_type]
    output_dir = Path(__file__).parent.parent / "output" / "quantized_audio"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = output_dir / f"test_{method}_{text_type}.wav"
    
    print(f"[测试] 生成音频: {text[:20]}...")
    start_time = time.time()
    success = moss_tts.generate(
        text, 
        str(output_path), 
        save_comparison=True, 
        text_type=text_type
    )
    generate_time = time.time() - start_time
    
    if not success:
        print(f"[错误] 音频生成失败")
        return None
    
    print(f"[测试] 音频生成完成，耗时: {generate_time:.2f}s")
    print(f"[测试] 音频保存至: {output_path}")
    
    # 收集结果
    result = {
        "method": method,
        "text_type": text_type,
        "load_time": load_time,
        "generate_time": generate_time,
        "output_path": str(output_path),
        "quantization_enabled": moss_tts.quantization_enabled,
        "quantization_method": moss_tts.quantization_method,
    }
    
    # 添加量化方法配置信息
    if method in QUANTIZATION_METHODS:
        method_config = QUANTIZATION_METHODS[method]
        result.update({
            "description": method_config.get("description", ""),
            "expected_speedup": method_config.get("expected_speedup", 1.0),
            "expected_memory_reduction": method_config.get("expected_memory_reduction", 0.0),
            "quality_impact": method_config.get("quality_impact", "unknown"),
        })
    
    return result


def run_quantization_tests():
    """运行所有量化测试"""
    print("="*60)
    print("MOSS-TTS 模型量化测试")
    print("="*60)
    
    results = []
    
    # 测试 FP16 量化
    fp16_result = test_quantization_method("fp16", "short")
    if fp16_result:
        results.append(fp16_result)
    
    # 测试 BF16 量化
    bf16_result = test_quantization_method("bf16", "short")
    if bf16_result:
        results.append(bf16_result)
    
    # 测试 INT8 量化（如果支持）
    try:
        int8_result = test_quantization_method("int8", "short")
        if int8_result:
            results.append(int8_result)
    except Exception as e:
        print(f"[警告] INT8 量化测试失败: {e}")
    
    # 保存测试结果
    output_dir = Path(__file__).parent.parent / "output" / "results"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    result_file = output_dir / f"quantization_test_{time.strftime('%Y%m%d_%H%M%S')}.json"
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print("量化测试完成！")
    print(f"结果保存至: {result_file}")
    print(f"{'='*60}")
    
    # 打印对比结果
    print("\n量化方法对比:")
    print(f"{'方法':<10} {'加载时间':<12} {'生成时间':<12} {'音质影响':<10}")
    print("-" * 50)
    for r in results:
        print(f"{r['method']:<10} {r['load_time']:<12.2f} {r['generate_time']:<12.2f} {r.get('quality_impact', 'unknown'):<10}")
    
    return results


if __name__ == "__main__":
    run_quantization_tests()
