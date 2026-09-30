import { Component, HostListener, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectContext, RunChange, WorkRun } from './context';
import { AvatarComponent, RefChipComponent } from './work-shared';
import { reviewFocus, runTitle } from './work-run';

type Evidence = { type: 'change' | 'test' | 'try' | 'check' | 'note'; label: string; detail: string; look: string; result?: string; missing?: boolean };
const evidenceType: Record<Evidence['type'], [string, string]> = { change: ['difference', 'Change'], test: ['science', 'Test'], try: ['touch_app', 'Try it'], check: ['verified', 'Aludel check'], note: ['person', 'Performer evidence'] };

// WORK-ITEM-UX-01 WI-4: reviewing one run, a criterion at a time. The left shows what the run produced (only the kinds it
// produced: Changes, Preview, Tests); the right steps through its criteria and ends at the signature.
@Component({
  selector: 'aludel-work-review', standalone: true, imports: [FormsModule, MatIconModule, MatTooltipModule, AvatarComponent, RefChipComponent],
  template: `
  @if (item(); as work) {
    @if (run(); as r) {
      <div class="wr">
        <header class="wr-top">
          <a class="lay-button ghost small" [href]="back()" (click)="ctx.go(back(), $event)" aria-label="Close review"><mat-icon aria-hidden="true">close</mat-icon></a>
          <h1 tabindex="-1">Review {{ work.ref }} · Run {{ r.number }}</h1>
          <span class="wr-who"><aludel-avatar [who]="{ kind: r.performer.kind, id: r.performer.id }" />{{ r.performer.label }}</span>
          <span class="lay-muted small wr-title">{{ work.title }}</span>
          <div class="wr-pips" role="group" aria-label="Progress">
            @for (criterion of r.task.criteria; track criterion.index) { <button type="button" [class]="'wr-pip wr-pip-' + (r.review.verdicts[criterion.index]?.value || 'none')" [class.cur]="step() === criterion.index" (click)="goTo(criterion.index)" [attr.aria-label]="'Criterion ' + (criterion.index + 1)"></button> }
            <button type="button" class="wr-pip wr-pip-end" [class.cur]="onEnd()" (click)="goTo(r.task.criteria.length)" aria-label="Sign off"></button></div>
        </header>
        @if (r.state !== 'review') { <p class="wr-note"><mat-icon aria-hidden="true">{{ r.state === 'failed' ? 'error' : 'info' }}</mat-icon>@if (r.state === 'failed') { This run failed and cannot be accepted. Review its report, objectives and evidence to diagnose the blocker, then close it from the work item. } @else { Run {{ r.number }} is {{ runTitle[r.state].toLowerCase() }}. You can read it here; verdicts and signatures are closed. }</p> }
        <div class="wr-body">
          <section class="wr-viewer" aria-label="What the run produced">
            <div class="wr-vtabs" role="tablist">@for (tab of tabs(); track tab.id) { <button type="button" role="tab" class="wi-tab" [attr.aria-selected]="view() === tab.id" (click)="view.set(tab.id)"><mat-icon aria-hidden="true">{{ tab.icon }}</mat-icon>{{ tab.label }}@if (tab.count) { <small>{{ tab.count }}</small> }</button> }</div>
            <div class="wr-pane">
              @switch (view()) {
                @case ('changes') {
                  @for (change of r.changes; track change.id) {
                    <article class="wr-change" [class.hl]="focus() === change.id" [id]="'change-' + change.id">
                      <header><mat-icon aria-hidden="true">{{ change.icon }}</mat-icon><strong>{{ change.name }}</strong><span [class]="'wi-op wi-op-' + change.op">{{ opLabel[change.op] }}@if (change.size) { · {{ change.size }} }</span>
                        @if (r.state === 'review') { <button type="button" class="wi-flag on-visible" [class.on]="r.review.flags[change.id] !== undefined" (click)="toggleFlag(change.id)" [attr.aria-label]="(r.review.flags[change.id] !== undefined ? 'Remove the flag from ' : 'Flag ') + change.name"><mat-icon aria-hidden="true">flag</mat-icon></button> }</header>
                      @if (r.review.flags[change.id] !== undefined) {
                        @if (r.state === 'review') { <div class="wi-flagnote"><mat-icon aria-hidden="true">flag</mat-icon><label class="visually-hidden" [for]="'wr-flag-' + change.id">What's wrong with {{ change.name }}</label><input [id]="'wr-flag-' + change.id" [value]="r.review.flags[change.id]" (change)="saveFlag(change.id, $any($event.target).value)" placeholder="What's wrong with this change?"></div> }
                        @else { <p class="wi-flagnote"><mat-icon aria-hidden="true">flag</mat-icon>{{ r.review.flags[change.id] }}</p> }
                      }
                      @switch (change.kind) {
                        @case ('claim') { <dl class="wr-text">@if (change.before) { <dt>Was</dt><dd class="wr-was">{{ change.before }}</dd> }<dt>{{ change.before ? 'Now' : 'New' }}</dt><dd class="wr-now">{{ change.after }}</dd>
                          @if (change.note) { <dt>Note</dt><dd class="small">{{ change.note }}</dd> }@if (change.basis) { <dt>Basis</dt><dd class="small">{{ change.basis }}</dd> }</dl> }
                        @case ('flow-revision') { <div class="wr-flow-revision"><section><h3>Previous</h3><pre class="wr-diff">{{ change.before }}</pre></section><section><h3>Proposed</h3><pre class="wr-diff">{{ change.after }}</pre></section></div> }
                        @case ('proposal') { <p class="lay-prose">{{ change.after }}</p><dl class="lay-fieldiff">@for (field of fields(change); track field[0]) { <dt>{{ field[0] }}</dt><dd>{{ field[1] }}</dd> }</dl> }
                        @case ('report') { <p class="lay-prose">{{ change.after }}</p>
                          @for (finding of change.findings || []; track $index) { <div class="wr-finding"><strong>{{ finding.title }}</strong> <span class="lay-chip lay-info">{{ finding.severity }}</span><p class="small"><strong>Affected:</strong> {{ finding.affected }}</p><p class="small"><strong>Evidence:</strong> {{ finding.evidence }}</p><p class="small"><strong>Suggested:</strong> {{ finding.recommendation }}</p></div> }
                          @empty { <p class="lay-muted small">No findings reported.</p> } }
                        @case ('file') { @if (diffLines().length && change.id === r.changes.find(entry => entry.kind === 'file')?.id) {
                          <pre class="wr-diff">@for (line of diffLines(); track $index) {<span [class]="line[0] === '+' && !line.startsWith('+++') ? 'a' : line[0] === '-' && !line.startsWith('---') ? 'd' : line.startsWith('@@') ? 'h' : ''">{{ line }}</span>}</pre> } }
                      }
                    </article>
                  } @empty { <p class="lay-muted">Run {{ r.number }} submitted no changes.</p> }
                  @if (r.candidate && !diffLines().length) { <button type="button" class="lay-button ghost small" (click)="loadDiff()">Show the code diff</button> }
                }
                @case ('preview') {
                  <div class="wr-preview">
                    <p class="small">Preview of commit {{ r.candidate?.commit?.slice(0, 12) || 'not committed' }}: {{ preview()?.status || 'not built' }}@if (preview()?.error) { · {{ preview()?.error }} }</p>
                    @if (preview()?.status === 'running') { <iframe [src]="previewUrl()" title="Candidate preview"></iframe><a [href]="preview()?.url" target="_blank" rel="noopener noreferrer">Open in a new tab</a> }
                    @else if (r.state === 'review') { <button type="button" class="lay-button" (click)="buildPreview()">Build the isolated preview</button> }
                  </div>
                }
                @case ('tests') {
                  <ul class="wr-tests">@for (check of r.candidate?.checks || []; track $index) {
                    <li [class.hl]="focus() === 'test:' + $index"><mat-icon aria-hidden="true" [class]="'wr-t-' + check.status">{{ check.status === 'passed' ? 'check_circle' : check.status === 'failed' ? 'cancel' : 'radio_button_unchecked' }}</mat-icon>
                      <span>{{ check.name }}<small>{{ check.source === 'agent-report' ? 'Reported by the agent; not re-run by Aludel' : 'Run by Aludel' }}@if (check.detail) { · {{ check.detail }} }</small></span></li> }</ul>
                }
              }
            </div>
          </section>

          <section class="wr-stepper" aria-label="Criteria">
            @if (!onEnd()) {
              @if (criterion(); as c) {
                <div class="wr-step">
                  <p class="lay-eyebrow">Criterion {{ c.index + 1 }} of {{ r.task.criteria.length }}</p>
                  <h2>{{ c.text }}</h2>
                  <div><p class="lay-eyebrow">To verify, check</p>
                    <div class="wr-evs">@for (entry of evidence(); track $index) {
                      <button type="button" [class]="'wr-ev wr-ev-' + entry.type" [class.missing]="entry.missing" [disabled]="!entry.look" (click)="look(entry.look)"><mat-icon aria-hidden="true">{{ evidenceType[entry.type][0] }}</mat-icon>
                        <span><small class="wr-ev-type">{{ evidenceType[entry.type][1] }}</small>{{ entry.label }}<small>{{ entry.detail }}</small></span>@if (entry.result) { <span class="small">{{ entry.result }}</span> }</button>
                    } @empty { <p class="lay-muted small">This run produced nothing to check against. Reject it or skip.</p> }</div>
                    <p class="small lay-muted wr-legend"><mat-icon aria-hidden="true">info</mat-icon>{{ named() ? 'Named by the run when it submitted. Each item points at something it produced; Aludel re-runs tests where it can.' : 'This run named no evidence per criterion, so this lists everything it produced.' }}</p></div>
                  <details class="wr-ctx"><summary><mat-icon aria-hidden="true">bookmark</mat-icon>Context</summary>
                    <div>@if (c.source) { <p class="small">From <aludel-ref [id]="c.source.id" /></p> }<p class="small"><strong>The request:</strong> {{ r.task.request || r.task.title }}</p><p class="small lay-muted">Shown for reference. You're reviewing the result, not this.</p></div></details>
                  @switch (verdict()?.value) {
                    @case ('accept') { <p class="wr-verdict ok"><mat-icon aria-hidden="true">check_circle</mat-icon>You accepted this.</p> }
                    @case ('skip') { <p class="wr-verdict"><mat-icon aria-hidden="true">redo</mat-icon>Skipped.</p> }
                    @case ('reject') { <div class="wr-reject"><p class="wr-verdict bad"><mat-icon aria-hidden="true">flag</mat-icon>Flagged. Say what's wrong; it goes to the next run.</p>
                      <label class="visually-hidden" for="wr-note">What's wrong</label><textarea id="wr-note" rows="3" [(ngModel)]="noteDraft" (blur)="saveNote()" placeholder="What should change?"></textarea></div> }
                  }
                </div>
              }
            } @else {
              <div class="wr-step">
                <p class="lay-eyebrow">Sign off · run {{ r.number }}</p>
                <h2>{{ flagCount() ? 'Send back with ' + flagCount() + (flagCount() === 1 ? ' flag' : ' flags') : unchecked() ? unchecked() + ' not checked by you' : 'Everything checks out' }}</h2>
                <ul class="wr-sum">@for (c of r.task.criteria; track c.index) { <li><mat-icon aria-hidden="true" [class]="'wr-sum-' + (r.review.verdicts[c.index]?.value || 'none')">{{ r.review.verdicts[c.index]?.value === 'accept' ? 'check_circle' : r.review.verdicts[c.index]?.value === 'reject' ? 'flag' : 'radio_button_unchecked' }}</mat-icon>
                  <span>{{ c.text }}@if (r.review.verdicts[c.index]?.note) { <small>{{ r.review.verdicts[c.index]?.note }}</small> }@if (r.review.verdicts[c.index]?.value === 'skip') { <small>Skipped</small> }</span></li> }
                  @for (change of flaggedChanges(); track change.id) { <li><mat-icon aria-hidden="true" class="wr-sum-reject">flag</mat-icon><span>{{ change.name }}<small>{{ r.review.flags[change.id] }}</small></span></li> }</ul>
                @if (!flagCount() && unchecked()) { <p class="wi-warn"><mat-icon aria-hidden="true">warning</mat-icon>Accepting now signs for {{ unchecked() }} {{ unchecked() === 1 ? 'criterion' : 'criteria' }} you didn't check.</p> }
                <label for="wr-comment">Overall comment (optional)</label>
                <textarea id="wr-comment" rows="3" [(ngModel)]="comment" [placeholder]="flagCount() ? 'What should the next run do differently?' : 'Anything to note for the record'"></textarea>
                <p class="small lay-muted">{{ flagCount() ? 'Nothing is applied. The task opens again as Next run with your flags and comment carried in.'
                  : r.performer.kind === 'person' ? 'Signs off the recorded work and closes ' + work.ref + '.' : 'Applies the run\\'s changes and closes ' + work.ref + '.' }}</p>
              </div>
            }
            <footer class="wr-foot">
              <button type="button" class="lay-button ghost small" (click)="goTo(step() - 1)" [disabled]="step() === 0"><mat-icon aria-hidden="true">arrow_back</mat-icon>Back</button>
              <span class="wr-spacer"></span>
              @if (!onEnd()) {
                @if (r.state === 'review') {
                  <button type="button" [class]="'lay-button ' + (verdict()?.value === 'reject' ? 'danger' : 'ghost wi-reject')" (click)="setVerdict('reject')"><mat-icon aria-hidden="true">flag</mat-icon>Reject <kbd>R</kbd></button>
                  <span class="wr-acol"><button type="button" [class]="'lay-button ' + (verdict()?.value === 'accept' ? 'lay-button-ok' : '')" (click)="setVerdict('accept')"><mat-icon aria-hidden="true">check</mat-icon>Accept <kbd>A</kbd></button>
                    @if (verdict()?.value === 'reject') { <button type="button" class="wr-skip" (click)="saveNote(); goTo(step() + 1)">Next</button> }
                    @else { <button type="button" class="wr-skip" (click)="setVerdict('skip')">Skip</button> }</span>
                } @else { <button type="button" class="lay-button" (click)="goTo(step() + 1)">Next<mat-icon aria-hidden="true">arrow_forward</mat-icon></button> }
              } @else if (r.state === 'review') {
                <button type="button" [class]="'lay-button ' + (flagCount() ? 'danger' : 'lay-button-ok')" (click)="sign(flagCount() ? 'reject' : 'accept')"><mat-icon aria-hidden="true">draw</mat-icon>{{ flagCount() ? 'Sign and send back' : 'Sign and accept' }}</button>
              }
            </footer>
          </section>
        </div>
      </div>
    } @else if (loaded()) { <h1 tabindex="-1">Run not found</h1><p><a [href]="back()" (click)="ctx.go(back(), $event)">Back to {{ work.ref }}</a></p> }
  } @else { <h1 tabindex="-1">Work item not found</h1> }`
})
export class WorkReviewComponent {
  readonly ctx = inject(ProjectContext);
  readonly id = input.required<string>();
  readonly number = input.required<string>();
  readonly runTitle = runTitle;
  readonly evidenceType = evidenceType;
  readonly opLabel = { created: 'Created', modified: 'Modified', removed: 'Removed' };
  readonly item = computed(() => this.ctx.workById().get(this.id()) || null);
  readonly runs = signal<WorkRun[]>([]);
  readonly loaded = signal(false);
  readonly run = computed(() => this.runs().find(run => String(run.number) === this.number()) || null);
  readonly step = signal(0);
  readonly view = signal('changes');
  readonly focus = signal<string | null>(null);
  readonly diffLines = signal<string[]>([]);
  readonly preview = signal<{ status: string; error?: string | null; url: string } | null>(null);
  comment = ''; noteDraft = '';
  private loadedFor = '';
  readonly onEnd = computed(() => this.step() >= (this.run()?.task.criteria.length ?? 0));
  readonly criterion = computed(() => this.run()?.task.criteria[this.step()] || null);
  readonly verdict = computed(() => this.run()?.review.verdicts[this.step()] || null);
  readonly tabs = computed(() => { const r = this.run(); if (!r) return [];
    return [{ id: 'changes', label: 'Changes', icon: 'difference', count: r.changes.length },
      ...(r.candidate ? [{ id: 'preview', label: 'Preview', icon: 'web', count: 0 }] : []),
      ...(r.candidate?.checks?.length ? [{ id: 'tests', label: 'Tests', icon: 'science', count: r.candidate.checks.length }] : [])]; });
  // The evidence the run named for this criterion (WI-6). Runs that named none fall back to everything they produced.
  readonly named = computed(() => (this.run()?.evidence || []).length > 0);
  readonly evidence = computed<Evidence[]>(() => { const r = this.run(); if (!r) return [];
    if (this.named()) return r.evidence.filter(item => item.criterion === this.step()).map(item => ({
      type: item.type, label: item.label, look: item.target || '',
      detail: !item.found ? 'Named by the performer, but not in the review packet' : item.type === 'test' ? (item.independent ? 'Run by Aludel' : 'Reported by the agent; not re-run') : item.type === 'try' ? item.ref : item.note,
      result: item.type === 'test' ? item.result || undefined : undefined, missing: !item.found }));
    return [...r.changes.map(change => ({ type: 'change' as const, label: change.name, detail: `${this.opLabel[change.op]}${change.size ? ' · ' + change.size : ''}`, look: `change:${change.id}` })),
      ...(r.candidate?.checks || []).map((check, index) => ({ type: 'test' as const, label: check.name, detail: check.source === 'agent-report' ? 'Reported by the agent' : 'Run by Aludel', look: `test:${index}`, result: check.status }))]; });
  readonly flaggedChanges = computed(() => { const r = this.run(); return r ? r.changes.filter(change => r.review.flags[change.id] !== undefined) : []; });
  readonly flagCount = computed(() => { const r = this.run(); return r ? Object.values(r.review.verdicts).filter(value => value.value === 'reject').length + this.flaggedChanges().length : 0; });
  readonly unchecked = computed(() => { const r = this.run(); return r ? r.task.criteria.filter(c => !r.review.verdicts[c.index] || r.review.verdicts[c.index].value === 'skip').length : 0; });
  readonly back = computed(() => this.ctx.link('work', 'item', this.id()));
  private readonly sanitizer = inject(DomSanitizer);
  // The candidate's own isolated preview, served by this portal; nothing else is framed.
  readonly previewUrl = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.preview()?.url || 'about:blank'));

  constructor() {
    effect(() => { const work = this.item(); const key = work ? `${work.id}:${work.updatedAt}` : '';
      untracked(() => { if (!work || key === this.loadedFor) return; const first = !this.loadedFor; this.loadedFor = key; this.load(first); }); });
    effect(() => { const verdict = this.verdict(); untracked(() => this.noteDraft = verdict?.note || ''); });
  }

  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}`; }
  load(first = false) {
    const work = this.item(); if (!work) return;
    void this.ctx.api<{ runs: WorkRun[] }>(`${this.base()}/work/${encodeURIComponent(work.id)}/runs`).then(value => {
      this.runs.set(value.runs); this.loaded.set(true);
      if (first) {
        const r = this.run(); const focus = reviewFocus(); reviewFocus.set(null);
        if (focus && r?.changes.some(change => change.id === focus)) { this.view.set('changes'); this.focus.set(focus); }
        const next = r ? r.task.criteria.findIndex(c => !r.review.verdicts[c.index]) : -1;
        this.step.set(next < 0 ? r?.task.criteria.length || 0 : next);
        if (r?.candidate) void this.ctx.api<{ preview: { status: string; error?: string | null }; url: string }>(`${this.base()}/candidates/${encodeURIComponent(r.candidate.id)}/preview`)
          .then(status => this.preview.set({ ...status.preview, url: status.url }), () => this.preview.set(null));
      }
    }, () => { this.runs.set([]); this.loaded.set(true); });
  }
  goTo(index: number) { const r = this.run(); if (!r) return; this.step.set(Math.max(0, Math.min(r.task.criteria.length, index))); this.focus.set(null); }
  look(target: string) { const [kind, ...rest] = target.split(':'); const id = rest.join(':');
    if (kind === 'change') { this.view.set('changes'); this.focus.set(id); setTimeout(() => document.getElementById('change-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }
    if (kind === 'test') { this.view.set('tests'); this.focus.set(target); }
    if (kind === 'preview') this.view.set('preview'); }
  private review(body: unknown) { const r = this.run(); if (!r) return Promise.resolve();
    return this.ctx.write(async () => { const updated = await this.ctx.api<WorkRun>(`${this.base()}/work/${encodeURIComponent(this.id())}/runs/${encodeURIComponent(r.id)}/review`, 'PUT', body);
      this.runs.set(this.runs().map(run => run.id === updated.id ? updated : run)); }); }
  setVerdict(value: 'accept' | 'reject' | 'skip') {
    const index = this.step(); const current = this.verdict()?.value;
    if (value === 'reject') { void this.review({ verdict: { index, value: current === 'reject' ? null : 'reject', note: this.noteDraft } }).then(() => setTimeout(() => document.getElementById('wr-note')?.focus())); return; }
    void this.review({ verdict: { index, value } }).then(() => this.goTo(index + 1));
  }
  saveNote() { if (this.verdict()?.value === 'reject') void this.review({ verdict: { index: this.step(), value: 'reject', note: this.noteDraft } }); }
  toggleFlag(id: string) { void this.review({ flag: { id, on: this.run()?.review.flags[id] === undefined, note: '' } }); }
  saveFlag(id: string, note: string) { void this.review({ flag: { id, note } }); }
  sign(outcome: 'accept' | 'reject') { const r = this.run(); if (!r) return;
    void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/work/${encodeURIComponent(this.id())}/runs/${encodeURIComponent(r.id)}/sign`, 'POST', { outcome, comment: this.comment }); this.ctx.go(this.back()); },
      outcome === 'accept' ? r.performer.kind === 'person' ? `Run ${r.number} accepted and signed off.` : `Run ${r.number} accepted and applied.`
        : `Run ${r.number} sent back. The task is open again in Next run.`); }
  loadDiff() { const r = this.run(); if (!r?.candidate) return;
    void this.ctx.api<{ diff: string }>(`${this.base()}/candidates/${encodeURIComponent(r.candidate.id)}`).then(value => this.diffLines.set((value.diff || '').split('\n').slice(0, 2000)), () => this.diffLines.set([])); }
  buildPreview() { const r = this.run(); if (!r?.candidate) return;
    void this.ctx.write(async () => { const value = await this.ctx.api<{ preview: { status: string; error?: string | null }; url: string }>(`${this.base()}/candidates/${encodeURIComponent(r.candidate!.id)}/preview`, 'POST', {}); this.preview.set({ ...value.preview, url: value.url }); }); }
  fields(change: RunChange): [string, string][] { return Object.entries(change.content || {}).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]); }

  @HostListener('document:keydown', ['$event'])
  key(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (!this.run() || target?.closest('input, textarea, select, [contenteditable]') || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (this.run()?.state === 'review' && !this.onEnd() && (key === 'a' || key === 'r')) { event.preventDefault(); this.setVerdict(key === 'a' ? 'accept' : 'reject'); }
    else if (key === 'j' || event.key === 'ArrowRight') { event.preventDefault(); this.goTo(this.step() + 1); }
    else if (key === 'k' || event.key === 'ArrowLeft') { event.preventDefault(); this.goTo(this.step() - 1); }
    else if (event.key === 'Escape') this.ctx.go(this.back());
  }
}
