#!/usr/bin/env python3
"""
双LLM Pipeline 实现

架构:
    用户输入 → LLM1(生成) → LLM2(清洗) → 分块 → TTS合成 → 音频输出

功能:
    - LLM1: 负责生成初始回复（支持Markdown、表格、代码等）
    - LLM2: 负责将内容清洗为适合TTS的自然语言
    - 支持同步和流式处理
"""

import os
import sys
import time
import queue
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field

sys.path.insert(0, str(Path(__file__).parent))

from async_pipeline_fixed import AsyncTTSPipelineFixed
from text_processor import StreamingChunker, TextCleaner


@dataclass
class PipelineResult:
    """Pipeline处理结果"""
    success: bool
    llm1_content: str = ""  # LLM1原始输出
    llm2_content: str = ""  # LLM2清洗后输出
    audio_segments: List[tuple] = field(default_factory=list)  # (index, size)
    error: Optional[str] = None
    stats: Dict[str, Any] = field(default_factory=dict)


class DualLLMStreamingPipeline:
    """
    双LLM流式Pipeline
    
    数据流:
        用户消息 → LLM1生成 → LLM2清洗 → 分块 → TTS → 音频输出
    """
    
    def __init__(
        self,
        llm1_func: Callable,
        llm2_func: Callable,
        tts_func: Callable[[str, str], bool],
        max_workers: int = 3,
        queue_size: int = 10,
        min_chunk_size: int = 20,
        max_chunk_size: int = 150,
        output_dir: Optional[str] = None,
        enable_llm2: bool = True  # 是否启用LLM2清洗
    ):
        """
        初始化双LLM Pipeline
        
        Args:
            llm1_func: LLM1调用函数，生成初始内容
            llm2_func: LLM2调用函数，清洗内容为自然语言
            tts_func: TTS函数
            max_workers: TTS工作线程数
            queue_size: 队列大小
            min_chunk_size: 最小分块大小
            max_chunk_size: 最大分块大小
            output_dir: 音频输出目录
            enable_llm2: 是否启用LLM2清洗（False则跳过清洗）
        """
        self.llm1_func = llm1_func
        self.llm2_func = llm2_func
        self.tts_func = tts_func
        self.enable_llm2 = enable_llm2
        
        # TTS管道
        self.tts_pipeline = AsyncTTSPipelineFixed(
            tts_func=tts_func,
            clean_func=TextCleaner.rule_based_clean,  # 额外规则清洗
            max_workers=max_workers,
            queue_size=queue_size,
            min_chunk_size=min_chunk_size,
            max_chunk_size=max_chunk_size,
            output_dir=output_dir
        )
        
        # 流式分块器
        self.chunker = StreamingChunker(min_chunk_size, max_chunk_size)
        
        # 回调函数
        self.on_llm1_chunk: Optional[Callable[[str], None]] = None
        self.on_llm2_chunk: Optional[Callable[[str], None]] = None
        self.on_text_segment: Optional[Callable[[str, int], None]] = None
        self.on_audio_ready: Optional[Callable[[bytes, int], None]] = None
        
        # 统计
        self.stats = {
            "llm1_start_time": 0,
            "llm1_end_time": 0,
            "llm2_start_time": 0,
            "llm2_end_time": 0,
            "tts_start_time": 0,
            "tts_end_time": 0,
            "total_chars_llm1": 0,
            "total_chars_llm2": 0,
            "text_segments": 0,
            "audio_segments": 0
        }
        
        # 结果收集
        self._llm1_buffer = ""
        self._llm2_buffer = ""
        self._audio_segments: List[tuple] = []
    
    def process_sync(
        self,
        messages: List[Dict[str, str]],
        llm1_temperature: float = 0.7,
        llm1_max_tokens: int = 2048,
        llm2_temperature: float = 0.3,
        llm2_max_tokens: int = 2048
    ) -> PipelineResult:
        """
        同步处理（非流式）
        
        Args:
            messages: 对话消息列表
            llm1_temperature: LLM1温度参数
            llm1_max_tokens: LLM1最大token数
            llm2_temperature: LLM2温度参数
            llm2_max_tokens: LLM2最大token数
            
        Returns:
            PipelineResult
        """
        self.stats["llm1_start_time"] = time.time()
        
        # Step 1: LLM1生成
        result1 = self.llm1_func(
            messages=messages,
            temperature=llm1_temperature,
            max_tokens=llm1_max_tokens,
            stream=False
        )
        
        self.stats["llm1_end_time"] = time.time()
        
        if not result1.get("success"):
            return PipelineResult(
                success=False,
                error=f"LLM1调用失败: {result1.get('error')}"
            )
        
        llm1_content = result1.get("content", "")
        self.stats["total_chars_llm1"] = len(llm1_content)
        
        if not llm1_content:
            return PipelineResult(
                success=False,
                llm1_content=llm1_content,
                error="LLM1返回内容为空"
            )
        
        # Step 2: LLM2清洗
        if self.enable_llm2:
            self.stats["llm2_start_time"] = time.time()
            
            llm2_messages = [
                {"role": "system", "content": "你是一个文本清洗专家，将Markdown格式文本转换为适合语音朗读的自然语言。删除所有Markdown标记，将表格转换为文字描述，代码简述功能。输出必须是纯文本。"},
                {"role": "user", "content": f"请将以下内容转换为适合TTS的自然语言：\n\n{llm1_content}"}
            ]
            
            result2 = self.llm2_func(
                messages=llm2_messages,
                temperature=llm2_temperature,
                max_tokens=llm2_max_tokens,
                stream=False
            )
            
            self.stats["llm2_end_time"] = time.time()
            
            if result2.get("success"):
                llm2_content = result2.get("content", "")
            else:
                # LLM2失败，使用原始文本降级
                llm2_content = llm1_content
                print(f"[警告] LLM2清洗失败，使用原始文本: {result2.get('error')}")
        else:
            llm2_content = llm1_content
        
        self.stats["total_chars_llm2"] = len(llm2_content)
        
        return PipelineResult(
            success=True,
            llm1_content=llm1_content,
            llm2_content=llm2_content,
            stats=self.stats.copy()
        )
    
    def process_stream(
        self,
        messages: List[Dict[str, str]],
        on_llm1_chunk: Optional[Callable[[str], None]] = None,
        on_llm2_chunk: Optional[Callable[[str], None]] = None,
        llm1_temperature: float = 0.7,
        llm1_max_tokens: int = 2048,
        llm2_temperature: float = 0.3,
        llm2_max_tokens: int = 2048
    ) -> PipelineResult:
        """
        流式处理
        
        流程:
            1. LLM1流式生成
            2. 累积一定长度后调用LLM2清洗
            3. 清洗后的文本送入TTS管道
        
        Args:
            messages: 对话消息列表
            on_llm1_chunk: LLM1输出回调
            on_llm2_chunk: LLM2输出回调
            llm1_temperature: LLM1温度参数
            llm1_max_tokens: LLM1最大token数
            llm2_temperature: LLM2温度参数
            llm2_max_tokens: LLM2最大token数
            
        Returns:
            PipelineResult
        """
        self.stats["llm1_start_time"] = time.time()
        self._llm1_buffer = ""
        self._llm2_buffer = ""
        
        # 设置回调
        self.on_llm1_chunk = on_llm1_chunk
        self.on_llm2_chunk = on_llm2_chunk
        
        # 启动TTS管道
        self.tts_pipeline.start()
        self.stats["tts_start_time"] = time.time()
        
        # 收集LLM1输出的完整内容
        llm1_full_content = []
        
        def llm1_chunk_handler(chunk: str):
            """处理LLM1流式输出"""
            llm1_full_content.append(chunk)
            self._llm1_buffer += chunk
            self.stats["total_chars_llm1"] += len(chunk)
            
            if self.on_llm1_chunk:
                self.on_llm1_chunk(chunk)
        
        # 调用LLM1流式生成
        result1 = self.llm1_func(
            messages=messages,
            temperature=llm1_temperature,
            max_tokens=llm1_max_tokens,
            stream=True,
            on_chunk=llm1_chunk_handler
        )
        
        self.stats["llm1_end_time"] = time.time()
        
        if not result1.get("success"):
            self.tts_pipeline.stop()
            return PipelineResult(
                success=False,
                error=f"LLM1调用失败: {result1.get('error')}"
            )
        
        llm1_content = result1.get("content", "")
        
        # Step 2: LLM2清洗（非流式，对完整内容清洗）
        if self.enable_llm2 and llm1_content:
            self.stats["llm2_start_time"] = time.time()
            
            llm2_messages = [
                {"role": "system", "content": TextCleaner.CLEAN_PROMPT},
                {"role": "user", "content": llm1_content}
            ]
            
            result2 = self.llm2_func(
                messages=llm2_messages,
                temperature=llm2_temperature,
                max_tokens=llm2_max_tokens,
                stream=False
            )
            
            self.stats["llm2_end_time"] = time.time()
            
            if result2.get("success"):
                llm2_content = result2.get("content", "")
                self.stats["total_chars_llm2"] = len(llm2_content)
                
                if self.on_llm2_chunk:
                    self.on_llm2_chunk(llm2_content)
            else:
                # LLM2失败，使用规则清洗降级
                print(f"[警告] LLM2清洗失败，使用规则清洗: {result2.get('error')}")
                llm2_content = TextCleaner.rule_based_clean(llm1_content)
                self.stats["total_chars_llm2"] = len(llm2_content)
        else:
            llm2_content = llm1_content
        
        # Step 3: 送入TTS管道
        self._feed_to_tts(llm2_content)
        
        # 等待TTS完成
        time.sleep(2)
        self.tts_pipeline.finalize()
        time.sleep(3)
        
        self.stats["tts_end_time"] = time.time()
        self.tts_pipeline.stop()
        
        # 收集音频段信息
        audio_segments = []
        while True:
            seg = self.tts_pipeline.get_audio(timeout=0.5)
            if seg is None:
                break
            audio_segments.append((seg.index, len(seg.audio_data)))
        
        self.stats["audio_segments"] = len(audio_segments)
        
        return PipelineResult(
            success=True,
            llm1_content=llm1_content,
            llm2_content=llm2_content,
            audio_segments=audio_segments,
            stats=self.stats.copy()
        )
    
    def process_with_tts(
        self,
        messages: List[Dict[str, str]],
        output_prefix: str = "output",
        llm1_temperature: float = 0.7,
        llm1_max_tokens: int = 2048,
        llm2_temperature: float = 0.3,
        llm2_max_tokens: int = 2048
    ) -> PipelineResult:
        """
        完整流程：生成 + 清洗 + TTS
        
        Args:
            messages: 对话消息列表
            output_prefix: 输出文件前缀
            llm1_temperature: LLM1温度参数
            llm1_max_tokens: LLM1最大token数
            llm2_temperature: LLM2温度参数
            llm2_max_tokens: LLM2最大token数
            
        Returns:
            PipelineResult
        """
        print("=" * 70)
        print("双LLM Pipeline 处理")
        print("=" * 70)
        
        # Step 1: LLM1生成
        print("\n[Step 1] LLM1 生成内容...")
        result = self.process_sync(
            messages=messages,
            llm1_temperature=llm1_temperature,
            llm1_max_tokens=llm1_max_tokens,
            llm2_temperature=llm2_temperature,
            llm2_max_tokens=llm2_max_tokens
        )
        
        if not result.success:
            return result
        
        print(f"  LLM1输出: {len(result.llm1_content)} 字符")
        print(f"  预览: {result.llm1_content[:100]}...")
        
        # Step 2: LLM2清洗
        if self.enable_llm2:
            print("\n[Step 2] LLM2 清洗内容...")
            print(f"  LLM2输出: {len(result.llm2_content)} 字符")
            print(f"  预览: {result.llm2_content[:100]}...")
        else:
            print("\n[Step 2] 跳过LLM2清洗")
        
        # Step 3: TTS合成
        print("\n[Step 3] TTS 合成音频...")
        
        self.tts_pipeline.start()
        self.stats["tts_start_time"] = time.time()
        
        # 送入TTS管道
        self._feed_to_tts(result.llm2_content)
        
        # 等待处理
        time.sleep(2)
        self.tts_pipeline.finalize()
        
        # 等待音频合成
        print("  等待音频合成...")
        time.sleep(5)
        
        self.stats["tts_end_time"] = time.time()
        self.tts_pipeline.stop()
        
        # 收集音频
        audio_segments = []
        while True:
            seg = self.tts_pipeline.get_audio(timeout=1.0)
            if seg is None:
                break
            audio_segments.append((seg.index, len(seg.audio_data)))
        
        result.audio_segments = audio_segments
        result.stats = self.stats.copy()
        
        print(f"  生成音频段: {len(audio_segments)}")
        
        # 打印统计
        print("\n" + "=" * 70)
        print("处理统计")
        print("=" * 70)
        print(f"  LLM1耗时: {self.stats['llm1_end_time'] - self.stats['llm1_start_time']:.2f}s")
        if self.enable_llm2:
            print(f"  LLM2耗时: {self.stats['llm2_end_time'] - self.stats['llm2_start_time']:.2f}s")
        print(f"  TTS耗时: {self.stats['tts_end_time'] - self.stats['tts_start_time']:.2f}s")
        print(f"  总耗时: {time.time() - self.stats['llm1_start_time']:.2f}s")
        
        return result
    
    def _feed_to_tts(self, text: str):
        """将文本送入TTS管道"""
        # 使用流式分块器
        sentences = self.chunker.feed(text)
        
        for sentence in sentences:
            self.stats["text_segments"] += 1
            self.tts_pipeline.feed_text(sentence + " ")
        
        # 处理剩余内容
        remaining = self.chunker.finalize()
        if remaining:
            self.stats["text_segments"] += 1
            self.tts_pipeline.feed_text(remaining)
        
        # 重置分块器
        self.chunker.reset()
    
    def reset(self):
        """重置Pipeline状态"""
        self.tts_pipeline.reset()
        self.chunker.reset()
        self._llm1_buffer = ""
        self._llm2_buffer = ""
        self._audio_segments = []
        self.stats = {
            "llm1_start_time": 0,
            "llm1_end_time": 0,
            "llm2_start_time": 0,
            "llm2_end_time": 0,
            "tts_start_time": 0,
            "tts_end_time": 0,
            "total_chars_llm1": 0,
            "total_chars_llm2": 0,
            "text_segments": 0,
            "audio_segments": 0
        }


# 便捷函数
def create_default_pipeline(
    tts_func: Callable[[str, str], bool],
    output_dir: Optional[str] = None,
    enable_llm2: bool = True
) -> DualLLMStreamingPipeline:
    """
    创建默认的双LLM Pipeline（使用DeepSeek）
    
    Args:
        tts_func: TTS函数
        output_dir: 输出目录
        enable_llm2: 是否启用LLM2清洗
        
    Returns:
        DualLLMStreamingPipeline实例
    """
    from deepseek_llm import deepseek_chat
    
    return DualLLMStreamingPipeline(
        llm1_func=deepseek_chat,
        llm2_func=deepseek_chat,
        tts_func=tts_func,
        output_dir=output_dir,
        enable_llm2=enable_llm2
    )


# ==================== 使用示例 ====================

if __name__ == "__main__":
    print("双LLM Pipeline 模块")
    print("使用 demo_dual_llm.py 进行测试")
