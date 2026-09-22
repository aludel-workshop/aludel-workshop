import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AgentConnectionComponent } from '../agent-connection';
import { ProjectContext } from './context';

// Platform: engineering and operations configuration. What to build comes from Product; building happens in Work.
@Component({
  selector: 'aludel-platform-layer', standalone: true,
  imports: [MatIconModule, AgentConnectionComponent],
  template: `
  <p class="lay-eyebrow">Platform · engineering and operations</p>
  <h1 tabindex="-1">How it's built and where it runs</h1>
  <nav class="lay-tabs" aria-label="Platform sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('platform', entry[0])" (click)="ctx.go(ctx.link('platform', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }
  </nav>
  @switch (tab()) {
    @case ('repository') {
      <div class="lay-grid lay-g2">
        <section class="lay-card"><h2>Repository</h2><dl class="lay-kv"><dt>Local</dt><dd>{{ ctx.setup()?.github?.local?.committed ? 'Committed on ' + (ctx.setup()?.github?.local?.branch || 'main') : 'Not committed yet' }}</dd>
          <dt>GitHub</dt><dd>@if (ctx.setup()?.github?.repository; as repo) { <a [href]="repo.html_url" target="_blank" rel="noopener">{{ repo.owner }}/{{ repo.name }}</a> ({{ repo.status }}) } @else { Not published · <a [href]="githubHref()">Publish to GitHub</a> }</dd></dl></section>
      </div>
    }
    @case ('environments') {
      <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Environments"><table><thead><tr><th>Environment</th><th>Status</th><th>Build</th><th>Address</th></tr></thead><tbody>
        <tr><td>Preview</td><td><span class="lay-chip" [class.lay-ok]="preview()?.status === 'running'" [class.lay-plain]="preview()?.status !== 'running'">{{ previewLabel() }}</span></td><td>{{ (preview()?.commit || '—').slice(0, 7) }}</td><td><a [href]="ctx.setup()?.urls?.app" target="_blank" rel="noopener">{{ ctx.setup()?.urls?.app }}</a></td></tr>
        <tr><td>Production</td><td><span class="lay-chip lay-plain">Not set up</span></td><td>—</td><td>Hosted deployment is not available yet (local Aludel)</td></tr>
      </tbody></table></div>
      <div class="lay-row lay-gap-top"><button type="button" class="lay-button small" (click)="rebuild()">Rebuild preview from current records</button><span class="lay-muted small">Uses the page records and design settings; commits to the repository first.</span></div>
      @if (preview()?.status === 'failed') { <details class="lay-log"><summary>Build log</summary><pre>{{ preview()?.log }}</pre></details> }
    }
    @case ('connections') {
      <aludel-agent-connection [projectId]="ctx.projectId()" heading="Agent" description="Agents do the work you hand them in Work. Aludel uses the same connection for every project, including itself." />
      <section class="lay-card"><h2>GitHub</h2><p>{{ ctx.setup()?.github?.configured ? (ctx.setup()?.github?.connected ? 'Connected as ' + ctx.setup()?.github?.login : 'Not connected') : 'The GitHub App is not configured on this Aludel.' }}</p><a [href]="githubHref()">Manage GitHub</a></section>
    }
    @default {
      <div class="lay-grid lay-g2">
        <section class="lay-card"><h2>Stack</h2><dl class="lay-kv"><dt>Preset</dt><dd>{{ preset()?.label || ctx.setup()?.stack?.preset }}</dd>
          @for (layer of layers(); track layer[0]) { <dt>{{ layer[0] }}</dt><dd>{{ layer[1] }}</dd> }</dl></section>
        <section class="lay-card"><h2>Data model</h2><p class="lay-muted small">Entities named in specs. The technical plan for each spec refines them.</p>
          @for (entity of entities(); track entity.name) { <p><strong>{{ entity.name }}</strong><br><small class="lay-muted">{{ entity.detail }} · {{ entity.specs }}</small></p> }
          @empty { <p class="lay-muted">No entities yet. They appear as specs name them.</p> }</section>
      </div>
    }
  }`
})
export class PlatformLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly tabs = [['architecture', 'Architecture'], ['repository', 'Repository'], ['environments', 'Environments'], ['connections', 'Connections']];
  readonly tab = computed(() => this.ctx.segments()[1] || 'architecture');
  readonly preview = computed(() => this.ctx.setup()?.preview || null);
  readonly preset = computed(() => { const id = this.ctx.setup()?.stack?.preset; return id ? this.ctx.catalog()?.stacks.presets[id] : null; });
  readonly layers = computed(() => Object.entries(this.preset()?.layers || {}));
  readonly entities = computed(() => {
    const found = new Map<string, { name: string; detail: string; specs: string[] }>();
    for (const spec of this.ctx.data()?.specs || []) for (const entry of spec.entities) {
      const [name, ...rest] = entry.split(' (');
      const current = found.get(name) || { name, detail: rest.join(' (').replace(/\)$/, ''), specs: [] };
      current.specs.push(spec.ref); found.set(name, current);
    }
    return [...found.values()].map(entity => ({ ...entity, specs: entity.specs.join(', ') }));
  });
  previewLabel() { const status = this.preview()?.status; return status === 'running' ? 'Running' : status === 'stopped' ? 'Built' : status === 'building' ? 'Building' : status === 'failed' ? 'Failed' : 'Not built'; }
  githubHref() { return `/start/${encodeURIComponent(this.ctx.projectId())}/github`; }
  rebuild() { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/skeleton`, 'POST', {}), 'Rebuilding. The preview restarts when the build finishes.'); }
}
