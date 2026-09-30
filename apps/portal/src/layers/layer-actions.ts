import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Assignee, ProjectContext, layerLabel } from './context';
import { layerColourStyle } from './layer-nav';
import { AssigneeComponent } from './work-shared';

export interface LayerActionSetting { id: string; revision: number; title: string; purpose: string; elevated: boolean; available: boolean;
  assignee: Assignee | null; installedStyle: string | null; method: string; methodRevision: number; unavailableReason: string | null;
  checks: string[]; reads: { layer: string; kind: string }[]; result: { owner: string; kind: string; operation: string } | null; fileWrites: string[];
  effects: string[]; reviewer: string | null; humanRunnable: boolean; agentRunnable: boolean; }

const words = (value: string) => value.replace(/[_-]+/g, ' ');

// Tasks › Actions (CUSTOM-LAYER-01): the Work › Roles composition for one layer. The header says who can act; each row is
// an action with its default assignee, a Setup panel (method, what it reads and may change, the checks its work is reviewed
// against) and its elevated shield. Custom layers add actions from a last row in the same panel shape.
@Component({
  selector: 'aludel-layer-actions', standalone: true, imports: [FormsModule, MatIconModule, AssigneeComponent],
  template: `
  <h2 class="lay-tk-title">Actions</h2>
  <p class="lay-muted">The kinds of work {{ name() }} does. Each new task starts from one, goes to its default assignee and is reviewed against its checks.</p>
  @if (!ctx.agentReady()) {
    <div class="lay-banner-warn" role="note"><mat-icon aria-hidden="true">power_off</mat-icon><p><strong>Agents can't take work yet.</strong>
      Actions assigned to an agent wait until agent execution is enabled. <a [href]="ctx.link('work', 'agents')" (click)="ctx.go(ctx.link('work', 'agents'), $event)">Agents</a></p></div>
  }
  <section [class]="'lay-role lay-role-tint lay-lc-' + layerKey()" [style]="colour()" [attr.aria-labelledby]="'role-heading-' + layerKey()">
    <header>
      <div class="lay-row lay-wrap"><span class="lay-tile lay-tile-solid"><mat-icon aria-hidden="true">{{ layer()?.icon || 'layers' }}</mat-icon></span>
        <h3 [id]="'role-heading-' + layerKey()" class="lay-flat lay-role-name">{{ name() }}</h3></div>
      <span class="lay-refs">@for (member of crew(); track member.id) { <span class="lay-rchip">@if (member.lead) { <mat-icon aria-label="elevated" role="img" class="lay-shield">shield_person</mat-icon> }{{ member.name }}</span> }</span>
      <p>{{ layer()?.description }}</p>
      <a class="lay-role-link" [href]="ctx.link(layerKey(), 'knowledge', 'identity')" (click)="ctx.go(ctx.link(layerKey(), 'knowledge', 'identity'), $event)"><mat-icon aria-hidden="true">menu_book</mat-icon>Charter · read before every action</a>
      <details><summary><mat-icon aria-hidden="true">group</mat-icon>Who can act</summary>
        <ul class="lay-role-grants">@for (member of ctx.data()?.members || []; track member.id) {
          <li><span>{{ member.id === ctx.me() ? 'You' : member.name }}</span>
            @if (member.role === 'owner') { <small>Owner: every action</small> }
            @else { <label><input type="checkbox" [checked]="granted(member.id, 'normal')" [disabled]="!canManage()" (change)="toggleGrant(member.id, 'normal', $event)"> Normal</label>
              <label><input type="checkbox" [checked]="granted(member.id, 'elevated')" [disabled]="!canManage()" (change)="toggleGrant(member.id, 'elevated', $event)"> Elevated</label> }</li>
        }</ul>
        <p class="lay-hint">Elevated actions need an elevated grant, and their results wait for a human review.</p></details>
    </header>
    <ul class="lay-actions">
      @if (loading() && !actions().length) { <li><p class="lay-arow" role="status">Loading actions…</p></li> }
      @for (action of actions(); track action.id) {
        <li [id]="'action-' + action.id">
          <div class="lay-arow">
            <div><strong>{{ action.title }}</strong>@if (routineFor(action); as routine) { <span class="lay-tag"><mat-icon aria-hidden="true">event_repeat</mat-icon>Routine</span> }
              <small>{{ action.purpose }}</small>
              @if (!action.available) { <small class="lay-warn-text"><mat-icon aria-hidden="true">info</mat-icon>{{ action.unavailableReason || 'No checked adapter is installed.' }}</small> }
              @else if (action.assignee?.kind === 'agent' && !ctx.agentReady()) { <small class="lay-warn-text"><mat-icon aria-hidden="true">schedule</mat-icon>Waits for agent execution to be enabled</small> }</div>
            <aludel-assignee [assignee]="action.assignee" label="Default assignee" [allowPeople]="action.humanRunnable" [allowAgents]="action.agentRunnable" [locked]="assigneeLock(action)" (changed)="assign(action, $event)" />
            <button type="button" class="lay-setup-btn" [attr.aria-expanded]="openAction() === action.id" [attr.aria-controls]="'setup-' + action.id" (click)="toggle(action)">Setup<mat-icon aria-hidden="true">expand_more</mat-icon></button>
            <span class="lay-elev lay-elev-static" role="img" [attr.data-elevated]="action.elevated" [attr.aria-label]="(action.elevated ? 'Elevated: ' : 'Normal: ') + action.title" [title]="action.elevated ? 'Elevated: needs an elevated grant; results wait for a human review' : 'Normal: anyone with a grant for this layer'">
              <mat-icon aria-hidden="true">{{ action.elevated ? 'shield_person' : 'shield' }}</mat-icon></span>
          </div>
          @if (openAction() === action.id) {
            <form class="lay-setup" [id]="'setup-' + action.id" (ngSubmit)="saveMethod(action)" [attr.aria-label]="action.title + ' setup'">
              <div><h4><mat-icon aria-hidden="true">menu_book</mat-icon>Method <span class="lay-tag">revision {{ action.methodRevision }}</span></h4>
                <label class="visually-hidden" [for]="'method-' + action.id">Method for {{ action.title }}</label>
                <textarea [id]="'method-' + action.id" name="method" rows="6" maxlength="8000" [(ngModel)]="method" [readonly]="!canManage()" [placeholder]="'How anyone doing “' + action.title + '” should work'"></textarea>
                <p class="lay-hint">Read after the charter, before the task's own brief. Runs keep the revision they started with.</p></div>
              <div class="lay-setup-side">
                <div><h4><mat-icon aria-hidden="true">visibility</mat-icon>Always reads</h4>
                  <div class="lay-tokens">@for (read of action.reads; track read.layer + read.kind) { <span class="lay-token lay-token-ro">{{ layerName(read.layer) }} › {{ words(read.kind) }}</span> }
                    @empty { <span class="lay-token lay-token-none">Only the task's own links</span> }</div></div>
                <div><h4><mat-icon aria-hidden="true">edit</mat-icon>May change</h4>
                  <div class="lay-tokens">@if (action.result; as result) { <span class="lay-token lay-token-ro">{{ layerName(result.owner) }} › {{ words(result.kind) }} · {{ result.operation }}</span> }
                    @for (path of action.fileWrites; track path) { <span class="lay-token lay-token-ro">{{ path }}</span> }
                    @if (!action.result && !action.fileWrites.length) { <span class="lay-token lay-token-none">Nothing: suggestions only</span> }</div>
                  @if (action.effects.length) { <p class="lay-hint">Effects: {{ action.effects.map(words).join(', ') }}. Everything else is read-only.</p> }</div>
              </div>
              <div class="lay-setup-full"><h4><mat-icon aria-hidden="true">task_alt</mat-icon>Done when</h4>
                <ul class="lay-checklist">@for (check of action.checks; track check) { <li>{{ check }}</li> } @empty { <li class="lay-muted">No checks declared.</li> }</ul>
                <p class="lay-hint">New tasks copy these checks; review goes through them one by one. Reviewed by {{ reviewerLabel(action.reviewer) }}.</p></div>
              <div class="lay-setup-full lay-row lay-wrap">
                @if (canManage()) { <button type="submit" class="lay-button small" [disabled]="busy() || !method.trim() || method === action.method">Save method</button> }
                @if (action.available) { <a class="lay-button ghost small" [href]="ctx.link(layerKey(), 'tasks', 'create', action.id)" (click)="ctx.go(ctx.link(layerKey(), 'tasks', 'create', action.id), $event)"><mat-icon aria-hidden="true">add_task</mat-icon>Create a task</a> }
                <button type="button" class="lay-button ghost small" (click)="openAction.set(null)">Close</button></div>
            </form>
          }
        </li>
      } @empty { @if (!loading()) { <li><p class="lay-arow lay-muted">No actions yet.</p></li> } }
      @if (isCustom() && canManage()) {
        <li id="action-new">
          <div class="lay-arow"><div><strong>New action</strong><small>Name a kind of work {{ name() }} does, how it is done and how it is reviewed.</small></div><span></span>
            <button type="button" class="lay-setup-btn" [attr.aria-expanded]="openAction() === 'new'" aria-controls="setup-new" (click)="openAction.set(openAction() === 'new' ? null : 'new')">Add<mat-icon aria-hidden="true">expand_more</mat-icon></button><span></span></div>
          @if (openAction() === 'new') {
            <form class="lay-setup" id="setup-new" (ngSubmit)="addAction()" aria-label="New action">
              <div><h4><mat-icon aria-hidden="true">bolt</mat-icon>Name</h4>
                <label class="visually-hidden" for="new-action-title">Action name</label><input id="new-action-title" name="title" [ngModel]="draft.title" (ngModelChange)="draft.title = $event; suggestKey()" placeholder="Add a research source">
                <p class="lay-hint lay-key-hint"><label for="new-action-key">Key</label><input id="new-action-key" name="key" class="lay-inline-key" [(ngModel)]="draft.key" placeholder="add_source"></p>
                <h4 class="lay-rt-gap"><mat-icon aria-hidden="true">menu_book</mat-icon>Method</h4>
                <label class="visually-hidden" for="new-action-method">Method</label><textarea id="new-action-method" name="method" rows="5" [(ngModel)]="draft.method" placeholder="How should the work be done?"></textarea></div>
              <div class="lay-setup-side"><div><h4><mat-icon aria-hidden="true">info</mat-icon>Purpose</h4>
                <label class="visually-hidden" for="new-action-purpose">Purpose</label><textarea id="new-action-purpose" name="purpose" rows="4" [(ngModel)]="draft.purpose" placeholder="What outcome does this action produce?"></textarea></div>
                <div><h4><mat-icon aria-hidden="true">edit</mat-icon>May change</h4><div class="lay-tokens"><span class="lay-token lay-token-ro">{{ name() }} › markdown document · edit</span></div>
                  <p class="lay-hint">Custom actions edit this layer's Markdown files and are reviewed by the project owner.</p></div></div>
              <div class="lay-setup-full"><h4><mat-icon aria-hidden="true">task_alt</mat-icon>Done when</h4>
                <label class="visually-hidden" for="new-action-checks">Checks, one per line</label><textarea id="new-action-checks" name="checks" rows="3" [(ngModel)]="draft.checks" placeholder="Source and provenance are recorded"></textarea>
                <p class="lay-hint">One per line, up to eight. Review goes through them one by one.</p></div>
              <div class="lay-setup-full lay-row lay-wrap"><button type="submit" class="lay-button small" [disabled]="busy() || !ready()">Add action</button>
                <button type="button" class="lay-button ghost small" (click)="openAction.set(null)">Cancel</button>
                @if (!ready()) { <span class="lay-muted small">Needs a name, key, purpose, method and one to eight checks.</span> }</div>
            </form>
          }
        </li>
      }
    </ul>
  </section>`
})
export class LayerActionsComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly focus = input<string | null>(null);
  readonly words = words;
  readonly layer = computed(() => this.ctx.layerInstances().find(item => item.key === this.layerKey()) || null);
  readonly name = computed(() => this.layer()?.name || this.layerKey());
  readonly colour = computed(() => layerColourStyle(this.layer()));
  readonly isCustom = computed(() => this.layer()?.editorAdapter === 'markdown-editor');
  readonly canManage = computed(() => this.ctx.session()?.projects.find(project => project.id === this.ctx.projectId())?.role === 'owner');
  readonly actions = signal<LayerActionSetting[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly openAction = signal<string | null>(null);
  // The owner and anyone granted this layer; an elevated grant gets the shield, as leads did in Roles.
  readonly crew = computed(() => (this.ctx.data()?.members || []).map(member => {
    const grants = (this.ctx.data()?.layerGrants || []).filter(grant => grant.userId === member.id && grant.layer === this.layerKey());
    return { id: member.id, name: member.id === this.ctx.me() ? 'You' : member.name.split(' ')[0], lead: member.role === 'owner' || grants.some(grant => grant.level === 'elevated'), in: member.role === 'owner' || grants.length > 0 };
  }).filter(member => member.in));
  method = '';
  draft = { title: '', key: '', purpose: '', method: '', checks: '' };
  private suggested = '';
  private sequence = 0;

  constructor() {
    effect(() => { const projectId = this.ctx.projectId(), key = this.layerKey(); this.layer()?.domainActions; if (projectId && key) void this.load(); });
    // /<layer>/tasks/actions/<action> opens that action's setup and scrolls to it.
    effect(() => {
      const focus = this.focus(), list = this.actions();
      untracked(() => {
        const action = focus && list.find(entry => entry.id === focus);
        if (!action || this.openAction() === action.id) return;
        this.open(action);
        setTimeout(() => document.getElementById(`action-${action.id}`)?.scrollIntoView({ block: 'center' }), 60);
      });
    });
  }
  private async load() {
    const sequence = ++this.sequence; this.loading.set(true);
    try {
      const result = await this.ctx.api<{ actions: LayerActionSetting[] }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/layer-actions/${encodeURIComponent(this.layerKey())}`);
      // A server from before these fields existed still renders: missing declaration facts read as empty.
      if (sequence === this.sequence) this.actions.set(result.actions.map(action => ({ ...action, checks: action.checks || [], reads: action.reads || [], result: action.result || null, fileWrites: action.fileWrites || [],
        effects: action.effects || [], humanRunnable: action.humanRunnable ?? action.available, agentRunnable: action.agentRunnable ?? action.available })));
    } catch (error) { if (sequence === this.sequence) this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
    finally { if (sequence === this.sequence) this.loading.set(false); }
  }
  private open(action: LayerActionSetting) { this.method = action.method; this.openAction.set(action.id); }
  toggle(action: LayerActionSetting) { if (this.openAction() === action.id) this.openAction.set(null); else this.open(action); }
  layerName(key: string) { return this.ctx.layerInstances().find(entry => entry.key === key)?.name || layerLabel[key] || key; }
  reviewerLabel(reviewer: string | null) { return reviewer === 'project-owner' || !reviewer ? 'the project owner' : words(reviewer); }
  routineFor(action: LayerActionSetting) { return (this.ctx.data()?.routines || []).find(routine => routine.layer === this.layerKey() && routine.actionKey && `${routine.layer}.${routine.actionKey}` === action.id) || null; }
  assigneeLock(action: LayerActionSetting) { return !action.available ? 'This action has no checked adapter yet' : !this.canManage() ? 'Only the project owner changes defaults' : null; }
  granted(userId: string, level: string) { return Boolean(this.ctx.data()?.layerGrants.some(grant => grant.userId === userId && grant.layer === this.layerKey() && !grant.actionId && grant.level === level)); }
  toggleGrant(userId: string, level: 'normal' | 'elevated', event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/layer-grants`, 'PUT', { userId, layerKey: this.layerKey(), level, enabled }), 'Permission saved.');
  }
  assign(action: LayerActionSetting, assignee: Assignee) {
    void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/layer-actions/${encodeURIComponent(this.layerKey())}/${encodeURIComponent(action.id)}`, 'PUT',
      { assignee: { kind: assignee.kind, id: assignee.id } }), `New “${action.title}” tasks go to ${this.ctx.whoName(assignee)}. Existing tasks keep their assignee.`).then(() => void this.load());
  }
  async saveMethod(action: LayerActionSetting) {
    this.busy.set(true);
    const saved = await this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/layer-actions/${encodeURIComponent(this.layerKey())}/${encodeURIComponent(action.id)}`, 'PUT',
      { method: this.method, expectedRevision: action.methodRevision }), `${action.title} method saved. New runs use it.`);
    this.busy.set(false);
    if (saved) await this.load();
  }
  // The same fields the server requires, so the button never leads to a refusal.
  ready() { const checks = this.draft.checks.split('\n').filter(line => line.trim()).length;
    return !!(this.draft.key.trim() && this.draft.title.trim() && this.draft.purpose.trim() && this.draft.method.trim() && checks >= 1 && checks <= 8); }
  // The key follows the name until someone types their own.
  suggestKey() { if (this.draft.key && this.draft.key !== this.suggested) return; this.suggested = this.draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32); this.draft.key = this.suggested; }
  async addAction() {
    const checks = this.draft.checks.split('\n').map(value => value.trim()).filter(Boolean);
    const key = this.draft.key.trim();
    this.busy.set(true);
    const saved = await this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/layer-definitions/${encodeURIComponent(this.layerKey())}/actions`, 'POST',
      { key, title: this.draft.title.trim(), purpose: this.draft.purpose.trim(), method: this.draft.method.trim(), checks }), 'Action added.');
    this.busy.set(false);
    if (saved) { this.suggested = ''; this.draft = { title: '', key: '', purpose: '', method: '', checks: '' }; this.openAction.set(null); await this.load(); }
  }
}
