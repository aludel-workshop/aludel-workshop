import { Component, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectContext, WorkItem, layerLabel, priorityLabel, priorityOrder } from './context';
import { PriorityComponent } from './work-shared';

// AGENT-WORK-01 A3: a goal item, as the a0/v2 prototype drew it. The brief and how it is worked on top; actions in phases,
// each naming a layer, with what blocks it and what it needs from you sitting on it; review gates between phases; the
// changeset staged so far. The thread (and one action's details and log) sits beside it and updates live.
type GoalAuthor = { kind: 'person' | 'agent'; id: string; name: string };
export type GoalEvent = { id: number; action: number | null; kind: 'message' | 'log' | 'steer' | 'flag' | 'question' | 'allow' | 'approval'; author: GoalAuthor | null; text: string;
  options?: string[]; at: string; resolvedAt: string | null; resolution: { text?: string; allow?: boolean; note?: string; by?: { id: string; name: string } } | null };
export type GoalAction = { id: string; number: number; phase: number; layer: string | null; goal: string; after: number[]; state: 'proposed' | 'todo' | 'working' | 'review' | 'done';
  summary: string; addedBy: GoalAuthor | null; updatedAt: string; needs: GoalEvent[]; blocked: string | null };
type GoalChange = { id: string; kind: string; op: 'create' | 'update' | 'delete'; action?: number | null; after?: Record<string, unknown> | null; before?: Record<string, unknown> | null };
export type GoalCode = { branch: string; commit: string; base: string | null; files: { path: string; status: string }[]; at: string; inRepository?: boolean; merged?: 'verified' | 'confirmed' };
export type GoalView = { item: WorkItem & { board: string }; brief: string; defined: boolean; performer: string | null; code: GoalCode | null; phases: { number: number; title: string; gated: boolean }[];
  actions: GoalAction[]; needs: GoalEvent[]; events: GoalEvent[]; changeset: { layer: string; changes: GoalChange[] }[] };

const boardLabel: Record<string, string> = { draft: 'Draft', ready: 'Ready', progress: 'In progress', review: 'In review', done: 'Done' };
const actionLabel: Record<string, string> = { proposed: 'New: needs your approval', todo: 'To do', working: 'Working', review: 'Ready for review', done: 'Done' };
const actionIcon: Record<string, string> = { proposed: 'add_task', todo: 'radio_button_unchecked', working: 'progress_activity', review: 'rate_review', done: 'check_circle' };

@Component({
  selector: 'aludel-work-goal', standalone: true, imports: [FormsModule, MatIconModule, MatMenuModule, MatTooltipModule, PriorityComponent],
  styleUrl: './work-goal.css',
  template: `
  @if (view(); as goal) {
    <p class="lay-eyebrow"><a [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)">Work</a> › {{ goal.item.ref }}</p>
    <div class="wg-layout">
      <div class="wg-main">
        <section class="wg-card wg-head" aria-labelledby="wg-title">
          <div class="wg-titlerow"><h1 id="wg-title" tabindex="-1">{{ goal.item.title }}</h1>
            @if (goal.needs.length) { <span class="wg-needcount" role="status"><mat-icon aria-hidden="true">front_hand</mat-icon>{{ goal.needs.length }} need{{ goal.needs.length === 1 ? 's' : '' }} you</span> }</div>
          <dl class="wg-facts">
            <div><dt>Status</dt><dd><span [class]="'wg-board wg-board-' + goal.item.board">{{ boardLabel[goal.item.board] }}</span></dd></div>
            <div><dt>Priority</dt><dd><button type="button" class="lay-prio-btn" [matMenuTriggerFor]="priorityMenu" [attr.aria-label]="'Priority: ' + priorityLabel[goal.item.priority] + '. Change'"><aludel-priority [value]="goal.item.priority" [text]="true" /><mat-icon aria-hidden="true">expand_more</mat-icon></button>
              <mat-menu #priorityMenu="matMenu" class="lay-menu">@for (level of priorities; track level) { <button mat-menu-item type="button" (click)="priority(level)"><aludel-priority [value]="level" /><span>{{ priorityLabel[level] }}</span></button> }</mat-menu></dd></div>
            <div><dt>Assignee</dt><dd>@if (goal.item.assignee) { <mat-icon aria-hidden="true">{{ goal.performer === 'local' ? 'terminal' : 'smart_toy' }}</mat-icon>{{ ctx.whoName(goal.item.assignee) }}{{ goal.performer === 'local' ? ', locally' : '' }} } @else { <span class="lay-muted">Nobody yet</span> }</dd></div>
            @if (layers().length) { <div><dt>Layers</dt><dd class="wg-chips">@for (key of layers(); track key) { <span [class]="'lay-chip lay-l-' + key">{{ layerName(key) }}</span> }</dd></div> }
          </dl>
          <div class="wg-brief">
            <h2><mat-icon aria-hidden="true">notes</mat-icon>Brief @if (goal.defined) { <span class="wg-tag">Defined</span> }</h2>
            @if (editingBrief()) {
              <label class="visually-hidden" for="wg-brief-text">Brief</label>
              <textarea id="wg-brief-text" name="brief" rows="5" [(ngModel)]="briefDraft" placeholder="What should be true when this is done, and what is out of scope?"></textarea>
              <div class="wg-row"><button type="button" class="lay-button small" (click)="saveBrief()" [disabled]="!briefDraft.trim() || !goal.actions.length" [matTooltip]="goal.actions.length ? '' : 'Add an action first'">{{ goal.item.board === 'draft' ? 'Save and move to Ready' : 'Save brief' }}</button>
                @if (goal.brief) { <button type="button" class="lay-button ghost small" (click)="editingBrief.set(false)">Cancel</button> }</div>
            } @else {
              <p class="wg-brieftext">{{ goal.brief || 'No brief yet.' }}</p>
              @if (open()) { <button type="button" class="lay-button ghost small" (click)="editBrief()"><mat-icon aria-hidden="true">edit</mat-icon>Edit brief</button> }
            }
          </div>
          @if (goal.item.board === 'ready' || goal.item.board === 'draft') {
            <div class="wg-start">
              <div class="wg-style" role="group" aria-label="Work style">
                <span class="wg-label">Work style</span>
                <button type="button" class="wg-seg" disabled matTooltip="The remote runtime comes later (A2, waiting on the spending decision)">Send to Claude</button>
                <button type="button" class="wg-seg" [class.on]="mine()" [attr.aria-pressed]="mine()" (click)="claim()">{{ mine() ? 'Working locally' : 'Work locally' }}</button>
              </div>
              @if (mine()) { <p class="wg-hint"><mat-icon aria-hidden="true">terminal</mat-icon>In your checkout run <code>aludel claim {{ goal.item.ref }}</code>, then ask Claude Code there to work on {{ goal.item.ref }}.</p> }
              <button type="button" class="lay-button wg-go" (click)="move('progress')" [disabled]="goal.item.board !== 'ready' || !goal.item.assignee" [matTooltip]="startBlock()"><mat-icon aria-hidden="true">play_arrow</mat-icon>Start work</button>
            </div>
          }
          @if (goal.item.board === 'progress' && readyForReview()) {
            <div class="wg-start"><p class="wg-hint">Every action is ready for review.</p><button type="button" class="lay-button wg-go" (click)="move('review')"><mat-icon aria-hidden="true">rate_review</mat-icon>Move to review</button></div>
          }
          @if (goal.item.board === 'review') {
            <div class="wg-close" role="group" aria-labelledby="wg-close-title">
              <h2 id="wg-close-title"><mat-icon aria-hidden="true">task_alt</mat-icon>Ready to close out</h2>
              <p>Closing applies {{ recordCount() }} staged record change{{ recordCount() === 1 ? '' : 's' }}@if (goal.changeset.length) { in {{ changedLayers() }} } at once.@if (!goal.changeset.length && !goal.code) { Nothing is staged; it closes as done. }</p>
              @if (goal.code; as code) {
                @if (code.inRepository) { <p class="wg-hint"><mat-icon aria-hidden="true">check_circle</mat-icon>{{ code.branch }} at {{ code.commit.slice(0, 7) }} is in the project repository.</p> }
                @else { <label class="wg-confirm"><input type="checkbox" name="merged" [(ngModel)]="mergedConfirm">I've merged {{ code.branch }} at {{ code.commit.slice(0, 7) }} (a pull request or git merge)</label> }
              }
              <div class="wg-row wg-end"><button type="button" class="lay-button wg-go" (click)="close()" [disabled]="!!goal.code && !goal.code.inRepository && !mergedConfirm"><mat-icon aria-hidden="true">done_all</mat-icon>Close out</button></div>
            </div>
          }
          @if (goal.item.board === 'done') { <p class="wg-hint wg-closed"><mat-icon aria-hidden="true">task_alt</mat-icon>Closed. {{ closedText() }}</p> }
        </section>

        <section aria-labelledby="wg-actions">
          <div class="wg-sectionhead"><h2 id="wg-actions">Actions</h2><span class="lay-muted small">{{ counted().total }} subtask{{ counted().total === 1 ? '' : 's' }} · {{ counted().done }} done</span></div>
          @for (phase of phaseList(); track phase.number) {
            @if (phaseList().length > 1) { <h3 class="wg-phase"><span>Phase {{ phase.number }}</span>{{ phase.title }}</h3> }
            @for (action of actionsIn(phase.number); track action.id) {
              <article class="wg-card wg-action" [class.wg-attn]="action.needs.length || action.state === 'review' || action.state === 'proposed'" [class.wg-selected]="selected() === action.number" [attr.aria-labelledby]="'wg-a' + action.number">
                <div class="wg-actionhead">
                  <h4 [id]="'wg-a' + action.number"><span class="wg-num">#{{ action.number }}</span>{{ action.goal }}</h4>
                  <span [class]="'wg-state wg-state-' + (action.needs.length && action.state !== 'proposed' ? 'needs' : action.state)"><mat-icon aria-hidden="true">{{ action.needs.length && action.state !== 'proposed' ? 'front_hand' : actionIcon[action.state] }}</mat-icon>{{ action.needs.length && action.state !== 'proposed' ? 'Needs you' : actionLabel[action.state] }}</span>
                </div>
                <div class="wg-meta">
                  @if (action.layer) { <span [class]="'lay-chip lay-l-' + action.layer">{{ layerName(action.layer) }}</span> }
                  @if (action.after.length) { <span><mat-icon aria-hidden="true">subdirectory_arrow_right</mat-icon>After #{{ action.after.join(', #') }}</span> }
                  @if (action.addedBy) { <span><mat-icon aria-hidden="true">{{ action.addedBy.kind === 'agent' ? 'smart_toy' : 'person' }}</mat-icon>Added by {{ action.addedBy.kind === 'person' && action.addedBy.id === ctx.me() ? 'you' : action.addedBy.name }}</span> }
                </div>
                @if (action.summary) { <p class="wg-summary">{{ action.summary }}</p> }
                @if (action.blocked && goal.item.board === 'progress') { <p class="wg-blocked"><mat-icon aria-hidden="true">lock</mat-icon>{{ action.blocked }}</p> }
                @for (need of action.needs; track need.id) {
                  <div class="wg-need" role="group" [attr.aria-label]="needTitle(need)">
                    <p class="wg-needhead"><mat-icon aria-hidden="true">{{ need.kind === 'question' ? 'help' : need.kind === 'allow' ? 'front_hand' : 'add_task' }}</mat-icon><strong>{{ need.kind === 'approval' ? 'Approve this new action?' : need.text }}</strong></p>
                    <p class="wg-needby">From {{ need.author?.name || 'the agent' }}@if (need.kind === 'approval') { · {{ need.text }} }</p>
                    @if (need.kind === 'question') {
                      <form (ngSubmit)="answer(need)">
                        @if (need.options?.length) { <fieldset class="wg-options"><legend class="visually-hidden">Answer</legend>@for (option of need.options; track option) { <label class="wg-option"><input type="radio" [name]="'need-' + need.id" [value]="option" [(ngModel)]="answers[need.id]">{{ option }}</label> }</fieldset> }
                        <label class="visually-hidden" [for]="'need-text-' + need.id">{{ need.options?.length ? 'Or answer in your words' : 'Your answer' }}</label>
                        <input class="wg-input" [id]="'need-text-' + need.id" [name]="'need-text-' + need.id" [(ngModel)]="answerText[need.id]" [placeholder]="need.options?.length ? 'Or answer in your words…' : 'Your answer…'">
                        <div class="wg-row wg-end"><button type="submit" class="lay-button small" [disabled]="!(answerText[need.id] || '').trim() && !answers[need.id]"><mat-icon aria-hidden="true">send</mat-icon>Answer</button></div>
                      </form>
                    } @else {
                      <div class="wg-row wg-end"><button type="button" class="lay-button ghost small" (click)="allow(need, false)">Decline</button><button type="button" class="lay-button small" (click)="allow(need, true)">{{ need.kind === 'approval' ? 'Approve' : 'Allow' }}</button></div>
                    }
                  </div>
                }
                @if (editing() === action.number) {
                  <form class="wg-edit" (ngSubmit)="saveGoal(action)"><label [for]="'goal-' + action.number">Goal for #{{ action.number }}</label>
                    <textarea [id]="'goal-' + action.number" name="goal" rows="2" [(ngModel)]="goalDraft"></textarea>
                    <label [for]="'layer-' + action.number">Layer</label><select [id]="'layer-' + action.number" name="layer" [(ngModel)]="layerDraft"><option value="">No layer</option>@for (key of stack(); track key) { <option [value]="key">{{ layerName(key) }}</option> }</select>
                    <div class="wg-row"><button type="submit" class="lay-button small" [disabled]="!goalDraft.trim()">Save</button><button type="button" class="lay-button ghost small" (click)="editing.set(null)">Cancel</button></div></form>
                }
                <div class="wg-tools">
                  <button type="button" class="wg-link" (click)="select(action.number)" [attr.aria-pressed]="selected() === action.number"><mat-icon aria-hidden="true">forum</mat-icon>Details and log</button>
                  @if (open() && action.state !== 'done') { <button type="button" class="wg-link" (click)="editGoal(action)"><mat-icon aria-hidden="true">edit</mat-icon>Edit goal</button> }
                </div>
                @if (action.state === 'review') {
                  <div class="wg-review" role="group" [attr.aria-label]="'Review #' + action.number">
                    <p class="wg-needhead"><mat-icon aria-hidden="true">rate_review</mat-icon><strong>Ready for your review</strong></p>
                    @if (changesOf(action.number).length) { <ul class="wg-reviewlist">@for (change of changesOf(action.number); track change.id) { <li><span [class]="'wg-op wg-op-' + change.op">{{ opLabel[change.op] }}</span>{{ kindName(change.kind) }} <strong>{{ changeName(change) }}</strong>@if (change.layer) { <span [class]="'lay-chip lay-l-' + change.layer">{{ layerName(change.layer) }}</span> }</li> }</ul> }
                    @else if (goal.code && action.layer === 'platform') { <p class="small">Its code is on <code>{{ goal.code.branch }}</code> ({{ goal.code.files.length }} files), listed under Changes.</p> }
                    @else { <p class="small lay-muted">No staged record changes; read its summary and log.</p> }
                    @if (flagging() === action.number) {
                      <form (ngSubmit)="flag(action)"><label class="wg-flaglabel" [for]="'flag-' + action.number">What should change?</label>
                        <textarea class="wg-input" [id]="'flag-' + action.number" name="flagNote" rows="2" [(ngModel)]="flagDraft" placeholder="Say what you want different"></textarea>
                        <div class="wg-row wg-end"><button type="button" class="lay-button ghost small" (click)="flagging.set(null)">Cancel</button><button type="submit" class="lay-button small" [disabled]="!flagDraft.trim()">Send to the agent</button></div></form>
                    } @else {
                      <div class="wg-row wg-end"><button type="button" class="lay-button ghost small" (click)="startFlag(action.number)"><mat-icon aria-hidden="true">flag</mat-icon>Flag</button><button type="button" class="lay-button small" (click)="approve(action)"><mat-icon aria-hidden="true">check</mat-icon>Approve</button></div>
                    }
                  </div>
                }
              </article>
            }
            @if (open()) {
              @if (adding() === phase.number) {
                <form class="wg-card wg-edit" (ngSubmit)="add(phase.number)"><label [for]="'add-' + phase.number">New action{{ phaseList().length > 1 ? ' in ' + phase.title : '' }}</label>
                  <textarea [id]="'add-' + phase.number" name="newGoal" rows="2" [(ngModel)]="goalDraft" placeholder="What should this action achieve?"></textarea>
                  <label [for]="'add-layer-' + phase.number">Layer</label><select [id]="'add-layer-' + phase.number" name="newLayer" [(ngModel)]="layerDraft"><option value="">No layer</option>@for (key of stack(); track key) { <option [value]="key">{{ layerName(key) }}</option> }</select>
                  <div class="wg-row"><button type="submit" class="lay-button small" [disabled]="!goalDraft.trim()">Add</button><button type="button" class="lay-button ghost small" (click)="adding.set(null)">Cancel</button></div></form>
              } @else { <button type="button" class="wg-link wg-add" (click)="startAdd(phase.number)"><mat-icon aria-hidden="true">add</mat-icon>Add action</button> }
            }
            @if (gate(phase.number); as text) { <p class="wg-gate" [class.wg-gate-open]="text.open"><mat-icon aria-hidden="true">{{ text.open ? 'lock_open' : 'lock' }}</mat-icon>{{ text.text }}</p> }
          }
        </section>

        @if (goal.changeset.length || goal.code) {
          <section aria-labelledby="wg-changes"><div class="wg-sectionhead"><h2 id="wg-changes">{{ goal.item.board === 'done' ? 'Changes' : 'Changes staged' }}</h2><span class="lay-muted small">{{ goal.item.board === 'done' ? 'Applied at close-out' : 'Nothing applies until close-out' }}</span></div>
            @if (goal.code; as code) {
              <div class="wg-card wg-changes"><h3><span class="lay-chip lay-l-platform">Code</span>{{ code.files.length }} file{{ code.files.length === 1 ? '' : 's' }} on <code>{{ code.branch }}</code> at <code>{{ code.commit.slice(0, 7) }}</code></h3>
                <ul>@for (file of code.files.slice(0, 40); track file.path) { <li><span [class]="'wg-op wg-op-' + fileOp(file.status)">{{ fileLabel[file.status] || 'Changed' }}</span><span class="wg-path">{{ file.path }}</span></li> }
                  @if (code.files.length > 40) { <li class="lay-muted small">and {{ code.files.length - 40 }} more</li> }</ul></div>
            }
            @for (group of goal.changeset; track group.layer) {
              <div class="wg-card wg-changes"><h3><span [class]="'lay-chip lay-l-' + group.layer">{{ layerName(group.layer) }}</span>{{ group.changes.length }} change{{ group.changes.length === 1 ? '' : 's' }}</h3>
                <ul>@for (change of group.changes; track change.id) { <li><span [class]="'wg-op wg-op-' + change.op">{{ opLabel[change.op] }}</span>{{ kindName(change.kind) }} <strong>{{ changeName(change) }}</strong></li> }</ul></div>
            }
          </section>
        }
      </div>

      <aside class="wg-card wg-side" aria-labelledby="wg-thread">
        <header><h2 id="wg-thread"><i [class]="'wg-live' + (live() ? ' on' : '')" [attr.aria-label]="live() ? 'Live' : 'Not live'" role="img"></i>{{ selectedAction() ? '#' + selectedAction()!.number + ' details and log' : 'Thread' }}</h2>
          @if (selectedAction(); as action) { <button type="button" class="wg-link" (click)="select(null)"><mat-icon aria-hidden="true">arrow_back</mat-icon>All activity</button> }
          @else { <p class="small lay-muted">Everything said and done on this item, by you and the agent working it.</p> }</header>
        @if (selectedAction(); as action) { <p class="wg-sidegoal">{{ action.goal }}</p> }
        <ol #events class="wg-events" aria-live="polite" (scroll)="following = atEnd($any($event.target))">
          @for (event of shownEvents(); track event.id) {
            <li [class]="'wg-ev wg-ev-' + event.kind" [class.wg-ev-open]="!event.resolvedAt && ['question', 'allow', 'approval'].includes(event.kind)">
              <span class="wg-who">{{ authorName(event) }}@if (event.action && !selectedAction()) { <button type="button" class="wg-chiplink" (click)="select(event.action)">#{{ event.action }}</button> }<time [attr.datetime]="event.at">{{ when(event.at) }}</time></span>
              <p>{{ eventText(event) }}</p>
              @if (event.resolution) { <p class="wg-resolved"><mat-icon aria-hidden="true">check</mat-icon>{{ resolutionText(event) }}</p> }
            </li>
          } @empty { <li class="lay-muted small">Nothing yet.</li> }
        </ol>
        <form class="wg-steer" (ngSubmit)="steer()"><label class="visually-hidden" for="wg-steer">{{ selectedAction() ? 'Write about #' + selectedAction()!.number : 'Steer: ask, add or change actions' }}</label>
          <textarea id="wg-steer" name="steer" rows="2" [(ngModel)]="steerDraft" [placeholder]="selectedAction() ? 'Write about #' + selectedAction()!.number + '…' : 'Steer: ask, add or change actions…'" (keydown.control.enter)="steer()" (keydown.meta.enter)="steer()"></textarea>
          <button type="submit" class="wg-send" [disabled]="!steerDraft.trim()" aria-label="Send"><mat-icon aria-hidden="true">send</mat-icon></button></form>
      </aside>
    </div>
  } @else if (failed()) { <h1 tabindex="-1">Work item not found</h1><p><a [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)">Back to the board</a></p> }
  @else { <p class="lay-muted" role="status">Loading…</p> }`
})
export class WorkGoalComponent {
  readonly ctx = inject(ProjectContext);
  readonly id = input.required<string>();
  readonly boardLabel = boardLabel; readonly actionLabel = actionLabel; readonly actionIcon = actionIcon;
  readonly priorityLabel = priorityLabel; readonly priorities = priorityOrder;
  readonly opLabel: Record<string, string> = { create: 'New', update: 'Changed', delete: 'Removed' };
  readonly fileLabel: Record<string, string> = { added: 'New', modified: 'Changed', deleted: 'Removed', renamed: 'Moved' };
  fileOp(status: string) { return status === 'added' ? 'create' : status === 'deleted' ? 'delete' : 'update'; }
  readonly view = signal<GoalView | null>(null);
  readonly failed = signal(false);
  readonly live = signal(false);
  readonly selected = signal<number | null>(null);
  readonly editing = signal<number | null>(null);
  readonly adding = signal<number | null>(null);
  readonly editingBrief = signal(false);
  readonly flagging = signal<number | null>(null);
  flagDraft = ''; mergedConfirm = false;
  readonly stackKeys = signal<string[]>([]);
  briefDraft = ''; goalDraft = ''; layerDraft = ''; steerDraft = '';
  answers: Record<number, string> = {}; answerText: Record<number, string> = {};
  private source: EventSource | null = null;
  private pending: ReturnType<typeof setTimeout> | null = null;

  readonly open = computed(() => ['draft', 'ready', 'progress'].includes(this.view()?.item.board || ''));
  readonly mine = computed(() => { const item = this.view()?.item; return item?.assignee?.kind === 'person' && item.assignee.id === this.ctx.me(); });
  readonly layers = computed(() => [...new Set((this.view()?.actions || []).map(action => action.layer).filter((key): key is string => Boolean(key)))]);
  readonly stack = computed(() => this.stackKeys().length ? this.stackKeys() : this.ctx.layerInstances().filter(entry => entry.enabled).map(entry => entry.key));
  readonly phaseList = computed(() => { const view = this.view(); return view?.phases.length ? view.phases : [{ number: 1, title: 'Work', gated: false }]; });
  readonly counted = computed(() => { const actions = (this.view()?.actions || []).filter(action => action.state !== 'proposed'); return { total: actions.length, done: actions.filter(action => action.state === 'done').length }; });
  readonly readyForReview = computed(() => { const view = this.view(); const actions = (view?.actions || []).filter(action => action.state !== 'proposed');
    return Boolean(view && actions.length && !view.needs.length && actions.every(action => ['review', 'done'].includes(action.state))); });
  readonly startBlock = computed(() => { const item = this.view()?.item; if (!item) return '';
    if (item.board === 'draft') return 'Write the brief and its actions, then save it to Ready'; if (!item.assignee) return 'Choose a work style first'; return ''; });
  readonly recordCount = computed(() => (this.view()?.changeset || []).reduce((sum, group) => sum + group.changes.length, 0));
  readonly changedLayers = computed(() => (this.view()?.changeset || []).map(group => this.layerName(group.layer)).join(' and '));
  readonly closedText = computed(() => [...(this.view()?.events || [])].reverse().find(event => event.kind === 'log' && event.text.startsWith('Closed:'))?.text.replace(/^Closed: (.)/, (_, first: string) => first.toUpperCase()) || '');
  readonly selectedAction = computed(() => this.view()?.actions.find(action => action.number === this.selected()) || null);
  readonly shownEvents = computed(() => { const events = this.view()?.events || []; const number = this.selected(); return number === null ? events : events.filter(event => event.action === number); });

  // The thread follows its newest entry, unless the person has scrolled up to read.
  private readonly eventList = viewChild<ElementRef<HTMLElement>>('events');
  following = true;
  atEnd(list: HTMLElement) { return list.scrollHeight - list.scrollTop - list.clientHeight < 40; }

  constructor() {
    afterRenderEffect(() => { this.shownEvents(); const list = this.eventList()?.nativeElement; if (list && this.following) list.scrollTop = list.scrollHeight; });
    effect(() => { const id = this.id(); const project = this.ctx.projectId(); if (!id || !project) return; untracked(() => { this.view.set(null); this.failed.set(false); this.selected.set(null); this.following = true; void this.load(); this.listen(); }); });
    inject(DestroyRef).onDestroy(() => { this.source?.close(); if (this.pending) clearTimeout(this.pending); });
  }
  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/goals`; }
  private path(rest = '') { return `${this.base()}/${encodeURIComponent(this.id())}${rest}`; }
  async load() {
    try { const view = await this.ctx.api<GoalView>(this.path()); this.view.set(view); if (!view.brief && !this.editingBrief() && ['draft', 'ready'].includes(view.item.board)) this.editBrief(); }
    catch { if (!this.view()) this.failed.set(true); }
    if (!this.stackKeys().length) void this.ctx.api<{ stack: { key: string }[] }>(this.base()).then(value => this.stackKeys.set(value.stack.map(layer => layer.key)), () => {});
  }
  // The stream carries small notices; each burst refetches the item once.
  private listen() {
    this.source?.close(); this.live.set(false);
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource(this.path('/stream'));
    source.addEventListener('ready', () => this.live.set(true));
    source.addEventListener('change', () => { if (this.pending) clearTimeout(this.pending); this.pending = setTimeout(() => { this.pending = null; void this.load(); }, 150); });
    source.onerror = () => this.live.set(false);
    this.source = source;
  }
  // Writes go through the shell's write, so errors show where every other write's do; the board's snapshot reloads too.
  private act(run: () => Promise<GoalView | unknown>, success = '') {
    return this.ctx.write(async () => { const result = await run(); if (result && typeof result === 'object' && 'item' in result && 'actions' in result) this.view.set(result as GoalView); else await this.load(); }, success);
  }
  layerName(key: string) { return this.ctx.layerInstances().find(entry => entry.key === key)?.name || layerLabel[key] || key; }
  changesOf(number: number) { return (this.view()?.changeset || []).flatMap(group => group.changes.filter(change => change.action === number).map(change => ({ ...change, layer: group.layer }))); }
  startFlag(number: number) { this.flagDraft = ''; this.flagging.set(number); setTimeout(() => document.getElementById(`flag-${number}`)?.focus()); }
  approve(action: GoalAction) { void this.act(() => this.ctx.api(this.path(`/review/${action.number}`), 'POST', { verdict: 'approve' }), `Approved #${action.number}.`); }
  flag(action: GoalAction) { const note = this.flagDraft.trim(); if (!note) return;
    void this.act(() => this.ctx.api(this.path(`/review/${action.number}`), 'POST', { verdict: 'flag', note }), `Flagged #${action.number}; it's back with the agent.`).then(ok => { if (ok) this.flagging.set(null); }); }
  close() { void this.act(() => this.ctx.api(this.path('/close'), 'POST', { codeMerged: this.mergedConfirm }), 'Closed.'); }
  actionsIn(phase: number) { return (this.view()?.actions || []).filter(action => action.phase === phase); }
  gate(phase: number) {
    const view = this.view(); const entry = view?.phases.find(item => item.number === phase);
    if (!view || !entry?.gated || phase >= view.phases.length) return null;
    const held = view.actions.filter(action => action.phase <= phase && action.state !== 'proposed');
    const open = held.every(action => action.state === 'done');
    if (open) return { open, text: `Review gate cleared: phase ${phase + 1} can start.` };
    const ready = held.filter(action => action.state === 'review').map(action => '#' + action.number);
    return { open, text: `Review gate: phase ${phase + 1} starts once you've reviewed ${held.map(action => '#' + action.number).join(' and ')}.${ready.length ? ` ${ready.join(' and ')} ${ready.length === 1 ? 'is' : 'are'} ready.` : ''}` };
  }
  needTitle(need: GoalEvent) { return need.kind === 'question' ? 'Question' : need.kind === 'allow' ? 'Allow request' : 'New action'; }
  authorName(event: GoalEvent) { const author = event.author; if (!author) return 'Aludel'; return author.kind === 'person' && author.id === this.ctx.me() ? 'You' : author.name; }
  eventText(event: GoalEvent) { const goal = this.view()?.actions.find(action => action.number === event.action)?.goal;
    return event.kind === 'approval' ? `Proposed #${event.action}${goal ? ` (${goal})` : ''}: ${event.text}` : event.kind === 'steer' ? `Steer: ${event.text}` : event.kind === 'flag' ? `Flagged #${event.action}: ${event.text}` : event.text; }
  resolutionText(event: GoalEvent) { const by = event.resolution?.by?.name || 'Someone'; const value = event.resolution;
    if (!value) return ''; if (value.text) return `${by}: ${value.text}`; return `${by} ${value.allow ? (event.kind === 'approval' ? 'approved' : 'allowed') : 'declined'} it${value.note ? `: ${value.note}` : ''}`; }
  kindName(kind: string) { return kind.replace(/_/g, ' '); }
  changeName(change: GoalChange) { const data = (change.after || change.before || {}) as Record<string, unknown>; return String(data['name'] || data['title'] || data['text'] || data['label'] || change.id).slice(0, 80); }
  when(at: string) { const date = new Date(at); return date.toDateString() === new Date().toDateString() ? date.toTimeString().slice(0, 5) : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${date.toTimeString().slice(0, 5)}`; }

  select(number: number | null) { this.following = true; this.selected.set(this.selected() === number ? null : number); }
  editBrief() { this.briefDraft = this.view()?.brief || ''; this.editingBrief.set(true); }
  saveBrief() {
    const view = this.view(); if (!view) return;
    const actions = view.actions.filter(action => action.state !== 'proposed').map(action => ({ phase: action.phase, layer: action.layer, goal: action.goal, after: action.after }));
    void this.act(() => this.ctx.api(this.path('/define'), 'POST', { brief: this.briefDraft.trim(), phases: view.phases.map(phase => ({ title: phase.title, gated: phase.gated })), actions }),
      view.item.board === 'draft' ? `${view.item.ref} is Ready.` : 'Brief saved.').then(ok => { if (ok) this.editingBrief.set(false); });
  }
  editGoal(action: GoalAction) { this.goalDraft = action.goal; this.layerDraft = action.layer || ''; this.adding.set(null); this.editing.set(action.number); }
  saveGoal(action: GoalAction) { void this.act(() => this.ctx.api(this.path(`/actions/${action.number}`), 'PATCH', { goal: this.goalDraft.trim(), layer: this.layerDraft || null }), `Updated #${action.number}.`).then(ok => { if (ok) this.editing.set(null); }); }
  startAdd(phase: number) { this.goalDraft = ''; this.layerDraft = ''; this.editing.set(null); this.adding.set(phase); setTimeout(() => document.getElementById(`add-${phase}`)?.focus()); }
  add(phase: number) { void this.act(() => this.ctx.api(this.path('/actions'), 'POST', { phase, goal: this.goalDraft.trim(), layer: this.layerDraft || null }), 'Action added.').then(ok => { if (ok) this.adding.set(null); }); }
  answer(need: GoalEvent) { const text = (this.answerText[need.id] || '').trim() || this.answers[need.id]; if (!text) return;
    void this.act(() => this.ctx.api(this.path(`/answer/${need.id}`), 'POST', { text }), 'Answered.'); }
  allow(need: GoalEvent, allow: boolean) { void this.act(() => this.ctx.api(this.path(`/answer/${need.id}`), 'POST', { allow }), allow ? (need.kind === 'approval' ? `Approved #${need.action}.` : 'Allowed.') : 'Declined.'); }
  claim() { if (!this.mine()) void this.act(() => this.ctx.api(this.path('/claim'), 'POST', {}), 'Claimed to work locally.'); }
  move(to: string) { void this.act(() => this.ctx.api(this.path('/move'), 'POST', { to }), to === 'progress' ? 'Started.' : 'Moved to review.'); }
  priority(level: string) { void this.ctx.write(() => this.ctx.updateWork(this.id(), { priority: level }), `Now ${priorityLabel[level]} priority.`).then(() => this.load()); }
  steer() {
    const text = this.steerDraft.trim(); if (!text) return;
    const number = this.selected();
    void this.act(() => this.ctx.api(this.path('/events'), 'POST', number === null ? { kind: 'steer', text } : { kind: 'message', text, action: number })).then(ok => { if (ok) this.steerDraft = ''; });
  }
}
