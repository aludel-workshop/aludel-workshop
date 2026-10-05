# DEPLOY-HOST-01: Deploy provisions and operates a server on the owner's cloud account

- **ID / date / author:** DEPLOY-HOST-01, revision 1, 2026-10-05, Claude Code (owner chat).
- **Outcome:** someone with a DigitalOcean account connects it in Aludel, picks a size and a domain, and gets their app deployed to a droplet on their own account. Aludel shows the droplet's status, resources, the release it runs, its health, logs and cost. The same tooling, run from a command before any Aludel server exists, puts Aludel itself on a droplet. That is the bootstrap.
- **Replaces:** COLLAB-WORK-01's CW-5, a one-off server setup.

## Authorization and scope

Owner, in chat on 2026-10-05: "for server i have a digital ocean droplet. now my goal would be instead of a once off setup, we create the tooling that our deploy layer is going to have to configure and manage the droplet. obviously there will be a bit of bootstrap in order to get it up, but i want to make sure if someone has say a digital ocean account, how do we make it as easy as possible for them to get deployed to a droplet on it, and see deployment/server status in aludel?"

**Authorized:**
- this brief and DEC-066;
- local design, code and tests against a fake DigitalOcean API and local containers, under DEC-029, once the owner approves this plan.

**Not authorized yet:**
- using a DigitalOcean token;
- creating, changing or deleting anything on DigitalOcean;
- registering a DigitalOcean OAuth app;
- DNS changes;
- connecting to the owner's existing droplet;
- spending money.

DH-6 lists each of these as a separate owner go.

## Evidence

| Source | What it shows | Kind |
|---|---|---|
| `launch-lms-infra` `origin/main` @ `dc23191`, `README.md` "Initialize a fresh droplet" and `.github/workflows/deploy.yaml` | The manual path we automate: create an Ubuntu 24.04 droplet with the admin's SSH key; set up a cloud firewall (80/443 open to all, 22 from trusted sources only); point DNS with `@` and `*` A records; generate a DNS token for Caddy's wildcard certificates; clone the repository with a deploy key; log Docker in to GHCR; deploy over SSH with a pinned host fingerprint. Only Caddy publishes ports. | Read from the repository. It is a runbook, not something we ran. |
| [DigitalOcean OAuth API](https://docs.digitalocean.com/reference/api/oauth/), accessed 2026-10-05 | Authorization code flow. PKCE is required for public clients. The consent screen lets the user "select specific granular scopes". Access tokens last 30 days for confidential clients and 1 hour for public clients. Each refresh token works once. There is a `/revoke` endpoint. | Vendor documentation |
| [Custom scopes](https://docs.digitalocean.com/reference/api/scopes/), accessed 2026-10-05 | Personal access tokens can be limited to `droplet:*`, `ssh_key:*`, `domain:*`, `firewall:*`, `monitoring:*`, `tag:*`, `project:*`, `reserved_ip:*`, `block_storage:*`, `image:*`/`snapshot:*` and `registry:*`. The page doesn't say whether OAuth apps can request these scopes. | Vendor documentation. Applying them to OAuth is unproven. |
| [Droplet create](https://docs.digitalocean.com/reference/api/reference/droplets/), [user data](https://docs.digitalocean.com/products/droplets/how-to/provide-user-data/), accessed 2026-10-05 | `POST /v2/droplets` takes `ssh_keys`, `backups`, `monitoring` ("install the DigitalOcean agent for monitoring"), `tags`, `user_data` (cloud-config or a script), `vpc_uuid` and `with_droplet_agent` (web console). User data runs as root on first boot only and "cannot [be modified] after a Droplet is created". | Vendor documentation |
| [Metrics agent](https://docs.digitalocean.com/products/monitoring/how-to/install-agent/), accessed 2026-10-05 | Installed with `"monitoring": true` and described as "a free, opt-in service". | Vendor documentation |
| [Droplet billing](https://docs.digitalocean.com/products/droplets/details/pricing/), accessed 2026-10-05 | Billed per second, capped at 672 hours a month. Plan prices are on a separate page. Aludel reads them from the API's sizes list, so nothing is hard-coded. | Vendor documentation. The prices themselves weren't checked. |
| [PLATFORM-UX-01](../platform-layer/work-record.md) R12, R6, R16 | Deploy has Environments (Overview, History, Settings with the hosting target, including "your server" and "leaving Aludel"), Variables and Integrations. Releases publish an image to GitHub Packages, and Deploy promotes them. The Operator role has elevated promote and rollback. | Owner-accepted direction. Built as views over the preview only. |
| [PLATFORM-PIPELINE-01](../platform-pipeline/work-record.md) P8, §9 | One container per environment, with host limits. The scaffold's `Dockerfile` and compose file. Each subdomain matches a standalone deployment. | Built and agent-checked locally |

## Design

### 1. Provider-neutral hosts; DigitalOcean is the first adapter

The general operation is "Deploy gets a host for an environment and runs a release on it". DigitalOcean is the first fixture, not the feature. Two kinds of target share one contract:

| Target | Getting the host | Operating it |
|---|---|---|
| **Cloud account** (DigitalOcean first) | Aludel creates it: droplet, SSH key, firewall, DNS and tags | SSH + Docker (below), plus the provider's API for power state, metrics, cost and snapshots |
| **Any server you already have** | You paste one command on it. That creates a `deploy` user, adds Aludel's public key and installs Docker. Aludel pins the host fingerprint on first contact. | SSH + Docker only. No provider metrics, so resources come from the host itself (`docker stats`, `df`, `/proc`). |

The owner's existing droplet can come in either way. Through DigitalOcean it gets provider metrics; through the paste command it's adopted by SSH without using a DigitalOcean token.

### 2. Desired state is a Deploy output; live state is an imported replica

This follows DEC-059 and the layer-connections direction:
- **Desired state** is a Deploy-layer record for each environment, listing:
  - the target;
  - the provider, region and size;
  - the domain;
  - the firewall rules;
  - whether backups and monitoring are on;
  - which release it should run.
- **What the app needs** comes from the repository, not Deploy: the `Dockerfile`, `.env.example` (variable names) and PP-01D's environment declaration. Variable values are kept as secrets on the Aludel server.
- **Live state** is a replica imported by the provider adapter and the host probe:
  - the droplet's status, IP, size and region;
  - firewall, DNS and certificate expiry;
  - running containers and their release labels;
  - health;
  - resource use;
  - the month's cost.
- **Drift.** A difference between desired and live state, such as a droplet resized in DigitalOcean's control panel, shows in Deploy. The Operator then either adopts the live value, changes the server back, or opens work to assess it. Aludel never quietly overwrites it.

### 3. What runs on the host

The shape is Kamal-like, close to `launch-lms-infra` but generated:
- Ubuntu LTS, Docker with Compose, and Caddy as the only container with published ports. Caddy handles TLS and one subdomain per environment (P8). Wildcard certificates use the DNS challenge when the domain is on DigitalOcean DNS. Otherwise each subdomain gets its own certificate over HTTP.
- `/opt/aludel/<project>/<environment>/compose.yaml`, generated from the app's declaration. It uses PP-01A's container limits and a data volume.
- **Releases** are images published to GHCR (R6). The host pulls the exact digest with a read-only package token, never from source, so there are no builds on the host.
- **Deploy order:**
  1. pull the image;
  2. run migrations, if the app declares them;
  3. start the new container;
  4. check health;
  5. switch Caddy over;
  6. keep the previous container for rollback.
  If the health check fails, the old container stays live, and the history shows why.
- **Status reporting.** No agent of ours runs on the host. Aludel connects over SSH for status, logs and deploys. Metrics come from DigitalOcean's free metrics agent (`monitoring: true`), or from the host itself on other servers. We can add a small reporting agent later, if SSH from Aludel turns out to be a problem.

### 4. The easiest path for someone with a DigitalOcean account

Deploy › Environments › Production › **Set up hosting**:
1. **Connect DigitalOcean:**
   - **With an OAuth app:** if the instance has a DigitalOcean OAuth app registered, one click, like connecting GitHub.
   - **Without one:** a guided "create a token" link listing the exact custom scopes needed, then paste the token. Self-hosted instances and the bootstrap start this way.
   - **Storage:** either way, the token is stored encrypted on the Aludel server.
2. **Choose:** a region (nearest by default), a size, and a domain. Domains already on their DigitalOcean account are listed. A domain elsewhere gets the exact DNS records to add, and Aludel checks for them.
   - **Size:** Aludel recommends one from the app's declared limits and shows the monthly price from DigitalOcean's sizes list.
   - **Backups:** an option, with their price shown.
3. **Review and create.** One screen states what will be created on their account and what it costs per month. Creating it is an elevated Operator action, signed by the person who presses it. Aludel then:
   1. creates an SSH key pair, keeping the private key encrypted on the server;
   2. uploads the public key;
   3. creates the droplet with cloud-init (Docker, Caddy, a `deploy` user, unattended security updates, SSH limited to keys), monitoring on and the tags `aludel`, `aludel-project-<id>` and `aludel-env-<name>`;
   4. creates a cloud firewall: 80 and 443 open, 22 only from the Aludel server's address, or open with key-only access when Aludel runs from a dynamic home IP, which we flag;
   5. creates the DNS records;
   6. waits for cloud-init to report done;
   7. pins the host fingerprint.
4. **First deploy.** Promote the latest release, or Preview's release, to the new environment.

Each step shows progress and its provider evidence. A step that fails can be retried by the Operator, and Q-008 applies: no automatic retries, and no guessing whether a create succeeded. Tags let Aludel find anything it created.

### 5. Status in Aludel

Environment Overview, extending R12:
- the release running, by image digest, and when it was deployed;
- health, from the app's health check polled by Aludel, and the HTTP status;
- the droplet: status, size, region, IP and uptime;
- CPU, memory, disk and bandwidth over 24 hours, against the container limits;
- certificate expiry;
- this month's cost so far, and the projected cost;
- drift, if any.

History lists deploys, rollbacks and provider changes. Logs show container output over SSH: the last N lines, or a live tail. Unavailable states are shown as unavailable, never filled with stand-in numbers (PW-01A).

### 6. Leaving Aludel and losing it

- **The account stays theirs.** Everything is created on the user's own account and tagged. "Leaving Aludel" disconnects the token and deletes Aludel's SSH key from DigitalOcean. The server keeps running, and a `README` in `/opt/aludel` explains how to operate it by hand.
- **Aludel never holds the only way in.** The user can add their own SSH key at creation, as the launch-lms runbook does. DigitalOcean's web console stays available (`with_droplet_agent`).

### 7. The bootstrap: Aludel deploys itself with the same code

Aludel is its own first project, so its Production environment is a Deploy environment like any other. Before any Aludel server exists, the provider adapter and the host setup run headless from the CLI, with a scoped token:

`aludel host up --provider digitalocean --project aludel --env production`

That command:
1. creates the droplet, exactly as in §4;
2. deploys Aludel's own image;
3. restores the local instance's database from a `VACUUM INTO` backup;
4. prints the address.

The server instance then imports its own environment record and manages itself. Two guards apply, from the launch-lms lessons (the control plane keeps an admin path outside its own UI):
- A deploy of Aludel itself keeps the old container until the new one passes health. The switch-over runs on the host, so a broken release can't take Aludel down.
- `aludel host` commands from a laptop still work against the same token and SSH key, as the recovery path.

### 8. Secrets and agents

DigitalOcean tokens, host SSH keys, GHCR tokens and environment variable values stay on the Aludel server, encrypted the same way as GitHub tokens. Agent-written code and agent runs never receive them. The `launch-lms-infra` worker likewise gets "no Docker socket, production database … or deployment SSH key". Agents can propose Deploy changes as staged records. Applying them is the Operator's elevated action.

## Work sequence

| Packet | Depends on | Work and output | Agent check | Who reviews and authorizes | Stop if |
|---|---|---|---|---|---|
| DH-1 Host contract and SSH target | PP-01A | Provider-neutral `host` module: provision, probe, deploy, rollback, logs. The SSH + Docker + Caddy runner. The paste command that adopts an existing server. Generated compose and Caddy files. | A local container acting as "a server": adopt, deploy, health-gated switch-over, failed health keeps the old container, rollback, logs. | Owner review | Docker in Docker or SSH into a local container won't run in WSL |
| DH-2 DigitalOcean adapter | DH-1 | Token connect (pasted token now, OAuth later), sizes and prices, create: key, droplet, firewall, DNS, tags. Imports metrics and cost. Drift. | Fake DigitalOcean API (recorded request and response shapes, as the fake GitHub does). Create, partial failure, finding resources by tag, drift. | Owner review | — |
| DH-3 Deploy views | DH-1, DH-2, PP-01D | Set up hosting, environment Overview, History and Logs on real data. Unavailable states. | Browser journey on the fakes, with axe and a 390 px sweep | Owner in the browser | — |
| DH-4 Releases to hosts | DH-3, Code › Releases (R6) | Promote an image by digest to an environment. Migrations. | Fake registry digest test; promote, then roll back | Owner | Release images aren't published yet (then build a local registry stand-in) |
| DH-5 Bootstrap CLI | DH-1, DH-2 | `aludel host up/status/deploy/rollback`, using the same modules. Database handover. | Against the fakes plus a local container server: from bootstrap to a running Aludel on the stand-in host | Owner | — |
| DH-6 Live: Aludel on the owner's droplet | DH-5, **owner go** | Run the bootstrap with a scoped token: create a new droplet or adopt the existing one (Q-4), with DNS on the owner's domain. Then deploy one app through the portal. | Live evidence: health, TLS, sign-in, metrics shown, a rollback, a restored backup | **Owner go** for the token, spending and DNS | Any effect not named in the go |

DH-1 and COLLAB-WORK-01's CW-1 to CW-4 don't depend on each other. DH-6 is CW-5. CW-6, the live collaborator trial, needs DH-6.

## Readiness

- **Verdict:** needs owner judgment on Q-4 to Q-6. DH-1 is ready to build after COLLAB-WORK-01's CW-1, the current next action.
- **Deploy's layer form:** Deploy is still a compiled module, under DEC-059's deferral. These views extend it as it is. Converting Deploy to a template follows the T03 pattern later, so this packet doesn't decide it.
- **Must not start:** anything that touches DigitalOcean, DNS or the owner's droplet before DH-6's go.

## Questions

- **Q-4 The existing droplet:**
  - **Create a new droplet (recommended):** proves the path a new user takes. It costs about one more droplet while both exist, and we retire the old one afterwards.
  - **Adopt the existing droplet:** proves the "server you already have" path, at no new cost.
  - **Context needed either way:** what does it run now?
  - **Blocks:** DH-6.
- **Q-5 The domain:** which domain, and is its DNS on DigitalOcean? Blocks DH-6. It decides between wildcard and per-subdomain certificates.
- **Q-6 OAuth app:** register an Aludel OAuth app on DigitalOcean now (an external account action), or start with pasted scoped tokens and add OAuth when there's a second user? Recommended: start with tokens. Blocks nothing until a second DigitalOcean user arrives.

## Owner answers (2026-10-05)

Owner: "sure, we can create new. domain is life2launch.dev, dns on digital ocean. start work."

- **Q-4: create a new droplet.** The existing droplet is retired after DH-6, and that retirement is a separate owner go.
- **Q-5: `life2launch.dev`, with DNS on DigitalOcean.** Wildcard certificates through Caddy's DNS challenge. The token needs `domain:*`.
- **Q-6: not answered.** The recommended default applies: pasted scoped tokens first. It blocks nothing until a second DigitalOcean user arrives.
- **"start work"** starts COLLAB-WORK-01 CW-1, the current next action. DH-6 still needs its own go, for the token, the spending and DNS.

## Process note

**What happened.** The request changed from "set up a server" to "build what Deploy needs, and use it to set up the server".

**What we kept.** The existing rule to generalize over examples ("plan the general operation") already covered this. So the process change is applying it, not adding a new rule:
- DigitalOcean sits behind a provider-neutral contract;
- the owner's droplet is the first fixture;
- the bootstrap reuses the product code rather than a script.

**The test.** DH-6 should need no code path that DH-5's local run didn't exercise. Anything DH-6 has to patch live counts against this approach, and goes in the retrospective.
