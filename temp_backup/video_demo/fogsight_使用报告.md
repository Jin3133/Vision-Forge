# Fogsight 使用报告：集成到资源生成智能体

## 项目概述

Fogsight（雾象）是一款由大型语言模型（LLM）驱动的动画引擎 Agent。用户输入抽象概念或词语，系统会将其转化为高水平的生动动画。

**核心能力**：
- 概念即影像：输入主题，自动生成包含双语旁白与电影级视觉质感的完整动画
- 智能编排：LLM 自动完成从旁白、视觉元素到动态效果的整个创作流程
- 语言用户界面（LUI）：通过多轮对话对动画进行精准调优和迭代

---

## 快速集成指南

### 1. 环境准备

**依赖要求**：
- Python 3.10+
- 现代浏览器（Chrome/Firefox/Edge）
- LLM API 密钥（推荐 Google Gemini 2.5 Pro）

**安装依赖**：
```bash
pip install fastapi uvicorn pydantic openai jinja2 pytz google-genai requests
```

### 2. 核心代码集成

#### 2.1 后端集成

将以下核心模块集成到您的资源生成智能体中：

**文件结构**：
```
your_project/
├── app.py              # 主服务入口
├── credentials.json    # API 密钥配置
├── templates/
│   └── index.html      # 前端模板
└── static/
    ├── script.js       # 前端交互逻辑
    └── style.css       # 样式文件
```

**核心服务代码**（精简版）：

```python
import asyncio
import json
from typing import AsyncGenerator, Optional
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel

# 配置
with open("credentials.json") as f:
    credentials = json.load(f)

API_KEY = credentials["API_KEY"]
BASE_URL = credentials.get("BASE_URL", "")
MODEL = credentials.get("MODEL", "gemini-2.5-pro")

# 初始化客户端
if API_KEY.startswith("sk-"):
    client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)
    USE_GEMINI = False
else:
    import google.generativeai as genai
    os.environ["GEMINI_API_KEY"] = API_KEY
    gemini_client = genai.Client()
    USE_GEMINI = True

app = FastAPI()

class ChatRequest(BaseModel):
    topic: str
    history: Optional[list] = None

async def llm_event_stream(topic: str, history: Optional[list] = None) -> AsyncGenerator[str, None]:
    """核心流式生成器"""
    system_prompt = f"""请你生成一个非常精美的动态动画,讲讲 {topic}
要动态的,要像一个完整的,正在播放的视频。包含一个完整的过程，能把知识点讲清楚。
页面极为精美，好看，有设计感，同时能够很好的传达知识。知识和图像要准确
附带一些旁白式的文字解说,从头到尾讲清楚一个小的知识点
不需要任何互动按钮,直接开始播放
使用和谐好看，广泛采用的浅色配色方案，使用很多的，丰富的视觉元素。双语字幕
**请保证任何一个元素都在一个2k分辨率的容器中被摆在了正确的位置，避免穿模，字幕遮挡，图形位置错误等等问题影响正确的视觉传达**
html+css+js+svg，放进一个html里"""

    messages = [
        {"role": "system", "content": system_prompt},
        *(history or []),
        {"role": "user", "content": topic},
    ]

    response = await client.chat.completions.create(
        model=MODEL,
        messages=messages,
        stream=True,
        temperature=0.8,
    )

    async for chunk in response:
        token = chunk.choices[0].delta.content or ""
        if token:
            payload = json.dumps({"token": token}, ensure_ascii=False)
            yield f"data: {payload}\n\n"
            await asyncio.sleep(0.001)

    yield 'data: {"event":"[DONE]"}\n\n'

@app.post("/generate")
async def generate(chat_request: ChatRequest, request: Request):
    """动画生成接口"""
    async def event_generator():
        async for chunk in llm_event_stream(chat_request.topic, chat_request.history):
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-store",
            "Content-Type": "text/event-stream; charset=utf-8",
            "X-Accel-Buffering": "no",
        }
    )
```

#### 2.2 API 密钥配置

创建 `credentials.json`：

```json
{
    "API_KEY": "your-gemini-api-key",
    "BASE_URL": "",
    "MODEL": "gemini-2.5-pro"
}
```

**支持的模型配置**：

| 提供商 | API_KEY 格式 | BASE_URL | 推荐模型 |
|--------|-------------|----------|----------|
| Gemini | 非 sk- 开头 | 空字符串 | gemini-2.5-pro |
| OpenRouter | sk-or-v1-... | https://openrouter.ai/api/v1 | anthropic/claude-sonnet-4 |
| OpenAI | sk-... | https://api.openai.com/v1 | gpt-4o |

#### 2.3 前端集成

**关键前端代码**（简化版）：

```javascript
// 调用生成接口
async function generateAnimation(topic, history = []) {
    const response = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, history })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedCode = '';
    let inCodeBlock = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));

                if (data.event === '[DONE]') {
                    // 动画代码接收完成
                    return accumulatedCode;
                }

                const token = data.token || '';

                // 检测代码块开始/结束
                if (!inCodeBlock && token.includes('```')) {
                    inCodeBlock = true;
                } else if (inCodeBlock) {
                    if (token.includes('```')) {
                        inCodeBlock = false;
                    } else {
                        accumulatedCode += token;
                    }
                }
            }
        }
    }
}

// 渲染动画
function renderAnimation(htmlContent, container) {
    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts allow-same-origin';
    iframe.srcdoc = htmlContent;
    container.appendChild(iframe);
}
```

### 3. 集成到资源生成智能体的建议

#### 3.1 作为微服务部署

**方案 A：独立服务调用**
```python
# 在您的资源生成智能体中调用 Fogsight 服务
import requests

def generate_video_resource(concept: str) -> str:
    """生成概念动画视频资源"""
    response = requests.post(
        "http://fogsight-service:8000/generate",
        json={"topic": concept, "history": []},
        stream=True
    )

    html_content = ""
    for line in response.iter_lines():
        if line.startswith(b'data: '):
            data = json.loads(line[6:])
            if data.get('event') == '[DONE]':
                break
            html_content += data.get('token', '')

    return html_content  # 返回完整的 HTML 动画代码
```

**方案 B：模块化集成**

将 `llm_event_stream` 函数作为模块导入：

```python
# 在您的项目中
from fogsight_core import generate_animation_stream

class ResourceGenerator:
    async def create_animation(self, concept: str):
        """集成 Fogsight 动画生成能力"""
        async for chunk in generate_animation_stream(concept):
            yield chunk
```

#### 3.2 自定义 Prompt 模板

根据您的资源生成需求，可以修改系统 Prompt：

```python
# 针对教育资源的 Prompt
EDUCATION_PROMPT = """生成一个教育动画，讲解 {topic}
要求：
1. 适合 K12 学生理解
2. 包含互动元素（如暂停、继续按钮）
3. 使用明亮活泼的配色
4. 添加知识点总结卡片
输出：单个 HTML 文件，包含所有 CSS/JS"""

# 针对技术概念的 Prompt
TECH_PROMPT = """生成一个技术概念可视化动画，讲解 {topic}
要求：
1. 使用深色主题，科技感设计
2. 包含代码高亮展示
3. 流程图/架构图动画
4. 专业术语解释
输出：单个 HTML 文件，包含所有 CSS/JS"""
```

### 4. 启动与部署

#### 4.1 本地开发

```bash
# 方式 1：直接启动
python app.py

# 方式 2：使用启动脚本
python start_fogsight.py  # 自动打开浏览器

# 方式 3：使用 uvicorn
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

#### 4.2 Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 指定端口
docker-compose -e HOST_PORT=3000 up -d
```

### 5. 接口规范

#### 请求格式

```http
POST /generate
Content-Type: application/json

{
    "topic": "冒泡排序",
    "history": [
        {"role": "user", "content": "之前的输入"},
        {"role": "assistant", "content": "之前的回复"}
    ]
}
```

#### 响应格式（SSE 流）

```
data: {"token": "<html>..."}

data: {"token": "<body>..."}

data: {"event":"[DONE]"}
```

### 6. 常见问题

| 问题 | 解决方案 |
|------|----------|
| LLM 服务不可用 | 检查 API_KEY 和 BASE_URL 配置 |
| 返回的 HTML 解析失败 | 调整提示词，明确要求完整 HTML 结构 |
| 生成内容不符合预期 | 使用 history 参数进行多轮对话调优 |
| 动画元素位置错乱 | 在 Prompt 中强调 2K 分辨率容器约束 |

---

## 总结

Fogsight 的核心价值在于：**通过 LLM 将抽象概念自动转化为可视化动画**。集成到资源生成智能体时，重点关注：

1. **Prompt 工程**：根据您的场景定制系统提示词
2. **流式处理**：正确处理 SSE 流式响应
3. **多轮对话**：利用 history 参数实现迭代优化
4. **安全隔离**：使用 iframe sandbox 渲染生成的 HTML
