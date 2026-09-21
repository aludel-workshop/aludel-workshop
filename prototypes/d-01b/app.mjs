import { initial, act, current, stale, request } from "./model.mjs";
const key = "machine-d01b-borrowbox-v3";
let s;
try {
  s = JSON.parse(localStorage.getItem(key)) || initial();
} catch {
  s = initial();
}
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const btn = (text, action, disabled = false) =>
  `<button data-action="${action}" ${disabled ? "disabled" : ""} class="${["authorize", "accept", "request", "decision", "start", "finish"].includes(action) ? "primary" : ""}">${text}</button>`;
const scenarios = [
  "Happy path",
  "Worker unavailable",
  "Connector unavailable",
  "Connector conflict",
  "Failure",
  "Blocked input",
];
let error = "";
function render() {
  const r = current(s),
    a = s.artifacts.find((a) => a.id === s.selected);
  const task = location.hash.startsWith("#task") && r;
  const reviewRoute = /\/(result|review)$/.test(location.hash);
  document.querySelector("#app").innerHTML =
    `<header class="product-header"><a class="brand" href="#overview">◈ THE MACHINE</a><nav class="global-nav" aria-label="Global navigation"><a href="#overview">Home</a><a class="active" href="#overview">Projects</a><a href="#overview">Inbox <span>${s.scope ? 0 : 1}</span></a><a href="#task/BB-001/result">Reviews ${s.artifacts.length ? `<span>${s.artifacts.length}</span>` : ""}</a></nav><button class="utility" disabled title="Outside this prototype slice">Settings</button></header><div class="project-bar"><div><small>PROJECT</small><strong>BorrowBox</strong></div><nav aria-label="Project navigation"><a class="active" href="#overview">Overview</a><a aria-disabled="true">Plan</a><a href="#task/BB-001">Work</a><a href="#overview">Decisions</a><a href="#task/BB-001/result">Releases</a></nav></div><main><div class="breadcrumbs">Projects / BorrowBox${task ? (reviewRoute ? " / Reviews / A" + (a?.id || "") : " / Work / BB-001") : ""}</div><div class="eyebrow">BB-M1 · Reserve a tool for pickup</div><h1>${reviewRoute && a ? `Review artifact A${a.id}` : task ? "Reserve available tools" : "Decisions for this milestone"}</h1><p class="lede">${reviewRoute && a ? "Compare this exact result with the intent and evidence used to build it." : task ? "Turn the owner’s request into a reviewable change without losing the intent or its decisions." : "BorrowBox helps neighbors reserve tools for pickup. One product decision controls the reservation behavior."}</p><p class="muted">${task ? "BB-001 · Task revision r" + r.id : `BB-M1 · ${s.scope ? "No blocking decisions" : "1 blocking decision"}`}</p><div role="alert" aria-live="polite" class="error">${esc(error)}</div>${task ? (reviewRoute && a ? reviewPage(r, a) : detail(r, a)) : overview()}<footer>Prototype v3 · Selected direction B · Simulated records</footer></main>`;
  const scenario = document.querySelector("#scenario");
  if (scenario) scenario.value = s.scenario;
  if (a && task) {
    const frame = document.querySelector("iframe");
    if (frame)
      frame.srcdoc = `<!doctype html><html lang="en"><body style="font:15px/1.6 system-ui;padding:20px;color:#213832"><small>SIMULATED BORROWBOX APP · A${a.id} / r${a.revision}</small><h1>BorrowBox</h1><p>Good tools, shared by your neighborhood.</p><h2>Cordless drill</h2><p>Pickup: October 15, 2026<br>Return: October 16, 2026</p><button style="padding:10px 14px">${a.policy === "Require volunteer approval" ? "Request this tool" : "Reserve this tool"}</button><p>${a.policy === "Require volunteer approval" ? "A volunteer will confirm your request." : "Available for these dates · instant confirmation"}</p><h3>Unavailable dates</h3><p>${a.revision > 1 ? "October 10–12 is already reserved. October 11–13 overlaps: choose another range." : "Some dates are unavailable."}</p><h3>Also in the library</h3><p>Folding ladder · available<br>Orbital sander · temporarily unavailable</p><small>Static app fixture: no reservation is saved.</small></body></html>`;
  }
}
function overview() {
  if (s.scope) return `<div class="empty-decisions"><p class="card-kicker">DECISIONS</p><h2>No blocking decisions</h2><p>Reservation policy is recorded as <b>${esc(s.scope)}</b>. BB-001 is ${s.state.toLowerCase()}; independent catalog work is unchanged.</p><div class="actions"><a class="button primary-link" href="#task/BB-001">Review ready task →</a>${btn("Change reservation policy", "showDecision")}</div></div>${independentWork()}`;
  return `<div class="decision-workbench" id="decision-workbench"><div class="decision-list" aria-label="Milestone decisions"><button class="decision-list-item selected" aria-current="true"><b>Reservation policy</b><small>Blocking · 2 affected checks</small></button><button class="decision-list-item" disabled><b>Tool category wording</b><small>Optional · no blocked work</small></button></div><section class="decision-detail"><a class="back-to-list" href="#decision-workbench">← Back to decisions</a><p class="card-kicker">SELECTED DECISION · BB-D01</p><h2>Should reservations be confirmed immediately?</h2><p>Reservation behavior depends on whether a volunteer must approve it.</p><div class="impact"><b>Affected work</b><span>BB-001 · Reservation implementation</span><span>Reservation acceptance checks</span></div><fieldset><legend>Choose a policy</legend><label><input type="radio" name="policy" value="Confirm immediately" checked> <b>Confirm immediately</b><small>Reserve an available tool immediately and reject overlapping dates. Recommended for this demo.</small></label><label><input type="radio" name="policy" value="Require volunteer approval"> <b>Require volunteer approval</b><small>Create a pending request until a volunteer confirms it.</small></label></fieldset><div class="actions">${btn("Record decision", "decision")}${btn("Defer", "defer")}</div><p class="muted">Recording a policy makes dependent work ready. It does not authorize execution.</p></section></div>${independentWork()}`;
}
function independentWork() {
  return `<div class="card"><div class="section-heading"><div><p class="card-kicker">INDEPENDENT WORK</p><h2>Can proceed now</h2></div><a href="#task/BB-001">View all work</a></div><div class="row"><span><b>Improve tool descriptions</b><small>BB-002 · No dependency on reservation policy</small></span><span class="badge">Ready</span></div><div class="row"><span><b>Prepare tool photos</b><small>BB-003 · No dependency on reservation policy</small></span><span class="badge">Ready</span></div></div>`;
}
function reviewPage(r, a) {
  return `<div class="review-page"><section>${result(a)}</section><aside><div class="card"><p class="card-kicker">BRIEF</p><h2>What the owner asked for</h2><blockquote>${esc(a.text)}</blockquote><p><b>Approved interpretation:</b> Add tool reservations with date availability and overlap prevention.</p><a href="#task/BB-001/intent">Inspect task and decision history →</a></div><div class="card"><p class="card-kicker">WHAT TO TRY</p><h2>Evaluate the core behavior</h2><ol><li>Find the drill and its pickup/return dates.</li><li>Inspect the availability message.</li><li>Inspect the unavailable date range.</li><li>Find the ladder as another available tool.</li></ol><p><small>This is fixture evidence. Visual polish and live integrations are outside this test.</small></p></div></aside></div>`;
}
function detail(r, a) {
  return `<span class="badge">${s.state}</span><nav>${["Intent", "Execution", "Result", "Review"].map((x) => `<a class="button" href="#task/BB-001/${x.toLowerCase()}">${x}</a>`).join("")}</nav><div class="grid"><section><div class="card" id="intent"><p class="card-kicker">INTENT · BB-001/r${r.id}</p><h2>Reserve available tools</h2><blockquote>${esc(r.text)}</blockquote><p><b>Product decision:</b> BB-D01/r${s.decision} · ${esc(s.scope)}</p><details><summary>Acceptance examples and exclusions</summary><ol><li>Confirm an available tool reservation.</li><li>Show pickup and return dates.</li><li>Reject overlapping reservations.</li><li>Keep other tools independently available.</li><li>Changed inputs prevent acceptance of stale builds.</li></ol><p>Excluded: payment, notifications, merge, and production release.</p></details><label>Edit interpretation (creates a new revision)<textarea id="intentText">${esc(r.text)}</textarea></label>${btn("Save new revision", "edit", !["Blocked", "Ready", "Awaiting review", "Completed"].includes(s.state))}<details><summary>Task revision history (${s.revisions.length})</summary>${s.revisions.map((x) => `<p>r${x.id} · ${esc(x.text)}</p>`).join("")}</details></div>${result(a)}</section><aside><div class="card" id="execution"><p class="card-kicker">EXECUTION</p><h2>${s.state}</h2><p>Connector: ${esc(s.connector)}<br>Mapping: ${s.mapping || "None"} · simulated<br>Worker: ${s.scenario === "Worker unavailable" ? "unavailable · last seen 12 min ago" : "available (simulated)"}<br>Capacity: 1</p><details open><summary>Authorization scope</summary><p>Input: BB-001/r${r.id} · BB-D01/r${s.decision}<br>Allowed: edit isolated workspace, run relevant checks, return local preview.<br>Excluded: merge, release, purchases, unrelated writes.<br>Stop: consequential question, ambiguous effect, attempt budget (1).</p></details><div class="actions">${controls()}</div>${s.state === "Needs reconciliation" ? '<p class="error">Linear state conflict: stored Ready/v7; observed Cancelled/v8. Confirm which state should win before claiming a worker.</p>' : ""}${s.state === "Failed" ? '<p class="error">Build failed after workspace preparation. Partial artifact: compile.log — fixture type error. No publication attempted; retry is safe.</p>' : ""}${s.state === "Awaiting decision" ? '<label>Should conflicting dates show the existing reservation range?<textarea id="answer">Yes, show the occupied dates without any member personal details.</textarea></label>' + btn("Record answer", "answer") : ""}<details><summary>Authorization and attempt history</summary><pre>${esc(JSON.stringify({ authorizations: s.auth, attempts: s.attempts, inputAnswer: s.inputAnswer }, null, 2))}</pre></details><details><summary>Activity (${s.events.length})</summary>${s.events.map((x) => `<p><small>${esc(x.time)}</small><br>${esc(x.text)}</p>`).join("")}</details></div>${independentWork()}</aside></div>`;
}
function controls() {
  switch (s.state) {
    case "Blocked":
      return '<a class="button" href="#task/BB-001/decisions">Answer required decision</a>';
    case "Ready":
    case "Continue ready":
    case "Failed":
    case "Cancelled":
      return btn(
        s.state === "Continue ready"
          ? "Authorize continuation"
          : s.state === "Failed"
            ? "Authorize retry"
            : "Authorize task",
        "authorize",
      );
    case "Authorized":
      return (
        btn("Simulate queue confirmation", "map") +
        btn("Reconcile existing mapping", "reconcile") +
        btn("Cancel", "cancel")
      );
    case "Needs reconciliation":
      return (
        btn("Use portal authorization; reconcile v8", "reconcile") +
        btn("Honor Linear cancellation", "cancel")
      );
    case "Queued":
      return (
        (s.scenario === "Worker unavailable"
          ? btn("Restore worker heartbeat", "worker")
          : btn("Simulate worker claim", "start")) + btn("Cancel", "cancel")
      );
    case "Running":
      return btn("Simulate next result", "finish") + btn("Cancel", "cancel");
    case "Awaiting decision":
      return btn("Cancel", "cancel");
    case "Cancelling":
      return (
        btn("Simulate both stop confirmations", "confirmCancel") +
        btn("Simulate missing confirmation", "uncertain")
      );
    case "Cancellation uncertain":
      return (
        "<p>Runner exit or connector state unknown. New claims remain stopped.</p>" +
        btn("Reconcile both stop confirmations", "confirmCancel")
      );
    default:
      return "<p>No execution pending.</p>";
  }
}
function result(a) {
  return `<div class="card review-workspace" id="result"><p class="card-kicker">REVIEW WORKSPACE</p><h2>Does this result meet the intent?</h2>${
    !a
      ? "<p>A completed attempt will return the original brief, a task to try, acceptance results, evidence, limitations, and response actions.</p>"
      : `<label>Artifact history <select id="artifact">${s.artifacts.map((x) => `<option value="${x.id}" ${x.id === a.id ? "selected" : ""}>A${x.id} · r${x.revision}${stale(s, x) ? " · Stale" : ""}</option>`).join("")}</select></label><span class="badge">${stale(s, a) ? `Stale: artifact r${a.revision}/BB-D01 r${a.decision}; current r${current(s).id}/BB-D01 r${s.decision}` : "Current inputs"}</span><iframe title="Simulated BorrowBox reservation preview" sandbox=""></iframe><p>A${a.id} · BB-001/r${a.revision} · BB-D01/r${a.decision} (${esc(a.policy)})<br>Source: fixture-base-01 → fixture-result-${a.id}<br>Digest: ${a.digest}<br>Attempt ${a.attempt} · Symphony / fixture workflow v1<br>Model and usage: simulated, not measured<br>Produced ${esc(a.time)}</p><details><summary>Diff and checks (fixture evidence)</summary><pre>+ ToolReservation: select pickup and return dates
+ Availability: reject overlapping reservations
+ Review: compare decision and task revisions</pre><p>Simulated checks: availability PASS; overlap rejection PASS; stale acceptance PASS.<br>Live integration, accessibility audit, real agent execution: NOT TESTED.</p></details><p><b>Limitations:</b> Preview is a synthetic fixture. It does not render arbitrary requested changes; artifact metadata and review history remain separate.</p><div id="review"><h3>Review this exact artifact</h3><label>Feedback<textarea id="feedback">Make unavailable dates and the conflicting reservation range clearer.</textarea></label><div class="actions">${btn("Request revision", "revision", s.state !== "Awaiting review")}${btn("Accept this build", "accept", stale(s, a) || s.state !== "Awaiting review")}</div><small>Acceptance records A${a.id} and its input revisions. It does not merge or release.</small></div>`
  }<details><summary>Review history</summary><pre>${esc(JSON.stringify(s.reviews, null, 2))}</pre></details></div>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const type = b.dataset.action;
  try {
    if (type === "reset") {
      s = initial();
      location.hash = "overview";
    } else {
      const fields = {
        request: "request",
        edit: "intentText",
        decision: "policy",
        revision: "feedback",
        answer: "answer",
      };
      const value = type === "decision" ? document.querySelector('input[name="policy"]:checked')?.value : document.getElementById(fields[type])?.value;
      if (type === "showDecision") { s.scope = null; s.state = "Blocked"; location.hash = "overview"; }
      else act(s, type, value);
      if (type === "request") location.hash = "task/BB-001";
      if (type === "revision") location.hash = "task/BB-001";
      if (type === "finish" && s.state === "Awaiting review")
        location.hash = "task/BB-001/result";
    }
    error = "";
    localStorage.setItem(key, JSON.stringify(s));
  } catch (err) {
    error = err.message;
  }
  render();
});
document.addEventListener("change", (e) => {
  if (e.target.id === "scenario") s.scenario = e.target.value;
  else if (e.target.id === "artifact") s.selected = Number(e.target.value);
  else return;
  localStorage.setItem(key, JSON.stringify(s));
  render();
});
window.addEventListener("hashchange", () => {
  render();
  const section = location.hash.split("/")[2];
  if (section) document.getElementById(section)?.scrollIntoView();
});
render();
