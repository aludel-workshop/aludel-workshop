import { loadPortal, loadProvider, savePortal, saveProvider, emit } from "./store.mjs";

const options = Object.fromEntries(process.argv.slice(2).map((item) => {
  const [key, value = true] = item.replace(/^--/, "").split("=");
  return [key, value];
}));
const root = options.root;
const now = Number(options.now ?? Date.now());
const failpoint = options.failpoint;
const leaseDuration = 10;

if (!root) throw new Error("--root is required");

function crash(name) {
  if (failpoint === name) {
    process.stderr.write(`intentional crash at ${name}\n`);
    process.exit(86);
  }
}

function operation(portal, kind) {
  let record = portal.connectorOperations.find((candidate) => candidate.kind === kind);
  if (!record) {
    record = {
      id: `operation-${portal.connectorOperations.length + 1}`,
      jobId: "job-1",
      kind,
      operationKey: `job-1:${kind}`,
      state: "pending",
      providerResourceId: null,
      providerVersion: null,
    };
    portal.connectorOperations.push(record);
  }
  return record;
}

function providerLookup(kind, key) {
  const provider = loadProvider(root);
  provider.calls.push({ operation: `lookup_${kind}`, operationKey: key });
  if (kind === "effect" && provider.effectLookupUnavailable) {
    saveProvider(root, provider);
    return { unavailable: true };
  }
  const result = provider[kind === "mapping" ? "mappings" : "effects"][key] ?? null;
  saveProvider(root, provider);
  return result;
}

function providerCreate(kind, key) {
  const provider = loadProvider(root);
  provider.calls.push({ operation: `create_${kind}`, operationKey: key });
  if (kind === "effect" && provider.failEffect) {
    provider.calls.push({ operation: "effect_failed", operationKey: key });
    saveProvider(root, provider);
    return { failed: true, code: "provider_rejected" };
  }
  const collection = kind === "mapping" ? provider.mappings : provider.effects;
  if (!collection[key]) {
    const counter = kind === "mapping" ? "nextMapping" : "nextEffect";
    collection[key] = {
      id: `${kind}-${provider[counter]++}`,
      operationKey: key,
      version: 1,
      state: kind === "mapping" ? "queued" : "created",
    };
  }
  const result = collection[key];
  saveProvider(root, provider);
  return result;
}

let portal = loadPortal(root);
const job = portal.jobs[0];
const task = portal.tasks[0];

if (["completed", "cancelled", "failed", "blocked"].includes(job.state)) {
  process.stdout.write(`${job.state}\n`);
  process.exit(0);
}

const activeLease = portal.leases.find((lease) => lease.jobId === job.id && lease.state === "active");
if (activeLease) {
  if (activeLease.expiresAt > now) {
    process.stdout.write("leased\n");
    process.exit(0);
  }
  activeLease.state = "expired";
  const abandoned = portal.attempts.find((attempt) => attempt.id === activeLease.attemptId);
  if (abandoned && abandoned.state === "running") abandoned.state = "interrupted";
  emit(portal, job.id, "lease_expired", { leaseId: activeLease.id, attemptId: activeLease.attemptId });
}

const attempt = {
  id: `attempt-${portal.attempts.length + 1}`,
  jobId: job.id,
  number: portal.attempts.length + 1,
  inputRevision: task.revision,
  state: "running",
};
portal.attempts.push(attempt);
const lease = {
  id: `lease-${portal.leases.length + 1}`,
  jobId: job.id,
  attemptId: attempt.id,
  owner: `worker-${process.pid}`,
  state: "active",
  expiresAt: now + leaseDuration,
};
portal.leases.push(lease);
job.state = "running";
emit(portal, job.id, "attempt_started", { attemptId: attempt.id, inputRevision: attempt.inputRevision });
savePortal(root, portal);

const mappingOperation = operation(portal, "mapping");
savePortal(root, portal);
crash("before_mapping_call");

let mapping = providerLookup("mapping", mappingOperation.operationKey);
if (!mapping) {
  mapping = providerCreate("mapping", mappingOperation.operationKey);
  crash("after_mapping_call_before_persist");
}

if (mappingOperation.providerResourceId) {
  if (mappingOperation.providerResourceId !== mapping.id || mappingOperation.providerVersion !== mapping.version || mapping.state !== "queued") {
    mappingOperation.state = "conflict";
    job.state = "blocked";
    task.state = "blocked";
    attempt.state = "blocked";
    lease.state = "released";
    emit(portal, job.id, "connector_conflict", {
      expected: { id: mappingOperation.providerResourceId, version: mappingOperation.providerVersion, state: "queued" },
      observed: { id: mapping.id, version: mapping.version, state: mapping.state },
    });
    savePortal(root, portal);
    process.stdout.write("blocked\n");
    process.exit(0);
  }
} else {
  mappingOperation.providerResourceId = mapping.id;
  mappingOperation.providerVersion = mapping.version;
  mappingOperation.state = "applied";
  emit(portal, job.id, "mapping_reconciled", { providerResourceId: mapping.id });
  savePortal(root, portal);
}
crash("after_mapping_persist");

portal = loadPortal(root);
const currentJob = portal.jobs[0];
const currentTask = portal.tasks[0];
const currentAttempt = portal.attempts.find((candidate) => candidate.id === attempt.id);
const currentLease = portal.leases.find((candidate) => candidate.id === lease.id);
if (currentJob.cancellationRequested) {
  currentJob.state = "cancelled";
  currentTask.state = "cancelled";
  currentAttempt.state = "cancelled";
  currentLease.state = "released";
  emit(portal, currentJob.id, "cancelled", { attemptId: currentAttempt.id, effectCreated: false });
  savePortal(root, portal);
  process.stdout.write("cancelled\n");
  process.exit(0);
}

const effectOperation = operation(portal, "effect");
savePortal(root, portal);
crash("before_effect_call");

let effect = providerLookup("effect", effectOperation.operationKey);
if (effect?.unavailable) {
  effectOperation.state = "reconciliation_required";
  currentJob.state = "blocked";
  currentTask.state = "blocked";
  currentAttempt.state = "blocked";
  currentLease.state = "released";
  emit(portal, currentJob.id, "reconciliation_required", {
    operationKey: effectOperation.operationKey,
    reason: "provider_lookup_unavailable",
    automaticRetry: false,
  });
  savePortal(root, portal);
  process.stdout.write("blocked\n");
  process.exit(0);
}
if (!effect) {
  effect = providerCreate("effect", effectOperation.operationKey);
  if (effect.failed) {
    effectOperation.state = "failed";
    currentJob.state = "failed";
    currentTask.state = "failed";
    currentAttempt.state = "failed";
    currentLease.state = "released";
    emit(portal, currentJob.id, "attempt_failed", { code: effect.code, retryScheduled: false });
    savePortal(root, portal);
    process.stdout.write("failed\n");
    process.exit(0);
  }
  crash("after_effect_call_before_persist");
}

effectOperation.providerResourceId = effect.id;
effectOperation.providerVersion = effect.version;
effectOperation.state = "applied";
currentJob.state = "completed";
currentTask.state = "awaiting_review";
currentAttempt.state = "completed";
currentLease.state = "released";
emit(portal, currentJob.id, "effect_reconciled", { providerResourceId: effect.id });
emit(portal, currentJob.id, "job_completed", { attemptId: currentAttempt.id });
savePortal(root, portal);
process.stdout.write("completed\n");
