import { LayerInstance } from './context';

// CUSTOM-LAYER-01 layer bar: one row per layer. Output tabs come first and belong to the layer's editor adapter;
// Tasks and Manage are the same for every layer. Aliases keep older links on the tab they used to open.
interface OutputTabs { tabs: [string, string][]; aliases?: Record<string, string> }
const outputTabs: Record<string, OutputTabs> = {
  'native:product': { tabs: [['brief', 'Brief'], ['map', 'Story map'], ['docs', 'Documents']], aliases: { vision: 'brief' } },
  'native:design': { tabs: [['tokens', 'Tokens'], ['components', 'Components'], ['brand', 'Brand'], ['docs', 'Docs']] },
  'native:pages': { tabs: [['map', 'Map'], ['page', 'Pages'], ['flows', 'Flows']], aliases: { tree: 'page' } },
  'native:data': { tabs: [['objects', 'Objects'], ['api', 'API'], ['access', 'Access']] },
  'native:platform': { tabs: [['overview', 'Overview'], ['explorer', 'Explorer'], ['tests', 'Tests'], ['docs', 'Docs'], ['releases', 'Releases']],
    aliases: { architecture: 'overview', code: 'explorer', repository: 'releases' } },
  'native:deploy': { tabs: [['environments', 'Environments'], ['variables', 'Variables'], ['integrations', 'Integrations'], ['agents', 'Agents'], ['data', 'Data']],
    aliases: { database: 'data', domains: 'integrations' } },
  'markdown-editor': { tabs: [['files', 'Files']], aliases: { editor: 'files' } }
};
export const layerSpaces = ['tasks', 'knowledge', 'manage'];

export function layerOutputTabs(layer: LayerInstance | null): [string, string][] {
  if (layer?.outputTabs?.length) return layer.outputTabs.map(tab => [tab.key,tab.label]);
  return layer ? outputTabs[layer.editorAdapter]?.tabs || [] : [];
}
// The output tab a URL segment opens: its own slug, an alias, or the layer's first tab.
export function activeOutputTab(layer: LayerInstance | null, segment: string | undefined): string {
  const entry = layer?.outputTabs?.length ? { tabs: layer.outputTabs.map(tab => [tab.key,tab.label] as [string,string]) } : layer ? outputTabs[layer.editorAdapter] : undefined;
  if (!entry || (segment && layerSpaces.includes(segment))) return '';
  if (segment && entry.tabs.some(([slug]) => slug === segment)) return segment;
  return (segment && entry.aliases?.[segment]) || entry.tabs[0]?.[0] || '';
}

// Old Operations / Setup / Manage › Knowledge links, rewritten to Tasks, Knowledge and Manage.
export function legacyLayerPath(segments: string[]): string[] | null {
  const [layer, space, section, id] = segments;
  if (space === 'operations') {
    if (section === 'connections') return [layer, 'manage', 'connections', ...(id ? [id] : [])];
    if (section === 'routines' || section === 'actions') return [layer, 'tasks', section, ...(id ? [id] : [])];
    return [layer, 'tasks'];
  }
  if (space === 'manage' && section === 'knowledge') return [layer, 'knowledge', ...(id ? [id] : [])];
  if (space === 'setup') return [layer, 'manage', 'activate'];
  return null;
}

// The charter's named sections (server/layer-registry.mjs charterSections). Activation needs each to say something
// (12 characters, as the server checks) and at least one action.
export const charterSections: [string, string][] = [['purpose', 'Purpose'], ['scope', 'Contents and scope'], ['methodology', 'Methodology'],
  ['outputConventions', 'Output conventions and taxonomy'], ['qualityBar', 'Quality bar'], ['projectRole', 'Role in the project'], ['collaboration', 'How this layer works with others']];
export interface SetupProgress { sections: { key: string; label: string; done: boolean }[]; action: boolean; done: number; total: number; remaining: number }
export function setupProgress(layer: LayerInstance | null): SetupProgress | null {
  if (!layer || layer.lifecycle !== 'draft') return null;
  const sections = charterSections.map(([key, label]) => ({ key, label, done: (layer.identity?.[key] || '').trim().length >= 12 }));
  const action = !!layer.domainActions?.length;
  const total = sections.length + 1, done = sections.filter(item => item.done).length + (action ? 1 : 0);
  return { sections, action, done, total, remaining: total - done };
}

// A chosen colour overrides the layer's palette class; custom layers without one use a neutral slate.
export function layerColourStyle(layer: LayerInstance | null): Record<string, string> {
  const colour = layer?.color || (layer && !layer.builtIn ? '#475467' : '');
  return colour ? { '--lc': colour, '--lb': `color-mix(in srgb, ${colour} 14%, #fff)` } : {};
}
