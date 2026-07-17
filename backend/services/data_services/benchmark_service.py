"""
BenchmarkService — 结构化消融实验基准数据服务

从 assets/experiment_results/ 加载消融实验 JSON，支持：
- 按节点组合搜索最匹配的基准实验
- 指标对比（用户配置 vs 基准数据）
- 注入 Evaluator 替代纯 LLM 评估
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from core.logger import logger


class BenchmarkService:
    """消融实验基准数据库服务（单例）。"""

    _instance: Optional["BenchmarkService"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._experiments: List[Dict] = []
        self._by_task: Dict[str, List[Dict]] = {}
        self._by_node: Dict[str, List[Dict]] = {}
        self._load_all()

    def _load_all(self):
        """加载所有消融实验 JSON。"""
        current_dir = Path(__file__).resolve().parent
        data_dir = current_dir.parent.parent / "assets" / "experiment_results"
        if not data_dir.exists():
            logger.warning(f"[BenchmarkService] 数据目录不存在: {data_dir}")
            return

        json_files = sorted(data_dir.glob("*.json"))
        for fp in json_files:
            if fp.name == "benchmark_registry.json":
                continue
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    exp = json.load(f)
                self._experiments.append(exp)

                # 建立索引
                task = exp.get("task_type", "")
                self._by_task.setdefault(task, []).append(exp)

                # 按节点组合建立索引
                nodes = []
                for key in ("backbone", "neck", "head"):
                    node = exp.get(key)
                    if node:
                        nodes.append(node["name"])
                key = "|".join(nodes)
                self._by_node.setdefault(key, []).append(exp)

            except Exception as e:
                logger.error(f"[BenchmarkService] 加载失败 {fp.name}: {e}")

        logger.info(f"[BenchmarkService] 加载了 {len(self._experiments)} 组消融实验基准数据")

    def find_best_match(self, sandbox_config) -> Optional[Dict[str, Any]]:
        """根据 sandbox_config 搜索最匹配的消融实验。

        sandbox_config: SandboxConfig Pydantic 对象或 dict，含 nodes 列表

        匹配策略（按优先级）：
        1. 精确匹配：所有节点 name 完全一致
        2. 部分匹配：backbone + head 一致（忽略 neck）
        3. 同任务类型：task_type 相同
        4. 无匹配：返回 None
        """
        if sandbox_config is None:
            return None

        # 提取节点信息
        nodes: List[str] = []
        task_type = ""
        if hasattr(sandbox_config, "model_dump"):
            config = sandbox_config.model_dump()
        else:
            config = sandbox_config

        task_type = config.get("task_type", "")
        node_list = config.get("nodes", [])
        for n in node_list:
            name = n.get("name", "") if isinstance(n, dict) else getattr(n, "name", "")
            if name:
                nodes.append(name)

        if not nodes:
            return None

        nodes_key = "|".join(nodes)
        logger.info(f"[BenchmarkService] 搜索匹配: task={task_type}, nodes={nodes_key}")

        # 1. 精确匹配
        if nodes_key in self._by_node:
            return self._by_node[nodes_key][0]

        # 2. 部分匹配：提取 backbone 和 head
        backbone_name = ""
        head_name = ""
        for n in node_list:
            n_type = n.get("type", "") if isinstance(n, dict) else getattr(n, "type", "")
            n_name = n.get("name", "") if isinstance(n, dict) else getattr(n, "name", "")
            if n_type.upper() == "BACKBONE":
                backbone_name = n_name
            elif n_type.upper() == "HEAD":
                head_name = n_name

        # 搜索 backbone+head 匹配
        for exp in self._experiments:
            exp_backbone = exp.get("backbone", {}).get("name", "")
            exp_head = exp.get("head", {}).get("name", "")
            if backbone_name == exp_backbone and head_name == exp_head:
                logger.info(f"[BenchmarkService] 部分匹配: {exp['id']}")
                return exp

        # 3. 同任务类型匹配
        same_task = self._by_task.get(task_type, [])
        if same_task:
            logger.info(f"[BenchmarkService] 任务类型匹配: {same_task[0]['id']}")
            return same_task[0]

        # 4. 无匹配
        logger.info("[BenchmarkService] 未找到匹配的消融实验")
        return None

    def compare_metrics(self, user_config, benchmark: Dict) -> Dict[str, Any]:
        """对比用户配置和基准实验的指标差距。

        返回格式:
        {
          "matched_experiment": "experiment_id",
          "source": "论文来源",
          "benchmark_metrics": {...},
          "comparison_notes": [...]
        }
        """
        if not benchmark:
            return {}

        result = {
            "matched_experiment": benchmark.get("id", ""),
            "source": benchmark.get("source", ""),
            "dataset": benchmark.get("dataset", ""),
            "benchmark_metrics": benchmark.get("metrics", {}),
            "ablations": benchmark.get("ablations", []),
            "notes": benchmark.get("notes", ""),
            "comparison_summary": self._generate_summary(benchmark),
        }
        return result

    def _generate_summary(self, benchmark: Dict) -> str:
        """根据消融数据生成自然语言对比摘要。"""
        ablations = benchmark.get("ablations", [])
        if not ablations:
            return "该基准实验无消融数据可供对比。"

        lines = [f"基准配置: {benchmark.get('id')} ({benchmark.get('source')})"]
        lines.append(f"数据集: {benchmark.get('dataset')}")

        # 列出消融变体
        for ab in ablations:
            delta = ab.get("delta", 0)
            direction = "↑" if delta > 0 else ("↓" if delta < 0 else "→")
            abs_delta = abs(delta)
            lines.append(
                f"  {ab['variant']}: {direction}{abs_delta:.3f} — {ab.get('comment', '')}"
            )

        return "\n".join(lines)

    def get_all_experiments(self) -> List[Dict]:
        """返回所有已加载的消融实验列表（不含详细数据）。"""
        return [
            {
                "id": exp.get("id"),
                "task_type": exp.get("task_type"),
                "backbone": exp.get("backbone", {}).get("name", ""),
                "head": exp.get("head", {}).get("name", ""),
                "source": exp.get("source", ""),
            }
            for exp in self._experiments
        ]


# 全局单例
benchmark_service = BenchmarkService()
