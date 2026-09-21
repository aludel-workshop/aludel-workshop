# Aludel — MD3 foundation trial

Bounded local prototype for D-01F, not a deployed product. Selected target: `docs/design/portal-system/v2/overview.png`. Supporting destinations are experiments, not blanket page-design acceptance.

## Run

Requires Node 24.15 or a compatible Angular 22 runtime. This workspace has an isolated runtime at `/tmp/machine-md3-runtime/node_modules/node/bin` (system Node 18 is too old).

```sh
cd prototypes/d-01f
export PATH=/tmp/machine-md3-runtime/node_modules/node/bin:$PATH
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

Open http://localhost:4173. `npm run build` produces the application; `npm run typecheck` checks Angular templates. `npm run build-storybook` produces a static workshop; serve `storybook-static` with a local static server on port 6006. `npm run storybook` runs the editable workshop.

All data is synthetic. Decision answers and request drafts use this tab's session storage. Open a new tab/session or clear session storage to reset. No execution, backend, account, deployment or release operation exists.

## Inspect fixtures

- `/?scenario=zero`, `one`, `many`, `unknown` exercise Overview cardinality/freshness.
- `/?save=error#/borrowbox/decisions/BB-D01` and `save=conflict` retain drafts on simulated save failure.
- `/#/borrowbox/request` exercises preserved drafting and explicit discard.

The query fixtures are test configuration; they are not product controls.

## Verification

`tests/browser.mjs` covers connected app behavior, keyboard, axe checks, theme propagation and screenshots. `tests/workshop.mjs` discovers the static story index, renders 14 stories, checks axe and a deliberate false expectation, and exercises a small component substitution. `tests/production-smoke.mjs` checks the built app served on port 4174. `tests/capture.mjs` constructs a same-viewport side-by-side source comparison.

These scripts use the existing workspace's Playwright 1.48.2 installation at `/tmp/app-builder-d01b-browser` and its Chromium 1140. In another environment install Playwright and update the import path. This is an explicit bootstrap harness dependency, not an application dependency. In this environment prepend `LD_LIBRARY_PATH=/tmp/app-builder-d01b-browser/libs/usr/lib/x86_64-linux-gnu` when running the scripts. Browser launches and local servers require the environment's sandbox approval path.

## Boundaries and maintenance

`src/model.ts` owns fixture domain meaning, `src/components.ts` owns reusable product patterns, `src/styles.scss` owns semantic theme mapping and composition rules, `.stories.ts` files own isolated cases, `src/app.ts/html` own experimental flow assembly. Consumers use product pattern contracts directly; there is no universal wrapper around every Material widget.

Storybook Angular/Vite 10.6 is preview. Automatic API extraction timed out twice in this environment; `experimentalDocgenServer:false` and `compodoc:false` keep explicit stories working. This is a bounded fallback, not a long-term configuration recommendation: the upstream docs plan to retire the flag-off path. Catalog discovery uses `index.json` and the checked product catalog. Recheck docgen or compare the stable Angular/Webpack adapter before committing to production workshop infrastructure.

See `design-qa.md` and `docs/design/portal-system/v3/` for evidence and remaining acceptance boundaries.
