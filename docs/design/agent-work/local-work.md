# Working a goal item locally (AGENT-WORK-01 A8)

Claude Code on your machine works a goal item through the Aludel tools, on your own subscription. You watch, answer and review on the item's page in the portal.

1. **Pair once.** In Aludel, open Work › Team and create an editor token. Then, from the checkout you'll work in:
   `node <path to aludel-workshop>/apps/portal/tools/aludel.mjs pair http://127.0.0.1:4310`
   Paste the token. It's stored at `~/.config/aludel/editor.json`, outside every repository.
2. **Create the goal.** In Work, choose Create, then "Goal across layers". Write the title and what should be true when it's done.
3. **Claim it from the checkout.** Run `aludel.mjs list`, then `aludel.mjs claim W-n`. This assigns it to you and adds an `aludel` server to `.mcp.json` in the checkout, so Claude Code there gets the Aludel tools. The file stays out of commits.
4. **Define it.** Open Claude Code in the checkout (approve the `aludel` server when asked) and say: "Work on W-n using the Aludel tools." If the item has no actions, Claude defines them in phases. You can also add actions on the page.
5. **Start it.** Press Start work on the item page. Starting is always your act.
6. **Let it work.** Claude moves one unblocked action at a time to working. It stages record changes through each layer's API (`stage_change`), and commits code on a branch named for the item, then pushes the branch to the project's GitHub repository and reports it (`report_code`). It asks on the action when it needs you and hands each action to review with a summary. Answer, approve and steer on the page.
7. **Report and check.** `aludel.mjs submit W-n` pushes the branch to `origin` with your own git credentials and reports its committed code. It refuses uncommitted changes and refuses `main`. `aludel.mjs status W-n` shows where things stand.
8. **Review each action.** When an action is ready for review, its card lists the changes it staged. Approve it, or Flag it with what should change: the agent sees the flag on its next check and reworks the action. A phase with a review gate waits until you've approved its actions.
9. **Close it out.** When every action is done, press Move to review, then Close out and merge: your "looks good, merge it". Aludel fetches the branch from the project's GitHub repository, never from your machine, and merges exactly the reported commit into main (a fast-forward, or a merge commit if main moved). In the same step it applies all staged record changes. It refuses if a record changed since it was staged. If the branch moved on GitHub after it was reported, close-out refuses until it's reported again. If the branch conflicts with main, nothing merges and the item goes back to the agent to rebase onto `origin/main` and report again. A project connected to GitHub then gets main pushed there.
