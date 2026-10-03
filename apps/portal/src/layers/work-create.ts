import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext, LayerWorkAction, WorkItem, layerLabel, lines, priorityOrder } from './context';

type JourneyOffer = { kind: 'draft' | 'revise'; journey: { id: string; title: string; revision: number }; routes: string[] };

// A task names its layer (DEC-057) or, for a layer not yet converted, an existing action. The brief sets the job;
// neither can widen what the layer or action may change.
@Component({
  selector: 'aludel-work-create', standalone: true, imports: [FormsModule, MatIconModule],
  template: `
  @if (layer(); as key) {
    <a class="lay-back" [href]="ctx.link(key, 'tasks')" (click)="ctx.go(ctx.link(key, 'tasks'), $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Board</a>
    <h2 class="lay-tk-title">Create a {{ layerName(key) }} task</h2>
  } @else {
  <div class="lay-section-head"><div><p class="lay-eyebrow lay-layer"><mat-icon aria-hidden="true">checklist</mat-icon>Work</p><h1>Create task</h1></div>
    <a class="lay-button ghost small" [href]="ctx.link('work', 'board')" (click)="ctx.go(ctx.link('work', 'board'), $event)">Back to Board</a></div>
  }
  @if (scope(); as changes) {
    <p class="lay-lead">Describe this piece of work. The layer's charter guides it; an agent may change only this layer's {{ scopeText(changes) }}, and proposes anything else as a follow-up.</p>
  } @else {
    <p class="lay-lead">Choose an action, then describe this piece of work. The action sets what an agent may read and change; your brief sets the task.</p>
  }
  <form class="lay-card lay-form" (ngSubmit)="create()">
    <div class="lay-row lay-wrap lay-fields">
      @if (!layer()) { <label>Layer<select name="role" [ngModel]="role()" (ngModelChange)="changeRole($event)" required>
        @for (entry of layerKeys(); track entry) { <option [value]="entry">{{ layerName(entry) }}</option> }
      </select></label> }
      @if (!scope()) { <label>Action<select name="action" [ngModel]="selectedAction()?.id || ''" (ngModelChange)="changeAction($event)" required>
        @for (entry of actions(); track entry.id) { <option [value]="entry.id">{{ entry.name }}</option> }
      </select></label> }
      <label>Priority<select name="priority" [(ngModel)]="priority">@for (entry of priorities; track entry) { <option [value]="entry">{{ entry }}</option> }</select></label>
    </div>
    @if (scope()) {
    } @else if (selectedAction(); as chosen) {
      <p class="lay-muted small">{{ chosen.description }} @if (chosen.elevated) { · A human lead reviews this action. }</p>
      @if (chosen.changes.length) { <p class="lay-muted small">Action scope: {{ chosen.changes.join('; ') }}</p> }
    } @else if (layer(); as key) { <p class="lay-lock-note lay-lock-warn"><mat-icon aria-hidden="true">info</mat-icon>{{ layerName(key) }} has no runnable actions yet. Define or enable one in <a [href]="ctx.link(key, 'tasks', 'actions')" (click)="ctx.go(ctx.link(key, 'tasks', 'actions'), $event)">Actions</a>; a draft layer's actions start once it is active.</p> }
    <label>Task title<input name="title" [(ngModel)]="title" maxlength="160" required placeholder="What should be done?" /></label>
    <label>Task brief<textarea name="brief" [(ngModel)]="brief" maxlength="2000" rows="5" placeholder="The specific outcome, constraints, and relevant context"></textarea></label>
    <div class="lay-row lay-wrap lay-fields">
      <label>Target record<select name="target" [(ngModel)]="target"><option value="">No linked record</option>
        @for (entry of targets(); track entry.id) { <option [value]="entry.id">{{ entry.label }}</option> }
      </select></label>
      <label>Assignee<select name="assignee" [(ngModel)]="assignee"><option value="">{{ scope() ? 'Layer default' : 'Action default' }}</option>
        @for (member of ctx.data()?.members || []; track member.id) { <option [value]="'person:' + member.id">{{ member.id === ctx.me() ? 'You' : member.name }}</option> }
        @for (profile of ctx.data()?.profiles || []; track profile.id) { @if (profile.active) { <option [value]="'agent:' + profile.id">{{ profile.name }} (agent)</option> } }
      </select></label>
      <label>Place in<select name="state" [(ngModel)]="state"><option value="ready">Queue</option><option value="suggested">Backlog</option></select></label>
    </div>
    <label>Expected outputs, one per line<textarea name="outputs" [(ngModel)]="outputs" rows="2" placeholder="What should the task produce?"></textarea></label>
    <label>Review checks, one per line<textarea name="checks" [(ngModel)]="checks" rows="3" placeholder="How will you know it is done?"></textarea></label>
    @if (offered(); as o) {
      <div class="lay-card wc-offer" role="group" aria-labelledby="wc-offer-title"><mat-icon aria-hidden="true">route</mat-icon><div>
        @if (o.kind === 'draft') {
          <p id="wc-offer-title"><strong>No journey covers {{ o.routes.join(', ') }} yet.</strong> Draft one from the current app first?</p>
          <p class="small">Specify writes the journey: tests for what the app does today, then the steps this change needs. Accepting it raises the Implement task with those steps as its claims.</p>
        } @else {
          <p id="wc-offer-title"><strong>“{{ o.journey.title }}” covers {{ o.routes.join(', ') }}.</strong> Revise that journey first?</p>
          <p class="small">Specify writes revision {{ o.journey.revision }} of it; accepting it raises the Implement task with the changed steps as its claims.</p>
        }
        <label>Journey<input name="journeyTitle" [(ngModel)]="journeyTitle" maxlength="200" [readonly]="o.kind === 'revise'" /></label>
        <div class="lay-row lay-wrap"><button type="button" class="lay-button" (click)="specifyFirst(o)" [disabled]="!journeyTitle.trim()">Specify first</button>
          <button type="button" class="lay-button ghost" (click)="createAsWritten()">Create the task as written</button></div>
      </div></div>
    }
    @if (assignedAgent() && !runnable()) { <p class="lay-lock-note lay-lock-warn">This task is not ready for an agent run. It may need a linked target record, a connected agent, or an execution contract for this action. You can still create it for planning.</p> }
    @if (assignedAgent() && !target) { <p class="lay-muted small">Link a target record when the agent needs specific project context.</p> }
    <div class="lay-row lay-wrap"><button type="submit" class="lay-button" [disabled]="!title.trim() || !scope() && !selectedAction()">Create task</button>
      <span class="lay-muted small">Creating a task does not start an agent.</span></div>
  </form>`
})
export class WorkCreateComponent {
  readonly ctx = inject(ProjectContext);
  // Inside a layer's Tasks tab the layer is fixed, and an action row can preset its action.
  readonly layer = input<string | null>(null);
  readonly preset = input<string | null>(null);
  readonly priorities = priorityOrder;
  readonly role = signal('product');
  readonly action = signal('product.define');
  readonly layerKeys = computed(() => [...new Set([...this.ctx.layerInstances().filter(entry => entry.enabled && entry.workScope).map(entry => entry.key),
    ...(this.ctx.data()?.layerActions || []).map(action => action.layer)])]);
  // The change kinds agents may make in a layer-scoped layer; null while the layer still uses actions.
  readonly scope = computed(() => this.ctx.layerInstances().find(entry => entry.key === this.role())?.workScope || null);
  readonly actions = computed(() => (this.ctx.data()?.layerActions || []).filter(action => action.layer === this.role()));
  readonly selectedAction = computed<LayerWorkAction | null>(() => this.actions().find(entry => entry.id === this.action()) || this.actions()[0] || null);
  readonly targets = computed(() => {
    const data = this.ctx.data(); if (!data) return [];
    return [
      ...data.stories.map(entry => ({ id: entry.id, label: `Story · ${entry.ref} ${entry.title}` })),
      ...data.claims.map(entry => ({ id: entry.id, label: `Vision · ${entry.text}` })),
      ...data.pages.map(entry => ({ id: entry.id, label: `Page · ${entry.label}` })),
      ...data.flows.map(entry => ({ id: entry.id, label: `Flow · ${entry.title}` })),
      ...data.components.map(entry => ({ id: entry.id, label: `Component · ${entry.name}` })),
      ...data.objects.map(entry => ({ id: entry.id, label: `Object · ${entry.name}` })),
      ...data.operations.map(entry => ({ id: entry.id, label: `API · ${entry.operationId}` })),
      ...data.projects.map(entry => ({ id: entry.id, label: `Project · ${entry.ref} ${entry.title}` })),
      ...data.docs.map(entry => ({ id: entry.id, label: `Document · ${entry.title}` }))
    ];
  });
  title = ''; brief = ''; target = ''; assignee = ''; state = 'ready'; priority = 'medium'; outputs = ''; checks = '';
  // JOURNEYS-01 J5: Code offers to specify a journey first when the request reaches routes no journey covers.
  readonly offered = signal<JourneyOffer | null>(null);
  journeyTitle = '';
  constructor() {
    effect(() => {
      const layer = this.layer(), preset = this.preset(); this.actions();
      if (layer) untracked(() => { if (this.role() !== layer) this.role.set(layer); const id = preset && this.actions().some(entry => entry.id === preset) ? preset : this.actions()[0]?.id || ''; if (id && id !== this.action()) this.changeAction(id); });
    });
  }
  changeRole(layer: string) { this.role.set(layer); this.changeAction(this.actions()[0]?.id || ''); }
  layerName(layer: string) { return this.ctx.layerInstances().find(entry => entry.key === layer)?.name || layerLabel[layer] || layer; }
  changeAction(id: string) { this.action.set(id); this.checks = this.scope() ? '' : this.selectedAction()?.checks.join('\n') || ''; }
  // A layer that keeps its outputs as files (Code) has no API changes; its declared repository files bound it instead.
  scopeText(changes: Record<string, string[]>) { return Object.entries(changes).map(([kind, ops]) => `${kind}s (${ops.join(', ')})`).join(' and ') || 'declared repository files'; }
  assignedAgent() {
    if (this.assignee) return this.assignee.startsWith('agent:');
    if (this.scope()) return false;
    return this.selectedAction()?.assignee?.kind === 'agent';
  }
  runnable() {
    if (this.scope()) return this.assignee.startsWith('agent:') && Boolean(this.ctx.data()?.symphonyProfiles?.includes(this.assignee.slice(6)));
    const id = this.selectedAction()?.id || '';
    const profileId = this.assignee.startsWith('agent:') ? this.assignee.slice(6) : this.selectedAction()?.assignee?.id;
    if (!this.selectedAction()?.agentRunnable || !profileId || !this.ctx.data()?.symphonyProfiles?.includes(profileId)) return false;
    const story = this.ctx.data()?.stories.some(entry => entry.id === this.target);
    const object = this.ctx.data()?.objects.some(entry => entry.id === this.target);
    const flow = this.ctx.data()?.flows.some(entry => entry.id === this.target);
    if (id === 'product.define' || id === 'platform.implement') return Boolean(story);
    if (id === 'data.contract') return Boolean(object);
    if (id === 'product.brief') return !this.target || Boolean(this.ctx.data()?.claims.some(entry => entry.id === this.target));
    if (id === 'pages.flows') return !this.target || Boolean(story || flow && this.ctx.layerInstances().find(entry => entry.key === 'pages')?.packageCommit);
    return ['platform.security', 'design.audit', 'pages.a11y', 'deploy.review', 'work.review'].includes(id);
  }
  create() {
    const chosen = this.selectedAction(), scoped = Boolean(this.scope());
    if (!scoped && !chosen || !this.title.trim()) return;
    // Code is the `platform` layer (DEC-049).
    if (scoped && this.role() === 'platform' && !this.offered()) {
      void this.ctx.write(async () => {
        const answer = await this.ctx.api<{ offer: JourneyOffer | null }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work/journey-offer`, 'POST', { title: this.title.trim(), brief: this.brief.trim() });
        if (answer.offer) { this.journeyTitle = answer.offer.journey.title; this.offered.set(answer.offer); return; }
        await this.save();
      });
      return;
    }
    void this.ctx.write(() => this.save(), 'Task created.');
  }
  createAsWritten() { void this.ctx.write(() => this.save(), 'Task created.'); }
  specifyFirst(offer: JourneyOffer) {
    const [kind, id] = this.assignee ? this.assignee.split(':', 2) : [];
    const journey = { id: offer.journey.id, title: this.journeyTitle.trim() };
    void this.ctx.write(async () => {
      const created = await this.ctx.api<{ specify: WorkItem }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work/specify`, 'POST',
        { title: this.title.trim(), brief: this.brief.trim(), journey, priority: this.priority, state: this.state, ...(kind && id ? { assignee: { kind, id } } : {}) });
      this.ctx.go(this.ctx.link('work', 'item', created.specify.id));
    }, 'Specify task created.');
  }
  private async save() {
    const chosen = this.selectedAction(), scoped = Boolean(this.scope());
    const [kind, id] = this.assignee ? this.assignee.split(':', 2) : [];
    const body = { ...(scoped ? { layer: this.role() } : { action: chosen!.id }), title: this.title.trim(), suggestion: this.brief.trim(),
      targets: this.target ? [{ id: this.target }] : [], documents: lines(this.outputs), checks: lines(this.checks),
      priority: this.priority, state: this.state, ...(kind && id ? { assignee: { kind, id } } : {}) };
    const created = await this.ctx.api<WorkItem>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work`, 'POST', body);
    this.ctx.go(this.ctx.link('work', 'item', created.id));
  }
}
