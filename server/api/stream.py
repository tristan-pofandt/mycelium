"""GET /api/stream?app=<slug>: server-sent events from the live bus."""
import json
import queue

from flask import Blueprint, Response, request, stream_with_context

from bus import bus

bp = Blueprint("stream", __name__)


@bp.get("/api/stream")
def stream():
    sub = bus.subscribe(request.args.get("app") or None)
    _, q, st = sub

    def gen():
        try:
            yield "retry: 3000\n\n"
            while True:
                try:
                    ev = q.get(timeout=15)
                except queue.Empty:
                    yield ": keepalive\n\n"
                    continue
                if st[2]:  # tell the client how many events were counted but not sent
                    yield f"event: dropped\ndata: {st[2]}\n\n"
                    st[2] = 0
                yield f"data: {json.dumps(ev, separators=(',', ':'))}\n\n"
        finally:
            bus.unsubscribe(sub)

    resp = Response(stream_with_context(gen()), mimetype="text/event-stream")
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["X-Accel-Buffering"] = "no"
    return resp
