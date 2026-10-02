# Knowledge spec drafts (K2)

LAYER-KNOWLEDGE-01, 2026-10-01. These are draft specs for five layers in the review project (Tool Share). They use the format proposed below. They are design input, not contract; the template contract changes only after the prototype is accepted.

## What a layer's knowledge holds

A layer's repository holds two things:

- **Docs:** Markdown pages about the layer, such as its overview, charter, methods and editor tabs. They live in the repository under `knowledge/`.
- **Information:** the spec tree. It lives in `layer.json` under `information`, and each node has its own Markdown page.

Contents are not part of the spec. In the drafts, `sample` holds illustrative contents for the prototype only; in the product, contents come from the Library.

## Draft node format

| Field | Meaning |
|---|---|
| `key`, `title` | Stable key, and a name a person reads. |
| `intent` | One line saying what this information is for. Compare-specs reads these lines first. |
| `body` | The node's Markdown page: what it means, how it is used, and what it does not cover. |
| `select` | What the node covers, as the existing `select` clause (`{kind, where}`) or, for repository files, `{path}` as a glob. A child's selection must sit inside its parent's. Sibling selections must not overlap. Together, the selections must cover the parent's. |
| `shape` | The form the information takes. `fields` is a list of `[name, type, description]` taken from the layer's OpenAPI schema. `format` is a required Markdown template. `free` means any text. |
| `tab` | The editor tab that edits this information. Required for every node with contents: if it can be read here, it can be edited there (owner ask A2). |
| `children` | Child nodes. A leaf may describe parts it does not split out; only whole nodes can be bound. |

A binding names nodes, not facets. The host stores the union of the nodes' selections as the facet. Facets stay internal.

## Agent check (K2)

The check: can an agent answer "what does this layer keep, in what form, and who else could use it?" from the spec alone? **It has not been run yet.** Run it with a fresh agent before K4.
