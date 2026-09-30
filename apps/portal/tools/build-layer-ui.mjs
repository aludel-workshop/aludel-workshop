// LAYER-BASE-01 B6: builds one layer's own views from an exact commit of its repository into a separate bundle that runs
// in a sandboxed frame. Repository content is input data: its files are compiled, never executed here, and only files
// the manifest lists under ui/ are taken. Usage: node tools/build-layer-ui.mjs <repo> <commit> <key> <outDir>
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

const [repo, commit, key, outDir] = process.argv.slice(2);
if (!repo || !/^[0-9a-f]{40}$/.test(commit || '') || !/^[a-z][a-z0-9_]{2,31}$/.test(key || '') || !outDir) throw new Error('Usage: build-layer-ui <repo> <commit> <key> <outDir>');
const portal = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 16 * 1024 * 1024 });
const manifest = JSON.parse(git('show', `${commit}:layer.json`).toString());
if (manifest.key !== key || !manifest.ui?.entry || !Array.isArray(manifest.ui.files) || !manifest.ui.files.includes(manifest.ui.entry)) throw new Error('This layer declares no views.');
const scratch = mkdtempSync(join(portal, '.layer-ui-src-'));
try {
  const ui = join(scratch, 'ui');
  mkdirSync(ui);
  for (const path of manifest.ui.files) {
    if (!/^ui\/[a-z][a-z0-9-]*\.(?:ts|scss)$/.test(path)) throw new Error(`Invalid layer view path: ${path}`);
    writeFileSync(join(scratch, path), git('show', `${commit}:${path}`));
  }
  writeFileSync(join(scratch, 'styles.scss'), manifest.ui.files.filter(path => path.endsWith('.scss')).map(path => `@use './${path.slice(0, -5)}';`).join('\n') + '\n');
  const base = JSON.parse(readFileSync(join(portal, 'tsconfig.json'), 'utf8'));
  writeFileSync(join(scratch, 'tsconfig.json'), JSON.stringify({ ...base, compilerOptions: { ...base.compilerOptions, baseUrl: portal,
    paths: Object.fromEntries(Object.entries(base.compilerOptions.paths || {}).map(([name, targets]) => [name, targets.map(target => resolve(portal, target))])) },
    files: [join(portal, 'src/frame/frame-main.ts')], include: [join(portal, 'src/**/*.ts'), join(ui, '**/*.ts')], exclude: [join(portal, 'src/**/*.stories.ts')] }, null, 2));
  const host = path => join(portal, 'src', path);
  await build({ configFile: false, root: join(portal, 'src/frame'), base: './', logLevel: 'warn',
    resolve: { alias: { '@aludel/host/context': host('layers/context.ts'), '@aludel/host/built-by': host('layers/built-by.ts'),
      '@aludel/host/design-components': host('layers/design-components.ts'), '@aludel/host/design-state': host('layers/design-state.ts'),
      '@aludel/host/page-blocks': host('page-blocks.ts'), '@aludel/host/design-tokens': host('design-tokens.js'),
      '@aludel/layer/entry': join(scratch, manifest.ui.entry), '@aludel/layer/styles': join(scratch, 'styles.scss') } },
    plugins: [angular({ tsconfig: join(scratch, 'tsconfig.json'), workspaceRoot: portal })],
    build: { outDir: resolve(outDir), emptyOutDir: true, chunkSizeWarningLimit: 4096 } });
  // Viewport units follow the portal's viewport, so a frame sized to its content lays out as it did in the portal.
  const assets = join(resolve(outDir), 'assets');
  for (const file of readdirSync(assets).filter(name => name.endsWith('.css'))) {
    const path = join(assets, file);
    writeFileSync(path, readFileSync(path, 'utf8').replace(/(-?\d*\.?\d+)vh\b/g, (_, value) => `calc(var(--aludel-vh, 100vh) * ${value} / 100)`));
  }
  writeFileSync(join(resolve(outDir), 'build.json'), JSON.stringify({ key, commit, builtAt: new Date().toISOString() }));
} finally { rmSync(scratch, { recursive: true, force: true }); }
