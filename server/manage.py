"""Owner CLI: python manage.py add-app <slug> <name> [--base-url U] [--health-url U] [--ready-url U] [--admin-url U] [--repo-root P]

Prints the app's ingest key once; only its hash is stored.
"""
import argparse

import db

p = argparse.ArgumentParser()
sub = p.add_subparsers(dest="cmd", required=True)
a = sub.add_parser("add-app")
a.add_argument("slug")
a.add_argument("name")
for flag in ("base-url", "health-url", "ready-url", "admin-url", "repo-root"):
    a.add_argument("--" + flag, default="")

if __name__ == "__main__":
    args = p.parse_args()
    db.init()
    urls = {k: v for k, v in vars(args).items() if k not in ("cmd", "slug", "name")}
    print("Ingest key (shown once):", db.add_app(args.slug, args.name, **urls))
