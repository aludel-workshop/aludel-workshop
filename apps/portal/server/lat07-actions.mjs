// LAT-07: checked declarations for the remaining built-in local layers. An
// unregistered adapter is deliberately unavailable for new Work admission.
import { compileLayerActions } from './layer-action-contract.mjs';
import { lat06LayerActions, lat06Adapters, lat06LegacyInventory } from './lat06-actions.mjs';

const seeds = { dreamer: 'human', planner: 'human', tinkerer: 'human' };
const read = (layer, kind) => ({ layer, kind });
function action(key, title, purpose, result, reads, checks, options = {}) {
  const effect = { propose: 'submit-proposal', report: 'submit-report', candidate: 'commit-candidate', observe: 'record-observation' }[result.operation];
  return { key, revision: 1, title, purpose, result, adapter: `${options.layer}_${key}`,
    permissions: { elevated: !!options.elevated, reads, fileReads: options.fileReads || [], fileWrites: options.fileWrites || [], effects: [effect] },
    checks, initialAssignee: seeds, requiredInputs: options.requiredInputs || [], optionalInputs: options.optionalInputs || [],
    reviewer: 'project-owner', applicability: 'installed-layer', method: options.method || '' };
}
export const lat07LayerActions = [
  { key: 'design', outputs: ['design_tokens', 'component', 'brand_asset'], actions: [
    action('tokens', 'Revise design tokens', 'Propose a token-set revision for the accepted Design editor.', { kind: 'design_tokens', operation: 'propose' },
      [read('design', 'design_tokens'), read('design', 'component')], ['Changed tokens are named', 'Affected component contracts are checked'],
      { layer: 'design', elevated: true, requiredInputs: ['token-set'] }),
    action('audit', 'Audit a component contract', 'Report a component contract and token-reference gap at exact revisions.', { owner: 'work', kind: 'report', operation: 'report' },
      [read('design', 'component'), read('design', 'design_tokens')], ['Findings cite component and token revisions', 'No design artifact is silently changed'],
      { layer: 'design', requiredInputs: ['component', 'token-set'] })
  ] },
  { key: 'data', outputs: ['data_object', 'data_operation', 'access_rule'], actions: [
    action('contract', 'Define object contract', 'Propose a typed Data object contract.', { kind: 'data_object', operation: 'propose' },
      [read('data', 'data_object')], ['Schema and relation targets validate', 'Contract revision is pinned'], { layer: 'data', requiredInputs: ['object'] }),
    action('operations', 'Define operation contract', 'Propose an operation linked to an object contract.', { kind: 'data_operation', operation: 'propose' },
      [read('data', 'data_object'), read('data', 'data_operation')], ['Request, response and error shapes validate', 'Object link cites its revision'],
      { layer: 'data', requiredInputs: ['object'] }),
    action('access', 'Revise access rule', 'Propose a Data access rule without changing runtime permissions.', { kind: 'access_rule', operation: 'propose' },
      [read('data', 'data_object'), read('data', 'access_rule')], ['Actor, object, action and effect are explicit', 'Runtime permission effects remain separate'],
      { layer: 'data', elevated: true, requiredInputs: ['object'] }),
    action('audit', 'Audit operation link', 'Report an operation/object link gap at exact Data revisions.', { owner: 'work', kind: 'report', operation: 'report' },
      [read('data', 'data_object'), read('data', 'data_operation')], ['Finding cites operation and object revisions', 'No contract is silently changed'],
      { layer: 'data', requiredInputs: ['operation'] })
  ] },
  { key: 'platform', outputs: ['code_unit', 'trace_link', 'code_release', 'code_route_observation'], actions: [
    action('implement', 'Implement a code change', 'Prepare a reviewed candidate against a pinned project repository commit.', { kind: 'code_unit', operation: 'candidate' },
      [read('platform', 'code_unit'), read('platform', 'trace_link')], ['Base commit and changed files are pinned', 'Tests are reported'],
      { layer: 'platform', fileReads: ['**'], fileWrites: ['src/**', 'app/**', 'apps/**', 'tests/**', 'server.mjs', 'README.md'], requiredInputs: ['repository-commit'] }),
    action('reconcile', 'Reconcile code links', 'Report mismatches between pinned Code units and linked layer records.', { owner: 'work', kind: 'report', operation: 'report' },
      [read('platform', 'code_unit'), read('platform', 'trace_link')], ['Each mismatch cites a source revision', 'No link is silently changed'],
      { layer: 'platform', fileReads: ['**'], requiredInputs: ['repository-commit'] }),
    action('docs', 'Revise code documentation', 'Prepare a reviewed documentation candidate in the bound repository.', { kind: 'code_unit', operation: 'candidate' },
      [read('platform', 'code_unit')], ['Base commit and documentation files are pinned'],
      { layer: 'platform', fileReads: ['**'], fileWrites: ['docs/**', 'README.md'], requiredInputs: ['repository-commit'] }),
    action('dependencies', 'Change dependencies', 'Prepare a reviewed dependency candidate without installing or publishing it.', { kind: 'code_unit', operation: 'candidate' },
      [read('platform', 'code_unit')], ['Dependency and lockfile changes are named', 'Checks and risk are reported'],
      { layer: 'platform', elevated: true, fileReads: ['**'], fileWrites: ['package.json', 'package-lock.json'], requiredInputs: ['repository-commit'] }),
    action('security', 'Audit code security', 'Report source-backed security findings without changing code.', { owner: 'work', kind: 'report', operation: 'report' },
      [read('platform', 'code_unit')], ['Each finding cites a pinned source location', 'Secrets are excluded from reports'],
      { layer: 'platform', fileReads: ['**'], requiredInputs: ['repository-commit'] })
  ] },
  { key: 'deploy', outputs: ['release'], actions: [
    action('inspect', 'Inspect environment state', 'Report the observed local environment and release status without an effect.', { owner: 'work', kind: 'report', operation: 'report' },
      [read('deploy', 'release'), read('platform', 'code_release')], ['Observation time and release identity are stated', 'Stale or unavailable state is explicit'],
      { layer: 'deploy', requiredInputs: ['environment'] })
  ] }
];

export const lat07LegacyInventory = Object.freeze({
  'design.tokens': { disposition: 'unavailable', action: 'design.tokens', reason: 'Typed token proposal adapter and review grant are not registered.' },
  'design.audit': { disposition: 'unavailable', action: 'design.audit', reason: 'Component audit report adapter is not registered.' },
  'design.review': { disposition: 'retired', reason: 'Shared Work owns signed review.' },
  'data.contract': { disposition: 'unavailable', action: 'data.contract', reason: 'Typed object proposal adapter is not registered.' },
  'data.operations': { disposition: 'unavailable', action: 'data.operations', reason: 'Typed operation proposal adapter is not registered.' },
  'data.access': { disposition: 'unavailable', action: 'data.access', reason: 'Access-rule adapter and elevated grant are not registered.' },
  'data.review': { disposition: 'retired', reason: 'Shared Work owns signed review.' },
  'platform.implement': { disposition: 'recreated', action: 'platform.implement' },
  'platform.reconcile': { disposition: 'unavailable', action: 'platform.reconcile', reason: 'Pinned Code reconciliation report adapter is not registered.' },
  'platform.docs': { disposition: 'unavailable', action: 'platform.docs', reason: 'Documentation candidate adapter is not registered.' },
  'platform.dependencies': { disposition: 'unavailable', action: 'platform.dependencies', reason: 'Dependency candidate adapter and elevated grant are not registered.' },
  'platform.security': { disposition: 'recreated', action: 'platform.security' },
  'platform.review': { disposition: 'retired', reason: 'Shared Work owns signed review.' },
  'deploy.configure': { disposition: 'unavailable', reason: 'Configuration is an external effect; no checked Deploy adapter or grant exists.' },
  'deploy.promote': { disposition: 'unavailable', reason: 'Promotion requires separate owner release authorization and an effect adapter.' },
  'deploy.rollback': { disposition: 'unavailable', reason: 'Rollback requires separate owner recovery authorization and an effect adapter.' },
  'deploy.review': { disposition: 'retired', reason: 'Shared Work owns signed review.' }
});
export const combinedLegacyInventory = Object.freeze({ ...lat06LegacyInventory, ...lat07LegacyInventory });
export const lat08CodeAdapters = [
  { id: 'platform_implement', layer: 'platform', owner: 'platform', kind: 'code_unit', operation: 'candidate', performers: ['agent'] },
  { id: 'platform_security', layer: 'platform', owner: 'work', kind: 'report', operation: 'report', performers: ['agent'] }
];
const baseLayers = [
  ...lat06LayerActions.filter(layer => layer.key !== 'platform'),
  ...lat07LayerActions.filter(layer => layer.key !== 'platform'),
  { ...lat06LayerActions.find(layer => layer.key === 'platform'),
    outputs: lat07LayerActions.find(layer => layer.key === 'platform').outputs,
    actions: [...lat06LayerActions.find(layer => layer.key === 'platform').actions, ...lat07LayerActions.find(layer => layer.key === 'platform').actions] }
];
// Every layer can inspect a newly installed neighbor and propose its own
// receiving policy. The action submits a report through Work; it cannot activate
// a connection, authorize itself, or write another layer's outputs.
const discoveryReads = baseLayers.flatMap(layer => layer.outputs.map(kind => ({ layer: layer.key, kind })));
const discoveryAction = layer => ({ key: 'discover', revision: 1, title: `Explore neighboring layers for ${layer.key}`,
  purpose: 'Examine installed neighbor output types and propose a receiving-layer connection policy for review.',
  result: { owner: 'work', kind: 'report', operation: 'report' }, adapter: `${layer.key}_discover`,
  permissions: { elevated: false, reads: discoveryReads, fileReads: ['**'], fileWrites: [], effects: ['submit-report'] },
  checks: ['Source output identity and revision are cited', 'The receiving-layer use and uncertainty are explicit', 'No policy is activated without review'],
  initialAssignee: { dreamer: 'agent', planner: 'agent', tinkerer: 'agent' }, requiredInputs: [], optionalInputs: ['installed-neighbor'],
  reviewer: 'project-owner', applicability: 'installed-layer',
  method: 'Inspect the named installed neighbor and its exact available outputs. Propose whether and how those outputs could inform this layer. Name missing evidence and change response. Submit for Work review; do not activate a connection.' });
export const compiledLocalActions = compileLayerActions(baseLayers.map(layer => ({ ...layer, actions: [...layer.actions, discoveryAction(layer)] })),
  { registeredAdapters: [...lat06Adapters, ...lat08CodeAdapters,
    ...baseLayers.map(layer => ({ id: `${layer.key}_discover`, layer: layer.key, owner: 'work', kind: 'report', operation: 'report', performers: ['agent'] }))] });
