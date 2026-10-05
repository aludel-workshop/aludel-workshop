import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';
import { WorkAgentsComponent } from './work-agents';
import { AvatarComponent } from './work-shared';

// Work › Team shows project membership and migrated layer grants, then agent profiles.
@Component({
  selector: 'aludel-work-team', standalone: true, imports: [MatIconModule, AvatarComponent, WorkAgentsComponent],
  template: `
  <section aria-labelledby="team-people">
    <div class="lay-row lay-wrap lay-gap-bottom"><h2 id="team-people" class="lay-flat">People</h2>
      <span class="lay-muted small">Layer grants control normal and elevated actions. The owner can review every action.</span></div>
    <div class="lay-table-wrap" tabindex="0" role="region" aria-label="People"><table class="lay-teamtable"><thead><tr><th>Person</th><th>Access</th><th>Permissions</th></tr></thead><tbody>
      @for (member of ctx.data()?.members || []; track member.id) {
        <tr><td><span class="lay-row"><aludel-avatar [who]="{ kind: 'person', id: member.id }" size="lg" /><span><strong>{{ member.id === ctx.me() ? member.name + ' (you)' : member.name }}</strong></span></span></td>
          <td>{{ member.role === 'owner' ? 'Owner' : 'Member' }}</td>
          <td><span class="lay-refs">@for (grant of grantsOf(member.id); track grant.layer + grant.level) { <span [class]="'lay-rchip lay-lc-' + grant.layer">{{ grant.layer }} · {{ grant.level }}</span> } @empty { <span class="lay-muted small">{{ member.role === 'owner' ? 'Owner override' : 'No layer grants' }}</span> }</span></td></tr>
      }
    </tbody></table></div>
    <p class="lay-muted small">Owners can do everything, including keys, spending and deleting. Inviting more people arrives with multi-person projects.</p>
  </section>
  <section class="lay-gap-top lay-card" aria-labelledby="team-editor"><h2 id="team-editor">Work in VS Code with Claude Code</h2>
    <p class="lay-muted small">Items assigned to you open from their page in a container with the project's dev setup, where Claude Code works them through Aludel's tools on their own branch; you watch and review on the item page. Connect once: create a token, then in any item container's terminal run <code>aludel pair</code> and paste it. Every container after that is connected. Work comes back through GitHub; the connection can't deploy or close items.</p>
    @if (editorError()) { <p role="alert" class="lay-warn-text">{{ editorError() }}</p> }
    @if (editorToken()) {
      <p role="status">Token created. Copy it now; Aludel won't show it again.</p>
      <div class="lay-row lay-wrap"><button type="button" class="lay-button small" (click)="copyToken()">Copy token</button><button type="button" class="lay-button ghost small" (click)="editorToken.set('')">Done</button>
        @if (copied()) { <span class="lay-muted small">Copied. Paste it when the command asks.</span> }</div>
      <p class="lay-muted small">In an item container's terminal, run <code>aludel pair</code> and paste the token. To work in your own checkout instead, run <code>node apps/portal/tools/aludel.mjs pair {{ origin }}</code> there.</p>
    } @else {
      <p class="lay-muted small">@if (editorStatus()?.checkout; as place) { Connected: {{ place.path }}{{ place.distro ? ' (WSL ' + place.distro + ')' : '' }}. } @else if (editorStatus()?.connected) { Connected until {{ editorStatus()?.expiresAt?.slice(0, 10) }}. } @else { Not connected yet. }</p>
      <div class="lay-row lay-wrap"><button type="button" class="lay-button small" (click)="createToken()" [disabled]="editorBusy()">{{ editorStatus()?.connected ? 'Connect again' : 'Connect a checkout' }}</button>
        @if (editorStatus()?.connected) { <button type="button" class="lay-button ghost small" (click)="revokeToken()" [disabled]="editorBusy()">Disconnect</button> }</div>
    }
  </section>
  <section class="lay-gap-top" aria-labelledby="team-agents"><h2 id="team-agents">Agents</h2><aludel-work-agents /></section>`
})
export class WorkTeamComponent {
  readonly ctx = inject(ProjectContext);
  readonly grants = computed(() => this.ctx.data()?.layerGrants || []);
  readonly editorStatus = signal<{ connected: boolean; expiresAt: string | null; checkout?: { path: string; distro: string | null } | null } | null>(null);
  // The CLI can't resolve *.localhost names itself, but accepts them: it talks to 127.0.0.1.
  readonly origin = location.origin;
  readonly editorToken = signal('');
  readonly editorError = signal('');
  readonly editorBusy = signal(false);
  readonly copied = signal(false);
  constructor() {
    effect(() => {
      const id = this.ctx.projectId();
      if (id) void this.ctx.api<{ connected: boolean; expiresAt: string | null; checkout: { path: string; distro: string | null } | null }>(`/api/projects/${encodeURIComponent(id)}/editor`)
        .then(value => this.editorStatus.set(value), error => this.editorError.set(error.message));
    });
  }
  async createToken() {
    this.editorBusy.set(true); this.editorError.set(''); this.copied.set(false);
    try {
      const result = await this.ctx.api<{ token: string; expiresAt: string }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/editor`, 'POST', {});
      this.editorToken.set(result.token); this.editorStatus.set({ connected: true, expiresAt: result.expiresAt });
    } catch (error) { this.editorError.set((error as Error).message); }
    finally { this.editorBusy.set(false); }
  }
  async copyToken() {
    try { await navigator.clipboard.writeText(this.editorToken()); this.copied.set(true); }
    catch { this.editorError.set('Clipboard access failed. Allow clipboard access for this page, then copy again.'); }
  }
  async revokeToken() {
    this.editorBusy.set(true); this.editorError.set('');
    try {
      await this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/editor`, 'DELETE');
      this.editorToken.set(''); this.editorStatus.set({ connected: false, expiresAt: null });
    } catch (error) { this.editorError.set((error as Error).message); }
    finally { this.editorBusy.set(false); }
  }
  grantsOf(memberId: string) { return this.grants().filter(grant => grant.userId === memberId); }
}
