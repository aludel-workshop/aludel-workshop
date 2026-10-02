# LAYER-KNOWLEDGE-01: the Knowledge tab as the layer's manual

- **ID / date / author:** LAYER-KNOWLEDGE-01, proposal r1, 2026-10-01, agent (Claude), from the owner's step-3 review of LAYER-BINDINGS-01.
- **Outcome:** a person can open any layer's Knowledge tab and learn what an agent learns before working in that layer:
  - what information it keeps, as a spec;
  - what is in it now;
  - what it shares, and with whom;
  - how it works.

  From the same place they can edit its documentation and propose bindings, without ever handling a facet.
- **Authorized scope:**
  - **Proposal r1:** owner chat, 2026-10-01: "propose what our ux actually needs here for knowledge".
  - **K1–K3:** owner chat, 2026-10-01: "go for it", after answering the three questions. This covers reference capture of public pages, spec drafts and a static prototype in this folder, plus screenshots.
  - **Not covered:** building in the candidate, template contract changes, or external writes.
- **Source:** [owner decision 8](../layer-bindings/work-record.md#owner-decisions-2026-10-01) and its follow-up answers.

## What the review showed

Step 3 built the machinery that lets a binding cover exactly the matching part of each layer: selections, refacets, held-aside entries and overlap chains. Its interface fails a person in four ways:

1. **Manage › Facets names groupings without showing what is in them.** "App kit" can't be opened. Splitting asks for a kind, a field and values the person has never seen.
2. **Knowledge is a few loose documents.** "Outputs" is a paragraph per output. Nothing says what a layer's information means, and a Markdown layer's outputs ("a file and a folder of files") mean nothing at all.
3. **Two things are mixed: spec and contents.** "A generic page that can be bound" is spec: what kind of thing a page is. "Seeing the design-system values" is contents: the tokens there today. People need both, but different questions need each.
4. **Knowledge is held twice.** Templates ship `knowledge/*.md` and `api/openapi.json` in their repository. The host copies the documents into database records with their own revisions, so an edit in Knowledge drifts from the repository. Contents are records (layer API) for most layers and repository files for others.

## The model the UX needs

The Knowledge tab separates three things and joins them on one page per node.

| | What it is | Where it lives | Who changes it, and how |
|---|---|---|---|
| **Spec** | The layer's information tree. Each node has a title, an intent (what it is for), a shape (the record schema, a required Markdown format, or "free text"), and what it selects (a kind, a kind narrowed by a field, or a path in the repository). | The layer repository: an `information` tree in `layer.json`, with a Markdown page per node in `knowledge/`. Templates ship theirs; a custom layer writes its own. | The owner or an agent, as reviewed Work, because a spec change can change what is shareable. It also raises "Compare specs" Work (below). |
| **Contents** | What a node holds now: the entries or files its selection matches. | Unchanged. Records through the layer API, or files in the repository. | Through the layer's editor tabs, or in place where a node is plain Markdown. Roles still apply: a replica is read-only, a ceded node points away. |
| **Docs** | Purpose and methods (today's charter and method documents), each editor tab (what it is for, its flows, its source files) and the layer's routines. | The layer repository (`knowledge/`, `docs/`, `ui/`), read at the instance's pin. | The owner edits in place. Saving commits to the layer repository on a branch that the owner merges. This replaces the database copies. |

**Bindings attach to spec nodes, not to individual entries.** Binding the `personas` folder binds every persona in it now and later. A facet becomes the stored form of "these nodes are in that binding". It is created, split or merged by the binding decision, never by hand. Nodes that aren't bound are simply the layer's own information.

**Granularity is the spec's decision.** A node can be a leaf, such as "Page", whose Markdown describes a page's elements without listing them as child nodes. Bindings can select whole nodes only. A part of a record, such as a page section, is described but can't be bound until it becomes its own entry (F5 stays open).

**Equivalent function, not equal trees.** Pages' "Page" is a mockup; Code's equivalent is route components. When a binding pairs them, its record carries the assessor's statement of equivalence: "Pages' pages drive Code's route components; the adapter turns sections into components". It also carries which side drives the other. The two trees never have to match.

**Detection comes from comparing specs.** When a layer's spec is created or changes, a "Compare specs" routine proposes Work: an agent reads the change against every other layer's spec and proposes new bindings, or additions to existing ones. Its proposals arrive as binding proposals the owner decides. A person can also propose a binding directly. Hints are removed.

## Information architecture

A docs-site layout inside the layer: a left nav with expanding sections, a reading pane with rendered Markdown and links, and an "on this page" outline at wide sizes.

1. **Overview (landing):**
   - the layer's purpose, in two or three sentences from the charter;
   - "What it keeps": the top-level nodes, each with a one-line intent and a count;
   - "Shared with": one card per binding;
   - "Start here": the reading order an agent is given.
2. **Information:** the spec tree in the nav. In the reading pane, the overview of this section is the arrangement the owner described:
   - a **Local** block of unbound nodes;
   - a **card per binding**, each holding the nodes in it, the other layers and their nodes, the authority and status.

   In the nav, each bound node carries a small chip naming its binding.
3. **Node page,** one per spec node, in this order:
   - intent;
   - shape: a field table, or the required Markdown format with an example;
   - where it lives;
   - **Contents**: a searchable list or table that links each entry to the editor tab that edits it, or a preview where the node is Markdown;
   - **Sharing**: its binding, role, counterpart nodes and the equivalence statement;
   - "Referenced by": the layers that point into it.
4. **Bindings:** this layer's bindings and pending proposals, each opening its full card. Library › Bindings stays as the project-wide view.
5. **How it works:** purpose, methods and routines, as pages.
6. **Editor tabs:** a page per tab with its purpose, its flows and a source view of its files (read-only, at the pin).

Manage keeps Activate and Settings. **Connections and Facets leave Manage.** Connections' stored data still moves into bindings in step 4 (F10); until then, hiding the screen loses nothing that isn't shown elsewhere. Activation's wording about "proposing connections" changes to bindings.

## Key flows

1. **Learn a layer.** Overview → a node → its contents → open an entry in its editor tab. Success: someone new to the layer can answer "what does Personas keep, in what format, and who else uses it?" without leaving Knowledge.
2. **Edit docs.** Edit on any docs or node page → a Markdown editor with preview → Save. The save becomes a commit on a branch, shown as "Unmerged change" until merged. A spec change also shows "This will compare Personas' spec with 6 other layers".
3. **Propose a binding.** In Information:
   - choose **Select**, and tick nodes (children come with them);
   - choose **Propose a binding**; the other layer's spec tree opens beside yours, and you tick its counterpart nodes;
   - choose the authority and write the equivalence statement;
   - review the preflight, in plain words: what each side keeps, what becomes read-only or points away, which existing bindings are renegotiated, and which references need Work;
   - submit.

   The selection pops onto a new "Proposed" card. Underneath, this is today's overlap chain (refacets blocked into one binding proposal) and answers F12.
4. **Renegotiate.** Ticking a node that is already in a binding shows that binding inside the preflight: it either loses the node (a split), or gains the new participant (a join). The person chooses; the decision covers both.
5. **Review a proposal.** A "Compare specs" result, or someone else's proposal, opens as the same side-by-side view with Accept or Dismiss. It is reachable from Work and from the Bindings section.

## What carries over and what changes

| Built in LAYER-BINDINGS-01 | Under this proposal |
|---|---|
| `select` clauses, `facetOf`, roles, guards, held-aside entries, `repoint` | Unchanged. A spec node's selection is a `select` clause. |
| Refacet ops and overlap chains | Generated by "propose a binding" from ticked nodes; no longer typed by hand. |
| Manage › Facets (`layer-facets.ts`) | Replaced; its preflight wording moves into the binding preflight. |
| Hints, Discover's Assess overlap | Replaced by the Compare specs routine. Discover keeps proposing bindings that a template's spec declares outright, such as the design system. |
| Knowledge documents as database records | Read from the layer repository at the pin; edits commit there. Existing revisions need a migration decision (question 1). |
| `@aludel/host/roles` in views | Unchanged. Views still show roles where content is edited. |

## Evidence and gaps

| Need | Evidence now | Gap |
|---|---|---|
| A docs-site layout is learnable for this audience | Owner's description, decision 8 | No reference screens collected yet; no prototype |
| Spec and contents side by side on one node page | Data catalogs do this (schema and preview tabs); not yet researched with access dates | Reference research |
| Selection to binding is understandable without facets | The step-3 chain works (`overlap` and `branding` journeys) | No human-facing flow tested; the owner's review says the current one fails |
| A spec format that agents and people both use | `knowledge/*.md` and `api/openapi.json` exist in every template | No `information` tree in `layer.json`; no node pages |
| Compare specs gives useful proposals | None | Needs a trial: run the comparison on the Pages, Vision, Design and Personas specs and judge the proposals |

## Work sequence (each step needs the owner's go)

| Step | Output | Check | Stop if |
|---|---|---|---|
| K1 Reference research | Real screens from docs sites (Stripe, Mintlify, Docusaurus) and data catalogs (DataHub, Atlan, Unity Catalog): asset pages, schema with contents, lineage, and selection-to-action flows. Access dates. | Owner reviews the board | The owner rejects the docs-site frame |
| K2 Spec drafts | A written `information` tree for Pages, Vision, Design and a Personas layer, as files, not code | An agent answers "what does this layer keep?" from the spec alone | Node granularity can't be agreed |
| K3 Prototype round 1 | A clickable prototype on those four specs with realistic contents: Overview, Information with cards, a node page, edit docs, propose a binding (Personas ⇄ Vision), renegotiation (Branding taking brand from the design-system binding) | Agent walkthrough at desktop width and 390px | Owner feedback calls for a second round |
| K4 Compare-specs trial | One agent run over the four specs, output as proposals | The owner judges whether the proposals are right | Proposals are mostly wrong; detection stays manual for now |
| K5 Build plan | Slices for the spec format, repository-backed docs, the Knowledge tab, the binding flow and the routine, written after the prototype is accepted | Owner approval | — |

## Readiness

- **Verdict:** the questions are answered (A1–A8), so K1–K3 are authorized and ready.
- **What must not begin yet:** any build in the candidate, removing Manage › Facets or Connections, or changing the template contract.

## Questions for the owner (answered; see A5, A7 and A8)

1. **Docs move to the repository.** Should Knowledge read docs and spec from the layer repository, with each edit saved as a commit on a branch that you merge, replacing the database copies? Recommended: yes, so agents and people read one source at a known revision. The alternative keeps records and syncs them, which is the drift we already have.
2. **Where binding cards appear.** Should cards sit on the Information overview, with chips on nodes in the nav (recommended, because a nav holding cards is cramped)? Or should they be in the nav itself, as you first pictured it? The prototype can show both.
3. **Compare specs runs automatically on a spec change.** Should it create its Work as a suggestion you start, or start the agent run directly? Recommended: a suggestion, since runs cost turns.

## Owner answers, r1 (chat, 2026-10-01)

Itemised so the prototype can map each row to a screen.

| # | Ask | Applied as |
|---|---|---|
| A1 | Spec and docs live in Knowledge; actual contents are edited in editor tabs. | Node pages show contents read-only, linking to the tab that edits them. |
| A2 | If something counts as contents, it needs an editor tab. Pages' design kit is contents, so it needs one. | Every content node names its editor tab. Pages gains a **Kit** tab: a read-only replica, with "Propose a change" going to Design. The spec checks that every node has a tab. |
| A3 | Knowledge looks and feels like our docs site: one vertical sidebar, with **Docs** on top (including Overview) and **Information** underneath. | One sidebar with two sections, in that order. |
| A4 | Information nodes open detail pages like docs do, plus actions to select, bind and so on. | Node pages in the same reading pane. Select mode and Propose a binding sit in the Information section header. |
| A5 | Bindings, proposed or live, are **in the nav itself** and clickable for their details, as are the nodes inside them. The Information overview may show them too. | Binding cards in the sidebar under Information, each holding its nodes. A binding page and node pages. Cards are repeated on the Information overview. |
| A6 | Editor code doesn't need to be visible for now; it would get its own section later. | No code section in v1. Editor-tab docs stay under Docs. |
| A7 | Docs and spec go into the repository (Q1: yes). | Edits save as a commit on a branch that the owner merges. |
| A8 | A spec change just creates a task that a person or an agent can pick up (Q3). | "Compare specs" is an ordinary Work item, not an automatic run. |

**Interpretation to confirm in review:** "our docs site" is read as the docs-site layout described in r1, styled with the portal's own type, colours and chips, since Aludel has no public docs site.


## K1–K3 results (2026-10-01, agent-checked, not owner-reviewed)

### K1 reference screens

Captured with `tools/capture-refs.mjs` into [refs/](refs/manifest.json). Every image was viewed before being cited.

| Reference | What it shows | Used for |
|---|---|---|
| [Stripe docs](refs/stripe-docs.png) | Sectioned left nav with expanding groups, breadcrumb, page actions ("Copy for LLM", "View as Markdown") | Sidebar sections; breadcrumb; page actions row |
| [Stripe API object](refs/stripe-api-object.png) | One object's attributes, each with a type and a sentence | A node's **Shape** table |
| [Docusaurus](refs/docusaurus-docs.png) | Collapsible categories; an "on this page" outline on the right | Outline column at wide sizes |
| [Mintlify](refs/mintlify-docs.png), [GitBook](refs/gitbook-docs.png) | Grouped sidebars; a landing page of cards | The Overview's "What it keeps" cards |
| [Carbon Storybook](refs/carbon-storybook.png) | One sidebar: **Getting started** docs on top, the **Components** tree below | A3: Docs on top, Information underneath, in one sidebar |
| [dbt Catalog model page](refs/dbt-model-details.png) (product screenshot from dbt's docs) | Resource tree in the sidebar; a model page with description, columns and lineage | A node page joining spec (description, shape) with what it relates to |
| [DataHub Add assets](refs/datahub-add-assets.png), [Data Product page](refs/datahub-product-profile.png), [Set Data Product](refs/datahub-set-product.png) (product screenshots from DataHub's docs) | Assets ticked into a grouping; the grouping's own page with its assets; an asset naming the grouping it is in | Select → propose a binding; the binding page; the binding chip on a node |

These captures were not cited:
- Airbyte, Unity Catalog and DataHub's other docs pages, which were captured full-page and are too small to read;
- the Backstage demo entity pages, which returned not found (recorded in the manifest).

### K2 spec drafts

[specs/](specs/README.md) holds the draft node format and specs for Pages, Design, Vision, Personas and Branding, plus the project's two bindings. Writing them showed two things:
- **The selection rule:** a child's selection must sit inside its parent's. Vision's Brief first broke it, with claims as a child of sections, and was restructured.
- **A2 holds in practice:** Pages' Kit has contents but no tab, which made the missing Kit tab obvious.

The agent check ("can an agent answer from the spec alone?") has **not been run**.

### K3 prototype v1

[v1/index.html](v1/index.html) is built from [v1/src.html](v1/src.html) and the specs by `v1/build.mjs`. It is static and clickable; open it in a browser. [v1/walkthrough.mjs](v1/walkthrough.mjs) takes 22 screenshots into `v1/shots/` and checks 390 px. **Result: no page errors and no horizontal scroll.**

| Ask | Where to look |
|---|---|
| A1, A2 | Any node page's **Contents**, which link to the editor tab. Pages' new **Kit** tab is a read-only copy with "Propose a change" (shot 07). |
| A3 | One sidebar: **Docs** (Overview, Charter, Methods, Editor tabs), then **Information** (shot 01). |
| A4 | Node pages with About, Parts, Shape, Contents, Sharing, Points to and Referenced by, plus **Bind…** and **Edit spec** (shots 04, 08). Select mode ticks nodes in the sidebar (shot 12). |
| A5 | Binding cards **in the sidebar**: live, proposed (dashed) and their nodes. Each card opens the binding page (shots 06, 09); the Information overview repeats them (shot 03). |
| A6 | No code section. |
| A7 | Edit → Save to a branch → **Unmerged change** → Merge (shots 18–20). |
| A8 | Merging a spec edit creates the "Compare specs" task, as a toast with a W number (shot 20). |
| Renegotiation | Branding proposes **The app's brand** with Design's Brand assets (hand over) and Pages' Kit › Brand (keep a copy). The preflight says it renegotiates Design system (shot 13). After acceptance, Design system keeps Tokens and Components (shots 15–17). |

**Prototype limits:**
- Contents are illustrative.
- Search, Tasks, Manage, "Change it" and the other editor tabs are placeholders.
- Nothing persists across a reload.

## Review / acceptance record

**Prototype v1, owner review (chat, 2026-10-01).** "love love this prototype": the tree, the on-this-page outline, the layer header and tabs, and accepting a proposal ("very clean") are accepted. The owner said "no second prototype needed: work these changes into plan, and build it". Review rows:

| # | Feedback | Applied as |
|---|---|---|
| B1 | The tree and the on-this-page outline look great. | Built as prototyped. |
| B2 | The layer header and tabs look nicer; is it more compact? | Answered in chat from the measured difference. The more compact header is built (S3). |
| B3 | Pages' Kit, as part of Pages' information, is there just the same, but **fully editable when it isn't bound to Design**. | Kit tab in the Pages template: read-only with "Propose a change" while it follows Design; full create, edit and delete otherwise (S5). |
| B4 | Saving docs is simpler: click Save and it takes, with no branches or merging. **Previous versions** must be reachable to compare. | Save commits straight to the layer repository's `main` and moves the pin. Each doc has History, and any two versions can be compared (S2). |
| B5 | Accepting a proposal: keep as is. | Built as prototyped. |
| B6 | Propose a binding needs **several other layers**: a grid with an empty "click to add" block. | A participant grid with one card per layer plus an "Add a layer" card (S4). |
| B7 | **The lead is easy to toggle**, and clearly visible on cards. Each non-lead has a **"Keep a local copy"** check. | Each participant card has a Lead toggle. Non-leads get "Keep a local copy" (checked keeps a copy; unchecked hands over). The lead is marked on binding cards in the nav and on binding pages (S3, S4). |

**K5 built, 2026-10-01 (agent-checked):** S1–S6 in candidate `7c6152c` and `30d4d37`, with `layer-base` `main` `fee5f30` and template pins as listed in the [evidence and retrospective](../../evidence/layer-knowledge-01/README.md). Next: the owner's browser review.

**Owner acceptance, 2026-10-01 (chat).** "im happy with current knowledge ui". This accepts the built K5 Knowledge interface as reviewed in the candidate. It is not a promotion of the candidate, and it does not accept anything outside K5. The open LAYER-BINDINGS-01 follow-ups (F1, F3–F8, F10) stay with their named packets. LAYER-KNOWLEDGE-01 and LAYER-BINDINGS-01 are closed locally, and `next_action` moves to T03-CODE.

Authorization: build K5 in the candidate and on `layer-base` branches, under the same local scope as LAYER-BINDINGS-01: local commits and re-pins, no push, and no external, provider, deployment, spending or live-data effects.

## K5 build plan (owner-approved direction, 2026-10-01)

Slices, each committed locally when its checks pass. The step-3 machinery (select clauses, refacets, held-aside entries, binding changes and chains) stays underneath; this pass replaces how people drive it.

| Slice | What | Checks |
|---|---|---|
| **S1 Spec contract** | `layer.json` gains `information`: a tree of nodes `{key, title, intent, select, shape?, tab?, doc?, children?}`. The package check validates it: unique keys; selections over the layer's outputs; each child inside its parent; siblings disjoint; a node with contents names a tab. The select field `folder` is derived from an entry's `path`, so a folder of Markdown files is a node. A pure `nodesToChanges` turns ticked nodes into each layer's refacet: declare when nothing holds them, split when a facet holds more (which is the renegotiation), and reuse when an unbound facet matches exactly. The `layer-base` contract text and test are updated, and Pages, Design, Vision and Markdown get `information` (from the K2 drafts) and are re-pinned. | Unit tests for the validation rules and `nodesToChanges` cases; mutation-check each guard; contract tests on every branch; `typecheck-layer-ui` per pin |
| **S2 Docs in the repository** | Knowledge reads a layer's docs at its pin: the charter, `knowledge.documents`, node docs and tab docs. Save commits one file onto `main` and moves the pin, with no review step because these are documents. History lists the file's commits, and any two versions can be compared. UI builds are keyed by the bytes of the files they use, not the commit, so saving a doc doesn't rebuild the views. The charter keeps feeding activation and discovery. | Server tests: save, refuse when stale, history, read a version, build key unchanged by a doc commit |
| **S3 Knowledge tab** | A docs-site layout:<ul><li>a sidebar with Docs, then Information, with binding cards in it marking who leads;</li><li>an outline;</li><li>pages for overview, doc (edit, history, compare), Information, node (shape, contents from the Library, sharing, references) and binding (accept or dismiss, plus what changes).</li></ul>The compact layer header goes in too. Manage › Connections and Manage › Facets are removed. | Journey `knowledge`; axe; 390 px |
| **S4 Bind from the tree** | Select in the sidebar, then **Propose a binding**: a participant grid with an Add-a-layer card, a Lead toggle, "Keep a local copy", a name and "how the parts match". A server preview returns each layer's refacet, the renegotiated bindings, roles and reference Work. Submitting creates the existing chain. Accepting on the binding page decides the refacets and the binding in one action. **Compare specs** replaces hints: a spec change raises one Work item for a person or an agent, and hints stop driving Discover. | Server tests for preview and chain; journeys `overlap` and `branding` rewritten to use the tree |
| **S5 Pages Kit tab** | The Pages template gets a Kit tab and `createKitItem`, `updateKitItem` and `deleteKitItem`. The tab is read-only with the roles note while Kit follows a lead, and editable otherwise. Pages' spec names it. | Pages template tests; journey: Kit read-only while bound, editable after the binding is retired |
| **S6 Closeout** | Full suites; all journeys; evidence and retrospective; status. | `test:server`, `test:server:templates`, every journey |

**Out of scope, recorded:**
- **Legacy database documents** (`layer_documents`) are no longer shown. Their template defaults are in the repository; existing projects are out of scope, as for LAYER-BINDINGS-01.
- **A whole bound group moving to another binding** is refused, with a message pointing to that binding's own change. Splits cover the cases the owner described.
