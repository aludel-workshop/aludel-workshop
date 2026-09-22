---
id: onb-01-05-evidence
kind: evidence
status: agent-checked
updated: 2026-09-22
depends_on: [onboarding-work-record]
---

# ONB-01–ONB-05: new-project onboarding, local build

Authorization: owner chat instruction of 2026-09-22 ("go ahead, document plan, and start building"), recorded as DEC-032–DEC-035. The contracts and sequence are in the [onboarding work record](../design/onboarding/work-record.md). This record contains agent checks only. The owner has not yet reviewed the flow, copy or visual presentation.

## What exists now

| Packet | Result |
|---|---|
| ONB-01 accounts and tenancy | `users`, per-user sessions, `project_members`. The legacy owner key signs in as `owner`; earlier sessions migrate to it. Aludel's own endpoints need `the-machine` membership. Host routing: portal at `aludel.<base>` (plus legacy `127.0.0.1`/`localhost`), apps at `<slug>.<base>`, anything else answered with 421. |
| ONB-02 pre-account flow | Marketing page at `/`. Working style (Dreamer/Planner/Tinkerer) and idea (name and pitch) are saved as a server-side draft behind an HttpOnly cookie. Preference sets come from `config/interaction-profiles.json`. |
| ONB-03 account, GitHub, repository | Sign-up and sign-in claim the draft exactly once, creating the project, its Direction record and a local git repository (README, AGENTS.md, `aludel.json`, `docs/product.md`). GitHub identity and installations moved from per-project to per-user, with a one-time owner migration. A new project endpoint publishes the existing local history. When the operator has not configured the GitHub App, the flow continues locally. |
| ONB-04 optional setup | Agent connection: one component and endpoint for every project, including Aludel's Overview. Keys are sealed, only a hint is returned, and no provider is called. Look & feel: six feels, theme, accent, and media/document uploads with usage notes. Features: quick picks plus custom features, all as revisioned Feature records. Stack: only the checked preset is selectable; others show why they are unavailable. The "More details" toggle follows the working style. |
| ONB-05 skeleton and preview | The deterministic `aludel-web-v1` scaffold (Angular/Material/Vite/Node/SQLite, with its own email/password auth) is committed to the project repository, then built and run on a loopback port. `<slug>.<base>` is reverse-proxied to it, and it is framed in the portal under a CSP `frame-src` limited to app origins. Previews restart on demand. |
| Project page (`/projects/<id>`) | Switch working style or change single preferences, reset overrides, set-up checklist, preview controls, agent connection. |

## Owner feedback applied — sign in with GitHub (2026-09-22)

The owner reached the account step, chose "I have an account", and read the email and password form as a request for their GitHub password. Enterprise products never collect third-party passwords, so the owner asked for a redirect to GitHub. The change:

- When the GitHub App is configured, **Continue with GitHub** is the primary action on the account step and on `/login`. It uses the same vendor GitHub App: OAuth with PKCE and one-time state, callback on the registered URL, then a single-use two-minute login ticket that hands the session to the portal host. One trip signs the person in (creating the account if needed), connects their GitHub identity, and claims the draft.
- Email and password stays as a secondary path, labelled as an *Aludel* account that is "not your GitHub password".
- A GitHub identity belongs to at most one Aludel account (unique index; connecting an identity already linked elsewhere is refused). A GitHub email never attaches to an existing password account; the person is asked to sign in and connect instead, which prevents account takeover through a provider email.
- Callback errors return to `/login` with a readable message instead of raw JSON.
- Checked: server test for create/reuse/no-takeover/no-sharing/single-use tickets (27/27 pass); onboarding browser script passes. With a stand-in configuration, the button sends the browser to `github.com/login/oauth/authorize` with the app's client ID, S256 PKCE and the registered callback. Not yet exercised against real GitHub.
- Enterprise SSO (SAML/OIDC via an identity provider) is the later equivalent for organizations and belongs to ONB-07.

## Owner feedback applied — live proto-site, pages vs functionality (2026-09-22)

Owner direction: separate **functionality** from **primary routes**; from Look & feel onward, show a Gamma-style interactive preview that reflects every choice before anything is built; edit navigation in place; make the Build step's action build from the same structure; after building, the main action continues in the portal.

- **Pages (routes)** are a new record per project: label, icon, description, page type, order, 1–5 pages, unique names, icons and types from `config/starter-kit.json` and `config/page-types.json`. They are seeded from the chosen feel with blank descriptions (for example, marketplace → Home, Browse, Sell, Messages, Account) and never reseeded once saved.
- **Functionality** is the old features step, relabelled; it becomes Feature records.
- **Proto-site** (`src/proto-site.ts`): the logged-in app in the chosen feel, with desktop (side or top nav, defaulting from the feel) or phone (bottom tabs), and screens narrower than 760px always show the phone. On Look & feel it shows placeholder nav and a sample page. On Pages you select, describe and retype a page; the pencil renames it and changes its icon, moves it (keyboard alternative to drag) or deletes it (never the last); a ghost **Add page** creates one with its name selected; drag reorders. Changes autosave.
- **Same structure, preview and build**: `src/page-blocks.ts` renders the placeholder layouts in the preview and is copied verbatim into generated apps. Colour derivation is shared through `src/color.js`, and generated apps ship a 28-icon font subset for page icons (`templates/aludel-web-v1/icons.ttf`). The repo's `docs/product.md` gains a Pages section (name, type, description) and `aludel.json` a `pages` list.
- **Build** is the last step's action; the stage then swaps to the live app, and **Continue in Aludel** is the primary action. Until ONB-06 it opens the interim app page, because new projects cannot yet open in the Overview/Product/Work portal.
- Checked: 29/29 server tests (seeding, validation, ownership, scaffold built from pages with shared layouts, app icon font parity). The browser script drives select/describe/type change, add with the name selected, icon change, keyboard move, delete, pointer drag, side/top and phone toggles, and autosave, then asserts that the built app has the same pages, order, icons, description and page-type layout. axe passes on the new views and 390px checks now include Pages.
- Defects caught on the way: two global CSS class collisions (`.sidebar` and `.pub-split`) broke the layout until namespaced; tests read zoneless renders too early (now polled); the post-build action was scrolled out of view.
- Not yet: page records in the portal's Product area (they need a page/view record kind, part of ONB-06); Storybook stories for the proto-site.

## Checks run (Node 24.14.0, 2026-09-22)

| Check | Result |
|---|---|
| `npm run test:server` | 26/26 pass. New: `onboarding.test.mjs` (10: accounts, legacy sessions, single-use draft claim and cross-account 404, preference override semantics, feature retire/restore, sealed agent keys, upload type/size/ownership/filename safety, stack availability, host topology incl. hosted domain, deterministic scaffold); GitHub per-user identity and one-time migration; askpass executable bit; icon subset coverage |
| `npm run typecheck`, `npm run build`, `npm run build-storybook` | Pass |
| `tests/onboarding-browser.mjs` (Playwright 1.60, fresh data directory) | Pass. Covers every step from the marketing page to the running app: reloads mid-flow keep the draft; the generated app loads at `tool-share.localhost` with the uploaded hero image, feature pages and route reload; the generated app's own sign-up works; the portal cookie never reaches the app host; the preview iframe loads with CSP enforced; the working-style switch keeps overrides; a non-member gets 404 from Aludel's API and is redirected from its workspace; owner sign-in shows the shared agent card. axe WCAG A/AA passes on 11 portal views and the generated app; no horizontal overflow at 390px on 6 views plus the app |
| Existing browser scripts (updated for `/login` owner sign-in) | brand, github, product, workflow pass. `browser.mjs` fails waiting for "This decision changed to revision 2". **It fails identically on the untouched baseline commit** (`eca7e09`, checked in a temporary worktree), so this is a pre-existing defect, not caused by this work |
| Generated skeleton build | About 7 s with the portal's installed toolchain; the served bundle is 443 kB JS |
| `tools/check_product_system.py` | Pass |

Screenshots: `apps/portal/test-results/onboarding/` (ignored by git; regenerate with the browser script).

## Defects found and fixed along the way

- **GitHub pushes could not run in this checkout.** `server/git-askpass.mjs` was committed as mode 644, and Git refused with `cannot exec … Permission denied`. It is now 755 in the index, with a test.
- **`./launch-machine` could not be run** (the owner hit `Permission denied` on 2026-09-22); `tools/check_product_system.py` had the same 644 mode. Both are now 755, and the askpass test became a check that every tracked script with a shebang is committed executable.
- **19 icons in the existing workspace were missing from the font subset** (for example `warning`, `check_circle`, `open_in_new`), so they could only render as their literal names. `tools/subset-icons.py` now rebuilds the subset from actual usage (47 icons, 6.7 kB), and `tests/icon-subset.test.mjs` fails when a used name is absent.
- **Browser scripts depended on a vanished `/tmp` Playwright path.** They now import through `tests/browser-support.mjs` (`PLAYWRIGHT_MODULE` override) and share the owner sign-in steps.
- Onboarding issues caught by the browser test: a partial save (image upload) discarded the unsaved feel choice; the details toggle leaked between steps; mobile-first apps had no navigation on wide screens; the accent colour failed contrast as text (the primary role is now derived to reach at least 4.5:1); the narrow step bar was not keyboard-scrollable.

## Known gaps (not claimed)

- No live GitHub run: per-user connect, install and repository publishing are covered by mocks only. The first live run is an owner action.
- Hosted readiness (ONB-07): PostgreSQL, wildcard DNS/TLS, email verification, password reset, rate limiting, and preview access control. Previews are currently open to anyone who can reach loopback.
- Previews run preset code without sandboxing. Agent-modified code must wait for B-03B's isolated workspace boundary.
- New projects have a project page, not yet the full Overview/Product/Work workspace (ONB-06). Aludel's workspace still uses hash routes.
- No Storybook stories yet for `PublicComponent`/`AgentConnectionComponent`.
- Agent keys are stored and never exercised.

## Retrospective

1. **What made it harder?** Three latent environment defects: the non-executable askpass, the incomplete icon subset, and the hard-coded Playwright path. None was visible from documents or evidence claims; each surfaced only by running the real thing. Zoneless change detection plus plain `ngModel` fields caused one stale-render bug.
2. **What would make the next equivalent task easier?** A browser helper that is independent of path (added); a font subset derived from usage, with a test (added); an end-to-end script that drives a new user from the logged-out page to the generated app (added; it caught five UI defects before owner review).
3. **Effect on plan and architecture.** Accounts and membership now exist, so ONB-06 (project-scoped workspace) is the natural next product slice, and B-03B gains a concrete target: agent changes to a generated repository with an existing preview pipeline. The deterministic scaffold means onboarding needs neither B-03B nor an agent.
4. **Questions created or sharpened.** Should app previews be private to members (a signed preview cookie per app host) before any non-local use? Should the owner move from the owner key to an email account? Is the scaffold's look acceptable as a first impression? This last one is owner judgment.
5. **Process change applied and tested.** Establishing a baseline on the untouched commit before blaming a failure: this correctly attributed the `browser.mjs` failure. The icon-subset test and the askpass test are applied and passing. Whether the end-to-end script reduces owner rework is a hypothesis until the owner reviews the flow.

Next action: owner walkthrough of the flow (`./launch-machine`, open `http://aludel.localhost:4310`, choose **Get started**), then choose between ONB-06 and B-03B.
