import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';

// W-33 (MULTI-REPO-ITEMS-01): the repositories a project owns, in its settings. The primary is the project's GitHub
// repository; companions sit beside its checkout. An item can change any of them, on the branches listed as its lines.
interface Reference { file: string; repository: string; at: string }
interface Check { name: string; run: string }
interface Repository {
  key: string; primary: boolean; url: string | null; path: string; lines: string[]; references: Reference[]; checks: Check[];
  access: { state: string; detail: string | null; checkedAt: string | null };
}
interface Draft { key: string; url: string; path: string; lines: string; references: Reference[]; checks: Check[]; isNew: boolean; primary: boolean }

@Component({
  selector: 'aludel-project-repositories', standalone: true, imports: [FormsModule, MatIconModule],
  template: `
  <section class="lay-card lay-wide" aria-labelledby="repos-title">
    <div class="lay-row lay-wrap"><h2 id="repos-title" class="lay-flat">Repositories</h2>
      @if (canManage() && !draft()) { <button type="button" class="lay-button small lay-push" (click)="startNew()"><mat-icon aria-hidden="true">add</mat-icon>Add a repository</button> }</div>
    <p class="lay-muted">An item can change any of these as one change: they're checked out side by side in its container, reported and reviewed together, and closed out together or not at all.</p>
    <ul class="lay-list">
      @for (repo of repositories(); track repo.key) {
        <li class="lay-repo">
          <div class="lay-row lay-wrap"><mat-icon aria-hidden="true">{{ repo.primary ? 'home_storage' : 'folder_copy' }}</mat-icon>
            <strong>{{ repo.key }}</strong>@if (repo.primary) { <span class="lay-chip lay-plain">The project's own</span> }
            <span [class]="'lay-chip ' + accessClass(repo.access.state)">{{ accessLabel(repo.access.state) }}</span>
            @if (canManage()) { <span class="lay-push lay-row">
              @if (!repo.primary) { <button type="button" class="lay-button ghost small" (click)="check(repo)" [disabled]="busy()">Check access</button> }
              <button type="button" class="lay-button ghost small" (click)="edit(repo)" [disabled]="busy()">Edit</button>
              @if (!repo.primary) { <button type="button" class="lay-button ghost small" (click)="remove(repo)" [disabled]="busy()">Remove</button> }</span> }</div>
          <dl class="lay-kv small">
            <dt>Clone URL</dt><dd>@if (repo.url) { <code>{{ repo.url }}</code> } @else { <span class="lay-muted">No GitHub repository yet</span> }</dd>
            <dt>Checked out at</dt><dd>@if (repo.path === '.') { The project’s folder } @else { <code>{{ repo.path }}</code> }</dd>
            <dt>Lines</dt><dd>@for (line of repo.lines; track line; let first = $first, last = $last) { <code>{{ line }}</code>@if (first && repo.lines.length > 1) {<span class="lay-muted">&nbsp;(default)</span>}@if (!last) {<span>, </span>} }</dd>
            @if (repo.references.length) { <dt>Pins</dt><dd>@for (ref of repo.references; track $index) { <div><code>{{ ref.file }}</code> → {{ ref.repository }} at <code>{{ ref.at }}</code></div> }</dd> }
            @if (repo.checks.length) { <dt>Close-out checks</dt><dd>@for (c of repo.checks; track $index) { <div>{{ c.name }}: <code>{{ c.run }}</code></div> }</dd> }
          </dl>
          @if (repo.access.detail) { <p class="small lay-flat" [class.lay-bad-text]="accessClass(repo.access.state) === 'lay-bad'">{{ repo.access.detail }}</p> }
        </li>
      } @empty { <li class="lay-muted">Loading…</li> }
    </ul>
    @if (draft(); as d) {
      <form class="lay-repo-form" (submit)="save($event)" aria-label="Repository">
        <h3>{{ d.isNew ? 'Add a repository' : 'Edit ' + d.key }}</h3>
        @if (!d.primary) {
          <div class="lay-pa-two">
            <label class="lay-pa-field">Name <input name="key" [(ngModel)]="d.key" [readonly]="!d.isNew" required maxlength="40" placeholder="design-kit"></label>
            <label class="lay-pa-field">Folder beside the project <input name="path" [(ngModel)]="d.path" maxlength="400" [placeholder]="d.key || 'design-kit'"></label>
          </div>
          <label class="lay-pa-field">Clone URL <input name="url" [(ngModel)]="d.url" required maxlength="400" placeholder="https://github.com/owner/name.git"></label>
          <label class="lay-pa-field">Lines items may change, default first <input name="lines" [(ngModel)]="d.lines" required placeholder="main, design, pages"></label>
        } @else { <p class="lay-muted small">The project's own repository follows its GitHub connection. Here you set what close-out checks in it.</p> }
        <fieldset class="lay-repo-set"><legend>Pins into other repositories</legend>
          <p class="lay-muted small">A JSON file here that names commits on another repository's lines. Close-out checks each one is on its line. Entries have <code>branch</code> and <code>commit</code>.</p>
          @for (ref of d.references; track $index; let i = $index) {
            <div class="lay-row lay-wrap">
              <label class="lay-pa-field">File <input [name]="'ref-file-' + i" [(ngModel)]="ref.file" placeholder="config/pins.json"></label>
              <label class="lay-pa-field">Repository <select [name]="'ref-repo-' + i" [(ngModel)]="ref.repository">@for (key of keys(); track key) { <option [value]="key">{{ key }}</option> }</select></label>
              <label class="lay-pa-field">Entries at <input [name]="'ref-at-' + i" [(ngModel)]="ref.at" placeholder="templates.*"></label>
              <button type="button" class="lay-button ghost small" (click)="d.references.splice(i, 1)" [attr.aria-label]="'Remove pin ' + (i + 1)"><mat-icon aria-hidden="true">close</mat-icon></button>
            </div>
          }
          <button type="button" class="lay-button ghost small" (click)="d.references.push({ file: '', repository: keys()[0] || '', at: '' })">Add pins</button>
        </fieldset>
        <fieldset class="lay-repo-set"><legend>Close-out checks</legend>
          <p class="lay-muted small">Commands run over the merged repositories in a sealed container, with no network and no credentials. A failure stops close-out.</p>
          @for (c of d.checks; track $index; let i = $index) {
            <div class="lay-row lay-wrap">
              <label class="lay-pa-field">Name <input [name]="'check-name-' + i" [(ngModel)]="c.name" placeholder="Reviewed digests"></label>
              <label class="lay-pa-field lay-grow">Command <input [name]="'check-run-' + i" [(ngModel)]="c.run" placeholder="node tools/check.mjs"></label>
              <button type="button" class="lay-button ghost small" (click)="d.checks.splice(i, 1)" [attr.aria-label]="'Remove check ' + (i + 1)"><mat-icon aria-hidden="true">close</mat-icon></button>
            </div>
          }
          <button type="button" class="lay-button ghost small" (click)="d.checks.push({ name: '', run: '' })">Add a check</button>
        </fieldset>
        <div class="lay-row"><button type="submit" class="lay-button" [disabled]="busy()">{{ d.isNew ? 'Add and check access' : 'Save' }}</button>
          <button type="button" class="lay-button ghost" (click)="draft.set(null)">Cancel</button></div>
      </form>
    }
  </section>`,
  styles: [`.lay-repo{display:grid;gap:6px;padding:12px 0;border-bottom:1px solid var(--mat-sys-outline-variant)}.lay-repo:last-child{border-bottom:0}
    .lay-repo-form{display:grid;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--mat-sys-outline-variant)}
    .lay-repo-set{border:1px solid var(--mat-sys-outline-variant);border-radius:8px;padding:8px 12px;display:grid;gap:8px;min-width:0}
    .lay-grow{flex:1;min-width:200px}.lay-bad-text{color:var(--mat-sys-error)}`]
})
export class ProjectRepositoriesComponent implements OnInit {
  readonly ctx = inject(ProjectContext);
  readonly repositories = signal<Repository[]>([]);
  readonly draft = signal<Draft | null>(null);
  readonly busy = signal(false);
  readonly canManage = computed(() => this.ctx.session()?.projects.find(project => project.id === this.ctx.projectId())?.role === 'owner');
  readonly keys = computed(() => this.repositories().map(repo => repo.key));
  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/code`; }

  async ngOnInit() { await this.load(); }
  async load() {
    try { this.repositories.set((await this.ctx.api<{ repositories: Repository[] }>(`${this.base()}/repositories`)).repositories); }
    catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  }
  accessLabel(state: string) { return ({ ready: 'Reachable', 'no-access': 'No access', 'missing-lines': 'Lines missing', unchecked: 'Not checked', local: 'Local only' } as Record<string, string>)[state] || state; }
  accessClass(state: string) { return state === 'ready' ? 'lay-ok' : state === 'unchecked' || state === 'local' ? 'lay-plain' : 'lay-bad'; }
  startNew() { this.draft.set({ key: '', url: '', path: '', lines: 'main', references: [], checks: [], isNew: true, primary: false }); }
  edit(repo: Repository) {
    this.draft.set({ key: repo.key, url: repo.url || '', path: repo.path, lines: repo.lines.join(', '), isNew: false, primary: repo.primary,
      references: repo.references.map(ref => ({ ...ref })), checks: repo.checks.map(c => ({ ...c })) });
  }
  async save(event: Event) {
    event.preventDefault();
    const d = this.draft(); if (!d) return;
    this.busy.set(true);
    const body = { key: d.key.trim(), url: d.url.trim(), path: d.path.trim() || d.key.trim(), lines: d.lines.split(',').map(line => line.trim()).filter(Boolean),
      references: d.references.filter(ref => ref.file.trim() || ref.at.trim()), checks: d.checks.filter(c => c.name.trim() || c.run.trim()) };
    const ok = await this.ctx.write(() => this.ctx.api(`${this.base()}/repositories`, 'PUT', body), d.isNew ? `Added ${body.key}.` : `Saved ${body.key}.`);
    this.busy.set(false);
    if (ok) { this.draft.set(null); await this.load(); }
  }
  async check(repo: Repository) {
    this.busy.set(true);
    await this.ctx.write(() => this.ctx.api(`${this.base()}/repositories-check`, 'POST', { key: repo.key }));
    this.busy.set(false); await this.load();
  }
  async remove(repo: Repository) {
    if (!confirm(`Remove ${repo.key} from this project? Its repository on GitHub stays as it is.`)) return;
    this.busy.set(true);
    const ok = await this.ctx.write(() => this.ctx.api(`${this.base()}/repositories?key=${encodeURIComponent(repo.key)}`, 'DELETE'), `Removed ${repo.key}.`);
    this.busy.set(false); if (ok) await this.load();
  }
}
