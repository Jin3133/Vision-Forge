# 更新日志

本文档记录 Vision-Forge 项目的重要变更。

## [未发布]

### 新增
- 可视化拖拽式算子沙盒（ReactFlow 画布）
- 四智能体教学流水线（Architect → Tutor → Evaluator → Generator）
- 共享黑板状态机（Blackboard Pattern + SQLite 持久化）
- 双通道论文检索（ChromaDB + RagFlow）
- 6 维学习画像雷达图
- 多类型资源生成（讲义/练习题/思维导图/实操案例等）
- Windows 单文件 EXE 打包（PyInstaller + GitHub Actions）
- 前端认证系统（Mock JWT）

### 变更
- 基于 React 19 + Vite 重构前端
- FastAPI 替代原有后端框架
- 统一 API 契约文档

### 修复
- 移除明文 API Key 泄露
- 修复 Windows CI workflow 语法错误
- 补全项目治理文件（LICENSE/CONTRIBUTING/CODE_OF_CONDUCT）

---

## 版本规范

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 格式，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
