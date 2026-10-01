"""Local server for net.timeline that never lets the browser cache files.

    python3 serve.py          → http://localhost:8765
"""
import http.server
import os

PORT = 8765


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"net.timeline → http://localhost:{PORT}  (Ctrl+C to stop)")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
