#!/usr/bin/env python3
"""
高级 Demo：DeepSeek LLM + 异步管道 + HTTP TTS
支持复杂内容（表格、代码），保存所有输出
"""

import os
import sys
import time
import json
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent / 'core'))
sys.path.insert(0, str(Path(__file__).parent.parent / 'utils'))

from async_pipeline_fixed import AsyncTTSPipelineFixed
from tts_client import TTSClient
from deepseek_llm import deepseek_chat
from text_processor import TextCleaner


def save_outputs(output_dir: Path, original_text: str, processed_segments: list, audio_info: list):
    """保存所有输出到文件"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # 1. 保存原始 LLM 输出
    original_file = output_dir / f"original_{timestamp}.txt"
    with open(original_file, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("原始 LLM 输出\n")
        f.write("=" * 70 + "\n\n")
        f.write(original_text)
    print(f"  [保存] 原始输出: {original_file}")
    
    # 2. 保存处理后的文本段
    processed_file = output_dir / f"processed_{timestamp}.json"
    processed_data = {
        "timestamp": timestamp,
        "total_segments": len(processed_segments),
        "segments": [
            {
                "index": idx,
                "text": text,
                "length": len(text)
            }
            for idx, text in processed_segments
        ]
    }
    with open(processed_file, 'w', encoding='utf-8') as f:
        json.dump(processed_data, f, ensure_ascii=False, indent=2)
    print(f"  [保存] 处理后文本: {processed_file}")
    
    # 3. 保存音频信息
    audio_info_file = output_dir / f"audio_info_{timestamp}.json"
    audio_data = {
        "timestamp": timestamp,
        "total_audio": len(audio_info),
        "audios": [
            {
                "index": idx,
                "size_bytes": size,
                "size_kb": round(size / 1024, 2)
            }
            for idx, size in audio_info
        ]
    }
    with open(audio_info_file, 'w', encoding='utf-8') as f:
        json.dump(audio_data, f, indent=2)
    print(f"  [保存] 音频信息: {audio_info_file}")
    
    return original_file, processed_file, audio_info_file


def demo_complex_content():
    """测试复杂内容（表格、代码）"""
    print("=" * 70)
    print("高级 Demo：复杂内容处理（表格、代码）")
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
        return 1
    
    # 创建输出目录
    output_dir = Path("./demo_outputs")
    output_dir.mkdir(exist_ok=True)
    
    # TTS 适配器
    def tts_adapter(text: str, output_path: str) -> bool:
        try:
            result = tts_client.synthesize(text, output_file=output_path)
            return result.success
        except Exception as e:
            print(f"  [TTS 错误] {e}")
            return False
    
    # 创建管道
    pipeline = AsyncTTSPipelineFixed(
        tts_func=tts_adapter,
        max_workers=2,
        queue_size=5,
        min_chunk_size=30,
        max_chunk_size=150,
        output_dir=str(output_dir / "audio")
    )
    
    # 数据收集
    text_segments = []
    audio_segments = []
    original_chunks = []
    
    def on_text(text: str, index: int):
        text_segments.append((index, text))
        print(f"  [文本段 {index}] {text[:50]}...")
    
    def on_audio(audio_data: bytes, index: int):
        audio_segments.append((index, len(audio_data)))
        print(f"  [音频 {index}] 就绪，{len(audio_data)} bytes")
    
    pipeline.on_text_segment = on_text
    pipeline.on_audio_ready = on_audio
    
    # 启动管道
    print("\n[启动] 初始化管道...")
    pipeline.start()
    
    # 测试 1：表格内容
    print("\n" + "=" * 70)
    print("测试 1：生成表格内容")
    print("=" * 70)
    
    messages_table = [
        {"role": "system", "content": "你是一个助手，请用表格形式列出数据，然后用几句话总结。"},
        {"role": "user", "content": "请列出三种编程语言的特点对比，用表格形式，然后总结每种语言适合的场景。"}
    ]
    
    llm_start = time.time()
    original_text = ""
    
    def on_llm_chunk(chunk: str):
        if chunk.strip():
            original_chunks.append(chunk)
            print(f"\n[LLM 输出] {chunk.strip()[:50]}...")
            pipeline.feed_text(chunk)
    
    try:
        result = deepseek_chat(
            messages=messages_table,
            temperature=0.7,
            max_tokens=500,
            stream=True,
            on_chunk=on_llm_chunk
        )
        
        if not result.get("success"):
            print(f"\n[错误] LLM 调用失败: {result.get('error')}")
            return 1
        
        original_text = result.get('content', '')
        print(f"\n[OK] LLM 响应完成")
        print(f"\n完整回复:\n{original_text}")
        
    except Exception as e:
        print(f"\n[错误] {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # 等待 TTS
    print("\n[等待] 等待 TTS 合成...")
    time.sleep(10)
    
    # 收集音频
    while True:
        seg = pipeline.get_audio(timeout=2.0)
        if seg is None:
            break
    
    # 停止管道
    pipeline.stop()
    
    # 保存输出
    print("\n[保存] 保存所有输出...")
    files = save_outputs(output_dir, original_text, text_segments, audio_segments)
    
    # 统计
    total_time = time.time() - llm_start
    stats = pipeline.get_stats()
    
    print("\n" + "=" * 70)
    print("测试结果汇总")
    print("=" * 70)
    print(f"\n[统计]")
    print(f"  总耗时: {total_time:.2f}s")
    print(f"  原始文本长度: {len(original_text)} 字符")
    print(f"  处理文本段: {stats['text_segments']}")
    print(f"  成功音频: {stats['audio_segments']}")
    
    print(f"\n[文本段详情]")
    for idx, text in text_segments:
        print(f"  段 {idx}: {len(text)} 字符 - {text[:60]}...")
    
    print(f"\n[生成的文件]")
    for f in files:
        print(f"  - {f.name}")
    
    # 列出音频文件
    audio_dir = output_dir / "audio"
    if audio_dir.exists():
        wav_files = list(audio_dir.glob("*.wav"))
        if wav_files:
            print(f"\n[音频文件] {len(wav_files)} 个:")
            for f in sorted(wav_files):
                size_kb = f.stat().st_size / 1024
                print(f"  - {f.name} ({size_kb:.1f} KB)")
    
    print("\n" + "=" * 70)
    print("测试完成！")
    print("=" * 70)
    
    return 0


def demo_code_content():
    """测试代码内容"""
    print("\n" + "=" * 70)
    print("测试 2：生成代码示例")
    print("=" * 70)
    
    output_dir = Path("./demo_outputs")
    output_dir.mkdir(exist_ok=True)
    
    messages_code = [
        {"role": "system", "content": "你是一个编程助手，请用代码示例说明概念，然后解释代码。"},
        {"role": "user", "content": "请写一个 Python 函数计算斐波那契数列，并解释代码的每个部分。"}
    ]
    
    try:
        result = deepseek_chat(
            messages=messages_code,
            temperature=0.7,
            max_tokens=600,
            stream=False
        )
        
        if result.get("success"):
            code_content = result.get('content', '')
            print(f"\n生成的代码:\n{code_content}")
            
            # 保存代码
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            code_file = output_dir / f"code_example_{timestamp}.py"
            with open(code_file, 'w', encoding='utf-8') as f:
                f.write(code_content)
            print(f"\n[保存] 代码文件: {code_file}")
        else:
            print(f"[错误] {result.get('error')}")
            
    except Exception as e:
        print(f"[错误] {e}")
    
    return 0


if __name__ == "__main__":
    # 运行测试 1：表格内容
    result1 = demo_complex_content()
    
    # 运行测试 2：代码内容（可选）
    # result2 = demo_code_content()
    
    sys.exit(result1)
