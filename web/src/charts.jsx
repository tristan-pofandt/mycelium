// Chart pieces built from plain elements (no chart library), in the dashboard style of DESIGN.md: hatched bars with one solid
// accent bar, a segmented arc gauge, a weekly heatmap and icon KPI tiles. Every piece has an exact text or table equivalent.
// Colours: tokens in tokens.css (series validated for CVD and contrast); text always wears text tokens, never a series colour.
import { useState } from "react";
import { Link } from "react-router";
import { Icon } from "./icons.jsx";

export function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <dt className="stat-label">{label}</dt>
      <dd className="stat-value">{value}</dd>
      {note && <dd className="stat-note">{note}</dd>}
    </div>
  );
}

// Change against the previous period. `goodWhenUp` says which direction is good, so colour follows meaning, not sign;
// the arrow and the word carry it too.
export function Delta({ now, before, goodWhenUp = true }) {
  if (now == null || before == null) return null;
  if (before === 0) return now === 0 ? <span className="delta delta-flat">No change</span> : <span className="delta delta-flat">New</span>;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="delta delta-flat">No change</span>;
  const good = pct > 0 === goodWhenUp;
  return (
    <span className={`delta ${good ? "delta-good" : "delta-bad"}`}>
      <Icon name={pct > 0 ? "trendUp" : "trendDown"} size={14} />
      {pct > 0 ? "+" : "−"}{Math.abs(pct)}%<span className="sr-only"> on the previous 24 hours</span>
    </span>
  );
}

export function KpiTile({ icon, label, value, delta, to, linkLabel }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-icon"><Icon name={icon} size={18} /></span>
        {to && <Link to={to} className="round-link" aria-label={linkLabel}><Icon name="arrow" /></Link>}
      </div>
      <dd className="kpi-value">{value}</dd>
      <dt className="kpi-label">{label}</dt>
      {delta && <dd className="kpi-delta">{delta}</dd>}
    </div>
  );
}

// Column chart, stacked when given more than one series. rows: [{ label, values: { key: number } }]; series: [{ key, label, color }].
// The highlighted bar (hovered, or the latest) is solid; the rest are hatched, as in the reference dashboards.
export function Bars({ title, rows, series, format = String, height = 200, highlight = rows.length - 1, hideTitle = false }) {
  const [hover, setHover] = useState(null);
  const total = (r) => series.reduce((s, x) => s + (r.values[x.key] || 0), 0);
  const peak = Math.max(...rows.map(total), 0);
  const max = niceMax(peak);
  const active = hover ?? highlight;
  const ticks = [max, max / 2, 0];
  return (
    <figure className="chart">
      {!hideTitle && <figcaption className="chart-title">{title}</figcaption>}
      {series.length > 1 && (
        <ul className="legend" aria-hidden="true">
          {series.map((s) => <li key={s.key}><span className="swatch" style={{ background: s.color }} />{s.label}</li>)}
        </ul>
      )}
      <div className="plot" aria-hidden="true">
        <div className="y-axis" style={{ height }}>{ticks.map((t) => <span key={t}>{format(t)}</span>)}</div>
        <div className="bars" style={{ height }} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => <span key={t} className="gridline" style={{ bottom: `${(t / max) * 100}%` }} />)}
          {rows.map((r, i) => (
            <div key={r.label} className={`bar-col ${i === active ? "on" : ""}`} onMouseEnter={() => setHover(i)}>
              <div className="bar-stack" style={{ height: `${(total(r) / max) * 100}%` }}>
                {series.map((s) => r.values[s.key] > 0 && (
                  <div key={s.key} className={`bar-seg ${s.solid ? "solid" : ""}`} style={{ flexGrow: r.values[s.key], "--seg": s.color }} />
                ))}
              {i === active && (
                <div className={`tip ${i > rows.length * 0.6 ? "tip-left" : ""} ${i < rows.length * 0.2 ? "tip-right" : ""}`}>
                  <strong>{r.label}</strong>
                  {series.filter((s, k) => k === 0 || r.values[s.key]).map((s) => (
                    <span key={s.key}>{series.length > 1 && <span className="swatch" style={{ background: s.color }} />}{format(r.values[s.key] || 0)}</span>
                  ))}
                </div>
              )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 2. first, middle and last labels */}
      <div className="axis" aria-hidden="true">
        {[0, Math.floor((rows.length - 1) / 2), rows.length - 1].filter((v, i, a) => rows.length && a.indexOf(v) === i).map((i) => <span key={i}>{rows[i].label}</span>)}
      </div>
      <DataTable caption={title} rows={rows.map((r) => [r.label, ...series.map((s) => format(r.values[s.key] || 0))])}
        head={["", ...series.map((s) => s.label)]} />
    </figure>
  );
}

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((n) => n >= v);
};

// Segmented arc gauge (a 220° arc of rounded segments), as in the references' success-rate and quality-score cards.
export function Gauge({ value, label, sub, segments = 26 }) {
  const lit = value == null ? 0 : Math.round((value / 100) * segments);
  const start = -205, sweep = 230, r = 80, cx = 100, cy = 96;
  return (
    <div className="gauge">
      <svg viewBox="0 0 200 140" role="img" aria-label={value == null ? `${label}: no data yet` : `${label}: ${value}%`}>
        {Array.from({ length: segments }, (_, i) => {
          const a = ((start + (sweep * (i + 0.5)) / segments) * Math.PI) / 180;
          const x1 = cx + Math.cos(a) * (r - 10), y1 = cy + Math.sin(a) * (r - 10);
          const x2 = cx + Math.cos(a) * (r + 4), y2 = cy + Math.sin(a) * (r + 4);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={i < lit ? "seg-on" : "seg-off"} />;
        })}
      </svg>
      <div className="gauge-centre" aria-hidden="true">
        <span className="gauge-value">{value == null ? "–" : `${value}%`}</span>
        {sub && <span className="gauge-sub">{sub}</span>}
      </div>
    </div>
  );
}

// Weekly heatmap: rows are days, columns are hours (local time); five steps of one hue, as the dataviz rules require.
export function Heatmap({ buckets, title }) {
  const days = [], cells = {};
  for (const b of buckets) {
    const d = new Date(b.ts * 1000);
    const day = d.toLocaleDateString([], { weekday: "short" }), key = d.toDateString();
    if (!days.some((x) => x.key === key)) days.push({ key, day });
    cells[`${key}|${d.getHours()}`] = b.count;
  }
  // Steps by rank (quartiles of the busy hours), so one burst can't wash every other hour out to the lightest step.
  const busy = Object.values(cells).filter(Boolean).sort((a, b) => a - b);
  const q = [0.25, 0.5, 0.75].map((p) => busy[Math.floor(p * (busy.length - 1))] ?? 0);
  const step = (n) => (!n ? 0 : n <= q[0] ? 1 : n <= q[1] ? 2 : n <= q[2] ? 3 : 4);
  const busiest = Object.entries(cells).sort((a, b) => b[1] - a[1])[0];
  return (
    <figure className="heatmap">
      <div className="heat-grid" aria-hidden="true" style={{ gridTemplateColumns: `2.5rem repeat(24, 1fr)` }}>
        {days.slice(-7).map(({ key, day }) => (
          <div key={key} className="heat-row">
            <span className="heat-day">{day}</span>
            {Array.from({ length: 24 }, (_, h) => <span key={h} className={`heat-cell h${step(cells[`${key}|${h}`])}`} title={`${day} ${h}:00: ${cells[`${key}|${h}`] || 0}`} />)}
          </div>
        ))}
      </div>
      <div className="heat-foot" aria-hidden="true">
        <span>12 am</span><span>6 am</span><span>12 pm</span><span>6 pm</span><span>11 pm</span>
      </div>
      <figcaption className="heat-legend">
        <span className="sr-only">{title}. </span>
        {busiest && busiest[1] > 0 ? <>Busiest hour: {busiest[0].split("|")[0].slice(0, 3)} {busiest[0].split("|")[1]}:00, {busiest[1]} events.</> : "No activity yet."}
        <span className="heat-scale" aria-hidden="true">Less {[0, 1, 2, 3, 4].map((i) => <span key={i} className={`heat-cell h${i}`} />)} More</span>
      </figcaption>
    </figure>
  );
}

// A table shown on demand: the accessible and exact version of a chart.
export function DataTable({ caption, head, rows }) {
  return (
    <details className="table-toggle">
      <summary>Show as table</summary>
      <Table caption={caption} head={head} rows={rows} />
    </details>
  );
}

export function Table({ caption, head, rows, empty = "Nothing yet." }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j ? <td key={j}>{c}</td> : <th key={j} scope="row">{c}</th>))}</tr>)}</tbody>
      </table>
    </div>
  );
}
