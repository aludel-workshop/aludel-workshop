---
id: guide-connect-an-agent
kind: user-guide
status: current
updated: 2026-09-23
---

# Connect an agent to your project

Aludel's agents draft stories, specs, designs and code for your project. They run on your own account with an AI provider, so you choose the provider, you see what it costs, and you can switch it off at any time. You connect the account once per project, in **Work › Agents › Accounts** (or during setup).

You'll need an **API key**: a password-like code from the provider that lets Aludel use your account. Anthropic and OpenAI don't let other apps create keys for you, so you create one yourself and paste it in. It takes about five minutes.

## Which provider?

- **Anthropic (Claude)** and **OpenAI** both work. Pick the one you already use, or the one whose models you prefer.
- You pay the provider directly for what the agents use. Aludel adds nothing to the bill.
- A ChatGPT Plus or Claude Pro/Max *subscription* can't be used. The providers only allow those plans inside their own apps, so connecting needs an API account, which is billed separately.

## Anthropic (Claude)

1. Sign in to the [Claude Console](https://platform.claude.com). If you're new, add a payment method or credits under **Settings › Billing**.
2. Open [Settings › API keys](https://platform.claude.com/settings/keys) and choose **Create key**.
3. Name it after your project, for example "Aludel · Tool Share", so you can find it later.
4. Choose an **expiration**. 30 days is a good start; Anthropic emails you before it runs out. Choose **Never** only if you plan to rotate keys yourself.
5. Set **Linked account** to yourself (a personal key). If a team shares the project, ask an organization admin for a service account and use that instead, so the key doesn't stop working if you leave.
6. Copy the key (it starts with `sk-ant-`) and paste it into Aludel. The Console shows it only once.

**Set a spend limit.** Under [Settings › Billing](https://platform.claude.com/settings/billing), set a monthly spend limit so a busy agent can't overspend. When it's reached, requests stop with an error until the next month or until you raise it.

Don't use an **Admin API key** (it starts with `sk-ant-admin`). It manages your whole organization, and Aludel refuses it.

## OpenAI

1. Sign in to the [OpenAI platform](https://platform.openai.com). If you're new, add credits under **Settings › Billing**.
2. Optionally create a **project** for this app. It keeps its spending and keys separate from your other work.
3. Open [API keys](https://platform.openai.com/api-keys) and choose **Create new secret key**, in that project.
4. Name it after your project, for example "Aludel · Tool Share". Leave permissions on **All**: agents need to call models.
5. Copy the key (it starts with `sk-`) and paste it into Aludel. OpenAI shows it only once.

**Set a spend limit.** In the project's settings, open **Limits** (or [organization limits](https://platform.openai.com/settings/organization/limits)), set a monthly spend limit and turn on **Enforce a hard limit**. When it's reached, requests fail with an error.

Don't use an **Admin key** (it starts with `sk-admin`). Aludel refuses it.

## What Aludel does with your key

- **It checks the key before saving it** by asking the provider for its list of models. That proves the key works and costs nothing.
- **It stores the key encrypted.** It is never shown again, not even to you. Aludel shows only its last four characters, so you can tell which key is connected.
- **It uses the key only when you press Go.** Work your working style hands to agents waits under **Work › Queue › Available for agents**. Nothing runs until you put items in an agent batch (by hand, or "Fill with the next 10") and press **Go**. Each item makes one request to the provider; the batch shows the tokens it used. Drafts come back to you for review, and anything that costs more, uses an outside account or deploys comes to you first.
- **If a spend limit is reached** or the key stops working, the batch stops, and the items it hadn't reached go back to the pool.
- **It never puts the key** in your project's code, repository, logs or screenshots.

## Changing or removing a key

- **Check again** asks the provider whether the key still works. Use it after changing billing or limits, or if agent work fails. A key that was deleted, disabled or expired shows as rejected.
- **Replace** pastes a new key in place of the old one, for example when the old one is about to expire.
- **Disconnect** removes the key from Aludel. The key still exists at the provider: delete or disable it there too if you no longer need it ([Anthropic](https://platform.claude.com/settings/keys), [OpenAI](https://platform.openai.com/api-keys)).
- If you think a key has leaked, delete it at the provider first, then paste a new one.

## If something goes wrong

| Message | What to do |
|---|---|
| "That doesn't look like an API key" | Copy the whole key, from the first `sk-` to the end, with no spaces |
| "… rejected this key" | The key is mistyped, deleted, disabled or expired. Create a new one |
| "Aludel couldn't reach …" | The provider didn't answer. Wait a minute and try again |
| "… answered with an error" | Often billing: check that your account has credits and that you haven't reached a spend limit |
