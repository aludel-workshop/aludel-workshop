---
id: design-ux-01
kind: work-record
status: built-agent-checked
updated: 2026-09-24
depends_on: [portal-layers-knowledge-structures, design-system-strategy-001, roadmap-01]
---

# DESIGN-UX-01: the Design layer UX pass

## Authorization and scope

- **Owner instruction (chat, 2026-09-24):** a UX pass on the Design layer. The owner discussed implementation ideas first and then said: "everything looks good, confirm your qs. make me one of your pretty prototypes." (DEC-029 interim chat authorization, DEC-044 pass pattern.)
- **Authorized now:** research, this record, and a static clickable prototype (v1) with illustrative Tool Share data. Reference screenshots of public pages are stored in `refs/`.
- **Excluded:** portal code, schema or data changes, provider calls, spending and external writes. The build waits for owner acceptance of a prototype round.

## Owner brief ledger

| # | Ask (condensed) | Position | Prototype v1 |
|---|---|---|---|
| D1 | Support something as deep as Material 3 | Required | Tokens in three tiers (raw values, roles, rules) in W3C DTCG form; MD3 is a starting set, not built in |
| D2 | Brand media: logos, bugs, splashes, any asset | Required | Brand tab |
| D3 | Components rendered and interactive, with a panel for variants | Required | Components tab |
| D4 | Live and dynamic, not value-entry fields: tweak the card and see the card | Required | Tokens tab: tree and live preview |
| D5 | Keep the Design layer separate from implementation if possible; showing built components is fine | Agreed | Contract in Design, binding in Platform, preview renders the real stack components (the prototype imitates them) |
| D6 | The user is a designer who doesn't code | Required | Direct editing only; no code shown except the Platform binding |
| D7 | Tree and preview only; no inspector pane | Required | Tokens tab has two panes |
| D8 | Hovering a token highlights it in the preview | Required | Outlines and labels; "Used on" note when it isn't on the page |
| D9 | Primitives are the first tree sections, set apart as raw values | Required | "Raw values" heading, muted rows, divider |
| D10 | Palettes laid out like the owner's reference image; edit the boxes directly | Required | Palettes page; click a box to edit, key colour regenerates the row, pins |
| D11 | Composite rules such as elevation: surface fill plus shadow, possibly relative to the surface underneath | Required | Rules › Elevation; "Sitting on" control and a relative-shadow rule |
| D12 | Motion and complex behaviours like drag and drop | Required | Motion page (easing curves, springs) and Behaviour page (drag and drop contract and demo) |
| D13 | The preview feels like a small app you can page through, even while looking at theme tokens | Required | Preview pages with previous/next, dots and sample screens |
| D14 | Preview controls inside the preview; a careful type-pairing interaction | Required | Preview toolbar; Type page slots with hover-preview and click-assign rules |
| D15 | Components: tree, preview, toggles and details; placeholders for needed but unbuilt components | Required | Three panes; Carousel (large, small) as *needed* |
| D16 | Layouts belong in the component tree; nesting (nav items in a nav list) handled as robustly as in code | Required | Slots with accepted children; click a nested item to select it |
| D17 | Brand assets without fixed required fields; starter assets already connected; templates add stock assets; text counts (slogans) | Required | Brand tab |
| D18 | Sources duplicates the Library. Tag Library images and findings on a component for whoever builds it | Required | References section on a component (source image, region finding) |
| D19 | Guidelines and reference media are Library items; docs are Library items surfaced in layers | Required | Docs tab lists Library documents that show in Design |
| D20 | Tracking deviation from the base system: not now. Component revisions matter, and token revisions as a whole | Required | Revisions on components; token history |
| D21 | Contrast level: no setting yet, a reasonable default | Required | WCAG AA (4.5:1) checks, no control |
| D22 | Agents can't do design work yet; this pass should clarify what they would need (images and specs) | Noted | §4 |

## 1. What this task reveals about the process

- **Observed:** two of Design's five tabs (Sources, Guidelines) duplicated the Library that ROADMAP-01 built. The purpose test in [operating procedure §2](../process/operating-procedure.md#2-inventory-evidence-for-the-proposed-scope) already asks "does it duplicate a structure that already exists?". It wasn't applied here because Design's tabs predate the Library. Adding a shared structure made older containers redundant, and nothing prompted a re-check.
- **Change applied now:** the procedure now says to re-run the purpose test on a layer's existing tabs at the start of each UX pass, and after a new shared structure lands.
- **How it will be evaluated:** the Pages pass is the next application. Until then this is a hypothesis.

## 2. Research (accessed 2026-09-23 and 2026-09-24)

| Source | Fact | Use |
|---|---|---|
| [DTCG 2025.10 stable](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/) and [Resolver module](https://www.designtokens.org/tr/drafts/resolver/) | Stable format (2025-10-28) with Format, Color and Resolver modules. Types include colour, dimension, font, duration, cubic Bézier, shadow, border, transition, gradient and typography; the resolver handles contexts such as light and dark | Storage format. Elevation and behaviours have no DTCG type, so they are groups plus an `$extensions.aludel.kind` marker |
| [M3 Figma kit announcement](https://m3.material.io/blog/material-3-figma-design-kit), [Variables + Properties kit](https://www.figma.com/community/file/1349722805300238798/material-3-design-kit-variables-properties) | Light and dark variables, token names and accessibility metadata on components, thorough variants. (The community file itself returned 403 to our fetch.) | Depth target |
| [Material Theme Builder](https://github.com/material-foundation/material-theme-builder) · screenshot `refs/material-theme-builder.png` | A key colour generates tonal palettes; phone preview with contrast toggles; "1 of 2" step footer | Key colour regenerates the palette row (D10); preview paging (D13) |
| [tweakcn](https://tweakcn.com/editor/theme) · `refs/tweakcn-editor.png` | Grouped token list left, preview right with page tabs (Cards, Dashboard, …), mode toggle, undo | Two-pane layout and preview pages (D4, D13). Avoid: value text fields as the main editing surface |
| [Storybook Controls](https://storybook.js.org/docs/essentials/controls) · `refs/storybook-controls.png` | Component tree with stories, canvas, controls table (name, control) | Components tab (D15) |
| [Figma component properties](https://help.figma.com/hc/en-us/articles/39636407507735-Components-collection-Component-property-fundamentals) | Variant, boolean, text, instance swap and slot properties | Contract property kinds and slots (D16) |
| [Figma Code Connect](https://github.com/figma/code-connect) | Maps design properties to existing code components; does not generate them | Platform binding, not codegen (D5) |
| [Mitosis](https://github.com/BuilderIO/mitosis) | Compiles one component source to many frameworks | Rejected for components: loses the library's behaviour and accessibility |
| [Angular Material button styling](https://material.angular.dev/components/button/styling) | Overrides mixins expose component tokens; system tokens are `--mat-sys-*` | Live preview by CSS variables (D5) |
| [Penpot tokens](https://help.penpot.app/user-guide/design-systems/design-tokens/) · `refs/penpot-tokens-help.png` (help page, not the app) | Token sets combined into themes, DTCG | Themes and modes |
| [Frontify logo library](https://help.frontify.com/en/articles/2730760-getting-started-with-the-logo-library) | Assets and usage rules together | Brand (D17) |

**Gap:** screenshots of the Figma MD3 kit's variables panel were not captured (403). The palette page borrows from the owner's own reference image instead.

## 3. Prototype v1

[v1/index.html](v1/index.html). Compositions:

| Screen | Borrowed or invented |
|---|---|
| Tokens: tree and preview | Borrowed from tweakcn (layout, preview pages); the raw/roles/rules tiers are invented |
| Palettes page | Borrowed from the owner's reference image; key-colour regeneration from Material Theme Builder |
| Preview paging | Borrowed from Material Theme Builder's step footer and tweakcn's preview tabs |
| Type pairing slots | Invented; rules stated in the prototype |
| Elevation page | Borrowed from the owner's elevation image |
| Behaviour (drag and drop) | Invented contract; demo only |
| Components | Borrowed from Storybook (tree, canvas, controls); nested selection from Figma |
| Brand | Borrowed from Frontify (assets with rules); starter assets and templates invented |
| Docs | Existing Library documents, filtered |

The prototype imitates Angular Material components with HTML styled by the same CSS variables. The build would render the real components in an iframe preview app.

## 4. What agents would need for design work (D22)

The build doesn't wait on this. It's a list for LAY-05:
- read the component contract, token links and referenced images, with regions;
- produce and revise contracts, and create images (concepts, starter assets);
- check a built component against the preview grid (a visual comparison);
- image input and output in the agent connection, which isn't available yet.

## Owner review

2026-09-24: v1 accepted ("like it. build it"), DEC-045. The build is authorized locally: portal and aludel-web-v1 scaffold, plus tests. No provider calls, spending or external writes.

## 5. Build brief

**Records** (`server/knowledge.mjs`, each with a validator; knowledge-structures.md updated):
- `design_tokens`: one per project, revisioned as a whole (D20). It holds:
  - palettes (seed colour, seed tone, pinned tones);
  - colour roles pointing at palette tones for light and dark;
  - two type faces (font stacks) and the 15 type roles;
  - corners and spacing;
  - elevation levels (fill role plus shadow) and the fixed or relative rule;
  - motion (easings, durations, spring);
  - behaviours (drag and drop, state layers).
  It is exported as W3C design tokens (DTCG 2025.10) with light and dark contexts.
- `component`: a stack-neutral contract. It holds:
  - name, group and purpose;
  - properties (variant, boolean, text, swap), each with a default;
  - slots with accepted components and counts;
  - anatomy parts with token links;
  - accessibility notes;
  - `binding` (library, selector, property map), which is how Platform realises it.
  Status is derived: needed (a name only), specified (it has a contract), built (it has a binding). Nesting uses the record's parent.
- `brand_asset`:
  - type: `image` (upload), `text`, `mark` (a generated monogram) or `banner` (a generated composition from the mark, colour roles and text);
  - a usage key for the ones the scaffold reads (`name`, `tagline`, `description`, `mark`);
  - notes, starter flag and template.
- `doc.showsIn`: layers. Existing documents default to Vision.
- `evidence_link` gains direction `references`, which points at a source or finding (`sourceRef`) rather than an insight.
- `finding.region`: the marked part of an image, as fractions of its size.
- `source.assetId`: an uploaded image.
- Uploads get a `purpose` (reference, library, brand). Only reference and brand uploads go into the generated app.

**Seeds** (`ensureDesign`, idempotent, once-only markers):
- tokens from the Look & feel (feel, accent, theme) on a Material 3 base;
- component contracts for what aludel-web-v1 provides through Angular Material and the template;
- starter brand assets: product name, tagline and description from the pitch, a monogram mark, and a social card;
- two starter documents shown in Design: *Design direction* (from the design notes) and *Accessibility baseline*;
- the onboarding reference media become Library sources.

**Scaffold:**
- `styles.scss` sets every `--mat-sys-*` role, type role, corner, elevation level and state layer from the tokens, in light and dark.
- It writes `design/tokens.json` (DTCG), `design/components.json`, `src/brand.ts` and `public/favicon.svg` from the mark.
- `index.html` gets its title, description and favicon from brand assets.
- Brand "Used in" is read from the workspace.

**Portal:**
- Design tabs: Tokens (tree and paged live preview of real Angular Material components, themed by scoped `--mat-sys-*` variables; drafts saved as one token-set revision with a note), Components (tree, preview, properties and contract editing, references, revisions), Brand, Docs.
- Library gets a Documents tab and image sources with region findings.
- Documents get a shared view with a "shows in" setting.

**Deferred, with reasons:**
- Icon axis settings: the app's icon font is a static subset, so axes need a per-project font build.
- Loading web fonts: type faces are font stacks until Platform manages font packages.
- Raster app icons and a PNG social card: there is no image library in the zero-dependency server, so marks and banners export as SVG.
- Deviation tracking (owner: later).
- Agent design actions (D22).

## Build result

2026-09-24: built and agent-checked. [Evidence and retrospective](../../evidence/design-ux-01-design-layer.md). Owner review of the built layer is pending.
