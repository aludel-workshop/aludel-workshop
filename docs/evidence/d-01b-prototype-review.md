---
id: evidence-d-01b
kind: prototype-review
status: v4-owner-reviewed-with-follow-up
updated: 2026-09-19
packet: D-01B
---

# D-01B — Guided product-flow prototype

## Owner review of v4 — 2026-09-19

The owner described v4 as “finally useable,” “still hideous,” and “at least fairly clear.” Record qualified acceptance of overall interaction usability/clarity, and rejection of visual quality (DEC-017). No individual scenario was narrated; authorization scope and review-evidence sufficiency remain unresolved. The acceptance table below records the earlier handoff's pending dimensions; this feedback supplies an overall judgment, not blanket acceptance of every row.

D-01B is complete as the bounded owner-reviewed M0 experiment. Required follow-up before B-01: D-01E visual direction and representative-state specification, preserving the usable flow. Q-004 is partially informed; Q-005 and Q-002 remain open. No M1 transition is approved. See the [cross-iteration retrospective](d-01-design-retrospective.md) for strategy changes and limits. The construction/handoff notes below are retained as dated evidence.

## Version 4 — selected project workspace A

[Open the running local prototype](http://localhost:4174) · [Source](../../prototypes/d-01b/v4/index.html) · [Work/readiness record](../design/process/d-01b-v4-work-record.md).

Built on 2026-09-19 from D-01D structure revision 1 and DEC-016. Version 3 source remains unchanged. V4 implements Overview → BB-D01 → affected Work collection → BB-001 → immutable candidate review. Overview / Work / Decisions / Reviews are distinct destinations. Decision save stays on its record; authorization, queue confirmation and worker claim are separate transitions. BB-003 is dependent reservation verification, while BB-002 remains independent.

Run from the workspace root:

```sh
python3 -m http.server 4174 --bind 127.0.0.1 --directory prototypes/d-01b/v4
```

Open <http://localhost:4174>. Use HTTP because the source uses ES modules. Saved fixture records use localStorage key `machine-d01b-borrowbox-v4`; unsaved form drafts use sessionStorage and survive navigation/reload in that browser session. Reset v4 leaves historical prototype storage alone. No packages or build are needed to run the prototype.

### Three review tasks

1. Resolve BB-D01 and inspect affected work. Open BB-001 by name. Does each destination match what you expected, including the distinction between affected and ready work?
2. Read the task and authorize its revision. Advance through the external simulation controls; try an unavailable worker, failed attempt or agent question. Is the current state and next action clear, and is authorization sufficiently bounded?
3. Open A1, inspect its preview/evidence and request revision or accept it. Use **Change policy input** to make the candidate stale. Can you tell which inputs you reviewed and why acceptance is blocked?

The guide and simulation controls are outside the product shell. Select an outcome before advancing execution; reset between independent scenarios. Progress is deliberately stepped rather than timed. Missing checks, unavailable preview and zero/one/many affected tasks have separate harness controls.

### Agent verification

- Five model tests passed: authorization gating, immutable candidate revisions, current/evidence acceptance guards, uncertain cancellation and explicit continuation.
- Chromium checks passed: zero/one/many affected collections, filtered returns, unchanged candidate identity across A1→r2→A2, exact acceptance, missing checks/preview, changed-policy staleness, worker unavailability, connector unknown/conflict, safe linked retry, agent input, uncertain cancellation, saved-state refresh and unsaved review draft retention.
- Five routes had no horizontal overflow at 390px. A keyboard Tab check reached a link with a visible focus outline. No page errors were observed. This is not a full accessibility audit.
- Desktop and narrow review screenshots were inspected: selected project navigation, candidate identity, brief, preview, evidence and response remain in document order. The expanded external guide occupies substantial vertical space on narrow screens and can be collapsed; owner feedback should assess that cost.

Evidence: [browser results](d-01b-v4/validation.json), [model output](d-01b-v4/model-tests.txt), [Overview](d-01b-v4/overview.png), [desktop review](d-01b-v4/review.png), [narrow review](d-01b-v4/review-narrow.png), [input and source identities](d-01b-v4/manifest.json).

Reproduce model checks with `node --test prototypes/d-01b/v4/model.test.mjs`. Browser checks use `prototypes/d-01b/v4/browser-check.mjs`, the server above, and an installed Playwright module via `PLAYWRIGHT_MODULE`. This environment reused `/tmp/app-builder-d01b-browser/node_modules/playwright/index.mjs` and its existing extracted library directory via `LD_LIBRARY_PATH=/tmp/app-builder-d01b-browser/libs/usr/lib/x86_64-linux-gnu`; no dependency installation or spend occurred.

### Boundaries and acceptance

All execution, tracker state, check results, diffs and artifact IDs are synthetic. BorrowBox is a static preview illustration, not an implemented reservation app. Supporting task rows are inspectable context only. New requests, Projects selection, other projects, full planning/release, live connections, arbitrary intent editing, backend recovery and deployment are outside this bounded experiment. Storage failure cannot prove durable backend behavior. Source identity is captured by SHA-256 because this workspace has no Git metadata.

| Scope | Agent evidence | Owner acceptance |
|---|---|---|
| Navigation and collection/detail separation | Route/cardinality/return checks passed | Pending |
| Task states and recovery | Named exceptional scenarios exercised | Pending |
| Authorization checkpoint | Separate mutations and input identity checked | Pending; Q-002 unresolved |
| Candidate review/evidence | Immutable/stale/missing-evidence guards checked | Pending; Q-005 unresolved |
| Narrow interaction and feel | Layout and limited keyboard checks passed | Pending; Q-004 unresolved |

**Process outcome:** applied the existing readiness gate and transition ledger to a new isolated version; validation demonstrates the named contracts in the fixture. No new general procedure was needed. Owner usability and process effectiveness across independent handoffs remain unproven.

**Task outcome:** v4 is ready for owner operation. D-01B remains incomplete until actual feedback and required revisions are recorded. Next action: D-01B owner interaction review. Return to D-01D only if that review exposes a missing page responsibility or transition. No implementation phase transition is implied.

---

The following sections retain historical v1–v3 findings and run instructions. They do not describe the active v4 prototype.

## Version 3 — selected direction B

Version 3 implements the owner-selected **Decision queue** direction from D-01C, using BorrowBox as the generated application. The portal opens on BB-M1 with BB-D01 selected beside its affected work. BB-002 and BB-003 remain visibly independent. Recording “Confirm immediately” produces an explicit no-blocking-decisions state and makes BB-001 ready; it does not start execution. The task then presents a separate authorization summary before the simulated queue/run/review lifecycle.

The BorrowBox preview shows tool-reservation behavior and contains no portal decisions, tasks, or agent controls. The surrounding review guide and scenario selector remain outside the proposed portal. Version 3 supersedes the earlier layout experiments for review; their findings remain below as history.

The [prototype source](../../prototypes/d-01b/index.html) implements the [self-change brief](../design/self-change-brief.md) inside the [product experience foundation](../design/experience-foundation.md). This is an M0 interaction fixture, not M1 execution evidence. All connection states, attempts, source identities, diffs, checks, usage, and previews are explicitly synthetic. No external account is connected and no task executes code.

## Owner feedback on version 1

Review on 2026-09-18 found that version 1 was premature and not reviewable in context:

- It presented a cluster of domain records without first establishing user stories, overall product structure, navigation, investigation patterns, or layout strategy.
- It did not explain what part of the product was being shown, what the reviewer should exercise, or how to judge the result against the original intent or an approved specification.
- Its small task-section menu did not establish location in the overall product.
- Prototype scenario controls appeared inside the proposed product page, making test machinery look like product functionality.
- A few operable boxes were insufficient evidence that the interaction had been designed intentionally.

This feedback is accepted as a required revision to D-01B. It does not accept Q-004 or Q-005 yet.

Version 2 adds the missing design layer before treating the screen as a candidate:

- one primary owner expressed through five working modes and an ordered M1 user-story spine;
- portfolio and project information architecture, record hierarchy, and page responsibilities;
- ten reusable interface patterns plus layout and disclosure rules;
- an intent-to-learning product-design pipeline with durable outputs and review methods;
- a review contract for all future prototypes;
- a visually separate review guide and scenario harness around the proposed product;
- a global product shell and project-local navigation to establish where the vertical slice lives;
- a project overview organized around attention, work that can proceed, and latest product state.

## Run and inspect

From the workspace root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory prototypes/d-01b
```

Open <http://localhost:4173>. No package install or build is needed. Serve over HTTP rather than opening the HTML file directly because the application uses ES modules. State is saved in browser localStorage; use the same hostname and port when returning. Prototype controls → Reset clears only this prototype's records. The fixture represents one task in one project; it is not a multi-project implementation.

1. Compare the selected blocking decision with independent catalog work, then record **Confirm immediately**.
2. Confirm that the page reports no blocking decisions and that execution has not started. Open **Review ready task**.
3. Inspect the frozen intent and product-decision revisions, then authorize the bounded local-preview task.
4. Simulate queue confirmation, worker claim, and next result. Each step is deliberate so intermediate states are inspectable.
5. Inspect A1's BorrowBox preview, evidence, source identity, checks, and limitations. Accept it, or request the prefilled revision and authorize another attempt.
6. Compare A1 and A2 in Artifact history. Historical artifacts retain their original inputs; stale ones cannot be accepted.

The preview is a fixed BorrowBox fixture, not a renderer for arbitrary requests. Local acceptance records are prototype feedback only; they do not resolve repository decisions Q-002/Q-004/Q-005 or authorize real execution.

## Alternate scenarios

Choose a scenario in Prototype controls before authorizing/advancing execution. Reset between independent scenarios if desired.

| Scenario | Operable behavior |
|---|---|
| Worker unavailable | Mapping confirms, task queues, no claim possible; restore heartbeat or cancel. |
| Connector unavailable | Authorization persists while write outcome is unknown; reconcile existing mapping before a claim. |
| Connector conflict | Stored Ready/v7 versus observed Cancelled/v8; choose portal authorization or honor cancellation. |
| Failure | Failure after workspace preparation, retained compile-log summary, publication not attempted; authorize retry for a new linked attempt. |
| Blocked input | Answer the deferred-blockers question; a separate continuation authorization is required. |
| Cancellation | Cancelling remains nonterminal; simulate missing confirmation, then reconcile runner and connector stop. |
| Stale artifact | Change Q-002 or task interpretation after a result; old artifact names mismatched inputs and disables acceptance. |
| Revision | Feedback remains bound to A1; task r2 and a new authorization produce A2 while A1 remains inspectable. |

## Verification

- `node --test prototypes/d-01b/model.test.mjs`: 9 passing checks covering decision gating, artifact-bound acceptance, revision preservation, stale rejection, worker availability, connector ambiguity/conflict, retry, input continuation, cancellation, and JSON persistence.
- `node --check prototypes/d-01b/app.mjs`: passed.
- Chromium browser verification passed: happy path; A1→r2→A2 revision; historical stale-acceptance rejection; reload persistence and section deep-link reload; worker unavailable/cancellation, connector unavailable, connector conflict, failure, and blocked-input scenarios; no horizontal overflow at 390 px; no JavaScript page errors.
- Captured screenshots: [overview](d-01b-overview.png) and [review](d-01b-review.png). [State test output](d-01b-model-tests.txt) is retained. Screenshot inspection confirmed the desktop overview layout; this is not a complete accessibility audit.

The optional [browser check](../../prototypes/d-01b/browser-check.mjs) uses Playwright and the local server. Run from the workspace root with `PLAYWRIGHT_MODULE` pointing to an installed Playwright `index.mjs`. Test tooling is not a runtime dependency. This environment has Node 18, so verification used Playwright 1.48.2 / Chromium 130 in `/tmp/app-builder-d01b-browser`, with a locally extracted ALSA library. The latest Playwright rejected Node 18; no system package or application dependency was changed.

Source is labeled v1 and retained in this workspace. There is no `.git` repository here, so no source-control commit identity can be supplied. Fixture source/build identifiers are intentionally labeled and are not real hashes. Browser persistence is not proof of gateway crash recovery; R-05 remains required.

## Owner feedback on version 2 and pause

No owner feedback has been received. No interaction decision has been accepted on the owner's behalf. D-01B remains incomplete until review feedback and required revisions are recorded here.

On 2026-09-18 the owner declined to review the visual prototype yet. The page remained a cluttered early composition, but the more important finding was recursive: the prototype capability itself needs the same granular, inspectable product-design process that the depicted feature was missing. Directly writing JavaScript was the wrong next design step.

The requested reset calls for feature, page, view, and component rationale; reference or inspiration material; loose verbal and visual exploration; potentially generated image concepts for major views; and a cleaner line from product definition to screen. It also identifies `/docs` as insufficient for long-term tasks, prototype detail, and relationships, requiring a database and an efficient discovery mechanism for agents entering a fresh workspace.

The response is [R-07A](r-07a-product-workflow-rebaseline.md), the [product-development workflow](../design/product-development-workflow.md), and the [knowledge strategy](../knowledge-strategy.md). D-01B will resume only after R-07B benchmarks working systems and D-01C produces an owner-reviewed design packet with alternatives.

No navigation, layout, or review-workspace choice in v1/v2 is accepted. Q-004/Q-005 remain open and should be reframed through the new design process rather than answered against this artifact.

## Demo content revision — 2026-09-18

Per owner direction, the retained lifecycle experiment displays BorrowBox as the managed project and a tool-reservation app inside the preview. It uses BB-D02 (fictional execution scope), while D-01C v2 uses BB-D01 (reservation product policy); both are defined in the [canonical fixture](../design/demo-app/borrowbox.md). Local storage uses a new key so old portal records cannot mix with BorrowBox; old saved state is retained under its previous key. Historical screenshots above predate this content revision. This version's layout remains unaccepted; D-01D supplied the structure for the next version.

Verification after fixture migration: all 9 model tests passed; JavaScript syntax check passed; existing browser suite passed happy path, revision, stale acceptance, reload/deep links, five alternate scenarios, and mobile overflow with no page errors. Updated captures: [BorrowBox overview](d-01b-borrowbox-overview.png), [BorrowBox review](d-01b-borrowbox-review.png). These remain simulated UI evidence, not BorrowBox behavior tests.

## Version 3 verification and pending review

On 2026-09-19, all nine model tests and the JavaScript syntax check passed. Chromium verification passed the selected B queue, no-decisions state, distinction between product decision and execution authorization, A1→A2 revision, stale-acceptance protection, refresh/deep-link persistence, worker/connector/failure/input scenarios, explicit narrow-screen return to the decision list, 390 px horizontal-overflow check, and page-error collection. The current captures are [direction B overview](d-01b-overview.png) and [BorrowBox artifact review](d-01b-review.png).

This local prototype is not M1 implementation evidence. The owner feedback below pauses D-01B and defines the structural work required before another interaction version.

## Owner feedback on version 3 — 2026-09-19

The owner confirmed that the prototype is “significantly better” and that the initial direction B hierarchy makes sense: decisions first, ready tasks beneath. BorrowBox also clarified the separation between portal and generated application.

The review rejected the rest of the current structure. The post-decision state is ambiguous between completion, empty state, and personalized follow-up. A component summarizing several tasks should not unexpectedly route to one specific task; the owner expects a Work collection or an explicit decision-specific follow-up. The task page has no clear intended stories or primary action, its links look like tabs but jump through bento sections, and unrelated work does not belong on task detail. The navbar and page layouts also encode unresolved design choices.

Detailed findings and the resulting gate are in [portal foundation feedback](../design/portal-foundation/feedback-2026-09-19.md). Version 3 remains evidence for the accepted opening hierarchy and rejected surrounding structure; it should not be incrementally polished. D-01D later passed that gate for a new bounded prototype. Q-004/Q-005 remain open.
