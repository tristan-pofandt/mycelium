---
version: 1
slug: "web-src"
primary_target: "web/src"
related_targets: []
---

Scope: the whole Mycelium web app (Operate mode): Overview, Live map, Status, Costs, Usage, API details, Transactions, Event log, Access, Settings.
Audience and job: one owner (later small teams) checking whether their apps are healthy, what they cost and what is touching their data, several times a day, often at a glance; acting on access when something is wrong.
Constraints: Reroute's motion (choreography.js, reduced motion) stays; accessible equivalents for every visual; no personal data shown beyond what admin actions need.
Decisions (2026-11-01, Tristan): top pill navigation; theme follows the system with a header toggle; indigo-violet accent (Reroute's).
Pinned references: four dashboard shots Tristan supplied (soft rounded cards, icon KPI tiles with delta pills and an arrow button, hatched bars with one solid accent bar and a tooltip pill, segmented arc gauge, activity heatmap, an insight card).

## Direction contract

THESIS: A calm, card-based monitoring dashboard in the style of Tristan's references, where the live map is the one thing no other dashboard has. It refuses the dense grey ops console: big quiet cards, one accent, data that reads in a glance.
OWN-WORLD: Soft ground (cool grey in light, near-black in dark), white or charcoal cards at 24px radius with hairline borders and a faint shadow, Inter, tabular figures, indigo-violet accent used for the active pill, the focused bar, gauge segments and pulses; other bars hatched in a pale tint; status green, amber, red only where they mean something.
STORY: The owner sees at once whether the app is up, how traffic and errors moved against yesterday, what it cost, and where data is flowing right now; one click opens the detail.
FIRST VIEWPORT: Header with logo, app picker, centred pill tabs with icons, search, live status, theme and access/settings icons. A greeting with the app's state. Four KPI tiles (requests, errors, p95 latency, cost today) with deltas. A requests chart (two-thirds) beside an uptime gauge, then a live map card, recent activity and a weekly heatmap.
FORM: pinned by the user's reference images (code-led, Operate); concept-seed was not run because the direction was pinned. seed: none (unavailable)
SIGNATURE: the live map card on the Overview, pulsing with real reads and writes, opening the full Obsidian-style map.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
