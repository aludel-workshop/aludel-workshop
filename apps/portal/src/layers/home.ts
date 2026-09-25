import { Component, computed, inject } from '@angular/core';
import { ProjectContext, layerLabel, statusLabel, statusOrder, workStatusLabel } from './context';

// Home: the project's pulse across every layer (current phase, what needs you, the app, recent changes).
@Component({
  selector: 'aludel-home-layer', standalone: true,
  template: `
  <p class="lay-eyebrow">{{ ctx.setup()?.project?.name }} · Home</p>
  <h1 tabindex="-1">{{ ctx.setup()?.project?.name }}</h1>
  <p class="lay-lead">{{ valueStatement() }}</p>
  <div class="lay-grid lay-g3">
    <section class="lay-card lay-wide" aria-labelledby="home-phase">
      <div class="lay-row"><h2 id="home-phase" class="lay-flat">{{ currentPhase() }} milestone</h2><span class="lay-chip lay-plain">{{ phaseStories().length }} stories</span>
        <a class="lay-push" [href]="ctx.link('product', 'map')" (click)="ctx.go(ctx.link('product', 'map'), $event)">Story map</a></div>
      @if (phaseStories().length) {
        <div class="lay-progress" role="img" [attr.aria-label]="progressLabel()">@for (entry of phaseCounts(); track entry.status) { @if (entry.count) { <span [style.width.%]="entry.count / phaseStories().length * 100" [style.background]="statusColor[entry.status]"></span> } }</div>
        <div class="lay-legend">@for (entry of phaseCounts(); track entry.status) { <span><i [style.background]="statusColor[entry.status]"></i>{{ entry.count }} {{ statusLabel[entry.status] }}</span> }</div>
      } @else { <p class="lay-muted">No stories in this milestone yet. <a [href]="ctx.link('product', 'map')" (click)="ctx.go(ctx.link('product', 'map'), $event)">Add some on the story map</a>.</p> }
    </section>
    <section class="lay-card" aria-labelledby="home-needs"><h2 id="home-needs">Needs you <span class="lay-count">{{ needsYou().length }}</span></h2>
      @if (needsYou().length) {
        <ul class="lay-list">@for (item of needsYou(); track item.id) { <li><a class="lay-item" [href]="ctx.link('work', 'item', item.id)" (click)="ctx.go(ctx.link('work', 'item', item.id), $event)"><span class="lay-body-text"><span class="lay-chip" [class]="'lay-chip lay-l-' + item.layer">{{ layerLabel[item.layer] }}</span><strong>{{ item.title }}</strong><small>{{ workStatusLabel[item.status] }}</small></span></a></li> }</ul>
      } @else { <p class="lay-muted">Nothing is waiting on you. {{ backlog() }} in the backlog in <a [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)">Work</a>.</p> }
    </section>
    <section class="lay-card" aria-labelledby="home-app"><h2 id="home-app">Your app</h2>
      <dl class="lay-kv"><dt>Preview</dt><dd>{{ previewText() }} @if (ctx.setup()?.preview?.status === 'running' || ctx.setup()?.preview?.status === 'stopped') { · <a [href]="ctx.setup()?.urls?.app" target="_blank" rel="noopener">open</a> }</dd>
        <dt>Address</dt><dd><code>{{ ctx.setup()?.urls?.app }}</code></dd><dt>Production</dt><dd>Not set up</dd></dl></section>
    <section class="lay-card" aria-labelledby="home-recent"><h2 id="home-recent">Recent changes</h2>
      @if (recent().length) { <ul class="lay-list">@for (entry of recent(); track $index) { <li><a class="lay-item" [href]="entry.href" (click)="ctx.go(entry.href, $event)"><span class="lay-body-text"><span [class]="'lay-chip lay-l-' + entry.layer">{{ layerLabel[entry.layer] }}</span><span>{{ entry.text }}</span></span></a></li> }</ul> }
      @else { <p class="lay-muted">No changes yet.</p> }</section>
    <section class="lay-card" aria-labelledby="home-code"><h2 id="home-code">Code</h2>
      @if (ctx.data()?.code?.units?.length) {
        <p class="lay-flat"><span class="lay-chip" [class.lay-warn]="ctx.suspectUnits().length" [class.lay-ok]="!ctx.suspectUnits().length">{{ ctx.suspectUnits().length ? ctx.suspectUnits().length + ' suspect' : 'All current' }}</span></p>
        <p class="lay-muted small">{{ ctx.suspectUnits().length ? 'Records changed after their code was written. Each has a Reconcile item in Work.' : 'Every linked record matches the code built for it.' }}</p>
        <a class="small" [href]="ctx.link('platform', 'explorer')" (click)="ctx.go(ctx.link('platform', 'explorer'), $event)">Code › Explorer</a>
      } @else { <p class="lay-muted">Read after the first build.</p> }
    </section>
    <section class="lay-card lay-quiet" aria-labelledby="home-insights"><h2 id="home-insights">Insights</h2><p class="lay-muted">Usage, feedback and experiments get their own layer once the app has users.</p></section>
  </div>`
})
export class HomeLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly statusLabel = statusLabel;
  readonly workStatusLabel = workStatusLabel;
  readonly layerLabel = layerLabel;
  readonly statusColor: Record<string, string> = { proposed: '#c1c8d8', defined: '#8e9ad0', designed: '#d9708f', built: '#3047b9', shipped: '#146446' };
  readonly currentPhase = computed(() => this.ctx.data()?.phases.find(phase => phase.current)?.label || 'Demo');
  // The Brief's value proposition (ROADMAP-01), or the older vision statement.
  readonly valueStatement = computed(() => this.ctx.data()?.claims.find(claim => claim.section === 'value')?.text || this.ctx.data()?.vision?.['statement']?.body || '');
  readonly needsYou = computed(() => (this.ctx.data()?.work || []).filter(item => item.status === 'needs' || item.status === 'review'));
  readonly backlog = computed(() => (this.ctx.data()?.work || []).filter(item => item.status === 'backlog').length);
  readonly phaseStories = computed(() => { const data = this.ctx.data(); const phase = data?.phases.find(item => item.current)?.key || 'demo'; return (data?.stories || []).filter(story => story.phase === phase); });
  readonly phaseCounts = computed(() => statusOrder.map(status => ({ status, count: this.phaseStories().filter(story => story.status === status).length })));
  readonly recent = computed(() => {
    const data = this.ctx.data(); if (!data) return [];
    const entries = [
      ...data.stories.flatMap(story => story.history.map(entry => ({ layer: 'product', text: `${story.ref} ${story.title}: ${entry.rationale}`, at: entry.createdAt, href: this.ctx.link('product', 'map', story.id) }))),
      ...data.pages.flatMap(page => page.history.map(entry => ({ layer: 'pages', text: `${page.label}: ${entry.rationale}`, at: entry.createdAt, href: this.ctx.link('pages', 'page', page.id) }))),
      ...data.work.map(item => ({ layer: item.layer, text: `${item.ref} ${item.title} · ${workStatusLabel[item.status]}`, at: item.updatedAt, href: this.ctx.link('work', 'item', item.id) }))
    ];
    return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  });

  progressLabel() { return this.phaseCounts().filter(entry => entry.count).map(entry => `${entry.count} ${statusLabel[entry.status]}`).join(', '); }
  previewText() { const status = this.ctx.setup()?.preview?.status; return status === 'running' ? 'Running' : status === 'stopped' ? 'Built · starts when opened' : status === 'building' ? 'Building' : status === 'failed' ? 'Build failed' : 'Not built yet'; }
}
