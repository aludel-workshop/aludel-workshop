# Code source inventory (T03-CODE, 2026-10-01)

Where each part of the compiled Code layer lives in the portal (`apps/portal` on `main` at `53fcb92`), and where it goes. Taken before any template code was written, so portability is claimed against this list rather than a passing unit test.

| Part | Portal source | Reads or writes | Goes to |
|---|---|---|---|
| Declaration | `server/layer-contract.mjs` `legacyDeclarations` (`platform`: `code_unit`, `trace_link`, `code_release`, `code_route_observation`; `code_projection`) | — | `layer.json` |
| Views | `src/layers/code.ts` (509 lines): Overview, Explorer, Tests, Docs, Releases, plus route observations | `GET code/files`, `code/file`, `code/docs`, `code/releases`, `code/ci`; `POST code/index`, `code/docs-starter`, `code/docs-refresh`, `code/releases`, `code/releases-publish`, `layers/code/route-observations`; `ctx.link('product' \| 'pages' \| 'deploy' \| 'platform', …)` | `ui/`; Docs into Knowledge; links to other layers through Library entries |
| Files, stack, variables | `server/code-layer.mjs` `trackedFiles`, `readSource`, `readStack`, `readVariables` | The workspace (git `ls-files`, file reads) | Host features (`repositoryFiles`, `source`) |
| Docs and the sidecar | `code-layer.mjs` `readDocs`, `starterDocs` | Workspace docs; `docs/.aludel/sources.json`; `know.list` of persona, story, `data_object`, `data_operation`, and Design's tokens and components **by layer key** | Generic Knowledge doc checks; starter docs to `seed('install')` through a Code-owned adapter over the Library |
| Releases | `code-layer.mjs` `codeReleases`; table `code_releases` | git log, trailers, `package.json` at commits, added migrations | `.aludel/releases.json` with handler rules; git-derived parts stay host |
| Publish and CI | `server/server.mjs` `releases-publish`, `ci`; `github-integration.mjs` | GitHub (App installation token) | Host |
| Code units and links | `server/code-links.mjs` (398 lines); tables `code_units`, `trace_links` | TypeScript parser over `src/`, `server/`, `tests/`; trailers; test names; generation manifest | Host index library (units); `.aludel/trace-links.json` (manifest links) |
| Route observations | `server/pages-code-observations.mjs` | Committed blobs | Unchanged (F10) |
| Coding runs | `code-candidates.mjs`, `code-action-gateway.mjs`, `symphony-worker.mjs`, `task-manifest.mjs`, `symphony-readiness.mjs` keyed by `platform.*` | The workspace, candidates, previews | The generic layer Work path with the manifest's writable set |
| Scaffold | `server/scaffold.mjs` (668 lines) | Design kit and records by layer key | Host; reads the kit and records through the Library |
| Repository binding | `github-integration.mjs`, table `repository_bindings` | GitHub | Host; extended with sync state on the layer-instance repository |
| Consumers | Deploy (`platform-ops.mjs`, compiled) reads releases and the workspace; Pages reads route observations; Work reads the coding pipeline | — | Deploy reads releases from the Library |
