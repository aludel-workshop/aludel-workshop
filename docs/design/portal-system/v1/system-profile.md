---
id: portal-md3-profile-v1
revision: 1
status: proposed-concept-foundation
updated: 2026-09-19
packet: D-01F
---

# Aludel: MD3 as an experience foundation

**Intake:** adapt MD3 to a desktop-first, adaptive web workspace for one owner managing several products. **Scope:** concept foundation for [view intents](view-intents.md); no implemented system release exists. **Desired qualities:** clear, composed, purposeful, approachable, trustworthy. **Avoid:** operations-console clutter, anonymous piles of cards, ambiguous action icons, purely decorative metrics and motion, and a styled wireframe with unchanged hierarchy.

## Source authority and evidence

Product intent and authorization rules govern meaning. Material guidance informs interaction, hierarchy, adaptation and visual expression. The selected library will govern supported implementation APIs; local product patterns own compositions absent upstream. Any conflict is a named deviation requiring a reason and an affected-consumer check.

Primary sources accessed 2026-09-19:

- [Google Design's MD3 Expressive research](https://design.google/library/expressive-material-design-google-research) explains emphasis through visual attributes and stresses context, familiar patterns and user needs. Its findings motivate hypotheses; they do not establish gains for this portal.
- [Material canonical examples](https://m3.material.io/foundations/layout/canonical-examples/overview) identify feed, list-detail and supporting-pane arrangements. The page is JavaScript-rendered; search evidence exposed the layout categories. [Google's accessible canonical-layout guide](https://developer.android.com/develop/ui/views/layout/canonical-layouts) supplies readable explanations. We translate the relationship principles to web; Android APIs and dp breakpoints are not web implementation requirements.
- [Implementation landscape](../../../evidence/d-01f-md3-landscape.md) distinguishes design specification, library support and maintenance. Angular Material is the first trial candidate, not selected architecture. Upstream live pages are research inputs; pin library releases and archive applicable guidance before executable proof.

No source assets/code have been copied into the implementation. Source licenses and exact versions must accompany any later asset/package intake. Prior wireframes are reference evidence of intent and failures, never the new system's visual authority.

## Principles with consequences and checks

The following are product-specific interpretations informed by Material, not purported verbatim official principles.

| ID / principle | Consequence for composition and behavior | Example check |
|---|---|---|
| MP1 Start with the person's job | Choose the view's question and next useful action before its layout or component inventory | Returning owner can name outcome and next step without reading every region |
| MP2 Give emphasis a reason | Size, typography, tonal contrast and placement express action priority; strong treatments must correspond to consequential actions | Overview's primary action leads to the most consequential reviewed item; secondary request action does not compete |
| MP3 Group by relationship | Use list-detail when selecting among independent records; supporting panes when context serves a main task; containment follows object relationships | Explain why every region belongs together; three unrelated sections are not automatically three cards |
| MP4 Preserve orientation across space | Navigation, record identity and state survive resizing, deep links and return paths | Selected record remains identifiable on narrow screens; back returns to the right collection/filter |
| MP5 Make action and consequence legible | Labels describe outcomes; selection and commit are distinct; state feedback persists where consequential | Saving an answer cannot be mistaken for authorizing an agent or releasing a build |
| MP6 Use expression to clarify | Color/shape/motion communicate emphasis, state and continuity. Calm defaults; Expressive features only with a purpose and library support | Removing animation loses no information; no flourish distracts from a blocking question |
| MP7 Accessibility is part of structure | Reading order, focus, labels, contrast, target size and reduced motion belong in the pattern contract | Keyboard completes the represented task; no status depends only on color; long labels and zoom remain usable |
| MP8 Design for real content and uncertainty | Zero, one, many, unknown, stale and failed states have an intentional next step | Unknown count never renders as zero; no candidate produces an honest empty state |

These principles govern page archetypes and choices before token work. An attractive component assembled into the wrong hierarchy fails MP1–MP3.

## Initial pattern catalog

All assets below are **proposed**; none are stable or implemented.

| Pattern | Meaning / consumers | Composition and behavior | Library versus product responsibility |
|---|---|---|---|
| Project context/navigation | V01–V09: retain product and destination | Labelled adaptive navigation with explicit project identity; format under review | Library primitives can support navigation; route identity and cross-project state are product-owned |
| Attention item + context | V02/V05: choose consequential record | Comparable rows with type, consequence and named destination; optional selection pane | List/select/focus primitives upstream; prioritization and consequences product-owned |
| Outcome briefing | V02: understand objective and obstacle | Typography and grouping on shared surface; one next action | Product pattern assembled from text/action primitives; no bespoke card required |
| Decision with impact | V04: informed choice | Options, rationale, affected scope, explicit save and persistent result | Form components upstream; readiness recalculation and conflict semantics product-owned |
| Authorization summary | V06: informed permission | Revision/effects/stops visible before commit, stale submission rejected | Upstream controls/dialog only; permission contract belongs to domain API |
| Progress/exception | V07: waiting or safe recovery | Plain-language stage and next safe action, detail on demand | Progress/disclosure primitives; reconciliation truth belongs to coordination |
| Candidate evaluation | V08/V09: compare intent and result | Main preview with supporting brief/evidence/response, identity always retained | Adaptive composition is product-owned; MD3 does not supply artifact provenance or preview isolation |

## Visual and input foundation for concepts

Use one readable sans-serif family (Roboto as a trial starting point), a restrained MD3 type hierarchy, semantic tonal surfaces, a single coherent accent palette and consistent labelled Material-style navigation. Use spacing and typography first; containment should explain a relationship. Light versus dark is experimental; the earlier dark mood is not an acceptance constraint. Do not assume color generation alone creates usable contrast.

Concepts may show shape and tonal emphasis; new Expressive widgets or spring motion are not required. Executable proof must map tokens through supported APIs, check light/dark only for modes in scope, keyboard/focus and reduced-motion behavior, and use semantic roles for error, warning and success. Dense desktop layout must not shrink usable input targets indiscriminately. Final token values, breakpoints and motion parameters remain pending real component proof.

## Governance and readiness

Promote proposed → incubating only when source and behavior exist with named consumers. Stable requires contract, representative state coverage, interaction/accessibility evidence, responsive checks and scoped review. Deprecated assets retain a replacement and migration note. Library updates trigger review of deviations and affected stories; no global reskin without impact assessment.

The [capability map](../../../system/the-machine.md) supplies the boundaries: MD3 supplies design guidance; the component library supplies widgets; Storybook supplies isolated inspection; the portal must still supply domain semantics, whole-flow correctness and artifact acceptance. No universal wrapper library is planned.

Ready for three static Overview composition hypotheses grounded in MP1–MP8. Not ready for production implementation or a stable catalog. Required next evidence: owner composition feedback, pinned library/runtime support, actual component workshop and connected-flow checks. Track custom overrides, duplicated behavior, setup effort, missing states and owner task comprehension in that trial.
