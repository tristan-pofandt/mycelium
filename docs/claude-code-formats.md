# Claude Code hook and telemetry formats (for steps 4 and 5)

Looked up 2026-10-31 by a Claude Code subagent from https://code.claude.com/docs/en/hooks.md and https://code.claude.com/docs/en/monitoring-usage.md. Gaps are marked; check them against a real payload before relying on them. Needs human review.

## PostToolUse hook

- Stdin JSON: `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `tool_name`, `tool_input`, `tool_response`, `tool_use_id`, `duration_ms`.
- Path fields in `tool_input`: Read and Write `file_path`; Glob and Grep `path` (optional, defaults to `cwd`). Edit and NotebookEdit are not documented by name; expect `file_path` and `notebook_path`, and capture one to confirm.
- Send only `tool_name`, the repo-relative path and `duration_ms`. Never `tool_input` content, `tool_response`, `transcript_path` or `session_id`.
- Declaration: `{"hooks":{"PostToolUse":[{"matcher":"Read|Edit|Write|NotebookEdit|Glob|Grep","hooks":[{"type":"command","command":"...","timeout":5,"async":true}]}]}}`. `async: true` runs it in the background.
- The tool has already run when the hook fires, and a non-zero exit (other than 2) only shows a non-blocking "hook error". Exit 0 quietly on any failure.

## OpenTelemetry

- Env: `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER=otlp`, `OTEL_LOGS_EXPORTER=otlp`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/json` (there is no default protocol), `OTEL_EXPORTER_OTLP_ENDPOINT=http://<mycelium>`, `OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <ingest key>"`. Intervals: metrics 60 s, logs 5 s.
- Paths: `/v1/metrics` and `/v1/logs`. The JSON envelope (`resourceMetrics`, `resourceLogs`) is the standard OTLP one and is not documented by Claude Code itself.
- Useful metrics: `claude_code.cost.usage` (USD), `claude_code.token.usage` (`type`, `model`), `claude_code.session.count`, `claude_code.lines_of_code.count`. Temporality defaults to delta.
- Useful events: `claude_code.api_request` (`model`, `cost_usd`, `duration_ms`, token counts), `claude_code.api_error`, `claude_code.tool_result` (`tool_name`, `success`, `duration_ms`, sizes).
- **Personal data:** `user.email` and `user.id` are always included when available, and `organization.id` too. Mycelium must drop these before storing. Keep `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_DETAILS`, `OTEL_LOG_TOOL_CONTENT` and `OTEL_LOG_RAW_API_BODIES` unset, and use an allowlist of attributes rather than a blocklist.
