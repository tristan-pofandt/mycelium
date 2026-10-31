"""Pull an app's /admin/usage (Google API cost estimates per day and SKU) into the costs table.

The admin token comes from the server environment as MYCELIUM_ADMIN_TOKEN_<SLUG> and never reaches the database or the browser.
Rows are upserted per (app, day, api, sku), so polling every 5 minutes never double counts.
"""
import json
import logging

NAME, INTERVAL = "reroute-usage", 300
log = logging.getLogger("mycelium")


def run(conn, app):
    from api.admin import admin_token
    token = admin_token(app["slug"])
    if not app["admin_url"] or not token:
        return
    from collectors import fetch
    code, body, _ = fetch(app["admin_url"].rstrip("/") + "/admin/usage", token)
    if code != 200:
        log.warning("usage collector: %s answered %s", app["slug"], code)
        return
    for day, d in json.loads(body).get("days", {}).items():
        for r in d.get("items", []):
            conn.execute("INSERT INTO costs (app,day,api,sku,count,usd) VALUES (?,?,?,?,?,?) "
                         "ON CONFLICT(app,day,api,sku) DO UPDATE SET count=excluded.count, usd=excluded.usd",
                         (app["slug"], day, r["api"], r["sku"], r["count"], r["usd"]))
    conn.commit()
