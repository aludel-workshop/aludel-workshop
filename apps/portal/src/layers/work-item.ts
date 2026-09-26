import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Assignee, ProjectContext, WorkChange, WorkItem, layerLabel, priorityIcon, priorityLabel, priorityOrder, workStatusLabel } from './context';
import { AssigneeComponent, AvatarComponent, PriorityComponent, RefChipComponent, RoleChipComponent, agentRunnable, batchOf, elapsed, isRunning, tokens } from './work-shared';

interface CodingAttempt { id: string; state: string; runsStarted: number; runLimit: number; candidateId: string | null; updatedAt: string; }
interface CodeCandidate { id: string; state: string; base: string; commit: string | null; files: string[]; checks: { name: string; status: string; detail: string; source?: string }[]; createdAt: string; workspaceOwner: string; }

interface ReconcileContext { recordId: string; fromRevision: number; toRevision: number; changes: { field: string; before: unknown; after: unknown }[];
  units: { id: string; symbol: string; path: string; kind: string; calls: string[]; calledBy: string[] }[]; tests: string[]; }

// A work item, structured like a Jira issue with the knowledge around it (A2): the agent's run, the review checklist,
// what to do, when it's done, what changed and the activity, with details, links and linked knowledge alongside.
@Component({
  selector: 'aludel-work-item', standalone: true, imports: [FormsModule, MatIconModule, MatMenuModule, MatTooltipModule, AssigneeComponent, AvatarComponent, PriorityComponent, RefChipComponent, RoleChipComponent],
  template: `
  @if (item(); as work) {
    <p class="lay-eyebrow"><a [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)">Work</a> › {{ work.ref }}</p>
    <div class="lay-item-head">
      <div class="lay-item-titles"><h1 tabindex="-1">{{ work.title }}</h1>
        <div class="lay-item-meta"><aludel-priority [value]="work.priority" /><span [class]="'lay-st lay-st-' + work.status">{{ statusLabel[work.status] }}</span>
          <aludel-role-chip [layer]="work.layer" [action]="work.action" /><aludel-assignee [assignee]="work.assignee" [locked]="lock()" (changed)="reassign($event)" />
          @for (blocker of work.blockedBy; track blocker) { <span class="lay-blocked"><mat-icon aria-hidden="true">block</mat-icon>Blocked by</span><aludel-ref [id]="blocker" /> }
          @if (work.context?.executionBlock; as block) { <span class="lay-blocked"><mat-icon aria-hidden="true">block</mat-icon>{{ block.reason }}</span> }</div></div>
      <div class="lay-row lay-wrap">
        @switch (work.status) {
          @case ('backlog') { <button type="button" class="lay-button" (click)="update({ state: 'ready' }, work.ref + ' queued.')"><mat-icon aria-hidden="true">add</mat-icon>Queue</button> }
          @case ('queued') { <button type="button" class="lay-button" (click)="update({ stage: true }, work.ref + ' staged.')" [disabled]="!!stageBlock()" [matTooltip]="stageBlock() || ''"><mat-icon aria-hidden="true">playlist_add</mat-icon>Stage in {{ work.assignee?.kind === 'agent' ? ctx.whoName(work.assignee) + '\\'s batch' : 'your batch' }}</button> }
          @case ('staged') {
            @if (running()) { <button type="button" class="lay-button ghost" (click)="update({ skip: !work.context?.skip }, work.context?.skip ? 'Back in this run.' : 'Skipped for this run.')"><mat-icon aria-hidden="true">{{ work.context?.skip ? 'lock_open' : 'lock' }}</mat-icon>{{ work.context?.skip ? 'Include in this run' : 'Skip this run' }}</button> }
            @else { <button type="button" class="lay-button ghost" (click)="update({ stage: false }, work.ref + ' unstaged.')">Unstage</button>
              @if (work.assignee?.kind === 'person') { <button type="button" class="lay-button" (click)="update({ state: 'done' }, work.ref + ' done.')"><mat-icon aria-hidden="true">check</mat-icon>Mark done</button> } }
          }
          @case ('blocked') {
            @if (work.context?.executionBlock?.recovery === 'deploy') { <a class="lay-button" [href]="ctx.link('deploy', 'agents')">Open Deploy</a> }
            @else if (work.context?.executionBlock?.recovery === 'agents') { <a class="lay-button" [href]="ctx.link('work', 'agents')">Manage agent</a> }
            @else if (work.context?.batch) { <a class="lay-button" [href]="ctx.link('work')">Open batch to retry</a> }
            @else { <button type="button" class="lay-button" (click)="update({ stage: true }, work.ref + ' staged to retry.')">Stage again</button> }
          }
          @case ('working') { <button type="button" class="lay-button ghost" (click)="update({ stop: true }, 'Stopping ' + work.ref + '.')"><mat-icon aria-hidden="true">stop_circle</mat-icon>Stop</button> }
        }
      </div>
    </div>

    @if (work.assignee?.kind === 'agent') {
      <section class="lay-runbox" [class.lay-runbox-live]="work.status === 'working'" [class.lay-runbox-blocked]="work.status === 'blocked'" aria-label="Agent run">
        <header>
          @if (work.status === 'blocked') { <h2><mat-icon aria-hidden="true">block</mat-icon>Agent run blocked</h2><span class="lay-ticker">{{ work.context?.executionBlock?.reason }}</span> }
          @else if (work.status === 'working') { <h2><mat-icon aria-hidden="true" class="lay-spin">progress_activity</mat-icon>{{ ctx.whoName(work.assignee) }} is working</h2><span class="lay-ticker"><strong>{{ elapsedText() }}</strong> active{{ run()?.model ? ' · ' + run()?.model : '' }}</span> }
          @else if (runFinished()) { <h2><mat-icon aria-hidden="true">check_circle</mat-icon>Agent run finished</h2><span class="lay-ticker">{{ run()?.model }} · {{ usageText() }}{{ run()?.finishedAt ? ' · ' + duration() : '' }}</span> }
          @else if (work.status === 'needs') { <h2><mat-icon aria-hidden="true">pause_circle</mat-icon>Paused: waiting for your answer</h2><span class="lay-ticker">{{ usageText() }}</span> }
          @else { <h2><mat-icon aria-hidden="true">schedule</mat-icon>Agent run not started</h2><span class="lay-ticker">{{ notStartedText() }}</span> }
        </header>
        <ol class="lay-phases">@for (phase of phases(); track $index) {
          <li [class]="phaseState($index)"><div class="lay-seg"><i [style.width.%]="phaseState($index) === 'done' ? 100 : phaseState($index) === 'now' ? 50 : 0"></i></div>
            <div class="lay-phase-label"><mat-icon aria-hidden="true">{{ phaseState($index) === 'done' ? 'check' : phaseState($index) === 'now' ? 'arrow_right' : 'radio_button_unchecked' }}</mat-icon><span>{{ phase }}</span></div></li> }</ol>
        @if (work.status === 'working' && run()?.activity) { <p class="lay-now-line"><mat-icon aria-hidden="true">bolt</mat-icon>{{ run()?.activity }}…</p> }
        @if (!agentRunnable(work, this.ctx) && work.status !== 'done') { <p class="lay-muted small">No agent runner is connected for “{{ actionName() }}”. Assign it to a person or connect the matching worker.</p> }
      </section>
    }

    @if (work.action === 'platform.implement') {
      <section class="lay-sec" aria-labelledby="candidate-heading"><h2 id="candidate-heading"><mat-icon aria-hidden="true">difference</mat-icon>Code candidates</h2>
        @if (codingAttempt(); as attempt) {
          <p class="small">Agent turns reserved: {{ attempt.runsStarted }} of {{ attempt.runLimit }} · {{ attempt.state }}</p>
          @if (attempt.runsStarted >= attempt.runLimit && !attempt.candidateId && work.status !== 'done') {
            <p class="lay-muted small">This authorization has no turns left. No further agent turn will start until you authorize more work.</p>
            @if (attempt.runLimit < 12) { <button type="button" class="lay-button ghost small" (click)="authorizeMore(work, attempt)">Authorize three more turns</button> }
          }
        }
        @for (candidate of codeCandidates(); track candidate.id) {
          <article class="lay-rcheck"><div class="lay-rc-head"><strong>{{ candidate.id }}</strong><span class="lay-chip lay-info">{{ candidate.state }}</span></div>
            <p class="small">Base {{ candidate.base.slice(0, 12) }} · candidate {{ candidate.commit?.slice(0, 12) || 'not committed' }} · {{ candidate.workspaceOwner }} workspace</p>
            <p class="small">Changed files: {{ candidate.files.join(', ') || 'none recorded' }}</p>
            @for (check of candidate.checks; track $index) { <p class="small">{{ check.name }}: {{ check.status }} — {{ check.detail }} @if (check.source === 'agent-report') { (agent report, unverified) }</p> }
            <div class="lay-row lay-wrap"><button type="button" class="lay-button ghost small" (click)="inspectCandidate(candidate.id)">View diff summary</button>
              @if (candidate.state === 'submitted') { <button type="button" class="lay-button ghost small" (click)="buildCandidatePreview(candidate.id)">Build isolated preview</button> }
              @if (candidatePreview()?.id === candidate.id && (candidatePreview()?.status === 'running' || candidatePreview()?.status === 'stopped')) { <a class="lay-button ghost small" [href]="candidatePreview()?.url" target="_blank" rel="noopener noreferrer">Open candidate preview</a> }
            </div>
            @if (candidatePreview()?.id === candidate.id) { <p class="small">Preview: {{ candidatePreview()?.status }} @if (candidatePreview()?.error) { · {{ candidatePreview()?.error }} }</p> }
            @if (candidateDiff()?.id === candidate.id) { <pre class="small">{{ candidateDiff()?.diff }}</pre><p class="small">{{ candidateDiff()?.baseCurrent ? 'Base still current' : 'Project base changed; reassessment required' }}</p> }
          </article>
        } @empty { <p class="lay-muted small">No code candidate submitted yet.</p> }
        <p class="lay-muted small">A submitted commit is awaiting independent checks and a separate preview before acceptance.</p>
      </section>
    }

    @if (work.context?.visionProposal; as proposal) {
      @if (work.action === 'product.brief' && work.status === 'review') {
      <section class="lay-sec" aria-labelledby="vision-proposal-heading"><h2 id="vision-proposal-heading"><mat-icon aria-hidden="true">edit_document</mat-icon>Proposed Vision claim</h2>
        <p class="lay-muted small">{{ proposal.targetId ? 'Revise an existing claim' : 'Add a new claim' }} · Brief section: {{ proposal.section }} · drafted against Brief revision {{ proposal.briefRevision }}</p>
        @if (proposal.targetId) { <p class="small"><strong>Current at draft time:</strong> {{ proposal.beforeText }}</p> }
        <p class="lay-prose"><strong>Proposed:</strong> {{ proposal.text }}</p>
        @if (proposal.note) { <p class="small"><strong>Note:</strong> {{ proposal.note }}</p> }
        <p class="small"><strong>Basis:</strong> {{ proposal.basis }}</p>
        <p class="lay-muted small">The Brief changes only after a Product lead accepts the checks and this exact proposal.</p>
      </section>
      }
    }

    @if (work.context?.workProposal; as proposal) {
      @if (work.status === 'review') {
      <section class="lay-sec" aria-labelledby="work-proposal-heading"><h2 id="work-proposal-heading"><mat-icon aria-hidden="true">edit_document</mat-icon>Proposed {{ actionName() }}</h2>
        <p class="lay-prose">{{ proposal.summary }}</p>
        <pre class="lay-prose">{{ show(proposal.content) }}</pre>
        <p class="lay-muted small">Drafted against repository {{ proposal.repositoryCommit.slice(0, 12) }}. The draft does not change project records. Acceptance applies any permitted target change.</p>
      </section>
      }
    }

    @if (work.action === 'platform.security' && work.context?.auditReport; as report) {
      <section class="lay-sec" aria-labelledby="audit-heading"><h2 id="audit-heading"><mat-icon aria-hidden="true">shield</mat-icon>Security findings for review</h2>
        <p class="lay-prose">{{ report.summary }}</p><p class="lay-muted small">Audited commit {{ report.repositoryCommit.slice(0, 12) }}.</p>
        @for (finding of report.findings; track $index) {
          <article class="lay-rcheck"><div class="lay-rc-head"><strong>{{ finding.title }}</strong><span class="lay-chip lay-info">{{ finding.severity }}</span></div>
            <p class="small"><strong>Affected:</strong> {{ finding.affected }}</p><p class="small"><strong>Evidence:</strong> {{ finding.evidence }}</p>
            <p class="small"><strong>Suggested next action:</strong> {{ finding.recommendation }}</p></article>
        } @empty { <p class="lay-muted small">No findings reported. Review the stated scope and checks before accepting.</p> }
        <h3>Agent checks</h3>@for (check of report.checks; track $index) { <p class="small">{{ check.name }}: {{ check.status }}{{ check.detail ? ' — ' + check.detail : '' }}</p> }
        @if (report.usedInputs?.length) { <h3>Knowledge used</h3><div class="lay-refs">@for (ref of report.usedInputs; track ref.id) { <aludel-ref [id]="ref.id" /><span class="lay-muted small">revision {{ ref.revision }}</span> }</div> }
        <p class="lay-muted small">Agent claims await your review. This report did not change the code.</p>
      </section>
    }

    <div class="lay-detail">
      <div>
        @if (work.status === 'review') {
          <section class="lay-review" aria-labelledby="review-heading">
            <header><h2 id="review-heading"><mat-icon aria-hidden="true">rate_review</mat-icon>Review: {{ work.checks.length }} {{ work.checks.length === 1 ? 'thing' : 'things' }} to check</h2>
              <div class="lay-tally" aria-hidden="true">@for (check of work.checks; track $index) { <i [class.a]="check.verdict === 'accept'" [class.r]="check.verdict === 'reject'"></i> }</div>
              <p class="small">{{ ctx.whoName(work.assignee) }} finished this. It stays in its batch until you clear it. Open each check's evidence, compare it with where the check comes from, and accept or reject it.</p></header>
            @for (check of work.checks; track $index; let index = $index) {
              <article class="lay-rcheck" [class.accepted]="check.verdict === 'accept'" [class.rejected]="check.verdict === 'reject'" [attr.aria-labelledby]="'check-' + index">
                <div class="lay-rc-head"><span class="lay-rc-num" aria-hidden="true">@if (check.verdict === 'accept') { <mat-icon>check</mat-icon> } @else if (check.verdict === 'reject') { <mat-icon>close</mat-icon> } @else { {{ index + 1 }} }</span>
                  <div><strong [id]="'check-' + index">{{ check.text }}</strong>
                    @if (check.source) { <div class="lay-rc-src">From <aludel-ref [id]="check.source.id" />@if (check.source.revision) { <span>revision {{ check.source.revision }}</span> }</div> }</div>
                  @if (check.verdict) { <span [class]="'lay-chip ' + (check.verdict === 'accept' ? 'lay-ok' : 'lay-bad')">{{ check.verdict === 'accept' ? 'Accepted' : 'Rejected' }}@if (check.by) { · {{ check.by }} }</span> }</div>
                <div class="lay-rc-body">
                  <div class="lay-ev"><span class="lay-muted small">Evidence</span>
                    @for (change of evidenceFor(check.source?.id); track change.revision + change.recordId) {
                      <button type="button" class="lay-evbtn" [attr.aria-pressed]="open() === index + ':' + change.revision" (click)="toggleEvidence(index, change.revision)"><mat-icon aria-hidden="true">difference</mat-icon>{{ ctx.refInfo(change.recordId)?.label || 'Record' }} · revision {{ change.revision }}</button>
                    } @empty {
                      @if (work.action === 'product.brief' && work.context?.visionProposal) {
                        <span class="lay-muted small">Review the proposed claim above. The Brief changes after acceptance.</span>
                      } @else if (work.context?.workProposal) { <span class="lay-muted small">Review the proposal above. It has not changed project records.</span> }
                      @else { <span class="lay-muted small">No change to this record came from {{ work.ref }}.</span> }
                    }
                  </div>
                  @for (change of evidenceFor(check.source?.id); track change.revision + change.recordId) {
                    @if (open() === index + ':' + change.revision) {
                      <div class="lay-compare">
                        <div><h4><mat-icon aria-hidden="true">bookmark</mat-icon>The check</h4><p class="small">{{ check.text }}</p>
                          @if (check.source && ctx.refInfo(check.source.id); as source) { <p class="lay-muted small">{{ source.title }}: {{ source.note }}</p> }</div>
                        <div><h4><mat-icon aria-hidden="true">difference</mat-icon>What {{ work.ref }} changed</h4>
                          <dl class="lay-fieldiff">@for (field of change.fields; track field.field) { <dt>{{ field.field }}</dt><dd><del>{{ show(field.before) }}</del><ins>{{ show(field.after) }}</ins></dd> }</dl></div>
                      </div>
                    }
                  }
                  <div class="lay-verdict">
                    <div class="lay-seg2" role="group" [attr.aria-label]="'Verdict for check ' + (index + 1)">
                      <button type="button" class="yes" [attr.aria-pressed]="check.verdict === 'accept'" (click)="verdict(index, check.verdict === 'accept' ? null : 'accept')"><mat-icon aria-hidden="true">check</mat-icon>Accept</button>
                      <button type="button" class="no" [attr.aria-pressed]="check.verdict === 'reject'" (click)="verdict(index, check.verdict === 'reject' ? null : 'reject')"><mat-icon aria-hidden="true">close</mat-icon>Reject</button></div>
                    @if (check.verdict === 'reject') { <label class="visually-hidden" [for]="'note-' + index">What's wrong with check {{ index + 1 }}</label>
                      <input [id]="'note-' + index" [class.lay-required]="!check.note" [value]="check.note" (change)="verdict(index, 'reject', $any($event.target).value)" placeholder="What's wrong? It goes back to the agent"> }
                  </div>
                </div>
              </article>
            }
            <footer><span class="lay-muted small">{{ tally().accepted }} accepted · {{ tally().rejected }} rejected · {{ tally().left }} to check</span>
              @if (tally().rejected) { <button type="button" class="lay-button danger" [disabled]="tally().left > 0" (click)="update({ sendBack: true }, work.ref + ' sent back with your notes. Stage it to try again.')">Send back with {{ tally().rejected }} rejected</button> }
              @else {
                @if (work.action === 'platform.implement' && work.assignee?.kind === 'agent') {
                  <button type="button" class="lay-button lay-button-ok" [disabled]="tally().left > 0 || !reviewCandidate()" (click)="acceptCodeCandidate(work)"><mat-icon aria-hidden="true">check</mat-icon>Accept exact code commit</button>
                } @else if (work.action === 'product.brief' && work.assignee?.kind === 'agent') {
                  <button type="button" class="lay-button lay-button-ok" [disabled]="tally().left > 0 || tally().rejected > 0 || !work.context?.visionProposal" (click)="acceptBriefProposal(work)"><mat-icon aria-hidden="true">check</mat-icon>Accept and apply Vision claim</button>
                } @else if (work.context?.workProposal) {
                  <button type="button" class="lay-button lay-button-ok" [disabled]="tally().left > 0 || tally().rejected > 0" (click)="acceptWorkProposal(work)"><mat-icon aria-hidden="true">check</mat-icon>Accept and apply proposal</button>
                } @else { <button type="button" class="lay-button lay-button-ok" [disabled]="tally().left > 0" (click)="update({ state: 'done' }, work.ref + ' accepted.')"><mat-icon aria-hidden="true">check</mat-icon>Accept {{ work.ref }}</button> }
              }</footer>
          </section>
        }

        @if (work.question && !work.question.answer) {
          <form class="lay-callout-needs" (ngSubmit)="answer(work)" aria-labelledby="question-heading">
            <h2 id="question-heading"><mat-icon aria-hidden="true">help</mat-icon>{{ work.question.text }}</h2>
            @if (work.question.recommendation) { <p class="small">{{ ctx.whoName(work.assignee) }} recommends <strong>{{ work.question.recommendation }}</strong>. {{ work.question.reasoning }}</p> }
            @if (work.question.options.length) {
              <div class="lay-options" role="radiogroup" aria-labelledby="question-heading">@for (option of work.question.options; track option; let index = $index) {
                <label class="lay-option" [for]="'option-' + index"><input type="radio" name="answer" [id]="'option-' + index" [value]="option" [(ngModel)]="answerDraft"><span>{{ option }}</span>
                  @if (option === work.question.recommendation) { <span class="lay-chip lay-info">Recommended</span> }</label> }</div>
            } @else { <label>Answer<input name="answer" [(ngModel)]="answerDraft"></label> }
            <label>Why (saved with the decision)<textarea name="why" rows="2" [(ngModel)]="whyDraft"></textarea></label>
            <div class="lay-row lay-wrap"><button type="submit" class="lay-button" [disabled]="!answerDraft.trim()">Answer</button>
              <span class="lay-muted small">The answer is written into {{ answerTargets() }} with your reason.</span></div>
          </form>
        }

        <section class="lay-sec" aria-labelledby="what-heading"><h2 id="what-heading"><mat-icon aria-hidden="true">notes</mat-icon>What to do</h2>
          <p class="lay-prose">{{ action()?.description || actionName() }}@if (work.targets.length) { for } @for (target of work.targets; track target.id; let last = $last) { <aludel-ref [id]="target.id" [fallback]="target.label" />{{ last ? '.' : ', ' }} } @empty { . }</p>
          @if (work.context?.suggestion) { <p class="lay-prose"><strong>Task brief:</strong> {{ work.context.suggestion }}</p> }
          @if (work.context?.feedback?.length) {
            <div class="lay-feedback"><strong>Sent back last time:</strong><ul>@for (note of work.context.feedback; track $index) { <li>“{{ note.check }}”: {{ note.note }} <span class="lay-muted small">({{ note.by }})</span></li> }</ul></div>
          }
          @if (openTargets().length && work.assignee?.kind === 'person' && work.status !== 'done') {
            <p class="lay-muted small">Doing it yourself? Edit
              @for (target of openTargets(); track target.id; let last = $last) { <button type="button" class="lay-link-button" (click)="workOn(work, target.id)">{{ ctx.refInfo(target.id)?.label || target.label }}</button>{{ last ? '' : ', ' }} }
              from here and the change counts for {{ work.ref }}.</p>
          }
        </section>

        <section class="lay-sec" aria-labelledby="done-heading"><h2 id="done-heading"><mat-icon aria-hidden="true">task_alt</mat-icon>Done when <span class="lay-count">{{ accepted() }} of {{ work.checks.length }}</span></h2>
          <ul class="lay-donelist">@for (check of work.checks; track $index) {
            <li [class.met]="check.verdict === 'accept' || work.status === 'done'"><mat-icon aria-hidden="true">{{ check.verdict === 'accept' || work.status === 'done' ? 'check_circle' : check.verdict === 'reject' ? 'cancel' : 'radio_button_unchecked' }}</mat-icon>
              <span>{{ check.text }} @if (check.source) { <aludel-ref [id]="check.source.id" /> }</span></li> }
            @empty { @for (line of work.documents; track line) { <li><mat-icon aria-hidden="true">radio_button_unchecked</mat-icon><span>{{ line }}</span></li> } }</ul>
          <p class="lay-muted small">These are also the review checklist: each one is checked against what this item changed.</p>
        </section>

        @if (work.question?.answer) {
          <section class="lay-sec" aria-labelledby="decided-heading"><h2 id="decided-heading"><mat-icon aria-hidden="true">gavel</mat-icon>Decided</h2>
            <p class="lay-prose"><strong>{{ work.question.text }}</strong><br>{{ work.question.answer }}{{ work.question.rationale ? ': ' + work.question.rationale : '' }}</p>
            <p class="lay-muted small">By {{ work.question.answeredBy }}.@for (id of work.question.applied || []; track id) { Written into <aludel-ref [id]="id" />. }</p></section>
        }

        @if (reconcile(); as change) {
          <section class="lay-sec" aria-labelledby="reconcile-heading"><h2 id="reconcile-heading"><mat-icon aria-hidden="true">difference</mat-icon>What changed in the record</h2>
            <p class="lay-muted small"><aludel-ref [id]="change.recordId" /> moved from revision {{ change.fromRevision }} to {{ change.toRevision }} after its code was written.</p>
            <dl class="lay-fieldiff">@for (entry of change.changes; track entry.field) { <dt>{{ entry.field }}</dt><dd><del>{{ show(entry.before) }}</del><ins>{{ show(entry.after) }}</ins></dd> }</dl>
            <h3>Code it affects</h3><div class="lay-refs">@for (unit of change.units; track unit.id) { <aludel-ref [id]="unit.id" [fallback]="unit.symbol" /> } @empty { <span class="lay-muted small">None indexed.</span> }</div>
            <p class="small">Tests: {{ change.tests.join('; ') || 'none reach this code yet' }}</p></section>
        }

        @if (changes().length) {
          <section class="lay-sec" aria-labelledby="changed-heading"><h2 id="changed-heading"><mat-icon aria-hidden="true">difference</mat-icon>What changed <span class="lay-count">{{ changes().length }} {{ changes().length === 1 ? 'revision' : 'revisions' }}</span></h2>
            <div class="lay-changes"><h3>Knowledge</h3>
              @for (change of changes(); track change.recordId + change.revision) {
                <details class="lay-change"><summary><mat-icon aria-hidden="true" class="lay-chev">chevron_right</mat-icon><span class="lay-verb">{{ change.revision === 1 ? 'Created' : 'Revised' }}</span>
                  <span class="lay-change-what"><span>{{ ctx.refInfo(change.recordId)?.label || 'Deleted record' }}</span><span class="lay-muted small">revision {{ change.revision }} · {{ change.author }}</span></span></summary>
                  <p class="lay-change-open">Open <aludel-ref [id]="change.recordId" [fallback]="'Deleted record'" /></p>
                  <dl class="lay-fieldiff">@for (field of change.fields; track field.field) { <dt>{{ field.field }}</dt><dd><del>{{ show(field.before) }}</del><ins>{{ show(field.after) }}</ins></dd> }</dl></details>
              }
              <p class="lay-changes-foot"><mat-icon aria-hidden="true">info</mat-icon>Code changes appear here once coding agents commit against items (LAY-05).</p></div>
          </section>
        }

        <section class="lay-sec" aria-labelledby="log-heading"><h2 id="log-heading"><mat-icon aria-hidden="true">history</mat-icon>Activity <span class="lay-count">{{ work.log.length }}</span></h2>
          <ol class="lay-worklog">@for (entry of work.log; track $index) {
            <li>@if (entry.by) { <aludel-avatar [who]="$any(entry.by)" /> } @else { <span class="lay-av lay-av-sm lay-av-system" aria-hidden="true"><mat-icon>deployed_code</mat-icon></span> }
              <div><div class="lay-log-line">@if (entry.by) { <strong>{{ ctx.whoName($any(entry.by)) }}</strong> {{ lowerFirst(entry.text) }} } @else { {{ entry.text }} }<span class="lay-when">{{ when(entry.at) }}</span></div>
                @if (entry.refs?.length) { <div class="lay-refs">@for (ref of entry.refs; track ref) { <aludel-ref [id]="ref" /> }</div> }</div></li> }</ol>
          <form class="lay-comment" (ngSubmit)="note(work)"><label class="visually-hidden" for="work-note">Add a note to the activity</label><input id="work-note" name="note" [(ngModel)]="noteDraft" placeholder="Add a note…">
            <button type="submit" class="lay-button ghost small" [disabled]="!noteDraft.trim()">Add</button></form>
        </section>
      </div>

      <aside class="lay-side">
        <section class="lay-panel" aria-labelledby="details-heading"><h2 id="details-heading">Details</h2>
          <dl class="lay-dfields">
            <dt>Status</dt><dd><span [class]="'lay-st lay-st-' + work.status">{{ statusLabel[work.status] }}</span></dd>
            <dt>Priority</dt><dd><button type="button" class="lay-prio-btn" [matMenuTriggerFor]="priorityMenu" [attr.aria-label]="'Priority: ' + priorityLabel[work.priority] + '. Change'"><aludel-priority [value]="work.priority" [text]="true" /><mat-icon aria-hidden="true">expand_more</mat-icon></button>
              <mat-menu #priorityMenu="matMenu" class="lay-menu">@for (level of priorities; track level) { <button mat-menu-item type="button" (click)="update({ priority: level }, work.ref + ' is now ' + priorityLabel[level] + ' priority.')"><aludel-priority [value]="level" /><span>{{ priorityLabel[level] }}</span>@if (level === work.priority) { <mat-icon class="lay-menu-check" aria-label="current">check</mat-icon> }</button> }</mat-menu></dd>
            <dt>Assignee</dt><dd><aludel-assignee [assignee]="work.assignee" [locked]="lock()" (changed)="reassign($event)" /></dd>
            <dt>Role</dt><dd><aludel-role-chip [layer]="work.layer" [action]="work.action" /></dd>
            @if (batch(); as current) { <dt>Batch</dt><dd>{{ current.ref }} · {{ current.state === 'draft' ? 'not started' : current.state }}</dd> }
            <dt>Source</dt><dd class="small">{{ source() }}</dd>
            <dt>Created</dt><dd class="small">{{ when(work.createdAt) }}</dd>
          </dl></section>
        <section class="lay-panel" aria-labelledby="links-heading"><h2 id="links-heading">Links</h2>
          @if (work.blockedBy.length) { <h3>Is blocked by</h3><ul class="lay-links">@for (id of work.blockedBy; track id) { <li><aludel-ref [id]="id" /><button type="button" class="lay-xbutton" (click)="unlink(id, work.id)" [attr.aria-label]="'Remove link to ' + ctx.workById().get(id)?.ref"><mat-icon aria-hidden="true">close</mat-icon></button></li> }</ul> }
          @if (work.blocks.length) { <h3>Blocks</h3><ul class="lay-links">@for (id of work.blocks; track id) { <li><aludel-ref [id]="id" /><button type="button" class="lay-xbutton" (click)="unlink(work.id, id)" [attr.aria-label]="'Remove link to ' + ctx.workById().get(id)?.ref"><mat-icon aria-hidden="true">close</mat-icon></button></li> }</ul> }
          @if (!work.blockedBy.length && !work.blocks.length) { <p class="lay-muted small">Not blocked, and blocks nothing.</p> }
          <form class="lay-link-form" (ngSubmit)="link(work)"><label class="visually-hidden" for="link-kind">Link type</label>
            <select id="link-kind" name="linkKind" [(ngModel)]="linkKind"><option value="blocked">Is blocked by</option><option value="blocks">Blocks</option></select>
            <label class="visually-hidden" for="link-item">Work item</label>
            <select id="link-item" name="linkItem" [(ngModel)]="linkItem"><option value="">Choose an item…</option>@for (other of linkable(); track other.id) { <option [value]="other.id">{{ other.ref }} {{ other.title }}</option> }</select>
            <button type="submit" class="lay-button ghost small" [disabled]="!linkItem">Link</button></form>
        </section>
        <section class="lay-panel lay-linked" aria-labelledby="linked-heading"><h2 id="linked-heading">Linked knowledge</h2>
          @if (work.targets.length) { <h3><mat-icon aria-hidden="true">edit</mat-icon>Changes</h3><div class="lay-refs lay-refs-col">@for (target of work.targets; track target.id) { <aludel-ref [id]="target.id" [fallback]="target.label" /> }</div> }
          @if (reads().length) { <h3><mat-icon aria-hidden="true">visibility</mat-icon>Reads</h3><div class="lay-refs lay-refs-col">@for (id of reads(); track id) { <aludel-ref [id]="id" /> }</div> }
          @if (!work.targets.length && !reads().length) { <p class="lay-muted small">Nothing linked.</p> }
        </section>
        @if (work.assignee?.kind === 'agent') {
          <section class="lay-panel" aria-labelledby="runs-heading"><h2 id="runs-heading">Runs with</h2>
            <ul class="lay-pins"><li><aludel-avatar [who]="work.assignee" /><a [href]="ctx.link('work', 'agents', work.assignee.id || '')" (click)="ctx.go(ctx.link('work', 'agents', work.assignee.id || ''), $event)">{{ ctx.whoName(work.assignee) }}</a>
              <span class="lay-muted small">{{ profile()?.model || 'Account default' }} · {{ profile()?.effort }} effort</span></li>
              @for (pin of pins(); track pin.id) { <li><aludel-ref [id]="pin.id" /><span class="lay-muted small">revision {{ pin.revision }}</span></li> }</ul>
            <p class="lay-muted small">{{ work.instructions ? 'Pinned when the run started, so later edits don\\'t change it.' : 'Instructions are pinned when the run starts.' }}</p>
          </section>
        }
      </aside>
    </div>
  } @else { <h1 tabindex="-1">Work item not found</h1><p><a [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)">Back to the board</a></p> }`
})
export class WorkItemComponent {
  readonly ctx = inject(ProjectContext);
  readonly id = input.required<string>();
  readonly statusLabel = workStatusLabel;
  readonly priorityLabel = priorityLabel;
  readonly priorityIcon = priorityIcon;
  readonly priorities = priorityOrder;
  readonly agentRunnable = agentRunnable;
  readonly item = computed(() => this.ctx.workById().get(this.id()) || null);
  readonly action = computed(() => this.ctx.actionById().get(this.item()?.action || '') || null);
  readonly actionName = computed(() => this.action()?.name || this.item()?.type || '');
  readonly batch = computed(() => { const work = this.item(); return work ? batchOf(this.ctx, work) : null; });
  readonly running = computed(() => isRunning(this.batch()));
  readonly run = computed(() => this.item()?.context?.run || null);
  readonly profile = computed(() => this.ctx.profileById().get(this.item()?.assignee?.id || '') || null);
  readonly phases = computed(() => this.run()?.phases?.length ? this.run()!.phases! : this.action()?.phases || ['Read context', 'Draft', 'Save draft']);
  readonly runFinished = computed(() => Boolean(this.run()?.done) || this.item()?.status === 'review' || (this.item()?.status === 'done' && Boolean(this.run()?.usage)));
  readonly elapsedText = computed(() => elapsed(this.run()?.startedAt, this.ctx.now()));
  readonly changes = signal<WorkChange[]>([]);
  readonly codeCandidates = signal<CodeCandidate[]>([]);
  readonly codingAttempt = signal<CodingAttempt | null>(null);
  readonly candidateDiff = signal<{ id: string; diff: string; baseCurrent: boolean } | null>(null);
  readonly candidatePreview = signal<{ id: string; status: string; builtAt?: string | null; error?: string | null; url: string } | null>(null);
  readonly reviewCandidate = computed(() => this.codeCandidates().find(candidate => candidate.state === 'review' && candidate.commit) || null);
  readonly reconcile = signal<ReconcileContext | null>(null);
  readonly open = signal<string | null>(null);
  readonly lock = computed(() => {
    const work = this.item(); if (!work) return null;
    if (work.assignee?.kind === 'template' || work.status === 'done') return 'Done';
    if (work.status === 'working') return 'Working now';
    if (work.status === 'review') return 'Ready for review: accept it or send it back first';
    if (work.status === 'staged' && this.running()) return 'Locked in while its batch runs';
    return null;
  });
  readonly stageBlock = computed(() => {
    const work = this.item(); if (!work) return null;
    if (work.blockedBy.length) return `Blocked by ${work.blockedBy.map(id => this.ctx.workById().get(id)?.ref).join(', ')}`;
    if (!work.assignee) return 'Assign it to someone first';
    if (work.assignee.kind === 'agent' && !agentRunnable(work, this.ctx)) return `Agents can't run “${this.actionName()}” yet. Assign it to a person.`;
    return null;
  });
  readonly tally = computed(() => { const checks = this.item()?.checks || []; const accepted = checks.filter(check => check.verdict === 'accept').length; const rejected = checks.filter(check => check.verdict === 'reject').length; return { accepted, rejected, left: checks.length - accepted - rejected }; });
  readonly accepted = computed(() => this.item()?.status === 'done' ? this.item()!.checks.length : this.tally().accepted);
  readonly reads = computed(() => { const work = this.item(); if (!work) return []; const targets = new Set(work.targets.map(target => target.id)); return [...new Set([...(this.action()?.reads || []), ...(this.profile()?.context || [])])].filter(id => !targets.has(id)); });
  readonly pins = computed(() => { const pins = this.item()?.instructions; return pins ? [pins.principles, pins.project, pins.role, pins.action, pins.profile].filter((pin): pin is NonNullable<typeof pin> => Boolean(pin)) : []; });
  readonly openTargets = computed(() => (this.item()?.targets || []).filter(target => ['story', 'spec', 'page', 'data_object', 'data_operation'].includes(target.kind)));
  readonly linkable = computed(() => { const work = this.item(); return (this.ctx.data()?.work || []).filter(other => other.id !== work?.id && other.status !== 'done' && !work?.blocks.includes(other.id) && !work?.blockedBy.includes(other.id)); });
  readonly answerTargets = computed(() => (this.item()?.targets || []).filter(target => ['story', 'spec', 'page'].includes(target.kind)).map(target => this.ctx.refInfo(target.id)?.label || target.label).join(', ') || 'the item');
  answerDraft = ''; whyDraft = ''; noteDraft = ''; linkKind = 'blocked'; linkItem = '';
  private loadedFor = '';

  constructor() {
    // What an item changed, read when it opens and again whenever it changes.
    effect(() => {
      const work = this.item();
      const key = work ? `${work.id}:${work.updatedAt}` : '';
      untracked(() => {
        if (!work || key === this.loadedFor) return;
        const fresh = !this.loadedFor.startsWith(`${work.id}:`);
        this.loadedFor = key;
        if (fresh) { this.answerDraft = work.question?.recommendation || ''; this.whyDraft = ''; this.open.set(null); }
        void this.ctx.api<{ changes: WorkChange[] }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/changes/${encodeURIComponent(work.id)}`).then(value => this.changes.set(value.changes), () => this.changes.set([]));
        if (work.action === 'platform.implement') void this.ctx.api<{ candidates: CodeCandidate[]; attempt: CodingAttempt | null }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/candidates?workId=${encodeURIComponent(work.id)}`).then(value => {
          this.codeCandidates.set(value.candidates);
          this.codingAttempt.set(value.attempt);
          const candidate = value.candidates.find(entry => entry.state === 'review');
          if (candidate) void this.ctx.api<{ preview: { status: string; builtAt?: string | null; error?: string | null }; url: string }>(
            `/api/projects/${encodeURIComponent(this.ctx.projectId())}/candidates/${encodeURIComponent(candidate.id)}/preview`)
            .then(status => this.candidatePreview.set({ id: candidate.id, ...status.preview, url: status.url }), () => this.candidatePreview.set(null));
        }, () => { this.codeCandidates.set([]); this.codingAttempt.set(null); });
        else { this.codeCandidates.set([]); this.codingAttempt.set(null); }
        if (work.type === 'reconcile') void this.ctx.api<ReconcileContext>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/reconcile/${encodeURIComponent(work.id)}`).then(value => this.reconcile.set(value?.recordId ? value : null), () => this.reconcile.set(null));
        else this.reconcile.set(null);
      });
    });
  }

  authorizeMore(work: WorkItem, attempt: CodingAttempt) {
    void this.ctx.write(async () => {
      const updated = await this.ctx.api<CodingAttempt>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/agents/symphony-runs`,
        'POST', { workId: work.id, expectedRunLimit: attempt.runLimit });
      this.codingAttempt.set(updated);
      return updated;
    }, `${work.ref}: three more coding turns authorized on the same pinned work.`);
  }

  acceptBriefProposal(work: WorkItem) {
    const proposalId = work.context?.visionProposal?.id;
    if (!proposalId) return;
    void this.ctx.write(() => this.ctx.updateWork(work.id, { acceptBrief: proposalId }), `${work.ref} Vision claim applied.`);
  }

  acceptWorkProposal(work: WorkItem) {
    const proposalId = work.context?.workProposal?.id;
    if (!proposalId) return;
    void this.ctx.write(() => this.ctx.updateWork(work.id, { acceptProposal: proposalId }), `${work.ref} proposal applied.`);
  }

  acceptCodeCandidate(work: WorkItem) {
    const candidate = this.reviewCandidate();
    if (!candidate?.commit) return;
    void this.ctx.write(() => this.ctx.api(
      `/api/projects/${encodeURIComponent(this.ctx.projectId())}/candidates/${encodeURIComponent(candidate.id)}/accept`,
      'POST', { commit: candidate.commit }), `${work.ref} accepted at ${candidate.commit.slice(0, 12)}.`);
  }

  buildCandidatePreview(id: string) {
    void this.ctx.write(async () => {
      const value = await this.ctx.api<{ preview: { status: string; error?: string | null }; url: string }>(
        `/api/projects/${encodeURIComponent(this.ctx.projectId())}/candidates/${encodeURIComponent(id)}/preview`, 'POST', {});
      this.candidatePreview.set({ id, ...value.preview, url: value.url });
    });
  }

  inspectCandidate(id: string) {
    void this.ctx.api<{ id: string; diff: string; baseCurrent: boolean }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/candidates/${encodeURIComponent(id)}`)
      .then(value => this.candidateDiff.set(value), () => this.candidateDiff.set(null));
  }

  phaseState(index: number) {
    const work = this.item(); const run = this.run();
    if (!work) return '';
    if (this.runFinished()) return 'done';
    if (!run || run.phase === undefined) return '';
    return index < run.phase ? 'done' : index === run.phase && (work.status === 'working' || work.status === 'needs') ? 'now' : '';
  }
  usageText() { const usage = this.run()?.usage; return usage ? `${tokens(usage.input + usage.output)} tokens` : 'No usage yet'; }
  duration() { const run = this.run(); return run?.startedAt && run.finishedAt ? elapsed(run.startedAt, Date.parse(run.finishedAt)) : ''; }
  notStartedText() { const work = this.item(); const batch = this.batch(); return work?.status === 'staged' ? `Runs when ${batch?.ref || 'its batch'} ${this.running() ? 'reaches it' : 'starts'}` : 'Stage it in a batch to run it'; }
  source() {
    const work = this.item(); if (!work) return '';
    if (work.context?.routine) return 'A routine';
    if (work.context?.reconcile) return 'Code links: a record changed after its code';
    if (work.context?.suggestion) return `A gap the ${layerLabel[work.layer]} layer found`;
    return work.log[0]?.text || 'Added by hand';
  }
  evidenceFor(recordId: string | undefined) { return recordId ? this.changes().filter(change => change.recordId === recordId) : []; }
  toggleEvidence(index: number, revision: number) { const key = `${index}:${revision}`; this.open.set(this.open() === key ? null : key); }
  verdict(index: number, value: 'accept' | 'reject' | null, note?: string) { void this.ctx.write(() => this.ctx.updateWork(this.id(), { verdict: { index, value, ...(note !== undefined ? { note } : {}) } })); }
  update(body: unknown, success = '') { void this.ctx.write(() => this.ctx.updateWork(this.id(), body), success); }
  reassign(assignee: Assignee) { this.update({ assignee }, `${this.item()?.ref} now goes to ${this.ctx.whoName(assignee)}.`); }
  answer(work: WorkItem) { void this.ctx.write(() => this.ctx.updateWork(work.id, { answer: this.answerDraft, rationale: this.whyDraft }), 'Answered and written into the record.'); }
  note(work: WorkItem) { const text = this.noteDraft.trim(); if (!text) return; void this.ctx.write(async () => { await this.ctx.updateWork(work.id, { note: text }); this.noteDraft = ''; }); }
  workOn(work: WorkItem, targetId: string) { const info = this.ctx.refInfo(targetId); this.ctx.workOn(work); if (info) this.ctx.go(info.href); }
  link(work: WorkItem) {
    const other = this.ctx.workById().get(this.linkItem); if (!other) return;
    const [from, to] = this.linkKind === 'blocks' ? [work, other] : [other, work];
    void this.ctx.write(async () => { await this.ctx.updateWork(from.id, { blocks: [...from.blocks, to.id] }); this.linkItem = ''; }, `${from.ref} now blocks ${to.ref}.`);
  }
  unlink(fromId: string, toId: string) { const from = this.ctx.workById().get(fromId); if (from) void this.ctx.write(() => this.ctx.updateWork(fromId, { blocks: from.blocks.filter(id => id !== toId) }), 'Link removed.'); }
  // "Staged in …" reads as "You staged in …" after a name; acronyms ("S4", "AGENTS.md") keep their case.
  lowerFirst(text: string) { return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text; }
  when(at: string) { const date = new Date(at); return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${date.toTimeString().slice(0, 5)}`; }
  // Field values in words: a schema as its fields (required ones starred), scenarios as sentences, lists joined.
  show(value: unknown): string {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return '—';
    if (Array.isArray(value)) return value.map(entry => {
      if (typeof entry === 'string') return entry;
      const scenario = entry as { given?: string; when?: string; then?: string };
      if (scenario?.given !== undefined) return `Given ${scenario.given}, when ${scenario.when}, then ${scenario.then}`;
      return Object.values(entry || {}).join(' / ');
    }).join('; ');
    if (typeof value === 'object') {
      const schema = value as { properties?: Record<string, { type?: string }>; required?: string[] };
      if (schema.properties) return Object.entries(schema.properties).map(([name, field]) => `${name}${schema.required?.includes(name) ? '*' : ''} (${field.type || 'object'})`).join(', ') || 'no fields';
      return Object.entries(value as Record<string, unknown>).map(([key, entry]) => `${key}: ${typeof entry === 'object' ? JSON.stringify(entry) : entry}`).join(', ');
    }
    return String(value);
  }
}
