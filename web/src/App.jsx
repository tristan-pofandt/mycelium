import { NavLink, Navigate, Route, Routes, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { panels } from "./panels/index.js";
import { DUR, EASE } from "./choreography.js";
import { useReducedMotion } from "./reduced.js";

export default function App() {
  const location = useLocation();
  const reduced = useReducedMotion();
  const enter = reduced ? { opacity: 1 } : { opacity: 1, y: 0 };
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Panels">
        <div className="brand">Mycelium</div>
        {panels.map((p) => (
          <NavLink key={p.id} to={`/${p.id}`} className="nav-item">{p.title}</NavLink>
        ))}
      </nav>
      <main className="content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={enter}
            exit={{ opacity: 0, transition: { duration: DUR.panelOut * 0.5 } }}
            transition={{ duration: DUR.panel, ease: EASE }}
          >
            <Routes location={location}>
              <Route path="/" element={<Navigate to={`/${panels[0].id}`} replace />} />
              {panels.map((p) => <Route key={p.id} path={`/${p.id}`} element={<p.component />} />)}
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
