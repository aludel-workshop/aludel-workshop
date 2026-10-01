# LAYER-BINDINGS-01 step 3, R3: roles in the host — 2026-10-01

## Scope and authorization

Owner chat, 2026-10-01: "go", in reply to "Should I commit R2 and go on to R3?". R2 was committed first (candidate `43ea0f1`, workshop `95aab07`). The R3 scope is recorded in the [run log](../../../../docs/design/layer-bindings/work-record.md#run-log). It is local to this candidate. There were no `layer-base` commits or re-pins, and no GitHub, provider, deployment, spending or live-data effects.

## What was built

| Piece | Where | What it does |
|---|---|---|
| Entry roles | `apps/portal/server/entry-roles.mjs` (`entryRoles`) | Resolves what an entry is: its facet (from its layer's pinned facets), that facet's role in its binding, and its authority with the authority layer's name. Only bindings in force count (reconciling, active or paused); a proposal binds nothing. Manifests come from the package cache, so this costs one row and a facet check per layer per request. |
| Roles in reads | `library.mjs` (all output entries and `read`), `layer-api.mjs` (every API read) | A bound entry carries `role: { facet, role, binding, authority: { participant, layer, facet, name } }`. Entries with no binding in force are unchanged, and records' `data` is untouched. |
| Write guard | `layer-api.mjs` `callOperation` | A person's call and an agent's staged call (both go through `callOperation`) can't write an entry in a replica or ceded facet. It is refused with 409 "Managed in ⟨authority⟩'s ⟨facet⟩. Propose a change there." The guard checks the entry as it is and as the write would leave it, so a create landing in such a facet is refused, and so is an edit moving an entry out of one. Binding imports (`adaptLayer`) and seeds don't pass through `callOperation`, so they still write. |
| Kinds per instance | `knowledge.mjs` `list`, `checkDesign`; `design.mjs`; `server.mjs` | A project-wide read of a kind that two installed layers own is refused ("Several layers own … Name the layer."), as `layerApiForKind` already was. A named or single-owner read takes that instance plus untagged legacy rows, the Library's rule. Design's own rules (one token set, one asset per brand key) hold per instance, and the built-in Design's host features name `design`. Component-slot cleanup on delete finds referrers by ID in any instance. |
| Reference index | `entry-roles.mjs` `referencesTo`; used by `refacets.mjs` | Other layers' references into entries are found by scanning entry data for their IDs: nested, in lists, never an entry's own ID, never its own layer. A refacet's preflight now lists them at runtime. For example, Pages' kit copies name the Design brand assets they came from. |
| Suite timeout | `apps/portal/package.json` | `test:server` and `test:server:templates` run with `--test-timeout=300000` (see the retrospective). |

### Decisions made while building (for review)

1. **Repository-mode file edits aren't guarded.** A commit to a layer's own repository outside Aludel is exactly what bindings treat as drift, which they adopt or rectify. So the guard covers API writes, which is how layer data changes inside Aludel.
2. **References are found by scanning data, not declared.** Layers name each other's entries by ID in their data, so no handler or schema change was needed and existing records are covered. A string that equals an ID by coincidence would be a false hit; IDs are random, so that is unlikely.
3. **Re-point Work isn't raised by Watch yet.** `repoint` needs to know which kinds a referencing layer can name, and no layer declares that. It moves to R5's Personas journey, where a real referencing layer will exercise it.

## Checks (all run 2026-10-01 on this working tree)

| Check | Result |
|---|---|
| `tests/entry-roles.test.mjs` | 6 pass (templates on; the pure reference test also runs with templates off). They cover:<ul><li>references found nested and listed, never an entry's own ID or its own layer;</li><li>roles absent while the binding is proposed, and present after acceptance in the Library, in `read`, and in Design's own API reads;</li><li>a person's edit, a create and an agent's staged call refused on ceded brand assets, while the authority's tokens stay editable and Watch's imports into Pages' replica still apply;</li><li>a second instance from the Design template: an unnamed `brand_asset` read refused with 409, each instance reading only its own, and the Library telling them apart;</li><li>a refacet preflight listing Pages' kit copies as references into Design's brand assets;</li><li>an edit that would move a ceded entry out by clearing its `key`, refused.</li></ul> |
| Mutation check | 11 of 11 caught. The first run caught 10; the survivor (the guard ignoring the entry's current facet) needed the last test above. The breakages: no guard; guard ignores current; a proposal binds; no roles in the Library; no roles in API reads; mixed kinds read; a named read drops legacy rows (caught by the templates-off Design, Pages and Symphony tests); Design rules project-wide; references from own layer; an entry referencing itself; preflight without references. |
| `npm run test:server` | 270 tests: 257 pass, 13 skipped, none cancelled. |
| `npm run test:server:templates` | 270 tests: 263 pass, 7 skipped, none cancelled. |
| `npm run typecheck`, `npm run build`, per-pin `typecheck-layer-ui` | All pass; pins unchanged. |
| Browser, templates on: step 2's set (9 journeys) | All pass with roles in reads and the guard on. |

## Limits

- **Views don't show roles yet.** The role is in the data they read, but nothing renders "Managed in …" or a pointer for ceded facets. That is R4 (`@aludel/host/roles` and the base contract).
- **No re-point Work from Watch.** See decision 3.
- **Only the built-in Design's host features were named.** Other unnamed kind reads (for example `doc`, `story`, `persona`) refuse loudly in a project where two instances share that kind, rather than mixing them. Each should be named when such a project exists. This is by design, not done for every kind.

## Retrospective

1. **What made it harder?** Observed:
   - **The full suite hung for about 25 minutes.** My first named Design reads dropped untagged legacy rows, so in templates-off mode Design seeded a second token set at startup and the server crashed. The Symphony tests start the server with its output discarded and poll for readiness with no timeout, so the crash looked like a silent hang. Finding it took:<ol><li>finding the idle processes;</li><li>comparing against HEAD's files (a scratch worktree couldn't reach `../layer-base` and gave false failures);</li><li>re-running a copy of the test with output visible.</li></ol>
   - **The kinds audit found a real mixing read on its first run:** `checkDesign`'s project-wide token read.
2. **What would make the next one easier?**
   - The per-test timeout added to both suite scripts: a crashing spawned server now fails one test in 5 minutes instead of hanging the run. That is applied, not yet seen to fire.
   - A comparison against HEAD should swap files in the real checkout, not use a scratch worktree, because the candidate relies on sibling paths. Both are recorded in the work record's lessons.
3. **What did it reveal?**
   - Untagged legacy rows are a cross-cutting rule (the Library had it, `list` didn't). It is now one rule in both.
   - The guard's natural boundary is "writes through a layer's API". Anything else is drift, which bindings already handle.
4. **Questions.** None block R4.
5. **Process change applied now.**
   - The suite timeout, tested only by reasoning so far: the next spawned-server crash will show whether it fires as intended.
   - The R1 mutation rule was applied a third time and found a real gap.
