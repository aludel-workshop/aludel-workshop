# Agent work rebuild (AGENT-WORK-01): implementation plan

Status: plan for the owner, 2026-10-04. Nothing here is authorized to build yet; each slice needs the owner's go. Source of the target design: the four prototypes in this folder ([a0/v2](a0/v2/index.html), [ecosystem/v1](ecosystem/v1/index.html), [pages-review/v1](pages-review/v1/index.html); [a0/v1](a0/v1/index.html) is history), the [proposal](proposal.md) and the round notes and questions in the [work record](work-record.md). Facts about today's code come from an inventory on 2026-10-04 (file references below, paths under `apps/portal/`).

## The shift in one table

| | Today | Target |
|---|---|---|
| Unit of work | A layer task (`work_scope` layer or action-scoped), one layer per run | A work item with **actions** (subtasks) in **phases** with review gates, across any layers |
| Starting work | Stage into a per-profile **batch**, Next, then an owner **Go** (`server/agent-runs.mjs`) | Move a card on a **kanban board**; Draft → Ready asks Claude to define it; Ready → In progress starts it |
| Who works | Codex in Symphony (Elixir adapter, one turn per run, 3 runs per attempt) | An **orchestrator** session (Claude Agent SDK) with layer subagents, or a person locally with the same tools |
| Progress | Plan and progress rows, UI polls every 2 s | A live **thread** (orchestrator sidebar) and per-action logs, streamed |
| Asking | `aludel_task_ask`, the run ends in needs-input | Questions, allow requests and new actions sit **on their action**; the rest keeps working |
| Review | One run review (J6), Send back starts a fresh attempt | **Per-action review**, gates between phases, one **close-out** merge; Send back and steer resume the same session |
| Page review | Pages Spec view drawn by the portal's Angular kit renderer | Pages review action is a **flow walker**, previous beside proposed, over **HTML pages** built from a **Design HTML kit** |
| Routines | manual, schedule, output-change; create a Ready item | A **When / If / Create / Assign / Go as far as** formula; event triggers; runs history |
| Planning | Plan projects exist (`plan_project_id`) | **Projects with milestones**, Plan with Claude |
| Outside trackers | None | **Linear sync** (later; an external write) |

## What stays (the parent-structure rule)

Kept as they are or extended, not rebuilt: per-project SQLite work items (`server/knowledge.mjs:166`) with refs, priority, blocks and assignees; layer APIs with staged draft overlays (`server/layer-api.mjs:360`) and reviewed-source digests; layer repositories and work branches (`server/layer-source.mjs`); the review server (`server/work-runs.mjs`: claims, unproven claims block accept, sign outcomes, elevated reviewers, merge or draft); preview builds and journey walks (`server/review-previews.mjs`, `server/journey-runner/`); Check my branch; person runs (`startPerson`, `submitPerson`); routines' one-open rule and `routine_runs`; bindings (`server/bindings.mjs`); the Docker sandbox per project. The rebuild changes how work is shaped, started, run and shown, not how changes are staged, proven and applied.

## Slices

Sizes are relative (S, M, L), not time. Each slice ends with server tests, the layer's browser journey where UI changes, both `npm run test:server` and `npm run test:server:templates`, and a retrospective. The old path keeps working behind a flag until A10 removes it.

### Phase 0: decisions and preparation (no code)
- **D1 Spending (blocks A2).** The Agent SDK calls the Anthropic API, which costs money per token; today's Codex path uses ChatGPT Plus at no extra cost. Needs the owner's authorization of an API key and a monthly budget, or a decision to keep a no-cost runtime for now. *Inferred:* a Claude subscription can't be used as the SDK's credential for a separate app; check Anthropic's current terms before relying on either way.
- **D2 Plan approval:** every definition waits for the owner (recommended to start) or small ones start on their own.
- **D3 Review signing:** one reviewer per action with elevated layers needing their own (recommended), or per layer.
- **D4 Kit source (blocks A7):** Design's HTML kit generated from component contracts only, or also extracted from built components.
- **D5 Linear (blocks A8):** in scope now, or after the owner trial.
- Answers to Q1–Q8, E1–E7, P1–P6 settle the remaining UI details; slices start on the prototype's choices where an answer is missing.
- Access: `layer-base` is not in this checkout; A2 and A7 need it (the owner approved editing it).

### A1 Work model and the Aludel MCP server (L) — critical path
- **Model.** New tables: `work_actions` (item, number, phase, goal, layer, after[], state, needs, review state, added by, approval), `work_phases` (item, order, gated), `work_events` (the thread: messages, action logs, needs, answers). Item fields: `defined` and the five board statuses (Draft, Ready, In progress, In review, Done) mapped from today's states (suggested→Draft; ready→Ready; claimed/needs-input→In progress; review→In review; done→Done). Batches stay readable for old items but stop being created behind the new flag.
- **MCP server** (stdio and HTTP, extending `tools/editor-mcp.mjs` and the worker API at `server/server.mjs:565-610`): read any layer (stack map, Knowledge, API spec, records, repository files); stage into the item's changeset per layer; actions (add, update goal, report, ask on an action, request an allow, request approval of a new action); Check. Same tools for the remote orchestrator and a local CLI agent.
- **Streaming.** Server-sent events for `work_events` and action state, replacing the 2 s poll for the new item page.
- *Exit:* tests stage one changeset across Pages and Code through the MCP server and run Check on it; events stream to a test client.

### A2 Orchestrator runtime (L) — critical path, needs D1
- Agent SDK runner inside the existing per-project Docker sandbox, one session per item. Defining stage (Draft → Ready: questions, brief, drafted actions), then working stage.
- Layer subagents from `agents/<layer>.md` and skills from `skills/` in each layer template (`layer-base`: allow those paths in `server/layer-package.mjs:115`, add their digests to `config/layer-reviewed-sources.json`). Host agents: Explore, Verify, Showcase.
- `canUseTool` maps each layer's mode (stage freely, ask first, read-only) to an allow request on the action. Hooks run the host checks (API validation, package tests). Concurrency slots replace batches (the "3 slots" on the board).
- Session resume for steer, answers, review notes and Send back.
- *Exit:* on a disposable project, "Create the sign-up flow" is defined, then produces a Pages change and Code with passing step tests, with questions answered mid-run.

### A3 The work item page (M) — critical path
- Replace the run block in `src/layers/work-item.ts` / `work-run.ts` with v2: top bar and brief, actions in phases with gates, needs under their action, orchestrator thread in the right sidebar (click an action for its details and log), steer box, add or edit actions, Approve on a new action, Send to Claude or claim locally, Start.
- *Exit:* browser journey of v2's walkthrough against a scripted orchestrator (no model), axe clean at 1440 and 390 px.

### A4 Per-action review, gates and close-out (M) — critical path
- Scope `work-review.ts` and `work-runs.mjs` review to an action: its claims, its part of the changeset, its journeys on the combined preview. Gate clears when its phase's reviews are done. Close-out signs and merges the whole changeset once (existing accept and `mergeLayerBranch`).
- Orchestrator's combined check (Verify agent runs Check my branch on the combined changeset; failures go back to the owning action; two failures become a need).
- Bindings (proposal §6, old A3): a derived change becomes an action the owner approves.
- *Exit:* browser journey: review one action, flag, fix in the same session, approve, gate clears, close-out merges.

### A5 Owner trial on Biome (S) — first milestone
- The owner gives Biome "Create the sign-up flow" and runs it to close-out with owner actions only. Retrospective.
- This is the "request a change, start it deliberately, review a real agent-built preview" milestone, cross-stack.

### A6 Board, routines and projects (M) — after A3, parallel with A7
- Kanban board replacing `src/layers/work-board.ts` (batches, Next, Queue/Backlog): five columns, cards with actions progress and needs, filters, peek, move rules (define on Ready, confirm on Start, Done only through close-out).
- Routines formula: add *If* and *Go as far as* (Draft, define to Ready, start) to routine records (`server/knowledge.mjs:425`), event triggers from `work_events` and deploys, runs history in the existing `routine_runs`.
- Projects: milestones table under the existing plan projects; Plan with Claude proposes Draft items.
- *Exit:* browser journeys of the ecosystem walkthrough (without Linear).

### A7 Design HTML kit and the Pages review action (L) — after A4, needs D4
- Design: generate `kit.js` (tokens as CSS variables, components as custom elements) per Design revision from component contracts (`server/design.mjs:324`); the Components tab renders demos from it.
- Pages: page specs as HTML files in the Pages repository pinned to a kit revision (with `data-go` links), migrated from `page` records; Spec view and Flows render them; `kit-render.ts` retires for spec previews.
- Pages review action: the flow walker from pages-review/v1 (previous beside proposed, step badges, highlight changes, pinned notes, round 2 against the last review). Code review keeps the live build.
- Starts with a spike: generate Biome's kit from its contracts and compare with its built screens (the open G3 question).
- *Exit:* Biome's onboarding flow reviewed as HTML in the walker; spike result recorded.

### A8 Local work style (M) — after A1
- `aludel` CLI: `aludel claim W-n` (assign, start a person run, write the MCP config and context for a local agent), `aludel status`, `aludel submit`. A local Claude Code session gets the same MCP tools, skills and previews; the item page shows the local thread from submitted progress.
- *Exit:* claim, work in Claude Code locally, submit, and review in the portal, on a disposable project.

### A9 Linear sync (M) — needs D5 and the owner's go for external writes
- Import first (Linear issues → Draft items), then two-way fields, status mapping and actions as sub-issues, with the orchestrator's summary as a comment. Credentials stay out of the repository.
- *Exit:* round trip on a test Linear team the owner provides.

### A10 Retire the old path (S) — after A5
- Remove batches, Go, the Symphony and Codex adapter and their routes once A5 passes and no open item uses them; keep their evidence in history. LAY-05's coding proof becomes historical.

## Order

Critical path: **Phase 0 → A1 → A2 and A3 (side by side) → A4 → A5.** A6 and A8 can start after A1/A3; A7 after A4; A9 last; A10 after A5. Existing queue items: T03-CODE and LAYER-GITHUB-01 continue only where they don't touch Work; LAT-08A (layer-owned Work review) and LAY-05 are absorbed into A4 and A10.

## Risks

- **Cost** (D1) is the gating unknown; the plan stalls at A2 without it.
- **Two runtimes at once** while A1–A5 land: keep the new path behind a flag and old items on the old path.
- **Sandbox security:** the SDK's tools run inside the same per-project container; the MCP server is the only write path, so the layer API checks stay authoritative.
- **Kit fidelity** (A7): if a generated kit can't match the app, the walker's comparisons mislead; the spike decides before migration.
- **SDK drift:** pin the SDK version and check its docs at A2.

## Process notes

This plan applies the parent-structure rule (what stays is listed above) and the prototypes' walkthroughs become each slice's browser-journey acceptance, so a slice is accepted against the interaction the owner already approved, not a new description. Hypothesis, untested: scripted-orchestrator journeys (A3) are enough to catch UI regressions without model calls.
