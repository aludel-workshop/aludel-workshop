---
id: research-tool-ecosystem-001
kind: capability-registry
status: active
updated: 2026-09-19
---

# Product-development tool ecosystem

## Purpose

Track reusable ecosystem capabilities independently of any single vendor. Aludel should integrate or adopt specialist tools when they remove meaningful work while retaining portal authority for intent, authorization and artifact acceptance.

A tool enters a product workflow only through a bounded trial. Documentation establishes a candidate capability; observed local behavior establishes compatibility; owner review establishes usefulness.

## Shared catalog and per-project allocation

The [product-system framework](product-system-framework.md) supplies the vendor-independent coverage vocabulary. [Aludel](system/the-machine.md) and [BorrowBox fixture](system/borrowbox.md) use the same allocation schema. This registry describes candidates; each project chooses its own providers and source revisions. Aludel's selected MD3 direction is not a global product default. Delivery/experience/runtime are secondary usage labels within a project; recursive service provision is explicit.

## Record contract

Each entry carries:

- capability and workflow stage;
- candidate/version/license and primary evidence;
- authoritative inputs and outputs;
- agent interface and human surface;
- account, credential, cost and external-effect requirements;
- supported project types and portability boundary;
- status: `reference`, `candidate`, `trial-selected`, `adopted`, `deferred`, `rejected` or `superseded`;
- passing evidence, owner decision if material, and recheck trigger.

Do not select a tool because its feature list is large. Select the smallest tool whose native artifact can remain useful if the vendor surface changes.

## Current registry

| Capability | Candidate | Agent interface | Human surface | Cost/auth boundary | Status and next evidence |
|---|---|---|---|---|---|
| MD3 component implementation | Angular Material | Source APIs, supported theme/override APIs | Component docs and proposed Storybook proof | MIT/local; Angular 22.1.7 + isolated Node 24.15.0 trial | **Locally trialed, selection pending** — component and flow evidence in D-01F v3; ADR-003 remains proposed |
| React Material implementation | Material UI | Component APIs; optional upstream docs MCP | Component docs and product stories | Core/community versus commercial MUI X must be scoped | **Candidate alternative** — current docs specify MD2; measure MD3 adaptation before adoption |
| MD3 upstream web components | Google Material Web | Web components | Upstream demos/docs | Apache-2.0; maintenance mode | **Reference** — maintenance risk prevents default adoption |
| MD3 palette and icon resources | Material Theme Builder / Color Utilities / Material Symbols | Theme exports, build-time generation, icon assets | Theme exploration and icon catalog | Pin source/license/assets in trial | **Candidate** — use only what the selected implementation needs |
| Component workshop, docs and state catalog | Storybook 10.6.0 (Angular/Vite trial) | Source/CSF stories; optional preview MCP manifest/tools | Local/static Storybook UI | MIT/local free; latest install requires Node 20+ | **Locally trialed** — static build and explicit source stories; automatic docgen timed out, fallback limitation recorded |
| Lightweight React workshop fallback | Ladle | Source stories and generated component index | Local/static Ladle UI | Open-source/local; React only | **Candidate fallback** — trial only if Storybook cost fails |
| React fixture sandbox fallback | React Cosmos | Colocated fixture modules | Local fixture playground | MIT/local; React only | **Reference** — compare only for a concrete fixture ergonomics problem |
| Component render/interaction checks | Storybook Test with Vitest | CLI/test results and optional MCP test tools | Story test/interaction panels | Local/open tooling | **Not yet integrated** — this Angular trial uses Playwright against built stories; deliberately false recovery expectation must be caught |
| Automated component accessibility | Storybook a11y addon / axe-core | CLI/CI status and optional MCP test tools | Accessibility panel with incomplete/manual results | Local/open tooling | **Locally trialed** — built-story axe checks; supplement, never complete accessibility evidence |
| Integrated application journeys | Playwright | CLI/browser checks | Reports, screenshots and running app | Local/open tooling | **Previously used in prototypes; proposed for B-01** — bind to real app, not mock stories |
| Local visual baselines | Playwright screenshots or equivalent project-owned capture | CLI diffs/artifacts | Reviewed before/after images | Local/open tooling | **Candidate** — define after Git/source identity exists |
| Hosted visual regression/review | Chromatic | CI/API integrations | Hosted snapshots and review | Account/external upload; free tier documented, paid expansion possible | **Deferred** — needs Git, account authorization, retention/cost trial |
| Token transformation | Style Dictionary | CLI/build configuration | Generated platform artifacts/docs | Local/open tooling | **Candidate** — D-01F token round-trip; latest DTCG 2025.10 support gap must be measured |
| Design canvas and prototypes | Figma | File/version links; MCP where entitled | Canvas, prototype and comments | Starter limited; advanced Dev Mode/MCP paid | **Optional integration** — use when project/client supplies it |
| Design component ↔ code mapping | Figma Code Connect | CLI mappings and Figma MCP context | Dev Mode production snippets | Organization/Enterprise plus Full/Dev seat | **Deferred/conditional** — client-owned paid workflow only |
| Execution tracker | Linear | SDK/API/connector | Issues/projects/reviews | Account and plan limits | **Selected elsewhere** — see ADR-008; not design-system authority |

## Adoption rules

1. Start from a workflow capability and authority gap, not a vendor.
2. Prefer portable source artifacts and open formats over data trapped in a service.
3. Keep credentials and external writes outside agent workspaces.
4. Record exact versions, licenses, quotas and account requirements at trial time.
5. Prove one representative task, one failure and one recovery/removal path.
6. Link the tool output to exact product/design/task revisions; a current URL is not identity.
7. Measure work removed, maintenance added, review comprehension and portability.
8. Adopt, defer or reject explicitly; recheck only on a named trigger.

## Current local baseline — 2026-09-20

ADR-012 and B-01 adopted Angular/Material and explicit-source Storybook for the local portal. Earlier trial/pending-production statements below and in the original comparison table are historical evaluation notes, superseded within that local scope by [B-01 evidence](evidence/b-01-local-foundation.md). Automatic docgen and optional MCP remain unproven; no fresh vendor, pricing or entitlement verification is claimed here. D-02 proposes surfacing project tool/capability bindings under Settings and design artifacts under Design; it does not activate a new integration. See the [audit](design/project-workspace/v1/audit.md).

## Current composition

The original trial target was layered as follows; ADR-012 now selects Angular/Material locally:

```text
DTCG product tokens
  → evaluated token transformer
  → accessible component implementation
  → Storybook stories/docs/component checks
  → real portal composition
  → Playwright integrated journey checks
  → portal artifact review
```

Figma and hosted visual review remain optional integrations. Storybook is not a new portal module; it is a development/review artifact that the portal can link by exact build identity.

## MD3 intake update — 2026-09-19

[Current primary-source evidence](evidence/d-01f-md3-landscape.md) distinguishes design-language choice from package support. Angular Material is the first trial recommendation; no framework or library is adopted. Storybook renderer, testing and optional manifest/MCP support must be checked together. Current Storybook documentation describes Angular/Vite support as well as React; do not assume the earlier React trial configuration transfers unchanged. Beer CSS and partial React MD3 libraries remain references; Base UI implies owning the MD3 visual layer.

## Maintenance

Update an entry when a trial runs, a selected stack changes, pricing/auth changes, a tool drops needed support, or another product exposes a missing capability. Preserve rejected and superseded entries with reasons so future agents do not repeat the comparison.

## D-01F local application — 2026-09-19

[Revision 3](design/portal-system/v3/system-profile.md) pins Angular Material 22.1.7, Storybook 10.6.0 and Node 24.15.0. Storybook's Angular/Vite adapter is documented as preview; automatic source docgen timed out twice in this environment. Explicit CSF stories and index discovery are the bounded fallback, with Playwright checking built stories and whole flows; Vitest and preview MCP were not integrated. The fallback's disabled-docgen path is temporary upstream, so recheck docgen or the stable Angular/Webpack adapter before production workshop adoption. Local compatibility does not settle the production framework or full review-evidence UX.

Primary sources checked: [Angular compatibility](https://angular.dev/reference/versions), [Storybook Angular/Vite requirements and limitations](https://storybook.js.org/docs/get-started/frameworks/angular-vite). Exact observed versions/licenses and package integrity live in the v3 dependency record and prototype lockfile.


D-01F closeout (2026-09-19, DEC-025): the owner selected the [v3 foundation](design/portal-system/v3/review-record.md) for continued design work. D-01E now consumes its [accepted inputs](design/portal-system/v3/d-01e-handoff.md). Overview is the accepted reference; other view compositions remain open. Angular Material and explicit Storybook stories are the design-stage realization; production architecture and docgen support remain B-01 readiness work. This supersedes earlier pending-foundation-selection wording, without advancing M0.
