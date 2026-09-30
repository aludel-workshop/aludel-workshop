# Pages Work instance scope bridge — 2026-09-29

## Authorization and process

The owner continued the Pages-first DEC-056 work in the current chat. The root [conversion work record](../../../../docs/design/layer-app-transition/layer-template-conversion.md) limits this to an isolated local candidate. The output-scope checkpoint made current Pages records and tombstones traceable to an instance. This pass applies that verified identity to Work rows and Pages output targets. Migration uses current records or deletion tombstones as evidence; it leaves missing historical Pages targets unresolved rather than inventing a mapping.

## Observed result

- Startup fills `layer_work_items.layer_instance_id` for Pages-origin items and adds `layerInstanceId` to existing Pages output targets when a same-project current record or tombstone verifies the link. Vision story targets remain unchanged. Repeated startup keeps the same Work target JSON.
- New Pages Work rows carry the receiving instance ID. New Pages output targets carry their source instance ID. A Work item with a foreign receiving ID or Pages target ID is unavailable through Work read and rejected on restart before it can be used as the task source.
- The disposable migration fixture covers a current page, a deleted flow, a Vision target, and a missing historical page. It proves the first two receive the Pages instance ID while the latter two remain unchanged. Separate checks corrupt the Work item and target instance IDs and observe rejection. A real Pages reconciliation journey creates a new Page-targeted Work item and checks both IDs.
- `npm run test:server`: **170/170 passed**. `npm run typecheck`: passed with existing Angular optional-chain warnings. `git diff --check`: passed.

## Retrospective and next gate

**Friction:** Work targets can be in a different layer from the Work item's receiving layer. Treating every target as Pages would have mislabeled Vision story context. Deleted targets also need the tombstone ledger; an absent target cannot be reconstructed from its label alone.

**Process change tested:** backfill each Work target from a verified output or tombstone and test one mixed-layer task plus one unresolved historical link. The fixture demonstrates that the migration preserves those distinctions. The full server suite supports current candidate compatibility; it is not owner-data startup evidence.

**Remaining work:** this is an identity bridge in the shared portal database. It does not add semantic database change sets, atomic source/output/Work acceptance, two same-template instances in one project, project-specific SQLite files, or independent export/restore. The current Work review still uses its existing action adapters. Those are LAT-T02 and later gates; LAT-08's owner browser and original-data checks remain separate.
