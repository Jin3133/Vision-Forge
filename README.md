# Vision-Forge

## 视觉大模型微调 · 多智能体启发式教学平台

### 软件杯 A3 赛题 | 跨学科 AI 教学系统

---

## 项目简介

Vision-Forge 是一款基于大语言模型多智能体的视觉模型教学平台，通过可视化拖拽式算子沙盒，降低跨学科学生的 AI 学习门槛，实现模型微调、知识讲解、学情评估一体化教学。平台采用共享黑板状态机架构，四大智能体协同完成教学全流程。

## 功能特性

- 🎨 **可视化算子沙盒**：基于 ReactFlow 的拖拽式画布，直观搭建视觉模型架构（Backbone + Neck + Head + Adapter），支持撤销/重做、版本历史、模板库
- 🤖 **四智能体教学流水线**：Architect（架构引导）→ Tutor（源码教研）→ Evaluator（学情评估）→ Generator（资源生成），全流程 AI 驱动
- 📊 **6 维学习画像**：知识掌握、代码能力、认知风格、学习节奏、兴趣程度、易错点 —— 雷达图 + 成长趋势 + AI 综合评价
- 📚 **多类型资源生成**：讲义、思维导图、练习题、PPT 大纲、拓展阅读、实操案例，一键生成学习包
- 🔍 **双通道论文检索**：ChromaDB 本地向量库 + RagFlow 远程知识库，自动降级兜底，确保论文基准数据始终可用
- 🌐 **跨学科场景覆盖**：农业遥感、医学影像、电商视觉、自动驾驶 —— 1+N 演示场景，降低不同背景学生的入门门槛

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 19 + Vite + ReactFlow + Recharts | 可视化画布 + 图表 |
| 后端 | FastAPI + OpenAI SDK + SQLAlchemy + SQLite | RESTful API + 状态持久化 |
| AI 引擎 | 讯飞星火大模型 (Spark API) | 4 个智能体的 LLM 推理 |
| 向量检索 | ChromaDB + RagFlow | 双通道论文知识库检索 |
| 状态管理 | 共享黑板状态机 (Blackboard) | 线程安全 + 增量合并 + SQLite 持久化 |
| 前端状态 | React Context (Auth + Learn + User) | Mock JWT + 学习闭环状态机 |
| 打包部署 | PyInstaller + GitHub Actions | Windows 单文件 EXE |

## 快速启动

### 前端启动

```bash
cd frontend
npm install
npm run dev        # 端口 5173，/api 代理到 127.0.0.1:17077
```

### 后端启动

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 17077
```

> **注意**：后端端口必须是 17077（前端 Vite 代理写死了这个端口）。需要配置 `.env` 文件中的 `OPENAI_API_KEY` 等凭证。

### 一键启动（Linux/macOS）

```bash
chmod +x start.sh
./start.sh
```

### 一键启动（Windows）

```cmd
start.bat
```

## 项目结构

```
Vision-Forge/
├── frontend/                  # React 前端项目
│   ├── src/
│   │   ├── pages/             # 页面组件（Home/Canvas/Center/Resources/Profile）
│   │   ├── components/        # UI 组件（canvas/learn/profile/resources/notifications）
│   │   ├── api.js             # 后端 API 封装
│   │   ├── AuthContext.jsx    # 认证状态管理
│   │   ├── LearnContext.jsx   # 学习闭环状态管理
│   │   └── UserContext.jsx    # 用户信息管理
│   └── vite.config.js         # Vite 配置（含 API 代理）
├── backend/                   # FastAPI 后端项目
│   ├── agents/                # 四个 LLM 智能体（Architect/Tutor/Evaluator/Generator）
│   ├── core/                  # 核心组件（状态机/配置/数据库/日志/节点白名单）
│   ├── services/              # 业务服务（API 路由/认证/RAG/渲染/数据服务）
│   ├── assets/                # 资产文件（源码/code_mirror/实验数据/向量库）
│   └── main.py                # FastAPI 入口
├── docs/                      # 项目文档
│   ├── API_SCHEMA_CONTRACT.md # 前后端 API 契约（唯一标准）
│   ├── TERMS.md               # 用户服务协议
│   └── PRIVACY.md             # 隐私政策
├── .github/workflows/         # CI/CD（Windows EXE 构建）
├── LICENSE                    # MIT 开源协议
├── CONTRIBUTING.md            # 贡献指南
└── README.md                  # 本文件
```

## 多智能体架构

Vision-Forge 采用 **共享黑板状态机 (Blackboard Pattern)** 架构，四个智能体按固定流水线协同工作：

```
用户输入 → Architect（架构引导）→ Tutor（源码教研）→ Evaluator（学情评估）→ Generator（资源生成）→ 完成
```

| 智能体 | 职责 | 输入 | 输出 |
|--------|------|------|------|
| **Architect** | 解析用户意图，生成学习画像 + 模型架构配置 | 用户自然语言描述 | `learner_profile` + `sandbox_config` (ReactFlow nodes/edges) |
| **Tutor** | 动态源码讲解，根据认知风格因材施教 | `sandbox_config` + `learner_profile` | 源码逐行讲解文本 |
| **Evaluator** | 论文评审式架构评估 + 双通道 RAG 基准比对 | `sandbox_config` + 论文数据 | `evaluation_results` (评分/亮点/警告) |
| **Generator** | 多类型教学资源生成 | 全部黑板数据 | 讲义/思维导图/练习题/PPT/拓展阅读/实操案例 |

所有智能体通过 **增量合并 (Delta Merge)** 机制与黑板交互：每个智能体只返回被修改的字段，由 `StateManager` 定向合并回黑板，避免并发冲突。

## 用户指南

### 学习闭环流程

1. **注册/登录**：首次使用会进入引导页（Welcome），选择学习目标（SAM 微调 / 农业遥感 / 医学分割 / 目标检测 / 自定义）
2. **智能对话 (Home)**：与 Architect 智能体对话，描述你的学习需求，AI 会自动创建模型架构
3. **模型工坊 (Canvas)**：在拖拽式画布上搭建/调整视觉模型架构，查看源码和评估结果
4. **学情分析 (Center)**：查看 6 维学习画像雷达图、成长趋势、AI 综合评价
5. **资源生成 (Resources)**：一键生成学习包（讲义 + 思维导图 + 练习题 + 实操案例等）
6. **个人空间 (Profile)**：管理收藏、学习记录、成就徽章

## 贡献指南

我们欢迎所有形式的贡献！请参阅 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详细的贡献流程和代码规范。

### 开发规范

1. 全部基于成熟开源库开发，不重复造轮子
2. 前后端按照 `docs/API_SCHEMA_CONTRACT.md` 契约进行开发联调
3. 代码保持整洁统一，禁止上传无用文件
4. 所有业务逻辑统一归档，目录结构不随意修改
5. 注释和文档统一使用简体中文

## 致谢

Vision-Forge 的开发和运行离不开以下优秀的开源项目：

| 项目 | 用途 |
|------|------|
| [FastAPI](https://fastapi.tiangolo.com/) | 后端 Web 框架 |
| [React](https://react.dev/) | 前端 UI 框架 |
| [ReactFlow](https://reactflow.dev/) | 可视化节点画布 |
| [Recharts](https://recharts.org/) | 图表可视化 |
| [SQLAlchemy](https://www.sqlalchemy.org/) | ORM 数据库层 |
| [ChromaDB](https://www.trychroma.com/) | 向量数据库 |
| [PyInstaller](https://pyinstaller.org/) | Python 打包工具 |
| [Pydantic](https://docs.pydantic.dev/) | 数据验证 |
| [Vite](https://vitejs.dev/) | 前端构建工具 |
| [讯飞星火大模型](https://xinghuo.xfyun.cn/) | LLM 推理引擎 |

## AI 工具使用声明

本项目在开发过程中使用了 **Claude Code**（Anthropic 的 AI 编程助手）辅助以下工作：

- 代码架构设计与重构建议
- 前后端接口契约梳理
- 项目文档生成与维护
- Bug 诊断与修复方案设计

所有 AI 辅助生成的代码均经过人工审查和测试验证。项目在 `CLAUDE.md` 中维护了 Claude Code 的配置指南。

## 许可证

本项目基于 [MIT License](./LICENSE) 开源。

---

© 2025 Vision-Forge Team
