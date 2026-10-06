---
id: status-001
kind: project-status
status: active
updated: 2026-10-06
current_phase: M1
phase_state: in-progress
next_action: COLLAB-WORK-01
---

# Current project status

## Objective

Convert Code onto its template with GitHub sync, now on `main`: the layer-template candidate was promoted by DEC-062. Then publish every layer's repository to the owner's GitHub. Deploy stays deferred.

## Next action

**COLLAB-WORK-01 CW-1 built and agent-checked (2026-10-05)** ([brief and evidence](design/collaborator-work/work-record.md#cw-1-build-work-comes-back-through-the-github-remote-2026-10-05)). Report and submit now push the item's branch; close-out fetches the reported commit from GitHub and refuses a branch that moved. Live GitHub is unverified until CW-6. Testing now runs in two tiers (`test:affected` while developing, then `test:server:templates` as the gate; AGENTS.md). The owner accepted CW-1 (2026-10-05). The AGENT-WORK-01 dogfood needs Aludel's repository connected to a project first, so the next step is [EX-02A](design/existing-projects/connect-repository.md): create a project by connecting an existing repository. The plan was approved on 2026-10-05 (DEC-067): C0 prototype, C1 fake GitHub in browser journeys, C2 code paths, C3 build, C4 the owner connects Aludel live, C5 retire the built-in project. Then the dogfood, then CW-2. Committed on `claude/agent-work-prototype-7en0jx` (PR #4).

**EX-02A C1–C3 built and agent-checked (2026-10-05)** ([plan and evidence](design/existing-projects/connect-repository.md#c1c3-build-2026-10-05)).
- **What's built:** New project asks "Do you have code already?". Connect an existing repository chooses where the code is and installs `.aludel/` as one commit with those paths, with no starter docs. There's also a fake GitHub for browser journeys.
- **Checks:** the connect browser journey, new unit tests, and the templates gate (347 pass, 0 fail).
- **Restart effect:** additive only. Two draft columns and the AGENT-WORK-01 goal tables are added. No existing data changes.
- **C4 done by the owner (2026-10-05):** the project "Aludel Workshop" is connected; `.aludel/` is on GitHub `main` at `a98c5c9`; Code reads 2,507 units ([check](design/existing-projects/connect-repository.md#c4-the-owner-connected-aludel-2026-10-05)). Close-out now settles `main` with GitHub through Code's sync before merging (found while preparing the dogfood; journey-checked).
- **Next: the AGENT-WORK-01 dogfood** in Aludel Workshop, from an item container. Built 2026-10-05 ([record](design/collaborator-work/work-record.md#item-containers-go-opens-the-item-in-a-dev-container-2026-10-05)): Go creates the item's branch and opens it in a dev container in VS Code; the container connects itself to its one item when you press Connect beside its code, with no pairing. Before W-8 can use it: merge `claude/item-containers` to `main` (Go branches from GitHub's `main`, which needs `.devcontainer/`), restart the portal on `main`, archive W-7, then on W-8 assign yourself and press Open in a container. After that, C5 retires `the-machine`.
- **Dogfood attempt 1 (W-8 Kanban board) closed as failed (2026-10-06).** Output: findings F1–F28 and the retrospective ([record](design/agent-work/work-record.md#dogfood-w-8-kanban-board-in-an-item-container-2026-10-05)). The item container can't build the portal without `layer-base` (owner to publish it to GitHub). The Pages review walker (A7) and pushed events are missing, and there's no way to end an item as failed. Process change applied: requirement traceability, and a reviewability check before a dogfood (operating procedure §6).
- **Attempt 2 prerequisites built and agent-checked (2026-10-05)** on `claude/item-environment` ([record](design/agent-work/work-record.md#attempt-2-prerequisites-2026-10-05-claude-local-session)): item containers get the pinned layer templates from Aludel and the person's git identity; closed items' container volumes are removed; an item can end as not done through an approved wrap-up action whose proposed items (with dependencies) are created from the J8 stack. Inside the dev container image the portal now builds and the templates gate runs (3 Docker-only failures, F30, owner decision). The small findings (F4, F5, F7/F10/F14/F18, F19, F24) and a person-side End as not done are built on the same branch; F15, F1 and F3 are recorded as future work; DEC-068 settles F8, F9 and F13. Next: the owner restarts on the branch, ends W-8 as not done, and tries W-8 attempt 2.

**JOURNEYS-01 J8: task creation redesign and owner Biome trial** ([prototype/work record](design/journeys/task-create/work-record.md), [trial steps](design/journeys/j8-trial.md), [handoff](design/journeys/handoff.md#local-j8-preparation-2026-10-03-codex)). PR #2 is pulled at `440c2bd`; Docker and the portal are running with local startup/acceptance repairs. The owner accepted Code Work #5, then created W-8; an unmatched request silently received the generic charter criterion. The owner requested a Jira-like creation experience and approved disposable Playwright checks. The owner accepts the composer direction: journeys are optional at creation, and the agent assesses and augments multiple affected journeys at pickup. The owner authorized “build it”: the real composer and additive assessment contract are implemented, browser-checked, and running locally. Next: owner tries Code › Tasks › Create task and resumes J8, including a real agent pickup. W-8 remains unchanged; the creation UI is updated locally. Owner-reported short-screen overflow and the legacy agent staging guard are repaired, with disposable short-height and agent create → stage checks. W-9 then hit a worker-hook identifier bug: repaired and the same owner-started attempt reached its first Codex turn. W-9 submitted a notes-only assessment and proposed a Pages spec follow-up; no feature was built. Owner then reported suggestion-review overflow and asked for editable tasks in the main pane. The shared form stack and sidebar notes are built and checked locally; the owner confirmed its suggestion through that review. The owner then attempted acceptance: legacy empty-claim and closeout guards are repaired, with a real disposable signature and negative guard checks. The owner signed W-9. Its created Pages follow-up W-10 then disappeared: backlog cleanup confused the task description with a generated gap key. Cleanup now uses explicit generator provenance; regression and receiving-board browser checks pass. The owner confirmed the suggestion was unchanged, and W-10 is restored under its original ID/number in Pages › Tasks › Backlog, surviving startup cleanup. No agent performed the owner signature or a new Go. Prerequisite/continuation handling and pre-registration startup errors need clearer task status. J7's agent check remains unverified; J8's live journey and retrospective remain pending. The accumulated fixes and failure account are handed off on `codex/j8-trial-task-review-fixes` ([push notes](design/journeys/handoff.md#j8-push-handoff--2026-10-04)); Fresh full server suites pass (310 standard / 335 template, zero failures); JOURNEYS-01 remains the next action.

**T03-CODE: the app repository as the Code layer, with GitHub sync (run 1 built and agent-checked 2026-10-02).** [Evidence and retrospective](evidence/t03-code/README.md) · [brief and run log](design/layer-app-transition/t03-code-brief.md).
- **Done:**
  - Code runs from its template (`layer-base` `code` `83ce28a`) in the project's own repository, under `.aludel/`;
  - the app's docs are its Knowledge;
  - releases and generation links live in the repository;
  - existing projects adopt with IDs unchanged;
  - an existing GitHub repository can be imported;
  - the repository syncs with GitHub through the project's repository binding.
- **G-CODE:** six contract generalizations on `layer-base` `main`, each tested on a non-Code layer.
- **Checks:** both server suites, the `code-layer` and fake-GitHub journeys, and the reruns of the other template journeys pass (see the evidence).
- **Next for the owner:**
  1. Restart the portal and look at Code; existing projects adopt on restart, and the DEC-062 backup is the rollback.
  2. Run the live GitHub round trip (create, import, a Knowledge save, a commit on github.com, a divergence).
  3. Try the [repository integration and guided Code review](evidence/repository-review/README.md) (built locally, agent-checked). Biome Work #3 waits for you to take, submit and review it in the normal UI ([steps](evidence/biome-review/README.md)); its guided steps move to journeys in JOURNEYS-01 J3.
- **Then:** retire the compiled layer modules (except Deploy's) as one revertible commit. No provider turn, deployment or spending is authorized.

**Promotion (DEC-062, 2026-10-01): the candidate is now `main`.**
- The merge is `1c17c48`, and the launcher defaults to templates on (`1e425a2`).
- Live data is backed up at `.data/backups/portal-data-2026-10-01-pre-promotion`. It is git-ignored and passed an integrity check.
- Server suites: templates on 282 pass, 0 fail, 7 explained skips; templates off 265 pass, 0 fail, 24 skips, all needing templates.
- A rehearsal ran the merged code on a copy of the live data, with workspace paths rewritten to the copy, on :4341. It started cleanly, split project tables into per-project files (PROJECT-DB-01), and adopted the layers. All 169 records kept their IDs and revisions; Browser Buddy's one Data operation moved into Data's repository file under the same ID. Code units (31), trace links (4) and the repository binding (1) are unchanged.
- **Next for the owner:** stop any old portal, run `./launch-machine`, sign in and look around. That browser review is the remaining evidence.
- Rollback: stop the portal, restore the backup over `apps/portal/.data`, and `git checkout f18a8b7`.
- The old candidate checkouts are left in place for the owner to remove. `pages-template-candidate`'s Git directory lives inside `lat08-candidate`, so remove them together.

**Just closed:** LAYER-BINDINGS-01 (steps 1–3) and LAYER-KNOWLEDGE-01. The owner accepted the built Knowledge UI in chat on 2026-10-01 ("im happy with current knowledge ui"); see the [acceptance record](design/layer-knowledge/work-record.md#review--acceptance-record). Its open follow-ups stay with their named packets: F1 goes to T03-CODE, F3 to LAT-08A, F10 to bindings step 4 after T03-CODE, and F4–F8 are listed in the [follow-ups](design/layer-bindings/work-record.md#follow-ups-kept-here-so-they-arent-lost).

## Prior transition evidence

LAT-01–07 and the LAT-08 prototype established the isolated candidate, layer shell and early migration behavior. Their dated [implementation evidence](../lat08-candidate/docs/evidence/lat-08/README.md) remains historical input. DEC-057/059/060 replaced LAT-08's action setup and handoff; the repository-backed Pages and Data checkpoints are linked from the [conversion plan](design/layer-app-transition/layer-template-conversion.md).

## Ready queue

1. **AGENT-WORK-01** (next; [plan](design/agent-work/plan.md), [work record](design/agent-work/work-record.md)): cross-stack agent work. Prototypes accepted as direction 2026-10-04; owner go to build 2026-10-04; local-first order A1 → A3 → A8 → A4 → dogfood. A1, A3, A8 and A4 built on PR #4 (goal model, item page, local CLI, review and close-out); next the dogfood in the owner's local Claude Code.
1. **JOURNEYS-01** (done 2026-10-04; J8 closed without signup, [handoff](design/journeys/handoff.md)): journey-driven Work and review. Spec, then implement; claims replace hand-written criteria; journeys, tests and review seams live in `.aludel/`; includes cleanup of Codex's guided-preview work ([plan](design/journeys/work-record.md)). J0–J2 done 2026-10-02 (Code template `cc30be2`: journeys facet and Journeys tab); code tracing removed by DEC-063; J3 done 2026-10-03 (Biome's steps move to J8); J4 done 2026-10-03 (claims, with the gate at acceptance); J5 done 2026-10-03 (Specify → Implement, browser journey passing); J6 done 2026-10-04 (owner accepted, merged); J7 built 2026-10-04 for people (the agent check waits on the Symphony toolchain). The owner waived waiting for T03-CODE's look.
2. **COLLAB-WORK-01** (next; plan approved 2026-10-05, DEC-065; [brief](design/collaborator-work/work-record.md)): a collaborator works a task from her own machine. CW-1 remote handoff (before the AGENT-WORK-01 dogfood) → CW-2 members and Code-role GitHub collaborators, with `main` protected → CW-3 dev container → CW-4 `aludel work`. CW-6 live trial needs DH-6.
2. **DEPLOY-HOST-01** (planned 2026-10-05, DEC-066; [brief](design/deploy-hosting/work-record.md)): Deploy provisions and operates servers on the owner's cloud account. DigitalOcean is the first adapter, behind a provider-neutral host contract; Aludel bootstraps itself with the same code. DH-1 to DH-5 are local, against fakes. DH-6 (live droplet) needs the owner's go plus Q-4 (new or existing droplet) and Q-5 (domain).
2. **T03-CODE**: run 1 built and agent-checked ([evidence](evidence/t03-code/README.md)). Waits on the owner's browser look, the live GitHub round trip and the candidate-preview question; then the compiled modules retire. F1 is done.
3. **LAYER-GITHUB-01**: publish Vision, Design, Pages and Data repositories (and possibly `layer-base`) to the owner's GitHub with T03-CODE's sync (DEC-062).
4. **LAYER-BINDINGS-01 step 4 (F10)**: Code ⇄ Pages binding, migrating `layer_connections` and the hard-coded Pages reconciliation, after T03-CODE.
5. **LAT-08A**: build native-tab, layer-owned Work review on the template contract after LAT-T01–T03. Include LAYER-BINDINGS-01 follow-up F3: binding changes, refacets and drift assessments must be decidable from the Work board.
6. **LAY-05**: coding proof preserved; candidate boundary, direct tracker, live retention, bounded runs and live interruption recovery pass; owner browser review follows the general Work flow.
7. **PLATFORM-PIPELINE-01**: PP-01C onboarding → PP-01D environments → PP-01E guards ([work record](design/platform-pipeline/work-record.md)).
8. **ICONS-FONTS-01**: icon and font libraries in Design (unblocked in principle by PP-01A; waits behind PLATFORM-PIPELINE-01).
9. **PAGES-UX-01**: built and agent-checked (DEC-048; [evidence](evidence/pages-ux-01-pages-layer.md)). Next: owner review of the built layer.
10. **PLATFORM-UX-01**: **built and agent-checked** (DEC-049; [evidence](evidence/platform-ux-01-code-deploy.md)). Next: owner review of the built Code and Deploy layers ([work record](design/platform-layer/work-record.md), [prototype](design/platform-layer/v1/index.html)). It supplies PP-01D's Environments UX and absorbs the Platform half of DATA-PLATFORM-UX-01.
11. **DATA-PLATFORM-UX-01**: the rest of Data (owner: "perhaps").
12. ~~**LAY-06**~~: superseded by DEC-067 (Aludel connects as an ordinary project; EX-02A C5 retires the built-in one).

**Proposed cross-layer plan:** [EXISTING-PROJECTS-01](design/existing-projects/work-record.md) covers connecting existing repositories, reconstructing layer drafts from pinned evidence, and reconciling later external commits. The 2026-09-27 owner request authorized this plan and read-only inspection only. EX-01 research is the first proposed slice; knowledge authority, Work action coverage and app-defined environments remain dependencies. It does not replace T03-CODE as the current handoff.

**Proposed layer framework:** [LAYER-FRAMEWORK-01](design/layer-framework/work-record.md) defines adaptive layer apps with output authority, discovery, versioned relation/coverage policy, quality audits and Work suggestions across optional project graphs, including read-only external projections. Vision-story and code-first Pages walkthroughs are conceptual checks; runtime and Figma-account trials remain open. The 2026-09-27 chat requests authorized local conceptual design only. It does not change T03-CODE as the current handoff.

**Layer repository research:** [LAYER-REPOSITORIES-01](design/layer-repositories/work-record.md) records the earlier optional-repo scout. DEC-055 supersedes that target: every installed layer has an owner-owned template-derived repository. Local template repositories are in use; GitHub writes remain separately authorized. T03-CODE is the current handoff.

**Pages-first layer-app trial:** [LAYER-APP-TRIAL-01](design/layer-app-trial/work-record.md) is an isolated, agent-checked local prototype for a UX designer starting with Pages, Library and Work only. Its [v3 preview](design/layer-app-trial/v3/index.html) separates Map/Pages/Flows from shared Operations and Knowledge tabs, moves layer management and optional dashboard cards to Home, and uses a card stack for layer work. The earlier [v2 preview](design/layer-app-trial/v2/index.html) remains as comparison evidence. A browser trial passed the local discovery → sync task → flow → automatic closure path; agent results are local stand-ins. Owner trial and production architecture remain open; T03-CODE is the current handoff.

**Active layer-app transition:** [LAYER-APP-TRANSITION-01](design/layer-app-transition/implementation-plan.md) has an isolated candidate. LAT-01–04 passed their local gates; LAT-05 now combines its utility/reconciliation evidence with the later authorized Pages Work proposal path ([closeout](evidence/lat-05/README.md#2026-09-29-packet-closeout-after-work-handoff)). LAT-06 passed its revised local gate under DEC-053; LAT-07 passed its local inventory/view gate at candidate `3e1e848`. DEC-060 retires LAT-08 as a current handoff. LAT-T03 now continues with Code under DEC-055/059; the catalog, Vision, Data and Design have local evidence. [LAT-08A](design/layer-app-transition/layer-owned-review.md) will reuse affected layer tabs for candidate review under DEC-054. External/Figma layers and promotion remain deferred.

One packet at a time. B-03's worker/artifact/recovery work remains required and must not be displaced by later workspace expansion. [Proposed dependency order](design/project-workspace/v1/delivery-plan.md).

## Active blockers

- **Template transition:** promoted to `main` (DEC-062). The owner waived LAT-09 (comparison). LAT-10's cutover is covered by the backup and the rehearsal on copied data. The owner's browser check after restart is still open. Code conversion remains (T03-CODE).

- **LAY-05 activation:** ADR-008 selects Aludel as Symphony's tracker. Agent submission, isolated preview, terminal-workspace retention, structured checks and live process-interruption recovery pass on disposable projects. Owner browser review still blocks real-work dispatch.
- **Operational records:** PW-01A is complete and exposes unavailable states rather than synthetic telemetry. Connected milestone records and live agent/server/spend telemetry still depend on later domain and B-03 work. [Implementation evidence](evidence/pw-01a-work-implementation.md) · [passed design QA](../apps/portal/design-qa.md).
- **Owner interface validation:** portal-only dispatch is suspended by DEC-029 after ready work became unstartable under stale/open decision checks. The replacement must prove recovery from changed decision inputs before portal-first dispatch returns. Prior request/proposal/authorization evidence remains historical.
- **Automated execution/review:** full B-03 remains incomplete. B-03B must supply worker transport/leases/recovery and immutable candidate review, including DEC-026 review-bar migration.
- **Candidate acceptance/external effects:** Q-005 and Q-008 remain gates; DEC-028 resolves Q-002 only for supervised local scope.
- **External preview/provider use:** local waiver does not authorize external deployment or spending. The vendor GitHub App's organization path has now completed one owner-run live authorization, all-repositories installation, private repository creation and initial push. Personal-account creation, token refresh/revocation, recovery against live provider failures, hosted secrets and public deployment remain unverified.
- **M3 generality:** Q-003 needs a representative second-product brief.

## Current facts and evidence

- 2026-10-01: **Candidate promoted to `main` (DEC-062).** Merge `1c17c48`, launcher `1e425a2`. Live data was backed up, both server suites pass, and the copied-data rehearsal preserved every record. [Evidence and retrospective](evidence/promotion-2026-10-01.md).
- 2026-10-01: **LAYER-KNOWLEDGE-01 owner-accepted; T03-CODE brief written.** The owner accepted the built Knowledge UI in chat, which closes LAYER-BINDINGS-01 and LAYER-KNOWLEDGE-01 locally. [The T03-CODE brief](design/layer-app-transition/t03-code-brief.md) adds a contract-assumption check before the recipe. Code is the first layer whose repository is not Aludel-shaped. Owner plan approval is pending.
- 2026-10-01: **LAYER-KNOWLEDGE-01 built locally.** Knowledge is the layer's docs site (Docs, then Information with a card per binding). Docs and spec are saved to the layer repository at once, with history. Bindings are proposed by ticking parts of the tree. Compare specs replaces hints. Pages has a Kit tab. Suites and 13 journeys pass. [Evidence](evidence/layer-knowledge-01/README.md).
- 2026-10-01: **Step 3 reviewed by the owner; LAYER-KNOWLEDGE-01 proposed.** [Brief](design/layer-knowledge/work-record.md): spec, contents and docs in a docs-site Knowledge tab; bindings by selecting spec nodes; Compare specs replaces hints; Manage › Connections and Facets go.
- 2026-10-01: **LAYER-BINDINGS-01 step 3 built locally (R5 closes it).**
  - Layers declare and reshape facets in Manage › Facets, as reviewed Work.
  - Discover raises Assess overlap. Overlap chains refacet both sides before the binding can be accepted.
  - Cedes raise adopt Work and then re-point or adapter Work.
  - New `overlap` and `branding` journeys pass with ten others, and the suites pass. [Evidence](evidence/layer-bindings-01/refaceting-r5.md).
- 2026-10-01: **LAYER-BINDINGS-01 step 3 R4 built locally.** Layer views show a replica as read-only with "Propose a change" and ceded facets as a pointer, through `@aludel/host/roles`. The base contract requires it of facet views; Design and Vision adopt it, re-pinned. Checks: the new `roles` journey and nine others pass, and the suites pass. [Evidence](evidence/layer-bindings-01/refaceting-r4.md).
- 2026-10-01: **LAYER-BINDINGS-01 step 3 R3 built locally.**
  - Library and API reads carry each entry's role.
  - API writes to replica or ceded entries are refused with "Managed in …".
  - Reads of a kind two instances own must name the layer.
  - Refacet preflights list other layers' references.
  - The server suites now time out per test.
  - [Evidence](evidence/layer-bindings-01/refaceting-r3.md).
- 2026-10-01: **LAYER-BINDINGS-01 step 3 R2 built locally.**
  - Binding changes and refacets are Work items the owner decides. Accept in Library › Bindings now closes Discover's review item.
  - A refacet is a reviewed `layer.json` branch of the layer instance, merged on acceptance.
  - Checks: 7 new server tests, 13 of 13 mutations caught, both suites passing, and step 2's nine browser journeys passing. [Evidence](evidence/layer-bindings-01/refaceting-r2.md).
- 2026-10-01: **LAYER-BINDINGS-01 step 3 R1 built locally (refaceting as a pure contract).**
  - Facets select kinds, or one kind narrowed by one field, and never overlap. Bindings contract on whole facets with one authority; areas and `keeps` are gone.
  - `refacet` splits, merges or renames a layer's facets. Moved entries are detached from their bindings until every participant lets go.
  - Ceded participants offer their content once. Read-only authorities rectify instead of adopting. `roleOf` and `repoint` are ready for R3 and R2.
  - Checks: 30 binding and refacet tests, with order reversal and a 14-rule mutation check; server suites at 256 (templates off) and 251 (templates on), none failing. [Evidence](evidence/layer-bindings-01/refaceting-r1.md).
- 2026-10-01: **LAYER-BINDINGS-01 step 2 built locally.**
  - Pages keeps a replica of the app kit (`kit_item`) through its declared `aludel-kit` adapter, instead of reading Design live.
  - Design declares its kit facet.
  - Discover, Watch (auto-apply, drift assessment, a hold while a layer is off) and Library › Bindings are built.
  - Pins: `layer-base` `main` `20bdd95`, `design` `cd96d4c`, `pages` `331908f`.
  - Server suites: templates off 241 pass, 2 skipped; on 236 pass, 7 skipped.
  - The new `bindings` journey and eight other journeys pass. The `design-layer` and `pages` journeys were updated to accept the binding.

  [Evidence](evidence/layer-bindings-01/README.md#step-2-the-design-system-binding-end-to-end).

- 2026-10-01: **LAYER-BINDINGS-01 step 1 built locally (uncommitted).** It adds:
  - facets in the base layer contract and host manifest check;
  - the pure binding module (`bindings.mjs`), with per-spoke baselines and adapters chosen by source shape;
  - the binding record and API (`/api/projects/:id/bindings`).

  All six walkthroughs pass as data fixtures, and their outcomes are unchanged when every input list is reversed. A mutation check confirms the fixtures detect four separate logic breaks. Server suite 240/240; templates suite 233 pass, 7 skipped, 0 fail; pins are unchanged. No binding can be created until templates declare facets (step 2). [Evidence and retrospective](evidence/layer-bindings-01/README.md).

- 2026-09-29: **LAT-07 completed locally at candidate `3e1e848`.** All 17 remaining legacy layer actions have explicit dispositions; four built-in layers expose typed actions, unavailable reasons, Operations/Knowledge views and exact output revision reads. Candidate server suite 145/145, typecheck/build passed. Browser validation could not run because local Playwright/browser tooling is absent. Existing role-backed Work stays active until LAT-08 migration. [Evidence and retrospective](evidence/lat-07/README.md). `LAT-08` is next.

- 2026-09-29: **LAT-06 completed locally at candidate `cbe7601` under DEC-053.** Layer-owned action declarations, exact Go pins, story-free Pages Work and useful/wrong Code observation relation review passed; full candidate server suite 143/143. Earlier wide/390px browser evidence passed; a final rerun could not start because its temporary Playwright module had been removed. Runtime grants, assignment installation and role migration are LAT-08 gates. [Evidence and retrospective](evidence/lat-06/README.md). `LAT-07` is next.

- 2026-09-28: **WORK-AGENTS-01 LAT adapter checkpoint, packet partial.** The isolated candidate through `5ff5433` now admits a Pages-origin `pages.flows` item through Go into a read-only flow proposal and exact Work acceptance. Reviewed policy and source origin are pinned; changed policy blocks acceptance. Candidate focused tests passed 16/16 and full server 133/133 before final link tightening; affected tests passed again, and typecheck/build passed. [Evidence and retrospective](evidence/work-agents-01-lat-adapter.md). Later live retry reached Review; owner validation and DEC-051 action migration remain open. Normal candidate dispatch stays disabled.

- 2026-09-28: **LAT-05 utility checkpoint, packet partial.** The isolated candidate has durable exact-input receipts, a reviewed Vision → Pages flow-coverage utility, one Work suggestion per story gap, safe closure for untouched items, retained exceptions/rejections and degraded coverage on source removal. Focused 4/4, full server 130/130 before final run-link tightening, typecheck/build, and a disposable wide/390px browser journey with axe pass. [Evidence and retrospective](evidence/lat-05/README.md). The later authorized Pages Go submitted a proposal into Work Review, closing this bounded agent handoff gate; DEC-051 layer-owned actions are LAT-06/07 work. Normal candidate dispatch remains off.

- 2026-09-28: **LAT-04 completed locally on the isolated candidate at `02d0670`.** Explicit catalog selection permits zero or one layer; Home can add/remove apps while retaining records; Pages now has versioned Knowledge, Operations board, routines and reviewed connection documents. Full server tests passed 128/128; typecheck/build and wide/390px browser journeys with axe passed. [Evidence and retrospective](evidence/lat-04/README.md). Owner usefulness review and promotion remain open. Next: WORK-AGENTS-01 dependency before LAT-05 agent execution.

- 2026-09-28: **LAT-03 completed on the isolated candidate at `46bc1cf`.** Persisted instance preferences drive the rail and Home layer cards; shared Operations/Knowledge slots preserve native output tabs. Focused tests passed 3/3; typecheck/build and authenticated wide/390px browser checks passed, including axe, search and two-record history. [Evidence and retrospective](evidence/lat-03/README.md). Next: LAT-04; owner comparison and promotion remain later gates.

- PW-02 adds revisioned Direction, outcome Roadmap and Features records, then migrates primary navigation to Overview / Product / Work with utility destinations. Its primary-source reference study changed the implemented composition; product edits retain provenance, stale only exact dependents and never authorize Work. Node 24 typecheck/build, six server/domain suites, Product wide/narrow axe/browser checks and the existing Work lifecycle regression pass. [Evidence/retrospective](evidence/pw-02-product-workspace.md) · [research and references](design/project-workspace/pw-02/research.md).

- DEC-031 names the self-hosting product Aludel. Project-owned brand metadata and bounded raster uploads now drive the shell; the supplied alchemical workshop art is the current hero. Node 24 typecheck/build, five server/domain suites, and a disposable wide/narrow accessibility browser flow pass. [Evidence/post-hoc](design/process/aludel-brand-work-record.md).
- D-02 audits 11 request concerns, proposes product-area vs change-centric organization, six owner journeys and phased records/preview/project-setup contracts. [Evidence/post-hoc](design/project-workspace/v1/work-record.md); no strategy features or historical migration implemented.
- D-04 retains four owner-job surfaces. [V7 reference study](design/project-workspace/v7/work-record.md) records screenshot-backed directions. [V9 composition evidence](design/project-workspace/v9/work-record.md) applies them and passes static desktop/narrow browser checks; no new product interaction or runtime capability is claimed.
- DEC-029 supersedes DEC-028 for interim dispatch: explicit chat instructions authorize recorded bounded local work. B-03A's portal bridge remains evidence for the replacement, but its current state cannot block work. The portal runs at `http://127.0.0.1:4310`; two project-scoped local Docker hosts now poll automatically ([activation evidence](evidence/work-agents-01-host-online.md)). [Evidence and retrospective](evidence/b-03a-supervised-cycle.md).

- DEC-027 records the explicit local-only G-00 waiver and owner-confirmed M1 transition. No external effect or spend is implied.
- B-02 is complete for its local boundary. Saved requests create versioned proposals; decisions use immutable revisions and optimistic conflict checks; exact dependency bindings stale only linked records; reassessment is explicit and starts no execution.
- [B-02 evidence](evidence/b-02-product-records.md) records domain and browser proof that `PLAN-B02` became stale while unrelated `PLAN-B03` remained current, retained-draft conflict recovery, proposal revisioning, restart persistence, Storybook states, accessibility and narrow layout.
- B-01 is complete for its local boundary. `./launch-machine` builds and serves the portal at `http://127.0.0.1:4310`; first-run owner setup happens in the browser without logging the key.
- [B-01 evidence](evidence/b-01-local-foundation.md) records unauthenticated rejection; owner setup/login and restart persistence; 67-document real-corpus import; 435 source relationships; idempotent re-import; changed-source revision testing; durable requests; search/detail UI; Storybook; build/typecheck; axe; and 390px browser checks.
- Angular 22 / Material 22 and explicit Storybook stories are now adopted for the portal implementation. SQLite is the tested zero-service local adapter; PostgreSQL remains the hosted-direction candidate. The database is authoritative for new mutable owner requests; Markdown remains seed/audit evidence and repository authority for code-adjacent contracts.
- The vendor-owned GitHub App flow has completed its first live organization trial. The portal binding is `ready` for private `aludel-workshop/aludel-workshop`; the active installation has all-repository access plus Administration/Contents write; local `main`, the portal record and GitHub `main` all resolve to baseline commit `6c54d7a`; 404 tracked files agree; and the ignored `.env`/PEM plus client secret are absent from the commit. Baseline inspection found a dangling tracked `apps/portal/node_modules` symlink and legacy `the-machine[bot]` attribution for follow-up. Organization/personal endpoint-token behavior, state/PKCE, JWT signing, redaction and recovery retain their local/mocked coverage. [Implementation and live evidence](design/process/enterprise-github-app-work-record.md).
- R-03, R-06B, and R-05 provide the bounded local Codex path, Symphony/Linear direction, and recovery protocol evidence for later B-03 integration.

2026-09-25: **LAY-05 run allowance and recovery checkpoint.** A cached `launch-lms-infra` Symphony revision was compared read-only. Aludel now reserves three one-turn runs per Go-pinned item; a restarted portal preserves the count and unfinished workspace edits. Focused tests pass; a real interrupted Codex turn is unproved. [Evidence and retrospective](evidence/lay-05-budget-recovery.md).

2026-09-25: **LAY-05 live retention check.** One tiny Codex turn submitted a disposable candidate through pinned Symphony. After terminal workspace cleanup and portal restart, exact-commit diff, named checks and isolated preview remained available; the shared project HEAD stayed pinned. [Evidence and retrospective](evidence/lay-05-live-retention.md). LAY-05 remains partial.

2026-09-25: **LAY-05 direct tracker checkpoint.** The owner selected Aludel polling with optional Linear/Jira sync; ADR-008 and architecture now reflect it. Project/profile worker tokens, Go-pinned bundles, HTTP polling/ID refresh, stale-input withdrawal and a pinned Symphony Elixir overlay and host-side workspace hook are built. Disposable Go → poll → refresh → stop and portal-restart checks pass; dispatch remains off by default. [Integration evidence and retrospective](evidence/lay-05-symphony-worker.md) · [adapter guide](../integrations/symphony/README.md).

2026-09-26: **WORK-AGENTS-01 worker-pool correction.** Manual pairing was removed from Work. A private per-project pool credential, profile-pinned task cards, 1–N-slot Go queue, and Deploy runtime status/capacity have disposable evidence. Local Symphony hosts now report one slot each for the two configured projects. Codex model/effort settings are pinned per task and the hosts report the override patch; other providers remain gated. Auto host startup, Elixir/live-turn proof, multi-host fencing and owner browser review remain open. [Evidence and retrospective](evidence/work-agents-01-worker-pool.md).

2026-09-26: **WORK-AGENTS-01 Symphony swap checkpoint.** Live Work Go dispatch uses only Symphony for ten explicit actions across seven layers; review-only proposals/reports and exact acceptance have disposable evidence. The portal is running with dispatch enabled, but W-4 has no paired worker and no live turn was started. Other actions remain gated; Elixir compile and owner browser review remain open; the owner approved retiring mapped legacy tests. [Evidence and retrospective](evidence/work-agents-01-symphony-swap.md).

2026-09-25: **WORK-AGENTS-01 Vision queue correction (superseded).** The owner’s targetless W-4 “write value prop” now stages through its verified connected-key Work batch and produces a Brief claim proposal for Product lead review. The Brief changes only on exact checked acceptance. Provider-stand-in tests and portal build pass; no live turn was started. This direct path is a usability bridge, not the final unified orchestrator. [Evidence and retrospective](evidence/work-agents-01-vision-queue.md).

2026-09-25: **WORK-AGENTS-01 audit slice built.** Go now pins a compact task card for code/security actions; Symphony audit attempts can read scoped knowledge, ask a blocking question and submit a read-only report for Work checklist review. Disposable audit/restart/coding regressions pass; host Elixir compile, real Codex audit, owner browser review and broader layer actions remain. [Evidence and retrospective](evidence/work-agents-01-audit-slice.md).

2026-09-25: **WORK-AGENTS-01 session contract proposed.** A short startup card, immutable task manifest, scoped knowledge search/read/link tools, durable question and typed submission workflow are specified. Security-audit and Vision-edit JSON fixtures use one shape; no new runner or live agent capability is claimed. Next: pure compiler/validator and parity with the existing Symphony and editor bundles. [Contract](design/work-agents/session-contract.md) · [work record](design/work-agents/work-record.md).

2026-09-25: **WORK-AGENTS-01 output-first correction.** The owner deferred the coding proof browser review after a manual security-audit task showed that its agent action has no runner. Layers are being assessed by their primary outputs, governing inputs, activity and review; the audit is the first non-code fixture. [Analysis](design/work-agents/layer-output-model.md) · [work record](design/work-agents/work-record.md). This is design evidence, not all-layer execution proof.

2026-09-25: **LAY-05 manual task creation bridge.** Work › Board now has Create task with role/action, brief, target, assignee, outputs and review checks. A brief reaches the structured runner; unsupported agent actions remain non-runnable. Typecheck, build and focused Work tests pass; the browser scenario is added but unrun because Playwright is unavailable locally. This is a planning and UX bridge, not all-layer agent execution. [Evidence and retrospective](evidence/lay-05-manual-task-creation.md). Owner browser review of the coding proof remains open.

## Completed packets

2026-09-29: **CUSTOM-LAYER-01 closed on owner acceptance.** The owner accepted the browser-reviewed custom Markdown layer candidate in chat ("all looks good"). It has one project-scoped definition reader, draft/active charter activation, one layer bar, and Tasks built from Work's components. Server tests 165/165; `layer-bar`, `markdown-editor`, `product`, `design` and `workflow` browser checks pass. The evidence is pinned at `6d43ed8` on `feature/custom-markdown-layer`, with the first checkpoint at `97fb422`. Agent discovery and browser person-run review remain unproved and are carried forward. [Closeout and retrospective](design/layer-app-transition/custom-markdown-layer.md#packet-closeout--owner-acceptance-2026-09-29).

2026-09-29: **LAT-07 local gate passed at candidate `3e1e848`.** Design, Data, Code and Deploy inventories, unavailable states, shared layer views and exact output revision reads are agent-checked; full server suite 145/145. [Evidence and retrospective](evidence/lat-07/README.md). Runtime migration and browser/owner comparison remain later gates.

2026-09-29: **LAT-06 local gate passed at candidate `cbe7601` under DEC-053.** Pages/Vision inventory, Code observation relation review and direct story-free Work path are agent-checked. [Evidence and retrospective](evidence/lat-06/README.md). Runtime permissions remain LAT-08 work.

2026-09-27: **WORK-ITEM-UX-01 live-run correction.** Browser Buddy W-3 proved that a blocking `stuck` objective could still submit a report and appear complete. `stuck` is now terminal; failed runs retain diagnosis but cannot be accepted; the UI centers diagnostic review and exposes the pinned action. W-3 now reads as failed with its original namespace error. Focused tests pass 9/9; typecheck/build and the restarted live read model pass. The trace also proved its generic security plan came from choosing `platform.security` for a hello-world task, not missing task context. A bounded context-usage procedure was added after the diagnosis itself consumed excessive model usage. [Evidence and retrospective](evidence/work-item-ux-01-build.md).

2026-09-27: **Symphony command-sandbox repair.** Docker's default seccomp profile blocked Bubblewrap inside both local workers. Hosts now use `seccomp=unconfined` with `no-new-privileges`, no privileged mode or added capabilities, and must pass a Bubblewrap smoke test before reporting started. Both workers and heartbeats pass; Browser Buddy read W-3's exact pinned commit through the repaired sandbox. No model run was started, so a new owner Go remains required for security assurance. [Evidence and retrospective](evidence/work-item-ux-01-build.md).

2026-09-27: **Work-item archival.** An explicit confirmed Archive task action now removes failed/test work from normal Work and blocker views while retaining its task, runs, reports, reviews and activity with archive actor/time. Active and genuinely reviewable work is refused. Focused tests pass 10/10; typecheck/build and restarted live schema checks pass. Browser Buddy W-3 is closed and eligible but was not archived by the agent. [Evidence and retrospective](evidence/work-item-ux-01-build.md).

| Packet | Result | Evidence |
|---|---|---|
| T03-DESIGN-SEED / T03-ADAPT | Design's starter kit and Look & feel sync come from its template's `seed`. Pages reads the kit through its own adapter and names no layer. Design reads no later layer. Final pins `design` `64e916f`, `pages` `96194a1` | [Evidence and retrospective](evidence/t03-design-seed-adapt/README.md) |
| T03-DESIGN | Design repository (`design` `bc36f24`) owns its views, Knowledge, rules and 9-operation API in records mode; shared rendering moved to the host app-kit SDK; Pages (`e693c19`) reads the kit from the Library; templates on 215/0 (7 explained skips), off 222/222; `design-layer` journey 5/5 | [Evidence and retrospective](evidence/t03-design/README.md) |
| T03-G3 / T03-VISION | Reviewed pins drive converted declarations/catalog; Vision repository owns its native view, Knowledge, and (since `ab021b0`) its record rules and 38-operation API; template-mode suite added and green | [Catalog and view](evidence/t03-vision/README.md) · [Rules, template-mode suite, host features](evidence/t03-vision-rules/README.md) |
| T03-DATA | Local template conversion checked; original-owner-data cutover remains a later gate | [Evidence and retrospective](evidence/t03-data/README.md) |
| WORK-AGENTS-01 | Bounded layer-origin → shared Work Go → proposal foundation and DEC-051 action contract accepted under DEC-052; disposable proposal itself remains in Review | [Trial](evidence/work-agents-01-lat-adapter.md), [action groundwork](evidence/work-agents-01-layer-actions-groundwork.md), [owner closeout](design/work-agents/work-record.md#2026-09-29-owner-closeout-and-lat-handoff) |
| LAT-05 | Exact-input Pages reconciliation utility plus one authorized agent Work handoff; no self-Go or flow before acceptance | [Evidence and retrospective](evidence/lat-05/README.md#2026-09-29-packet-closeout-after-work-handoff) |
| LAT-02 | Six built-in layer descriptors, membership-scoped reads and idempotent instance migration; candidate commit `ca2e771` | [Evidence/retrospective](evidence/lat-02/README.md) |
| LAT-01 | Isolated sibling candidate, local launcher and deterministic fixture; concurrent portal, database, cookie and preview separation checked; candidate commit `a799756` | [Evidence/retrospective](design/layer-app-transition/work-record.md) |
| PP-01R | Project-scoped read-only Codex bridge: Work → Team pairing, assigned tasks and live knowledge, saved context bundles, local MCP adapter; agent-checked on a disposable portal; owner live pairing pending | [Evidence/retrospective](evidence/pp-01r-editor-bridge.md), [guide](guides/co-work-with-codex.md) |
| PLATFORM-UX-01 | Platform split into **Code** and **Deploy**.

**Code:**
- Overview: structure and stack from the repository.
- Explorer: files → chunks, a read-only viewer, a story lens, and change requests to the Engineer.
- Tests: story → scenario → tests.
- Docs: AGENTS.md as the map; a starter set from the layers; section sources in a sidecar; refresh as Engineer work.
- Releases: recorded explicitly.

**Deploy:**
- Environments: Preview; Production not set up.
- Variables from `.env.example`, Integrations, and Data (the database tools).

New Operator role. Agent-checked: server 88/89 (1 pre-existing), all browser suites pass. Owner review pending (DEC-049) | [Evidence/retrospective](evidence/platform-ux-01-code-deploy.md), [work record](design/platform-layer/work-record.md) |
| PAGES-UX-01 | Pages as Map (a planning canvas with page blanks, drawn links, grid moves and flows edited on the canvas), Pages (specs from Design components; Spec and Built views; content edited in place; change requests become `platform.implement` work) and Flows (walkthroughs and `pages.review` reviews). Agent-checked; owner review pending (DEC-048) | [Evidence/retrospective](evidence/pages-ux-01-pages-layer.md), [work record](design/pages-layer/work-record.md) |
| DESIGN-UX-01 | Design as Tokens (a tree beside a live preview of real Angular Material components in the project's theme; three tiers; W3C design tokens), Components (contracts with slots, nesting, needed → specified → built, references, revisions), Brand (starter assets, templates) and Docs (Library documents shown in layers). Saved changes reach the generated app. Agent-checked (server 75/75, design browser suite); **owner accepted** (DEC-046) | [Evidence/retrospective](evidence/design-ux-01-design-layer.md), [work record](design/design-layer/work-record.md) |
| ROADMAP-01 | Product became **Vision**: the Brief (claims with confidence from evidence; riskiest assumptions), Story map, and Documents generated from the Brief. **Library**: sources, highlighted findings, insights, and evidence attached anywhere. **Work**: Items (Linear list with a side panel), Projects (Linear-style timeline, project briefs that replace specs, milestones with target dates, budgets), Next, Roles with the elevated shield and a review action per role, and Team. Rainbow layer colours with a tile nav; chips with quick views everywhere. Agent-checked (server 69/69, layers browser with axe and 390px, migration trial on a copy of real data); **owner accepted** (DEC-044) | [Evidence/retrospective](evidence/roadmap-01-product-and-plan.md), [work record](design/product-and-plan/work-record.md) |
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

2026-10-04: **JOURNEYS-01 closed (J8).** Codex's J8 repairs and task composer merged to `main`. Signup was not implemented: W-9's agent, limited to one layer, returned an assessment and a Pages follow-up, and the owner chose to open up agent work instead (AGENT-WORK-01, Claude Agent SDK). The agent-side check, prerequisite continuation and pre-start status move there. [Closeout and retrospective](design/journeys/work-record.md#j8-closeout-2026-10-04-claude-cloud-session).

2026-10-03: **J8 task creation built locally.** Owner accepted the composer and optional/multiple-journey assessment, then authorized the build (DEC-064). Shared UI and additive run assessment are built and running; W-8 is unchanged. Browser journeys, 22 focused Work checks, repaired worker compatibility checks and compiled adapter harness pass. Both full suites ran; their two historical-fixture failures were repaired and rerun. [Evidence and build retrospective](design/journeys/task-create/work-record.md#final-build-verification-and-closeout--2026-10-03). Next: owner reviews the built form and resumes [J8](design/journeys/j8-trial.md), including real agent pickup.

2026-10-04: **JOURNEYS-01 J7 built (cloud session, branch `claude/j6-prototype-ptl3we` from `main`).** *Check my branch* on person runs runs review's integration, build and journey step tests before submitting, on its own integration, and shows each step (passed, no test, failed, no fixture) and each claim's proof. A console line per journey walks it on the app's dev server with `ALUDEL_REVIEW_PREVIEW=1`. The repository review browser journey shows a failing and an uncovered step before submit, and review's re-run matching. Not built: the agent-side check (no Elixir toolchain here). [Run log](design/journeys/work-record.md#j7-person-check-2026-10-04-claude-cloud-session).

2026-10-04: **JOURNEYS-01 J6 built (cloud session, branch `claude/j6-prototype-ptl3we`).** The owner skipped a third prototype round and chose the suggested-work flow as proposed. Built: one persona per journey, targeted spec follow-ups with a merge-or-draft question and parked drafts, the preview walk script, and the review screen (one header line, evidence left by claim kind, a claim at a time right, walking advances steps). All four review browser journeys pass (uid 1000, Docker), including a two-step walk that advances by following a link in the preview; the Code template refuses mixed personas (`layer-base` `82cb9ef`, pinned). [Run log](design/journeys/work-record.md#j6-build-2026-10-04-claude-cloud-session).

2026-10-03: **JOURNEYS-01 J6 prototype v2.** The owner's round 1 reshaped the review: preview left and claim panel right (borrowed from Claude's artifact pane), walking the preview advances the steps, flags always carry a note, one claim card introduces and decides each claim, and journeys never mix roles (a model amendment the J6 build enforces). [v2](design/journeys/j6/v2/index.html) waits on round 2.

2026-10-03: **JOURNEYS-01 J6 prototype v1 (cloud session, branch `claude/j6-prototype-ptl3we` from `main`).** A static, walkable [walk-review prototype](design/journeys/j6/v1/index.html): steps rail, persona preview, spec and step-test proof, Previous/Proposed, FlowNote-typed notes that turn into follow-ups, claims across the top, Under the hood collapsed. Exceptional states sit behind a visible Scenarios panel. Its walkthrough passes axe at 1440 and 390 px. Waiting on the owner's answers to Q1–Q7; nothing in the portal changed.

2026-10-03: **JOURNEYS-01 J5 done (cloud session, branch `claude/compassionate-hamilton-wz7nwz` on top of J4's and J3's branches).**
- Creating a Code task asks Code whether the request reaches routes no journey covers. If it does, the form offers *Specify first*: draft the journey from the current app, or revise the journey that covers those routes.
- Specify claims the journey at its next revision, written as authored. Accepting is blocked until the reviewed build holds it. When the app isn't reviewable yet (recipe, persona fixtures, setup route), a once-per-app prerequisite item blocks the Specify item.
- Accepting a Specify run raises Implement. It claims only the steps the accepted build doesn't pass yet, and everything else is the unchanged-journeys invariant. The Pages binding trigger waits for LAYER-BINDINGS-01 step 4.
- **Checks:** the new contract and host tests pass (journeys 15, work runs 16, with two mutations caught). Typecheck and build pass. Without `layer-base` and Docker, both server suites were compared with J4's head: identical failure sets in both modes, all of them reading `layer-base`.
- **Exit evidence:** with `layer-base` and Docker approved, the browser journey on a disposable imported app passes. It runs create, Specify, review build, accept and Implement raised, and it caught four UI defects, now fixed. Both server suites pass; the templates suite's two load timeouts pass alone. 21 of 22 browser scripts pass. `browser`'s stale-decision step is intermittent and fails at J4's head too, so it is pre-existing.
- **Restart effect:** none beyond J4's claims migration (still pending for the owner).
- **Process:** the handoff now says to get `layer-base` and Docker approved at session start, and that Code's layer key is `platform`.
- [Run log](design/journeys/work-record.md#j5-specify--implement-2026-10-03-claude-cloud-session).

2026-10-03: **JOURNEYS-01 J4 done (cloud session, branch `claude/nice-cray-zn7gfg` on top of J3's branch).**
- A Work item's criteria are claims with stable IDs: `journey`, `record`, `invariant`, or an unbacked `note`. Verdicts, evidence and send-back feedback name claims, not positions.
- A journey claim is proven by its steps' results on the reviewed build. A claim that isn't proven stops acceptance: an agent run goes back with its failing steps; a person run may be accepted only if the person said why when submitting.
- **Deviation from the plan:** the gate sits at acceptance, not at the agent's submit call, because results exist only after the host builds the review. A pre-submit check joins J7.
- **Restart effect:** item criteria become `note-<n>` claims and saved run verdicts move to claim IDs. This was rehearsed on data written by the pre-J4 code; tell the owner before they restart.
- Both server suites pass (286/0, and templates 309/0). The final templates rerun had one load-timing failure, a portal startup over 60 s, which passes alone. Typecheck, build, all 22 browser scripts, and the repository-review check (extended for claims) pass.
- **Process:** `tools/branch-handoffs.sh` lists branches ahead of `main` (AGENTS.md now says to run it first). The handoff records the exact runner-image commands.
- [Run log](design/journeys/work-record.md#j4-claims-2026-10-03-claude-cloud-session).

2026-10-03: **JOURNEYS-01 follow-ups (owner chat).**
- Installing Code into a repository that already has `.aludel/` reads its files in; a conflicting version of Code's own code is refused.
- Code's docs sidecar and the setup choices moved into `.aludel/`. Images exclude `.aludel/`, so every preview build proves the app builds without it.
- Every server test passes (templates off and on), and every remaining browser check passes.
- Two real bugs found behind stale checks are fixed: legacy routes returned 500 after the project database split, and the work item page overflowed at 400px.
- Superseded browser scripts are retired (`lat03`–`06`, `layers`, `onboarding`, the last pending the onboarding redesign).
- Code template `08d26c9` is pushed to `layer-base` `code` (owner's go, 2026-10-03).
- [Run log](design/journeys/work-record.md#j3-follow-ups-aludel-adoption-seams-failing-tests-2026-10-03-claude-cloud-session).

2026-10-03: **JOURNEYS-01 J3 done (cloud session; Biome's steps move to J8).**
- Review steps now come from journeys (`<journey>.<step>`), and the v2 recipe maps personas to fixtures. The host runs each journey's step tests black-box, in a Playwright runner container whose only network is the candidate, and records a result and screenshot per step.
- Generated apps no longer read or copy `.aludel/` at runtime, and they declare their seams. Review warns about undeclared ones.
- Step results don't block acceptance yet (J4).
- The Docker review test covers a passing, uncovered, failing and skipped step and a missing persona fixture.
- With `layer-base`: typecheck, build, both server suites, and the browser journeys `code-layer`, `roles`, `bindings` and repository-review all pass. The exceptions also fail at the baseline commit in that sandbox: 3 worker tests and the `pages` journey.
- **New findings:** Code can't install into a repository that already has `.aludel/outputs/journeys.json`. Code's own `docs/.aludel/sources.json` is an undeclared seam.
- **Restart effect:** a review whose app still has a v1 recipe stops opening until the recipe is v2. Only Biome's unmerged candidate has one.
- [Run log](design/journeys/work-record.md#j3-journey-proof-2026-10-03-claude-cloud-session).

2026-10-02: **Code tracing removed (DEC-063), before J3.** Story ↔ code links, link-based unit states, Reconcile items, trailer, test-name and manifest links, and `builtBy` are gone from the host and the Code (`aaef4cf`), Pages (`ceeb9d4`), Data (`d2e11ec`) and Vision (`a912d44`) templates. Pages show planned, skeleton or specified from their own record. Spec edits are direct and code changes are requested explicitly until the user-journeys binding. The design is boxed up in [code-tracing/deferred.md](design/code-tracing/deferred.md). Inert SDK shims keep existing installs' old views compiling. **Restart effect:** the `trace_links` table is dropped, and existing projects' Pages, Data, Vision and Code views stop showing links, Built status and Reconcile context. Their templates stay on their old forks. [Run log](design/journeys/work-record.md#code-tracing-removed-2026-10-02-claude-vs-code-chat).

2026-10-02: **JOURNEYS-01 J2 done.** Code template `cc30be2` adds journeys (`outputs/journeys.json`, a journeys facet, a Journeys tab, Knowledge). The host now treats a file-kept template kind as the template's own, and the new indexer digest is registered. Both suites and the code-layer, bindings and roles journeys pass. The `layers` browser journey fails on the J1 baseline too (pre-existing). **Restart effect:** none for existing projects. Template pins reach new installs only, so Biome needs a template update path before J8 (new gap). [Run log](design/journeys/work-record.md#j2-code-template-2026-10-02-claude-vs-code-chat).

2026-10-02: **JOURNEYS-01 J0–J1 done.** Codex's repository integration and guided preview work is committed (both suites and typecheck/build pass). The rejected standalone trial tool is removed. J1's pure journey contract is in place: journeys, v2 recipe, claims, coverage, seams, and step IDs that survive reordering. Finding: a generated app has 14 Aludel seams, and its Dockerfile copies `.aludel/review.json` into the runtime image; J3 removes that. [Plan, run log and retrospective](design/journeys/work-record.md). T03-CODE remains the next action; J2 waits for its owner look.

2026-10-02: **Shared repository review and guided Code previews implemented locally.** Review combines a submission with the accepted repository head, runs applicable checks and accepts only that exact current revision. Code builds on review opening; criterion buttons prepare synthetic app sessions and exact destinations. [Evidence and retrospective](evidence/repository-review/README.md) distinguish agent checks from owner acceptance and unmeasured disk budgets. Native review renderers remain LAT-08A work; T03-CODE is still the one next action.

2026-10-01: **LAYER-BINDINGS-01 step 2 built; owner review, then step 3.**
- Owner decision: no `peer`. Bindings have a clear authority direction, and changes made outside the binding are drift, which the binding adopts, rectifies or has assessed.
- Building step 2 showed that the contract's "replica" needs a stored copy. Pages now keeps one. Without it, a live read can't apply changes, drift, or work without Design.
- The browser journey caught a switched-off Design being read as deleting everything. Bindings now hold while a participant is off.
- Open for the owner:
  - review Library › Bindings and Pages' new behaviour (no kit until the binding is accepted; it keeps the kit with Design off);
  - whether existing projects move to the new Pages template.

[Record and handoff](design/layer-bindings/work-record.md#handoff-for-the-next-session).

2026-10-01: **LAYER-BINDINGS-01 step 1 built; step 2 next.** Writing the walkthroughs as exact fixtures exposed four gaps the prose contract left open:
- an undefined `peer` role, now defined (owner to confirm);
- the need for a baseline per spoke;
- content a replica stops keeping must move to the new authority;
- how a sent-back change is represented.

Open for step 2:
- Pages-as-authority needs Pages to publish its kit;
- comparable digests come from each receiver's adapter.

Commit `layer-base` `main` before forking Design and Pages from it. [Record and handoff](design/layer-bindings/work-record.md#handoff-for-the-next-session).

2026-10-01: **LAYER-BINDINGS-01 contract agreed; implementation handed to a new session.** The owner's model:
- layers start with no inputs and import what they discover;
- contracts are per facet pairing, at project level;
- authority can move between layers;
- a layer's copy of a concept is the authority, a replica its own work needs, or ceded.

The owner agreed the contract: one binding per shared concept with many participants, mechanical changes auto-apply, bindings shown in a Library tab, and authority chosen per project. [Record and handoff](design/layer-bindings/work-record.md). T03-CODE follows step 2.

2026-10-01: **T03-DESIGN-SEED and T03-ADAPT completed locally; T03-CODE next.**
- Owner direction, 2026-09-30:
  - layer-scoped Work, with no actions, for every layer;
  - Design's starter belongs in its template;
  - sources keep their own shape and each consumer owns an adapter; build only that boundary for now.
- Layer seeds are part of the contract: `api.seeds` and `seed(event, context)`, checked like operations.
  - Design seeds its kit and follows the Look & feel itself.
  - Start-up on unseeded projects went from 5.4 s to 3.3 s.
- Pages reads the kit through `ui/pages-kit-adapter.ts`, with links to the source layer and Library entries. The host app kit only renders.
- Next steps for the connection idea: wire connection records to adapter sources, and let routines propose adapter changes.
- [Evidence and retrospective](evidence/t03-design-seed-adapt/README.md).

2026-09-30: **T03-DESIGN completed locally; T03-CODE next.**
- Candidate `f2fb8be` pins `design` `bc36f24`, `pages` `e693c19` and base `61565cf`.
- Design keeps its kit (tokens, components, brand) as records through its own API:
  - its rules are ported unchanged;
  - parity holds for all 28 seeded records;
  - cross-record rules run in the handler through `x-aludel-context`.
- The main design question went to the default. Shared rendering is now the host SDK `@aludel/host/app-kit`, which takes kit data and knows no layer.
- Pages reads the kit from the Library (`data=1`) and gets an empty kit when Design is off.
- New named host features: `uploads`, `brandTemplates` and `libraryRecords`.
- Process change: `tools/typecheck-layer-ui.mjs`. The frame build exits 0 with type errors in it.
- Results:
  - templates on: 215 pass, 0 fail, 7 explained skips;
  - templates off: 222/222;
  - the `design-layer` journey passed 5/5, and seven other journeys pass.
- Owner answers, 2026-09-30: layer-scoped Work is accepted for every layer, with no per-action catalogs. Design's starter seeding belongs in its template (done: T03-DESIGN-SEED).
- Limit: each handler call is one sandboxed child process (about 22 ms), so first-time seeding costs about 0.9 s per project.
- [Evidence and retrospective](evidence/t03-design/README.md).

2026-09-30: **T03-VISION completed with its rules in the layer; T03-DESIGN next.**
- Candidate `ab021b0` pins `vision` `eac6132`:
  - `server/vision-api.mjs` and a 38-operation API replace the portal's Vision validators.
  - Parity holds for every stored Vision record.
  - Records that sit under another name their parent (`x-aludel-parent`).
  - Existing records join their instance.
- Frames request named host features (`hostCalls`) instead of matching layer keys.
- Views write in order, which fixed a lost-note race in the Pages Map (journey 2/4 → 4/4).
- New `npm run test:server:templates` runs the target mode. It found and closed two Data-as-files gaps (Work targets and the close check).
- Results: templates off 217/217; templates on 210 pass and 7 explained skips; seven template browser journeys pass. The `layers` journey is stale (fails identically on `7ceebd7`).
- Owner questions:
  - Is DEC-057 layer scoping for Vision Work acceptable? It removes the `product.*` actions and per-style presets.
  - Should other Map and Flow edits get the latest-revision treatment?
- [Evidence and retrospective](evidence/t03-vision-rules/README.md).

2026-09-30: **T03-G3 and T03-VISION local checkpoints; T03-DESIGN next.** Pin-derived catalog/declarations preserve compiled Design, Code and Deploy choices and templates-off compatibility. Candidate `7ceebd7` pins Vision repository `ac96e2f`, which owns its manifest, Knowledge and native frame; disposable new/existing project, Library, stable-record and browser journeys passed. [Evidence and retrospective](evidence/t03-vision/README.md). Owner comparison and original-data cutover remain LAT-09/10 gates.
