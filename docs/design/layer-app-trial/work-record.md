---
id: LAYER-APP-TRIAL-01
kind: work-record
status: agent-checked
updated: 2026-09-28
---

# Pages-first layer-app trial

## Authorization and scope

Owner instruction in chat, 2026-09-27: create a version of Aludel with only Pages as a project layer and Library and Work as permanent services. The owner will act as a UX designer, start blank, and mock up a site's flows. Test layer-scoped routines, the reaction to newly added layers, the boundary between Pages base knowledge and learned relationships, Library's role in shared knowledge and agent lookup, and Work's Symphony execution configuration. This authorizes bounded local design, implementation of an inspectable trial, repository edits and local checks under DEC-029. It does not authorize a live agent run, external account or provider access, spending, external writes, deployment or owner acceptance.

## Process finding and readiness

The conceptual framework is not yet evidenced in an owner flow. The current Pages layer begins with seeded stories and a fixed `suggestions()` rule; that can make a blank Pages-only project feel broken or secretly dependent on Vision. The smallest useful experiment is a disposable, local Pages-first application that preserves the Map / Pages / Flows jobs while exposing its baseline routines, connection hypotheses, and exact Work suggestions. Keep its state separate from the owner's running portal and do not migrate live records.

Ready for a local interaction trial: existing Pages UX and Work contracts are documented, and the owner supplied the actor, starting state, and goal. This is a functional prototype, not production portal implementation. Visual style follows the existing Pages v2 prototype and portal patterns; the new relation/routine surfaces are experimental variables. No owner approval is inferred for those compositions.

## Responsibilities and authority

| Surface | Owns | Does not own |
|---|---|---|
| Pages layer app | Page mockups, page map, flows, its base routine rules and candidate cross-layer relation policy | Agent scheduling, external source authority, another layer's outputs |
| Library service/view | Source notes and insights, project-wide search/discovery, provenance and scoped knowledge lookup | Primary authorship of Pages/Vision outputs or execution authorization |
| Work service | Durable suggestions/tasks, assignment, Go/review concepts, execution adapter configuration including Symphony | Pages-specific relevance policy or flow quality judgment |
| Optional added layer | Its declared output type and records, exposed through shared discovery | Pages policy or its accepted artifacts |

Agents should call a shared, project-scoped knowledge gateway with role checks; Library is the user-facing view over that gateway, not the gateway's authority. Library still owns source/finding/insight records so research can be shared across layers. A layer output remains owned by its layer. The prototype can illustrate this boundary but has no real auth, API, Symphony host, or agent.

## User trial and transitions

1. Start with a blank project: Pages, Library, and Work only; no pages, flows, sources, tasks or connected layers. Name the site if desired.
2. Create two or more page mockups from simple sections/content, place them on Map, then create an ordered flow and walk its mockup preview. Save locally and reload.
3. Run Pages routines: identify missing page/flow links and review gaps; stage deduplicated suggestions in Work. Work shows person tasks and an execution setting for future agents, with no fake live run.
4. Add a Vision-like layer with a story output. Pages discovers the new output descriptor but does not assume every story needs a flow. Accept a candidate connection policy; add a story; re-run the Pages coverage routine and inspect a source-linked Work suggestion. Reject/disable the policy and confirm the suggestion no longer claims current coverage.
5. Add Library source and insight records; link them to a page or flow, then find them and the layer outputs through global search. Show origin and authority, not one undifferentiated document pile.
6. Reset the trial; return to the same truly blank state.

Exceptional states: no pages, no flows, a flow with no steps, a step referring to a missing page, a newly added layer with no records, and a disabled/disconnected relation. No agent is reported online or running in this prototype.

## Implementation sequence and checks

Build a self-contained local HTML/CSS/JS prototype under `v1/`, with browser-local storage and reset. Keep mockup tools intentionally simple: editable page title/path/sections, ordered flow steps and a walkthrough. Use generated UI shapes and the existing project's design language; do not pretend the mockups are actual deployed pages. Check the blank start, creation/reload, navigation, routine deduplication, new-layer discovery and narrow-screen behavior in a browser if local tooling permits. Record actual checks and limits below, then link this trial from status without replacing `WORK-AGENTS-01`.

## Owner correction and v2 scope (2026-09-28)

The owner is withholding judgment on Map/Pages/Flows and expects the previously accepted Pages UI to remain the production reference, with blank-start hardening later. This revision focuses only on the new layer-app surfaces. The owner asked for:

1. **Overview** as a standard layer home: output categories as API-like cards, drill-down structure/docs, health and outstanding work.
2. **Compact Routines** patterned on the current `/work/routines` table, without a Role column, with trigger types, editable instructions/capabilities, all runs, filters, inputs and outputs.
3. **Routines as Work items:** each scheduled/manual routine run has a Work item; outcomes can revise internal knowledge, stage output tasks, or produce candidate outputs. Utility routines as well as agent routines are valid.
4. **Layer work board:** replace the demo's free-standing Findings panel with a view of tasks produced by Pages; global Work still aggregates all layers and owns batching/dispatch.
5. **Connection documents:** network discovery proposes how to use a new layer's outputs, asks for consequential decisions, and approved connection docs become versioned input to network syncing. Avoid rewriting base syncing instructions every time a neighbor appears.
6. **Internal knowledge tree:** output specs, workflows, methodology, resources, agent instructions, routine instructions and connection docs must be discoverable and inspectable by a layer expert or agent.
7. **Transient-gap handling:** a deterministic utility can close a task when the human fixes the underlying gap. New suggestions can be delayed until an audit while closure happens immediately on relevant edits, avoiding a flood of five-minute todos.

This chat authorizes bounded local prototype and work-record revision, not real agent execution or changes to the running portal. Preserve the earlier trial and its evidence as v1. The new work is a v2 revision of the same isolated app. The current Work table is a composition reference; its behavior is not sufficient for the broader outcome ledger. The existing project status keeps `WORK-AGENTS-01` as `next_action`.

**Process change:** every routine definition names its trigger, executor (utility or agent), capabilities, versioned instruction document, allowed output types, and how a run's exact outputs change layer knowledge or Work. A connection is an independent document, not hidden prompt text. The v2 trial must check both routine-task creation and automatic resolution after an owner edit. This makes the owner's correction testable without assuming a general agent runtime exists.

## Owner navigation correction and v3 scope (2026-09-28)

Owner instruction in chat authorizes a bounded local revision of the isolated layer-app preview. The work surfaces should be Map, Pages and Flows; standard management tabs should be Operations and Knowledge. Operations combines a familiar stacked-card Pages work board with compact routines and connections in sidebars that open detail views. Remove Overview as a layer tab. Bring back always-available Home before a divider and the layer stack; Library and Work follow a second divider. Home owns layer management and adding layers, and each new layer may contribute an optional dashboard bento card. Existing page/flow behavior remains a trial fixture. Check navigation, discovery/work continuity, new Home cards and narrow layout in a browser. No portal runtime or external agent execution is authorized.

**Process finding:** the v2 tab bar made layer work and layer administration peers, hiding the user's primary task. Standard Operations and Knowledge destinations should be tested against both Pages and an added layer before treating them as a reusable shell contract.

## V3 navigation evidence and retrospective (2026-09-28)

**Built:** [isolated v3 preview](v3/index.html) keeps Map, Pages and Flows as the primary Pages work tabs, with standard Operations and Knowledge tabs separated visually. Operations centers a [stack of Work-style cards](v3/layer-pages-ui.js); routines and connections appear in sidebars and open their full detail views there. The always-available Home leads the left rail, followed by a divider, the layer stack, another divider, then Library and Work. Home owns layer creation and a bento with a Pages card, cross-layer Work card, and optional cards contributed by added layers. An added Vision/custom layer receives the same Operations and Knowledge destinations, with a bounded output fixture, utility audit and editable base documents. The earlier v2 preview remains intact.

**Observed checks:** `node --check` passes for the v3 JavaScript modules, `git diff --check` passes, and local HTTP returned 200. The [browser walkthrough](v3/check.mjs) passed: blank Home and rail order; the five Pages tabs with no Overview; Operations card board and sidebar drill-downs; routine edit/run; delayed map scan and task card; add Vision from Home with its card initially hidden and later enabled; added-layer Operations and Knowledge; network discovery proposal, reviewed connection, sync task, flow creation and automatic resolution; reload persistence; and 390px layout with both management tabs visible and no page overflow or page errors. The first test stopped on an ambiguous heading locator; tightening it exposed no product failure. Screenshot review caught a clipped Knowledge tab and an action on a resolved flow task; both were corrected and the browser path rerun. [Home](v3/shots/01-home.png), [empty Operations](v3/shots/02-operations-empty.png), [card board](v3/shots/03-operations-work.png), [Home with added layer](v3/shots/04-home-added.png), [Knowledge](v3/shots/05-knowledge.png), [narrow Home](v3/shots/06-narrow-home.png), and [narrow Operations](v3/shots/07-narrow-operations.png) are the inspection captures.

**How to try:** run `docs/design/layer-app-trial/v3/serve.sh` from the repository root and open `http://127.0.0.1:8767/`. The local server is running at handoff. Agent results remain deterministic local stand-ins; no worker or external API is connected. The optional layer's output/editor and audit are fixtures, not a fully generic runtime. The owner's usefulness judgment and production Pages UI selection remain open.

1. **Avoidable friction:** the v2 flat tab bar gave administrative views the same visual rank as design work, and “Add layer” occupied daily navigation. A card board also needed a clear completed state so resolved tasks stop inviting action.
2. **Preparation for equivalent work:** test the shell with both the initial and an added layer; inspect desktop and phone screenshots because a no-overflow assertion alone did not reveal the clipped Knowledge label.
3. **Roadmap effect:** Home is a stable project-management entry; Operations and Knowledge are plausible shared layer slots while each layer retains its own output work tabs. This remains a local interaction hypothesis awaiting owner trial.
4. **Questions:** whether the designer prefers Operations as a tab or a separate management route, how much routine detail belongs in its sidebar, and what layer cards should display beyond counts. These inform production composition, not the local trial's completeness.
5. **Process change applied and tested:** the shared shell contract was applied to Pages and Vision, then checked through a complete discovery → task → output → resolution path and phone-width screenshot review. Its usefulness in a real design session remains untested.

## V2 evidence and retrospective (2026-09-28)

**Built:** [Pages layer-app v2](v2/index.html), isolated from the running portal and v1. The default Overview lists Map, Pages and Flows as output API categories with explorable specs, current counts, coverage signals, and the Pages work queue. The [routine definition and run model](v2/layer-core.js) distinguishes utility from agent execution, stores versioned instruction documents, capabilities and allowed results, and creates a global Work item for each Pages run. The [UI](v2/layer-pages-ui.js) presents a compact table, editable definitions, filtered run history, input/output inspection, connection documents, Pages board and internal knowledge tree. Library and Work remain permanent services. Existing Map/Pages/Flows demo controls were carried forward for the trial, without claiming the accepted production Pages UI is replaced.

**Observed checks:** `node --check` passes for all three v2 modules. The [browser walkthrough](v2/check.mjs) passed in cached Chromium against local HTTP 200: blank overview and API drill-down; edit and run a routine; quiet-period utility run staging a page question; layer board; Vision addition creating network-discovery routine work; local stand-in producing a proposed connection document; answer and activate that document; network sync creating a source-linked flow task; creating a linked flow automatically resolving the task; knowledge-tree persistence after reload; and 390px viewport with no page overflow or page errors. The test caught a stale routine-detail navigation state and a mistaken target selector; both were corrected before the final pass. [Overview](v2/shots/01-overview.png), [compact routines](v2/shots/02-routines.png), [routine detail](v2/shots/03-routine-detail.png), [Pages board](v2/shots/04-board.png), [connection document](v2/shots/05-connection.png), [knowledge tree](v2/shots/06-knowledge.png), and [narrow view](v2/shots/07-narrow.png) provide inspectable evidence. Overview and routine screenshots were visually reviewed.

**How to try:** run `docs/design/layer-app-trial/v2/serve.sh` from the repository root and open `http://127.0.0.1:8766/`. Start at Pages › Overview, then inspect Routines, Work board, Connections and Knowledge. The local preview is running at handoff.

**Limits:** Agent results are deterministic local demonstrations triggered by an explicit button; no agent, Symphony worker, API, authentication or provider is connected. The 1.8-second quiet period illustrates debouncing, not a durable scheduler. Connection approval is a local review action, not production governance. The optional Vision/custom layer remains a simple output fixture, not a fully generic layer-app runtime. Mockups remain the v1 simplified editor; owner assessment of the accepted Pages UI is still pending.

1. **Avoidable friction:** the v1 Findings list separated observations from the Work lifecycle; routine runs lacked an inspectable work identity. Navigation state initially reopened an old routine detail when returning to the table.
2. **Preparation for equivalent work:** model routine definitions, runs, typed outputs and Work items together; check a complete trigger → run → task → artifact → automatic closure chain in a browser, including the transition back to the list.
3. **Roadmap effect:** the useful shared contract is a layer-owned output descriptor and knowledge tree with versioned connection documents; Work remains the execution ledger. This local trial does not validate a generic database or automated learning policy.
4. **Questions:** owner trial must decide whether the overview categories and knowledge tree help a designer, how consequential connection questions should pause Work, and when quiet-period tasks should become visible. These block production UX selection, not this local trial.
5. **Process change applied and tested:** the revised routine/run/output contract was implemented and the browser path verified creation, local stand-in outputs, and closure. Real agent execution and owner usefulness remain untested.

## Evidence and retrospective

**Built:** [interactive local trial](v1/index.html) with [relaunch command](v1/serve.sh). It starts with no pages, flows, sources, insights, tasks or optional layers. The Pages map creates page blanks; the editor composes hero/content/cards/form sections into a live spec mockup; Flows orders pages and walks the mockups at desktop or phone width. State persists in browser `localStorage` and Reset returns to blank. Library shows all layer output identities alongside source/insight records, offers one search view, and can link a source or insight to any added layer output. Work owns suggested/manual items and displays a Symphony execution configuration boundary without connecting a worker. An optional Vision layer publishes stories; Pages shows a candidate relation, can activate a trial policy and stage a deduplicated flow suggestion. Drafting from that item links the story, and the next audit supersedes the resolved suggestion. A custom layer can publish notes for Library discovery, without an invented Pages mapping. It also has a layer-owned completeness routine: an empty description stages its own Work suggestion, and filling the description retires that suggestion. Pages explicitly reports the custom output as discovered with no accepted relation.

**Observed checks (agent, 2026-09-27):** `node --check v1/app.js` and `git diff --check` pass. [Browser walkthrough](v1/check.mjs) passed in cached Chromium: blank start without Vision; two pages and a composed hero; a two-step flow and review; reload persistence; Vision creation and story discovery; two routine scans without duplicate work; draft-flow link and gap closure; Library source/search; custom-layer discovery without an invented Pages relation; a custom-layer routine finding and closure; a Library insight linked to the custom output; 390px no horizontal overflow; reset to blank; no page errors. [Blank](v1/shots/01-blank.png), [flow](v1/shots/02-flow.png), [Library](v1/shots/03-library.png), and [narrow](v1/shots/04-narrow.png) screenshots were inspected. The first browser run stopped on a test locator matching a hidden dropdown option; the locator was corrected and the flow persisted. Screenshot review exposed Work hidden in narrow horizontal navigation; the rail now wraps and all permanent destinations are visible. A missing story-to-flow link was also completed before the final pass. The custom-layer audit exposed a missing gap identity that kept a resolved suggestion active; the identity was added and the complete browser path passed.

**How to try:** from the repository root run `docs/design/layer-app-trial/v1/serve.sh`, then open `http://127.0.0.1:8765/`. The browser check uses an existing Playwright module: `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node docs/design/layer-app-trial/v1/check.mjs` while the server runs. The current local server returned HTTP 200 at handoff.

**Limits:** this is a standalone functional prototype, not a modification of the running Angular portal or its database. It has no authentication, actual knowledge gateway, agent lookup, Symphony host, provider turn, production publish, shared project sync, source connector, arbitrary layer renderer, or owner acceptance. The single Vision policy checkbox stands in for a reviewed policy proposal; the app does not actually learn a rule. Routines run on demand. The optional custom layer has only a description-completeness rule; it is not a general policy engine. The mockup composer uses four illustrative section patterns and does not implement the full accepted Pages canvas, dragging, Design components, or built-app bridge. These limits are visible in the prototype.

1. **Avoidable friction:** the existing Pages UI assumes story-map seeding and fixed server suggestion rules; a blank Pages-only path needed explicit empty states and a local basis for flows. The first browser script's hidden-option locator, narrow nav crop and optional-layer gap-identity defect were caught by the walkthrough/screenshots.
2. **Preparation for next task:** keep a fixture that starts without Vision or Code, then adds a neighbor and checks that its relation remains a proposal until activated. Test task deduplication and gap closure, not only task creation.
3. **Roadmap/architecture effect:** retain Work scheduling and Symphony configuration as permanent service concerns. Use a shared, scoped knowledge gateway behind a Library view; Library owns shared sources/insights, while each layer owns its outputs. A general layer runtime needs typed descriptors, policy review, access control, and output-specific renderers; this prototype does not justify replacing the current database with a generic store.
4. **New questions:** whether designers want a direct Map canvas before page-by-page editing; whether layer connection policy should be visible in Pages or a shared project settings view; what review is sufficient to activate a relation rule; how much research belongs in Library versus a future Research layer. These need owner trial feedback before production UX work.
5. **Process change applied and tested:** using the blank-project fixture exposed hidden Vision assumptions and forced a complete suggestion→artifact→audit cycle. The browser trial demonstrates this prototype's mechanics, not that the layer-app process improves a real designer's work. The owner trial is the next evidence.

**Next action for this proposed trial:** owner uses the local app to mock up one real site flow, then reports which step feels useful or obstructive. Project-wide `next_action` stays `WORK-AGENTS-01`.

