// Live map, drawn the way Obsidian's graph view looks: small nodes sized by their connections, thin faint links, labels that fade
// in as you zoom, and hovering or focusing a node keeps it and its neighbours bright while the rest dims. Each live event sends a
// pulse along its edge (read teal, write indigo, external orange, error red) that ends in a ring on the node it reaches; with
// reduced motion the edge lights up briefly instead. Extras from Obsidian plugins: a local graph (neighbours to depth 1 or 2),
// filtering by kind from the legend, and dragging a node pins it.
// Accessible equivalents: a table view, keyboard navigation between neighbours, and a polite live summary every 10 seconds.
// Performance: colours are read from CSS once per theme (not per frame), and the canvas only redraws continuously while a pulse,
// ring or fade is on screen.
import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, useApi, useStream } from "../api.js";
import { reducedMotion } from "../reduced.js";
import { DUR, EASE } from "../choreography.js";
import { cubicBezier } from "framer-motion";
import { forceX, forceY } from "d3-force-3d"; // the same copy force-graph uses
import { Table } from "../charts.jsx";
import { Icon } from "../icons.jsx";
import { Skeleton, Tip, rovingKeys, useToast } from "../ui.jsx";

const KINDS = { file: "File", store: "Data store", endpoint: "Endpoint", external: "External API", actor: "Actor" };
const NODE_VAR = { file: "--text-muted", store: "--violet", endpoint: "--teal", external: "--orange", actor: "--text" };
const EVENT_VAR = { read: "--ev-read", write: "--ev-write", external: "--ev-external", cost: "--ev-external", request: "--ev-read", error: "--ev-error" };
const PULSE_MS = 700, RING_MS = 600, MAX_PULSES = 200, DIM = 0.12;
const AMBIENT_MS = 60000, FLOW_MS = 2600, MAX_AMBIENT = 60; // ambient flow: how long an edge keeps flowing, one trip, how many at once
const ease = cubicBezier(...EASE);
const label = (id) => id.split(":").slice(1).join(":") || id;
const short = (id) => label(id).split("/").filter(Boolean).pop() || label(id);
const edgeOf = (e) => (e.target ? [e.node, e.target] : [e.actor, e.node]); // the same rule as the server (api/ingest.py)
const endId = (end) => (typeof end === "object" ? end.id : end);

function rgba(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => cs.getPropertyValue(name).trim() || "#888888";
  return {
    node: Object.fromEntries(Object.entries(NODE_VAR).map(([k, n]) => [k, v(n)])),
    event: Object.fromEntries(Object.entries(EVENT_VAR).map(([k, n]) => [k, v(n)])),
    link: v("--text-faint"), accent: v("--accent-text"), text: v("--text"), muted: v("--text-muted"), font: v("--font"),
  };
}

function buildGraph(raw, app) {
  const key = (a, id) => (app === "all" ? `${a}|${id}` : id);
  const nodes = raw.nodes.map((n) => ({ id: key(n.app, n.id), raw: n.id, app: n.app, kind: n.kind, hits: n.hits, last_seen: n.last_seen }));
  const links = raw.edges.map((e) => ({ source: key(e.app, e.src), target: key(e.app, e.dst), kind: e.kind, hits: e.hits }));
  return { nodes, links, key };
}

function adjacency(links) {
  const adj = new Map();
  const add = (a, b) => (adj.get(a) || adj.set(a, new Set()).get(a)).add(b);
  for (const l of links) { const s = endId(l.source), t = endId(l.target); add(s, t); add(t, s); }
  return adj;
}

function within(adj, start, depth) {
  const seen = new Set([start]);
  let frontier = [start];
  for (let d = 0; d < depth; d++) frontier = frontier.flatMap((id) => [...(adj.get(id) || [])].filter((n) => !seen.has(n) && seen.add(n)));
  return seen;
}

export default function MapPanel({ app }) {
  const { data } = useApi("/api/graph", app);
  const [view, setView] = useState("graph");
  const [focus, setFocus] = useState(null);
  const [open, setOpen] = useState(null);
  const [summary, setSummary] = useState("");
  const [hidden, setHidden] = useState(() => new Set());
  const [local, setLocal] = useState(0); // 0 = whole graph, 1 or 2 = neighbours of the focused node to that depth
  const [pinned, setPinned] = useState(0);
  const box = useRef(null);
  const fg = useRef(null);
  const graph = useRef(null);
  const s = useRef({ pal: null, adj: new Map(), hover: null, focus: null, lit: null, litLast: null, fadeFrom: 0, visible: null, hidden: new Set(),
    pulses: [], rings: [], glow: new Map(), recent: new Set(), busyUntil: 0 }).current;
  const tally = useRef({});

  // Keep the canvas drawing for `ms` (a fade or glow); pulses and rings keep it drawing on their own.
  const kick = (ms) => { s.busyUntil = Math.max(s.busyUntil, performance.now() + ms); fg.current?.autoPauseRedraw(false); };
  const refresh = () => { const g = fg.current; if (g) { g.nodeVisibility(g.nodeVisibility()); kick(50); } };

  // Which nodes are highlighted: the hovered one (or the keyboard focus) and its neighbours.
  const relight = () => {
    const centre = s.hover || s.focus;
    const next = centre ? new Set([centre, ...(s.adj.get(centre) || [])]) : null;
    if (!next !== !s.lit) s.fadeFrom = performance.now(); // highlight appearing or going: fade; moving between nodes: swap at once
    s.lit = next;
    if (next) s.litLast = next; // kept so a fade-out still knows what it is fading from
    kick(DUR.hover * 1000 + 50);
  };
  // 0 = nothing highlighted, 1 = fully dimmed around the highlight; eased over the hover duration.
  const dimK = () => {
    const t = Math.min(1, (performance.now() - s.fadeFrom) / (DUR.hover * 1000 || 1));
    const k = ease(reducedMotion() ? 1 : t);
    return s.lit ? k : 1 - k;
  };

  useEffect(() => {
    s.pal = readPalette();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onTheme = () => { s.pal = readPalette(); refresh(); };
    const mo = new MutationObserver(onTheme); // the header's theme toggle sets html[data-theme]
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    mq.addEventListener?.("change", onTheme);
    return () => { mo.disconnect(); mq.removeEventListener?.("change", onTheme); };
  }, []);

  useEffect(() => {
    if (!data || view !== "graph") return;
    let disposed = false;
    graph.current = buildGraph(data, app);
    s.adj = adjacency(graph.current.links);
    import("force-graph").then(({ default: ForceGraph }) => {
      if (disposed || !box.current) return;
      const P = () => s.pal;
      const shown = (n) => !s.hidden.has(n.kind) && (!s.visible || s.visible.has(n.id));
      const degree = (n) => s.adj.get(n.id)?.size || 0;
      const radius = (n) => Math.sqrt(1 + Math.min(degree(n), 12) * 0.9) * 2.6; // larger, softer nodes than Obsidian's (Node Flow)
      box.current.replaceChildren(); // a rebuild (theme or view change) must not stack a second canvas
      const g = new ForceGraph(box.current)
        .backgroundColor("rgba(0,0,0,0)")
        .width(box.current.clientWidth).height(box.current.clientHeight)
        .nodeId("id").nodeLabel(() => "") // labels are drawn on the canvas; details live in the side panel and table
        .nodeRelSize(2.6)
        .nodeVal((n) => 1 + Math.min(degree(n), 12) * 0.9)
        .nodeVisibility(shown)
        .linkVisibility((l) => shown(typeof l.source === "object" ? l.source : { id: l.source, kind: "" }) && shown(typeof l.target === "object" ? l.target : { id: l.target, kind: "" }))
        .nodeCanvasObjectMode(() => "replace")
        .nodeCanvasObject((n, ctx, scale) => {
          const k = dimK(), lit = s.lit || s.litLast, on = !lit || lit.has(n.id);
          const r = radius(n);
          const col = P().node[n.kind] || P().muted;
          ctx.globalAlpha = on ? 1 : 1 - (1 - DIM) * k;
          ctx.beginPath(); ctx.arc(n.x, n.y, r + 1.6, 0, 2 * Math.PI); ctx.fillStyle = rgba(col, 0.18); ctx.fill(); // soft halo (Node Flow)
          ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fillStyle = col; ctx.fill();
          if (n.fx != null) { ctx.lineWidth = 1 / scale; ctx.strokeStyle = P().muted; ctx.stroke(); } // pinned
          if (n.id === s.focus) { ctx.beginPath(); ctx.arc(n.x, n.y, r + 3, 0, 2 * Math.PI); ctx.lineWidth = 1.5 / scale; ctx.strokeStyle = P().accent; ctx.stroke(); }
          // Labels fade in with zoom, like Obsidian's text fade threshold; highlighted nodes always show theirs.
          const zoomA = Math.min(1, Math.max(0, (scale - 0.9) / 0.9));
          const a = lit && lit.has(n.id) && k > 0 ? Math.max(zoomA, k) : on ? zoomA : zoomA * (1 - (1 - DIM) * k);
          if (a > 0.02) {
            const px = 11 / Math.max(scale, 0.8);
            ctx.globalAlpha = a; ctx.font = `${px}px ${P().font}`; ctx.textAlign = "center"; ctx.textBaseline = "top";
            ctx.fillStyle = n.id === s.hover || n.id === s.focus ? P().text : P().muted;
            ctx.fillText(short(n.raw), n.x, n.y + r + 2 / scale);
          }
          ctx.globalAlpha = 1;
        })
        .nodePointerAreaPaint((n, color, ctx) => {
          const r = radius(n) + 3; // a hit target bigger than the dot
          ctx.fillStyle = color; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fill();
        })
        .linkColor((l) => {
          const glow = s.glow.get(l);
          if (glow && glow.until > performance.now()) return glow.color;
          const lit = s.lit || s.litLast, k = dimK();
          const touches = lit && (endId(l.source) === (s.hover || s.focus) || endId(l.target) === (s.hover || s.focus));
          if (touches && k > 0) return rgba(P().accent, 0.35 + 0.55 * k);
          return rgba(P().link, lit ? 0.45 - 0.37 * k : 0.45);
        })
        .linkWidth((l) => (s.glow.get(l)?.until > performance.now() ? 2.5 : 1))
        .linkDirectionalArrowLength(2.5).linkDirectionalArrowRelPos(1)
        .onNodeHover((n) => { s.hover = n?.id || null; box.current && (box.current.style.cursor = n ? "pointer" : ""); relight(); })
        .onNodeClick((n) => { setFocus(n.id); setOpen(n.id); })
        .onNodeDragEnd((n) => { n.fx = n.x; n.fy = n.y; setPinned((c) => c + 1); })
        .onRenderFramePost((ctx, scale) => {
          const now = performance.now();
          // Ambient flow (Node Flow): edges active in the last minute keep a faint, slow dot travelling along them, fading as the
          // activity ages, so recent traffic reads at a glance between events. Capped, and off under reduced motion.
          let ambient = 0;
          if (!reducedMotion()) {
            for (const l of s.recent) {
              const age = now - l.lastAt;
              if (age > AMBIENT_MS || l.source.x == null) { s.recent.delete(l); continue; }
              if (++ambient > MAX_AMBIENT) break;
              const a = l.source, b = l.target, alpha = 0.55 * (1 - age / AMBIENT_MS);
              for (const phase of [0, 0.5]) {
                const t = ((now / FLOW_MS + phase + (l.seed || 0)) % 1);
                ctx.fillStyle = rgba(l.lastColor, alpha); ctx.beginPath();
                ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 1.3 / Math.sqrt(scale), 0, 2 * Math.PI); ctx.fill();
              }
            }
          }
          // Pulses: one crisp dot per event, eased along the edge (canvas shadowBlur is costly, and Node Flow's dots are plain).
          s.pulses = s.pulses.filter((p) => {
            const t = (now - p.t0) / PULSE_MS;
            if (t >= 1) { s.rings.push({ node: p.link.target, color: p.color, t0: now }); return false; }
            const { source: a, target: b } = p.link;
            if (a.x == null || b.x == null) return false;
            const e = ease(t), x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, 2.4 / Math.sqrt(scale), 0, 2 * Math.PI); ctx.fill();
            return true;
          });
          // Rings: the node that was read, written or called breathes out once.
          s.rings = s.rings.filter((r) => {
            const t = (now - r.t0) / RING_MS;
            if (t >= 1 || r.node.x == null) return false;
            ctx.strokeStyle = rgba(r.color, 0.6 * (1 - t)); ctx.lineWidth = 1.5 / scale;
            ctx.beginPath(); ctx.arc(r.node.x, r.node.y, 4 + 10 * ease(t), 0, 2 * Math.PI); ctx.stroke();
            return true;
          });
          if (!s.pulses.length && !s.rings.length && !ambient && now > s.busyUntil) g.autoPauseRedraw(true);
        })
        .cooldownTicks(150)
        .onEngineStop(() => { if (!g._fitted) { g._fitted = true; g.zoomToFit(reducedMotion() ? 0 : DUR.morph * 1000, 48); } })
        .graphData({ nodes: graph.current.nodes, links: graph.current.links });
      // Obsidian-like forces: gentle repulsion, short links, and a pull to the centre so separate clusters stay close together.
      g.d3Force("charge").strength(-45);
      g.d3Force("link").distance(28);
      g.d3Force("x", forceX(0).strength(0.07));
      g.d3Force("y", forceY(0).strength(0.07));
      fg.current = g;
    });
    const ro = new ResizeObserver(() => fg.current && box.current && fg.current.width(box.current.clientWidth).height(box.current.clientHeight));
    if (box.current) ro.observe(box.current);
    return () => { disposed = true; ro.disconnect(); fg.current?._destructor?.(); fg.current = null; };
  }, [data, app, view]);

  // Kind filters and the local graph change which nodes are shown.
  useEffect(() => {
    s.hidden = hidden;
    s.visible = local && focus ? within(s.adj, focus, local) : null;
    refresh();
  }, [hidden, local, focus]);

  // Keyboard focus highlights like a hover and keeps the camera on the node.
  useEffect(() => {
    s.focus = focus;
    relight();
    const g = fg.current, n = graph.current?.nodes.find((x) => x.id === focus);
    if (g && n && n.x != null) g.centerAt(n.x, n.y, reducedMotion() ? 0 : DUR.morph * 1000);
  }, [focus]);

  const connected = useStream(app, (e) => {
    const kind = e.status === "error" ? "error" : e.kind;
    tally.current[kind] = (tally.current[kind] || 0) + 1;
    const g = fg.current, G = graph.current;
    if (!g || !G || !s.pal) return;
    const [a, b] = edgeOf(e);
    if (!a || !b || a === b) return;
    const [src, dst] = [G.key(e.app, a), G.key(e.app, b)];
    const { nodes, links } = g.graphData();
    let added = false;
    for (const [id, raw] of [[src, a], [dst, b]]) {
      if (!nodes.some((n) => n.id === id)) { nodes.push({ id, raw, app: e.app, kind: raw.split(":")[0], hits: 0 }); added = true; }
    }
    let link = links.find((l) => endId(l.source) === src && endId(l.target) === dst);
    if (!link) { link = { source: src, target: dst, kind: e.kind, hits: 0 }; links.push(link); added = true; }
    if (added) { g.graphData({ nodes, links }); G.nodes = nodes; G.links = links; s.adj = adjacency(links); } // d3 resolves link ends in place
    const color = s.pal.event[kind] || s.pal.muted;
    link.lastAt = performance.now(); link.lastColor = color; link.seed ??= Math.random(); // feeds the ambient flow
    s.recent.add(link);
    if (reducedMotion()) {
      s.glow.set(link, { until: performance.now() + 1200, color });
      kick(1300);
    } else if (s.pulses.length < MAX_PULSES) {
      s.pulses.push({ link, color, t0: performance.now() });
      g.autoPauseRedraw(false);
    }
  });

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
  const visibleNodes = nodes.filter((n) => !hidden.has(n.kind) && (!s.visible || s.visible.has(n.id)));
  const neighbours = (id) => [...(s.adj.get(id) || [])].sort();
  const onKey = (e) => {
    if (!visibleNodes.length) return;
    const i = visibleNodes.findIndex((n) => n.id === focus);
    const nb = focus ? neighbours(focus).filter((id) => visibleNodes.some((n) => n.id === id)) : [];
    let next = null;
    if (e.key === "ArrowDown") next = visibleNodes[(i + 1) % visibleNodes.length].id;
    else if (e.key === "ArrowUp") next = visibleNodes[(i - 1 + visibleNodes.length) % visibleNodes.length].id;
    else if (e.key === "ArrowRight" && nb.length) next = nb[(nb.indexOf(focus) + 1) % nb.length];
    else if (e.key === "ArrowLeft" && nb.length) next = nb[(nb.length + nb.indexOf(focus) - 1) % nb.length];
    else if (e.key === "Enter" && focus) { e.preventDefault(); setOpen(focus); return; }
    else if (e.key === "Escape") { setOpen(null); setFocus(null); return; }
    else return;
    e.preventDefault();
    setFocus(next);
  };
  const toggleKind = (k) => setHidden((h) => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const unpin = () => { for (const n of fg.current?.graphData().nodes || []) { n.fx = n.fy = undefined; } fg.current?.d3ReheatSimulation(); setPinned(0); };

  const focused = nodes.find((n) => n.id === focus);
  const opened = nodes.find((n) => n.id === open);
  if (!data) return <section className="card"><Skeleton height={220} lines={3} /></section>;
  return (
    <section className="card map-card" aria-label="Activity map">
      <div className="toolbar">
        <div role="group" aria-label="View" className="segmented" onKeyDown={(e) => rovingKeys(e, "button")}>
          <button type="button" aria-pressed={view === "graph"} onClick={() => setView("graph")}>Graph</button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
        </div>
        <label>Find <input className="select" list="map-nodes" placeholder="File, store or API"
          onChange={(e) => { const n = nodes.find((x) => x.raw === e.target.value); if (n) { setFocus(n.id); setOpen(n.id); } }} /></label>
        <datalist id="map-nodes">{nodes.map((n) => <option key={n.id} value={n.raw} />)}</datalist>
        <label>Show <select className="select" value={local} onChange={(e) => setLocal(Number(e.target.value))} disabled={!focus}
          aria-describedby="local-hint">
          <option value={0}>Whole map</option><option value={1}>Neighbours of the selected node</option><option value={2}>Two steps out</option>
        </select></label>
        {pinned > 0 && <button type="button" className="button" onClick={unpin}>Release pinned nodes</button>}
        <span className="live" role="status"><span className={`live-dot ${connected ? "on" : ""}`} aria-hidden="true" />{connected ? "Live" : "Reconnecting…"}</span>
      </div>
      <p id="local-hint" className="sr-only">Select a node first to show only its neighbours.</p>
      <div className="map-legend">
        <div role="group" aria-label="Show node kinds" className="chips">
          {Object.entries(KINDS).map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={!hidden.has(k)} onClick={() => toggleKind(k)}>
              <span className="swatch round" style={{ background: `var(${NODE_VAR[k]})` }} />{l}
            </button>
          ))}
        </div>
        <ul className="legend" aria-label="Pulse colours">
          <li><span className="swatch line" style={{ background: "var(--ev-read)" }} />Read</li>
          <li><span className="swatch line" style={{ background: "var(--ev-write)" }} />Write</li>
          <li><span className="swatch line" style={{ background: "var(--ev-external)" }} />External</li>
          <li><span className="swatch line" style={{ background: "var(--ev-error)" }} />Error</li>
        </ul>
      </div>
      <p className="sr-only" aria-live="polite">{summary}</p>
      {!nodes.length && <p className="muted">Nothing on the map yet. Nodes appear as soon as the app or Claude Code reports activity.</p>}
      {view === "graph" && nodes.length > 0 && (
        <>
          <div ref={box} className="map" tabIndex={0} role="application" onKeyDown={onKey}
            aria-label="Activity map. Up and down arrows move through all nodes, left and right through the selected node's neighbours, Enter opens details, Escape clears."
            aria-describedby="map-focus" />
          <p id="map-focus" className="map-caption" aria-live="polite">
            {focused ? <><strong>{short(focused.raw)}</strong> · {KINDS[focused.kind] || focused.kind} · {neighbours(focused.id).length} connections</>
              : "Hover a node to see its connections, or select the map and use the arrow keys. Drag a node to pin it."}
          </p>
        </>
      )}
      {view === "table" && (
        <>
          <Table caption="Nodes" head={["Node", "Kind", ...(app === "all" ? ["App"] : []), "Activity", "Last seen"]}
            rows={visibleNodes.map((n) => [
              <button key="b" type="button" className="link" onClick={() => setOpen(n.id)}>{n.raw}</button>,
              KINDS[n.kind] || n.kind, ...(app === "all" ? [n.app] : []), fmt.n(n.hits), n.last_seen ? fmt.ago(n.last_seen) : "–"])} />
          <h2>Connections</h2>
          <Table caption="Connections" head={["From", "To", "Kind", "Count"]}
            rows={data.edges.map((e) => [e.src, e.dst, e.kind, fmt.n(e.hits)])} />
        </>
      )}
      {opened && <NodeDetails node={opened} onClose={() => setOpen(null)} />}
    </section>
  );
}

function NodeDetails({ node, onClose }) {
  const { data } = useApi("/api/events", node.app, { params: { limit: 200 } });
  const toast = useToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(node.raw); toast({ tone: "good", title: "Path copied." }); }
    catch { toast({ tone: "bad", title: "The browser didn't allow copying." }); }
  };
  const mine = (data || []).filter((e) => e.node === node.raw || e.target === node.raw || e.actor === node.raw).slice(0, 20);
  return (
    <aside className="details" aria-labelledby="node-h">
      <div className="details-head">
        <h2 id="node-h">{node.raw}</h2>
        <div className="actions">
          <Tip label="Copy path" describe={false}><button type="button" className="icon-button" onClick={copy} aria-label="Copy path"><Icon name="copy" /></button></Tip>
          <Tip label="Close details" describe={false}><button type="button" className="icon-button" onClick={onClose} aria-label="Close details"><Icon name="close" /></button></Tip>
        </div>
      </div>
      <p className="muted">{KINDS[node.kind] || node.kind} · {fmt.n(node.hits)} events · {node.last_seen ? `last ${fmt.ago(node.last_seen)}` : "not seen yet"}</p>
      <Table caption={`Recent activity for ${node.raw}`} head={["Time", "Kind", "From", "To", "Status"]} empty="No recent events in the latest 200."
        rows={mine.map((e) => [fmt.time(e.ts), e.kind, label(e.target ? e.node : e.actor || ""), label(e.target || e.node || ""), e.status || ""])} />
    </aside>
  );
}
