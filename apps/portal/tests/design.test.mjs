// DESIGN-UX-01 (DEC-045): the Design layer's token set, component contracts, brand assets, Library references and
// documents shown in layers, and what the scaffold generates from them, at the domain layer.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUser, initAccounts } from '../server/accounts.mjs';
import { brandUsage, componentStatus, designFiles, tokenStyles } from '../server/design.mjs';
import { initKnowledge, knowledge } from '../server/knowledge.mjs';
import { initOnboarding, loadCatalogs, onboarding } from '../server/onboarding.mjs';
import { ensureProductWorkspace } from '../server/product-workspace.mjs';
import { skeletonFiles } from '../server/scaffold.mjs';
import { openSecretStore } from '../server/secret-store.mjs';
import { openDatabase } from '../server/storage.mjs';
import { initWorkflow } from '../server/workflow.mjs';
import { defaultTokens, paletteTone, roleColor, roleContrast, toDtcg, toneOf, tokenVariables } from '../src/design-tokens.js';

const configDirectory = new URL('../config', import.meta.url).pathname;
const catalogs = loadCatalogs(configDirectory);
const gitProfile = (config => config.sourceControlProfiles[config.defaultSourceControlProfile])(JSON.parse(readFileSync(join(configDirectory, 'project-setup.json'), 'utf8')));
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function fixture({ notes = 'Warm and neighbourly.' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aludel-design-'));
  const db = openDatabase(join(root, 'machine.sqlite'));
  initWorkflow(db); ensureProductWorkspace(db); initAccounts(db); initOnboarding(db); initKnowledge(db);
  const know = knowledge({ db, catalogs, packs: catalogs.packs });
  const flows = onboarding({ db, catalogs, secrets: openSecretStore(root), workspaceRoot: join(root, 'workspaces'), assetRoot: join(root, 'assets'), createWorkspace: () => {}, know });
  const ada = createUser(db, { email: 'ada@example.com', name: 'Ada', password: 'correct-horse-battery' });
  const { token } = flows.saveDraft(null, { profile: 'planner' });
  flows.saveDraft(token, { name: 'Tool Share', pitch: 'Neighbours lend and borrow tools they rarely use. No buying needed.' });
  const { project } = flows.claimDraft(token, ada, ada);
  flows.saveDesign(ada, project.id, { feel: 'editorial', theme: 'system', accent: '#2e7d5b', notes });
  return { root, db, know, flows, ada, id: project.id };
}

test('tone maths: tones follow L*, seeds keep their colour, and Material 3 roles meet AA in both modes', () => {
  const tokens = defaultTokens({ accent: '#2e7d5b', radius: 12 });
  const primary = tokens.palettes[0];
  for (const tone of [10, 30, 50, 70, 90]) assert.ok(Math.abs(toneOf(paletteTone({ ...primary, seedTone: -1 }, tone)) - tone) < 1.5, `tone ${tone} has L* ≈ ${tone}`);
  assert.equal(paletteTone(primary, primary.seedTone), '#2e7d5b', 'the seed is exact at its tone');
  assert.equal(paletteTone({ ...primary, pins: { 40: '#123456' } }, 40), '#123456', 'a pinned tone wins');
  for (const mode of ['light', 'dark']) for (const role of ['primary', 'secondary', 'tertiary', 'error', 'surface', 'primary-container']) assert.ok(roleContrast(tokens, role, mode) >= 4.5, `${role} (${mode}) meets AA`);
  assert.deepEqual(Object.values(tokens.corners), [0, 4, 8, 12, 16, 28, 9999], 'the feel radius sets the corner scale');
  const vars = tokenVariables(tokens);
  assert.equal(vars['--mat-sys-primary'], roleColor(tokens, 'primary'));
  assert.equal(vars['--mat-sys-corner-extra-small-top'], '4px 4px 0 0');
  assert.match(vars['--mat-sys-body-large'], /^400 16px \/ 24px /);
  assert.match(tokenStyles(tokens, 'system'), /--mat-sys-surface: light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\);/, 'system theme pairs light and dark');
  assert.doesNotMatch(tokenStyles(tokens, 'dark'), /light-dark/, 'a fixed theme uses one mode');
  const dtcg = toDtcg(tokens, 'Tool Share');
  assert.deepEqual(dtcg.color.primary.$value, '{palette.primary.40}');
  assert.equal(dtcg.color.primary.$extensions['org.aludel'].modes.dark, '{palette.primary.80}');
  assert.equal(dtcg.palette.primary['40'].$type, 'color');
  assert.equal(dtcg.palette.primary['40'].$value.colorSpace, 'srgb');
  assert.equal(dtcg.type['body-large'].$value.fontSize.unit, 'px');
  assert.ok(dtcg.palette.neutral['96'], 'tones roles use are exported even when not standard');
});

test('a project gets its token set, template contracts, starter brand and documents once; the Look & feel drives untouched tokens', () => {
  const { know, id, flows, ada } = fixture();
  know.ensureDesign(id); know.ensureDesign(id);
  const tokens = know.list(id, 'design_tokens');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].palettes[0].seed, '#2e7d5b');
  assert.match(tokens[0].faces.brand, /Georgia/, 'editorial feel sets serif faces');
  assert.equal(tokens[0].corners.medium, 4, 'editorial radius');
  const components = know.list(id, 'component');
  assert.ok(components.length >= 14);
  const navlist = components.find(component => component.name === 'Nav list');
  const navitem = components.find(component => component.name === 'Nav item');
  assert.equal(navitem.parentId, navlist.id, 'nav items nest in the nav list');
  assert.deepEqual(navlist.slots[0].accepts, [navitem.id], 'slots accept components by id');
  assert.equal(componentStatus(navlist), 'built');
  const brand = know.list(id, 'brand_asset');
  assert.deepEqual(brand.map(asset => asset.key), ['name', 'tagline', 'description', 'mark', null]);
  assert.equal(brand.find(asset => asset.key === 'tagline').text, 'Neighbours lend and borrow tools they rarely use.');
  assert.equal(brand.find(asset => asset.key === 'mark').mark.text, 'TS');
  const docs = know.view(ada, id).docs.filter(doc => doc.showsIn.includes('design'));
  assert.deepEqual(docs.map(doc => doc.title), ['Design direction', 'Accessibility baseline']);
  assert.match(docs[0].body, /Warm and neighbourly/, 'design notes become the direction');

  // Deleting a starter never brings it back.
  know.remove(id, brand.find(asset => asset.type === 'banner').id);
  know.ensureDesign(id);
  assert.equal(know.list(id, 'brand_asset').length, 4);

  // Untouched tokens follow the Look & feel; once edited, they don't.
  flows.saveDesign(ada, id, { feel: 'playful', theme: 'light', accent: '#7b3fe4', notes: '' });
  assert.equal(know.list(id, 'design_tokens')[0].palettes[0].seed, '#7b3fe4');
  const current = know.list(id, 'design_tokens')[0];
  know.update(id, current.id, { corners: { ...current.corners, medium: 20 }, fromLook: false }, { rationale: 'Rounder cards' });
  flows.saveDesign(ada, id, { feel: 'sleek-saas', theme: 'light', accent: '#3047b9', notes: '' });
  assert.equal(know.list(id, 'design_tokens')[0].corners.medium, 20, 'an edited token set is kept');
  assert.ok(know.view(ada, id).tokens.history.some(entry => entry.rationale === 'Rounder cards'), 'the token set is revisioned as a whole');
});

test('token, component and brand validation', () => {
  const { know, id } = fixture();
  know.ensureDesign(id);
  const tokens = know.list(id, 'design_tokens')[0];
  assert.throws(() => know.insert(id, 'design_tokens', defaultTokens()), /already has a token set/);
  assert.throws(() => know.update(id, tokens.id, { roles: [...tokens.roles, { id: 'brand', light: { palette: 'nope', tone: 40 }, dark: { palette: 'primary', tone: 80 } }] }), /palette that doesn't exist/);
  assert.throws(() => know.update(id, tokens.id, { faces: { brand: 'x; background:red', plain: 'Roboto' } }), /font names/);
  assert.throws(() => know.update(id, tokens.id, { type: tokens.type.slice(1) }), /fifteen type roles/);
  assert.throws(() => know.update(id, tokens.id, { elevation: tokens.elevation.map(level => level.level === 2 ? { ...level, fill: 'nope' } : level) }), /colour role/);
  const pinned = know.update(id, tokens.id, { palettes: tokens.palettes.map(palette => palette.key === 'primary' ? { ...palette, pins: { 40: '#115533' } } : palette) });
  assert.equal(roleColor(pinned, 'primary'), '#115533', 'a pinned tone reaches the role');

  const carousel = know.insert(id, 'component', { name: 'Carousel (large)', group: 'Containment', purpose: 'Featured items' });
  assert.equal(componentStatus(carousel), 'needed');
  const specified = know.update(id, carousel.id, { props: [{ key: 'peek', kind: 'boolean', default: true }], anatomy: [{ part: 'Item', tokens: ['corner.extra-large'] }] });
  assert.equal(componentStatus(specified), 'specified');
  assert.throws(() => know.update(id, carousel.id, { props: [{ key: 'size', kind: 'variant', options: ['S', 'L'], default: 'M' }] }), /one of its options/);
  assert.throws(() => know.update(id, carousel.id, { anatomy: [{ part: 'Item', tokens: ['url(javascript:1)'] }] }), /token path/);
  assert.throws(() => know.insert(id, 'component', { name: 'Child' }, { parentId: tokens.id }), /nests inside another component/);
  assert.throws(() => know.update(id, carousel.id, { slots: [{ name: 'items', accepts: ['cmp-00000000'], min: 1 }] }), /not found/);

  assert.throws(() => know.insert(id, 'brand_asset', { name: 'Another name', type: 'text', key: 'name', text: 'X' }), /already the app's name/);
  assert.throws(() => know.insert(id, 'brand_asset', { name: 'Mark', type: 'mark', mark: { text: 'TS', background: 'nope' } }), /doesn't exist/);
  assert.throws(() => know.insert(id, 'brand_asset', { name: 'Logo', type: 'image', assetId: 'asset-00000000-0000-0000-0000-000000000000' }), /upload was not found/);
  const added = know.addBrandTemplate({ name: 'Ada' }, id, 'email');
  assert.equal(added.length, 2);
  assert.equal(know.get(id, added[0]).banner.headline, 'Tool Share', 'template banners take the product name');
});

test('references point at a source or finding; image findings mark a region; documents show in layers', () => {
  const { know, id, flows, ada } = fixture();
  know.ensureDesign(id);
  const uploaded = flows.addAsset(ada, id, { filename: 'linear.png', dataUrl: pixel, notes: '', purpose: 'library' }).uploaded;
  assert.ok(!flows.projectSetup(ada, id).assets.some(asset => asset.id === uploaded), 'Library images are not onboarding reference media');
  assert.ok(!flows.projectAssets(id).some(asset => asset.id === uploaded), 'Library images never go into the app');
  const source = know.insert(id, 'source', { type: 'screenshot', title: 'Linear sidebar', assetId: uploaded });
  const finding = know.insert(id, 'finding', { sourceId: source.id, type: 'image', text: 'The active row uses a subtle font weight.', region: { x: 0.02, y: 0.2, w: 0.3, h: 0.06 } });
  assert.deepEqual(finding.region, { x: 0.02, y: 0.2, w: 0.3, h: 0.06 });
  assert.throws(() => know.insert(id, 'finding', { sourceId: source.id, type: 'image', text: 'x', region: { x: 0.9, y: 0, w: 0.5, h: 0.5 } }), /inside the image/);
  const navitem = know.list(id, 'component').find(component => component.name === 'Nav item');
  const byFinding = know.insert(id, 'evidence_link', { direction: 'references', sourceRef: finding.id, recordId: navitem.id });
  know.insert(id, 'evidence_link', { direction: 'references', sourceRef: source.id, recordId: navitem.id });
  assert.equal(byFinding.insightId, null);
  assert.throws(() => know.insert(id, 'evidence_link', { direction: 'references', sourceRef: navitem.id, recordId: navitem.id }), /not found/);
  assert.throws(() => know.insert(id, 'evidence_link', { direction: 'supports', sourceRef: finding.id, recordId: navitem.id }), /Choose an insight/);
  know.remove(id, finding.id);
  assert.equal(know.list(id, 'evidence_link').filter(link => link.recordId === navitem.id).length, 1, 'deleting a finding drops its references');

  const old = know.insert(id, 'doc', { title: 'Manifesto', body: 'Why' });
  assert.deepEqual(old.showsIn, ['product']);
  const moved = know.update(id, old.id, { showsIn: ['product', 'design', 'nowhere'] });
  assert.deepEqual(moved.showsIn, ['product', 'design']);
});

test('onboarding reference media move into the Library once', () => {
  const { know, id, flows, ada } = fixture();
  flows.addAsset(ada, id, { filename: 'moodboard.png', dataUrl: pixel, notes: 'The feel we want' });
  know.ensureDesign(id); know.ensureDesign(id);
  const sources = know.list(id, 'source').filter(source => source.assetId);
  assert.deepEqual(sources.map(source => [source.type, source.title, source.body]), [['screenshot', 'moodboard.png', 'The feel we want']]);
  assert.equal(flows.projectAssets(id).length, 1, 'the upload stays reference media for the scaffold');
});

test('the scaffold builds styles, token files and brand from the Design layer, and brand usage is read from the code', () => {
  const { know, id, flows, ada, root } = fixture();
  know.ensureDesign(id);
  const tokens = know.list(id, 'design_tokens')[0];
  const setup = { ...flows.projectSetup(ada, id), data: { objects: [], operations: [] }, agents: { principles: [], profiles: [], roles: [], project: '' },
    designSystem: { tokens, components: know.list(id, 'component').map(component => ({ ...component, status: componentStatus(component) })), brand: know.list(id, 'brand_asset') } };
  const sources = { pageBlocks: '', iconFont: Buffer.from(''), iconLicense: '' };
  const { files } = skeletonFiles(setup, catalogs, gitProfile, 'http://tool-share.localhost', [], sources);
  assert.match(files['src/styles.scss'], new RegExp(`--mat-sys-primary: light-dark\\(${roleColor(tokens, 'primary')}`));
  assert.match(files['src/styles.scss'], /--mat-sys-level3: 0 4px 8px/);
  assert.ok(JSON.parse(files['design/tokens.json']).color['on-primary']);
  assert.equal(JSON.parse(files['design/components.json']).components.find(component => component.name === 'Nav item').status, 'built');
  assert.match(files['public/favicon.svg'], /<svg[^>]+>.*TS<\/text><\/svg>/);
  assert.match(files['index.html'], /<title>Tool Share<\/title>/);
  assert.match(files['index.html'], /<meta name="description" content="Neighbours lend/);
  assert.match(files['index.html'], /rel="icon" href="\/favicon.svg"/);
  assert.match(files['src/site.ts'], /"pitch": "Neighbours lend and borrow tools they rarely use."/, 'the tagline is the pitch');
  assert.match(files['src/site.ts'], /"markText": "TS"/);
  assert.ok(files['public/brand/social-card.svg'].startsWith('<svg'));
  assert.equal(designFiles(setup.designSystem, 'Tool Share')['src/brand.ts'].includes('"tagline"'), true);

  const workspace = join(root, 'ws');
  mkdirSync(join(workspace, 'src'), { recursive: true });
  writeFileSync(join(workspace, 'src', 'footer.ts'), "import { brand } from './brand';\nexport const footer = brand.tagline;\n");
  writeFileSync(join(workspace, 'index.html'), '<link rel="icon" href="/favicon.svg">\n');
  const usage = brandUsage(workspace, know.list(id, 'brand_asset'));
  const tagline = know.list(id, 'brand_asset').find(asset => asset.key === 'tagline');
  const mark = know.list(id, 'brand_asset').find(asset => asset.key === 'mark');
  assert.deepEqual(usage[tagline.id], [{ path: 'src/footer.ts', line: 2 }]);
  assert.deepEqual(usage[mark.id], [{ path: 'index.html', line: 1 }]);
});
