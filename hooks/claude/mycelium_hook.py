"""Claude Code PostToolUse hook: tell Mycelium which repo file Claude read or changed. Standard library only.

Sends the tool name, the path relative to the registered repo root and the duration. Never file contents, tool input or
output, prompts, session ids or anything outside a registered repo. Always exits 0, so it can never get in Claude's way.

Config: a JSON file outside any repo, at MYCELIUM_HOOK_CONFIG or ~/.mycelium/hook.json:
    {"url": "http://127.0.0.1:8100", "apps": [{"root": "C:/dev/reroute", "key": "<ingest key>"}]}
"""
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

KINDS = {"Read": "read", "Glob": "read", "Grep": "read", "Edit": "write", "Write": "write", "NotebookEdit": "write"}


def load_config():
    path = os.getenv("MYCELIUM_HOOK_CONFIG") or Path.home() / ".mycelium" / "hook.json"
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _norm(path):
    return os.path.normcase(os.path.realpath(path))


def event(payload, config):
    """Return (ingest key, event) for a tool call inside a registered repo, else None."""
    kind = KINDS.get(payload.get("tool_name"))
    if not kind:
        return None
    args = payload.get("tool_input") or {}
    cwd = payload.get("cwd") or os.getcwd()
    raw = args.get("file_path") or args.get("notebook_path") or args.get("path") or cwd
    target = _norm(os.path.join(cwd, raw))
    for app in config.get("apps", []):
        root = _norm(app["root"])
        if target == root or target.startswith(root + os.sep):
            rel = os.path.relpath(target, root).replace(os.sep, "/")
            duration = payload.get("duration_ms")
            return app["key"], {"ts": time.time(), "source": "claude", "kind": kind, "actor": "actor:claude",
                                "node": "file:" + rel, "status": "ok",
                                "duration_ms": duration if isinstance(duration, (int, float)) else None,
                                "meta": {"tool": payload["tool_name"]}}
    return None


def main():
    try:
        config = load_config()
        found = event(json.load(sys.stdin), config)
        if found:
            key, ev = found
            req = urllib.request.Request(config["url"].rstrip("/") + "/ingest/events", data=json.dumps([ev]).encode(),
                                         method="POST", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=3).close()
    except Exception:  # no config, Mycelium down, odd input: stay silent
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
