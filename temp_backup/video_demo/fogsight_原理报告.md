# Fogsight 原理报告：智能体编排与架构分析

## 1. 系统架构总览

Fogsight 采用经典的 **B/S 架构**，整体分为三层：

```
┌─────────────────────────────────────────────────────────────┐
│                        表现层 (Frontend)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  输入界面    │  │  对话界面    │  │  动画播放器 (iframe) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/SSE
┌─────────────────────────────────────────────────────────────┐
│                        服务层 (Backend)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              FastAPI Web 服务                        │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │  /generate  │  │  流式响应    │  │  会话管理    │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ API 调用
┌─────────────────────────────────────────────────────────────┐
│                        智能层 (LLM)                           │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │   Gemini 2.5    │ or │  OpenAI 兼容    │                 │
│  │    (原生)       │    │   (OpenRouter)  │                 │
│  └─────────────────┘    └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 智能体编排机制

### 2.1 编排核心思想

Fogsight 的核心编排机制可以概括为：**"Prompt Engineering + 流式生成 + 多轮对话"**

```
┌──────────────────────────────────────────────────────────────┐
│                      智能体编排流程                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   用户输入 ──► Prompt 构建 ──► LLM 生成 ──► 代码提取 ──► 渲染 │
│      │                           │                           │
│      │                           ▼                           │
│      │                      流式输出 (SSE)                    │
│      │                           │                           │
│      │                           ▼                           │
│      │                    增量代码显示                        │
│      │                           │                           │
│      └────────◄── 多轮对话反馈 ◄──┘                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Prompt 工程详解

**系统 Prompt 结构分析**：

```python
system_prompt = f"""请你生成一个非常精美的动态动画,讲讲 {topic}
要动态的,要像一个完整的,正在播放的视频。包含一个完整的过程，能把知识点讲清楚。
页面极为精美，好看，有设计感，同时能够很好的传达知识。知识和图像要准确
附带一些旁白式的文字解说,从头到尾讲清楚一个小的知识点
不需要任何互动按钮,直接开始播放
使用和谐好看，广泛采用的浅色配色方案，使用很多的，丰富的视觉元素。双语字幕
**请保证任何一个元素都在一个2k分辨率的容器中被摆在了正确的位置，避免穿模，字幕遮挡，图形位置错误等等问题影响正确的视觉传达**
html+css+js+svg，放进一个html里"""
```

**Prompt 设计要点解析**：

| 设计要素 | 目的 | 实现效果 |
|----------|------|----------|
| "非常精美的动态动画" | 设定质量期望 | 引导 LLM 生成高质量视觉效果 |
| "完整的、正在播放的视频" | 定义输出形式 | 确保生成的是动画而非静态页面 |
| "知识点讲清楚" | 约束内容准确性 | 保证教育/知识传达的有效性 |
| "2K分辨率容器" | 技术约束 | 避免元素位置错乱、穿模等问题 |
| "html+css+js+svg" | 格式规范 | 限定技术栈，确保可执行性 |
| "放进一个html里" | 交付形式 | 便于嵌入和传输 |

### 2.3 多轮对话机制

**会话状态管理**：

```python
class ChatRequest(BaseModel):
    topic: str
    history: Optional[List[dict]] = None  # 多轮对话历史
```

**对话流程**：

```
第一轮：
用户 ──► "冒泡排序" ──► LLM ──► 生成动画代码
                              │
第二轮：                              ▼
用户 ──► "把速度调慢一点" ──► LLM (携带历史)
                              │
                              ▼
                        基于历史上下文优化
```

**历史消息拼接逻辑**：

```python
messages = [
    {"role": "system", "content": system_prompt},  # 系统指令
    *history,                                        # 历史对话
    {"role": "user", "content": topic},             # 当前输入
]
```

---

## 3. 流式生成架构

### 3.1 SSE (Server-Sent Events) 流

Fogsight 使用 SSE 实现实时流式输出，让用户能够"看到"LLM 的生成过程。

**服务端实现**：

```python
async def llm_event_stream(topic: str, history: Optional[list] = None) -> AsyncGenerator[str, None]:
    # 调用 LLM 流式接口
    response = await client.chat.completions.create(
        model=MODEL,
        messages=messages,
        stream=True,  # 启用流式输出
        temperature=0.8,
    )

    # 逐块返回
    async for chunk in response:
        token = chunk.choices[0].delta.content or ""
        if token:
            payload = json.dumps({"token": token}, ensure_ascii=False)
            yield f"data: {payload}\n\n"  # SSE 格式
            await asyncio.sleep(0.001)   # 控制流速

    yield 'data: {"event":"[DONE]"}\n\n'  # 结束标记
```

**SSE 协议格式**：

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-store

# 数据块 1
data: {"token": "<html>"}

# 数据块 2
data: {"token": "<head>"}

# 结束标记
data: {"event":"[DONE]"}
```

### 3.2 前端流式处理

```javascript
async function startGeneration(topic) {
    const response = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, history: conversationHistory })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));
                // 实时更新 UI
                updateCodeDisplay(data.token);
            }
        }
    }
}
```

---

## 4. 代码提取与渲染

### 4.1 Markdown 代码块提取

LLM 返回的内容通常包裹在 Markdown 代码块中，前端需要提取纯代码：

```javascript
let inCodeBlock = false;
let accumulatedCode = '';

function processToken(token) {
    if (!inCodeBlock && token.includes('```')) {
        // 检测到代码块开始
        inCodeBlock = true;
        const content = token.substring(token.indexOf('```') + 3)
                            .replace(/^html\n/, '');
        accumulatedCode += content;
    } else if (inCodeBlock) {
        if (token.includes('```')) {
            // 代码块结束
            inCodeBlock = false;
            const content = token.substring(0, token.indexOf('```'));
            accumulatedCode += content;
        } else {
            // 代码内容
            accumulatedCode += token;
        }
    }
}
```

### 4.2 安全渲染机制

**iframe Sandbox 隔离**：

```javascript
function appendAnimationPlayer(htmlContent) {
    const iframe = document.createElement('iframe');

    // 安全沙箱配置
    iframe.sandbox = 'allow-scripts allow-same-origin';
    // - allow-scripts: 允许执行 JS 动画
    // - allow-same-origin: 允许同域访问

    iframe.srcdoc = htmlContent;  // 直接注入 HTML
}
```

**HTML 有效性验证**：

```javascript
function isHtmlContentValid(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    // 检查解析错误
    const parseErrors = doc.querySelectorAll("parsererror");
    if (parseErrors.length > 0) return false;

    // 检查内容非空
    if (!doc.body || doc.body.innerHTML.trim() === "") return false;

    return true;
}
```

---

## 5. 多模型适配架构

### 5.1 模型路由策略

```python
# 根据 API_KEY 格式自动选择模型
if API_KEY.startswith("sk-"):
    # OpenAI 兼容接口 (OpenRouter/OpenAI)
    client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)
    USE_GEMINI = False
else:
    # Gemini 原生接口
    os.environ["GEMINI_API_KEY"] = API_KEY
    gemini_client = genai.Client()
    USE_GEMINI = True
```

### 5.2 统一调用接口

```python
async def llm_event_stream(topic: str, history: Optional[list] = None) -> AsyncGenerator[str, None]:
    if USE_GEMINI:
        # Gemini 调用方式
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: gemini_client.models.generate_content(
                model=model,
                contents=full_prompt
            )
        )
        # 手动分块输出
        text = response.text
        for i in range(0, len(text), chunk_size):
            chunk = text[i:i+chunk_size]
            yield f"data: {json.dumps({'token': chunk})}\n\n"
            await asyncio.sleep(0.05)
    else:
        # OpenAI 兼容调用方式
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            temperature=0.8,
        )
        # 原生流式输出
        async for chunk in response:
            token = chunk.choices[0].delta.content or ""
            yield f"data: {json.dumps({'token': token})}\n\n"
```

---

## 6. 前端架构设计

### 6.1 视图状态管理

Fogsight 前端采用**双视图状态机**：

```
┌──────────────────────────────────────────────────────────────┐
│                      视图状态转换图                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌───────────────┐         提交生成          ┌─────────────┐│
│   │  Initial View │ ────────────────────────► │  Chat View  ││
│   │   (初始界面)   │                           │  (对话界面)  ││
│   └───────────────┘                           └─────────────┘│
│         ▲                                            │       │
│         │                                            │       │
│         └──────────── 点击"新对话" ───────────────────┘       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 组件模板系统

使用 HTML `<template>` 实现组件化：

```html
<!-- 用户消息模板 -->
<template id="user-message-template">
    <div class="message-group user">
        <div class="message-bubble">${text}</div>
    </div>
</template>

<!-- Agent 状态模板 -->
<template id="agent-status-template">
    <div class="message-group agent">
        <div class="status-bubble">
            <div class="thinking-dots"><span></span><span></span><span></span></div>
            <p>${text}</p>
        </div>
    </div>
</template>

<!-- 代码展示模板 -->
<template id="agent-code-template">
    <div class="message-group agent has-code">
        <details class="code-details" open>
            <summary class="code-summary">
                <span>生成代码中...</span>
            </summary>
            <div class="code-content"><pre><code></code></pre></div>
        </details>
    </div>
</template>

<!-- 动画播放器模板 -->
<template id="animation-player-template">
    <div class="message-group agent has-player">
        <div class="player-container">
            <div class="iframe-wrapper">
                <iframe class="animation-iframe" sandbox="allow-scripts allow-same-origin"></iframe>
            </div>
            <div class="player-actions">
                <button class="action-button open-new-window">在新窗口中打开</button>
                <button class="action-button save-html">保存为 HTML</button>
            </div>
        </div>
    </div>
</template>
```

### 6.3 国际化 (i18n) 实现

```javascript
const translations = {
    heroTitle: {
        zh: "在此赋予概念以生命，转瞬之间",
        en: "Bring Concepts to Life Here"
    },
    agentThinking: {
        zh: "Fogsight Agent 正在进行思考与规划，请稍后...",
        en: "Fogsight Agent is thinking and planning, please wait..."
    },
    // ...
};

function setLanguage(lang) {
    document.querySelectorAll('[data-translate-key]').forEach(el => {
        const key = el.dataset.translateKey;
        const translation = translations[key]?.[lang];
        if (translation) {
            if (el.hasAttribute('placeholder'))
                el.placeholder = translation;
            else if (el.hasAttribute('title'))
                el.title = translation;
            else
                el.textContent = translation;
        }
    });
}
```

---

## 7. 关键技术决策分析

### 7.1 为什么选择 SSE 而非 WebSocket？

| 方案 | 优点 | 缺点 | Fogsight 选择 |
|------|------|------|---------------|
| SSE | 实现简单、自动重连、基于 HTTP | 单向通信 | ✅ 选用 |
| WebSocket | 双向通信、低延迟 | 实现复杂、需要额外握手 | ❌ 不需要双向 |

**决策理由**：Fogsight 只需要服务端向客户端推送数据，SSE 完全满足需求且实现更简单。

### 7.2 为什么选择 iframe 渲染？

| 方案 | 优点 | 缺点 | Fogsight 选择 |
|------|------|------|---------------|
| iframe | 完全隔离、安全沙箱、独立上下文 | 通信受限 | ✅ 选用 |
| Shadow DOM | 样式隔离、DOM 隔离 | JS 仍共享、复杂度高 | ❌ 不够安全 |
| 直接插入 | 简单 | 安全风险、样式冲突 | ❌ 风险太高 |

**决策理由**：LLM 生成的代码不可完全信任，iframe sandbox 提供最强的安全隔离。

### 7.3 为什么使用单文件 HTML 输出？

```
优势：
1. 便于传输 ──► 单个字符串即可
2. 便于存储 ──► 直接保存为 .html 文件
3. 便于嵌入 ──► iframe srcdoc 直接加载
4. 便于分享 ──► 文件即可分享
```

---

## 8. 架构扩展性分析

### 8.1 水平扩展能力

```
                    ┌─────────────┐
                    │   负载均衡   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  Fogsight   │ │  Fogsight   │ │  Fogsight   │
    │  Instance 1 │ │  Instance 2 │ │  Instance N │
    └─────────────┘ └─────────────┘ └─────────────┘
```

**无状态设计**：服务端不保存会话状态，所有状态通过 `history` 参数传递，便于水平扩展。

### 8.2 功能扩展点

| 扩展方向 | 实现方式 |
|----------|----------|
| 支持更多模型 | 在 `llm_event_stream` 中添加新的 provider 分支 |
| 支持更多输出格式 | 修改 Prompt，要求输出 SVG/Canvas/WebGL |
| 添加后处理 | 在代码提取后添加格式化/压缩/优化步骤 |
| 添加缓存 | 对相同 topic 的生成结果进行缓存 |

---

## 9. 总结

Fogsight 的架构设计体现了以下核心思想：

1. **Prompt 即编排**：通过精心设计的 Prompt 引导 LLM 完成复杂的代码生成任务，无需额外的编排框架

2. **流式即体验**：SSE 流式输出让用户感知生成进度，提升交互体验

3. **隔离即安全**：iframe sandbox 确保 LLM 生成代码的安全执行

4. **简单即优雅**：整个系统架构简洁，核心逻辑仅约 200 行代码，但功能完整

这种架构特别适合**概念可视化**、**教育内容生成**、**技术文档动画化**等场景，可以作为资源生成智能体的核心动画生成模块。
