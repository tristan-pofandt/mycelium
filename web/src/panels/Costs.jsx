import { fmt, useApi } from "../api.js";
import { Skeleton } from "../ui.jsx";
import { Bars, Table } from "../charts.jsx";

const SERIES = [
  { key: "claude", label: "Claude Code", color: "var(--series-1)" },
  { key: "app", label: "App APIs", color: "var(--series-2)" },
];

export default function Costs({ app }) {
  const { data } = useApi("/api/costs", app, { refresh: 300 });
  if (!data) return <section className="card"><Skeleton height={220} lines={3} /></section>;
  const total = data.days.reduce((s, d) => s + d.claude + d.app, 0);
  return (
    <>
      <section className="card">
        <p className="lead">{fmt.usd(total)} in the last 30 days. App API costs are estimates from list prices.</p>
        {data.days.length ? (
          <Bars title="Cost per day (UTC)" series={SERIES} format={fmt.usd}
            rows={data.days.map((d) => ({ label: d.day, values: { claude: d.claude, app: d.app } }))} />
        ) : <p className="muted">No costs recorded yet.</p>}
      </section>
      <section className="card" aria-labelledby="models-h">
        <h2 id="models-h">Claude Code by model, 30 days</h2>
        <Table caption="Claude Code cost by model" head={["Model", "Cost"]} empty="No Claude Code telemetry yet."
          rows={data.claude_models.map((m) => [m.model, fmt.usd(m.usd)])} />
      </section>
      <section className="card" aria-labelledby="skus-h">
        <h2 id="skus-h">App APIs by SKU, 30 days</h2>
        <Table caption="App API cost by SKU" head={["API", "SKU", "Requests", "Cost"]} empty="No figures pulled from the app yet."
          rows={data.app_skus.map((s) => [s.api, s.sku, fmt.n(s.count), fmt.usd(s.usd)])} />
      </section>
    </>
  );
}
