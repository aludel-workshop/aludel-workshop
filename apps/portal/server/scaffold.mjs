// Deterministic project scaffolding for the aludel-web-v1 stack preset (DEC-035).
// The same inputs always produce the same files, so the skeleton needs no agent and works for every working style.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { slugify } from './hosts.mjs';

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
    workingStyle: { profile: setup.profile, preferences: setup.preferences },
    design: { feel: setup.design.feel, theme: setup.design.theme, accent: setup.design.accent, navigation: setup.design.navigation, notes: setup.design.notes, media: media.map(item => ({ file: item.file, kind: item.kind, notes: item.notes })) },
    pages: (setup.pages?.routes || []).map(({ id, label, icon, pageType, description }) => ({ id, label, icon, pageType, description })),
    functionality: setup.features.records.map(item => ({ id: item.id, title: item.title, summary: item.summary })),
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
  const pages = setup.pages?.routes || [];
  return [`# ${setup.project.name}`, '', '## Elevator pitch', '', setup.direction?.summary || setup.project.description, '',
    '## Pages', '', 'The primary navigation, in order.', '',
    ...(pages.length ? pages.map(page => `- **${page.label}** (${catalogs.pageTypes[page.pageType]?.label || page.pageType}) — ${page.description || '_Not described yet._'}`) : ['Not chosen yet.']), '',
    '## Functionality', '', ...(features.length ? features.map(item => `- **${item.title}** — ${item.summary}`) : ['None chosen yet.']), '',
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
    'AGENTS.md': agentsGuide(setup, catalogs),
    'aludel.json': json(manifest(setup, catalogs, media)),
    'docs/product.md': productDoc(setup, media, catalogs)
  };
}

function agentsGuide(setup, catalogs) {
  const preset = catalogs.stacks.presets[setup.stack.preset];
  const preferences = Object.entries(setup.preferences).map(([key, value]) => `- ${catalogs.preferences[key]?.label || key}: ${catalogs.preferences[key]?.values[value] || value}`);
  return `# Agent guide for ${setup.project.name}\n\nRead [docs/product.md](docs/product.md) for the product intent and [aludel.json](aludel.json) for the setup choices before changing anything.\n\n## Working style\n\nThe owner chose the **${catalogs.profiles[setup.profile]?.label || setup.profile}** working style:\n\n${preferences.join('\n')}\n\nRespect these preferences: do not implement work the owner chose to do themselves, and only ask the kinds of questions they asked to see.\n\n## Stack\n\n${Object.entries(preset?.layers || {}).map(([layer, value]) => `- ${layer}: ${value}`).join('\n')}\n\nCommands: \`npm install\`, \`npm run build\`, \`npm start\` (serves on \`PORT\`, default 3000).\n\n## Rules\n\n- This app is independent of Aludel. Do not import Aludel code or call Aludel services at runtime.\n- Never commit secrets, \`.env\` files or the \`.data/\` directory.\n- Keep the pages in \`src/site.ts\` in step with the Pages section of \`docs/product.md\`. \`src/page-blocks.ts\` holds the placeholder layouts; replace a page's blocks with real UI as it is built.\n`;
}

export function skeletonFiles(setup, catalogs, gitProfile, appUrl, assets, sources) {
  const feel = catalogs.feels[setup.design.feel || 'sleek-saas'] || catalogs.feels['sleek-saas'];
  const options = setup.stack.options || {};
  const media = mediaFiles(assets);
  const used = new Set();
  // The first page is the app's home at '/'; the rest get stable paths from their names.
  const pages = (setup.pages?.routes || []).map((page, index) => {
    let path = index === 0 ? '' : slugify(page.label);
    if (index > 0 && reservedPaths.has(path)) path = `${path}-page`;
    for (let suffix = 2; index > 0 && used.has(path); suffix++) path = `${slugify(page.label)}-${suffix}`;
    used.add(path);
    return { path: `/${path}`, label: page.label, icon: page.icon, description: page.description, pageType: page.pageType,
      blocks: catalogs.pageTypes[page.pageType]?.blocks || [] };
  });
  const theme = setup.design.theme;
  const accent = setup.design.accent;
  const surface = theme === 'dark' ? feel.surfaceDark : theme === 'light' ? feel.surface : `light-dark(${feel.surface}, ${feel.surfaceDark})`;
  const hero = media.find(item => item.kind === 'image');
  const site = {
    name: setup.project.name, pitch: setup.direction?.summary || setup.project.description, feel: setup.design.feel || 'sleek-saas',
    navigation: setup.design.navigation === 'top' ? 'top' : 'sidebar', auth: Boolean(options.auth), pages,
    hero: hero ? `/${hero.file.replace(/^public\//, '')}` : null
  };
  const files = {
    ...initialFiles(setup, catalogs, gitProfile, appUrl),
    'aludel.json': json(manifest(setup, catalogs, media)),
    'docs/product.md': productDoc(setup, media, catalogs),
    'package.json': json({ name: setup.project.slug, version: '0.1.0', private: true, type: 'module', engines: { node: '^24.14.0' },
      scripts: { dev: 'vite', build: 'vite build', start: 'npm run build && node server/server.mjs', serve: 'node server/server.mjs' }, dependencies, devDependencies }),
    'vite.config.ts': "import { defineConfig } from 'vite';\nimport angular from '@analogjs/vite-plugin-angular';\n\nexport default defineConfig({ plugins: [angular({ tsconfig: 'tsconfig.app.json' })], build: { outDir: 'dist' } });\n",
    'tsconfig.json': json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', lib: ['ES2022', 'dom'], experimentalDecorators: true, useDefineForClassFields: false, strict: true, skipLibCheck: true, isolatedModules: true, types: [] }, angularCompilerOptions: { strictTemplates: true } }),
    'tsconfig.app.json': json({ extends: './tsconfig.json', compilerOptions: { outDir: './out-tsc/app' }, files: ['src/main.ts'], include: ['src/**/*.ts'] }),
    'index.html': `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${html(setup.project.name)}</title>\n</head>\n<body>\n  <app-root></app-root>\n  <script type="module" src="/src/main.ts"></script>\n</body>\n</html>\n`,
    'src/main.ts': "import '@angular/compiler';\nimport { bootstrapApplication } from '@angular/platform-browser';\nimport { App } from './app';\nimport './styles.scss';\n\nbootstrapApplication(App).catch(console.error);\n",
    'src/style.d.ts': "declare module '*.scss';\n",
    'src/site.ts': `// Generated by Aludel from aludel.json: one entry per page in the primary navigation.\nimport { PageBlock } from './page-blocks';\n\nexport interface SitePage { path: string; label: string; icon: string; description: string; pageType: string; blocks: PageBlock[]; }\nexport interface Site { name: string; pitch: string; feel: string; navigation: 'sidebar' | 'top'; auth: boolean; pages: SitePage[]; hero: string | null; }\n\nexport const site: Site = ${JSON.stringify(site, null, 2)};\n`,
    // Shared verbatim with the Aludel onboarding preview so the skeleton matches what was designed.
    'src/page-blocks.ts': sources.pageBlocks,
    'src/app.ts': appComponent,
    'src/app.html': appTemplate,
    'src/styles.scss': styles({ feel, theme, accent, surface }),
    'server/server.mjs': serverSource(Boolean(options.auth)),
    'licenses/Material-Symbols-LICENSE': sources.iconLicense
  };
  return { files, media, binaries: { 'public/fonts/icons.ttf': sources.iconFont } };
}

function styles({ feel, theme, accent, surface }) {
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
  @include mat.theme-overrides((primary: ${primary}, on-primary: ${onAccent}, primary-container: ${container}, surface: ${surface}));
  --app-radius: ${feel.radius}px;
  --app-font: ${feel.font};
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
    <a class="brand" href="/" (click)="go($event, '/')"><span class="brand-mark" aria-hidden="true">{{ initials(site.name) }}</span>{{ site.name }}</a>
    <nav class="nav" aria-label="Main">
      @for (item of site.pages; track item.path) {
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
      <h1 tabindex="-1">{{ current.label }}</h1>
      <p class="description" [class.empty]="!current.description">{{ current.description || 'This page is a skeleton. Describe what happens here in Aludel to build it out.' }}</p>
      <page-blocks [blocks]="current.blocks"></page-blocks>
    } @else {
      <h1 tabindex="-1">Page not found</h1>
      <p><a href="/" (click)="go($event, '/')">Go home</a></p>
    }
  </main>
  <nav class="tabs" aria-label="Sections">
    @for (item of site.pages; track item.path) {
      <a [href]="item.path" (click)="go($event, item.path)" [class.active]="path() === item.path" [attr.aria-current]="path() === item.path ? 'page' : null"><span class="icon" aria-hidden="true">{{ item.icon }}</span>{{ item.label }}</a>
    }
  </nav>
</div>
`;

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
