// Command palette (Ctrl+K): jump to any app or panel. A modal dialog with an ARIA combobox and listbox.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

export default function Palette({ apps, app, panels, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialog = useRef(null);
  const items = [
    ...panels.map((p) => ({ id: `p-${p.id}`, label: p.title, hint: "Panel", to: `/${app}/${p.id}` })),
    { id: "a-all", label: "All apps", hint: "App", to: "/all/overview" },
    ...apps.map((a) => ({ id: `a-${a.slug}`, label: a.name, hint: "App", to: `/${a.slug}/overview` })),
  ].filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const d = dialog.current;
    d.showModal();
    const back = document.activeElement;
    return () => back?.focus?.();
  }, []);
  useEffect(() => setActive(0), [query]);

  const go = (item) => { if (item) { navigate(item.to); onClose(); } };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(items[active]); }
  };

  return (
    <dialog ref={dialog} className="palette" aria-label="Go to app or panel" onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}>
      <input
        className="palette-input" autoFocus role="combobox" aria-expanded="true" aria-controls="palette-list"
        aria-activedescendant={items[active]?.id} aria-label="Go to app or panel" placeholder="Go to app or panel…"
        value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey}
      />
      <ul id="palette-list" role="listbox" className="palette-list">
        {items.map((item, i) => (
          <li key={item.id} id={item.id} role="option" aria-selected={i === active} className="palette-item"
            onMouseMove={() => setActive(i)} onClick={() => go(item)}>
            <span>{item.label}</span><span className="muted">{item.hint}</span>
          </li>
        ))}
        {!items.length && <li className="muted palette-empty">Nothing matches.</li>}
      </ul>
    </dialog>
  );
}
