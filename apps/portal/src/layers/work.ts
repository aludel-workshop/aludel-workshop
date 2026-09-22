import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext, Suggestion, WorkItem, layerLabel, lines, stateLabel } from './context';

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
  imports: [FormsModule, MatIconModule],
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
      @case ('routines') {
        <div class="lay-card lay-quiet"><h2>Routines arrive with work automation (LAY-04)</h2><p class="lay-muted">Planned: a weekly product-drift check (Product), an accessibility sweep (Pages), monthly dependency updates and a security audit before each release (Platform). Each run creates ordinary work items here.</p></div>
      }
      @case ('style') {
        <div class="lay-row lay-wrap"><span>Working style:</span><div class="lay-toggle" role="group" aria-label="Working style">@for (profile of profiles(); track profile.id) { <button type="button" [class.on]="ctx.setup()?.profile === profile.id" [attr.aria-pressed]="ctx.setup()?.profile === profile.id" (click)="switchProfile(profile.id)">{{ profile.label }}</button> }</div></div>
        <p class="lay-muted">The style decides which kinds of work are staged and handed to agents automatically once automation arrives (LAY-04). It isn't stored on a task; any item can be reassigned.</p>
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
  readonly tabs = [['queue', 'Queue'], ['routines', 'Routines'], ['style', 'Working style']];
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
  readonly profiles = computed(() => Object.entries(this.ctx.catalog()?.profiles || {}).map(([id, value]) => ({ id, label: value.label })));
  readonly preferences = computed(() => Object.entries(this.ctx.catalog()?.preferences || {}).map(([id, value]) => ({ id, label: value.label, options: Object.entries(value.values) })));
  private draftFor = '';
  answerDraft = ''; whyDraft = ''; documentsDraft = '';

  ngDoCheck() {
    const work = this.item();
    if (work && `${work.id}:${work.updatedAt}` !== this.draftFor) { this.draftFor = `${work.id}:${work.updatedAt}`; this.answerDraft = ''; this.whyDraft = ''; this.documentsDraft = work.documents.join('\n'); }
  }

  targetHref(kind: string, id: string) {
    if (kind === 'page') return this.ctx.link('pages', 'tree', id);
    if (kind === 'spec') return this.ctx.link('product', 'specs', id);
    return this.ctx.link('product', 'map', id);
  }

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
  assign(work: WorkItem, kind: string) { void this.ctx.write(() => this.ctx.updateWork(work.id, { assignee: { kind, label: kind === 'agent' ? `${layerLabel[work.layer]} agent` : undefined } }), 'Assigned.'); }
  move(work: WorkItem, state: string) { void this.ctx.write(() => this.ctx.updateWork(work.id, { state }), `Moved to ${stateLabel[state]}.`); }
  answer(work: WorkItem) { void this.ctx.write(() => this.ctx.updateWork(work.id, { answer: this.answerDraft, rationale: this.whyDraft }), 'Answer saved.'); }
  saveDocuments(work: WorkItem) { void this.ctx.write(() => this.ctx.updateWork(work.id, { documents: lines(this.documentsDraft) }), 'Saved.'); }
  switchProfile(profile: string) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/preferences`, 'PUT', { profile }), 'Working style changed. Your individual preferences were kept.'); }
  setPreference(key: string, value: string) { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/preferences`, 'PUT', { overrides: { [key]: value } }), 'Preference saved.'); }
}
