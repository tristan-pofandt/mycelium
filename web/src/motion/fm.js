// Shared bookkeeping for the motion layer: every running animation and every inline style the layer writes is registered here, so
// turning Reduce motion on mid-session (or unmounting the layer) can stop the lot and leave the DOM exactly as it found it.

const running = new Set();
const written = new Map(); // element -> Set of inline properties the layer owns
export const track = (c) => (running.add(c), c);
export const untrack = (c) => running.delete(c);
export const touch = (el, ...props) => { let s = written.get(el); if (!s) written.set(el, (s = new Set())); props.forEach((p) => s.add(p)); };
export const prune = () => written.forEach((_, el) => { if (!el.isConnected) written.delete(el); });
export function resetAll() {
  running.forEach((c) => c.stop());
  running.clear();
  written.forEach((props, el) => props.forEach((p) => (p.startsWith("data-") ? el.removeAttribute(p) : el.style.removeProperty(p))));
  written.clear();
  driven = new WeakMap();
}

// Press and hover drive the CSS individual `scale` / `translate` properties with Web Animations (compositor thread), never `transform`, so they
// compose with the 3D scroll transform and with framer-motion's layout morphs instead of fighting them. A press holds its end pose inline until
// the release; a new call retargets from wherever the element is now (read from the computed style, which reflects a running animation).
const REST = { scale: 1, translate: 0 };
const FMT = { scale: (v) => String(v), translate: (v) => `0px ${v}px` };
const READ = { scale: (cs) => parseFloat(cs.scale) || 1, translate: (cs) => parseFloat(cs.translate.split(" ")[1]) || 0 };
let driven = new WeakMap();
export function drive(el, prop, to, { from, duration, ease } = {}) {
  let s = driven.get(el);
  if (!s) driven.set(el, (s = {}));
  const prev = s[prop];
  let now = s["h" + prop] ?? REST[prop]; // the pose it was left in
  if (prev) { now = READ[prop](getComputedStyle(el)); untrack(prev.ctl); prev.a.cancel(); }
  if (from != null) now = from;
  touch(el, prop);
  const a = el.animate({ [prop]: [FMT[prop](now), FMT[prop](to)] }, { duration: duration * 1000, easing: `cubic-bezier(${ease.join(",")})`, fill: "forwards" });
  const ctl = { stop() { a.cancel(); } };
  s[prop] = { a, ctl };
  track(ctl);
  a.finished.then(() => {
    if (s[prop]?.a !== a) return;
    untrack(ctl); s[prop] = null; s["h" + prop] = to;
    if (to === REST[prop]) el.style.removeProperty(prop); else el.style[prop] = FMT[prop](to); // a held press pose lives inline until the release
    a.cancel();
  }, () => {});
}
