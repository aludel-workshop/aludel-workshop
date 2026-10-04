import { Component, HostListener, OnDestroy, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClaimKind, ProjectContext, ProofStatus, RunChange, RunFollowUp, WorkRun } from './context';
import { AvatarComponent, RefChipComponent } from './work-shared';
import { reviewFocus, runTitle } from './work-run';

// JOURNEYS-01 J3: review steps come from the candidate's journeys, each with the result its step test had on this build.
type StepResult = { status: 'passed' | 'failed' | 'skipped' | 'uncovered' | 'no-fixture'; detail?: string | null; screenshot?: boolean };
type ReviewStep = { id: string; journey: string; step: string; label: string; trigger?: string; expected: string; persona: string | null; path: string | null; available: boolean; reason: string | null; result: StepResult | null };
type ReviewPreview = { status: string; error?: string | null; reason?: string | null; url: string; journeys?: { id: string; title: string; revision: number; origin: string; persona?: string | null }[]; steps?: ReviewStep[];
  separability?: { seamsFile: boolean; declared: number; undeclared: string[] } | null };
type Claim = WorkRun['task']['criteria'][number];
// One page of the review: a claim's card (or one of its journey steps), a suggestion the run made, its question, or Finish.
type Page = { key: string; kind: 'claim'; claim: Claim } | { key: string; kind: 'suggestion'; followUp: RunFollowUp } | { key: string; kind: 'question' } | { key: string; kind: 'finish' };
type Walk = { aludelWalk: 1; kind: 'page' | 'action'; path: string; method?: string; page?: string };
const stepResult: Record<StepResult['status'] | 'none', [string, string]> = { passed: ['check_circle', 'Test passed'], failed: ['cancel', 'Test failed'], skipped: ['radio_button_unchecked', 'Not run'],
  uncovered: ['remove', 'No test'], 'no-fixture': ['person_off', 'No fixture'], none: ['radio_button_unchecked', 'Not run yet'] };
// JOURNEYS-01 J4: what each kind of claim is, and how a claim's automated proof reads.
const claimKind: Record<ClaimKind, [string, string]> = { journey: ['route', 'Journey'], record: ['description', 'Layer record'], invariant: ['shield', 'Regression'], note: ['sticky_note_2', 'Note'] };
const proofStatus: Record<ProofStatus, [string, string]> = { passed: ['check_circle', 'Passed'], failed: ['cancel', 'Failed'], 'no-fixture': ['person_off', 'No fixture'], uncovered: ['remove', 'No test'],
  skipped: ['radio_button_unchecked', 'Not run after a failure'], missing: ['help', 'Not in the build'], stale: ['history', 'Older revision built'], unsigned: ['edit_off', 'Not written as authored'], 'not-run': ['radio_button_unchecked', 'Not run yet'] };
type Evidence = { type: 'change' | 'test' | 'try' | 'check' | 'note'; label: string; detail: string; look: string; result?: string; missing?: boolean };
const evidenceType: Record<Evidence['type'], [string, string]> = { change: ['difference', 'Change'], test: ['science', 'Test'], try: ['touch_app', 'Try it'], check: ['verified', 'Aludel check'], note: ['person', 'Performer evidence'] };
const routeOf = (path: string | null | undefined) => (path || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';

// JOURNEYS-01 J6 (docs/design/journeys/work-record.md): reviewing one run. One header line over two panels: the evidence for
// the current claim on the left (the live preview for a journey, the test run for a regression, the changes for a record),
// with Under the hood at its bottom; on the right a claim at a time, its journey walked step by step, then the run's
// suggestions and question, then Finish. Walking the journey in the preview moves the review on.
@Component({
  selector: 'aludel-work-review', standalone: true, imports: [FormsModule, NgTemplateOutlet, MatIconModule, MatTooltipModule, AvatarComponent, RefChipComponent],
  template: `
  @if (item(); as work) {
    @if (run(); as r) {
      <div class="wr">
        <header class="wr-head">
          <div class="wr-head-main">
            <a class="lay-button ghost small wr-icon" [href]="back()" (click)="ctx.go(back(), $event)" aria-label="Close review"><mat-icon aria-hidden="true">close</mat-icon></a>
            <h1 tabindex="-1">{{ work.ref }} · Run {{ r.number }}<span class="visually-hidden">: review of {{ work.title }}</span></h1>
            <span class="wr-who"><aludel-avatar [who]="{ kind: r.performer.kind, id: r.performer.id }" />{{ r.performer.label }}</span>
            @if (r.integration; as built) {
              <span class="wr-commit" tabindex="0" [matTooltip]="'Reviewing ' + built.commit.slice(0, 12) + ' against accepted ' + built.base.slice(0, 12)"><mat-icon aria-hidden="true">commit</mat-icon>{{ built.commit.slice(0, 7) }}<span class="visually-hidden">, against accepted {{ built.base.slice(0, 7) }}</span></span>
            } @else if (r.candidate?.commit) { <span class="wr-commit"><mat-icon aria-hidden="true">commit</mat-icon>{{ r.candidate!.commit!.slice(0, 7) }}</span> }
            @if (preparing()) { <span class="wr-stale" role="status"><mat-icon aria-hidden="true">progress_activity</mat-icon>Preparing the review…</span> }
            @else if (r.layerSource && r.state === 'review' && !r.integration?.current) {
              <span class="wr-stale"><mat-icon aria-hidden="true">history</mat-icon>{{ r.integration ? 'The accepted head moved.' : 'Not prepared yet.' }}</span>
              <button type="button" class="lay-button ghost small" (click)="prepareReview()">Refresh against latest</button>
            }
            <span class="wr-head-tools">
              @if (views().length > 1) { <span class="wr-seg" role="group" aria-label="Evidence">@for (option of views(); track option.id) { <button type="button" [attr.aria-pressed]="leftView() === option.id" (click)="viewChoice.set(option.id)">{{ option.label }}</button> }</span> }
              @if (persona(); as who) { <span class="wr-persona"><mat-icon aria-hidden="true">badge</mat-icon>as {{ who }}</span> }
            </span>
          </div>
          <div class="wr-head-claim">
            <div class="wr-pick">
              <button type="button" class="wr-pickbtn" (click)="menu.set(!menu())" aria-haspopup="true" [attr.aria-expanded]="menu()" aria-controls="wr-menu">
                <span class="wr-pick-n">{{ pageLabel(current()) }}</span><span class="wr-pick-t">{{ pageTitle(current()) }}</span>
                @if (badgeOf(current()); as b) { <span [class]="'wr-badge ' + b[0]"><mat-icon aria-hidden="true">{{ b[1] }}</mat-icon>{{ b[2] }}</span> }
                <mat-icon aria-hidden="true">expand_more</mat-icon></button>
              @if (menu()) {
                <ul class="wr-menu" id="wr-menu" aria-label="Review pages">@for (entry of pages(); track entry.key) {
                  <li><button type="button" [attr.aria-current]="entry.key === current().key ? 'true' : null" (click)="open(entry.key)"><span class="wr-menu-k">{{ pageLabel(entry) }}</span><span class="wr-menu-t">{{ pageTitle(entry) }}</span>
                    @if (badgeOf(entry); as b) { <span [class]="'wr-badge ' + b[0]"><mat-icon aria-hidden="true">{{ b[1] }}</mat-icon>{{ b[2] }}</span> }</button></li> }</ul>
              }
            </div>
          </div>
        </header>
        <div class="wr-panes">
          <section class="wr-left" aria-label="Evidence">
            <div class="wr-left-body">
              @switch (leftView()) {
                @case ('preview') {
                  @if (preview()?.status === 'running') {
                    <div class="wr-frame"><div class="wr-fhead"><span class="wr-flabel">Proposed</span><span class="wr-addr">{{ walkPath() || stepPath() || '/' }}</span>
                      @if (journey(); as j) { @if (r.state === 'review' && stepIndex() !== null) { <button type="button" class="lay-button ghost small wr-icon" [disabled]="preparing()" (click)="walk(0)" matTooltip="Start the journey again from its first step"><mat-icon aria-hidden="true">restart_alt</mat-icon><span class="visually-hidden">Start the journey again</span></button> } }
                      <a class="lay-button ghost small wr-icon" [href]="preview()?.url" target="_blank" rel="noopener noreferrer" matTooltip="Open in a new tab"><mat-icon aria-hidden="true">open_in_new</mat-icon><span class="visually-hidden">Open the preview in a new tab</span></a></div>
                      <iframe id="wr-frame" [src]="previewUrl()" title="Preview of the reviewed build"></iframe></div>
                  } @else {
                    <div class="wr-state"><mat-icon aria-hidden="true">{{ preview()?.status === 'error' ? 'error' : 'web' }}</mat-icon>
                      <p><strong>{{ preparing() ? 'Building the reviewed commit and running its step tests…' : preview()?.status ? 'The preview is ' + preview()?.status + '.' : 'The preview is not running.' }}</strong></p>
                      @if (preview()?.error) { <p class="small">{{ preview()?.error }}</p> }@if (preview()?.reason) { <p class="small">{{ preview()?.reason }}</p> }
                      @if (r.state === 'review' && !preparing()) { <button type="button" class="lay-button" (click)="buildPreview()">Open the isolated preview</button> }</div>
                  }
                }
                @case ('tests') {
                  <div class="wr-pane">
                    @if (preview()?.steps?.length) {
                      <h2 class="wr-eyebrow">Step tests on {{ (r.integration?.commit || '').slice(0, 7) }}</h2>
                      <table class="wr-reg"><thead><tr><th scope="col">Journey</th><th scope="col">Step</th><th scope="col">Test</th></tr></thead><tbody>
                        @for (step of preview()!.steps!; track step.id) { <tr [class.wr-claimed]="claimedStep(step)"><td>{{ journeyTitle(step.journey) }}</td><td>{{ step.label }}</td>
                          <td><mat-icon aria-hidden="true" [class]="'wr-t-' + (step.result?.status || 'skipped')">{{ stepResult[step.result?.status || 'none'][0] }}</mat-icon>{{ stepResult[step.result?.status || 'none'][1] }}
                            @if (step.result?.screenshot) { · <a [href]="screenshotUrl(step.id)" target="_blank" rel="noopener">screenshot<span class="visually-hidden"> of {{ step.label }}</span></a> }
                            @if (step.result?.detail) { <small>{{ step.result!.detail }}</small> }</td></tr> }</tbody></table>
                    }
                    <h2 class="wr-eyebrow">Checks</h2>
                    <ng-container [ngTemplateOutlet]="testList" />
                  </div>
                }
                @default { <div class="wr-pane"><ng-container [ngTemplateOutlet]="changeList" /></div> }
              }
            </div>
            @if (hood()) {
              <div class="wr-hood" id="wr-hood" role="region" aria-label="Under the hood">
                <div class="wr-hood-col">
                  <h2 class="wr-eyebrow">Changed files and records</h2>
                  <ul class="wr-files">@for (change of r.changes; track change.id) { <li><button type="button" class="lay-link-button" (click)="look('change:' + change.id)">{{ change.name }}</button><span class="small">{{ opLabel[change.op] }}@if (change.size) { · {{ change.size }} }</span></li> }
                    @empty { <li class="small">No changes.</li> }</ul>
                  @if (r.integration?.appChanged && r.state === 'review') { <button type="button" class="lay-button ghost small" [disabled]="preparing()" title="Creates new review evidence; your progress is kept." (click)="prepareReview(true)">Rebuild checks</button> }
                  @if (r.integration && preview()?.status === 'running') { <button type="button" class="lay-button ghost small" (click)="closePreview()">Stop preview</button> }
                  @if (preview()?.separability; as seams) { @if (seams.undeclared.length) {
                    <p class="wi-warn small"><mat-icon aria-hidden="true">link</mat-icon>@if (!seams.seamsFile) { This app has no .aludel/seams.json. } These files name Aludel outside .aludel/ without a declared seam: {{ seams.undeclared.join(', ') }}</p> } }
                </div>
                <div class="wr-hood-col"><h2 class="wr-eyebrow">Checks</h2><ng-container [ngTemplateOutlet]="testList" /></div>
              </div>
            }
            <div class="wr-bar"><button type="button" class="wr-hood-toggle" (click)="hood.set(!hood())" [attr.aria-expanded]="hood()" aria-controls="wr-hood"><mat-icon aria-hidden="true" class="wr-chev">expand_less</mat-icon>Under the hood
              <span class="small">· {{ r.changes.length }} {{ r.changes.length === 1 ? 'change' : 'changes' }}@if (testsOf(r).length) { · checks {{ passedChecks(r) }} of {{ testsOf(r).length }} passed }</span></button></div>
          </section>

          <section class="wr-right" [class.wr-cover]="stepIndex() === null" [attr.aria-label]="stepIndex() === null ? 'Review' : 'Journey step'">
            <div class="wr-body">
              @if (r.state !== 'review') { <p class="wr-note"><mat-icon aria-hidden="true">{{ r.state === 'failed' ? 'error' : 'info' }}</mat-icon>@if (r.state === 'failed') { This run failed and cannot be accepted. Review its report, objectives and evidence to diagnose the blocker, then close it from the work item. } @else { Run {{ r.number }} is {{ runTitle[r.state].toLowerCase() }}. You can read it here; decisions are closed. }</p> }
              @switch (current().kind) {
                @case ('claim') { @if (claim(); as c) {
                  @if (c.kind === 'journey' && stepIndex() !== null) {
                    @if (journeyStep(); as s) {
                      <div class="wr-row small"><button type="button" class="lay-button ghost small" (click)="toCard()"><mat-icon aria-hidden="true">arrow_back</mat-icon>{{ journeyName(c) }}</button><span>Step {{ stepIndex()! + 1 }} of {{ journeySteps(c).length }}</span></div>
                      <div><h2 id="wr-ph" tabindex="-1">{{ s.label }}</h2>
                        <div class="wr-row wr-wrap">@if (claimedStep(s)) { <span class="wr-badge new">Changed in this run</span> } @else { <span class="wr-badge">Unchanged, walked for context</span> }@if (s.persona) { <span class="wr-badge"><mat-icon aria-hidden="true">badge</mat-icon>as {{ s.persona }}</span> }</div></div>
                      <dl class="wr-spec">@if (s.trigger) { <dt>Do</dt><dd>{{ s.trigger }}</dd> }<dt>Expect</dt><dd>{{ s.expected }}</dd>@if (s.path) { <dt>Where</dt><dd><code>{{ s.path }}</code></dd> }</dl>
                      @if (!s.available && s.reason) { <p class="wr-caution"><mat-icon aria-hidden="true">info</mat-icon>{{ s.reason }}</p> }
                      @switch (stepMark(c, s)?.value) {
                        @case ('ok') { <p class="wr-done"><mat-icon aria-hidden="true">check</mat-icon>Walked: looks good.</p> }
                        @case ('flag') { <div class="wr-flagnote"><mat-icon aria-hidden="true">flag</mat-icon><span><strong>Flagged:</strong> {{ stepMark(c, s)?.note }}</span>
                          @if (r.state === 'review') { <button type="button" class="wr-x" (click)="markStep(c, s, null)" aria-label="Remove the flag"><mat-icon aria-hidden="true">close</mat-icon></button> }</div> }
                        @default { @if (r.state === 'review') { <p class="wr-doit"><mat-icon aria-hidden="true">touch_app</mat-icon>Do it in the preview. When you do, the review moves on to the next step.</p> } }
                      }
                      <details class="wr-proofd" [open]="(s.result?.status || 'none') !== 'passed'"><summary><mat-icon aria-hidden="true" [class]="'wr-t-' + (s.result?.status || 'skipped')">{{ stepResult[s.result?.status || 'none'][0] }}</mat-icon>{{ stepResult[s.result?.status || 'none'][1] }}<mat-icon aria-hidden="true" class="wr-chev">expand_more</mat-icon></summary>
                        <div class="wr-proofd-body">@if (s.result?.detail) { <p>{{ s.result!.detail }}</p> }<p class="small">Step test for {{ s.step }} on {{ (r.integration?.commit || '').slice(0, 7) }}</p>
                          @if (s.result?.screenshot) { <a [href]="screenshotUrl(s.id)" target="_blank" rel="noopener"><mat-icon aria-hidden="true">image</mat-icon>Test screenshot<span class="visually-hidden"> of {{ s.label }}</span></a> }</div></details>
                      @if (composing() === 'step') { <ng-container [ngTemplateOutlet]="composer" [ngTemplateOutletContext]="{ $implicit: 'What is wrong with this step?' }" /> }
                    }
                  } @else {
                    <div class="wr-coverhead"><span class="wr-kind"><mat-icon aria-hidden="true">{{ claimKind[c.kind][0] }}</mat-icon>Claim {{ c.index + 1 }} · {{ c.covers === 'journeys' ? 'Regression' : claimKind[c.kind][1] }}</span>
                      <h2 id="wr-ph" tabindex="-1">{{ c.kind === 'journey' ? journeyName(c) : c.text }}</h2>
                      <p class="wr-lead">{{ claimLead(c) }}</p></div>
                    @if (c.kind === 'journey') {
                      <ol class="wr-slist" aria-label="Steps">@for (s of journeySteps(c); track s.id; let i = $index) {
                        <li><button type="button" class="wr-srow" (click)="enterStep(i)"><span [class]="'wr-num ' + (stepMark(c, s)?.value || '')">@switch (stepMark(c, s)?.value) { @case ('flag') { <mat-icon aria-hidden="true">flag</mat-icon> } @case ('ok') { <mat-icon aria-hidden="true">check</mat-icon> } @default { {{ i + 1 }} } }</span>
                          <span class="wr-nm">{{ s.label }}</span><mat-icon aria-hidden="true" [class]="'wr-t-' + (s.result?.status || 'skipped')">{{ stepResult[s.result?.status || 'none'][0] }}</mat-icon><span class="visually-hidden">{{ stepResult[s.result?.status || 'none'][1] }}</span>
                          <span class="wr-sub">@if (claimedStep(s)) { <span class="wr-badge new">Changed</span> } @else { <span class="wr-badge">Unchanged</span> }{{ stepMark(c, s)?.value === 'ok' ? 'Looks good' : stepMark(c, s)?.value === 'flag' ? 'Flagged' : walkedCount(c) ? 'Not walked' : '' }}</span>
                          @if (stepMark(c, s)?.value === 'flag') { <span class="wr-fl"><mat-icon aria-hidden="true">flag</mat-icon>{{ stepMark(c, s)?.note }}</span> }</button></li>
                      } @empty { <li class="small">This build's journeys aren't loaded yet. Open the preview to walk it.</li> }</ol>
                    }
                    <ng-container [ngTemplateOutlet]="proofBlock" [ngTemplateOutletContext]="{ $implicit: c }" />
                    @for (entry of gateOf(c); track entry.claim) { <p class="wr-blocker"><mat-icon aria-hidden="true">block</mat-icon>{{ entry.status === 'not-run' ? 'Its step tests have not run on this build yet.' : 'Its step tests: ' + proofStatus[entry.status][1].toLowerCase() + '.' }} This claim can't be approved; flag it to send it back.</p> }
                    @if (c.kind === 'journey' && !walkedCount(c) && !verdictOf(c) && r.state === 'review') { <p class="wr-doit"><mat-icon aria-hidden="true">directions_walk</mat-icon>Walk it in the preview@if (journeyPersona(c); as who) { as the {{ who }}}. Doing each step's action takes you to the next one; the last brings you back here to decide.</p> }
                    @if (c.kind === 'journey' ? walkedCount(c) || verdictOf(c) : verdictOf(c)) {
                      <div class="wr-decision"><h3>Your decision</h3>
                        @if (flaggedSteps(c).length) { <p class="wr-caution"><mat-icon aria-hidden="true">flag</mat-icon>You flagged {{ flaggedSteps(c).length }} {{ flaggedSteps(c).length === 1 ? 'step' : 'steps' }}. This journey goes back to the agent with your {{ flaggedSteps(c).length === 1 ? 'note' : 'notes' }}; it can't be approved.</p> }
                        @else if (c.kind === 'journey' && unwalked(c).length && !verdictOf(c)) { <p class="wr-caution"><mat-icon aria-hidden="true">info</mat-icon>{{ unwalked(c).length }} {{ unwalked(c).length === 1 ? 'step' : 'steps' }} not walked: {{ unwalkedNames(c) }}.</p> }
                        @switch (verdictOf(c)?.value) {
                          @case ('accept') { <p class="wr-done"><mat-icon aria-hidden="true">verified</mat-icon>Approved{{ c.kind === 'journey' ? ': “' + journeyName(c) + '” works as specified.' : '.' }}</p> }
                          @case ('reject') { <p class="wr-caution"><mat-icon aria-hidden="true">flag</mat-icon>Flagged: {{ verdictOf(c)?.note }}</p> }
                          @case ('skip') { <p class="wr-caution"><mat-icon aria-hidden="true">redo</mat-icon>Skipped.</p> }
                        }
                      </div>
                    }
                    @if (composing() === 'claim') { <ng-container [ngTemplateOutlet]="composer" [ngTemplateOutletContext]="{ $implicit: c.kind === 'journey' ? 'What is wrong with this journey?' : 'What is wrong?' }" /> }
                    @if (c.kind !== 'journey' || evidence(c).length) {
                      <details class="wr-ctx" [open]="c.kind !== 'journey'"><summary><mat-icon aria-hidden="true">fact_check</mat-icon>To verify, check</summary>
                        <div class="wr-evs">@for (entry of evidence(c); track $index) {
                          <button type="button" [class]="'wr-ev wr-ev-' + entry.type" [class.missing]="entry.missing" [disabled]="!entry.look" (click)="look(entry.look)"><mat-icon aria-hidden="true">{{ evidenceType[entry.type][0] }}</mat-icon>
                            <span><small class="wr-ev-type">{{ evidenceType[entry.type][1] }}</small>{{ entry.label }}<small>{{ entry.detail }}</small></span>@if (entry.result) { <span class="small">{{ entry.result }}</span> }</button>
                        } @empty { <p class="small">This run produced nothing to check against.</p> }</div>
                        <p class="small wr-legend"><mat-icon aria-hidden="true">info</mat-icon>{{ named() ? 'Named by the run when it submitted. Each item points at something it produced; Aludel re-runs tests where it can.' : 'This run named no evidence per claim, so this lists everything it produced.' }}</p></details>
                    }
                    <details class="wr-ctx"><summary><mat-icon aria-hidden="true">bookmark</mat-icon>Context</summary>
                      <div>@if (c.source) { <p class="small">From <aludel-ref [id]="c.source.id" /></p> }<p class="small"><strong>The request:</strong> {{ r.task.request || r.task.title }}</p><p class="small">Shown for reference. You're reviewing the result, not this.</p></div></details>
                  }
                } }
                @case ('suggestion') { @if (suggestion(); as entry) {
                  <div class="wr-coverhead"><span class="wr-kind"><mat-icon aria-hidden="true">playlist_add</mat-icon>Suggestion {{ entry.position + 1 }} · {{ entry.layerName }}</span><h2 id="wr-ph" tabindex="-1">{{ entry.title }}</h2>
                    <p class="wr-lead">{{ r.performer.label }} suggests this work instead of doing it in this run. Creating it signs the task as created by {{ r.performer.label }} from {{ layerName(work.layer) }}; it starts in the {{ entry.layerName }} backlog.</p></div>
                  <article class="wr-change wr-fu"><dl class="wr-text"><dt>Why</dt><dd>{{ entry.why }}</dd>@if (entry.brief) { <dt>Brief</dt><dd class="small">{{ entry.brief }}</dd> }
                    @if (entry.target; as target) { <dt>Changes</dt><dd class="small">Journey {{ target.title }} (revision {{ target.revision }}), whose spec is kept in {{ layerName(target.layer) }} as {{ target.entry }}. {{ target.layer === 'platform' ? 'Creating it raises a Specify item for the journey.' : 'Creating it raises the change there; Code re-imports the journey once it is accepted.' }}</dd> }</dl>
                    @if (entry.state === 'proposed') {
                      @if (elevated() && r.state === 'review') { <div class="lay-row lay-wrap"><button type="button" class="lay-button small" (click)="decide(entry.id, 'create')"><mat-icon aria-hidden="true">add_task</mat-icon>Create task in {{ entry.layerName }}</button>
                        <button type="button" class="lay-button ghost small" (click)="decide(entry.id, 'dismiss')">Dismiss</button></div> }
                      @else if (!elevated()) { <p class="small">Someone with elevated {{ layerName(work.layer) }} access decides suggestions.</p> }
                    } @else if (entry.createdWorkId) { <p class="small">Created <a [href]="ctx.link('work', 'item', entry.createdWorkId)" (click)="ctx.go(ctx.link('work', 'item', entry.createdWorkId), $event)">{{ entry.createdRef }}</a> · {{ entry.decidedBy }}</p> }
                    @else { <p class="small">Dismissed by {{ entry.decidedBy }}</p> }</article>
                } }
                @case ('question') { @if (r.question; as q) {
                  <div class="wr-coverhead"><span class="wr-kind"><mat-icon aria-hidden="true">help</mat-icon>Question</span><h2 id="wr-ph" tabindex="-1">Merge the reviewed change now, or keep it as a draft?</h2>
                    <p class="wr-lead">{{ r.performer.label }}: {{ q.why }}</p></div>
                  <div class="wr-answers" role="group" aria-label="Your answer">
                    <button type="button" class="wr-answer" [attr.aria-pressed]="r.review.answer === 'merge'" [disabled]="r.state !== 'review'" (click)="answer('merge')"><mat-icon aria-hidden="true">merge</mat-icon><span><strong>Merge it now</strong><small>Accepting merges {{ (r.layerSource?.commit || '').slice(0, 7) }} as reviewed. The suggestions go on as their own work.</small></span></button>
                    <button type="button" class="wr-answer" [attr.aria-pressed]="r.review.answer === 'draft'" [disabled]="r.state !== 'review'" (click)="answer('draft')"><mat-icon aria-hidden="true">inventory_2</mat-icon><span><strong>Keep it as a draft</strong><small>Nothing merges. {{ work.ref }} waits on the spec suggestions you create, then builds on this draft.</small></span></button>
                  </div>
                } }
                @case ('finish') {
                  <div class="wr-coverhead"><span class="wr-kind"><mat-icon aria-hidden="true">draw</mat-icon>Finish</span><h2 id="wr-ph" tabindex="-1">{{ work.title }}</h2>
                    <p class="wr-lead">{{ outcomeText() }}</p></div>
                  <table class="wr-reg"><thead><tr><th scope="col">Claim</th><th scope="col">Your decision</th></tr></thead><tbody>
                    @for (entry of claimPages(); track entry.key) { <tr><td><button type="button" class="lay-link-button" (click)="open(entry.key)">{{ pageLabel(entry) }} · {{ pageTitle(entry) }}</button></td><td>@if (badgeOf(entry); as b) { <span [class]="'wr-badge ' + b[0]"><mat-icon aria-hidden="true">{{ b[1] }}</mat-icon>{{ b[2] }}</span> }</td></tr> }
                    @for (change of flaggedChanges(); track change.id) { <tr><td>{{ change.name }}</td><td><span class="wr-badge warn"><mat-icon aria-hidden="true">flag</mat-icon>Flagged</span>@if (r.review.flags[change.id]) { <small>{{ r.review.flags[change.id] }}</small> }</td></tr> }</tbody></table>
                  @if (openSuggestions().length) { <p class="wr-caution"><mat-icon aria-hidden="true">playlist_add</mat-icon>{{ openSuggestions().length }} {{ openSuggestions().length === 1 ? 'suggestion is' : 'suggestions are' }} not decided yet.</p> }
                  @if (undecided().length && !flagCount()) { <p class="wr-caution"><mat-icon aria-hidden="true">info</mat-icon>{{ undecided().length }} {{ undecided().length === 1 ? 'claim has' : 'claims have' }} no decision from you. Accepting signs for {{ undecided().length === 1 ? 'it' : 'them' }}.</p> }
                  @if (!flagCount() && blocking().length) { <p class="wr-blocker" role="status"><mat-icon aria-hidden="true">block</mat-icon>This run can't be accepted: {{ blockingText() }}. {{ r.performer.kind === 'person' ? 'Send it back, or ask ' + r.performer.label + ' to state why when they submit.' : 'Send it back; the failing steps go to the next run.' }}</p> }
                  @else if (!flagCount() && excused().length) { <p class="wr-caution"><mat-icon aria-hidden="true">info</mat-icon>Accepting signs over {{ excused().length }} unproven {{ excused().length === 1 ? 'claim' : 'claims' }} that {{ r.performer.label }} gave a reason for.</p> }
                  @if (r.question && !r.review.answer && !flagCount()) { <p class="wr-caution"><mat-icon aria-hidden="true">help</mat-icon>Answer the run's question first: merge now or keep as a draft.</p> }
                  @if (r.state === 'review') {
                    <label for="wr-comment">Overall comment (optional)</label>
                    <textarea id="wr-comment" rows="3" [(ngModel)]="comment" [placeholder]="flagCount() ? 'What should the next run do differently?' : 'Anything to note for the record'"></textarea>
                  }
                }
              }
            </div>
            <div class="wr-actions" [class.wr-has-progress]="progress().length">
              @if (progress().length) { <div class="wr-progress" role="img" [attr.aria-label]="progressLabel()">@for (segment of progress(); track $index) { <span [class]="segment"></span> }</div> }
              <button type="button" class="lay-button ghost small" (click)="previous()" [disabled]="atStart()"><mat-icon aria-hidden="true">arrow_back</mat-icon>Back</button>
              <span class="wr-acts">
                @if (r.state !== 'review') { @if (!atEnd()) { <button type="button" class="lay-button" (click)="next()">Next<mat-icon aria-hidden="true">arrow_forward</mat-icon></button> } }
                @else {
                  @switch (current().kind) {
                    @case ('claim') { @if (claim(); as c) {
                      @if (c.kind === 'journey' && stepIndex() !== null) { @if (journeyStep(); as s) {
                        @if (stepMark(c, s)?.value !== 'flag') { <button type="button" class="lay-button ghost small wr-flagbtn" [disabled]="!!composing()" (click)="compose('step')"><mat-icon aria-hidden="true">flag</mat-icon>Flag</button> }
                        <button type="button" class="lay-button" [disabled]="!!composing()" (click)="stepDone()">{{ stepMark(c, s)?.value === 'flag' ? 'Next' : 'Looks good' }}<mat-icon aria-hidden="true">{{ lastStep() ? 'flag_circle' : 'arrow_forward' }}</mat-icon>@if (lastStep()) { <span class="visually-hidden">, back to the journey to decide</span> }</button>
                      } } @else if (verdictOf(c)) {
                        <button type="button" class="lay-button ghost small" (click)="setVerdict(c, null)">Change my decision</button>
                        <button type="button" class="lay-button" (click)="next()">Next<mat-icon aria-hidden="true">arrow_forward</mat-icon></button>
                      } @else if (c.kind === 'journey' && !walkedCount(c) && !gateOf(c).length) {
                        <button type="button" class="lay-button ghost small wr-flagbtn" [disabled]="!!composing()" (click)="compose('claim')"><mat-icon aria-hidden="true">flag</mat-icon>Flag</button>
                        <button type="button" class="lay-button" (click)="walk(0)"><mat-icon aria-hidden="true">directions_walk</mat-icon>Walk the journey</button>
                      } @else if (flaggedSteps(c).length) {
                        <button type="button" class="lay-button ghost small" (click)="walk(0)">Walk again</button>
                        <button type="button" class="lay-button wr-flagfill" (click)="flagJourney(c)"><mat-icon aria-hidden="true">flag</mat-icon>Flag this journey</button>
                      } @else if (gateOf(c).length) {
                        @if (c.kind === 'journey') { <button type="button" class="lay-button ghost small" (click)="walk(0)">{{ walkedCount(c) ? 'Walk again' : 'Walk the journey' }}</button> }
                        <button type="button" class="lay-button wr-flagfill" [disabled]="!!composing()" (click)="compose('claim')"><mat-icon aria-hidden="true">flag</mat-icon>Flag it</button>
                      } @else {
                        @if (c.kind === 'journey') { <button type="button" class="lay-button ghost small" (click)="walk(0)">Walk again</button> } @else { <button type="button" class="lay-button ghost small" (click)="next()">Skip</button> }
                        <button type="button" class="lay-button ghost small wr-flagbtn" [disabled]="!!composing()" (click)="compose('claim')"><mat-icon aria-hidden="true">flag</mat-icon>Flag</button>
                        <button type="button" class="lay-button lay-button-ok" (click)="setVerdict(c, 'accept')"><mat-icon aria-hidden="true">verified</mat-icon>{{ c.kind === 'journey' ? 'Approve journey' : 'Approve' }}</button>
                      }
                    } }
                    @case ('finish') {
                      @if (!elevated()) { <span class="small">Elevated {{ layerName(work.layer) }} access is required to sign.</span> }
                      @else if (flagCount()) { <button type="button" class="lay-button wr-flagfill" [disabled]="preparing()" (click)="sign('reject')"><mat-icon aria-hidden="true">undo</mat-icon>Send back to {{ r.performer.kind === 'agent' ? 'the agent' : r.performer.label }}</button> }
                      @else if (r.review.answer === 'draft') { <button type="button" class="lay-button" [disabled]="preparing() || !parkable()" (click)="sign('park')"><mat-icon aria-hidden="true">inventory_2</mat-icon>Keep as a draft</button> }
                      @else {
                        @if (blocking().length) { <button type="button" class="lay-button wr-flagfill" [disabled]="preparing()" (click)="sign('reject')"><mat-icon aria-hidden="true">undo</mat-icon>Send back</button> }
                        <button type="button" class="lay-button lay-button-ok" [disabled]="preparing() || (!!r.layerSource && !r.integration?.current) || blocking().length > 0 || (!!r.question && !r.review.answer)" (click)="sign('accept')"><mat-icon aria-hidden="true">check</mat-icon>Accept the run</button>
                      }
                    }
                    @default { <button type="button" class="lay-button" (click)="next()">Next<mat-icon aria-hidden="true">arrow_forward</mat-icon></button> }
                  }
                }
              </span>
            </div>
          </section>
        </div>
        <p class="visually-hidden" role="status" aria-live="polite">{{ announce() }}</p>
      </div>

      <ng-template #composer let-question>
        <div class="wr-flagbox"><label for="wr-flagtext"><mat-icon aria-hidden="true">flag</mat-icon>{{ question }}</label>
          <textarea id="wr-flagtext" rows="3" [(ngModel)]="flagDraft" placeholder="Your note goes back with this flag."></textarea>
          @if (flagError()) { <p class="small wr-flagerr" role="alert">A flag needs a note: say what is wrong.</p> }
          <div class="wr-row"><button type="button" class="lay-button small wr-flagfill" (click)="saveFlag()">Save flag</button><button type="button" class="lay-button ghost small" (click)="composing.set(null)">Cancel</button></div></div>
      </ng-template>
      <ng-template #proofBlock let-c>
        @if (r.proofs[c.id]; as proof) {
          <div class="wr-proof" [class.bad]="proof.status !== 'passed'"><p class="small"><mat-icon aria-hidden="true" [class]="'wr-t-' + (proof.status === 'passed' ? 'passed' : proof.status === 'failed' ? 'failed' : 'skipped')">{{ proofStatus[proof.status][0] }}</mat-icon>
            <strong>{{ c.covers === 'journeys' ? 'Every other journey step on this build' : c.kind === 'record' ? 'The journey in this build' : 'Step tests on this build' }}: {{ proofStatus[proof.status][1] }}</strong>@if (proof.detail) { · {{ proof.detail }} }</p>
            @if (c.kind !== 'journey' && proof.steps.length) { <ul class="wr-proof-steps">@for (stepProof of proof.steps; track stepProof.id) { @if (c.covers !== 'journeys' || stepProof.status === 'failed') {
              <li class="small"><mat-icon aria-hidden="true" [class]="'wr-t-' + (stepProof.status === 'passed' ? 'passed' : stepProof.status === 'failed' ? 'failed' : 'skipped')">{{ proofStatus[stepProof.status][0] }}</mat-icon>{{ stepProof.id }}: {{ proofStatus[stepProof.status][1] }}
                @if (stepProof.screenshot) { · <a [href]="screenshotUrl(stepProof.id)" target="_blank" rel="noopener">screenshot</a> }@if (stepProof.detail) { <span> · {{ stepProof.detail }}</span> }</li> } }</ul> }
            @if (r.reasons[c.id]) { <p class="small"><strong>{{ r.performer.label }} says why:</strong> {{ r.reasons[c.id] }}</p> }
          </div>
        } @else if (c.kind === 'note') { <p class="wr-chipline"><span class="wr-badge warn"><mat-icon aria-hidden="true">edit_off</mat-icon>Unbacked: no automated proof</span></p> }
      </ng-template>
      <ng-template #testList>
        @if (r.layerSource; as branch) { <p class="small">Reported by the agent from its sandbox on <code>{{ branch.branch }}</code> ({{ branch.commit.slice(0, 12) }}), against a copy of the layer's outputs.</p> }
        <ul class="wr-tests">@for (check of testsOf(r); track $index) {
          <li [class.hl]="focus() === 'test:' + $index"><mat-icon aria-hidden="true" [class]="'wr-t-' + check.status">{{ check.status === 'passed' ? 'check_circle' : check.status === 'failed' ? 'cancel' : 'radio_button_unchecked' }}</mat-icon>
            <span>{{ check.name }}<small>{{ check.source === 'person-report' ? 'Reported by the performer; not re-run by Aludel' : check.source === 'agent-report' ? 'Reported by the agent; not re-run by Aludel' : 'Run by Aludel' }}@if (check.detail) { · {{ check.detail }} }</small></span></li>
        } @empty { <li class="small">No checks reported.</li> }</ul>
      </ng-template>
      <ng-template #changeList>
        @for (change of r.changes; track change.id) {
          <article class="wr-change" [class.hl]="focus() === change.id" [id]="'change-' + change.id">
            <header><mat-icon aria-hidden="true">{{ change.icon }}</mat-icon><strong>{{ change.name }}</strong><span [class]="'wi-op wi-op-' + change.op">{{ opLabel[change.op] }}@if (change.size) { · {{ change.size }} }</span>
              @if (r.state === 'review') { <button type="button" class="wi-flag on-visible" [class.on]="r.review.flags[change.id] !== undefined" (click)="toggleFlag(change.id)" [attr.aria-label]="(r.review.flags[change.id] !== undefined ? 'Remove the flag from ' : 'Flag ') + change.name"><mat-icon aria-hidden="true">flag</mat-icon></button> }</header>
            @if (r.review.flags[change.id] !== undefined) {
              @if (r.state === 'review') { <div class="wi-flagnote"><mat-icon aria-hidden="true">flag</mat-icon><label class="visually-hidden" [for]="'wr-flag-' + change.id">What's wrong with {{ change.name }}</label><input [id]="'wr-flag-' + change.id" [value]="r.review.flags[change.id]" (change)="saveChangeFlag(change.id, $any($event.target).value)" placeholder="What's wrong with this change?"></div> }
              @else { <p class="wi-flagnote"><mat-icon aria-hidden="true">flag</mat-icon>{{ r.review.flags[change.id] }}</p> }
            }
            @switch (change.kind) {
              @case ('claim') { <dl class="wr-text">@if (change.before) { <dt>Was</dt><dd class="wr-was">{{ change.before }}</dd> }<dt>{{ change.before ? 'Now' : 'New' }}</dt><dd class="wr-now">{{ change.after }}</dd>
                @if (change.note) { <dt>Note</dt><dd class="small">{{ change.note }}</dd> }@if (change.basis) { <dt>Basis</dt><dd class="small">{{ change.basis }}</dd> }</dl> }
              @case ('source') { @if (change.ownerReview) { <p class="wi-warn wr-owner"><mat-icon aria-hidden="true">shield_person</mat-icon>Changes what this layer runs or may do. Accepting runs this code on the host.</p> }
                <pre class="wr-diff" tabindex="0" [class.wr-diff-wrap]="!change.ownerReview">@for (line of (change.diff || '').split('\n'); track $index) {<span [class]="line[0] === '+' && !line.startsWith('+++') ? 'a' : line[0] === '-' && !line.startsWith('---') ? 'd' : line.startsWith('@@') ? 'h' : ''">{{ line }}</span>}</pre> }
              @case ('record') { <table class="wr-fields"><thead><tr><th scope="col">Field</th>@if (change.op !== 'created') { <th scope="col">Previous</th> }<th scope="col">{{ change.op === 'created' ? 'Value' : 'Proposed' }}</th></tr></thead>
                <tbody>@for (field of change.fields || []; track field.name) { <tr><th scope="row">{{ field.name }}</th>@if (change.op !== 'created') { <td><pre>{{ field.before }}</pre></td> }<td><pre>{{ field.after }}</pre></td></tr> }
                @empty { <tr><td colspan="3" class="small">No field changes.</td></tr> }</tbody></table> }
              @case ('flow') { <section class="wr-flow-new"><h3>New flow</h3><pre class="wr-diff" tabindex="0">{{ change.after }}</pre></section> }
              @case ('flow-revision') { <div class="wr-flow-revision"><section><h3>Previous</h3><pre class="wr-diff" tabindex="0">{{ change.before }}</pre></section><section><h3>Proposed</h3><pre class="wr-diff" tabindex="0">{{ change.after }}</pre></section></div> }
              @case ('proposal') { <p class="lay-prose">{{ change.after }}</p><dl class="lay-fieldiff">@for (field of fields(change); track field[0]) { <dt>{{ field[0] }}</dt><dd>{{ field[1] }}</dd> }</dl> }
              @case ('report') { <p class="lay-prose">{{ change.after }}</p>
                @if (change.findings) { @for (finding of change.findings; track $index) { <div class="wr-finding"><strong>{{ finding.title }}</strong> <span class="lay-chip lay-info">{{ finding.severity }}</span><p class="small"><strong>Affected:</strong> {{ finding.affected }}</p><p class="small"><strong>Evidence:</strong> {{ finding.evidence }}</p><p class="small"><strong>Suggested:</strong> {{ finding.recommendation }}</p></div> }
                @empty { <p class="small">No findings reported.</p> } } }
              @case ('file') { @if (diffLines().length && change.id === r.changes.find(entry => entry.kind === 'file')?.id) {
                <pre class="wr-diff" tabindex="0">@for (line of diffLines(); track $index) {<span [class]="line[0] === '+' && !line.startsWith('+++') ? 'a' : line[0] === '-' && !line.startsWith('---') ? 'd' : line.startsWith('@@') ? 'h' : ''">{{ line }}</span>}</pre> } }
            }
          </article>
        } @empty { <p>Run {{ r.number }} submitted no changes.</p> }
        @if (r.candidate && !diffLines().length) { <button type="button" class="lay-button ghost small" (click)="loadDiff()">Show the code diff</button> }
      </ng-template>
    } @else if (loaded()) { <h1 tabindex="-1">Run not found</h1><p><a [href]="back()" (click)="ctx.go(back(), $event)">Back to {{ work.ref }}</a></p> }
  } @else { <h1 tabindex="-1">Work item not found</h1> }`
})
export class WorkReviewComponent implements OnDestroy {
  readonly ctx = inject(ProjectContext);
  readonly id = input.required<string>();
  readonly number = input.required<string>();
  readonly runTitle = runTitle;
  readonly evidenceType = evidenceType;
  readonly stepResult = stepResult;
  readonly claimKind = claimKind;
  readonly proofStatus = proofStatus;
  readonly opLabel = { created: 'Created', modified: 'Modified', removed: 'Removed' };
  // DEC-057: signing a layer-scoped item's run and deciding its suggestions need elevated access to its layer.
  readonly elevated = computed(() => { const work = this.item(); return !work || work.scope !== 'layer' || Boolean(this.ctx.layerInstances().find(entry => entry.key === work.layer)?.elevated); });
  readonly item = computed(() => this.ctx.workById().get(this.id()) || null);
  readonly runs = signal<WorkRun[]>([]);
  readonly loaded = signal(false);
  readonly run = computed(() => this.runs().find(run => String(run.number) === this.number()) || null);
  readonly pageKey = signal('');
  readonly stepIndex = signal<number | null>(null);
  readonly viewChoice = signal<string | null>(null);
  readonly menu = signal(false);
  readonly hood = signal(false);
  readonly composing = signal<'step' | 'claim' | null>(null);
  readonly flagError = signal(false);
  readonly announce = signal('');
  readonly walkPath = signal<string | null>(null);
  readonly focus = signal<string | null>(null);
  readonly diffLines = signal<string[]>([]);
  readonly preparing = signal(false);
  readonly preview = signal<ReviewPreview | null>(null);
  readonly previewDestination = signal<string | null>(null);
  comment = ''; flagDraft = '';
  private loadedFor = '';

  // The pages, in order: each claim, each suggestion the run made, its question, then Finish.
  readonly pages = computed<Page[]>(() => { const r = this.run(); if (!r) return [];
    return [...r.task.criteria.map(claim => ({ key: `claim:${claim.id}`, kind: 'claim' as const, claim })),
      ...(r.followUps || []).map(followUp => ({ key: `suggestion:${followUp.id}`, kind: 'suggestion' as const, followUp })),
      ...(r.question ? [{ key: 'question', kind: 'question' as const }] : []), { key: 'finish', kind: 'finish' as const }]; });
  readonly claimPages = computed(() => this.pages().filter(page => page.kind === 'claim'));
  readonly current = computed<Page>(() => this.pages().find(page => page.key === this.pageKey()) || this.pages()[0] || { key: 'finish', kind: 'finish' });
  readonly claim = computed(() => { const page = this.current(); return page.kind === 'claim' ? page.claim : null; });
  readonly suggestion = computed(() => { const page = this.current(); return page.kind === 'suggestion' ? page.followUp : null; });
  readonly journey = computed(() => { const claim = this.claim(); return claim?.kind === 'journey' ? this.preview()?.journeys?.find(entry => entry.id === claim.journey) || null : null; });
  readonly journeyStep = computed(() => { const claim = this.claim(), index = this.stepIndex(); return claim && index !== null ? this.journeySteps(claim)[index] || null : null; });
  readonly lastStep = computed(() => { const claim = this.claim(), index = this.stepIndex(); return Boolean(claim && index !== null && index === this.journeySteps(claim).length - 1); });
  readonly stepPath = computed(() => this.journeyStep()?.path || null);
  readonly persona = computed(() => { const claim = this.claim(); return claim?.kind === 'journey' ? this.journeyPersona(claim) : null; });
  readonly atStart = computed(() => this.pages()[0]?.key === this.current().key && this.stepIndex() === null);
  readonly atEnd = computed(() => this.current().kind === 'finish');

  // The left panel shows the evidence for the current page: the live app for a journey, the test run for a regression, the
  // changes for a record or a suggestion. The reviewer can switch to any of them.
  readonly views = computed(() => { const r = this.run(); if (!r) return [];
    const live = Boolean(r.candidate || r.integration?.appRepository);
    return [...(live ? [{ id: 'preview', label: 'Preview' }] : []), { id: 'changes', label: 'Changes' }, ...(this.testsOf(r).length || this.preview()?.steps?.length ? [{ id: 'tests', label: 'Tests' }] : [])]; });
  readonly leftView = computed(() => { const chosen = this.viewChoice(), ids = this.views().map(view => view.id);
    if (chosen && ids.includes(chosen)) return chosen;
    const claim = this.claim(), live = ids.includes('preview');
    if (claim?.kind === 'journey' || claim?.kind === 'note') return live ? 'preview' : 'changes';
    if (claim?.covers === 'journeys' || claim?.kind === 'invariant') return ids.includes('tests') ? 'tests' : 'changes';
    return 'changes'; });

  // JOURNEYS-01 J4: claims whose step tests aren't passing on this build stop acceptance, unless a person gave a reason.
  readonly blocking = computed(() => { const r = this.run(); return r ? r.gate.filter(entry => r.performer.kind !== 'person' || !entry.reason) : []; });
  readonly excused = computed(() => { const r = this.run(); return r ? r.gate.filter(entry => r.performer.kind === 'person' && entry.reason) : []; });
  readonly blockingText = computed(() => this.blocking().map(entry => `“${entry.text}” is ${entry.status === 'not-run' ? 'not proven yet (open the preview to run its step tests)' : proofStatus[entry.status][1].toLowerCase()}`).join('; '));
  readonly named = computed(() => (this.run()?.evidence || []).length > 0);
  readonly flaggedChanges = computed(() => { const r = this.run(); return r ? r.changes.filter(change => r.review.flags[change.id] !== undefined) : []; });
  readonly flagCount = computed(() => { const r = this.run(); if (!r) return 0;
    return Object.values(r.review.verdicts).filter(value => value.value === 'reject').length + Object.values(r.review.steps || {}).filter(step => step.value === 'flag').length + this.flaggedChanges().length; });
  readonly undecided = computed(() => { const r = this.run(); return r ? r.task.criteria.filter(claim => !r.review.verdicts[claim.id] || r.review.verdicts[claim.id].value === 'skip') : []; });
  readonly openSuggestions = computed(() => (this.run()?.followUps || []).filter(entry => entry.state === 'proposed'));
  readonly parkable = computed(() => (this.run()?.followUps || []).some(entry => entry.target && entry.state === 'created'));
  readonly outcomeText = computed(() => { const r = this.run(), work = this.item(); if (!r || !work) return '';
    if (this.flagCount()) return `Nothing is applied. ${work.ref} opens again for the next run, with your flags and comment carried in${r.layerSource ? ' and this run\'s commit as its draft' : ''}.`;
    if (r.review.answer === 'draft') return `Nothing merges. ${work.ref} waits on the spec suggestions you created; its next run builds on this commit.`;
    return r.performer.kind === 'person' && !r.layerSource ? `Signs off the recorded work and closes ${work.ref}.` : `Accepting applies the run${r.layerSource ? `, merging ${r.layerSource.commit.slice(0, 7)} exactly as reviewed,` : ''} and closes ${work.ref}.`; });
  // The action bar's top border is the journey's progress, a segment per step.
  readonly progress = computed(() => { const claim = this.claim(); if (claim?.kind !== 'journey') return [];
    return this.journeySteps(claim).map((step, index) => [this.stepMark(claim, step)?.value === 'flag' ? 'flag' : this.stepMark(claim, step)?.value === 'ok' ? 'ok' : '', index === this.stepIndex() ? 'cur' : ''].join(' ').trim()); });
  readonly progressLabel = computed(() => { const claim = this.claim(); if (!claim) return '';
    const total = this.journeySteps(claim).length; return `${this.walkedCount(claim)} of ${total} steps walked${this.stepIndex() !== null ? `, on step ${this.stepIndex()! + 1}` : ''}`; });
  readonly back = computed(() => this.ctx.link('work', 'item', this.id()));
  private readonly sanitizer = inject(DomSanitizer);
  // The candidate's own isolated preview, served by this portal; nothing else is framed.
  readonly previewUrl = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.previewDestination() || this.preview()?.url || 'about:blank'));
  private readonly listener = (event: MessageEvent) => this.onWalk(event);

  constructor() {
    effect(() => { const work = this.item(); const key = work ? `${work.id}:${work.updatedAt}` : '';
      untracked(() => { if (!work || key === this.loadedFor) return; const first = !this.loadedFor; this.loadedFor = key; this.load(first); }); });
    window.addEventListener('message', this.listener);
  }
  ngOnDestroy() { window.removeEventListener('message', this.listener); }

  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}`; }
  load(first = false) {
    const work = this.item(); if (!work) return;
    void this.ctx.api<{ runs: WorkRun[] }>(`${this.base()}/work/${encodeURIComponent(work.id)}/runs`).then(value => {
      this.runs.set(value.runs); this.loaded.set(true);
      if (first) {
        const r = this.run(); const focus = reviewFocus(); reviewFocus.set(null);
        if (focus && r?.changes.some(change => change.id === focus)) { this.viewChoice.set('changes'); this.focus.set(focus); }
        // Open on the first claim without a decision, else Finish.
        const next = r?.task.criteria.find(claim => !r.review.verdicts[claim.id]);
        this.pageKey.set(next ? `claim:${next.id}` : 'finish');
        if (r?.layerSource && r.state === 'review' && this.elevated()) this.prepareReview();
        if (r?.candidate) void this.ctx.api<{ preview: { status: string; error?: string | null }; url: string }>(`${this.base()}/candidates/${encodeURIComponent(r.candidate.id)}/preview`)
          .then(status => this.preview.set({ ...status.preview, url: status.url }), () => this.preview.set(null));
      }
    }, () => { this.runs.set([]); this.loaded.set(true); });
  }

  // ---- pages ----
  open(key: string) { this.pageKey.set(key); this.stepIndex.set(null); this.menu.set(false); this.composing.set(null); this.focus.set(null); this.focusHeading(); }
  private focusHeading() { setTimeout(() => document.getElementById('wr-ph')?.focus()); }
  next() { const pages = this.pages(), index = pages.findIndex(page => page.key === this.current().key); if (index < pages.length - 1) this.open(pages[index + 1].key); }
  previous() {
    const index = this.stepIndex();
    if (index !== null) { if (index === 0) this.toCard(); else this.enterStep(index - 1); return; }
    const pages = this.pages(), at = pages.findIndex(page => page.key === this.current().key); if (at > 0) this.open(pages[at - 1].key);
  }
  toCard() { this.stepIndex.set(null); this.composing.set(null); this.focusHeading(); }
  enterStep(index: number) { this.stepIndex.set(index); this.composing.set(null); this.focusHeading(); }
  pageLabel(page: Page) {
    if (page.kind === 'claim') return `Claim ${page.claim.index + 1} of ${this.run()?.task.criteria.length ?? 0}`;
    if (page.kind === 'suggestion') return `Suggestion ${page.followUp.position + 1}`;
    return page.kind === 'question' ? 'Question' : 'Finish';
  }
  pageTitle(page: Page) {
    if (page.kind === 'claim') return page.claim.kind === 'journey' ? this.journeyName(page.claim) : page.claim.text;
    if (page.kind === 'suggestion') return page.followUp.title;
    return page.kind === 'question' ? 'Merge now or keep as a draft' : 'Accept or send back';
  }
  badgeOf(page: Page): [string, string, string] | null { const r = this.run(); if (!r) return null;
    if (page.kind === 'claim') { const claim = page.claim, verdict = r.review.verdicts[claim.id]?.value;
      if (verdict === 'accept') return ['ok', 'check_circle', 'Approved'];
      if (verdict === 'reject') return ['warn', 'flag', 'Flagged'];
      if (verdict === 'skip') return ['', 'redo', 'Skipped'];
      if (claim.kind === 'journey' && this.flaggedSteps(claim).length) return ['warn', 'flag', `${this.flaggedSteps(claim).length} flagged`];
      if (claim.kind === 'journey' && this.walkedCount(claim)) return ['info', 'directions_walk', `${this.walkedCount(claim)} of ${this.journeySteps(claim).length} walked`];
      return ['', 'radio_button_unchecked', claim.kind === 'journey' ? 'Not started' : 'No decision']; }
    if (page.kind === 'suggestion') return page.followUp.state === 'created' ? ['ok', 'add_task', 'Created'] : page.followUp.state === 'dismissed' ? ['', 'block', 'Dismissed'] : ['', 'radio_button_unchecked', 'Not decided'];
    if (page.kind === 'question') return r.review.answer === 'merge' ? ['ok', 'merge', 'Merge now'] : r.review.answer === 'draft' ? ['info', 'inventory_2', 'Keep as draft'] : ['', 'radio_button_unchecked', 'Not answered'];
    return null; }

  // ---- claims and their journeys ----
  journeySteps(claim: Claim): ReviewStep[] {
    const steps = (this.preview()?.steps || []).filter(step => step.journey === claim.journey);
    if (steps.length) return steps;
    // Before the build's journeys load, the claimed steps stand in, by ID.
    return (claim.steps || []).map(step => ({ id: `${claim.journey}.${step}`, journey: claim.journey || '', step, label: step, expected: '', persona: null, path: null, available: false, reason: 'Open the preview to walk this step.', result: null }));
  }
  journeyName(claim: Claim) { return this.preview()?.journeys?.find(entry => entry.id === claim.journey)?.title || claim.text; }
  journeyTitle(id: string) { return this.preview()?.journeys?.find(entry => entry.id === id)?.title || id; }
  journeyPersona(claim: Claim) { return this.preview()?.journeys?.find(entry => entry.id === claim.journey)?.persona || this.journeySteps(claim).find(step => step.persona)?.persona || null; }
  claimedStep(step: ReviewStep) { return (this.run()?.task.criteria || []).some(claim => claim.kind === 'journey' && claim.journey === step.journey && claim.steps?.includes(step.step)); }
  stepMark(claim: Claim, step: ReviewStep) { return this.run()?.review.steps?.[`${claim.id}/${step.step}`] || null; }
  walkedCount(claim: Claim) { return this.journeySteps(claim).filter(step => this.stepMark(claim, step)).length; }
  flaggedSteps(claim: Claim) { return this.journeySteps(claim).filter(step => this.stepMark(claim, step)?.value === 'flag'); }
  unwalked(claim: Claim) { return this.journeySteps(claim).filter(step => !this.stepMark(claim, step)); }
  unwalkedNames(claim: Claim) { return this.unwalked(claim).map(step => step.label).join(', '); }
  verdictOf(claim: Claim) { return this.run()?.review.verdicts[claim.id] || null; }
  gateOf(claim: Claim) { return this.blocking().filter(entry => entry.claim === claim.id); }
  claimLead(claim: Claim) {
    const journey = this.preview()?.journeys?.find(entry => entry.id === claim.journey);
    if (claim.kind === 'journey') return `${journey?.persona ? `As the ${journey.persona}, r` : 'R'}evision ${claim.revision ?? journey?.revision ?? ''}. The claim: this journey works as written, on this build.`;
    if (claim.covers === 'journeys') return 'Every journey step this run didn\'t claim, re-run on this build. Nothing here changed on purpose; the test run is on the left.';
    if (claim.kind === 'record') return 'A record this run changes in a layer. The change is on the left, previous beside proposed.';
    if (claim.kind === 'invariant') return 'A rule this run must keep. Its proof and the changes are on the left.';
    return 'Written as free text on the item. No layer describes it and no test proves it, so it rests on your judgment of what the run produced.';
  }
  // The evidence the run named for this claim (WI-6). Runs that named none fall back to everything they produced.
  evidence(claim: Claim): Evidence[] { const r = this.run(); if (!r) return [];
    if (this.named()) return r.evidence.filter(item => item.claim === claim.id).map(item => ({
      type: item.type, label: item.step ? `${item.label} · step ${item.step}` : item.label, look: item.target || '',
      detail: !item.found ? 'Named by the performer, but not in the review packet' : item.type === 'test' ? (item.independent ? 'Run by Aludel' : 'Reported by the agent; not re-run') : item.type === 'try' ? item.ref : item.note,
      result: item.type === 'test' ? item.result || undefined : undefined, missing: !item.found }));
    return [...r.changes.map(change => ({ type: 'change' as const, label: change.name, detail: `${this.opLabel[change.op]}${change.size ? ' · ' + change.size : ''}`, look: `change:${change.id}` })),
      ...this.testsOf(r).map((check, index) => ({ type: 'test' as const, label: check.name, detail: check.source === 'person-report' ? 'Reported by the performer' : check.source === 'agent-report' ? 'Reported by the agent' : 'Run by Aludel', look: `test:${index}`, result: check.status }))]; }
  look(target: string) { const [kind, ...rest] = target.split(':'); const id = rest.join(':');
    if (kind === 'change') { this.viewChoice.set('changes'); this.hood.set(false); this.focus.set(id); setTimeout(() => document.getElementById('change-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }
    if (kind === 'test') { this.viewChoice.set('tests'); this.hood.set(false); this.focus.set(target); }
    if (kind === 'preview') this.viewChoice.set('preview'); }

  // ---- decisions ----
  private review(body: unknown) { const r = this.run(); if (!r) return Promise.resolve(false);
    return this.ctx.write(async () => { const updated = await this.ctx.api<WorkRun>(`${this.base()}/work/${encodeURIComponent(this.id())}/runs/${encodeURIComponent(r.id)}/review`, 'PUT', { ...(body as object), integrationId: r.integration?.id });
      this.runs.set(this.runs().map(run => run.id === updated.id ? updated : run)); }); }
  setVerdict(claim: Claim, value: 'accept' | 'reject' | null, note = '') {
    void this.review({ verdict: { claim: claim.id, value, ...(value === 'reject' ? { note } : {}) } }).then(saved => { if (saved && value) this.announce.set(value === 'accept' ? `Approved: ${this.pageTitle({ key: '', kind: 'claim', claim })}` : 'Flagged'); });
  }
  compose(kind: 'step' | 'claim') { this.flagDraft = ''; this.flagError.set(false); this.composing.set(kind); setTimeout(() => document.getElementById('wr-flagtext')?.focus()); }
  saveFlag() {
    const note = this.flagDraft.trim(), claim = this.claim(), step = this.journeyStep();
    if (!note) { this.flagError.set(true); document.getElementById('wr-flagtext')?.focus(); return; }
    if (!claim) return;
    const kind = this.composing(); this.composing.set(null);
    if (kind === 'step' && step) this.markStep(claim, step, 'flag', note);
    else this.setVerdict(claim, 'reject', note);
  }
  // A journey with flagged steps goes back flagged; its note names them, and each step's own note goes too.
  flagJourney(claim: Claim) { this.setVerdict(claim, 'reject', `Flagged steps: ${this.flaggedSteps(claim).map(step => step.label).join(', ')}`.slice(0, 1000)); }
  markStep(claim: Claim, step: ReviewStep, value: 'ok' | 'flag' | null, note = '') { return this.review({ step: { claim: claim.id, step: step.step, value, note } }); }
  stepDone() { const claim = this.claim(), step = this.journeyStep(), index = this.stepIndex(); if (!claim || !step || index === null) return;
    const advance = () => this.advance(index);
    if (this.stepMark(claim, step)?.value === 'flag') advance(); else void this.markStep(claim, step, 'ok').then(saved => { if (saved) advance(); }); }
  private advance(index: number) { const claim = this.claim(); if (!claim) return;
    if (index < this.journeySteps(claim).length - 1) this.enterStep(index + 1);
    else { this.toCard(); this.announce.set(`That was the last step. Decide on “${this.journeyName(claim)}”.`); } }
  answer(value: 'merge' | 'draft') { void this.review({ answer: this.run()?.review.answer === value ? null : value }); }
  toggleFlag(id: string) { void this.review({ flag: { id, on: this.run()?.review.flags[id] === undefined, note: '' } }); }
  saveChangeFlag(id: string, note: string) { void this.review({ flag: { id, note } }); }
  sign(outcome: 'accept' | 'reject' | 'park') { const r = this.run(); if (!r) return;
    void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/work/${encodeURIComponent(this.id())}/runs/${encodeURIComponent(r.id)}/sign`, 'POST', { outcome, comment: this.comment, integrationId: r.integration?.id }); this.ctx.go(this.back()); },
      outcome === 'accept' ? r.performer.kind === 'person' && !r.layerSource ? `Run ${r.number} accepted and signed off.` : `Run ${r.number} accepted and applied.`
        : outcome === 'park' ? `Run ${r.number} kept as a draft. ${this.item()?.ref} waits on its spec.` : `Run ${r.number} sent back. The task is open again in Next run.`); }

  // ---- walking the journey in the preview ----
  // Opens the journey's first step through a one-use link: the preview prepares the persona's fixture and session.
  walk(index: number) { const claim = this.claim(), r = this.run(); if (!claim || !r) return;
    const steps = this.journeySteps(claim); this.viewChoice.set(null); this.enterStep(index);
    const first = steps.find(step => step.available);
    if (r.integration && first && this.preview()?.status === 'running' && r.state === 'review') this.openStep(first.id);
    else if (r.integration?.appRepository && this.preview()?.status !== 'running' && r.state === 'review') this.buildPreview(); }
  // The preview's walk script says which page shows and when an action succeeded (server/review-walk.mjs). Arriving at the
  // next step's page, or an action on the last step or on a step that shares its page with the next, walks the current step.
  onWalk(event: MessageEvent) {
    const data = event.data as Walk, frame = document.getElementById('wr-frame') as HTMLIFrameElement | null, url = this.preview()?.url;
    if (!data || data.aludelWalk !== 1 || !frame || event.source !== frame.contentWindow || !url || event.origin !== new URL(url, location.href).origin) return;
    if (data.kind === 'page') this.walkPath.set(data.path);
    const claim = this.claim(), index = this.stepIndex(), r = this.run();
    if (!claim || claim.kind !== 'journey' || index === null || r?.state !== 'review' || this.composing() || this.verdictOf(claim)) return;
    const steps = this.journeySteps(claim), current = steps[index], next = steps[index + 1];
    const arrived = data.kind === 'page' && next?.path && routeOf(data.path) === routeOf(next.path) && routeOf(current.path) !== routeOf(next.path);
    const acted = data.kind === 'action' && (!next || (next.path && routeOf(next.path) === routeOf(current.path)));
    if (!arrived && !acted) return;
    this.announce.set(`Step ${index + 1} walked: ${current.label}`);
    if (this.stepMark(claim, current)?.value === 'flag') this.advance(index);
    else void this.markStep(claim, current, 'ok').then(saved => { if (saved) this.advance(index); });
  }

  // ---- the build ----
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
      this.walkPath.set(null); this.previewDestination.set(value.url);
    });
  }
  closePreview() { const r = this.run(); if (!r?.integration) return;
    void this.ctx.write(async () => { const value = await this.ctx.api<{ preview: ReviewPreview }>(`${this.runPath(r)}/close-preview`, 'POST', { integrationId: r.integration!.id }); this.preview.set(value.preview); });
  }
  testsOf(run: WorkRun) { return run.integration?.tests?.length ? run.integration.tests : run.candidate?.checks?.length ? run.candidate.checks : run.layerSource?.tests || []; }
  passedChecks(run: WorkRun) { return this.testsOf(run).filter(check => check.status === 'passed').length; }
  layerName(key: string) { return this.ctx.layerInstances().find(entry => entry.key === key)?.name || key; }
  decide(followUpId: string, decision: 'create' | 'dismiss') {
    void this.ctx.write(async () => {
      await this.ctx.api(`${this.base()}/work/${encodeURIComponent(this.id())}/follow-ups/${encodeURIComponent(followUpId)}`, 'POST', { decision });
      this.load();
    }, decision === 'create' ? 'Suggested task created.' : 'Suggestion dismissed.');
  }
  fields(change: RunChange): [string, string][] { return Object.entries(change.content || {}).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]); }

  @HostListener('document:keydown', ['$event'])
  key(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (!this.run() || target?.closest('input, textarea, select, [contenteditable]') || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') { if (this.menu()) { this.menu.set(false); return; } if (this.composing()) { this.composing.set(null); return; } this.ctx.go(this.back()); return; }
    if (target?.closest('button, a, summary')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); if (this.stepIndex() !== null) this.stepDone(); else this.next(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); this.previous(); }
  }
  @HostListener('document:click', ['$event'])
  outside(event: MouseEvent) { if (this.menu() && !(event.target as HTMLElement | null)?.closest('.wr-pick')) this.menu.set(false); }
}
