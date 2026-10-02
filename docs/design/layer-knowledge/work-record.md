# LAYER-KNOWLEDGE-01: the Knowledge tab as the layer's manual

- **ID / date / author:** LAYER-KNOWLEDGE-01, proposal r1, 2026-10-01, agent (Claude), from the owner's step-3 review of LAYER-BINDINGS-01.
- **Outcome:** a person can open any layer's Knowledge tab and learn what an agent learns before working in that layer:
  - what information it keeps, as a spec;
  - what is in it now;
  - what it shares, and with whom;
  - how it works.

  From the same place they can edit its documentation and propose bindings, without ever handling a facet.
- **Authorized scope:** this proposal only (owner chat, 2026-10-01: "propose what our ux actually needs here for knowledge"). Reference research, prototypes and building each need the owner's go. No external effects.
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

- **Verdict:** needs owner judgment on the questions below, then K1 and K2 are ready (local research and writing only).
- **What must not begin yet:** any build in the candidate, removing Manage › Facets or Connections, or changing the template contract.

## Questions for the owner

1. **Docs move to the repository.** Should Knowledge read docs and spec from the layer repository, with each edit saved as a commit on a branch that you merge, replacing the database copies? Recommended: yes, so agents and people read one source at a known revision. The alternative keeps records and syncs them, which is the drift we already have.
2. **Where binding cards appear.** Should cards sit on the Information overview, with chips on nodes in the nav (recommended, because a nav holding cards is cramped)? Or should they be in the nav itself, as you first pictured it? The prototype can show both.
3. **Compare specs runs automatically on a spec change.** Should it create its Work as a suggestion you start, or start the agent run directly? Recommended: a suggestion, since runs cost turns.

## Review / acceptance record

None yet.
