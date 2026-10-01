"""Local server for net.timeline that never lets the browser cache files.

    python3 serve.py          → http://localhost:8765

It also stands in for the Netlify functions at /api/archive and /api/guestbook,
storing records in .local-archive.json and .local-guestbook.json (git-ignored).
The real functions live in netlify/functions/; keep the rules in sync.
Local operator key for the guestbook: GUESTBOOK_ADMIN_KEY env var, default "local".
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
GB_STORE = os.path.join(ROOT, ".local-guestbook.json")
GB_ADMIN_KEY = os.environ.get("GUESTBOOK_ADMIN_KEY", "local")
FIELDS = ["session_id", "exhibition_id", "name", "terms", "started_at", "ended_at",
          "duration_s", "portals_visited", "left_something", "ended_by"]


def load(path=STORE):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=1)


# --- guestbook filter (mirror of netlify/functions/guestbook.mjs) ---
LINKS = [r"https?://", r"www\.", r"\.(com|net|org|ru|xyz)\b"]
SLURS = [r"nig(a|er|ah|uh)", r"fagot", r"\bfag\b", r"retard", r"trany|tranie", r"\bkike\b", r"\bspic\b",
         r"\bchink", r"kil\s*(yo)?ur\s*self", r"\bkys\b"]
PROFANITY = [r"\bcunt", r"whore", r"\bslut", r"\bfuck|\bfuk\b", r"\bshit\b", r"\bbitch", r"\bdick\b",
             r"\bcock\b", r"\bpusy\b|\bpusies\b"]


def normalise(text):
    t = text.lower()
    for chars, letter in (("4@", "a"), ("1!|", "i"), ("0", "o"), ("3", "e"), ("5$", "s"), ("7", "t")):
        t = re.sub("[" + re.escape(chars) + "]", letter, t)
    return re.sub(r"([a-z])\1+", r"\1", t)


def needs_hold(text):
    if any(re.search(p, text, re.I) for p in LINKS):
        return True
    n = normalise(text)
    squashed = re.sub(r"([a-z])\1+", r"\1", re.sub(r"[^a-z]", "", n))
    for p in SLURS:
        if re.search(p, n):
            return True
        if "\\b" not in p and re.search(p, squashed):
            return True
        if "\\b" in p and re.fullmatch("(?:" + p.replace("\\b", "") + ")", squashed):
            return True
    return any(re.search(p, n) for p in PROFANITY)


def public_entry(e):
    first = (e["name"].split() or [e["name"]])[0][:16]
    return {"id": e["id"], "name": first, "message": e["message"], "created_at": e["created_at"]}


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
        if url.path == "/api/guestbook":
            return self.guestbook_get(url)
        if url.path != "/api/archive":
            return super().do_GET()
        page = max(0, int((parse_qs(url.query).get("page") or ["0"])[0] or 0))
        records = load()
        keys = sorted(records, reverse=True)
        visitors = [trace(records[k]) for k in keys[page * PAGE_SIZE:(page + 1) * PAGE_SIZE]]
        self.send_json(200, {"total": len(keys), "page": page,
                             "pages": -(-len(keys) // PAGE_SIZE), "visitors": visitors})

    def do_POST(self):
        if urlparse(self.path).path == "/api/guestbook":
            return self.guestbook_post()
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


def _guestbook_methods():
    def guestbook_get(self, url):
        q = parse_qs(url.query)
        entries = sorted(load(GB_STORE).get("entries", {}).values(), key=lambda e: e["id"], reverse=True)
        if (q.get("all") or [""])[0] == "1":
            if self.headers.get("x-admin-key") != GB_ADMIN_KEY:
                return self.send_json(403, {"error": "forbidden"})
            return self.send_json(200, {"entries": entries})
        visible = [e for e in entries if e["status"] == "visible"]
        page = max(0, int((q.get("page") or ["0"])[0] or 0))
        size = 30
        self.send_json(200, {"total": len(visible), "page": page, "pages": -(-len(visible) // size),
                             "entries": [public_entry(e) for e in visible[page * size:(page + 1) * size]]})

    def guestbook_post(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        except ValueError:
            return self.send_json(400, {"error": "bad json"})
        data = load(GB_STORE)
        entries = data.setdefault("entries", {})
        signed = data.setdefault("sessions", {})
        if isinstance(body, dict) and body.get("action"):
            if self.headers.get("x-admin-key") != GB_ADMIN_KEY:
                return self.send_json(403, {"error": "forbidden"})
            entry = entries.get(body.get("id"))
            if not entry:
                return self.send_json(404, {"error": "not found"})
            if body["action"] == "delete":
                del entries[entry["id"]]
            elif body["action"] in ("show", "hide"):
                entry["status"] = "visible" if body["action"] == "show" else "hidden"
            else:
                return self.send_json(422, {"error": "unknown action"})
            save(GB_STORE, data)
            return self.send_json(200, {"ok": True, "entry": entries.get(body.get("id"))})
        sid = body.get("session_id") if isinstance(body, dict) else None
        name = re.sub(r"\s+", " ", str(body.get("name", ""))).strip()[:32] if isinstance(body, dict) else ""
        message = str(body.get("message", "")).replace("\r\n", "\n").strip() if isinstance(body, dict) else ""
        if not (isinstance(sid, str) and re.fullmatch(r"[a-z0-9]{1,32}", sid) and name and message and len(message) <= 280):
            return self.send_json(422, {"error": "invalid entry"})
        if sid in signed:
            return self.send_json(409, {"error": "already signed"})
        created = datetime.utcnow().isoformat(timespec="milliseconds") + "Z"
        eid = created + "_" + sid
        status = "held" if needs_hold(name + " " + message) else "visible"
        entries[eid] = {"id": eid, "session_id": sid, "name": name, "message": message,
                        "created_at": created, "status": status}
        signed[sid] = eid
        save(GB_STORE, data)
        self.send_json(200, {"ok": True, "status": status,
                             "entry": public_entry(entries[eid]) if status == "visible" else None})

    Handler.guestbook_get = guestbook_get
    Handler.guestbook_post = guestbook_post


_guestbook_methods()

os.chdir(ROOT)
print(f"net.timeline → http://localhost:{PORT}  (Ctrl+C to stop)")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
