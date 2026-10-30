"""Collectors: modules with NAME, INTERVAL (seconds) and run(conn, app). Add one to COLLECTORS to register it."""
import json
import logging
import threading
import time
import urllib.error
import urllib.request

import db
from collectors import probes, reroute_usage
from jobs import rollup_and_prune

log = logging.getLogger("mycelium")
COLLECTORS = [probes.Health, probes.Ready, reroute_usage]
JOB_INTERVAL = 3600


def fetch(url, token=None, timeout=10):
    """GET url; returns (status code, body bytes, ms). Network errors give code 0."""
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"} if token else {})
    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(1_000_000), (time.monotonic() - start) * 1000
    except urllib.error.HTTPError as e:
        return e.code, b"", (time.monotonic() - start) * 1000
    except (OSError, ValueError):
        return 0, b"", (time.monotonic() - start) * 1000


def run_once(collector, now=None):
    """Run one collector for every app. A failing app never stops the others."""
    with db.connect() as conn:
        for app in conn.execute("SELECT * FROM apps").fetchall():
            try:
                collector.run(conn, app)
            except Exception:  # keep the loop alive; the next tick retries
                log.exception("collector %s failed for %s", collector.NAME, app["slug"])


def start_scheduler():
    def loop():
        due = {c.NAME: 0 for c in COLLECTORS}
        next_job = 0
        while True:
            now = time.time()
            for c in COLLECTORS:
                if now >= due[c.NAME]:
                    due[c.NAME] = now + c.INTERVAL
                    run_once(c)
            if now >= next_job:
                next_job = now + JOB_INTERVAL
                try:
                    with db.connect() as conn:
                        rollup_and_prune(conn)
                except Exception:
                    log.exception("rollup failed")
            time.sleep(5)

    threading.Thread(target=loop, daemon=True, name="mycelium-scheduler").start()
