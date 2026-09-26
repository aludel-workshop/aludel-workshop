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

Call `aludel_task_open` with the context digest from the issue description. It gives the task, output, and allowed effect. Use `aludel_knowledge_map`, `aludel_knowledge_search`, and `aludel_knowledge_read` when you need more project context. For coding, also call `aludel_task_context` before changing files. Read the returned Work item, action instructions, profile instructions, target records and checks. The workspace hook prepared the repository at the Go-authorized commit. If the task card output is a Vision claim proposal, submit `aludel_submit_proposal` with `summary`, `content` (`section`, `text`, `note`, `basis`) and exact `usedInputs`; do not edit the Brief or files. For acceptance, clarification or data contract tasks, submit the structured content named in the card through the same tool. For Design audit, Pages accessibility, Deploy review or Work review, submit `content` with checked `scope` and bounded `findings` (`title`, `evidence`, `recommendation`); these are read-only reports for lead review. If the action is Security audit, keep the repository untouched and call `aludel_submit_audit` with a summary, findings (`severity`, `title`, `affected`, `evidence`, `recommendation`), and checks. A report with no findings must explain the checked scope and remaining uncertainty. If a missing decision blocks the task, call `aludel_task_ask` and stop; the owner answer will be pinned in a new batch. For coding, keep changes within the action's allowed surface. Run the relevant coding checks, then call `aludel_commit_candidate` with the attempt ID in the issue, a short commit message, and check objects with `name`, `status` (`passed`, `failed`, or `skipped`), and optional `detail`. The trusted host stages only the action-permitted files, commits with the Aludel-Work trailer, validates the exact commit, and submits it for review. If the workspace already has a valid commit, `aludel_submit_candidate` can submit its exact hash. Report checks as agent claims; Aludel verifies them independently. The result still requires Aludel validation and owner review; do not release it.
