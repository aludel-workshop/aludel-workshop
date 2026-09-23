// Lists classes a stylesheet section defines that earlier sections already define (WORK-UX-01 found five such collisions
// only by screenshot). Run before adding or after writing a section:
//   node tools/css-collisions.mjs "/* WORK-UX-01"          # the section starting at that marker, to the end of the file
// Exit code 1 when there are collisions; intended overrides can be ignored by eye.
import { readFileSync } from 'node:fs';

const marker = process.argv[2];
if (!marker) { console.error('Usage: node tools/css-collisions.mjs "<marker that starts the section>"'); process.exit(2); }
const css = readFileSync(new URL('../src/styles.scss', import.meta.url), 'utf8');
const start = css.indexOf(marker);
if (start < 0) { console.error(`Marker not found: ${marker}`); process.exit(2); }
const classes = text => new Set([...text.matchAll(/\.(lay-[a-z0-9-]+)/g)].map(match => match[1]));
const before = classes(css.slice(0, start));
const collisions = [...classes(css.slice(start))].filter(name => before.has(name)).sort();
for (const name of collisions) {
  const rule = new RegExp(`[^}]*\\.${name}(?![a-z0-9-])[^{]*\\{[^}]*\\}`).exec(css.slice(0, start))?.[0].trim() || '';
  console.log(`${name}\n    earlier: ${rule.slice(0, 140)}`);
}
if (collisions.length) process.exit(1);
console.log('No collisions.');
