import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AgentConnectionComponent } from '../agent-connection';
import { AgentProfile, ProjectContext, Suggestion, WorkItem, layerLabel, lines, stateLabel } from './context';

interface ReconcileContext { recordId: string; fromRevision: number; toRevision: number; changes: { field: string; before: unknown; after: unknown }[];
  units: { id: string; symbol: string; path: string; kind: string; calls: string[]; calledBy: string[] }[]; tests: string[]; }

const automation: [string, Record<string, string>][] = [
  ['Vision and roadmap', { dreamer: 'Agent asks a few questions, then drafts', planner: 'You', tinkerer: 'You' }],
  ['Stories and acceptance', { dreamer: 'Agent drafts · you review', planner: 'You', tinkerer: 'You' }],
  ['Specs', { dreamer: 'Agent drafts · asks only blockers', planner: 'Agent drafts · you review', tinkerer: 'You' }],
  ['Page designs', { dreamer: 'Agent · asks when options differ', planner: 'Agent · you choose', tinkerer: 'You' }],
  ['Implementation', { dreamer: 'Template if possible, else agent', planner: 'Template if possible, else agent', tinkerer: 'Template if possible, else you' }],
  ['Platform configuration', { dreamer: 'Agent · you approve effects', planner: 'Agent · you approve effects', tinkerer: 'You' }]
];

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
        @if (work.question && !work.question.answer) {
          <form class="lay-question" (ngSubmit)="answer(work)"><h2><mat-icon aria-hidden="true">help</mat-icon> {{ work.question.text }}</h2>
            @if (work.question.options.length) { <div class="lay-choices" role="radiogroup" aria-label="Answer">@for (option of work.question.options; track option) { <label class="lay-choice" [class.selected]="answerDraft === option"><input type="radio" name="answer" [value]="option" [(ngModel)]="answerDraft">{{ option }}</label> }</div> }
            @else { <label>Answer<input name="answer" [(ngModel)]="answerDraft"></label> }
            <label>Why (saved with the decision)<textarea name="why" rows="2" [(ngModel)]="whyDraft"></textarea></label>
            <button type="submit" class="lay-button" [disabled]="!answerDraft.trim()">Answer</button></form>
        } @else if (work.question?.answer) {
          <section class="lay-card"><h2>Decided</h2><p><strong>{{ work.question?.text }}</strong><br>{{ work.question?.answer }}{{ work.question?.rationale ? ' — ' + work.question?.rationale : '' }}</p><p class="lay-muted small">By {{ work.question?.answeredBy }}. Record it in the story or page this changes, with the same reason.</p></section>
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
          <div class="lay-connected">@for (target of work.targets; track target.id) { <a [href]="targetHref(target.kind, target.id)" (click)="ctx.go(targetHref(target.kind, target.id), $event)"><span class="lay-chip lay-plain">{{ target.kind }}</span> {{ target.label }}</a> }</div>
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
          <p class="lay-muted small">{{ work.assignee ? 'On it: ' + work.assignee.label + '.' : 'Nobody yet.' }} Agents pick up assigned items once agent work arrives (LAY-04).</p>
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
            <aludel-agent-connection class="lay-card" [projectId]="ctx.projectId()" heading="Accounts" description="Connections to AI providers. Profiles use the project's connection; swapping providers never rewrites instructions." (changed)="ctx.reload()" />
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
        <div class="lay-card lay-quiet"><h2>Routines arrive with work automation (LAY-04)</h2><p class="lay-muted">Planned: a weekly product-drift check (Product), an accessibility sweep (Pages), monthly dependency updates and a security audit before each release (Platform). Each run creates ordinary work items here.</p></div>
      }
      @case ('style') {
        <div class="lay-row lay-wrap"><span>Working style:</span><div class="lay-toggle" role="group" aria-label="Working style">@for (profile of workingStyles(); track profile.id) { <button type="button" [class.on]="ctx.setup()?.profile === profile.id" [attr.aria-pressed]="ctx.setup()?.profile === profile.id" (click)="switchProfile(profile.id)">{{ profile.label }}</button> }</div></div>
        <p class="lay-muted">The style decides which kinds of work are staged and handed to agents automatically once automation arrives (LAY-04). It isn't stored on a task; any item can be reassigned.</p>
        <h2 class="lay-gap-top">Who takes each kind of work</h2>
        <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Work routing"><table><thead><tr><th>Work type</th><th>Agent profile</th><th>Guidance</th></tr></thead><tbody>
          @for (type of ctx.data()?.workTypes || []; track type) { <tr><td><label [for]="'route-' + type">{{ typeLabel(type) }}</label></td>
            <td><select [id]="'route-' + type" (change)="route(type, $any($event.target).value)">@for (profile of profiles(); track profile.id) { <option [value]="profile.id" [selected]="profile.workTypes.includes(type)">{{ profile.name }}</option> }</select></td>
            <td class="small">{{ ctx.data()?.guidance?.[type] }}</td></tr> }</tbody></table></div>
        <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Automation by working style"><table><thead><tr><th>Work type</th><th>Dreamer</th><th>Planner</th><th>Tinkerer</th></tr></thead><tbody>
          @for (row of automation; track row[0]) { <tr><td>{{ row[0] }}</td>@for (profile of ['dreamer', 'planner', 'tinkerer']; track profile) { <td [class.lay-strong]="ctx.setup()?.profile === profile">{{ row[1][profile] }}</td> }</tr> }</tbody></table></div>
        <h2 class="lay-gap-top">Individual preferences</h2>
        <div class="lay-prefs">@for (pref of preferences(); track pref.id) { <label [for]="'pref-' + pref.id">{{ pref.label }}</label>
          <select [id]="'pref-' + pref.id" (change)="setPreference(pref.id, $any($event.target).value)">@for (option of pref.options; track option[0]) { <option [value]="option[0]" [selected]="ctx.setup()?.preferences?.[pref.id] === option[0]">{{ option[1] }}</option> }</select> }</div>
      }
      @default {
        @for (group of groups(); track group.state) {
          @if (group.items.length) {
            <div class="lay-section-title"><h2>{{ group.title }}</h2><span class="lay-count">{{ group.items.length }}</span></div>
            <ul class="lay-list lay-card">@for (work of group.items; track work.id) { <li><a class="lay-item" [href]="ctx.link('work', 'item', work.id)" (click)="ctx.go(ctx.link('work', 'item', work.id), $event)"><span [class]="'lay-chip lay-l-' + work.layer">{{ layerLabel[work.layer] }}</span><span class="lay-body-text"><strong>{{ work.title }}</strong><small>{{ work.ref }} · {{ typeLabel(work.type) }}{{ work.assignee ? ' · ' + work.assignee.label : '' }}</small></span><span class="lay-chip lay-plain">{{ stateLabel[work.state] }}</span></a></li> }</ul>
          }
        }
        <details class="lay-suggested" [open]="!activeCount()"><summary>Suggested by the layers (not queued yet) · {{ ctx.suggestions().length }}</summary>
          <ul class="lay-list lay-card">@for (suggestion of ctx.suggestions(); track suggestion.key) { <li class="lay-item"><span [class]="'lay-chip lay-l-' + suggestion.layer">{{ layerLabel[suggestion.layer] }}</span><span class="lay-body-text"><strong>{{ suggestion.title }}</strong><small>{{ typeLabel(suggestion.type) }}</small></span>
            <button type="button" class="lay-button small" (click)="start(suggestion)">Start now</button><button type="button" class="lay-button ghost small" (click)="queue(suggestion)">Add to queue</button></li> }
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
  readonly automation = automation;
  readonly tab = computed(() => this.ctx.segments()[1] || 'queue');
  readonly item = computed(() => this.tab() === 'item' ? (this.ctx.data()?.work || []).find(work => work.id === this.ctx.segments()[2]) || null : null);
  readonly groups = computed(() => {
    const work = this.ctx.data()?.work || [];
    return [['needs-input', 'Needs you'], ['review', 'In review'], ['claimed', 'In progress'], ['ready', 'Ready to pick up'], ['suggested', 'Staged as suggestions'], ['done', 'Done']].map(([state, title]) => ({ state, title, items: work.filter(item => item.state === state) }));
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
  move(work: WorkItem, state: string) { void this.ctx.write(() => this.ctx.updateWork(work.id, { state }), `Moved to ${stateLabel[state]}.`); }
  answer(work: WorkItem) { void this.ctx.write(() => this.ctx.updateWork(work.id, { answer: this.answerDraft, rationale: this.whyDraft }), 'Answer saved.'); }
  saveDocuments(work: WorkItem) { void this.ctx.write(() => this.ctx.updateWork(work.id, { documents: lines(this.documentsDraft) }), 'Saved.'); }
  switchProfile(profile: string) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/preferences`, 'PUT', { profile }), 'Working style changed. Your individual preferences were kept.'); }
  setPreference(key: string, value: string) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/preferences`, 'PUT', { overrides: { [key]: value } }), 'Preference saved.'); }
}
