from pydantic import BaseModel

class BlackboardState(BaseModel):
    """全局共享黑板状态机"""
    user_intent: str = ""
    learn_status: str = "idle"
    sandbox_config: dict = {}
    agent_feedback: str = ""