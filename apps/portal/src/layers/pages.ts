import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';
import { PagesFlowsComponent } from './pages-flows';
import { PagesMapComponent } from './pages-map';
import { PagesState } from './pages-model';
import { PagesPageComponent } from './pages-page';

// Pages (PAGES-UX-01): how the product works for people. The Experience designer plans the app's structure and flows on
// the Map, specs each page from the design system in Pages, and reviews journeys in Flows. Text and images are edited
// directly; a different layout or behaviour on a built page is a change request that becomes Engineer work.
@Component({
  selector: 'aludel-pages-layer', standalone: true,
  imports: [MatIconModule, PagesMapComponent, PagesPageComponent, PagesFlowsComponent],
  providers: [PagesState],
  template: `
  <p class="lay-eyebrow">Pages · how the product works for people</p>
  <h1 tabindex="-1">{{ ctx.setup()?.project?.name }}'s pages</h1>
  <nav class="lay-tabs" aria-label="Pages sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('pages', entry[0])" (click)="ctx.go(ctx.link('pages', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null"><mat-icon aria-hidden="true">{{ entry[2] }}</mat-icon>{{ entry[1] }}</a> }
  </nav>
  @if (!ctx.data()) { <p class="lay-muted">Loading the pages…</p> }
  @else {
    @switch (tab()) {
      @case ('page') { <aludel-pages-page /> }
      @case ('flows') { <aludel-pages-flows /> }
      @default { <aludel-pages-map /> }
    }
  }`,
  host: { class: 'lay-pg-host' }
})
export class PagesLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly tabs = [['map', 'Map', 'account_tree'], ['page', 'Pages', 'web'], ['flows', 'Flows', 'route']];
  // Older links (/pages/tree/<id>) open the page.
  readonly tab = computed(() => { const tab = this.ctx.segments()[1]; return tab === 'tree' ? 'page' : ['page', 'flows'].includes(tab) ? tab : 'map'; });
}
