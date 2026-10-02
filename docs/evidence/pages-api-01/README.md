# Pages API as the output contract (PAGES-API-01) — 2026-09-30

## Authorization and readiness

The owner sees each layer as its own app, whose output description is an API that anyone must call to change its data ("build it in pages"). The authorization and scope are recorded in the root [LAYER-SCOPED-WORK-01 record](../../../../docs/design/layer-scoped-work/work-record.md#pages-api-01-the-layers-api-is-its-output-contract-2026-09-30). It is limited to local work: this candidate and the local Pages template. No provider turn, external write or deployment.

Before this work, the Pages record rules lived in three places:
- the host record rules in `knowledge.mjs`;
- the template's flow revision rule;
- the DEC-057 worker check for new flows.

The output docs were short prose.

## Observed implementation

- **Contract.** Pages template `3b647bb` publishes `api/openapi.json` (OpenAPI 3.1, JSON Schema 2020-12).
  - Reads: `listPages`, `getPage`, `getPageMap`, `listFlows`, `getFlow`.
  - Writes: `createPage`, `updatePage`, `setPageMap`, `createFlow`, `updateFlow`.
  - Each write declares `x-aludel-output`, `x-aludel-staging: record` and `x-aludel-access`.
  - `x-aludel-records` names the schema every stored page, map and flow must satisfy.
  - Field titles and `x-message` produce the error text people already saw.
- **One copy of the rules.** `server/pages-api.mjs` is pure. It normalizes records, derives Map links from sections, checks catalog icons and page types, and reports references. The schemas hold limits and allowed values. The host limits and enums for pages, the map and flows are no longer used when the API is installed.
- **Host enforcement** (`server/layer-api.mjs`). For every call and every normalized record, the host:
  - loads the document and handler at the pinned commit;
  - runs the handler only if its source digest is registered in `config/layer-reviewed-sources.json`, in the limited child process;
  - validates requests and stored records with `ajv`;
  - requires each write to be the operation's declared output kind, and an update to target the record it loaded at that revision;
  - resolves every reference in this project, and within this instance for Pages kinds.
- **All host writes use it.** `know.insert` and `know.update` delegate Pages kinds to the layer API when it is installed, so onboarding, reconciliation, flow review and legacy `pages.flows` all go through the same rules. The Pages UI's generic record writes are routed to the matching operation. `GET /api/projects/:id/layers/pages/api` serves the document, and `POST …/api/:operationId` calls an operation directly.
- **Agents are staged.** A layer-scoped task card carries the whole document. `aludel_layer_call` stages each write in the run's draft (`layer_run_drafts`), and reads include the draft. Submission rejects the old `content.changes` form and carries notes and follow-ups. Review shows one row per changed record with only the changed fields, and record IDs read as names.
- **Acceptance commits the draft as reviewed.** It fails if any changed record moved on from its base revision, any reference is gone, or the layer source changed. Otherwise it writes with the staged IDs, the Work item and the reviewer, in the existing transaction.
- The DEC-057 per-kind "change adapter" registry and the worker's own flow checks were removed. Layer scope now derives from the layer API's write operations.

## Checks

- Portal server suite **181/181**. New tests cover:
  - the API-only agent path: schema, unknown-field, missing-reference, wrong-kind and unknown-operation rejections; reads that include the draft; no write before review; field review; elevated acceptance keeping staged IDs; follow-ups;
  - refusal on a changed base revision, a removed reference, or a changed layer source;
  - every host write using the layer's rules and messages; people's operations with derived links, a stale revision, map placement, and a foreign-instance reference denied.
- Pages template tests **8/8**, including spec/handler agreement: every write operation has a handler and writes a declared output; every other operation is a read.
- Typecheck, production build and `git diff --check` passed.
- Browser journey `tests/layer-scope-browser.mjs` **passed**, covering:
  - the document served over HTTP;
  - a too-long page name rejected through the UI's record route with the API's message;
  - an `updatePage` call shown on the Map;
  - the run's staged flow and page change reviewed as field tables (screenshots inspected, which led to naming IDs and hiding empty fields);
  - follow-ups, acceptance applying both changes, and 390px width.
- `tools/browser-checks.sh layer-bar` **passed** with and without the Pages template. With the template it expects Access instead of Actions and no action picker. That template-enabled check had also been failing after DEC-057 and was missed then, because the output was cut off.

## Limits

- `aludel_layer_call` was added to the Symphony Elixir adapter but **not compiled or run**; no Elixir toolchain is available. No live agent has used the API.
- Page deletion keeps its host route and rules. Agents cannot delete.
- Agent edits to the layer repository (docs or code as Git commits) are not built.
- Each handler commit needs a host-registered source digest. That process is manual, and the digest registered for `3b647bb` is the author's own review.
- Every Pages record write now starts a short child process (roughly 40–60 ms). That is acceptable locally but untested at scale.
- Review shows structured JSON for nested fields; native-tab review is LAT-08A.
- Other layers still use actions or host rules.

## Retrospective

1. **What made it harder:** Pages writes reached the database through two generic record functions used by many host paths. Routing them at that single point was simpler than converting each caller. The first attempt at the acceptance code also contained leftover chained no-ops, caught on read-back.
2. **What would make it easier next time:** a layer conversion is now: publish the document, move the record rules into a pure handler, register its reviewed digest, and declare `api` in `layer.json`. The spec/handler agreement test belongs in every layer template.
3. **Roadmap effect:** a layer's API replaces the separate change-adapter idea. LAT-T03 converts each record layer this way. Code, whose outputs are commits, and Deploy, whose outputs are effects, need the other two staging kinds (`commit`, `effect-plan`) before they fit.
4. **Questions:** Should handler review be automated (for example, the owner signs a digest in Manage), rather than a host config file? How should deletion be expressed, given it carries UI rules about built pages?
5. **Process change:** one contract serves people, agents and host paths, and it is tested by the same suite. Whether agents do well with a raw OpenAPI document as their method stays a hypothesis until a live run is authorized.
