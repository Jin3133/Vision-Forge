#!/usr/bin/env python3
"""
真实 DeepSeek LLM + 异步管道 + HTTP TTS 测试
"""

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'core'))
sys.path.insert(0, str(Path(__file__).parent.parent / 'utils'))

from async_pipeline_fixed import AsyncTTSPipelineFixed
from tts_client import TTSClient
from deepseek_llm import deepseek_chat


def test_real_llm_pipeline():
    """测试真实 LLM 流程"""
    print("=" * 70)
    print("真实 DeepSeek LLM + 异步管道 + HTTP TTS 测试")
    print("=" * 70)
    
    # 检查 API Key
    if not os.environ.get("DEEPSEEK_API_KEY"):
        print("\n[错误] 未设置 DEEPSEEK_API_KEY 环境变量")
        print("请先设置: $env:DEEPSEEK_API_KEY='your-api-key'")
        return 1
    
    # 连接到 TTS 服务
    try:
        tts_client = TTSClient(host="127.0.0.1", port=8080)
        print("\n[OK] 已连接到 TTS HTTP 服务")
    except ConnectionError as e:
        print(f"\n[FAIL] 连接 TTS 服务失败: {e}")
        return 1
    
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
        min_chunk_size=20,
        max_chunk_size=80,
        output_dir="./real_llm_output"
    )
    
    # 回调
    text_segments = []
    audio_segments = []
    
    def on_text(text: str, index: int):
        text_segments.append((index, text))
        print(f"  [文本 {index}] {text[:50]}...")
    
    def on_audio(audio_data: bytes, index: int):
        audio_segments.append((index, len(audio_data)))
        print(f"  [音频 {index}] 就绪，{len(audio_data)} bytes")
    
    pipeline.on_text_segment = on_text
    pipeline.on_audio_ready = on_audio
    
    # 启动管道
    print("\n[启动] 初始化管道...")
    pipeline.start()
    
    # 调用 DeepSeek LLM（流式输出）
    print("\n[LLM] 调用 DeepSeek API...")
    messages = [
        {"role": "system", "content": "你是一个简洁的助手，请用简短的话回答问题，每句话控制在30字以内。"},
        {"role": "user", "content": "请介绍人工智能的三个应用场景，每点一句话。"}
    ]
    
    llm_start = time.time()
    
    def on_llm_chunk(chunk: str):
        """处理 LLM 流式输出"""
        if chunk.strip():
            print(f"\n[LLM 输出] {chunk.strip()[:40]}...")
            pipeline.feed_text(chunk)
    
    try:
        result = deepseek_chat(
            messages=messages,
            temperature=0.7,
            max_tokens=200,
            stream=True,
            on_chunk=on_llm_chunk
        )
        
        if not result.get("success"):
            print(f"\n[错误] LLM 调用失败: {result.get('error')}")
            return 1
        
        llm_time = time.time() - llm_start
        print(f"\n[OK] LLM 响应完成，耗时 {llm_time:.2f}s")
        print(f"[INFO] 完整回复:\n{result.get('content', '')}")
        
    except Exception as e:
        print(f"\n[错误] LLM 调用异常: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # 结束输入
    pipeline.finalize()
    
    # 等待 TTS 完成
    print("\n[等待] 等待 TTS 合成完成...")
    time.sleep(8)
    
    # 收集音频
    while True:
        seg = pipeline.get_audio(timeout=2.0)
        if seg is None:
            break
    
    # 停止管道
    pipeline.stop()
    total_time = time.time() - llm_start
    
    # 统计
    print("\n" + "=" * 70)
    print("测试结果")
    print("=" * 70)
    
    stats = pipeline.get_stats()
    print(f"\n[统计]")
    print(f"  LLM 耗时: {llm_time:.2f}s")
    print(f"  总耗时: {total_time:.2f}s")
    print(f"  处理文本段: {stats['text_segments']}")
    print(f"  成功音频: {stats['audio_segments']}")
    print(f"  待处理: {stats['pending_audio']}")
    
    if stats['first_audio_latency']:
        print(f"  首音频延迟: {stats['first_audio_latency']:.2f}s")
    
    print(f"\n[文本段] {len(text_segments)} 个:")
    for idx, text in text_segments:
        print(f"  {idx}. {text[:60]}...")
    
    print(f"\n[音频段] {len(audio_segments)} 个:")
    for idx, size in audio_segments:
        print(f"  {idx}. {size} bytes")
    
    # 验证文件
    output_dir = Path("./real_llm_output")
    if output_dir.exists():
        files = list(output_dir.glob("*.wav"))
        if files:
            print(f"\n[生成文件] {len(files)} 个:")
            total_size = 0
            for f in sorted(files):
                size_kb = f.stat().st_size / 1024
                total_size += size_kb
                print(f"  - {f.name} ({size_kb:.1f} KB)")
            print(f"  总计: {total_size:.1f} KB")
    
    success = stats['audio_segments'] > 0
    print(f"\n[验证] {'通过' if success else '失败'}")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(test_real_llm_pipeline())
