# Working a goal item locally (AGENT-WORK-01 A8)

Claude Code on your machine works a goal item through the Aludel tools, on your own subscription. You watch, answer and review on the item's page in the portal.

1. **Pair once.** In Aludel, open Work › Team and create an editor token. Then, from the checkout you'll work in:
   `node <path to aludel-workshop>/apps/portal/tools/aludel.mjs pair http://127.0.0.1:4310`
   Paste the token. It's stored at `~/.config/aludel/editor.json`, outside every repository.
2. **Create the goal.** In Work, choose Create, then "Goal across layers". Write the title and what should be true when it's done.
3. **Claim it from the checkout.** Run `aludel.mjs list`, then `aludel.mjs claim W-n`. This assigns it to you and adds an `aludel` server to `.mcp.json` in the checkout, so Claude Code there gets the Aludel tools. The file stays out of commits.
4. **Define it.** Open Claude Code in the checkout (approve the `aludel` server when asked) and say: "Work on W-n using the Aludel tools." If the item has no actions, Claude defines them in phases. You can also add actions on the page.
5. **Start it.** Press Start work on the item page. Starting is always your act.
6. **Let it work.** Claude moves one unblocked action at a time to working. It stages record changes through each layer's API (`stage_change`), and commits code on a branch named for the item, then reports it (`report_code`). It asks on the action when it needs you and hands each action to review with a summary. Answer, approve and steer on the page.
7. **Report and check.** `aludel.mjs submit W-n` reports the branch's committed code. `aludel.mjs status W-n` shows where things stand.
8. **Review and close.** Review each action, then close the item. Close-out applies the staged changes and merges the branch (A4).
