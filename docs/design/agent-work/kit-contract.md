# Design's HTML kit and Code's binding to it (W-29 #2)

Status: spec for review at W-29's phase 1 gate, 2026-10-06. It decides nothing that DEC-070 left to the owner. Lettered choices (K1–K6, B1–B6) are the defaults #4–#6 build unless the owner changes them at the gate.

Sources:
- [DEC-070](../../decisions.md);
- [the spike](kit-spike/README.md), which this spec answers;
- the layer contract's facets, bindings and drift (`layer-base/docs/layer-contract.md`);
- Design's records (`apps/portal/server/design.mjs`);
- Code's unit indexer (`server/code-units.mjs`);
- the binding core (`server/bindings.mjs`).

## What the spike changed

The generator reproduced Design's records faithfully. Biome still diverged, because its look is written in its code. So the kit's value rests on two things:
- Design holding the whole look. Contracts need enough to draw every component, including app-specific ones.
- Code's binding surfacing every place where the code and Design disagree.

Hence the contract additions (K3, K4) and drift as a first-class, measured state (B3).

## The kit (Design)

**K1. One kit per Design revision, computed, addressed by digest.**
- The kit is a pure function of Design's `kit` facet: the token set, the component contracts and the brand. A revision of any of them is a new kit.
- It is served from Design's API as `kit.js`, at a URL carrying the facet's content digest, so any page can pin it. A `latest` alias redirects to the current digest.
- The generated app gets the same file as `design/kit.js` beside `design/tokens.json` (`designFiles`), so the code has its reference in the repository too.
- Nothing is stored that the records can't recompute, so the kit never drifts from Design.

**K2. Elements.**
- *Names:* each contract becomes the custom element `<prefix>-<name>`. The prefix is the project's slug, for example `biome-button` (`kit-` in the spike).
- *Attributes* are the contract's props:
  - a variant or swap takes one of its options;
  - text is a string;
  - a boolean is true when present, as in HTML.
  - Only variant defaults apply to an element. Text and boolean defaults are demo content (K3); the spike found them leaking into real screens.
- *Slots:* each contract slot is a named slot, and content without a slot name goes in the default slot.
- *States:* hover, focus-visible and pressed are drawn with the token set's state layers, and `disabled` is an attribute. A `state` attribute forces one state, so demos can show each.
- *Accessibility:* each element meets its contract's `a11y` lines (native button, label as name, focus ring, 48 px target). A demo that fails axe is a kit bug.
- *Theme:* the token variables are the generated app's own (`tokenVariables`, `--mat-sys-*`), in light and dark. A page sets `data-theme` to force one.

**K3. Contract additions (component records).**
- `demo`: the values a demo shows (for example `{ props: { label: "Continue" } }`) and the children a demo puts in each slot (`{ slots: { items: [{ component: "cmp-…", props: {…} }] } }`). The four container components drew empty in the spike without this. The seed gains demos for every seeded component.
- `template`: optional, for a component the preview catalog can't draw (Biome's world map, option tile, stat row).
  - It holds an HTML fragment and its CSS, styled with token variables only, using `<slot>` for slots and `{{prop}}` for text props.
  - It's checked when saved: no script, no event handlers, no external URLs, and no colour or font literal outside token variables.
  - A contract with neither a preview kind nor a template draws as a labelled "can't draw" placeholder. Its status stays *specified* until it has one, so the gap is visible in Design, not only in a mockup.

**K4. Tokens only.** Element CSS (generated or `template`) reads colour, type, corner, elevation and motion from token variables only. That keeps a kit faithful to a revision. It also makes adoption (B4) a change to tokens or contracts, never to the kit.

**K5. The kit is not built from the code** (DEC-070 (1)). For an existing app, Design's records are brought to the app's look by adopting drift (B4), and the kit is regenerated from them.

**K6. Demos.** Design's Components tab draws each component from `kit.js`:
- with its demo values;
- in each state, and in light and dark;
- with the contract's props as live controls that set attributes.

The Angular `kit-render.ts` stops drawing Design's demos. Pages' spec view keeps it until the follow-up item (wrk-165e7144) moves page specs to kit HTML.

## Code's binding (DEC-070 (2))

**B1. A binding is declared where the code is.** A UI component says which kit element it implements, in either of two ways:
- *An app's own component:* a doc tag on its class, `/** @kit biome-button */`. The Code indexer records it on that `code_unit` as `kit: { element }`. It's read at the indexed commit, like the rest of the unit.
- *A library component used directly* (the scaffold uses Angular Material's `button[matButton]` without a wrapper): Design's contract already names it in `binding.selector`. Code observes where that selector is used in templates and counts those usages as bound to the contract.

Nothing is declared in the portal, because Code observes code (its charter). A person or agent changes a binding by changing the tag in the code.

**B2. One project binding for the design system.**
- Design's `kit` facet is the authority. Code gains a `ui` facet: `code_unit` entries whose kind is `component`, shape `aludel.code-ui`, role replica. Pages' `kit` facet stays a replica, as today.
- This is the binding the layer contract already describes ("the app's design system"). Code needs no adapter: it never copies Design's records, it only points at them. The binding compares what each side publishes.

**B3. Drift is measured per bound component, statically, at each indexed commit.**

| State | When |
|---|---|
| In sync | The element exists in the kit, and the contract's props match the component's inputs (by name; variant options by value where the input's type lists them) |
| Contract changed | Design's contract changed since the last agreed sync (binding baseline). Code hasn't followed. |
| Code drifted | The component changed since the last agreed sync, and its inputs now differ from the contract (a prop added, removed or renamed) |
| Unknown element | `@kit` names an element the kit doesn't have |
| Unbound | A UI component with no `@kit` tag. Listed, not an error: not every component is a design-system part. |

*Look drift* (computed colours, type and corners of a bound component compared with its kit element, which is what the spike saw by eye) needs a running build. It is proposed as a follow-up, using W-27's tunnelled preview. #6 measures the static states above.

**B4. Responses** (the binding's drift policy, settable per project):
- *Contract changed* propagates as **rectify** Work in Code: "make `ButtonComponent` follow Button r3", with the contract diff.
- *Code drifted* is **assessed** by default. The owner decides:
  - **adopt** stages the code's props into the contract, as Design Work;
  - **rectify** raises Code Work to change the code back.
- *First reconcile of an existing app:* a bound component whose element has no contract raises **adopt** Work to create the contract, with a `template` drafted from the component. A person reviews it; it isn't applied automatically, as K5 requires. This is how Biome's option tile and world map would enter Design.

**B5. Design's `binding` field.** A contract's `binding` (library, selector, prop map) stays: it says how this stack builds the component by default, and the scaffold uses it. "Built" status comes from Code: a contract is *built* when at least one Code component or selector usage is bound to it and in sync. Otherwise it's *specified*, with the drift state shown.

**B6. Where people see it** (specs in #3):
- *Design › Components:* each component shows its Code bindings and their drift state.
- *Code:* the units Explorer shows a UI component's kit element, its state and the open Work, with a filter for drifted and unbound components.

## Not in this item

These are the follow-up's (wrk-165e7144):
- page specs as kit HTML;
- the Pages walker;
- View source and the kit drawer;
- retiring `kit-render.ts` from Pages.

Proposed separately: look drift from a running build (B3), and kit fonts (the spike drew icons from a glyph table; #4 loads Material Symbols from the generated app's own font).

## Open for the owner at the gate

- **K1, serving vs storing:** the kit is served from Design's records, plus a copy in the generated repository. The alternative is Design committing `kit.js` to its own repository for each revision. Default: served.
- **B1, `@kit` doc tags vs a `.aludel/kit-bindings.json` map:** tags keep the binding beside the code. A map works for code that can't carry comments. Default: tags, with the map as a fallback.
- **B4, default drift response:** assess, so the owner decides each case. Default: assess.
