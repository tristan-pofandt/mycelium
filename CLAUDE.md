# Mycelium instructions for Claude Code

Mycelium is a monitoring hub for several apps: status, uptime, costs, usage, API calls, access management, and a live Obsidian-style map of files and data stores with a pulse per read or write. Read `docs/architecture.md` before changing anything; it is the spec. `docs/roadmap.md` holds the plan after v1, its limits (no arbitrary remote commands; AI suggests, people approve) and open decisions.

## Where things are

- `server/`: Flask app (`app.py`, `create_app()`), tests in `server/test_*.py`. Collectors go in `server/collectors/`, API modules in `server/api/`.
- `web/`: React + Vite. Panels are registered in `web/src/panels/index.js` (`id`, `title`, `requires`, `component`).
- `web/src/choreography.js`, `reduced.js`, `motion/fm.js` are copied from Reroute (`apps/plan-b-mvp/web/src/`) and the base of `web/src/tokens.css` ports Reroute's `DESIGN.md` tokens. Keep them in step with Reroute; all easing and timing comes from `choreography.js`; transform and opacity only; honour reduced motion.
- The look (since 2026-11-01) is Mycelium's own dashboard layer on top of those tokens: top pill nav, soft cards, hatched charts, gauge, heatmap. `DESIGN.md` is its rulebook; the direction brief is `.impeccable/surfaces/web-src.md`.
- `emitters/python/`: the emitter apps embed. `hooks/claude/`: the Claude Code hook. `infra/`: Dockerfile.

## Commands

- Server tests: `cd server && python -m unittest -q`
- Run the server: `cd server && python app.py` (http://127.0.0.1:8100)
- Web: `cd web && npm ci && npm run build && npm test`; dev server `npm run dev` proxies `/api` and `/healthz` to 8100
- Docker: `docker build -f infra/Dockerfile -t mycelium .`

## Rules

- Events carry metadata only: never file contents, request bodies, tokens, keys or personal data.
- App admin tokens live only in the server's environment; never send them to the browser or store them in SQLite.
- The site is private (Tailscale only); the repo is public, so never commit secrets, `.env` files or databases.
- Add a feature as one collector plus one panel; don't hard-code app names outside configuration.
- Accessibility: every visual (including the map) has a keyboard and screen-reader equivalent.
- After meaningful work, update `docs/` and the vault note `Projects/Mycelium.md` (see `CLAUDE.local.md` if present), crediting Claude and noting human review is required.
- Commit messages end with the Co-Authored-By line from the session. Dev servers you start, you stop.
