---
name: Mycelium
description: A calm, card-based monitoring dashboard with one indigo accent and a live map of reads and writes.
colors:
  accent: "#575af0"
  accent-light: "#4f46e5"
  accent-text: "#a5b4fc"
  accent-text-light: "#4338ca"
  bg-void: "#06070b"
  bg-base: "#08090d"
  bg-card: "#121419"
  bg-pop: "#1b1e27"
  text: "#f1f5f9"
  text-muted: "#94a3b8"
  text-faint: "#64748b"
  success: "#34d399"
  error: "#f87171"
  warning: "#fbbf24"
  teal: "#2dd4bf"
  orange: "#fb923c"
  violet: "#a78bfa"
  light-bg-void: "#e7e9f0"
  light-bg-base: "#f1f2f6"
  light-bg-card: "#ffffff"
  light-bg-pop: "#f5f6fa"
  light-text: "#0f1222"
  light-text-muted: "#475569"
  light-success: "#047857"
  light-error: "#b91c1c"
  light-warning: "#b45309"
  light-teal: "#0f766e"
  light-orange: "#c2410c"
  light-violet: "#6d28d9"
  insight-a: "#4f46e5"
  insight-b: "#7c3aed"
  series-2: "#0d9488"
typography:
  page-title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    letterSpacing: "-0.03em"
  kpi-value:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  card-title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  control:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  caption:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
rounded:
  tag: "6px"
  tile: "10px"
  field: "12px"
  control: "14px"
  card: "20px"
  panel: "24px"
  sheet: "28px"
  pill: "999px"
spacing:
  gap: "16px"
  card-padding: "24px"
  page-x: "28px"
components:
  pill-nav-item:
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  pill-nav-item-active:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
  card:
    backgroundColor: "{colors.bg-card}"
    rounded: "{rounded.panel}"
    padding: "24px"
  kpi-tile:
    backgroundColor: "{colors.bg-card}"
    rounded: "{rounded.panel}"
    padding: "18px"
  icon-button:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    height: "40px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  insight-card:
    backgroundColor: "{colors.insight-a}"
    textColor: "#ffffff"
    rounded: "{rounded.panel}"
    padding: "22px"
---

# Design System: Mycelium

## Overview

**Creative North Star: "The Quiet Control Room"**

A card-based monitoring dashboard: big quiet cards on a soft ground, one indigo accent, data that reads at a glance. It refuses the dense grey ops console. The live map is the one thing other dashboards lack, so it gets a card on the Overview and a full page.

The base tokens come from Reroute's "Night Dispatcher" DESIGN.md. The dashboard layer (soft ground, card shadow, hatching, gauge, heatmap steps, insight gradient, 24px panel radius) is Mycelium's own, taken from reference dashboards chosen on 2026-11-01. Source of truth is `web/src/tokens.css`; `web/src/app.css` holds the component rules.

**Key Characteristics:**
- Two themes: dark by default, light via the system setting or the header toggle.
- Cards at 24px radius with a hairline border and a faint shadow.
- One accent (indigo) for the active pill, the focused bar, gauge segments, pulses and primary buttons.
- Status green, amber and red appear only where they mean something.
- Inter with tabular figures everywhere (set on `body`).

## Colors

Cool, near-neutral ground; a single indigo accent; event hues (teal, indigo, orange, red) used only on the map, kind pills and chart series.

### Themes
- **System-following.** `:root` holds dark values. `@media (prefers-color-scheme: light)` applies the light block to `:root:not([data-theme="dark"])`.
- **Override.** `html[data-theme="light"|"dark"]` is set by the header toggle (`theme.js`, remembered in localStorage key `mycelium-theme`). The light block is duplicated in the media query and the `[data-theme="light"]` rule; change both together.
- Dark: void `#06070b`, ground `#08090d`, card `#121419`, pop `#1b1e27`, text `#f1f5f9`, muted `#94a3b8`, faint `#64748b`, accent `#575af0`, accent text `#a5b4fc`.
- Light: void `#e7e9f0`, ground `#f1f2f6`, card `#ffffff`, pop `#f5f6fa`, text `#0f1222`, muted `#475569`, accent `#4f46e5`, accent text `#4338ca`.

### From Reroute (keep in step)
Background ramp, borders (`rgba(255,255,255,.07)` / `.13` dark), text ramp, `--accent`, `--accent-text`, `--accent-soft`, success, error, warning, teal, violet, orange, Inter, the radius ramp (6, 10, 12, 14, 20, 28), `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)`, and the press (140ms) and hover (150ms) durations. Do not edit these here alone; change Reroute and port the change, or flag the divergence.

### Mycelium's dashboard layer
- `--bg-card` and `--bg-void` as card and map ground; `--r-panel` 24px.
- `--shadow-card`: dark `0 1px 0 rgba(255,255,255,.03) inset`; light `0 1px 2px rgba(15,18,34,.04), 0 8px 28px rgba(15,18,34,.05)`.
- Hatch `--hatch` / `--hatch-line`; gauge-off `--gauge-off`.
- Heat steps `--heat-0..4`: dark `rgba(255,255,255,.05)`, `#312e81`, `#4338ca`, `#6366f1`, `#a5b4fc`; light `rgba(15,18,34,.05)`, `#e0e7ff`, `#a5b4fc`, `#6366f1`, `#3730a3`.
- `--good-soft` / `--bad-soft` delta backgrounds (14% dark, 10% and 9% light).
- Insight gradient `--insight-a` `#4f46e5` to `--insight-b` `#7c3aed`, radial from top right, white text.
- Series: `--series-1` indigo, `--series-2` `#0d9488`.
- Event colours: read teal, write accent-text, external orange, error red.

### Named Rules
**The One Accent Rule.** Indigo marks the single active or focused thing on a card; everything else is neutral or hatched.
**The Light-Mode Contrast Rule.** Dark-mode status and event hues fall under 3:1 on light surfaces, so light mode swaps in darker steps (success `#047857`, error `#b91c1c`, warning `#b45309`, teal `#0f766e`, orange `#c2410c`, violet `#6d28d9`) that reach 4.5:1 on card and pop. Never reuse a dark-mode hue on a light surface.

## Typography

**Font:** Inter Variable, then Inter, system-ui, sans-serif. Monospace (`ui-monospace`, 12.5px) for identifiers and paths only. Body is 15px with tabular numbers.

### Hierarchy
- **Page title** (600, 30px, -0.03em; 26px under 760px): greeting and page heads. Scope suffix `.h1-scope` is 17px/500 muted.
- **KPI / stat value** (600, 28px KPI, 26px stat, 32px gauge; -0.02 to -0.03em).
- **Card title** (600, 17px, -0.01em).
- **Insight text** (500, 19px).
- **Control** (500, 14px): pills, buttons, selects, tables.
- **Caption** (13px muted): card subtitles, KPI labels, legends. Axis and heat labels 11 to 12px.

**The Tabular Rule.** Every number sits in tabular figures; do not set numerals in a second face.

## Layout

Sticky top bar (three-column grid: logo and app picker, centred pill nav, tools) with blurred ground. Content is centred, max 1320px, 28px side padding (16px under 760px). Grid gap is 16px throughout. Overview is a main column plus a 300 to 360px side column: four KPI tiles, chart and map preview in main; gauge, insight, activity and heatmap in side. Breakpoints: 1180px (pill nav drops to its own row, overview becomes one column) and 760px (KPIs two-up, card radius falls to 20px and padding to 16px, map 400px high).

## Elevation & Depth

Hybrid and shallow. Cards sit on the ground with a hairline border plus `--shadow-card`; in dark mode that is only an inset highlight, so depth is tonal (void < base < card < pop). Floating things (chart tooltip `0 8px 24px rgba(0,0,0,.18)`, command palette `0 24px 64px rgba(0,0,0,.3)`) are the only strong shadows.

**The Tonal Depth Rule.** In dark mode, separate surfaces by tone and border, not by shadow.

## Shapes

Pills (999px) for nav, buttons, selects, badges, chips, deltas, segmented controls; 24px for cards and KPI tiles; 20px for the map, previews and stats; 12px for KPI icon boxes, tooltips and fields; 28px for the palette; 3 to 8px for bars, cells and uptime days. Round arrow links are 34px circles.

## Components

### Top bar
Logo, app picker (`Picker`: a pill button with a chevron that turns over when open, opening a listbox popover; see Shared pieces), pill nav (white-on-accent active item, muted otherwise, icon plus label; Left, Right, Home and End move between items via `rovingKeys`), icon buttons (40px circles, card ground, hairline, shadow; active uses accent-soft and accent text). Panels with `place: "tools"` render as icon buttons.

### KPI tile
Card ground, 24px radius, 40px outlined icon box top left, round arrow link top right, value, label, then a delta pill. Delta pills use good-soft or bad-soft with an icon and signed percentage plus a screen-reader phrase, or a flat neutral pill. The arrow link and the delta pill each have a `Tip` (the delta's reads "Change on the previous 24 hours").

### Column chart
Hatched 135-degree bars (14% and 26% tint stripes of the series colour), one solid highlighted bar (`.on`), dashed gridlines, tooltip pill above the focused bar. Stacked segments gap 3px.

### Segmented arc gauge
SVG of round-capped line segments (6.5 stroke): on in accent, off in `--gauge-off`; value centred at 32px.

### Weekly heatmap
Day by hour grid of 3px-radius cells, quartile steps `h0..h4`, "Less / More" legend and footer labels.

### Insight card
Radial indigo-to-violet gradient, white 19px text, a decorative spark icon in a translucent circle beside the sentence (no label above it: the sentence is the content, and the card is named "Insight" for assistive technology only). The sentence is computed from real numbers; with nothing notable to say, the card is not shown. One per page at most.

### Activity list, badges, kind pills
Rows with 1px hairline dividers. Badges are pop-ground pills with a coloured icon (ok, bad, none). Kind pills are pop-ground with colour from the event colours; the word always shows.

### Segmented control, buttons, chips, tables
Segmented: pop track, selected segment lifts onto card ground. Buttons are pills; primary is accent with white text, danger is red text. Chips toggle with `aria-pressed` (off state is dimmed and struck through). Tables: 14px, hairline row dividers, 12px muted header, wrapped for horizontal scroll. Rows tint to the pop ground on hover. Headers are sort buttons (`aria-sort`, a sort icon that is dim until active); a column sorts when every cell is a plain number or string, or when `keys` supplies one sortable value per cell for element cells. Values with units ("12 ms", "1.2 s") sort numerically. An empty table shows an `EmptyState`.

### Shared pieces (`ui.jsx`, `tasks.jsx`)
Each has a keyboard path, a screen-reader name and a reduced-motion form. Styles are in the "Shared pieces" section of `app.css`.
- **Tip** (tooltip): opens after 500 ms on hover or focus. After one closes, neighbours open at once for 400 ms ("warm"). Escape closes. It links to its trigger with `aria-describedby` unless `describe={false}` (used when the text only repeats the label). Dark-on-light pill, 12.5px, `role="tooltip"`.
- **Toasts** (`ToastProvider`, `useToast`): bottom-right region labelled "Notifications (Alt+T)", a polite live region. Each toast lasts 4 s and pauses on hover or focus. Alt+T focuses the newest, Escape dismisses it, and there is a close button. At most 3 show. Tones: info, good, bad (icon colour only; the title is the content).
- **Switch**: `role="switch"`, Space or Enter toggles. The thumb slides on the house ease-out (0.26s, no bounce) and stretches (20px to 24px) while pressed. Accent track when on.
- **HoldButton**: for destructive admin actions instead of `confirm()`. Hold the pointer, Space or Enter for 1.2 s; releasing or leaving early cancels. A fill (`scaleX`) shows progress, and a screen-reader hint says "Press and hold to confirm." Under reduced motion the fill jumps rather than running.
- **EmptyState**: icon tile, bold title, muted text, optional action. **Skeleton**: pop-ground blocks with a 1.6 s shimmer, `role="status"` labelled "Loading"; the shimmer is off under reduced motion.
- **Picker**: button plus listbox popover (`aria-activedescendant`). Arrows, Home, End and typing a letter move; Enter or Space chooses; Escape, Tab or a click outside closes. Focus returns to the button. The popover scales in from 0.96 over 0.18s.
- **rovingKeys**: one handler for rows of links or buttons (pill nav, segmented controls). Arrows wrap, Home and End jump, Tab still leaves the row.
- **useRowHighlight**: one pop-ground highlight slides between list rows with `translate` (height and opacity follow), 0.24s on the house ease. Rows carry `data-row`. No layout animation.

### Task chip (`tasks.jsx`)
State of one action the owner started, rebuilt from React Bits' Call Chip. Used in Access for saving settings, moderation actions and signing users out. `useTask()` runs `{ name, arg, expectedMs, action }` and returns the task, `run` and a retry.
- States: queued, running, done, failed, cancelled. Each shows a glyph, a word, and elapsed seconds as text.
- Running: the fill moves towards 90% of the expected time (default 1.5s), or follows a real `progress` value, and waits there. Done snaps full with a tick and a good-soft fill. Failed freezes where it was, shakes once (450ms), turns bad-soft, shows the error, and offers a Retry button.
- `role="status"`, `aria-busy` while running, and one spoken sentence (name, argument, state, time, detail). Reduced motion keeps the fill still and drops the shake.

### Live map and preview
Canvas graph on `--bg-void`, 600px high (400px small), 20px radius, keyboard-focusable with a caption line. Pulses travel along an edge and end in a ring on the node. The Overview preview (220px) reuses the same events. The look follows ReactVibe's Node Flow (observed live on 2026-11-01): soft filled nodes, thin lines, small dots travelling along lines. Nodes are larger than Obsidian's with a faint same-colour halo. Each pulse is a single crisp dot (no glow; canvas blur is costly at up to 50 events a second). An ambient flow keeps two faint, slow dots on every line active in the last 60 s: 2.6 s per trip, fading as the activity ages, at most 60 lines, off under reduced motion. React Flow was evaluated and not adopted: it is a diagram editor rather than Obsidian-style physics, and SVG animation per event is the risk.

### Motion
Timings come from `choreography.js` (the Reroute port): one ease-out quint `[0.22, 1, 0.36, 1]`, `DUR` press 0.14s, hover 0.15s, fade 0.2s, panel 0.22s, morph 0.45s; stagger 30ms capped at 7. CSS uses `--ease-out`, `--dur-hover`, `--dur-press`. Transform and opacity (or `translate`/`scale`) only; no layout animation. Map pulses are eased travel along an edge (read teal, write indigo, external orange, error red). With reduced motion (`reduced.js`, plus the CSS media query clamping durations) the edge lights briefly, camera moves are instant, and nothing slides.

**Moving between pages** (`motion/pages.js`, from the reference clips chosen on 2026-11-01):
- **Nav pill:** one accent pill behind the tabs stretches to the new tab. The leading edge travels 360ms on power3.out; the trailing edge travels 550ms on power3.inOut, so it lags and then catches up. Built as a sampled `clip-path` Web Animation.
- **Page out:** the leaving page fades and blurs to 6px in about 90ms.
- **Page in:** this was measured from the reference clip.
  - Titles (`.rise` inside a `.rise-mask`) slide up from behind their own baseline over 700ms, starting at 150ms.
  - Then the blocks (state line, KPI tiles, cards, toolbars) rise 24px into place in reading order, 65ms apart. They resolve from `blur(8px)` and opacity 0 over 650ms on the house ease, starting at 270ms.
  - Up to 12 blocks are staggered; any later ones arrive together, through `choreography.js`'s `fx`.
  - This is slower than Reroute's in-app entrances on purpose, because a page change is a moment to re-orient.
- **Numbers count up:** KPI values and the uptime percentage climb from 0 as their tile arrives (each delayed to match its tile), over 1.1s on the house ease, and glide from old to new on refresh (`CountUp` in `charts.jsx`). They are written straight to the text node, never more decimals than the real value has; screen readers get only the final value.
- **Theme switch:** the new theme grows in a circle from the toggle over 450ms (View Transitions, `::view-transition-new(root)`). Where View Transitions are unsupported, the switch is instant.
- **Small pieces:** tooltips fade and scale in (0.14s), popovers scale in (0.18s), toasts rise 12px (0.32s), the switch thumb slides (0.26s), and rows that arrive live on the Events page slide in 6px (`row-in`, 0.36s). The first load of a table does not animate its rows. All use the house ease and `translate`, `scale` or opacity only.
- **Reduced motion:** the pill jumps, blocks appear at once, and the theme switches instantly. Blur is the one exception to "transform and opacity only". It is kept at 8px or less, and it runs on page changes only, never while scrolling.

### Accessibility
- Every chart has a `details` table ("table-toggle") or text equivalent; gauge is `role="img"` with a label; decorative plots are `aria-hidden`.
- Status never relies on colour alone: badges and deltas carry an icon and text; kind pills carry the word; uptime days use colour with the table beside.
- `:focus-visible` is a 2px accent-text outline, 2px offset. Skip link, named map region, `sr-only` phrases for deltas.

### Sources
Behaviour follows HeroUI and React Aria; the sliding row highlight takes Aceternity's card-hover idea; the task chip and hold-to-confirm come from React Bits' Call Chip and its hold-to-confirm idea; the map look is ReactVibe's Node Flow. All were rebuilt on Mycelium's tokens with no new dependency.

### Adding a panel
Add one module and one registry entry in `web/src/panels/index.js` with `id`, `title`, `short` (pill label), `icon` (a name in `icons.jsx`), `requires` (capability list; the panel hides if the app lacks any), `component`, and optionally `place: "tools"`. Build it from the existing card, KPI, chart and table components, and give each visual a table or text equivalent.

## Do's and Don'ts

### Do:
- **Do** use `var(--token)` only; no raw hex in components (the white text on accent and insight is the exception).
- **Do** put both light blocks in step when adding a themed token.
- **Do** keep base tokens, `choreography.js`, `reduced.js` and `motion/fm.js` in step with Reroute.
- **Do** pair every status colour with an icon or word.

### Don't:
- **Don't** add a second accent colour or a fully solid bar chart; one solid bar per chart.
- **Don't** animate layout properties or use ease-in.
- **Don't** introduce hard offset shadows; depth is tonal and soft.
- **Don't** use dark-mode status hues on light surfaces.
