---
id: JOURNEYS-01
kind: work-record
status: active
updated: 2026-10-03
depends_on: [T03-CODE, LAT-08A, LAYER-BINDINGS-01, EXISTING-PROJECTS-01, DEC-050, DEC-057]
---

# JOURNEYS-01: journey-driven Work and review

## Authorization and scope

- **2026-10-02, owner chat (planning).** After a design discussion on Codex's guided Code previews, the owner wrote: "spec then implement makes sense. draw up the implementation plan, including cleaning up codex's work." Authorized: this plan and the pointers to it (LAT-08A, status ready queue). No code, template, commit or live-data change. Each slice below needs the owner's go.
- T03-CODE remains `next_action`. This packet is proposed for the ready queue after it.
- **2026-10-02, owner chat (J0–J1):** "yeah, go for it." Authorized: J0 (re-run checks; commit Codex's uncommitted LAT-08A integration and Biome work as one commit; remove the rejected standalone trial tool; condense status and procedure text) and J1 (pure contract modules and tests). Both are local and committed to `main`. The proposed defaults stand. Not authorized: template pins (J2+), the live Biome item, pushes, restarts of the owner's portal, and the untracked candidate checkouts or `notes.txt`. Same message: "the code editor tabs need to be re-evaluated. the general structure of code is enough to work from." Recorded as an input to J2: the Journeys view joins Code's current structure without redesigning its tabs, and re-evaluating the tabs is a separate UX pass.
- **2026-10-02, owner chat (J2):** "t03-code is fine for now. go j2". This waives waiting for T03-CODE's owner look before J2. Authorized: a journeys facet on `layer-base` `code` (declared output, Journeys view, Knowledge), a new template commit and its pin in this repository, local checks, and commits to both repositories. Not authorized: pushes, restarting the owner's portal, the live Biome item, and J3+ wiring. A pin change makes existing projects adopt on their next restart; the owner is told what changes first.
- **2026-10-02, owner chat (tracing removal, before J3):** "we're pulling the tracing. box it up, lets revisit at a later phase. don't need it mvp". Asked how far, the owner chose "remove entirely. truth is, those links were not following our new binding approach anyways." Authorized: record the tracing design in a deferred record ([code-tracing/deferred.md](../code-tracing/deferred.md)). Then remove story ↔ code tracing from the host and templates: trace links, suspect and untraced states, Reconcile items, commit-trailer and test-name links, generation-manifest links, `builtBy` and everything it drives (Pages Built status, Data status from links, Vision "Built by" chips, release Ships stories, the page-delete guard). Code units, Explorer and reachability stay. Includes template commits and pins, local checks and commits. No compatibility shims are needed (owner: early stage). Planned J3b (observed traces) is dropped from this packet.

- **2026-10-03, owner chat (J3, cloud session):** "hey, can you pick up the task as specified in docs/design/journeys/handoff.md". Authorized, per the [handoff](handoff.md): J3 in the same local scope as J0–J2. That covers host code, tests, template commits and pins, local checks, and commits plus a push to this session's designated branch (`claude/brave-pascal-br7h4i`), which the cloud session requires. Not authorized: pushes to `main` or `layer-base`, deployment, spending, live owner data (Biome, the owner's portal), and owner-impersonating actions. Recorded before execution.

- **2026-10-03, owner chat (after J3):** "i honestly dont care about biome, its just a throw away test project, we coulduse any project to test. seperate playwright tester: like it. now the problems, worth addressing. if code is being installed into a repo with .aludel already, it needs to be attempt to read that in instead of just overwriting fresh. and for the docs outside of .aludel, any chance we can bring that in? are there cases where something reallly has to live outside of .aludel, or is that just legacy holdover? also, failing tests. can you either fix or remove (if they are testing outdated assumptions?)". Authorized, in the same local scope as J3 (host code, tests, template commits and pins if needed, commits, pushes to this session's branch):
  1. Biome is no longer required evidence; any disposable project serves.
  2. The separate Playwright runner is accepted.
  3. Installing Code into a repository that already has `.aludel/` adopts what is there.
  4. Move the Aludel files outside `.aludel/` in where possible, and say what really has to stay outside.
  5. Fix the failing tests, or remove those that test outdated assumptions.

- **2026-10-03, owner chat (J4, new cloud session):** "can you grab j4?". The J3 handoff said J4 needs the owner's go; this is it. Authorized: J4 in the same local scope as J3: host code, tests, template commits and pins if needed, local checks, and commits plus a push to this session's designated branch (`claude/nice-cray-zn7gfg`, started from J3's `claude/brave-pascal-br7h4i` at `6f89df0`, which isn't on `main` yet). Not authorized: pushes to `main` or `layer-base`, deployment, spending, live owner data (the owner's portal), owner-impersonating actions, and restarting the owner's portal. The claims migration runs on the owner's next restart, so the owner is told before it. Recorded before execution.

## Owner direction (2026-10-02 chat)

1. **The reviewer deals with interaction and feel, not diffs.** For user-facing work the review is walking the journey in a live preview, with automated proof alongside.
2. **Information is written once.** A flow describes what should happen. Tests, preview steps, review steps and docs derive from it. They aren't hand-matched copies.
3. **Spec, then implement.** Changing a journey is two Work items. *Specify* outputs the journey record. Accepting it raises *Implement* for that revision.
4. **Connecting an existing repository takes more than connecting.** Working with an app the Aludel way brings Aludel's opinions into it: user journey specs, a design kit, a review seam. They live in `.aludel/` and are adapted to act on the actual app, so the app can be separated from Aludel easily.

## Process first

**What this revealed.** The same intent had been written down four or five times: Vision story acceptance, Pages flow steps, free-text Work criteria, `.aludel/review.json` scenarios and repository tests. People linked them by hand. The scenario-to-criterion link was a zero-based index into free text, so reordering the criteria silently pointed the review buttons at the wrong claims. The criteria came first and the review mechanisms were added to fit them piece by piece.

**Process change.** If a review criterion restates something a layer already describes, it is a **reference** to that entry at a revision, not new text. Free-text criteria remain, but they are marked *unbacked*, because each one is a gap in some layer's spec. J1 tests this as a contract (an index-keyed recipe is rejected). J8 tests it in practice: the owner creates the onboarding item without writing criteria. Until J8 passes, this is a hypothesis.

**Separability check.** "`.aludel/` is separable" is a claim that needs proof. J1 adds a check: with `.aludel/` removed and the declared seams reverted, the app still builds and passes its own tests.

## Model

### 1. What lives in `.aludel/`

```
.aludel/
  layer.json, outputs/ …            existing (T03-CODE)
  outputs/journeys.json             the journeys facet (authored, observed or replica); J2
  journeys/<file>.spec.mjs          black-box browser proof, one test per step; J3
  seams.json                        every place Aludel touches the app outside .aludel/
  review.json  (v2)                 build target, checks, persona → fixture map
```

- The app never imports from `.aludel/`. Journey tests are **black box**: they drive the running candidate over HTTP through a browser and never import app code. That keeps them stack-agnostic and separable.
- **Seams** are the few things Aludel needs inside the app. Today that is the preview-only setup endpoint `/api/__aludel/review`. Generated apps also have `aludel.json`, `src/aludel-bridge.ts` and `docs/product.md`. Each seam is declared with its path and how to remove it. Moving generated apps' root files under `.aludel/` is a separate question (see Open decisions).
- The same pattern carries the next opinion, a design kit replica adapted onto the app's real styles. J1 includes it as a second pure fixture of the general operation; building it is out of scope here.

### 2. The journeys facet

```
journey: { id, title, persona, origin: authored | observed | replica, revision, source?: { layer, entry, revision },
  steps: [{ id, name, page?, route?, persona?, story?, trigger, expected, test?: "<spec>#<step-id>" }] }
```

- Step IDs are stable across revisions. An inserted step gets a new ID, and existing steps keep theirs.
- **Observed** journeys are reconstructed from the code. A **characterization test** that passes on the accepted head proves an observed journey describes real behavior. Without one it is a hypothesis.
- **Authored** journeys are signed by a person through a *Specify* item, or arrive from an authority through a binding.
- With Pages installed, the "user journeys" binding (LAYER-BINDINGS-01 step 4) makes Pages' flows the authority. Code keeps a stored replica, imported by its own adapter. Without Pages, Code's facet is the authority, and Pages can later import it as observed drafts.
- Personas map to fixtures in `review.json`, for example `newcomer → { fixture: "fresh", session: null }`. This replaces Codex's per-scenario `role`.

### 3. Claims replace hand-written criteria

A Work item's criteria become **claims** with stable IDs:

| Kind | Subject | Review instrument | Automated proof |
|---|---|---|---|
| `journey` | Journey at a revision, plus the changed steps | Walk the steps in the preview, Previous against Proposed | Step tests on the integration build |
| `record` | A layer entry at a revision | The layer's own tab, Previous/Proposed (LAT-08A) | The layer's validators |
| `invariant` | "Existing journeys unchanged", or a named metric | Regression summary | Every journey test, plus the metric |
| `note` | Free text (*unbacked*) | Reviewer judgment | None |

- `appearance` (design kit specimen) is the next kind, out of scope here.
- Run evidence is keyed by claim ID, and journey evidence by claim ID plus step ID. This replaces the index-based evidence in [task-manifest.mjs](../../../apps/portal/server/task-manifest.mjs) and [work-runs.mjs](../../../apps/portal/server/work-runs.mjs).
- Existing items migrate their `checks` text to `note` claims. That migration runs on restart, so the owner is told before restarting.

### 4. Specify, then implement

1. **At creation.** Code's Knowledge matches the request to routes. When no journey covers them, it offers: *Draft "New user onboarding" from the current app first?* Trivial changes skip this.
2. **Make the app reviewable (once per app).** If the setup endpoint or a persona's fixture is missing, Code raises this prerequisite item. It is an `invariant` claim plus checks: the endpoint returns 404 outside preview mode, and an inbox stub exists where the journey sends mail. It is kept separate because it touches auth.
3. **Specify.** The output is a journey record change. The agent writes the characterization test (passing on `main`), records the observed journey, then proposes the target steps. The reviewer can walk the current journey on the accepted build. The proposed side is text unless Pages exists.
4. **Implement.** It is raised when the journey's revision is ahead of what the code builds, either by accepting *Specify* or, with Pages as authority, by a flow publish through the binding. Its claims are the journey's steps, fixed at Go. The agent turns the characterization tests into the new step tests and builds the change. An agent run can't submit while a claimed step's test fails.
5. **After acceptance.** The journey is authored and built at that revision. Its tests guard every later `invariant` change.

### 5. Review: walk the journey

- A steps rail (with the changed steps marked) next to the embedded preview, entered as the step's persona through the existing one-use scenario links.
- For each step: the spec (Pages thumbnail when a replica exists) and the test's screenshot with its pass mark. Notes use `FlowNote`'s types: looks right, content, change, question. A *change* note becomes follow-up Work with its layer chosen.
- Previous/Proposed runs the accepted head and the integration side by side. The existing two-runtime cap already covers that.
- **Under the hood**, collapsed: changed files, checks, the diff. A reviewing-agent signature on code is a later packet.

### 6. People doing the work

- **Check before submit.** A *Check my branch* action on the person run runs the same integration, journey tests and coverage report that review will show (✓ covered, — uncovered, ✗ failing, missing fixture). It reuses the host path from Codex's person submission. A local command shipped in `.aludel/` comes later.
- **Walk locally.** The setup endpoint also works under the app's dev server with an explicit preview flag, so a person can walk the journey as each persona before submitting.
- The host re-runs everything on the integration, so a person's own report is never the evidence.

## Cleaning up Codex's work

Codex's LAT08A-INTEGRATION-01 and BIOME-REVIEW-01 changes are uncommitted on `main`, about 630 lines across 25 tracked files plus new ones.

| Keep (sound machinery) | Replace | Remove or trim |
|---|---|---|
| Integrate repository-writing layer Work against the accepted head; accept only the exact reviewed commit ([layer-source.mjs](../../../apps/portal/server/layer-source.mjs), [work-runs.mjs](../../../apps/portal/server/work-runs.mjs)) | `review.json` v1 `scenarios[].criterion` (index) and `role`: scenarios now come from journey steps, plus v2's persona → fixture map ([review-previews.mjs](../../../apps/portal/server/review-previews.mjs)) | `tools/local-review-trial.mjs`: a standalone trial page the owner rejected; its evidence stays as history (removed in J0) |
| On-demand exact-image builds; runtime cap, idle stop, scoped retention ([review-previews.mjs](../../../apps/portal/server/review-previews.mjs), [previews.mjs](../../../apps/portal/server/previews.mjs)) | The scaffold's generated recipe, which gives every page `criterion: 0`; generated apps get journeys from their Pages flows instead ([scaffold.mjs](../../../apps/portal/server/scaffold.mjs)) | The long status "Next for the owner" item 3 and handoff, condensed at J0 |
| Preview-only setup endpoint, one-use 60-second links, partitioned preview cookies | The per-criterion scenario filter in [work-review.ts](../../../apps/portal/src/layers/work-review.ts), replaced by journey claims in J4 and J6 | The Biome-specific paragraph in the [operating procedure](../process/operating-procedure.md): reduce it to the general rule |
| Person-run repository submission with a pinned base | Biome's candidate branch: regenerate its recipe as v2 plus journeys in J3 | |
| [portal-support.mjs](../../../apps/portal/tests/portal-support.mjs), [repository-review-browser.mjs](../../../apps/portal/tests/repository-review-browser.mjs), [review-previews.test.mjs](../../../apps/portal/tests/review-previews.test.mjs) | | |

Not Codex's work, and left alone: the untracked `custom-layer-candidate/`, `lat08-candidate/`, `layer-template-pages/` and `pages-template-candidate/` checkouts (dated 2026-09-29), and the owner's `notes.txt` edit. The owner decides what happens to the checkouts.

v1 recipes need no migration. Only Biome's unmerged candidate uses one, and v1 was never committed.

## Slices

Every slice runs `npm run test:server` and `npm run test:server:templates`, plus `apps/portal/tools/typecheck-layer-ui.mjs` on any template pin.

| Slice | Scope | Exit evidence |
|---|---|---|
| **J0 Baseline** | Re-run Codex's checks on the current tree. Commit its work as one LAT-08A integration commit, without unrelated changes. Remove the standalone trial tool. Condense the status and procedure text. | Both suites and typecheck/build pass; one reviewable commit; the owner agrees to commit |
| **J1 Contract (pure)** | Schemas and validators for journeys, `seams.json`, `review.json` v2 and claims. Derive scenarios from journey steps. Separability check. Fixtures: a Biome-style flow replica (Pages authority), an observed onboarding journey (Code only), and a design-kit facet as the second instance of "opinion adopted into `.aludel/`" | Node tests; index-keyed recipes rejected; separability check passes on a generated app and fails when an undeclared seam exists |
| **J2 Code template** | A journeys facet on `layer-base` `code`: declared output, a Journeys view (steps, coverage, origin), template pin | Template typecheck, both suites, the code-layer journey |
| **J3 Journey proof** | Make `journeys/*.spec.mjs` writable package files (not authority). The host runs them black-box against the candidate in the existing bounded check sandbox and records a result and screenshot per step. Review steps come from journeys. Scaffold and Biome move to v2. | `review-previews.test.mjs` extended to cover a failing step, an uncovered step and a missing persona fixture; Biome's three steps open from journeys |
| **J4 Claims** | Claims with stable IDs on items and runs; evidence keyed by claim and step; a `note` migration for existing items; the submit gate for agent runs | A migration rehearsal on copied data; both suites; the owner warned before restart |
| **J5 Specify → Implement** | The offer at item creation; the reviewable-app prerequisite; *Specify* with a characterization test; *Implement* raised on acceptance (and later by the binding) | A browser journey on a disposable imported app: create a request, specify, accept, implement raised with step claims |
| **J6 Walk review** | **Prototype round first** (UX pass method), then build the steps rail, persona preview, spec and test evidence, Previous/Proposed, FlowNote notes, collapsed Under the hood | Owner accepts the prototype; the built view passes axe at 390px and wide, using visible controls only |
| **J7 Person check** | *Check my branch* on person runs; dev-server walk flag | A disposable person run shows uncovered and failing steps before submit; the host re-run matches |
| **J8 Owner trial and closeout** | The owner runs (1) Biome Work #3 as a journey claim and (2) the imported onboarding scenario on a Code-only project. Evidence, retrospective, status. | Owner actions in the normal UI (no agent impersonation); retrospective answering the five closing questions |

J1 can start before T03-CODE closes. J2 onward changes the Code template that T03-CODE just pinned, so it starts after T03-CODE's owner look.

## Proposed defaults (owner may change)

1. ~~A failing claimed step test blocks agent submission.~~ **Changed in J4:** a claimed step that isn't passing on the reviewed build blocks **acceptance** of an agent run, because step results exist only once the host builds the review. A person may submit with a stated reason, and the reviewer sees the failure and the reason first and may accept. A pre-submit check is J7's *Check my branch*, for agents as well as people.
2. One *Implement* item per journey, grouped under the publish or *Specify* item that raised it.
3. The diff stays reachable under Under the hood. A reviewing-agent signature on code is a later packet.
4. ~~Journey tests use Playwright in the check image.~~ **Changed in J3:** journey tests run in a host-owned runner image (Playwright's own, about 920 MB, pulled once per machine), not the app's check image. That keeps Playwright out of the app, so `.aludel/` stays separable and non-Node apps work. See the J3 run log.

## Open decisions

- **Generated apps' root files.** Move `aludel.json`, `aludel-bridge.ts` and `docs/product.md` under `.aludel/`, or keep them as declared seams? Recommendation: declare them in J1 and decide after J1 shows what reads them.
- **The design kit** as the next opinion, after J8: same facet pattern, with an `appearance` claim and specimen review.

## Relation to other packets

- **LAT-08A:** the guided-scenario contract ("Shared integration and guided review requirements") is superseded by J1, J3 and J4 for scenario identity. Its integration, build and lifecycle requirements stand. Native layer renderers for `record` claims remain LAT-08A.
- **LAYER-BINDINGS-01 step 4 (F10):** the Code ⇄ Pages binding becomes the "user journeys" binding defined here. J5's binding trigger waits for it, and *Specify* covers the Code-only case without it.
- **EXISTING-PROJECTS-01:** EX-02's inventory still applies. EX-03's single reconstruction slice becomes lazy: journeys are reconstructed per Work item and proven by characterization tests, not mapped up front.
- **PLATFORM-PIPELINE-01 / PP-01D:** imported apps with multiple services or unusual runtimes still need app-defined environments before they can be previewed.

## Risks and reversal evidence

- **Imported apps whose auth resists synthetic sessions** (SSO only, third-party identity): the reviewable-app prerequisite may be expensive. If J5's fixture app can't get a newcomer session cheaply, *Specify* still works (spec plus characterization test), but the walk review falls back to anonymous steps.
- **Brittle black-box tests.** If step tests flake above a few percent in J3, the submit gate becomes a warning until the tests are stabilized.
- **Claims migration.** Existing items keep their text as `note` claims, so nothing is lost. If owners keep writing `note`s for things a layer describes, the reference-first rule isn't working and the creation UI needs to offer references more strongly (measured in J8).

## Readiness

J0–J4 are done (below; J3's Biome evidence moves to J8). J4's gate sits at acceptance, not at the agent's submit call (see the J4 run log). J5–J8 depend on each other as listed. J6 needs a prototype round before building. No external effect, spending or live-data change is planned before J8, and in J8 the owner performs the live actions.

## Run log

**Handoff (2026-10-02):** the next agent starts at [handoff.md](handoff.md).

**Push authorization (2026-10-02, owner chat):** "option 1. push please." Scope: push `aludel-workshop` `main` to its existing GitHub remote (a public repository), and create a private `aludel-workshop/layer-base` repository holding the template repository's seven branches. Before pushing, the added content was scanned for credentials (none found). Nothing else is authorized: no deployment, spending or other repositories.

### J0 baseline and J1 contract (2026-10-02, Claude, VS Code chat)

**J0.**
- Re-checked Codex's uncommitted LAT08A-INTEGRATION-01 and BIOME-REVIEW-01 work on the current tree; results are below.
- Committed it as one commit, together with the cleanup:
  - removed `tools/local-review-trial.mjs` and repointed its two mentions to git history;
  - condensed status "Next for the owner" item 3 and the Biome paragraph in the operating procedure to its general rule.
- Before staging, scanned Codex's evidence logs and scripts for credentials: none, only synthetic `.invalid` accounts.
- Excluded the owner's `notes.txt` edit and the four untracked candidate checkouts.

**J1.** [journeys.mjs](../../../apps/portal/server/journeys.mjs), with [tests](../../../apps/portal/tests/journeys.test.mjs) and [fixtures](../../../apps/portal/tests/fixtures/journey-cases.json). It holds:
- journey, v2 recipe, claims and seams validators;
- review steps derived from journeys, by step ID;
- per-step coverage;
- `standing` (authored / observed / hypothesis), general over facet entries;
- implement claims from a Specify change;
- the criteria → note migration;
- the static half of the separability check.

Nothing is wired into the live review path yet; that is J3 and J4.

| Check | Result |
|---|---|
| `node --test tests/journeys.test.mjs` | 9 passed |
| Mutation check (step tests counted as spec changes; v1 recipes allowed through when only `scenarios` is present) | The matching 2 tests failed, then passed again once the code was restored |
| `npm run typecheck`, `npm run build` | Passed; the earlier optional-chain and bundle-size warnings remain |
| `npm run test:server -- --test-concurrency=4` (Codex's tree, before J1 existed) | 276 passed, 31 mode-specific skips, 0 failed |
| `npm run test:server:templates -- --test-concurrency=2` (with J1) | 309 passed, 7 skips, 0 failed; includes the 9 journey tests |

**Findings.**
- **14 files in a generated app name Aludel outside `.aludel/`**, now pinned as the declared-seams fixture. Most are attribution. The real couplings are:
  - the Pages bridge, with its import and `data-aludel-page` attributes;
  - the setup route;
  - CI's test-results artifact;
  - `aludel.json`, `docs/agents.md` and `docs/product.md`.
- **The generated Dockerfile contradicts itself.** It says "nothing here depends on Aludel" but copies `.aludel/review.json` into the runtime image, because Codex's setup route reads the recipe at runtime. In v2 the host sends the persona's fixture and session in the setup call, so J3 removes that runtime read and the COPY. These findings feed the open decision on generated apps' root files.

**Retrospective (J0–J1).**
1. *Harder than necessary:* Codex's work arrived uncommitted and mixed with owner edits and four old untracked checkouts. Its scope had to be reconstructed file by file before it could be committed.
2. *Would help next time:* commit each authorized slice when its checks pass, rather than leaving it in the working tree.
3. *What the task revealed:* the separability claim was already false for generated apps in one place (the runtime read of `.aludel/`). The static scan found it in seconds, so J3 should run the scan in review. J3 also gains a concrete step: drop the runtime recipe read.
4. *Questions:* the generated root files decision now has data (14 seams, 4 of them whole files). It doesn't block J2–J3.
5. *Process change:*
   - **Applied:** the reference-first criteria rule, as a contract: v1 recipes are refused and step IDs survive reordering. **Hypothesis:** whether people use references in practice, until J8.
   - **Applied:** the separability check's static half, tested on a real generated app. **Pending:** the build-without-`.aludel/` half (J3).

### J2 Code template (2026-10-02, Claude, VS Code chat)

Template `layer-base` `code`: `9fac012` (the journeys facet), then `cc30be2` (step-list spacing). This repository pins `cc30be2`.

- **Output.** `outputs/journeys.json` holds kind `journey`, following Code's existing `outputs/` convention. The host reads output files from a fixed list, so one file per journey wasn't available without a host change. An entry's ID is `journey-<id>`, so a journey written straight into the repository needs no Aludel ID. The indexer keeps a copy of the host's journey contract, since template code imports nothing. A new host test checks that both accept and refuse the same journeys at the pinned commit.
- **Facet.** `journeys` (authority or replica, shape `aludel.code-journeys`), so the user-journeys binding can contract on it. No references to pages, stories or personas yet; the binding maps them.
- **View.** A Journeys tab inside Code's current structure, as the owner asked. It lists journeys with origin and tested-step counts. A journey's detail shows provenance (observed with a proof commit, or a replica's source), its steps with routes, personas and test chips, and a change request that becomes Work. It uses the host's roles module, so a replica facet shows "Managed in …" and hides the request. [Screenshot](../../evidence/journeys/code-journeys-tab.png).
- **Knowledge.** `knowledge/journeys.md` and two charter lines (journeys; Aludel stays separable).
- **Host.** Two changes:
  - A kind a template keeps as files with its own indexer is now the template's own, as an API kind already was. Before, Code's `journey` was refused as an unknown output kind. This is the general rule, not a journey exception.
  - The new indexer's digest is registered in `config/layer-reviewed-sources.json`. The old digest is kept for existing installs.
- **Tests.** The Code browser journey now also opens Journeys empty, commits a journey into the app repository as Work would, syncs, and checks the detail, coverage and test chips, with axe.

| Check | Result |
|---|---|
| Template `node --test tests/*.test.mjs` | 14 passed, including the roles contract the first draft missed |
| `typecheck-layer-ui.mjs` at `9fac012` and `cc30be2` | Passed |
| `node --test tests/journeys.test.mjs` | 10 passed (adds host/template agreement) |
| Code browser journey (`code-layer`) | Passed with Journeys |
| typecheck, build | Passed (existing warnings) |
| `npm run test:server -- --test-concurrency=4` | 284 passed, 33 mode-specific skips, 0 failed |
| `npm run test:server:templates -- --test-concurrency=2` | 310 passed, 7 skips, 0 failed |
| Browser `code-layer`, `bindings`, `roles` (templates on) | Passed. The new facet raised no unexpected binding proposals |
| Browser `layers` (templates on) | **Failed** waiting for a Vision link in the layers nav. It **fails the same way on the J1 baseline** (old pin and host), so it isn't caused by J2. Pre-existing, not investigated here |

**Findings.**
- **Template updates don't reach existing installs.** A pin bump affects new installs only. Existing Code instances, Biome included, keep the template commit they were forked from, and there is no update path. So a portal restart changes no live project, but Biome gets no journeys until template updates exist. J8's Biome trial needs a template update path, done as reviewed Work on the instance's repository. That is a new prerequisite, and it isn't scheduled.
- **The digest registry wasn't on the checklist.** The browser journey failed with "indexer … has not passed review" until the digest was registered. Neither the template's "Adding a file output" recipe nor the AGENTS checklist mentioned it.
- **Code's Tests tab has its own naming convention.** It links Vision acceptance scenarios to tests by name (`S4/2 · …`), a convention-based match. Journey steps use explicit test references. Reconciling the two is follow-up (it touches the Tests tab the owner wants re-evaluated anyway).

**Retrospective (J2).**
1. *Harder than necessary:* three host constraints surfaced one at a time, each only at runtime: the output-kind registry, the reviewed-digest registry, and the roles contract for facet views. The first two were found by the browser journey, the third by the template's contract test.
2. *Would help next time:* the checklist now says to register digests and run the layer's browser journey ([AGENTS.md](../../../AGENTS.md) current focus). A template contract test that fails when a declared file kind has no host acceptance would catch the first constraint earlier. It isn't built yet.
3. *What the task revealed:* the missing template update path, which affects J8 and any future template change for existing projects.
4. *Questions:* how existing instances take a template update (merge as reviewed Work, or a fresh fork). This blocks the Biome part of J8, not J3–J7.
5. *Process change:* **applied:** the digest step on the checklist. **Tested:** only in the sense that the browser journey passes once it's done; that the checklist line prevents the miss next time is a hypothesis. **Applied:** the general file-kind rule, tested by the Code journey and both suites.

### Code tracing removed (2026-10-02, Claude, VS Code chat)

Owner direction and scope: see the authorization above, [DEC-063](../../decisions.md) and the [deferred record](../code-tracing/deferred.md).

- **Host.**
  - `code-links.mjs` became `code-units.mjs`: units, references and reachability only, and `trace_links` is dropped.
  - Removed from `server.mjs`: manifest links on build, the Reconcile route and relink, `builtBy` (the knowledge view, release stories, the page-delete guard) and Ships on GitHub release bodies.
  - `code-repository.mjs` keeps units and releases.
  - Release drafts read only `Aludel-Work` trailers, suggest a minor version for new migrations, and name no stories.
  - Candidates stop writing `Implements:`.
  - The scaffold's generation manifest and `accountsBinding` are gone.
  - `trace_link` is out of the legacy declaration, projections and discovery.
  - LAT-07's `platform.reconcile` is retired. The Engineer role's trailer conventions are removed, and its historical "Reconcile changed code" record stays, because projects copied it and the legacy inventory must account for it.
  - Data status is proposed or contracted.
  - The Work item view drops the Reconcile panel, and Home's Code card drops "suspect".
- **SDK compatibility (deliberate).** `built-by` renders nothing and `ctx.builtBy()` is always empty. Units keep `state` (current or unused) and an empty `links`. Existing installs keep their old template forks, because template updates don't reach them, and those forks' views import these. Removing them would break their frames on restart.
- **Templates (`layer-base`).**
  - Code `aaef4cf`: no trace links. Units are used or unused, the lens and "Why it exists" are gone, Tests lists the repository's tests with CI, and releases name no stories. Knowledge and the migration ledger are updated, and the indexer digest is registered.
  - Pages `ceeb9d4`: status from the page record (planned, skeleton, specified); spec edits are direct and a code change can always be requested; the running-app view is always offered as "App"; no Built by.
  - Data `d2e11ec` and Vision `a912d44`: no Built by.
  - Every view type-checks, and only views, manifests and docs changed in Pages, Data and Vision (no handler digests).
- **Docs.** DEC-063; the model docs mark code links removed (dated work records keep their history).

| Check | Result |
|---|---|
| Template tests: Code, Pages, Data, Vision | 13, 16, 6, 9 passed |
| `typecheck-layer-ui.mjs` at each new pin | Passed. The first Code pin failed on a leftover `r.stories` and was amended before pinning |
| `npm run typecheck`, `npm run build` | Passed |
| `npm run test:server` | First run: 1 failure. The legacy inventory must match the historical role records, so the Engineer's "Reconcile changed code" record was restored. It is still marked retired. Rerun: 283 passed, 30 mode-specific skips, 0 failed |
| `npm run test:server:templates` | 306 passed, 7 skips, 0 failed |
| Browser `code-layer`, `data-layer`, `vision-layer`, `roles`, `bindings` | Passed |
| Browser `pages` | First run failed on the removed built-only "Request this change". The script now uses "Request as a code change" and "App" (exact), and it passes |

**Retrospective (tracing removal).**
1. *Harder than necessary:* tracing reached into five places that don't say "trace": Pages' Built gating, Data status, release Ships, the page-delete guard, and SDK types compiled into older forks. A grep for the feature's name found under half of it. The rest surfaced by following `builtBy` and checking each consumer.
2. *Would help next time:* the missing template update path made a removal a compatibility exercise. Until it exists, any host SDK removal needs an inert shim and a note, as done here. That's now recorded in the deferred record and DEC-063.
3. *What the task revealed:* Pages' "built → change request" routing was a stand-in for the spec-first binding. Without tracing, the honest interim is explicit requests, which makes LAYER-BINDINGS step 4 (user journeys) more urgent for Pages users.
4. *Questions:* when the SDK shims can go (after template updates); whether Pages wants a cruder "in the running app" signal before the binding. Not blocking J3.
5. *Process change:* none beyond the shim note; the existing checklist (digest, typecheck, suites, browser journeys) caught every break. **Tested:** the typecheck caught the leftover `r.stories` before pinning.

### J3 journey proof (2026-10-03, Claude, cloud session)

Authorization: see 2026-10-03 above. Host-side only; no template commit was needed (J2's Journeys view already shows test references).

**Built.**
- **Writable step tests.** `journeys/<file>.spec.mjs` and `seams.json` are package-own writable files, not authority ([layer-package.mjs](../../../apps/portal/server/layer-package.mjs)). A change to only the review inputs (`review.json`, `seams.json`, `outputs/journeys.json`, step tests) still counts as an app change that needs the combined build (`reviewInputPath` in [journeys.mjs](../../../apps/portal/server/journeys.mjs), used by Work runs and the worker).
- **Recipe v2 in review.** `reviewRecipe` (v1) is gone. `reviewInputs` reads the commit's `.aludel/review.json` (validated as v2), `.aludel/outputs/journeys.json` and `.aludel/seams.json`, and derives review steps with `reviewSteps`. Step IDs are `<journey>.<step>`. A step that can't be opened (no route, persona or fixture) says why, and opening it is refused ([review-previews.mjs](../../../apps/portal/server/review-previews.mjs)).
- **Setup call.** The host sends `{ journey, step, persona, fixture, session, reset }`. The generated app's setup handler uses only that and no longer reads `.aludel/review.json`. Its Dockerfile no longer copies it, so the "nothing here depends on Aludel" comment is now true. Generated apps emit `review.json` v2 (a `visitor` persona, plus `member` with auth) and `.aludel/seams.json` ([scaffold.mjs](../../../apps/portal/server/scaffold.mjs) `generatedSeams`, equal to the J1 fixture). **Deferred:** generating journeys from Pages flows. A newly generated app has no journeys, so its preview offers no guided steps until Code's Journeys holds one. The old per-page scenarios all claimed `criterion: 0`.
- **Step runner** ([journey-runner.mjs](../../../apps/portal/server/journey-runner.mjs), [runner script](../../../apps/portal/server/journey-runner/run.mjs), [image](../../../apps/portal/server/journey-runner/Dockerfile)). **Design point decided:** check containers keep `--network none`. Step tests run in a separate runner container on a per-run `docker network create --internal` network. The preview joins that network as `candidate` for the run only, so the runner reaches the candidate and nothing else, not even the internet (tested, and a mutation that drops `--internal` is caught). The setup token never enters the runner. The host makes each journey's setup call itself and hands over only the session cookies. Inside, a local forwarder serves the candidate as `http://localhost:<port>`, a secure context, so the preview's `Secure; Partitioned` session cookies work as they do for a reviewer (over `http://candidate` Chromium dropped them, even with `--unsafely-treat-insecure-origin-as-secure`). A journey is walked from its first step as that step's persona. Each step reports passed, failed, skipped (after an earlier failure), uncovered (no test) or no-fixture, with a JPEG screenshot after each run step. Results are kept per build (`layer_review_journeys`) and screenshots under `review-steps/<id>/`. The runner's report is treated as untrusted: only planned step IDs and bounded fields count.
  - **Step test contract:** `.aludel/journeys/<file>.spec.mjs` default-exports `{ '<test id>': async ({ page, assert, step, baseURL }) => … }`. It is black box and imports nothing. It is written into the agent guidance ([task-manifest.mjs](../../../apps/portal/server/task-manifest.mjs)).
  - **Gate:** step results are evidence next to the checks, not a check, so a failing step doesn't block acceptance yet. That is J4's submit gate (proposed default 1).
- **Review UI.** The Preview tab lists steps grouped by journey, each with its open button, expected result, persona, test status, failure detail and a screenshot link. A criterion now links to "Walk N journey steps in Preview" instead of index-matched buttons ([work-review.ts](../../../apps/portal/src/layers/work-review.ts)). Claims-based stepping stays J4.
- **Separability.** Review preparation runs the static scan on the candidate commit (`git grep` plus file names, against `.aludel/seams.json`). Undeclared files are shown as a warning, not a failing check. **Follow-up:** the build-without-`.aludel/` half isn't cheap. It is a second full image build per review, and edit seams' removal is prose, so they can't be reverted mechanically. It stays a follow-up for J5's reviewable-app prerequisite or a later packet.

**Environment (this session).** `layer-base` couldn't be cloned: the session's GitHub access doesn't cover that private repository. Node 24 came from npm (`node@24`, v24.21.0). Docker was started by hand. Docker builds here can't reach npm, so the runner image was built once out of band, through the session proxy and with the same Dockerfile content, under the tag the host computes. That is a sandbox workaround, not product behaviour.

| Check | Result |
|---|---|
| `node --test tests/review-previews.test.mjs` (Docker) | 2 passed. It covers a passing step, an uncovered step, a failing step with its reason and screenshot, a later step skipped after the failure, a journey whose persona has no fixture, a step persona without a fixture mid-journey, no internet from the runner, `Secure; Partitioned` session cookies, v1 refused, offsite routes refused, and an undeclared coupling found. Repeated 6×, all passed; no step networks left behind |
| Mutation: runner network without `--internal` | The test failed (`read.view`), then passed once restored |
| First harness design (cookies via a route-fulfilled 303) | Flaky: 3 of 6 navigations timed out in a probe, against 0 of 6 for direct navigation. Replaced by `addCookies` plus a direct visit before the suite runs above |
| `tests/journeys.test.mjs`, `tests/layer-package-root.test.mjs` | Journeys 9 passed (the generated app emits v2, its seams equal the fixture, and its Dockerfile and server don't read `.aludel/`); 1 skipped (no `layer-base`). Layer-package: J3's writable and authority test passes; its 4 failures are template-dependent and fail identically on the baseline |
| `npm run test:server` without `previews-docker` (Docker builds can't reach npm here), baseline `80d5bc5` vs J3 | Baseline 231 passed, 47 failed, 31 skipped; J3 231, 47, 31. **Identical failure sets**, all needing `layer-base` |
| `npm run test:server:templates`, same comparison | Baseline 98 passed, 43 failed; J3 98 and 43. **Identical failure sets.** Only 141 tests register, because several files abort at load without `layer-base` |
| Typecheck (`ngc`, with the git-ignored Pages UI stubbed because `sync:layers` needs `layer-base`) | No errors; J3 adds no warnings and removes one |
| `vite build` (same stub; the stub also needs an empty `pages.scss`) | Passed |
| **Not run here** (need `layer-base` or the owner's machine) | `typecheck-layer-ui.mjs` (no template pin changed), the layer browser journeys, and `tests/repository-review-browser.mjs` (updated to v2 and journeys, unverified) |

**Follow-up run with `layer-base` (same session, after GitHub access was fixed).** Pins verified present, at `layer-base` `main` cloned from GitHub.

| Check | Result |
|---|---|
| `npm run typecheck`, `npm run build` (real template sync) | Passed; no warnings in `work-review` |
| `npm run test:server` (without `previews-docker`) | 275 passed, 3 failed, 31 skipped. The 3 failures (`symphony-worker` and `symphony-proposals`: a run reports `failed` where `running` is expected) fail identically at baseline `80d5bc5` in this sandbox, so they're environmental |
| `npm run test:server:templates` (same files) | 297 passed, 4 failed, 8 skipped: the same 3, plus "Work staging…", which timed out under load and passes on its own (66 passed) |
| Browser `code-layer`, `roles`, `bindings` (templates on) | Passed |
| Browser `pages` | Fails with a portal `ECONNRESET`, **also at baseline** in this sandbox. Pre-existing here; not J3 |
| `tests/repository-review-browser.mjs` | **Passed**: steps open from journeys as author and viewer, axe, 390px, serial integration and person review. Run as a non-root user: as root, the preview's root-owned `/data` mount stops the app user writing its database, which is a sandbox artifact. [Screenshot](../../evidence/journeys/j3-review-journey-steps.png) |

**Findings from the follow-up.**
- **Installing Code into a repository that already has `.aludel/outputs/journeys.json` fails.** The template ships `{ "journeys": [] }`, and `read-tree --prefix` refuses the overlap. The browser check now commits its journeys after Code installs, as Work would. An imported app that already carries Aludel files (one that left and came back, say) can't adopt Code until install merges or skips existing output files. This is new and not scheduled; it belongs with EXISTING-PROJECTS-01 or the template update path.
- **The separability scan found a real undeclared seam in Code itself.** Code's Knowledge writes `docs/.aludel/sources.json` (`sidecarPath` in [code-layer.mjs](../../../apps/portal/server/code-layer.mjs)) outside the top-level `.aludel/`. It's evidence for the open question on generated apps' root files: move it under `.aludel/`, or have Code declare it in `seams.json`.

**Exit evidence status.** The `review-previews.test.mjs` part is met. "Biome's three steps open from journeys" isn't: Biome's candidate is owner data and out of reach, as the handoff expected. It moves to J8, and it needs Biome's `.aludel/` regenerated as v2 plus journeys and the template update path. With the follow-up run, J3's checks pass apart from failures that also occur at baseline in this sandbox. The Biome part moves to J8. J3 is **done, apart from Biome**. The retrospective below covers both runs.

**Retrospective (J3).**
1. *Harder than necessary:*
   - The private `layer-base` wasn't reachable from the cloud session, so every template-dependent check became a before/after comparison instead of a pass count.
   - Docker builds here can't reach npm.
   - The obvious way to hand cookies to the browser (a route-fulfilled redirect) was flaky. A loop probe found that in minutes, before it reached the suite.
2. *Would help next time:*
   - Give cloud sessions access to `layer-base`, or vendor a pinned snapshot for tests, so the handoff's prerequisite 1 holds anywhere.
   - Probe a browser mechanism in a loop before building on it: one passing run proved nothing here.
3. *What the task revealed:*
   - Running step tests in the app's check image (proposed default 4) would have put Playwright into the app and broken separability, so the runner is host-owned.
   - Preview cookies are `Secure`, which forces a secure-context origin for automated walks.
   - Newly generated apps lose guided steps until journeys are generated from Pages flows. That makes the Pages → journeys generation, or the user-journeys binding, more pressing.
4. *Questions:*
   - Should a failing step block acceptance before J4's claims exist? Not here: J4 decides.
   - Should undeclared seams fail review? Warned only, for now.
   - The runner image is about 920 MB, pulled once per machine. That is acceptable at zero cost, but the owner may prefer a slimmer one.
5. *Process change:*
   - **Applied:** the [handoff](handoff.md)'s environment prerequisites now name the cloud access gap and the Docker-build workaround.
   - **Tested:** the before/after failure-set comparison is how this run separated environment failures from regressions.
   - **Hypothesis:** whether the step-test contract is easy for agents to follow, until an agent writes one in J5.

### J3 follow-ups: `.aludel/` adoption, seams, failing tests (2026-10-03, Claude, cloud session)

Authorization: see the 2026-10-03 "after J3" entry above. Biome stops being required evidence; any disposable project serves (the J3 exit evidence already uses disposable fixtures).

**Installing into a repository that already has `.aludel/`.** Install now reads in what is there instead of failing on the first overlap. `installPlan` in [layer-package.mjs](../../../apps/portal/server/layer-package.mjs) sorts the template's files into three groups:
- **Adds:** files missing from the repository.
- **Kept:** files the repository already keeps in `.aludel/`, such as outputs, Knowledge, docs, `review.json`, `seams.json` and journeys. They are read in as the layer's own. The install commit lists them.
- **Conflicts:** the repository holds a different version of the layer's own code or manifest (`server/`, `ui/`, `api/`, `tests/`, `layer.json`). Install refuses with 409 and names the files, because that code runs on the host and only the reviewed template's version may. A repository with a whole package (`.aludel/layer.json`) is still bound as it is.

The import check shows the same plan (Aludel adds, keeps, or can't import until a conflict is moved), and Import is disabled while there is a conflict ([public.html](../../../apps/portal/src/public.html)).
- **Tested:** a new `layer-package-root` test covers a conflicting test file, then keeping a charter and `review.json` while adding the rest, with the kept files named in the commit. The repository-review browser check now commits its journeys before Code installs, as the app's own, and passes.

**What lives outside `.aludel/`, and why.** Each generated seam was checked against what reads it.

| Seam | Verdict | Done now |
|---|---|---|
| Code's docs sidecar `docs/.aludel/sources.json` | Legacy: it's Aludel's provenance record, not an app doc | Moved to `.aludel/doc-sources.json` (Code template `08d26c9`, pinned; indexer digest registered, old digests kept). The legacy compiled module reads the old path and moves it on its next write. Forks pinned earlier keep their own `layer.json` path |
| `aludel.json` (setup choices) | Legacy: nothing reads it, and only generated docs point at it | Moved to `.aludel/setup.json`; README, AGENTS map and agent guide updated |
| Docker build context | `.aludel/` had no reason to enter the image | `.dockerignore` excludes `.aludel`, so **every preview build is now the "builds without `.aludel/`" half of the separability check** for generated apps (J3 had deferred it) |
| Preview setup route in `server/server.mjs` | **Must stay.** It runs in the app's process to mint the app's own sessions and fixtures | Declared seam. It could move into its own file to shrink the edit; not done |
| Pages bridge (`src/aludel-bridge.ts`, its import, `data-aludel-page`/`-section` attributes) | **A feature seam.** It is how Pages points at sections in the running app. The script could be injected by the preview proxy instead of shipped in the app, but the markup attributes would remain | Unchanged; proposal below |
| README, AGENTS.md, `docs/agents.md`, `docs/product.md` | **The app's own docs**, seeded by Aludel. They belong outside; they are seams only because they mention Aludel | Unchanged; they could be made Aludel-neutral |
| Comments in `site.ts`, `page-blocks.ts`, `styles.scss`, the Dockerfile and CI | **Attribution only** | Unchanged; they could be dropped |

**Failing tests.**
- **Server suites.** One test compared the task compiler against source loaded from commit `f6adc8e`. That was a one-time equivalence check from the move to layer sources, and it fails in any shallow clone. Removed; the rest of the test stays. The other worker and proposal tests that failed with it pass now.
- **`pages` journey.** The portal used Node's 5-second keep-alive timeout, so a client reusing an idle connection could hit a socket the server had just closed (ECONNRESET). The portal now keeps idle sockets for 65 seconds, and the journey passes.
- **Legacy B-01 workspace** (`brand`, `browser`, `github`). PROJECT-DB-01 moved Aludel's own records into its project database, but the unscoped legacy routes (`/api/overview`, `records`, `requests`, `proposals`, `decisions`, `dependents`, `imports`, `product-state`, `work`) still queried the whole store and got 500s. They now run as the `the-machine` project. Also:
  - the dependency list moved to the milestone plan's panel, so `browser.mjs` navigates there;
  - Reassess had no visible confirmation on that view, so it now shows one.
- **`work-item`.**
  - The side column could overflow 400px wide screens (a grid without a bounded column), now fixed.
  - The fixture's personal item used the retired `work.milestone` action, so migration blocked it; it now uses a current action.
- **`design`** checks the compiled Design view, which serves only while templates are off. It now declares `// browser-checks: templates off`, which `tools/browser-checks.sh` honours.
- **Retired** (outdated assumptions; in git history):
  - `lat03`–`lat06`: hand-run LAT proofs on fixed candidate ports, with repo-root paths and since-changed record APIs.
  - `layers`: the LAY-02/03 sweep of compiled views, now covered by each layer's own template journey.
  - `onboarding`: the flow already changed (a Layers step, no Features step), and the owner is redesigning it.

**Results (2026-10-03; Docker running; repository-review run as a non-root user, as explained above).**

| Check | Result |
|---|---|
| `npm run test:server` (without `previews-docker`, whose app build needs npm inside Docker) | 280 passed, **0 failed**, 30 mode-specific skips |
| `npm run test:server:templates` | 303 passed, **0 failed**, 7 skips |
| `tests/review-previews.test.mjs` (Docker) | 2 passed |
| Code template tests at `08d26c9`; `typecheck-layer-ui.mjs` at `08d26c9` | 13 passed; passed |
| `npm run typecheck`, `npm run build` | Passed |
| `tools/browser-checks.sh` over every remaining browser script, templates on | **All 22 pass**: bindings, brand, branding, code-layer, data-layer, design (templates off, as declared), design-layer, github, kit, knowledge, layer-bar, layer-scope, library, loopback, markdown-editor, pages, product, roles, vision-layer, work-item, workflow, browser |
| `tests/repository-review-browser.mjs` | Passed, with the app's journeys read in at install |

**Pushed:** on the owner's go ("push", 2026-10-03), Code template commit `08d26c9` was pushed to `aludel-workshop/layer-base` `code` as a fast-forward from `aaef4cf`.

**Retrospective (follow-ups).**
1. *Harder than necessary:*
   - Most of the "failing tests" weren't caused by the code under test. They came from untracked drift: a test reading old git history, browser scripts written for one-off candidate portals, a shell that renamed its navigation, a moved dependency list, and a retired action used as a fixture.
   - Nothing ran the whole browser set, so the drift accumulated unseen.
2. *Would help next time:*
   - Run `tools/browser-checks.sh` over every script (not a hand-picked list) at each slice's closeout. This run is the baseline: all green.
   - A script that needs a non-default mode declares it in its header.
3. *What the task revealed:*
   - Two real product bugs hid behind "known failing" checks: the legacy workspace returned 500s after the project database split, and the work item page overflowed on phones.
   - A known-failing check is a bug report that stopped being read.
4. *Questions:*
   - Should the Pages bridge script be injected by the preview proxy, so apps don't ship it?
   - Should seeded app docs drop their mentions of Aludel?
   - The onboarding redesign needs its own browser check.
5. *Process change:*
   - **Applied:** the closeout runs the full browser set. The "templates off" marker is honoured by the runner. **Tested:** this run.
   - **Hypothesis:** that the next slice keeps it green.

### J4 claims (2026-10-03, Claude, cloud session)

Authorization: see the 2026-10-03 "J4" entry above.

**Design, decided before building.**
- **Claims live where criteria lived.** A Work item's `checks` entries become claims: each keeps its text and verdict fields and gains a stable `id`, a `kind` (`journey`, `record`, `invariant`, `note`) and `backed`. Keeping the stored field avoids renaming every action boundary that reads `checks`; the contract is J1's `validateClaims`.
- **IDs.** Free-text claims are `note-<n>`: the lowest number the item isn't using and didn't use before this edit. A note keeps its ID while its text is unchanged, so carried-in feedback that names an ID never points at different words. Editing a task's criteria changes only its `note` claims; backed claims are edited in their layer, never in the item.
- **Verdicts and evidence are keyed by claim ID.** A request may still name a criterion by position (`verdict.index`); it is resolved to the claim ID when the request arrives, so nothing is stored by position. Agent and person evidence name `claim` (and `step` for a journey claim). A run pinned before the migration has no claim IDs in its bundle, so its claims read as `note-<position + 1>` and its evidence may still use `criterion`. These are the same IDs the migration gives the item.
- **Journey evidence is per claim and step.** A journey claim's proof comes from the J3 step results on the run's reviewed build: passed, failed, uncovered, no fixture, or not run. The `journeys-unchanged` invariant that `implementClaims` emits gets the same treatment over every unclaimed step.
- **The gate sits at acceptance, not at the agent's submit call. This deviates from the plan.** Step results exist only after the host builds the review, which happens after the agent submits; running a Docker build and walk inside the agent's submit call would hold its tool call for minutes. So an agent run can't be **accepted** while a claimed step isn't passing on the reviewed build; the reviewer sends it back, and the failing steps go back to the agent as feedback. A person run may be accepted over a failing claimed step only when the person stated a reason for that claim when submitting; the reviewer sees the failure and reason first (proposed default 1). A pre-submit check for agents reuses J7's *Check my branch* path, and is recorded as a J7 input.
- **Migration on restart.** Item claims get IDs, and saved run verdicts move from positions to claim IDs. Bundles and step history stay as they were and are read through the rule above. The migration is idempotent and leaves a log entry on each item it changes.

**Built.**
- **Contract** ([journeys.mjs](../../../apps/portal/server/journeys.mjs), [tests](../../../apps/portal/tests/journeys.test.mjs)):
  - `claimAt` reads a stored criterion or claim as a claim, and `taskClaims` gives a run's pinned claims in order.
  - `nextNoteId` numbers new notes. `claimText` gives a backed claim its words.
  - `claimProof` proves a claim from a build's journeys and step results. `claimGate` lists what stops acceptance.
  - `claimsFromCriteria` now numbers `note-<n>`. `implementClaims` marks `journeys-unchanged` as `covers: 'journeys'`, so it is proven by every unclaimed step.
- **Items** ([knowledge.mjs](../../../apps/portal/server/knowledge.mjs)):
  - `createWork` takes `claims` (backed, validated) beside free-text `checks`, up to forty in all.
  - Editing a task or amending it after a question changes only its notes. Each unchanged note keeps its ID, and a new note never takes the ID of one the edit removed. Review of the diff caught that reuse; the first draft had it.
  - Verdicts name a claim (`verdict.claim`, or a position resolved on arrival). Send-back feedback carries the claim ID.
  - The restart migration runs once.
- **Runs** ([work-runs.mjs](../../../apps/portal/server/work-runs.mjs)):
  - A run's task lists claims, and saved verdicts are keyed by claim ID.
  - Agent evidence must name `claim` (and may name `step`); a pre-J4 bundle may still name `criterion`. Person evidence names `claim`, and a person may give a reason per claim that has step tests (`reasons_json`).
  - Each run carries `proofs` and `gate`, from `layer_review_journeys` on its reviewed integration and the journeys at that commit.
  - `sign` refuses acceptance while the gate holds. Send-back notes include each unproven claim's failing steps and their test details.
  - If the build's journeys can't be read, the proof says why instead of "not run".
- **Agent card** ([task-manifest.mjs](../../../apps/portal/server/task-manifest.mjs)): `task.claims` with IDs replaces `task.criteria`. Evidence is asked per claim ID, and the card says that a claimed step failing or untested blocks acceptance.
- **Review UI**:
  - [work-review.ts](../../../apps/portal/src/layers/work-review.ts) steps through claims. Each shows its kind; a note is marked unbacked. A claim with step tests shows its proof per step, with screenshot links and the person's reason. Sign-off lists the claims that block acceptance and disables *Sign and accept*, offering *Sign and send back*, or says which unproven claims a person's reasons cover.
  - [work-run.ts](../../../apps/portal/src/layers/work-run.ts): the person's submit form has evidence per claim, plus an optional reason for each claim with step tests. The next-run editor shows backed claims read-only and edits notes only.
  - [Claim with its proof and reason](../../evidence/journeys/j4-review-journey-claim.png) · [sign-off over a stated reason](../../evidence/journeys/j4-review-signoff.png).

**Migration rehearsal** (exit evidence; [scripts and output](../../evidence/journeys/j4-migration-rehearsal/README.md)). Phase A ran the pre-J4 code (`6f89df0`, in a separate worktree) and wrote a fresh data directory with three items:
- an agent run, submitted, with evidence naming criterion 1 and verdicts by position;
- a person run in review, with evidence and a verdict by position;
- a ready item with three criteria.

Phase B started the J4 code on a copy of that directory:
- **Items:** every criterion became `note-<n>`, keeping its text, with one log line each.
- **Runs:** verdicts moved to the claims they named (`{1: reject}` → `note-2`), and both runs' evidence read as `note-2`.
- **Send-back:** the migrated agent run was sent back, and its feedback carried `note-2`.
- **Restart:** a second start changed nothing; log lengths and verdicts were equal.

This is a rehearsal on data the old code wrote, not on the owner's live data, which is out of scope. The owner restarts after reading the notice in the handoff. The rehearsal was rerun on the final code and passed.

**Findings.**
- **The plan's submit gate wasn't buildable as written.** Step results exist only after the host builds the review. Running a Docker build and walk inside the agent's submit call would hold its tool call for minutes, so the gate is at acceptance (see Design). An agent that wants to know before submitting needs the J7 *Check my branch* path.
- **A recipe the host can't read made every journey claim look "not run".** The J4 test fixture had an invalid recipe (no checks) and showed nothing else wrong. The proof now names the error.
- **The newest handoff wasn't on `main`.** `main`'s status and handoff said "J3 next", while J3 and its follow-ups were done on another session's unmerged branch. That branch turned up only by listing sessions. Starting from `main` would have redone J3.
- **The repository-review browser check hid its own failures.** When the portal died at startup, the check's `finally` waited for an exit that had already happened, and Node reported only "unsettled top-level await". It now prints the portal log and doesn't wait on a finished process.
- **Startup and handler time limits are load-sensitive.** Two tests failed once each under suite load and passed alone: `symphony-worker`'s portal startup (60 s) in the final J4 run, and a Vision template test at baseline. Neither failed twice. If either recurs, it's a real limit to raise or a slowdown to find.
- **A Vision template test failed once at baseline under load** ("The layer API handler did not finish within its limits", 63 s). It passed alone at baseline and in the J4 run. It's a load-sensitive limit, recorded here in case it recurs.

**Environment (this session).**
- J3 and its follow-ups were on `claude/brave-pascal-br7h4i`, not `main`. This branch was reset to that branch's head (`6f89df0`) before any change.
- `layer-base` was cloned from GitHub after adding it to the session. Node 24.21.0 came from the npm package `node@24`. `dockerd` was started by hand.
- The journey runner image was built out of band through the session proxy, under the tag the host computes. The [handoff](handoff.md) now has the exact commands; J3's note didn't, so they had to be reconstructed.
- The Docker-preview browser check ran as uid 1000 on a copy of the repository.
- The baseline ran from a separate worktree at `6f89df0`.

| Check | Baseline `6f89df0` | J4 |
|---|---|---|
| `tests/journeys.test.mjs` | 10 passed | 12 passed (adds claim IDs by position, and proof and gate) |
| `tests/work-runs.test.mjs` | 10 passed | 14 passed: the restart migration (once, keeping text and verdicts), IDs through task edits, the agent gate, and person proofs from a build's step results (passed, failed, stale, and excused by a reason) |
| Mutation: the gate in `sign` disabled | | Both gate tests failed, then passed once restored |
| Mutation: the item migration skipped | | The migration test failed, then passed once restored |
| `npm run test:server` (without `previews-docker`) | 279 passed, 1 failed, 30 skipped. The failure was the Docker review test: the runner image can't be built in this sandbox | **286 passed, 0 failed, 30 skipped**, with the runner image prebuilt. The Docker review test passes |
| `npm run test:server:templates` (same files) | 301 passed, 2 failed, 7 skipped: the Docker review test, and the Vision template test under load, which passes alone | **309 passed, 0 failed, 7 skipped** |
| `npm run typecheck`, `npm run build` | | Passed; no new warnings |
| `tests/repository-review-browser.mjs` (uid 1000, Docker) | | **Passed**, extended for J4. The person's item claims a journey step without a test. The person states why in the visible submit form. Review shows the claim's proof ("No test") and the reason, and sign-off says it signs over one unproven claim with a reason. Acceptance then goes through |
| `tools/browser-checks.sh`, all 22 remaining scripts, templates on | | 19 passed first time. `layer-scope` and `work-item` failed on J4's changes: their fixtures named evidence by position, and they expected the old "Criterion N" labels. Updated, both pass. `browser` timed out once on an unrelated decision page and passed on rerun. **All 22 pass** |
| Migration rehearsal (above) | | Passed, and again on the final code |
| **Final rerun** after the note-ID fix found in review (`knowledge.mjs`) | | Server suite 286 passed, 0 failed, 30 skipped. Templates 308 passed, 1 failed, 7 skipped: `symphony-worker`'s "portal restored the submitted attempt: startup exceeded 60s" (load average about 16). That file passes alone (2 of 2), and it passed in the first full templates run. `work-item` and `layer-scope` browser scripts pass after a fresh build |

**Not done here.**
- The agent's blocked state (*Sign and accept* disabled) is server-tested only. No browser script drives an agent run with a journey claim.
- The owner's live data wasn't touched.
- The template-update path that the Biome part of J8 needs is still open.

**Retrospective (J4).**
1. *Harder than necessary:*
   - Finding where J3 was cost the first part of the session. `main`'s handoff said "J3 next", and the work was on another session's branch.
   - J3's runner-image workaround was described but not recorded as commands.
   - The repository-review browser check hid its own failures behind "unsettled top-level await".
   - The plan specified the gate at agent submission, where no step results exist yet.
2. *Would help next time:*
   - `tools/branch-handoffs.sh`, referenced from AGENTS.md, lists remote branches ahead of `main` with their `next_action`.
   - The handoff has exact environment commands.
   - The browser check prints the portal log when the portal dies.
3. *What the task revealed:*
   - Proof only exists after the host build. Any "before submit" gate is the J7 *Check my branch* path, for agents as well as people. J7's scope grows by the agent side.
   - Reading an unreadable recipe as "not run" would have hidden a broken app setup from the reviewer.
   - Each J slice so far has landed on a different session branch. The owner's merge to `main` is now the step that keeps handoffs findable.
4. *Questions:*
   - **Created, for the owner:** merge `claude/brave-pascal-br7h4i` and this branch to `main`? They stack, so merging this branch carries both. This doesn't block J5, which can build on this branch.
   - **Resolved:** where the gate sits (acceptance), and how pre-J4 runs read (by position, as the IDs the migration gives).
   - **Still open:** whether people use references instead of notes (J8).
5. *Process change:*
   - **Applied:** `tools/branch-handoffs.sh` and its AGENTS.md line. **Tested:** run in this repository, it lists exactly the J3 branch that had to be found by hand (`+5`, `next_action: JOURNEYS-01`). **Hypothesis:** that the next agent runs it before starting.
   - **Applied:** the exact runner-image commands in the handoff. **Tested:** they built the image this session.
   - **Applied:** the full browser set at closeout, as J3 set. It caught two scripts that J4's changes broke, which the server suites didn't.
