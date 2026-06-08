import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

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


# ✅ 关键修改：字段名对齐为 user_intent
class ChatRequest(BaseModel):
    user_intent: str
    session_id: str = "default_session"


@app.post("/api/chat")
async def chat_with_agents(request: ChatRequest):
    print(f"\n🌐 接收到前端网络请求: {request.user_intent}")
    try:
        # ✅ 关键修改：同时传递 session_id 和 user_intent
        final_state = run_vision_forge_pipeline(request.session_id, request.user_intent)

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
        # 增加错误堆栈打印，方便你在终端看到具体哪一步炸了
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"流水线执行崩溃: {str(e)}")


@app.get("/")
def health_check():
    return {"status": "Vision-Forge API is perfectly running!"}