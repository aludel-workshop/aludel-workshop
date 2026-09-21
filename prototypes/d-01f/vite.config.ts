import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
export default defineConfig({ plugins: [angular({tsconfig:'tsconfig.app.json'})], server: {host:'0.0.0.0',allowedHosts:['terminal.local'],watch:{usePolling:true,interval:500,ignored:['**/storybook-static/**','**/dist/**']}}, build:{outDir:'dist'} });
