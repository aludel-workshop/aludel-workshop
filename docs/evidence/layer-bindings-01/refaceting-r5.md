# LAYER-BINDINGS-01 step 3, R5: overlap and journeys — 2026-10-01

## Scope and authorization

Owner chat, 2026-10-01: "yep, just make sure you're noting any of that follow up work somewhere it wont get lost", in reply to "Should I commit R4 and start R5?". R4 was committed first (candidate `38f4d57`, workshop `9e483a1`). The follow-ups now live in the [work record's Follow-ups](../../../../docs/design/layer-bindings/work-record.md#follow-ups-kept-here-so-they-arent-lost) (F1–F11), with pointers from status. The R5 scope is recorded in the [run log](../../../../docs/design/layer-bindings/work-record.md#run-log). It made local `layer-base` commits and re-pins; nothing was pushed, and there were no GitHub, provider, deployment, spending or live-data effects.

## What was built

| Piece | Where | What it does |
|---|---|---|
| Declare a facet | `bindings.mjs` `refacet` (`op: 'declare'`) | A layer with no facets (or outputs in none) declares a facet over them. This is how a new layer from the Markdown or base template starts to share. It can't take what another facet holds (split that one instead), and it may join a named binding. |
| `refers` | `layer-base` `main` `7aa03ba` (contract text and test), `bindings.mjs` `validateRefers`, `layer-package.mjs`; Pages `5b6b0f9` declares `["page", "persona", "brand_asset", "activity", "story"]` | The kinds a layer's references can name, or `["*"]` for Library pins. |
| Frame rule (F2) | `layer-base` `main` `7aa03ba` `docs/layer-contract.md` | Views run sandboxed without dialogs and never name their own layer. |
| Re-point Work | `binding-routines.mjs` `raiseRepoints` | After each Watch pass on a binding with a ceded participant, it finds other layers' references into the ceded entries (the R3 index) and computes R1's `repoint` with each layer's `refers`. It raises re-point Work, or adapter Work where the layer can't name the authority's kind, each exactly once, even after the item closes. |
| Adopt names its result | `binding-routines.mjs` `adopted`, `POST …/bindings/:id/adopted` | An adopt item closes by naming the authority's entry it produced, which must exist there. That pairs the ceded entry with its counterpart, which re-pointing needs, and the next pass settles it. |
| Assess overlap | `binding-routines.mjs` `discover` | Two layers' facets that share a hint and aren't bound together raise soft "Assess overlap" Work (type research), once per pair. Nothing matches automatically. Vision's `intent` now carries the `personas` hint (`vision` `58eb74f`). |
| Manage › Facets | `src/layers/layer-facets.ts`, `layer-manage.ts`; `GET …/layers/:key/refacets`; the roles route adds `select` and `outputs` | Each facet with what it holds, its role and its entry count. Declare (for outputs in no facet), split (whole kinds, or one kind by one field and values), merge and rename are proposed as Work. Proposed refacets show their preflight: what moves, what is held aside in which binding, which layers should follow, and how many references point in. The owner can Accept or Dismiss each. |
| Journey tooling | `tools/browser-checks.sh` | A failing journey now also prints the server's own error lines. Routines log and carry on, so a journey only sees a missing effect. |

## Checks (all run 2026-10-01 on this working tree and these pins)

| Check | Result |
|---|---|
| `tests/overlap-work.test.mjs` (templates on) | The whole Personas story on the pinned templates passes:<ul><li>Personas (Markdown template) declares `people`, and Discover raises Assess overlap once.</li><li>The chain refacets Vision (`intent` → `intent` + `personas`) and binds them.</li><li>Both personas are offered as adopt Work in Personas. An adopt naming the offered entry rather than a new one is refused, and each closes naming its document.</li><li>Pages' flow referencing a persona raises adapter Work once, not again after closing (Pages can name `persona`, not `markdown_document`).</li><li>Editing or creating a Vision persona is refused.</li><li>Merge back: transfer to Vision, Personas' documents come back as Work, merging is refused while the binding is live, then retired and merged, and Vision edits personas again.</li></ul> |
| `tests/refacet.test.mjs` | The new `declare` test passes (31 in the file, with `bindings.test.mjs`). |
| `tests/refacet-work.test.mjs` | Adds: the bound design-system kits (both marked `design-system`) aren't raised as an overlap. |
| Mutation check | 8 of 9 caught. The survivor ("declare may move held entries") is unreachable by construction: a declared facet that overlaps another is refused before membership is checked. That branch of the shared invariant stays as a guard. |
| New journey `overlap` | Pass, through the UI:<ul><li>Personas declares a facet in Manage › Facets; Accept.</li><li>Assess overlap raised.</li><li>Vision's split is proposed by the chain and accepted in Vision's Manage › Facets, whose preflight shows "Moves 1 persona" and the 1 reference from Pages.</li><li>The binding is accepted, and Vision's Brief says "Now managed in Personas" with no way to add a persona.</li><li>Adopted and paired; Pages gets Work.</li><li>Merged back with Merge in Manage › Facets, after which Vision adds personas again.</li><li>Axe and 390px.</li></ul> |
| New journey `branding` | Pass:<ul><li>Branding declares a facet.</li><li>One chain refacets Design and Pages; the binding refuses to be accepted until both are.</li><li>The design-system binding holds nothing afterwards, and Pages keeps every kit item.</li><li>Design's Brand says "Now managed in Branding" with no Add asset.</li><li>Library › Bindings shows Pages' brand kit "needs an adapter for Branding's brand" and Design's brand ceded.</li><li>Design's brand assets are offered to Branding.</li></ul> |
| Journeys, full set (12) | All pass: `overlap`, `branding`, `roles`, and step 2's nine. |
| Suites, typecheck, build, per-pin | `test:server`: 273 tests, 258 pass, 15 skipped. `test:server:templates`: 273 tests, 266 pass, 7 skipped. None failing or cancelled. Typecheck and build exit 0. Per-pin: pages `5b6b0f9` (9 files) and product `58eb74f` (1 file) type-check; design `a924ed2` is unchanged since R4. The contract test passes on `main`, `pages` and `vision`. |

## Limits

- **Assess overlap matches only shared hints.** Facets that describe the same thing under different hints aren't noticed. The assessment itself is a person's or an agent's (soft Work); no agent run does it here.
- **Adopt and re-point are recorded, not performed.** An adopt is done by whoever does the Work and closes by naming the result. Re-point and adapter Work are raised in the referencing layer; nothing rewrites references automatically, by design (default 3).
- **The Branding journey's adapter is left unwritten.** Pages' brand kit shows the adapter it needs. Writing one is ordinary layer Work, not refaceting.
- **Overlap chains are API-only.** Manage › Facets proposes single refacets; the chain (refacets plus the binding they unblock) is proposed through `POST /overlaps`, as the answer to an Assess overlap item. A UI for answering an assessment is a follow-up (F12).

## Retrospective

1. **What made it harder?** Observed:
   - **Two journey failures were self-made:** the `/knowledge` response nests its data under `knowledge`, and a refaceted layer's frame is rebuilt for its new pin before it opens.
   - **One was invisible:** the server's errors went to a log the journey script deleted. I added printing the server's error lines on failure, then confirmed the real cause was the journey's own read.
   - **Markdown requires a folder** before a nested path. The test now uses top-level documents.
2. **What would make the next one easier?** The journey tooling change applies to every journey. Journeys that refacet should wait on the frame with a long timeout, as these two do.
3. **What did it reveal?**
   - **Adoption needs a recorded result.** Without the authority's entry named on the adopt item, re-pointing has no pairs.
   - **Custom layers need `declare`.** Without it, nothing built from the Markdown or base template could ever be bound.
   - **Both are now part of the model.**
4. **Questions.** None block closing step 3. F12 is new.
5. **Process change applied now.**
   - The journey script prints server errors on failure. It was exercised once: it showed none, which pointed at the journey itself.
   - The follow-ups table was applied as asked; R5 added F12.
