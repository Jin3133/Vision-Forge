# 贡献指南

感谢你对 Vision-Forge 的关注！我们欢迎所有形式的贡献。

## 行为准则

本项目遵循 [Contributor Covenant 行为准则](./CODE_OF_CONDUCT.md)。参与即表示你同意遵守其条款。

## 如何贡献

### 报告 Bug

1. 在 GitHub Issues 中搜索是否已有相同问题
2. 如果没有，创建新 Issue，包含：
   - 清晰的标题和描述
   - 复现步骤
   - 预期行为 vs 实际行为
   - 环境信息（操作系统、Python 版本、Node 版本）

### 提交代码

1. **Fork** 本仓库
2. 从 `main` 分支创建你的特性分支：`git checkout -b feat/your-feature`
3. 编写代码并确保通过现有测试
4. 遵循项目的代码风格：
   - 前端：ESLint + Prettier 默认配置
   - 后端：PEP 8，注释和文档使用**简体中文**
5. 提交前确保 commit message 清晰描述变更
6. 推送到你的 Fork 并提交 Pull Request 到 `main` 分支

### PR 要求

- 描述清楚做了什么、为什么这样做
- 关联相关 Issue（如有）
- 如果是 UI 变更，附上截图
- 如果是 API 变更，更新 `docs/API_SCHEMA_CONTRACT.md`
- 确保前后端契约一致

## 开发环境

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 17077
```

### 配置文件

在项目根目录创建 `.env` 文件，参考 `.env.example`（如存在）或 `backend/core/config.py` 中的配置项说明。

## 项目架构

详细架构说明请参阅 `CLAUDE.md` 和 `docs/API_SCHEMA_CONTRACT.md`。

### 关键约定

1. **后端端口**：必须为 17077（前端 Vite 代理写死）
2. **增量合并**：智能体只返回被修改的字段（delta），不要直接修改黑板
3. **注释语言**：全部使用简体中文
4. **前后端契约**：以 `docs/API_SCHEMA_CONTRACT.md` 为唯一标准

## 代码审查

所有 PR 需要至少一位维护者审查通过后方可合并。审查重点：

- 功能是否正确实现
- 代码风格是否符合规范
- 是否有潜在的性能/安全问题
- 前后端契约是否一致

## 致谢

感谢所有贡献者的付出！
