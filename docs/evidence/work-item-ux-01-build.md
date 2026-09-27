---
id: work-item-ux-01-build-evidence
kind: evidence
status: agent-checked
updated: 2026-09-27
---

# WORK-ITEM-UX-01 build: work item runs, review and sign-off

Owner authorization and the plan are in the [work record](../design/work-item/work-record.md) (WI-1 to WI-7). DEC-050 records the model. Everything below was checked by an agent; the owner has not yet reviewed the built pages.

## What was built

| Part | Built | Where |
|---|---|---|
| WI-1 Run records | A read model of started Symphony attempts, each with its task snapshot from the Go bundle, performer, times, turns, outputs as change rows, the candidate and its checks, and its review. Attempts that no worker picked up are excluded. | `apps/portal/server/work-runs.mjs`; `GET /api/projects/:p/work/:w/runs` |
| WI-2 Item page | The item page rebuilt. The header has the title, one item-level action, and a facts row (priority, status, role, created). Run tabs plus *Next run*, scrolled to the newest, with a run count. The status block puts the call to action first, then the actor with a hover card, then one progress bar with the current objective and an objectives toggle, and the agent log. Task, Criteria and Changes are ruled sections. The Next run card has the assignee menu and an editable request and criteria. The sidebar has Links, Planning and Linked knowledge. | `src/layers/work-item.ts`, `src/layers/work-run.ts`, styles `wi-*` |
| WI-3 Review and sign-off | Per-run verdicts (accept, reject with note, skip) and change flags. Signing to accept runs the existing Brief, proposal, candidate or audit acceptance. Rejecting or closing reopens the task with the flags and comment as `context.feedback` and `reviewComment`, which the next Go bundle carries. The task (request and criteria) is editable until Go. | `knowledge.updateWork` inputs `reopen` and `task`; `PUT …/runs/:a/review`; `POST …/runs/:a/sign` |
| WI-4 Review route | `/work/item/:id/review/:n`. Viewer tabs appear only for what the run produced: Changes (claim was/now, proposal fields, findings, code diff), Preview (isolated candidate) and Tests (candidate checks, marked as run by Aludel or reported by the agent). A criterion stepper with Back, Reject and Accept, and Skip (or Next when flagged) beneath; A, R, J, K and Escape keys; sign-off at the end. | `src/layers/work-review.ts` |
| WI-5 Agent plan and progress | Symphony tools `aludel_task_plan` and `aludel_task_progress` and worker endpoints. Only a working attempt may report, and progress must name a planned objective. The item's live run (the board card's bar) follows the agent's plan. Run start no longer seeds the action's configured phases. | adapter overlay; `POST /api/worker/attempts/:a/plan`, `…/progress`; `WORKFLOW.example.md` |
| WI-6 Evidence | An `evidence` argument on the four submit tools: criterion index plus change, test or try, and a reference. The shape is refused before submission if invalid. References are matched after submission, and an unmatched one is shown as "not in what it submitted". The review screen shows only the evidence named for each criterion, and falls back to everything the run produced for runs that named none. | `work-runs.mjs` `checkEvidence`/`recordEvidence`; review stepper |
| WI-8 Question amendments | Answering an agent's blocking question can amend the next-run criteria. The active run retains its Go-pinned criteria, closes after the answer, and the next bundle receives the amended list. The answer and amendment are retained in Activity. | `knowledge.updateWork` `criteriaAmendment`; answer form; focused immutable-snapshot test |
| WI-9 Person runs | A person-assigned item can move from staged to *I'm working*, then *Ready for review*. Its review packet contains a summary, actual linked revisions made during the run, and per-criterion performer evidence. It uses the same verdict, send-back and signature flow without fabricated agent telemetry. | `work_person_runs`, `work_person_run_reviews`; person-run API and UI; domain and browser proof |
| Hardening | Roles no longer exposes the obsolete *Run phases* editor; historical stored phases remain compatibility data. Candidate inspection now returns the actual immutable patch rather than only a diff stat. | `work-roles.ts`; `code-candidates.mjs` |

## Checks (2026-09-27)

- **Domain:** `tests/work-runs.test.mjs` passes 7/7. In addition to the original coverage, it proves:
  - an answer amends the next Go bundle while the interrupted run keeps its original criteria;
  - a person run starts with a pinned task, has no agent telemetry, submits performer evidence, and uses the shared signature boundary.

  Original coverage includes:
  - an unpicked authorization is not a run;
  - the per-run task snapshot, and the task locked during review and after Go;
  - an unknown flag refused, and close refused on a run in review;
  - a signed send-back carrying the flag and comment into run 2, with a second signature refused;
  - accept applying the Brief once, as a whole;
  - a failed run that can only be closed, and closing reopens it;
  - plan and progress validation, and live-run mirroring;
  - evidence validation and resolution, including an unmatched reference.
- **Full server suite:** 116/118 pass. Both failures are the same pre-existing failures from the original handoff: `tools/delete-project.mjs` is not committed executable, and the known security-audit Ready fixture fails, as already recorded in the [host evidence](work-agents-01-host-online.md).
- **Focused Symphony suites** (proposals, worker, pool, work-runs): 16/16 before WI-6, and included in the full run after it.
- **Typecheck and build:** `ngc` reports no errors, only NG8107 warnings in files outside this work. `vite build` passes. The icon-subset test passes after the subset was rebuilt for the new glyphs; the generated-app font was restored unchanged.
- **Browser** (`tests/work-item-browser.mjs`, a disposable seeded portal, Chromium 1440 px and 400 px): passes with no page errors. It covers:
  - W-1 opens on Run 2 (Run complete), and its objectives expand.
  - Flagging a change makes Reject show "1 flag", and the Accept sign-off warns that the flag will be dropped and names the unchecked criteria.
  - Review mode shows the claim card and named evidence. A moves on; R plus a note, then Next, keeps the flag; the sign-off step reads "Send back with 2 flags".
  - Run 1 keeps its single criterion, its flag and its signature.
  - Sending back run 2 from the status block opens Next run with the comment and flag carried in.
  - The failed W-2 offers only Close run, and its agent log opens; closing opens Next run.
  - The draft W-3 shows "No runs yet", and a criterion can be added and saved.
  - A person item is staged, started, submitted with a summary and evidence, reviewed by keyboard and accepted; no agent log or telemetry is shown.
  - A real code candidate builds and runs through its isolated Docker preview. Review exposes Preview, Tests and the actual patch, and acceptance fast-forwards exactly the reviewed commit.
  - The hover card and ruled accordion open from the keyboard. An axe WCAG A/AA scan reports no violations.
  - At 400 px nothing scrolls sideways.

  Screenshots are in `apps/portal/test-results/work-item/` (ignored output).
- **Symphony runtime:** the overlay compiled in the pinned Docker Elixir build, twice (after WI-5 and after WI-6). The only warning is the upstream `erlex` parser's shift/reduce notice. Both local hosts restarted on the new build with 1 slot each. Before rebuilding, no batch was queued or running; the two remaining authorized attempts are W-4's stopped B-1 and B-2, which cannot dispatch.

## Not verified, stated rather than assumed

- **No live model turn** used the new plan, progress or evidence tools. Whether agents call them usefully is a hypothesis until the next owner Go.
- **The running portal and hosts were restarted after the continuation.** `./launch-machine` rebuilt the portal, restarted the `test-app` and `browser-buddy` one-slot hosts, and started the server at `http://aludel.localhost:4310` with Symphony admission enabled. No batch or live model turn was started.
- **Still open from the plan:** a per-criterion verify method and origin set in the editor (evidence types carry the method for now), and Aludel-added scope checks beyond the existing candidate validation.

## Retrospective

1. **Harder than necessary:** review state lived on the item (`checks_json` verdicts, `context.run`, one proposal slot) and was overwritten by every run. So the first task was a read model that recovers per-run history from attempts and bundles. The bundle already held the exact task snapshot; checking that first avoided a schema migration. Two avoidable slips cost time: skipping the existing icon-subset test (seven glyphs rendered as letters until the screenshot showed them), and a random test port colliding with a local service.
2. **What would make the next equivalent task easier:** run `tests/icon-subset.test.mjs` whenever a template adds `<mat-icon>` names. Keep `tests/work-item-browser.mjs` as the seeded disposable harness for Work states; it seeds through the same domain modules and now includes an optional real Docker candidate, so new run states can be added without touching owner data.
3. **What changes downstream:**
   - WORK-AGENTS-01 step 3 (typed submissions, send-back, revision-bound acceptance) is now largely met for record and report outputs.
   - Person runs share review and evidence but intentionally do not report agent plan/progress telemetry.
   - The *Run phases* action field is now hidden; stored values remain only to render old runs.
4. **Questions:**
   - Resolved in the build: a rejection stays until the reviewer changes it.
   - Resolved by the owner: answering a question may amend the next run's criteria while preserving the active run snapshot.
   - Still open for the owner: whether an incomplete run may be accepted (currently no).
   - Newly important: whether agents reliably call the plan and evidence tools. That blocks trusting the review screen's evidence list for new runs.
5. **Process change applied and tested:** the brief-ledger and prototype-round method ran for three rounds (D, E/F, G). The continuation converted every previously stated browser gap into the same disposable acceptance harness. That check found a real contract defect—the "diff" was only a stat—and passed after the contract and focused test were corrected. The harness now covers agent, person and code runs, keyboard interaction, narrow layout and axe. It is still a hypothesis that the tool descriptions and workflow prompt are enough for live agents to report useful plans and evidence.

## Browser Buddy W-3 live-run correction (2026-09-27)

The first owner-started run exposed two distinct issues. Its bundle did include the title `hello world`, request and criterion, but the selected `platform.security` action constrained it to a security-audit report; the generic security objectives were therefore an action/task mismatch, not absent task context. Separately, an agent could mark prerequisite objectives stuck and still submit a structurally valid report, which the portal treated as successful.

The corrected contract makes `stuck` terminal, blocks later progress and submission, preserves diagnostic output, derives older submitted/stuck runs as failed, and forbids acceptance. Failed cards center diagnosis and show the pinned action alongside the request. The focused suite passes 9/9, typecheck/build pass, and the restarted production read model returns W-3 as `failed` with the original namespace error while retaining its report. No replacement live turn was started.

This follow-up also added and exercised a context-budget safeguard after an overly broad diagnostic pass consumed disproportionate model usage: use identifier-scoped queries, bounded reads/output, no redundant whole-file loads, focused checks first, and owner confirmation before any diagnostic expansion expected to exceed 10,000 tokens.

## Worker command-sandbox repair (2026-09-27)

The W-3 namespace failure was reproduced without a model: Docker's default seccomp profile denied the unprivileged user namespace required by Bubblewrap. Disposable trials showed that relaxing seccomp was sufficient, while adding `SYS_ADMIN` alone still failed. Local Symphony workers now use `seccomp=unconfined` plus `no-new-privileges`, remain non-privileged, receive no added capabilities, and retain read-only source/credential/auth mounts.

Host reconciliation now includes this boundary in its configuration hash and refuses to report a worker started unless a no-model Bubblewrap smoke test passes. Both workers were recreated, passed fresh heartbeats, and Browser Buddy read the exact W-3 commit `f0f3af365ea0d5886e386774da459115aee0485e` through the repaired sandbox with a clean tree. This proves repository inspection can start; it does not convert W-3 into a successful audit or replace a new owner-authorized run.

## Task archival (2026-09-27)

Work items can now be archived from the item header after confirmation. Archival records who/when, preserves the task, run, report, review and activity rows, and removes the item from ordinary Work snapshots and blocker calculations. Active, needs-input, pinned and genuinely reviewable work is refused; failed/stopped work and W-3's historical submitted-plus-stuck shape are allowed.

Focused work-run/archive tests pass 10/10; typecheck and production build pass; the restarted portal has the archive columns and returns 200. W-3 is currently closed and eligible for the owner to archive from its menu; no owner record was archived during verification.
