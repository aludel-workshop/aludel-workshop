import { Component, effect, inject, input, signal } from '@angular/core';
import { ProjectContext } from './context';

interface ActionSetting { id: string; revision: number; title: string; purpose: string; elevated: boolean; available: boolean;
  assignee: { kind: 'person' | 'agent'; id: string } | null; installedStyle: string | null; method: string; methodRevision: number; unavailableReason: string | null; }

@Component({ selector: 'aludel-layer-action-settings', standalone: true, template: `
  <section class="lay-card lay-gap-top" aria-labelledby="layer-action-settings-heading">
    <h2 id="layer-action-settings-heading">Action setup</h2>
    <p class="lay-muted">Changing a default affects future tasks. Work keeps Go, runs and review.</p>
    @if (loading()) { <p role="status">Loading actions…</p> }
    @else { <ul class="lay-list">@for (action of actions(); track action.id) {
      <li class="lay-item"><span class="lay-body-text"><strong>{{ action.title }}</strong>
        <small>{{ action.id }} · r{{ action.revision }} · {{ action.elevated ? 'Elevated' : 'Normal' }} · seeded under {{ action.installedStyle || 'unknown style' }}</small>
        <span>{{ action.purpose }}</span>
        @if (!action.available) { <small class="lay-muted">Unavailable: {{ action.unavailableReason || 'No checked adapter is installed.' }}</small> }
        <label [for]="'method-' + action.id">Method · r{{ action.methodRevision }}</label>
        <textarea [id]="'method-' + action.id" #methodText [value]="action.method" rows="3" maxlength="8000"></textarea>
        <button type="button" class="lay-button ghost small" (click)="saveMethod(action, methodText.value)">Save method</button>
        <label [for]="'default-' + action.id">Default assignee</label>
        <select [id]="'default-' + action.id" [value]="selection(action)" (change)="save(action, $event)" [disabled]="!action.available">
          <option value="">Unassigned</option>
          @for (member of ctx.data()?.members || []; track member.id) { <option [value]="'person:' + member.id">{{ member.name }}</option> }
          @for (profile of ctx.data()?.profiles || []; track profile.id) { @if (profile.active) { <option [value]="'agent:' + profile.id">{{ profile.name }} (agent)</option> } }
        </select>
      </span></li>
    } @empty { <li>No actions are installed in this layer.</li> }</ul> }
    <h3>Layer permissions</h3><p class="lay-muted small">A normal grant allows this layer’s normal actions. Elevated actions need a separate grant and still require human review.</p>
    <ul class="lay-list">@for (member of ctx.data()?.members || []; track member.id) {
      <li class="lay-item"><span class="lay-body-text"><strong>{{ member.name }}</strong>
        @if (member.role === 'owner') { <small>Project owner override</small> }
        @else { <label><input type="checkbox" [checked]="granted(member.id, 'normal')" (change)="toggleGrant(member.id, 'normal', $event)"> Normal</label>
          <label><input type="checkbox" [checked]="granted(member.id, 'elevated')" (change)="toggleGrant(member.id, 'elevated', $event)"> Elevated</label> }
      </span></li>
    }</ul>
  </section>` })
export class LayerActionSettingsComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly actions = signal<ActionSetting[]>([]);
  readonly loading = signal(false);
  private sequence = 0;
  readonly refresh = effect(() => { const projectId = this.ctx.projectId(); const key = this.layerKey(); if (projectId && key) void this.load(projectId, key); });
  private async load(projectId: string, key: string) {
    const sequence = ++this.sequence; this.loading.set(true);
    try {
      const result = await this.ctx.api<{ actions: ActionSetting[] }>(`/api/projects/${encodeURIComponent(projectId)}/layer-actions/${encodeURIComponent(key)}`);
      if (sequence === this.sequence) this.actions.set(result.actions);
    } catch (error) { if (sequence === this.sequence) this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
    finally { if (sequence === this.sequence) this.loading.set(false); }
  }
  granted(userId: string, level: string) { return Boolean(this.ctx.data()?.layerGrants.some(grant => grant.userId === userId && grant.layer === this.layerKey() && !grant.actionId && grant.level === level)); }
  toggleGrant(userId: string, level: 'normal' | 'elevated', event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/layer-grants`, 'PUT',
      { userId, layerKey: this.layerKey(), level, enabled }), 'Permission saved.');
  }
  saveMethod(action: ActionSetting, method: string) {
    void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/layer-actions/${encodeURIComponent(this.layerKey())}/${encodeURIComponent(action.id)}`, 'PUT',
      { method, expectedRevision: action.methodRevision }), 'Layer method saved for future runs.')
      .then(() => void this.load(this.ctx.projectId(), this.layerKey()));
  }
  selection(action: ActionSetting) { return action.assignee ? `${action.assignee.kind}:${action.assignee.id}` : ''; }
  save(action: ActionSetting, event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    const [kind, id] = value.split(':');
    const assignee = value ? { kind, id } : null;
    void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/layer-actions/${encodeURIComponent(this.layerKey())}/${encodeURIComponent(action.id)}`, 'PUT', { assignee }),
      'Future tasks will use the new default.').then(() => void this.load(this.ctx.projectId(), this.layerKey()));
  }
}
