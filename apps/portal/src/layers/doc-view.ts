import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Doc, ProjectContext, layerLabel } from './context';
import { markdownBlocks } from './product';
import { RefChipComponent } from './work-shared';

const docLayers = ['product', 'design', 'pages', 'data', 'platform', 'work'];

// DESIGN-UX-01 (D19): documents live in the Library; each shows in the layers it lists. The Library lists all of them,
// and a layer's Docs tab lists the ones that show there. Both open the same view.
@Component({
  selector: 'aludel-docs', standalone: true,
  imports: [NgTemplateOutlet, FormsModule, MatIconModule, RefChipComponent],
  template: `
  @if (selected(); as doc) {
    <p class="lay-eyebrow"><a [href]="to()" (click)="ctx.go(to(), $event)">{{ layer() === 'library' ? 'Documents' : 'Docs' }}</a> · {{ doc.form === 'generated' ? 'Generated' : 'Written' }}</p>
    <div class="lay-row lay-wrap lay-doc-head"><h2 class="lay-flat">{{ doc.title }}</h2>
      <label class="lay-switch lay-push"><input type="checkbox" [checked]="doc.agents" (change)="toggleAgents(doc, $any($event.target).checked)">Agents read this</label>
      @if (doc.form !== 'generated') { <button type="button" class="lay-button ghost small" (click)="editing.set(!editing())"><mat-icon aria-hidden="true">{{ editing() ? 'visibility' : 'edit' }}</mat-icon>{{ editing() ? 'Preview' : 'Edit' }}</button> }</div>
    <div class="lay-row lay-wrap lay-ds-shows" role="group" aria-label="Shows in"><span class="lay-muted small">Shows in</span>
      @for (key of layers; track key) { <button type="button" class="lay-ds-showbtn" [attr.aria-pressed]="doc.showsIn.includes(key)" (click)="toggleLayer(doc, key)">{{ layerLabel[key] }}</button> }
      <span class="lay-muted small">· always in the Library</span></div>
    @if (editing() && doc.form !== 'generated') {
      <form class="lay-card lay-form" (ngSubmit)="save(doc)"><label>Title<input name="title" [(ngModel)]="draft.title"></label>
        <label>Document (Markdown; mention a record with [[its id]])<textarea name="body" rows="18" [(ngModel)]="draft.body" class="lay-mono"></textarea></label>
        <div class="lay-row"><button type="submit" class="lay-button">Save</button><button type="button" class="lay-link-button danger" (click)="remove(doc)">Delete document</button></div></form>
    } @else {
      <article class="lay-card lay-docbody">
        @for (block of blocks(); track $index) {
          @switch (block.tag) {
            @case ('h1') { <h2 class="lay-doc-h1"><ng-container *ngTemplateOutlet="parts; context: { $implicit: block.parts }" /></h2> }
            @case ('h2') { <h3 class="lay-doc-h2"><ng-container *ngTemplateOutlet="parts; context: { $implicit: block.parts }" /></h3> }
            @case ('ul') { <ul>@for (item of block.items; track $index) { <li><ng-container *ngTemplateOutlet="parts; context: { $implicit: item }" /></li> }</ul> }
            @default { <p><ng-container *ngTemplateOutlet="parts; context: { $implicit: block.parts }" /></p> }
          }
        } @empty { <p class="lay-muted">Empty. Edit it to write.</p> }
        @if (doc.form === 'generated') { <p class="lay-muted small">Generated from the Brief. Regenerate it in <a [href]="ctx.link('product', 'docs', doc.id)" (click)="ctx.go(ctx.link('product', 'docs', doc.id), $event)">Vision › Documents</a>.</p> }
      </article>
    }
  } @else {
    <div class="lay-callout lay-ds-docnote"><mat-icon aria-hidden="true">local_library</mat-icon><span>{{ layer() === 'library' ? 'Every document. Each one also shows in the layers it lists.' : 'Documents live in the Library. These are the ones set to show in ' + layerLabel[layer()] + '. Documents agents read go to every agent working here.' }}</span></div>
    <div class="lay-doclist">
      @for (doc of docs(); track doc.id) {
        <a class="lay-docrow" [href]="to(doc.id)" (click)="ctx.go(to(doc.id), $event)"><span class="lay-docicon"><mat-icon aria-hidden="true">{{ doc.form === 'generated' ? 'auto_awesome' : 'description' }}</mat-icon></span>
          <span class="lay-body-text"><strong>{{ doc.title }}</strong><small>Shows in {{ shows(doc) }} · revision {{ doc.revision }}{{ doc.agents ? ' · agents read this' : '' }}</small></span></a>
      } @empty { <p class="lay-muted">No documents{{ layer() === 'library' ? '' : ' show here yet' }}.</p> }
    </div>
    <form class="lay-row lay-add-activity lay-gap-top" (ngSubmit)="create()"><label class="visually-hidden" [for]="'new-doc-' + layer()">New document title</label><input [id]="'new-doc-' + layer()" name="newDoc" [(ngModel)]="newTitle" placeholder="New document, e.g. “Voice and tone”" maxlength="120">
      <button type="submit" class="lay-button ghost small" [disabled]="!newTitle.trim()"><mat-icon aria-hidden="true">add</mat-icon>Write a document</button></form>
  }
  <ng-template #parts let-parts>@for (part of parts; track $index) { @if (part.ref) { <aludel-ref [id]="part.ref" [short]="true" /> } @else if (part.strong) { <strong>{{ part.text }}</strong> } @else if (part.em) { <em>{{ part.text }}</em> } @else { {{ part.text }} } }</ng-template>`
})
export class DocsComponent {
  readonly ctx = inject(ProjectContext);
  readonly layer = input.required<string>();
  readonly base = input.required<string[]>();
  readonly layers = docLayers; readonly layerLabel = layerLabel;
  readonly editing = signal(false);
  draft = { title: '', body: '' };
  newTitle = '';
  private draftFor = '';
  readonly docs = computed(() => (this.ctx.data()?.docs || []).filter(doc => this.layer() === 'library' || (doc.showsIn || ['product']).includes(this.layer())));
  readonly selected = computed(() => { const id = this.ctx.segments()[this.base().length]; return id ? (this.ctx.data()?.docs || []).find(doc => doc.id === id) || null : null; });
  readonly blocks = computed(() => markdownBlocks(this.selected()?.body || ''));
  constructor() {
    effect(() => { const doc = this.selected(); untracked(() => {
      if (doc && `${doc.id}:${doc.revision}` !== this.draftFor) { this.draftFor = `${doc.id}:${doc.revision}`; this.draft = { title: doc.title, body: doc.body }; this.editing.set(!doc.body.trim() && doc.form !== 'generated'); }
    }); });
  }
  to(id = '') { return this.ctx.link(...this.base(), ...(id ? [id] : [])); }
  shows(doc: Doc) { return (doc.showsIn || ['product']).map(key => layerLabel[key]).join(', ') || 'the Library only'; }
  toggleLayer(doc: Doc, key: string) { const current = doc.showsIn || ['product']; const showsIn = current.includes(key) ? current.filter(entry => entry !== key) : [...current, key];
    void this.ctx.write(() => this.ctx.change(doc.id, { showsIn }, doc.revision, `Shows in ${showsIn.map(entry => layerLabel[entry]).join(', ') || 'the Library only'}`), 'Saved.'); }
  toggleAgents(doc: Doc, agents: boolean) { void this.ctx.write(() => this.ctx.change(doc.id, { agents }, doc.revision), agents ? 'Agents now read this document.' : 'Agents no longer read this document.'); }
  save(doc: Doc) { void this.ctx.write(async () => { await this.ctx.change(doc.id, { ...this.draft }, doc.revision); this.editing.set(false); }, 'Document saved.'); }
  create() {
    const title = this.newTitle.trim(); if (!title) return;
    const showsIn = this.layer() === 'library' ? [] : [this.layer()];
    void this.ctx.write(async () => { const doc = await this.ctx.record('doc', { title, body: '', showsIn }) as { id: string }; this.newTitle = ''; this.ctx.go(this.to(doc.id)); }, 'Document created.');
  }
  remove(doc: Doc) { if (!confirm(`Delete “${doc.title}”?`)) return; void this.ctx.write(async () => { await this.ctx.delete(doc.id); this.ctx.go(this.to()); }, 'Document deleted.'); }
}
