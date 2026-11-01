// Small chart pieces built from plain elements (no chart library). Each has a table equivalent for screen readers and keyboard users.
// Colours: series tokens in tokens.css (validated for CVD and contrast on both surfaces); text always wears text tokens.
import { useState } from "react";

export function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <dt className="stat-label">{label}</dt>
      <dd className="stat-value">{value}</dd>
      {note && <dd className="stat-note">{note}</dd>}
    </div>
  );
}

// Column chart, stacked when given more than one series. rows: [{ label, values: { key: number } }]; series: [{ key, label, color }].
export function Bars({ title, rows, series, format = String, height = 160 }) {
  const [hover, setHover] = useState(null);
  const total = (r) => series.reduce((s, x) => s + (r.values[x.key] || 0), 0);
  const max = Math.max(...rows.map(total), 0) || 1;
  return (
    <figure className="chart">
      <figcaption className="chart-title">{title}</figcaption>
      {series.length > 1 && (
        <ul className="legend" aria-hidden="true">
          {series.map((s) => <li key={s.key}><span className="swatch" style={{ background: s.color }} />{s.label}</li>)}
        </ul>
      )}
      <div className="bars" style={{ height }} aria-hidden="true" onMouseLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <div key={r.label} className="bar-col" onMouseEnter={() => setHover(i)}>
            <div className="bar-stack" style={{ height: `${(total(r) / max) * 100}%` }}>
              {series.map((s) => r.values[s.key] > 0 && (
                <div key={s.key} className="bar-seg" style={{ flexGrow: r.values[s.key], background: s.color }} />
              ))}
            </div>
            {hover === i && (
              <div className={`tip ${i > rows.length / 2 ? "tip-left" : ""}`}>
                <strong>{r.label}</strong>
                {series.map((s) => <div key={s.key}>{series.length > 1 && `${s.label}: `}{format(r.values[s.key] || 0)}</div>)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="axis" aria-hidden="true"><span>{rows[0]?.label}</span><span>{rows.at(-1)?.label}</span></div>
      <DataTable caption={title} rows={rows.map((r) => [r.label, ...series.map((s) => format(r.values[s.key] || 0))])}
        head={["", ...series.map((s) => s.label)]} />
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
