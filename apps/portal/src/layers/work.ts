import { Component, OnDestroy, computed, effect, inject, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext, layerLabel, lines, workStatusLabel } from './context';
import { WorkAgentsComponent } from './work-agents';
import { WorkBoardComponent } from './work-board';
import { WorkItemComponent } from './work-item';
import { WorkRolesComponent } from './work-roles';
import { WorkItemsComponent, WorkProjectsComponent } from './work-plan';
import { WorkTeamComponent } from './work-team';

// Work: the shared bench (DEC-036), redesigned in WORK-UX-01. Board (batches per assignee, then Queue, Backlog and Done),
// the item page, Roles (who takes each action and how), Agents (who does agent work) and Routines.
@Component({
  selector: 'aludel-work-layer', standalone: true,
  imports: [FormsModule, MatIconModule, WorkBoardComponent, WorkItemComponent, WorkRolesComponent, WorkAgentsComponent, WorkItemsComponent, WorkProjectsComponent, WorkTeamComponent],
  template: `
  @if (tab() === 'item') { <aludel-work-item [id]="ctx.segments()[2] || ''" /> }
  @else if (tab() === 'agents' && ctx.segments()[2]) { <aludel-work-agents [id]="ctx.segments()[2]" /> }
  @else if (tab() === 'projects' && ctx.segments()[2]) { <aludel-work-projects [selectedId]="ctx.segments()[2]" /> }
  @else {
    <p class="lay-eyebrow lay-layer"><mat-icon aria-hidden="true">checklist</mat-icon>Work</p>
    <h1 tabindex="-1">{{ heading[tab()] }}</h1>
    @if (lead[tab()]) { <p class="lay-lead">{{ lead[tab()] }}</p> }
    <nav class="lay-tabs" aria-label="Work sections">
      @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('work', entry[0])" (click)="ctx.go(ctx.link('work', entry[0]), $event)" [class.active]="tab() === entry[0] || (entry[0] === 'team' && tab() === 'agents')" [attr.aria-current]="tab() === entry[0] ? 'page' : null"><mat-icon aria-hidden="true">{{ entry[2] }}</mat-icon>{{ entry[1] }}</a> }
    </nav>
    @switch (tab()) {
      @case ('roles') { <aludel-work-roles [focus]="ctx.segments()[2] || null" /> }
      @case ('items') { <aludel-work-items [selectedId]="ctx.segments()[2] || null" /> }
      @case ('projects') { <aludel-work-projects /> }
      @case ('team') { <aludel-work-team /> }
      @case ('agents') { <aludel-work-team /> }
      @case ('routines') {
        <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Routines"><table><thead><tr><th>Routine</th><th>Role</th><th>Runs</th><th>Next</th><th>Last item</th><th>On</th><th><span class="visually-hidden">Run</span></th></tr></thead><tbody>
          @for (routine of routines(); track routine.id) { <tr><td><strong>{{ routine.title }}</strong>@if (actionFor(routine); as action) { <br><span class="lay-muted small">Goes to {{ ctx.whoName(action.assignee) }}, like any “{{ action.name }}” item</span> }</td>
            <td><span [class]="'lay-chip lay-l-' + routine.layer">{{ ctx.roleByLayer().get(routine.layer)?.name || layerLabel[routine.layer] }}</span></td>
            <td>{{ cadenceLabel[routine.cadence] }}</td><td class="small">{{ !routine.enabled ? 'Off' : routine.cadence === 'before-release' ? 'Next build' : when(routine.nextRunAt) }}</td>
            <td class="small">@if (routine.lastWorkId && ctx.workById().get(routine.lastWorkId); as last) { <a [href]="ctx.link('work', 'item', last.id)" (click)="ctx.go(ctx.link('work', 'item', last.id), $event)">{{ last.ref }}</a> {{ statusLabel[last.status] }} } @else { — }</td>
            <td><input type="checkbox" [checked]="routine.enabled" (change)="toggleRoutine(routine.id, routine.revision, $any($event.target).checked)" [attr.aria-label]="(routine.enabled ? 'Turn off ' : 'Turn on ') + routine.title"></td>
            <td><button type="button" class="lay-button ghost small" (click)="runRoutine(routine.id)" [attr.aria-label]="'Run ' + routine.title + ' now'">Run now</button></td></tr> }</tbody></table></div>
        <form class="lay-card lay-form lay-gap-top" (ngSubmit)="addRoutine()" aria-labelledby="new-routine"><h2 id="new-routine">New routine</h2>
          <div class="lay-row lay-wrap lay-fields"><label>Title<input name="routineTitle" [(ngModel)]="newRoutine.title" placeholder="Monthly roadmap review"></label>
            <label>Layer<select name="routineLayer" [(ngModel)]="newRoutine.layer">@for (entry of layerEntries; track entry[0]) { <option [value]="entry[0]">{{ entry[1] }}</option> }</select></label>
            <label>Work type<select name="routineType" [(ngModel)]="newRoutine.type">@for (type of ctx.data()?.workTypes || []; track type) { <option [value]="type">{{ typeLabel(type) }}</option> }</select></label>
            <label>Runs<select name="routineCadence" [(ngModel)]="newRoutine.cadence">@for (entry of cadenceEntries; track entry[0]) { <option [value]="entry[0]">{{ entry[1] }}</option> }</select></label></div>
          <label>Will document (one per line)<textarea name="routineDocuments" rows="2" [(ngModel)]="newRoutine.documents"></textarea></label>
          <button type="submit" class="lay-button small">Add routine</button></form>
      }
      @default { <aludel-work-board /> }
    }
  }`
})
export class WorkLayerComponent implements OnDestroy {
  readonly ctx = inject(ProjectContext);
  // ROADMAP-01 (DEC-043): Items and Projects follow Linear; Team holds people and the agent profiles; tabs carry their records' icons.
  readonly tabs: [string, string, string][] = [['board', 'Board', 'view_kanban'], ['items', 'Items', 'task_alt'], ['projects', 'Projects', 'deployed_code_history'], ['roles', 'Roles', 'badge'], ['team', 'Team', 'group'], ['routines', 'Routines', 'event_repeat']];
  readonly heading: Record<string, string> = { board: 'Board', items: 'Items', projects: 'Projects', roles: 'Roles', team: 'Team', agents: 'Team', routines: 'Routines' };
  readonly lead: Record<string, string> = {
    board: 'Batches are what\'s being worked on now, by you and by agents. Next fills a batch from the current milestone.',
    roles: 'Each layer has a role that owns its work. Every action says who takes it, what they must know and what they may do. A shield marks an action for leads only.',
    routines: 'Each run creates an ordinary item, assigned like any other by its action. A routine never opens a second item while its last one is open.'
  };
  readonly layerLabel = layerLabel;
  readonly statusLabel = workStatusLabel;
  readonly cadenceLabel: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', 'before-release': 'Before each release' };
  readonly cadenceEntries = Object.entries(this.cadenceLabel);
  readonly layerEntries = Object.entries(layerLabel);
  // /work, /work/board, and the old /work/queue and /work/style addresses all land somewhere sensible.
  readonly tab = computed(() => { const segment = this.ctx.segments()[1] || 'board'; return segment === 'queue' ? 'board' : segment === 'style' ? 'roles' : segment; });
  readonly routines = computed(() => this.ctx.data()?.routines || []);
  readonly live = computed(() => (this.ctx.data()?.batches || []).some(batch => batch.state === 'running' || batch.state === 'stopping'));
  newRoutine = { title: '', layer: 'product', type: 'audit', cadence: 'weekly', documents: '' };
  private poll: ReturnType<typeof setInterval> | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // While a batch runs: reload every two seconds and tick the clock every second, so progress shows without a reload.
    effect(() => {
      const running = this.live();
      untracked(() => {
        if (running && !this.poll) { this.poll = setInterval(() => void this.ctx.reload().catch(() => undefined), 2000); this.clock = setInterval(() => this.ctx.now.set(Date.now()), 1000); }
        if (!running && this.poll) { clearInterval(this.poll); clearInterval(this.clock!); this.poll = this.clock = null; }
      });
    });
  }
  ngOnDestroy() { if (this.poll) clearInterval(this.poll); if (this.clock) clearInterval(this.clock); }

  actionFor(routine: { key: string | null; layer: string; type: string }) {
    const actions = (this.ctx.data()?.roles || []).flatMap(role => role.actions.map(action => ({ ...action, layer: role.layer })));
    return actions.find(action => routine.key && action.routine === routine.key) || actions.find(action => action.layer === routine.layer && action.type === routine.type) || null;
  }
  typeLabel(type: string) { return type.charAt(0).toUpperCase() + type.slice(1); }
  when(at: string | null) { return at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'; }
  toggleRoutine(id: string, revision: number, enabled: boolean) { void this.ctx.write(() => this.ctx.change(id, { enabled }, revision, enabled ? 'Turned on' : 'Turned off'), enabled ? 'Routine on.' : 'Routine off.'); }
  runRoutine(id: string) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/routines/${encodeURIComponent(id)}`, 'POST', {}), 'Ran it. The new item is in the queue.'); }
  addRoutine() {
    void this.ctx.write(async () => { await this.ctx.record('routine', { ...this.newRoutine, documents: lines(this.newRoutine.documents) }, null, 'Added by you'); this.newRoutine = { title: '', layer: 'product', type: 'audit', cadence: 'weekly', documents: '' }; }, 'Routine added.');
  }
}
