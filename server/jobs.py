"""Hourly job: roll recent events up into hour and day rows, then prune raw data."""
import time

EVENT_KEEP_S = 30 * 86400
PROBE_KEEP_S = 90 * 86400
PERIODS = {"h": 3600, "d": 86400}


def _pct(sorted_vals, p):
    return sorted_vals[min(len(sorted_vals) - 1, int(p * len(sorted_vals)))] if sorted_vals else None


def rollup(conn, now=None, buckets=2):
    """Recompute the current and previous bucket per period from raw events (idempotent upsert; UTC buckets)."""
    now = now or time.time()
    for period, size in PERIODS.items():
        first = (int(now // size) - (buckets - 1)) * size
        rows = conn.execute("SELECT app,kind,status,duration_ms,usd,CAST(ts/? AS INTEGER)*? AS start FROM events WHERE ts>=?",
                            (size, size, first)).fetchall()
        groups = {}
        for r in rows:
            groups.setdefault((r["app"], r["start"]), []).append(r)
        for (app, start), evs in groups.items():
            reqs = [e for e in evs if e["kind"] == "request"]
            lat = sorted(e["duration_ms"] for e in reqs if e["duration_ms"] is not None)
            conn.execute("INSERT OR REPLACE INTO rollups VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                         (app, period, start, len(reqs), sum(1 for e in evs if e["status"] == "error"),
                          _pct(lat, 0.5), _pct(lat, 0.95), sum(e["kind"] == "read" for e in evs),
                          sum(e["kind"] == "write" for e in evs), sum(e["kind"] == "external" for e in evs),
                          sum(e["usd"] or 0 for e in evs)))
    conn.commit()


def rollup_and_prune(conn, now=None):
    now = now or time.time()
    rollup(conn, now)
    conn.execute("DELETE FROM events WHERE ts<?", (now - EVENT_KEEP_S,))
    conn.execute("DELETE FROM probes WHERE ts<?", (now - PROBE_KEEP_S,))
    conn.commit()
