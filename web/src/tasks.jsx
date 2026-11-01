// Task chips: the state of one action the owner started (an admin change now; setup scripts, scans and host-agent actions later),
// after React Bits' Call Chip, rebuilt on Mycelium's tokens. States: queued, running, done, failed, cancelled.
// A running chip fills towards an expected time (or a real progress value when the task reports one) and stops at 90% until it
// finishes; done snaps full with a tick; failed freezes, shakes once and offers Retry. Every state has a glyph and a word, the
// elapsed time is text, the chip is role="status", and reduced motion keeps the fill still and drops the shake.
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { reducedMotion } from "./reduced.js";

const WORD = { queued: "Queued", running: "Running", done: "Done", failed: "Failed", cancelled: "Cancelled" };
const GLYPH = { queued: "clock", running: "terminal", done: "check", failed: "errors", cancelled: "stop" };
const secs = (ms) => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;

// const [task, run] = useTask(); run({ name, arg, expectedMs, action: async () => result })  (action throws to fail)
export function useTask() {
  const [task, setTask] = useState(null);
  const last = useRef(null);
  const run = async (spec) => {
    last.current = spec;
    const t0 = performance.now();
    setTask({ ...spec, state: "running", t0, ms: 0 });
    try {
      const result = await spec.action();
      setTask({ ...spec, state: "done", t0, ms: performance.now() - t0, detail: spec.done?.(result) });
      return result;
    } catch (e) {
      setTask({ ...spec, state: "failed", t0, ms: performance.now() - t0, detail: e?.message || "Something went wrong." });
      return null;
    }
  };
  return [task, run, () => last.current && run(last.current)];
}

export function TaskChip({ task, onRetry }) {
  const root = useRef(null);
  const time = useRef(null);
  const fill = useRef(null);
  const { state, name, arg, t0, ms, expectedMs = 1500, progress, detail } = task;

  // Elapsed time ticks in the text node itself while running: no re-render per frame.
  useEffect(() => {
    if (state !== "running") return undefined;
    const id = setInterval(() => { if (time.current) time.current.textContent = secs(performance.now() - t0); }, reducedMotion() ? 250 : 100);
    return () => clearInterval(id);
  }, [state, t0]);

  // The fill: towards 90% over the expected time (or a real progress value), full on done, frozen on failure.
  useEffect(() => {
    const el = fill.current;
    if (!el) return undefined;
    el.getAnimations?.().forEach((a) => { try { a.commitStyles(); } catch { /* not rendered */ } a.cancel(); }); // a failure freezes where it was
    if (state === "running" && progress == null && !reducedMotion()) {
      el.animate?.([{ transform: "scaleX(0.04)" }, { transform: "scaleX(0.9)" }], { duration: expectedMs, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" });
    } else if (state === "running") {
      el.style.transform = `scaleX(${progress == null ? 0.45 : Math.max(0.04, Math.min(1, progress))})`;
    } else if (state === "done") {
      el.style.transform = "scaleX(1)";
    } else if (state === "queued" || state === "cancelled") {
      el.style.transform = "scaleX(0)";
    }
    if (state === "failed" && !reducedMotion() && root.current) {
      root.current.animate?.([{ translate: "0" }, { translate: "-6px" }, { translate: "5px" }, { translate: "-3px" }, { translate: "2px" }, { translate: "0" }],
        { duration: 450, easing: "ease-out" });
    }
    return undefined;
  }, [state, progress, expectedMs]);

  const spoken = `${name}${arg ? `, ${arg}` : ""}: ${WORD[state]}${state === "running" ? "" : `, ${secs(ms)}`}${detail ? `. ${detail}` : ""}`;
  return (
    <div ref={root} className={`task-chip task-${state}`} role="status" aria-busy={state === "running"}>
      <span className="task-fill" ref={fill} aria-hidden="true" />
      <span className="task-glyph" aria-hidden="true"><Icon name={GLYPH[state]} size={14} /></span>
      <span className="task-name" aria-hidden="true">{name}</span>
      {arg && <span className="task-arg" aria-hidden="true">{arg}</span>}
      <span className="task-state" aria-hidden="true">{WORD[state]}</span>
      <span className="task-time" aria-hidden="true" ref={time}>{secs(ms)}</span>
      {state === "failed" && onRetry && (
        <button type="button" className="task-retry" onClick={onRetry} aria-label={`Retry ${name}`}><Icon name="retry" size={14} /></button>
      )}
      <span className="sr-only">{spoken}</span>
      {state === "failed" && detail && <span className="task-detail" aria-hidden="true">{detail}</span>}
    </div>
  );
}
