import json
import os
import tempfile
import time
import unittest
from unittest import mock

import db
import jobs
from app import create_app
from bus import bus
from collectors import reroute_usage


class BackendTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        os.environ["MYCELIUM_DB"] = os.path.join(self.tmp.name, "t.sqlite3")
        os.environ["MYCELIUM_SCHEDULER"] = "0"
        app = create_app()
        app.testing = True
        self.client = app.test_client()
        self.key = db.add_app("reroute", "Reroute", admin_url="http://x")

    def tearDown(self):
        self.tmp.cleanup()

    def post(self, events, key=None):
        return self.client.post("/ingest/events", json={"events": events},
                                headers={"Authorization": f"Bearer {key or self.key}"})

    def rows(self, sql):
        with db.connect() as conn:
            return conn.execute(sql).fetchall()

    def test_key_is_stored_hashed_and_required(self):
        self.assertNotIn(self.key, json.dumps([tuple(r) for r in self.rows("SELECT * FROM apps")]))
        self.assertEqual(self.client.post("/ingest/events", json=[]).status_code, 401)
        self.assertEqual(self.post([], key="myc_wrong").status_code, 401)

    def test_ingest_stores_events_nodes_and_edges_and_ignores_payload_app(self):
        ev = {"kind": "write", "app": "other", "node": "file:rides.py", "target": "store:data/rides.sqlite3",
              "status": "ok", "duration_ms": 3, "meta": {"op": "report"}}
        r = self.post([ev, {"kind": "bogus"}, {"kind": "read", "ts": time.time() + 3600}])
        self.assertEqual((r.status_code, r.get_json()), (202, {"accepted": 1, "rejected": 2}))
        self.assertEqual(self.rows("SELECT app FROM events")[0]["app"], "reroute")
        self.assertEqual(len(self.rows("SELECT * FROM nodes")), 2)
        self.assertEqual(self.rows("SELECT src,dst FROM edges")[0]["dst"], "store:data/rides.sqlite3")

    def test_oversized_meta_is_dropped_and_big_batch_refused(self):
        self.post([{"kind": "log", "meta": {"x": "y" * 3000}}])
        self.assertEqual(self.rows("SELECT meta FROM events")[0]["meta"], "{}")
        self.assertEqual(self.post([{"kind": "log"}] * 501).status_code, 400)

    def test_bus_receives_published_events_for_its_app_only(self):
        mine, theirs = bus.subscribe("reroute"), bus.subscribe("other")
        self.post([{"kind": "read", "node": "file:a.py"}])
        self.assertEqual(mine[1].get_nowait()["node"], "file:a.py")
        self.assertTrue(theirs[1].empty())
        bus.unsubscribe(mine), bus.unsubscribe(theirs)

    def test_rollup_counts_and_prune(self):
        now = time.time()
        self.post([{"kind": "request", "status": "ok", "duration_ms": d} for d in (10, 20, 30)]
                  + [{"kind": "request", "status": "error", "duration_ms": 40}, {"kind": "external", "usd": 0.5}])
        with db.connect() as conn:
            conn.execute("INSERT INTO events (ts,recv,app,source,kind) VALUES (?,?,?,?,?)",
                         (now - 40 * 86400, now, "reroute", "app", "log"))
            jobs.rollup_and_prune(conn, now)
        day = self.rows("SELECT * FROM rollups WHERE period='d'")[0]
        self.assertEqual((day["requests"], day["errors"], day["externals"], day["usd"]), (4, 1, 1, 0.5))
        self.assertEqual(self.rows("SELECT count(*) n FROM events WHERE kind='log'")[0]["n"], 0)

    def test_usage_collector_upserts_and_needs_token(self):
        body = json.dumps({"days": {"2026-10-30": {"items": [{"api": "routes", "sku": "a", "count": 3, "usd": 0.02}]}}}).encode()
        with db.connect() as conn:
            app = conn.execute("SELECT * FROM apps").fetchone()
            with mock.patch("collectors.fetch", return_value=(200, body, 1)) as f:
                reroute_usage.run(conn, app)  # no token: nothing fetched
                f.assert_not_called()
                with mock.patch.dict(os.environ, {"MYCELIUM_ADMIN_TOKEN_REROUTE": "t"}):
                    reroute_usage.run(conn, app)
                    reroute_usage.run(conn, app)
        self.assertEqual([tuple(r) for r in self.rows("SELECT count,usd FROM costs")], [(3, 0.02)])


if __name__ == "__main__":
    unittest.main()
