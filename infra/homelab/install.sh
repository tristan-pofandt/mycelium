#!/bin/bash
# One-time install on the homelab Docker LXC (run as root inside it). Safe to run again: it never overwrites mycelium.env.
# Secrets are generated here and stay in /opt/mycelium/mycelium.env (root only); nothing secret is printed or committed.
set -euo pipefail
umask 077
mkdir -p /opt/mycelium
cd /opt/mycelium

[ -d repo/.git ] || git clone -q https://github.com/tristan-pofandt/mycelium.git repo

if [ ! -f mycelium.env ]; then
    owner=$(tailscale status --json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["User"][str(d["Self"]["UserID"])]["LoginName"])')
    cat > mycelium.env <<EOF
MYCELIUM_DB=/app/data/mycelium.sqlite3
MYCELIUM_TRUST_TAILSCALE=1
MYCELIUM_OWNER=${owner}
MYCELIUM_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')
MYCELIUM_SECURE_COOKIE=1
EOF
    chmod 600 mycelium.env
    echo "wrote /opt/mycelium/mycelium.env (owner set from this node's Tailscale login)"
fi

install -m 700 repo/infra/homelab/update.sh /opt/mycelium/update.sh
install -m 644 repo/infra/homelab/mycelium-update.service repo/infra/homelab/mycelium-update.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now mycelium-update.timer
/opt/mycelium/update.sh

# Tailnet only (never Funnel): https://<this node>.<tailnet>.ts.net:8443
tailscale serve --bg --https=8443 http://127.0.0.1:8100
echo "done: check with  curl -s http://127.0.0.1:8100/healthz"
