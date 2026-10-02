# T03-G1: the Library as the one place layers read each other (DEC-059) — 2026-09-30

## Authorization and scope

The owner decided (chat, 2026-09-30, recorded as DEC-059) that layers read each other only through the Library, a pool of every layer's outputs and Knowledge, rather than by calling each other. The owner said "fire away" on the LAT-T03 plan. This packet is local candidate work only: no provider turn, no GitHub or external write, no owner data.

## What changed

- **Library index** (`apps/portal/server/library.mjs`):
  - Pools every *enabled* layer instance's stored outputs, its Knowledge (charter, output, method, routine and connection documents), and the Library's own content (sources, findings, insights, project documents).
  - Each entry has a ref, source (`output`, `knowledge` or `library`), owning layer and instance, kind, title and revision.
  - Search filters by text, layer, kind and source. A text match ranks titles before content.
  - A read returns the entry at the current or a pinned revision, with `currentRevision` so a stale pin is visible.
  - Knowledge refs are `k:<layer>:<doc>`.
  - Legacy untagged records belong to the one installed layer that owns their kind.
  - Nothing here writes.
- **HTTP**:
  - `GET /api/projects/:id/library` and `…/library/entry?ref=&revision=` for project members.
  - Layer frames may call both. The frame allowlist gained only these two reads.
- **Agents**:
  - A layer-scoped run's knowledge search and read go through the Library, so they cover Knowledge and every installed layer, not the fixed six-layer list.
  - Acceptance rechecks cited `k:` revisions.
  - The task card tells the agent to read other layers there.
- **Pages pins**: a flow's story, persona and activity references now pin the owning Vision instance, where they were `null` before.
- **UI**: Library › Layers searches and filters the pool. An entry page shows Knowledge as a document and outputs as fields, with a link to open the output in its own layer.

## Checks

- Server suite **202/202**, including:
  - new `tests/library.test.mjs` (3): pool coverage, owner instance, revision pins and staleness, non-members, disabled layers, frame allowlist;
  - a new worker test: a layer-scoped Pages run finds a Vision story and charter through the Library, cites both, and acceptance is refused after the cited charter changed.
- Typecheck and build pass.
- New browser journey `library` passes, covering the pool, source and layer filters, a search that reaches research, opening an entry, a charter as a document, axe on each page, and 390 px with no horizontal scroll. I inspected the screenshots.
- `layer-bar` and `pages` journeys pass with templates on.

## Limits

- The index is computed per request by reading every Knowledge document. That is fine at current project sizes; an incremental index is a later need.
- Only records-mode outputs are indexed. Repository-mode files arrive with T03-G2.
- Built-in layers' Knowledge is mostly generic seeded text. The Library makes that visible; real Knowledge comes with each template.
- At 390 px the Library's tab row scrolls sideways, as in the existing tab pattern, so "Layers" starts off-screen.
- The shell's global search ("Search stories, pages, data, code, work…") is a separate client-side search that overlaps the Library. Routing it to the Library is a candidate follow-up.
- Connection policies (`layer_connections`) still exist. Under DEC-059 they become a receiving layer's Knowledge about how it uses Library entries; they are not retired here.
- A revise-flow change proposed before this commit needs a fresh run, because its reference pins now name the Vision instance.

## Retrospective

1. **Harder than necessary:**
   - The unit tests called the Library directly, so they missed that `/library` was not in the server's project-route pattern. The browser journey found it.
   - The test fixture lacked the layer document tables, and a blanket `catch` in the index hid that. The catch now skips only a layer that was not found.
2. **Easier next time:** an HTTP-level request check alongside unit tests for any new route; the `library` journey as a reusable check.
3. **Roadmap effect:** neighbor-read contract work (`x-aludel-neighbors`) is dropped. Repository-mode outputs (G2) only need to publish into this index.
4. **Questions:** whether the shell search should become Library search; how connection policies fold into Knowledge.
5. **Process change applied:** layer reads have one surface, tested for people (browser), agents (worker test) and frames (allowlist test). Its value for the remaining templates is still a hypothesis until Data (T03-DATA) reads and publishes through it.
