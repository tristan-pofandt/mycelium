# Mycelium: product

**What it is.** A monitoring hub for several apps at once: status and uptime, costs, usage, API calls, owner-managed access, and a live, Obsidian-style map of every file, data store, endpoint and external API, with a pulse along a line each time Claude Code or the app reads or writes something. The first monitored app is Reroute.

**Who uses it.** One owner today (Tristan), checking a few times a day, often at a glance, and acting on access when something is wrong. Later: other developers and small teams running their own self-hosted copy (see `docs/roadmap.md`).

**The job.** Answer, in one look: is each app up, how did traffic and errors move against yesterday, what is it costing, and what is touching its data right now. One click leads to the detail or the action.

**Mode.** Operate: a working dashboard. Scanability, consistent controls and accessible equivalents for every visual outrank expression.

**Brand commitments.**
- Motion and base tokens come from Reroute (`web/src/choreography.js`, the base of `web/src/tokens.css`) and stay in step with it.
- The look is the card-based dashboard chosen on 2026-11-01 from Tristan's reference dashboards: top pill navigation, soft rounded cards, hatched charts with one solid accent bar, a segmented gauge, a weekly heatmap, one indigo-violet accent, and a theme that follows the system with a header toggle. `DESIGN.md` is the rulebook.
- The live map is the signature: it stays central, on its own page and as a card on the Overview.

**Constraints.**
- Private: served on the owner's tailnet only; the repository is public.
- Events carry metadata only: never contents, bodies, tokens, keys or personal data.
- Every visual has a keyboard and screen-reader equivalent; status is never colour alone; reduced motion is honoured.
- Nothing is invented: numbers, insights and states come from real data.
