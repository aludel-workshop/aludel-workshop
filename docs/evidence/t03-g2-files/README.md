# T03-G2: repository-mode outputs (DEC-059) — 2026-09-30

## Scope

Under DEC-059, a layer keeps its output either as records through its API or as files in its own repository. This packet adds the host side of the file mode. Data (T03-DATA) is the first real user; Code follows later. It is local candidate work only.

## What changed

- **Manifest `files`:** `{ paths: ["outputs/…"], kinds: [...], indexer: "server/….mjs" }`.
  - Paths must be exact files under `outputs/` (json, md or yaml).
  - The kinds must be the layer's outputs, and a kind cannot be both records and files.
  - The package loader rejects anything else.
- **Indexer:** a pure module the layer owns, exporting `entries(files)`. It returns entries `{ id, kind, title, data }`.
  - It runs in the same limited child process as layer API handlers, and only as reviewed bytes.
  - IDs look like `note-alpha` or `obj-abc123`, so an existing record ID can survive a move to files.
- **Index** (`server/layer-files.mjs`):
  - Keeps integer revisions per entry across commits. An unchanged entry keeps its revision; a removed one gets a tombstone.
  - Old revisions read from their own commit.
  - The index catches up whenever the pin has moved.
- **Library:** file entries are `output` entries of their layer. They can be searched, read at a revision and pinned, just like records.
- **References:** the layer-API reference check and the host validators accept a current file entry of the right kind.
- **Agents:** they read file entries through the Library, `usedInputs` recheck them, and `outputs/**` is writable on a work branch.
  - A merge is refused unless the merged files still index.
  - After a merge the index follows the new `main`.
- **People:**
  - `GET` and `PUT /api/projects/:id/layers/:key/files?path=` read a declared file and commit a person's edit to `main`, guarded by `expectedCommit`.
  - The edit is made with Git plumbing, so there is no checkout race. It is authored as the person.
  - `main` moves only if the new files index.
  - Frames may use these routes for their own layer only.

## Checks

- Server suite **205/205**. New `tests/layer-files.test.mjs` (3) runs a real fork of `layer-base` `main` turned into a notes layer and covers:
  - entries and Library search;
  - a person's edit with per-entry revisions;
  - old revisions read from their own commit;
  - stale-base, undeclared-path and bad-content refusals with `main` unmoved;
  - tombstones;
  - an agent merge refused when files don't index, then accepted and indexed;
  - an unreviewed indexer refused;
  - a manifest that claims `layer.json` refused.
- The frame allowlist test found and fixed a bug: GET on the files route was unreachable.

## Limits

- The files routes are exercised through HTTP only by the Data browser journey (T03-DATA), which is not yet written.
- The first index of a layer starts at revision 1 at whatever commit is pinned when it is first read. Pins can only name revisions the index has seen, so there is no staleness gap.
- Output files are data: normal member access, no elevated review for people's edits, the same as people's record calls.

## Retrospective

1. **Harder than necessary:**
   - An inline Python edit failed on an indentation mismatch and wrote nothing. Rerunning from a script file made the edit atomic and repeatable.
   - An import smoke check started a real server against the candidate's default data directory. It had created that directory fresh, and I deleted it again. Next time, check imports with `node --check` or with an explicit temporary `MACHINE_DATA_DIR`.
2. **Easier next time:** the notes-layer fixture (a fork of base turned into a file layer) is a reusable pattern for testing any repository-mode template before its UI exists.
3. **Roadmap effect:** Data can now be one OpenAPI file with stable `x-aludel-id`s and keep every existing reference. Code will need a broader writable set than `outputs/`, since its output is the whole repository; that belongs to T03-CODE.
4. **Questions:** whether people's edits to Data's contract should need elevated access, as a contract change affects Code. The current default is normal access, matching records.
5. **Process change:** the "HTTP check for new routes" lesson from G1 was applied only partly here, deferred to the Data journey. I'm recording that rather than claiming it.
