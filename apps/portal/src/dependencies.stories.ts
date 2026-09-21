import type { Meta, StoryObj } from '@storybook/angular';
import { DependencyListComponent } from './components';

const meta: Meta<DependencyListComponent> = { title: 'Work/Dependency currency', component: DependencyListComponent };
export default meta;
type Story = StoryObj<DependencyListComponent>;
export const CurrentAndStale: Story = { args: { records: [
  { id: 'PLAN-B02', project_id: 'the-machine', kind: 'plan', title: 'Information-system plan', revision: 1, status: 'active', currency: 'stale', stale_reason: 'DEC-MACHINE-DATA changed from revision 1 to 2.', dependency_count: 1 },
  { id: 'PLAN-B03', project_id: 'the-machine', kind: 'plan', title: 'Execution groundwork', revision: 1, status: 'blocked', currency: 'current', dependency_count: 0 }
] } };
