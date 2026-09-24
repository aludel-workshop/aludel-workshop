---
id: evidence-design-ux-01
kind: evidence
status: accepted
updated: 2026-09-24
depends_on: [design-ux-01]
---

# DESIGN-UX-01: the Design layer, built

The owner accepted prototype v1 ("like it. build it", DEC-045). This is the evidence for the build, followed by the retrospective. It has been agent-checked and accepted by the owner ("looks good", DEC-046).

## What was built

| Ledger | Built |
|---|---|
| D1, D9 | One `design_tokens` record per project in three tiers: raw values, then roles, then rules. The tree shows them in that order, and raw values are muted and set apart by a divider. Exported as W3C design tokens (`design/tokens.json`) |
| D4, D7, D8, D13, D14 | The Tokens tab has two panes: a tree and a live preview. The preview has ten pages you step through, and its mode (light/dark) and width (phone/desktop) controls sit inside it. Hovering a token outlines and labels what uses it. When it isn't on the current page, a note offers the page it's on. The Type page's pairing slots follow the accepted rules: hover tries a role in the selected slot, and click places it |
| D10 | Palette boxes are edited in place. Changing the seed regenerates the row, and editing any other tone pins it. Tones are CIE L*, which is the same scale as Material's tone |
| D11, D12 | Elevation is a fill role plus a shadow, and a card can be shown sitting on a chosen level, with fixed or relative shadows. Motion has easing curves with draggable handles, durations and a spring. Behaviour has drag and drop using the Angular CDK (which the app would use), with a keyboard alternative and live announcements, plus state layers |
| D5 | The preview renders the stack's **real** Angular Material components (buttons, cards, chips, form fields, lists, switches, FABs) and the aludel-web-v1 shell parts. They are themed by the project's `--mat-sys-*` variables on a scoped container, including unsaved changes. The scaffold writes the same variables into the generated app's `styles.scss` |
| D3, D15, D16 | Components tab: a tree, the preview and a properties panel. **All variants** shows 5 variants × 5 states of the real Material button; forcing hover, focus and pressed states uses the button's own state-layer element. Nested instances are clickable, so selecting one Nav item edits that instance and "one selected" holds across siblings. Slots show what they accept. A *needed* component shows a placeholder and can be specified with a contract editor (properties, slots, anatomy, accessibility, binding) |
| D20 | Component contracts and the token set are revisioned. Saving a token draft makes one revision with a note, and History lists them |
| D17 | Brand has starter assets already used by the app: name, tagline and description from the pitch, a monogram mark, and a social card. It also offers templates (email header, social profile, launch announcement), uploads, text, marks and banners. The mark is shown in context (app bar, browser tab, home screen) and banners as a link preview. "Used in" is read from the workspace |
| D18 | Evidence links gain direction `references`, pointing straight at a Library source or finding. Library sources can hold an image, and image findings mark a region. A component's References section shows the image with its region, and a source lists what references it |
| D19 | Documents live in the Library (a new Documents tab) with a "shows in" setting. Vision and Design list the ones that show there. Starter documents: *Design direction* and *Accessibility baseline* |
| D21 | Every colour role is checked against its pair at WCAG AA, and the result shows on each tile. There is no setting |

The generated app follows the Design layer. It gets:
- every system token in `styles.scss`;
- `design/tokens.json` and `design/components.json`;
- `src/brand.ts`, and `public/favicon.svg` from the mark;
- the title, description and favicon link in `index.html`;
- banners as SVG in `public/brand/`.

While a project's token set is untouched, changing Look & feel regenerates it. Once edited, it is kept.

## Checks (2026-09-24)

| Check | Result |
|---|---|
| `npm run test:server` | **75/75 pass**, including 6 new domain tests (`tests/design.test.mjs`): tone maths and AA roles, seeding once, validation, references and regions, reference media to the Library, and scaffold output with brand usage |
| `npm run typecheck`, `npm run build` | Pass. The only warnings are older ones in `pages.ts` |
| `tests/design-browser.mjs` (new) | **Pass**. It runs against a fresh portal and a built project, and checks 17 screens with axe (no violations): palette editing, the hover label, alias change, type slots, elevation, motion, keyboard reordering, sample screens (light/dark, desktop/phone), saving a revision, nested selection, a reference with its region, the 5 × 5 variant grid, a needed component then specified, brand templates, editing the mark, docs "shows in", and a Library source's "Referenced by". After a rebuild, **the saved token change and the edited mark are in the generated app** (`--mat-sys-title-medium-size: 18px`, `"markText": "T"`). No sideways scroll at 390px |
| Browser suites, fresh portals | layers, design, onboarding, product, brand, github and workflow **pass**. `browser` fails, and **fails the same way on the baseline commit** (`537008b`, run in a temporary worktree): the known decision-conflict step |
| Generated app | `vite build` of the generated workspace passes. Its CSS has `--mat-sys-primary:#0062a2` and `--mat-sys-title-medium-size:18px` from the Design layer. Screenshot: [19-generated-app.png](design-ux-01/19-generated-app.png) |
| `tools/css-collisions.mjs` | Three names (`lay-main`, `lay-link-button`, `lay-mono`), each an intended scoped override |
| Icon subset | Rebuilt with fontTools 4.66. Two names in the prototype (`location_on`, `smartphone`) don't exist in this Material Symbols version and were replaced. The template's `icons.ttf` was restored because its icon list didn't change |

Screenshots: [docs/evidence/design-ux-01/](design-ux-01/).

## Deviations from the brief

- **Preview without an iframe.** The portal is itself Angular Material 22, so scoping the project's `--mat-sys-*` variables on a container renders the real components in the project's theme. An iframe preview app would be needed for a stack other than Angular Material. Recorded in the component contract as `preview` (a renderer key).
- **Forced states** (hover, focus, pressed) are shown on buttons, icon buttons and FABs only. They rely on Material's state-layer element; other components show enabled and disabled.
- **Icons page** lists the icons in use. The fill, weight and grade settings are deferred (§5 of the work record).
- **Type faces** are font stacks from a list. Loading web fonts is deferred.
- **Palette tones** use CIE L* with the seed's hue and chroma (reduced to stay in sRGB), not Material's HCT. Tones match HCT's tone scale; hue and chroma can differ slightly from Material Theme Builder.
- **The dialog preview** is a themed surface, not `MatDialog`, which needs an overlay.

## Retrospective

1. **What made it harder, slower or more error-prone?**
   - Adding a `brand` section to the server's project route silently captured an older route (`GET /api/projects/:id/brand`). The domain tests and the new browser test all passed. Only the full browser run caught it: three unrelated suites failed, and a baseline run confirmed the change caused it.
   - Several test failures were my own locators. Uppercase CSS changes `innerText`, "Play" is a substring of "display", and mat-icon text sits inside accessible names.
   - Axe also caught three real problems: muted text below AA, a button nested inside a row button, and chip options outside a listbox.
2. **What would make the next one easier?**
   - A route-collision check. It's now a line in the implementation plan's hand-off checklist.
   - The design suite is now in the default `browser-checks.sh` list.
   - The shared `design-tokens.js` means the next stack's preview or scaffold can reuse the maths.
3. **What does this change downstream?**
   - The Pages pass (PAGES-UX-01) can build page previews from the same scoped-theme approach and the component contracts.
   - LAY-05 (coding agents) now has something to read: contracts, token links and references with image regions (§4 of the work record).
   - A non-Angular stack will need an iframe preview app.
4. **Questions created or resolved.**
   - Resolved: can the Design layer be separate from implementation and still preview real components? Yes, through contracts plus a binding, and a scoped theme.
   - New: where the contrast level setting lives (owner: later); per-project icon fonts; loading web fonts; an HCT-exact palette if designers compare with Material Theme Builder.
5. **Process change applied and tested.**
   - Before the build, the purpose-test re-run (added in the prototype round) removed two tabs that duplicated the Library. It worked here, and on the next layer it is still a hypothesis.
   - Added now: the route check and the preview fade wait in the hand-off checklist. Both come from failures observed in this build. Whether they prevent the next one is untested.
