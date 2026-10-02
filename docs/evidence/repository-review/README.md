---
id: LAT08A-INTEGRATION-01
kind: implementation-evidence
status: agent-checked
updated: 2026-10-02
---

# Repository integration and guided Code review

## Authorization and scope

Owner chat, 2026-10-02: “alright, go ahead and implement”, following the [shared integration and guided review requirements](../../design/layer-app-transition/layer-owned-review.md#shared-integration-and-guided-review-requirements-2026-10-02). This run changes the shared host submission/review/acceptance path and the generated web app's preview adapter. It uses disposable local repositories, databases, Docker containers and browser sessions. No provider turn, remote repository write, public deployment, owner-data acceptance or spending occurred. Installed template pins are unchanged. Unrelated owner edits and candidate directories were preserved.

This is a completed implementation slice of LAT-08A, not closure of its native Design/Pages/Code rendering packet or owner usability acceptance. T03-CODE remains the one next-action pointer.

## Implemented behavior

- Any installed layer that declares layer-scoped Work can submit repository changes, including Code's repository-only output. Record writes still require the owning layer API.
- Submission retains its original branch/base/commit. Opening review prepares a separate retained integration against the accepted repository head without advancing that head. Textual conflicts stop preparation. Applicable package validation, existing/proposed-output validation, file indexing and authority-code package tests run on the combined source.
- Review shows the integration's diff, source identity and independently run checks. Acceptance compares the submitted branch, reviewed generation and accepted Git head/pin, then advances to exactly the reviewed commit. A head change requires refresh; no new merge happens during acceptance. Negative verdicts/flags can send an immutable submission back when integration is unavailable or stale; they cannot approve it. Existing expected-record and consumed-Library revision checks still apply.
- Runnable Code changes build/check their combined revision on demand. Documentation-only changes avoid an app build. A change to the review recipe also requires new app evidence. Build/check results are distinct from agent-reported tests. Exact Docker image identity and fixture source revision remain recorded.
- Ordinary refresh preserves unchanged evidence and review notes. Changed integration or an explicit **Rebuild checks** creates a new review generation; the prior verdicts/flags remain in run-step history and active verdicts clear.
- Scenario buttons next to criteria open first-party candidate tabs through one-use, 60-second links. A host-only internal call runs the pinned app adapter, sets the synthetic app session, and redirects to the declared local entity/page/state. Portal cookies and credentials are never forwarded. Independent steps request reset; explicitly ordered steps retain flow state. Missing adapters report an unavailable reason.
- Builds run serially, at most two review runtimes stay active, and ten minutes without requests stops a runtime. Restart uses its recorded image digest and check evidence. Build logs have an 8 MiB limit and a two-minute build limit; Docker runtime logs rotate at 2 × 1 MiB. App checks have bounded CPU/memory/process/time/output and no network.
- Closed or superseded artifacts become eligible for scoped retirement after seven days. Cleanup removes that candidate's image tags, snapshot, demo data and logs while retaining Git submissions/integration references, digest/check evidence and Work history. Open reviews and active previews are preserved; no global Docker prune is used.

## App contract

Code Work maintains `.aludel/review.json` in the app repository alongside schema migrations/demo fixtures. It is pinned to the integration commit, rather than supplied by a mutable browser request. For example:

```json
{
  "version": 1,
  "buildTarget": "build",
  "checks": [{ "name": "App tests", "command": ["npm", "test"] }],
  "scenarios": [{
    "id": "edit-post", "criterion": 0,
    "label": "Review editing a published post",
    "expected": "The demo author can edit the published post.",
    "fixture": "post-v2", "role": "author", "path": "/posts/demo/edit"
  }]
}
```

`buildTarget` is optional and selects a Dockerfile stage containing test tools. Checks use argv arrays. Scenario criteria are zero-based; `after` names an earlier scenario for a continuing flow. Paths must stay on the candidate origin.

The app implements `POST /api/__aludel/review`. It must require preview mode and the runtime-only `ALUDEL_REVIEW_TOKEN` bearer credential, locate the named scenario in its pinned recipe, run compatible fixture/migration setup, and create an actual app session for the synthetic identity. It returns success and optional **host-only** Set-Cookie headers. The host sends `{ "scenario": "edit-post", "reset": true }`; it owns the redirect destination and never proxies browser calls to the setup route. The generated starter implements `starter` fixtures and real account/session creation; project-specific entities, permission models, modals and fixture migrations require an app-defined adapter. Ordinary generated app execution returns 404 for setup.

## Verification

All final checks passed on 2026-10-02:

| Check | Observed result |
|---|---|
| `npm run test:server -- --test-concurrency=4` | 275 passed, 31 mode-specific skips, zero failures |
| `npm run test:server:templates -- --test-concurrency=2` | 299 passed, seven explained skips, zero failures |
| `npm run typecheck` and `npm run build` | Passed; existing optional-chain and bundle-size warnings remain |
| `node --test tests/review-previews.test.mjs` | Two passed with real Docker: ten unopened candidates, two-runtime cap, ordered and one-use steps, idle threshold, same-image restart, stale-head refusal and grace-period cleanup |
| `MACHINE_LAYER_TEMPLATES_ENABLED=1 node --test tests/symphony-worker.test.mjs` | Two passed with bounded startup evidence and teardown |
| `PLAYWRIGHT_MODULE=… MACHINE_LAYER_TEMPLATES_ENABLED=1 node tests/repository-review-browser.mjs` | Passed: generic Code submission, two branches from one base accepted serially, exact reviewed commits, a conflicting third branch sent back through visible controls without applying, real author/viewer sessions, cross-candidate session isolation, stale generation refusal, preserved notes/rebuild history, ordinary app setup 404, wide/390px controls and WCAG A/AA axe scan |
| `git diff --check` | Passed |

The seven templates-on skips cover replaced style presets, two pre-entry-ID fixtures, a fake all-zero legacy template pin, two pre-layer-package paths and a fixture that toggles template mode midway. Their replacement behavior is exercised by the corresponding layer-scope, Data adoption, Pages and Markdown tests.

The source tests also exercise non-Code Pages repository integration, textual conflict, current-output/schema rejection and a structurally valid clean merge with failing package tests. Documentation-only source changes prepare and accept without an app build capability. Original submission commits remain unchanged, and stale bases or review-generation IDs refuse acceptance.

The browser journey uses the actual generated server/session adapter, the generic Code Work path, a disposable project database and real Docker images. The lifecycle fixture retains ten candidates and opens two, rather than prebuilding all ten. Final browser/lifecycle checks cover the small follow-up routing, cleanup and layout corrections after the first full server run. No template pin changed, so no new template-pin UI check was applicable.

Screenshots: [wide review](guided-review-wide.png), [390px review](guided-review-narrow.png), [author step](author-step.png), [viewer step](viewer-step.png). These show synthetic fixtures, not an owner application or owner usability acceptance.

## Limits and remaining evidence

- Imported/custom apps need a compatible Dockerfile, health endpoint, recipe and setup adapter. Arbitrary non-web or multi-service app environments are PP-01D work; this implementation does not add those runners.
- Two runtimes and seven-day retention are trial defaults. The ten-candidate test proves lazy allocation/cap/cleanup behavior, not a representative byte or latency budget. Shared BuildKit cache, unique image layers and synthetic data can still consume disk; a global disk quota, per-app demo-data quota and storage attribution remain PP-01D/E work. Container build memory/CPU use is not separately capped by the host here.
- A refresh with changed source requires checking again. The former observations are retained in run history, but the existing UI has no dedicated comparison of review generations.
- Native layer-owned renderers, Previous/Proposed baseline apps and Code Local app outside Work review remain in LAT-08A. Owner review is still required to judge usability. No live GitHub roundtrip was performed.

## Retrospective

**Observed friction:** the first helper tests missed a project-storage mismatch in preview identity. A real generic Code journey also exposed that Work admission incorrectly depended on record API operations, excluding repository-only outputs. A subprocess-exit race could obscure a startup assertion under concurrent test load. A full templates run initially had 298 passes and one startup-timeout failure; its focused worker rerun passed with captured startup evidence. A malformed disposable app check correctly blocked guided entry; fixing the fixture restored the flow. These are observed defects, not capacity measurements.

**Process change applied and tested:** review evidence now has a separate integration identity, acceptance is tied to it, and the reusable browser journey traverses generic admission through synthetic-session scenario entry on the real project store. Scoped lifecycle tests include ten unopened candidates, runtime cap, idle threshold, unchanged-image restart and grace-period retirement. The reusable `tests/portal-support.mjs` checks actual health with a bounded wait, captures startup evidence and handles servers that already exited. A narrow screenshot exposed clipped preparation controls despite the document-overflow assertion passing; wrapping was corrected and button bounds are now checked. The [operating procedure](../../design/process/operating-procedure.md) carries these checks forward. These checks found defects that module-only tests did not.

**Downstream effects:** shared repository review belongs in the host contract for every opted-in layer. Demo state belongs to each app's versioned recipe/adapter, maintained with schema changes. PP-01D/E still owns general app environments and measured disk/resource budgets; no roadmap phase transition is claimed.

**Resolved questions:** when to combine/build (review opening), what is approved (the exact combined commit/build), how concurrent submissions apply (serial head-checked acceptance), and how steps enter the app (pinned scenario setup and actual synthetic session).

**Open questions:** representative storage cost, suitable retention/cap defaults, app-specific fixtures and permission models, and owner usefulness. They block scale/environment claims and broader LAT-08A acceptance, not this bounded host flow. The existing planning/handoff process remains adequate after linking this evidence and the implementation contract.

## Person-run and embedded-preview correction (2026-10-02)

The expanded reusable browser journey passes genuine person Work staging/start, exact branch submission, navigation from Done, role-specific steps inside the Preview iframe and checked acceptance. No symphony proposal or agent telemetry is fabricated. The [person review screenshot](../biome-review/person-repository-review.png) was inspected and shows the real Work shell, criterion panel and embedded page with the viewer session. The screenshot and [browser result](../biome-review/person-browser.log) use a disposable Browser Buddy project, not a submitted Biome owner run. The person repository domain test verifies foreign performer rejection, changed branch refusal, accepted-head races and review-generation history; the ordinary person lifecycle test now verifies restart preservation too.

Generated preview sessions use Secure/Partitioned cookies only in preview mode, retaining normal SameSite=Lax sessions. The editor-bridge test now uses the shared bounded health/startup helper; its isolated rerun passed 2/2 after a templates-suite startup timeout. Updated full regressions pass: templates off 276 with 31 skips, templates on 300 with seven skips, zero failures. Final typecheck/build pass. See the [Biome evidence](../biome-review/README.md) for logs and the actual live owner-action blocker.
