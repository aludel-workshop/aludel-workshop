import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';
import { WorkAgentsComponent } from './work-agents';
import { AvatarComponent } from './work-shared';

// Work › Team (ROADMAP-01, DEC-043): the people on the project, their access and their roles (a role chip in its layer's
// colour, with a shield for a lead), then the agent profiles exactly as before. Agents have no roles of their own: they act
// in the role of whatever action they are given.
@Component({
  selector: 'aludel-work-team', standalone: true, imports: [MatIconModule, AvatarComponent, WorkAgentsComponent],
  template: `
  <section aria-labelledby="team-people">
    <div class="lay-row lay-wrap lay-gap-bottom"><h2 id="team-people" class="lay-flat">People</h2>
      <span class="lay-muted small">A shield <mat-icon class="lay-shield lay-inline-icon" aria-label="lead" role="img">shield_person</mat-icon> marks a lead: leads may do their role's elevated actions.</span></div>
    <div class="lay-table-wrap" tabindex="0" role="region" aria-label="People"><table class="lay-teamtable"><thead><tr><th>Person</th><th>Access</th><th>Roles</th></tr></thead><tbody>
      @for (member of ctx.data()?.members || []; track member.id) {
        <tr><td><span class="lay-row"><aludel-avatar [who]="{ kind: 'person', id: member.id }" size="lg" /><span><strong>{{ member.id === ctx.me() ? member.name + ' (you)' : member.name }}</strong></span></span></td>
          <td>{{ member.role === 'owner' ? 'Owner' : 'Member' }}</td>
          <td><span class="lay-refs">@for (role of rolesOf(member.id); track role.layer) { <span [class]="'lay-rchip lay-lc-' + role.layer">@if (role.lead) { <mat-icon class="lay-shield" aria-label="lead" role="img">shield_person</mat-icon> }{{ role.name }}</span> } @empty { <span class="lay-muted small">No roles yet</span> }</span></td></tr>
      }
    </tbody></table></div>
    <p class="lay-muted small">Owners can do everything, including keys, spending and deleting. Inviting more people arrives with multi-person projects.</p>
  </section>
  <section class="lay-gap-top" aria-labelledby="team-agents"><h2 id="team-agents">Agents</h2><aludel-work-agents /></section>`
})
export class WorkTeamComponent {
  readonly ctx = inject(ProjectContext);
  readonly roles = computed(() => this.ctx.data()?.roles || []);
  rolesOf(memberId: string) { return this.roles().filter(role => role.members.some(member => member.id === memberId)).map(role => ({ layer: role.layer, name: role.name, lead: role.members.find(member => member.id === memberId)!.lead })); }
}
