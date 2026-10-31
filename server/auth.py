"""Owner sign-in and CSRF guard. The site is private: every /api/ route needs the owner. Ingest (/ingest, /v1) uses app keys instead.

Ways in, checked in this order:
- Tailscale: with MYCELIUM_TRUST_TAILSCALE=1, the Tailscale-User-Login header must be one of MYCELIUM_OWNER (comma separated).
  Only safe when the server listens on 127.0.0.1 behind `tailscale serve`, which sets that header and strips any the client sent.
- Password: MYCELIUM_PASSWORD (server environment only) via POST /api/login gives a signed session cookie (HttpOnly, SameSite=Strict, 12 h).
- Neither configured: requests from this computer (loopback) only, for local development.
State-changing /api/ requests must also carry an Origin header matching this host.
"""
import hmac
import ipaddress
import json
import os
import secrets
import threading
import time
from datetime import timedelta
from urllib.parse import urlsplit

from flask import Blueprint, jsonify, request, session

import db

bp = Blueprint("auth", __name__)
OPEN = {"/api/login", "/api/me"}
FAILS_ALLOWED, FAIL_WINDOW = 10, 900

_fails = {}  # address -> [window start, count]; in memory, never stored
_fails_lock = threading.Lock()


def _env(name):
    return os.getenv(name, "").strip()


def _loopback():
    try:
        return ipaddress.ip_address(request.remote_addr or "").is_loopback
    except ValueError:
        return False


def owner():
    """(identity, method) for the owner, or None."""
    owners = {o.strip().lower() for o in _env("MYCELIUM_OWNER").split(",") if o.strip()}
    if _env("MYCELIUM_TRUST_TAILSCALE") == "1":
        login = request.headers.get("Tailscale-User-Login", "").strip().lower()
        if login and login in owners:
            return login, "tailscale"
    if session.get("owner"):
        return session["owner"], "password"
    if not owners and not _env("MYCELIUM_PASSWORD") and _loopback():
        return "local", "local"
    return None


def _same_origin():
    origin = request.headers.get("Origin")
    return bool(origin) and urlsplit(origin).netloc.lower() == request.host.lower()


def audit(conn, actor, app, action, detail):
    """Record an owner action: who, what, ids and outcome only, never content."""
    conn.execute("INSERT INTO audit (ts, actor, app, action, detail) VALUES (?,?,?,?,?)",
                 (time.time(), actor, app, action, json.dumps(detail, separators=(",", ":"))[:2000]))
    conn.commit()


def init_auth(app):
    app.secret_key = _env("MYCELIUM_SECRET_KEY") or secrets.token_hex(32)  # without it, sign-ins end when the server restarts
    app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Strict", SESSION_COOKIE_NAME="mycelium_session",
                      SESSION_COOKIE_SECURE=_env("MYCELIUM_SECURE_COOKIE") == "1", PERMANENT_SESSION_LIFETIME=timedelta(hours=12))
    app.register_blueprint(bp)

    @app.before_request
    def guard():
        if not request.path.startswith("/api/"):
            return None
        if request.method not in ("GET", "HEAD", "OPTIONS") and not _same_origin():
            return jsonify(error="Cross-site request refused."), 403
        if request.path not in OPEN and owner() is None:
            return jsonify(error="Sign in first."), 401
        return None


@bp.get("/api/me")
def me():
    found = owner()
    return jsonify(owner=found[0] if found else None, method=found[1] if found else None,
                   password=bool(_env("MYCELIUM_PASSWORD")))


@bp.post("/api/login")
def login():
    address = request.remote_addr or ""
    now = time.time()
    with _fails_lock:
        w = _fails.setdefault(address, [now, 0])
        if now - w[0] >= FAIL_WINDOW:
            w[0], w[1] = now, 0
        if w[1] >= FAILS_ALLOWED:
            return jsonify(error="Too many attempts. Try again in 15 minutes."), 429
    password = _env("MYCELIUM_PASSWORD")
    body = request.get_json(silent=True)
    given = body.get("password", "") if isinstance(body, dict) else ""
    ok = bool(password) and isinstance(given, str) and hmac.compare_digest(given.encode(), password.encode())
    with db.connect() as conn:
        audit(conn, "owner" if ok else "unknown", None, "login.ok" if ok else "login.failed", {})
    if not ok:
        with _fails_lock:
            _fails[address][1] += 1
        return jsonify(error="That password wasn't accepted."), 401
    session.clear()
    session.permanent = True
    session["owner"] = "owner"
    return jsonify(owner="owner", method="password")


@bp.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)
