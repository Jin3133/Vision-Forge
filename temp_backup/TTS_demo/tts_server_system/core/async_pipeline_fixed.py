#!/usr/bin/env python3
"""
修复版异步TTS管道
- 修复音频输出顺序问题
- 添加更多调试信息
- 改进线程同步
"""

import threading
import queue
import time
from typing import Callable, Optional, List, Dict, Any
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor

from text_processor import StreamingChunker, TextCleaner


@dataclass
class TextSegment:
    """文本段数据结构"""
    text: str
    index: int
    timestamp: float = field(default_factory=time.time)


@dataclass
class AudioSegment:
    """音频段数据结构"""
    audio_data: bytes
    index: int
    text: str = ""
    timestamp: float = field(default_factory=time.time)


class OrderedAudioBuffer:
    """
    有序音频缓冲区 - 修复版
    """
    
    def __init__(self, max_wait_time: float = 10.0):
        self.received: Dict[int, AudioSegment] = {}
        self.next_index = 0
        self.max_wait_time = max_wait_time
        self.last_output_time = time.time()
        self._lock = threading.Lock()
        
    def add(self, segment: AudioSegment) -> bool:
        """添加音频段（线程安全）"""
        with self._lock:
            self.received[segment.index] = segment
            return True
    
    def get_next(self) -> Optional[AudioSegment]:
        """获取下一个按序的音频段（线程安全）"""
        with self._lock:
            if self.next_index in self.received:
                segment = self.received.pop(self.next_index)
                self.next_index += 1
                self.last_output_time = time.time()
                return segment
            return None
    
    def has_gap(self) -> bool:
        """检查是否有缺失的段"""
        with self._lock:
            if not self.received:
                return False
            return min(self.received.keys()) > self.next_index
    
    def is_stalled(self) -> bool:
        """检查是否卡住"""
        return time.time() - self.last_output_time > self.max_wait_time
    
    def get_pending_count(self) -> int:
        """获取待处理的段数"""
        with self._lock:
            return len(self.received)
    
    def skip_missing(self) -> int:
        """跳过缺失的段"""
        with self._lock:
            skipped = 0
            while self.next_index not in self.received and self.has_gap():
                self.next_index += 1
                skipped += 1
            return skipped


class AsyncTTSPipelineFixed:
    """
    修复版异步TTS管道
    
    主要修复：
    1. 音频输出顺序问题
    2. 线程同步问题
    3. 添加调试信息
    """
    
    def __init__(
        self,
        tts_func: Callable[[str, str], bool],
        clean_func: Optional[Callable[[str], str]] = None,
        max_workers: int = 3,
        queue_size: int = 10,
        min_chunk_size: int = 20,
        max_chunk_size: int = 150,
        output_dir: Optional[str] = None
    ):
        self.tts_func = tts_func
        self.clean_func = clean_func or TextCleaner.rule_based_clean
        self.output_dir = output_dir
        
        self.max_workers = max_workers
        self.min_chunk_size = min_chunk_size
        self.max_chunk_size = max_chunk_size
        
        # 组件
        self.chunker = StreamingChunker(min_chunk_size, max_chunk_size)
        self.audio_buffer = OrderedAudioBuffer()
        
        # 队列
        self.text_queue = queue.Queue(maxsize=queue_size)
        self.audio_queue = queue.Queue(maxsize=queue_size)
        
        # 线程控制
        self.is_running = False
        self._stop_event = threading.Event()
        self._threads: List[threading.Thread] = []
        self._executor: Optional[ThreadPoolExecutor] = None
        
        # 统计
        self.stats = {
            "text_segments": 0,
            "audio_segments": 0,
            "start_time": 0,
            "first_audio_time": 0,
            "end_time": 0
        }
        
        # 调试信息
        self.debug_mode = True
        
        # 回调
        self.on_text_segment: Optional[Callable[[str, int], None]] = None
        self.on_audio_ready: Optional[Callable[[bytes, int], None]] = None
        
    def _debug(self, msg: str):
        """输出调试信息"""
        if self.debug_mode:
            print(f"[AsyncPipeline] {msg}")
        
    def start(self):
        """启动处理管道"""
        if self.is_running:
            return
        
        self.is_running = True
        self._stop_event.clear()
        self.stats["start_time"] = time.time()
        
        # 创建线程池
        self._executor = ThreadPoolExecutor(max_workers=self.max_workers)
        
        # 启动收集线程
        self._threads = [
            threading.Thread(target=self._collect_worker, name="Audio-Collector", daemon=True)
        ]
        
        for thread in self._threads:
            thread.start()
        
        self._debug(f"管道已启动，工作线程数: {self.max_workers}")
    
    def stop(self):
        """停止处理管道"""
        self._debug("正在停止管道...")
        self.is_running = False
        self._stop_event.set()
        
        # 关闭线程池
        if self._executor:
            self._executor.shutdown(wait=False)
        
        # 快速输出缓冲区中的音频（最多等待3秒）
        for _ in range(3):
            if self.audio_buffer.get_pending_count() == 0:
                break
            # 尝试输出
            while True:
                segment = self.audio_buffer.get_next()
                if segment is None:
                    break
                try:
                    self.audio_queue.put(segment, timeout=0.5)
                    if self.on_audio_ready:
                        self.on_audio_ready(segment.audio_data, segment.index)
                except queue.Full:
                    break
            time.sleep(1)
        
        # Flush剩余音频
        self._flush_all_audio()
        
        # 等待线程结束
        for thread in self._threads:
            thread.join(timeout=1)
        
        self.stats["end_time"] = time.time()
        self._debug("管道已停止")
    
    def _flush_all_audio(self) -> int:
        """输出缓冲区中所有音频（不管顺序）"""
        count = 0
        with self.audio_buffer._lock:
            # 获取所有音频并按序号排序
            all_segments = sorted(self.audio_buffer.received.values(), key=lambda x: x.index)
            self.audio_buffer.received.clear()
        
        for segment in all_segments:
            try:
                self.audio_queue.put(segment, timeout=1)
                if self.on_audio_ready:
                    self.on_audio_ready(segment.audio_data, segment.index)
                count += 1
            except queue.Full:
                break
        
        return count
    
    def feed_text(self, text: str) -> List[str]:
        """
        输入文本片段
        
        Returns:
            新产生的完整句子列表
        """
        sentences = self.chunker.feed(text)
        
        for sentence in sentences:
            self.stats["text_segments"] += 1
            segment = TextSegment(
                text=sentence,
                index=self.chunker.chunk_index
            )
            
            try:
                self.text_queue.put(segment, timeout=1)
                self._debug(f"文本段 {segment.index} 已入队")
                
                # 提交到线程池处理
                self._executor.submit(self._process_segment, segment)
                
                if self.on_text_segment:
                    self.on_text_segment(sentence, segment.index)
            except queue.Full:
                self._debug(f"文本队列已满，丢弃段 {segment.index}")
                pass
        
        return sentences
    
    def finalize(self):
        """结束输入，处理剩余内容"""
        remaining = self.chunker.finalize()
        if remaining:
            self.feed_text(remaining)
        
        # 发送结束信号
        for _ in range(self.max_workers):
            try:
                self.text_queue.put(None, timeout=1)
            except queue.Full:
                pass
        
        self._debug("输入已结束，等待处理完成...")
    
    def _process_segment(self, segment: TextSegment):
        """处理单个文本段（在线程池中运行）"""
        try:
            # 清洗文本
            cleaned_text = self.clean_func(segment.text)
            if not cleaned_text.strip():
                self._debug(f"文本段 {segment.index} 清洗后为空，跳过")
                return
            
            self._debug(f"开始处理文本段 {segment.index}: {cleaned_text[:30]}...")
            
            # TTS合成
            audio_data = self._synthesize_tts(cleaned_text, segment.index)
            
            if audio_data:
                audio_segment = AudioSegment(
                    audio_data=audio_data,
                    index=segment.index,
                    text=cleaned_text
                )
                
                self.audio_buffer.add(audio_segment)
                self._debug(f"音频段 {segment.index} 已添加到缓冲区")
            else:
                self._debug(f"音频段 {segment.index} 合成失败")
                
        except Exception as e:
            self._debug(f"处理文本段 {segment.index} 时出错: {e}")
            import traceback
            traceback.print_exc()
    
    def _collect_worker(self):
        """收集线程：持续检查并输出按序的音频"""
        self._debug("收集线程已启动")
        
        while not self._stop_event.is_set():
            try:
                # 尝试获取按序的音频
                segment = self.audio_buffer.get_next()
                
                if segment:
                    self._debug(f"输出音频段 {segment.index}")
                    
                    try:
                        self.audio_queue.put(segment, timeout=1)
                        if self.on_audio_ready:
                            self.on_audio_ready(segment.audio_data, segment.index)
                    except queue.Full:
                        self._debug("音频队列已满")
                else:
                    # 没有按序的音频，等待一下
                    time.sleep(0.1)
                    
                    # 检查是否卡住
                    if self.audio_buffer.is_stalled() and self.audio_buffer.get_pending_count() > 0:
                        skipped = self.audio_buffer.skip_missing()
                        self._debug(f"跳过 {skipped} 个缺失的段")
                        
            except Exception as e:
                self._debug(f"收集线程错误: {e}")
                
        self._debug("收集线程已结束")
    
    def _synthesize_tts(self, text: str, index: int) -> Optional[bytes]:
        """合成TTS音频"""
        import tempfile
        import os
        
        temp_file = tempfile.mktemp(suffix=".wav")
        output_file = None
        
        if self.output_dir:
            os.makedirs(self.output_dir, exist_ok=True)
            output_file = os.path.join(self.output_dir, f"segment_{index:03d}.wav")
        
        try:
            start_time = time.time()
            
            if self.tts_func(text, temp_file):
                # 读取音频数据
                with open(temp_file, "rb") as f:
                    audio_data = f.read()
                
                # 保存到输出目录
                if output_file:
                    with open(output_file, "wb") as f:
                        f.write(audio_data)
                
                self.stats["audio_segments"] += 1
                
                # 记录首句时间
                if self.stats["first_audio_time"] == 0:
                    self.stats["first_audio_time"] = time.time()
                
                elapsed = time.time() - start_time
                self._debug(f"音频段 {index} 合成完成，耗时 {elapsed:.2f}s，大小 {len(audio_data)} bytes")
                
                return audio_data
            else:
                self._debug(f"音频段 {index} TTS函数返回失败")
        except Exception as e:
            self._debug(f"音频段 {index} TTS合成异常: {e}")
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        
        return None
    
    def get_audio(self, timeout: float = 1.0) -> Optional[AudioSegment]:
        """获取合成好的音频段"""
        try:
            return self.audio_queue.get(timeout=timeout)
        except queue.Empty:
            return None
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        stats = self.stats.copy()
        
        if stats["first_audio_time"] > 0:
            stats["first_audio_latency"] = stats["first_audio_time"] - stats["start_time"]
        else:
            stats["first_audio_latency"] = None
        
        if stats["end_time"] > 0:
            stats["total_duration"] = stats["end_time"] - stats["start_time"]
        else:
            stats["total_duration"] = time.time() - stats["start_time"]
        
        stats["pending_audio"] = self.audio_buffer.get_pending_count()
        
        return stats
    
    def reset(self):
        """重置管道状态"""
        self.stop()
        self.chunker.reset()
        self.audio_buffer = OrderedAudioBuffer()
        
        # 清空队列
        while not self.text_queue.empty():
            try:
                self.text_queue.get_nowait()
            except queue.Empty:
                break
        
        while not self.audio_queue.empty():
            try:
                self.audio_queue.get_nowait()
            except queue.Empty:
                break
        
        self.stats = {
            "text_segments": 0,
            "audio_segments": 0,
            "start_time": 0,
            "first_audio_time": 0,
            "end_time": 0
        }


if __name__ == "__main__":
    print("修复版异步TTS管道")
    print("使用 test_async_pipeline_fixed.py 进行测试")
