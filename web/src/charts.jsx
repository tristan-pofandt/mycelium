// Chart pieces built from plain elements (no chart library), in the dashboard style of DESIGN.md: hatched bars with one solid
// accent bar, a segmented arc gauge, a weekly heatmap and icon KPI tiles. Every piece has an exact text or table equivalent.
// Colours: tokens in tokens.css (series validated for CVD and contrast); text always wears text tokens, never a series colour.
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { animate } from "framer-motion";
import { Icon } from "./icons.jsx";
import { EmptyState, Tip } from "./ui.jsx";
import { EASE, slow } from "./choreography.js";
import { reducedMotion } from "./reduced.js";

const COUNT_S = 1.1; // count-up length: long enough to read as a climb, short enough not to delay the number

// A number that climbs to its value when the page opens, and glides from old to new when the data refreshes.
// It writes straight to the text node (no re-render per frame); assistive technology reads only the final value.
// `delay` (seconds) lines the first climb up with its tile's entrance; refreshes glide at once.
export function CountUp({ value, format = String, delay = 0 }) {
  const ref = useRef(null);
  const from = useRef(0);
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (value == null || !el) return undefined;
    const start = from.current;
    from.current = value;
    const places = (String(value).split(".")[1] || "").length; // never show more decimals than the real value has
    const show = (v) => { el.textContent = format(Number(v.toFixed(places))); };
    if (reducedMotion() || start === value) { show(value); return undefined; }
    show(start); // before the first paint, so the final value never flashes first
    const c = animate(start, value, { duration: COUNT_S * slow(), delay: (first.current ? delay : 0) * slow(), ease: EASE, onUpdate: show });
    first.current = false;
    return () => c.stop();
  }, [value]);
  return (
    <>
      <span ref={ref} aria-hidden="true">{value == null ? "–" : format(value)}</span>
      <span className="sr-only">{value == null ? "No data" : format(value)}</span>
    </>
  );
}

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
        {to && <Tip label={linkLabel} describe={false}><Link to={to} className="round-link" aria-label={linkLabel}><Icon name="arrow" /></Link></Tip>}
      </div>
      <dd className="kpi-value">{value}</dd>
      <dt className="kpi-label">{label}</dt>
      {delta && <dd className="kpi-delta"><Tip label="Change on the previous 24 hours" describe={false}><span className="delta-wrap" tabIndex={-1}>{delta}</span></Tip></dd>}
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
        <span className="gauge-value"><CountUp value={value} format={(v) => `${v}%`} delay={0.45} /></span>
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

// Tables sort by any column whose cells are plain values (or by `keys`, one sortable value per cell, when cells are elements).
// Sort headers are buttons with aria-sort; rows tint on hover; an empty table shows an empty state instead.
export function Table({ caption, head, rows, keys, empty = "Nothing yet.", emptyText, sortable = true }) {
  const [sort, setSort] = useState(null); // { col, dir: 1 | -1 }
  if (!rows.length) return <EmptyState title={empty}>{emptyText}</EmptyState>;
  const val = (r, i, c) => { const k = keys?.[i]?.[c]; const v = k !== undefined ? k : r[c]; return typeof v === "number" || typeof v === "string" ? v : null; };
  const canSort = (c) => sortable && rows.every((r, i) => val(r, i, c) !== null);
  const order = rows.map((r, i) => i);
  if (sort) {
    const num = (v) => (typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, "")));
    const one = /^[A-Za-z$]*\s?-?[\d,]+(\.\d+)?\s?[a-z%]*$/; // a single number with an optional unit: 235 ms, US$0.02, 94%
    const numeric = rows.every((r, i) => typeof val(r, i, sort.col) === "number" || one.test(String(val(r, i, sort.col))));
    order.sort((a, b) => {
      const x = val(rows[a], a, sort.col), y = val(rows[b], b, sort.col);
      return sort.dir * (numeric ? num(x) - num(y) : String(x).localeCompare(String(y)));
    });
  }
  const click = (c) => setSort((s) => (s?.col === c ? (s.dir === 1 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 }));
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{head.map((h, c) => {
          const dir = sort?.col === c ? (sort.dir === 1 ? "ascending" : "descending") : undefined;
          return (
            <th key={c} scope="col" aria-sort={dir}>
              {h && canSort(c) ? (
                <button type="button" className="sort" onClick={() => click(c)}>
                  {h}<Icon name={dir === "ascending" ? "sortUp" : dir === "descending" ? "sortDown" : "sort"} size={13} />
                </button>
              ) : h}
            </th>
          );
        })}</tr></thead>
        <tbody>{order.map((i) => <tr key={i}>{rows[i].map((c, j) => (j ? <td key={j}>{c}</td> : <th key={j} scope="row">{c}</th>))}</tr>)}</tbody>
      </table>
    </div>
  );
}
