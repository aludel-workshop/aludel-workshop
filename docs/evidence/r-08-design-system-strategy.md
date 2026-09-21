---
id: evidence-r08-design-system-strategy
kind: research-evidence
status: complete
updated: 2026-09-19
packet: R-08
---

# R-08 — Design-system strategy for open-ended products

## Decision summary

The reusable thing Aludel should own is a **design-system contract and evolution process**, not one visual system imposed on every product. Each product owns its design language, patterns, tokens, components, source references, deviations, and release history. Aludel supplies the intake, normalization, evidence, governance, and agent handoff needed to keep that product-specific system coherent.

D-01E is paused. The [three generated review-workspace images](../design/portal-visual/r0/README.md) explored surface character before the project had defined this layer. The owner's preference for dark option 3 is retained as mood evidence only; it is not an accepted visual baseline or permission to translate the image directly into CSS. A portal-specific foundation packet must choose how Aludel's own design system is sourced and governed before visual composition resumes.

## Question and scope

How can Aludel support an existing system such as Material, a modified third-party system, a client-authored system, or a new system without reducing design work to raw HTML plus a theme?

This packet covers strategy and process. It does not select a UI framework, install Storybook, create production tokens or components, or redesign the portal. Sources were accessed on 2026-09-19. Vendor documentation establishes published capability and practice, not fit in this repository.

## What mature systems demonstrate

| Source | Observed structure or practice | Implication for Aludel | Limit |
|---|---|---|---|
| [Material Design 3](https://m3.material.io/) and its [canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview) | Material describes itself as adaptable guidelines, components and tools. Its layouts provide named scaffolds and breakpoint configurations rather than treating pages as arbitrary component piles. | An imported system needs foundations, composition rules, adaptive layouts and component guidance—not just colors and buttons. A client can select Material as an upstream basis and then record explicit changes. | No Material implementation was installed or tested; design guidance does not choose a web library for us. |
| [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) and [design pathway](https://developer.apple.com/design/get-started/) | Apple organizes guidance into principles, foundations, patterns, components, inputs and platform technologies. It favors familiar system components and platform conventions, while allowing justified departures. | A design-system profile needs an explicit philosophy, platform assumptions and interaction patterns above tokens. Reference-system rules are defaults with rationale, not an aesthetic prison. | HIG is platform guidance, not a portable web component package. |
| [Carbon overview](https://carbondesignsystem.com/help/faq/) and [contribution process](https://carbondesignsystem.com/contributing/get-started/overview/) | Carbon combines styles, components and guidelines. New components use a phased product-development lifecycle and checklist; all patterns/components require usage, style, code and accessibility guidance. Preview/Labs states allow learning before stable adoption. | Component maturity and promotion must be explicit. A missing component starts as a product need and evidence problem, not an excuse for page-local markup. Documentation and accessibility are part of definition-of-done. | Carbon's organization and release model are evidence; adopting Carbon itself remains a product-specific choice. |
| [GOV.UK contribution criteria](https://design-system.service.gov.uk/community/contribution-criteria/) | A replacement needs evidence that it improves on the existing pattern; publication requires representative research including people with disabilities. | System changes need a stated gap, comparison with current assets, evidence and a promotion decision. Visual novelty alone is not improvement. | Its public-service research bar may be disproportionate for every bootstrap change; evidence must scale with consequence. |
| [Design Tokens Format Module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/) | The stable Community Group format expresses platform-agnostic token values, types, descriptions, groups and aliases for exchange between design and development tools. | Use DTCG-compatible JSON as the portable token interchange boundary. Keep source references and semantic aliases so a brand update can propagate intentionally. | It is a Community Group final specification, not a W3C Recommendation, and it does not define design philosophy or component behavior. |
| [Storybook component-driven workflow](https://storybook.js.org/docs/get-started/why-storybook) and [testing guidance](https://storybook.js.org/docs/writing-tests) | Stories capture component variations; small components compose into features and pages. The same states can support documentation, render, interaction, accessibility and visual checks. | Implemented component stories should be the inspectable behavior catalog and regression surface. Pages should consume stable components and patterns rather than reproduce them. | Tool claims are not local evidence; the portal stack and zero-cost test path still need a bounded implementation trial. |
| [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) and [read-me-first guidance](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/) | APG defines common widget semantics and keyboard behaviors and warns that an ARIA role is a promise to implement the expected interaction. | Component contracts must include semantics, focus and keyboard behavior. Prefer native HTML where it supplies the required semantics and behavior; visual customization cannot break the contract. | APG examples are guidance, not a substitute for testing with browsers, assistive technology and users. |
| [Design-systems practice study](https://arxiv.org/abs/2205.10713) | Practitioners reported tension between stable design knowledge and flexibility for concrete products, and valued bottom-up elevation of components from evolving products. | Use a federated model: product-local needs can incubate and later become stable assets. Do not demand that a central system predict every future component. | This qualitative study does not prove a particular schema or toolchain. |

## Chosen strategic approach

### 1. Federate systems; standardize the contract

Each generated product and Aludel itself has an independent design-system profile. The shared contract makes different systems legible to people and agents:

1. purpose, audience and desired experience qualities;
2. upstream system, brand and platform sources with versions and licenses;
3. principles and explicit deviations;
4. foundations and portable tokens;
5. interaction, content and adaptive-layout patterns;
6. assets, primitives, components, compositions and page archetypes;
7. states, accessibility behavior, stories and tests;
8. maturity, ownership, release history, deprecations and known gaps.

This preserves open-ended style. Material plus three modifications, a supplied Figma library, an existing production app, and an original design can all enter through the same process without pretending they have the same implementation.

### 2. Treat references as upstream dependencies

An adopted system is pinned by source and version. The profile records which guidance and assets are inherited, adapted, replaced or unsupported. Local changes become named deviations with reasons and affected consumers. Upstream updates are evaluated like dependency upgrades: diff, impact assessment, bounded migration, regression evidence and release—not silent rescraping or wholesale replacement.

### 3. Build through contracts, not page-local invention

Before page implementation, an agent must inventory applicable page archetypes, patterns and components. It should reuse first, compose second, extend an existing component third, and propose a new component only when the gap is real. Raw semantic HTML belongs inside a component implementation or an explicitly disposable experiment; it is not the normal page-building API.

A component is not ready merely because it renders. Its contract includes purpose, anatomy, inputs, variants, complete states, behavior, semantics, keyboard/focus behavior, content rules, responsive behavior, tokens, source provenance, stories, checks, maturity and migration notes.

### 4. Separate semantic intent from visual values

Portable tokens use three useful levels where evidence warrants them:

- **reference tokens** hold raw palette, type, spacing and motion values;
- **semantic tokens** name intent such as text, surface, border, action or feedback roles;
- **component tokens** exist only for durable component-specific decisions that semantic roles cannot express.

This permits a client theme or upstream update to propagate without erasing why a value exists. A token may change appearance; it must not silently change interaction meaning.

### 5. Promote from product need

Assets move through `proposed → incubating → stable → deprecated`. A proposed asset names the unmet user/product need and checks the existing catalog. Incubating assets may serve one bounded product slice with documented gaps. Stable assets require the agreed contract, representative states and checks. Promotion is evidence-based; frequency alone does not prove that two similar things should be unified.

## Intake-to-evolution workflow

```text
intent and sources
  → classify origin (adopt / adapt / translate / originate)
  → pin and inspect sources
  → extract philosophy, foundations, patterns and assets
  → normalize a product-owned profile and token aliases
  → map existing product UI and identify gaps
  → prove one representative vertical slice
  → accept the system revision
  → assemble features from its catalog
  → observe gaps and promote, revise or deprecate assets
```

The intake must distinguish facts present in source material from inferred rules. Screenshots can evidence appearance; they cannot specify interaction or accessibility. Figma can author design assets; executable stories and checks remain the authority for implemented behavior.

## Measures

The system should be measured as a product, using baselines rather than vanity counts:

| Measure | Definition | Desired signal |
|---|---|---|
| Catalog coverage | required UI states mapped to stable/incubating assets | gaps are explicit before page build |
| Reuse rate | shipped component instances using catalog assets | increases without forcing bad abstraction |
| Escape rate | page-local UI implementations without an approved exception | trends toward zero |
| Duplicate-pattern rate | materially equivalent interaction patterns with different contracts | decreases after review |
| State completeness | required states with inspectable stories and behavior checks | reaches the agreed contract per stable asset |
| Accessibility pass rate | automated checks plus named manual/assistive-technology evidence | no known critical failure; automation never claimed complete |
| Visual drift | changed pixels outside approved token/component impact | unexplained drift is zero |
| Propagation cost | consumers manually edited for one system-level change | falls as token/component boundaries prove useful |
| Change lead time | gap identified to accepted stable revision | measured by change class, not optimized at the expense of quality |
| User outcome | task clarity, success and confidence for affected journeys | product evidence confirms that system reuse still serves users |

Coverage and reuse are diagnostics, not goals by themselves. A high reuse rate can conceal the wrong component, while a clean screenshot can conceal broken behavior.

## Application to Aludel

The accepted v4 structure and flow remain valid. The three D-01E images did not compare design-system philosophies; they primarily varied surface treatment. Option 3 establishes a tentative preference for a focused, dark operational character, but does not establish typography, component anatomy, interaction behavior, density, adaptive rules or governance.

The next portal packet must compare implementation foundations rather than more page skins. It should evaluate at least:

- an adapted comprehensive system such as Material 3;
- an enterprise web system such as Carbon;
- an accessible headless behavior layer with a portal-owned visual language.

Apple HIG remains a philosophy and platform-convention reference, not a candidate web package. The comparison must use the same portal slice and score philosophy fit, accessibility behavior, theming range, component/state coverage, adaptive layout, dependency/upgrade cost, agent legibility and ability to express the preferred dark operational character. The owner then selects a foundation strategy. Only after a profile, initial catalog and vertical-slice evidence exist may D-01E resume.

## Retrospective and propagation

**Avoidable friction.** D-01E treated visual direction as a page-level composition problem. Image generation preserved the accepted structure but mostly changed color, typography and surface styling; it could not demonstrate a reusable system or its evolution path.

**Reusable improvement applied.** The product-development workflow now requires a design-system fit check before composition and a catalog-first check before implementation. A reusable profile template records sources, philosophy, tokens, assets, governance and measures. D-01E is explicitly gated by a portal foundation packet.

**Observed test.** Applying the new contract to the three existing concepts correctly classifies all three as insufficient for implementation: none has an upstream/base decision, component contracts, token provenance, story coverage or change-governance evidence. This is a classification result, not proof that the process will produce better software.

**Downstream effects.** B-01 must establish the selected design-system repository structure and component workshop before assembling the portal shell. Context bundles must include the exact design-system revision and only the relevant asset contracts. D-01E becomes a consumer of the selected system instead of inventing CSS directly.

**Questions.** Q-009 asks which foundation strategy Aludel itself should adopt. Q-010 asks how strict the default evidence bar should be for promoting an asset to stable; D-01F can propose a proportional answer without blocking its initial comparison.

**Reversal evidence.** Reconsider the federated contract if two materially different real products cannot be represented without product-specific schema forks, or if a vertical-slice trial shows the abstraction costs more manual translation than a source-native workflow. Reconsider DTCG interchange if the selected tools lose essential semantics or cannot round-trip representative tokens.

**Task outcome.** R-08 is complete as research and operating strategy. It does not select Aludel's implementation foundation or validate any component toolchain. Next action: D-01F.
