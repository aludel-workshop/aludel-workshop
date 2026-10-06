import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Assignee, ProjectContext, WorkItem, priorityOrder } from './context';
import { AvatarComponent, PriorityComponent, RoleChipComponent } from './work-shared';
import type { GoalView } from './work-goal';

type Column = 'draft' | 'ready' | 'progress' | 'review' | 'done';
// GET …/goals: each goal item's action counts by state, open needs and the layers its actions name.
type GoalSummary = { id: string; defined: boolean; actions: Record<string, number>; needs: number; layers: string[] };
type Ask = { kind: 'define' | 'start' | 'done'; item: WorkItem };

const columns: [Column, string][] = [['draft', 'Draft'], ['ready', 'Ready'], ['progress', 'In progress'], ['review', 'In review'], ['done', 'Done']];
const byPriority = (a: WorkItem, b: WorkItem) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority) || a.number - b.number;

// Work › Board (AGENT-WORK-01 A6, W-8): one Kanban board, five columns derived from each item's status. Moves are the
// server's rules (Ready needs a defined item, In progress an assignee and a confirmed start; Done only from close-out),
// so a refused move says why and changes nothing. Clicking a card opens its peek; Move to there is the keyboard
// alternative to dragging. A layer's Tasks tab renders this same board with [layer], showing only that layer's items.
@Component({
  selector: 'aludel-work-board', standalone: true, imports: [FormsModule, MatIconModule, MatTooltipModule, AvatarComponent, PriorityComponent, RoleChipComponent],
  template: `
  <div class="lay-kb-bar">
    <div class="lay-kb-filters" role="group" aria-label="Filter the board">
      <button type="button" class="lay-kb-needs" [attr.aria-pressed]="needsOnly()" (click)="needsOnly.set(!needsOnly())"><mat-icon aria-hidden="true">front_hand</mat-icon>Needs you · {{ needsCount() }}</button>
      @if (!layer()) { <label>Layer <select [ngModel]="layerFilter()" (ngModelChange)="layerFilter.set($event)"><option value="">All</option>@for (entry of layerOptions(); track entry.key) { <option [value]="entry.key">{{ entry.name }}</option> }</select></label> }
      <label>Assignee <select [ngModel]="ctx.boardFilter() || ''" (ngModelChange)="ctx.boardFilter.set($event || null)"><option value="">Anyone</option><option value="none">Unassigned</option>
        @for (who of people(); track who.id) { <option [value]="who.id">{{ ctx.whoName(who) }}</option> }</select></label>
    </div>
    <a class="lay-button small" [href]="createLink()" (click)="ctx.go(createLink(), $event)"><mat-icon aria-hidden="true">add</mat-icon>Create task</a>
  </div>
  <div class="lay-kb-wrap">
    <div class="lay-kb">
      @for (col of columns; track col[0]) {
        <section class="lay-kb-col" [class.lay-kb-over]="over() === col[0]" [attr.aria-labelledby]="'kb-' + col[0]" [attr.data-col]="col[0]"
          (dragover)="dragOver($event, col[0])" (dragleave)="over.set(null)" (drop)="drop($event, col[0])">
          <h2 class="lay-kb-head" [id]="'kb-' + col[0]"><span [class]="'lay-kb-label lay-kb-' + col[0]">{{ col[1] }}</span><span class="lay-kb-n">{{ byColumn()[col[0]].length }}</span></h2>
          @for (item of byColumn()[col[0]]; track item.id) {
            <article class="lay-kb-card" [class.lay-kb-sel]="peekId() === item.id" [attr.data-ref]="item.ref" [attr.draggable]="item.scope === 'goal'" (dragstart)="dragStart($event, item)" (dragend)="over.set(null)">
              <div class="lay-kb-top"><span class="lay-kb-ref">{{ item.ref }}</span>@if (live(item)) { <span class="lay-kb-live" role="img" aria-label="Work is running"></span> }</div>
              <button type="button" class="lay-kb-title" [class.lay-kb-rough]="rough(item)" (click)="peek(item)" [attr.aria-expanded]="peekId() === item.id">{{ item.title }}</button>
              <div class="lay-kb-row"><aludel-priority [value]="item.priority" [text]="true" />
                @for (key of layersOf(item); track key) { <aludel-role-chip [layer]="key" /> }
                @if (needsOf(item); as n) { <span class="lay-kb-needbadge" role="img" [attr.aria-label]="n + ' need' + (n === 1 ? 's' : '') + ' you'"><mat-icon aria-hidden="true">front_hand</mat-icon>{{ n }}</span> }</div>
              <div class="lay-kb-foot">
                @if (item.assignee; as who) { <span class="lay-kb-who"><aludel-avatar [who]="who" size="sm" />{{ whoLabel(who) }}</span> } @else { <span>Unassigned</span> }
                @if (progressOf(item); as p) { <span class="lay-kb-prog" role="img" [attr.aria-label]="p.done + ' of ' + p.total + ' actions done'"><i [style.width.%]="100 * p.done / p.total"></i></span><span>{{ p.done }}/{{ p.total }}</span> }
                @if (item.context?.routine) { <span class="lay-kb-from"><mat-icon aria-hidden="true">autorenew</mat-icon>Routine</span> }
              </div>
            </article>
          } @empty { <p class="lay-kb-empty">{{ col[0] === 'draft' && !filtersOn() ? 'Nothing here. Create a task.' : 'Nothing here.' }}</p> }
        </section>
      }
    </div>
    @if (peekItem(); as item) {
      <aside class="lay-kb-peek" aria-labelledby="kb-peek-h" (keydown.escape)="closePeek()">
        <div class="lay-row"><span [class]="'lay-kb-label lay-kb-' + item.board">{{ label(item.board) }}</span><span class="lay-kb-ref">{{ item.ref }}</span>
          <button type="button" class="lay-button ghost small lay-kb-close" (click)="closePeek()" aria-label="Close the peek"><mat-icon aria-hidden="true">close</mat-icon></button></div>
        <h2 id="kb-peek-h" tabindex="-1">{{ item.title }}</h2>
        <dl>
          <dt>Priority</dt><dd><aludel-priority [value]="item.priority" [text]="true" /></dd>
          <dt>Assignee</dt><dd>{{ item.assignee ? whoLabel(item.assignee) : 'Unassigned' }}</dd>
          @if (layersOf(item).length) { <dt>Layers</dt><dd class="lay-row lay-wrap">@for (key of layersOf(item); track key) { <aludel-role-chip [layer]="key" [action]="item.scope === 'goal' ? null : item.action" /> }</dd> }
          @if (item.scope === 'goal' && item.board !== 'done') {
            <dt><label for="kb-move">Move to</label></dt>
            <dd><select id="kb-move" [ngModel]="item.board" (ngModelChange)="move(item, $event)">@for (col of columns; track col[0]) { <option [value]="col[0]">{{ col[1] }}</option> }</select></dd>
          }
        </dl>
        @if (item.scope === 'goal') {
          @if (peekView(); as view) {
            @if (view.actions.length) {
              <h3>Actions</h3>
              <ol class="lay-kb-actions">@for (action of view.actions; track action.id) { @if (action.state !== 'proposed') {
                <li><mat-icon aria-hidden="true">{{ actionIcon[action.state] }}</mat-icon><span>#{{ action.number }} {{ action.goal }}</span><span class="lay-muted small">{{ actionState(action) }}</span></li> } }</ol>
            } @else { <p class="lay-muted small">No actions yet: define it on its page.</p> }
            @if (view.needs.length) { <p class="small"><mat-icon aria-hidden="true" class="lay-kb-inline">front_hand</mat-icon>{{ view.needs.length }} thing{{ view.needs.length === 1 ? '' : 's' }} need{{ view.needs.length === 1 ? 's' : '' }} you on this item.</p> }
          } @else { <p class="lay-muted small">Loading…</p> }
        } @else { <p class="lay-muted small">This item moves from its own page.</p> }
        <a class="lay-button" [href]="ctx.link('work', 'item', item.id)" (click)="ctx.go(ctx.link('work', 'item', item.id), $event)"><mat-icon aria-hidden="true">open_in_new</mat-icon>Open item</a>
      </aside>
    }
  </div>
  @if (ask(); as a) {
    <div class="lay-kb-scrim" (click)="ask.set(null)"></div>
    <div class="lay-kb-dialog" role="dialog" aria-modal="true" aria-labelledby="kb-ask-h" (keydown.escape)="ask.set(null)">
      @if (a.kind === 'define') {
        <h2 id="kb-ask-h">{{ a.item.ref }} is still a rough note</h2>
        <p>Ready means someone can start it. Define it first: a brief and at least one action, written by you or your agent on its page.</p>
        <div class="lay-row lay-wrap"><a class="lay-button" [href]="ctx.link('work', 'item', a.item.id)" (click)="ask.set(null); ctx.go(ctx.link('work', 'item', a.item.id), $event)">Open item to define it</a>
          <button type="button" class="lay-button ghost" (click)="ask.set(null)">Cancel</button></div>
      } @else if (a.kind === 'done') {
        <h2 id="kb-ask-h">{{ a.item.ref }} closes from the item</h2>
        <p>An item reaches Done when its actions are reviewed and it's closed out, so the board can't skip there. Open the item to see what's left.</p>
        <div class="lay-row lay-wrap"><a class="lay-button" [href]="ctx.link('work', 'item', a.item.id)" (click)="ask.set(null); ctx.go(ctx.link('work', 'item', a.item.id), $event)"><mat-icon aria-hidden="true">open_in_new</mat-icon>Open item</a>
          <button type="button" class="lay-button ghost" (click)="ask.set(null)">Cancel</button></div>
      } @else {
        <h2 id="kb-ask-h">Start {{ a.item.ref }}?</h2>
        @if (a.item.assignee) {
          <p>{{ startLine(a.item.assignee) }} Its assignee stays once it has started.</p>
          <div class="lay-row lay-wrap"><button type="button" class="lay-button" (click)="start(a.item, false)">Start</button><button type="button" class="lay-button ghost" (click)="ask.set(null)">Cancel</button></div>
        } @else {
          <p>Nobody is assigned. Claim it to work on it with your own agent. Sending it to an agent arrives with the remote runtime (A2).</p>
          <div class="lay-row lay-wrap"><button type="button" class="lay-button" (click)="start(a.item, true)">Claim and start</button><button type="button" class="lay-button ghost" (click)="ask.set(null)">Cancel</button></div>
        }
      }
    </div>
  }`
})
export class WorkBoardComponent {
  readonly ctx = inject(ProjectContext);
  readonly layer = input<string | null>(null);
  readonly columns = columns;
  readonly createLink = computed(() => this.layer() ? this.ctx.link(this.layer()!, 'tasks', 'create') : this.ctx.link('work', 'create'));
  readonly needsOnly = signal(false);
  readonly layerFilter = signal('');
  readonly over = signal<Column | null>(null);
  readonly peekId = signal<string | null>(null);
  readonly peekView = signal<GoalView | null>(null);
  readonly ask = signal<Ask | null>(null);
  private readonly summaries = signal<Map<string, GoalSummary>>(new Map());
  private dragging: WorkItem | null = null;

  constructor() {
    // Goal summaries follow every reload of the project snapshot, so counts change with the cards.
    effect(() => { if (this.ctx.data()) void this.loadSummaries(); });
  }
  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/goals`; }
  private async loadSummaries() {
    try { const { goals } = await this.ctx.api<{ goals: GoalSummary[] }>(this.base()); this.summaries.set(new Map(goals.map(goal => [goal.id, goal]))); }
    catch { /* The board still shows every item; goal counts fill in on the next reload. */ }
    const id = this.peekId(); if (id && this.ctx.workById().get(id)?.scope === 'goal') void this.loadPeek(id);
  }

  readonly layerOptions = computed(() => this.ctx.layerInstances().map(entry => ({ key: entry.key, name: entry.name })));
  readonly people = computed<Assignee[]>(() => [...(this.ctx.data()?.members || []).map(member => ({ kind: 'person' as const, id: member.id })),
    ...(this.ctx.data()?.profiles || []).filter(profile => profile.active).map(profile => ({ kind: 'agent' as const, id: profile.id }))]);
  layersOf(item: WorkItem) { return item.scope === 'goal' ? this.summaries().get(item.id)?.layers || [] : [item.layer]; }
  needsOf(item: WorkItem) { return item.scope === 'goal' ? this.summaries().get(item.id)?.needs || 0 : item.status === 'needs' ? 1 : 0; }
  progressOf(item: WorkItem) {
    const counts = item.scope === 'goal' ? this.summaries().get(item.id)?.actions : null;
    if (!counts) return null;
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    return total ? { done: counts['done'] || 0, total } : null;
  }
  live(item: WorkItem) { return item.scope === 'goal' ? Boolean(this.summaries().get(item.id)?.actions['working']) : item.status === 'working'; }
  rough(item: WorkItem) { return item.scope === 'goal' && item.board === 'draft' && !this.summaries().get(item.id)?.defined; }
  whoLabel(who: Assignee) { return who.kind === 'person' ? `${this.ctx.whoName(who)}, local` : this.ctx.whoName(who); }
  startLine(who: Assignee) { return who.kind === 'person' && who.id === this.ctx.me() ? 'You work on it with your own agent.' : `${this.whoLabel(who)} starts on its actions.`; }
  label(board: string | undefined) { return columns.find(col => col[0] === board)?.[1] || ''; }

  private readonly shown = computed(() => {
    const layer = this.layer() || this.layerFilter(), who = this.ctx.boardFilter(), needs = this.needsOnly();
    return (this.ctx.data()?.work || []).filter(item => (!layer || this.layersOf(item).includes(layer) || (item.scope !== 'goal' && item.layer === layer))
      && (!who || (who === 'none' ? !item.assignee : item.assignee?.id === who)) && (!needs || this.needsOf(item) > 0));
  });
  readonly filtersOn = computed(() => this.needsOnly() || Boolean(this.layerFilter()) || Boolean(this.ctx.boardFilter()));
  readonly needsCount = computed(() => (this.ctx.data()?.work || []).filter(item => (!this.layer() || this.layersOf(item).includes(this.layer()!)) && this.needsOf(item) > 0).length);
  readonly byColumn = computed(() => {
    const out: Record<Column, WorkItem[]> = { draft: [], ready: [], progress: [], review: [], done: [] };
    for (const item of this.shown()) out[(item.board || 'draft') as Column]?.push(item);
    for (const key of ['draft', 'ready', 'progress', 'review'] as Column[]) out[key].sort(byPriority);
    out.done.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return out;
  });
  readonly peekItem = computed(() => { const id = this.peekId(); return id ? this.ctx.workById().get(id) || null : null; });

  peek(item: WorkItem) {
    if (this.peekId() === item.id) return this.closePeek();
    this.peekId.set(item.id); this.peekView.set(null);
    if (item.scope === 'goal') void this.loadPeek(item.id);
    setTimeout(() => document.getElementById('kb-peek-h')?.focus({ preventScroll: true }));
  }
  closePeek() {
    const ref = this.peekItem()?.ref; this.peekId.set(null); this.peekView.set(null);
    if (ref) setTimeout(() => (document.querySelector(`.lay-kb-card[data-ref="${ref}"] .lay-kb-title`) as HTMLElement | null)?.focus({ preventScroll: true }));
  }
  private async loadPeek(id: string) {
    try { const view = await this.ctx.api<GoalView>(`${this.base()}/${encodeURIComponent(id)}`); if (this.peekId() === id) this.peekView.set(view); } catch { /* The peek keeps its fields. */ }
  }
  readonly actionIcon: Record<string, string> = { todo: 'radio_button_unchecked', working: 'pending', review: 'rate_review', done: 'check_circle', proposed: 'add_circle' };
  actionState(action: GoalView['actions'][number]) { return action.needs.length ? 'Needs you' : { todo: action.blocked ? 'Waiting' : 'To do', working: 'Working', review: 'In review', done: 'Done', proposed: 'Proposed' }[action.state]; }

  // A move asks first where the board's rules call for it; everything else goes straight to the server, which has the final word.
  move(item: WorkItem, to: Column) {
    if (!item || item.board === to) return;
    if (to === 'ready' && item.board === 'draft' && !this.summaries().get(item.id)?.defined) return this.ask.set({ kind: 'define', item });
    if (to === 'progress' && item.board === 'ready') return this.ask.set({ kind: 'start', item });
    if (to === 'done') return this.ask.set({ kind: 'done', item });
    void this.ctx.write(() => this.ctx.api(`${this.base()}/${encodeURIComponent(item.id)}/move`, 'POST', { to }), `${item.ref} moved to ${this.label(to)}.`);
  }
  start(item: WorkItem, claim: boolean) {
    this.ask.set(null);
    void this.ctx.write(async () => {
      if (claim) await this.ctx.api(`${this.base()}/${encodeURIComponent(item.id)}/claim`, 'POST', {});
      await this.ctx.api(`${this.base()}/${encodeURIComponent(item.id)}/move`, 'POST', { to: 'progress' });
    }, `${item.ref} started.`);
  }
  dragStart(event: DragEvent, item: WorkItem) {
    if (item.scope !== 'goal') return event.preventDefault();
    this.dragging = item; event.dataTransfer?.setData('text/plain', item.ref); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  dragOver(event: DragEvent, col: Column) { if (!this.dragging) return; event.preventDefault(); this.over.set(col); }
  drop(event: DragEvent, col: Column) {
    event.preventDefault(); this.over.set(null);
    const item = this.dragging; this.dragging = null;
    if (item) this.move(item, col);
  }
}
