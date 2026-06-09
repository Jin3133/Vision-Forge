"""
MOSS-TTS 服务器资源监控脚本
实时监控 GPU、CPU、内存使用情况
"""

import os
import time
import csv
import json
import psutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import threading

# 尝试导入 pynvml 进行 GPU 监控
try:
    import pynvml
    PYNVML_AVAILABLE = True
except ImportError:
    PYNVML_AVAILABLE = False
    print("[警告] pynvml 未安装，GPU 监控将不可用")

RESULTS_DIR = Path(__file__).parent.parent / "output" / "results"
RESULTS_DIR.mkdir(exist_ok=True)


class ResourceMonitor:
    """资源监控器"""
    
    def __init__(self, interval: float = 1.0):
        self.interval = interval
        self.monitoring = False
        self.data: List[Dict] = []
        self.monitor_thread: Optional[threading.Thread] = None
        self.start_time: Optional[float] = None
        
        # 初始化 GPU 监控
        self.gpu_available = False
        if PYNVML_AVAILABLE:
            try:
                pynvml.nvmlInit()
                self.gpu_count = pynvml.nvmlDeviceGetCount()
                self.gpu_available = self.gpu_count > 0
                if self.gpu_available:
                    self.gpu_handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    print(f"[GPU] 检测到 {self.gpu_count} 个 GPU 设备")
            except Exception as e:
                print(f"[GPU] 初始化失败: {e}")
    
    def get_gpu_info(self) -> Dict:
        """获取 GPU 信息"""
        if not self.gpu_available:
            return {}
        
        try:
            # 获取 GPU 使用率
            utilization = pynvml.nvmlDeviceGetUtilizationRates(self.gpu_handle)
            
            # 获取显存信息
            memory_info = pynvml.nvmlDeviceGetMemoryInfo(self.gpu_handle)
            
            # 获取温度
            temperature = pynvml.nvmlDeviceGetTemperature(self.gpu_handle, pynvml.NVML_TEMPERATURE_GPU)
            
            # 获取功耗
            try:
                power_draw = pynvml.nvmlDeviceGetPowerUsage(self.gpu_handle) / 1000  # 转换为瓦特
            except:
                power_draw = 0
            
            return {
                "gpu_utilization": utilization.gpu,
                "gpu_memory_used": memory_info.used / 1024 / 1024,  # MB
                "gpu_memory_total": memory_info.total / 1024 / 1024,  # MB
                "gpu_memory_percent": memory_info.used / memory_info.total * 100,
                "gpu_temperature": temperature,
                "gpu_power_draw": power_draw
            }
        except Exception as e:
            print(f"[GPU] 获取信息失败: {e}")
            return {}
    
    def get_system_info(self) -> Dict:
        """获取系统资源信息"""
        # CPU 信息
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count()
        
        # 内存信息
        memory = psutil.virtual_memory()
        
        # 进程信息（TTS 服务器进程）
        process_info = self.get_tts_process_info()
        
        return {
            "cpu_percent": cpu_percent,
            "cpu_count": cpu_count,
            "memory_used": memory.used / 1024 / 1024 / 1024,  # GB
            "memory_total": memory.total / 1024 / 1024 / 1024,  # GB
            "memory_percent": memory.percent,
            **process_info
        }
    
    def get_tts_process_info(self) -> Dict:
        """获取 TTS 服务器进程信息"""
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'memory_info']):
                try:
                    cmdline = proc.info.get('cmdline', [])
                    if cmdline and 'tts_server.py' in ' '.join(cmdline):
                        memory_info = proc.info.get('memory_info', None)
                        if memory_info:
                            return {
                                "tts_process_memory_mb": memory_info.rss / 1024 / 1024,
                                "tts_process_cpu_percent": proc.cpu_percent(interval=0.1)
                            }
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            pass
        
        return {
            "tts_process_memory_mb": 0,
            "tts_process_cpu_percent": 0
        }
    
    def collect_once(self) -> Dict:
        """收集一次资源数据"""
        timestamp = datetime.now().isoformat()
        elapsed = time.time() - self.start_time if self.start_time else 0
        
        data = {
            "timestamp": timestamp,
            "elapsed_seconds": round(elapsed, 2)
        }
        
        # 收集 GPU 信息
        gpu_info = self.get_gpu_info()
        data.update(gpu_info)
        
        # 收集系统信息
        system_info = self.get_system_info()
        data.update(system_info)
        
        return data
    
    def _monitor_loop(self):
        """监控循环"""
        while self.monitoring:
            data = self.collect_once()
            self.data.append(data)
            time.sleep(self.interval)
    
    def start(self):
        """开始监控"""
        if self.monitoring:
            print("[监控] 已经在运行中")
            return
        
        self.monitoring = True
        self.start_time = time.time()
        self.data = []
        
        self.monitor_thread = threading.Thread(target=self._monitor_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        
        print(f"[监控] 已开始，采样间隔: {self.interval}s")
    
    def stop(self) -> Path:
        """停止监控并保存数据"""
        if not self.monitoring:
            print("[监控] 未在运行")
            return None
        
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        
        # 保存数据
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = RESULTS_DIR / f"resource_usage_{timestamp}.csv"
        
        if self.data:
            with open(output_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=self.data[0].keys())
                writer.writeheader()
                writer.writerows(self.data)
            
            print(f"[监控] 已停止，数据保存至: {output_file}")
            print(f"[监控] 共收集 {len(self.data)} 条数据")
        
        return output_file
    
    def get_summary(self) -> Dict:
        """获取监控摘要"""
        if not self.data:
            return {}
        
        summary = {
            "total_samples": len(self.data),
            "duration_seconds": self.data[-1]["elapsed_seconds"] if self.data else 0
        }
        
        # GPU 统计
        if self.gpu_available and any("gpu_utilization" in d for d in self.data):
            gpu_utils = [d["gpu_utilization"] for d in self.data if "gpu_utilization" in d]
            gpu_mems = [d["gpu_memory_used"] for d in self.data if "gpu_memory_used" in d]
            gpu_temps = [d["gpu_temperature"] for d in self.data if "gpu_temperature" in d]
            
            if gpu_utils:
                summary["gpu_utilization_avg"] = sum(gpu_utils) / len(gpu_utils)
                summary["gpu_utilization_max"] = max(gpu_utils)
            
            if gpu_mems:
                summary["gpu_memory_avg_mb"] = sum(gpu_mems) / len(gpu_mems)
                summary["gpu_memory_max_mb"] = max(gpu_mems)
            
            if gpu_temps:
                summary["gpu_temperature_avg"] = sum(gpu_temps) / len(gpu_temps)
                summary["gpu_temperature_max"] = max(gpu_temps)
        
        # 系统资源统计
        cpu_percents = [d["cpu_percent"] for d in self.data if "cpu_percent" in d]
        memory_percents = [d["memory_percent"] for d in self.data if "memory_percent" in d]
        
        if cpu_percents:
            summary["cpu_percent_avg"] = sum(cpu_percents) / len(cpu_percents)
            summary["cpu_percent_max"] = max(cpu_percents)
        
        if memory_percents:
            summary["memory_percent_avg"] = sum(memory_percents) / len(memory_percents)
            summary["memory_percent_max"] = max(memory_percents)
        
        return summary


def monitor_during_test(test_duration: int = 300, interval: float = 1.0) -> Path:
    """在测试期间监控资源"""
    monitor = ResourceMonitor(interval=interval)
    
    print(f"[资源监控] 将监控 {test_duration} 秒")
    monitor.start()
    
    try:
        time.sleep(test_duration)
    except KeyboardInterrupt:
        print("\n[资源监控] 被中断")
    
    output_file = monitor.stop()
    
    # 打印摘要
    summary = monitor.get_summary()
    if summary:
        print("\n[资源监控] 摘要:")
        for key, value in summary.items():
            if isinstance(value, float):
                print(f"  {key}: {value:.2f}")
            else:
                print(f"  {key}: {value}")
    
    return output_file


def monitor_background():
    """后台监控模式 - 持续监控直到手动停止"""
    monitor = ResourceMonitor(interval=2.0)
    monitor.start()
    
    print("[后台监控] 按 Ctrl+C 停止监控")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[后台监控] 停止中...")
    
    monitor.stop()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--duration":
        duration = int(sys.argv[2]) if len(sys.argv) > 2 else 300
        monitor_during_test(duration)
    else:
        monitor_background()
