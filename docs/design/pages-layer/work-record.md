---
id: pages-ux-01
kind: work-record
status: built
updated: 2026-09-24
depends_on: [portal-layers-knowledge-structures, design-ux-01, lay-07]
---

# PAGES-UX-01: the Pages layer UX pass

## Authorization and scope

- **Owner instruction (chat, 2026-09-24):** after discussing the Pages layer's role, the owner said: "no direct structural edits, lets keep this focused and simple. if they want the page to look/behave different, spec it out, change request, gets added as work (note it gets added as coding work, which might have a specific agent, not as ux designer work, which would be e.g. reviewing flows). go ahead and prototype." (DEC-029 interim chat authorization, DEC-044 pass pattern.)
- **Order:** `next_action` stays PLATFORM-PIPELINE-01. The owner explicitly pulled this prototype forward. It is research and a static prototype only, so it doesn't displace the pipeline's build.
- **Authorized now:** research, this record, and a static clickable prototype (v1) with illustrative Tool Share data. Reference screenshots of public pages are stored in `refs/`.
- **Excluded:** portal code, schema or data changes, provider calls, spending and external writes. The build waits for owner acceptance of a prototype round.

## Owner brief ledger

| # | Ask (condensed) | Position | Prototype v1 |
|---|---|---|---|
| P1 | Something like the Design component viewer: explore the whole structure of the app | Required | Map tab: every page as a thumbnail, grouped by navigation, with flow arrows |
| P2 | Rendered in preview as it actually looks, if it's built | Required | Page canvas has Spec and Built modes; Built shows the running preview |
| P3 | There may be a spec for a page | Required | Each page has a spec: layout, sections, stories, data, states |
| P4 | Hover to see the components on a page | Required | Hovering on the canvas outlines the section or component and names it; outline and canvas are linked both ways |
| P5 | Edit simple things like text and images | Required | Content edits apply directly (text and images only) |
| P6 | Don't build Wix | Required | No structural edits on the canvas: no drag, reorder, add or style |
| P7 | About flow, UX, functionality, applying design standards and layouts, not writing frontend code | Required | Flows tab, state matrix, design-system components and layouts only |
| P8 | A different look or behaviour is specified as a change request and added as **coding** work (Platform › Engineer › implement, possibly a specific agent), not Experience designer work | Required | "Request a change" on a page or section creates an implement work item with the spec diff |
| P9 | Experience designer work is things like reviewing flows | Required | Flows tab: review walkthroughs; Pages gaps are design, flows, a11y and review items |
| P10 | Draw on existing apps and methods rather than reinventing | Required | §2 |

## 1. What this task reveals about the process

- **Purpose test on today's Pages tabs (first application of the DESIGN-UX-01 rule).** Results:
  - *Page tree* passes. Producer: onboarding and the navigation editor. Consumer: the scaffold and the page aside. It becomes the left pane of the page workspace.
  - *Flows* passes as a derived view (story-map activities × page links). It had no job, though. Nobody acted on it. v1 gives it one: the Experience designer's flow review.
  - The *Notes and references* free-text field on a page fails. It duplicates the Library, the same failure DESIGN-UX-01 found. v1 replaces it with Library references tagged to the page.
  - *Mark as designed* is a hand-set status. Page status is otherwise derived. v1 derives it instead: planned → specified (spec accepted) → built (accepted build), plus a "differs from spec" flag.
- **Observed:** the rule caught one duplicate and one hand-set status before prototyping, not after shipping. That's one data point, not proof.
- **Gap the task exposed:** the brief's routing rule has no home in the process docs. A spec gap is Experience designer work, and a build that differs from its spec is Engineer work. `config/roles.json` has the actions (`pages.design`, `pages.flows`, `pages.review`, `platform.implement`), but nothing says which gap goes to which. v1 uses it as a visible rule (Map › Gaps). It goes into knowledge-structures.md when the build is accepted, because the rule is only a proposal until the owner reviews it.

## 2. Research (accessed 2026-09-24)

| Source | Fact | Use |
|---|---|---|
| [Sanity overlays and click-to-edit](https://www.sanity.io/docs/visual-editing/visual-editing-overlays) · `refs/sanity-overlays.png` (the docs' product screenshot) | Preview left, document pane right. Hovering an element labels it, and clicking focuses its field. A banner warns "This document is used on all pages" | Hover labels on the canvas (P4), content inspector with the "used on every page" warning (P5) |
| [Vercel Edit Mode](https://vercel.com/docs/edit-mode) · `refs/vercel-edit-mode.png` (docs page, no product screen) | Edit Mode highlights editable fields as Content Links on the real site. It exists only where elements map to CMS fields | Edit content is a mode, and only keyed content is editable (P5, P6) |
| [Relume](https://www.relume.io/) · `refs/relume-home.png`, `refs/relume-product.png` (marketing crops, not a live trial) | Brief → Sitemap → Wireframe → Design as modes of one project. Pages are stacks of library sections, and the style guide skins them afterwards | Section as the unit of a page spec; Map before page; Design separate from structure (P1, P3, P7) |
| [Figma prototype flows](https://help.figma.com/hc/en-us/articles/360039823894-Create-and-manage-flows-in-prototypes) · `refs/figma-prototype-flows-full.png` | Frames joined by connections; a named flow starts at a labelled frame; frames can belong to several flows | Map edges, "Show flow" highlight and start tag (P1); Flows strip (P9) |
| [Overflow](https://overflow.io/) · `refs/overflow.png` (hero crop only) | User flows plus step-by-step walkthroughs for design critique | Flow review as a walkthrough with notes per step (P9) |
| Jesse James Garrett, *The Elements of User Experience* (2nd ed., 2010) | Five planes: strategy, scope, structure, skeleton, surface | Pages owns structure and skeleton; Design owns surface (P7) |
| Brad Frost, [*Atomic Design* ch. 2](https://atomicdesign.bradfrost.com/chapter-2/) | Templates are layouts with placeholders; pages are templates with real content | Layout templates live in Design; pages apply them (P7) |
| Scott Hurff, [the UI stack](https://www.scotthurff.com/posts/why-your-user-interface-is-awkward-youre-ignoring-the-ui-stack/) | Ideal, empty, error, partial and loading states | State matrix and the canvas State control |
| Sophia Prater, [OOUX / ORCA](https://www.ooux.com/) | Objects, relationships, calls to action, attributes | Sections name the Data object or operation they show and where they lead |

**Gaps:** Webflow Navigator's help page and Builder.io's visual editor page couldn't be captured (bot check and a 404). Relume's sitemap and wireframe modes are shown only in marketing crops. Nothing here is a live trial.

## 3. Prototype v1

[v1/index.html](v1/index.html) · screenshots in [v1/shots/](v1/shots/). **Review notes** (top right) maps each ledger row to a screen and lists things to try.

| Screen | Borrowed or invented |
|---|---|
| Map: page thumbnails, navigation bands, labelled links, flow highlight | Borrowed from Figma prototype flows and Relume's sitemap. Bands and status dots are invented |
| Map › Gaps, routed by kind (spec gap → Experience designer, build gap → Engineer) | Invented; the rule is P8/P9 |
| Page workspace: pages and outline, canvas, inspector | Borrowed from Storybook and the accepted Design › Components layout. The outline follows Webflow's Navigator (documented, not captured) |
| Spec/Built toggle, drift markers, "not in this build" footer | Invented. Built is the running preview; Spec renders the spec with the project's components |
| State and "As" controls | UI stack (states); personas from Product. Invented as a toolbar |
| Hover labels, and data versus content distinction | Borrowed from Sanity overlays; the data/content split is invented |
| Edit content mode, image picker from Brand and Library | Borrowed from Sanity and Vercel Edit Mode |
| Request a change drawer (spec diff from design-system parts → Engineer · implement, assignable to a coding agent) | Invented, from P8 |
| Flows: strip, walkthrough with acceptance, review notes that become content fixes, change requests or questions | Borrowed from Figma flows and Overflow walkthroughs; note routing is invented |

The canvas imitates the generated app in plain HTML with Tool Share's token values. The build would render the spec with the real Angular Material components (as Design does) and show Built as the preview in an iframe.

**Checked by the agent (2026-09-24, Playwright/Chromium, 1600×1000 and 390×844):** 20 scripted steps across Map, Pages and Flows ran with no page errors. There's no horizontal scroll at 390 px. Screenshots `v1/shots/01–20`. Accessibility wasn't audited (no axe run); this is a static prototype.

## 4. What the build would need (not decided)

- **Page spec record:** `page` gains `layout` (a Design layout), `sections[]` (component, stories, data binding, leads to, audience, phase), `states{}` and `content` keys. This extends the existing record rather than adding a kind.
- **Content keys:** the scaffold (aludel-web-v1) reads copy and images by key from a content file. This is a scaffold contract change and the precondition for P5 on Built.
- **Built overlay:** preview builds emit `data-aludel-section` and `data-aludel-content` attributes. The Code links index (LAY-07) resolves them. Built needs PLATFORM-PIPELINE-01's per-project preview.
- **Drift:** "differs from spec" starts as a manual or agent review finding. Automatic comparison is later work.
- **Change request:** a `platform.implement` work item whose context holds the spec revision diff, stories, acceptance and components.

## 5. Retrospective (v1 round)

1. **Harder than necessary:** some reference sites block headless capture (Webflow) or have moved (Relume, Builder). Two capture passes were needed. Several Tool Share fixtures had to be re-derived from the LAY-01 v3 prototype because there's no shared fixture file.
2. **Would make the next pass easier:** a shared Tool Share fixture (stories, pages, personas) for prototypes, and a reusable capture script under `tools/` with the Playwright path. Both are hypotheses; neither is built.
3. **Roadmap and architecture:** P5 on Built depends on a scaffold content-key contract. The Built overlay depends on PLATFORM-PIPELINE-01 previews and LAY-07 code links. The build can start with Spec, flows and change requests before the pipeline lands.
4. **Questions for the owner (they block the build, not this round):**
   - Is the section the right grain for a spec?
   - Does a change request revise the spec at once (as in v1), or only when its build is accepted?
   - Does content-key editing belong in the scaffold now?
5. **Process change:** the purpose test on existing tabs was applied (§1) and caught two issues. The gap-routing rule is shown in the prototype, not yet documented. The rest is hypothesis until the owner's review.

## Owner review

### Round 1 (2026-09-24)

The owner was very positive ("if you can build this, its going to be amazing") and gave detailed comments. They left the choice between another prototype and building to the agent. **Choice: prototype v2.** The Map comments turn it into a planning editor: pan and zoom, grid snapping, multi-select and drawn connections. Those interactions are expensive to redo in the Angular build and untested with the owner. Pages carries over from v1 apart from the "As" personas.

| # | Ask (condensed) | Position | Prototype v2 |
|---|---|---|---|
| M1 | Map is a canvas: zoom and pan | Required | Wheel pans, Ctrl/⌘-wheel zooms at the pointer, Space-drag and the Hand tool pan; zoom controls and Fit |
| M2 | Show desktop as well as mobile; grid layout that uses spacing instead of leaving gaps or overlaps | Required | Desktop, Phone or Both. Nodes sit in grid cells sized to the view, with fixed gutters |
| M3 | Plan here as a UX designer: add page blanks for stories that need them | Required | "Page" tool and "+ Page blank" on a flow's missing stories. A blank has a title, a note and linked stories |
| M4 | Drag pages (snapping to the grid); select a group and move it together | Required | Drag snaps to cells; marquee and Shift-click select; the group moves together; a taken cell is refused |
| M5 | Connect pages by dragging (a → b → c) | Required | Drag from a page's handle to another page; label the link; select and delete |
| M6 | Blank shows title and note; a button opens it in the Pages tab to spec it | Required | Open button on each node; planned pages in Pages show the note and "Start the spec" |
| M7 | Replace the flow picker and gaps sidebar with a Flows sidebar showing built, specified and planned; a selected flow is edited on the canvas | Required | Flows sidebar with a status bar per flow. Selecting one numbers its steps on the canvas; "+ Step" pills add pages; drawing a link from the last step extends it |
| M8 | P2 and P3 are fine; structure settles with use | Noted | Unchanged |
| M9 | P4 hover and "On this page": keep | Agreed | Unchanged |
| M10 | "As" lists the personas from Vision's story mapping | Required | "As" lists Vision personas (Sam, Priya) plus "Not signed in" |
| M11 | Flows tab: the preview must be the focus. Steps go in a left sidebar running down, with a flow dropdown at its top | Required | Three columns: steps (dropdown on top), large preview, acceptance and notes |

## 6. Prototype v2

[v2/index.html](v2/index.html) · screenshots in [v2/shots/](v2/shots/). Pages carries over from v1 apart from "As" (M10) and planned pages.

| Screen | Borrowed or invented |
|---|---|
| Canvas: pan, zoom at the pointer, Fit, Select and Hand tools, Space to pan | Borrowed from Figma's canvas conventions |
| Grid cells sized to Desktop, Phone or Both, with fixed gutters (M2) | Invented, from the owner's "use spacing instead of gaps or overlaps" |
| Snap-to-cell drag, marquee and Shift-click selection, group move, taken cells refused (M4) | Canvas conventions; the refusal rule is invented |
| Drag-to-connect handle, a label prompt on drop, rename by double-click, Delete (M5) | Borrowed from Figma prototype connections and FigJam connectors |
| Page blank with title, note and "+ Story", and an open button (M3, M6) | Invented |
| Flows sidebar: status bar per flow; selecting one edits it on the canvas; "+ Step", reorder and remove; "Stories with no page › Blank"; dashed "No link yet" between steps with no link (M7) | Invented. It replaces v1's flow picker and Gaps panel |
| Spec links can't be deleted on the canvas ("change it with a change request"); blanks can be deleted, pages with a spec or build can't | Invented, following P6 and P8 |
| Flows tab: steps down the left with the flow dropdown on top, preview in the middle (phone or desktop), acceptance and notes on the right (M11) | Owner's layout |

**Checked by the agent (2026-09-24, Playwright/Chromium, 1600×1000 and 390×844):** 21 scripted steps used real mouse input and ran with no page errors. There's no horizontal scroll at 390 px. They covered:
- switching views;
- adding blanks from a flow's missing stories;
- typing a title and a note;
- dragging a handle to connect two blanks and naming the link (the sidebar updates);
- marquee-selecting two pages and moving them a row down together;
- dropping a page on a taken cell (refused);
- zooming at the pointer and panning with the wheel;
- filling Borrow's gap step with a blank;
- deleting a blank;
- opening a blank in Pages;
- the "As" options (Sam · Borrower, Priya · Lender, Not signed in);
- the new Flows layout in phone and desktop.

Accessibility wasn't audited. Trackpad pinch wasn't tested; it arrives as Ctrl + wheel in Chromium and is handled that way.

**Known limits:**
- The map doesn't refit when the window is resized (Fit does).
- Fit shows the whole app at about 40% in Both, which is an overview; reading needs a zoom.
- "Start the spec" is a placeholder.

**Build implications (in addition to §4):**
- A `page_link` record (from, to, label, origin `spec|plan`) and canvas `position {col,row}` on `page`.
- `flow` records with ordered steps (page, persona, story, trigger), replacing today's derived flows.
- A planned `page` holds a title and a note only.

### Retrospective (round 1 → v2)

- **Observed:** v1 read the Map as a view of structure. The owner wants it to be where the Experience designer plans. A prototype that only displays for a role that owns the planning misses that role's main job. Recording it here rather than as a procedure change: it's one instance.
- **Process applied:** the round's asks were ledgered first (M1–M11), and each maps to a Review notes row with a "Show" link. That keeps the owner's walkthrough anchored to their own words.
- **Hypothesis:** building a canvas editor in Angular without a library is significant work. Before the build, assess a canvas library (for example the Angular port of xyflow, or a thin custom layer, since the grid removes free placement). This is a build-planning question, not decided.

### Round 2 (2026-09-24): build authorized

**Owner instruction (chat):** "build as you see fit. make it great" (after v2). The build is authorized locally: portal code, knowledge records and migrations, the aludel-web-v1 scaffold where the Built view needs it, tests and browser checks. Excluded: provider calls, spending, external writes and public deployment (DEC-029 interim chat authorization).

**Built and agent-checked (2026-09-24):** [evidence and retrospective](../../evidence/pages-ux-01-pages-layer.md). Owner review of the built layer is pending.
