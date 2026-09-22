---
id: decisions-001
kind: decision-register
status: active
updated: 2026-09-22
---

# Decision inbox

This is the seed of the portal's decision workflow. Confirmed owner answers and proposed defaults are distinct. No unanswered question silently becomes an owner decision.

## Confirmed

2026-09-22 — **DEC-035: the first stack preset is the portal's own stack.** Owner: "first stack preset, go with what we've already got running." `aludel-web-v1` = Angular 22 / Angular Material 22 (MD3) / Vite / Node 24 `node:http` / SQLite. Other stacks (e.g. Django) are listed as unavailable until a preset is checked to work. Skeletons are generated deterministically from the preset, not by an agent. [Onboarding record](design/onboarding/work-record.md#stack-presets-and-skeleton).

2026-09-22 — **DEC-034: agent connections are project-level and identical for Aludel and every other project.** Owner: "aludel is being built inside itself, the same way that another app would be built inside it. so connecting an agent would be done the same for this project as for other projects." One connection record, component and API serve every project, including `the-machine`. Storing a key does not authorize calling the provider; provider calls remain gated by execution authorization.

2026-09-22 — **DEC-033: projects are served as subdomains of the Aludel domain.** Owner: "all project apps can start as a subdomain from the main aludel domain, kind of railway style ... since we're just localhost for now, can we subdomain that? and might need to move aludel to have its own subdomain." Portal at `aludel.<base>`, project previews at `<slug>.<base>`, `MACHINE_BASE_DOMAIN` defaulting to `localhost` (browsers resolve `*.localhost` to loopback). `127.0.0.1` keeps serving the portal for the registered GitHub callback. Hosted operation later needs wildcard DNS/TLS; not authorized now.

2026-09-22 — **DEC-032: build the public-shaped new-project onboarding, local-only but portable to hosted.** Owner supplied the [new project flow](design/onboarding/work-record.md#owner-intent-source-2026-09-22) and: "we'll keep this local for now, but build it to port easily to hosted ... go ahead, document plan, and start building." Supersedes DEC-002's single-owner account model: accounts are per user and projects have members, while the deployment stays local and owner-operated. Replaces proposed PW-05 with ONB-00–ONB-07. Authorizes local implementation and checks for ONB-01–ONB-05 only: no public deployment, spending, GitHub App reconfiguration, agent-created live repositories, provider API calls or email.

2026-09-21 — **DEC-031: name the self-hosting product Aludel and make branding project-owned.** The owner selected “Aludel” for its alchemical image of staged condensation of ideas and supplied workshop concept art. Human-facing product language uses Aludel. Project name, description, tagline, accent and hero artwork are mutable project data consumed by the shared shell; future projects use the same contract. Stable compatibility identifiers (`the-machine`, `machine-*`, `MACHINE_*`, and `launch-machine`) remain until a separately justified migration. This authorizes local brand implementation and checks only. [Implementation evidence](design/process/aludel-brand-work-record.md).

2026-09-21 — **DEC-030: use one vendor-owned GitHub App with per-operation installation tokens.** Owner: “lets set this up right for enterprise from the start: vendor github app, short lived install tokens.” The deployment owns one GitHub App configuration; customers authorize their identity and install that app rather than create or paste app credentials. Require Administration and Contents write plus all-repository installation access for repository provisioning. Mint a repository-scoped installation token for every Git operation and never persist it. GitHub's personal-repository endpoint is the documented exception: use the encrypted, expiring GitHub App user token to create a personal repository, then use the installation identity for Git. This decision authorizes local implementation and mocked/local verification only—not registering the app, connecting an account, or creating/pushing a live repository. [Implementation evidence](design/process/enterprise-github-app-work-record.md).

2026-09-20 — **DEC-029: suspend portal-only dispatch and restore durable chat authorization for local work.** Owner reported that ready work could not be authorized because the portal returned “Decision inputs changed or remain open. Prepare a new work item after resolving them,” and explicitly requested removal of the requirement to go through the app until the new setup is running. Explicit owner chat instructions may authorize bounded local research, design, repository edits, checks, and local previews when recorded in the relevant repository work record. The portal remains optional for requests/history/evidence and is not authoritative for interim dispatch. This supersedes DEC-028's portal-only requirement without authorizing spending, external accounts/writes, public deployment, release, acceptance, or unattended execution. Re-enable portal-first dispatch only after the replacement flow is owner-validated against stale-input recovery and an authorized real work item.

2026-09-20 — **DEC-028: portal-first supervised operation replaces conversational Go dispatch.** Owner explicitly requests that the next idea, authorization or answer happen inside the app; Codex temporarily performs worker duties when notified. Authorizes the local B-03A bridge and process migration. Each future task requires its own recorded authorization. Adopt explicit local scope/build/check/preview boundary, consequential-question stops, and separate release/acceptance. Q-002 is resolved for this supervised local boundary only. Symphony/runner automation follows interface validation; no external connector, account, spend or unattended execution is authorized. See [operator procedure](design/process/portal-operator.md).

DEC-028 is superseded for interim dispatch by DEC-029. Its bridge evidence and product requirement for durable authorization remain historical inputs to the replacement design.


2026-09-20 — **DEC-026: D-01E accepted; begin app-building transition.** Owner: “overall, this is looking great. think we can start building the app.” Accepts the operable task/review baseline, with an explicit requirement that useful bootstrap-host functionality (especially the checklist) move into the real review bar. The standalone host is disposable, not a second maintained product. This authorizes beginning implementation once outstanding M0 gates are passed or explicitly waived; it does not authorize external deployment, spending, or silently waive hosted-preview/cost evidence. See [closeout](design/portal-visual/v1/review-harness-retrospective.md#owner-review-and-closeout--2026-09-20).

2026-09-20 — **DEC-027: waive hosted-preview and measured provider-cost gates for the local B-01 slice and begin M1.** Owner: “let's get this app up and running locally” and begin transitioning from Markdown to a proper information system. This is the explicit local-only waiver required by G-00 and confirms the M1 implementation transition. It authorizes local application/data/access work, not an external account, deployment, provider effect, or spend. Hosted-preview, provider-cost, Q-002, Q-005, and Q-008 gates remain before their B-03 effects. [B-01 evidence](evidence/b-01-local-foundation.md) records the applied boundary.

| ID | Decision | Source / effect |
|---|---|---|
| DEC-001 | Begin with research and definition | Original brief; no implementation or deployment in this session |
| DEC-002 | Serve the owner managing several projects | Owner reply, 2026-09-18; defer collaborative account model. **Account model superseded by DEC-032** (per-user accounts, local deployment) |
| DEC-003 | First valuable milestone: request a change and review an agent-built preview | Owner reply, 2026-09-18; M1 requires an actual agent-built preview; execution location is a proposed implementation choice |
| DEC-004 | Low/no incremental budget; prefer free tiers and use existing ChatGPT Plus coding access | Owner reply, 2026-09-18; no assumed API budget or dedicated paid compute |
| DEC-005 | Owner can prioritize and click Go; heavy automation is unnecessary initially | Owner reply, 2026-09-18; defer scheduled autonomous work |
| DEC-006 | Local execution is acceptable; choose hosting based on research | Owner reply, 2026-09-18; Railway and Vercel suggested as candidates, not requirements |
| DEC-007 | A plain “go” should be sufficient for an agent to identify and complete the next bounded step | Owner request, 2026-09-18; `AGENTS.md`, current status, work packets, and phase gates form the handoff protocol |
| DEC-008 | Use `launch-lms` and `launch-lms-infra` as working references, not role-model architectures | Owner direction, 2026-09-18; inspect their pipelines, Symphony execution, and lessons while avoiding inherited bloat and legacy coupling |
| DEC-009 | Structure the MVP around durable tasks and tracker-style execution, rather than a local Codex session or a single UI button | Owner direction, 2026-09-18; move quickly without constraining the product to one machine or manual-only orchestration |
| DEC-010 | The growing Markdown corpus is insufficient for product work; introduce a database for structured mutable records while retaining the most useful repository-native knowledge | Owner direction, 2026-09-18; refine the boundary and retrieval behavior before schema implementation |
| DEC-027 | Begin M1 with a local-only portal and information-system slice; waive hosted-preview/provider-cost proof only for B-01 | Owner direction, 2026-09-20; no external provider, deployment, spending, or later B-03 waiver implied |

| DEC-011 | Use an invented independent demo app across mockups, with a path to an eventual app-creation test | Owner direction, 2026-09-18; BorrowBox is the fictional fixture, distinct from Aludel portal; this does not authorize its implementation or deployment |

| DEC-012 | Select D-01C v2 B (Decision queue) for the BorrowBox project Overview | Owner: “I prefer B,” 2026-09-18; D-01B resumes with B; supporting flow and final interaction acceptance remain subject to prototype review |
| DEC-013 | Retain direction B's opening hierarchy, pause D-01B, and design the portal's navigation, page types, layouts, and transitions before more prototype functionality | Owner feedback, 2026-09-19; D-01D becomes the next packet; current post-decision and task-detail structures are rejected |

| DEC-014 | Prioritize a reusable product-development process over improving D-01B or completing portal-specific groundwork | Owner clarification, 2026-09-19: use the flawed prototype to understand what must happen before prototyping, for this project and new products. R-07C precedes D-01D; process effectiveness is the outcome, not prototype polish. |

| DEC-015 | Approach every task by considering how to improve the process first, and how to complete the task second | Standing owner instruction, 2026-09-19; applies across task types and future work. Recorded in AGENTS.md; improvements should be reusable, proportional, and tested through application. |
| DEC-016 | Select D-01D direction A, the project-first workspace, as the structural basis for the next interaction prototype | Owner: “A looks great, continue,” 2026-09-19. Accepts the reviewed Overview / Work / Decisions / Reviews structure and decision → affected Work → task → candidate-review wireflow for D-01B. Visual styling, interaction usability, Q-002, Q-004/Q-005, full Plan/Releases, implementation and release remain outside this acceptance. |

| DEC-017 | D-01B v4 is usable and fairly clear; visual quality remains unacceptable | Owner feedback, 2026-09-19: “finally useable. still hideous, but at least fairly clear.” Qualified overall interaction acceptance; no per-scenario, visual, Q-002/Q-005 or implementation approval. See [retrospective](evidence/d-01-design-retrospective.md). |
| DEC-018 | Every task must close with a post-hoc that improves the process first: identify avoidable friction, make equivalent work easier, propagate learning into the overall plan, and surface better questions | Owner direction, 2026-09-19. Evidence alone is not packet completion; AGENTS.md and the execution plan now require retrospective evidence and applied downstream updates. R-05 received a corrective retrospective. |
| DEC-019 | Shelve the page-level D-01E concepts and establish a research-driven, open-ended design-system strategy before choosing Aludel's visual baseline | Owner direction, 2026-09-19. The process must absorb client systems such as Material plus explicit changes, preserve philosophy as well as tokens/components, assemble pages from governed assets, and evolve through measured gaps. Dark option 3 is preferred mood evidence only, not an accepted implementation direction. R-08 precedes D-01F and D-01E. |

| DEC-020 | Focus the next foundation evaluation on Material Design 3 | Owner, 2026-09-19: “I am actually interested in using material design 3.” MD3 is the current direction; library, framework, adaptations and rendered system acceptance remain open. [Landscape evidence](evidence/d-01f-md3-landscape.md) narrows D-01F to implementation fit and proof. |

| DEC-021 | Re-evaluate view composition and interaction grouping from intent, stories and the full MD3 philosophy | Owner, 2026-09-19: existing pages are closer to wireframes; the three-card Overview is not a layout to canonize. Reopens page compositions and presentation boundaries. Retain enduring product semantics and historical evidence, not inherited card/page structure. D-01F groundwork: [view intents](design/portal-system/v1/view-intents.md), [system profile](design/portal-system/v1/system-profile.md). |
| DEC-022 | Aludel is an ordinary product project within itself; distinguish shared global structure from project-specific realization | Owner clarification, 2026-09-19. One capability/record/evidence contract applies to all projects; MD3, tool assignments and implementation belong to a named project. Delivery/experience/runtime are secondary usage labels. [Framework](product-system-framework.md) and [two-project application](design/portal-system/v1/work-record.md) make self-development an explicit service relationship. |

| DEC-023 | Prefer v1 option 2's outcome-led Overview, refine for multiple decisions, and use left navigation | Owner, 2026-09-19: concepts are easier on the eyes and make more sense; option 2 reads as Overview, option 3 feels odd. Left nav is a personal preference. Option 1's list-detail is not approved for Work/Decisions/Reviews. Require intentional inline/expanded/modal/navigation choices in the design philosophy. [Applied contract and retrospective](design/portal-system/v2/interaction-contract.md). Revised composition and runtime behavior remain unaccepted. |

## Accepted architecture decisions

### ADR-008 — Task-driven M1 with a Symphony worker and Linear connector

**Status:** accepted on 2026-09-18 by project direction and R-03/R-06 evidence.

**Decision:** The portal owns projects, task intent, acceptance criteria, decisions, execution authorization, attempts, artifacts, and review history. M1 uses Linear as the first execution-tracker connector and runs the pinned upstream Symphony reference implementation behind a small local runner gateway. Symphony owns scheduling within the connected execution queue and manages Codex App Server sessions and workspaces. The gateway claims authorized portal tasks, performs idempotent tracker mapping, supervises Symphony, translates its current state and Codex updates into the portal event contract, and reports artifacts. Go is a durable task authorization transition; it is not an instruction to open or control an interactive local Codex session.

The first deployment may set concurrency to one while recovery is proven, but task, lease, attempt, event, and connector records support multiple projects and workers from the start. Increasing concurrency is configuration plus capacity, rather than a schema rewrite.

**Why this option:** The owner expects a robust task-driven workflow. Symphony already supplies tested tracker polling, concurrency, persistent workspaces, App Server integration, blocked-input detection, retry/backoff, and reconciliation. [Linear's current free plan](https://linear.app/pricing) includes API and webhook access with 250 issues, enough for the bootstrap, and its [typed TypeScript SDK](https://linear.app/developers/sdk) fits the proposed portal stack. This gets a capable scheduler running sooner while the gateway preserves a replaceable portal protocol.

**Field ownership:**

- The portal is authoritative for task purpose, requirements, dependencies, authorization, attempts, evidence, and review.
- Linear is authoritative for its native issue fields and acts as the initial execution queue viewed by Symphony.
- A connector mapping stores portal task ID, provider, external issue ID, synchronized revision, and idempotency key.
- Only named transitions are synchronized. Conflicting or ambiguous external changes block dispatch for reconciliation; there is no generic last-write-wins sync.
- Secrets stay in the connection/worker boundary and never enter task prompts or repository records.

**Options considered:**

| Option | Decision | Reason |
|---|---|---|
| Upstream Symphony unchanged with Linear as the whole product record | Rejected | Fast runner setup, but it would place product decisions, review, and future provider portability behind tracker semantics. |
| Wrap Symphony behind portal task and event contracts | Selected | Reuses the strongest proven scheduling behavior while keeping product records, authorization, and artifacts under portal control. |
| Extract Symphony components into the portal runtime | Deferred | Its Elixir modules are cohesive but extraction would create an immediate fork and mixed-runtime maintenance without proving a need. |
| Build a small Codex SDK/CLI scheduler | Rejected for M1 | R-03 proves feasibility, but rebuilding workspaces, blocked input, reconciliation, and retries would spend early implementation time on capabilities Symphony already has. Keep it as a fallback adapter. |
| Adopt the Launch LMS orchestration stack | Rejected | Its Jira policy, container operations, uploader, CI, deployment, and funded API setup encode useful contracts but carry legacy and production scope M1 does not need. |

**Consequences:** M1 includes a task board/inbox and tracker connection instead of treating task execution as a transient request. It adds a local gateway and Linear account/configuration to the bootstrap. The portal must persist its own events because Symphony's scheduler state and status API are not durable. Preview publishing and exact-build review remain portal responsibilities. Jira follows through the same connector boundary after the Linear path works; it is not a schema fork.

**Recheck triggers:** Reconsider the upstream wrapper if subscription authentication fails through Symphony, the gateway must patch several Symphony coordination internals, or maintaining tracker/portal mappings costs more than the scheduler saves. Reconsider a portal-native scheduler after R-05 and two real projects reveal the required durable state. Reconsider server execution when affordable compute and credential isolation are proven. Recheck Linear as the first provider if its free limits, API access, or account availability block the bootstrap.

**R-07B recheck (2026-09-18):** Current [Linear coding-session documentation](https://linear.app/docs/coding-sessions) now describes managed implementation and verification artifacts; [Reviews](https://linear.app/docs/diffs) covers native PR review. This is broader overlap than execution tracking alone. Coding sessions require a paid plan and AI credits, so the zero-incremental-cost bootstrap remains on ADR-008. Reopen the replacement comparison if budget or included access changes and a bounded trial demonstrates the required provenance and recovery. See the [benchmark](evidence/r-07b-workflow-benchmark.md); no account trial or new spending approval occurred.

**Evidence:** [Local Codex feasibility](evidence/r-03-local-codex.md), [pinned Symphony inspection](evidence/r-06a-symphony-inspection.md), and [Launch LMS case study](references/launch-lms-case-study.md).

### ADR-012 — Angular/Material local portal with a SQLite bootstrap adapter

**Status:** accepted for the local B-01 foundation on 2026-09-20.

**Decision:** Realize the accepted portal design in Angular 22 / Angular Material 22 with explicit Storybook source stories. Run one loopback-only Node 24 service and store initial relational records in SQLite behind repository-owned storage/domain modules. Use first-run owner-chosen access with a scrypt digest and HttpOnly local session. Keep record identities and relational operations portable to PostgreSQL for a later hosted topology.

**Why and evidence:** D-01F/D-01E already proved and received owner acceptance for the Angular/Material system, so switching to the older React proposal would discard evidence. SQLite supplies transactional persistence and restart proof without a service account, cost, or network dependency. [B-01 evidence](evidence/b-01-local-foundation.md) covers import idempotency, changed-source revisioning, access rejection, owner setup/login, restart persistence, stories, build, browser flow, responsiveness, and scoped accessibility.

**Boundary:** This accepts the local implementation adapter, not public hosting, multi-user identity, PostgreSQL equivalence, backup/restore, external secrets, or concurrent production load. Recheck the storage adapter during hosted-topology work and before concurrency exceeds the local owner bootstrap.

## Questions that shape the next stage

| ID | Question | Proposed starting point | What depends on it |
|---|---|---|---|
| Q-001 | Budget answered: free tiers first. Any additional hosting/data constraints? | Propose zero incremental service spend for bootstrap | Validate free-tier fit; do not infer permission to purchase |
| Q-002 | Interim resolution by DEC-029: explicit owner chat instructions authorize bounded local work when recorded durably; portal-only dispatch is suspended. | Restore portal-first authorization only after stale-input recovery and a real owner cycle are validated. | Replacement workflow remains B-03B/M2; external effects retain separate gates |
| Q-003 | What kinds of client products come first, and what real rough brief can anchor the second project? | Small data-backed web app | Scope, design examples, portability trial |
| Q-004 | What should working in the portal feel like? | Project overview with decision/review inbox; chat and inspectable artifacts side by side | Interaction prototype |
| Q-005 | What makes a preview ready for your review? | Working core flow, concise explanation, visible gaps, relevant checks | Agent task completion and review criteria |
| Q-006 | How often should it interrupt you for product choices? | Batch optional choices; surface consequential blockers promptly | Question urgency and defaulting policy |
| Q-007 | How much design evidence should the portal require before implementation at each change size? | Use the proportional artifact policy in the product-development workflow; allow recorded additions and waivers | D-01C and future feature readiness policy |
| Q-008 | When an external effect is conflicting or its outcome cannot be determined, which resolution actions may the owner take and what evidence must each require? | Show provider evidence; automatically attach only one exact match; allow choose-among-matches, abandon, cleanup, or explicitly retry only as audited owner operations; never infer retry from elapsed time. R-04A makes this concrete for preview creates. | R-04B trial evidence, B-03 reconciliation interaction and execution policy |
| Q-009 | Which implementation, adaptations and system revision realize the MD3 direction? | **Resolved for design-stage foundation by DEC-025:** v3 MD3 philosophy, Overview, incubating patterns, Angular Material and explicit-story Storybook. Production framework and docgen support remain B-01 readiness work; adjacent compositions remain D-01E. | No longer blocks D-01E; production scope remains gated in B-01 |
| Q-010 | What evidence should promote a portal design-system asset from incubating to stable? | Require contract, representative states, automated accessibility/interaction checks, responsive evidence and at least one real consumer; require user research proportional to consequence rather than for every primitive | D-01F maturity policy and B-01 component workshop |

The broad budget and automation questions are answered in DEC-004/005. Remaining subquestions can wait until their dependent work. Q-003–Q-006 are available for the next discussion; they need not all be answered to continue research.

## Architecture proposals awaiting evidence

| ID | Proposal | Why | Revisit when |
|---|---|---|---|
| ADR-001 | Own the product record independently of agent sessions | Preserve continuity across providers | Import/export or retrieval trial exposes missing context |
| ADR-002 | Modular application, separate worker and isolated workspaces | Small bootstrap with independent execution | Measured scaling or isolation needs |
| ADR-003 | Static React/TypeScript portal, small API, PostgreSQL | **Superseded for the portal frontend/local adapter by ADR-012.** PostgreSQL remains the hosted-direction candidate. | Hosted topology or measured scale invalidates the local adapter |
| ADR-004 | Codex first agent adapter | R-03 proved local subscription-auth execution; ADR-008 selects Symphony as its first orchestration host | Representative task or auth constraints |
| ADR-005 | Free hosted portal plus owner-operated local runner gateway | Existing hardware and subscription; preserve server migration path | Owner feedback and feasibility trial |
| ADR-006 | Persisted jobs and manual start initially; defer Temporal | Fits serial low-cost workflow | Recovery or coordination complexity grows |
| ADR-007 | Git source control; optional Jira linkage | Superseded in part by ADR-008: tracker integration enters M1 through an explicit connector and ownership contract | Jira becomes the selected first connector or sync conflicts invalidate the contract |
| ADR-009 | Database for mutable product/operational records, Git for code-adjacent contracts/assets, object storage for large artifacts, and immutable task context bundles for agents | Matches DEC-010 and avoids both an unbounded docs crawl and an opaque database-only workspace | R-07B or a context retrieval trial shows a materially simpler reliable boundary |
| ADR-010 | Product-owned design systems behind a shared intake/evolution contract; repository-authoritative source/deviation records, DTCG-compatible token interchange, catalog-first implementation and exact system revisions in task context | Preserves open-ended client style without page-local invention or a universal portal theme | D-01F and a materially different second-product trial reveal whether the contract is legible and portable |
| ADR-011 | Storybook as the preferred component workshop and agent–human state-review boundary, with source stories/tests authoritative and preview MCP optional | Reuses an open ecosystem for catalog discovery, docs and checks without making mocked stories product acceptance | D-01F representative trial measures supported runtime, setup/maintenance cost, agent discovery and owner review value; fall back to Ladle or repository fixtures if it fails |

ADR-008 and ADR-012 are accepted within their stated boundaries. The remaining technical ADRs stay proposals unless their rows or later records say otherwise. Local execution itself is accepted in DEC-006. Primary evidence and limitations are in [research](research.md).

The current hosting candidate is Cloudflare Pages/functions plus Supabase, with Railway as an alternative; see the budget comparison in research.

## How an in-app decision should behave

A decision carries a stable ID, project, question, context, alternatives, recommendation, owner, status, urgency, affected records, answer/rationale, revision, and timestamps. States: open, answered, deferred, superseded. A deferred blocking question still blocks its dependent work unless the work is rescoped explicitly.

The owner sees the consequence of answering, and can revisit a past answer. A changed answer marks affected requirements and builds for reassessment. Historical builds retain the decision revision they used. Expert advice can be attached as evidence without becoming an owner decision automatically.

## Next-session handoff

2026-09-20: Owner selected D-01E option 1 (“go go option 1”), then requested an operable review harness after finding missing task controls. Authorized a bounded 70/30 implementation and standards-compliance retrospective. This selects the visual direction and local exploration scope, not complete interaction acceptance or production authorization. See [review harness record](design/portal-visual/v1/review-harness-retrospective.md). D-01E remains open for owner review.

ADR-008 resolves the initial runner direction: durable portal tasks, Linear as the first execution connector, upstream Symphony behind a local gateway, and Codex as the first agent adapter. Treat local execution and concurrency one as bootstrap configuration. Do not regress the interaction into controlling a local Codex session.

The next design work is D-01E, consuming the owner-selected D-01F v3 foundation (DEC-025). Preserve enduring product semantics and re-evaluate unaccepted views from intent. Use the same capability contract for Aludel and other projects. Angular Material is selected for continued design work; ADR-003 production architecture remains proposed. No provider account or M1 transition is authorized.

## DEC-024 — Revised Overview authorized for bounded executable proof

2026-09-19. Owner: “alright, go go.” Continue from DEC-023 with the v2 outcome-led Overview, left navigation and multi-decision queue. Authorized: local MD3 component/workshop proof and supporting interaction experiments described in [v3 readiness](design/portal-system/v3/work-record.md). Not implied: acceptance of all adjacent compositions, production Angular selection, phase transition, external deployment or spend. D-01F remains open for measured evidence and owner foundation selection.

DEC-024 execution evidence: [v3 review](design/portal-system/v3/review-record.md) and [retrospective](design/portal-system/v3/work-record.md). Local Angular Material/Storybook proof is complete within its bounded scope; final system selection is pending. Automatic Storybook source docgen is not proven. ADR-003 and production transition remain unselected/unapproved.


## DEC-025 — MD3 foundation revision 3 accepted

2026-09-19. Owner feedback after the executable handoff: “looks great. finish this up”. Select [revision 3](design/portal-system/v3/review-record.md) as the foundation for D-01E: MP1–MP9, outcome-led Overview with left navigation and a decision queue, named reusable patterns, Angular Material implementation and explicit-source-story Storybook workshop. This resolves Q-009 for foundation selection and completes D-01F with its existing checks and retrospective.

Component maturity remains incubating; supporting destination layouts are experimental. Production framework adoption, complete candidate review/authorization design, automatic docgen support, deployment, spending and phase transition are not implied. [Exact handoff](design/portal-system/v3/d-01e-handoff.md) separates accepted inputs from open questions. Earlier pending-selection notes describe the trial before this decision.
