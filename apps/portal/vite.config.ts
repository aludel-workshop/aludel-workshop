import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
export default defineConfig({ plugins: [angular({tsconfig:'tsconfig.app.json'})], server: {host:'127.0.0.1',watch:{usePolling:true,interval:500,ignored:['**/storybook-static/**','**/dist/**']}}, build:{outDir:'dist'} });
