# Claude Code hook

Sends one metadata-only event to Mycelium each time Claude Code reads or changes a file in a registered repo: the tool name, the repo-relative path and the duration. Nothing else leaves your computer: no file contents, tool input or output, prompts or session ids, and nothing about files outside a registered repo. Written with Claude Code; needs human review.

## Set up

1. Use the app's ingest key from `python manage.py add-app` (in `server/`). Each app has one key for now, shared by its emitter and this hook; a second key per app comes with the Settings view.
2. Create `~/.mycelium/hook.json` (or point `MYCELIUM_HOOK_CONFIG` at another path). Keep it outside every repo:
   ```json
   {"url": "http://127.0.0.1:8100", "apps": [{"root": "C:/dev/reroute", "key": "<ingest key>"}]}
   ```
3. Merge `settings.snippet.json` into `~/.claude/settings.json` (all projects) and fix the script path if your clone is elsewhere.

The hook runs in the background (`async`), times out after 5 s, and always exits 0, so a missing config or a stopped Mycelium never affects Claude.

## Claude Code telemetry (tokens and cost)

To also send Claude Code's own model calls and cost while you work on an app, add this to that repo's `.claude/settings.local.json` (git-ignored; it holds the key). Settings `env` applies only to sessions in that repo, so cost is credited to the right app:

```json
{"env": {
  "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
  "OTEL_LOGS_EXPORTER": "otlp", "OTEL_METRICS_EXPORTER": "otlp",
  "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
  "OTEL_EXPORTER_OTLP_ENDPOINT": "http://127.0.0.1:8100",
  "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer <ingest key>"
}}
```

Leave `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_DETAILS`, `OTEL_LOG_TOOL_CONTENT` and `OTEL_LOG_RAW_API_BODIES` unset. Mycelium ignores those fields anyway.

## Test

`python -m unittest -q` in this folder.
