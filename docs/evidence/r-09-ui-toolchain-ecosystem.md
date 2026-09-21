---
id: evidence-r09-ui-toolchain
kind: research-evidence
status: complete
updated: 2026-09-19
packet: R-09
---

# R-09 — Reusing the UI and design-system tool ecosystem

## Recommendation

Use **Storybook as the preferred component workshop and agent–human inspection boundary**, subject to a small D-01F trial. Keep the source-controlled component, story and test contracts authoritative; treat Storybook's MCP server as a replaceable preview adapter because its AI features are explicitly in preview.

Do not ask Storybook to own product intent, design-system governance, integrated application behavior or artifact acceptance. It should make implemented components, compositions and states inspectable. The actual app preview remains the place to evaluate complete journeys, data integration and recovery.

The repository already had useful point research in R-07B and R-08, but no maintained capability registry or adoption policy. This packet adds that layer at [the UI tool ecosystem registry](../tool-ecosystem.md).

## Why Storybook fits this workflow

### One executable artifact serves agents and humans

[Storybook stories](https://storybook.js.org/docs/get-started/why-storybook) capture named component variations as code and can be reused for development, documentation and tests. Humans can browse isolated states and controls; agents can update the same story next to the component instead of producing screenshots or bespoke review pages that drift.

Current Storybook also documents a local [MCP server](https://storybook.js.org/docs/ai/mcp/overview) that lets an agent query component manifests and documentation, locate stories, and run configured component/accessibility tests. That directly supports Aludel's catalog-first rule: an agent can ask what exists and how to use it before writing UI. The capability is marked preview and framework support is incomplete, so the system must remain operable from repository files and ordinary commands without MCP.

### States can become review and test fixtures

Storybook's test tooling uses stories for render and interaction checks; the [accessibility addon](https://storybook.js.org/docs/writing-tests/accessibility-testing) can make detected violations warn or fail in CI. Its own documentation says automated axe checks are a first line and can catch only a subset of WCAG issues, so manual keyboard, screen-reader and product-level evaluation remain required.

Stories give the owner a better review unit than a screenshot for questions such as:

- how a task summary behaves with zero, one and many blockers;
- current, stale, unavailable and missing-evidence review states;
- focus, hover, disabled and loading behavior;
- compact, wide, dark and light modes;
- the exact component revision an agent claims to have reused.

### It does not force hosted spend

Storybook is [MIT-licensed](https://github.com/storybookjs/storybook/blob/next/LICENSE), runs locally and builds a static application that can be [published to ordinary static hosting](https://storybook.js.org/docs/sharing/publish-storybook). Hosted visual review is optional.

## Authority boundary

| Concern | Authority | Storybook's role |
|---|---|---|
| Product intent, page responsibility and journey | Product/design records | Link the relevant revision; never replace it |
| Design-system profile, source/deviation ledger and maturity | Repository design-system records | Render and document implemented assets from that revision |
| Component behavior and representative states | Component source, stories and tests in Git | Primary human/agent workshop and check surface |
| Full application flow, persistence and integrations | Running application and integration/E2E tests | At most a mocked composition; never proof of backend behavior |
| Owner artifact acceptance | Portal review bound to exact build/input identity | May supply evidence links; never infer acceptance from a passing story |

## Ecosystem comparison

| Capability | Preferred starting point | Why | Alternative / trigger |
|---|---|---|---|
| Component workshop, docs and state catalog | Storybook | Broad component-driven workflow, portable story format, tests, static builds and direct agent catalog access | [Ladle](https://ladle.dev/docs/) if Storybook setup/startup cost proves disproportionate for the React/Vite stack; it is intentionally React-only and lightweight |
| Minimal React fixture sandbox | Storybook stories | One artifact can serve more of the workflow | [React Cosmos](https://reactcosmos.org/) if fixture ergonomics materially outperform stories and the richer docs/test surface is unnecessary |
| Agent component discovery | Storybook component manifest + MCP trial | The agent queries actual component APIs and usage docs before composition | Repository manifest/search if preview MCP is unstable, incomplete or too costly to maintain |
| Component render/interaction/accessibility checks | Storybook Test/Vitest plus a11y addon | States and checks remain colocated and human-inspectable | Plain Vitest/Testing Library if the Storybook integration duplicates configuration |
| Integrated journey and browser behavior | Playwright against the real app | Keeps persistence, routing and service behavior in the application boundary | Playwright's current component mount can test a project-owned gallery, but would recreate part of a workshop |
| Visual regression | Local deterministic screenshots first; hosted service later | Zero-account baseline and exact artifact capture | [Chromatic](https://www.chromatic.com/pricing) after Git and account authorization; current free plan documents 5,000 billed snapshots, but advanced browser/review entitlements and overage policy must be rechecked |
| Token transform/build | Style Dictionary trial | Cross-platform output and DTCG input support without writing a transformer | A smaller direct CSS build if one web target is the only proven need; current Style Dictionary docs warn that DTCG 2025.10 support is not yet complete |
| Design-to-code mapping | Source/version links by default | No paid dependency for bootstrap | [Figma Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect) when a client already uses qualifying Organization/Enterprise seats; it can map Figma properties to production APIs and improve Figma MCP context |

No alternative was installed. Documentation-backed capability does not prove setup cost, compatibility or review usefulness in this repository.

## Proposed agent → human loop

```text
accepted system/profile revision
  → agent queries component catalog and applicable contracts
  → agent reuses or proposes a catalog change
  → component + named stories + checks change together
  → agent runs render/interaction/a11y checks
  → human inspects the exact story set and composed slice
  → integrated app preview verifies the journey
  → acceptance binds to the exact build and system revision
```

The human surface should show why a story matters, not only controls. Stories need stable IDs, purpose, source-system revision, state meaning, expected behavior, known gaps and links to consumers. The agent surface needs the same contract in machine-readable component metadata or a repository manifest.

## D-01F trial contract

Trial current Storybook on the selected portal stack only after choosing a supported Node runtime; current installation guidance requires Node 20+, while this workspace currently reports Node 18.19.1.

Use one representative slice containing at least a status/exception notice, a review-evidence summary, a response action group and their composed review state. The trial passes when:

1. a fresh agent can find the existing assets and legal variants without inspecting page CSS;
2. default, current, stale, missing, error, disabled and narrow states are inspectable where applicable;
3. render, interaction and automated accessibility checks run locally from documented commands;
4. a static Storybook build is produced without a hosted account;
5. a token or component change identifies the affected stories/consumers without page-by-page search;
6. the owner can review the component states separately from the integrated workflow;
7. setup and duplicate-fixture cost are recorded.

Test the Storybook MCP adapter if the chosen renderer is supported, but do not make packet completion depend on preview MCP behavior. An intentionally invalid component prop or wrong interaction should be caught to demonstrate that the catalog is a guardrail rather than a gallery.

## What not to build

- No custom component explorer, props playground, story format or accessibility-results UI.
- No bespoke design-to-code synchronizer before a real client source requires it.
- No hosted visual-review service before Git identity, account authorization and retention/cost are settled.
- No universal component library shared by unrelated generated products; reuse the process and tools while each product owns its assets.
- No claim that a story proves persistence, external-effect recovery or the complete user journey.

## Retrospective

**Avoidable friction.** R-07B evaluated several specialist products but left the evidence as a one-time benchmark. R-08 defined the system contract but did not say how tools would be discovered, selected, versioned or retired. That made “reuse the ecosystem” dependent on remembering scattered prose.

**Improvement applied.** The new capability registry separates required capability from vendor, authority, cost/auth, agent interface, human surface, adoption status and recheck trigger. D-01F and B-01 now consume the registry rather than selecting tools ad hoc.

**Observed check.** Applying the registry distinguishes three superficially overlapping tools: Storybook is a workshop/catalog, Playwright owns integrated browser checks, and Chromatic is an optional hosted visual-review service. The authority table prevents a passing mocked story from being misreported as application evidence. This verifies the classification on the current candidates, not long-term maintenance quality.

**Downstream effect.** D-01F must include a bounded Storybook/workshop trial in its foundation comparison. B-01 may adopt it only if that trial passes. The latest Storybook runtime requirement makes the frontend runtime/toolchain an explicit D-01F decision rather than an accidental install consequence.

**Reversal criteria.** Choose Ladle or repository-native fixtures if the Storybook trial adds materially more setup/maintenance than state-review value, cannot consume the chosen framework cleanly, or its stable story files do not give agents enough reliable catalog context without preview MCP. Replace Style Dictionary if a representative DTCG token set loses semantics or needs custom glue comparable to a direct build.

**Task outcome.** R-09 is complete as a research and routing decision. Storybook is selected for a bounded D-01F trial, not yet adopted or installed. No external account, dependency, deployment or spend was created.
