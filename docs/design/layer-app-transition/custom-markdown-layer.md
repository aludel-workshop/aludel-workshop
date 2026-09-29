---
id: CUSTOM-LAYER-01
kind: work-record
status: active
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
