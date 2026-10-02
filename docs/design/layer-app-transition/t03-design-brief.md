---
id: T03-DESIGN
kind: work-brief
status: done
updated: 2026-09-30
depends_on: [DEC-055, DEC-057, DEC-059, T03-G1, T03-G2, T03-DATA, T03-VISION]
---

# T03-DESIGN brief: convert Design into a repository-owned layer

Start here. This brief gives a fresh session everything it needs to convert Design onto `layer-base`, the same way Pages, Data and Vision were converted. Read the four linked evidence files before writing code; skip anything else unless a step names it.

## Authorization (owner chat, 2026-09-30)

The owner approved this plan ("plan sounds solid") and will run it in a new chat:

- Design keeps its kit (tokens, components, brand assets) as **records** through its own API. It does not use repository files.
- Design starts with a basic spec preview. That preview must be built so it can later become live experimentation with parameters.
- Nothing in Design depends on a later layer. Pages reads the kit from the Library.

This authorizes bounded local work: code, tests, previews and evidence in `pages-template-candidate` and on `layer-base` branches.

It does **not** authorize:
- GitHub or provider writes;
- provider turns;
- deployment or spending;
- migrating the owner's live data.

Record your own run's start in this file before executing.

### Run log

- **2026-09-30, run 1 (Claude, VS Code chat).** The owner said "continue with this please t03-design-brief.md". Scope is exactly the authorization above: local code, tests, previews and evidence in `pages-template-candidate` (branch `feature/pages-layer-template`, starting at `ab021b0`) and a new `design` branch in `layer-base` (from `main` `4fa64e2`). No GitHub or provider writes, provider turns, deployment, spending or live owner data.
- **2026-09-30, run 1 closed.** Local work complete. Candidate `f2fb8be` pins `design` `bc36f24`, `pages` `e693c19` and base `61565cf`. Shared rendering went to the default (a host SDK app kit). [Evidence and retrospective](../../evidence/t03-design/README.md). `next_action` is T03-CODE.
- **2026-09-30, run 2 (Claude, VS Code chat).** The owner confirmed layer-scoped Work with no actions for every layer. They said Design's starter belongs in its template, and that sources should never have to adopt "the Aludel way": each consuming layer owns an adapter from what a source publishes to its own representation. Asked to proceed ("go") with two packets:
  - **T03-DESIGN-SEED:** move the starter kit (Look & feel tokens and their sync, component seeds, brand starters, brand templates) into the `design` template.
  - **T03-ADAPT:** Pages consumes the kit through a Pages-owned adapter, with its source taken from the Library rather than the key `design`. Remove Design's hidden read of Pages.

  Scope and exclusions are the same as run 1: local code, tests and evidence in `pages-template-candidate` and `layer-base` only.
- **2026-10-01, run 2 closed.** Both packets are complete locally: `design` `64e916f`, `pages` `96194a1`, base `2449ff8`. [Evidence and retrospective](../../evidence/t03-design-seed-adapt/README.md). `next_action` is T03-CODE.

## Fixed decisions you must not reopen

| Decision | Source |
|---|---|
| Layers read each other only through the Library, never by calling each other | DEC-059 (1) |
| An output is kept either as records (project database, layer API) or as files in the layer repository | DEC-059 (2) |
| **The Design kit is output for the app being built, never the portal's theme.** The portal and layer frames keep the portal's own theme | DEC-059 (3) |
| Previews have levels: spec, static mockup, interactive HTML, rendered code. Start at spec level (placeholder-ish) and plan to make it polished. Designers must eventually be able to experiment with their parameters immediately | DEC-059 (5) |
| Work names a layer, with no per-action catalogs. Elevated review per layer; layer default assignee | DEC-057 |
| Each installed layer instance is its own repository, forked from a template branch of `layer-base` | DEC-055 |
| Owner UX direction for Design: two-pane token editor (tree and live preview, no inspector); edit raw values on the preview; hover a token to highlight where it is used; a preview that feels like a small app; three panes for components; brand assets seeded, not required, and including text | `design-layer/work-record.md`; memory `design-layer-direction` |

## Starting state

| What | Where |
|---|---|
| Candidate (isolated portal) | `pages-template-candidate` at `ab021b0`, branch `feature/pages-layer-template` |
| Base layer repository | `layer-base`. Branches `main`, `markdown`, `pages`, `data`, `vision`; template pins in `apps/portal/config/layer-templates.json` |
| Reviewed handler digests | `apps/portal/config/layer-reviewed-sources.json` (path → sha256 list) |
| Prior evidence, read these four | `pages-template-candidate/docs/evidence/` `t03-g1-library`, `t03-g2-files`, `t03-data`, `t03-vision-rules` |
| Layer contract | `layer-base` `docs/layer-contract.md`: files, two output modes, operation conventions, `x-aludel-context`, `x-aludel-catalogs`, `x-aludel-parent`, `hostCalls` |

## Design today (inventory)

| Piece | Location | Notes |
|---|---|---|
| Output kinds | `design_tokens` (singleton set), `component`, `brand_asset` | Declared in `server/layer-contract.mjs` `legacyDeclarations` |
| Rules | `server/design.mjs`: `cleanTokens`, `cleanComponent`, `cleanBrandAsset`, plus `componentGroups`, `previewKinds`, `brandTypes`, `brandKeys`, `componentSeeds` | Wrapped by `knowledge.mjs` validators and `checkDesign` (cross-record checks) |
| Seeding | `knowledge.mjs` `ensureDesign`, `syncDesignFromLook` (the onboarding "look" sets tokens), `addBrandTemplate` with `config/brand-templates.json` | Host seeding. Keep it in the host for now and have it call the layer's rules, as Vision's seeding does |
| Views | `src/layers/design.ts` (37 lines), `design-tokens.ts` (626), `design-components.ts` (344), `design-brand.ts` (169), `design-state.ts` (73, with a **draft token set previewed live across every Design tab**; that draft is the seed of "experiment immediately", so keep it) | Move into the template's `ui/` and run them in the frame |
| Token math | `src/design-tokens.js` (222): `tokenVariables`, `roleColor`, `markSvg`, `bannerSvg` | Pure and app-agnostic |
| Consumers | **Pages template** imports `@aludel/host/design-components` (`ComponentRenderComponent`), `@aludel/host/design-state` (`ThemeScopeDirective`), `@aludel/host/design-tokens` (`Tokens`, `tokenVariables`) for its spec preview. Code's scaffold and `server.mjs` read tokens and components (`designFiles`, `tokenStyles`) to generate the app | See the main design question below |
| Owner decisions to carry | `docs/design/design-layer/work-record.md` (owner brief ledger, build brief, owner acceptance) and `docs/evidence/design-ux-01-design-layer.md` | Build the migration ledger from these |

## The main design question, with a default

Pages renders its spec preview with Design's rendering code, which today is compiled into the portal. Under DEC-059 Pages must not depend on the Design layer.

**Default:** make app-kit rendering a **host SDK library that takes kit data as input**:
- token math, the component renderer and the theme-scope directive, with no knowledge of any layer;
- Design's views and Pages' preview both pass it the kit, Pages reading it from the Library;
- with no Design installed, Pages gets an empty kit and renders a plain spec preview.

This keeps the code shared without one layer depending on another. Record the choice and why. If inspection shows the renderer is really Design-specific, the alternative is a plainer Pages preview of its own, which the owner accepted as a placeholder ("plan to make it pretty").

## Recipe (from Pages, Data and Vision, with their lessons)

1. **Ledger first.**
   - Add `docs/migration-ledger.md` and `docs/source-inventory.md` on the new `design` branch: every owner decision and built behavior, marked preserved, revised with owner acceptance, or unavailable with a reason.
   - Inventory the UI source, writer, Knowledge, Work boundary, export and host calls before claiming portability. (Data's lesson: a unit test passed while the UI still came from the portal.)
2. **Template branch.**
   - `git checkout -b design main` in `layer-base`. Keep the instance key `design`.
   - Add `layer.json`, `knowledge/charter.md`, method docs, `api/openapi.json`, `server/design-api.mjs` (pure; port the `clean*` rules unchanged, with the same messages) and `ui/`.
   - Host catalogs the rules need go in `x-aludel-catalogs` (for example preview kinds or component groups). Add them to `loadCatalogs` in `onboarding.mjs` if they aren't there.
   - Cross-record rules (`checkDesign`) belong in the handler, using `x-aludel-context`.
   - Request any host routes the views still need by name in `hostCalls`. Add a named feature in `server/layer-ui.mjs` `hostFeatures` only if one is missing. **Never branch on a layer key.**
3. **Parity fixture.**
   - Export every Design record a seeded project stores (the scratch export script pattern: a seeded onboarding project, `know.list` per kind) to `fixtures/design-records.json`.
   - Test that `normalize` returns each record unchanged.
   - Test that the API's write operations and handlers match one to one.
4. **Host wiring.**
   - Pin the branch commit and add `"design": "design"` to `builtIn` in `config/layer-templates.json`.
   - Add the handler's sha256 to `layer-reviewed-sources.json`.
   - Startup backfills untagged Design records to the instance (`backfillLayerOutputScope`, already generic).
   - Make the frame build the views. Keep the compiled view as the templates-off fallback.
5. **Checks** (all required, both modes):
   - `npm run test:server` (templates off) and `npm run test:server:templates` (templates on). The template suite must stay at zero failures. Any new skip needs a stated reason; any legacy expectation DEC-057 changed asserts per mode.
   - The template branch's own tests, including the base contract test.
   - `npm run typecheck` and `npm run build`.
   - Browser, templates on: a `design-layer` journey through the frame (tokens with a draft previewed live, a component, a brand asset, Library entry, axe, 390 px). Rerun `pages` (it now reads the kit from the Library), `vision-layer`, `data-layer`, `library`, `layer-bar` and `layer-scope`.
   - Run any journey that fails intermittently at least four times, and report the pass rate.
   - Check that every handler at every pin is on the reviewed list (the Python snippet in the T03-VISION run).
6. **Closeout.**
   - Evidence and retrospective in `pages-template-candidate/docs/evidence/t03-design/README.md`.
   - One commit in the candidate; template commits on `layer-base`.
   - Update the `docs/status.md` completed row and latest handoff, and add a section to `layer-template-conversion.md`.
   - Set `next_action` to T03-CODE.

## Pitfalls already paid for

- **Per-project store (PROJECT-DB-01):** every project table lives in its own SQLite file. `project-store.mjs` refuses an aggregate query (`MAX`, `COUNT`) on a project table without a project, and refuses mixing platform and project tables. Bind `project_id`, or use a plain `SELECT … ORDER BY … LIMIT 1`.
- **Generic record routes:** the host's `/records` create and update map a person's write onto the layer's operation. Parents go through `x-aludel-parent` and ordering through `position`. Check that every field the views send survives that mapping (Vision's lost parent).
- **Revisions captured when an edit starts:** views now write one at a time (`ctx.write` is a queue). An edit that runs right after another must read the record's current revision when it runs (`pageById().get(id).revision`), not the one captured when the edit started (the lost-note race).
- **Legacy tests with imports partway down the file:** put a module-level flag after the *top* import block.
- **Build staging:** `tools/build-layer-ui.mjs` stages into `.layer-ui-src-*` in the portal directory. These folders are git-ignored and cleared after ten minutes. Check `git status` before committing anyway.
- **Smoke-checking imports:** never import `server/server.mjs` to check it, because that starts a portal on the default data directory. Use `node --check`, or set an explicit temporary `MACHINE_DATA_DIR`.
- **Python edits:** write multi-line replacements as a script file with an assert per match, so a mismatch writes nothing rather than half the edit.
- **Browser runs:** `PLAYWRIGHT_MODULE=/home/henry/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs MACHINE_LAYER_TEMPLATES_ENABLED=1 tools/browser-checks.sh <names>`. Build first. The old `layers` journey is stale and fails identically on `7ceebd7`.

## Open owner questions (not blocking Design)

1. Is DEC-057 layer scoping acceptable for Vision Work? It removes the `product.*` actions and per-style presets, as already happened for Pages. Design will get the same treatment.
2. Should other Pages Map and Flow edits get the latest-revision fix applied to titles and notes?

## After Design

- **T03-CODE.** The app repository *is* the Code layer repository (DEC-059 reverses that clause of DEC-055). Connecting an existing repository must be supported.
  - Code units, releases and route observations can be derived from the repository at a commit.
  - Trace links become a file in the repository.
  - Its writable set is the codebase, not `outputs/`.
- **Deploy stays deferred.**
- **When the last layer passes**, retire the compiled built-in layer modules and the `legacyDeclarations` catalog together.
