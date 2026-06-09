"""
文本处理模块 - 语义分块和TTS清洗

功能：
1. SemanticChunker: 按语义边界切分文本
2. TextCleaner: 使用LLM清洗文本为适合TTS的格式
"""

import re
from typing import List, Generator, Optional, Callable
from dataclasses import dataclass


@dataclass
class TextChunk:
    """文本块数据结构"""
    content: str
    chunk_type: str = "normal"  # normal, table, code, formula
    index: int = 0


class SemanticChunker:
    """
    语义分块器
    
    策略：
    - 按句子边界切分（。！？\n）
    - 长度控制：50-150字/块
    - 滑动窗口缓冲
    - 识别特殊格式（表格、代码、公式）
    """
    
    def __init__(
        self,
        min_length: int = 50,
        max_length: int = 150,
        sentence_end_chars: str = "。！？\n"
    ):
        self.min_length = min_length
        self.max_length = max_length
        self.sentence_end_chars = sentence_end_chars
        self.buffer = ""
        self.chunk_index = 0
        
    def _detect_chunk_type(self, text: str) -> str:
        """检测文本块类型"""
        # 检测表格
        if "|" in text and "-" in text:
            lines = text.strip().split("\n")
            if len(lines) >= 2 and all("|" in line for line in lines[:2]):
                return "table"
        
        # 检测代码块
        if "```" in text or (text.strip().startswith("    ") and len(text.strip()) > 20):
            return "code"
        
        # 检测公式
        if any(c in text for c in ["=", "+", "-", "*", "/", "²", "³", "∑", "∫"]):
            if re.search(r'[a-zA-Z]\s*[=+\-*/]', text) or re.search(r'\d+\s*[=+\-*/]', text):
                return "formula"
        
        return "normal"
    
    def _find_sentence_boundary(self, text: str, start_pos: int) -> int:
        """查找句子边界位置"""
        for i in range(start_pos, min(start_pos + self.max_length, len(text))):
            if text[i] in self.sentence_end_chars:
                return i + 1
        return -1
    
    def feed(self, text: str) -> Generator[TextChunk, None, None]:
        """
        输入文本，产生语义分块
        
        使用示例：
            chunker = SemanticChunker()
            for chunk in chunker.feed("这是一段文本。这是另一段。"):
                print(chunk.content)
        """
        self.buffer += text
        
        while len(self.buffer) >= self.min_length:
            # 尝试在max_length范围内找句子边界
            boundary = self._find_sentence_boundary(self.buffer, self.min_length - 1)
            
            if boundary == -1:
                # 没找到边界，但buffer太长，强制切分
                if len(self.buffer) >= self.max_length:
                    boundary = self.max_length
                else:
                    break
            
            # 提取chunk
            chunk_content = self.buffer[:boundary].strip()
            if chunk_content:
                chunk_type = self._detect_chunk_type(chunk_content)
                self.chunk_index += 1
                yield TextChunk(
                    content=chunk_content,
                    chunk_type=chunk_type,
                    index=self.chunk_index
                )
            
            self.buffer = self.buffer[boundary:]
    
    def flush(self) -> Optional[TextChunk]:
        """刷新剩余buffer"""
        if self.buffer.strip():
            chunk_type = self._detect_chunk_type(self.buffer)
            self.chunk_index += 1
            chunk = TextChunk(
                content=self.buffer.strip(),
                chunk_type=chunk_type,
                index=self.chunk_index
            )
            self.buffer = ""
            return chunk
        return None
    
    def reset(self):
        """重置状态"""
        self.buffer = ""
        self.chunk_index = 0


class TextCleaner:
    """
    文本清洗器 - 使用LLM将Markdown转换为自然语言
    
    提供两种模式：
    1. 规则清洗（快速，无需LLM调用）
    2. LLM清洗（质量好，需要额外调用）
    """
    
    # 清洗Prompt模板
    CLEAN_PROMPT = """你是一个文本清洗专家，将以下Markdown格式文本转换为适合语音朗读的自然语言。

规则：
1. 删除所有Markdown标记（**、*、#、```等）
2. 表格转换为文字描述："表格显示，第一行是...，第二行是..."
3. 代码片段简述功能，不要读代码本身
4. 公式转换为文字解释：如"a的平方加b的平方等于c的平方"
5. 列表转换为连贯句子
6. 保持所有数字、专有名词不变
7. 输出必须是纯文本，无任何格式标记
8. 保持原文意思，只转换格式

输入文本：
{text}

输出（纯文本，直接输出清洗后的内容，不要加任何前缀）："""
    
    @staticmethod
    def rule_based_clean(text: str) -> str:
        """
        基于规则的快速清洗
        
        适合：
        - 简单Markdown标记
        - 不需要语义理解的场景
        - 对延迟敏感的场景
        """
        # 移除Markdown标题标记
        text = re.sub(r'^#+\s*', '', text, flags=re.MULTILINE)
        
        # 移除加粗、斜体标记
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
        text = re.sub(r'\*([^*]+)\*', r'\1', text)
        text = re.sub(r'__([^_]+)__', r'\1', text)
        text = re.sub(r'_([^_]+)_', r'\1', text)
        
        # 移除代码块标记，保留内容
        text = re.sub(r'```[\w]*\n', '', text)
        text = re.sub(r'```', '', text)
        text = re.sub(r'`([^`]+)`', r'\1', text)
        
        # 移除链接标记，保留文本
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
        
        # 简化表格（简单处理）
        lines = text.split('\n')
        cleaned_lines = []
        for line in lines:
            # 跳过分隔线
            if re.match(r'^\s*\|[-\s|]+\|\s*$', line):
                continue
            # 移除表格边框
            line = re.sub(r'^\s*\|\s*', '', line)
            line = re.sub(r'\s*\|\s*$', '', line)
            line = re.sub(r'\s*\|\s*', '，', line)
            cleaned_lines.append(line)
        
        text = '\n'.join(cleaned_lines)
        
        # 移除多余空行
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        return text.strip()
    
    @staticmethod
    def get_llm_clean_prompt(text: str) -> str:
        """获取LLM清洗的prompt"""
        return TextCleaner.CLEAN_PROMPT.format(text=text)
    
    @staticmethod
    def clean_chunk(chunk: TextChunk, use_llm: bool = False) -> str:
        """
        清洗单个文本块
        
        Args:
            chunk: 文本块
            use_llm: 是否使用LLM清洗（默认使用规则清洗）
        
        Returns:
            清洗后的纯文本
        """
        if use_llm:
            # 返回prompt，需要外部调用LLM
            return TextCleaner.get_llm_clean_prompt(chunk.content)
        else:
            # 使用规则清洗
            return TextCleaner.rule_based_clean(chunk.content)


class StreamingTextProcessor:
    """
    流式文本处理器
    
    整合分块和清洗，提供流式处理接口
    """
    
    def __init__(
        self,
        min_length: int = 50,
        max_length: int = 150,
        use_llm_clean: bool = False
    ):
        self.chunker = SemanticChunker(min_length, max_length)
        self.use_llm_clean = use_llm_clean
        self.cleaner = TextCleaner()
        
    def process_stream(
        self,
        text_stream: Generator[str, None, None],
        on_chunk_ready: Optional[Callable[[str, int], None]] = None
    ) -> Generator[str, None, None]:
        """
        处理文本流
        
        Args:
            text_stream: 输入文本流（生成器）
            on_chunk_ready: 回调函数，参数为(清洗后文本, chunk序号)
        
        Yields:
            清洗后的文本块
        """
        for text in text_stream:
            for chunk in self.chunker.feed(text):
                cleaned = self.cleaner.clean_chunk(chunk, self.use_llm_clean)
                if on_chunk_ready:
                    on_chunk_ready(cleaned, chunk.index)
                yield cleaned
        
        # 处理剩余buffer
        final_chunk = self.chunker.flush()
        if final_chunk:
            cleaned = self.cleaner.clean_chunk(final_chunk, self.use_llm_clean)
            if on_chunk_ready:
                on_chunk_ready(cleaned, final_chunk.index)
            yield cleaned
    
    def reset(self):
        """重置处理器状态"""
        self.chunker.reset()


class StreamingChunker:
    """
    流式分块器 - 支持LLM流式输出的实时分块
    
    功能：
    - 逐字符接收LLM输出
    - 实时检测句子边界
    - 输出完整的句子块
    
    使用场景：
    - LLM流式生成过程中实时分块
    - 降低首句TTS延迟
    """
    
    # 句子结束标记
    SENTENCE_END_CHARS = "。！？\n"
    # 次要分隔符（长句子时考虑）
    SECONDARY_CHARS = "，；"
    
    def __init__(
        self,
        min_chunk_size: int = 20,
        max_chunk_size: int = 150,
        max_buffer_size: int = 500
    ):
        self.min_chunk_size = min_chunk_size
        self.max_chunk_size = max_chunk_size
        self.max_buffer_size = max_buffer_size
        
        self.buffer = ""           # 当前缓冲文本
        self.complete_sentences = []  # 已完成的句子队列
        self.chunk_index = 0        # 块序号
        self.is_finalized = False   # 是否已结束
        
    def feed(self, text: str) -> List[str]:
        """
        输入文本片段，返回新产生的完整句子
        
        Args:
            text: LLM流式返回的文本片段
            
        Returns:
            新产生的完整句子列表
        """
        if self.is_finalized:
            return []
        
        self.buffer += text
        new_sentences = []
        
        # 循环处理，可能产生多个句子
        while True:
            sentence = self._extract_next_sentence()
            if sentence is None:
                break
            new_sentences.append(sentence)
        
        # 防止buffer无限增长
        if len(self.buffer) > self.max_buffer_size:
            # 强制切分
            forced_sentence = self._force_split()
            if forced_sentence:
                new_sentences.append(forced_sentence)
        
        return new_sentences
    
    def _extract_next_sentence(self) -> Optional[str]:
        """
        从buffer中提取下一个完整句子
        
        Returns:
            完整句子或None（未找到边界）
        """
        if len(self.buffer) < self.min_chunk_size:
            return None
        
        # 策略1: 找句子结束标记
        boundary = self._find_boundary_by_chars(
            self.buffer, 
            self.SENTENCE_END_CHARS,
            self.min_chunk_size,
            self.max_chunk_size
        )
        
        if boundary > 0:
            return self._split_at(boundary)
        
        # 策略2: buffer太长，找次要分隔符
        if len(self.buffer) >= self.max_chunk_size:
            boundary = self._find_boundary_by_chars(
                self.buffer,
                self.SECONDARY_CHARS,
                self.min_chunk_size,
                self.max_chunk_size
            )
            if boundary > 0:
                return self._split_at(boundary)
        
        # 策略3: buffer超长，强制切分
        if len(self.buffer) >= self.max_chunk_size:
            return self._split_at(self.max_chunk_size)
        
        return None
    
    def _find_boundary_by_chars(
        self, 
        text: str, 
        chars: str, 
        min_pos: int, 
        max_pos: int
    ) -> int:
        """
        在指定范围内查找分隔符位置
        
        Returns:
            分隔符位置+1（切分点），未找到返回-1
        """
        search_range = text[min_pos:min(max_pos, len(text))]
        
        # 从后往前找最后一个分隔符
        for i in range(len(search_range) - 1, -1, -1):
            if search_range[i] in chars:
                return min_pos + i + 1
        
        return -1
    
    def _split_at(self, pos: int) -> str:
        """
        在指定位置切分buffer
        
        Args:
            pos: 切分位置
            
        Returns:
            切分出的句子
        """
        sentence = self.buffer[:pos].strip()
        self.buffer = self.buffer[pos:]
        self.chunk_index += 1
        return sentence
    
    def _force_split(self) -> Optional[str]:
        """
        强制切分超长buffer
        
        Returns:
            强制切分的句子或None
        """
        if len(self.buffer) > self.max_buffer_size:
            # 在max_chunk_size处切分
            split_pos = min(self.max_chunk_size, len(self.buffer))
            return self._split_at(split_pos)
        return None
    
    def finalize(self) -> Optional[str]:
        """
        结束输入，返回buffer中剩余内容
        
        Returns:
            剩余文本或None
        """
        self.is_finalized = True
        if self.buffer.strip():
            remaining = self.buffer.strip()
            self.buffer = ""
            self.chunk_index += 1
            return remaining
        return None
    
    def get_buffer_preview(self, length: int = 50) -> str:
        """
        获取buffer预览（用于调试）
        
        Args:
            length: 预览长度
            
        Returns:
            buffer前length个字符
        """
        preview = self.buffer[:length]
        if len(self.buffer) > length:
            preview += "..."
        return preview
    
    def reset(self):
        """重置状态"""
        self.buffer = ""
        self.complete_sentences = []
        self.chunk_index = 0
        self.is_finalized = False


# ==================== 使用示例 ====================

if __name__ == "__main__":
    # 测试语义分块器
    print("=" * 50)
    print("测试语义分块器")
    print("=" * 50)
    
    chunker = SemanticChunker(min_length=30, max_length=100)
    
    test_text = """这是一个测试文本。它包含多个句子。
    
| 城市 | 人口 | GDP |
|------|------|-----|
| 北京 | 2154万 | 41600 |

这是另一个段落。它也有多个句子！你明白了吗？"""
    
    for chunk in chunker.feed(test_text):
        print(f"\n块 {chunk.index} (类型: {chunk.chunk_type}):")
        print(chunk.content[:50] + "..." if len(chunk.content) > 50 else chunk.content)
    
    # 测试规则清洗
    print("\n" + "=" * 50)
    print("测试规则清洗")
    print("=" * 50)
    
    markdown_text = """### 标题

这是**加粗**和*斜体*的文本。

```python
def hello():
    print("hello")
```

| 名称 | 值 |
|------|-----|
| A | 1 |
| B | 2 |
"""
    
    cleaned = TextCleaner.rule_based_clean(markdown_text)
    print("清洗后:")
    print(cleaned)
