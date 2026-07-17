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

    def _extract_facts(self, text: str) -> Dict[str, str]:
        """从用户输入中程序化提取关键事实。不给 LLM 自由猜测的机会。"""
        facts = {}
        lower = text.lower()

        # 任务类型
        if any(w in lower for w in ["语义分割", "图像分割", "分割", "semantic segmentation"]):
            facts["task"] = "语义分割"
        elif any(w in lower for w in ["目标检测", "检测", "框出来", "圈出来", "object detection"]):
            facts["task"] = "目标检测"
        elif any(w in lower for w in ["实例分割", "instance segmentation"]):
            facts["task"] = "实例分割"
        elif any(w in lower for w in ["图像分类", "分类", "判断好坏", "classification"]):
            facts["task"] = "图像分类"
        elif any(w in lower for w in ["关键点", "keypoint"]):
            facts["task"] = "关键点检测"

        # 目标对象（提取名词）
        objects = []
        for obj in ["苹果", "香蕉", "橘子", "桃子", "玉米", "水稻", "小麦",
                     "叶片", "病斑", "杂草", "害虫", "细胞", "肿瘤", "车辆",
                     "行人", "人脸", "文字", "缺陷", "损伤", "垃圾"]:
            if obj in text:
                objects.append(obj)
        if objects:
            facts["objects"] = "、".join(objects)

        # 特殊需求
        if "黑色" in text or "二值" in text or "黑白" in text or "掩码" in text:
            facts["output"] = "二值掩码（目标白色，背景黑色）"

        return facts

    def _probe(self, state: TaskState) -> Dict[str, Any]:
        """生成下一轮苏格拉底反问，探测学习者的实际需求和知识盲区。"""
        turn = state.socratic_turn
        history = state.socratic_history

        # ★ 关键改进：程序化提取用户已说的事实，作为硬约束注入 prompt
        user_msg = state.user_intent
        facts = self._extract_facts(user_msg)
        # 也从历史回答中提取
        for h in history:
            answer = h.get("answer", "")
            if answer:
                more_facts = self._extract_facts(answer)
                facts.update(more_facts)

        facts_block = ""
        if facts:
            items = []
            if facts.get("task"):
                items.append(f"任务类型: {facts['task']}")
            if facts.get("objects"):
                items.append(f"目标对象: {facts['objects']}")
            if facts.get("output"):
                items.append(f"输出格式: {facts['output']}")
            if items:
                facts_block = "【已确认的事实 — 不可违背】\n" + "\n".join(f"- {i}" for i in items) + "\n"

        # 补充短回答的语义：如果用户回答"1"，结合上一轮问题推断含义
        newline = "\n"
        enriched_history = []
        for h in history:
            ans = h.get("answer", "")
            q = h.get("question", "")
            if ans.strip() in ("1", "2", "①", "②", "一", "二", "a", "b", "是", "对", "是的", "对的"):
                if "①" in q or "1" in q or "分类" in q:
                    ans = f"选择了第{ans.strip()}个选项（从问题'{q[:60]}...'推断：用户选了分类/第一个选项）"
                elif "②" in q or "2" in q or "检测" in q:
                    ans = f"选择了第{ans.strip()}个选项（从问题'{q[:60]}...'推断：用户选了检测/第二个选项）"
            enriched_history.append({**h, "answer": ans})

        # 用增强后的历史构建展示文本
        enriched_text = newline.join([
            f"第{h['turn']}轮 — 问: {h.get('question','')} | 答: {h.get('answer','')}"
            for h in enriched_history
        ]) if enriched_history else "（尚无历史对话）"
        history_block = f"已完成的对话:{newline}{enriched_text}" if enriched_history else "这是第一轮对话。"

        # 从历史中提取已确认的任务类型
        confirmed_task = facts.get("task", "")
        if not confirmed_task:
            for h in history:
                ans = h.get("answer", "")
                if any(w in ans for w in ["分类", "判断好坏", "二分类", "图像分类"]):
                    confirmed_task = "图像分类"
                elif any(w in ans for w in ["检测", "框出来", "目标检测", "圈出来"]):
                    confirmed_task = "目标检测"
                elif any(w in ans for w in ["语义分割", "分割"]):
                    confirmed_task = "语义分割"

        user_scenario = state.user_intent

        # 从 socratic_track 获取当前学习阶段
        track = state.socratic_track or {}
        current_stage = track.get("stage", "task_translation")

        # 根据阶段 + 用户水平确定当前该问什么
        user_is_expert = track.get("user_is_expert", False)
        stage_instruction = ""
        if current_stage == "task_translation":
            stage_instruction = f"当前阶段：任务翻译。帮用户把「{user_scenario}」翻译成计算机视觉任务。问 1 个分类 vs 检测的选择题。"
        elif current_stage == "concept_exploration":
            if user_is_expert:
                stage_instruction = f"""当前阶段：概念探索（用户懂专业术语，跳过基础解释）。
用户场景是「{user_scenario}」。
【严禁】解释什么是语义分割/目标检测等基础概念——用户已经知道！
【必须】直接问用户的工程约束：数据情况？部署设备？性能要求？引导用户去模型工坊动手。
不要举桃子等无关例子。"""
            else:
                stage_instruction = f"""当前阶段：概念探索。
用户场景是「{user_scenario}」。
【严禁】再问"分类还是检测"、"目标检测还是分割"等任务类型问题！任务翻译阶段已结束！
【必须】用大白话解释：模型怎么从图片里学到特征？用 {user_scenario} 这个具体场景举例。
不要推荐具体模型名称。不要举跟 {user_scenario} 无关的例子。"""
        else:
            stage_instruction = f"帮用户理清需求。"

        probe_prompt = f"""你是一个计算机视觉教学助手。你的任务是引导用户思考，一次只前进一步。

{facts_block}
学生的场景: {user_scenario}
历史对话:
{history_block}

{stage_instruction}

【铁律 — 违反任何一条就是失败】
1. 如果「已确认的事实」里写了任务类型，绝对不要再问"分类还是检测""分割还是检测"等任务确认问题
2. 如果「已确认的事实」里写了目标对象（如苹果），你的回答中只能提这个对象。严禁提桃子、香蕉、橘子等无关对象
3. 如果用户已经用了专业术语（如"语义分割"），严禁向他解释这个术语是什么意思
4. 绝对不要问"你手上有什么业务场景""你想解决什么问题"——用户已经告诉你了
5. 只输出 1-2 句话，包含一个引导性问题

【输出】
JSON: {{"question": "<1-2句>", "insight": "<信息>"}}"""

        response_text = self.call_llm(user_input=probe_prompt, temperature=0.5, json_mode=True)
        parsed = extract_json_from_llm(response_text) or {}
        question = parsed.get("question", "让我帮你梳理一下～你想做的这个任务，更像是哪种情况呢？")
        insight = parsed.get("insight", "")

        # ★ 后处理清洗：LLM 输出了错误的对象 → 代码层面纠正
        target_objects = facts.get("objects", "")
        if target_objects:
            target_list = [o.strip() for o in target_objects.split("、")]
            # 所有可能被 LLM 乱说的水果/物体
            all_known_objects = ["苹果", "香蕉", "橘子", "桃子", "橙子", "梨", "西瓜",
                                 "葡萄", "草莓", "樱桃", "芒果", "柠檬", "猕猴桃",
                                 "玉米", "水稻", "小麦", "大豆", "番茄", "黄瓜"]
            for wrong_obj in all_known_objects:
                if wrong_obj not in target_list and wrong_obj in question:
                    correct_obj = target_list[0]  # 用第一个正确对象替换
                    logger.warning(f"[{self.name}] 后处理：将LLM输出的'{wrong_obj}'替换为'{correct_obj}'")
                    question = question.replace(wrong_obj, correct_obj)

        return {
            "socratic_turn": turn + 1,
            "socratic_state": "probing",
            "socratic_history": [{"turn": turn + 1, "question": question, "answer": "", "insight": insight}],
            "socratic_track": state.socratic_track,  # 保存阶段信息到黑板
            "evaluation_results": {"tutor_response": f"{question}"},
            "current_step": "socratic_stage",
            "history": [f"[{self.name}] 苏格拉底第 {turn + 1} 轮反问（阶段: {state.socratic_track.get('stage', '?')}）"],
        }

    def _synthesize(self, state: TaskState) -> Dict[str, Any]:
        """积累足够信息后，生成 learner_profile + sandbox_config，
        并引导用户前往模型工坊动手搭建。"""
        history = state.socratic_history
        history_text = "\n".join([
            f"Q{h['turn']}: {h.get('question','')} → A: {h.get('answer','')} ({h.get('insight','')})"
            for h in history
        ])

        # 生成友好的任务总结 + Canvas 引导
        guidance_prompt = f"""你是一个温暖、鼓励型的视觉AI教学导师。你已经通过对话了解了学生的需求。

学生原始想法: {state.user_intent}
对话历史:
{history_text}

请用 JSON 格式回复:
{{"summary": "<用1-2句肯定学生并总结你理解的任务（比如:我明白了，你想做的是XX，这属于YY任务类型）>",
  "guidance": "<鼓励学生去模型工坊动手搭建的引导文案，语气要轻松鼓励，像朋友在说'来吧，试试看！'。推荐2-3个关键算子，用通俗语言解释每个算子的作用。>"}}

【重要规则】
- 绝不提"你没有提供XX信息"这类指责性语言
- 即使用户给的信息有限，也要积极肯定"这已经很清楚了！"
- 把 ML 术语翻译成大白话（比如把 BACKBONE 说成'特征提取器'）
- 鼓励学生亲手去画布上试试，语气要像在邀请朋友一起玩"""

        guidance_response = self.call_llm(user_input=guidance_prompt, temperature=0.5, json_mode=True)
        guidance_parsed = extract_json_from_llm(guidance_response) or {}
        summary = guidance_parsed.get("summary", f"明白了！你想做的是 {state.user_intent}，这其实是一个很有价值的应用场景。")
        guidance = guidance_parsed.get("guidance",
            "现在请你亲手去「模型工坊」搭一下模型架构吧！拖拽几个算子连起来就行，试试看～")

        # 后处理：用 _extract_facts 获取正确对象，修正 LLM 的输出
        synth_facts = self._extract_facts(state.user_intent)
        correct_objects = synth_facts.get("objects", "")
        if correct_objects:
            correct_list = [o.strip() for o in correct_objects.split("、")]
            wrong_set = ["苹果", "香蕉", "橘子", "桃子", "橙子", "梨", "西瓜",
                        "葡萄", "草莓", "樱桃", "芒果", "柠檬", "猕猴桃",
                        "玉米", "水稻", "小麦", "大豆", "番茄", "黄瓜"]
            for w in wrong_set:
                if w not in correct_list:
                    if w in summary:
                        summary = summary.replace(w, correct_list[0])
                    if w in guidance:
                        guidance = guidance.replace(w, correct_list[0])

        # 生成 sandbox_config（轻量，作为 Canvas 初始建议）
        synthesis_prompt = f"""你是一个资深的视觉算法架构师。根据对话历史，生成建议的模型架构。

原始意图: {state.user_intent}
对话历史:
{history_text}

{self.role_prompt}

请综合所有信息，生成 {{"learner_profile", "sandbox_config"}}。
在 learner_profile 中包含:
- "knowledge_level": "初级/中级/进阶"
- "weak_areas": ["知识薄弱点"]
- "learning_pace": "slow/medium/fast"
"""

        response_text = self.call_llm(user_input=synthesis_prompt, temperature=0.0, json_mode=True)
        parsed_result = extract_json_from_llm(response_text)
        if not parsed_result:
            logger.error(f"[{self.name}] 综合分析解析失败")
            return {"current_step": "error_stage", "history": ["苏格拉底综合阶段解析失败"]}

        sandbox_config = self._sanitize_config(parsed_result.get("sandbox_config", {}))
        learner_profile = parsed_result.get("learner_profile", {})
        learner_profile["socratic_rounds"] = len(history)

        # 组装引导消息
        guidance_msg = f"""## 🎯 需求确认

{summary}

---

## 🏗️ 下一步：动手搭建

{guidance}

> 💡 **提示**：点击右上角「模型工坊」进入画布，从左侧算子库拖拽节点开始搭建。完成后提交评估，我会帮你分析架构是否合理。"""

        return {
            "learner_profile": learner_profile,
            "sandbox_config": sandbox_config,
            "socratic_state": "done",
            "socratic_track": {
                "level": learner_profile.get("knowledge_level", "中级"),
                "pace": learner_profile.get("learning_pace", "medium"),
                "focus_topics": learner_profile.get("weak_areas", []),
            },
            "evaluation_results": {"tutor_response": guidance_msg},
            "current_step": "canvas_guide",  # 引导去 Canvas，不自动跑 Tutor
            "history": [
                f"[{self.name}] 苏格拉底对话完成（共 {len(history)} 轮）",
                f"[{self.name}] 已生成建议架构，引导用户前往模型工坊",
            ],
        }

    # 专业术语检测：用户懂行 → 不解释基础概念
    PROFESSIONAL_TERMS = [
        "语义分割", "目标检测", "图像分类", "实例分割",
        "全景分割", "关键点检测", "异常检测", "目标跟踪",
        "语义分割", "图像分割", "object detection", "semantic segmentation",
        "instance segmentation", "classification",
        "backbone", "neck", "head", "fpn", "resnet", "vit", "yolo",
    ]

    # 理解信号词：用户表示明白了、准备好了
    UNDERSTANDING_SIGNALS = [
        "原来如此", "明白了", "懂了", "理解了", "知道了", "好的",
        "我明白了", "清楚了", "了解了", "原来是这样", "有道理",
        "对", "是的", "没错", "嗯嗯", "是这样", "了解了谢谢",
    ]

    def _detect_understanding(self, answer: str) -> bool:
        """检查用户回答中是否有理解/确认信号。"""
        answer = answer.strip().lower()
        return any(sig in answer for sig in self.UNDERSTANDING_SIGNALS)

    # 用户求助信号
    HELP_SIGNALS = ["讲讲", "讲一下", "解释", "不清楚", "不懂", "不明白", "说说", "教我", "举例", "打个比方"]

    def _teach(self, state: TaskState) -> Dict[str, Any]:
        """教学模式：用户求助时，用大白话解释概念，不反问。"""
        facts = self._extract_facts(state.user_intent)
        task = facts.get("task", "图像分类")
        obj = facts.get("objects", "目标")
        scenario = state.user_intent

        # 从历史获取最近的问题上下文
        last_q = ""
        if state.socratic_history:
            last_q = state.socratic_history[-1].get("question", "")

        prompt = f"""你是一个善于用大白话讲复杂概念的计算机视觉老师。

学生场景: {scenario}
学生刚被问到: {last_q}
学生说: "我不太清楚，你能讲讲吗？"

【你的任务】
用通俗易懂的中文，向学生解释视觉模型是怎么从图片中学到特征的。
把 "{obj}" 当例子来讲。用比喻，不要用术语。
讲完后，问一个简单的确认问题（"这样说清楚吗？"），但不要再问新的探索性问题。

【输出】
JSON: {{"explanation": "<2-4句大白话解释>", "check": "<简单确认问题>"}}
"""

        resp = self.call_llm(user_input=prompt, temperature=0.5, json_mode=True)
        parsed = extract_json_from_llm(resp) or {}
        explanation = parsed.get("explanation", f"模型就像人一样，通过看大量{obj}图片来学习。比如它会注意到{obj}通常是什么颜色、什么形状的，然后记住这些规律来判断。")
        check = parsed.get("check", "这样说清楚吗？")

        # 后处理：修正可能被 LLM 改掉的对象名
        correct_objects = facts.get("objects", "")
        if correct_objects:
            correct_list = [o.strip() for o in correct_objects.split("、")]
            wrong_set = ["苹果", "香蕉", "橘子", "桃子", "橙子", "梨", "西瓜",
                        "葡萄", "草莓", "玉米", "水稻", "小麦"]
            for w in wrong_set:
                if w not in correct_list:
                    explanation = explanation.replace(w, correct_list[0])
                    check = check.replace(w, correct_list[0])

        return {
            "socratic_turn": state.socratic_turn + 1,
            "socratic_state": "probing",
            "socratic_track": state.socratic_track,
            "evaluation_results": {"tutor_response": f"{explanation}\n\n{check}"},
            "current_step": "socratic_stage",
            "history": [f"[{self.name}] 教学模式：解答学生疑问"],
        }

    def run(self, state: TaskState) -> Dict[str, Any]:
        """按学习阶段驱动，而非固定轮数。

        阶段流转：task_translation → concept_exploration → ready_to_build → synthesize
        每个阶段由用户的理解信号触发推进，不由轮数控制上限。
        """
        socratic_state = state.socratic_state
        turn = state.socratic_turn
        track = state.socratic_track
        current_stage = track.get("stage", "task_translation") if track else "task_translation"

        # 从 latest answer 检测用户是否准备好了
        last_answer = ""
        if state.socratic_history:
            last_answer = state.socratic_history[-1].get("answer", "")

        # 全新启动
        if socratic_state == "idle":
            # 检测用户是否已使用专业术语 → 跳过任务翻译
            user_msg = state.user_intent.lower()
            knows_terms = any(term.lower() in user_msg for term in self.PROFESSIONAL_TERMS)
            if knows_terms:
                logger.info(f"[{self.name}] 检测到专业术语，跳过任务翻译 → concept_exploration")
                track["stage"] = "concept_exploration"
                track["user_is_expert"] = True
                state.socratic_track = track
            else:
                track["stage"] = "task_translation"
                state.socratic_track = track
            logger.info(f"[{self.name}] 启动苏格拉底式对话（阶段: {track.get('stage')}）")
            return self._probe(state)

        # 对话进行中 —— 根据阶段 + 用户信号决定下一步
        if socratic_state == "probing":
            user_understands = self._detect_understanding(last_answer)
            user_needs_help = any(sig in last_answer for sig in self.HELP_SIGNALS)

            # 用户求助 → 教学模式，不反问
            if user_needs_help:
                logger.info(f"[{self.name}] 检测到求助信号 → 教学模式")
                return self._teach(state)

            # 阶段推进逻辑
            if current_stage == "task_translation":
                # 任务翻译只做 1 轮。不管用户怎么回答，直接推进到概念探索。
                # 绝不给 LLM 机会反复问"分类还是检测"。
                logger.info(f"[{self.name}] 任务翻译阶段完成（1轮）→ concept_exploration")
                track["stage"] = "concept_exploration"
                state.socratic_track = track
                return self._probe(state)

            elif current_stage == "concept_exploration":
                user_is_expert = track.get("user_is_expert", False)
                if user_understands or user_is_expert or turn >= 2:
                    # 专家用户 1 轮概念探索就够了，普通用户最多 2 轮
                    logger.info(f"[{self.name}] 概念探索完成 → synthesize")
                    return self._synthesize(state)
                else:
                    return self._probe(state)

            # 兜底：轮数保护
            if turn >= 4:
                return self._synthesize(state)
            return self._probe(state)

        # 显式综合
        if socratic_state == "synthesizing":
            return self._synthesize(state)

        # 已完成的会话 → 走传统模式
        logger.info(f"[{self.name}] socratic_state={socratic_state}，使用传统模式")
        return self._legacy_run(state)

    def _detect_task_confirmed(self, state: TaskState) -> bool:
        """检测用户是否已确认任务类型。"""
        for h in state.socratic_history:
            ans = h.get("answer", "")
            if any(w in ans for w in ["分类", "判断好坏", "二分类", "图像分类",
                                       "检测", "框出来", "目标检测", "圈出来"]):
                return True
        return False

    def _legacy_run(self, state: TaskState) -> Dict[str, Any]:
        """传统单步模式：直接从 user_intent 生成配置（向后兼容）。"""
        user_intent = state.user_intent
        logger.info(f"[{self.name}] 正在向大模型发起架构规划请求...")

        # 1. 用 json_mode 请求结构化输出
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
