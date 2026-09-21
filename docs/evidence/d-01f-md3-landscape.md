---
id: evidence-d01f-md3-landscape
kind: research-evidence
status: research-complete-trial-pending
updated: 2026-09-19
packet: D-01F
---

# MD3 implementation landscape and bounded adoption

## Later scope correction

DEC-021/022 reopen page composition and interaction grouping and establish shared global structure versus project-specific realization. The implementation findings below remain relevant; instructions to preserve old page structure or begin solely with the old review slice are superseded by the [current groundwork record](../design/portal-system/v1/work-record.md). Start from view intents and MD3 philosophy. Aludel uses the same project contract as other products.

## Scope and readiness

Owner direction: “I am actually interested in using material design 3,” followed by a request for efficient adoption, current ecosystem research and a recommendation. This establishes MD3 as the direction to investigate; it does not accept a library, framework change, rendered system revision or production implementation. D-01F remains open. Accepted D-01D structure and D-01B qualified interaction evidence remain inputs; visual acceptance is still missing.

The process gap is that a design-language name can be mistaken for an implementation guarantee. Check specification coverage, actual package support and maintenance separately. Preserve this distinction in the system profile and tool registry. This research applies that check before any dependency installation.

Readiness: ready for bounded implementation-fit evaluation. Before constructing the proof, pin package/license/runtime versions, check the accepted review contract, record required components and resolve the chosen renderer's workshop/test support. No packages, accounts or paid services were installed by this research. Vendor documentation below establishes capability claims, not local compatibility or accessibility results.

## Primary-source findings

All sources accessed 2026-09-19. Live documentation and main-branch sources are discovery evidence; trial inputs must be pinned to exact releases/revisions.

| Candidate | Documented evidence | Assessment for this portal |
|---|---|---|
| Material UI | [Current overview](https://mui.com/material-ui/getting-started/) explicitly says Material Design 2; [MD3 tracking issue](https://github.com/mui/material-ui/issues/29345) remains open/on hold. | Strong React ecosystem candidate, but MD3 would require a measured adaptation. Theme colors alone cannot establish conformance. Do not select it under the assumption it already implements MD3. |
| Angular Material | [Current theming source](https://github.com/angular/components/blob/main/guides/theming.md) specifies MD3 and supports theme/component override APIs; [MIT license](https://github.com/angular/components/blob/main/LICENSE). | Recommended first trial for MD3 with an established component library. Requires evaluating Angular against the proposed React stack; this is a recommendation, not an accepted architecture change. Use public APIs and measure custom code. |
| Google Material Web | [Repository](https://github.com/material-components/material-web) provides MD3 web components and explicitly states maintenance mode pending new maintainers. | Reference implementation; avoid making it the default new dependency without a maintenance plan. React wrappers inherit this upstream exposure. |
| Base UI | [About](https://base-ui.com/react/overview/about) describes unstyled React components; [accessibility guidance](https://base-ui.com/react/overview/accessibility) describes behavior and remaining application responsibilities. | Credible behavior foundation if React and substantial visual ownership are intentional. We would own MD3 styling, motion and fidelity checks. Defer for this reuse-first path. |
| Beer CSS | [Repository](https://github.com/beercss/beercss) describes an MIT, framework-independent MD3 CSS framework and Expressive support. | Useful lightweight candidate/reference. Treat interaction, keyboard, complex widgets and maintenance coverage as unproven until tested; appearance does not establish parity with a comprehensive component library. |
| react-material-3-pure | [Repository](https://github.com/0xXrer/react-material-3-pure) describes a pure React implementation with WIP/partial coverage. | Watchlist/reference. Its own scope statement does not support treating it as a full MUI replacement. |

Recommendation is an inference from these capabilities and this project's scope: trial Angular Material first because MD3 is now the direction and ADR-003's React choice is still proposed. If retaining React becomes a requirement, trial a bounded Material UI adaptation with explicit deviations. If that adaptation needs pervasive private CSS overrides or recreated interactions, reconsider the foundation rather than accumulating patches. Do not build several full demos to settle a question that a component-coverage review can eliminate.

## Small supporting toolset

- **Design authority:** [Material 3 guidance](https://m3.material.io/) and an explicitly recorded baseline/Expressive scope. A library's MD3 claim does not establish support for every newer Expressive component. Preserve accepted product hierarchy; the system informs its expression.
- **Theme exploration and generation:** [Material Theme Builder](https://github.com/material-foundation/material-theme-builder) and [Material Color Utilities](https://github.com/material-foundation/material-color-utilities). Keep chosen semantic values in the repository and map them through the selected library's supported APIs. Use built-in palette tooling where adequate; avoid two competing token authorities. Generate at build time unless runtime personalization is a real requirement.
- **Icons:** [Material Symbols](https://developers.google.com/fonts/docs/material_symbols), with a consistent style and only needed assets. Icons still need product-appropriate labels and semantics.
- **Component workshop:** Storybook source stories, documentation and controls for product components and meaningful states. Link unchanged upstream primitives instead of copying the entire upstream catalog.
- **Tests:** renderer-compatible interaction tests, [Storybook accessibility checks](https://storybook.js.org/docs/writing-tests/accessibility-testing), manual keyboard/focus checks, and [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) plus integrated journeys. Automated accessibility checks are partial evidence. Use a stable browser/environment for image baselines.
- **Framework compatibility:** [Storybook Angular guidance](https://storybook.js.org/docs/get-started/frameworks/angular) now points Angular 21+ users to Angular/Vite for Vitest integration. The [MCP documentation](https://storybook.js.org/docs/ai/mcp/overview) distinguishes Angular/Vite manifest support from Angular/Webpack. Pin and test the exact combination instead of transplanting the React setup blindly.
- **Agent discovery:** repository catalog/stories first; optional Storybook MCP for local assets. Its AI capability remains preview. [MUI MCP](https://mui.com/material-ui/getting-started/mcp/) supplies upstream documentation if MUI is chosen; it does not know our accepted product patterns.
- **Conditional tools:** Figma when canvas collaboration is useful; hosted visual review when local review becomes inadequate; Style Dictionary when actual token-output needs justify it. Keep current R-09 cost/account gates. [MUI X licensing](https://mui.com/x/introduction/licensing/) separates community and commercial packages; specify required features before choosing paid tiers.

## Efficient D-01F proof

1. Inventory only the accepted review slice's needs: project context/navigation, evidence list, status/exception notice, feedback field, response actions and any necessary confirmation dialog. Map each to an upstream component or justified product composition.
2. Evaluate Angular Material first on coverage, supported theme APIs, desktop density, narrow layout, keyboard behavior, static hosting and workshop compatibility. Compare MUI adaptation on paper; construct a competing spike only for an unresolved consequential tradeoff.
3. Create one minimal system profile and semantic theme with recorded source/deviation scope. Favor MD3 defaults where they fit. Keep the previous dark operational mood provisional rather than forcing it to override the new direction.
4. Build only the reusable product pieces needed for the review workspace. Stories cover current, stale, missing evidence, error and disabled/submitting conditions where applicable. Reuse the same components and fixture data in the composed preview.
5. Verify wide/narrow rendering, focus/keyboard behavior, automated accessibility and a meaningful response interaction. Deliberately break one assertion and observe failure, restore it, and record the result. Measure setup effort and custom adaptation code.
6. Perform one token-change propagation check and one small component-substitution check. Record which consumers changed and what remained coupled. These demonstrate limited portability; they do not prove a future cross-framework migration cheap.
7. Present the working composition and relevant stories for scoped owner review. Close D-01F only after its full acceptance and retrospective requirements pass; then D-01E composes the broader visual baseline.

Stop expanding the toolset once the component/state, integrated-flow and review needs are covered. Reopen foundation selection only for a demonstrated gap or changed owner constraint.

## Coupling policy

Use native library APIs inside the UI layer, with theme configuration centralized. Create product components such as ReviewEvidence, ReviewResponse and AuthorizationSummary where they encode product meaning. Avoid wrapping every primitive in a universal prop facade: that duplicates APIs and can hide useful accessibility behavior. Keep domain state and authorization logic independent of UI imports. Portable tokens, fixtures, acceptance examples and product contracts reduce migration scope; they do not remove framework rewrite cost.

## Research retrospective

1. **Observed friction:** the Material name obscures MD2 versus MD3 implementation, and earlier React-oriented workshop assumptions could have biased library selection. Primary sources exposed both before installation.
2. **Improvement applied:** system intake now distinguishes language, implementation and supported revision; owner-directed exploration narrows comparisons to implementation fit. Status, D-01F, Q-009 and the registry consume this finding.
3. **Plan effect:** MD3 replaces the open-ended Material/Carbon/headless exploration as the current direction. Angular is a first trial recommendation; ADR-003 remains proposed. D-01E remains blocked on a proven and accepted system revision.
4. **Questions:** MD3 direction is clarified; exact library/framework, accepted deviations and Expressive scope remain part of Q-009. No new owner answer is required to finish this research; a concrete proof should inform system acceptance.
5. **Evidence and limits:** applying the intake distinction classified six candidates and caught two material support gaps. No local runtime, library, workshop, visual-quality or migration test ran. Predicted efficiency and maintainability remain hypotheses for D-01F.

**Next action:** D-01F — bounded MD3 implementation-fit evaluation and representative workshop proof. **Stop condition:** no production portal, external deployment or paid adoption as part of this research/prototype packet.
