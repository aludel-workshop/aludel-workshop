---
id: LAYER-BINDINGS-01-REFACET
kind: design-plan
status: proposed
updated: 2026-10-01
depends_on: [LAYER-BINDINGS-01]
supersedes: "facet-splitting plan of 2026-10-01 (areas inside facets), rejected by the owner"
---

# Refaceting: reshaping what a layer shares, so bindings contract on exactly the matching part

## Authorization and scope

**Owner chat, 2026-10-01**, rejecting the first step-3 plan (named parts inside facets):

> "i would rather be able to cleanly seperate the original facet - so vision, just split off the part of it that dealt with personas to a distinct facet marked as 'ceded' to the new personas layer. … we need this 'refaceting' concept in general, say we add a new layer, only part of an existing output matches part of an output of the new layer? need to be able to contract just on the matching part. … there is a new, unrelated layer that just happens to cover a part of an exisitng layers outputs. like the foundation of any action being work, that's what i want to keep building around."

Earlier the same day the owner said existing projects don't matter (only disposable tests exist), and asked for the general case rather than the Branding example.

This document is the plan only; nothing in it is built. It is step 3 of [the work record](work-record.md).

## The idea in one paragraph

A **facet** is a distinct, declared part of a layer's outputs, and a **binding** always contracts on whole facets. When only part of a facet should be shared, the layer is **refaceted**: the facet is split so that the matching part becomes a facet of its own, which can then be bound, ceded or replicated without touching the rest. When a new layer arrives whose output only partly overlaps an existing one, both sides are refaceted as needed so the overlapping parts are distinct facets, and the binding contracts on those. The other layer is always just another layer — new, imported, or a heavily modified version of the original — never assumed to be a copy. Every step is Work.

## What changes in the model

### 1. Facets are distinct slices of a layer's outputs

A facet names the kinds it covers and, when it needs part of a kind, a field condition:

```json
"facets": [
  { "key": "intent", "title": "Product intent", "select": [{ "kind": "vision_section" }, { "kind": "brief_claim" }, { "kind": "story" }], "roles": ["authority", "replica", "ceded"] },
  { "key": "personas", "title": "Personas", "select": [{ "kind": "persona" }], "roles": ["authority", "replica", "ceded"] },
  { "key": "brand-identity", "title": "Name and mark", "select": [{ "kind": "brand_asset", "where": { "field": "key", "in": ["name", "mark"] } }], "roles": ["authority", "replica", "ceded"] }
]
```

- `select` replaces `kinds`. A clause names one kind of the layer's own outputs, optionally narrowed by a `where` on one field (`equals` or `in`). The host evaluates it; no layer code runs.
- **Facets never overlap.** Every output entry belongs to at most one facet. The host and the contract test check this against the layer's current records. Entries in no facet are the layer's own business and are never shared.
- A facet keeps its `key` for life. Bindings refer to it by key.

### 2. Bindings contract on whole facets, with one authority

Because a facet can always be made exactly the shared part, a binding no longer needs parts of its own. **Area-split authority and the replica `keeps` list are removed** from bindings and from the pure module. A binding is one concept, its participating facets with one role each, and one authority. Where step 1 needed "authority split by area" (Design keeps tokens while Branding takes branding), the answer is now two facets and two bindings.

### 3. Refaceting is a change to the layer itself, done as Work

A **refacet** changes a layer instance's facet declarations. Since every installed layer is its own repository (DEC-055), this is a change to that repository's `layer.json`. It arrives as a branch, is reviewed, and merges like any other layer change. The operations are:

| Operation | Example |
|---|---|
| **Split** a facet: move some of its select clauses, or narrow one with a `where`, into a new facet | Vision `intent` → `intent` + `personas` |
| **Merge** two facets of the same layer | Undo the split once Personas is uninstalled |
| **Rename** a facet's title (never its key) | — |

Rules the refacet change is checked against, before it can merge:
- The new facets stay distinct, and every record that was in a facet is still in exactly one.
- **Bindings follow keys.** The facet that keeps the original key keeps its bindings and roles. A newly split-off facet starts unbound, with the same role its parent had, or a role the refacet names explicitly (for example `ceded` toward a named binding).
- A split-off facet inherits the parent's supported roles unless the change narrows them. Views must handle each declared role (see 5).

The refacet's preflight (shown in its Work item) lists:
- the records that change facet;
- the bindings each facet keeps or loses;
- the references from other layers into the part that is moving.

### 4. Contracting on a partial overlap is a short chain of Work

When a new layer covers part of what an existing one has, nothing is assumed; the steps are ordinary Work, linked so each starts when the one before is done (Work items already carry `blocks`):

1. **Assess overlap** (Work in Work, usually soft, for an agent or person). Read both layers' charters, facets and Library entries, and propose which part of each corresponds. Discover raises this when a newly installed layer's facets share hints or shapes with an existing layer, and a person can raise it at any time.
2. **Refacet each side that needs it** (Work in each layer). Split out the matching part, as in 3. A side whose facet already matches exactly needs nothing.
3. **Propose the binding** (Work in Work), on the now-distinct facets: authority, roles, policies, and the adapters each non-authority side needs.
4. **Accept the binding.** Closing that Work with acceptance applies it. The first reconcile then raises the rest as Work in the layers that should change: adopt, import, or write an adapter.

For example, Vision's personas cede to a new Personas layer:
- assess overlap;
- refacet Vision (`intent` + `personas`);
- propose the binding (Personas `people` facet authority, Vision `personas` facet ceded);
- accept it;
- the first reconcile raises **adopt** Work in Personas, offering Vision's personas in Vision's own shape, through an adapter Personas owns;
- once adopted, Vision's persona records are read-only history and its Personas tab shows a pointer.

The same chain covers Branding from scratch, imported branding, or a heavily modified copy of Design. Only who owns which adapter changes.

### 5. Roles reach every view and every write

- The host resolves each entry's facet, and each facet's role in active bindings: `{ facet, role, binding, authority: { layer, name, link } }`. This appears in Library entries, in the layer's own API reads, and through a new host SDK module, `@aludel/host/roles`.
- **Host write guard.** A person's or agent's write to an entry in a replica or ceded facet is refused with "Managed in ⟨authority⟩. Propose a change there." This includes a create that would land in that facet. Only binding imports write there.
- **Views** use `@aludel/host/roles` for three things: a read-only state with "Propose a change" (raising Work in the authority's layer), a ceded pointer with read-only history, and full editing as the authority. The base contract requires every facet view to use it, and the base template shows the pattern once.

### 6. References into a ceded facet move with Work

A ceded facet's records stay where they are as history, so nothing breaks at once. Pages sections and flows point at persona IDs, though, and those should come to point at the new authority. Once the adopt Work has created the authority's entries, the binding knows each pair (source ref → authority ref). It then raises **re-point** Work in every layer that still references the ceded entries.

A referencing layer whose references can't name another layer's kind gets **adapter** Work instead. For example, Pages checks section audiences against the `persona` kind, which a Personas layer with its own `person` kind wouldn't satisfy. This is the old host-kind reference model running out. Cross-layer references should become Library pins (DEC-059), and this plan surfaces each such place rather than working around it.

### 7. Kinds can repeat across instances

Unrelated layers may still choose the same kind names (two layers with `persona`). Kind identity becomes (instance, kind). `kindOwners` and the Library already handle several owners. Host code that reads a kind project-wide must name the instance, or ask for "the authority for that facet", instead. Examples are `list(projectId, 'persona')` in the Work view, Pages' data and Code's starter docs.

## Every action is Work

| Action | Work item | Where | Applied when |
|---|---|---|---|
| Assess an overlap | Assess overlap | Work | Its proposal is accepted (raises refacets and a binding proposal) |
| Refacet a layer | Refacet | That layer | Its repository branch is reviewed and merged |
| Propose or change a binding (create, join, transfer, roles, policy, pause, dismiss) | Binding change | Work | Its Work closes as accepted |
| Import, adopt, rectify, review, write an adapter | As in step 2 | The layer that changes | As in step 2 (mechanical imports apply on their own and are recorded) |
| Assess drift | Assess | Work | Decided adopt or rectify |
| Re-point references into a ceded facet | Re-point | The referencing layer | Closed |
| Retire an emptied facet or layer | Refacet (merge or drop), or uninstall | That layer, or Manage | Reviewed |

**Library › Bindings becomes a view onto these items.** Its Accept, Dismiss, Pause, Adopt and Rectify buttons decide the binding's Work item rather than calling the binding API directly. This fixes a step-2 gap: accepting a proposal from the Library left Discover's review Work open.

## Test cases (fixtures first)

| Case | What it proves |
|---|---|
| Vision → new Personas layer (base template, its own `person` kind) | Refacet by kind; cede; adopt through an adapter Personas owns; Pages references re-pointed, or adapter Work where Pages can't express them |
| Design branding → a Branding layer built from scratch | Refacet within a kind (`brand_asset` where `key` in name, mark, …); Design's tokens binding untouched |
| Design branding → an imported, read-only branding source (Figma-like) | The authority can't take Work: adopt is refused, and replicas and ceded are the only options for the others |
| Design branding → a heavily modified fork of Design | Shared kind names across instances (section 7) |
| A new Content layer whose `copy` overlaps part of Pages' section content | Partial overlap on both sides: two refacets and one binding |
| Pages' kit straddles two authorities once Branding exists | A replica facet is refaceted too (`kit` → `kit` + `kit-brand`), each in its own binding |
| Merge Personas back into Vision | The reverse chain: transfer authority, refacet merge, uninstall |
| Refacet rules | Overlap refused; every record still in one facet; bindings follow keys; a split-off facet starts unbound |
| The write guard | A person, an agent, and a view that forgot to lock a ceded entry are all refused |

## Implementation slices

| Slice | Content | Proof |
|---|---|---|
| **R1 Contract (pure)** | Facet `select` with `where`, distinctness, entry → facet resolution; bindings without areas or `keeps`; a pure `refacet` (split, merge, rename) with binding follow-through and a preflight; reference re-pointing pairs | Fixtures for every case above; the order-reversal stability check; a mutation check |
| **R2 Work as the vehicle** | Binding changes as Work items applied on acceptance; Library › Bindings deciding those items; refacet Work producing a reviewed branch of the layer's `layer.json`; `blocks` linking an overlap chain | Server tests: proposal → accept via Work → active; Discover's review item closed; a refacet branch refused when facets overlap |
| **R3 Host** | `roleOf`; the write guard; kinds per instance (audit and fix project-wide reads); roles in Library entries | Server tests for the guard; two instances with `persona` that don't mix |
| **R4 Views** | `@aludel/host/roles`; base contract requirement and test; Vision and Design adopt it (two different layers, to show generality) | Per-pin UI typecheck; each view renders all three roles |
| **R5 Overlap and journeys** | Discover raises Assess overlap for a new layer; journeys for the Personas cede, Branding from scratch, and a merge back, with axe and 390px | Browser journeys with templates on |

## Proposed defaults

1. **Area-split authority and `keeps` are removed from bindings**; refaceting replaces them (section 2).
2. **The facet keeping the original key keeps its bindings**; split-off facets start unbound unless the refacet names a role.
3. **Ceded records stay as history**, and references are re-pointed by Work rather than rewritten by the split.
4. **Assess overlap is soft Work** (an agent or a person), raised by Discover on install and available on demand. Matching is never automatic.

## Risks and reversal evidence

- **`where` facets can change membership when the field changes** (a brand asset's `key` edited). The plan treats that as the entry moving facet, with its role changing accordingly. If fixtures show this is confusing, restrict `where` to fields the template marks as stable.
- **References by host kind (section 6) may block many re-points.** If they do, converting cross-layer references to Library pins becomes a prerequisite slice, not a follow-up.
- **Refacets on layers with many records may be slow to review.** If so, the preflight should summarise by kind rather than listing records.

## Readiness

Ready for owner review. R1 can start once the defaults are accepted or changed. Nothing depends on existing projects.
