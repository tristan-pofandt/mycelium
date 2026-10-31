# Build from the repo root: docker build -f infra/Dockerfile --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t mycelium .
FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY web/ ./
RUN npm run build

FROM python:3.13-slim
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MYCELIUM_WEB_DIST=/app/web/dist
WORKDIR /app/server
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server/ ./
COPY --from=web /web/dist /app/web/dist
# Home is the data folder: gunicorn 26 writes its control socket under $HOME.
RUN useradd --system --uid 10001 --home-dir /app/data mycelium && mkdir -p /app/data && chown mycelium /app/data
USER mycelium
EXPOSE 8100
# One worker keeps the in-memory live bus in one process; threads serve the SSE streams.
CMD ["gunicorn", "--bind", "0.0.0.0:8100", "--workers", "1", "--threads", "16", "--access-logformat", "%(m)s %(U)s %(s)s %(b)s %(L)s", "app:create_app()"]
