"""
BF16 量化模型详细对比测试
对比原始模型和 BF16 量化模型的性能
"""

import sys
import time
import json
import csv
import statistics
import threading
from pathlib import Path
from datetime import datetime

# 添加 core 目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "core"))

import torch
import pynvml
from local_moss_tts import moss_tts

# 初始化 pynvml
pynvml.nvmlInit()
gpu_handle = pynvml.nvmlDeviceGetHandleByIndex(0)

# 创建输出目录
OUTPUT_DIR = Path(__file__).parent.parent / "output" / "detailed_comparison"
RESULTS_DIR = OUTPUT_DIR / "results"
AUDIO_DIR = OUTPUT_DIR / "audio"
CHARTS_DIR = OUTPUT_DIR / "charts"

for dir_path in [OUTPUT_DIR, RESULTS_DIR, AUDIO_DIR, CHARTS_DIR, AUDIO_DIR / "original", AUDIO_DIR / "bf16"]:
    dir_path.mkdir(parents=True, exist_ok=True)

# 测试文本
test_texts = {
    "short": [
        "你好，我是AI助手。",
        "今天天气不错。",
        "请帮我查一下资料。",
        "谢谢你的帮助。",
        "再见！",
        "早上好！",
        "晚上好！",
        "吃了吗？",
        "最近怎么样？",
        "很高兴见到你。"
    ],
    "medium": [
        "人工智能是计算机科学的一个分支，它企图了解智能的实质。",
        "机器学习是人工智能的核心技术之一，它使计算机能够从数据中学习。",
        "深度学习是机器学习的一个子集，它使用多层神经网络来模拟人脑的工作方式。",
        "自然语言处理是人工智能的重要应用领域，它使计算机能够理解和生成人类语言。",
        "计算机视觉技术使机器能够识别和理解图像和视频内容，这在自动驾驶和医疗诊断中有广泛应用。",
        "Python是一种解释型、面向对象、动态数据类型的高级程序设计语言。",
        "数据分析是指用适当的统计分析方法对收集来的大量数据进行分析，提取有用信息。",
        "云计算是一种基于互联网的计算方式，通过这种方式，共享的软硬件资源和信息可以按需提供给计算机和其他设备。"
    ],
    "long": [
        "Python是一种解释型、面向对象、动态数据类型的高级程序设计语言。它由Guido van Rossum于1989年底发明，第一个公开发行版发行于1991年。Python源代码遵循GPL协议。Python的语法简洁清晰，特色之一是强制用空白符作为语句缩进。Python具有丰富的库，使它能够轻松完成各种任务。",
        "深度学习是机器学习的一个分支，它基于人工神经网络，特别是深层神经网络。深度学习模型通过多层非线性变换对数据进行高层抽象，能够自动学习数据的特征表示。卷积神经网络（CNN）在图像识别领域取得了巨大成功，循环神经网络（RNN）及其变体LSTM、GRU在序列数据处理方面表现出色。",
        "自然语言处理是人工智能和语言学领域的分支学科。此领域探讨如何处理及运用自然语言；自然语言认知则是指让电脑懂人类的语言。自然语言生成系统把计算机数据转化为自然语言。自然语言理解系统把自然语言转化为计算机程序更易于处理的形式。",
        "云计算是一种基于互联网的计算方式，通过这种方式，共享的软硬件资源和信息可以按需提供给计算机和其他设备。云计算的核心概念是以互联网为中心，在网站上提供快速且安全的云计算服务与数据存储，让每一个使用互联网的人都可以使用网络上的庞大计算资源与数据中心。"
    ]
}


class ResourceMonitor:
    """资源监控器"""
    
    def __init__(self):
        self.data = []
        self.monitoring = False
        self.thread = None
    
    def get_gpu_info(self):
        """获取 GPU 信息"""
        try:
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(gpu_handle)
            utilization = pynvml.nvmlDeviceGetUtilizationRates(gpu_handle)
            temperature = pynvml.nvmlDeviceGetTemperature(gpu_handle, pynvml.NVML_TEMPERATURE_GPU)
            
            try:
                power = pynvml.nvmlDeviceGetPowerUsage(gpu_handle) / 1000
            except:
                power = 0
            
            return {
                "gpu_memory_used_mb": mem_info.used / 1024 / 1024,
                "gpu_memory_total_mb": mem_info.total / 1024 / 1024,
                "gpu_memory_percent": mem_info.used / mem_info.total * 100,
                "gpu_utilization": utilization.gpu,
                "gpu_temperature": temperature,
                "gpu_power_w": power
            }
        except Exception as e:
            return {"error": str(e)}
    
    def monitor_loop(self):
        """监控循环"""
        while self.monitoring:
            data = {
                "timestamp": datetime.now().isoformat(),
                "elapsed_seconds": time.time() - self.start_time
            }
            data.update(self.get_gpu_info())
            self.data.append(data)
            time.sleep(1)
    
    def start(self):
        """开始监控"""
        self.monitoring = True
        self.start_time = time.time()
        self.data = []
        self.thread = threading.Thread(target=self.monitor_loop)
        self.thread.daemon = True
        self.thread.start()
        print("[监控] GPU 资源监控已启动")
    
    def stop(self, output_file):
        """停止监控并保存数据"""
        self.monitoring = False
        if self.thread:
            self.thread.join(timeout=5)
        
        if self.data:
            with open(output_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=self.data[0].keys())
                writer.writeheader()
                writer.writerows(self.data)
            print(f"[监控] 数据已保存: {output_file}")
        
        return self.data


def test_model_loading(quantization_method=None):
    """测试模型加载性能"""
    method_name = quantization_method if quantization_method else "original"
    print(f"\n{'='*60}")
    print(f"测试模型加载: {method_name}")
    print(f"{'='*60}")
    
    # 确保模型已卸载
    if moss_tts.is_loaded:
        moss_tts.unload_model()
        time.sleep(3)
    
    # 清空 CUDA 缓存
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        time.sleep(2)
    
    # 记录加载前的显存
    mem_before = pynvml.nvmlDeviceGetMemoryInfo(gpu_handle).used / 1024 / 1024
    
    # 加载模型
    start_time = time.time()
    success = moss_tts.warm_start(quantization_method=quantization_method)
    load_time = time.time() - start_time
    
    # 记录加载后的显存
    mem_after = pynvml.nvmlDeviceGetMemoryInfo(gpu_handle).used / 1024 / 1024
    mem_used = mem_after - mem_before
    
    result = {
        "method": method_name,
        "load_time_seconds": load_time,
        "success": success,
        "gpu_memory_before_mb": mem_before,
        "gpu_memory_after_mb": mem_after,
        "gpu_memory_used_mb": mem_used,
        "timestamp": datetime.now().isoformat()
    }
    
    print(f"加载时间: {load_time:.2f}s")
    print(f"显存使用: {mem_used:.0f} MB")
    print(f"加载状态: {'成功' if success else '失败'}")
    
    return result


def test_latency(text_type, samples, quantization_method=None):
    """测试响应时间"""
    method_name = quantization_method if quantization_method else "original"
    print(f"\n{'='*60}")
    print(f"测试响应时间: {text_type} ({samples} 次) - {method_name}")
    print(f"{'='*60}")
    
    if not moss_tts.is_loaded:
        print("[错误] 模型未加载")
        return None
    
    texts = test_texts[text_type]
    results = []
    
    for i in range(samples):
        text = texts[i % len(texts)]
        
        # 生成音频
        start_time = time.time()
        output_path = AUDIO_DIR / method_name / f"{text_type}_{i+1:03d}.wav"
        
        try:
            success = moss_tts.generate(text, str(output_path))
            elapsed = time.time() - start_time
            
            result = {
                "sample": i + 1,
                "text": text,
                "text_length": len(text),
                "response_time": elapsed,
                "success": success,
                "output_path": str(output_path)
            }
            results.append(result)
            
            status = "✓" if success else "✗"
            print(f"  [{status}] 样本 {i+1}/{samples}: {elapsed:.2f}s")
            
        except Exception as e:
            print(f"  [✗] 样本 {i+1}/{samples}: 错误 - {e}")
            results.append({
                "sample": i + 1,
                "text": text,
                "text_length": len(text),
                "response_time": 0,
                "success": False,
                "error": str(e)
            })
    
    # 计算统计指标
    success_results = [r for r in results if r.get("success")]
    
    if success_results:
        times = [r["response_time"] for r in success_results]
        stats = {
            "method": method_name,
            "text_type": text_type,
            "total_samples": samples,
            "success_count": len(success_results),
            "success_rate": len(success_results) / samples * 100,
            "avg_response_time": statistics.mean(times),
            "min_response_time": min(times),
            "max_response_time": max(times),
            "median_response_time": statistics.median(times),
            "p95": sorted(times)[int(len(times) * 0.95)] if len(times) > 1 else times[0],
            "std_dev": statistics.stdev(times) if len(times) > 1 else 0
        }
    else:
        stats = {
            "method": method_name,
            "text_type": text_type,
            "total_samples": samples,
            "success_count": 0,
            "success_rate": 0,
            "error": "所有请求都失败"
        }
    
    print(f"\n统计结果:")
    print(f"  成功率: {stats.get('success_rate', 0):.1f}%")
    print(f"  平均响应时间: {stats.get('avg_response_time', 0):.2f}s")
    print(f"  最小/最大: {stats.get('min_response_time', 0):.2f}s / {stats.get('max_response_time', 0):.2f}s")
    
    return {"stats": stats, "details": results}


def run_full_test(quantization_method=None):
    """运行完整测试"""
    method_name = quantization_method if quantization_method else "original"
    print(f"\n{'#'*60}")
    print(f"# 开始完整测试: {method_name}")
    print(f"{'#'*60}")
    
    all_results = {}
    
    # 1. 模型加载测试
    all_results["loading"] = test_model_loading(quantization_method)
    
    # 2. 响应时间测试
    all_results["latency_short"] = test_latency("short", 20, quantization_method)
    all_results["latency_medium"] = test_latency("medium", 15, quantization_method)
    
    # 长文本测试（如果显存允许）
    mem_info = pynvml.nvmlDeviceGetMemoryInfo(gpu_handle)
    mem_percent = mem_info.used / mem_info.total * 100
    
    if mem_percent < 95:
        all_results["latency_long"] = test_latency("long", 5, quantization_method)
    else:
        print(f"\n[警告] 显存占用过高 ({mem_percent:.1f}%)，跳过长文本测试")
        all_results["latency_long"] = {"skipped": True, "reason": "显存不足"}
    
    # 保存结果
    output_file = RESULTS_DIR / f"{method_name}_full_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    
    print(f"\n[完成] 测试结果已保存: {output_file}")
    
    return all_results


def main():
    """主函数"""
    print("="*60)
    print("BF16 量化模型详细对比测试")
    print("="*60)
    
    # 测试原始模型
    print("\n" + "="*60)
    print("第一阶段: 原始模型测试")
    print("="*60)
    original_results = run_full_test(quantization_method=None)
    
    # 卸载原始模型
    print("\n[准备] 卸载原始模型，准备 BF16 测试...")
    moss_tts.unload_model()
    time.sleep(5)
    
    # 测试 BF16 量化模型
    print("\n" + "="*60)
    print("第二阶段: BF16 量化模型测试")
    print("="*60)
    bf16_results = run_full_test(quantization_method="bf16")
    
    # 生成对比摘要
    print("\n" + "="*60)
    print("对比摘要")
    print("="*60)
    
    print("\n模型加载时间:")
    print(f"  原始模型: {original_results['loading']['load_time_seconds']:.2f}s")
    print(f"  BF16模型: {bf16_results['loading']['load_time_seconds']:.2f}s")
    
    print("\n显存占用:")
    print(f"  原始模型: {original_results['loading']['gpu_memory_used_mb']:.0f} MB")
    print(f"  BF16模型: {bf16_results['loading']['gpu_memory_used_mb']:.0f} MB")
    
    if original_results.get('latency_short') and bf16_results.get('latency_short'):
        print("\n短文本响应时间:")
        orig_avg = original_results['latency_short']['stats'].get('avg_response_time', 0)
        bf16_avg = bf16_results['latency_short']['stats'].get('avg_response_time', 0)
        print(f"  原始模型: {orig_avg:.2f}s")
        print(f"  BF16模型: {bf16_avg:.2f}s")
        if orig_avg > 0:
            improvement = (orig_avg - bf16_avg) / orig_avg * 100
            print(f"  性能提升: {improvement:+.1f}%")
    
    print("\n" + "="*60)
    print("测试完成！")
    print(f"结果目录: {OUTPUT_DIR}")
    print("="*60)


if __name__ == "__main__":
    main()
