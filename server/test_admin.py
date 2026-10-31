import json
import os
import tempfile
import unittest
from unittest import mock

import db
from api import admin
from app import create_app

SAME = {"Origin": "http://localhost"}
REMOTE = {"REMOTE_ADDR": "100.64.0.5"}  # a tailnet address, not this computer


class AuthTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        env = mock.patch.dict(os.environ, {"MYCELIUM_DB": os.path.join(self.tmp.name, "t.sqlite3"), "MYCELIUM_SCHEDULER": "0",
                                           "MYCELIUM_OWNER": "", "MYCELIUM_PASSWORD": "", "MYCELIUM_TRUST_TAILSCALE": ""})
        env.start()
        self.addCleanup(env.stop)
        self.client = create_app().test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def test_unconfigured_allows_only_this_computer(self):
        self.assertEqual(self.client.get("/api/apps").status_code, 200)
        self.assertEqual(self.client.get("/api/apps", environ_overrides=REMOTE).status_code, 401)

    def test_password_login_and_lockout(self):
        os.environ["MYCELIUM_PASSWORD"] = "correct horse"
        self.assertEqual(self.client.get("/api/apps").status_code, 401)  # once a password is set, loopback alone is not enough
        self.assertEqual(self.client.post("/api/login", json={"password": "correct horse"}).status_code, 403)  # no Origin
        self.assertEqual(self.client.post("/api/login", json={"password": "nope"}, headers=SAME).status_code, 401)
        self.assertEqual(self.client.post("/api/login", json={"password": "correct horse"}, headers=SAME).status_code, 200)
        self.assertEqual(self.client.get("/api/apps").status_code, 200)
        self.client.post("/api/logout", headers=SAME)
        self.assertEqual(self.client.get("/api/apps").status_code, 401)
        for _ in range(10):
            self.client.post("/api/login", json={"password": "nope"}, headers=SAME, environ_overrides=REMOTE)
        self.assertEqual(self.client.post("/api/login", json={"password": "correct horse"}, headers=SAME, environ_overrides=REMOTE).status_code, 429)
        with db.connect() as conn:
            actions = [r["action"] for r in conn.execute("SELECT action FROM audit")]
        self.assertIn("login.ok", actions)
        self.assertIn("login.failed", actions)

    def test_tailscale_identity_only_when_trusted_and_listed(self):
        os.environ.update(MYCELIUM_OWNER="me@example.com")
        who = {"Tailscale-User-Login": "me@example.com"}
        self.assertEqual(self.client.get("/api/apps", headers=who, environ_overrides=REMOTE).status_code, 401)  # header not trusted
        os.environ["MYCELIUM_TRUST_TAILSCALE"] = "1"
        self.assertEqual(self.client.get("/api/apps", headers=who, environ_overrides=REMOTE).status_code, 200)
        self.assertEqual(self.client.get("/api/apps", headers={"Tailscale-User-Login": "other@example.com"}, environ_overrides=REMOTE).status_code, 401)

    def test_ingest_still_uses_keys_not_login(self):
        os.environ["MYCELIUM_PASSWORD"] = "x"
        key = db.add_app("reroute", "Reroute")
        r = self.client.post("/ingest/events", json=[{"kind": "log"}], headers={"Authorization": f"Bearer {key}"})
        self.assertEqual(r.status_code, 202)


class AdminProxyTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        env = mock.patch.dict(os.environ, {"MYCELIUM_DB": os.path.join(self.tmp.name, "t.sqlite3"), "MYCELIUM_SCHEDULER": "0",
                                           "MYCELIUM_OWNER": "", "MYCELIUM_PASSWORD": "", "MYCELIUM_ADMIN_TOKEN_REROUTE": "adm1n"})
        env.start()
        self.addCleanup(env.stop)
        self.client = create_app().test_client()
        db.add_app("reroute", "Reroute", admin_url="http://reroute.test")
        db.add_app("plain", "No admin")
        self.calls = []

        def fake(row, method, path, body=None):
            self.calls.append((method, path, body))
            return (200, {"revoked": 2}) if "revoke" in path else (200, {"ok": True})
        patch = mock.patch.object(admin, "_call", side_effect=fake)
        patch.start()
        self.addCleanup(patch.stop)

    def tearDown(self):
        self.tmp.cleanup()

    def audit(self):
        return self.client.get("/api/audit?app=reroute").get_json()

    def test_actions_are_relayed_and_audited_without_content(self):
        self.assertEqual(self.client.post("/api/admin/reroute/settings", json={"rides": False}, headers=SAME).status_code, 200)
        self.assertEqual(self.client.post("/api/admin/reroute/moderation", json={"action": "ban", "id": "r1", "note": "private words"}, headers=SAME).status_code, 200)
        self.assertEqual(self.client.post("/api/admin/reroute/sessions/revoke", json={}, headers=SAME).get_json(), {"revoked": 2})
        self.assertEqual(self.calls[1], ("POST", "/admin/moderation/action", {"action": "ban", "id": "r1"}))
        log = self.audit()
        self.assertEqual([r["action"] for r in log], ["sessions.revoke", "moderation.ban", "settings.change", "app.add"])
        self.assertEqual(log[0]["detail"], {"user_id": "everyone", "status": 200})
        self.assertNotIn("private words", json.dumps(log))
        self.assertNotIn("adm1n", json.dumps(log))

    def test_refuses_cross_site_bad_actions_and_apps_without_admin(self):
        self.assertEqual(self.client.post("/api/admin/reroute/sessions/revoke", json={}).status_code, 403)  # no Origin
        self.assertEqual(self.client.post("/api/admin/reroute/sessions/revoke", json={}, headers={"Origin": "http://evil.test"}).status_code, 403)
        self.assertEqual(self.client.post("/api/admin/reroute/moderation", json={"action": "drop"}, headers=SAME).status_code, 400)
        self.assertEqual(self.client.get("/api/admin/plain/settings").status_code, 404)
        self.assertEqual(self.client.get("/api/admin/missing/settings").status_code, 404)
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
