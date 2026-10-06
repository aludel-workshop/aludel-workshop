---
id: MULTI-REPO-ITEMS-01
kind: work-record
status: building
updated: 2026-10-06
item: W-33
depends_on: [COLLAB-WORK-01, AGENT-WORK-01]
---

# Items across a project's repositories (W-33)

## Authorization and scope

- **Source:** W-33 was created and started by the owner in the portal on 2026-10-06, then confirmed in chat ("started"). The owner's steer on starting: "make sure you aren't designing this just for aludel itself. any project should be able to have multiple repos."
- **This action (#1):** a spec and its evidence, on `aludel/w-33`. Read-only GitHub checks only (`git ls-remote`, and `git push --dry-run`, which writes nothing).
- **Not authorized:** GitHub settings or App changes, writes to any `layer-base` branch, and changes to the portal before the spec gate is reviewed.
- **Branch:** `aludel/w-33` from `main` at `4bf3cbd`. `origin/aludel/w-29` is the newest handoff (5 commits ahead of main, `8fe4197`). Nothing it carries is needed here; see W-29 under Readiness.

## Outcome

Any project can own several repositories. An item changes any of them as one change: it checks them out, reports them, has them reviewed, and closes them out together. Aludel's case (`aludel-workshop` plus `layer-base`'s template branches) is the first project to use it, not a special case.

**Done when:** an item that changes a `layer-base` template branch and the portal's pin reports both repositories. The owner reviews both in the modal. Close-out pushes and merges both, and the pin then resolves on the owner's portal with no manual step. Server tests and a browser journey cover it, using a project that isn't Aludel-shaped.

## What's there today (main at `4bf3cbd`)

| Concern | Today | Where |
|---|---|---|
| Which repositories a project has | One row per project (`project_id` is the primary key) | `server/storage.mjs:90` `repository_bindings` |
| Container checkout | The primary is cloned by Dev Containers. `layer-base` comes as a read-only Git bundle with no remote (E1) | `.devcontainer/aludel-setup.sh:21-26`, `server/item-environment.mjs:16` |
| Push from the container | The person's own credentials, through VS Code's forwarded git credential helper. None are stored in the container | `tools/aludel-client.mjs:117-131`; `/etc/gitconfig` credential helper |
| Report | One `{ branch, commit, base, files }` | `server/agent-work.mjs` `recordCode` |
| Review Files view | One repository's diff | `server/agent-work.mjs` `codeFiles` |
| Close-out | Merges into the local main inside the record transaction, then pushes to GitHub afterwards. A failed push leaves "merged here, not on GitHub" | `server/agent-work.mjs` `closeOut`; `server/server.mjs:1301-1330` |
| Template pins | `config/layer-templates.json` names a branch and commit per template in `layer-base`. The host resolves them from `<workspace>/layer-base` | `server/item-environment.mjs:16`, `server/layer-source.mjs` |

**Checked live from this container (2026-10-06):**
- `git ls-remote https://github.com/aludel-workshop/layer-base.git` works with the forwarded credentials. All template branches are listed, and every pin except `base` is a branch tip. GitHub's `main` (`924ef31`) is ahead of the `base` pin (`fee5f30`), and the pin is its ancestor.
- `git push --dry-run` to a new `layer-base` branch was accepted. GitHub authorizes push at the receive-pack handshake, so this is good evidence of write access. It's still not a completed push, which #2 proves.
- The `aludel-workshop` organization's App installation covers all repositories (platform-pipeline record §1), so the portal can fetch and push `layer-base` with the token it already uses.

**What this shows:**
- E1's reason for the bundle (no credentials in the container) no longer holds for a person's container.
- It still holds for a headless runtime (A2), which has no person behind it.

**Prior scouting:** [LAYER-REPOSITORIES-01](../layer-repositories/work-record.md) (superseded direction). Two of its findings hold:
- A project's state is a vector of commits, one per repository.
- No provider offers an atomic merge across repositories, so compatibility has to be checked across the vector.

Its suggestion of "one output repository per task" is overruled by DEC-069 (3) and this item's brief.

## Design

### 1. The project's repository set (generic)

A project has one **primary** repository (the one it was created or connected with) and any number of **companion** repositories. Each repository has:

| Field | Meaning | Aludel |
|---|---|---|
| `key` | Stable name within the project | `app`, `layer-base` |
| `url` | Clone URL | `https://github.com/aludel-workshop/layer-base.git` |
| `path` | Where it sits beside the primary checkout (the primary is `.`) | `layer-base` (already gitignored) |
| `lines` | Long-lived branches that items may change. Defaults to the default branch only | `main`, `pages`, `markdown`, `data`, `vision`, `design`, `code` |
| `references` | Files in this repository that name commits in another one (below) | `apps/portal/config/layer-templates.json` → `layer-base` |

**Recommended (Q1):** the set is declared in the primary repository's `.aludel/repositories.json`, beside DEC-067's `.aludel/layer.json`.
- It's then portable: a clone or another instance knows the set (P10).
- It's reviewed like code, so adding a repository is itself an item.
- The host keeps only access state per repository: provider, installation, status and last error. That means widening `repository_bindings` to one row per `(project_id, key)`.
- Code's repository panel lists the set with each repository's access state. An unreachable companion blocks only items that touch it.
- Aludel's `layer-templates.json` keeps its own `repo` field, which becomes a lookup by key.

### 2. Item branches

- On a repository's default line, an item's branch is `aludel/w-n`, as today.
- On any other line, it's `aludel/w-n--<line>` (for example `aludel/w-33--design` in `layer-base`).
- The `--` separator avoids the ref clash that `aludel/w-33` and `aludel/w-33/design` would have, and keeps `branchItem` able to recover the item.
- Branches are made lazily. An item gets a branch only on the lines it actually changes. The rest stay at their fetched tips, read-only by convention.

### 3. Container

`aludel-setup.sh`, after connecting:
- reads `.aludel/repositories.json`;
- clones each companion to its `path` with the person's forwarded credentials;
- sets the person's git identity in each clone, as connecting does for the primary;
- fetches every line.

**No credentials are kept:** the clone URL has no token, and pushes go through the forwarded helper only.

`start_work` checks out the primary as today. A new `aludel line <key> <line>` (with the same MCP tool) checks out or creates that line's item branch in a companion. A clone failure says which repository failed and why, and falls back as below.

**Recommended (Q3):** the bundle stays only as the fallback where there's no person behind the session (A2's headless runtime), and then read-only. A person's container never uses it.
- Changing a companion without credentials is refused.
- `aludel templates` becomes "fetch the companions", with the bundle as its fallback.

### 4. Report

`report_code` reads more than the primary:
- It finds every repository in the set whose item branches are ahead of their line.
- It pushes each one with `--force-with-lease`.
- It reports one entry per changed branch: `{ repository, line, branch, commit, base, files }`.

**Server side:**
- `code` becomes `{ repositories: [...] }`.
- An old single-shape report is read as the primary's entry, so items reported before this keep working.
- The log line names each repository.

### 5. Review

- The modal's Files view groups files by repository, and by line where there's more than one. A repository-and-line header shows the branch and its short commit.
- `codeFiles` takes a repository key. It reads from the host's clone of that repository, which is `<workspace>/<path>` (for Aludel, the owner's `layer-base` beside the portal), fetched with the installation token like the primary.

### 6. Close-out: checks, then together or not at all

GitHub has no transaction across repositories, so "together or not at all" means this order:

1. **Fetch** every reported branch. Refuse any that moved since it was reported (as today, per repository).
2. **Plan** every merge (fast-forward, merge commit or already merged) without moving any ref. A conflict anywhere sends the item back with every conflicting repository named, and nothing moves.
3. **Check** the planned vector:
   - **References (generic, built in):** for each declared reference file, at its planned commit, every commit it names must be on the named line of the target repository's planned tip. For Aludel, every template pin must name a commit on its template branch.
   - **Project checks (Q2):** commands declared in `.aludel/repositories.json`, run over the planned vector. For Aludel, that's the reviewed-digest check.
4. **Push** to GitHub, referenced repositories first (so `layer-base` before `aludel-workshop`). Each push is `--atomic` with a lease on the old tip.
   - If a later push fails, earlier ones are pushed back to their old tips, with a lease.
   - The item stays in review with a note naming what happened.
5. **Apply** locally in one step: record changes, then each local ref moves only if it's still where the plan found it.

A crash between steps 4 and 5 leaves GitHub ahead of the host. That's recoverable: running close-out again plans those merges as "already merged" and applies the rest. A companion ahead with nothing pointing at it yet is harmless, because pins name commits, not tips.

**Changes from today:** pushing moves before applying locally, so "merged here, not on GitHub" stops being possible. A project with one repository goes through the same path with a vector of one.

**Recommended (Q2):**
- The **reference check** is data-only and runs on the host.
- **Project check commands** are agent-written code, so they never run in the host process. They run in a throwaway container with no network and no credentials, over a checkout of the planned vector, and a failure blocks close-out with its output.
- Docker is already used locally for item containers and previews.
- The alternative is reference checks only, leaving the digest check to the `test:server:templates` gate the agent runs. That's cheaper, but it isn't enforced at close-out.

### 7. Retiring the stopgaps

- `GET /api/editor/templates` serves only the headless fallback.
- W-29 #4's one-off bundle on its item branch isn't on main (W-29 is at `8fe4197`). If W-29 closes first, #6 removes the bundle. Otherwise #6 leaves W-29 a note to drop it and report the template commit through its own `layer-base` branch.

## Evidence and gaps

| Requirement | Evidence | State | Gap |
|---|---|---|---|
| Container can read every companion | `ls-remote` to `layer-base` from this container, 2026-10-06 | agent-checked | Another person's container. CW-2 collaborators need GitHub access to each companion |
| Container can push a companion | `push --dry-run` accepted | agent-checked (handshake only) | A real push. #2 proves it on `aludel/w-33--<line>` |
| Portal can fetch and push a companion | Org installation has "all repositories" | documented in platform-pipeline §1 | A personal-account project's installation may select repositories, so it shows as an access state |
| Generic, not Aludel-shaped | Design §1–6 has no Aludel names outside the examples | spec | #6's journey uses a two-repository fixture project that isn't Aludel |
| All or nothing | Design §6 ordering | spec | A forced push failure in server tests (#5) |

## Work sequence (the actions after this gate)

| # | Output | Check |
|---|---|---|
| 2 | Repository set (file plus bindings per key), companion clones in setup, `aludel line`, identity per clone | A fresh container clones `layer-base`, makes `aludel/w-33--<line>` and pushes it for real |
| 3 | Report as a set; reading the old shape | Server tests: two repositories, a branch per line, the old shape |
| 4 | Files view grouped by repository | Preview, browser journey step |
| 5 | Close-out fetch → plan → check → push → apply; reference check; project checks in a sealed container (Q2) | Server tests: a conflict in one repository, a bad pin, a failed second push rolls back the first, a re-run after a crash |
| 6 | Bundle as headless fallback only; end-to-end journey on a non-Aludel fixture; W-29 cleanup | The journey: change a companion line plus a pin, review both, close out, the pin resolves |
| 7 | Records, retrospective, `test:server:templates` | Gate passes |

Code's repository panel listing the set and its access (§1) isn't an action yet. Once Q1 is answered I'll add it under #2, or as its own action if you'd rather review it apart.

## Readiness

- **Verdict:** ready to build once the owner answers Q1–Q3. Each has a recommendation, and none blocks #2's clone work except Q1's file location.
- **Must not begin yet:** any portal change (the gate), and any write to `layer-base` (that's #2, after the gate).

## Questions for the owner

- **Q1:** Is the repository set declared in the primary repository's `.aludel/repositories.json`, with the host keeping only access state per repository? *Recommended.* The alternative is portal settings only, which aren't portable between instances.
- **Q2:** Close-out runs built-in reference checks on the host, plus project-declared check commands in a sealed container. *Recommended.* The alternative is reference checks only, leaving the digest check to the test gate.
- **Q3:** Is the bundle kept only as a read-only fallback for headless sessions? *Recommended.* The alternative is removing it, so headless sessions can't build templates until A2 has credentials.

## Review / acceptance record

- **Spec (#1, `7bf82ef`):** approved by the owner on 2026-10-06, with these answers in the portal:
  - **Q1, portal settings only** (overrides the recommendation). The set lives in the portal (`project_repositories`), not in `.aludel/repositories.json`.
    - Consequence: another instance doesn't learn the set from a clone; it's set up there in settings.
    - Adding a repository is a settings change by the owner, not item work.
    - Design §1 stands otherwise. The container reads the set from the portal (`GET /api/editor/repositories`).
  - **Q2, as recommended:** reference checks on the host, plus project checks in a sealed container.
  - **Q3, remove the bundle** (overrides the recommendation).
    - `GET /api/editor/templates` and `aludel templates` go in #6.
    - Consequence: a headless session (A2) can't check out companions until it has credentials of its own. A2's design has to bring them.
    - The Symphony worker's `layer-bundle` is a different path, and this answer doesn't cover it.
- **Re-cut after Q1:**
  - #2 became "Keep the project's repositories in its settings".
  - The container checkout moved to a new #8. It was added after #2, so the portal lists #3 after #2, but #8 is done before #3.
  - The page is in project Settings, not in Code: with templates on, Code's UI comes from `layer-base`'s `code` branch, and the set is host settings rather than a Code record.

## Built

**#2: the project's repositories in its settings.**
- **Store:** `server/project-repositories.mjs`.
  - The primary follows the project's repository binding (its key, URL and default line) and keeps only its own pins and checks.
  - Companions have a key, URL, folder, lines, pins and checks.
  - Each has an access state from its last check: `ready`, `no-access`, `missing-lines`, `unchecked`, or `local` for a project without GitHub.
- **Access check:** `git ls-remote` with the project's installation token, for GitHub URLs only. A token that can't be had is `no-access` without any git call.
- **Validation:**
  - refuses URLs with credentials, folders outside the project or overlapping another, and branch names git refuses;
  - refuses pins into an unknown repository, and removing a repository something pins into;
  - the primary can't be removed.
- **API:**
  - `GET|PUT|DELETE /api/projects/:id/code/repositories` and `POST …/repositories-check`. Writes are owner-only.
  - `GET /api/editor/repositories` lists the set for item containers, with URLs and access state only.
- **Settings › Repositories** (`src/layers/project-repositories.ts`): the set with access chips, add and edit (pins and close-out checks included), check access, and remove.
- **Checks:**
  - `tests/project-repositories.test.mjs`: 5 tests passing.
  - `tests/project-repositories-browser.mjs`: passing. It covers a fresh project that isn't Aludel, two companions from bare repositories (one reachable, one missing a line), refusal of a URL with credentials, pins and a check on the primary, removal refused while pinned, 390px, and axe.
  - `npm run typecheck` is clean.
  - `npm run test:affected -- --concurrency 3`: everything passed except 4 tests.
    - 3 fail the same way on `main` (`4bf3cbd`, checked in a separate worktree) with `runner ENOENT`: `layer-source.mjs` runs combined layer tests with `docker run`, and this item container has no Docker. They aren't caused by this change.
    - `security-audit-worker` failed under load and passes alone.
    - For Q2, close-out's sealed project checks reuse the same `docker run --network none --read-only` pattern on the host. Like those 3, they can only run where Docker is.
- **Not here yet:**
  - Aludel's own set (`layer-base` with its seven lines, the `layer-templates.json` pins and the digest check) is entered on the owner's portal once #2 is accepted. That's an owner settings action on the live portal.
  - The container side is #8.

**#8: every repository in the item container.**
- **`aludel repositories`** (`checkoutRepositories` in `tools/aludel-client.mjs`) reads the set from the portal and puts each companion beside the checkout at its folder:
  - cloned on its default line, or fetched if it's already there;
  - a folder with no remote (from the old bundle) is adopted, and one whose origin points elsewhere is left alone, with the reason;
  - each clone gets the person's git identity from the primary;
  - a line origin doesn't have is reported.
  The remote is always the plain URL; git uses the person's own access.
- **`aludel line <repository> <line>`** and the MCP tool **`start_line`** (`startLine`):
  - put a companion on `aludel/w-n` (its default line) or `aludel/w-n--<line>`;
  - the branch is made from origin's line, or taken up from origin when the item already pushed it;
  - switching needs a clean folder.
- **Setup:** `.devcontainer/aludel-setup.sh` runs `aludel repositories` after connecting. `aludel templates` stays until #6 retires it (Q3), because the live portal has no repositories list until W-33 merges.
- **Checks:**
  - `tests/repository-checkout.test.mjs`: 5 tests passing.
  - The affected set without the three Docker-only files: 53 tests, 52 passing, 0 failing.
- **Live proof (2026-10-06, this item container):**
  - With Aludel's values (`layer-base` at `layer-base`, its seven lines), the bundle-made `./layer-base` was adopted with origin `https://github.com/aludel-workshop/layer-base.git`, and every line was fetched.
  - `startLine` made `aludel/w-33--design` from `origin/design`, and a real `git push` created it on GitHub at `550f846`, the Design template's tip, with no new commits.
  - The push went through VS Code's forwarded helper. `layer-base/.git/config` holds only the plain URL.
  - The live portal couldn't serve the list for this, since it runs `main`; the values were passed directly. The client-to-portal path is covered by the server route and #6's journey.

## Process note (three lines)

- **Changed:** the spec is generic from the start, after the owner's steer. Aludel and `layer-base` appear only as the first project's values, and the end-to-end journey uses a fixture that isn't Aludel.
- **Checked:** credentials and access were checked live (read, plus a push dry-run) rather than assumed from E1's earlier reasoning, which turned out to be outdated for person containers.
- **Waiting on the owner:** Q1–Q3, and the spec gate.
