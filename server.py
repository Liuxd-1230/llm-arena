#!/usr/bin/env python3
"""
LLM Arena 本地服务器
- 提供静态文件服务
- /api/state GET/POST 读写本地 JSON 文件
- /api/llm POST 代理 OpenAI 兼容 API（支持流式/非流式）
- 数据存在 data_storage/state.json，清浏览器缓存也不丢
"""

import json
import os
import sys
import ssl
import urllib.request
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DATA_DIR = Path(__file__).parent / "data_storage"
DATA_FILE = DATA_DIR / "state.json"

# 确保数据目录存在
DATA_DIR.mkdir(exist_ok=True)

# SSL context for outbound API calls
SSL_CTX = ssl.create_default_context()


class Handler(SimpleHTTPRequestHandler):
    """处理静态文件 + /api/state + /api/llm 接口"""

    def do_GET(self):
        if self.path == "/api/state":
            self._handle_get_state()
        elif self.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/state":
            self._handle_post_state()
        elif self.path == "/api/llm":
            self._handle_llm_proxy()
        elif self.path == "/api/models":
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
            body = self.rfile.read(length).decode("utf-8")
            # 验证是合法 JSON
            json.loads(body)
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
            body = self.rfile.read(length).decode("utf-8")
            req_data = json.loads(body)

            endpoint = req_data.get("endpoint", "").rstrip("/")
            api_key = req_data.get("api_key", "")

            if not endpoint or not api_key:
                self._json_response(400, json.dumps({"error": "缺少 endpoint 或 api_key"}))
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

            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
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
            body = self.rfile.read(length).decode("utf-8")
            req_data = json.loads(body)

            endpoint = req_data.get("endpoint", "").rstrip("/")
            api_key = req_data.get("api_key", "")
            model = req_data.get("model", "")
            messages = req_data.get("messages", [])
            max_tokens = req_data.get("max_tokens", 2048)
            temperature = req_data.get("temperature", 0.7)
            stream = req_data.get("stream", False)

            if not endpoint or not api_key or not model:
                self._json_response(400, json.dumps({
                    "error": "缺少 endpoint、api_key 或 model 参数"
                }))
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
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": stream
            }

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
            resp = urllib.request.urlopen(req, timeout=120, context=SSL_CTX)
            result = resp.read().decode("utf-8")
            status = resp.getcode()
            # 回传上游的状态码和内容类型
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(result.encode("utf-8"))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
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
            resp = urllib.request.urlopen(req, timeout=120, context=SSL_CTX)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
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
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))

    def do_OPTIONS(self):
        """CORS preflight"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def end_headers(self):
        """给所有响应加 CORS 头"""
        self.send_header("Access-Control-Allow-Origin", "*")
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
╚══════════════════════════════════════════╝
""")
    server = HTTPServer(("", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        server.server_close()
