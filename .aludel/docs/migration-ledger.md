# Code migration ledger (T03-CODE, 2026-10-01)

Each owner decision and built behavior of the compiled Code layer, and what this template does with it. Sources, in the Aludel workspace:

- `docs/design/platform-layer/work-record.md`: owner brief ledger C1–C9, review rounds R1–R20 (DEC-049);
- `docs/evidence/platform-ux-01-code-deploy.md`: the build and its Round 3 (releases to GitHub, CI results, AGENTS.md as a map);
- `docs/evidence/lay-07-data-platform-agents.md` part D: code links (DEC-038);
- the owner's T03-CODE plan approval (2026-10-01, DEC-061) and DEC-062 (every layer's repository goes to the owner's GitHub).

Status: **preserved** (same behavior), **revised** (changed, with the owner acceptance named), **host** (stays in the host, with the reason) or **unavailable** (with the reason). Settled at T03-CODE run 1 (2026-10-02).

## Owner decisions

| # | Decision | Status | Where |
|---|---|---|---|
| C1, R12, R16 | Platform splits into Code and Deploy, bridged by releases. Code keeps the instance key `platform`, served at `/code` | Preserved | `layer.json` (`key: platform`, `path: /code`). Deploy stays compiled (DEC-059 (6)) |
| C2, R1, R2 | One Explorer tree: folders → files → chunks. A file opens whole; a chunk scrolls to and highlights its lines. Chunks never span files; links do | Preserved | `ui/code.ts` Explorer; units from the host index library at the pin (G-CODE), with the same `cu-` IDs |
| C3 | Not an IDE: no direct code editing. "Request a change" becomes Engineer work | Revised (DEC-057, DEC-060) | Request a change creates layer-scoped Work in Code, not `platform.implement` |
| C4, R7 | Stack is read from the manifests, never typed; a compact structure map with the stack per part and an "as of" | Preserved | `ui/code.ts` Overview; stack from `package.json` and the `Dockerfile`; a GitHub card shows the sync state |
| C8, C9 | Capture the existing worldview; each screen names the repository file it reads | Preserved | Views name paths (`package.json`, `Dockerfile`, `.env.example`, `docs/`) |
| R3, R5 | No Dependencies or Changes tabs; the stack diff lives in each release | Preserved | `releases.json` entries derive stack changes at their commit |
| R6, R18 | Releases are explicit, recorded in Code as its output; publishing a tag and GitHub Release to the project's own repository is authorized | Preserved; publishing stays host | `.aludel/releases.json` (question 5). The published URL is host state because it is a GitHub effect |
| R8, R9, R13, R14 | Docs are the important piece: AGENTS.md as the map into a Markdown tree in the app's repository, owned by the developers | Revised (DEC-061): Code › Docs folds into Knowledge | `knowledge.docs` names `AGENTS.md` and `docs/` at the repository root. The checks become generic Knowledge doc checks |
| R10 | Sidecar provenance file | Moved (JOURNEYS-01) | `.aludel/doc-sources.json`, beside the package, so the app's `docs/` holds only the app's docs. Forks pinned earlier keep `docs/.aludel/sources.json` through their own `layer.json`; Knowledge reads whichever path the manifest names |
| R11, R15 | Tests close the loop: story → scenario → tests → result. Not all tests are story-driven | Preserved | `ui/code.ts` Tests; CI results through the host feature `ciResults` |
| R19 | AGENTS.md starts from the README plus a short map, and grows | Preserved, moved | Starter docs become this template's `seed('install')` |
| R20 | CI results through the App's Checks and Actions permissions | Host | GitHub reads are host features (`ci`), requested by name in `hostCalls` |
| DEC-038 | Code links to knowledge records, never by tags in the code; units from the TypeScript parser | Removed 2026-10-02 | Trace links as `.aludel/trace-links.json`; units from the host index library. Code tracing was removed later (host `docs/design/code-tracing/deferred.md`). |
| DEC-059 (4) | Code's repository is the app repository; connecting an existing one is supported | Preserved | `install: project-repository`; installs into the workspace once it exists. Importing an existing GitHub repository: check, then confirm (`code-import.mjs`) |
| DEC-061 | Aludel's files in `.aludel/`; the app's docs are Code's Knowledge; the repository lives on the owner's GitHub, in sync | Preserved | `.aludel/` package root; `knowledge.docs` names AGENTS.md, README, ARCHITECTURE and `docs/`; sync with the project's repository binding (`layer-remote.mjs`, `codeSync`) |
| DEC-057 | Work names a layer, no per-action catalog; elevated review | Revised (DEC-057, DEC-060) | `work.scope: layer`. `platform.implement`, `platform.security` and `platform.docs` remain readable history |

## Built behaviors

| Behavior | Status | Notes |
|---|---|---|
| Source reads: tracked text files only; `.env`, untracked files, `..` and empty paths refused; 256 KB limit; binaries refused | Host, preserved | `repositorySource` host feature over the same `readSource` rules |
| Code units: functions, classes (components marked), consts, routes, HTTP handlers, SQL tables, tests; reachability from the entry files; end lines | Preserved | Host index library (`source-units.mjs`); parity at the same commit in `tests/code-template.test.mjs` |
| Trace links from the scaffold's generation manifest | Removed 2026-10-02 | `.aludel/outputs/trace-links.json`; adoption keeps every ID, record and pinned revision (parity test). Code tracing was removed later (host `docs/design/code-tracing/deferred.md`). |
| Trace links from `Aludel-Work` / `Implements` trailers and test names | Removed 2026-10-02 | Derived by the host at the pin, as before. Code tracing was removed later (host `docs/design/code-tracing/deferred.md`). |
| A new revision of a linked record makes links suspect and opens one Reconcile item; closing relinks | Removed 2026-10-02 | The host's code-link tables are a cache of the Library entries; closing Reconcile also relinks the file. Code tracing was removed later (host `docs/design/code-tracing/deferred.md`). |
| Releases: first release ships what is built; later ones the trailer stories since the last; stack diff; new migrations; suggested version; version must be newer; nothing changed is refused | Preserved | `code-index.mjs` rules with the same messages; `.aludel/outputs/releases.json` plus a local tag; Aludel's own `.aludel/` commits are not changes |
| Publish a release to GitHub | Host | `releases-publish` stays a host route (a GitHub effect) |
| Docs: off the map, broken relative links, AGENTS.md length, sections needing a refresh | Revised (DEC-061: docs are Knowledge) | Generic doc checks (`doc-checks.mjs`) for every layer. **Not carried:** the AGENTS.md line count; follow-up |
| Starter docs never overwrite a developer's file; AGENTS.md gains a "Where to look" map | Moved here | `seed('install')` with a Code-owned adapter over Library entries; output matches the compiled starter set (parity test) |
| Ask the Engineer to refresh a doc section | Unavailable for now | Knowledge shows sections that need a refresh but has no 'refresh as Work' action yet; follow-up. Templates off keeps it |
| Route observations | Host, unchanged | Stay in their host table until LAYER-BINDINGS-01 step 4 (F10) |
| Deploy reads releases and the workspace | Not applicable | Deploy reads preview builds, never Code's releases; nothing to move |
| Coding runs: an immutable candidate, checks and an isolated preview (`platform.implement`) | Revised, owner question open | Layer-scoped Code Work runs through the generic layer path: a checkout of this repository, the manifest's writable set (never `.env*`, `.git/` or CI workflows), and elevated review that merges into `main`. The isolated candidate preview stays with the compiled action until the owner decides whether layer runs in Code should also get one |
| Templates off | Preserved | The compiled Code view and routes remain the fallback |
