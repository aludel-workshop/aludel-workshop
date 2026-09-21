# Selected Overview implementation QA

Date: 2026-09-19. Source: `../../docs/design/portal-system/v2/overview.png`. Source and implementation viewport: **1487 × 1058**, device scale 1, light theme, untouched three-decision BorrowBox fixture. Combined evidence: `../../tmp/the-machine-overview-concepts/overview-comparison.png` (source left, implementation right).

## Iteration 1 — blocked

P1: Material icon font failed to load, exposing clipped icon names in navigation, rows and actions. The first combined browser capture showed the failure despite successful compilation and axe checks. Fixed by bundling the official 13-icon subset as a source asset and restarting Vite to clear stale transforms. Added font-readiness verification to the final capture/check procedure. Full font was 5,188,960 bytes; subset is 6,088 bytes.

## Iteration 2 — desktop comparison

The combined post-fix image shows real Material icons in all positions. Outcome, left navigation, grouped decision queue, work rows and empty preview preserve the selected hierarchy. The question stack remains comparable, with one prominent collection action.

- Fonts/typography: self-hosted Roboto 400/500/700; headline scale and line count match. Generated text has slight weight/shape differences; no clipped text.
- Spacing/layout rhythm: 250px rail, 40px content gutter, three comparable decision rows, four compact work rows. Vertical positions differ by approximately 6–16px across the page, with equivalent grouping and available content. No P2 spacing drift.
- Colors/tokens: restrained indigo, tonal grouping, semantic blocked/waiting/ready colors. Crisp flat surfaces deliberately replace generated-image texture. The outlined request uses the upstream MD3 outline rather than a custom saturated border.
- Image quality: no raster content is required. Material Symbols supplies the provisional cube mark and functional icons; the generated shaded cube was never accepted as a brand asset. This is an explicit asset substitution, not a claimed exact logo reproduction.
- Copy/content: retains outcome and all three questions/consequences. Corrects “Proposed outcome preview” to “Latest preview” per the v2 review. Small synthetic-trial attribution is added below navigation.

Remaining P3: final brand mark, exact accent hue and minor row/heading rhythm are owner-tunable. None blocks the foundation experiment. Narrow and detail evidence must be inspected before final handoff.

Interim result: desktop passed; narrow verification pending at that point.

## Narrow and interaction inspection

Inspected the actual 390px captures `overview-built-narrow.png` and `decision-built-narrow.png`: labelled navigation stays visible, BorrowBox identity remains separate from the outcome, all three decision titles and consequences wrap without clipping, statuses move below their question, and work rows remain readable. The decision destination gives the long question room, keeps the extra implementation dependency visible, uses a labelled rationale disclosure and radio choices, and leaves Save answer explicit. No horizontal overflow. The narrow composition is an experimental adaptation; there is no owner-selected narrow source image to claim pixel equivalence against.

The desktop full comparison was inspected alongside full-resolution page imagery; there is no detailed raster content or dense illustration requiring an extra crop. The required fidelity surfaces are readable in these artifacts. Supporting destination design has no approved image target and is assessed for the bounded interaction contract only.

Validation: ten connected-flow scenario groups and fourteen isolated stories pass; axe checks found no violations in the tested main/story regions; keyboard answer submission and dialog return focus pass. These are not a complete screen-reader audit. Async draft-discard rendering was fixed following a failing browser check. Production-built artifact also passed a navigation/save/font smoke check.

Implementation checklist: source resolved; real fonts/icons loaded; wide comparison inspected after fix; narrow capture inspected; main flow and state cases checked; component/workshop limits recorded. No unresolved P0/P1/P2 issue within the bounded trial scope.

final result: passed
