import unittest

from app import create_app


class AppTest(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()

    def test_healthz(self):
        resp = self.client.get("/healthz")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()["status"], "ok")
        self.assertEqual(resp.headers["X-Content-Type-Options"], "nosniff")

    def test_unknown_route_falls_back_to_web(self):
        self.assertIn(self.client.get("/apps/reroute/map").status_code, (200, 503))


if __name__ == "__main__":
    unittest.main()
