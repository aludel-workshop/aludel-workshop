# WORK-AGENTS-01 — LAT layer-origin Pages adapter checkpoint

Date: 2026-09-28. Branch: `feature/layer-app-model`. This is an isolated candidate change. Candidate dispatch stayed disabled; tests used disposable projects and a worker stand-in. No provider turn, external write, current-portal change or owner acceptance occurred.

## Process outcome

LAT-05 already produced exact-input receipts and Work suggestions, but the shared Symphony admission path could not run `pages.flows`. The reusable rule applied here is: the originating layer supplies a pinned source and reviewed policy, while Work alone authorizes a batch, holds the proposal, checks acceptance and applies the output. A layer routine never grants Go. The test follows a real Pages-origin item through that boundary and checks a policy change during review.

## Task outcome and evidence

- `pages.flows` is an explicit Symphony action with a `pages_flow_proposal` output. The compact task card carries layer origin, gap/receipt and policy controls alongside its story target. Its proposal names an existing page for each step and cites exact story/page revisions.
- Go snapshots the reviewed connection revision. Changed policy or layer-origin context withdraws an active attempt; a changed policy also blocks later acceptance. Submission is read-only. Exact, checked Work acceptance creates the flow with Work provenance and links its ID back to Work. The agent cannot apply a flow itself.
- The existing ten adapters remain explicit. Unsupported actions stay blocked. Pages suggestions remain `suggested` until a person queues, assigns and Go-authorizes them.
- `node --test apps/portal/tests/task-manifest.test.mjs apps/portal/tests/symphony-proposals.test.mjs apps/portal/tests/pages-reconciliation.test.mjs`: 16/16 passed after the initial acceptance-branch fix. The proposal test checks missing page citation, no pre-acceptance record, required checklist verdict, changed-policy rejection and exact flow creation. A later focused proposal run passed 11/11 after Work-to-flow link and origin pin tightening.
- `npm run test:server --prefix apps/portal`: 133/133 passed before the final origin/link tightening; affected focused tests passed again. `npm run typecheck --prefix apps/portal` and `npm run build --prefix apps/portal` passed with existing optional-chain and chunk-size warnings. `git diff --check` passed before the final link change.

## Retrospective and remaining gates

1. **Friction:** action eligibility lived in several lists, and Work's generic verified-item close rule expected a change to the target story. A flow is a new Pages output; the first integration test exposed that mismatch. The acceptance boundary now checks the exact proposal and permits that output shape.
2. **Next equivalent task:** declare an action's output shape, source controls and acceptance effect together, then exercise Go → submission → review against the layer's real record schema. Consolidating duplicate eligibility lists remains useful but is not claimed as done.
3. **Downstream effect:** LAT-05 can now use the Pages agent adapter in a disposable Work journey. It still requires an authorized end-to-end agent run and owner review before completion. LAT-06 should reuse the same source/policy pin pattern for other layer-origin items.
4. **Open questions and blockers:** WORK-AGENTS-01 still needs a person-side typed submission path, a two-host claim race with fencing, and owner browser validation. Person-paired read-card parity is checked below. A live Pages turn would require a fresh owner Go and candidate dispatch setup; neither was inferred from this request.
5. **Applied versus hypothesized:** the layer-origin/Work-review split passed disposable domain tests; live host behavior, model comprehension, and owner usefulness remain hypotheses. The documented two-host race has not run.

## Person-paired read parity checkpoint

The editor bridge now compiles the same `aludel-task-open-v1` semantic card for person-assigned tasks that have an output adapter. It returns the output ledger and exact target revisions through its existing member/project-scoped MCP `task_context` route. The card labels the editor connection `context-only`, with no submission capability; the editor does not impersonate a worker or grant Go. An ordinary person task with no agent adapter still returns its context and an explicit unavailable-card reason. The editor test checks the saved digest, read scope, unsupported action and real MCP route. Focused editor/manifest tests passed 3/3. After this change, the full candidate server suite passed 133/133, typecheck passed, and `git diff --check` passed. This proves read-card parity, not person-side typed submission or a live paired Codex turn.
