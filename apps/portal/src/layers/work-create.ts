import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext, LayerWorkAction, WorkItem, layerLabel, lines, priorityOrder } from './context';

// A task starts with an existing action. Its freeform brief can narrow the job, but cannot change that action's permissions.
@Component({
  selector: 'aludel-work-create', standalone: true, imports: [FormsModule, MatIconModule],
  template: `
  <div class="lay-section-head"><div><p class="lay-eyebrow lay-layer"><mat-icon aria-hidden="true">checklist</mat-icon>Work</p><h1>Create task</h1></div>
    <a class="lay-button ghost small" [href]="ctx.link('work', 'board')" (click)="ctx.go(ctx.link('work', 'board'), $event)">Back to Board</a></div>
  <p class="lay-lead">Choose an action, then describe this piece of work. The action sets what an agent may read and change; your brief sets the task.</p>
  <form class="lay-card lay-form" (ngSubmit)="create()">
    <div class="lay-row lay-wrap lay-fields">
      <label>Layer<select name="role" [ngModel]="role()" (ngModelChange)="changeRole($event)" required>
        @for (entry of layerKeys(); track entry) { <option [value]="entry">{{ layerName(entry) }}</option> }
      </select></label>
      <label>Action<select name="action" [ngModel]="selectedAction()?.id || ''" (ngModelChange)="changeAction($event)" required>
        @for (entry of actions(); track entry.id) { <option [value]="entry.id">{{ entry.name }}</option> }
      </select></label>
      <label>Priority<select name="priority" [(ngModel)]="priority">@for (entry of priorities; track entry) { <option [value]="entry">{{ entry }}</option> }</select></label>
    </div>
    @if (selectedAction(); as chosen) {
      <p class="lay-muted small">{{ chosen.description }} @if (chosen.elevated) { · A human lead reviews this action. }</p>
      @if (chosen.changes.length) { <p class="lay-muted small">Action scope: {{ chosen.changes.join('; ') }}</p> }
    }
    <label>Task title<input name="title" [(ngModel)]="title" maxlength="160" required placeholder="What should be done?" /></label>
    <label>Task brief<textarea name="brief" [(ngModel)]="brief" maxlength="2000" rows="5" placeholder="The specific outcome, constraints, and relevant context"></textarea></label>
    <div class="lay-row lay-wrap lay-fields">
      <label>Target record<select name="target" [(ngModel)]="target"><option value="">No linked record</option>
        @for (entry of targets(); track entry.id) { <option [value]="entry.id">{{ entry.label }}</option> }
      </select></label>
      <label>Assignee<select name="assignee" [(ngModel)]="assignee"><option value="">Action default</option>
        @for (member of ctx.data()?.members || []; track member.id) { <option [value]="'person:' + member.id">{{ member.id === ctx.me() ? 'You' : member.name }}</option> }
        @for (profile of ctx.data()?.profiles || []; track profile.id) { @if (profile.active) { <option [value]="'agent:' + profile.id">{{ profile.name }} (agent)</option> } }
      </select></label>
      <label>Place in<select name="state" [(ngModel)]="state"><option value="ready">Queue</option><option value="suggested">Backlog</option></select></label>
    </div>
    <label>Expected outputs, one per line<textarea name="outputs" [(ngModel)]="outputs" rows="2" placeholder="What should the task produce?"></textarea></label>
    <label>Review checks, one per line<textarea name="checks" [(ngModel)]="checks" rows="3" placeholder="How will you know it is done?"></textarea></label>
    @if (assignedAgent() && !runnable()) { <p class="lay-lock-note lay-lock-warn">This task is not ready for an agent run. It may need a linked target record, a connected agent, or an execution contract for this action. You can still create it for planning.</p> }
    @if (assignedAgent() && !target) { <p class="lay-muted small">Link a target record when the agent needs specific project context.</p> }
    <div class="lay-row lay-wrap"><button type="submit" class="lay-button" [disabled]="!title.trim() || !selectedAction()">Create task</button>
      <span class="lay-muted small">Creating a task does not start an agent.</span></div>
  </form>`
})
export class WorkCreateComponent {
  readonly ctx = inject(ProjectContext);
  readonly priorities = priorityOrder;
  readonly role = signal('product');
  readonly action = signal('product.define');
  readonly layerKeys = computed(() => [...new Set((this.ctx.data()?.layerActions || []).map(action => action.layer))]);
  readonly actions = computed(() => (this.ctx.data()?.layerActions || []).filter(action => action.layer === this.role()));
  readonly selectedAction = computed<LayerWorkAction | null>(() => this.actions().find(entry => entry.id === this.action()) || this.actions()[0] || null);
  readonly targets = computed(() => {
    const data = this.ctx.data(); if (!data) return [];
    return [
      ...data.stories.map(entry => ({ id: entry.id, label: `Story · ${entry.ref} ${entry.title}` })),
      ...data.claims.map(entry => ({ id: entry.id, label: `Vision · ${entry.text}` })),
      ...data.pages.map(entry => ({ id: entry.id, label: `Page · ${entry.label}` })),
      ...data.components.map(entry => ({ id: entry.id, label: `Component · ${entry.name}` })),
      ...data.objects.map(entry => ({ id: entry.id, label: `Object · ${entry.name}` })),
      ...data.operations.map(entry => ({ id: entry.id, label: `API · ${entry.operationId}` })),
      ...data.projects.map(entry => ({ id: entry.id, label: `Project · ${entry.ref} ${entry.title}` })),
      ...data.docs.map(entry => ({ id: entry.id, label: `Document · ${entry.title}` }))
    ];
  });
  title = ''; brief = ''; target = ''; assignee = ''; state = 'ready'; priority = 'medium'; outputs = ''; checks = '';
  changeRole(layer: string) { this.role.set(layer); this.changeAction(this.actions()[0]?.id || ''); }
  layerName(layer: string) { return layerLabel[layer] || layer; }
  changeAction(id: string) { this.action.set(id); this.checks = this.selectedAction()?.checks.join('\n') || ''; }
  assignedAgent() {
    if (this.assignee) return this.assignee.startsWith('agent:');
    return this.selectedAction()?.assignee?.kind === 'agent';
  }
  runnable() {
    const id = this.selectedAction()?.id || '';
    const profileId = this.assignee.startsWith('agent:') ? this.assignee.slice(6) : this.selectedAction()?.assignee?.id;
    if (!this.selectedAction()?.agentRunnable || !profileId || !this.ctx.data()?.symphonyProfiles?.includes(profileId)) return false;
    const story = this.ctx.data()?.stories.some(entry => entry.id === this.target);
    const object = this.ctx.data()?.objects.some(entry => entry.id === this.target);
    if (id === 'product.define' || id === 'platform.implement') return Boolean(story);
    if (id === 'data.contract') return Boolean(object);
    if (id === 'product.brief') return !this.target || Boolean(this.ctx.data()?.claims.some(entry => entry.id === this.target));
    return ['platform.security', 'design.audit', 'pages.a11y', 'deploy.review', 'work.review'].includes(id);
  }
  create() {
    const chosen = this.selectedAction();
    if (!chosen || !this.title.trim()) return;
    const [kind, id] = this.assignee ? this.assignee.split(':', 2) : [];
    const body = { action: chosen.id, title: this.title.trim(), suggestion: this.brief.trim(),
      targets: this.target ? [{ id: this.target }] : [], documents: lines(this.outputs), checks: lines(this.checks),
      priority: this.priority, state: this.state, ...(kind && id ? { assignee: { kind, id } } : {}) };
    void this.ctx.write(async () => {
      const created = await this.ctx.api<WorkItem>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work`, 'POST', body);
      this.ctx.go(this.ctx.link('work', 'item', created.id));
    }, 'Task created.');
  }
}
