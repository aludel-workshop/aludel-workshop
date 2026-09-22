---
id: onboarding-work-record
kind: work-record
status: active
updated: 2026-09-22
depends_on: [product-001, architecture-001, project-workspace-v1-delivery-plan]
supersedes_plan: PW-05
---

# New-project onboarding: from "Get started" to a clickable skeleton

## Owner intent (source, 2026-09-22)

The owner's notes, condensed without changing meaning:

1. "Get started" on a logged-out marketing page goes straight into creating an app. No account or admin setup comes first.
2. Choose how to work: **Dreamer** (describe the idea, agents handle implementation), **Planner** (shape vision, roadmap and details; don't write code), **Tinkerer** (hands-on, no AI required; Aludel is the home base for plan, code, commits and design, with tooling such as previews and optional delegation later). Profiles are sets of interaction preferences (who does a task, whether the system autofills or asks, granularity). They are not permanent: individual preferences can change and the profile can switch at any time.
3. Lightweight app definition: an elevator pitch (one sentence to a short paragraph of purpose, not requirements) plus the app name.
4. Then sign in or create an account, as a natural continuation of the flow.
5. Account creation includes connecting the GitHub identity used for repositories. After authentication, create the app's repository (README/AGENTS is enough).
6. Optional screens follow: connect an agent API first (useful during onboarding), then design direction and feature set. A **more details** toggle (off for Dreamer) switches between quick selections and connecting/configuring/uploading detailed documentation. Dreamer gets ~6 starter templates that define feel, not features (e.g. sleek SaaS, mobile-first social), plus dark/light, accent colour and free-form media uploads with usage notes.
7. By the end, the user has a skeleton app to click around. Stack, authentication, UI kit and similar configuration default to recommended options, with more options for direct toggles (e.g. a Django backend) drawn from preset stacks that are known to work.

Owner answers to the first game plan (2026-09-22):

- Keep it local for now, but build it to port easily to hosted.
- Project apps run as subdomains of the main Aludel domain (Railway-style). Locally, use subdomains of localhost; Aludel itself moves to its own subdomain.
- Aludel is built inside itself exactly as any other app is. Connecting an agent works the same for Aludel's own project as for every other project.
- The first stack preset is the stack already running (the portal's stack).
- Authorization: "go ahead, document plan, and start building."

## Authorized scope and excluded effects

Authorized by the owner's chat instruction under DEC-029 and recorded as DEC-032–DEC-035: local design, repository edits, local accounts and data, local scaffold generation, local preview processes on `*.localhost`, and checks.

Not authorized: public deployment, DNS or TLS on a real domain, spending, registering or reconfiguring the GitHub App, live repository creation on the owner's behalf, calling agent-provider APIs with stored keys, or sending email. The GitHub steps are built and tested against mocks. Their live use stays an owner-triggered action, because it creates a real repository.

## What this changes in the existing model

| Existing record | Change | Why |
|---|---|---|
| DEC-002: one owner, collaborative accounts deferred | Superseded in part by DEC-032. Accounts are per user and projects have members. The deployment still runs locally and is operated by the owner. | Onboarding creates an account after a stranger's first idea. A single owner key cannot represent that. |
| PW-05: new-project draft and setup plan | Replaced by the ONB packets below | Same capability, now with an owner-described flow |
| GitHub identity stored per project (`github_users.project_id`) | Stored per user. Repository bindings remain per project. | A user connects once and creates repositories for several projects |
| Portal served at `127.0.0.1:4310` with hash routes | Portal at `aludel.localhost:4310`, apps at `<slug>.localhost:4310`, public pages on real paths. `127.0.0.1` keeps serving the portal for the registered GitHub callback. | DEC-033 subdomain topology |
| Codex local runner is the only agent path | Agent connections are project-level records, and Aludel's own project uses the same mechanism | DEC-034 |

Enduring semantics retained: Direction, Features and Outcomes stay the product records (the pitch becomes Direction and the chosen features become Feature records). Generated apps stay independent: their repository, runtime and data never embed portal internals.

## Contracts

### Interaction profiles (preference sets)

`apps/portal/config/interaction-profiles.json` defines preference keys, allowed values and per-profile defaults. A project stores `{profile, overrides}`. Effective preferences are the profile defaults plus overrides. Switching profile keeps explicit overrides unless the user resets them. Screens read effective preferences; they never branch on the profile name directly. This keeps "change individual preferences later" true by construction.

| Preference | Dreamer | Planner | Tinkerer |
|---|---|---|---|
| `implementation` — who writes code | agent | agent-with-review | self |
| `planning` — who turns intent into tasks | agent | collaborative | self |
| `autofill` — fill fields from context | fill-for-me | suggest | off |
| `setupDetail` — quick picks vs detailed | quick | detailed | detailed |
| `interruptions` — which questions reach you | blockers-only | consequential | all |
| `agentSetup` — prominence of agent connection | recommended | recommended | optional |

### Pre-account draft

A server-side draft (profile, name, pitch) is bound to an HttpOnly `aludel_draft` cookie. Creating an account or signing in claims it once. Claiming creates the project, membership, Direction record and workspace. Unclaimed drafts expire after 7 days. No project exists before an account does.

### Accounts and tenancy

`users`, per-user `sessions` and `project_members` replace the single-owner model. The legacy owner key signs in as the built-in `owner` user, who is the member of `the-machine`, so existing data and tests keep working. Endpoints scoped to Aludel's own records require membership of `the-machine`. New project endpoints check membership of the addressed project. This is the tenancy boundary a hosted port needs. SQLite remains the local adapter (PostgreSQL later, per ADR-012).

### Host topology

| Host | Serves |
|---|---|
| `aludel.<base>` (and legacy `127.0.0.1` / `localhost`) | Portal: marketing page, onboarding, workspace, API |
| `<slug>.<base>` | That project's preview, reverse-proxied to its local process |
| Reserved slugs | `aludel`, `www`, `api`, `admin`, `app`, `the-machine`, `localhost` |

`MACHINE_BASE_DOMAIN` defaults to `localhost`. Browsers resolve `*.localhost` to loopback (RFC 6761), so no hosts-file edits are needed. Portal cookies are host-only and therefore never sent to app subdomains. For hosted operation this becomes `aludel.<domain>` plus `*.<domain>` with wildcard TLS; no code path assumes `localhost`.

### Agent connections

`project_connections(project_id, kind='agent', provider, secret sealed by the local vault, status)`. Providers: `anthropic` and `openai` (API key), and `codex-local` (existing local sign-in, no stored secret). The API never returns a secret; it returns a hint (last four characters). The same component and endpoint serve Aludel's own project and new projects. Keys are stored, not checked against the provider, because checking is an external call outside this scope. Status reads "saved, not yet used".

### Look & feel, media and features

- Six starter feels define design tokens, not features: `sleek-saas`, `mobile-social`, `editorial`, `playful`, `data-console`, `marketplace`. Each sets font, corner radius, density, surface tone, navigation pattern and a default accent. The theme (light/dark/system) and accent are separate choices.
- Media uploads (PNG/JPEG/WebP ≤ 8 MB; Markdown or text ≤ 1 MB) carry a usage note and are stored as project assets. Detailed mode accepts reference documents.
- Quick-pick features become Feature records (`planned`). Detailed mode adds custom features with descriptions.

### Stack presets and skeleton

`apps/portal/config/stack-presets.json` defines trusted presets. The only available preset is `aludel-web-v1`: Angular 22, Angular Material 22 (MD3), Vite, a Node 24 `node:http` server and SQLite. It is the stack the portal runs on and has been checked there. Other stacks appear as unavailable with a reason, never as selectable fakes. Options: built-in email/password authentication (on by default) and sample content.

The skeleton is **generated deterministically from the preset, not by an agent**, so it works identically for Tinkerers with no AI and has no dependency on an agent connection. It contains the name, pitch, feel tokens, theme, accent, uploaded media, a page per chosen feature, optional authentication, `README.md`, `AGENTS.md`, `aludel.json` (the manifest of choices) and `docs/product.md`. It is committed to the project's repository and served as a local preview at `<slug>.localhost`.

Local builds reuse the portal's installed dependencies by placing workspaces under `.data/workspaces/`, whose parent `node_modules` link resolves packages by normal Node lookup. Nothing links inside the generated repository. This avoids repeating the baseline defect of a tracked `node_modules` symlink. The generated `.gitignore` also ignores `node_modules` without a trailing slash.

## Work sequence

| Packet | Depends on | Output | Agent check | Stop condition |
|---|---|---|---|---|
| ONB-00 | — | This record, DEC-032–035, plan/status updates | Decisions and supersessions linked | — |
| ONB-01 Accounts and tenancy | ONB-00 | Users, per-user sessions, membership, legacy owner migration, Aludel-only endpoint guard, host routing | Existing suites still pass; cross-tenant access rejected; owner migration keeps sessions/data | Legacy owner cannot reach existing data |
| ONB-02 Pre-account flow | ONB-01 | Marketing page, profile choice, preference model, pitch and name draft | Draft survives reload; claim is single-use; preferences resolve from profile plus overrides | — |
| ONB-03 Account, GitHub, repository | ONB-02 | Sign-up/sign-in continuation, per-user GitHub identity migration, project repository from generated initial files | Mocked OAuth/installation/personal and organization create/push; migration preserves the owner's live binding; unconfigured-operator path continues locally | Live create/push stays owner-triggered |
| ONB-04 Optional setup | ONB-03 | Agent connection (shared with Aludel), look & feel, media, features, stack | Secrets never returned; details toggle follows preferences; upload limits | — |
| ONB-05 Skeleton and preview | ONB-04 | Scaffold generator, local commit/push, preview process manager, subdomain proxy | Generated app builds with the preset toolchain; preview reachable by Host header; isolation of cookies | Build failure is shown with its log, never hidden |
| ONB-06 Project workspace scoping | ONB-05 | New projects open in the same Overview/Product/Work workspace; the remaining hard-coded `the-machine` references removed | Two-project isolation checks from the PW-01 plan | — |
| ONB-07 Hosted-port readiness | ONB-06 | PostgreSQL adapter, wildcard domain/TLS, email verification, preview isolation per architecture "Execution boundaries" | Separate authorization | Spending or external deployment |

ONB-01 through ONB-05 are the build scope for this authorization. ONB-06 and ONB-07 are planned only. B-03B (execution integration) stays in the ready queue; it becomes the path by which an agent later modifies a generated skeleton.

## Readiness decision

- Target stage: build (implementation), because the owner explicitly authorized it. The flow is a new area with consequential behavior (accounts and external identity), so contracts are fixed above before code.
- Verdict: ready for ONB-01–ONB-05 within the local boundary. Presentation (layout and copy of onboarding screens) is an explicitly experimental variable for owner review. The steps, their order and the data contracts follow the owner's notes.
- Must not begin: hosted deployment, live GitHub writes by the agent, agent API calls, execution-by-agent against generated repositories (B-03B).

## Evidence and retrospective

ONB-01–ONB-05 are built and agent-checked: [onboarding evidence and retrospective](../../evidence/onb-01-05-onboarding.md). Owner review is pending.
