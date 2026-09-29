// Compact, model-facing view of a Go-pinned bundle. Effects come from explicit adapters,
// never from free-form role/action text or the task brief.
const fail = message => { throw Object.assign(new Error(message), { status: 409 }); };
const summary = record => String(record.summary || record.description || record.title || record.name || record.text || record.body || '').slice(0, 220);

export function compileTaskManifest(bundle) {
  const { project, work, guidance, sources, repository, instructionPins } = bundle;
  const person = bundle.performer?.kind === 'person';
  if (!project?.id || !work?.id || !guidance?.role?.revision || !guidance?.action?.revision || (!person && !guidance?.profile?.revision) ||
      (!person && !/^[a-f0-9]{40}$/.test(repository?.commit || ''))) fail('The task is missing pinned inputs.');
  const action = guidance.action;
  const coding = action.id === 'platform.implement' && action.tools?.includes('code') && action.changes?.some(value => value.startsWith('Code › '));
  const audit = action.id === 'platform.security' && action.tools?.includes('read') && !action.changes?.length;
  const proposal = ['product.define', 'product.clarify', 'product.brief', 'data.contract'].includes(action.id) && action.tools?.includes('read');
  const pagesFlow = action.id === 'pages.flows' && action.tools?.includes('read') && action.tools?.includes('revise');
  const assessment = action.id.endsWith('.discover') && action.tools?.includes('read') && !action.changes?.length || ['design.audit', 'pages.a11y', 'deploy.review', 'work.review'].includes(action.id) && action.tools?.includes('read') && !action.changes?.length;
  if (!coding && !audit && !proposal && !assessment && !pagesFlow) fail('This action has no task output adapter.');
  if (action.id === 'product.clarify' && (!work.question || work.question.answer)) fail('Clarification needs an open question.');
  const inputs = (work.targets || []).map(target => {
    const source = sources.find(record => record.id === target.id && record.kind === target.kind);
    if (!source?.revision) fail('A task target has no pinned project revision.');
    return { id: source.id, kind: source.kind, revision: source.revision, summary: summary(source) };
  });
  return {
    schemaVersion: 'aludel-task-open-v1',
    identity: { projectId: project.id, workId: work.id, workRef: work.ref, batchId: bundle.batch.id },
    task: { performer: person ? bundle.performer : { kind: 'agent', id: guidance.profile.id }, title: work.title, brief: work.context?.suggestion || '', answeredQuestion: work.question?.answer ? { question: work.question.text, answer: work.question.answer } : null, openQuestion: work.action === 'product.clarify' && work.question && !work.question.answer ? work.question.text : null, role: { id: guidance.role.id, revision: guidance.role.revision, name: guidance.role.name },
      action: { id: action.id, revision: action.revision, name: action.name }, profile: person ? null : { id: guidance.profile.id, revision: guidance.profile.revision, name: guidance.profile.name, provider: guidance.profile.provider || 'codex', model: guidance.profile.model || '', effort: guidance.profile.effort || 'medium' } },
    guidance: { project: guidance.project, role: guidance.role.instructions, action: action.instructions, profile: person ? '' : guidance.profile.instructions,
      method: audit ? 'Inspect only the pinned source and relevant knowledge. Report severity, affected source, evidence, recommendation, checked scope and unknowns. Ask if a decision blocks the result.' :
        coding ? 'Implement only the allowed code surface, run relevant checks, and submit the exact candidate commit.' :
        pagesFlow ? 'Draft a Pages flow using existing pinned pages. Use a Vision story only when one is linked to this task. Submit a proposal for Work review; do not change Pages records.' :
        action.id.endsWith('.discover') ? 'Inspect every named installed neighbor and its current outputs. Propose a separate receiving policy for each source. State missing evidence and response to source changes. Do not activate a policy or edit project records.' :
        assessment ? 'Inspect the task scope and relevant project knowledge. Submit a findings report for lead review. Do not change project records or repository files.' :
        'Read the task and relevant project knowledge. Submit a bounded proposal for Work review. Do not change project records or repository files. Ask if a decision blocks the result.' },
    origin: work.context?.discovery ? { layer: work.layer, discovery: work.context.discovery, sources: bundle.layerDiscovery?.sources || [] } : work.context?.policy ? { layer: work.layer, routineId: work.context.routine || null, gapKey: work.context.gap || null, receipt: work.context.receipt || null, policy: work.context.policy, source: work.context.source } : bundle.codeObservation ? { layer: 'platform', kind: 'code-route-observation', relation: { id: bundle.codeObservation.relationId, revision: bundle.codeObservation.relationRevision }, observation: bundle.codeObservation } : { layer: work.layer },
    controls: bundle.controlPins || [],
    requiredInputs: inputs,
    contextSeeds: sources.filter(record => record.kind === 'doc' && !(work.targets || []).some(target => target.id === record.id))
      .slice(0, 12).map(record => ({ id: record.id, kind: record.kind, revision: record.revision, summary: summary(record) })),
    outputs: audit ? [{ key: 'findings', kind: 'security_finding_report', operation: 'submit_for_review', reviewer: 'project owner',
      checks: work.checks.map(check => check.text) }] : coding ? [{ key: 'code', kind: 'code_candidate', operation: 'commit_for_review', reviewer: 'project owner', checks: work.checks.map(check => check.text) }] :
      [{ key: 'proposal', kind: pagesFlow ? 'pages_flow_proposal' : action.id.endsWith('.discover') ? 'layer_connection_proposal' : assessment ? 'review_report' : action.id === 'product.brief' ? 'vision_claim_proposal' : 'work_proposal', operation: 'submit_for_review', reviewer: 'role lead',
        shape: action.id.endsWith('.discover') ? 'summary; content: connections[{sourceKey,mapping:reference-only|candidate-input,instructions,reaction,question?,answer?,evidence}]; one connection for each named source; usedInputs for any cited records' : pagesFlow ? 'summary; content: title, steps[{page,name,trigger?,story?}]; usedInputs must include every page and any linked story' : assessment ? 'summary; content: scope, findings[{title,evidence,recommendation}], optional uncertainty; usedInputs' :
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
