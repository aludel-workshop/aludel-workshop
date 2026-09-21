# Aludel local portal

This is the first real B-01 application slice. It uses the accepted MD3/Angular visual system, a loopback-only Node service, and an embedded SQLite database. The database owns new mutable owner requests. Repository Markdown is imported as immutable source revisions with stable record IDs, parsed metadata, hashes, and link relationships.

## Run

From the repository root:

```sh
./launch-machine
```

Open <http://127.0.0.1:4310>. On first start, choose an owner access key in the local setup screen. Only a scrypt digest is stored. The session survives restart. If the key is lost, reset owner access locally and choose a new one in the setup screen:

```sh
cd apps/portal
npm run reset-owner
```

The server binds to `127.0.0.1` by default. `MACHINE_PORT` and `MACHINE_DATA_DIR` may override the port and data directory. Do not set `MACHINE_HOST` to a public interface; this bootstrap identity boundary is only approved for local use.

## GitHub App setup

The portal uses one deployment-owned GitHub App. The operator registers and configures the app once; each owner then authorizes and installs that app from the portal. Owners do not create their own app or paste GitHub credentials into the UI.

This walkthrough configures the default local portal at `http://127.0.0.1:4310`. Registering an app and later creating a repository are real GitHub-side changes. The repository has not performed either action automatically.

### 1. Register the GitHub App

1. In GitHub, open **Settings → Developer settings → GitHub Apps** for the account that should own the app. For an organization-owned app, open the organization's **Settings → Developer settings → GitHub Apps** instead.
2. Select **New GitHub App**.
3. Enter a unique app name and a description owners will recognize. GitHub derives the app slug from this name; after registration, copy the slug from the app URL, for example `aludel-local` from `github.com/apps/aludel-local`.
4. Set **Homepage URL** to the portal URL, `http://127.0.0.1:4310` for this local setup.
5. Under **Identifying and authorizing users**:
   - Set **Callback URL** to `http://127.0.0.1:4310/api/integrations/github/callback`.
   - Leave callback wildcard matching disabled. The portal supplies the exact callback URL.
   - Keep **Expire user authorization tokens** enabled.
   - Leave **Request user authorization (OAuth) during installation** disabled. Aludel deliberately authorizes the owner first and installs the app second; enabling this option also makes GitHub's separate Setup URL unavailable.
   - Leave **Device Flow** disabled.
6. Under **Post installation**, set **Setup URL** to `http://127.0.0.1:4310/api/integrations/github/installed`. Leave **Redirect on update** disabled for the current flow.
7. Under **Webhook**, clear **Active**. This local integration does not consume webhook events yet, so it needs neither a webhook URL nor a webhook secret.
8. Under **Repository permissions**, set only:
   - **Administration: Read and write** — required to create an organization repository.
   - **Contents: Read and write** — required to create and push the initial Git commit.
9. Under **Where can this GitHub App be installed?**, choose **Any account** for the intended vendor/customer model. A Marketplace listing is not required. For a strictly private, single-account local trial, **Only on this account** can be used, but it does not exercise the intended customer installation model.
10. Select **Create GitHub App**.

GitHub's registration labels can change. Cross-check the current [GitHub App registration documentation](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app) if the settings page differs.

### 2. Collect the app configuration

On the new app's settings page:

1. Copy the numeric **App ID**. Do not use the client ID in its place.
2. Copy the **Client ID** shown under the app identity.
3. Select **Generate a new client secret** and copy it immediately. Treat it as a secret.
4. Under **Private keys**, select **Generate a private key**. GitHub downloads a `.pem` file. Move it outside this repository to a location readable only by the account running Aludel.
5. Record the app slug from the app's public URL. It is usually the lowercase, hyphenated app name, but use the actual URL value rather than guessing.

The client secret and private key are deployment credentials. Do not commit them, paste them into the portal, or include them in logs or screenshots. The private key can act across every installation of the app; rotate it in GitHub and update the local path if it is exposed.

### 3. Configure and start the portal

Create `.env` in the repository root with the five app values and the portal's public base URL:

```dotenv
MACHINE_GITHUB_APP_ID=123456
MACHINE_GITHUB_APP_SLUG=aludel-local
MACHINE_GITHUB_CLIENT_ID=Iv1.0123456789abcdef
MACHINE_GITHUB_CLIENT_SECRET=replace-with-the-generated-client-secret
MACHINE_GITHUB_PRIVATE_KEY_PATH=/absolute/path/outside-this-repository/aludel-local.private-key.pem
MACHINE_PUBLIC_BASE_URL=http://127.0.0.1:4310
```

Then start Aludel from the repository root:

```sh
./launch-machine
```

`launch-machine` uses Node's native dotenv support to load the root `.env` directly into the server process. Variables already exported by the calling shell take precedence, which is useful for a one-run override. The file is ignored by Git; never force-add it, copy its values into documentation, or commit a real `.env` under another name. Keep the private key outside the repository even though `*.pem` is also ignored.

`MACHINE_PUBLIC_BASE_URL` must be the externally reachable origin whose exact callback and setup URLs were registered. It has no trailing slash. If `MACHINE_PORT` or the origin changes, update `MACHINE_PUBLIC_BASE_URL` and both URLs in GitHub before restarting. A browser on another machine cannot return to a portal that is only reachable on that browser's own `127.0.0.1`.

On startup, the portal validates the ID formats and parses the private key. It fails closed in the GitHub panel and reports only the missing or invalid variable names; it never returns their values to the browser.

### 4. Authorize, install, and create the repository

1. Open <http://127.0.0.1:4310>, sign in, and go to **Overview**.
2. In the GitHub setup panel, select **Authorize GitHub**. Choose the GitHub identity that can install the app, approve authorization, and wait to return to Aludel.
3. Select **Install GitHub App**. Choose the target personal account or organization.
4. Grant **All repositories**. This is required because the repository does not exist yet; a selected-repositories installation cannot grant access to a future repository.
5. After GitHub redirects back, choose the eligible installation in Aludel. If an organization requires approval for third-party apps, an organization owner must approve the installation before it becomes eligible.
6. Enter the new repository name and settings. Read the final summary, then type the exact repository name to confirm creation.
7. Submit once. Aludel creates an empty GitHub repository, records its identity, creates the local baseline commit, and pushes `main` using a newly minted, repository-scoped installation token.

Do not create the target repository manually first; this flow expects to create it and will not adopt a same-named existing repository. The initial commit follows `config/project-setup.json` and excludes local data, credentials, generated output, editor state, and agent state.

### 5. Verify the result

A successful setup shows the repository as ready in Overview. In GitHub, verify that:

- the new repository exists under the selected account;
- its default branch is `main`;
- the baseline commit is present; and
- local-only files such as `.data/`, `.env*`, `*.pem`, `.agents/`, and `.codex/` are absent.

The owner authorization and refresh tokens are encrypted in `.data/machine.sqlite` using `.data/integration-vault.key`. Installation tokens are minted for one bounded operation, passed to Git through an in-memory askpass environment, and are not stored in the database, Git remote URL, or repository files.

### Troubleshooting and recovery

- **“GitHub integration needs operator configuration”**: confirm `.env` is in the repository root, expand the panel, and correct every listed environment variable. The private-key path must be absolute, readable by the portal process, and contain a valid PEM private key.
- **Callback or installation return is invalid/expired**: start the action again from Overview. Authorization and installation state values expire after ten minutes and cannot be reused. Also confirm that the browser returned to the same running portal and data directory.
- **GitHub reports a callback mismatch or returns to the wrong host**: make the registered Callback URL, Setup URL, and `MACHINE_PUBLIC_BASE_URL` agree exactly on scheme, host, and port. Keep callback wildcard matching disabled.
- **No eligible installation appears**: select **Refresh** in the portal. Confirm the installation is active, uses **All repositories**, and grants both Administration and Contents read/write. Organization policy approval may still be pending.
- **Repository creation is denied**: confirm the signed-in user may create repositories for the selected account. Personal repository creation uses the authorized user identity; organization creation uses the selected app installation.
- **The remote repository exists but the initial push failed**: do not retry repository creation and do not delete the remote. The binding remains `local-setup-needed`; fix the reported local/configuration problem and select **Finish Git setup**. Aludel reuses the recorded remote and will not create a duplicate.
- **A credential was exposed**: revoke and regenerate the client secret or private key in GitHub, update the process configuration, and restart. Re-authorize the owner if a user token or the local integration vault may have been exposed.

The owner flow uses authorization-code PKCE and one-time state values for both authorization and installation return. User/refresh tokens are encrypted in the local integration vault. The encrypted user token discovers installations and creates personal repositories because GitHub does not permit that endpoint to use an installation token. Organization creation and every Git push mint a fresh installation token. Git tokens are narrowed to Contents write plus the bound repository, passed through process-local askpass, and never persisted or placed in the remote URL. Repository creation requires typing the exact repository name in the final confirmation.

The configuration and recovery behavior are locally and mock tested. A real GitHub connection remains an owner-triggered external trial.

## Data boundary

- `.data/machine.sqlite`: projects, owner requests, source identities, immutable source revisions, relationships, import runs, access digest, and sessions.
- `.data/integration-vault.key`: local AES-256-GCM key for encrypted provider credentials. It is generated with owner-only file mode where the platform supports POSIX permissions. Back it up separately from the database or reconnect integrations after loss.
- `docs/**/*.md`: seed/audit sources. Re-importing unchanged files is idempotent; changes create new source revisions.
- `src/`: accepted project-specific UI implementation and reusable component stories.
- large artifact storage, final normalized decision/task models, external identity, and hosted topology remain later packets.

## Checks

```sh
npm run typecheck
npm run build
npm run build-storybook
npm run test:server
```

The browser smoke test uses the existing bootstrap Playwright runtime and is documented in the B-01 evidence record.
