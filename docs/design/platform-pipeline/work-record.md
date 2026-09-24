---
id: platform-pipeline-01
kind: work-record
status: in-progress
updated: 2026-09-24
depends_on: [portal-layers-implementation-plan, knowledge-strategy, design-ux-01]
---

# PLATFORM-PIPELINE-01: projects owned by their owners, run the way Aludel runs

**Start here if you are a new session picking this up.** This is a brief: the owner's asks, verified facts about today's system, the decisions the asks force, and a plan for the first session. The owner answered §5 on 2026-09-24; see §5 for the answers and what they change.

## Authorization and scope

- **Owner instruction (chat, 2026-09-24):** "instead of having you do that this session, set up the brief, ill start a new session and we can hash out further there if needed." (DEC-029 interim chat authorization; DEC-046 set this as the next pass.)
- **Authorized now:** this brief, and the status and decision updates that point to it.
- **Not yet authorized:**
  - research beyond what's below, prototypes and code;
  - any GitHub write;
  - installing a container runtime;
  - DNS, TLS, servers, spending or external accounts.

- **Owner answers (chat, 2026-09-24, second session):** "lets defer this for now, unless we really need to plan it out first. might make sense to have a second repo?" (knowledge in git); "lets get started with docker for containers"; "yes, i think having a github account connected is a pre-req for creating an app."
- **Authorized by those answers:** local use of the existing Docker Desktop engine for research, prototypes and local previews, including building images and running containers for project previews on this machine. Research and repository edits within this packet follow DEC-029.
- **Owner instruction (chat, 2026-09-24, third turn):** "alright, no wiki. companion repo provisional idea. lets prove personals. go go go". Earlier the same day: "for projects without github (and even the ones without remote), get rid of them all … save a brief … add them to our test org rotation (except henrys gate)".
- **Authorized by that:**
  - one live proof of personal-account repository creation through the Aludel GitHub App: the owner authorizes in the browser, Aludel creates one private throwaway repository and pushes to it, then it's deleted;
  - deleting the six local test workspaces (and their portal records) after saving a name-and-description brief for each, except Henry's Gate;
  - the dive-in: research (§3), proposal, local Docker prototypes and repository edits for this packet.
- **Still not authorized:** any other GitHub write, DNS, TLS, servers, public hosting, spending or external accounts.

  The first brief said the next session would ask for these, following the UX-pass pattern (see the ux-pass method in memory, and DEC-044): an ask ledger, research with real reference screens, a prototype, then a build after acceptance.

## Owner brief ledger

The owner's words, condensed. Quotes are exact.

| # | Ask | Position |
|---|---|---|
| P1 | Created projects are managed **the same way Aludel is managed**. "both, exactly": generated apps and Aludel itself | Required |
| P2 | Priority: "getting each new project created and managed through its owners connected github" | Required, first |
| P3 | Git discipline (branches, commits per unit of work, reviews) matters, but after P2 | Required, second |
| P4 | Environments "as defined by the app itself". The app's repository declares how it runs, not Aludel | Required |
| P5 | **Full ownership**: "code, docs, everything exists in a way they could easily stop using aludel if their needs changed, and the app itself would keep running unaffected" | Principle; governs every other row |
| P6 | Aludel runs on a server. Until a user configures deployment to their own server, Aludel can **host the project as a subdomain** of the Aludel host | Required |
| P7 | Subdomain hosting needs "some kind of limits/guards to avoid abuse" | Required; design now, enforce before any public hosting |
| P8 | "each subdomain gets its own container, which is the same as it would be using if deployed by itself (maybe just some toggles set to subdomain mode)". The local setup should already work like this | Required |
| P9 | The server Aludel runs on has **its own Aludel project** (Aludel manages itself there too) | Required |
| P10 | So several Aludel instances on different servers can exist and must be **kept in sync**. "our repo keeps the code synced, but stuff like vision, design, how do we keep that synced?" | Open question; the central design problem |
| P11 | This came from the Design layer: icon and font libraries need per-project dependencies (ICONS-FONTS-01, blocked by this) | Context |

## 1. Verified state today (2026-09-24)

Checked in this session; re-check before relying on it.

- **Aludel's own repository:**
  - `origin` is `github.com/aludel-workshop/aludel-workshop`.
  - The owner committed DESIGN-UX-01 directly to `main` and pushed it (`36dcb0c first pass, design system`). `main` matches `origin/main`.
  - Aludel has no branch or pull-request routine yet.
- **Project workspaces** (`apps/portal/.data/workspaces/p-*`):
  - Six exist. Two are git repositories, each with two commits (`chore: start …`, `feat: generate … skeleton`).
  - None has a remote.
- **Dependencies:**
  - Generated apps have no dependencies of their own. `server/previews.mjs` symlinks `workspaces/node_modules` to the portal's `node_modules`, and builds each app with the portal's Vite.
  - The scaffold writes a `package.json` with pinned versions (`server/scaffold.mjs`, "trusted at versions it has been built with"), but nothing installs from it.
- **Container runtime (corrected 2026-09-24, second session):** Docker Desktop's WSL integration is already present and reachable: engine 29.2.1, cgroup v2, seccomp, Compose v5.1.0. The first brief's "no runtime installed" was wrong; nothing needs installing. Docker Desktop is free only for personal use and small businesses; a server would run Docker Engine, which is open source.
- **Previews** (DEC-033):
  - Each app runs as a child `node` process on a free loopback port, with a reduced environment (`PORT`, `HOST`, `DATA_DIR`). The portal reverse-proxies `<slug>.<base>` to it.
  - There are no containers and no resource limits. Previews don't survive a restart; they come back on demand.
- **GitHub** (DEC-030, [enterprise GitHub App record](../process/enterprise-github-app-work-record.md)):
  - One vendor-owned GitHub App, with short-lived installation tokens minted per operation.
  - One live test on an organization account worked end to end: authorization, installation on all repositories, private repository creation, and the first push.
  - Not yet proven: creating a repository on a personal account, refreshing or revoking tokens, and recovering from provider failures.
  - Onboarding creates the local repository first. Pushing to GitHub is a separate, optional step (`server.mjs` `section === 'repository'`).
- **Where knowledge lives today** ([knowledge strategy](../../knowledge-strategy.md)):
  - The portal database is authoritative for product records: vision, stories, specs, design tokens, components, brand, documents, work.
  - The repository is authoritative for code and code-adjacent contracts.
  - The Design layer already writes `design/tokens.json`, `design/components.json`, `src/brand.ts` and `aludel.json` into each app, but only as one-way output from a build.
  - **P5 and P10 conflict with this boundary.** If the owner's docs and design must survive leaving Aludel, and be synced between instances, the repository probably has to become authoritative (or at least a complete, re-importable copy) for more record kinds. That would revise the knowledge strategy and needs an owner decision.
- **Aludel's own project:**
  - `the-machine` still uses the older hash workspace.
  - LAY-06 (Aludel's own knowledge into its layers) hasn't started, so Aludel doesn't yet dogfood the layers P1 asks for.
- **The Platform layer UI** (LAY-07B): tabs for Overview, Architecture, Code, Repository, Releases, Environments, Database and Domains. Releases, environments and domains are mostly unavailable states locally.

## 2. What the asks force us to decide

These questions make up §5 for the owner. Each lists the options to research and a first lean. The leans are hypotheses, not decisions.

1. **Where product knowledge lives (P5, P10).** Options:
   - **(a) Records as files in the project's repository**: Markdown with front matter or JSON under `aludel/` or `docs/`. The database becomes an index that can be rebuilt from git. Sync between instances is git.
   - **(b) The database stays authoritative, with a full export or import** in both directions.
   - **(c) Instances sync with each other** directly: replication or CRDTs.
   - **(d) A companion knowledge repository per project** (the owner's suggestion, 2026-09-24), versioned on its own cadence and kept out of the app's history. **Provisional preferred option; still deferred** (§5). GitHub wikis were considered and rejected: private wikis need a paid plan, and they offer no review step (§6).

   Lean: (a) for anything a project owner would want to keep (vision, stories, design, documents, decisions). The database keeps operational state (sessions, runs, batches, locks) that another instance doesn't need. Research: docs-as-code tools, and how Backstage, Linear exports, Notion and Obsidian with git, and Decap/Tina CMS keep editable content in git. Also: merge conflicts on structured records, and revisions in git history versus the `knowledge_revisions` table.
2. **What "the app defines its environments" means (P4, P8).** Options:
   - a `Dockerfile` or `compose.yaml` in the app;
   - a devcontainer (`devcontainer.json`);
   - Cloud Native Buildpacks;
   - Nixpacks or Railpack;
   - a Procfile.

   Lean: the app owns a `Dockerfile` plus an environment manifest (for example `deploy/environments.*`) listing environments, variables (names only, never values) and services. Subdomain mode is a set of environment variables (base URL, data path, port). Research each option's current docs, how Railway, Render and Fly read environments from a repository, and what `aludel-web-v1` would have to generate.
3. **The container runtime on the Aludel host (P6–P8).** Options:
   - Docker or rootless Podman;
   - one container per project environment, with the portal as reverse proxy (as now) or a proxy such as Caddy or Traefik;
   - resource limits (CPU, memory, disk, processes; cgroups);
   - stopping idle apps;
   - network egress rules;
   - build isolation (builds run in containers too, which also closes B-03B's isolation gap for agent-written code).

   Local first: Docker Desktop is already available in WSL (see §1), and the owner chose Docker.
4. **Guards against abuse (P7).** Per-account quotas (projects, running environments, build minutes, storage, bandwidth), idle sleep, a kill switch, what may be exposed publicly, and a terms and verification step before public subdomains. Design it now, and gate it before any public hosting (Q-005/Q-008 are still open gates).
5. **The GitHub flow (P2).** Options:
   - create the repository on the owner's connected account or organization at project creation, rather than as a later optional step;
   - the default branch and protection;
   - the agent or Aludel's commit identity (the old `the-machine[bot]` attribution was flagged);
   - pull requests for agent work (LAY-05);
   - what happens when the owner disconnects.

   The personal-account path is unproven (see §1).
6. **Several Aludel instances (P9, P10).** An instance is a server running Aludel. Its own project is Aludel's repository, and it may manage other projects. Questions:
   - Which instance is authoritative for a project, if any?
   - Does each project's repository carry its knowledge (from decision 1), so any instance can adopt a project by cloning it?
   - How are two instances editing the same project reconciled: branches or pull requests on the knowledge files, or a lock?
   - What about secrets (never in git; each instance holds its own) and users?
7. **Git discipline for Aludel itself (P3).** A branch per packet, commits per step, pull requests with the evidence linked, and the attribution trailers LAY-07D already reads (`Aludel-Work:`, `Implements:`). Packets so far were committed straight to `main` in one large commit each.

## 3. Research plan for the next session

Use primary sources, record access dates, and take real reference screenshots (the ux-pass method). The first session should cover at least:
- **Platforms:**
  - Railway (services, environments, the config-as-code `railway.json`/`railway.toml`, PR environments);
  - Render (`render.yaml` Blueprints, preview environments);
  - Fly.io (`fly.toml`, Machines);
  - Vercel (previews, promotion).
- **Self-hosted platforms**, the closest match to "Aludel on a server hosting subdomains":
  - Coolify, Dokku, CapRover (how each builds from a repository, limits resources, maps subdomains and handles abuse);
  - Kamal (deploying the same app to your own server).
- **App-defined environments:** Dev Container spec, Docker Compose spec, Cloud Native Buildpacks, Railpack/Nixpacks.
- **Knowledge in git:** Backstage `catalog-info.yaml`, Decap or Tina CMS (git-backed editing), Obsidian or Logseq with git sync, and GitHub's own issues and projects export (for what users expect to keep).
- **GitHub:** repository creation for users versus organizations with a GitHub App, templates, branch protection and rulesets, and fine-grained installation permissions. Re-verify against current docs.

## 4. Suggested first step (next session)

1. Read this brief, [status](../../status.md), DEC-030/033/035/038/046, the [knowledge strategy](../../knowledge-strategy.md) and the [data and platform research](../portal-layers/data-platform-research.md).
2. Ask the owner the three §5 questions, briefly. If the conversation opens up, first ask what bothers them about Platform today (the ux-pass method).
3. Apply the purpose test (operating procedure §2) to Platform's current tabs and to any new records.
4. Research (§3), then write the proposal in this record: the ownership boundary, the repository layout for a project, the environment manifest, the runtime and guards, the GitHub flow, multi-instance sync, and dependency-ordered packets. Include ICONS-FONTS-01's need for per-project dependencies and LAY-05's need for isolated runs.
5. Prototype the owner-facing parts: creating a project on GitHub, the Environments view, subdomain mode, and the view of what the owner owns.

## 5. Owner answers (2026-09-24)

1. **Knowledge location: deferred.** Don't plan it unless this pass needs it. The owner's instinct: knowledge "evolves rapidly and organically, not following code dev cycles", and shouldn't bloat the app repository, so it might belong in **a second repository** per project. Record this as option (d) in decision 1. A GitHub wiki is a precedent: a separate git repository tied to the main one. Consequence: P10 (syncing vision and design between instances) waits on this. This pass must not make any of the options harder, and the Design files already written into the app stay as generated output.
2. **Container runtime: Docker.** Already installed (see §1).
3. **GitHub: required before creating an app.** Onboarding makes connecting GitHub a prerequisite, and the project's repository is created on the owner's account at creation. It is no longer an optional later step. Open: how existing local-only workspaces and the personal-account path (unproven) are handled.

### Original questions

1. **Where knowledge lives:** should vision, stories, design, documents and decisions live as files in each project's repository (git syncs them, and they leave with the owner), with Aludel's database as a rebuildable index? Leaning yes. This would revise the [knowledge strategy](../../knowledge-strategy.md)'s ownership boundary.
2. **Container runtime:** may the next session install one locally (Docker or rootless Podman in WSL) to test "one container per subdomain"?
3. **GitHub from the start:** should a new project's repository be created on the owner's GitHub at creation, making connecting GitHub a required onboarding step? Or is a local repository still allowed until they connect?

## 6. Research notes (2026-09-24, second session)

The owner asked whether GitHub wikis fit the knowledge base, and how the organization and personal GitHub setups differ. Sources accessed 2026-09-24.

**GitHub wikis** ([about wikis](https://docs.github.com/en/communities/documenting-your-project-with-wikis/about-wikis)):
- Documented: GitHub Free and GitHub Free for organizations get wikis on public repositories only. Private wikis need Pro, Team or Enterprise.
- Documented: soft limit of 5,000 files. Pages are rendered markup, mainly Markdown.
- Reported, not verified here: a wiki is a separate git repository, `<owner>/<repo>.wiki.git`, and a repository's installation token works for git on its wiki ([claude-code#86787](https://github.com/anthropics/claude-code/issues/86787)).
- Inference: there's no REST API for wikis, and GitHub shows no pull requests or branch review for them, so edits land directly on the wiki's default branch.
- Verdict: a wiki matches the owner's instinct (its own history, kept out of the app's repository, owned by the owner), but not the free, private default. A plain companion repository gives the same separation on every plan, and adds branches, pull requests and structured files. Knowledge location stays deferred (§5).

**Organization versus personal repository creation** ([repository endpoints](https://docs.github.com/en/rest/repos/repos), fine-grained token sections):
- `POST /orgs/{org}/repos` accepts GitHub App installation tokens, user tokens and fine-grained PATs, with Administration write. Aludel can create repositories on its own once installed. Proven live (see §1).
- `POST /user/repos` accepts only GitHub App user access tokens and fine-grained PATs, not installation tokens. Creating on a personal account needs the user's own token, which Aludel gets from the same GitHub sign-in. Mocked only; not proven live.
- `POST /repos/{template_owner}/{template_repo}/generate` lists installation tokens as accepted. Whether that can target a personal account through an installation is unverified; it's a possible way to create repositories without a user token.
- Inference: an app cannot create a GitHub organization, so requiring one adds a manual step on github.com for users who don't already have one.

**Platforms and app-defined environments** (accessed 2026-09-24):
- All six build from a plain `Dockerfile` in the repository:
  - [Render Blueprints](https://render.com/docs/blueprint-spec) use `runtime: docker`, with `dockerfilePath` defaulting to `./Dockerfile`. Variables without values are declared with `sync: false`, and preview environments with `previews.generation`.
  - [Railway config-as-code](https://docs.railway.com/reference/config-as-code) uses `builder: DOCKERFILE` (Railpack is the default), plus a health check path and overrides per environment, including PR environments. The file doesn't declare variables.
  - [Fly `fly.toml`](https://docs.fly.io/reference/configuration/) looks for `Dockerfile` by default, with `[env]` for non-secrets, `fly secrets` for secrets, and `[[mounts]]`, `[http_service] internal_port`, checks and `[[vm]]` memory and CPUs.
  - [Kamal](https://kamal-deploy.org/docs/configuration/overview/) uses `config/deploy.yml` (service, image, servers, proxy, env, accessories), with secrets outside the repository in `.kamal/secrets`.
  - [Coolify](https://coolify.io/docs/knowledge-base/docker/custom-commands) has dedicated settings for CPU and memory, and accepts only an allow-list of `docker run` options (including `--cap-drop`, `--security-opt`, `--ulimit`, `--init`).
  - [Dokku](https://dokku.com/docs/advanced-usage/resource-management/) uses `resource:limit` per app and process type: `--cpu`, `--memory`, `--memory-swap`, `--network-ingress`/`--network-egress`, plus a `build` process type that limits builds.
- Inference: each platform has its own manifest on top of the Dockerfile, and the manifests don't agree. The portable core an app should own is **a Dockerfile plus a list of the variable names it needs**. Each platform manifest is a thin, generated adapter.
- Inference: the resource guards belong to the **host**, not the app. That's how Coolify and Dokku do it. An app can say what it needs, but it must not decide its own limits on someone else's server (P7).

## 7. Container spike (2026-09-24, agent-checked)

A skeleton generated by `aludel-web-v1` (Tool Share, marketplace feel, sign-in on) was given a two-stage `Dockerfile`:
- the build stage runs `npm ci` or `npm install` against the app's own `package.json`, then `npm run build`;
- the runtime stage is `node:24-bookworm-slim` with only `package.json`, `server/` and `dist/`, the non-root `node` user, `DATA_DIR=/data`, and a `HEALTHCHECK` on `/api/health`.

The container ran with `--memory 256m --memory-swap 256m --cpus 0.5 --pids-limit 64 --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges`, a data volume, and a port published on loopback only. Docker Desktop 29.2.1 in WSL.

| Check | Observed |
|---|---|
| Build, cold cache, own dependencies (no portal `node_modules`) | 35 s; image 331 MB, mostly the Node base |
| Start to healthy | 357 ms |
| Sign-up survives `docker restart` (data on the volume) | yes |
| Idle footprint | 17.5 MiB, 7 processes |
| Runs as | uid 1000 `node`; writing to `/app` fails (read-only), writing to `/data` works |
| Allocating 1 GB inside | that process was killed (exit 137, `OOMKilled=true`); the app server kept serving |
| Spawning 200 processes | 150 failed at the 64-process limit |
| Busy loop | held at 49% of one CPU (limit 0.5) |
| Outbound network | **open** (`https://example.com` returned 200). Egress is a policy decision (below) |
| Published port after restart | **changed**. The proxy must look the port up and must not cache it |

## 8. Proposal (agent recommendation; owner review pending)

1. **The app owns how it runs:**
   - The scaffold writes `Dockerfile` and `.dockerignore`, plus `compose.yaml` so `docker compose up` runs the app without Aludel (P5).
   - Variables are declared by name only, with no values (`.env.example`). Subdomain mode is a set of variables (`PORT`, `HOST`, `DATA_DIR`, later a public base URL), not a code path (P8).
   - Platform manifests (`render.yaml`, `fly.toml`, Kamal `deploy.yml`) are generated only when the owner picks a target.
2. **Aludel's host owns the guards:**
   - Every preview runs as one container per project environment, named `aludel-<project>-<environment>` and labelled.
   - Default limits: 256 MB memory with no swap, 0.5 CPU, 64 processes, a read-only root filesystem with `/tmp` in memory, all capabilities dropped, `no-new-privileges`, a non-root user, a loopback-only port behind the portal's proxy, and one writable data mount.
   - Quotas per account (running environments, storage, build minutes) come next, together with stopping idle apps and a kill switch.
   - Egress: open locally for now. Before any public hosting, choose between no egress by default with an allow-list, or open with rate limits. This is gated by Q-005/Q-008.
3. **Local works like the server (P8):**
   - Previews move from child processes to containers when Docker is reachable. The process runner stays as a fallback and for the test suite.
   - Locally, the data mount is a bind mount of the workspace's `.data/` folder, so backups, restore and the Database tab keep working unchanged. On a server it becomes a named volume.
   - Builds still run in Docker's builder without limits. Limiting and isolating builds is part of LAY-05/B-03B.
4. **GitHub (P2):**
   - Connecting GitHub becomes required before creating an app.
   - Both personal accounts and organizations are supported, defaulting to the account the person signed in with.
   - Onboarding becomes: sign in with GitHub, install the app (all repositories), approve the recipe. Aludel then creates the repository, pushes, builds the container and opens the preview.
   - Blocked on the live personal-account proof (owner steps in the handoff).
5. **Deferred:** where knowledge lives (option (d), a companion repository, is provisional), multi-instance sync (P10), and Aludel's own server project (P9, which needs a server).

**Dependency-ordered packets:**
- **PP-01A:** container runtime for previews, plus the Dockerfile and compose in the scaffold. **Built and agent-checked** (§9).
- **PP-01B:** the live personal-account GitHub proof (owner steps).
- **PP-01C:** GitHub-first onboarding: required connection and the recipe approval screen (UX pass: prototype, then build).
- **PP-01D:** the Environments view reads the app's own declaration (UX pass).
- **PP-01E:** quotas, idle stop and the egress policy, designed now and enforced before public hosting.
- Then **ICONS-FONTS-01**, now unblocked by PP-01A because each app installs its own dependencies.

## 9. PP-01A: container previews (built 2026-09-24, agent-checked; owner review pending)

**Changed:**
- **Scaffold** ([scaffold.mjs](../../../apps/portal/server/scaffold.mjs) `containerFiles`):
  - every generated app gets `Dockerfile` (as in §7), `.dockerignore`, `compose.yaml` (`docker compose up --build`, with a named data volume) and `.env.example` (every variable the app reads);
  - `AGENTS.md` names the container commands.
- **Previews** ([previews.mjs](../../../apps/portal/server/previews.mjs)):
  - The runtime is `docker` when the daemon answers, and `MACHINE_PREVIEW_RUNTIME=process|docker` overrides the check.
  - Docker builds use `docker build` from the app's own Dockerfile. Runs use one container per project with the host limits (`containerLimits`), a loopback-only published port that's read back on each start, and the workspace's `.data` mounted as `/data`.
  - Containers are labelled with a hash of the portal instance, so a second portal (tests, another checkout) never removes them. They're removed on portal shutdown or restart, as child processes were.
  - A failed proxy connection forgets the container, so the next request restarts it.
  - The process runtime is unchanged, and the shared `node_modules` link is only made for it.
- **Tools:**
  - [tools/delete-project.mjs](../../../apps/portal/tools/delete-project.mjs) deletes a project's rows by following foreign keys, plus the one undeclared link, `knowledge_revisions.record_id`. It also removes the workspace, assets, log, container and image. It does a dry run by default and writes a `VACUUM INTO` backup first.
  - `browser-checks.sh` pins the process runtime unless told otherwise.

**Evidence (agent-checked 2026-09-24):**
- `node --test tests/*.test.mjs`: 77/77 pass, including the new [previews-docker.test.mjs](../../../apps/portal/tests/previews-docker.test.mjs):
  - The skeleton declares how it runs and sets no limits of its own.
  - A real Docker build and run: no portal `node_modules` link; health OK. The limits are read back from `docker inspect`: memory 256 MB with no swap, 0.5 CPU, 64 processes, read-only root, `CapDrop ALL`, `no-new-privileges`, user `node`, loopback-only port.
  - Sign-up writes `<workspace>/.data/app.sqlite`.
  - A second portal instance's start-up leaves the first one's container alone.
  - Stopping removes the container, and the restarted container signs the same account in.
- `MACHINE_PREVIEW_RUNTIME=docker tools/browser-checks.sh onboarding`: PASS in 27 s. The whole onboarding flow built `aludel-preview/<project>` and served the app in its frame. The container was removed on shutdown.
- The six test projects were deleted with the new tool: 1,760 rows, 16 paths. A dry run on a `VACUUM INTO` copy found 796 orphaned `knowledge_revisions` rows, and the undeclared link was added before the real run. 11 revision rows were already orphaned before this work and were left alone.

**Limitations:**
- The owner's running portal still uses the process runtime until it restarts.
- The first container build per app takes about 35 s (`npm install`); later builds reuse the dependency layer unless `package.json` changes.
- There's no `package-lock.json` yet, so installs aren't reproducible. Next step: commit the lock produced by the first build.
- Builds run without limits.
- Outbound network access is open.
- There's no idle stop or quota per account yet (PP-01E).
- The Docker branch of `delete-project.mjs` has not been run against a real project.

**Retrospective (PP-01A):**
1. *What made it harder:*
   - The brief's "no runtime installed" claim was wrong. It had been inferred from a missing path, not checked with `docker info`.
   - The portal had no way to delete a project. The schema also hides one relationship (`knowledge_revisions`) that only a dry run on a copy revealed.
   - The GitHub App's configuration (`.env`) had disappeared since the organization trial, which blocks the live proof.
2. *What would help next time:*
   - Check capabilities by running them: `docker info`, the portal's `/api/session` `githubSignIn`.
   - Test destructive tools on a `VACUUM INTO` copy before the real run. Both habits are now written into this record and the tool.
3. *What changes downstream:*
   - ICONS-FONTS-01 is unblocked in principle, since apps install their own dependencies.
   - LAY-05/B-03B can reuse the container boundary for agent runs.
   - Environments (PP-01D) should read `Dockerfile` and `.env.example` rather than invent a new format.
4. *Questions:*
   - Egress policy, open locally for now; gated before public hosting.
   - Where knowledge lives (deferred).
   - Whether the personal-account creation path works live (PP-01B).
5. *Process change applied and tested:* the delete tool's dry run on a copy caught the orphan problem before real data was touched, so that was observed working, not predicted. The per-instance container labels were tested by the second-portal check. Whether "one container per subdomain" holds up under many projects at once is still a hypothesis.

**Status of PLATFORM-PIPELINE-01:** not complete. PP-01B (live personal-account proof) waits on owner steps. PP-01C and PP-01D need UX passes.

## 10. GitHub App configuration split (2026-09-24, agent-checked)

The owner asked whether `.env` is standard practice. Answer: it's standard for local development (twelve-factor config in environment variables). Servers inject variables from systemd credentials, Docker secrets or a platform secret store. The owner said "go" to the recommended split:
- The App's **public identifiers** (app ID, slug, client ID) are committed in [config/github-app.json](../../../apps/portal/config/github-app.json), so the repository always records which App the portal uses. Environment variables still override them.
- **Only the secrets** (client secret, private key path) come from the environment. The loader never reads them from the committed file. The root [.env.example](../../../.env.example) lists them.
- The operator setup panel and missing-configuration messages point at the committed file.

Evidence:
- New server test in `github-integration.test.mjs`: 78/78 pass. It covers identifiers from the file, secret-shaped keys in the file ignored, environment overrides, and the committed file holding only public keys.
- The `github` browser check passes.

Still open: the identifiers are empty until the owner fills them in. A hosted secret store is still undecided.

## 11. PP-01B live attempt 1 (2026-09-24)

**Observed:**
- The owner signed in as `henrydker`. The only synced installation was the `aludel-workshop` organization (all repositories, Administration and Contents write).
- The onboarding GitHub step showed that single option with no way to add another account. "Install the App" only appeared while no eligible installation existed.

**Fixed (agent-checked):**
- The owner selector now has "Install on another account" and "Check again".
- The default owner is the signed-in person's own account when it's installed.
- Typecheck, build, and the `onboarding` and `github` browser checks pass.

**Next:** the owner installs on the personal account and retries. This needs the App's "Any account" setting, or the personal account won't be offered on GitHub's picker.

## 12. PP-01B live attempt 2 (2026-09-24)

**Observed:**
- **Personal repository creation works live.** `henrydker/browser-buddy` was created on the personal account through `POST /user/repos` with the GitHub App user token. This is the first live evidence for the personal path's create step.
- **The first push failed** while minting the installation token: "A JSON web token could not be decoded".
- Probe (agent, bounded; printed only statuses, the App's name and the public fingerprint):
  - The clock is within 14 s of GitHub.
  - `GET /app`, with a JWT signed by the configured key, returns 401 with that message for `iss` = app ID as a string, the app ID as a number, and the client ID.
  - Diagnosis: the configured private key doesn't belong to App 5025942, or was deleted from it. The key's public fingerprint is `SHA256:AsS74UeJU8MJEqgmItDZFs9FSRaHzbeqNqg6ySVOvyI=`.

**Fixed:**
- Onboarding had no way to retry a failed first push for generated projects. There's now `POST /api/projects/:id/repository/finish` (reusing `finishLocalSetup`, which never creates twice) and a "Retry the push" button.
- Checks: typecheck, build, and server tests 78/78 pass. The new route has no test of its own; `finishLocalSetup` is covered by the existing retry test.

**Next (owner):** compare the fingerprint with the App's private keys. If none matches, generate a new key, update `MACHINE_GITHUB_PRIVATE_KEY_PATH`, restart, then retry the push.

## 13. PP-01B verified (2026-09-24, agent-checked against live GitHub)

The owner replaced the private key, restarted and retried the push, and it succeeded. Verification:

| Check | Observed |
|---|---|
| Aludel binding | `henrydker/browser-buddy`, `ready`, private, installation 164555330, `account_type=User`, no error |
| GitHub repository | owner type `User`, private, default branch `main` at `f0f3af3`, 30 files, the same as the local `main` (clean, tracking `origin/main`) |
| Secrets | the remote URL has no credentials; the only tracked sensitive-pattern file is `.env.example` (allowed) |
| Preview | container `aludel-<instance>-p-dfce104b06` is healthy; 256 MB, 0.5 CPU, 64 processes, read-only, `CapDrop ALL`, user `node`; 18.7 MiB in use; `browser-buddy.localhost:4310` returns 200 |
| **Who pushed** | GitHub's activity log showed **`henrydker` (User)** for both the branch creation and the skeleton push, not the App |

**Defect found:**
- The portal's `git push` let git consult the person's own credential helpers first. On this machine that's `gh auth git-credential`, logged in as `henrydker`, so pushes went out as the person and `GIT_ASKPASS` was never asked.
- The mint on retry did succeed, which proves the replaced key works. But the push identity was wrong, and on a machine without `gh` the push would have failed.
- The earlier organization trial's push identity was never checked against the activity log and may have been affected the same way.

**Fix (agent-checked):**
- Both push paths in [git-repository.mjs](../../../apps/portal/server/git-repository.mjs) now run `git -c credential.helper= push` with only the askpass token.
- New test: a fake GitHub endpoint (a separate process) demands credentials, and a helper is planted in `GIT_CONFIG_GLOBAL`. A control push reproduces the bug: the helper is used and the person's login is sent. `pushWorkspace` never calls the helper and sends only `x-access-token:<installation token>`.
- Server tests: 79/79 pass.

**Live proof of the App's push:**
- An installation token was minted for the personal installation, scoped to `browser-buddy` with Contents write.
- `git -c credential.helper= push` created, then deleted, a branch `aludel-push-check` pointing at the existing `f0f3af3`.
- GitHub's activity log records both as **`aludel-workshop[bot]` (Bot)**. Only `main` remains.

**Verdict:**
- **PP-01B passed.** On a personal account, Aludel creates the repository with the user token and pushes as the App with an installation token, live.
- Not yet shown: the portal's own fixed push code running live. It needs a portal restart, and the next push (for example a skeleton regeneration) is the first live run.
- Not checked yet: expiring user token refresh, revocation, and what happens when the owner disconnects.
- A leftover `test app` project (`p-683f3c21f7`, no repository) is from attempt 1.
