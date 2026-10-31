"""Read API for the web app: GET /api/apps, /api/summary, /api/uptime, /api/costs, /api/usage, /api/events, /api/graph.

Every endpoint takes ?app=<slug>; without it (or app=all) it covers all apps. Never returns key hashes or admin tokens.
shortcut: 24-hour figures are computed from raw events on each request; switch to the hourly rollups if an app sends millions a day.
"""
import json
import time
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

import db
from api.admin import admin_token

bp = Blueprint("read", __name__)
DAY = 86400


def _app():
    a = request.args.get("app", "")
    return None if a in ("", "all") else a


def _where(app, col="app"):
    return (f" AND {col}=?", [app]) if app else ("", [])


def _pct(vals, p):
    vals = sorted(v for v in vals if v is not None)
    return round(vals[min(len(vals) - 1, int(p * len(vals)))], 1) if vals else None


def _day(ts):
    return datetime.fromtimestamp(ts, timezone.utc).date().isoformat()


def _q(sql, args=()):
    conn = db.connect()
    try:
        return [dict(r) for r in conn.execute(sql, args)]
    finally:
        conn.close()


@bp.get("/api/apps")
def apps():
    rows = _q("SELECT slug, name, base_url, health_url, admin_url FROM apps ORDER BY name")
    latest = {r["app"]: r for r in _q("SELECT app, ok, code, ms, MAX(ts) AS ts FROM probes WHERE check_name='health' GROUP BY app")}
    out = []
    for r in rows:
        p = latest.get(r["slug"])
        caps = ["events", "map"] + (["probes"] if r["health_url"] else []) + (["admin"] if r["admin_url"] and admin_token(r["slug"]) else [])
        out.append({"slug": r["slug"], "name": r["name"], "base_url": r["base_url"], "capabilities": caps,
                    "status": None if not p else ("up" if p["ok"] else "down"), "checked": p and p["ts"], "ms": p and p["ms"]})
    return jsonify(out)


def _costs_by_day(app, since):
    """{day: {"claude": usd, "app": usd}}. App API cost per day is the larger of live cost events and the pulled
    /admin/usage figures, since both describe the same calls and either may be missing (emitter off, collector off)."""
    w, a = _where(app)
    days = {}
    for r in _q(f"SELECT ts, source, usd FROM events WHERE ts>=? AND usd>0{w}", [since, *a]):
        d = days.setdefault(_day(r["ts"]), {"claude": 0.0, "app": 0.0, "_pulled": 0.0})
        d["claude" if r["source"] == "claude" else "app"] += r["usd"]
    for r in _q(f"SELECT day, SUM(usd) AS usd FROM costs WHERE day>=?{w} GROUP BY day", [_day(since), *a]):
        days.setdefault(r["day"], {"claude": 0.0, "app": 0.0, "_pulled": 0.0})["_pulled"] = r["usd"] or 0
    for d in days.values():
        d["app"] = round(max(d["app"], d.pop("_pulled")), 5)
        d["claude"] = round(d["claude"], 5)
    return dict(sorted(days.items()))


def _uptime(app, since):
    w, a = _where(app)
    r = _q(f"SELECT COUNT(*) AS n, SUM(ok) AS ok FROM probes WHERE check_name='health' AND ts>=?{w}", [since, *a])[0]
    return round(100 * r["ok"] / r["n"], 2) if r["n"] else None


@bp.get("/api/summary")
def summary():
    app, now = _app(), time.time()
    w, a = _where(app)
    evs = _q(f"SELECT kind, status, duration_ms FROM events WHERE ts>=?{w}", [now - DAY, *a])
    reqs = [e for e in evs if e["kind"] == "request"]
    costs = _costs_by_day(app, now - 31 * DAY)
    today, month = _day(now), _day(now)[:7]
    total = lambda pred: round(sum(v["claude"] + v["app"] for d, v in costs.items() if pred(d)), 4)
    return jsonify({
        "requests": len(reqs), "errors": sum(e["status"] == "error" for e in evs),
        "p95_ms": _pct([e["duration_ms"] for e in reqs], 0.95),
        "reads": sum(e["kind"] == "read" for e in evs), "writes": sum(e["kind"] == "write" for e in evs),
        "externals": sum(e["kind"] == "external" for e in evs),
        "cost_today": total(lambda d: d == today), "cost_month": total(lambda d: d.startswith(month)),
        "uptime_24h": _uptime(app, now - DAY), "uptime_30d": _uptime(app, now - 30 * DAY),
    })


@bp.get("/api/uptime")
def uptime():
    app, now = _app(), time.time()
    w, a = _where(app)
    days = {}
    for r in _q(f"SELECT ts, ok, ms FROM probes WHERE check_name='health' AND ts>=?{w}", [now - 90 * DAY, *a]):
        d = days.setdefault(_day(r["ts"]), {"checks": 0, "ok": 0, "ms": []})
        d["checks"] += 1
        d["ok"] += r["ok"]
        d["ms"].append(r["ms"])
    recent = _q(f"SELECT app, ts, check_name, code, ms, ok FROM probes WHERE ts>=?{w} ORDER BY ts DESC LIMIT 60", [now - DAY, *a])
    incidents = [p for p in _q(f"SELECT app, ts, check_name, code FROM probes WHERE ok=0 AND ts>=?{w} ORDER BY ts DESC LIMIT 50",
                               [now - 90 * DAY, *a])]
    return jsonify({"days": [{"day": d, "checks": v["checks"], "up_pct": round(100 * v["ok"] / v["checks"], 2),
                              "p50_ms": _pct(v["ms"], 0.5)} for d, v in sorted(days.items())],
                    "recent": recent, "incidents": incidents})


@bp.get("/api/costs")
def costs():
    app, now = _app(), time.time()
    w, a = _where(app)
    models = {}
    for r in _q(f"SELECT usd, meta FROM events WHERE source='claude' AND usd>0 AND ts>=?{w}", [now - 30 * DAY, *a]):
        m = json.loads(r["meta"] or "{}").get("model", "unknown")
        models[m] = round(models.get(m, 0) + r["usd"], 5)
    skus = _q(f"SELECT api, sku, SUM(count) AS count, ROUND(SUM(usd), 5) AS usd FROM costs WHERE day>=?{w} GROUP BY api, sku ORDER BY usd DESC",
              [_day(now - 30 * DAY), *a])
    return jsonify({"days": [{"day": d, **v} for d, v in _costs_by_day(app, now - 30 * DAY).items()],
                    "claude_models": [{"model": k, "usd": v} for k, v in sorted(models.items(), key=lambda kv: -kv[1])],
                    "app_skus": skus})


@bp.get("/api/usage")
def usage():
    app, now = _app(), time.time()
    w, a = _where(app)
    groups = {"routes": {}, "externals": {}}
    hours = {}
    for e in _q(f"SELECT ts, kind, node, target, status, duration_ms, meta FROM events WHERE kind IN ('request','external') AND ts>=?{w}",
                [now - DAY, *a]):
        name = e["node"] if e["kind"] == "request" else e["target"] or e["node"]
        g = groups["routes" if e["kind"] == "request" else "externals"].setdefault(name, {"name": name, "calls": 0, "errors": 0, "ms": []})
        g["calls"] += 1
        g["errors"] += e["status"] == "error"
        g["ms"].append(e["duration_ms"])
        if e["kind"] == "request":
            h = int(e["ts"] // 3600) * 3600
            hours[h] = hours.get(h, 0) + 1

    def rows(d):
        return sorted(({"name": g["name"].split(":", 1)[-1], "calls": g["calls"], "errors": g["errors"],
                        "p50_ms": _pct(g["ms"], 0.5), "p95_ms": _pct(g["ms"], 0.95)} for g in d.values()), key=lambda r: -r["calls"])

    first = int((now - DAY) // 3600) * 3600 + 3600
    return jsonify({"routes": rows(groups["routes"]), "externals": rows(groups["externals"]),
                    "hours": [{"ts": h, "requests": hours.get(h, 0)} for h in range(first, int(now) + 1, 3600)]})


@bp.get("/api/events")
def events():
    app = _app()
    w, a = _where(app)
    for col in ("kind", "source"):
        if request.args.get(col):
            w += f" AND {col}=?"
            a.append(request.args[col])
    if request.args.get("paid"):
        w += " AND usd>0"
    before = request.args.get("before", type=int)
    if before:
        w += " AND id<?"
        a.append(before)
    limit = max(1, min(request.args.get("limit", 100, type=int), 500))
    rows = _q(f"SELECT id, ts, app, source, kind, actor, node, target, status, duration_ms, bytes, usd, meta FROM events "
              f"WHERE 1=1{w} ORDER BY id DESC LIMIT ?", [*a, limit])
    for r in rows:
        r["meta"] = json.loads(r["meta"] or "{}")
    return jsonify(rows)


@bp.get("/api/graph")
def graph():
    app = _app()
    w, a = _where(app)
    nodes = _q(f"SELECT app, id, kind, hits, last_seen FROM nodes WHERE 1=1{w}", a)
    edges = _q(f"SELECT app, src, dst, kind, hits, last_seen FROM edges WHERE 1=1{w}", a)
    return jsonify({"nodes": nodes, "edges": edges})
