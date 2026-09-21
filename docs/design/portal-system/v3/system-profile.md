# Aludel MD3 foundation — executable revision 3

Status: **owner-selected foundation for continued design work (DEC-025); components incubating**. This project-owned profile extends [MP1–MP8](../v1/system-profile.md) and [MP9 and placement contract](../v2/interaction-contract.md). No shared global rule mandates Material or Angular for other products.

## Realization and boundaries

| Responsibility | Trial realization | Limits / output authority |
|---|---|---|
| Experience philosophy | MD3-informed MP1–MP9, view intents and placement reasoning | Aludel owns its decisions; upstream guidance does not know authorization or artifact identity |
| Widget behavior and accessibility primitives | Angular Material/CDK 22.1.7 buttons, icons, radios, text field, dialog; experimental chip | Library behavior is reused; composed flows need separate tests |
| Product patterns | Four named components in [catalog](catalog.json), selected Overview composition | Queue/work/readiness, navigation and draft policy remain product-owned |
| Visual roles | `src/styles.scss`: Material theme + public theme-overrides, local semantic aliases | No overrides into private Material DOM. Page rhythm and status colors are project tokens |
| Isolated workshop | Storybook 10.6 Angular/Vite, 14 explicit source stories | Preview adapter; automatic docgen failed locally; no MCP or automatic API-manifest claim |
| Checks | Playwright connected flow + static story render/interactions; axe-core subset | Not server concurrency, full assistive-technology validation, or owner comprehension evidence |
| Provenance / artifact review | Local source and build hashes | No hosted candidate, production review workflow or release proof |

Exact package versions/licenses: [dependencies](dependencies.json) and prototype lockfile. Angular Material source implementation is distinct from the MD3 specification. `mat.theme` supplies widgets and system roles; `mat.theme-overrides` sets the supported project palette. Angular Material is selected for this design-stage foundation; ADR-003 production framework remains unselected.

## Principle-to-pattern application

- MP1/2: outcome first, then a comparable decision collection with one filled action; request remains secondary.
- MP3: decisions share one related surface; work uses rows; empty preview is plain supporting context. No inherited three-card scaffold.
- MP4: linkable questions, selected navigation, collection filter and scroll return; narrow navigation retains labels and project identity.
- MP5: choose versus save; saved answer stays visible; no answer starts execution. Checks retain their implementation dependency.
- MP6/7: color supplements text; native/library interaction semantics, focus restoration, minimum control sizes, reduced motion and real fonts/icons.
- MP8: zero/one/three/twenty/unknown, save failure/conflict and no candidate have explicit cases.
- MP9: overview directly shows comparison essentials; question details navigate; rationale expands; draft discard alone uses a short dialog.

These are applied design choices. Owner comprehension and efficiency are still hypotheses.

## Semantic token model and replacement seams

| Role | Implementation | Consumers |
|---|---|---|
| action.primary | `--mat-sys-primary` → `--machine-accent` | Material filled button, named question links, navigation icon |
| content.primary / secondary | Material on-surface / on-surface-variant aliases | headings, consequences and helper content |
| surface.canvas / navigation / group | surface alias, machine-rail, machine-panel | shell and related queue surface |
| boundary.subtle | outline-variant alias | rows and section boundaries |
| state.blocked / waiting / ready | named paired background/ink roles | status labels in queue and work |
| shape.group / spacing.page | machine-radius, machine-page-gutter | groups and adaptive composition |

A browser experiment changes one primary role and checks a Material button and product link both change. A separate story substitutes a Material chip behind the status label contract. These demonstrate two bounded seams, **not** effortless replacement of Angular or all Material interaction behavior. A system migration would retain view intents, domain models, state cases and acceptance tests; replace widget/theme implementation and reassess layouts whose philosophy changes. Do not promise a CSS-only switch.

No DTCG export or Style Dictionary transform is needed for this single-web-surface experiment. If another platform consumes tokens, define an authoritative token file and generate CSS instead of maintaining two copies. Current CSS is the explicit token authority; automated cross-platform token exchange remains a gap.

## Deviations, gaps and maintenance

- Generated texture and shaded cube are replaced with flat theme surfaces and a provisional real Material cube icon. Brand design remains open.
- Light theme only; dark mode, full language coverage, virtualized huge collections and production router/persistence are outside the bounded proof.
- Standard Angular/CDK owns widgets; the hand-sized synthetic hash router is disposable. Production route guards, storage errors, server revision checks and concurrent writers still need implementation.
- Storybook automatic API extraction timed out twice after 120 seconds. Explicit stories/index and checked catalog are the trial fallback. Upstream describes flag-off extraction as a temporary migration path; recheck docgen or stable Angular/Webpack before production adoption. Do not make this switch permanent without a new assessment.
- The initial asset import shipped an entire 5.2MB icon font; final bundled subset is about 6KB. Current app bundle still includes Angular compiler and is not a production performance baseline; lazy loading/AOT packaging and budgets belong to implementation readiness.
- Review evidence is represented only by summary states; Q-005 and the full candidate-evaluation pattern remain open. No universal Work/Decisions/Reviews list-detail layout is inferred.

All catalog items are incubating or experimental. Promotion requires owner selection plus affected-consumer evidence. A dependency update must run the stories, connected-flow checks and image comparison before changing the profile's supported revision.
