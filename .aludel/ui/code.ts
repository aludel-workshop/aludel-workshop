import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CodeUnit, ProjectContext } from '@aludel/host/context';
import { LayerRoles, RoleNoteComponent } from '@aludel/host/roles';

// Code (PLATFORM-UX-01; T03-CODE): a reference for how the code connects to everything else. Nobody writes code here; a
// change is requested and becomes Work in this layer. Everything is read from the repository at the layer's pin. The app's
// docs are this layer's Knowledge (DEC-061), so there is no Docs tab. Views link within the layer with ctx.here and to
// other layers' records with ctx.recordHref, never by a layer key.
interface RepoFile { path: string; size: number; }
interface CodeObservation { id: string; repository_commit: string; source_path: string; blob_sha: string; marker: string; route: string; observed_at: string; }
interface Stack { name: string | null; node: string | null; dependencies: { name: string; version: string }[]; devDependencies: { name: string; version: string }[]; images: string[]; healthcheck: boolean; composeServices: string[]; ci: string[]; languages: { name: string; bytes: number }[]; }
interface DocSource { kind: string; id: string; revision: number | null; current: number | null; state: string; }
interface DocSection { heading: string; level: number; line: number; sources: DocSource[]; state: string; }
interface RepoDoc { path: string; lines: number; text: string; sections: DocSection[]; onMap: boolean; broken: string[]; }
interface Docs { docs: RepoDoc[]; sidecar: boolean; agentsLines: number; checks: { offMap: string[]; broken: string[]; refresh: number }; }
interface CodeRelease { id: string; version: string; commit: string; notes: string; changes: { name: string; from: string | null; to: string | null }[]; migrations: string[]; createdBy: string; createdAt: string; publishedAt: string | null; url: string | null; }
interface Draft { head: string; since: { version: string; commit: string } | null; commits: { hash: string; subject: string; work: string | null }[]; changes: { name: string; from: string | null; to: string | null }[]; migrations: string[]; suggested: string; }
interface CiResults { state: string; url?: string; sha?: string; at?: string; tests?: { name: string; file: string; result: string; message: string }[]; }
interface JourneyStep { id: string; name: string; trigger: string; expected: string; page?: string; route?: string; persona?: string; story?: string; test?: string; }
interface Journey { id: string; title: string; origin: 'authored' | 'observed' | 'replica'; revision: number; persona?: string; source?: { layer: string; entry: string; revision: number }; proof?: { commit: string; status: string }; steps: JourneyStep[]; }
interface JourneyEntry { ref: string; revision: number; data: Journey; }
interface TreeRow { key: string; depth: number; kind: 'dir' | 'file' | 'unit'; name: string; path: string; unit?: CodeUnit; open?: boolean; count?: number; worst?: string; }

// Written as { icon: '…' } entries so tools/subset-icons.py finds every glyph used here.
const unitIcons = [{ kind: 'component', icon: 'web' }, { kind: 'route', icon: 'route' }, { kind: 'handler', icon: 'api' }, { kind: 'table', icon: 'table' }, { kind: 'function', icon: 'function' },
  { kind: 'const', icon: 'data_object' }, { kind: 'class', icon: 'data_object' }, { kind: 'test', icon: 'fact_check' }, { kind: 'other', icon: 'code' }];
const unitIcon: Record<string, string> = Object.fromEntries(unitIcons.map(entry => [entry.kind, entry.icon]));
const stateOrder: Record<string, number> = { dead: 0, healthy: 1 };
const escapeHtml = (text: string) => text.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] as string));
// A light highlighter for the read-only viewer: comments, strings, keywords, numbers. Output is escaped first.
function highlight(line: string) {
  const text = escapeHtml(line);
  if (/^\s*(\/\/|#|--|\*|\/\*)/.test(line)) return `<span class="lay-tk-c">${text}</span>`;
  return text.replace(/('[^']*'|"[^"]*"|`[^`]*`)/g, '<span class="lay-tk-s">$1</span>')
    .replace(/\b(import|from|export|default|async|await|function|return|const|let|if|else|readonly|class|new|for|of|throw|try|catch|FROM|RUN|COPY|WORKDIR|ENV|USER|EXPOSE|CMD|HEALTHCHECK|CREATE|TABLE|INDEX|NOT|NULL|PRIMARY|KEY|REFERENCES|DEFAULT)\b(?![^<]*>)/g, '<span class="lay-tk-k">$1</span>');
}
@Component({
  selector: 'aludel-code-layer', standalone: true,
  host: { '[style.--lay-here]': "ctx.hereKey() ? 'var(--lay-' + ctx.hereKey() + ')' : null", '[style.--lay-here-bg]': "ctx.hereKey() ? 'var(--lay-' + ctx.hereKey() + '-bg)' : null" },
  imports: [FormsModule, MatIconModule, RoleNoteComponent],
  template: `
  @switch (tab()) {
    @case ('overview') {
      <div class="lay-row lay-wrap lay-block"><p class="lay-lead lay-flat">How the code fits together and connects to the other layers, read from the repository.</p><span class="lay-muted small lay-push">As of <code>main</code>{{ draft()?.head ? ' @ ' + draft()?.head : '' }}{{ latest() ? ' · latest release v' + latest()?.version : '' }}</span></div>
      <div class="lay-grid lay-g-side">
        <div class="lay-grid">
          <section class="lay-card"><h2>Structure</h2>
            @if (parts().length) {
              <div class="lay-cx-map">@for (part of parts(); track part.key) {
                <button type="button" class="lay-cx-part" [class.lay-cx-on]="part.key === partKey()" (click)="partKey.set(part.key)" [attr.aria-pressed]="part.key === partKey()">
                  <strong><mat-icon aria-hidden="true">{{ part.icon }}</mat-icon>{{ part.name }}</strong><small>{{ part.stack.slice(0, 2).join(' · ') || part.folder }}</small>
                  @if (part.units.length) { <span class="lay-cx-bar" aria-hidden="true">@for (s of states; track s) { <i [class]="'lay-cx-' + s" [style.flex]="rollup(part.units)[s]"></i> }</span><small>{{ part.units.length }} chunks{{ rollup(part.units).dead ? ' · ' + rollup(part.units).dead + ' unused' : '' }}</small> }
                </button> }</div>
              @if (services().length) { <div class="lay-row lay-wrap lay-gap-top"><span class="lay-muted small">Outside services</span>@for (service of services(); track service.key) { <span class="lay-cx-ext"><mat-icon aria-hidden="true">{{ service.icon }}</mat-icon>{{ service.label }}</span> }</div> }
              @if (part(); as p) {
                <div class="lay-cx-panel">
                  <div><h3>{{ p.name }}</h3><p class="lay-muted small">{{ p.about }}</p>
                    @if (p.stack.length) { <ul class="lay-cx-stack">@for (line of p.stack; track line) { <li><code>{{ line }}</code></li> }</ul> }</div>
                  <div><h3>Chunks</h3>
                    <div class="lay-row lay-wrap">@for (unit of sorted(p.units).slice(0, 10); track unit.id) { <a [class]="'lay-chip ' + stateClass(unit.state)" [href]="ctx.here('explorer', unit.id)" (click)="ctx.go(ctx.here('explorer', unit.id), $event)">{{ unit.symbol }}</a> } @empty { <span class="lay-muted small">Files only; nothing to index.</span> }</div>
                    @if (p.units.length > 10) { <p class="small"><a [href]="ctx.here('explorer')" (click)="ctx.go(ctx.here('explorer'), $event)">All {{ p.units.length }} in Explorer</a></p> }</div>
                </div>
              }
            } @else { <p class="lay-muted">Nothing in the repository yet. It is read after the first build.</p> }
          </section>
        </div>
        <div class="lay-grid lay-cx-aside">
          <section class="lay-card"><h2>Code health</h2>
            <span class="lay-cx-bar lay-cx-bar-lg" aria-hidden="true">@for (s of states; track s) { <i [class]="'lay-cx-' + s" [style.flex]="rollup(codeUnits())[s]"></i> }</span>
            <div class="lay-row lay-wrap">@for (s of states; track s) { <a [class]="'lay-chip ' + (rollup(codeUnits())[s] ? stateClass(s) : 'lay-plain')" [href]="ctx.here('explorer', 'state', s)" (click)="ctx.go(ctx.here('explorer', 'state', s), $event)">{{ unitStateLabel[s] }} {{ rollup(codeUnits())[s] }}</a> }</div>
            <p class="lay-muted small">Unused: nothing reaches it from the app's entry files or its tests.</p>
            <button type="button" class="lay-button ghost small" (click)="reindex()"><mat-icon aria-hidden="true">refresh</mat-icon>Read the code again</button></section>
          <section class="lay-card"><h2>Tests</h2><p class="small lay-flat">{{ testUnits().length }} tests in the repository.</p>
            @if (ci()?.tests?.length) { <p class="small"><span class="lay-chip lay-ok">{{ ciCount('pass') }} green</span> <span class="lay-chip" [class.lay-bad]="ciCount('fail')" [class.lay-plain]="!ciCount('fail')">{{ ciCount('fail') }} red</span> on <code>{{ (ci()?.sha || '').slice(0, 7) }}</code></p> }
            @else { <p class="lay-muted small">{{ ciNote() }}</p> }</section>
          <section class="lay-card"><h2>Docs</h2>@if (docs(); as d) { <p class="small lay-flat">{{ d.docs.length }} docs in the repository · {{ d.checks.refresh }} sections need a refresh{{ d.checks.offMap.length ? ' · ' + d.checks.offMap.length + ' off the map' : '' }}</p> } @else { <p class="lay-muted small">Loading…</p> }
            <a class="small" [href]="ctx.here('knowledge')" (click)="ctx.go(ctx.here('knowledge'), $event)">Knowledge</a></section>
          <section class="lay-card" aria-label="GitHub"><h2>GitHub</h2>
            @if (remote(); as r) {
              @if (r.remote; as gh) {
                <p class="small lay-flat"><span [class]="'lay-chip ' + (gh.state === 'in-sync' ? 'lay-ok' : gh.state === 'unavailable' || gh.state === 'diverged' ? 'lay-bad' : 'lay-warn')">{{ syncLabel(gh.state) }}</span>
                  @if (gh.url) { <a [href]="gh.url" target="_blank" rel="noopener">{{ gh.owner }}/{{ gh.name }}</a> } @else { <code>{{ gh.owner }}/{{ gh.name }}</code> }</p>
                @if (gh.detail) { <p class="lay-muted small">{{ gh.detail }}</p> }
                <button type="button" class="lay-button ghost small" (click)="syncNow()"><mat-icon aria-hidden="true">sync</mat-icon>Sync with GitHub</button>
              } @else { <p class="lay-muted small">{{ r.waiting || 'Not on GitHub yet. The repository is local until the project has its GitHub repository.' }}</p> }
            } @else { <p class="lay-muted small">Loading…</p> }</section>
          <section class="lay-card"><h2>Latest release</h2>@if (latest(); as r) { <p class="small lay-flat"><a [href]="ctx.here('releases', r.version)" (click)="ctx.go(ctx.here('releases', r.version), $event)">v{{ r.version }}</a> · <code>{{ r.commit }}</code> · {{ when(r.createdAt) }}</p> } @else { <p class="lay-muted small">None yet. Releases are made on purpose.</p> }</section>
        </div>
      </div>
      <section class="lay-card" aria-label="Code route observations"><h2>Code observations</h2>
        <p class="lay-muted">Pin a committed screen or route source. Pages can review its relevance separately; an observation alone does not define intended flow.</p>
        @if (canManage()) {
          <details><summary>Record a screen or route</summary>
            <div class="lay-pa-two"><label class="lay-pa-field">Tracked source path <input [(ngModel)]="observationPath" placeholder="src/routes/browse.ts"></label>
              <label class="lay-pa-field">Screen or route label <input [(ngModel)]="observationRoute" placeholder="Browse route"></label></div>
            <label class="lay-pa-field">Exact marker in the committed file <input [(ngModel)]="observationMarker" placeholder="A component selector or route declaration"></label>
            <button type="button" class="lay-button" (click)="recordObservation()" [disabled]="observationBusy() || !observationPath.trim() || !observationRoute.trim() || !observationMarker.trim()">Record pinned observation</button>
          </details>
        }
        <ul class="lay-list">@for (observation of observations(); track observation.id) { <li class="lay-pa-history-row"><strong>{{ observation.route }}</strong> · <code>{{ observation.source_path }}</code> · commit <code>{{ observation.repository_commit.slice(0,8) }}</code> · blob <code>{{ observation.blob_sha.slice(0,8) }}</code></li> }
          @empty { <li class="lay-muted">No Code observations recorded.</li> }</ul>
      </section>
    }
    @case ('explorer') {
      <div class="lay-ds-editor lay-ds-three lay-cx-ex">
        <div class="lay-ds-tree">
          <div class="lay-ds-treehead">
            <label class="lay-ds-find"><mat-icon aria-hidden="true">search</mat-icon><span class="visually-hidden">Go to file or chunk</span><input type="search" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Go to file or chunk"></label>
            <div class="lay-cx-filters" role="group" aria-label="Show">@for (f of filters; track f[0]) { <a [href]="f[0] === 'all' ? ctx.here('explorer') : ctx.here('explorer', 'state', f[0])" (click)="ctx.go(f[0] === 'all' ? ctx.here('explorer') : ctx.here('explorer', 'state', f[0]), $event)" [class]="'lay-chip ' + (filter() === f[0] ? 'lay-l-here' : 'lay-plain')" [attr.aria-current]="filter() === f[0] ? 'true' : null">{{ f[1] }}</a> }</div>
          </div>
          <div class="lay-ds-treebody" role="tree" aria-label="Files">
            @for (row of treeRows(); track row.key) {
              @if (row.kind === 'dir') { <button type="button" role="treeitem" class="lay-cx-node" [style.padding-left.px]="8 + row.depth * 14" [attr.aria-expanded]="row.open" (click)="toggle(row.key)"><mat-icon aria-hidden="true" class="lay-cx-caret">{{ row.open ? 'expand_more' : 'chevron_right' }}</mat-icon><mat-icon aria-hidden="true">{{ row.open ? 'folder_open' : 'folder' }}</mat-icon><span>{{ row.name }}</span></button> }
              @if (row.kind === 'file') { <a role="treeitem" class="lay-cx-node" [class.lay-cx-sel]="file() === row.path && !unit()" [style.padding-left.px]="8 + row.depth * 14" [href]="ctx.here('explorer', 'file', row.path)" (click)="openFile(row.path, $event)" [attr.aria-expanded]="row.count ? row.open : null"><mat-icon aria-hidden="true" class="lay-cx-caret">{{ row.count ? (row.open ? 'expand_more' : 'chevron_right') : '' }}</mat-icon><mat-icon aria-hidden="true">description</mat-icon><span>{{ row.name }}</span>@if (row.count) { <small>{{ row.count }}</small> }@if (row.worst) { <i [class]="'lay-cx-dot lay-cx-' + row.worst" [attr.aria-label]="unitStateLabel[row.worst]"></i> }</a> }
              @if (row.kind === 'unit' && row.unit; as u) { <a role="treeitem" class="lay-cx-node lay-cx-unit" [class.lay-cx-sel]="unit()?.id === u.id" [style.padding-left.px]="22 + row.depth * 14" [href]="ctx.here('explorer', u.id)" (click)="ctx.go(ctx.here('explorer', u.id), $event)"><mat-icon aria-hidden="true">{{ icon(u.kind) }}</mat-icon><span class="lay-cx-sym">{{ u.symbol }}</span><i [class]="'lay-cx-dot lay-cx-' + u.state" [attr.aria-label]="unitStateLabel[u.state]"></i></a> }
            } @empty { <p class="lay-muted small lay-pad">{{ files().length ? 'Nothing matches.' : 'No code yet. It is read after each build.' }}</p> }
          </div>
        </div>
        <div class="lay-cx-center">
          @if (file()) {
            <div class="lay-cx-srcbar"><mat-icon aria-hidden="true">description</mat-icon><code>{{ file() }}</code>@if (unit(); as u) { <span class="lay-muted small">lines {{ u.line }}–{{ u.endLine }}</span> }<span class="lay-push lay-muted small"><mat-icon aria-hidden="true" class="lay-cx-lock">lock</mat-icon>Read only</span>
              @if (githubUrl(); as href) { <a class="lay-button ghost small" [href]="href" target="_blank" rel="noopener"><mat-icon aria-hidden="true">open_in_new</mat-icon>GitHub</a> }</div>
            @if (sourceError()) { <p class="lay-muted lay-pad">{{ sourceError() }}</p> }
            @else if (source() !== null) {
              <div class="lay-cx-src" tabindex="0" role="region" [attr.aria-label]="'Source of ' + file()"><table><tbody>
                @for (line of sourceLines(); track $index) { <tr [id]="'cx-line-' + ($index + 1)" [class.lay-cx-hl]="line.selected"><td class="lay-cx-ln">{{ $index + 1 }}</td><td class="lay-cx-mk">@if (line.owner; as o) { <a [class]="'lay-cx-' + o.state" [href]="ctx.here('explorer', o.id)" (click)="ctx.go(ctx.here('explorer', o.id), $event)" [attr.aria-label]="o.symbol + ', ' + unitStateLabel[o.state]" [title]="o.symbol + ' · ' + unitStateLabel[o.state]" tabindex="-1"></a> }</td><td class="lay-cx-code" [innerHTML]="line.html"></td></tr> }
              </tbody></table></div>
            } @else { <p class="lay-muted lay-pad">Loading…</p> }
          } @else { <div class="lay-cx-empty"><p class="lay-muted">Choose a file or a chunk on the left. Nothing here is edited: to change code, request it.</p></div> }
        </div>
        <aside class="lay-ds-side lay-cx-insp">
          @if (unit(); as u) {
            <div class="lay-row lay-wrap"><h2 class="lay-flat lay-cx-sym">{{ u.symbol }}</h2><span [class]="'lay-chip ' + stateClass(u.state)">{{ unitStateLabel[u.state] }}</span></div>
            <p class="lay-muted small lay-flat">{{ u.kind }} · lines {{ u.line }}–{{ u.endLine }}{{ u.lastCommit ? ' · last changed in ' + u.lastCommit : '' }}</p>
            @if (u.state === 'dead') { <p class="lay-muted small">Nothing reaches it from the app's entry files or its tests.</p> }
            <h3>Calls · called by</h3>
            <div class="lay-cx-rel">@for (id of u.calls; track id) { <a [href]="ctx.here('explorer', id)" (click)="ctx.go(ctx.here('explorer', id), $event)"><mat-icon aria-hidden="true">arrow_forward</mat-icon><code>{{ ctx.unitById().get(id)?.symbol }}</code></a> }
              @for (id of u.calledBy; track id) { <a [href]="ctx.here('explorer', id)" (click)="ctx.go(ctx.here('explorer', id), $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon><code>{{ ctx.unitById().get(id)?.symbol }}</code></a> }
              @if (!u.calls.length && !u.calledBy.length) { <p class="lay-muted small">{{ u.reachable ? 'An entry point' : 'Nothing' }}</p> }</div>
            <h3>Tests</h3>@for (test of testsFor(u); track test.id) { <div class="lay-cx-rel"><a [href]="ctx.here('explorer', test.id)" (click)="ctx.go(ctx.here('explorer', test.id), $event)"><mat-icon aria-hidden="true">fact_check</mat-icon>{{ test.symbol }}</a></div> } @empty { <p class="lay-muted small">No test reaches it.</p> }
          } @else if (file()) {
            <h2 class="lay-flat">{{ fileName(file()) }}</h2>
            <h3>Chunks</h3>@for (u of fileUnits(); track u.id) { <a class="lay-cx-node lay-cx-unit" [href]="ctx.here('explorer', u.id)" (click)="ctx.go(ctx.here('explorer', u.id), $event)"><mat-icon aria-hidden="true">{{ icon(u.kind) }}</mat-icon><span class="lay-cx-sym">{{ u.symbol }}</span><i [class]="'lay-cx-dot lay-cx-' + u.state"></i></a> } @empty { <p class="lay-muted small">None. Build, run and config files are read whole.</p> }
            @if (runFile()) { <p class="lay-note small">Deploy reads this file: the image, how it runs, or the variables it needs.</p> }
          }
          @if (file()) {
            <h3>Request a change</h3>
            <textarea class="lay-cx-note" rows="3" [(ngModel)]="changeNote" placeholder="What should change, and why" aria-label="What should change, and why"></textarea>
            <button type="button" class="lay-button small" [disabled]="!changeNote.trim()" (click)="requestChange()"><mat-icon aria-hidden="true">send</mat-icon>Add to Work</button>
            <p class="lay-muted small">Code isn't edited here. A different look or behaviour belongs on the page or journey; the code follows.</p>
          }
        </aside>
      </div>
    }
    @case ('tests') {
      <p class="lay-lead">The app's tests, read from the repository, with the latest CI results. Tests that prove a journey's steps are listed on Journeys.</p>
      <div class="lay-row lay-wrap lay-block"><span class="lay-chip lay-plain">{{ testUnits().length }} tests</span>
        <span class="small">@switch (ci()?.state) {
          @case ('success') { <span class="lay-chip lay-ok">CI passed</span> } @case ('failure') { <span class="lay-chip lay-bad">CI failed</span> } @case ('running') { <span class="lay-chip lay-plain">CI running</span> }
          @case ('no-permission') { <span class="lay-muted">Results need the Aludel GitHub App's Actions (read) permission.</span> }
          @case ('no-github') { <span class="lay-muted">Results come from CI once the project has its GitHub repository.</span> }
          @case ('no-run') { <span class="lay-muted">No CI run for <code>{{ (ci()?.sha || '').slice(0, 7) }}</code> yet. CI runs on GitHub after each push.</span> }
          @case (undefined) { <span class="lay-muted">Loading results…</span> }
          @default { <span class="lay-chip lay-plain">CI {{ ci()?.state }}</span> } }
          @if (ci()?.url) { <a [href]="ci()?.url" target="_blank" rel="noopener">The run on GitHub</a> }</span></div>
      <section class="lay-card">
        @for (group of testsByFile(); track group[0]) { <h3>{{ group[0] }}</h3>@for (t of group[1]; track t.id) { <div class="lay-cx-rel"><a [class]="'lay-chip ' + resultClass(t.symbol)" [href]="ctx.here('explorer', t.id)" (click)="ctx.go(ctx.here('explorer', t.id), $event)" [title]="t.path + (result(t.symbol)?.message ? ' · ' + result(t.symbol)?.message : '')"><mat-icon aria-hidden="true">{{ resultIcon(t.symbol) }}</mat-icon>{{ t.symbol }}</a></div> } }
        @empty { <p class="lay-muted small">No tests yet.</p> }</section>
    }
    @case ('journeys') {
      <aludel-role-note kind="journey" />
      <p class="lay-lead">The steps people take through the app, each with the test that proves it. Review walks a journey in the preview, and Work claims its steps.</p>
      @if (journeys().length) {
        <div class="lay-grid lay-cx-rel-grid">
          <section class="lay-card lay-cx-rel-list"><ul class="lay-list">
            @for (j of journeys(); track j.ref) { <li><a class="lay-item" [class.lay-cx-sel]="journey()?.ref === j.ref" [href]="ctx.here('journeys', j.data.id)" (click)="ctx.go(ctx.here('journeys', j.data.id), $event)"><mat-icon aria-hidden="true">route</mat-icon><span class="lay-body-text"><strong>{{ j.data.title }}</strong><small>{{ originLabel[j.data.origin] }} · {{ covered(j.data) }} of {{ j.data.steps.length }} steps tested</small></span></a></li> }
          </ul></section>
          @if (journey(); as j) {
            <section class="lay-card">
              <div class="lay-row lay-wrap"><h2 class="lay-flat">{{ j.data.title }}</h2><span class="lay-chip lay-plain">{{ originLabel[j.data.origin] }}</span><span class="lay-muted small">revision {{ j.data.revision }}{{ j.data.persona ? ' · as ' + j.data.persona : '' }}</span></div>
              @if (j.data.origin === 'replica' && j.data.source) { <p class="small">A copy of {{ j.data.source.entry }} (revision {{ j.data.source.revision }}) from the {{ j.data.source.layer }} layer, which is the authority for journeys here. Change it there.</p> }
              @if (j.data.origin === 'observed') { <p class="small">@if (j.data.proof?.status === 'passed') { Recorded from how the app behaves, proven by a run that passed at <code>{{ j.data.proof?.commit?.slice(0, 7) }}</code>. } @else { Recorded from how the app behaves, but not proven by a passing run yet, so treat it as a guess. }</p> }
              <ol class="lay-list lay-gap-top">
                @for (step of j.data.steps; track step.id) {
                  <li class="lay-block"><div class="lay-row lay-wrap"><strong>{{ $index + 1 }}. {{ step.name }}</strong>@if (step.route) { <code>{{ step.route }}</code> }@if (step.persona) { <span class="lay-chip lay-plain">as {{ step.persona }}</span> }
                    @if (step.test) { <span class="lay-chip lay-ok lay-push" [title]="'journeys/' + step.test"><mat-icon aria-hidden="true">fact_check</mat-icon>{{ step.test }}</span> } @else { <span class="lay-chip lay-plain lay-push">No test yet</span> }</div>
                    <p class="small lay-flat">{{ step.trigger }} → {{ step.expected }}</p></li>
                }
              </ol>
              <p class="lay-muted small">Step tests run when a change to the app is reviewed.</p>
              @if (j.data.origin !== 'replica' && layerRoles.editableKind('journey')) {
                <div class="lay-cx-ask"><textarea rows="2" [(ngModel)]="journeyNote" [attr.aria-label]="'What should change in ' + j.data.title" placeholder="What should change, e.g. ask for the team name before the workspace is created"></textarea>
                  <button type="button" class="lay-button small" [disabled]="!journeyNote.trim()" (click)="changeJourney(j)"><mat-icon aria-hidden="true">edit_note</mat-icon>Add to Work</button></div>
              }
            </section>
          }
        </div>
      } @else { <section class="lay-card lay-quiet"><p class="lay-flat">No journeys yet. A journey records the steps people take through the app, with a test for each step. They are added through Work, starting from how the app behaves now.</p></section> }
    }
    @case ('releases') {
      <p class="lay-lead">Releases are made on purpose, not per commit or merge. Each one names a commit, its notes, stack changes and new migrations. Deploy runs them.</p>
      <div class="lay-grid lay-cx-rel-grid">
        <section class="lay-card lay-cx-rel-list"><ul class="lay-list">
          @if (draft(); as d) { <li><a class="lay-item" [class.lay-cx-sel]="!releaseRoute()" [href]="ctx.here('releases')" (click)="ctx.go(ctx.here('releases'), $event)"><mat-icon aria-hidden="true">new_label</mat-icon><span class="lay-body-text"><strong>Next release</strong><small>{{ d.commits.length }} commits since {{ d.since ? 'v' + d.since.version : 'the start' }}</small></span></a></li> }
          @for (r of releases(); track r.id) { <li><a class="lay-item" [class.lay-cx-sel]="releaseRoute() === r.version" [href]="ctx.here('releases', r.version)" (click)="ctx.go(ctx.here('releases', r.version), $event)"><mat-icon aria-hidden="true">sell</mat-icon><span class="lay-body-text"><strong>v{{ r.version }}</strong><small>{{ r.notes.split('\\n')[0] || r.commit }}</small></span>@if (running(r)) { <span class="lay-chip lay-l-deploy">Preview</span> }</a></li> }
        </ul></section>
        @if (release(); as r) {
          <section class="lay-card"><div class="lay-row lay-wrap"><h2 class="lay-flat">v{{ r.version }}</h2><code>{{ r.commit }}</code><span class="lay-muted small">{{ when(r.createdAt) }} · {{ r.createdBy }}</span>@if (running(r)) { <span class="lay-chip lay-ok lay-push">Running in Preview</span> }</div>
            @if (r.notes) { <h3>Notes</h3><p class="lay-cx-pre">{{ r.notes }}</p> }
            <h3>Stack changes</h3>@for (c of r.changes; track c.name) { <p class="small lay-flat"><code>{{ c.name }}</code> {{ c.from || 'added' }} → {{ c.to || 'removed' }}</p> } @empty { <p class="lay-muted small">{{ first(r) ? 'First release: nothing to compare with.' : 'None' }}</p> }
            <h3>New migrations</h3>@for (m of r.migrations; track m) { <p class="small lay-flat"><code>{{ m }}</code></p> } @empty { <p class="lay-muted small">None</p> }
            <h3>GitHub</h3>
            @if (r.publishedAt) { <p class="small lay-flat">Published {{ when(r.publishedAt) }}: @if (r.url) { <a [href]="r.url" target="_blank" rel="noopener">the GitHub Release</a> } and tag <code>v{{ r.version }}</code>. The repository's release workflow builds the image into GitHub Packages{{ imageName() ? ' as ' + imageName() + ':v' + r.version : '' }}.</p> }
            @else if (repoReady()) { <p class="lay-muted small">Publishing creates tag <code>v{{ r.version }}</code> and a GitHub Release on <code>{{ ctx.setup()?.github?.repository?.owner }}/{{ ctx.setup()?.github?.repository?.name }}</code>. Its release workflow then builds the image into GitHub Packages.</p>
              <button type="button" class="lay-button small" (click)="publish(r)"><mat-icon aria-hidden="true">publish</mat-icon>Publish v{{ r.version }} to GitHub</button> }
            @else { <p class="lay-muted small">Recorded in Aludel. It can be published once the project has its GitHub repository.</p> }</section>
        } @else if (draft(); as d) {
          <section class="lay-card"><h2>Next release</h2>
            <p class="lay-muted small">From <code>main</code> at <code>{{ d.head }}</code>, {{ d.commits.length }} commits since {{ d.since ? 'v' + d.since.version : 'the start' }}.</p>
            <h3>Commits</h3>@for (c of d.commits.slice(0, 12); track c.hash) { <p class="small lay-flat"><code>{{ c.hash }}</code> {{ c.subject }}</p> } @empty { <p class="lay-muted small">Nothing since the last release.</p> }
            <h3>Stack changes</h3>@for (c of d.changes; track c.name) { <p class="small lay-flat"><code>{{ c.name }}</code> {{ c.from || 'added' }} → {{ c.to || 'removed' }}</p> } @empty { <p class="lay-muted small">{{ d.since ? 'None' : 'First release: nothing to compare with.' }}</p> }
            <h3>New migrations</h3>@for (m of d.migrations; track m) { <p class="small lay-flat"><code>{{ m }}</code></p> } @empty { <p class="lay-muted small">None</p> }
            @if (d.commits.length) {
              <form class="lay-form lay-gap-top" (ngSubmit)="recordRelease()"><label>Version<input name="version" [(ngModel)]="version" [placeholder]="d.suggested"></label>
                <label>Notes<textarea name="notes" rows="3" [(ngModel)]="notes"></textarea></label>
                <button type="submit" class="lay-button small"><mat-icon aria-hidden="true">new_label</mat-icon>Record v{{ version || d.suggested }}</button></form>
            }</section>
        } @else { <section class="lay-card lay-quiet"><p class="lay-flat">No repository yet. Releases start after the first build.</p></section> }
      </div>
    }
  }`
})
export class CodeLayerComponent implements OnInit {
  readonly ctx = inject(ProjectContext);
  readonly layerRoles = inject(LayerRoles);
  readonly tabs = [['overview', 'Overview'], ['explorer', 'Explorer'], ['journeys', 'Journeys'], ['tests', 'Tests'], ['releases', 'Releases']];
  readonly titles: Record<string, string> = { overview: 'How it is built', explorer: 'Explorer', journeys: 'Journeys', tests: 'Tests', releases: 'Releases' };
  readonly originLabel: Record<string, string> = { authored: 'Authored', observed: 'Observed', replica: 'Replica' };
  readonly states = ['healthy', 'dead'];
  readonly filters = [['all', 'All'], ['dead', 'Unused'], ['untested', 'Untested']];
  readonly unitStateLabel: Record<string, string> = { healthy: 'Used', dead: 'Unused' };
  readonly files = signal<RepoFile[]>([]);
  readonly observations = signal<CodeObservation[]>([]);
  readonly observationBusy = signal(false);
  readonly canManage = computed(() => this.ctx.session()?.projects.find(project => project.id === this.ctx.projectId())?.role === 'owner');
  observationPath = ''; observationMarker = ''; observationRoute = '';
  readonly stack = signal<Stack | null>(null);
  readonly docs = signal<Docs | null>(null);
  readonly releases = signal<CodeRelease[]>([]);
  readonly journeys = signal<JourneyEntry[]>([]);
  readonly draft = signal<Draft | null>(null);
  readonly ci = signal<CiResults | null>(null);
  readonly remote = signal<{ commit: string; waiting: string | null; remote: { owner: string; name: string; url: string | null; state: string; detail: string | null } | null } | null>(null);
  readonly source = signal<string | null>(null);
  readonly sourceError = signal('');
  readonly query = signal('');
  readonly partKey = signal('api');
  readonly open = signal(new Set<string>());
  readonly changing = signal('');
  changeNote = '';
  journeyNote = '';
  version = '';
  notes = '';

  // Old tabs (LAY-07B) land on their new homes: architecture → overview, code → explorer, repository → releases.
  readonly tab = computed(() => { const t = this.ctx.segments()[1] || 'overview'; return ({ architecture: 'overview', code: 'explorer', repository: 'releases', docs: 'overview' } as Record<string, string>)[t] || (this.titles[t] ? t : 'overview'); });
  private readonly rest = computed(() => this.ctx.segments().slice(2));
  readonly unit = computed(() => { const [id] = this.rest(); return this.tab() === 'explorer' && id && !['file', 'for', 'state'].includes(id) ? this.ctx.unitById().get(id) || null : null; });
  readonly file = computed(() => { const [kind, value] = this.rest(); return this.unit()?.path || (this.tab() === 'explorer' && kind === 'file' ? value : '') || ''; });
  readonly filter = computed(() => { const [kind, value] = this.rest(); return kind === 'state' ? value : 'all'; });
  readonly units = computed(() => this.ctx.data()?.code.units || []);
  readonly codeUnits = computed(() => this.units().filter(unit => unit.kind !== 'test'));
  readonly services = computed(() => (this.ctx.data()?.services || []).filter(service => service.stories.length));
  readonly latest = computed(() => this.releases()[0] || null);
  readonly releaseRoute = computed(() => this.tab() === 'releases' ? this.rest()[0] || '' : '');
  readonly release = computed(() => this.releases().find(r => r.version === this.releaseRoute()) || null);
  readonly journey = computed(() => { if (this.tab() !== 'journeys') return null; const id = this.rest()[0]; const list = this.journeys(); return (id ? list.find(j => j.data.id === id) : list[0]) || null; });

  // ---- Overview: parts from the repository's own folders, with the stack from its manifests ----
  readonly parts = computed(() => {
    const files = this.files(); const stack = this.stack(); const has = (prefix: string) => files.some(file => file.path.startsWith(prefix));
    const deps = (stack?.dependencies || []).filter(dep => !dep.name.startsWith('@angular/') || dep.name === '@angular/core' || dep.name === '@angular/material').map(dep => `${dep.name} ${dep.version}`);
    const tables = this.units().filter(unit => unit.kind === 'table');
    const out = [];
    if (has('src/')) out.push({ key: 'web', name: 'Web app', icon: 'web', folder: 'src/', about: 'What people use in the browser.', stack: [...deps, ...(stack?.devDependencies || []).filter(dep => ['vite', 'typescript', 'sass'].includes(dep.name)).map(dep => `${dep.name} ${dep.version} (build)`)], units: this.codeUnits().filter(unit => unit.path.startsWith('src/')) });
    if (has('server/')) out.push({ key: 'api', name: 'API server', icon: 'api', folder: 'server/', about: 'Answers /api requests and stores records.', stack: [stack?.node ? `Node.js ${stack.node}` : 'Node.js'], units: this.codeUnits().filter(unit => unit.path.startsWith('server/') && unit.kind !== 'table') });
    if (tables.length || has('db/')) out.push({ key: 'db', name: 'Database', icon: 'database', folder: 'db/', about: 'Tables for the Data objects; what each holds is defined in Data. Each environment has its own.', stack: ['SQLite'], units: tables });
    if (has('tests/')) out.push({ key: 'tests', name: 'Tests', icon: 'fact_check', folder: 'tests/', about: 'The app\'s tests.', stack: [...(stack?.ci.length ? ['CI: ' + stack.ci.join(', ')] : [])], units: this.units().filter(unit => unit.kind === 'test') });
    if (stack?.images.length) out.push({ key: 'run', name: 'Container', icon: 'deployed_code', folder: '', about: `Built by the Dockerfile${stack.composeServices.length ? '; compose.yaml runs it anywhere' : ''}.${stack.healthcheck ? ' It declares a health check.' : ''}`, stack: [...new Set(stack.images)].map(image => `Image ${image}`), units: [] as CodeUnit[] });
    return out;
  });
  readonly part = computed(() => this.parts().find(p => p.key === this.partKey()) || this.parts()[0] || null);
  // ---- Tests: the repository's test units, by file ----
  readonly testUnits = computed(() => this.units().filter(unit => unit.kind === 'test'));
  readonly testsByFile = computed(() => { const groups = new Map<string, CodeUnit[]>(); for (const test of this.testUnits()) groups.set(test.path, [...(groups.get(test.path) || []), test]); return [...groups.entries()]; });

  // ---- Explorer: folders → files → chunks ----
  private matches(unit: CodeUnit) {
    const q = this.query().trim().toLowerCase(); const f = this.filter();
    if (q && !unit.symbol.toLowerCase().includes(q) && !unit.path.toLowerCase().includes(q)) return false;
    if (f === 'all') return true;
    if (f === 'untested') return !['test', 'table', 'const'].includes(unit.kind) && !this.testsFor(unit).length;
    return unit.state === f;
  }
  readonly treeRows = computed(() => {
    const q = this.query().trim().toLowerCase(); const filtering = Boolean(q) || this.filter() !== 'all'; const open = this.open();
    const byFile = new Map<string, CodeUnit[]>(); for (const unit of this.units()) byFile.set(unit.path, [...(byFile.get(unit.path) || []), unit]);
    const selected = this.file();
    const visible = this.files().map(file => file.path).filter(path => !filtering || (byFile.get(path) || []).some(unit => this.matches(unit)) || (q && this.filter() === 'all' && path.toLowerCase().includes(q)));
    const rows: TreeRow[] = []; const seen = new Set<string>();
    for (const path of visible.sort()) {
      const parts = path.split('/');
      let hidden = false;
      for (let i = 0; i < parts.length - 1; i++) {
        const dir = parts.slice(0, i + 1).join('/') + '/';
        const isOpen = open.has(dir) || filtering || selected.startsWith(dir);
        if (!seen.has(dir) && !hidden) { seen.add(dir); rows.push({ key: dir, depth: i, kind: 'dir', name: parts[i], path: dir, open: isOpen }); }
        if (!isOpen) hidden = true;
      }
      if (hidden) continue;
      const units = (byFile.get(path) || []).sort((a, b) => a.line - b.line);
      const fileOpen = open.has('f:' + path) || selected === path || filtering;
      const worst = units.map(u => u.state).sort((a, b) => stateOrder[a] - stateOrder[b])[0] || '';
      rows.push({ key: path, depth: parts.length - 1, kind: 'file', name: parts[parts.length - 1], path, open: fileOpen, count: units.length, worst });
      if (fileOpen) for (const unit of units.filter(u => this.matches(u))) rows.push({ key: unit.id, depth: parts.length - 1, kind: 'unit', name: unit.symbol, path, unit });
    }
    return rows;
  });
  readonly fileUnits = computed(() => this.units().filter(unit => unit.path === this.file()).sort((a, b) => a.line - b.line));
  readonly runFile = computed(() => ['Dockerfile', 'compose.yaml', '.env.example', 'package.json'].includes(this.file()));
  readonly sourceLines = computed(() => {
    const text = this.source(); if (text === null) return [];
    const units = this.fileUnits(); const selected = this.unit();
    return text.replace(/\n$/, '').split('\n').map((line, index) => {
      const n = index + 1; const owner = units.filter(unit => n >= unit.line && n <= unit.endLine).sort((a, b) => (a.endLine - a.line) - (b.endLine - b.line))[0] || null;
      return { html: highlight(line) || ' ', owner, selected: Boolean(selected && n >= selected.line && n <= selected.endLine) };
    });
  });
  readonly githubUrl = computed(() => { const repo = this.ctx.setup()?.github?.repository; return repo?.html_url && this.file() ? `${repo.html_url}/blob/HEAD/${this.file()}${this.unit() ? '#L' + this.unit()?.line + '-L' + this.unit()?.endLine : ''}` : ''; });

  // ---- Docs ----

  constructor() {
    // Source loads for the file in the route; the selected chunk scrolls into view once it has rendered.
    effect(() => { const path = this.file(); untracked(() => void this.loadSource(path)); });
    // Only the source pane scrolls to the chunk; the page stays where it is.
    effect(() => { const unit = this.unit(); this.sourceLines(); if (unit) untracked(() => setTimeout(() => { const row = document.getElementById(`cx-line-${unit.line}`); const pane = row?.closest('.lay-cx-src'); if (row && pane) pane.scrollTop = Math.max(0, row.offsetTop - pane.clientHeight / 3); })); });
    effect(() => { const tab = this.tab(); untracked(() => { if (tab === 'overview') { void this.loadDocs(); void this.loadRemote(); } if (tab === 'releases' || tab === 'overview') void this.loadReleases(); if ((tab === 'tests' || tab === 'overview') && !this.ci()) void this.loadCi(); if (tab === 'journeys') void this.loadJourneys(); }); });
  }
  async ngOnInit() {
    void this.loadObservations();
    try { const value = await this.ctx.api<{ files: RepoFile[]; stack: Stack }>(`${this.base()}/code/files`); this.files.set(value.files); this.stack.set(value.stack); }
    catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  }
  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}`; }
  private observationPathApi() { return `${this.base()}/layers/code/route-observations`; }
  async loadObservations() { try { this.observations.set((await this.ctx.api<{ observations: CodeObservation[] }>(this.observationPathApi())).observations); } catch (error) { this.ctx.error.set(String(error)); } }
  async recordObservation() { this.observationBusy.set(true); const ok = await this.ctx.write(() => this.ctx.api(this.observationPathApi(), 'POST',
    { path: this.observationPath.trim(), marker: this.observationMarker.trim(), route: this.observationRoute.trim() }), 'Pinned Code observation recorded.');
    if (ok) { this.observationPath = ''; this.observationMarker = ''; this.observationRoute = ''; await this.loadObservations(); }
    this.observationBusy.set(false); }
  async loadSource(path: string) {
    this.source.set(null); this.sourceError.set('');
    if (!path) return;
    try { this.source.set((await this.ctx.api<{ text: string }>(`${this.base()}/code/file?path=${encodeURIComponent(path)}`)).text); }
    catch (error) { this.sourceError.set(error instanceof Error ? error.message : String(error)); }
  }
  // The app's docs are this layer's Knowledge: the repository's docs and the checks Knowledge runs on them.
  async loadDocs() { try { const list = await this.ctx.api<{ docs: { path: string }[]; checks: Docs['checks'] }>(`${this.base()}/layers/${encodeURIComponent(this.ctx.hereKey() || '')}/knowledge/docs`);
    this.docs.set({ docs: list.docs.filter(doc => doc.path.startsWith('/')) as unknown as RepoDoc[], sidecar: false, agentsLines: 0, checks: list.checks }); } catch { this.docs.set({ docs: [], sidecar: false, agentsLines: 0, checks: { offMap: [], broken: [], refresh: 0 } }); } }
  async loadCi() { try { this.ci.set(await this.ctx.api<CiResults>(`${this.base()}/code/ci`)); } catch { this.ci.set({ state: 'unavailable' }); } }
  // Journeys are this layer's own file entries, read like any other layer's outputs: from the Library.
  async loadJourneys() { try { const value = await this.ctx.api<{ results: JourneyEntry[] }>(`${this.base()}/library?kind=journey&layer=${encodeURIComponent(this.ctx.hereKey() || '')}&data=1&limit=100`); this.journeys.set(value.results.filter(entry => entry.data?.steps)); } catch { this.journeys.set([]); } }
  async loadReleases() { try { const value = await this.ctx.api<{ releases: CodeRelease[]; draft: Draft | null }>(`${this.base()}/code/releases`); this.releases.set(value.releases); this.draft.set(value.draft); } catch { this.releases.set([]); this.draft.set(null); } }

  openFile(path: string, event: Event) {
    event.preventDefault();
    if (this.file() === path && !this.unit()) { this.toggle('f:' + path); return; }
    this.open.update(set => new Set(set).add('f:' + path));
    this.ctx.go(this.ctx.here('explorer', 'file', path));
  }
  toggle(key: string) { this.open.update(set => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  requestChange() {
    const unit = this.unit(); const about = unit ? `${unit.symbol} (${unit.path}:${unit.line})` : this.file();
    const note = this.changeNote.trim();
    void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/work`, 'POST', { title: `Change ${about}`.slice(0, 160), targets: [], suggestion: note }); this.changeNote = ''; }, 'Added to Work.');
  }
  covered(journey: Journey) { return journey.steps.filter(step => step.test).length; }
  changeJourney(entry: JourneyEntry) {
    const note = this.journeyNote.trim(); if (!note) return;
    void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/work`, 'POST', { title: `Change ${entry.data.title}: ${note}`.slice(0, 160), targets: [{ id: entry.ref, label: entry.data.title }], suggestion: note }); this.journeyNote = ''; }, 'Added to Work.');
  }
  recordRelease() {
    const version = this.version.trim() || this.draft()?.suggested || '';
    void this.ctx.write(async () => { const r = await this.ctx.api<CodeRelease>(`${this.base()}/code/releases`, 'POST', { version, notes: this.notes }); this.version = ''; this.notes = ''; await this.loadReleases(); this.ctx.go(this.ctx.here('releases', r.version)); }, 'Recorded.');
  }
  publish(release: CodeRelease) { void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/code/releases-publish`, 'POST', { version: release.version }); await this.loadReleases(); }, `Published v${release.version} to GitHub.`); }
  readonly repoReady = computed(() => this.ctx.setup()?.github?.repository?.status === 'ready');
  readonly imageName = computed(() => { const repo = this.ctx.setup()?.github?.repository; return repo ? `ghcr.io/${repo.owner}/${repo.name}`.toLowerCase() : ''; });
  result(name: string) { return this.ci()?.tests?.find(test => test.name === name) || null; }
  resultClass(name: string, old = false) { const r = this.result(name)?.result; return r === 'pass' ? 'lay-ok' : r === 'fail' ? 'lay-bad' : old ? 'lay-warn' : 'lay-l-here'; }
  resultIcon(name: string) { const r = this.result(name)?.result; return r === 'pass' ? 'check' : r === 'fail' ? 'close' : 'fact_check'; }
  ciCount(result: string) { return (this.ci()?.tests || []).filter(test => test.result === result).length; }
  ciNote() { const state = this.ci()?.state; return state === 'no-permission' ? 'Results need the GitHub App\'s Actions permission.' : state === 'no-github' ? 'Results come from CI on GitHub.' : state === 'no-run' ? 'No CI run for the latest commit yet.' : 'Results appear once CI reports them.'; }
  private syncPath() { return `${this.base()}/layers/${encodeURIComponent(this.ctx.hereKey() || '')}/sync`; }
  async loadRemote() { try { this.remote.set(await this.ctx.api(this.syncPath())); } catch { this.remote.set({ commit: '', waiting: null, remote: null }); } }
  syncNow() { void this.ctx.write(async () => { await this.ctx.api(this.syncPath(), 'POST', {}); await this.loadRemote(); }, 'Synced with GitHub.'); }
  syncLabel(state: string) { return ({ 'in-sync': 'In step', ahead: 'Not pushed yet', behind: 'Waiting', held: 'Held for review', diverged: 'Both sides changed', unavailable: 'Can\'t reach GitHub', unknown: 'Not checked yet' } as Record<string, string>)[state] || state; }
  // Settles the layer with its repository (a build's newer commit, or GitHub's), then reads the code at the new pin.
  reindex() { void this.ctx.write(() => this.ctx.api(`${this.base()}/layers/${encodeURIComponent(this.ctx.hereKey() || '')}/sync`, 'POST', {}), 'Read the code again.'); }

  rollup(units: CodeUnit[]) { const c: Record<string, number> = { healthy: 0, dead: 0 }; for (const unit of units) c[unit.state === 'dead' ? 'dead' : 'healthy']++; return c; }
  // Unused first, then the chunks people look for: handlers, components and routes before helpers and constants.
  sorted(units: CodeUnit[]) { const kind = (k: string) => ['handler', 'component', 'route', 'table', 'function', 'class', 'const', 'test'].indexOf(k); return [...units].sort((a, b) => Math.min(stateOrder[a.state], 2) - Math.min(stateOrder[b.state], 2) || kind(a.kind) - kind(b.kind)); }
  stateClass(state: string) { return state === 'dead' ? 'lay-bad' : 'lay-ok'; }
  icon(kind: string) { return unitIcon[kind] || 'code'; }
  // Tests that call a unit directly.
  testsFor(unit: CodeUnit) { return this.testUnits().filter(other => other.id !== unit.id && other.calls.includes(unit.id)); }
  running(release: CodeRelease) { const commit = this.ctx.setup()?.preview?.commit || ''; return Boolean(commit && (commit.startsWith(release.commit) || release.commit.startsWith(commit.slice(0, 7)))); }
  first(release: CodeRelease) { return this.releases().at(-1)?.id === release.id; }
  // A finding or insight used elsewhere: the records it is evidence for, other than docs.
  depth(path: string) { return path.split('/').length - 1; }
  fileName(path: string) { return path.split('/').pop(); }
  when(at: string) { return new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
}
