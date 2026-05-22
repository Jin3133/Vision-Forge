# Vision-Forge
## 视觉大模型微调 · 多智能体启发式教学平台
### 软件杯 A3 赛题 | 跨学科AI教学系统

---

## 项目简介
Vision-Forge 是一款基于大语言模型多智能体的视觉模型教学平台，通过可视化拖拽式算子沙盒，降低跨学科学生的AI学习门槛，实现模型微调、知识讲解、学情评估一体化教学。平台采用共享黑板状态机架构，四大智能体协同完成教学全流程。

## 技术栈
- 前端：React + Vite + ReactFlow（可视化画布）
- 后端：FastAPI + LangGraph（多智能体编排）+ ChromaDB（向量知识库）
- 核心架构：全局共享黑板状态机
- 运行环境：Python 独立虚拟环境 vfenv（依赖完全隔离）

## 快速启动指南
### 前端启动
cd frontend
npm install
npm run dev

### 后端启动
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

## 项目目录结构
- frontend/：前端项目，包含可视化沙盒、UI组件、API请求
- backend/：后端项目，包含多智能体逻辑、接口服务、核心资产
- docs/：团队文档、API接口契约、系统架构设计
- vfenv/：Python独立虚拟环境，不污染全局环境

## 团队开发规范
1. 全部基于成熟开源库开发，不重复造轮子
2. 前后端按照 API_SCHEMA_CONTRACT 契约进行开发联调
3. 代码保持整洁统一，禁止上传无用文件
4. 所有业务逻辑统一归档，目录结构不随意修改