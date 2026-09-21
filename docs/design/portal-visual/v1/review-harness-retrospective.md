# Reviewable demos: 70/30 delivery and retrospective

2026-09-20 · D-01E accepted by owner; see closeout below. Earlier sections preserve pre-review findings.

## Delivered scope

One local outer Machine review page (`prototypes/d-01e/review.html`) embeds the candidate Machine, including its review page. Five starting scenarios, reset, viewport sizing, a separate-preview link, review tasks and browser-local notes with JSON download support exploration. BB-001 authorization is inside the candidate; simulated build completion is in the outer controls. Inner acceptance applies only to fictional BorrowBox. Outer notes concern Aludel and survive inner reset.

Entry: http://localhost:4175/review.html. This is a bootstrap host, not a deployed accepted Machine instance. Host/candidate share an origin and use trusted synthetic data. Origin/source checks restrict the completion message; the simulated state transition requires Running. This is not production isolation. Run progress is in memory; notes use localStorage. The development server serves a mutable working copy, not an immutable artifact. Production acceptance remains the owner decision recorded in the repository.

## Vision deferred

| Improvement | Trigger |
|---|---|
| Versioned ReviewSpec shared by host, Storybook and browser checks | A second demo needs the same setup; avoid a general engine for one consumer |
| Durable ReviewSession, annotations, checklist and exact build identity | B-03 artifact and acceptance implementation |
| Accepted Machine host with separately isolated candidate origin | Before untrusted previews or real credentials |
| Storybook fixtures shared with whole-flow tests | Task/review components stabilize; reuse the existing workshop |
| Worker failure, missing checks, cancellation and revision → new task → new candidate | Next scoped interaction expansion after owner feedback |
| Durable runs, storage errors, authentication and production routing | M1, after phase gates |
| Smaller icon font bundle | Before production performance budgets; full installed Material font fixes absent glyphs now |

Reuse basis: [prior benchmark](../../../evidence/r-07b-workflow-benchmark.md) and [tool registry](../../../tool-ecosystem.md), plus the preceding research on Storybook controls/play functions, Chromatic review discussions and Netlify/Vercel overlays. No hosted service was added. The host reuses the selected preview-plus-supporting-pane relationship with plain local controls.

## Why standards were missed

Observed artifacts show a compliance failure despite existing guidance:

1. The product-development workflow already requires review instructions, scenario controls and separation from the product; D-01B v4 implemented them. D-01E copied the narrower D-01F foundation trial and inherited hidden query fixtures without restoring the earlier functional harness.
2. The current-candidate image became the effective scope. The prerequisite Ready → authorize → result journey remained absent. The prior work record declared readiness without demonstrating reachability from the review entry.
3. `tests/browser.mjs` opens candidate fixtures directly using query parameters. It can bypass the missing authorization action. At the previous handoff those tests were merely prepared, not executed.
4. Copying the prior prototype initially copied its passing QA report and tests with old evidence output paths. The report was later changed to blocked, but inheritance made evidence confusion easy.
5. `docs/status.md` still described pre-selection work after option selection and partial implementation. A fresh session would receive the wrong next step.

These observations do not establish model-internal causes. A supported explanation is that visual fidelity became the effective gate while owner-entry reachability remained unchecked. More prose alone would repeat the existing failure.

## Correction applied and tested

The operating procedure now requires an owner-entry smoke check at the exact handoff URL, from clean fixture state, using visible actions. No direct-route or storage injection may stand in for the primary journey. Exceptional states use visible harness controls. Reset must preserve actual reviewer notes. Copied reports must be marked inherited; partial handoffs must update status.

`tests/review-harness.mjs` follows Work → BB-001 → authorize → outer simulated completion → A1 → reserve → accept. It would fail on the previous missing Authorize control. It also checks reset/notes separation, stale/unavailable acceptance guards and narrow host overflow. [Actual results](harness-validation.json) and screenshots in `temp/review-harness-wide.png` / `temp/review-harness-narrow.png` support those claims. Visual inspection exposed missing font glyphs and clipped content at the embedded width; both were corrected and recaptured.

This shows the new check catches this particular omission. General prevention and improved owner comprehension remain unproven. No efficiency measurement was made.

## Plan and questions

D-01E stays open. “Looks decent” supports the visual direction but also reports an interaction failure. Q-002 authorization and Q-005 required evidence remain production questions. No phase transition, external deployment or spending follows. Next: owner explores the outer review, then scoped corrections and final packet retrospective incorporate that feedback. Production claims remain bounded by the known isolation, identity and persistence gaps above.

## Owner review and closeout — 2026-09-20

Owner now reports “looks good” / “overall, this is looking great” and requests starting the app. D-01E is complete as an owner-selected composition and operable interaction baseline, not as production readiness. The owner explicitly identifies the outer host as disposable and requires useful functionality, especially its checklist, in the real review bar. DEC-026 and B-03 now carry this requirement; the host is not a new long-term framework.

Observed outcome: the repaired harness enabled an owner review and received positive feedback. Together with the executed entry-path test, this supports usefulness for this iteration, not a general process-effectiveness claim. The earlier compliance investigation remains valid. A new prevention rule is to assign each useful prototype-harness capability a production destination or an explicit fixture-only disposition; this was applied to B-03 now. Its migration effectiveness remains untested until the real component exists.

Remaining visual comparison and comprehensive accessibility work are assigned to B-01 component implementation/QA rather than further prototype polishing. Q-002/Q-008 still constrain B-03; Q-005 must be resolved before production acceptance policy. Hosted-preview/cost evidence and concrete B-01 technical readiness remain G-00 issues. No hosted gate is claimed passed or waived by this feedback.
