"""Admin proxy: the owner manages an app's access through its own admin API, with the admin token added here on the server.

The token comes from MYCELIUM_ADMIN_TOKEN_<SLUG> and never reaches the browser or SQLite. Every change is written to `audit`
with ids and outcome only. Moderation content (nicknames, notes) passes through to the owner's browser and is never stored.
The app side is the admin protocol Reroute implements: /admin/api/settings, /admin/api/sessions/revoke, /admin/moderation(/action).
"""
import json
import os
import urllib.error
import urllib.request

from flask import Blueprint, jsonify, request

import db
from auth import audit, owner

bp = Blueprint("admin", __name__)
MODERATION_ACTIONS = {"approve", "remove", "ban", "unban"}


def admin_token(slug):
    return os.getenv("MYCELIUM_ADMIN_TOKEN_" + slug.upper().replace("-", "_"), "").strip()


def _call(app_row, method, path, body=None):
    """(status, JSON) from the app's admin API. Network failures give status 502."""
    req = urllib.request.Request(app_row["admin_url"].rstrip("/") + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {admin_token(app_row['slug'])}", "Accept": "application/json",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read(2_000_000) or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read(100_000) or b"{}")
        except ValueError:
            return e.code, {}
    except (OSError, ValueError):
        return 502, {"error": "The app's admin API could not be reached."}


def _app(slug):
    with db.connect() as conn:
        row = conn.execute("SELECT slug, admin_url FROM apps WHERE slug=?", (slug,)).fetchone()
    if not row or not row["admin_url"] or not admin_token(slug):
        return None
    return row


def _relay(slug, method, path, body=None, action=None, detail=None):
    row = _app(slug)
    if not row:
        return jsonify(error="This app has no admin API set up in Mycelium."), 404
    status, data = _call(row, method, path, body)
    if action:
        with db.connect() as conn:
            audit(conn, owner()[0], slug, action, {**(detail or {}), "status": status, **({"error": data.get("error")} if status >= 400 else {})})
    if status == 404:  # Reroute answers 404 for a missing or wrong token, so the route can't be discovered
        data = {"error": "The app answered 404: its admin token may be wrong or its admin API switched off."}
    resp = jsonify(data)
    resp.status_code = status if status < 500 else 502
    resp.headers["Cache-Control"] = "no-store"
    return resp


def _body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else None


@bp.get("/api/admin/<slug>/settings")
def settings(slug):
    return _relay(slug, "GET", "/admin/api/settings")


@bp.post("/api/admin/<slug>/settings")
def settings_change(slug):
    body = _body()
    if body is None:
        return jsonify(error="Send a JSON object."), 400
    return _relay(slug, "POST", "/admin/api/settings", body, "settings.change", {"changes": body})


@bp.get("/api/admin/<slug>/moderation")
def moderation(slug):
    return _relay(slug, "GET", "/admin/moderation?format=json")


@bp.post("/api/admin/<slug>/moderation")
def moderation_action(slug):
    body = _body()
    if not body or body.get("action") not in MODERATION_ACTIONS:
        return jsonify(error=f"action must be one of {', '.join(sorted(MODERATION_ACTIONS))}."), 400
    clean = {k: str(body[k])[:100] for k in ("action", "id", "poster") if body.get(k)}
    return _relay(slug, "POST", "/admin/moderation/action", clean, "moderation." + clean["action"],
                  {k: clean[k] for k in ("id", "poster") if k in clean})


@bp.post("/api/admin/<slug>/sessions/revoke")
def revoke(slug):
    body = _body() or {}
    user_id = body.get("user_id") or None
    return _relay(slug, "POST", "/admin/api/sessions/revoke", {"user_id": user_id} if user_id else {},
                  "sessions.revoke", {"user_id": user_id or "everyone"})


@bp.get("/api/audit")
def audit_log():
    slug = request.args.get("app", "")
    where, args = ("WHERE app=? OR app IS NULL", [slug]) if slug and slug != "all" else ("", [])
    with db.connect() as conn:
        rows = [dict(r) for r in conn.execute(f"SELECT id, ts, actor, app, action, detail FROM audit {where} ORDER BY id DESC LIMIT 200", args)]
    for r in rows:
        r["detail"] = json.loads(r["detail"] or "{}")
    return jsonify(rows)
