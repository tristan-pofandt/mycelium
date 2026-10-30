"""Mycelium emitter: copy this one file into a Flask app. Standard library only. See docs/architecture.md in the Mycelium repo.

Set MYCELIUM_URL (e.g. http://127.0.0.1:8100) and MYCELIUM_KEY (the app's ingest key). Without both, everything here is a no-op.
Events carry metadata only: route rules, store names, sizes, timings. Never bodies, query strings, tokens or personal data.

    from mycelium_emitter import init_telemetry, emit
    init_telemetry(app)                                   # one request event per HTTP request
    emit("write", "file:rides.py", "store:data/rides.sqlite3", bytes=412)
"""
import collections
import contextlib
import json
import os
import threading
import time
import urllib.request

FLUSH_S = 2
BATCH = 200
MAX_QUEUE = 10_000  # oldest events are dropped beyond this, so a dead Mycelium never grows memory


class Emitter:
    def __init__(self, url, key, post=None):
        self.url = url.rstrip("/") + "/ingest/events"
        self.key = key
        self.queue = collections.deque(maxlen=MAX_QUEUE)
        self.wake = threading.Event()
        self.post = post or self._post
        threading.Thread(target=self._loop, daemon=True, name="mycelium-emitter").start()

    def emit(self, event):
        self.queue.append(event)
        if len(self.queue) >= BATCH:
            self.wake.set()

    def _post(self, batch):
        req = urllib.request.Request(self.url, data=json.dumps(batch).encode(), method="POST",
                                     headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=5).close()

    def flush(self):
        while self.queue:
            batch = [self.queue.popleft() for _ in range(min(BATCH, len(self.queue)))]
            try:
                self.post(batch)
            except Exception:  # Mycelium down or slow: drop this batch, never affect the app
                return

    def _loop(self):
        while True:
            self.wake.wait(FLUSH_S)
            self.wake.clear()
            self.flush()


_emitter = None


def configure(url=None, key=None, post=None):
    """Start the emitter from arguments or the environment. Returns it, or None when not configured."""
    global _emitter
    url, key = url or os.getenv("MYCELIUM_URL", "").strip(), key or os.getenv("MYCELIUM_KEY", "").strip()
    _emitter = Emitter(url, key, post) if url and key else None
    return _emitter


def emit(kind, node=None, target=None, status="ok", duration_ms=None, bytes=None, usd=0, actor="actor:app", **meta):
    if _emitter is None:
        return
    _emitter.emit({"ts": time.time(), "source": "app", "kind": kind, "actor": actor, "node": node, "target": target,
                   "status": status, "duration_ms": duration_ms, "bytes": bytes, "usd": usd, "meta": meta})


@contextlib.contextmanager
def timed(kind, node, target, **meta):
    """Emit one event around a block (e.g. an external call), with its duration and status ok or error."""
    t0, status = time.perf_counter(), "ok"
    try:
        yield
    except BaseException:
        status = "error"
        raise
    finally:
        emit(kind, node, target, status=status, duration_ms=round((time.perf_counter() - t0) * 1000, 2), **meta)


_SQL_KINDS = {"SELECT": "read", "INSERT": "write", "UPDATE": "write", "DELETE": "write", "REPLACE": "write"}


def watch_sqlite(conn, node, store):
    """Emit a read or write per SQL statement on this connection. Only the first keyword is looked at; SQL text is never sent."""
    if _emitter is not None:
        conn.set_trace_callback(lambda sql: (kind := _SQL_KINDS.get(sql.lstrip().split(" ", 1)[0].upper())) and emit(kind, node, store))
    return conn


def init_telemetry(app):
    """Emit one request event per HTTP request: route rule (not the raw URL), method, status code, duration."""
    if configure() is None:
        return
    from flask import g, request

    @app.before_request
    def _mycelium_start():
        g._mycelium_t0 = time.perf_counter()

    @app.after_request
    def _mycelium_end(resp):
        t0 = getattr(g, "_mycelium_t0", None)
        rule = request.url_rule.rule if request.url_rule else "unmatched"
        emit("request", node="endpoint:" + rule, status="error" if resp.status_code >= 500 else "ok",
             duration_ms=round((time.perf_counter() - t0) * 1000, 2) if t0 else None,
             bytes=resp.calculate_content_length(), method=request.method, code=resp.status_code)
        return resp
