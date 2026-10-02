---
id: evidence-t03-code
kind: evidence
status: agent-checked
updated: 2026-10-02
depends_on: [T03-CODE, DEC-055, DEC-057, DEC-059, DEC-061, DEC-062]
---

# T03-CODE: the app repository as the Code layer, with GitHub sync (run 1)

## Scope and authorization

The owner approved the plan in chat on 2026-10-01 (DEC-061) and started this run with "start t03 code". After the repository model was explained, they confirmed the direction on 2026-10-02 ("im happy with direction, continue"). Each layer owns its own repository; Code's repository is the app's codebase, with its definition in `.aludel/`. The owner also confirmed that GitHub changes to what a layer runs are held for review ("holding layer update for review, good").

The run is recorded in [the brief's run log](../../design/layer-app-transition/t03-code-brief.md#run-log). Its scope was local code, tests, previews and evidence on `main`, on `layer-base` (`main`, plus the new `code` branch) and in disposable repositories.

- GitHub was exercised only against a fake GitHub.
- No live GitHub write, provider turn, deployment or spending happened.
- No owner data was touched. Adopting existing projects runs when the owner restarts the portal; it was run here only on disposable data.

## Outcome

**Code is a template.** The `layer-base` branch `code` is pinned at `83ce28a`, and `builtIn` maps `platform` to `code`. The branch holds:

- a manifest under the instance key `platform`, with `install: project-repository`;
- a charter and two method notes;
- `server/code-index.mjs`, which holds:
  - the indexer for code units, trace links and releases;
  - the release rules, ported with their messages;
  - the starter-docs `seed('install')`, through a Code-owned adapter over Library entries;
- the views (Overview, Explorer, Tests, Releases) and a GitHub sync card;
- tests, a migration ledger and a source inventory.

**Code's repository is the app's repository.** Installing copies the template's package into the project's workspace under `.aludel/` as one commit; the app's own files stay where they are. When that happens:

- **A new project:** Code installs once the repository exists, and goes to GitHub with the first push.
- **An existing GitHub repository:** "Use a repository I already have" first checks the repository: Aludel clones it with an installation token and lists the files it would add, committing nothing. Confirming then:
  - makes the clone the workspace, moving the starter repository aside;
  - installs Code and seeds its starter docs;
  - pushes with the App's token.

  A default branch other than `main` is refused for now.
- **An existing project:** on restart, its generation links and releases move into `.aludel/outputs/` once, keeping their IDs.

**What Code keeps, and where:**

| Output | Kept as | Notes |
|---|---|---|
| Code units | Derived at the pin by the host index library (`source-units.mjs`), from `src/**`, `server/**` and `tests/**` | Same keys and `cu-` IDs as before, so existing Work targets still resolve |
| Trace links | `.aludel/outputs/trace-links.json` (generation links) | Trailer and test-name links stay derived at the commit. Builds write their links before the push; closing a Reconcile item relinks in the file |
| Releases | `.aludel/outputs/releases.json`, plus a local tag `vX.Y.Z` | Stack changes and migrations are derived between releases' commits. Publish state is host data. Commits that touch only `.aludel/` don't count as app changes |
| The app's docs | The repository's own `AGENTS.md`, `README.md`, `ARCHITECTURE.md` and `docs/` | They are Code's Knowledge: listed, read, checked and saved at their repository paths |
| Route observations | Host table, held under the converted layer | Until LAYER-BINDINGS-01 step 4 (F10) |

The host's code-link tables (`code_units`, `trace_links`) stay as a cache rebuilt from the Library at the pin. So Reconcile, builtBy, Vision's "Built by" and Data's built status work as before.

**GitHub sync** (`layer-remote.mjs`) is built for any layer instance and turned on for Code, using the project's existing repository binding rather than a second one. It works like this:

- **When:** Code syncs on Sync, after a Knowledge save and when the code is read again.
- **Fetch:** a fast-forward moves the pin and re-reads the code. A change to what the layer runs (`.aludel/server`, `ui`, `api`, `tests` or `layer.json`) is held whole until a person accepts it, as the owner confirmed.
- **Divergence:** never merged automatically. It becomes Work in Code, and pushes wait.
- **Push:** never forced; it retries once after a fetch.
- **Unavailable:** not connected, an expired token, an uninstalled App or a deleted repository leave the layer working locally, with the reason shown.
- **Credentials:** git talks to GitHub only through `gitWithToken` (askpass, every credential helper cleared). Tokens are never stored, logged or put in a URL.

## Contract generalizations (G-CODE)

Each one is in the base contract on `layer-base` `main` and tested on a non-Code fixture: a base-template layer in a plain repository.

| Generalization | Base contract | Host test |
|---|---|---|
| A package under `.aludel/`; every manifest path, the tests and the run sandbox's outputs copy are relative to the package root | `b8096f3` | `layer-package-root.test.mjs` |
| Installing into an existing repository: one commit; dirty trees refused; an existing package bound as it is | `b8096f3` | same |
| `files.repository` globs: the repository's own files as output; never `.env*`, `.git/` or `.github/workflows/`; review marks only the package's authority paths | `b8096f3` | same; the coding-run test in `code-template.test.mjs` |
| `files.units`: code units parsed by the host at the commit and passed to the layer's pure indexer | `e8490b4` | same |
| `knowledge.docs`: docs the repository already keeps; generic doc checks (broken links, stale sources, off the map) for every layer | `837c1c4` | same |
| A remote per layer-instance repository, with sync states | `e8490b4` | `layer-remote.test.mjs` (a fake GitHub serving real Git) |
| `install: project-repository`, and file layers' `files.seeds` | `7046c0d`, then the seeds commit | `code-template.test.mjs` |

LAYER-BINDINGS-01 follow-up F1 is done: views link inside their own layer with `ctx.here(...)`, read their installed key with `ctx.hereKey()` and use the colour class `lay-l-here`. Code's views never name a layer key.

## Checks (agent, 2026-10-02)

| Check | Result |
|---|---|
| `npm run test:server` (templates off) | 271 pass, 0 fail, 31 skips. The 24 earlier skips need templates on, and so do 7 new ones |
| `npm run test:server:templates` | 295 pass, 0 fail, 7 skips (unchanged from before) |
| Template tests on `code` (contract, rules, seed) | 10 pass, 5 contract skips (no API, no facets) |
| `tools/typecheck-layer-ui.mjs` at the `code` pin | Pass at `83ce28a` |
| `npm run typecheck`, `npm run build` | Both pass. Typecheck has no errors; the existing template warnings remain |
| Parity (`code-template.test.mjs`) | An adopted project keeps every generation link's ID, record and pinned revision, and every release's ID, version, commit and published URL. Units at the same commit match today's `code_units` with the same IDs. The cache matches, and the seeded starter docs and citations match the compiled starter set |
| Restart adoption (`code-adoption.test.mjs`, real portals) | A project built and released with templates off, then restarted with templates on: Code installs after the portal is listening, every link keeps its ID and pinned revision, and the release keeps its ID, version and commit |
| `github-sync` (`code-github.test.mjs`, fake GitHub in its own process) | Covers: import of a repository the scaffold didn't make (check, then confirm); push after a Knowledge save; pick-up of an external commit, with its code indexed; divergence held as Code's Work; expired token; uninstalled App. A planted personal credential helper is never used, only the installation token reaches GitHub, and no token is in any database file or the git config |
| Generic coding run (`code-template.test.mjs`) | An ignored `.env` file isn't committed. Un-ignoring it, touching `.github/workflows/`, or writing outside the package's allowed files is refused. `.aludel/server` changes are marked for owner review. Merging moves `main` and the pin |
| Browser, templates on | `code-layer` passes 3 of 3 runs. `loopback` passes (with the fix switched off, it fails). Earlier on the same day, `pages`, `design-layer`, `bindings`, `library`, `layer-bar` and `layer-scope` passed at the `1b500d1` pin, and `pages` and `design-layer` passed again at `83ce28a` |

## What happened on the owner's portal (2026-10-02)

The owner started their own portal at 07:32 on this checkout, after the template pin landed (`73f4090`). In this run, starting the portal moves Code into existing projects' repositories. I hadn't warned the owner before that restart, and should have. Inspected afterwards, every working tree was clean and nothing was lost:

- **biome** (`p-469ba80496`, created that morning): `.aludel/` went to `henrydker/biome` with the first push, when the owner created the repository in the browser. This is authorized.
- **browser-buddy** (`p-dfce104b06`): local commits for the install, its 4 links and 1 release adopted, and starter docs. GitHub's `main` is unchanged at `f0f3af3`.
- **`p-683f3c21f7`**: a local install and starter docs. It has no GitHub repository.

Whether to keep or undo this is the owner's call; the DEC-062 backup and resetting the two local repositories are the ways back.

The same session found a pre-existing frame bug: layer frames allowed only `http://aludel.localhost:<port>` as an ancestor, so a portal opened at `localhost` or `127.0.0.1` showed every layer as "refused to connect". It is fixed in `0d589ab`, with a browser check.

**Process change:** before asking the owner to restart on a checkout whose start-up changes their data, say exactly what will change, and on which projects.

## Limits and what is not claimed

- **No live GitHub.** The owner's live round trip is still to do: create, import, a Knowledge save on GitHub, a commit on github.com picked up, and a divergence held. The import screen in onboarding has not been seen in a browser, because the browser journeys can't fake a connected GitHub account. Its server path is tested.
- **Coding runs in Code** use the generic layer path, which has no isolated candidate preview. The compiled `platform.implement` pipeline keeps its preview. This needs an owner decision (below).
- **Not carried yet:**
  - asking for a doc section's refresh as Work, from Knowledge;
  - the `AGENTS.md` length check.

  Both are in the ledger; templates off keeps them.
- **Size:** units pass to the pure indexer through the 1 MB sandbox input. A repository with more than about 2,000 units, or 2,000 source files, is refused with a message. Real repositories may need paging.
- **Import** refuses default branches other than `main`.
- **Retirement of the compiled modules** is not done in this run (see below).

## Retrospective

1. **What made the work harder, slower or more error-prone than necessary?**
   - *Observed:* editing portal files while a full suite ran produced mixed results twice. The cost was a lost run each time, and once a misread baseline.
   - *Observed:* two worker tests gave a spawned portal a fixed 5–8 s to start. That passes alone and fails under full-suite load.
   - *Observed:* the brief's wording "a repository that belongs to something else" confused the owner about who owns the Code repository. A tree diagram of two repositories cleared it up at once.
2. **What preparation, tool, contract or check would make the next equivalent task easier?**
   - A suite runner that snapshots the tree, so editing can continue while it runs. Until then, the rule in this run was: no portal edits during a suite.
   - A browser harness that can fake a connected GitHub account (the API through a stub, Git through `fake-github-git.mjs`), so onboarding's GitHub step can be driven.
   - Showing repository layouts as trees whenever the owner reviews a repository model.
3. **What did the task reveal that changes the roadmap, downstream packets, architecture or operating process?**
   - Every layer can now live in a repository it shares with other content, and sync with GitHub. LAYER-GITHUB-01 can turn sync on for Vision, Design, Pages and Data without new mechanism; it is mostly naming, privacy and the live proof.
   - Coding runs now have two paths (candidate previews for the compiled action, generic layer runs for layer-scoped Work); LAT-08A's layer-owned review should decide how they meet.
   - Three latent bugs in the generic layer code would have hurt any layer whose checkout is shared, found by putting an app repository behind it:
     - output-file edits judged the checkout clean after moving `main`;
     - inside a caller's transaction, they moved the checkout before the write was final;
     - a Knowledge save could be undone by the app's next `git add -A`.
4. **What questions were created, resolved or made newly important, and what do they block?**
   - **Resolved:** where Aludel's files go (`.aludel/`); docs as Knowledge; holding unreviewed authority changes from GitHub.
   - **New, for the owner:** should layer-scoped Code Work also build an isolated candidate preview, as `platform.implement` did? This blocks nothing in this packet, but it shapes LAT-08A.
   - **New:** should the "refresh this section" Work action move into Knowledge for every layer with a sources sidecar?
5. **Which process change was applied now, how was it tested, and what remains only a hypothesis?**
   - *Applied:* the brief's "base-contract assumptions Code breaks" table was written before any code. Each row became one G-CODE change with a non-Code test. Tested: all six changed generic modules, and Code needed no layer-key branches in the host.
   - *Applied:* worker tests' start-up waits are now time-based (30 s). Tested: the next full runs had no start-up failures.
   - *Hypothesis:* the generic sync will serve the other layers unchanged in LAYER-GITHUB-01.

## Next

1. **Owner:**
   - restart the portal and look at Code. On restart, existing projects adopt; the backup from DEC-062 is the rollback;
   - run the live GitHub round trip (brief, "Owner setup the live proof needs");
   - answer the candidate-preview question.
2. **Then:** retire the compiled built-in layer modules and `legacyDeclarations` for every converted layer except Deploy, as its own commit, so it can be reverted alone. The compiled Code view stays the templates-off fallback until then.
3. **LAYER-GITHUB-01** and **LAYER-BINDINGS-01 step 4 (F10)**.
