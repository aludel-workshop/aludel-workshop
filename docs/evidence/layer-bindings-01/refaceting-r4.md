# LAYER-BINDINGS-01 step 3, R4: roles in the views — 2026-10-01

## Scope and authorization

Owner chat, 2026-10-01: "go for it", in reply to "Should I commit R3 and start R4?". R3 was committed first (candidate `affce27`, workshop `7c518d2`). The R4 scope is recorded in the [run log](../../../../docs/design/layer-bindings/work-record.md#run-log). It made local commits on `layer-base` and re-pinned them here. Nothing was pushed, and there were no GitHub, provider, deployment, spending or live-data effects.

## What was built

| Piece | Where | What it does |
|---|---|---|
| `@aludel/host/roles` | `apps/portal/src/layers/roles.ts`; mapped in `tsconfig.json`, `vite.config.ts`, `tools/build-layer-ui.mjs` | `LayerRoles` offers `of(ref)`, `forKind(kind)`, `facet(key)`, `editable(ref)`, `editableKind(kind)` and `propose(target, note)`. It reloads when the project's data changes. `<aludel-role-note [ref] / [kind]>` shows one of three things:<ul><li>a replica: "Managed in ⟨authority⟩'s ⟨facet⟩" with **Propose a change**, an inline form that raises Work in the authority's layer;</li><li>ceded: "Now managed in ⟨authority⟩. What is here is read-only history" with a link;</li><li>authority or unshared: nothing.</li></ul> |
| Roles route | `server.mjs` `GET /api/projects/:id/roles`, `POST …/roles/propose`; `layer-ui.mjs` `frameAllows` | Returns the asking layer's facets with role, binding and authority, and which facet each of its entries is in. **A view never names its own layer.** The server takes it from the frame (`x-aludel-layer-frame`), or from `?layer=` outside a frame. Proposing on an authority or unshared facet is refused with 409. |
| Base contract | `layer-base` `main` `b8994b7`: `docs/layer-contract.md`, `tests/contract.test.mjs` | The contract documents `select` and `where`, refaceting, and the roles module. The test accepts `select` with the host's distinctness rule, refuses read-only facets with other roles, and requires a layer whose facets declare views to list `roles` in `ui.hostSdk` and import `@aludel/host/roles`. |
| Design adopts it | `layer-base` `design` `a924ed2` (merge `eceda28`) | The `kit` facet supports authority, replica and ceded. Tokens: a role note, and edits stay a preview that can't be saved unless the facet is edited here. Components: a role note per component, with Add and Edit contract only where editable. Brand: a role note for the kind, Add only where editable, and an asset's drawer showing the note in place of the form. |
| Vision adopts it | `layer-base` `vision` `15eac6f` (merge `859e246`) | Vision declares two facets, `intent` (vision sections, brief claims, personas; Brief tab) and `story-map` (activities, steps, stories; Map tab), each supporting all three roles. Brief: notes for claims and personas; Draft, Add, Edit and Delete only where editable. Map: a note, adding only where editable, and a story's drawer showing the note in place of the form. |
| Re-pins | `apps/portal/config/layer-templates.json` | base `b8994b7`, design `a924ed2`, vision `15eac6f`. |

### Decisions made while building (for review)

1. **Views don't name their own layer.** The first version passed `'design'` and `'vision'`, and it failed at once: Vision's layer key is `product`, and any fork is installed under its own key. The host already knows which layer a frame belongs to, so the SDK asks for "my roles".
2. **Propose a change is an inline form, not a dialog.** Layer frames are sandboxed without `allow-modals`, so `prompt()` returns null there without showing anything. The journey caught this, because no request was ever sent.
3. **Vision's facets** follow the plan's Personas case: `intent` holds personas for now, and the R5 journey will refacet them out. Specs, research and projects are left unfaceted (the layer's own business).
4. **The journey's replica is a mechanical fixture.** Vision's `intent` follows Vision's own `story-map`, the only free authority facet in a fresh project. It exercises the views and is not a product pairing.

## Checks (all run 2026-10-01 on this working tree and these pins)

| Check | Result |
|---|---|
| New browser journey `roles` (templates on) | Pass:<ul><li>Vision's Brief as a replica is read-only, with no Add, Edit or Persona controls. Propose a change sends an inline note and raises Work W-11 in the authority's layer. Proposing on an authority facet is refused with 409.</li><li>Vision's Map as the authority is edited as before.</li><li>Design's Brand as ceded points at Design: no Add asset, and an asset opens read-only.</li><li>Design's Tokens as the authority has no note.</li><li>The host refuses a direct write to a ceded asset with 409.</li><li>Axe passes on both views, with no horizontal scroll at 390px.</li></ul> |
| Mutation check | 5 of 5 caught: frame can't propose; frame can't read roles; propose on an authority (journey); views always editable (journey); no ceded pointer (journey). The base contract test also refuses a missing `roles` in `hostSdk`, a missing import, and an overlapping facet, and accepts a valid by-field split. |
| `node --test tests/contract.test.mjs` in `layer-base` | Passes on `main`, `design` and `vision`. |
| `tools/typecheck-layer-ui.mjs` | design `a924ed2` (6 files) and product `15eac6f` (1 file) type-check. Pages and data pins are unchanged and checked in R3. |
| `npm run test:server` / `:templates` | 271 tests: 257 pass, 14 skipped / 264 pass, 7 skipped. Both had none failing and none cancelled. |
| `npm run typecheck`, `npm run build` | Both exit 0. The icon-subset test first caught `arrow_outward`, which isn't in the font subset; the note now uses `open_in_new`. |
| Browser, templates on: `roles` plus step 2's nine | All 10 pass. |

## Limits

- **Pages has no views for its kit facet**, so it neither needed nor got the module.
- **The proposal is free text,** recorded as Work in the authority's layer with the entry it concerns. Turning it into a concrete change there is that layer's Work.
- **Only the module and two templates were checked.** Other templates (Data, Markdown) declare no facets, so the contract doesn't require the module of them yet.
- **Existing forked instances keep their old pins** until updated, which is the general template-update question (unchanged).

## Retrospective

1. **What made it harder?** Observed: three things failed on first contact, each caught by a check rather than by review.
   - The layer key (`product`, not `vision`) was caught by the journey's 404 on enabling the layer.
   - A name clash (`roles` meant colour roles in Design's Brand tab) was caught by the per-pin typecheck.
   - Sandboxed frames dropping `prompt()` was caught by the journey waiting for a request that never came.
2. **What would make the next one easier?** One sentence in the base contract: "views run in a sandboxed frame without dialogs and never name their own layer". It is recorded in the work record's lessons; the contract text now carries the roles part.
3. **What did it reveal?**
   - Host SDK modules must be layer-relative, so a template works under any key. Older modules that take a layer key (for example `aludel-docs layer="design"`) have the same latent problem for forks. That is a follow-up for T03 work, not fixed here.
   - Frames can't show dialogs, so step 2's Library › Bindings "Dismiss" `prompt()` is fine (it runs in the portal page), but any template using dialogs would silently fail.
4. **Questions.** None block R5.
5. **Process change applied now.** None new. The mutation rule ran a fourth time, all caught on the first run. The new journey proves the views rather than the pure model, which closes the plan's R4 proof. Still a hypothesis: that the contract test's import check is enough to make every future template handle all three roles. It checks the import, not the behaviour.
