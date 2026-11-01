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
Logo, app picker (pill select with chevron), pill nav (white-on-accent active item, muted otherwise, icon plus label), icon buttons (40px circles, card ground, hairline, shadow; active uses accent-soft and accent text). Panels with `place: "tools"` render as icon buttons.

### KPI tile
Card ground, 24px radius, 40px outlined icon box top left, round arrow link top right, value, label, then a delta pill. Delta pills use good-soft or bad-soft with an icon and signed percentage plus a screen-reader phrase, or a flat neutral pill.

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
Segmented: pop track, selected segment lifts onto card ground. Buttons are pills; primary is accent with white text, danger is red text. Chips toggle with `aria-pressed` (off state is dimmed and struck through). Tables: 14px, hairline row dividers, 12px muted header, wrapped for horizontal scroll.

### Live map and preview
Canvas graph on `--bg-void`, 600px high (400px small), 20px radius, keyboard-focusable with a caption line. Pulses travel along an edge and end in a ring on the node. The Overview preview (220px) reuses the same events.

### Motion
Timings come from `choreography.js` (the Reroute port): one ease-out quint `[0.22, 1, 0.36, 1]`, `DUR` press 0.14s, hover 0.15s, fade 0.2s, panel 0.22s, morph 0.45s; stagger 30ms capped at 7. CSS uses `--ease-out`, `--dur-hover`, `--dur-press`. Transform and opacity (or `translate`/`scale`) only; no layout animation. Map pulses are eased travel along an edge (read teal, write indigo, external orange, error red). With reduced motion (`reduced.js`, plus the CSS media query clamping durations) the edge lights briefly, camera moves are instant, and nothing slides.

### Accessibility
- Every chart has a `details` table ("table-toggle") or text equivalent; gauge is `role="img"` with a label; decorative plots are `aria-hidden`.
- Status never relies on colour alone: badges and deltas carry an icon and text; kind pills carry the word; uptime days use colour with the table beside.
- `:focus-visible` is a 2px accent-text outline, 2px offset. Skip link, named map region, `sr-only` phrases for deltas.

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
