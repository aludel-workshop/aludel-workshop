import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { aludelProjectId, requireMember } from './accounts.mjs';
import { reservedSlugs, slugify } from './hosts.mjs';
import { getProductWorkspace, saveProductRecord } from './product-workspace.mjs';
import { loadAgentDefaults, loadStoryPacks } from './knowledge.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const now = () => new Date().toISOString();
const digest = value => createHash('sha256').update(value).digest('hex');
const draftMaxAge = 60 * 60 * 24 * 7;
const parse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const imageTypes = new Map([['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp']]);
const documentTypes = new Map([['text/markdown', 'md'], ['text/plain', 'txt']]);
// Aludel's own project is operated like a Planner by default: the owner shapes intent and authorizes agent work.
const aludelDefaultProfile = 'planner';

const checkMessage = (definition, checked) => checked.reason === 'rejected'
  ? `${definition.label} rejected this key. It may be mistyped, disabled, deleted or expired. Create a new one and paste it again.`
  : checked.reason === 'unreachable' ? `Aludel couldn't reach ${definition.label} to check the key. Try again in a moment.`
    : `${definition.label} answered with an error (${checked.status}) while checking the key. Try again, or check your account's billing and limits.`;

export function loadCatalogs(configDirectory) {
  const read = name => JSON.parse(readFileSync(join(configDirectory, name), 'utf8'));
  const profiles = read('interaction-profiles.json');
  const starter = read('starter-kit.json');
  const stacks = read('stack-presets.json');
  const pages = read('page-types.json');
  const routeIcons = starter.routeIcons.map(item => item.icon);
  for (const [id, feel] of Object.entries(starter.feels)) {
    if (!['sidebar', 'top'].includes(feel.navigation) || !pages.types[feel.samplePage]) throw new Error(`Feel ${id} needs a navigation position and sample page.`);
    for (const route of feel.seedRoutes) if (!routeIcons.includes(route.icon) || !pages.types[route.pageType]) throw new Error(`Feel ${id} seeds an unknown icon or page type.`);
  }
  for (const [id, profile] of Object.entries(profiles.profiles)) {
    for (const [key, definition] of Object.entries(profiles.preferences)) {
      if (!(profile.defaults[key] in definition.values)) throw new Error(`Profile ${id} has an invalid default for ${key}.`);
    }
  }
  if (!stacks.presets[stacks.default]?.available) throw new Error('The default stack preset must be available.');
  for (const [type, rule] of Object.entries(profiles.automation?.workTypes || {})) {
    const values = Object.keys(profiles.preferences[rule.preference]?.values || {});
    if (!values.length || values.some(value => !['you', 'agent', 'agent-review'].includes(rule.modes?.[value]))) throw new Error(`Automation for ${type} needs a mode for every ${rule.preference} value.`);
  }
  return { preferences: profiles.preferences, profiles: profiles.profiles, feels: starter.feels, features: starter.features, packs: loadStoryPacks(configDirectory), stacks,
    pageTypes: pages.types, routeIcons, defaultRoute: starter.defaultRoute, services: read('story-packs.json').services || {}, agentDefaults: loadAgentDefaults(configDirectory),
    automation: profiles.automation, routines: read('routines.json').routines, agentProviders: loadAgentProviders(configDirectory) };
}

export function initOnboarding(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS onboarding_drafts (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, profile TEXT, name TEXT NOT NULL DEFAULT '', pitch TEXT NOT NULL DEFAULT '',
      claimed_project_id TEXT REFERENCES projects(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_setup (
      project_id TEXT PRIMARY KEY REFERENCES projects(id), profile TEXT NOT NULL, overrides_json TEXT NOT NULL DEFAULT '{}',
      feel TEXT, theme TEXT NOT NULL DEFAULT 'system', design_notes TEXT NOT NULL DEFAULT '',
      stack_preset TEXT, stack_options_json TEXT NOT NULL DEFAULT '{}', feature_records_json TEXT NOT NULL DEFAULT '{}',
      workspace_path TEXT, completed_steps_json TEXT NOT NULL DEFAULT '[]', created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_assets (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), kind TEXT NOT NULL CHECK(kind IN ('image', 'document')),
      filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, stored_name TEXT NOT NULL, notes TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_connections (
      project_id TEXT NOT NULL REFERENCES projects(id), kind TEXT NOT NULL, provider TEXT NOT NULL, label TEXT NOT NULL,
      secret_encrypted TEXT, secret_hint TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(project_id, kind)
    );
    CREATE INDEX IF NOT EXISTS idx_assets_project ON project_assets(project_id);
  `);
  const setupColumns = new Set(db.prepare('PRAGMA table_info(project_setup)').all().map(column => column.name));
  if (!setupColumns.has('routes_json')) db.exec('ALTER TABLE project_setup ADD COLUMN routes_json TEXT');
  if (!setupColumns.has('navigation')) db.exec('ALTER TABLE project_setup ADD COLUMN navigation TEXT');
  db.prepare('DELETE FROM onboarding_drafts WHERE claimed_project_id IS NULL AND expires_at < ?').run(now());
}

// LAY-04D: people connect their own Anthropic or OpenAI API key (config/agent-providers.json). The owner chose pasted
// keys over a third-party broker; Anthropic and OpenAI offer no way for another app to create a key for a user.
export function loadAgentProviders(configDirectory) {
  const { providers, retired } = JSON.parse(readFileSync(join(configDirectory, 'agent-providers.json'), 'utf8'));
  for (const [id, provider] of Object.entries(providers)) {
    if (!provider.keyPattern || !provider.check?.url || !provider.steps?.length || !/^https:\/\//.test(provider.keyUrl)) throw new Error(`Agent provider ${id} is incomplete.`);
    provider.pattern = new RegExp(provider.keyPattern);
    provider.rejections = (provider.reject || []).map(rule => ({ pattern: new RegExp(rule.pattern), message: rule.message }));
  }
  return { providers, retired: retired || {} };
}

// A key is checked by listing the provider's models: it proves the key works and spends nothing. The key goes only to
// the provider (never to logs or errors). MACHINE_*_API_URL points the check at a proxy or a test stand-in.
export function agentKeyChecker(env = process.env, request = fetch) {
  return async (provider, key) => {
    const base = env[provider.check.env];
    const url = base ? `${base.replace(/\/$/, '')}${provider.check.path}` : provider.check.url;
    const headers = Object.fromEntries(Object.entries(provider.check.headers).map(([name, value]) => [name, value.replace('$KEY', key)]));
    let response;
    try { response = await request(url, { headers, signal: AbortSignal.timeout(10000) }); }
    catch { return { ok: false, reason: 'unreachable' }; }
    if (response.ok) return { ok: true };
    return { ok: false, reason: [401, 403].includes(response.status) ? 'rejected' : 'error', status: response.status };
  };
}

export function onboarding({ db, catalogs, secrets, workspaceRoot, assetRoot, createWorkspace, know, checkAgentKey = agentKeyChecker() }) {
  const agentProviders = catalogs.agentProviders.providers;
  const draftRow = token => token ? db.prepare('SELECT * FROM onboarding_drafts WHERE token_hash = ? AND expires_at > ?').get(digest(token), now()) : null;
  const draftView = row => row && { profile: row.profile, name: row.name, pitch: row.pitch, claimedProjectId: row.claimed_project_id };

  function effectivePreferences(profile, overrides) {
    const defaults = catalogs.profiles[profile]?.defaults || catalogs.profiles.dreamer.defaults;
    return { ...defaults, ...overrides };
  }

  function validateProfile(profile) {
    if (!catalogs.profiles[profile]) fail('Choose Dreamer, Planner or Tinkerer.');
    return profile;
  }

  function validateIdea({ name, pitch }) {
    const cleanName = String(name || '').trim();
    const cleanPitch = String(pitch || '').trim().replace(/\s+\n/g, '\n');
    if (!cleanName || cleanName.length > 60) fail('Give your app a name (up to 60 characters).');
    if (cleanPitch.length < 10) fail('Describe what your app does in a sentence or two.');
    if (cleanPitch.length > 600) fail('Keep the elevator pitch to a short paragraph (600 characters).');
    return { name: cleanName, pitch: cleanPitch };
  }

  function uniqueSlug(name) {
    const base = slugify(name);
    for (let index = 1; index < 500; index++) {
      const candidate = index === 1 ? base : `${base.slice(0, 28)}-${index}`;
      if (!reservedSlugs.has(candidate) && !db.prepare('SELECT 1 FROM projects WHERE slug = ?').get(candidate)) return candidate;
    }
    fail('Could not find a free address for this app. Try another name.', 409);
  }

  function setupRow(projectId) {
    let row = db.prepare('SELECT * FROM project_setup WHERE project_id = ?').get(projectId);
    if (!row && projectId === aludelProjectId) {
      const created = now();
      db.prepare(`INSERT INTO project_setup(project_id, profile, workspace_path, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)`)
        .run(projectId, aludelDefaultProfile, created, created);
      row = db.prepare('SELECT * FROM project_setup WHERE project_id = ?').get(projectId);
    }
    if (!row) fail('Project not found.', 404);
    return row;
  }

  function markStep(projectId, step) {
    const steps = new Set(parse(setupRow(projectId).completed_steps_json, []));
    steps.add(step);
    db.prepare('UPDATE project_setup SET completed_steps_json = ?, updated_at = ? WHERE project_id = ?').run(JSON.stringify([...steps]), now(), projectId);
  }

  // Pages are knowledge records (the Pages layer). Until someone edits the navigation, it follows the chosen feel.
  function routesFor(projectId, setup) {
    return { routes: know.navRoutes(projectId), seeded: !setup.pages_customized };
  }

  function connectionView(projectId) {
    const row = db.prepare("SELECT provider, label, secret_hint, status, updated_at FROM project_connections WHERE project_id = ? AND kind = 'agent'").get(projectId);
    return row ? { provider: row.provider, label: row.label, hint: row.secret_hint, status: row.status, updatedAt: row.updated_at,
      retired: catalogs.agentProviders.retired[row.provider]?.reason || null, keyUrl: agentProviders[row.provider]?.keyUrl || null } : null;
  }

  function assets(projectId) {
    return db.prepare('SELECT id, kind, filename, mime, size, notes, created_at FROM project_assets WHERE project_id = ? ORDER BY created_at').all(projectId)
      .map(asset => ({ ...asset, url: `/api/projects/${encodeURIComponent(projectId)}/assets/${asset.id}` }));
  }

  const api = {
    catalog() {
      return {
        preferences: catalogs.preferences, profiles: catalogs.profiles, feels: catalogs.feels, features: catalogs.packs,
        stacks: catalogs.stacks, pageTypes: catalogs.pageTypes, routeIcons: catalogs.routeIcons, agentProviders: Object.fromEntries(Object.entries(agentProviders).map(([id, value]) => [id, { label: value.label, secret: value.secret, keyUrl: value.keyUrl, limitsUrl: value.limitsUrl, docsUrl: value.docsUrl, steps: value.steps, limits: value.limits }]))
      };
    },

    getDraft(token) { return draftView(draftRow(token)); },

    saveDraft(token, input) {
      const existing = draftRow(token);
      if (existing?.claimed_project_id) fail('This idea already became a project.', 409);
      const profile = input.profile === undefined ? existing?.profile : validateProfile(input.profile);
      let { name = existing?.name || '', pitch = existing?.pitch || '' } = input;
      if (input.name !== undefined || input.pitch !== undefined) ({ name, pitch } = validateIdea({ name, pitch }));
      const updated = now();
      const expires = new Date(Date.now() + draftMaxAge * 1000).toISOString();
      if (existing) {
        db.prepare('UPDATE onboarding_drafts SET profile = ?, name = ?, pitch = ?, updated_at = ?, expires_at = ? WHERE id = ?')
          .run(profile || null, name, pitch, updated, expires, existing.id);
        return { draft: draftView(draftRow(token)), token: null };
      }
      const newToken = randomBytes(32).toString('base64url');
      db.prepare(`INSERT INTO onboarding_drafts(id, token_hash, profile, name, pitch, created_at, updated_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(`draft-${randomUUID()}`, digest(newToken), profile || null, name, pitch, updated, updated, expires);
      return { draft: draftView(draftRow(newToken)), token: newToken, maxAge: draftMaxAge };
    },

    // Claiming is the only way a project comes into existence during onboarding, and it happens once per draft.
    claimDraft(token, user, authorIdentity) {
      if (!user) fail('Sign in to continue.', 401);
      const row = draftRow(token);
      if (!row) fail('Start with your idea first.', 409);
      if (row.claimed_project_id) {
        requireMember(db, user, row.claimed_project_id);
        return api.projectSetup(user, row.claimed_project_id);
      }
      if (!row.profile) fail('Choose how you want to work first.', 409);
      const { name, pitch } = validateIdea(row);
      const projectId = `p-${randomBytes(5).toString('hex')}`;
      const slug = uniqueSlug(name);
      const created = now();
      const feel = catalogs.feels['sleek-saas'];
      const workspacePath = join(workspaceRoot, projectId);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`INSERT INTO projects(id, slug, name, description, tagline, accent_color, hero_image_path, created_at, updated_at)
          VALUES (?, ?, ?, ?, '', ?, NULL, ?, ?)`).run(projectId, slug, name, pitch.slice(0, 280), feel.accent, created, created);
        const claimed = db.prepare('UPDATE onboarding_drafts SET claimed_project_id = ?, updated_at = ? WHERE id = ? AND claimed_project_id IS NULL')
          .run(projectId, created, row.id);
        if (!claimed.changes) fail('This idea already became a project.', 409);
        db.prepare(`INSERT INTO project_members(project_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)`).run(projectId, user.id, created);
        db.prepare(`INSERT INTO project_setup(project_id, profile, stack_preset, stack_options_json, workspace_path, completed_steps_json, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, '["profile","idea","account"]', ?, ?, ?)`).run(projectId, row.profile, catalogs.stacks.default,
          JSON.stringify(Object.fromEntries(Object.entries(catalogs.stacks.presets[catalogs.stacks.default].options).map(([key, option]) => [key, option.default]))),
          workspacePath, user.id, created, created);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      saveProductRecord(db, projectId, 'direction', null, { title: name, summary: pitch, audience: '', outcomes: [], constraints: [], success: [] });
      know.ensureProject(projectId, { pitch });
      know.seedPages(projectId, null);
      createWorkspace(api.projectSetup(user, projectId), authorIdentity);
      return api.projectSetup(user, projectId);
    },

    projectSetup(user, projectId) {
      requireMember(db, user, projectId);
      const project = db.prepare('SELECT id, slug, name, description, tagline, accent_color, hero_image_path, created_at, updated_at FROM projects WHERE id = ?').get(projectId);
      const setup = setupRow(projectId);
      const overrides = parse(setup.overrides_json, {});
      const product = getProductWorkspace(db, projectId);
      return {
        project,
        profile: setup.profile, overrides, preferences: effectivePreferences(setup.profile, overrides),
        design: { feel: setup.feel, theme: setup.theme, accent: project.accent_color, notes: setup.design_notes,
          navigation: setup.navigation || catalogs.feels[setup.feel || 'sleek-saas'].navigation },
        pages: routesFor(projectId, setup),
        stack: { preset: setup.stack_preset, options: parse(setup.stack_options_json, {}) },
        // Functionality is story packs (DEC-037): the picks, and the stories they put on the map.
        features: {
          picks: parse(setup.story_packs_json, []),
          records: parse(setup.story_packs_json, []).map(id => ({ id, title: catalogs.packs[id]?.label || id, summary: catalogs.packs[id]?.summary || '', status: 'seeded' })),
          stories: know.list(projectId, 'story').map(story => ({ id: story.id, title: story.title, phase: story.phase, pack: story.pack, template: story.template }))
        },
        direction: product.direction && { title: product.direction.title, summary: product.direction.summary, revision: product.direction.revision },
        completedSteps: parse(setup.completed_steps_json, []),
        assets: assets(projectId),
        agentConnection: connectionView(projectId),
        workspacePath: setup.workspace_path
      };
    },

    savePreferences(user, projectId, { profile, overrides = {}, resetOverrides = false }) {
      requireMember(db, user, projectId);
      const current = setupRow(projectId);
      const nextProfile = profile === undefined ? current.profile : validateProfile(profile);
      const merged = resetOverrides ? {} : { ...parse(current.overrides_json, {}) };
      for (const [key, value] of Object.entries(overrides || {})) {
        const definition = catalogs.preferences[key];
        if (!definition) fail(`Unknown preference ${key}.`);
        if (value === null) { delete merged[key]; continue; }
        if (!(value in definition.values)) fail(`Choose a valid value for ${definition.label.toLowerCase()}.`);
        // An override equal to the profile default is not an override; dropping it keeps profile switches predictable.
        if (catalogs.profiles[nextProfile].defaults[key] === value) delete merged[key];
        else merged[key] = value;
      }
      db.prepare('UPDATE project_setup SET profile = ?, overrides_json = ?, updated_at = ? WHERE project_id = ?').run(nextProfile, JSON.stringify(merged), now(), projectId);
      return api.projectSetup(user, projectId);
    },

    saveDesign(user, projectId, { feel, theme, accent, notes = '', navigation }) {
      requireMember(db, user, projectId);
      if (!catalogs.feels[feel]) fail('Choose a starting feel.');
      if (!['light', 'dark', 'system'].includes(theme)) fail('Choose light, dark or match the device.');
      const accentColor = String(accent || catalogs.feels[feel].accent).trim().toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(accentColor)) fail('Accent color must be a six-digit hex color.');
      if (String(notes).length > 2000) fail('Keep design notes under 2,000 characters.');
      if (navigation !== undefined && !['sidebar', 'top'].includes(navigation)) fail('Choose side or top navigation.');
      const updated = now();
      db.prepare('UPDATE project_setup SET feel = ?, theme = ?, design_notes = ?, navigation = COALESCE(?, navigation), updated_at = ? WHERE project_id = ?')
        .run(feel, theme, String(notes).trim(), navigation || null, updated, projectId);
      db.prepare('UPDATE projects SET accent_color = ?, updated_at = ? WHERE id = ?').run(accentColor, updated, projectId);
      know.seedPages(projectId, feel);
      markStep(projectId, 'look');
      return api.projectSetup(user, projectId);
    },

    addAsset(user, projectId, { filename, dataUrl, notes }) {
      requireMember(db, user, projectId);
      const match = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([a-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
      const mime = match?.[1].toLowerCase();
      const kind = imageTypes.has(mime) ? 'image' : documentTypes.has(mime) ? 'document' : null;
      if (!match || !kind) fail('Upload a PNG, JPEG or WebP image, or a Markdown or text document.');
      const bytes = Buffer.from(match[2], 'base64');
      const limit = kind === 'image' ? 8 * 1024 * 1024 : 1024 * 1024;
      if (!bytes.length || bytes.length > limit) fail(kind === 'image' ? 'Images must be no larger than 8 MB.' : 'Documents must be no larger than 1 MB.', 413);
      const cleanNotes = String(notes || '').trim();
      if (cleanNotes.length > 1000) fail('Keep usage notes under 1,000 characters.');
      // The name later becomes a path inside the generated repository, so it can never be '.', '..' or hidden.
      const safeName = String(filename || '').replace(/[^A-Za-z0-9._ -]/g, '').trim().replace(/^\.+/, '').slice(0, 120) || `upload.${imageTypes.get(mime) || documentTypes.get(mime)}`;
      const id = `asset-${randomUUID()}`;
      const storedName = `${createHash('sha256').update(bytes).digest('hex').slice(0, 20)}.${imageTypes.get(mime) || documentTypes.get(mime)}`;
      const directory = join(assetRoot, projectId);
      mkdirSync(directory, { recursive: true });
      if (!existsSync(join(directory, storedName))) writeFileSync(join(directory, storedName), bytes, { flag: 'wx' });
      db.prepare(`INSERT INTO project_assets(id, project_id, kind, filename, mime, size, stored_name, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, projectId, kind, safeName, mime, bytes.length, storedName, cleanNotes, now());
      return api.projectSetup(user, projectId);
    },

    removeAsset(user, projectId, assetId) {
      requireMember(db, user, projectId);
      const asset = db.prepare('SELECT stored_name FROM project_assets WHERE id = ? AND project_id = ?').get(assetId, projectId);
      if (!asset) fail('Upload not found.', 404);
      db.prepare('DELETE FROM project_assets WHERE id = ?').run(assetId);
      // Identical files share storage; keep the bytes while another upload still refers to them.
      if (!db.prepare('SELECT 1 FROM project_assets WHERE project_id = ? AND stored_name = ?').get(projectId, asset.stored_name)) rmSync(join(assetRoot, projectId, asset.stored_name), { force: true });
      return api.projectSetup(user, projectId);
    },

    assetFile(user, projectId, assetId) {
      requireMember(db, user, projectId);
      const asset = db.prepare('SELECT mime, stored_name FROM project_assets WHERE id = ? AND project_id = ?').get(assetId, projectId);
      if (!asset) fail('Upload not found.', 404);
      return { path: join(assetRoot, projectId, asset.stored_name), mime: asset.mime };
    },

    projectAssets(projectId) {
      return db.prepare('SELECT id, kind, filename, mime, stored_name, notes FROM project_assets WHERE project_id = ? ORDER BY created_at').all(projectId)
        .map(asset => ({ ...asset, path: join(assetRoot, projectId, asset.stored_name) }));
    },

    saveFeatures(user, projectId, { picks = [], custom = [] }) {
      requireMember(db, user, projectId);
      if (!Array.isArray(picks) || !Array.isArray(custom)) fail('Choose story packs from the list.');
      if (custom.length > 30) fail('Add up to 30 story ideas at a time.');
      know.applyPacks(projectId, picks, { customIdeas: custom });
      markStep(projectId, 'features');
      return api.projectSetup(user, projectId);
    },

    removeFeature(user, projectId, recordId) {
      requireMember(db, user, projectId);
      const story = know.list(projectId, 'story').find(item => item.id === recordId);
      if (!story) fail('Story not found.', 404);
      know.remove(projectId, story.id);
      return api.projectSetup(user, projectId);
    },

    saveRoutes(user, projectId, { routes, navigation, reassign = {} }) {
      requireMember(db, user, projectId);
      if (navigation !== undefined && !['sidebar', 'top'].includes(navigation)) fail('Choose side or top navigation.');
      know.saveNavRoutes(projectId, routes, { reassign, author: user.name });
      if (navigation) db.prepare('UPDATE project_setup SET navigation = ?, updated_at = ? WHERE project_id = ?').run(navigation, now(), projectId);
      return api.projectSetup(user, projectId);
    },

    saveStack(user, projectId, { preset, options = {} }) {
      requireMember(db, user, projectId);
      const definition = catalogs.stacks.presets[preset];
      if (!definition) fail('Choose a stack preset.');
      if (!definition.available) fail(`${definition.label} is not available yet: ${definition.unavailableReason}`, 409);
      const values = Object.fromEntries(Object.entries(definition.options).map(([key, option]) => [key, typeof options[key] === 'boolean' ? options[key] : option.default]));
      db.prepare('UPDATE project_setup SET stack_preset = ?, stack_options_json = ?, updated_at = ? WHERE project_id = ?').run(preset, JSON.stringify(values), now(), projectId);
      markStep(projectId, 'stack');
      return api.projectSetup(user, projectId);
    },

    // DEC-034: one connection contract for every project, Aludel's own included. Storing a key calls no provider.
    agentConnection(user, projectId) {
      requireMember(db, user, projectId);
      return { connection: connectionView(projectId), providers: api.catalog().agentProviders };
    },

    async saveAgentConnection(user, projectId, { provider, secret }) {
      requireMember(db, user, projectId);
      if (catalogs.agentProviders.retired[provider]) fail(catalogs.agentProviders.retired[provider].reason);
      const definition = agentProviders[provider];
      if (!definition) fail('Choose Anthropic or OpenAI.');
      const value = String(secret || '').trim();
      for (const rule of definition.rejections) if (rule.pattern.test(value)) fail(rule.message);
      if (!definition.pattern.test(value)) fail(`That doesn't look like a ${definition.label} ${definition.secret}. Copy the whole key from the provider's API keys page.`);
      const checked = await checkAgentKey(definition, value);
      if (!checked.ok) fail(checkMessage(definition, checked), checked.reason === 'rejected' ? 400 : 502);
      const updated = now();
      db.prepare(`INSERT INTO project_connections(project_id, kind, provider, label, secret_encrypted, secret_hint, status, created_at, updated_at)
        VALUES (?, 'agent', ?, ?, ?, ?, 'verified', ?, ?)
        ON CONFLICT(project_id, kind) DO UPDATE SET provider=excluded.provider, label=excluded.label, secret_encrypted=excluded.secret_encrypted,
        secret_hint=excluded.secret_hint, status=excluded.status, updated_at=excluded.updated_at`).run(projectId, provider, definition.label, secrets.seal(value), value.slice(-4), updated, updated);
      if (projectId !== aludelProjectId || db.prepare('SELECT 1 FROM project_setup WHERE project_id = ?').get(projectId)) markStep(projectId, 'agent');
      return api.agentConnection(user, projectId);
    },

    // "Check again": the stored key against the provider, updating its status (a revoked or expired key shows as such).
    async checkAgentConnection(user, projectId) {
      requireMember(db, user, projectId);
      const row = db.prepare("SELECT provider, secret_encrypted FROM project_connections WHERE project_id = ? AND kind = 'agent'").get(projectId);
      if (!row) fail('No agent account is connected.', 404);
      const definition = agentProviders[row.provider];
      if (!definition || !row.secret_encrypted) fail('This connection has no key to check.', 409);
      const checked = await checkAgentKey(definition, secrets.open(row.secret_encrypted));
      const status = checked.ok ? 'verified' : checked.reason === 'rejected' ? 'rejected' : 'unchecked';
      db.prepare("UPDATE project_connections SET status = ?, updated_at = ? WHERE project_id = ? AND kind = 'agent'").run(status, now(), projectId);
      return { ...api.agentConnection(user, projectId), check: checked.ok ? null : checkMessage(definition, checked) };
    },

    removeAgentConnection(user, projectId) {
      requireMember(db, user, projectId);
      db.prepare("DELETE FROM project_connections WHERE project_id = ? AND kind = 'agent'").run(projectId);
      return api.agentConnection(user, projectId);
    },

    markStep(user, projectId, step) {
      requireMember(db, user, projectId);
      if (!['github', 'agent', 'look', 'pages', 'features', 'stack', 'build'].includes(step)) fail('Unknown setup step.');
      markStep(projectId, step);
      return api.projectSetup(user, projectId);
    },

    effectivePreferences
  };
  return api;
}
