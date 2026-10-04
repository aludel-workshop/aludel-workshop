import { Component, computed, effect, inject, input, output, signal, untracked, HostListener, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext, LayerWorkAction, WorkItem, RunFollowUp, layerLabel, priorityOrder } from './context';

type Journey = { id: string; title: string; revision: number; persona: string; steps: { id: string; title: string }[] };
type LinkedJourney = { id: string; revision: number; steps: string[] };
type Draft = { title: string; brief: string; assignee: string; state: string; priority: string; target: string; role: string; action: string; criteria: string[]; linked: LinkedJourney[]; specify: boolean; journeyTitle: string };

@Component({
  selector: 'aludel-work-create', standalone: true, imports: [FormsModule, MatIconModule, A11yModule],
  styleUrl: './work-create.css',
  template: `
  @if (minimized()) {
    <button class="wc-dock" (click)="minimized.set(false)"><mat-icon aria-hidden="true">edit_note</mat-icon>{{ title || 'Task draft' }}<span>Resume</span></button>
  } @else {
  <div class="wc-screen" [class.wc-inline]="embedded()" [class.wc-expanded]="expanded()">
  <section class="wc-composer" [attr.role]="embedded() ? 'region' : 'dialog'" [attr.aria-modal]="embedded() ? null : 'true'" [attr.aria-labelledby]="fieldId('heading')" [cdkTrapFocus]="!embedded()" [cdkTrapFocusAutoCapture]="!embedded()">
    <header class="wc-header"><div class="wc-context"><span class="wc-project">{{ projectName() }}</span><span class="wc-divider"></span><mat-icon aria-hidden="true">checklist</mat-icon><h2 [id]="fieldId('heading')">{{ embedded() ? 'Suggested task' : 'Create task' }}</h2><span class="wc-divider"></span><span>{{ layerName(role()) }}</span></div>
      @if (!embedded()) { <div class="wc-actions"><button type="button" aria-label="Minimize draft" (click)="remember(); minimized.set(true)"><mat-icon>remove</mat-icon></button><button type="button" [attr.aria-label]="expanded() ? 'Collapse composer' : 'Expand composer'" (click)="expanded.set(!expanded())"><mat-icon>open_in_full</mat-icon></button><button type="button" aria-label="Close composer" (click)="close()"><mat-icon>close</mat-icon></button></div> }
    </header>
    <form (ngSubmit)="create()"><fieldset [disabled]="saving()">
    <div class="wc-content">
      @if (discarding()) { <div class="wc-discard"><p>Discard this draft?</p><button type="button" class="wc-secondary" (click)="discarding.set(false)">Keep editing</button><button type="button" class="wc-quiet" (click)="discard()">Discard</button></div> }
      <label class="wc-sr" [for]="fieldId('title')">Title</label><input [id]="fieldId('title')" name="title" class="wc-title" [(ngModel)]="title" (ngModelChange)="remember()" maxlength="160" placeholder="What needs to be done?" required cdkFocusInitial>
      <label class="wc-sr" [for]="fieldId('description')">Description</label><textarea [id]="fieldId('description')" name="brief" class="wc-description" [(ngModel)]="brief" (ngModelChange)="remember()" maxlength="2000" placeholder="Add a description…"></textarea>
      <div class="wc-metadata">
        @if (!layer()) { <label class="wc-meta"><span class="wc-sr">Layer</span><select aria-label="Layer" name="role" [ngModel]="role()" (ngModelChange)="changeRole($event)">@for (key of layerKeys(); track key) { <option [value]="key">{{ layerName(key) }}</option> }</select></label> }
        @if (!scope()) { <label class="wc-meta"><span class="wc-sr">Action</span><select aria-label="Action" name="action" [ngModel]="selectedAction()?.id || ''" (ngModelChange)="action.set($event); remember()">@for (entry of actions(); track entry.id) { <option [value]="entry.id">{{ entry.name }}</option> }</select></label> }
        <label class="wc-meta"><mat-icon aria-hidden="true">person</mat-icon><span class="wc-sr">Assignee</span><select aria-label="Assignee" name="assignee" [(ngModel)]="assignee" (ngModelChange)="remember()"><option value="">{{ scope() ? 'Layer default' : 'Action default' }}</option><option value="unassigned">Unassigned</option>@for (member of ctx.data()?.members || []; track member.id) { <option [value]="'person:' + member.id">{{ member.id === ctx.me() ? 'You' : member.name }}</option> }@for (profile of ctx.data()?.profiles || []; track profile.id) { @if (profile.active) { <option [value]="'agent:' + profile.id">{{ profile.name }} (agent)</option> } }</select></label>
        <label class="wc-meta"><mat-icon aria-hidden="true">flag</mat-icon><span class="wc-sr">Priority</span><select aria-label="Priority" name="priority" [(ngModel)]="priority" (ngModelChange)="remember()">@for (entry of priorities; track entry) { <option [value]="entry">{{ entry }}</option> }</select></label>
        <label class="wc-meta"><mat-icon aria-hidden="true">view_kanban</mat-icon><span class="wc-sr">Place in</span><select aria-label="Place in" name="state" [(ngModel)]="state" (ngModelChange)="remember()"><option value="ready">Queue</option><option value="suggested">Backlog</option></select></label>
      </div>
      <section class="wc-review" [attr.aria-labelledby]="fieldId('review-title')"><div class="wc-sectionhead"><h3 [id]="fieldId('review-title')">Acceptance criteria</h3><span>Optional</span></div>
        @for (criterion of criteria; track $index; let i = $index) { <div class="wc-criterion"><mat-icon aria-hidden="true">checklist</mat-icon><label class="wc-sr" [for]="fieldId('criterion-' + i)">Criterion {{ i + 1 }}</label><input [id]="fieldId('criterion-' + i)" [name]="'criterion-' + i" [ngModel]="criterion" (ngModelChange)="criteria[i] = $event; remember()" maxlength="300" placeholder="What must be true?"><button type="button" [attr.aria-label]="'Remove criterion ' + (i + 1)" (click)="criteria.splice(i, 1); remember()"><mat-icon>close</mat-icon></button></div> }
        @for (ref of linked; track ref.id) { <div class="wc-claim"><mat-icon aria-hidden="true">route</mat-icon><div><strong>{{ journey(ref.id)?.title || ref.id }}</strong><span class="wc-tag">Revision {{ ref.revision }}</span><p>{{ journey(ref.id)?.persona }} · {{ stepNames(ref) }}</p></div><button type="button" [attr.aria-label]="'Remove journey ' + ref.id" (click)="removeJourney(ref.id)"><mat-icon>close</mat-icon></button></div> }
        @if (specify) { <div class="wc-claim"><mat-icon aria-hidden="true">route</mat-icon><div><label>New journey<input aria-label="New journey" name="journeyTitle" [(ngModel)]="journeyTitle" (ngModelChange)="remember()" maxlength="200"></label><p>Specify this journey before implementation.</p></div><button type="button" aria-label="Remove new journey" (click)="specify = false; remember()"><mat-icon>close</mat-icon></button></div> }
        <div class="wc-review-actions"><button type="button" class="wc-secondary" (click)="addCriterion()"><mat-icon aria-hidden="true">add</mat-icon>Add criterion</button>@if (role() === 'platform') { <button type="button" class="wc-secondary" data-attach (click)="openPicker()"><mat-icon aria-hidden="true">route</mat-icon>Attach journey</button> }</div>
        @if (!criteria.length && !linked.length && !specify) { <p class="wc-hint">Add checks or journeys you know. The agent assesses affected journeys when it picks up the task.</p> }
        @if (picker()) {
          <section class="wc-picker" [attr.aria-labelledby]="fieldId('picker-title')"><header><h3 [id]="fieldId('picker-title')">Attach journey steps</h3><button type="button" aria-label="Close journey picker" (click)="closePicker()"><mat-icon>close</mat-icon></button></header>
          <label class="wc-sr" [for]="fieldId('search')">Search journeys</label><input [id]="fieldId('search')" name="search" [(ngModel)]="search" placeholder="Search journeys…">
          @if (loading()) { <p class="wc-hint" role="status">Loading journeys…</p> }
          @else if (journeyError()) { <p class="wc-error" role="alert">{{ journeyError() }}</p><button type="button" class="wc-quiet" (click)="loadJourneys()">Retry</button> }
          @else { <div class="wc-journey-list">@for (entry of filtered(); track entry.id) { <div class="wc-journey-option"><label><input type="checkbox" [checked]="wholeSelected(entry)" (change)="selectWhole(entry, $any($event.target).checked)"><strong>{{ entry.title }}</strong><span class="wc-tag">Revision {{ entry.revision }}</span></label><p>{{ entry.persona }} · {{ entry.steps.length }} steps</p>@for (step of entry.steps; track step.id) { <label class="wc-step"><input type="checkbox" [checked]="selected.get(entry.id)?.includes(step.id) || false" (change)="selectStep(entry.id, step.id, $any($event.target).checked)">{{ step.title }}</label> }</div> } @empty { <div class="wc-empty"><strong>{{ journeys().length ? 'No matching journeys' : 'No journeys yet' }}</strong><p>You can create the task now. The agent will assess journey coverage when it picks it up.</p></div> }</div> }
          <footer>@if (!followUp()) { <button type="button" class="wc-quiet" (click)="specify = true; journeyTitle = title; closePicker(); remember()">Specify a new journey</button> }<button type="button" class="wc-primary" [disabled]="!hasSelection() || loading() || !!journeyError()" (click)="attach()">Attach steps</button></footer>
          </section>
        }
      </section>
      @if (targets().length) { <details class="wc-context-details"><summary>Link project context</summary><label>Target record<select aria-label="Target record" name="target" [(ngModel)]="target" (ngModelChange)="remember()"><option value="">No linked record</option>@for (entry of targets(); track entry.id) { <option [value]="entry.id">{{ entry.label }}</option> }</select></label></details> }
      @if (error()) { <p class="wc-error" role="alert">{{ error() }} Your draft is intact.</p> }
    </div>
    <footer class="wc-footer"><div>@if (!embedded()) { <label><input name="another" type="checkbox" [(ngModel)]="another">Create another</label> }<p>Creates work. Doesn’t start an agent.</p></div><div><button type="button" class="wc-quiet" (click)="embedded() ? dismissed.emit() : close()">{{ embedded() ? 'Dismiss suggestion' : 'Cancel' }}</button><button type="submit" class="wc-primary" [disabled]="saving() || !title.trim() || (!scope() && !selectedAction()) || (specify && !journeyTitle.trim())">{{ saving() ? 'Saving…' : embedded() ? 'Create task' : specify ? 'Create Specify task' : 'Create' }}</button></div></footer>
    </fieldset></form>
  </section></div> }
  `
})
export class WorkCreateComponent {
  readonly ctx = inject(ProjectContext);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly embedded = input(false);
  readonly followUp = input<{ workId: string; entry: RunFollowUp } | null>(null);
  readonly confirmed = output<WorkItem>(); readonly dismissed = output<void>();
  private readonly fieldPrefix = `wc-${crypto.randomUUID()}`;
  fieldId(name: string) { return `${this.fieldPrefix}-${name}`; }
  private focusField(name: string) { this.host.nativeElement.querySelector<HTMLElement>(`[name="${name}"]`)?.focus(); }
  readonly layer = input<string | null>(null); readonly preset = input<string | null>(null);
  readonly priorities = priorityOrder; readonly role = signal('product'); readonly action = signal('product.define');
  readonly layerKeys = computed(() => [...new Set([...this.ctx.layerInstances().filter(entry => entry.enabled && entry.workScope).map(entry => entry.key), ...(this.ctx.data()?.layerActions || []).map(entry => entry.layer)])]);
  readonly scope = computed(() => this.ctx.layerInstances().find(entry => entry.key === this.role())?.workScope || null);
  readonly actions = computed(() => (this.ctx.data()?.layerActions || []).filter(entry => entry.layer === this.role()));
  readonly selectedAction = computed<LayerWorkAction | null>(() => this.actions().find(entry => entry.id === this.action()) || this.actions()[0] || null);
  readonly targets = computed(() => { const data = this.ctx.data(); return data ? [...data.stories.map(e => ({ id: e.id, label: `Story · ${e.title}` })), ...data.claims.map(e => ({ id: e.id, label: `Vision · ${e.text}` })), ...data.objects.map(e => ({ id: e.id, label: `Object · ${e.name}` })), ...data.operations.map(e => ({ id: e.id, label: `API · ${e.operationId}` })), ...data.components.map(e => ({ id: e.id, label: `Component · ${e.name}` })), ...data.projects.map(e => ({ id: e.id, label: `Project · ${e.title}` })), ...data.pages.map(e => ({ id: e.id, label: `Page · ${e.label}` })), ...data.flows.map(e => ({ id: e.id, label: `Flow · ${e.title}` })), ...data.docs.map(e => ({ id: e.id, label: `Document · ${e.title}` }))] : []; });
  readonly minimized = signal(false); readonly expanded = signal(false); readonly discarding = signal(false); readonly picker = signal(false);
  readonly saving = signal(false); readonly error = signal(''); readonly loading = signal(false); readonly journeyError = signal(''); readonly journeys = signal<Journey[]>([]);
  // Search is template-driven, so keep the derived list as a method, rather than a computed signal.
  filtered() { const term = this.search.trim().toLowerCase(); return this.journeys().filter(e => `${e.title} ${e.persona}`.toLowerCase().includes(term)); }
  title = ''; brief = ''; target = ''; assignee = ''; state = 'ready'; priority = 'medium'; criteria: string[] = []; linked: LinkedJourney[] = []; selected = new Map<string, string[]>(); search = ''; specify = false; journeyTitle = ''; another = false;
  private activeDraftKey = '';
  constructor() { effect(() => { const key = this.layer(), preset = this.preset(), followUp = this.followUp(), project = this.ctx.projectId(); if (!project) return; untracked(() => { if (this.activeDraftKey !== this.draftKey()) { this.activeDraftKey = this.draftKey(); this.title = ''; this.brief = ''; this.criteria = []; this.linked = []; this.journeys.set([]); this.specify = false; this.target = ''; this.assignee = ''; this.priority = 'medium'; this.state = 'ready'; this.journeyTitle = ''; this.error.set(''); this.picker.set(false); this.minimized.set(false); this.role.set(key || 'product'); this.action.set(preset || 'product.define'); if (followUp) { this.title = followUp.entry.title; this.brief = followUp.entry.brief; this.state = 'suggested'; } this.restore(); } if (key) this.role.set(key); if (preset) this.action.set(preset); }); }); }
  projectName() { return this.ctx.session()?.projects.find(entry => entry.id === this.ctx.projectId())?.name || ''; }
  private draftKey() { return `aludel-task-draft:${this.ctx.me()}:${this.ctx.projectId()}:${this.layer() || 'work'}:${this.preset() || ''}${this.followUp() ? ':follow-up:' + this.followUp()!.entry.id : ''}`; }
  private restore() { try { const draft = JSON.parse(sessionStorage.getItem(this.draftKey()) || 'null') as Draft | null; if (draft) { const { role, action, ...fields } = draft; Object.assign(this, fields); if (!this.layer()) this.role.set(role); this.action.set(action); if (this.linked.length) void this.loadJourneys(); } } catch { sessionStorage.removeItem(this.draftKey()); } }
  remember() { const draft: Draft = { title: this.title, brief: this.brief, target: this.target, assignee: this.assignee, state: this.state, priority: this.priority, role: this.role(), action: this.action(), criteria: this.criteria, linked: this.linked, specify: this.specify, journeyTitle: this.journeyTitle }; sessionStorage.setItem(this.draftKey(), JSON.stringify(draft)); }
  changeRole(key: string) { this.role.set(key); this.action.set(this.actions()[0]?.id || ''); this.linked = []; this.specify = false; this.picker.set(false); this.remember(); }
  layerName(key: string) { return this.ctx.layerInstances().find(entry => entry.key === key)?.name || layerLabel[key] || key; }
  journey(id: string) { return this.journeys().find(entry => entry.id === id); }
  stepNames(ref: LinkedJourney) { const entry = this.journey(ref.id); return ref.steps.map(id => entry?.steps.find(step => step.id === id)?.title || id).join(' · '); }
  addCriterion() { if (this.criteria.length + this.linked.length >= 40) return; this.criteria.push(''); this.remember(); setTimeout(() => this.focusField(`criterion-${this.criteria.length - 1}`)); }
  removeJourney(id: string) { this.linked = this.linked.filter(ref => ref.id !== id); this.remember(); }
  async loadJourneys() { this.loading.set(true); this.journeyError.set(''); try { const answer = await this.ctx.api<{ journeys: Journey[] }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work/journeys`); this.journeys.set(answer.journeys); } catch (e) { this.journeyError.set(e instanceof Error ? e.message : 'Could not load journeys.'); } finally { this.loading.set(false); } }
  openPicker() { this.selected = new Map(this.linked.map(ref => [ref.id, [...ref.steps]])); this.search = ''; this.picker.set(true); void this.loadJourneys(); setTimeout(() => this.focusField('search')); }
  closePicker() { this.picker.set(false); setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[data-attach]')?.focus()); }
  wholeSelected(entry: Journey) { return entry.steps.every(step => this.selected.get(entry.id)?.includes(step.id)); }
  selectWhole(entry: Journey, checked: boolean) { this.selected.set(entry.id, checked ? entry.steps.map(step => step.id) : []); }
  selectStep(id: string, step: string, checked: boolean) { const steps = new Set(this.selected.get(id) || []); if (checked) steps.add(step); else steps.delete(step); this.selected.set(id, [...steps]); }
  hasSelection() { return [...this.selected.values()].some(steps => steps.length); }
  attach() { if ([...this.selected].some(([id, steps]) => steps.length && (!this.journey(id) || steps.some(step => !this.journey(id)!.steps.some(entry => entry.id === step))))) { this.error.set('A selected journey changed. Confirm its current steps or remove the attachment.'); return; } if ([...this.selected.values()].filter(steps => steps.length).length + this.criteria.length > 40) { this.error.set('A task has up to forty criteria and journey attachments.'); return; } this.linked = [...this.selected].filter(([, steps]) => steps.length).map(([id, steps]) => ({ id, revision: this.journey(id)!.revision, steps })); this.specify = false; this.closePicker(); this.remember(); }
  close() { if (this.saving()) return; if (this.title.trim() || this.brief.trim() || this.criteria.length || this.linked.length || this.specify) this.discarding.set(true); else this.back(); }
  discard() { sessionStorage.removeItem(this.draftKey()); this.back(); }
  private back() { this.ctx.go(this.layer() ? this.ctx.link(this.layer()!, 'tasks') : this.ctx.link('work', 'board')); }
  @HostListener('document:keydown', ['$event']) keyboard(event: KeyboardEvent) { if (this.minimized() || (this.embedded() && !this.host.nativeElement.contains(event.target as Node))) return; if (this.embedded() && event.key === 'Escape') return; if (event.key === 'Escape') { event.preventDefault(); if (this.picker()) this.closePicker(); else this.close(); } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void this.create(); } }
  async create() {
    if (this.saving() || !this.title.trim() || (!this.scope() && !this.selectedAction())) return;
    if (this.criteria.some(text => !text.trim())) { this.error.set('Write the criterion or remove the empty row.'); return; }
    this.saving.set(true); this.error.set(''); const [kind, id] = this.assignee.split(':', 2);
    const assignment = this.assignee === 'unassigned' ? { assignee: null } : kind && id ? { assignee: { kind, id } } : {};
    let created: WorkItem | undefined;
    const ok = await this.ctx.write(async () => {
      const base = { title: this.title.trim(), priority: this.priority, state: this.state, ...assignment };
      if (this.followUp()) {
        const followUp = this.followUp()!;
        const result = await this.ctx.api<{ work: WorkItem }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work/${encodeURIComponent(followUp.workId)}/follow-ups/${encodeURIComponent(followUp.entry.id)}`, 'POST', { decision: 'create', task: { ...base, suggestion: this.brief.trim(), targets: this.target ? [{ id: this.target }] : [], checks: this.criteria.map(text => text.trim()), claims: this.linked.map((ref, i) => ({ id: `journey-${i + 1}`, kind: 'journey', journey: ref.id, revision: ref.revision, steps: ref.steps })) } }); created = result.work;
      } else if (this.specify) {
        const journeyId = this.journeyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || `journey-${crypto.randomUUID().slice(0, 8)}`;
        const result = await this.ctx.api<{ specify: WorkItem }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work/specify`, 'POST', { ...base, brief: this.brief.trim(), checks: this.criteria.map(text => text.trim()), claims: this.linked.map((ref, i) => ({ id: `journey-${i + 1}`, kind: 'journey', journey: ref.id, revision: ref.revision, steps: ref.steps })), journey: { id: journeyId, title: this.journeyTitle.trim() } }); created = result.specify;
      } else created = await this.ctx.api<WorkItem>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work`, 'POST', { ...base, ...(this.scope() ? { layer: this.role() } : { action: this.selectedAction()!.id }), suggestion: this.brief.trim(), targets: this.target ? [{ id: this.target }] : [], checks: this.criteria.map(text => text.trim()), claims: this.linked.map(ref => ({ id: `journey-${this.linked.indexOf(ref) + 1}`, kind: 'journey', journey: ref.id, revision: ref.revision, steps: ref.steps })) });
    }, 'Task created.');
    this.saving.set(false);
    if (!ok) { this.error.set(this.ctx.error() || 'Could not save the task.'); return; }
    sessionStorage.removeItem(this.draftKey());
    if (this.followUp() && created) { this.confirmed.emit(created); return; }
    if (this.another) { this.title = ''; this.brief = ''; this.criteria = []; this.linked = []; this.specify = false; this.target = ''; this.journeyTitle = ''; this.picker.set(false); this.focusField('title'); }
    else if (created) this.ctx.go(this.ctx.link('work', 'item', created.id));
  }
}
