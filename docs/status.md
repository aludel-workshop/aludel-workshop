---
id: status-001
kind: project-status
status: active
updated: 2026-09-23
current_phase: M1
phase_state: in-progress
next_action: ROADMAP-01
---

# Current project status

## Objective

Turn the running local portal foundation into the first complete request → deliberate authorization → real agent-built preview → owner review loop, while moving mutable product records out of hand-edited Markdown.

## Next action

**ROADMAP-01: design an action-based roadmap and how agent batches come from it.** Owner (2026-09-23): "that roadmap should be all actions, not just restating the story phases", and asked whether batches should "tie them in to the roadmap". It needs an owner-reviewed direction or prototype before any build. Meanwhile the owner can run real agent batches (DEC-041): Work › Board › stage items in an agent's batch › Go. [Evidence](evidence/lay-04-work-automation.md).

## Ready queue

1. **ROADMAP-01**: an action-based roadmap that batches can be drawn from (design first).
2. **LAY-05**: coding agents against stories (absorbs B-03B), committing with LAY-07's trailers.
3. **LAY-06**: Aludel's own knowledge into its layers; retire the hash workspace.

One packet at a time. B-03's worker/artifact/recovery work remains required and must not be displaced by later workspace expansion. [Proposed dependency order](design/project-workspace/v1/delivery-plan.md).

## Active blockers

- **Operational records:** PW-01A is complete and exposes unavailable states rather than synthetic telemetry. Connected milestone records and live agent/server/spend telemetry still depend on later domain and B-03 work. [Implementation evidence](evidence/pw-01a-work-implementation.md) · [passed design QA](../apps/portal/design-qa.md).
- **Owner interface validation:** portal-only dispatch is suspended by DEC-029 after ready work became unstartable under stale/open decision checks. The replacement must prove recovery from changed decision inputs before portal-first dispatch returns. Prior request/proposal/authorization evidence remains historical.
- **Automated execution/review:** full B-03 remains incomplete. B-03B must supply worker transport/leases/recovery and immutable candidate review, including DEC-026 review-bar migration.
- **Candidate acceptance/external effects:** Q-005 and Q-008 remain gates; DEC-028 resolves Q-002 only for supervised local scope.
- **External preview/provider use:** local waiver does not authorize external deployment or spending. The vendor GitHub App's organization path has now completed one owner-run live authorization, all-repositories installation, private repository creation and initial push. Personal-account creation, token refresh/revocation, recovery against live provider failures, hosted secrets and public deployment remain unverified.
- **M3 generality:** Q-003 needs a representative second-product brief.

## Current facts and evidence

- PW-02 adds revisioned Direction, outcome Roadmap and Features records, then migrates primary navigation to Overview / Product / Work with utility destinations. Its primary-source reference study changed the implemented composition; product edits retain provenance, stale only exact dependents and never authorize Work. Node 24 typecheck/build, six server/domain suites, Product wide/narrow axe/browser checks and the existing Work lifecycle regression pass. [Evidence/retrospective](evidence/pw-02-product-workspace.md) · [research and references](design/project-workspace/pw-02/research.md).

- DEC-031 names the self-hosting product Aludel. Project-owned brand metadata and bounded raster uploads now drive the shell; the supplied alchemical workshop art is the current hero. Node 24 typecheck/build, five server/domain suites, and a disposable wide/narrow accessibility browser flow pass. [Evidence/post-hoc](design/process/aludel-brand-work-record.md).
- D-02 audits 11 request concerns, proposes product-area vs change-centric organization, six owner journeys and phased records/preview/project-setup contracts. [Evidence/post-hoc](design/project-workspace/v1/work-record.md); no strategy features or historical migration implemented.
- D-04 retains four owner-job surfaces. [V7 reference study](design/project-workspace/v7/work-record.md) records screenshot-backed directions. [V9 composition evidence](design/project-workspace/v9/work-record.md) applies them and passes static desktop/narrow browser checks; no new product interaction or runtime capability is claimed.
- DEC-029 supersedes DEC-028 for interim dispatch: explicit chat instructions authorize recorded bounded local work. B-03A's portal bridge remains evidence for the replacement, but its current state cannot block work. The portal runs at `http://127.0.0.1:4310`; no automatic worker is connected. [Evidence and retrospective](evidence/b-03a-supervised-cycle.md).

- DEC-027 records the explicit local-only G-00 waiver and owner-confirmed M1 transition. No external effect or spend is implied.
- B-02 is complete for its local boundary. Saved requests create versioned proposals; decisions use immutable revisions and optimistic conflict checks; exact dependency bindings stale only linked records; reassessment is explicit and starts no execution.
- [B-02 evidence](evidence/b-02-product-records.md) records domain and browser proof that `PLAN-B02` became stale while unrelated `PLAN-B03` remained current, retained-draft conflict recovery, proposal revisioning, restart persistence, Storybook states, accessibility and narrow layout.
- B-01 is complete for its local boundary. `./launch-machine` builds and serves the portal at `http://127.0.0.1:4310`; first-run owner setup happens in the browser without logging the key.
- [B-01 evidence](evidence/b-01-local-foundation.md) records unauthenticated rejection; owner setup/login and restart persistence; 67-document real-corpus import; 435 source relationships; idempotent re-import; changed-source revision testing; durable requests; search/detail UI; Storybook; build/typecheck; axe; and 390px browser checks.
- Angular 22 / Material 22 and explicit Storybook stories are now adopted for the portal implementation. SQLite is the tested zero-service local adapter; PostgreSQL remains the hosted-direction candidate. The database is authoritative for new mutable owner requests; Markdown remains seed/audit evidence and repository authority for code-adjacent contracts.
- The vendor-owned GitHub App flow has completed its first live organization trial. The portal binding is `ready` for private `aludel-workshop/aludel-workshop`; the active installation has all-repository access plus Administration/Contents write; local `main`, the portal record and GitHub `main` all resolve to baseline commit `6c54d7a`; 404 tracked files agree; and the ignored `.env`/PEM plus client secret are absent from the commit. Baseline inspection found a dangling tracked `apps/portal/node_modules` symlink and legacy `the-machine[bot]` attribution for follow-up. Organization/personal endpoint-token behavior, state/PKCE, JWT signing, redaction and recovery retain their local/mocked coverage. [Implementation and live evidence](design/process/enterprise-github-app-work-record.md).
- R-03, R-06B, and R-05 provide the bounded local Codex path, Symphony/Linear direction, and recovery protocol evidence for later B-03 integration.

## Completed packets

| Packet | Result | Evidence |
|---|---|---|
| WORK-UX-01 | Work layer redesign (DEC-041): roles and actions replace working style; flexible agent profiles with robots, models, effort and usage limits; batches per assignee with locking, skip and stop, and results held for review; review checklist with evidence; priority and blocking; backlog from gaps; hover cards; avatars. Agent-checked (server 63/63, layers and onboarding browser, migration on a copy of real data); owner review pending | [Evidence/retrospective](evidence/work-ux-01-work-redesign.md), [work record](design/work-redesign/work-record.md) |
| LAY-04D | Pasted, checked agent keys with a user guide (DEC-039); agent pool, batches you start with Go, OpenAI/Anthropic runner for acceptance, clarification options and data contracts, review and accept (DEC-040); agent-checked with a provider stand-in | [Evidence/retrospective](evidence/lay-04-work-automation.md) |
| LAY-04A–C | Verified closing, applied answers, server suggestions, working-style staging and routing, routines; interim project page redirected; agent-checked | [Evidence/retrospective](evidence/lay-04-work-automation.md) |
| V3-REVIEW | Owner accepted the built LAY-07 layers ("im happy with v3") | [LAY-07 evidence](evidence/lay-07-data-platform-agents.md) |
| LAY-07 | Data layer (JSON Schema objects, OpenAPI operations and export, access), Platform Overview/Architecture/Code/Repository/Releases/Environments/Database/Domains, Work › Agents (profiles, pinned instructions, routing, AGENTS.md), revision-anchored code links with Reconcile items; agent-checked, owner accepted (V3-REVIEW) | [Evidence/retrospective](evidence/lay-07-data-platform-agents.md) |
| LAY-02/03 | Project shell at `/p/<slug>`; knowledge records, story packs, page records, work items, derived story status; every layer usable; onboarding writes into the layers | [Evidence/retrospective](evidence/lay-02-03-layers.md), [plan](design/portal-layers/implementation-plan.md) |
| ONB-01–05 | Accounts/tenancy, pre-account working style and idea, account + per-user GitHub + local repository, optional agent/look/features/stack, deterministic skeleton at `<slug>.localhost`; agent-checked, owner review pending | [Evidence/retrospective](evidence/onb-01-05-onboarding.md), [work record](design/onboarding/work-record.md) |
| PW-02 | Revisioned Direction/Roadmap/Features, research-backed projections, responsibility-based navigation and legacy-route compatibility | [Evidence/retrospective](evidence/pw-02-product-workspace.md), [research](design/project-workspace/pw-02/research.md) |
| BRAND-001 | Aludel name/art applied through reusable project brand data and upload contract; server and browser checks pass | [Evidence/retrospective](design/process/aludel-brand-work-record.md) |
| Enterprise GitHub App | Vendor app configuration, live organization authorization/all-repositories installation/private create/push, endpoint-token matrix, ephemeral installation-token Git and no-duplicate recovery agent-checked; remaining live variants explicit | [Evidence/retrospective](design/process/enterprise-github-app-work-record.md) |
| Git bootstrap | Initial portal flow and reusable Git/recovery profile; provider onboarding/token architecture superseded by DEC-030 | [Historical evidence/retrospective](design/process/git-bootstrap-work-record.md) |
| PW-01A | Accepted v9 Work shell, real work/request projections, safe changed-input refresh, responsive four-route browser proof | [Evidence/retrospective](evidence/pw-01a-work-implementation.md), [design QA](../apps/portal/design-qa.md) |
| D-04 | Historical delivery; UI quality rejected and interaction evidence qualified by D-04R audit | [Evidence/post-hoc](design/project-workspace/v5/work-record.md), [prototype](design/project-workspace/v5/index.html) |
| D-03R | Owner requested a Work feature revision; lifecycle lanes rejected as navigation | [Selection](design/project-workspace/v4/selection.md), [revised intake](design/project-workspace/v4/intake.md) |
| D-03 | Work Plan/Active/Reviews/History interaction and disposable reconciliation proof agent-checked; owner selection pending | [Evidence/post-hoc](design/project-workspace/v3/work-record.md), [prototype](design/project-workspace/v3/index.html) |
| D-02R | Owner selected A and planning/history first; Reviews-under-Work refinement recorded | [Selection/post-hoc](design/project-workspace/v2/selection.md) |
| D-02 | Authorized strategy outputs agent-complete; structural choice followed in D-02R | [Evidence/post-hoc](design/project-workspace/v1/work-record.md), [review board](design/project-workspace/v1/review.html) |
| B-03A | Supervised portal bridge checked; first owner-cycle navigation correction checked | [Evidence/retrospective](evidence/b-03a-supervised-cycle.md), [intake](design/process/b-03a-intake.md) |
| B-02 | Versioned proposals/decisions, conflict-safe writes, dependency-specific staleness, explicit reassessment | [Implementation evidence and retrospective](evidence/b-02-product-records.md), [intake](design/process/b-02-intake.md) |
| B-01 | Real local portal, owner access, SQLite records, durable requests, idempotent Markdown revision/link import, adopted UI/workshop | [Implementation evidence and retrospective](evidence/b-01-local-foundation.md), [intake](design/process/b-01-intake.md) |
| G-00 | Local-only hosted-preview/provider-cost waiver and M1 transition confirmed | [DEC-027](decisions.md#confirmed) |
| D-01E | Owner accepted task/review composition baseline and operable host; useful controls assigned to real review bar | [Closeout](design/portal-visual/v1/review-harness-retrospective.md#owner-review-and-closeout--2026-09-20) |
| D-01F | Owner selected MD3 foundation v3; Angular Material patterns, responsive Overview, Storybook states and flow checks | [Acceptance](design/portal-system/v3/review-record.md), [evidence/retrospective](design/portal-system/v3/work-record.md) |
| M0 research/design | Product loop, local agent path, runner choice, recovery model, product workflow, knowledge boundary, experience architecture, and design-system strategy | [Execution plan](execution-plan.md), [decision register](decisions.md) |

## Latest handoff

2026-09-23: **WORK-UX-01 built and agent-checked (DEC-041)** after the owner accepted prototype v2.
- Work now has Board (batches per assignee; Queue, Backlog and Done), Roles, Agents and Routines. Items carry priority, blocking links and a review checklist.
- Server tests pass 63/63. The layers and onboarding browser scripts pass. The migration was checked on a copy of the real database and three gaps were fixed.
- Restart the portal to pick it up: existing projects migrate at start-up.
- Limits: agents still run only acceptance, clarification options and contracts; there is no live token ticker; the agent reviewer's pre-check isn't built. [Evidence](evidence/work-ux-01-work-redesign.md).
- Next: ROADMAP-01.

2026-09-23: **WORK-UX-01 v2 for owner review.** The owner reviewed v1. Feedback is recorded as B1–B13 in the [work record](design/work-redesign/work-record.md#owner-review-of-v1-2026-09-23): per-action instructions and toolkit, one card everywhere, live agent runs, a review checklist, robot avatars per profile, priority and blocking. [v2](design/work-redesign/v2/index.html). Earlier the same day: **WORK-UX-01 prototype for owner review.** The owner asked in chat for a Work layer UI pass: items, per-assignee batches, Roles by layer, and flexible agent profiles. A preview comes first, before any code. [Work record and brief ledger](design/work-redesign/work-record.md) · [prototype v1](design/work-redesign/v1/index.html). No portal code has changed. Trial process change: multi-part chat briefs are itemised in a ledger ([operating procedure §1](design/process/operating-procedure.md#1-establish-the-task-and-improve-the-process)). ROADMAP-01 remains `next_action`.

2026-09-23: **Bug found and fixed at closeout:** creating or building a project committed Aludel's own repository (four mislabeled commits, three already pushed; no GitHub push of Aludel to a project happened). Workspaces must now be their own repository. [Details](evidence/lay-04-work-automation.md#found-at-closeout-project-creation-committed-aludels-own-repository-fixed-2026-09-23).

2026-09-23: **Closed out LAY-07 and LAY-04.** The owner ran two real batches on OpenAI: one contract done (903 tokens) and one acceptance draft waiting in review (1,413 tokens). [Evidence](evidence/lay-04-work-automation.md#owner-use-2026-09-23). Next: ROADMAP-01 (design first).

2026-09-23: **Agents run in batches you start (DEC-040).** Working style now marks work as available for agents instead of opening items; your untouched items go back to the pool on restart. In Work › Queue, fill a batch (by hand or "the next 10") and press Go. The runner drafts acceptance, clarification options and data contracts on the project's key (OpenAI `gpt-6-astra` by default), and drafts come back for review. Server tests pass 60/60; all browser scripts pass except the known step. No real provider was called by us. Next: ROADMAP-01 design.

2026-09-23: **Agent accounts connect by pasted key (DEC-039).** The owner cares about hosting and declined a third-party broker. The guided Anthropic and OpenAI key panel checks each key for free, stores it encrypted, and links a [user guide](guides/connect-an-agent.md). "Codex on this machine" is retired. Server tests pass 54/54; all browser scripts pass except the known step. Next: the owner's OK for the Product agent to spend on runs.

2026-09-23: **LAY-04A–C built and agent-checked** after the owner accepted v3.
- Closing record-changing work now needs a revision made from it, and answers are applied to their records. Working style stages and routes suggestions (a Planner's plans go to the Architect, page designs to the Design lead for review). Four default routines run weekly, monthly or before each release.
- Server tests pass 51/51. All browser scripts pass except the known `browser.mjs` step.
- Next: the owner's decision on how the Product agent may run (LAY-04D). [Evidence](evidence/lay-04-work-automation.md).

2026-09-22: **LAY-07 built and agent-checked** on the owner's instruction ("can you handle lay-07 for me?"), without the separate v3 review.
- Server tests pass 44/44, including 12 new ones. Typecheck and build pass. `tests/layers-browser.mjs` drives every new tab, with axe clean on 23 views and 390px clean on 10 paths.
- `tools/browser-checks.sh` now runs every browser script against a fresh portal each. All pass except the known `tests/browser.mjs` step.
- Deviation: backups live in `<data>/backups/<project>/`, not in the workspace, because the workspace is the git repository.
- Process: the browser runner and a `*.localhost` resolver in the test support.
- Next: owner walkthrough (V3-REVIEW), then LAY-04, which reuses the code links' revision anchoring. [Evidence](evidence/lay-07-data-platform-agents.md).

2026-09-22: **LAY-REVIEW done.** Owner: "a decent direction … a solid enough base to work with"; each layer gets a later refinement pass. New owner input: a stack-neutral **data and API** layer (objects, OpenAPI-backed exploration) above Platform, plus Platform operations (database health, backups, querying, servers, CI/CD, domains, provider handoffs). Owner approved the name **Data**, the Platform direction, integrations where they are used, Work › Agents with profiles, and code links (Platform › Code, no inline tags): DEC-038. Documented in [data-platform-research](design/portal-layers/data-platform-research.md) and [knowledge-structures](design/portal-layers/knowledge-structures.md); prototype v3 built for review.

2026-09-22: the layers are real (LAY-02/03). A new session should read [the layers implementation plan](design/portal-layers/implementation-plan.md) first; its "Current state" section names the next concrete steps and entry points. Server 32/32; onboarding and layers browser tests pass.

2026-09-22: new-project onboarding built locally (DEC-032–035). The end-to-end browser script takes a new user from the marketing page to a running generated app on its own subdomain. Fixed on the way: non-executable git askpass (GitHub pushes would have failed), 19 missing workspace icons, the stale Playwright path. `tests/browser.mjs` fails on the baseline too (pre-existing). [Evidence](evidence/onb-01-05-onboarding.md).

2026-09-21: PW-02 is complete. The Product area now provides revisioned Direction, horizon Roadmap and feature comparison/detail over one product record set; route and authority boundaries survived desktop/narrow browser checks and the existing Work lifecycle regression. [Evidence](evidence/pw-02-product-workspace.md). B-03B is again the single next planning pointer and needs separate authorization.

2026-09-21: the first live GitHub organization setup succeeded through the portal. Persisted binding, installation permissions, local baseline, tracked-file count and authenticated GitHub `main` were cross-checked; no real credential file or client secret is tracked. [Evidence](design/process/enterprise-github-app-work-record.md).
