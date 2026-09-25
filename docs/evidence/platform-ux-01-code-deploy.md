---
id: evidence-platform-ux-01
kind: evidence
status: agent-checked
updated: 2026-09-24
depends_on: [platform-ux-01]
---

# PLATFORM-UX-01: Code and Deploy, built

The owner answered v2's questions and said "godspeed" (DEC-049). This page is the evidence for the build and its retrospective. The build has been checked by the agent; owner review is pending. Design history: [work record](../design/platform-layer/work-record.md), [prototype v2](../design/platform-layer/v2/index.html).

## What was built

| Ledger | Built |
|---|---|
| C1, R12, R16 | Platform is now two layers. **Code** (blue) keeps the internal key `platform` and is served at `/code/…`. **Deploy** (indigo) is a new `deploy` layer. Old `/platform/…` links still open: the environments, database and domains tabs go to Deploy, and the rest go to Code. A new **Operator** role owns Deploy: `deploy.configure` (moved from the Engineer), `deploy.promote` and `deploy.rollback` (both elevated), and `deploy.review`. Existing projects' configure action record, its assignee and its open work move with it |
| R7 | **Code › Overview**. A structure map is derived from the repository's own folders (Web app, API server, Database, Tests, Container). Each part carries its stack from `package.json` and the `Dockerfile`, with a health bar and chunk count. The selected part shows its chunks, suspect ones and handlers first. Outside services link to Deploy › Integrations. Also on the page: code health, stories × chunks × scenarios with a test, docs status, the latest release, and "as of main @ commit" |
| R1, R2, C3 | **Code › Explorer** has one tree: folders → files → chunks (the LAY-07 code units). A file opens whole in a read-only viewer with light highlighting. A chunk scrolls to and highlights its lines, and a gutter marks which chunk owns each line. The inspector shows why it exists (links with Changed or Current), calls and called-by, tests and open work. Filters are Suspect, Untraced, Unused and Untested. "Highlight code for…" lights one record's chunks across files. **Request a change** creates `platform.implement` work, with the chunk's records as targets. The code index now stores each chunk's end line |
| R11, R15 | **Code › Tests** lists each story's Given/When/Then scenarios and the tests named for them. `S4/2 · …` checks scenario 2 and `S4 · …` the whole story; tests linked at an older story revision are marked. Other tests are listed by file without being treated as a problem. A scenario can get a change request, and "Ask for tests for N scenarios" creates Engineer work. Results say "not reported yet", because no CI results reach Aludel yet |
| R8–R10, R13, R14 | **Code › Docs** reads `AGENTS.md`, `ARCHITECTURE.md`, `README.md` and `docs/` from the repository and renders them. The checks strip covers docs off the map, broken relative links, AGENTS.md length and sections that need a refresh. Each section's sources come from `docs/.aludel/sources.json` as record id and revision, so a newer revision marks the section. A source that is a finding or insight shows the records it is also evidence for. **Write a starter set** writes `ARCHITECTURE.md`, `docs/product/`, `docs/design/DESIGN.md` and `docs/data/` from the layers and adds a "Where to look" map listing every doc. It never overwrites an existing file. "Ask the Engineer to refresh it" creates `platform.docs` work with the changed sources as targets |
| R3, R6 | **Code › Releases** is explicit. The next release shows the commits since the last one, the stories their `Implements:` trailers name (for the first release, the stories already built), stack changes from `package.json` at each commit, new migration files and a suggested version. "Record" stores the version against the commit. Publishing to GitHub (tag, Release, Packages) is shown as not set up |
| R12 | **Deploy › Environments**. Preview has Overview (status, commit or release, health, address, rebuild, build log), History (every preview build, with the release it matches) and Settings (hosting, leaving Aludel). Production is shown as not set up; "Ask the Operator to propose one" creates `deploy.configure` work. **Variables** come from `.env.example` (descriptions from its comments, secrets flagged), with Preview values and Production shown as not set up. **Integrations** cover domains, file storage (data volume), and each service the stories need, with its stories and an "Ask the Operator to choose a provider" action. **Data** holds the old database views (health, backups and restore, schema, browse, query) unchanged |
| — | Moved or dropped: the Dependencies and Changes tabs (R3, R5). The Architecture "binding" table (Data record → table or handler) is dropped; the Explorer lens covers "code for this record" |

## Checks (agent, 2026-09-24)

| Check | Result |
|---|---|
| `node --test tests/*.test.mjs` | **88 of 89 pass.** The failure is pre-existing: `tools/delete-project.mjs` has a shebang but isn't committed executable (`git update-index --chmod=+x`). It was there before this work |
| New `tests/code-layer.test.mjs` (4 tests) | Source reads only tracked text files (`.env`, untracked files, `..` paths and empty paths are refused); stack and `.env.example` parsing; starter docs never overwrite a developer's file and cite no sources for it; a story revision marks its sections for a refresh; off-map docs and broken links are found; explicit releases (first release, trailer stories, stack diff, migrations, version rules); the Operator role and the migration of an older project's configure action and open work |
| `tests/lay-04.test.mjs`, `tests/onboarding-browser.mjs` | Updated for the `deploy` layer and `deploy.configure` |
| `tests/icon-subset.test.mjs` | It read only the top level of `src/`, so layer files were never checked. **Fixed to read recursively**, and it then caught 4 missing icons. The subset was rebuilt (`tools/subset-icons.py`): 6 icons added, none removed |
| `tools/browser-checks.sh layers` | **Pass**, with axe on each screen: code-overview, code-explorer (chunk opened, highlighted, read only), the story lens across files, a refused path over HTTP, code-tests, code-docs (starter set written, sources shown, every doc on the map), deploy-environments (health 200), code-releases (v0.1.0 recorded and "Running in Preview"), preview history showing v0.1.0, deploy-variables, deploy-integrations, and database backup, restore, masked browse and guarded query through the old `/platform/database` link. The 390 px sweep covers `/code`, `/code/explorer`, `/code/tests`, `/code/docs`, `/code/releases`, `/deploy`, `/deploy/variables`, `/deploy/integrations` and `/deploy/data`, with no overflow and clean axe |
| `browser-checks.sh onboarding design pages product brand github workflow` | All pass |
| `npm run typecheck`, `npm run build` | Pass (two NG8107 warnings on optional chains in `code.ts`) |

Screenshots: `apps/portal/test-results/layers/code-*.png` and `deploy-*.png` (not committed; regenerated by the browser check).

**Found by looking at the screenshots, not by the checks, and fixed:**
- Scrolling to a chunk also scrolled the page.
- The lens dropdown sized itself to its longest story title and pushed the inspector off screen.
- The inspector's column grew to its widest chip.
- The Container part listed its image twice (two `FROM` stages).
- The side cards stretched to the main column's height.
- The global `h3` style uppercased doc headings.
- The first release listed every package as "added".
- Four icons rendered as letters.

## Limits and what is not claimed

- **No test results.** Nothing runs a generated app's tests and reports them yet. Tests shows linkage, not pass or fail.
- **Publishing releases** to GitHub (tag, Release, GitHub Packages) is not built. It is a GitHub write that needs owner authorization. Promote and rollback exist as Operator actions but have no Production to act on.
- **Production, staging, per-environment variable values and providers** are shown as not set up. They wait for PP-01D/E and owner decisions on hosting and spending.
- **Docs sources** can be recorded by the starter set or by hand in the sidecar. There is no editor for them in Aludel. Findings as sources work (they render and show their other uses), but no flow yet turns a code session's findings into Library records.
- **The scaffold's `AGENTS.md` is 277 lines**; harness engineering suggests about 100. The Docs checks flag it, but the scaffold was not changed.
- The starter set writes files into the workspace; they are committed with the next build, like the AGENTS.md export.
- Owner review of the built layers is pending.

## Round 3 (2026-09-24): releases to GitHub, CI results, AGENTS.md as a map

The owner authorized publishing releases to each project's own connected repository, and adding the App permissions CI needs. The owner also said AGENTS.md "gets initialized with the readme … can be added to as we go, part of the docs" (work record, Round 3).

**Built:**
- **Scaffold.** `AGENTS.md` is a short map written from the README: where to look, how to run it, and "add a line for each doc".
  - It is written once and never regenerated. The old generated guide (starting "# Agent guide for") is replaced by the map on the next build; git history keeps the old file.
  - The generated guide is now `docs/agents.md`, with its links fixed for its folder. Work › Agents exports that file.
  - Apps get `"test": "node --test"`.
  - `.github/workflows/ci.yml` runs the tests (spec output, plus JUnit into a `test-results` artifact) and the build on every push and pull request.
  - `.github/workflows/release.yml` builds the image when a release is published and pushes it to `ghcr.io/<owner>/<repo>:<tag>` and `:latest` with the repository's own `GITHUB_TOKEN`. Both keep working without Aludel.
- **Workflow permission guard.** Push tokens ask for Workflows write and fall back to contents-only. While the App lacks the Workflows permission, the build leaves the workflow files out, because GitHub would refuse the whole push.
- **Publish.** Code › Releases has "Publish vX to GitHub". It creates the tag and a GitHub Release on the bound repository with a contents-only installation token, using notes, shipped stories and stack changes as the body. The URL is recorded.
- **CI results.** `GET /code/ci` finds the commit's `ci.yml` run and reads its `test-results` artifact: a zip, read with Node's zlib and no new dependency, then parsed as JUnit. Code › Tests shows the run state, green or red per test, and each scenario's result; the Overview counts them. Each missing prerequisite is shown in plain words: no repository, no permission, or no run yet.
- The GitHub App setup in `apps/portal/README.md` now lists Workflows (read and write) and Actions (read), and says installations must accept new permissions.

**Checks (agent):**
- Server tests pass 93 of 94; the one failure is the pre-existing file mode on `delete-project.mjs`.
- New `tests/ci-releases.test.mjs`:
  - unzip and JUnit parsing;
  - the release request (body, contents-only token);
  - CI results picked from the `ci.yml` run and its artifact;
  - with only Contents granted: contents-only push token, `canPushWorkflows` false, "no-permission" results;
  - AGENTS.md is a short map.
- `code-layer.test.mjs` adds: a starter set joins an existing map rather than adding a second.
- Typecheck, build and all eight browser suites pass.

**Not verified live:**
- No live GitHub run yet. The App doesn't have Workflows or Actions permission until you add them and each installation accepts.
- Unverified until then:
  - a real release;
  - the release workflow pushing to GHCR;
  - reading a real artifact (the redirect to GitHub's blob storage).
- Private packages count against GitHub Packages storage. GitHub documents 500 MB for Free accounts; I haven't checked that against current billing docs.

## Retrospective

1. **Harder than necessary:**
   - The first browser run failed on a stale `dist/`: the build had run before a template typo was fixed. The build succeeded anyway, and the component fell back to JIT at runtime ("JIT compiler unavailable").
   - The icon test silently skipped `src/layers/`.
   - Several layout defects (grid items sized by their content) passed axe and the scripted checks, and showed only in screenshots.
2. **What would make the next pass easier:**
   - Run `npm run typecheck` before `npm run build`. The build doesn't fail on template errors; typecheck does. That was observed here, and it is now the order in this record.
   - Look at every screenshot a browser check writes, not only its pass line. That caught eight defects this time.
3. **Roadmap and architecture:**
   - Tests needs CI results to be useful. The cheapest route is probably the app's own GitHub Actions check runs read through the GitHub App, which needs a new permission (checks: read).
   - Publishing releases needs owner authorization for tag and package writes.
   - The scaffold should write a short `AGENTS.md` that maps into `docs/`, with instructions split into docs. That's a scaffold change for a follow-up.
   - DATA-PLATFORM-UX-01's Platform half is absorbed here.
4. **Questions** (for the owner review; they block nothing already built):
   - May Aludel publish releases to GitHub (tags, Releases, Packages)?
   - Should the scaffold's `AGENTS.md` become a short map?
   - Should Aludel read CI check runs from GitHub?
5. **Process change:**
   - Applied and tested: the icon-subset test now reads `src/` recursively, and it caught 4 real misses on its first run.
   - Applied: `tools/capture-refs.mjs`, tested during the research rounds (work record §1).
   - Hypothesis until the owner reviews: that "Code as a reference layer" answers what developers and owners come to it for.
