import { Component, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext, layerLabel } from './context';
import type { GoalAction, GoalView } from './work-goal';
import { DiffRow, fold, recordDiff } from './review-diff';

// W-27 (A7, DEC-070): one review modal for every action in review, as the a0/v2 prototype drew it and Pages' "Action review"
// page specs it. The preview matches what the action changed: Records (any layer) shows each staged record Previous beside
// Proposed; Files lists the code it reported. The side panel carries the summary, the handed-over preview and the decision.
type Change = { id: string; kind: string; op: 'create' | 'update' | 'delete'; layer: string; baseRevision?: number | null; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null };
type ViewKey = 'records' | 'files';
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
  if (codeOf(view, action)) parts.push(`${view.code!.files.length} file${view.code!.files.length === 1 ? '' : 's'}`);
  if (action.preview?.url) parts.push('a preview to open');
  return parts.join(' · ') || 'Nothing staged; read its summary';
}
// The item's reported code belongs to its Code actions (the code is the item's, so every Code action reviews the same files).
const codeOf = (view: GoalView, action: GoalAction) => Boolean(view.code && action.layer === 'platform');

@Component({
  selector: 'aludel-work-review-modal', standalone: true, imports: [FormsModule, MatIconModule],
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
      @if (action().preview?.url; as url) { <a class="lay-button ghost small rm-newtab" [href]="url" target="_blank" rel="noopener noreferrer"><mat-icon aria-hidden="true">open_in_new</mat-icon>Open in a new tab</a> }
    </header>
    <div class="rm-body">
      <section class="rm-main" id="rm-pane" [attr.role]="views().length > 1 ? 'tabpanel' : null" [attr.aria-labelledby]="views().length > 1 ? 'rm-tab-' + current() : 'rm-title'">
        @switch (current()) {
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
              @if (view().code; as code) {
                <h3>{{ code.files.length }} file{{ code.files.length === 1 ? '' : 's' }} on <code>{{ code.branch }}</code> at <code>{{ code.commit.slice(0, 7) }}</code></h3>
                <ul>@for (file of code.files; track file.path) { <li><span [class]="'rm-op rm-op-' + fileOp(file.status)">{{ fileLabel[file.status] || 'Changed' }}</span><span class="rm-path">{{ file.path }}</span></li> }</ul>
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
          <h3>Summary</h3>
          <p class="rm-summary">{{ action().summary || 'The agent gave no summary.' }}</p>
          <h3>Preview</h3>
          @if (action().preview?.url; as url) {
            <div class="rm-preview" [class.rm-warn]="action().preview!.stale || reach() === 'down'">
              <p class="rm-meta">@if (action().preview!.commit) { At <code>{{ action().preview!.commit!.slice(0, 7) }}</code> · }from {{ action().preview!.by?.name || 'the agent' }} · <time [attr.datetime]="action().preview!.at">{{ when(action().preview!.at) }}</time></p>
              @if (action().preview!.try) { <p class="rm-try"><strong>Try:</strong> {{ action().preview!.try }}</p> }
              @if (action().preview!.stale) { <p class="rm-previewnote" role="status"><mat-icon aria-hidden="true">history</mat-icon>Older build: it shows {{ action().preview!.commit!.slice(0, 7) }}, but {{ view().code?.commit?.slice(0, 7) }} was reported since. Ask for a fresh one.</p> }
              @if (reach() === 'down') { <p class="rm-previewnote" role="status"><mat-icon aria-hidden="true">link_off</mat-icon>This browser can't reach it. The agent's container may have stopped, or the port isn't forwarded to this machine. Ask the agent to run it again.</p> }
              <a class="lay-button small" [href]="url" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Preview #' + action().number + ' (opens in a new tab)'"><mat-icon aria-hidden="true">open_in_new</mat-icon>Preview</a>
            </div>
          } @else if (action().preview?.none) { <p class="rm-none"><mat-icon aria-hidden="true">visibility_off</mat-icon>No preview: {{ action().preview!.none }}</p> }
          @else { <p class="rm-none lay-muted"><mat-icon aria-hidden="true">visibility_off</mat-icon>No preview: the agent didn't hand one over.</p> }
        </div>
        <form class="rm-decide" (ngSubmit)="decide('flag')">
          <label for="rm-note">Note <span class="lay-muted">(needed to flag)</span></label>
          <textarea id="rm-note" name="note" rows="3" [(ngModel)]="note" placeholder="What should change? It goes to the agent with the flag."></textarea>
          <div class="rm-buttons">
            <button type="submit" class="lay-button ghost" [disabled]="!note.trim() || busy()"><mat-icon aria-hidden="true">flag</mat-icon>Flag</button>
            <button type="button" class="lay-button" [disabled]="busy()" (click)="decide('approve')"><mat-icon aria-hidden="true">check</mat-icon>Approve #{{ action().number }}</button>
          </div>
        </form>
      </aside>
    </div>
  </dialog>`
})
export class WorkReviewModalComponent {
  readonly ctx = inject(ProjectContext);
  readonly action = input.required<GoalAction>();
  readonly view = input.required<GoalView>();
  // The page records the decision through its own write (so errors show where every other write's do) and says if it took.
  readonly submit = input.required<(decision: ReviewDecision) => Promise<boolean>>();
  readonly closed = output<void>();
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
    if (codeOf(this.view(), this.action())) out.push({ key: 'files', label: 'Files', count: this.view().code!.files.length });
    if (this.changes().length) out.push({ key: 'records', label: 'Records', count: this.changes().length });
    return out; });
  readonly current = computed<ViewKey | null>(() => { const keys = this.views().map(entry => entry.key); const chosen = this.chosen(); return chosen && keys.includes(chosen) ? chosen : keys[0] || null; });
  readonly picked = computed<Change | null>(() => this.changes().find(change => change.id === this.pickedId()) || this.changes()[0] || null);
  readonly fields = computed(() => { const change = this.picked(); if (!change) return [];
    const all = recordDiff(change.op === 'create' ? null : change.before, change.op === 'delete' ? null : change.after);
    return change.op === 'update' && !this.showSame() ? all.filter(field => field.changed) : all; });

  constructor() {
    afterNextRender(() => { this.dialog().nativeElement.showModal(); this.checkReach(); });
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
    const url = this.action().preview?.url; if (!url) return;
    this.reach.set('checking');
    void fetch(url, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(5000) }).then(() => 'ok' as const, () => 'down' as const).then(state => this.reach.set(state));
  }
}
