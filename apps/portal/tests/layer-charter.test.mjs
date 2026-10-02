import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { initLayerContract } from '../server/layer-contract.mjs';
import { createMarkdownDefinition, addDomainAction, activateLayerDefinition, parseCharter, charterSections, projectLayerDefinition } from '../server/layer-registry.mjs';
import { layerDocumentRead, layerDocumentUpdate } from '../server/layer-space.mjs';

// CUSTOM-LAYER-01: identity is Knowledge. The charter is one editable Markdown document for built-in and custom layers alike.
test('the charter is a seeded, editable Knowledge document that drives activation', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);
    CREATE TABLE project_members(project_id TEXT,user_id TEXT,role TEXT);
    CREATE TABLE project_setup(project_id TEXT PRIMARY KEY,profile TEXT,created_by TEXT,workspace_path TEXT);
    CREATE TABLE knowledge_records(id TEXT PRIMARY KEY,project_id TEXT,kind TEXT,parent_id TEXT,revision INTEGER,data_json TEXT);
    CREATE TABLE layer_work_items(id TEXT PRIMARY KEY,project_id TEXT,layer TEXT,action TEXT,state TEXT,assignee_kind TEXT,assignee_id TEXT,context_json TEXT);
    CREATE TABLE routine_runs(project_id TEXT);
    INSERT INTO projects VALUES ('one');
    INSERT INTO project_setup VALUES ('one','planner','owner',NULL);
    INSERT INTO project_members VALUES ('one','owner','owner'),('one','reader','viewer');`);
  initLayerContract(db);
  createMarkdownDefinition(db, 'owner', 'one', { name: 'Research' });

  const seeded = layerDocumentRead(db, 'owner', 'one', 'research', 'identity');
  assert.equal(seeded.title, 'Charter');
  assert.equal(seeded.revision, 0);
  for (const label of Object.values(charterSections)) assert.match(seeded.content, new RegExp(`^## ${label}$`, 'm'), `seeded heading ${label}`);
  assert.deepEqual(Object.values(parseCharter(seeded.content)).filter(Boolean), [], 'prompts alone complete nothing');

  const written = seeded.content
    .replace('<!-- What is this layer trying to achieve? -->', 'Collect and interpret customer research for product decisions.')
    .replace(/<!-- What belongs here[^>]*-->/, 'Interviews, sources and synthesized findings; not roadmap decisions.')
    + '\n## Glossary\n\nJTBD: jobs to be done.\n';
  const saved = layerDocumentUpdate(db, 'owner', 'one', 'research', 'identity', { content: written, expectedRevision: 0 });
  assert.equal(saved.revision, 1);
  assert.match(saved.content, /## Glossary/, 'extra sections are kept as written');
  const definition = projectLayerDefinition(db, 'one', 'research');
  assert.equal(definition.identity.purpose, 'Collect and interpret customer research for product decisions.');
  assert.equal(definition.description, 'Collect and interpret customer research for product decisions.', 'the purpose becomes the layer description');
  assert.throws(() => layerDocumentUpdate(db, 'owner', 'one', 'research', 'identity', { content: written, expectedRevision: 0 }), { status: 409 });
  assert.throws(() => layerDocumentUpdate(db, 'reader', 'one', 'research', 'identity', { content: written, expectedRevision: 1 }), { status: 403 });

  addDomainAction(db, 'owner', 'one', 'research', { key: 'add_source', title: 'Add source', purpose: 'Capture a source.', method: 'Record the citation.', checks: ['Source recorded'] });
  assert.throws(() => activateLayerDefinition(db, 'owner', 'one', 'research'), { status: 409 }, 'five sections are still prompts');
  const complete = Object.entries(charterSections).map(([, label]) => `## ${label}\n\nA considered answer for ${label.toLowerCase()}.`).join('\n\n');
  layerDocumentUpdate(db, 'owner', 'one', 'research', 'identity', { content: `# Research charter\n\n${complete}`, expectedRevision: 1 });
  assert.equal(activateLayerDefinition(db, 'owner', 'one', 'research').lifecycle, 'active');

  // Built-in layers are editable templates: their seeded identity reads back as a charter and can be revised. With templates
  // on, Design's charter is its template's (T03-DESIGN); off, it is the host's built-in identity.
  const purpose = process.env.MACHINE_LAYER_TEMPLATES_ENABLED === '1' ? 'Own the app kit' : 'Maintain the design system';
  const design = layerDocumentRead(db, 'owner', 'one', 'design', 'identity');
  assert.match(design.content, new RegExp(`^## Purpose\\n+${purpose}`, 'm'));
  const revised = layerDocumentUpdate(db, 'owner', 'one', 'design', 'identity', { content: design.content.replace(purpose, `${purpose} (Tailwind-based)`), expectedRevision: design.revision });
  assert.equal(revised.revision, design.revision + 1);
  assert.match(projectLayerDefinition(db, 'one', 'design').identity.purpose, new RegExp(`^${purpose} \\(Tailwind-based\\)`));
});
