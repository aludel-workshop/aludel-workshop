---
id: work-agents-01-audit-slice
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# WORK-AGENTS-01: first executable agent contract slice

## Scope and outcome

The owner authorized a small, solid local build on 2026-09-25. The existing Go-pinned Symphony worker now accepts `platform.security` as its first non-code action. A pure compiler turns its pinned bundle into a compact task card with role/action/profile revisions, target revisions, one declared output and explicit effects. The worker exposes project-scoped knowledge map/search/read, a blocking audit question, and an immutable structured security report. Work shows active audit progress, then report findings, agent checks, used knowledge and audited commit for checklist review. The existing code candidate path remains separately guarded.

A reserved audit run appears as **Working**; a question moves the item to **Needs you**. The owner answer queues it for a new batch and Go pin, with the answer in the new card. A report can be submitted only from a registered, reserved audit attempt with a clean workspace at the pinned commit; the shared repository remains unchanged. A repeated identical submission returns the same report ID. The Work item cannot be accepted as done until the report exists and its checks are accepted. This is a local provider stand-in proof, not an owner-reviewed or live Codex run.

## Implemented boundary

- `server/task-manifest.mjs` compiles only the two explicit output adapters, code candidate and security report. Free-form action `tools`/`changes` do not grant a generic write surface. It rejects missing pins, missing targets and unsupported actions; the pure compiler test also rejects an audit action widened to code effects.
- `server/symphony-worker.mjs` pins at Go, checks material input drift, restricts knowledge to a reviewed kind allowlist and project/profile token, and checks action-specific effects at submission. Audit reports are stored by attempt in `symphony_reports` and surfaced in Work context. The report includes the exact audited commit.
- The Symphony host overlay exposes task open, knowledge map/search/read, audit question and audit submission. Its one-turn workflow gives action-specific instructions. The existing coding context/commit tools remain.
- A new Symphony item never joins an already running batch: it needs a new Go snapshot. This closes the gap revealed by the question/resume test.

## Checks and observed results

On disposable SQLite projects and Git workspaces, `security-audit-worker.test.mjs` passed Go → HTTP task open/knowledge map → scoped read → registered one-turn attempt → question → owner answer → new Go → clean-workspace report → review verdict → done. It also rejected an unknown digest, invalid search, audit use of code commit/submit tools, a dirty audit workspace and premature acceptance. Repeated question and report calls were idempotent, including HTTP report retry after portal restart; conflicting question text was rejected. A report omitting its pinned target revision was also rejected. The seeded model-facing task card stayed under 10 KB in the fixture. The shared repository HEAD stayed at the audited commit.

The focused runner/editor suite passed **16/16** tests, including the pre-existing coding worker's terminal-workspace retention and restart scenario. That coding fixture needed an explicit story, which the staging contract already requires. `npm run typecheck` and `npm run build` passed; typecheck reported two pre-existing optional-chain warnings in Code, and build reported a large bundle warning. `git diff --check` passed. Elixir `mix` is unavailable in this environment, so the modified host overlay was inspected for balanced delimiters but not compiled. No real Symphony/Codex audit turn or owner browser review was run.

## Retrospective and next work

The existing worker had a good Go/attempt/candidate boundary, but it treated every Symphony item as coding and the existing task bundle was too large for model entry. Reusing that boundary with an explicit output adapter was faster and safer than adding a second runner. The question trial found a real authorization flaw: staging into a running Symphony batch would have skipped the Go snapshot. The implementation now forces a new draft batch and the test covers the result.

This proves one non-code action's contract, not action neutrality across all layers. The editor MCP bridge still uses its older context shape; knowledge links, record candidate proposals, multiple output entries, review-agent actions, worker claim fencing and parallel capacity remain open. The report UI and owner answer flow need browser review. The next implementation slice should share the compact card with the person-paired bridge and add one record-proposal action (Vision or Data), then test two-worker claim fencing before widening concurrency. Keep real-work dispatch off until owner validation.
