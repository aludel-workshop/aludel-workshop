import type {Meta,StoryObj} from '@storybook/angular-vite';
import {PreviewSummaryComponent} from './components';
const meta:Meta<PreviewSummaryComponent>={title:'Patterns/Preview summary',component:PreviewSummaryComponent,args:{state:'none'}};export default meta;
type Story=StoryObj<PreviewSummaryComponent>;
export const NoCandidate:Story={};export const Unknown:Story={args:{state:'unknown'}};export const Candidate:Story={args:{state:'candidate',revision:'synthetic-r3'}};
