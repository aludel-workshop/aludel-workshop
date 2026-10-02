# T03-VISION completed: Vision's rules in its layer, template-mode suite, host features — 2026-09-30

## Scope

The owner asked Claude to review Codex's Data and Vision work (`a818e07`, `7ceebd7`) and continue. This is local work in `pages-template-candidate` and on `layer-base` branches. No provider turn, no GitHub write, no owner data.

## Review of the prior checkpoint

- **Data (`a818e07`)** is sound. It carried the uncommitted host work for repository-mode Data forward and added three things:
  - the Data views in the template frame;
  - a browser journey;
  - a failed-adoption recovery.
- **Vision (`7ceebd7`)** moved the views, charter and Knowledge, but not the rules.
  - All ten Vision kinds were still validated by the portal's `knowledge.mjs`.
  - The `vision` branch failed its own base contract test ("a layer with record outputs publishes an API").
  - Its manifest claimed `outputProvider: "layer-api"`.
  - It also added a second key-specific frame rule (`key === 'product'` may POST `/docs`).
- **The candidate suite had only ever run with templates off.** Run with templates on, the target mode, it had 11 failures before this checkpoint. Some were expected under DEC-057. Others were real gaps: Work could not target Data entries now kept as files, and a Work item could not close on a file-entry change.

## What changed

### Vision

- **Rules and API in the template** (`vision` `eac6132`, then merged base):
  - `server/vision-api.mjs` holds the rules for all ten kinds, ported unchanged with the same messages.
  - `api/openapi.json` has 38 operations (list, get, create and update per kind, plus `setVisionSection` by key).
  - Milestone keys and story services come from host catalogs (`phases`, `services`).
  - Deletes stay with the host, which also releases everything that pointed at the deleted record (same as Pages).
- **Parity:** every Vision record a seeded portal project stored (35 records, 8 kinds) normalizes to itself under the template's rules (`fixtures/vision-records.json`).
- **Hierarchy:**
  - A write may name `parentId`. The host requires it to be one of the write's checked references, so its kind and instance are verified.
  - An operation declares the request field that carries the parent (`x-aludel-parent`). Aludel's record routes fill it from the person's chosen parent.
  - A person's reorder (`position`) is applied by the host, since ordering is not a change to what a record says.
  - Agent drafts carry `parentId` through review and acceptance.
- **Instance scope:** when a built-in layer starts publishing an API, its existing untagged records, revisions and deletion markers join its instance (`backfillLayerOutputScope`). This generalizes the Pages-only backfill.

### Template mode and host fixes

- **Template-mode gaps fixed:**
  - Work items can target file entries.
  - File-entry revisions record the Work item, show in its changes, and satisfy its close check.
  - `revisionAt` covers file revisions.
  - File-entry lookups without a project avoid aggregate queries, which the per-project store refuses (PROJECT-DB-01).
- **Host features by name, not key:**
  - The frame allowlist has no layer-key branches any more.
  - The host defines named features (`pageChanges`, `skeleton`, `documents`), each fixed to its routes. A manifest requests them in `hostCalls`.
  - Forks pinned before `hostCalls` keep what their template relied on, keyed by the *template* they were forked from, until a template update reaches them.
- **Lost-note race fixed:**
  - The full Pages journey failed 2 of 4 runs at "the blank keeps its title and note".
  - Cause: the Map's note save sent the revision captured before the title save landed, so typing a note right after naming a blank lost the note.
  - Fixes: the host's `ctx.write` now runs one write at a time, each after the previous write and its reload. The Pages Map's in-place title and note edits read the page's current revision (`pages` `b8fd73c`).
  - After the fix, 4 of 4 runs passed.

## Checks

- Templates off: server suite **217/217**.
- **New `npm run test:server:templates`: 210 pass, 0 fail, 7 skipped.**
  - Each skip names its reason: a fake all-zero template pin, a path that requires no layer package, a test that switches templates on midway, or raw fixture rows whose IDs predate entry IDs.
  - Legacy tests whose expectations DEC-057 deliberately changed now assert per mode. The substance still runs in template mode, for example that a clarifying answer lands in its story.
- Template branches: `vision` 6/6, `pages` 10/10, `data` 5/5, `markdown` 4/4 (each plus base contract skips).
- Typecheck and build pass.
- Browser, templates on: `vision-layer`, `data-layer`, `pages` (4/4 consecutive runs after the race fix), `library`, `layer-bar`, `markdown-editor`, `layer-scope` pass.
- Every handler and indexer at the new pins is on the reviewed-source list.
- Browser, templates off: `pages` and `layer-bar` pass. The older `layers` journey fails waiting for a `navigation` named "Layers" that the icon rail no longer has. It fails identically on Codex's `7ceebd7`, so it predates this checkpoint and is stale.

- **Build staging cleanup:** test and browser runs had left 165 `.layer-ui-src-*` staging folders in the portal directory. A layer UI build stopped partway, for example when a check shut the portal down mid-build, skipped its `finally`. The builder now clears staging folders older than ten minutes, and git ignores them. They had briefly entered this checkpoint's commit; it was amended before anything else used it.

## Limits

- Still in the portal and called through Vision's rules:
  - Vision's seeding (Brief, plan, story packs);
  - story, spec and project numbering;
  - the project dependency cycle check;
  - document generation.
- Other Map and Flow edits still capture revisions when the edit starts. The write queue makes them run in order, but two quick edits to the *same* link or flow may still conflict. Only title and note were changed.
- Under DEC-057, Vision's Work is now layer-scoped in template mode: no `product.*` action labels, and the layer default assignee replaces the per-style presets. The owner accepted this for Pages. It now applies to Vision too.
- A Data adoption at startup runs inside the contract transaction while moving a Git ref. Codex's recovery covers a failed archive step. A rollback after adoption in the same startup is not covered.

## Retrospective

1. **Harder than necessary:**
   - Template mode, the target, had no suite of its own, so 11 failures went unseen across three packets.
   - I first broke a test file by placing a module-level flag after an `import` that appears partway down the file.
   - New queries ran into the per-project store's refusal of unscoped aggregates. That rule lives only in `project-store.mjs`.
2. **Easier next time:**
   - `test:server:templates` is now a standard check.
   - Repeating a flaky browser journey several times before and after a fix gives a pass rate, not a single result.
   - Any new host table should be checked against the project store's routing rules.
3. **Roadmap effect:** Vision now meets the same bar as Pages and Data, with its rules in the layer. Design is next, in records or files, decided in its packet. Code follows, including connecting an existing repository. Deploy stays deferred.
4. **Questions for the owner:**
   - Is DEC-057 layer scoping for Vision Work acceptable? It replaces the `product.*` actions and per-style assignee presets.
   - Should other Map and Flow edits get the same latest-revision treatment?
5. **Process change applied and tested:** the template-mode suite caught the Work-target and close-check gaps, which are now fixed and covered. Repeating the Pages journey found and confirmed the lost-note fix. Whether template mode stays green as the remaining layers convert is untested until Design.
