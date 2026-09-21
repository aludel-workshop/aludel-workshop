import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { getProjectBrand, updateProjectBrand } from '../server/project-brand.mjs';
import { openDatabase } from '../server/storage.mjs';

test('project brand copy and artwork are project-owned and replaceable', () => {
  const root = mkdtempSync(join(tmpdir(), 'aludel-brand-'));
  const db = openDatabase(join(root, 'data', 'test.sqlite'));
  const initial = getProjectBrand(db, 'the-machine');
  assert.equal(initial.name, 'Aludel');
  assert.equal(initial.tagline, 'Turn ideas into what’s next.');

  const bytes = Buffer.from('bounded image fixture');
  const updated = updateProjectBrand(db, join(root, 'assets'), 'the-machine', {
    name: 'Next name', description: 'A replaceable project identity.', tagline: 'A new line.',
    accentColor: '#123abc', heroImageDataUrl: `data:image/png;base64,${bytes.toString('base64')}`
  });
  assert.equal(updated.name, 'Next name');
  assert.equal(updated.accent_color, '#123abc');
  const stored = join(root, 'assets', 'the-machine', updated.hero_image_path.split('/').pop());
  assert.equal(existsSync(stored), true);
  assert.deepEqual(readFileSync(stored), bytes);
  assert.equal(updateProjectBrand(db, join(root, 'assets'), 'missing-project', { name: 'Nope' }), null);
  assert.throws(() => updateProjectBrand(db, join(root, 'assets'), 'the-machine', { accentColor: 'red' }), /six-digit/);
  assert.throws(() => updateProjectBrand(db, join(root, 'assets'), 'the-machine', { heroImageDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }), /PNG, JPEG, or WebP/);
  db.close();
  const reopened = openDatabase(join(root, 'data', 'test.sqlite'));
  assert.equal(getProjectBrand(reopened, 'the-machine').name, 'Next name', 'startup must not overwrite an owner-edited brand');
  reopened.close();
});
