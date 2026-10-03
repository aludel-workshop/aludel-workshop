import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Assignee, ProjectContext, WorkChange, WorkItem, WorkRun, WorkRunState } from './context';
import { AssigneeComponent, AvatarComponent, RefChipComponent, agentRunnable, batchOf, elapsed, isRunning, tokens } from './work-shared';

// WORK-ITEM-UX-01: what a run's status block says and offers, by state (the run actions table in the work record).
export const runTitle: Record<WorkRunState, string> = { working: 'Working', needs: 'Needs your answer', review: 'Run complete', failed: 'Failed', stopped: 'Stopped',
  accepted: 'Accepted', sent: 'Sent back', closed: 'Closed' };
export const runTone: Record<WorkRunState, string> = { working: 'live', needs: 'needs', review: 'review', failed: 'bad', stopped: 'bad', accepted: 'done', sent: 'past', closed: 'past' };
// Which change the review should open on, when it is entered from a row in Changes.
export const reviewFocus = signal<string | null>(null);
type Objective = { text: string; state: 'done' | 'now' | 'todo' | 'stuck'; note: string; took: string };

// The run's objectives: the agent's own plan when it reported one (WI-5); older runs fall back to their configured phases.
export function objectivesOf(run: WorkRun, nowMs: number): { list: Objective[]; source: 'agent' | 'phases' | 'none' } {
  const plan = [...run.steps].reverse().find(step => step.kind === 'plan');
  const finished = !['working', 'needs'].includes(run.state);
  if (plan?.objectives?.length) {
    const progress = run.steps.filter(step => step.kind === 'progress' && step.seq > plan.seq);
    const list = plan.objectives.map((text, index) => {
      const mine = progress.filter(step => step.index === index);
      const last = mine[mine.length - 1];
      const began = mine.find(step => step.status === 'active')?.at || mine[0]?.at;
      const ended = mine.find(step => step.status === 'done' || step.status === 'stuck')?.at;
      const state: Objective['state'] = last?.status === 'done' ? 'done' : last?.status === 'stuck' ? 'stuck' : last?.status === 'active' ? (finished ? 'stuck' : 'now') : 'todo';
      return { text, state, note: last?.note || '', took: began ? elapsed(began, ended ? Date.parse(ended) : finished ? Date.parse(run.finishedAt || began) : nowMs) : '' };
    });
    return { list, source: 'agent' };
  }
  const phases = run.live?.phases || [];
  if (phases.length) {
    const at = run.live?.phase ?? 0;
    return { list: phases.map((text, index) => ({ text, state: finished || index < at ? 'done' : index === at ? 'now' : 'todo', note: '', took: '' })), source: 'phases' };
  }
  return { list: [], source: 'none' };
}

@Component({
  selector: 'aludel-run-card', standalone: true, imports: [FormsModule, MatIconModule, MatTooltipModule, AvatarComponent, RefChipComponent],
  template: `
  @if (run(); as r) {
    <section [class]="'wi-status wi-tone-' + tone()" aria-label="Run status">
      <div class="wi-cta">
        <div class="wi-cta-text"><h2>@if (r.state === 'working') { <mat-icon aria-hidden="true" class="lay-spin">progress_activity</mat-icon> }{{ title() }}</h2>
          <p>{{ info() }}</p>
          @if (r.review.comment && r.review.outcome) { <q>{{ r.review.comment }}</q> }</div>
        <div class="wi-cta-btns">
          @switch (r.state) {
            @case ('working') {
              @if (r.performer.kind === 'person') { <button type="button" class="lay-button" (click)="submitOpen.set(true)"><mat-icon aria-hidden="true">rate_review</mat-icon>Ready for review</button> }
              @else if (r.turns.used >= r.turns.limit && !r.candidate && r.turns.limit < 12) { <button type="button" class="lay-button" (click)="authorizeMore()">Authorize three more turns</button> }
              <button type="button" class="lay-button ghost" (click)="stop()"><mat-icon aria-hidden="true">stop_circle</mat-icon>Stop</button> }
            @case ('needs') { <button type="button" class="lay-button ghost" (click)="stop()"><mat-icon aria-hidden="true">stop_circle</mat-icon>Stop</button> }
            @case ('review') {
              <button type="button" [class]="'lay-button ' + (flagCount() ? 'danger' : 'ghost wi-reject')" (click)="startSign('reject')"><mat-icon aria-hidden="true">reply</mat-icon>Reject@if (flagCount()) { <span class="wi-count">{{ flagCount() }} {{ flagCount() === 1 ? 'flag' : 'flags' }}</span> }</button>
              <button type="button" class="lay-button ghost" (click)="startSign('accept')"><mat-icon aria-hidden="true">check</mat-icon>Accept</button>
              <a class="lay-button" [href]="reviewLink()" (click)="ctx.go(reviewLink(), $event)"><mat-icon aria-hidden="true">rate_review</mat-icon>Review</a>
            }
            @case ('failed') { <button type="button" class="lay-button ghost" (click)="startSign('close')"><mat-icon aria-hidden="true">draw</mat-icon>Close run</button>
              <a class="lay-button" [href]="reviewLink()" (click)="ctx.go(reviewLink(), $event)"><mat-icon aria-hidden="true">troubleshoot</mat-icon>Review diagnosis</a> }
            @case ('stopped') { <button type="button" class="lay-button ghost" (click)="startSign('close')"><mat-icon aria-hidden="true">draw</mat-icon>Close run</button>
              <a class="lay-button" [href]="reviewLink()" (click)="ctx.go(reviewLink(), $event)"><mat-icon aria-hidden="true">troubleshoot</mat-icon>Review run</a> }
          }
        </div>
      </div>
      @if (r.state === 'needs' && item().question && !item().question?.answer) {
        <form class="wi-question" (ngSubmit)="answer()" aria-labelledby="run-question">
          <h3 id="run-question"><mat-icon aria-hidden="true">help</mat-icon>{{ item().question?.text }}</h3>
          @if (item().question?.recommendation) { <p class="small">{{ r.performer.label }} recommends <strong>{{ item().question?.recommendation }}</strong>. {{ item().question?.reasoning }}</p> }
          @if (item().question?.options?.length) {
            <div class="lay-options" role="radiogroup" aria-labelledby="run-question">@for (option of item().question?.options || []; track option; let index = $index) {
              <label class="lay-option" [for]="'run-option-' + index"><input type="radio" name="runAnswer" [id]="'run-option-' + index" [value]="option" [(ngModel)]="answerDraft"><span>{{ option }}</span></label> }</div>
          } @else { <label>Answer<input name="runAnswer" [(ngModel)]="answerDraft"></label> }
          <label>Why (saved with the decision)<textarea name="runWhy" rows="2" [(ngModel)]="whyDraft"></textarea></label>
          <label>Criteria for the next run<textarea name="runCriteria" rows="3" [(ngModel)]="answerCriteria"></textarea></label>
          <p class="small lay-muted">Change these when the answer changes scope. This run keeps the criteria it received; the next run gets the amendment.</p>
          <div class="lay-row lay-wrap"><button type="submit" class="lay-button" [disabled]="!answerDraft.trim()">Answer</button></div>
        </form>
      }
      @if (submitOpen() && r.performer.kind === 'person' && r.state === 'working') {
        <form class="wi-signoff" (ngSubmit)="submitPerson()">
          <h3><mat-icon aria-hidden="true">rate_review</mat-icon>Create the review packet</h3>
          <p class="small lay-muted">{{ editsSinceStart().length }} linked {{ editsSinceStart().length === 1 ? 'revision was' : 'revisions were' }} recorded during this run and will be included automatically.</p>
          @if (r.task.layerRepository) {
            <p class="small lay-muted">Submit a committed local branch from this layer's repository. It stays unmerged until review acceptance.</p>
            <label for="person-branch">Local branch</label><input id="person-branch" name="personBranch" [(ngModel)]="branchDraft" placeholder="work/my-change">
            <label for="person-commit">Exact commit</label><input id="person-commit" name="personCommit" [(ngModel)]="commitDraft" placeholder="Full commit SHA">
          }
          <label for="person-summary">What is ready for review</label><textarea id="person-summary" name="personSummary" rows="3" [(ngModel)]="summaryDraft" required></textarea>
          @for (criterion of r.task.criteria; track criterion.id) {
            <label [for]="'person-evidence-' + criterion.id">Evidence for {{ criterion.index + 1 }}. {{ criterion.text }}</label>
            <textarea [id]="'person-evidence-' + criterion.id" [name]="'personEvidence-' + criterion.id" rows="2" [(ngModel)]="evidenceDraft[criterion.id]" placeholder="What should the reviewer inspect?"></textarea>
            @if (criterion.kind === 'journey' || criterion.covers === 'journeys') {
              <label [for]="'person-reason-' + criterion.id">If its step tests won't pass yet, say why (optional)</label>
              <textarea [id]="'person-reason-' + criterion.id" [name]="'personReason-' + criterion.id" rows="2" [(ngModel)]="reasonDraft[criterion.id]" placeholder="Without a reason, review can't accept this run while a claimed step fails."></textarea>
            }
          }
          <div class="lay-row lay-wrap"><button type="submit" class="lay-button" [disabled]="!summaryDraft.trim()">Submit for review</button><button type="button" class="lay-button ghost" (click)="submitOpen.set(false)">Cancel</button></div>
        </form>
      }
      @if (signing(); as kind) {
        <div class="wi-signoff" role="group" [attr.aria-label]="signTitle()">
          <h3><mat-icon aria-hidden="true">draw</mat-icon>{{ signTitle() }}</h3>
          @if (kind === 'accept' && (flagCount() || unchecked())) { <p class="wi-warn"><mat-icon aria-hidden="true">warning</mat-icon>
            {{ flagCount() ? flagCount() + (flagCount() === 1 ? ' flag' : ' flags') + ' will be dropped. ' : '' }}{{ unchecked() ? 'You haven\\'t checked ' + unchecked() + ' of ' + r.task.criteria.length + ' claims yourself. ' : '' }}Accept anyway?</p> }
          @if (flags().length) { <ul class="wi-flaglist">@for (flag of flags(); track flag.label) { <li><mat-icon aria-hidden="true">flag</mat-icon><span><strong>{{ flag.label }}</strong>@if (flag.note) { : {{ flag.note }} }</span></li> }</ul> }
          <p class="small lay-muted">{{ signHelp() }}</p>
          <label for="sign-comment">Overall comment (optional)</label>
          <textarea id="sign-comment" rows="2" [(ngModel)]="comment" [placeholder]="kind === 'accept' ? 'Anything to note for the record' : 'What should the next run do differently?'"></textarea>
          <div class="lay-row lay-wrap"><button type="button" [class]="'lay-button ' + (kind === 'accept' ? 'lay-button-ok' : kind === 'reject' ? 'danger' : '')" (click)="sign(kind)"><mat-icon aria-hidden="true">draw</mat-icon>{{ kind === 'accept' ? 'Sign and accept' : kind === 'reject' ? 'Sign and send back' : 'Sign and close' }}</button>
            <button type="button" class="lay-button ghost" (click)="signing.set(null)">Cancel</button></div>
        </div>
      }
      <div class="wi-actor">
        <span class="wi-who" tabindex="0"><aludel-avatar [who]="{ kind: r.performer.kind, id: r.performer.id }" size="md" /><strong>{{ r.performer.label }}</strong>
          <span class="wi-hovercard" role="tooltip"><strong>{{ r.performer.label }}</strong>@if (r.performer.kind === 'agent') { <span>Model {{ r.performer.model || 'account default' }}</span><span>{{ r.performer.effort || 'Default' }} effort</span><span>{{ r.turns.used }} of {{ r.turns.limit }} turns used</span><span>Instructions pinned at Go</span> } @else { <span>Person run</span><span>Task pinned when work started</span><span>No agent telemetry</span> }</span></span>
        <span class="lay-muted small">Run {{ r.number }} · started {{ when(r.startedAt) }}</span>
      </div>
      <div class="wi-progress">
        <div class="wi-bar-row"><div class="wi-bar" role="progressbar" [attr.aria-valuenow]="pct()" aria-valuemin="0" aria-valuemax="100" aria-label="Objectives done"><i [style.width.%]="pct()"></i></div>
          <span class="wi-stats"><strong>{{ duration() }}</strong>@if (usage()) { · <strong>{{ usage() }}</strong> tokens }</span></div>
        <div class="wi-obj-row"><span class="wi-obj-now">{{ current() }}</span>
          @if (objectives().list.length) { <button type="button" class="wi-obj-toggle" [attr.aria-expanded]="open()" (click)="open.set(!open())">{{ doneCount() }} of {{ objectives().list.length }} objectives<mat-icon aria-hidden="true">{{ open() ? 'expand_less' : 'expand_more' }}</mat-icon></button> }</div>
        @if (open()) {
          <ol class="wi-objs">@for (objective of objectives().list; track $index) {
            <li [class]="'wi-obj-' + objective.state"><mat-icon aria-hidden="true">{{ objective.state === 'done' ? 'check_circle' : objective.state === 'now' ? 'progress_activity' : objective.state === 'stuck' ? 'warning' : 'radio_button_unchecked' }}</mat-icon>
              <span>{{ objective.text }}@if (objective.note) { <small>{{ objective.note }}</small> }</span><span class="wi-took">{{ objective.took }}</span></li> }</ol>
          @if (objectives().source === 'phases') { <p class="small lay-muted">This run reported no plan of its own; these are the action's configured phases.</p> }
          @if (r.performer.kind === 'agent') { <button type="button" class="lay-link-button small" (click)="logOpen.set(!logOpen())"><mat-icon aria-hidden="true">terminal</mat-icon>{{ logOpen() ? 'Hide the agent log' : 'Open the agent log' }}</button> }
          @if (logOpen()) {
            <ol class="wi-log">@for (line of log(); track $index) { <li><time>{{ clock(line.at) }}</time><span>{{ line.text }}</span></li> }
              @empty { <li class="lay-muted">This run reported no log lines.</li> }</ol>
          }
        }
      </div>
    </section>

    <details class="wi-sec" open><summary><mat-icon aria-hidden="true">assignment</mat-icon><span>Task</span><small>What run {{ r.number }} was given</small><mat-icon aria-hidden="true" class="wi-chev">expand_more</mat-icon></summary>
      <div class="wi-sec-body">
        <p class="lay-prose">{{ r.task.request || actionText() }}</p>
        <p class="small lay-muted"><strong>Action:</strong> {{ actionName() }} · {{ actionText() }}</p>
        @if (r.summary) { <div class="wi-carried"><h3>Performer summary</h3><p>{{ r.summary }}</p></div> }
        @if (r.task.targets.length) { <div class="lay-refs"><span class="small lay-muted">Works on</span>@for (target of r.task.targets; track target.id) { <aludel-ref [id]="target.id" [fallback]="target.label" /> }</div> }
        @if (r.task.carried.length || r.task.carriedComment) {
          <div class="wi-carried"><h3>Carried in from the previous run</h3><ul>
            @if (r.task.carriedComment) { <li>Comment: “{{ r.task.carriedComment }}”</li> }
            @for (note of r.task.carried; track $index) { <li><strong>{{ note.check }}</strong>: {{ note.note }}</li> }</ul></div>
        }
      </div></details>
    <details class="wi-sec"><summary><mat-icon aria-hidden="true">fact_check</mat-icon><span>Criteria</span><small>{{ criteriaSummary() }}</small><mat-icon aria-hidden="true" class="wi-chev">expand_more</mat-icon></summary>
      <div class="wi-sec-body"><ol class="wi-crits">@for (criterion of r.task.criteria; track criterion.id) {
        <li><span [class]="'wi-num wi-v-' + (r.review.verdicts[criterion.id]?.value || 'none')">@switch (r.review.verdicts[criterion.id]?.value) { @case ('accept') { <mat-icon aria-label="Accepted">check</mat-icon> } @case ('reject') { <mat-icon aria-label="Flagged">flag</mat-icon> } @default { {{ criterion.index + 1 }} } }</span>
          <div><span>{{ criterion.text }}</span> <small class="lay-muted">{{ criterion.backed ? criterion.kind : 'note · unbacked' }}@if (r.proofs[criterion.id]; as proof) { · step tests {{ proof.status === 'passed' ? 'passed' : proof.status.replace('-', ' ') }} }</small>@if (criterion.source) { <div class="lay-refs"><aludel-ref [id]="criterion.source.id" /></div> }
            @if (r.review.verdicts[criterion.id]?.value === 'reject' && r.review.verdicts[criterion.id]?.note) { <p class="wi-flagnote"><mat-icon aria-hidden="true">subdirectory_arrow_right</mat-icon>{{ r.review.verdicts[criterion.id]?.note }}</p> }</div></li>
      } @empty { <li class="lay-muted">Run {{ r.number }} was given no claims.</li> }</ol></div></details>
    <details class="wi-sec"><summary><mat-icon aria-hidden="true">difference</mat-icon><span>Changes</span><small>{{ changeSummary() }}</small><mat-icon aria-hidden="true" class="wi-chev">expand_more</mat-icon></summary>
      <div class="wi-sec-body">
        <ul class="wi-changes">@for (change of r.changes; track change.id) {
          <li><div class="wi-change"><mat-icon aria-hidden="true">{{ change.icon }}</mat-icon>
              <a class="wi-change-name" [href]="reviewLink()" (click)="reviewFocus.set(change.id); ctx.go(reviewLink(), $event)">{{ change.name }}</a>
              <span [class]="'wi-op wi-op-' + change.op">{{ opLabel[change.op] }}@if (change.size) { · {{ change.size }} }</span>
              @if (r.state === 'review') { <button type="button" class="wi-flag" [class.on]="r.review.flags[change.id] !== undefined" (click)="toggleFlag(change.id)" [attr.aria-label]="(r.review.flags[change.id] !== undefined ? 'Remove the flag from ' : 'Flag ') + change.name" [matTooltip]="r.review.flags[change.id] !== undefined ? 'Remove flag' : 'Flag this change'"><mat-icon aria-hidden="true">flag</mat-icon></button> }
              @else if (r.review.flags[change.id] !== undefined) { <mat-icon class="wi-flag on" aria-label="Flagged">flag</mat-icon> } @else { <span></span> }</div>
            @if (r.review.flags[change.id] !== undefined) {
              @if (r.state === 'review') { <div class="wi-flagnote"><mat-icon aria-hidden="true">subdirectory_arrow_right</mat-icon><label class="visually-hidden" [for]="'flag-' + change.id">What's wrong with {{ change.name }}</label>
                <input [id]="'flag-' + change.id" [value]="r.review.flags[change.id]" (change)="saveFlag(change.id, $any($event.target).value)" placeholder="What's wrong with this change?"></div> }
              @else if (r.review.flags[change.id]) { <p class="wi-flagnote"><mat-icon aria-hidden="true">subdirectory_arrow_right</mat-icon>{{ r.review.flags[change.id] }}</p> }
            }</li>
        } @empty { <li class="lay-muted small">Run {{ r.number }} {{ ['working', 'needs'].includes(r.state) ? 'has not submitted anything yet' : 'submitted no changes' }}.</li> }</ul>
        @if (r.changes.length) { <p class="small lay-muted wi-applied"><mat-icon aria-hidden="true">info</mat-icon>{{ r.performer.kind === 'person' && !r.layerSource
          ? 'These linked revisions were recorded while the person worked; acceptance signs them off.'
          : r.state === 'accepted' ? 'Applied when the run was accepted.' : r.state === 'review' ? 'Nothing is applied until you accept this run.' : 'Not applied. Kept here and passed to the next run as context.' }}</p> }
      </div></details>
  }`
})
export class RunCardComponent {
  readonly ctx = inject(ProjectContext);
  readonly item = input.required<WorkItem>();
  readonly run = input.required<WorkRun>();
  readonly edits = input<WorkChange[]>([]);
  readonly changed = output<void>();
  readonly opLabel = { created: 'Created', modified: 'Modified', removed: 'Removed' };
  readonly open = signal(false);
  readonly logOpen = signal(false);
  readonly signing = signal<'accept' | 'reject' | 'close' | null>(null);
  readonly submitOpen = signal(false);
  comment = ''; answerDraft = ''; whyDraft = ''; answerCriteria = ''; summaryDraft = ''; branchDraft = ''; commitDraft = ''; evidenceDraft: Record<string, string> = {}; reasonDraft: Record<string, string> = {};
  readonly tone = computed(() => runTone[this.run().state]);
  readonly title = computed(() => runTitle[this.run().state]);
  readonly objectives = computed(() => objectivesOf(this.run(), this.ctx.now()));
  readonly doneCount = computed(() => this.objectives().list.filter(objective => objective.state === 'done').length);
  readonly pct = computed(() => { const list = this.objectives().list; const r = this.run();
    if (['review', 'accepted', 'sent'].includes(r.state)) return 100;
    if (['failed', 'stopped', 'closed'].includes(r.state)) return list.length ? Math.round((this.doneCount() / list.length) * 100) : 0;
    return list.length ? Math.round(((this.doneCount() + (list.some(objective => objective.state === 'now') ? 0.5 : 0)) / list.length) * 100) : 8; });
  readonly current = computed(() => { const r = this.run(); const list = this.objectives().list;
    if (['working', 'needs'].includes(r.state)) return list.find(objective => objective.state === 'now')?.text || r.live?.activity || (r.performer.kind === 'person' ? 'Work in progress' : 'Getting started');
    const stuck = list.find(objective => objective.state === 'stuck');
    return stuck ? `Stopped at: ${stuck.text}` : list.length ? `Finished ${this.doneCount()} of ${list.length} objectives` : 'No objectives reported'; });
  readonly duration = computed(() => { const r = this.run(); return elapsed(r.startedAt, r.finishedAt ? Date.parse(r.finishedAt) : this.ctx.now()) || '0m'; });
  readonly usage = computed(() => { const value = this.run().live?.usage; return value ? tokens(value.input + value.output) : ''; });
  readonly info = computed(() => {
    const r = this.run();
    switch (r.state) {
      case 'working': if (r.performer.kind === 'person') return r.task.layerRepository ? 'The task and repository base are pinned. Commit your changes on a local branch, then submit it for review.' : 'The task snapshot is pinned. Record linked changes from this item, then create a review packet.';
        if (r.turns.used >= r.turns.limit && !r.candidate) return `This authorization has no turns left (${r.turns.used} of ${r.turns.limit}). No further turn starts until you authorize more.`;
        return r.live?.activity ? `${r.live.activity}…` : 'Nothing is applied while it runs. When it submits, this becomes ready for review.';
      case 'needs': return `${r.performer.label} paused on a question. Your answer can amend the next run's criteria.`;
      case 'review': return r.performer.kind === 'person' && !r.layerSource
        ? `${r.performer.label} submitted a review packet with ${r.changes.length} linked ${r.changes.length === 1 ? 'change' : 'changes'}. The revisions are already recorded; acceptance signs off the run.`
        : `${r.performer.label} submitted ${r.changes.length} ${r.changes.length === 1 ? 'change' : 'changes'} for ${r.task.criteria.length} ${r.task.criteria.length === 1 ? 'claim' : 'claims'}. Nothing is applied until you accept.`;
      case 'failed': return r.blockReason ? `${r.blockReason} Close the run to reopen the task.` : 'The run could not finish. Close it to reopen the task.';
      case 'stopped': return 'The run stopped before it submitted. Close it to reopen the task.';
      default: return r.review.signedBy ? `Signed by ${r.review.signedBy} · ${this.when(r.review.signedAt || '')}` : r.state === 'accepted' ? 'Accepted before run signatures were recorded.' : 'Sent back before run signatures were recorded.';
    }
  });
  readonly flags = computed(() => { const r = this.run();
    const criteria = Object.entries(r.review.verdicts).filter(([, verdict]) => verdict.value === 'reject').map(([id, verdict]) => ({ label: r.task.criteria.find(claim => claim.id === id)?.text || id, note: verdict.note }));
    const changes = Object.entries(r.review.flags).map(([id, note]) => ({ label: r.changes.find(change => change.id === id)?.name || id, note }));
    return [...criteria, ...changes]; });
  readonly flagCount = computed(() => this.flags().length);
  readonly unchecked = computed(() => { const r = this.run(); return r.task.criteria.filter(criterion => !r.review.verdicts[criterion.id] || r.review.verdicts[criterion.id].value === 'skip').length; });
  readonly criteriaSummary = computed(() => { const r = this.run(); const values = Object.values(r.review.verdicts);
    const accepted = values.filter(value => value.value === 'accept').length, flagged = values.filter(value => value.value === 'reject').length;
    return `${r.task.criteria.length} ${r.task.criteria.length === 1 ? 'claim' : 'claims'}${accepted ? ` · ${accepted} accepted` : ''}${flagged ? ` · ${flagged} flagged` : ''}`; });
  readonly changeSummary = computed(() => { const r = this.run(); if (!r.changes.length) return 'No changes';
    const count = (op: string) => r.changes.filter(change => change.op === op).length;
    const flagged = Object.keys(r.review.flags).length;
    return [count('created') && `${count('created')} created`, count('modified') && `${count('modified')} modified`, count('removed') && `${count('removed')} removed`, flagged && `${flagged} flagged`].filter(Boolean).join(' · '); });
  readonly signTitle = computed(() => { const kind = this.signing(); const n = this.run().number; return kind === 'accept' ? `Accept run ${n}` : kind === 'reject' ? `Send back run ${n}` : `Close run ${n}`; });
  readonly signHelp = computed(() => this.signing() === 'accept'
    ? this.run().performer.kind === 'person' && !this.run().layerSource ? `Signs off the recorded work and closes ${this.item().ref}. Your signature and comment are kept with it.`
      : `Applies ${this.run().changes.length === 1 ? 'its change' : `its ${this.run().changes.length} changes`} and closes ${this.item().ref}. Your signature and comment are kept with it.`
    : 'Nothing is applied. The changes, your flags and your comment stay on this run and go to the next run as context. The task opens again as Next run.');
  readonly log = computed(() => this.run().steps.map(step => ({ at: step.at, text: step.kind === 'plan' ? `Planned ${step.objectives?.length || 0} objectives`
    : step.kind === 'progress' ? `${step.status === 'done' ? 'Finished' : step.status === 'stuck' ? 'Stuck on' : 'Started'} “${this.objectives().list[step.index ?? -1]?.text || 'an objective'}”${step.note ? `: ${step.note}` : ''}` : step.text || '' })));
  readonly actionText = computed(() => this.ctx.actionById().get(this.run().task.action || '')?.description || this.run().task.title);
  readonly actionName = computed(() => this.ctx.actionById().get(this.run().task.action || '')?.name || this.run().task.action || this.run().task.title);
  readonly editsSinceStart = computed(() => this.edits().filter(edit => edit.createdAt >= this.run().startedAt));

  constructor() {
    effect(() => { const r = this.run(); untracked(() => {
      if (r.state !== 'review') this.signing.set(null);
      if (!this.answerDraft) this.answerDraft = this.item().question?.recommendation || '';
      if (!this.answerCriteria) this.answerCriteria = this.item().checks.filter(check => !check.backed).map(check => check.text).join('\n');
    }); });
  }

  readonly reviewFocus = reviewFocus;
  reviewLink() { return this.ctx.link('work', 'item', this.item().id, 'review', String(this.run().number)); }
  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/work/${encodeURIComponent(this.item().id)}/runs/${encodeURIComponent(this.run().id)}`; }
  private review(body: unknown) { void this.ctx.write(async () => { await this.ctx.api(this.base() + '/review', 'PUT', body); this.changed.emit(); }); }
  toggleFlag(id: string) { this.review({ flag: { id, on: this.run().review.flags[id] === undefined, note: '' } }); }
  saveFlag(id: string, note: string) { this.review({ flag: { id, note } }); }
  startSign(kind: 'accept' | 'reject' | 'close') { this.comment = ''; this.signing.set(kind); }
  sign(kind: 'accept' | 'reject' | 'close') {
    const n = this.run().number;
    void this.ctx.write(async () => { await this.ctx.api(this.base() + '/sign', 'POST', { outcome: kind, comment: this.comment }); this.signing.set(null); this.changed.emit(); },
      kind === 'accept' ? this.run().performer.kind === 'person' && !this.run().layerSource ? `Run ${n} accepted and signed off.` : `Run ${n} accepted and applied.`
        : kind === 'reject' ? `Run ${n} sent back. The task is open again in Next run.` : `Run ${n} closed. The task is open again in Next run.`);
  }
  // A coding run that used its turns waits here; more turns stay on the same pinned task.
  authorizeMore() { void this.ctx.write(async () => { await this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/agents/symphony-runs`, 'POST', { workId: this.item().id, expectedRunLimit: this.run().turns.limit }); this.changed.emit(); },
    `${this.item().ref}: three more turns authorized on the same pinned task.`); }
  stop() { void this.ctx.write(async () => {
    if (this.run().performer.kind === 'person') await this.ctx.api(this.base() + '/stop', 'POST', {});
    else await this.ctx.updateWork(this.item().id, { stop: true });
    this.changed.emit();
  }, `Stopping ${this.item().ref}.`); }
  submitPerson() { const evidence = Object.entries(this.evidenceDraft).map(([claim, note]) => ({ claim, note: note?.trim() })).filter(entry => entry.note);
    const reasons = Object.fromEntries(Object.entries(this.reasonDraft).map(([claim, reason]) => [claim, reason?.trim()]).filter(([, reason]) => reason));
    void this.ctx.write(async () => { await this.ctx.api(this.base() + '/submit', 'POST', { summary: this.summaryDraft, evidence, reasons, ...(this.branchDraft.trim() ? { source: { branch: this.branchDraft.trim(), commit: this.commitDraft.trim() } } : {}) }); this.submitOpen.set(false); this.changed.emit(); }, 'Ready for review.'); }
  answer() { const criteriaAmendment = this.answerCriteria.split('\n').map(value => value.trim()).filter(Boolean);
    void this.ctx.write(async () => { await this.ctx.updateWork(this.item().id, { answer: this.answerDraft, rationale: this.whyDraft, criteriaAmendment }); this.changed.emit(); }, 'Answered and updated the next run.'); }
  when(at: string) { const date = new Date(at); return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${date.toTimeString().slice(0, 5)}`; }
  clock(at: string) { return new Date(at).toTimeString().slice(0, 8); }
}

// The run that hasn't started yet (G1): its assignee, and a task and criteria that stay editable until Go pins them.
@Component({
  selector: 'aludel-next-run', standalone: true, imports: [FormsModule, MatIconModule, MatTooltipModule, AssigneeComponent, RefChipComponent],
  template: `
  @if (item(); as work) {
    <section [class]="'wi-status wi-tone-' + (work.status === 'blocked' ? 'bad' : 'draft')" aria-label="Next run">
      <div class="wi-cta">
        <div class="wi-cta-text"><h2>{{ title() }}</h2><p>{{ info() }}</p></div>
        <div class="wi-cta-btns">
          @if (work.status === 'staged' && !pinned()) { <button type="button" class="lay-button ghost" (click)="update({ stage: false }, work.ref + ' unstaged.')">Unstage</button> }
          @if (work.status === 'staged' && pinned()) { <button type="button" class="lay-button ghost" (click)="update({ stop: true }, 'Stopping ' + work.ref + '.')"><mat-icon aria-hidden="true">stop_circle</mat-icon>Stop</button> }
          @if (work.status === 'blocked') {
            @if (work.context?.executionBlock?.recovery === 'deploy') { <a class="lay-button ghost" [href]="ctx.link('deploy', 'agents')">Open Deploy</a> }
            @else if (work.context?.executionBlock?.recovery === 'agents') { <a class="lay-button ghost" [href]="ctx.link('work', 'agents')">Manage agent</a> }
          }
        </div>
      </div>
      @if (work.question && !work.question.answer) {
        <form class="wi-question" (ngSubmit)="answer()" aria-labelledby="next-question">
          <h3 id="next-question"><mat-icon aria-hidden="true">help</mat-icon>{{ work.question.text }}</h3>
          @if (work.question.options.length) {
            <div class="lay-options" role="radiogroup" aria-labelledby="next-question">@for (option of work.question.options; track option; let index = $index) {
              <label class="lay-option" [for]="'next-option-' + index"><input type="radio" name="nextAnswer" [id]="'next-option-' + index" [value]="option" [(ngModel)]="answerDraft"><span>{{ option }}</span></label> }</div>
          } @else { <label>Answer<input name="nextAnswer" [(ngModel)]="answerDraft"></label> }
          <label>Why (saved with the decision)<textarea name="nextWhy" rows="2" [(ngModel)]="whyDraft"></textarea></label>
          <div class="lay-row lay-wrap"><button type="submit" class="lay-button" [disabled]="!answerDraft.trim()">Answer</button></div>
        </form>
      }
      <div class="wi-actor"><span class="small lay-muted">Assigned to</span><aludel-assignee [assignee]="work.assignee" [locked]="lockReason()" (changed)="reassign($event)" />
        @if (work.assignee?.kind === 'agent' && !agentRunnable(work, ctx) && work.status !== 'done') { <span class="small lay-muted">Agents can't run “{{ actionName() }}” yet.</span> }</div>
    </section>

    <details class="wi-sec" open><summary><mat-icon aria-hidden="true">assignment</mat-icon><span>Task</span><small>{{ editable() ? 'Editable until Go' : 'Pinned for the next run' }}</small><mat-icon aria-hidden="true" class="wi-chev">expand_more</mat-icon></summary>
      <div class="wi-sec-body">
        @if (editable()) {
          <label class="visually-hidden" for="next-request">Request</label>
          <textarea id="next-request" class="wi-request" rows="3" [(ngModel)]="request" (ngModelChange)="dirty.set(true)" [placeholder]="actionText()"></textarea>
        } @else { <p class="lay-prose">{{ work.context?.suggestion || actionText() }}</p> }
        @if (work.targets.length) { <div class="lay-refs"><span class="small lay-muted">Works on</span>@for (target of work.targets; track target.id) { <aludel-ref [id]="target.id" [fallback]="target.label" /> }</div> }
        @if (work.context?.feedback?.length || work.context?.reviewComment) {
          <div class="wi-carried"><h3>Carried in from the last run</h3><ul>
            @if (work.context.reviewComment) { <li>Comment: “{{ work.context.reviewComment }}”</li> }
            @for (note of work.context.feedback || []; track $index) { <li><strong>{{ note.check }}</strong>: {{ note.note }}</li> }</ul></div>
        }
        @if (openTargets().length && work.assignee?.kind === 'person' && work.status !== 'done') {
          <p class="lay-muted small">Doing it yourself? Edit
            @for (target of openTargets(); track target.id; let last = $last) { <button type="button" class="lay-link-button" (click)="workOn(target.id)">{{ ctx.refInfo(target.id)?.label || target.label }}</button>{{ last ? '' : ', ' }} }
            from here and the change counts for {{ work.ref }}.</p>
        }
      </div></details>
    <details class="wi-sec" [open]="editable()"><summary><mat-icon aria-hidden="true">fact_check</mat-icon><span>Criteria</span><small>{{ criteria.length }} {{ criteria.length === 1 ? 'criterion' : 'criteria' }}{{ editable() ? ' · editable' : '' }}</small><mat-icon aria-hidden="true" class="wi-chev">expand_more</mat-icon></summary>
      <div class="wi-sec-body">
        @if (backed().length) { <ol class="wi-crits">@for (claim of backed(); track claim.id) {
          <li><span class="wi-num wi-v-none"><mat-icon aria-hidden="true">{{ claim.kind === 'journey' ? 'route' : claim.kind === 'record' ? 'link' : 'rule' }}</mat-icon></span><span>{{ claim.text }} <small class="lay-muted">{{ claim.kind }} · edited in its layer</small></span></li> }</ol> }
        <ol class="wi-crits">@for (criterion of criteria; track $index; let index = $index) {
          <li><span class="wi-num wi-v-none">{{ index + 1 }}</span>
            @if (editable()) { <label class="visually-hidden" [for]="'criterion-' + index">Criterion {{ index + 1 }}</label>
              <input class="wi-crit-input" [id]="'criterion-' + index" [(ngModel)]="criteria[index]" (ngModelChange)="dirty.set(true)">
              <button type="button" class="lay-xbutton" (click)="removeCriterion(index)" [attr.aria-label]="'Remove criterion ' + (index + 1)"><mat-icon aria-hidden="true">close</mat-icon></button> }
            @else { <span>{{ criterion }}</span> }</li>
        } @empty { <li class="lay-muted small">No criteria yet. Add what must be true for this work to be accepted.</li> }</ol>
        @if (editable()) { <button type="button" class="lay-link-button small" (click)="addCriterion()"><mat-icon aria-hidden="true">add</mat-icon>Add a criterion</button> }
        <p class="small lay-muted">Criteria are fixed for a run when you press Go. A run can add or question a criterion, but not remove or weaken one.</p>
      </div></details>
    @if (edits().length) {
      <details class="wi-sec"><summary><mat-icon aria-hidden="true">difference</mat-icon><span>Changes</span><small>{{ edits().length }} {{ edits().length === 1 ? 'revision' : 'revisions' }} made from {{ work.ref }}</small><mat-icon aria-hidden="true" class="wi-chev">expand_more</mat-icon></summary>
        <div class="wi-sec-body"><ul class="wi-changes">@for (edit of edits(); track edit.recordId + edit.revision) {
          <li><div class="wi-change"><mat-icon aria-hidden="true">edit_note</mat-icon><span class="wi-change-name"><aludel-ref [id]="edit.recordId" [fallback]="'Deleted record'" /></span>
            <span [class]="'wi-op wi-op-' + (edit.revision === 1 ? 'created' : 'modified')">{{ edit.revision === 1 ? 'Created' : 'Modified' }} · revision {{ edit.revision }} · {{ edit.author }}</span><span></span></div></li> }</ul></div></details>
    }
    @if (dirty() && editable()) {
      <div class="wi-savebar"><span class="small">Unsaved changes to the next run's task.</span><button type="button" class="lay-button ghost" (click)="reset()">Discard</button><button type="button" class="lay-button" (click)="save()">Save task</button></div>
    }
  }`
})
export class NextRunComponent {
  readonly ctx = inject(ProjectContext);
  readonly item = input.required<WorkItem>();
  readonly edits = input<WorkChange[]>([]);
  readonly changed = output<void>();
  readonly agentRunnable = agentRunnable;
  readonly dirty = signal(false);
  request = ''; criteria: string[] = []; answerDraft = ''; whyDraft = '';
  private loadedFor = '';
  readonly batch = computed(() => batchOf(this.ctx, this.item()));
  readonly pinned = computed(() => { const batch = this.batch(); return Boolean(batch && (isRunning(batch) || batch.state === 'queued')); });
  readonly editable = computed(() => ['backlog', 'queued', 'staged', 'blocked'].includes(this.item().status) && !this.pinned());
  readonly actionName = computed(() => this.ctx.actionById().get(this.item().action || '')?.name || this.item().type);
  readonly actionText = computed(() => this.ctx.actionById().get(this.item().action || '')?.description || this.actionName());
  readonly openTargets = computed(() => this.item().targets.filter(target => ['story', 'spec', 'page', 'data_object', 'data_operation'].includes(target.kind)));
  readonly lockReason = computed(() => this.pinned() ? 'Locked in while its batch runs' : this.item().status === 'done' ? 'Done' : null);
  readonly title = computed(() => { const work = this.item();
    if (work.status === 'backlog') return 'Backlog';
    if (work.status === 'blocked') return work.blockedBy.length ? 'Blocked' : 'Can\'t start';
    if (work.status === 'staged') return this.pinned() ? 'Waiting for a worker' : `Staged in ${this.batch()?.ref || 'a batch'}`;
    if (work.status === 'needs') return 'Needs your answer';
    return 'Next run'; });
  readonly info = computed(() => { const work = this.item();
    if (work.status === 'backlog') return 'Queue it when it should be worked on. You can shape the task and criteria now.';
    if (work.status === 'blocked') return work.context?.executionBlock?.reason || `Blocked by ${work.blockedBy.map(id => this.ctx.workById().get(id)?.ref).join(', ')}.`;
    if (work.status === 'staged' && this.pinned()) return 'Go pinned this task. It becomes a run tab when a worker picks it up.';
    if (work.status === 'staged') return 'Editable until you press Go on the batch.';
    return 'Shape the task and criteria, then stage it. They are fixed for the run when you press Go.'; });

  constructor() {
    effect(() => { const work = this.item(); const key = `${work.id}:${work.updatedAt}`;
      untracked(() => { if (key === this.loadedFor || this.dirty()) return; this.loadedFor = key; this.reset(); this.answerDraft = work.question?.recommendation || ''; }); });
  }

  // JOURNEYS-01 J4: backed claims come from the layer entries they reference; only free-text notes are edited here.
  readonly backed = computed(() => this.item().checks.filter(check => check.backed));
  reset() { const work = this.item(); this.request = work.context?.suggestion || ''; this.criteria = work.checks.filter(check => !check.backed).map(check => check.text); this.dirty.set(false); }
  addCriterion() { this.criteria = [...this.criteria, '']; this.dirty.set(true); setTimeout(() => document.getElementById(`criterion-${this.criteria.length - 1}`)?.focus()); }
  removeCriterion(index: number) { this.criteria = this.criteria.filter((_, position) => position !== index); this.dirty.set(true); }
  save() {
    const criteria = this.criteria.map(value => value.trim()).filter(Boolean);
    void this.ctx.write(async () => { await this.ctx.updateWork(this.item().id, { task: { request: this.request, criteria } }); this.dirty.set(false); this.changed.emit(); }, 'Task saved for the next run.');
  }
  update(body: unknown, success: string) { void this.ctx.write(async () => { await this.ctx.updateWork(this.item().id, body); this.changed.emit(); }, success); }
  reassign(assignee: Assignee) { this.update({ assignee }, `${this.item().ref} now goes to ${this.ctx.whoName(assignee)}.`); }
  answer() { this.update({ answer: this.answerDraft, rationale: this.whyDraft }, 'Answered.'); }
  workOn(targetId: string) { const info = this.ctx.refInfo(targetId); this.ctx.workOn(this.item()); if (info) this.ctx.go(info.href); }
}
