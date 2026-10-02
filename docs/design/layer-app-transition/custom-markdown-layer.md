---
id: CUSTOM-LAYER-01
kind: work-record
status: complete
updated: 2026-09-29
depends_on: [LAT-08, LAYER-FRAMEWORK-01]
---

# CUSTOM-LAYER-01 · user-defined Markdown layer

## Owner instruction and bounded authorization

In the current chat the owner asked to create a custom layer app. Its first output format is a filesystem of Markdown documents. It has one editor tab, with an editable file tree on the left and the open document in the center, in a familiar IDE composition. It receives the same Operations and Knowledge spaces as built-in layers. This is intended to test and refine the layer abstraction before applying it broadly to built-in concepts, especially Work tasks, routines, actions and connections that modify or respond to output.

The instruction authorizes bounded local design, repository edits, tests, and a local isolated preview. It does not authorize external accounts or writes, provider turns, spending, release, promotion, or acceptance. LAT-08 remains open for owner browser review and original-data startup proof; this new owner instruction reprioritizes the next local packet rather than marking LAT-08 complete. Preserve the owner-created project in the existing LAT-08 preview; build this packet in a separate candidate and data copy.

## Brief ledger and observable checks

1. **Create my own layer:** a project owner names a layer, installs it, opens it from Home and the rail, removes/readds it without losing output, and may create more than one. Project scoping and duplicate-name/key behavior are explicit.
2. **Markdown filesystem output:** each custom layer owns an actual local directory of `.md` files. The owner can create folders/files, rename/move, delete and edit Markdown with path validation, optimistic revision checks and retained history. Empty, one-file and nested trees are inspectable. No arbitrary file type or path outside that layer can be read/written.
3. **One editor tab:** the layer's Outputs surface is an editor with a left file tree and central document editor. Selection, save, unsaved changes, reload/conflict and narrow layout are checked. No special Pages-style output editor is implied.
4. **Shared spaces:** Operations is Board/Routines/Actions/Connections and Knowledge is the shared revisioned tree for this instance, using the same project access and owner controls as built-ins.
5. **Work and adaptation:** task creation can target an exact Markdown path/revision or propose a new path; an action names allowed effects and review. Neighbor installation stages reciprocal discovery Work, and connection policies belong to the receiver. Routines can stage scoped Work from changed Markdown output without self-Go or policy activation. A provider run is separately authorized and is not part of this local trial.
6. **One framework:** built-in and user-defined layers resolve through the same per-project layer definition contract: identity, output providers and types, output view tabs, actions, routines, Knowledge and connections. A built-in layer is a seeded definition with richer output/editor adapters. The Markdown layer is a definition with one output provider and one editor adapter. No independent custom-only registration or shared-space path should be needed.

## Process finding, choices and readiness

LAT-08's first owner journey found that shared UI claims were based on Pages as a special case. This packet's additional gate is a second instance of the same custom format: the abstraction is unproven if only one hardcoded `custom` layer works. Tests must cover two named custom layers in one project plus a built-in neighbor, including separate output roots, Work and Knowledge. Definition lookup must become project-scoped rather than extending the six-item static array with one reserved singleton. The six built-ins must be represented through the same definition reader used by custom layers; their existing editor, output and action adapters may remain specialized implementations behind that reader during this packet. A new project must be able to instantiate a base definition and eventually replace its output/editor adapters until it can express a built-in layer without changing shared navigation, Knowledge, Work or connection code.

Existing facts: `layer_instances` already keys by project and layer; Work, docs, connection policies and receipts store a layer key. The current code nonetheless rejects keys absent from `layerDeclarations`, hardcodes the rail and action catalog, and snapshots only built-in output kinds. The shared Operations/Knowledge composition and Work Go review boundary exist in the LAT-08 candidate. The proposed local output authority is a per-layer directory under private project data, with SQLite identity/revision metadata and atomic file writes; the project code repository remains clean for Go. Repository-backed layer authority is a separate later decision under LAYER-REPOSITORIES-01.

**Readiness verdict:** ready for an isolated local implementation. The owner specified the primary composition and output type; the existing shared UI pattern is an applicable starting point. The storage location and action review semantics are reversible local choices, recorded here. Any custom agent adapter must be proved end-to-end before advertised as runnable. Owner browser judgment of the editor and task model remains a gate.

## Dependency-ordered work

1. Add one project-scoped layer-definition registry and descriptor lookup for both seeded built-ins and owner-created definitions; preserve existing IDs, outputs and projects. Define adapter slots for output authority, output view, action catalog and revision reads. Keep built-in adapters behind those slots rather than migrating their native editors now.
2. Add private Markdown root, safe file/folder operations, revision ledger and read API.
3. Add Home creation, rail entry and single Editor output surface.
4. Route shared Knowledge, Operations, discovery snapshots, actions and Work task creation through the common registry for built-in and custom instances. Exercise the same API and UI paths with both.
5. Exercise two custom layers and one built-in in fresh data; check access, path traversal, conflict, restart, idempotence, Work review and narrow UI; prepare a separate owner preview.

## Handoff and stop condition

Stop for owner browser testing when the built candidate makes all six asks inspectable without an agent/provider turn, the automated checks pass, and the remaining unproved execution boundaries are named. Do not claim LAT-08 or CUSTOM-LAYER-01 accepted from agent checks alone. Exactly one `next_action` points here while this packet is active.

## Local implementation checkpoint · 2026-09-29

The isolated candidate is `feature/custom-markdown-layer` in `custom-layer-candidate`. A project-scoped `layer_definitions` row now describes both seeded built-ins and owner-created Markdown layers, including output provider and editor adapter. Shared navigation, descriptors, Knowledge, Operations, action installation and discovery resolve by that definition. Native built-in editor adapters still supply their specialized output views.

A Markdown layer owns a private `layer-outputs/<project digest>/<layer key>` directory and a revision ledger. The editor shows a hierarchical folder/file tree and a central Markdown document. The owner can create, edit, move and delete files, create/move/delete empty folders, and create an edit Work item tied to the selected path, file ID and revision. An active person run may link saved file revisions to its Work review packet. The common Operations board shows these items; Actions lists both installed custom actions; Knowledge seeds output, action, routine and connection documents. Adding a layer stages reciprocal neighbor discovery Work. A custom discovery Go snapshot includes source identity, revision, fingerprint and bounded Markdown excerpts; any proposed receiving policy still needs owner review. Enabled output-change routines stage layer Work after a file create, edit or move.

**Observed checks.** The focused Markdown contract test passed with two custom instances in one project and one built-in, covering project isolation, owner-only writes, path traversal rejection, exact revisions, file/folder moves, descriptor reads, discovery snapshots and installed action grants. Full server tests passed **159/159** after the routine seeding correction. Angular typecheck passed with only pre-existing optional-chain diagnostics; the production build passed. The separate preview started on `http://aludel.localhost:4401` with database `/tmp/aludel-custom-preview-20260929/machine.sqlite`, made by a SQLite backup of the earlier isolated preview. GET `/` returned 200 and an unauthenticated layer-definition read returned 401. No provider turn was started; Symphony dispatch remains disabled.

**Owner browser check needed.** In the separate preview, open the retained project, create two custom layers, create a nested folder and Markdown file in one, edit and save it, create an edit task, and inspect its Operations Board/Actions and Knowledge beside Vision or Pages. Add another built-in layer if needed, then inspect reciprocal discovery Work and proposed connections. Confirm the narrow file tree and editor feel usable. This is browser acceptance, not yet observed. The live person-run file-change review journey and agent discovery submission remain unproved in this preview. The copied preview database intentionally has a separate output root, so custom files written here do not modify the earlier LAT-08 preview.

## Post-hoc retrospective at the local checkpoint

1. The inherited static six-key checks were spread across action migration, Work creation, discovery, shared spaces and the rail. This made a single new layer key appear to work in descriptors while failing at Work admission or routine creation. A common registry reader reduced that drift.
2. The next equivalent adapter should start with a two-instance fixture and one built-in, then exercise action installation, discovery and output revision reads before styling the editor. The test now checks those boundaries.
3. Built-in routines are seeded before optional layer instances are installed. A new custom-layer validation initially rejected that path and caused broad test failure; the full suite detected it. Future shared-layer checks must preserve the built-in onboarding order while validating custom definitions at creation/update.
4. Browser judgment remains necessary for the editor and Work review. A further adapter contract is needed before another output type can claim full parity: native editors still have specialized code, and Markdown discovery currently exposes bounded excerpts in its Go snapshot.
5. The process change applied now was to use the project-scoped definition reader and a two-custom-instance fixture before further built-in migration. It is supported by the focused contract test and 159 passing server regressions. Recreating a built-in entirely from a base definition remains a design goal, not an achieved runtime claim.

## Editor UX pass · owner instruction 2026-09-29

In the current chat the owner said the Markdown layer's Editor tab is "very poorly designed and unintuitive" and asked for a VS Code-like composition: a simple, clean file tree on the left; unobtrusive add file/folder actions at each level; a cleaner Markdown editor for the selected file; and tabs for open files. This authorizes bounded local UI edits to `custom-layer-candidate` (`apps/portal/src/layers/markdown-layer.ts` and its styles), typecheck/build/tests and the existing local preview. It does not change the server contract, authorize new dependencies with licence impact, provider turns, external writes or acceptance.

Brief ledger: (1) clean hierarchical tree with collapse/expand; (2) add file/folder inline at root and at any folder, visible on hover rather than permanent forms; (3) a cleaner Markdown editing surface for the active file; (4) tabs for several open files; (5) overall VS Code feel. The named reference is VS Code, so no separate prototype round precedes the build: the isolated candidate preview is the inspectable artifact, and owner browser judgment remains the gate.

### Editor UX pass · result (agent-checked, not owner-accepted)

Built in `custom-layer-candidate` (`apps/portal/src/layers/markdown-layer.ts`, the `CUSTOM-LAYER-01 Markdown editor` section of `src/styles.scss`, new `tests/markdown-editor-browser.mjs`). Server contract unchanged; no new dependency.

- **Explorer:** folders-first tree with chevrons, indent guides and a resizable, hideable sidebar (Ctrl+B). New file/folder icons appear in the header and on the hovered folder row. Names are typed inline in the tree; `.md` is appended, and a typed `a/b/c` creates missing folders. A refused name keeps the box open with the server's reason. The context menu (right-click or Shift+F10) offers New File/Folder, Open, Rename (F2), Delete (Del) and Copy Path. Arrow keys move and expand, and drag-and-drop moves a file or folder. Non-empty folder delete still follows the server rule.
- **Tabs:** a single click opens a preview tab (italic) that the next single click replaces. Double-click, Enter or editing keeps it. Tabs show a dirty dot that turns into × on hover, close on middle-click or Delete, show the folder when two share a name, and keep caret and scroll per tab. Clean tabs follow renames and outside revisions; dirty ones are flagged stale. Open tabs, expanded folders, width and view persist per viewer in localStorage.
- **Editor:** breadcrumbs, revision and Source / Split / Preview toggle; line numbers, current-line highlight and colour-only Markdown highlighting via a transparent textarea over a mirror (native undo, spellcheck and IME kept). Tab indents (Escape then Tab leaves), Enter continues lists, and Ctrl/Cmd+S saves. The preview renders headings, lists, tasks, tables, quotes and code. Relative `.md` links open in a tab. A status bar shows save state, Ln/Col and words. With nothing open, a watermark lists the shortcuts.

**Observed checks (2026-09-29):** `tools/browser-checks.sh markdown-editor` passed on a fresh portal. It covers folders-first order, preview/pinned tabs, inline create in a folder and nested create, the refused-name error, typing, list continuation, undo, Ctrl+S to r2, context-menu folder rename with open tabs following, F2, arrows, drag to root, split preview, axe clean on the split and empty editor, reload restore, 390px with no horizontal scroll, and the overlay's measured content height equal to the mirror in three layouts. Server tests 159/159; typecheck passed with the four pre-existing NG8107 warnings; build passed; `css-collisions` shows only intended descendant overrides. The 4401 preview serves the new bundle. Owner browser judgment is still required.

**Retrospective.** (1) Three defects were found only by driving the real UI: duplicate tabs from a double-click race, drag-drop refusing every drop because state was cleared before validation, and axe's nested-interactive and contrast findings. Two harness mistakes (sampling before re-render; measuring the stretched textarea) initially looked like product bugs. (2) For editor-like UI, a browser script that waits on state and measures overlay geometry should come before visual polish. It is now committed as `tests/markdown-editor-browser.mjs`. (3) Adapters for other output types could reuse this explorer/tabs shell; that is a design hypothesis, not yet extracted. The textarea overlay has limits: no multi-cursor, no find/replace, and colour-only highlighting. A licensed editor component (CodeMirror 6, MIT) would be a separate owner-visible dependency decision. (4) Open questions: should non-empty folders delete recursively (a server rule change), and should unsaved drafts survive in-app navigation? Neither blocks review. (5) Process change applied: the editor now has a repeatable browser check in the standard runner, proven by one passing run. Whether it catches future regressions is still a hypothesis.

## Identity and activation correction · owner instruction 2026-09-29

The owner observed that a file tree and generic edit action do not give a layer purpose. A Research layer needs a defined domain, method, taxonomy, quality bar, project role, and actions such as adding sources or synthesizing insights. Neighbor discovery cannot infer relationships from a name and output type alone. The owner also improved the candidate editor; preserve that work. This instruction authorizes bounded local design, code, tests, and preview updates to add a setup process and meaningful action definitions. No provider turn or external effect is authorized.

**Process finding:** activation was treated as a side effect of creation. This let incomplete declarations enter the project graph and produce speculative discovery tasks. The reusable rule is that a layer definition has a versioned identity and explicit readiness state. Creation may make an editor available in draft; discovery and connection evaluation require an active identity. Tests must assert that draft layers do not appear in neighbor discovery and that identity revisions cause fresh, reviewable discovery.

**Design choice:** each receiver still owns its directional connection policy, because Design consuming Pages is a different decision from Pages consuming Design. The connection view will expose the peer's reciprocal policy and any disagreement. There is no independent pair authority yet; adding one would make it unclear who can revise the interpretation.

**Observable checks:** a custom layer starts as draft; the owner can write purpose, scope/content, methodology, output conventions/taxonomy, quality bar, project role, and collaboration intent, each with revision history. Owner-authored domain actions name real work, method and review checks. The Editor can stage a configured action for a path/revision. Activation requires a complete identity and at least one domain action, then stages discovery for active neighbors only. Built-ins remain seeded active definitions and keep their current adapters. Changing the active identity increments its descriptor version and restages discovery; it cannot silently activate a connection. Knowledge exposes the canonical identity, and a connection shows both directional views.

### Identity and activation implementation checkpoint · 2026-09-29

The shared project registry now stores a lifecycle and revisioned seven-part identity for seeded built-ins and custom Markdown layers. Creation leaves a custom layer in draft while its Editor and Setup remain available. Activation requires every identity field and at least one configured domain action. Only active instances enter neighbor discovery or connection selection. Saving an active identity increments its descriptor version and restages reciprocal discovery; the pinned source snapshot includes source identity and both directional policies. Knowledge exposes the identity with revision history, including on Pages, and each connection detail shows the peer's reciprocal view. The owner-built Markdown editor is retained. Its Work control and custom routines select configured domain actions; the historical generic edit action is hidden from new setup but remains resolvable for existing Work. An enabled or manually run routine cannot use an absent action or an inactive layer.

**Observed checks.** The lifecycle fixture passed with two custom drafts and one built-in, incomplete activation rejection, action and identity setup, reciprocal discovery on activation and identity revision, project isolation, path/revision safety and reinstallation. Focused discovery/Markdown tests passed 6/6; a new custom routine regression passed, and the final full server suite passed 160/160. Angular typecheck and production build passed. The local 4401 preview returned HTTP 200 for `/` and `/api/session`, with Symphony dispatch disabled. Browser automation could not be rerun in this environment because the previously configured Playwright module and Chromium binary are absent. Owner browser review remains the acceptance gate.

The earlier `/tmp/aludel-custom-preview-20260929` database is no longer present in this workspace session. The 4401 preview now uses a fresh, ignored data directory in the candidate worktree, `apps/portal/.data/custom-preview`; it requires local owner setup and a new project. This does not change the earlier LAT-08 candidate or the repository's main portal data.

**Retrospective.** The missing identity was a lifecycle error as well as a content gap: naming a layer immediately exposed it to peers. The draft/active gate and versioned identity now prevent premature discovery in the tested fixture. The generic edit shortcut also leaked into routines, so admission now requires an action from the layer's own domain catalog. The broader claim that the setup prompts produce useful Research or Design relationships remains a hypothesis until the owner tests the browser journey and reviews a discovery proposal; no provider run or connection acceptance was performed. The next equivalent adapter should begin with an identity/action/activation fixture before its editor is built. The shared Pages route needed an explicit handoff to the common Knowledge handler; this was caught by reviewing route precedence after implementation.

### Owner direction and build authorization (2026-09-29)

Owner reply in chat: keep the layer heading above the bar, not inside it. Actions and routines are reached from inside Tasks through a sidebar overview; selecting one opens its management page with a back arrow to Tasks. Manage gets a left sidebar with Settings, Connections and Knowledge, as a trial. The owner is wary of nesting (app sidebar, then tabs, then another sidebar), so the Aludel layer sidebar should be able to collapse to an icon rail. "Skip the prototype, build it." This authorizes bounded local UI and routing changes in `custom-layer-candidate`, with tests, build and the existing local preview. It does not authorize server-contract changes beyond what the navigation needs, provider turns, external writes or acceptance.

Brief ledger: (1) one layer bar, with output tabs left (scrolling) and Tasks and Manage fixed right, under the heading; (2) built-in and custom layers use the same bar, which ends Editor versus Outputs; (3) Tasks = board plus an Actions/Routines sidebar overview, with detail pages that go back to Tasks; (4) Manage = sidebar with Settings (identity; replaces custom Setup), Connections, Knowledge; (5) a collapsible app sidebar that becomes an icon rail; (6) no nested tab rows, checked by a browser test.

### Layer navigation · result (agent-checked, not owner-accepted, 2026-09-29)

Built in `custom-layer-candidate` `apps/portal`:
- `src/layers/layer-nav.ts`: output tabs per editor adapter, redirects for old links, layer colour.
- `layer-tasks.ts`: board, Actions/Routines sidebar, routine and action pages with a back link, custom action form.
- `layer-manage.ts`: Settings, Connections and Knowledge in one sidebar.
- Shell: heading, one bar and a collapsible icon rail.
- Built-in layers no longer draw their own heading or tab row. Design reports its unsaved Tokens state through `ProjectContext.dirtyTabs`.
- Server: a `color` column and `PUT /layer-definitions/:key/presentation` (name for custom layers only, icon and colour from fixed allowlists).
- `shared-layer-slot.ts` and the untracked `layer-setup.ts` are replaced and removed. Copies are kept in the session scratchpad.
- Decisions taken where the owner had not answered: built-in names stay fixed (other surfaces still label built-ins by key); a draft custom layer opens on Manage › Settings; Knowledge documents are listed directly in the Manage sidebar so there is no second tree.

**Observed checks.**
- `tools/browser-checks.sh layer-bar` passed twice. It checks one h1 and one bar with no nested tab rows on Pages outputs/Tasks/Actions/Manage and on the custom layer's draft Settings and Files. It also covers the Tasks routine and action pages with the way back; icon and colour save reaching the rail; old `operations`, `knowledge` and `setup` links redirecting; draft rename, identity, action and activation; rail collapse and its persistence; axe on four views; and 390px on three.
- `markdown-editor`, `design` and `product` browser checks pass. `design` was updated for the new heading and tab names, and `pages` for the "Pages views" nav.
- Server tests pass 163/163, including the new `layer-presentation.test.mjs` (validation, owner-only, instances carry the colour, icons in the font subset, picker lists equal to the server allowlists). Typecheck and build pass.

**Not passing, not caused by this change:**
- `pages` stops at flow review because `recordNewWorkAction` in `server/lat08-migration.mjs:144` throws on a null action (in-progress LAT-08 code).
- `work-item` has an 8px overflow at 400px inside the work item sidebar; it reproduces with this change's CSS removed.
- `layers` waits for a nav named "Layers", which was already named "Project navigation".
- `lat03`–`lat06` use fixed ports outside the runner. `lat03` and `lat04` also walk the replaced Operations/Knowledge screens; they are left as historical LAT evidence and are superseded by `layer-bar`.
- The 4401 preview serves the new bundle, but its server process predates the presentation route. It is owned by another session, so it was not restarted; Settings › Save needs a restart there.

**Retrospective.**
1. What slowed the work: several failures were harness timing. The URL changes before the view re-renders, and ngModel writes input values asynchronously. Adding the checks to the actual browser run also surfaced two real empty-state defects from the editor pass (button contrast, an empty tree role) and a form enabled before the server's requirements were met.
2. What would help next time: navigation tests should wait on the rendered component, not the URL. Every form should disable its submit until the server's own requirements are met.
3. What changed downstream: the shell now owns layer identity and navigation. Built-in components only render output views, which is closer to the definition-driven layer contract. Output tab lists are still a client-side map per editor adapter, not a server definition field.
4. Open questions: whether built-in names become editable (other surfaces label built-ins by key); whether Knowledge stays in Manage after trial; and whether the icon rail should collapse automatically in Manage.
5. Process change: the navigation composition is now a tested contract (`tests/layer-bar-browser.mjs`: one heading, one bar, no nested tab rows), proven by passing runs. Whether it stops future drift is still a hypothesis.

## Layer identity · owner question and proposal (2026-09-29)

Owner in chat: Knowledge needs its own primary tab, because the Manage sidebar is mostly Knowledge. Creating a custom layer drops the owner into an unfriendly draft Setup. Setup should move under Manage with a checklist, and a routine could suggest actions from identity and output. Identity must work the same way for built-in layers: a Design layer switching frameworks must not be locked into its seeded identity. Changing the layer's own implementation (its editor or outputs) is explicitly not opened now. The owner asked for an assessment and proposal. No code has changed.

**Finding.** A layer's definition lives in three uncoordinated stores: `identity_json` (seven fields, custom layers only; built-in identity is hardcoded and the server refuses edits), editable `layer_documents` (outputs, methods, routines, resources), and `layer_action_installations.method_text`, which is what agents receive and which is separate from the Knowledge method documents. The draft gate checks field length (≥12 characters), not substance.

**Proposal.** "Identity is Knowledge". A seeded Charter document (purpose, scope, role, output standard, quality bar, how it works with others) plus one Method document per action form the single source for every layer. Built-ins ship their Charter as a seeded, editable revision with "compare to Aludel default". Action methods point at their Knowledge document instead of holding a copy. The bar becomes outputs | Tasks, Knowledge, Manage. Manage becomes one page with no sidebar: a setup/health checklist, appearance, connections, remove. Setup starts from a starter kit (no cost) or a "Draft this layer" routine that proposes Charter, actions, routines and taxonomy as one reviewable Work item. Accepting a Charter revision re-runs neighbor discovery for built-in and custom layers alike. The implementation boundary (output provider, editor adapter) stays fixed.

Open owner questions: whether the draft routine may run on the project's provider key after Go; starter kits; and a pair view versus a shared document for connections.

## Layer as repository · owner direction and assessment (2026-09-29)

Owner in chat: agreed "identity is knowledge". Each layer should get its own repository holding identity, methods and outputs, and possibly its editor code, with the plumbing hidden by default. A preset is a fork of a master definition. `AGENTS.md` points neighboring layers and agents at the index. This deliberately crosses the "what a layer is" boundary. Tasks and work tracking stay out of the repo: in Aludel or, better, a board owned by the layer. The established layers are the starter kits; it must be possible to recreate them from a blank custom layer, and a simpler Research preset should feel no different. "Draft this layer" creates a Work item in the standard queues, where any agent action happens. The owner asked whether file-based outputs are reasonable for the existing layers. This is an assessment only, with no code changed; it extends [LAYER-REPOSITORIES-01](../layer-repositories/work-record.md), whose authority matrix still applies.

**Measured context.**
- Built-in editors are Angular components compiled into the portal and bound to the shared `ProjectContext`: Vision 335 lines, Design 1,249, Pages 1,615, Data 306, Code 509, Deploy 229. Server logic sits largely in a shared 1,699-line `knowledge.mjs`.
- The Markdown layer's outputs are already files. Data's contract formats (JSON Schema, OpenAPI 3.1) are already file formats.
- The Pages preview already isolates generated-app UI on a separate `*.localhost` origin behind a narrow `postMessage` protocol, which is a precedent for sandboxed layer UI.

**Assessment.** Files as layer authority are reasonable for Vision, Design, Pages and Data. Code's repository is the app repository. Deploy keeps definitions in Git but live, secret and operational state out of it. Editor code in the repository is the hard boundary, because it is untrusted code acting for the owner. The proposal is tiered: a manifest selects versioned, Aludel-provided editor kits (hidden plumbing); custom editor code runs only on an isolated origin through a capability bridge. Proposed order: layer repo format proven on the Markdown layer → identity as Charter in the repo → blank-to-built-in recreation using kits → Data/Design file outputs → Pages → sandboxed custom editor spike → template upstream updates. Open questions are in the chat reply.

### Counter-argument: databases for outputs (owner, 2026-09-29)

Owner in chat: many outputs work better in a database (filtering, merging, categories, keyword search, lookups, and Library-style discovery). Docs and layer code may belong in the repo, while most outputs belong in a database. Does that mean Aludel builds its own version control and merge-request-style review?

**Revised position (proposal).** Each output kind declares its authority in the layer manifest: `repo` for low-volume, human-authored, portable text (charters, methods, writeups, editor code, checks), or `database` for high-volume, structured, frequently updated, relational or imported records (sources, citations, extracted keywords, page and flow records, tokens if edited at high frequency). Querying is not the deciding factor, because repo-backed files are also indexed in SQLite and Library searches the index for both kinds. The deciding factors are write rate, volume, record granularity, structured merges, and who reads the data outside Aludel.

For database-backed kinds, review uses **changesets**: a task's run proposes create/update/delete operations, each carrying its base revision. The owner reviews the diff in the native tab (LAT-08A), and acceptance applies it atomically, refusing it if any base changed. Repo-backed kinds use branches and commits. Work shows one review model over both. Existing groundwork: per-record revisions and history, `expectedRevision` checks, Work pinning revisions at Go, and the planned native Previous/Proposed review. Missing: a pending changeset store, atomic apply, and rebase. An existing Git-for-data database is an alternative to evaluate before building changesets; that has not been researched yet.

## Identity process · owner direction and proposal (2026-09-29)

Owner in chat: take Knowledge as the repository part and the layer's internal "soul". Outputs may define only the schema/API, with output data in a database. Design layer creation, onboarding and continuous refinement around that. Correction to earlier decisions: built-in layers are prebuilt templates you can fork, so nothing is hardcoded and they are fully editable.

**Correction applied (checked).**
- Built-in names are editable. The shared `layerLabel` map is refreshed from the project's definitions on every reload, so other screens follow a rename.
- Icons are any of the 210 in the portal font subset: searchable, with layer-like icons first. The client and server read the same `icon-subset.json`.
- Colour is any `#rrggbb` on which white text keeps 4.5:1 contrast, with the palette as suggestions and a live warning.
- A new picker CSS rule briefly made the icon search box an invisible full-page layer that blocked clicks; the browser check caught it and the rule is now scoped to the radios.
- Checks: 163/163 server tests (presentation test updated for renaming built-ins, custom colours and the refusal of low contrast); `layer-bar` (renames Pages to Screens and checks the heading and rail), `markdown-editor`, `design` and `product` browser checks pass; typecheck and build pass.
- Remaining hardcoding (built-in identity text and the "Aludel maintains the identity" copy) belongs to the process below.

**Proposed process.**
- **Knowledge layout, identical for every layer:** `AGENTS.md`, `layer.json` (name, icon, colour, editor kits, lifecycle), `charter.md` (purpose, scope, role, quality bar, how it works with others), `outputs/<kind>.md` plus `<kind>.schema.json` (fields, taxonomy, invariants, examples; data lives in the database and is validated against the schema), `actions/<action>.md` (front-matter configuration, method body: one source for configuration and method), `routines/<routine>.md`, `connections/<layer>.md`, `resources/`.
- **Create:** start from Blank or any template (the built-ins plus Research, in one list). This copies the template's Knowledge and lands on Manage with a Setup checklist derived from Knowledge content: charter, at least one output schema, at least one action, optional routines, then Activate. Each item offers "Open in Knowledge" and "Draft with an agent".
- **One Work type** proposes Knowledge changes ("Propose layer definition" / "Revise layer definition: …"). It sits in the standard queues, and its result is reviewed as Previous/Proposed in Knowledge.
- **Refinement comes from four sources:** direct edits; requested revisions; built-in suggestion routines (suggest actions and routines from charter and schemas; propose method or check changes from repeated review rejections; flag data that drifts from schema or taxonomy); and template updates offered as diffs.
- **Ripple:** an accepted charter or schema change re-runs neighbor discovery and flags connections for review. A breaking schema change stages a migration task; additive changes apply directly.
- **Navigation:** outputs | Tasks · Knowledge · Manage. Manage is one page: checklist or health, name/icon/colour/lifecycle, remove.
- **Proposed build order:**
  1. Knowledge tab, one-page Manage and the checklist over current stores.
  2. Built-in identity migrated to editable `charter.md`, with actions reading their method from Knowledge.
  3. The propose/revise Work type and the suggestion routine.
  4. The Knowledge store moved to a local Git repository per LAYER-REPOSITORIES-01.

### Identity as Knowledge · first build (agent-checked, not owner-accepted, 2026-09-29)

Owner in chat, after trying the preview: Knowledge was still under Manage. Make the activation checklist its own Manage tab, not something buried under icon settings. Remove the identity form: identity is Knowledge, as one charter file seeded with suggested headings, and the checklist links to it. Add a progress gauge on the Activate tab, a badge on Manage, and a header banner while the layer is inactive.

**Built.**
- The layer bar is `outputs | Tasks · Knowledge · Manage`.
- **Knowledge** (`layer-knowledge.ts`) opens on the Charter, followed by the other documents. It is editable for every layer, and while a layer is a draft it shows which Charter sections are written.
- **Manage** has three sidebar tabs:
  - Activate, shown only for drafts, with a ring gauge and a `done/total` count, linking to the Charter and to Tasks › Actions;
  - Settings: name, icon, colour and remove, with no identity form;
  - Connections.
- A draft opens on Activate. Manage shows a badge counting the steps left, and every other view of the draft shows a banner.
- **Server** (`layer-registry.mjs`): `charterSections`, `charterTemplate` (suggested headings with prompt comments), `parseCharter` (prompts don't count; extra headings are kept) and `saveLayerCharter`, which works for built-in layers too. The identity document is titled "Charter" and saved through the normal document route. Saving an active layer's charter stages neighbor discovery. The purpose section becomes the layer description.
- Old links redirect: `manage/knowledge` → `knowledge`, `setup` → `manage/activate`.

**Checks.** New `tests/layer-charter.test.mjs`: seeded headings, prompts completing nothing, extra sections kept, revision conflict, reader refusal, activation gating, and a built-in Design charter revised. Server tests pass 164/164. The `layer-bar` browser check was rewritten for the Knowledge tab; the built-in charter edit; Manage without documents or an Activate tab for active layers; the draft Activate landing with badge 8, banner "0 of 8" and then "7 of 8"; the charter written from its seeded headings; the action; activation clearing the badge and banner; and axe on Knowledge, Activate and Charter. It passes, as do `markdown-editor`, `design` and `product`; typecheck and build pass. The local preview on port 4402 (fresh data, dispatch off) was restarted on this build and smoke-checked.

**Not yet done from the proposal:** action methods still live apart from Knowledge; charter template headings are fixed for all layers; there is no "Draft with an agent" Work type or suggestion routine; and Knowledge is not yet a Git repository.

## Tasks tab reuses Work · owner instruction 2026-09-29

Owner in chat: the layer Tasks tab should use the same components and concepts as the Work layer so one flows into the other. The main task list is the Work board with the same cards. Actions should look like the previous Work › Roles tab (still available alongside), not the current input form. Routines get their own tab with a list and a detail view, and individual routines do not all need to appear in a sidebar.

**Authorization and scope.** Bounded local UI changes in `custom-layer-candidate/apps/portal`, with additive, read-only server fields needed to render actions in the Roles composition (checks, reads, may-change, runnability) and an optional layer filter on the existing Next rule. Tests, build and the existing local preview. No provider turns, external writes, new write contracts for action checks, or acceptance.

**Process check.** Existing pattern applies (reuse, not new design): Work's `WorkBoardComponent`/`WorkCardComponent`, Roles' `lay-role`/`lay-actions` row and setup panel, and Manage's left sidebar for sections so no nested tab row appears (the `layer-bar` check stays the contract). Readiness: ready; no prototype because the owner named the components to reuse.

### Tasks tab reuses Work · result (agent-checked, not owner-accepted, 2026-09-29)

**Built** in `custom-layer-candidate/apps/portal`:
- `layer-tasks.ts` is a Manage-style left sidebar (Board · Actions · Routines · All work) over the body, so there is still one tab row.
- **Board** is Work's `WorkBoardComponent` with a new `layer` input: the same lanes, cards, Next/Go and Queue/Backlog/Done, showing only this layer's items. Go and the waiting counts still act on the whole batch, and a lane says when its batch also holds other layers' items. Next sends the layer, so it fills only from that layer's queue.
- **Create task** is Work's `WorkCreateComponent` at `/<layer>/tasks/create[/<action>]`, with the layer fixed. The created task opens as the ordinary Work item and comes back to the layer board as the same card.
- **Actions** (`layer-actions.ts`) uses the Work › Roles composition. The tinted header shows who can act, links to the Charter and holds a "Who can act" grants panel. Each action is a row with its default-assignee split chip, a Setup panel (editable method, then read-only Always reads, May change, effects, Done when and reviewer) and the elevated shield. `/<layer>/tasks/actions/<id>` opens one row's Setup. For custom layers, a last "New action" row opens the same panel shape. `layer-action-settings.ts` and the in-page domain-action form are removed; copies are in the session scratchpad.
- **Routines** (`layer-routines.ts`) is a table like Work › Routines: built-in discovery first, with trigger, next run, last task, an on/off toggle and Run now. Each routine has its own page in the same Setup panel style, with a history and a way back. Routines are not listed in the sidebar.
- Shared Work pieces: every card's action chip names custom layers and opens that action in Tasks. The assignee picker disables people or agents when an action has no checked adapter for them. Live-batch polling moved into `pollLiveBatches`, which Work and Tasks both use.
- Server, additive only: the `layer-actions` read includes the declaration's checks, reads, result, file writes, effects, reviewer and runnability. `batches/next` accepts an optional `layer`.

**Checks.**
- `layer-bar` browser check, rewritten for these Tasks views, passes. It covers:
  - the sidebar sections and the shared board;
  - create in the layer, landing on the Work item and returning as a card;
  - the card chip opening that action's Setup;
  - Roles-style rows;
  - the routine list, discovery page, new routine, saved schedule and back link, with routines absent from the sidebar;
  - the custom layer's New action row;
  - axe on board, actions, routine and new action;
  - 390px on board, actions and routines.
- `markdown-editor`, `product`, `design` and `workflow` pass.
- Server tests pass 165/165. New assertions cover layer-scoped Next and the action declaration fields.
- Typecheck and build pass.

**Not passing, pre-existing:**
- `work-item` fails on an 8px overflow at 400px. A probe located it in the item sidebar's `dd`/`p`, which this change doesn't touch.
- `pages` still stops at flow review (the LAT-08 crash).
- The 4402 preview serves the new bundle, but its server process, owned by another session, predates the server fields. The Actions view defaults those facts to empty there, and a restart shows them.

**Retrospective.**
1. What slowed the work: action data lives in two shapes. Legacy `roles[].actions` records carry instructions, reads and tools. Layer action declarations only exposed method and assignee to the client. The Roles composition could not be reused honestly until the read carried the declaration.
2. What would help next time: one client type for a layer action with its declaration, used by Work › Create, card chips and Tasks, instead of the three partial types (`LayerWorkAction`, `WorkAction`, `LayerActionSetting`).
3. What changed downstream: the board's Queue/Backlog/Done switch is itself a small tab row inside Tasks. It is kept because the owner asked for the Work board unchanged, and the `layer-bar` contract does not count it. Declaration checks, reads and may-change stay read-only, because editing them is a declaration change that needs its own review contract.
4. Open questions: should Queue/Backlog/Done stay a tab switch inside Tasks or become stacked sections? Should declaration checks become editable, and with what review? Should Work › Routines move to per-layer routine pages entirely?
5. Process change: Tasks is now built from Work's own components rather than lookalikes, and `layer-bar` checks the round trip (layer → Work item → layer card → action), proven by passing runs. Whether this keeps the two surfaces from drifting is still a hypothesis.

## Packet closeout · owner acceptance 2026-09-29

**Owner acceptance.** After the Tasks pass the owner said in chat: "alright, all looks good. think we can close out the custom-layer tasks unless you have a blocker." This accepts the browser-reviewed candidate as built: the Markdown layer, the editor, the draft charter and activation, one layer bar, Manage, Knowledge and Tasks. It does not accept the unproved boundaries listed below, and it authorizes no promotion into the running portal.

**Evidence revision.** The first checkpoint is commit `97fb422` on `feature/custom-markdown-layer` in `custom-layer-candidate`. The later four passes (navigation, charter as Knowledge, editor, Tasks) are pinned at commit `6d43ed8` on the same branch. The owner authorized that commit in chat on 2026-09-29.

**Brief ledger.**
1. **Create my own layer:** met. The two-custom-plus-one-built-in fixture in `tests/markdown-layer.test.mjs` passes, including reinstallation. `layer-bar` creates and activates a custom layer in the browser.
2. **Markdown filesystem:** met. The focused contract covers traversal rejection, exact revisions and moves. `markdown-editor` covers the tree in the browser.
3. **One editor tab:** met, as the Files output tab with a VS Code-like editor (`markdown-editor` browser check).
4. **Shared spaces:** met, as the same Tasks, Knowledge and Manage for built-in and custom layers (`layer-bar`). This supersedes the brief's "Operations" wording.
5. **Work and adaptation:** met locally. Path- and revision-targeted tasks, reciprocal discovery staging, receiver-owned connections and output-change routines are server-tested, and Tasks reuses Work's own components.
6. **One framework:** met for lookup. One project-scoped definition reader serves built-in and custom layers. Built-ins keep specialized native adapters, so recreating a built-in from a base definition remains a LAYER-FRAMEWORK-01 goal.

**Unproved, carried forward.**
- **A custom layer's discovery proposal from a real agent run.** It needs a provider turn that was never authorized. It goes to the next separately authorized agent trial.
- **A browser-driven person run reviewing Markdown file changes.** This is server-tested only. It goes to LAT-08A, the layer-owned review work.
- **One client type for a layer action.** Today there are three partial shapes: `LayerWorkAction`, `WorkAction` and `LayerActionSetting`. This goes to LAT-08, which owns the action migration.
- **Owner UX questions, none blocking:**
  - whether the board's Queue/Backlog/Done switch should stay a switch or become stacked sections inside Tasks;
  - whether declaration checks and reads become editable, and under what review;
  - whether Work › Routines hands off to per-layer routine pages;
  - whether built-in names become editable;
  - whether deleting a non-empty folder deletes its contents;
  - whether to adopt CodeMirror 6 as a dependency.
- **Pre-existing failures outside this packet:**
  - `pages` stops at flow review, a LAT-08 defect;
  - `work-item` scrolls sideways by 8px at 400px, in the item sidebar's `dd`/`p`, which no packet has claimed yet.

**Packet retrospective.**
1. *What made it harder (observed):*
   - Six-key assumptions were scattered through the code, and shared-space claims were built on Pages as a special case.
   - Layers had no lifecycle, so a name alone exposed a layer to its peers.
   - Action data exists in three partial shapes.
   - Browser harness timing produced false failures.
   - Four owner-reviewed passes built up uncommitted, so the closeout could not cite one exact revision.
2. *What would make the next equivalent task easier:*
   - Start any new adapter with a two-instance identity, action and activation fixture before its editor.
   - Write browser checks that wait on rendered state, not the URL.
   - Commit at each owner-reviewed pass.
3. *What changes downstream:*
   - Layers are now lifecycle-bearing definitions.
   - The one-bar navigation is a tested contract.
   - Tasks is built from Work's components, so LAT-08A should reuse Tasks and Actions rather than add a parallel review surface.
   - LAT-08 should settle the single action type.
4. *Questions:* those listed above. None blocks LAT-08.
5. *Process changes applied and tested, and what remains a hypothesis:*
   - The project-scoped reader and the two-instance fixture are proven by passing server tests.
   - The draft/active gate is proven by lifecycle tests.
   - The `layer-bar` and `markdown-editor` checks are proven by passing runs, including the Work round trip.
   - Added now, applied once and not yet tested on a later packet: the operating procedure asks for a commit at each owner-reviewed candidate pass (§6).
   - Hypothesis: that these checks prevent future drift between layer and Work surfaces.

**Next action:** LAT-08, the owner browser check of the retained LAT-08 preview, then original-data startup proof.
