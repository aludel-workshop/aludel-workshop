import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Assignee, Page, ProjectContext } from './context';
import { SpecDraft } from './pages-model';

// A change to how a built page looks or behaves (PAGES-UX-01, P8). The spec is revised with the reason, and the change
// goes to Work as coding work: Platform › Engineer › implement, assignable to a particular coding agent.
@Component({
  selector: 'aludel-page-change', standalone: true,
  imports: [FormsModule, MatIconModule],
  template: `
  <div class="lay-pg-scrim" (click)="closed.emit()"></div>
  <aside class="lay-pg-drawer" role="dialog" aria-modal="true" aria-labelledby="pg-change-title">
    <div class="lay-row"><span class="lay-chip lay-l-pages"><mat-icon aria-hidden="true">edit_note</mat-icon>Change request</span><span class="lay-chip lay-plain">{{ page().label }}</span>
      <button type="button" class="lay-icon-button lay-push" (click)="closed.emit()" aria-label="Close"><mat-icon aria-hidden="true">close</mat-icon></button></div>
    <h2 id="pg-change-title">{{ draft() ? 'Request this change' : 'Request a change' }}</h2>
    <form class="lay-form" (ngSubmit)="send()">
      <label>Title<input name="title" [(ngModel)]="title" maxlength="160" required></label>
      <label>What should change, and why<textarea name="why" rows="4" [(ngModel)]="why" placeholder="Describe it the way you’d tell a designer."></textarea></label>
      <h3>Spec changes</h3>
      @if (summary().length) {
        <ul class="lay-pg-diff">@for (line of summary(); track $index) { <li>{{ line }}</li> }</ul>
        <p class="lay-muted small">Saving adds revision {{ page().revision + 1 }} of the spec with your reason. Built shows the difference until the build catches up.</p>
      } @else {
        <p class="lay-muted small">None attached: the Engineer works from your description{{ draft() ? '' : ' and the current spec' }}. To attach the exact change, close this and use Edit spec.</p>
      }
      <h3>Goes to</h3>
      <div class="lay-pg-route"><mat-icon aria-hidden="true">code</mat-icon><div><strong>Work · Engineer · implement</strong><span>Coding work. It carries the spec revision, the stories and their acceptance.</span></div></div>
      <label>Assign to<select name="assignee" [(ngModel)]="assignee">
        <option value="">Engineer role’s default</option>
        @for (profile of agents(); track profile.id) { <option [value]="'agent:' + profile.id">{{ profile.name }} (agent)</option> }
        <option [value]="'person:' + ctx.me()">You</option>
      </select></label>
      @if (error()) { <p class="lay-error" role="alert">{{ error() }}</p> }
      <div class="lay-row"><button type="submit" class="lay-button" [disabled]="busy() || !title.trim() || (!why.trim() && !summary().length)"><mat-icon aria-hidden="true">add_task</mat-icon>Add to Work</button><button type="button" class="lay-button ghost" (click)="closed.emit()">Cancel</button></div>
    </form>
  </aside>`
})
export class PageChangeComponent {
  readonly ctx = inject(ProjectContext);
  readonly page = input.required<Page>();
  readonly draft = input<SpecDraft | null>(null);
  readonly summary = input<string[]>([]);
  readonly prefill = input<{ title?: string; why?: string } | null>(null);
  readonly closed = output<void>();
  readonly sent = output<string>();
  readonly agents = computed(() => (this.ctx.data()?.profiles || []).filter(profile => profile.active));
  readonly busy = signal(false);
  readonly error = signal('');
  title = '';
  why = '';
  assignee = '';
  ngOnInit() {
    this.title = this.prefill()?.title || `${this.page().label}: ${this.summary()[0] || ''}`.slice(0, 160).replace(/: $/, ': ');
    this.why = this.prefill()?.why || '';
  }
  async send() {
    this.busy.set(true); this.error.set('');
    const [kind, id] = this.assignee.split(':');
    const assignee: Assignee | undefined = kind ? { kind: kind as Assignee['kind'], id } : undefined;
    const draft = this.draft(), revision = this.page().revision + 1, label = this.page().label;
    try {
      const result = await this.ctx.api<{ work: { ref: string } }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/pages/change`, 'POST', {
        pageId: this.page().id, expectedRevision: this.page().revision, title: this.title.trim(), why: this.why.trim(), summary: this.summary(), assignee,
        changes: draft ? { sections: draft.sections, states: draft.states, pageType: draft.pageType } : undefined });
      await this.ctx.reload();
      this.ctx.notice.set(`${result.work.ref} is in Work as Engineer · implement.${draft ? ` ${label}’s spec is at revision ${revision}.` : ''}`);
      this.sent.emit(result.work.ref);
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.busy.set(false); }
  }
}
