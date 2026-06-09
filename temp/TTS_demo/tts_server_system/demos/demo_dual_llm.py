#!/usr/bin/env python3
"""
双LLM Pipeline 演示程序

架构:
    用户输入 → LLM1(DeepSeek生成) → LLM2(DeepSeek清洗) → TTS → 音频输出

功能:
    1. 对比单LLM和双LLM效果
    2. 测试表格、代码、Markdown处理
    3. 保存中间结果
    4. 自然语言读代码测试（含音频计时和流畅度判断）
"""

import os
import sys
import time
import json
import wave
import contextlib
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

sys.path.insert(0, str(Path(__file__).parent.parent / 'core'))
sys.path.insert(0, str(Path(__file__).parent.parent / 'utils'))

from dual_llm_pipeline import DualLLMStreamingPipeline, create_default_pipeline
from tts_client import TTSClient
from text_processor import TextCleaner


@dataclass
class AudioTimingInfo:
    """音频计时信息"""
    segment_index: int
    start_time: float
    end_time: float
    duration: float
    file_path: str
    file_size: int


@dataclass
class FlowAnalysisResult:
    """流畅度分析结果"""
    first_audio_latency: float
    audio_segments: List[AudioTimingInfo]
    gaps_between_audio: List[float]
    smooth_connections: List[bool]
    overall_smooth: bool


def get_audio_duration(file_path: str) -> float:
    """获取音频文件时长（秒）"""
    try:
        with contextlib.closing(wave.open(file_path, 'r')) as f:
            frames = f.getnframes()
            rate = f.getframerate()
            return frames / float(rate)
    except Exception as e:
        print(f"  [警告] 无法读取音频时长: {e}")
        return 0.0


def analyze_audio_flow(
    audio_files: List[Path],
    request_start_time: float,
    audio_ready_times: List[float]
) -> FlowAnalysisResult:
    """
    分析音频流畅度
    
    规则:
    - 第一个音频输出耗时: 从发送请求到第一个音频就绪
    - 音频间隔: 连续音频输出之间的时间差
    - 流畅度判断: 当音频持续时间 > 音频输出间隔时，判定为"丝滑连接"
    """
    if not audio_files or not audio_ready_times:
        return FlowAnalysisResult(
            first_audio_latency=0.0,
            audio_segments=[],
            gaps_between_audio=[],
            smooth_connections=[],
            overall_smooth=False
        )
    
    audio_segments = []
    for i, (file_path, ready_time) in enumerate(zip(audio_files, audio_ready_times)):
        duration = get_audio_duration(str(file_path))
        file_size = file_path.stat().st_size if file_path.exists() else 0
        
        audio_segments.append(AudioTimingInfo(
            segment_index=i,
            start_time=ready_time - duration if duration > 0 else ready_time,
            end_time=ready_time,
            duration=duration,
            file_path=str(file_path),
            file_size=file_size
        ))
    
    # 计算第一个音频输出耗时
    first_audio_latency = audio_ready_times[0] - request_start_time
    
    # 计算音频间隔
    gaps_between_audio = []
    smooth_connections = []
    
    for i in range(1, len(audio_segments)):
        prev_audio = audio_segments[i-1]
        curr_audio = audio_segments[i]
        
        # 音频间隔 = 当前音频开始时间 - 上一个音频结束时间
        gap = curr_audio.start_time - prev_audio.end_time
        gaps_between_audio.append(gap)
        
        # 流畅度判断: 音频持续时间 > 音频间隔 = 丝滑连接
        is_smooth = prev_audio.duration > gap if gap > 0 else True
        smooth_connections.append(is_smooth)
    
    # 整体流畅度: 所有连接都丝滑
    overall_smooth = all(smooth_connections) if smooth_connections else True
    
    return FlowAnalysisResult(
        first_audio_latency=first_audio_latency,
        audio_segments=audio_segments,
        gaps_between_audio=gaps_between_audio,
        smooth_connections=smooth_connections,
        overall_smooth=overall_smooth
    )


def print_flow_analysis(result: FlowAnalysisResult):
    """打印流畅度分析结果"""
    print("\n" + "=" * 70)
    print("音频流畅度分析")
    print("=" * 70)
    
    print(f"\n[首音频输出耗时] {result.first_audio_latency:.2f}s")
    
    print(f"\n[音频段详情] 共 {len(result.audio_segments)} 段")
    for seg in result.audio_segments:
        print(f"  段 {seg.segment_index}:")
        print(f"    文件: {Path(seg.file_path).name}")
        print(f"    时长: {seg.duration:.2f}s")
        print(f"    大小: {seg.file_size / 1024:.1f} KB")
    
    if result.gaps_between_audio:
        print(f"\n[音频间隔分析]")
        for i, (gap, is_smooth) in enumerate(zip(result.gaps_between_audio, result.smooth_connections)):
            status = "[OK] 丝滑连接" if is_smooth else "[X] 存在卡顿"
            print(f"  段 {i} → 段 {i+1}: 间隔 {gap:.2f}s [{status}]")
    
    print(f"\n[整体流畅度] {'[OK] 丝滑流畅' if result.overall_smooth else '[X] 存在卡顿'}")


def save_flow_analysis(
    output_dir: Path,
    test_name: str,
    result: FlowAnalysisResult,
    llm1_content: str,
    llm2_content: str
):
    """保存流畅度分析结果"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    analysis_data = {
        "timestamp": timestamp,
        "test_name": test_name,
        "first_audio_latency": result.first_audio_latency,
        "overall_smooth": result.overall_smooth,
        "audio_segments": [
            {
                "index": seg.segment_index,
                "file_path": seg.file_path,
                "duration": seg.duration,
                "file_size_kb": seg.file_size / 1024
            }
            for seg in result.audio_segments
        ],
        "gaps_between_audio": result.gaps_between_audio,
        "smooth_connections": result.smooth_connections,
        "llm1_content": llm1_content,
        "llm2_content": llm2_content
    }
    
    output_file = output_dir / f"flow_analysis_{test_name}_{timestamp}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(analysis_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n[保存] 流畅度分析: {output_file}")
    return output_file


def save_comparison(
    output_dir: Path,
    test_name: str,
    single_result: dict,
    dual_result: dict
):
    """保存单LLM和双LLM对比结果"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    comparison = {
        "timestamp": timestamp,
        "test_name": test_name,
        "single_llm": {
            "success": single_result.get("success"),
            "content_length": len(single_result.get("content", "")),
            "content_preview": single_result.get("content", "")[:200] + "..." if len(single_result.get("content", "")) > 200 else single_result.get("content", "")
        },
        "dual_llm": {
            "success": dual_result.get("success"),
            "llm1_content_length": len(dual_result.get("llm1_content", "")),
            "llm2_content_length": len(dual_result.get("llm2_content", "")),
            "llm1_preview": dual_result.get("llm1_content", "")[:200] + "..." if len(dual_result.get("llm1_content", "")) > 200 else dual_result.get("llm1_content", ""),
            "llm2_preview": dual_result.get("llm2_content", "")[:200] + "..." if len(dual_result.get("llm2_content", "")) > 200 else dual_result.get("llm2_content", "")
        }
    }
    
    output_file = output_dir / f"comparison_{test_name}_{timestamp}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(comparison, f, ensure_ascii=False, indent=2)
    
    print(f"  [保存] 对比结果: {output_file}")
    return output_file


def demo_table_content():
    """测试表格内容处理"""
    print("\n" + "=" * 70)
    print("测试 1: 表格内容处理")
    print("=" * 70)
    
    # 检查 API Key
    if not os.environ.get("DEEPSEEK_API_KEY"):
        print("\n[错误] 未设置 DEEPSEEK_API_KEY 环境变量")
        return 1
    
    # 连接到 TTS 服务
    try:
        tts_client = TTSClient(host="127.0.0.1", port=8080)
        print("\n[OK] 已连接到 TTS HTTP 服务")
    except ConnectionError as e:
        print(f"\n[FAIL] 连接 TTS 服务失败: {e}")
        print("请先启动 TTS 服务: python tts_server.py")
        return 1
    
    # 创建输出目录
    output_dir = Path("./demo_outputs")
    output_dir.mkdir(exist_ok=True)
    
    # TTS适配器
    def tts_adapter(text: str, output_path: str) -> bool:
        try:
            result = tts_client.synthesize(text, output_file=output_path)
            return result.success
        except Exception as e:
            print(f"  [TTS 错误] {e}")
            return False
    
    # 测试消息 - 生成表格
    messages = [
        {"role": "system", "content": "你是一个助手，请用表格形式列出数据，然后用几句话总结。"},
        {"role": "user", "content": "请列出三种编程语言的特点对比，用表格形式，然后总结每种语言适合的场景。"}
    ]
    
    print("\n[测试] 双LLM Pipeline 处理表格内容...")
    
    # 创建双LLM Pipeline
    pipeline = create_default_pipeline(
        tts_func=tts_adapter,
        output_dir=str(output_dir / "dual_llm_audio"),
        enable_llm2=True
    )
    
    # 处理
    result = pipeline.process_with_tts(
        messages=messages,
        output_prefix="table_test",
        llm1_temperature=0.7,
        llm1_max_tokens=800,
        llm2_temperature=0.3,
        llm2_max_tokens=1000
    )
    
    if not result.success:
        print(f"\n[错误] 处理失败: {result.error}")
        return 1
    
    # 保存详细结果
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 保存LLM1原始输出
    llm1_file = output_dir / f"llm1_original_{timestamp}.txt"
    with open(llm1_file, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("LLM1 原始输出 (含Markdown/表格)\n")
        f.write("=" * 70 + "\n\n")
        f.write(result.llm1_content)
    print(f"\n[保存] LLM1原始输出: {llm1_file}")
    
    # 保存LLM2清洗后输出
    llm2_file = output_dir / f"llm2_cleaned_{timestamp}.txt"
    with open(llm2_file, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("LLM2 清洗后输出 (适合TTS)\n")
        f.write("=" * 70 + "\n\n")
        f.write(result.llm2_content)
    print(f"[保存] LLM2清洗输出: {llm2_file}")
    
    # 打印对比
    print("\n" + "=" * 70)
    print("内容对比")
    print("=" * 70)
    print(f"\n[LLM1 原始输出 - {len(result.llm1_content)} 字符]")
    print("-" * 70)
    print(result.llm1_content[:300] + "..." if len(result.llm1_content) > 300 else result.llm1_content)
    
    print(f"\n[LLM2 清洗后 - {len(result.llm2_content)} 字符]")
    print("-" * 70)
    print(result.llm2_content[:300] + "..." if len(result.llm2_content) > 300 else result.llm2_content)
    
    # 列出音频文件
    audio_dir = output_dir / "dual_llm_audio"
    if audio_dir.exists():
        wav_files = sorted(audio_dir.glob("*.wav"))
        if wav_files:
            print(f"\n[音频文件] {len(wav_files)} 个:")
            for f in wav_files:
                size_kb = f.stat().st_size / 1024
                print(f"  - {f.name} ({size_kb:.1f} KB)")
    
    print("\n" + "=" * 70)
    print("表格内容测试完成!")
    print("=" * 70)
    
    return 0


def demo_code_content():
    """测试代码内容处理"""
    print("\n" + "=" * 70)
    print("测试 2: 代码内容处理")
    print("=" * 70)
    
    if not os.environ.get("DEEPSEEK_API_KEY"):
        print("\n[错误] 未设置 DEEPSEEK_API_KEY 环境变量")
        return 1
    
    try:
        tts_client = TTSClient(host="127.0.0.1", port=8080)
        print("\n[OK] 已连接到 TTS HTTP 服务")
    except ConnectionError as e:
        print(f"\n[FAIL] 连接 TTS 服务失败: {e}")
        return 1
    
    output_dir = Path("./demo_outputs")
    output_dir.mkdir(exist_ok=True)
    
    def tts_adapter(text: str, output_path: str) -> bool:
        try:
            result = tts_client.synthesize(text, output_file=output_path)
            return result.success
        except Exception as e:
            print(f"  [TTS 错误] {e}")
            return False
    
    # 测试消息 - 生成代码
    messages = [
        {"role": "system", "content": "你是一个编程助手，请用代码示例说明概念，然后解释代码。"},
        {"role": "user", "content": "请写一个 Python 函数计算斐波那契数列，并解释代码的每个部分。"}
    ]
    
    print("\n[测试] 双LLM Pipeline 处理代码内容...")
    
    pipeline = create_default_pipeline(
        tts_func=tts_adapter,
        output_dir=str(output_dir / "code_audio"),
        enable_llm2=True
    )
    
    result = pipeline.process_with_tts(
        messages=messages,
        output_prefix="code_test",
        llm1_temperature=0.7,
        llm1_max_tokens=800,
        llm2_temperature=0.3,
        llm2_max_tokens=1000
    )
    
    if not result.success:
        print(f"\n[错误] 处理失败: {result.error}")
        return 1
    
    # 保存结果
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    llm1_file = output_dir / f"code_llm1_{timestamp}.txt"
    with open(llm1_file, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("LLM1 原始输出 (含代码块)\n")
        f.write("=" * 70 + "\n\n")
        f.write(result.llm1_content)
    print(f"\n[保存] LLM1原始输出: {llm1_file}")
    
    llm2_file = output_dir / f"code_llm2_{timestamp}.txt"
    with open(llm2_file, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("LLM2 清洗后输出 (代码转为描述)\n")
        f.write("=" * 70 + "\n\n")
        f.write(result.llm2_content)
    print(f"[保存] LLM2清洗输出: {llm2_file}")
    
    # 打印对比
    print("\n" + "=" * 70)
    print("内容对比")
    print("=" * 70)
    print(f"\n[LLM1 原始输出 - {len(result.llm1_content)} 字符]")
    print("-" * 70)
    print(result.llm1_content[:400] + "..." if len(result.llm1_content) > 400 else result.llm1_content)
    
    print(f"\n[LLM2 清洗后 - {len(result.llm2_content)} 字符]")
    print("-" * 70)
    print(result.llm2_content[:400] + "..." if len(result.llm2_content) > 400 else result.llm2_content)
    
    print("\n" + "=" * 70)
    print("代码内容测试完成!")
    print("=" * 70)
    
    return 0


def demo_comparison():
    """对比单LLM和双LLM效果"""
    print("\n" + "=" * 70)
    print("测试 3: 单LLM vs 双LLM 对比")
    print("=" * 70)
    
    if not os.environ.get("DEEPSEEK_API_KEY"):
        print("\n[错误] 未设置 DEEPSEEK_API_KEY 环境变量")
        return 1
    
    try:
        tts_client = TTSClient(host="127.0.0.1", port=8080)
        print("\n[OK] 已连接到 TTS HTTP 服务")
    except ConnectionError as e:
        print(f"\n[FAIL] 连接 TTS 服务失败: {e}")
        return 1
    
    output_dir = Path("./demo_outputs")
    output_dir.mkdir(exist_ok=True)
    
    def tts_adapter(text: str, output_path: str) -> bool:
        try:
            result = tts_client.synthesize(text, output_file=output_path)
            return result.success
        except Exception as e:
            return False
    
    # 测试消息
    messages = [
        {"role": "user", "content": "请用Markdown格式介绍Python的三个主要特点，用列表和加粗强调。"}
    ]
    
    print("\n[对比测试] 相同输入，对比单LLM和双LLM输出...")
    
    # 单LLM（跳过LLM2清洗）
    print("\n[1/2] 单LLM处理（无清洗）...")
    pipeline_single = create_default_pipeline(
        tts_func=tts_adapter,
        output_dir=str(output_dir / "single_llm_audio"),
        enable_llm2=False
    )
    
    result_single = pipeline_single.process_with_tts(
        messages=messages,
        llm1_temperature=0.7,
        llm1_max_tokens=500
    )
    
    # 双LLM
    print("\n[2/2] 双LLM处理（带清洗）...")
    pipeline_dual = create_default_pipeline(
        tts_func=tts_adapter,
        output_dir=str(output_dir / "dual_llm_audio"),
        enable_llm2=True
    )
    
    result_dual = pipeline_dual.process_with_tts(
        messages=messages,
        llm1_temperature=0.7,
        llm1_max_tokens=500,
        llm2_temperature=0.3,
        llm2_max_tokens=800
    )
    
    # 保存对比
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    comparison_file = output_dir / f"comparison_{timestamp}.txt"
    with open(comparison_file, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("单LLM vs 双LLM 对比\n")
        f.write("=" * 70 + "\n\n")
        
        f.write("[输入消息]\n")
        f.write(f"{messages}\n\n")
        
        f.write("=" * 70 + "\n")
        f.write("单LLM输出（直接用于TTS）\n")
        f.write("=" * 70 + "\n")
        f.write(result_single.llm1_content if result_single.success else f"失败: {result_single.error}")
        f.write("\n\n")
        
        f.write("=" * 70 + "\n")
        f.write("双LLM输出（LLM2清洗后用于TTS）\n")
        f.write("=" * 70 + "\n")
        if result_dual.success:
            f.write(f"\n[LLM1原始]\n{result_dual.llm1_content}\n\n")
            f.write(f"[LLM2清洗后]\n{result_dual.llm2_content}")
        else:
            f.write(f"失败: {result_dual.error}")
    
    print(f"\n[保存] 对比结果: {comparison_file}")
    
    # 打印对比
    print("\n" + "=" * 70)
    print("对比结果")
    print("=" * 70)
    
    print("\n[单LLM 输出]")
    print("-" * 70)
    print(result_single.llm1_content[:300] + "..." if len(result_single.llm1_content) > 300 else result_single.llm1_content)
    
    print("\n[双LLM - LLM1原始]")
    print("-" * 70)
    print(result_dual.llm1_content[:300] + "..." if len(result_dual.llm1_content) > 300 else result_dual.llm1_content)
    
    print("\n[双LLM - LLM2清洗后]")
    print("-" * 70)
    print(result_dual.llm2_content[:300] + "..." if len(result_dual.llm2_content) > 300 else result_dual.llm2_content)
    
    print("\n" + "=" * 70)
    print("对比测试完成!")
    print("=" * 70)
    
    return 0


def demo_simple():
    """简单快速测试"""
    print("\n" + "=" * 70)
    print("快速测试: 双LLM Pipeline")
    print("=" * 70)
    
    if not os.environ.get("DEEPSEEK_API_KEY"):
        print("\n[错误] 未设置 DEEPSEEK_API_KEY 环境变量")
        print("示例: $env:DEEPSEEK_API_KEY='your-api-key' (PowerShell)")
        return 1
    
    try:
        tts_client = TTSClient(host="127.0.0.1", port=8080)
        print("\n[OK] 已连接到 TTS HTTP 服务")
    except ConnectionError as e:
        print(f"\n[FAIL] 连接 TTS 服务失败: {e}")
        print("请先启动 TTS 服务: python tts_server.py")
        return 1
    
    output_dir = Path("./demo_outputs")
    output_dir.mkdir(exist_ok=True)
    
    def tts_adapter(text: str, output_path: str) -> bool:
        try:
            result = tts_client.synthesize(text, output_file=output_path)
            return result.success
        except Exception as e:
            print(f"  [TTS 错误] {e}")
            return False
    
    # 简单测试
    messages = [
        {"role": "user", "content": "你好，请用一句话介绍自己。"}
    ]
    
    print("\n[测试] 简单对话...")
    
    pipeline = create_default_pipeline(
        tts_func=tts_adapter,
        output_dir=str(output_dir / "simple_audio"),
        enable_llm2=True
    )
    
    result = pipeline.process_with_tts(
        messages=messages,
        llm1_temperature=0.7,
        llm1_max_tokens=100,
        llm2_temperature=0.3,
        llm2_max_tokens=200
    )
    
    if result.success:
        print("\n[成功] 处理完成!")
        print(f"  LLM1输出: {result.llm1_content}")
        print(f"  LLM2输出: {result.llm2_content}")
        return 0
    else:
        print(f"\n[失败] {result.error}")
        return 1


def demo_code_reading_with_timing():
    """
    自然语言读代码测试（含音频计时和流畅度判断）
    
    测试3段不同长度的代码样本：
    1. 短代码：简单的斐波那契函数
    2. 中代码：带异常处理的文件操作类
    3. 长代码：包含多个功能的完整模块
    """
    print("\n" + "=" * 70)
    print("自然语言读代码测试（含音频计时和流畅度判断）")
    print("=" * 70)
    
    if not os.environ.get("DEEPSEEK_API_KEY"):
        print("\n[错误] 未设置 DEEPSEEK_API_KEY 环境变量")
        return 1
    
    try:
        tts_client = TTSClient(host="127.0.0.1", port=8080)
        print("\n[OK] 已连接到 TTS HTTP 服务")
    except ConnectionError as e:
        print(f"\n[FAIL] 连接 TTS 服务失败: {e}")
        return 1
    
    output_dir = Path("./demo_outputs")
    output_dir.mkdir(exist_ok=True)
    
    # 3段不同长度的代码测试用例
    code_tests = [
        {
            "name": "短代码_斐波那契",
            "description": "简单函数（约50行）",
            "messages": [
                {"role": "system", "content": "你是一个编程助手，请写一个简短的Python函数，然后用自然语言解释代码的功能。"},
                {"role": "user", "content": "请写一个计算斐波那契数列的Python函数，要求包含递归和迭代两种实现，并解释它们的区别。"}
            ],
            "max_tokens": 600
        },
        {
            "name": "中代码_文件处理类",
            "description": "带异常处理的类（约100行）",
            "messages": [
                {"role": "system", "content": "你是一个编程助手，请写一个Python类，包含多个方法和异常处理，然后用自然语言详细解释代码的结构和功能。"},
                {"role": "user", "content": "请写一个Python类实现配置文件管理，支持读取JSON/YAML格式，包含异常处理、日志记录和类型检查，并详细解释每个方法的功能。"}
            ],
            "max_tokens": 1000
        },
        {
            "name": "长代码_完整模块",
            "description": "多功能的完整模块（约150行）",
            "messages": [
                {"role": "system", "content": "你是一个编程助手，请写一个完整的Python模块，包含多个类、函数和工具方法，然后用自然语言详细解释整个模块的架构和功能。"},
                {"role": "user", "content": "请写一个完整的数据库连接池模块，包含连接池管理、查询执行、事务处理和性能监控功能，使用上下文管理器，并详细解释整个模块的设计思路和关键实现。"}
            ],
            "max_tokens": 1500
        }
    ]
    
    all_results = []
    
    for i, test_case in enumerate(code_tests, 1):
        print(f"\n{'=' * 70}")
        print(f"测试 {i}/3: {test_case['name']} ({test_case['description']})")
        print(f"{'=' * 70}")
        
        # 创建专用输出目录
        test_output_dir = output_dir / f"code_test_{test_case['name']}"
        test_output_dir.mkdir(exist_ok=True)
        audio_output_dir = test_output_dir / "audio"
        audio_output_dir.mkdir(exist_ok=True)
        
        # 计时数据收集
        request_start_time = time.time()
        audio_ready_times = []
        audio_files = []
        
        def tts_adapter_with_timing(text: str, output_path: str) -> bool:
            """带计时的TTS适配器"""
            try:
                result = tts_client.synthesize(text, output_file=output_path)
                if result.success:
                    # 记录音频就绪时间
                    ready_time = time.time()
                    audio_ready_times.append(ready_time)
                    audio_files.append(Path(output_path))
                return result.success
            except Exception as e:
                print(f"  [TTS 错误] {e}")
                return False
        
        # 创建Pipeline
        pipeline = create_default_pipeline(
            tts_func=tts_adapter_with_timing,
            output_dir=str(audio_output_dir),
            enable_llm2=True
        )
        
        # 处理
        print(f"\n[处理] {test_case['name']}...")
        result = pipeline.process_with_tts(
            messages=test_case['messages'],
            output_prefix=test_case['name'],
            llm1_temperature=0.7,
            llm1_max_tokens=test_case['max_tokens'],
            llm2_temperature=0.3,
            llm2_max_tokens=test_case['max_tokens'] + 200
        )
        
        if not result.success:
            print(f"\n[错误] 处理失败: {result.error}")
            continue
        
        # 等待所有音频生成完成
        print("\n[等待] 等待音频生成完成...")
        time.sleep(5)
        
        # 分析音频流畅度
        print("\n[分析] 分析音频流畅度...")
        flow_result = analyze_audio_flow(audio_files, request_start_time, audio_ready_times)
        
        # 打印分析结果
        print_flow_analysis(flow_result)
        
        # 保存结果
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 保存LLM输出
        llm1_file = test_output_dir / f"llm1_original_{timestamp}.txt"
        with open(llm1_file, 'w', encoding='utf-8') as f:
            f.write(f"{'=' * 70}\n")
            f.write(f"测试: {test_case['name']}\n")
            f.write(f"LLM1 原始输出 (含代码)\n")
            f.write(f"{'=' * 70}\n\n")
            f.write(result.llm1_content)
        
        llm2_file = test_output_dir / f"llm2_cleaned_{timestamp}.txt"
        with open(llm2_file, 'w', encoding='utf-8') as f:
            f.write(f"{'=' * 70}\n")
            f.write(f"测试: {test_case['name']}\n")
            f.write(f"LLM2 清洗后输出 (适合TTS)\n")
            f.write(f"{'=' * 70}\n\n")
            f.write(result.llm2_content)
        
        # 保存流畅度分析
        flow_file = save_flow_analysis(
            test_output_dir,
            test_case['name'],
            flow_result,
            result.llm1_content,
            result.llm2_content
        )
        
        print(f"\n[保存] 测试结果保存到: {test_output_dir}")
        
        # 收集结果
        all_results.append({
            "test_name": test_case['name'],
            "success": True,
            "llm1_chars": len(result.llm1_content),
            "llm2_chars": len(result.llm2_content),
            "first_audio_latency": flow_result.first_audio_latency,
            "audio_segments": len(flow_result.audio_segments),
            "overall_smooth": flow_result.overall_smooth
        })
    
    # 打印汇总
    print("\n" + "=" * 70)
    print("自然语言读代码测试汇总")
    print("=" * 70)
    
    for result in all_results:
        print(f"\n{result['test_name']}:")
        print(f"  LLM1字符数: {result['llm1_chars']}")
        print(f"  LLM2字符数: {result['llm2_chars']}")
        print(f"  首音频耗时: {result['first_audio_latency']:.2f}s")
        print(f"  音频段数: {result['audio_segments']}")
        print(f"  流畅度: {'[OK] 丝滑' if result['overall_smooth'] else '[X] 卡顿'}")
    
    print("\n" + "=" * 70)
    print("自然语言读代码测试完成!")
    print("=" * 70)
    
    return 0


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='双LLM Pipeline 演示')
    parser.add_argument('--test', type=str, default='simple',
                       choices=['simple', 'table', 'code', 'comparison', 'code_reading', 'all'],
                       help='选择测试类型')
    args = parser.parse_args()
    
    if args.test == 'simple':
        sys.exit(demo_simple())
    elif args.test == 'table':
        sys.exit(demo_table_content())
    elif args.test == 'code':
        sys.exit(demo_code_content())
    elif args.test == 'comparison':
        sys.exit(demo_comparison())
    elif args.test == 'code_reading':
        sys.exit(demo_code_reading_with_timing())
    elif args.test == 'all':
        result = 0
        result |= demo_simple()
        result |= demo_table_content()
        result |= demo_code_content()
        result |= demo_comparison()
        result |= demo_code_reading_with_timing()
        sys.exit(result)
