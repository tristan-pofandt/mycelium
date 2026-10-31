// One small icon set, drawn here: 16px grid, 1.75 stroke, round caps. Always decorative: the text beside an icon carries the meaning.
const PATHS = {
  up: <><circle cx="8" cy="8" r="5.25" /><path d="m5.75 8.1 1.6 1.6 3-3.4" /></>,
  down: <><path d="M8 2.75 14 13.25H2Z" /><path d="M8 6.75v2.75" /><circle cx="8" cy="11.4" r=".4" fill="currentColor" /></>,
  unknown: <><circle cx="8" cy="8" r="5.25" strokeDasharray="2 2.2" /></>,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  search: <><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3 3" /></>,
};

export function Icon({ name, className = "" }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
