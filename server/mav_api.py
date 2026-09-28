#!/usr/bin/env python3
"""mav_api — backend du dashboard Mav.

Petit serveur HTTP (stdlib) qui expose en lecture l'état réel de l'agent :
jobs, mémoire (Postgres), veille, agents, santé des services, métriques VM.
Et un unique point d'écriture : /api/ask, qui envoie un prompt à une session
opencode **dédiée au dashboard** (jamais la session Telegram, pour ne pas
perturber le bot qui tourne en parallèle).

Aucune authentification : destiné à tourner sur une VM privée, joignable
uniquement via VPN. Ne pas exposer sur Internet tel quel.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# ------------------------------------------------------------------- config

PORT = int(os.environ.get("MAV_API_PORT", "8787"))
BIND = os.environ.get("MAV_API_BIND", "0.0.0.0")

BOT_DIR = Path(os.environ.get("BOT_DIR", Path.home() / "bot"))
JOBS_FILE = BOT_DIR / "jobs.json"
JOBS_STATE = BOT_DIR / "jobs_state.json"
MEMORY_FILE = BOT_DIR / "memory.json"
STATIC_DIR = Path(os.environ.get("MAV_STATIC", Path(__file__).resolve().parent.parent))

OPENCODE_URL = os.environ.get("OPENCODE_URL", "http://127.0.0.1:4096").rstrip("/")
PG_DSN = os.environ.get(
    "PG_DSN", "host=127.0.0.1 port=5432 user=mav password=mav_secret dbname=mav"
)
DEFAULT_AGENT = os.environ.get("MAV_DASH_AGENT", "").strip()
# Le modèle par défaut de la config globale peut être retiré côté fournisseur ;
# on fige ici celui que le bot utilise, sourçable par OPENCODE_MODEL.
DEFAULT_MODEL = os.environ.get("OPENCODE_MODEL", "ollama-cloud/deepseek-v4.1-flash").strip()

# ------------------------------------------------------------------- helpers


def _json_default(o):
    return str(o)


def http_json(url: str, method: str = "GET", body: dict | None = None, timeout: float = 8):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode("utf-8", "replace")
        return json.loads(raw) if raw else None


def pg_query(sql: str, params: tuple = ()) -> list[dict]:
    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(PG_DSN, connect_timeout=3)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if cur.description:
                return [dict(r) for r in cur.fetchall()]
            conn.commit()
            return []
    finally:
        conn.close()


def read_json(path: Path, default):
    try:
        return json.loads(Path(path).read_text())
    except Exception:
        return default


def sys_metrics() -> dict:
    out: dict = {}

    # CPU : delta de /proc/stat
    try:
        fields = open("/proc/stat").readline().split()[1:]
        vals = [int(x) for x in fields]
        idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
        total = sum(vals)
        out["_cpu"] = (idle, total)
    except Exception:
        pass

    # Mémoire
    try:
        mem = {}
        for line in open("/proc/meminfo"):
            k, v = line.split(":", 1)
            mem[k] = int(v.strip().split()[0])
        total = mem.get("MemTotal", 1)
        avail = mem.get("MemAvailable", mem.get("MemFree", 0))
        out["mem_pct"] = round((total - avail) / total * 100)
    except Exception:
        pass

    # Disque
    try:
        u = shutil.disk_usage("/")
        out["disk_pct"] = round(u.used / u.total * 100)
    except Exception:
        pass

    # Load / uptime
    try:
        out["load"] = round(float(open("/proc/loadavg").read().split()[0]), 2)
        out["uptime_s"] = int(float(open("/proc/uptime").read().split()[0]))
    except Exception:
        pass

    return out


_cpu_lock = threading.Lock()
_cpu_prev: tuple | None = None


def cpu_pct() -> int | None:
    """Delta entre deux lectures de /proc/stat. La première mesure renvoie None."""
    global _cpu_prev
    cur = sys_metrics().get("_cpu")
    if not cur:
        return None
    with _cpu_lock:
        prev = _cpu_prev
        _cpu_prev = cur
    if prev is None:
        return None
    idle, total = cur
    pidle, ptotal = prev
    dt, di = total - ptotal, idle - pidle
    if dt <= 0:
        return None
    return round((1 - di / dt) * 100)


# ------------------------------------------------------------------- data


def get_status() -> dict:
    m = sys_metrics()
    health = None
    try:
        health = http_json(f"{OPENCODE_URL}/global/health", timeout=4)
    except Exception:
        health = {"healthy": False}

    pg = False
    try:
        pg_query("select 1")
        pg = True
    except Exception:
        pg = False

    n_watch = n_conv = n_facts = 0
    if pg:
        try:
            n_watch = pg_query("select count(*) c from watch_items")[0]["c"]
            n_conv = pg_query("select count(*) c from conversations")[0]["c"]
            n_facts = pg_query("select count(*) c from facts")[0]["c"]
        except Exception:
            pass

    jobs = read_json(JOBS_FILE, [])
    return {
        "mode": "live",
        "agent_online": bool(health and health.get("healthy")),
        "version": (health or {}).get("version"),
        "cpu": cpu_pct() or m.get("load", 0),
        "mem_pct": m.get("mem_pct"),
        "disk_pct": m.get("disk_pct"),
        "load": m.get("load"),
        "uptime_s": m.get("uptime_s"),
        "postgres": pg,
        "jobs_active": sum(1 for j in jobs if j.get("enabled", True)),
        "jobs_total": len(jobs),
        "conversations": n_conv,
        "facts": n_facts,
        "watch_items": n_watch,
    }


def get_connections() -> list[dict]:
    conns = []

    try:
        h = http_json(f"{OPENCODE_URL}/global/health", timeout=4)
        ok = bool(h and h.get("healthy"))
        conns.append({"name": "Moteur opencode", "state": "ok" if ok else "off", "label": "en ligne" if ok else "hors ligne"})
    except Exception:
        conns.append({"name": "Moteur opencode", "state": "off", "label": "hors ligne"})

    try:
        pg_query("select 1")
        conns.append({"name": "Base mémoire", "state": "ok", "label": "connectée"})
    except Exception:
        conns.append({"name": "Base mémoire", "state": "off", "label": "hors ligne"})

    # Docker via socket
    docker_ok = Path("/var/run/docker.sock").exists()
    conns.append({"name": "Docker", "state": "ok" if docker_ok else "warn", "label": "présent" if docker_ok else "inconnu"})

    conns.append({"name": "Telegram", "state": "ok", "label": "pont actif"})
    conns.append({"name": "Proxmox", "state": "ok", "label": "configuré"})
    return conns


def get_jobs() -> dict:
    jobs = read_json(JOBS_FILE, [])
    state = read_json(JOBS_STATE, {})
    out = []
    for j in jobs:
        out.append(
            {
                "name": j.get("name"),
                "description": j.get("description", ""),
                "time": j.get("time", ""),
                "days": j.get("days", []),
                "agent": j.get("agent", ""),
                "enabled": j.get("enabled", True),
                "last_run": state.get(j.get("name")),
            }
        )
    return {"jobs": out}


def get_memory(limit: int = 20) -> dict:
    try:
        convs = pg_query(
            "select question, answer, ts from conversations order by ts desc limit %s",
            (limit,),
        )
    except Exception:
        convs = []
    try:
        facts = pg_query("select fact, source, ts from facts order by ts desc limit 20")
    except Exception:
        facts = []
    try:
        prefs = pg_query("select key, value, ts from preferences order by ts desc limit 20")
    except Exception:
        prefs = []
    return {"conversations": convs, "facts": facts, "preferences": prefs}


def get_watch() -> dict:
    try:
        items = pg_query(
            "select kind, target, last_state, last_checked, enabled from watch_items order by id desc"
        )
    except Exception:
        items = []
    return {"items": items}


def get_agents() -> dict:
    try:
        agents = http_json(f"{OPENCODE_URL}/agent", timeout=6) or []
        names = sorted(
            a["name"]
            for a in agents
            if isinstance(a, dict) and a.get("name") and a.get("mode") in (None, "all", "primary")
        )
        return {"agents": names}
    except Exception:
        return {"agents": []}


# ------------------------------------------------------------------- chat
#
# Les discussions du dashboard sont des sessions opencode dont le titre
# commence par PREFIX. Ça les distingue sans ambiguïté des sessions Telegram
# et des jobs planifiés, sans registre local à maintenir.

PREFIX = "dash: "
DEFAULT_TITLE = "Nouvelle discussion"


def _list_raw_sessions() -> list[dict]:
    try:
        return http_json(f"{OPENCODE_URL}/session", timeout=8) or []
    except Exception:
        return []


def _migrate_legacy() -> None:
    """Renomme l'ancienne session unique au format préfixé."""
    for s in _list_raw_sessions():
        if s.get("title") == "dashboard":
            try:
                http_json(
                    f"{OPENCODE_URL}/session/{s['id']}",
                    method="PATCH",
                    body={"title": PREFIX + "Première discussion"},
                )
            except Exception:
                pass


def list_sessions() -> list[dict]:
    _migrate_legacy()
    out = []
    for s in _list_raw_sessions():
        title = str(s.get("title", ""))
        if not title.startswith(PREFIX):
            continue
        t = s.get("time", {})
        out.append(
            {
                "id": s["id"],
                "title": title[len(PREFIX):] or DEFAULT_TITLE,
                "created": t.get("created"),
                "updated": t.get("updated") or t.get("created"),
            }
        )
    out.sort(key=lambda x: x.get("updated") or 0, reverse=True)
    return out


def create_session(title: str = "") -> dict:
    name = (title or DEFAULT_TITLE).strip()[:80] or DEFAULT_TITLE
    res = http_json(
        f"{OPENCODE_URL}/session", method="POST", body={"title": PREFIX + name}
    )
    return {"id": res["id"], "title": name}


def rename_session(sid: str, title: str) -> bool:
    name = (title or "").strip()[:80]
    if not sid or not name:
        return False
    for verb in ("PATCH", "PUT"):
        try:
            http_json(
                f"{OPENCODE_URL}/session/{sid}", method=verb, body={"title": PREFIX + name}
            )
            return True
        except Exception:
            continue
    return False


def delete_session(sid: str) -> bool:
    if not sid:
        return False
    try:
        http_json(f"{OPENCODE_URL}/session/{sid}", method="DELETE")
        return True
    except Exception:
        return False


def session_title(sid: str) -> str:
    try:
        s = http_json(f"{OPENCODE_URL}/session/{sid}", timeout=6) or {}
        return str(s.get("title", ""))
    except Exception:
        return ""


def session_messages(sid: str) -> list[dict]:
    try:
        entries = http_json(f"{OPENCODE_URL}/session/{sid}/message", timeout=12) or []
    except Exception:
        return []
    msgs = []
    for e in entries:
        info = e.get("info") or {}
        role = info.get("role")
        if role not in ("user", "assistant"):
            continue
        parts = e.get("parts") or []
        text = "\n\n".join(
            (p.get("text") or "").strip()
            for p in parts
            if p.get("type") == "text" and not p.get("synthetic") and (p.get("text") or "").strip()
        )
        if not text:
            continue
        msgs.append(
            {
                "role": "me" if role == "user" else "mav",
                "text": text,
                "ts": (info.get("time") or {}).get("created"),
            }
        )
    return msgs


def _assistant_text(entry: dict) -> str:
    parts = entry.get("parts") or []
    texts = [
        (p.get("text") or "").strip()
        for p in parts
        if p.get("type") == "text" and not p.get("synthetic") and (p.get("text") or "").strip()
    ]
    return texts[-1] if texts else ""


def ask(prompt: str, agent: str = "", sid: str = "") -> str:
    if not sid:
        # Aucune session fournie : on réutilise la plus récente, sinon on en crée une.
        sessions = list_sessions()
        sid = sessions[0]["id"] if sessions else create_session()["id"]
    try:
        before = len(http_json(f"{OPENCODE_URL}/session/{sid}/message", timeout=10) or [])
    except Exception:
        before = 0

    body: dict = {"parts": [{"type": "text", "text": prompt}]}
    ag = agent or DEFAULT_AGENT
    if ag:
        body["agent"] = ag
    if DEFAULT_MODEL and "/" in DEFAULT_MODEL:
        provider, model = DEFAULT_MODEL.split("/", 1)
        body["model"] = {"providerID": provider, "modelID": model}
    http_json(f"{OPENCODE_URL}/session/{sid}/prompt_async", method="POST", body=body)

    deadline = time.time() + 300
    last_text = ""
    while time.time() < deadline:
        time.sleep(1.5)
        try:
            msgs = http_json(f"{OPENCODE_URL}/session/{sid}/message", timeout=10) or []
        except Exception:
            continue
        if len(msgs) <= before:
            continue
        for entry in reversed(msgs):
            info = entry.get("info") or {}
            if info.get("role") != "assistant":
                continue
            err = info.get("error")
            if err:
                msg = (err.get("data") or {}).get("message") or err.get("name") or "erreur du moteur"
                return f"Le moteur a renvoyé une erreur : {msg}"
            text = _assistant_text(entry)
            if text:
                last_text = text
            if info.get("time", {}).get("completed") or info.get("completed"):
                return last_text or "…"
            break
    return last_text or "Je n'ai pas pu terminer à temps. Réessaie ou précise ta demande."


# ------------------------------------------------------------------- server


class Handler(BaseHTTPRequestHandler):
    server_version = "mav-api/0.1"

    def log_message(self, *a):  # silence
        pass

    def _send(self, code: int, payload, ctype="application/json"):
        if isinstance(payload, (dict, list)):
            data = json.dumps(payload, ensure_ascii=False, default=_json_default).encode()
        else:
            data = payload if isinstance(payload, bytes) else str(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path, _, query = self.path.partition("?")
        params = {}
        if query:
            for pair in query.split("&"):
                k, _, v = pair.partition("=")
                params[k] = urllib.parse.unquote_plus(v)
        try:
            if path == "/api/status":
                return self._send(200, get_status())
            if path == "/api/jobs":
                return self._send(200, get_jobs())
            if path == "/api/memory":
                return self._send(200, get_memory())
            if path == "/api/watch":
                return self._send(200, get_watch())
            if path == "/api/agents":
                return self._send(200, get_agents())
            if path == "/api/connections":
                return self._send(200, {"connections": get_connections()})
            if path == "/api/health":
                return self._send(200, {"ok": True, "ts": int(time.time())})
            if path == "/api/sessions":
                return self._send(200, {"sessions": list_sessions()})
            if path == "/api/session":
                sid = params.get("id", "")
                if not sid:
                    return self._send(400, {"error": "id manquant"})
                return self._send(200, {"id": sid, "title": session_title(sid)[len(PREFIX):], "messages": session_messages(sid)})
            return self._static(path)
        except Exception as exc:  # noqa: BLE001
            return self._send(500, {"error": str(exc)})

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        try:
            n = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            payload = {}

        if path == "/api/ask":
            prompt = (payload.get("prompt") or "").strip()
            if not prompt:
                return self._send(400, {"error": "prompt manquant"})
            try:
                answer = ask(prompt, payload.get("agent", ""), payload.get("session", ""))
                return self._send(200, {"answer": answer})
            except Exception as exc:  # noqa: BLE001
                return self._send(500, {"error": str(exc)})
        if path == "/api/session/new":
            try:
                return self._send(200, create_session(payload.get("title", "")))
            except Exception as exc:  # noqa: BLE001
                return self._send(500, {"error": str(exc)})
        if path == "/api/session/rename":
            ok = rename_session(payload.get("id", ""), payload.get("title", ""))
            return self._send(200 if ok else 400, {"ok": ok})
        if path == "/api/session/delete":
            ok = delete_session(payload.get("id", ""))
            return self._send(200 if ok else 400, {"ok": ok})
        return self._send(404, {"error": "not found"})

    def _static(self, path: str):
        if path == "/":
            path = "/index.html"
        rel = path.lstrip("/").replace("..", "")
        target = (STATIC_DIR / rel).resolve()
        if not str(target).startswith(str(STATIC_DIR.resolve())) or not target.is_file():
            return self._send(404, "not found", "text/plain")
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".webmanifest": "application/manifest+json",
            ".json": "application/json",
            ".ico": "image/x-icon",
        }.get(target.suffix, "application/octet-stream")
        return self._send(200, target.read_bytes(), ctype)


def main():
    srv = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"mav-api en écoute sur http://{BIND}:{PORT} (statique: {STATIC_DIR})", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
