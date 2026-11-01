import { useState } from "react";
import { Link } from "react-router";
import { fmt, useApi } from "../api.js";
import { Bars, CountUp, Delta, Gauge, Heatmap, KpiTile } from "../charts.jsx";
import { Icon } from "../icons.jsx";
import { StatusBadge } from "./Status.jsx";
import MapPreview from "./MapPreview.jsx";
import { EmptyState, Skeleton, Tip, rovingKeys, useRowHighlight } from "../ui.jsx";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const RANGES = [["24h", "24 hours"], ["7d", "7 days"], ["30d", "30 days"]];
const ENTER_AT = 0.3, STEP = 0.065; // seconds: when the KPI tiles rise in (motion/pages.js ENTER), so each number climbs as its tile arrives

function stateLine(shown) {
  if (!shown.length) return "No apps connected yet.";
  const down = shown.filter((a) => a.status === "down");
  if (down.length) return `${down.map((a) => a.name).join(", ")} ${down.length > 1 ? "are" : "is"} down.`;
  if (shown.length === 1) {
    const a = shown[0];
    return a.status === "up" ? `${a.name} is up, checked ${fmt.ago(a.checked)}.` : `${a.name} hasn't been checked yet.`;
  }
  return `All ${shown.length} apps are up.`;
}

// One true sentence from the numbers, the most notable change first. Nothing is invented: no data, no insight.
function insight(s) {
  if (!s) return null;
  const p = s.previous || {};
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
  if (s.errors > 0 && s.errors > (p.errors || 0)) return `${fmt.n(s.errors)} errors in the last 24 hours, up from ${fmt.n(p.errors || 0)} the day before.`;
  const r = pct(s.requests, p.requests);
  if (r && Math.abs(r) >= 10) return `Requests are ${r > 0 ? "up" : "down"} ${Math.abs(r)}% on the previous 24 hours.`;
  if (s.requests > 0 && s.errors === 0) return `No errors in ${fmt.n(s.requests)} requests over the last 24 hours.`;
  return null;
}

function bucketLabel(ts, range) {
  const d = new Date(ts * 1000);
  return range === "24h" ? d.toLocaleTimeString([], { hour: "numeric" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function RequestsCard({ app }) {
  const [range, setRange] = useState("24h");
  const { data } = useApi("/api/activity", app, { params: { range }, refresh: 60 });
  let rows = (data || []).map((b) => ({ ts: b.ts, count: b.count, errors: b.errors }));
  if (range === "7d") { // hourly from the server; one bar per local day here
    const days = new Map();
    for (const b of rows) { const k = new Date(b.ts * 1000).toDateString(); const d = days.get(k) || { ts: b.ts, count: 0, errors: 0 }; d.count += b.count; d.errors += b.errors; days.set(k, d); }
    rows = [...days.values()];
  }
  const total = rows.reduce((s, b) => s + b.count, 0);
  return (
    <section className="panel-card chart-card ov-chart" aria-labelledby="req-h">
      <div className="card-head">
        <div>
          <h2 id="req-h">Requests</h2>
          <p className="card-sub">{rows.length ? `${fmt.n(total)} since ${range === "24h" ? new Date(rows[0].ts * 1000).toLocaleTimeString([], { hour: "numeric" }) + " yesterday" : new Date(rows[0].ts * 1000).toLocaleDateString([], { day: "numeric", month: "short" })}` : " "}</p>
        </div>
        <div className="card-tools">
          <div role="group" aria-label="Range" className="segmented" onKeyDown={(e) => rovingKeys(e, "button")}>
            {RANGES.map(([id]) => <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}>{id}</button>)}
          </div>
          <Tip label="Open usage" describe={false}><Link to={`/${app}/usage`} className="round-link" aria-label="Open usage"><Icon name="arrow" /></Link></Tip>
        </div>
      </div>
      {data ? (
        <Bars title={`Requests per ${range === "24h" ? "hour" : "day"}`} hideTitle format={fmt.n} height={210}
          series={[{ key: "ok", label: "Requests", color: "var(--accent)" }, { key: "errors", label: "Errors", color: "var(--error)", solid: true }]}
          rows={rows.map((b) => ({ label: bucketLabel(b.ts, range), values: { ok: b.count - b.errors, errors: b.errors } }))} />
      ) : <Skeleton height={250} />}
    </section>
  );
}

function RecentActivity({ app }) {
  const { data } = useApi("/api/events", app, { params: { limit: 6 }, refresh: 15 });
  const { glow, listProps } = useRowHighlight();
  return (
    <section className="panel-card" aria-labelledby="recent-h">
      <div className="card-head">
        <h2 id="recent-h">Recent activity</h2>
        <Tip label="Open the event log" describe={false}><Link to={`/${app}/events`} className="round-link" aria-label="Open the event log"><Icon name="arrow" /></Link></Tip>
      </div>
      {!data ? <Skeleton height={200} /> : data.length ? (
        <div className="rows" {...listProps}>
        <span className="row-glow" ref={glow} aria-hidden="true" />
        <ul className="activity" role="list">
          {data.map((e) => (
            <li key={e.id} data-row>
              <span className={`kind kind-${e.status === "error" ? "error" : e.kind}`}>{e.status === "error" ? "error" : e.kind}</span>
              <span className="activity-what">{(e.target || e.node || "").split(":").slice(1).join(":") || e.node}</span>
              <span className="activity-when">{fmt.ago(e.ts)}</span>
            </li>
          ))}
        </ul>
        </div>
      ) : <EmptyState title="Nothing has happened yet.">Events appear as soon as the app or Claude Code reports activity.</EmptyState>}
    </section>
  );
}

export default function Overview({ app, apps }) {
  const { data: s, error } = useApi("/api/summary", app, { refresh: 30 });
  const { data: week } = useApi("/api/activity", app, { params: { range: "7d", kind: "all" }, refresh: 300 });
  const shown = app === "all" ? apps : apps.filter((a) => a.slug === app);
  const p = s?.previous;
  const note = insight(s);
  return (
    <div className="overview">
      <div className="greeting">
        <h1><span className="rise-mask"><span className="rise">{greeting()}</span></span></h1>
        <p className={`state-line state-${shown.some((a) => a.status === "down") ? "bad" : "ok"}`}>
          <StatusBadge status={shown.some((a) => a.status === "down") ? "down" : shown.length && shown.every((a) => a.status === "up") ? "up" : null} words={{ up: "Healthy" }} />
          <span>{stateLine(shown)}</span>
        </p>
      </div>
      {error && !s && <p className="notice" role="status">Couldn't load the summary.</p>}

      <div className="ov-main">
        <dl className="kpis ov-kpis" aria-label="Last 24 hours">
          <KpiTile icon="requests" label="Requests in the last 24 hours" value={<CountUp value={s?.requests} format={fmt.n} delay={ENTER_AT} />} to={`/${app}/usage`} linkLabel="Open usage"
            delta={s && <Delta now={s.requests} before={p.requests} />} />
          <KpiTile icon="errors" label="Errors in the last 24 hours" value={<CountUp value={s?.errors} format={fmt.n} delay={ENTER_AT + STEP} />} to={`/${app}/events`} linkLabel="Open the event log"
            delta={s && <Delta now={s.errors} before={p.errors} goodWhenUp={false} />} />
          <KpiTile icon="latency" label="p95 response time" value={<CountUp value={s?.p95_ms} format={fmt.ms} delay={ENTER_AT + 2 * STEP} />} to={`/${app}/apis`} linkLabel="Open API details"
            delta={s && <Delta now={s.p95_ms} before={p.p95_ms} goodWhenUp={false} />} />
          <KpiTile icon="wallet" label={s ? `Cost today, ${fmt.usd(s.cost_month)} this month` : "Cost today"} value={<CountUp value={s?.cost_today} format={fmt.usd} delay={ENTER_AT + 3 * STEP} />}
            to={`/${app}/costs`} linkLabel="Open costs" delta={s && <Delta now={s.cost_today} before={p.cost_today} goodWhenUp={false} />} />
        </dl>
        <RequestsCard app={app} />
        <div className="ov-pair ov-later">
          <RecentActivity app={app} />
          <section className="panel-card" aria-labelledby="heat-h">
            <div className="card-head"><h2 id="heat-h">Activity this week</h2></div>
            {week ? <Heatmap buckets={week} title="Events per hour over the last 7 days" /> : <Skeleton height={200} />}
          </section>
        </div>
      </div>

      <aside className="ov-side" aria-label="Health and live map">
        <section className="panel-card ov-gauge" aria-labelledby="up-h">
          <div className="card-head">
            <div><h2 id="up-h">Uptime</h2><p className="card-sub">Health checks, last 30 days</p></div>
            {shown.some((a) => a.capabilities.includes("probes")) && <Tip label="Open status and uptime" describe={false}><Link to={`/${app}/status`} className="round-link" aria-label="Open status and uptime"><Icon name="arrow" /></Link></Tip>}
          </div>
          <Gauge value={s?.uptime_30d ?? null} label="Uptime over 30 days" sub={s?.uptime_24h != null ? `${s.uptime_24h}% today` : null} />
          <ul className="app-list" role="list">
            {shown.map((a) => (
              <li key={a.slug} className="app-row">
                <Link to={`/${a.slug}/overview`} className="app-name">{a.name}</Link>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </section>
        <section className="panel-card ov-mini" aria-labelledby="mini-h">
          <div className="card-head">
            <div><h2 id="mini-h">Live map</h2><p className="card-sub">Reads and writes as they happen</p></div>
            <Tip label="Open the live map" describe={false}><Link to={`/${app}/map`} className="round-link" aria-label="Open the live map"><Icon name="arrow" /></Link></Tip>
          </div>
          <MapPreview app={app} />
        </section>
        {note && (
          <section className="insight ov-insight" aria-label="Insight">
            <span className="insight-icon" aria-hidden="true"><Icon name="spark" /></span>
            <p>{note}</p>
          </section>
        )}
      </aside>
    </div>
  );
}
