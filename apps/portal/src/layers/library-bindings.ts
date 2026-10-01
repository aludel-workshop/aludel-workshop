import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';

// Library › Bindings (LAYER-BINDINGS-01): one binding per concept that several layers share, with who holds authority, what
// each participant is (authority, replica or ceded), how far their entries agree, what the binding changed on its own and
// what it is waiting on. Bindings are knowledge about the project, so they live here; Work's routines run them.
interface Participant { id: string; layer: { key: string; instanceId: string | null }; facet: string; role: 'authority' | 'replica' | 'ceded'; shape: string }
interface Binding { id: string; concept: { name: string; description?: string }; lifecycle: string; revision: number; participants: Participant[];
  authority: string; adapters: { id: string; participant: string; reads: string; mechanical: boolean; soft: boolean }[] }
interface Status {
  binding: Binding; degraded: string[];
  status: { key: string; state: 'matched' | 'missing' | 'diverged' | 'absent'; missingIn: string[] }[];
  events: { seq: number; kind: string; entry: string | null; target: string | null; detail: Record<string, unknown>; workItemId: string | null; createdAt: string }[];
  work: { id: string; state: string; kind: string; entry: string }[];
  wiring: { participant: string; hub: string; adapter: string | null }[];
}
const done = new Set(['done']);

@Component({
  selector: 'aludel-library-bindings', standalone: true, imports: [MatIconModule],
  template: `
  <p class="lay-muted">Where layers share a concept, one binding says which of them holds authority and how the others follow it. Changes run through each layer's own Work; mechanical imports apply on their own and are listed here.</p>
  @for (s of statuses(); track s.binding.id) {
    <section class="lay-card lay-binding" [attr.aria-label]="s.binding.concept.name">
      <div class="lay-row lay-wrap">
        <h2 class="lay-flat">{{ s.binding.concept.name }}</h2>
        <span class="lay-chip" [class.lay-ok]="s.binding.lifecycle === 'active'" [class.lay-plain]="s.binding.lifecycle !== 'active'">{{ lifecycleLabel[s.binding.lifecycle] || s.binding.lifecycle }}</span>
        <span class="lay-push"></span>
        @if (s.binding.lifecycle === 'proposed') {
          <button type="button" class="lay-button small" (click)="move(s.binding, 'reconciling', 'Accepted in Library › Bindings.')">Accept</button>
          <button type="button" class="lay-button small ghost" (click)="dismiss(s.binding)">Dismiss</button>
        } @else if (s.binding.lifecycle === 'active') {
          <button type="button" class="lay-button small ghost" (click)="move(s.binding, 'paused', 'Paused in Library › Bindings.')">Pause</button>
        } @else if (s.binding.lifecycle === 'paused') {
          <button type="button" class="lay-button small" (click)="move(s.binding, 'active', 'Resumed in Library › Bindings.')">Resume</button>
        }
      </div>
      @if (s.binding.concept.description) { <p class="lay-muted">{{ s.binding.concept.description }}</p> }
      <ul class="lay-binding-parts">
        @for (p of s.binding.participants; track p.id) {
          <li><span class="lay-chip lay-l-{{ p.layer.key }}">{{ layerName(p.layer.key) }}</span> {{ p.facet }}
            <strong>{{ roleLabel[p.role] }}</strong>
            @if (p.role !== 'authority' && p.role !== 'ceded') { <small class="lay-muted">{{ via(s, p) }}</small> }</li>
        }
      </ul>
      @if (s.degraded.length) {
        <p class="lay-binding-decide" role="status">On hold: {{ heldBy(s) }} switched off. Nothing changes until it is back, and the others keep their copies.</p>
      } @else if (s.binding.lifecycle !== 'proposed') {
        <p class="lay-binding-counts" role="status">
          <span>{{ count(s, 'matched') }} matched</span>
          @if (count(s, 'diverged')) { <span class="lay-warn">{{ count(s, 'diverged') }} waiting on Work</span> }
          @if (count(s, 'missing')) { <span>{{ count(s, 'missing') }} missing somewhere</span> }
        </p>
      }
      @for (w of decisions(s); track w.id) {
        <div class="lay-row lay-wrap lay-binding-decide">
          <span>Drift in <strong>{{ entryName(w.entry) }}</strong>: take the change into the authority, or bring the participant back in line?</span>
          <button type="button" class="lay-button small" (click)="decide(s.binding, w.id, 'adopt')">Adopt</button>
          <button type="button" class="lay-button small ghost" (click)="decide(s.binding, w.id, 'rectify')">Rectify</button>
        </div>
      }
      @if (openWork(s).length) {
        <h3>Waiting on</h3>
        <ul class="lay-binding-list">@for (w of openWork(s); track w.id) { <li><a [href]="ctx.link('work', 'item', w.id)" (click)="ctx.go(ctx.link('work', 'item', w.id), $event)">{{ kindLabel[w.kind] || w.kind }} · {{ entryName(w.entry) }}</a></li> }</ul>
      }
      @if (changes(s).length) {
        <h3>Recent changes</h3>
        <ul class="lay-binding-list">@for (e of changes(s); track e.seq) { <li>{{ eventText(s, e) }} <small class="lay-muted">{{ e.createdAt.slice(0, 16).replace('T', ' ') }}</small></li> }</ul>
      }
    </section>
  } @empty { <p class="lay-muted lay-pad">{{ error() || 'No bindings yet. When one layer can read what another publishes, a binding is proposed here.' }}</p> }`,
  styles: [`.lay-binding{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}.lay-binding h2{font-size:18px}.lay-binding h3{margin:8px 0 0;font-size:14px}
    .lay-binding-parts,.lay-binding-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}.lay-binding-parts .lay-chip{margin-right:4px}
    .lay-binding-counts{display:flex;flex-wrap:wrap;gap:12px;margin:0;font-size:13.5px}.lay-warn{color:var(--machine-warn-ink, #8a5a00);font-weight:600}
    .lay-binding-decide{padding:8px 12px;border-radius:12px;background:var(--machine-panel)}`]
})
export class LibraryBindingsComponent {
  readonly ctx = inject(ProjectContext);
  readonly statuses = signal<Status[]>([]);
  readonly error = signal('');
  readonly roleLabel: Record<string, string> = { authority: 'authority', replica: 'follows the authority', ceded: 'ceded' };
  readonly lifecycleLabel: Record<string, string> = { proposed: 'Proposed', reconciling: 'Reconciling', active: 'Active', paused: 'Paused', retired: 'Dismissed' };
  readonly kindLabel: Record<string, string> = { adopt: 'Take into the authority', assess: 'Assess drift', rectify: 'Rectify', import: 'Import', review: 'Review', adapter: 'Write an adapter', combine: 'Combine', conflict: 'Decide a conflict' };
  private readonly names = computed(() => new Map(this.ctx.layerInstances().map(layer => [layer.key, layer.name])));
  private seq = 0;
  private readonly load = effect(() => { const project = this.ctx.projectId(); this.ctx.data(); if (project) untracked(() => void this.refresh()); });
  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/bindings`; }
  async refresh() {
    const seq = ++this.seq;
    try {
      const { bindings } = await this.ctx.api<{ bindings: Binding[] }>(this.base());
      const statuses = await Promise.all(bindings.filter(binding => binding.lifecycle !== 'retired').map(binding => this.ctx.api<Status>(`${this.base()}/${encodeURIComponent(binding.id)}/status`)));
      if (seq === this.seq) { this.statuses.set(statuses); this.error.set(''); }
    } catch (error) { if (seq === this.seq) this.error.set(error instanceof Error ? error.message : String(error)); }
  }
  heldBy(s: Status) { const names = s.degraded.map(id => this.layerName(s.binding.participants.find(p => p.id === id)?.layer.key || id)); return `${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'}`; }
  layerName(key: string) { return this.names().get(key) || key; }
  participantName(s: Status, id: string) { const p = s.binding.participants.find(item => item.id === id); return p ? `${this.layerName(p.layer.key)}'s ${p.facet}` : id; }
  via(s: Status, p: Participant) {
    const rows = s.wiring.filter(row => row.participant === p.id);
    return rows.map(row => row.adapter ? `through its ${row.adapter} adapter` : `needs an adapter for ${this.participantName(s, row.hub)}`).join('; ');
  }
  count(s: Status, state: string) { return s.status.filter(row => row.state === state).length; }
  entryName(key: string) { return this.ctx.refInfo(key)?.title || key; }
  decisions(s: Status) { return s.work.filter(w => w.kind === 'assess' && !done.has(w.state)); }
  openWork(s: Status) { return s.work.filter(w => w.kind !== 'assess' && !done.has(w.state)); }
  changes(s: Status) { return s.events.filter(e => ['applied', 'activated', 'proposed'].includes(e.kind) || (e.kind === 'settled' && e.detail['decision'])).slice(0, 8); }
  eventText(s: Status, e: Status['events'][number]) {
    if (e.kind === 'applied') return `${({ added: 'Added', changed: 'Updated', removed: 'Removed' } as Record<string, string>)[String(e.detail['event'])] || 'Imported'} ${this.entryName(e.entry || '')} in ${this.participantName(s, e.target || '')}`;
    if (e.kind === 'activated') return 'First reconcile complete; the binding is active';
    if (e.kind === 'proposed') return 'Proposed by Discover';
    return `Drift in ${this.entryName(e.entry || '')}: decided to ${e.detail['decision']}`;
  }
  move(binding: Binding, lifecycle: string, rationale: string) {
    return this.ctx.write(() => this.ctx.api(`${this.base()}/${encodeURIComponent(binding.id)}/lifecycle`, 'POST', { expectedRevision: binding.revision, lifecycle, rationale }),
      lifecycle === 'reconciling' ? `${binding.concept.name}: accepted.` : '').then(() => this.refresh());
  }
  dismiss(binding: Binding) {
    const reason = prompt(`Why dismiss “${binding.concept.name}”? It won't be proposed again.`)?.trim();
    if (reason) void this.move(binding, 'retired', reason);
  }
  decide(binding: Binding, workItemId: string, decision: 'adopt' | 'rectify') {
    return this.ctx.write(() => this.ctx.api(`${this.base()}/${encodeURIComponent(binding.id)}/decide`, 'POST', { workItemId, decision })).then(() => this.refresh());
  }
}
