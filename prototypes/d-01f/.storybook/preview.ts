import type {Preview} from '@storybook/angular-vite';
import {applicationConfig} from '@storybook/angular-vite';
import {provideAppInitializer,inject} from '@angular/core';
import {MatIconRegistry} from '@angular/material/icon';
import '../src/styles.scss';
const preview:Preview={decorators:[applicationConfig({providers:[provideAppInitializer(()=>{inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');})]})],parameters:{layout:'padded',a11y:{test:'error'}}};
export default preview;
