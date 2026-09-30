import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext, Routine, workStatusLabel } from './context';

interface Discovery { sourceKeys: string[]; workId: string; createdAt: string }

// Tasks › Routines (CUSTOM-LAYER-01): the layer's routines as a list, like Work › Routines, and one page per routine.
// Each run stages an ordinary task for this layer's board; nothing starts without its Go.
@Component({
  selector: 'aludel-layer-routines', standalone: true, imports: [FormsModule, MatIconModule],
  template: `
  @if (!routineId()) {
    <div class="lay-row lay-wrap"><h2 class="lay-tk-title">Routines</h2>
      @if (canManage()) { <button type="button" class="lay-button small lay-push" (click)="newRoutine()" [disabled]="busy()"><mat-icon aria-hidden="true">add</mat-icon>New routine</button> }</div>
    <p class="lay-muted">Each run stages an ordinary {{ name() }} task on the board, assigned like any other by its action. A routine never opens a second task while its last one is open.</p>
    <div class="lay-table-wrap" tabindex="0" role="region" [attr.aria-label]="name() + ' routines'"><table class="lay-rt-table"><thead><tr><th>Routine</th><th>Runs</th><th>Next</th><th>Last task</th><th>On</th><th><span class="visually-hidden">Run</span></th></tr></thead><tbody>
      <tr><td><a [href]="ctx.link(layerKey(), 'tasks', 'routines', 'discovery')" (click)="ctx.go(ctx.link(layerKey(), 'tasks', 'routines', 'discovery'), $event)"><strong>Discover neighboring layers</strong></a><br><span class="lay-muted small">Built in · proposes how {{ name() }} reads each neighbor</span></td>
        <td>When layers change</td><td class="small">—</td>
        <td class="small">@if (discovery()[0]; as run) { @if (ctx.workById().get(run.workId); as last) { <a [href]="ctx.link('work', 'item', last.id)" (click)="ctx.go(ctx.link('work', 'item', last.id), $event)">{{ last.ref }}</a> {{ statusLabel[last.status] }} } } @else { — }</td>
        <td><span class="lay-muted small">Always</span></td><td></td></tr>
      @for (routine of routines(); track routine.id) {
        <tr><td><a [href]="ctx.link(layerKey(), 'tasks', 'routines', routine.id)" (click)="ctx.go(ctx.link(layerKey(), 'tasks', 'routines', routine.id), $event)"><strong>{{ routine.title }}</strong></a>
            <br><span class="lay-muted small">{{ stagesText(routine) }}</span></td>
          <td>{{ triggerLabel(routine) }}</td>
          <td class="small">{{ nextText(routine) }}</td>
          <td class="small">@if (routine.lastWorkId && ctx.workById().get(routine.lastWorkId); as last) { <a [href]="ctx.link('work', 'item', last.id)" (click)="ctx.go(ctx.link('work', 'item', last.id), $event)">{{ last.ref }}</a> {{ statusLabel[last.status] }} } @else { — }</td>
          <td><input type="checkbox" [checked]="routine.enabled" [disabled]="!canManage()" (change)="toggle(routine, $any($event.target).checked)" [attr.aria-label]="(routine.enabled ? 'Turn off ' : 'Turn on ') + routine.title"></td>
          <td><button type="button" class="lay-button ghost small" (click)="run(routine)" [disabled]="busy()" [attr.aria-label]="'Run ' + routine.title + ' now'">Run now</button></td></tr>
      }</tbody></table></div>
    @if (!routines().length) { <p class="lay-muted small">No routines of your own yet.@if (canManage()) { New routine starts one paused, so you can set it up first. }</p> }
  } @else if (routineId() === 'discovery') {
    <a class="lay-back" [href]="ctx.link(layerKey(), 'tasks', 'routines')" (click)="ctx.go(ctx.link(layerKey(), 'tasks', 'routines'), $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Routines</a>
    <div class="lay-row lay-wrap"><h2 class="lay-tk-title">Discover neighboring layers</h2><span class="lay-chip lay-plain">Built in · always on</span></div>
    <p>When layers are added or change their charter, this stages one discovery task per new neighbor so {{ name() }} can propose how it reads their outputs. Proposals are reviewed in <a [href]="ctx.link(layerKey(), 'manage', 'connections')" (click)="ctx.go(ctx.link(layerKey(), 'manage', 'connections'), $event)">Manage › Connections</a>.</p>
    <h3 class="lay-rt-h">Runs</h3>
    <ul class="lay-mg-list">@for (run of discovery(); track run.workId) {
      <li><span class="lay-mg-list-main"><strong>{{ run.sourceKeys.map(layerName).join(', ') || 'Neighbors' }}</strong><small>{{ run.createdAt.slice(0, 10) }}</small></span>
        <a [href]="ctx.link('work', 'item', run.workId)" (click)="ctx.go(ctx.link('work', 'item', run.workId), $event)">{{ ctx.workById().get(run.workId)?.ref || 'Open task' }}</a></li>
    } @empty { <li class="lay-muted">No discovery has run yet.</li> }</ul>
  } @else if (selected(); as routine) {
    <a class="lay-back" [href]="ctx.link(layerKey(), 'tasks', 'routines')" (click)="ctx.go(ctx.link(layerKey(), 'tasks', 'routines'), $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Routines</a>
    <div class="lay-row lay-wrap"><h2 class="lay-tk-title">{{ routine.title }}</h2><span class="lay-chip lay-plain">r{{ routine.revision }} · {{ routine.enabled ? 'On' : 'Paused' }}</span>
      <span class="lay-row lay-push"><button type="button" class="lay-button ghost small" (click)="run(routine)" [disabled]="busy()"><mat-icon aria-hidden="true">play_arrow</mat-icon>Run now</button></span></div>
    <p class="lay-muted">{{ triggerLabel(routine) }} · {{ stagesText(routine) }}@if (routine.lastWorkId && ctx.workById().get(routine.lastWorkId); as last) { · last task <a [href]="ctx.link('work', 'item', last.id)" (click)="ctx.go(ctx.link('work', 'item', last.id), $event)">{{ last.ref }}</a> {{ statusLabel[last.status] }} }</p>
    <form class="lay-setup lay-setup-page" (ngSubmit)="save(routine)" [attr.aria-label]="routine.title + ' setup'">
      <div>
        <h4><mat-icon aria-hidden="true">bolt</mat-icon>Name</h4>
        <label class="visually-hidden" for="rt-title">Routine name</label><input id="rt-title" name="title" [(ngModel)]="draft.title" [readonly]="!canManage()">
        <h4 class="lay-rt-gap"><mat-icon aria-hidden="true">event_repeat</mat-icon>When it runs</h4>
        <div class="lay-rt-fields">
          <label>Trigger<select name="trigger" [(ngModel)]="draft.trigger" [disabled]="!canManage()"><option value="manual">On demand</option><option value="schedule">On a schedule</option><option value="output-change">When output changes</option></select></label>
          @if (draft.trigger === 'schedule') { <label>Cadence<select name="cadence" [(ngModel)]="draft.cadence" [disabled]="!canManage()"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="before-release">Before release</option></select></label> }
          <label>Done by<select name="executor" [(ngModel)]="draft.executor" [disabled]="!canManage()"><option value="utility">Utility (no agent)</option><option value="agent">Agent</option></select></label>
          <label class="lay-rt-check"><input type="checkbox" name="enabled" [(ngModel)]="draft.enabled" [disabled]="!canManage()"> On</label>
        </div>
        <h4 class="lay-rt-gap"><mat-icon aria-hidden="true">add_task</mat-icon>Stages</h4>
        @if (isCustom()) {
          <label class="visually-hidden" for="rt-action">Action</label><select id="rt-action" name="action" [(ngModel)]="draft.actionKey" [disabled]="!canManage()"><option value="">Choose an action</option>@for (action of domainActions(); track action.key) { <option [value]="action.key">{{ action.title }}</option> }</select>
          <p class="lay-hint">A task using this action, with its default assignee and checks. <a [href]="ctx.link(layerKey(), 'tasks', 'actions')" (click)="ctx.go(ctx.link(layerKey(), 'tasks', 'actions'), $event)">Actions</a></p>
        } @else { <p class="lay-hint">A {{ name() }} {{ routine.type }} task, assigned by its action.</p> }
        <h4 class="lay-rt-gap"><mat-icon aria-hidden="true">menu_book</mat-icon>Instructions</h4>
        <label class="visually-hidden" for="rt-doc">Instruction document</label><select id="rt-doc" name="doc" [(ngModel)]="draft.instructionDoc" [disabled]="!canManage()"><option value="">None</option>@for (doc of documents(); track doc.key) { <option [value]="doc.key">{{ doc.title }} · r{{ doc.revision }}</option> }</select>
        <p class="lay-hint">A Knowledge document the task links to. Runs keep the revision they started with.</p>
      </div>
      <div class="lay-setup-side">
        <div><h4><mat-icon aria-hidden="true">visibility</mat-icon>Reads</h4><label class="visually-hidden" for="rt-reads">Allowed reads, one per line</label><textarea id="rt-reads" name="reads" rows="3" [(ngModel)]="draft.reads" [readonly]="!canManage()" placeholder="One per line"></textarea></div>
        <div><h4><mat-icon aria-hidden="true">tune</mat-icon>Capabilities</h4><label class="visually-hidden" for="rt-caps">Capabilities, one per line</label><textarea id="rt-caps" name="caps" rows="3" [(ngModel)]="draft.capabilities" [readonly]="!canManage()" placeholder="One per line"></textarea></div>
        <div><h4><mat-icon aria-hidden="true">edit</mat-icon>May change</h4><label class="visually-hidden" for="rt-outputs">Allowed outputs, one per line</label><textarea id="rt-outputs" name="outputs" rows="3" [(ngModel)]="draft.outputs" [readonly]="!canManage()" placeholder="Nothing: suggestions only"></textarea></div>
      </div>
      @if (canManage()) {
        <div class="lay-setup-full lay-row lay-wrap"><label class="visually-hidden" for="rt-why">Why this change</label><input id="rt-why" name="why" [(ngModel)]="draft.why" placeholder="Why this change (saved with the revision)" class="lay-grow">
          <button type="submit" class="lay-button small" [disabled]="busy() || !draft.title.trim()">Save routine</button></div>
      }
    </form>
    <details class="lay-log-list"><summary>History · {{ routine.history.length }} revision{{ routine.history.length === 1 ? '' : 's' }}</summary>
      <ul class="small lay-plain-list">@for (entry of routine.history; track entry.revision) { <li>r{{ entry.revision }} · {{ entry.rationale || 'Updated' }}</li> } @empty { <li>No revisions yet.</li> }</ul></details>
  } @else {
    <a class="lay-back" [href]="ctx.link(layerKey(), 'tasks', 'routines')" (click)="ctx.go(ctx.link(layerKey(), 'tasks', 'routines'), $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Routines</a>
    <p class="lay-muted">That routine no longer exists.</p>
  }`
})
export class LayerRoutinesComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly routineId = input<string | null>(null);
  readonly statusLabel = workStatusLabel;
  readonly layer = computed(() => this.ctx.layerInstances().find(item => item.key === this.layerKey()) || null);
  readonly name = computed(() => this.layer()?.name || this.layerKey());
  readonly isCustom = computed(() => this.layer()?.editorAdapter === 'markdown-editor');
  readonly domainActions = computed(() => this.layer()?.domainActions || []);
  readonly canManage = computed(() => this.ctx.session()?.projects.find(project => project.id === this.ctx.projectId())?.role === 'owner');
  readonly routines = computed(() => (this.ctx.data()?.routines || []).filter(item => item.layer === this.layerKey()));
  readonly selected = computed(() => this.routines().find(item => item.id === this.routineId()) || null);
  readonly documents = signal<{ key: string; title: string; revision: number }[]>([]);
  readonly discovery = signal<Discovery[]>([]);
  readonly busy = signal(false);
  draft = this.blank();
  private prepared = '';

  constructor() {
    effect(() => { const id = this.ctx.projectId(), key = this.layerKey(); if (id && key) void this.load(); });
    // Fill the form when a routine opens or a save lands a new revision.
    effect(() => { const routine = this.selected(); const stamp = routine ? `${routine.id}@${routine.revision}` : ''; if (routine && stamp !== this.prepared) { this.prepared = stamp; this.prepare(routine); } else if (!routine) this.prepared = ''; });
  }
  private path(suffix: string) { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/${encodeURIComponent(this.layerKey())}/${suffix}`; }
  private async load() {
    try {
      const [docs, discovery] = await Promise.all([this.ctx.api<{ documents: { key: string; title: string; revision: number }[] }>(this.path('documents')), this.ctx.api<{ runs: Discovery[] }>(this.path('discovery'))]);
      this.documents.set(docs.documents); this.discovery.set(discovery.runs);
    } catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  }
  private blank() { return { title: '', actionKey: '', enabled: false, executor: 'utility', trigger: 'manual', cadence: 'monthly', instructionDoc: '', reads: '', capabilities: '', outputs: '', why: '' }; }
  private prepare(r: Routine) {
    this.draft = { title: r.title, actionKey: r.actionKey || '', enabled: r.enabled, executor: r.executor || 'utility', trigger: r.trigger || 'manual', cadence: r.cadence, instructionDoc: r.instructionDoc || '',
      reads: (r.allowedReads || []).join('\n'), capabilities: (r.capabilities || []).join('\n'), outputs: (r.outputKinds || []).join('\n'), why: '' };
  }
  layerName = (key: string) => this.ctx.layerInstances().find(entry => entry.key === key)?.name || key;
  triggerLabel(routine: Routine) {
    const trigger = routine.trigger || 'schedule';
    if (trigger === 'manual') return 'On demand';
    if (trigger === 'output-change') return 'When output changes';
    return routine.cadence === 'before-release' ? 'Before each release' : routine.cadence === 'weekly' ? 'Weekly' : 'Monthly';
  }
  nextText(routine: Routine) {
    if (!routine.enabled) return 'Off';
    if ((routine.trigger || 'schedule') !== 'schedule') return '—';
    return routine.cadence === 'before-release' ? 'Next build' : routine.nextRunAt ? new Date(routine.nextRunAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
  }
  stagesText(routine: Routine) {
    const action = routine.actionKey ? this.domainActions().find(entry => entry.key === routine.actionKey) : null;
    const id = routine.actionKey ? `${routine.layer}.${routine.actionKey}` : '';
    const assignee = (this.ctx.data()?.layerActions || []).find(entry => entry.id === id)?.assignee;
    if (action) return `Stages “${action.title}”${assignee ? ' for ' + this.ctx.whoName(assignee) : ''}`;
    return this.isCustom() ? 'No action chosen yet' : `Stages a ${this.name()} ${routine.type} task`;
  }
  toggle(routine: Routine, enabled: boolean) { void this.ctx.write(() => this.ctx.change(routine.id, { enabled }, routine.revision, enabled ? 'Turned on' : 'Turned off'), enabled ? 'Routine on.' : 'Routine off.'); }
  async run(routine: Routine) {
    this.busy.set(true);
    await this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/routines/${encodeURIComponent(routine.id)}`, 'POST', {}), 'Ran it. The new task is on the board.');
    this.busy.set(false);
  }
  async newRoutine() {
    this.busy.set(true); let id = '';
    await this.ctx.write(async () => { const created = await this.ctx.record('routine', { title: `New ${this.name()} routine`, layer: this.layerKey(), type: 'audit', cadence: 'monthly', documents: [], enabled: false,
      actionKey: this.isCustom() ? (this.domainActions()[0]?.key || null) : null, executor: 'utility', trigger: 'manual', instructionDoc: 'routine-method', allowedReads: [], capabilities: [], outputKinds: [] }) as { id?: string } | undefined; id = created?.id || ''; }, 'Routine created, paused.');
    this.busy.set(false);
    if (id) this.ctx.go(this.ctx.link(this.layerKey(), 'tasks', 'routines', id));
  }
  async save(r: Routine) {
    const lines = (value: string) => value.split('\n').map(entry => entry.trim()).filter(Boolean);
    this.busy.set(true);
    await this.ctx.write(() => this.ctx.change(r.id, { title: this.draft.title, actionKey: this.isCustom() ? this.draft.actionKey || null : null, enabled: this.draft.enabled, executor: this.draft.executor, trigger: this.draft.trigger, cadence: this.draft.cadence,
      instructionDoc: this.draft.instructionDoc || null, allowedReads: lines(this.draft.reads), capabilities: lines(this.draft.capabilities), outputKinds: lines(this.draft.outputs) }, r.revision, this.draft.why || `Updated ${this.name()} routine`), 'Routine saved as a new revision.');
    this.busy.set(false);
  }
}
