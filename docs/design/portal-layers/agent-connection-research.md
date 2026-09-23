---
id: agent-connection-research
kind: research
status: decided (DEC-039)
updated: 2026-09-23
depends_on: [lay-04-evidence]
---

# Connecting an agent account in the app (for LAY-04D)

**Owner request (2026-09-23):** "for linking the agent, i want to do it in app. ideally, we could connect our chatgpt or claude account the same as you do in vscode, where we just send them over to authenticate."

## Findings (accessed 2026-09-23)

| Provider | Can Aludel send you over to sign in and then use the account? | Evidence |
|---|---|---|
| **ChatGPT (Codex)** | **Yes, through OpenAI's own Codex app-server.** It is the interface Codex uses to power rich clients like the VS Code extension. Its `account/login/start { type: "chatgpt" }` returns an `authUrl` for the browser, and `account/login/completed` reports the result. Codex stores the tokens; Aludel never sees them. An `apiKey` login also exists. A third variant, which passes tokens in, is marked "FOR OPENAI INTERNAL USE ONLY - DO NOT USE" and must not be used | Documented fact: [Codex App Server](https://learn.chatgpt.com/docs/app-server) ("the interface Codex uses to power rich clients (for example, the Codex VS Code extension)"); [Authentication](https://learn.chatgpt.com/docs/auth) ("The Codex SDK and app-server support the same authentication methods as the CLI"). Checked locally: `codex-cli 0.116.0`, `codex app-server generate-json-schema` (`LoginAccountParams`, `LoginAccountResponse.authUrl`, `AccountLoginCompletedNotification`) |
| **Claude (Pro/Max)** | **No.** Third-party products may not offer claude.ai login or route requests through subscription plans. This includes the Agent SDK, unless Anthropic has approved it in advance, and it is enforced on Anthropic's servers | Documented fact: [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) ("Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods…"). Reported: [WinBuzzer, 2026-02-19](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/) |
| **Claude (API key)** | Yes; already supported by the shared agent-connection component. Pay-per-use, so it needs the owner's OK to spend (DEC-004) | Same page |

## Inferences and limits

- **Local only for now.** ChatGPT sign-in returns to a callback on the machine running Codex. That works while Aludel and your browser are on the same machine. A hosted Aludel would need the device-code flow, which the app-server version checked here does not offer.
- **Hosted multi-user use is unclear.** OpenAI has not said explicitly whether a hosted product may run many users' ChatGPT plans through Codex ([community discussion](https://github.com/openai/codex/discussions/8338)). Local use of your own plan through OpenAI's own Codex is the documented purpose. Revisit this before hosting.
- **One account per project.** Running the app-server with its own `CODEX_HOME` under Aludel's data folder keeps each project's account separate (DEC-034) and leaves your personal `~/.codex` sign-in alone. That folder holds tokens, so it must never enter a repository, log or screenshot.
- **What would change this conclusion:** Anthropic approving Aludel, or offering an OAuth program for third-party apps; OpenAI restricting app-server sign-in for non-OpenAI clients.

## Owner direction (2026-09-23) and the hosted answer

Owner: "hosting is what i care about here. im not trying to design a localhost app. if api key is all we've got, lets make that simple. no way we can make it easier on the user so they dont have to create/manage the keys on the provider side themselves, like we send them over with a template request? … if manual api key is where its at, make sure we have good documentation provided alongside."

This rules out the local Codex sign-in above. For a hosted app:

| Route | Send the user over and get a key back? | Evidence (accessed 2026-09-23) |
|---|---|---|
| **Anthropic direct** | **No.** The Claude API authenticates with Console API keys, Workload Identity Federation (for workloads you run yourself) or App Attest (your own iOS/macOS app). None of them provisions a credential for another company's app on a user's behalf. Keys are made at [Settings → API keys](https://platform.claude.com/settings/keys) with a name, an expiration (3 hours to never) and a linked account or service account | [Claude API authentication](https://platform.claude.com/docs/en/manage-claude/authentication) |
| **OpenAI direct** | **No** documented way for an app to provision an API key. The user creates one in the dashboard and adds credits. ("Sign in with ChatGPT" for other apps is reported as identity only, with no model use on the user's plan) | [OpenAI quickstart](https://developers.openai.com/api/docs/quickstart); [Codex issue #10974](https://github.com/openai/codex/issues/10974) (reported, not official) |
| **OpenRouter** | **Yes, like the GitHub setup.** Aludel sends the user to `https://openrouter.ai/auth?callback_url=…&code_challenge=…&code_challenge_method=S256&key_label=…`. They sign in and approve, come back with a one-time code, and Aludel exchanges it at `POST https://openrouter.ai/api/v1/auth/keys` for a key that the user owns and can revoke. No app registration is needed. The key reaches Claude and GPT models | [OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth) |

**OpenRouter trade-offs:**
- Prompts and code pass through one more company.
- Pricing (reported by secondary sources, not verified on OpenRouter's own pages): model prices match the providers' list prices, plus a fee of about 5.5% when buying credits.
- The user still has to add credits at OpenRouter.

**What would change this:** Anthropic or OpenAI launching an OAuth or partner program for third-party apps.

## Recommended design (not built; needs owner confirmation)

In **Work › Agents › Accounts**:

1. **Connect with OpenRouter** (the easiest option): a redirect with PKCE. The key is stored encrypted in the existing secret store, as agent keys are today. It shows "connected as key …1234 · revoke at OpenRouter", with Disconnect.
2. **Anthropic API key** and **OpenAI API key**: a guided panel with numbered steps, a direct link to the provider's key page, what to name the key, the recommended expiration and spending limit, a paste field, and a live check that the key works before saving. The same steps go into a user guide in the repository.
3. Drop "Codex on this machine" from the hosted path. Keep it only as a local developer option, or remove it.

## Decision (2026-09-23)

Owner: "not a fan of the third party. lets go paste in a key for now." This is DEC-039: Anthropic and OpenAI keys only, with guided steps, a free check and a [user guide](../../guides/connect-an-agent.md). OpenRouter and "Codex on this machine" are not offered. Built as part of LAY-04D ([evidence](../../evidence/lay-04-work-automation.md)).
