// Ported from Reroute (apps/plan-b-mvp/web/src/choreography.js) so Mycelium moves the same way; keep the two in step.
// The one source of timing and travel for every element transition: page routes, the side menu, Settings, sheets and the launch splash
// all read the constants and helpers here, so they share one feel (an ease-out quint on opacity, a short springy settle on position,
// a 30 ms stagger capped at CAP elements). Nothing in here touches WebGL: elements slide, fade and settle.
// Rules (README "Motion principles and timings"): ease-out only (never ease-in) on anything the user waits for; leaving is faster than arriving;
// feedback under ~160 ms; stagger 20-30 ms and capped; the spring has a hair of overshoot, no wobble. Magic numbers live here, not in callers.
//
//   * `slide(elements, offset, opts)` moves any list of DOM elements (native screens' Items, legacy HTML, menu rows, splash ...) with Web
//     Animations on translate + opacity, which the browser runs on its compositor thread (see "Element animations" below);
//   * `useDirection()` / `getDirection()` say which way the current navigation travels: forward, back, up or down.
import { cubicBezier, spring as fmSpring } from "framer-motion";
import { useSyncExternalStore } from "react";
import { reducedMotion } from "./reduced.js";
import { touch, track, untrack } from "./motion/fm.js";

// Dev/slow-motion builds only (vite dev, or VITE_SLOWMO=1 at build time): `window.__slowmo = 6` slows every transition six times so a
// frame can be captured mid-flight. Production builds replace the flag with `false` and drop the branch.
const SLOWMO = import.meta.env.DEV || import.meta.env.VITE_SLOWMO === "1";
export const slow = () => (SLOWMO ? Number(window.__slowmo) || 1 : 1);

export const EASE = [0.22, 1, 0.36, 1]; // the one ease-out (quint): entering, leaving, fades, press and release. Never an ease-in.
export const STAGGER_IN = 0.03;
export const STAGGER_OUT = 0.02;
export const STAGGER_CLOSE = 0.014; // lines of a closing panel: top first, the last starts at 112 ms and is gone by 272 ms, just before the panel (300 ms)
export const LINE_OUT = 0.16; // one line of a closing panel
export const CAP = 7; // elements beyond this share the last element's delay and "fade with the group" (last one starts at 180 ms)
export const CAP_OUT = 5; // leaving is capped sooner so a long page clears in about 200 ms
export const OUT_TIME = 0.12; // one element leaving
// One duration vocabulary (s) for everything that is not a page element: callers use these instead of numbers.
export const DUR = { press: 0.14, release: 0.16, hover: 0.15, fade: 0.2, panel: 0.22, menu: 0.36, menuOut: 0.2, panelOut: 0.3, crossfade: 0.24, rise: 0.3, morph: 0.45 };
export const spring = (s = slow()) => ({ type: "spring", duration: 0.4 * s, bounce: 0.12 }); // slide-and-settle: a hair of overshoot, no wobble
export const MORPH = (s = slow()) => ({ type: "spring", duration: DUR.morph * s, bounce: 0.08 }); // layoutId morphs: calmer than a slide
export const LAYOUT = { type: "spring", stiffness: 420, damping: 40 }; // lists reordering in place: critically damped, no overshoot
export const watchdog = () => 600 * slow(); // an exit that has not reported in by now is force-completed

// The same spring as a pure function of scroll progress, for the scrubbed scroll reveals (motion/scroll3d.js): damping ratio 1 - bounce,
// settled by k = 1, with a hair of overshoot. settle(0) = 0, settle(1) = 1 exactly.
const Z = 0.76, W = 7.24, WD = W * Math.sqrt(1 - Z * Z);
const step = (t) => 1 - Math.exp(-Z * W * t) * (Math.cos(WD * t) + ((Z * W) / WD) * Math.sin(WD * t));
const STEP_END = step(1);
export const settle = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : step(k) + (1 - STEP_END) * k);

// ── Direction of travel ──────────────────────────────────────────────────────
let dir = "forward";
const subs = new Set();
export const getDirection = () => dir;
export const setDirection = (d) => { if (d && d !== dir) { dir = d; subs.forEach((f) => f()); } };
export const useDirection = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), getDirection);

// Where an element is displaced to: forward content leaves left and arrives from the right, back is the reverse, up (sheet-like) leaves
// down and arrives from below, down leaves down and arrives from just above.
export function travel(d, phase) {
  const w = Math.round(Math.min(innerWidth, 520) * 0.6), h = 56;
  if (d === "forward") return { x: phase === "out" ? -w : w, y: 0 };
  if (d === "back") return { x: phase === "out" ? w : -w, y: 0 };
  if (d === "up") return { x: 0, y: h };
  return { x: 0, y: phase === "out" ? h : -h / 2 };
}

// ── Element animations run by the browser's compositor ───────────────────────────
// Everything that moves is a Web Animation (`element.animate`) on the CSS `translate` and `opacity` properties only. Those two run on the
// compositor thread: once an animation has started, a busy main thread (React commit, GC, a slow phone) cannot make it drop a frame. The
// old code ran framer-motion springs on the main thread and wrote inline style every frame. The spring is not lost: it is sampled once
// into keyframes (springs are main-thread by nature, a sampled curve is not), and a position is never `transform` (scroll reveals and
// framer's layout morphs own that). Animations use `fill: "both"`, so the first painted frame already shows the start pose (no flash), and
// are cancelled the moment they finish (the end pose is written inline for a leaving element, removed for an arriving one), so nothing
// is left holding an element at opacity 0 or with a stale will-change / animation effect.
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const CSS_EASE = `cubic-bezier(${EASE.join(",")})`;
const IN_MS = 400, IN_N = 20, OUT_N = 12;
// progress curves, sampled once: the arrival spring (the same one as spring()) and the leaving ease-out
export const IN_CURVE = (() => { const g = fmSpring({ keyframes: [0, 1], duration: IN_MS, bounce: 0.12 }); return Array.from({ length: IN_N + 1 }, (_, i) => (i === IN_N ? 1 : g.next((i * IN_MS) / IN_N).value)); })();
const OUT_CURVE = (() => { const e = cubicBezier(...EASE); return Array.from({ length: OUT_N + 1 }, (_, i) => e(i / OUT_N)); })();
const px = (x, y, k) => `${(x * k).toFixed(2)}px ${(y * k).toFixed(2)}px`;
const framesCache = new Map(); // "i|o" + offset -> keyframes, built once per distinct offset
function keyframes(out, { x, y }) {
  const key = `${out ? "o" : "i"}${x},${y}`;
  let f = framesCache.get(key);
  if (!f) {
    const c = out ? OUT_CURVE : IN_CURVE;
    f = c.map((v, i) => ({ offset: i / (c.length - 1), translate: px(x, y, out ? v : 1 - v), opacity: out ? 1 - clamp(v * 1.15) : clamp(v * 1.6) }));
    framesCache.set(key, f);
  }
  return f;
}

// fx(els, keyframes, { duration, delay, step, cap, easing, props, done }) -> { stop(), finished: Promise }   (all times in ms)
//   element i starts at delay + min(i, cap - 1) * step; `done(el)` runs once when its animation has finished, just before it is cancelled.
//   `hold`: a leaving page's elements stay at their end pose (fill forwards) until the page is removed, instead of writing it inline: framer's
//   layout projection rewrites inline opacity on shared elements and would flash a held-by-inline element back to 1.
//   stop() keeps what is on screen (commitStyles) and cancels. Registered with the motion layer, so turning Reduce motion on mid-flight
//   cancels every running animation and restores the DOM.
export function fx(els, frames, { duration, delay = 0, step = 0, cap = 1e9, easing = "linear", props = ["translate", "opacity"], done, hold = false } = {}) {
  const list = [...els].filter(Boolean);
  if (!list.length || reducedMotion()) return { stop() {}, finished: Promise.resolve() };
  let live = true;
  const anims = list.map((el, i) => {
    touch(el, ...props);
    return el.animate(frames, { duration, delay: delay + Math.min(i, cap - 1) * step, easing, fill: "both" });
  });
  const ctl = { stop() { if (!live && !hold) return; live = false; untrack(ctl); anims.forEach((a) => { try { a.commitStyles(); } catch { /* not rendered */ } a.cancel(); }); } };
  track(ctl);
  const all = Promise.all(anims.map((a, i) => a.finished.then(() => { if (hold) return; if (live) done?.(list[i]); a.cancel(); }, () => {}))).then(() => { live = false; untrack(ctl); });
  // an animation stopped from outside never finishes; never wait for it
  ctl.finished = Promise.race([all, new Promise((r) => setTimeout(r, duration + delay + step * list.length + 800))]);
  return ctl;
}

// slide(els, { x, y }, { out, delay, step, cap, time }) -> { stop(), finished }   (delay, step, time in seconds)
//   in:  elements start displaced by the offset, invisible, and spring to rest;
//   out: elements leave to the offset while fading (ease-out: the move starts at once).
// Used for pages, panel lines, profile-menu items and the splash mark; delays and durations are multiplied by slow() (inspection builds).
export function slide(els, offset, { out = false, delay = 0, step = out ? STAGGER_OUT : STAGGER_IN, cap = out ? CAP_OUT : CAP, time = OUT_TIME, hold = false } = {}) {
  const s = slow() * 1000;
  return fx(els, keyframes(out, offset), {
    duration: out ? time * s : IN_MS * slow(), delay: delay * s, step: step * s, cap, hold: out && hold,
    done: out ? (el) => { el.style.translate = px(offset.x, offset.y, 1); el.style.opacity = "0"; }
      : (el) => { el.style.removeProperty("translate"); el.style.removeProperty("opacity"); },
  });
}
