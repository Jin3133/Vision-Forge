import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any # ✅ 新增：用于定义字典类型的输入

# 强行把当前 backend 目录加入 Python 搜索路径
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

from main_workflow import run_vision_forge_pipeline

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

# ✅ 新增：画板评估的请求体模型
class EvaluateRequest(BaseModel):
    session_id: str
    user_intent: str
    sandbox_config: Dict[str, Any]


# ==================== 接口 1：智能对话与流水线 ====================
@app.post("/api/chat")
async def chat_with_agents(request: ChatRequest):
    print(f"\n🌐 接收到前端网络请求: {request.user_intent}")
    try:
        final_state = run_vision_forge_pipeline(request.session_id, request.user_intent)

        # 🚨 新增：拦截异常节点，给前端返回友好的提示，防止前端白屏或乱码
        if final_state.get("current_step") == "error_stage":
            return {
                "code": 200,
                "message": "pipeline_error",
                "data": {
                    "tutor_response": "⚠️ **系统提示**：抱歉，大模型接口连接超时或额度耗尽。我在流转过程中遇到了网络阻碍，请检查后端网络或星火大模型配置！",
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


# ==================== 接口 2：画板动态智能评估 ====================
@app.post("/api/v1/agent/evaluate")
async def evaluate_sandbox(request: EvaluateRequest):
    print(f"\n🎨 接收到画板评估请求 | Session: {request.session_id}")
    
    nodes = request.sandbox_config.get("nodes", [])
    edges = request.sandbox_config.get("edges", [])
    node_names = [n.get("name", "未知节点") for n in nodes]
    
    strengths = []
    warnings = []
    suggestions = []
    is_valid = True

    if len(nodes) == 0:
        return {"status": "error", "message": "画布为空，请先添加节点"}

    # 1. 提取架构特征 (提取关键字)
    has_input = any("输入" in n for n in node_names)
    has_output = any("输出" in n or "解码" in n or "全连接" in n for n in node_names)
    has_backbone = any("编码" in n or "卷积" in n or "提取" in n or "基座" in n for n in node_names)
    has_attention = any("注意" in n or "融合" in n for n in node_names)
    has_prompt = any("提示" in n for n in node_names)

    # 2. 致命错误拦截 (没有输出层，直接判死刑)
    if not has_output:
        warnings.append("⚠️ 致命错误：架构未闭环！缺少最终的【输出层】或【掩码解码器】，模型无法计算 Loss 和输出预测结果。")
        return {
            "status": "success",
            "data": {
                "is_valid": False,
                "estimated_metrics": {"metric_name": "预估精度", "baseline_value": "N/A", "optimized_value": "0%"},
                "feedback": {"strengths": strengths, "warnings": warnings, "learning_suggestions": ["💡 请在模型末端添加一个输出节点。"]}
            }
        }

    # 3. 启发式评分计算 (初始基础分 15 分)
    score_val = 15

    # 检查输入
    if has_input:
        score_val += 10
        strengths.append("✅ 具备清晰的输入层，数据流入口明确。")
    else:
        warnings.append("⚠️ 缺少明确的输入层，数据流可能混乱。")

    # 检查骨干特征提取能力
    if has_backbone:
        score_val += 35
        strengths.append("✅ 包含了视觉特征提取骨干（Backbone），具备基础的图像理解能力。")
    else:
        warnings.append("❌ 缺少核心特征提取模块（如卷积层、图像编码器），模型无法有效提取深层语义，属于无效架构。")
        score_val -= 10

    # 检查注意力/高级特征融合
    if has_attention:
        score_val += 15
        strengths.append("✅ 使用了注意力/高级融合机制，有助于捕获全局上下文信息。")

    # 检查提示机制 (SAM的核心)
    if has_prompt:
        score_val += 15
        strengths.append("✅ 引入了提示编码器，赋予了模型零样本/交互式分割的高级特性。")
    else:
        suggestions.append("💡 进阶建议：如果想达到 SAM（Segment Anything）级别的泛化能力，建议加入【提示编码器】。")

    # 4. 惩罚机制 (降维打击)
    # 惩罚 1：模型过浅（例如你刚才只有4个节点的情况）
    if len(nodes) <= 4:
        warnings.append("⚠️ 模型过于浅层：参数量和感受野严重不足，在真实复杂数据集上会面临严重的欠拟合。")
        # 强制压低分数上限，浅层网络最高只能得 45%
        score_val = min(score_val, 45) 

    # 惩罚 2：有孤立节点
    if len(edges) < len(nodes) - 1:
        warnings.append("⚠️ 拓扑断裂：画布上存在未连接的孤立节点，会有部分死代码。")
        score_val -= 5

    # 5. 分数收敛与边界处理
    score_val = max(0, min(99, score_val))
    
    # 根据分数给出最终定性
    if score_val < 50:
        is_valid = False
        suggestions.append("💡 当前模型无法用于工业生产，请添加更多的特征提取层或参考左侧的【预置模型库】。")
    else:
        is_valid = True

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
                "learning_suggestions": suggestions
            },
            "matched_experiment_file": ""
        }
    }

# ==================== 接口 3：健康检查 ====================
@app.get("/")
def health_check():
    return {"status": "Vision-Forge API is perfectly running!"}