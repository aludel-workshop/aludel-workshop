# LAT-02 layer contract and migration evidence

Date: 2026-09-28. Candidate branch: `feature/layer-app-model`. Scope: isolated local candidate only. Authorization is recorded in the original checkout's `docs/design/layer-app-transition/work-record.md`.

## Contract and ownership

`apps/portal/server/layer-contract.mjs` declares the six built-in local layers. Vision (`product`), Design, Pages and Data project existing `knowledge_records` kinds. Code projects `code_units`, `trace_links` and `code_releases`; Deploy projects `releases`. Library and Work kinds remain shared and cannot be declared as layer outputs. The compiler compares built-in kinds with the actual `knowledge.mjs` validator keys and rejects missing, duplicate, unknown or wrongly owned output kinds. Existing typed validators and native writers remain authoritative.

`layer_instances` records project selection and descriptor version. Startup backfills existing application projects with six instances; onboarding creates them within the new-project transaction. Backfill uses conflict-safe inserts and does not modify knowledge records, revisions, Work items or runs. The descriptor API returns output kind, count and revision mode; exact output reads require an existing project membership, enabled instance and matching kind/project/ID. Code and Deploy reads expose identity plus a content hash of the stored projection row; native routes retain detailed views. The read-only migration inventory reports typed knowledge counts and revision sums, shared kinds, unmapped kinds, Work item count and routine run count for an authorized project.

Routes: `GET /api/projects/:id/layers`, `GET /api/projects/:id/layers/:key/outputs/:kind/:recordId`, and `GET /api/projects/:id/layers-inventory`. Responses are uncached. A missing project and a project outside membership both return 404. These routes do not add write authority or agent dispatch.

## Checks and migration report

- Focused layer-contract tests: 2/2 pass; combined layer-contract plus onboarding regression: 16/16 pass. It checks bad kind/authority declarations, cross-project and cross-layer read rejection, membership, six instance creation for a new project, twice-run backfill, and unchanged record/descriptor inventory after an SQLite backup and second migration.
- A SQLite backup of the actual candidate `.data/machine.sqlite` was migrated twice in a temporary directory: one application project, six instances inserted first pass, zero inserted second pass, integrity `ok`. The copy-only test added owner membership to inspect the candidate fixture; it reported six descriptors and no unmapped kinds. The current portal database was not read or copied for this packet.
- Candidate `npm run build` passed. A temporary server with separate data, port 4433 and dispatch disabled started; an unauthenticated request to the new layer route returned 401. `node --check` and `git diff --check` passed.

The LAT-01 candidate fixture has no typed knowledge records, so the actual candidate copy proves migration/idempotence and empty inventory, while the focused test provides populated Pages, Vision and Code examples. A vetted current-data backup and full record reconciliation belong to LAT-08. Authenticated browser navigation and instance management belong to LAT-03. No agent run or external integration was exercised.

## Post-hoc retrospective

1. **Friction observed:** startup backfill initially missed projects claimed after server start. The first onboarding regression then found that domain callers did not initialize the new schema through server startup. A declaration whitelist derived only from the declarations themselves could also have accepted a mistaken new kind.
2. **Preparation applied:** onboarding now inserts instances in its project transaction, the instance creator ensures its own schema, and built-in declarations compile against the existing typed validator keys. Tests exercise both paths. This catches missing kinds when native validators evolve.
3. **Downstream effect:** LAT-03 can use stable instance and descriptor reads for Home and navigation while keeping current layer editors. LAT-08 must reconcile populated current records and membership on a vetted backup; LAT-02's empty candidate fixture is insufficient for that gate.
4. **Questions:** Code and Deploy facts have no monotonic revision column. The candidate uses a content hash for exact read identity; LAT-07 should decide whether a durable observation revision is needed. Instance selection has a stored `enabled` field, but LAT-03 owns owner controls and behavior.
5. **Applied and tested:** transactional new-project seeding, schema self-initialization, validator-backed compilation and copy-first migration checks were exercised by the 16 passing focused/regression tests, actual candidate backup and isolated server startup. Owner usefulness, populated current-data migration and hosted behavior remain untested.
