import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AgentConnectionComponent } from '../agent-connection';
import { AgentProfile, ProjectContext, Suggestion, WorkItem, layerLabel, lines, modeLabel, stateLabel } from './context';

interface ReconcileContext { recordId: string; fromRevision: number; toRevision: number; changes: { field: string; before: unknown; after: unknown }[];
  units: { id: string; symbol: string; path: string; kind: string; calls: string[]; calledBy: string[] }[]; tests: string[]; }


// Work: the shared bench. People, agents and templates act on items the same way (DEC-036).
@Component({
  selector: 'aludel-work-layer', standalone: true,
  imports: [FormsModule, MatIconModule, AgentConnectionComponent],
  template: `
  @if (item(); as work) {
    <p class="lay-eyebrow"><a [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)">Work</a> · {{ work.ref }}</p>
    <div class="lay-row lay-wrap"><h1 tabindex="-1" class="lay-flat">{{ work.title }}</h1><span [class]="'lay-chip lay-l-' + work.layer">{{ layerLabel[work.layer] }}</span><span class="lay-chip lay-plain">{{ stateLabel[work.state] }}</span></div>
    <p class="lay-muted">{{ typeLabel(work.type) }} work from the {{ layerLabel[work.layer] }} layer</p>
    <div class="lay-grid lay-g-side">
      <div>
        @if (work.state === 'review' && work.context?.run) {
          <section class="lay-question" aria-labelledby="review-heading"><h2 id="review-heading"><mat-icon aria-hidden="true">rate_review</mat-icon> Review the {{ work.assignee?.label }}'s draft</h2>
            <p class="small">The draft is saved in the {{ targetNoun(work) }} as a revision made from {{ work.ref }} ({{ work.context?.run?.model }}, {{ (work.context?.run?.usage?.input || 0) + (work.context?.run?.usage?.output || 0) }} tokens). Open it below to read or edit it, then accept it or send it back.</p>
            <div class="lay-choices">@for (target of work.targets; track target.id) { <a class="lay-button ghost small" [href]="targetHref(target.kind, target.id)" (click)="openTarget(work, target.kind, target.id, $event)">Open {{ shortLabel(target) }}</a> }</div>
            <label>Note for the agent (optional, if you send it back)<input name="reviewNote" [(ngModel)]="reviewNote"></label>
            <div class="lay-row lay-wrap"><button type="button" class="lay-button small" (click)="move(work, 'done')">Accept</button><button type="button" class="lay-button ghost small" (click)="sendBack(work)">Send back</button></div>
          </section>
        }
        @if (work.question?.recommendation && !work.question?.answer) { <p class="lay-note small">The {{ work.assignee?.label }} suggests <strong>{{ work.question?.recommendation }}</strong>: {{ work.question?.reasoning }}</p> }
        @if (work.question && !work.question.answer) {
          <form class="lay-question" (ngSubmit)="answer(work)"><h2><mat-icon aria-hidden="true">help</mat-icon> {{ work.question.text }}</h2>
            @if (work.question.options.length) { <div class="lay-choices" role="radiogroup" aria-label="Answer">@for (option of work.question.options; track option) { <label class="lay-choice" [class.selected]="answerDraft === option"><input type="radio" name="answer" [value]="option" [(ngModel)]="answerDraft">{{ option }}</label> }</div> }
            @else { <label>Answer<input name="answer" [(ngModel)]="answerDraft"></label> }
            <label>Why (saved with the decision)<textarea name="why" rows="2" [(ngModel)]="whyDraft"></textarea></label>
            <button type="submit" class="lay-button" [disabled]="!answerDraft.trim()">Answer</button></form>
        } @else if (work.question?.answer) {
          <section class="lay-card lay-block"><h2>Decided</h2><p><strong>{{ work.question?.text }}</strong><br>{{ work.question?.answer }}{{ work.question?.rationale ? ' — ' + work.question?.rationale : '' }}</p>
            <p class="lay-muted small">By {{ work.question?.answeredBy }}. The answer belongs in the record it changes, with the same reason.</p>
            <div class="lay-row lay-wrap">@for (target of work.targets; track target.id) {
              @if (work.question?.applied?.includes(target.id)) { <span class="lay-chip lay-ok">Applied to {{ shortLabel(target) }}</span> }
              @else if (applicable(target.kind) && work.state !== 'done') { <button type="button" class="lay-button small" (click)="apply(work, target.id)">Apply to {{ shortLabel(target) }}</button> } }</div></section>
        }
        @if (work.type === 'reconcile' && reconcile(); as change) {
          <section class="lay-card lay-block" aria-labelledby="reconcile-heading"><h2 id="reconcile-heading"><mat-icon aria-hidden="true">difference</mat-icon> What changed</h2>
            <p class="lay-muted small"><a [href]="ctx.recordLabel(change.recordId)[1]" (click)="ctx.go(ctx.recordLabel(change.recordId)[1], $event)">{{ ctx.recordLabel(change.recordId)[0] }}</a> moved from revision {{ change.fromRevision }} to {{ change.toRevision }} after its code was written.</p>
            <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Changes"><table><thead><tr><th>Field</th><th>Was</th><th>Now</th></tr></thead><tbody>
              @for (entry of change.changes; track entry.field) { <tr><td><code>{{ entry.field }}</code></td><td class="small"><del>{{ show(entry.before) }}</del></td><td class="small"><ins>{{ show(entry.after) }}</ins></td></tr> }
              @empty { <tr><td colspan="3" class="lay-muted">No field differences between those revisions.</td></tr> }</tbody></table></div>
            <h3>Blast radius</h3>
            <ul class="lay-list">@for (unit of change.units; track unit.id) { <li class="lay-item"><span class="lay-body-text"><a [href]="ctx.link('platform', 'code', unit.id)" (click)="ctx.go(ctx.link('platform', 'code', unit.id), $event)"><code>{{ unit.symbol }}</code></a>
              <small>{{ unit.path }} · {{ unit.kind }}{{ unit.calls.length ? ' · calls ' + unit.calls.join(', ') : '' }}{{ unit.calledBy.length ? ' · called by ' + unit.calledBy.join(', ') : '' }}</small></span></li> }</ul>
            <p class="small">Tests: {{ change.tests.join('; ') || 'none reach this code yet' }}</p>
            <p class="lay-muted small">The plan classifies each unit as create, modify or remove against the new revision. Closing this item relinks the code at revision {{ change.toRevision }}.</p>
          </section>
        }
        <section class="lay-card" aria-labelledby="context-heading"><h2 id="context-heading">Context</h2>
          <p class="lay-muted small">Compiled like a story file: a small set of facts, each citing its source record. Agents fetch more from the layers when they need it; you can read exactly the same.</p>
          <ol class="lay-bundle">@for (entry of bundle(work); track $index) { <li><strong>{{ entry[0] }}:</strong> {{ entry[1] }} <span class="lay-citation">· {{ entry[2] }}</span></li> }</ol>
          <div class="lay-connected">@for (target of work.targets; track target.id) { <a [href]="targetHref(target.kind, target.id)" (click)="openTarget(work, target.kind, target.id, $event)"><span class="lay-chip lay-plain">{{ target.kind }}</span> {{ target.label }}</a> }</div>
          @if (work.targets.length && work.state !== 'done' && verified.includes(work.type)) { <p class="lay-muted small">Edits you make after opening a target from here are saved as {{ work.ref }}'s output. Closing it checks that each target changed.</p> }
        </section>
        <form class="lay-card lay-form" (ngSubmit)="saveDocuments(work)"><h2>Will document</h2><p class="lay-muted small">Closing this item means these records were created or revised. The log is not documentation.</p>
          <label>One record per line<textarea name="documents" rows="3" [(ngModel)]="documentsDraft"></textarea></label><button type="submit" class="lay-button ghost small">Save</button></form>
        <details class="lay-log-list"><summary>Activity log · {{ work.log.length }}</summary><ol class="small">@for (entry of work.log; track $index) { <li>{{ entry.at.slice(0, 16).replace('T', ' ') }} · {{ entry.text }}</li> }</ol></details>
      </div>
      <aside class="lay-card"><h2>Who's on it</h2>
        @if (work.assignee?.kind === 'template') { <p><mat-icon aria-hidden="true">magic_button</mat-icon> Built by the Aludel template.</p><p class="lay-muted small">It's your code and your stories now. Change the story or page and new work is created like for anything else.</p> }
        @else {
          <div class="lay-toggle" role="group" aria-label="Assignee"><button type="button" [class.on]="work.assignee?.kind === 'agent'" [attr.aria-pressed]="work.assignee?.kind === 'agent'" (click)="assign(work, 'agent')"><mat-icon aria-hidden="true">smart_toy</mat-icon>Agent</button>
            <button type="button" [class.on]="work.assignee?.kind === 'person'" [attr.aria-pressed]="work.assignee?.kind === 'person'" (click)="assign(work, 'person')"><mat-icon aria-hidden="true">person</mat-icon>Me</button></div>
          <p class="lay-muted small">{{ work.assignee ? 'On it: ' + work.assignee.label + '.' : 'Nobody yet.' }}{{ work.assignee?.kind === 'agent' && (work.state === 'ready' || work.state === 'suggested') ? (work.context?.batch ? ' In the next agent batch: it runs when you press Go.' : ' It runs when you add it to an agent batch and press Go.') : '' }}</p>
          @if (work.context?.automation; as automation) { <p class="lay-note small">Handed over by working style ({{ modeLabel[automation.mode] }}). <a [href]="ctx.link('work', 'style')" (click)="ctx.go(ctx.link('work', 'style'), $event)">Change what is automated</a></p> }
          @if (work.context?.routine) { <p class="lay-muted small">Created by a <a [href]="ctx.link('work', 'routines')" (click)="ctx.go(ctx.link('work', 'routines'), $event)">routine</a>.</p> }
          @if (work.assignee?.kind === 'agent') {
            <label class="lay-inline-form">Profile<select (change)="assignProfile(work, $any($event.target).value)">@for (profile of profiles(); track profile.id) { <option [value]="profile.id" [selected]="profile.id === work.profileId">{{ profile.name }}</option> }</select></label>
            @if (work.instructions; as pins) { <p class="lay-muted small">Instructions pinned: principles {{ pins.principles ? 'rev ' + pins.principles.revision : 'none' }} · project rev {{ pins.project?.revision }} · <a [href]="ctx.link('work', 'agents', pins.role.id)" (click)="ctx.go(ctx.link('work', 'agents', pins.role.id), $event)">{{ ctx.profileById().get(pins.role.id)?.name }}</a> rev {{ pins.role.revision }} · {{ pins.guidance }} guidance</p> }
          }
          <h3>Move to</h3><div class="lay-row lay-wrap">@for (state of nextStates(work); track state) { <button type="button" class="lay-button ghost small" (click)="move(work, state)">{{ stateLabel[state] }}</button> }</div>
        }
      </aside>
    </div>
  } @else {
    <p class="lay-eyebrow">Work · the shared bench</p>
    <h1 tabindex="-1">Everything to do, from every layer</h1>
    <p class="lay-lead">Agents, templates and people pick up items the same way. Questions stay on the item; answers land in the layer they change.</p>
    <nav class="lay-tabs" aria-label="Work sections">
      @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('work', entry[0])" (click)="ctx.go(ctx.link('work', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }
    </nav>
    @switch (tab()) {
      @case ('agents') {
        @if (profile(); as current) {
          <p class="lay-eyebrow"><a [href]="ctx.link('work', 'agents')" (click)="ctx.go(ctx.link('work', 'agents'), $event)">Agents</a> · profile</p>
          <div class="lay-row lay-wrap"><h2 class="lay-flat lay-page-title"><mat-icon aria-hidden="true">{{ current.icon }}</mat-icon> {{ current.name }}</h2><span class="lay-chip lay-plain">rev {{ current.revision }}</span></div>
          <p class="lay-muted">{{ current.role }}</p>
          <div class="lay-grid lay-g-side">
            <div>
              <form class="lay-card lay-form" (ngSubmit)="saveProfile(current)" aria-labelledby="instructions-heading"><h2 id="instructions-heading">Instructions</h2>
                <p class="lay-muted small">Read in this order. Each layer is a revisioned record; a work item remembers exactly which revisions it ran with.</p>
                <ol class="lay-bundle small"><li><strong>Product principles</strong> <span class="lay-citation">· Product › Vision · every profile</span></li><li><strong>Project instructions</strong> <span class="lay-citation">· Agents · exported to AGENTS.md</span></li>
                  <li><strong>Role instructions</strong> <span class="lay-citation">· this profile, below</span></li><li><strong>Work-type guidance</strong> <span class="lay-citation">· {{ current.workTypes.join(', ') || 'no work types yet' }}</span></li></ol>
                <label>Role instructions<textarea name="instructions" rows="6" [(ngModel)]="profileDraft.instructions"></textarea></label>
                <label>Model (blank uses the account's default)<input name="model" [(ngModel)]="profileDraft.model"></label>
                <label>Asks you first (one per line)<textarea name="approval" rows="2" [(ngModel)]="profileDraft.approval"></textarea></label>
                <label>Why this change (saved with the revision)<input name="rationale" [(ngModel)]="profileDraft.rationale" maxlength="400"></label>
                <button type="submit" class="lay-button small">Save profile</button></form>
              <section class="lay-card lay-gap-top"><h2>Work</h2><ul class="lay-list">@for (item of profileWork(current); track item.id) { <li><a class="lay-item" [href]="ctx.link('work', 'item', item.id)" (click)="ctx.go(ctx.link('work', 'item', item.id), $event)"><span class="lay-body-text"><strong>{{ item.title }}</strong><small>{{ item.ref }} · {{ typeLabel(item.type) }}</small></span><span class="lay-chip lay-plain">{{ stateLabel[item.state] }}</span></a></li> }
                @empty { <li class="lay-muted lay-pad">Nothing assigned yet.</li> }</ul></section>
              <details class="lay-log-list"><summary>Guidance for its work types</summary><dl class="lay-kv small">@for (type of current.workTypes; track type) { <dt>{{ typeLabel(type) }}</dt><dd>{{ ctx.data()?.guidance?.[type] }}</dd> }</dl></details>
            </div>
            <aside class="lay-card"><h2>Setup</h2><dl class="lay-kv small">
              <dt>Account</dt><dd>{{ ctx.setup()?.agentConnection ? ctx.setup()?.agentConnection?.label : 'None connected' }} @if (!ctx.setup()?.agentConnection) { <span class="lay-chip lay-warn">Needs an account</span> }</dd>
              <dt>Model</dt><dd>{{ current.model || "Account default" }}</dd>
              <dt>Takes</dt><dd>{{ current.workTypes.map(typeLabel).join(', ') || 'Nothing (see Working style)' }}</dd>
              <dt>May write</dt><dd>@for (layer of current.writes; track layer) { <span [class]="'lay-chip lay-l-' + layer">{{ layerLabel[layer] }}</span> }</dd>
              <dt>Asks you first</dt><dd>{{ current.approvalRequired.join('; ') || '—' }}</dd>
              <dt>Budget</dt><dd>\${{ current.budget }} · spending off</dd></dl>
              <p class="lay-muted small">Anything outside its layers, and any cost, external account or deployment, always comes to you. Nothing calls a provider until agent work arrives (LAY-04) with your OK.</p>
              <h3>Why it is this way</h3>
              @if (current.history.length) { <div class="lay-history">@for (entry of current.history; track entry.revision) { <p>{{ entry.rationale }}<br><small>Revision {{ entry.revision }} · {{ entry.author }} · {{ entry.createdAt.slice(0, 10) }}</small></p> }</div> }</aside>
          </div>
        } @else {
          <div class="lay-grid lay-g2">
            <aludel-agent-connection class="lay-card" [projectId]="ctx.projectId()" [projectName]="ctx.setup()?.project?.name || ''" heading="Accounts" description="Agents run on your own Anthropic or OpenAI account: paste an API key. Profiles use it; swapping providers never rewrites instructions." (changed)="ctx.reload()" />
            <form class="lay-card lay-form" (ngSubmit)="saveInstructions()" aria-labelledby="project-instructions"><h2 id="project-instructions">Project instructions</h2>
              <p class="lay-muted small">Every profile reads these after the product principles. Exported to <code>AGENTS.md</code> in the repository, so any coding tool reads the same rules.</p>
              <label>Instructions<textarea name="projectInstructions" rows="5" [(ngModel)]="instructionsDraft"></textarea></label>
              <label>Why this change<input name="instructionsWhy" [(ngModel)]="instructionsWhy" maxlength="400"></label>
              <div class="lay-row lay-wrap"><button type="submit" class="lay-button small">Save</button><button type="button" class="lay-button ghost small" (click)="exportAgents()"><mat-icon aria-hidden="true">download</mat-icon>Export AGENTS.md</button></div></form>
            <section class="lay-card lay-wide" aria-labelledby="profiles-heading"><h2 id="profiles-heading">Profiles</h2><p class="lay-muted small">One per role, each with its own instructions and permissions. Working style decides which work each one picks up.</p>
              <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Profiles"><table><thead><tr><th>Profile</th><th>Takes</th><th>Account and model</th><th>May write</th></tr></thead><tbody>
                @for (entry of profiles(); track entry.id) { <tr><td><a [href]="ctx.link('work', 'agents', entry.id)" (click)="ctx.go(ctx.link('work', 'agents', entry.id), $event)">{{ entry.name }}</a></td><td class="small">{{ entry.workTypes.map(typeLabel).join(', ') || '—' }}</td>
                  <td class="small">@if (ctx.setup()?.agentConnection; as account) { {{ account.label }} · {{ entry.model || 'default model' }} } @else { <span class="lay-chip lay-warn">Needs an account</span> }</td>
                  <td>@for (layer of entry.writes; track layer) { <span [class]="'lay-chip lay-l-' + layer">{{ layerLabel[layer] }}</span> }</td></tr> }</tbody></table></div></section>
          </div>
        }
      }
      @case ('routines') {
        <p class="lay-muted">Each run creates an ordinary work item, handed over like any other by working style. A routine never opens a second item while its last one is open.</p>
        <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Routines"><table><thead><tr><th>Routine</th><th>Layer</th><th>Runs</th><th>Next</th><th>Last item</th><th>On</th><th><span class="visually-hidden">Run</span></th></tr></thead><tbody>
          @for (routine of routines(); track routine.id) { <tr><td><strong>{{ routine.title }}</strong><br><span class="lay-muted small">{{ typeLabel(routine.type) }} work</span></td><td><span [class]="'lay-chip lay-l-' + routine.layer">{{ layerLabel[routine.layer] }}</span></td>
            <td>{{ cadenceLabel[routine.cadence] }}</td><td class="small">{{ !routine.enabled ? 'Off' : routine.cadence === 'before-release' ? 'Next build' : when(routine.nextRunAt) }}</td>
            <td class="small">@if (routine.lastWorkId && workById().get(routine.lastWorkId); as last) { <a [href]="ctx.link('work', 'item', last.id)" (click)="ctx.go(ctx.link('work', 'item', last.id), $event)">{{ last.ref }}</a> {{ stateLabel[last.state] }} } @else { — }</td>
            <td><input type="checkbox" [checked]="routine.enabled" (change)="toggleRoutine(routine.id, routine.revision, $any($event.target).checked)" [attr.aria-label]="(routine.enabled ? 'Turn off ' : 'Turn on ') + routine.title"></td>
            <td><button type="button" class="lay-button ghost small" (click)="runRoutine(routine.id)" [attr.aria-label]="'Run ' + routine.title + ' now'">Run now</button></td></tr> }</tbody></table></div>
        <form class="lay-card lay-form lay-gap-top" (ngSubmit)="addRoutine()" aria-labelledby="new-routine"><h2 id="new-routine">New routine</h2>
          <div class="lay-row lay-wrap lay-fields"><label>Title<input name="routineTitle" [(ngModel)]="newRoutine.title" placeholder="Monthly roadmap review"></label>
            <label>Layer<select name="routineLayer" [(ngModel)]="newRoutine.layer">@for (entry of layerEntries; track entry[0]) { <option [value]="entry[0]">{{ entry[1] }}</option> }</select></label>
            <label>Work type<select name="routineType" [(ngModel)]="newRoutine.type">@for (type of ctx.data()?.workTypes || []; track type) { <option [value]="type">{{ typeLabel(type) }}</option> }</select></label>
            <label>Runs<select name="routineCadence" [(ngModel)]="newRoutine.cadence">@for (entry of cadenceEntries; track entry[0]) { <option [value]="entry[0]">{{ entry[1] }}</option> }</select></label></div>
          <label>Will document (one per line)<textarea name="routineDocuments" rows="2" [(ngModel)]="newRoutine.documents"></textarea></label>
          <button type="submit" class="lay-button small">Add routine</button></form>
      }
      @case ('style') {
        <div class="lay-row lay-wrap"><span>Working style:</span><div class="lay-toggle" role="group" aria-label="Working style">@for (profile of workingStyles(); track profile.id) { <button type="button" [class.on]="ctx.setup()?.profile === profile.id" [attr.aria-pressed]="ctx.setup()?.profile === profile.id" (click)="switchProfile(profile.id)">{{ profile.label }}</button> }</div></div>
        <p class="lay-muted">Working style decides which kinds of work are staged and handed to an agent profile automatically. Anything it doesn't automate stays a suggestion for you. Any item can be reassigned. Agents are queued only: running them needs your OK to use a provider.</p>
        <h2 class="lay-gap-top">Who takes each kind of work</h2>
        <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Work routing"><table><thead><tr><th>Work type</th><th>In this project</th><th>Agent profile</th><th>Dreamer</th><th>Planner</th><th>Tinkerer</th></tr></thead><tbody>
          @for (type of ctx.data()?.workTypes || []; track type) { <tr><td><label [for]="'route-' + type">{{ typeLabel(type) }}</label><br><span class="lay-muted small">{{ ctx.data()?.guidance?.[type] }}</span></td>
            <td><span class="lay-chip" [class.lay-l-work]="ctx.data()?.automation?.[type]?.mode !== 'you'" [class.lay-plain]="ctx.data()?.automation?.[type]?.mode === 'you'">{{ modeLabel[ctx.data()?.automation?.[type]?.mode || 'you'] }}</span></td>
            <td><select [id]="'route-' + type" (change)="route(type, $any($event.target).value)">@for (profile of profiles(); track profile.id) { <option [value]="profile.id" [selected]="profile.workTypes.includes(type)">{{ profile.name }}</option> }</select></td>
            @for (style of ['dreamer', 'planner', 'tinkerer']; track style) { <td class="small" [class.lay-strong]="ctx.setup()?.profile === style">{{ modeLabel[styleMode(style, type)] }}</td> }</tr> }</tbody></table></div>
        <h2 class="lay-gap-top">Individual preferences</h2>
        <div class="lay-prefs">@for (pref of preferences(); track pref.id) { <label [for]="'pref-' + pref.id">{{ pref.label }}</label>
          <select [id]="'pref-' + pref.id" (change)="setPreference(pref.id, $any($event.target).value)">@for (option of pref.options; track option[0]) { <option [value]="option[0]" [selected]="ctx.setup()?.preferences?.[pref.id] === option[0]">{{ option[1] }}</option> }</select> }</div>
      }
      @default {
        <section class="lay-card lay-batch" aria-labelledby="batch-heading">
          @if (runningBatch(); as batch) {
            <div class="lay-row lay-wrap"><h2 id="batch-heading" class="lay-flat"><mat-icon aria-hidden="true">smart_toy</mat-icon> {{ batch.ref }} is running</h2><span class="lay-chip lay-l-work">{{ doneCount(batch) }} of {{ batch.items.length }} done</span>
              <button type="button" class="lay-button ghost small lay-push" (click)="stopBatch(batch.id)" [disabled]="batch.state === 'stopping'">{{ batch.state === 'stopping' ? 'Stopping after this item…' : 'Stop after this item' }}</button></div>
            <p class="lay-muted small">Started by {{ batch.startedBy }}. Agents work through the items one at a time on your {{ accountLabel() }} key. Drafts come back to you in review.</p>
            <ol class="lay-batch-items">@for (id of batch.items; track id) { @if (workById().get(id); as item) { <li><a [href]="ctx.link('work', 'item', item.id)" (click)="ctx.go(ctx.link('work', 'item', item.id), $event)">{{ item.title }}</a> <span class="lay-chip" [class.lay-ok]="item.state === 'review' || item.state === 'done' || item.state === 'needs-input'" [class.lay-plain]="item.state === 'claimed'">{{ item.state === 'claimed' ? (isWorking(item) ? 'Working…' : 'Waiting') : stateLabel[item.state] }}</span></li> } }</ol>
          } @else {
            <div class="lay-row lay-wrap"><h2 id="batch-heading" class="lay-flat"><mat-icon aria-hidden="true">smart_toy</mat-icon> Next agent batch</h2><span class="lay-count">{{ draftItems().length }} of {{ draftBatch()?.limit || 10 }}</span></div>
            <p class="lay-muted small">Nothing runs until you press Go. Go locks these items for their agent profiles and spends on your {{ accountLabel() || 'connected' }} key.</p>
            @if (draftItems().length) {
              <ol class="lay-batch-items">@for (item of draftItems(); track item.id) { <li><a [href]="ctx.link('work', 'item', item.id)" (click)="ctx.go(ctx.link('work', 'item', item.id), $event)">{{ item.title }}</a> <small class="lay-muted">{{ item.assignee?.label }}</small>
                <button type="button" class="lay-link-button" (click)="removeFromBatch(item.id)" [attr.aria-label]="'Take out: ' + item.title">Take out</button></li> }</ol>
            } @else { <p class="lay-muted">Empty. Add work from the list below, or fill it with the highest-priority work.</p> }
            <div class="lay-row lay-wrap">
              <button type="button" class="lay-button ghost small" (click)="fillBatch()" [disabled]="!ctx.data()?.agentPool?.length || draftItems().length >= (draftBatch()?.limit || 10)"><mat-icon aria-hidden="true">playlist_add</mat-icon>Fill with the next {{ (draftBatch()?.limit || 10) - draftItems().length }}</button>
              <button type="button" class="lay-button small" (click)="startBatch()" [disabled]="!draftItems().length || !ctx.setup()?.agentConnection"><mat-icon aria-hidden="true">play_arrow</mat-icon>Go: run {{ draftItems().length }} {{ draftItems().length === 1 ? 'item' : 'items' }}</button>
              @if (!ctx.setup()?.agentConnection) { <a class="small" [href]="ctx.link('work', 'agents')" (click)="ctx.go(ctx.link('work', 'agents'), $event)">Connect a key first</a> }
            </div>
          }
          @if (finishedBatches().length) {
            <details class="lay-log-list"><summary>Earlier batches · {{ finishedBatches().length }}</summary><ul class="small lay-plain-list">@for (batch of finishedBatches(); track batch.id) { <li>{{ batch.ref }}: {{ batch.state === 'done' ? 'finished' : 'stopped' }} {{ when(batch.finishedAt) }} · {{ batch.items.length }} items · {{ batch.usage.input + batch.usage.output }} tokens{{ batch.note ? ' · ' + batch.note : '' }}</li> }</ul></details>
          }
        </section>
        <details class="lay-suggested" [open]="!runningBatch() && !draftItems().length"><summary>Available for agents · {{ ctx.data()?.agentPool?.length || 0 }}</summary>
          <p class="lay-muted small">Work your working style hands to agents, highest priority first: the current phase before later ones, then acceptance and clarifications, contracts, specs and designs. Nothing here runs by itself.</p>
          <ul class="lay-list lay-card">@for (entry of ctx.data()?.agentPool || []; track entry.key) { <li class="lay-item"><span [class]="'lay-chip lay-l-' + entry.layer">{{ layerLabel[entry.layer] }}</span><span class="lay-body-text"><strong>{{ entry.title }}</strong><small>{{ typeLabel(entry.type) }} · {{ ctx.profileById().get(entry.profileId || '')?.name }}</small></span>
            <button type="button" class="lay-button ghost small" (click)="addToBatch(entry)" [disabled]="!!runningBatch()" [attr.aria-label]="'Add to batch: ' + entry.title">Add to batch</button></li> }
            @empty { <li class="lay-muted lay-pad">Nothing your working style hands to agents right now.</li> }</ul></details>
        @for (group of groups(); track group.state) {
          @if (group.items.length) {
            <div class="lay-section-title"><h2>{{ group.title }}</h2><span class="lay-count">{{ group.items.length }}</span></div>
            <ul class="lay-list lay-card">@for (work of group.items; track work.id) { <li><a class="lay-item" [href]="ctx.link('work', 'item', work.id)" (click)="ctx.go(ctx.link('work', 'item', work.id), $event)"><span [class]="'lay-chip lay-l-' + work.layer">{{ layerLabel[work.layer] }}</span><span class="lay-body-text"><strong>{{ work.title }}</strong><small>{{ work.ref }} · {{ typeLabel(work.type) }}{{ work.assignee ? ' · ' + work.assignee.label : '' }}</small></span><span class="lay-chip lay-plain">{{ stateLabel[work.state] }}</span></a></li> }</ul>
          }
        }
        <details class="lay-suggested" [open]="!activeCount()"><summary>Suggested by the layers (not queued yet) · {{ ctx.suggestions().length }}</summary>
          <ul class="lay-list lay-card">@for (suggestion of ctx.suggestions(); track suggestion.key) { <li class="lay-item"><span [class]="'lay-chip lay-l-' + suggestion.layer">{{ layerLabel[suggestion.layer] }}</span><span class="lay-body-text"><strong>{{ suggestion.title }}</strong><small>{{ typeLabel(suggestion.type) }}</small></span>
            <button type="button" class="lay-button small" (click)="start(suggestion)">Start now</button><button type="button" class="lay-button ghost small" (click)="queue(suggestion)">Add to queue</button>
            @if (agentCapable(suggestion.type)) { <button type="button" class="lay-link-button" (click)="addSuggestionToBatch(suggestion.key)" [disabled]="!!runningBatch()">Give to an agent</button> }</li> }
            @empty { <li class="lay-muted lay-pad">No gaps found. Nice.</li> }</ul></details>
      }
    }
  }`
})
export class WorkLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly tabs = [['queue', 'Queue'], ['agents', 'Agents'], ['routines', 'Routines'], ['style', 'Working style']];
  readonly layerLabel = layerLabel;
  readonly stateLabel = stateLabel;
  readonly modeLabel = modeLabel;
  readonly verified = ['define', 'spec', 'plan', 'design', 'research', 'configure'];
  readonly cadenceLabel: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', 'before-release': 'Before each release' };
  readonly cadenceEntries = Object.entries(this.cadenceLabel);
  readonly layerEntries = Object.entries(layerLabel);
  readonly routines = computed(() => this.ctx.data()?.routines || []);
  readonly workById = computed(() => new Map((this.ctx.data()?.work || []).map(item => [item.id, item])));
  newRoutine = { title: '', layer: 'product', type: 'audit', cadence: 'weekly', documents: '' };
  reviewNote = '';
  readonly batches = computed(() => this.ctx.data()?.batches || []);
  readonly draftBatch = computed(() => this.batches().find(batch => batch.state === 'draft') || null);
  readonly runningBatch = computed(() => this.batches().find(batch => batch.state === 'running' || batch.state === 'stopping') || null);
  readonly finishedBatches = computed(() => this.batches().filter(batch => batch.state === 'done' || batch.state === 'stopped'));
  readonly draftItems = computed(() => (this.draftBatch()?.items || []).map(id => this.workById().get(id)).filter((item): item is WorkItem => Boolean(item)));
  readonly accountLabel = computed(() => this.ctx.setup()?.agentConnection?.label || '');
  private poll: ReturnType<typeof setInterval> | null = null;
  readonly tab = computed(() => this.ctx.segments()[1] || 'queue');
  readonly item = computed(() => this.tab() === 'item' ? (this.ctx.data()?.work || []).find(work => work.id === this.ctx.segments()[2]) || null : null);
  readonly groups = computed(() => {
    const work = this.ctx.data()?.work || [];
    // Items waiting in the next batch show in the batch panel, not twice.
    return [['needs-input', 'Needs you'], ['review', 'In review'], ['claimed', 'In progress'], ['ready', 'Ready to pick up'], ['suggested', 'Staged as suggestions'], ['done', 'Done']].map(([state, title]) => ({ state, title, items: work.filter(item => item.state === state && !(state === 'ready' && item.context?.batch)) }));
  });
  readonly activeCount = computed(() => (this.ctx.data()?.work || []).filter(item => item.state !== 'done').length);
  readonly workingStyles = computed(() => Object.entries(this.ctx.catalog()?.profiles || {}).map(([id, value]) => ({ id, label: value.label })));
  readonly preferences = computed(() => Object.entries(this.ctx.catalog()?.preferences || {}).map(([id, value]) => ({ id, label: value.label, options: Object.entries(value.values) })));
  readonly profiles = computed(() => this.ctx.data()?.profiles || []);
  readonly profile = computed(() => this.tab() === 'agents' ? this.ctx.profileById().get(this.ctx.segments()[2]) || null : null);
  readonly reconcile = signal<ReconcileContext | null>(null);
  private draftFor = '';
  private profileFor = '';
  private instructionsFor = -1;
  answerDraft = ''; whyDraft = ''; documentsDraft = '';
  profileDraft = { instructions: '', model: '', approval: '', rationale: '' };
  instructionsDraft = ''; instructionsWhy = '';

  constructor() {
    // While a batch runs, refresh every few seconds so progress shows without a reload.
    effect(() => {
      const running = Boolean(this.runningBatch());
      untracked(() => {
        if (running && !this.poll) this.poll = setInterval(() => void this.ctx.reload().catch(() => undefined), 3000);
        if (!running && this.poll) { clearInterval(this.poll); this.poll = null; }
      });
    });
    // A Reconcile item's diff, units and tests are read live from the code links when it is opened.
    effect(() => {
      const work = this.item();
      untracked(() => {
        this.reconcile.set(null);
        if (work?.type === 'reconcile') void this.ctx.api<ReconcileContext>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/reconcile/${encodeURIComponent(work.id)}`).then(value => this.reconcile.set(value), () => this.reconcile.set(null));
      });
    });
  }

  ngDoCheck() {
    const work = this.item();
    if (work && `${work.id}:${work.updatedAt}` !== this.draftFor) { this.draftFor = `${work.id}:${work.updatedAt}`; this.answerDraft = ''; this.whyDraft = ''; this.documentsDraft = work.documents.join('\n'); }
    const profile = this.profile();
    if (profile && `${profile.id}:${profile.revision}` !== this.profileFor) { this.profileFor = `${profile.id}:${profile.revision}`; this.profileDraft = { instructions: profile.instructions, model: profile.model, approval: profile.approvalRequired.join('\n'), rationale: '' }; }
    const instructions = this.ctx.data()?.projectInstructions;
    if (instructions && instructions.revision !== this.instructionsFor) { this.instructionsFor = instructions.revision; this.instructionsDraft = instructions.body; this.instructionsWhy = ''; }
  }

  targetHref(kind: string, id: string) { return this.ctx.recordHref(kind, id); }

  bundle(work: WorkItem): [string, string, string][] {
    const data = this.ctx.data()!;
    const stories = work.targets.map(target => this.ctx.storyById().get(target.id)).filter(Boolean);
    const pages = [...new Set([...work.targets.filter(target => target.kind === 'page').map(target => target.id), ...stories.flatMap(story => story!.pages)])].map(id => this.ctx.pageById().get(id)).filter(Boolean);
    const specs = data.specs.filter(spec => work.targets.some(target => target.id === spec.id) || spec.stories.some(id => stories.some(story => story!.id === id)));
    const decisions = stories.flatMap(story => story!.history.map(entry => `${entry.rationale}`));
    const principles = data.vision['principles']?.items || [];
    return [
      ['Goal', work.title, work.ref] as [string, string, string],
      ...stories.map(story => ['Story', `${story!.title} (${story!.acceptance.length} Given/When/Then)`, story!.ref] as [string, string, string]),
      ...(principles.length ? [['Principles', principles.join('; '), 'Product › Vision'] as [string, string, string]] : []),
      ...(pages.length ? [['Pages', pages.map(page => `${page!.label} (${this.ctx.catalog()?.pageTypes[page!.pageType]?.label || page!.pageType})`).join(', '), 'Pages'] as [string, string, string]] : []),
      ...(specs.length ? [['Spec', specs.map(spec => `${spec.ref} ${spec.title}`).join('; '), 'Product › Specs'] as [string, string, string]] : []),
      ['Technical context', `${this.ctx.setup()?.stack?.preset}${specs.flatMap(spec => spec.entities).length ? '; ' + specs.flatMap(spec => spec.entities).join(', ') : ''}`, 'Platform › Architecture'],
      ...(decisions.length ? [['Decisions so far', decisions.slice(0, 3).join(' · '), 'Story history'] as [string, string, string]] : []),
      ['Will document', work.documents.join('; ') || 'Not set yet', 'This item']
    ];
  }

  typeLabel(type: string) { return type.charAt(0).toUpperCase() + type.slice(1); }
  nextStates(work: WorkItem) { return ['ready', 'claimed', 'review', 'done'].filter(state => state !== work.state); }
  queue(suggestion: Suggestion) { void this.ctx.write(() => this.ctx.stage(suggestion), 'Added to the queue.'); }
  start(suggestion: Suggestion) {
    void this.ctx.write(async () => { const work = await this.ctx.stage(suggestion); await this.ctx.updateWork(work.id, { assignee: { kind: 'person' } }); this.ctx.go(this.ctx.link('work', 'item', work.id)); }, 'You picked this up.');
  }
  // A style's mode for a type, from the style's own defaults (the current project's overrides show in "In this project").
  styleMode(style: string, type: string) {
    const rule = this.ctx.catalog()?.automation?.workTypes[type];
    const defaults = (this.ctx.catalog()?.profiles[style] as { defaults?: Record<string, string> } | undefined)?.defaults || {};
    return rule ? rule.modes[defaults[rule.preference]] || 'you' : 'you';
  }
  ngOnDestroy() { if (this.poll) clearInterval(this.poll); }
  private batchApi(action: string, body: unknown) { return this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/batches/${action}`, 'POST', body); }
  agentCapable(type: string) { return type === 'define' || type === 'plan'; }
  doneCount(batch: { items: string[] }) { return batch.items.filter(id => { const state = this.workById().get(id)?.state; return state && state !== 'claimed' && state !== 'ready'; }).length; }
  isWorking(item: WorkItem) { return /is working on it/.test(item.log.at(-1)?.text || ''); }
  targetNoun(work: WorkItem) { return work.targets[0]?.kind === 'data_object' ? 'object' : work.targets[0]?.kind || 'record'; }
  addToBatch(entry: { kind: string; key: string; workId: string | null }) { void this.ctx.write(() => this.batchApi('add', entry.kind === 'item' ? { workId: entry.workId } : { suggestion: entry.key }), 'Added to the batch.'); }
  addSuggestionToBatch(key: string) { void this.ctx.write(() => this.batchApi('add', { suggestion: key }), 'Added to the batch.'); }
  removeFromBatch(workId: string) { void this.ctx.write(() => this.batchApi('remove', { workId }), 'Taken out of the batch.'); }
  fillBatch() { void this.ctx.write(async () => { const result = await this.batchApi('fill', { count: this.draftBatch()?.limit || 10 }) as { added: number }; this.ctx.notice.set(`Added ${result.added}.`); }, ''); }
  startBatch() { const batch = this.draftBatch(); if (batch) void this.ctx.write(() => this.batchApi('start', { batchId: batch.id }), `${batch.ref} started. Drafts will appear in review.`); }
  stopBatch(batchId: string) { void this.ctx.write(() => this.batchApi('stop', { batchId }), 'Stopping after the current item.'); }
  sendBack(work: WorkItem) { void this.ctx.write(async () => { await this.ctx.updateWork(work.id, { state: 'ready', note: this.reviewNote || 'Sent back for another draft' }); this.reviewNote = ''; }, 'Sent back. Add it to a batch to have the agent try again.'); }
  applicable(kind: string) { return ['story', 'spec', 'page'].includes(kind); }
  shortLabel(target: { id: string; kind: string; label: string }) { return this.ctx.storyById().get(target.id)?.ref || target.label; }
  openTarget(work: WorkItem, kind: string, id: string, event: Event) { if (work.state !== 'done') this.ctx.workOn(work); this.ctx.go(this.targetHref(kind, id), event); }
  apply(work: WorkItem, targetId: string) { void this.ctx.write(() => this.ctx.updateWork(work.id, { apply: targetId }), 'Applied. The record has a new revision with your reason.'); }
  when(at: string | null) { return at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'; }
  toggleRoutine(id: string, revision: number, enabled: boolean) { void this.ctx.write(() => this.ctx.change(id, { enabled }, revision, enabled ? 'Turned on' : 'Turned off'), enabled ? 'Routine on.' : 'Routine off.'); }
  runRoutine(id: string) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/routines/${encodeURIComponent(id)}`, 'POST', {}), 'Ran it. The new item is in the queue.'); }
  addRoutine() {
    void this.ctx.write(async () => { await this.ctx.record('routine', { ...this.newRoutine, documents: lines(this.newRoutine.documents) }, null, 'Added by you'); this.newRoutine = { title: '', layer: 'product', type: 'audit', cadence: 'weekly', documents: '' }; }, 'Routine added.');
  }
  assign(work: WorkItem, kind: string) { void this.ctx.write(() => this.ctx.updateWork(work.id, { assignee: { kind } }), 'Assigned.'); }
  assignProfile(work: WorkItem, profileId: string) { void this.ctx.write(() => this.ctx.updateWork(work.id, { assignee: { kind: 'agent', profileId } }), 'Profile changed.'); }
  profileWork(profile: AgentProfile) { return (this.ctx.data()?.work || []).filter(item => item.profileId === profile.id); }
  saveProfile(profile: AgentProfile) {
    void this.ctx.write(() => this.ctx.change(profile.id, { instructions: this.profileDraft.instructions, model: this.profileDraft.model, approvalRequired: lines(this.profileDraft.approval) }, profile.revision, this.profileDraft.rationale || 'Instructions revised'), 'Profile saved. New work uses this revision.');
  }
  saveInstructions() {
    const record = this.ctx.data()?.projectInstructions; if (!record) return;
    void this.ctx.write(() => this.ctx.change(record.id, { body: this.instructionsDraft }, record.revision, this.instructionsWhy || 'Project instructions revised'), 'Saved. Export AGENTS.md to put them in the repository.');
  }
  exportAgents() { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/agents/export`, 'POST', {}), 'AGENTS.md written to the workspace. The next build commits it.'); }
  route(type: string, profileId: string) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/routing`, 'PUT', { type, profileId }), `${this.typeLabel(type)} work now goes to ${this.ctx.profileById().get(profileId)?.name}.`); }
  show(value: unknown): string {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return '—';
    if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('; ');
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  move(work: WorkItem, state: string) {
    void this.ctx.write(async () => { await this.ctx.updateWork(work.id, { state }); if (state === 'done' && this.ctx.workingOn()?.id === work.id) this.ctx.workingOn.set(null); }, `Moved to ${stateLabel[state]}.`);
  }
  answer(work: WorkItem) { void this.ctx.write(() => this.ctx.updateWork(work.id, { answer: this.answerDraft, rationale: this.whyDraft }), 'Answer saved.'); }
  saveDocuments(work: WorkItem) { void this.ctx.write(() => this.ctx.updateWork(work.id, { documents: lines(this.documentsDraft) }), 'Saved.'); }
  switchProfile(profile: string) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/preferences`, 'PUT', { profile }), 'Working style changed. Your individual preferences were kept.'); }
  setPreference(key: string, value: string) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/preferences`, 'PUT', { overrides: { [key]: value } }), 'Preference saved.'); }
}
