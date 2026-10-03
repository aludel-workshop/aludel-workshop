---
id: JOURNEYS-01
kind: work-record
status: proposed
updated: 2026-10-02
depends_on: [T03-CODE, LAT-08A, LAYER-BINDINGS-01, EXISTING-PROJECTS-01, DEC-050, DEC-057]
---

# JOURNEYS-01: journey-driven Work and review

## Authorization and scope

- **2026-10-02, owner chat (planning).** After a design discussion on Codex's guided Code previews, the owner wrote: "spec then implement makes sense. draw up the implementation plan, including cleaning up codex's work." Authorized: this plan and the pointers to it (LAT-08A, status ready queue). No code, template, commit or live-data change. Each slice below needs the owner's go.
- T03-CODE remains `next_action`. This packet is proposed for the ready queue after it.
- **2026-10-02, owner chat (J0–J1):** "yeah, go for it." Authorized: J0 (re-run checks; commit Codex's uncommitted LAT-08A integration and Biome work as one commit; remove the rejected standalone trial tool; condense status and procedure text) and J1 (pure contract modules and tests). Both are local and committed to `main`. The proposed defaults stand. Not authorized: template pins (J2+), the live Biome item, pushes, restarts of the owner's portal, and the untracked candidate checkouts or `notes.txt`. Same message: "the code editor tabs need to be re-evaluated. the general structure of code is enough to work from." Recorded as an input to J2: the Journeys view joins Code's current structure without redesigning its tabs, and re-evaluating the tabs is a separate UX pass.
- **2026-10-02, owner chat (J2):** "t03-code is fine for now. go j2". This waives waiting for T03-CODE's owner look before J2. Authorized: a journeys facet on `layer-base` `code` (declared output, Journeys view, Knowledge), a new template commit and its pin in this repository, local checks, and commits to both repositories. Not authorized: pushes, restarting the owner's portal, the live Biome item, and J3+ wiring. A pin change makes existing projects adopt on their next restart; the owner is told what changes first.
- **2026-10-02, owner chat (tracing removal, before J3):** "we're pulling the tracing. box it up, lets revisit at a later phase. don't need it mvp". Asked how far, the owner chose "remove entirely. truth is, those links were not following our new binding approach anyways." Authorized: record the tracing design in a deferred record ([code-tracing/deferred.md](../code-tracing/deferred.md)). Then remove story ↔ code tracing from the host and templates: trace links, suspect and untraced states, Reconcile items, commit-trailer and test-name links, generation-manifest links, `builtBy` and everything it drives (Pages Built status, Data status from links, Vision "Built by" chips, release Ships stories, the page-delete guard). Code units, Explorer and reachability stay. Includes template commits and pins, local checks and commits. No compatibility shims are needed (owner: early stage). Planned J3b (observed traces) is dropped from this packet.

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

1. A failing claimed step test blocks agent submission. A person may submit with a stated reason, and the reviewer sees the failure first.
2. One *Implement* item per journey, grouped under the publish or *Specify* item that raised it.
3. The diff stays reachable under Under the hood. A reviewing-agent signature on code is a later packet.
4. Journey tests use Playwright in the check image. It costs nothing, but it adds image size, which J3 measures.

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

J0–J2 are done (below). J3–J8 and depend on each other as listed. J6 needs a prototype round before building. No external effect, spending or live-data change is planned before J8, and in J8 the owner performs the live actions.

## Run log

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
