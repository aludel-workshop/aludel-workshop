---
id: layer-scoped-work-01
kind: work-record
status: local-gate-passed
updated: 2026-09-30
---

# LAYER-SCOPED-WORK-01: layer scope replaces action declarations

- **ID / date / author:** LAYER-SCOPED-WORK-01 · 2026-09-30 · owner direction in chat, agent execution.
- **Outcome:** A Work item names the layer it may change, not an action. The layer's charter and Knowledge guide the agent. The host enforces output authority per layer and validates each output kind. Review gains a Follow-ups tab where the agent proposes work for any installed layer with a reason; each accepted follow-up becomes a Work item signed as created by that agent from that layer. Elevated (administrator) access per layer remains for accepting reviews, deciding follow-ups and layer configuration.
- **Authorized scope (owner, 2026-09-30, chat):** "I love the simpler overall implementation. Make it happen." This authorizes local records (DEC-057, contract supersession, LAT-08 rescope) and local implementation in the isolated `pages-template-candidate` checkout (branch `feature/pages-layer-template`) and the local `layer-template-pages` source repository, plus local checks. **Excluded:** provider turns, owner original data, GitHub or other external writes, deployment, release and promotion.

## Why (process first)

The DEC-051 action declaration did two jobs in one record:

1. **Guidance and structure:** purpose, method, input roles, applicability, checks, and per-style human/agent seeds. A current model derives this from the layer charter, its Knowledge, current outputs and the task text. Keeping it versioned, pinned, migrated and validated was most of LAT-08's cost.
2. **Authority:** which outputs may be written, which effects are allowed, and who can accept. Model capability does not change this, but layer scope expresses it more simply than per-action declarations.

**Reusable rule applied:** before adding a declared, versioned contract, separate *authority* (host-enforced, must be checked) from *guidance* (read by a model or person, can be plain Knowledge). Only authority needs a validated, pinned contract. Recorded in the [operating procedure](../process/operating-procedure.md#authority-versus-guidance).

## Target model

| Concern | Layer-scoped rule |
|---|---|
| Work item | Names `layer` (instance). `action` stays empty for new layer-scoped items; historical items keep their action ID as a label. |
| Guidance | Layer charter, Knowledge documents and method files from the pinned layer source commit, plus the task brief. No action method or revision. |
| Output authority | The agent may submit changes only to output kinds owned by the item's layer and registered with a host change adapter. Each change passes its owning validator. Cross-layer needs become follow-ups, not writes. |
| Reads | Project-wide reads of layer outputs and shared Knowledge (DEC-054 stays). |
| Access | Every project member has **normal** access to each installed layer (create, assign, start and perform work). **Elevated** is an explicit per-layer grant (owner always has it): accept or send back a review, decide follow-ups, set the layer default assignee. Only the owner manages grants. Agents never hold elevated access. |
| External effects | Deploy, provider/GitHub writes, spending and secrets stay separately authorized. Layer scope never implies them. |
| Assignment | One default assignee per layer, not per action and style. |
| Follow-ups | An agent submission may include up to five follow-ups `{layer, title, brief, why}` for any installed layer. The reviewer (elevated on the originating layer) creates or dismisses each one independently of accepting the main change. A created item records `createdBy {agent profile, source layer, source work item, attempt, proposal}` and starts as *suggested*. |
| Pinning at Go | Layer source commit and project repository commit. Changed inputs are rejected at submit and accept by revision checks, as today. |

## Evidence and gaps

| Requirement | Source | What it demonstrates | State | Gap |
|---|---|---|---|---|
| Actions dominate LAT-08 cost | `apps/portal/server/lat08-migration.mjs`, `layer-action-contract.mjs`, `lat06/07-actions.mjs` at candidate `0a92186` | Installations, method revisions, per-action grants and migration ledgers exist only to keep declarations consistent | Observed | — |
| Flow create/revise validators exist independent of actions | `symphony-worker.mjs` `pages.flows` branch; `layer-template-pages/server/flow-change.mjs` at `ae93312` | The authority part can be re-keyed on layer + output kind | Observed | Page and map writes have no host adapter yet |
| Other layers | Vision, Design, Data, Code, Deploy in candidate | Still action-dispatched | Open | Converted in LAT-T03 under the same contract |

## Work sequence

| Packet | Concrete work | Agent check | Stop condition |
|---|---|---|---|
| LSW-01 records | DEC-057, supersede the action contract, rescope LAT-08, status | Links resolve | — |
| LSW-02 Pages runtime | Layer grants, layer-scoped create/stage/pin/manifest/submit/accept for Pages flows, follow-up table and decision route | Server tests: create without an action, agent change set, elevated-only accept, follow-up created with agent/layer signature, cross-layer change rejected, stale input rejected, legacy `pages.flows` still works | Any authority broadened relative to today |
| LSW-03 Pages UI | Work create without an action picker for layer-scoped layers; review Changes/Follow-ups tabs; Manage › Access (elevated people, default assignee) | Typecheck and build; browser journey where feasible | — |
| LSW-04 template | Pages `layer.json` declares layer-scoped Work changes; `work-and-connections.md` drops action inventory; repin candidate | Template tests, candidate pin test | — |

## Readiness decision

- **Verdict:** ready for local implementation. Owner judgment is given in chat. Proposed defaults: normal access is implicit for members, and follow-ups start as *suggested*. Both are reversible.
- **Experimental variables:** follow-up limit (5); whether follow-ups can be decided after the main change is sent back (yes, while the proposal record exists).

## Results (2026-09-30)

- **Task outcome:** LSW-01–04 were done locally. Candidate `pages-template-candidate` commit `2e4bb58` implements layer-scoped Pages Work: host change adapters, per-layer elevated access, one default assignee per layer, the v2 task card, layer change sets, a Follow-ups review tab, and follow-up items signed as the agent's from the source layer. The Pages template `layer-template-pages` commit `07e2c74` declares `work.scope = layer` and drops its action inventory. [Evidence and retrospective](../../../pages-template-candidate/docs/evidence/lat-t02-layer-scoped-work/README.md).
- **Checks:** server suite 180/180; template 5/5; typecheck and build pass; the new browser journey passes (axe clean on Access, Create and Follow-ups; 390px without horizontal scroll). The screenshots were inspected. The `layers` browser journey fails identically on the untouched base commit, so that failure predates this work.
- **Process outcome:** the authority-versus-guidance rule was added to the operating procedure and applied. The tests show that the authority part is enforced with no action record. Whether agent output quality holds without per-action guidance is **unproven** until an authorized provider turn is compared.
- **Remaining:**
  - Page and Map change adapters.
  - Converting the other five layers (LAT-T03 now means declare `work` and register adapters).
  - The owner browser review.
  - Original data, and the signature-after-transaction gap.

## PAGES-API-01: the layer's API is its output contract (2026-09-30)

- **Owner direction and authorization (chat, 2026-09-30):** the owner sees a layer's output description as an API, like OpenAPI, that anyone must call to change its data: "build it in pages". The same local-only scope as above applies: isolated candidate and local Pages template only. No provider turn, external write or deployment.
- **Process gap being fixed:** Pages flow rules existed in three places (host record rules, template revision rule, and the DEC-057 worker create check). The output docs were prose that could drift from all three.
- **Target:**
  - The Pages template publishes `api/openapi.json` (OpenAPI 3.1). Its operations cover pages, the map and flows. Each is marked `x-aludel-output`, `x-aludel-staging: record` and `x-aludel-access`.
  - `server/pages-api.mjs` is the one home of the Pages record rules: normalize plus operation handlers.
  - The host validates request bodies against the spec's JSON Schemas and runs only the reviewed handler source, in the limited child runner.
  - The host checks that every write is a Pages output in this instance, and that declared references exist.
  - Human edits call the operations and apply immediately. Other host paths that write Pages records use the same normalize.
  - An agent's calls stage into its run's draft. Review shows each record's changed fields. Acceptance commits the draft only if every record it read or wrote is unchanged and every reference still exists.
- **Excluded from this slice:**
  - Page deletion, which keeps its host route and rules.
  - Agent edits to the layer repository (docs or code as Git commits), noted as the next slice.
  - Other layers.
  - A tested Symphony build of the new `aludel_layer_call` tool, because no Elixir toolchain is available locally.
- **Checks planned:**
  - Template handler tests.
  - Host tests: schema rejection, cross-instance and wrong-kind writes denied, UI record routes going through operations, agent draft → review → accept, and stale-base rejection.
  - Full server suite, typecheck and build.
  - A browser journey covering review field diffs and human edits.

### PAGES-API-01 results (2026-09-30)

- **Task outcome:** Pages template `3b647bb` publishes `api/openapi.json` and `server/pages-api.mjs`. Candidate `3e2b1b2` makes the API the only path for Pages data:
  - people's edits run the operations at once;
  - every host write uses the layer's rules;
  - agents stage calls with `aludel_layer_call`, and review shows changed fields;
  - acceptance commits the draft only if its bases and references are unchanged.
  
  [Evidence and retrospective](../../../pages-template-candidate/docs/evidence/pages-api-01/README.md).
- **Checks:** server 181/181; template 8/8 including spec/handler agreement; typecheck and build pass; the layer-scope browser journey passes; layer-bar passes with and without the template.
- **Process outcome:** the output contract, the enforcement and the agent's instructions are now one document plus one handler, with an agreement test. Registering handler review is still a manual config entry.
- **Not done:**
  - A compiled or live Symphony tool (no Elixir toolchain).
  - Deletion through the API.
  - Agent edits to the layer repository.
  - `commit` and `effect-plan` staging for Code and Deploy.


## LAYER-SOURCE-01: agents edit their layer's repository (2026-09-30)

- **Owner direction and authorization (chat, 2026-09-30):** "go ahead and set up repo edits". The same local-only scope applies: isolated candidate and local Pages template/instance repositories only. No GitHub or other external write, provider turn or deployment.
- **Target (DEC-056 source modality):**
  - A layer-scoped run reads and edits its installed instance's repository files through `aludel_layer_source`. Edits stage per run.
  - At submission the host writes one real Git commit on top of the pinned commit, kept at `refs/aludel/candidates/<attempt>`. It does not touch the checkout or the pin.
  - Review shows file diffs.
  - Acceptance applies any staged data first, then advances the instance pin to that commit in the same transaction.
- **Authority split:**
  - Knowledge and docs files are guidance: an elevated reviewer can accept them.
  - Files that run or define authority (`server/`, `ui/`, `api/`, `layer.json`, `tests/`) need the **project owner**. Accepting them records the handler digests as reviewed for this project.
  - Before acceptance, the new handler must re-normalize every current record of the layer against the new schemas, so a rule change cannot strand existing data.
  - Handler review is keyed by source digest, not commit, so a doc-only commit keeps its reviewed handler.
- **Excluded:**
  - Human editing of layer repository files from the UI.
  - Pushing the instance repository anywhere.
  - Per-project UI bundle loading (a `ui/` change is recorded and pinned, but the candidate portal still builds UI from the template pin).
  - A compiled Symphony tool (no Elixir toolchain).

### LAYER-SOURCE-01 results (2026-09-30)

- **Task outcome:** candidate `6fe9f2b` lets a layer-scoped run edit its instance repository through `aludel_layer_source`.
  - Submission writes one retained candidate commit on the pin.
  - Review shows file diffs.
  - Acceptance moves the pin, in the same transaction as any staged data.
  - Code, API and manifest changes need the project owner, record the handler's source digest as reviewed, and must re-accept every existing record.
  
  [Evidence and retrospective](../../../pages-template-candidate/docs/evidence/layer-source-01/README.md).
- **Checks:** server 184/184; typecheck and build pass; the browser journey passes with a Knowledge edit reviewed and accepted; layer-bar passes with and without the template.
- **Process outcome:** handler review is keyed by source digest across the API and flow runner, so doc commits no longer disable reviewed code.
- **Not done:**
  - A compiled Symphony tool.
  - `ui/` changes taking effect (per-project UI loading).
  - Running layer `tests/`.
  - Push or upstream template merges.
  - UI editing of repository files by people.


## LAYER-BASE-01: one base layer repository; templates are its branches; every instance is a fork (2026-09-30)

- **Owner direction and authorization (chat, 2026-09-30):**
  - Adding any layer creates a repository for that instance, forked from the base layer or a template.
  - Keep one base layer repository and recreate the templates (markdown, pages) as branches from it.
  - Implement repo edits, the layer API, build-from-own-repo, merge-request acceptance and sandbox testing for the base layer. Prove them with the Markdown template, then validate Pages.
  - Review is always elevated, for any mix of repo and data changes.
  - Template updates reaching existing instances, and repo edits from the UI, are deferred.
  - Scope stays local: the candidate and local repositories. No push, provider turn or deployment.
- **Current state (inspected):**
  - Custom Markdown layers have no repository. Their files live under `layer-outputs/` plus `markdown_*` tables, with a host-coded editor.
  - Only Pages has an instance repository, cloned from `layer-template-pages`.
  - Pages UI is compiled into the portal from the template pin.
  - Instance scoping, API routing and record-route mapping are Pages-specific.
- **Work sequence (dependency order):**

| Packet | Work | Agent check | Stop condition |
|---|---|---|---|
| B1 base repo | `layer-base` repository. `main` is the base layer: a manifest with no outputs yet, charter template, layer contract docs, an agent guide and a generic contract test. Branches `markdown` and `pages` recreate those templates on top of `main`. | Each branch passes its own tests | — |
| B2 fork on add | Adding any layer (built-in or custom) clones the base repository at its template branch into a per-instance repository whose `main` records the origin, with an install commit that sets key and name. The catalog pins template branches to commits. | New Markdown and Pages instances each get their own repository; the manifest key matches the instance | — |
| B3 generic host | Any installed layer that publishes an API owns its record kinds. Instance scoping, host write routing, record-route operation mapping and handler catalogs come from the layer's declarations, not from Pages names. | Pages tests still pass through the generic path | Any widened write |
| B4 Markdown on its API | The Markdown template publishes document and folder operations. Its outputs become instance-scoped records. The host Markdown editor calls the API. Existing Markdown files migrate. | Markdown tests and browser journey | Data loss in migration |
| B5 branch → merge | A run's sandbox gets its instance repository on a work branch plus an export of the layer's current outputs. The agent edits, commits and runs the tests there. Submission fetches the branch with its test results. Review shows the branch diff and results. Accept merges the branch into the instance's `main` (refused if not clean) together with any staged data. The pin is `main`. Review is elevated only. | Worker and workspace-hook tests; merge, conflict and stale cases | — |
| B6 UI from own repo | Each instance's UI is built from its own `main` and served in a sandboxed frame on a separate origin through the host SDK. Layers without custom UI use host views derived from their API. | Browser journey on two instances with different UI | Layer UI able to read portal session or other projects |
| B7 validate Pages | Pages instances fork the `pages` branch. The full Pages suite and browser journeys pass on the generic path. | Suite and browser | — |

- **Readiness:** B1–B3 are ready. B4 depends on B3. B5 depends on B1–B2. B6 has an open design choice: sandboxed frame versus in-portal loading. The recommended default is a sandboxed frame, because agent-edited UI must not run with the reviewer's session. B7 depends on all of these.

### LAYER-BASE-01 results so far (2026-09-30)

- **Done locally:** B1–B5 and B7 (Pages validated on the generic path, UI excepted). Candidate `1d31c10` + evidence; base repository `layer-base` (`main`, `markdown`, `pages`). [Evidence and retrospective](../../../pages-template-candidate/docs/evidence/layer-base-01/README.md). Server 188/188, hook 2/2, template branches pass their own tests, and the browser journeys pages / layer-bar / markdown-editor pass with and without templates.
- **Owner-directed changes applied:** review is elevated for any change; work is a sandbox branch with test results; accepting merges it.
- **Open, needs owner choice (B6):** how each instance's own `ui/` runs:
  - (a) a sandboxed frame on a separate origin with a message-based host SDK, which is safe for agent-edited code but needs the Pages UI reworked to the SDK;
  - (b) compiling each instance's UI into the portal, which is quicker but runs agent-edited code with the reviewer's session.
  
  Recommended: (a), with host views derived from the API for layers without custom UI.

### LAYER-BASE-01 B6 results (2026-09-30)

- **Owner decision:** option (a), a sandboxed frame, "so long as it doesn't negatively affect the actual UX too much".
- **Task outcome:** candidate `e2a2cc7`.
  - Each instance's views are built from its pinned `main` and served from that instance's own origin into a sandboxed frame.
  - The frame runs the portal's own `ProjectContext` over messages, and the server allows only project reads, the layer's own API and records, Work creation and Pages' host features.
  - The full Pages journey passes inside the frame 3/3, and in the portal with templates off.
  - Six UX regressions the frame introduced were found by that journey and fixed.
  - First render is 214 ms versus 135 ms median locally.
  
  [Evidence](../../../pages-template-candidate/docs/evidence/layer-base-01/README.md#b6-layer-views-from-their-own-repository-in-a-sandboxed-frame-owner-chose-option-a).
- **Process outcome:** the existing full browser journey, run unchanged in steps against the new runtime, was the effective UX gate; unit tests alone found none of the six regressions.
- **Remaining:**
  - Views derived from a layer's API, for layers with outputs but no `ui/`.
  - Drag tracking outside the frame.
  - Compiled Symphony tools.


## LAYER-TOOLS-01: test the Symphony layer tools (2026-09-30)

**Authorization (owner, chat, 2026-09-30):** "can you handle testing the agent tools? don't worry about existing projects, nothing but little tests so far." Scope:
- compile the candidate's Symphony overlay (`adapter.ex` plus both patches) at the pinned upstream commit, in a scratch copy of an existing local build, using the local `elixir:1.19` image;
- exercise `aludel_layer_call` and `aludel_layer_commit` through the compiled adapter against a disposable candidate portal (scratch data directory), with no model turn;
- then one bounded live Codex turn (ChatGPT Plus login already on this machine, no incremental cost; one run, one attempt) on a disposable layer-scoped task, through the full sandbox → branch → review → merge path;
- fix what the tests find in the candidate and its evidence.

Out of scope: the running `aludel-symphony-*` hosts and the main workshop portal (left untouched), push, deployment, any spending.

### LAYER-TOOLS-01 results (2026-09-30)

- The overlay compiles with `--warnings-as-errors` at the pin; upstream's suite passes with it (299 tests, 0 failures, 6 skipped).
- Candidate `7e28aff` adds `integrations/symphony/layer-tools-check/run.sh`. From a clean start, it runs the real hook and both tools through the compiled adapter against a disposable portal, then has the owner accept over HTTP. It passed: the data was applied and the branch merged into the instance's `main`.
- The host prompt now routes layer tasks to their card; the README is corrected.
- Evidence: `pages-template-candidate/docs/evidence/layer-tools-01/README.md`.
- **Not run:** a live Codex turn. The session's permission check refused starting an agent host with the owner's Codex login. It needs explicit owner go-ahead, or a permission rule for that command.

**Live-turn authorization (owner, chat, 2026-09-30):** "i authorize the agent use." Scope:
- one live Symphony host (the pinned build plus the candidate overlay; Codex 0.157 with the machine's existing ChatGPT login, read-only);
- the same container security as `local-hosts` (seccomp unconfined, no-new-privileges);
- against a disposable candidate portal, on the seeded layer-scoped Pages task "Map how a neighbour borrows a tool";
- one attempt; stop the host after its first run ends;
- owner-side review over HTTP in that disposable portal only.

No other projects, hosts, push or spending.

**Storage decision (owner, chat, 2026-09-30):** "platform level db it is". Layers do not get their own databases. Layer data stays in the platform database, and the layer boundary stays logical: instance-scoped records, changed only through the layer's API.

### LAYER-TOOLS-01 live turn (2026-09-30)

The owner started the host with the prepared command; the session's permission check still refuses to start agent hosts itself. It ran W-2 in one run of about 2 minutes:
- Staged the flow and the page description through `aludel_layer_call`.
- Ran the layer tests.
- Made no repository edit: the method already says to name the goal first, which I verified.
- Proposed one follow-up, with a reason.

Owner acceptance applied the data. The follow-up became W-9, signed as the agent's from Pages. The host and portal were stopped and the scratch data removed. Candidate `ec17c76`.

Open:
- a live run of `aludel_layer_commit`;
- structured per-criterion checks for layer submissions.

## LAYER-TOOLS-02 and PROJECT-DB-01 (2026-09-30)

**Owner direction (chat, 2026-09-30):** "yep, i want layer submissions as review items. run again with a task requiring a real (but minimal) change. database, one db per project: yes. need to make that happen too."

Scope, all local in the isolated candidate:
1. **LAYER-TOOLS-02 review items.** A layer submission carries per-criterion evidence, and review shows each criterion with the agent's evidence, as coding review does. This changes the task card, the proposal intake and the review UI, with tests.
2. **LAYER-TOOLS-02 live rerun.** A second disposable live turn, on a task whose criteria require a minimal real change to the layer's repository, so that `aludel_layer_commit` runs live. Same conditions as the first live turn: the owner starts the host with the prepared script, one attempt, and the host is stopped after its run.
3. **PROJECT-DB-01.** Implement DEC-056's database-per-project target, confirmed by the owner:
   - platform state stays in the platform database;
   - each project's data moves to its own SQLite file;
   - existing data migrates;
   - accepting a review commits in one transaction within the project database.

No push, deployment, spending or change to the main workshop portal's data.

### PROJECT-DB-01 design and readiness (2026-09-30)

**Inventory.** The fully initialized candidate schema has 87 tables. Classified with the SQL scan (`scratchpad/sqlscan.mjs`, to be kept as a check):
- **Platform (stay in `machine.sqlite`):** `projects`, `users`, `sessions`, `auth_config`, `login_tickets`, `github_identities`, `github_sign_ins`, `github_user_installations`, `onboarding_drafts`, `project_members`, `project_setup`, `symphony_pools`, `symphony_worker_tokens`, `editor_tokens`. These cover identity, routing, membership and the credentials that resolve a request to a project.
- **Project (move to `projects/<id>/project.sqlite`):** everything else. That includes the child tables with no `project_id` (revisions, events, run steps), which belong to their parent's project.

Statement counts in the server: 146 platform, 609 project, and about 4 genuinely mixed (joins of `projects` or `project_setup` with layer tables in `server.mjs`). 38 are built dynamically and are checked at runtime.

**Mechanism: a routing store.** The owner delegated physical placement (DEC-056).
- `openDatabase(path)` returns a store with the same `prepare`/`exec` surface the ~40 modules already use.
- Each statement is classified by its tables once, when it is prepared.
- Platform statements run on `machine.sqlite`. Project statements run on the current project's database, which is set with `withProject(projectId, fn)` (AsyncLocalStorage) at each entry point: API routes, worker routes, app/layer hosts, and startup and background loops.
- A project statement with no current project is an error, not a guess. Cross-project scans must become explicit per-project loops, which enforces DEC-056's scope.
- A mixed statement is refused at prepare and rewritten as two queries.
- Project schema DDL is recorded and replayed on each project database when it opens; references to platform tables (`REFERENCES projects(id)`, users) are dropped there.
- Transactions (`BEGIN`/`COMMIT`) run on the current project's connection. Review acceptance (layer data, Work state, follow-ups, pins) is all project tables, so it stays one transaction, as DEC-056 requires.

**Slices, in dependency order:**
1. Routing store, classification and schema replay, with unit tests.
2. Project context at every entry point; fix the mixed and cross-project statements the suites expose.
3. One-time migration of existing data: back up, copy each project's rows (children through their parents), verify counts, drop moved tables from `machine.sqlite`. It is idempotent.
4. Full server suite, browser journeys, the tools check and a migration test on seeded data.

**Readiness:** ready. Evidence gaps: the dynamic SQL, and background paths no suite covers. Both fail loudly under the routing store rather than silently mixing data.

### LAYER-TOOLS-02 and PROJECT-DB-01 results (2026-09-30)

- **Review items (candidate `9e90a61`).**
  - Layer task cards ask for evidence per criterion, and the adapter's submit tool says so.
  - Review resolves a record by ID or title, a committed file by path, and a test by the name reported to `aludel_layer_commit`. Unmatched references are shown as missing.
  - Covered by the proposal tests (34/34) and the layer-scope browser journey. The journey includes the evidence steps and a screenshot.
- **Per-project database (candidate `614de3a`).**
  - Server suite 197/197; browser journeys pass; the tools check passes.
  - Rehearsal on a copy of real data: 1,882 rows moved, with counts matching; the server started on the result.
  - Evidence: `pages-template-candidate/docs/evidence/project-db-01/README.md`.
- **Live rerun.** Prepared (disposable portal, task C "Name flow steps with verbs"). It waits on the owner starting the host.

**Live rerun 1 (task C, 2026-09-30).**
- **What happened.** The agent ran one turn and submitted a read-only proposal. It described the method change and the description in its notes, and did not call `aludel_layer_call` or `aludel_layer_commit`. Its evidence honestly marked every criterion as not met.
- **Cause.** Its Codex transcript shows it decided this in its first message. The issue description the portal generates told every non-coding task "Submit a review proposal; do not change project records or files", including layer tasks.
- **Fix.** Candidate `a4f42d3` gives layer tasks a brief that says to make the changes with the layer tools, with a test.
- **Why the first live run worked.** It had the same wording and followed the card anyway, so that success was partly luck.
- **Next.** A fresh disposable portal is running on the current code, including the per-project database. The same task is authorized, and the rerun waits on the owner starting the host.

**Live rerun 2 (2026-09-30).** On `a4f42d3` with per-project databases, the agent:
- staged the description;
- committed the verb rule (`56a08ed`) after the layer tests passed;
- gave evidence for all three criteria, all of which resolved in review.

The owner accepted: data applied, `main` fast-forwarded, pin updated. Host and portal stopped, scratch data removed. Evidence: `pages-template-candidate/docs/evidence/layer-tools-02/README.md`.

Open: Aludel re-running the layer tests on the branch before review.
