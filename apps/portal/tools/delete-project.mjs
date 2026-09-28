#!/usr/bin/env node
// Deletes a generated project from the local portal: every database row that depends on it (found by following
// foreign keys, so new tables are covered without editing this file), its workspace, uploaded assets, preview log, and its
// preview container and image when Docker is available.
// Local only: it never touches GitHub. Aludel's own project cannot be deleted. Dry run unless --yes is passed.
//   node tools/delete-project.mjs <project-id|slug>... [--yes] [--data <dir>]
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const apply = args.includes('--yes');
const dataFlag = args.indexOf('--data');
const dataDirectory = resolve(dataFlag >= 0 ? args[dataFlag + 1] : join(dirname(fileURLToPath(import.meta.url)), '..', '.data'));
const targets = args.filter((value, index) => !value.startsWith('--') && args[index - 1] !== '--data');
if (!targets.length) {
  console.error('Usage: node tools/delete-project.mjs <project-id|slug>... [--yes] [--data <dir>]');
  process.exit(2);
}

const databasePath = join(dataDirectory, 'machine.sqlite');
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);
const quote = name => `"${name.replaceAll('"', '""')}"`;
const columns = table => db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(row => row.name);
// children[parent] = [{ table, from, to }]: rows in `table` whose `from` column points at `parent.to`.
const children = {};
for (const table of tables) {
  for (const key of db.prepare(`PRAGMA foreign_key_list(${quote(table)})`).all()) {
    (children[key.table] ||= []).push({ table, from: key.from, to: key.to || 'rowid' });
  }
}
// Relationships the schema doesn't declare and that have no project column of their own.
const undeclared = [{ parent: 'knowledge_records', table: 'knowledge_revisions', from: 'record_id', to: 'id' }];
for (const { parent, ...link } of undeclared) if (tables.includes(parent) && tables.includes(link.table)) (children[parent] ||= []).push(link);

const counts = {};
// Delete dependents before the rows they point at. `path` stops self- or mutually-referencing tables from looping.
function remove(table, where, params, path = []) {
  if (path.includes(table)) return;
  for (const child of children[table] || []) {
    remove(child.table, `${quote(child.from)} IN (SELECT ${quote(child.to)} FROM ${quote(table)} WHERE ${where})`, params, [...path, table]);
  }
  const { changes } = db.prepare(`DELETE FROM ${quote(table)} WHERE ${where}`).run(...params);
  if (changes) counts[table] = (counts[table] || 0) + Number(changes);
}

const projects = targets.map(target => {
  const project = db.prepare('SELECT id, slug, name FROM projects WHERE id = ? OR slug = ?').get(target, target);
  if (!project) throw new Error(`No project with id or slug "${target}".`);
  if (project.id === 'the-machine') throw new Error("Aludel's own project cannot be deleted.");
  return project;
});

// VACUUM INTO includes changes still in the WAL, which a plain file copy would miss.
if (apply) db.prepare('VACUUM INTO ?').run(`${databasePath}.before-delete-${Date.now()}`);
db.exec('BEGIN');
try {
  for (const project of projects) {
    // Tables that carry a project column without a declared foreign key.
    for (const table of tables) {
      for (const column of columns(table).filter(name => name === 'project_id' || name.endsWith('_project_id'))) {
        if (table !== 'projects') remove(table, `${quote(column)} = ?`, [project.id]);
      }
    }
    remove('projects', 'id = ?', [project.id]);
  }
  const broken = db.prepare('PRAGMA foreign_key_check').all();
  if (broken.length) throw new Error(`Deleting would leave ${broken.length} dangling references (first: ${JSON.stringify(broken[0])}).`);
  db.exec(apply ? 'COMMIT' : 'ROLLBACK');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const files = projects.flatMap(({ id }) => [join(dataDirectory, 'workspaces', id), join(dataDirectory, 'project-assets', id),
  join(dataDirectory, 'preview-logs', `${id}.log`)]).filter(path => existsSync(path));
if (apply) for (const path of files) rmSync(path, { recursive: true, force: true });
const docker = (...values) => spawnSync('docker', values, { encoding: 'utf8', timeout: 30000 });
const containers = []; const images = [];
if (docker('info', '--format', '{{.ServerVersion}}').status === 0) {
  for (const { id } of projects) {
    containers.push(...docker('ps', '-aq', '--filter', `label=aludel.project=${id}`).stdout.trim().split('\n').filter(Boolean));
    if (docker('image', 'inspect', `aludel-preview/${id}`).status === 0) images.push(`aludel-preview/${id}`);
  }
  if (apply && containers.length) docker('rm', '-f', ...containers);
  if (apply && images.length) docker('image', 'rm', '-f', ...images);
}

console.log(`${apply ? 'Deleted' : 'Would delete'}: ${projects.map(project => `${project.name} (${project.id})`).join(', ')}`);
console.log('Rows:', counts);
console.log('Files:', files.length ? files : 'none');
console.log('Containers:', containers.length, 'Images:', images.length ? images : 'none');
if (!apply) console.log('Dry run. Pass --yes to delete; the database is copied beside itself first.');
