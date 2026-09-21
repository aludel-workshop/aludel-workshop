import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  initialize,
  loadPortal,
  loadProvider,
  requestCancellation,
  createProviderConflict,
  makeEffectLookupUnavailable,
} from "./store.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const worker = path.join(here, "worker.mjs");
const outputFile = process.argv.find((arg) => arg.startsWith("--output="))?.split("=")[1];
const results = [];

function runWorker(root, now, failpoint) {
  const args = [worker, `--root=${root}`, `--now=${now}`];
  if (failpoint) args.push(`--failpoint=${failpoint}`);
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

function counts(provider) {
  return {
    mappings: Object.keys(provider.mappings).length,
    effects: Object.keys(provider.effects).length,
    createMappingCalls: provider.calls.filter((call) => call.operation === "create_mapping").length,
    createEffectCalls: provider.calls.filter((call) => call.operation === "create_effect").length,
  };
}

function execute(name, firstFailpoint, between, expected) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `r-05-${name}-`));
  initialize(root, name);
  const first = runWorker(root, 1000, firstFailpoint);
  if (firstFailpoint) assert.equal(first.status, 86, `${name}: worker must terminate at failpoint`);
  if (between) between(root);
  const second = firstFailpoint ? runWorker(root, 1020) : first;
  assert.equal(second.status, 0, `${name}: recovery worker must exit cleanly: ${second.stderr}`);
  const terminalReplay = runWorker(root, 1040);
  assert.equal(terminalReplay.status, 0, `${name}: terminal record must not dispatch again`);
  const portal = loadPortal(root);
  const provider = loadProvider(root);
  const eventSequences = portal.events.map((event) => event.sequence);
  assert.deepEqual(eventSequences, eventSequences.map((_, index) => index + 1), `${name}: events must be monotonic`);
  assert.equal(portal.leases.some((lease) => lease.state === "active"), false, `${name}: no terminal job may retain a lease`);
  assert.equal(portal.authorizations[0].taskRevision, portal.tasks[0].revision, `${name}: authorization must bind the attempted task revision`);
  assert.equal(new Set(portal.connectorOperations.map((item) => item.operationKey)).size, portal.connectorOperations.length, `${name}: operation keys must be unique`);
  const summary = {
    name,
    failpoint: firstFailpoint ?? null,
    terminalJobState: portal.jobs[0].state,
    terminalTaskState: portal.tasks[0].state,
    attempts: portal.attempts.map(({ number, state }) => ({ number, state })),
    leases: portal.leases.map(({ state }) => state),
    resources: counts(provider),
    eventTypes: portal.events.map((event) => event.type),
  };
  expected(summary, portal, provider);
  results.push(summary);
}

const completedExactlyOnce = (summary) => {
  assert.equal(summary.terminalJobState, "completed");
  assert.equal(summary.terminalTaskState, "awaiting_review");
  assert.equal(summary.resources.mappings, 1);
  assert.equal(summary.resources.effects, 1);
  assert.equal(summary.resources.createMappingCalls, 1);
  assert.equal(summary.resources.createEffectCalls, 1);
};

execute("success", null, null, completedExactlyOnce);
execute("crash-before-mapping", "before_mapping_call", null, completedExactlyOnce);
execute("crash-after-mapping", "after_mapping_call_before_persist", null, completedExactlyOnce);
execute("crash-before-effect", "before_effect_call", null, completedExactlyOnce);
execute("crash-after-effect", "after_effect_call_before_persist", null, (summary) => {
  completedExactlyOnce(summary);
  assert.equal(summary.resources.createEffectCalls, 1, "recovery must look up, not recreate, the effect");
  assert.ok(summary.eventTypes.includes("lease_expired"));
});
execute("ambiguous-effect", "after_effect_call_before_persist", makeEffectLookupUnavailable, (summary) => {
  assert.equal(summary.terminalJobState, "blocked");
  assert.equal(summary.resources.effects, 1);
  assert.equal(summary.resources.createEffectCalls, 1, "unknown outcome must not be replayed");
  assert.ok(summary.eventTypes.includes("reconciliation_required"));
});
execute("cancellation", "after_mapping_persist", requestCancellation, (summary) => {
  assert.equal(summary.terminalJobState, "cancelled");
  assert.equal(summary.resources.mappings, 1);
  assert.equal(summary.resources.effects, 0);
  assert.ok(summary.eventTypes.includes("cancellation_requested"));
  assert.ok(summary.eventTypes.includes("cancelled"));
});
execute("conflict", "after_mapping_persist", createProviderConflict, (summary) => {
  assert.equal(summary.terminalJobState, "blocked");
  assert.equal(summary.resources.effects, 0);
  assert.ok(summary.eventTypes.includes("connector_conflict"));
});
execute("failure", null, null, (summary) => {
  assert.equal(summary.terminalJobState, "failed");
  assert.equal(summary.resources.effects, 0);
  assert.equal(summary.resources.createEffectCalls, 1);
  assert.equal(summary.attempts.length, 1, "known failure must not dispatch another attempt");
  assert.ok(summary.eventTypes.includes("attempt_failed"));
});

const report = {
  schemaVersion: 1,
  command: "node spikes/r-05/verify.mjs",
  node: process.version,
  passed: results.length,
  failed: 0,
  results,
};
const rendered = `${JSON.stringify(report, null, 2)}\n`;
if (outputFile) fs.writeFileSync(outputFile, rendered);
process.stdout.write(rendered);
