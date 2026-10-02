---
id: LAT-PAGES-OUTPUT-AUTHORITY
kind: architecture-comparison
status: owner-confirmed-target
updated: 2026-09-30
---

# Layer output authority: project store and per-instance source repositories

## Owner signal and process correction

The owner questioned whether complex Pages page specs, ordered flows and Map geometry belong in a Git file tree, while retaining the branch/commit/merge interaction for agent tasks. The earlier Q-011 conflated two independent goals: **the owner can fork and customize every line of layer-specific application code** and **the project can own, version, export and recover its layer outputs**. A GitHub repository is a good source and distribution boundary for the first goal; it is not required for the second. The offline JSON/SQLite round-trip proves an export/import primitive, not a good editor authority or a reason to make JSON files the live writer.

Figma is useful evidence of the separation. Its public engineering account describes structured document objects, server-ordered property updates, checkpoint snapshots and a durable change journal, while its product offers named versions, branches, reviews and merges. It does not describe GitHub repositories as document authority. Its implementation scale and multiplayer requirements differ from Aludel's, so this supports the architecture distinction rather than prescribing its storage engine. Sources accessed 2026-09-29: [Figma document model](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/), [journal/checkpoints](https://www.figma.com/blog/making-multiplayer-more-reliable/), [branching rationale](https://www.figma.com/blog/how-and-why-we-built-branching/), [branch review and merge](https://help.figma.com/hc/en-us/articles/360063144053-Guide-to-branching).

## Confirmed source and output boundary

| Concern | Proposed authority | Why |
|---|---|---|
| Each installed layer application | Its own project-owner Git repository generated/copied from a template; exact installed commit | Owner edits that instance's charter, docs, UI, actions, validators, schema and migrations independently. Two instances may run different commits. |
| Live layer outputs | One SQLite database per project locally, with every record scoped by immutable project and layer-instance IDs | Atomic edits and queries across page specs, Map positions, links, flows and Work review state; no JSON text merge or commit per drag. The bootstrap shared portal SQLite must migrate to this target without changing IDs. |
| Revisions and agent candidates | Git commits for instance source; immutable semantic change sets and accepted revision lineage for database outputs | One Work task pins both the base output revisions and installed layer-code commit. Native review shows each affected source/output view. Acceptance validates or reports conflicts, then advances accepted revisions and installed source pin through checked Work. |
| Portable ownership/backup | Versioned full export plus subsequent change journal, with checksums and schema/adapter version | Restore without Aludel's original host; import into another owner environment and compare IDs, references and rendered results. May be stored in owner-controlled backup or optional Git snapshots; export is not the live writer. |
| Operational Work state | Aludel host | Go, run, signature, permissions and cross-layer grants remain shared controls. |

A database-output change set should say, for example, “revise flow `flw-…` from revision 7: add step after `pag-…`; reposition `pag-…` on map from revision 11,” with stable IDs and expected revisions. The same **branch → review → commit → merge** experience applies when a task edits the instance repository, such as its internal documentation: that candidate carries a Git commit instead of a database patch. A mixed task can carry both. Work snapshots, criteria, reviewer and signature are shared. A GitHub push is only an observed source commit until checked acceptance advances the installed pin. For mixed acceptance, make the already verified source commit retrievable, then update the installed pin, output revisions and Work verdict in one project-database transaction; recovery must handle an unavailable source commit. For conflicting edits, compare entity and field/path revisions; a changed referenced page, deleted step, or same-field edit needs an explicit rebase/review. The exact merge policy is open and needs fixture tests before adoption.

## Instance-neutral store contract and proof before cutover

1. Store records, revisions, drafts and change sets under immutable `(project_id, layer_instance_id, output_id)` scope; validate every read/write and Work target against the installed instance. Layer-specific schema and commands come from the pinned instance package. Generic storage does not enumerate initial layers, assume neighbors, or create `pages`-only tables. Test two differently customized instances in one project, two projects with matching output IDs, absent neighbors and denied cross-instance writes.
2. Define the layer SDK's scoped data API. The instance repo owns validators/commands/migrations; the host supplies transactions, membership, revision checks and capabilities without knowing any initial layer key. A source fork changing schema cannot bypass migration/review. Show one project database transaction that checks output base revisions, updates accepted records, records Work acceptance and, if relevant, advances a verified instance-source commit.
3. Prove independent export/import from the accepted database state, including deletes, revisions, source links, schema versions, Work provenance and one owner-customized layer code commit. Rebuild views and compare API/UI output. The existing offline JSON export is an input to this proof; historical pre-ledger deletions still need bounded treatment.
4. Prove accepted output history is recoverable separately from instance-source Git history. Clarify whether owner-controlled data backup is GitHub, another remote store, or a downloadable/syncable bundle; publishing layer source repos alone does not back up outputs. Test a repo-documentation-only task, an output-only flow revision and a mixed source/output task through the same Work review surface.
5. Define one writer per project database and multi-instance sync before hosted operation. Keep global account/project directory metadata outside the per-project store if needed, but keep project Work acceptance and outputs in the same transaction domain. Prove backup/restore, schema upgrade and source pin recovery across restart.

**Decision (DEC-056):** one owner-controlled repository per installed layer instance, one local project SQLite database for scoped outputs and project Work acceptance, and one Git-style review experience across source and data changes. This confirms the target architecture, not its implementation. No live storage migration or remote write is authorized by this record. LAT-T02 must prove data portability, strict instance scoping and both change modalities before retiring the current writer.

## Current candidate gap and dependency

At the DEC-056 decision, the isolated Pages candidate had a shared portal SQLite file, `knowledge_records` scoped by `project_id` and `kind` but without `layer_instance_id`, and `layer_package_bindings` keyed by `(project_id, layer_key)`. Existing `layer_instances` also uses `(project_id, layer_key)`; the current `pages` key is baked into package lookup. These are valid migration inputs, not DEC-056 completion evidence. Introduce an immutable instance ID distinct from template key, display name and route; bind the owner repo and every output/revision/Work target to that ID. Backfill existing project records with explicit source-to-instance mapping, and reject ambiguous or cross-instance records. Then move project Work and layer outputs into the selected per-project transaction domain. Test two instances of the same template in one project, two projects with the same output IDs, missing/added neighbors, repo-doc changes, output-only changes and a mixed change. The owner has confirmed the target; this checklist remains unimplemented.

**Process outcome:** separating source ownership, data authority and Work change modality prevented an offline export test from becoming an accidental runtime storage decision. The decision is now owner-confirmed; its effectiveness still requires the instance-isolation and mixed-task proofs above.

## Implementation checkpoint — 2026-09-29

The isolated candidate now has immutable layer-instance IDs and Pages package bindings pinned to them. [Output-scope evidence](../../evidence/lat-t02-pages-scope/README.md) adds those IDs to legacy/current Pages records, revisions and tombstones, and checks the Pages read/write path against the installed instance. The result remains in the shared portal SQLite file. Current `(project_id, layer_key)` uniqueness still prevents two Pages instances, Work targets are not instance-scoped, and project DB placement/export/mixed acceptance have not passed. These are the next DEC-056 proof gates, not a reversal of the chosen target.

## Work identity checkpoint — 2026-09-29

The [isolated Work scope proof](../../evidence/lat-t02-pages-work-scope/README.md) extends the Pages instance ID to Pages-origin Work rows and verified Pages output targets. Mixed Vision/Pages targets stay distinct; missing historical Pages targets are not guessed. This is still the shared portal database and existing Work review adapter, not the DEC-056 atomic source/data acceptance or project database cutover.

## Semantic flow candidate checkpoint — 2026-09-30

[Source-owned Pages evidence](../../evidence/lat-t02-flow-candidate/README.md) demonstrates a pure, versioned existing-flow change set against exact instance, record, input and source pins. The portal checks the committed module declaration but does not run it or write its result. This is semantic candidate design evidence, not the DEC-056 Work acceptance or project-database authority proof.

## Reviewed-source runtime checkpoint — 2026-09-30

The [isolated Pages runner proof](../../evidence/lat-t02-flow-runner/README.md) executes one host-reviewed, exact source digest from the accepted instance commit and compares its pure existing-flow result with the host validator on a disposable page-backed fixture. The runner has no database handle and is not wired to Work acceptance. The result does not change DEC-056 authority: instance outputs remain in the current shared store until project-database migration, full validator parity, general isolation and atomic Work acceptance pass.

## Flow-shape parity checkpoint — 2026-09-30

[The local source and runner proof](../../evidence/lat-t02-flow-shapes/README.md) compared page-backed and gap/persona flow revisions with the current host validator on disposable records. The reviewed-source table preserves old installed pins while new installs advance to the expanded rule. This validates pure candidate normalization for those fixtures, not trusted live-reference gathering, Work acceptance or a change in database authority.
