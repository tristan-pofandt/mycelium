import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { panelsFor } from "./panels/index.js";
import { useReducedMotion } from "./reduced.js";
import { useApi } from "./api.js";
import Palette from "./Palette.jsx";
import Login from "./Login.jsx";
import { Icon, Logo } from "./icons.jsx";
import { useTheme } from "./theme.js";
import { edgesOf, movePill, pageEnter, pageExit } from "./motion/pages.js";
import { StatusBadge } from "./panels/Status.jsx";
import { Picker, Tip, ToastProvider, rovingKeys } from "./ui.jsx";

// Capabilities of the selected app; "all" gets the union, so a panel shows when any app supports it.
const capsOf = (apps, slug) =>
  slug === "all" ? [...new Set(apps.flatMap((a) => a.capabilities))] : apps.find((a) => a.slug === slug)?.capabilities || [];

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Tip label={`Switch to ${next} theme`} describe={false} side="bottom">
      <button type="button" className="icon-button" onClick={(e) => toggle(e.currentTarget)} aria-label={`Switch to ${next} theme`}>
        <Icon name={theme === "dark" ? "sun" : "moon"} />
      </button>
    </Tip>
  );
}

// The state of the selected app (or the worst of all apps), always in the header.
function overall(apps, slug) {
  const shown = slug === "all" ? apps : apps.filter((a) => a.slug === slug);
  if (shown.some((a) => a.status === "down")) return "down";
  return shown.length && shown.every((a) => a.status === "up") ? "up" : null;
}

// The page's blocks resolve from blur once, when the page mounts (motion/pages.js).
function PageEnter({ children }) {
  const ref = useRef(null);
  useLayoutEffect(() => { const run = pageEnter(ref.current); return () => run?.stop(); }, []);
  return <div ref={ref}>{children}</div>;
}

// One accent pill behind the tabs that stretches to the active tab: leading edge first, trailing edge catching up.
function usePill(rowRef, pillRef, panel) {
  const last = useRef(null);
  useLayoutEffect(() => {
    const place = (animate) => {
      const row = rowRef.current, pill = pillRef.current, tab = row?.querySelector(".pill.active")?.parentElement; // the <li>: its offsets are in the row
      if (!row || !pill || !tab) return;
      pill.style.width = `${row.scrollWidth}px`;
      const to = edgesOf(row, tab);
      movePill(pill, animate ? last.current : null, to);
      last.current = to;
    };
    place(true);
    const onResize = () => place(false);
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, [panel]);
}

function Shell({ apps }) {
  const { app = "all", panel } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const rowRef = useRef(null);
  const pillRef = useRef(null);
  usePill(rowRef, pillRef, `${app}/${panel}`);
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
          <Picker label="App" value={app} onChange={(v) => navigate(`/${v}/${current.id}`)}
            options={[{ value: "all", label: "All apps" }, ...apps.map((a) => ({ value: a.slug, label: a.name }))]} />
        </div>
        <nav className="pills" aria-label="Panels">
          <ul role="list" ref={rowRef} onKeyDown={(e) => rovingKeys(e, "a.pill")}>
            <li className="pill-indicator" ref={pillRef} role="presentation" aria-hidden="true" />
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
          <Tip label="Go to an app or panel" describe={false} side="bottom">
            <button type="button" className="icon-button search-button" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K"
              aria-label="Go to an app or panel (Ctrl+K)">
              <Icon name="search" /><kbd aria-hidden="true">Ctrl K</kbd>
            </button>
          </Tip>
          <ThemeToggle />
          {tools.map((p) => (
            <Tip key={p.id} label={p.title} describe={false} side="bottom">
              <NavLink to={`/${app}/${p.id}`} className="icon-button" aria-label={p.title}><Icon name={p.icon} /></NavLink>
            </Tip>
          ))}
        </div>
      </header>
      <main className="content" id="main" tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={location.pathname} initial={false} animate={{ opacity: 1, filter: "blur(0px)" }} exit={pageExit(reduced)}>
            <PageEnter>
            {current.id !== "overview" && (
              <div className="page-head">
                <h1><span className="rise-mask"><span className="rise">{current.title}</span></span><span className="h1-scope rise-mask"><span className="rise"><span className="sr-only">, </span>{appName}</span></span></h1>
              </div>
            )}
            <Panel app={app} apps={apps} appName={appName} />
            </PageEnter>
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
    <ToastProvider>
    <Routes>
      <Route path="/" element={<Navigate to="/all/overview" replace />} />
      <Route path="/:app" element={<Shell apps={apps} />} />
      <Route path="/:app/:panel" element={<Shell apps={apps} />} />
    </Routes>
    </ToastProvider>
  );
}
