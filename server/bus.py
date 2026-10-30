"""In-memory live bus behind GET /api/stream. One process only (gunicorn runs 1 worker, see infra/Dockerfile)."""
import queue
import threading
import time

MAX_PER_SEC = 50


class Bus:
    def __init__(self):
        self._subs = []  # (app or None, queue, [window_start, sent, dropped])
        self._lock = threading.Lock()

    def subscribe(self, app=None):
        q = queue.Queue(maxsize=500)
        sub = (app, q, [time.time(), 0, 0])
        with self._lock:
            self._subs.append(sub)
        return sub

    def unsubscribe(self, sub):
        with self._lock:
            if sub in self._subs:
                self._subs.remove(sub)

    def publish(self, event):
        with self._lock:
            subs = list(self._subs)
        now = time.time()
        for app, q, st in subs:
            if app and app != event["app"]:
                continue
            if now - st[0] >= 1:
                st[0], st[1] = now, 0
            if st[1] >= MAX_PER_SEC or q.full():
                st[2] += 1  # counted, not sent
                continue
            st[1] += 1
            q.put_nowait(event)


bus = Bus()
