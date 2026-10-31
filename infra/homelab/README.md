# Homelab deployment

Mycelium runs in the homelab's Docker LXC (101, `mediaserver`) next to Reroute, and is reachable only on the tailnet.

- **Install once** (as root in the LXC): copy `install.sh` there and run it. It clones the repo to `/opt/mycelium/repo`, writes `/opt/mycelium/mycelium.env` (owner from this node's Tailscale login, a random session key; root only), installs `update.sh` and the systemd timer, builds and starts the container, and runs `tailscale serve --bg --https=8443 http://127.0.0.1:8100`.
- **Auto-deploy:** `mycelium-update.timer` runs `update.sh` every 2 minutes. It pulls `main` and rebuilds when the commit changes, so pushing to `main` is live in about 2 minutes.
- **Networking:** the container uses host networking. gunicorn listens on `127.0.0.1:8100` (for `tailscale serve`) and on the `docker0` address `172.17.0.1:8100` (so app containers' emitters can reach it). Only loopback requests may carry a trusted Tailscale identity, so a container can't forge one.
- **Data:** the Docker volume `mycelium-data` holds the SQLite database.
- **Never Funnel.** Mycelium is the owner's private site. Reroute's Funnel on 443 is separate and untouched.

## Connecting an app

1. Register it inside the container and keep the key out of logs: `docker exec mycelium python manage.py add-app <slug> <name> --health-url ... --admin-url ...`.
2. For Reroute on the same LXC: health and admin URLs are `http://127.0.0.1:8010`. In `reroute.env` set `MYCELIUM_URL=http://172.17.0.1:8100` and `MYCELIUM_KEY=<the key>`, and give both apps the same admin token (`PLANB_ADMIN_TOKEN` in Reroute, `MYCELIUM_ADMIN_TOKEN_REROUTE` in `mycelium.env`).
3. Rebuild: `rm /opt/mycelium/deployed; /opt/mycelium/update.sh` (and the same for Reroute).

## Commands

```bash
pct exec 101 -- journalctl -u mycelium-update -n 20     # deploy history
pct exec 101 -- docker logs --tail 50 mycelium          # app log
pct exec 101 -- tailscale serve status                  # should list :8443 (tailnet) and Reroute's Funnel on 443
```
