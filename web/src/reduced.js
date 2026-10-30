// Reduced motion = Reroute's own switch (html[data-motion=reduced], set by app.js applyTheme) or the system setting, unless forced "full".
const mq = matchMedia("(prefers-reduced-motion: reduce)");
export const reducedMotion = () => {
  const m = document.documentElement.dataset.motion;
  return m === "reduced" || (mq.matches && m !== "full");
};
export const onReducedChange = (fn) => {
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  mq.addEventListener?.("change", fn);
  return () => { mo.disconnect(); mq.removeEventListener?.("change", fn); };
};
// React hook form, so components re-render when it flips.
import { useSyncExternalStore } from "react";
export const useReducedMotion = () => useSyncExternalStore(onReducedChange, reducedMotion);
