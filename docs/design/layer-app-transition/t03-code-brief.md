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

(none yet. Builds run in a fresh session, starting from this brief.)

## Fixed decisions you must not reopen

| Decision | Source |
|---|---|
| The Code layer's repository is the app repository, plus a few Aludel files. Connecting an existing repository must be supported | DEC-059 (4) |
| Code's output is the codebase itself, kept as repository files. People's edits commit to `main`; agent edits arrive as a branch merged on elevated review | DEC-059 (2) |
| Layers read each other only through the Library. A consuming layer owns an adapter from what a source publishes to its own shape | DEC-059 (1); T03-ADAPT |
| Work names a layer, with no per-action catalogs. Elevated review per layer | DEC-057 |
| Every installed layer instance is a fork of a `layer-base` template branch | DEC-055 |
| Code is a reference layer: an Explorer tree down to code chunks, not an IDE; no direct code editing; tests run story → scenario → test; explicit releases; developers own the docs (AGENTS.md as the map, plus a sources sidecar) | DEC-049; memory `platform-layer-direction` |
| Knowledge is the layer's docs site, with a spec and binding cards, and saves commit to the layer repository | LAYER-KNOWLEDGE-01 (owner-accepted 2026-10-01) |
| Deploy stays compiled and deferred, but must keep working | DEC-059 (6) |
| Aludel's files in the app repository live in `.aludel/`. The app's docs (`AGENTS.md` as the map, `docs/`, the sources sidecar) are Code's Knowledge | DEC-061 |
| The Code repository lives on the owner's GitHub and stays in sync. Importing an existing GitHub repository follows the same path as creating one | DEC-061; PLATFORM-PIPELINE-01 owner answer 3 (GitHub before creating an app) |
| Aludel creates repositories with the user token (personal accounts) or the installation token (organizations), and pushes as the App with a fresh installation token, `credential.helper=` and askpass. A token is never logged or stored | PP-01B, proven live 2026-09-24 |

## Starting state

| What | Where |
|---|---|
| Portal | `main` after the DEC-062 promotion (merge `1c17c48`). `./launch-machine` runs templates by default, and `layer-base` sits beside the portal (`config/layer-templates.json` `repo: layer-base`) |
| Base layer | `layer-base` `main` `fee5f30` (information spec, facets, refacets, roles); template branches `markdown`, `pages`, `data`, `vision`, `design` |
| Pins | `apps/portal/config/layer-templates.json`. `builtIn` maps `product`, `pages`, `data` and `design`. Code is still compiled, under the instance key `platform` |
| Prior evidence to read | `docs/evidence/t03-g2-files` (repository-mode outputs), `t03-design`, `t03-design-seed-adapt`, `layer-bindings-01`, `layer-knowledge-01` |

## Code today (inventory)

| Piece | Location | Notes |
|---|---|---|
| Declaration | `server/layer-contract.mjs:21`: outputs `code_unit`, `trace_link`, `code_release`, `code_route_observation`; authority `code_projection` | Instance key `platform`, template name `code` |
| The app repository | `project_setup.workspace_path`, created by the scaffold (`scaffold.mjs`, 668 lines) or by GitHub `createRepository` | Previews, Deploy's database view, Symphony coding runs and code candidates all use this path |
| Files, stack, variables, docs | `server/code-layer.mjs`: `trackedFiles`, `readSource`, `readStack`, `readVariables`, `readDocs`, `starterDocs` | Read-only, apart from `starterDocs`, which writes missing docs and the sidecar `docs/.aludel/sources.json` |
| Code units and trace links | `server/code-links.mjs` (398 lines): TypeScript-parser unit extraction, reachability, links from the scaffold's generation manifest (DB only), commit trailers (`Aludel-Work`, `Implements`) and test names; suspect links open Reconcile Work | Tables `code_units`, `trace_links` |
| Releases | `code-layer.mjs` `codeReleases`; table `code_releases` (id, version, commit, notes, stories, stack, changes, migrations, published URL) | Publishing to GitHub is a separate route, out of scope |
| Route observations | `server/pages-code-observations.mjs` | Pages reconciliation input. Moves to bindings in LAYER-BINDINGS-01 step 4 (F10), not here |
| Coding runs | `code-candidates.mjs`, `code-action-gateway.mjs`, `symphony-worker.mjs`, keyed by `platform.implement` / `platform.security` / `platform.docs` | The richest run path: immutable candidate, checks and an isolated preview |
| View | `src/layers/code.ts` (509 lines): Overview, Explorer, Tests, Docs, Releases | Names other layers through `ctx.link('product' \| 'pages' \| 'deploy' \| 'platform', …)` |
| Reads of other layers | `starterDocs` and the scaffold read stories, personas, Data objects and operations, and the design kit by layer key (`know.list(…, { layer: 'design' })`) | Must become a Code-owned adapter over the Library |
| Consumers of Code | Deploy (compiled) reads releases and the workspace; Pages reads route observations; Work reads the coding pipeline | Deploy must keep working |

## Base-contract assumptions Code breaks

*This section is the process change for this packet (see the retrospective prompts). Earlier briefs only ran the recipe; Code is the first layer whose repository is not Aludel-shaped. So before any code is written, the contract's assumptions are checked against the new layer. Each row below is generalized in the base contract rather than special-cased for Code.*

| Assumption | Where | Why Code breaks it | Proposed generalization |
|---|---|---|---|
| The layer package sits at the repository root | `packageAt`, `ensureLayerPackage`, contract test | An app's root belongs to the app (its own `README.md`, `docs/`, `server/`, `tests/`) | **A package root**: a repository may hold the layer under one folder (`.aludel/`). The host finds `layer.json` at the root or at `.aludel/layer.json`, and every manifest path is relative to the package root |
| Installing clones the template | `ensureLayerPackage` | The repository already exists, or the scaffold makes it | **Install into an existing repository**: copy the template's package into the package root as one commit. Template history is kept as a ref, not as the repository's history |
| File outputs live under `outputs/` | `fileOutputs`, `layer-source.mjs` `writable` | The output is the whole codebase | **Writable set from the manifest**: `files.paths` may name globs outside the package root. The fixed list stays as the package's own files. `.env*` and the package's authority files are never output paths |
| An indexer is a pure module with no imports | Indexer sandbox | Unit extraction needs the TypeScript parser | **A host index library that takes files as input** (the `app-kit` pattern): the host parses source into units, layer-agnostically, and passes them to the layer's `entries(files, { units })` |
| The layer's docs are `docs/` inside its package | LAYER-KNOWLEDGE-01 | Code's docs are the app's own `AGENTS.md` and `docs/`, at the repository root | **The manifest names its docs location.** `knowledge.docs` may point outside the package root. Code's points at the repository root |
| A layer repository is local only | `layer_package_bindings` | The Code repository lives on GitHub, and other people push to it | **A remote per layer-instance repository**, with a sync state (see "GitHub sync"). It is built for any layer instance but turned on for Code first |
| Docs checks (off the map, broken links, stale sources) are Code's own | `code-layer.mjs` `readDocs` | Once Code's docs are its Knowledge, the checks belong to Knowledge | **Generic Knowledge doc checks**: broken links and stale cited sources apply to every layer's docs. The off-map check applies when the layer's docs declare a map file |

## Design questions, each with a default

1. **Where Aludel's files live (decided).** In `.aludel/`: `layer.json`, `knowledge/` (charter and method), `api/`, `server/`, `ui/`, `tests/`, the trace-link file and the releases file. The app's own files stay where they are.
2. **GitHub: creating, importing and syncing (decided; details are defaults).** See "GitHub sync" below.
3. **Code's Knowledge is the app's docs (decided).**
   - The manifest's `knowledge.docs` names `AGENTS.md` as the map, plus `docs/`.
   - Code › Docs folds into Knowledge, so the Code view has Overview, Explorer, Tests and Releases.
   - The sources sidecar (`docs/.aludel/sources.json`), refreshing a section as Work, and starter docs carry over.
   - Charter and method docs stay in `.aludel/knowledge/`, shown in Knowledge as for other layers.
   - Each Knowledge save is a commit on `main`, then a push.
4. **Trace links become a file.** *Default:* `.aludel/trace-links.json`, a repository-mode output with stable IDs (the existing `trace_links` row IDs), each pinning a Library entry (instance, kind, ID, revision) and a unit key.
   - The scaffold's generation manifest moves into it.
   - Trailer and test-name links stay derived at a commit, as today, and are not written to the file.
   - Suspect links still open Reconcile Work.
5. **Releases.** *Default:* `.aludel/releases.json` holds each release: ID, version, commit, notes and shipped stories. Recording one also makes a local annotated tag `vX.Y.Z`.
   - Stack changes and migrations are derived at the release's commit.
   - The published URL stays host state, because it is a GitHub effect.
   - Deploy reads releases from the Library.
6. **Code units and route observations.** Units are entries derived at the pinned commit through the host index library (above). They are published to the Library at that commit, not stored as authored records. Route observations stay in their host table, scoped to the Code instance, until bindings step 4 (F10).
7. **Work in Code.** *Default:* one path. A Code-layer Work run is the existing coding pipeline (immutable candidate, checks, isolated preview) on the app repository. Its writable set is the manifest's output paths.
   - Changes under `.aludel/server`, `ui`, `api`, `tests` and `layer.json` are authority paths, marked in review as for every layer.
   - The `platform.*` action labels remain readable history only (DEC-060).
8. **Reads of other layers.**
   - *Default:* a Code-owned adapter (`ui/code-sources-adapter.ts`, plus a pure server-side counterpart for starter docs) reads stories, personas, Data objects and operations, and the app kit from the Library, choosing sources there, as Pages' kit adapter does.
   - Starter docs move into the template's `seed`.
   - The scaffold stays host code, because it creates projects, but reads the kit and records through the Library.
   - Links to other layers go to Library entries. This includes F1: host SDK modules that take a layer key become layer-relative.
9. **Information and facets.** The template declares its information spec (code units, trace links, releases, docs) and facets per the current base contract. It binds nothing yet; the Code ⇄ Pages binding is step 4.

## GitHub sync

The Aludel GitHub App and its personal-account path exist and were proven live in PP-01B. Each project already has one app-repository binding (`repository_bindings`), created by `github.createRepository`. T03-CODE builds on that binding. It does not add a second one.

**Model.** GitHub `main` is the shared repository. Aludel's project workspace is a working clone. The Code instance's accepted commit is a commit that is on both.

| Event | Default behaviour |
|---|---|
| **New project** | Aludel creates a private repository on the account the owner picks, from the scaffold plus `.aludel/`, and pushes it. This is the existing path, plus `.aludel/` |
| **Import an existing repository** | The owner picks a repository the App installation can reach. Aludel clones it with an installation token, then shows the `.aludel/` files it will add. On confirm, it commits them to `main` and pushes. The Code instance binds to that commit, then indexes it. The other layers' drafts are not reconstructed from the code here (that is EXISTING-PROJECTS-01) |
| **A person's change in Aludel** (Knowledge save, recording a release, trace links) | One commit on `main`, then a push. If the push is rejected because GitHub moved, fetch first. Fast-forward and retry once; otherwise, divergence (below) |
| **Accepted Code Work** | The reviewed candidate is merged on `main` and pushed. Agent branches stay local; pull requests are a later collaboration choice |
| **Someone pushes to GitHub directly** | Aludel fetches when Code or Knowledge opens, after each push, and from a Sync control. GitHub's webhooks can't reach a localhost portal, so they wait for hosting. A fast-forward moves the accepted commit, re-indexes, marks trace links suspect where linked units changed, and re-checks `.aludel/` package validity. If the new `.aludel/` has authority-path changes nobody reviewed, the host keeps running the last reviewed handler until a person accepts them |
| **Divergence** (both sides moved) | No automatic merge. Code shows that the sync is held, and a Work item asks a person to rebase or merge in a run, as layer bindings handle drift. Pushes wait until it is resolved |
| **Disconnected, token expired, App uninstalled or repository gone** | The workspace keeps working locally. Code shows the sync state and how to fix it, with the same unavailable-state pattern as Deploy |

**Built generically.** The remote binding and sync state hang on the layer-instance repository, not on Code. Code turns them on in this packet. Publishing other layers' repositories is a separate decision (see the open question).

**Owner setup the live proof needs.** Since the promotion (DEC-062), the portal on :4310 is the one with the GitHub App's registered callback and its `.env` secrets. The candidate-only steps (a second callback URL and a secrets file) are gone. What remains needs the owner's GitHub account:
1. **Check the App still works.** PP-01B found the App's `.env` configuration missing once. Start the portal, sign in with GitHub and refresh installations; the agent checks only the binding metadata.
2. **Installation scope.** Importing needs the installation to reach the repository. The existing check requires "All repositories"; keep that, or the owner adds the repository to a selected list.
3. **The live round trip, run by the owner** on disposable private repositories:
   - create a project on GitHub;
   - import an existing repository;
   - save a Knowledge doc and see it on GitHub;
   - push a commit on github.com and see Code pick it up;
   - make a divergence and see it held as Work.

   The agent then verifies the results from metadata (binding rows, commits, GitHub's activity log showing the App as the pusher), never from secrets.

## Recipe (Design's, with the Code differences)

1. **Ledger first.** On the `code` branch, add `docs/migration-ledger.md` and `docs/source-inventory.md`.
   - Sources: owner decisions from `docs/design/platform-layer/work-record.md`, `docs/evidence/platform-ux-01-code-deploy.md`, and LAY-07D's code-links evidence.
   - Mark every behaviour preserved, revised with owner acceptance, or unavailable with a reason.
2. **Contract generalizations (G-CODE) on `layer-base` `main`.** These are:
   - the package root;
   - installing into an existing repository;
   - the manifest-declared writable set and docs location;
   - the host index library;
   - generic Knowledge doc checks;
   - the per-instance remote and sync state. Each one comes with a base contract test and a test on a non-Code fixture: a Markdown layer under `.aludel/` in a plain repository. This shows the change is general and not built for Code (memory `generalize-over-examples`).
3. **Template branch `code`.**
   - Manifest under `.aludel/` with the instance key `platform`.
   - Charter and method docs.
   - `api/openapi.json` for trace links and releases, with a pure handler porting today's release rules and messages unchanged.
   - The indexer.
   - `ui/`: Overview, Explorer, Tests and Releases moved from `code.ts`. Docs moves into Knowledge.
   - The adapter, and a seed for starter docs.
4. **Parity fixture.** A seeded disposable project:
   - export its `trace_links` and `code_releases`;
   - adopt it, and check that every ID, revision and commit is unchanged in the files and the Library;
   - check that units derived at the same commit match today's `code_units`.
5. **Host wiring.**
   - Pin `code` and add `"platform": "code"` to `builtIn`. Add the handler digests to the reviewed list.
   - Adopt existing projects: install `.aludel/` into `workspace_path` as one local commit, and bind the instance repository to that path.
   - GitHub sync (above) on the existing binding: create with `.aludel/`, import, push after each accepted change, fetch and fast-forward, hold on divergence, and unavailable states.
   - Fold Code › Docs into Knowledge.
   - Keep the compiled view as the templates-off fallback.
6. **Checks.** Everything in the T03-DESIGN recipe, both modes, plus:
   - `tools/typecheck-layer-ui.mjs` at the `code` pin;
   - a `code-layer` journey through the frame (Overview, Explorer down to a unit, Tests, Releases, record a release, and Knowledge showing the app docs with their checks and a save; axe and 390 px);
   - a `github-sync` journey against a fake GitHub, in a separate process as in PP-01B. It covers create, import of a repository the scaffold didn't make, push after a Knowledge save, pick-up of an external commit, divergence held as Work, expired token and uninstalled App. It also checks that no person's credential helper is used and that no token appears in logs or the database;
   - the owner's live round trip (owner setup step 3), recorded as owner-run evidence;
   - reruns of `pages`, `design-layer`, `bindings`, `library`, `layer-bar`, `layer-scope` and every Deploy view;
   - one coding run through the generic path with a local stand-in, checking that a write outside the writable set, and to `.env`, is refused.
7. **Closeout.**
   - Evidence and retrospective in `docs/evidence/t03-code/README.md`.
   - Update status and add a section to `layer-template-conversion.md`.
   - Then retire the compiled modules and `legacyDeclarations` for every converted layer, keeping Deploy's. That retirement is its own commit, so it can be reverted alone.

## Pitfalls specific to Code

- **Two repositories become one.** Today's Code layer instance (if any project has one) is a separate repository from the app. Adoption must not leave two bindings that both claim the Code instance.
- **Push identity.** PP-01B found pushes going out as the person through their `gh` credential helper. Every new git call that talks to GitHub (clone, fetch, push) uses `credential.helper=` and askpass. Test it with a planted helper.
- **Clean working trees.** The app workspace can hold uncommitted agent or person edits. Refuse install and adoption on a dirty tree, with a message, rather than committing someone else's changes.
- **Size.** Real repositories are larger than scaffolds. Index at a commit, cache by commit, and keep the existing 256 KB file limit and binary exclusions.
- **Secrets.** `.env` is never read, indexed, published to the Library or writable. A connected repository might have committed secrets. Index paths only, and do not publish file contents to the Library beyond units and docs.
- **The Symphony coding path pins `platform.implement`.** Moving it to layer scope touches `task-manifest.mjs`, `symphony-readiness.mjs` and `symphony-worker.mjs`. Keep LAY-05's retained-candidate and recovery tests green.

## Other layers' repositories (decided, DEC-062)

Every layer of the app goes to the owner's GitHub. This packet builds the sync generically and turns it on for Code. A follow-up packet, **LAYER-GITHUB-01**, turns it on for Vision, Design, Pages and Data. It covers naming (`<project>-layer-<key>`), privacy, and one live proof. It may also publish `layer-base` itself.

## After Code

- Retire the compiled built-in layer modules and `legacyDeclarations` (except Deploy's).
- LAYER-BINDINGS-01 step 4 (F10): Code ⇄ Pages, migrating `layer_connections` and the hard-coded reconciliation into bindings.
- LAT-08A layer-owned review (F3), then the LAT-09 owner comparison.
