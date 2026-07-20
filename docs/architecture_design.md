# Vision-Forge 架构设计

## 整体架构

Vision-Forge 采用**前后端分离 + 共享黑板状态机**的架构模式。

## 核心设计模式

### 1. 共享黑板状态机 (Blackboard Pattern)

所有智能体通过一个共享的 `TaskState`（黑板）进行间接通信，而非直接互相调用：

```
用户输入 → Blackboard（当前状态）
              ↓
        Architect Agent（读取 + 写入 delta）
              ↓
        Tutor Agent（读取 + 写入 delta）
              ↓
        Evaluator Agent（读取 + 写入 delta）
              ↓
        Generator Agent（读取 + 写入 delta）
              ↓
        Blackboard（最终状态）→ 响应返回前端
```

**关键机制：增量合并 (Delta Merge)**

每个智能体只返回被修改的字段（delta），由 `StateManager.update_state()` 按规则合并：
- `history`/`missing_knowledge`：追加（extend/append）
- dict 字段：浅合并（update）
- `sandbox_config`：dict 合并后重建
- 其余字段：直接覆盖

### 2. 多智能体流水线 (Agent Pipeline)

流水线由 `main_workflow.py` 中 `run_vision_forge_pipeline()` 编排，是一个 while 循环（最多 15 步），根据 `current_step` 手动路由到对应智能体。

固定流转：`init → architect_stage → tutor_stage → evaluator_stage → generator_stage → completed`

异常处理：任何异常或流转到 `init`/`error_stage` 都会中断循环，绝不回退。

### 3. 双通道 RAG 检索

`RagService` 支持 ChromaDB（本地）和 RagFlow（远程）双通道，失败时自动降级，双通道都不可用时返回内置领域知识兜底。

## 技术选型依据

| 决策 | 选择 | 理由 |
|------|------|------|
| 状态管理 | 共享黑板 (Blackboard) | 松耦合智能体、天然支持并发、可持久化 |
| 数据存储 | SQLite (WAL 模式) | 轻量、零配置、单文件部署、适合教学场景 |
| LLM 引擎 | 讯飞星火 | 赛题指定、国内可访问、成本可控 |
| 前端状态 | React Context | 无需引入 Redux 等重型库，够用 |
| 打包部署 | PyInstaller | 单文件 EXE，适合非技术用户 |
