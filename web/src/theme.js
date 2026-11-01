// Theme: follows the system until the owner picks one with the header toggle; the pick is remembered in this browser only.
import { useSyncExternalStore } from "react";
import { revealTheme } from "./motion/pages.js";

const KEY = "mycelium-theme";
const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
const subs = new Set();

function saved() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function applySavedTheme() {
  const t = saved();
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
}

export const currentTheme = () => document.documentElement.dataset.theme || (mq?.matches ? "dark" : "light");

function set(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* private window: the choice lasts this visit */ }
  subs.forEach((f) => f());
}

const subscribe = (f) => {
  subs.add(f);
  mq?.addEventListener?.("change", f);
  return () => { subs.delete(f); mq?.removeEventListener?.("change", f); };
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme);
  // `from` is the button pressed: the new theme grows from it in a circle (motion/pages.js)
  return [theme, (from) => revealTheme(from, () => set(theme === "dark" ? "light" : "dark"))];
}
