#!/bin/bash
# Keeps the mycelium container in step with GitHub main. Run every 2 minutes by mycelium-update.timer (same pattern as Reroute).
# The clone at /opt/mycelium/repo is a read-only mirror of main: never edit it here.
# Host networking: gunicorn listens on 127.0.0.1 (for `tailscale serve`) and on the docker0 bridge address (for app containers'
# emitters). Only loopback requests may carry a trusted Tailscale identity (server/auth.py), so containers can't forge one.
set -euo pipefail
exec 9>/run/mycelium-update.lock
flock -n 9 || exit 0

cd /opt/mycelium/repo
git fetch -q origin main
git reset -q --hard origin/main
new=$(git rev-parse HEAD)
old=$(cat /opt/mycelium/deployed 2>/dev/null || true)

if [ "$new" = "$old" ] && [ -n "$(docker ps -q -f name=^mycelium$)" ]; then
    exit 0
fi

bridge=$(ip -4 -o addr show docker0 | awk '{print $4}' | cut -d/ -f1)
echo "deploying $new"
DOCKER_BUILDKIT=1 docker build -q -f infra/Dockerfile --build-arg GIT_SHA="${new:0:7}" -t mycelium:latest .
docker rm -f mycelium >/dev/null 2>&1 || true
docker run -d --name mycelium --restart unless-stopped --network host \
    --env-file /opt/mycelium/mycelium.env \
    -v mycelium-data:/app/data \
    mycelium:latest \
    gunicorn --bind 127.0.0.1:8100 --bind "${bridge}:8100" --workers 1 --threads 16 \
        --access-logformat '%(m)s %(U)s %(s)s %(b)s %(L)s' 'app:create_app()' >/dev/null
echo "$new" > /opt/mycelium/deployed
docker image prune -f >/dev/null
echo "deployed $new"
