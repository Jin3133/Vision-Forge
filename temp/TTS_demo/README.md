# 星火大模型 + 讯飞TTS 封装

本项目整合星火大模型（LLM）和讯飞超拟人TTS，支持同步调用和流式TTS管道。

## 安装依赖

```bash
pip install websocket-client requests python-dotenv
```

## 配置API密钥

创建 `.env` 文件：

```env
SPARK_APP_ID=你的APP_ID
SPARK_API_KEY=你的API_KEY
SPARK_API_SECRET=你的API_SECRET
TTS_APP_ID=你的APP_ID
TTS_API_KEY=你的API_KEY
TTS_API_SECRET=你的API_SECRET
```

## 核心功能

### 1. LLM调用（spark_llm.py）

#### 同步调用

```python
from spark_llm import spark_chat

messages = [{"role": "user", "content": "你好"}]
result = spark_chat(messages)

if result["success"]:
    print(result["content"])  # LLM回复
```

#### 流式调用

```python
from spark_llm import spark_chat_stream

def on_chunk(chunk: str):
    print(chunk, end='', flush=True)

result = spark_chat_stream(messages, on_chunk=on_chunk)
```

### 2. Pipeline调用

#### 同步Pipeline（streaming_pipeline.py）

```python
from streaming_pipeline import DualLLMStreamingPipeline
from spark_llm import spark_chat, text_to_speech

pipeline = DualLLMStreamingPipeline(spark_chat_func=spark_chat)

# 处理文本
result = pipeline.process_sync(messages=messages)

# 完整流程（含TTS）
result = pipeline.process_with_tts(
    messages=messages,
    tts_func=text_to_speech,
    output_prefix="output"
)
```

#### 真流式Pipeline（async_pipeline.py）

```python
from async_pipeline import TrueStreamingTTS
from spark_llm import spark_chat_stream, text_to_speech

streaming_tts = TrueStreamingTTS(
    spark_chat_stream_func=spark_chat_stream,
    tts_func=text_to_speech,
    output_dir="./output"
)

result = streaming_tts.process(messages=messages)
```

## Pipeline流程图

### 同步Pipeline流程

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  用户   │────▶│  LLM1   │────▶│  分块   │────▶│  TTS    │
│  输入   │     │  生成   │     │  清洗   │     │  合成   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
                                                      │
                                                      ▼
                                               ┌─────────┐
                                               │  音频   │
                                               │  输出   │
                                               └─────────┘
```

### 真流式Pipeline流程

```
┌─────────┐
│  用户   │
│  输入   │
└────┬────┘
     │
     ▼
┌─────────┐     ┌─────────┐     ┌─────────┐
│  LLM1   │────▶│  分块   │────▶│  文本   │
│ 流式生成 │     │  器     │     │  队列   │
└─────────┘     └─────────┘     └────┬────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
              ┌─────────┐      ┌─────────┐      ┌─────────┐
              │ TTS线程 │      │ TTS线程 │      │ TTS线程 │
              │   1     │      │   2     │      │   N     │
              └────┬────┘      └────┬────┘      └────┬────┘
                   │                │                │
                   └────────────────┼────────────────┘
                                   ▼
                            ┌─────────────┐
                            │  有序音频    │
                            │  缓冲区      │
                            └──────┬──────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │  按序输出    │
                            │  音频段      │
                            └─────────────┘
```

## 演示程序

```bash
# 控制台演示
python console_demo.py

# 真流式TTS演示
python true_streaming_demo.py
```

## 直接运行

```bash
python spark_llm.py
```
