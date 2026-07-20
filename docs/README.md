# Vision-Forge 项目文档

## 文档索引

| 文档 | 说明 |
|------|------|
| [API_SCHEMA_CONTRACT.md](./API_SCHEMA_CONTRACT.md) | 前后端 API 交互契约（唯一标准） |
| [TERMS.md](./TERMS.md) | 用户服务协议 |
| [PRIVACY.md](./PRIVACY.md) | 隐私政策 |
| [../README.md](../README.md) | 项目主说明文档 |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献指南 |
| [../CHANGELOG.md](../CHANGELOG.md) | 版本变更记录 |
| [../CLAUDE.md](../CLAUDE.md) | Claude Code 项目配置指南 |

## 项目架构

Vision-Forge 采用前后端分离架构：

```
┌─────────────────────────────────────────────┐
│                   前端 (React 19 + Vite)     │
│  ┌─────────┐ ┌────────┐ ┌────────────────┐  │
│  │  Home   │ │ Canvas │ │ Center/Resource│  │
│  │ 智能对话│ │ 模型工坊│ │   学情/资源    │  │
│  └────┬────┘ └───┬────┘ └───────┬────────┘  │
│       └──────────┴──────────────┘           │
│           AuthContext / LearnContext         │
└──────────────────────┬──────────────────────┘
                       │ HTTP/SSE (端口 17077)
┌──────────────────────┴──────────────────────┐
│              后端 (FastAPI)                  │
│  ┌──────────────────────────────────────┐   │
│  │        共享黑板状态机 (Blackboard)    │   │
│  │    TaskState + StateManager + SQLite  │   │
│  └──────────────────────────────────────┘   │
│  ┌──────┐ ┌──────┐ ┌─────────┐ ┌────────┐  │
│  │Architect│Tutor│Evaluator││Generator│  │
│  └──────┘ └──────┘ └─────────┘ └────────┘  │
│         讯飞星火大模型 (Spark API)           │
│         ChromaDB / RagFlow (向量检索)        │
└─────────────────────────────────────────────┘
```
