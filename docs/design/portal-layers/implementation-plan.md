---
id: portal-layers-implementation-plan
kind: implementation-plan
status: active
updated: 2026-09-22
depends_on: [portal-layers-model, portal-layers-knowledge-structures]
---

# Making the layers real: implementation plan and handoff

**Read this first if you are a new session picking up the layers work.** It says what is built, what is next and how to check it. Update the "Current state" section whenever a packet moves.

## Sources of truth

| Question | Read |
|---|---|
| Why layers, and what each layer is for | [model.md](model.md) (DEC-036) |
| Which frameworks the structures follow, and the evidence | [knowledge-research.md](knowledge-research.md) |
| Exact record types and fields; story-pack catalog; onboarding order | [knowledge-structures.md](knowledge-structures.md) (DEC-037) |
| What it should look and feel like | [prototype v2](v2/index.html) (owner-approved 2026-09-22: "this looks awesome … make it real") |
| Onboarding as built so far | [onboarding work record](../onboarding/work-record.md), [evidence](../../evidence/onb-01-05-onboarding.md) |

The prototype is the visual and structural reference, not code to copy. The real UI uses the portal's Angular/Material stack and the `page-blocks` and `proto-site` components.

## Packets

| Packet | Scope | Done when |
|---|---|---|
| **LAY-02** Project shell | Route `/p/<slug>/<layer>[/<tab>[/<id>]]` for every project the user is a member of. Rail: Home, Product, Design, Pages, Platform, Work; Settings; account menu (account, your apps, sign out). Global search over the project's records. "Continue in Aludel" and `/projects` link here. Aludel's old hash workspace stays reachable until LAY-06 | Browser: a new user lands in `/p/<slug>` after building; every layer and tab renders; non-members get 404; axe and 390px clean |
| **LAY-03** Knowledge records | Server module `server/knowledge.mjs`: project-scoped records for vision sections, personas, activities, steps, stories, phases, specs, research, docs, pages and work items, with revisions and rationale. Derived story status. Onboarding writes into them: idea → vision and a persona; **story packs** (replace functionality, before Pages) → activities, steps and stories; pages → page records linked to stories; look → design settings; build → template work items done and stories built. Layer screens with core editing (stories, vision, docs, specs, page descriptions; work item assign and answer) | Domain tests for validation, ownership, derivation and pack seeding; browser test from onboarding into every layer; the scaffold still builds from the page records |
| **LAY-04** Work automation | Working style → automation policy per work type; suggested items computed from gaps; routines; the Product agent drafting stories and specs through the agent connection (needs the owner's OK to spend on API keys) | Later |
| **LAY-05** Coding agents | Implement items against stories with isolated runs and preview review (absorbs B-03B) | Later |
| **LAY-06** Aludel inside itself | Migrate Aludel's own docs, decisions and plans into its layers; retire the hash workspace | Later; owner-led pass |

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
# browser: start a fresh portal, then
MACHINE_PORT=<port> PLAYWRIGHT_MODULE=<path to playwright/index.mjs> node tests/onboarding-browser.mjs
MACHINE_PORT=<port> PLAYWRIGHT_MODULE=<…> node tests/layers-browser.mjs
```

Playwright is not a portal dependency. Install it anywhere (`npm i playwright`, then `npx playwright install chromium-headless-shell`) and point `PLAYWRIGHT_MODULE` at its `index.mjs`. Known pre-existing failure: `tests/browser.mjs` fails on the baseline commit too (decision-conflict step).

## Current state

Newest first.

- **2026-09-22: LAY-02 and LAY-03 done and agent-checked.**
  - [Evidence and retrospective](../../evidence/lay-02-03-layers.md): server 32/32, onboarding and layers browser tests pass, existing workspace scripts pass.
  - The owner has not yet walked through the real layers.
- **Next action: owner walkthrough of `/p/<slug>`.** Then **LAY-04**, whose first job is:
  1. Link revisions to work items: pass `workItemId` when a work item's answer or output edits a record, and let `updateWork(... state: 'done')` verify that each target has a revision with that `work_item_id`.
  2. Write a question's answer into the target record with the rationale (a UI action on the item page: "Apply to S6").
  3. Remove the interim `/projects/<id>` page from `src/public.*`.

  Then working-style automation (stage suggestions and auto-assign per profile), routines, and the Product agent. Spending on API keys needs the owner's explicit OK (DEC-004).
- **Useful entry points**
  - `server/knowledge.mjs`: `view()` is the snapshot every layer reads; `seedPack`, `saveNavRoutes`, `recordBuild`, `storyStatus`.
  - `src/layers/context.ts`: `suggestions` computes gaps.
  - `tests/layers-browser.mjs` shows the expected UI behaviour step by step.
