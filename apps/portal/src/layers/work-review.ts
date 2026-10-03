import { Component, HostListener, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClaimKind, ProjectContext, ProofStatus, RunChange, WorkRun } from './context';
import { AvatarComponent, RefChipComponent } from './work-shared';
import { reviewFocus, runTitle } from './work-run';

// JOURNEYS-01 J3: review steps come from the candidate's journeys, each with the result its step test had on this build.
type StepResult = { status: 'passed' | 'failed' | 'skipped' | 'uncovered' | 'no-fixture'; detail?: string | null; screenshot?: boolean };
type ReviewStep = { id: string; journey: string; step: string; label: string; expected: string; persona: string | null; available: boolean; reason: string | null; result: StepResult | null };
type ReviewPreview = { status: string; error?: string | null; reason?: string | null; url: string; journeys?: { id: string; title: string; revision: number; origin: string }[]; steps?: ReviewStep[];
  separability?: { seamsFile: boolean; declared: number; undeclared: string[] } | null };
const stepResult: Record<StepResult['status'] | 'none', [string, string]> = { passed: ['check_circle', 'Test passed'], failed: ['cancel', 'Test failed'], skipped: ['radio_button_unchecked', 'Not run'],
  uncovered: ['remove', 'No test'], 'no-fixture': ['person_off', 'No fixture'], none: ['radio_button_unchecked', 'Not run yet'] };
// JOURNEYS-01 J4: what each kind of claim is, and how a claim's automated proof reads.
const claimKind: Record<ClaimKind, string> = { journey: 'Journey', record: 'Layer record', invariant: 'Invariant', note: 'Note · unbacked' };
const proofStatus: Record<ProofStatus, [string, string]> = { passed: ['check_circle', 'Passed'], failed: ['cancel', 'Failed'], 'no-fixture': ['person_off', 'No fixture'], uncovered: ['remove', 'No test'],
  skipped: ['radio_button_unchecked', 'Not run after a failure'], missing: ['help', 'Not in the build'], stale: ['history', 'Older revision built'], 'not-run': ['radio_button_unchecked', 'Not run yet'] };
type Evidence = { type: 'change' | 'test' | 'try' | 'check' | 'note'; label: string; detail: string; look: string; result?: string; missing?: boolean };
const evidenceType: Record<Evidence['type'], [string, string]> = { change: ['difference', 'Change'], test: ['science', 'Test'], try: ['touch_app', 'Try it'], check: ['verified', 'Aludel check'], note: ['person', 'Performer evidence'] };

// WORK-ITEM-UX-01 WI-4: reviewing one run, a claim at a time. The left shows what the run produced (only the kinds it
// produced: Changes, Preview, Tests); the right steps through its claims and ends at the signature.
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
            @for (criterion of r.task.criteria; track criterion.id) { <button type="button" [class]="'wr-pip wr-pip-' + (r.review.verdicts[criterion.id]?.value || 'none')" [class.cur]="step() === criterion.index" (click)="goTo(criterion.index)" [attr.aria-label]="'Claim ' + (criterion.index + 1)"></button> }
            <button type="button" class="wr-pip wr-pip-end" [class.cur]="onEnd()" (click)="goTo(r.task.criteria.length)" aria-label="Sign off"></button></div>
        </header>
        @if (r.state !== 'review') { <p class="wr-note"><mat-icon aria-hidden="true">{{ r.state === 'failed' ? 'error' : 'info' }}</mat-icon>@if (r.state === 'failed') { This run failed and cannot be accepted. Review its report, objectives and evidence to diagnose the blocker, then close it from the work item. } @else { Run {{ r.number }} is {{ runTitle[r.state].toLowerCase() }}. You can read it here; verdicts and signatures are closed. }</p> }
        @if (r.layerSource && r.state === 'review') {
          <div class="wr-note wr-integration"><span class="wr-integration-label"><mat-icon aria-hidden="true">difference</mat-icon>
            @if (preparing()) { Preparing the combined review and its checks… }
            @else if (r.integration?.current) { Reviewing {{ r.integration!.commit.slice(0, 12) }} against accepted {{ r.integration!.base.slice(0, 12) }}. }
            @else { This repository review needs preparation against the latest accepted version. }
            </span><button type="button" class="lay-button ghost small" [disabled]="preparing()" (click)="prepareReview()">Refresh against latest</button>
            @if (r.integration?.appChanged) { <button type="button" class="lay-button ghost small" [disabled]="preparing()" title="Creates new review evidence; prior verdicts are retained in history and need checking again." (click)="prepareReview(true)">Rebuild checks</button> }
          </div>
        }
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
                        @case ('source') { @if (change.ownerReview) { <p class="wi-warn wr-owner"><mat-icon aria-hidden="true">shield_person</mat-icon>Changes what this layer runs or may do. Accepting runs this code on the host.</p> }
                          <pre class="wr-diff" [class.wr-diff-wrap]="!change.ownerReview">@for (line of (change.diff || '').split('\n'); track $index) {<span [class]="line[0] === '+' && !line.startsWith('+++') ? 'a' : line[0] === '-' && !line.startsWith('---') ? 'd' : line.startsWith('@@') ? 'h' : ''">{{ line }}</span>}</pre> }
                        @case ('record') { <table class="wr-fields"><thead><tr><th scope="col">Field</th>@if (change.op !== 'created') { <th scope="col">Previous</th> }<th scope="col">{{ change.op === 'created' ? 'Value' : 'Proposed' }}</th></tr></thead>
                          <tbody>@for (field of change.fields || []; track field.name) { <tr><th scope="row">{{ field.name }}</th>@if (change.op !== 'created') { <td><pre>{{ field.before }}</pre></td> }<td><pre>{{ field.after }}</pre></td></tr> }
                          @empty { <tr><td colspan="3" class="lay-muted small">No field changes.</td></tr> }</tbody></table> }
                        @case ('flow') { <section class="wr-flow-new"><h3>New flow</h3><pre class="wr-diff">{{ change.after }}</pre></section> }
                        @case ('flow-revision') { <div class="wr-flow-revision"><section><h3>Previous</h3><pre class="wr-diff">{{ change.before }}</pre></section><section><h3>Proposed</h3><pre class="wr-diff">{{ change.after }}</pre></section></div> }
                        @case ('proposal') { <p class="lay-prose">{{ change.after }}</p><dl class="lay-fieldiff">@for (field of fields(change); track field[0]) { <dt>{{ field[0] }}</dt><dd>{{ field[1] }}</dd> }</dl> }
                        @case ('report') { <p class="lay-prose">{{ change.after }}</p>
                          @if (change.findings) { @for (finding of change.findings; track $index) { <div class="wr-finding"><strong>{{ finding.title }}</strong> <span class="lay-chip lay-info">{{ finding.severity }}</span><p class="small"><strong>Affected:</strong> {{ finding.affected }}</p><p class="small"><strong>Evidence:</strong> {{ finding.evidence }}</p><p class="small"><strong>Suggested:</strong> {{ finding.recommendation }}</p></div> }
                          @empty { <p class="lay-muted small">No findings reported.</p> } } }
                        @case ('file') { @if (diffLines().length && change.id === r.changes.find(entry => entry.kind === 'file')?.id) {
                          <pre class="wr-diff">@for (line of diffLines(); track $index) {<span [class]="line[0] === '+' && !line.startsWith('+++') ? 'a' : line[0] === '-' && !line.startsWith('---') ? 'd' : line.startsWith('@@') ? 'h' : ''">{{ line }}</span>}</pre> } }
                      }
                    </article>
                  } @empty { <p class="lay-muted">Run {{ r.number }} submitted no changes.</p> }
                  @if (r.candidate && !diffLines().length) { <button type="button" class="lay-button ghost small" (click)="loadDiff()">Show the code diff</button> }
                }
                @case ('follow-ups') {
                  <p class="lay-muted small wr-fu-lead">{{ r.performer.label }} proposes this work for a layer to pick up. A task you create is signed as created by {{ r.performer.label }} from {{ layerName(work.layer) }}, and starts in that layer's backlog.</p>
                  @for (entry of r.followUps || []; track entry.id) {
                    <article class="wr-change wr-fu">
                      <header><mat-icon aria-hidden="true">playlist_add</mat-icon><strong>{{ entry.title }}</strong><span class="lay-chip">{{ entry.layerName }}</span>
                        <span [class]="'wi-op wr-fu-' + entry.state">{{ followUpState[entry.state] }}</span></header>
                      <dl class="wr-text"><dt>Why</dt><dd>{{ entry.why }}</dd>@if (entry.brief) { <dt>Brief</dt><dd class="small">{{ entry.brief }}</dd> }</dl>
                      @if (entry.state === 'proposed') {
                        @if (elevated()) { <div class="lay-row lay-wrap"><button type="button" class="lay-button small" (click)="decide(entry.id, 'create')"><mat-icon aria-hidden="true">add_task</mat-icon>Create task in {{ entry.layerName }}</button>
                          <button type="button" class="lay-button ghost small" (click)="decide(entry.id, 'dismiss')">Dismiss</button></div> }
                        @else { <p class="lay-muted small">Someone with elevated {{ layerName(work.layer) }} access decides follow-ups.</p> }
                      } @else if (entry.createdWorkId) { <p class="small">Created <a [href]="ctx.link('work', 'item', entry.createdWorkId)" (click)="ctx.go(ctx.link('work', 'item', entry.createdWorkId), $event)">{{ entry.createdRef }}</a> · {{ entry.decidedBy }}</p> }
                      @else { <p class="lay-muted small">Dismissed by {{ entry.decidedBy }}</p> }
                    </article>
                  }
                }
                @case ('preview') {
                  <div class="wr-preview">
                    <p class="small">Preview of commit {{ (r.integration?.commit || r.candidate?.commit)?.slice(0, 12) || 'not committed' }}: {{ preview()?.status || 'not built' }}@if (preview()?.error) { · {{ preview()?.error }} }</p>
                    @if (preview()?.reason) { <p class="lay-muted">{{ preview()?.reason }}</p> }
                    @if (preview()?.status === 'running') { <iframe [src]="previewUrl()" title="Candidate preview"></iframe><a [href]="preview()?.url" target="_blank" rel="noopener noreferrer">Open in a new tab</a> }
                    @else if (r.state === 'review') { <button type="button" class="lay-button" [disabled]="preparing()" (click)="buildPreview()">Open the isolated preview</button> }
                    @if (r.integration && preview()?.status === 'running') { <button type="button" class="lay-button ghost small" (click)="closePreview()">Stop preview</button> }
                    @if (r.integration?.appRepository && preview()) {
                      <section class="wr-journeys" aria-labelledby="wr-journeys-h"><h2 id="wr-journeys-h" class="lay-eyebrow">Journey steps</h2>
                        @for (journey of journeyGroups(); track journey.id) {
                          <h3>{{ journey.title }} <small class="lay-muted">revision {{ journey.revision }} · {{ journey.origin }}</small></h3>
                          <ol class="wr-steps">@for (step of journey.steps; track step.id) {
                            <li><div class="lay-row lay-wrap"><button type="button" class="lay-button small" [disabled]="preparing() || !r.integration.current || preview()?.status !== 'running' || !step.available" (click)="openStep(step.id)"><mat-icon aria-hidden="true">touch_app</mat-icon>{{ step.label }}</button>
                              <span class="small"><mat-icon aria-hidden="true" [class]="'wr-t-' + (step.result?.status || 'skipped')">{{ stepResult[step.result?.status || 'none'][0] }}</mat-icon>{{ stepResult[step.result?.status || 'none'][1] }}</span>
                              @if (step.result?.screenshot) { <a class="small" [href]="screenshotUrl(step.id)" target="_blank" rel="noopener">Test screenshot</a> }</div>
                              <p class="small">{{ step.expected }}@if (step.persona) { <span class="lay-muted"> · as {{ step.persona }}</span> }</p>
                              @if (!step.available) { <p class="small lay-muted">{{ step.reason }}</p> }
                              @if (step.result?.detail) { <p class="small lay-muted">{{ step.result.detail }}</p> }</li>
                          }</ol>
                        } @empty { <p class="lay-muted small">This app declares no journeys in .aludel/outputs/journeys.json, so its preview has no guided steps.</p> }
                      </section>
                      @if (preview()?.separability; as seams) { @if (seams.undeclared.length) {
                        <p class="wi-warn small"><mat-icon aria-hidden="true">link</mat-icon>@if (!seams.seamsFile) { This app has no .aludel/seams.json. } These files name Aludel outside .aludel/ without a declared seam: {{ seams.undeclared.join(', ') }}</p> } }
                    }
                  </div>
                }
                @case ('tests') {
                  @if (r.layerSource; as branch) { <p class="small lay-muted">Run by the agent in its sandbox on <code>{{ branch.branch }}</code> ({{ branch.commit.slice(0, 12) }}) against a copy of the layer's outputs.</p> }
                  <ul class="wr-tests">@for (check of testsOf(r); track $index) {
                    <li [class.hl]="focus() === 'test:' + $index"><mat-icon aria-hidden="true" [class]="'wr-t-' + check.status">{{ check.status === 'passed' ? 'check_circle' : check.status === 'failed' ? 'cancel' : 'radio_button_unchecked' }}</mat-icon>
                      <span>{{ check.name }}<small>{{ check.source === 'person-report' ? 'Reported by the performer; not re-run by Aludel' : check.source === 'agent-report' ? 'Reported by the agent; not re-run by Aludel' : 'Run by Aludel' }}@if (check.detail) { · {{ check.detail }} }</small></span></li> }</ul>
                }
              }
            </div>
          </section>

          <section class="wr-stepper" aria-label="Claims">
            @if (!onEnd()) {
              @if (criterion(); as c) {
                <div class="wr-step">
                  <p class="lay-eyebrow">Claim {{ c.index + 1 }} of {{ r.task.criteria.length }} · {{ claimKind[c.kind] }}</p>
                  <h2>{{ c.text }}</h2>
                  @if (r.proofs[c.id]; as proof) {
                    <div class="wr-proof" [class.bad]="proof.status !== 'passed'"><p class="small"><mat-icon aria-hidden="true" [class]="'wr-t-' + (proof.status === 'passed' ? 'passed' : proof.status === 'failed' ? 'failed' : 'skipped')">{{ proofStatus[proof.status][0] }}</mat-icon>
                      <strong>{{ c.covers === 'journeys' ? 'Every other journey step on this build' : 'Step tests on this build' }}: {{ proofStatus[proof.status][1] }}</strong>@if (proof.detail) { · {{ proof.detail }} }</p>
                      @if (proof.steps.length) { <ul class="wr-proof-steps">@for (stepProof of proof.steps; track stepProof.id) { @if (c.covers !== 'journeys' || stepProof.status === 'failed') {
                        <li class="small"><mat-icon aria-hidden="true" [class]="'wr-t-' + (stepProof.status === 'passed' ? 'passed' : stepProof.status === 'failed' ? 'failed' : 'skipped')">{{ proofStatus[stepProof.status][0] }}</mat-icon>{{ stepProof.id }}: {{ proofStatus[stepProof.status][1] }}
                          @if (stepProof.screenshot) { · <a [href]="screenshotUrl(stepProof.id)" target="_blank" rel="noopener">screenshot</a> }@if (stepProof.detail) { <span class="lay-muted"> · {{ stepProof.detail }}</span> }</li> } }</ul> }
                      @if (r.reasons[c.id]) { <p class="small"><strong>{{ r.performer.label }} says why:</strong> {{ r.reasons[c.id] }}</p> }
                      @if (c.kind === 'journey' && r.integration?.appRepository) { <button type="button" class="lay-button ghost small" (click)="view.set('preview')"><mat-icon aria-hidden="true">route</mat-icon>Walk {{ c.steps?.length }} {{ c.steps?.length === 1 ? 'step' : 'steps' }} in Preview</button> }
                    </div>
                  } @else if (c.kind === 'note') { <p class="small lay-muted">Free text: no layer describes this yet, so you judge it from the evidence.</p> }
                  @if (!r.proofs[c.id] && r.integration?.appRepository && preview()?.steps?.length) {
                    <button type="button" class="lay-button ghost small" (click)="view.set('preview')"><mat-icon aria-hidden="true">route</mat-icon>Walk {{ preview()?.steps?.length }} journey steps in Preview</button>
                  }
                  <div><p class="lay-eyebrow">To verify, check</p>
                    <div class="wr-evs">@for (entry of evidence(); track $index) {
                      <button type="button" [class]="'wr-ev wr-ev-' + entry.type" [class.missing]="entry.missing" [disabled]="!entry.look" (click)="look(entry.look)"><mat-icon aria-hidden="true">{{ evidenceType[entry.type][0] }}</mat-icon>
                        <span><small class="wr-ev-type">{{ evidenceType[entry.type][1] }}</small>{{ entry.label }}<small>{{ entry.detail }}</small></span>@if (entry.result) { <span class="small">{{ entry.result }}</span> }</button>
                    } @empty { <p class="lay-muted small">This run produced nothing to check against. Reject it or skip.</p> }</div>
                    <p class="small lay-muted wr-legend"><mat-icon aria-hidden="true">info</mat-icon>{{ named() ? 'Named by the run when it submitted. Each item points at something it produced; Aludel re-runs tests where it can.' : 'This run named no evidence per claim, so this lists everything it produced.' }}</p></div>
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
                <ul class="wr-sum">@for (c of r.task.criteria; track c.id) { <li><mat-icon aria-hidden="true" [class]="'wr-sum-' + (r.review.verdicts[c.id]?.value || 'none')">{{ r.review.verdicts[c.id]?.value === 'accept' ? 'check_circle' : r.review.verdicts[c.id]?.value === 'reject' ? 'flag' : 'radio_button_unchecked' }}</mat-icon>
                  <span>{{ c.text }}@if (r.review.verdicts[c.id]?.note) { <small>{{ r.review.verdicts[c.id]?.note }}</small> }@if (r.review.verdicts[c.id]?.value === 'skip') { <small>Skipped</small> }@if (r.proofs[c.id] && r.proofs[c.id].status !== 'passed') { <small>Step tests: {{ proofStatus[r.proofs[c.id].status][1] }}</small> }</span></li> }
                  @for (change of flaggedChanges(); track change.id) { <li><mat-icon aria-hidden="true" class="wr-sum-reject">flag</mat-icon><span>{{ change.name }}<small>{{ r.review.flags[change.id] }}</small></span></li> }</ul>
                @if (!flagCount() && blocking().length) { <p class="wi-warn" role="status"><mat-icon aria-hidden="true">block</mat-icon>This run can't be accepted: {{ blockingText() }}. {{ r.performer.kind === 'person' ? 'Send it back, or ask ' + r.performer.label + ' to state why when they submit.' : 'Send it back; the failing steps go to the next run.' }}</p> }
                @else if (!flagCount() && excused().length) { <p class="wi-warn"><mat-icon aria-hidden="true">info</mat-icon>Accepting signs over {{ excused().length }} unproven {{ excused().length === 1 ? 'claim' : 'claims' }} that {{ r.performer.label }} gave a reason for.</p> }
                @if (!flagCount() && unchecked()) { <p class="wi-warn"><mat-icon aria-hidden="true">warning</mat-icon>Accepting now signs for {{ unchecked() }} {{ unchecked() === 1 ? 'claim' : 'claims' }} you didn't check.</p> }
                <label for="wr-comment">Overall comment (optional)</label>
                <textarea id="wr-comment" rows="3" [(ngModel)]="comment" [placeholder]="flagCount() ? 'What should the next run do differently?' : 'Anything to note for the record'"></textarea>
                <p class="small lay-muted">{{ flagCount() ? 'Nothing is applied. The task opens again as Next run with your flags and comment carried in.'
                  : r.performer.kind === 'person' && !r.layerSource ? 'Signs off the recorded work and closes ' + work.ref + '.' : 'Applies the run\\'s changes and closes ' + work.ref + '.' }}</p>
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
              } @else if (r.state === 'review' && !elevated()) {
                <span class="lay-muted small">Elevated {{ layerName(work.layer) }} access is required to sign.</span>
              } @else if (r.state === 'review') {
                <button type="button" [class]="'lay-button ' + (flagCount() ? 'danger' : 'lay-button-ok')" [disabled]="preparing() || (!flagCount() && ((!!r.layerSource && !r.integration?.current) || blocking().length > 0))" (click)="sign(flagCount() ? 'reject' : 'accept')"><mat-icon aria-hidden="true">draw</mat-icon>{{ flagCount() ? 'Sign and send back' : 'Sign and accept' }}</button>
                @if (!flagCount() && blocking().length) { <button type="button" class="lay-button danger" [disabled]="preparing()" (click)="sign('reject')"><mat-icon aria-hidden="true">undo</mat-icon>Sign and send back</button> }
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
  readonly followUpState = { proposed: 'Proposed', created: 'Created', dismissed: 'Dismissed' };
  // DEC-057: signing a layer-scoped item's run and deciding its follow-ups need elevated access to its layer.
  readonly elevated = computed(() => { const work = this.item(); return !work || work.scope !== 'layer' || Boolean(this.ctx.layerInstances().find(entry => entry.key === work.layer)?.elevated); });
  readonly item = computed(() => this.ctx.workById().get(this.id()) || null);
  readonly runs = signal<WorkRun[]>([]);
  readonly loaded = signal(false);
  readonly run = computed(() => this.runs().find(run => String(run.number) === this.number()) || null);
  readonly step = signal(0);
  readonly view = signal('changes');
  readonly focus = signal<string | null>(null);
  readonly diffLines = signal<string[]>([]);
  readonly preparing = signal(false);
  readonly preview = signal<ReviewPreview | null>(null);
  readonly previewDestination = signal<string | null>(null);
  readonly stepResult = stepResult;
  readonly claimKind = claimKind;
  readonly proofStatus = proofStatus;
  // Grouped by journey, in journey order. A journey claim names its steps; the stepper shows their proof.
  readonly journeyGroups = computed(() => { const preview = this.preview();
    return (preview?.journeys || []).map(journey => ({ ...journey, steps: (preview?.steps || []).filter(step => step.journey === journey.id) })); });
  comment = ''; noteDraft = '';
  private loadedFor = '';
  readonly onEnd = computed(() => this.step() >= (this.run()?.task.criteria.length ?? 0));
  readonly criterion = computed(() => this.run()?.task.criteria[this.step()] || null);
  readonly verdict = computed(() => { const claim = this.criterion(); return claim ? this.run()?.review.verdicts[claim.id] || null : null; });
  // JOURNEYS-01 J4: claims whose step tests aren't passing on this build stop acceptance, unless a person gave a reason.
  readonly blocking = computed(() => { const r = this.run(); return r ? r.gate.filter(entry => r.performer.kind !== 'person' || !entry.reason) : []; });
  readonly excused = computed(() => { const r = this.run(); return r ? r.gate.filter(entry => r.performer.kind === 'person' && entry.reason) : []; });
  readonly blockingText = computed(() => this.blocking().map(entry => `“${entry.text}” is ${entry.status === 'not-run' ? 'not proven yet (open the preview to run its step tests)' : proofStatus[entry.status][1].toLowerCase()}`).join('; '));
  readonly tabs = computed(() => { const r = this.run(); if (!r) return [];
    return [{ id: 'changes', label: 'Changes', icon: 'difference', count: r.changes.length },
      ...(r.followUps?.length ? [{ id: 'follow-ups', label: 'Follow-ups', icon: 'playlist_add', count: r.followUps.length }] : []),
      ...(r.candidate || r.integration?.appRepository ? [{ id: 'preview', label: 'Preview', icon: 'web', count: 0 }] : []),
      ...(this.testsOf(r).length ? [{ id: 'tests', label: 'Tests', icon: 'science', count: this.testsOf(r).length }] : [])]; });
  // The evidence the run named for this criterion (WI-6). Runs that named none fall back to everything they produced.
  readonly named = computed(() => (this.run()?.evidence || []).length > 0);
  readonly evidence = computed<Evidence[]>(() => { const r = this.run(); if (!r) return [];
    const claim = this.criterion();
    if (this.named()) return r.evidence.filter(item => item.claim === claim?.id).map(item => ({
      type: item.type, label: item.step ? `${item.label} · step ${item.step}` : item.label, look: item.target || '',
      detail: !item.found ? 'Named by the performer, but not in the review packet' : item.type === 'test' ? (item.independent ? 'Run by Aludel' : 'Reported by the agent; not re-run') : item.type === 'try' ? item.ref : item.note,
      result: item.type === 'test' ? item.result || undefined : undefined, missing: !item.found }));
    return [...r.changes.map(change => ({ type: 'change' as const, label: change.name, detail: `${this.opLabel[change.op]}${change.size ? ' · ' + change.size : ''}`, look: `change:${change.id}` })),
      ...this.testsOf(r).map((check, index) => ({ type: 'test' as const, label: check.name, detail: check.source === 'person-report' ? 'Reported by the performer' : check.source === 'agent-report' ? 'Reported by the agent' : 'Run by Aludel', look: `test:${index}`, result: check.status }))]; });
  readonly flaggedChanges = computed(() => { const r = this.run(); return r ? r.changes.filter(change => r.review.flags[change.id] !== undefined) : []; });
  readonly flagCount = computed(() => { const r = this.run(); return r ? Object.values(r.review.verdicts).filter(value => value.value === 'reject').length + this.flaggedChanges().length : 0; });
  readonly unchecked = computed(() => { const r = this.run(); return r ? r.task.criteria.filter(c => !r.review.verdicts[c.id] || r.review.verdicts[c.id].value === 'skip').length : 0; });
  readonly back = computed(() => this.ctx.link('work', 'item', this.id()));
  private readonly sanitizer = inject(DomSanitizer);
  // The candidate's own isolated preview, served by this portal; nothing else is framed.
  readonly previewUrl = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.previewDestination() || this.preview()?.url || 'about:blank'));

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
        const next = r ? r.task.criteria.findIndex(c => !r.review.verdicts[c.id]) : -1;
        this.step.set(next < 0 ? r?.task.criteria.length || 0 : next);
        if (r?.layerSource && r.state === 'review' && this.elevated()) this.prepareReview();
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
    return this.ctx.write(async () => { const updated = await this.ctx.api<WorkRun>(`${this.base()}/work/${encodeURIComponent(this.id())}/runs/${encodeURIComponent(r.id)}/review`, 'PUT', { ...(body as object), integrationId: r.integration?.id });
      this.runs.set(this.runs().map(run => run.id === updated.id ? updated : run)); }); }
  setVerdict(value: 'accept' | 'reject' | 'skip') {
    const index = this.step(), claim = this.criterion()?.id; const current = this.verdict()?.value;
    if (!claim) return;
    if (value === 'reject') { void this.review({ verdict: { claim, value: current === 'reject' ? null : 'reject', note: this.noteDraft } }).then(() => setTimeout(() => document.getElementById('wr-note')?.focus())); return; }
    void this.review({ verdict: { claim, value } }).then(() => this.goTo(index + 1));
  }
  saveNote() { const claim = this.criterion()?.id; if (claim && this.verdict()?.value === 'reject') void this.review({ verdict: { claim, value: 'reject', note: this.noteDraft } }); }
  toggleFlag(id: string) { void this.review({ flag: { id, on: this.run()?.review.flags[id] === undefined, note: '' } }); }
  saveFlag(id: string, note: string) { void this.review({ flag: { id, note } }); }
  sign(outcome: 'accept' | 'reject') { const r = this.run(); if (!r) return;
    void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/work/${encodeURIComponent(this.id())}/runs/${encodeURIComponent(r.id)}/sign`, 'POST', { outcome, comment: this.comment, integrationId: r.integration?.id }); this.ctx.go(this.back()); },
      outcome === 'accept' ? r.performer.kind === 'person' && !r.layerSource ? `Run ${r.number} accepted and signed off.` : `Run ${r.number} accepted and applied.`
        : `Run ${r.number} sent back. The task is open again in Next run.`); }
  loadDiff() { const r = this.run(); if (!r?.candidate) return;
    void this.ctx.api<{ diff: string }>(`${this.base()}/candidates/${encodeURIComponent(r.candidate.id)}`).then(value => this.diffLines.set((value.diff || '').split('\n').slice(0, 2000)), () => this.diffLines.set([])); }
  private runPath(run: WorkRun) { return `${this.base()}/work/${encodeURIComponent(this.id())}/runs/${encodeURIComponent(run.id)}`; }
  prepareReview(rebuild = false) { const r = this.run(); if (!r?.layerSource || this.preparing()) return;
    this.preparing.set(true); this.preview.set(null); this.previewDestination.set(null);
    void this.ctx.write(async () => {
      const value = await this.ctx.api<{ run: WorkRun }>(`${this.runPath(r)}/prepare`, 'POST', { rebuild });
      this.runs.set(this.runs().map(run => run.id === value.run.id ? value.run : run));
      if (value.run.integration?.appChanged) await this.loadIntegratedPreview(value.run);
    }).finally(() => this.preparing.set(false));
  }
  private async loadIntegratedPreview(r: WorkRun) {
    const value = await this.ctx.api<{ preview: ReviewPreview }>(`${this.runPath(r)}/preview`, 'POST', { integrationId: r.integration?.id });
    this.preview.set(value.preview);
    const history = await this.ctx.api<{ runs: WorkRun[] }>(`${this.base()}/work/${encodeURIComponent(this.id())}/runs`);
    this.runs.set(history.runs);
  }
  buildPreview() { const r = this.run(); if (!r || this.preparing()) return;
    this.preparing.set(true);
    void this.ctx.write(async () => {
      if (r.integration) return this.loadIntegratedPreview(r);
      if (!r.candidate) return;
      const value = await this.ctx.api<{ preview: { status: string; error?: string | null }; url: string }>(`${this.base()}/candidates/${encodeURIComponent(r.candidate.id)}/preview`, 'POST', {});
      this.preview.set({ ...value.preview, url: value.url });
    }).finally(() => this.preparing.set(false));
  }
  screenshotUrl(step: string) { const r = this.run(); return r?.integration ? `${this.runPath(r)}/step-screenshot?integrationId=${encodeURIComponent(r.integration.id)}&step=${encodeURIComponent(step)}` : ''; }
  openStep(id: string) { const r = this.run(); if (!r?.integration) return;
    void this.ctx.write(async () => {
      const value = await this.ctx.api<{ url: string }>(`${this.runPath(r)}/scenario`, 'POST', { integrationId: r.integration!.id, step: id });
      this.previewDestination.set(value.url); this.view.set('preview');
    });
  }

  closePreview() { const r = this.run(); if (!r?.integration) return;
    void this.ctx.write(async () => { const value = await this.ctx.api<{ preview: ReviewPreview }>(`${this.runPath(r)}/close-preview`, 'POST', { integrationId: r.integration!.id }); this.preview.set(value.preview); });
  }
  testsOf(run: WorkRun) { return run.integration?.tests?.length ? run.integration.tests : run.candidate?.checks?.length ? run.candidate.checks : run.layerSource?.tests || []; }
  layerName(key: string) { return this.ctx.layerInstances().find(entry => entry.key === key)?.name || key; }
  decide(followUpId: string, decision: 'create' | 'dismiss') {
    void this.ctx.write(async () => {
      await this.ctx.api(`${this.base()}/work/${encodeURIComponent(this.id())}/follow-ups/${encodeURIComponent(followUpId)}`, 'POST', { decision });
      this.load();
    }, decision === 'create' ? 'Follow-up task created.' : 'Follow-up dismissed.');
  }
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
