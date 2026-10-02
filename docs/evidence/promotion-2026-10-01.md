# Promotion of the layer-template candidate to main (DEC-062)

- **Date / author:** 2026-10-01, agent (Claude), on the owner's instruction in chat: "lets make this 'candidate' our main. nothing too stable about the old version anyways."
- **Scope:**
  - local commits, the merge, a data backup and a rehearsal on copied data;
  - the owner restarts the portal and reviews it.
  - Nothing was pushed or deleted.

## What was done

| Step | Result |
|---|---|
| Backup | `apps/portal/.data` (1.1 GB, three projects) copied to `.data/backups/portal-data-2026-10-01-pre-promotion` (git-ignored). `PRAGMA integrity_check` returned `ok`, with 169 knowledge records |
| Pending docs | Committed as `d8cdbf6`. This included planning records left uncommitted across sessions; `notes.txt` and the candidate checkouts were left out |
| Merge | `feature/pages-layer-template` (`30d4d37`) merged as `1c17c48`. The branches split at `f04d184` (2026-09-27): `main` had 10 docs-only commits and the candidate 68. Two docs conflicts (`docs/status.md` and `custom-markdown-layer.md`) took `main`'s current records |
| Promotion config | `1e425a2`: `./launch-machine` exports `MACHINE_LAYER_TEMPLATES_ENABLED=1` unless it is set to `0`. `config/layer-templates.json` now reads `repo: layer-base`, because the old `../layer-base` would have resolved outside the workspace after the move. `/layer-base/` is git-ignored as its own repository |
| Build | `npm run build` passes; the lockfile is unchanged |
| Server suites | Templates on: 289 tests, 282 pass, **0 fail**, 7 skips with stated reasons. Templates off: 265 pass, **0 fail**, 24 skips, every one marked "needs the pinned templates" |
| Rehearsal | Merged code with templates on, on :4341, against a copy of the backup. Workspace paths in `project_setup`, `symphony_attempts` and `symphony_pools` were rewritten to the copy first. Startup was clean (`/api/session` and `/` returned 200, no errors logged). Project tables split into per-project SQLite files (PROJECT-DB-01, with its own pre-split copy), and 8 layer packages were installed |
| Data parity | All 169 records were kept with the same `(id, kind, revision)`: 168 in `knowledge_records`, and Browser Buddy's one `data_operation` (`opr-6ac4104a`) moved into Data's repository file as an entry with the same ID and revision ("Adopted from records"). Code units 31 → 31, trace links 4 → 4, repository bindings 1 → 1, projects 3 → 3, users 2 → 2 |
| Links | 32 evidence links into the old candidate checkouts were repointed to `docs/evidence/`, and every rewritten link resolves |

**Not done:** the live portal has not been restarted on the new code. That restart, and the owner's look around in the browser, are the remaining evidence. Live data has not been changed: `apps/portal/.data` still has no `projects/` folder. The old candidate checkouts (`pages-template-candidate`, `lat08-candidate`, `custom-layer-candidate`, `layer-template-pages`, and the `aludel-layer-model` worktree) remain for the owner to remove. `pages-template-candidate`'s Git directory is inside `lat08-candidate`.

**Rollback:** stop the portal, restore the backup over `apps/portal/.data`, and check out `f18a8b7` (or revert `1c17c48` and `1e425a2`).

## Retrospective

1. **What made it harder?**
   - The database stores absolute workspace paths. A plain copy of the data folder would have pointed the rehearsal at the live app workspaces. This was caught by scanning every column for the live path before starting.
   - The template repository path was relative to the checkout, so it would have broken silently after the move.
   - `env -i` dropped the nvm Node 24 from `PATH`, and the system's Node 18 failed on `node:sqlite`.
2. **What would make the next one easier?** A rehearsal script that:
   - copies the data folder;
   - rewrites every column holding the source data path (found by scan, not a fixed list);
   - starts the portal on a spare port with an explicit Node 24;
   - compares `(id, kind, revision)` across `knowledge_records` and `layer_file_entries`.

   This is a hypothesis until it is scripted and run a second time.
3. **What changed in the plan?**
   - LAT-09 was waived. LAT-10's cutover is covered by the backup and the rehearsal.
   - T03-CODE now works on `main`, and its GitHub setup shrank to checking the existing App, because :4310 already has the callback and `.env`.
   - LAYER-GITHUB-01 was added for the other layers' repositories.
4. **Questions:** none blocking. The owner's browser review after restart is the open check.
5. **Process change applied now:** the rehearsal-before-restart procedure above was used for this promotion and recorded here. Whether it is reusable stays unproven until the script exists.
