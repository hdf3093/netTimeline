"""Local server for net.timeline that never lets the browser cache files.

    python3 serve.py          → http://localhost:8765

It also stands in for the Netlify archive function at /api/archive, storing
records in .local-archive.json (git-ignored) so the archive works offline.
The real function lives in netlify/functions/archive.mjs; keep the rules in sync.
"""
import http.server
import json
import os
import re
from datetime import datetime
from urllib.parse import urlparse, parse_qs

PORT = 8765
PAGE_SIZE = 20
ROOT = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.join(ROOT, ".local-archive.json")
FIELDS = ["session_id", "exhibition_id", "name", "terms", "started_at", "ended_at",
          "duration_s", "portals_visited", "left_something", "ended_by"]


def load():
    try:
        with open(STORE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def is_date(v):
    try:
        datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def is_int(v, top):
    return isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= top


def validate(r):
    if not isinstance(r, dict):
        return None
    s = lambda k, top: isinstance(r.get(k), str) and 0 < len(r[k]) <= top
    ok = (s("session_id", 32) and re.fullmatch(r"[a-z0-9]+", r["session_id"])
          and s("exhibition_id", 64) and s("name", 32)
          and r.get("terms") in ("accepted", "declined")
          and is_date(r.get("started_at")) and is_date(r.get("ended_at"))
          and is_int(r.get("duration_s"), 86400) and is_int(r.get("portals_visited"), 100)
          and isinstance(r.get("left_something"), bool)
          and r.get("ended_by") in ("visitor", "idle"))
    return {k: r[k] for k in FIELDS} if ok else None


def trace(r):
    first = (r["name"].split() or [r["name"]])[0][:16]
    return {"session_id": r["session_id"], "exhibition_id": r["exhibition_id"], "name": first,
            "started_at": r["started_at"], "ended_at": r["ended_at"], "duration_s": r["duration_s"],
            "left_something": r["left_something"], "ended_by": r["ended_by"]}


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path != "/api/archive":
            return super().do_GET()
        page = max(0, int((parse_qs(url.query).get("page") or ["0"])[0] or 0))
        records = load()
        keys = sorted(records, reverse=True)
        visitors = [trace(records[k]) for k in keys[page * PAGE_SIZE:(page + 1) * PAGE_SIZE]]
        self.send_json(200, {"total": len(keys), "page": page,
                             "pages": -(-len(keys) // PAGE_SIZE), "visitors": visitors})

    def do_POST(self):
        if urlparse(self.path).path != "/api/archive":
            return self.send_json(405, {"error": "method not allowed"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        except ValueError:
            return self.send_json(400, {"error": "bad json"})
        record = validate(body)
        if not record:
            return self.send_json(422, {"error": "invalid record"})
        records = load()
        records[record["ended_at"] + "_" + record["session_id"]] = record
        with open(STORE, "w") as f:
            json.dump(records, f, indent=1)
        self.send_json(200, {"ok": True})


os.chdir(ROOT)
print(f"net.timeline → http://localhost:{PORT}  (Ctrl+C to stop)")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
