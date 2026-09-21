# the-machine: capability coverage

Generated from `the-machine.json`; catalog revision 1, project revision 6.

Status: **bootstrap-project-map**. Structural consistency is not operational readiness.

Both projects use the same schema. Providers below are explicit project choices, not global defaults.

| Capability / usage | Current evidence | Target provider(s) / adoption | Gap and next evidence |
|---|---|---|---|
| C01 Frame outcomes / experience | manual — [source 1](../../docs/product.md), [source 2](../../docs/design/project-workspace/v1/audit.md) | Repository product brief / adopted | No native direction/outcome editor; source text is not a structured product record → **D-02R → PW-02** (horizon: M1) |
| C02 Research and source evidence / delivery | manual — [source 1](../../docs/research.md), [source 2](../../docs/design/project-workspace/v1/audit.md) | Primary sources; Repository evidence / adopted | Sources available as imported documents; research authoring/expiry and typed evidence relations remain incomplete → **D-02R → PW-03** (horizon: M1) |
| C03 Product knowledge and decisions / delivery | verified — [source 1](../../docs/evidence/b-02-product-records.md), [source 2](../../docs/design/project-workspace/v1/audit.md) | SQLite local adapter; PostgreSQL hosted candidate / adopted | Supervised work exists; native product/plan/design records, reviewed reconciliation and immutable artifact/review schemas remain → **D-02R → PW-01; B-03** (horizon: M1) |
| C04 Experience architecture / experience | experiment — [source 1](../../docs/design/portal-system/v1/view-intents.md), [source 2](../../docs/design/portal-system/v3/work-record.md), [source 3](../../docs/design/portal-system/v3/review-record.md), [source 4](../../docs/design/project-workspace/v1/audit.md) | View-intent map; Concept review / trial-selected | Current foundation accepted within historical scope; new Product/Design/Work structure requires scoped selection → **D-02R → D-03** (horizon: M1) |
| C05 Design-system philosophy and patterns / experience | experiment — [source 1](../../docs/design/portal-system/v1/system-profile.md), [source 2](../../docs/design/portal-system/v3/system-profile.md), [source 3](../../docs/design/portal-system/v3/review-record.md), [source 4](../../docs/design/project-workspace/v1/audit.md) | MD3 guidance / selected-direction | MD3 foundation selected; live design registry and source/current-catalog reconciliation remain → **PW-03** (horizon: M1) |
| C06 UI components and theme / runtime | partial — [source 1](../../docs/design/portal-system/v3/catalog.json), [source 2](../../docs/design/portal-system/v3/system-profile.md), [source 3](../../docs/design/portal-system/v3/review-record.md), [source 4](../../docs/design/project-workspace/v1/audit.md), [source 5](../../docs/evidence/b-01-local-foundation.md) | Angular Material 22.1.7; Product-owned patterns / adopted | Angular/Material adopted locally; incubating source patterns need current catalog reconciliation and new-view readiness → **D-03; PW-03** (horizon: M1) |
| C07 Component workshop and discovery / delivery | verified — [source 1](../../docs/evidence/b-01-local-foundation.md), [source 2](../../docs/design/project-workspace/v1/audit.md) | Storybook; Optional Storybook MCP / adopted | Explicit stories adopted; automatic docgen fallback and project asset discovery remain gaps → **PW-03** (horizon: M1) |
| C08 Source identity and change review / delivery | partial — [source 1](../../docs/design/process/enterprise-github-app-work-record.md) | Portal Git profile; Vendor GitHub App / adopted | Installation-token flow is locally/mocked verified; owner must complete the first live install/create/push, and reviewed diff/PR behavior remains pending → **B-03** (horizon: M1) |
| C09 Work readiness and authorization / delivery | verified — [source 1](../../docs/evidence/b-03a-supervised-cycle.md), [source 2](../../docs/evidence/b-03a-work-navigation.md) | Owner review; Portal domain API target / selected-direction | Supervised authorization checked; plan/history readiness and automated immutable input/lease protocol remain → **PW-01; B-03** (horizon: M1) |
| C10 Execution queue and tracking / delivery | none — [source 1](../../docs/decisions.md) | Linear; Portal connector target / selected-direction | No account integration; portal intent is not tracker-owned → **B-03** (horizon: M1) |
| C11 Execution coordination and recovery / delivery | experiment — [source 1](../../docs/evidence/r-05-recovery.md) | Local gateway target; Symphony; Fake-provider harness / selected-direction | Fake-provider recovery is not real connector/concurrency proof → **B-03** (horizon: M1) |
| C12 Agent execution and workspaces / delivery | experiment — [source 1](../../docs/evidence/r-03-local-codex.md) | Codex local execution; Symphony integration target / selected-direction | Local execution observed; dispatched portal run/isolation integration pending → **B-03** (horizon: M1) |
| C13 Quality verification / delivery | partial — [source 1](../../docs/evidence/b-02-product-records.md), [source 2](../../docs/evidence/b-03a-work-navigation.md) | Playwright; Storybook checks proposed; Domain tests proposed / trial-selected | Domain and browser checks exist; multi-record route regression now applied; new workspace flows need scoped tests → **D-03; B-03** (horizon: M1) |
| C14 Artifact identity and retention / delivery | partial — [source 1](../../docs/knowledge-strategy.md) | Local evidence files; Object storage target / candidate | Retention/access/digest binding across runtime unimplemented → **B-03** (horizon: M1) |
| C15 Preview delivery / delivery | experiment — [source 1](../../docs/evidence/r-04a-preview-options.md) | Local static preview; Cloudflare Pages trial / trial-selected | External hosted trial requires authorization; immutable hosting unproven → **R-04B** (horizon: M1) |
| C16 Product acceptance / delivery | manual — [source 1](../../docs/evidence/d-01b-prototype-review.md) | Repository review ledger; Portal review target / adopted | Runtime review binding and required evidence threshold Q-005 pending → **B-03** (horizon: M1) |
| C17 Application shell and navigation / runtime | verified — [source 1](../../docs/design/portal-foundation/v1/structure.md), [source 2](../../docs/design/project-workspace/v1/audit.md), [source 3](../../docs/evidence/b-01-local-foundation.md), [source 4](../../docs/evidence/b-03a-work-navigation.md) | Angular/Material local portal / adopted | Local routes implemented; two-item Work navigation corrected; broader structure and multiple-project navigation pending → **D-02R → D-03; PW-01** (horizon: M1) |
| C18 Domain behavior and APIs / runtime | verified — [source 1](../../docs/evidence/b-02-product-records.md), [source 2](../../docs/design/project-workspace/v1/audit.md), [source 3](../../docs/evidence/b-03a-supervised-cycle.md) | Local domain API / adopted | Supervised work operations implemented; project-scoped APIs, product object authoring and immutable artifact acceptance remain → **PW-01; B-03** (horizon: M1) |
| C19 Data and retrieval / runtime | verified — [source 1](../../docs/evidence/b-01-local-foundation.md), [source 2](../../docs/design/project-workspace/v1/audit.md) | SQLite local adapter; PostgreSQL hosted candidate / adopted | Single-project local persistence verified; multi-project scope, reviewed domain migration, backups and hosted equivalence unproven → **D-03 → PW-01** (horizon: M1) |
| C20 Identity, permissions and connections / runtime | verified — [source 1](../../docs/evidence/b-01-local-foundation.md), [source 2](../../docs/design/process/enterprise-github-app-work-record.md) | Local owner key/session; Encrypted user-token vault; Deployment-managed vendor GitHub App; Per-operation installation tokens / adopted | Live GitHub authorization/refresh/revocation, platform-native secret storage, internet-facing identity and multi-user policy remain unproven → **B-03** (horizon: M1) |
| C21 Release and recovery / delivery | deferred — [source 1](../../docs/architecture.md) | Provider adapter undecided; Independent recovery path / deferred | M2: prove accepted artifact promotion and data-aware rollback → **M2 gate** (horizon: M2) |
| C22 Runtime hosting and operations / runtime | verified — [source 1](../../docs/evidence/b-01-local-foundation.md) | Node loopback local environment; Cloudflare/Supabase proposals / adopted | Hosted portal/API/database operations and external preview path remain unproven and unauthorized → **B-03** (horizon: M1) |
| C23 Product observation and learning / experience | manual — [source 1](../../docs/evidence/d-01-design-retrospective.md) | Owner feedback; Retrospectives / candidate | Runtime telemetry/outcome link not implemented; later measured loop → **M3 gate** (horizon: M3) |
| C24 Go-to-market and communication / delivery | deferred — [source 1](../../docs/product.md) | No provider selected / deferred | M4: actual audience/distribution need and explicit message authority → **M4 gate** (horizon: M4) |

## Authority by output

| Capability | Authoritative output | Target authority |
|---|---|---|
| C01 | Intent, constraints and measurable success | owner-approved product record |
| C02 | Findings with provenance and uncertainty | versioned research record |
| C03 | Versioned product records and relations | project domain API and database (target) |
| C04 | Stories, view intents and transitions | owner-reviewed experience contracts |
| C05 | Principles, patterns and deviation profile | product-owned system profile |
| C06 | Implemented reusable UI assets | product repository component source |
| C07 | Inspectable component states and usage contracts | component source, stories and contracts |
| C08 | Identified source revision and reviewed diff | source repository revision |
| C09 | Authorized task revision and permitted effects | project authorization operation |
| C10 | Execution queue state and optional external mappings | tracker native issue fields and connector mapping |
| C11 | Durable attempts, leases and reconciled effects | project coordination records |
| C12 | Bounded run, isolated workspace and result | run result in bounded workspace |
| C13 | Component, domain and integrated acceptance evidence | versioned check result for exact inputs |
| C14 | Immutable artifact manifest and retrievable bytes | artifact manifest and immutable bytes |
| C15 | Identified accessible candidate with lifecycle | preview operation and provider deployment identity |
| C16 | Owner judgment tied to artifact and input revisions | owner acceptance record |
| C17 | Working accessible routes and stateful navigation | project application source |
| C18 | Validated product operations and invariants | project domain operations |
| C19 | Durable scoped data and migration contracts | project database operations |
| C20 | Authenticated operations and scoped credentials references | project access policy and connection operations |
| C21 | Promoted artifact, health and independent recovery | separate owner release operation |
| C22 | Available environments and correlated operational evidence | project environment configuration and runtime health |
| C23 | Feedback linked to outcomes and follow-up decisions | project observation and outcome records |
| C24 | Audience, distribution experiments and authorized communication | project communication policy |

## Service provision between projects

- **machine-develops-machine** (planned): `the-machine` consumes `the-machine` through Versioned task/attempt/artifact protocol in docs/architecture.md. Provider: accepted-deployed-revision-required; none deployed yet. Candidate: separate-candidate-required. Recovery: Independent local/provider recovery path; candidate is never sole evaluator or recovery authority.

## Handoffs

| ID / producer → consumer | Payload | Boundary / failure rule | Next evidence |
|---|---|---|---|
| H01 / C01 → C04 | Outcome + story revision | View design must identify the user job; reject layout-first work | D-01F |
| H02 / C04 → C05 | View intent + pattern rationale | Check design philosophy before selecting widgets | D-01F |
| H03 / C05 → C06 | Accepted profile + deviations + token roles | Unsupported library feature becomes explicit gap, not silent CSS patch | D-01F |
| H04 / C06 → C07 | Component source + named state fixtures | Workshop renders real component; do not fork demo implementation | D-01F |
| H05 / C07 → C13 | Stories + input/build identity | Story checks cover components only; full flow needs app checks | D-01F |
| H06 / C09 → C10 | Authorized task revision + effect scope | Connector never infers permission from issue status alone | B-03 / Q-002 |
| H07 / C10 → C11 | External ID + version + named transition | Conflict/unknown state reconciles; no last-write-wins | B-03 / Q-008 |
| H08 / C11 → C12 | Attempt + frozen context + lease | Run starts only with valid authorization and isolation | B-03 |
| H09 / C12 → C14 | Source identity + build + checks | Reject missing identity or secrets; retain partial failure evidence | B-03 |
| H10 / C14 → C15 | Artifact digest + preview operation key | Lookup before replay; ambiguous external effect stays blocked | R-04B |
| H11 / C15 → C16 | Exact candidate URL + currency + evidence | Unavailable candidate is not replaced with latest; check stale inputs | B-03 / Q-005 |
| H12 / C16 → C21 | Accepted artifact + separate release authority | Acceptance never implicitly promotes; recovery independent | M2 gate |
| H13 / C22 → C23 | Release identity + scoped observation | Operational logs do not alone establish user outcome | M3 gate |
| H14 / C23 → C01 | Observed problem + outcome hypothesis | New work returns to prioritization and authorization | M3 gate |
