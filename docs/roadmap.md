---
id: roadmap-001
kind: roadmap
status: proposed
updated: 2026-09-19
---

# Milestones and validation

This roadmap defines outcomes and phase gates. [Current status](status.md) identifies the next action, and [the execution plan](execution-plan.md) provides the work packets an agent follows when told to proceed.

The owner confirmed a single-user, multi-project start and **request a change → review an agent-built preview** as the first valuable milestone. Work is organized as durable tasks with tracker-style prioritization and lifecycle; manual authorization is the first policy, not a local-session architecture. The owner also prefers free tiers and existing ChatGPT Plus access. Local execution is accepted; server execution remains the destination. The milestones below are acceptance gates, not calendar commitments.

## M0 — Definition and feasibility

Historical definition stage (M1 began under DEC-027). Produce the product model, source-backed options, decision inbox, and a prioritized validation backlog. Resolve only the choices necessary for the next stage. Select one representative self-change and one small second project.

Exit: owner intent is recorded; the product-development workflow and knowledge boundary are grounded in research; a major feature has traceable design artifacts before prototyping; the preview loop has concrete acceptance criteria; agent authentication, hosting budget, and execution boundaries have a feasible path.

M0 design learning (2026-09-19): D-01B v4 now has qualified owner acceptance for usability/clarity, while appearance is rejected. DEC-021 subsequently reopens page composition and interaction grouping; retain enduring product semantics and historical scenario evidence, rather than freezing the old wireframes. The first D-01E image set mostly varied surface styling, so R-08 established a product-owned design-system strategy and inserted D-01F to choose Aludel's own foundation before D-01E resumes. B-01 must use that selected system and catalog-first boundary. Continue recovery and preview feasibility through the status queue. This adds explicit follow-through on failed quality and process dimensions, not new product scope or an M1 transition. See the [D-01 retrospective](evidence/d-01-design-retrospective.md) and [R-08 evidence](evidence/r-08-design-system-strategy.md).

D-01F now also applies the [shared capability framework](product-system-framework.md) to Aludel as a project within itself (DEC-022), with a fictional BorrowBox allocation to check the record shape. This is M0 groundwork, not a new runtime feature or proof that the second-product milestone passed.

## M1 — Request a change and review its preview

Deliver a private hosted portal with project switching, a task board/inbox, imported research and roadmap, proposals, decisions, run progress, and artifact review. Initially seed the portal project and permit another project record. Support a Linear execution connector, one agent provider, and one preview mechanism. Jira follows through the same connector boundary.

First self-change: show which unresolved decisions block the current milestone. Start with configured concurrency of one while recovery is proven. The owner prioritizes and authorizes tasks; no scheduled background agents initially. Owner feedback requests another version of the same task. The data model and protocols support more workers and policy-driven starts without replacement.

Acceptance:

1. Owner signs in, selects the portal project, and submits the self-change in ordinary language.
2. The portal presents its interpretation, acceptance examples, and one consequential question with choices and rationale.
3. Answer persists across restart and is linked to the implementation inputs.
4. The owner authorizes the ready task; the Linear connector makes it execution-eligible and the local Symphony gateway invokes Codex in an isolated workspace, producing a real preview from an identified source revision. Show queued/waiting-for-worker if the local machine is unavailable.
5. Owner can inspect the preview, diff, checks, and known limitations, then request a revision or mark that build accepted.
6. A worker restart produces a recoverable state with no lost decision and no untracked duplicate preview. Cancellation and failure are visible.
7. The owner can switch projects; records and credentials remain correctly scoped.

Do not represent a static simulation as this milestone. A read-only knowledge portal is an intermediate implementation step, not the promised first useful outcome.

## M2 — Release a reviewed change to the live portal

Add scoped repository integration and owner-triggered deployment, health checks, retained releases, and a tested recovery path. Produce a release note tied to product intent and review evidence. Resolve the owner's production autonomy policy before enabling release actions.

Acceptance: the accepted build becomes live; a deliberately failed candidate is stopped or recovered; recovery works while the portal UI is unavailable; database compatibility and restore responsibilities are documented and exercised on test data. The portal can now manage its own subsequent rollout work.

## M3 — Build and operate a second product

Use a small real client-style brief, preferably a simple data-backed web app, to create an independent repository, preview, and live deployment. The owner chooses this example. Validate research, decisions, tester feedback, and a follow-up change without portal-specific assumptions leaking into the product.

Acceptance: the second app runs independently; its users need no portal access; the owner can trace a tester's observation through a decision to a deployed fix. Capture actual demo/MVP lead times and the human work required.

## M4 — Bounded continuous improvement

Ingest CI failures and tester feedback. Deduplicate candidates, show priority rationale, and implement within explicit project budgets and permissions. Evaluate changes to prompts/workflows on retained representative tasks. Expand into analytics, accessibility, performance, design consistency, marketing experiments, and outreach workflows as outcomes justify them.

Acceptance: an observed problem produces a useful reviewed fix; repeated failures stop consuming budget; the owner can explain why this work was selected and what improved. External communications follow the project's explicit authorization policy.

## Later capabilities and evidence triggers

| Capability | Trigger for investment |
|---|---|
| Second agent provider | Existing adapter bottleneck or a portability experiment |
| Rich workflow editing | Repeated expert interventions reveal a reusable process |
| Jira connector | The first Linear path works and a project benefits from Jira-specific workflow or existing Jira continuity |
| Server-side execution | Affordable compute plus validated authentication/isolation; prove a run while laptop is offline |
| Semantic retrieval | Text search fails a retained knowledge-retrieval test set |
| Multiple owners / client access | Actual collaboration demand and permission requirements |
| Automatic production promotion | Measured reliability plus owner-approved scope and recovery policy |
| Broader infrastructure providers | Concrete project requirement or unfavorable measured operations/cost |
| Shared cross-project learning | Useful transferable patterns, with explicit data-sharing scope |

## Initial work backlog

These are local planning records, not external tickets. Owner assignments are role proposals, not delegation performed in this session.

| ID | Work | Depends on | Completion evidence |
|---|---|---|---|
| R-01 | Apply confirmed free-tier/manual-start constraints; select first app type | DEC-004/005; owner sample | Cost boundary and representative brief |
| R-02 | Compare two existing end-to-end builders on one real brief | Representative brief | Gap matrix and build/adopt decision |
| R-03 | Agent adapter feasibility | Authentication path, budget | Start/events/cancel/recover trial and measured usage |
| R-04 | Preview host and workspace comparison | R-01, R-03 | Same sample build on candidate setup; isolation and cleanup evidence |
| R-05 | Durable coordination spike | R-03 | Crash around dispatch/external effect; reconcile without duplication |
| R-06 | Compare Symphony reuse with a minimal owner-triggered runner | Confirmed software-factory context | Pinned implementation assessment and reuse decision before custom runner work |
| D-01 | Prototype request → decision → review interaction | Owner's sample request | Owner feedback, revised interaction specification |
| B-01 | Portal shell, authentication, project records, document import | R-01, D-01 | Imported corpus with stable links and project access checks |
| B-02 | Proposals, decisions, and dependencies | B-01 | Persisted answer updates affected work |
| B-03 | Local worker integration and real preview review | R-03–R-06, B-02 | M1 end-to-end acceptance evidence |
| B-04 | Releases and independent recovery | B-03, release policy | M2 acceptance evidence |
| B-05 | Second product workflow | B-04, sample brief | M3 acceptance evidence |

Next implementation session should start with the feasibility tasks, not scaffold every future subsystem. Cost estimates should separate baseline hosting/database/storage, execution compute, model usage, retained previews, and operational overhead. Measure cost per accepted change; token price alone is insufficient.

The backlog above is the portfolio view. Sub-packets, order, required evidence, and gate rules live in [the execution plan](execution-plan.md). Do not infer the next task from table order; use [current status](status.md).


D-01F closeout (2026-09-19, DEC-025): the owner selected the [v3 foundation](design/portal-system/v3/review-record.md) for continued design work. D-01E now consumes its [accepted inputs](design/portal-system/v3/d-01e-handoff.md). Overview is the accepted reference; other view compositions remain open. Angular Material and explicit Storybook stories are the design-stage realization; production architecture and docgen support remain B-01 readiness work. This supersedes earlier pending-foundation-selection wording, without advancing M0.

## D-02 strategic update — 2026-09-20

The owner requests a usable product workspace, contextual design knowledge and an easier next-project start. [D-02 delivery proposal](design/project-workspace/v1/delivery-plan.md) stages this through project-scoped plan/history, editable product direction, design provenance and contextual previews. Structure/priority selection is pending in the portal. Aludel-only source/API assumptions must be corrected before enabling new-project writes; a seeded projects table does not prove isolation.

New-project draft/setup planning can become useful before M3, but a real independent application and its release/feedback loop remain B-05/M3. Do not make the entire proposed workspace suite a prerequisite for B-03's first real preview. Preserve M1 runner/review/recovery, M2 release and Q-003 real-brief gates. No phase transition, external integration or spend is approved by this plan.
