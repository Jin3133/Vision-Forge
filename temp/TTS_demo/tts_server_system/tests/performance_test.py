"""
MOSS-TTS 服务器性能测试脚本
包含响应时间测试、吞吐量测试、并发测试和稳定性测试
"""

import os
import sys
import time
import json
import csv
import requests
import threading
import statistics
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any
import psutil

# 测试配置
BASE_URL = "http://127.0.0.1:8080"
RESULTS_DIR = Path(__file__).parent.parent / "output" / "results"
RESULTS_DIR.mkdir(exist_ok=True)

# 测试文本样本
TEST_TEXTS = {
    "short": [
        "你好，我是AI助手。",
        "今天天气不错。",
        "请帮我查一下资料。",
        "谢谢你的帮助。",
        "再见！"
    ],
    "medium": [
        "人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。",
        "机器学习是人工智能的核心技术之一，它使计算机能够在没有明确编程的情况下从数据中学习。",
        "深度学习是机器学习的一个子集，它使用多层神经网络来模拟人脑的工作方式。",
        "自然语言处理是人工智能的重要应用领域，它使计算机能够理解和生成人类语言。",
        "计算机视觉技术使机器能够识别和理解图像和视频内容，这在自动驾驶和医疗诊断中有广泛应用。"
    ],
    "long": [
        "Python是一种解释型、面向对象、动态数据类型的高级程序设计语言。它由Guido van Rossum于1989年底发明，第一个公开发行版发行于1991年。Python源代码遵循GPL协议。Python的语法简洁清晰，特色之一是强制用空白符作为语句缩进。Python具有丰富的库，使它能够轻松完成各种任务，如Web开发、数据分析、人工智能、科学计算等。",
        "深度学习是机器学习的一个分支，它基于人工神经网络，特别是深层神经网络。深度学习模型通过多层非线性变换对数据进行高层抽象，能够自动学习数据的特征表示。卷积神经网络（CNN）在图像识别领域取得了巨大成功，循环神经网络（RNN）及其变体LSTM、GRU在序列数据处理方面表现出色，而Transformer架构则在自然语言处理领域引发了革命性的变化。"
    ]
}


class TTSTester:
    """TTS 性能测试器"""
    
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.results = []
        self.errors = []
        
    def check_server(self) -> bool:
        """检查服务器是否运行"""
        try:
            response = requests.get(f"{self.base_url}/status", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def send_tts_request(self, text: str, output_format: str = "base64") -> Dict[str, Any]:
        """发送 TTS 请求"""
        start_time = time.time()
        try:
            response = requests.post(
                f"{self.base_url}/tts",
                json={"text": text, "output_format": output_format, "speed": 1.0},
                timeout=300
            )
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "response_time": elapsed,
                    "text_length": len(text),
                    "text_type": self._get_text_type(text),
                    "timestamp": datetime.now().isoformat(),
                    "status_code": response.status_code
                }
            else:
                return {
                    "success": False,
                    "response_time": elapsed,
                    "text_length": len(text),
                    "text_type": self._get_text_type(text),
                    "timestamp": datetime.now().isoformat(),
                    "status_code": response.status_code,
                    "error": response.text
                }
        except Exception as e:
            elapsed = time.time() - start_time
            return {
                "success": False,
                "response_time": elapsed,
                "text_length": len(text),
                "text_type": self._get_text_type(text),
                "timestamp": datetime.now().isoformat(),
                "error": str(e)
            }
    
    def _get_text_type(self, text: str) -> str:
        """获取文本类型"""
        length = len(text)
        if length <= 50:
            return "short"
        elif length <= 200:
            return "medium"
        else:
            return "long"
    
    def test_latency(self, text_type: str = "short", samples: int = 100) -> Dict[str, Any]:
        """测试响应时间"""
        print(f"\n[延迟测试] 开始测试 {text_type} 文本，样本数: {samples}")
        
        texts = TEST_TEXTS[text_type]
        results = []
        
        for i in range(samples):
            text = texts[i % len(texts)]
            result = self.send_tts_request(text)
            results.append(result)
            
            if (i + 1) % 10 == 0:
                print(f"  进度: {i + 1}/{samples}")
        
        # 计算统计指标
        success_results = [r for r in results if r["success"]]
        failed_results = [r for r in results if not r["success"]]
        
        if success_results:
            response_times = [r["response_time"] for r in success_results]
            stats = {
                "text_type": text_type,
                "total_samples": samples,
                "success_count": len(success_results),
                "failed_count": len(failed_results),
                "success_rate": len(success_results) / samples * 100,
                "avg_response_time": statistics.mean(response_times),
                "min_response_time": min(response_times),
                "max_response_time": max(response_times),
                "median_response_time": statistics.median(response_times),
                "p50": statistics.median(response_times),
                "p75": self._percentile(response_times, 75),
                "p90": self._percentile(response_times, 90),
                "p95": self._percentile(response_times, 95),
                "p99": self._percentile(response_times, 99),
                "std_dev": statistics.stdev(response_times) if len(response_times) > 1 else 0
            }
        else:
            stats = {
                "text_type": text_type,
                "total_samples": samples,
                "success_count": 0,
                "failed_count": len(failed_results),
                "success_rate": 0,
                "error": "所有请求都失败了"
            }
        
        # 保存详细结果
        output_file = RESULTS_DIR / f"latency_{text_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({"stats": stats, "details": results}, f, ensure_ascii=False, indent=2)
        
        print(f"[延迟测试] 完成。成功率: {stats.get('success_rate', 0):.1f}%, 平均响应时间: {stats.get('avg_response_time', 0):.2f}s")
        return stats
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """计算百分位数"""
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(index, len(sorted_data) - 1)]
    
    def test_throughput(self, concurrency: int = 1, duration: int = 60) -> Dict[str, Any]:
        """测试吞吐量"""
        print(f"\n[吞吐量测试] 并发数: {concurrency}, 持续时间: {duration}s")
        
        results = []
        start_time = time.time()
        request_count = 0
        
        def worker():
            nonlocal request_count
            while time.time() - start_time < duration:
                text = TEST_TEXTS["short"][request_count % len(TEST_TEXTS["short"])]
                result = self.send_tts_request(text)
                results.append(result)
                request_count += 1
        
        # 启动并发线程
        threads = []
        for _ in range(concurrency):
            t = threading.Thread(target=worker)
            t.daemon = True
            threads.append(t)
            t.start()
        
        # 等待测试完成
        time.sleep(duration)
        for t in threads:
            t.join(timeout=5)
        
        # 计算统计指标
        success_results = [r for r in results if r["success"]]
        actual_duration = time.time() - start_time
        
        stats = {
            "concurrency": concurrency,
            "duration": duration,
            "actual_duration": actual_duration,
            "total_requests": len(results),
            "success_count": len(success_results),
            "failed_count": len(results) - len(success_results),
            "success_rate": len(success_results) / len(results) * 100 if results else 0,
            "rps": len(results) / actual_duration if actual_duration > 0 else 0,
            "success_rps": len(success_results) / actual_duration if actual_duration > 0 else 0
        }
        
        if success_results:
            response_times = [r["response_time"] for r in success_results]
            stats["avg_response_time"] = statistics.mean(response_times)
            stats["min_response_time"] = min(response_times)
            stats["max_response_time"] = max(response_times)
        
        # 保存结果
        output_file = RESULTS_DIR / f"throughput_c{concurrency}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({"stats": stats, "details": results}, f, ensure_ascii=False, indent=2)
        
        print(f"[吞吐量测试] 完成。RPS: {stats['rps']:.2f}, 成功率: {stats['success_rate']:.1f}%")
        return stats
    
    def test_concurrency(self, concurrency_levels: List[int] = [1, 2, 5, 10], duration_per_level: int = 60) -> List[Dict[str, Any]]:
        """测试并发处理能力"""
        print(f"\n[并发测试] 测试级别: {concurrency_levels}")
        
        all_stats = []
        for level in concurrency_levels:
            stats = self.test_throughput(concurrency=level, duration=duration_per_level)
            all_stats.append(stats)
            time.sleep(5)  # 间隔休息
        
        # 保存汇总结果
        output_file = RESULTS_DIR / f"concurrency_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_stats, f, ensure_ascii=False, indent=2)
        
        return all_stats
    
    def test_stability(self, duration_minutes: int = 30, interval_seconds: int = 5) -> Dict[str, Any]:
        """稳定性测试"""
        print(f"\n[稳定性测试] 持续时间: {duration_minutes}分钟, 请求间隔: {interval_seconds}秒")
        
        results = []
        start_time = time.time()
        end_time = start_time + duration_minutes * 60
        request_count = 0
        
        while time.time() < end_time:
            text = TEST_TEXTS["medium"][request_count % len(TEST_TEXTS["medium"])]
            result = self.send_tts_request(text)
            results.append(result)
            request_count += 1
            
            # 显示进度
            elapsed = time.time() - start_time
            progress = elapsed / (duration_minutes * 60) * 100
            if request_count % 10 == 0:
                print(f"  进度: {progress:.1f}%, 已发送 {request_count} 个请求")
            
            # 等待下一次请求
            time.sleep(interval_seconds)
        
        # 计算统计指标
        success_results = [r for r in results if r["success"]]
        actual_duration = time.time() - start_time
        
        # 按时间段分析
        time_segments = []
        segment_size = len(results) // 6  # 分成6个时间段
        for i in range(6):
            start_idx = i * segment_size
            end_idx = (i + 1) * segment_size if i < 5 else len(results)
            segment = results[start_idx:end_idx]
            segment_success = [r for r in segment if r["success"]]
            
            if segment_success:
                time_segments.append({
                    "segment": i + 1,
                    "avg_response_time": statistics.mean([r["response_time"] for r in segment_success]),
                    "success_rate": len(segment_success) / len(segment) * 100
                })
        
        stats = {
            "duration_minutes": duration_minutes,
            "actual_duration": actual_duration,
            "total_requests": len(results),
            "success_count": len(success_results),
            "failed_count": len(results) - len(success_results),
            "success_rate": len(success_results) / len(results) * 100 if results else 0,
            "avg_rps": len(results) / actual_duration if actual_duration > 0 else 0,
            "time_segments": time_segments
        }
        
        if success_results:
            response_times = [r["response_time"] for r in success_results]
            stats["avg_response_time"] = statistics.mean(response_times)
            stats["min_response_time"] = min(response_times)
            stats["max_response_time"] = max(response_times)
            stats["response_time_std"] = statistics.stdev(response_times) if len(response_times) > 1 else 0
            
            # 检测性能衰减
            if len(time_segments) >= 2:
                first_segment_avg = time_segments[0]["avg_response_time"]
                last_segment_avg = time_segments[-1]["avg_response_time"]
                stats["performance_degradation"] = (last_segment_avg - first_segment_avg) / first_segment_avg * 100
        
        # 保存结果
        output_file = RESULTS_DIR / f"stability_{duration_minutes}min_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({"stats": stats, "details": results}, f, ensure_ascii=False, indent=2)
        
        print(f"[稳定性测试] 完成。成功率: {stats['success_rate']:.1f}%, 平均响应时间: {stats.get('avg_response_time', 0):.2f}s")
        return stats


def run_all_tests():
    """运行所有测试"""
    tester = TTSTester()
    
    # 检查服务器
    print("[检查] 检查 TTS 服务器状态...")
    if not tester.check_server():
        print("[错误] TTS 服务器未运行，请先启动服务器: python tts_server.py")
        return
    print("[检查] 服务器运行正常")
    
    all_results = {}
    
    # 1. 响应时间测试
    print("\n" + "="*60)
    print("开始响应时间测试")
    print("="*60)
    
    all_results["latency_short"] = tester.test_latency("short", samples=50)
    all_results["latency_medium"] = tester.test_latency("medium", samples=30)
    all_results["latency_long"] = tester.test_latency("long", samples=20)
    
    # 2. 吞吐量测试
    print("\n" + "="*60)
    print("开始吞吐量测试")
    print("="*60)
    
    all_results["throughput"] = tester.test_throughput(concurrency=1, duration=60)
    
    # 3. 并发测试
    print("\n" + "="*60)
    print("开始并发测试")
    print("="*60)
    
    all_results["concurrency"] = tester.test_concurrency(
        concurrency_levels=[1, 2, 5],
        duration_per_level=60
    )
    
    # 4. 稳定性测试（缩短为5分钟用于演示）
    print("\n" + "="*60)
    print("开始稳定性测试")
    print("="*60)
    
    all_results["stability"] = tester.test_stability(duration_minutes=5, interval_seconds=5)
    
    # 保存汇总结果
    summary_file = RESULTS_DIR / f"all_test_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    
    print("\n" + "="*60)
    print("所有测试完成！")
    print(f"结果保存在: {RESULTS_DIR}")
    print("="*60)
    
    return all_results


if __name__ == "__main__":
    run_all_tests()
