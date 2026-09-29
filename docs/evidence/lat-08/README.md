# LAT-08 local migration checkpoint · 2026-09-29

**Verdict: partial.** The isolated candidate implements and locally verifies the action migration and runtime boundaries. A sanitized persistent current-data preview and side-by-side local preview now pass mechanical checks. LAT-08 remains open for browser review and proof that the original portal can run on its original data. No provider turn, external write, release, acceptance, or promotion occurred.

## Process change and application

LAT-07 found that declaring new actions before migrating admission could break older Go work. LAT-08 therefore uses an append-only mapping ledger for old Work, retains legacy action and run records, and checks the action installation before new Go. A read-only source snapshot is copied into process memory with credential tables excluded and password fields scrubbed, then migrated twice. The second pass and original-column hashes test repeatability and nonmutation. A restart test found that older bundles can contain action adapter metadata yet still pin a legacy role revision; validating the pin shape actually stored in each bundle fixed four failed integration tests. This is applied process evidence, not a claim about owner usefulness.

## Task outcome

- Installed layer actions and revisioned methods, with Dreamer, Planner and Tinkerer defaults only at first installation. Project Settings can change work style; each layer's Operations view owns action method, default assignee, and normal/elevated grants. The old Roles route redirects to Work items; historical role records remain readable.
- Migrated role members and leads into scoped grants. New Work and Go use the mapping ledger; unsupported actions are blocked. Code serves tracked text from an exact project commit to an authorized action or pinned worker attempt, excludes secrets and unsafe paths, and checks candidate write/effect scopes separately. Existing Code implementation and security adapters were registered for these checks.
- Historical action revisions, old Go bundles, attempts, and review state are retained. No synthetic acceptance or run was inserted.

## Current-data reconciliation

The [metadata ledger](rehearsal-summary.json) records counts for every one of 59 source tables, 17 knowledge kinds, all 14 credential-table exclusions, and password-field scrubbing. The in-memory copy included 45 noncredential tables and 1,954 rows. The source had two configured projects and five Work items. Migration installed 19 actions and 12 grants per project, mapped all five Work items, blocked none, and made zero changes on its second pass. Every original copied row and column hash remained unchanged; SQLite integrity was `ok`. The live source database was opened read-only. The original data and existing portal code were not edited. The source has no layer connection or policy proposal table, so there was no current policy record to backfill. A disposable fixture separately verifies that unsupported open actions remain blocked.

## Checks

- `npm run test:server`: 151/151 pass, including migrated grants, all three work styles, old bundle restart, pinned worker source, denied secret/symlink/traversal reads, and candidate effect checks.
- `npm run typecheck`: pass; existing Angular optional-chain warnings remain.
- `npm run build`: pass; bundle size warning remains.
- `git diff --check`: pass.
- A disposable candidate server returned 200 for `/` and 401 for unauthenticated `/api/projects`; it was stopped afterward.

## Remaining gate and handoff

A sanitized persistent preview now exists in `/tmp/aludel-lat08-preview-20260929` and passed the checks below; it is not a full-fidelity replacement for the current database. The candidate UI has not been checked in a browser: Playwright and browser binaries are absent locally. The original portal was run beside the candidate on a separate sanitized fixture, not on its original database. The isolated candidate has no dispatch and the original SQLite database was not changed. Keep `next_action: LAT-08`; owner browser review and original-data startup proof remain before the LAT-08 gate can pass. LAT-08A remains dependent.

## Post-hoc retrospective

1. **Friction:** the migration initially invalidated four old worker paths after restart because a role pin was omitted; the candidate and current data also have different schema ages.
2. **Preparation:** retain exact historical pin shape in run validation and use a per-table metadata ledger plus repeat-pass hash check before introducing current data into a candidate.
3. **Downstream effect:** LAT-08A can use the new action and grant records, but must wait for candidate data and UI checks; LAT-09 still owns owner usefulness comparison.
4. **Questions:** the sanitized fixture answers the local inspection and mutable-path overlap questions. Does the migrated UI make action/grant ownership clear in a browser, and can the original portal still start on its original data? These block LAT-08 completion. No current policy exists to backfill; new policy proposals still use the existing review path.
5. **Applied versus hypothesis:** the historical pin fix passed four affected tests and the full 151-test suite; the in-memory migration passed identity, integrity and idempotence checks. The sanitized persistent preview and separate-process API checks passed. Candidate browser behavior and original-data startup remain unproved.

## Sanitized persistent preview and coexistence check · 2026-09-29

`lat08-preview-fixture.mjs` opened the current SQLite source read-only and made two independent temporary copies. It excluded 14 credential/session tables and four regenerable corpus-import cache tables, cleared original password fields, replaced 4,158 free-text strings, pseudonymized unsafe IDs and unique fields, and added two **preview-only** owner memberships so local setup can show both sampled projects. The [aggregate preview ledger](preview-ledger.json) reports every source table's row count and exclusion. No raw source text or credential was written into the tracked evidence. The fixture contained 523 retained rows, including the 169 knowledge records and five Work items, before each portal's own startup; SQLite integrity and foreign-key checks passed with zero secret-pattern matches and no retained long rewritten source strings. The original database's size and modification time remained unchanged.

Both servers were run concurrently with dispatch disabled: candidate at `http://127.0.0.1:4398` with `/tmp/aludel-lat08-preview-20260929`, current portal at `http://localhost:4399` with `/tmp/aludel-lat08-current-preview-20260929`. Distinct hostnames keep browser cookies separate; the two databases and project workspaces are also distinct. The candidate installed 38 actions, mapped five historical Work items and kept 24 grants; the current portal had no LAT-08 action-installation table. The repeatable `lat08-preview-check.mjs` passed: both shells and both projects' authenticated knowledge snapshots returned 200; the candidate action list returned 200, exact-commit Code source returned 200, `.env` returned 404, and swapped session cookies returned 401 in both directions. A first sanitized copy caused a current-portal routine date error because cadence enum values had been redacted; preserving only the safe `weekly`, `monthly`, and `before-release` values fixed the snapshot check. A prior attempt retained the regenerable import cache and collided with the portal importer; excluding that cache fixed startup. These were fixture defects, not source-data edits.

**Owner browser review requested:** open the candidate on `127.0.0.1:4398`, set a disposable local owner key, and inspect Settings style, layer Operations action setup, and Work. The current preview is on `localhost:4399` for comparison. Neither uses the original live database. The browser result and original-data startup evidence are still pending.
