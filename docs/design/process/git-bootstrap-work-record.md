---
id: git-bootstrap-001
kind: work-record
status: complete
updated: 2026-09-21
---

# Portal-managed GitHub repository setup

Superseded for provider onboarding and token architecture by [enterprise-github-app-001](enterprise-github-app-work-record.md). The reusable Git profile, explicit create confirmation and remote/local recovery findings remain inputs; per-owner app credential entry and user-token Git pushes do not.

## Scope and authorization

Owner authorization: current chat instruction on 2026-09-21 superseding the earlier terminal-bootstrap direction — “we're doing this all through the portal. in the overview, add a panel that prompts setting up git (maybe an integrations section), should handle account link with github in order to create the repo and allow future commits.”

Authorized scope: add an Overview integrations panel; configure and link a GitHub account from the local portal; explicitly create a GitHub repository; initialize the selected project workspace from the versioned portal Git profile; create and push its initial commit; retain a project repository binding for future commits; and verify the flow with local/mocked checks. External GitHub writes occur only after an authenticated owner uses the named confirmation control. Excluded: performing the live account link/repository creation during implementation, purchasing services, public deployment, release, automatic future commits, and changes to another project.

## Outcome and process improvement

Observable success:

- the Overview visibly prompts for Git setup and truthfully distinguishes unconfigured, account-linked, remote-created/local-pending, and ready states;
- provider credentials and tokens never reach browser storage, logs, repository files, or Git remote URLs;
- repository creation and initial push require an explicit repository-name confirmation and never run merely by opening the panel;
- generated dependencies, builds, local portal data, credentials, caches, and scratch output are excluded while source/evidence remains trackable;
- one versioned source-control profile drives this project and future project setup;
- recovery can finish local initialization after a remote-create/local-push partial failure without creating a second repository.

The existing architecture assigns source identity to Git but had no executable bootstrap contract. The applied process improvement is a configuration-driven portal operation with persisted provider/binding states and a recoverable boundary between remote creation and local initialization. Its local and mocked behavior will be tested now; a real owner-authorized GitHub connection and reuse in the future New project flow remain separate live trials.

## Readiness

Verdict: ready for implementation. The owner explicitly authorized the portal flow. Git 2.43.0 is available. GitHub application registration/credentials and the owner-triggered provider write are runtime prerequisites, not permission for this implementation session to contact GitHub. GitHub recommends a GitHub App over a classic OAuth app because it supports fine-grained permissions and short-lived user tokens; the flow must fail closed until the portal's GitHub App client configuration exists.

One next action: implement the Overview panel, encrypted local credential storage, GitHub authorization/repository operations, recoverable local Git bootstrap, and checks; then close this record and update operational records without replacing B-03B as the single planning pointer. Do not initialize or push this repository during implementation.

## Evidence and retrospective

### Implemented evidence

| Requirement | Evidence | Result |
|---|---|---|
| Overview setup prompt and staged states | `apps/portal/src/app.html`, `src/app.ts`, `src/styles.scss`; `tests/github-browser.mjs` | Passed at 1440×1100 and 390×844. Unconfigured state explains that viewing/configuring does not create a repository. No horizontal overflow; automated WCAG A/AA scan reports no violations. |
| Server-only credential handling | `server/secret-store.mjs`, `server/github-integration.mjs` | AES-256-GCM local vault; authorization-code PKCE and expiring state; encrypted client secret, user token and refresh token; returned status omits credentials. |
| Explicit external effect | `POST /api/integrations/github/repository` and Overview confirmation | Exact repository name is required. Page load, app configuration and account link do not create a repository. |
| Reusable Git setup | `config/project-setup.json`, `server/git-repository.mjs` | One `git-local-v1` profile supplies `main`, baseline commit message, ignore policy and line-ending policy for this and future configured projects. |
| Remote/local partial-failure recovery | `tests/github-integration.test.mjs` | Simulated local failure after remote creation persists `local-setup-needed`; retry reuses the exact binding; mocked GitHub create count remains one. |
| Real Git mechanics without provider write | `tests/github-integration.test.mjs` | A disposable project initializes, excludes `.data`, commits three intended files and pushes to a local bare remote. |
| Build integrity | Node 24 `npm run test:server`, `npm run typecheck`, `npm run build`; `python3 tools/check_product_system.py` | Four server/domain test files pass; typecheck and production build pass; capability maps pass. Existing >500 kB bundle advisory remains. |

Current provider evidence is intentionally bounded: no real GitHub account authorization, repository creation, token refresh or remote push was performed. Those happen only when the owner completes the new Overview flow.

### Current primary-source basis

Accessed 2026-09-21:

- [GitHub App permissions and HTTP Git access](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app) documents Contents permission and token-as-password HTTP Git access.
- [GitHub App user access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app) documents the authorization-code flow, PKCE, token/refresh behavior and fine-grained permission intersection.
- [Create a repository for the authenticated user](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user) documents GitHub App user-token support and Administration write permission.
- [OAuth app security practices](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app) supports encrypting server-side credentials and preferring PKCE for public/local clients.

### Retrospective and handoff

1. **Avoidable friction:** the initial instruction sounded like a direct repository bootstrap, but the intended product behavior was portal-owned. The first implementation draft exposed that source-control setup is not just a shell convention: it is an owner-visible external effect with connection, confirmation, partial-failure and recovery states.
2. **What makes the next equivalent task easier:** `project-setup.json` now carries the reusable Git profile, while provider and repository bindings have explicit persistence. A future project only needs its project/path entry and the same domain operation; it should not copy shell instructions.
3. **Downstream effect:** C08 now has a real setup implementation but still lacks a live source revision and reviewed diff. B-03B can consume the binding after the owner completes setup; the New project flow can reuse the profile later. No phase gate advances from local/mocked evidence.
4. **Questions:** the first live trial must confirm GitHub App installation scope, repository creation, token refresh and baseline push. Hosted use will need a platform-native secret store and callback origin rather than this loopback vault. Disconnect/revoke and existing-repository linking remain later bounded flows; they do not block first-time setup.
5. **Process change applied and tested:** external creation and local initialization are split by a persisted binding. A forced post-create local failure proved retry does not repeat remote creation. This validates the recovery contract locally; real GitHub reconciliation remains unproven.

Task outcome: implementation and local evidence complete. Product outcome remains pending the owner-triggered GitHub connection and create/push action in the Overview.
