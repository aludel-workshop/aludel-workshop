import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Assignee, Phase, PlanProject, ProjectContext, WorkItem, healthLabel, layerLabel, phaseName, priorityOrder, projectStatusIcon, projectStatusLabel, workStatusLabel } from './context';
import { EvidenceChipComponent } from './evidence';
import { AssigneeComponent, AvatarComponent, PriorityComponent, RefChipComponent } from './work-shared';

const byPriority = (a: WorkItem, b: WorkItem) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority) || a.number - b.number;
const statusIcon: Record<string, string> = { backlog: 'radio_button_unchecked', queued: 'circle', staged: 'playlist_add_check', working: 'clock_loader_40', needs: 'help', review: 'rate_review', done: 'check_circle' };
const day = 86400000;
const toDay = (value: string) => Math.round(Date.parse(value + 'T00:00:00Z') / day);
const fromDay = (value: number) => new Date(value * day).toISOString().slice(0, 10);
const short = (value: string | null | undefined) => value ? new Date(value + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
export const progressOf = (items: WorkItem[]) => items.length ? Math.round(items.reduce((sum, item) => sum + (item.status === 'done' ? 1 : ['staged', 'working', 'review', 'needs'].includes(item.status) ? 0.5 : 0), 0) / items.length * 100) : 0;

// Work › Items (ROADMAP-01, after Linear's issue list and Jira's side panel): every item in one list, grouped and filtered;
// a row opens the item beside the list, and "Open full page" goes to the item page.
@Component({
  selector: 'aludel-work-items', standalone: true, imports: [FormsModule, MatIconModule, MatTooltipModule, RefChipComponent, AvatarComponent, PriorityComponent, AssigneeComponent],
  template: `
  <div class="lay-toolbar">
    <label>Group<select [ngModel]="group()" (ngModelChange)="group.set($event)"><option value="status">Status</option><option value="project">Project</option><option value="assignee">Assignee</option><option value="layer">Layer</option></select></label>
    <label>Milestone<select [ngModel]="milestone()" (ngModelChange)="milestone.set($event)"><option value="">All</option>@for (phase of ctx.data()?.phases || []; track phase.id) { <option [value]="phase.key">{{ phase.label }}</option> }</select></label>
    <label>Project<select [ngModel]="project()" (ngModelChange)="project.set($event)"><option value="">All</option><option value="none">No project</option>@for (entry of ctx.data()?.projects || []; track entry.id) { <option [value]="entry.id">{{ entry.ref }} {{ entry.title }}</option> }</select></label>
    <label>Layer<select [ngModel]="layer()" (ngModelChange)="layer.set($event)"><option value="">All</option>@for (entry of layers; track entry) { <option [value]="entry">{{ layerLabel[entry] }}</option> }</select></label>
    <label class="lay-check"><input type="checkbox" [ngModel]="showDone()" (ngModelChange)="showDone.set($event)">Done</label>
    <span class="lay-muted small lay-push">{{ items().length }} items · click a row for details</span>
  </div>
  <div class="lay-ilist">
    @for (group of groups(); track group.key) {
      <details class="lay-igroup" open><summary><mat-icon aria-hidden="true" class="lay-chev">chevron_right</mat-icon>
        @if (group.icon) { <mat-icon aria-hidden="true" [class]="'lay-sicon lay-s-' + group.key">{{ group.icon }}</mat-icon> }{{ group.label }} <span class="lay-count">{{ group.items.length }}</span></summary>
        @for (item of group.items; track item.id) {
          <div class="lay-irow" [class.lay-irow-sel]="selected()?.id === item.id" (click)="open(item, $event)">
            <aludel-priority [value]="item.priority" /><span class="lay-irow-ref">{{ item.ref }}</span>
            <span class="lay-irow-title"><button type="button" class="lay-irow-open" (click)="open(item, $event)">{{ item.title }}</button>
              @for (blocker of item.blockedBy; track blocker) { <span class="lay-blocked"><mat-icon aria-hidden="true">block</mat-icon></span><aludel-ref [id]="blocker" [short]="true" /> }</span>
            <span class="lay-irow-right"><span [class]="'lay-lbl lay-lc-' + item.layer"><i></i>{{ layerLabel[item.layer] }}</span>
              @if (item.project && ctx.projectById().get(item.project); as p) { <span class="lay-pm"><aludel-ref [id]="p.id" [short]="true" /><span class="lay-pm-ms"><mat-icon aria-hidden="true">flag</mat-icon>{{ phaseName(p.milestone) }}</span></span> }</span>
            <aludel-avatar [who]="item.assignee" /><mat-icon [class]="'lay-sicon lay-s-' + item.status" [attr.aria-label]="statusLabel[item.status]" role="img" [matTooltip]="statusLabel[item.status]">{{ icons[item.status] }}</mat-icon>
          </div>
        }
      </details>
    } @empty { <p class="lay-muted lay-pad">No items match.</p> }
  </div>
  @if (selected(); as item) {
    <aside class="lay-drawer" role="dialog" aria-labelledby="item-panel-title" tabindex="-1">
      <a class="lay-close" [href]="ctx.link('work', 'items')" (click)="close($event)" aria-label="Close item"><mat-icon>close</mat-icon></a>
      <div class="lay-refs lay-gap-bottom"><span class="lay-irow-ref">{{ item.ref }}</span>@if (item.project) { <aludel-ref [id]="item.project" /> }</div>
      <h2 id="item-panel-title" class="lay-drawer-title">{{ item.title }}</h2>
      <dl class="lay-kv lay-gap-top">
        <dt>Status</dt><dd class="lay-row"><mat-icon [class]="'lay-sicon lay-s-' + item.status" aria-hidden="true">{{ icons[item.status] }}</mat-icon>{{ statusLabel[item.status] }}</dd>
        <dt>Priority</dt><dd><aludel-priority [value]="item.priority" [text]="true" /></dd>
        <dt>Assignee</dt><dd><aludel-assignee [assignee]="item.assignee" (changed)="reassign(item, $event)" /></dd>
        <dt>Layer</dt><dd><span [class]="'lay-lbl lay-lc-' + item.layer"><i></i>{{ layerLabel[item.layer] }}</span></dd>
        <dt>Project</dt><dd><select [ngModel]="item.project || ''" (ngModelChange)="moveTo(item, $event)" aria-label="Project"><option value="">No project</option>@for (entry of ctx.data()?.projects || []; track entry.id) { <option [value]="entry.id">{{ entry.ref }} {{ entry.title }}</option> }</select></dd>
        @if (item.project && ctx.projectById().get(item.project)?.checkpoints?.length) {
          <dt>Checkpoint</dt><dd><select [ngModel]="item.checkpoint || ''" (ngModelChange)="setCheckpoint(item, $event)" aria-label="Checkpoint"><option value="">None</option>@for (point of ctx.projectById().get(item.project)!.checkpoints; track point.id) { <option [value]="point.id">{{ point.title }}</option> }</select></dd>
        }
        <dt>Blocked by</dt><dd class="lay-refs">@for (blocker of item.blockedBy; track blocker) { <aludel-ref [id]="blocker" /> } @empty { — }</dd>
        <dt>Targets</dt><dd class="lay-refs">@for (target of item.targets; track target.id) { <aludel-ref [id]="target.id" [fallback]="target.label" /> } @empty { — }</dd>
      </dl>
      <a class="lay-button small lay-gap-top" [href]="ctx.link('work', 'item', item.id)" (click)="ctx.go(ctx.link('work', 'item', item.id), $event)"><mat-icon aria-hidden="true">open_in_full</mat-icon>Open full page</a>
    </aside>
  }`
})
export class WorkItemsComponent {
  readonly ctx = inject(ProjectContext);
  readonly selectedId = input<string | null>(null);
  readonly layers = ['product', 'design', 'pages', 'data', 'platform', 'deploy', 'work'];
  readonly layerLabel = layerLabel; readonly statusLabel = workStatusLabel; readonly icons = statusIcon; readonly phaseName = phaseName;
  readonly group = signal('status'); readonly milestone = signal(''); readonly project = signal(''); readonly layer = signal(''); readonly showDone = signal(false);
  readonly selected = computed(() => this.ctx.workById().get(this.selectedId() || '') || null);
  readonly items = computed(() => (this.ctx.data()?.work || []).filter(item => {
    const project = item.project ? this.ctx.projectById().get(item.project) : null;
    if (!this.showDone() && item.status === 'done') return false;
    if (this.milestone() && project?.milestone !== this.milestone()) return false;
    if (this.project() && (this.project() === 'none' ? item.project : item.project !== this.project())) return false;
    return !this.layer() || item.layer === this.layer();
  }));
  readonly groups = computed(() => {
    const by = this.group();
    const key = (item: WorkItem) => by === 'status' ? item.status : by === 'project' ? item.project || 'none' : by === 'assignee' ? `${item.assignee?.kind || 'none'}:${item.assignee?.id || ''}` : item.layer;
    const order = by === 'status' ? Object.keys(statusIcon) : by === 'layer' ? this.layers : by === 'project' ? [...(this.ctx.data()?.projects || []).map(entry => entry.id), 'none'] : null;
    const keys = [...new Set(this.items().map(key))].sort((a, b) => order ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b));
    return keys.map(entry => {
      const items = this.items().filter(item => key(item) === entry).sort(byPriority);
      const label = by === 'status' ? workStatusLabel[entry] : by === 'layer' ? layerLabel[entry] : by === 'project' ? (entry === 'none' ? 'No project' : `${this.ctx.projectById().get(entry)?.ref} ${this.ctx.projectById().get(entry)?.title}`) : this.ctx.whoName(items[0].assignee);
      return { key: entry, label, icon: by === 'status' ? statusIcon[entry] : '', items };
    });
  });
  open(item: WorkItem, event: Event) { event.stopPropagation(); this.ctx.go(this.ctx.link('work', 'items', item.id)); window.scrollTo(0, 0); }
  close(event: Event) { this.ctx.go(this.ctx.link('work', 'items'), event); }
  reassign(item: WorkItem, assignee: Assignee) { void this.ctx.write(() => this.ctx.updateWork(item.id, { assignee }), `${item.ref} now goes to ${this.ctx.whoName(assignee)}.`); }
  setCheckpoint(item: WorkItem, checkpoint: string) { void this.ctx.write(() => this.ctx.updateWork(item.id, { checkpoint: checkpoint || null }), 'Checkpoint set.'); }
  moveTo(item: WorkItem, project: string) { void this.ctx.write(() => this.ctx.updateWork(item.id, { project: project || null }), project ? 'Moved to the project.' : 'Taken out of its project.'); }
}

interface Row { kind: 'section' | 'bar' | 'target' | 'undated'; y: number; h: number; phase?: Phase; project?: PlanProject; undated?: PlanProject[]; }

// Work › Projects (ROADMAP-01, after Linear's projects list and timeline): only projects, never items, so it stays
// readable with hundreds of items. Dates are optional (DEC-042); a token budget caps agent spend.
@Component({
  selector: 'aludel-work-projects', standalone: true, imports: [FormsModule, MatIconModule, MatTooltipModule, RefChipComponent, AvatarComponent, EvidenceChipComponent],
  template: `
  @if (project(); as p) {
    <p class="lay-eyebrow lay-layer"><mat-icon aria-hidden="true">checklist</mat-icon><a [href]="ctx.link('work', 'projects')" (click)="ctx.go(ctx.link('work', 'projects'), $event)">Projects</a> · {{ p.ref }}</p>
    <div class="lay-ptile"><mat-icon aria-hidden="true">deployed_code_history</mat-icon></div>
    <label class="visually-hidden" for="project-title">Project name</label>
    <h1 class="lay-flat" tabindex="-1"><input class="lay-insight-title lay-h1-input" id="project-title" [value]="p.title" (change)="save(p, { title: $any($event.target).value })" maxlength="120"></h1>
    <label class="visually-hidden" for="project-summary">Summary</label>
    <input class="lay-psum" id="project-summary" [value]="p.summary" placeholder="One line: what this project gets done" (change)="save(p, { summary: $any($event.target).value })" maxlength="300">
    <nav class="lay-subnav" aria-label="Project sections">
      <a [href]="ctx.link('work', 'projects', p.id)" (click)="ptab.set('overview'); $event.preventDefault()" [attr.aria-current]="ptab() === 'overview' ? 'page' : null">Overview</a>
      <a [href]="ctx.link('work', 'projects', p.id)" (click)="ptab.set('items'); $event.preventDefault()" [attr.aria-current]="ptab() === 'items' ? 'page' : null">Items <span class="lay-count">{{ itemsOf(p).length }}</span></a>
    </nav>
    @if (ptab() === 'items') {
      <ul class="lay-list lay-card">@for (item of itemsOf(p); track item.id) { <li class="lay-item"><mat-icon [class]="'lay-sicon lay-s-' + item.status" aria-hidden="true">{{ icons[item.status] }}</mat-icon><aludel-ref [id]="item.id" /><span class="lay-lbl lay-push" [class]="'lay-lbl lay-push lay-lc-' + item.layer"><i></i>{{ layerLabel[item.layer] }}</span>
        @if (item.checkpoint) { <span class="lay-muted small">{{ checkpointTitle(p, item.checkpoint) }}</span> }<aludel-avatar [who]="item.assignee" /></li> }
        @empty { <li class="lay-muted lay-pad">No items yet. Gaps in its stories become items here.</li> }</ul>
    } @else {
      <dl class="lay-propgrid">
        <dt>Properties</dt><dd>
          <label class="lay-inline-label"><mat-icon aria-hidden="true">{{ statusIcons[p.status] }}</mat-icon><span class="visually-hidden">Status</span><select (change)="save(p, { status: $any($event.target).value })">@for (entry of statuses; track entry) { <option [value]="entry" [selected]="entry === p.status">{{ statusLabels[entry] }}</option> }</select></label>
          @if (p.status === 'progress') { <label class="lay-inline-label"><span class="visually-hidden">Health</span><select (change)="save(p, { health: $any($event.target).value || null })"><option value="" [selected]="!p.health">No health set</option>@for (entry of healths; track entry) { <option [value]="entry" [selected]="entry === p.health">{{ healthLabels[entry] }}</option> }</select></label> }
          <label class="lay-inline-label"><mat-icon aria-hidden="true">person</mat-icon><span class="visually-hidden">Lead</span><select (change)="save(p, { lead: $any($event.target).value || null })"><option value="" [selected]="!p.lead">No lead</option>@for (member of ctx.data()?.members || []; track member.id) { <option [value]="member.id" [selected]="member.id === p.lead">{{ member.id === ctx.me() ? 'You' : member.name }}</option> }</select></label>
          <span class="lay-inline-label"><mat-icon aria-hidden="true">date_range</mat-icon><label class="visually-hidden" for="p-start">Start date</label><input id="p-start" type="date" [value]="p.start || ''" (change)="save(p, { start: $any($event.target).value || null })">→<label class="visually-hidden" for="p-target">Target date</label><input id="p-target" type="date" [value]="p.target || ''" (change)="save(p, { target: $any($event.target).value || null })"></span></dd>
        <dt>Milestone</dt><dd><select (change)="save(p, { milestone: $any($event.target).value })" aria-label="Milestone">@for (phase of ctx.data()?.phases || []; track phase.id) { <option [value]="phase.key" [selected]="phase.key === p.milestone">{{ phase.label }}</option> }</select></dd>
        <dt>Budget</dt><dd><span class="lay-budget"><span>{{ tokens(p.spent) }} of {{ p.budget ? tokens(p.budget) : 'no cap' }} tokens</span>@if (p.budget) { <span class="lay-track"><b [style.width.%]="Math.min(100, p.spent / p.budget * 100)"></b></span> }</span>
          <label class="lay-inline-label"><span class="visually-hidden">Budget in tokens</span><input type="number" min="0" step="10000" [value]="p.budget ?? ''" placeholder="Token cap" (change)="save(p, { budget: $any($event.target).value === '' ? null : +$any($event.target).value })"></label></dd>
        <dt>Blocked by</dt><dd class="lay-refs">@for (dep of p.deps; track dep) { <span class="lay-token"><aludel-ref [id]="dep" /><button type="button" (click)="save(p, { deps: without(p.deps, dep) })" [attr.aria-label]="'Remove dependency'"><mat-icon aria-hidden="true">close</mat-icon></button></span> }
          <select (change)="add(p, 'deps', $any($event.target))" aria-label="Add a project this one waits on"><option value="">Add…</option>@for (other of others(p); track other.id) { <option [value]="other.id">{{ other.ref }} {{ other.title }}</option> }</select></dd>
        <dt>Stories</dt><dd class="lay-refs">@for (story of p.stories; track story) { <span class="lay-token"><aludel-ref [id]="story" /><button type="button" (click)="save(p, { stories: without(p.stories, story) })" [attr.aria-label]="'Remove story'"><mat-icon aria-hidden="true">close</mat-icon></button></span> }
          <select (change)="add(p, 'stories', $any($event.target))" aria-label="Add a story"><option value="">Add…</option>@for (story of freeStories(p); track story.id) { <option [value]="story.id">{{ story.ref }} {{ story.title }}</option> }</select></dd>
        <dt>Evidence</dt><dd><aludel-evidence [id]="p.id" [always]="true" /></dd>
      </dl>
      <form class="lay-card lay-form" (ngSubmit)="saveBrief(p)"><h2 class="lay-row"><mat-icon aria-hidden="true">description</mat-icon>Brief</h2>
        <p class="lay-muted small">What a spec was: the problem, a solution sketch, rabbit holes, no-gos and numbered requirements for this increment.</p>
        <label>Problem<textarea name="problem" rows="2" [(ngModel)]="brief.problem"></textarea></label>
        <label>Solution sketch<textarea name="solution" rows="3" [(ngModel)]="brief.solution"></textarea></label>
        <label>Rabbit holes (one per line)<textarea name="holes" rows="2" [(ngModel)]="brief.rabbitHoles"></textarea></label>
        <label>No-gos (one per line)<textarea name="nogos" rows="2" [(ngModel)]="brief.noGos"></textarea></label>
        <label>Requirements (one per line, “FR-001 The system must …”, WHEN for conditional ones)<textarea name="reqs" rows="4" [(ngModel)]="brief.requirements"></textarea></label>
        <div class="lay-row"><button type="submit" class="lay-button small">Save brief</button><button type="button" class="lay-link-button danger lay-push" (click)="remove(p)">Delete project</button></div>
      </form>
      <section class="lay-card lay-gap-top"><h2 class="lay-row"><mat-icon aria-hidden="true">flag</mat-icon>Checkpoints</h2><p class="lay-muted small">Points inside this project. Linear calls them project milestones.</p>
        @for (point of p.checkpoints; track point.id) { <div class="lay-cprow"><i></i><span>{{ point.title }}</span><small>{{ short(point.date) || 'No date' }} · {{ checkpointItems(p, point.id) }} items</small>
          <button type="button" class="lay-icon-inline" (click)="save(p, { checkpoints: p.checkpoints.filter(entry => entry.id !== point.id) })" [attr.aria-label]="'Remove ' + point.title"><mat-icon aria-hidden="true">close</mat-icon></button></div> }
        <form class="lay-row lay-wrap lay-gap-top" (ngSubmit)="addCheckpoint(p)"><label class="visually-hidden" for="cp-title">Checkpoint</label><input id="cp-title" name="cpt" [(ngModel)]="checkpoint.title" placeholder="e.g. Designs agreed" maxlength="120">
          <label class="visually-hidden" for="cp-date">Date</label><input id="cp-date" name="cpd" type="date" [(ngModel)]="checkpoint.date"><button type="submit" class="lay-button ghost small" [disabled]="!checkpoint.title.trim()"><mat-icon aria-hidden="true">add</mat-icon>Checkpoint</button></form>
      </section>
    }
  } @else {
    <div class="lay-toolbar">
      <div class="lay-segbtn" role="group" aria-label="View"><button type="button" [attr.aria-pressed]="view() === 'timeline'" (click)="view.set('timeline')"><mat-icon aria-hidden="true">view_timeline</mat-icon>Timeline</button><button type="button" [attr.aria-pressed]="view() === 'list'" (click)="view.set('list')"><mat-icon aria-hidden="true">list</mat-icon>List</button></div>
      @if (view() === 'timeline') {
        <div class="lay-segbtn" role="group" aria-label="Zoom">@for (entry of zooms; track entry) { <button type="button" [attr.aria-pressed]="zoom() === entry" (click)="zoom.set(entry)">{{ entry[0].toUpperCase() + entry.slice(1) }}</button> }</div>
        <label class="lay-check"><input type="checkbox" [ngModel]="deps()" (ngModelChange)="deps.set($event)">Dependencies</label>
      }
      <form class="lay-row lay-push" (ngSubmit)="create()"><label class="visually-hidden" for="new-project">New project</label><input id="new-project" name="np" [(ngModel)]="newProject" placeholder="New project" maxlength="120">
        <button type="submit" class="lay-button small" [disabled]="!newProject.trim()"><mat-icon aria-hidden="true">add</mat-icon>Project</button></form>
    </div>
    <details class="lay-milestones"><summary><mat-icon aria-hidden="true">flag</mat-icon>Milestones: {{ milestoneLine() }}</summary>
      @for (phase of ctx.data()?.phases || []; track phase.id) {
        <form class="lay-msform" (ngSubmit)="saveMilestone(phase)" [attr.aria-label]="phase.label + ' milestone'">
          <strong>{{ phase.label }}</strong>@if (phase.current) { <span class="lay-chip lay-ok">Current</span> } @else { <button type="button" class="lay-link-button" (click)="makeCurrent(phase)">Make current</button> }
          <label>Goal<input [name]="'goal-' + phase.key" [(ngModel)]="msDraft[phase.key].goal"></label><label>Done when<input [name]="'exit-' + phase.key" [(ngModel)]="msDraft[phase.key].exit"></label>
          <label>Target<input type="date" [name]="'target-' + phase.key" [(ngModel)]="msDraft[phase.key].target"></label><button type="submit" class="lay-button ghost small">Save</button></form>
      }
    </details>
    @if (view() === 'list') {
      <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Projects"><table class="lay-ptable"><thead><tr><th>Project</th><th>Health</th><th>Status</th><th>Lead</th><th>Target</th><th>Budget</th><th>Progress</th></tr></thead><tbody>
        @for (phase of ctx.data()?.phases || []; track phase.id) {
          <tr class="lay-mhead"><td colspan="7"><aludel-ref [id]="phase.id" /><small>{{ phase.target ? 'Target ' + short(phase.target) : '' }}</small></td></tr>
          @for (p of projectsIn(phase.key); track p.id) {
            <tr><td><aludel-ref [id]="p.id" /></td><td>@if (p.health) { <span class="lay-health"><i [attr.data-h]="p.health"></i>{{ healthLabels[p.health] }}</span> } @else { — }</td>
              <td><span [class]="'lay-pst lay-pst-' + p.status"><mat-icon aria-hidden="true">{{ statusIcons[p.status] }}</mat-icon>{{ statusLabels[p.status] }}</span></td>
              <td>@if (p.lead) { <span class="lay-row"><aludel-avatar [who]="{ kind: 'person', id: p.lead }" />{{ ctx.whoName({ kind: 'person', id: p.lead }) }}</span> } @else { — }</td>
              <td>{{ short(p.target) || '—' }}</td><td><span class="lay-budget"><span>{{ tokens(p.spent) }}{{ p.budget ? ' of ' + tokens(p.budget) : '' }}</span>@if (p.budget) { <span class="lay-track"><b [style.width.%]="Math.min(100, p.spent / p.budget * 100)"></b></span> }</span></td>
              <td class="lay-pct">{{ progress(p) }}%</td></tr>
          }
        }
      </tbody></table></div>
    } @else {
      <div class="lay-tl" tabindex="0" role="region" aria-label="Project timeline" #timeline>
        <div class="lay-tl-in" [style.width.px]="width()" [style.height.px]="height() + 58">
          <div class="lay-tl-axis">
            @for (tick of ticks(); track tick.x) { @if (tick.month) { <span class="lay-tl-mo" [style.left.px]="tick.x + 4">{{ tick.month }}</span> } @if (tick.label) { <span class="lay-tl-dy" [style.left.px]="tick.x">{{ tick.label }}</span> } }
            <span class="lay-tl-today" [style.left.px]="x(today)">{{ short(fromDay(today)) }}</span>
            @for (phase of targeted(); track phase.id) { <span class="lay-tl-mt" [style.left.px]="x(toDay(phase.target!))"><i></i>{{ phase.label }}</span> }
          </div>
          <div class="lay-tl-grid" [style.height.px]="height()">
            @for (tick of ticks(); track tick.x) { <i [style.left.px]="tick.x"></i> }
            @for (phase of targeted(); track phase.id) { <i class="lay-tl-mtl" [style.left.px]="x(toDay(phase.target!))"></i> }
            <i class="lay-tl-todayline" [style.left.px]="x(today)"></i>
          </div>
          <div class="lay-tl-rows" [style.height.px]="height()">
            @if (deps()) { <svg class="lay-tl-svg" [attr.width]="width()" [attr.height]="height()" aria-hidden="true">@for (line of lines(); track line.d) { <path [attr.d]="line.d" [class.bad]="line.bad" /> }</svg> }
            @for (row of rows(); track $index) {
              @switch (row.kind) {
                @case ('section') { <div class="lay-tl-sect" [style.top.px]="row.y"><span><mat-icon aria-hidden="true">flag</mat-icon>{{ row.phase!.label }}{{ row.phase!.target ? ' · target ' + short(row.phase!.target) : '' }}</span></div> }
                @case ('bar') {
                  @if (row.project; as p) {
                    <span class="lay-tl-title" [style.top.px]="row.y + 6" [style.left.px]="x(dates(p).start)"><mat-icon [class]="'lay-pst-' + p.status" aria-hidden="true">{{ statusIcons[p.status] }}</mat-icon>
                      <a [href]="ctx.link('work', 'projects', p.id)" (click)="ctx.go(ctx.link('work', 'projects', p.id), $event)">{{ p.title }}</a>@if (p.lead) { <aludel-avatar [who]="{ kind: 'person', id: p.lead }" /> }@if (p.health) { <i class="lay-hdot" [attr.data-h]="p.health" [matTooltip]="healthLabels[p.health]"></i> }</span>
                    <span class="lay-tl-bar" [class.lay-tl-done]="p.status === 'completed'" [style.top.px]="row.y + 32" [style.left.px]="x(dates(p).start)" [style.width.px]="(dates(p).target - dates(p).start + 1) * ppd()"
                      tabindex="0" role="img" [attr.aria-label]="p.title + ': ' + short(fromDay(dates(p).start)) + ' to ' + short(fromDay(dates(p).target))" [matTooltip]="short(fromDay(dates(p).start)) + ' – ' + short(fromDay(dates(p).target)) + ' · drag to move; drag an end to change dates'"
                      (pointerdown)="grab($event, p, 'move')"><span class="lay-tl-fill" [style.width.%]="progress(p)"></span><span class="lay-tl-h lay-tl-hl" (pointerdown)="grab($event, p, 'start')"></span><span class="lay-tl-h lay-tl-hr" (pointerdown)="grab($event, p, 'end')"></span></span>
                    @if (p.status !== 'completed' && dates(p).target < today) { <span class="lay-tl-over" [style.top.px]="row.y + 32" [style.left.px]="x(dates(p).target + 1)" [style.width.px]="(today - dates(p).target) * ppd()" [matTooltip]="'Past its target'"></span> }
                    @for (point of p.checkpoints; track point.id; let k = $index) { @if (point.date) {
                      <span class="lay-tl-cp" [style.top.px]="row.y + 37" [style.left.px]="x(toDay(point.date)) - 6" [matTooltip]="point.title + ' · ' + short(point.date)"></span>
                      @if (labelFits(p, k)) { <span class="lay-tl-cpl" [style.top.px]="row.y + 58" [style.left.px]="x(toDay(point.date))">{{ point.title.split(' ').slice(0, 2).join(' ') }}</span> } } }
                  }
                }
                @case ('target') {
                  @if (row.project; as p) {
                    <span class="lay-tl-title" [style.top.px]="row.y + 6" [style.left.px]="x(toDay(p.target!)) - 40"><a [href]="ctx.link('work', 'projects', p.id)" (click)="ctx.go(ctx.link('work', 'projects', p.id), $event)">{{ p.title }}</a></span>
                    <span class="lay-tl-tg" [style.top.px]="row.y + 37" [style.left.px]="x(toDay(p.target!)) - 6" [matTooltip]="'Target ' + short(p.target) + ', no start date'"></span>
                  }
                }
                @case ('undated') { <div class="lay-tl-undated" [style.top.px]="row.y"><span class="lay-muted small">No dates:</span>@for (p of row.undated; track p.id) { <aludel-ref [id]="p.id" /><button type="button" class="lay-link-button" (click)="setDates(p)">Set dates</button> }</div> }
              }
            }
          </div>
        </div>
      </div>
      <p class="lay-muted small">Only projects appear here. Drag a bar to move it or its ends to change dates; the date fields on each project do the same from the keyboard. Red dashes: past its target.</p>
    }
  }`
})
export class WorkProjectsComponent {
  readonly ctx = inject(ProjectContext);
  readonly selectedId = input<string | null>(null);
  readonly Math = Math; readonly short = short; readonly fromDay = fromDay; readonly toDay = toDay;
  readonly layerLabel = layerLabel; readonly icons = statusIcon;
  readonly statuses = Object.keys(projectStatusLabel); readonly statusLabels = projectStatusLabel; readonly statusIcons = projectStatusIcon;
  readonly healths = Object.keys(healthLabel); readonly healthLabels = healthLabel;
  readonly zooms = ['week', 'month', 'quarter'];
  readonly view = signal<'timeline' | 'list'>('timeline'); readonly zoom = signal('month'); readonly deps = signal(false);
  readonly ptab = signal<'overview' | 'items'>('overview');
  readonly today = Math.round(Date.now() / day);
  readonly project = computed(() => this.ctx.projectById().get(this.selectedId() || '') || null);
  readonly projects = computed(() => this.ctx.data()?.projects || []);
  readonly dragging = signal<{ id: string; start: number; target: number } | null>(null);
  newProject = '';
  checkpoint = { title: '', date: '' };
  brief = { problem: '', solution: '', rabbitHoles: '', noGos: '', requirements: '' };
  msDraft: Record<string, { goal: string; exit: string; target: string }> = {};
  private briefFor = ''; private msFor = '';

  ngDoCheck() {
    const p = this.project();
    if (p && `${p.id}:${p.revision}` !== this.briefFor) { this.briefFor = `${p.id}:${p.revision}`; this.brief = { problem: p.problem, solution: p.solution, rabbitHoles: p.rabbitHoles.join('\n'), noGos: p.noGos.join('\n'), requirements: p.requirements.join('\n') }; }
    const phases = this.ctx.data()?.phases || [];
    const key = phases.map(phase => `${phase.id}:${phase.revision}`).join();
    if (key !== this.msFor) { this.msFor = key; this.msDraft = Object.fromEntries(phases.map(phase => [phase.key, { goal: phase.goal, exit: phase.exit, target: phase.target || '' }])); }
  }

  projectsIn(milestone: string) { return this.projects().filter(p => p.milestone === milestone); }
  itemsOf(p: PlanProject) { return (this.ctx.data()?.work || []).filter(item => item.project === p.id).sort(byPriority); }
  progress(p: PlanProject) { return progressOf(this.itemsOf(p)); }
  checkpointItems(p: PlanProject, id: string) { return this.itemsOf(p).filter(item => item.checkpoint === id).length; }
  checkpointTitle(p: PlanProject, id: string) { return p.checkpoints.find(point => point.id === id)?.title || ''; }
  others(p: PlanProject) { return this.projects().filter(other => other.id !== p.id && !p.deps.includes(other.id)); }
  freeStories(p: PlanProject) { return (this.ctx.data()?.stories || []).filter(story => !p.stories.includes(story.id)); }
  without(list: string[], value: string) { return list.filter(entry => entry !== value); }
  tokens(count: number) { return count >= 1000000 ? `${(count / 1000000).toFixed(1)}M` : count >= 1000 ? `${Math.round(count / 1000)}k` : String(count); }
  milestoneLine() { return (this.ctx.data()?.phases || []).map(phase => `${phase.label}${phase.target ? ' ' + short(phase.target) : ''}${phase.current ? ' (current)' : ''}`).join(' · '); }

  // ---- Timeline geometry: everything is computed from dates, so bars, labels and dependency lines agree ----
  readonly ppd = computed(() => ({ week: 32, month: 12, quarter: 5 } as Record<string, number>)[this.zoom()]);
  dates(p: PlanProject) { const drag = this.dragging(); return drag?.id === p.id ? { start: drag.start, target: drag.target } : { start: toDay(p.start!), target: toDay(p.target!) }; }
  readonly range = computed(() => {
    const days = this.projects().flatMap(p => [p.start, p.target].filter(Boolean).map(value => toDay(value!)));
    const phases = (this.ctx.data()?.phases || []).filter(phase => phase.target).map(phase => toDay(phase.target!));
    const first = Math.min(this.today - 14, ...days, ...phases) - 7;
    const monday = first - ((new Date(first * day).getUTCDay() + 6) % 7);
    return { from: monday, to: Math.max(monday + 150, ...days.map(value => value + 30), ...phases.map(value => value + 30)) };
  });
  x(dayNumber: number) { return (dayNumber - this.range().from) * this.ppd(); }
  readonly width = computed(() => (this.range().to - this.range().from) * this.ppd());
  readonly ticks = computed(() => {
    const out: { x: number; label: string; month: string }[] = [];
    for (let n = this.range().from; n <= this.range().to; n++) {
      const date = new Date(n * day); const first = date.getUTCDate() === 1;
      const show = this.zoom() === 'quarter' ? first : date.getUTCDay() === 1;
      if (show || first) out.push({ x: this.x(n), label: show && Math.abs(n - this.today) > 2 ? (this.zoom() === 'quarter' ? '' : String(date.getUTCDate())) : '', month: first ? date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase() : '' });
    }
    return out;
  });
  readonly targeted = computed(() => (this.ctx.data()?.phases || []).filter(phase => phase.target));
  readonly rows = computed(() => {
    const rows: Row[] = []; let y = 0;
    for (const phase of this.ctx.data()?.phases || []) {
      const mine = this.projectsIn(phase.key);
      rows.push({ kind: 'section', y, h: 30, phase }); y += 30;
      for (const p of mine.filter(entry => entry.start && entry.target)) { const h = p.checkpoints.some(point => point.date) ? 84 : 66; rows.push({ kind: 'bar', y, h, project: p }); y += h; }
      for (const p of mine.filter(entry => !entry.start && entry.target)) { rows.push({ kind: 'target', y, h: 60, project: p }); y += 60; }
      const undated = mine.filter(entry => !entry.target);
      if (undated.length) { rows.push({ kind: 'undated', y, h: 44, undated }); y += 44; }
    }
    return rows;
  });
  readonly height = computed(() => this.rows().reduce((sum, row) => sum + row.h, 0) + 8);
  readonly lines = computed(() => {
    const at = new Map(this.rows().filter(row => row.project && row.kind === 'bar').map(row => [row.project!.id, row]));
    return this.projects().flatMap(p => p.deps.map(dep => {
      const from = at.get(dep), to = at.get(p.id);
      if (!from || !to) return null;
      const a = this.dates(from.project!), b = this.dates(p);
      const x1 = this.x(a.target + 1), y1 = from.y + 43, x2 = this.x(b.start), y2 = to.y + 43;
      return { d: `M${x1},${y1} C${Math.max(x1, x2) + 16},${y1} ${x2 - 16},${y2} ${x2},${y2}`, bad: b.start <= a.target };
    }).filter(Boolean) as { d: string; bad: boolean }[]);
  });
  labelFits(p: PlanProject, index: number) { const points = p.checkpoints.filter(point => point.date); const point = p.checkpoints[index]; const previous = points[points.indexOf(point) - 1]; return !previous || (toDay(point.date!) - toDay(previous.date!)) * this.ppd() >= 110; }

  // Drag a bar (or an end) by whole days; dates save on release.
  grab(event: PointerEvent, p: PlanProject, mode: 'move' | 'start' | 'end') {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const origin = { start: toDay(p.start!), target: toDay(p.target!) }; const startX = event.clientX;
    const move = (next: PointerEvent) => {
      const delta = Math.round((next.clientX - startX) / this.ppd());
      const start = mode === 'end' ? origin.start : Math.min(origin.start + delta, mode === 'start' ? origin.target : Infinity);
      const target = mode === 'start' ? origin.target : Math.max(origin.target + delta, mode === 'end' ? origin.start : -Infinity);
      this.dragging.set({ id: p.id, start: mode === 'move' ? origin.start + delta : start, target: mode === 'move' ? origin.target + delta : target });
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      const drag = this.dragging();
      if (drag && (drag.start !== origin.start || drag.target !== origin.target)) {
        const shift = drag.start - origin.start;
        const checkpoints = mode === 'move' && shift ? p.checkpoints.map(point => point.date ? { ...point, date: fromDay(toDay(point.date) + shift) } : point) : p.checkpoints;
        void this.ctx.write(() => this.ctx.change(p.id, { start: fromDay(drag.start), target: fromDay(drag.target), checkpoints }, p.revision), `${p.ref} now ${short(fromDay(drag.start))} – ${short(fromDay(drag.target))}.`).then(() => this.dragging.set(null));
      } else this.dragging.set(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  save(p: PlanProject, changes: Partial<PlanProject>) { void this.ctx.write(() => this.ctx.change(p.id, changes, p.revision), 'Saved.'); }
  add(p: PlanProject, field: 'deps' | 'stories', select: HTMLSelectElement) { const value = select.value; select.value = ''; if (value) this.save(p, { [field]: [...p[field], value] }); }
  saveBrief(p: PlanProject) {
    const split = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
    this.save(p, { problem: this.brief.problem, solution: this.brief.solution, rabbitHoles: split(this.brief.rabbitHoles), noGos: split(this.brief.noGos), requirements: split(this.brief.requirements) });
  }
  addCheckpoint(p: PlanProject) { const title = this.checkpoint.title.trim(); if (!title) return; this.save(p, { checkpoints: [...p.checkpoints, { id: '', title, date: this.checkpoint.date || null }] }); this.checkpoint = { title: '', date: '' }; }
  setDates(p: PlanProject) { const start = Math.max(this.today, ...this.projects().filter(other => p.deps.includes(other.id) && other.target).map(other => toDay(other.target!) + 1)); this.save(p, { start: fromDay(start), target: fromDay(start + 13) }); }
  create() {
    const title = this.newProject.trim(); if (!title) return;
    void this.ctx.write(async () => { const created = await this.ctx.record('project', { title, milestone: this.ctx.currentMilestone()?.key || 'demo', lead: this.ctx.me() }) as PlanProject; this.newProject = ''; this.ctx.go(this.ctx.link('work', 'projects', created.id)); }, 'Project created.');
  }
  remove(p: PlanProject) { void this.ctx.write(async () => { await this.ctx.delete(p.id); this.ctx.go(this.ctx.link('work', 'projects')); }, 'Project deleted; its items stay, without a project.'); }
  saveMilestone(phase: Phase) { const draft = this.msDraft[phase.key]; void this.ctx.write(() => this.ctx.change(phase.id, { goal: draft.goal, exit: draft.exit, target: draft.target || null }, phase.revision), `${phase.label} saved.`); }
  makeCurrent(phase: Phase) {
    void this.ctx.write(async () => { for (const other of this.ctx.data()?.phases || []) if (other.current !== (other.id === phase.id)) await this.ctx.change(other.id, { current: other.id === phase.id }, other.revision); }, `${phase.label} is the current milestone.`);
  }
}
