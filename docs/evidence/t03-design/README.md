# T03-DESIGN: Design as a repository-owned layer — 2026-09-30

## Scope and authorization

The owner approved the T03-DESIGN plan in chat on 2026-09-30 ("plan sounds solid") and started this run with "continue with this please t03-design-brief.md". The run is recorded in [the brief](../../../../docs/design/layer-app-transition/t03-design-brief.md#run-log). It covers local code, tests, previews and evidence in `pages-template-candidate` and on `layer-base` branches only. There were no GitHub or provider writes, no provider turns, no deployment or spending, and no live owner data.

## Outcome

- **Design is a template.** `layer-base` branch `design` (pinned at `bc36f24`) owns:
  - the manifest, the charter and three method notes (tokens, components, brand);
  - the views: Tokens, Components, Brand and Docs, with the live token draft;
  - the rules, in `server/design-api.mjs`, and a 9-operation API (`api/openapi.json`);
  - a parity fixture, a migration ledger and a source inventory.
- **Records mode.** Design keeps the app kit as records through its own API (DEC-059 (2)).
  - The rules for `design_tokens`, `component` and `brand_asset` are ported unchanged, with the same messages.
  - Every record a seeded project stores (28 records) normalizes to itself.
  - The project's one token set is a singleton operation (`setTokens`).
  - Cross-record rules run in the handler over `x-aludel-context`: one asset per brand key, brand colour roles that exist, and a component nested only in a component.
  - The host still checks that an upload belongs to the project and keeps its seeding (`ensureDesign`, `addBrandTemplate`, `syncDesignFromLook`), which now runs through the layer's rules.
- **The main design question: shared rendering became a host SDK library.** The portal has a new `@aludel/host/app-kit`, which holds:
  - the token maths;
  - the component renderer;
  - the theme scope;
  - `loadKit`, which reads the kit from the Library.

  It knows no layer and takes kit data as input. Design's views and Pages' spec preview both use it. **Why:** inspection showed the renderer and the theme scope never touched Design's records or state; only the editor did. So sharing the code needs no dependency between layers. The old `@aludel/host/design-components` and `design-state` paths still export the moved pieces, so forks pinned before this change still build (the old Pages pin `b8fd73c` type-checks).
- **Pages reads the kit from the Library** (`pages` `e693c19`).
  - The Library gained one generic option, `data=1`, which returns each output entry's content so a reader can take a whole kind in one call.
  - Pages asks for `design_tokens`, `component` and `brand_asset` entries, whichever layer publishes them.
  - With Design switched off it gets none, and the preview falls back to plain placeholders.
  - Nothing in Pages imports Design code or reads Design's records from the project snapshot.
- **Built for later live experimentation (DEC-059 (5)).** The preview is spec-level. Two pieces carry it forward:
  - Design's draft token set already re-themes every Design tab live before it is saved.
  - The app kit takes the kit as data, so a later "experiment with parameters" control only has to pass a draft kit to the same renderer.
- **Named host features, no layer-key branches.**
  - `uploads` (POST `/assets`): a brand image.
  - `brandTemplates` (POST `/brand-templates/:id`): adding a template's stock assets.
  - `libraryRecords`: the record kinds `doc` and `evidence_link`, for Design's Docs tab and component references.

  A frame gets these only when its manifest asks for them.
- **Templates off** keeps the compiled Design view and host rules as the fallback.

## Checks

All runs were local, on 2026-09-30, at candidate code with `design` `bc36f24`, `pages` `e693c19` and base `main` `61565cf` pinned.

- **Server suite, templates off:** 222/222. This is 217 before this packet plus 5 new tests in `tests/design-layer.test.mjs`.
- **Server suite, templates on (`npm run test:server:templates`):** 215 pass, **0 fail**, 7 skipped. The skips are the same 7 the Vision run explained.
  - Two failures came up along the way, both fixed:
    - `layer-charter` asserted the compiled Design charter. It now asserts per mode: with templates on, the charter is the template's.
    - `editor-bridge` gave a spawned portal 8 seconds to start. With templates on, that start-up seeds two unseeded projects, and each seeded Design record runs the handler in a sandboxed child process (about 22 ms a call, measured). Under the parallel suite this ran past 8 s. Measured alone, Design adds about 0.9 s per unseeded project (5.4 s against 3.6 s without Design's pin). The test now allows 20 s, and the per-call cost is a limit below.
- **New host test, `tests/design-layer.test.mjs` (5):**
  - The template supplies the views, Knowledge, API and host calls.
  - The seeded kit is written through Design's rules into its instance.
  - People's writes keep every rule: singleton tokens and a stale revision, brand key and colour role, upload ownership, nesting, slot references, and host writes running the layer's rules.
  - An agent's call produces writes without applying them.
  - The Library serves each kit kind with its data, and returns none with Design switched off.
  - An existing templates-off project adopts without changing IDs, revisions or content.
  - The frame feature allowances hold.
- **Template branches:** `design` 7 pass, 2 base-contract skips (no sandbox copy, no file outputs). Also `pages` 10, `vision` 6, `data` 5, `markdown` 4 and `main` 1, each with its existing skips.
- **Parity:** all 28 records a seeded project stores normalize unchanged: 1 token set, 15 components, 12 brand assets including the three templates' stock assets. The template test checks the operations and handlers match one to one.
- **Typecheck and build:** `npm run typecheck` and `npm run build` pass, with the existing optional-chain and chunk-size warnings only.
- **New `tools/typecheck-layer-ui.mjs`:** `design` `bc36f24`, `pages` `e693c19`, the old pages pin `b8fd73c` and `vision` `eac6132` all type-check against the host SDK.
- **Browser, templates on:**
  - The new `design-layer` journey passed **5/5** in its final form, the last run on the final server code. It covers:
    - a token draft that re-themes the Tokens preview and is still applied on the Components tab before saving;
    - saving one revision (Library revision 2, `fromLook` cleared);
    - Pages' spec preview in the saved theme, and an empty kit with Design off;
    - a needed component;
    - a reference to a Library finding (`libraryRecords`);
    - a brand template (`brandTemplates`) and an uploaded image (`uploads`);
    - the component found in Library search;
    - axe on the Library, the portal and the Design frame (components, tokens, brand at 390 px), with no sideways scroll at 390 px and no page errors.
  - `pages`, `vision-layer`, `data-layer`, `library`, `layer-bar` and `layer-scope` passed again.
- **Browser, templates off:** the compiled `design` journey (17 screens, axe on each, token save reaching the generated app), `pages` and `layer-bar` pass.
- **Reviewed sources:** every handler and indexer at every pin is on the reviewed list. That covers `pages-api`, `flow-change`, `markdown-api`, `data-contract`, `vision-api` and `design-api`.

## Limits

- Design's own views still read Design records from the project snapshot (`/knowledge`), as Vision's do. Only other layers are held to the Library.
- Seeding, the Look & feel sync, brand "Used in", and the scaffold's use of the kit (`designFiles`, `tokenStyles`) stay in the host. Code's use of the kit moves with T03-CODE, which should read it from the Library like Pages does.
- The host's `checkDesign` stays as a backstop for host seeding and templates-off. It duplicates the handler's cross-record rules until the compiled layers retire.
- The template's `ui/design.scss` copies the portal's Design styles, which the portal keeps for the fallback (as Data did). The two copies should go when the compiled view retires.
- Pages rereads the kit on every snapshot reload: three Library calls. That is fine at current sizes; an incremental read is later work.
- Under DEC-057, Design Work is layer-scoped in template mode. The compiled `design.*` actions are not offered, as already happened for Pages and Vision.

## Retrospective

1. **Harder than necessary (observed):**
   - A Vite build of a template's views exits 0 with type errors in them. I checked this with a probe commit carrying a TypeScript error and an Angular template error: the build passed, the new type check failed on both. Before this, a view's type errors would surface only as a broken frame in the browser.
   - The Pages journey never checked which kit or theme it drew with, so a passing `pages` run did not show where the kit came from. I added the check to the Design journey.
   - My first theme check re-navigated on each poll and so always read the preview before the kit arrived.
   - I changed pins while a suite was running, which made that run inconclusive. I reran both modes after the last pin.
   - A test-only placeholder row hit the per-project store's routing (drafts route through `symphony_attempts`). The existing `callOperation` pattern was the right test.
2. **Easier next time:**
   - Run `node tools/typecheck-layer-ui.mjs ../../../layer-base <commit>` for every template commit you pin.
   - In each layer journey, assert what the view reads from other layers, not only that it renders.
   - Finish pinning before starting a suite, and keep other work off the machine while it runs.
3. **Roadmap and architecture effect:**
   - Shared rendering belongs in the host SDK and takes data as input. This is the pattern for any layer that previews another layer's output.
   - Code should read the kit from the Library for its scaffold in T03-CODE. Today it reads the project store directly.
   - Each handler call costs one sandboxed child process (about 22 ms). That is fine for people's edits but adds up for host seeding and bulk writes. A batched `normalize` call is a candidate before more layers seed many records.
4. **Questions:**
   - Created: should the kit's host seeding (component seeds, brand starters) move into the template, as Vision's seeding might? This is not blocking.
   - Still open: DEC-057 layer scoping for Vision Work (it now applies to Design too) and the latest-revision treatment for other Map and Flow edits. Neither blocks T03-CODE.
5. **Process change applied and tested:**
   - The type-check tool caught both probe errors that the frame build let through, and it passed on the four real pins.
   - The base contract now documents `uploads`, `brandTemplates`, `libraryRecords` and the host SDK rule (`main` `61565cf`).
   - The Design journey now checks a cross-layer read and its fallback. Whether the type-check step is kept up for T03-CODE is untested until that packet.
