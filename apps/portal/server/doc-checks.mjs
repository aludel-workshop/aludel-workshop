// T03-CODE (G-CODE): checks on a layer's docs, for every layer. Pure over text: the caller reads the docs.
// - broken: relative Markdown links that point at nothing (web links and anchors are not checked);
// - sections: each heading with the Library entries it was written from (a sources sidecar), current, changed or gone;
// - onMap: whether a map doc (an app's AGENTS.md) names the doc, or a folder that holds it.
import { posix } from 'node:path';

export function sections(text) {
  const out = []; let fence = false;
  String(text || '').split('\n').forEach((line, index) => {
    if (/^```/.test(line)) fence = !fence;
    const match = !fence && /^(#{1,3})\s+(.+?)\s*#*$/.exec(line);
    if (match) out.push({ heading: match[2], level: match[1].length, line: index + 1 });
  });
  return out;
}

export function brokenLinks(path, text, exists) {
  const out = [];
  for (const match of String(text || '').matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^[a-z]+:|^#|^mailto:/i.test(target)) continue;
    const resolved = posix.normalize(posix.join(posix.dirname(path), target.split('#')[0]));
    if (!exists(resolved)) out.push(target);
  }
  return out;
}

// A doc is on the map when the map names it, or a folder that holds it.
export function onMapOf(map, mapPath = 'AGENTS.md') {
  const names = target => new RegExp(`(^|[\\s\`(\\[])${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s\`)\\]:,]|\\.?$|\\.\\s)`, 'm').test(map || '');
  return path => path === mapPath || names(path) || path.split('/').slice(0, -1).some((_, index, parts) => names(parts.slice(0, index + 1).join('/') + '/'));
}

// Each section with its recorded sources and their state against the current revisions (`revisionOf(id)`: a number,
// null when the source has no revision, undefined when it is gone).
export function sourcedSections(text, recorded = {}, revisionOf = () => null) {
  return sections(text).map(section => {
    const sources = (recorded[section.heading] || []).map(([kind, id, revision]) => {
      const current = kind === 'finding' || revision == null ? null : revisionOf(id);
      return { kind, id, revision: revision ?? null, current, state: current === undefined ? 'gone' : current !== null && revision !== null && current > revision ? 'changed' : 'current' };
    });
    return { ...section, sources, state: sources.some(source => source.state !== 'current') ? 'refresh' : sources.length ? 'current' : 'plain' };
  });
}

// All checks over a set of docs: `docs` is [{ path, text }], `exists(path)` answers for any repository path.
export function docChecks(docs, { exists, map = null, mapPath = null, sidecar = null, revisionOf = () => null } = {}) {
  const onMap = mapPath ? onMapOf(map, mapPath) : () => true;
  const checked = docs.map(doc => {
    const list = sourcedSections(doc.text, sidecar?.[doc.path] || {}, revisionOf);
    return { path: doc.path, sections: list, onMap: onMap(doc.path), broken: brokenLinks(doc.path, doc.text, exists), refresh: list.filter(section => section.state === 'refresh').length };
  });
  return { docs: checked, checks: { offMap: checked.filter(doc => !doc.onMap).map(doc => doc.path), broken: checked.flatMap(doc => doc.broken.map(target => `${doc.path} → ${target}`)),
    refresh: checked.reduce((count, doc) => count + doc.refresh, 0) } };
}
