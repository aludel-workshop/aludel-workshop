import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CodeUnit, ProjectContext, dataStatusLabel, layerLabel, statusLabel, unitStateLabel } from './context';

interface Release { id: string; number: number; commit: string | null; environment: string; state: string; checks: { name: string; state: string }[]; stories: string[]; backup: string | null; startedAt: string; finishedAt: string | null; }
interface Backup { name: string; at: string; reason: string; size: number; }
interface PlatformInfo {
  releases: Release[]; repository: { branches: string[]; commits: { hash: string; subject: string; at: string; work: string | null; implements: string | null }[] };
  database: { exists: boolean; engine: string; path: string; size?: number; integrity?: string; tables?: { name: string; rows: number }[]; checkedAt?: string };
  backups: Backup[]; health: { ok: boolean; status: number | null; ms: number | null; checkedAt: string }; domains: { preview: string; base: string };
}
interface Grid { columns: string[]; masked: string[]; rows: unknown[][]; truncated?: boolean; ms?: number; }
// Written as { icon: '…' } entries so tools/subset-icons.py finds every glyph used here.
const unitIcons = [{ kind: 'component', icon: 'web' }, { kind: 'route', icon: 'route' }, { kind: 'handler', icon: 'api' }, { kind: 'table', icon: 'table' }, { kind: 'function', icon: 'function' },
  { kind: 'const', icon: 'data_object' }, { kind: 'class', icon: 'data_object' }, { kind: 'test', icon: 'fact_check' }];
const unitIcon: Record<string, string> = Object.fromEntries(unitIcons.map(entry => [entry.kind, entry.icon]));
const releaseState: Record<string, [string, string]> = { building: ['lay-plain', 'Building'], passed: ['lay-ok', 'Passed'], failed: ['lay-bad', 'Failed'] };

// Platform (LAY-07B, DEC-038): the stack binding and operations. The only layer that names the stack.
@Component({
  selector: 'aludel-platform-layer', standalone: true,
  imports: [FormsModule, MatIconModule, NgTemplateOutlet],
  template: `
  <p class="lay-eyebrow">Platform · engineering and operations</p>
  <h1 tabindex="-1">How it's built and where it runs</h1>
  <nav class="lay-tabs" aria-label="Platform sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('platform', entry[0])" (click)="ctx.go(ctx.link('platform', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }
  </nav>
  @switch (tab()) {
    @case ('architecture') {
      <div class="lay-grid lay-g2">
        <section class="lay-card"><h2>Stack</h2><dl class="lay-kv"><dt>Preset</dt><dd>{{ preset()?.label || ctx.setup()?.stack?.preset }} ({{ ctx.setup()?.stack?.preset }})</dd>
          @for (layer of stackLayers(); track layer[0]) { <dt>{{ layer[0] }}</dt><dd>{{ layer[1] }}</dd> }</dl>
          <p class="lay-muted small">The only place the stack is named. Everything above Platform would survive a stack change.</p></section>
        <section class="lay-card"><h2>Services the app calls</h2><p class="lay-muted small">What stories need at runtime. Nothing is connected until you choose a provider, and a paid one needs your OK.</p>
          <ul class="lay-list">@for (service of services(); track service.key) { <li class="lay-item"><mat-icon aria-hidden="true">{{ service.icon }}</mat-icon><span class="lay-body-text"><strong>{{ service.label }}</strong>
            <small>Needed by @for (id of service.stories; track id) { <a [href]="ctx.link('product', 'map', id)" (click)="ctx.go(ctx.link('product', 'map', id), $event)">{{ ctx.storyById().get(id)?.ref }}</a>{{ $last ? '' : ', ' }} }</small></span><span class="lay-chip lay-warn">Not connected</span></li> }
            @empty { <li class="lay-muted lay-pad">No story needs an outside service yet.</li> }</ul></section>
        <section class="lay-card lay-wide"><h2>Binding: Data to this stack</h2>
          <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Binding"><table><thead><tr><th>Data record</th><th>Realised as</th><th>Where</th><th>State</th></tr></thead><tbody>
            @for (row of binding(); track row.id) { <tr><td><a [href]="row.href" (click)="ctx.go(row.href, $event)">{{ row.label }}</a></td><td>{{ row.as }}</td><td><code>{{ row.where }}</code></td><td><span class="lay-chip" [class.lay-ok]="row.status === 'built'" [class.lay-plain]="row.status !== 'built'">{{ dataStatusLabel[row.status] }}</span></td></tr> }
            @empty { <tr><td colspan="4" class="lay-muted">No Data records yet.</td></tr> }</tbody></table></div>
          <p class="lay-muted small">Read from the code links: a table or handler the template generated, or one a commit declared.</p></section>
      </div>
    }
    @case ('code') {
      @if (unit(); as current) {
        <p class="lay-eyebrow"><a [href]="ctx.link('platform', 'code')" (click)="ctx.go(ctx.link('platform', 'code'), $event)">Code</a> · {{ current.path }}</p>
        <div class="lay-row lay-wrap"><h2 class="lay-flat lay-page-title"><code>{{ current.symbol }}</code></h2><span [class]="'lay-chip ' + stateClass(current.state)">{{ unitStateLabel[current.state] }}</span></div>
        <p class="lay-muted">{{ current.kind }} · line {{ current.line }}{{ current.lastCommit ? ' · last changed in ' + current.lastCommit : '' }} · {{ explain[current.state] }}</p>
        <div class="lay-grid lay-g-side">
          <div>
            <section class="lay-card"><h2>Why it exists</h2>
              <ul class="lay-list">@for (link of current.links; track link.recordId + link.kind + link.source) { <li class="lay-item"><span [class]="'lay-chip lay-l-' + ctx.recordLabel(link.recordId)[2]">{{ layerLabel[ctx.recordLabel(link.recordId)[2]] }}</span>
                <span class="lay-body-text"><a [href]="ctx.recordLabel(link.recordId)[1]" (click)="ctx.go(ctx.recordLabel(link.recordId)[1], $event)">{{ ctx.recordLabel(link.recordId)[0] }}</a>
                  <small>{{ link.kind }} · linked at revision {{ link.revision }} · from the {{ sourceLabel[link.source] }}{{ link.workRef ? ' (' + link.workRef + ')' : '' }}{{ link.state === 'suspect' ? ' · now revision ' + link.currentRevision : '' }}</small></span>
                <span class="lay-chip" [class.lay-warn]="link.state === 'suspect'" [class.lay-ok]="link.state !== 'suspect'">{{ link.state === 'suspect' ? 'Suspect' : 'Current' }}</span></li> }
                @empty { <li class="lay-muted lay-pad">No links. {{ current.state === 'dead' ? 'Nothing uses it and nothing needs it.' : 'Something uses it, but no story or contract says why.' }}</li> }</ul></section>
            <section class="lay-card lay-gap-top"><h2>References</h2><div class="lay-grid lay-g2">
              <div class="lay-connected"><h3>Calls</h3>@for (id of current.calls; track id) { <a [href]="ctx.link('platform', 'code', id)" (click)="ctx.go(ctx.link('platform', 'code', id), $event)"><mat-icon aria-hidden="true">{{ icon(ctx.unitById().get(id)?.kind) }}</mat-icon><code>{{ ctx.unitById().get(id)?.symbol }}</code></a> } @empty { <p class="lay-muted small">Nothing</p> }</div>
              <div class="lay-connected"><h3>Called by</h3>@for (id of current.calledBy; track id) { <a [href]="ctx.link('platform', 'code', id)" (click)="ctx.go(ctx.link('platform', 'code', id), $event)"><mat-icon aria-hidden="true">{{ icon(ctx.unitById().get(id)?.kind) }}</mat-icon><code>{{ ctx.unitById().get(id)?.symbol }}</code></a> } @empty { <p class="lay-muted small">{{ current.reachable ? 'An entry point' : 'Nothing: unreachable' }}</p> }</div></div>
              <p class="lay-muted small">Read from the code after each build. Nobody maintains these by hand.</p></section>
          </div>
          <aside class="lay-card lay-connected"><h2>Tests</h2>@for (test of testsFor(current); track test.id) { <a [href]="ctx.link('platform', 'code', test.id)" (click)="ctx.go(ctx.link('platform', 'code', test.id), $event)"><mat-icon aria-hidden="true">fact_check</mat-icon>{{ test.symbol }}</a> } @empty { <p class="lay-muted small">No test reaches it directly.</p> }
            <h3>Work</h3>@for (item of workFor(current); track item.id) { <a [href]="ctx.link('work', 'item', item.id)" (click)="ctx.go(ctx.link('work', 'item', item.id), $event)">{{ item.ref }} {{ item.title }}</a> } @empty { <p class="lay-muted small">None</p> }</aside>
        </div>
      } @else {
        <p class="lay-lead">Why each piece of code exists, what it touches, and what a change upstream means for it. Links come from the build manifest, commit trailers and test names; references come from reading the code.</p>
        <div class="lay-row lay-wrap lay-block">
          <a [href]="ctx.link('platform', 'code')" (click)="ctx.go(ctx.link('platform', 'code'), $event)" class="lay-chip" [class.lay-l-platform]="!codeFilter()" [class.lay-plain]="codeFilter()">All {{ units().length }}</a>
          @for (state of unitStates; track state) { <a [href]="ctx.link('platform', 'code', 'state', state)" (click)="ctx.go(ctx.link('platform', 'code', 'state', state), $event)" [class]="'lay-chip ' + (codeFilter()?.state === state ? stateClass(state) : 'lay-plain')" [attr.aria-current]="codeFilter()?.state === state ? 'page' : null">{{ unitStateLabel[state] }} {{ count(state) }}</a> }
          <button type="button" class="lay-button ghost small lay-push" (click)="reindex()"><mat-icon aria-hidden="true">refresh</mat-icon>Read the code again</button>
        </div>
        @if (codeFilter()?.recordId; as recordId) {
          <p class="lay-note">Code for <a [href]="ctx.recordLabel(recordId)[1]" (click)="ctx.go(ctx.recordLabel(recordId)[1], $event)">{{ ctx.recordLabel(recordId)[0] }}</a>. <a [href]="ctx.link('platform', 'code')" (click)="ctx.go(ctx.link('platform', 'code'), $event)">Show all</a></p>
        } @else if (!codeFilter()) {
          <section class="lay-card lay-block"><h2>Stories and their code ({{ currentPhase() }})</h2>
            <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Coverage"><table><thead><tr><th>Story</th><th>Status</th><th>Code units</th><th>Tests</th><th>Links</th></tr></thead><tbody>
              @for (row of coverage(); track row.story.id) { <tr><td><a [href]="ctx.link('platform', 'code', 'for', row.story.id)" (click)="ctx.go(ctx.link('platform', 'code', 'for', row.story.id), $event)">{{ row.story.ref }}</a> {{ row.story.title }}</td><td>{{ statusLabel[row.story.status] }}</td><td>{{ row.units || '—' }}</td><td>{{ row.tests || '—' }}</td>
                <td>@if (!row.units && !row.tests) { <span class="lay-muted small">No code yet</span> } @else { <span class="lay-chip" [class.lay-warn]="row.suspect" [class.lay-ok]="!row.suspect">{{ row.suspect ? 'Suspect' : 'Current' }}</span> }</td></tr> }
              @empty { <tr><td colspan="5" class="lay-muted">No stories in this phase.</td></tr> }</tbody></table></div></section>
        }
        <ul class="lay-list lay-card">@for (item of filteredUnits(); track item.id) { <li><a class="lay-item" [href]="ctx.link('platform', 'code', item.id)" (click)="ctx.go(ctx.link('platform', 'code', item.id), $event)"><mat-icon aria-hidden="true">{{ icon(item.kind) }}</mat-icon>
          <span class="lay-body-text"><strong><code>{{ item.symbol }}</code></strong><small>{{ item.path }} · {{ item.kind }}{{ reasons(item) ? ' · for ' + reasons(item) : '' }}</small></span><span [class]="'lay-chip ' + stateClass(item.state)">{{ unitStateLabel[item.state] }}</span></a></li> }
          @empty { <li class="lay-muted lay-pad">{{ units().length ? 'Nothing here.' : 'No code read yet. It is read after each build.' }}</li> }</ul>
      }
    }
    @case ('repository') {
      <div class="lay-grid lay-g2">
        <section class="lay-card"><h2>Repository</h2><dl class="lay-kv"><dt>Location</dt><dd>On this machine · {{ ctx.setup()?.github?.local?.committed ? 'committed' : 'not committed yet' }}</dd>
          <dt>Branches</dt><dd>@for (branch of info()?.repository?.branches || []; track branch) { <code>{{ branch }}</code>{{ $last ? '' : ', ' }} } @empty { — }</dd></dl>
          <h3>GitHub</h3>
          @if (ctx.setup()?.github?.repository; as repo) { <p><a [href]="repo.html_url" target="_blank" rel="noopener">{{ repo.owner }}/{{ repo.name }}</a> ({{ repo.status }})</p> }
          @else { <p class="small">{{ ctx.setup()?.github?.configured ? (ctx.setup()?.github?.connected ? 'Connected as ' + ctx.setup()?.github?.login + '. Not published yet.' : 'Not connected.') : 'The GitHub App is not configured on this Aludel.' }}</p> }
          <a class="lay-button ghost small" [href]="githubHref()"><mat-icon aria-hidden="true">code</mat-icon>{{ ctx.setup()?.github?.repository ? 'Manage GitHub' : 'Publish to GitHub' }}</a></section>
        <section class="lay-card"><h2>Recent commits</h2><ul class="lay-list">@for (commit of info()?.repository?.commits || []; track commit.hash) { <li class="lay-item"><code>{{ commit.hash }}</code><span class="lay-body-text">{{ commit.subject }}
          @if (commit.work || commit.implements) { <small>{{ commit.work ? 'Aludel-Work: ' + commit.work : '' }}{{ commit.work && commit.implements ? ' · ' : '' }}{{ commit.implements ? 'Implements: ' + commit.implements : '' }}</small> }</span></li> }
          @empty { <li class="lay-muted lay-pad">No commits yet.</li> }</ul>
          <p class="lay-muted small">Trailers are how Aludel knows which story each change serves. No tags in the code.</p></section>
      </div>
    }
    @case ('releases') {
      @if (latest(); as release) {
        <section class="lay-card lay-block" aria-labelledby="latest-release"><h2 id="latest-release">Release #{{ release.number }} · <code>{{ (release.commit || '').slice(0, 7) }}</code></h2>
          <ol class="lay-pipeline" aria-label="Pipeline">@for (stage of pipeline(release); track stage[0]) { <li [class]="'lay-stage ' + stage[1]">{{ stage[0] }}{{ stage[1] === 'off' ? ' · not set up' : '' }}</li> }</ol>
          <p class="lay-muted small">Promotion to production is not available: production needs hosting, which needs your OK. When it exists, a release names its stories through code links, and they become Shipped.</p></section>
      }
      <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Releases"><table><thead><tr><th>#</th><th>Commit</th><th>Stories</th><th>Checks</th><th>Where</th><th>State</th></tr></thead><tbody>
        @for (release of info()?.releases || []; track release.id) { <tr><td>{{ release.number }}</td><td><code>{{ (release.commit || '—').slice(0, 7) }}</code></td>
          <td>@for (id of release.stories; track id) { <a [href]="ctx.link('product', 'map', id)" (click)="ctx.go(ctx.link('product', 'map', id), $event)">{{ ctx.storyById().get(id)?.ref || 'removed' }}</a>{{ $last ? '' : ', ' }} } @empty { — }</td>
          <td class="small">@for (check of release.checks; track check.name) { <span class="lay-block">{{ check.name }}: {{ check.state }}</span> }</td>
          <td>{{ release.environment === 'preview' ? 'Preview' : release.environment }}<br><span class="lay-muted small">{{ when(release.startedAt) }}</span></td><td><span [class]="'lay-chip ' + releaseState[release.state][0]">{{ releaseState[release.state][1] }}</span></td></tr> }
        @empty { <tr><td colspan="6" class="lay-muted">No releases yet. Each preview build is one.</td></tr> }</tbody></table></div>
    }
    @case ('environments') {
      <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Environments"><table><thead><tr><th>Environment</th><th>Status</th><th>Build</th><th>Health</th><th>Hosting</th></tr></thead><tbody>
        <tr><td><strong>Preview</strong><br><a class="small" [href]="ctx.setup()?.urls?.app" target="_blank" rel="noopener">{{ ctx.setup()?.urls?.app }}</a></td><td><span class="lay-chip" [class.lay-ok]="preview()?.status === 'running'" [class.lay-plain]="preview()?.status !== 'running'">{{ previewLabel() }}</span></td>
          <td>{{ (preview()?.commit || '—').slice(0, 7) }}</td><td class="small">{{ healthText() }}</td><td class="small">This machine</td></tr>
        <tr><td><strong>Production</strong></td><td><span class="lay-chip lay-plain">Not set up</span></td><td>—</td><td>—</td><td class="small">Choose a host (costs need your OK)</td></tr>
      </tbody></table></div>
      <div class="lay-row lay-wrap lay-gap-top"><button type="button" class="lay-button small" (click)="rebuild()">Rebuild preview from current records</button><span class="lay-muted small">Commits the regenerated code, reads it, then builds. The preview database is backed up first.</span></div>
      @if (preview()?.log) { <details class="lay-log"><summary>Build log</summary><pre>{{ preview()?.log }}</pre></details> }
    }
    @case ('database') {
      <p class="lay-muted small">Environment: <strong>Preview</strong> ({{ info()?.database?.engine || 'SQLite' }}, <code>{{ info()?.database?.path }}</code>). Production appears once it exists.</p>
      <div class="lay-toggle lay-block" role="group" aria-label="Database views">@for (entry of databaseParts; track entry[0]) { <a [href]="ctx.link('platform', 'database', entry[0])" (click)="ctx.go(ctx.link('platform', 'database', entry[0]), $event)" [class.on]="dbPart() === entry[0]" [attr.aria-current]="dbPart() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }</div>
      @if (!info()?.database?.exists) { <p class="lay-card lay-quiet">No database yet. The preview creates one the first time it stores something, such as a sign-up.</p> }
      @else {
        @switch (dbPart()) {
          @case ('migrations') {
            <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Schema"><table><thead><tr><th>Name</th><th>Type</th><th>Realises</th><th>Definition</th></tr></thead><tbody>
              @for (entry of schema(); track entry.name) { <tr><td><code>{{ entry.name }}</code></td><td>{{ entry.type }}</td><td>@if (realises(entry.name); as object) { <a [href]="ctx.link('data', 'objects', object.id)" (click)="ctx.go(ctx.link('data', 'objects', object.id), $event)">{{ object.name }}</a> rev {{ object.revision }} } @else { <span class="lay-muted">—</span> }</td><td><pre class="lay-code lay-code-inline">{{ entry.sql }}</pre></td></tr> }</tbody></table></div>
            <p class="lay-muted small">The schema as the preview database has it now. aludel-web-v1 creates its tables at start-up; numbered migrations arrive when a stack preset writes them.</p>
          }
          @case ('browse') {
            <div class="lay-row lay-wrap lay-block">@for (table of info()?.database?.tables || []; track table.name) { <a [href]="ctx.link('platform', 'database', 'browse', table.name)" (click)="ctx.go(ctx.link('platform', 'database', 'browse', table.name), $event)" [class]="'lay-chip ' + (browseTable() === table.name ? 'lay-l-platform' : 'lay-plain')" [attr.aria-current]="browseTable() === table.name ? 'page' : null">{{ table.name }}</a> }</div>
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
                <p class="lay-muted small">A backup is taken before every release. Backups stay on this machine, outside the repository.</p></section>
            </div>
          }
        }
      }
    }
    @case ('domains') {
      <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Domains"><table><thead><tr><th>Environment</th><th>Address</th><th>DNS</th><th>HTTPS</th></tr></thead><tbody>
        <tr><td>Preview</td><td><code>{{ host(info()?.domains?.preview || ctx.setup()?.urls?.app) }}</code></td><td class="small">Local: <code>*.{{ info()?.domains?.base || 'localhost' }}</code> resolves to this machine</td><td class="small">Not needed locally</td></tr>
        <tr><td>Production</td><td class="lay-muted">—</td><td class="small" colspan="2">A custom domain needs production hosting first</td></tr></tbody></table></div>
      <section class="lay-card lay-quiet lay-gap-top"><h2>When production exists</h2><p class="lay-muted small">Aludel will show the exact records to add at your registrar, check them, and track the certificate. It never buys a domain or changes DNS without you.</p></section>
    }
    @default {
      <div class="lay-grid lay-g3">
        <section class="lay-card"><h2>Environments</h2><dl class="lay-kv"><dt>Preview</dt><dd><span class="lay-chip" [class.lay-ok]="preview()?.status === 'running'" [class.lay-plain]="preview()?.status !== 'running'">{{ previewLabel() }}</span> {{ info()?.health?.ok ? info()?.health?.status + ' · ' + info()?.health?.ms + ' ms' : '' }}</dd><dt>Production</dt><dd><span class="lay-chip lay-plain">Not set up</span></dd></dl>
          <a class="small" [href]="ctx.link('platform', 'environments')" (click)="ctx.go(ctx.link('platform', 'environments'), $event)">Environments</a></section>
        <section class="lay-card"><h2>Last release</h2>@if (latest(); as release) { <p class="lay-flat">#{{ release.number }} · <code>{{ (release.commit || '').slice(0, 7) }}</code></p><p class="small"><span [class]="'lay-chip ' + releaseState[release.state][0]">{{ releaseState[release.state][1] }}</span> {{ when(release.startedAt) }}</p> } @else { <p class="lay-muted">None yet</p> }
          <a class="small" [href]="ctx.link('platform', 'releases')" (click)="ctx.go(ctx.link('platform', 'releases'), $event)">Releases</a></section>
        <section class="lay-card"><h2>Database</h2>@if (info()?.database?.exists) { <dl class="lay-kv"><dt>Integrity</dt><dd><span class="lay-chip" [class.lay-ok]="info()?.database?.integrity === 'ok'" [class.lay-bad]="info()?.database?.integrity !== 'ok'">{{ info()?.database?.integrity === 'ok' ? 'OK' : 'Problem' }}</span></dd><dt>Last backup</dt><dd>{{ info()?.backups?.[0] ? when(info()?.backups?.[0]?.at) : 'None' }}</dd></dl> } @else { <p class="lay-muted">No database yet</p> }
          <a class="small" [href]="ctx.link('platform', 'database')" (click)="ctx.go(ctx.link('platform', 'database'), $event)">Database</a></section>
        <section class="lay-card lay-wide"><h2>Code</h2><div class="lay-row lay-wrap">@for (state of unitStates; track state) { <a [href]="ctx.link('platform', 'code', 'state', state)" (click)="ctx.go(ctx.link('platform', 'code', 'state', state), $event)" [class]="'lay-chip ' + (count(state) ? stateClass(state) : 'lay-plain')">{{ unitStateLabel[state] }} {{ count(state) }}</a> }</div>
          @if (reconciling().length) { <p class="small">Records changed since their code was written: @for (item of reconciling(); track item.id) { <a [href]="ctx.link('work', 'item', item.id)" (click)="ctx.go(ctx.link('work', 'item', item.id), $event)">{{ item.ref }}</a>{{ $last ? '' : ', ' }} } reconcile them.</p> }
          @else { <p class="lay-muted small">{{ units().length ? 'Every linked record is current.' : 'No code read yet.' }}</p> }</section>
        <section class="lay-card"><h2>Domains</h2><p class="small lay-flat"><code>{{ host(ctx.setup()?.urls?.app) }}</code></p><p class="lay-muted small">No custom domain yet</p>
          <a class="small" [href]="ctx.link('platform', 'domains')" (click)="ctx.go(ctx.link('platform', 'domains'), $event)">Domains</a></section>
      </div>
    }
  }
  <ng-template #gridView let-result let-label="label">
    <div class="lay-table-wrap" tabindex="0" role="region" [attr.aria-label]="label"><table><thead><tr>@for (column of result.columns; track $index) { <th>{{ column }}</th> }</tr></thead><tbody>
      @for (row of result.rows; track $index) { <tr>@for (value of row; track $index) { <td>@if (result.masked.includes(result.columns[$index])) { <span class="lay-masked" title="Hidden: secret column">hidden</span> } @else { {{ value === null ? 'null' : value }} }</td> }</tr> }
      @empty { <tr><td [attr.colspan]="result.columns.length || 1" class="lay-muted">No rows.</td></tr> }</tbody></table></div>
  </ng-template>`
})
export class PlatformLayerComponent implements OnInit {
  readonly ctx = inject(ProjectContext);
  readonly tabs = [['overview', 'Overview'], ['architecture', 'Architecture'], ['code', 'Code'], ['repository', 'Repository'], ['releases', 'Releases'], ['environments', 'Environments'], ['database', 'Database'], ['domains', 'Domains']];
  readonly databaseParts = [['health', 'Health & backups'], ['migrations', 'Schema'], ['browse', 'Browse'], ['query', 'Query']];
  readonly unitStates = ['healthy', 'suspect', 'untraced', 'dead'];
  readonly unitStateLabel = unitStateLabel;
  readonly dataStatusLabel = dataStatusLabel;
  readonly statusLabel = statusLabel;
  readonly layerLabel = layerLabel;
  readonly releaseState = releaseState;
  readonly sourceLabel: Record<string, string> = { manifest: 'build manifest', trailer: 'commit trailer', test: 'test name' };
  readonly explain: Record<string, string> = { healthy: 'Reachable, and every reason it exists is current.', suspect: 'Something it was built for has changed since. It may need to change too.',
    untraced: 'Something uses it, but no story or contract says why. Usually glue, which is fine.', dead: 'Nothing uses it and nothing needs it. Probably safe to remove.' };
  readonly info = signal<PlatformInfo | null>(null);
  readonly schema = signal<{ type: string; name: string; tableName: string; sql: string }[]>([]);
  readonly grid = signal<Grid | null>(null);
  readonly queryResult = signal<Grid | null>(null);
  readonly queryError = signal('');
  readonly confirming = signal('');
  sql = 'SELECT name, email, created_at FROM accounts ORDER BY created_at DESC';

  readonly tab = computed(() => this.ctx.segments()[1] || 'overview');
  readonly dbPart = computed(() => this.tab() === 'database' ? this.ctx.segments()[2] || 'health' : '');
  readonly browseTable = computed(() => this.dbPart() === 'browse' ? this.ctx.segments()[3] || this.info()?.database?.tables?.[0]?.name || '' : '');
  readonly preview = computed(() => this.ctx.setup()?.preview || null);
  readonly preset = computed(() => { const id = this.ctx.setup()?.stack?.preset; return id ? this.ctx.catalog()?.stacks.presets[id] : null; });
  readonly stackLayers = computed(() => Object.entries(this.preset()?.layers || {}));
  readonly units = computed(() => this.ctx.data()?.code.units || []);
  readonly services = computed(() => (this.ctx.data()?.services || []).filter(service => service.stories.length));
  readonly latest = computed(() => this.info()?.releases[0] || null);
  readonly reconciling = computed(() => (this.ctx.data()?.work || []).filter(item => item.type === 'reconcile' && item.state !== 'done'));
  readonly currentPhase = computed(() => this.ctx.data()?.phases.find(phase => phase.current)?.label || 'Demo');
  readonly unit = computed(() => { const id = this.tab() === 'code' ? this.ctx.segments()[2] : ''; return id && id !== 'for' && id !== 'state' ? this.ctx.unitById().get(id) || null : null; });
  readonly codeFilter = computed(() => { const [, , kind, value] = this.ctx.segments(); return kind === 'for' ? { recordId: value, state: '' } : kind === 'state' ? { recordId: '', state: value } : null; });
  readonly filteredUnits = computed(() => { const filter = this.codeFilter(); return this.units().filter(unit => !filter || (filter.recordId ? unit.links.some(link => link.recordId === filter.recordId) : unit.state === filter.state)); });
  readonly coverage = computed(() => {
    const data = this.ctx.data(); if (!data) return [];
    const phase = data.phases.find(item => item.current)?.key || 'demo';
    return data.stories.filter(story => story.phase === phase).map(story => { const built = this.ctx.builtBy().get(story.id); return { story, units: built?.units || 0, tests: built?.tests || 0, suspect: Boolean(built?.suspect) }; });
  });
  readonly binding = computed(() => {
    const data = this.ctx.data(); if (!data) return [];
    // Objects are realised as tables and operations as handlers; other links (a handler that creates an Account) stay in Code.
    const realised = (id: string, kind: string) => this.units().filter(unit => unit.kind === kind && unit.links.some(link => link.recordId === id));
    const row = (id: string, label: string, href: string, status: string) => { const found = realised(id, this.ctx.objectById().has(id) ? 'table' : 'handler'); return { id, label, href, status, as: found.map(unit => unit.kind === 'table' ? `Table ${unit.symbol.replace(/^table /, '')}` : `Route handler ${unit.symbol}`).join(', ') || '—', where: [...new Set(found.map(unit => unit.path))].join(', ') || 'Not bound yet' }; };
    return [...data.objects.map(object => row(object.id, `${object.name} object`, this.ctx.link('data', 'objects', object.id), object.status)),
      ...data.operations.map(op => row(op.id, `${op.operationId} operation`, this.ctx.link('data', 'api', op.id), op.status))];
  });

  constructor() {
    // Database views load what they show when their route is opened, including by a direct link.
    effect(() => {
      const part = this.dbPart(); const table = this.browseTable();
      untracked(() => { if (part === 'migrations') void this.loadSchema(); if (part === 'browse' && table) void this.loadBrowse(table); });
    });
  }
  async ngOnInit() { await this.load(); }
  async load() {
    try { this.info.set(await this.ctx.api<PlatformInfo>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/platform`)); }
    catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  }
  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}`; }
  async loadSchema() { try { this.schema.set((await this.ctx.api<{ schema: { type: string; name: string; tableName: string; sql: string }[] }>(`${this.base()}/database/schema`)).schema); } catch { this.schema.set([]); } }
  async loadBrowse(table: string) { try { this.grid.set(await this.ctx.api<Grid>(`${this.base()}/database/browse?table=${encodeURIComponent(table)}`)); } catch (error) { this.grid.set(null); this.ctx.error.set(error instanceof Error ? error.message : String(error)); } }
  async runQuery() {
    this.queryError.set('');
    try { this.queryResult.set(await this.ctx.api<Grid>(`${this.base()}/database/query`, 'POST', { sql: this.sql })); }
    catch (error) { this.queryResult.set(null); this.queryError.set(error instanceof Error ? error.message : String(error)); }
  }
  backupNow() { void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/database/backups`, 'POST', {}); await this.load(); }, 'Backed up.'); }
  restore(name: string) { void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/database/restore`, 'POST', { name, confirm: true }); this.confirming.set(''); await this.load(); }, 'Restored. A backup of the previous state was taken first; the preview restarts when next opened.'); }
  reindex() { void this.ctx.write(() => this.ctx.api(`${this.base()}/code/index`, 'POST', {}), 'Read the code again.'); }
  rebuild() { void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/skeleton`, 'POST', {}); await this.load(); }, 'Rebuilding. The preview restarts when the build finishes.'); }

  realises(table: string) { return (this.ctx.data()?.objects || []).find(object => this.units().some(unit => unit.kind === 'table' && unit.symbol === `table ${table}` && unit.links.some(link => link.recordId === object.id))) || null; }
  count(state: string) { return this.units().filter(unit => unit.state === state).length; }
  stateClass(state: string) { return state === 'healthy' ? 'lay-ok' : state === 'suspect' ? 'lay-warn' : state === 'dead' ? 'lay-bad' : 'lay-plain'; }
  icon(kind: string | undefined) { return unitIcon[kind || ''] || 'code'; }
  reasons(unit: CodeUnit) { return [...new Set(unit.links.map(link => this.ctx.recordLabel(link.recordId)[0].split(' ')[0]))].join(', '); }
  testsFor(unit: CodeUnit) { const records = new Set(unit.links.map(link => link.recordId)); return this.units().filter(other => other.kind === 'test' && (other.calls.includes(unit.id) || other.links.some(link => records.has(link.recordId)))); }
  workFor(unit: CodeUnit) { const records = new Set(unit.links.map(link => link.recordId)); return (this.ctx.data()?.work || []).filter(item => item.targets.some(target => records.has(target.id)) && item.type !== 'define'); }
  pipeline(release: Release): [string, string][] {
    const check = (name: string) => release.checks.find(item => item.name === name)?.state;
    const stage = (state: string | undefined) => state === 'passed' ? 'done' : state === 'failed' ? 'failed' : state === 'running' ? 'now' : 'waiting';
    return [['Build', stage(check('Build'))], ['Health check', stage(check('Health check'))], ['Preview', release.state === 'passed' ? 'done' : 'waiting'], ['Production', 'off']];
  }
  previewLabel() { const status = this.preview()?.status; return status === 'running' ? 'Running' : status === 'stopped' ? 'Built' : status === 'building' ? 'Building' : status === 'failed' ? 'Failed' : 'Not built'; }
  healthText() { const health = this.info()?.health; return health?.ok ? `/api/health ${health.status} · ${health.ms} ms` : this.preview()?.status === 'running' ? 'Not answering' : 'Starts when opened'; }
  githubHref() { return `/start/${encodeURIComponent(this.ctx.projectId())}/github`; }
  host(url: string | undefined) { return String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, ''); }
  size(bytes: number | undefined) { return bytes === undefined ? '—' : bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`; }
  when(at: string | undefined) { return at ? new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
}
