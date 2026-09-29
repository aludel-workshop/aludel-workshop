import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ProjectContext, layerLabel } from './context';
import { PagesLayerAppComponent } from './pages-layer-app';

interface LayerActionSummary { id: string; revision: number; title: string; purpose: string; elevated: boolean; humanAvailable: boolean; agentAvailable: boolean;
  unavailableReason: string | null; checks: string[]; result: { owner: string; kind: string; operation: string };
  permissions: { reads: { layer: string; kind: string }[]; fileReads: string[]; fileWrites: string[]; effects: string[] }; }
interface LayerDescriptor { key: string; name: string; authority: string; outputs: { kind: string; count: number; revision: string }[];
  actions: LayerActionSummary[]; legacy: { id: string; disposition: string; reason?: string; action?: string }[]; }

// Pages has its own editable application. Other built-in layers expose their
// existing native editors and an honest inventory until adapters/docs are built.
@Component({
  selector: 'aludel-shared-layer-slot', standalone: true, imports: [PagesLayerAppComponent],
  template: `
    @if (layerKey() === 'pages') { <aludel-pages-layer-app [slot]="slot()" /> } @else {
      <p class="lay-eyebrow">{{ name() }} · {{ slot() === 'operations' ? 'Operations' : 'Knowledge' }}</p>
      <h1 tabindex="-1">{{ name() }} {{ slot() === 'operations' ? 'operations' : 'knowledge' }}</h1>
      @if (slot() === 'operations') {
        <p class="lay-lead">The layer-owned action path is being prepared. Existing role-backed Work remains available until its LAT-08 migration; Work controls Go and signed review.</p>
        <div class="lay-grid lay-g2">
          <section class="lay-card"><h2>Layer actions</h2>
            @if (descriptor(); as layer) {
              <ul class="lay-list">@for (action of layer.actions; track action.id) {
                <li class="lay-item"><span class="lay-body-text"><strong>{{ action.title }}</strong>
                  <small>{{ action.id }} · r{{ action.revision }} · {{ action.elevated ? 'Elevated' : 'Normal' }} · {{ action.result.operation }}</small>
                  <span>{{ action.purpose }}</span>
                  @if (action.humanAvailable || action.agentAvailable) { <small>{{ action.humanAvailable ? 'Person path available' : '' }} {{ action.agentAvailable ? 'Agent path available' : '' }}</small> }
                  @else { <small class="lay-muted">Layer-owned path unavailable: {{ action.unavailableReason }}</small> }
                  <small>Reads: {{ reads(action) }} · Effect: {{ action.permissions.effects.join(', ') }}</small>
                </span></li> }
                @for (entry of layer.legacy; track entry.id) { @if (!entry.action) {
                  <li class="lay-item"><span class="lay-body-text"><strong>{{ entry.id }}</strong><small>{{ entry.disposition }} · {{ entry.reason }}</small></span></li>
                } }</ul>
            } @else { <p class="lay-muted">{{ loadError() ? 'Action inventory unavailable. Try reloading this page.' : 'Loading action inventory…' }}</p> }
          </section>
          <div><section class="lay-card"><h2>Routines</h2>
            @if (routines().length) { <ul class="lay-list">@for (routine of routines(); track routine.id) { <li class="lay-item"><span class="lay-body-text"><strong>{{ routine.title }}</strong><small>{{ routine.enabled ? 'Enabled' : 'Paused' }} · {{ routine.cadence }} · r{{ routine.revision }}</small></span></li> }</ul> }
            @else { <p class="lay-muted">No layer-owned routine is configured. No scan or agent run starts from this view.</p> }
          </section>
          <section class="lay-card lay-gap-top"><h2>Work</h2><p>{{ workCount() }} items in this layer.</p>
            <a [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)">Open Work</a></section></div>
        </div>
      } @else {
        <p class="lay-lead">{{ name() }} keeps its existing typed output authority. Open the native view to inspect or edit records and their revisions.</p>
        <div class="lay-grid lay-g2">
          <section class="lay-card"><h2>Output contracts</h2>
            @if (descriptor(); as layer) { <p class="lay-muted small">Authority: {{ layer.authority }}. Counts come from current project records.</p>
              <ul class="lay-list">@for (output of layer.outputs; track output.kind) { <li class="lay-item"><span class="lay-body-text"><strong>{{ output.kind }}</strong><small>{{ output.count }} records · {{ output.revision }} revisions</small></span></li> }</ul>
              <a [href]="ctx.link(layerKey())" (click)="ctx.go(ctx.link(layerKey()), $event)">Open {{ name() }} records</a>
            } @else { <p class="lay-muted">{{ loadError() ? 'Output inventory unavailable. Try reloading this page.' : 'Loading output inventory…' }}</p> }
          </section>
          <section class="lay-card"><h2>Methods and instructions</h2>
            <p class="lay-muted">No layer-owned revisioned method documents are installed here. Existing record contracts and repository instructions retain their current authority.</p>
          </section>
        </div>
      }
    }`
})
export class SharedLayerSlotComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly slot = input.required<string>();
  readonly name = computed(() => layerLabel[this.layerKey()] || this.layerKey());
  readonly descriptors = signal<LayerDescriptor[]>([]);
  readonly loadError = signal(false);
  readonly descriptor = computed(() => this.descriptors().find(layer => layer.key === this.layerKey()) || null);
  readonly routines = computed(() => (this.ctx.data()?.routines || []).filter(routine => routine.layer === this.layerKey()));
  readonly workCount = computed(() => (this.ctx.data()?.work || []).filter(item => item.layer === this.layerKey()).length);
  reads(action: LayerActionSummary) { return action.permissions.reads.map(read => `${read.layer}.${read.kind}`).join(', ') || 'None'; }
  readonly refresh = effect(() => {
    const projectId = this.ctx.projectId();
    if (projectId && this.layerKey() !== 'pages') void this.load(projectId);
  });
  private async load(projectId: string) {
    try {
      const result = await this.ctx.api<{ layers: LayerDescriptor[] }>(`/api/projects/${encodeURIComponent(projectId)}/layers`);
      if (projectId === this.ctx.projectId()) { this.descriptors.set(result.layers || []); this.loadError.set(false); }
    } catch { if (projectId === this.ctx.projectId()) this.loadError.set(true); }
  }
}
