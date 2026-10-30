"""Mycelium server: serves the built web app and the API. See docs/architecture.md.

Run locally: python app.py (http://127.0.0.1:8100). The web dev server proxies /api and /healthz here.
"""
import os
import time
from pathlib import Path

from flask import Flask, jsonify, send_from_directory

import collectors
import db
from api import ingest, otlp, stream

HERE = Path(__file__).resolve().parent
DIST = Path(os.getenv("MYCELIUM_WEB_DIST", HERE.parent / "web" / "dist"))
STARTED = time.time()


def create_app():
    app = Flask(__name__, static_folder=None)
    app.config["MAX_CONTENT_LENGTH"] = 1_000_000
    db.init()
    app.register_blueprint(ingest.bp)
    app.register_blueprint(stream.bp)
    app.register_blueprint(otlp.bp)
    if os.getenv("MYCELIUM_SCHEDULER", "1") == "1" and not app.testing:
        collectors.start_scheduler()

    @app.get("/healthz")
    def healthz():
        return jsonify(status="ok", version=os.getenv("GIT_SHA", "dev"), uptime_s=int(time.time() - STARTED))

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def web(path):
        # Client-side routes fall back to index.html; built assets are served as files.
        if path and (DIST / path).is_file():
            return send_from_directory(DIST, path)
        if (DIST / "index.html").is_file():
            return send_from_directory(DIST, "index.html")
        return "Web app not built: run npm run build in web/.", 503

    @app.after_request
    def headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        return resp

    return app


if __name__ == "__main__":
    create_app().run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8100")))
