from typing import Annotated, List, Dict, Union
from pydantic import BaseModel, Field
from typing_extensions import TypedDict


# 1. 匹配前端JSON契约
class NodeModel(BaseModel):
    id: str
    type: str
    name: str
    data: Dict = Field(default_factory=dict)


class EdgeModel(BaseModel):
    source: str
    target: str


class SandboxConfig(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]


# 2. LangGraph 核心状态定义
def merge_logs(left: List[str], right: List[str]) -> List[str]:
    """状态合并函数"""
    return left + right


class TaskState(TypedDict):
    # 基础信息
    session_id: str
    user_intent: str

    # 业务数据
    sandbox_config: SandboxConfig

    # 智能体流转中间件
    missing_knowledge: List[str]  # 待解释的知识点清单
    evaluation_results: Dict  # 评估智能体存入的结果

    # 系统追踪
    history: Annotated[List[str], merge_logs]  # 操作流水日志
    current_agent: str  # 当前正在运行的智能体名

