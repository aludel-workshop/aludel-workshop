import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Assignee, ProjectContext } from './context';
import { layerColourStyle } from './layer-nav';
import { AssigneeComponent } from './work-shared';

interface LayerAccessView { layer: string; layerScoped: boolean; changes: Record<string, string[]>; unavailable: string[];
  canManageGrants: boolean; canConfigure: boolean; people: { id: string; name: string; owner: boolean; elevated: boolean }[]; defaultAssignee: Assignee | null; }

// Tasks › Access (DEC-057): a layer-scoped layer has no action list. Its charter is the method; this page says what agents
// may change, where new tasks go by default, and who holds elevated access to review, decide follow-ups and configure it.
@Component({
  selector: 'aludel-layer-access', standalone: true, imports: [MatIconModule, AssigneeComponent],
  template: `
  <h2 class="lay-tk-title">Access</h2>
  <p class="lay-muted">{{ name() }} tasks name this layer, not an action. The charter guides the work; everyone on the project can create and do it.</p>
  <section [class]="'lay-role lay-role-tint lay-lc-' + layerKey()" [style]="colour()" aria-labelledby="access-heading">
    <header>
      <div class="lay-row lay-wrap"><span class="lay-tile lay-tile-solid"><mat-icon aria-hidden="true">{{ layer()?.icon || 'layers' }}</mat-icon></span>
        <h3 id="access-heading" class="lay-flat lay-role-name">{{ name() }}</h3></div>
      <p>{{ layer()?.description }}</p>
      <a class="lay-role-link" [href]="ctx.link(layerKey(), 'knowledge', 'identity')" (click)="ctx.go(ctx.link(layerKey(), 'knowledge', 'identity'), $event)"><mat-icon aria-hidden="true">menu_book</mat-icon>Charter · the method for every task</a>
    </header>
    @if (view(); as v) {
      <div class="lay-access">
        <div><h4><mat-icon aria-hidden="true">edit_note</mat-icon>What an agent may change</h4>
          <ul class="lay-access-list">@for (entry of changeList(); track entry[0]) { <li><strong>{{ entry[0] }}</strong><span class="lay-muted small"> · {{ entry[1] }}</span></li> }
            @empty { <li class="lay-muted small">Nothing yet: this layer has no checked change adapter.</li> }</ul>
          @if (v.unavailable.length) { <p class="lay-muted small">Declared but not yet checked by Aludel: {{ v.unavailable.join(', ') }}.</p> }
          <p class="lay-hint">Anything else, in this or another layer, comes back as a follow-up in review with the agent's reason.</p></div>
        <div><h4><mat-icon aria-hidden="true">person</mat-icon>Default assignee</h4>
          <aludel-assignee [assignee]="v.defaultAssignee" label="Default assignee" [locked]="v.canConfigure ? null : 'Elevated access changes the default'" (changed)="setDefault($event)" />
          <p class="lay-hint">New {{ name() }} tasks and accepted follow-ups go here unless someone picks another assignee.</p></div>
        <div><h4><mat-icon aria-hidden="true">shield_person</mat-icon>Elevated access</h4>
          <ul class="lay-role-grants">@for (person of v.people; track person.id) {
            <li><span>{{ person.id === ctx.me() ? 'You' : person.name }}</span>
              @if (person.owner) { <small>Owner: always elevated</small> }
              @else { <label><input type="checkbox" [checked]="person.elevated" [disabled]="!v.canManageGrants" (change)="toggle(person.id, $event)"> Elevated</label> }</li>
          }</ul>
          <p class="lay-hint">Elevated people accept or send back {{ name() }} reviews, decide follow-ups and change this layer's setup. Agents never hold it. Only the owner changes who is elevated.</p></div>
      </div>
    } @else { <p class="lay-arow" role="status">Loading access…</p> }
  </section>`
})
export class LayerAccessComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly layer = computed(() => this.ctx.layerInstances().find(item => item.key === this.layerKey()) || null);
  readonly name = computed(() => this.layer()?.name || this.layerKey());
  readonly colour = computed(() => layerColourStyle(this.layer()));
  readonly view = signal<LayerAccessView | null>(null);
  readonly changeList = computed(() => Object.entries(this.view()?.changes || {}).map(([kind, ops]) => [`${kind[0].toUpperCase()}${kind.slice(1)}s`, ops.join(', ')] as [string, string]));

  constructor() {
    effect(() => { const key = this.layerKey(); untracked(() => this.load(key)); });
  }
  private path(key = this.layerKey()) { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layer-access/${encodeURIComponent(key)}`; }
  load(key = this.layerKey()) { void this.ctx.api<LayerAccessView>(this.path(key)).then(value => this.view.set(value), () => this.view.set(null)); }
  private save(body: unknown, message: string) {
    void this.ctx.write(async () => { this.view.set(await this.ctx.api<LayerAccessView>(this.path(), 'PUT', body)); }, message);
  }
  setDefault(assignee: Assignee) { this.save({ defaultAssignee: assignee?.id ? { kind: assignee.kind, id: assignee.id } : null }, 'Default assignee saved.'); }
  toggle(userId: string, event: Event) { this.save({ userId, elevated: (event.target as HTMLInputElement).checked }, 'Access saved.'); }
}
