import io
import os
import tempfile
import unittest
from unittest import mock

import mycelium_hook as h


class HookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = os.path.join(self.tmp.name, "reroute")
        os.makedirs(os.path.join(self.root, "apps"))
        self.config = {"url": "http://x", "apps": [{"root": self.root, "key": "k"}]}

    def tearDown(self):
        self.tmp.cleanup()

    def test_relative_path_and_kind(self):
        key, ev = h.event({"tool_name": "Edit", "cwd": self.root, "duration_ms": 12,
                           "tool_input": {"file_path": os.path.join(self.root, "apps", "rides.py"), "old_string": "secret"}}, self.config)
        self.assertEqual((key, ev["kind"], ev["node"], ev["source"], ev["duration_ms"]), ("k", "write", "file:apps/rides.py", "claude", 12))
        self.assertNotIn("secret", str(ev))

    def test_glob_without_path_uses_cwd_and_notebook_path(self):
        self.assertEqual(h.event({"tool_name": "Glob", "cwd": os.path.join(self.root, "apps"), "tool_input": {"pattern": "*"}},
                                 self.config)[1]["node"], "file:apps")
        self.assertEqual(h.event({"tool_name": "NotebookEdit", "cwd": self.root, "tool_input": {"notebook_path": "a.ipynb"}},
                                 self.config)[1]["node"], "file:a.ipynb")

    def test_outside_repo_lookalike_and_other_tools_are_dropped(self):
        for payload in ({"tool_name": "Read", "cwd": self.tmp.name, "tool_input": {"file_path": "x.txt"}},
                        {"tool_name": "Read", "cwd": self.tmp.name, "tool_input": {"file_path": self.root + "-old/x.py"}},
                        {"tool_name": "Bash", "cwd": self.root, "tool_input": {"command": "ls"}}):
            self.assertIsNone(h.event(payload, self.config))

    def test_main_never_fails(self):
        with mock.patch("sys.stdin", io.StringIO("not json")), mock.patch.dict(os.environ, {"MYCELIUM_HOOK_CONFIG": "/nope.json"}):
            self.assertEqual(h.main(), 0)


if __name__ == "__main__":
    unittest.main()
