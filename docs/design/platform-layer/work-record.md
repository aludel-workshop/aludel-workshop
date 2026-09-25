---
id: platform-ux-01
kind: work-record
status: built
updated: 2026-09-24
depends_on: [portal-layers-model, lay-07, platform-pipeline-01, pages-ux-01]
---

# PLATFORM-UX-01: Platform splits into Code and Deploy

## Authorization and scope

- **Owner instruction (chat, 2026-09-24):** "next, im looking at platform … perhaps also needs to be split, into two layers: code and deployment … we're going to follow much the same process as our past couple reworks: take a look at what role this fills in the space between the other layers, look at how this is currently being managed elsewhere, and make things visible, interactive, fully owned by user. to start with, code … suggest improved Code subfeatures. then deployment … don't try to design the integrations now, just capture that existing worldview." (DEC-029 interim chat authorization; DEC-044 pass pattern.)
- **Order:** `next_action` stays PLATFORM-PIPELINE-01. This pass supplies the UX that PP-01D (Environments) was waiting for, and the Platform half of DATA-PLATFORM-UX-01.
- **Authorized now:**
  - research, including public reference screenshots saved in `refs/`;
  - this record;
  - a static clickable prototype (v1) with illustrative Tool Share data;
  - the reusable capture tool `tools/capture-refs.mjs`.
- **Excluded:** portal code, schema or data changes, provider calls, integrations, spending and external writes. The build waits for the owner to accept a prototype round.

## Owner brief ledger

| # | Ask (condensed) | Position | Prototype v1 |
|---|---|---|---|
| C1 | Split Platform into two layers: **Code** (architecture, code, repository, perhaps releases) and **Deploy** (environments, database, domains), bridged by releases | Proposed by owner; recommended (§4) | Two nav tiles, Code and Deploy, with Releases in Code and shown in Deploy's pipeline |
| C2 | The Code tab is the heart. Today it "lumps everything into a stack". It needs a tree nav, like VS Code's explorer but in smaller chunks | Required | Explorer: a tree with **Structure** (app → parts → units) and **Files** views, and a detail pane |
| C3 | Not an IDE. No direct code editing, but seeing the sections is useful | Required | Read-only source with an outline; "Request a change" becomes Engineer work (the Pages rule) |
| C4 | Architecture is a brief of "front end = x" fields. Is that enough? Should it live under releases (packages, frameworks, versions)? | Question | §4.2: Stack is read from the manifests, never typed. Structure is a derived diagram. Decisions are ADRs. Each release keeps a snapshot, so versions diff between releases |
| C5 | Which roles use this, and how do they expect it presented? What am I missing? | Question | §3 roles; §4.4 missing pieces |
| C6 | Suggest improved Code subfeatures | Required | Overview, Explorer, Dependencies, Changes, Releases (§4.3) |
| C7 | Deploy is light because deployment was still unclear. With the repository and container hardening, what does the team taking the code to a live app need? | Required | Pipeline, Environment detail (variables, services, history, logs, limits), Database, Domains, Monitoring (§4.5) |
| C8 | Look forward to handoff: follow how these tasks are handled today, capture that shared worldview so later sync (integration or import/export) fits. Don't design the integrations now | Principle | Every concept maps to an existing one (§2 table); files the app owns are named per screen |
| C9 | Visible, interactive, fully owned by the user | Principle | Each screen names the file in the app's repository it reads (Dockerfile, `.env.example`, `package.json`, `docs/adr/`) |

## 1. What this task reveals about the process

- **Reference capture was ad-hoc, and failures went unrecorded.** The Pages retrospective predicted a reusable capture script would help, and this pass needed one straight away. **Applied now:** [tools/capture-refs.mjs](../../../tools/capture-refs.mjs):
  - it finds Playwright on its own and captures each target;
  - it writes `refs/manifest.json` with the URL asked for, the final URL, the HTTP status, the title, the access time and a failure reason.
- **Tested in this pass (observed):** 42 attempts over 3 runs, 35 targets, 31 usable.
  - The tool flagged HTTP 403/404 failures itself.
  - Looking at the images found a Backstage "Entity not found" page that the tool had marked ok. The not-found check was extended, and on the next run the tool caught a second bad Backstage page by itself.
  - Argo CD's first capture showed only a loading spinner ("Checking session"). A longer wait fixed it.
  - Lesson written into the tool's header: a capture marked ok can still be the wrong page, so look at every image before citing it.
  - Failed images left in `refs/` could be cited by mistake. The tool now saves them as `<name>.failed.png`; a self-test (one 404, one good page) confirmed it.
- **Purpose test on today's Platform tabs** (operating procedure §2, as in DESIGN-UX-01 and PAGES-UX-01):
  - *Overview* passes as a summary.
  - *Architecture* partly fails:
    - the preset's layer list is typed configuration, not read from the app, so it can drift from `package.json`;
    - the "Services the app calls" and "Binding" tables pass (both are derived) but belong in Code › Overview and Data respectively.
  - *Code* passes on data (the LAY-07 index is derived and useful) but fails on navigation: one flat list of units plus a coverage table.
  - *Repository* passes but is thin.
  - *Releases* passes; its record is the bridge.
  - *Environments*, *Database* and *Domains* pass as operations but hard-code "Preview" and "Production" instead of reading the app's declaration (the PP-01A finding).
- **Real code shape found:** a generated app today is 387 lines in total, and the whole server is one `server/server.mjs`. Several features share each file, so a file tree cannot give "smaller chunks". The code index (units with their story and Data links, from LAY-07) has to supply the chunks. That is why the Explorer has a Structure view, not only Files.

## 2. Research (accessed 2026-09-24)

Screenshots are in `refs/`, and each one's status is in [refs/manifest.json](refs/manifest.json). "Screen" means a captured product screen; "docs" means documentation text only.

| Source | Evidence | Fact | Use |
|---|---|---|---|
| GitHub code view | Screen: `github-tree.png`, `github-blob-symbols.png` | A file tree beside the file, the last commit per entry, Code/Blame, and a symbols pane | Files view; read-only source with the last change and an outline (C2, C3) |
| GitHub repository home and Releases | Screen: `github-languages.png`, `github-releases.png` | Languages bar, About; a release is a tag with notes and assets | Code › Overview language bar; release = version + notes + artifacts (C4) |
| C4 model; Structurizr's Big Bank example | Screen: `c4model.png`, `structurizr-c4.png` | Four zoom levels: system context → containers (deployable or runnable units) → components → code | The Structure tree's levels: App → part (container) → component → unit (C2) |
| Backstage software catalog | Screen: `backstage-catalog.png`, `backstage-component.png`, `backstage-radar.png` | Component, API, Resource and System entities with owner, lifecycle, and relations drawn as a graph; `catalog-info.yaml` lives in the repository; Tech Radar | Part pages show owner, lifecycle and relations. The catalog vocabulary is the shared worldview for later sync (C8) |
| DeepWiki | Screen: `deepwiki.png` | An architecture wiki generated from a repository, with a table of contents and source-file citations per section | Code › Overview "How it's built" is generated and cites files; a new developer's view (C5) |
| StackShare | Screen: `stackshare.png` | A stack grouped by category, as tool tiles | Stack grouped by category, read from manifests (C4) |
| deps.dev (Open Source Insights) | Screen: `depsdev.png` | Per package: versions, dependencies, dependents, licences, advisories | Dependencies tab columns (C6) |
| Renovate dependency dashboard | Screen: `renovate-dashboard.png` (an old issue page, not the dashboard feature) | Update PRs grouped and scheduled | "Update dependencies" becomes Engineer work (C6) |
| ADRs (adr.github.io); arc42 | Screen: `adr-github.png`, `arc42.png` (docs pages) | Decisions recorded as context → decision → consequences; arc42 names constraints and quality goals | Architecture decisions and constraints (C4) |
| CodeScene hotspots; Nx project graph | Docs: `codescene-hotspots.png`, `nx-graph.png` | Hotspots = change frequency × code health; a graph of projects and their dependencies | Health overlay on the tree (churn and test coverage); not a separate graph screen in v1 |
| Heroku Pipelines | Screen: `heroku-pipelines.png` | Review apps → staging → production as columns; each card shows the running commit; "Promote to production" | Deploy › Pipeline (C7) |
| Railway | Screen: `railway-home.png`, `railway-canvas.png` (marketing screens, not a live trial) | An environment switcher; a staged "1 unapplied change → Deploy" bar; deployment detail with Build, Deploy and HTTP logs | Pending configuration changes; environment detail with logs (C7) |
| Argo CD demo | Screen: `argocd-demo.png` | Each app shows **Healthy** and **Synced/OutOfSync** separately, with target revision and last sync | Two independent states per environment: health and in step with its release (C7) |
| Vercel environments and promotion | Docs: `vercel-environments.png`, `vercel-promote.png` | Preview per branch, production, promotion of an existing build, instant rollback | Promote a build that already passed; don't rebuild. Rollback = promote an earlier release |
| Render preview environments; Supabase branching | Docs: `render-previews.png`, `supabase-branching.png` | A full copy of the stack per pull request; a database branch per preview | Preview environments per branch, each with its own database |
| Sentry release health; DORA | Docs: `sentry-releases.png`, `dora-metrics.png` | Crash-free sessions per release; deployment frequency, lead time, change failure rate, time to restore | Monitoring per release; four delivery measures on Deploy's overview |
| Kamal; Coolify | Docs/marketing: `kamal.png`, `coolify-home.png` | Deploy the same container to your own server; a self-hosted PaaS | Hosting targets in Environment settings (P5: owner can leave) |
| The Twelve-Factor App (12factor.net, known source, not captured) | — | Build, release and run are separate stages; config in the environment; backing services as attached resources; dev/prod parity; logs as event streams | The Deploy model's vocabulary |

**Gaps:**
- Sourcegraph returned 403.
- GitHub's deployments page returned 404 for three public repositories (probably sign-in only).
- Backstage's dependency tab was not found for two demo entities.
- Vercel, Render, Sentry and DORA were captured as docs pages, not product screens.
- Nothing here is a live trial of a paid product.

## 3. Roles and how they expect it presented

| Role | Today | What they come for | How their tools present it |
|---|---|---|---|
| **Engineer** (coding agents and the people who review them) | Platform › Engineer: implement, reconcile, dependencies, security, review | Where a change goes, what it touches, whether it's tested, what's out of date | A tree of the code with a read-only viewer (GitHub, Sourcegraph); PRs and checks; the dependency dashboard |
| **Tech lead / architect** (often the owner with an agent) | Nobody | Is the structure sound; which decisions constrain the next change; is the stack current | C4 diagrams, ADRs, catalog pages with owners and lifecycle (Structurizr, Backstage) |
| **Operator / release manager** (new; takes `platform.configure` and adds promote, rollback, backups, domains) | Engineer's `configure` action only | What's running where, is it healthy, what changed, can I roll back, what does it cost | Pipeline columns, per-environment variables, deploy history, logs, health vs sync (Heroku, Railway, Vercel, Argo) |
| **Owner, not coding** | Overview cards | Is it built, does it work, is it safe, what do I own if I leave | Plain status, story-to-code coverage, the list of files they own |
| **A developer taking over** (the handoff this product promises) | Nothing | How it's built, where to start, how to run it | README, AGENTS.md, generated wiki with source citations (DeepWiki), `docker compose up` |

**Recommendation:** split the Engineer role in two, following the layers. The **Engineer** keeps `implement`, `reconcile`, `dependencies`, `security` and `review` in Code. A new **Operator** role owns Deploy: `configure` (moved, still elevated), plus proposed `promote` (elevated), `rollback`, `backup`, `domains` and `incident`. This is a proposal for owner review, not a change to `config/roles.json`.

## 4. Proposal (agent recommendation; owner review pending)

### 4.1 The split

- **Code** answers "what have we built and how": the repository and everything that versions with it. That is the architecture, the code, dependencies, changes (branches, pull requests, commits) and **releases**.
- **Deploy** answers "where is it running and is it OK": environments, their configuration, attached services (database, email, storage), domains, monitoring and access.
- **Releases** are the bridge. This follows twelve-factor's build → release → run stages, Heroku and Vercel.
  - A release is an immutable build of one commit, with a version, notes generated from the stories it ships, its checks and a snapshot of the stack. It is recorded in Code.
  - Deploy shows which release each environment runs, and promotes a release from one environment to the next without rebuilding.
  - Rollback is promoting an earlier release.
- **Layer order and colour:** Data (teal) → Code (blue, today's Platform colour) → Deploy (indigo, new) → Work (purple). This keeps the rainbow order.

### 4.2 Architecture: is the brief enough? (C4)

No: a typed brief drifts, and a version belongs to a moment, not to the project. Architecture becomes three derived or recorded parts. Only the third is written by hand.

1. **Stack.** Read from `package.json`, the lock file, `Dockerfile` and `compose.yaml`, and grouped by category as StackShare does: Frontend, Backend, Data, Build, Test, Runtime. Nobody types "front end = Angular". The preset name remains a label for how the project started.
2. **Structure.** A C4-style diagram (App → parts → components) derived from the code index and `compose.yaml`, with each part linked to its layers.
3. **Decisions and constraints.** ADRs in `docs/adr/NNNN-title.md` (context, decision, consequences, status), plus constraints and quality goals (arc42). For example: "runs in 256 MB", "no paid services without the owner's OK", "must run without Aludel". These are the only hand-written architecture, and they live in the app's repository, so the owner keeps them (P5).

Versions don't live *under* a release; each release keeps a *snapshot* of them. A release page then shows what changed ("Angular 22.1.6 → 22.1.7"), which is what a release manager reads.

### 4.3 Code subfeatures (C6)

| Tab | What it is | Reads (owned by the app) | Borrowed from |
|---|---|---|---|
| **Overview** | "How it's built": a generated summary with file citations, the stack by category, the structure diagram, decisions and constraints, and story coverage with health counts | README, AGENTS.md, `docs/adr/`, manifests, code index | DeepWiki, StackShare, C4, ADR/arc42 |
| **Explorer** (the heart) | Tree on the left with **Structure** (App → Web app / API server / Database / Tests / Build → components → units) or **Files**. Right: the selected node's card (why it exists, layer links, calls and called by, tests, recent changes, health), or read-only source with an outline and link markers in the gutter. Filters: suspect, untraced, untested, recently changed. "Request a change" → Engineer · implement | The code and the LAY-07 index | VS Code explorer and outline, GitHub code view, C4, Backstage relations, CodeScene hotspots |
| **Dependencies** | Direct packages with current and latest version, licence, advisories, which parts use them, and runtime services the app calls. "Update" creates Engineer · dependencies work. ICONS-FONTS-01's icon and font libraries appear here | `package.json`, lock file | deps.dev, Renovate, GitHub dependency graph |
| **Changes** | Branches and pull requests (agent work arrives as a PR), with checks, linked work items and stories; commits with their `Aludel-Work:` and `Implements:` trailers | git, GitHub | GitHub pull requests, the LAY-07D trailers |
| **Releases** | Versioned releases: notes from shipped stories, checks, stack snapshot and diff, image, and where each is running now (link to Deploy) | git tags, release records | GitHub Releases, release-please, Keep a Changelog |

### 4.4 What's missing today (C5)

- **Secrets and variables per environment:** names come from `.env.example`, and values are held per environment (secrets are write-only and masked). Today there's nowhere to set a production value.
- **Migrations as a bridge:** migrations are code, but whether each one has been applied is per environment. Deploy should show "2 migrations pending in Production" before a promotion.
- **Health and sync as two states** (Argo): an environment can be healthy but running an old release, or up to date but failing.
- **Rollback and restore points:** each promotion takes a database backup and records it against the release.
- **Protection rules:** who may promote to Production. This matches GitHub environments' required reviewers and fits DEC-043's elevated actions.
- **Monitoring:** uptime checks, errors per release and alerts. Unavailable locally, shown as such, never faked.
- **Limits, usage and cost** per environment (PP-01E's guards shown to the owner).
- **Processes other than the web server:** background jobs and scheduled tasks (twelve-factor process types). Not generated yet; the model leaves room.
- **Leaving Aludel (P5):** a "What you own" view listing the repository files that define the app and how it runs, backups you can download, and the environment variable names.
- **Handoff documents:** README, AGENTS.md and ADRs are the developer's entry point; Code › Overview shows them.
- **Not in v1, noted:** feature flags (release ≠ enable), cost dashboards, incident timelines, SBOM export.

### 4.5 Deploy subfeatures (C7)

| Tab | What it is | Reads | Borrowed from |
|---|---|---|---|
| **Pipeline** | Columns of environments as the app declares them: Previews (one per branch or PR), Staging (optional), Production. Each card shows the release, commit, health, sync state and address. "Promote →" copies a release forward; pending configuration shows as "1 change to apply". Four delivery measures sit on top | App's environment declaration; release records; health checks | Heroku Pipelines, Vercel, Railway, DORA |
| **Environment** (detail) | Overview (release, address, health, resource use against limits); Variables and secrets (from `.env.example`, values per environment, missing required values flagged); Services (database, email, storage attached); History (deploys with rollback); Logs (build, deploy, runtime); Settings (hosting: Aludel subdomain, own server, a platform; protection rules) | `.env.example`, `compose.yaml`, `Dockerfile`, host limits | Railway, Render, Heroku config vars, GitHub environments |
| **Database** | Today's Health & backups, Schema, Browse and Query, now per environment, plus migrations applied or pending. Production browsing masks personal fields | The environment's database | Today's tab, Supabase and Neon branching |
| **Domains** | Addresses per environment; DNS records to add at your registrar; certificate state | Host config | Vercel domains; today's tab |
| **Monitoring** | Uptime, errors per release, alerts. Unavailable states until hosting exists | Health checks; later a provider | Sentry release health |

## 5. Prototype v1

[v1/index.html](v1/index.html) · screenshots in [v1/shots/](v1/shots/) · [v1/walkthrough.mjs](v1/walkthrough.mjs) reruns them. **Review notes** (top right) maps each ledger row to a screen.

The data is illustrative: Tool Share at a later stage than today's scaffold. It has folders, migrations, tests and ADRs; a real generated app is still flat (§1). Versions (Angular 22.1.7, Vite 8.3.0, TypeScript 6.0.3, Node 24) are the scaffold's real ones.

| Screen | Borrowed or invented |
|---|---|
| Nav: Code (blue) and Deploy (indigo) replace Platform | Owner's split (C1); colours invented to keep the rainbow order |
| Code › Overview: generated "How it's built" with file chips, C4-style structure diagram, stack by category, language bar, health, story coverage, decisions (ADRs), constraints | DeepWiki, C4/Structurizr, StackShare, GitHub, ADR/arc42. Health and coverage carry over from LAY-07 |
| Code › Explorer: Structure (App → part → component → piece) and Files views; health dots rolled up; filters (Suspect, Untraced, Unused, Untested, Busy); "Go to file or symbol" | VS Code explorer and GitHub tree; C4 levels; CodeScene hotspots ("Busy"). Structure over files is invented from §1's finding |
| Explorer detail for a part or component: child cards with health bars, why it exists by layer, talks to, owner, where it runs | Backstage entity page (about, relations, owner) |
| Explorer detail for a piece: read-only source with the piece highlighted and a gutter marking which piece owns each line; why it exists; calls and called by; tests; work; "changed after it was built" banner | GitHub code view and symbols pane; the gutter is invented; links carry over from LAY-07 |
| Request a change → Engineer · implement | The Pages rule (PAGES-UX-01 P8) |
| Code › Dependencies: packages with latest, licence, advisories, used by; services the app calls | deps.dev, Renovate |
| Code › Changes: PRs per work item with checks, touched pieces and their preview; branches and rules; commits with trailers | GitHub pull requests; LAY-07D trailers |
| Code › Releases: version, notes, ships, checks, stack diff, migrations, image, where it runs | GitHub Releases, release-please, twelve-factor build/release/run |
| Deploy › Pipeline: Previews → Staging → Production columns; health and "in step" per environment; promote with a checklist; four delivery measures | Heroku Pipelines, Argo CD (health vs sync), Railway (changes to apply), DORA |
| Environment: Overview (resources against limits), Variables (from `.env.example`, per environment, secrets write-only, apply bar), Services, History (rollback, backups), Logs (build, deploy, runtime), Settings (hosting target, protection, leaving Aludel) | Railway, Render, Heroku config, GitHub environments, Kamal/Coolify; PP-01A limits |
| Deploy › Database: migrations applied per environment; backups | Today's tab plus the migrations bridge (§4.4) |
| Deploy › Domains, Monitoring | Today's Domains tab; Sentry release health; uptime from the app's own health check |

**Invented and flagged:** `deploy/environments.yaml` as the place the app lists its environments (question 5 in §7), the Operator role, and the "Busy" filter name.

The build questions for the owner are in §7; they block the build, not this round.

## 6. Checks (agent-checked 2026-09-24)

- **Walkthrough:** Playwright/Chromium at 1600×1000, 25 scripted steps with real clicks and typing ([walkthrough.mjs](v1/walkthrough.mjs)), no page errors. Covered: overview → structure diagram click → part → component → piece with source; gutter click; Suspect filter; Files view; search; request a change; each Code tab; editing a production variable (apply bar); promoting v0.5.0 (then history); logs, settings, database, monitoring; review notes.
- **Phone:** no horizontal scroll at 390×844 on Overview, Explorer, Pipeline, Variables and Releases. The first run found three overflows, which were fixed (wrapping card headers, file notes and the releases grid).
- **Found by looking at the screenshots, not by the script:**
  - the highlighter broke HTML entities;
  - piece line ranges didn't match the sample source;
  - "Why it exists" was cramped in the narrow column;
  - the illustrative history contradicted itself.
  All four were fixed and re-shot.
- **Not done:** no axe audit and no screen-reader pass; this is a static prototype. Keyboard support is basic: tab to the tree, then arrow keys.

## Retrospective (v1 round)

1. **Harder than necessary:**
   - Capture failures were silent until the images were opened (Backstage "Entity not found", the Argo spinner).
   - Three platforms show real product screens only behind sign-in (GitHub deployments, Sourcegraph, the Vercel dashboard).
   - The illustrative data had to be kept consistent by hand across releases, history and monitoring, and it drifted once.
2. **What would make the next pass easier:**
   - `tools/capture-refs.mjs`: built and used here (§1).
   - Still hypotheses: a shared Tool Share fixture file across prototypes (the Pages retrospective asked for this too; this pass re-derived stories and personas again), and an axe step in prototype walkthroughs.
3. **Roadmap and architecture:**
   - The split changes the layer model (DEC-036/038: Platform becomes Code and Deploy) and `config/roles.json` (Operator). Both are proposals until the owner reviews them.
   - The Explorer needs the LAY-07 index to group pieces into components (today it knows files and symbols, not groups). The generated app would need a folder layout per feature, or a grouping in the build manifest.
   - Deploy needs PP-01D's environment declaration, and per-environment variable storage on the server.
   - Promotion without rebuilding needs image tags per release (today each preview rebuilds).
4. **Questions:** §7. They block the build, not this round. ICONS-FONTS-01 now has a home (Code › Dependencies).
5. **Process change:**
   - Applied and tested: the capture tool and its failure naming (§1), and the look-at-every-image rule, which caught four defects the script didn't.
   - Hypothesis: that Structure-first navigation is easier than Files-first for the owner. Only the owner's review tests it.

## Owner review

### Round 1 (2026-09-24): discussion before v2

The owner said v1 was "less well developed of an idea than some of your previous" and "could have done with a little more back and forth before the prototype". Settled in chat, then: "unless you have any other questions, we can create a v2 prototype." (DEC-029 authorization for a static v2; the build is still excluded.)

**Framing:** code work happens in established tools. "No one will come to this code layer to do their work: its a handy reference for how the code connects to everything else." Deploy is different: Aludel may be the project's host, so it must operate it.

| # | Ask (condensed) | Position | v2 |
|---|---|---|---|
| R1 | Explorer is useful for navigating code links. Drop the separate Structure and Files views: one file tree whose last level is the linked chunks. The viewer opens a file; clicking a chunk moves to it and highlights it | Required | One tree: folders → files → chunks. A story lens highlights one story's chunks across files |
| R2 | Do chunks span files? | Answered | No. A chunk is a top-level function, component, handler, table or test in one file (`code-links.mjs` `extractUnits`). The *link* spans files: a story links to chunks in many files, and a new revision makes them all suspect (the suspect-link idea from requirements traceability) |
| R3 | Dependencies tab is unnecessary: it's a list per release; the diff can go on an update notice | Required | Tab removed; the stack diff is in each release |
| R4 | Email (and domains and other external integrations) belong in Deploy. File storage: mention it on the structure; details in Data | Required | Deploy › Integrations; storage is a node on the structure map |
| R5 | Changes (a git summary) has no clear task; people use GitHub | Required | Removed |
| R6 | Releases are explicit, not per commit or per merge: GitHub Releases and Packages. Recorded in Code, as that layer's output | Required | Code › Releases: draft from main, then publish a tag and an image to GitHub Packages. Deploy promotes them |
| R7 | Overview: the structure diagram is helpful but too big and sparse. Combine the stack into it as supporting detail per part. Say which release it shows. Keep code health | Required | A compact map with stack details per part and an "as of" picker |
| R8 | Decisions: findings from code sessions should become Library knowledge, used as evidence on doc changes, because docs are what gets read in the repository. "Full inter-connection": code findings aren't only for docs, and docs aren't only from code findings | Required | Docs sections cite evidence from any layer; a finding shows every place it is used |
| R9 | Docs are the important missing piece: deliver the cross-layer knowledge where devs and agents need it. Follow harness engineering: AGENTS.md as an index to a Markdown tree | Required | Code › Docs: the repository's docs tree, generated and maintained from the layers, with a sidecar file for provenance |
| R10 | Sidecar provenance file: "i like it" | Agreed | `docs/.aludel/sources.json` |
| R11 | Tests close the loop: does what the story says have tests, and are they green? Agents may write tests; anyone who finds them insufficient requests a change, as on Pages | Required | Code › Tests: story → scenario → tests → result; request a change on a scenario |
| R12 | Deploy "sounds more dialed in": environments with promote and rollback; integrations (domain, email, storage); variables; data per environment; Aludel may be their host | Required | Deploy: Environments, Variables, Integrations, Data |
| R13 | Developer docs live in the app's repository, even though where other knowledge lives is still open | Agreed | Docs tab shows repository paths |

**Research added (accessed 2026-09-24):** OpenAI, [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/). WebFetch was refused with 403; the page was read in headless Chromium. Documented in the article:
- "give Codex a map, not a 1,000-page instruction manual";
- a short AGENTS.md (about 100 lines) serves "as the table of contents";
- the repository's `docs/` directory is "the system of record", with `ARCHITECTURE.md`, `design-docs/`, `exec-plans/` (active, completed, tech debt), `generated/db-schema.md`, `product-specs/`, `references/` (`*-llms.txt`), plus `QUALITY_SCORE.md`, `RELIABILITY.md` and `SECURITY.md`;
- "dedicated linters and CI jobs validate that the knowledge base is up to date, cross-linked, and structured correctly";
- a recurring "doc-gardening" agent opens fix-up pull requests;
- "anything it can't access in-context while running effectively doesn't exist".

Inference: Aludel's layers can generate most of that tree (product specs from Vision, design docs from Design, the database schema from Data, plans from Work), and the suspect-link mechanism is what doc gardening needs. This is capability evidence from one team's practice, not proof that it works here.

## 8. Prototype v2

[v2/index.html](v2/index.html) · screenshots in [v2/shots/](v2/shots/) · [v2/walkthrough.mjs](v2/walkthrough.mjs). **Review notes** maps R1–R13 to screens.

| Screen | Borrowed or invented |
|---|---|
| Code › Overview: an "as of" picker (latest release, main, what Production runs); a compact structure map with the stack in each part and a detail panel (stack, suspect-first chunks, the doc that explains it); outside services as links to Deploy; story × chunks × scenario tests; health, tests, docs and release cards | C4 containers plus StackShare, made compact (R7) |
| Code › Explorer: one tree, folders → files → chunks; source centre (a file opens whole, a chunk scrolls and highlights); inspector right; "Highlight code for…" lens across files; filters | VS Code explorer and outline; GitHub code view (R1, R2) |
| Code › Tests: story → Given/When/Then scenarios → tests by name → green, red, in a PR or none; tests written for an older revision are marked; red on main; tests with no scenario; request a change per scenario | Requirements traceability matrix; Gherkin; CI check runs (R11) |
| Code › Docs: `AGENTS.md` as the map, the `docs/` tree, mechanical checks (linked from AGENTS.md, no broken links, length), sections that need a refresh, "Show where each section comes from" (off = what an agent reads), per-section sources from any layer, findings with everywhere else they are used, the `.aludel/sources.json` sidecar, doc gardening as Work | OpenAI harness engineering; the suspect-link mechanism (R8–R10, R13). Folder ownership by layer lead is invented |
| Code › Releases: drafted explicitly from main; tag, GitHub Release, image in GitHub Packages; notes, ships, checks, stack changes, migrations, where it runs | GitHub Releases and Packages; twelve-factor (R3, R6) |
| Deploy › Environments: preview, staging and production columns with the selected environment's Overview (resources, recent logs), History (rollback) and Settings (Aludel hosts it, your server, a platform; protection; leaving) | Heroku, Argo, Railway (R12) |
| Deploy › Variables, Integrations (domains, email, file storage, add), Data (migrations, backups) | Railway, Vercel domains, Render (R4, R12) |

**Checked by the agent (2026-09-24, Playwright/Chromium):**
- 1600×1000: 28 screenshots, with real clicks, typing and selects, and no page errors.
- 390×844: no horizontal scroll on all nine tabs.
- The first two runs found:
  - a suspect chunk hidden behind "+more" (chunks are now sorted suspect first);
  - two tables overflowing on phones;
  - a script step that clicked inside a collapsed file.
- Looking at the screenshots found a pending test drawn as failed, and a source bar that wrapped. All were fixed and re-shot.
- No axe audit.

**Open questions (v2):**
1. Does each layer's lead own its docs folder (as shown), or does one doc-gardening routine own the tree?
2. Is naming tests after scenarios (`TS-06/3 …`) an acceptable convention?
3. A new Operator role for Deploy?

### Round 2 (2026-09-24): v2 answers and build authorization

Owner, in chat: "docs are owned by the developers, they know what they need and can assemble it from the evidence/sources. 2, id just say not all tests are story driven, right, theres tests for all kinds of stuff. deploy gets operator role. godspeed."

| # | Answer | Build |
|---|---|---|
| R14 | Docs are owned by the developers (Engineer role), who assemble them from the evidence and sources | The docs tree has one owner, the Engineer; the doc-refresh action belongs to the Engineer role |
| R15 | Not all tests are story-driven | Tests shows story coverage *and* all other tests, grouped by file, without calling them a problem |
| R16 | Deploy gets an **Operator** role | New `deploy` role in `config/roles.json`: configure (moved from platform), promote and rollback (elevated), review |
| R17 | "godspeed" | Build authorized (DEC-029), as scoped below |

**Build scope (PLATFORM-UX-01 build):**
- The portal's Platform layer becomes two layers, **Code** (Overview, Explorer, Tests, Docs, Releases) and **Deploy** (Environments, Variables, Integrations, Data).
- Everything is built from real local data where it exists: the code index, workspace files, git, previews, the preview database and `.env.example`. Where data doesn't exist, the view shows a plain unavailable state, never synthetic numbers.
- Routes, roles and tests follow.
- **Excluded (no authorization for external effects):**
  - publishing to GitHub (tags, Releases, Packages pushes);
  - public hosting, DNS or email providers;
  - spending.

  Releases can be drafted and recorded locally; publishing waits for owner authorization of that GitHub write.

## 9. Build (2026-09-24, agent-checked; owner review pending)

Built as scoped in Round 2. [Evidence and retrospective](../../evidence/platform-ux-01-code-deploy.md). Decision: DEC-049.

### Round 3 (2026-09-24): answers to the build's questions

Owner, in chat: "releases to github, thats not my local right, thats whatever user has configured. green light. agents gets initialized with the readme for a repo, it can be added to as we go, part of the docs. how are you running tests right now? through github? we can definitely add that permission though"

- **R18, authorized:** publishing a release to the project's own connected GitHub repository (the owner's account or organization, through the Aludel GitHub App): a tag and a GitHub Release. The image is built and pushed to GitHub Packages by a release workflow in the app's own repository, with that repository's token.
- **R19:** AGENTS.md starts from the repository's README, plus a short map into `docs/`, and is added to as the docs grow.
- **R20, authorized:** add the GitHub App permissions CI results need (Checks: read), and the Workflows permission, so scaffolded workflow files can be pushed. The owner changes the App's settings on github.com; Aludel cannot.
- **Answer given:** no tests of generated apps ran anywhere before this round. The Tests tab read only test names.
- **Still excluded:** any other GitHub write, DNS, hosting and spending.

## 10. Round 3 build (2026-09-24, agent-checked)

Publishing, CI results and AGENTS.md as a map: [evidence, Round 3](../../evidence/platform-ux-01-code-deploy.md#round-3-2026-09-24-releases-to-github-ci-results-agentsmd-as-a-map).

## 7. Questions for the owner

1. Is the split right, with Releases recorded in Code and promoted in Deploy?
2. Structure as the Explorer's default view, with Files as the alternative: or Files first?
3. A new **Operator** role for Deploy, or does the Engineer keep everything?
4. Do ADRs belong in the app's repository (`docs/adr/`) even though other knowledge location is deferred? The lean is yes: they are code-adjacent, like the Dockerfile.
5. Where does the app list its environments? v1 invents `deploy/environments.yaml`. The alternatives are compose profiles, or no file at all, with Aludel defaulting to Previews + Production. This is PP-01D's open design point.
