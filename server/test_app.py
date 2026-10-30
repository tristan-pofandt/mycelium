import os
import tempfile
import unittest

from app import create_app


class AppTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        os.environ["MYCELIUM_DB"] = os.path.join(self.tmp.name, "t.sqlite3")
        os.environ["MYCELIUM_SCHEDULER"] = "0"
        app = create_app()
        app.testing = True
        self.client = app.test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def test_healthz(self):
        resp = self.client.get("/healthz")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()["status"], "ok")
        self.assertEqual(resp.headers["X-Content-Type-Options"], "nosniff")

    def test_unknown_route_falls_back_to_web(self):
        self.assertIn(self.client.get("/apps/reroute/map").status_code, (200, 503))


if __name__ == "__main__":
    unittest.main()
