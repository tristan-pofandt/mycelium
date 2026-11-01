// Moving between pages, modelled on the two reference clips Tristan chose on 2026-11-01:
//   * the active nav pill stretches to its new tab: the leading edge goes first and fast, the trailing edge catches up;
//   * the old page blurs out and the new page's cards resolve from blur, one after another;
//   * switching theme reveals the new theme in a circle growing from the toggle.
// Everything runs as Web Animations or View Transitions (off the main thread where the browser allows), and does nothing
// under reduced motion. Page-element timing comes from choreography.js; the pill's two edge curves are from the clip and
// live here because they exist for this one gesture.
import { CSS_EASE, DUR, fx, slow } from "../choreography.js";
import { reducedMotion } from "../reduced.js";
import { cubicBezier } from "framer-motion";

const LEAD = { ms: 360, ease: cubicBezier(0.215, 0.61, 0.355, 1) }; // power3.out
const TRAIL = { ms: 550, ease: cubicBezier(0.645, 0.045, 0.355, 1) }; // power3.inOut: the edge that follows lags, then settles
const FRAMES = 24;

// The pill is one element across the whole tab row, shown only between two clip edges (in px from the row's left and right).
const clip = (box, l, r) => `inset(${box.top}px ${r}px ${box.bottom}px ${l}px round 999px)`;

export function edgesOf(row, tab) {
  const w = row.scrollWidth, h = row.clientHeight;
  return { l: tab.offsetLeft, r: w - (tab.offsetLeft + tab.offsetWidth), top: tab.offsetTop, bottom: h - (tab.offsetTop + tab.offsetHeight) };
}

// Move the pill from `from` to `to` edges. Returns the running animation, or null when it was placed without one.
export function movePill(pill, from, to) {
  pill.getAnimations().forEach((a) => a.cancel());
  pill.style.clipPath = clip(to, to.l, to.r);
  if (!from || reducedMotion() || (from.l === to.l && from.r === to.r)) return null;
  const right = to.l > from.l; // moving right: the right edge leads
  const s = slow(), total = Math.max(LEAD.ms, TRAIL.ms) * s;
  const edge = (a, b, curve, t) => a + (b - a) * curve.ease(Math.min(1, t / (curve.ms * s)));
  const frames = Array.from({ length: FRAMES + 1 }, (_, i) => {
    const t = (i / FRAMES) * total;
    const l = edge(from.l, to.l, right ? TRAIL : LEAD, t), r = edge(from.r, to.r, right ? LEAD : TRAIL, t);
    const top = edge(from.top, to.top, LEAD, t), bottom = edge(from.bottom, to.bottom, LEAD, t);
    return { offset: i / FRAMES, clipPath: clip({ top, bottom }, l, r) };
  });
  return pill.animate(frames, { duration: total, easing: "linear" });
}

// Entrance, measured from the reference clip: the old page is gone in ~70 ms, the title slides up out of a mask from ~150 ms,
// then the blocks rise into place one after another (~65 ms apart), each resolving from blur over ~650 ms. Slower than
// Reroute's in-app entrances on purpose: a page change on a dashboard is a moment to re-orient, not a tap response.
const ENTER = { delay: 150, title: 700, block: 650, step: 65, rise: 24, cap: 12 };
const BLOCKS = ".greeting .state-line, .kpi, .panel-card, .card, .insight, .stat, .toolbar";

export function pageEnter(root) {
  if (!root) return null;
  const s = slow();
  const titles = fx(root.querySelectorAll(".rise"), [{ translate: "0 110%" }, { translate: "0 0" }], {
    duration: ENTER.title * s, delay: ENTER.delay * s, step: 90 * s, easing: CSS_EASE, props: ["translate"],
    done: (el) => el.style.removeProperty("translate"),
  });
  const blocks = fx(root.querySelectorAll(BLOCKS), [
    { translate: `0 ${ENTER.rise}px`, opacity: 0, filter: "blur(8px)" },
    { translate: "0 0", opacity: 1, filter: "blur(0px)" },
  ], {
    duration: ENTER.block * s, delay: (ENTER.delay + 120) * s, step: ENTER.step * s, cap: ENTER.cap, easing: CSS_EASE,
    props: ["translate", "opacity", "filter"],
    done: (el) => ["translate", "opacity", "filter"].forEach((p) => el.style.removeProperty(p)),
  });
  return { stop() { titles.stop(); blocks.stop(); } };
}

// The leaving page blurs and fades; framer-motion runs it as the route's exit.
export const pageExit = (reduced) => (reduced ? { opacity: 0, transition: { duration: DUR.fade * 0.5 } }
  : { opacity: 0, filter: "blur(6px)", transition: { duration: 0.09 * slow(), ease: [0.22, 1, 0.36, 1] } }); // gone in ~70-90 ms, as in the clip

// Theme switch: the new theme grows in a circle from the button (View Transitions; an instant switch where unsupported).
export function revealTheme(fromEl, apply) {
  if (reducedMotion() || !document.startViewTransition || !fromEl) { apply(); return; }
  const r = fromEl.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const t = document.startViewTransition(apply);
  t.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: DUR.morph * 1000 * slow(), easing: CSS_EASE, pseudoElement: "::view-transition-new(root)" },
    );
  }).catch(() => {});
}
