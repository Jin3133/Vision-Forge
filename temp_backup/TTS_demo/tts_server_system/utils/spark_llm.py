"""
星火大模型 + 本地MOSS-TTS 封装函数

依赖库:
    pip install websocket-client requests

用法示例见文件末尾
"""

import base64
import hashlib
import hmac
import json
import os
import time
import random
from datetime import datetime
from typing import Dict, Any
from urllib.parse import urlencode, urlparse

import requests
from dotenv import load_dotenv

try:
    import websocket
except ImportError:
    print("请先安装websocket-client: pip install websocket-client")
    websocket = None

# 加载环境变量
load_dotenv()

# 导入本地MOSS-TTS模块
from local_moss_tts import moss_tts

# ==================== 配置区域 ====================

SPARK_LLM_CONFIG = {
    "app_id": os.getenv("SPARK_APP_ID"),
    "api_key": os.getenv("SPARK_API_KEY"),
    "api_secret": os.getenv("SPARK_API_SECRET"),
    "gpt_url": os.getenv("SPARK_GPT_URL", "wss://spark-api.xf-yun.com/v3.5/chat"),
    "domain": os.getenv("SPARK_DOMAIN", "generalv3.5"),
}


# ==================== 工具函数 ====================

def create_url():
    """生成星火WebSocket鉴权URL"""
    parsed_url = urlparse(SPARK_LLM_CONFIG["gpt_url"])
    host = parsed_url.netloc
    path = parsed_url.path

    # 生成RFC1123格式时间戳
    now = datetime.now()
    date = format_date_time(now)

    # 拼接签名字符串 (使用\n作为行尾符)
    signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"

    # 使用APISecret进行HMAC-SHA256签名
    signature_sha = hmac.new(
        SPARK_LLM_CONFIG["api_secret"].encode('utf-8'),
        signature_origin.encode('utf-8'),
        digestmod=hashlib.sha256
    ).digest()

    # Base64编码签名
    signature = base64.b64encode(signature_sha).decode('utf-8')

    # 构建authorization字段
    authorization_origin = (
        f'api_key="{SPARK_LLM_CONFIG["api_key"]}", '
        f'algorithm="hmac-sha256", '
        f'headers="host date request-line", '
        f'signature="{signature}"'
    )

    # Base64编码整个authorization
    authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode('utf-8')

    # 构建鉴权参数字典
    v = {
        "authorization": authorization,
        "date": date,
        "host": host
    }

    # 生成最终URL
    return SPARK_LLM_CONFIG["gpt_url"] + '?' + urlencode(v)


def format_date_time(dt):
    """格式化日期时间为RFC 1123格式"""
    from wsgiref.handlers import format_date_time
    from time import mktime
    return format_date_time(mktime(dt.timetuple()))


# ==================== 函数1: 直接调用星火LLM ====================

def spark_chat(
    messages: list[Dict[str, str]],
    temperature: float = 0.5,
    max_tokens: int = 2048
) -> Dict[str, Any]:
    """
    直接调用星火大模型API，获取文本响应
    """
    if not messages or len(messages) == 0:
        raise ValueError("messages不能为空")

    if websocket is None:
        return {
            "content": "",
            "usage": {},
            "success": False,
            "error": "websocket-client库未安装"
        }

    # 构建请求体
    payload = {
        "header": {
            "app_id": SPARK_LLM_CONFIG["app_id"],
            "uid": f"user_{int(time.time())}_{random.randint(1000, 9999)}"
        },
        "parameter": {
            "chat": {
                "domain": SPARK_LLM_CONFIG["domain"],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "auditing": "default"
            }
        },
        "payload": {
            "message": {
                "text": messages
            }
        }
    }

    try:
        # 生成鉴权URL
        url = create_url()

        # 建立WebSocket连接
        ws = websocket.WebSocket()
        ws.connect(url, timeout=30)

        # 发送请求
        ws.send(json.dumps(payload))

        # 接收响应
        response_text = ""
        usage = {}

        while True:
            result = ws.recv()
            data = json.loads(result)

            # 检查错误码
            if data.get("header", {}).get("code") != 0:
                error_msg = data.get("header", {}).get("message", "未知错误")
                ws.close()
                return {
                    "content": "",
                    "usage": {},
                    "success": False,
                    "error": f"API调用失败: {error_msg}"
                }

            # 提取内容
            choices = data.get("payload", {}).get("choices", {})
            text_parts = choices.get("text", [])

            for part in text_parts:
                response_text += part.get("content", "")

            # 提取usage信息
            usage = data.get("payload", {}).get("usage", {})

            # 检查是否结束
            if choices.get("status") == 2:
                break

        ws.close()

        return {
            "content": response_text,
            "usage": usage,
            "success": True
        }

    except Exception as e:
        return {
            "content": "",
            "usage": {},
            "success": False,
            "error": f"请求错误: {str(e)}"
        }


# ==================== 新增: 流式LLM调用 ====================

from typing import Generator, Callable

def spark_chat_stream(
    messages: list[Dict[str, str]],
    on_chunk: Callable[[str], None],
    temperature: float = 0.5,
    max_tokens: int = 2048
) -> Dict[str, Any]:
    """
    流式调用星火大模型API，实时返回文本片段
    
    Args:
        messages: 对话消息列表
        on_chunk: 回调函数，每当收到新文本片段时调用
        temperature: 温度参数
        max_tokens: 最大token数
        
    Returns:
        包含完整响应和usage信息的字典
    """
    if not messages or len(messages) == 0:
        raise ValueError("messages不能为空")

    if websocket is None:
        return {
            "content": "",
            "usage": {},
            "success": False,
            "error": "websocket-client库未安装"
        }

    # 构建请求体
    payload = {
        "header": {
            "app_id": SPARK_LLM_CONFIG["app_id"],
            "uid": f"user_{int(time.time())}_{random.randint(1000, 9999)}"
        },
        "parameter": {
            "chat": {
                "domain": SPARK_LLM_CONFIG["domain"],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "auditing": "default"
            }
        },
        "payload": {
            "message": {
                "text": messages
            }
        }
    }

    try:
        # 生成鉴权URL
        url = create_url()

        # 建立WebSocket连接
        ws = websocket.WebSocket()
        ws.connect(url, timeout=30)

        # 发送请求
        ws.send(json.dumps(payload))

        # 接收响应
        response_text = ""
        usage = {}

        while True:
            result = ws.recv()
            data = json.loads(result)

            # 检查错误码
            if data.get("header", {}).get("code") != 0:
                error_msg = data.get("header", {}).get("message", "未知错误")
                ws.close()
                return {
                    "content": response_text,
                    "usage": {},
                    "success": False,
                    "error": f"API调用失败: {error_msg}"
                }

            # 提取内容
            choices = data.get("payload", {}).get("choices", {})
            text_parts = choices.get("text", [])

            for part in text_parts:
                chunk = part.get("content", "")
                if chunk:
                    response_text += chunk
                    # 实时回调
                    on_chunk(chunk)

            # 提取usage信息
            usage = data.get("payload", {}).get("usage", {})

            # 检查是否结束
            if choices.get("status") == 2:
                break

        ws.close()

        return {
            "content": response_text,
            "usage": usage,
            "success": True
        }

    except Exception as e:
        return {
            "content": "",
            "usage": {},
            "success": False,
            "error": f"请求错误: {str(e)}"
        }


# ==================== 函数2: 星火LLM + 本地MOSS-TTS ====================

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


def spark_chat_with_tts(
    messages: list[Dict[str, str]],
    output_audio_path: str = "response.mp3",
    temperature: float = 0.5,
    max_tokens: int = 2048,
    voice: str = "xiaoyan"
) -> Dict[str, Any]:
    """完整流程: 先调用星火大模型获取文本响应，再通过讯飞TTS转换为语音"""
    print("正在调用星火大模型...")
    llm_result = spark_chat(messages, temperature, max_tokens)

    if not llm_result.get("success"):
        return {
            "content": "",
            "audio_path": "",
            "usage": {},
            "success": False,
            "error": llm_result.get("error", "LLM调用失败")
        }

    text_response = llm_result.get("content", "")
    usage = llm_result.get("usage", {})

    if not text_response:
        return {
            "content": "",
            "audio_path": "",
            "usage": usage,
            "success": False,
            "error": "LLM返回内容为空"
        }

    print(f"LLM响应: {text_response[:50]}...")
    print("正在转换为语音...")

    tts_success = text_to_speech(text_response, output_audio_path, voice)

    if tts_success:
        return {
            "content": text_response,
            "audio_path": output_audio_path,
            "usage": usage,
            "success": True
        }
    else:
        return {
            "content": text_response,
            "audio_path": "",
            "usage": usage,
            "success": False,
            "error": "TTS转换失败"
        }


# ==================== 使用示例 ====================

if __name__ == "__main__":
    print("=" * 50)
    print("示例1: 直接调用星火大模型")
    print("=" * 50)

    messages = [{"role": "user", "content": "你好，请介绍一下你自己"}]
    result = spark_chat(messages)

    if result["success"]:
        print(f"LLM回复: {result['content']}")
        print(f"Token使用量: {result['usage']}")
    else:
        print(f"错误: {result.get('error')}")
