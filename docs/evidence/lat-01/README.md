# LAT-01 isolated candidate evidence

Date: 2026-09-28. Starting source commit: `f04d184769e30645e200d4940b3199abea719df7` on `main`. Candidate branch: `feature/layer-app-model` at `/home/henry/vscode-projects/aludel-layer-model`.

## Isolation result

- `./launch-layer-candidate` starts on port 4311 with `MACHINE_DATA_DIR` fixed to this worktree's ignored `.data`, `MACHINE_BASE_DOMAIN=layers.localhost`, process previews, and Symphony dispatch disabled. Its server process receives a clean environment; the launcher neither reads `.env` nor calls `integrations/symphony/local-hosts`.
- Current `http://aludel.localhost:4310/` and candidate `http://aludel.layers.localhost:4311/` returned HTTP 200 at the same time. [Browser capture](browser.json), [current screenshot](current.png), [candidate screenshot](candidate.png). Headless Chromium also resolved the candidate hostname without a forced mapping.
- The idempotent `apps/portal/scripts/lat01-fixture.mjs` inserted `lat01-isolation-fixture` and `lat01-preview` only in candidate SQLite. Read-only queries against current `apps/portal/.data/machine.sqlite` returned zero for both IDs. No live database was copied or migrated.
- A candidate onboarding draft returned HTTP 200 and a host-only `aludel_draft` cookie for `aludel.layers.localhost`. In the same browser context, the current portal returned a null draft. The actual `machine_session` cookie is also host-only in `server/accounts.mjs`; an authenticated session was not created for this packet.
- `http://lat01-preview.layers.localhost:4311/` returned the candidate fixture (HTTP 200) through a private loopback process port (32915 in the observed run). The current portal returned HTTP 421 for that host. Candidate workspace, preview log and SQLite paths are all under its ignored `.data`; no preview port or workspace was copied from the current portal.
- During this check, Docker preview image tags were found to use project ID alone. Candidate code now includes the portal instance ID in image tags, matching the existing container naming rule. The focused image-name and skeleton tests passed 2/2. This is a code-level collision check; no Docker preview was built in LAT-01.
- Candidate `.data` contains its own `integration-vault.key` generated on first start. Neither the current `.env` nor existing secret store was copied. No candidate worker was started.

## Checks and limits

Candidate `npm ci` and `npm run build` passed; local Node 24.14.0 produced engine warnings because package metadata requests 24.15.0. `git diff --check` passed. Browser capture covered the unauthenticated entry page and draft isolation; LAT-03 owns authenticated navigation, accessibility and narrow viewport checks. The fixture preview proves local routing and port separation, while a generated app and Docker runtime remain later packet evidence.

## Post-hoc retrospective

1. **Avoidable friction:** the initial topology review found image tags were shared across portal instances even though container names were scoped. DNS tools also failed to resolve `*.localhost` while Chromium resolved it, so HTTP and browser checks were needed.
2. **Preparation:** keep a deterministic candidate-only fixture and check every shared runtime namespace (database, cookie, workspace, container, image and port) before domain migration.
3. **Downstream change:** the image tag fix and focused regression check are part of the candidate base for LAT-02 onward; no current-portal code or runtime was changed.
4. **Questions:** real authenticated journey and generated Docker preview parity remain for later UI and migration packets. They do not block the isolated local contract compiler in LAT-02.
5. **Applied and tested:** the launcher and fixture turned the planned isolation gate into an executable check. Concurrent HTTP/browser observations, read-only current database queries, a candidate preview request and focused image-tag tests support the local gate. Hosted isolation and owner usefulness remain untested.
