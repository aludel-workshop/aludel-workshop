# T03-G3 catalog and T03-VISION local evidence

Date: 2026-09-30. Scope: isolated `pages-template-candidate` and local `layer-base` template branch only. The 2026-09-30 owner chat authorized bounded catalog prerequisite and Vision conversion; no provider write, owner-data cutover, deployment, spending or promotion occurred.

## Outcome

- **T03-G3, transitional catalog:** reviewed `builtIn` pins now supply the declarations and install presentation for converted `product`, `pages` and `data`. Unconverted Design, Code and Deploy retain compiled declarations and setup choices until their packets; templates-off preserves the full legacy catalog. Manifest validation rejects a missing pin, unknown output kind, duplicate kind and authority mismatch. Existing instance keys remain `product`, `pages` and `data`; package adoption keeps the instance UUID and typed record IDs/revisions. A newly reviewed built-in pin needs no copied catalog presentation.
- **T03-VISION:** local `layer-base` branch `vision` at `ac96e2f` owns the Vision manifest, charter, Brief/story/document methods and the accepted Brief, Story map and Documents Angular view. The candidate pins the full commit in `apps/portal/config/layer-templates.json`; the frame builds that exact view. Its generated-document call is scoped to the Vision frame, and the shared evidence panel works inside the frame. The compiled portal view remains the templates-off fallback.
- Vision stays in records mode. The accepted typed record writer and Library index remain authoritative; this transfer did not reinterpret historical `vision_section`, `phase`, `spec`, `research` or `project` records. Documents remain shared Library records displayed in Vision. Pages' story references continue to resolve through Library. No later layer is required for Vision to read its own output.

## Checks and observations

- Template-off candidate server suite: **215/215 passed**. After final pin-derived declaration refactor, targeted onboarding, Data, Library and layer contract suites: **28/28 passed**; focused catalog, frame and Vision suites: **8/8 passed**. Candidate typecheck and production build passed (existing Angular optional-chain and bundle-size warnings only).
- Pinned Vision frame compiled independently using `tools/build-layer-ui.mjs`; the frame integration test built it from two disposable instances and found the same artifact at their distinct origins.
- Disposable new project: Vision template repository bound to its `product` instance, its charter appeared in Library, and a story read/pin retained its exact revision. With every other layer disabled, Vision output remained readable.
- Disposable existing project: templates-off project gained a Vision repository on restart without changing the `product` instance UUID or story IDs/revisions.
- Disposable browser journey on a template-enabled isolated server: started with no layers, enabled Vision, edited a Brief claim, opened/closed its evidence panel, added a Story map activity, generated a PR/FAQ, found the claim in Library, and reopened the Brief at 390 px. No page errors or horizontal portal overflow; axe found no WCAG 2 A/AA or 2.1 AA violations in the portal or Vision frame.

## Retrospective

1. **Friction observed:** Data's successful one-layer adoption concealed the remaining fixed install presentation. The first Vision browser assertion also assumed a heading inside the frame and then exact copy for a generated document; both were test assumptions rather than product failures.
2. **Preparation for next conversion:** keep a separate runtime catalog-source assertion for template-on and templates-off modes, plus one browser journey through native frame controls and Library. Inspect the frame API allowlist and shared UI overlays before moving a component; Vision needed document generation and the evidence panel.
3. **Plan effect:** catalog transfer can proceed while compiled Design, Code and Deploy remain available. T03-DESIGN is next; Deploy stays deferred by DEC-059. The accepted Vision UI and record authority are now independent of the compiled portal path in template mode.
4. **Questions:** owner comparison of the candidate and original portal remains LAT-09. Original-owner-data cutover and recovery remain LAT-10. Neither blocks the next local template conversion.
5. **Process change applied and tested:** pin-derived declarations and presentation now have assertions for reviewed pins, missing pins and runtime modes. The Vision browser journey checked frame interactions and accessibility, demonstrating this gate catches missing frame permissions and false copy assumptions. Broader owner usefulness remains untested until LAT-09.
