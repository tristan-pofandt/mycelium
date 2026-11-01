// A small live map for the Overview: the same nodes, colours and pulses as the full map (Map.jsx), without interaction or labels.
// Decorative for assistive technology: the card around it links to the full map, which has the table view and keyboard navigation.
import { useEffect, useRef, useState } from "react";
import { useApi, useStream } from "../api.js";
import { reducedMotion } from "../reduced.js";
import { useTheme } from "../theme.js";
import { forceX, forceY } from "d3-force-3d";

const NODE_VAR = { file: "--text-muted", store: "--violet", endpoint: "--teal", external: "--orange", actor: "--text" };
const EVENT_VAR = { read: "--ev-read", write: "--ev-write", external: "--ev-external", cost: "--ev-external", request: "--ev-read", error: "--ev-error" };
const css = () => {
  const cs = getComputedStyle(document.documentElement);
  return (v) => cs.getPropertyValue(v).trim() || "#888888";
};
const endId = (e) => (typeof e === "object" ? e.id : e);

export default function MapPreview({ app }) {
  const [theme] = useTheme(); // colours are read once per theme
  const { data } = useApi("/api/graph", app);
  const box = useRef(null);
  const fg = useRef(null);
  const key = (a, id) => (app === "all" ? `${a}|${id}` : id);
  const seen = useRef([]); // event times in the last minute, for the caption
  const [recent, setRecent] = useState(0);
  useEffect(() => {
    const t = setInterval(() => { const cut = Date.now() - 60000; seen.current = seen.current.filter((x) => x > cut); setRecent(seen.current.length); }, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!data || !box.current) return;
    let gone = false;
    import("force-graph").then(({ default: ForceGraph }) => {
      if (gone || !box.current) return;
      const v = css();
      const degree = new Map();
      const links = data.edges.map((e) => ({ source: key(e.app, e.src), target: key(e.app, e.dst) }));
      for (const l of links) for (const id of [l.source, l.target]) degree.set(id, (degree.get(id) || 0) + 1);
      box.current.replaceChildren(); // a rebuild (theme or view change) must not stack a second canvas
      const g = new ForceGraph(box.current)
        .width(box.current.clientWidth).height(box.current.clientHeight)
        .backgroundColor("rgba(0,0,0,0)")
        .enablePointerInteraction(false).enableZoomInteraction(false).enablePanInteraction(false)
        .nodeRelSize(3.4).nodeVal((n) => 1 + Math.min(degree.get(n.id) || 0, 10) * 0.6)
        .nodeColor((n) => v(NODE_VAR[n.kind] || "--text-muted"))
        .linkColor(() => v("--text-faint")).linkWidth(1.2)
        .linkDirectionalParticleWidth(4.5).linkDirectionalParticleSpeed(0.02)
        .linkDirectionalParticleColor((l) => l.pulse || v("--accent-text"))
        .warmupTicks(120).cooldownTicks(0) // laid out before the first frame, so it fits at once and never drifts
        .onEngineStop(() => { if (!g._fit) { g._fit = true; g.zoomToFit(0, 30); } });
      g.d3Force("charge").strength(-30);
      g.d3Force("x", forceX(0).strength(0.12)); // keep separate clusters together, as on the full map
      g.d3Force("y", forceY(0).strength(0.12));
      g.graphData({ nodes: data.nodes.map((n) => ({ id: key(n.app, n.id), kind: n.kind })), links }); // forces first, so the warm-up uses them
      fg.current = g;
    });
    return () => { gone = true; fg.current?._destructor?.(); fg.current = null; };
  }, [data, app, theme]);

  useStream(app, (e) => {
    seen.current.push(Date.now());
    const g = fg.current;
    if (!g || reducedMotion()) return; // the card is decorative; under reduced motion it simply stays still
    const [a, b] = e.target ? [e.node, e.target] : [e.actor, e.node];
    if (!a || !b) return;
    const link = g.graphData().links.find((l) => endId(l.source) === key(e.app, a) && endId(l.target) === key(e.app, b));
    if (!link) return;
    link.pulse = css()(EVENT_VAR[e.status === "error" ? "error" : e.kind] || "--accent-text");
    g.emitParticle(link);
  });

  return (
    <>
      <div ref={box} className="map-preview" aria-hidden="true" />
      <p className="map-preview-caption">
        {data ? `${data.nodes.length} nodes, ${data.edges.length} connections · ${recent} ${recent === 1 ? "event" : "events"} in the last minute` : "Loading…"}
      </p>
    </>
  );
}
