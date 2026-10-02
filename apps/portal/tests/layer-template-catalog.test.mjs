import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { catalogFromPins } from '../server/layer-contract.mjs';

const config = JSON.parse(readFileSync(new URL('../config/layer-templates.json', import.meta.url), 'utf8'));
const base = resolve(new URL('../../..', import.meta.url).pathname);

test('installable layers come from the reviewed template pins', () => {
  const catalog = catalogFromPins(config, base);
  assert.deepEqual(catalog.map(layer => layer.key), Object.keys(config.builtIn));
  assert.ok(catalog.every(layer => layer.name && layer.path && layer.category && layer.icon && layer.description));
  assert.throws(() => catalogFromPins({ ...config, builtIn: { ...config.builtIn, product: 'unreviewed' } }, base), /Missing reviewed template pin/);
});

test('runtime catalog uses pins with templates on and retains compiled fallback with templates off', () => {
  const script = "import { layerCatalog } from './server/layer-contract.mjs'; process.stdout.write(JSON.stringify(layerCatalog.map(layer => layer.key)))";
  const run = on => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { ...process.env, MACHINE_LAYER_TEMPLATES_ENABLED: on ? '1' : '0', MACHINE_PAGES_TEMPLATE_ENABLED: '0' } }));
  assert.deepEqual(run(true), ['product', 'design', 'pages', 'data', 'platform', 'deploy']);
  const describe = "import { layerCatalog, layerDeclarations } from './server/layer-contract.mjs'; process.stdout.write(JSON.stringify({ catalog: layerCatalog, declarations: layerDeclarations }))";
  const runtime = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', describe], { cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { ...process.env, MACHINE_LAYER_TEMPLATES_ENABLED: '1' } }));
  const pin = catalogFromPins(config, base).find(layer => layer.key === 'product');
  assert.deepEqual(runtime.catalog.find(layer => layer.key === 'product'), pin);
  assert.deepEqual(runtime.declarations.find(layer => layer.key === 'product').outputs, ['vision_section','brief_claim','persona','phase','activity','step','story','spec','research','project']);
  assert.equal(runtime.catalog.find(layer => layer.key === 'deploy').name, 'Deploy', 'unconverted compiled choice remains available');
  assert.deepEqual(run(false), ['product', 'design', 'pages', 'data', 'platform', 'deploy']);
});
