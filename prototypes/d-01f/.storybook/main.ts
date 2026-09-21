import type { StorybookConfig } from '@storybook/angular-vite';
const config:StorybookConfig={stories:['../src/**/*.stories.ts'],addons:['@storybook/addon-a11y'],framework:{name:'@storybook/angular-vite',options:{compodoc:false}},features:{experimentalDocgenServer:false},core:{disableTelemetry:true}};
export default config;
