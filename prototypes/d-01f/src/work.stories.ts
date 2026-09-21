import type {Meta,StoryObj} from '@storybook/angular-vite';
import {WorkSummaryComponent} from './components';
import {decisions,workFor} from './model';
const meta:Meta<WorkSummaryComponent>={title:'Patterns/Work summary',component:WorkSummaryComponent,args:{items:workFor(decisions)}};export default meta;
type Story=StoryObj<WorkSummaryComponent>;
export const Dependencies:Story={};export const AnsweredStillWaiting:Story={args:{items:workFor(decisions.map(d=>d.id==='BB-D01'?{...d,answer:d.options[0]}:d))}};
