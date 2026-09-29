# LAT-08 local migration checkpoint · 2026-09-29

**Verdict: partial.** The isolated candidate implements and locally verifies the action migration and runtime boundaries. LAT-08 remains open until a vetted persistent candidate data copy, candidate UI journey, and original-portal coexistence check can be reviewed. No provider turn, external write, release, acceptance, or promotion occurred.

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

The current-data rehearsal is in memory only. A vetted persistent candidate data image has not been created because the noncredential content has not been reviewed for secrets or suitability for an inspectable fixture. The candidate UI has not been checked in a browser: Playwright and browser binaries are absent locally. The original portal was not running at its usual port during this checkpoint, so coexistence on original data was not directly observed. The isolated candidate has no dispatch and the original SQLite database was not changed. Keep `next_action: LAT-08`; finish a sanitized persistent candidate fixture, validate the migration UI and original/candidate coexistence, then determine whether the LAT-08 gate passes. LAT-08A remains dependent.

## Post-hoc retrospective

1. **Friction:** the migration initially invalidated four old worker paths after restart because a role pin was omitted; the candidate and current data also have different schema ages.
2. **Preparation:** retain exact historical pin shape in run validation and use a per-table metadata ledger plus repeat-pass hash check before introducing current data into a candidate.
3. **Downstream effect:** LAT-08A can use the new action and grant records, but must wait for candidate data and UI checks; LAT-09 still owns owner usefulness comparison.
4. **Questions:** which noncredential source content is safe and useful in a durable candidate fixture, and can the current portal be run alongside the candidate without mutable-path overlap? These block LAT-08 completion. No current policy exists to backfill; new policy proposals still use the existing review path.
5. **Applied versus hypothesis:** the historical pin fix passed four affected tests and the full 151-test suite; the in-memory migration passed identity, integrity and idempotence checks. Candidate browser behavior and coexistence remain unproved.
