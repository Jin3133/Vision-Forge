"""MinerU Agent 轻量解析 API 封装

API 调用流程（两步）：
  1. POST JSON → 获取 OSS 预签名上传地址 + task_id
  2. PUT 文件到 OSS 地址
  3. GET 轮询任务状态 → 完成时从 markdown_url 获取 Markdown 内容
"""

import logging
import os
import time

import requests

from core.config import settings
from core.exceptions import MinerUApiError, MinerURateLimitError, MinerUTimeoutError

logger = logging.getLogger(__name__)


# ── 内部函数 ────────────────────────────────────────────

def _submit_by_json(file_name, base_url, language="ch", enable_table=True,
                    enable_formula=True, is_ocr=False):
    """通过 JSON 提交文件信息，获取 OSS 上传地址和 task_id。

    Returns:
        (task_id, file_url)
    """
    payload = {
        "file_name": file_name,
        "language": language,
        "enable_table": enable_table,
        "enable_formula": enable_formula,
        "is_ocr": is_ocr,
    }
    resp = requests.post(
        f"{base_url}/api/v1/agent/parse/file",
        json=payload,
        timeout=60,
    )
    if resp.status_code == 429:
        raise MinerURateLimitError(f"速率限制: {resp.text}")

    data = resp.json()
    if resp.status_code != 200 or data.get("code") != 0:
        raise MinerUApiError(f"提交文件解析任务失败: {data}")

    task_id = data["data"]["task_id"]
    file_url = data["data"]["file_url"]
    logger.info("文件解析任务已提交, task_id=%s", task_id)
    return task_id, file_url


def _upload_to_oss(file_url, file_path):
    """将文件上传到 OSS 预签名地址。"""
    with open(file_path, "rb") as f:
        content = f.read()

    resp = requests.put(file_url, data=content, timeout=120)
    if resp.status_code not in (200, 201, 204):
        raise MinerUApiError(f"上传文件到 OSS 失败: status={resp.status_code}")
    logger.info("文件上传到 OSS 成功")


def _poll_result(task_id, base_url, timeout=120, interval=3):
    """轮询任务结果，返回 Markdown 内容字符串。"""
    url = f"{base_url}/api/v1/agent/parse/{task_id}"
    deadline = time.time() + timeout

    while time.time() < deadline:
        resp = requests.get(url, timeout=30)
        data = resp.json()

        if resp.status_code != 200 or data.get("code") != 0:
            raise MinerUApiError(f"轮询任务状态失败: {data}")

        state = data["data"].get("state", "")
        logger.debug("task_id=%s state=%s", task_id, state)

        if state == "done":
            # 从 markdown_url 获取内容
            md_url = data["data"].get("markdown_url")
            if md_url:
                md_resp = requests.get(md_url, timeout=60)
                md_resp.raise_for_status()
                return md_resp.text

            # 兼容旧格式：content / md_content / url
            result = data["data"]
            content = result.get("content") or result.get("md_content")
            if content:
                return content
            cdn_url = result.get("url")
            if cdn_url:
                cdn_resp = requests.get(cdn_url, timeout=30)
                cdn_resp.raise_for_status()
                return cdn_resp.text

            raise MinerUApiError(f"任务完成但无内容: {data}")

        if state == "failed":
            err_msg = data["data"].get("err_msg", "未知错误")
            raise MinerUApiError(f"解析任务失败: {err_msg}")

        time.sleep(interval)

    raise MinerUTimeoutError(f"轮询超时 ({timeout}s), task_id={task_id}")


# ── 公开接口 ────────────────────────────────────────────

def mineru_parse(file_path, language="ch", enable_table=True, enable_formula=True,
                 is_ocr=False, page_range=None, timeout=None, poll_interval=None,
                 base_url=None, max_file_size=None):
    """解析本地文件，返回 Markdown 内容字符串。

    Args:
        file_path: 本地文件路径
        language: 语言，默认 "ch"
        enable_table: 是否启用表格识别
        enable_formula: 是否启用公式识别
        is_ocr: 是否启用 OCR
        page_range: 页面范围（当前未使用，暂保留）
        timeout: 轮询超时秒数
        poll_interval: 轮询间隔秒数
        base_url: MinerU API 基础 URL
        max_file_size: 最大文件大小（字节）

    Returns:
        Markdown 内容字符串
    """
    base_url = base_url or settings.MINERU_BASE_URL
    max_file_size = max_file_size or settings.MINERU_MAX_FILE_SIZE
    timeout = timeout or settings.MINERU_TIMEOUT
    poll_interval = poll_interval or settings.MINERU_POLL_INTERVAL

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")

    file_size = os.path.getsize(file_path)
    if file_size > max_file_size:
        raise MinerUApiError(f"文件过大 ({file_size / 1024 / 1024:.1f}MB)，最大支持 {max_file_size / 1024 / 1024:.0f}MB")

    file_name = os.path.basename(file_path)

    task_id, file_url = _submit_by_json(
        file_name, base_url, language=language,
        enable_table=enable_table, enable_formula=enable_formula,
        is_ocr=is_ocr,
    )
    _upload_to_oss(file_url, file_path)
    result = _poll_result(task_id, base_url, timeout=timeout, interval=poll_interval)

    return result


def mineru_parse_url(url, language="ch", enable_table=True, enable_formula=True,
                     is_ocr=False, page_range=None, timeout=None, poll_interval=None,
                     base_url=None):
    """通过 URL 解析文件，返回 Markdown 内容字符串。"""
    base_url = base_url or settings.MINERU_BASE_URL
    timeout = timeout or settings.MINERU_TIMEOUT
    poll_interval = poll_interval or settings.MINERU_POLL_INTERVAL

    payload = {
        "url": url,
        "language": language,
        "enable_table": enable_table,
        "enable_formula": enable_formula,
        "is_ocr": is_ocr,
    }
    if page_range:
        payload["page_range"] = page_range

    resp = requests.post(
        f"{base_url}/api/v1/agent/parse/url",
        json=payload,
        timeout=60,
    )
    if resp.status_code == 429:
        raise MinerURateLimitError(f"速率限制: {resp.text}")

    data = resp.json()
    if resp.status_code != 200 or data.get("code") != 0:
        raise MinerUApiError(f"提交 URL 解析任务失败: {data}")

    task_id = data["data"]["task_id"]
    logger.info("URL 解析任务已提交, task_id=%s", task_id)

    result = _poll_result(task_id, base_url, timeout=timeout, interval=poll_interval)
    return result
