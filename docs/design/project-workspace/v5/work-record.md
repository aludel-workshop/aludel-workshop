---
id: project-workspace-v5-work-record
kind: work-evidence-retrospective
status: agent-checked-owner-review-pending
updated: 2026-09-20
work_item: WORK-3d1ff5be-6a05-4232-93a7-1c8ff88b1ba5
attempt: 12b5dd89-f49c-4128-84af-be28084cdd51
---

# D-04 evidence and post-hoc

**2026-09-20 review correction:** Owner rejected UI quality. The [D-04R audit](../v6/work-record.md) found inert Plan action, selection-independent Intake grouping and a hidden narrow detail title. Existing passes remain historical results of their exact assertions; broad claims of interaction coherence, aggregation and source revision behavior exceed those assertions. Do not use this revision as an accepted implementation baseline.

## Scope and readiness

The owner authorized proposal `PROP-22d2e9e3-8f0a-4d7e-8b2e-a53d9665c1f8` revision 2 and D-04 work version 2 for local research, design, repository changes, checks, and preview. The task replaces the rejected D-03 lifecycle-lane composition. Production feature code, live migration, automatic execution, external effects, spending, release, and product acceptance were excluded.

The v4 four-job direction was accepted as input; page composition, projection choice, and PW-01 implementation scope were experimental. The work was ready for prototype construction because owner jobs, accepted MD3 foundation, realistic source records, and stop boundaries were available. It now needs owner judgment before implementation authorization.

## Outputs and observed evidence

| Requirement | Evidence | Result |
|---|---|---|
| Current pattern comparison and reversal conditions | [research.md](research.md) | Agent-checked primary-source comparison recommends outline default, dependency/rollout secondary, board later |
| Four-surface responsibility and shared graph | [design.md](design.md) | Overview, Plan, Operations, and Intake have distinct questions and authorities; plan/task/attempt/review/acceptance/release remain separate |
| Connected executable prototype | [index.html](index.html), served copy under `apps/portal/dist/reviews/project-workspace-v5/` | One fixture model drives all views; selection and identity cross views |
| Foundational revision behavior | Plan detail in [app.js](app.js) and design contract | Exact fixture source revisions are shown; stale fixture identifies the changed Product revision and requires reassessment |
| Plan projection recommendation | [design.md](design.md) | Outcome outline is default; dependency/rollout is secondary; board deferred with reversal condition |
| Revised implementation boundary | [pw01-contract.md](pw01-contract.md) | PW-01A owns shared plan graph, Plan, Overview, and bounded reconciliation; Intake and real Operations are staged separately |
| Browser behavior | [browser-results.json](browser-results.json), [wide overview](overview-wide.png), [narrow intake](intake-narrow.png) | Connected journeys, collapse aggregate, view selection, detail reload/return, error/cardinality/stale/draft/keyboard/narrow/accessibility checks pass |

The source identity for the review handoff is recorded in [MANIFEST.sha256](MANIFEST.sha256). The served HTML, CSS, and JavaScript copies matched these sources byte-for-byte during the final check.

The browser suite used Chromium against the owner-facing local review URL. It exercised zero, one, several, and 24-record states; missing identity; explicit load failure; stale foundation input; intake keyboard grouping and reload persistence; active/awaiting-input/failed/ready-for-review attempt examples; 390 px overflow; axe WCAG A/AA tags; and page errors. Automated results report zero axe violations and zero page errors. The prototype remains a fixture: it proves interaction coherence, not live API, worker, migration, or scheduling capability.

## Post-hoc

The work exposed two avoidable failures. First, the previously reported Work collection bug trapped the owner on the first detail after refresh. The durable collection/detail check added after B-03A required collection entry, distinct records, detail reload, visible return, and collection reload. D-04 reused that rule and its stable `#/item/:id` route; the test passes. This is evidence that the check catches the original failure mode, while broader owner usability remains unproven.

Second, the first D-04 browser run timed out because the prototype route parser retained `#` in the first segment. The diagnostic rendered the fallback instead of Work. Fixing the parser and rerunning exposed two ambiguous test selectors before the suite passed. A mounted preview should therefore receive a route smoke check for every advertised top-level URL before deeper assertions. This change was applied in the executable suite; its value was observed immediately through earlier, clearer failures. It remains uncertain whether a separate reusable helper is worth maintaining until another prototype uses it.

The first test run also failed when the local portal process had stopped. The compatible Node runtime was restarted and the final suite completed. Future evidence should record server/runtime prerequisites next to the review command so a stopped preview is distinguished from a product failure.

The owner feedback changed the roadmap boundary materially: lifecycle state is metadata, not durable feature navigation. PW-01 should begin with the shared plan graph and owner steering views. Intake is a later product-record slice; truthful Agent Operations stays coupled to B-03 worker/lease/recovery evidence. This prevents a fixture dashboard from becoming an implied runner capability.

No new owner question was necessary during execution. The remaining scoped product judgment is recorded as portal decision `QUESTION-0ba7340a-edbf-42b8-b0f8-006cfd7a66a3`: accept or revise the four-surface composition and staged PW-01 boundary. Until answered, PW-01 implementation, live reconciliation, and B-03C Operations remain blocked.

## Verdict and next action

**Agent verdict: complete for scoped interaction review; needs owner judgment for implementation readiness.** Next action D-04R is owner review of the local prototype and [portal decision](http://127.0.0.1:4310/#/the-machine/decisions/QUESTION-0ba7340a-edbf-42b8-b0f8-006cfd7a66a3). A positive decision permits preparing, but does not authorize, PW-01A implementation work.
