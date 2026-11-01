import { fmt, useApi } from "../api.js";
import { DataTable, Table } from "../charts.jsx";
import { Icon } from "../icons.jsx";

// Status always pairs a colour with an icon and a word, never colour alone.
const STATUS = { up: ["up", "Up", "ok"], down: ["down", "Down", "bad"], null: ["unknown", "Unknown", "none"] };
export function StatusBadge({ status, words = {} }) {
  const [icon, word, cls] = STATUS[status] || STATUS.null;
  return <span className={`badge badge-${cls}`}><Icon name={icon} />{words[status] || word}</span>;
}

const dayClass = (d) => (!d ? "none" : d.up_pct >= 99.9 ? "ok" : d.up_pct >= 95 ? "warn" : "bad");

export default function Status({ app }) {
  const { data } = useApi("/api/uptime", app, { refresh: 60 });
  if (!data) return <p className="muted" role="status">Loading…</p>;
  const byDay = Object.fromEntries(data.days.map((d) => [d.day, d]));
  const days = Array.from({ length: 90 }, (_, i) => new Date(Date.now() - (89 - i) * 864e5).toISOString().slice(0, 10));
  return (
    <>
      <section className="card" aria-labelledby="uptime-h">
        <h2 id="uptime-h">Uptime, last 90 days</h2>
        <div className="uptime" aria-hidden="true">
          {days.map((d) => (
            <span key={d} className={`uptime-day uptime-${dayClass(byDay[d])}`}
              title={byDay[d] ? `${d}: ${byDay[d].up_pct}% up, ${byDay[d].checks} checks` : `${d}: no data`} />
          ))}
        </div>
        <div className="axis" aria-hidden="true"><span>90 days ago</span><span>Today</span></div>
        <ul className="legend">
          <li><span className="swatch uptime-ok" />99.9% or more</li>
          <li><span className="swatch uptime-warn" />95 to 99.9%</li>
          <li><span className="swatch uptime-bad" />Under 95%</li>
          <li><span className="swatch uptime-none" />No data</li>
        </ul>
        <DataTable caption="Uptime per day" head={["Day", "Up", "Checks", "Median latency"]}
          rows={data.days.map((d) => [d.day, `${d.up_pct}%`, d.checks, fmt.ms(d.p50_ms)])} />
      </section>
      <section className="card" aria-labelledby="inc-h">
        <h2 id="inc-h">Failed checks</h2>
        <Table caption="Failed checks" head={["When", "App", "Check", "Code"]} empty="No failed checks in 90 days."
          rows={data.incidents.map((p) => [fmt.time(p.ts), p.app, p.check_name, p.code || "No answer"])} />
      </section>
      <section className="card" aria-labelledby="probe-h">
        <h2 id="probe-h">Recent checks</h2>
        <Table caption="Recent checks" head={["When", "App", "Check", "Code", "Latency"]} empty="No checks in the last day."
          rows={data.recent.map((p) => [fmt.time(p.ts), p.app, p.check_name, p.code || "No answer", fmt.ms(p.ms)])} />
      </section>
    </>
  );
}
