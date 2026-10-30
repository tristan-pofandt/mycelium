"""SQLite (WAL) access and schema. One connection per call: cheap, and safe across gunicorn threads."""
import hashlib
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent


def db_path():
    return os.getenv("MYCELIUM_DB", str(HERE / "data" / "mycelium.sqlite3"))


SCHEMA = """
CREATE TABLE IF NOT EXISTS apps (
  slug TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT DEFAULT '', repo_root TEXT DEFAULT '',
  health_url TEXT DEFAULT '', ready_url TEXT DEFAULT '', admin_url TEXT DEFAULT '',
  key_hash TEXT NOT NULL, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY, ts REAL NOT NULL, recv REAL NOT NULL, app TEXT NOT NULL, source TEXT NOT NULL,
  kind TEXT NOT NULL, actor TEXT, node TEXT, target TEXT, status TEXT, duration_ms REAL, bytes INTEGER,
  usd REAL DEFAULT 0, meta TEXT);
CREATE INDEX IF NOT EXISTS events_app_ts ON events(app, ts);
CREATE TABLE IF NOT EXISTS rollups (
  app TEXT NOT NULL, period TEXT NOT NULL, start REAL NOT NULL, requests INTEGER, errors INTEGER,
  p50 REAL, p95 REAL, reads INTEGER, writes INTEGER, externals INTEGER, usd REAL,
  PRIMARY KEY (app, period, start));
CREATE TABLE IF NOT EXISTS probes (
  id INTEGER PRIMARY KEY, app TEXT NOT NULL, ts REAL NOT NULL, check_name TEXT NOT NULL, code INTEGER,
  ms REAL, ok INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS probes_app_ts ON probes(app, ts);
CREATE TABLE IF NOT EXISTS nodes (
  app TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, first_seen REAL, last_seen REAL, hits INTEGER DEFAULT 0,
  PRIMARY KEY (app, id));
CREATE TABLE IF NOT EXISTS edges (
  app TEXT NOT NULL, src TEXT NOT NULL, dst TEXT NOT NULL, kind TEXT NOT NULL, hits INTEGER DEFAULT 0, last_seen REAL,
  PRIMARY KEY (app, src, dst, kind));
CREATE TABLE IF NOT EXISTS costs (
  app TEXT NOT NULL, day TEXT NOT NULL, api TEXT NOT NULL, sku TEXT NOT NULL, count INTEGER, usd REAL,
  PRIMARY KEY (app, day, api, sku));
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, ts REAL NOT NULL, actor TEXT, app TEXT, action TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
"""


def connect():
    path = db_path()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=10000")
    return conn


def init():
    with connect() as conn:
        conn.executescript(SCHEMA)


def hash_key(key):
    return hashlib.sha256(key.encode()).hexdigest()


def add_app(slug, name, **urls):
    """Register an app and return its ingest key, which is shown once and stored only as a hash."""
    key = "myc_" + secrets.token_urlsafe(32)
    cols = {k: v for k, v in urls.items() if k in ("base_url", "repo_root", "health_url", "ready_url", "admin_url")}
    names = ["slug", "name", "key_hash", "created", *cols]
    with connect() as conn:
        conn.execute(f"INSERT INTO apps ({','.join(names)}) VALUES ({','.join('?' * len(names))})",
                     [slug, name, hash_key(key), time.time(), *cols.values()])
        conn.execute("INSERT INTO audit (ts, actor, app, action, detail) VALUES (?,?,?,?,?)",
                     (time.time(), "owner", slug, "app.add", json.dumps({"name": name})))
    return key


def app_for_key(conn, key):
    row = conn.execute("SELECT slug FROM apps WHERE key_hash=?", (hash_key(key),)).fetchone()
    return row["slug"] if row else None
