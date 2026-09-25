import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CodeUnit, ProjectContext, Story, statusLabel, unitStateLabel } from './context';
import { RefChipComponent } from './work-shared';

// Code (PLATFORM-UX-01): a reference for how the code connects to everything else. Nobody writes code here; a change is
// requested and becomes Engineer work. Everything is read from the repository and the code index (LAY-07D).
interface RepoFile { path: string; size: number; }
interface Stack { name: string | null; node: string | null; dependencies: { name: string; version: string }[]; devDependencies: { name: string; version: string }[]; images: string[]; healthcheck: boolean; composeServices: string[]; ci: string[]; languages: { name: string; bytes: number }[]; }
interface DocSource { kind: string; id: string; revision: number | null; current: number | null; state: string; }
interface DocSection { heading: string; level: number; line: number; sources: DocSource[]; state: string; }
interface RepoDoc { path: string; lines: number; text: string; sections: DocSection[]; onMap: boolean; broken: string[]; }
interface Docs { docs: RepoDoc[]; sidecar: boolean; agentsLines: number; checks: { offMap: string[]; broken: string[]; refresh: number }; }
interface CodeRelease { id: string; version: string; commit: string; notes: string; stories: string[]; changes: { name: string; from: string | null; to: string | null }[]; migrations: string[]; createdBy: string; createdAt: string; publishedAt: string | null; url: string | null; }
interface Draft { head: string; since: { version: string; commit: string } | null; commits: { hash: string; subject: string; work: string | null; implements: string | null }[]; stories: string[]; changes: { name: string; from: string | null; to: string | null }[]; migrations: string[]; suggested: string; }
interface CiResults { state: string; url?: string; sha?: string; at?: string; tests?: { name: string; file: string; result: string; message: string }[]; }
interface TreeRow { key: string; depth: number; kind: 'dir' | 'file' | 'unit'; name: string; path: string; unit?: CodeUnit; open?: boolean; count?: number; worst?: string; lensed?: boolean; }

// Written as { icon: '…' } entries so tools/subset-icons.py finds every glyph used here.
const unitIcons = [{ kind: 'component', icon: 'web' }, { kind: 'route', icon: 'route' }, { kind: 'handler', icon: 'api' }, { kind: 'table', icon: 'table' }, { kind: 'function', icon: 'function' },
  { kind: 'const', icon: 'data_object' }, { kind: 'class', icon: 'data_object' }, { kind: 'test', icon: 'fact_check' }, { kind: 'other', icon: 'code' }];
const unitIcon: Record<string, string> = Object.fromEntries(unitIcons.map(entry => [entry.kind, entry.icon]));
const stateOrder: Record<string, number> = { suspect: 0, dead: 1, untraced: 2, healthy: 3 };
const escapeHtml = (text: string) => text.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] as string));
// A light highlighter for the read-only viewer: comments, strings, keywords, numbers. Output is escaped first.
function highlight(line: string) {
  const text = escapeHtml(line);
  if (/^\s*(\/\/|#|--|\*|\/\*)/.test(line)) return `<span class="lay-tk-c">${text}</span>`;
  return text.replace(/('[^']*'|"[^"]*"|`[^`]*`)/g, '<span class="lay-tk-s">$1</span>')
    .replace(/\b(import|from|export|default|async|await|function|return|const|let|if|else|readonly|class|new|for|of|throw|try|catch|FROM|RUN|COPY|WORKDIR|ENV|USER|EXPOSE|CMD|HEALTHCHECK|CREATE|TABLE|INDEX|NOT|NULL|PRIMARY|KEY|REFERENCES|DEFAULT)\b(?![^<]*>)/g, '<span class="lay-tk-k">$1</span>');
}
// Markdown for the docs reader: headings (tagged with their index), lists, fences, paragraphs, inline code, bold and links.
function inline(text: string) { return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<u>$1</u>'); }
export function markdownBlocks(text: string) {
  const blocks: { section: number; html: string }[] = []; let section = -1; let fence: string[] | null = null; let list: string[] = []; let para: string[] = [];
  const flush = () => { if (list.length) { blocks.push({ section, html: `<ul>${list.map(item => `<li>${inline(item)}</li>`).join('')}</ul>` }); list = []; } if (para.length) { blocks.push({ section, html: `<p>${inline(para.join(' '))}</p>` }); para = []; } };
  for (const line of text.split('\n')) {
    if (/^```/.test(line)) { if (fence) { blocks.push({ section, html: `<pre>${escapeHtml(fence.join('\n'))}</pre>` }); fence = null; } else { flush(); fence = []; } continue; }
    if (fence) { fence.push(line); continue; }
    const heading = /^(#{1,3})\s+(.+?)\s*#*$/.exec(line);
    if (heading) { flush(); section++; blocks.push({ section, html: `<h${heading[1].length + 1}>${inline(heading[2])}</h${heading[1].length + 1}>` }); continue; }
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (item) { if (para.length) flush(); list.push(item[1]); continue; }
    if (!line.trim()) { flush(); continue; }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

@Component({
  selector: 'aludel-code-layer', standalone: true,
  imports: [FormsModule, MatIconModule, RefChipComponent],
  template: `
  <p class="lay-eyebrow">Code · how it's built and connected</p>
  <h1 tabindex="-1">{{ titles[tab()] }}</h1>
  <nav class="lay-tabs" aria-label="Code sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('platform', entry[0])" (click)="ctx.go(ctx.link('platform', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }
  </nav>
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
                  @if (part.units.length) { <span class="lay-cx-bar" aria-hidden="true">@for (s of states; track s) { <i [class]="'lay-cx-' + s" [style.flex]="rollup(part.units)[s]"></i> }</span><small>{{ part.units.length }} chunks{{ rollup(part.units).suspect ? ' · ' + rollup(part.units).suspect + ' suspect' : '' }}</small> }
                </button> }</div>
              @if (services().length) { <div class="lay-row lay-wrap lay-gap-top"><span class="lay-muted small">Outside services</span>@for (service of services(); track service.key) { <a class="lay-cx-ext" [href]="ctx.link('deploy', 'integrations')" (click)="ctx.go(ctx.link('deploy', 'integrations'), $event)"><mat-icon aria-hidden="true">{{ service.icon }}</mat-icon>{{ service.label }}</a> }</div> }
              @if (part(); as p) {
                <div class="lay-cx-panel">
                  <div><h3>{{ p.name }}</h3><p class="lay-muted small">{{ p.about }}</p>
                    @if (p.stack.length) { <ul class="lay-cx-stack">@for (line of p.stack; track line) { <li><code>{{ line }}</code></li> }</ul> }</div>
                  <div><h3>Chunks</h3>
                    <div class="lay-row lay-wrap">@for (unit of sorted(p.units).slice(0, 10); track unit.id) { <a [class]="'lay-chip ' + stateClass(unit.state)" [href]="ctx.link('platform', 'explorer', unit.id)" (click)="ctx.go(ctx.link('platform', 'explorer', unit.id), $event)">{{ unit.symbol }}</a> } @empty { <span class="lay-muted small">Files only; nothing to index.</span> }</div>
                    @if (p.units.length > 10) { <p class="small"><a [href]="ctx.link('platform', 'explorer')" (click)="ctx.go(ctx.link('platform', 'explorer'), $event)">All {{ p.units.length }} in Explorer</a></p> }</div>
                </div>
              }
            } @else { <p class="lay-muted">Nothing in the repository yet. It is read after the first build.</p> }
          </section>
          <section class="lay-card"><div class="lay-row"><h2 class="lay-flat">Stories: code and tests</h2><a class="small lay-push" [href]="ctx.link('platform', 'tests')" (click)="ctx.go(ctx.link('platform', 'tests'), $event)">Tests</a></div>
            <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Stories, code and tests"><table><thead><tr><th>Story</th><th>Chunks</th><th>Scenarios with a test</th><th>Links</th></tr></thead><tbody>
              @for (row of storyRows(); track row.story.id) { <tr><td><aludel-ref [id]="row.story.id" /></td><td>{{ row.units || '—' }}</td><td>{{ row.tested }} of {{ row.scenarios }}</td>
                <td>@if (row.units || row.tests) { <span class="lay-chip" [class.lay-warn]="row.suspect" [class.lay-ok]="!row.suspect">{{ row.suspect ? 'Suspect' : 'Current' }}</span> } @else { <span class="lay-muted small">Not built</span> }</td></tr> }
              @empty { <tr><td colspan="4" class="lay-muted">No stories yet.</td></tr> }</tbody></table></div></section>
        </div>
        <div class="lay-grid lay-cx-aside">
          <section class="lay-card"><h2>Code health</h2>
            <span class="lay-cx-bar lay-cx-bar-lg" aria-hidden="true">@for (s of states; track s) { <i [class]="'lay-cx-' + s" [style.flex]="rollup(codeUnits())[s]"></i> }</span>
            <div class="lay-row lay-wrap">@for (s of states; track s) { <a [class]="'lay-chip ' + (rollup(codeUnits())[s] ? stateClass(s) : 'lay-plain')" [href]="ctx.link('platform', 'explorer', 'state', s)" (click)="ctx.go(ctx.link('platform', 'explorer', 'state', s), $event)">{{ unitStateLabel[s] }} {{ rollup(codeUnits())[s] }}</a> }</div>
            <p class="lay-muted small">Suspect: something it was built for changed since. Untraced: used, but nothing says why (often glue). Unused: nothing calls it.</p>
            <button type="button" class="lay-button ghost small" (click)="reindex()"><mat-icon aria-hidden="true">refresh</mat-icon>Read the code again</button></section>
          <section class="lay-card"><h2>Tests</h2><p class="small lay-flat">{{ testedCount() }} of {{ scenarioCount() }} scenarios have a test. {{ otherTests().length }} other tests.</p>
            @if (ci()?.tests?.length) { <p class="small"><span class="lay-chip lay-ok">{{ ciCount('pass') }} green</span> <span class="lay-chip" [class.lay-bad]="ciCount('fail')" [class.lay-plain]="!ciCount('fail')">{{ ciCount('fail') }} red</span> on <code>{{ (ci()?.sha || '').slice(0, 7) }}</code></p> }
            @else { <p class="lay-muted small">{{ ciNote() }}</p> }</section>
          <section class="lay-card"><h2>Docs</h2>@if (docs(); as d) { <p class="small lay-flat">{{ d.docs.length }} docs · {{ d.checks.refresh }} sections need a refresh</p> } @else { <p class="lay-muted small">Loading…</p> }
            <a class="small" [href]="ctx.link('platform', 'docs')" (click)="ctx.go(ctx.link('platform', 'docs'), $event)">Docs</a></section>
          <section class="lay-card"><h2>Latest release</h2>@if (latest(); as r) { <p class="small lay-flat"><a [href]="ctx.link('platform', 'releases', r.version)" (click)="ctx.go(ctx.link('platform', 'releases', r.version), $event)">v{{ r.version }}</a> · <code>{{ r.commit }}</code> · {{ when(r.createdAt) }}</p> } @else { <p class="lay-muted small">None yet. Releases are made on purpose.</p> }</section>
        </div>
      </div>
    }
    @case ('explorer') {
      <div class="lay-ds-editor lay-ds-three lay-cx-ex">
        <div class="lay-ds-tree">
          <div class="lay-ds-treehead">
            <label class="lay-ds-find"><mat-icon aria-hidden="true">search</mat-icon><span class="visually-hidden">Go to file or chunk</span><input type="search" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Go to file or chunk"></label>
            <div class="lay-cx-filters" role="group" aria-label="Show">@for (f of filters; track f[0]) { <a [href]="f[0] === 'all' ? ctx.link('platform', 'explorer') : ctx.link('platform', 'explorer', 'state', f[0])" (click)="ctx.go(f[0] === 'all' ? ctx.link('platform', 'explorer') : ctx.link('platform', 'explorer', 'state', f[0]), $event)" [class]="'lay-chip ' + (filter() === f[0] ? 'lay-l-platform' : 'lay-plain')" [attr.aria-current]="filter() === f[0] ? 'true' : null">{{ f[1] }}</a> }</div>
            <label class="lay-cx-lens"><mat-icon aria-hidden="true">auto_stories</mat-icon><span class="visually-hidden">Highlight a record's code</span>
              <select [ngModel]="lens()" (ngModelChange)="setLens($event)"><option value="">Highlight code for…</option>@for (r of lensOptions(); track r.id) { <option [value]="r.id">{{ r.label }}</option> }</select></label>
            @if (lens()) { <small class="lay-muted">{{ lensUnits().size }} chunks in {{ lensFiles().size }} files</small> }
          </div>
          <div class="lay-ds-treebody" role="tree" aria-label="Files">
            @for (row of treeRows(); track row.key) {
              @if (row.kind === 'dir') { <button type="button" role="treeitem" class="lay-cx-node" [style.padding-left.px]="8 + row.depth * 14" [attr.aria-expanded]="row.open" (click)="toggle(row.key)"><mat-icon aria-hidden="true" class="lay-cx-caret">{{ row.open ? 'expand_more' : 'chevron_right' }}</mat-icon><mat-icon aria-hidden="true">{{ row.open ? 'folder_open' : 'folder' }}</mat-icon><span>{{ row.name }}</span>@if (row.worst === 'suspect') { <i class="lay-cx-dot lay-cx-suspect" aria-label="Has suspect code"></i> }</button> }
              @if (row.kind === 'file') { <a role="treeitem" class="lay-cx-node" [class.lay-cx-sel]="file() === row.path && !unit()" [style.padding-left.px]="8 + row.depth * 14" [href]="ctx.link('platform', 'explorer', 'file', row.path)" (click)="openFile(row.path, $event)" [attr.aria-expanded]="row.count ? row.open : null"><mat-icon aria-hidden="true" class="lay-cx-caret">{{ row.count ? (row.open ? 'expand_more' : 'chevron_right') : '' }}</mat-icon><mat-icon aria-hidden="true">description</mat-icon><span>{{ row.name }}</span>@if (row.count) { <small>{{ row.count }}</small> }@if (row.worst) { <i [class]="'lay-cx-dot lay-cx-' + row.worst" [attr.aria-label]="unitStateLabel[row.worst]"></i> }</a> }
              @if (row.kind === 'unit' && row.unit; as u) { <a role="treeitem" class="lay-cx-node lay-cx-unit" [class.lay-cx-sel]="unit()?.id === u.id" [class.lay-cx-lensed]="row.lensed" [style.padding-left.px]="22 + row.depth * 14" [href]="ctx.link('platform', 'explorer', u.id)" (click)="ctx.go(ctx.link('platform', 'explorer', u.id), $event)"><mat-icon aria-hidden="true">{{ icon(u.kind) }}</mat-icon><span class="lay-cx-sym">{{ u.symbol }}</span><i [class]="'lay-cx-dot lay-cx-' + u.state" [attr.aria-label]="unitStateLabel[u.state]"></i></a> }
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
                @for (line of sourceLines(); track $index) { <tr [id]="'cx-line-' + ($index + 1)" [class.lay-cx-hl]="line.selected" [class.lay-cx-inlens]="line.lensed"><td class="lay-cx-ln">{{ $index + 1 }}</td><td class="lay-cx-mk">@if (line.owner; as o) { <a [class]="'lay-cx-' + o.state" [href]="ctx.link('platform', 'explorer', o.id)" (click)="ctx.go(ctx.link('platform', 'explorer', o.id), $event)" [attr.aria-label]="o.symbol + ', ' + unitStateLabel[o.state]" [title]="o.symbol + ' · ' + unitStateLabel[o.state]" tabindex="-1"></a> }</td><td class="lay-cx-code" [innerHTML]="line.html"></td></tr> }
              </tbody></table></div>
            } @else { <p class="lay-muted lay-pad">Loading…</p> }
          } @else { <div class="lay-cx-empty"><p class="lay-muted">Choose a file or a chunk on the left. Nothing here is edited: to change code, request it.</p></div> }
        </div>
        <aside class="lay-ds-side lay-cx-insp">
          @if (unit(); as u) {
            <div class="lay-row lay-wrap"><h2 class="lay-flat lay-cx-sym">{{ u.symbol }}</h2><span [class]="'lay-chip ' + stateClass(u.state)">{{ unitStateLabel[u.state] }}</span></div>
            <p class="lay-muted small lay-flat">{{ u.kind }} · lines {{ u.line }}–{{ u.endLine }}{{ u.lastCommit ? ' · last changed in ' + u.lastCommit : '' }}</p>
            @for (link of u.links; track link.recordId + link.kind + link.source) { @if (link.state === 'suspect') { <p class="lay-note small">{{ ctx.recordLabel(link.recordId)[0] }} is at revision {{ link.currentRevision }}; this was built for {{ link.revision }}.</p> } }
            <h3>Why it exists</h3>
            @for (link of u.links; track link.recordId + link.kind + link.source) { <div class="lay-cx-why"><div class="lay-row"><aludel-ref [id]="link.recordId" /><span class="lay-chip lay-push" [class.lay-warn]="link.state === 'suspect'" [class.lay-ok]="link.state !== 'suspect'">{{ link.state === 'suspect' ? 'Changed' : 'Current' }}</span></div><small class="lay-muted">{{ link.kind }} · revision {{ link.revision }} · from the {{ sourceLabel[link.source] || link.source }}{{ link.workRef ? ' (' + link.workRef + ')' : '' }}</small></div> }
            @empty { <p class="lay-muted small">{{ u.state === 'dead' ? 'Nothing uses it and nothing needs it.' : 'Used, but no story or contract says why. Usually glue.' }}</p> }
            <h3>Calls · called by</h3>
            <div class="lay-cx-rel">@for (id of u.calls; track id) { <a [href]="ctx.link('platform', 'explorer', id)" (click)="ctx.go(ctx.link('platform', 'explorer', id), $event)"><mat-icon aria-hidden="true">arrow_forward</mat-icon><code>{{ ctx.unitById().get(id)?.symbol }}</code></a> }
              @for (id of u.calledBy; track id) { <a [href]="ctx.link('platform', 'explorer', id)" (click)="ctx.go(ctx.link('platform', 'explorer', id), $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon><code>{{ ctx.unitById().get(id)?.symbol }}</code></a> }
              @if (!u.calls.length && !u.calledBy.length) { <p class="lay-muted small">{{ u.reachable ? 'An entry point' : 'Nothing' }}</p> }</div>
            <h3>Tests</h3>@for (test of testsFor(u); track test.id) { <div class="lay-cx-rel"><a [href]="ctx.link('platform', 'explorer', test.id)" (click)="ctx.go(ctx.link('platform', 'explorer', test.id), $event)"><mat-icon aria-hidden="true">fact_check</mat-icon>{{ test.symbol }}</a></div> } @empty { <p class="lay-muted small">No test reaches it.</p> }
            @if (workFor(u).length) { <h3>Work</h3>@for (item of workFor(u); track item.id) { <aludel-ref [id]="item.id" /> } }
          } @else if (file()) {
            <h2 class="lay-flat">{{ fileName(file()) }}</h2>
            <h3>Chunks</h3>@for (u of fileUnits(); track u.id) { <a class="lay-cx-node lay-cx-unit" [href]="ctx.link('platform', 'explorer', u.id)" (click)="ctx.go(ctx.link('platform', 'explorer', u.id), $event)"><mat-icon aria-hidden="true">{{ icon(u.kind) }}</mat-icon><span class="lay-cx-sym">{{ u.symbol }}</span><i [class]="'lay-cx-dot lay-cx-' + u.state"></i></a> } @empty { <p class="lay-muted small">None. Build, run and config files are read whole.</p> }
            @if (fileRecords().length) { <h3>Why this file exists</h3><div class="lay-row lay-wrap">@for (id of fileRecords(); track id) { <aludel-ref [id]="id" /> }</div> }
            @if (runFile()) { <p class="lay-note small">Deploy reads this file: the image, how it runs, or the variables it needs.</p> }
          }
          @if (file()) {
            <h3>Request a change</h3>
            <textarea class="lay-cx-note" rows="3" [(ngModel)]="changeNote" placeholder="What should change, and why" aria-label="What should change, and why"></textarea>
            <button type="button" class="lay-button small" [disabled]="!changeNote.trim()" (click)="requestChange()"><mat-icon aria-hidden="true">send</mat-icon>Add to Work for the Engineer</button>
            <p class="lay-muted small">Code isn't edited here. A different look or behaviour belongs on the story or page; the code follows.</p>
          }
        </aside>
      </div>
    }
    @case ('tests') {
      <p class="lay-lead">Does each story's acceptance have a test? Tests are linked by name: <code>S4/2 · …</code> checks scenario 2 of S4, <code>S4 · …</code> the whole story. Not every test is about a story; the rest are listed below.</p>
      <div class="lay-row lay-wrap lay-block"><span class="lay-chip lay-ok">{{ testedCount() }} scenarios with a test</span><span class="lay-chip lay-plain">{{ scenarioCount() - testedCount() }} without</span><span class="lay-chip lay-plain">{{ otherTests().length }} other tests</span>
        <span class="small">@switch (ci()?.state) {
          @case ('success') { <span class="lay-chip lay-ok">CI passed</span> } @case ('failure') { <span class="lay-chip lay-bad">CI failed</span> } @case ('running') { <span class="lay-chip lay-plain">CI running</span> }
          @case ('no-permission') { <span class="lay-muted">Results need the Aludel GitHub App's Actions (read) permission.</span> }
          @case ('no-github') { <span class="lay-muted">Results come from CI once the project has its GitHub repository.</span> }
          @case ('no-run') { <span class="lay-muted">No CI run for <code>{{ (ci()?.sha || '').slice(0, 7) }}</code> yet. CI runs on GitHub after each push.</span> }
          @case (undefined) { <span class="lay-muted">Loading results…</span> }
          @default { <span class="lay-chip lay-plain">CI {{ ci()?.state }}</span> } }
          @if (ci()?.url) { <a [href]="ci()?.url" target="_blank" rel="noopener">The run on GitHub</a> }</span>
        @if (scenarioCount() - testedCount()) { <button type="button" class="lay-button small lay-push" (click)="writeTests()"><mat-icon aria-hidden="true">add_task</mat-icon>Ask for tests for {{ scenarioCount() - testedCount() }} scenarios</button> }</div>
      <div class="lay-grid lay-g-side">
        <div class="lay-grid">
          @for (row of storyTests(); track row.story.id) {
            <section class="lay-card lay-cx-story"><div class="lay-row lay-wrap"><aludel-ref [id]="row.story.id" /><span class="lay-muted small">revision {{ row.story.revision }} · {{ statusLabel[row.story.status] }}</span><span class="lay-cx-cov lay-push" aria-hidden="true">@for (s of row.scenarios; track $index) { <i [class.lay-cx-has]="s.tests.length"></i> }</span></div>
              @for (s of row.scenarios; track $index) {
                <div class="lay-cx-scn"><div><p class="lay-flat small"><span class="lay-muted">{{ row.story.ref }}/{{ $index + 1 }}</span> <b>Given</b> {{ s.given }}, <b>when</b> {{ s.when }}, <b>then</b> {{ s.then }}.</p>
                  <div class="lay-row lay-wrap">@for (t of s.tests; track t.id) { <a [class]="'lay-chip ' + resultClass(t.symbol, t.old)" [href]="ctx.link('platform', 'explorer', t.id)" (click)="ctx.go(ctx.link('platform', 'explorer', t.id), $event)" [title]="t.path + (result(t.symbol)?.message ? ' · ' + result(t.symbol)?.message : '')"><mat-icon aria-hidden="true">{{ resultIcon(t.symbol) }}</mat-icon>{{ t.symbol }}{{ t.old ? ' · written for an older revision' : '' }}</a> } @empty { <span class="lay-muted small">Nothing checks this yet.</span> }</div></div>
                  <button type="button" class="lay-button ghost small" (click)="changing.set(changing() === row.story.ref + '/' + ($index + 1) ? '' : row.story.ref + '/' + ($index + 1))" [attr.aria-expanded]="changing() === row.story.ref + '/' + ($index + 1)" [attr.aria-label]="'Request a change to the tests for ' + row.story.ref + '/' + ($index + 1)"><mat-icon aria-hidden="true">edit_note</mat-icon></button></div>
                @if (changing() === row.story.ref + '/' + ($index + 1)) { <div class="lay-cx-ask"><textarea rows="2" [(ngModel)]="scenarioNote" [attr.aria-label]="'What is wrong with the tests for ' + row.story.ref + '/' + ($index + 1)" placeholder="What the tests miss, e.g. they check the status code but not what Sam sees"></textarea><button type="button" class="lay-button small" [disabled]="!scenarioNote.trim()" (click)="changeScenario(row.story, $index)">Add to Work</button></div> }
              } @empty { <p class="lay-muted small">No acceptance yet. <a [href]="ctx.link('product', 'map', row.story.id)" (click)="ctx.go(ctx.link('product', 'map', row.story.id), $event)">Write it in Vision</a>.</p> }
              @if (row.whole.length) { <p class="small lay-flat">Whole story: @for (t of row.whole; track t.id) { <a [href]="ctx.link('platform', 'explorer', t.id)" (click)="ctx.go(ctx.link('platform', 'explorer', t.id), $event)">{{ t.symbol }}</a>{{ $last ? '' : ', ' }} }</p> }
            </section>
          } @empty { <p class="lay-muted">No stories yet.</p> }
        </div>
        <div class="lay-grid lay-cx-aside">
          <section class="lay-card"><h2>Other tests</h2>
            @for (group of otherByFile(); track group[0]) { <h3>{{ group[0] }}</h3>@for (t of group[1]; track t.id) { <div class="lay-cx-rel"><a [href]="ctx.link('platform', 'explorer', t.id)" (click)="ctx.go(ctx.link('platform', 'explorer', t.id), $event)"><mat-icon aria-hidden="true">{{ resultIcon(t.symbol) }}</mat-icon>{{ t.symbol }}</a></div> } }
            @empty { <p class="lay-muted small">None. Helpers, security and performance tests show here.</p> }</section>
          <section class="lay-card"><h2>How to read this</h2><ul class="small lay-cx-plain"><li>Agents usually write the tests with the code.</li><li>If a test doesn't really check what its scenario says, request a change on the scenario, as on Pages.</li><li>A test linked to an older revision of its story is marked, like suspect code.</li></ul></section>
        </div>
      </div>
    }
    @case ('docs') {
      <p class="lay-lead">What developers and agents read in the repository. <code>AGENTS.md</code> is the map and <code>docs/</code> holds the rest. Developers own them and assemble them from the layers; <code>docs/.aludel/sources.json</code> records where each section came from, so the docs stay plain Markdown.</p>
      @if (docs(); as d) {
        <div class="lay-row lay-wrap lay-block">
          <span class="lay-chip" [class.lay-ok]="!d.checks.offMap.length" [class.lay-warn]="d.checks.offMap.length">{{ d.checks.offMap.length ? d.checks.offMap.length + ' not linked from AGENTS.md' : 'Every doc linked from AGENTS.md' }}</span>
          <span class="lay-chip" [class.lay-ok]="!d.checks.broken.length" [class.lay-warn]="d.checks.broken.length">{{ d.checks.broken.length ? d.checks.broken.length + ' broken links' : 'No broken links' }}</span>
          <span class="lay-chip" [class.lay-ok]="d.agentsLines && d.agentsLines <= 150" [class.lay-warn]="d.agentsLines > 150" [class.lay-plain]="!d.agentsLines">{{ d.agentsLines ? 'AGENTS.md ' + d.agentsLines + ' lines' : 'No AGENTS.md' }}</span>
          <span class="lay-chip" [class.lay-ok]="!d.checks.refresh" [class.lay-warn]="d.checks.refresh">{{ d.checks.refresh }} sections need a refresh</span>
          <label class="lay-push small lay-cx-toggle"><input type="checkbox" [ngModel]="showSources()" (ngModelChange)="showSources.set($event)"> Show where each section comes from</label>
          @if (!d.sidecar) { <button type="button" class="lay-button small" (click)="starter()"><mat-icon aria-hidden="true">auto_awesome</mat-icon>Write a starter set</button> }
        </div>
        @if (d.docs.length) {
          <div class="lay-ds-editor lay-ds-three lay-cx-docs">
            <div class="lay-ds-tree"><div class="lay-ds-treebody" role="tree" aria-label="Docs">
              @for (doc of d.docs; track doc.path) { <a role="treeitem" class="lay-cx-node" [class.lay-cx-sel]="currentDoc()?.path === doc.path" [style.padding-left.px]="10 + depth(doc.path) * 12" [href]="ctx.link('platform', 'docs', doc.path)" (click)="ctx.go(ctx.link('platform', 'docs', doc.path), $event)"><mat-icon aria-hidden="true">{{ doc.path === 'AGENTS.md' ? 'map' : 'description' }}</mat-icon><span>{{ doc.path }}</span>@if (refreshCount(doc)) { <i class="lay-cx-dot lay-cx-suspect" aria-label="Needs a refresh"></i> }</a> }
            </div></div>
            <article class="lay-cx-md" [class.lay-cx-srcs]="showSources()">
              @if (currentDoc(); as doc) {
                <p class="lay-muted small lay-flat"><code>{{ doc.path }}</code> · {{ doc.lines }} lines{{ doc.onMap ? '' : ' · not linked from AGENTS.md' }}</p>
                @for (block of blocks(); track $index) {
                  @if (block.section >= 0 && isHeading(block.html)) {
                    <div class="lay-cx-sec" [class.lay-cx-sec-on]="sectionIndex() === block.section" [class.lay-cx-refresh]="doc.sections[block.section]?.state === 'refresh'" [class.lay-cx-plainsec]="doc.sections[block.section]?.state === 'plain'">
                      <div class="lay-row"><div class="lay-cx-block" [innerHTML]="block.html"></div><button type="button" class="lay-link-button small lay-push" (click)="sectionIndex.set(block.section)" [attr.aria-pressed]="sectionIndex() === block.section" [attr.aria-label]="'Sources of ' + (doc.sections[block.section]?.heading || '')">Sources</button></div>
                      @if (showSources() && doc.sections[block.section]?.sources?.length) { <div class="lay-row lay-wrap">@for (s of doc.sections[block.section].sources; track s.id) { <aludel-ref [id]="s.id" /> }</div> }
                    </div>
                  } @else { <div class="lay-cx-block" [innerHTML]="block.html"></div> }
                }
              }
            </article>
            <aside class="lay-ds-side lay-cx-insp">
              @if (currentSection(); as s) {
                <div class="lay-row lay-wrap"><h2 class="lay-flat">{{ s.heading }}</h2><span class="lay-chip lay-push" [class.lay-warn]="s.state === 'refresh'" [class.lay-ok]="s.state === 'current'" [class.lay-plain]="s.state === 'plain'">{{ s.state === 'refresh' ? 'Needs a refresh' : s.state === 'current' ? 'Current' : 'No sources recorded' }}</span></div>
                <p class="lay-muted small lay-flat">Maintained by the Engineer · line {{ s.line }}</p>
                <h3>Built from</h3>
                @for (src of s.sources; track src.id) { <div class="lay-cx-why"><div class="lay-row"><aludel-ref [id]="src.id" />@if (src.state !== 'current') { <span class="lay-chip lay-warn lay-push">{{ src.state === 'gone' ? 'Removed' : 'Changed' }}</span> }</div>
                  <small class="lay-muted">{{ src.kind }}{{ src.revision !== null ? ' · written from revision ' + src.revision : '' }}{{ src.state === 'changed' ? ', now ' + src.current : '' }}</small>
                  @if (alsoUsed(src.id).length) { <small class="lay-muted">Also evidence for:</small><div class="lay-row lay-wrap">@for (id of alsoUsed(src.id); track id) { <aludel-ref [id]="id" /> }</div> }</div> }
                @empty { <p class="lay-muted small">Nothing recorded. A developer can cite stories, contracts, tokens or Library findings in the sidecar.</p> }
                @if (s.state === 'refresh') { <button type="button" class="lay-button small" (click)="refresh(s)"><mat-icon aria-hidden="true">autorenew</mat-icon>Ask the Engineer to refresh it</button> }
              }
            </aside>
          </div>
        } @else { <section class="lay-card lay-quiet"><p class="lay-flat">No docs in the repository yet. A starter set writes <code>ARCHITECTURE.md</code> and <code>docs/</code> from Vision, Design and Data, and adds a map to <code>AGENTS.md</code>. Existing files are never overwritten.</p></section> }
      } @else { <p class="lay-muted">Loading…</p> }
    }
    @case ('releases') {
      <p class="lay-lead">Releases are made on purpose, not per commit or merge. Each one names a commit, its notes, the stories it ships, stack changes and new migrations. Deploy runs them.</p>
      <div class="lay-grid lay-cx-rel-grid">
        <section class="lay-card lay-cx-rel-list"><ul class="lay-list">
          @if (draft(); as d) { <li><a class="lay-item" [class.lay-cx-sel]="!releaseRoute()" [href]="ctx.link('platform', 'releases')" (click)="ctx.go(ctx.link('platform', 'releases'), $event)"><mat-icon aria-hidden="true">new_label</mat-icon><span class="lay-body-text"><strong>Next release</strong><small>{{ d.commits.length }} commits since {{ d.since ? 'v' + d.since.version : 'the start' }}</small></span></a></li> }
          @for (r of releases(); track r.id) { <li><a class="lay-item" [class.lay-cx-sel]="releaseRoute() === r.version" [href]="ctx.link('platform', 'releases', r.version)" (click)="ctx.go(ctx.link('platform', 'releases', r.version), $event)"><mat-icon aria-hidden="true">sell</mat-icon><span class="lay-body-text"><strong>v{{ r.version }}</strong><small>{{ r.notes.split('\\n')[0] || r.stories.length + ' stories' }}</small></span>@if (running(r)) { <span class="lay-chip lay-l-deploy">Preview</span> }</a></li> }
        </ul></section>
        @if (release(); as r) {
          <section class="lay-card"><div class="lay-row lay-wrap"><h2 class="lay-flat">v{{ r.version }}</h2><code>{{ r.commit }}</code><span class="lay-muted small">{{ when(r.createdAt) }} · {{ r.createdBy }}</span>@if (running(r)) { <a class="lay-chip lay-l-deploy lay-push" [href]="ctx.link('deploy', 'environments')" (click)="ctx.go(ctx.link('deploy', 'environments'), $event)">Running in Preview</a> }</div>
            @if (r.notes) { <h3>Notes</h3><p class="lay-cx-pre">{{ r.notes }}</p> }
            <h3>Ships</h3><div class="lay-row lay-wrap">@for (id of r.stories; track id) { <aludel-ref [id]="id" /> } @empty { <span class="lay-muted small">No stories named by commit trailers</span> }</div>
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
            <h3>Commits</h3>@for (c of d.commits.slice(0, 12); track c.hash) { <p class="small lay-flat"><code>{{ c.hash }}</code> {{ c.subject }}{{ c.implements ? ' · Implements: ' + c.implements : '' }}</p> } @empty { <p class="lay-muted small">Nothing since the last release.</p> }
            <h3>Ships</h3><div class="lay-row lay-wrap">@for (id of d.stories; track id) { <aludel-ref [id]="id" /> } @empty { <span class="lay-muted small">No stories named by commit trailers</span> }</div>
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
  readonly tabs = [['overview', 'Overview'], ['explorer', 'Explorer'], ['tests', 'Tests'], ['docs', 'Docs'], ['releases', 'Releases']];
  readonly titles: Record<string, string> = { overview: 'How it is built', explorer: 'Explorer', tests: 'Tests', docs: 'Docs', releases: 'Releases' };
  readonly states = ['healthy', 'suspect', 'untraced', 'dead'];
  readonly filters = [['all', 'All'], ['suspect', 'Suspect'], ['untraced', 'Untraced'], ['dead', 'Unused'], ['untested', 'Untested']];
  readonly unitStateLabel = unitStateLabel;
  readonly statusLabel = statusLabel;
  readonly sourceLabel: Record<string, string> = { manifest: 'build manifest', trailer: 'commit trailer', test: 'test name' };
  readonly files = signal<RepoFile[]>([]);
  readonly stack = signal<Stack | null>(null);
  readonly docs = signal<Docs | null>(null);
  readonly releases = signal<CodeRelease[]>([]);
  readonly draft = signal<Draft | null>(null);
  readonly ci = signal<CiResults | null>(null);
  readonly source = signal<string | null>(null);
  readonly sourceError = signal('');
  readonly query = signal('');
  readonly partKey = signal('api');
  readonly open = signal(new Set<string>());
  readonly showSources = signal(true);
  readonly sectionIndex = signal(0);
  readonly changing = signal('');
  changeNote = '';
  scenarioNote = '';
  version = '';
  notes = '';

  // Old tabs (LAY-07B) land on their new homes: architecture → overview, code → explorer, repository → releases.
  readonly tab = computed(() => { const t = this.ctx.segments()[1] || 'overview'; return ({ architecture: 'overview', code: 'explorer', repository: 'releases' } as Record<string, string>)[t] || (this.titles[t] ? t : 'overview'); });
  private readonly rest = computed(() => this.ctx.segments().slice(2));
  readonly unit = computed(() => { const [id] = this.rest(); return this.tab() === 'explorer' && id && !['file', 'for', 'state'].includes(id) ? this.ctx.unitById().get(id) || null : null; });
  readonly file = computed(() => { const [kind, value] = this.rest(); return this.unit()?.path || (this.tab() === 'explorer' && kind === 'file' ? value : '') || ''; });
  readonly filter = computed(() => { const [kind, value] = this.rest(); return kind === 'state' ? value : 'all'; });
  readonly lens = computed(() => { const [kind, value] = this.rest(); return kind === 'for' ? value : ''; });
  readonly units = computed(() => this.ctx.data()?.code.units || []);
  readonly codeUnits = computed(() => this.units().filter(unit => unit.kind !== 'test'));
  readonly services = computed(() => (this.ctx.data()?.services || []).filter(service => service.stories.length));
  readonly latest = computed(() => this.releases()[0] || null);
  readonly releaseRoute = computed(() => this.tab() === 'releases' ? this.rest()[0] || '' : '');
  readonly release = computed(() => this.releases().find(r => r.version === this.releaseRoute()) || null);

  // ---- Overview: parts from the repository's own folders, with the stack from its manifests ----
  readonly parts = computed(() => {
    const files = this.files(); const stack = this.stack(); const has = (prefix: string) => files.some(file => file.path.startsWith(prefix));
    const deps = (stack?.dependencies || []).filter(dep => !dep.name.startsWith('@angular/') || dep.name === '@angular/core' || dep.name === '@angular/material').map(dep => `${dep.name} ${dep.version}`);
    const tables = this.units().filter(unit => unit.kind === 'table');
    const out = [];
    if (has('src/')) out.push({ key: 'web', name: 'Web app', icon: 'web', folder: 'src/', about: 'What people use in the browser.', stack: [...deps, ...(stack?.devDependencies || []).filter(dep => ['vite', 'typescript', 'sass'].includes(dep.name)).map(dep => `${dep.name} ${dep.version} (build)`)], units: this.codeUnits().filter(unit => unit.path.startsWith('src/')) });
    if (has('server/')) out.push({ key: 'api', name: 'API server', icon: 'api', folder: 'server/', about: 'Answers /api requests and stores records.', stack: [stack?.node ? `Node.js ${stack.node}` : 'Node.js'], units: this.codeUnits().filter(unit => unit.path.startsWith('server/') && unit.kind !== 'table') });
    if (tables.length || has('db/')) out.push({ key: 'db', name: 'Database', icon: 'database', folder: 'db/', about: 'Tables for the Data objects; what each holds is defined in Data. Each environment has its own.', stack: ['SQLite'], units: tables });
    if (has('tests/')) out.push({ key: 'tests', name: 'Tests', icon: 'fact_check', folder: 'tests/', about: 'Checks for stories and for everything else.', stack: [...(stack?.ci.length ? ['CI: ' + stack.ci.join(', ')] : [])], units: this.units().filter(unit => unit.kind === 'test') });
    if (stack?.images.length) out.push({ key: 'run', name: 'Container', icon: 'deployed_code', folder: '', about: `Built by the Dockerfile${stack.composeServices.length ? '; compose.yaml runs it anywhere' : ''}.${stack.healthcheck ? ' It declares a health check.' : ''}`, stack: [...new Set(stack.images)].map(image => `Image ${image}`), units: [] as CodeUnit[] });
    return out;
  });
  readonly part = computed(() => this.parts().find(p => p.key === this.partKey()) || this.parts()[0] || null);
  readonly storyRows = computed(() => (this.ctx.data()?.stories || []).map(story => {
    const built = this.ctx.builtBy().get(story.id); const scenarios = this.scenariosFor(story);
    return { story, units: built?.units || 0, tests: built?.tests || 0, suspect: Boolean(built?.suspect), scenarios: scenarios.length, tested: scenarios.filter(s => s.tests.length).length };
  }));

  // ---- Tests: scenarios from Vision, tests by name ----
  private readonly testUnits = computed(() => this.units().filter(unit => unit.kind === 'test'));
  scenariosFor(story: Story) {
    const tests = this.testUnits();
    return (story.acceptance || []).map((scenario, index) => ({ ...scenario, tests: tests.filter(test => new RegExp(`^${story.ref}/${index + 1}\\b`).test(test.symbol)).map(test => ({ ...test, old: test.links.some(link => link.recordId === story.id && link.state === 'suspect') })) }));
  }
  readonly storyTests = computed(() => (this.ctx.data()?.stories || []).map(story => ({ story, scenarios: this.scenariosFor(story),
    whole: this.testUnits().filter(test => new RegExp(`^${story.ref}\\b(?!/)`).test(test.symbol)) })));
  readonly scenarioCount = computed(() => this.storyTests().reduce((n, row) => n + row.scenarios.length, 0));
  readonly testedCount = computed(() => this.storyTests().reduce((n, row) => n + row.scenarios.filter(s => s.tests.length).length, 0));
  readonly otherTests = computed(() => this.testUnits().filter(test => !/^S\d+\b/.test(test.symbol)));
  readonly otherByFile = computed(() => { const groups = new Map<string, CodeUnit[]>(); for (const test of this.otherTests()) groups.set(test.path, [...(groups.get(test.path) || []), test]); return [...groups.entries()]; });

  // ---- Explorer: folders → files → chunks ----
  readonly lensUnits = computed(() => new Set(this.lens() ? this.units().filter(unit => unit.links.some(link => link.recordId === this.lens())).map(unit => unit.id) : []));
  readonly lensFiles = computed(() => new Set(this.units().filter(unit => this.lensUnits().has(unit.id)).map(unit => unit.path)));
  readonly lensOptions = computed(() => { const ids = new Set(this.units().flatMap(unit => unit.links.map(link => link.recordId))); return [...ids].map(id => ({ id, label: this.ctx.recordLabel(id)[0] })).sort((a, b) => a.label.localeCompare(b.label)); });
  private matches(unit: CodeUnit) {
    const q = this.query().trim().toLowerCase(); const f = this.filter();
    if (q && !unit.symbol.toLowerCase().includes(q) && !unit.path.toLowerCase().includes(q)) return false;
    if (f === 'all') return true;
    if (f === 'untested') return !['test', 'table', 'const'].includes(unit.kind) && !this.testsFor(unit).length;
    return unit.state === f;
  }
  readonly treeRows = computed(() => {
    const q = this.query().trim().toLowerCase(); const filtering = Boolean(q) || this.filter() !== 'all'; const open = this.open(); const lensed = this.lensUnits();
    const byFile = new Map<string, CodeUnit[]>(); for (const unit of this.units()) byFile.set(unit.path, [...(byFile.get(unit.path) || []), unit]);
    const selected = this.file();
    const visible = this.files().map(file => file.path).filter(path => !filtering || (byFile.get(path) || []).some(unit => this.matches(unit)) || (q && this.filter() === 'all' && path.toLowerCase().includes(q)));
    const rows: TreeRow[] = []; const seen = new Set<string>();
    for (const path of visible.sort()) {
      const parts = path.split('/');
      let hidden = false;
      for (let i = 0; i < parts.length - 1; i++) {
        const dir = parts.slice(0, i + 1).join('/') + '/';
        const isOpen = open.has(dir) || filtering || selected.startsWith(dir) || [...this.lensFiles()].some(f => f.startsWith(dir));
        if (!seen.has(dir) && !hidden) { seen.add(dir); const inside = [...byFile.entries()].filter(([p]) => p.startsWith(dir)).flatMap(([, us]) => us); rows.push({ key: dir, depth: i, kind: 'dir', name: parts[i], path: dir, open: isOpen, worst: inside.some(u => u.state === 'suspect') ? 'suspect' : '' }); }
        if (!isOpen) hidden = true;
      }
      if (hidden) continue;
      const units = (byFile.get(path) || []).sort((a, b) => a.line - b.line);
      const fileOpen = open.has('f:' + path) || selected === path || filtering || units.some(u => lensed.has(u.id));
      const worst = units.map(u => u.state).sort((a, b) => stateOrder[a] - stateOrder[b])[0] || '';
      rows.push({ key: path, depth: parts.length - 1, kind: 'file', name: parts[parts.length - 1], path, open: fileOpen, count: units.length, worst });
      if (fileOpen) for (const unit of units.filter(u => this.matches(u))) rows.push({ key: unit.id, depth: parts.length - 1, kind: 'unit', name: unit.symbol, path, unit, lensed: lensed.has(unit.id) });
    }
    return rows;
  });
  readonly fileUnits = computed(() => this.units().filter(unit => unit.path === this.file()).sort((a, b) => a.line - b.line));
  readonly fileRecords = computed(() => [...new Set(this.fileUnits().flatMap(unit => unit.links.map(link => link.recordId)))]);
  readonly runFile = computed(() => ['Dockerfile', 'compose.yaml', '.env.example', 'package.json'].includes(this.file()));
  readonly sourceLines = computed(() => {
    const text = this.source(); if (text === null) return [];
    const units = this.fileUnits(); const selected = this.unit(); const lensed = this.lensUnits();
    return text.replace(/\n$/, '').split('\n').map((line, index) => {
      const n = index + 1; const owner = units.filter(unit => n >= unit.line && n <= unit.endLine).sort((a, b) => (a.endLine - a.line) - (b.endLine - b.line))[0] || null;
      return { html: highlight(line) || ' ', owner, selected: Boolean(selected && n >= selected.line && n <= selected.endLine), lensed: Boolean(owner && lensed.has(owner.id)) };
    });
  });
  readonly githubUrl = computed(() => { const repo = this.ctx.setup()?.github?.repository; return repo?.html_url && this.file() ? `${repo.html_url}/blob/HEAD/${this.file()}${this.unit() ? '#L' + this.unit()?.line + '-L' + this.unit()?.endLine : ''}` : ''; });

  // ---- Docs ----
  readonly currentDoc = computed(() => { const docs = this.docs()?.docs || []; const path = this.tab() === 'docs' ? this.rest()[0] : ''; return docs.find(doc => doc.path === path) || docs.find(doc => doc.path === 'AGENTS.md') || docs[0] || null; });
  readonly blocks = computed(() => markdownBlocks(this.currentDoc()?.text || ''));
  readonly currentSection = computed(() => this.currentDoc()?.sections[this.sectionIndex()] || this.currentDoc()?.sections[0] || null);

  constructor() {
    // Source loads for the file in the route; the selected chunk scrolls into view once it has rendered.
    effect(() => { const path = this.file(); untracked(() => void this.loadSource(path)); });
    // Only the source pane scrolls to the chunk; the page stays where it is.
    effect(() => { const unit = this.unit(); this.sourceLines(); if (unit) untracked(() => setTimeout(() => { const row = document.getElementById(`cx-line-${unit.line}`); const pane = row?.closest('.lay-cx-src'); if (row && pane) pane.scrollTop = Math.max(0, row.offsetTop - pane.clientHeight / 3); })); });
    effect(() => { this.currentDoc(); untracked(() => this.sectionIndex.set(0)); });
    effect(() => { const tab = this.tab(); untracked(() => { if (tab === 'docs' || tab === 'overview') void this.loadDocs(); if (tab === 'releases' || tab === 'overview') void this.loadReleases(); if ((tab === 'tests' || tab === 'overview') && !this.ci()) void this.loadCi(); }); });
  }
  async ngOnInit() {
    try { const value = await this.ctx.api<{ files: RepoFile[]; stack: Stack }>(`${this.base()}/code/files`); this.files.set(value.files); this.stack.set(value.stack); }
    catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  }
  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}`; }
  async loadSource(path: string) {
    this.source.set(null); this.sourceError.set('');
    if (!path) return;
    try { this.source.set((await this.ctx.api<{ text: string }>(`${this.base()}/code/file?path=${encodeURIComponent(path)}`)).text); }
    catch (error) { this.sourceError.set(error instanceof Error ? error.message : String(error)); }
  }
  async loadDocs() { try { this.docs.set(await this.ctx.api<Docs>(`${this.base()}/code/docs`)); } catch { this.docs.set({ docs: [], sidecar: false, agentsLines: 0, checks: { offMap: [], broken: [], refresh: 0 } }); } }
  async loadCi() { try { this.ci.set(await this.ctx.api<CiResults>(`${this.base()}/code/ci`)); } catch { this.ci.set({ state: 'unavailable' }); } }
  async loadReleases() { try { const value = await this.ctx.api<{ releases: CodeRelease[]; draft: Draft | null }>(`${this.base()}/code/releases`); this.releases.set(value.releases); this.draft.set(value.draft); } catch { this.releases.set([]); this.draft.set(null); } }

  openFile(path: string, event: Event) {
    event.preventDefault();
    if (this.file() === path && !this.unit()) { this.toggle('f:' + path); return; }
    this.open.update(set => new Set(set).add('f:' + path));
    this.ctx.go(this.ctx.link('platform', 'explorer', 'file', path));
  }
  toggle(key: string) { this.open.update(set => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  setLens(id: string) { this.ctx.go(id ? this.ctx.link('platform', 'explorer', 'for', id) : this.ctx.link('platform', 'explorer')); }
  requestChange() {
    const unit = this.unit(); const about = unit ? `${unit.symbol} (${unit.path}:${unit.line})` : this.file();
    const targets = (unit ? unit.links.map(link => link.recordId) : this.fileRecords()).filter((id, i, all) => all.indexOf(id) === i).map(id => ({ id, label: this.ctx.recordLabel(id)[0] }));
    const note = this.changeNote.trim();
    void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/work`, 'POST', { action: 'platform.implement', title: `Change ${about}`.slice(0, 160), targets, suggestion: note }); this.changeNote = ''; }, 'Added to Work for the Engineer.');
  }
  changeScenario(story: Story, index: number) {
    const note = this.scenarioNote.trim(); if (!note) return;
    void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/work`, 'POST', { action: 'platform.implement', title: `Tests for ${story.ref}/${index + 1}: ${note}`.slice(0, 160), targets: [{ id: story.id, label: `${story.ref} ${story.title}` }], suggestion: note }); this.scenarioNote = ''; this.changing.set(''); }, 'Added to Work for the Engineer.');
  }
  writeTests() {
    const missing = this.storyTests().flatMap(row => row.scenarios.map((s, i) => [row.story, i, s.tests.length] as const)).filter(entry => !entry[2]);
    const stories = [...new Set(missing.map(entry => entry[0]))];
    void this.ctx.write(() => this.ctx.api(`${this.base()}/work`, 'POST', { action: 'platform.implement', title: `Tests for ${missing.length} scenarios with none`.slice(0, 160), targets: stories.map(story => ({ id: story.id, label: `${story.ref} ${story.title}` })),
      suggestion: missing.map(entry => `${entry[0].ref}/${entry[1] + 1}`).join(', ') }), 'Added to Work for the Engineer.');
  }
  starter() { void this.ctx.write(async () => { const result = await this.ctx.api<{ written: string[] }>(`${this.base()}/code/docs-starter`, 'POST', {}); await this.loadDocs(); this.ctx.notice.set(`Wrote ${result.written.length} files. They are committed with the next build.`); }); }
  refresh(section: DocSection) {
    const doc = this.currentDoc(); if (!doc) return;
    void this.ctx.write(() => this.ctx.api(`${this.base()}/code/docs-refresh`, 'POST', { path: doc.path, heading: section.heading }), 'Added to Work for the Engineer.');
  }
  recordRelease() {
    const version = this.version.trim() || this.draft()?.suggested || '';
    void this.ctx.write(async () => { const r = await this.ctx.api<CodeRelease>(`${this.base()}/code/releases`, 'POST', { version, notes: this.notes }); this.version = ''; this.notes = ''; await this.loadReleases(); this.ctx.go(this.ctx.link('platform', 'releases', r.version)); }, 'Recorded.');
  }
  publish(release: CodeRelease) { void this.ctx.write(async () => { await this.ctx.api(`${this.base()}/code/releases-publish`, 'POST', { version: release.version }); await this.loadReleases(); }, `Published v${release.version} to GitHub.`); }
  readonly repoReady = computed(() => this.ctx.setup()?.github?.repository?.status === 'ready');
  readonly imageName = computed(() => { const repo = this.ctx.setup()?.github?.repository; return repo ? `ghcr.io/${repo.owner}/${repo.name}`.toLowerCase() : ''; });
  result(name: string) { return this.ci()?.tests?.find(test => test.name === name) || null; }
  resultClass(name: string, old = false) { const r = this.result(name)?.result; return r === 'pass' ? 'lay-ok' : r === 'fail' ? 'lay-bad' : old ? 'lay-warn' : 'lay-l-platform'; }
  resultIcon(name: string) { const r = this.result(name)?.result; return r === 'pass' ? 'check' : r === 'fail' ? 'close' : 'fact_check'; }
  ciCount(result: string) { return (this.ci()?.tests || []).filter(test => test.result === result).length; }
  ciNote() { const state = this.ci()?.state; return state === 'no-permission' ? 'Results need the GitHub App\'s Actions permission.' : state === 'no-github' ? 'Results come from CI on GitHub.' : state === 'no-run' ? 'No CI run for the latest commit yet.' : 'Results appear once CI reports them.'; }
  reindex() { void this.ctx.write(() => this.ctx.api(`${this.base()}/code/index`, 'POST', {}), 'Read the code again.'); }

  rollup(units: CodeUnit[]) { const c: Record<string, number> = { healthy: 0, suspect: 0, untraced: 0, dead: 0 }; for (const unit of units) c[unit.state]++; return c; }
  // Suspect and unused first, then the chunks people look for: handlers, components and routes before helpers and constants.
  sorted(units: CodeUnit[]) { const kind = (k: string) => ['handler', 'component', 'route', 'table', 'function', 'class', 'const', 'test'].indexOf(k); return [...units].sort((a, b) => Math.min(stateOrder[a.state], 2) - Math.min(stateOrder[b.state], 2) || kind(a.kind) - kind(b.kind)); }
  stateClass(state: string) { return state === 'healthy' ? 'lay-ok' : state === 'suspect' ? 'lay-warn' : state === 'dead' ? 'lay-bad' : 'lay-plain'; }
  icon(kind: string) { return unitIcon[kind] || 'code'; }
  testsFor(unit: CodeUnit) { const records = new Set(unit.links.map(link => link.recordId)); return this.testUnits().filter(other => other.id !== unit.id && (other.calls.includes(unit.id) || other.links.some(link => records.has(link.recordId)))); }
  workFor(unit: CodeUnit) { const records = new Set(unit.links.map(link => link.recordId)); return (this.ctx.data()?.work || []).filter(item => item.layer === 'platform' && item.status !== 'done' && item.targets.some(target => records.has(target.id))).slice(0, 5); }
  running(release: CodeRelease) { const commit = this.ctx.setup()?.preview?.commit || ''; return Boolean(commit && (commit.startsWith(release.commit) || release.commit.startsWith(commit.slice(0, 7)))); }
  first(release: CodeRelease) { return this.releases().at(-1)?.id === release.id; }
  refreshCount(doc: RepoDoc) { return doc.sections.filter(section => section.state === 'refresh').length; }
  // A finding or insight used elsewhere: the records it is evidence for, other than docs.
  alsoUsed(id: string) { return [...new Set((this.ctx.data()?.evidence || []).filter(link => link.insightId === id || link.sourceRef === id).map(link => link.recordId))].slice(0, 6); }
  isHeading(html: string) { return /^<h\d/.test(html); }
  depth(path: string) { return path.split('/').length - 1; }
  fileName(path: string) { return path.split('/').pop(); }
  when(at: string) { return new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
}
