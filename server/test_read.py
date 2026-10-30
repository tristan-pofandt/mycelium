import json
import os
import tempfile
import time
import unittest

import db
from app import create_app


class ReadApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        os.environ["MYCELIUM_DB"] = os.path.join(self.tmp.name, "t.sqlite3")
        os.environ["MYCELIUM_SCHEDULER"] = "0"
        self.client = create_app().test_client()
        self.key = db.add_app("reroute", "Reroute", health_url="http://x/healthz", admin_url="http://x")
        db.add_app("other", "Other")
        events = [{"kind": "request", "node": "endpoint:/api/rides", "status": "ok", "duration_ms": d} for d in (10, 20, 30)]
        events += [{"kind": "request", "node": "endpoint:/api/rides", "status": "error", "duration_ms": 50},
                   {"kind": "external", "node": "file:google_api.py", "target": "external:routes.googleapis.com", "duration_ms": 200},
                   {"kind": "cost", "node": "file:google_api.py", "target": "external:Routes API", "usd": 0.01},
                   {"kind": "write", "node": "file:rides.py", "target": "store:data/rides.sqlite3"}]
        self.client.post("/ingest/events", json=events, headers={"Authorization": f"Bearer {self.key}"})
        now = time.time()
        with db.connect() as conn:
            conn.executemany("INSERT INTO probes (app, ts, check_name, code, ms, ok) VALUES ('reroute', ?, 'health', ?, 40, ?)",
                             [(now - 120, 200, 1), (now - 60, 503, 0)])
            # the collector saw more Google spend today than the emitter did: the larger figure wins, not the sum
            day = time.strftime("%Y-%m-%d", time.gmtime(now))
            conn.execute("INSERT INTO costs VALUES ('reroute', ?, 'Routes API', 'Compute Routes Essentials', 4, 0.02)", (day,))

    def tearDown(self):
        self.tmp.cleanup()

    def get(self, url):
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200, url)
        return r.get_json()

    def test_apps_never_expose_keys(self):
        apps = self.get("/api/apps")
        self.assertEqual([a["slug"] for a in apps], ["other", "reroute"])
        reroute = apps[1]
        self.assertEqual((reroute["status"], set(reroute["capabilities"])), ("down", {"events", "map", "probes", "admin"}))
        self.assertNotIn("key_hash", json.dumps(apps))
        self.assertNotIn(db.hash_key(self.key), json.dumps(apps))

    def test_summary_counts_and_cost_not_double_counted(self):
        s = self.get("/api/summary?app=reroute")
        self.assertEqual((s["requests"], s["errors"], s["writes"], s["externals"], s["p95_ms"]), (4, 1, 1, 1, 50))
        self.assertEqual((s["cost_today"], s["uptime_24h"]), (0.02, 50.0))
        self.assertEqual(self.get("/api/summary?app=other")["requests"], 0)
        self.assertEqual(self.get("/api/summary")["requests"], 4)

    def test_usage_costs_uptime_events_graph(self):
        u = self.get("/api/usage?app=reroute")
        self.assertEqual((u["routes"][0]["name"], u["routes"][0]["calls"], u["externals"][0]["name"]), ("/api/rides", 4, "routes.googleapis.com"))
        self.assertEqual(sum(h["requests"] for h in u["hours"]), 4)
        self.assertEqual(self.get("/api/costs?app=reroute")["app_skus"][0]["count"], 4)
        self.assertEqual(self.get("/api/uptime?app=reroute")["incidents"][0]["code"], 503)
        ev = self.get("/api/events?app=reroute&kind=cost")
        self.assertEqual((len(ev), ev[0]["usd"]), (1, 0.01))
        self.assertEqual(len(self.get("/api/events?limit=2")), 2)
        self.assertEqual(self.get("/api/events?limit=nope")[0]["kind"], "write")
        g = self.get("/api/graph?app=reroute")
        self.assertIn({"src": "file:rides.py", "dst": "store:data/rides.sqlite3"}, [{"src": e["src"], "dst": e["dst"]} for e in g["edges"]])


if __name__ == "__main__":
    unittest.main()
