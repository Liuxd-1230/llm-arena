#!/usr/bin/env python3
"""
LLM Arena 本地服务器
- 提供静态文件服务
- /api/state GET/POST 读写本地 JSON 文件
- /api/llm POST 代理 OpenAI 兼容 API（支持流式/非流式）
- 数据存在 data_storage/state.json，清浏览器缓存也不丢
"""

import ipaddress
import json
import os
import re
import secrets
import socket
import ssl
import sys
import urllib.request
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DATA_DIR = Path(__file__).parent / "data_storage"
DATA_FILE = DATA_DIR / "state.json"

# 请求体大小上限 (10MB)
MAX_BODY_SIZE = 10 * 1024 * 1024

# 确保数据目录存在
DATA_DIR.mkdir(exist_ok=True)

# SSL context for outbound API calls
SSL_CTX = ssl.create_default_context()

# 启动时生成随机 API token，写入 .server-token 文件
API_TOKEN = secrets.token_urlsafe(32)
TOKEN_FILE = Path(__file__).parent / ".server-token"
TOKEN_FILE.write_text(API_TOKEN, encoding="utf-8")
os.chmod(TOKEN_FILE, 0o600)
print(f"API Token: {API_TOKEN}")
print(f"Token 文件: {TOKEN_FILE}")

# 允许的 CORS 来源 (仅 localhost)
ALLOWED_ORIGINS = {
    "http://localhost",
    "http://127.0.0.1",
}
# 动态添加带端口的来源
ALLOWED_ORIGINS_FULL = set()
for origin in list(ALLOWED_ORIGINS):
    for port in [PORT, 8000, 8080, 3000, 5000]:
        ALLOWED_ORIGINS_FULL.add(f"{origin}:{port}")
    ALLOWED_ORIGINS_FULL.add(origin)  # 不带端口的也允许

# 内网地址前缀（拒绝 SSRF）
PRIVATE_NET_PREFIXES = (
    "127.", "10.", "192.168.", "172.16.", "172.17.", "172.18.",
    "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
    "172.24.", "172.25.", "172.26.", "172.27.", "172.28.",
    "172.29.", "172.30.", "172.31.", "0.", "169.254.",
    "localhost", "::1", "fd", "fe80",
)


def _is_private_host(hostname):
    """检查是否为内网地址（使用 ipaddress 模块标准化判断）"""
    if not hostname:
        return True
    hostname = hostname.lower().strip("[]")
    # 直接检查常见前缀
    for prefix in PRIVATE_NET_PREFIXES:
        if hostname.startswith(prefix) or hostname == prefix.rstrip("."):
            return True
    # 检查 0.0.0.0 和 ::ffff: 映射地址
    if hostname in ("0.0.0.0", "::", "::ffff:"):
        return True
    if hostname.startswith("::ffff:"):
        return True
    # 尝试用 ipaddress 模块解析
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return True
    except ValueError:
        pass
    # 尝试 DNS 解析后检查
    try:
        addr = socket.getaddrinfo(hostname, None)
        for family, _, _, _, sockaddr in addr:
            ip_str = sockaddr[0]
            try:
                ip = ipaddress.ip_address(ip_str)
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                    return True
            except ValueError:
                for prefix in PRIVATE_NET_PREFIXES:
                    if ip_str.startswith(prefix):
                        return True
    except (socket.gaierror, OSError):
        pass
    return False


def _validate_endpoint(endpoint):
    """校验 endpoint URL：允许 http/https 地址，本地地址白名单放行"""
    if not endpoint:
        return False, "endpoint 为空"
    if not (endpoint.startswith("http://") or endpoint.startswith("https://")):
        return False, "endpoint 必须以 http:// 或 https:// 开头"
    # 提取 hostname
    try:
        from urllib.parse import urlparse
        parsed = urlparse(endpoint)
        hostname = (parsed.hostname or "").lower().strip("[]")
        # SSRF 防护已关闭：允许所有地址（用户自行确保 endpoint 安全）
    except Exception:
        return False, "endpoint URL 格式无效"
    return True, ""


def _check_auth(handler):
    """验证 Bearer token（仅支持 Authorization header）"""
    auth = handler.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        if token == API_TOKEN:
            return True
    return False


class Handler(SimpleHTTPRequestHandler):
    """处理静态文件 + /api/state + /api/llm 接口"""

    def _cors_origin(self):
        """返回匹配的 CORS origin，不匹配则返回 None"""
        origin = self.headers.get("Origin", "")
        if not origin:
            return None
        # 匹配 http://localhost:PORT 等
        for allowed in ALLOWED_ORIGINS_FULL:
            if origin == allowed:
                return origin
        # 宽松匹配 localhost 和 127.0.0.1（任意端口）
        from urllib.parse import urlparse
        try:
            parsed = urlparse(origin)
            host = parsed.hostname or ""
            if host in ("localhost", "127.0.0.1"):
                return origin
        except Exception:
            pass
        return None

    def _add_cors_headers(self):
        """添加 CORS 头（仅一次）"""
        origin = self._cors_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)

    def do_GET(self):
        if self.path == "/api/token":
            # 返回 token（CORS 已限制为 localhost，远程页面无法访问）
            self._json_response(200, json.dumps({"token": API_TOKEN}))
        elif self.path.startswith("/api/state"):
            if not _check_auth(self):
                self._json_response(401, json.dumps({"error": "未授权，请提供有效 token"}))
                return
            self._handle_get_state()
        elif self.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/state"):
            if not _check_auth(self):
                self._json_response(401, json.dumps({"error": "未授权，请提供有效 token"}))
                return
            self._handle_post_state()
        elif self.path == "/api/llm":
            if not _check_auth(self):
                self._json_response(401, json.dumps({"error": "未授权，请提供有效 token"}))
                return
            self._handle_llm_proxy()
        elif self.path == "/api/models":
            if not _check_auth(self):
                self._json_response(401, json.dumps({"error": "未授权，请提供有效 token"}))
                return
            self._handle_models()
        else:
            self.send_error(404)

    # ==================== /api/state ====================

    def _handle_get_state(self):
        """返回本地存储的 state JSON"""
        if DATA_FILE.exists():
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    data = f.read()
                self._json_response(200, data)
            except Exception as e:
                self._json_response(500, json.dumps({"error": str(e)}))
        else:
            self._json_response(200, json.dumps(None))

    def _handle_post_state(self):
        """保存 state JSON 到本地文件"""
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > MAX_BODY_SIZE:
                self._json_response(413, json.dumps({"error": f"请求体过大，上限 {MAX_BODY_SIZE // (1024*1024)}MB"}))
                return
            body = self.rfile.read(length).decode("utf-8")
            # 验证是合法 JSON
            data = json.loads(body)
            # 校验 entries 字段
            if not isinstance(data, dict):
                self._json_response(400, json.dumps({"error": "请求体必须是 JSON 对象"}))
                return
            if "entries" not in data:
                self._json_response(400, json.dumps({"error": "缺少 entries 字段"}))
                return
            if not isinstance(data["entries"], list):
                self._json_response(400, json.dumps({"error": "entries 必须是数组"}))
                return
            DATA_DIR.mkdir(exist_ok=True)
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                f.write(body)
            self._json_response(200, json.dumps({"ok": True}))
        except json.JSONDecodeError as e:
            self._json_response(400, json.dumps({"error": f"Invalid JSON: {e}"}))
        except Exception as e:
            self._json_response(500, json.dumps({"error": str(e)}))

    # ==================== /api/models ====================

    def _handle_models(self):
        """获取外部 API 的模型列表（GET /v1/models）"""
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > MAX_BODY_SIZE:
                self._json_response(413, json.dumps({"error": f"请求体过大，上限 {MAX_BODY_SIZE // (1024*1024)}MB"}))
                return
            body = self.rfile.read(length).decode("utf-8")
            req_data = json.loads(body)

            endpoint = req_data.get("endpoint", "").rstrip("/")
            api_key = req_data.get("api_key", "")

            if not endpoint or not api_key:
                self._json_response(400, json.dumps({"error": "缺少 endpoint 或 api_key"}))
                return

            # endpoint 白名单校验
            ok, err = _validate_endpoint(endpoint)
            if not ok:
                self._json_response(403, json.dumps({"error": err}))
                return

            # 拼接 /v1/models URL
            if endpoint.endswith("/v1"):
                url = endpoint + "/models"
            elif "/v1/" in endpoint:
                url = endpoint.rstrip("/") + "/models"
            else:
                url = endpoint.rstrip("/") + "/v1/models"

            req = urllib.request.Request(url, method="GET")
            req.add_header("Authorization", f"Bearer {api_key}")
            req.add_header("Content-Type", "application/json")

            with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            # 提取模型 ID 列表
            models = sorted([m.get("id", "") for m in data.get("data", []) if m.get("id")])
            self._json_response(200, json.dumps({"models": models}))

        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            self._json_response(e.code, json.dumps({"error": f"API 返回 {e.code}: {err_body[:200]}"}))
        except urllib.error.URLError as e:
            self._json_response(502, json.dumps({"error": f"连接失败: {str(e.reason)}"}))
        except Exception as e:
            self._json_response(500, json.dumps({"error": str(e)}))

    # ==================== /api/llm ====================

    def _handle_llm_proxy(self):
        """代理转发到外部 OpenAI 兼容 API（支持流式和非流式）"""
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > MAX_BODY_SIZE:
                self._json_response(413, json.dumps({"error": f"请求体过大，上限 {MAX_BODY_SIZE // (1024*1024)}MB"}))
                return
            body = self.rfile.read(length).decode("utf-8")
            req_data = json.loads(body)

            endpoint = req_data.get("endpoint", "").rstrip("/")
            api_key = req_data.get("api_key", "")
            model = req_data.get("model", "")
            messages = req_data.get("messages", [])
            max_tokens = req_data.get("max_tokens")  # 不设默认值，由 API 自行决定
            temperature = req_data.get("temperature", 0.7)
            stream = req_data.get("stream", False)

            if not endpoint or not api_key or not model:
                self._json_response(400, json.dumps({
                    "error": "缺少 endpoint、api_key 或 model 参数"
                }))
                return

            # endpoint 白名单校验
            ok, err = _validate_endpoint(endpoint)
            if not ok:
                self._json_response(403, json.dumps({"error": err}))
                return

            # 智能拼接 URL：如果 endpoint 已经以 /chat/completions 结尾就直接用
            if endpoint.endswith("/chat/completions"):
                url = endpoint
            elif endpoint.endswith("/v1"):
                url = endpoint + "/chat/completions"
            elif "/v1/" in endpoint:
                url = endpoint  # 已经包含 v1/路径，直接追加 chat/completions 可能不对
                if not endpoint.endswith("/chat/completions"):
                    url = endpoint.rstrip("/") + "/chat/completions"
            else:
                url = endpoint + "/v1/chat/completions"

            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "stream": stream
            }
            if max_tokens is not None:
                payload["max_tokens"] = max_tokens

            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, method="POST")
            req.add_header("Content-Type", "application/json")
            req.add_header("Authorization", f"Bearer {api_key}")

            if stream:
                self._handle_streaming_response(req)
            else:
                self._handle_normal_response(req)

        except json.JSONDecodeError as e:
            self._json_response(400, json.dumps({"error": f"Invalid JSON: {e}"}))
        except Exception as e:
            self._json_response(500, json.dumps({
                "error": f"代理请求失败: {str(e)}"
            }))

    def _handle_normal_response(self, req):
        """非流式请求：转发并返回完整响应"""
        try:
            resp = urllib.request.urlopen(req, timeout=None, context=SSL_CTX)
            result = resp.read().decode("utf-8")
            status = resp.getcode()
            # 回传上游的状态码和内容类型
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._add_cors_headers()
            self.end_headers()
            self.wfile.write(result.encode("utf-8"))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._add_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                "error": f"API 返回 {e.code}: {error_body[:1000]}"
            }).encode("utf-8"))
        except urllib.error.URLError as e:
            self._json_response(502, json.dumps({
                "error": f"无法连接到 API: {str(e.reason)}"
            }))
        except Exception as e:
            self._json_response(502, json.dumps({
                "error": f"请求失败: {str(e)}"
            }))

    def _handle_streaming_response(self, req):
        """流式请求：SSE 透传"""
        try:
            resp = urllib.request.urlopen(req, timeout=None, context=SSL_CTX)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self._add_cors_headers()
            self.end_headers()

            for line in resp:
                decoded = line.decode("utf-8", errors="replace")
                self.wfile.write(decoded.encode("utf-8"))
                self.wfile.flush()

            resp.close()
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            try:
                err_msg = json.dumps({"error": f"API 流式错误 {e.code}: {error_body[:500]}"})
                self.wfile.write(f"data: {err_msg}\n\n".encode("utf-8"))
                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
            except Exception:
                pass
        except Exception as e:
            try:
                err_msg = json.dumps({"error": f"流式请求失败: {str(e)}"})
                self.wfile.write(f"data: {err_msg}\n\n".encode("utf-8"))
                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
            except Exception:
                pass

    # ==================== 工具方法 ====================

    def _json_response(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._add_cors_headers()
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))

    def do_OPTIONS(self):
        """CORS preflight"""
        self.send_response(200)
        self._add_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def end_headers(self):
        """不自动添加 CORS 头（由 _add_cors_headers 按需添加）"""
        super().end_headers()

    def log_message(self, format, *args):
        """简化日志"""
        msg = str(args[0]) if args else ""
        if "/api/" in msg:
            print(f"  API: {args[0]}")
        elif not any(x in msg for x in [".css", ".js", ".ico", "favicon"]):
            super().log_message(format, *args)


if __name__ == "__main__":
    os.chdir(Path(__file__).parent)
    print(f"""
╔══════════════════════════════════════════╗
║   LLM Arena 本地服务器                   ║
║   http://localhost:{PORT}                 ║
║   数据存储: {DATA_FILE}                  ║
║   LLM 代理: POST /api/llm               ║
║   Token 文件: {TOKEN_FILE}              ║
╚══════════════════════════════════════════╝
""")
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        server.server_close()
