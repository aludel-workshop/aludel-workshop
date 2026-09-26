---
id: lay-05-manual-task-creation
kind: implementation-evidence
status: partial
updated: 2026-09-25
---

# Manual Work task creation bridge

## Scope and result

The owner identified a chicken-and-egg problem: the Work Board lacked a way to create a task for user-flow review, while agents for most actions are not yet runnable. This bounded pass adds **Create task** on the Board. A person chooses a role's existing action, title, task brief, optional target, assignee, priority, Queue or Backlog, expected outputs, and review checks. Creation opens the item; it does not stage or start an agent. The brief appears on the item and in the existing structured runner's task context as project data, without changing the action's tool scope. The HTTP create path rejects a nonexistent or mismatched explicit action. Targetless acceptance, Data contract, and coding tasks cannot enter an agent batch and spend a run without an applicable target.

The form explains when the selected agent action is not runnable. It permits planning and assignment across roles but does not claim autonomous execution for every layer. The generic task manifest, action-neutral result boundary, and Symphony migration remain in the [proposal](../design/lay-05/general-work-orchestration.md). The LAY-05 owner browser review and real-work dispatch gate remain open.

## Checks

- Angular typecheck and Vite build pass. Typecheck has two existing optional-chain warnings in Code; neither is from this change.
- Focused Work runner tests pass 9/9, including a manual brief reaching the model request, a custom review check, refusal of an unsupported agent action, and refusal of a targetless Data contract.
- `git diff --check` passes.
- A visible Board → Create task → item browser scenario was added to `tests/layers-browser.mjs`, but it was not run in this environment: a Playwright module was not available locally. Browser usability and exact field interaction remain unverified.

## Retrospective

1. The existing create API and record validation made the form small, but the saved suggestion was missing from the agent prompt. A task creator could reasonably expect it to guide the work and see no effect.
2. The reusable check is to trace every manual field from form to stored item, agent context, review, and run eligibility. This pass applied it to the brief and target; the test confirms the prompt path, while browser interaction is still unproved.
3. The gap does not change the dependency order for general orchestration. It makes the Work surface usable for defining fixtures before that engine exists. The Board must continue to distinguish assigned from runnable.
4. Open questions: how to specify multi-target tasks, which actions require a target, and what artifact types each action submits. These belong to the action contract work and block claiming all-layer agent execution.
5. The process change was applied in the code and focused tests. Its effectiveness for the owner is still a hypothesis until the browser flow and first user-story task are tried.
