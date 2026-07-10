import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List, Optional

# 强行把当前 backend 目录加入 Python 搜索路径
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

from main_workflow import run_vision_forge_pipeline
from core.node_catalog import NODE_CATALOG, NAME_TO_TYPE, is_valid_node
from core.logger import logger
from agents.base_agent import AgentBase

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


# ==================== 接口 1：智能对话与流水线 ====================
@app.post("/api/chat")
async def chat_with_agents(request: ChatRequest):
    logger.info(f"\n🌐 接收到前端网络请求: {request.user_intent}")
    try:
        final_state = run_vision_forge_pipeline(request.session_id, request.user_intent)

        if final_state.get("current_step") == "error_stage":
            return {
                "code": 200,
                "message": "pipeline_error",
                "data": {
                    "tutor_response": "⚠️ **系统提示**：抱歉，大模型接口连接超时或额度耗尽。请检查后端网络或星火大模型配置！",
                    "evaluation_report": "",
                    "final_report_html": ""
                }
            }

        return {
            "code": 200,
            "message": "success",
            "data": {
                "learner_profile": final_state.get("learner_profile", {}),
                "sandbox_config": final_state.get("sandbox_config", {}),
                "evaluation_report": final_state.get("evaluation_results", {}).get("report", ""),
                "tutor_response": final_state.get("evaluation_results", {}).get("tutor_response", ""),
                "final_report_html": final_state.get("evaluation_results", {}).get("final_report_html", "")
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"流水线执行崩溃: {str(e)}")


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
            }
        }
    }


# ==================== 接口 3：健康检查 ====================
@app.get("/")
def health_check():
    return {"status": "Vision-Forge API is perfectly running!"}