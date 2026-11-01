// Small shared interface pieces, after HeroUI (React Aria behaviour), Aceternity and React Bits, rebuilt on Mycelium's tokens
// with no new dependency. Each keeps a keyboard path, a screen-reader name and a reduced-motion form. See DESIGN.md.
import { Children, cloneElement, createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons.jsx";
import { reducedMotion } from "./reduced.js";
import { ToastBridge } from "./api.js";

// ── Tooltip ───────────────────────────────────────────────────────────────
// Opens after 500 ms on hover or focus; once one tooltip has been open, neighbours open at once ("warm") for 400 ms after it
// closes. Escape closes. `describe` links it with aria-describedby (skip it when the text only repeats the trigger's label).
let warmUntil = 0;
export function Tip({ label, children, describe = true, side = "top" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const timer = useRef(null);
  const id = useId();
  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), performance.now() < warmUntil ? 0 : 500);
  };
  const hide = () => { clearTimeout(timer.current); if (open) warmUntil = performance.now() + 400; setOpen(false); };
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = (ref.current.firstElementChild || ref.current).getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: side === "top" ? r.top - 8 : r.bottom + 8 });
  }, [open, side]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && hide();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const child = Children.only(children);
  return (
    <span ref={ref} className="tip-anchor" onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide}>
      {cloneElement(child, describe ? { "aria-describedby": open ? id : undefined } : {})}
      {open && pos && createPortal(
        <span id={id} role="tooltip" className={`tooltip tooltip-${side}`} style={{ left: pos.x, top: pos.y }}>{label}</span>,
        document.body)}
    </span>
  );
}

// ── Toasts ────────────────────────────────────────────────────────────────
// A labelled region at the bottom right, announced politely. Each toast stays 4 s, paused while hovered or focused; Alt+T
// moves focus to the newest one, Escape dismisses it. At most three show; older ones fold behind.
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
ToastBridge.use = useToast;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const region = useRef(null);
  const toast = useCallback((t) => {
    const item = { id: Math.random().toString(36).slice(2), tone: "info", ...t };
    setToasts((list) => [...list.filter((x) => !(t.key && x.key === t.key)), item].slice(-3));
  }, []);
  const dismiss = (id) => setToasts((list) => list.filter((t) => t.id !== id));
  useEffect(() => {
    const onKey = (e) => { if (e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); region.current?.querySelector(".toast:last-child")?.focus(); } };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <section className="toasts" aria-label="Notifications (Alt+T)" ref={region}>
        <ol role="list" aria-live="polite">
          {toasts.map((t) => <Toast key={t.id} t={t} onDone={() => dismiss(t.id)} />)}
        </ol>
      </section>
    </ToastCtx.Provider>
  );
}

function Toast({ t, onDone }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const id = setTimeout(onDone, t.ms || 4000);
    return () => clearTimeout(id);
  }, [paused]);
  return (
    <li className={`toast toast-${t.tone}`} tabIndex={-1} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} onKeyDown={(e) => e.key === "Escape" && onDone()}>
      <Icon name={t.tone === "bad" ? "errors" : t.tone === "good" ? "check" : "spark"} />
      <span>{t.title}</span>
      <button type="button" className="toast-close" onClick={onDone} aria-label="Dismiss notification"><Icon name="close" size={14} /></button>
    </li>
  );
}

// ── Switch ────────────────────────────────────────────────────────────────
// role="switch" with Space and Enter; the thumb slides with a short spring and stretches while pressed.
export function Switch({ checked, onChange, label, disabled, hint }) {
  return (
    <label className={`switch-row ${disabled ? "is-disabled" : ""}`}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} className="switch" onClick={() => onChange(!checked)}>
        <span className="switch-thumb" aria-hidden="true" />
      </button>
      <span>{label}{hint && <span className="muted"> {hint}</span>}</span>
    </label>
  );
}

// ── Hold to confirm ───────────────────────────────────────────────────────
// For destructive actions: hold the pointer, Space or Enter for 1.2 s; letting go early cancels. Under reduced motion the fill
// still reports progress, as a static bar that jumps.
export function HoldButton({ children, onConfirm, ms = 1200, className = "", disabled }) {
  const [held, setHeld] = useState(false);
  const fill = useRef(null);
  const timer = useRef(null);
  const hintId = useId();
  const start = () => {
    if (disabled || timer.current) return;
    setHeld(true);
    fill.current?.animate?.([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: reducedMotion() ? 1 : ms, easing: "linear", fill: "forwards" });
    timer.current = setTimeout(() => { timer.current = null; setHeld(false); fill.current?.getAnimations?.().forEach((a) => a.cancel()); onConfirm(); }, ms);
  };
  const stop = () => {
    if (!timer.current) return;
    clearTimeout(timer.current); timer.current = null; setHeld(false);
    fill.current?.getAnimations?.().forEach((a) => a.cancel());
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <button type="button" className={`button hold ${held ? "is-held" : ""} ${className}`} disabled={disabled} aria-describedby={hintId}
        onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } }}
        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") stop(); }}>
        <span className="hold-fill" ref={fill} aria-hidden="true" />
        <span className="hold-label">{children}</span>
      </button>
      <span id={hintId} className="sr-only">Press and hold to confirm.</span>
    </>
  );
}

// ── Empty state and skeleton ──────────────────────────────────────────────
export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true"><Icon name="empty" size={20} /></span>
      <p className="empty-title">{title}</p>
      {children && <p className="muted empty-text">{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 160, lines = 0 }) {
  return (
    <div className="skel" role="status" aria-label="Loading">
      <div className="skeleton" style={{ height }} />
      {Array.from({ length: lines }, (_, i) => <div key={i} className="skeleton skel-line" style={{ width: `${85 - i * 15}%` }} />)}
    </div>
  );
}

// ── Picker: a button with a listbox popover (replaces a native select where the style matters) ──
// Arrow keys, Home, End and typing a letter move; Enter or Space chooses; Escape or a click outside closes and returns focus.
export function Picker({ value, options, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const btn = useRef(null);
  const list = useRef(null);
  const id = useId();
  const current = options.find((o) => o.value === value) || options[0];
  useEffect(() => {
    if (!open) return undefined;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    list.current?.focus();
    const onDown = (e) => { if (!list.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    addEventListener("pointerdown", onDown);
    return () => removeEventListener("pointerdown", onDown);
  }, [open]);
  const choose = (o) => { onChange(o.value); setOpen(false); btn.current?.focus(); };
  const onKey = (e) => {
    const n = options.length;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + n) % n); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(options[active]); }
    else if (e.key === "Escape" || e.key === "Tab") { setOpen(false); btn.current?.focus(); }
    else if (e.key.length === 1) { const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase())); if (i >= 0) setActive(i); }
  };
  return (
    <div className="picker">
      <button ref={btn} type="button" className="picker-button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${current.label}`}
        onClick={() => setOpen((o) => !o)} onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); } }}>
        <span>{current.label}</span><Icon name="chevron" />
      </button>
      {open && (
        <ul ref={list} className="popover" role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={`${id}-${active}`} onKeyDown={onKey}>
          {options.map((o, i) => (
            <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={o.value === value} className={i === active ? "is-active" : ""}
              onPointerMove={() => setActive(i)} onClick={() => choose(o)}>
              {o.label}{o.value === value && <Icon name="check" size={14} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Arrow keys across a row of links or buttons (roving focus) ──
// Left and Right move between items, Home and End jump to the ends; Tab still leaves the row from wherever you are.
export function rovingKeys(e, selector) {
  const keys = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" };
  if (!(e.key in keys)) return;
  const items = [...e.currentTarget.querySelectorAll(selector)].filter((el) => !el.disabled);
  const i = items.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const k = keys[e.key];
  const next = k === "first" ? 0 : k === "last" ? items.length - 1 : (i + k + items.length) % items.length;
  items[next].focus();
}

// ── A highlight that slides between rows (Aceternity's card hover, without layout animation) ──
// Returns props for the list; the highlight is one absolutely positioned element moved with `translate`.
export function useRowHighlight() {
  const glow = useRef(null);
  const onPointerOver = (e) => {
    const row = e.target.closest("[data-row]");
    const el = glow.current;
    if (!row || !el) return;
    el.style.height = `${row.offsetHeight}px`;
    el.style.translate = `0 ${row.offsetTop}px`;
    el.style.opacity = "1";
  };
  const onPointerLeave = () => { if (glow.current) glow.current.style.opacity = "0"; };
  return { glow, listProps: { onPointerOver, onPointerLeave } };
}
