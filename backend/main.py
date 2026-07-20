import sys
import json
import asyncio
import threading
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List, Optional

# 强行把当前 backend 目录加入 Python 搜索路径
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

from main_workflow import dispatch_agent
from core.node_catalog import NODE_CATALOG, NAME_TO_TYPE, is_valid_node
from core.logger import logger
from core.intent_classifier import classify_intent
from core.database import engine, Base
from agents.base_agent import AgentBase
from agents.chat_agent import ChatAgent
from core.state import TaskState
from services.api.v1.learning_materials import router as learning_materials_router
from services.api.v1.user import router as user_router
from services.api.v1.admin import router as admin_router
from services.models.learning_material import LearningMaterial  # 确保 Base.metadata 注册该表
from services.models.user import User  # 确保 Base.metadata 注册用户表
from services.models.module_usage_logs import AgentUsageLog  # 确保 Base.metadata 注册日志表

# 初始化 FastAPI 应用
app = FastAPI(title="Vision-Forge API", description="视觉大模型多智能体教研平台")

# 配置跨域资源共享 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件目录（构建后自动检测）
import os as _os
from fastapi.staticfiles import StaticFiles
_static_dir = _os.environ.get("FRONTEND_STATIC_DIR", str(current_dir / "static"))
_has_static = _os.path.isdir(_static_dir) and _os.path.isfile(_os.path.join(_static_dir, "index.html"))
if _has_static:
    logger.info(f"✅ 前端静态文件托管: {_static_dir}")

# 注册学习讲义 API 路由
app.include_router(learning_materials_router)

# 注册用户管理 API 路由（登录/注册/角色管理）
app.include_router(user_router, prefix="/api/users")
app.include_router(admin_router)

# 启动时自动建表 + 创建默认管理员账号
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    logger.info("✅ 数据库表已就绪")

    # 创建默认管理员账号（如不存在）
    from services.models.user import User
    from services.biz_logic.auth import hash_password
    from core.database import SessionLocal
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin_user = User(
                username="admin",
                password=hash_password("admin123"),
                name="系统管理员",
                role="admin",
                class_name="",
            )
            db.add(admin_user)
            db.commit()
            logger.info("🔐 默认管理员账号已创建 — 用户名: admin | 密码: admin123")
        else:
            logger.info(f"🔐 管理员账号已存在 — 用户名: {admin.username}")
    except Exception as e:
        db.rollback()
        logger.warning(f"⚠️ 默认管理员创建跳过: {e}")
    finally:
        db.close()


# ==================== 请求体数据模型 ====================
class ChatRequest(BaseModel):
    user_intent: str
    session_id: str = "default_session"


class EvaluateRequest(BaseModel):
    session_id: str
    user_intent: str
    sandbox_config: Dict[str, Any]


# ==================== 评估专用 LLM（懒加载，仅生成反馈文案） ====================
class _EvalFeedbackAgent(AgentBase):
    """内部轻量 Agent，为画板评估接口生成自然语言反馈。"""
    def __init__(self):
        super().__init__(
            name="EvalFeedback",
            role_prompt="你是一个友好且专业的视觉模型架构评审助手。"
                        "根据结构化评分数据，生成一段简洁中文评审意见（1-2 段话）。"
                        "突出亮点和最关键的改进方向，语气鼓励但不回避问题。"
        )

    def run(self, state):
        pass  # 不走流水线


_eval_agent: Optional[_EvalFeedbackAgent] = None


def _get_eval_agent() -> _EvalFeedbackAgent:
    global _eval_agent
    if _eval_agent is None:
        _eval_agent = _EvalFeedbackAgent()
    return _eval_agent


# ==================== 接口 1：智能对话与流水线（SSE 流式版） ====================
@app.post("/api/chat")
async def chat_with_agents(request: ChatRequest):
    """SSE 流式接口 —— 实时推送每个 Agent 的执行进度与产出内容。

    事件格式（SSE data 字段为 JSON）：
      {"event":"stage", "agent":"architect", "status":"running"|"done"}
      {"event":"content", "type":"tutor"|"evaluation"|"report", "text":"..."}
      {"event":"error", "message":"...", "agent":"..."}
      {"event":"done", "data":{...}}
    """
    logger.info(f"\n🌐 接收到前端 SSE 请求: {request.user_intent}")

    # 0. 三分类意图路由：
    #    chat    → ChatAgent（纯概念问答）
    #    explore → Architect 苏格拉底引导（场景探索 + 任务翻译）
    #    build   → Architect + 完整流水线（明确搭建请求）
    intent = classify_intent(request.user_intent)
    logger.info(f"🧭 [Router] 意图分类: '{request.user_intent[:60]}...' → {intent}")

    async def event_generator():
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()

        if intent == "chat":
            # ====== chat 模式：纯概念问答 → ChatAgent ======
            def run_chat():
                try:
                    state = TaskState(
                        session_id=request.session_id,
                        user_intent=request.user_intent,
                    )
                    chat_agent = ChatAgent()
                    delta = chat_agent.run(state)
                    text = delta.get("evaluation_results", {}).get("tutor_response", "")
                    asyncio.run_coroutine_threadsafe(
                        queue.put({"event": "mode", "mode": "chat"}),
                        loop,
                    )
                    asyncio.run_coroutine_threadsafe(
                        queue.put({"event": "content", "type": "chat", "text": text}),
                        loop,
                    )
                    asyncio.run_coroutine_threadsafe(
                        queue.put({"event": "done", "data": delta}),
                        loop,
                    )
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    asyncio.run_coroutine_threadsafe(
                        queue.put({"event": "error", "message": f"对话失败: {str(e)}", "agent": "system"}),
                        loop,
                    )

            threading.Thread(target=run_chat, daemon=True).start()

        else:
            # ====== explore / build 模式：按需调度单个智能体 ======
            # 每次请求只执行一个智能体，不做链式调用。
            # Architect → Tutor / Evaluator / Generator 各自独立触发。
            def run_pipeline():
                """调度一个智能体执行，通过 queue 推送事件。"""
                def emit(event: dict):
                    asyncio.run_coroutine_threadsafe(queue.put(event), loop)

                try:
                    mode = "pipeline" if intent == "build" else "explore"
                    asyncio.run_coroutine_threadsafe(
                        queue.put({"event": "mode", "mode": mode}),
                        loop,
                    )
                    result = dispatch_agent(
                        request.session_id,
                        request.user_intent,
                        intent,  # "explore" | "build" | "chat"
                        on_progress=emit,
                    )
                    # 调度完成后发送 done 事件
                    asyncio.run_coroutine_threadsafe(
                        queue.put({"event": "done", "data": result}),
                        loop,
                    )
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    asyncio.run_coroutine_threadsafe(
                        queue.put({"event": "error", "message": f"调度失败: {str(e)}", "agent": "system"}),
                        loop,
                    )

            threading.Thread(target=run_pipeline, daemon=True).start()

        # 从队列读取事件并输出为 SSE（带超时保护）
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=120.0)  # 2 分钟超时
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event.get("event") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'event': 'error', 'message': '请求超时，请重试', 'agent': 'system'}, ensure_ascii=False)}\n\n"
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲
        },
    )


# ==================== 接口 2：画板动态智能评估（重构版） ====================
@app.post("/api/v1/agent/evaluate")
async def evaluate_sandbox(request: EvaluateRequest):
    """基于 node_catalog 白名单的结构化评估 + LLM 生成自然语言反馈。

    评估逻辑分两层：
    1. 规则层（确定性）：白名单校验、拓扑完整性检查、启发式评分
    2. LLM 层（生成性）：将规则层结果交给大模型生成专业反馈文案
    """
    logger.info(f"\n🎨 接收到画板评估请求 | Session: {request.session_id}")

    nodes = request.sandbox_config.get("nodes", [])
    edges = request.sandbox_config.get("edges", [])

    if len(nodes) == 0:
        return {"status": "error", "message": "画布为空，请先添加节点"}

    # ==================== 规则层评估 ====================
    strengths = []
    warnings = []
    suggestions = []
    score_val = 10  # 基础分

    # --- 1. 白名单校验（核心改进：用 node_catalog 代替关键词匹配） ---
    valid_nodes = []
    invalid_nodes = []
    type_counts: Dict[str, int] = {}

    for node in nodes:
        n_type = str(node.get("type", "")).upper()
        n_name = node.get("name", "")
        if is_valid_node(n_type, n_name):
            valid_nodes.append(node)
            type_counts[n_type] = type_counts.get(n_type, 0) + 1
        else:
            invalid_nodes.append(f"{n_type}:{n_name}")

    if invalid_nodes:
        warnings.append(f"⚠️ 检测到 {len(invalid_nodes)} 个非法算子（不在白名单内）: {', '.join(invalid_nodes[:5])}")
        score_val -= 5 * min(len(invalid_nodes), 3)

    if valid_nodes:
        strengths.append(f"✅ {len(valid_nodes)} 个算子通过白名单校验。")

    # --- 2. 架构完整性检查（基于 type 维度） ---
    has_backbone = type_counts.get("BACKBONE", 0) > 0
    has_head = type_counts.get("HEAD", 0) > 0
    has_neck = type_counts.get("NECK", 0) > 0
    has_adapter = type_counts.get("ADAPTER", 0) > 0

    if has_backbone:
        score_val += 25
        strengths.append("✅ 包含特征提取骨干（BACKBONE），具备基础的视觉理解能力。")
    else:
        warnings.append("❌ 缺少 BACKBONE 节点！模型无法提取图像特征，属于无效架构。")
        score_val -= 15

    if has_head:
        score_val += 25
        strengths.append("✅ 包含任务输出头（HEAD），架构闭环完整。")
    else:
        warnings.append("⚠️ 缺少 HEAD 节点，模型无法产生预测结果。")
        return {
            "status": "success",
            "data": {
                "is_valid": False,
                "estimated_metrics": {"metric_name": "预估精度", "baseline_value": "N/A", "optimized_value": "0%"},
                "feedback": {
                    "strengths": strengths,
                    "warnings": warnings,
                    "learning_suggestions": ["💡 请添加 HEAD 节点（如 YOLO_Detect_Head、Mask_Decoder）使架构闭环。"]
                }
            }
        }

    if has_neck:
        score_val += 15
        strengths.append("✅ 使用了特征融合模块（NECK），有助于多尺度信息整合。")
    else:
        suggestions.append("💡 建议添加 NECK 模块（如 Feature_Pyramid、BiFPN）以增强多尺度特征融合。")

    if has_adapter:
        score_val += 10
        strengths.append("✅ 引入了参数高效微调适配器（ADAPTER），支持轻量化训练。")

    # --- 3. 拓扑连通性检查 ---
    node_ids = {n.get("id") for n in nodes}
    connected_ids = set()
    for edge in edges:
        connected_ids.add(edge.get("source"))
        connected_ids.add(edge.get("target"))

    isolated = node_ids - connected_ids
    if isolated and len(nodes) > 1:
        warnings.append(f"⚠️ 拓扑断裂：存在 {len(isolated)} 个孤立节点未连接到数据流。")
        score_val -= 3 * min(len(isolated), 3)

    if edges and len(edges) >= len(nodes) - 1:
        strengths.append("✅ 节点间连接充分，数据流路径完整。")
        score_val += 5

    # --- 4. 深度惩罚 ---
    if len(valid_nodes) <= 2:
        warnings.append("⚠️ 模型过于浅层，在复杂任务上会严重欠拟合。")
        score_val = min(score_val, 35)

    # --- 5. 分数边界 ---
    score_val = max(0, min(99, score_val))
    is_valid = score_val >= 40

    if not is_valid:
        suggestions.append("💡 当前架构评分较低，建议参考白名单添加更多功能模块。")

    # ==================== LLM 层：生成自然语言反馈 ====================
    llm_summary = ""
    try:
        agent = _get_eval_agent()
        eval_context = (
            f"用户意图: {request.user_intent}\n"
            f"有效节点: {[n.get('name') for n in valid_nodes]}\n"
            f"类型分布: {type_counts}\n"
            f"评分: {score_val}/99\n"
            f"亮点: {strengths}\n"
            f"问题: {warnings}\n"
        )
        llm_summary = agent.call_llm(
            user_input=f"请为以下画板评估结果生成一段简洁的评审意见:\n{eval_context}",
            temperature=0.4
        )
    except Exception as e:
        logger.warning(f"[Evaluate] LLM 反馈生成失败（不影响主流程）: {e}")

    # ========== 将评估结果写入会话状态，供后续 Tutor/Generator 使用 ==========
    task_type = ""
    backbone_name = ""
    for n in valid_nodes:
        if n.get("type", "").upper() == "BACKBONE":
            backbone_name = n.get("name", "")
    if backbone_name:
        task_type = request.user_intent if request.user_intent else "视觉任务"

    try:
        from core.state import state_manager, SandboxConfig, NodeModel, EdgeModel
        # 将前端传来的 dict 转为 Pydantic 模型
        config_nodes = [NodeModel(**n) for n in valid_nodes]
        config_edges = [EdgeModel(**e) for e in edges]
        sandbox = SandboxConfig(
            task_type=task_type,
            suggested_backbone=backbone_name,
            nodes=config_nodes,
            edges=config_edges,
        )
        state_manager.update_state(request.session_id, {
            "user_intent": request.user_intent,
            "sandbox_config": sandbox,
            "evaluation_results": {
                "report": llm_summary,
                "score": score_val,
                "strengths": strengths,
                "warnings": warnings,
            },
            "current_step": "tutor_stage",  # 准备好让 Tutor 接棒
            "socratic_state": "done",
        })
        logger.info(f"[Evaluate] 评估结果已写入会话 {request.session_id}，current_step → tutor_stage")
    except Exception as e:
        logger.warning(f"[Evaluate] 写入会话状态失败（不影响评估返回）: {e}")

    return {
        "status": "success",
        "data": {
            "is_valid": is_valid,
            "estimated_metrics": {
                "metric_name": "预估精度",
                "baseline_value": "N/A",
                "optimized_value": f"{score_val}%"
            },
            "feedback": {
                "strengths": strengths,
                "warnings": warnings,
                "learning_suggestions": suggestions,
                "llm_summary": llm_summary
            },
            "validation_details": {
                "total_nodes": len(nodes),
                "valid_nodes": len(valid_nodes),
                "invalid_nodes": invalid_nodes,
                "type_distribution": type_counts,
                "isolated_count": len(isolated) if len(nodes) > 1 else 0
            },
            "next_step": "返回首页继续对话，让算法教研智能体为你讲解源码"
        }
    }


# ==================== 接口 3：Canvas 状态同步 ====================

class CanvasSyncRequest(BaseModel):
    session_id: str
    sandbox_config: Dict[str, Any]

@app.post("/api/canvas/sync")
def canvas_sync(request: CanvasSyncRequest):
    """Canvas 画布自动同步：每次画布改动时，将当前节点/边推送到会话黑板。
    这样聊天中的智能体就能看到用户在 Canvas 上搭建了什么。"""
    from core.state import state_manager, SandboxConfig, NodeModel, EdgeModel
    nodes_raw = request.sandbox_config.get("nodes", [])
    edges_raw = request.sandbox_config.get("edges", [])
    try:
        nodes = [NodeModel(**n) for n in nodes_raw]
        edges = [EdgeModel(**e) for e in edges_raw]
        config = SandboxConfig(
            task_type="",
            suggested_backbone="",
            nodes=nodes,
            edges=edges,
        )
        state_manager.update_state(request.session_id, {
            "sandbox_config": config,
        })
        logger.info(f"[CanvasSync] session={request.session_id} nodes={len(nodes)} edges={len(edges)}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"[CanvasSync] 失败: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/session/{session_id}")
def get_session_state(session_id: str):
    """获取会话黑板状态（Canvas 加载时拉取建议配置）。"""
    from core.state import state_manager
    state = state_manager.get_state(session_id)
    return {"status": "success", "data": state.model_dump()}

# ==================== 接口 4：健康检查 / SPA 前端托管 ====================
@app.post("/api/cancel/{session_id}")
def cancel_session(session_id: str):
    """取消指定会话的智能体执行。"""
    from agents.base_agent import AgentBase
    AgentBase.cancel_session(session_id)
    logger.info(f"🛑 [API] 会话 {session_id} 取消信号已发送")
    return {"status": "cancelled", "session_id": session_id}


@app.get("/api/health")
def health_check():
    return {"status": "Vision-Forge API is perfectly running!"}

if _has_static:
    # 托管前端静态资源
    app.mount("/assets", StaticFiles(directory=_os.path.join(_static_dir, "assets")), name="vf_assets")
    from fastapi.responses import FileResponse
    # SPA fallback：非 API 路径返回 index.html（必须放在所有 API 路由之后）
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = _os.path.join(_static_dir, full_path)
        if _os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(_os.path.join(_static_dir, "index.html"))
    # 根路径也返回前端
    @app.get("/")
    async def serve_root():
        return FileResponse(_os.path.join(_static_dir, "index.html"))
else:
    @app.get("/")
    def health_check():
        return {"status": "Vision-Forge API is perfectly running!"}