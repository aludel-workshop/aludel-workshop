// Deterministic project scaffolding for the aludel-web-v1 stack preset (DEC-035).
// The same inputs always produce the same files, so the skeleton needs no agent and works for every working style.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { slugify } from './hosts.mjs';
import { brandView, designFiles, tokenStyles } from './design.mjs';

// Versions match the portal's checked toolchain; a preset is only trusted at versions it has been built with.
const dependencies = {
  '@angular/animations': '22.1.7', '@angular/cdk': '22.1.7', '@angular/common': '22.1.7', '@angular/compiler': '22.1.7',
  '@angular/core': '22.1.7', '@angular/forms': '22.1.7', '@angular/material': '22.1.7', '@angular/platform-browser': '22.1.7',
  '@fontsource/roboto': '5.3.0', rxjs: '7.8.2', 'zone.js': '0.16.3'
};
const devDependencies = {
  '@analogjs/vite-plugin-angular': '2.7.2', '@angular/build': '22.1.7', '@angular/compiler-cli': '22.1.7',
  sass: '1.104.1', typescript: '6.0.3', vite: '8.3.0'
};
const reservedPaths = new Set(['', 'sign-in', 'api', 'media', 'assets']);
// What aludel-web-v1 builds for the Accounts contract (LAY-07): Data records to the handlers and tables that realise them.
// The Platform binding and the generation manifest both read this, so they cannot disagree.
export const accountsBinding = {
  objects: { Account: 'table accounts', Session: 'table sessions' },
  operations: { getSession: '/api/session', signUp: 'POST /api/sign-up', signIn: 'POST /api/sign-in', signOut: 'POST /api/sign-out', health: '/api/health' }
};

const html = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const json = value => `${JSON.stringify(value, null, 2)}\n`;

export { contrastText, readableAccent } from '../src/color.js';
import { contrastText, readableAccent } from '../src/color.js';

export function manifest(setup, catalogs, media) {
  const preset = catalogs.stacks.presets[setup.stack.preset];
  return {
    schemaVersion: 1,
    generator: 'aludel-web-v1',
    project: { id: setup.project.id, slug: setup.project.slug, name: setup.project.name, pitch: setup.direction?.summary || setup.project.description },
    design: { feel: setup.design.feel, theme: setup.design.theme, accent: setup.design.accent, navigation: setup.design.navigation, notes: setup.design.notes, media: media.map(item => ({ file: item.file, kind: item.kind, notes: item.notes })) },
    pages: (setup.pages?.routes || []).map(({ id, label, icon, pageType, description }) => ({ id, label, icon, pageType, description })),
    storyPacks: setup.features.picks || [],
    stories: (setup.features.stories || []).map(({ id, title, phase, pack }) => ({ id, title, phase, pack })),
    stack: { preset: setup.stack.preset, layers: preset?.layers || {}, options: setup.stack.options }
  };
}

function mediaFiles(assets) {
  const used = new Set();
  return assets.map(asset => {
    let file = asset.filename.replace(/\s+/g, '-');
    for (let index = 2; used.has(file); index++) file = file.replace(/(\.[^.]+)?$/, `-${index}$1`);
    used.add(file);
    return { ...asset, file: asset.kind === 'image' ? `public/media/${file}` : `docs/reference/${file}` };
  });
}

function productDoc(setup, media, catalogs) {
  const features = setup.features.records;
  const stories = setup.features.stories || [];
  const pages = setup.pages?.routes || [];
  return [`# ${setup.project.name}`, '', '## Elevator pitch', '', setup.direction?.summary || setup.project.description, '',
    '## Pages', '', 'The primary navigation, in order.', '',
    ...(pages.length ? pages.map(page => `- **${page.label}** (${catalogs.pageTypes[page.pageType]?.label || page.pageType}) — ${page.description || '_Not described yet._'}`) : ['Not chosen yet.']), '',
    '## Stories', '', 'Seeded from story packs and ideas; the living version is the story map in Aludel.', '',
    ...(stories.length ? ['demo', 'mvp', 'later'].flatMap(phase => { const list = stories.filter(story => story.phase === phase); return list.length ? [`### ${{ demo: 'Demo', mvp: 'MVP', later: 'Later' }[phase]}`, '', ...list.map(story => `- ${story.title}${story.pack ? ` _(${story.pack} pack)_` : ''}`), ''] : []; }) : ['None yet.', '']),
    '## Story packs', '', ...(features.length ? features.map(item => `- **${item.title}** — ${item.summary}`) : ['None chosen.']), '',
    '## Design direction', '', `- Starting feel: ${setup.design.feel || 'not chosen yet'}`, `- Theme: ${setup.design.theme}`, `- Accent: ${setup.design.accent}`,
    `- Desktop navigation: ${setup.design.navigation === 'top' ? 'top bar' : 'side bar'} (phones use a bottom tab bar)`,
    ...(setup.design.notes ? ['', setup.design.notes] : []), '',
    '## Media and references', '', ...(media.length ? media.map(item => `- \`${item.file}\` — ${item.notes || 'No usage notes.'}`) : ['None uploaded yet.']), ''].join('\n');
}

export function initialFiles(setup, catalogs, gitProfile, appUrl) {
  const media = mediaFiles([]);
  const name = setup.project.name;
  return {
    '.gitignore': `${[...gitProfile.gitignore, '', '# A linked dependency folder is a symlink, which a trailing-slash pattern does not match.', 'node_modules'].join('\n')}\n`,
    '.gitattributes': `${gitProfile.gitattributes.join('\n')}\n`,
    'README.md': `# ${name}\n\n${setup.direction?.summary || setup.project.description}\n\nThis repository was started with [Aludel](${appUrl.portal}). The app skeleton is generated from the \`${setup.stack.preset}\` stack preset once setup is finished.\n\n- Product intent: [docs/product.md](docs/product.md)\n- Setup choices: [aludel.json](aludel.json)\n- Agent guide: [AGENTS.md](AGENTS.md)\n`,
    'AGENTS.md': agentsMap(setup),
    'docs/agents.md': agentsGuide(setup, catalogs),
    'aludel.json': json(manifest(setup, catalogs, media)),
    'docs/product.md': productDoc(setup, media, catalogs)
  };
}

// PLATFORM-UX-01 (round 3): AGENTS.md starts from the README and is a short map into docs/. Developers own it: it is
// written when the repository starts and never regenerated. The generated guide lives in docs/agents.md.
export function agentsMap(setup) {
  return `# ${setup.project.name}\n\n${setup.direction?.summary || setup.project.description}\n\nThis file is the map. Read what the task needs, not everything.\n\n## Where to look\n\n` +
    `- \`README.md\`: what it is and how to run it\n- \`docs/product.md\`: the product intent (from Aludel's Vision)\n- \`docs/agents.md\`: how work is done here: instructions, roles, conventions (from Aludel's Work)\n- \`aludel.json\`: the setup choices\n\n` +
    `## Run it\n\n- \`docker compose up --build\`, then open http://localhost:3000\n- \`npm test\` runs the tests; CI runs them on every push (\`.github/workflows/ci.yml\`)\n\nAdd a line here for each doc you add under \`docs/\`.\n`;
}

// setup.agents (LAY-07C) carries the project instructions and profiles from Work › Agents, so any coding tool reads the same rules.
// It is written to docs/agents.md, so its links are relative to docs/.
export function agentsGuide(setup, catalogs) {
  const preset = catalogs.stacks.presets[setup.stack.preset];
  const agents = setup.agents;
  // WORK-UX-01: instructions are layered project → role → action; each action says what it may change and use.
  const roleSections = agents ? agents.roles.map(role => `### ${role.name} (${role.layer})\n\n${role.instructions || '_No role instructions yet._'}\n\n${role.actions.map(action => `#### ${action.name}\n\n${action.instructions ? `${action.instructions}\n\n` : ''}- May change: ${action.changes.join('; ') || 'nothing (suggestions only)'}\n- Tools: ${action.tools.join(', ') || 'none'}\n- Asks first: ${action.asks || 'nothing beyond the rules below'}\n`).join('\n')}`).join('\n') : '';
  const agentSections = agents ? `\n## Project instructions\n\n${agents.instructions || '_None yet._'}\n${agents.principles.length ? `\nProduct principles:\n\n${agents.principles.map(item => `- ${item}`).join('\n')}\n` : ''}\n## Roles and actions\n\nEvery layer has a role, and each role performs actions. Read the project instructions first, then the role's, then the action's.\n\n${roleSections}\n## Commits and tests\n\n- End each commit message with trailers: \`Aludel-Work: W-12\` and \`Implements: S4, SPEC-02/FR-001\`.\n- Start test names with the acceptance they check: \`S4 · Given …\`.\n- Do not put tags or IDs in the code; Aludel links code to stories from these.\n` : '';
  return `# Agent guide for ${setup.project.name}\n\nRead [product.md](product.md) for the product intent and [aludel.json](../aludel.json) for the setup choices before changing anything.\n\nWork is assigned per action in Aludel (Work › Roles). Do not pick up work assigned to a person.\n${agentSections}\n## Stack\n\n${Object.entries(preset?.layers || {}).map(([layer, value]) => `- ${layer}: ${value}`).join('\n')}\n\nCommands: \`npm install\`, \`npm run build\`, \`npm start\` (serves on \`PORT\`, default 3000), or \`docker compose up --build\` to run it in its container. \`Dockerfile\` and \`.env.example\` declare how the app runs and every variable it reads; keep them current when that changes.\n\n## Rules\n\n- This app is independent of Aludel. Do not import Aludel code or call Aludel services at runtime.\n- Never commit secrets, \`.env\` files or the \`.data/\` directory.\n- Keep the pages in \`src/site.ts\` in step with the Pages section of \`docs/product.md\`. \`src/page-blocks.ts\` holds the placeholder layouts; replace a page's blocks with real UI as it is built.\n- Pages are specified in Aludel's Pages layer. When you build a page section, keep its \`data-aludel-section\` attribute (drop \`data-aludel-skeleton\`), keep \`data-aludel-page\` on the page, and read its text from the section's content in \`src/site.ts\`, so Aludel can show and edit it. Leave \`src/aludel-bridge.ts\` in place.\n`;
}

// The generation manifest (LAY-07D): every unit the template wrote and the records it realises. Pages are derived:
// their skeleton is regenerated from the page record, so a rebuild makes their links current again.
function generationManifest(setup, pages) {
  const manifest = pages.map(page => page.id ? { path: 'src/site.ts', symbol: `route ${page.path}`, recordIds: [page.id], derived: true } : null).filter(Boolean);
  const data = setup.data || { objects: [], operations: [] };
  const operation = operationId => data.operations.find(item => item.operationId === operationId);
  const health = operation('health');
  if (health) manifest.push({ path: 'server/server.mjs', symbol: accountsBinding.operations.health, recordIds: [health.id, ...health.stories] });
  if (!setup.stack.options?.auth) return manifest;
  const templateStories = (setup.features?.stories || []).filter(story => story.template).map(story => story.id);
  if (templateStories.length) manifest.push({ path: 'src/app.ts', symbol: 'App', recordIds: templateStories });
  for (const [operationId, symbol] of Object.entries(accountsBinding.operations)) {
    const record = operation(operationId);
    if (record && operationId !== 'health') manifest.push({ path: 'server/server.mjs', symbol, recordIds: [record.id, ...(record.objectId ? [record.objectId] : []), ...record.stories] });
  }
  for (const [name, symbol] of Object.entries(accountsBinding.objects)) {
    const record = data.objects.find(item => item.name === name);
    if (record) manifest.push({ path: 'server/server.mjs', symbol, recordIds: [record.id] });
  }
  return manifest;
}

// Every page's address in the generated app. The first navigation page is home at '/'; the rest get stable paths from
// their names. PAGES-UX-01: pages outside the navigation (sub-pages, pages planned on the Map) come after it.
// Pages › Built uses the same function to open a page in the preview.
export function sitePages(routes, records = []) {
  const used = new Set();
  const extra = records.filter(record => !routes.some(route => route.id === record.id));
  return [...routes.map(route => ({ ...route, nav: true })), ...extra.map(record => ({ ...record, nav: false }))].map((page, index) => {
    let path = index === 0 ? '' : slugify(page.label);
    if (index > 0 && reservedPaths.has(path)) path = `${path}-page`;
    for (let suffix = 2; index > 0 && used.has(path); suffix++) path = `${slugify(page.label)}-${suffix}`;
    used.add(path);
    return { ...page, path: `/${path}` };
  });
}

export function skeletonFiles(setup, catalogs, gitProfile, appUrl, assets, sources) {
  const feel = catalogs.feels[setup.design.feel || 'sleek-saas'] || catalogs.feels['sleek-saas'];
  const options = setup.stack.options || {};
  const media = mediaFiles(assets);
  const records = setup.pageRecords || [];
  const pages = sitePages(setup.pages?.routes || [], records).map(page => ({ id: page.id || null, path: page.path, label: page.label, icon: page.icon, description: page.description,
    pageType: page.pageType, nav: page.nav, blocks: catalogs.pageTypes[page.pageType]?.blocks || [] }));
  // A page's spec sections become its skeleton, each marked so Aludel's Pages layer can find it in the preview.
  const previewKind = new Map((setup.designSystem?.components || []).map(component => [component.id, component.preview]));
  const pathOf = new Map(pages.map(page => [page.id, page.path]));
  for (const page of pages) {
    const record = records.find(entry => entry.id === page.id);
    page.sections = (record?.sections || []).filter(section => section.state === 'ready').map(section => ({ id: section.id, name: section.name, kind: previewKind.get(section.component) || null,
      region: section.region, title: section.content.title, body: section.content.body, action: section.content.action, leadsTo: section.leadsTo ? pathOf.get(section.leadsTo) || null : null }));
  }
  const theme = setup.design.theme;
  const accent = setup.design.accent;
  const surface = theme === 'dark' ? feel.surfaceDark : theme === 'light' ? feel.surface : `light-dark(${feel.surface}, ${feel.surfaceDark})`;
  const hero = media.find(item => item.kind === 'image');
  // DESIGN-UX-01: the Design layer's brand assets name the app and give it its mark; uploaded brand images are copied in.
  const design = setup.designSystem?.tokens ? setup.designSystem : null;
  const brand = design ? brandView(design) : {};
  const brandImages = (design?.brand || []).filter(asset => asset.type === 'image' && asset.upload).map(asset => {
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[asset.upload.mime] || 'png';
    const name = String(asset.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'asset';
    return { ...asset.upload, kind: 'image', notes: asset.notes, file: `public/brand/${name}.${extension}`, key: asset.key };
  });
  media.push(...brandImages);
  const markImage = brandImages.find(item => item.key === 'mark');
  const site = {
    name: brand.name || setup.project.name, pitch: brand.tagline || setup.direction?.summary || setup.project.description, feel: setup.design.feel || 'sleek-saas',
    markText: brand.mark?.mark?.text || null, mark: markImage ? `/${markImage.file.replace(/^public\//, '')}` : null,
    navigation: setup.design.navigation === 'top' ? 'top' : 'sidebar', auth: Boolean(options.auth), pages,
    portal: appUrl.portal,
    hero: hero ? `/${hero.file.replace(/^public\//, '')}` : null
  };
  const files = {
    ...initialFiles(setup, catalogs, gitProfile, appUrl),
    'aludel.json': json(manifest(setup, catalogs, media)),
    'docs/product.md': productDoc(setup, media, catalogs),
    'package.json': json({ name: setup.project.slug, version: '0.1.0', private: true, type: 'module', engines: { node: '^24.14.0' },
      scripts: { dev: 'vite', build: 'vite build', start: 'npm run build && node server/server.mjs', serve: 'node server/server.mjs', test: 'node --test' }, dependencies, devDependencies }),
    'vite.config.ts': "import { defineConfig } from 'vite';\nimport angular from '@analogjs/vite-plugin-angular';\n\nexport default defineConfig({ plugins: [angular({ tsconfig: 'tsconfig.app.json' })], build: { outDir: 'dist' } });\n",
    'tsconfig.json': json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', lib: ['ES2022', 'dom'], experimentalDecorators: true, useDefineForClassFields: false, strict: true, skipLibCheck: true, isolatedModules: true, types: [] }, angularCompilerOptions: { strictTemplates: true } }),
    'tsconfig.app.json': json({ extends: './tsconfig.json', compilerOptions: { outDir: './out-tsc/app' }, files: ['src/main.ts'], include: ['src/**/*.ts'] }),
    'index.html': `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${html(site.name)}</title>\n${brand.description ? `  <meta name="description" content="${html(brand.description)}">\n` : ''}${design ? `  <link rel="icon" href="${markImage ? site.mark : '/favicon.svg'}">\n` : ''}</head>\n<body>\n  <app-root></app-root>\n  <script type="module" src="/src/main.ts"></script>\n</body>\n</html>\n`,
    'src/main.ts': "import '@angular/compiler';\nimport { bootstrapApplication } from '@angular/platform-browser';\nimport { App } from './app';\nimport './aludel-bridge';\nimport './styles.scss';\n\nbootstrapApplication(App).catch(console.error);\n",
    'src/style.d.ts': "declare module '*.scss';\n",
    'src/site.ts': `// Generated by Aludel from its Pages layer: every page, navigation pages first (nav: true).\nimport { PageBlock, PageSection } from './page-blocks';\n\nexport interface SitePage { id: string | null; path: string; label: string; icon: string; description: string; pageType: string; nav: boolean; blocks: PageBlock[]; sections: PageSection[]; }\nexport interface Site { name: string; pitch: string; feel: string; markText: string | null; mark: string | null; navigation: 'sidebar' | 'top'; auth: boolean; pages: SitePage[]; portal: string; hero: string | null; }\n\nexport const site: Site = ${JSON.stringify(site, null, 2)};\n`,
    'src/aludel-bridge.ts': bridgeSource,
    // Shared verbatim with the Aludel onboarding preview so the skeleton matches what was designed.
    'src/page-blocks.ts': sources.pageBlocks,
    'src/app.ts': appComponent,
    'src/app.html': appTemplate,
    'src/styles.scss': styles({ feel, theme, accent, surface, tokens: design?.tokens || null }),
    ...(design ? designFiles(design, site.name) : {}),
    'server/server.mjs': serverSource(Boolean(options.auth)),
    ...containerFiles(),
    ...workflowFiles(),
    'licenses/Material-Symbols-LICENSE': sources.iconLicense
  };
  return { files, media, binaries: { 'public/fonts/icons.ttf': sources.iconFont }, manifest: generationManifest(setup, pages) };
}

function styles({ feel, theme, accent, surface, tokens = null }) {
  const themeType = theme === 'system' ? 'color-scheme' : theme;
  const lightPrimary = readableAccent(accent, feel.surface);
  const darkPrimary = readableAccent(accent, feel.surfaceDark);
  const primary = theme === 'light' ? lightPrimary : theme === 'dark' ? darkPrimary : `light-dark(${lightPrimary}, ${darkPrimary})`;
  const onAccent = theme === 'light' ? contrastText(lightPrimary) : theme === 'dark' ? contrastText(darkPrimary) : `light-dark(${contrastText(lightPrimary)}, ${contrastText(darkPrimary)})`;
  const container = theme === 'dark' ? `color-mix(in srgb, ${accent} 30%, #000)` : theme === 'light' ? `color-mix(in srgb, ${accent} 16%, #fff)` : `light-dark(color-mix(in srgb, ${accent} 16%, #fff), color-mix(in srgb, ${accent} 30%, #000))`;
  return `@use 'sass:string';
@use '@angular/material' as mat;
@import '@fontsource/roboto/latin-400.css';
@import '@fontsource/roboto/latin-500.css';
@import '@fontsource/roboto/latin-700.css';

// Feel: ${feel.label}. Theme and accent (${accent}) come from the Look & feel step in Aludel;
// the primary role is the accent adjusted to at least 4.5:1 contrast so it stays readable as text.
html {
  color-scheme: ${theme === 'system' ? 'light dark' : theme};
  @include mat.theme((color: (primary: mat.$azure-palette, theme-type: ${themeType}), typography: (plain-family: string.unquote("${feel.font.replace(/"/g, "'")}"), brand-family: string.unquote("${feel.font.replace(/"/g, "'")}")), density: ${feel.density}));
${tokens ? `  // Every value below comes from the Design layer's token set (design/tokens.json has the same values as W3C design tokens).
${tokenStyles(tokens, theme)}` : `  @include mat.theme-overrides((primary: ${primary}, on-primary: ${onAccent}, primary-container: ${container}, surface: ${surface}));
  --app-radius: ${feel.radius}px;
  --app-font: ${feel.font};`}
}
@font-face { font-family: 'App Icons'; src: url('/fonts/icons.ttf') format('truetype'); font-display: block; }
.icon { font-family: 'App Icons'; font-size: 22px; line-height: 1; font-weight: normal; font-style: normal; letter-spacing: normal; text-transform: none; white-space: nowrap; direction: ltr; font-feature-settings: 'liga'; display: inline-block; width: 1em; overflow: hidden; }
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--mat-sys-surface); color: var(--mat-sys-on-surface); font-family: var(--app-font); line-height: 1.5; }
a { color: var(--mat-sys-primary); }
.skip-link { position: absolute; left: -999px; } .skip-link:focus { left: 12px; top: 12px; z-index: 10; background: var(--mat-sys-surface); padding: 8px 12px; }
.shell { min-height: 100vh; display: grid; }
.shell.sidebar { grid-template-columns: 240px 1fr; }
.shell.top { grid-template-rows: auto 1fr; }
.brand { font-weight: 700; font-size: 20px; color: inherit; text-decoration: none; display: flex; align-items: center; gap: 10px; }
.brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: calc(var(--app-radius) / 2 + 4px); background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); font-size: 15px; }
.nav { display: flex; gap: 4px; }
.nav a, .tabs a { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--app-radius); color: inherit; text-decoration: none; }
.nav a.active, .tabs a.active { background: var(--mat-sys-primary-container); font-weight: 600; }
.sidebar > header { padding: 22px 14px; border-right: 1px solid var(--mat-sys-outline-variant); display: flex; flex-direction: column; gap: 24px; }
.sidebar .nav { flex-direction: column; }
.top > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px clamp(16px, 4vw, 40px); border-bottom: 1px solid var(--mat-sys-outline-variant); flex-wrap: wrap; }
.tabs { display: none; }
main { padding: clamp(20px, 4vw, 48px); max-width: 1100px; width: 100%; --blk-radius: var(--app-radius); --blk-accent: var(--mat-sys-primary); }
h1 { font-size: clamp(28px, 4vw, 40px); line-height: 1.15; margin: 0 0 8px; }
.description { font-size: 18px; color: var(--mat-sys-on-surface-variant); max-width: 680px; margin: 0 0 24px; }
.description.empty { font-style: italic; }
.hero { border-radius: calc(var(--app-radius) * 1.5); min-height: 220px; margin-bottom: 24px; background-size: cover; background-position: center; }
.auth-form { display: grid; gap: 4px; max-width: 420px; }
.account { display: flex; gap: 8px; align-items: center; font-size: 14px; }
.error { color: var(--mat-sys-error); }
/* Phones: navigation moves to a bottom tab bar (at most five pages), whatever the desktop choice. */
@media (max-width: 760px) {
  .shell.sidebar, .shell.top { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
  .shell > header { flex-direction: row !important; align-items: center; justify-content: space-between; padding: 10px 16px !important; border-right: 0 !important; border-bottom: 1px solid var(--mat-sys-outline-variant); }
  .shell > header .nav { display: none; }
  .tabs { display: flex; position: sticky; bottom: 0; justify-content: space-around; background: var(--mat-sys-surface-container); border-top: 1px solid var(--mat-sys-outline-variant); padding: 6px; }
  .tabs a { flex: 1; flex-direction: column; gap: 2px; padding: 6px 2px; font-size: 12px; text-align: center; }
}
`;
}

// PAGES-UX-01: lets Aludel's Pages layer inspect the app while it shows it in a frame: which page and sections are on
// screen and where. It answers only the Aludel portal that generated it and does nothing when the app isn't framed.
const bridgeSource = `// Generated by Aludel. Lets Aludel's Pages layer point at this app's page sections while it shows the app in a frame.
// It only talks to the Aludel portal named in site.ts and does nothing when the app is not framed. Keep the
// data-aludel-page and data-aludel-section attributes on pages and sections as they are built out.
import { site } from './site';

if (window.parent !== window) {
  let inspecting = false;
  let hovered: string | null = null;
  let queued = false;
  const post = (message: Record<string, unknown>) => window.parent.postMessage({ aludel: 1, ...message }, site.portal);
  const box = (element: Element) => { const rect = element.getBoundingClientRect(); return { x: rect.left, y: rect.top, w: rect.width, h: rect.height }; };
  const inventory = () => post({ type: 'inventory', path: location.pathname, page: document.querySelector('[data-aludel-page]')?.getAttribute('data-aludel-page') || null,
    height: document.documentElement.scrollHeight,
    sections: Array.from(document.querySelectorAll('[data-aludel-section]')).map(element => ({ id: element.getAttribute('data-aludel-section'), skeleton: element.hasAttribute('data-aludel-skeleton'), box: box(element) })) });
  const soon = () => { if (!inspecting || queued) return; queued = true; requestAnimationFrame(() => { queued = false; inventory(); }); };
  const section = (target: EventTarget | null) => target instanceof Element ? target.closest('[data-aludel-section]') : null;
  window.addEventListener('message', event => {
    if (event.origin !== site.portal || event.data?.aludel !== 1) return;
    if (event.data.type === 'inspect') { inspecting = Boolean(event.data.on); inventory(); }
    if (event.data.type === 'go' && typeof event.data.path === 'string' && event.data.path.startsWith('/')) { history.pushState({}, '', event.data.path); dispatchEvent(new PopStateEvent('popstate')); }
  });
  document.addEventListener('mouseover', event => {
    if (!inspecting) return;
    const element = section(event.target), id = element?.getAttribute('data-aludel-section') || null;
    if (id !== hovered) { hovered = id; post({ type: 'hover', id, box: element ? box(element) : null }); }
  });
  document.addEventListener('click', event => {
    const element = inspecting ? section(event.target) : null;
    if (!element) return;
    event.preventDefault(); event.stopPropagation();
    post({ type: 'select', id: element.getAttribute('data-aludel-section'), box: box(element) });
  }, true);
  addEventListener('scroll', soon, { passive: true });
  addEventListener('resize', soon);
  new MutationObserver(soon).observe(document.documentElement, { childList: true, subtree: true });
  post({ type: 'ready', path: location.pathname });
}

export {};
`;

const appComponent = `import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PageBlocksComponent } from './page-blocks';
import { site, SitePage } from './site';

interface Account { email: string; name: string; }

@Component({
  selector: 'app-root', standalone: true,
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, PageBlocksComponent],
  templateUrl: './app.html'
})
export class App {
  readonly site = site;
  readonly path = signal(location.pathname);
  readonly page = computed<SitePage | null>(() => site.pages.find(item => item.path === this.path()) ?? null);
  readonly navPages = site.pages.filter(item => item.nav);
  readonly account = signal<Account | null>(null);
  readonly message = signal('');
  readonly busy = signal(false);
  mode: 'sign-in' | 'sign-up' = 'sign-in';
  email = '';
  name = '';
  password = '';

  constructor() {
    window.addEventListener('popstate', () => this.path.set(location.pathname));
    document.title = site.name;
    if (site.auth) void this.loadSession();
  }

  go(event: Event, path: string) {
    event.preventDefault();
    history.pushState({}, '', path);
    this.path.set(path);
    this.message.set('');
    window.scrollTo(0, 0);
    setTimeout(() => document.querySelector<HTMLElement>('main h1')?.focus(), 0);
  }

  initials(title: string) {
    return title.split(/\\s+/).map(word => word[0] || '').join('').slice(0, 2).toUpperCase();
  }

  private async loadSession() {
    const response = await fetch('/api/session');
    if (response.ok) this.account.set((await response.json()).account);
  }

  async submit() {
    this.busy.set(true);
    this.message.set('');
    try {
      const response = await fetch(this.mode === 'sign-in' ? '/api/sign-in' : '/api/sign-up', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: this.email, name: this.name, password: this.password })
      });
      const value = await response.json();
      if (!response.ok) { this.message.set(value.error || 'Something went wrong.'); return; }
      this.account.set(value.account);
      this.password = '';
      history.pushState({}, '', '/');
      this.path.set('/');
    } finally { this.busy.set(false); }
  }

  async signOut() {
    await fetch('/api/sign-out', { method: 'POST' });
    this.account.set(null);
  }
}
`;

const appTemplate = `<a class="skip-link" href="#main">Skip to content</a>
<div [class]="'shell ' + site.navigation">
  <header>
    <a class="brand" href="/" (click)="go($event, '/')">@if (site.mark) { <img class="brand-mark" [src]="site.mark" alt=""> } @else { <span class="brand-mark" aria-hidden="true">{{ site.markText || initials(site.name) }}</span> }{{ site.name }}</a>
    <nav class="nav" aria-label="Main">
      @for (item of navPages; track item.path) {
        <a [href]="item.path" (click)="go($event, item.path)" [class.active]="path() === item.path" [attr.aria-current]="path() === item.path ? 'page' : null"><span class="icon" aria-hidden="true">{{ item.icon }}</span>{{ item.label }}</a>
      }
    </nav>
    @if (site.auth) {
      <div class="account">
        @if (account(); as current) {
          <span>{{ current.name }}</span><button mat-button type="button" (click)="signOut()">Sign out</button>
        } @else {
          <a mat-flat-button href="/sign-in" (click)="go($event, '/sign-in')">Sign in</a>
        }
      </div>
    }
  </header>
  <main id="main">
    @if (path() === '/sign-in' && site.auth) {
      <h1 tabindex="-1">{{ mode === 'sign-in' ? 'Sign in' : 'Create an account' }}</h1>
      <form class="auth-form" (ngSubmit)="submit()">
        @if (mode === 'sign-up') {
          <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput name="name" [(ngModel)]="name" autocomplete="name" required></mat-form-field>
        }
        <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput name="email" type="email" [(ngModel)]="email" autocomplete="email" required></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Password</mat-label><input matInput name="password" type="password" [(ngModel)]="password" [autocomplete]="mode === 'sign-in' ? 'current-password' : 'new-password'" required></mat-form-field>
        @if (message()) { <p class="error" role="alert">{{ message() }}</p> }
        <button mat-flat-button type="submit" [disabled]="busy()">{{ mode === 'sign-in' ? 'Sign in' : 'Create account' }}</button>
        <button mat-button type="button" (click)="mode = mode === 'sign-in' ? 'sign-up' : 'sign-in'">{{ mode === 'sign-in' ? 'New here? Create an account' : 'Have an account? Sign in' }}</button>
      </form>
    } @else if (page(); as current) {
      @if (current.path === '/' && site.hero) { <div class="hero" [style.background-image]="'url(' + site.hero + ')'" role="img" [attr.aria-label]="site.name"></div> }
      <div class="page" [attr.data-aludel-page]="current.id">
      <h1 tabindex="-1">{{ current.label }}</h1>
      <p class="description" [class.empty]="!current.description">{{ current.description || 'This page is a skeleton. Describe what happens here in Aludel to build it out.' }}</p>
      <page-blocks [blocks]="current.blocks" [sections]="current.sections"></page-blocks>
      </div>
    } @else {
      <h1 tabindex="-1">Page not found</h1>
      <p><a href="/" (click)="go($event, '/')">Go home</a></p>
    }
  </main>
  <nav class="tabs" aria-label="Sections">
    @for (item of navPages; track item.path) {
      <a [href]="item.path" (click)="go($event, item.path)" [class.active]="path() === item.path" [attr.aria-current]="path() === item.path ? 'page' : null"><span class="icon" aria-hidden="true">{{ item.icon }}</span>{{ item.label }}</a>
    }
  </nav>
</div>
`;

// PLATFORM-PIPELINE-01: the app declares how it builds and runs, so any container host (and Aludel's previews) runs it the
// same way. Limits are not declared here: the host that runs the app sets them.
// PLATFORM-UX-01 (round 3): the app's own CI and release image, run by GitHub Actions in its repository with its own
// token, so both keep working without Aludel. Aludel reads the CI run's test-results artifact to show which tests pass.
export const workflowPaths = ['.github/workflows/ci.yml', '.github/workflows/release.yml'];
function workflowFiles() {
  return {
    '.github/workflows/ci.yml': `# Runs the tests and the build on every push and pull request. Aludel reads the test-results artifact.
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
      - run: node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=test-results.xml
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results.xml
          if-no-files-found: ignore
      - run: npm run build
`,
    '.github/workflows/release.yml': `# When a release is published, build its image once and push it to GitHub Packages (ghcr.io) with this repository's token.
name: Release image
on:
  release:
    types: [published]
permissions:
  contents: read
  packages: write
jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - id: image
        run: echo "name=ghcr.io/\${GITHUB_REPOSITORY,,}" >> "$GITHUB_OUTPUT"
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: \${{ steps.image.outputs.name }}:\${{ github.event.release.tag_name }},\${{ steps.image.outputs.name }}:latest
`
  };
}

function containerFiles() {
  return {
    'Dockerfile': `# syntax=docker/dockerfile:1
# How this app builds and runs. Aludel's previews use this same file; nothing here depends on Aludel.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY . .
RUN npm run build

# The server has no runtime dependencies, so the running image holds only the server and the built app.
FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/data NODE_NO_WARNINGS=1
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=2s --start-period=5s CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server/server.mjs"]
`,
    '.dockerignore': 'node_modules\ndist\n.data\n.git\n.env\n.env.*\n*.sqlite\n',
    'compose.yaml': `# Run this app on its own: docker compose up --build, then open http://localhost:3000
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: { path: .env, required: false }
    volumes: ["app-data:/data"]
    restart: unless-stopped
volumes:
  app-data:
`,
    '.env.example': '# Every variable this app reads, with the values its container uses. For docker compose, copy to .env to change them; never commit .env.\n# Port the server listens on.\nPORT=3000\n# Interface to listen on (0.0.0.0 inside a container).\nHOST=0.0.0.0\n# Folder for the app database and uploads.\nDATA_DIR=/data\n'
  };
}

function serverSource(auth) {
  return `// Generated by Aludel (aludel-web-v1). A small, dependency-free server for the built app.
import { createServer } from 'node:http';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const authEnabled = ${auth};
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };

let db = null;
if (authEnabled) {
  const { DatabaseSync } = await import('node:sqlite');
  const dataDirectory = resolve(process.env.DATA_DIR || join(root, '.data'));
  mkdirSync(dataDirectory, { recursive: true });
  db = new DatabaseSync(join(dataDirectory, 'app.sqlite'));
  db.exec(\`CREATE TABLE IF NOT EXISTS accounts (email TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES accounts(email), expires_at TEXT NOT NULL);\`);
}

const digest = value => createHash('sha256').update(value).digest('hex');
const hashPassword = (password, salt) => scryptSync(password, Buffer.from(salt, 'hex'), 32).toString('hex');
const send = (response, status, value, headers = {}) => {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), ...headers });
  response.end(body);
};
const readJson = request => new Promise((done, reject) => {
  let body = '';
  request.on('data', chunk => { body += chunk; if (body.length > 65536) reject(new Error('Request too large')); });
  request.on('end', () => { try { done(body ? JSON.parse(body) : {}); } catch (error) { reject(error); } });
});
const token = request => (request.headers.cookie || '').split(';').map(part => part.trim().split('=')).find(([key]) => key === 'app_session')?.[1];
const account = request => {
  const value = token(request);
  if (!db || !value) return null;
  return db.prepare('SELECT a.email, a.name FROM sessions s JOIN accounts a ON a.email = s.email WHERE s.token_hash = ? AND s.expires_at > ?').get(digest(value), new Date().toISOString()) || null;
};
const startSession = email => {
  const value = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions(token_hash, email, expires_at) VALUES (?, ?, ?)').run(digest(value), email, new Date(Date.now() + 30 * 86400000).toISOString());
  return \`app_session=\${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=\${30 * 86400}\`;
};

async function api(request, response, pathname) {
  if (pathname === '/api/health') return send(response, 200, { ok: true });
  if (!authEnabled) return send(response, 404, { error: 'Not found.' });
  if (pathname === '/api/session') return send(response, 200, { account: account(request) });
  if (pathname === '/api/sign-up' && request.method === 'POST') {
    const { email = '', name = '', password = '' } = await readJson(request);
    const normalized = String(email).trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalized) || !String(name).trim()) return send(response, 400, { error: 'Enter your name and a valid email.' });
    if (String(password).length < 8) return send(response, 400, { error: 'Use at least 8 characters for your password.' });
    if (db.prepare('SELECT 1 FROM accounts WHERE email = ?').get(normalized)) return send(response, 409, { error: 'That email already has an account.' });
    const salt = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?)').run(normalized, String(name).trim(), salt, hashPassword(String(password), salt), new Date().toISOString());
    return send(response, 201, { account: { email: normalized, name: String(name).trim() } }, { 'set-cookie': startSession(normalized) });
  }
  if (pathname === '/api/sign-in' && request.method === 'POST') {
    const { email = '', password = '' } = await readJson(request);
    const row = db.prepare('SELECT * FROM accounts WHERE email = ?').get(String(email).trim().toLowerCase());
    const candidate = Buffer.from(hashPassword(String(password), row?.salt || '00'.repeat(16)), 'hex');
    if (!row || !timingSafeEqual(candidate, Buffer.from(row.hash, 'hex'))) return send(response, 401, { error: 'That email and password do not match.' });
    return send(response, 200, { account: { email: row.email, name: row.name } }, { 'set-cookie': startSession(row.email) });
  }
  if (pathname === '/api/sign-out' && request.method === 'POST') {
    const value = token(request);
    if (value) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(value));
    return send(response, 200, { account: null }, { 'set-cookie': 'app_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
  }
  return send(response, 404, { error: 'Not found.' });
}

function serveStatic(response, pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\\.\\.(\\/|\\\\|$))+/, '');
  let path = join(dist, safe);
  if (!path.startsWith(dist) || !existsSync(path) || statSync(path).isDirectory()) path = join(dist, 'index.html');
  if (!existsSync(path)) return send(response, 503, { error: 'Run npm run build first.' });
  const body = readFileSync(path);
  response.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'content-length': body.length, 'x-content-type-options': 'nosniff' });
  response.end(body);
}

createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://app.local');
    if (pathname.startsWith('/api/')) await api(request, response, pathname);
    else serveStatic(response, pathname);
  } catch (error) {
    if (!response.headersSent) send(response, 500, { error: 'Something went wrong.' });
  }
}).listen(port, host, () => console.log(\`App running at http://\${host}:\${port}\`));
`;
}

export function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
}

export function writeBinaries(root, files) {
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), bytes);
  }
}

// Files the scaffold ships verbatim: the shared layout component, the route-icon font subset and its licence.
export function loadScaffoldSources(portalRoot) {
  return {
    pageBlocks: readFileSync(join(portalRoot, 'src', 'page-blocks.ts'), 'utf8'),
    iconFont: readFileSync(join(portalRoot, 'templates', 'aludel-web-v1', 'icons.ttf')),
    iconLicense: readFileSync(join(portalRoot, 'licenses', 'Material-Symbols-LICENSE'), 'utf8')
  };
}

export function copyMedia(root, media) {
  for (const item of media) {
    mkdirSync(dirname(join(root, item.file)), { recursive: true });
    copyFileSync(item.path, join(root, item.file));
  }
}
