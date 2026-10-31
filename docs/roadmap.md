# Mycelium roadmap

**Status:** plan, 2026-10-31. Written with Claude Code from Tristan's expansion notes; needs human review. Steps 1 to 8 of the original build are done (see [architecture.md](architecture.md)); this file covers everything after them.

## The brief (2026-10-31)

Tristan's notes, restated:

1. Monitor anything: games, apps, product sales and retail statistics, not just web apps.
2. Security as a first-class feature: build and harden projects with AI, and see and manage security threats from the website.
3. Full, easy setup for each kind of project the site is pointed at, using setup files and scripts that the website itself provides for whatever project an admin is working on.
4. A setup script that plugs a project's code into the site's agent and security outlines and policies, turning Mycelium into an all-in-one security and monitoring tool.
5. An installable web app, plus a setup script (PowerShell) that gives admin-level control over the system.
6. As easy as possible: a cheap AI agent looks at a repo or project, analyses security and everything else, builds the right monitoring, and hands the user the scripts and code changes for the emitters.
7. Regulatory technology (RegTech): support it in Mycelium, and later build a parallel website for system-wide compliance automation at enterprise companies.

## How each part applies, and what is possible

| # | Part | What it means in Mycelium | Builds on | Possible? |
|---|---|---|---|---|
| 1 | Monitor anything | More **connectors**: emitters for more languages and engines, webhook receivers for sales platforms, and generic OpenTelemetry for anything that already speaks it. New panels (Sales, Players) register like the existing ones. | Event format, ingest keys, collector and panel registries, `/v1/logs` and `/v1/metrics` | Yes. Each connector is small; the event format already carries `kind`, `usd` and `meta`. |
| 2 | AI hardening and threat management | A **Security** area: a threat feed (failed sign-ins, rate-limit hits, errors, unusual access), a posture checklist per project (dependencies, secrets, headers, TLS, config), and actions (sign users out, block an address, rotate a key) through each app's admin API. | Admin proxy, audit log, sign-in, Access panel | Yes, as detection plus owner-approved actions. AI suggests fixes; a person approves them. |
| 3 | Setup files from the website | A **setup kit**: a page where the admin picks a project type and gets a generated script and config (emitter install, keys, Claude hook, OTEL, host agent) with a dry run, an uninstall and a checksum. | `manage.py add-app`, the Claude hook installer steps, `hooks/claude/README.md` | Yes. Generated scripts are templates plus values; nothing secret is embedded beyond the key the admin asked for. |
| 4 | Plug into agent and security policies | A **policy pack** the setup script writes into each project: `CLAUDE.md` or `AGENTS.md` rules, Claude Code permissions and hooks, `SECURITY.md`, pre-commit checks (secret scanning, dependency audit), and CI steps, so AI agents and people working on the project follow the same rules Mycelium monitors. | `CLAUDE.md` conventions, the Claude hook, CI workflow | Yes. The pack is files in the repo the admin can read and change. |
| 5 | Installable app and admin-level script | **Installable:** a PWA (manifest, icons, service worker for the shell only). **Admin-level:** a host agent (a Windows service or systemd unit) installed by an elevated PowerShell or bash script. | Web app, Reroute's PWA experience | The PWA is easy. A host agent is possible but is the riskiest piece: see "Limits" below for the safe shape. |
| 6 | Cheap AI agent that analyses a project | `mycelium scan`: a local command (and a website button for linked repos) that runs static tools first (graphify's AST, dependency audits, secret scanning), then asks a small Claude model to turn the findings into a monitoring plan, emitter patches and security fixes, delivered as a diff or pull request. | graphify (already parses repos for the map), the emitter API, Claude Code formats notes | Yes. Static tools do the heavy lifting so the model reads summaries, not whole repos; that keeps it cheap and keeps most code on the machine. |
| 7 | RegTech in Mycelium | A **Compliance** module: a control library per framework, each control mapped to evidence Mycelium already collects (audit log, sign-in records, uptime, scans, config checks), with gaps and exportable reports. First framework: the ACSC **Essential Eight** (free, Australian, widely asked for by Australian businesses), then ISO 27001 Annex A and SOC 2 mappings, and privacy obligations (Australian Privacy Principles, GDPR). | Audit log, posture checks, host agent | Yes, as evidence collection and gap tracking. It supports an audit; it does not certify anyone or give legal advice. |
| 8 | Parallel enterprise RegTech site | A **separate product and brand** on the same core engine: organisation-wide automation (many systems, many teams), SSO, roles, retention policies, tamper-evident audit, and framework packs. | Everything above, once multi-user exists | Possible as a long-term product. It needs market validation and enterprise features (SSO, data residency, its own security assurance) before it can sell. |

## Limits and decisions

- **No arbitrary remote control.** "PowerShell, admin-level control from the website" would make Mycelium a remote administration tool: anyone who took over the site or a session could run anything on every connected machine. The safe shape:
  - **Read-only first.** The host agent starts as a collector only (Windows security events such as failed logons and Defender detections, firewall state, patch level; Linux auth logs, fail2ban), connecting outbound to Mycelium. It opens no listening port.
  - **Allow-listed actions only, later.** A short list of named actions (block an address in the firewall, restart a named service, rotate a Mycelium key), each with fixed parameters. Never a free-text command.
  - **Approval and proof.** Every action is approved by the owner in the site, signed by the server, checked by the agent, logged at both ends, and the agent has a local kill switch.
  - **Elevation only to install.** The installer needs admin rights to register the service; the service itself runs with the least rights its collectors need.
- **AI suggests, people approve.** The scan never pushes to `main` or changes a server by itself; it produces a diff, a pull request or a script for review.
- **Code privacy.** By default, `mycelium scan` runs the static tools locally and sends the model only summaries (file names, findings, the AST outline). Sending full files is opt-in. The owner's own Anthropic API key pays for it, with a spending cap per scan.
- **Private site versus a product for others.** v1 is one owner's private site behind Tailscale. For other people, the recommended shape is **self-hosted**: each admin runs their own Mycelium (Docker image or installer), and a small public website hosts documentation, the setup kit and signed downloads. That keeps each customer's security data on their own infrastructure, which suits a security product, and avoids running a service that holds other people's threat data. A hosted service can come later.
- **Compliance wording.** The Compliance module reports evidence and gaps against published control lists. It must not claim that a business "is compliant" or reproduce copyrighted standard text (ISO control text is copyrighted; control numbers and short titles are fine; the Essential Eight is published freely by the ACSC).
- **Decisions for Tristan (open):**
  1. Who is the first user after you: friends' projects, UQ students, or small businesses?
  2. A licence for the public repo (for example MIT or AGPL) before others use it.
  3. Whether the host agent should ever run actions, or stay read-only.
  4. Which compliance framework to start with (Essential Eight is the recommendation).
  5. Whether the enterprise RegTech site is a learning project or a business to validate (interviews before code).

## Architecture changes

- **Core, products and connectors.** Split the repo into the core engine (ingest, storage, bus, auth, admin proxy, audit), the Mycelium web app, connectors (emitters, webhooks, host agent), and later the RegTech web app. Both products use the same core and event format.
- **Organisations.** Add `org` to every table (the v1 tables already carry `app`, so this is a migration), plus members with roles (owner, admin, viewer) and per-organisation keys and quotas. Planned since the first spec.
- **Sign-in for others.** Passkeys and OAuth, alongside Tailscale and the password.
- **Connector protocol.** Write down the event format, ingest auth and webhook signing as a versioned spec (`docs/protocol.md`) so third-party emitters can be built against it.
- **Tamper-evident audit.** A hash chain over audit rows, so an export can prove nothing was removed. Compliance needs this.

## Plan of attack

Each phase ends in something usable. Effort: S is about a day, M a few days, L a week or more of evenings.

### Phase 0: finish v1 (next)

| Step | How | Done when | Effort |
|---|---|---|---|
| 0.1 Deploy | Step 9 of the original plan: Docker image on LXC 101, `tailscale serve` on its own port, env vars from the step 7 list. **Done 2026-10-31:** see `infra/homelab/README.md` | Mycelium runs on the homelab and Reroute reports to it | M |
| 0.2 Merge Reroute PRs | Review and merge tristan-pofandt/reroute#17 and tristan-pofandt/reroute#18, set `MYCELIUM_URL`, `MYCELIUM_KEY` and `PLANB_ADMIN_TOKEN` on the server. **Done 2026-11-01** (Reroute `main` `e44f150`) | Live events and the Access panel work against production Reroute | S |
| 0.3 Screen reader pass | NVDA on Windows over the main flows | Findings fixed or listed | S |

### Phase 1: ready for other people

| Step | How | Done when | Effort |
|---|---|---|---|
| 1.1 Installable app | Web app manifest, icons, a service worker that caches only the app shell (never API data) | "Install" appears in Chrome and Edge; the app opens in its own window | S |
| 1.2 Organisations and roles | `org` columns, members, roles, per-org keys; migrations | Two orgs on one server cannot see each other's data (tests) | L |
| 1.3 Sign-in for others | Passkeys and OAuth; invitations | A second person can be invited as a viewer | M |
| 1.4 Packaging | Published Docker image, a one-line installer, signed releases with checksums | A fresh machine runs Mycelium in under ten minutes from the docs | M |
| 1.5 Protocol spec and licence | `docs/protocol.md`; pick a licence | Someone else could write an emitter from the spec alone | S |

### Phase 2: monitor anything

| Step | How | Done when | Effort |
|---|---|---|---|
| 2.1 Node and TypeScript emitter | Port the Python emitter; Express and Next.js helpers | A Node app shows up on the map | M |
| 2.2 Webhook receiver | `POST /ingest/webhook/<provider>` with each provider's signature check; map payloads to `cost` and `sale` events with amounts and product ids, never customer details | A test Stripe event becomes a `sale` event | M |
| 2.3 Sales connectors and panel | Stripe, Shopify and Square; a Sales panel (revenue per day, top products, refunds) | Sales from a test store appear in the panel | M |
| 2.4 Game connector and panel | A Unity (C#) emitter first, then Godot; events for sessions, players online, crashes and in-game purchases; a Players panel | A sample Unity game reports sessions and crashes | L |
| 2.5 Generic OpenTelemetry | Accept OTLP from any app (not only Claude Code), with an allowlist per app | An app instrumented with OpenTelemetry appears without a Mycelium emitter | M |

### Phase 3: setup kit and policy pack

| Step | How | Done when | Effort |
|---|---|---|---|
| 3.1 Setup generator page | The admin picks a project type (Flask, Node, Unity, static site, game server) and options; the site generates a PowerShell and a bash script plus config files | Scripts download with a checksum and a dry-run flag | M |
| 3.2 Script behaviour | Idempotent, `-WhatIf` / `--dry-run`, an uninstall, and logs of every change; installs the emitter, writes env and config, registers the Claude hook and OTEL settings | Running twice changes nothing; uninstall restores the project | M |
| 3.3 Policy pack | Templates for `CLAUDE.md`/`AGENTS.md` rules, Claude Code permissions and hooks, `SECURITY.md`, pre-commit (secret scan, dependency audit) and CI steps | A project set up with the pack blocks a committed secret | M |

### Phase 4: AI analyst

| Step | How | Done when | Effort |
|---|---|---|---|
| 4.1 `mycelium scan` (static) | graphify AST, dependency audits, secret scan, header and config checks; output a findings file | A scan of Reroute lists its stores, endpoints and external APIs, matching what was wired by hand in step 5 | M |
| 4.2 Model step | Send the findings summary to a small Claude model with a fixed prompt and schema; it returns a monitoring plan, emitter patches and fixes; prompt caching and a spend cap; check current model choice and pricing at build time | A scan of a new project produces a patch that compiles and passes its tests | M |
| 4.3 Deliver as a pull request | Optional GitHub integration that opens a PR with the patch and an explanation | The PR is reviewed and merged like any other | S |
| 4.4 Website button | Linked repos can be scanned from the site; results become posture items | A scan result shows up in the Security area | S |

### Phase 5: security centre

| Step | How | Done when | Effort |
|---|---|---|---|
| 5.1 Threat feed | New event kinds (`auth`, `ratelimit`, `security`); Reroute emits failed sign-ins and rate-limit hits; a Security panel with a feed and simple anomaly rules such as spikes (location-based rules are out of scope, since client addresses are never stored) | A burst of failed sign-ins raises a visible alert | M |
| 5.2 Posture checklist | Per project: dependency vulnerabilities, secrets, headers, TLS, admin token set, backups; a score with the evidence behind each item | Reroute's posture shows real findings | M |
| 5.3 Alerts | Email, push or ntfy for alerts; quiet hours | A test alert reaches the phone | S |
| 5.4 More actions | Block an address and rotate keys through the admin protocol, approved and audited like step 7 | Actions work against Reroute and appear in the audit log | M |

### Phase 6: host agent

| Step | How | Done when | Effort |
|---|---|---|---|
| 6.1 Read-only agent | A small Go or Python service; Windows Event Log (logon failures 4625, Defender detections, firewall changes) and Linux auth logs; outbound only; installed by an elevated setup script | The homelab LXC and the desktop VM report security events | L |
| 6.2 Allow-listed actions | Signed, approved, logged actions from the fixed list; local kill switch | Blocking a test address works and leaves an audit trail on both sides | L |

### Phase 7: Compliance module (RegTech in Mycelium)

| Step | How | Done when | Effort |
|---|---|---|---|
| 7.1 Tamper-evident audit | Hash chain on audit rows; verification on export | Editing an audit row is detected | S |
| 7.2 Control library | Framework packs as data (control id, short title, evidence queries); start with the Essential Eight maturity levels | Each Essential Eight strategy shows evidence or a gap for the homelab | M |
| 7.3 Evidence and reports | Map posture checks, agent data and audit records to controls; export a report (PDF or Markdown) | A report lists every control with evidence links and gaps | M |
| 7.4 More frameworks | ISO 27001 Annex A and SOC 2 mappings (titles only), privacy obligations | Two frameworks share evidence without duplication | M |

### Phase 8: enterprise RegTech site (parallel product)

| Step | How | Done when | Effort |
|---|---|---|---|
| 8.1 Validate | Talk to people who do compliance work (interviews, with consent and no personal data in notes) about where automation saves them time | A one-page problem statement with evidence | M |
| 8.2 Shared core | The core engine as its own package used by both products | Both web apps build against the same core | M |
| 8.3 Enterprise basics | SSO (SAML or OIDC), fine-grained roles, retention policies, data residency options | An enterprise pilot checklist is met | L |
| 8.4 Separate site and brand | A new web app for organisation-wide automation, framework packs and reporting | A pilot organisation can run it | L |

## How this fits Tristan's goals

The security parts (threat feed, posture, host agent, Essential Eight evidence) double as cybersecurity portfolio work, and the homelab is the first place to run them. See the vault note `Career/Career and Cybersecurity.md`.
