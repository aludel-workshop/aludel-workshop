import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectContext, WorkChange, WorkRun, layerLabel, priorityLabel, priorityOrder, workStatusLabel } from './context';
import { AvatarComponent, PriorityComponent, RefChipComponent, RoleChipComponent, agentRunnable, batchOf, isRunning } from './work-shared';
import { NextRunComponent, RunCardComponent, runTitle } from './work-run';


// WORK-ITEM-UX-01: a work item is its task plus its runs. The header names it and offers the one item-level action; each started
// run has its own tab with what it was given, did and produced; Next run holds the task until Go. Links, planning and the
// knowledge an agent receives sit alongside; Activity stays below, outside any run.
@Component({
  selector: 'aludel-work-item', standalone: true, imports: [FormsModule, MatIconModule, MatMenuModule, MatTooltipModule, AvatarComponent, PriorityComponent, RefChipComponent, RoleChipComponent, NextRunComponent, RunCardComponent],
  template: `
  @if (item(); as work) {
    <p class="lay-eyebrow"><a [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)">Work</a> › {{ work.ref }}</p>
    <div class="wi-head"><h1 tabindex="-1">{{ work.title }}</h1>
      <div class="wi-head-act">
        @if (!openRun()) { @switch (work.status) {
          @case ('backlog') { <button type="button" class="lay-button" (click)="update({ state: 'ready' }, work.ref + ' queued.')"><mat-icon aria-hidden="true">add</mat-icon>Queue</button> }
          @case ('queued') { <button type="button" class="lay-button" (click)="update({ stage: true }, work.ref + ' staged.')" [disabled]="!!stageBlock()" [matTooltip]="stageBlock() || ''"><mat-icon aria-hidden="true">playlist_add</mat-icon>Stage in {{ work.assignee?.kind === 'agent' ? ctx.whoName(work.assignee) + '\\'s batch' : 'your batch' }}</button> }
          @case ('staged') { @if (work.assignee?.kind === 'person') { <button type="button" class="lay-button" (click)="startPerson()"><mat-icon aria-hidden="true">play_arrow</mat-icon>I'm working</button> } }
          @case ('blocked') { @if (work.migration?.disposition !== 'blocked' && !work.blockedBy.length && !work.context?.batch) { <button type="button" class="lay-button" (click)="update({ stage: true }, work.ref + ' staged to retry.')">Stage again</button> } }
        } }
        @if (canArchive()) { <button type="button" class="lay-button ghost" [matMenuTriggerFor]="itemMenu" aria-label="More task actions"><mat-icon aria-hidden="true">more_horiz</mat-icon></button>
          <mat-menu #itemMenu="matMenu" class="lay-menu"><button mat-menu-item type="button" (click)="archive()"><mat-icon aria-hidden="true">archive</mat-icon><span>Archive task</span></button></mat-menu> }
      </div></div>
    @if (work.migration?.disposition === 'blocked') { <p class="lay-lock-note lay-lock-warn" role="status">This historical action needs reassessment: {{ work.migration?.reason }}</p> }
    <div class="wi-facts">
      <button type="button" class="lay-prio-btn" [matMenuTriggerFor]="priorityMenu" [attr.aria-label]="'Priority: ' + priorityLabel[work.priority] + '. Change'"><aludel-priority [value]="work.priority" [text]="true" /><mat-icon aria-hidden="true">expand_more</mat-icon></button>
      <mat-menu #priorityMenu="matMenu" class="lay-menu">@for (level of priorities; track level) { <button mat-menu-item type="button" (click)="update({ priority: level }, work.ref + ' is now ' + priorityLabel[level] + ' priority.')"><aludel-priority [value]="level" /><span>{{ priorityLabel[level] }}</span>@if (level === work.priority) { <mat-icon class="lay-menu-check" aria-label="current">check</mat-icon> }</button> }</mat-menu>
      <span [class]="'lay-st lay-st-' + work.status">{{ statusLabel[work.status] }}</span>
      <aludel-role-chip [layer]="work.layer" [action]="work.action" />
      <span class="small lay-muted"><mat-icon aria-hidden="true">calendar_today</mat-icon>Created {{ day(work.createdAt) }}</span>
    </div>

    <div class="wi-layout">
      <div class="wi-main">
        <div class="wi-tabbar">
          <div class="wi-tabs" role="tablist" aria-label="Runs" #tabStrip>
            @for (run of runs(); track run.id) {
              <button type="button" role="tab" class="wi-tab" [attr.aria-selected]="selected() === run.id" (click)="choose(run.id)">
                <aludel-avatar [who]="{ kind: run.performer.kind, id: run.performer.id }" /><span>Run {{ run.number }}</span><i [class]="'wi-dot wi-dot-' + run.state" aria-hidden="true"></i><small>{{ runTitle[run.state] }}</small></button>
            }
            @if (showNext()) { <button type="button" role="tab" class="wi-tab" [attr.aria-selected]="selected() === 'next'" (click)="choose('next')"><mat-icon aria-hidden="true">edit_note</mat-icon><span>Next run</span><small>{{ work.status === 'backlog' ? 'Backlog' : pinned() ? 'Pinned' : 'Draft' }}</small></button> }
          </div>
          <span class="wi-runcount">{{ runs().length ? runs().length + (runs().length === 1 ? ' run' : ' runs') : 'No runs yet' }}</span>
        </div>
        <div class="wi-card" role="tabpanel">
          @if (selectedRun(); as run) { <aludel-run-card [item]="work" [run]="run" [edits]="edits()" (changed)="refresh()" /> }
          @else { <aludel-next-run [item]="work" [edits]="edits()" (changed)="refresh()" /> }
        </div>

        <section class="wi-activity" aria-labelledby="log-heading"><h2 id="log-heading"><mat-icon aria-hidden="true">history</mat-icon>Activity <span class="lay-count">{{ work.log.length }}</span></h2>
          <ol class="lay-worklog">@for (entry of work.log; track $index) {
            <li>@if (entry.by) { <aludel-avatar [who]="$any(entry.by)" /> } @else { <span class="lay-av lay-av-sm lay-av-system" aria-hidden="true"><mat-icon>deployed_code</mat-icon></span> }
              <div><div class="lay-log-line">@if (entry.by) { <strong>{{ ctx.whoName($any(entry.by)) }}</strong> {{ lowerFirst(entry.text) }} } @else { {{ entry.text }} }<span class="lay-when">{{ when(entry.at) }}</span></div>
                @if (entry.refs?.length) { <div class="lay-refs">@for (ref of entry.refs; track ref) { <aludel-ref [id]="ref" /> }</div> }</div></li> }</ol>
          <form class="lay-comment" (ngSubmit)="note()"><label class="visually-hidden" for="work-note">Add a note to the activity</label><input id="work-note" name="note" [(ngModel)]="noteDraft" placeholder="Add a note…">
            <button type="submit" class="lay-button ghost small" [disabled]="!noteDraft.trim()">Add</button></form>
        </section>
      </div>

      <aside class="wi-side">
        <section aria-labelledby="links-heading"><h2 id="links-heading">Links</h2>
          @if (work.blockedBy.length) { <h3>Is blocked by</h3><ul class="lay-links">@for (id of work.blockedBy; track id) { <li><aludel-ref [id]="id" /><button type="button" class="lay-xbutton" (click)="unlink(id, work.id)" [attr.aria-label]="'Remove link to ' + ctx.workById().get(id)?.ref"><mat-icon aria-hidden="true">close</mat-icon></button></li> }</ul> }
          @if (work.blocks.length) { <h3>Blocks</h3><ul class="lay-links">@for (id of work.blocks; track id) { <li><aludel-ref [id]="id" /><button type="button" class="lay-xbutton" (click)="unlink(work.id, id)" [attr.aria-label]="'Remove link to ' + ctx.workById().get(id)?.ref"><mat-icon aria-hidden="true">close</mat-icon></button></li> }</ul> }
          @if (!work.blockedBy.length && !work.blocks.length) { <p class="lay-muted small">Not blocked, and blocks nothing.</p> }
          <form class="lay-link-form" (ngSubmit)="link()"><label class="visually-hidden" for="link-kind">Link type</label>
            <select id="link-kind" name="linkKind" [(ngModel)]="linkKind"><option value="blocked">Is blocked by</option><option value="blocks">Blocks</option></select>
            <label class="visually-hidden" for="link-item">Work item</label>
            <select id="link-item" name="linkItem" [(ngModel)]="linkItem"><option value="">Choose an item…</option>@for (other of linkable(); track other.id) { <option [value]="other.id">{{ other.ref }} {{ other.title }}</option> }</select>
            <button type="submit" class="lay-button ghost small" [disabled]="!linkItem">Link</button></form>
        </section>
        <section aria-labelledby="plan-heading"><h2 id="plan-heading">Planning</h2>
          <dl class="lay-dfields">
            <dt>Project</dt><dd>@if (planProject(); as project) { <a [href]="ctx.link('work', 'projects', project.id)" (click)="ctx.go(ctx.link('work', 'projects', project.id), $event)">{{ project.ref }} {{ project.title }}</a> } @else { <span class="lay-muted">None</span> }</dd>
            @if (planProject(); as project) { <dt>Milestone</dt><dd>{{ milestone(project.milestone) }}</dd>
              @if (checkpoint(); as point) { <dt>Checkpoint</dt><dd>{{ point }}</dd> }
              @if (project.target) { <dt>Target</dt><dd>{{ day(project.target) }}</dd> } }
            @if (batch(); as current) { <dt>Batch</dt><dd>{{ current.ref }} · {{ current.state === 'draft' ? 'not started' : current.state }}</dd> }
            <dt>Source</dt><dd class="small">{{ source() }}</dd>
            <dt>Created</dt><dd class="small">{{ when(work.createdAt) }}</dd>
            <dt>Updated</dt><dd class="small">{{ when(work.updatedAt) }}</dd>
          </dl>
        </section>
        <section aria-labelledby="linked-heading"><h2 id="linked-heading">Linked knowledge</h2>
          <p class="small lay-muted">What an agent receives with this task.</p>
          @if (work.targets.length) { <h3><mat-icon aria-hidden="true">edit</mat-icon>Works on</h3><div class="lay-refs lay-refs-col">@for (target of work.targets; track target.id) { <aludel-ref [id]="target.id" [fallback]="target.label" /> }</div> }
          @if (reads().length) { <h3><mat-icon aria-hidden="true">visibility</mat-icon>Reads</h3><div class="lay-refs lay-refs-col">@for (id of reads(); track id) { <aludel-ref [id]="id" /> }</div> }
          @if (pins().length) { <h3><mat-icon aria-hidden="true">push_pin</mat-icon>Instructions</h3><ul class="lay-pins">@for (pin of pins(); track pin.id) { <li><aludel-ref [id]="pin.id" /><span class="lay-muted small">revision {{ pin.revision }}</span></li> }</ul> }
          @if (!work.targets.length && !reads().length && !pins().length) { <p class="lay-muted small">Nothing linked yet. Instructions are pinned when a run starts.</p> }
        </section>
      </aside>
    </div>
  } @else { <h1 tabindex="-1">Work item not found</h1><p><a [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)">Back to the board</a></p> }`
})
export class WorkItemComponent {
  readonly ctx = inject(ProjectContext);
  readonly id = input.required<string>();
  readonly statusLabel = workStatusLabel;
  readonly priorityLabel = priorityLabel;
  readonly priorities = priorityOrder;
  readonly runTitle = runTitle;
  readonly tabStrip = viewChild<ElementRef<HTMLElement>>('tabStrip');
  readonly item = computed(() => this.ctx.workById().get(this.id()) || null);
  readonly action = computed(() => this.ctx.actionById().get(this.item()?.action || '') || null);
  readonly batch = computed(() => { const work = this.item(); return work ? batchOf(this.ctx, work) : null; });
  readonly pinned = computed(() => { const batch = this.batch(); return Boolean(batch && (isRunning(batch) || batch.state === 'queued')); });
  readonly profile = computed(() => this.ctx.profileById().get(this.item()?.assignee?.id || '') || null);
  readonly runs = signal<WorkRun[]>([]);
  readonly runsLoaded = signal(false);
  readonly edits = signal<WorkChange[]>([]);
  readonly picked = signal<string | null>(null);
  // Next run is shown whenever the task is open for another run: before any work, and after a run is closed without acceptance.
  // A run still waiting on its reviewer (live, in review, or failed and not yet closed) keeps the task shut.
  readonly openRun = computed(() => { const last = this.runs()[this.runs().length - 1]; return last && ['working', 'needs', 'review', 'failed', 'stopped'].includes(last.state) ? last : null; });
  readonly canArchive = computed(() => { const run = this.openRun(); return this.runsLoaded() && !this.pinned() && (!run || ['failed', 'stopped'].includes(run.state)); });
  readonly showNext = computed(() => { const work = this.item(); return Boolean(work && work.status !== 'done' && !this.openRun()); });
  readonly selected = computed(() => { const chosen = this.picked(); const all = this.runs();
    if (chosen && (chosen === 'next' ? this.showNext() : all.some(run => run.id === chosen))) return chosen;
    const last = all[all.length - 1];
    return this.openRun()?.id || (this.showNext() ? 'next' : last?.id || 'next'); });
  readonly selectedRun = computed(() => this.runs().find(run => run.id === this.selected()) || null);
  readonly stageBlock = computed(() => { const work = this.item(); if (!work) return null;
    if (work.blockedBy.length) return `Blocked by ${work.blockedBy.map(id => this.ctx.workById().get(id)?.ref).join(', ')}`;
    if (!work.assignee) return 'Assign it to someone first';
    if (work.assignee.kind === 'agent' && !agentRunnable(work, this.ctx)) return `Agents can't run “${this.action()?.name || work.type}” yet. Assign it to a person.`;
    return null; });
  readonly planProject = computed(() => this.ctx.projectById().get(this.item()?.project || '') || null);
  readonly checkpoint = computed(() => this.planProject()?.checkpoints.find(point => point.id === this.item()?.checkpoint)?.title || null);
  readonly reads = computed(() => { const work = this.item(); if (!work) return []; const targets = new Set(work.targets.map(target => target.id));
    return [...new Set([...(this.action()?.reads || []), ...(this.profile()?.context || [])])].filter(id => !targets.has(id)); });
  readonly pins = computed(() => { const pins = this.item()?.instructions; return pins ? [pins.principles, pins.project, pins.role, pins.action, pins.profile].filter((pin): pin is NonNullable<typeof pin> => Boolean(pin)) : []; });
  readonly linkable = computed(() => { const work = this.item(); return (this.ctx.data()?.work || []).filter(other => other.id !== work?.id && other.status !== 'done' && !work?.blocks.includes(other.id) && !work?.blockedBy.includes(other.id)); });
  noteDraft = ''; linkKind = 'blocked'; linkItem = '';
  private loadedFor = '';
  private scrolledFor = '';

  constructor() {
    // Runs and edits are read when the item opens and again whenever it changes.
    effect(() => {
      const work = this.item(); const key = work ? `${work.id}:${work.updatedAt}` : '';
      untracked(() => { if (!work || key === this.loadedFor) return; if (!this.loadedFor.startsWith(`${work.id}:`)) this.picked.set(null); this.loadedFor = key; this.load(); });
    });
    // F13: the tab strip opens scrolled to the newest run.
    effect(() => {
      const strip = this.tabStrip()?.nativeElement; const count = this.runs().length; const id = this.item()?.id || '';
      if (strip && `${id}:${count}` !== this.scrolledFor) { this.scrolledFor = `${id}:${count}`; setTimeout(() => strip.scrollLeft = strip.scrollWidth); }
    });
  }

  load() {
    const work = this.item(); if (!work) return;
    const base = `/api/projects/${encodeURIComponent(this.ctx.projectId())}`;
    this.runsLoaded.set(false);
    void this.ctx.api<{ runs: WorkRun[] }>(`${base}/work/${encodeURIComponent(work.id)}/runs`).then(value => { this.runs.set(value.runs); this.runsLoaded.set(true); }, () => { this.runs.set([]); this.runsLoaded.set(true); });
    void this.ctx.api<{ changes: WorkChange[] }>(`${base}/changes/${encodeURIComponent(work.id)}`).then(value => this.edits.set(value.changes), () => this.edits.set([]));
  }
  refresh() { this.loadedFor = ''; this.load(); }
  startPerson() { void this.ctx.write(async () => {
    await this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work/${encodeURIComponent(this.id())}/runs`, 'POST', { action: 'start-person' });
    await this.ctx.reload(); this.refresh();
  }, 'Work started.'); }
  choose(id: string) { this.picked.set(id); }
  update(body: unknown, success = '') { void this.ctx.write(() => this.ctx.updateWork(this.id(), body), success); }
  archive() { const work = this.item(); if (!work || !confirm(`Archive ${work.ref} “${work.title}”? Its task, runs and activity will be preserved, but it will leave normal Work views.`)) return;
    void this.ctx.write(async () => { await this.ctx.updateWork(work.id, { archive: true }); this.ctx.go(this.ctx.link('work', 'items')); }, `${work.ref} archived.`); }
  note() { const text = this.noteDraft.trim(); if (!text) return; void this.ctx.write(async () => { await this.ctx.updateWork(this.id(), { note: text }); this.noteDraft = ''; }); }
  link() {
    const work = this.item(); const other = this.ctx.workById().get(this.linkItem); if (!work || !other) return;
    const [from, to] = this.linkKind === 'blocks' ? [work, other] : [other, work];
    void this.ctx.write(async () => { await this.ctx.updateWork(from.id, { blocks: [...from.blocks, to.id] }); this.linkItem = ''; }, `${from.ref} now blocks ${to.ref}.`);
  }
  unlink(fromId: string, toId: string) { const from = this.ctx.workById().get(fromId); if (from) void this.ctx.write(() => this.ctx.updateWork(fromId, { blocks: from.blocks.filter(id => id !== toId) }), 'Link removed.'); }
  source() {
    const work = this.item(); if (!work) return '';
    if (work.context?.routine) return 'A routine';
    // JOURNEYS-01 J5: an item Specify raised says so ("Raised by accepting W-n").
    if (work.log[0]?.text?.startsWith('Created by') || work.context?.journeyWork) return work.log[0]?.text || 'Added by hand';
    return work.context?.suggestion && work.type !== 'reconcile' && !work.log[0]?.by ? `A gap the ${layerLabel[work.layer]} layer found` : work.log[0]?.text || 'Added by hand';
  }
  milestone(key: string) { return this.ctx.data()?.phases.find(phase => phase.key === key)?.label || key; }
  lowerFirst(text: string) { return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text; }
  day(at: string) { return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  when(at: string) { const date = new Date(at); return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${date.toTimeString().slice(0, 5)}`; }
}
