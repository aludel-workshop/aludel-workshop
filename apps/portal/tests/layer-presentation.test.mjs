import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { initLayerContract, layerInstances } from '../server/layer-contract.mjs';
import { createMarkdownDefinition, saveLayerPresentation, layerIcons, layerColors, readableLayerColour } from '../server/layer-registry.mjs';

// Manage › Settings: built-in layers are editable templates, so every layer can change its name, icon and colour.
test('layer presentation is owner-only, validated and shared by built-in and custom layers', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
    CREATE TABLE project_members(project_id TEXT,user_id TEXT,role TEXT);
    CREATE TABLE project_setup(project_id TEXT PRIMARY KEY,profile TEXT,created_by TEXT,workspace_path TEXT);
    INSERT INTO projects VALUES ('one');
    INSERT INTO project_setup VALUES ('one','planner','owner',NULL);
    INSERT INTO project_members VALUES ('one','owner','owner'),('one','reader','viewer');`);
  initLayerContract(db);
  createMarkdownDefinition(db, 'owner', 'one', { name: 'Research' });
  createMarkdownDefinition(db, 'owner', 'one', { name: 'Notes' });

  const renamed = saveLayerPresentation(db, 'owner', 'one', 'research', { name: 'Field research', icon: 'science', color: layerColors[5] });
  assert.equal(renamed.name, 'Field research');
  assert.equal(renamed.icon, 'science');
  assert.equal(renamed.color, layerColors[5]);
  assert.equal(layerInstances(db, 'owner', 'one').find(layer => layer.key === 'research').color, layerColors[5], 'instances carry the colour to the client');

  const pages = saveLayerPresentation(db, 'owner', 'one', 'pages', { name: 'Screens', icon: 'map', color: '#1D4ED8' });
  assert.equal(pages.icon, 'map');
  assert.equal(pages.name, 'Screens', 'built-in layers can be renamed');
  assert.equal(pages.color, '#1d4ed8', 'any readable custom colour is kept, normalised');
  assert.equal(saveLayerPresentation(db, 'owner', 'one', 'pages', { color: null }).color, null, 'null restores the default colour');

  assert.throws(() => saveLayerPresentation(db, 'owner', 'one', 'research', { name: 'notes' }), { status: 409 });
  assert.throws(() => saveLayerPresentation(db, 'owner', 'one', 'research', { icon: 'not_an_icon' }), /icon from the list/);
  assert.throws(() => saveLayerPresentation(db, 'owner', 'one', 'research', { color: '#ffcc00' }), /readable/, 'white text on yellow fails 4.5:1');
  assert.throws(() => saveLayerPresentation(db, 'owner', 'one', 'research', { color: 'red' }), /readable/);
  assert.throws(() => saveLayerPresentation(db, 'reader', 'one', 'research', { icon: 'map' }), { status: 403 });
  assert.throws(() => saveLayerPresentation(db, 'owner', 'one', 'missing', { icon: 'map' }), { status: 404 });
});

// A picked icon the font subset lacks would render as its literal name; the suggested palette must itself be readable.
test('offered icons are the font subset and suggested colours pass contrast', () => {
  const { icons } = JSON.parse(readFileSync(new URL('../src/icon-subset.json', import.meta.url), 'utf8'));
  assert.deepEqual(layerIcons, icons);
  assert.deepEqual(layerColors.filter(colour => !readableLayerColour(colour)), []);
});

// The Settings picker offers exactly what the server accepts.
test('the Manage picker lists match the server allowlists', () => {
  const source = readFileSync(new URL('../src/layers/layer-manage.ts', import.meta.url), 'utf8');
  const list = name => JSON.parse(source.match(new RegExp(`export const ${name} = (\\[[^\\]]*\\]);`))[1].replace(/'/g, '"'));
  assert.match(source, /import iconSubset from '\.\.\/icon-subset\.json'/, 'the picker reads the same icon file the server validates against');
  assert.deepEqual(list('pickerColours'), layerColors);
});
