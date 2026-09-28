import { Component, computed, inject, input } from '@angular/core';
import { ProjectContext, layerLabel } from './context';
import { PagesLayerAppComponent } from './pages-layer-app';

// LAT-03: shared navigation slots. LAT-04 supplies layer-owned documents and editable routines.
@Component({
  selector: 'aludel-shared-layer-slot', standalone: true, imports: [PagesLayerAppComponent],
  template: `
    @if (layerKey() === 'pages') { <aludel-pages-layer-app [slot]="slot()" /> } @else {
    <p class="lay-eyebrow">{{ name() }} · {{ slot() === 'operations' ? 'Operations' : 'Knowledge' }}</p>
    <h1 tabindex="-1">{{ slot() === 'operations' ? 'Operations' : 'Knowledge' }}</h1>
    @if (slot() === 'operations') {
      <p class="lay-lead">Routines and work connected to {{ name() }}.</p>
      <div class="lay-grid lay-g2">
        <section class="lay-card"><h2>Routines</h2>
          @if (routines().length) { <ul class="lay-list">@for (routine of routines(); track routine.id) { <li class="lay-item"><span class="lay-body-text"><strong>{{ routine.title }}</strong><small>{{ routine.enabled ? 'Enabled' : 'Paused' }} · {{ routine.cadence }}</small></span></li> }</ul> }
          @else { <p class="lay-muted">No routines configured for this layer yet.</p> }
        </section>
        <section class="lay-card"><h2>Work</h2><p>{{ workCount() }} items in this layer.</p>
          <a [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)">Open Work</a>
        </section>
      </div>
    } @else {
      <p class="lay-lead">The layer's output specifications and methods will live here.</p>
      <section class="lay-card"><h2>Layer documents</h2><p class="lay-muted">No layer-owned documents configured yet. Existing project documents remain in their current views.</p></section>
    } }`
})
export class SharedLayerSlotComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly slot = input.required<string>();
  readonly name = computed(() => layerLabel[this.layerKey()] || this.layerKey());
  readonly routines = computed(() => (this.ctx.data()?.routines || []).filter(routine => routine.layer === this.layerKey()));
  readonly workCount = computed(() => (this.ctx.data()?.work || []).filter(item => item.layer === this.layerKey()).length);
}
