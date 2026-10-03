# J4 migration rehearsal

Data written by the pre-J4 code, then migrated by the J4 code. Results and context: [J4 run log](../../../design/journeys/work-record.md#j4-claims-2026-10-03-claude-cloud-session).

```sh
git worktree add /tmp/base 6f89df0   # the pre-J4 commit; link layer-base and apps/portal/node_modules into it
node write-with-old-code.mjs /tmp/base /tmp/rehearsal-old > ids.json
cp -a /tmp/rehearsal-old /tmp/rehearsal-copy
node read-with-j4-code.mjs <this repository> /tmp/rehearsal-copy ids.json   # prints what migrated, then "rehearsal passed"
```

The data is synthetic (`.invalid` accounts). The read script asserts the migrated claim IDs, verdicts and evidence. It then sends the migrated agent run back, and restarts to check that the migration runs once. [`output.txt`](output.txt) is the 2026-10-03 run.
