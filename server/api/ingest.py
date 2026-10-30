"""POST /ingest/events: batches of metadata-only events, authenticated by a per-app ingest key."""
import json
import threading
import time
from datetime import datetime

from flask import Blueprint, jsonify, request

import db
from bus import bus

bp = Blueprint("ingest", __name__)

KINDS = {"request", "read", "write", "external", "probe", "cost", "admin", "log"}
SOURCES = {"app", "claude", "probe", "collector"}
MAX_BATCH = 500
MAX_META = 2048
MAX_FUTURE_S = 600
RATE_PER_MIN = 6000  # events per key per minute

_rate = {}  # app -> [window_start, count]
_rate_lock = threading.Lock()


def _within_rate(app, n):
    now = time.time()
    with _rate_lock:
        w = _rate.setdefault(app, [now, 0])
        if now - w[0] >= 60:
            w[0], w[1] = now, 0
        w[1] += n
        return w[1] <= RATE_PER_MIN


def _ts(value, now):
    if isinstance(value, (int, float)):
        return float(value)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()


def clean(raw, app, now):
    """Return a stored event dict, or None if invalid. The app comes from the key, never from the payload."""
    if not isinstance(raw, dict) or raw.get("kind") not in KINDS:
        return None
    try:
        ts = _ts(raw.get("ts", now), now)
    except (ValueError, TypeError):
        return None
    if ts > now + MAX_FUTURE_S:
        return None
    meta = raw.get("meta") if isinstance(raw.get("meta"), dict) else {}
    meta_json = json.dumps(meta, separators=(",", ":"))
    if len(meta_json) > MAX_META:
        meta_json = "{}"

    def s(k, n=300):
        v = raw.get(k)
        return str(v)[:n] if v is not None else None

    def num(k):
        v = raw.get(k)
        return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None

    source = raw.get("source") if raw.get("source") in SOURCES else "app"
    return {"ts": ts, "recv": now, "app": app, "source": source, "kind": raw["kind"], "actor": s("actor"),
            "node": s("node"), "target": s("target"), "status": s("status", 20), "duration_ms": num("duration_ms"),
            "bytes": int(num("bytes")) if num("bytes") is not None else None, "usd": num("usd") or 0.0,
            "meta": meta_json}


def store(conn, ev):
    conn.execute("INSERT INTO events (ts,recv,app,source,kind,actor,node,target,status,duration_ms,bytes,usd,meta) "
                 "VALUES (:ts,:recv,:app,:source,:kind,:actor,:node,:target,:status,:duration_ms,:bytes,:usd,:meta)", ev)
    for node in (ev["node"], ev["target"], ev["actor"]):
        if node:
            conn.execute("INSERT INTO nodes (app,id,kind,first_seen,last_seen,hits) VALUES (?,?,?,?,?,1) "
                         "ON CONFLICT(app,id) DO UPDATE SET last_seen=excluded.last_seen, hits=hits+1",
                         (ev["app"], node, node.split(":", 1)[0], ev["recv"], ev["recv"]))
    src, dst = (ev["node"], ev["target"]) if ev["target"] else (ev["actor"], ev["node"])
    if src and dst and src != dst:
        conn.execute("INSERT INTO edges (app,src,dst,kind,hits,last_seen) VALUES (?,?,?,?,1,?) "
                     "ON CONFLICT(app,src,dst,kind) DO UPDATE SET hits=hits+1, last_seen=excluded.last_seen",
                     (ev["app"], src, dst, ev["kind"], ev["recv"]))


def ingest(conn, app, raws, now=None):
    """Store valid events and publish them to the live bus. Returns (accepted, rejected)."""
    now = now or time.time()
    events = [e for e in (clean(r, app, now) for r in raws) if e]
    with conn:
        for ev in events:
            store(conn, ev)
    for ev in events:
        bus.publish({**ev, "meta": json.loads(ev["meta"])})
    return len(events), len(raws) - len(events)


@bp.post("/ingest/events")
def ingest_events():
    key = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    conn = db.connect()
    try:
        app = db.app_for_key(conn, key) if key else None
        if not app:
            return jsonify(error="Unauthorized."), 401
        body = request.get_json(silent=True)
        raws = body.get("events") if isinstance(body, dict) else body
        if not isinstance(raws, list) or len(raws) > MAX_BATCH:
            return jsonify(error=f"Send a JSON list of at most {MAX_BATCH} events."), 400
        if not _within_rate(app, len(raws)):
            return jsonify(error="Rate limit."), 429
        accepted, rejected = ingest(conn, app, raws)
        return jsonify(accepted=accepted, rejected=rejected), 202
    finally:
        conn.close()
