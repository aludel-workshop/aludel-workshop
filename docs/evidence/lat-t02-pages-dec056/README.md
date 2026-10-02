# Pages DEC-056 identity checkpoint — 2026-09-29

## Authorization and scope

The owner's current chat instruction was to start the DEC-056 transition with Pages. The root [work record](../../../../docs/design/layer-app-transition/layer-template-conversion.md) records the local-only scope. This is an isolated LAT-T02 groundwork slice, not LAT-08 or LAT-T02 completion. No original portal data, owner project output, GitHub repository or provider was changed.

## Process outcome

The DEC-056 checklist was decomposed into a migration-safe first proof: assign identity before moving writers. The existing composite `(project_id, layer_key)` primary key permits additive IDs and package pinning, but still prevents installing two Pages instances. The new regression fixture covers old rows and old package bindings, restart stability, immutable IDs, wrong-instance binding rejection, and separate project copies. This process check found two older fixtures that assumed no instance identity, plus a Work path that legitimately requests package context for an uninstalled layer. Both were corrected without broadening package authority.

## Task outcome and evidence

- `layer_instances.instance_id` is generated once for new built-in and Markdown installs and backfilled for legacy rows. A unique index and SQLite triggers reject missing or changed IDs.
- Existing Pages package bindings gain `layer_instance_id` by matching the project and old key. New local repository paths use the immutable ID. Package lookup checks project, instance ID and legacy key, and startup rejects a binding pointing to another instance. Existing repository paths remain intact.
- Layer descriptors and the Pages Work source card carry the exact instance ID. New Work bundles retain that ID with the accepted package commit and recheck it before use; older bundles remain readable under their prior contract.
- `node --test tests/layer-contract.test.mjs tests/pages-package.test.mjs tests/symphony-proposals.test.mjs`: 23/23 passed. `npm run test:server`: 169/169 passed. `npm run typecheck`: passed with existing Angular optional-chain warnings. `git diff --check`: passed.

## Remaining gate and retrospective

This is an identity and package-binding bridge only. `knowledge_records`, revisions, deletions, Work targets and package binding uniqueness still use project/key or project/kind conventions; the portal still has one physical SQLite file; the current schema still enforces one instance per template key; source and data candidates do not yet share atomic Work acceptance. The next LAT-T02 slice needs a `(project_id, layer_instance_id, output_id)` store and source/output migration mapping, two same-template instances, denied cross-instance reads/writes, independent export/restore, then mixed Work acceptance. No writer or live project authority was cut over.

**What slowed this pass:** package initialization runs in both full startup and smaller feature tests. A package lookup previously assumed every requested key was installed, which made the first full regression fail in an unrelated Work report path.

**Reusable preparation:** keep one legacy-row fixture and one no-installed-instance fixture whenever adding an identity column or moving a binding. The full 169-test run supports this for the current candidate; original-data behavior remains unproved.

**Roadmap and questions:** DEC-056 remains the target. This bridge confirms that IDs can be introduced without replacing current Pages output authority, but duplicate-template support requires changing the `(project_id, layer_key)` uniqueness and UI route model before instance-scoped output cutover. The source/Work atomicity and backup destination remain open implementation proofs, not new owner decisions.
