---
id: portal-layers-implementation-plan
kind: implementation-plan
status: active
updated: 2026-09-22
depends_on: [portal-layers-model, portal-layers-knowledge-structures, portal-layers-data-platform-research]
---

# Making the layers real: implementation plan and handoff

**Read this first if you are a new session picking up the layers work.** It says what is built, what is next and how to check it. Update the "Current state" section whenever a packet moves.

## Sources of truth

| Question | Read |
|---|---|
| Why layers, and what each layer is for | [model.md](model.md) (DEC-036) |
| Which frameworks the structures follow, and the evidence | [knowledge-research.md](knowledge-research.md) |
| Exact record types and fields; story-pack catalog; onboarding order | [knowledge-structures.md](knowledge-structures.md) (DEC-037, DEC-038) |
| Data layer, Platform operations, agent profiles, code links: evidence and references | [data-platform-research.md](data-platform-research.md) (DEC-038) |
| What it should look and feel like | [prototype v2](v2/index.html) (owner-approved 2026-09-22: "this looks awesome … make it real"); [prototype v3](v3/index.html) for Data, Platform, Work › Agents and code links (built in LAY-07; owner review of the built layers pending) |
| LAY-07 as built | [evidence and retrospective](../../evidence/lay-07-data-platform-agents.md) |
| Onboarding as built so far | [onboarding work record](../onboarding/work-record.md), [evidence](../../evidence/onb-01-05-onboarding.md) |

The prototype is the visual and structural reference, not code to copy. The real UI uses the portal's Angular/Material stack and the `page-blocks` and `proto-site` components.

## Packets

| Packet | Scope | Done when |
|---|---|---|
| **LAY-02** Project shell | Route `/p/<slug>/<layer>[/<tab>[/<id>]]` for every project the user is a member of. Rail: Home, Product, Design, Pages, Platform, Work; Settings; account menu (account, your apps, sign out). Global search over the project's records. "Continue in Aludel" and `/projects` link here. Aludel's old hash workspace stays reachable until LAY-06 | Browser: a new user lands in `/p/<slug>` after building; every layer and tab renders; non-members get 404; axe and 390px clean |
| **LAY-03** Knowledge records | Server module `server/knowledge.mjs`: project-scoped records for vision sections, personas, activities, steps, stories, phases, specs, research, docs, pages and work items, with revisions and rationale. Derived story status. Onboarding writes into them: idea → vision and a persona; **story packs** (replace functionality, before Pages) → activities, steps and stories; pages → page records linked to stories; look → design settings; build → template work items done and stories built. Layer screens with core editing (stories, vision, docs, specs, page descriptions; work item assign and answer) | Domain tests for validation, ownership, derivation and pack seeding; browser test from onboarding into every layer; the scaffold still builds from the page records |
| **LAY-07** Data, Platform operations, agents, code links (DEC-038) | Done 2026-09-22 (owner asked for the build directly; the v3 review now covers the built layers). Sub-packets below | Done: 12 domain tests, `layers-browser.mjs` covers the new tabs, axe and 390px clean. [Evidence](../../evidence/lay-07-data-platform-agents.md) |
| **LAY-04** Work automation | Working style → automation policy per work type; suggested items computed from gaps; routines; the Product agent drafting stories and specs through the agent connection (needs the owner's OK to spend on API keys) | A–C done 2026-09-23; D done: pasted, checked keys (DEC-039) and agent batches with the runner (DEC-040). Next: ROADMAP-01 (action-based roadmap that batches draw from). [Evidence](../../evidence/lay-04-work-automation.md) |
| **LAY-05** Coding agents | Implement items against stories with isolated runs and preview review (absorbs B-03B) | Later |
| **LAY-06** Aludel inside itself | Migrate Aludel's own docs, decisions and plans into its layers; retire the hash workspace | Later; owner-led pass |


## LAY-07 in detail (built 2026-09-22)

This was the build brief. It is kept for reference. What differs in the built version, and why, is in the [evidence](../../evidence/lay-07-data-platform-agents.md#deviations-from-the-plan). The main difference is that backups live in `<data>/backups/<projectId>/`, not in the workspace, because the workspace is the git repository.

**LAY-07A Data layer.**
- New record kinds in `server/knowledge.mjs`, each with a validator:
  - `data_object`: name, description, `schema` (a JSON Schema 2020-12 object: `type: object`, `properties`, `required`), `relations` (`[{ name, target, cardinality: one|many, owner: boolean }]`), `states` (optional lifecycle), `stories`, `specs`
  - `data_operation`: `operationId`, summary, method, path, `objectId`, request and response schemas (JSON Schema; `$ref` to objects by id), errors, roles, stories
  - `access_rule`: role, `objectId`, action, effect (`allow` | `owner` | `deny`), sentence
- Validation stays structural. The stack rule is enforced by review and by the Architect profile's instructions, not by string matching.
- Story packs gain `objects` and `operations` in `config/story-packs.json`. Accounts must describe exactly what aludel-web-v1 generates:
  - `Account {email, name}` and `Session`
  - `getSession`, `signUp`, `signIn`, `signOut`, `health`
  - Those are template-built. Other packs' objects are proposed.
- `view()` adds `objects`, `operations` and `access`. `GET /api/projects/:id/openapi.json` exports the contract (OpenAPI 3.1, `components.schemas` from objects).
- UI: `src/layers/data.ts` with tabs Objects (relationship map plus detail panel), API (Scalar-style three panes), Access (matrix). Rail order: Home, Product, Design, Pages, **Data**, Platform, Work.
- Derived status: proposed → contracted → built → shipped.

**LAY-07B Platform tabs.**
- Tabs: Overview, Architecture, Code, Repository, Releases, Environments, Database, Domains. Move GitHub from Connections into Repository and remove the Connections tab.
- Architecture shows the binding: for aludel-web-v1, objects map to tables and operations map to handlers in `server.mjs`. Runtime Services list what stories need (email for "reset password"), marked "not connected".
- Releases: record each preview build in a `releases` table (`commit`, `environment`, `state`, `checks`, `startedAt`, `stories` via code links). Promotion to production is shown as unavailable locally.
- Database (local, for the preview environment's `data/app.sqlite`):
  - health: file size, table row counts, `PRAGMA integrity_check`
  - backups: copy to `workspaces/<id>/backups/` with a timestamp; restore needs a confirm step
  - migrations: the schema read from `sqlite_master`
  - browse: first 50 rows per table, with password hashes and session tokens masked
  - read-only query: open with `readOnly: true` plus a single-statement `SELECT`-only guard and a row limit
  - Never show or log secrets. Column names matching `hash|salt|token|secret|password` are masked.
- Domains: `<slug>.<base>` per environment; custom domains are shown as needing hosting (unavailable state, no DNS calls).

**LAY-07C Work › Agents.**
- Tabs: Queue, Agents, Routines, Working style. Move the shared agent-connection component from Platform to Agents as **Accounts**.
- New record kind `agent_profile`:
  - name, role, work types, `accountId`, model
  - instructions (text, revisioned like any record)
  - writable layers (`product|design|pages|data|platform|work`)
  - `approvalRequired` effects
  - `budget` (0 by default)
- Seed the defaults: Product lead, Design lead, Architect, Coding agent, Reviewer.
- Working style maps work types to profiles (replaces the free-text "agent" label).
- Work items store `profileId` plus the instruction revisions used.
- "Export AGENTS.md" writes project instructions into the workspace on the next commit.
- No provider calls: that stays LAY-04 with the owner's OK to spend.

**LAY-07D Code links.**
- Tables:
  - `code_units` (project, path, symbol, kind, hash, reachable, lastCommit)
  - `trace_links` (project, recordId, recordRevision, unitId, kind `generated|implements|tests`, source `manifest|trailer|test`, state `current|suspect`)
- Sources:
  1. `skeletonFiles` returns a manifest of `{ path, symbol, recordIds }` for every generated page, pack feature and operation handler. The build stores it (template stories link at their current revision).
  2. `commitWorkspace` adds trailers `Aludel-Work:` and `Implements:` from the work item. The indexer reads trailers from `git log` and links the units changed in that commit.
  3. Test names starting with a story ref.
- Index: TypeScript compiler API over the workspace (exported symbols, Angular components, route entries, handlers), references between them, and reachability from `main.ts` and `server.mjs`. Run it after each build.
- Propagation: `knowledge.update` marks links on the old revision `suspect` and creates or updates one `reconcile` work item per record. Its context holds the revision diff, units, callers and callees, and tests.
- UI: Platform › Code (matrix, unit list with state filter, unit detail); "Built by" sections in the story drawer, page aside and Data object; suspect count on Home.

## Design choices already made (do not reopen without the owner)

- The layer comes first. Stories, not features, carry status, and status is **derived** from connected records.
- Functionality picks are **story packs** that seed ordinary stories. Template-built stories arrive built, with a done work item assigned to "Aludel template". Pack pages are placed but editable; deleting one asks which page takes its stories.
- Specs cover increments of related stories (Shape Up pitch plus numbered requirements, WHEN clauses where conditional). Stories use Given/When/Then.
- Design (system) and Pages are separate layers.
- Answers land as revisions of the records they change, with a rationale linking back to the work item. Work-item logs are not documentation.

## Implementation notes

- **Storage:** one `knowledge_records` table with a `kind` whitelist, plus `knowledge_revisions`. Every kind has an explicit validator in `server/knowledge.mjs`, and its fields follow knowledge-structures.md. This is typed at the domain layer and deliberately not an open-ended entity store. New kinds need a validator and a doc update.
- **Pages** move from `project_setup.routes_json` to `page` records. Onboarding and the scaffold read and write through the knowledge module; a one-time migration copies existing `routes_json`.
- **Work items** use a new `layer_work_items` table. The legacy `work_items` (B-03A supervised cycle) remains for Aludel's old workspace until LAY-06.
- **Frontend:** `src/layers/shell.ts` (routing, rail, search, settings, account), one component per layer in `src/layers/` (`home`, `product`, `design`, `pages`, `platform`, `work`), and a shared `ProjectContext` in `src/layers/context.ts`: data snapshot, `api()`, `write()` (errors plus reload), `record/change/delete`, work helpers and gap suggestions. Public onboarding stays in `src/public.ts`. All layer CSS classes are prefixed `lay-`.

## How to run and check

```sh
./launch-machine                       # http://aludel.localhost:4310
cd apps/portal
npm run test:server                    # domain tests
npm run typecheck && npm run build
# browser: every script, each against its own fresh portal (build first)
PLAYWRIGHT_MODULE=<path to playwright/index.mjs> tools/browser-checks.sh            # or: … tools/browser-checks.sh layers
```

Playwright is not a portal dependency. Install it anywhere (`npm i playwright`, then `npx playwright install chromium-headless-shell`) and point `PLAYWRIGHT_MODULE` at its `index.mjs`. `tests/browser-support.mjs` resolves `*.localhost` to loopback for the test process, because Node's resolver does not on every machine. Known pre-existing failure: `tests/browser.mjs` fails on the baseline commit too (decision-conflict step).

New `<mat-icon>` names need the font subset rebuilt: `python3 tools/subset-icons.py` needs fontTools (`pip install fonttools brotli`, a venv is fine). If `templates/aludel-web-v1/icons.ttf` changes while its icon list did not, restore it with `git checkout`, because a different fontTools version only re-encodes it. Icons chosen at runtime must appear somewhere as `icon: '…'` so the tool finds them.

## Current state

Newest first.

- **2026-09-23: LAY-04A–C done and agent-checked** ([evidence](../../evidence/lay-04-work-automation.md)).
  - Built: verified closing, applied answers, server-side suggestions, working-style automation and routines. The interim `/projects/<id>` page now redirects.
  - **Next: LAY-04D, the Product agent. It is blocked on the owner's OK for provider use.** Items are already queued for profiles with pinned instructions; what's missing is a runner that takes a queued item, calls the account, writes drafts as revisions made from the item, and moves it to review.
- **2026-09-23: V3-REVIEW closed.** Owner: "im happy with v3".
- **2026-09-22: LAY-07 done and agent-checked** ([evidence](../../evidence/lay-07-data-platform-agents.md)).
  - Data layer, eight Platform tabs, Work › Agents and code links are real; server 44/44, all browser scripts pass except the known `browser.mjs` step.
  - **Next action: owner review of the built layers (V3-REVIEW)**, then LAY-04.
  - Open question for that review: a page edit (for example "mark as designed") opens a Reconcile item because the page has generated code. A rebuild closes it. Is that useful or noise?
- **2026-09-22: DEC-038 documented; prototype v3 built** ([v3](v3/index.html)).
  - v3 adds the Data layer, the Platform operations tabs, Work › Agents and code links.
  - **Next action: owner review of v3.** Then build LAY-07A → D (above), then LAY-04.
  - LAY-04's "verify closures against revisions" reuses LAY-07D's revision-anchored links: build it once.
- **2026-09-22: LAY-REVIEW done.** The owner called the real layers "a decent direction"; each layer gets a later refinement pass.
- **2026-09-22: LAY-02 and LAY-03 done and agent-checked.**
  - [Evidence and retrospective](../../evidence/lay-02-03-layers.md): server 32/32, onboarding and layers browser tests pass, existing workspace scripts pass.
- **LAY-04** (after LAY-07). Its first job:
  1. Link revisions to work items: pass `workItemId` when a work item's answer or output edits a record, and let `updateWork(... state: 'done')` verify that each target has a revision with that `work_item_id`. Revision anchoring already exists: `trace_links.record_revision`, the `onRevision`/`onWorkDone` hooks in `knowledge.mjs` and Reconcile relinking in `code-links.mjs`. Build on those rather than a second mechanism.
  2. Write a question's answer into the target record with the rationale (a UI action on the item page: "Apply to S6").
  3. Remove the interim `/projects/<id>` page from `src/public.*`.

  Then working-style automation (stage suggestions and auto-assign per profile), routines, and the Product agent. Spending on API keys needs the owner's explicit OK (DEC-004).
- **Useful entry points**
  - `server/knowledge.mjs`: `view()` is the snapshot every layer reads; `seedPack`, `saveNavRoutes`, `recordBuild`, `storyStatus`.
  - `src/layers/context.ts`: `suggestions` computes gaps; `builtBy`, `recordLabel` and `recordHref` serve every layer.
  - `server/code-links.mjs`: `indexWorkspace` (TypeScript parser), `recordManifest`, the propagation hooks and `reconcileContext`. `server/platform-ops.mjs`: releases, the preview database and commits. `server/scaffold.mjs`: `accountsBinding` and the generation manifest.
  - `tests/layers-browser.mjs` shows the expected UI behaviour step by step.
