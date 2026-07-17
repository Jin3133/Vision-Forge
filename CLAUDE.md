# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言规范
1. 所有输出内容统一使用简体中文，包含项目分析、代码修改说明、优化方案、报错解释、注释文案；
2. 仅专业术语、包名、接口名、变量名等英文单词允许保留，其余描述性文字全部中文；
3. 除非特殊要求，优先输出完整中文内容，不混用英文段落。

## 项目概述

Vision-Forge 是一个「视觉大模型微调 + 多智能体启发式教学」平台（软件杯 A3 赛题）。前端提供拖拽式算子沙盒画布 + 学习 Dashboard，后端用四个智能体协同完成「架构引导 → 源码教研 → 学情评估 → 资源生成」的教学流水线。

- 后端：FastAPI + OpenAI SDK（对接讯飞星火 `spark-api-open.xf-yun.com`）+ SQLAlchemy + SQLite（状态持久化 + 用户数据）
- 前端：React 19 + Vite + `@xyflow/react`（ReactFlow 画布）+ react-router-dom（HashRouter）+ Recharts（图表）
- 核心架构：全局共享黑板状态机（Blackboard）+ SQLite 持久化 + RagService 双通道检索
- 前端状态管理：AuthContext（Mock JWT 认证）+ LearnContext（学习闭环状态机前端镜像）+ UserContext（用户信息）

## 常用命令

### 后端（在 `backend/` 目录下运行）
```bash
# 启动服务，端口必须是 17077（前端代理写死了这个端口）
uvicorn main:app --host 0.0.0.0 --port 17077

# 内网穿透（cpolar），使前端能通过公网访问后端 API
cpolar http 17077 -subdomain=vision-forge -region=cn

# 单独跑某个智能体的自测（文件末尾带 __main__ 单元测试）
python -m agents.architect_agent
python -m agents.tutor_agent
python -m agents.evaluator_agent
python -m agents.generator_agent

# 测试星火大模型连通性
python test_spark.py
```

依赖安装：仓库根目录的 `requirements.txt` 是完整 Anaconda 环境（含 torch/ultralytics/mmcv 等重量级包）；`backend/requirements.txt` 是运行最小集；`backend/requirements-dev.txt` 是开发工具。

### 前端（在 `frontend/` 目录下运行）
```bash
npm install
npm run dev       # 端口 5173，/api 代理到 127.0.0.1:17077，allowedHosts 已开启（支持 cpolar 穿透）

# 内网穿透（cpolar），公网访问前端页面
cpolar http 5173 -subdomain=vision-forge-web -region=cn

npm run build
npm run preview
```

## 架构要点（跨文件才能看懂的部分）

### 1. 黑板状态机是整个后端的中枢
- `core/state.py`：定义 `TaskState`（全局黑板）、`StateManager`（线程安全单例）和 `StatePersistence`（SQLite 持久化层）。
- 状态按 `session_id` 隔离，内存字典做热缓存，SQLite（WAL 模式）做持久化。**进程重启后会自动从 SQLite 恢复所有会话**。
- **增量合并（Delta Merge）是核心机制**：智能体的 `run()` 只返回被修改的字段（delta），由 `StateManager.update_state()` 定向合并回黑板。合并规则按字段类型区分：`history`/`missing_knowledge` 是追加（extend/append），dict 字段（`learner_profile`/`evaluation_results`）是浅合并（update），`sandbox_config` 是 dict 合并后重建，其余字段直接覆盖。**新增智能体时必须遵守这个约定，不要在 agent 内部直接改状态**。
- `current_step` 是状态机指针，取值：`init` / `architect_stage` / `tutor_stage` / `evaluator_stage` / `generator_stage` / `completed` / `error_stage`。
- 持久化通过 `.env` 配置开关：`STATE_PERSIST_ENABLED=true`，`STATE_DB_PATH=./vision_forge_state.db`。
- `TaskState` 中的 `sandbox_config` 使用 Pydantic 模型（`SandboxConfig` / `NodeModel` / `EdgeModel`）强类型约束，对齐前端 ReactFlow 的 `nodes`/`edges` 结构。

### 2. 流水线编排在 `main_workflow.py`
- `run_vision_forge_pipeline()` 是一个 while 循环（最多 15 步），根据 `current_step` 手动路由到对应智能体，每个智能体返回的 delta 里带着 `current_step` 决定下一棒去哪。
- 固定流转顺序：Architect → Tutor → Evaluator → Generator → completed。
- 防护逻辑：任何异常或流转到 `init`/`error_stage` 都会中断循环；agent 抛异常会被捕获并置为 `error_stage`（绝不回退到 `init`，避免死循环）。
- 支持会话取消：`AgentBase.cancel_session(session_id)` 设置全局取消信号，`is_session_cancelled()` 在循环中检测。

### 3. 四个智能体（`agents/`，都继承 `AgentBase`）
- `base_agent.py`：`AgentBase` 封装星火 LLM 客户端和 `call_llm()`。统一从 `settings`(.env) 读取凭证，支持 `json_mode`（不兼容时自动回退）和指数退避重试（`LLM_MAX_RETRIES`）。提供 `read_blackboard()` / `get_session_id()` / `is_session_cancelled()` 等工具方法。
- `architect_agent.py`：解析用户意图 → 生成 `learner_profile` + `sandbox_config`（JSON）。使用 `core/utils.py` 的四级兜底 JSON 解析器；输出经 `node_catalog` 白名单清洗后才写入黑板。
- `tutor_agent.py`：**动态源码讲解**。根据 `sandbox_config.nodes` 中的算子 name 查 `NODE_TO_SOURCE` 映射表，自动定位 `assets/code_mirror/` 下对应的源码文件（最多 3 个），结合 `learner_profile.cognitive_style` 因材施教。源码文件不存在时自动兜底到 `SE_Block.py`。
- `evaluator_agent.py`：扮演论文评审专家评估架构。**通过 `RagService` 双通道检索**真实论文基准数据（替代了旧的 mock 假数据），然后调用 LLM 生成评估报告。
- `generator_agent.py`：把配置+评估报告排版成含 Mermaid 图的 HTML 讲义，置 `current_step=completed`。输出统一写入 `evaluation_results.final_report_html`（与 main.py 响应映射对齐）。

### 4. JSON 解析器 (`core/utils.py`)
`extract_json_from_llm()` 提供四级兜底策略应对 LLM 输出的各种格式问题：
1. 去围栏后直接 `json.loads`
2. 贪婪抽取最外层 `{...}` 子串再解析
3. 轻量修复（补缺逗号、去尾逗号）
4. 激进修复（单引号→双引号、无引号 key 加引号、去注释、Python 布尔→JSON 布尔、行间缺逗号）
4.5. light + deep 组合修复（额外兜底）

### 5. RagService 双通道检索 (`services/external_services/rag_service.py`)
- 通过 `.env` 中 `RAG_BACKEND` 配置选择通道：`chroma`（本地）/ `ragflow`（远程）/ `none`（关闭）
- **主通道失败自动降级**：ragflow 失败→chroma；chroma 失败→ragflow（如配了 key）
- 双通道都不可用时返回内置领域知识兜底文本（包含 YOLOv9/SE-Net/SAM/FPN 等论文摘要，保证流水线不中断）
- ChromaDB 懒加载（首次检索时才初始化），RagFlow 走 HTTP API（10s 超时）

### 6. 算子节点白名单 (`core/node_catalog.py`)
- `NODE_CATALOG`: 五大类（BACKBONE/ADAPTER/NECK/HEAD/PROCESSING）的合法 type+name 枚举，是前后端的唯一事实来源
- `is_valid_node(type, name)`: 校验函数，被 Architect（清洗输出）和 Evaluate 接口（规则评分）共用
- `catalog_as_prompt()`: 渲染成 LLM prompt 片段，注入 Architect 的 system prompt 强制模型只选合法算子

### 7. 三条独立的 API 路径
`main.py` 里有三个业务接口（用户模块的路由**未挂载**到 main.py）：

- `POST /api/chat`：**走完整的四智能体流水线**（调 `run_vision_forge_pipeline`）。响应包含 `learner_profile`、`sandbox_config`、`evaluation_report`、`tutor_response`、`final_report_html`。
- `POST /api/v1/agent/evaluate`：**规则层 + LLM 层双重评估**。规则层用 `node_catalog` 白名单校验节点合法性、检查架构完整性（BACKBONE+HEAD 必须有）、拓扑连通性、深度惩罚，输出结构化评分（0-99）；LLM 层（`_EvalFeedbackAgent`）基于评分结果生成自然语言反馈。响应包含 `validation_details`（节点统计/非法列表/类型分布/孤立节点计数）。
- `GET /`：健康检查。

### 8. 多模型流式聊天接口 (`services/api/v1/chat.py`)
- `POST /api/v1/chat/stream`：通用大模型多轮流式通信，支持三种模型路由：
  - `chatglm` → 智谱 ChatGLM API
  - `deepseek` → DeepSeek API
  - `kimi` → Moonshot Kimi API
- 返回 `StreamingResponse`（`text/plain`），逐 token 推送。
- Router 已定义但**未在 main.py 中挂载**。

### 9. 用户认证体系（`services/biz_logic/auth.py` + `services/api/v1/user.py`）
- JWT 认证：使用 `python-jose` 库生成/验证 Token，`passlib` + bcrypt 做密码哈希。
- `hash_password()` 目前仍返回明文（注释说跑通后再启用 `pwd_context.hash`），`verify_password()` 做明文比对。
- 角色鉴权：`get_current_admin` / `get_current_teacher` / `get_current_student` 三个依赖注入函数，兼容中英文角色名（"管理员"/"admin" 等）。
- 用户管理 API（`/api/users/*`）：登录、获取当前用户、修改密码、用户列表（分页+角色筛选）、修改角色、删除用户、重置密码、添加用户、模糊搜索。
- **重要**：用户路由和流式聊天路由均在 `services/api/v1/` 下定义了 Router，但**未在 main.py 中 `include_router`**。当前 `main.py` 的实际 API 无鉴权。
- Token 配置：`ACCESS_TOKEN_EXPIRE_MINUTES=10080`（7 天），`SECRET_KEY` 和 `ALGORITHM` 在 `.env` 中配置。

### 10. 数据库层（`core/database.py`）
- SQLAlchemy + SQLite（`DATABASE_URL=sqlite:///./vision_forge.db`）
- `SessionLocal` 会话工厂，`get_db()` FastAPI 依赖注入生成器
- `Base = declarative_base()` ORM 基类
- 智能体调用日志模型（`services/models/module_usage_logs.py`）：记录 `action_type`、`model_name`、`duration_ms`、`tokens_used`、`status`，关联 User 表。

### 11. 日志系统（`core/logger.py`）
- 全局单例 `logger`，同时输出到三个目标：控制台、按启动时间命名的日志文件（`logs/workflow_YYYYMMDD_HHMMSS.log`）、滚动日志文件（`logs/workflow_rolling.log`，单文件最大 50MB，保留 10 个备份）。

### 12. 前后端契约
- `docs/API_SCHEMA_CONTRACT.md` 是前后端交互的唯一标准，定义了算子节点白名单（含难度分级 ★/★★/★★★ 和必填参数说明）和统一响应格式。前端 ReactFlow 的自定义节点必须用白名单里的 `type`/`name`。
- 前端 `src/api.js` 是唯一的后端流水线 API 封装层，请求发到 `/api/*` 由 Vite 代理转发。
- 前端 `src/api/favorites.js` 和 `src/api/notifications.js` 是收藏和通知的独立 API 封装。

### 13. 前端结构

#### 路由（HashRouter，在 `src/App.jsx` 中定义）
| 路由 | 页面 | 说明 |
|------|------|------|
| `/login` | Login | 登录页 |
| `/register` | Register | 注册页 |
| `/forgot-password` | ForgotPassword | 忘记密码 |
| `/welcome` | Welcome | 首次登录引导页（含 4 智能体介绍 + 选择学习目标） |
| `/` | Home | 智能对话主页（默认路由） |
| `/chat` | Home | 同上 |
| `/canvas` | Canvas | 模型工坊/实验记录/模型对比（通过 `?tab=` 切换） |
| `/center` | Center | 学情分析/学习地图（通过 `?tab=` 切换） |
| `/resources` | Resources | 资源中心/资源生成（通过 `?tab=` 切换） |
| `/profile` | Profile | 个人空间/我的收藏（通过 `?tab=` 切换） |
| `/settings` | AccountSettings | 账户设置 |

#### 状态管理层（三层 Context 嵌套）
- **UserContext**：全局用户信息（name/role/avatar/studentId 等），在 `App.jsx` 顶层提供。
- **AuthContext** (`src/AuthContext.jsx`)：Mock JWT 认证系统。核心能力：
  - Mock Token 格式：`mock.xxxx.payload`（base64 编码的 JSON payload，含 `sub`/`iat`/`exp`）
  - Token 持久化：`rememberMe=true` → localStorage；`false` → sessionStorage
  - 过期检测：定时器轮询，过期自动清空并跳转 `/login`
  - 新用户判定：通过 `localStorage['vf_new_users']` 追踪首次登录的用户名
  - 提供 `login()` / `logout()` / `resetPassword()` / `sendCode()` 等方法
  - `PrivateRoute` 组件通过 `useAuth().isAuthenticated` 判断登录态
- **LearnContext** (`src/LearnContext.jsx`)：学习闭环共享状态层（中央状态机前端镜像）。核心字段：
  - `onboarded`：是否完成首启引导
  - `goal`：学习目标（SAM微调/农业遥感/医学分割/目标检测/自定义）
  - `mainStages`：五阶段主线任务（含完成状态和阶段 → 页面跳转映射）
  - `knowledgeMap`：每个模型的掌握度 0-100（SAM/YOLO/ViT/ResNet 等 12 个节点）
  - `weakTopics` / `masteredTopics`：易错点和已掌握主题
  - `lastModelFeedback`：最近一次模型工坊评估反馈
  - 提供 `finishOnboarding()` / `advanceStage()` / `updateKnowledge()` / `submitModelFeedback()` 等方法
  - 阶段版本号机制：`STAGES_VERSION` 变更时自动丢弃旧 localStorage 数据
- **ToastProvider**：全局 Toast 通知。

#### Canvas 画布组件（`src/components/canvas/`）
- `CanvasTopBar.jsx`：画布顶部操作栏
- `NodeDetailDrawer.jsx`：节点详情抽屉
- `SourceCodeDrawer.jsx`：源码伴读抽屉
- `TemplateLibraryDrawer.jsx`：模板库抽屉
- `ToastStack.jsx`：Toast 消息栈
- `VersionHistoryDrawer.jsx`：版本历史抽屉
- `connectionRules.js`：节点连接规则验证
- `templates.js`：预置模板定义
- `useAutosave.js`：画布自动保存 Hook
- `useHistory.js`：画布撤销/重做历史 Hook

#### 学习和个人中心组件
- `src/components/learn/`：`AbilityDelta.jsx`（能力变化）、`CustomPlanSection.jsx`（自定义计划）、`LearningStats.jsx`（学习统计）、`MapTab.jsx`（学习地图）
- `src/components/profile/`：`AchievementsList.jsx`、`EditProfileModal.jsx`、`FavoritesPanel.jsx`、`LearningTrendChart.jsx`、`RecentActivity.jsx`、`StatsGrid.jsx`、`StreakCard.jsx`、`StudyCalendar.jsx`
- `src/components/resources/`：`EmptyState.jsx`、`MarkdownPreview.jsx`、`PdfPreviewModal.jsx`、`ShareModal.jsx`、`Skeleton.jsx`、`Toast.jsx`
- `src/components/notifications/`：`NotificationCenter.jsx`、`NotificationDrawer.jsx`

#### 首页 Dashboard
- `Home.jsx` 是功能最丰富的页面，包含：
  - 4-Agent 流水线阶段条（Architect → Tutor → Generator → Evaluator）
  - 对话区（流式打字输出 + 代码高亮 + 快捷入口）
  - 右侧 Dashboard：今日学习数据、继续学习、今日任务 Checklist、最近学习、最近实验、AI 推荐
  - 1+N 跨学科演示场景（农业遥感/医学影像/电商视觉/自动驾驶）
  - 共享黑板面板（实时展示 Task_State.json）
  - 6 维画像评估问答流程

### 14. 配置管理

所有配置统一通过 `core/config.py`（Pydantic Settings）从 `.env` 文件读取：

| 配置项 | 作用 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | 星火大模型 API Key | （必填） |
| `OPENAI_API_BASE` | LLM 接口地址 | `https://spark-api-open.xf-yun.com/v1` |
| `SPARK_MODEL_VERSION` | 模型版本 | `generalv3.5` |
| `LLM_MAX_RETRIES` | LLM 调用重试次数 | `2` |
| `STATE_PERSIST_ENABLED` | 黑板持久化开关 | `true` |
| `STATE_DB_PATH` | 黑板 SQLite 路径 | `./vision_forge_state.db` |
| `DATABASE_URL` | 用户/日志 SQLite 路径 | `sqlite:///./vision_forge.db` |
| `SECRET_KEY` | JWT 签名密钥 | `dev_key_only_for_testing_12345` |
| `ALGORITHM` | JWT 算法 | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token 有效期（分钟） | `10080`（7天） |
| `RAG_BACKEND` | 检索通道 | `chroma` |
| `RAGFLOW_API_KEY` | RagFlow 远程 Key | （空=不启用） |
| `RAGFLOW_BASE_URL` | RagFlow 地址 | `http://127.0.0.1:9380/v1/api` |
| `RAGFLOW_KB_ID` | RagFlow 知识库 ID | （空） |
| `CHROMA_PERSIST_DIR` | ChromaDB 持久化目录 | `./assets/vector_database` |
| `CHROMA_COLLECTION` | ChromaDB 集合名 | `vision_forge_papers` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | （空） |
| `KIMI_API_KEY` | Kimi API Key | （空） |
| `CHATGLM_API_KEY` | 智谱 ChatGLM API Key | （空） |

## 需要注意的坑

- **端口耦合**：后端必须跑 17077，改端口需同步改 `frontend/vite.config.js` 的 proxy target。
- **用户/鉴权模块未接线**：`services/api/v1/user.py` 和 `services/api/v1/chat.py` 定义了 Router 但 `main.py` **没有 `include_router` 挂载它们**，当前 `main.py` 的三个 API 无鉴权。密码目前是明文比对（`auth.py` 里 `hash_password` 直接返回原文，注释说跑通后再换 bcrypt）。
- **前端认证是 Mock**：`AuthContext.jsx` 中登录/注册/重置密码全部走 Mock API（`mockLoginApi` 等），不调用后端。任何非空用户名 + 密码≥6 位即登录成功。接入真实后端时需要把 Mock 函数体换成 fetch 调用。
- **Tutor 源码资产**：`NODE_TO_SOURCE` 映射了全部白名单算子到源码文件名，但 `assets/code_mirror/` 下目前只有 `SE_Block.py`。新增算子讲解时需要往该目录放对应的 `.py` 文件，否则会 fallback 到 SE_Block。
- **ChromaDB 向量库为空**：`assets/vector_database/` 需要预先灌入论文数据才能真正检索到内容，否则 RagService 会走兜底文本。
- **根目录 requirements.txt** 是完整 Anaconda 环境导出（含 torch/ultralytics/mmcv/spyder/jupyter 等），不是项目运行最小集，不适合直接 `pip install -r requirements.txt`。运行后端用 `backend/requirements.txt`。
- 项目注释和文档全部用中文，改动时保持一致的中文注释风格。
- `docs/README.md` 和 `docs/architecture_design.md` 目前是空文件。
- 前端 `LearnContext` 的阶段版本号 `STAGES_VERSION=2`：修改 `DEFAULT_STAGES_BY_GOAL` 结构时需同步 +1，否则用户旧 localStorage 数据自动失效。
- Canvas 的 `nodeColors` 和 `NODE_TO_KNOWLEDGE` 映射在前端 `Canvas.jsx` 中定义，与后端 `node_catalog.py` 的白名单是两套独立维护的体系。
- `vite.config.js` 已开启 `allowedHosts: true`（支持 cpolar 等内网穿透），生产部署时需评估安全风险。
