// Compact, model-facing view of a Go-pinned bundle. Effects come from explicit adapters,
// never from free-form role/action text or the task brief.
const fail = message => { throw Object.assign(new Error(message), { status: 409 }); };
const summary = record => String(record.summary || record.description || record.title || record.name || record.text || record.body || '').slice(0, 220);

// DEC-057: a layer-scoped task is guided by its layer's pinned charter and Knowledge, not an action. The host
// adapters named in changes bound what it may write; follow-ups carry anything else to the owning layer's review.
function compileLayerTask(bundle) {
  const { project, work, guidance, sources, repository, instructionPins, layerPackage } = bundle;
  const scope = guidance.layerScope;
  if (!project?.id || !work?.id || !guidance?.profile?.revision || !/^[a-f0-9]{40}$/.test(repository?.commit || '') ||
      !scope?.key || scope.key !== work.layer || !layerPackage || layerPackage.commit !== scope.commit || bundle.layerApi?.commit !== scope.commit) fail('The task is missing pinned inputs.');
  const pinned = (target, list) => {
    const source = sources.find(record => record.id === target.id && record.kind === target.kind);
    if (!source?.revision) fail('A task target has no pinned project revision.');
    list.push({ id: source.id, kind: source.kind, revision: source.revision, summary: summary(source) });
  };
  const inputs = [];
  for (const target of work.targets || []) pinned(target, inputs);
  for (const ref of bundle.flowInputs || []) pinned(ref, inputs);
  const spec = bundle.layerApi.spec;
  const operations = Object.entries(spec.paths).flatMap(([path, item]) => Object.entries(item).filter(([, op]) => op?.operationId).map(([method, op]) => ({
    operationId: op.operationId, method: method.toUpperCase(), path, summary: op.summary || '', writes: op['x-aludel-output'] || null, reads: op['x-aludel-read']?.kind || null })));
  return {
    schemaVersion: 'aludel-task-open-v2',
    identity: { projectId: project.id, workId: work.id, workRef: work.ref, batchId: bundle.batch.id },
    task: { performer: { kind: 'agent', id: guidance.profile.id }, title: work.title, brief: work.context?.suggestion || '', layer: scope.key,
      answeredQuestion: work.question?.answer ? { question: work.question.text, answer: work.question.answer } : null,
      criteria: (work.checks || []).map(check => check.text),
      profile: { id: guidance.profile.id, revision: guidance.profile.revision, name: guidance.profile.name, provider: guidance.profile.provider || 'codex', model: guidance.profile.model || '', effort: guidance.profile.effort || 'medium' } },
    guidance: { project: guidance.project, profile: guidance.profile.instructions,
      method: `Do this task as the ${scope.key} layer. Its charter and Knowledge below are your method. Read whatever project records help (reads are project-wide). ` +
        `Change ${scope.key} data only by calling its API with aludel_layer_call (operation, id for a path id, body). The API document under layerApi defines every operation and schema. ` +
        'Your writes are staged for this run, reads include what you staged, and nothing applies until an elevated reviewer accepts the run. ' +
        'If something outside this layer should change, or a separate task would help, propose it as a follow-up with a clear reason instead of doing it. ' +
        'Ask a question when a decision blocks the result. Do not change project records or repository files directly.' },
    layerSource: { key: layerPackage.key, instanceId: layerPackage.instanceId, commit: layerPackage.commit, charter: layerPackage.charter,
      documents: layerPackage.documents.map(doc => ({ path: doc.path, markdown: doc.markdown })) },
    origin: work.context?.createdBy ? { layer: work.context.createdBy.layer, kind: 'agent-follow-up', workRef: work.context.createdBy.workRef, why: work.context.createdBy.why } :
      work.context?.policy ? { layer: work.layer, routineId: work.context.routine || null, gapKey: work.context.gap || null, receipt: work.context.receipt || null, policy: work.context.policy, source: work.context.source } :
      bundle.codeObservation ? { layer: 'platform', kind: 'code-route-observation', relation: { id: bundle.codeObservation.relationId, revision: bundle.codeObservation.relationRevision }, observation: bundle.codeObservation } : { layer: work.layer },
    controls: bundle.controlPins || [],
    requiredInputs: inputs,
    contextSeeds: sources.filter(record => record.kind === 'doc' && !(work.targets || []).some(target => target.id === record.id))
      .slice(0, 12).map(record => ({ id: record.id, kind: record.kind, revision: record.revision, summary: summary(record) })),
    layerApi: spec,
    outputs: [{ key: 'changes', kind: 'layer_api_draft', operation: 'submit_for_review', reviewer: `elevated ${scope.key} reviewer`, operations,
      shape: 'Stage changes with aludel_layer_call, then aludel_submit_proposal { summary; content: { notes? }; followUps[0..5]: { layer, title, brief, why }; usedInputs? }',
      followUpLayers: guidance.followUpLayers || [], checks: (work.checks || []).map(check => check.text) }],
    capabilities: { knowledge: ['map', 'search', 'read'], layerApi: scope.key, repository: 'read-only pinned commit', submit: 'layer_api_draft' },
    runtime: { authorization: 'Go-pinned attempt', repositoryCommit: repository.commit, instructionPins, staleInputs: 'withdraw this attempt when a pinned input changes' }
  };
}

export function compileTaskManifest(bundle) {
  if (bundle.guidance?.layerScope) return compileLayerTask(bundle);
  const { project, work, guidance, sources, repository, instructionPins } = bundle;
  const person = bundle.performer?.kind === 'person';
  if (!project?.id || !work?.id || !guidance?.role?.revision || !guidance?.action?.revision || (!person && !guidance?.profile?.revision) ||
      (!person && !/^[a-f0-9]{40}$/.test(repository?.commit || ''))) fail('The task is missing pinned inputs.');
  const action = guidance.action;
  const coding = action.id === 'platform.implement' && action.tools?.includes('code') && action.changes?.some(value => value.startsWith('Code › '));
  const audit = action.id === 'platform.security' && action.tools?.includes('read') && !action.changes?.length;
  const proposal = ['product.define', 'product.clarify', 'product.brief', 'data.contract'].includes(action.id) && action.tools?.includes('read');
  const pagesFlow = action.id === 'pages.flows' && action.tools?.includes('read') && action.tools?.includes('revise');
  const reviseFlow = pagesFlow && work.targets?.length === 1 && work.targets[0].kind === 'flow';
  const assessment = action.id.endsWith('.discover') && action.tools?.includes('read') && !action.changes?.length || ['design.audit', 'pages.a11y', 'deploy.review', 'work.review'].includes(action.id) && action.tools?.includes('read') && !action.changes?.length;
  if (!coding && !audit && !proposal && !assessment && !pagesFlow) fail('This action has no task output adapter.');
  if (action.id === 'product.clarify' && (!work.question || work.question.answer)) fail('Clarification needs an open question.');
  const inputs = (work.targets || []).map(target => {
    const source = sources.find(record => record.id === target.id && record.kind === target.kind);
    if (!source?.revision) fail('A task target has no pinned project revision.');
    return { id: source.id, kind: source.kind, revision: source.revision, summary: summary(source) };
  });
  for (const ref of bundle.flowInputs || []) {
    const source = sources.find(record => record.id === ref.id && record.kind === ref.kind && record.revision === ref.revision);
    if (!source) fail('A referenced flow input has no pinned project revision.');
    inputs.push({ id:ref.id, kind:ref.kind, revision:ref.revision, summary:summary(source) });
  }
  return {
    schemaVersion: 'aludel-task-open-v1',
    identity: { projectId: project.id, workId: work.id, workRef: work.ref, batchId: bundle.batch.id },
    task: { performer: person ? bundle.performer : { kind: 'agent', id: guidance.profile.id }, title: work.title, brief: work.context?.suggestion || '', answeredQuestion: work.question?.answer ? { question: work.question.text, answer: work.question.answer } : null, openQuestion: work.action === 'product.clarify' && work.question && !work.question.answer ? work.question.text : null, role: { id: guidance.role.id, revision: guidance.role.revision, name: guidance.role.name },
      action: { id: action.id, revision: action.revision, name: action.name }, profile: person ? null : { id: guidance.profile.id, revision: guidance.profile.revision, name: guidance.profile.name, provider: guidance.profile.provider || 'codex', model: guidance.profile.model || '', effort: guidance.profile.effort || 'medium' } },
    guidance: { project: guidance.project, role: guidance.role.instructions, action: action.instructions, profile: person ? '' : guidance.profile.instructions,
      method: audit ? 'Inspect only the pinned source and relevant knowledge. Report severity, affected source, evidence, recommendation, checked scope and unknowns. Ask if a decision blocks the result.' :
        coding ? 'Implement only the allowed code surface, run relevant checks, and submit the exact candidate commit.' :
        pagesFlow ? reviseFlow ? 'Revise the pinned existing Pages flow. Preserve its ID, cite every current page, persona, activity or story used, and submit title and complete steps for Previous/Proposed Work review. A Vision story is optional. Do not change Pages records.' : 'Draft a Pages flow using existing pinned pages. Use a Vision story only when one is linked to this task. Submit a proposal for Work review; do not change Pages records.' :
        action.id.endsWith('.discover') ? 'Read this layer’s identity and every neighbor’s identity, outputs and reciprocal connection view. Propose a separate receiving policy for each source. State missing evidence and response to source changes. Do not activate a policy or edit project records.' :
        assessment ? 'Inspect the task scope and relevant project knowledge. Submit a findings report for lead review. Do not change project records or repository files.' :
        'Read the task and relevant project knowledge. Submit a bounded proposal for Work review. Do not change project records or repository files. Ask if a decision blocks the result.' },
    layerSource: bundle.layerPackage ? { key: bundle.layerPackage.key, instanceId: bundle.layerPackage.instanceId, commit: bundle.layerPackage.commit,
      charter: bundle.layerPackage.charter,
      documents: bundle.layerPackage.documents.map(doc => ({ path: doc.path, markdown: doc.markdown })) } : null,
    layerMethod: guidance.layerAction?.id === action.id ? { actionId: guidance.layerAction.id,
      actionRevision: guidance.layerAction.revision, methodRevision: guidance.layerAction.methodRevision,
      text: guidance.layerAction.method } : null,
    origin: work.context?.discovery ? { layer: work.layer, receivingIdentity:bundle.layerDiscovery?.receiver?.identity || null, receivingIdentityRevision:bundle.layerDiscovery?.receiver?.identityRevision || null, discovery: work.context.discovery, sources: bundle.layerDiscovery?.sources || [] } : work.context?.policy ? { layer: work.layer, routineId: work.context.routine || null, gapKey: work.context.gap || null, receipt: work.context.receipt || null, policy: work.context.policy, source: work.context.source } : bundle.codeObservation ? { layer: 'platform', kind: 'code-route-observation', relation: { id: bundle.codeObservation.relationId, revision: bundle.codeObservation.relationRevision }, observation: bundle.codeObservation } : { layer: work.layer },
    controls: bundle.controlPins || [],
    requiredInputs: inputs,
    contextSeeds: sources.filter(record => record.kind === 'doc' && !(work.targets || []).some(target => target.id === record.id))
      .slice(0, 12).map(record => ({ id: record.id, kind: record.kind, revision: record.revision, summary: summary(record) })),
    outputs: audit ? [{ key: 'findings', kind: 'security_finding_report', operation: 'submit_for_review', reviewer: 'project owner',
      checks: work.checks.map(check => check.text) }] : coding ? [{ key: 'code', kind: 'code_candidate', operation: 'commit_for_review', reviewer: 'project owner', checks: work.checks.map(check => check.text) }] :
      [{ key: 'proposal', kind: pagesFlow ? 'pages_flow_proposal' : action.id.endsWith('.discover') ? 'layer_connection_proposal' : assessment ? 'review_report' : action.id === 'product.brief' ? 'vision_claim_proposal' : 'work_proposal', operation: 'submit_for_review', reviewer: 'role lead',
        shape: action.id.endsWith('.discover') ? 'summary; content: connections[{sourceKey,mapping:reference-only|candidate-input,instructions,reaction,question?,answer?,evidence}]; one connection for each named source; usedInputs for any cited records' : pagesFlow ? reviseFlow ? 'summary; content: title, steps[{page?,persona?,story?,name?,trigger?,why?}]; usedInputs must include the target flow and every referenced record at its current revision' : 'summary; content: title, steps[{page,name,trigger?,story?}]; usedInputs must include every page and any linked story' : assessment ? 'summary; content: scope, findings[{title,evidence,recommendation}], optional uncertainty; usedInputs' :
          action.id === 'product.brief' ? 'summary; content: section, text, note, basis; usedInputs' :
          action.id === 'product.define' ? 'summary; content: scenarios[{given,when,then}], optional edges[], questions[]; usedInputs' :
          action.id === 'product.clarify' ? 'summary; content: options[2..4], recommendation, reasoning; usedInputs' :
          'summary; content: description, fields[{name,type,required,description,format?}], optional states[]; usedInputs',
        checks: work.checks.map(check => check.text) }],
    capabilities: { knowledge: ['map', 'search', 'read'], repository: person ? 'read-only through editor bridge' : coding ? 'scoped code candidate' : 'read-only pinned commit',
      submit: person ? 'none through editor bridge' : audit ? 'security_report' : coding ? 'code_candidate' : 'work_proposal' },
    runtime: { authorization: person ? 'context-only; Work owns starting and submission' : 'Go-pinned attempt', repositoryCommit: repository.commit, instructionPins, staleInputs: 'withdraw this attempt when a pinned input changes' }
  };
}
