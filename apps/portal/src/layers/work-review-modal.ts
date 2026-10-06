import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext, layerLabel } from './context';
import type { GoalAction, GoalStep, GoalView } from './work-goal';
import { CodeRow, DiffRow, FileEntry, TreeNode, fileTree, fold, recordDiff, unifiedRows } from './review-diff';

// W-27 (A7, DEC-070): one review modal for every action in review, as the a0/v2 prototype drew it and Pages' "Action review"
// page specs it. The preview matches what the action changed: Records (any layer) shows each staged record Previous beside
// Proposed; Files shows the code it reported; Live build (W-27 #6) frames the build the agent's container runs, through its
// tunnel. The side panel carries the checklist (walked in the live build, as J6 does), the summary, the preview and the decision.
type Change = { id: string; kind: string; op: 'create' | 'update' | 'delete'; layer: string; baseRevision?: number | null; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null };
type ViewKey = 'live' | 'records' | 'files';
type Walk = { aludelWalk: 1; kind: 'page' | 'action'; path: string; method?: string; page?: string };
const routeOf = (path: string | null | undefined) => (path || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
export type ReviewDecision = { verdict: 'approve' } | { verdict: 'flag'; note: string };

export const opLabel: Record<string, string> = { create: 'New', update: 'Changed', delete: 'Removed' };
export const fileLabel: Record<string, string> = { added: 'New', modified: 'Changed', deleted: 'Removed', renamed: 'Moved' };
export const fileOp = (status: string) => status === 'added' ? 'create' : status === 'deleted' ? 'delete' : 'update';
export const kindName = (kind: string) => kind.replace(/_/g, ' ');
export function changeName(change: { id: string; after?: Record<string, unknown> | null; before?: Record<string, unknown> | null }) {
  const data = (change.after || change.before || {}) as Record<string, unknown>;
  return String(data['name'] || data['title'] || data['text'] || data['label'] || change.id).slice(0, 80);
}

// What an action changed, in one line for its card: "2 records in Pages", "12 files", "a preview to open".
export function changedLine(view: GoalView, action: GoalAction, layerName: (key: string) => string) {
  const records = view.changeset.flatMap(group => group.changes.filter(change => change.action === action.number).map(() => group.layer));
  const parts: string[] = [];
  if (records.length) { const layers = [...new Set(records)]; parts.push(`${records.length} record${records.length === 1 ? '' : 's'} in ${layers.map(layerName).join(' and ')}`); }
  if (codeOf(view, action)) { const count = codeCount(view); parts.push(`${count} file${count === 1 ? '' : 's'}`); }
  const steps = action.preview?.steps?.length || 0;
  if (action.tunnel) parts.push('live build'); else if (action.preview?.url) parts.push('a preview to open');
  if (steps) parts.push(`${steps} step${steps === 1 ? '' : 's'} to try`);
  return parts.join(' · ') || 'Nothing staged; read its summary';
}
// The item's reported code belongs to its Code actions (the code is the item's, so every Code action reviews the same files).
const codeOf = (view: GoalView, action: GoalAction) => Boolean(view.code && action.layer === 'platform');
// W-33: every file the item's code changed, in the project's own repository and in the others it reported.
const codeCount = (view: GoalView) => (view.code?.files.length || 0) + (view.code?.repositories || []).reduce((sum, entry) => sum + entry.files.length, 0);
// One repository's listing in Files: the project's own, or another one's branch for a line.
type FileSource = { repository: string | null; line: string | null; other: boolean; branch: string; commit: string; files: FileEntry[] };
type ShownFile = FileEntry & { real: string; source: FileSource };

const firstFile = (nodes: TreeNode[]): FileEntry | null => { for (const node of nodes) { const found = node.file || firstFile(node.children); if (found) return found; } return null; };

@Component({
  selector: 'aludel-work-review-modal', standalone: true, imports: [FormsModule, MatIconModule, NgTemplateOutlet],
  styleUrl: './work-review-modal.css',
  template: `
  <dialog #dialog class="rm" [attr.aria-labelledby]="'rm-title'" (close)="closed.emit()">
    <header class="rm-head">
      <button type="button" class="rm-close" (click)="dialog.close()"><mat-icon aria-hidden="true">close</mat-icon>Close</button>
      <h2 id="rm-title">Review #{{ action().number }} · {{ action().goal }}</h2>
      @if (action().layer; as key) { <span [class]="'lay-chip lay-l-' + key">{{ layerName(key) }}</span> }
      @if (views().length > 1) {
        <div class="rm-tabs" role="tablist" aria-label="What it changed">
          @for (entry of views(); track entry.key) {
            <button type="button" role="tab" [id]="'rm-tab-' + entry.key" [attr.aria-selected]="current() === entry.key" [attr.aria-controls]="'rm-pane'" [tabindex]="current() === entry.key ? 0 : -1"
              (click)="choose(entry.key)" (keydown.arrowRight)="step(1)" (keydown.arrowLeft)="step(-1)">{{ entry.label }}<span class="rm-count">{{ entry.count }}</span></button>
          }
        </div>
      }
      @if (action().tunnel) { <button type="button" class="lay-button ghost small rm-newtab" (click)="openTab()"><mat-icon aria-hidden="true">open_in_new</mat-icon>Open in a new tab</button> }
      @else if (action().preview?.url; as url) { <a class="lay-button ghost small rm-newtab" [href]="url" target="_blank" rel="noopener noreferrer"><mat-icon aria-hidden="true">open_in_new</mat-icon>Open in a new tab</a> }
    </header>
    <div class="rm-body">
      <section class="rm-main" id="rm-pane" [attr.role]="views().length > 1 ? 'tabpanel' : null" [attr.aria-labelledby]="views().length > 1 ? 'rm-tab-' + current() : 'rm-title'">
        @switch (current()) {
          @case ('live') {
            <div class="rm-live">
              <div class="rm-addr"><span class="rm-build"><mat-icon aria-hidden="true">deployed_code</mat-icon>Preview build of {{ view().item.ref }}</span>
                <span class="rm-url" aria-label="Page showing">{{ livePath() }}</span>
                <button type="button" class="lay-button ghost small" (click)="openLive()"><mat-icon aria-hidden="true">refresh</mat-icon>Reload</button></div>
              @switch (live().state) {
                @case ('ready') { <iframe #frame class="rm-frame" [src]="live().src!" [title]="'Live build for #' + action().number" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals"></iframe> }
                @case ('down') { <div class="rm-problem rm-livedown" role="alert"><p>{{ live().error }}</p><button type="button" class="lay-button small" (click)="openLive()">Try again</button></div> }
                @default { <p class="rm-note rm-reading" role="status">Starting the preview…</p> }
              }
            </div>
          }
          @case ('records') {
            <div class="rm-records">
              <nav class="rm-list" aria-label="Records it staged">
                @for (group of grouped(); track group.layer) {
                  <h3><span [class]="'lay-chip lay-l-' + group.layer">{{ layerName(group.layer) }}</span></h3>
                  <ul>@for (change of group.changes; track change.id) {
                    <li><button type="button" [attr.aria-current]="picked()?.id === change.id ? 'true' : null" (click)="pick(change.id)">
                      <span [class]="'rm-op rm-op-' + change.op">{{ opLabel[change.op] }}</span><span class="rm-kind">{{ kindName(change.kind) }}</span><span class="rm-name">{{ changeName(change) }}</span></button></li>
                  }</ul>
                }
              </nav>
              @if (picked(); as change) {
                <div class="rm-compare" aria-live="polite">
                  <div class="rm-comparehead">
                    <h3><span [class]="'rm-op rm-op-' + change.op">{{ opLabel[change.op] }}</span>{{ kindName(change.kind) }} <strong>{{ changeName(change) }}</strong></h3>
                    @if (change.op === 'update') {
                      <label class="rm-toggle"><input type="checkbox" [ngModel]="showSame()" (ngModelChange)="showSame.set($event)">Show unchanged fields</label>
                    }
                  </div>
                  <div class="rm-cols" aria-hidden="true"><span>Previous{{ change.baseRevision ? ' · r' + change.baseRevision : '' }}</span><span>Proposed</span></div>
                  @for (field of fields(); track field.key) {
                    <section class="rm-field" [class.rm-changed]="field.changed" [attr.aria-label]="field.label + (field.changed ? ', changed' : '')">
                      <h4>{{ field.label }}@if (field.changed && change.op === 'update') { <span class="rm-mark">Changed</span> }</h4>
                      <div class="rm-rows">
                        @for (row of rowsOf(field.key, field.rows); track $index) {
                          @if (row.kind === 'gap') {
                            <button type="button" class="rm-gap" (click)="unfold(field.key)">{{ row.hidden }} unchanged line{{ row.hidden === 1 ? '' : 's' }}: show</button>
                          } @else {
                            <div [class]="'rm-row rm-' + row.kind">
                              <span class="rm-prev">@if (row.previous !== null) { @if (row.kind !== 'same') { <span class="visually-hidden">Previous: </span> }{{ row.previous }} }</span>
                              <span class="rm-next">@if (row.proposed !== null) { @if (row.kind !== 'same') { <span class="visually-hidden">Proposed: </span> }{{ row.proposed }} }</span>
                            </div>
                          }
                        }
                      </div>
                    </section>
                  } @empty { <p class="lay-muted">No fields differ.</p> }
                  @if (change.op === 'create') { <p class="rm-note"><mat-icon aria-hidden="true">add</mat-icon>New: there was nothing before.</p> }
                  @if (change.op === 'delete') { <p class="rm-note"><mat-icon aria-hidden="true">delete</mat-icon>Removed when the item closes.</p> }
                </div>
              }
            </div>
          }
          @case ('files') {
            <div class="rm-files">
              @switch (listing().state) {
                @case ('ready') {
                  <nav class="rm-tree" aria-label="Files it changed">
                    @if (listing().data!.sources.length > 1) {
                      <p class="rm-treehead">{{ listing().data!.files.length }} file{{ listing().data!.files.length === 1 ? '' : 's' }} in {{ listing().data!.sources.length }} repositories</p>
                      <ul class="rm-sources">@for (source of listing().data!.sources; track $index) { <li><strong>{{ sourceLabel(source) }}</strong>: <code>{{ source.branch }}</code> at <code>{{ source.commit.slice(0, 7) }}</code></li> }</ul>
                    } @else {
                      <p class="rm-treehead">{{ listing().data!.files.length }} file{{ listing().data!.files.length === 1 ? '' : 's' }} on <code>{{ listing().data!.branch }}</code> at <code>{{ listing().data!.commit.slice(0, 7) }}</code></p>
                    }
                    <ng-container *ngTemplateOutlet="treeLevel; context: { $implicit: tree() }" />
                  </nav>
                  <section class="rm-diff" [attr.aria-label]="pickedPath() ? 'Changes to ' + pickedPath() : 'Changes'">
                    @if (diffState(); as d) {
                      <header class="rm-diffhead">
                        <h3><span [class]="'rm-op rm-op-' + fileOp(d.file.status)">{{ fileLabel[d.file.status] || 'Changed' }}</span><span class="rm-path">{{ d.file.path }}</span>
                          @if (!d.file.binary) { <span class="rm-counts"><span class="rm-plus">+{{ d.file.added }}</span> <span class="rm-minus">−{{ d.file.removed }}</span></span> }</h3>
                        @if (d.file.from) { <p class="rm-moved">Moved from <span class="rm-path">{{ d.file.from }}</span></p> }
                      </header>
                      @switch (d.state) {
                        @case ('loading') { <p class="rm-note" role="status">Reading the diff…</p> }
                        @case ('error') { <div class="rm-problem" role="alert"><p>{{ d.error }}</p><button type="button" class="lay-button small" (click)="loadDiff(d.file.path, true)">Retry</button></div> }
                        @default {
                          @if (d.file.binary) { <p class="rm-note"><mat-icon aria-hidden="true">image</mat-icon>A binary file: there are no lines to compare.</p> }
                          @else if (d.tooLarge) { <p class="rm-note"><mat-icon aria-hidden="true">description</mat-icon>Too large to show here. Read it on <code>{{ $any(d.file).source?.branch || listing().data!.branch }}</code>.</p> }
                          @else if (!d.rows.length) { <p class="rm-note"><mat-icon aria-hidden="true">description</mat-icon>{{ d.file.status === 'renamed' ? 'Moved, with no line changes.' : 'No line changes.' }}</p> }
                          @else {
                            <div class="rm-cols rm-codecols" aria-hidden="true"><span>Before</span><span>After</span></div>
                            <div class="rm-code">
                              @for (row of d.rows; track $index) {
                                @if (row.kind === 'gap') { <div class="rm-hunk">{{ row.hunk }}</div> }
                                @else {
                                  <div [class]="'rm-crow rm-' + row.kind">
                                    <span class="rm-no" aria-hidden="true">{{ row.oldNo }}</span>
                                    <span class="rm-prev">@if (row.previous !== null) { @if (row.kind !== 'same') { <span class="visually-hidden">Removed line {{ row.oldNo }}: </span> }{{ row.previous }} }</span>
                                    <span class="rm-no" aria-hidden="true">{{ row.newNo }}</span>
                                    <span class="rm-next">@if (row.proposed !== null) { @if (row.kind !== 'same') { <span class="visually-hidden">Added line {{ row.newNo }}: </span> }{{ row.proposed }} }</span>
                                  </div>
                                }
                              }
                            </div>
                          }
                        }
                      }
                    }
                  </section>
                }
                @case ('error') {
                  <div class="rm-unread">
                  <div class="rm-problem" role="alert"><p>{{ listing().error }}</p><button type="button" class="lay-button small" (click)="loadFiles()">Retry</button></div>
                  @if (view().code; as code) {
                    <p class="rm-reported">What the agent reported: {{ code.files.length }} file{{ code.files.length === 1 ? '' : 's' }} on <code>{{ code.branch }}</code> at <code>{{ code.commit.slice(0, 7) }}</code></p>
                    <ul class="rm-plain">@for (file of code.files; track file.path) { <li><span [class]="'rm-op rm-op-' + fileOp(file.status)">{{ fileLabel[file.status] || 'Changed' }}</span><span class="rm-path">{{ file.path }}</span></li> }</ul>
                    @for (other of code.repositories || []; track other.repository + other.line) {
                      <p class="rm-reported">And in {{ other.repository }}: {{ other.files.length }} file{{ other.files.length === 1 ? '' : 's' }} on <code>{{ other.branch }}</code> at <code>{{ other.commit.slice(0, 7) }}</code></p>
                      <ul class="rm-plain">@for (file of other.files; track file.path) { <li><span [class]="'rm-op rm-op-' + fileOp(file.status)">{{ fileLabel[file.status] || 'Changed' }}</span><span class="rm-path">{{ file.path }}</span></li> }</ul>
                    }
                  }
                  </div>
                }
                @default { <p class="rm-note rm-reading" role="status">Reading the code…</p> }
              }
            </div>
          }
          @default {
            <div class="rm-empty"><mat-icon aria-hidden="true">inventory_2</mat-icon><p>#{{ action().number }} staged no records and reported no code it can show here. Read its summary, and approve or flag it.</p></div>
          }
        }
      </section>
      <aside class="rm-side" aria-label="Decision">
        <div class="rm-sidebody">
          @if (steps().length) {
            <section class="rm-check" aria-labelledby="rm-check-title">
              <h3 id="rm-check-title">What to try · step {{ at() + 1 }} of {{ steps().length }}</h3>
              @if (stepAt(); as s) {
                <p class="rm-steptitle">{{ s.when }}</p>
                <dl class="rm-stepdl">
                  @if (s.as) { <div><dt>As</dt><dd>{{ s.as }}</dd></div> }
                  <div><dt>Expect</dt><dd>{{ s.expect }}</dd></div>
                </dl>
                @if (walkOf(s); as w) {
                  <p class="rm-walked" role="status"><mat-icon aria-hidden="true">{{ w.how === 'reason' ? 'block' : 'check_circle' }}</mat-icon>{{ w.how === 'walked' ? 'Walked in the live build' : w.how === 'checked' ? 'Looks good' : 'Skipped: ' + w.reason }}
                    <button type="button" class="rm-link" (click)="walkStep(s, null)">Undo</button></p>
                } @else if (s.path && live().state === 'ready') { <p class="rm-hint"><mat-icon aria-hidden="true">touch_app</mat-icon>Do it in the live build; that ticks it and moves on.</p> }
                @if (!walkOf(s) && !skipping()) { <button type="button" class="rm-link rm-cant" (click)="startSkip()">Can't walk it? Say why</button> }
                @if (skipping()) {
                  <form class="rm-skip" (ngSubmit)="skip(s)"><label for="rm-reason">Why can't it be walked?</label>
                    <input id="rm-reason" name="reason" class="rm-input" [(ngModel)]="reason" placeholder="Say what stops it">
                    <div class="rm-buttons"><button type="button" class="lay-button ghost small" (click)="skipping.set(false)">Cancel</button><button type="submit" class="lay-button small" [disabled]="!reason.trim()">Skip this step</button></div></form>
                }
                <div class="rm-stepnav">
                  <button type="button" class="lay-button ghost small" [disabled]="at() === 0" (click)="at.set(at() - 1)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Back</button>
                  <ol class="rm-progress" aria-label="Steps">@for (entry of steps(); track entry.id; let i = $index) {
                    <li><button type="button" [class.rm-done]="walkOf(entry)" [attr.aria-current]="i === at() ? 'step' : null" (click)="at.set(i)" [attr.aria-label]="'Step ' + (i + 1) + (walkOf(entry) ? ', done' : ', to walk')"></button></li> }</ol>
                  @if (!walkOf(s)) {
                    <button type="button" class="lay-button small" [disabled]="walking()" (click)="walkStep(s, 'checked')"><mat-icon aria-hidden="true">check</mat-icon>Looks good</button>
                  } @else if (at() < steps().length - 1) { <button type="button" class="lay-button ghost small" (click)="at.set(at() + 1)">Next<mat-icon aria-hidden="true">arrow_forward</mat-icon></button> }
                </div>
              }
            </section>
          }
          <h3>Summary</h3>
          <p class="rm-summary">{{ action().summary || 'The agent gave no summary.' }}</p>
          <h3>Preview</h3>
          @if (action().preview?.url; as url) {
            <div class="rm-preview" [class.rm-warn]="action().preview!.stale || reach() === 'down'">
              <p class="rm-meta">@if (action().preview!.commit) { At <code>{{ action().preview!.commit!.slice(0, 7) }}</code> · }from {{ action().preview!.by?.name || 'the agent' }} · <time [attr.datetime]="action().preview!.at">{{ when(action().preview!.at) }}</time></p>
              @if (action().preview!.try) { <p class="rm-try"><strong>Try:</strong> {{ action().preview!.try }}</p> }
              @if (action().preview!.stale) { <p class="rm-previewnote" role="status"><mat-icon aria-hidden="true">history</mat-icon>Older build: it shows {{ action().preview!.commit!.slice(0, 7) }}, but {{ view().code?.commit?.slice(0, 7) }} was reported since. Ask for a fresh one.</p> }
              @if (action().tunnel && !action().tunnel!.connected) { <p class="rm-previewnote" role="status"><mat-icon aria-hidden="true">link_off</mat-icon>The agent's container isn't connected, so the live build can't show. Ask the agent to run the preview again.</p> }
              @if (!action().tunnel && reach() === 'down') { <p class="rm-previewnote" role="status"><mat-icon aria-hidden="true">link_off</mat-icon>This browser can't reach it. The agent's container may have stopped, or the port isn't forwarded to this machine. Ask the agent to run it again.</p> }
              @if (!action().tunnel) { <a class="lay-button small" [href]="url" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Preview #' + action().number + ' (opens in a new tab)'"><mat-icon aria-hidden="true">open_in_new</mat-icon>Preview</a> }
            </div>
          } @else if (action().preview?.none) { <p class="rm-none"><mat-icon aria-hidden="true">visibility_off</mat-icon>No preview: {{ action().preview!.none }}</p> }
          @else { <p class="rm-none lay-muted"><mat-icon aria-hidden="true">visibility_off</mat-icon>No preview: the agent didn't hand one over.</p> }
        </div>
        <form class="rm-decide" (ngSubmit)="decide('flag')">
          <label for="rm-note">Note <span class="lay-muted">(needed to flag)</span></label>
          <textarea id="rm-note" name="note" rows="3" [(ngModel)]="note" placeholder="What should change? It goes to the agent with the flag."></textarea>
          <div class="rm-buttons">
            <button type="submit" class="lay-button ghost" [disabled]="!note.trim() || busy()"><mat-icon aria-hidden="true">flag</mat-icon>Flag</button>
            <button type="button" class="lay-button" [disabled]="busy() || left() > 0" (click)="decide('approve')"><mat-icon aria-hidden="true">check</mat-icon>Approve #{{ action().number }}</button>
          </div>
          @if (left() > 0) { <p class="rm-left" role="status">{{ left() }} step{{ left() === 1 ? '' : 's' }} left to walk before you can approve.</p> }
        </form>
      </aside>
    </div>
  </dialog>
  <ng-template #treeLevel let-nodes>
    <ul>@for (node of nodes; track node.path) {
      <li>@if (node.file; as file) {
        <button type="button" class="rm-file" [attr.aria-current]="pickedPath() === file.path ? 'true' : null" (click)="pickFile(file.path)">
          <span [class]="'rm-dot rm-op-' + fileOp(file.status)" aria-hidden="true"></span><span class="rm-fname">{{ node.name }}</span><span class="visually-hidden">, {{ fileLabel[file.status] || 'Changed' }}</span>
          @if (!file.binary) { <span class="rm-counts"><span aria-hidden="true"><span class="rm-plus">+{{ file.added }}</span> <span class="rm-minus">−{{ file.removed }}</span></span><span class="visually-hidden">, {{ file.added }} added, {{ file.removed }} removed</span></span> }
        </button>
      } @else {
        <details open><summary><mat-icon aria-hidden="true">folder</mat-icon>{{ node.name }}</summary><ng-container *ngTemplateOutlet="treeLevel; context: { $implicit: node.children }" /></details>
      }</li>
    }</ul>
  </ng-template>`
})
export class WorkReviewModalComponent {
  readonly ctx = inject(ProjectContext);
  readonly action = input.required<GoalAction>();
  readonly view = input.required<GoalView>();
  // The page records the decision through its own write (so errors show where every other write's do) and says if it took.
  readonly submit = input.required<(decision: ReviewDecision) => Promise<boolean>>();
  readonly closed = output<void>();
  // A step walked here answers with the item's new view, so the page shows it without waiting for its stream.
  readonly updated = output<GoalView>();
  readonly opLabel = opLabel; readonly fileLabel = fileLabel; readonly fileOp = fileOp; readonly kindName = kindName; readonly changeName = changeName;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly chosen = signal<ViewKey | null>(null);
  readonly pickedId = signal<string | null>(null);
  readonly showSame = signal(false);
  readonly unfolded = signal<Set<string>>(new Set());
  readonly busy = signal(false);
  readonly reach = signal<'checking' | 'ok' | 'down' | null>(null);
  note = '';

  readonly changes = computed<Change[]>(() => this.view().changeset.flatMap(group => group.changes.filter(change => change.action === this.action().number).map(change => ({ ...change, layer: group.layer }) as Change)));
  readonly grouped = computed(() => { const out: { layer: string; changes: Change[] }[] = [];
    for (const change of this.changes()) { let group = out.find(entry => entry.layer === change.layer); if (!group) out.push(group = { layer: change.layer, changes: [] }); group.changes.push(change); }
    return out; });
  // Only the views this action has, in the order the spec opens them: Files for reported code, then Records.
  readonly views = computed(() => { const out: { key: ViewKey; label: string; count: number }[] = [];
    if (this.action().tunnel) out.push({ key: 'live', label: 'Live build', count: this.steps().length });
    if (codeOf(this.view(), this.action())) out.push({ key: 'files', label: 'Files', count: codeCount(this.view()) });
    if (this.changes().length) out.push({ key: 'records', label: 'Records', count: this.changes().length });
    return out; });
  readonly current = computed<ViewKey | null>(() => { const keys = this.views().map(entry => entry.key); const chosen = this.chosen(); return chosen && keys.includes(chosen) ? chosen : keys[0] || null; });
  readonly picked = computed<Change | null>(() => this.changes().find(change => change.id === this.pickedId()) || this.changes()[0] || null);
  readonly fields = computed(() => { const change = this.picked(); if (!change) return [];
    const all = recordDiff(change.op === 'create' ? null : change.before, change.op === 'delete' ? null : change.after);
    return change.op === 'update' && !this.showSame() ? all.filter(field => field.changed) : all; });

  // Files (W-27 #5): read when the tab first shows, again when newer code is reported; each file's diff when it's picked.
  readonly listing = signal<{ state: 'idle' | 'loading' | 'ready' | 'error'; error?: string; data?: { branch: string; commit: string; sources: FileSource[]; files: ShownFile[] } }>({ state: 'idle' });
  readonly tree = computed(() => fileTree(this.listing().data?.files || []));
  readonly pickedPath = signal<string | null>(null);
  private readonly diffs = signal<Record<string, { state: 'loading' | 'ready' | 'error'; error?: string; rows: CodeRow[]; tooLarge: boolean }>>({});
  readonly diffState = computed(() => { const path = this.pickedPath(), file = this.listing().data?.files.find(entry => entry.path === path); if (!file) return null;
    return { file, ...(this.diffs()[file.path] || { state: 'loading' as const, rows: [], tooLarge: false }) }; });
  private filesPath(query = '') { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/goals/${encodeURIComponent(this.view().item.id)}/files${query}`; }
  // W-33: with branches in other repositories, each one is read too, and the tree has a folder per repository.
  loadFiles() {
    this.listing.set({ state: 'loading' }); this.diffs.set({});
    type Listed = { repository: string | null; line: string | null; branch: string; commit: string; files: FileEntry[] };
    const others = this.view().code?.repositories || [];
    const reads: Promise<FileSource>[] = [
      this.ctx.api<Listed>(this.filesPath()).then(value => ({ ...value, other: false })),
      ...others.map(entry => this.ctx.api<Listed>(this.filesPath(`?repository=${encodeURIComponent(entry.repository)}&line=${encodeURIComponent(entry.line)}`)).then(value => ({ ...value, other: true })))
    ];
    Promise.all(reads).then(listed => {
      const sources = listed.filter(source => source.other || source.files.length || !others.length);
      const several = sources.length > 1;
      const files: ShownFile[] = sources.flatMap(source => source.files.map(file => ({ ...file, real: file.path, source,
        path: several ? `${this.sourceLabel(source)}/${file.path}` : file.path, from: file.from && several ? `${this.sourceLabel(source)}/${file.from}` : file.from })));
      const data = { branch: listed[0].branch, commit: listed[0].commit, sources, files };
      this.listing.set({ state: 'ready', data });
      const first = firstFile(this.tree()); const keep = data.files.some(file => file.path === this.pickedPath());
      if (!keep) this.pickedPath.set(first?.path || null);
      if (this.pickedPath()) this.loadDiff(this.pickedPath()!);
    }, (error: Error) => this.listing.set({ state: 'error', error: error.message || "The code couldn't be read." }));
  }
  pickFile(path: string) { this.pickedPath.set(path); this.loadDiff(path); }
  sourceLabel(source: FileSource) { return source.other ? `${source.repository} (${(source.line || '').replace(/\//g, '-')})` : source.repository || 'This project'; }
  loadDiff(path: string, again = false) {
    const known = this.diffs()[path]; if (known && known.state !== 'error' && !again) return;
    this.diffs.update(map => ({ ...map, [path]: { state: 'loading', rows: [], tooLarge: false } }));
    const shown = this.listing().data?.files.find(entry => entry.path === path);
    const where = shown?.source.other ? `&repository=${encodeURIComponent(shown.source.repository || '')}&line=${encodeURIComponent(shown.source.line || '')}` : '';
    this.ctx.api<{ diff: string | null; tooLarge: boolean }>(this.filesPath('?path=' + encodeURIComponent(shown?.real || path) + where)).then(
      value => this.diffs.update(map => ({ ...map, [path]: { state: 'ready', rows: value.diff ? unifiedRows(value.diff) : [], tooLarge: value.tooLarge } })),
      (error: Error) => this.diffs.update(map => ({ ...map, [path]: { state: 'error', error: error.message || "The diff couldn't be read.", rows: [], tooLarge: false } })));
  }

  // Live build (W-27 #6): the portal gives this member a one-time link into the tunnel; the walk script in the build says
  // which page shows and what it did, and a step whose page or request that matches is walked.
  private readonly sanitizer = inject(DomSanitizer);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  readonly live = signal<{ state: 'idle' | 'opening' | 'ready' | 'down'; src?: SafeResourceUrl; origin?: string; error?: string }>({ state: 'idle' });
  readonly livePath = signal('/');
  openLive() {
    const preview = this.action().preview, tunnel = this.action().tunnel; if (!tunnel) return;
    const start = preview?.url && new URL(preview.url).origin === new URL(tunnel.url).origin ? new URL(preview.url) : null;
    const path = start ? start.pathname + start.search : '/';
    this.live.set({ state: 'opening' }); this.livePath.set(path);
    this.ctx.api<{ open: string; connected: boolean }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/goals/${encodeURIComponent(this.view().item.id)}/previews/${this.action().number}`, 'POST', { path }).then(value => {
      const open = new URL(value.open);
      // Only the tunnel's own origin goes in the frame.
      if (open.origin !== new URL(tunnel.url).origin) throw new Error('The preview link came back for another address.');
      if (!value.connected) { this.live.set({ state: 'down', error: "The agent's container isn't connected, so the live build can't show. Ask the agent to run the preview again." }); return; }
      this.live.set({ state: 'ready', src: this.sanitizer.bypassSecurityTrustResourceUrl(open.href), origin: open.origin });
    }).catch((error: Error) => this.live.set({ state: 'down', error: error.message || "The live build couldn't open." }));
  }
  // A new tab can't use the frame's access, so it gets its own one-time link, at the page the frame shows. The tab opens
  // at the click (so it isn't blocked as a pop-up) and goes to the link once the portal answers.
  openTab() {
    const tab = window.open('', '_blank'); if (!tab) return;
    tab.opener = null;
    this.ctx.api<{ open: string }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/goals/${encodeURIComponent(this.view().item.id)}/previews/${this.action().number}`, 'POST', { path: this.livePath() })
      .then(value => { tab.location.href = value.open; }, (error: Error) => { tab.close(); this.live.set({ state: 'down', error: error.message || "The live build couldn't open." }); });
  }
  // The checklist: its steps, this person's walk of them, the one showing, and how many are left before Approve.
  readonly steps = computed<GoalStep[]>(() => this.action().preview?.steps || []);
  readonly at = signal(0);
  readonly stepAt = computed(() => this.steps()[this.at()] || null);
  readonly left = computed(() => this.steps().filter(step => !this.walkOf(step)).length);
  readonly walking = signal(false);
  readonly skipping = signal(false); reason = '';
  walkOf(step: GoalStep) { return this.action().preview?.walk?.[step.id] || null; }
  startSkip() { this.reason = ''; this.skipping.set(true); setTimeout(() => document.getElementById('rm-reason')?.focus()); }
  skip(step: GoalStep) { const reason = this.reason.trim(); if (reason) void this.walkStep(step, 'reason', reason).then(() => this.skipping.set(false)); }
  async walkStep(step: GoalStep, how: 'walked' | 'checked' | 'reason' | null, reason?: string) {
    this.walking.set(true);
    // Through the shell's write, so a refused step shows where every other write's error does.
    await this.ctx.write(async () => {
      const view = await this.ctx.api<GoalView>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/goals/${encodeURIComponent(this.view().item.id)}/walk/${this.action().number}`, 'POST', { step: step.id, how, ...(reason ? { reason } : {}) });
      this.updated.emit(view);
      // Done with this step: on to the next one still to walk.
      if (how && this.stepAt()?.id === step.id) { const steps = this.steps(), after = steps.findIndex((entry, index) => index > this.at() && entry.id !== step.id && !view.actions.find(a => a.number === this.action().number)?.preview?.walk?.[entry.id]);
        if (after >= 0) this.at.set(after); }
    }).finally(() => this.walking.set(false));
  }
  private readonly listener = (event: MessageEvent) => {
    const data = event.data as Walk, frame = this.frame()?.nativeElement, origin = this.live().origin;
    if (!data || data.aludelWalk !== 1 || !frame || event.source !== frame.contentWindow || event.origin !== origin) return;
    if (data.kind === 'page') this.livePath.set(data.path);
    for (const step of this.steps()) {
      if (this.walkOf(step) || !step.path || routeOf(step.path) !== routeOf(data.path)) continue;
      if (data.kind === 'page' ? !step.method : step.method === String(data.method).toUpperCase()) void this.walkStep(step, 'walked');
    }
  };

  constructor() {
    afterNextRender(() => { this.dialog().nativeElement.showModal(); this.checkReach();
      const first = this.steps().findIndex(step => !this.walkOf(step)); if (first > 0) this.at.set(first); });
    window.addEventListener('message', this.listener);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('message', this.listener));
    effect(() => { const shown = this.current() === 'live'; untracked(() => { if (shown && this.live().state === 'idle') this.openLive(); }); });
    // Every reported commit, the other repositories' included, so newer code in any of them reads the files again.
    effect(() => { const code = this.view().code; const reported = code ? [code.commit, ...(code.repositories || []).map(entry => entry.commit)].join(' ') : ''; const shown = this.current() === 'files';
      untracked(() => { const listed = this.listing();
        const read = listed.data ? [listed.data.commit, ...listed.data.sources.filter(source => source.other).map(source => source.commit)].join(' ') : '';
        if (shown && (listed.state === 'idle' || (listed.data && reported && read !== reported))) this.loadFiles(); }); });
  }
  close() { this.dialog().nativeElement.close(); }
  choose(key: ViewKey) { this.chosen.set(key); }
  step(by: number) { const keys = this.views().map(entry => entry.key); const at = keys.indexOf(this.current()!); const next = keys[(at + by + keys.length) % keys.length];
    this.chosen.set(next); setTimeout(() => document.getElementById('rm-tab-' + next)?.focus()); }
  pick(id: string) { this.pickedId.set(id); this.unfolded.set(new Set()); }
  unfold(key: string) { this.unfolded.update(set => new Set(set).add(key)); }
  rowsOf(key: string, rows: DiffRow[]) { return this.picked()?.op !== 'update' || this.unfolded().has(key) ? rows : fold(rows); }
  layerName(key: string) { return this.ctx.layerInstances().find(entry => entry.key === key)?.name || layerLabel[key] || key; }
  when(at: string) { const date = new Date(at); return date.toDateString() === new Date().toDateString() ? date.toTimeString().slice(0, 5) : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${date.toTimeString().slice(0, 5)}`; }
  async decide(verdict: 'approve' | 'flag') {
    const note = this.note.trim(); if (verdict === 'flag' && !note) return;
    this.busy.set(true);
    try { if (await this.submit()(verdict === 'flag' ? { verdict, note } : { verdict })) this.close(); }
    finally { this.busy.set(false); }
  }
  // W-25: the link may be a port only this machine forwards, so the portal can't tell whether it answers; an opaque no-cors
  // request from this browser can (it fails only when nothing answers).
  private checkReach() {
    const url = this.action().preview?.url; if (!url || this.action().tunnel) return;
    this.reach.set('checking');
    void fetch(url, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(5000) }).then(() => 'ok' as const, () => 'down' as const).then(state => this.reach.set(state));
  }
}
