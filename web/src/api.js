// Data hooks: REST reads from server/api/read.py and the live SSE stream (server/api/stream.py).
import { useEffect, useRef, useState } from "react";

const q = (app, params = {}) => new URLSearchParams({ app: app || "all", ...params }).toString();

// useApi("/api/summary", app, { refresh: 30 }) -> { data, error, reload }
export const ToastBridge = { use: () => () => {} }; // set by ui.jsx to its toast hook, so api.js needs no import cycle

export function useApi(path, app, { params = {}, refresh = 0 } = {}) {
  const [state, setState] = useState({ data: null, error: null });
  const toast = ToastBridge.use();
  const [tick, setTick] = useState(0);
  const key = `${path}?${q(app, params)}`;
  useEffect(() => {
    let live = true;
    fetch(key)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data) => live && setState({ data, error: null }), (error) => {
        if (!live) return;
        setState((s) => {
          if (s.data) toast({ key: path, tone: "bad", title: "Couldn't refresh some data. Showing the last figures we had." });
          return { data: s.data, error };
        });
      });
    const t = refresh ? setTimeout(() => setTick((n) => n + 1), refresh * 1000) : null;
    return () => { live = false; clearTimeout(t); };
  }, [key, tick, refresh]);
  return { ...state, reload: () => setTick((n) => n + 1) };
}

// useStream(app, onEvent): one EventSource per mounted caller; the latest onEvent is always used.
export function useStream(app, onEvent) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource(`/api/stream?${app && app !== "all" ? q(app) : ""}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => { try { cb.current(JSON.parse(m.data)); } catch { /* malformed line: skip */ } };
    return () => es.close();
  }, [app]);
  return connected;
}

// send("POST", "/api/admin/reroute/settings", {...}) -> { ok, status, data }. The browser adds the Origin header the server checks.
export async function send(method, path, body) {
  try {
    const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: { error: "Mycelium's server can't be reached." } };
  }
}

export const fmt = {
  usd: (v) => (v == null ? "–" : v < 0.01 && v > 0 ? `US$${v.toFixed(4)}` : `US$${v.toFixed(2)}`),
  n: (v) => (v == null ? "–" : v.toLocaleString()),
  ms: (v) => (v == null ? "–" : `${Math.round(v)} ms`),
  pct: (v) => (v == null ? "No data" : `${v}%`),
  time: (ts) => new Date(ts * 1000).toLocaleString(),
  ago: (ts) => {
    const s = Math.max(0, Date.now() / 1000 - ts);
    if (s < 60) return `${Math.round(s)} s ago`;
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 48 * 3600) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} days ago`;
  },
};
