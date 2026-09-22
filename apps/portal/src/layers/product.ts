import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Activity, ProjectContext, Scenario, Spec, Story, VisionSection, lines, phaseName, stateLabel, statusLabel } from './context';

const docTemplates: Record<string, string> = {
  Blank: '',
  'PR/FAQ': '# Press release\n\nHeadline: …\n\nWho it is for, and the problem it solves: …\n\nHow it works: …\n\nQuote from a customer: …\n\n# FAQ\n\n## Customer questions\n\n## Internal questions\n',
  Positioning: '# Positioning\n\nFor (target customer) who (need), (product) is a (category) that (key benefit). Unlike (alternative), we (difference).\n',
  'Launch plan': '# Launch plan\n\n## Audience\n\n## Channels\n\n## Timeline\n\n## Success measures\n',
  'Decision memo': '# Decision\n\n## Context\n\n## Options\n\n## Decision and why\n\n## Consequences\n'
};

// Product: the founder and product lead. What we're building and why (knowledge-structures.md › Product).
@Component({
  selector: 'aludel-product-layer', standalone: true,
  imports: [FormsModule, MatIconModule],
  template: `
  <p class="lay-eyebrow">Product · founder and product lead</p>
  <h1 tabindex="-1">What we're building, and why</h1>
  <nav class="lay-tabs" aria-label="Product sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('product', entry[0])" (click)="ctx.go(ctx.link('product', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }
  </nav>

  @switch (tab()) {
    @case ('map') {
      <div class="lay-personas" aria-label="Users">
        @for (persona of data().personas; track persona.id) { <span class="lay-persona"><span class="lay-avatar lay-avatar-product" aria-hidden="true">{{ persona.name[0] }}</span><span><strong>{{ persona.name }}</strong><small>{{ persona.role || 'User' }}</small></span></span> }
        @if (!data().personas.length) { <span class="lay-muted">No personas yet. <a [href]="ctx.link('product', 'vision')" (click)="ctx.go(ctx.link('product', 'vision'), $event)">Add them in Vision</a>.</span> }
      </div>
      @if (columns().length) {
        <div class="lay-map-wrap" tabindex="0" role="region" aria-label="Story map">
          <div class="lay-storymap" [style.grid-template-columns]="'repeat(' + columns().length + ', 220px)'">
            @for (activity of data().activities; track activity.id; let index = $index) {
              <div class="lay-activity" [style.grid-column]="activityColumn(index)"><span>{{ activity.title }}@if (activity.persona) { <small> · {{ activity.persona }}</small> }</span>
                @if (activity.pack) { <span class="lay-pack">{{ activity.pack }} pack</span> }
                <button type="button" class="lay-icon-button" (click)="addStep(activity)" [attr.aria-label]="'Add a step to ' + activity.title"><mat-icon>add</mat-icon></button></div>
            }
            @for (column of columns(); track column.step.id) { <div class="lay-step">{{ column.step.title }}</div> }
            @for (phase of data().phases; track phase.id) {
              <div class="lay-band" [class.current]="phase.current"><span><strong>{{ phase.label }}</strong> {{ phase.goal }}</span></div>
              @for (column of columns(); track column.step.id; let index = $index) {
                <div class="lay-cell" [style.grid-column]="index + 1">
                  @for (story of storiesIn(column.step.id, phase.key); track story.id) {
                    <a class="lay-story-card" [class.built]="story.status === 'built'" [class.active]="story.id === selectedId()" [href]="ctx.link('product', 'map', story.id)" (click)="ctx.go(ctx.link('product', 'map', story.id), $event)">
                      {{ story.title }}<span class="lay-meta"><span class="lay-dot" [style.background]="statusColor[story.status]"></span>{{ statusLabel[story.status] }}@if (story.template) { · template }@if (story.clarifications.length) { · <mat-icon class="lay-inline-icon" aria-label="has open clarifications">help</mat-icon> }</span></a>
                  }
                  @if (adding() === column.step.id + ':' + phase.key) {
                    <form class="lay-add-story" (ngSubmit)="addStory(column.step.id, phase.key)"><label class="visually-hidden" [for]="'new-' + column.step.id + phase.key">New story</label>
                      <input [id]="'new-' + column.step.id + phase.key" name="newStory" [(ngModel)]="newStory" placeholder="Someone can…" maxlength="160"><button type="submit" class="lay-button small" [disabled]="!newStory.trim()">Add</button></form>
                  } @else {
                    <button type="button" class="lay-ghost" (click)="adding.set(column.step.id + ':' + phase.key); newStory = ''" [attr.aria-label]="'Add a ' + phase.label + ' story to ' + column.step.title"><mat-icon aria-hidden="true">add</mat-icon></button>
                  }
                </div>
              }
            }
          </div>
        </div>
      } @else { <div class="lay-card lay-quiet"><h2>No activities yet</h2><p class="lay-muted">A story map starts with the big things people do, left to right. Add one below or pick story packs.</p></div> }
      <form class="lay-row lay-add-activity" (ngSubmit)="addActivity()">
        <label class="visually-hidden" for="new-activity">New activity</label><input id="new-activity" name="newActivity" [(ngModel)]="newActivity" placeholder="New activity, e.g. “Give it back”" maxlength="60">
        <button type="submit" class="lay-button ghost small" [disabled]="!newActivity.trim()"><mat-icon aria-hidden="true">add</mat-icon>Add activity</button>
        <span class="lay-muted">Status comes from connected work: defined → designed → built → shipped.</span>
      </form>
      @if (selected(); as story) {
        <aside class="lay-drawer" role="dialog" [attr.aria-labelledby]="'story-' + story.id" tabindex="-1">
          <a class="lay-close" [href]="ctx.link('product', 'map')" (click)="ctx.go(ctx.link('product', 'map'), $event)" aria-label="Close story"><mat-icon>close</mat-icon></a>
          <p class="lay-eyebrow">{{ locate(story) }} · {{ story.ref }}</p>
          <h2 [id]="'story-' + story.id" class="lay-drawer-title">{{ story.title }}</h2>
          <div class="lay-row"><span class="lay-phase" [class.current]="story.phase === currentPhase()">{{ phaseName(story.phase) }}</span><span class="lay-chip lay-plain">{{ statusLabel[story.status] }}</span>
            <span class="lay-muted small">{{ story.pack ? story.pack + ' pack' : 'Yours' }}{{ story.template ? ' · template-built' : '' }}</span></div>
          <form class="lay-form" (ngSubmit)="saveStory(story)">
            <label>Story<input name="title" [(ngModel)]="draft.title" maxlength="160"></label>
            <label>Phase<select name="phase" [(ngModel)]="draft.phase">@for (phase of data().phases; track phase.id) { <option [value]="phase.key">{{ phase.label }}</option> }</select></label>
            <label>Why it matters<input name="why" [(ngModel)]="draft.why" maxlength="400"></label>
            <fieldset><legend>Acceptance (Given / When / Then)</legend>
              @for (scenario of draft.acceptance; track $index; let i = $index) {
                <div class="lay-gwt-edit"><label>Given<input [name]="'g' + i" [(ngModel)]="scenario.given"></label><label>When<input [name]="'w' + i" [(ngModel)]="scenario.when"></label><label>Then<input [name]="'t' + i" [(ngModel)]="scenario.then"></label>
                  <button type="button" class="lay-link-button" (click)="draft.acceptance.splice(i, 1)">Remove scenario</button></div>
              }
              <button type="button" class="lay-button ghost small" (click)="draft.acceptance.push({ given: '', when: '', then: '' })"><mat-icon aria-hidden="true">add</mat-icon>Add scenario</button>
            </fieldset>
            <label>Edge cases (one per line)<textarea name="edges" rows="2" [(ngModel)]="draft.edges"></textarea></label>
            <label>Open clarifications (one per line)<textarea name="clarifications" rows="2" [(ngModel)]="draft.clarifications"></textarea></label>
            <label>Why this change (saved with the revision)<input name="rationale" [(ngModel)]="draft.rationale" maxlength="400"></label>
            <div class="lay-row"><button type="submit" class="lay-button">Save story</button><button type="button" class="lay-link-button danger" (click)="deleteStory(story)">Delete story</button></div>
          </form>
          <div class="lay-connected">
            <h3>Pages</h3>
            @for (pageId of story.pages; track pageId) { <a [href]="ctx.link('pages', 'tree', pageId)" (click)="ctx.go(ctx.link('pages', 'tree', pageId), $event)"><mat-icon aria-hidden="true">{{ ctx.pageById().get(pageId)?.icon }}</mat-icon>{{ ctx.pageById().get(pageId)?.label }}</a> } @empty { <p class="lay-muted">Not placed on a page yet.</p> }
            <h3>Specs</h3>
            @for (spec of specsFor(story); track spec.id) { <a [href]="ctx.link('product', 'specs', spec.id)" (click)="ctx.go(ctx.link('product', 'specs', spec.id), $event)">{{ spec.ref }} {{ spec.title }}</a> } @empty { <p class="lay-muted">Not in a spec yet.</p> }
            <h3>Work</h3>
            @for (item of workFor(story); track item.id) { <a [href]="ctx.link('work', 'item', item.id)" (click)="ctx.go(ctx.link('work', 'item', item.id), $event)">{{ item.ref }} {{ item.title }} <span class="lay-chip lay-plain">{{ stateLabel[item.state] }}</span></a> } @empty { <p class="lay-muted">No work yet.</p> }
            <h3>Why it is this way</h3>
            @if (story.history.length) { <div class="lay-history">@for (entry of story.history; track entry.revision) { <p>{{ entry.rationale }}<br><small>Revision {{ entry.revision }} · {{ entry.author }} · {{ entry.createdAt.slice(0, 10) }}</small></p> }</div> }
            @else { <p class="lay-muted">No recorded decisions yet.</p> }
          </div>
        </aside>
      }
    }

    @case ('roadmap') {
      <p class="lay-lead">Each phase is a slice of the story map with its own goal, time budget and exit criteria.</p>
      <div class="lay-columns">
        @for (phase of data().phases; track phase.id) {
          <section class="lay-column" [class.current]="phase.current" [attr.aria-labelledby]="'phase-' + phase.id">
            <div class="lay-row"><h2 [id]="'phase-' + phase.id" class="lay-flat">{{ phase.label }}</h2>@if (phase.current) { <span class="lay-chip lay-ok">Current</span> }</div>
            @if (editingPhase() === phase.id) {
              <form class="lay-form" (ngSubmit)="savePhase(phase.id, phase.revision)">
                <label>Goal<textarea name="goal" rows="2" [(ngModel)]="phaseDraft.goal"></textarea></label><label>Appetite<input name="appetite" [(ngModel)]="phaseDraft.appetite"></label>
                <label>Done when<textarea name="exit" rows="2" [(ngModel)]="phaseDraft.exit"></textarea></label><div class="lay-row"><button type="submit" class="lay-button small">Save</button><button type="button" class="lay-link-button" (click)="editingPhase.set('')">Cancel</button></div></form>
            } @else {
              <dl class="lay-kv small"><dt>Goal</dt><dd>{{ phase.goal || '—' }}</dd><dt>Appetite</dt><dd>{{ phase.appetite || '—' }}</dd><dt>Done when</dt><dd>{{ phase.exit || '—' }}</dd></dl>
              <button type="button" class="lay-link-button" (click)="editPhase(phase)">Edit phase</button>
            }
            @for (story of storiesInPhase(phase.key); track story.id) { <a class="lay-scard" [href]="ctx.link('product', 'map', story.id)" (click)="ctx.go(ctx.link('product', 'map', story.id), $event)"><span>{{ story.title }}</span><span class="lay-chip lay-plain">{{ statusLabel[story.status] }}</span></a> }
          </section>
        }
      </div>
    }

    @case ('specs') {
      @if (selectedSpec(); as spec) {
        <p class="lay-eyebrow"><a [href]="ctx.link('product', 'specs')" (click)="ctx.go(ctx.link('product', 'specs'), $event)">Specs</a> · {{ spec.ref }}</p>
        <form class="lay-card lay-form lay-spec" (ngSubmit)="saveSpec(spec)">
          <label>Title<input name="title" [(ngModel)]="specDraft.title"></label>
          <div class="lay-row"><label>Status<select name="status" [(ngModel)]="specDraft.status">@for (status of specStatuses; track status) { <option [value]="status">{{ status }}</option> }</select></label>
            <label>Phase<select name="phase" [(ngModel)]="specDraft.phase">@for (phase of data().phases; track phase.id) { <option [value]="phase.key">{{ phase.label }}</option> }</select></label></div>
          <fieldset><legend>Stories in this increment</legend><div class="lay-checks">@for (story of data().stories; track story.id) { <label><input type="checkbox" [checked]="specDraft.stories.includes(story.id)" (change)="toggleSpecStory(story.id)"> {{ story.ref }} {{ story.title }}</label> }</div></fieldset>
          <label>Problem<textarea name="problem" rows="2" [(ngModel)]="specDraft.problem"></textarea></label>
          <label>Appetite<input name="appetite" [(ngModel)]="specDraft.appetite"></label>
          <label>Solution sketch<textarea name="solution" rows="3" [(ngModel)]="specDraft.solution"></textarea></label>
          @for (field of specListFields; track field[0]) { <label>{{ field[1] }} (one per line)<textarea [name]="field[0]" rows="3" [(ngModel)]="specDraft[field[0]]"></textarea></label> }
          <label>Why this change<input name="rationale" [(ngModel)]="specDraft.rationale"></label>
          <div class="lay-row"><button type="submit" class="lay-button">Save spec</button><button type="button" class="lay-link-button danger" (click)="deleteRecord(spec.id, 'specs')">Delete spec</button></div>
          <p class="lay-muted small">Format: Shape Up pitch (problem, appetite, solution, rabbit holes, no-gos) plus numbered requirements — “FR-001 The system must …”, with WHEN for conditional ones.</p>
        </form>
      } @else {
        <p class="lay-lead">A spec covers an increment of related stories: the problem, a time budget, the solution sketch and the requirements agents build from.</p>
        <ul class="lay-list lay-card">
          @for (spec of data().specs; track spec.id) { <li><a class="lay-item" [href]="ctx.link('product', 'specs', spec.id)" (click)="ctx.go(ctx.link('product', 'specs', spec.id), $event)"><span class="lay-chip lay-l-product">{{ spec.ref }}</span><span class="lay-body-text"><strong>{{ spec.title }}</strong><small>{{ spec.stories.length }} stories · {{ phaseName(spec.phase) }}</small></span><span class="lay-chip lay-plain">{{ spec.status }}</span></a></li> }
          @empty { <li class="lay-muted lay-pad">No specs yet.</li> }
        </ul>
        <form class="lay-row lay-add-activity" (ngSubmit)="createSpec()"><label class="visually-hidden" for="new-spec">New spec title</label><input id="new-spec" name="newSpec" [(ngModel)]="newSpec" placeholder="New spec, e.g. “Ask to borrow, and get an answer”" maxlength="120"><button type="submit" class="lay-button ghost small" [disabled]="!newSpec.trim()"><mat-icon aria-hidden="true">add</mat-icon>New spec</button></form>
      }
    }

    @case ('research') {
      <p class="lay-lead">Evidence behind needs and stories. Opportunities should come from real stories people tell, not guesses.</p>
      <div class="lay-grid lay-g2">
        @for (item of data().research; track item.id) { <section class="lay-card"><h2>{{ item.title }}</h2><p class="lay-pre">{{ item.body }}</p>
          @if (item.supports.length) { <p class="small">Supports: @for (id of item.supports; track id) { <a [href]="ctx.link('product', 'map', id)" (click)="ctx.go(ctx.link('product', 'map', id), $event)">{{ ctx.storyById().get(id)?.ref }}</a> } </p> }
          <button type="button" class="lay-link-button danger" (click)="deleteRecord(item.id)">Delete</button></section> }
        <form class="lay-card lay-form" (ngSubmit)="addResearch()"><h2>Add research</h2><label>Title<input name="rtitle" [(ngModel)]="research.title"></label><label>Notes<textarea name="rbody" rows="4" [(ngModel)]="research.body"></textarea></label>
          <label>Supports story<select name="rsupports" [(ngModel)]="research.supports"><option value="">None</option>@for (story of data().stories; track story.id) { <option [value]="story.id">{{ story.ref }} {{ story.title }}</option> }</select></label>
          <button type="submit" class="lay-button small" [disabled]="!research.title.trim()">Add</button></form>
      </div>
    }

    @case ('docs') {
      @if (selectedDoc(); as doc) {
        <p class="lay-eyebrow"><a [href]="ctx.link('product', 'docs')" (click)="ctx.go(ctx.link('product', 'docs'), $event)">Docs</a> · {{ doc.template }}</p>
        <form class="lay-card lay-form" (ngSubmit)="saveDoc(doc.id, doc.revision)">
          <label>Title<input name="title" [(ngModel)]="docDraft.title"></label><label>Document (Markdown)<textarea name="body" rows="18" [(ngModel)]="docDraft.body" class="lay-mono"></textarea></label>
          <div class="lay-row"><button type="submit" class="lay-button">Save</button><button type="button" class="lay-link-button danger" (click)="deleteRecord(doc.id, 'docs')">Delete document</button></div></form>
      } @else {
        <p class="lay-lead">Free-form documents, organised your way.</p>
        <div class="lay-grid lay-g-side"><ul class="lay-list lay-card">
          @for (doc of data().docs; track doc.id) { <li><a class="lay-item" [href]="ctx.link('product', 'docs', doc.id)" (click)="ctx.go(ctx.link('product', 'docs', doc.id), $event)"><mat-icon aria-hidden="true">description</mat-icon><span class="lay-body-text"><strong>{{ doc.title }}</strong><small>{{ doc.template }} · revision {{ doc.revision }}</small></span></a></li> }
          @empty { <li class="lay-muted lay-pad">No documents yet.</li> }</ul>
          <form class="lay-card lay-form" (ngSubmit)="createDoc()"><h2>New document</h2><label>Title<input name="dtitle" [(ngModel)]="newDoc.title"></label>
            <label>Template<select name="dtemplate" [(ngModel)]="newDoc.template">@for (name of templateNames; track name) { <option [value]="name">{{ name }}</option> }</select></label>
            <button type="submit" class="lay-button small" [disabled]="!newDoc.title.trim()">Create</button></form></div>
      }
    }

    @default {
      <div class="lay-grid lay-g2">
        @for (section of sections(); track section.id) {
          <section class="lay-card" [class.lay-wide]="section.key === 'statement'" [attr.aria-labelledby]="'vision-' + section.key">
            <div class="lay-row"><h2 [id]="'vision-' + section.key" class="lay-flat">{{ section.title }}</h2>@if (editingSection() !== section.id) { <button type="button" class="lay-link-button lay-push" (click)="editSection(section)">Edit</button> }</div>
            @if (section.key === 'principles') { <p class="lay-note">Every work item's context includes these.</p> }
            @if (editingSection() === section.id) {
              <form class="lay-form" (ngSubmit)="saveSection(section)">
                @if (section.key === 'statement') { <label>Vision<textarea name="body" rows="3" [(ngModel)]="sectionDraft.body"></textarea></label> }
                @else { <label>{{ section.title }} (one per line)<textarea name="items" rows="4" [(ngModel)]="sectionDraft.items"></textarea></label> }
                <label>Why this change<input name="rationale" [(ngModel)]="sectionDraft.rationale"></label>
                <div class="lay-row"><button type="submit" class="lay-button small">Save</button><button type="button" class="lay-link-button" (click)="editingSection.set('')">Cancel</button></div>
              </form>
            } @else if (section.key === 'statement') { <p class="lay-statement">{{ section.body || 'Not written yet.' }}</p> }
            @else if (section.items.length) { <ul>@for (item of section.items; track $index) { <li>{{ item }}</li> }</ul> }
            @else { <p class="lay-muted">{{ prompts[section.key] }}</p> }
          </section>
        }
        <section class="lay-card" aria-labelledby="vision-personas"><h2 id="vision-personas">Target users</h2>
          @for (persona of data().personas; track persona.id) { <div class="lay-persona lay-block"><span class="lay-avatar lay-avatar-product" aria-hidden="true">{{ persona.name[0] }}</span><span><strong>{{ persona.name }}{{ persona.role ? ' · ' + persona.role : '' }}</strong><small>{{ persona.note }}</small></span>
            <button type="button" class="lay-link-button lay-push" (click)="deleteRecord(persona.id)" [attr.aria-label]="'Remove ' + persona.name">Remove</button></div> }
          <form class="lay-form" (ngSubmit)="addPersona()"><label>Name<input name="pname" [(ngModel)]="persona.name" maxlength="60"></label><label>Role<input name="prole" [(ngModel)]="persona.role" maxlength="60"></label>
            <label>What they need<input name="pnote" [(ngModel)]="persona.note" maxlength="400"></label><button type="submit" class="lay-button small" [disabled]="!persona.name.trim()">Add persona</button></form>
        </section>
      </div>
    }
  }`
})
export class ProductLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly tabs = [['vision', 'Vision'], ['map', 'Story map'], ['roadmap', 'Roadmap'], ['specs', 'Specs'], ['research', 'Research'], ['docs', 'Docs']];
  readonly statusLabel = statusLabel;
  readonly stateLabel = stateLabel;
  readonly phaseName = phaseName;
  readonly statusColor: Record<string, string> = { proposed: '#c1c8d8', defined: '#8e9ad0', designed: '#d9708f', built: '#3047b9', shipped: '#146446' };
  readonly specStatuses = ['draft', 'in-review', 'accepted', 'superseded'];
  readonly specListFields: [SpecListField, string][] = [['rabbitHoles', 'Rabbit holes'], ['noGos', 'No-gos'], ['requirements', 'Requirements'], ['entities', 'Key entities'], ['success', 'Success criteria'], ['assumptions', 'Assumptions'], ['clarifications', 'Clarifications']];
  readonly templateNames = Object.keys(docTemplates);
  readonly prompts: Record<string, string> = { needs: 'Unmet needs, pains and desires, ideally backed by research.', capabilities: 'The three to five things that make it worth using.', outcomes: 'How you will know it works: behaviour or sentiment you can measure.', principles: 'Non-negotiables every spec, design and task must respect.', nogos: 'What this product deliberately does not do.' };
  readonly data = computed(() => this.ctx.data()!);
  readonly tab = computed(() => this.ctx.segments()[1] || 'vision');
  readonly selectedId = computed(() => this.tab() === 'map' ? this.ctx.segments()[2] || '' : '');
  readonly selected = computed(() => this.ctx.storyById().get(this.selectedId()) || null);
  readonly selectedSpec = computed(() => this.tab() === 'specs' ? this.data().specs.find(spec => spec.id === this.ctx.segments()[2]) || null : null);
  readonly selectedDoc = computed(() => this.tab() === 'docs' ? this.data().docs.find(doc => doc.id === this.ctx.segments()[2]) || null : null);
  readonly currentPhase = computed(() => this.data().phases.find(phase => phase.current)?.key || 'demo');
  readonly sections = computed(() => ['statement', 'needs', 'capabilities', 'outcomes', 'principles', 'nogos'].map(key => this.data().vision[key]).filter(Boolean));
  readonly columns = computed(() => this.data().activities.flatMap(activity => activity.steps.map(step => ({ activity, step }))));
  readonly adding = signal('');
  readonly editingSection = signal('');
  readonly editingPhase = signal('');
  private draftFor = '';
  private specDraftFor = '';
  private docDraftFor = '';
  newStory = ''; newActivity = ''; newSpec = '';
  draft = { title: '', phase: 'demo', why: '', acceptance: [] as Scenario[], edges: '', clarifications: '', rationale: '' };
  sectionDraft = { body: '', items: '', rationale: '' };
  phaseDraft = { goal: '', appetite: '', exit: '' };
  persona = { name: '', role: '', note: '' };
  research = { title: '', body: '', supports: '' };
  newDoc = { title: '', template: 'Blank' };
  docDraft = { title: '', body: '' };
  specDraft: SpecDraft = emptySpecDraft();

  constructor() {
    // Drafts load when a record opens, never while someone is typing into them.
    queueMicrotask(() => this.syncDrafts());
  }

  ngDoCheck() { this.syncDrafts(); }

  private syncDrafts() {
    const story = this.selected();
    if (story && `${story.id}:${story.revision}` !== this.draftFor) {
      this.draftFor = `${story.id}:${story.revision}`;
      this.draft = { title: story.title, phase: story.phase, why: story.why, acceptance: story.acceptance.map(item => ({ ...item })), edges: story.edges.join('\n'), clarifications: story.clarifications.join('\n'), rationale: '' };
    }
    const spec = this.selectedSpec();
    if (spec && `${spec.id}:${spec.revision}` !== this.specDraftFor) {
      this.specDraftFor = `${spec.id}:${spec.revision}`;
      this.specDraft = { title: spec.title, status: spec.status, phase: spec.phase, stories: [...spec.stories], problem: spec.problem, appetite: spec.appetite, solution: spec.solution,
        rabbitHoles: spec.rabbitHoles.join('\n'), noGos: spec.noGos.join('\n'), requirements: spec.requirements.join('\n'), entities: spec.entities.join('\n'), success: spec.success.join('\n'), assumptions: spec.assumptions.join('\n'), clarifications: spec.clarifications.join('\n'), rationale: '' };
    }
    const doc = this.selectedDoc();
    if (doc && `${doc.id}:${doc.revision}` !== this.docDraftFor) { this.docDraftFor = `${doc.id}:${doc.revision}`; this.docDraft = { title: doc.title, body: doc.body }; }
  }

  activityColumn(index: number) {
    const before = this.data().activities.slice(0, index).reduce((sum, activity) => sum + Math.max(1, activity.steps.length), 0);
    return `${before + 1} / span ${Math.max(1, this.data().activities[index].steps.length)}`;
  }
  storiesIn(stepId: string, phase: string) { const step = this.columns().find(column => column.step.id === stepId)?.step; return (step?.stories || []).map(id => this.ctx.storyById().get(id)!).filter(story => story && story.phase === phase); }
  storiesInPhase(phase: string) { return this.data().stories.filter(story => story.phase === phase); }
  locate(story: Story) { const column = this.columns().find(item => item.step.id === story.parentId); return column ? `${column.activity.title} › ${column.step.title}` : 'Story'; }
  specsFor(story: Story) { return this.data().specs.filter(spec => spec.stories.includes(story.id)); }
  workFor(story: Story) { return this.data().work.filter(item => item.targets.some(target => target.id === story.id)); }

  addActivity() {
    const title = this.newActivity.trim(); if (!title) return;
    void this.ctx.write(async () => { const activity = await this.ctx.record('activity', { title, persona: '' }) as Activity; await this.ctx.record('step', { title: 'First step' }, activity.id); this.newActivity = ''; }, `Added “${title}”. Rename its first step on the map.`);
  }
  addStep(activity: Activity) {
    void this.ctx.write(() => this.ctx.record('step', { title: `Step ${activity.steps.length + 1}` }, activity.id), 'Step added.');
  }
  addStory(stepId: string, phase: string) {
    const title = this.newStory.trim(); if (!title) return;
    void this.ctx.write(async () => { await this.ctx.record('story', { title, phase }, stepId); this.adding.set(''); this.newStory = ''; }, 'Story added.');
  }
  saveStory(story: Story) {
    const data = { title: this.draft.title, phase: this.draft.phase, why: this.draft.why, acceptance: this.draft.acceptance, edges: lines(this.draft.edges), clarifications: lines(this.draft.clarifications) };
    void this.ctx.write(() => this.ctx.change(story.id, data, story.revision, this.draft.rationale), 'Story saved.');
  }
  deleteStory(story: Story) {
    void this.ctx.write(async () => { await this.ctx.delete(story.id); this.ctx.go(this.ctx.link('product', 'map')); }, 'Story deleted.');
  }
  editSection(section: VisionSection) { this.editingSection.set(section.id); this.sectionDraft = { body: section.body, items: section.items.join('\n'), rationale: '' }; }
  saveSection(section: VisionSection) {
    void this.ctx.write(async () => { await this.ctx.change(section.id, { body: this.sectionDraft.body, items: lines(this.sectionDraft.items) }, section.revision, this.sectionDraft.rationale); this.editingSection.set(''); }, `${section.title} saved.`);
  }
  addPersona() {
    void this.ctx.write(async () => { await this.ctx.record('persona', { ...this.persona }); this.persona = { name: '', role: '', note: '' }; }, 'Persona added.');
  }
  editPhase(phase: { id: string; goal: string; appetite: string; exit: string }) { this.editingPhase.set(phase.id); this.phaseDraft = { goal: phase.goal, appetite: phase.appetite, exit: phase.exit }; }
  savePhase(id: string, revision: number) {
    void this.ctx.write(async () => { await this.ctx.change(id, { ...this.phaseDraft }, revision); this.editingPhase.set(''); }, 'Phase saved.');
  }
  createSpec() {
    const title = this.newSpec.trim(); if (!title) return;
    void this.ctx.write(async () => { const spec = await this.ctx.record('spec', { title, phase: this.currentPhase() }) as Spec; this.newSpec = ''; this.ctx.go(this.ctx.link('product', 'specs', spec.id)); }, 'Spec created. Add its stories and fill in the pitch.');
  }
  toggleSpecStory(id: string) { this.specDraft.stories = this.specDraft.stories.includes(id) ? this.specDraft.stories.filter(item => item !== id) : [...this.specDraft.stories, id]; }
  saveSpec(spec: Spec) {
    const draft = this.specDraft;
    const data = { title: draft.title, status: draft.status, phase: draft.phase, stories: draft.stories, problem: draft.problem, appetite: draft.appetite, solution: draft.solution,
      rabbitHoles: lines(draft.rabbitHoles), noGos: lines(draft.noGos), requirements: lines(draft.requirements), entities: lines(draft.entities), success: lines(draft.success), assumptions: lines(draft.assumptions), clarifications: lines(draft.clarifications) };
    void this.ctx.write(() => this.ctx.change(spec.id, data, spec.revision, draft.rationale), 'Spec saved.');
  }
  addResearch() {
    void this.ctx.write(async () => { await this.ctx.record('research', { title: this.research.title, body: this.research.body, supports: this.research.supports ? [this.research.supports] : [] }); this.research = { title: '', body: '', supports: '' }; }, 'Research added.');
  }
  createDoc() {
    void this.ctx.write(async () => { const doc = await this.ctx.record('doc', { title: this.newDoc.title, template: this.newDoc.template, body: docTemplates[this.newDoc.template] || '' }) as { id: string }; this.newDoc = { title: '', template: 'Blank' }; this.ctx.go(this.ctx.link('product', 'docs', doc.id)); }, 'Document created.');
  }
  saveDoc(id: string, revision: number) { void this.ctx.write(() => this.ctx.change(id, { ...this.docDraft }, revision), 'Document saved.'); }
  deleteRecord(id: string, backTo = '') {
    void this.ctx.write(async () => { await this.ctx.delete(id); if (backTo) this.ctx.go(this.ctx.link('product', backTo)); }, 'Deleted.');
  }
}

type SpecListField = 'rabbitHoles' | 'noGos' | 'requirements' | 'entities' | 'success' | 'assumptions' | 'clarifications';
type SpecDraft = { title: string; status: string; phase: string; stories: string[]; problem: string; appetite: string; solution: string; rationale: string } & Record<SpecListField, string>;
function emptySpecDraft(): SpecDraft { return { title: '', status: 'draft', phase: 'demo', stories: [], problem: '', appetite: '', solution: '', rabbitHoles: '', noGos: '', requirements: '', entities: '', success: '', assumptions: '', clarifications: '', rationale: '' }; }
