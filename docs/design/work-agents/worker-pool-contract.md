---
id: work-agents-01-worker-pool-contract
kind: design-contract
status: in-progress
updated: 2026-09-26
---

# Workers are capacity; profiles define agents

## Owner correction

The owner wants to create profiles, assign work, and authorize batches in Work. Pairing workers or copying worker tokens is never an owner step. A profile includes provider, model, reasoning effort, instructions, context, allowed tools and limits; it is versioned and pinned on a work attempt. A worker is a replaceable execution slot. Symphony selects and supervises eligible work; Aludel owns the task, profile, authorization, artifact and review records. The current project/profile token UI and host configuration do not meet this contract.

## Product surfaces

- **Work › Agents** edits profiles and their defaults. It shows whether a profile can run with the currently configured providers and workers. It does not expose credentials or pairing.
- **Work › Board and batches** show available/occupied slots and each active worker's current work item, phase and last update. A batch selects a profile and role, contains action-specific items, and asks for 1–N concurrent slots. Go pins the batch and either starts it when all requested slots are available or puts it in an authorized queue. Queue order and the exact requested capacity are visible. Stopping or completing a batch releases its slots. A worker may take a different profile's eligible item next without owner setup.
- **Deploy › Agent runtime** configures where the Symphony host runs, its slot/container capacity, supported providers and credentials, health, restart state and operational logs. Credentials are provisioned and rotated by the trusted runtime, never copied through Work. The first local implementation may have a single host with one slot; the data model and UI must distinguish that limit from profile count.

## Dispatch and safety contract

1. A profile revision supplies provider/model/effort and agent behavior. A role/action revision supplies the task's permissions and output contract. A worker slot has runtime capabilities and an online lease; it is not an agent identity.
2. Go authorizes an exact batch snapshot and requested slot count. If capacity or a compatible provider is missing, the batch stays queued with a precise reason. Queued work does not become runnable merely because a token exists.
3. An admission controller reserves all requested slots together, up to configured capacity, before Symphony can claim tasks from that batch. Two slots can work on distinct items from one batch. Atomic item claims and lease expiry prevent duplicate execution or stranded capacity after a worker crash.
4. Each claim receives the pinned profile and role/action manifest. The host applies provider/model/effort per attempt and refuses unsupported combinations before a model turn. Profile selection must not rely on a host-wide default. The current Codex App Server integration is one runtime adapter; other providers require a compatible adapter before their profiles become runnable.
5. The trusted host holds and rotates its credential. Task-level access is constrained by the claim, project and manifest digest, even when a pool serves multiple projects. No worker token appears in the browser, model prompt, repository or Work profile.
6. A worker heartbeat reports available capacity, active claims and coarse progress. Work reads this operational state; Deploy owns configuration and recovery. A heartbeat alone cannot authorize work.

## Small first implementation

Start with a managed local Symphony host and capacity one. Remove manual pairing from Work only when the host can provision its own credential, report readiness and run a profile-pinned task end to end. Then add requested batch slots and an authorized queue. Before allowing capacity above one, test two workers racing for one item, a 2+1 split of a three-slot pool, a three-slot batch queued behind those runs, worker loss/reclaim, and a switch between two profiles with different supported model settings. Multi-provider execution follows an actual host adapter; a profile can exist while its provider is unavailable.

The first local implementation now has a project pool credential, queue/admission, Work capacity view and Deploy ceiling/status. The host process is still externally started. A pinned Codex App Server patch applies model and effort per task; the pool heartbeat advertises that capability and queues profiles needing it until a capable host is online. Other provider profiles remain gated. Runtime throughput, multi-host claims and browser behavior remain to be tested. [Implementation evidence](../../evidence/work-agents-01-worker-pool.md).
