# One base layer repository; every layer is a fork (LAYER-BASE-01 B1–B7) — 2026-09-30

## Authorization and readiness

The owner directed the following:
- Adding any layer creates a repository for that instance, forked from the base layer or a template.
- The templates (Markdown, Pages) are recreated as branches of one base layer repository.
- A layer is built from its own repository, and review acceptance merges the work.
- Agents test on their branch in their sandbox.
- Review is always elevated.
- Implement for the base layer, prove it with Markdown, then validate Pages.

The scope, the packet order and the open B6 choice are recorded in the root [work record](../../../../docs/design/layer-scoped-work/work-record.md#layer-base-01-one-base-layer-repository-templates-are-its-branches-every-instance-is-a-fork-2026-09-30). The work is local only.

## Observed implementation

- **B1 base repository** (`layer-base`, local):
  - `main` is the base layer: a manifest with no outputs, a charter template, `docs/layer-contract.md` (files, operation conventions, host rules, adding an output), an agent guide, and `tests/contract.test.mjs`. The contract test covers manifest validity, API/handler agreement, and the handler accepting the sandbox's output copy.
  - `pages` recreates the Pages template in four commits on `main`. It is identical to the retired template except for the base additions, and has the same handler bytes. A base docs change was merged into `pages` to prove updates flow from base to template.
  - `markdown` adds document and folder operations with a pure handler (paths, parent folders, subtree moves, empty-folder delete).
- **B2 fork on add.**
  - `config/layer-templates.json` pins each template branch.
  - Installing a layer clones the base repository at its template commit into the instance's own repository. The instance's `main` starts there, with an install commit that sets its key, name and path, and brings an existing charter along.
  - Custom layers fork `markdown` (default) or `base`. Pages forks `pages`.
  - The binding records the template and template commit, for later template updates.
- **B3 generic host.**
  - Any installed layer that publishes an API owns its record kinds. Records carry their instance, and a kind owned by several instances needs the layer named.
  - Host writes use the owning layer's rules.
  - The UI's generic create, change and delete calls map to that layer's operations by convention.
  - Handlers ask for host catalogs (`x-aludel-catalogs`) and context records (`x-aludel-context`), and may make several writes including deletes.
  - Reviewed handler bytes are listed by path and digest, whichever instance runs them.
- **B4 Markdown on its API.** The Markdown editor's routes keep their responses but call the layer API when the layer has one. Existing Markdown layers are adopted into a repository at startup, with their files, charter and an ID map; earlier file revisions stay in the old tables.
- **B5 branch → merge.**
  - The workspace hook gives a layer run its instance repository in `layer/` on `work/<ref>-<attempt>` from a Git bundle, hidden from the project checkout, with `.aludel/outputs/` holding current outputs and catalogs.
  - `aludel_layer_commit` has the host commit the checkout and fetch the branch into the instance repository with the agent's test results. Paths, package validity and API loading are checked; nothing runs.
  - Accepting fast-forwards `main`, or creates a merge commit if `main` moved and the merge is clean; otherwise it is refused. It then records the reviewed handler bytes, requires the merged rules to accept every existing record, and moves the pin. `main` is restored if the transaction fails.
  - Staged data requires the pin unchanged; a repository-only run can merge onto a moved `main`.
  - Review shows the branch diff and a Tests tab with the agent's sandbox results, labelled as not re-run by Aludel.
  - Review is elevated for any combination of changes; the owner-only rule was removed.
- **B7 Pages validated** on the generic path.

## Checks

- Portal server suite **188/188**. New tests cover:
  - fork on add for Markdown, base and Pages;
  - two Markdown layers kept apart;
  - Markdown editor operations through the API;
  - adoption with files and charter;
  - an agent Markdown run;
  - sandbox branch commit with the repository's own tests actually run against the output copy;
  - refused paths, package and API;
  - fast-forward merge, merge commit onto a moved `main`, conflicting merge refused, rule change refused with `main` restored.
- Base repository tests: `main` 1 (+2 skipped), `pages` 10, `markdown` 4 (+1 skipped).
- Workspace hook tests **2/2**, including the real hook preparing a layer checkout from a served bundle.
- Typecheck, build and `git diff --check` passed.
- Browser, with and without templates: **pages**, **layer-bar** and **markdown-editor** all pass. With templates on, the Markdown journey runs on a forked Markdown instance through its API.
- `layer-scope` journey passes, including a sandbox branch and its Tests tab (screenshot inspected).

## B6: layer views from their own repository, in a sandboxed frame (owner chose option (a))

- **Build.** `tools/build-layer-ui.mjs` compiles an instance's `ui/` files, as listed in its manifest at the pinned commit, into a separate bundle. It uses the portal's own host modules, the ones `@aludel/host/*` imports resolve to, and executes nothing from the repository. Viewport units are rewritten to follow the portal's viewport. Builds are keyed by commit, layer and the portal's frame-SDK digest, so instances on one template commit share a build. Builds run at startup, after an accepted merge, and on first view; one takes about 6 s.
- **Frame.**
  - Each instance's views are served from its own origin (`i-<instance>.layers.<base>`) with `sandbox allow-scripts allow-forms allow-same-origin`, no network (`connect-src 'none'`), no forms, and no top navigation.
  - The frame may embed only its own project's app and may be framed only by the portal.
  - The portal's session cookie is host-only (`SameSite=Strict`), so the frame never has it.
  - The frame root carries the shell's theme tokens and the main column's typography.
- **Bridge.** Inside the frame, `FrameProjectContext` is the portal's own `ProjectContext`, with network access, navigation, images, and notices, errors and unsaved marks carried to the portal page by messages. The portal:
  - posts only to the frame's origin and accepts messages only from it;
  - forwards calls with `x-aludel-layer-frame`, which the server checks against the allowlist: project reads, this layer's API and records, creating Work, and for Pages its three host features;
  - mirrors notices and errors, and sizes the frame to its content.
- **Layer views are shown this way** whenever the instance's repository declares `ui`. Without templates, the compiled-in Pages remains.
- **UX regressions the full Pages journey found in the frame, all fixed:**
  - missing shell theme tokens (radii, lines, muted backgrounds);
  - icon font class not set (icons showed as text);
  - a doubled reload that re-rendered a newly focused field (the title typed into it was lost and Enter created a second blank);
  - `autofocus` ignored in cross-origin frames (focused by script instead);
  - the Built view's nested app losing its origin under the sandbox (fixed by per-instance origins);
  - the app's preview bridge answering only the portal (now also this project's Pages frame).
- **Measured:** Pages first render with a warm build, median **214 ms framed vs 135 ms** in the portal (local, 5 loads each). Moving between Map, Pages and Flows keeps the frame.
- **Checks:**
  - Server suite **192/192**, with new frame tests for the allowlist matrix, per-instance host classification, served CSP and path safety, and a real build shared across instances.
  - Typecheck and build pass.
  - The full **pages** journey runs inside the frame (made frame-aware without changing its steps; it also runs axe inside the frame and checks 390px width there). It passed **3/3** with templates on, and passes with templates off.
  - **layer-bar** and **markdown-editor** pass in both modes.
  - **layer-scope** passes, including real HTTP checks that frame-marked calls to Access or another layer's records get 403.
- **Limits:**
  - About 80 ms more on a full load.
  - Drags that leave the frame stop tracking.
  - The test waits for the new blank's title to take focus before typing: focus arrives 60 ms after render, as in the portal, but the frame's extra hop made a zero-delay test race it.
  - Layers without their own `ui` still use host views; generated views from a layer's API are not built yet.
  - Apps generated before this change need their preview regenerated before the Built view's inspection works from the frame.

## Limits

- The other five built-in layers have no template branch yet (LAT-T03), so they get no repository.
- A base-template layer that adds outputs but no `ui/` has no view for them; views derived from a layer's API remain to be built.
- The Symphony tools (`aludel_layer_call`, `aludel_layer_commit`) are not compiled; the hook's layer checkout is tested.
- Charter edits in Manage still write the database, not the repository.
- Template updates don't reach existing instances (deferred by the owner).
- Candidate refs and work branches accumulate.

## Retrospective

1. **Harder than necessary:** instance keys differ from template keys, which broke the host's reviewed-source list and the single-owner assumption in record writes. Both were caught by the Markdown proof, not by Pages alone, which is why the owner's "prove with a second template" order mattered.
2. **Easier next time:** a new template is a branch on `layer-base` with an API, a handler, a catalog pin and a reviewed digest. The contract test runs in every fork.
3. **Roadmap effect:** B6 is the remaining gap to "built from its own repo". LAT-T03 converts the other built-ins as branches of `layer-base`.
4. **Questions:** B6 needs a choice about how layer UI runs (see the root record). How template updates reach forks remains deferred.
5. **Process change:** the proving order (base → second template → Pages) caught two Pages-shaped assumptions that Pages' own tests could not.
