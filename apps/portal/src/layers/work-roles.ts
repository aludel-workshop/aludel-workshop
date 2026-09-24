import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Assignee, ProjectContext, Role, WorkAction, layerLabel, lines } from './context';
import { AssigneeComponent, RefChipComponent } from './work-shared';

interface Draft { instructions: string; reads: string[]; changes: string[]; tools: string[]; asks: string; phases: string; checks: string; rationale: string; newChange: string; attach: string; }

// Work › Roles (WORK-UX-01): one role per layer, and the actions it performs. Each action says who takes it and carries
// the setup anyone doing it works with: instructions, what it always reads, what it may change, its tools, what it asks
// first, its run phases and the checks its work is reviewed against. The onboarding style only preset the assignees.
@Component({
  selector: 'aludel-work-roles', standalone: true, imports: [FormsModule, MatIconModule, AssigneeComponent, RefChipComponent],
  template: `
  @if (!ctx.agentReady()) {
    <div class="lay-banner-warn" role="note"><mat-icon aria-hidden="true">power_off</mat-icon><p><strong>Agents can't take work yet.</strong> No agent account is connected, so agent choices are unavailable. Actions set to an agent wait for one.
      <a [href]="ctx.link('work', 'agents')" (click)="ctx.go(ctx.link('work', 'agents'), $event)">Connect an account</a></p></div>
  }
  <div class="lay-roles">
    @for (role of roles(); track role.layer) {
      <section class="lay-role" [id]="'role-' + role.layer" [attr.aria-labelledby]="'role-heading-' + role.layer">
        <header [class]="'lay-lc-' + role.layer">
          <div class="lay-row lay-wrap"><span class="lay-tile lay-tile-solid"><mat-icon aria-hidden="true">{{ layerIcon[role.layer] }}</mat-icon></span>
            <h2 [id]="'role-heading-' + role.layer" class="lay-flat">{{ role.name }}</h2>
            <span class="lay-refs lay-push">@for (member of role.members; track member.id) { <span class="lay-rchip">@if (member.lead) { <mat-icon aria-label="lead" role="img" class="lay-shield">shield_person</mat-icon> }{{ memberName(member.id) }}</span> }</span></div>
          <p>{{ role.blurb }}</p>
          <details [open]="editingRole() === role.layer" (toggle)="roleToggled(role, $event)"><summary><mat-icon aria-hidden="true">menu_book</mat-icon>Role instructions · revision {{ role.revision }}</summary>
            <form (ngSubmit)="saveRole(role)" class="lay-role-form"><label class="visually-hidden" [for]="'role-instructions-' + role.layer">{{ role.name }} instructions</label>
              <textarea [id]="'role-instructions-' + role.layer" [name]="'roleInstructions'" rows="4" [(ngModel)]="roleDraft"></textarea>
              <p class="lay-hint">Read before every action's own instructions.</p>
              <label class="visually-hidden" [for]="'role-why-' + role.layer">Why this change</label><input [id]="'role-why-' + role.layer" name="roleWhy" [(ngModel)]="roleWhy" placeholder="Why this change (saved with the revision)">
              <button type="submit" class="lay-button small" [disabled]="roleDraft === role.instructions">Save</button></form></details>
        </header>
        <ul class="lay-actions">
          @for (action of role.actions; track action.id) {
            <li [id]="'action-' + action.id">
              <div class="lay-arow">
                <div><strong>{{ action.name }}</strong>@if (action.routine) { <span class="lay-tag"><mat-icon aria-hidden="true">event_repeat</mat-icon>Routine</span> }
                  <small>{{ action.description }}</small>
                  @if (action.assignee?.kind === 'agent' && !ctx.agentReady()) { <small class="lay-warn-text"><mat-icon aria-hidden="true">schedule</mat-icon>Waits until an agent account is connected</small> }</div>
                <aludel-assignee [assignee]="action.assignee" label="Default assignee" (changed)="assign(action, $event)" />
                <button type="button" class="lay-setup-btn" [attr.aria-expanded]="openAction() === action.id" [attr.aria-controls]="'setup-' + action.id" (click)="toggle(action)">Setup<mat-icon aria-hidden="true">expand_more</mat-icon></button>
                <button type="button" class="lay-elev" [attr.aria-pressed]="action.elevated" [attr.aria-label]="'Elevated (leads only): ' + action.name" [title]="action.elevated ? 'Elevated: only leads of this role; an agent given it acts as a lead and its result waits for a human lead' : 'Any member of this role'" (click)="elevate(action)" [disabled]="!action.recordId">
                  <mat-icon aria-hidden="true">{{ action.elevated ? 'shield_person' : 'shield' }}</mat-icon></button>
              </div>
              @if (openAction() === action.id) {
                <form class="lay-setup" [id]="'setup-' + action.id" (ngSubmit)="saveAction(action)" [attr.aria-label]="action.name + ' setup'">
                  <div><h4><mat-icon aria-hidden="true">menu_book</mat-icon>Action instructions <span class="lay-tag">revision {{ action.revision }}</span></h4>
                    <label class="visually-hidden" for="action-instructions">Instructions for {{ action.name }}</label>
                    <textarea id="action-instructions" name="instructions" rows="5" [(ngModel)]="draft.instructions" [placeholder]="'What anyone doing “' + action.name + '” should know'"></textarea>
                    <p class="lay-hint">Read after the project and {{ role.name }} instructions, before the assignee's own. Runs keep the revision they started with.</p></div>
                  <div class="lay-setup-side">
                    <div><h4><mat-icon aria-hidden="true">visibility</mat-icon>Always reads</h4>
                      <div class="lay-refs">@for (id of draft.reads; track id) { <span class="lay-token"><aludel-ref [id]="id" /><button type="button" (click)="draft.reads = without(draft.reads, id)" [attr.aria-label]="'Stop reading ' + (ctx.refInfo(id)?.label || id)"><mat-icon aria-hidden="true">close</mat-icon></button></span> }</div>
                      <div class="lay-inline-add"><label class="visually-hidden" for="attach-read">Record to attach</label>
                        <select id="attach-read" name="attach" [(ngModel)]="draft.attach"><option value="">Attach a record…</option>@for (option of attachable(); track option.id) { <option [value]="option.id">{{ option.label }}</option> }</select>
                        <button type="button" class="lay-button ghost small" [disabled]="!draft.attach" (click)="attach()">Attach</button></div>
                      <p class="lay-hint">On top of each item's own linked records.</p></div>
                    <div><h4><mat-icon aria-hidden="true">edit</mat-icon>May change</h4>
                      <div class="lay-tokens">@for (change of draft.changes; track change) { <span class="lay-token">{{ change }}<button type="button" (click)="draft.changes = without(draft.changes, change)" [attr.aria-label]="'Remove ' + change"><mat-icon aria-hidden="true">close</mat-icon></button></span> }
                        @empty { <span class="lay-token lay-token-none">Nothing: suggestions only</span> }</div>
                      <div class="lay-inline-add"><label class="visually-hidden" for="new-change">Something it may change</label><input id="new-change" name="newChange" [(ngModel)]="draft.newChange" placeholder="Layer › records, e.g. Product › specs">
                        <button type="button" class="lay-button ghost small" [disabled]="!draft.newChange.trim()" (click)="addChange()">Add</button></div>
                      <p class="lay-hint">Everything else is read-only for this action.</p></div>
                  </div>
                  <div class="lay-setup-full"><h4><mat-icon aria-hidden="true">construction</mat-icon>Tools</h4>
                    <div class="lay-tokens">@for (tool of toolKeys(); track tool) { <label class="lay-toolchk" [for]="'tool-' + tool"><input type="checkbox" [id]="'tool-' + tool" [checked]="draft.tools.includes(tool)" (change)="toggleTool(tool, $any($event.target).checked)">{{ ctx.catalog()?.tools?.[tool] }}</label> }</div></div>
                  <div><h4><mat-icon aria-hidden="true">front_hand</mat-icon>Asks you first</h4><label class="visually-hidden" for="action-asks">Asks you first</label><textarea id="action-asks" name="asks" rows="2" [(ngModel)]="draft.asks"></textarea></div>
                  <div><h4><mat-icon aria-hidden="true">timeline</mat-icon>Run phases</h4><label class="visually-hidden" for="action-phases">Run phases, one per line</label><textarea id="action-phases" name="phases" rows="3" [(ngModel)]="draft.phases"></textarea>
                    <p class="lay-hint">One per line: the milestones on an agent's progress bar.</p></div>
                  <div class="lay-setup-full"><h4><mat-icon aria-hidden="true">task_alt</mat-icon>Done when</h4><label class="visually-hidden" for="action-checks">Checks, one per line</label><textarea id="action-checks" name="checks" rows="3" [(ngModel)]="draft.checks"></textarea>
                    <p class="lay-hint">One per line. New items get these checks; review goes through them one by one.</p></div>
                  <div class="lay-setup-full lay-row lay-wrap"><label class="visually-hidden" for="action-why">Why this change</label><input id="action-why" name="rationale" [(ngModel)]="draft.rationale" placeholder="Why this change (saved with the revision)" class="lay-grow">
                    <button type="submit" class="lay-button small">Save {{ action.name }}</button><button type="button" class="lay-button ghost small" (click)="openAction.set(null)">Close</button></div>
                </form>
              }
            </li>
          }
        </ul>
      </section>
    }
  </div>`
})
export class WorkRolesComponent {
  readonly ctx = inject(ProjectContext);
  readonly focus = input<string | null>(null);
  readonly layerLabel = layerLabel;
  readonly roles = computed<Role[]>(() => this.ctx.data()?.roles || []);
  readonly toolKeys = computed(() => Object.keys(this.ctx.catalog()?.tools || {}));
  readonly openAction = signal<string | null>(null);
  readonly editingRole = signal<string | null>(null);
  readonly attachable = computed(() => {
    const data = this.ctx.data(); if (!data) return [];
    const ids = [...data.claims.map(entry => entry.id), ...data.insights.map(entry => entry.id), ...data.projects.map(entry => entry.id), ...Object.values(data.vision).map(entry => entry.id), ...data.docs.map(entry => entry.id), ...data.research.map(entry => entry.id), ...data.specs.map(entry => entry.id),
      ...data.stories.map(entry => entry.id), ...data.pages.map(entry => entry.id), ...data.objects.map(entry => entry.id), ...data.operations.map(entry => entry.id), ...data.access.map(entry => entry.id)];
    return ids.map(id => ({ id, label: `${this.ctx.refInfo(id)?.kindLabel}: ${this.ctx.refInfo(id)?.label}` })).filter(option => !this.draft.reads.includes(option.id));
  });
  draft: Draft = this.blank();
  roleDraft = ''; roleWhy = '';

  constructor() {
    // /work/roles/<action> opens that action's setup and scrolls to it.
    effect(() => {
      const focus = this.focus();
      untracked(() => {
        const action = focus && this.ctx.actionById().get(focus);
        if (!action) return;
        this.open(action);
        setTimeout(() => document.getElementById(`action-${action.id}`)?.scrollIntoView({ block: 'center' }), 60);
      });
    });
  }

  private blank(): Draft { return { instructions: '', reads: [], changes: [], tools: [], asks: '', phases: '', checks: '', rationale: '', newChange: '', attach: '' }; }
  private open(action: WorkAction) {
    this.draft = { instructions: action.instructions, reads: [...action.reads], changes: [...action.changes], tools: [...action.tools], asks: action.asks, phases: action.phases.join('\n'), checks: action.checks.join('\n'), rationale: '', newChange: '', attach: '' };
    this.openAction.set(action.id);
  }
  toggle(action: WorkAction) { if (this.openAction() === action.id) this.openAction.set(null); else this.open(action); }
  readonly layerIcon: Record<string, string> = { product: 'lightbulb', design: 'palette', pages: 'web', data: 'schema', platform: 'dns', work: 'checklist' };
  memberName(id: string) { return id === this.ctx.me() ? 'You' : this.ctx.memberById().get(id)?.name.split(' ')[0] || 'Someone'; }
  // The shield: elevated actions are for leads of the role (ROADMAP-01, DEC-043).
  elevate(action: WorkAction) {
    if (!action.recordId) return;
    void this.ctx.write(() => this.ctx.change(action.recordId!, { elevated: !action.elevated }, action.revision, `${action.name} is now ${action.elevated ? 'for any member' : 'for leads only'}`),
      action.elevated ? `${action.name}: any member of the role.` : `${action.name}: leads only.`);
  }
  without(list: string[], value: string) { return list.filter(entry => entry !== value); }
  attach() { if (this.draft.attach) { this.draft.reads = [...this.draft.reads, this.draft.attach]; this.draft.attach = ''; } }
  addChange() { const value = this.draft.newChange.trim(); if (value && !this.draft.changes.includes(value)) this.draft.changes = [...this.draft.changes, value]; this.draft.newChange = ''; }
  toggleTool(tool: string, on: boolean) { this.draft.tools = on ? [...this.draft.tools, tool] : this.without(this.draft.tools, tool); }
  roleToggled(role: Role, event: Event) { if ((event.target as HTMLDetailsElement).open) { this.editingRole.set(role.layer); this.roleDraft = role.instructions; this.roleWhy = ''; } }
  saveRole(role: Role) {
    if (!role.id) return;
    void this.ctx.write(() => this.ctx.change(role.id!, { instructions: this.roleDraft }, role.revision, this.roleWhy || `${role.name} instructions revised`), `${role.name} instructions saved. New runs use them.`);
  }
  saveAction(action: WorkAction) {
    if (!action.recordId) return;
    const data = { instructions: this.draft.instructions, reads: this.draft.reads, changes: this.draft.changes, tools: this.draft.tools, asks: this.draft.asks, phases: lines(this.draft.phases), checks: lines(this.draft.checks) };
    void this.ctx.write(() => this.ctx.change(action.recordId!, data, action.revision, this.draft.rationale || `${action.name} setup revised`), `${action.name} saved. New work and runs use it.`)
      .then(saved => { if (saved) { const fresh = this.ctx.actionById().get(action.id); if (fresh) this.open(fresh); } });
  }
  assign(action: WorkAction, assignee: Assignee) {
    if (!action.recordId) return;
    void this.ctx.write(() => this.ctx.change(action.recordId!, { assignee: { kind: assignee.kind, id: assignee.id } }, action.revision, `${action.name} now goes to ${this.ctx.whoName(assignee)}`),
      `New “${action.name}” items go to ${this.ctx.whoName(assignee)}. Existing items keep their assignee.`);
  }
}
