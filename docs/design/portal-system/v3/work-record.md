# D-01F executable foundation trial

Date: 2026-09-19. Status: D-01F complete; owner foundation selection recorded in DEC-025.

## Intake and readiness

The owner's “alright, go go” authorizes the revised v2 Overview and bounded local component/workshop trial. It does not select Angular for production, accept adjacent page compositions, authorize deployments or advance to M1. DEC-024 records this scope.

Inputs: v2 overview.png, interaction-contract.md, v1 system-profile.md and view-intents.md; D-01F and R-09 acceptance contracts. Previous pages supply semantics only. Readiness: ready for this local experiment. Other compositions, production ranking, authorization scope, recovery policy and evidence sufficiency remain open.

Process improvement being exercised: define interaction placement and collection scale before constructing reusable patterns. The app and workshop must consume the same components and fixture contracts; verify zero/one/three/many/unknown, failed/conflicting save and independent work readiness. Documentation alone is not effectiveness evidence.

## Dependency order and scope

1. Isolated supported Node runtime; pinned Angular Material MD3 and Storybook dependencies.
2. Semantic theme, named reusable queue/status/work patterns, source stories.
3. Selected Overview; minimal linkable queue and decision destination, request draft and read-only work/review destinations to exercise transitions. These adjacent compositions are experimental, not canonized.
4. Production/static workshop builds, browser interaction/accessibility checks, desktop/narrow screenshot comparison, token propagation and component substitution experiment.
5. Evidence, catalog, limitations and retrospective; owner foundation selection.

The selected image has no photography or raster illustration. Its cube is treated as a provisional product icon (Material Symbols deployed_code), not a finalized brand asset. Roboto and Material Symbols are real, locally served library assets. “Proposed outcome preview” is corrected to “Latest preview” per v2 inspection. Trial data and saved drafts are browser-local synthetic fixtures, with no external effects.

The product-design image-to-code skill applies to fidelity and browser QA. Its React starter default is superseded by the explicitly requested Angular Material implementation-fit experiment; use a dedicated Angular/Vite scaffold. Browser tooling is local Playwright because no connector browser is available in this workspace. The isolated runtime avoids changing system Node.

## Destination contracts

- Overview exposes outcome, question/consequence/status, work summary and preview availability; full questions have identities and navigate.
- Decisions is a scoped open/all collection. A detail page displays consequences and alternatives, discloses extra rationale, explicitly saves, remains on the result, and offers a deliberate next link. Return retains filter and scroll via browser history. Direct links have a Decisions fallback.
- Answers only change synthetic decision state. Checks continue waiting for implementation even after a decision is answered. No run/release operation exists.
- Request uses a focused writing destination. Session drafts survive navigation/reload and failed saves. Saving creates a local request fixture; a short discard dialog is the only modal and returns focus.
- Work is a minimal read-only collection/detail; Reviews truthfully says no preview. Projects shows the synthetic BorrowBox choice. These validate destinations, not full product design.

## Retrospective and results

Observed results:

- Angular Material 22.1.7 on isolated Node 24.15.0: production app build and strict template typecheck pass; built artifact navigation/save/font smoke passes. Exact versions and licenses are in dependencies.json and the prototype lockfile.
- Storybook 10.6 static build passes in explicit-story mode. Four components, fourteen stories, all render and pass the tested axe subset. Retry interaction updates unknown to known. A deliberately incorrect post-interaction assertion is rejected. Catalog discovery resolves source/story identities without MCP.
- Ten connected-flow scenario groups pass: cardinality, explicit save, remaining dependencies, draft retention on failure/conflict, revision re-review, deep links/filter/scroll, request draft/discard/focus, local request save, keyboard answer, narrow overflow/accessibility and primary-token propagation.
- Material chip substitution preserves the small status contract and passes the story check; no framework-independent replacement is claimed.
- Desktop source and browser screenshot were combined and inspected at the same 1487×1058 state. Icons initially failed; post-fix comparison and 390px Overview/detail inspection pass the scoped design QA. Screenshots are in project tmp as requested.

Evidence: [browser checks](browser-validation.json), [workshop checks](workshop-validation.json), [production smoke](production-smoke.json), [design QA](../../../../prototypes/d-01f/design-qa.md), [catalog](catalog.json), [system profile](system-profile.md), [artifact manifest](manifest.json).

### Mandatory retrospective

1. **Observed friction:** system Node was unsupported, sandbox prevented network/listen/browser operations until the approved execution path was used, mounted-filesystem watching left stale font transforms, automatic Storybook docgen timed out twice, and the first asset import included an unnecessarily large font. Browser tests also exposed asynchronous discard state not rendering. Two harness errors (CSS uppercase comparison and incomplete fixture reset) were corrected; they were not product defects. The icon failure passed compilation and axe, demonstrating why visual evidence is separate. Final inspection also removed a stale numeric Open filter count when decision availability is unknown; the browser case now checks both Overview and collection.
2. **Applied preparation:** isolated runtime, pinned lockfile, workshop-specific tsconfig, explicit documented docgen fallback, polling for this mounted workspace, self-hosted 13-icon subset, font-load assertions, fixture reset and waits for the actual Material dialog close lifecycle. The reusable operating procedure now calls out runtime/adapter readiness, assets in the browser and async connected-flow checks. These changes were exercised by passing reruns, not merely proposed.
3. **Plan impact:** Angular Material is viable for this bounded MD3 slice; the recommendation is to retain it for owner evaluation. Storybook supplies useful isolated inspection but automatic API extraction is not dependable here. D-01E consumes only scoped accepted assets; B-01 must resolve production framework and workshop adapter/docgen support, full candidate-evidence patterns and performance. No global tool mandate or phase advancement follows.
4. **Questions:** revised desktop direction was accepted for construction (DEC-024). Runtime/system acceptance, adjacent view designs, narrow usability, production docgen support and full review-evidence scope remain open. Q-002/Q-005/Q-006/Q-008 remain unaffected. These block their named implementation scopes, not local inspection.
5. **Process evidence and limits:** the placement-first contract produced explicit queue scale, separate save semantics, retained drafts and bounded dialogs that the browser could test. Visual inspection caught unloaded icons; connected checks caught discard rendering despite standalone component coverage. This supports these checks for this task. Better long-term speed, owner comprehension and general efficiency remain hypotheses; no independent handoff or production integration was performed.

### Cost and scope

No spending, account, external message or deployment occurred. npm installed 430 packages in about two minutes. Cold local Vite startup was observed at roughly 22–31 seconds on this mounted workspace; app/workshop logs record transform times rather than pretending to measure end-to-end setup. Two 120-second docgen timeouts are a material setup cost. The downloaded icon payload fell from 5,188,960 to 6,088 bytes. Current compiler-containing app bundle is prototype packaging, not a performance acceptance result.

### Next action

Owner accepted the presented foundation with “looks great. finish this up” (DEC-025). D-01F is complete; next is D-01E using the exact [accepted handoff](d-01e-handoff.md). Destination layouts remain experimental.

### Acceptance closeout retrospective

The existing scoped-acceptance procedure was adequate: distinguish foundation selection from component stability, adjacent layouts and production transition. No additional ceremony or process rule was needed. Checked the original implementation hashes before closeout and retained the original test manifest; acceptance metadata has its own manifest. Updated the decision register, capability allocation, system profile, execution plan and status together so an accepted foundation is not still routed as a blocker. This demonstrates consistent handoff bookkeeping, not improved user performance. Production docgen support and full candidate-evaluation design remain assigned gaps. No application code changed and no browser test was rerun solely for documentation acceptance.
