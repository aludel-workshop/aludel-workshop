---
tracker:
  kind: aludel
  provider:
    endpoint: http://127.0.0.1:4310/api/worker
  required_labels: [aludel-ready]
  active_states: [Ready]
  terminal_states: [Stopped, Submitted]
polling:
  interval_ms: 2000
workspace:
  root: $SYMPHONY_WORKSPACE_ROOT
hooks:
  after_create: |
    node "$ALUDEL_WORKSPACE_HOOK" prepare
  before_run: |
    node "$ALUDEL_WORKSPACE_HOOK" start-run
  after_run: |
    node "$ALUDEL_WORKSPACE_HOOK" finish-run
agent:
  max_concurrent_agents: 1
  max_turns: 1
codex:
  command: codex app-server
  approval_policy: never
  thread_sandbox: workspace-write
---

You are working on the Aludel item {{ issue.identifier }}: {{ issue.title }}.

{{ issue.description }}

Call `aludel_task_open` with the context digest from the issue description. It gives the exact task, output, allowed effect and criteria your result is reviewed against. Anchor every objective in that task's request and criteria; the action defines the output boundary, but it is not a substitute for the requested outcome. Call `aludel_task_plan` with a short ordered list of task-specific objectives (your own plan, not generic action phases or a copy of the criteria), then mark each objective with `aludel_task_progress` as it becomes active or done. Use `stuck` only when the objective blocks the run: it immediately ends the run as failed, so stop work after reporting it. Keep a recoverable obstacle `active` and explain it in the note. The reviewer watches this as the run's progress. Every submit tool takes `evidence`: for each criterion on the task card (by its position, starting at 0), name what shows it is met, as a `change` (the record or file you changed), a `test` (the name of a check you report) or a `try` (one line telling the reviewer what to do in the preview). Point only at things in your submission; Aludel shows anything else as not found. Use `aludel_knowledge_map`, `aludel_knowledge_search`, and `aludel_knowledge_read` when you need more project context. For coding, also call `aludel_task_context` before changing files. Read the returned Work item, action instructions, profile instructions, target records and checks. The workspace hook prepared the repository at the Go-authorized commit. If the task card output is a Vision claim proposal, submit `aludel_submit_proposal` with `summary`, `content` (`section`, `text`, `note`, `basis`) and exact `usedInputs`; do not edit the Brief or files. For acceptance, clarification or data contract tasks, submit the structured content named in the card through the same tool. For a Pages flow task, submit a `pages_flow_proposal` with `title`, bounded `steps` that cite the target story and existing page IDs, and `usedInputs` with exact story and page revisions. Work review creates the flow only after acceptance. For Design audit, Pages accessibility, Deploy review or Work review, submit `content` with checked `scope` and bounded `findings` (`title`, `evidence`, `recommendation`); these are read-only reports for lead review. If the action is Security audit, keep the repository untouched and call `aludel_submit_audit` with a summary, findings (`severity`, `title`, `affected`, `evidence`, `recommendation`), and checks. A report with no findings must explain the checked scope and remaining uncertainty. If a missing decision blocks the task, call `aludel_task_ask` and stop; the owner answer will be pinned in a new batch. For coding, keep changes within the action's allowed surface. Run the relevant coding checks, then call `aludel_commit_candidate` with the attempt ID in the issue, a short commit message, and check objects with `name`, `status` (`passed`, `failed`, or `skipped`), and optional `detail`. The trusted host stages only the action-permitted files, commits with the Aludel-Work trailer, validates the exact commit, and submits it for review. If the workspace already has a valid commit, `aludel_submit_candidate` can submit its exact hash. Report checks as agent claims; Aludel verifies them independently. The result still requires Aludel validation and owner review; do not release it.
