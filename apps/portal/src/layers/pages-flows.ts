import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Flow, FlowNote, FlowStep, ProjectContext } from './context';
import { PagePreviewComponent } from './pages-preview';
import { PageRenderComponent } from './pages-render';
import { Build, PagesState, buildLabel, buildOf } from './pages-model';

const noteLabel: Record<FlowNote['type'], string> = { 'looks-right': 'Looks right', content: 'Content fix', change: 'Change request', question: 'Question' };

// Pages › Flows (PAGES-UX-01, M11): walk through one flow a step at a time with the page in the middle, its story's acceptance
// beside it, and review notes. Reviewing is Experience designer work; its notes route to content fixes, change requests
// (Engineer work) or questions for the Product lead.
@Component({
  selector: 'aludel-pages-flows', standalone: true,
  imports: [FormsModule, MatIconModule, PagePreviewComponent, PageRenderComponent],
  template: `
  @if (flow(); as f) {
  <div class="lay-pg-fl">
    <aside class="lay-pg-fsteps" aria-label="Flow steps">
      <label class="lay-pg-flowpick">Flow<select [ngModel]="f.id" (ngModelChange)="pick($event)" name="flow">@for (entry of flows(); track entry.id) { <option [value]="entry.id">{{ entry.title }}</option> }</select></label>
      <div class="lay-row lay-wrap"><span class="lay-chip lay-plain"><mat-icon aria-hidden="true">person</mat-icon>{{ state.asName(f.persona) }}</span><span [class]="'lay-chip ' + reviewClass(f)">{{ reviewLabel(f) }}</span></div>
      @if (f.review.state === 'progress') { <button type="button" class="lay-button small" (click)="finish(f)"><mat-icon aria-hidden="true">done_all</mat-icon>Finish review</button> }
      @else { <button type="button" class="lay-button small" [class.ghost]="f.review.state === 'done'" (click)="start(f)" [disabled]="!f.steps.length"><mat-icon aria-hidden="true">rate_review</mat-icon>{{ f.review.state === 'done' ? 'Review again' : 'Review this flow' }}</button> }
      <ol class="lay-pg-fsl">
        @for (s of f.steps; track $index; let i = $index) {
          @if (i) { <li class="lay-pg-fsc"><mat-icon aria-hidden="true">south</mat-icon>{{ trigger(f, i - 1) }}</li> }
          <li><button type="button" class="lay-pg-fsi" [class.lay-pg-on]="i === index()" [class.lay-pg-gapstep]="!s.page" (click)="index.set(i)" [attr.aria-current]="i === index() ? 'step' : null">
            <span class="lay-pg-n">{{ i + 1 }}</span>
            @if (s.page && ctx.pageById().get(s.page); as page) { <span class="lay-pg-mini" inert><span class="lay-pg-tapp"><aludel-page-render [page]="page" [viewer]="s.persona || 'visitor'" [phone]="true" [bare]="true" /></span></span> }
            @else { <span class="lay-pg-mini lay-pg-gapm"><mat-icon aria-hidden="true">warning</mat-icon></span> }
            <span><strong>{{ s.name || (s.page ? ctx.pageById().get(s.page)?.label : 'Missing page') }}</strong><small>{{ s.page ? ctx.pageById().get(s.page)?.label : 'No page yet' }}{{ s.story ? ' · ' + ctx.storyById().get(s.story)?.ref : '' }}</small><small>As {{ state.asName(s.persona) }}</small></span>
            @if (notesAt(f, i).length) { <span class="lay-chip lay-l-work lay-pg-rvn">{{ notesAt(f, i).length }}</span> }
          </button></li>
        }
      </ol>
      @if (!f.steps.length) { <p class="lay-muted small">No steps yet.</p> }
      <a class="lay-button ghost small" [href]="ctx.link('pages', 'map')" (click)="editOnMap(f, $event)"><mat-icon aria-hidden="true">account_tree</mat-icon>Edit this flow on the Map</a>
    </aside>

    <section class="lay-pg-fprev" aria-label="Step preview">
      <div class="lay-pg-cbar">
        <strong>{{ step() ? 'Step ' + (index() + 1) + ' of ' + f.steps.length + ' · ' + (step()!.name || 'Step') : f.title }}</strong>
        @if (page(); as p) { <span [class]="'lay-chip lay-pg-c-' + build(p.id)">{{ buildLabel[build(p.id)] }}</span> }
        <span class="lay-push"></span>
        @if (page() && build(page()!.id) === 'built') { <div class="lay-pg-seg" role="group" aria-label="Show"><button type="button" [attr.aria-pressed]="mode() === 'spec'" (click)="mode.set('spec')">Spec</button><button type="button" [attr.aria-pressed]="mode() === 'built'" (click)="mode.set('built')">Built</button></div> }
        <div class="lay-pg-seg" role="group" aria-label="Width"><button type="button" [attr.aria-pressed]="phone()" (click)="phone.set(true)" aria-label="Phone"><mat-icon aria-hidden="true">mobile</mat-icon></button><button type="button" [attr.aria-pressed]="!phone()" (click)="phone.set(false)" aria-label="Desktop"><mat-icon aria-hidden="true">desktop_windows</mat-icon></button></div>
        <button type="button" class="lay-button ghost small" (click)="index.set(index() - 1)" [disabled]="index() === 0"><mat-icon aria-hidden="true">chevron_left</mat-icon>Back</button>
        <button type="button" class="lay-button ghost small" (click)="index.set(index() + 1)" [disabled]="index() >= f.steps.length - 1">Next<mat-icon aria-hidden="true">chevron_right</mat-icon></button>
      </div>
      @if (page(); as p) {
        <aludel-page-preview [page]="p" [mode]="build(p.id) === 'built' ? mode() : 'spec'" [viewer]="step()!.persona || 'visitor'" [phone]="phone()" />
      } @else {
        <div class="lay-pg-unspec lay-pg-center-note"><mat-icon aria-hidden="true">{{ step() ? 'warning' : 'route' }}</mat-icon><strong>{{ step() ? (step()!.name || 'This step') + ': no page' : 'No steps yet' }}</strong>
          <span>{{ step()?.why || 'Add page blanks for its stories on the Map, then link them in order.' }}</span>
          <a class="lay-button ghost small" [href]="ctx.link('pages', 'map')" (click)="editOnMap(f, $event)"><mat-icon aria-hidden="true">add_box</mat-icon>Plan it on the Map</a></div>
      }
    </section>

    <aside class="lay-pg-fside" aria-label="Acceptance and review">
      @if (page(); as p) { <a class="lay-pg-ref" [href]="ctx.link('pages', 'page', p.id)" (click)="ctx.go(ctx.link('pages', 'page', p.id), $event)"><mat-icon aria-hidden="true">{{ p.icon }}</mat-icon>Open {{ p.label }}</a> }
      <h3>Acceptance</h3>
      @if (story(); as s) {
        <p class="small"><b>{{ s.ref }}</b> {{ s.title }}</p>
        @for (scenario of s.acceptance; track $index) { <div class="lay-pg-gwt"><span><b>Given</b>{{ scenario.given }}</span><span><b>When</b>{{ scenario.when }}</span><span><b>Then</b>{{ scenario.then }}</span></div> }
        @empty { <p class="lay-muted small">{{ s.ref }} has no acceptance yet.</p> }
      } @else { <p class="lay-muted small">No story on this step.</p> }
      @if (step() && trigger(f, index())) { <div class="lay-pg-trig"><mat-icon aria-hidden="true">touch_app</mat-icon>Next: {{ trigger(f, index()) }}</div> }
      <h3>Review notes</h3>
      @for (note of notesAt(f, index()); track $index) { <div class="lay-pg-note"><span class="lay-row"><span [class]="'lay-chip lay-pg-n-' + note.type">{{ noteLabel[note.type] }}</span>@if (note.link) { <small class="lay-muted">{{ note.link }}</small> }</span><span>{{ note.text }}</span></div> }
      @if (f.review.state === 'progress' && step()) {
        <form class="lay-pg-note" (ngSubmit)="addNote(f)">
          <div class="lay-pg-ntype" role="group" aria-label="Kind of note">@for (type of types; track type) { <button type="button" [attr.aria-pressed]="noteType() === type" (click)="noteType.set(type)">{{ noteLabel[type] }}</button> }</div>
          <textarea name="note" rows="2" [(ngModel)]="noteText" placeholder="What did you notice at this step?" aria-label="Note"></textarea>
          <div class="lay-row"><button type="submit" class="lay-button small" [disabled]="!noteText.trim()">Add note</button><span class="lay-muted small">{{ hint[noteType()] }}</span></div>
        </form>
      } @else if (!notesAt(f, index()).length) { <p class="lay-muted small">{{ f.review.state === 'done' ? 'No notes on this step.' : 'Start a review to add notes.' }}</p> }
    </aside>
  </div>
  } @else { <p class="lay-muted">No flows yet. They come from the story map’s activities, or start one on the Map.</p> }`
})
export class PagesFlowsComponent {
  readonly ctx = inject(ProjectContext);
  readonly state = inject(PagesState);
  readonly buildLabel = buildLabel;
  readonly noteLabel = noteLabel;
  readonly types: FlowNote['type'][] = ['looks-right', 'content', 'change', 'question'];
  readonly hint: Record<FlowNote['type'], string> = { 'looks-right': '', content: 'Opens the page with Edit content on.', change: 'Opens a change request for the Engineer.', question: 'Asks the Product lead in Work.' };
  readonly flows = computed(() => this.ctx.data()?.flows || []);
  readonly flow = computed(() => { const id = this.ctx.segments()[2]; return this.flows().find(flow => flow.id === id) || this.flows()[0] || null; });
  // The step being looked at; a different flow starts at its first step.
  readonly index = signal(0);
  private seenFlow: string | undefined;
  constructor() { effect(() => { const id = this.flow()?.id; untracked(() => { if (id !== this.seenFlow) { this.seenFlow = id; this.index.set(0); } }); }); }
  readonly step = computed<FlowStep | null>(() => { const flow = this.flow(); return flow?.steps[Math.min(this.index(), flow.steps.length - 1)] || null; });
  readonly page = computed(() => { const step = this.step(); return step?.page ? this.ctx.pageById().get(step.page) || null : null; });
  readonly story = computed(() => { const step = this.step(); return step?.story ? this.ctx.storyById().get(step.story) || null : null; });
  readonly mode = signal<'spec' | 'built'>('built');
  readonly phone = signal(true);
  readonly noteType = signal<FlowNote['type']>('looks-right');
  noteText = '';

  build(pageId: string): Build { const page = this.ctx.pageById().get(pageId); return page ? buildOf(this.ctx, page) : 'planned'; }
  pick(id: string) { this.ctx.go(this.ctx.link('pages', 'flows', id)); }
  notesAt(flow: Flow, index: number) { return flow.review.notes.filter(note => note.step === index); }
  trigger(flow: Flow, index: number) {
    const a = flow.steps[index], b = flow.steps[index + 1]; if (!a || !b) return '';
    if (a.page && b.page && a.page !== b.page) return this.ctx.pageById().get(a.page)?.links.find(link => link.to === b.page)?.label || a.trigger || 'No link yet';
    return a.trigger || (a.page && a.page === b.page ? 'On the same page' : '');
  }
  reviewLabel(flow: Flow) { return flow.review.state === 'progress' ? 'In review' : flow.review.state === 'done' ? `Reviewed · ${flow.review.verdict?.toLowerCase()}` : 'Not reviewed'; }
  reviewClass(flow: Flow) { return flow.review.state === 'progress' ? 'lay-l-work' : flow.review.state === 'done' ? (flow.review.verdict === 'Works' ? 'lay-pg-c-built' : 'lay-pg-c-warn') : 'lay-plain'; }
  editOnMap(flow: Flow, event: Event) { this.state.mapFlow.set(flow.id); this.ctx.go(this.ctx.link('pages', 'map'), event); }
  private review(flow: Flow, action: 'start' | 'finish') { return this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/pages/review`, 'POST', { flowId: flow.id, action }); }
  start(flow: Flow) { void this.ctx.write(() => this.review(flow, 'start'), `Reviewing ${flow.title}. The review is in Work for you as the Experience designer.`); }
  finish(flow: Flow) { void this.ctx.write(() => this.review(flow, 'finish'), `${flow.title} reviewed.`); }
  async addNote(flow: Flow) {
    const text = this.noteText.trim(), type = this.noteType(), index = this.index(), step = this.step(); if (!text || !step) return;
    const page = this.page();
    const link = type === 'change' ? 'Change request opened' : type === 'content' ? 'Opened in Edit content' : type === 'question' ? 'Asked the Product lead' : '';
    const ok = await this.ctx.write(async () => {
      await this.ctx.change(flow.id, { review: { ...flow.review, notes: [...flow.review.notes, { step: index, type, text, link, at: new Date().toISOString() }] } }, flow.revision, `Review note: ${noteLabel[type].toLowerCase()}`);
      if (type === 'question') await this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work`, 'POST', { action: 'product.clarify', title: `Question from the ${flow.title} review: ${text.slice(0, 100)}`, state: 'ready',
        question: { text: text.slice(0, 400), options: [] }, targets: [...(step.story ? [{ id: step.story, label: this.ctx.storyById().get(step.story)?.ref || 'Story' }] : []), ...(page ? [{ id: page.id, label: `${page.label} page` }] : [])] });
    });
    if (!ok) return;
    this.noteText = '';
    if (page && type === 'content') { this.state.intent.set({ page: page.id, edit: true }); this.ctx.go(this.ctx.link('pages', 'page', page.id)); }
    if (page && type === 'change') { this.state.intent.set({ page: page.id, change: { title: `${page.label}: ${text.slice(0, 80)}`, why: `${text} (from the ${flow.title} flow review, step ${index + 1})` } }); this.ctx.go(this.ctx.link('pages', 'page', page.id)); }
  }
}
