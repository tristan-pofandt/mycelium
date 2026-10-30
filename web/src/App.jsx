import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { panelsFor } from "./panels/index.js";
import { DUR, EASE } from "./choreography.js";
import { useReducedMotion } from "./reduced.js";
import { useApi } from "./api.js";
import Palette from "./Palette.jsx";

// Capabilities of the selected app; "all" gets the union, so a panel shows when any app supports it.
const capsOf = (apps, slug) =>
  slug === "all" ? [...new Set(apps.flatMap((a) => a.capabilities))] : apps.find((a) => a.slug === slug)?.capabilities || [];

function Shell({ apps }) {
  const { app = "all", panel } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const visible = panelsFor(capsOf(apps, app));
  const current = visible.find((p) => p.id === panel);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  if (!current) return <Navigate to={`/${app}/${visible[0]?.id || "overview"}`} replace />;
  const Panel = current.component;
  const appName = app === "all" ? "All apps" : apps.find((a) => a.slug === app)?.name || app;
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Mycelium">
        <div className="brand">Mycelium</div>
        <label className="field-label" htmlFor="app-select">App</label>
        <select id="app-select" className="select" value={app} onChange={(e) => navigate(`/${e.target.value}/${current.id}`)}>
          <option value="all">All apps</option>
          {apps.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <button type="button" className="palette-hint" onClick={() => setPaletteOpen(true)}>
          Search <kbd>Ctrl</kbd> <kbd>K</kbd>
        </button>
        <ul className="nav-list" role="list">
          {visible.map((p) => (
            <li key={p.id}><NavLink to={`/${app}/${p.id}`} className="nav-item">{p.title}</NavLink></li>
          ))}
        </ul>
      </nav>
      <main className="content" id="main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: DUR.panelOut * 0.5 } }}
            transition={{ duration: DUR.panel, ease: EASE }}
          >
            <header className="page-head">
              <p className="eyebrow">{appName}</p>
              <h1>{current.title}</h1>
            </header>
            <Panel app={app} apps={apps} />
          </motion.div>
        </AnimatePresence>
      </main>
      {paletteOpen && <Palette apps={apps} app={app} panels={visible} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

export default function App() {
  const { data: apps, error } = useApi("/api/apps", "all", { refresh: 60 });
  if (!apps) return <p className="loading" role="status">{error ? "Mycelium's server can't be reached." : "Loading…"}</p>;
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/all/overview" replace />} />
      <Route path="/:app" element={<Shell apps={apps} />} />
      <Route path="/:app/:panel" element={<Shell apps={apps} />} />
    </Routes>
  );
}
