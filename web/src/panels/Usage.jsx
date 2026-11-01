import { fmt, useApi } from "../api.js";
import { Skeleton } from "../ui.jsx";
import { Bars, Table } from "../charts.jsx";

const callRows = (rows) => rows.map((r) => [r.name, fmt.n(r.calls), fmt.n(r.errors), fmt.ms(r.p50_ms), fmt.ms(r.p95_ms)]);
const HEAD = ["Name", "Calls", "Errors", "p50", "p95"];

export default function Usage({ app }) {
  const { data } = useApi("/api/usage", app, { refresh: 60 });
  if (!data) return <section className="card"><Skeleton height={220} lines={3} /></section>;
  return (
    <>
      <section className="card">
        <Bars title="Requests per hour, last 24 hours" series={[{ key: "requests", label: "Requests", color: "var(--series-1)" }]}
          format={fmt.n} rows={data.hours.map((h) => ({ label: new Date(h.ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), values: { requests: h.requests } }))} />
      </section>
      <section className="card" aria-labelledby="routes-h">
        <h2 id="routes-h">Routes, last 24 hours</h2>
        <Table caption="Requests per route" head={HEAD.map((h, i) => (i ? h : "Route"))} rows={callRows(data.routes)} empty="No requests yet." />
      </section>
    </>
  );
}

export function Apis({ app }) {
  const { data } = useApi("/api/usage", app, { refresh: 60 });
  if (!data) return <section className="card"><Skeleton height={220} lines={3} /></section>;
  return (
    <section className="card" aria-labelledby="ext-h">
      <h2 id="ext-h">External APIs, last 24 hours</h2>
      <p className="muted">Every call the app or Claude Code made to a third-party service, with failures and latency.</p>
      <Table caption="External API calls" head={HEAD.map((h, i) => (i ? h : "API"))} rows={callRows(data.externals)} empty="No external calls yet." />
    </section>
  );
}
