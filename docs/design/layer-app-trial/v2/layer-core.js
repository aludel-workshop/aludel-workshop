// Local trial model. No worker, provider, credential, or external API is connected.
const uid = prefix => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const timestamp = () => new Date().toLocaleString();

const baseDocuments = [
  { id: 'out-map', group: 'Outputs', title: 'Page map', content: 'The map owns planned page identities, placement, and navigational links. A page can be blank. A link is a design proposal until reviewed.', revision: 1 },
  { id: 'out-page', group: 'Outputs', title: 'Page specification', content: 'A page specifies its purpose, address, sections, content, and states. A spec mockup is a design output; a built page is a separate observation.', revision: 1 },
  { id: 'out-flow', group: 'Outputs', title: 'Flow', content: 'A flow is an ordered journey through pages, with a goal, transitions, and review. A flow can be created directly without a Vision story.', revision: 1 },
  { id: 'method-blank', group: 'Methods', title: 'Starting blank', content: 'Begin with one page blank or one journey question. Sketch pages and transitions. Do not require Vision, Design, or Code to exist.', revision: 1 },
  { id: 'method-review', group: 'Methods', title: 'Reviewing a flow', content: 'Walk the flow at desktop and phone width. Check the goal, every transition, page content, missing states, and whether the journey makes sense to a person.', revision: 1 },
  { id: 'agent-guide', group: 'Methods', title: 'Pages expert instructions', content: 'Start from the assigned Work item and its pinned input revisions. Read the relevant output spec, method, routine instructions, and accepted connection documents through the scoped knowledge gateway. Ask about consequential ambiguity. Submit candidate outputs and evidence to Work for review.', revision: 1 },
  { id: 'resource-library', group: 'Resources', title: 'Using shared Library evidence', content: 'Sources and insights are owned by Library and can support any layer. Link exact source identities to Pages outputs. A source does not authorize work or become accepted product intent by being searchable.', revision: 1 },
  { id: 'routine-doc-map', group: 'Routines', title: 'Map coverage instructions', content: 'Inspect Pages map, page and flow revisions. Stage one question for a page with no flow, one task for an empty flow or missing step, and one review task for an unreviewed flow. Close a routine-created task when its exact gap disappears. Do not assert that every page requires a flow.', revision: 1 },
  { id: 'routine-doc-discovery', group: 'Routines', title: 'Network discovery instructions', content: 'When a layer appears, read its output descriptor and sample permitted records. Propose a connection document explaining whether and how those outputs could improve Pages. Ask a bounded question before a consequential new mapping. Do not activate the relation or create output work on your own.', revision: 1 },
  { id: 'routine-doc-sync', group: 'Routines', title: 'Network syncing instructions', content: 'Read the accepted connection documents and their exact revisions. Compare applicable source records with Pages outputs. Stage deduplicated Pages work for uncovered inputs; close tasks when covered or when a source/relation becomes inactive. Never infer intent from a route or note alone.', revision: 1 },
  { id: 'routine-doc-review', group: 'Routines', title: 'Flow quality review instructions', content: 'Read a flow, its page mockups, linked sources, and review criteria. Report observed gaps with evidence. Propose changes through Work; do not mark the flow reviewed on the agent\'s own authority.', revision: 1 }
];
const baseRoutines = [
  { id: 'map-coverage', title: 'Map coverage', executor: 'utility', trigger: 'After page/flow change · quiet period', enabled: true, documentId: 'routine-doc-map', capabilities: ['Read Pages outputs', 'Stage Pages work', 'Close resolved Pages work'], outputKinds: ['Work items', 'Run report'], revision: 1 },
  { id: 'network-discovery', title: 'Network discovery', executor: 'agent', trigger: 'Layer added', enabled: true, documentId: 'routine-doc-discovery', capabilities: ['Read output descriptors', 'Read scoped knowledge', 'Ask question', 'Propose connection document'], outputKinds: ['Connection proposal', 'Question', 'Run report'], revision: 1 },
  { id: 'network-sync', title: 'Network syncing', executor: 'agent', trigger: 'Connected output changed', enabled: true, documentId: 'routine-doc-sync', capabilities: ['Read accepted connection docs', 'Read scoped knowledge', 'Stage Pages work'], outputKinds: ['Work items', 'Run report'], revision: 1 },
  { id: 'flow-review', title: 'Flow quality review', executor: 'agent', trigger: 'On demand or flow changed', enabled: true, documentId: 'routine-doc-review', capabilities: ['Read Pages flows', 'Read linked evidence', 'Propose review findings'], outputKinds: ['Review report'], revision: 1 }
];
export function ensureLayerModel(state) {
  if (!state.pagesApp) state.pagesApp = { documents: structuredClone(baseDocuments), routines: structuredClone(baseRoutines), connections: [], runs: [] };
  state.pagesApp.documents ||= structuredClone(baseDocuments);
  state.pagesApp.routines ||= structuredClone(baseRoutines);
  state.pagesApp.connections ||= [];
  state.pagesApp.runs ||= [];
  for (const routine of baseRoutines) if (!state.pagesApp.routines.some(item => item.id === routine.id)) state.pagesApp.routines.push(structuredClone(routine));
  for (const doc of baseDocuments) if (!state.pagesApp.documents.some(item => item.id === doc.id)) state.pagesApp.documents.push(structuredClone(doc));
  return state;
}
export function baseGaps(state) {
  const gaps = [];
  for (const page of state.pages) if (!state.flows.some(flow => flow.steps.some(step => step.page === page.id))) gaps.push({ key: `page-unlinked:${page.id}`, title: `Decide whether ${page.name} belongs in a flow`, detail: 'Map coverage · a page has no journey link. This is a question, not a mandate to create a flow.', target: `page:${page.id}` });
  for (const flow of state.flows) {
    if (!flow.steps.length) gaps.push({ key: `flow-empty:${flow.id}`, title: `Add steps to ${flow.name}`, detail: 'Map coverage · this flow has no walkthrough steps.', target: `flow:${flow.id}` });
    else {
      flow.steps.forEach((step,index) => { if (!state.pages.some(page => page.id === step.page)) gaps.push({ key: `flow-missing:${flow.id}:${index}`, title: `Choose a page for step ${index + 1} in ${flow.name}`, detail: 'Map coverage · this step has no page.', target: `flow:${flow.id}` }); });
      if (!flow.reviewed) gaps.push({ key: `flow-review:${flow.id}`, title: `Review the ${flow.name} flow`, detail: 'Map coverage · this flow has no designer review.', target: `flow:${flow.id}` });
    }
  }
  return gaps;
}
export function networkGaps(state) {
  const gaps = [];
  for (const connection of state.pagesApp.connections.filter(item => item.status === 'active' && item.mapping === 'flow-candidate')) {
    const layer = state.layers.find(item => item.id === connection.layerId);
    if (!layer) continue;
    for (const record of layer.records) if (!state.flows.some(flow => flow.steps.some(step => step.story === record.id || step.sourceRef === `record:${layer.id}:${record.id}`))) gaps.push({ key: `connected-flow:${connection.id}:${record.id}:r${connection.revision}`, title: `Explore a flow for “${record.title}”`, detail: `Network syncing · ${connection.title} r${connection.revision}. Confirm that this record warrants a flow.`, target: `record:${layer.id}:${record.id}`, sourceRef: `record:${layer.id}:${record.id}` });
  }
  return gaps;
}
const currentGapKeys = state => new Set([...baseGaps(state), ...networkGaps(state)].map(item => item.key));
export function closeResolvedWork(state, reason = 'Source or Pages output changed') {
  const current = currentGapKeys(state); const closed = [];
  for (const item of state.work) if (item.layer === 'Pages' && item.gap && ['suggested','ready'].includes(item.status) && !current.has(item.gap)) { item.status = 'resolved'; item.closed = timestamp(); item.closeReason = reason; closed.push(item.id); }
  if (closed.length) {
    const run = { id: uid('run'), routineId: 'map-coverage', trigger: 'After relevant edit', executor: 'utility', status: 'done', at: timestamp(), inputs: ['Current Pages output revisions', 'Active connection documents'], outputs: closed.map(id => ({ kind: 'Closed Work item', ref: id })), summary: `Automatically closed ${closed.length} resolved task${closed.length === 1 ? '' : 's'}.` };
    state.pagesApp.runs.unshift(run);
    state.work.unshift({ id: uid('work'), kind: 'routine', layer: 'Pages', routineId: 'map-coverage', runId: run.id, title: 'Map coverage · automatic closure', detail: run.summary, target: 'General', status: 'done', created: run.at });
  }
  return closed;
}
function stageGaps(state,gaps,routineId) {
  const created=[];
  for (const gap of gaps) if (!state.work.some(item => item.gap === gap.key && item.status !== 'resolved' && item.status !== 'superseded')) {
    const item={ id:uid('work'), kind:'output', layer:'Pages', routineId, gap:gap.key, title:gap.title, detail:gap.detail, target:gap.target, sourceRef:gap.sourceRef||null, status:'suggested', created:timestamp() };
    state.work.unshift(item); created.push(item.id);
  }
  return created;
}
function beginRun(state,routine,trigger) {
  const run={ id:uid('run'), routineId:routine.id, trigger, executor:routine.executor, status:routine.executor==='utility'?'done':'ready', at:timestamp(), inputs:[`Routine instructions ${routine.documentId} r${state.pagesApp.documents.find(doc=>doc.id===routine.documentId)?.revision||1}`], outputs:[], summary:'' };
  state.pagesApp.runs.unshift(run);
  const work={ id:uid('work'), kind:'routine', layer:'Pages', routineId:routine.id, runId:run.id, title:`${routine.title} · ${trigger}`, detail:`Routine work item. ${routine.executor==='agent'?'Awaiting an agent or local demo stand-in.':'Utility run completed locally.'}`, target:'General', status:run.status, created:run.at };
  state.work.unshift(work);
  return run;
}
export function runPagesRoutine(state,routineId,trigger='Run now') {
  const routine=state.pagesApp.routines.find(item=>item.id===routineId);
  if (!routine?.enabled) return null;
  const run=beginRun(state,routine,trigger);
  if (routineId==='map-coverage') {
    const gaps=baseGaps(state); const created=stageGaps(state,gaps,routineId); const closed=closeResolvedWork(state,'Map coverage audit');
    run.inputs.push(`${state.pages.length} pages`,`${state.flows.length} flows`);
    run.outputs=[...created.map(ref=>({kind:'Created Work item',ref})),...closed.map(ref=>({kind:'Closed Work item',ref}))];
    run.summary=`Checked ${gaps.length} current gaps; created ${created.length} task${created.length===1?'':'s'} and closed ${closed.length}.`;
  } else run.summary='Queued as a Work item. No agent is connected in this trial; open this run to inspect a local demonstration.';
  return run;
}
export function queueLayerDiscovery(state,layer) {
  const routine=state.pagesApp.routines.find(item=>item.id==='network-discovery');
  if (!routine?.enabled) return null;
  const run=beginRun(state,routine,`Layer added: ${layer.name}`); run.inputs.push(`${layer.name} output descriptor (${layer.output})`); run.layerId=layer.id;
  run.summary='Queued discovery of the new output descriptor. It will propose a connection document for review.';
  return run;
}
export function demonstrateAgentRun(state,runId) {
  const run=state.pagesApp.runs.find(item=>item.id===runId); if (!run || run.status!=='ready') return null;
  const routine=state.pagesApp.routines.find(item=>item.id===run.routineId); if (!routine) return null;
  const produced=[];
  if (run.routineId==='network-discovery') {
    const layers=run.layerId ? state.layers.filter(layer=>layer.id===run.layerId) : state.layers;
    for (const layer of layers) if (!state.pagesApp.connections.some(item=>item.layerId===layer.id)) {
      const connection={ id:uid('connection'), layerId:layer.id, title:`${layer.name} → Pages`, sourceOutput:layer.output, status:'proposed', mapping:layer.type==='vision'?'flow-candidate':'reference-only', instructions:layer.type==='vision'?'Stories may suggest flows. Check whether a record represents a user-facing journey before creating a Pages task.':'This output is discoverable. No Pages relationship is assumed until reviewed.', reaction:'When the source changes, compare it with linked Pages flows and stage a question or output task only when the accepted mapping applies.', question:layer.type==='vision'?'Which stories should count as flow candidates in this project?':'', answer:'', revision:1 };
      state.pagesApp.connections.push(connection); produced.push({kind:'Connection proposal',ref:connection.id});
    }
    run.summary=produced.length?`Proposed ${produced.length} connection document${produced.length===1?'':'s'} for review.`:'No new connection proposal was needed.';
  } else if (run.routineId==='network-sync') {
    const active=state.pagesApp.connections.filter(item=>item.status==='active');
    run.inputs.push(...active.map(item=>`Connection ${item.id} r${item.revision}`));
    const gaps=networkGaps(state), created=stageGaps(state,gaps,'network-sync'), closed=closeResolvedWork(state,'Network sync');
    produced.push(...created.map(ref=>({kind:'Created Work item',ref})),...closed.map(ref=>({kind:'Closed Work item',ref})));
    run.summary=`Read ${active.length} accepted connection document${active.length===1?'':'s'}; ${gaps.length} uncovered candidate${gaps.length===1?'':'s'}, ${created.length} new task${created.length===1?'':'s'}.`;
  } else if (run.routineId==='flow-review') {
    run.summary='Local demonstration: a Pages expert would review selected flows and submit a report. No flow verdict was changed.';
  }
  run.outputs=produced; run.status='done'; run.demo=true;
  const work=state.work.find(item=>item.runId===run.id); if(work){work.status='done';work.detail=`Local demonstration, not an agent turn. ${run.summary}`;}
  return run;
}
export function updateDocument(state,id,patch) { const doc=state.pagesApp.documents.find(item=>item.id===id); if (!doc) return null; Object.assign(doc,patch); doc.revision++; return doc; }
export function updateConnection(state,id,patch) { const doc=state.pagesApp.connections.find(item=>item.id===id); if (!doc) return null; Object.assign(doc,patch); doc.revision++; closeResolvedWork(state,'Connection policy changed'); return doc; }
export function updateRoutine(state,id,patch) { const routine=state.pagesApp.routines.find(item=>item.id===id); if (!routine) return null; Object.assign(routine,patch); routine.revision++; return routine; }
