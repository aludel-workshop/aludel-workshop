---
id: enterprise-github-app-001
kind: work-record
status: complete
updated: 2026-09-21
---

# Enterprise vendor GitHub App integration

## Scope and authorization

Owner authorization, current chat on 2026-09-21: “lets set this up right for enterprise from the start: vendor github app, short lived install tokens. plan it out in easy to test phases, then go ahead and build.”

Authorized: replace the portal's per-owner GitHub App credential-entry flow with a vendor-owned GitHub App contract; add deployment-managed configuration, one-handoff installation/user authorization, installation discovery and selection, repository creation, per-operation short-lived installation tokens, initial push/recovery, UI states, local/mocked tests, and durable documentation. Excluded: registering the real vendor app, connecting a real GitHub account, creating/pushing a live repository, changing organization policy, spending, deployment, release, and automatic future commits outside an authorized work operation.

## Process finding and applied improvement

The prior implementation correctly separated explicit provider effects from local Git recovery, but made every owner configure an application and handle its client secret. That is bootstrap-grade integration setup, not an enterprise product connection. The reusable correction is to separate three identities:

- vendor application configuration is deployment-owned and never user-entered;
- owner authorization is a short-lived user connection used only where GitHub requires user authority;
- automation uses a fresh installation access token for each bounded Git/API operation and never persists that token.

Provider capability facts, accessed 2026-09-21:

- GitHub recommends GitHub Apps for fine-grained permissions, independent automation, scalable rate limits and built-in webhooks: [GitHub App migration benefits](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/migrating-oauth-apps-to-github-apps).
- Installation tokens expire after one hour and may be permission/repository scoped: [installation access token endpoint](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app).
- A GitHub App user token can list installations accessible to that user: [installation discovery](https://docs.github.com/en/rest/apps/installations#list-app-installations-accessible-to-the-user-access-token).
- Organization repository creation supports installation tokens with Administration write; personal repository creation supports GitHub App user tokens but not installation tokens: [repository creation endpoints](https://docs.github.com/en/rest/repos/repos).
- HTTP Git access requires Contents permission: [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).

## Dependency-ordered implementation phases

| Phase | Deliverable | Independent check | Stop/return condition |
|---|---|---|---|
| EGH-1 Vendor configuration | Load app ID, slug, client ID/secret and private-key file from the server environment; expose redacted readiness only | Missing/invalid fields fail closed; API/UI never return secrets | Do not offer install until configuration is complete |
| EGH-2 Install and authorize | Owner starts installation URL; OAuth callback validates expiring state + PKCE; user token is encrypted; accessible installations and permissions are persisted | Mock redirect/callback/list-installations; reject state mismatch and inadequate installation permissions | Do not offer repository creation without an eligible installation |
| EGH-3 Repository provisioning | Owner selects installation/account and confirms exact repo name; organization create uses installation token, personal create uses user token | Assert token/endpoint matrix and one remote create; require `repository_selection=all` for creating future repos | Persist remote identity before local effects; ambiguity stays recoverable |
| EGH-4 Short-lived Git operations | Sign app JWT, mint one-hour installation token for each initial/future push, pass via askpass only, never persist | Verify JWT signature/claims, token requested per operation, no token in DB/status/remote URL; push to disposable bare remote | Expired/revoked token fails the operation without replaying remote creation |
| EGH-5 Experience and closeout | Overview states for operator-unconfigured, install-needed, installation choice, create confirmation, recovery and ready; docs/capability/status updated | Typecheck, build, domain tests, 1440/390 browser checks, axe, no horizontal overflow | No live-provider claim without owner-run evidence |

## Readiness

Verdict at implementation start: ready for bounded implementation. Current provider documentation settled the token boundaries. Real vendor credentials and owner installation were intentionally absent during mocked/local verification. See **Live provider verification** below for the later owner-run trial.

## Evidence and retrospective

### Implemented and checked

| Phase | Implementation evidence | Observed check |
|---|---|---|
| EGH-1 | `server/github-vendor-config.mjs`, `server/github-app-auth.mjs`, Overview operator state | Valid/invalid deployment configuration is detected without returning the client secret/private key; a signed RS256 app JWT has the expected issuer and a ten-minute claim window. The empty superseded per-owner app-credential table was removed from the local adapter. |
| EGH-2 | `server/github-integration.mjs`, `server/storage.mjs`, connect/install routes | OAuth uses PKCE plus expiring hashed state; installation return has its own expiring state, re-lists installations through the user token, and rejects a mismatched return. User/refresh tokens are encrypted at rest. |
| EGH-3 | Installation selection and explicit repository confirmation in `src/app.html`; endpoint/token branching in the domain module | Mocked organization creation used an installation token; mocked personal creation used the required user token; both persisted the installation binding before local effects. Ineligible installations cannot reach creation. |
| EGH-4 | Per-operation minting, repository-scoped push permissions and existing askpass Git adapter | Forced post-create push failure minted a fresh token on retry and made exactly one remote create. Token text was absent from status/binding/user rows. A configured profile made and pushed a real baseline commit to a disposable bare repository. |
| EGH-5 | Operator-unconfigured, authorize, install/update, select/create, recovery and ready Overview states; README/config/architecture/capability records | Node 24 server/domain suite passed (4 files); strict Angular typecheck passed; production build passed with the existing >500 kB advisory; 1440×1100 and 390×844 Playwright checks passed with no axe WCAG A/AA findings or narrow overflow. Screenshots: `apps/portal/test-results/github-integration-wide.png`, `github-integration-narrow.png`. Product-system validation passes at project revision 6. |

No real provider effect occurred during the implementation packet itself. The later owner-triggered trial is recorded below.

## Documentation follow-up — 2026-09-21

Owner authorization in the current chat: “i need more detailed git app setup walkthrough in readme.” Scope was limited to local documentation edits and checks; it did not authorize GitHub App registration, account connection, repository creation, push, spending, deployment, or release.

The prior README compressed operator registration, credentials, owner installation, verification, and recovery into a few paragraphs. The portal README now provides a dependency-ordered walkthrough tied to the implemented callback/setup routes, exact permissions and runtime variables, and the root README links directly to it. The guide was checked against the implementation and current GitHub primary documentation. This improves the live-trial prerequisite but is documentation evidence only; successful setup in this environment remains unproven until the separately authorized provider trial.

Owner follow-up in the current chat: “i put the secrests in a .env, use that instead.” The bounded local change makes `launch-machine` load the ignored repository-root `.env` through Node 24's native `--env-file-if-exists` support and updates the walkthrough. Shell-exported variables retain override priority. No secret values were read or printed, and no provider operation was performed. The existing ignored private-key file remains owner-managed; the guide continues to recommend storing that credential outside the repository.

## Live provider verification — 2026-09-21

Owner report and authorization in the current chat: “worked through the portal setup for my project ... check it all worked as intended.” Read-only verification found:

- the portal persisted a `ready`, private organization binding for `aludel-workshop/aludel-workshop`, with no last error and an installation ID present;
- the installation is active, targets the organization, selects all repositories, and reports Administration write, Contents write and implicit Metadata read;
- the local clean `main`, portal `commit_sha`, and an authenticated GitHub `refs/heads/main` query all equal `6c54d7a01cc7baf28ccec3857f4f785a00e2f701`;
- the portal's recorded 404 tracked files equal the 404 paths in the baseline commit, and `git fsck --full` reports no integrity errors;
- `.env` and the real PEM are ignored and untracked, and the configured client-secret value is absent from `HEAD`. The only private-key phrase found in tracked text is a test assertion proving status serialization omits private-key material.
- baseline hygiene has two deviations: commit attribution still uses the pre-rename `the-machine[bot]` identity, and `apps/portal/node_modules` was committed as a symlink to `../../prototypes/d-01e/node_modules` even though the target is not in `HEAD`. The ignore profile excludes dependency directories but did not catch this pre-existing symlink, so a fresh clone would receive a dangling link.

Verdict: the organization authorization → installation → private repository creation → baseline push path worked as intended, including credential exclusion and local/remote reconciliation. The baseline content needs a follow-up commit to remove the dangling dependency symlink and, if desired, update the legacy bot attribution for future commits. This is direct environment evidence, not an inference from documentation. It does not yet prove personal-account creation, expiry/refresh, revocation, organization-policy denial, live failure recovery, hosted secret storage or public deployment. The verification minted one fresh repository-scoped installation token and used it only for the authenticated read of GitHub `main`; no token value was printed or persisted.

### Post-hoc

1. **Avoidable friction:** the bootstrap implementation coupled customer onboarding to per-customer app credentials and used a user token for Git. Correcting that after UI/API work required replacing storage, domain, route, copy and tests together. The initial check also invoked system Node 18 before the repository's Node 24 runtime was selected; the test itself did not fail on product behavior.
2. **Make the next integration easier:** record credential actors and the provider endpoint/token matrix before building screens. Keep vendor configuration, customer authorization, installation identity and per-operation credentials as distinct contracts. Baseline construction must test ignored paths by Git tree mode as well as path pattern so ignored dependency symlinks cannot enter the first commit. The persist-remote-before-local rule remains sound.
3. **Downstream change:** C08/C20 and architecture now adopt the vendor-app/per-operation-token boundary. Future commit, branch and PR operations must call `installationTokenForRepository` (or its narrower successor) at execution time; they must not reuse the encrypted user token as a Git credential.
4. **Questions:** the live organization path resolves installation visibility and first create/push. Personal creation, expiring-user-token refresh, revocation, organization-policy denial and GitHub's live failure responses remain open. Hosted operation still needs a managed secret store and HTTPS callback origin. These block production-readiness claims, not the local implementation.
5. **Applied and tested process change:** the work was split into five independently checkable phases and the tests assert the endpoint/token boundary rather than only a happy-path result. A mismatched installation state and forced post-create failure exercised the two highest-risk recovery boundaries. The later live trial independently reconciled portal state, local Git state and the authenticated provider ref instead of relying only on the portal's success label.

Task outcome: implementation, local/mocked evidence and the first live organization create/push verification are complete. Product outcome: the workspace has a reconciled baseline Git history mirrored to its private GitHub repository, with one dangling dependency symlink and legacy bot attribution documented for follow-up; the remaining live variants above are not yet production-proven.
