#!/usr/bin/env python3
"""
LLM Arena 本地服务器
- 提供静态文件服务
- /api/state GET/POST 读写本地 JSON 文件
- 数据存在 data/state.json，清浏览器缓存也不丢
"""

import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DATA_DIR = Path(__file__).parent / "data_storage"
DATA_FILE = DATA_DIR / "state.json"

# 确保数据目录存在
DATA_DIR.mkdir(exist_ok=True)


class Handler(SimpleHTTPRequestHandler):
    """处理静态文件 + /api/state 接口"""

    def do_GET(self):
        if self.path == "/api/state":
            self._handle_get_state()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/state":
            self._handle_post_state()
        else:
            self.send_error(404)

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
        if "/api/" in (args[0] if args else ""):
            print(f"  API: {args[0]}")
        elif not any(x in (args[0] if args else "") for x in [".css", ".js", ".ico"]):
            super().log_message(format, *args)


if __name__ == "__main__":
    os.chdir(Path(__file__).parent)
    print(f"""
╔══════════════════════════════════════════╗
║   LLM Arena 本地服务器                   ║
║   http://localhost:{PORT}                 ║
║   数据存储: {DATA_FILE}                  ║
╚══════════════════════════════════════════╝
""")
    server = HTTPServer(("", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        server.server_close()
