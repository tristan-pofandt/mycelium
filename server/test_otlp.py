import json
import os
import tempfile
import unittest

import db
from app import create_app


def kv(**a):
    return [{"key": k, "value": {"intValue": str(v)} if isinstance(v, int) else {"doubleValue": v} if isinstance(v, float)
             else {"stringValue": v}} for k, v in a.items()]


RESOURCE = {"attributes": kv(**{"service.name": "claude-code", "user.email": "me@example.com", "user.id": "u1"})}
LOGS = {"resourceLogs": [{"resource": RESOURCE, "scopeLogs": [{"logRecords": [
    {"timeUnixNano": "1793401864000000000", "body": {"stringValue": "claude_code.api_request"},
     "attributes": kv(**{"event.name": "api_request", "model": "claude-opus-5-5", "cost_usd": 0.0123, "duration_ms": 900,
                        "input_tokens": 1200, "output_tokens": 300, "session.id": "s1", "organization.id": "o1"})},
    {"attributes": kv(**{"event.name": "api_error", "model": "claude-opus-5-5", "status_code": 529, "error": "Overloaded for me@example.com"})},
    {"attributes": kv(**{"event.name": "user_prompt", "prompt": "my secret plan"})},
]}]}]}
METRICS = {"resourceMetrics": [{"resource": RESOURCE, "scopeMetrics": [{"metrics": [
    {"name": "claude_code.cost.usage", "sum": {"dataPoints": [{"asDouble": 0.0123}]}},
    {"name": "claude_code.lines_of_code.count", "sum": {"dataPoints": [{"asInt": "42", "attributes": kv(type="added")}]}},
]}]}]}


class OtlpTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        os.environ["MYCELIUM_DB"] = os.path.join(self.tmp.name, "t.sqlite3")
        os.environ["MYCELIUM_SCHEDULER"] = "0"
        self.client = create_app().test_client()
        self.auth = {"Authorization": "Bearer " + db.add_app("reroute", "Reroute")}

    def tearDown(self):
        self.tmp.cleanup()

    def events(self):
        with db.connect() as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM events ORDER BY id")]

    def test_logs_keep_cost_and_tokens_and_drop_personal_data(self):
        self.assertEqual(self.client.post("/v1/logs", json=LOGS, headers=self.auth).status_code, 200)
        ok, err = self.events()
        self.assertEqual((ok["source"], ok["kind"], ok["status"], ok["usd"], ok["duration_ms"]), ("claude", "external", "ok", 0.0123, 900))
        self.assertEqual(json.loads(ok["meta"])["output_tokens"], 300)
        self.assertEqual((err["status"], json.loads(err["meta"])["status_code"]), ("error", 529))
        stored = json.dumps(self.events())
        for secret in ("me@example.com", "u1", "o1", "my secret plan", "Overloaded"):
            self.assertNotIn(secret, stored)

    def test_metrics_skip_cost_and_keep_allowlisted(self):
        self.assertEqual(self.client.post("/v1/metrics", json=METRICS, headers=self.auth).status_code, 200)
        [ev] = self.events()
        self.assertEqual(json.loads(ev["meta"]), {"metric": "claude_code.lines_of_code.count", "value": 42, "type": "added"})

    def test_auth_and_protobuf_refused(self):
        self.assertEqual(self.client.post("/v1/logs", json=LOGS).status_code, 401)
        self.assertEqual(self.client.post("/v1/logs", data=b"\x0a", headers={**self.auth, "Content-Type": "application/x-protobuf"}).status_code, 415)


if __name__ == "__main__":
    unittest.main()
