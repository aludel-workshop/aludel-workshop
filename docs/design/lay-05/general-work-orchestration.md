---
id: lay-05-general-work-orchestration
kind: design-proposal
status: proposed
updated: 2026-09-25
---

# General work orchestration proposal

## Scope and process finding

The 2026-09-25 owner request asks for a plan before coding. This note inspects the local implementation and proposes a reusable execution contract. No product code or live provider call is part of this pass.

The process change is to test orchestration against several unlike actions before extending the coding path: a knowledge edit, a code change, a review, and a human-plus-agent session. This note applies that comparison to current code. Runtime effectiveness remains unproved.

## Current state

- Work has revisioned roles and actions, profiles, work items, checks, and per-profile batch lanes. `config/roles.json` supplies seven roles, but `tools`, `changes`, `asks`, `phases`, and `checks` are mostly descriptive strings rather than enforceable capability and result contracts.
- `server/agent-runs.mjs` runs only `product.define`, `product.clarify`, and `data.contract` as structured model calls. `platform.implement` alone uses Symphony; mixed batches are refused.
- The Symphony adapter polls Aludel's Go-pinned coding items with one project/profile credential and one service per project/profile. Disposable trials prove candidate submission, retained preview, and restart recovery. Owner browser review remains open; real-work dispatch is off.
- The Board shows one lane per profile, a Go button, token ticker, and item status. Item detail has questions, check verdicts, and a code-specific candidate section. It lacks a common result envelope for text, preview, report, tests, and multiple review submissions.
- PP-01R gives a person-paired Codex read-only task and knowledge tools. It does not launch the same pinned task environment as an autonomous worker.

## Recommended work contract

Separate five concerns so a person or agent can take the same work:

1. **Role:** durable responsibility and judgment standard, usually aligned with a layer. A role owns actions and may later split without moving the layer's knowledge.
2. **Action:** executable specification: typed input selectors, required context, allowed capabilities and target records, output types, default review requirements, question policy, and validators. Human-readable instructions accompany machine-checkable fields. The action does not choose a model.
3. **Profile:** agent execution policy: provider/model, reasoning effort, instruction style, turn and token allowance, tools, and concurrency ceiling. Several profiles can qualify for the same action. Assign a work item to a person or a profile according to its difficulty, without duplicating the action definition.
4. **Work item:** concrete intent, targets, dependencies, outcome, acceptance checks, assignee, and feedback. It selects an action and supplies task-specific instructions. Its review requirements may add to action defaults.
5. **Batch authorization:** the owner's bounded decision to start selected item revisions under a profile/policy, with frozen inputs, effects and allowances. The batch groups authorization and observation; each item has independent attempts, questions, submissions and review state.

At Go, compile an immutable **task manifest**: item and source revisions, role/action/profile revisions, context digest, scoped capabilities, runtime policy, required evidence, and review requirements. Symphony and a person-paired Codex session consume the same manifest. Aludel enforces permissions at its tool boundary; prompt text is guidance. Changed inputs require reassessment before a new attempt, while prior manifests and evidence remain available.

## One lifecycle, several result types

`queued → staged → authorized → running → needs answer → running → submitted → review → accepted or sent back` is the conceptual flow. Stop, stale input, exhaustion, and failure are explicit side states with a next action. A question is a durable attempt-linked request naming the blocked decision or input; it suspends dispatch while retaining the workspace. An answer becomes a new input revision and requires an explicit resume decision.

A submission contains one or more immutable, typed artifacts with provenance: knowledge revision proposal, code commit, preview, report, test result, image, or external change reference. An item may require several review requests. Reviewers open artifacts in their native surface, record verdicts against named criteria, and accept exact versions. Accepting a knowledge proposal applies it with revision conflict checks; accepting code uses the existing exact-commit gate. Release and deployment remain separate actions.

## Runner, scale, and shared human work

Aludel remains the tracker, task compiler, capability gateway, event store, and review system. Symphony schedules eligible attempts, owns agent sessions and workspaces, and reconciles failures. Generalize its adapter and host tools from `platform.implement` to an action-neutral manifest and typed Aludel read/propose/ask/submit operations. Migrate the three structured actions one at a time after parity checks, then remove their competing direct-model dispatch path. Keep the current code candidate implementation as one artifact adapter.

A profile is a logical policy, not one running session. Worker replicas claim from the same eligible pool. Add atomic claim/lease/fencing and per-profile, per-project, and global concurrency limits before running many replicas. Begin with one instance; test two instances racing for one item and recovery after a worker dies before raising limits. The Board shows aggregate capacity and per-item attempts, with infrastructure details in a drilldown.

For human-plus-Codex work, a person chooses a staged item and starts an interactive session from the same manifest and isolated workspace recipe. Its credentials and writes are scoped to that person and item. Codex can inspect live knowledge through the same Aludel tools, ask questions, and submit artifacts; the person can edit alongside it. PP-01R's read-only tools provide the starting read interface, not execution equivalence.

## Board behavior

Keep the Board for assembling and starting batches. Each lane header should show staged count, running count, available capacity, questions awaiting a person, and submissions awaiting review. Go should state the exact item count and allowance. Cards show one actionable state and next step; detail opens the attempt, question, artifacts, and review requests. A reviewer batch can contain hundreds of items without hundreds of lanes: the lane is the logical profile, with filtering and pagination. Show item progress and aggregate counts without implying one profile equals one session.

## Sequence and evidence

1. Add manual task creation and the action-neutral contract first. The owner found the current browser review impractical without a way to make representative tasks. Keep real-work dispatch gated.
2. Revise role/action/profile/batch schemas and compile a task manifest for four fixtures: Vision blurb, Data contract, code change, and role review. Check that two profiles can take the same action and a person receives the same task contract.
3. Build common question, submission, artifact, and review records. Test an item with two artifacts, send-back, stale input, and answer/resume. Keep accepted knowledge revisions and code commits as distinct application adapters.
4. Move one non-coding action through Symphony end to end, then migrate the structured actions without dual eligibility. Prove permission enforcement and recovery with disposable data.
5. Add interactive attach for a person-paired Codex session using the same manifest and workspace policy. Prove context/tool parity with autonomous execution while retaining separate human authority.
6. Add leased claims and bounded worker replicas. Demonstrate single execution under a two-worker race and recovery after a killed worker before testing higher throughput.
7. Refine the Board from owner tasks at small and large batch sizes. Verify the owner can find a blocked question, inspect multiple evidence types, send back one item, and see remaining batch progress. Then repeat the LAY-05 owner browser review as a coding proof using this improved flow.

The owner selected the schema and lifecycle work as WORK-AGENTS-01 before the coding proof's browser review. Keeping that work in a separate packet preserves LAY-05's evidence and review gate. This proposal does not choose a production concurrency target or authorize provider spend. Those follow measured task throughput, review load, and cost.
