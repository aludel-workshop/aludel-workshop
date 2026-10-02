---
id: T03-CODE
kind: work-brief
status: approved
updated: 2026-10-01
depends_on: [DEC-055, DEC-057, DEC-059, T03-G2, T03-DESIGN, T03-DESIGN-SEED, LAYER-BINDINGS-01, LAYER-KNOWLEDGE-01]
---

# T03-CODE brief: the app repository as the Code layer

Start here. This brief gives a fresh session what it needs to convert Code onto `layer-base` the way Data, Vision and Design were converted. Code is different from those three: its repository is the app repository. The owner did not create that repository through Aludel, and most of its files are not Aludel's. Read [the T03-DESIGN brief](t03-design-brief.md) for the recipe and its pitfalls. This brief lists only what differs.

## Authorization

- **2026-10-01, owner chat:** "lets pick up t03 code then". This authorized writing this brief.
- **2026-10-01, owner chat, plan approved with changes.** The owner's words: "`.aludel/` great, keep docs in knowledge, perfect natural place. basically what the other layers are modeled after. and no - we're setting up actual github sync here. should auth with github. we should be saving these repos to the owners github (which needs setup as well, i think?), not much different if we get one from there already built." This means:
  - Aludel's files go in `.aludel/` (question 1).
  - The app's docs are Code's Knowledge, like every other layer's docs (question 3, the alternative).
  - **GitHub sync is in scope.** The Code repository is created on, or imported from, the owner's GitHub, and the two stay in sync (question 2, replaced).
- **Authorized:**
  - Bounded local work: code, tests, previews and evidence in:
    - `main` of this repository (the candidate was promoted by DEC-062 at `1c17c48`; the portal is `apps/portal`);
    - a new `code` branch in `layer-base` (from `main` `fee5f30`);
    - disposable local repositories.
  - **GitHub writes to the owner's own account through the Aludel GitHub App, only when the owner starts them in the browser**: creating a repository, importing one, adding `.aludel/`, and pushing accepted commits.
  - Automated tests use a fake GitHub (the PP-01B fake-endpoint pattern). Agents never hold GitHub tokens, never read the App's secrets, and never start a live write themselves.
- **Not authorized:**
  - deleting or archiving GitHub repositories (the owner does that on github.com);
  - public visibility by default (new repositories are private unless the owner picks otherwise);
  - publishing GitHub Releases or Packages, and changes to CI workflows;
  - writing to repositories the owner did not pick;
  - provider turns, deployment or spending;
  - migrating the owner's live data.

Record each run's start here before executing.

### Run log

- **2026-10-02, review planning refinement (Codex, owner chat).** The owner clarified that every layer repository needs integration before review of repository writes, and that Code review steps must open the exact scenario without manual login/navigation. Scope: update local planning records to include these requirements and the preceding discussion's on-demand combined builds. No runtime implementation, external writes or acceptance is requested. Preserve T03-CODE as the single handoff; update LAT-08A's review contract and evidence plan.

- **2026-10-02, preview planning (Codex, owner chat).** The owner asked how layer-scoped Code submissions should provide clickable review builds with evolving demo data, and what ten pending reviews would cost in space. Authorized scope: bounded read-only repository/primary-source research and a local planning/handoff note for this question. This is advice, not approval to implement preview infrastructure. Preserve T03-CODE as the handoff. Findings and proposed trial are recorded in [LAT-08A's preview lifecycle proposal](layer-owned-review.md#code-preview-lifecycle-proposal-2026-10-02).

- **2026-10-01, run 1 (Claude, VS Code chat).** The owner said "start t03 code". Scope is exactly the authorization above: local code, tests, previews and evidence on `main` of this repository (from `53fcb92`), a new `code` branch and G-CODE commits on `layer-base` `main` (from `fee5f30`), and disposable local repositories. GitHub is exercised only against a fake GitHub. No live GitHub writes started by the agent, no provider turns, deployment, spending or live owner data. Order: ledger → G-CODE → `code` template → parity → host wiring → checks → closeout; the owner's live round trip comes after the fake-GitHub journey passes.
- **2026-10-02, run 1 checkpoint (in progress).** Done so far, each tested on a non-Code fixture (a base-template layer under `.aludel/` in a plain repository):
  - **Ledger:** `layer-base` `code` has `docs/migration-ledger.md` and `docs/source-inventory.md`. Rows marked *pending* are settled at closeout.
  - **G-CODE, all six:**
    - base contract at `layer-base` `main` `e8490b4` (from `fee5f30`);
    - host commits `a6fcdd3` (package root, install into an existing repository, writable set) and `3d50317` (host index library `source-units.mjs`, `doc-checks.mjs` plus Knowledge repository docs, `layer-remote.mjs` sync).
  - **Template `code`** at `73aef0e`: manifest (instance key `platform`), charter, methods, the `code-index.mjs` indexer and rules with tests, and `knowledge.docs`. **Not yet built:** `ui/`, the Code-owned adapter, `seed('install')` for starter docs, and pins.
  - **Checks:** templates off 271 pass, 0 fail, 24 skips. Templates on 287 pass, 7 skips and 1 failure; the failure (a changed refusal message in `layer-docs.test.mjs`) was fixed and its file rerun clean. A full rerun is still owed.
  - **Decisions taken in this run**, for the owner to see at closeout:
    1. Manifest paths, tests and the run sandbox's `.aludel/outputs/` copy are all relative to the package root.
    2. `files.repository` (globs) names repository files as output, never `.env*`, `.git/` or `.github/workflows/`. `files.units` (globs) asks for host-parsed units. Code uses `src/**`, `server/**` and `tests/**`, so units match today's `code_units` with the same `cu-` IDs.
    3. Trace links and releases are `.aludel/outputs/trace-links.json` and `.aludel/outputs/releases.json`, not the brief's `.aludel/trace-links.json`, to keep the `outputs/` convention.
    4. Repository docs are addressed in Knowledge with a leading `/`.
    5. **Confirmed by the owner (chat, 2026-10-02: "holding layer update for review, good"):** a GitHub fast-forward that touches `.aludel/` authority files is held whole until a person accepts it. The brief said the host keeps running the last reviewed handler while the rest moves; an unreviewed indexer can't index, so holding the whole change is the safe reading.
    6. Saves into a nested package refuse a dirty checked-out `main`. Found while testing: the scaffold's next `git add -A` commit would otherwise undo a Knowledge save.
  - **Found, pre-existing:** `symphony-proposals.test.mjs` gave a spawned portal 5 s to start. Under full-suite load that timed out; start-up itself is unchanged at about 1.5 s. The wait is now 30 s.
  - **Next:** step 3's views, adapter and seed. Views need new host features for repository files, re-index, release drafts and CI. `frameAllows` only lets GETs through a fixed list, so read features need a generic change there. Then parity (step 4), host wiring with GitHub sync on the project's repository binding (step 5), and checks (step 6).
- **2026-10-02, run 1 checkpoint 2 (in progress).** The owner confirmed the direction after the repository model was explained (each layer owns its repository; Code's is the app's codebase, with its definition in `.aludel/`).
  - **Template `code`** at `1b500d1`, pinned with `"platform": "code"` in `builtIn`. Done: views (Overview, Explorer, Tests, Releases; type-check clean), starter docs as `seed('install')` through a Code-owned adapter, and `install: project-repository`.
  - **Host:** portal `73f4090`.
    - `code-repository.mjs`: projection cache from the Library, links into the file at build, Reconcile relink, releases with tags, adoption and seed.
    - Sync wired to the project's repository binding.
    - Frame host features; `ctx.here` and `ctx.hereKey` (F1); route observations host-held until F10.
  - **Parity:** `tests/code-template.test.mjs`. An adopted project keeps every generation link's ID, record and pinned revision, and every release's ID, version, commit and publish URL. Units derived at the same commit match today's `code_units` with the same IDs. The cache matches. The seed's starter docs and citations match the compiled starter set.
  - **Checks:**
    - templates on: 292 pass, 0 fail, 7 skips;
    - templates off: 271 pass, 0 fail, 28 skips (the 4 new ones need templates);
    - `npm run typecheck` and `npm run build` pass.
  - **Bugs found and fixed:**
    - output-file edits decided whether the checkout was clean after moving `main`;
    - inside a caller's transaction, they moved the checkout before the write was final;
    - release drafts counted Aludel's own `.aludel/` commits as changes;
    - two worker tests' start-up waits were too short under load.
  - **Not yet built:**
    - the `code-layer` browser journey;
    - importing an existing GitHub repository (route and UI);
    - a Code-specific `github-sync` journey (the generic sync is tested against the fake GitHub);
    - Code's sync state in its views;
    - the coding run through the generic path with writable-set refusal;
    - Deploy reading releases from the Library;
    - Code › Docs actions in Knowledge (refresh a section as Work);
    - closeout and retiring compiled modules.

- **2026-10-02, chat-authorized shared review implementation:** the host now prepares repository-writing layer submissions against the accepted head before review, accepts only that exact current integration, and builds/checks runnable Code changes on demand. Review-step buttons use pinned app scenarios and real synthetic sessions. [Evidence, app contract and retrospective](../../evidence/repository-review/README.md). This is the bounded LAT-08A integration/preview slice; native review renderer and owner usability gates remain open. No template pin, external repository, provider execution or owner data was changed.
