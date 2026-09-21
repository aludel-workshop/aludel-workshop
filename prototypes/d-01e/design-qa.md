# D-01E design QA

## Current result — 2026-09-20 (supersedes historical report below)

Owner entry: http://localhost:4175/review.html

The owner's local repair authorization includes verification; the prior browser-permission blocker no longer applies. [Owner-entry checks](../../docs/design/portal-visual/v1/harness-validation.json) passed: task authorization → simulated completion → review → reservation → acceptance, reset preserving outer notes, visible exceptional scenarios and 390px host overflow check. [Candidate checks](../../docs/design/portal-visual/v1/browser-validation.json) cover eight flows and a wide/narrow axe subset with no captured page errors. Angular typecheck and production build passed, with the known bundle-size warning.

Rendered outer captures: [wide](../../temp/review-harness-wide.png), [narrow](../../temp/review-harness-narrow.png). Missing icon glyphs and embedded-preview clipping were found and fixed. The displayed inner check count is fixture text, not these actual results.

This is an operability-focused 70/30 pass. Full same-viewport visual comparison, comprehensive outer accessibility checks and owner acceptance remain pending. This same-origin, browser-local simulation does not prove real execution or production isolation. Q-005 remains open. See the [retrospective and deferred vision](../../docs/design/portal-visual/v1/review-harness-retrospective.md).

Current result: scoped operability checks passed; D-01E remains open.

## Historical report — 2026-09-19

**Source visual truth:** `docs/design/portal-visual/v1/selected-direction.png`

**Implementation:** `prototypes/d-01e`, candidate route `/?scenario=candidate#/borrowbox/reviews/A1`

**Target viewport:** 1487×1058 CSS px at device scale factor 1; narrow behavior target 390×844 CSS px.

**Source dimensions:** 1487×1058 px. **Implementation dimensions:** pending browser capture. No density normalization has been applied yet.

**State:** selected option 1, current candidate A1. Stale and unavailable states are additional behavioral checks, not the primary visual comparison state.

**Findings**

- [P0] Browser-rendered implementation evidence is unavailable.
  Location: full candidate workspace.
  Evidence: the source visual is present and directly inspected, but this session exposes no in-app/cloud browser. The Product Design workflow requires owner permission before using the repository's Playwright/Chromium harness directly.
  Impact: layout, typography, colors, raster-asset quality, copy, narrow reflow, interaction behavior, console state and accessibility cannot be claimed as visually verified.
  Fix: after permission, capture wide and narrow implementation states, create the same-viewport combined comparison, inspect focused preview/evaluation regions, run the prepared interaction/axe suite, fix P0/P1/P2 differences and repeat.

**Open Questions**

- Whether owner permission is granted for the local Playwright/Chromium harness in this session.
- Q-005 still determines which evidence gaps must block acceptance; the selected composition surfaces the gap without resolving that policy.

**Implementation Checklist**

- Capture current candidate A1 at 1487×1058.
- Run the prepared connected-flow and accessibility checks at wide and 390px widths.
- Produce `comparison-wide.png` with source and implementation in one image.
- Inspect typography, layout rhythm, colors/tokens, drill asset quality and app-specific copy.
- Fix all P0/P1/P2 findings and repeat comparison.

**Follow-up Polish**

- Deferred until the first valid browser comparison.

**Comparison history:** none; browser comparison has not been authorized or captured.

**Primary interactions tested:** none in a browser. Angular typecheck and build passed, but they are not browser evidence.

**Console errors checked:** no; browser not run.

final result: blocked
