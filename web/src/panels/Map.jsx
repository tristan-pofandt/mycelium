// Live map: every file, store, endpoint, external API and actor as a force-directed graph (force-graph on canvas). Each live event sends
// a pulse along its edge (read teal, write indigo, external orange, error red); with reduced motion the edge lights up briefly instead.
// Accessible equivalents: a table view, keyboard navigation between neighbours, and a polite live summary every 10 seconds.
import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, useApi, useStream } from "../api.js";
import { reducedMotion } from "../reduced.js";
import { DUR } from "../choreography.js";
import { Table } from "../charts.jsx";

const NODE_VAR = { file: "--text-faint", store: "--violet", endpoint: "--text-muted", external: "--orange", actor: "--text" }; // never a pulse colour, so nodes and pulses can't be confused
const EVENT_VAR = { read: "--ev-read", write: "--ev-write", external: "--ev-external", cost: "--ev-external", error: "--ev-error" };
const KIND_LABEL = { file: "File", store: "Data store", endpoint: "Endpoint", external: "External API", actor: "Actor" };
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#888";
const label = (id) => id.split(":").slice(1).join(":") || id;
const edgeOf = (e) => (e.target ? [e.node, e.target] : [e.actor, e.node]); // the same rule as the server (api/ingest.py)

function buildGraph(raw, app) {
  const key = (a, id) => (app === "all" ? `${a}|${id}` : id);
  const nodes = raw.nodes.map((n) => ({ id: key(n.app, n.id), raw: n.id, app: n.app, kind: n.kind, hits: n.hits, last_seen: n.last_seen }));
  const links = raw.edges.map((e) => ({ source: key(e.app, e.src), target: key(e.app, e.dst), kind: e.kind, hits: e.hits }));
  return { nodes, links, key };
}

export default function MapPanel({ app }) {
  const { data } = useApi("/api/graph", app);
  const [view, setView] = useState("graph");
  const [focus, setFocus] = useState(null);
  const [open, setOpen] = useState(null);
  const [summary, setSummary] = useState("");
  const box = useRef(null);
  const fg = useRef(null);
  const graph = useRef(null);
  const glow = useRef(new Map()); // link -> { until, color } for reduced motion
  const tally = useRef({});

  // (Re)build the graph when the data or app changes.
  useEffect(() => {
    if (!data || view !== "graph") return;
    let disposed = false;
    graph.current = buildGraph(data, app);
    import("force-graph").then(({ default: ForceGraph }) => {
      if (disposed || !box.current) return;
      const g = new ForceGraph(box.current)
        .backgroundColor("rgba(0,0,0,0)")
        .width(box.current.clientWidth).height(520)
        .nodeId("id").nodeLabel((n) => `${KIND_LABEL[n.kind] || n.kind}: ${n.raw}`)
        .nodeVal((n) => 1 + Math.log2(1 + (n.hits || 0)))
        .nodeColor((n) => css(NODE_VAR[n.kind] || "--text-muted"))
        .nodeRelSize(3)
        .cooldownTicks(120).onEngineStop(() => { if (!fg.current?._fitted) { fg.current._fitted = true; fg.current.zoomToFit(reducedMotion() ? 0 : 400, 60); } })
        .linkColor((l) => glow.current.get(l)?.until > performance.now() ? glow.current.get(l).color : css("--text-faint"))
        .linkWidth((l) => (glow.current.get(l)?.until > performance.now() ? 2.5 : 1))
        .linkDirectionalParticleColor((l) => l.pulse || css("--text-muted"))
        .linkDirectionalParticleWidth(5)
        .linkDirectionalParticleSpeed(0.012)
        .nodeCanvasObjectMode(() => "after")
        .nodeCanvasObject((n, ctx, scale) => {
          if (n.id === fg.current?._focus) {
            ctx.beginPath(); ctx.arc(n.x, n.y, 8, 0, 2 * Math.PI);
            ctx.strokeStyle = css("--accent-text"); ctx.lineWidth = 2 / scale; ctx.stroke();
          }
          if (scale > 2.2 || graph.current.nodes.length <= 60 || n.id === fg.current?._focus) {
            ctx.font = `${11 / scale}px Inter, system-ui, sans-serif`; ctx.fillStyle = css("--text-muted");
            ctx.fillText(label(n.raw).split("/").pop(), n.x + 6, n.y + 3);
          }
        })
        .onNodeClick((n) => { setFocus(n.id); setOpen(n.id); })
        .graphData({ nodes: graph.current.nodes, links: graph.current.links });
      fg.current = g;
    });
    const onResize = () => fg.current && box.current && fg.current.width(box.current.clientWidth);
    addEventListener("resize", onResize);
    return () => { disposed = true; removeEventListener("resize", onResize); fg.current?._destructor?.(); fg.current = null; };
  }, [data, app, view]);

  // Keep the focus ring and camera on the focused node.
  useEffect(() => {
    const g = fg.current;
    if (!g) return;
    g._focus = focus;
    const n = graph.current?.nodes.find((x) => x.id === focus);
    if (n && n.x != null) g.centerAt(n.x, n.y, reducedMotion() ? 0 : DUR.morph * 1000);
  }, [focus]);

  // Live events: pulse or glow along the edge; add nodes and edges first seen now.
  const connected = useStream(app, (e) => {
    tally.current[e.status === "error" ? "error" : e.kind] = (tally.current[e.status === "error" ? "error" : e.kind] || 0) + 1;
    const g = fg.current, G = graph.current;
    if (!g || !G) return;
    const [s, d] = edgeOf(e);
    if (!s || !d || s === d) return;
    const [src, dst] = [G.key(e.app, s), G.key(e.app, d)];    const { nodes, links } = g.graphData();
    let added = false;
    for (const [id, raw] of [[src, s], [dst, d]]) {
      if (!nodes.some((n) => n.id === id)) { nodes.push({ id, raw, app: e.app, kind: raw.split(":")[0], hits: 0 }); added = true; }
    }
    let link = links.find((l) => (l.source.id ?? l.source) === src && (l.target.id ?? l.target) === dst);
    if (!link) { link = { source: src, target: dst, kind: e.kind, hits: 0 }; links.push(link); added = true; }
    if (added) { g.graphData({ nodes, links }); G.nodes = nodes; G.links = links; } // d3 resolves link ends in place, so `link` stays valid
    const color = css(EVENT_VAR[e.status === "error" ? "error" : e.kind] || "--text-muted");
    if (reducedMotion()) {
      // force-graph pauses redraws once settled (particles keep it drawing, a colour change does not): one redraw now, one to clear
      glow.current.set(link, { until: performance.now() + 1200, color });
      g.linkColor(g.linkColor());
      setTimeout(() => fg.current?.linkColor(fg.current.linkColor()), 1250);
    } else {
      link.pulse = color;
      g.emitParticle(link);
    }
  });

  // A polite summary every 10 seconds instead of one announcement per event.
  useEffect(() => {
    const t = setInterval(() => {
      const c = tally.current;
      tally.current = {};
      const parts = [["read", "reads"], ["write", "writes"], ["external", "external calls"], ["request", "requests"], ["error", "errors"]]
        .filter(([k]) => c[k]).map(([k, w]) => `${c[k]} ${w}`);
      setSummary(parts.length ? `Last 10 seconds: ${parts.join(", ")}.` : "");
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const nodes = useMemo(() => (data ? buildGraph(data, app).nodes.sort((a, b) => a.raw.localeCompare(b.raw)) : []), [data, app]);
  const neighbours = (id) => {
    const ids = new Set();
    for (const l of graph.current?.links || []) {
      const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
      if (s === id) ids.add(t);
      if (t === id) ids.add(s);
    }
    return [...ids].sort();
  };
  const onKey = (e) => {
    if (!nodes.length) return;
    const i = nodes.findIndex((n) => n.id === focus);
    const nb = focus ? neighbours(focus) : [];
    let next = null;
    if (e.key === "ArrowDown") next = nodes[(i + 1) % nodes.length].id;
    else if (e.key === "ArrowUp") next = nodes[(i - 1 + nodes.length) % nodes.length].id;
    else if (e.key === "ArrowRight" && nb.length) next = nb[(nb.indexOf(focus) + 1) % nb.length];
    else if (e.key === "ArrowLeft" && nb.length) next = nb[(nb.length + nb.indexOf(focus) - 1) % nb.length];
    else if (e.key === "Enter" && focus) { e.preventDefault(); setOpen(focus); return; }
    else if (e.key === "Escape") { setOpen(null); return; }
    else return;
    e.preventDefault();
    setFocus(next);
  };

  const focused = nodes.find((n) => n.id === focus);
  const opened = nodes.find((n) => n.id === open);
  if (!data) return <p className="muted" role="status">Loading…</p>;
  return (
    <section className="card">
      <div className="toolbar">
        <div role="group" aria-label="View" className="segmented">
          <button type="button" aria-pressed={view === "graph"} onClick={() => setView("graph")}>Graph</button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
        </div>
        <label>Find <input className="select" list="map-nodes" placeholder="File, store or API"
          onChange={(e) => { const n = nodes.find((x) => x.raw === e.target.value); if (n) { setFocus(n.id); setOpen(n.id); } }} /></label>
        <datalist id="map-nodes">{nodes.map((n) => <option key={n.id} value={n.raw} />)}</datalist>
        <span className="muted">{connected ? "Live" : "Reconnecting…"}</span>
      </div>
      <ul className="legend">
        {Object.entries(KIND_LABEL).map(([k, l]) => <li key={k}><span className="swatch round" style={{ background: `var(${NODE_VAR[k]})` }} />{l}</li>)}
        <li><span className="swatch" style={{ background: "var(--ev-read)" }} />Read</li>
        <li><span className="swatch" style={{ background: "var(--ev-write)" }} />Write</li>
        <li><span className="swatch" style={{ background: "var(--ev-external)" }} />External</li>
        <li><span className="swatch" style={{ background: "var(--ev-error)" }} />Error</li>
      </ul>
      <p className="sr-only" aria-live="polite">{summary}</p>
      {!nodes.length && <p className="muted">Nothing on the map yet. Nodes appear as soon as the app or Claude Code reports activity.</p>}
      {view === "graph" && nodes.length > 0 && (
        <>
          <div ref={box} className="map" tabIndex={0} role="application" onKeyDown={onKey}
            aria-label="Activity map. Up and down arrows move through all nodes, left and right through the focused node's neighbours, Enter opens details."
            aria-describedby="map-focus" />
          <p id="map-focus" className="muted" aria-live="polite">
            {focused ? `${KIND_LABEL[focused.kind] || focused.kind}: ${focused.raw}, ${neighbours(focused.id).length} connections` : "Select the map and use the arrow keys, or click a node."}
          </p>
        </>
      )}
      {view === "table" && (
        <>
          <Table caption="Nodes" head={["Node", "Kind", ...(app === "all" ? ["App"] : []), "Activity", "Last seen"]}
            rows={nodes.map((n) => [
              <button key="b" type="button" className="link" onClick={() => setOpen(n.id)}>{n.raw}</button>,
              KIND_LABEL[n.kind] || n.kind, ...(app === "all" ? [n.app] : []), fmt.n(n.hits), n.last_seen ? fmt.ago(n.last_seen) : "–"])} />
          <h2>Connections</h2>
          <Table caption="Connections" head={["From", "To", "Kind", "Count"]}
            rows={data.edges.map((e) => [e.src, e.dst, e.kind, fmt.n(e.hits)])} />
        </>
      )}
      {opened && <NodeDetails node={opened} app={app} onClose={() => setOpen(null)} />}
    </section>
  );
}

function NodeDetails({ node, onClose }) {
  const { data } = useApi("/api/events", node.app, { params: { limit: 200 } });
  const mine = (data || []).filter((e) => e.node === node.raw || e.target === node.raw || e.actor === node.raw).slice(0, 20);
  return (
    <aside className="details" aria-labelledby="node-h">
      <div className="details-head">
        <h2 id="node-h">{node.raw}</h2>
        <button type="button" className="button" onClick={onClose}>Close</button>
      </div>
      <p className="muted">{KIND_LABEL[node.kind] || node.kind} · {fmt.n(node.hits)} events · {node.last_seen ? `last ${fmt.ago(node.last_seen)}` : "not seen yet"}</p>
      <Table caption={`Recent activity for ${node.raw}`} head={["Time", "Kind", "From", "To", "Status"]} empty="No recent events in the latest 200."
        rows={mine.map((e) => [fmt.time(e.ts), e.kind, label(e.target ? e.node : e.actor || ""), label(e.target || e.node || ""), e.status || ""])} />
    </aside>
  );
}
