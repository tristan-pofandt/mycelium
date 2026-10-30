import os
import unittest
from unittest import mock

import mycelium_emitter as me


class EmitterTest(unittest.TestCase):
    def tearDown(self):
        me._emitter = None

    def test_unconfigured_is_a_no_op(self):
        with mock.patch.dict(os.environ, {"MYCELIUM_URL": "", "MYCELIUM_KEY": ""}):
            self.assertIsNone(me.configure())
        me.emit("read", "file:a.py")  # must not raise

    def test_batches_and_drops_when_server_down(self):
        sent = []
        em = me.configure("http://x", "k", post=sent.append)
        for i in range(250):
            me.emit("read", f"file:{i}.py")
        em.flush()
        self.assertEqual([len(b) for b in sent], [200, 50])
        em.post = mock.Mock(side_effect=OSError("down"))
        me.emit("read", "file:a.py")
        em.flush()  # must not raise; the failed batch is dropped
        self.assertEqual(len(em.queue), 0)

    def test_sqlite_watch_and_timed(self):
        import sqlite3
        sent = []
        em = me.configure("http://x", "k", post=sent.append)
        conn = me.watch_sqlite(sqlite3.connect(":memory:"), "file:a.py", "store:t.db")
        conn.execute("CREATE TABLE t (x)")
        conn.execute("INSERT INTO t VALUES ('secret')")
        conn.execute("SELECT * FROM t").fetchall()
        with self.assertRaises(ValueError), me.timed("external", "file:a.py", "external:example.com"):
            raise ValueError
        em.flush()
        self.assertEqual([(e["kind"], e["status"]) for e in sent[0]], [("write", "ok"), ("read", "ok"), ("external", "error")])
        self.assertNotIn("secret", str(sent))
        conn.close()

    def test_request_event_uses_route_rule_not_query(self):
        from flask import Flask
        app = Flask(__name__)
        app.get("/rides/<rid>")(lambda rid: "ok")
        sent = []
        with mock.patch.dict(os.environ, {"MYCELIUM_URL": "http://x", "MYCELIUM_KEY": "k"}):
            me.init_telemetry(app)
        me._emitter.post = sent.append
        app.test_client().get("/rides/42?email=a@b.c")
        me._emitter.flush()
        ev = sent[0][0]
        self.assertEqual((ev["kind"], ev["node"], ev["meta"]["code"]), ("request", "endpoint:/rides/<rid>", 200))
        self.assertNotIn("a@b.c", str(sent))


if __name__ == "__main__":
    unittest.main()
