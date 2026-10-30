"""OTLP over HTTP/JSON from Claude Code: POST /v1/logs and /v1/metrics, authenticated by an app's ingest key.

Allowlist only: user.email, user.id, account and organisation ids, prompts, tool input and error text are never kept.
Cost comes from api_request log events (one per model call); the cost and token metrics would double count it, so they are ignored.
See docs/claude-code-formats.md.
"""
import time

from flask import Blueprint, jsonify, request

import db
from api.ingest import _within_rate, ingest

bp = Blueprint("otlp", __name__)

API_REQUEST_KEEP = ("model", "input_tokens", "output_tokens", "cache_read_tokens", "cache_creation_tokens",
                    "query_source", "speed", "effort", "session.id")
API_ERROR_KEEP = ("model", "status_code", "attempt", "session.id")
METRICS = {"claude_code.session.count": ("start_type",), "claude_code.lines_of_code.count": ("type",),
           "claude_code.commit.count": (), "claude_code.pull_request.count": ()}


def value(v):
    """An OTLP AnyValue as a plain Python value (ints arrive as strings in OTLP JSON)."""
    v = v or {}
    if "stringValue" in v:
        return v["stringValue"]
    if "intValue" in v:
        return int(v["intValue"])
    if "doubleValue" in v:
        return float(v["doubleValue"])
    if "boolValue" in v:
        return bool(v["boolValue"])
    return None


def attrs(items):
    return {a.get("key"): value(a.get("value")) for a in items or [] if isinstance(a, dict)}


def _ts(item):
    try:
        return int(item.get("timeUnixNano")) / 1e9 or time.time()
    except (TypeError, ValueError):
        return time.time()


def _num(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) else None


def log_events(body):
    out = []
    for rl in body.get("resourceLogs") or []:
        res = attrs((rl.get("resource") or {}).get("attributes"))
        for sl in rl.get("scopeLogs") or []:
            for rec in sl.get("logRecords") or []:
                a = {**res, **attrs(rec.get("attributes"))}
                name = str(a.get("event.name") or value(rec.get("body")) or "").removeprefix("claude_code.")
                if name not in ("api_request", "api_error"):
                    continue
                keep = API_REQUEST_KEEP if name == "api_request" else API_ERROR_KEEP
                out.append({"ts": _ts(rec), "source": "claude", "kind": "external", "actor": "actor:claude",
                            "node": "external:anthropic-api", "status": "ok" if name == "api_request" else "error",
                            "duration_ms": _num(a.get("duration_ms")), "usd": _num(a.get("cost_usd")) or 0,
                            "meta": {k: a[k] for k in keep if a.get(k) is not None}})
    return out


def metric_events(body):
    out = []
    for rm in body.get("resourceMetrics") or []:
        for sm in rm.get("scopeMetrics") or []:
            for m in sm.get("metrics") or []:
                keep = METRICS.get(m.get("name"))
                if keep is None:
                    continue
                for dp in (m.get("sum") or m.get("gauge") or {}).get("dataPoints") or []:
                    a = attrs(dp.get("attributes"))
                    n = _num(dp.get("asDouble")) if "asDouble" in dp else int(dp.get("asInt", 0))
                    out.append({"ts": _ts(dp), "source": "claude", "kind": "log", "actor": "actor:claude",
                                "meta": {"metric": m["name"], "value": n, **{k: a[k] for k in keep if a.get(k) is not None}}})
    return out


def _receive(parse):
    key = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not request.is_json:
        return jsonify(error="Send OTLP as http/json."), 415
    conn = db.connect()
    try:
        app = db.app_for_key(conn, key) if key else None
        if not app:
            return jsonify(error="Unauthorized."), 401
        body = request.get_json(silent=True)
        events = parse(body) if isinstance(body, dict) else []
        if not _within_rate(app, len(events)):
            return jsonify(error="Rate limit."), 429
        ingest(conn, app, events)
        return jsonify({}), 200
    finally:
        conn.close()


@bp.post("/v1/logs")
def logs():
    return _receive(log_events)


@bp.post("/v1/metrics")
def metrics():
    return _receive(metric_events)
