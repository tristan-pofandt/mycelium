// Event log: the latest events, live-tailing from the stream, with filters and paging back through history.
import { useEffect, useState } from "react";
import { fmt, useApi, useStream } from "../api.js";

const KINDS = ["", "request", "read", "write", "external", "cost", "probe", "admin", "log"];
const SOURCES = ["", "app", "claude", "probe", "collector"];
const MAX = 500;

const describe = (e) => [e.actor && e.kind !== "request" ? e.actor.split(":")[1] : null, e.node, e.target && `→ ${e.target}`]
  .filter(Boolean).join(" ");

export function EventTable({ events, showApp }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Events, newest first</caption>
        <thead><tr><th scope="col">Time</th>{showApp && <th scope="col">App</th>}<th scope="col">Kind</th><th scope="col">Source</th><th scope="col">What</th><th scope="col">Status</th><th scope="col">Duration</th><th scope="col">Cost</th></tr></thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id ?? `${e.recv}-${e.node}-${e.kind}`}>
              <td>{new Date(e.ts * 1000).toLocaleTimeString()}</td>
              {showApp && <td>{e.app}</td>}
              <td><span className={`kind kind-${e.kind}`}>{e.kind}</span></td>
              <td>{e.source}</td>
              <td className="mono">{describe(e)}</td>
              <td>{e.status === "error" ? <span className="badge badge-bad"><span aria-hidden="true">▲</span> error</span> : e.status || ""}</td>
              <td>{e.duration_ms != null ? fmt.ms(e.duration_ms) : ""}</td>
              <td>{e.usd ? fmt.usd(e.usd) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useEventLog(app, params = {}, keep = () => true) {
  const { data } = useApi("/api/events", app, { params });
  const [events, setEvents] = useState([]);
  const [older, setOlder] = useState(true);
  const [paused, setPaused] = useState(false);
  useEffect(() => { if (data) { setEvents(data); setOlder(data.length >= 100); } }, [data]);
  const connected = useStream(app, (e) => {
    if (paused || !keep(e)) return;
    setEvents((list) => [e, ...list].slice(0, MAX));
  });
  const loadOlder = async () => {
    const last = events.findLast((e) => e.id)?.id;
    const r = await fetch(`/api/events?${new URLSearchParams({ app, ...params, ...(last ? { before: last } : {}) })}`);
    const more = r.ok ? await r.json() : [];
    setOlder(more.length >= 100);
    setEvents((list) => [...list, ...more]);
  };
  return { events, connected, paused, setPaused, older, loadOlder };
}

export default function Events({ app }) {
  const [kind, setKind] = useState("");
  const [source, setSource] = useState("");
  const params = Object.fromEntries(Object.entries({ kind, source }).filter(([, v]) => v));
  const log = useEventLog(app, params, (e) => (!kind || e.kind === kind) && (!source || e.source === source));
  return (
    <section className="card">
      <div className="toolbar">
        <label>Kind <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => <option key={k} value={k}>{k || "All"}</option>)}</select></label>
        <label>Source <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
          {SOURCES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}</select></label>
        <button type="button" className="button" aria-pressed={log.paused} onClick={() => log.setPaused((p) => !p)}>
          {log.paused ? "Resume live" : "Pause live"}
        </button>
        <span className="muted" role="status">{log.connected ? (log.paused ? "Paused" : "Live") : "Reconnecting…"}</span>
      </div>
      {log.events.length ? <EventTable events={log.events} showApp={app === "all"} /> : <p className="muted">No events yet.</p>}
      {log.older && log.events.length > 0 && <button type="button" className="button" onClick={log.loadOlder}>Load older</button>}
    </section>
  );
}

export function Transactions({ app }) {
  const log = useEventLog(app, { paid: 1 }, (e) => e.usd > 0);
  const total = log.events.reduce((s, e) => s + (e.usd || 0), 0);
  return (
    <section className="card">
      <p className="lead">Every billable call: Google API requests from the app and Claude Code model calls. Shown: {fmt.usd(total)}.</p>
      {log.events.length ? <EventTable events={log.events} showApp={app === "all"} /> : <p className="muted">No billable calls yet.</p>}
      {log.older && log.events.length > 0 && <button type="button" className="button" onClick={log.loadOlder}>Load older</button>}
    </section>
  );
}
