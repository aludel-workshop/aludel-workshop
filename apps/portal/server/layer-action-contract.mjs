// Groundwork for LAT layer-owned actions. This validates declarations; the current
// role-backed Work runtime remains authoritative until the layer migration packets.
const keyPattern = /^[a-z][a-z0-9_]*$/;
const effectFor = { propose: 'submit-proposal', report: 'submit-report', candidate: 'commit-candidate', observe: 'record-observation' };
const styles = ['dreamer', 'planner', 'tinkerer'];
const fail = message => { throw new Error(message); };
const unique = values => new Set(values).size === values.length;
const keys = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
const scope = value => typeof value === 'string' && value.length > 0 && value.length <= 160 &&
  !value.startsWith('/') && !value.includes('\\') && !value.split('/').includes('..') && !value.includes('\0');

export function compileLayerActions(layers, { registeredAdapters = [] } = {}) {
  if (!Array.isArray(layers) || !layers.length || !Array.isArray(registeredAdapters)) fail('Layer action catalog needs layers and adapter IDs.');
  const layerKeys = layers.map(layer => layer?.key);
  if (!layerKeys.every(key => typeof key === 'string' && keyPattern.test(key)) || !unique(layerKeys)) fail('Layer keys must be unique.');
  const outputKinds = new Map(layers.map(layer => {
    if (!Array.isArray(layer.outputs) || !layer.outputs.length || !layer.outputs.every(kind => typeof kind === 'string' && keyPattern.test(kind)) || !unique(layer.outputs))
      fail(`Layer ${layer.key} needs unique output kinds.`);
    return [layer.key, new Set(layer.outputs)];
  }));
  const adapterIds = registeredAdapters.map(adapter => adapter?.id);
  if (!adapterIds.every(id => typeof id === 'string' && keyPattern.test(id)) || !unique(adapterIds) ||
      !registeredAdapters.every(adapter => Array.isArray(adapter.performers) && adapter.performers.length &&
        adapter.performers.every(performer => ['human', 'agent'].includes(performer)) && unique(adapter.performers)))
    fail('Adapters need unique IDs and named performers.');
  const adapters = new Map(registeredAdapters.map(adapter => [adapter.id, adapter]));
  const actions = [];
  for (const layer of layers) {
    if (!Array.isArray(layer.actions)) fail(`Layer ${layer.key} needs an action list.`);
    const actionKeys = layer.actions.map(action => action?.key);
    if (!actionKeys.every(key => typeof key === 'string' && keyPattern.test(key)) || !unique(actionKeys)) fail(`Layer ${layer.key} has invalid or duplicate action keys.`);
    for (const action of layer.actions) {
      const id = `${layer.key}.${action.key}`;
      if (!Number.isInteger(action.revision) || action.revision < 1) fail(`${id} needs a positive revision.`);
      const result = action.result;
      if (!result || !Object.hasOwn(effectFor, result.operation) || typeof result.kind !== 'string') fail(`${id} needs a typed result.`);
      const owner = result.owner || layer.key;
      if (owner === 'work') {
        if (result.kind !== 'report' || result.operation !== 'report') fail(`${id} has an unsupported Work result.`);
      } else if (owner !== layer.key || !outputKinds.get(owner)?.has(result.kind)) fail(`${id} cannot produce an output owned by another layer.`);
      const permissions = action.permissions;
      if (!permissions || typeof permissions.elevated !== 'boolean' || !Array.isArray(permissions.reads) || !Array.isArray(permissions.fileReads) ||
          !Array.isArray(permissions.fileWrites) || !Array.isArray(permissions.effects)) fail(`${id} needs explicit permissions.`);
      if (!permissions.reads.every(read => read && outputKinds.get(read.layer)?.has(read.kind))) fail(`${id} reads an undeclared layer output.`);
      if (![...permissions.fileReads, ...permissions.fileWrites].every(scope) ||
          !unique(permissions.fileReads) || !unique(permissions.fileWrites)) fail(`${id} has an unsafe or duplicate file scope.`);
      if (!unique(permissions.effects) || permissions.effects.length !== 1 || permissions.effects[0] !== effectFor[result.operation]) fail(`${id} requests an effect outside its result.`);
      if (permissions.fileWrites.length && result.operation !== 'candidate') fail(`${id} may write files only for a candidate result.`);
      if (typeof action.adapter !== 'string' || !keyPattern.test(action.adapter)) fail(`${id} needs a named output adapter.`);
      const adapter = adapters.get(action.adapter);
      if (adapter && (adapter.layer !== layer.key || adapter.owner !== owner || adapter.kind !== result.kind || adapter.operation !== result.operation))
        fail(`${id} has an adapter for a different output.`);
      const humanRunnable = Boolean(adapter?.performers.includes('human'));
      const agentRunnable = Boolean(adapter?.performers.includes('agent'));
      const defaults = action.initialAssignee;
      if (keys(defaults).sort().join() !== [...styles].sort().join() || !styles.every(style => ['human', 'agent'].includes(defaults[style])))
        fail(`${id} needs a human/agent seed for every work style.`);
      if (Object.values(defaults).includes('agent') && !agentRunnable) fail(`${id} cannot seed an agent without a registered adapter.`);
      if (permissions.elevated && Object.values(defaults).some(value => value !== 'human')) fail(`${id} must seed elevated work to a human.`);
      if (!Array.isArray(action.checks) || !action.checks.length || !action.checks.every(check => typeof check === 'string' && check.trim()))
        fail(`${id} needs review checks.`);
      actions.push({ ...action, id, layer: layer.key, result: { ...result, owner }, humanRunnable, agentRunnable });
    }
  }
  return actions;
}

export function seedActionAssignee(action, style, { humanId = null, agentId = null } = {}) {
  if (!styles.includes(style) || !action?.initialAssignee?.[style]) fail('Choose a known project work style and compiled action.');
  const kind = action.initialAssignee[style] === 'human' ? 'person' : 'agent';
  if (kind === 'person' && !action.humanRunnable || kind === 'agent' && !action.agentRunnable) return null;
  const id = kind === 'person' ? humanId : agentId;
  return id ? { kind, id } : null;
}
