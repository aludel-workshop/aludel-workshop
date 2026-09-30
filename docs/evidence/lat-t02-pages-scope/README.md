# Pages output scope bridge — 2026-09-29

## Scope and process

The owner continued the DEC-056 Pages transition in chat. The root [work record](../../../../docs/design/layer-app-transition/layer-template-conversion.md) limits this to the isolated local candidate. The previous checkpoint supplied immutable layer-instance IDs; this slice tests a before/after row ledger before changing output authority. It does not migrate owner data or replace the shared portal SQLite file.

## Observed result

- Startup backfills `layer_instance_id` for `page_map`, `page` and `flow` records; their current revisions and future deletion tombstones receive the same ID. Deleted Pages records with a scoped tombstone also backfill their revisions. An ambiguous or foreign-scoped current record, tombstone or revision stops migration.
- New Pages create, update and delete operations carry the instance ID into records, revisions and tombstones. Pages list/get/update/delete and the layer output read check the project and installed instance. Other knowledge kinds retain their existing behavior.
- A disposable two-project fixture preserved a legacy page at revision 2 and a deleted flow, then exercised a new page through revision and deletion. Moving that page's ID to the other project's Pages instance made read, update and delete fail, and restart rejected the mismatch. This is a denied foreign-instance case; two Pages instances in one project are still impossible under the current layer table key.
- `npm run test:server`: **170/170 passed**. `npm run typecheck`: passed with existing Angular optional-chain warnings. `git diff --check`: passed.

## Retrospective and handoff

**Friction:** the legacy page test initially used an incomplete historical JSON shape, which failed the existing page-deletion cleanup. Supplying a valid page shape made the scope test exercise the intended path. The shared knowledge API also had direct `get` and reference lookups beyond the obvious list/write calls; tracing those paths before accepting the slice prevented an easy scope bypass.

**Reusable process change:** require a row-level ledger of current records, revisions and tombstones, plus a foreign-instance read and write attempt, before claiming a storage migration step. The fixture and full regression run support this bridge in the isolated candidate. Original-data startup, historical revisions without a recoverable project/kind, same-template duplicate instances and physical per-project database recovery remain unproved.

**Roadmap effect and open proof:** the next LAT-T02 slice must remove the `(project_id, layer_key)` uniqueness constraint, introduce instance-scoped Work targets and output change sets, and rehearse the physical per-project store and independent export/restore. Repository-doc-only and mixed source/data Work acceptance remain open. LAT-08 retains its owner browser and original-data gate; no packet is complete from this checkpoint.
