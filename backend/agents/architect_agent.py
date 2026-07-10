from typing import Dict, Any
from core.state import TaskState
from core.logger import logger
from core.utils import extract_json_from_llm
from core.node_catalog import catalog_as_prompt, is_valid_node
from agents.base_agent import AgentBase


class ArchitectAgent(AgentBase):
    def __init__(self):
        # ✅ 注入算子白名单，强制模型只从合法 type/name 中选择，并要求纯 JSON 输出
        role_prompt = f"""你是一个资深的视觉算法架构师。请根据用户的学习意图，为其规划一套可用于视觉任务的模型架构。

【可用算子白名单】你只能从下列 type 及其对应的 name 中选择，禁止杜撰其它算子：
{catalog_as_prompt()}

【输出要求】
只输出一个 JSON 对象，不要包含任何解释、markdown 或代码围栏。结构如下：
{{
  "learner_profile": {{"domain": "<从用户意图归纳的领域，如 农业/医学/工业>", "cognitive_style": "<图表直观应用 或 代码底层探索>"}},
  "sandbox_config": {{
    "task_type": "<任务类型，如 目标检测/语义分割/图像分类>",
    "suggested_backbone": "<从 BACKBONE 白名单中选一个 name>",
    "nodes": [
      {{"id": "n1", "type": "BACKBONE", "name": "<白名单内的 name>", "data": {{}}}}
    ],
    "edges": [{{"source": "n1", "target": "n2"}}]
  }},
  "next_step": "tutor_stage"
}}

【架构合理性要求】
- 至少包含一个 BACKBONE（特征提取骨干）和一个 HEAD（任务输出头），保证架构闭环。
- 节点之间用 edges 串联成一条完整的数据流。
- suggested_backbone 必须与 nodes 中的 BACKBONE 节点 name 一致。"""
        super().__init__(name="Architect", role_prompt=role_prompt)

    def _sanitize_config(self, sandbox_config: Dict[str, Any]) -> Dict[str, Any]:
        """剔除不在白名单内的节点，避免脏数据流入后续环节。"""
        if not isinstance(sandbox_config, dict):
            return {"task_type": "", "nodes": [], "edges": []}

        raw_nodes = sandbox_config.get("nodes", []) or []
        valid_nodes = []
        dropped = []
        for node in raw_nodes:
            n_type = str(node.get("type", "")).upper()
            n_name = node.get("name", "")
            if is_valid_node(n_type, n_name):
                node["type"] = n_type  # 统一大写
                valid_nodes.append(node)
            else:
                dropped.append(f"{n_type}:{n_name}")

        if dropped:
            logger.warning(f"[{self.name}] 已剔除 {len(dropped)} 个非法节点: {dropped}")

        # 只保留两端都还存在的边
        valid_ids = {n.get("id") for n in valid_nodes}
        valid_edges = [
            e for e in (sandbox_config.get("edges", []) or [])
            if e.get("source") in valid_ids and e.get("target") in valid_ids
        ]

        sandbox_config["nodes"] = valid_nodes
        sandbox_config["edges"] = valid_edges
        return sandbox_config

    def run(self, state: TaskState) -> Dict[str, Any]:
        user_intent = state.user_intent
        logger.info(f"[{self.name}] 正在向大模型发起架构规划请求...")

        # 1. 用 json_mode 请求结构化输出（不支持时 base_agent 会自动回退）
        response_text = self.call_llm(user_input=user_intent, temperature=0.0, json_mode=True)

        # 2. 用统一的三级兜底解析
        parsed_result = extract_json_from_llm(response_text)
        if not parsed_result:
            logger.error(f"[{self.name}] 架构规划解析失败，进入 error_stage")
            return {
                "current_step": "error_stage",
                "history": [f"[{self.name}] 模型输出无法解析为合法 JSON，架构规划失败。"],
            }

        # 3. 白名单清洗
        sandbox_config = self._sanitize_config(parsed_result.get("sandbox_config", {}))

        return {
            "learner_profile": parsed_result.get("learner_profile", {}),
            "sandbox_config": sandbox_config,
            "current_step": parsed_result.get("next_step", "tutor_stage"),
            "history": [f"[{self.name}] 成功生成算子配置（{len(sandbox_config.get('nodes', []))} 个合法节点）。"],
        }


# ================= 单元测试 =================
if __name__ == "__main__":
    mock_state = TaskState(session_id="test_architect", user_intent="我想做玉米叶片病害检测")
    architect = ArchitectAgent()
    delta = architect.run(mock_state)
    print("--- Architect 输出 ---")
    import json
    print(json.dumps(delta, ensure_ascii=False, indent=2))
