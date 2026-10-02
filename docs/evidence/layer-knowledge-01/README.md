# LAYER-KNOWLEDGE-01: Knowledge as the layer's manual, built (K5) — 2026-10-01

## Scope and authorization

Owner chat, 2026-10-01, after reviewing prototype v1: "love love this prototype … no second prototype needed: work these changes into plan, and build it". The review rows B1–B7 and the plan S1–S6 are in the [brief](../../../../docs/design/layer-knowledge/work-record.md#k5-build-plan-owner-approved-direction-2026-10-01). The work stayed local: candidate and `layer-base` commits and re-pins, no push, and no external, provider, deployment, spending or live-data effects.

## What was built

| Slice | What | Where |
|---|---|---|
| S1 Spec contract | `layer.json` `information`: a tree of parts, each with `intent`, `select`, `tab`, optional `shape` and `doc`. It is validated by the host and by the base contract test.<ul><li>Every node names an editor tab.</li><li>A part sits inside its parent, and siblings don't overlap.</li><li>`folder` is derived from an entry's path, so a Markdown folder is a part.</li></ul>`nodesToChange` turns ticked parts into one refacet per layer: declare, split (the renegotiation), or reuse. It refuses parts held in two facets, or a whole group already shared. | `server/information.mjs`; `layer-base` `main` `fee5f30` (contract text and test); specs on `markdown` `11f82de`, `data` `fc9a6f3`, `design` `550f846`, `vision` `e54c3f3`, `pages` `4138bef` |
| S2 Docs in the repository | Knowledge lists and reads a layer's docs at its pin. **Save takes at once**: one commit on `main` that becomes the pin.<ul><li>**History:** every version is kept, and any two can be compared.</li><li>**Conflicts:** a stale save to the same doc is refused, but a stale save to another doc still takes.</li><li>**Checks:** every save passes the package check, and a `main` moved outside Aludel is never written over.</li></ul>A custom layer's charter is still its identity: seeded with the prompted headings, saved to both places, and driving activation. The spec (`information`) is saved whole and raises **Compare specs**. Views are built by what they compile, not by commit, so saving docs or the spec doesn't rebuild them. A refacet proposed before a docs save is still accepted. | `server/layer-docs.mjs`, `layer-ui.mjs`, `refacets.mjs`, the `knowledge/(docs\|doc\|history\|information)` routes |
| S3 Knowledge tab | A docs-site layout:<ul><li>one sidebar with **Docs** (overview, charter, methods, editor tabs) and then **Information**;</li><li>local parts first, then a **card per binding** (live or proposed) holding its parts, saying who leads (★);</li><li>search, and an on-this-page outline.</li></ul>Pages: overview; doc (edit with preview, Save, History and compare); Information (add a part); part (about, parts, shape from the API schema when unstated, contents from the Library linked to the editor tab, sharing, referenced by; Edit and Remove); binding (participants with ★ lead, what changes, activity, Accept or Dismiss in one step). The layer header is compact (B2). **Manage › Connections and Manage › Facets are gone**. | `src/layers/layer-knowledge.ts`, `layer-manage.ts`, `shell.ts`, `styles.scss`; `server/knowledge-site.mjs` (`site`, `contents`, `binding`) |
| S4 Bind from the tree | **Select** ticks parts (children come with them), or use **Bind…** on a part. **Propose a binding** opens a grid:<ul><li>one card per layer, plus an **Add a layer** card;</li><li>a **Lead** toggle on each card;</li><li>**Keep a local copy** for each other layer (unchecked means it hands over);</li><li>a name, and "how the parts match".</li></ul>A live preview lists what changes: each side's role, references that will need Work, and the bindings renegotiated. Propose creates the existing chain (each layer's refacet, then the binding proposal waiting on them), with the parts recorded on it. Accept decides all of it, and Dismiss dismisses all of it. **Compare specs** replaces hint matching. | `server/knowledge-site.mjs` (`preview`, `propose`, `decide`), `binding-routines.mjs` (`specChanged`; Assess overlap removed) |
| S5 Pages Kit tab | Pages' kit is part of its information, so it has a **Kit** tab:<ul><li>While the kit follows a lead (the design-system binding), the tab is a read-only copy, with the role note and "Propose a change". The host also refuses writes to it.</li><li>When it follows no one, it is Pages' own and fully editable: start a token set, edit palette colours, and add, rename or remove components and brand assets.</li></ul>New operations are `createKitItem`, `updateKitItem` and `deleteKitItem`. Own items name no source. The kit facet can now lead (F9's prerequisite). Pages' own items in a copy are marked as such. | `layer-base` `pages` `cc47645`, `1cbeb03`; `config/layer-reviewed-sources.json` (Pages handler `bf0679d…`) |

## Checks (all run 2026-10-01 on this working tree and these pins)

| Check | Result |
|---|---|
| `tests/information.test.mjs` | 7 tests pass. Mutation check: 21 of 21 guards caught. |
| `tests/layer-docs.test.mjs`, `tests/knowledge-site.test.mjs` (templates on) | 9 tests pass. Mutation check: 23 of 23 caught. One redundant guard, an early spec validation duplicated by the package check, was removed rather than tested twice. The refacet re-commit guard is included. |
| Pages template tests, base contract test on every branch | Pages: 16 pass (kit operations included). Contract: passes on `main`, `markdown`, `data`, `design`, `vision` and `pages`. |
| `typecheck-layer-ui` per pin | pages `1cbeb03` (10 files), design `550f846` (6), product `e54c3f3` (1). |
| Journeys (templates on) | 13 run; 12 passed on the first full run: `bindings`, `design-layer`, `pages`, `library`, `vision-layer`, `data-layer`, `product`, `workflow`, `roles`, `branding`, and the new `knowledge` and `kit`. `layer-bar` failed axe: an active sidebar link in a layer's chosen colour lacked contrast. It was fixed (ink text, with a colour bar to mark the active item) and `layer-bar` and `knowledge` pass on rerun. R5's `overlap` journey is retired: its Manage › Facets steps no longer exist, and `knowledge` walks the same Personas story through the tree. Its server test (`overlap-work`) keeps the merge-back. |
| Suites | `test:server`: 289 tests, 265 pass, 24 skipped. `test:server:templates`: 289, 282 pass, 7 skipped. None failing or cancelled. After the full run, three things changed: the survivor tests were added, a redundant guard was removed, and the contrast fix went in. Those test files pass (9), and the two affected journeys pass. Build and `ngc` typecheck exit 0. |

## Limits

- **Legacy database documents** (`layer_documents`) no longer show in Knowledge; templates' docs are read from their repositories. Existing projects are out of scope, as for LAYER-BINDINGS-01.
- **One facet per layer per binding.** Parts held in two facets, or a whole group already shared elsewhere, are refused with a message saying how to proceed.
- **Own kit components can't be section components yet.** A page section's component reference must be a design-system `component` record. Pages' own components are drawn in the Kit, but sections can't pick them until references accept kit items.
- **The token editor is light.** Pages' own tokens are edited by palette colour; the full role and type editing stays in Design.
- **Compare specs is a task, not a run.** The owner chose this: a person or an agent picks it up.
- **Search covers titles and intents**, not doc bodies.

## Retrospective

1. **What made it harder?** Observed:
   - **Doc saves moving the pin would have triggered two side effects:** rebuilding every view, and refusing open refacets. Both were found while designing S2 and fixed before they shipped (content-keyed builds; refacets re-committed when only docs moved).
   - **A full-suite run overlapped edits to `server.mjs`.** One server-start test failed in that run and passed alone.
   - **The kit journey and the knowledge journey each needed several selector fixes.** Icon text is part of accessible names, and a navigation clears the shell's notice.
2. **What would make the next one easier?** Mutation checks ran in an isolated worktree with `../layer-base` symlinked beside it, so they could run while the suites ran on the real tree. That removes the R3 lesson's limit (a scratch worktree couldn't reach `layer-base`); recorded in the work record.
3. **What did it reveal?**
   - **Facets as the hidden form of bound parts holds up:** every story (Personas, Branding's renegotiation, Pages' kit) ran through the existing chain.
   - **A layer's docs are now versioned with its code.** That makes the pin move more often, which other pin-keyed caches must tolerate.
4. **Questions.** None block. New: should a section be able to use a component from Pages' own kit? (It needs references to accept kit items.)
5. **Process change applied now.**
   - Mutation checks in an isolated worktree with a `layer-base` symlink. Exercised once: 44 mutants ran while both suites ran.
   - Screenshots from the journeys (`KN_SHOTS`), viewed before closing, which caught the uppercase headings, unstyled secondary buttons, a missing icon and the long copy list.
