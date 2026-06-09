import tempfile
import os

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel
from typing import Optional

from core.logger import logger
from core.exceptions import UnsupportedFileTypeError, ParseTimeoutError, MinerUApiError
from core.state import state_manager
from services.external_services.document_parser import parse_document, mineru_parse_url


router = APIRouter()


# ==== 请求参数定义 ====
class ParseUrlRequest(BaseModel):
    url: str
    language: str = "ch"
    enable_table: bool = True
    enable_formula: bool = True
    is_ocr: bool = False
    page_range: Optional[str] = None
    session_id: Optional[str] = None


# ==== 异常处理工具函数 ====
def handle_parse_error(e: Exception):
    if isinstance(e, UnsupportedFileTypeError):
        raise HTTPException(status_code=400, detail=str(e))
    if isinstance(e, FileNotFoundError):
        raise HTTPException(status_code=404, detail=str(e))
    if isinstance(e, ParseTimeoutError):
        raise HTTPException(status_code=408, detail=str(e))
    if isinstance(e, MinerUApiError):
        raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=500, detail=str(e))


# ==== 文件上传解析 ====
@router.post("/parse", summary="文档解析 - 文件上传")
async def parse_file(
    file: UploadFile = File(...),
    language: str = "ch",
    enable_table: bool = True,
    enable_formula: bool = True,
    is_ocr: bool = False,
    page_range: Optional[str] = None,
    session_id: Optional[str] = Form(None),
):
    tmp_path = None
    try:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            tmp.write(await file.read())

        result = parse_document(
            file_path=tmp_path,
            language=language,
            enable_table=enable_table,
            enable_formula=enable_formula,
            is_ocr=is_ocr,
            page_range=page_range,
        )
        if session_id:
            state_manager.update_state(session_id, {"parsed_document_content": result})
        return {"code": 0, "message": "解析成功", "data": {"content": result}}
    except Exception as e:
        logger.error(f"[文档解析失败] {str(e)}")
        handle_parse_error(e)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


# ==== URL 解析 ====
@router.post("/parse-url", summary="文档解析 - URL 解析")
async def parse_url(data: ParseUrlRequest):
    try:
        result = mineru_parse_url(
            url=data.url,
            language=data.language,
            enable_table=data.enable_table,
            enable_formula=data.enable_formula,
            is_ocr=data.is_ocr,
            page_range=data.page_range,
        )
        if data.session_id:
            state_manager.update_state(data.session_id, {"parsed_document_content": result})
        return {"code": 0, "message": "解析成功", "data": {"content": result}}
    except Exception as e:
        logger.error(f"[URL文档解析失败] {str(e)}")
        handle_parse_error(e)
