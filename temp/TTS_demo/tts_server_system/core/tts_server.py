#!/usr/bin/env python3
"""
MOSS-TTS HTTP API 服务
提供简单的 TTS 生成接口，支持预加载模型保持内存

使用方法:
    python tts_server.py              # 前台运行
    python tts_server.py --daemon     # 后台守护进程模式
    python tts_server.py --stop       # 停止服务
"""

import os
import sys
import time
import signal
import argparse
import base64
import io
import json
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, asdict

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field
import uvicorn

from local_moss_tts import moss_tts
from tts_config import SAMPLE_RATE, VOICE_NAME

PID_FILE = Path(__file__).parent / ".tts_server.pid"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8080

app = FastAPI(title="MOSS-TTS API", version="1.0.0")


class TTSRequest(BaseModel):
    text: str = Field(..., description="要合成的文本", min_length=1, max_length=5000)
    voice: Optional[str] = Field(None, description="音色名称（可选）")
    output_format: str = Field("wav", description="输出格式: wav, mp3, base64")
    speed: float = Field(1.0, description="语速倍数 (0.5-2.0)", ge=0.5, le=2.0)


class TTSResponse(BaseModel):
    success: bool
    message: str
    audio_url: Optional[str] = None
    audio_base64: Optional[str] = None
    duration: Optional[float] = None
    sample_rate: int = SAMPLE_RATE
    text_length: int = 0
    process_time: float = 0.0


class ServerStatus(BaseModel):
    status: str
    model_loaded: bool
    device: str
    voice: str
    uptime: float
    host: str
    port: int


start_time = time.time()
server_config = {"host": DEFAULT_HOST, "port": DEFAULT_PORT}


@app.on_event("startup")
async def startup_event():
    """服务启动时自动加载模型"""
    print("[TTS Server] 正在加载模型...")
    if not moss_tts.is_loaded:
        success = moss_tts.warm_start()
        if success:
            print(f"[TTS Server] 模型加载成功，设备: {moss_tts.device}")
        else:
            print("[TTS Server] 模型加载失败!")
            raise RuntimeError("模型加载失败")
    else:
        print(f"[TTS Server] 模型已加载，设备: {moss_tts.device}")


@app.get("/")
async def root():
    """根路径"""
    return {
        "service": "MOSS-TTS API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "/status",
        "tts_endpoint": "/tts"
    }


@app.get("/status", response_model=ServerStatus)
async def get_status():
    """获取服务状态"""
    return ServerStatus(
        status="running" if moss_tts.is_loaded else "loading",
        model_loaded=moss_tts.is_loaded,
        device=moss_tts.device,
        voice=VOICE_NAME,
        uptime=time.time() - start_time,
        host=server_config["host"],
        port=server_config["port"]
    )


@app.post("/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest, background_tasks: BackgroundTasks):
    """
    文本转语音接口

    - **text**: 要合成的文本（必填）
    - **voice**: 音色名称（可选，当前忽略）
    - **output_format**: 输出格式 - wav, mp3, base64（默认wav）
    - **speed**: 语速倍数 0.5-2.0（默认1.0）
    """
    if not moss_tts.is_loaded:
        raise HTTPException(status_code=503, detail="模型尚未加载完成")

    start = time.time()

    # 创建临时输出文件
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    timestamp = int(time.time() * 1000)
    output_file = output_dir / f"tts_{timestamp}.wav"

    try:
        # 调用 TTS 生成
        success = moss_tts.generate(request.text, str(output_file))

        if not success:
            raise HTTPException(status_code=500, detail="TTS 生成失败")

        process_time = time.time() - start

        # 根据输出格式返回
        if request.output_format == "base64":
            # 读取文件并转为 base64
            with open(output_file, "rb") as f:
                audio_data = f.read()
            audio_base64 = base64.b64encode(audio_data).decode("utf-8")

            # 清理临时文件
            background_tasks.add_task(lambda: output_file.unlink(missing_ok=True))

            return TTSResponse(
                success=True,
                message="生成成功",
                audio_base64=audio_base64,
                sample_rate=SAMPLE_RATE,
                text_length=len(request.text),
                process_time=process_time
            )

        elif request.output_format in ["wav", "mp3"]:
            # 返回文件 URL
            audio_url = f"/audio/tts_{timestamp}.wav"

            # 后台清理旧文件（保留最近10个）
            background_tasks.add_task(cleanup_old_files, output_dir, keep=10)

            return TTSResponse(
                success=True,
                message="生成成功",
                audio_url=audio_url,
                sample_rate=SAMPLE_RATE,
                text_length=len(request.text),
                process_time=process_time
            )

        else:
            raise HTTPException(status_code=400, detail=f"不支持的输出格式: {request.output_format}")

    except HTTPException:
        raise
    except Exception as e:
        # 清理临时文件
        if output_file.exists():
            output_file.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


@app.get("/audio/{filename}")
async def get_audio(filename: str):
    """获取音频文件"""
    output_dir = Path(__file__).parent / "output"
    file_path = output_dir / filename

    # 安全检查：确保文件在 output 目录内
    try:
        file_path.relative_to(output_dir)
    except ValueError:
        raise HTTPException(status_code=403, detail="非法路径")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        path=file_path,
        media_type="audio/wav",
        filename=filename
    )


def cleanup_old_files(directory: Path, keep: int = 10):
    """清理旧文件，保留最近 N 个"""
    try:
        files = sorted(directory.glob("tts_*.wav"), key=lambda x: x.stat().st_mtime, reverse=True)
        for old_file in files[keep:]:
            old_file.unlink(missing_ok=True)
    except Exception as e:
        print(f"[Cleanup] 清理失败: {e}")


def is_server_running() -> bool:
    """检查服务是否正在运行"""
    if not PID_FILE.exists():
        return False
    try:
        with open(PID_FILE, 'r') as f:
            data = json.load(f)
            pid = data.get('pid')
        if pid:
            os.kill(pid, 0)
            return True
        return False
    except (ValueError, OSError, ProcessLookupError, json.JSONDecodeError):
        return False


def stop_server():
    """停止服务"""
    if not PID_FILE.exists():
        print("[INFO] 服务未运行")
        return True

    try:
        with open(PID_FILE, 'r') as f:
            data = json.load(f)
            pid = data.get('pid')

        if pid:
            os.kill(pid, signal.SIGTERM)
            print(f"[OK] 已发送停止信号到进程 {pid}")

            # 等待进程结束
            for _ in range(10):
                if not is_server_running():
                    break
                time.sleep(0.5)

        if PID_FILE.exists():
            PID_FILE.unlink()

        return True
    except Exception as e:
        print(f"[FAIL] 停止服务失败: {e}")
        return False


def run_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, daemon: bool = False):
    """运行服务"""
    if is_server_running():
        print("[INFO] 服务已在运行")
        return True

    server_config["host"] = host
    server_config["port"] = port

    if daemon:
        # 后台运行
        try:
            import subprocess
            cmd = [sys.executable, __file__, "--host", host, "--port", str(port)]
            subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
            print(f"[OK] 服务已在后台启动 http://{host}:{port}")
            return True
        except Exception as e:
            print(f"[FAIL] 后台启动失败: {e}")
            return False
    else:
        # 前台运行
        with open(PID_FILE, 'w') as f:
            json.dump({'pid': os.getpid(), 'host': host, 'port': port}, f)

        print(f"[OK] 服务启动 http://{host}:{port}")
        print(f"[INFO] API 文档: http://{host}:{port}/docs")
        uvicorn.run(app, host=host, port=port)


def main():
    parser = argparse.ArgumentParser(description='MOSS-TTS HTTP API 服务')
    parser.add_argument('--host', type=str, default=DEFAULT_HOST, help='监听地址')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='监听端口')
    parser.add_argument('--daemon', action='store_true', help='后台运行')
    parser.add_argument('--stop', action='store_true', help='停止服务')
    parser.add_argument('--status', action='store_true', help='查看状态')
    args = parser.parse_args()

    if args.stop:
        success = stop_server()
        sys.exit(0 if success else 1)

    if args.status:
        if is_server_running():
            try:
                with open(PID_FILE, 'r') as f:
                    data = json.load(f)
                print(f"[OK] 服务正在运行")
                print(f"[INFO] 地址: http://{data.get('host', DEFAULT_HOST)}:{data.get('port', DEFAULT_PORT)}")
                print(f"[INFO] 模型已加载: {moss_tts.is_loaded}")
                print(f"[INFO] 设备: {moss_tts.device}")
            except Exception as e:
                print(f"[OK] 服务正在运行 (PID文件读取失败: {e})")
        else:
            print("[INFO] 服务未运行")
        sys.exit(0)

    success = run_server(host=args.host, port=args.port, daemon=args.daemon)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
