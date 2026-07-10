# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言规范
1. 所有输出内容统一使用简体中文，包含项目分析、代码修改说明、优化方案、报错解释、注释文案；
2. 仅专业术语、包名、接口名、变量名等英文单词允许保留，其余描述性文字全部中文；
3. 除非特殊要求，优先输出完整中文内容，不混用英文段落。

## 项目概述

Vision-Forge 是一个「视觉大模型微调 + 多智能体启发式教学」平台（软件杯 A3 赛题）。前端提供拖拽式算子沙盒画布，后端用四个智能体协同完成「架构引导 → 源码教研 → 学情评估 → 资源生成」的教学流水线。

- 后端：FastAPI + OpenAI SDK（对接讯飞星火 `spark-api-open.xf-yun.com`）+ SQLAlchemy + SQLite（状态持久化）
- 前端：React 19 + Vite + `@xyflow/react`（ReactFlow 画布）+ react-router-dom（HashRouter）
- 核心架构：全局共享黑板状态机（Blackboard）+ SQLite 持久化 + RagService 双通道检索

## 常用命令

### 后端（在 `backend/` 目录下运行）
```bash
# 启动服务，端口必须是 17077（前端代理写死了这个端口）
uvicorn main:app --host 0.0.0.0 --port 17077 --reload

# 单独跑某个智能体的自测（文件末尾带 __main__ 单元测试）
python -m agents.evaluator_agent
python -m agents.tutor_agent
python -m agents.generator_agent
python -m agents.architect_agent

# 测试星火大模型连通性
python test_spark.py
```

依赖安装：仓库根目录的 `requirements.txt` 是完整环境（含 torch 等大包）；`backend/requirements.txt` 是运行最小集（fastapi/uvicorn/langgraph/chromadb/pydantic/python-dotenv）；`backend/requirements-dev.txt` 是开发工具（pytest/black/isort）。

### 前端（在 `frontend/` 目录下运行）
```bash
npm install
npm run dev       # 端口 5173，/api 代理到 127.0.0.1:17077
npm run build
npm run preview
```

## 架构要点（跨文件才能看懂的部分）

### 1. 黑板状态机是整个后端的中枢
- `core/state.py`：定义 `TaskState`（全局黑板）、`StateManager`（线程安全单例）和 `StatePersistence`（SQLite 持久化层）。
- 状态按 `session_id` 隔离，内存字典做热缓存，SQLite（WAL 模式）做持久化。**进程重启后会自动从 SQLite 恢复所有会话**。
- **增量合并（Delta Merge）是核心机制**：智能体的 `run()` 只返回被修改的字段（delta），由 `StateManager.update_state()` 定向合并回黑板。合并规则按字段类型区分：`history`/`missing_knowledge` 是追加（extend/append），dict 字段（`learner_profile`/`evaluation_results`）是浅合并（update），其余字段直接覆盖。**新增智能体时必须遵守这个约定，不要在 agent 内部直接改状态**。
- `current_step` 是状态机指针，取值：`init` / `architect_stage` / `tutor_stage` / `evaluator_stage` / `generator_stage` / `completed` / `error_stage`。
- 持久化通过 `.env` 配置开关：`STATE_PERSIST_ENABLED=true`，`STATE_DB_PATH=./vision_forge_state.db`。

### 2. 流水线编排在 `main_workflow.py`
- `run_vision_forge_pipeline()` 是一个 while 循环（最多 15 步），根据 `current_step` 手动路由到对应智能体，每个智能体返回的 delta 里带着 `current_step` 决定下一棒去哪。
- 固定流转顺序：Architect → Tutor → Evaluator → Generator → completed。
- 防护逻辑：任何异常或流转到 `init`/`error_stage` 都会中断循环；agent 抛异常会被捕获并置为 `error_stage`（绝不回退到 `init`，避免死循环）。

### 3. 四个智能体（`agents/`，都继承 `AgentBase`）
- `base_agent.py`：`AgentBase` 封装星火 LLM 客户端和 `call_llm()`。统一从 `settings`(.env) 读取凭证，支持 `json_mode`（不兼容时自动回退）和指数退避重试（`LLM_MAX_RETRIES`）。
- `architect_agent.py`：解析用户意图 → 生成 `learner_profile` + `sandbox_config`（JSON）。使用 `core/utils.py` 的四级兜底 JSON 解析器；输出经 `node_catalog` 白名单清洗后才写入黑板。
- `tutor_agent.py`：**动态源码讲解**。根据 `sandbox_config.nodes` 中的算子 name 查 `NODE_TO_SOURCE` 映射表，自动定位 `assets/code_mirror/` 下对应的源码文件（最多 3 个），结合 `learner_profile.cognitive_style` 因材施教。源码文件不存在时自动兜底到 `SE_Block.py`。
- `evaluator_agent.py`：扮演论文评审专家评估架构。**通过 `RagService` 双通道检索**真实论文基准数据（替代了旧的 mock 假数据），然后调用 LLM 生成评估报告。
- `generator_agent.py`：把配置+评估报告排版成含 Mermaid 图的 HTML 讲义，置 `current_step=completed`。

### 4. JSON 解析器 (`core/utils.py`)
`extract_json_from_llm()` 提供四级兜底策略应对 LLM 输出的各种格式问题：
1. 去围栏后直接 `json.loads`
2. 贪婪抽取最外层 `{...}` 子串再解析
3. 轻量修复（补缺逗号、去尾逗号）
4. 激进修复（单引号→双引号、无引号 key 加引号、去注释、Python 布尔→JSON 布尔、行间缺逗号）

### 5. RagService 双通道检索 (`services/external_services/rag_service.py`)
- 通过 `.env` 中 `RAG_BACKEND` 配置选择通道：`chroma`（本地）/ `ragflow`（远程）/ `none`（关闭）
- **主通道失败自动降级**：ragflow 失败→chroma；chroma 失败→ragflow（如配了 key）
- 双通道都不可用时返回内置领域知识兜底文本（保证流水线不中断）
- ChromaDB 懒加载（首次检索时才初始化），RagFlow 走 HTTP API（10s 超时）

### 6. 算子节点白名单 (`core/node_catalog.py`)
- `NODE_CATALOG`: 五大类（BACKBONE/ADAPTER/NECK/HEAD/PROCESSING）的合法 type+name 枚举，是前后端的唯一事实来源
- `is_valid_node(type, name)`: 校验函数，被 Architect（清洗输出）和 Evaluate 接口（规则评分）共用
- `catalog_as_prompt()`: 渲染成 LLM prompt 片段，注入 Architect 的 system prompt 强制模型只选合法算子

### 7. 两条独立的接口路径
`main.py` 里有两个业务接口：
- `POST /api/chat`：**走完整的四智能体流水线**（调 `run_vision_forge_pipeline`）。
- `POST /api/v1/agent/evaluate`：**规则层 + LLM 层双重评估**。规则层用 `node_catalog` 白名单校验节点合法性、检查架构完整性（BACKBONE+HEAD 必须有）、拓扑连通性，输出结构化评分；LLM 层（`_EvalFeedbackAgent`）基于评分结果生成自然语言反馈。响应包含 `validation_details`（节点统计/非法列表/类型分布）。

### 8. 前后端契约
- `docs/API_SCHEMA_CONTRACT.md` 是前后端交互的唯一标准，定义了算子节点白名单和统一响应格式。前端 ReactFlow 的自定义节点必须用白名单里的 `type`/`name`。
- 前端 `src/api.js` 是唯一的 API 封装层，请求发到 `/api/*` 由 Vite 代理转发。

### 9. 前端结构
- `src/App.jsx`：包含全部布局（侧边导航 + 顶栏）、路由（HashRouter）、`UserContext`。登录态用 `localStorage.isLoggedIn` 判断（`PrivateRoute`）。
- `src/pages/`：Home（智能对话）、Canvas（模型工坊/画布）、Center（学情分析）、Resources（资源中心）、Tutor（知识辅导）、Profile、Login、Register。
- 路由用 query 参数 `?tab=` 区分同一页面下的子功能。

## 配置管理

所有配置统一通过 `core/config.py`（Pydantic Settings）从 `.env` 文件读取：

| 配置项 | 作用 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | 星火大模型 API Key | （必填） |
| `OPENAI_API_BASE` | LLM 接口地址 | `https://spark-api-open.xf-yun.com/v1` |
| `SPARK_MODEL_VERSION` | 模型版本 | `generalv3.5` |
| `LLM_MAX_RETRIES` | LLM 调用重试次数 | `2` |
| `STATE_PERSIST_ENABLED` | 黑板持久化开关 | `true` |
| `STATE_DB_PATH` | SQLite 路径 | `./vision_forge_state.db` |
| `RAG_BACKEND` | 检索通道 | `chroma` |
| `RAGFLOW_API_KEY` | RagFlow 远程 Key | （空=不启用） |
| `RAGFLOW_BASE_URL` | RagFlow 地址 | `http://127.0.0.1:9380/v1/api` |

## 需要注意的坑

- **端口耦合**：后端必须跑 17077，改端口需同步改 `frontend/vite.config.js` 的 proxy target。
- **用户/鉴权模块未接线**：`services/biz_logic/auth.py`、`services/models/`、`services/data_services/` 有一套 SQLAlchemy + JWT 的用户体系，但 `main.py` 里**没有 `include_router` 挂载它们**，当前 API 无鉴权。密码目前是明文比对（`auth.py` 里 `hash_password` 直接返回原文，注释说跑通后再换 bcrypt）。
- **Tutor 源码资产**：`NODE_TO_SOURCE` 映射了全部白名单算子到源码文件名，但 `assets/code_mirror/` 下目前只有 `SE_Block.py`。新增算子讲解时需要往该目录放对应的 `.py` 文件，否则会 fallback 到 SE_Block。
- **ChromaDB 向量库为空**：`assets/vector_database/` 需要预先灌入论文数据才能真正检索到内容，否则 RagService 会走兜底文本。
- 项目注释和文档全部用中文，改动时保持一致的中文注释风格。
- `docs/README.md` 和 `docs/architecture_design.md` 目前是空文件。
