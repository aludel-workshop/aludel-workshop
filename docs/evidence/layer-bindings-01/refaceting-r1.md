# LAYER-BINDINGS-01 step 3, R1: refaceting as a pure contract — 2026-10-01

## Scope and authorization

Owner chat, 2026-10-01: "pick up step 3 of our current plan please". Step 3 is [refaceting](../../../../docs/design/layer-bindings/refaceting.md); its first slice, R1, is the pure contract with fixtures. The run and its scope are recorded in the [work record's run log](../../../../docs/design/layer-bindings/work-record.md#run-log) before execution:
- local code and tests in this candidate only;
- no `layer-base` commit or re-pin;
- no GitHub, provider, deployment, spending or live owner data.

The plan's four proposed defaults had not been answered explicitly. This run applies them as proposed. They are reversible, and each is listed below for confirmation.

## What was built

| Piece | Where | What it does |
|---|---|---|
| Facet `select` with `where` | `apps/portal/server/bindings.mjs` (`validateFacets`, `facetOf`, `assignFacets`) | A facet selects whole kinds, or one kind narrowed by one field (`equals`, `in`, `notIn`). Facets never overlap; overlap is refused when the manifest loads. `kinds` remains shorthand for whole kinds, so today's pins load unchanged. A `readOnly` facet can only be an authority. |
| Bindings on whole facets | same (`validateBinding`, `evaluate`, `transfer`, `wiring`) | One authority per binding. Area authority, participant `areas` and the replica `keeps` list are refused, with a pointer to refaceting. A layer's facet takes part in a binding at most once. |
| Ceded participants offer once | same (`evaluate`) | On its first reconcile with a hub, a ceded participant offers what it holds. Content the hub lacks becomes adopt Work through the authority's adapter, equal content is recorded as ignored, and different content is combined by a person. After that it takes nothing and offers nothing. |
| Read-only authority | same (`evaluate`) | Work that would go to a read-only hub becomes rectify Work on each replica. A ceded participant's content stays as its history. Drift that a policy would adopt is rectified instead. |
| `refacet` | same | Split (take clauses out of a facet into a new key), merge (fold one facet into another) or rename (title only). It returns the new declarations, the bindings that follow, and the preflight. The parent keeps its key and bindings. Moved entries are **detached** from those bindings, and every other participant still holding them is listed under `follow`. The split-off facet starts unbound, or joins one named binding in a role it supports. A merge is refused while the merged facet is in a live binding. |
| Detached entries | same (`evaluate`) | A binding holds detached entries, by ref and by concept key, for every participant until none still publishes them. A refacet on one side is then never read as a removal or an offer on the other. |
| `roleOf`, `bindingOf` | same | An entry's facet, that facet's role in its one live binding, and where its authority is. A facet in two live bindings is refused with "Refacet it". The R3 write guard and the R4 views will read this. |
| `repoint` | same | Once a ceded facet's content has been adopted: re-point Work per referencing layer, adapter Work where the layer's references can't name the authority's kind, and a waiting list for entries not adopted yet. |
| Refacet cases | `apps/portal/tests/fixtures/refacet-cases.json`, `apps/portal/tests/refacet.test.mjs` | Every case in the plan's table, run through a multi-layer harness whose snapshots come from each layer's entries through its current facets. Rule tests cover overlap, membership, bindings following keys, straddles, moving entries and re-point waiting. |
| Step-1/2 callers | `binding-routines.mjs` (snapshot by `facetOf`), `binding-records.mjs` (single authority, `readOnly` copied from the facet), `src/layers/library-bindings.ts` (wiring without areas) | Only what the changed contract requires. |

### How the plan became concrete (deviations; 4–6 confirmed by the owner)

1. **`notIn` was added to `where`.** Splitting part of a kind by value leaves a parent that selects everything *except* those values. Without `notIn`, a parent that selects the whole kind can't express that remainder.
2. **Two different fields on one kind are refused.** Facets can't be shown distinct without reading records, so the rule is static: the same kind is selected whole once, or by one field.
3. **A take clause without `where` takes the kind as the facet holds it.** For example, after splitting off the name and mark, `{ kind: brand_asset }` takes the rest.
4. **A narrow replica of a broader authority uses its existing policy, not `keeps`.** Design's identity facet (name and mark) replicates Branding's whole `brand` facet with `added: ignore`, and the status doesn't count what it never takes as missing. The alternative is to refacet Branding too, so that two bindings contract on exactly the matching parts. That stays available. Question for the owner below.
5. **The step-2 ceded behaviour changed.** Before, a ceded participant took no part, so in the Figma walkthrough Design's own `legacy-shadow` was silently dropped. It is now offered to Figma once, as the plan's Personas walkthrough requires.
6. **A ceded facet may take authority back.** `transfer` no longer refuses a ceded target. This is what the merge-back chain needs: Vision's ceded personas become the authority again, and Personas offers what it holds.
7. **A split-off facet goes right after its parent** in the declarations.
8. **Area-based step-1 walkthroughs were rewritten.** "Both developed" drops the admin area, so admin screens following Code would now be their own facets and binding. "Branding takes over" now starts after the refacets, with Branding as the authority of a new binding. All other step-1 and step-2 walkthroughs keep their exact outcomes and action IDs.

### Defaults (accepted by the owner 2026-10-01, with deviations 4–6)

1. Area-split authority and `keeps` are removed; refaceting replaces them.
2. The facet keeping the original key keeps its bindings; split-off facets start unbound unless the refacet names a binding and role.
3. Ceded records stay as history; references are re-pointed by Work (`repoint`), not rewritten by the split.
4. Assess overlap is soft Work raised by Discover. Nothing in R1 matches automatically; that is R5.

## Checks (all run 2026-10-01 on this working tree)

| Check | Result |
|---|---|
| `node --test tests/bindings.test.mjs tests/refacet.test.mjs` | 30 pass. That is the 15 step-1/2 binding tests (two fixtures rewritten, one expectation changed by deviation 5) and 15 new ones: 6 refacet cases, order reversal, and 8 rule tests. |
| Order reversal | Every refacet case gives the same trace when every list (entries, participants, correspondence, adapters, references) is reversed, action IDs and baselines included. |
| Membership | An exhaustive split × parent grid: 12 combinations, of which 10 are valid splits and 2 are correctly refused. Every split keeps each record in exactly one facet, and merging it back restores the original membership. `refacet` also checks this on every call, and that check caught a real bug while the tests were being written (below). |
| Mutation check | 14 mutations, each a rule broken alone; all 14 are caught (fail counts 1 to 8). The rules: ceded receives, detached held by ref, held by key, held as one ref, read-only (×2), `notIn` remainder, field overlap, detach on split, policy-ignored status, straddle, merge while bound, whole-kind take, adapter on first adopt. |
| `npm run test:server` | 258 tests: 256 pass, 2 skipped (step 2: 241 pass, 2 skipped). |
| `npm run test:server:templates` | 258 tests: 251 pass, 7 skipped (step 2: 236 pass, 7 skipped). |
| `tools/typecheck-layer-ui.mjs` on every pin | pages `331908f` (9 files), design `cd96d4c` (6), vision `eac6132` (1), data `53d1573` (1) type-check; markdown and base have no views. Pins are unchanged. |
| `npm run typecheck`, `npm run build` | Both exit 0. Four NG8107 warnings, all in files this run didn't touch. |
| Browser, templates on: step 2's set (`bindings`, `design-layer`, `pages`, `library`, `layer-bar`, `vision-layer`, `data-layer`, `product`, `workflow`) | all 9 pass, including `bindings` on the `facetOf` snapshot |

## Limits

- **Pure only.** Nothing applies a refacet to a layer repository yet. Detached entries aren't persisted: the sync table stores correspondence and baseline only. Binding records don't yet check "one live binding per facet" on propose or join. All three are R2.
- **No write guard and no role-aware views.** `roleOf` exists, but the host doesn't refuse writes and views don't show roles. That is R3 and R4.
- **`layer-base` contract text still documents `kinds`.** Updating it needs a commit on `main` and re-pins, which belong with R2 or R4 when templates change anyway.
- **Kinds per instance (section 7)** is shown only in the pure harness, where snapshots are derived per layer. The project-wide host reads (`list(projectId, 'persona')`) are R3.
- **Section-level overlap isn't expressible.** Facets select entries, so the Content case had to model marketing *pages*, not sections inside pages. Content that overlaps part of a record needs that part to be its own entry.
- **The `design` browser journey fails** waiting for the token tree, identically on step 2's committed code. It isn't in step 2's journey set; `design-layer` is.

## Retrospective

1. **What made it harder?** Observed:
   - `refacet`'s own membership check caught a real bug in `subtract`: a whole kind split by value lost its remainder.
   - A test-harness bug used a stale binding after `settle` returned a fresh copy.
   - The first mutation run let two guards survive. Detached entries were held both by ref and by key, and each masked the other's removal because every fixture entry's key equalled its concept key.
   - Writing the test that needed each guard alone then exposed a design flaw: detached entries held one ref per participant. They now hold a list.
   - One browser run was wasted on the stale `design` journey instead of step 2's `design-layer`.
2. **What would make the next one easier?**
   - The multi-layer harness in `refacet.test.mjs` derives snapshots through facets, as the host will. R2's server tests can drive the same fixture file.
   - The exact journey set and command now sit in the work record's handoff checks.
3. **What did it reveal?**
   - Step 2's ceded role silently dropped content (deviation 5).
   - Detached entries need storage, and "one live binding per facet" needs enforcing in records (R2).
   - Sub-record overlap isn't expressible.
   - A narrow replica of a broader authority facet can be handled two ways: by policy or by refaceting the authority (deviation 4).
4. **Questions.**
   - Confirm the four defaults and deviations 4–6. They block R2, which will persist this contract.
   - Should sub-record content become entries? This blocks only a Content-like layer, not R2–R5.
5. **Process change applied now.**
   - The handoff's checks name the exact browser journey set.
   - The mutation-check rule is sharpened: mutate each guard alone, and where two guards cover one case, write a test that needs each alone. Applying it found the one-ref flaw in this run.
   - Still a hypothesis: that the sharper rule finds masked guards in later packets.
