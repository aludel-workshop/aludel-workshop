# T03-DATA — local conversion checkpoint (2026-09-30)

## Scope and authority

The owner asked to finish the Data layer conversion and retire LAT-08's obsolete action-migration handoff. This is local work in the isolated `pages-template-candidate` and the `layer-base` Data branch. DEC-057 makes Work layer-scoped; DEC-059 makes Data's output one OpenAPI file in its own repository. No original-owner-data cutover, provider turn, GitHub write, deployment or promotion was authorized.

## Result

- Data template `12d08ebe941d1effdea6b1a32adb4483b9dbc8de` owns `outputs/openapi.json`, its pure indexer/normalizer, charter and methods, and `ui/data.ts` plus `ui/data.scss`. The candidate pins that commit. A new project gets its own Data repository. The frame builds the UI from its installed repository commit.
- Data keeps objects, operations and access rules as stable `x-aludel-id` entries. Host record calls read and write those entries through the Data rules; a person's change is a Git commit on the instance's `main`. The Library exposes each entry and its revision. Story packs seed and remove entries in one commit while preserving edited entries.
- Existing records move into the file at their original IDs and revision numbers, with old record history readable from the archive. Repeating startup does not adopt twice. If the archive step fails, the adoption commit's Git ref is restored; after restart, an exact clean orphaned template clone is rebound and adoption retries.
- A Data agent branch with a broken reference is refused without moving `main`; a valid branch merges, updates the pin and increments the changed entry's Library revision. The generic Work path and elevated review remain host-owned. The Data Tasks view offers layer Access rather than the retired action setup.
- The frame's OpenAPI button downloads the declared file through its scoped route. The frame allows downloads while retaining its network and navigation restrictions.

The portal keeps the compiled Data screen as a templates-off fallback until the remaining native layers convert. The fixed six-key catalog still exists; T03-G3 is the next shared step, not a claim made by this packet.

## Checks and observations

- Template source tests: 5 passed, 2 existing API tests skipped because Data uses repository-file output rather than a record API.
- Final focused Data tests: 6/6, covering new installs, normal writes/history/references/deletes, Library and pack removal, existing-record adoption, checked branch merge, and failed-adoption restart/retry. Generic file/frame checks passed 11/11 after the frame download rule was updated.
- The final full candidate server suite passed **211/211** after the failed-adoption recovery addition (candidate code commit `a818e07153bb5a92aa568aeb8c64ee6bb6e04a19`).
- Candidate typecheck and production build passed after the Data frame was added. Angular reported existing optional-chain warnings; Vite reported an existing large-chunk warning.
- Browser with templates enabled: `data-layer` passed Objects, API, Access, download, Library result, Tasks Access, axe on the portal and Data frame, and 390px no page overflow. `library` and `layer-bar` journeys also passed.
- Source ownership is pinned to template commit `12d08eb`; candidate code is pinned at `a818e07`. No model turn or owner acceptance was claimed.

## Retrospective

1. **Friction:** a focused Data unit test passed while the UI still came from portal code. An end-to-end source-location check found the gap. The frame then blocked the OpenAPI download until its sandbox permission was made explicit. A failed-adoption fixture exposed Git/SQLite compensation and an unbound clean clone after rollback.
2. **Preparation:** each native-layer conversion should inventory its UI source, file/record writer, Knowledge, Work boundary and export affordance before calling the layer portable. Add a fresh browser path and a failed-adoption restart fixture alongside record parity checks.
3. **Plan effect:** T03-G3's general catalog is still open. Data's one-layer fork/adoption can pass locally while the older catalog remains as a fallback for unconverted layers. Vision, Design and Code follow T03-G3; Deploy remains deferred by DEC-059. DEC-060 removes LAT-08's per-action migration from the current queue; original-owner-data migration is a later LAT-10 gate.
4. **Questions:** whether ordinary member edits to Data's contract should gain elevated review is still a product policy question; the current people path matches prior direct record edits. Real owner-data cutover, interrupted process recovery beyond this failed transaction fixture, and template upgrades remain release gates.
5. **Applied process change:** the source-location inventory led to a committed native UI in the template, and the end-to-end browser path verified it. The interrupted-adoption test caught and verified a recovery fix. This proves the local paths described above; it does not prove a live owner migration or the usefulness of the whole stack.
