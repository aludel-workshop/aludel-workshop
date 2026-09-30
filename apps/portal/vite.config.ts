import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { fileURLToPath } from 'node:url';
const host = (path: string) => fileURLToPath(new URL('./src/' + path, import.meta.url));
const layerSdk = {
  '@aludel/host/context': host('layers/context.ts'),
  '@aludel/host/built-by': host('layers/built-by.ts'),
  '@aludel/host/design-components': host('layers/design-components.ts'),
  '@aludel/host/design-state': host('layers/design-state.ts'),
  '@aludel/host/page-blocks': host('page-blocks.ts'),
  '@aludel/host/design-tokens': host('design-tokens.js')
};
export default defineConfig({ resolve: { alias: layerSdk }, plugins: [angular({tsconfig:'tsconfig.app.json'})], server: {host:'127.0.0.1',watch:{usePolling:true,interval:500,ignored:['**/storybook-static/**','**/dist/**']}}, build:{outDir:'dist'} });
