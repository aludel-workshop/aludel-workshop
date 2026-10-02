import { Component, Injectable, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';

// @aludel/host/roles (LAYER-BINDINGS-01 R4): what a layer's facets are in this project, for the layer's own views. A facet
// whose concept a binding shares is the authority (edited here, as with no binding), a replica (follows the authority; a
// change is proposed there) or ceded (no longer kept here; its records stay as read-only history). The host refuses
// writes to replica and ceded entries whatever the view does; a view uses this to say why and to offer the right action.
export type Role = 'authority' | 'replica' | 'ceded';
export interface FacetRole {
  key: string; title: string; kinds: string[]; role: Role | null; binding: string | null;
  authority: { participant: string; layer: string; facet: string; name: string } | null;
}
interface LayerRolesState { facets: FacetRole[]; entries: Record<string, string> }

@Injectable({ providedIn: 'root' })
export class LayerRoles {
  private readonly ctx = inject(ProjectContext);
  private readonly state = signal<LayerRolesState | null>(null);
  private asked = false;
  // Roles change with the project's data (a binding accepted, a refacet merged): reload once a view has asked.
  private readonly reload = effect(() => {
    this.ctx.data(); const project = this.ctx.projectId();
    if (project && this.asked) untracked(() => void this.fetch());
  });

  // A view never names its own layer: the host knows which layer's frame is asking.
  private async fetch() {
    const project = this.ctx.projectId();
    if (!project) return;
    try { this.state.set(await this.ctx.api<LayerRolesState>(`/api/projects/${encodeURIComponent(project)}/roles`)); }
    catch { /* no roles: the layer is edited as with no binding, and the host still guards writes */ }
  }
  private roles() {
    if (!this.asked) { this.asked = true; queueMicrotask(() => void this.fetch()); }
    return this.state();
  }

  /** The facet an entry is in, with its role; null for an entry in no facet. */
  of(ref: string): FacetRole | null {
    const roles = this.roles(), facet = roles?.entries[ref];
    return facet ? roles!.facets.find(item => item.key === facet) || null : null;
  }
  /** Facets that hold entries of a kind. */
  forKind(kind: string): FacetRole[] { return (this.roles()?.facets || []).filter(facet => facet.kinds.includes(kind)); }
  /** A facet by key. */
  facet(key: string): FacetRole | null { return (this.roles()?.facets || []).find(facet => facet.key === key) || null; }
  /** Whether this layer edits the entry: it is in no shared facet, or its facet is the authority. */
  editable(ref: string) { const role = this.of(ref)?.role; return !role || role === 'authority'; }
  /** Whether new and existing entries of a kind are edited here: every facet holding the kind is unshared or the authority. */
  editableKind(kind: string) { return this.forKind(kind).every(facet => !facet.role || facet.role === 'authority'); }
  /** Raises Work in the authority's layer asking for a change to an entry, or to a facet as a whole. */
  propose(target: { ref?: string; facet?: string }, note: string) {
    return this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/roles/propose`, 'POST', { ...target, note }),
      'Proposed. The authority\'s layer has it as Work.');
  }
}

// The note a view shows where a replica or ceded facet's entries appear: where the authority is, and what can be done
// here. It shows nothing for the authority or an unshared facet. Name the entry (`ref`), or the kind a tab edits (`kind`).
// Both are the view's own layer's: the host knows which layer is asking.
@Component({
  selector: 'aludel-role-note', standalone: true, imports: [FormsModule, MatIconModule],
  template: `
  @if (facet(); as f) {
    @if (f.role === 'replica' && f.authority) {
      <p class="lay-role-note" role="note"><mat-icon aria-hidden="true">sync</mat-icon>
        <span><strong>Managed in {{ f.authority.name }}'s {{ f.authority.facet }}.</strong> This copy follows it; changes are made there.</span>
        @if (!asking()) { <button type="button" class="lay-button ghost small" (click)="asking.set(true)">Propose a change</button> }</p>
      <!-- Layer views run in a sandboxed frame without browser dialogs, so the proposal is asked for inline. -->
      @if (asking()) {
        <form class="lay-role-propose" (ngSubmit)="propose(f)">
          <label>What should change in {{ f.authority.name }}'s {{ f.authority.facet }}?<textarea name="note" rows="2" maxlength="1000" [(ngModel)]="note"></textarea></label>
          <div class="lay-row"><button type="submit" class="lay-button small" [disabled]="!note.trim()">Send to {{ f.authority.name }}</button>
            <button type="button" class="lay-link-button" (click)="asking.set(false); note = ''">Cancel</button></div></form>
      }
    } @else if (f.role === 'ceded' && f.authority) {
      <p class="lay-role-note" role="note"><mat-icon aria-hidden="true">open_in_new</mat-icon>
        <span><strong>Now managed in {{ f.authority.name }}.</strong> What is here is read-only history.</span>
        <a class="lay-button ghost small" [href]="ctx.link(f.authority.layer)" (click)="ctx.go(ctx.link(f.authority.layer), $event)">Open {{ f.authority.name }}</a></p>
    }
  }`,
  styles: [`.lay-role-note{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 12px;padding:8px 12px;border-radius:12px;background:var(--machine-panel)}
    .lay-role-note>span{flex:1 1 240px}.lay-role-propose{display:flex;flex-direction:column;gap:8px;margin:0 0 12px}.lay-role-propose label{display:flex;flex-direction:column;gap:4px}`]
})
export class RoleNoteComponent {
  readonly ctx = inject(ProjectContext);
  private readonly roles = inject(LayerRoles);
  readonly ref = input<string | null>(null);
  readonly kind = input<string | null>(null);
  // For a kind, the first facet holding it that is not edited here.
  readonly facet = computed(() => {
    const ref = this.ref(), kind = this.kind();
    if (ref) return this.roles.of(ref);
    return kind ? this.roles.forKind(kind).find(facet => facet.role === 'replica' || facet.role === 'ceded') || null : null;
  });
  readonly asking = signal(false);
  note = '';
  async propose(facet: FacetRole) {
    const note = this.note.trim();
    if (!note) return;
    if (await this.roles.propose(this.ref() ? { ref: this.ref()! } : { facet: facet.key }, note)) { this.asking.set(false); this.note = ''; }
  }
}
