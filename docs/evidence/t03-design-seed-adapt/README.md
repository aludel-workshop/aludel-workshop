# T03-DESIGN-SEED and T03-ADAPT — 2026-09-30 to 2026-10-01

## Scope and authorization

After T03-DESIGN, the owner said in chat that Design's starter belongs in its template ("oversight it isnt"). They also said that a source must never have to adopt "the Aludel way": each consuming layer owns an adapter from what a source publishes to its own representation, and for now we build only that boundary. They then said "go". The run is recorded in [the T03-DESIGN brief's run log](../../../../docs/design/layer-app-transition/t03-design-brief.md#run-log). Work covered local code, tests and evidence in `pages-template-candidate` and `layer-base` only: no GitHub or provider writes, provider turns, deployment, spending or live owner data.

Final pins: `design` `64e916f`, `pages` `96194a1`, base `main` `2449ff8`.

## T03-DESIGN-SEED: the starter kit is Design's

- **New contract piece, layer seeds.**
  - A manifest declares `api.seeds` (`install`, `look`), and the handler exports `seed(event, context)`.
  - The host passes the project facts every layer may use (name, description, look) and the instance's records. It checks the returned writes exactly as it checks an operation's (shared `checkWrites`) and applies them as Aludel, with each write's note as its rationale.
  - `install` runs once per instance, recorded after it succeeds. `look` runs when the Look & feel changes.
  - The host's compiled kit seeding now runs only for kinds no installed template seeds.
- **Design's seed** (`server/design-api.mjs`) holds:
  - the Look & feel token set, with the colour maths ported unchanged;
  - the aludel-web-v1 component seeds, with nesting and slot references;
  - the brand starters from the name and pitch;
  - the Look & feel sync for a token set still marked `fromLook`.

  It fills only kinds the instance has none of, so an adopted project gains nothing.
- **Brand templates** moved into the Design views (`ui/design-brand-templates.ts`) and are added through `createBrandAsset` like any asset. The `brandTemplates` host feature is gone.
- **Stays with the host:** the Library documents created at onboarding ("Design direction", "Accessibility baseline") and onboarding reference media. They are Library content, not Design outputs.
- **Side effect, measured:** seeding is now one handler call per instance instead of about 36.
  - Start-up of a portal on two unseeded projects, templates on, went from 5.4 s (T03-DESIGN) to 3.3 s.
  - That is slightly faster than before Design was converted (3.6 s).

## T03-ADAPT: Pages reads the kit through its own adapter

- **Pages owns an adapter.** `ui/pages-kit-adapter.ts` holds the Library kinds an adapter reads and a pure mapping into Pages' kit representation, which is the host app kit's render shape.
  - The first adapter reads an Aludel-style kit (`design_tokens`, `component`, `brand_asset`) and is nearly a pass-through.
  - A source is whichever Library layer publishes the adapter's first kind. Only that layer's entries are used.
  - A Figma design-system source would be a second adapter in this file; the source changes nothing.
- **No layer named in Pages.**
  - Links that pointed at Design's tabs (`ctx.link('design', 'components' | 'brand')`) now go to the source layer's own path, or to a component's Library entry, which opens it in its own layer.
  - Labels use the source layer's name: "Needed in Design" becomes "Needed in {source}".
- **The host app kit no longer reads anything.** `loadKit` and the fixed kit kinds were removed. The host keeps only the shape and the renderer, a rendering contract rather than a requirement on sources.
- **Design reads no later layer.** The components preview's nav samples, the token preview's sample navigation and its icon list read the project's pages. They now use example destinations and the preview icon set.
- **Base contract** (`main` `2449ff8`) documents seeds and "Using another layer's output": consumer-owned adapters, source chosen from the Library, links to the source's own path or its Library entries.

## Checks

- **Template branches:** `design` 9 pass, 2 base-contract skips. Two new tests:
  - a new instance's seed equals what the portal seeded (tokens, all 15 components with parents and slot references by name, the brand starters);
  - seeding fills only empty kinds, and the Look & feel sync follows only an untouched token set.

  `pages` 10 pass, 2 skips.
- **Host, `tests/design-layer.test.mjs` (6):**
  - a new project's kit comes from the template (layer-seed flag only, no compiled seed flags);
  - authors, rationales and nesting are right;
  - install runs once;
  - a Look & feel change follows an untouched token set and leaves an edited one alone;
  - an adopted project gains no second set of starters.
- **Server suites** (at `design` `e7ffd0e` and `pages` `3ed155a`; the later pins changed documentation only):
  - templates off: 223/223;
  - templates on: 216 pass, 0 fail, 7 explained skips.

  One templates-on run failed `symphony-worker` with a portal start-up past its 8 s allowance. It passed alone 2/2, and `editor-bridge` had the same failure earlier. Both tests now give a spawned portal 20 s, with that reason stated.
- **Final pins:** on the final pins, the suites were rerun: templates off 223/223, and templates on 216 pass, 0 fail, 7 explained skips.
- **Typecheck, build and template views:** `npm run typecheck` and `npm run build` pass at the final pins. `tools/typecheck-layer-ui.mjs` passes for `design` and `pages`.
- **Browser, templates on:**
  - `design-layer` passed 5 of 5. It covers Pages' preview in the saved theme, the empty kit with Design off, and brand templates now added through Design's API.
  - `pages` (it renders kit components chosen through the adapter), `vision-layer`, `data-layer`, `library`, `layer-bar` and `layer-scope` pass.
  - `design-layer` and `pages` were rerun on the final pins.
- **Browser, templates off:** `design`, `pages` and `layer-bar` pass.
- **Reviewed sources:** every handler at every pin is on the reviewed list. The new `design-api.mjs` digest was added beside the earlier one.

## Limits

- **Source choice is the first match.** If two layers publish the same kinds, Pages takes the first. The existing connection records (receiving and source layer, mapping, reaction, proposed → active review) are where a chosen source and its evolving description belong. Wiring them in, and letting routines propose adapter changes, is the next step of the owner's connection idea. It was not built here, by agreement.
- **Code still reads the kit from the project store** for the scaffold. T03-CODE should give Code its own adapter.
- **One edge case on adoption.** A templates-off project whose owner deleted every brand asset would get the starters again once, when Design's template first seeds that instance: the template sees an empty kind, not the old host flags.

## Retrospective

1. **Harder than necessary (observed):**
   - A git-ignored, host-compiled copy of the Pages views (`src/installed/pages`, synced from the Pages pin before typecheck and build) still used the removed `loadKit`. Typecheck failed until the pin moved, which was correct but surprising.
   - The first parity comparison failed only on record order.
   - Changing pins between full runs meant rerunning.
2. **Easier next time:**
   - When a host SDK export is removed, run `npm run typecheck`, which syncs the pinned Pages copy, before claiming the host is clean.
   - Compare seeded record sets by stable names, not order.
   - Pin last, then run the suites once.
3. **Roadmap effect:**
   - Every converted layer should own its starters through `seed`. Vision's seeding (Brief, plan, story packs) is the next candidate.
   - T03-CODE gets its own kit adapter and should not add hard-coded reads.
   - Wiring connection records to adapter sources is the follow-up for the owner's connection idea.
4. **Questions:**
   - Created: when two sources match, should a person pick (through a connection record) or the adapter? Not blocking until a second source exists.
   - Resolved: layer-scoped Work for all layers, and Design's starter in its template.
5. **Process change applied and tested:**
   - Seeds and adapters are documented in the base contract and exercised by tests and journeys.
   - The start-up allowance was aligned across both portal-spawning tests after the same failure was seen twice.
   - Whether adapters stay cheap for a structurally different source (Figma) remains a hypothesis until one exists.
