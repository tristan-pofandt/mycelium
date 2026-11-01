import { Link } from "react-router";
import { fmt, useApi } from "../api.js";
import { Stat } from "../charts.jsx";
import { StatusBadge } from "./Status.jsx";

export default function Overview({ app, apps }) {
  const { data: s, error } = useApi("/api/summary", app, { refresh: 30 });
  const shown = app === "all" ? apps : apps.filter((a) => a.slug === app);
  return (
    <>
      {error && !s && <p className="notice" role="status">Couldn't load the summary.</p>}
      <dl aria-label="Last 24 hours" className="stats">
        <Stat label="Requests (24 h)" value={fmt.n(s?.requests)} note={s && `${fmt.n(s.errors)} errors`} />
        <Stat label="p95 latency (24 h)" value={fmt.ms(s?.p95_ms)} />
        <Stat label="Uptime" value={fmt.pct(s?.uptime_24h)} note={s && `30 days: ${fmt.pct(s.uptime_30d)}`} />
        <Stat label="Cost today" value={fmt.usd(s?.cost_today)} note={s && `This month: ${fmt.usd(s.cost_month)}`} />
        <Stat label="Reads and writes (24 h)" value={s ? `${fmt.n(s.reads)} / ${fmt.n(s.writes)}` : "–"} note={s && `${fmt.n(s.externals)} external calls`} />
      </dl>
      <section className="card" aria-labelledby="apps-h">
        <h2 id="apps-h">Apps</h2>
        {shown.length ? (
          <ul className="app-list" role="list">
            {shown.map((a) => (
              <li key={a.slug} className="app-row">
                <Link to={`/${a.slug}/overview`} className="app-name">{a.name}</Link>
                <StatusBadge status={a.status} />
                <span className="muted">{a.checked ? `Checked ${fmt.ago(a.checked)}` : "Not probed yet"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No apps yet. Register one with <code>python manage.py add-app</code> in <code>server/</code>.</p>
        )}
      </section>
    </>
  );
}
