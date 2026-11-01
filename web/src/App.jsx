import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { panelsFor } from "./panels/index.js";
import { DUR, EASE } from "./choreography.js";
import { useReducedMotion } from "./reduced.js";
import { useApi } from "./api.js";
import Palette from "./Palette.jsx";
import Login from "./Login.jsx";
import { Icon, Logo } from "./icons.jsx";
import { useTheme } from "./theme.js";
import { StatusBadge } from "./panels/Status.jsx";

// Capabilities of the selected app; "all" gets the union, so a panel shows when any app supports it.
const capsOf = (apps, slug) =>
  slug === "all" ? [...new Set(apps.flatMap((a) => a.capabilities))] : apps.find((a) => a.slug === slug)?.capabilities || [];

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="icon-button" onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}

// The state of the selected app (or the worst of all apps), always in the header.
function overall(apps, slug) {
  const shown = slug === "all" ? apps : apps.filter((a) => a.slug === slug);
  if (shown.some((a) => a.status === "down")) return "down";
  return shown.length && shown.every((a) => a.status === "up") ? "up" : null;
}

function Shell({ apps }) {
  const { app = "all", panel } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const visible = panelsFor(capsOf(apps, app));
  const current = visible.find((p) => p.id === panel);

  // On narrow screens the pill row scrolls: keep the current tab in view.
  useEffect(() => { document.querySelector(".pill.active")?.scrollIntoView?.({ block: "nearest", inline: "center" }); }, [panel]);

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
  const nav = visible.filter((p) => p.place !== "tools");
  const tools = visible.filter((p) => p.place === "tools");
  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="topbar">
        <div className="topbar-start">
          <NavLink to={`/${app}/overview`} className="brand" aria-label="Mycelium, overview"><Logo /><span>Mycelium</span></NavLink>
          <label className="sr-only" htmlFor="app-select">App</label>
          <div className="picker">
            <select id="app-select" value={app} onChange={(e) => navigate(`/${e.target.value}/${current.id}`)}>
              <option value="all">All apps</option>
              {apps.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
            </select>
            <Icon name="chevron" />
          </div>
        </div>
        <nav className="pills" aria-label="Panels">
          <ul role="list">
            {nav.map((p) => (
              <li key={p.id}>
                <NavLink to={`/${app}/${p.id}`} className="pill"><Icon name={p.icon} /><span>{p.short}</span></NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="topbar-end">
          <NavLink to={`/${app}/status`} className="status-pill" aria-label={`Status: ${({ up: "healthy", down: "down" })[overall(apps, app)] || "not checked yet"}. Open status and uptime`}>
            <StatusBadge status={overall(apps, app)} words={{ up: "Healthy" }} />
          </NavLink>
          <button type="button" className="icon-button search-button" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K"
            aria-label="Go to an app or panel (Ctrl+K)">
            <Icon name="search" /><kbd aria-hidden="true">Ctrl K</kbd>
          </button>
          <ThemeToggle />
          {tools.map((p) => (
            <NavLink key={p.id} to={`/${app}/${p.id}`} className="icon-button" aria-label={p.title} title={p.title}><Icon name={p.icon} /></NavLink>
          ))}
        </div>
      </header>
      <main className="content" id="main" tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: DUR.panelOut * 0.5 } }}
            transition={{ duration: DUR.panel, ease: EASE }}
          >
            {current.id !== "overview" && (
              <div className="page-head">
                <h1>{current.title}<span className="h1-scope"><span className="sr-only">, </span>{appName}</span></h1>
              </div>
            )}
            <Panel app={app} apps={apps} appName={appName} />
          </motion.div>
        </AnimatePresence>
      </main>
      {paletteOpen && <Palette apps={apps} app={app} panels={visible} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

export default function App() {
  const me = useApi("/api/me", "all");
  if (!me.data) return <p className="loading" role="status">{me.error ? "Mycelium's server can't be reached." : "Loading…"}</p>;
  if (!me.data.owner) return <Login password={me.data.password} onDone={me.reload} />;
  return <SignedIn />;
}

function SignedIn() {
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
