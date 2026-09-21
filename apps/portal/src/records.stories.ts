import type { Meta, StoryObj } from '@storybook/angular';
import { RecordListComponent } from './components';

const meta: Meta<RecordListComponent> = { title: 'Knowledge/Record list', component: RecordListComponent };
export default meta;
type Story = StoryObj<RecordListComponent>;
export const Populated: Story = { args: { records: [
  { id: 'status-001', title: 'Current project status', path: 'docs/status.md', kind: 'project-status', status: 'active', imported_at: '2026-09-20T00:00:00Z' },
  { id: 'architecture-001', title: 'Architecture proposal', path: 'docs/architecture.md', kind: 'architecture-proposal', status: 'accepted-direction', imported_at: '2026-09-20T00:00:00Z' }
] } };
export const Empty: Story = { args: { records: [], searchable: true } };
