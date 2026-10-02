import { Component, DestroyRef, computed, effect, inject } from '@angular/core';
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
  // The shell's layer bar marks the Tokens tab while it has unsaved edits.
  private readonly markDirty = effect(() => { const dirty = this.ds.dirty(); this.ctx.dirtyTabs.update(tabs => ({ ...tabs, 'design/tokens': dirty })); });
  private readonly clearDirty = inject(DestroyRef).onDestroy(() => this.ctx.dirtyTabs.update(tabs => ({ ...tabs, 'design/tokens': false })));
  readonly tabs = [['tokens', 'Tokens', 'tune'], ['components', 'Components', 'widgets'], ['brand', 'Brand', 'verified'], ['docs', 'Docs', 'description']];
  // Older links (foundations, patterns, guidelines, sources) land on Tokens.
  readonly tab = computed(() => { const tab = this.ctx.segments()[1]; return ['components', 'brand', 'docs'].includes(tab) ? tab : 'tokens'; });
}
