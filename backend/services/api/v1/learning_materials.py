"""
学习讲义 CRUD API
"""
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from core.database import SessionLocal
from core.state import state_manager
from core.logger import logger
from services.models.learning_material import LearningMaterial
from agents.generator_agent import GeneratorAgent

router = APIRouter(prefix="/api/learning-materials", tags=["learning-materials"])

# 懒加载 Generator
_generator: Optional[GeneratorAgent] = None


def _get_generator() -> GeneratorAgent:
    global _generator
    if _generator is None:
        _generator = GeneratorAgent()
    return _generator


# ============ Pydantic Schemas ============

class GenerateRequest(BaseModel):
    session_id: str
    title: Optional[str] = None


class MaterialItem(BaseModel):
    id: int
    session_id: str
    title: str
    material_type: str
    task_type: Optional[str] = None
    created_at: str


class MaterialDetail(BaseModel):
    id: int
    session_id: str
    title: str
    material_type: str
    content_html: str
    task_type: Optional[str] = None
    created_at: str


# ============ API 端点 ============

@router.post("/generate")
def generate_material(req: GenerateRequest):
    """根据已有 session 的沙盒配置和评估结果，生成学习讲义并存入数据库。"""
    session_id = req.session_id

    # 1. 读取会话状态
    state = state_manager.get_state(session_id)
    if not state or not state.user_intent:
        raise HTTPException(status_code=404, detail="会话不存在或无有效意图")

    sandbox_config = getattr(state, "sandbox_config", None)
    if not sandbox_config or not getattr(sandbox_config, "nodes", []):
        raise HTTPException(status_code=400, detail="会话尚无沙盒配置，请先完成架构规划")

    evaluation = getattr(state, "evaluation_results", {}) or {}
    if not evaluation.get("report"):
        raise HTTPException(status_code=400, detail="会话尚无评估报告，请先完成架构评估")

    logger.info(f"[LearningMaterials] 为 session={session_id} 生成讲义...")

    # 2. 调用 Generator 生成 HTML 讲义
    try:
        generator = _get_generator()
        delta = generator.run(state)
        html_content = delta.get("evaluation_results", {}).get("final_report_html", "")
        if not html_content:
            raise HTTPException(status_code=500, detail="讲义生成失败：内容为空")
    except Exception as e:
        logger.error(f"[LearningMaterials] 生成失败: {e}")
        raise HTTPException(status_code=500, detail=f"讲义生成失败: {str(e)}")

    # 3. 构建标题
    task_type = getattr(sandbox_config, "task_type", "") or ""
    title = req.title or f"{task_type} 学习讲义"

    # 4. 存入数据库
    db = SessionLocal()
    try:
        config_json = json.dumps(
            sandbox_config.model_dump() if hasattr(sandbox_config, "model_dump") else {},
            ensure_ascii=False
        )
        material = LearningMaterial(
            session_id=session_id,
            title=title,
            material_type="讲义",
            content_html=html_content,
            sandbox_config_json=config_json,
            task_type=task_type,
        )
        db.add(material)
        db.commit()
        db.refresh(material)

        logger.info(f"[LearningMaterials] 讲义已保存 id={material.id}")
        return {
            "status": "success",
            "data": {
                "id": material.id,
                "title": material.title,
                "material_type": material.material_type,
                "task_type": material.task_type,
                "created_at": material.created_at.isoformat() if material.created_at else "",
            }
        }
    except Exception as e:
        db.rollback()
        logger.error(f"[LearningMaterials] 数据库写入失败: {e}")
        raise HTTPException(status_code=500, detail=f"存储失败: {str(e)}")
    finally:
        db.close()


@router.get("")
def list_materials(session_id: Optional[str] = None):
    """获取讲义列表，可按 session_id 过滤。"""
    db = SessionLocal()
    try:
        query = db.query(LearningMaterial).order_by(LearningMaterial.created_at.desc())
        if session_id:
            query = query.filter(LearningMaterial.session_id == session_id)

        rows = query.all()
        items = [
            MaterialItem(
                id=r.id,
                session_id=r.session_id,
                title=r.title,
                material_type=r.material_type,
                task_type=r.task_type,
                created_at=r.created_at.isoformat() if r.created_at else "",
            )
            for r in rows
        ]
        return {"status": "success", "data": {"total": len(items), "items": [it.model_dump() for it in items]}}
    finally:
        db.close()


@router.get("/{material_id}")
def get_material(material_id: int):
    """获取单条讲义完整内容。"""
    db = SessionLocal()
    try:
        row = db.query(LearningMaterial).filter(LearningMaterial.id == material_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="讲义不存在")

        return {
            "status": "success",
            "data": MaterialDetail(
                id=row.id,
                session_id=row.session_id,
                title=row.title,
                material_type=row.material_type,
                content_html=row.content_html,
                task_type=row.task_type,
                created_at=row.created_at.isoformat() if row.created_at else "",
            ).model_dump()
        }
    finally:
        db.close()


@router.delete("/{material_id}")
def delete_material(material_id: int):
    """删除指定讲义。"""
    db = SessionLocal()
    try:
        row = db.query(LearningMaterial).filter(LearningMaterial.id == material_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="讲义不存在")
        db.delete(row)
        db.commit()
        return {"status": "success", "message": f"讲义 {material_id} 已删除"}
    finally:
        db.close()
