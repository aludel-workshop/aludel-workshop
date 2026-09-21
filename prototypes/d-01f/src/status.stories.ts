import type {Meta,StoryObj} from '@storybook/angular-vite';
import {StatusComponent} from './components';
const meta:Meta<StatusComponent>={title:'Primitives/Status',component:StatusComponent,args:{label:'Blocked',variant:'label'}};export default meta;
type Story=StoryObj<StatusComponent>;
export const Blocked:Story={};export const Waiting:Story={args:{label:'Waiting'}};export const Ready:Story={args:{label:'Ready'}};export const ChipSubstitution:Story={args:{label:'Blocked',variant:'chip'}};
