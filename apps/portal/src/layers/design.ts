import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';
import { DesignBrandComponent } from './design-brand';
import { DesignComponentsComponent } from './design-components';
import { DesignState } from './design-state';
import { DesignTokensComponent } from './design-tokens';
import { DocsComponent } from './doc-view';

// Design (DESIGN-UX-01, DEC-045): the design system as tokens, component contracts and brand, edited against a live preview
// of the stack's real components. References and documents live in the Library.
@Component({
  selector: 'aludel-design-layer', standalone: true,
  imports: [MatIconModule, DesignTokensComponent, DesignComponentsComponent, DesignBrandComponent, DocsComponent],
  providers: [DesignState],
  template: `
  <p class="lay-eyebrow">Design · the design system</p>
  <h1 tabindex="-1">{{ ctx.setup()?.project?.name }}'s design system</h1>
  <nav class="lay-tabs" aria-label="Design sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('design', entry[0])" (click)="ctx.go(ctx.link('design', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null"><mat-icon aria-hidden="true">{{ entry[2] }}</mat-icon>{{ entry[1] }}@if (entry[0] === 'tokens' && ds.dirty()) { <span class="lay-ds-dirtydot" aria-label="unsaved changes"></span> }</a> }
  </nav>
  @if (!ctx.data()?.tokens) { <p class="lay-muted">Loading the design system…</p> }
  @else {
    @switch (tab()) {
      @case ('components') { <aludel-design-components /> }
      @case ('brand') { <aludel-design-brand /> }
      @case ('docs') { <aludel-docs layer="design" [base]="['design', 'docs']" /> }
      @default { <aludel-design-tokens /> }
    }
  }`,
  host: { class: 'lay-ds-host' }
})
export class DesignLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly ds = inject(DesignState);
  readonly tabs = [['tokens', 'Tokens', 'tune'], ['components', 'Components', 'widgets'], ['brand', 'Brand', 'verified'], ['docs', 'Docs', 'description']];
  // Older links (foundations, patterns, guidelines, sources) land on Tokens.
  readonly tab = computed(() => { const tab = this.ctx.segments()[1]; return ['components', 'brand', 'docs'].includes(tab) ? tab : 'tokens'; });
}
