import { useEffect, useState } from "react";

export default function Overview() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    fetch("/healthz").then((r) => r.json()).then(setHealth).catch(() => setHealth({ status: "unreachable" }));
  }, []);
  return (
    <section className="card" aria-labelledby="overview-title">
      <h1 id="overview-title">Overview</h1>
      <p className="muted">Mycelium server: <strong>{health ? health.status : "checking…"}</strong></p>
    </section>
  );
}
