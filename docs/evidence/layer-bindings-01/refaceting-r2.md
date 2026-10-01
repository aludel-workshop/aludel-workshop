# LAYER-BINDINGS-01 step 3, R2: Work as the vehicle — 2026-10-01

## Scope and authorization

Owner chat, 2026-10-01: "accepting the 4 defaults. confirm behaivor changes. commit and start r2". That is [decision 7 in the work record](../../../../docs/design/layer-bindings/work-record.md#owner-decisions-2026-10-01). R1 was committed first (candidate `44e66db`, workshop `580776b`). The R2 scope is recorded in the [run log](../../../../docs/design/layer-bindings/work-record.md#run-log) and is local to this candidate. No `layer-base` commits or re-pins were needed. There were no GitHub, provider, deployment, spending or live-data effects.

## What was built

| Piece | Where | What it does |
|---|---|---|
| Binding changes as Work | `apps/portal/server/binding-changes.mjs` | Every change to a binding is a Work item in the Work layer, applied only when the project owner decides it. The kinds are create, accept, dismiss, pause, resume, retire, join, transfer, and edits to concept, policy or adapters. Dismissing a proposal retires it, so Discover doesn't propose it again. A blocked item (Work's `blocks`) can't be decided. Members propose; only the owner accepts or dismisses. |
| Discover through Work | `binding-routines.mjs` | Discover's proposal is a binding change ("accept"), so the routines and Library › Bindings decide the same item. |
| Library › Bindings decides items | `server.mjs` routes, `src/layers/library-bindings.ts` | Accept, Dismiss, Pause and Resume decide the matching open item, or create one and decide it in a single step. **This closes step 2's gap:** accepting no longer leaves Discover's review open. A new "Proposed changes" list shows changes others proposed, each linked to its item, with Accept and Dismiss. Refacets appear under Recent changes. |
| Refacet as reviewed Work | `apps/portal/server/refacets.mjs` | Proposing a refacet runs R1's pure `refacet` against the instance's pinned manifest, Library entries and live bindings. It commits `layer.json` alone to a `refacet/…` branch of the instance's own repository, without touching any checkout, and checks the branch is a valid package. It then raises a Work item in that layer, carrying the change, the branch and the preflight, summarised in the item's log. Accepting it (owner only, since `layer.json` defines what a layer may do) works in three steps. It refuses if the layer moved on since the proposal. It merges through the existing `mergeLayerBranch`, so the new pin is the reviewed commit. It applies the bindings' follow-through, recomputed against what they hold now. If that follow-through fails, the pin and `main` are restored. Watch then runs over every binding. |
| Overlap chain | `refacets.chain`, `POST /api/projects/:id/overlaps` | Raises a refacet for each side, plus the binding proposal (a `create` change), which the refacets block. The proposal can be accepted only once its facets exist. |
| Store | `binding-records.mjs` | `detached` is persisted with the sync state. A facet takes part in at most one live binding: proposing, joining or creating a binding that would straddle two is refused with "Refacet it". `applyRefacet` saves a refacet's follow-through, and a facet joining a binding is a new revision. |
| Routes | `server.mjs` | `POST …/bindings/:id/changes` (propose), `POST …/binding-changes/:item/decide`, `POST …/layers/:key/refacets`, `POST …/refacets/:item/decide`, `POST …/overlaps`. The existing join, transfer and lifecycle routes now go through Work. |

### Decisions made while building (for review)

1. **The owner decides every binding change and refacet.** For binding changes this matches step 1's store, which required the owner. For refacets it follows DEC-057: `layer.json` changes what a layer may do, so its review is elevated.
2. **An owner's direct action is still an item.** It is created and decided in one step, so the trail is uniform.
3. **A refacet doesn't need its own agent run.** The host computes and commits it, because a refacet is a deterministic change to `layer.json` alone. It still merges through the same reviewed-branch path as an agent's layer change.
4. **A stale refacet is refused, not rebased.** If the layer's pin moved after the proposal, the refacet must be proposed again. The facets follow from the manifest at the base, so an unmoved layer gives exactly the reviewed facets. I removed a second "facets would differ" guard for that reason: no test could reach it.

## Checks (all run 2026-10-01 on this working tree)

| Check | Result |
|---|---|
| `tests/refacet-work.test.mjs` (templates on) | 7 pass, on the pinned Design and Pages templates. They cover:<ul><li>a proposal accepted or dismissed through its item, and a member's change waiting for the owner;</li><li>dismissal retiring a proposal so Discover doesn't propose it again;</li><li>one live binding per facet;</li><li>a refacet's branch changing only `layer.json` and merging on acceptance;</li><li>Pages keeping every copy, with Watch raising and applying nothing;</li><li>a stale refacet refused, and a branch with overlapping facets not a valid package;</li><li>the full overlap chain: Design and Pages refaceted, then the brand binding accepted and active with no entry copied, lost or doubled;</li><li>owner-only dismissal, a blocked refacet, and a split-off facet joining a named binding.</li></ul> |
| Mutation check | 13 of 13 caught. The first run caught 10. The three survivors were real test gaps, fixed by the last test above:<ul><li>a member dismissing an item, masked by the store's own owner check;</li><li>a blocked refacet;</li><li>the `join` option.</li></ul> |
| `npm run test:server` | 265 tests: 256 pass, 9 skipped. The 7 new tests need the pins. |
| `npm run test:server:templates` | 265 tests: 258 pass, 7 skipped, none failing. |
| `npm run typecheck`, `npm run build` | Both exit 0, with no warnings in the changed view. |
| `tools/typecheck-layer-ui.mjs` on every pin | pages, design, vision and data type-check. Pins are unchanged. |
| Browser, templates on: step 2's set | All 9 pass. `bindings` now asserts two things. Discover's proposal waits as Work and Accept closes it. And the new routes (propose a change, decide it, propose a refacet, dismiss it) answer over HTTP. |

## Limits

- **No UI to propose a refacet or an overlap chain.** Both are API only. The Work item shows the change, and its preflight is in the item's context and log, not rendered. R5's journeys and Discover's Assess overlap bring the UI.
- **Closing a binding-change or refacet item on the general Work board doesn't apply it.** Only the decide routes do. The Work board doesn't yet offer those decisions.
- **Preflight `references` are empty at runtime.** The host has no index yet of which entries other layers reference. That index belongs with R3, which also handles kinds per instance.
- **No write guard and no role-aware views yet:** R3 and R4.
- **The `layer-base` contract still documents `kinds`.** This is unchanged from R1.

## Retrospective

1. **What made it harder?** Observed:
   - Three self-inflicted errors: a Library limit over its maximum, and two guessed column names (`layer_instances.name`, `users.name`). Each cost a test run.
   - One real gap was found by the chain test. Pages' refacet changes no binding itself, so nothing ran Watch to release what the design-system binding held for it. Accepting a refacet now runs Watch over the project's bindings.
   - The first mutation run let three guards survive. One of them, owner-only dismissal, was a real authorization hole that the store's check masked only on accept.
2. **What would make the next one easier?** A schema note (tables and key columns) in the candidate's docs would have avoided the guessed column names. That is a hypothesis, not done here. The R1 multi-layer fixtures remain the reference for R3 and R5.
3. **What did it reveal?**
   - Work items with their own decision routes (binding changes, refacets, drift assessments) aren't decidable from the general Work board. That is a cross-cutting gap for LAT-08A's layer-owned review.
   - A refacet in one layer can change what a binding *not* touching that layer's facet holds, so Watch must run project-wide after it.
4. **Questions.** None block R3. Whether the general Work board should offer decide buttons for these items belongs with LAT-08A.
5. **Process change applied now.** None new. The R1 rule (mutate each guard alone; where guards overlap, write a test that needs each) was applied, and it found the owner-only dismissal hole. That is a second application with a real finding, so the rule is no longer only a hypothesis, though two runs are still a small sample.
