import fs from "node:fs";
import path from "node:path";

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

export function portalPath(root) {
  return path.join(root, "portal.json");
}

export function providerPath(root) {
  return path.join(root, "provider.json");
}

export function loadPortal(root) {
  return readJson(portalPath(root));
}

export function savePortal(root, portal) {
  writeJson(portalPath(root), portal);
}

export function loadProvider(root) {
  return readJson(providerPath(root));
}

export function saveProvider(root, provider) {
  writeJson(providerPath(root), provider);
}

export function emit(portal, jobId, type, payload = {}) {
  const prior = portal.events.filter((event) => event.jobId === jobId);
  portal.events.push({
    id: `event-${portal.events.length + 1}`,
    jobId,
    sequence: prior.length + 1,
    type,
    payload,
  });
}

export function initialize(root, scenario) {
  const taskId = "task-1";
  const jobId = "job-1";
  writeJson(portalPath(root), {
    schemaVersion: 1,
    tasks: [{ id: taskId, revision: 3, state: "authorized" }],
    authorizations: [{
      id: "authorization-1",
      taskId,
      taskRevision: 3,
      actor: "owner-1",
      scope: "build-test-preview",
      state: "active",
    }],
    connectorOperations: [],
    jobs: [{
      id: jobId,
      taskId,
      authorizationId: "authorization-1",
      state: "queued",
      cancellationRequested: false,
    }],
    attempts: [],
    leases: [],
    events: [{ id: "event-1", jobId, sequence: 1, type: "job_queued", payload: {} }],
  });
  writeJson(providerPath(root), {
    schemaVersion: 1,
    scenario,
    nextMapping: 1,
    nextEffect: 1,
    mappings: {},
    effects: {},
    calls: [],
    failEffect: scenario === "failure",
  });
}

export function requestCancellation(root) {
  const portal = loadPortal(root);
  const job = portal.jobs[0];
  job.cancellationRequested = true;
  if (!["cancelled", "completed", "failed"].includes(job.state)) {
    job.state = "cancelling";
  }
  emit(portal, job.id, "cancellation_requested");
  savePortal(root, portal);
}

export function createProviderConflict(root) {
  const provider = loadProvider(root);
  const mapping = Object.values(provider.mappings)[0];
  if (!mapping) throw new Error("Cannot create conflict before a mapping exists");
  mapping.version += 1;
  mapping.state = "externally_cancelled";
  provider.calls.push({ operation: "external_mutation", resourceId: mapping.id });
  saveProvider(root, provider);
}

export function makeEffectLookupUnavailable(root) {
  const provider = loadProvider(root);
  provider.effectLookupUnavailable = true;
  provider.calls.push({ operation: "effect_lookup_disabled" });
  saveProvider(root, provider);
}
