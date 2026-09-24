---
id: evidence-pages-ux-01
kind: evidence
status: agent-checked
updated: 2026-09-24
depends_on: [pages-ux-01]
---

# PAGES-UX-01: the Pages layer, built

The owner saw prototype v2 and said "build as you see fit. make it great" (DEC-048). This page is the evidence for the build and its retrospective. The build has been checked by the agent; owner review is pending.

## What was built

| Ledger | Built |
|---|---|
| M1, M2 | **Map** is a canvas. Scroll pans; Ctrl/⌘ + scroll zooms at the pointer; Space-drag, the middle button or the Hand tool pan; there are zoom controls and Fit. The first view keeps at least 45% zoom from the top left. Desktop, Phone and Both thumbnails render each page from its spec with the project's components. Pages sit in grid cells sized to the view, with fixed gutters |
| M3, M6 | **Page blanks**: "Page blank" drops one into the nearest free cell, with its title ready to type. A blank has a note and "+ Story", and opens in Pages with the open button or a double-click. Blanks can be deleted; pages that are specified, built or in the navigation can't be deleted on the Map |
| M4 | Dragging snaps to cells, with ghost cells while dragging. Marquee and Shift-click select; a selection moves together; a taken cell is refused. Places live in one `page_map` record, so moving pages adds no page revisions |
| M5 | **Links** are drawn from a page's handle onto another page, named in place and renamed by double-click. Links on the same side of a page spread out. A link that comes from a section's "leads to" can't be deleted on the Map |
| M7 | **Flows sidebar**: each flow shows a bar of its steps (built, specified, planned, missing) and its review state. Selecting one edits it on the canvas: step numbers on pages, "+ Step", reorder and remove, dashed "No link yet" between consecutive steps, gaps filled with a blank, and "Stories with no page › Blank". A link drawn from the last step extends the flow. Flows are seeded once, one per story-map activity |
| P2–P6, M8, M9 | **Pages**: the page list and outline (App shell, sections with state, audience, milestone and build tags). The canvas shows **Spec** (drawn from the spec with the Design layer's real Material components, in the project's theme) or **Built** (the running preview in a frame). It has viewport, state and "As" controls. Hover outlines and names a section with its component and stories; click selects. The inspector covers the page (description, layout, address, stories, states, data, links out, flows, references, Built by, why), a section, a content field or the shell |
| P5 | **Edit content**: headings, text and button labels are edited on the canvas; images come from Design › Brand. Content saves straight away as a page revision. The app shows it after the next preview update, with no code change |
| P8, DEC-048 | **Spec editing**: add, reorder and remove sections; component, state, audience, leads to, region, milestone, stories, data and note; layout; states. On a page not built yet, "Save spec" saves one revision with a reason, and "Accept spec" marks its stories designed. On a **built** page the draft goes through **Request this change**. That revises the spec with the reason and creates a `platform.implement` work item (assignable to a coding agent) that carries the revision range, the stories and the summary. "Request a change" without a draft, and "Request the build" for sections missing from the build, create the same kind of item |
| P2 (Built) | The scaffold routes **every** page (sub-pages and blanks too) and renders Ready sections as marked skeletons. It ships `src/aludel-bridge.ts`, which answers only its own portal and only when framed. Built reads the page's sections from the app: footer notes for sections not in this build and for sections still skeletons, hover labels inside the running app, and click-to-select. "Update preview" regenerates the app from the specs |
| M10 | "As" lists Vision's personas, plus "Not signed in"; sections can be shown to one persona |
| M11, P9 | **Flows**: a flow dropdown and steps (thumbnails, triggers) down the left, the page in the middle (Spec or Built, phone or desktop), and acceptance, what happens next and review notes on the right. **Review this flow** opens a `pages.review` item. Notes route as follows: looks right; content fix (opens the page in Edit content); change request (opens the change drawer for the Engineer); question (a `product.clarify` item for the Product lead). **Finish review** records the verdict and closes the item |

## Checks (agent, 2026-09-24)

- **Domain:** `tests/pages.test.mjs` has 6 tests, all passing. They cover:
  - spec validation and links from sections;
  - letting go of deleted records;
  - flow seeding happening only once;
  - `page_map` filtering;
  - a change request's revision and work item, including the stale-revision refusal;
  - a flow review's verdict and closing;
  - the scaffold's routes, sections, bridge and manifest.
- **Server suite:** 84 of 85 pass. The one failure predates this work: `tools/delete-project.mjs` has a shebang but was committed without the executable bit (commit 8f9b81f).
- **Browser:** `tools/browser-checks.sh pages` passes. The new `tests/pages-browser.mjs` runs against a fresh portal, building Tool Share with the process runtime, and runs axe on 8 screens with no page errors: map, map-flow, page-spec, change-request, page-content, page-built, flows-review and map-phone. It covers:
  - a blank named and noted;
  - a link dragged from a handle and named;
  - a marquee selection moved together;
  - a refused drop;
  - a step added on the canvas;
  - a spec draft rendered with Material components, sent as a change request (checked through the API: `platform.implement`, sections saved);
  - hover labels;
  - a content edit saved;
  - a blank's spec saved with its reason and accepted;
  - Built after "Update preview" ("2 still skeletons", hover inside the running app, click-to-select);
  - a flow reviewed with two notes, staying on the reviewed step, and closed;
  - no horizontal scroll at 390px.
- **Regression:** the `layers` suite was updated for the new Pages UI and passes. `design`, `onboarding`, `product`, `brand`, `workflow` and `github` pass. `browser` fails at its known decision-conflict step, as on the baseline.
- `npm run typecheck` and `npm run build` are clean. `tools/css-collisions.mjs "PAGES-UX-01"` lists `lay-chip`, `lay-form` and `lay-link-button`; these are deliberate overrides scoped under Pages classes. The icon subset was rebuilt; the app template's `icons.ttf` was restored because only its encoding had changed.

## Limits and what is not claimed

- **Docker runtime not browser-tested.** Built was checked with the process runtime only. The owner's portal uses Docker; the bridge is part of the app source, so it should behave the same, but that hasn't been run.
- **Existing apps need "Update preview" once.** Apps generated before this change have no bridge, so Built says the preview didn't answer until then.
- **"Update preview" regenerates the generated files** (the same path as the first build). That's safe while apps are generated only. Once coding agents change app code (LAY-05), regeneration must not overwrite their work: it should rewrite only `site.ts` and `page-blocks.ts`, or become a merge.
- **Content in the running app comes from `site.ts` sections.** Pages that agents build must keep reading their content from there, and keep `data-aludel-section`, or content editing and the Built overlay stop working. The generated `AGENTS.md` now says so; whether agents follow it is untested until LAY-05.
- **Drift is found by the bridge** (a section is missing, or still a skeleton). A built section that looks or behaves differently from its spec isn't detected; that's a review finding.
- The Spec canvas shows each component's sample instance, not real data.
- Not done:
  - a spec editor for data bindings beyond choosing objects and operations;
  - undo on the Map;
  - refitting the Map when the window resizes;
  - Flows walkthrough navigation inside a single Built frame (each step loads its own page).
- Trackpad pinch wasn't tested directly; Chromium sends it as Ctrl + wheel, which is handled.

## Retrospective

1. **What made it harder than necessary (observed):**
   - Three parse or build traps each cost a cycle: `as` is reserved in Angular templates; the icon subset rejects names missing from the font; and the design test passes `appUrl` as a string where the server passes `{ portal, app }`.
   - A `linkedSignal` keyed on a computed id reset the Flows walkthrough on every data reload.
   - Rename-on-Enter also fired on blur, and the second write failed as stale (409).
   - Three accessibility issues showed up only under axe: dimmed text and thumbnails failing contrast, a second `h1` from the preview, and a scrollable region without a focus stop.
   - Browser selectors using `has-text` picked the wrong canvas node, because thumbnails repeat the app's navigation.
2. **What would make the next equivalent task easier:**
   - The hand-off checks now in the implementation plan: inert thumbnails, preview headings, `:text-is` selectors, reserved `as`, running the icon subset tool first.
   - A shared canvas-drag helper for browser tests (hypothesis; not built).
3. **What changes the roadmap and architecture:**
   - LAY-05 inherits two contracts: agent-built pages keep `data-aludel-section`/`data-aludel-page` and read content from `site.ts` sections; "Update preview" regeneration must become non-destructive.
   - Platform › Releases could show which change requests a release carries; `platform.implement` items already target the page and its stories.
4. **Questions:**
   - For the owner: is the section the right unit of a spec (settled by the build for now, P2/P3: "will take usage to iron out")?
   - Newly important for LAY-05: may regeneration touch agent-built files at all?
   - Resolved by the build: a change request revises the spec immediately and Built shows the difference.
5. **Process change:**
   - Applied now: the purpose test on existing tabs (work record §1) removed the page's free-text references and the hand-set "Mark as designed". The UI hand-off checks were added to the implementation plan. They were tested here: the Pages suite passes axe on 8 screens once the fixes they describe were made.
   - Still a hypothesis: that the checks prevent the same failures next time without an axe round-trip.
