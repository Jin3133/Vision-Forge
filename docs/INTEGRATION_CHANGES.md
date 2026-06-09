# Vision-Forge 后端整合前后差异文档

> 修订日期：2026-06-08
> 修订说明：记录三个独立demo整合进backend共享黑板架构的核心变更

---

## 一、架构变更总览

### 1.1 整合前（独立demo运行）

```
temp/MinerU_demo/          # 独立文档解析demo
temp/report_generator_demo/ # 独立报告生成demo
temp/video_demo/           # 独立动画生成demo

backend/                   # 原有后端（FastAPI + 4-Agent流水线）
```

三个demo各自独立运行，各自管理：
- 独立的API Key配置（部分硬编码）
- 独立的异常处理体系
- 独立的LLM调用方式
- 无法被Agent流水线协作使用

### 1.2 整合后（统一共享黑板架构）

```
backend/
├── core/
│   ├── config.py         # 统一配置管理（Settings类）
│   ├── state.py          # 共享黑板（TaskState + StateManager）
│   ├── exceptions.py     # 统一异常体系
│   └── logger.py
├── agents/
│   ├── base_agent.py     # Agent基类（LLMService统一调用）
│   ├── generator_agent.py # 生成Agent（集成报告/动画工具方法）
│   └── ...
├── services/
│   ├── external_services/
│   │   ├── llm_service.py          # 统一LLM调用接口
│   │   ├── document_parser/        # 文档解析模块
│   │   └── report_generator/       # 报告渲染工具
│   └── ...
└── tests/                # 端到端集成测试（119个测试用例）
```

---

## 二、配置管理变更

### 2.1 变更前

| 配置项 | 来源 | 问题 |
|---|---|---|
| 星火API Key | `AgentBase` 硬编码在源码中 | 安全隐患，无法通过.env配置 |
| 星火API URL | `AgentBase` 硬编码在源码中 | 无法切换provider |
| DeepSeek API Key | `report_generator_demo` 环境变量直读 | 各模块不一致 |
| DeepSeek API URL | `report_generator_demo` 环境变量直读 | 各模块不一致 |
| MinerU配置 | 各demo独立硬编码常量 | 分散管理，无统一默认值 |

### 2.2 变更后

所有配置统一通过 `core/config.py` 的 `Settings` 类管理：

```python
# === 大模型配置（原有）===
OPENAI_API_KEY: str = "7ba874a7eae6c25f2bae72e7eace2aba"
OPENAI_API_BASE: str = "https://spark-api-open.xf-yun.com/v1"
SPARK_MODEL_VERSION: str = "generalv3.5"

# === MinerU 文档解析配置（新增）===
MINERU_BASE_URL: str = "https://mineru.net"
MINERU_MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
MINERU_TIMEOUT: int = 120
MINERU_POLL_INTERVAL: int = 3

# === DeepSeek 模型配置（新增）===
DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
DEEPSEEK_REPORT_MODEL: str = "deepseek-v4-flash"
DEEPSEEK_ANIMATION_MODEL: str = "deepseek-v4-flash"

# === 报告生成配置（新增）===
REPORT_MAX_ITERATIONS: int = 30
REPORT_TEMPERATURE: float = 0.7

# === 动画生成配置（新增）===
ANIMATION_TEMPERATURE: float = 0.7
ANIMATION_MAX_TOKENS: int = 100000
```

**改进点**：
- 所有API Key和URL统一从settings读取
- 支持通过`.env`文件覆盖默认值
- DeepSeek模型名称统一为`deepseek-v4-flash`

### 2.3 环境配置分层重构（2026-06-08）

> 修订说明：将敏感信息从代码中彻底剥离，引入 `.env / .env.local` 双层配置。

#### 2.3.1 变更前的问题

| 问题 | 影响 |
|---|---|
| `OPENAI_API_KEY` 在 `config.py` 中硬编码真实 key | 任何 commit 都会泄露密钥；任何团队成员克隆代码都拥有完整生产凭证 |
| `SECRET_KEY` 硬编码为 `"dev_key_only_for_testing_12345"` | 即便注释说明是 dev 用的，也存在被误用的风险 |
| 缺少 `.env` 模板 | 新成员需要查阅 README + 翻源码才能知道有哪些可配置项 |

#### 2.3.2 变更后架构

```
优先级 (高 → 低):
  1. .env.local   ← 本地敏感信息（已在 .gitignore 忽略，**不提交**）
  2. .env         ← 团队共享模板（提交，仅含占位符）
  3. config.py    ← 代码层默认值（字符串为 ""，数值为 0）
```

**项目根目录**下新增两个文件：

| 文件 | 用途 | git 状态 |
|---|---|---|
| `.env` | 配置模板，列出所有配置项，使用占位符 | **提交** |
| `.env.local` | 真实密钥/令牌 | **gitignore**（绝对不要提交） |

**`config.py` 重构**：

- 所有字符串字段默认值改为 `""`，所有数值字段默认值改为 `0`
- 通过 `pathlib` 显式定位项目根目录的 `.env` 和 `.env.local`（避免依赖 cwd）
- `env_file` 配置为列表 `[".env", ".env.local"]`，由 pydantic-settings v2 自动按"后者覆盖前者"规则合并

```python
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/core/config.py 向上两级

class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""     # 不再硬编码
    SECRET_KEY: str = ""         # 不再硬编码
    MINERU_BASE_URL: str = ""    # 字符串默认值统一为空串
    # ...

    model_config = SettingsConfigDict(
        env_file=[
            str(BASE_DIR / ".env"),         # 先加载
            str(BASE_DIR / ".env.local"),   # 后加载，覆盖前者
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )
```

#### 2.3.3 `.gitignore` 调整

`.env` 之前**在** gitignore 中，意味着没有任何模板可被新成员参考。本次调整：

```diff
- # Environments
- .env
- .envrc
+ # Environments
+ # 注意：.env 作为团队共享模板保留并提交；.env.local 含本地敏感信息，必须忽略。
+ .env.local
+ .env.*.local
+ .envrc
```

#### 2.3.4 验证结果

| 场景 | 期望行为 | 实测 |
|---|---|---|
| `.env.local` 存在（正常情况） | 读到 `.env.local` 的真实 key | ✅ 星火连通性测试通过 |
| `.env.local` 缺失 | 回退到 `.env` 的占位值 | ✅ 验证通过 |
| 两个文件都缺失 | 全部使用代码层默认值（空串/0） | ✅ 验证通过 |
| 完整测试套件（连通性 + 配置 + LLMService） | 43/43 通过 | ✅ |

#### 2.3.5 迁移指南（给团队成员）

1. 拉取最新代码后，**复制** `.env` 为 `.env.local`：
   ```bash
   cp .env .env.local   # Linux/macOS
   Copy-Item .env .env.local   # PowerShell
   ```
2. 在 `.env.local` 中填入真实的 `OPENAI_API_KEY`、`SECRET_KEY`、`DEEPSEEK_API_KEY` 等
3. **不要**再次粘贴真实 key 到任何对话/issue/截图——已泄露的 key 应立即在讯飞控制台重置

---

## 三、异常处理变更

### 3.1 变更前

各模块独立定义异常类：
- `MinerU_demo/exceptions.py`：`MinerUApiError`、`MinerURateLimitError`、`MinerUTimeoutError`
- `video_demo/exceptions.py`：`LLMGenerationError`、`ConfigurationError`、`PromptTemplateError`
- `report_generator_demo`：使用装饰器处理异常，无统一异常类
- `backend/agents/`：无统一异常处理，LLM调用失败直接返回错误字符串

### 3.2 变更后

统一异常体系（`core/exceptions.py`）：

```
VisionForgeError (基类)
├── LLMServiceError (provider: str)
│   ├── LLMRateLimitError
│   └── LLMTimeoutError
├── DocumentParseError
│   ├── UnsupportedFileTypeError
│   ├── ParseTimeoutError
│   └── MinerUApiError
│       ├── MinerURateLimitError
│       └── MinerUTimeoutError
├── ReportGenerationError
├── AnimationGenerationError
└── ConfigurationError (missing_keys: list)
```

**改进点**：
- 统一的异常基类，包含`message`、`code`、`details`属性
- 完整的异常层级，便于分类捕获
- `ConfigurationError`包含`missing_keys`属性，便于提示缺失配置
- 所有模块使用统一异常，不重复定义

---

## 四、LLM调用变更

### 4.1 变更前

| 模块 | LLM调用方式 | 问题 |
|---|---|---|
| `AgentBase` | 硬编码OpenAI客户端，直接调用 | 安全隐患，无法切换provider |
| `report_generator_demo` | DeepSeek API + Function Calling | 独立管理，无统一接口 |
| `video_demo` | DeepSeek API + PromptTemplate | 独立管理，无统一接口 |

### 4.2 变更后

统一LLM调用接口（`services/external_services/llm_service.py`）：

```python
class LLMService:
    _client_cache: dict = {}  # 按provider缓存客户端
    
    @classmethod
    def get_client(cls, provider: str) -> OpenAI:
        """获取指定provider的OpenAI兼容客户端"""
        if provider == "spark":
            client = OpenAI(api_key=settings.OPENAI_API_KEY,
                          base_url=settings.OPENAI_API_BASE)
        elif provider == "deepseek":
            client = OpenAI(api_key=settings.DEEPSEEK_API_KEY,
                          base_url=settings.DEEPSEEK_BASE_URL)
        # 缓存复用
    
    @classmethod
    def chat(cls, messages, provider="spark", model=None, 
             temperature=0.7, tools=None, **kwargs) -> str:
        """统一聊天接口"""
        client = cls.get_client(provider)
        # 异常转换为LLMServiceError子类
```

**改进点**：
- 所有LLM调用统一通过`LLMService.chat()`
- 支持多provider（spark/deepseek）动态切换
- 客户端按provider缓存复用
- OpenAI异常自动转换为统一异常体系

---

## 五、Agent系统变更

### 5.1 AgentBase变更

**变更前**：
```python
class AgentBase(ABC):
    def __init__(self, name, role_prompt):
        REAL_KEY = "7ba874a7eae6c25f2bae72e7eace2aba:NmFlMTlmMGMyMmVmNzNiMWUxZmJhNTVh"
        REAL_URL = "https://spark-api-open.xf-yun.com/v1"
        self.llm_client = OpenAI(api_key=REAL_KEY, base_url=REAL_URL)
        self.model_version = "generalv3.5"
```

**变更后**：
```python
class AgentBase(ABC):
    def __init__(self, name, role_prompt):
        self._llm_provider = "spark"
        self._llm_model = settings.SPARK_MODEL_VERSION
    
    def call_llm(self, user_input, temperature=0.7) -> str:
        return LLMService.chat(
            messages=[...],
            provider=self._llm_provider,
            model=self._llm_model,
            temperature=temperature,
        )
```

### 5.2 GeneratorAgent变更

**变更前**：
- 仅生成简单HTML讲义片段
- 返回 `{"final_report_html": html, "current_step": "completed"}`
- 报告生成和动画生成分别在独立demo中，无法被Agent调用

**变更后**：
```python
class GeneratorAgent(AgentBase):
    def _generate_report(self, state: TaskState) -> str:
        """从黑板读取评估结果，调用DeepSeek API生成HTML报告"""
        evaluation = self.read_blackboard(state, "evaluation_results")
        sandbox = self.read_blackboard(state, "sandbox_config")
        # 调用LLMService.chat(provider="deepseek")
        return html_report
    
    def _generate_animation(self, state: TaskState) -> str:
        """从黑板读取用户意图，调用DeepSeek API生成HTML动画"""
        user_intent = self.read_blackboard(state, "user_intent")
        # 调用LLMService.chat(provider="deepseek")
        return html_animation
    
    def run(self, state: TaskState) -> Dict[str, Any]:
        return {
            "final_report_html": self._generate_report(state),
            "animation_html": self._generate_animation(state),
            "current_step": "completed",
        }
```

**改进点**：
- 报告生成和动画生成为GeneratorAgent内部工具方法
- 通过黑板读取数据，通过黑板返回结果
- 不作为独立API端点暴露，保持流水线内聚性

---

## 六、共享黑板变更

### 6.1 TaskState字段扩展

**变更前**：
```python
class TaskState(BaseModel):
    session_id: str
    user_intent: str = ""
    learner_profile: Dict = {}
    sandbox_config: SandboxConfig = ...
    missing_knowledge: List = []
    evaluation_results: Dict = {}
    history: List = []
    current_step: str = "init"
```

**变更后**：
```python
class TaskState(BaseModel):
    # 原有字段...
    
    # 新增字段（支持文档解析和生成结果）
    parsed_document_content: str = ""  # 文档解析结果
    final_report_html: str = ""         # 报告生成结果
    animation_html: str = ""             # 动画生成结果
```

### 6.2 数据流变更

**变更前**：
```
文档解析 → 独立文件，不参与Agent流水线
报告生成 → 独立demo，通过API调用
动画生成 → 独立demo，通过API调用
```

**变更后**：
```
文档解析 → parse_document() → 写入黑板.parsed_document_content
                                         ↓
                                    Agent流水线
                                         ↓
GeneratorAgent ← 读取黑板.evaluation_results/sandbox_config
     ↓
_generate_report() → 调用DeepSeek API → 写入黑板.final_report_html
_generate_animation() → 调用DeepSeek API → 写入黑板.animation_html
```

---

## 七、模块迁移对照

### 7.1 文档解析模块

| 变更前 | 变更后 |
|---|---|
| `temp/MinerU_demo/mineru_api.py` | `backend/services/external_services/document_parser/mineru_api.py` |
| `temp/MinerU_demo/parser.py` | `backend/services/external_services/document_parser/parser.py` |
| `temp/MinerU_demo/fallback_parsers.py` | `backend/services/external_services/document_parser/fallback_parsers.py` |
| 异常类独立定义 | 使用`core/exceptions.py`统一异常 |
| 配置硬编码 | 从`settings`读取 |
| CLI入口`demo.py` | 由GeneratorAgent内部调用替代 |

### 7.2 报告生成模块

| 变更前 | 变更后 |
|---|---|
| `temp/report_generator_demo/render_tools.py` | `backend/services/external_services/report_generator/render_tools.py` |
| `temp/report_generator_demo/agent.py` | 整合为`GeneratorAgent._generate_report()` |
| 独立API端点暴露 | 作为GeneratorAgent内部方法 |
| 异常独立处理 | 使用`core/exceptions.py` |
| DeepSeek Key直读环境变量 | 从`settings`读取 |

### 7.3 动画生成模块

| 变更前 | 变更后 |
|---|---|
| `temp/video_demo/spark_animation_generator/llm_agent.py` | 整合为`GeneratorAgent._generate_animation()` |
| `temp/video_demo/spark_animation_generator/prompts.py` | 整合为prompt模板 |
| `temp/video_demo/spark_animation_generator/config.py` | 整合为`settings`配置项 |
| `temp/video_demo/spark_animation_generator/exceptions.py` | 删除，使用`core/exceptions.py` |
| 独立API端点暴露 | 作为GeneratorAgent内部方法 |

---

## 八、测试覆盖变更

### 8.1 新增测试

| 测试文件 | 覆盖范围 |
|---|---|
| `tests/test_exceptions.py` | 44个测试，覆盖12个异常类的层级关系和属性 |
| `tests/test_config.py` | 24个测试，覆盖所有新增配置项的默认值 |
| `tests/test_llm_service.py` | 10个测试，覆盖LLMService的get_client和chat方法 |
| `tests/test_document_parser.py` | 12个测试，覆盖文档解析各文件类型和降级行为 |
| `tests/test_generator_agent.py` | 13个测试，覆盖_generate_report和_generate_animation |
| `tests/test_blackboard_flow.py` | 16个测试，覆盖黑板数据流和线程安全 |

**测试结果**：119个测试全部通过

### 8.2 测试策略

- TDD优先：测试用例先于实现代码编写
- 外部API调用全部mock，不依赖真实网络
- 测试隔离：每个测试独立运行，互不依赖

---

## 九、依赖变更

### 9.1 新增依赖

```
# 文档解析
requests>=2.28.0
python-pptx>=0.6.21
python-docx>=0.8.11
Pillow>=9.0.0
openpyxl>=3.0.0

# LLM调用
openai>=1.0.0
httpx>=0.24.0

# 配置管理
pydantic-settings>=2.0.0
```

### 9.2 依赖管理

所有依赖统一在`backend/requirements.txt`中管理，不再分散在各个demo的requirements.txt中。

---

## 十、向后兼容性

### 10.1 API接口兼容性

- `POST /api/v1/chat` 接口保持不变
- Agent流水线执行逻辑保持不变
- 黑板读写接口保持兼容

### 10.2 配置兼容性

- 原有配置项（`OPENAI_API_KEY`等）保持不变
- 新增配置项全部有默认值，可选配置
- `.env`文件覆盖机制保持不变

### 10.3 潜在影响

| 变更项 | 影响范围 | 缓解措施 |
|---|---|---|
| AgentBase移除硬编码Key | 依赖旧Key的代码 | 从settings读取，需配置.env |
| GeneratorAgent新增工具方法 | 无外部影响 | 内部集成，不影响外部API |
| 文档解析模块路径变更 | 直接import该模块的代码 | 已迁移到新路径 |

---

## 十一、后续扩展建议

1. **异步化改造**：当前保持同步设计，预留异步扩展空间
2. **Function Calling增强**：报告生成可扩展为完整的Function Calling模式
3. **文档解析任务队列**：长时间解析任务可改为异步任务模式
4. **缓存机制**：可引入Redis缓存已解析的文档内容
