#!/usr/bin/env bash
# Lists remote branches that carry work `main` doesn't have yet, newest first, with each branch's own status pointer.
# Cloud sessions push to their own branches, so `main`'s handoff can be behind; read the newest branch's handoff before
# starting a slice (JOURNEYS-01 J4 found J3 done on another session's unmerged branch while `main` said "J3 next").
#
#   tools/branch-handoffs.sh            # compare with origin/main
#   tools/branch-handoffs.sh origin/x   # compare with another base
set -euo pipefail
cd "$(dirname "$0")/.."
base="${1:-origin/main}"
git fetch --quiet origin 2>/dev/null || echo "(fetch failed; showing the last fetched state)" >&2
found=0
while read -r ref date; do
  [ "$ref" = "$base" ] || [ "$ref" = "origin/HEAD" ] && continue
  ahead=$(git rev-list --count "$base..$ref")
  [ "$ahead" -eq 0 ] && continue
  found=1
  next=$(git show "$ref:docs/status.md" 2>/dev/null | sed -n 's/^next_action: //p' | head -1)
  echo "$date  $ref  +$ahead  next_action: ${next:-?}  last: $(git log -1 --format=%s "$ref")"
done < <(git for-each-ref --sort=-committerdate --format='%(refname:short) %(committerdate:short)' refs/remotes/origin)
[ "$found" -eq 1 ] || echo "No remote branch is ahead of $base."
