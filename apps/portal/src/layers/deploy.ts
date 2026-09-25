import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';
import { RefChipComponent } from './work-shared';

// Deploy (PLATFORM-UX-01): where the app runs and whether it is OK. Aludel may be the host, so this operates the
// environments it runs; everything else is shown as not set up rather than imitated. The Operator role owns it.
interface Build { id: string; number: number; commit: string | null; environment: string; state: string; checks: { name: string; state: string }[]; stories: string[]; backup: string | null; startedAt: string; finishedAt: string | null; }
interface Backup { name: string; at: string; reason: string; size: number; }
interface Variable { name: string; value: string; description: string; secret: boolean; }
interface Grid { columns: string[]; masked: string[]; rows: unknown[][]; truncated?: boolean; ms?: number; }
interface DeployInfo {
  releases: Build[]; database: { exists: boolean; engine: string; path: string; size?: number; integrity?: string; tables?: { name: string; rows: number }[]; checkedAt?: string };
  backups: Backup[]; health: { ok: boolean; status: number | null; ms: number | null; checkedAt: string }; domains: { preview: string; base: string }; variables: { declared: boolean; variables: Variable[] };
}
const buildState: Record<string, [string, string]> = { building: ['lay-plain', 'Building'], passed: ['lay-ok', 'Healthy'], failed: ['lay-bad', 'Failed'] };

@Component({
  selector: 'aludel-deploy-layer', standalone: true,
  imports: [FormsModule, MatIconModule, NgTemplateOutlet, RefChipComponent],
  template: `
  <p class="lay-eyebrow">Deploy · where it runs</p>
  <h1 tabindex="-1">{{ titles[tab()] }}</h1>
  <nav class="lay-tabs" aria-label="Deploy sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('deploy', entry[0])" (click)="ctx.go(ctx.link('deploy', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }
  </nav>
  @switch (tab()) {
    @case ('environments') {
      <p class="lay-lead">Where {{ ctx.setup()?.project?.name }} runs and what each place runs. Each environment runs the app's own container, built from its Dockerfile.</p>
      <div class="lay-cx-pipe">
        <section class="lay-cx-stage"><h2><mat-icon aria-hidden="true">science</mat-icon>Preview</h2>
          <a class="lay-cx-env" [class.lay-cx-on]="env() === 'preview'" [href]="ctx.link('deploy', 'environments', 'preview')" (click)="ctx.go(ctx.link('deploy', 'environments', 'preview'), $event)">
            <span class="lay-row"><strong>Preview</strong><span class="lay-chip lay-push" [class.lay-ok]="preview()?.status === 'running'" [class.lay-bad]="preview()?.status === 'failed'" [class.lay-plain]="!['running', 'failed'].includes(preview()?.status || '')">{{ previewLabel() }}</span></span>
            <small>{{ releaseFor(preview()?.commit) ? 'v' + releaseFor(preview()?.commit) : 'Commit ' + (preview()?.commit || '—').slice(0, 7) }} · this machine</small><small>{{ host(ctx.setup()?.urls?.app) }}</small></a></section>
        <section class="lay-cx-stage"><h2><mat-icon aria-hidden="true">public</mat-icon>Production</h2>
          <a class="lay-cx-env lay-cx-dashed" [class.lay-cx-on]="env() === 'production'" [href]="ctx.link('deploy', 'environments', 'production')" (click)="ctx.go(ctx.link('deploy', 'environments', 'production'), $event)">
            <span class="lay-row"><strong>Production</strong><span class="lay-chip lay-plain lay-push">Not set up</span></span><small>Choose where it runs first. Hosting may cost money, so it needs your OK.</small></a></section>
      </div>
      @if (env() === 'preview') {
        <nav class="lay-tabs lay-gap-top" aria-label="Preview sections">@for (entry of envTabs; track entry[0]) { <a [href]="ctx.link('deploy', 'environments', 'preview', entry[0])" (click)="ctx.go(ctx.link('deploy', 'environments', 'preview', entry[0]), $event)" [class.active]="envTab() === entry[0]" [attr.aria-current]="envTab() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }</nav>
        @switch (envTab()) {
          @case ('history') {
            <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Preview builds"><table><thead><tr><th>#</th><th>Commit</th><th>Release</th><th>Checks</th><th>When</th><th>State</th></tr></thead><tbody>
              @for (build of info()?.releases || []; track build.id) { <tr><td>{{ build.number }}</td><td><code>{{ (build.commit || '—').slice(0, 7) }}</code></td><td>{{ releaseFor(build.commit) ? 'v' + releaseFor(build.commit) : '—' }}</td>
                <td class="small">@for (check of build.checks; track check.name) { <span class="lay-block">{{ check.name }}: {{ check.state }}</span> }</td><td class="small">{{ when(build.startedAt) }}{{ build.backup ? ' · backed up first' : '' }}</td><td><span [class]="'lay-chip ' + buildState[build.state][0]">{{ buildState[build.state][1] }}</span></td></tr> }
              @empty { <tr><td colspan="6" class="lay-muted">No builds yet.</td></tr> }</tbody></table></div>
            <p class="lay-muted small">Each build of the preview is listed here. A release is something else: a version you record on purpose in Code › Releases.</p>
          }
          @case ('settings') {
            <div class="lay-grid lay-g2">
              <section class="lay-card"><h2>Hosting</h2><dl class="lay-kv"><dt>Where</dt><dd>This machine, one container ({{ ctx.setup()?.preview?.status === 'running' ? 'running' : 'started when opened' }})</dd><dt>Address</dt><dd><code>{{ host(ctx.setup()?.urls?.app) }}</code></dd><dt>Data</dt><dd>The workspace's <code>.data</code> folder, mounted as <code>/data</code></dd></dl></section>
              <section class="lay-card"><h2>Leaving Aludel</h2><p class="small lay-flat">How the app builds and runs is in its repository: <code>Dockerfile</code>, <code>compose.yaml</code> and <code>.env.example</code>. Run <code>docker compose up --build</code> anywhere. Backups can be downloaded from Data.</p></section>
            </div>
          }
          @default {
            <div class="lay-grid lay-g2">
              <section class="lay-card"><h2>Now running</h2><dl class="lay-kv">
                <dt>Status</dt><dd><span class="lay-chip" [class.lay-ok]="preview()?.status === 'running'" [class.lay-plain]="preview()?.status !== 'running'">{{ previewLabel() }}</span></dd>
                <dt>Commit</dt><dd><code>{{ (preview()?.commit || '—').slice(0, 7) }}</code>{{ releaseFor(preview()?.commit) ? ' · release v' + releaseFor(preview()?.commit) : ' · not a recorded release' }}</dd>
                <dt>Health</dt><dd class="small">{{ healthText() }}</dd>
                <dt>Address</dt><dd><a [href]="ctx.setup()?.urls?.app" target="_blank" rel="noopener">{{ host(ctx.setup()?.urls?.app) }}</a></dd></dl>
                <div class="lay-row lay-wrap lay-gap-top"><button type="button" class="lay-button small" (click)="rebuild()"><mat-icon aria-hidden="true">refresh</mat-icon>Rebuild from current records</button><span class="lay-muted small">Commits the regenerated code, then builds. The preview database is backed up first.</span></div></section>
              <section class="lay-card"><h2>Build log</h2>@if (preview()?.log) { <pre class="lay-code lay-cx-log" tabindex="0" role="region" aria-label="Build log">{{ tail(preview()?.log) }}</pre> } @else { <p class="lay-muted small">No build yet.</p> }</section>
            </div>
          }
        }
      } @else {
        <section class="lay-card lay-quiet lay-gap-top"><h2>Production is not set up</h2>
          <p class="small">It will run the same image as the preview, with its own variables, database and address. Choose one when you are ready:</p>
          <ul class="small lay-cx-plain"><li><b>Aludel hosts it</b> on its server, as a subdomain, with limits set by the server.</li><li><b>Your own server</b> runs the image with docker compose.</li><li><b>A platform</b> (Render, Fly.io, Railway) runs the image; Aludel shows what it reports.</li></ul>
          <button type="button" class="lay-button small" (click)="askOperator('Choose where Production runs', 'Hosting options, their cost and how to undo each')"><mat-icon aria-hidden="true">send</mat-icon>Ask the Operator to propose one</button>
          <p class="lay-muted small">Promoting a release to Production, rolling back and protection rules arrive with it.</p></section>
      }
    }
    @case ('variables') {
      <p class="lay-lead">The variables the app reads, from <code>.env.example</code> in its repository. Values live per environment and are never committed; secrets can be replaced, never shown.</p>
      @if (info()?.variables?.declared) {
        <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Variables"><table><thead><tr><th>Variable</th><th>Preview</th><th>Production</th></tr></thead><tbody>
          @for (v of info()?.variables?.variables || []; track v.name) { <tr><td><code><strong>{{ v.name }}</strong></code>@if (v.secret) { <span class="lay-chip lay-plain">Secret</span> }<br><small class="lay-muted">{{ v.description }}</small></td>
            <td>@if (v.secret) { <span class="lay-muted small">Not set</span> } @else { <code>{{ v.value || '—' }}</code> }</td><td><span class="lay-muted small">Not set up</span></td></tr> }
          @empty { <tr><td colspan="3" class="lay-muted">.env.example lists no variables.</td></tr> }</tbody></table></div>
        <p class="lay-muted small">Preview uses the values in <code>.env.example</code>, which are what the container defaults to. A variable the code reads but <code>.env.example</code> doesn't list is a Code problem: add it there.</p>
      } @else { <section class="lay-card lay-quiet"><p class="lay-flat">The app has no <code>.env.example</code> yet, so it declares no variables.</p></section> }
    }
    @case ('integrations') {
      <p class="lay-lead">Services outside the app that each environment connects to. The code calls them; which provider and which account is chosen here. Free tiers first; anything paid needs your OK.</p>
      <div class="lay-grid lay-g2">
        <section class="lay-card"><div class="lay-row"><mat-icon aria-hidden="true">language</mat-icon><h2 class="lay-flat">Domains</h2></div>
          <dl class="lay-kv lay-cx-kv"><dt>Preview</dt><dd><code>{{ host(ctx.setup()?.urls?.app) }}</code></dd><dt>Production</dt><dd class="lay-muted small">A custom domain needs Production first</dd></dl>
          <p class="lay-muted small">Aludel will show the records to add at your registrar and check them. It never buys a domain or changes DNS for you.</p></section>
        <section class="lay-card"><div class="lay-row"><mat-icon aria-hidden="true">folder</mat-icon><h2 class="lay-flat">File storage</h2><span class="lay-chip lay-ok lay-push">Data volume</span></div>
          <p class="small lay-flat">Uploaded files and the database live on the environment's data volume (<code>DATA_DIR</code>). What is stored, and who may see it, is defined in Data.</p></section>
        @for (service of services(); track service.key) {
          <section class="lay-card"><div class="lay-row"><mat-icon aria-hidden="true">{{ service.icon }}</mat-icon><h2 class="lay-flat">{{ service.label }}</h2><span class="lay-chip lay-warn lay-push">Not connected</span></div>
            <p class="small">Needed by @for (id of service.stories; track id) { <aludel-ref [id]="id" /> }</p>
            <button type="button" class="lay-button ghost small" (click)="askOperator('Choose a provider for ' + service.label, 'Providers with a free tier first, their cost, and the variables they need')"><mat-icon aria-hidden="true">add_link</mat-icon>Ask the Operator to choose a provider</button></section>
        }
      </div>
    }
    @case ('data') {
      <p class="lay-muted small">Environment: <strong>Preview</strong> ({{ info()?.database?.engine || 'SQLite' }}, <code>{{ info()?.database?.path }}</code>). Production appears once it exists.</p>
      <div class="lay-toggle lay-block" role="group" aria-label="Database views">@for (entry of databaseParts; track entry[0]) { <a [href]="ctx.link('deploy', 'data', entry[0])" (click)="ctx.go(ctx.link('deploy', 'data', entry[0]), $event)" [class.on]="dbPart() === entry[0]" [attr.aria-current]="dbPart() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }</div>
      @if (!info()?.database?.exists) { <p class="lay-card lay-quiet">No database yet. The preview creates one the first time it stores something, such as a sign-up.</p> }
      @else {
        @switch (dbPart()) {
          @case ('migrations') {
            <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Schema"><table><thead><tr><th>Name</th><th>Type</th><th>Realises</th><th>Definition</th></tr></thead><tbody>
              @for (entry of schema(); track entry.name) { <tr><td><code>{{ entry.name }}</code></td><td>{{ entry.type }}</td><td>@if (realises(entry.name); as object) { <aludel-ref [id]="object.id" /> } @else { <span class="lay-muted">—</span> }</td><td><pre class="lay-code lay-code-inline">{{ entry.sql }}</pre></td></tr> }</tbody></table></div>
            <p class="lay-muted small">The schema as the preview database has it now. aludel-web-v1 creates its tables at start-up; numbered migrations arrive when a stack preset writes them.</p>
          }
          @case ('browse') {
            <div class="lay-row lay-wrap lay-block">@for (table of info()?.database?.tables || []; track table.name) { <a [href]="ctx.link('deploy', 'data', 'browse', table.name)" (click)="ctx.go(ctx.link('deploy', 'data', 'browse', table.name), $event)" [class]="'lay-chip ' + (browseTable() === table.name ? 'lay-l-deploy' : 'lay-plain')" [attr.aria-current]="browseTable() === table.name ? 'page' : null">{{ table.name }}</a> }</div>
            @if (grid(); as result) { <ng-container *ngTemplateOutlet="gridView; context: { $implicit: result, label: browseTable() }" /> }
            <p class="lay-muted small">Read-only, first 50 rows. Columns that hold secrets (hashes, salts, tokens) are never sent to your browser.</p>
          }
          @case ('query') {
            <form class="lay-card lay-form" (ngSubmit)="runQuery()"><label>Read-only query · one SELECT, 200 rows at most<textarea name="sql" rows="3" class="lay-mono" [(ngModel)]="sql"></textarea></label>
              <div class="lay-row"><button type="submit" class="lay-button small"><mat-icon aria-hidden="true">play_arrow</mat-icon>Run</button>@if (queryResult(); as result) { <span class="lay-muted small">{{ result.rows.length }} rows{{ result.truncated ? ' (limit reached)' : '' }} · {{ result.ms }} ms</span> }</div>
              @if (queryError()) { <p class="error-message" role="alert">{{ queryError() }}</p> }</form>
            @if (queryResult(); as result) { <ng-container *ngTemplateOutlet="gridView; context: { $implicit: result, label: 'Query result' }" /> }
          }
          @default {
            <div class="lay-grid lay-g2">
              <section class="lay-card"><h2>Health</h2><dl class="lay-kv"><dt>Engine</dt><dd>SQLite · one file</dd><dt>Size</dt><dd>{{ size(info()?.database?.size) }}</dd>
                <dt>Integrity</dt><dd><span class="lay-chip" [class.lay-ok]="info()?.database?.integrity === 'ok'" [class.lay-bad]="info()?.database?.integrity !== 'ok'">{{ info()?.database?.integrity === 'ok' ? 'OK' : info()?.database?.integrity }}</span> checked {{ when(info()?.database?.checkedAt) }}</dd>
                <dt>Tables</dt><dd>@for (table of info()?.database?.tables || []; track table.name) { {{ table.name }} {{ table.rows }}{{ $last ? '' : ' · ' }} }</dd></dl></section>
              <section class="lay-card"><h2>Backups</h2>
                <ul class="lay-list">@for (backup of info()?.backups || []; track backup.name) { <li class="lay-item lay-wrap"><mat-icon aria-hidden="true">backup</mat-icon><span class="lay-body-text"><strong>{{ when(backup.at) }}</strong><small>{{ backup.reason }} · {{ size(backup.size) }}</small></span>
                  @if (confirming() === backup.name) { <span class="lay-row"><button type="button" class="lay-button small" (click)="restore(backup.name)">Restore it</button><button type="button" class="lay-link-button" (click)="confirming.set('')">Cancel</button></span> }
                  @else { <button type="button" class="lay-button ghost small" (click)="confirming.set(backup.name)" [attr.aria-label]="'Restore the backup from ' + when(backup.at)">Restore…</button> }
                  @if (confirming() === backup.name) { <p class="lay-note lay-full" role="status">This replaces the preview database with this backup. Aludel takes a fresh backup first and restarts the preview.</p> }</li> }
                  @empty { <li class="lay-muted lay-pad">No backups yet.</li> }</ul>
                <div class="lay-row"><button type="button" class="lay-button small" (click)="backupNow()"><mat-icon aria-hidden="true">backup</mat-icon>Back up now</button></div>
                <p class="lay-muted small">A backup is taken before every build. Backups stay on this machine, outside the repository.</p></section>
            </div>
          }
        }
      }
    }
  }
  <ng-template #gridView let-result let-label="label">
    <div class="lay-table-wrap" tabindex="0" role="region" [attr.aria-label]="label"><table><thead><tr>@for (column of result.columns; track $index) { <th>{{ column }}</th> }</tr></thead><tbody>
      @for (row of result.rows; track $index) { <tr>@for (value of row; track $index) { <td>@if (result.masked.includes(result.columns[$index])) { <span class="lay-masked" title="Hidden: secret column">hidden</span> } @else { {{ value === null ? 'null' : value }} }</td> }</tr> }
      @empty { <tr><td [attr.colspan]="result.columns.length || 1" class="lay-muted">No rows.</td></tr> }</tbody></table></div>
  </ng-template>`
})
export class DeployLayerComponent implements OnInit {
  readonly ctx = inject(ProjectContext);
  readonly tabs = [['environments', 'Environments'], ['variables', 'Variables'], ['integrations', 'Integrations'], ['data', 'Data']];
  readonly titles: Record<string, string> = { environments: 'Environments', variables: 'Variables', integrations: 'Integrations', data: 'Data' };
  readonly envTabs = [['overview', 'Overview'], ['history', 'History'], ['settings', 'Settings']];
  readonly databaseParts = [['health', 'Health & backups'], ['migrations', 'Schema'], ['browse', 'Browse'], ['query', 'Query']];
  readonly buildState = buildState;
  readonly info = signal<DeployInfo | null>(null);
  readonly releases = signal<{ version: string; commit: string }[]>([]);
  readonly schema = signal<{ type: string; name: string; tableName: string; sql: string }[]>([]);
  readonly grid = signal<Grid | null>(null);
  readonly queryResult = signal<Grid | null>(null);
  readonly queryError = signal('');
  readonly confirming = signal('');
  sql = 'SELECT name, email, created_at FROM accounts ORDER BY created_at DESC';

  // Old Platform links (/platform/environments, /platform/database/…, /platform/domains) open their Deploy homes.
  private readonly parts = computed(() => { const segments = this.ctx.segments(); const old = segments[0] === 'platform'; const tab = segments[1] || 'environments';
    return { tab: old ? ({ environments: 'environments', database: 'data', domains: 'integrations' } as Record<string, string>)[tab] || 'environments' : this.titles[tab] ? tab : 'environments', rest: segments.slice(2) }; });
  readonly tab = computed(() => this.parts().tab);
  readonly env = computed(() => this.tab() === 'environments' && this.parts().rest[0] === 'production' ? 'production' : 'preview');
  readonly envTab = computed(() => this.tab() === 'environments' ? this.parts().rest[1] || 'overview' : 'overview');
  readonly dbPart = computed(() => this.tab() === 'data' ? this.parts().rest[0] || 'health' : '');
  readonly browseTable = computed(() => this.dbPart() === 'browse' ? this.parts().rest[1] || this.info()?.database?.tables?.[0]?.name || '' : '');
  readonly preview = computed(() => this.ctx.setup()?.preview || null);
  readonly services = computed(() => (this.ctx.data()?.services || []).filter(service => service.stories.length));

  constructor() {
    effect(() => {
      const part = this.dbPart(); const table = this.browseTable();
      untracked(() => { if (part === 'migrations') void this.loadSchema(); if (part === 'browse' && table) void this.loadBrowse(table); });
    });
  }
  async ngOnInit() { await this.load(); }
  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}`; }
  async load() {
    try { this.info.set(await this.ctx.api<DeployInfo>(`${this.base()}/platform`)); } catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
    try { this.releases.set((await this.ctx.api<{ releases: { version: string; commit: string }[] }>(`${this.base()}/code/releases`)).releases); } catch { this.releases.set([]); }
  }
  async loadSchema() { try { this.schema.set((await this.ctx.api<{ schema: { type: string; name: string; tableName: string; sql: string }[] }>(`${this.base()}/database/schema`)).schema); } catch { this.schema.set([]); } }
  async loadBrowse(table: string) { try { this.grid.set(await this.ctx.api<Grid>(`${this.base()}/database/browse?table=${encodeURIComponent(table)}`)); } catch (error) { this.grid.set(null); this.ctx.error.set(error instanceof Error ? error.message : String(error)); } }
  async runQuery() {
    this.queryError.set('');
    try { this.queryResult.set(await this.ctx.api<Grid>(`${this.base()}/database/query`, 'POST', { sql: this.sql })); }
    catch (error) { this.queryResult.set(null); this.queryError.set(error instanceof Error ? error.message : String(error)); }
  }
  backupNow() { void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/database/backups`, 'POST', {}); await this.load(); }, 'Backed up.'); }
  restore(name: string) { void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/database/restore`, 'POST', { name, confirm: true }); this.confirming.set(''); await this.load(); }, 'Restored. A backup of the previous state was taken first; the preview restarts when next opened.'); }
  rebuild() { void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/skeleton`, 'POST', {}); await this.load(); }, 'Rebuilding. The preview restarts when the build finishes.'); }
  askOperator(title: string, suggestion: string) { void this.ctx.write(() => this.ctx.api(`${this.base()}/work`, 'POST', { action: 'deploy.configure', title, targets: [], suggestion }), 'Added to Work for the Operator.'); }
  realises(table: string) { const units = this.ctx.data()?.code.units || []; return (this.ctx.data()?.objects || []).find(object => units.some(unit => unit.kind === 'table' && unit.symbol === `table ${table}` && unit.links.some(link => link.recordId === object.id))) || null; }
  releaseFor(commit: string | null | undefined) { if (!commit) return ''; return this.releases().find(r => commit.startsWith(r.commit) || r.commit.startsWith(commit.slice(0, 7)))?.version || ''; }
  previewLabel() { const status = this.preview()?.status; return status === 'running' ? 'Running' : status === 'stopped' ? 'Built' : status === 'building' ? 'Building' : status === 'failed' ? 'Failed' : 'Not built'; }
  healthText() { const health = this.info()?.health; return health?.ok ? `/api/health ${health.status} · ${health.ms} ms` : this.preview()?.status === 'running' ? 'Not answering' : 'Starts when opened'; }
  host(url: string | undefined) { return String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, ''); }
  tail(log: string | undefined) { return String(log || '').split('\n').slice(-40).join('\n'); }
  size(bytes: number | undefined) { return bytes === undefined ? '—' : bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`; }
  when(at: string | undefined) { return at ? new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
}
