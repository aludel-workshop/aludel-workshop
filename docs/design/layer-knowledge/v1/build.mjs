// Inlines ../specs/*.json into src.html, writing index.html. Run: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const here = new URL('.', import.meta.url);
const spec = name => JSON.parse(readFileSync(new URL(`../specs/${name}.json`, here), 'utf8'));
const layers = Object.fromEntries(['pages', 'design', 'vision', 'personas', 'branding'].map(key => [key, spec(key)]));
const data = JSON.stringify({ layers, project: spec('project') }).replace(/</g, '\\u003c');
writeFileSync(new URL('index.html', here), readFileSync(new URL('src.html', here), 'utf8').replace('/*DATA*/', () => data));
console.log('index.html written');
