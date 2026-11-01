// One small icon set, drawn here: 16px grid, 1.75 stroke, round caps. Always decorative: the text beside an icon carries the meaning.
const PATHS = {
  up: <><circle cx="8" cy="8" r="5.25" /><path d="m5.75 8.1 1.6 1.6 3-3.4" /></>,
  down: <><path d="M8 2.75 14 13.25H2Z" /><path d="M8 6.75v2.75" /><circle cx="8" cy="11.4" r=".4" fill="currentColor" /></>,
  unknown: <><circle cx="8" cy="8" r="5.25" strokeDasharray="2 2.2" /></>,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  search: <><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3 3" /></>,
  overview: <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.25" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1.25" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1.25" /><rect x="9" y="9" width="4.5" height="4.5" rx="1.25" /></>,
  map: <><circle cx="4" cy="4.5" r="1.6" /><circle cx="12" cy="4" r="1.6" /><circle cx="8.5" cy="12" r="1.6" /><path d="M5.5 4.4h4.9M4.8 5.9l2.9 4.6M11.4 5.5l-2.2 5" /></>,
  status: <path d="M1.75 8.5h2.5l1.75-4 3 7.5 1.75-3.5h3.5" />,
  costs: <><circle cx="8" cy="8" r="5.75" /><path d="M9.9 5.9c-.4-.6-1.1-.9-1.9-.9-1.1 0-1.9.6-1.9 1.4 0 1.9 3.9 1 3.9 3 0 .8-.9 1.5-2 1.5-.8 0-1.6-.4-2-1M8 3.9v1.1M8 11v1.1" /></>,
  usage: <path d="M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5" />,
  apis: <><path d="M6 2.5v3M10 2.5v3M4.5 5.5h7v2.25a3.5 3.5 0 0 1-7 0Z" /><path d="M8 11.25v2.25" /></>,
  ledger: <><path d="M4 1.75h8v12.5l-1.6-1-1.2 1-1.2-1-1.2 1-1.2-1L4 14.25Z" /><path d="M6.25 5.25h3.5M6.25 8h3.5" /></>,
  events: <path d="M5.75 4h7.75M5.75 8h7.75M5.75 12h7.75M2.5 4h.01M2.5 8h.01M2.5 12h.01" />,
  access: <><path d="M8 1.75 13.25 3.75v4c0 3-2.2 5.3-5.25 6.5C4.95 13.05 2.75 10.75 2.75 7.75v-4Z" /><path d="m5.9 8 1.4 1.4L10.2 6.5" /></>,
  settings: <><circle cx="8" cy="8" r="2" /><path d="M8 1.75v1.5M8 12.75v1.5M14.25 8h-1.5M3.25 8h-1.5M12.4 3.6l-1.05 1.05M4.65 11.35 3.6 12.4M12.4 12.4l-1.05-1.05M4.65 4.65 3.6 3.6" /></>,
  sun: <><circle cx="8" cy="8" r="2.75" /><path d="M8 1.5v1.25M8 13.25v1.25M14.5 8h-1.25M2.75 8H1.5M12.6 3.4l-.9.9M4.3 11.7l-.9.9M12.6 12.6l-.9-.9M4.3 4.3l-.9-.9" /></>,
  moon: <path d="M13 9.6A5.25 5.25 0 1 1 6.4 3a4.25 4.25 0 0 0 6.6 6.6Z" />,
  arrow: <path d="M5 11 11 5M6 5h5v5" />,
  chevron: <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />,
  requests: <><path d="M2.5 5.5h9.5M9.5 3l2.5 2.5L9.5 8" /><path d="M13.5 10.5H4M6.5 8 4 10.5 6.5 13" /></>,
  errors: <><circle cx="8" cy="8" r="5.75" /><path d="M8 5v3.5" /><circle cx="8" cy="11" r=".4" fill="currentColor" /></>,
  latency: <><circle cx="8" cy="8.75" r="5" /><path d="M8 6.25v2.5l1.75 1.25M6.5 1.75h3" /></>,
  wallet: <><rect x="1.75" y="4" width="12.5" height="9.25" rx="2" /><path d="M1.75 6.75h12.5M3.75 2.75h7.5" /><circle cx="11" cy="9.75" r=".6" fill="currentColor" /></>,
  spark: <path d="M8 1.75v3M8 11.25v3M1.75 8h3M11.25 8h3M3.6 3.6l1.8 1.8M10.6 10.6l1.8 1.8M12.4 3.6l-1.8 1.8M5.4 10.6l-1.8 1.8" />,
  trendUp: <path d="m2.5 11 4-4 2.5 2.5 4.5-4.5M10 5h3.5v3.5" />,
  trendDown: <path d="m2.5 5 4 4 2.5-2.5 4.5 4.5M10 11h3.5V7.5" />,
  terminal: <><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" /><path d="m4.5 6.25 2 1.75-2 1.75M8.25 10h3" /></>,
  check: <path d="m3.25 8.4 3 3 6.5-7" />,
  clock: <><circle cx="8" cy="8" r="5.75" /><path d="M8 5v3.25l2 1.25" /></>,
  stop: <><circle cx="8" cy="8" r="5.75" /><rect x="5.75" y="5.75" width="4.5" height="4.5" rx=".75" /></>,
  retry: <path d="M12.75 8a4.75 4.75 0 1 1-1.4-3.35M12.75 2.75v2.5h-2.5" />,
  copy: <><rect x="5.25" y="5.25" width="8.5" height="8.5" rx="1.75" /><path d="M10.75 5.25V3.5a1.25 1.25 0 0 0-1.25-1.25h-6A1.25 1.25 0 0 0 2.25 3.5v6a1.25 1.25 0 0 0 1.25 1.25h1.75" /></>,
  sort: <path d="m5 6 3-3 3 3M5 10l3 3 3-3" />,
  sortUp: <path d="m5 7 3-3 3 3M8 4v9" />,
  sortDown: <path d="m5 9 3 3 3-3M8 12V3" />,
  empty: <><path d="M2.25 9.25 4 3.75h8l1.75 5.5v3a1.25 1.25 0 0 1-1.25 1.25h-9A1.25 1.25 0 0 1 2.25 12.25Z" /><path d="M2.25 9.25h3.5l.75 1.5h3l.75-1.5h3.5" /></>,
};

export function Icon({ name, className = "", size = 16 }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

// Mycelium's mark: three hyphae meeting at a node.
export function Logo({ size = 30 }) {
  return (
    <svg className="logo" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="15" fill="var(--accent)" />
      <g fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
        <path d="M16 16 9 9.5M16 16l7.5-5M16 16v8.5" />
      </g>
      <g fill="#fff"><circle cx="16" cy="16" r="3" /><circle cx="9" cy="9.5" r="2" /><circle cx="23.5" cy="11" r="2" /><circle cx="16" cy="24.5" r="2" /></g>
    </svg>
  );
}
