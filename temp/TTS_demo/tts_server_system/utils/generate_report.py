"""
MOSS-TTS 性能测试报告生成器
生成可视化图表和 HTML 报告
"""

import json
import csv
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # 非交互式后端
import numpy as np

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

RESULTS_DIR = Path(__file__).parent.parent / "output" / "results"
REPORT_DIR = Path(__file__).parent.parent / "reports"
REPORT_DIR.mkdir(exist_ok=True)


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self):
        self.results_dir = RESULTS_DIR
        self.report_dir = REPORT_DIR
        self.data = {}
    
    def load_all_data(self):
        """加载所有测试结果数据"""
        print("[报告] 加载测试数据...")
        
        # 加载延迟测试数据
        latency_files = list(self.results_dir.glob("latency_*.json"))
        self.data['latency'] = {}
        for f in latency_files:
            with open(f, 'r', encoding='utf-8') as fp:
                data = json.load(fp)
                text_type = data['stats']['text_type']
                self.data['latency'][text_type] = data
        
        # 加载吞吐量测试数据
        throughput_files = list(self.results_dir.glob("throughput_*.json"))
        self.data['throughput'] = []
        for f in throughput_files:
            with open(f, 'r', encoding='utf-8') as fp:
                self.data['throughput'].append(json.load(fp))
        
        # 加载并发测试数据
        concurrency_files = list(self.results_dir.glob("concurrency_*.json"))
        if concurrency_files:
            with open(concurrency_files[0], 'r', encoding='utf-8') as fp:
                self.data['concurrency'] = json.load(fp)
        
        # 加载稳定性测试数据
        stability_files = list(self.results_dir.glob("stability_*.json"))
        if stability_files:
            with open(stability_files[0], 'r', encoding='utf-8') as fp:
                self.data['stability'] = json.load(fp)
        
        # 加载资源监控数据
        resource_files = list(self.results_dir.glob("resource_usage_*.csv"))
        if resource_files:
            with open(resource_files[0], 'r', encoding='utf-8') as fp:
                reader = csv.DictReader(fp)
                self.data['resources'] = list(reader)
        
        print(f"[报告] 已加载数据: {list(self.data.keys())}")
    
    def generate_latency_chart(self):
        """生成响应时间分布图"""
        if 'latency' not in self.data or not self.data['latency']:
            print("[报告] 没有延迟测试数据")
            return None
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle('TTS 响应时间分析', fontsize=16, fontweight='bold')
        
        text_types = ['short', 'medium', 'long']
        colors = ['#3498db', '#2ecc71', '#e74c3c']
        
        # 1. 响应时间对比柱状图
        ax1 = axes[0, 0]
        categories = []
        avg_times = []
        p95_times = []
        
        for text_type in text_types:
            if text_type in self.data['latency']:
                stats = self.data['latency'][text_type]['stats']
                categories.append(text_type)
                avg_times.append(stats.get('avg_response_time', 0))
                p95_times.append(stats.get('p95', 0))
        
        x = np.arange(len(categories))
        width = 0.35
        
        bars1 = ax1.bar(x - width/2, avg_times, width, label='平均响应时间', color='#3498db')
        bars2 = ax1.bar(x + width/2, p95_times, width, label='P95 响应时间', color='#e74c3c')
        
        ax1.set_xlabel('文本类型')
        ax1.set_ylabel('响应时间 (秒)')
        ax1.set_title('不同文本类型的响应时间对比')
        ax1.set_xticks(x)
        ax1.set_xticklabels(categories)
        ax1.legend()
        ax1.grid(axis='y', alpha=0.3)
        
        # 2. 百分位分布图
        ax2 = axes[0, 1]
        percentiles = ['p50', 'p75', 'p90', 'p95', 'p99']
        
        for i, text_type in enumerate(text_types):
            if text_type in self.data['latency']:
                stats = self.data['latency'][text_type]['stats']
                values = [stats.get(p, 0) for p in percentiles]
                ax2.plot(percentiles, values, marker='o', label=text_type, color=colors[i], linewidth=2)
        
        ax2.set_xlabel('百分位')
        ax2.set_ylabel('响应时间 (秒)')
        ax2.set_title('响应时间百分位分布')
        ax2.legend()
        ax2.grid(alpha=0.3)
        
        # 3. 成功率对比
        ax3 = axes[1, 0]
        success_rates = []
        labels = []
        
        for text_type in text_types:
            if text_type in self.data['latency']:
                stats = self.data['latency'][text_type]['stats']
                labels.append(text_type)
                success_rates.append(stats.get('success_rate', 0))
        
        bars = ax3.bar(labels, success_rates, color=['#2ecc71', '#f39c12', '#e74c3c'])
        ax3.set_xlabel('文本类型')
        ax3.set_ylabel('成功率 (%)')
        ax3.set_title('请求成功率')
        ax3.set_ylim(0, 105)
        ax3.grid(axis='y', alpha=0.3)
        
        # 在柱状图上添加数值
        for bar in bars:
            height = bar.get_height()
            ax3.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.1f}%', ha='center', va='bottom')
        
        # 4. 响应时间箱线图
        ax4 = axes[1, 1]
        box_data = []
        box_labels = []
        
        for text_type in text_types:
            if text_type in self.data['latency']:
                details = self.data['latency'][text_type].get('details', [])
                times = [d['response_time'] for d in details if d.get('success')]
                if times:
                    box_data.append(times)
                    box_labels.append(text_type)
        
        if box_data:
            bp = ax4.boxplot(box_data, labels=box_labels, patch_artist=True)
            for patch, color in zip(bp['boxes'], colors[:len(box_data)]):
                patch.set_facecolor(color)
                patch.set_alpha(0.6)
            ax4.set_xlabel('文本类型')
            ax4.set_ylabel('响应时间 (秒)')
            ax4.set_title('响应时间分布箱线图')
            ax4.grid(axis='y', alpha=0.3)
        
        plt.tight_layout()
        output_file = self.report_dir / 'latency_analysis.png'
        plt.savefig(output_file, dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"[报告] 响应时间图表已生成: {output_file}")
        return output_file
    
    def generate_throughput_chart(self):
        """生成吞吐量图表"""
        if 'concurrency' not in self.data or not self.data['concurrency']:
            print("[报告] 没有并发测试数据")
            return None
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        fig.suptitle('TTS 吞吐量与并发性能', fontsize=16, fontweight='bold')
        
        concurrency_data = self.data['concurrency']
        
        # 提取数据
        concurrency_levels = [d['concurrency'] for d in concurrency_data]
        rps_values = [d['rps'] for d in concurrency_data]
        success_rates = [d['success_rate'] for d in concurrency_data]
        avg_response_times = [d.get('avg_response_time', 0) for d in concurrency_data]
        
        # 1. RPS 和响应时间趋势
        ax1 = axes[0]
        ax1_twin = ax1.twinx()
        
        line1 = ax1.plot(concurrency_levels, rps_values, 'b-o', label='RPS', linewidth=2, markersize=8)
        line2 = ax1_twin.plot(concurrency_levels, avg_response_times, 'r-s', label='平均响应时间', linewidth=2, markersize=8)
        
        ax1.set_xlabel('并发数')
        ax1.set_ylabel('RPS (请求/秒)', color='b')
        ax1_twin.set_ylabel('平均响应时间 (秒)', color='r')
        ax1.set_title('吞吐量与响应时间趋势')
        ax1.grid(alpha=0.3)
        ax1.tick_params(axis='y', labelcolor='b')
        ax1_twin.tick_params(axis='y', labelcolor='r')
        
        # 合并图例
        lines = line1 + line2
        labels = [l.get_label() for l in lines]
        ax1.legend(lines, labels, loc='upper left')
        
        # 2. 成功率
        ax2 = axes[1]
        bars = ax2.bar([str(c) for c in concurrency_levels], success_rates, color='#2ecc71', alpha=0.7)
        ax2.set_xlabel('并发数')
        ax2.set_ylabel('成功率 (%)')
        ax2.set_title('不同并发下的成功率')
        ax2.set_ylim(0, 105)
        ax2.grid(axis='y', alpha=0.3)
        
        # 添加数值标签
        for bar in bars:
            height = bar.get_height()
            ax2.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.1f}%', ha='center', va='bottom')
        
        plt.tight_layout()
        output_file = self.report_dir / 'throughput_analysis.png'
        plt.savefig(output_file, dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"[报告] 吞吐量图表已生成: {output_file}")
        return output_file
    
    def generate_resource_chart(self):
        """生成资源使用图表"""
        if 'resources' not in self.data or not self.data['resources']:
            print("[报告] 没有资源监控数据")
            return None
        
        resources = self.data['resources']
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle('TTS 服务器资源使用情况', fontsize=16, fontweight='bold')
        
        # 提取时间序列
        times = [float(r['elapsed_seconds']) for r in resources]
        
        # 1. GPU 使用率
        ax1 = axes[0, 0]
        if 'gpu_utilization' in resources[0]:
            gpu_utils = [float(r['gpu_utilization']) for r in resources if 'gpu_utilization' in r]
            ax1.plot(times[:len(gpu_utils)], gpu_utils, 'b-', linewidth=1.5)
            ax1.set_xlabel('时间 (秒)')
            ax1.set_ylabel('GPU 使用率 (%)')
            ax1.set_title('GPU 使用率趋势')
            ax1.grid(alpha=0.3)
            ax1.set_ylim(0, 100)
        else:
            ax1.text(0.5, 0.5, '无 GPU 数据', ha='center', va='center', transform=ax1.transAxes)
        
        # 2. GPU 显存使用
        ax2 = axes[0, 1]
        if 'gpu_memory_used' in resources[0]:
            gpu_mems = [float(r['gpu_memory_used']) for r in resources if 'gpu_memory_used' in r]
            ax2.plot(times[:len(gpu_mems)], gpu_mems, 'g-', linewidth=1.5)
            ax2.set_xlabel('时间 (秒)')
            ax2.set_ylabel('显存使用 (MB)')
            ax2.set_title('GPU 显存使用趋势')
            ax2.grid(alpha=0.3)
        else:
            ax2.text(0.5, 0.5, '无 GPU 数据', ha='center', va='center', transform=ax2.transAxes)
        
        # 3. CPU 使用率
        ax3 = axes[1, 0]
        cpu_percents = [float(r['cpu_percent']) for r in resources if 'cpu_percent' in r]
        ax3.plot(times[:len(cpu_percents)], cpu_percents, 'r-', linewidth=1.5)
        ax3.set_xlabel('时间 (秒)')
        ax3.set_ylabel('CPU 使用率 (%)')
        ax3.set_title('CPU 使用率趋势')
        ax3.grid(alpha=0.3)
        ax3.set_ylim(0, 100)
        
        # 4. 内存使用率
        ax4 = axes[1, 1]
        memory_percents = [float(r['memory_percent']) for r in resources if 'memory_percent' in r]
        ax4.plot(times[:len(memory_percents)], memory_percents, 'm-', linewidth=1.5)
        ax4.set_xlabel('时间 (秒)')
        ax4.set_ylabel('内存使用率 (%)')
        ax4.set_title('系统内存使用率趋势')
        ax4.grid(alpha=0.3)
        
        plt.tight_layout()
        output_file = self.report_dir / 'resource_usage.png'
        plt.savefig(output_file, dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"[报告] 资源使用图表已生成: {output_file}")
        return output_file
    
    def generate_stability_chart(self):
        """生成稳定性测试图表"""
        if 'stability' not in self.data or not self.data['stability']:
            print("[报告] 没有稳定性测试数据")
            return None
        
        stability = self.data['stability']
        stats = stability['stats']
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        fig.suptitle('TTS 服务器稳定性测试', fontsize=16, fontweight='bold')
        
        # 1. 时间段性能趋势
        ax1 = axes[0]
        if 'time_segments' in stats and stats['time_segments']:
            segments = stats['time_segments']
            segment_nums = [s['segment'] for s in segments]
            avg_times = [s['avg_response_time'] for s in segments]
            success_rates = [s['success_rate'] for s in segments]
            
            ax1_twin = ax1.twinx()
            line1 = ax1.plot(segment_nums, avg_times, 'b-o', label='平均响应时间', linewidth=2)
            line2 = ax1_twin.plot(segment_nums, success_rates, 'g-s', label='成功率', linewidth=2)
            
            ax1.set_xlabel('时间段')
            ax1.set_ylabel('平均响应时间 (秒)', color='b')
            ax1_twin.set_ylabel('成功率 (%)', color='g')
            ax1.set_title('性能趋势（按时间段）')
            ax1.grid(alpha=0.3)
            ax1_twin.set_ylim(0, 105)
            
            lines = line1 + line2
            labels = [l.get_label() for l in lines]
            ax1.legend(lines, labels, loc='upper left')
        
        # 2. 关键指标摘要
        ax2 = axes[1]
        ax2.axis('off')
        
        summary_text = f"""
        稳定性测试摘要
        
        测试时长: {stats.get('duration_minutes', 0)} 分钟
        总请求数: {stats.get('total_requests', 0)}
        成功请求: {stats.get('success_count', 0)}
        失败请求: {stats.get('failed_count', 0)}
        成功率: {stats.get('success_rate', 0):.2f}%
        
        平均响应时间: {stats.get('avg_response_time', 0):.2f} 秒
        最小响应时间: {stats.get('min_response_time', 0):.2f} 秒
        最大响应时间: {stats.get('max_response_time', 0):.2f} 秒
        响应时间标准差: {stats.get('response_time_std', 0):.2f} 秒
        
        平均 RPS: {stats.get('avg_rps', 0):.2f}
        性能衰减: {stats.get('performance_degradation', 0):.2f}%
        """
        
        ax2.text(0.1, 0.5, summary_text, transform=ax2.transAxes,
                fontsize=11, verticalalignment='center',
                fontfamily='monospace', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        plt.tight_layout()
        output_file = self.report_dir / 'stability_analysis.png'
        plt.savefig(output_file, dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"[报告] 稳定性图表已生成: {output_file}")
        return output_file
    
    def generate_html_report(self):
        """生成 HTML 报告"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # 收集关键指标
        latency_summary = self._get_latency_summary()
        throughput_summary = self._get_throughput_summary()
        stability_summary = self._get_stability_summary()
        resource_summary = self._get_resource_summary()
        
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MOSS-TTS 性能测试报告</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2c3e50;
            text-align: center;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
            border-left: 4px solid #3498db;
            padding-left: 15px;
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }}
        .summary-card {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }}
        .summary-card h3 {{
            margin: 0 0 10px 0;
            font-size: 14px;
            opacity: 0.9;
        }}
        .summary-card .value {{
            font-size: 28px;
            font-weight: bold;
        }}
        .chart-container {{
            margin: 30px 0;
            text-align: center;
        }}
        .chart-container img {{
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #3498db;
            color: white;
        }}
        tr:hover {{
            background-color: #f5f5f5;
        }}
        .status-good {{
            color: #27ae60;
            font-weight: bold;
        }}
        .status-warning {{
            color: #f39c12;
            font-weight: bold;
        }}
        .status-bad {{
            color: #e74c3c;
            font-weight: bold;
        }}
        .footer {{
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #7f8c8d;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>MOSS-TTS 服务器性能测试报告</h1>
        <p style="text-align: center; color: #7f8c8d;">生成时间: {timestamp}</p>
        
        <h2>关键指标摘要</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <h3>平均响应时间</h3>
                <div class="value">{latency_summary.get('avg', 'N/A')}s</div>
            </div>
            <div class="summary-card">
                <h3>峰值 RPS</h3>
                <div class="value">{throughput_summary.get('max_rps', 'N/A')}</div>
            </div>
            <div class="summary-card">
                <h3>成功率</h3>
                <div class="value">{stability_summary.get('success_rate', 'N/A')}%</div>
            </div>
            <div class="summary-card">
                <h3>GPU 显存峰值</h3>
                <div class="value">{resource_summary.get('gpu_memory_max', 'N/A')}MB</div>
            </div>
        </div>
        
        <h2>响应时间分析</h2>
        <div class="chart-container">
            <img src="latency_analysis.png" alt="响应时间分析">
        </div>
        
        <h2>吞吐量与并发性能</h2>
        <div class="chart-container">
            <img src="throughput_analysis.png" alt="吞吐量分析">
        </div>
        
        <h2>资源使用情况</h2>
        <div class="chart-container">
            <img src="resource_usage.png" alt="资源使用">
        </div>
        
        <h2>稳定性测试</h2>
        <div class="chart-container">
            <img src="stability_analysis.png" alt="稳定性分析">
        </div>
        
        <h2>性能瓶颈分析</h2>
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">发现的性能瓶颈：</h3>
            <ul>
                <li><strong>模型推理延迟：</strong>TTS 生成主要耗时在模型推理阶段，这是主要的性能瓶颈</li>
                <li><strong>GPU 利用率：</strong>监控期间 GPU 平均使用率为 {resource_summary.get('gpu_utilization_avg', 'N/A')}%</li>
                <li><strong>并发限制：</strong>随着并发数增加，响应时间呈线性增长</li>
            </ul>
            
            <h3>优化建议：</h3>
            <ol>
                <li><strong>模型量化：</strong>使用 INT8 量化减少显存占用和推理时间</li>
                <li><strong>批处理：</strong>支持多文本批量推理，提高 GPU 利用率</li>
                <li><strong>缓存机制：</strong>对常见文本进行结果缓存</li>
                <li><strong>异步处理：</strong>使用异步 I/O 减少等待时间</li>
                <li><strong>负载均衡：</strong>部署多个 TTS 实例分担负载</li>
            </ol>
        </div>
        
        <div class="footer">
            <p>MOSS-TTS 性能测试报告 | 生成时间: {timestamp}</p>
        </div>
    </div>
</body>
</html>"""
        
        output_file = self.report_dir / 'performance_report.html'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"[报告] HTML 报告已生成: {output_file}")
        return output_file
    
    def _get_latency_summary(self) -> Dict:
        """获取延迟测试摘要"""
        if 'latency' not in self.data or not self.data['latency']:
            return {}
        
        all_avgs = []
        for text_type, data in self.data['latency'].items():
            avg = data['stats'].get('avg_response_time', 0)
            all_avgs.append(avg)
        
        return {'avg': f"{sum(all_avgs)/len(all_avgs):.2f}" if all_avgs else 'N/A'}
    
    def _get_throughput_summary(self) -> Dict:
        """获取吞吐量测试摘要"""
        if 'concurrency' not in self.data or not self.data['concurrency']:
            return {}
        
        max_rps = max([d['rps'] for d in self.data['concurrency']])
        return {'max_rps': f"{max_rps:.2f}"}
    
    def _get_stability_summary(self) -> Dict:
        """获取稳定性测试摘要"""
        if 'stability' not in self.data or not self.data['stability']:
            return {}
        
        stats = self.data['stability']['stats']
        return {'success_rate': f"{stats.get('success_rate', 0):.1f}"}
    
    def _get_resource_summary(self) -> Dict:
        """获取资源使用摘要"""
        if 'resources' not in self.data or not self.data['resources']:
            return {}
        
        resources = self.data['resources']
        summary = {}
        
        if 'gpu_memory_used' in resources[0]:
            gpu_mems = [float(r['gpu_memory_used']) for r in resources if 'gpu_memory_used' in r]
            summary['gpu_memory_max'] = f"{max(gpu_mems):.0f}" if gpu_mems else 'N/A'
        
        if 'gpu_utilization' in resources[0]:
            gpu_utils = [float(r['gpu_utilization']) for r in resources if 'gpu_utilization' in r]
            summary['gpu_utilization_avg'] = f"{sum(gpu_utils)/len(gpu_utils):.1f}" if gpu_utils else 'N/A'
        
        return summary
    
    def generate_all_reports(self):
        """生成所有报告"""
        print("\n" + "="*60)
        print("开始生成性能测试报告")
        print("="*60)
        
        # 加载数据
        self.load_all_data()
        
        # 生成图表
        self.generate_latency_chart()
        self.generate_throughput_chart()
        self.generate_resource_chart()
        self.generate_stability_chart()
        
        # 生成 HTML 报告
        self.generate_html_report()
        
        print("\n" + "="*60)
        print("报告生成完成！")
        print(f"报告目录: {self.report_dir}")
        print("="*60)


def main():
    """主函数"""
    generator = ReportGenerator()
    generator.generate_all_reports()


if __name__ == "__main__":
    main()
