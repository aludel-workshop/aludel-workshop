# COLLAB-WORK-01: a collaborator works a task from her own machine

- **ID / date / author:** COLLAB-WORK-01, revision 1, 2026-10-05, Claude Code (owner chat).
- **Outcome:** the owner adds a person to a project and gives her the Code role. She opens the project's repository on her own machine in a container identical to the cloud agent's, claims a task, works it with her own Claude Code and the Aludel tools, and pushes. The owner reviews and closes out in Aludel, which is running on the owner's server. Working without Aludel's tools (clone, edit, push) still reaches review.
- **Built on:** `claude/agent-work-prototype-7en0jx` at `f0bf041` (AGENT-WORK-01 A1, A3, A8 and A4), the newest handoff branch on 2026-10-05.

## Authorization and scope

Owner, in chat on 2026-10-05:

- On the direction: "alright, lets think this through. i add a colaborator to a project. she wants to grab a task, work it through on her dev machine with claude. … i think some kind of containerization makes sense, right, so you can just get up and rolling fast with the same resources and environment cloud agents have. … whats our best way to set this up going forwards?"
- On the answers: "reaching aludel: i do want to run this on a server. i have one we can use. just need it set up for deploy. aludel adds collaborator to repo, when the user is given code role privileges. write it up."

**Authorized by those answers:**
- this brief;
- the decision record (DEC-065);
- local design, repository edits and checks for CW-1 to CW-4 under DEC-029, once the owner approves this plan.

**Not authorized yet:**
- connecting to the owner's server, installing software on it, or exposing anything to the internet;
- DNS changes, TLS certificates, or changing the GitHub App's URLs;
- adding or removing real GitHub collaborators;
- spending money.

CW-5 and CW-6 each need the owner's go, with the server details listed below. Each go is limited to the effects it names.

## What the AGENT-WORK-01 A8 build assumed

A8 and A4 were designed and checked with one person on the machine that runs the portal. These assumptions don't hold for a second person on a second machine:

| Assumption (checked 2026-10-05) | Where | What breaks |
|---|---|---|
| Close-out fetches the branch from an absolute folder path on the portal's machine. | [agent-work.mjs:388-389](../../../apps/portal/server/agent-work.mjs#L388-L389); `report_code` stores `checkout` ([agent-work.mjs:482](../../../apps/portal/server/agent-work.mjs#L482)) | The server can't read her disk, so close-out always fails with a 409. |
| The CLI runs from Aludel's source: `node <path to aludel-workshop>/apps/portal/tools/aludel.mjs`. | [local-work.md](../agent-work/local-work.md) step 1 | She'd need Aludel's own source repository. |
| The portal is at `http://127.0.0.1:4310`. | local-work.md step 1 | Her machine can't reach it. |
| Only the owner exists. Members can be read, but nothing adds one. | `project_members` rows are only written as `'owner'` ([accounts.mjs:35](../../../apps/portal/server/accounts.mjs#L35), [onboarding.mjs:240](../../../apps/portal/server/onboarding.mjs#L240)). `setLayerActionGrant` requires an existing member ([lat08-migration.mjs:193](../../../apps/portal/server/lat08-migration.mjs#L193)). | She can't be invited or added to a project. |

These parts already hold up and are kept:
- per-person editor tokens scoped to project membership (PP-01R);
- layer APIs as the only path for record writes;
- staged changesets;
- review and close-out as the owner's own actions;
- the GitHub App's installation check, which already requires `administration: write` and `contents: write` ([github-integration.mjs:30-31](../../../apps/portal/server/github-integration.mjs#L30-L31)). We infer that `administration: write` covers GitHub's collaborator endpoints, but the fetched docs page didn't state the app permission. CW-2 confirms it against the live API.
- per-user GitHub logins (`github_users`);
- layer grants by person (`layer_action_grants`). Code's layer key is `platform`.

## Design

### 1. The project's GitHub repository is the handoff point

Work comes back through the project's Git remote, never through a folder path. This applies to local work too, so there is one path:
- The agent's `report_code` and `aludel submit` push the item's branch to `origin` first. They then report the branch, the commit and the changed files. They stop reporting the checkout path.
- Close-out fetches `refs/heads/<item branch>` from the project's GitHub repository with an installation token. It checks the fetched commit against the reported commit and merges into `main` as A4 does today: a fast-forward, or a merge commit if `main` moved. It refuses if a record changed since staging, and sends a conflict back to the agent to rebase. Then it pushes `main`.
- If the reported commit is missing or the remote branch has moved, close-out fails with a clear message: "push W-n's branch again".
- A project without a GitHub repository can't run collaborator work. DEC-061 and PP-01B already make GitHub a prerequisite for creating an app.

### 2. Collaborators: the Code role adds her to the repository (DEC-065)

- **Members.** The owner invites a person by email. She signs in and connects GitHub. Her login is stored in `github_users`, and she becomes a `member`. This is the missing piece today.
- **Code role means repository access.** When she holds any enabled grant on the Code layer, normal or elevated, Aludel adds her GitHub login as a collaborator on the project's Code repository. The call is `PUT /repos/{owner}/{repo}/collaborators/{login}` with `push` permission. When her last Code grant is removed, or she leaves the project, Aludel removes her. The other layer repositories are not shared: their changes go through each layer's API.
- **Invitation state.** GitHub sends an invitation that she has to accept. Team shows Not on GitHub, Invited, Has access or Failed, with the provider evidence. Q-008 applies when the outcome is unclear: Aludel retries only when the owner asks, and never because time has passed.
- **One direction, Aludel as the authority.** Aludel only removes collaborators it added itself, and stores the provenance of each one. A collaborator the owner added on GitHub directly is shown, but never changed.
- **Merging stays in Aludel.** Push access lets her push branches, but `main` should only change through close-out. Protecting `main` on GitHub is a separate write to GitHub, listed as Q-2.
- **Personal and organization repositories.** GitHub's REST docs (accessed 2026-10-05, [Add a repository collaborator](https://docs.github.com/en/rest/collaborators/collaborators#add-a-repository-collaborator)) say:
  - the permission parameter is "Only valid on organization-owned repositories";
  - the invitee "must accept or decline";
  - Enterprise Managed Users are added without an invitation.

  On a personal account's repository, the collaborator therefore gets that account type's fixed collaborator access. On an organization repository, `push` applies as requested. The personal-account path is still unproven (status, blockers).

### 3. One environment definition for people and cloud agents

- **The image.** The scaffold's `Dockerfile` gets a `dev` stage built on the same base as the app. It adds git, Node, Claude Code and the Aludel CLI. AGENT-WORK-01 A2 runs the orchestrator from the same stage, inside the per-project sandbox.
- **The dev container.** The scaffold generates `.devcontainer/devcontainer.json` pointing at that stage. It forwards the app's port, runs `npm install` after the container is created, and mounts her `~/.config/aludel` and her Claude Code login from her machine, read-only. Tokens are never baked into the image or committed.
- **Parity is checked, not assumed.** The agent runner and the dev container record the image digest they started from, and the item page shows both. A test builds both from the same commit and compares the digests.
- **Existing projects** get the new files through J8's template updates, as a reviewed change.
- **Using the container is recommended, not required.** Cloud agents always use it. A person can work directly on her own machine.

### 4. One command to start

The CLI ships in the dev image, and the instance also serves it at `/cli/aludel.mjs`, for work outside the container. It no longer depends on aludel-workshop.

`aludel work W-12`:
1. pairs with the instance if needed (the URL comes from `.aludel/` in the repository);
2. claims the item;
3. fetches `origin` and creates the item's branch from `origin/main`;
4. writes `.mcp.json`, excluded from commits as today;
5. prints the task bundle and the next step.

After that, the flow is local-work.md steps 4 to 9, with "push" in place of "fetch from the checkout".

### 5. Working without Aludel's tools

She clones, edits and pushes a branch. "Check my branch" (J7), or linking the branch to an item, brings it into the same review. She gets no thread and no staged record changes. That's fine for code-only work.

### 6. Aludel on the owner's server

The deployment is shaped like the local setup (PLATFORM-PIPELINE-01 P8):
- the portal and previews run in containers, behind a reverse proxy with TLS;
- each project environment is a subdomain;
- secrets come from the server's secret store instead of `.env` (§10's split);
- the SQLite database is backed up on a schedule, with a restore that has been rehearsed;
- the GitHub App's callback and webhook URLs point at the server's domain.

Exposing agent-written previews to the internet depends on PP-01E's guards and the open questions Q-005 and Q-008. The first deployment can serve the portal publicly while keeping previews private: available only to signed-in members, or reachable only over a private network. The owner chooses (Q-1).

**Server details needed from the owner** (they block CW-5):
- provider, OS, and CPU, memory and disk;
- how the agent reaches the server: an SSH key the owner sets up for this, or the owner runs a prepared script (as with live agent hosts);
- the domain, and whether wildcard DNS is available for preview subdomains;
- whether Docker is already installed;
- whether anything else runs on the server.

## Work sequence

| Packet | Depends on | Work and output | Agent check | Who reviews and authorizes | Stop if |
|---|---|---|---|---|---|
| CW-1 Remote handoff | A4 | `report_code` and `submit` push to `origin`. Close-out fetches from GitHub. The checkout path is removed. local-work.md is updated. | A fake-GitHub test of close-out with no checkout on disk. Negative tests for a moved branch, a missing commit and a conflict. Both server suites. | Owner review of the diff and the journey | The fake-GitHub harness can't serve `git fetch` |
| CW-2 Members and Code-role sync | CW-1 | Invite, accept, connect GitHub. Code grant ↔ GitHub collaborator, with provenance and invitation state in Team. | Fake GitHub: grant adds, revoke removes, a collaborator added by hand is left alone, provider failure shows Failed. A second-user journey. | Owner in the browser. A live GitHub add is a CW-6 effect. | GitHub's collaborator API needs a permission the app doesn't have |
| CW-3 Dev container | A2's runner image (or defines it) | `dev` stage and `.devcontainer/` in the scaffold. Template update for existing apps. Digests recorded. | `devcontainer up` (CLI) on a scaffolded app. The digest comparison test. Claude Code and the Aludel CLI start inside. | Owner opens it in VS Code | Mounting the Claude Code login doesn't work in a container (then she signs in inside) |
| CW-4 One command | CW-1, CW-3 | `aludel work`. The instance serves the CLI. Instance URL in `.aludel/`. | From a fresh clone with no aludel-workshop: from `work` to a reported push, against a disposable portal. | Owner | — |
| CW-5 Aludel on the server | **Replaced by [DEPLOY-HOST-01](../deploy-hosting/work-record.md) DH-1 to DH-6** (owner, 2026-10-05: build the Deploy layer's tooling, not a one-off setup) | — | — | — | — |
| CW-6 Live trial | CW-2, CW-4, DEPLOY-HOST-01 DH-6 | The owner invites the collaborator, who works a real task on her machine. The owner closes out. | The run log and retrospective | **Owner go**, for the live GitHub collaborator add and the push | — |

CW-1 to CW-4 are local and can run while the server details are collected. CW-5 can run in parallel with CW-2 to CW-4 once the owner says go.

## Readiness

- **Verdict:** ready. The owner approved the plan on 2026-10-05. CW-1 is the next action.
- **Ordering against AGENT-WORK-01:** we recommend building CW-1 before the AGENT-WORK-01 dogfood. It is small, and it means the dogfood exercises the remote handoff that will last, instead of the folder fetch it replaces. The alternative is to dogfood A8 as built and then change it. That's the owner's choice.
- **Must not start yet:** CW-5 and CW-6, or any real GitHub collaborator change.

## Questions

- **Q-1 Preview exposure on the server:** previews private to signed-in members (recommended until PP-01E), or reachable only over a private network such as Tailscale? Blocks CW-5's proxy configuration.
- **Q-2 Protect `main`:** should Aludel enable branch protection on the Code repository so that only close-out changes `main`? This is a GitHub write per repository. Blocks nothing, but without it a collaborator can push to `main` directly.
- **Q-3 Server details:** see §6. Blocks CW-5.

## Owner review (2026-10-05)

Owner: "plan looks good. for server i have a digital ocean droplet. … other recs look good."

- **Plan approved.** CW-1 is built before the AGENT-WORK-01 dogfood.
- **Q-1:** previews on the server are visible to signed-in members only.
- **Q-2:** Aludel protects `main` on the Code repository so that only close-out changes it. Each protection is a GitHub write that happens with CW-2's collaborator sync. The first live one happens under CW-6's go.
- **Q-3:** replaced by DEPLOY-HOST-01's Q-4 and Q-5.

## CW-1 build: work comes back through the GitHub remote (2026-10-05)

**Authorization.** The owner, in chat: "start work". That covers CW-1 under the plan approved the same day. Local edits and checks only: no GitHub writes and no external effects.

**Changed:**
- `tools/aludel-client.mjs` `pushReport`:
  - refuses uncommitted changes and refuses `main`/`master`;
  - pushes `HEAD` to `origin/<branch>` with the person's own git credentials, using `--force-with-lease` because a rebase rewrites the item's branch;
  - returns branch, commit, base and files, and no longer a folder path.
  `aludel submit` and the agent's `report_code` both use it. The MCP instructions now say to rebase onto `origin/main`.
- `server/agent-work.mjs`:
  - `recordCode` no longer stores `checkout`. Older clients that still send it are ignored.
  - New `fetchCode(projectId, workId, remote)` fetches `+refs/heads/<branch>` into `refs/aludel/work/<id>`. It uses the installation token through `gitWithToken`, as T03-CODE's sync does. It refuses if the branch's tip on GitHub isn't the reported commit, so what merges is what was reviewed.
  - Without a GitHub repository, the commit must already be in the project repository.
  - `planMerge` no longer reads anything from a person's disk.
- `server/server.mjs` close route: mints one installation token, fetches, closes out, then pushes `main` as before.
- [local-work.md](../agent-work/local-work.md) steps 6, 7 and 9.

**Checked (agent):**
- **A4 rewritten as a second machine:** a bare stand-in for GitHub, Aludel's copy, and a checkout in another folder.
  - Close-out without a fetch refuses, rather than reaching into the checkout. No GitHub repository and the commit not present also refuses.
  - A conflict goes back to the agent, who rebases onto GitHub's main and pushes and reports again.
  - A branch moved on GitHub after it was reported is refused, then accepted after it's reported again.
  - The checkout folder is deleted before the final close-out, which still merges the reviewed commit and not the late one.
  - **Mutation:** with the moved-branch check disabled, the test fails.
- **A8 CLI test:** `submit` pushes to the checkout's origin and the branch is there. A dirty `report_code` is refused.
- **Browser journey:** `tests/agent-work-browser.mjs` passes, with the journey's portal standing in for GitHub by having the commit present (stated in the test). Playwright 1.61.1 with the local `chromium_headless_shell-1228` (`CHROMIUM_PATH`).
- **Suites:**
  - `npm run test:server`: 312 pass, 0 fail, 37 skipped. This run started before the close route's token reuse (it mints one token instead of two), which no server test exercises.
  - `npm run test:server:templates`: 341 pass, 1 fail, 7 skipped, in 505 s.
  - **The failure:** `security-audit-worker.test.mjs` "portal restarted after report submission". It failed again in the 10-file affected run and passes alone (10 s). AGENT-WORK-01's A3 record shows the same assertion failing only under full-suite load. The test doesn't use the goal close route. **Inferred** to be a timing flake that predates this change. It wasn't rerun on the base commit.

**Not checked:** a live GitHub round trip with a real installation token. That happens with CW-6's go.

### Testing change made during CW-1 (owner: "do it", 2026-10-05)

**Asked.** The owner found the test suites a major drag and asked to usually run a smaller subset.

**Measured:**
- `test:server` took 315 s on 8 cores, set by its slowest files: 31 s, 23 s and 22 s for building layer views, worker tokens and sandboxed runs.
- AGENTS.md required running all 70 files twice. The templates-on run covers the template tests too (341 vs 312 here), and the launcher runs with templates on.

**Changed:**
- **The script.** `npm run test:affected` (`apps/portal/tools/test-affected.mjs`) runs only the test files that reach a changed file, with templates on. `--list` shows the chain that selected each file, and `--files a,b` previews a change.
  - **How a file gets selected:**
    - modules count imports and `new URL(…, import.meta.url)`;
    - tests also count path literals, because a test that starts `server/server.mjs` depends on everything it imports;
    - a path a module only names as data doesn't count. Counting those first selected 52 of 70 files, because `code-units.mjs` names `server/server.mjs` as data.
  - Changes outside `apps/portal` are flagged as untraced.
- **AGENTS.md** now says to test in two tiers: `test:affected` while developing, and `test:server:templates` as the full gate before a commit or handoff. `test:server` with templates off is only needed when a change touches that switch.

**Observed selections:**
- 3 of 70 files for `tools/aludel-client.mjs`;
- 10 for `server/agent-work.mjs` or CW-1's whole change;
- 27 for `config/roles.json`;
- 47 for `server/layer-contract.mjs`.

CW-1's affected run took 6 m 21 s with real time. That's no faster, because it touched `server.mjs` and so selects the slowest file, `symphony-proposals`.

**Tried and dropped.** A `--quick` mode that didn't follow a started portal into its imports saved only 0 to 2 files, because those tests import the same modules directly.

**Still a hypothesis.** We expect the inner loop to be faster for most edits, and the gate is now one full run instead of two (about 505 s instead of 315 s + 505 s here). The next real tasks will show it. If server-heavy edits stay slow, the next step is speeding up the five slowest tests (about 110 s), not narrowing selection further.

## Process change applied

**What happened.** A8 passed its checks on one machine, but those checks could not catch an assumption that only fails with a second machine: close-out reads the person's checkout path.

**What changed.** The implementation-readiness requirements in [the operating procedure](../process/operating-procedure.md#5-decide-readiness-at-the-boundary) now cover work, identity and repository features. A feature must name each actor and the machine it acts from. It must also include one check run as a second member, on a machine without access to the portal's filesystem or database.

**Status: still a hypothesis.** The test is whether CW-1's and CW-2's checks catch a same-machine assumption before the owner trial does. We'll record the result in CW-6's retrospective.

## Item containers: Go opens the item in a dev container (2026-10-05)

**Authorization.** The owner said: "you click go, and it actually creates a new little container locally for you, with the exact setup that the remote agent gets, except here the agent acting in that environment is your local model … so it would open a new vscode window into that configured container". The proposal was approved with "yep, commit and push, then build from it". It covers a local spike and build of CW-3 and a container version of CW-4, on `claude/item-containers` (from `claude/assignee-open-vscode` @ `45f0dec`), with the owner's local Docker Desktop used for checks.

**Not authorized:**
- GitHub writes by the agent: Go's branch is created by the portal, only when the owner clicks it;
- pushes to `main`;
- spending;
- the remote runtime (A2).

### Spike (agent-checked, 2026-10-05)

- **Docker.** Docker Desktop with WSL integration (`docker info`: "Docker Desktop"). Windows VS Code's Dev Containers and this WSL shell use the same engine and volumes.
- **The link.** Dev Containers 0.469.0 (installed) handles `vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=…&volume=…`. Its parser takes everything after `/tree/` as the ref, so `https://github.com/<o>/<r>/tree/aludel/w-8` opens that branch. It clones into a Docker volume with the person's git credentials, builds the repository's `.devcontainer/`, and opens a window inside the container. This is read from the extension's code; the full open is still to be seen on the owner's machine.
- **The portal from a container.** `host.docker.internal:4310` reaches the portal running in WSL, which answered 421 (unknown host). Node's `fetch` ignores a Host override, so the portal now accepts that host on `/api/editor/*` only, which is token-authenticated. Preview containers, which run agent-written app code, still get nothing else.
- **Per-item clones.** Each container is a fresh clone, so the Aludel MCP is registered at Claude Code's user scope, in a shared volume, not in the clone's `.mcp.json`. Another project's repository doesn't contain Aludel's tools, so the container fetches them from the portal.

### Owner, on pairing (2026-10-05)

"if we have this custom little container created for the task, why do we need the pairing at all? like, say new collaborator, hasnt done any local setup, just wants to click get started from the task and drop into a session in a local container." The agent proposed connecting each container the way `gh auth login` works; the owner replied "yep, sounds great. do it that way."

### Build (2026-10-05)

- **Go** is Open in a container on the item page, for an item assigned to you that is in Draft, Ready or In progress. `POST …/goals/:id/container`:
  - settles `main` with GitHub through Code's sync;
  - creates `aludel/w-n` on GitHub from `main`, with an installation token, unless it already exists;
  - logs it in the thread;
  - returns `vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=<repo>/tree/aludel/w-n&volume=aludel-<project>-w-n`.

  The page opens that link. Your own checkout stays a secondary link.
- **Aludel's dev container** (`.devcontainer/`) is the one environment definition.
  - **Image:** `node:24-bookworm`, git, Claude Code, and Playwright 1.61.1 with Chromium for the journeys. Nothing secret is in the image.
  - **Shared volume:** one, `aludel-claude`, for Claude Code's login. You sign in once, for all containers.
  - **Setup** (`aludel-setup.sh`, run after the container is created):
    - fetches the Aludel tools from the portal (`GET /api/editor/tools/*.mjs`, which needs no token because it's code);
    - registers the Aludel MCP at Claude Code's user scope;
    - runs `npm ci`;
    - runs `aludel connect`.
- **No pairing.** `aludel connect` sends the clone's origin and branch (`POST /api/editor/connect`, no token), and the portal finds the open item they belong to.
  - It returns a device code, which the container keeps, and a short code that it prints.
  - The item page checks every 3 s while the item is yours, and shows "A container is asking to connect … Its terminal shows XXXX-XXXX" with Connect.
  - Connect (assignee only) lets the container collect a token, once, for that item only (`editor_tokens.work_id`). The token stops working when the item closes.
  - Requests expire after 10 minutes, at most 5 per item, and are stored on the platform database (`editor_connect_requests`).
- **Inside a container,** `start_work` without arguments finds the item from the branch. `pair` and the MCP don't write `.mcp.json` or report a folder.
- **Reaching the portal:** it answers `host.docker.internal` on `/api/editor/*` only.

**Checked:**
- **Spike, on the owner's Docker Desktop, against a throwaway portal on :4399:**
  - the real image runs `aludel-setup.sh`, which prints "press Connect beside GJEP-6S86";
  - the portal lists the request, and Connect returns "Connected to W-1";
  - `claude mcp list` shows aludel "✔ Connected";
  - `start_work` with no arguments returns W-1 on `aludel/w-1`;
  - the token file is mode 600, and there's no `.mcp.json` in the clone.

  The spike's portal, container, volumes and clone were removed afterwards.
- **`tests/connect-browser.mjs` (fake GitHub):**
  - the container route creates the branch on GitHub at `main`, returns the exact link, and keeps an existing branch;
  - a clone of that branch runs `aludel connect`, and the item page shows its code (axe);
  - Connect lets it finish;
  - its token lists and reads only its own item, and gets 404 on the earlier one;
  - `host.docker.internal` gets 200 on the editor API and 421 elsewhere, and the tools are served.
- **`tests/agent-work-browser.mjs`:** the container button explains the refusal on a project without GitHub, and Team shows the connection.
- **`test:affected`:** 266 tests, 261 pass, 1 fail, 4 skipped. The failure was security-audit's "portal restarted after report submission", which passes alone. It has failed under load in every larger run on 2026-10-05, so it's a recurring flake worth fixing, not noise. Typecheck and build pass.
- **Bugs found by the checks:**
  - the request table wasn't on the platform list, so requests landed in the wrong database;
  - the goal route refused `GET connections`;
  - `aludel` wasn't on the PATH in a new container, because `.bashrc` isn't shared (it now comes from the image).

**Not checked, and to do on the owner's machine:**
- the Dev Containers link opening a real VS Code window;
- the first image build there;
- the setup output and code showing in VS Code;
- the Claude Code sign-in inside a container.

**Not built:**
- a dev container for other projects (CW-3's scaffold and template update);
- recording the image digest for parity (A2 doesn't exist yet);
- removing an item's container and volume after close-out;
- the portal address for a server-hosted instance (it's fixed to `host.docker.internal:4310` in `devcontainer.json`; CW-4 moves it to `.aludel/`);
- Docker inside the container, so preview tests that need Docker skip there.

**The owner's first try failed (2026-10-05).** VS Code reported `git ls-remote https://github.com/aludel-workshop/aludel-workshop/tree/aludel/w-8` → "repository … not found". The extension's link handler checks `url` with `git ls-remote` as given, and only parses `/tree/<ref>` afterwards. The spike had read the parser, not the access check, so it missed this.

**The fix:**
- The link is now the plain clone URL, so the clone starts on `main`.
- The container asks to connect without an item (`work_id ''`), and its request shows on the project's item pages assigned to you. Pressing Connect on W-n's page makes it W-n's.
- `aludel connect` then switches to `aludel/w-n`, taking the branch from GitHub, before `npm ci`.
- Go also moves an item branch up to `main` when it has no work of its own. W-8's branch was made from a `main` without `.devcontainer/`.

**Checked:** the connect journey asserts the plain link; that a moved `main` brings the item branch along (`caughtUp`); and that a `main` clone says "Connect this container to its item", then is on `aludel/w-n` at `main` after Connect from that item. `agent-work` and `editor-bridge` tests, and the agent-work journey, pass.

**Process note.** "Read from the extension's code" was recorded as evidence for the whole link, but it covered one function. Evidence about a third-party handler should name the path it actually follows, or be marked as untested until the real click.

**Second try (2026-10-05).** VS Code offered its template picker, because the clone of `main` had no `.devcontainer/` (nothing merged yet). Go now refuses up front when `main` has no `.devcontainer/devcontainer.json`, which the connect journey checks. The owner asked to merge to `main`.

**Third try (2026-10-05): the same picker after the merge.** The cause was the volume. Go had named it `aludel-<project>-w-8`, and Dev Containers reuses a volume that exists instead of cloning again. The first try had cloned the old `main` into it (checked: `/aludel-workshop` at `9ef1e2e`, no `.devcontainer/`).
- **Fix:** the volume is named for the commit the item's branch starts from (`aludel-<project>-w-n-<commit>`). A branch that moves up to `main` gets a fresh clone; a branch with work keeps its start, so reopening reuses its container.
- **Checked by the connect journey:** a new volume after the catch-up, and the same volume once the branch has work.
- **Left for the owner:** the stale volume `aludel-aludel-workshop-w-8`. Its open window's containers still use it, so it can be removed once that window is closed.

**For the owner to try it:** Go creates the item's branch from GitHub's `main`, so `.devcontainer/` has to be on `main` first. That means merging this branch, then restarting the portal on `main`.
