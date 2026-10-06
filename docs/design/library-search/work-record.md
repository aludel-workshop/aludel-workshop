# W-10: everything in the Library, one search

- Item: W-10 "Search all project knowledge", branch `aludel/w-10`. Proposed by W-9 #4 as the first cutover blocker ([readiness row 1](../self-hosting/readiness.md)).
- Authorization: the owner started W-10 in the portal on 2026-10-06 and, in chat, set the direction and cleared it: "i want a single search experience for everything … its not the library + stuff - everything should be in the library, and that is the search used by everything. cleared to start". Scope: the portal repository on this branch, local checks and journeys. Excluded: live data writes, external effects, and other layers' repositories.

## The problem, measured

Live `search_knowledge` on 2026-10-06, before any change:

| Query | Returned | Should return first |
|---|---|---|
| `status` | one page, "Work board" | `docs/status.md` ("Current project status") |
| `DEC-062` | nothing | `docs/decisions.md`, at DEC-062's entry |
| `operating procedure` | nothing | `docs/design/process/operating-procedure.md` |

The cause isn't one missing kind. The portal has six searches, and each builds its own index:

| Search | What it reads today |
|---|---|
| `search_knowledge` (editor bridge) | 13 hard-coded record kinds; title-like fields only |
| Symphony worker `knowledgeSearch` | the Library, plus a fallback over hard-coded record kinds |
| Shell top bar, "Search every layer" | the browser's copy of `ctx.data()`, titles only |
| Library tab | the Library (`library.search`) |
| A layer's Knowledge tab | that layer's doc titles and information nodes, in the browser |
| Library › Research | insights and findings, in the browser |
| (`/api/records`, Sources page) | `the-machine`'s imported documents, title and path only |

The Library itself has gaps:

- It reads layer Knowledge from the old `layer_documents` table. The Knowledge tab, by contrast, reads each layer's docs from its repository (`layerDocs`, T03-CODE). So repository docs (`AGENTS.md`, `docs/**`), which the Code layer declares in `knowledge.docs`, never reach it.
- Work items, their actions and their threads aren't in it.
- It rebuilds every entry on every query. That's tolerable for records, but not for about 240 Markdown files read from git.

## What this reveals about how we work

Every time a new kind of knowledge appeared, a surface added its own search, so the searches drifted apart. **The rule going forward: knowledge becomes findable by being published to the Library, never by adding a search.** A new layer output, doc source or work field is covered once it's in the Library. A UI may filter Library results but never search its own copy.

The rule is enforced by a contract test, not just written down. For every output kind an installed layer declares, every Knowledge doc the Knowledge tab lists, and the work sources, the test checks that the Library holds an entry and that a body-text query finds it. The test also fails if server or client code adds another full-text match over records outside `library.mjs`; that part uses a grep-based check the gate runs. The rule goes into `docs/knowledge-strategy.md` and the comment at the head of `library.mjs` at closeout.

## Spec

### 1. What the Library holds

| Source (`source`) | Entries | Reaches the Library by | Change |
|---|---|---|---|
| `output` | every installed layer's outputs: records and layer-file kinds, including `vision_section`, `persona`, `flow`, `design_tokens` and `brand_asset` | existing `outputs()` | none; the contract test proves the kinds are covered |
| `knowledge` | each layer's Knowledge exactly as its Knowledge tab lists it: charter, methods, docs, tab docs and **repository docs** (`/AGENTS.md`, `/docs/...`) | `layerDocs.list` and `layerDocs.read` at the layer's pin | **replaces** `layer_documents`. Before switching, the build lists any `layer_documents` rows with no `layerDocs` counterpart; anything found is reported, not dropped silently |
| `library` | sources, findings, insights and docs | existing `own()` | none |
| `work` (new) | each work item: its ref, title, brief, state and its actions' goals and summaries, with its **thread** (messages, flags, asks and answers) as part of its text | `layer_work_items`, `work_goal_actions`, `work_goal_events` | new; layer `{ key: 'work', name: 'Work' }` (DEC-069: Work is a layer) |

Long docs are also split by heading. A doc is one entry, and each match records the heading it fell under, so a result can open at that section (`#anchor`). This is what makes `DEC-062` land on its entry in a 383-line file.

`the-machine`'s `source_documents` (the Sources page and `/api/records`) are **not** indexed. They're older copies of the same repository docs, and EX-02A C5 retires that project. The Sources page stays until C5.

### 2. The index

- A SQLite FTS5 table, `library_index`, has one row per entry and section: ref, source, layer, kind, title, path, heading, body. The tokenizer is `unicode61`, with `-`, `_`, `/` and `.` as separators, so `DEC-062` and `operating-procedure.md` tokenize the way people type them. Node's `node:sqlite` includes FTS5 (checked in this container).
- Freshness: each part of the pool is rebuilt only when its fingerprint changes. The fingerprints are:
  - records: the highest `updated_at` and the row count per project;
  - Knowledge: each layer's pinned commit;
  - work: the highest work-item `updated_at` and the highest event id.

  The check runs at query time, so there's no background job. A rebuild of one part replaces only that part's rows.
- Access is unchanged: the project-member check, and Knowledge read as the asker. Agents read as the project owner, which is the current `reader()` rule (DEC-054).

### 3. Ranking

Results are ordered by these tiers, then FTS5 `bm25` within a tier (title weight 10, path 5, heading 3, body 1):

1. **Defines it:** the query is the entry's title or path name (`status` → `docs/status.md`; `operating procedure` → `operating-procedure.md`), or, for an ID-shaped query (`[A-Z]+-\d+`), it opens a heading or a bold lead (`**DEC-062:`).
2. Every word in the title, path or a heading.
3. Every word in the body (an exact phrase first).

A query of one word or several matches all of them (AND). A quoted query is a phrase.

### 4. One API, used by everything

`library.search(projectId, userId, { q, layer, kind, source, cursor, limit })` stays the only search. Each result has `ref`, `source`, `layer`, `kind`, `title`, `heading`, `excerpt` (around the match, with the match marked) and **`href`, the portal path that opens it** (the record in its layer, the doc in Knowledge at its heading, the item in Work).

| Caller | Change |
|---|---|
| `search_knowledge` (editor bridge) | calls `library.search` and returns ref, kind, layer, title, heading, excerpt and href. The 13-kind list goes |
| Symphony `knowledgeSearch` | calls `library.search`; the legacy fallback goes |
| Shell top bar | calls the server, grouped by layer (Work and Library included), up to 5 per group, with "See all in the Library" leading to the Library tab with the query |
| Library tab | unchanged UI; gains the `work` source filter ("Work"), headings and highlights |
| Layer Knowledge tab | the doc search becomes `library.search` with `layer=<key>, source=knowledge`; filtering the information nodes stays as navigation |
| Library › Research | becomes `library.search` with `source=library` |
| Code's "Go to file or chunk" | unchanged: it navigates the file tree and isn't knowledge search |

### 5. Done when

- **Live checks.** In the live project after close-out, `search_knowledge` (and the top bar) return:
  - for `status`: `docs/status.md` first;
  - for `DEC-062`: `docs/decisions.md` first, with the DEC-062 heading or lead in the excerpt;
  - for `operating procedure`: `docs/design/process/operating-procedure.md` first.
- **Contract test.** It passes (§ "What this reveals").
- **Tests.**
  - Fixtures cover a body-only match for a vision section, a persona, a flow, a token set, a brand asset, a repository doc, a work item's brief and a thread message.
  - Ranking tests cover the three checks on a fixture copy of the three docs.
- **Journey.** The shell search journey runs at 1440 and 390 wide, with axe: type, see grouped results, open a doc at its heading, then "See all".
- **Test tiers.** `npm run test:affected` while building; `npm run test:server:templates` before handoff. `typecheck-layer-ui` runs if a template pin changes; no template change is planned.

### 6. Sequence (actions 2 to 4)

| # | Output | Check |
|---|---|---|
| 2 | `library_index` with its fingerprints; Knowledge from `layerDocs`; the `work` source; sections; ranking; `href`. `search_knowledge` and `knowledgeSearch` on it. Contract test | unit, ranking and contract tests; `test:affected` |
| 3 | top bar, Knowledge tab and Research searches on the Library API; Library tab "Work" filter, headings and highlights | browser journey 1440 and 390 with axe; build |
| 4 | the three live checks, both tiers; knowledge-strategy rule; status pointer; retrospective | live output recorded here |

### Open points for the owner's review

- **Out of scope:** the Sources page and `/api/records` aren't indexed, because they're retired at C5. Say if you want them gone sooner.
- **Default, to confirm:** the top bar shows grouped results inline, as today, rather than jumping straight to the Library tab.

## Readiness

Ready to build once the spec is approved: every source and caller is located in code, and FTS5 is confirmed available. There's one unknown, `layer_documents` content not covered by `layerDocs`, which the build checks first and reports.

## #2 build: the Library holds everything; agents search it (2026-10-06)

The owner approved the spec without changing either open point, so the defaults stand: the Sources page stays out, and the top bar keeps grouped results inline.

**What was built:**
- **`server/library.mjs`** owns an FTS5 index, `library_index`, kept in parts with fingerprints in `library_index_parts`:
  - each layer's files;
  - records;
  - each layer's Knowledge;
  - the Library's own records;
  - Work.

  A part is rebuilt only when its fingerprint changes, and that check runs at search time.
- **Knowledge.** A layer installed from a repository is read through the new `layerDocs.indexable`. It's the same set the Knowledge tab shows, read with one `git cat-file --batch`. A layer without a repository keeps `layer_documents`.
- **Work.** Work items come in with their brief, actions and thread; status logs are left out.
- **Sections.** Docs are split by heading, and front matter is skipped.
- **Ranking:** results come in this order:
  1. The entry the query names: its title or file name, or, for an ID, a heading or bold lead.
  2. Every word in its title, path or a heading.
  3. Every word in the body.

  `bm25` breaks ties within each tier.
- **New refs:**
  - `k:<layer>:<path>`, for a doc at the layer's pin. Its revision is the number of commits that changed it.
  - A work item's id, read with its content.
- **Callers on the Library:**
  - `search_knowledge` and `read_record` in the editor bridge;
  - the Symphony worker's `knowledgeSearch`. Older bundles keep their kind scope, now as a `kinds` filter, and the legacy fallback is gone.

  The MCP tool descriptions now say what they cover.

**Change from the spec:** results don't carry an `href`. The client already builds links from an entry's kind and ref (`ctx.recordHref`, the Library entry page), so #3 builds them there, adding a Knowledge doc's heading anchor. A server-side href would duplicate the client's routing.

**Left out on purpose:** record kinds that are configuration, not knowledge, and that no layer publishes (`agent_profile`, `project_instructions`, `routine`, `role`, `work_action`, `evidence_link`). Records of a disabled layer stay hidden, as DEC-059 has it.

**Checks:** `tests/library-search.test.mjs` passes five tests; `library` and `editor-bridge` pass with templates on and off.
- **Body text:** vision section, persona, flow, brand asset and token set.
- **Freshness:** the index keeps up after an edit, and the last word matches as a prefix.
- **Work:** an item is found by its brief, by a thread message and by its W-number, and reads like any entry.
- **Contract:** every installed output and every Knowledge doc a tab lists is in the Library.
- **Repository docs:** on fixture copies, `status`, `operating procedure` and `DEC-062` each put the right doc first, and front matter isn't searchable. Revisions read as they were, a moved pin re-reads the docs, and `search_knowledge` returns them.
- **Static check:** no server module has its own text search.

**Process finding:** `npm run test:affected` (27 files, run in parallel) was killed with exit 137 in this container, with swap at 7.4 of 8 GB. Applied now: `test-affected.mjs --concurrency <n>` passes Node's `--test-concurrency` through, and AGENTS.md mentions it. Its test is the rerun below: the same 27 files at concurrency 3 in this container.

**Development tier** (templates on, the 27 affected files at concurrency 3): 163 of 171 passed and 4 failed.
- **Fixed:** `symphony-proposals` "a cited Knowledge revision gates acceptance". With a repository, Vision's charter is `k:product:knowledge/charter.md`, as its Knowledge tab shows it. The test now takes either ref, and in the repository case the charter changes through a Knowledge save that moves the pin. It passes with templates on and off.
- **Also failing on the unchanged base:** the other three (`runner ENOENT` twice, and a worker run that fails to start). They were run on `6a3e964` in a scratch worktree with the same result: the known Docker-only F30 failures, and this container has no Docker.

## #3 build: every portal search box on the Library (2026-10-06)

**What was built:**
- **Top bar** ("Search every layer"): calls the Library's search, with a 200 ms debounce instead of filtering the browser's copy of `ctx.data()`.
  - Results are grouped by layer in the order of each group's best match, up to five per group, each with its kind, the matching section and an excerpt.
  - "See all N in the Library" opens Library › Layers with `?q=`.
- **Library › Layers:** a Work filter (layer and source), section headings, revisions only where an entry has one, and each row opens where the entry lives (`ctx.entryHref`) instead of always on the Library entry page.
- **Library › Research:** the insight search uses the Library (`source=library`); an insight shows when it or one of its findings matches.
- **A layer's Knowledge tab:** the doc search uses the Library (that layer's Knowledge, body text included) and opens a doc at the matching section. Filtering the information tree stays, because it's navigation.
- **Links and sections:** links carry `#anchor`. `ctx.go` keeps the fragment and query apart from the path, and the doc view scrolls to and highlights the heading with that anchor. `headingAnchor` is the same rule on server and client. Angular strips `id` from `innerHTML`, so the heading is found by its text.

**Checks:**
- **Static rule:** it now covers `src/` too. Pickers and navigation filters are named as allowed: the Code file finder, the token, icon and journey pickers, and a layer's information tree.
- **`library-browser`** (templates on) passes. New steps:
  - top bar at 1440 and 390 wide: body text, a work item found by its brief, excerpts, no horizontal scroll, axe on the top bar;
  - "See all" opens Library › Layers with the query, and the work item opens from there;
  - a Vision charter section found from the top bar opens at that heading, below the sticky bar, with axe.
- **Defect the journey found:** "See all" cleared the query before building its link.
- **Defect screenshots found:** the opened heading sat under the sticky top bar, so the scroll margin is now 96 px and the journey asserts it.
- **Other journeys:** `data-layer` and `design-layer` pass. `vision-layer` failed once, on a disabled "Add activity" button before any search step, then passed twice with no change. It also passes on the unchanged base, so it's flaky under load and not caused by W-10.
- **Server tests:** typecheck passes (warnings only, all already there); `library-search` and `library` pass with templates on and off.

**Preview:** `library-browser` now keeps its portal up under `npm run preview -- library`. With `JOURNEY_PORT` set it starts its own portal on disposable data, as the preview-ready journeys do, and it calls `holdForPreview` after its PASS line. It still passes under `browser-checks.sh`. The editor MCP this container connected to doesn't offer `update_action`'s `preview` field yet; it comes with W-25 on `main`. So the preview link went in the item's thread.
