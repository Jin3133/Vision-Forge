"""
DeepSeek LLM + 本地MOSS-TTS 封装函数

依赖库:
    pip install openai

用法示例见文件末尾
"""

import os
import sys
from typing import Dict, Any, List, Optional, Callable
import openai
from pathlib import Path

# 添加core目录到路径并导入本地MOSS-TTS模块
sys.path.insert(0, str(Path(__file__).parent.parent / 'core'))
from local_moss_tts import moss_tts


class DeepSeekLLM:
    """DeepSeek LLM 封装类"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "deepseek-chat"):
        """
        初始化 DeepSeek LLM
        
        Args:
            api_key: DeepSeek API Key，如果为None则从环境变量获取
            model: 模型名称，默认为 deepseek-chat
        """
        self.api_key = api_key or os.environ.get("DEEPSEEK_API_KEY")
        if not self.api_key:
            raise ValueError("请设置 DEEPSEEK_API_KEY 环境变量或在初始化时传入 api_key")
        
        self.model = model
        self.client = openai.OpenAI(
            base_url="https://api.deepseek.com/v1",
            api_key=self.api_key,
        )
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stream: bool = False,
        on_chunk: Optional[Callable[[str], None]] = None
    ) -> Dict[str, Any]:
        """
        调用 DeepSeek API 进行对话
        
        Args:
            messages: 消息列表，格式为 [{"role": "user", "content": "..."}, ...]
            temperature: 温度参数
            max_tokens: 最大token数
            stream: 是否流式输出
            on_chunk: 流式输出时的回调函数
            
        Returns:
            包含 success, content, error 的字典
        """
        try:
            if stream and on_chunk:
                # 流式输出
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True,
                )
                
                full_content = ""
                for chunk in response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        full_content += content
                        on_chunk(content)
                
                return {
                    "success": True,
                    "content": full_content,
                    "error": None
                }
            else:
                # 非流式输出
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=False,
                )
                
                content = response.choices[0].message.content
                return {
                    "success": True,
                    "content": content,
                    "error": None
                }
                
        except Exception as e:
            return {
                "success": False,
                "content": "",
                "error": str(e)
            }


# 全局LLM实例（延迟初始化）
_llm_instance: Optional[DeepSeekLLM] = None


def get_llm() -> DeepSeekLLM:
    """获取或创建LLM实例"""
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = DeepSeekLLM()
    return _llm_instance


def deepseek_chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    max_tokens: int = 2048,
    stream: bool = False,
    on_chunk: Optional[Callable[[str], None]] = None
) -> Dict[str, Any]:
    """
    调用 DeepSeek API 进行对话（兼容 spark_chat 接口）
    
    Args:
        messages: 消息列表
        temperature: 温度参数
        max_tokens: 最大token数
        stream: 是否流式输出
        on_chunk: 流式输出时的回调函数
        
    Returns:
        包含 success, content, error 的字典
    """
    llm = get_llm()
    return llm.chat(messages, temperature, max_tokens, stream, on_chunk)


def text_to_speech(text: str, output_path: str = "output.wav", voice: str = None) -> bool:
    """
    调用本地MOSS-TTS模型将文本转换为语音
    
    Args:
        text: 要转换的文本
        output_path: 输出音频文件路径（默认.wav格式）
        voice: 保留参数但不使用（MOSS-TTS通过参考音频控制音色）
    
    Returns:
        bool: 是否成功
    """
    try:
        return moss_tts.generate(text, output_path)
    except Exception as e:
        print(f"TTS转换失败: {str(e)}")
        return False


def deepseek_chat_with_tts(
    messages: List[Dict[str, str]],
    output_audio_path: str = "output.wav",
    temperature: float = 0.7,
    max_tokens: int = 2048
) -> Dict[str, Any]:
    """
    调用 DeepSeek 生成回复并转换为语音
    
    Args:
        messages: 对话消息列表
        output_audio_path: 输出音频文件路径
        temperature: LLM温度参数
        max_tokens: 最大token数
        
    Returns:
        包含 success, text, audio_path, error 的字典
    """
    # 调用LLM生成文本
    result = deepseek_chat(messages, temperature, max_tokens)
    
    if not result.get("success"):
        return {
            "success": False,
            "text": "",
            "audio_path": "",
            "error": result.get("error", "LLM调用失败")
        }
    
    text = result.get("content", "")
    
    # 调用TTS生成音频
    if text_to_speech(text, output_audio_path):
        return {
            "success": True,
            "text": text,
            "audio_path": output_audio_path,
            "error": None
        }
    else:
        return {
            "success": False,
            "text": text,
            "audio_path": "",
            "error": "TTS转换失败"
        }


# ==================== 使用示例 ====================

if __name__ == "__main__":
    print("=" * 60)
    print("DeepSeek + MOSS-TTS 测试")
    print("=" * 60)
    
    # 检查环境变量
    if not os.environ.get("DEEPSEEK_API_KEY"):
        print("\n错误：请设置 DEEPSEEK_API_KEY 环境变量")
        print("示例: $env:DEEPSEEK_API_KEY='your-api-key' (PowerShell)")
        sys.exit(1)
    
    # 测试1: 简单对话
    print("\n测试1: 简单对话")
    messages = [{"role": "user", "content": "你好，请用一句话介绍自己。"}]
    result = deepseek_chat(messages, temperature=0.7, max_tokens=100)
    
    if result["success"]:
        print(f"回复: {result['content']}")
    else:
        print(f"错误: {result['error']}")
    
    # 测试2: 对话+TTS
    print("\n测试2: 对话+TTS")
    result = deepseek_chat_with_tts(
        messages=[{"role": "user", "content": "你好，世界！"}],
        output_audio_path="test_output.wav",
        temperature=0.7,
        max_tokens=100
    )
    
    if result["success"]:
        print(f"文本: {result['text']}")
        print(f"音频: {result['audio_path']}")
    else:
        print(f"错误: {result['error']}")
