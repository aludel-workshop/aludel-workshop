import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageBlocksComponent } from '../page-blocks';
import { Page, PageSection, ProjectContext } from './context';
import { ComponentRenderComponent } from './design-components';
import { ThemeScopeDirective } from './design-state';
import { PagesState, sampleInstance, stateName } from './pages-model';

// Pages › Spec: a page drawn from its spec with the project's own components (Design), in its theme. Sections carry
// data-sec and editable content data-ct, so the preview around it can point at them. Nothing here writes. Its headings sit
// under the layer's own (the page title is level 2), so a preview never adds a second h1.
@Component({
  selector: 'aludel-page-render', standalone: true,
  imports: [MatButtonModule, MatIconModule, PageBlocksComponent, ComponentRenderComponent, ThemeScopeDirective],
  template: `
  @let p = page();
  <div class="lay-pg-app" [class.lay-pg-phone]="phone()" [aludelTheme]="state.vars()">
    @if (!bare()) {
      <header class="lay-pg-bar" data-sec="__shell">
        <span class="lay-pg-brand"><span class="lay-pg-mark" aria-hidden="true">{{ initials() }}</span>{{ appName() }}</span>
        @if (!phone()) { <nav class="lay-pg-topnav" aria-label="App navigation">@for (item of nav(); track item.id) { <span [class.lay-pg-on]="item.id === p.id || item.id === p.parentId"><mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>{{ item.label }}</span> }</nav> }
        <span class="lay-pg-avatar" aria-hidden="true">{{ state.asName(viewer())[0] }}</span>
      </header>
    }
    <div class="lay-pg-body">
      <p class="lay-pg-h" role="heading" aria-level="2">{{ p.label }}</p>
      @if (p.description || editing()) { <p class="lay-pg-desc" data-ct="__page:description">{{ p.description || 'Describe this page.' }}</p> }
      @if (!specified()) {
        <div class="lay-pg-unspec" data-sec="__state"><mat-icon aria-hidden="true">edit_document</mat-icon><strong>{{ stateName[view()] }} state isn’t specified</strong><span>What should {{ p.label }} show {{ stateWhen() }}? Specifying it is Experience designer work.</span></div>
      } @else if (!shown().length) {
        @if (view() !== 'ready') { <div class="lay-pg-statenote" data-sec="__state"><mat-icon aria-hidden="true">notes</mat-icon><span><strong>{{ stateName[view()] }}:</strong> {{ spec().states[view()] || 'Specified, with no sections yet.' }}</span></div> }
        @else if (!spec().sections.length) { <div class="lay-pg-skeleton" data-sec="__blocks"><page-blocks [blocks]="blocks()" [compact]="phone()" /></div> }
        @else { <p class="lay-pg-none">No sections for {{ state.asName(viewer()) }} in this state.</p> }
      } @else {
        <div class="lay-pg-regions" [class.lay-pg-two]="hasSide() && !phone()">
          @for (region of regions(); track region.name) {
            <div class="lay-pg-region">
              @for (s of region.items; track s.id) {
                <section class="lay-pg-sec" [class.lay-pg-deferred]="!!s.phase" [attr.data-sec]="s.id">
                  @if (s.phase) { <span class="lay-pg-phase">{{ phaseName(s.phase) }} · later</span> }
                  @if (s.content.image; as image) { <div class="lay-pg-img" [attr.data-ct]="s.id + ':image'">@if (imageUrl(image); as url) { <img [src]="url" alt=""> } @else { <mat-icon aria-hidden="true">image</mat-icon> }</div> }
                  @else if (editing()) { <div class="lay-pg-img lay-pg-noimg" [attr.data-ct]="s.id + ':image'"><mat-icon aria-hidden="true">add_photo_alternate</mat-icon>Image</div> }
                  @if (s.content.title || editing()) { <h3 class="lay-pg-st" [attr.data-ct]="s.id + ':title'">{{ s.content.title || s.name }}</h3> }
                  @if (s.content.body || editing()) { <p class="lay-pg-sb" [attr.data-ct]="s.id + ':body'" [class.lay-pg-ghosttext]="!s.content.body">{{ s.content.body || 'Add text' }}</p> }
                  @if (component(s); as c) {
                    @if (c.preview === 'button' || c.preview === 'fab') { <button type="button" matButton="filled" [attr.data-ct]="s.id + ':action'">{{ s.content.action || c.name }}</button> }
                    @else if (c.preview) { <div class="lay-pg-comp" [attr.data-comp]="c.id"><aludel-ds-render [kind]="c.preview" [props]="sample(c).props" [children]="sample(c).children" /></div> }
                    @else { <div class="lay-pg-needed" [attr.data-comp]="c.id"><mat-icon aria-hidden="true">widgets</mat-icon>{{ c.name }} <small>{{ c.status === 'needed' ? 'needed in Design' : 'no preview yet' }}</small></div> }
                  } @else { <div class="lay-pg-needed"><mat-icon aria-hidden="true">help_center</mat-icon>No component chosen</div> }
                  @if ((s.content.action || editing()) && !isButton(s)) { <button type="button" matButton="tonal" [attr.data-ct]="s.id + ':action'" [class.lay-pg-ghosttext]="!s.content.action">{{ s.content.action || 'Button label' }}</button> }
                </section>
              }
            </div>
          }
        </div>
      }
    </div>
    @if (!bare() && phone()) { <nav class="lay-pg-tabs" data-sec="__shell" aria-label="App tabs">@for (item of nav(); track item.id) { <span [class.lay-pg-on]="item.id === p.id || item.id === p.parentId"><mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>{{ item.label }}</span> }</nav> }
  </div>`
})
export class PageRenderComponent {
  readonly ctx = inject(ProjectContext);
  readonly state = inject(PagesState);
  readonly page = input.required<Page>();
  // A draft of the spec, while it is being edited; otherwise the saved one.
  readonly draft = input<{ sections: PageSection[]; states: Record<string, string>; pageType: string } | null>(null);
  readonly view = input('ready');
  readonly viewer = input('visitor');
  readonly phone = input(false);
  readonly editing = input(false);
  // Thumbnails leave out the app shell.
  readonly bare = input(false);
  readonly stateName = stateName;
  readonly spec = computed(() => this.draft() || { sections: this.page().sections, states: this.page().states, pageType: this.page().pageType });
  readonly specified = computed(() => this.view() === 'ready' || this.spec().states[this.view()] !== undefined || this.spec().sections.some(section => section.state === this.view()));
  readonly shown = computed(() => this.spec().sections.filter(section => section.state === this.view() && (!section.audience || section.audience === this.viewer())));
  readonly hasSide = computed(() => this.shown().some(section => section.region === 'side'));
  readonly regions = computed(() => this.hasSide() && !this.phone() ? [{ name: 'main', items: this.shown().filter(s => s.region !== 'side') }, { name: 'side', items: this.shown().filter(s => s.region === 'side') }] : [{ name: 'main', items: this.shown() }]);
  readonly blocks = computed(() => this.ctx.catalog()?.pageTypes[this.spec().pageType]?.blocks || []);
  readonly nav = computed(() => (this.ctx.data()?.pages || []).filter(page => page.inNav && !page.parentId).slice(0, 5));
  readonly appName = computed(() => (this.ctx.data()?.brand || []).find(asset => asset.key === 'name')?.text || this.ctx.setup()?.project?.name || 'App');
  readonly initials = computed(() => this.appName().split(/\s+/).map(word => word[0] || '').join('').slice(0, 2).toUpperCase());
  private readonly samples = computed(() => new Map((this.ctx.data()?.components || []).map(c => [c.id, sampleInstance(c, this.ctx.data()?.components || [])])));
  component(s: PageSection) { return s.component ? this.ctx.componentById().get(s.component) || null : null; }
  sample(c: { id: string }) { return this.samples().get(c.id) || { props: {}, children: [] }; }
  isButton(s: PageSection) { const kind = this.component(s)?.preview; return kind === 'button' || kind === 'fab'; }
  stateWhen() { return ({ empty: 'when there is nothing to show', loading: 'while it loads', error: 'when something fails' } as Record<string, string>)[this.view()] || ''; }
  phaseName(key: string) { return ({ demo: 'Demo', mvp: 'MVP', later: 'Later' } as Record<string, string>)[key] || key; }
  imageUrl(id: string) {
    const asset = (this.ctx.data()?.brand || []).find(entry => entry.id === id);
    return asset?.assetId ? this.ctx.uploadUrl(asset.assetId) : '';
  }
}
