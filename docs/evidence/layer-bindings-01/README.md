# LAYER-BINDINGS-01 steps 1 and 2: the binding contract and the design-system binding — 2026-10-01

> Step 3 (refaceting) evidence: [R1, the pure contract](refaceting-r1.md); [R2, Work as the vehicle](refaceting-r2.md). It replaces area authority and `keeps` described below, and changes what a ceded participant does on its first reconcile.

## Scope and authorization

On 2026-10-01 the owner said in chat to "pick it up and get started" on the binding system. The work was within the authorization in [the work record's handoff](../../../../docs/design/layer-bindings/work-record.md#handoff-for-the-next-session), and its run is recorded in the [run log](../../../../docs/design/layer-bindings/work-record.md#run-log). This run covers **step 1 only**: the contract, the pure module and the fixtures. Changes are local and uncommitted, in `pages-template-candidate` (branch `feature/pages-layer-template`, base `f3b6ecb`) and `layer-base` `main`. There were no GitHub or provider writes, provider turns, deployment, spending or live owner data. No template pin changed.

## What was built

| Piece | Where | What it does |
|---|---|---|
| Facet declarations | `layer-base` `main`: `docs/layer-contract.md` (new "Facets and roles" section), `tests/contract.test.mjs` | `layer.json` `facets: [{ key, title, kinds, roles, views?, hints? }]`. Kinds are the layer's own outputs, each in at most one facet. Roles come from authority, replica and ceded (step 1 also had peer; withdrawn by owner decision 5). Views must be tabs. Every fork's contract test checks this. |
| Host manifest check | `apps/portal/server/layer-package.mjs` | A package with invalid facets fails to load, like any other invalid manifest field. |
| Pure core | `apps/portal/server/bindings.mjs` | `validateFacets`, `validateBinding`, `evaluate`, `settle`, `join`, `transfer`, `transition` and `wiring`. No I/O. |
| Binding record and API | `apps/portal/server/binding-records.mjs`, routes in `server.mjs` | `layer_bindings` and `layer_binding_revisions` with exact revisions and a rationale per revision. `GET/POST /api/projects/:id/bindings`, `GET/PATCH …/:bid`, `GET …/:bid/history` and `POST …/:bid/{join,transfer,lifecycle}`. Writes are owner-only with `expectedRevision`. Participants must be declared facets of installed, enabled layers, in roles those facets support. New bindings always start as `proposed`. A transfer requires a rationale. Participants and authority change only by join and transfer. |
| Walkthrough fixtures | `apps/portal/tests/fixtures/binding-walkthroughs.json` | All six walkthroughs as data, plus the code-as-authority variant, a third participant joining, a fourth joining, and authority transfers. Step 2's journeys can replay them. |
| Tests | `tests/bindings.test.mjs` (14), `tests/binding-records.test.mjs` (3) | See below. |

### How the model became concrete

These are design choices the prose contract left open. The ones marked **owner** need confirming.

1. **No peer; direction plus drift (owner decision 5, after step 1).** Step 1 first defined a `peer` role. The owner replaced it: every binding has a clear direction from the authority, and any participant may still change outside the binding. That is drift. A participant's change since its baseline, after its first reconcile, is handled by the binding's **drift policy** for that participant and event, `policy[participant].drift = { added | changed | removed: adopt | rectify | assess }` (default `assess`):
   - **adopt** updates the authority. If the authority owns a mechanical adapter for the drifted participant's shape, this applies automatically (`apply` toward the authority). Otherwise it is `adopt` Work in the authority's layer.
   - **rectify** is Work in the drifted participant's layer, carrying the adapter that can restore it.
   - **assess** is one Work item owned by Work. `decide(binding, assessment, 'adopt' | 'rectify')` turns it into the follow-up. If participants' policies disagree, the drift is assessed.

   Content only a replica holds on its *first* reconcile is still offered to the authority as `adopt` Work: that is reconciling, not drift.
2. **A baseline per spoke, not per participant.** Each non-authority participant (spoke) stores its own revision and the hub's revision at the last agreed sync. Each spoke is therefore its own three-way merge against the hub, and one spoke's open Work never hides the hub's change from another. A transfer changes the hub, which voids those baselines, so the first reconcile after a transfer needs no special code.
3. **Adapters are chosen, not wired.** An adapter belongs to the receiving participant and names the source shape it reads (`design.kit`, `figma.variables`). A spoke's active adapter is whichever one reads its current hub's shape. A transfer therefore re-points adapters without any rewiring, and a missing adapter becomes one `adapter` Work item for the receiver, listing the entries waiting on it.
4. **Matching.** Correspondence entries keep explicit refs. A snapshot entry that no correspondence entry claims is matched by its concept `key`, which the participant's adapter derives (a token name, a journey). The result lists the new entries as `proposed` for the caller to persist. Soft matching by agents stays with Discover.
5. **Equal content needs no Work.** A snapshot entry may carry a `digest` in the concept's comparable form. When the hub and a spoke both moved, or both are new, equal digests settle the spoke silently (`ignored`, recorded). Different digests are a `combine` on a first sync and a `conflict` afterwards. Several spokes offering the same content make one `adopt`; different content makes one `conflict`.
6. **Settling.** Automatic actions settle once they are applied; Work settles when it closes. A spoke that loses (a change sent back, or a conflict decided for the hub's side) settles with `outcome: 'hub'`. That records a hub revision of 0, which no real revision equals, so the next evaluation sends the hub's version to it. A mechanical part with a soft part still pending (a test skeleton before the implementation) does not settle the spoke.
7. **Kept subsets.** A replica with `keeps` takes only those entries from the hub. On its first sync with a new hub, it offers the entries it no longer keeps to that hub once. This is how "the first reconcile moves or merges content" happens before the rest becomes ceded history. Without it, Design's voice and palette story would be lost when Branding arrives.
8. **Action IDs** are derived from the binding, kind, entry, target, sources and revisions. A replay before anything changes yields the same IDs, so a caller can deduplicate as `layer_trigger_receipts` already does.

## Step 2: the design-system binding end to end

The second run (owner: "go ahead and start step 2", after decision 5) built the first real binding: Design's kit as authority, Pages' kit as replica.

**The gap it closed.** The contract says a replica is a local copy its layer keeps. Pages kept none: its view read Design's entries live from the Library. A live read has nothing to apply changes to, can't drift, and can't work without Design. So Pages now keeps a replica:
- **Pages template** (`pages` `331908f`, merged from `main` `20bdd95`):
  - a `kit_item` output, read by `listKitItems` and never written by person or agent operations;
  - a `kit` facet (`roles: ["replica"]`, `shape: "aludel.pages-kit"`);
  - the `aludel-kit` adapter (`reads: "aludel.design-kit"`, mechanical), implemented as the handler's `adapt()`.

  The view's `readKit` now reads Pages' own kit items; the old live-read mapping moved into `adapt`. Each item keeps the source entry's ID inside its value, so page sections that name a Design component still resolve.
- **Design template** (`design` `cd96d4c`): a `kit` facet of `design_tokens`, `component` and `brand_asset` (`shape: "aludel.design-kit"`). Its roles are `["authority"]` only, because Design's views can't yet show replica or ceded states (step 3).
- **Base contract** (`main` `20bdd95`): facets with `shape`, roles without peer, drift, and declared `adapters` implemented as `adapt(adapterId, { entries, removed }, context)`, returning writes the way `seed` does.

**Host:**
- `layer-api.mjs` `adaptLayer` runs a declared adapter at the reviewed commit. It checks the writes like an operation's and applies them as Aludel, with the binding as the rationale (it shares the apply path with `seedLayer`).
- `layer-contract.mjs` lets a built-in template with its own API define record kinds the host doesn't list (`kit_item`), still refusing kinds another layer owns. The compiled Pages declaration gains `kit_item` so templates-off and mixed modes agree.
- `bindings.mjs` adds `validateAdapters` and facet `shape`.
- `binding-records.mjs` keeps sync state (correspondence, baseline) apart from the revisioned contract, adds an event log, and lets the routine move a binding to active when its first reconcile completes.
- `binding-routines.mjs`:
  - **Discover** proposes a binding when one installed layer declares an adapter for a shape another publishes with authority support. It raises review Work in Work, and never re-proposes a pairing once it is dismissed.
  - **Watch** settles closed Work and evaluates. It applies mechanical imports per receiving adapter through `adaptLayer`, logs each change, and raises Work deduplicated by action ID, counting a decided assessment as handled while its follow-up is open. It auto-activates when reconcile completes, and holds (`degraded`) while a participant's layer is off.
  - `decideAssessment` serves the owner's adopt or rectify decision.
- `library.mjs` adds `outputEntries()` (outputs only), which took a no-change pass from about 2 s to about 55 ms.
- `server.mjs` runs Discover and Watch after any successful project write, at start-up and on the routine tick. Binding changes run Watch before answering. It adds `GET …/bindings/:id/status` and `POST …/bindings/:id/decide`.
- **Library › Bindings** (`src/layers/library-bindings.ts`) shows, per binding:
  - its concept, lifecycle and participants with their roles and adapters;
  - matched and waiting counts;
  - Accept, Dismiss (with a reason), Pause and Resume;
  - Adopt and Rectify for open assessments;
  - open Work, recent automatic changes, and an "on hold" notice.

**Rectify on a mechanical replica.** Closing the rectify item settles the spoke for the hub, so the next pass re-imports the authority's version through the adapter. With a soft adapter, closing it records that the fix was made by hand.

## Checks (all run 2026-10-01 on this working tree)

| Check | Result |
|---|---|
| `node --test tests/bindings.test.mjs tests/binding-records.test.mjs` | 17/17 |
| Walkthroughs: Pages first then Design; Figma as 4th participant; existing app with blank Pages (Pages authority, then code authority); flows first; both developed with authority split by area; Branding takes over | Each passes with exact expected actions at every step |
| Same outcome when every input list is reversed (actions, IDs, status, final baseline) | Passes for all scenarios |
| Mutation check: four deliberate breaks in `bindings.mjs` (default policy, kept subsets, the hub-outcome sentinel, voiding baselines on a new hub) | Each one fails 2–8 tests; restored module 14/14 |
| `npm run test:server` | 240/240 |
| `npm run test:server:templates` | 240 tests: 233 pass, 0 fail, 7 skipped |
| `tools/typecheck-layer-ui.mjs` on every pin (pins unchanged) | pages 9 files, design 6, data 1, vision 1 type-check; base and markdown have no views |
| Reviewed-source digest for every pinned handler and indexer | All five reviewed |
| `npm run typecheck` / `npm run build` | Both exit 0. The NG8107 warnings are pre-existing, in files this run did not touch. |
| `layer-base` contract test | Passes on `main` (the facet check skips: base declares none). On a scratch copy, valid facets pass and an unknown role plus a kind reused across facets fail. |
| HTTP smoke on a disposable server (templates on, scratch data directory) | list 200 `[]`; create 409 "design does not declare a kit facet."; invalid 400; unknown 404; wrong method 405; signed out 401 |
| **Step 2** | |
| `MACHINE_LAYER_TEMPLATES_ENABLED=1 node --test tests/binding-routines.test.mjs` | 2/2. On the real pins, Discover proposes once with review Work in Work. A proposal imports nothing. Accepting imports all 21 Design entries as Pages kit items (authored by Aludel, with the binding as rationale) and completes to active. A token change auto-applies. Drift in Pages' copy is assessed, rectified and re-imported. Add and remove propagate. Design off holds the binding and Pages keeps its copy. A dismissed proposal isn't re-proposed. |
| `node --test tests/bindings.test.mjs tests/binding-records.test.mjs` after the drift rework | 15 + 3 pass. Mutation checks on the drift code (default policy, mechanical adopt, first-sync vs drift) are each caught (3, 2 and 6 failures). |
| `npm run test:server` / `npm run test:server:templates` | 241 pass, 2 skipped (routine tests need pins) / 236 pass, 7 skipped; 0 fail in both |
| `tools/typecheck-layer-ui.mjs` on every pin | pages `331908f` 9 files, design `cd96d4c` 6, data 1, vision 1; base and markdown have no views |
| Reviewed-source digests | All five pinned handlers reviewed; Pages' new handler digest added |
| `npm run typecheck`, `npm run build` | exit 0 |
| Browser, templates on: `bindings` (new) | pass: Pages plain with no binding → proposal in Library › Bindings → Accept → active, 21 kit items → Pages draws Design's primary → a Look & feel change reaches Pages → Design off: on hold, Pages keeps its copy → axe at 1440 and 390px, no horizontal scroll |
| Browser, templates on: `design-layer` (updated), `pages` (accepts the binding first), `library`, `layer-bar`, `vision-layer`, `data-layer`, `product`, `workflow` | all pass |

## Limits

**After step 2:**
- **Owner review is pending.** Everything above is agent-checked. The owner hasn't seen Library › Bindings or the new Pages behaviour.
- **Adopt and Rectify buttons:** the server path is tested; the buttons themselves are typechecked but not exercised in a browser.
- **Pages can't be an authority yet.** Its kit facet supports replica only and has no write operations, so walkthrough 1's "Pages first, Design later" can't run on the real templates.
- **Existing projects keep their forked Pages.** An instance forked from the old Pages commit keeps live-reading the kit until the instance is updated to the new template. New instances get the replica. Updating existing instances is the general template-update question, not built here.
- **Work for binding actions uses the general Work flow.** Closing an item settles it with an inferred outcome. Only assessments have a decision endpoint.
- **Drift on a replica is detected by revision.** Equality comes from import provenance (`sourceDigest`), not a comparison in the receiver's form.

**From step 1 (some since resolved):**

- **No real binding can be created yet.** Today's pinned templates declare no facets, so the API refuses every participant. That refusal is correct, and the smoke check shows it. Step 2 adds `facets` to the Design and Pages branches, re-pins them, and runs the per-pin checks.
- **Pages' kit isn't published.** In walkthrough 1, Pages' provisional kit is the authority, but Pages has no kit output kind to publish to the Library. Step 2 binds Design (authority) to Pages' kit (replica), which works without it. Pages-as-authority needs Pages to publish its kit first, so it is listed as an open item, not built.
- **Comparable digests are the caller's job.** Step 2 must compute each digest in the receiver's form, for example by running the receiver's adapter over the hub's entry. Without digests, a first sync of two developed sides yields `combine` Work for every shared entry. That is correct but noisy.
- **Settling on Work close records the revisions at closing time.** A change made to the same entry while its Work is open is absorbed into that settlement. Review of the Work is what covers it.
- **Not migrated:** `layer_connections` and `pages-reconciliation.mjs` are untouched. Step 4 maps them into bindings, keeping their data.
- **Uncommitted:** both repositories' changes are in the working trees, not committed (see the handoff).

## Retrospective (step 2 and the drift rework)

1. **Harder or slower.** Observed: the agreed contract and the code disagreed about Pages. A "replica" was a live read, which only surfaced when step 2 had to import into something. The rest of the friction was in tests, not the module: three self-inflicted test-fixture errors (an empty-change update, a hydrated record with stale `revision` used as data, an over-strict step-1 assertion). Two real bugs were found by tests:
   - a decided assessment being re-raised;
   - a switched-off authority read as deleting everything. Only the browser journey caught this one, through the Design journey's "Design off" step.
2. **What would make the next one easier.** Check the receiving side's representation against the contract's role definitions before building, by asking "where does this replica's copy live?". Keep a fixture helper that writes records only through their layer's `normalize`. Assert absence semantics (layer off ≠ data removed) in the pure fixtures too.
3. **Downstream.**
   - A layer can now define record kinds through its own API, which T03-CODE can use for observations.
   - Every future replica needs a stored copy and a declared adapter.
   - Pages-as-authority needs kit write operations.
   - Existing instances need the template-update path to get new template features.
   - Step 4 (Code ⇄ Pages) uses `replica` plus drift policy, not `peer`.
4. **Questions.**
   - Resolved: `peer` (owner decision 5).
   - Created, agent default taken: should a switched-off authority hold the binding (built) or pause it? Hold, because it needs no owner action and resumes on its own.
   - Created for the owner: when an existing project updates its Pages instance, should the binding be proposed automatically, as it is for new projects (Discover already does this)?
5. **Process change applied now.** The run log records scope before execution, as the handoff requires. The pure fixtures were updated before the routines, and the browser journey was made to assert what Pages reads (its own items) and what happens without Design. The journey failing at "Design off" is the evidence that this check matters. Still a hypothesis: that fixture-first prevents model gaps. The Pages-replica gap was found by building, not by fixtures.

## Retrospective (step 1)

1. **What made it harder or slower?** Observed: the agreed contract was prose plus a schema sketch. Four things surfaced only when the walkthroughs were written as exact expected actions:
   - the undefined `peer` role;
   - the need for per-spoke baselines;
   - the kept-subset handoff of content to a new authority;
   - how a send-back is represented.

   Writing the fixtures also caught two wrong expectations of my own (a rejected removal still needs Pages' missing adapter; a self-contradicting branding step) and one wrong test assumption (Design's kit *can* be ceded). Smaller friction: `node --test <dir>` doesn't run a directory on this Node, and Node's `fetch` can't resolve `*.localhost` here, so the smoke check used `node:http` with a Host header.
2. **What would make the next equivalent task easier?** The fixture file and the replay harness in `bindings.test.mjs`. Step 2 can drive its browser journey from the same scenarios. A contract packet should land its walkthroughs as executable fixtures, with a mutation check, before it is called agreed.
3. **What changes downstream?**
   - Step 2 must declare facets and re-pin before anything binds.
   - Pages-as-authority needs Pages to publish its kit.
   - Digest computation belongs with each receiver's adapter.
   - T03-CODE should publish observations with stable concept keys (journey keys, not file paths), because matching relies on them.
4. **Questions:**
   - *Created:* is the `peer` definition right? (Answered: no peer. Owner decision 5 replaced it with direction plus drift.)
   - *Created:* should a binding with no `*` authority reject unmatched entries that have no area, as it does now, or route them to a default? (Agent default: reject, with a clear error.)
   - *Resolved:* hub re-pointing needs no stored wiring.
5. **Process change applied now, and how it was tested.** The walkthroughs are now executable data with exact outcomes and an order-reversal stability check. A mutation check showed the fixtures detect four separate logic breaks; that is the evidence. The work record's handoff now names the fixtures as the starting point for each later step. Still a hypothesis: that fixture-first contract work generalizes to other packets. It has been applied once, here, after the module was drafted rather than before, so "write fixtures before the module" is untested.
