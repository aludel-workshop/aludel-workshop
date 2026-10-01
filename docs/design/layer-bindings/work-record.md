---
id: LAYER-BINDINGS-01
kind: design-work-record
status: step-2-accepted
updated: 2026-10-01
depends_on: [DEC-055, DEC-057, DEC-059, LAYER-FRAMEWORK-01, T03-ADAPT]
---

# LAYER-BINDINGS-01: how layers share what they know

## Authorization and scope

**Owner chat, 2026-09-30 to 2026-10-01.** After T03-ADAPT, the owner set out how layers should relate. This packet is now **higher priority than T03-CODE**. The owner reviewed the contract on 2026-10-01 and answered its questions ([Owner decisions](#owner-decisions-2026-10-01)). Implementation is handed to a new session ([Handoff](#handoff-for-the-next-session)). This record authorized conceptual design only; there is no code, provider, GitHub or external effect.

The owner's direction, condensed:

1. **No "Aludel way".** A source never has to publish someone else's shape, and a client's existing system (a Figma design system, a codebase with no docs) is used as it is.
2. **A layer works with no inputs at all.** Its only input is the work done in it. It adds an input when it discovers another layer's output is worth using, by **importing** into its own representation. A codebase must run without access to any Aludel app. Prebuilt templates may ship adapters ready for each other; that is a convenience, not a built-in assumption.
3. **Import work** mixes scripts (copying tokens) with agent or human work for soft translation (how a Vision paragraph becomes a spec).
4. **Two-way and external change.** Code → flows (an existing app, blank Pages), flows → code, and both developed and needing a merge. After a sync, either side can change outside Aludel (a commit to the repository).
5. **The contract is per output pairing, at project level**, possibly owned by the Work layer, not by either layer. (Refined in review: one contract per shared concept, open to any number of participants.)
6. **Outputs are wider than declared record kinds.** Anything a layer maintains can be the best current representation of something, including what was thought of as internal state. Pages' own idea of a design system may be the most authoritative one until Design arrives.
7. **Authority moves, and duplication must not confuse anyone.** When a Branding layer takes over branding, Design's branding must not leave a person or agent puzzling over where to make a change. Design should not keep expanding its branding to match an authority nobody uses it for.

## What already exists

- [LAYER-FRAMEWORK-01](../layer-framework/work-record.md) covers several parts already:
  - layers as small apps that discover sources and keep versioned relation policies;
  - observed versus planned outputs;
  - external and mixed authority ("authority is partitioned by artifact or operation"), with Figma as a read-only source;
  - connection lifecycles, including disconnect and reconnect.

  This packet keeps all of that. It moves the *relationship* from each layer's local policy to a project-level binding, and adds baselines, roles and authority transfer.
- **Connection records** (`layer_connections`) already hold a receiving and source layer, mapping, reaction, a question, revisions and proposed → active review. They are keyed by layer pair, partly Pages-specific, and drive nothing at runtime.
- **Pages ⇄ Code reconciliation** (`pages-reconciliation.mjs`, `pages-code-observations.mjs`) is a hard-coded version of one binding.
- **T03-ADAPT:** Pages' kit adapter is the first consumer-owned import. It exists from the moment Pages is installed, which is the assumed input item 2 rules out.

## The model

### 1. Facets: what a layer maintains

A **facet** is a coherent body of knowledge a layer maintains: Design's *tokens*, *components* and *branding*; Pages' *pages*, *flows* and its *kit*; Code's *routes*, its *design system as implemented* and the *codebase*. A facet names its record kinds, files or state, and the views that edit it. Declared output kinds become facets. So does state that used to count as internal, as long as the layer can publish it to the Library.

Facets are what get matched across layers. The match is a proposal ("Pages' kit and Design's components describe the same thing"), never a fixed type every layer must use. Optional well-known hints (`design-tokens`, `branding`) can make discovery easier, but nothing requires them.

### 2. Roles: what a facet is in this project

For each concept, every facet that represents it has one role:

| Role | Meaning | Who edits | Views |
|---|---|---|---|
| **Authority** | Where changes are made | People and agents, through the layer | Full editor |
| **Replica** | A local copy the layer keeps because its own work needs it to run on its own | Only the binding's import Work; local edits are proposals sent to the authority | Read-only, saying where the authority is, with a "propose a change" action |
| **Ceded** | The layer no longer maintains this; another facet does it better | Nobody here | The tab or section shows only a pointer to the authority. Records are kept read-only as history |

The rule that decides between **replica and ceded**: *does this layer's own work need the data to produce its outputs without anyone else?*
- **Replica.** Code needs the design system to generate styles, so Code keeps one. It keeps **only the subset its adapter imports**, so it never grows to match the authority.
- **Ceded.** Design doesn't need the full branding to do design work once Branding owns it. If Design's previews still want the app name and mark, those few fields become a small replica, and the rest of Design's branding is ceded. This is the answer to "do we keep expanding Design's branding?": no.

Ceding is a supported state of a facet. A template declares which of its facets can be ceded or replicated, and its views must handle both. That's a cost each template pays once.

### 3. Bindings: one contract per shared concept

A **binding** is a project-level record for **one shared concept** (the app's design system, its user journeys, its branding), with **any number of participating facets**. It isn't one contract per pair of layers. Design, Pages and Code settle design-system authority in one binding, and a fourth participant joins it rather than adding three more contracts. The binding records **who the authority is**, which may be split by area.

```
binding
  concept:        name and description (for example "the app's design system")
  participants:   [{ layer instance, facet, role: authority | replica | ceded | peer, areas? }]
  authority:      one participant, or a split by area ("components: Design; branding: Branding")
  correspondence: concept entries, each mapped to the entry refs every participant holds for it:
                  matched | missing in some | diverged
  baseline:       per participant entry, the revision at the last agreed sync
  policy:         per participant and event (added | changed | removed): propagate | flag | ignore;
                  mechanical parts apply automatically and are recorded on the binding;
                  two participants changed since the baseline: conflict, a person decides
  translation:    one adapter per non-authority participant, from the authority's facet into its own
                  (owned by that participant's layer): mechanical part (pure script) + soft part (instructions)
  lifecycle:      proposed → reconciling → active → paused | retired
  revisions, review, rationale (like any Aludel record)
```

**Hub, not mesh.** Translation runs through the authority. With N participants there are at most N − 1 adapters, each owned by the receiving participant, not N × (N − 1). A participant's own proposed change goes to the authority as Work and comes back out to the others from there. When authority moves, adapters are re-pointed to the new hub (see transfer below). Pairs that need nothing in common skip that adapter.

The rules that keep it sound:

- **No layer ever changes another layer's output.** A binding only creates Work in the layer that should change, and that layer's own rules and review apply. Nothing feels "backwards" in either direction.
- **The baseline makes external change safe.** When a side moves away from its baseline, the binding knows which side changed. When both moved, it knows there's a conflict, as in a three-way merge. A commit made outside Aludel is just Code re-deriving its observations at a new commit, and the binding sees Code's side move.
- **Imports land in the receiver's own representation.** Code imports flows as, for example, end-to-end tests in its repository, and imports the design system as token files the app builds from. Nothing at runtime reaches back into Aludel.
- **Authority transfer is a binding change, reviewed like one.** For example: "Branding becomes the authority for branding; Design's branding facet becomes a replica of name and mark, and the rest is ceded." Its first reconcile moves or merges content, and the other participants' adapters are re-pointed to the new authority in the same change.
- **Authority is chosen when the binding is created, per project.** Discover proposes it from the participants' own documentation (charters and methods), with a reason, and the owner can choose otherwise. There is **no fixed code-first default**. The owner's preference: where Pages and Code both exist, the UX designer's flows should be built in code rather than only describe what is built, so Pages is the usual authority, even when Pages starts blank and its first flows are drafted from the code. Some projects will want it the other way, and the binding allows that, also per area.

### 4. Where bindings live and who runs them

- **Seen and edited in Library › Bindings** (owner, 2026-10-01). Bindings are knowledge about the project, beside the pooled outputs they connect. A binding's page shows its concept, participants and roles, authority, correspondence with any gaps or conflicts, policy and recent automatic changes. Each layer's Manage page carries one line per facet in a binding ("Kit: replica of Design's").
- **Run by Work routines.** Changes to a layer still happen through Work items in that layer.

| Routine | Does |
|---|---|
| **Discover** | Compares facets published in the Library (charters, schemas, entries). It either proposes a new binding or proposes that a facet join an existing one, with a reason, a sample correspondence and a proposed authority. A proposal is a Work item to accept, change or dismiss with a reason, so it isn't proposed again. |
| **Reconcile** | The first sync of a binding, or of a new participant: match entries, then raise Work to combine, trim or add. Mechanical parts apply automatically; the rest is ordinary Work in each layer. |
| **Watch** | When a participant publishes a new revision, compares it with the baseline and applies the policy: auto-apply mechanical parts and record them, raise Work for the rest, and advance the baseline when the Work closes. |
| **Transfer** | Carries out an accepted authority change: roles, re-pointed adapters, a final import. |

Layers stay simple. They publish facets to the Library, accept Work, own their adapters, and declare which roles their facets support. They don't know about bindings.

## Walkthroughs

- **Pages first, Design later (one binding, "the app's design system").** Pages' provisional kit is the authority, and Code's design-system replica participates. When Design is added, Discover proposes that it join, as the new authority. The transfer imports Pages' choices into Design (Work for Design), Pages' kit becomes a replica, and Code's adapter is re-pointed to Design. It's one binding throughout.
- **A Figma design system.** A Figma import layer publishes Figma's own structure (variables, styles, components), read-only. Discover proposes that it join the design-system binding as authority. Pages and Code each write an adapter from Figma's shape, and Design, if installed, becomes a replica or cedes.
- **An existing app, blank Pages.** Code publishes routes and screens observed at a commit. Discover proposes a "user journeys" binding of Code's routes and Pages' flows, and from both charters proposes **Pages as authority** (the owner's usual preference). Reconcile finds everything only on Code's side and raises Work for Pages: draft flows from the observations, marked *observed*, or import documentation if the repository has some, and have the UX designer review them. From then on, the designer's flows drive Code.
  - A commit made outside Aludel moves Code's side away from the baseline. Watch raises Work for Pages to review the drift: accept it into the flows, or send it back to Code as a change.
  - A project that chooses code as the authority instead gets update Work for Pages directly.
- **Flows first, then code.** The same binding with Pages as authority. Reconcile raises Work for Code to implement the flows, importing them as tests in the repository.
- **Both developed.** The first reconcile is the merge: matched, only-on-one-side and diverged entries become combine, trim or add Work, and someone sets the authority, possibly by area. After that the policy runs.
- **Branding layer added.** As in roles above: a transfer makes Design's branding a small replica (name, mark) plus ceded history, and Design's Brand tab becomes a pointer with a short read-only summary.

## Effect on current work

- **T03-ADAPT** becomes a **prebuilt binding**. Design ships its kit; Pages ships an adapter for it. Discover proposes the design-system binding (Design authority, Pages' kit a replica) as soon as both are present, and Pages has no kit input until that binding is active. The adapter code stays.
- **Templates declare facets and supported roles.** Design: *tokens*, *components* and *branding*, each able to be a replica or ceded, with the Brand tab able to show "managed in …". Pages: *pages*, *flows* and *kit*.
- **T03-CODE** starts after this. Code publishes what it observes from any repository (routes, screens, its implemented design system), keeps its replicas as repository files, and gains bindings instead of hard-coded reads.
- **Existing connection records and Pages' reconciliation** turn into bindings. Their data maps into the binding record; nothing is thrown away.

## Proposed implementation order (after owner review)

1. **Contract** — *built 2026-10-01, agent-checked ([evidence](../../../pages-template-candidate/docs/evidence/layer-bindings-01/README.md)):*
   - facet declarations and role support in `layer.json`;
   - the binding record and its API in the Work layer;
   - the baseline, policy and correspondence evaluation as a pure module, with fixtures for every walkthrough above, including a third participant joining and an authority transfer re-pointing adapters (no UI).
2. **First binding end to end: the app's design system (Design authority, Pages' kit replica)** — *built 2026-10-01, agent-checked; owner review pending. Pages now keeps a stored replica (`kit_item`) instead of reading Design live:*
   - Discover proposes it.
   - Accepting it activates Pages' adapter.
   - A token change auto-applies and is recorded.
   - Library › Bindings shows the binding.
   - Browser journey.
3. **Roles in views:** Design's Brand tab as a replica or ceded, tested with a stand-in "branding" layer built from `layer-base`.
4. **Code ⇄ Pages** after T03-CODE publishes observations, replacing the hard-coded reconciliation.

## Owner decisions (2026-10-01)

5. **No peer role; a clear authority direction, with drift** (owner, after step 1). Every binding has a clear direction, from the authority to the other participants. Whatever that direction, changes can arrive at any time outside the binding, such as a commit to the app repository made without the normal process that affects flows. That is **drift**. The binding must assess drift and adapt, in one of two ways:
   - **adopt:** update the authority to reflect the change;
   - **rectify:** create Work to bring the drifted participant back.

   Which one depends on the nature of the contract (the binding's drift policy per participant) and of the drift (added, changed or removed; whether the authority owns a mechanical adapter for the drifted shape). Unclear cases are assessed as Work. The step-1 `peer` role is withdrawn, and Code's routes in a user-journeys binding are a replica of Pages' flows.

1. **Auto-apply:** yes. Mechanical propagation applies automatically and is recorded on the binding. Soft parts stay Work.
2. **Where bindings are seen:** a **Bindings tab in the Library**, because they're knowledge. Routines still run through Work.
3. **Multi-party:** yes. One binding per shared concept with any number of participants, so three or four layers don't need a contract for every pair.
4. **Authority:** there is no code-first default. It's chosen per project when the binding is created, from the participants' own documentation, and the owner may decide either way. Usual preference where Pages and Code both exist: the designer's flows drive the code, even when Pages was first drafted from it.

## Readiness

The contract is agreed, so step 1 is ready for a new session. The proof for step 1 is the policy module run against fixtures of all six walkthroughs, with stable outcomes. A documented model is not evidence that it works.

**Reversal evidence:**
- Split bindings into one-directional imports if two-way policies keep causing conflicts that people can't resolve.
- Drop roles back to authority and consumer only if ceding is never used in practice.
- Keep relationship policy in layers (LAYER-FRAMEWORK-01's original placement) if project-level bindings turn out to need layer-specific logic for every pair.

## Handoff for the next session

**Start here.** Read this record, then the Library and layer-API code it extends. Record your run start in the run log below before executing.

**Authorization:** same local scope as the T03 packets. Code, tests, previews and evidence in `pages-template-candidate` (branch `feature/pages-layer-template`, at `f3b6ecb`) and on `layer-base` branches. No GitHub or provider writes, provider turns, deployment, spending or live owner data. The owner approved implementing this contract (chat, 2026-10-01).

**Current state you build on:**

| What | Where |
|---|---|
| Layer API, handler sandbox, seeds (`api.seeds`, `seedLayer`), shared write checks (`checkWrites`) | `apps/portal/server/layer-api.mjs` |
| Library pool, `data=1` reads | `apps/portal/server/library.mjs` |
| Pages' kit adapter (becomes the first binding's adapter) | `layer-base` `pages` `ui/pages-kit-adapter.ts`; the host app kit (`src/app-kit/`) only renders |
| Old connection records and hard-coded Pages ⇄ Code reconciliation (migrate into bindings; don't delete their data) | `server/layer-space.mjs` (`layer_connections`), `server/pages-reconciliation.mjs`, `server/pages-code-observations.mjs` |
| Base layer contract (add facets and roles) | `layer-base` `main` `docs/layer-contract.md` |
| T03 evidence and lessons | `pages-template-candidate/docs/evidence/t03-design/`, `t03-design-seed-adapt/` |

**Step 1 is built** ([evidence and retrospective](../../../pages-template-candidate/docs/evidence/layer-bindings-01/README.md)). Its working-tree changes are uncommitted in both repositories until the owner asks for a commit:
- `pages-template-candidate`: `apps/portal/server/bindings.mjs` and `binding-records.mjs`, the `layer-package.mjs` facet check, the `server.mjs` routes, `tests/bindings.test.mjs`, `tests/binding-records.test.mjs` and `tests/fixtures/binding-walkthroughs.json`;
- `layer-base` `main`: `docs/layer-contract.md` and `tests/contract.test.mjs`.

Commit `layer-base` `main` before forking the Design and Pages branches from it.

**Step 2 is built** (same evidence). The candidate's step-2 changes are uncommitted; the `layer-base` commits above exist because pins require them, and nothing was pushed.

**Next: owner review of step 2, then step 3** (roles in views):
1. ~~Owner review of step 2~~ (accepted 2026-10-01).
2. Split Design's facet: give branding its own facet, and let Design's views show replica and ceded states (the Brand tab as "managed in …"). Then declare `replica` and `ceded` on those facets.
3. Build a stand-in Branding layer from `layer-base` that publishes `branding.brand`, and run the branding walkthrough on real pins: join, transfer, kept subset, and ceded history.
4. Give Pages kit write operations if Pages is to be an authority (walkthrough 1); otherwise record why not.

Open for the owner: whether existing projects should be moved to the new Pages template (which brings the replica and the binding proposal), or keep live-reading until a general template-update path exists.

T03-CODE can start after the owner's step-2 review. Its observations need stable concept keys (journeys, not file paths) and a stored copy for any replica.

**Checks every step:**
- `npm run test:server` and `npm run test:server:templates`;
- `tools/typecheck-layer-ui.mjs` on every template pin;
- `npm run typecheck`, `npm run build`, and the reviewed-source check for every pinned handler;
- browser journeys with templates on, using the `PLAYWRIGHT_MODULE` path in the T03-DESIGN brief.

Lessons from the T03 runs:
- Pin last, then run the suites once.
- `npm run typecheck` syncs the pinned Pages views into `src/installed/pages`.
- Assert what a view reads from other layers, not only that it renders.
- (Step 1) Write walkthroughs as exact expected outcomes before trusting a prose contract. Four model gaps surfaced only that way. Mutation-check the fixtures.

**Watch for:**
- **The "Aludel way" creeping back.** Every adapter maps a source's own shape; no layer requires a facet type; no view names another layer's key or screens.
- **Inputs as prerequisites.** A layer must work with no bindings at all.

### Run log

- **2026-10-01, step 1 started (Claude Code session).** Owner chat: "pick it up and get started" on the binding system, within the handoff's authorization above (local code, tests and evidence in `pages-template-candidate` at `f3b6ecb` and `layer-base` branches; no GitHub, provider, deployment, spending or live owner data). Scope of this run: step 1 only (facet and role declarations in the base contract and manifest validation; the binding record and its API; the pure evaluation module with fixtures for all six walkthroughs, a third participant joining and an authority transfer). Step 2 is not started in this run.
- **2026-10-01, step 1 complete (agent-checked).** Pure module, record and API, base contract and fixtures were built. The 17 new tests pass; the server suite passes 240/240, and the templates suite has 233 passing, 7 skipped and none failing. Pins are unchanged and their per-pin checks pass. The `peer` role is defined for owner confirmation. Pages-as-authority needs Pages to publish its kit (open). [Evidence](../../../pages-template-candidate/docs/evidence/layer-bindings-01/README.md).
- **2026-10-01, drift model and step 2 started (Claude Code session).** The owner replaced `peer` with authority direction plus drift handling (decision 5) and said to "go ahead and start step 2". Scope: rework the step-1 module and fixtures for drift; then step 2 (Design and Pages facets; local commits on `layer-base` `main`, `design` and `pages` and re-pins, which pins require; no push; snapshot reader; Discover; Watch; Library › Bindings; browser journey). Same exclusions as above.
- **2026-10-01, step 2 complete (agent-checked).** Drift replaced `peer` in the pure module, fixtures and base contract. Pages keeps a replica of the app kit (`kit_item`), filled by its declared `aludel-kit` adapter, run by the handler's `adapt`. Design declares its kit facet. Commits on `layer-base`: `main` `20bdd95`, `design` `cd96d4c`, `pages` `331908f`, pinned in the candidate. Discover, Watch, the hold while a participant is off, and Library › Bindings are built. Results: the server suites pass with templates off (241, 2 skipped) and on (236, 7 skipped); the new `bindings` journey and eight other journeys pass. Owner review of Library › Bindings and Pages' replica behaviour is pending. [Evidence](../../../pages-template-candidate/docs/evidence/layer-bindings-01/README.md#step-2-the-design-system-binding-end-to-end).
- **2026-10-01, step 2 accepted by the owner.** The owner reviewed it in a browser on a disposable templates-on portal (port 4330, seeded Tool Share project): "finished. looks good. like the way that bindings came out." Step 2 is owner-accepted. Not exercised in that review: Adopt/Rectify (there is no UI path to cause drift); the existing-projects question stays open.
