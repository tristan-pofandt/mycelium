"""Probes: status code and latency of each app's health URL (60 s) and readiness URL (5 min)."""
import time


def _probe(conn, app, column, name):
    url = app[column]
    if not url:
        return
    from collectors import fetch  # late import: the package imports this module
    code, _, ms = fetch(url)
    ok = 1 if 200 <= code < 300 else 0
    now = time.time()
    conn.execute("INSERT INTO probes (app,ts,check_name,code,ms,ok) VALUES (?,?,?,?,?,?)",
                 (app["slug"], now, name, code, ms, ok))
    conn.commit()


class Health:
    NAME, INTERVAL = "probe-health", 60

    @staticmethod
    def run(conn, app):
        _probe(conn, app, "health_url", "health")


class Ready:
    NAME, INTERVAL = "probe-ready", 300

    @staticmethod
    def run(conn, app):
        _probe(conn, app, "ready_url", "ready")
