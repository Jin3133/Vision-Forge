#!/usr/bin/env python3
"""
MOSS-TTS HTTP API 客户端
用于连接 TTS 服务进行语音合成

使用方法:
    from tts_client import TTSClient
    
    client = TTSClient()
    result = client.synthesize("你好世界", output_file="output.wav")
"""

import os
import time
import base64
import requests
from pathlib import Path
from typing import Optional, Union
from dataclasses import dataclass


@dataclass
class TTSResult:
    """TTS 合成结果"""
    success: bool
    message: str
    audio_data: Optional[bytes] = None
    audio_url: Optional[str] = None
    process_time: float = 0.0
    text_length: int = 0
    sample_rate: int = 24000


class TTSClient:
    """MOSS-TTS HTTP API 客户端"""

    def __init__(self, host: str = "127.0.0.1", port: int = 8080, timeout: int = 300):
        """
        初始化 TTS 客户端

        Args:
            host: 服务地址
            port: 服务端口
            timeout: 请求超时时间（秒）
        """
        self.base_url = f"http://{host}:{port}"
        self.timeout = timeout
        self._check_connection()

    def _check_connection(self):
        """检查服务连接"""
        try:
            response = requests.get(f"{self.base_url}/status", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("model_loaded"):
                    print(f"[TTSClient] 已连接到服务: {self.base_url}")
                    print(f"[TTSClient] 设备: {data.get('device', 'unknown')}")
                    print(f"[TTSClient] 音色: {data.get('voice', 'unknown')}")
                else:
                    print(f"[TTSClient] 警告: 模型尚未加载完成")
            else:
                raise ConnectionError(f"服务返回错误: {response.status_code}")
        except requests.exceptions.ConnectionError:
            raise ConnectionError(
                f"无法连接到 TTS 服务: {self.base_url}\n"
                f"请先启动服务: python tts_server.py"
            )
        except Exception as e:
            raise ConnectionError(f"连接服务失败: {e}")

    def synthesize(
        self,
        text: str,
        output_file: Optional[Union[str, Path]] = None,
        output_format: str = "wav",
        voice: Optional[str] = None,
        speed: float = 1.0
    ) -> TTSResult:
        """
        合成语音

        Args:
            text: 要合成的文本
            output_file: 输出文件路径（可选）
            output_format: 输出格式 - wav, base64
            voice: 音色名称（可选）
            speed: 语速倍数 0.5-2.0

        Returns:
            TTSResult: 合成结果
        """
        start_time = time.time()

        # 准备请求数据
        payload = {
            "text": text,
            "output_format": "base64" if output_file else output_format,
            "speed": speed
        }
        if voice:
            payload["voice"] = voice

        try:
            # 发送请求
            response = requests.post(
                f"{self.base_url}/tts",
                json=payload,
                timeout=self.timeout
            )

            if response.status_code != 200:
                error_msg = response.json().get("detail", "未知错误")
                return TTSResult(
                    success=False,
                    message=f"请求失败: {error_msg}",
                    process_time=time.time() - start_time
                )

            result = response.json()

            if not result.get("success"):
                return TTSResult(
                    success=False,
                    message=result.get("message", "合成失败"),
                    process_time=time.time() - start_time
                )

            # 处理返回结果
            audio_data = None
            if result.get("audio_base64"):
                audio_data = base64.b64decode(result["audio_base64"])

                # 保存到文件
                if output_file:
                    output_path = Path(output_file)
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(output_path, "wb") as f:
                        f.write(audio_data)

            return TTSResult(
                success=True,
                message="合成成功",
                audio_data=audio_data,
                audio_url=result.get("audio_url"),
                process_time=result.get("process_time", time.time() - start_time),
                text_length=result.get("text_length", len(text)),
                sample_rate=result.get("sample_rate", 24000)
            )

        except requests.exceptions.Timeout:
            return TTSResult(
                success=False,
                message=f"请求超时（>{self.timeout}秒）",
                process_time=time.time() - start_time
            )
        except Exception as e:
            return TTSResult(
                success=False,
                message=f"请求异常: {str(e)}",
                process_time=time.time() - start_time
            )

    def get_status(self) -> dict:
        """获取服务状态"""
        try:
            response = requests.get(f"{self.base_url}/status", timeout=5)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    def is_ready(self) -> bool:
        """检查服务是否就绪"""
        status = self.get_status()
        return status.get("model_loaded", False)


# 兼容原有接口的函数
def text_to_speech(
    text: str,
    output_path: str,
    voice: Optional[str] = None,
    host: str = "127.0.0.1",
    port: int = 8080
) -> bool:
    """
    兼容原 text_to_speech 接口

    Args:
        text: 要合成的文本
        output_path: 输出文件路径
        voice: 音色名称（可选）
        host: 服务地址
        port: 服务端口

    Returns:
        bool: 是否成功
    """
    try:
        client = TTSClient(host=host, port=port)
        result = client.synthesize(text, output_file=output_path, voice=voice)
        return result.success
    except Exception as e:
        print(f"[TTS] 合成失败: {e}")
        return False


if __name__ == "__main__":
    # 测试客户端
    import sys

    if len(sys.argv) < 2:
        print("用法: python tts_client.py <文本> [输出文件]")
        print("示例: python tts_client.py '你好世界' output.wav")
        sys.exit(1)

    text = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) > 2 else "test_output.wav"

    print(f"[Test] 合成文本: {text}")
    print(f"[Test] 输出文件: {output}")

    try:
        client = TTSClient()
        result = client.synthesize(text, output_file=output)

        if result.success:
            print(f"[Test] 合成成功!")
            print(f"[Test] 处理时间: {result.process_time:.2f}s")
            print(f"[Test] 文本长度: {result.text_length} 字")
            print(f"[Test] 采样率: {result.sample_rate} Hz")
            print(f"[Test] 文件已保存: {output}")
        else:
            print(f"[Test] 合成失败: {result.message}")
            sys.exit(1)
    except ConnectionError as e:
        print(f"[Test] 连接失败: {e}")
        sys.exit(1)
