"""系统化测试所有后端 API 端点"""

import json
import time
import urllib.request
import urllib.error
from datetime import datetime

BASE_URL = "http://127.0.0.1:8765"
RESULTS = []


def http(method, path, body=None, headers=None, timeout=15):
    """简化的 HTTP 客户端"""
    url = BASE_URL + path
    data = None
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if headers:
        h.update(headers)
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = time.time() - start
            body_bytes = resp.read()
            try:
                body_text = json.loads(body_bytes) if body_bytes else {}
            except json.JSONDecodeError:
                body_text = body_bytes.decode("utf-8", errors="replace")
            return {
                "status": resp.status,
                "body": body_text,
                "elapsed": elapsed,
                "headers": dict(resp.headers),
            }
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start
        try:
            body_text = json.loads(e.read())
        except Exception:
            body_text = str(e)
        return {"status": e.code, "body": body_text, "elapsed": elapsed, "error": True}
    except Exception as e:
        return {"status": 0, "body": str(e), "elapsed": 0, "error": True}


def record(name, method, path, req, resp, expect=200, notes=""):
    ok = "PASS" if resp["status"] == expect else "FAIL"
    RESULTS.append({
        "name": name,
        "method": method,
        "path": path,
        "request": req,
        "response_status": resp["status"],
        "response_body": resp["body"],
        "elapsed_s": round(resp.get("elapsed", 0), 3),
        "expected_status": expect,
        "ok": ok,
        "notes": notes,
    })
    return ok


# ============= 1. 元数据端点 =============
print("\n=== 1. 元数据端点 ===")
resp = http("GET", "/openapi.json")
if resp["status"] == 200:
    paths = resp["body"].get("paths", {})
    print(f"OpenAPI 文档: 找到 {len(paths)} 个路径")
    for p in sorted(paths.keys()):
        for m in paths[p].keys():
            print(f"  {m.upper():6s} {p}")
    record("openapi_schema", "GET", "/openapi.json", None, resp, 200, f"找到 {len(paths)} 个路径")

# ============= 2. 根路径 =============
print("\n=== 2. 根路径健康检查 ===")
resp = http("GET", "/")
print(f"GET / -> {resp['status']}, body={resp['body']}")
record("health_check", "GET", "/", None, resp, 200)

# ============= 3. /api/chat 主端点 =============
print("\n=== 3. /api/chat 端点 ===")
# 3.1 正常请求
resp = http("POST", "/api/chat", body={"user_intent": "测试hello", "session_id": "test-debug-1"})
print(f"POST /api/chat (正常) -> {resp['status']}, 耗时 {resp['elapsed']:.1f}s")
if resp["status"] == 200:
    data = resp["body"].get("data", {})
    print(f"  返回字段: {list(data.keys())}")
record("api_chat_normal", "POST", "/api/chat",
       {"user_intent": "测试hello", "session_id": "test-debug-1"}, resp, 200)

# 3.2 缺少 user_intent
resp = http("POST", "/api/chat", body={"session_id": "test-debug-2"})
print(f"POST /api/chat (缺user_intent) -> {resp['status']}")
record("api_chat_missing_field", "POST", "/api/chat",
       {"session_id": "test-debug-2"}, resp, 422)

# 3.3 缺少 session_id (应使用默认值)
resp = http("POST", "/api/chat", body={"user_intent": "hi"})
print(f"POST /api/chat (缺session_id) -> {resp['status']}")
record("api_chat_default_session", "POST", "/api/chat",
       {"user_intent": "hi"}, resp, 200)

# ============= 4. v1 API 端点 =============
print("\n=== 4. v1 API 端点（检查是否注册）===")
v1_endpoints = [
    ("GET", "/api/v1/auth/me", None),
    ("POST", "/api/v1/auth/login", {"username": "admin", "password": "admin"}),
    ("GET", "/api/v1/user/me", None),
    ("GET", "/api/v1/user/list", None),
    ("POST", "/api/v1/user/login", {"username": "admin", "password": "admin"}),
    ("POST", "/api/v1/chat/stream", {"model": "deepseek", "messages": [{"role": "user", "content": "hi"}]}),
]
for method, path, body in v1_endpoints:
    resp = http(method, path, body=body, timeout=10)
    note = ""
    if resp["status"] == 404:
        note = "端点未注册（main.py 中无 include_router）"
    print(f"{method} {path} -> {resp['status']}  {note}")
    record(f"v1_{path.replace('/', '_')}", method, path, body, resp, None, note)

# ============= 5. 总结 =============
print("\n=== 测试结果统计 ===")
total = len(RESULTS)
passed = sum(1 for r in RESULTS if r["ok"] == "PASS")
failed = sum(1 for r in RESULTS if r["ok"] == "FAIL")
print(f"总数: {total}, PASS: {passed}, FAIL: {failed}")

# 保存到 JSON
with open("f:/college/sophomore/软件杯/backend/api_debug_results.json", "w", encoding="utf-8") as f:
    json.dump(RESULTS, f, ensure_ascii=False, indent=2, default=str)
print("\n详细结果已保存到: api_debug_results.json")
