# Aludel — D-01E candidate workspace

Versioned derivative of the accepted D-01F foundation for D-01E, not a deployed product. The accepted Overview remains unchanged. The owner-selected visual target is `docs/design/portal-visual/v1/selected-direction.png`; this prototype adds the task-to-review slice and representative candidate states.

## Run

Requires Node 24.15 or a compatible Angular 22 runtime. This workspace has an isolated runtime at `/tmp/machine-md3-runtime/node_modules/node/bin` (system Node 18 is too old).

```sh
cd prototypes/d-01e
export PATH=/tmp/machine-md3-runtime/node_modules/node/bin:$PATH
npm ci
npm run dev -- --host 127.0.0.1 --port 4175 --strictPort
```

Open http://localhost:4175. Port 4175 avoids the still-running accepted D-01F preview on 4173. `npm run build` produces the application; `npm run typecheck` checks Angular templates. The inherited Storybook catalog remains available for foundation components; D-01E's integrated task/review behavior is checked in the app.

All data is synthetic. Decision answers and request drafts use this tab's session storage. Open a new tab/session or clear session storage to reset. No execution, backend, account, deployment or release operation exists.

## Inspect fixtures

**Owner entry:** http://localhost:4175/review.html. Follow the visible review tasks. Authorize BB-001 inside the candidate and simulate completion in the outer toolbar. Notes about Aludel survive inner resets and can be downloaded. This bootstrap host has no production acceptance authority. `tests/review-harness.mjs` verifies this entry path.

- `/?scenario=zero`, `one`, `many`, `unknown` exercise Overview cardinality/freshness.
- `/?save=error#/borrowbox/decisions/BB-D01` and `save=conflict` retain drafts on simulated save failure.
- `/#/borrowbox/request` exercises preserved drafting and explicit discard.
- `/?scenario=candidate#/borrowbox/work/BB-001` shows the candidate-bearing task.
- `/?scenario=candidate#/borrowbox/reviews/A1` shows the selected candidate workspace.
- Add `&review=stale` or `&review=unavailable` before the hash for exceptional review states.

The query fixtures are test configuration; they are not product controls.

## Verification

`tests/browser.mjs` covers the retained Overview, task-to-review transition, embedded preview behavior, draft persistence, acceptance/revision separation, exceptional review states, axe checks and responsive screenshots. `tests/capture.mjs` constructs a same-viewport source/implementation comparison. The inherited workshop and production-smoke scripts remain useful for foundation regression checks.

These scripts use the existing workspace's Playwright 1.48.2 installation at `/tmp/app-builder-d01b-browser` and its Chromium 1140. In another environment install Playwright and update the import path. This is an explicit bootstrap harness dependency, not an application dependency. In this environment prepend `LD_LIBRARY_PATH=/tmp/app-builder-d01b-browser/libs/usr/lib/x86_64-linux-gnu` when running the scripts. Browser launches and local servers require the environment's sandbox approval path.

## Boundaries and maintenance

`src/model.ts` owns fixture domain meaning, `src/components.ts` owns reusable product patterns, `src/styles.scss` owns semantic theme mapping and composition rules, `.stories.ts` files own isolated cases, `src/app.ts/html` own experimental flow assembly. Consumers use product pattern contracts directly; there is no universal wrapper around every Material widget.

Storybook Angular/Vite 10.6 is preview. Automatic API extraction timed out twice in this environment; `experimentalDocgenServer:false` and `compodoc:false` keep explicit stories working. This is a bounded fallback, not a long-term configuration recommendation: the upstream docs plan to retire the flag-off path. Catalog discovery uses `index.json` and the checked product catalog. Recheck docgen or compare the stable Angular/Webpack adapter before committing to production workshop infrastructure.

See `design-qa.md` and `docs/design/portal-visual/v1/` for evidence and remaining acceptance boundaries.
