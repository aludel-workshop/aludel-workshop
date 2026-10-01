---
id: LAYER-BINDINGS-01-SPLIT
kind: design-plan
status: proposed
updated: 2026-10-01
depends_on: [LAYER-BINDINGS-01]
---

# Splitting any part of a layer into another layer

## Authorization and scope

**Owner chat, 2026-10-01**, after accepting step 2: "rather than a once off branding split to its own facet, how do we create a process to split arbitrarily? say in the future, we want to split off part of vision to its own layer? … set ourselves up for the general case. dont worry about existing projects. nothing except disposable tests. commit work so far. plan this general facet splitting of roles."

This document is the plan only; nothing in it is built. It replaces step 3 of [the work record](work-record.md) ("roles in views", which was written around the Branding example). Because only disposable test projects exist, there is no migration of existing data and no compatibility shims.

**Process lesson applied here.** The earlier step list was written around examples (Branding takes over branding). The owner's correction is to design the general operation first and treat each example as one test case of it. Every example below (Vision's personas, Design's branding, a split by a field value, a merge back) is a fixture of one operation, not its own feature.

## What a split is

A **split** moves authority over **part of a facet** to another layer: an existing one, or a new one made for the purpose. It is one reviewed change to a binding, followed by an ordinary first reconcile. After it:
- the receiving layer is the authority for that part;
- the source layer either keeps a **replica** of it (because its own work, or someone else's references, still need it) or **cedes** it (its views show a pointer, and old entries stay as read-only history);
- everything else in the source is unchanged;
- the reverse (a **merge**) is the same operation in the other direction.

The existing model already has most of this: one binding per concept, authority by area, roles, transfer, first reconcile, and kept subsets. What it lacks is a general way to *name a part* and to make every layer *respect roles per entry*. The plan adds those, so no split needs code written for it.

## Model additions

### 1. Areas: naming any part of a facet

An **area** is a named, declarative selector over a facet's entries:

```json
{ "key": "personas", "title": "Personas", "select": { "kinds": ["persona"] } }
{ "key": "logos", "title": "Logos", "select": { "kinds": ["brand_asset"], "where": { "field": "type", "in": ["image", "mark"] } } }
```

- `select` takes kinds, and optionally one `where` on a top-level field (`equals` or `in`). It is declarative, so the host evaluates it without running layer code.
- Areas can be **declared by the template** on a facet (`facets[].areas`), which names the natural parts of a layer: Vision's brief, personas, story map, specs and research.
- Areas can also be **defined in the binding**, so a split along a line the template never anticipated needs no template change.
- Every entry falls into exactly one area of a facet: the first area that matches, or `*` for the rest.
- The pure module already takes `area` per entry. The host's snapshot reader computes it from the selectors instead of trusting the publisher.

### 2. Roles per area

A participant's role is resolved per area: it is the authority where the binding's authority map names it, and otherwise holds the role the binding gives it for that area (falling back to its default). This replaces the step-1 `keeps` list, which was a one-off kept subset: "Design keeps name and mark" becomes two areas, one replica and one ceded.

### 3. Every entry knows its role

The host resolves `roleOf(instance, entry)` from active bindings, returning `{ role, area, binding, authority: { layer, name, link } }`. The result appears:
- in Library entries;
- in the layer's own API reads;
- through a new host SDK module (`@aludel/host/roles`) that layer views import.

### 4. The host guards writes

A person's or agent's write to an entry whose role is `replica` or `ceded` is refused with "Managed in ⟨authority⟩. Propose a change there." This includes creating an entry that would fall into such an area. Only a binding's import (`adaptLayer`, or the identity import below) writes there. Because this is enforced by the host for every layer, a layer that forgets to grey out a button still cannot drift by accident.

### 5. Views handle roles through one shared module

`@aludel/host/roles` gives views:
- the role of each entry or area;
- a read-only state with a "Propose a change" action, which raises Work in the authority's layer with the proposed difference;
- a ceded pointer, with history read-only.

The base layer contract requires every facet view to use it. The contract test checks that views listing a facet import it, and the base template shows the pattern once. After this, a layer handles every split without knowing about any of them.

### 6. Identity import

When the receiving facet publishes the **same shape** as the source (as it does when the new layer is a fork of the source's template), the host imports by copying each entry through the receiver's own `normalize`. No adapter code is needed. Different shapes still need a declared adapter, as Pages' kit has, and a missing one becomes `adapter` Work as today.

### 7. Kinds belong to an instance

A split usually forks the source's template, so two instances own the same kinds (two layers with `persona`). Kind identity becomes (instance, kind). The Library and `kindOwners` already handle several owners (the Markdown precedent), but host code still reads some kinds project-wide, for example `list(projectId, 'persona')` in the Work view, Pages' data and Code's starter docs. Those reads must name an instance, or resolve "the authority for personas" through roles. This audit is a prerequisite.

### 8. Copy, not move, and references stay intact

The split **copies** the part into the receiver (new IDs) and records each pair in the binding's correspondence (source ref → receiver ref). The source's original records stay where they are:
- **Replica** areas keep their originals, kept current by imports from the new authority. Every existing reference to them, inside the source layer or from other layers, keeps working and stays fresh.
- **Ceded** areas keep their originals as frozen, read-only history.

Pages sections and flows reference personas by ID, so a split that moved records would silently break them. Copying avoids that.

**The default role follows the replica rule.** *Does anything still need this content?* The split's preflight finds every reference into the part: from the source's own remaining records, and from other layers. Referenced entries default to **replica**; unreferenced ones to **ceded**.

**Trimming later.** A follow-up routine offers Work to re-point references at the new authority. Once nothing references a replica entry, it can drop to ceded. This is optional, not part of the split.

### 9. A split is one owner-reviewed change

`split({ source: { participant or instance + facet }, area or selector, to: existing participant | new layer { template, name }, roles })`:

1. **Preflight (dry run).**
   - Which entries move.
   - Which references cross the new boundary, and who holds them.
   - The proposed roles, per the replica rule.
   - Whether the receiver needs an adapter (identity if same shape).
   - Which other participants' wiring changes: for example, Pages' kit now follows the new layer for that area.
   - What Work the first reconcile will raise.

   The preflight is shown to the owner as the proposal.
2. **Proposal as Work** in Work, like Discover's. The owner accepts, changes the roles, or dismisses it with a reason.
3. **On acceptance:**
   - if the target is a new layer, install it, forked from the chosen template (default: the source's template, so the shapes match and the import is identity);
   - find or create the binding for the source facet's concept;
   - add the area if it is ad hoc, and transfer the area's authority;
   - set the source's roles for that area;
   - the new layer cedes every area it does not hold, so its views show pointers there;
   - every other participant's wiring for that area re-points automatically, as transfers already do.
4. **First reconcile,** as today: entries move into the receiver, mechanically when identity or an adapter applies, and the binding becomes active.

A **merge** is a split back to the original layer. After it, the emptied layer can be uninstalled once nothing references it.

## Test cases (fixtures first, then journeys)

The pure fixtures come before the host code, as the step-1 lesson says. Each is one case of the same operation:

| Case | What it proves |
|---|---|
| Vision › personas → a new "Personas" layer, forked from Vision's template | New layer from a fork; identity import; Pages' references to personas keep working (replica by reference); Vision's remaining stories still validate |
| Design › branding → an existing stand-in Branding layer with its own shape | Split to an existing layer; adapter needed; Pages' kit wiring re-points for the branding area only |
| Design › brand assets of type `image` or `mark` only (an ad-hoc `where` selector) | A split along a line the template never declared |
| Personas → split again (personas for admins only) | Nested split; areas inside an area |
| Merge Personas back into Vision | The reverse operation; the emptied layer can be uninstalled |
| An unreferenced area | Defaults to ceded; the source view shows a pointer |
| A write to a ceded or replica entry, by a person, an agent, or a template that forgot its views | Refused by the host |

## Implementation slices

| Slice | Content | Proof |
|---|---|---|
| **S3.1 Contract (pure)** | Areas and selectors; per-area roles replacing `keeps`; `split` and `merge` as pure operations with a preflight (moving entries, reference cut set, roles by the replica rule, wiring changes) | Fixtures for every case above, with the order-reversal stability check and a mutation check |
| **S3.2 Host prerequisites** | Kinds per instance (audit and fix project-wide reads by kind); `roleOf`; the write guard; the identity import; roles in Library entries | Server tests: the guard refuses replica and ceded writes from a person, an agent and the generic record route; two instances own `persona` without mixing |
| **S3.3 Split end to end** | Preflight API; split proposal as Work; new instance forked from a template; acceptance, transfer and first reconcile; correspondence of source ref → receiver ref | Server test of the Vision personas split on real pins |
| **S3.4 Views** | `@aludel/host/roles`; base contract requirement and contract test; Vision and Design views adopt it. These are two different layers, to show generality: a kit layer and a records layer | Per-pin UI typecheck; the views render all three roles |
| **S3.5 Journeys and UI** | A "Split…" action on a facet area in Library › Bindings (and later from a layer's Manage page), showing the preflight; journeys for the personas split, the branding split and a merge, with axe and 390px | Browser journeys with templates on |

## Proposed defaults (the owner may change any)

1. **Copy, not move;** references stay intact (section 8).
2. **A new layer from a split forks the source's template,** so the shapes match and the import is identity. The new layer can trim its template later through normal reviewed changes.
3. **The source's role defaults by the replica rule:** replica where anything still references the entry, ceded otherwise.
4. **Ad-hoc areas** are allowed in a binding, alongside the ones a template declares.
5. **Every split and merge is owner-reviewed Work.** Discover does not propose splits yet.

## Risks and reversal evidence

- **Project-wide reads of a kind may be widespread.** If the S3.2 audit finds too many, a split to a fork of the source's template becomes expensive, and new layers from splits should instead start from the base template with their own kinds (an adapter instead of identity).
- **A selector with `where` can move an entry between areas when its field changes,** for example a brand asset's type. The plan treats that as the entry moving area, with the role changing accordingly. If that proves confusing in fixtures, restrict `where` to fields the template marks as stable.
- **Replica by reference can keep a lot of duplicated content.** If it does, re-pointing references should become part of the split itself rather than a later offer.

## Readiness

Ready for owner review. S3.1 can start once the defaults are accepted or changed. Nothing in it depends on existing projects.
