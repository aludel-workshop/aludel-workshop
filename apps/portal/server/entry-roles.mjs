// LAYER-BINDINGS-01 step 3, R3: what each entry is in this project. An entry's facet comes from its layer's declared facets;
// that facet's role comes from the binding it takes part in, while the binding is in force (reconciling, active or paused;
// a proposal binds nothing yet). The host attaches this to Library entries and layer API reads, and refuses a person's or
// agent's write to an entry in a replica or ceded facet: those change only through the binding's imports, and a change
// is proposed in the authority instead.
import { roleOf, validateFacets } from './bindings.mjs';
import { layerPackageForProject } from './layer-package.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const inForce = new Set(['reconciling', 'active', 'paused']);

export function entryRoles(db) {
  const hasBindings = () => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'layer_bindings'").get();
  const bindings = projectId => hasBindings() ? db.prepare('SELECT id, lifecycle, state_json FROM layer_bindings WHERE project_id = ?').all(projectId)
    .filter(row => inForce.has(row.lifecycle)).map(row => ({ ...JSON.parse(row.state_json), id: row.id, lifecycle: row.lifecycle })) : [];
  const manifestOf = (projectId, key) => { try { return layerPackageForProject(db, projectId, key)?.manifest || null; } catch { return null; } };

  // One resolver per request: facets and bindings are read once.
  function resolver(projectId) {
    const live = bindings(projectId), layers = new Map();
    const layer = key => {
      if (!layers.has(key)) {
        const manifest = manifestOf(projectId, key);
        let facets = [];
        try { facets = manifest ? validateFacets(manifest) : []; } catch { facets = []; }
        layers.set(key, { key, name: manifest?.name || key, outputs: manifest?.outputs || [], facets });
      }
      return layers.get(key);
    };
    // { facet, role, binding, authority: { participant, layer, facet, name } } | null when the entry is in no facet.
    const of = (key, entry) => {
      const found = layer(key);
      if (!found.facets.length) return null;
      const role = roleOf(found, entry, live);
      if (role?.authority) role.authority = { ...role.authority, name: layer(role.authority.layer).name };
      return role;
    };
    // Every facet of a layer with its role, for the layer's own views: { key, title, kinds, role, binding, authority }.
    const facets = key => layer(key).facets.map(facet => {
      const binding = live.find(item => item.participants.some(p => p.layer.key === key && p.facet === facet.key));
      if (!binding) return { key: facet.key, title: facet.title, kinds: facet.kinds, role: null, binding: null, authority: null };
      const self = binding.participants.find(p => p.layer.key === key && p.facet === facet.key);
      const hub = binding.participants.find(p => p.id === binding.authority);
      return { key: facet.key, title: facet.title, kinds: facet.kinds, role: self.role, binding: binding.id,
        authority: { participant: hub.id, layer: hub.layer.key, facet: hub.facet, name: layer(hub.layer.key).name } };
    });
    return { of, layer, live, facets };
  }

  // A person's or agent's writes to a layer, before they apply: none may touch an entry in a replica or ceded facet,
  // as it is now or as the write would leave it.
  function guard(projectId, key, writes, loaded = new Map()) {
    const roles = resolver(projectId);
    if (!roles.live.length) return;
    for (const write of writes) {
      const before = loaded.get(write.id);
      for (const entry of [before && { kind: before.kind, data: before.data }, write.op !== 'delete' && { kind: write.kind, data: write.data }].filter(Boolean)) {
        const role = roles.of(key, entry);
        if (role && ['replica', 'ceded'].includes(role.role))
          fail(`Managed in ${role.authority.name}'s ${role.authority.facet}. Propose a change there.`, 409);
      }
    }
  }
  return { resolver, guard };
}

// References into entries: any string in another layer's entry data that equals one of `refs`. Records name each other by
// ID in their data, so this finds every reference without the layer declaring its reference fields.
export function referencesTo(entries, refs, { exceptLayer = null } = {}) {
  const wanted = new Set(refs), found = [];
  const walk = (value, hit) => {
    if (typeof value === 'string') { if (wanted.has(value)) hit(value); return; }
    if (Array.isArray(value)) { for (const item of value) walk(item, hit); return; }
    if (value && typeof value === 'object') for (const item of Object.values(value)) walk(item, hit);
  };
  for (const entry of entries) {
    if (entry.layer?.key === exceptLayer) continue;
    const seen = new Set();
    walk(entry.data, to => { if (!seen.has(to) && to !== entry.ref) { seen.add(to); found.push({ layer: entry.layer.key, entry: entry.ref, to }); } });
  }
  return found.sort((a, b) => a.layer.localeCompare(b.layer) || a.entry.localeCompare(b.entry) || a.to.localeCompare(b.to));
}
