import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PageBlocksComponent } from '../page-blocks';
import { readableAccent } from '../color';
import { Page, ProjectContext, statusLabel } from './context';
import { BuiltByComponent } from './built-by';

// Pages: where the product happens (knowledge-structures.md › Pages). The canvas uses the same
// page-blocks the generated app renders, so a skeleton page here is the skeleton page there.
@Component({
  selector: 'aludel-pages-layer', standalone: true,
  imports: [FormsModule, MatIconModule, PageBlocksComponent, BuiltByComponent],
  template: `
  <p class="lay-eyebrow">Pages · where the product happens</p>
  <h1 tabindex="-1">{{ ctx.setup()?.project?.name }}'s pages</h1>
  <nav class="lay-tabs" aria-label="Pages sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('pages', entry[0])" (click)="ctx.go(ctx.link('pages', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }
  </nav>
  @if (tab() === 'flows') {
    <p class="lay-lead">One flow per story-map activity: the pages someone moves through to do it.</p>
    @for (flow of flows(); track flow.title) {
      <section class="lay-card lay-flow-card"><h2>{{ flow.title }}</h2>
        @if (flow.pages.length) { <div class="lay-flow">@for (page of flow.pages; track page.id; let first = $first) { @if (!first) { <mat-icon aria-hidden="true">arrow_forward</mat-icon> }<a [href]="ctx.link('pages', 'tree', page.id)" (click)="ctx.go(ctx.link('pages', 'tree', page.id), $event)">{{ page.label }}</a> }</div> }
        @else { <p class="lay-muted">No page realises these stories yet.</p> }</section>
    } @empty { <p class="lay-muted">Add activities to the story map to see flows.</p> }
  } @else {
    <div class="lay-pages-grid">
      <nav class="lay-card lay-tree-card" aria-label="Page tree">
        <ul class="lay-tree">
          @for (page of topPages(); track page.id) {
            <li><a [href]="ctx.link('pages', 'tree', page.id)" (click)="ctx.go(ctx.link('pages', 'tree', page.id), $event)" [class.active]="page.id === selected()?.id" [attr.aria-current]="page.id === selected()?.id ? 'page' : null"><mat-icon aria-hidden="true">{{ page.icon }}</mat-icon>{{ page.label }}@if (!page.inNav) { <small>not in nav</small> }</a>
              @if (children(page.id).length) { <ul>@for (child of children(page.id); track child.id) { <li><a [href]="ctx.link('pages', 'tree', child.id)" (click)="ctx.go(ctx.link('pages', 'tree', child.id), $event)" [class.active]="child.id === selected()?.id"><mat-icon aria-hidden="true">{{ child.icon }}</mat-icon>{{ child.label }}</a></li> }</ul> }
            </li>
          }
        </ul>
        <a class="lay-button ghost small" [href]="navEditorHref()">Edit navigation</a>
      </nav>
      @if (selected(); as page) {
        <section class="lay-page-main" [attr.aria-labelledby]="'page-' + page.id">
          <div class="lay-row"><h2 [id]="'page-' + page.id" class="lay-flat lay-page-title">{{ page.label }}</h2><span class="lay-chip lay-l-pages">{{ typeLabel(page.pageType) }}</span><span class="lay-chip lay-plain">{{ pageStatus(page.status) }}</span></div>
          <p class="lay-muted small">Origin: {{ page.origin }}</p>
          <div class="lay-canvas" [style]="canvasStyle()"><div class="lay-canvas-app"><h3>{{ page.label }}</h3><p>{{ page.description || 'Describe what happens on this page.' }}</p><page-blocks [blocks]="blocks(page.pageType)" [compact]="narrow()"></page-blocks></div></div>
        </section>
        <aside class="lay-card lay-connected lay-page-aside" aria-label="About this page">
          <form class="lay-form" (ngSubmit)="save(page)">
            <label>Description<textarea name="description" rows="3" [(ngModel)]="draft.description"></textarea></label>
            <label>Page type<select name="pageType" [(ngModel)]="draft.pageType">@for (type of types(); track type.id) { <option [value]="type.id">{{ type.label }}</option> }</select></label>
            <label>Notes and references<textarea name="notes" rows="3" [(ngModel)]="draft.notes"></textarea></label>
            <label>Why this change<input name="rationale" [(ngModel)]="draft.rationale"></label>
            <div class="lay-row"><button type="submit" class="lay-button small">Save page</button>
              @if (page.status !== 'designed') { <button type="button" class="lay-link-button" (click)="markDesigned(page)">Mark as designed</button> }</div>
          </form>
          <h3>Stories it realises</h3>
          @for (id of page.stories; track id) { <div class="lay-row"><a [href]="ctx.link('product', 'map', id)" (click)="ctx.go(ctx.link('product', 'map', id), $event)">{{ ctx.storyById().get(id)?.ref }} {{ ctx.storyById().get(id)?.title }}</a><span class="lay-chip lay-plain">{{ statusLabel[ctx.storyById().get(id)?.status || 'proposed'] }}</span>
            <button type="button" class="lay-link-button lay-push" (click)="unlink(page, id)" [attr.aria-label]="'Unlink ' + ctx.storyById().get(id)?.title">Unlink</button></div> }
          @empty { <p class="lay-muted">None linked.</p> }
          <label class="lay-inline-form">Link a story<select #pick (change)="link(page, pick.value); pick.value = ''"><option value="">Choose…</option>@for (story of unlinked(page); track story.id) { <option [value]="story.id">{{ story.ref }} {{ story.title }}</option> }</select></label>
          <h3>Built by</h3>
          <aludel-built-by [recordId]="page.id" />
          <h3>Why it is this way</h3>
          @if (page.history.length) { <div class="lay-history">@for (entry of page.history; track entry.revision) { <p>{{ entry.rationale }}<br><small>Revision {{ entry.revision }} · {{ entry.author }} · {{ entry.createdAt.slice(0, 10) }}</small></p> }</div> }
          @else { <p class="lay-muted">No recorded decisions yet.</p> }
        </aside>
      } @else { <p class="lay-muted">No pages yet. <a [href]="navEditorHref()">Shape the navigation</a>.</p> }
    </div>
  }`
})
export class PagesLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly tabs = [['tree', 'Page tree'], ['flows', 'Flows']];
  readonly statusLabel = statusLabel;
  // Phone-width screens show the page as the phone layout, as the generated app does.
  private readonly narrowQuery = typeof matchMedia === 'function' ? matchMedia('(max-width: 900px)') : null;
  readonly narrow = signal(this.narrowQuery?.matches ?? false);
  constructor() { this.narrowQuery?.addEventListener('change', event => this.narrow.set(event.matches)); }
  readonly tab = computed(() => this.ctx.segments()[1] || 'tree');
  readonly pages = computed(() => this.ctx.data()?.pages || []);
  readonly topPages = computed(() => this.pages().filter(page => !page.parentId).sort((a, b) => Number(b.inNav) - Number(a.inNav) || a.position - b.position));
  readonly selected = computed(() => this.pages().find(page => page.id === this.ctx.segments()[2]) || this.topPages()[0] || null);
  readonly types = computed(() => Object.entries(this.ctx.catalog()?.pageTypes || {}).map(([id, value]) => ({ id, label: value.label })));
  readonly flows = computed(() => (this.ctx.data()?.activities || []).map(activity => {
    const storyIds = new Set(activity.steps.flatMap(step => step.stories));
    return { title: activity.title, pages: this.topPages().concat(this.pages().filter(page => page.parentId)).filter(page => page.stories.some(id => storyIds.has(id))) };
  }));
  private draftFor = '';
  draft = { description: '', pageType: 'list', notes: '', rationale: '' };

  ngDoCheck() {
    const page = this.selected();
    if (page && `${page.id}:${page.revision}` !== this.draftFor) { this.draftFor = `${page.id}:${page.revision}`; this.draft = { description: page.description, pageType: page.pageType, notes: page.notes, rationale: '' }; }
  }

  children(id: string) { return this.pages().filter(page => page.parentId === id); }
  typeLabel(id: string) { return this.ctx.catalog()?.pageTypes[id]?.label || id; }
  blocks(id: string) { return this.ctx.catalog()?.pageTypes[id]?.blocks || []; }
  pageStatus(status: string) { return ({ planned: 'Planned', skeleton: 'Skeleton built', designed: 'Designed' } as Record<string, string>)[status] || status; }
  unlinked(page: Page) { return (this.ctx.data()?.stories || []).filter(story => !page.stories.includes(story.id)); }
  navEditorHref() { return `/start/${encodeURIComponent(this.ctx.projectId())}/pages`; }
  canvasStyle() {
    const setup = this.ctx.setup(); const feel = setup?.design?.feel ? this.ctx.catalog()?.feels[setup.design.feel] : null;
    const surface = feel?.surface || '#ffffff';
    return { '--blk-accent': readableAccent(setup?.design?.accent || '#3047b9', surface), '--blk-radius': `${Math.min(feel?.radius ?? 12, 20)}px`, background: surface, 'font-family': feel?.font || 'Roboto, sans-serif' } as Record<string, string>;
  }
  save(page: Page) {
    void this.ctx.write(() => this.ctx.change(page.id, { description: this.draft.description, pageType: this.draft.pageType, notes: this.draft.notes }, page.revision, this.draft.rationale), 'Page saved.');
  }
  markDesigned(page: Page) {
    void this.ctx.write(() => this.ctx.change(page.id, { status: 'designed' }, page.revision, this.draft.rationale || 'Design accepted'), `${page.label} is designed. Its stories count as designed.`);
  }
  link(page: Page, storyId: string) {
    if (!storyId) return;
    void this.ctx.write(() => this.ctx.change(page.id, { stories: [...page.stories, storyId] }, page.revision, `Now realises ${this.ctx.storyById().get(storyId)?.ref}`), 'Story linked.');
  }
  unlink(page: Page, storyId: string) {
    void this.ctx.write(() => this.ctx.change(page.id, { stories: page.stories.filter(id => id !== storyId) }, page.revision, `No longer realises ${this.ctx.storyById().get(storyId)?.ref}`), 'Story unlinked.');
  }
}
