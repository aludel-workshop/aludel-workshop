# Layer contract

A layer is a small application inside an Aludel project. Aludel hosts it: Work, review, access, discovery and storage are shared; everything the layer owns is in this repository.

## Files

| Path | What it is | Who reads it |
|---|---|---|
| `layer.json` | Manifest: key, name, presentation, the output kinds the layer owns, its tabs, Knowledge files, Work scope and API. The host rewrites `key`, `name` and `path` when an instance is installed. | Host |
| `knowledge/charter.md` | The layer's identity and method. Agents doing this layer's work read it first. | People, agents, neighbors |
| `knowledge/*.md` | Task-facing method and output notes, listed in `layer.json`. | Agents |
| `api/openapi.json` | OpenAPI 3.1 document: every operation that reads or changes this layer's outputs, and the schema every stored record must satisfy (`x-aludel-records`). Anyone who changes the layer's data calls these operations. | Host, people, agents |
| `server/*.mjs` | The API handler: a pure module exporting `normalize(kind, data, context)` and `run(operationId, input, context)`. No I/O. | Host (only reviewed source runs) |
| `outputs/` | Output files, for a layer that keeps some outputs as files (see below). | Host, Library, people, agents |
| `ui/` | The layer's own views, when it needs more than the host's API-derived views. | Host |
| `layer.json` `hostCalls` | Named host features the layer's views use beyond the Library, its own API, records and files, and creating Work (for example `documents`, `pageChanges`, `skeleton`, `uploads`, `brandTemplates`, or `libraryRecords` to write the Library's own documents and reference links). The host defines each feature's routes or record kinds; a layer can only request one by name. | Host |
| `layer.json` `ui.hostSdk` | The host modules the views import as `@aludel/host/<name>` (for example `context`, `app-kit`, `docs`). Shared rendering lives there and takes data as input: `app-kit` draws the app kit (tokens, components, brand) whichever layer publishes it, so a layer that previews the app reads the kit from the Library and never imports another layer's code. | Host |
| `layer.json` `facets`, `adapters` | The bodies of knowledge this layer maintains and publishes, the roles each can take when a project binds it to other layers, and the adapters that import other layers' shapes into them (see below). | Host, Work's binding routines |
| `tests/` | Tests for this repository. `tests/contract.test.mjs` checks the contract below. | Agents, reviewers |

## Where the package sits

A layer repository usually is the package: `layer.json` at its root. When the repository belongs to something else (an app, for the Code layer), the package sits under `.aludel/` and everything else stays the owner's:

- The host looks for `layer.json` at the root, then at `.aludel/layer.json`. **Every path the manifest names is relative to the package root**, as are this repository's tests and the run sandbox's `.aludel/outputs/` copy (so `.aludel/.aludel/outputs/` in a nested package, which the package's `.gitignore` ignores).
- **Installing into an existing repository** copies the template's package under `.aludel/` as one commit on `main`, with the template commit named in an `Aludel-Template:` trailer and kept as `refs/aludel/template`. The template's history is not merged into the repository's. The host refuses a working tree with uncommitted or untracked changes rather than commit someone else's work, and binds a repository that already holds the package as it is.
- A template whose repository is the project's own (Code: the app's codebase) says `"install": "project-repository"`. Each project's instance then installs into the project's repository once it exists, instead of becoming a repository of its own. Until then, and while the repository has uncommitted changes, the layer waits.
- Knowledge saves, refacets and output-file edits commit under the package root. Nothing the host writes for the layer lands outside it, except the repository files the layer declares as its output (below).

## A remote: staying in sync with GitHub

A layer instance's repository can have a remote, the owner's GitHub repository, whose `main` is the shared copy. The instance repository is a working clone, and its pin is a commit on both. This works for any layer; Code turns it on first.

- **A person's change** (a Knowledge save, an output-file edit, an accepted run) is one commit on `main`, then a push. A push is never forced. If GitHub moved meanwhile, the host fetches once and tries once more.
- **A change made on GitHub** is fetched when the layer opens, after each push, or on request. A fast-forward moves the pin and re-indexes. If it changes the package's authority files (`server/`, `ui/`, `api/`, `tests/`, `layer.json` under the package root), the whole change is **held** until a person accepts it, because those files run on the host.
- **Both moved**: the host never merges automatically. The sync is held as *diverged* and Work asks a person to rebase or merge in a run; pushes wait.
- **GitHub unreachable** (not connected, an expired token, the App uninstalled, the repository gone): the layer keeps working locally and shows why.
- Git talks to GitHub only with a short-lived installation token, through askpass, with every credential helper cleared. Tokens are never stored, logged or put in a URL.
- In a repository shared with an app, the host refuses to move a checked-out `main` that has uncommitted changes. The app's next commit would otherwise undo the move.

## Two ways to keep an output

Each output kind is kept one way:

- **Records**: stored in the project database and changed through this layer's API. This suits rich, interlinked outputs edited piece by piece, such as pages and flows.
- **Files**: files under `outputs/` in this repository, declared in `layer.json` as `files: { paths, kinds, indexer }`.
  - The indexer is a pure module exporting `entries(files)`. It splits the files into entries: `{ id, kind, title, data }`, with IDs that stay stable across edits (for example an `x-aludel-id` in the file).
  - It may also export `normalize(kind, data)` (the rules for one entry) and `fromEntries(entries, { files })`, which writes entries back to the files. With these, the host's generic record calls work on file outputs too: a change is read, normalized, written back and committed as the person.
  - A person's edit is one commit on `main`. An agent's edit arrives on a branch and merges on review.
  - Either way, `main` moves only if the new files still index.
  - **Code units, parsed by the host.** `files.units` lists globs of source files (repository-relative, outside the package) that the host parses with the TypeScript parser at the same commit. The indexer then receives them as `entries(files, { units })`: `{ id, key, path, symbol, kind, hash, line, end, reachable, calls }`, with `key` as `path#symbol` and IDs stable within the project. A pure indexer can't import a parser, so the host does the parsing, and the indexer decides what entries the units become.
  - **Starting files.** `files.seeds: ["install"]` asks the host to call the indexer's `seed('install', context)` once per instance. It returns `{ files: { path: content } }`; the host writes each path that is among the layer's `knowledge.docs` and doesn't exist yet, plus the map and the sources sidecar, which the seed is given (`context.existing`) and may extend. `context` also carries the project's name, the repository's paths at the pin (`tree`), its manifest's dependencies (`stack`) and the other layers' Library `entries` (`{ ref, kind, revision, title, data }`), which the layer's own adapter reads by kind and fields. One commit as Aludel.
  - **A nested package's output can be the repository's own files.** `files.repository` lists globs relative to the repository root (`*` within a folder, `**` across folders, a trailing `/` for a whole folder), for example `["**"]` for a whole codebase. A run may change those files as well as the package's own. Whatever a manifest says, these are never a layer's output: `.env` and `.env.*` anywhere, `.git/`, and `.github/workflows/`. Review marks only the package's own `server/`, `ui/`, `api/`, `tests/` and `layer.json` as authority paths; an app's folder of the same name is output, not authority. `files.paths` may then be empty.

Either way, every entry is published to the Library with the layer instance that owns it and an integer revision per entry. Other layers read it and pin it there; layers do not call each other.

## Operation conventions

- **Create** (`POST` on a collection) takes `{ "<field>": record }`, for example `{ "page": { … } }`.
- **Update** (`PATCH` on `/{id}`) takes `{ "expectedRevision"?, "changes": { … } }`; unnamed fields are kept.
- **Delete** (`DELETE` on `/{id}`) takes `{ "expectedRevision"? }`.
- **Singleton** operations (`x-aludel-singleton: true`) take the record's fields directly.
- `x-aludel-context: [kinds]` asks the host to pass this instance's current records of those kinds to the handler as `context.records`, for rules that span records, such as unique paths or moving a folder with its contents.
- `x-aludel-parent: <field>` on a create or update names the request field that carries the record's parent, for records that sit under another (a story under a step). The handler returns it as `parentId` on the write and lists it among its references, so the host checks its kind and instance. Aludel's own record calls fill it from the person's chosen parent.
- `x-aludel-catalogs: [names]` at the document root asks for host catalogs, as lists, in `context.catalogs`.
- `run` returns `{ writes: [{ op: create | update | delete, kind, id, baseRevision, data }], references: [[id, [kinds]]] }`. Updates and deletes may touch only records the host passed in; creates choose a fresh ID.
- **Seeds** (`api.seeds` in `layer.json`, for example `["install", "look"]`): the handler may export `seed(event, context)` for the host events it declares. `install` runs once for a new instance; `look` runs when the project's Look & feel changes. `context.project` holds the project facts the host shares with every layer (`name`, `description`, `look: { feel, label, accent, font, radius }`), and `context.records` holds this instance's records of every output kind. Seed returns writes like `run`, each with an optional `note` that becomes its rationale. The host checks them like an operation's and applies them as Aludel. A layer's starter content belongs here, not in the host.

## Using another layer's output

A layer reads other layers only through the Library, and never requires them to publish its shape. When it needs another layer's output in a form of its own (Pages drawing a spec with a design kit, say), it keeps an **adapter** in its own repository: a pure mapping from the source's entries, in the source's own shape, to its own representation, with defaults for whatever the source doesn't supply. Supporting a new kind of source is a new adapter; the source never changes, and no adapter names another layer's key or screens.

An adapter is declared in `layer.json` and implemented in the handler, so it runs only at a reviewed commit:

```json
"adapters": [{ "id": "aludel-kit", "facet": "kit", "reads": "aludel.design-kit", "mechanical": true, "soft": false }]
```

- `facet` is this layer's facet the adapter fills; `reads` is the source **shape** it understands (a facet declares the shape it publishes as `shape`, for example `"aludel.design-kit"` or `"figma.variables"`).
- `mechanical: true` means the handler exports `adapt(adapterId, { entries, removed }, context)`. It receives source entries `{ ref, kind, revision, data, layer }` and the keys of removed ones, and returns writes like `seed` (records of the facet's kinds) for the host to check and apply as Aludel. Each record it writes names the entry it came from (`sourceRef`) and that entry's content digest (`sourceDigest`), so the binding can tell an import from drift.
- `soft: true` means part of the translation needs judgement; the binding raises it as Work in this layer, with the adapter's notes as instructions.

The adapter runs only when the project's binding for that concept is active (see below). Until then the facet holds whatever this layer has on its own, possibly nothing, and the layer still works.

## Information: what the layer keeps, as a spec

`information` in `layer.json` says what this layer keeps, in a tree people and agents read in the layer's Knowledge tab. Each part says what it is for, what it covers, the form it takes, and the editor tab its contents are edited in:

```json
"information": [
  { "key": "documents", "title": "Documents", "intent": "Markdown documents the project writes.", "select": { "kind": "markdown_document" }, "tab": "files",
    "children": [
      { "key": "people", "title": "Personas", "intent": "One document per person we design for.", "select": { "kind": "markdown_document", "where": { "field": "folder", "equals": "personas" } },
        "tab": "files", "doc": "knowledge/people.md", "shape": { "format": "# {Name}\n\n> {Their situation}\n\n## Needs\n- …" } }
    ] }
]
```

- `select` uses the same clauses as facets (below). `folder` is derived from an entry's `path`, so a folder of files is a part. A part sits inside what its parent covers, and siblings never overlap.
- `intent` is one line: what the information is for. Discovery compares layers by these, so write them for a reader who has never seen this layer.
- `shape` is optional. It is `fields` (`[name, type, meaning]`, usually from the API schema), a required Markdown `format`, or `free`. `doc` is optional: a `knowledge/*.md` page about the part.
- `tab` names where the contents are edited: one of `tabs`, or `files` for a Markdown layer. Anything a person can read here has somewhere to be edited.
- Docs and the spec live in this repository. People edit them in Knowledge, and each save is a commit on `main` that becomes the instance's pin, so earlier versions stay comparable. A change to `information` raises a "Compare specs" task, so a person or an agent can look for new bindings.

People never manage facets. They tick parts of this tree in Knowledge and propose a binding with parts of another layer's tree. The host turns that into the facet changes below.

## Docs the repository already has

A layer's docs are its Knowledge. Usually they are `knowledge/*.md` in the package. A nested package whose repository already keeps docs for its readers (an app's `AGENTS.md` and `docs/`) names them instead of copying them:

```json
"knowledge": { "charter": "knowledge/charter.md", "documents": [], "docs": { "map": "AGENTS.md", "paths": ["README.md", "docs/"], "sources": ".aludel/doc-sources.json" } }
```

- `paths` are Markdown files or folders, relative to the **repository** root. `map`, when given, is the file that indexes the rest (one of `paths` or beside them). `sources`, when given, is a JSON sidecar: `{ "<doc path>": { "<heading>": [[kind, id, revision], …] } }`, saying which Library entries each section was written from.
- Knowledge shows them beside the charter and methods, and a save is one commit on `main` at that path, as for any doc. The package's own `knowledge/` stays where it is.
- **Checks apply to every layer's docs**: relative links that point at nothing; with a sidecar, sections whose sources have a newer revision (they need a refresh) or are gone; with a map, docs the map doesn't name, by path or by a folder that holds them.

## Facets and roles

A **facet** is the host's stored form of information that is bound: the parts of `information` taken into one binding. A template may declare facets for bindings it expects (Design's kit, Pages' copy of it); otherwise they come from binding decisions. A facet is a coherent body of knowledge the layer maintains, such as a design system's tokens, its branding, or a set of user flows. It's declared in `layer.json`:

```json
"facets": [
  { "key": "kit", "title": "Design system", "kinds": ["design_tokens", "component"], "roles": ["authority", "replica", "ceded"], "views": ["tokens", "components"] },
  { "key": "identity", "title": "Name and mark", "select": [{ "kind": "brand_asset", "where": { "field": "key", "in": ["name", "mark"] } }], "roles": ["authority", "replica", "ceded"], "views": ["brand"] }
]
```

- `select` names the entries the facet holds: whole kinds of this layer's own outputs, or one kind narrowed by one field of the entry (`where` with `equals`, `in` or `notIn`). `kinds` is shorthand for whole kinds. **Facets never overlap**: a kind is selected whole by one facet, or split by one field into disjoint values. An entry in no facet is the layer's own business and is never shared. A facet is what the layer publishes to the Library, so state that used to be internal becomes a facet once the layer publishes it.
- **Refaceting.** When only part of a facet should be shared, the project refacets the layer: a reviewed change to this repository's `layer.json` that splits the part into a facet of its own, merges two facets, or retitles one. A facet keeps its `key` for life, and bindings follow keys.
- `roles` are the ones the facet supports when a project shares its concept with other layers:
  - **authority**: changes are made here.
  - **replica**: follows the authority, because this layer's own work needs the content (Code builds from the design system; its routes follow the flows). The binding's imports keep it current.
  - **ceded**: no longer maintained here; its views show a pointer to the authority and keep old records read-only.
  
  The test for replica or ceded is whether this layer's own work needs the data to produce its outputs without anyone else.
- **Drift.** Whatever the direction, a facet can change outside the binding (a commit made without the normal process). The project's binding detects it against its last agreed sync and, by its drift policy, adopts it into the authority, raises Work here to rectify it, or has it assessed. This layer needs nothing extra for that beyond publishing its facets faithfully.
- `views` are the tabs that edit the facet. Each must handle every role the facet declares: read-only with "propose a change" as a replica, and a pointer to the authority when ceded. That is a cost the template pays once. **Use the host's roles module** (`@aludel/host/roles`, listed in `ui.hostSdk`): `LayerRoles` says what a facet or entry is (`of`, `forKind`, `editable`, `editableKind`, `propose`), and `<aludel-role-note>` shows the note and the action. The host refuses a person's or agent's write to a replica or ceded entry whatever the view does; the view says why. The contract test checks that a layer with facet views imports it.
- `shape` (optional, default `<template>.<facet key>`) names the form the facet's entries take, so other layers' adapters can say what they read.
- `hints` (optional, deprecated) are no longer used for discovery: a person or an agent compares the layers' `information` instead. Nothing requires a layer to publish a particular facet.

- `refers` (optional, top level of `layer.json`) names the kinds this layer's references can point at, for example `["page", "persona"]`, or `["*"]` when it references by Library pin. When a facet another layer referenced is ceded, the project re-points those references to the new authority's entries as Work in this layer, if this layer can name the authority's kind. Otherwise it raises Work to write an adapter. A layer that declares nothing gets adapter Work.

**Views run in a sandboxed frame.** It has no browser dialogs (`prompt`, `confirm` and `alert` return at once without showing anything), so ask for input inline. A view never names its own layer: a template can be installed under any key (Vision's is `product`, and a fork has its own), and the host knows which layer a frame belongs to.

The layer itself doesn't know about bindings. A project-level **binding** (kept by Work, shown in Library › Bindings) names the facets that share one concept, their roles, and the authority. It turns changes into Work in the layer that should change; it never changes this layer's outputs itself. Imports run through this layer's own adapters (see "Using another layer's output"), so this layer must keep working with no bindings at all.

## Rules the host enforces

- A write operation declares `x-aludel-output` (one of `outputs`), `x-aludel-staging: record` and `x-aludel-access`. Reads declare `x-aludel-read`.
- Requests and every normalized record are validated against the document. Writes stay inside this layer instance; references the handler reports must exist.
- People's calls apply at once. An agent's calls are staged for its run and apply only when an elevated reviewer accepts it.
- A change to this repository arrives as a branch. Accepting the review merges it into `main`; the new `main` must be a valid layer whose rules still accept every existing record. Handler source runs on the host only after a reviewer accepted those exact bytes.

## Adding a file output

1. Add the kind to `outputs` and to `files.kinds`, and the file to `files.paths`.
2. Have the indexer return entries of that kind with stable IDs.
3. Run the tests. The contract test indexes the current files and round-trips them if the layer writes them back.

## Adding an output

1. Add the kind to `outputs` and, if people edit it in a custom view, a tab.
2. Describe its operations and record schema in `api/openapi.json`, and declare `api` in `layer.json`.
3. Implement `normalize` and `run` for it in the handler.
4. Run the tests.
