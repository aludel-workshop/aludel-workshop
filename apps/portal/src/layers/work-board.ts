import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Assignee, Batch, ProjectContext, WorkItem, priorityOrder } from './context';
import { AvatarComponent, WorkCardComponent, isRunning, tokens, elapsed } from './work-shared';

const byPriority = (a: WorkItem, b: WorkItem) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority) || a.number - b.number;
interface Lane { key: string; who: Assignee; title: string; items: WorkItem[]; batch: Batch | null; }

// Work › Board (WORK-UX-01): batches are what's being worked on now, one per assignee; agent results stay in their batch
// until someone clears them. Everything else waits in Queue or Backlog, highest priority first; Done keeps the history.
@Component({
  selector: 'aludel-work-board', standalone: true, imports: [MatIconModule, MatTooltipModule, AvatarComponent, WorkCardComponent],
  template: `
  <div class="lay-section-head"><h2>Batches</h2><span class="lay-muted small">Agent results stay in their batch until you clear them</span></div>
  <div class="lay-lanes">
    @for (lane of lanes(); track lane.key) {
      <section class="lay-lane" [class.lay-lane-running]="running(lane)" [attr.aria-label]="lane.title" [id]="'lane-' + lane.key">
        <div class="lay-lane-head"><aludel-avatar [who]="lane.who" size="lg" />
          <div class="lay-lane-who"><strong>{{ lane.title }}</strong><small>{{ laneNote(lane) }}</small></div>
          <div class="lay-lane-right">
            @if (running(lane) && lane.batch; as batch) {
              <div class="lay-ticker"><strong>{{ elapsedFor(batch) }}</strong> active<br>{{ tokenText(batch) }} tokens</div>
              @if (batch.state === 'running') { <button type="button" class="lay-button ghost small" (click)="stopBatch(batch)"><mat-icon aria-hidden="true">pause</mat-icon>Stop run</button> }
            } @else if (lane.who.kind === 'agent' && waiting(lane) && lane.batch; as batch) {
              <button type="button" class="lay-button small" (click)="go(batch)" [disabled]="!ctx.agentReady()" [matTooltip]="ctx.agentReady() ? 'Spends on your agent account' : 'Connect an agent account first'">
                <mat-icon aria-hidden="true">play_arrow</mat-icon>Go: run {{ waiting(lane) }}</button>
            }
          </div>
        </div>
        @if (running(lane)) { <p class="lay-lock-note"><mat-icon aria-hidden="true">lock</mat-icon>Locked in while it runs. Hover an item to skip or stop it.</p> }
        @if (lane.batch; as batch) { @if (batch.note && !running(lane)) { <p class="lay-lock-note lay-lock-warn"><mat-icon aria-hidden="true">info</mat-icon>{{ batch.ref }}: {{ batch.note }}</p> } }
        @if (lane.who.kind === 'agent' && !ctx.agentReady() && waiting(lane)) { <p class="lay-lock-note lay-lock-warn"><mat-icon aria-hidden="true">power_off</mat-icon>Connect an agent account to run this batch.
          <a [href]="ctx.link('work', 'agents')" (click)="ctx.go(ctx.link('work', 'agents'), $event)">Agents</a></p> }
        @if (lane.items.length) { <ol class="lay-stack">@for (item of lane.items; track item.id) { <li><aludel-work-card [item]="item" /></li> }</ol> }
        @else { <p class="lay-lane-empty">{{ lane.key === 'me' ? 'Nothing staged for you. Stage items assigned to you from the queue.' : 'Empty.' }}</p> }
      </section>
    }
  </div>

  <div class="lay-stack-head">
    <div class="lay-subtabs" role="tablist" aria-label="Items">
      @for (tab of tabs; track tab[0]) {
        <button type="button" role="tab" [id]="'sub-' + tab[0]" [attr.aria-selected]="sub() === tab[0]" [attr.tabindex]="sub() === tab[0] ? 0 : -1" (click)="sub.set(tab[0])" (keydown)="keys($event)">
          {{ tab[1] }}<span class="lay-subtab-n">{{ counts()[tab[0]] }}</span></button>
      }
    </div>
    <div class="lay-filters" role="group" aria-label="Filter by assignee"><span class="lay-muted small">Assignee</span>
      <button type="button" class="lay-filter-all" [attr.aria-pressed]="!ctx.boardFilter()" (click)="ctx.boardFilter.set(null)">All</button>
      @for (who of people(); track who.id) {
        <button type="button" class="lay-filter" [class.lay-filter-bot]="who.kind === 'agent'" [attr.aria-pressed]="ctx.boardFilter() === who.id" (click)="toggleFilter(who.id)"
          [matTooltip]="ctx.whoName(who)" [attr.aria-label]="ctx.whoName(who)"><aludel-avatar [who]="who" size="md" /></button>
      }
      <span class="lay-sortnote"><mat-icon aria-hidden="true">sort</mat-icon>Highest priority first</span>
    </div>
  </div>
  <p class="lay-muted small lay-stack-hint">{{ hint[sub()] }}</p>
  <div role="tabpanel" [attr.aria-labelledby]="'sub-' + sub()">
    @if (list().length) { <ol class="lay-stack">@for (item of list(); track item.id) { <li><aludel-work-card [item]="item" /></li> }</ol> }
    @else { <p class="lay-empty">{{ empty[sub()] }}</p> }
  </div>
  @if (sub() === 'done' && finished().length) {
    <details class="lay-log-list"><summary>Earlier batches · {{ finished().length }}</summary><ul class="small lay-plain-list">
      @for (batch of finished(); track batch.id) { <li>{{ batch.ref }} · {{ ctx.whoName({ kind: 'agent', id: batch.profileId }) }} · {{ batch.state === 'done' ? 'finished' : 'stopped' }} {{ when(batch.finishedAt) }} · {{ batch.items.length }} items · {{ batch.usage.input + batch.usage.output }} tokens{{ batch.note ? ' · ' + batch.note : '' }}</li> }</ul></details>
  }`
})
export class WorkBoardComponent {
  readonly ctx = inject(ProjectContext);
  readonly tabs: [string, string][] = [['queue', 'Queue'], ['backlog', 'Backlog'], ['done', 'Done']];
  readonly sub = signal('queue');
  readonly hint: Record<string, string> = { queue: 'Staging puts an item in its assignee\'s batch: yours, or that agent\'s.', backlog: 'Gaps the layers found and work nobody has queued yet. Queue what you want done.', done: 'Cleared work. The records it changed keep the history.' };
  readonly empty: Record<string, string> = { queue: 'Nothing queued. Queue items from the backlog.', backlog: 'Nothing in the backlog.', done: 'Nothing done yet.' };
  private readonly work = computed(() => this.ctx.data()?.work || []);
  private readonly filtered = computed(() => { const who = this.ctx.boardFilter(); return who ? this.work().filter(item => item.assignee?.id === who) : this.work(); });
  readonly counts = computed(() => ({ queue: this.filtered().filter(item => item.status === 'queued').length, backlog: this.filtered().filter(item => item.status === 'backlog').length, done: this.filtered().filter(item => item.status === 'done').length } as Record<string, number>));
  readonly list = computed(() => {
    const status = this.sub() === 'queue' ? 'queued' : this.sub();
    const items = this.filtered().filter(item => item.status === status);
    return status === 'done' ? items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : items.sort(byPriority);
  });
  readonly people = computed<Assignee[]>(() => [...(this.ctx.data()?.members || []).map(member => ({ kind: 'person' as const, id: member.id })),
    ...(this.ctx.data()?.profiles || []).filter(profile => profile.active).map(profile => ({ kind: 'agent' as const, id: profile.id }))]);
  readonly finished = computed(() => (this.ctx.data()?.batches || []).filter(batch => batch.state === 'done' || batch.state === 'stopped'));
  // One lane per assignee: you first, then other people with staged work, then each agent profile with a batch.
  readonly lanes = computed<Lane[]>(() => {
    const data = this.ctx.data(); if (!data) return [];
    const me = this.ctx.me();
    const inLane = (item: WorkItem) => ['staged', 'working', 'needs', 'review'].includes(item.status) && (item.assignee?.kind === 'agent' ? Boolean(item.context?.batch) : true);
    const lanes: Lane[] = [];
    const people = [me, ...data.members.map(member => member.id).filter(id => id !== me)];
    for (const id of people) {
      const items = this.work().filter(item => item.assignee?.kind === 'person' && item.assignee.id === id && inLane(item)).sort(byPriority);
      if (id === me || items.length) lanes.push({ key: id === me ? 'me' : id, who: { kind: 'person', id }, title: id === me ? 'Your batch' : `${this.ctx.whoName({ kind: 'person', id })}'s batch`, items, batch: null });
    }
    for (const profile of data.profiles) {
      const items = this.work().filter(item => item.assignee?.kind === 'agent' && item.assignee.id === profile.id && inLane(item)).sort(byPriority);
      if (!items.length) continue;
      const batches = data.batches.filter(batch => batch.profileId === profile.id);
      const batch = batches.find(isRunningBatch) || batches.find(entry => entry.state === 'draft') || batches.find(entry => items.some(item => item.context?.batch === entry.id)) || null;
      lanes.push({ key: profile.id, who: { kind: 'agent', id: profile.id }, title: profile.name, items, batch });
    }
    const who = this.ctx.boardFilter();
    return who ? lanes.filter(lane => lane.who.id === who) : lanes;
  });

  running(lane: Lane) { return isRunning(lane.batch); }
  waiting(lane: Lane) { return lane.items.filter(item => item.status === 'staged').length; }
  laneNote(lane: Lane) {
    if (lane.who.kind === 'person') return lane.key === 'me' ? 'Your work, highest priority first' : 'Their work, highest priority first';
    const batch = lane.batch;
    if (!batch) return '';
    const state = batch.state === 'draft' ? 'Staged, not started' : batch.state === 'running' ? 'Running' : batch.state === 'stopping' ? 'Stopping after the current item' : this.waiting(lane) ? 'Ready to run again' : 'Finished: clear each item to close it';
    return `${batch.ref} · ${state}`;
  }
  elapsedFor(batch: Batch) { return elapsed(batch.startedAt || undefined, this.ctx.now()); }
  tokenText(batch: Batch) { return tokens(batch.usage.input + batch.usage.output); }
  go(batch: Batch) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/batches/start`, 'POST', { batchId: batch.id }), `${batch.ref} started. Its items are locked in while it runs.`); }
  stopBatch(batch: Batch) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/batches/stop`, 'POST', { batchId: batch.id }), 'Stopping after the current item.'); }
  toggleFilter(id: string | null) { this.ctx.boardFilter.set(this.ctx.boardFilter() === id ? null : id); }
  when(at: string | null) { return at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''; }
  keys(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const keys = this.tabs.map(tab => tab[0]);
    const next = keys[(keys.indexOf(this.sub()) + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
    this.sub.set(next);
    setTimeout(() => document.getElementById(`sub-${next}`)?.focus());
  }
}
const isRunningBatch = (batch: Batch) => batch.state === 'running' || batch.state === 'stopping';
