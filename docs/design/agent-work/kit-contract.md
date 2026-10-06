# Design's HTML kit and Code's binding to it (W-29 #2)

Status: spec for review at W-29's phase 1 gate, 2026-10-06. It decides nothing that DEC-070 left to the owner. Lettered choices (K1–K6, B1–B6) are the defaults #4–#6 build unless the owner changes them at the gate.

Sources:
- [DEC-070](../../decisions.md);
- [the spike](kit-spike/README.md), which this spec answers;
- the layer contract's facets, bindings and drift (`layer-base/docs/layer-contract.md`);
- Design's records (`apps/portal/server/design.mjs`);
- Code's unit indexer (`server/code-units.mjs`);
- the binding core (`server/bindings.mjs`: correspondence, policy and adapters).

## What the spike changed

The generator reproduced Design's records faithfully. Biome still diverged, because its look is written in its code. So the kit's value rests on two things:
- Design holding the whole look. Contracts need enough to draw every component, including app-specific ones.
- The project's binding between Design and Code surfacing every place where they disagree, under its own drift rules.

Hence the contract additions (K3, K4), and Code's binding as an ordinary project binding with drift rules (B1–B6).

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

*Revised 2026-10-06 after the owner's review of #2: "bindings happen at the project level, we already have a system in place for that. theres some representation in design, another representation in code: a binding says how each relate to each other, the rules for authority, conversion, all that. it shouldn't need the actual code itself to have tags. should have rules for drift as part of it as well." The first draft's `@kit` tags and drift states outside the binding are withdrawn.*

The binding is an ordinary project-level binding record (LAYER-BINDINGS-01, `server/bindings.mjs`, Library › Bindings). Design and Code each keep their own representation, and the binding holds everything that relates them. Nothing is declared in the code.

**B1. Two representations, one binding.**
- *Design:* the `kit` facet (tokens, component contracts, brand), shape `aludel.design-kit`, as declared today.
- *Code:* a new `ui` facet, holding the UI components Code already indexes (`code_unit` entries whose kind is `component`) with what the indexer reads from each: its selector, inputs and their types, and outputs. Shape `aludel.code-ui`, roles replica or authority. This is Code's own description of its components, kept whether or not a binding exists (DEC-068 (1)).
- *The binding:* "Design system", with Design's `kit` as the authority, Code's `ui` as a replica, and Pages' `kit` as a replica, as today.

**B2. Correspondence: which Code component is which Design component.** This is the binding's `correspondence`. Each entry has a concept key (the component's name, for example `button`) and the ref on each side (`cmp-…` in Design, the `code_unit` in Code).
- Entries are matched automatically by concept key: Code's adapter derives the key from the component's name or selector, and Design's from the contract name.
- A person confirms or corrects a match in Library › Bindings, and can mark a Code component as not part of the design system.
- A library component used directly (Angular Material's `button[matButton]`, which the scaffold uses without a wrapper) corresponds through the selector the contract's `binding` already names. Code's adapter finds its usages in templates.

**B3. Conversion: Code's adapter.** Code owns an adapter that reads `aludel.design-kit` (layer contract, "Using another layer's output"):
- *Mechanical part:*
  - maps a contract's props to a component's inputs (by name, and a variant's options to the input's union type);
  - maps its slots to content projection;
  - publishes, for each corresponding pair, the comparable form both sides are checked in.
- *Soft part (agent):* what can't be mapped mechanically, such as a component with a `template` and no inputs that say the same thing, or a renamed prop. It works as Work in Code.
- The reverse direction (code to Design) is the same adapter read the other way. It drafts contract changes, which only ever arrive as **adopt** Work for a person to review (K5).

**B4. Authority and drift rules are the binding's `policy`.** Default policy, set when the binding is proposed and changeable in Library › Bindings:
- *Design (authority) changed* (added, changed, removed): **propagate**. The binding raises rectify Work in Code with the contract diff, for example "make `ButtonComponent` follow Button r3".
- *Code changed outside the binding* (drift), per event:
  - an added component is **assessed**;
  - a changed one is **assessed**;
  - a removed one is **rectified**.
  
  An assessment is decided as **adopt** (the code's change becomes a contract change, as Design Work) or **rectify** (Code Work to follow the contract).
- *First reconcile of an existing app:* Code components with no contract raise adopt Work to create the contract, with a `template` drafted by the adapter's soft part. That's how Biome's option tile and world map would enter Design, reviewed, never applied automatically.
- Authority can move. For example, a project can make Code the authority for implementation details by ceding them through a refacet. That's the binding system's existing transfer and refacet, nothing new.

**B5. Status.** The binding's evaluation (`evaluate`) gives each correspondence entry a status: in sync, authority changed, drifted, unmatched, or conflict. That status is what people see. A contract is *built* when a Code entry corresponds to it in sync. Design's `binding` field (library, selector, prop map) stays as the stack's default for the scaffold and the selector match in B2.

**B6. Where people see it** (specs in #3):
- *Library › Bindings:* the correspondence, the policy and the Work, as for every binding.
- *Design › Components:* each component shows its Code counterpart and status, from the binding.
- *Code's Explorer:* a UI component shows its Design counterpart and status, from the binding, with a filter for drifted and unmatched components.

Neither layer declares the binding. Each reads it.

*Look drift* (a corresponding pair's computed colours, type and corners compared on a running build) is proposed as a follow-up. #6 compares the published shapes.

## Not in this item

These are the follow-up's (wrk-165e7144):
- page specs as kit HTML;
- the Pages walker;
- View source and the kit drawer;
- retiring `kit-render.ts` from Pages.

Proposed separately: look drift from a running build (B3), and kit fonts (the spike drew icons from a glyph table; #4 loads Material Symbols from the generated app's own font).

## Open for the owner at the gate

- **K1, serving vs storing:** the kit is served from Design's records, plus a copy in the generated repository. The alternative is Design committing `kit.js` to its own repository for each revision. Default: served.
- **B4, default drift policy:** assess code-side additions and changes, rectify removals, and propagate Design's changes as rectify Work. It's set per project in the binding.
