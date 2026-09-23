---
id: lay-07-evidence
kind: evidence
status: agent-checked
updated: 2026-09-22
depends_on: [portal-layers-implementation-plan, portal-layers-knowledge-structures, portal-layers-data-platform-research]
---

# LAY-07: Data layer, Platform operations, Work › Agents, code links

## Authorization and scope

- **Source:** owner in chat, 2026-09-22, after the DEC-038 documentation and prototype v3 were delivered: "can you handle lay-07 for me?"
- **Reading:** this authorizes building LAY-07A–D locally as the [implementation plan](../design/portal-layers/implementation-plan.md#lay-07-in-detail-built-2026-09-22) describes them. The plan gated the build on a separate owner review of v3. The owner asked for the build without that review, so V3-REVIEW becomes a review of the built layers. v3 stays the visual reference.
- **In scope:** portal server, UI and config changes; domain and browser tests; local preview builds; backups and restores of local preview databases; updates to the layer docs and status.
- **Excluded:** provider or model calls, spending (every profile's budget stays 0), GitHub writes beyond the existing flow, hosting, DNS and public deployment. LAY-04 automation is also excluded.

These results are agent-checked. The owner has not yet used the new layers.

## What exists

| Sub-packet | Result |
|---|---|
| **A: Data layer** | New record kinds `data_object`, `data_operation` and `access_rule` in `server/knowledge.mjs`. Each has a structural validator: JSON Schema 2020-12 keywords and types, required fields that exist, `$ref` and relation targets that are objects in the same project, `operationId`/method/path shapes, and allow/owner/deny effects. The Accounts pack in `config/story-packs.json` now describes exactly what aludel-web-v1 generates: `Account {email, name}` and `Session`; `getSession`, `signUp`, `signIn`, `signOut` and `health`; five access rules. These arrive accepted. Messaging and Profiles bring proposed objects. Status is derived, never stored: proposed → contracted (accepted) → built (linked code) → shipped (a production release; none locally). `GET /api/projects/:id/openapi.json` exports OpenAPI 3.1 with `components.schemas` from objects. UI `src/layers/data.ts`: **Objects** (relationship map, detail with fields, relations, lifecycle, JSON Schema view, add field/relation, accept, delete when unreferenced), **API** (operations grouped by object, detail, generated example request/response, `openapi.json`), **Access** (roles × object/action matrix with rule sentences). Rail: Home, Product, Design, Pages, **Data**, Platform, Work. Search covers objects and operations |
| **B: Platform tabs** | `server/platform-ops.mjs` and `src/layers/platform.ts`, with tabs Overview, Architecture, Code, Repository, Releases, Environments, Database, Domains. The Connections tab is gone: GitHub moved to Repository, agents to Work › Agents. **Architecture:** the stack, the binding (object → table, operation → handler, read from code links) and runtime services from story `services` (email for password reset), shown "Not connected". **Releases:** one per preview build (`releases` table) with Build and Health check results and the stories that have code links. Production shows as unavailable. **Environments:** a live `/api/health` probe with response time. **Database** (preview `.data/app.sqlite`): integrity check, size and row counts; backups before every release and on demand; restore behind an inline confirmation, which stops the preview and takes a fresh backup first; schema from `sqlite_master`; browse the first 50 rows; read-only query (one `SELECT`, 200 rows, read-only connection). Secret columns (`hash|salt|token|secret|password`) are dropped on the server, and queries that name them are refused. **Domains:** `<slug>.<base>` for preview; custom domains need hosting |
| **C: Work › Agents** | New kinds `agent_profile` and `project_instructions`. Five default profiles (Product lead, Design lead, Architect, Coding agent, Reviewer) come from `config/agent-profiles.json`. Every work type (now including `reconcile`) goes to exactly one profile, the budget is 0 and the account is the project's single connection (DEC-034). Existing projects get them at start-up. Assigning an agent picks the profile working style routes that type to (or a named one). The work item stores `profile_id` plus pinned instruction revisions: principles, project, role and work-type guidance. Work tabs: Queue, **Agents** (accounts through the shared connection component, project instructions, profiles table, profile page with editable role instructions and history), Routines, Working style (with **Who takes each kind of work** routing). "Export AGENTS.md" writes project instructions, profiles and the commit/test conventions into the workspace; the next build commits it. No provider is called |
| **D: Code links** | `server/code-links.mjs`: `code_units` and `trace_links` tables. The index uses the TypeScript parser to find functions, classes, Angular components, consts, route entries, HTTP handlers, SQL tables and tests. It resolves references through imports, SQL table names and containment, and marks what is reachable from `src/main.ts`, `server/server.mjs` and the tests. It runs after every build and on demand. **Declared links:** `skeletonFiles` now returns a generation manifest (pages → routes; template stories → `App`; operations → handlers; objects → tables). `commitWorkspace` accepts `Aludel-Work`/`Implements` trailers, and the indexer links the innermost units a trailer commit changed, at the record revision current at commit time. Test names that start with a story ref (`S4 · …`) link as tests. **Propagation:** a content revision (not a move) of a linked record makes its links suspect and opens exactly one Reconcile item. The item's page shows the field diff, the linked units with callers and callees, and tests. Closing it relinks at the new revision. A rebuild regenerates derived code (pages) and closes their Reconcile items. **UI:** Platform › Code (coverage for the current phase, state filters, unit list, unit detail); "Built by" in the story drawer, page aside, Data object and operation; a suspect count on Home |

## Checks (2026-09-22, Node 24.14, Playwright 1.61.1)

| Check | Result |
|---|---|
| `npm run test:server` | **44/44.** Twelve are new in `tests/lay-07.test.mjs`: the Accounts contract matches the template; validators and references; OpenAPI shape; pack removal keeps edited Data records; profile routing, pins and AGENTS.md; the index on a real generated skeleton (every manifest entry matches a unit: 8 Accounts units plus one route per generated page; a dead export is unreachable; a test name links); suspect propagation with one Reconcile item across two revisions, and relinking on close; a rebuild resolving page reconciles; trailer links at commit-time revision; database health, masking (values absent from responses), query guards, the row limit, backup outside the repository, confirmed restore; release checks |
| `npm run typecheck`, `npm run build` | Pass. Typecheck prints 8 warnings, all NG8107 optional-chain warnings on lines that existed before this packet (`pages.ts:33`, `work.ts:37`) |
| `tests/layers-browser.mjs` (extended) | Pass. The existing flow, plus: Data objects (add object, field, relation, accept contract), API detail and exported `openapi.json`, Access; every Platform tab; a real sign-up in the generated app, then database health, backup, confirmed restore, browse with hidden salt/hash, a `SELECT` and a refused `DELETE`; an agent profile edit, AGENTS.md export and routing; editing template story S1 → suspect code on Home → a Reconcile item with its diff and blast radius → assigned to the Coding agent with pinned instructions → done → fewer suspect units. axe WCAG A/AA is clean on 23 views. There is no horizontal overflow and axe is clean at 390px on 10 paths, including Data, Platform › Code/Database and Work › Agents |
| All browser scripts (`tools/browser-checks.sh`) | layers, onboarding, product, brand, github and workflow pass. `tests/browser.mjs` fails at its decision-conflict step, as on the baseline (pre-existing, documented in LAY-02/03) |
| Screenshots reviewed | Data objects and API, Platform code unit, database browse and the Reconcile item were read at 1440px. Two fixes came from them: the Account binding row also listed the sign-up handler (the binding now shows only tables for objects and handlers for operations), and an accepted template operation showed a pointless rationale field |

## Deviations from the plan

- **Backups live outside the repository.** A project workspace *is* its git repository (`workspaces/<projectId>`), and `commitWorkspace` refuses `*.sqlite`. Backups under `workspaces/<id>/backups/` would block the next commit, so they go to `<data>/backups/<projectId>/`. A test asserts they never appear in `git status`.
- **Handler symbols follow the code.** Handlers without a method check (`/api/session`, `/api/health`) are named by path alone. The contract still says `GET`.
- **The schema view is not yet migrations.** aludel-web-v1 creates its tables at start-up, so the Database tab shows the live schema and which object each table realises. It does not show numbered migrations.
- **Trailer links have no production caller yet.** `commitWorkspace` writes trailers and the indexer reads them (tested with a real commit), but nothing commits agent work until LAY-05.
- **Budgets are shown, not editable.** The validator accepts any budget of 0 or more, but the UI shows "$0 · spending off" until LAY-04 brings provider calls under owner approval.

## Known gaps (not claimed)

- The index understands the aludel-web-v1 shapes (the `pathname ===` handlers, `CREATE TABLE` strings, `{ path, label }` routes). Other stacks need their own extractor (SCIP was noted in research), and reachability is name-based, not type-checked.
- The query guard is a denylist on secret column names plus read-only mode and a row limit. A pathological `SELECT` can still be slow; this is local-only.
- Events (Data) and ADR-style technical decisions (Architecture) are not built.
- Owner acceptance of the new layers is pending (V3-REVIEW).

## Retrospective

1. **What made the work harder, slower or more error-prone than necessary?** *Observed:*
   - The browser scripts would not run as documented. The Playwright install they were last run with had vanished, and Playwright 1.61 resolves hostnames in Node, which does not map `*.localhost` on this machine.
   - The older scripts disagree on how they find the portal (`MACHINE_PORT` vs `MACHINE_TEST_URL`, default ports 4310/4311/4312), and some need an owner key and the data directory. Working that out took several failed runs.
   - The plan named a backup path that the repository's own commit guard forbids. The plan had not been checked against existing invariants.
   - The icon-font tool needs fontTools, which is not installed. A different fontTools version also re-encodes the app template font, so that font has to be restored.
2. **What would make the next equivalent task easier?** One command that runs every browser script with the right environment; a DNS shim in the shared test support; a sentence in the plan's run section about fontTools. All three are applied now. For planning: when a plan names a path, table or file location, check it against the code's guards (here `sensitivePath`) before handing off.
3. **What changed for the roadmap, downstream packets, architecture or process?**
   - LAY-04's first job ("verify closures against revisions") can use `knowledge_revisions.work_item_id` together with the revision-anchored `trace_links`, and Reconcile closing already relinks. LAY-04 should not build a second anchoring mechanism.
   - LAY-05 has its commit path: `commitWorkspace({ trailers })` plus re-indexing.
   - The index is stack-specific by design, so each future stack preset needs an extractor as part of being "checked to work" (DEC-035).
4. **Which questions were created, resolved or made more important?**
   - Resolved: where backups live.
   - Created, owner judgement: should a Reconcile item open for page-only edits (for example "mark as designed")? It does now, and a rebuild closes it. This is correct but may be noisy. It blocks nothing, but it matters for the V3 review.
   - Created, agent-resolvable later: extractor coverage for code agents write (LAY-05).
5. **Which process change was applied now, how was it tested, and what is still a hypothesis?**
   - Applied: `tools/browser-checks.sh`, run once end to end (6 pass, `browser.mjs` fails as before), and the `*.localhost` resolver in `tests/browser-support.mjs`, which every script now uses. Both are proven for this machine only.
   - Hypothesis: that checking a plan's named paths against code guards before handoff would have prevented the backup-path deviation. This is untested until the next plan is written.
