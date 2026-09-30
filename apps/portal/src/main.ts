import '@angular/compiler';
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app';
import './styles.scss';
import './installed/pages/pages.scss';
bootstrapApplication(App).catch(console.error);
