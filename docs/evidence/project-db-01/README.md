# PROJECT-DB-01: one SQLite database per project (2026-09-30)

The owner confirmed DEC-056's target in chat on 2026-09-30: "database, one db per project: yes. need to make that happen too." Layers keep no databases of their own (DEC-058). Scope and design are in the workspace work record (`docs/design/layer-scoped-work/work-record.md`, PROJECT-DB-01). Candidate commit `614de3a`.

## What changed

- **Split.** [`server/project-store.mjs`](../../../apps/portal/server/project-store.mjs):
  - `machine.sqlite` keeps platform state: projects, users, sessions, auth, GitHub identity, onboarding drafts, members, project setup, worker credentials, candidate preview runtime, and the bootstrap workflow list.
  - Everything else moves to `projects/<id>.sqlite`.
- **Same surface.** `openDatabase()` returns a store with the same `prepare`/`exec` surface, so the ~40 modules are unchanged apart from a few call sites (below).
- **Routing rules.**
  - **Current project:** a request runs with its project as the current project, taken from the URL, the worker credential or the app host. A statement that binds a different project is refused.
  - **Without a current project:**
    - a statement that binds `project_id`, whether as a parameter or a literal, goes to that project;
    - a statement keyed to a parent row or its own `id` goes to the project holding that row;
    - reads, by-ID updates, deletes and `INSERT … SELECT` visit every project;
    - anything else is refused. That covers aggregates, and inserts into a table that has neither a project nor a parent.
  - **Mixed statements:** a statement naming platform and project tables is refused at prepare time. A test also scans every server SQL literal for them.
- **Schema.** Project schema DDL (tables, indexes, triggers, `ALTER`s) is kept in an in-memory template and replayed on each project database when it opens. Projects created later, and older files, reach the current schema this way. Schema questions (`sqlite_master`, `PRAGMA table_info`) are answered from the platform and the template.
- **Transactions.** They begin on each database they touch and commit or roll back together. Review acceptance writes only project tables, so it is one SQLite transaction in the project's database (DEC-056).
- **Existing installs.** A single-database install moves once, at open, before modules declare their schema, so their migrations and backfills then run on the moved data:
  - a `VACUUM INTO` backup is taken first;
  - each table moves with its own definition, indexes and triggers, and its children follow their parents (a required reference is preferred over an optional one);
  - rows of no project are kept in `legacy_<table>` and reported.
- **Other changes.**
  - Three mixed statements in `server.mjs` were split.
  - The importer runs as `the-machine`.
  - `tools/delete-project.mjs` also backs up and removes the project's database.
  - Fixed an existing importer bug (a document returning to earlier content hit a unique constraint). This was proven not to be caused by the split, by running the same importer against an unmigrated copy through plain SQLite.

## Checks

| Check | Result |
|---|---|
| `tests/project-store.test.mjs` (routing, refusals, triggers, schema replay, transactions, legacy move, static mixed-statement scan) | 6/6 |
| Full server suite | 197/197 |
| Browser journeys, templates on: layer-scope (with the review evidence steps), layer-bar, markdown-editor, pages | all pass |
| `integrations/symphony/layer-tools-check/run.sh` (real server in a container, compiled adapter) | passed |
| Rehearsal on a `VACUUM INTO` copy of the main portal's real `machine.sqlite` (original untouched; copies deleted afterwards) | 39 tables and 1,882 rows moved into 3 project files in 172 ms; per-table counts match; 12 `knowledge_revisions` of records deleted before the deletion log existed kept in `legacy_knowledge_revisions`. The candidate server then started on the migrated copy and served requests. |

## Limits

- Paths that no suite or journey exercises may still hit a refusal. They fail loudly ("Project data needs a project: …"), never by mixing data.
- The cross-project fallbacks without a current project (visiting every project) are for startup, background loops and tests. Requests always have a project.
- A transaction that writes platform and project rows commits each database in turn. Only project creation does this.
- Hosted storage engines and backup destinations for project files remain open (DEC-056).
- The main workshop portal still runs its own code and single database. Nothing there was changed.

## Retrospective

1. **What made it harder.**
   - A regex bug read `updated_at` as a table named `d_at`.
   - Tests that spawn the server hung silently when it crashed at startup, because their output is ignored.
   - Direct counts in tests assumed one file.

   A per-file timing run found the hangs, and the server's own startup error explained them.
2. **What would make the next one easier.** The store refuses ambiguity with the offending SQL in the message, and the static scan catches mixed statements before runtime.
3. **What changes downstream.**
   - LAT-08's original-data rehearsal now includes this move.
   - Export and restore per project can be a file copy of `projects/<id>.sqlite` plus the project's platform rows.
4. **Questions.** Whether each project's file should later sit with its workspace or in a hosted store (DEC-056 left this open).
5. **Process change.** The SQL classification scan is now a test (applied, passing).
