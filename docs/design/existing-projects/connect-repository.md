# EX-02A: create a project by connecting an existing repository to its Code layer

- **ID / date / author:** EX-02A (a slice of [EXISTING-PROJECTS-01](work-record.md) EX-02), revision 1, 2026-10-05, Claude Code (owner chat).
- **Outcome:** the owner creates a new project, picks an existing GitHub repository, and gets a project whose Code layer reads that repository. That includes a repository whose app sits in a subfolder, like this one. Work items in the project merge into that repository through close-out (COLLAB-WORK-01 CW-1). The first real use is Aludel's own repository, which also unblocks the AGENT-WORK-01 dogfood.
- **Built on:** `claude/agent-work-prototype-7en0jx` at `f0bf041`, plus uncommitted CW-1 (accepted by the owner on 2026-10-05).

## Authorization and scope

Owner, in chat on 2026-10-05: "lets not try to blitz through adding aludel as a project within itself. this is a key piece of functionality we are going to want eventually, so lets figure it out, even if it is just local for now. say i create a new project for this aludel, want to connect the repo to its code layer. lets make that work right."

**Authorized:**
- this design record;
- read-only inspection, including a dry run on a disposable clone in the scratchpad;
- once the owner approves this plan: local prototypes, code and tests under DEC-029.

DEC-061 already covers GitHub writes when the owner starts them in the browser: importing a repository and adding `.aludel/`.

**Not authorized:**
- any agent-held token;
- live GitHub calls by the agent;
- changing the built-in `the-machine` project's data;
- spending money.

## What exists (checked 2026-10-05)

| Piece | Where | State |
|---|---|---|
| Import an existing GitHub repository: check (clone, list the files it would add), then confirm (move the starter repository aside, install Code into `.aludel/` as one commit, seed starter docs, push) | [code-import.mjs](../../../apps/portal/server/code-import.mjs); route `POST /api/projects/:id/repository/import` ([server.mjs:1584](../../../apps/portal/server/server.mjs#L1584)); onboarding GitHub step (`src/public.ts` `checkImport`/`confirmImport`) | Server path tested against the fake GitHub (`code-github.test.mjs`). **The screen has never been seen in a browser**, because browser journeys can't fake a connected GitHub account ([T03-CODE evidence](../../evidence/t03-code/README.md), limits). No live run. |
| Where import sits | Inside new-app onboarding: look → features → stack → GitHub (create **or** import) → agent | By then the project already has a recipe and a scaffolded starter app, which import moves aside. Its look, features and stack describe a generated app, not the one being connected. |
| Code's unit paths | Template `code` `layer.json` `files.units`: `src/**`, `server/**`, `tests/**` | **This repository keeps its app in `apps/portal/`.** 0 of its 1,391 tracked files match those paths (263 sit under `apps/portal/{src,server,tests}`). Connected as it is, Code would show no code. |
| Install plan on this repository | `projectRepositoryInstallPlan`, dry run on a clone of `main` in the scratchpad | 17 files added, all under `.aludel/`, with no conflicts. |
| GitHub access | Live database (read-only) | The Aludel GitHub App is installed on the `aludel-workshop` organization, for all repositories, with administration and contents write. So `aludel-workshop/aludel-workshop` is reachable. |
| Limits | T03-CODE evidence | Default branches other than `main` are refused. The indexer refuses more than about 2,000 units or source files. That count for `apps/portal` isn't measured yet. |
| Aludel's built-in project | `the-machine` | Has no repository binding or workspace. It predates onboarding. Its records stay as they are; moving its knowledge in is LAY-06 / EX-07. |

## Design

### 1. Two ways to start a project

The first screen of New project offers two choices:

- **Start a new app:** today's onboarding, with recipe, look, features, stack, then create the repository.
- **Connect an existing repository:** for an app that already exists. There's no recipe, look, features, stack or generated skeleton, because the repository is the source.

The connect path:
1. **Name the project.** It defaults to the repository's name.
2. **GitHub.** Connect the account if needed, then pick the installation and the repository. Only installations that can reach it are offered.
3. **Check, read-only.** Aludel clones the repository and shows:
   - the default branch;
   - its size;
   - whether `.aludel/` already exists;
   - **where the code is**, as detected candidates;
   - the exact files it will add.
4. **Where the code is.** Aludel suggests app folders: a folder with a `package.json`, `pyproject.toml`, `go.mod` or `Cargo.toml` that has source next to it, with the root as a candidate too. Each one shows the files and units it would cover. The owner picks one or more, or edits the paths.
5. **Confirm.** One commit adds `.aludel/`, including the chosen code paths, and is pushed to `main`. The owner starts this in the browser, as DEC-061 requires.
6. **Open the project on Code** at the connected commit, with units indexed.

Vision, Design, Pages and Data start empty. Reconstructing them from the code is EX-03, not this slice.

**The import step in new-app onboarding** moves to this path, rather than replacing a scaffolded app halfway through onboarding. Projects created that way keep working.

### 2. "Where the code is" belongs to the repository

The chosen paths are written into the Code layer's fork, in `.aludel/layer.json` under `files.units`, for example `apps/portal/src/**`. The repository stays the authority, and a later change to them is an ordinary reviewed change to `.aludel/` (T03 decision 5). This works the same for any layout:
- a single app at the root;
- a monorepo with one app;
- several apps in one repository.

### 3. Size, branches and what's out of scope

- **Size.** The check counts units against the indexer's limit. If the chosen paths go over it, the check says so and blocks Confirm until the paths are narrowed. Paging the indexer is a separate change, made only if real repositories need it.
- **Default branch.** Anything other than `main` stays refused, with a message.
- **Preview and deploy** of a connected repository need its own build declaration (PP-01D, DEPLOY-HOST-01). Until then the Preview environment shows as not set up, rather than guessing. Aludel's repository has no root `Dockerfile`, so its preview stays unavailable.
- **A local-only repository with no GitHub** is out of scope. DEC-061 puts Code on GitHub, and CW-1 makes the GitHub remote the handoff. "Local for now" means Aludel runs on this machine; the repository is still on GitHub. A local-path source can come later if offline work needs it.

### 4. After connecting

- The project's workspace is Aludel's own clone, under `.data/workspaces/<id>`. Close-out merges there and pushes `main` to GitHub (A4 and CW-1).
- Commits pushed to GitHub from elsewhere are picked up by the existing sync (`layer-remote.mjs`). A change to `.aludel/` authority files is held for review.
- Developers keep working in their own checkouts and pull `main`.
- **Naming.** The built-in "Aludel" project (`the-machine`) remains. The new project needs a distinct name until LAY-06 / EX-07 merges them, for example "Aludel (repository)". The owner's choice.

## Work sequence

| Packet | Depends on | Work and output | Agent check | Who reviews | Stop if |
|---|---|---|---|---|---|
| C0 Prototype the connect path | — | A clickable prototype: the choice on New project, then repository, check, where the code is, confirm. Uses a monorepo case shaped like this repository and a single-app case. | Self-review against this record. Axe and a 390 px check. | **Owner**, flag-and-say | The owner changes the shape: revise, then build |
| C1 Fake GitHub in browser journeys | — | Browser journeys can sign in to a fake GitHub: a stubbed API plus `fake-github-git.mjs` for git. T03-CODE's retrospective asked for this. | The existing import screen driven in a browser for the first time | — | — |
| C2 Code paths at connect | — | App-folder detection. `files.units` written into the installed manifest. The unit count in the check. The indexer reads the chosen paths. | Monorepo and single-app fixtures. Too-large paths blocked. Unchanged scaffolded projects keep their units and IDs. | — | Unit count for `apps/portal` over the limit (then decide on paging) |
| C3 The connect path, built | C0 accepted, C1, C2 | The New project choice and connect screens. Import moves out of new-app onboarding. | Browser journey on the fake GitHub: create, connect a monorepo fixture, Code shows its units. Then a work item closes out into it. Suites (two tiers). | Owner in the browser | — |
| C4 Live: connect Aludel's repository | C3, **owner in the browser** | The owner creates "Aludel" and connects `aludel-workshop/aludel-workshop` with code at `apps/portal`. Confirming pushes the `.aludel/` commit to `main`. | Code shows Aludel's units at the pushed commit. Sync picks up a later push. | Owner | Anything not shown in the check |

| C5 Retire the built-in project | C4 | Replaces "member of `the-machine`" with an explicit instance owner. That person gets the "Aludel workspace" link, the sign-in landing and the GitHub connect, install and refresh routes, and those routes move to the user level. Removes `the-machine`'s special cases (`aludelProjectId` in `server.mjs`, `onboarding.mjs`, `accounts.mjs` and `src/`), its seed (`product-records.mjs`, `product-workspace.mjs`), its old document import, and the single-project route that connected this checkout. Deletes its data with `tools/delete-project.mjs`: a dry run first, and a `VACUUM INTO` backup. | A fresh instance's first user is the instance owner. An existing instance keeps its owner. No route answers for `the-machine`. Suites (two tiers). The delete tool's dry run on a copy of the live data. | Owner. The live delete waits until the owner has said what the restart will do. | Anything else uses `the-machine` |

C4 then unblocks the AGENT-WORK-01 dogfood: an A6 item in the new project, claimed from a worktree, closed out into the connected repository.

## Readiness

- **Verdict:** ready. The plan was approved on 2026-10-05. C0, C1 and C2 can start. C3 waits on the owner's review of C0. C5 waits on C4.
- **Must not start:** anything that touches the live database's existing projects, or GitHub, before C4.

## Owner review (2026-10-05)

Owner: "like the onboarding suggestion. agree we can't assume what the app looks like. built in aludel project exists: thats trying to implement exactly what we have here. probably fine to get rid of that, right, and just let us use this new method? other suggestions fine."

- **Plan approved.** That includes C0 to C4, with the prototype going to the owner before C3.
- **Q-A:** the `.aludel/` commit is pushed straight to `main` when the owner confirms.
- **Q-B:** the new project is called "Aludel".
- **Retiring `the-machine`: agreed, as C5.**
  - **Its data (checked 2026-10-05, read-only):**
    - copies of this repository's docs from the old document import: 227 documents, 377 revisions and 1,336 links;
    - 8 product records, 1 decision, 1 proposal and 2 plans, all seeded by code at 2026-09-22T19:30:39Z. Nothing in it was written by a person.
  - **What it also does:** membership in it marks the instance's admin (`server.mjs:1621`, `aludelMember`). C5 replaces that before anything is deleted.
  - **What it supersedes:** LAY-06 ("Aludel's own knowledge into its layers; retire the hash workspace") is replaced by connecting Aludel like any other project.

## C0 round note: prototype v1 (2026-10-05)

- **Changed:**
  - **The prototype:** [v1/index.html](v1/index.html), a clickable static prototype of the connect path: start choice → working style (unchanged) → account (GitHub) → repository → where the code is → layers → connect → connected.
  - **Real data:** the code step uses this repository's real facts: `main` at `095f01a`, 1,391 files, `apps/portal` suggested with 263 files read, and the two prototype folders. The connect step lists the real 17 files. Other repositories and the alternate cases are stand-ins.
  - **References:** [refs/](refs/) holds Netlify's "Do you have code to deploy?", Vercel's Root Directory dialog, Railway's and Render's root directory, and today's onboarding, captured on a disposable portal (`capture-current.mjs`).
- **Checked:**
  - [v1/check.mjs](v1/check.mjs) walks the whole path and every code-step case at 1440 and 390 px: 28 screens, axe clean, with no sideways scroll ([v1/check-results.txt](v1/check-results.txt), screens in `v1/shots/`).
  - The first run caught the review panel covering the page's own buttons, so it became a strip above the header.
  - **Not fixed:** headings render at regular weight, because the prototype's bundled font doesn't seem to carry bold.
- **Waits on the owner:** flag anything and say what you want instead. C3 builds from the accepted version. C1 and C2 don't depend on this review.

**Owner review of v1 (2026-10-05):** "this flow looks fine, you can build c1,2,3". v1 is accepted as the composition for C3. The build reuses today's onboarding components and styles, not the prototype's CSS.

## C1–C3 build (2026-10-05)

**Authorization.** The owner said "this flow looks fine, you can build c1,2,3". Local code and checks only: no live GitHub calls, and no changes to live projects.

**C1: a fake GitHub that browser journeys can use.**
- `github-vendor-config.mjs` reads `MACHINE_GITHUB_API_URL` and `MACHINE_GITHUB_WEB_URL`. They default to github.com, take https (a GitHub Enterprise Server) or plain http on loopback only, and are reported as a configuration issue otherwise.
- The integration and the App-token minter use them.
- `tests/fake-github.mjs` answers in one process:
  - OAuth: approves at once;
  - App installation;
  - `/user`, `/user/installations`;
  - installation tokens (only those it minted work for git);
  - `/installation/repositories`, `/repos/:o/:n`;
  - git smart-HTTP.

  It logs requests without credentials.

**C2: where the code is, and installing with it.**
- `server/code-detect.mjs`:
  - the root and every folder with an app manifest (Node, Python, Go, Rust, Ruby, PHP, Java, Deno) are candidates, skipping vendored folders;
  - each candidate's globs are its conventional source folders, or all of it;
  - what Code would read is counted against its 2,000-file limit;
  - the suggestion is the folder with a manifest that Code reads most of, otherwise the root;
  - a repository with `.aludel/` says where its code is itself;
  - Code reads TypeScript and JavaScript, and the check says so when nothing matches.
- `installLayerPackageInto(…, { units })` writes the chosen paths into the fork's `.aludel/layer.json` `files.units`, validated by `unitGlobs`: inside the repository, never `.git`, `.aludel` or `.env`, at most 20.
- **Size, measured on this repository:** `apps/portal` is 241 files and 2,507 units, about 985 KB. That exceeded both the layer sandbox's 1 MB input and output limits and the 2,000-entry cap.
  - **Decision:** indexing gets its own bounded limits (`indexLimits`: 16 MB, 20 s, 256 MB heap), and entries are capped at 20,000. API handlers keep 1 MB and 3 s. Paging the indexer would have changed every template's contract for no gain at this size.
  - Aludel's repository then indexes in about 50 ms, producing 1.2 MB.

**C3: the connect path.**
- **The start choice.** New project asks "Do you have code already?" at `/new`; the landing page, "New project" and sign-in now lead there. "Start a new app" continues to `/start`, unchanged.
- **The connect path** is `src/connect.ts`, at `/connect/style|account|repository|code|layers|finish`.
  - Its choices live on the draft (`start` and `connect_json` columns), which survives the GitHub sign-in round trip.
  - The project is created only at Connect (`createConnected`): no pitch, no scaffold, Code always on.
- **The routes** are `/api/onboarding/connect/{repositories,check,count}` and `POST /api/onboarding/connect`.
- **Connect re-clones** and refuses if `main` moved since the check, so what was shown is what's committed. It installs `.aludel/` as one commit with the chosen paths and pushes.
- **No starter docs.** Code's seed would have written `ARCHITECTURE.md` and `docs/…`, and appended to the repository's own `AGENTS.md`. That contradicts "nothing assumed", so a connected repository is marked as seeded and never seeded.
- **The old route is gone.** The import step inside new-app onboarding and its `POST …/repository/import` route are removed. The GitHub step points to connecting instead.

**Checked:**
- **`tests/connect-browser.mjs` (new), at 1440 and 390 px with axe on every screen:**
  - start choice, then working style;
  - GitHub sign-in on the fake, then the repository list;
  - a `master` repository refused;
  - a monorepo's `apps/web` suggested, paths edited and recounted;
  - layers, then connect;
  - exactly one commit on the fake GitHub, only `.aludel/`, with the chosen paths;
  - their `AGENTS.md` untouched, and no starter docs;
  - Code's Library entries from `apps/web` only;
  - a goal item's branch pushed to GitHub from another clone, closed out with an installation-token fetch, fast-forwarded and pushed. That's COLLAB-WORK-01 CW-1 against a GitHub remote for the first time.
- **`tests/connect.test.mjs` (new):** detection (monorepo, single app, other languages, existing `.aludel/`); path validation; GitHub addresses; the draft-to-project rules; indexing limits, including a still-bounded case.
- **`code-github.test.mjs`:** moved to check → connect. It includes the "main moved since the check" refusal with no project made, and no docs.
- **Other browser journeys:** `agent-work`, `github`, `product`, `design`, `brand`, `workflow`, `layer-bar` and `vision-layer` pass. `browser` fails at its stale-decision step, which status records as intermittent and failing at J4's head too.
- **Typecheck and build pass.**
- **The gate:** `npm run test:server:templates` gave 347 pass, 0 fail, 7 skipped (354 tests, 476 s). `security-audit-worker` passed this time.
- **Fixed after the gate:** the Connect summary's class collided with an existing `.pub-summary` and overlapped the name hint at 390 px. It was renamed `.pub-connect-summary`, then rebuilt, and the connect journey passed again.

**Not checked:** a live GitHub run. That's C4, by the owner in the browser.


## C4: the owner connected Aludel (2026-10-05)

**What the owner did.** Restarted the portal on `claude/agent-work-prototype-7en0jx` and connected `aludel-workshop/aludel-workshop` from the browser, as project **Aludel Workshop** (`p-e1bb437efa`). The owner named it; "Aludel" in the plan was only a suggestion.

**Checked by the agent, read-only, afterwards:**
- **GitHub:** `main` is `a98c5c9` "Add the Code layer in .aludel/ from the code template", one commit on top of `095f01a`, with only `.aludel/` (17 files). `files.units` is `apps/portal/src/**`, `apps/portal/server/**` and `apps/portal/tests/**`, which is what detection suggested for `apps/portal`.
- **Portal:** the binding is `ready` on `main` through the org installation. Code's pin is `a98c5c9`, and its remote is `in-sync`, fetched and pushed. Code indexed 2,507 units, matching the C2 measurement. The repository's own `AGENTS.md` is untouched, with no starter docs.
- **Expected side effect:** neighbor discovery staged six "Explore … for <layer>" audit items, as it does for every new project.
- **Two small things to tidy, not blocking:**
  - The binding still records `095f01a`, the commit before connecting, and the GitHub panel shows that commit under "Initial commit pushed".
  - The workspace's `origin/main` tracking ref is stale. Sync pushes by URL; nothing reads those refs.

**Found while preparing the dogfood: close-out pushed onto a stale `main`.**
- **The problem.** Close-out merged into the server's own `main` and pushed it, without taking GitHub's `main` first. Once `main` moves on GitHub, for example when a pull request is merged there (PR #4 is next), the merge was built on the old `main`. The push was then refused, leaving the server's `main` diverged from GitHub.
- **The fix.** The close route now settles `main` with Code's sync before merging: it fetches, fast-forwards, and holds anything diverged or authority-changing. If sync can't settle, close-out waits with the reason. After merging, sync adopts and pushes the result. Projects without Code keep the direct push.
- **Checked.** The connect journey now moves `main` on the fake GitHub between review and close-out. It asserts that GitHub's `main` is a merge of the reviewed commit onto what GitHub had. With the fix disabled, the same step fails, with only GitHub's commit on `main`.

**Process note.** Checking the live result against the plan's next step, not only against C4's own exit, found the stale-`main` gap before the dogfood hit it. C4's own checks all passed and would not have shown it. This is the existing rule to check prerequisites' contents, not only their existence (AGENTS.md), applied to the dogfood's prerequisites. No new procedure is needed.

**Gate after the fix:** `npm run test:server:templates` gave 346 pass, 1 fail, 7 skipped. The failure was real: `tools/test-affected.mjs` has a shebang but wasn't committed executable. The shebang check only sees tracked files, so it surfaced once the file was staged. The file was made executable and the check re-run, which passed. The gate's other 346 tests were unchanged.
