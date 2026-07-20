"""
管理员专用辅助 API
"""
import os
import json
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.config import settings
from core.node_catalog import NODE_CATALOG
from services.biz_logic.auth import get_current_admin
from services.models.user import User
from services.models.learning_material import LearningMaterial

router = APIRouter(prefix="/api/admin", tags=["admin"])

# 后端根目录
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent.parent


@router.get("/node-catalog")
def get_node_catalog(_admin: User = Depends(get_current_admin)):
    """返回算子节点白名单（5大类 × 31算子）"""
    result = {}
    for category, nodes in NODE_CATALOG.items():
        result[category] = {
            "count": len(nodes),
            "nodes": [
                {"name": n["name"], "difficulty": n.get("difficulty", 1),
                 "params": n.get("params", ""), "paper": n.get("paper", ""),
                 "desc": n.get("desc", "")}
                for n in nodes
            ]
        }
    return {
        "total_categories": len(result),
        "total_nodes": sum(v["count"] for v in result.values()),
        "catalog": result
    }


@router.get("/code-files")
def list_code_files(_admin: User = Depends(get_current_admin)):
    """列出 assets/code_mirror/ 下的所有源码文件"""
    code_dir = BACKEND_ROOT / "assets" / "code_mirror"
    files = []
    if code_dir.exists():
        for f in sorted(code_dir.glob("*.py")):
            stat = f.stat()
            files.append({
                "name": f.name,
                "size_kb": round(stat.st_size / 1024, 1),
                "lines": sum(1 for _ in open(f, encoding='utf-8', errors='ignore')),
            })
    return {"total": len(files), "files": files}


@router.get("/experiment-data")
def list_experiment_data(_admin: User = Depends(get_current_admin)):
    """列出 assets/experiment_results/ 下的消融实验数据"""
    data_dir = BACKEND_ROOT / "assets" / "experiment_results"
    files = []
    if data_dir.exists():
        for f in sorted(data_dir.glob("*.json")):
            if f.name == "benchmark_registry.json":
                continue
            stat = f.stat()
            try:
                with open(f) as fp:
                    content = json.load(fp)
                exp_id = content.get("id", f.stem) if isinstance(content, dict) else f.stem
                desc = content.get("description", "") if isinstance(content, dict) else ""
            except Exception:
                exp_id = f.stem
                desc = ""
            files.append({
                "file": f.name,
                "exp_id": exp_id,
                "desc": desc,
                "size_kb": round(stat.st_size / 1024, 1),
            })
    return {"total": len(files), "experiments": files}


@router.get("/recent-materials")
def list_recent_materials(_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    """最近生成的学习资源（最近 20 条）"""
    rows = db.query(LearningMaterial).order_by(LearningMaterial.created_at.desc()).limit(20).all()
    return {
        "total": len(rows),
        "materials": [
            {"id": r.id, "title": r.title, "type": r.material_type,
             "session_id": r.session_id, "task_type": r.task_type,
             "created_at": r.created_at.isoformat() if r.created_at else ""}
            for r in rows
        ]
    }


@router.get("/system-info")
def get_system_info(_admin: User = Depends(get_current_admin)):
    """返回系统基本信息"""
    log_dir = BACKEND_ROOT / "logs"
    log_files = []
    if log_dir.exists():
        for f in sorted(log_dir.glob("*.log"), reverse=True)[:5]:
            log_files.append({"name": f.name, "size_kb": round(f.stat().st_size / 1024, 1)})

    return {
        "project": settings.PROJECT_NAME,
        "debug_mode": settings.DEBUG_MODE,
        "rag_backend": settings.RAG_BACKEND,
        "model": settings.SPARK_MODEL_VERSION,
        "db_url": str(settings.DATABASE_URL).replace("sqlite:///", ""),
        "persist_enabled": settings.STATE_PERSIST_ENABLED,
        "recent_logs": log_files,
    }
