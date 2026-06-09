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

## 环境配置

后端使用 `pydantic-settings` 管理配置，配置文件位于**项目根目录**（不是 backend/ 子目录）。

### 配置文件层级（优先级从高到低）

1. `.env.local` —— 本地敏感信息（已在 `.gitignore` 忽略）
2. `.env` —— 团队共享模板（提交到版本控制，仅含占位符）
3. `backend/core/config.py` —— 代码层默认值（字符串为 `""`，数值为 `0`）

### 首次使用

```bash
# 1. 复制模板为本地配置
cp .env .env.local   # Linux/macOS
# PowerShell: Copy-Item .env .env.local

# 2. 在 .env.local 中填入真实密钥
# 至少需要配置：
#   OPENAI_API_KEY   - 星火大模型 APIPassword
#   SECRET_KEY       - JWT 签名密钥（生产用 openssl rand -hex 32）
#   DEEPSEEK_API_KEY - DeepSeek API Key

# 3. 启动后端
cd backend
python -m pytest tests/ -v   # 验证配置生效
uvicorn main:app --reload
```

### 配置项说明

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `PROJECT_NAME` | `""` | 项目名称 |
| `DEBUG_MODE` | `True` | 调试模式开关 |
| `DATABASE_URL` | `""` | 数据库连接串（本地默认 `sqlite:///./vision_forge.db`） |
| `SECRET_KEY` | `""` | JWT 签名密钥（必填，生产环境必须替换） |
| `OPENAI_API_KEY` | `""` | 星火大模型 APIPassword |
| `OPENAI_API_BASE` | `https://spark-api-open.xf-yun.com/agent/v1` | 星火 X2-Flash Agent 接口 |
| `SPARK_MODEL_VERSION` | `spark-x` | 模型名 |
| `DEEPSEEK_API_KEY` | `""` | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | DeepSeek 接口地址 |
| `MINERU_BASE_URL` | `https://mineru.net` | MinerU 文档解析接口 |
| `MINERU_TIMEOUT` | `120` | MinerU 超时（秒） |
| `REPORT_MAX_ITERATIONS` | `30` | 报告生成最大迭代轮数 |
| `REPORT_TEMPERATURE` | `0.7` | 报告生成温度 |
| `ANIMATION_TEMPERATURE` | `0.7` | 动画生成温度 |
| `ANIMATION_MAX_TOKENS` | `100000` | 动画生成最大 tokens |

完整配置项参见项目根目录的 [.env](file:///f:/college/sophomore/%E8%BD%AF%E4%BB%B6%E6%9D%AF/.env) 文件。

### 安全注意事项

- **永远不要**把 `.env.local` 提交到 git（已在 `.gitignore` 忽略）
- **永远不要**在 `.env` 中写真实密钥（它会被提交）
- 生产环境务必将 `SECRET_KEY` 改为强随机值
- 调试时如果打印过配置，确认未泄露到日志

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