import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Flow, FlowStep, Page, ProjectContext } from './context';
import { PageRenderComponent } from './pages-render';
import { MapView, Place, PagesState, autoPlaces, blankPage, buildLabel, buildOf, mapCell, mapGap, missingStories, stepBuild } from './pages-model';

interface Rect { x: number; y: number; w: number; h: number; }
interface Drawn { key: string; from: string; to: string; label: string; d: string; mx: number; my: number; kind: '' | 'on' | 'dim' | 'missing'; spec: boolean; }
type Drag = { kind: 'pan'; sx: number; sy: number; cx: number; cy: number }
  | { kind: 'move'; ids: Set<string>; sx: number; sy: number; dx: number; dy: number; moved: boolean; field: HTMLElement | null }
  | { kind: 'link'; from: string; x: number; y: number; over: string | null }
  | { kind: 'box'; x0: number; y0: number; x1: number; y1: number; base: Set<string> };

// Pages › Map (PAGES-UX-01, M1-M7): the Experience designer's planning canvas. Every page sits in a grid cell sized to what the
// map shows, so spacing stays even. Pages drag between cells, links are drawn from a page's handle, page blanks hold a title
// and a note until someone specs them, and the Flows sidebar edits a flow on the canvas.
@Component({
  selector: 'aludel-pages-map', standalone: true,
  imports: [FormsModule, MatIconModule, PageRenderComponent],
  template: `
  <div class="lay-pg-mapwrap">
    <div class="lay-pg-vp" #vp [class.lay-pg-hand]="tool() === 'hand' || space()" [class.lay-pg-panning]="drag()?.kind === 'pan'" [class.lay-pg-connecting]="drag()?.kind === 'link'"
      (pointerdown)="down($event)" (wheel)="wheel($event)" (dblclick)="dbl($event)" [style.background-size]="grid()" [style.background-position]="cam().x + 'px ' + cam().y + 'px'" aria-label="Map of the app's pages">
      <div class="lay-pg-world" [style.transform]="'translate(' + cam().x + 'px,' + cam().y + 'px) scale(' + cam().z + ')'">
        @for (g of ghosts(); track g.id) { <div class="lay-pg-ghost" [class.lay-pg-bad]="g.bad" [style.left.px]="g.x" [style.top.px]="g.y" [style.width.px]="cell().w" [style.height.px]="cell().h"></div> }
        <svg class="lay-pg-links" aria-hidden="true">
          <defs>@for (m of markers; track m[0]) { <marker [attr.id]="'pgm-' + m[0]" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" [attr.fill]="m[1]"/></marker> }</defs>
          @for (l of drawn(); track l.key) {
            <path [attr.d]="l.d" [class]="'lay-pg-lk lay-pg-lk-' + (l.kind || 'plain') + (selLink() === l.key ? ' lay-pg-lk-sel' : '')" [attr.marker-end]="'url(#pgm-' + (selLink() === l.key ? 'sel' : l.kind || 'plain') + ')'" />
            @if (l.kind !== 'missing') { <path [attr.d]="l.d" class="lay-pg-hit" [attr.data-link]="l.key" /> }
          }
          @if (temp(); as t) { <path [attr.d]="t" class="lay-pg-lk lay-pg-lk-temp" marker-end="url(#pgm-sel)" /> }
        </svg>
        @for (l of drawn(); track l.key) {
          <span class="lay-pg-llabel" [class]="'lay-pg-llabel lay-pg-ll-' + (l.kind || 'plain') + (selLink() === l.key ? ' lay-pg-ll-sel' : '')" [style.left.px]="l.mx" [style.top.px]="l.my" [attr.data-link]="l.kind === 'missing' ? null : l.key"
            [attr.title]="l.kind === 'missing' ? 'The flow goes here, but no link is drawn' : l.spec ? 'In the spec (a section leads here)' : 'Planned · double-click to rename'">
            @if (renaming() === l.key) { <input [ngModel]="l.label" (keydown.enter)="rename(l, $any($event.target).value)" (keydown.escape)="renaming.set(null)" (blur)="rename(l, $any($event.target).value)" (focus)="$any($event.target).select()" aria-label="What does someone do to get there?" autofocus> }
            @else { {{ l.label }} }</span>
        }
        @for (p of pages(); track p.id) {
          @let r = rect(p.id);
          <div class="lay-pg-node" [class.lay-pg-planned]="p.status === 'planned' && !built(p)" [class.lay-pg-sel]="msel().has(p.id)" [class.lay-pg-dragging]="dragging(p.id)" [class.lay-pg-target]="linkTarget() === p.id"
            [class.lay-pg-inflow]="!!flow() && stepsOf(p.id).length" [class.lay-pg-dimmed]="!!flow() && !stepsOf(p.id).length"
            [attr.data-node]="p.id" [style.left.px]="r.x" [style.top.px]="r.y" [style.width.px]="r.w" [style.height.px]="r.h">
            @if (stepsOf(p.id).length) { <span class="lay-pg-nstep">@for (n of stepsOf(p.id); track n) { <b>{{ n }}</b> }</span> }
            @if (flow()) { <button type="button" class="lay-pg-addstep" (click)="addStep(p)"><mat-icon aria-hidden="true">add</mat-icon>Step</button> }
            <div class="lay-pg-nhead"><mat-icon aria-hidden="true">{{ p.status === 'planned' && !built(p) ? 'edit_document' : p.icon }}</mat-icon>
              @if (isBlank(p)) { <input class="lay-pg-ntitle" [attr.data-title]="p.id" [ngModel]="p.label" (blur)="saveTitle(p, $any($event.target).value)" (keydown.enter)="$any($event.target).blur()" maxlength="30" aria-label="Page title"> }
              @else { <span class="lay-pg-nt">{{ p.label }}</span> }
              <button type="button" class="lay-pg-ob" (click)="openPage(p.id)" [attr.aria-label]="'Open ' + p.label + ' in Pages'" title="Open in Pages"><mat-icon aria-hidden="true">open_in_new</mat-icon></button></div>
            @if (isBlank(p)) {
              <div class="lay-pg-nbody lay-pg-blank">
                <textarea class="lay-pg-nnote" [ngModel]="p.notes" (blur)="saveNote(p, $any($event.target).value)" placeholder="What happens here, and for whom?" aria-label="Note"></textarea>
                <div class="lay-pg-nstories">@for (id of p.stories; track id) { <span class="lay-chip lay-plain">{{ ctx.storyById().get(id)?.ref }}</span> }
                  <select (change)="addStory(p, $any($event.target).value); $any($event.target).value = ''" aria-label="Link a story"><option value="">+ Story</option>@for (story of ctx.data()?.stories || []; track story.id) { @if (!p.stories.includes(story.id)) { <option [value]="story.id">{{ story.ref }} {{ story.title }}</option> } }</select></div>
              </div>
            } @else {
              <div class="lay-pg-nbody">
                @if (view() !== 'phone') { <div class="lay-pg-nth" inert [style.width.px]="thumb().dw" [style.height.px]="thumb().h"><div class="lay-pg-tapp" [style.width.px]="980" [style.transform]="'scale(' + thumb().dw / 980 + ')'"><aludel-page-render [page]="p" [viewer]="state.as()" /></div></div> }
                @if (view() !== 'desktop') { <div class="lay-pg-nth" inert [style.width.px]="thumb().pw" [style.height.px]="thumb().h"><div class="lay-pg-tapp" [style.width.px]="390" [style.transform]="'scale(' + thumb().pw / 390 + ')'"><aludel-page-render [page]="p" [viewer]="state.as()" [phone]="true" /></div></div> }
              </div>
            }
            <div class="lay-pg-nfoot"><span [class]="'lay-chip lay-pg-c-' + build(p)">{{ buildLabel[build(p)] }}</span>@if (p.inNav) { <span class="lay-chip lay-plain">In nav</span> }
              @if (!isBlank(p)) { @for (id of p.stories; track id) { <span class="lay-chip lay-plain">{{ ctx.storyById().get(id)?.ref }}</span> } }</div>
            <span class="lay-pg-handle" [attr.data-handle]="p.id" title="Drag to another page to link them"></span>
          </div>
        }
        @if (box(); as b) { <div class="lay-pg-marquee" [style.left.px]="b.x" [style.top.px]="b.y" [style.width.px]="b.w" [style.height.px]="b.h"></div> }
      </div>
      <div class="lay-pg-tools">
        <div class="lay-pg-tg" role="group" aria-label="Tool"><button type="button" [attr.aria-pressed]="tool() === 'select'" (click)="tool.set('select')" title="Select (V)" aria-label="Select"><mat-icon aria-hidden="true">arrow_selector_tool</mat-icon></button><button type="button" [attr.aria-pressed]="tool() === 'hand'" (click)="tool.set('hand')" title="Pan (H, or hold Space)" aria-label="Pan"><mat-icon aria-hidden="true">pan_tool</mat-icon></button></div>
        <div class="lay-pg-tg"><button type="button" (click)="newBlank()"><mat-icon aria-hidden="true">add_box</mat-icon>Page blank</button></div>
        <div class="lay-pg-tg" role="group" aria-label="Show">@for (v of views; track v[0]) { <button type="button" [attr.aria-pressed]="view() === v[0]" (click)="setView(v[0])" [attr.aria-label]="v[2]"><mat-icon aria-hidden="true">{{ v[1] }}</mat-icon><span>{{ v[2] }}</span></button> }</div>
        <div class="lay-pg-tg lay-push"><button type="button" (click)="zoomBy(0.8)" aria-label="Zoom out"><mat-icon aria-hidden="true">remove</mat-icon></button><span class="lay-pg-z">{{ zoomLabel() }}</span><button type="button" (click)="zoomBy(1.25)" aria-label="Zoom in"><mat-icon aria-hidden="true">add</mat-icon></button><button type="button" (click)="fit()"><mat-icon aria-hidden="true">fit_screen</mat-icon>Fit</button></div>
      </div>
      @if (flow(); as f) { <div class="lay-pg-fbanner"><mat-icon aria-hidden="true">route</mat-icon>Editing <strong>{{ f.title }}</strong> · “+ Step” adds a page · a link from the last step extends it<button type="button" (click)="flowId.set(null)">Done</button></div> }
      <p class="lay-pg-hint">Scroll to pan · {{ mod }} + scroll to zoom · drag empty space to select · drag ● to link · Delete removes</p>
    </div>

    <aside class="lay-pg-flows" aria-label="Flows">
      <div class="lay-row"><h2>Flows</h2><button type="button" class="lay-button ghost small lay-push" (click)="newFlow()"><mat-icon aria-hidden="true">add</mat-icon>New flow</button></div>
      <div class="lay-pg-legend"><span><i class="lay-pg-st-built"></i>Built</span><span><i class="lay-pg-st-specified"></i>Specified</span><span><i class="lay-pg-st-planned"></i>Planned</span><span><i class="lay-pg-st-gap"></i>Missing</span></div>
      @for (f of flows(); track f.id) {
        @let missing = missingOf(f);
        <div class="lay-pg-frow" [class.lay-pg-on]="flow()?.id === f.id">
          <button type="button" class="lay-pg-fhd" (click)="toggleFlow(f.id)" [attr.aria-expanded]="flow()?.id === f.id">
            <span class="lay-row"><strong>{{ f.title }}</strong><small class="lay-muted">{{ personaOf(f) }}</small>@if (f.review.state === 'done') { <span class="lay-chip lay-push" [class.lay-pg-c-built]="f.review.verdict === 'Works'">{{ f.review.verdict }}</span> } @else if (f.review.state === 'progress') { <span class="lay-chip lay-plain lay-push">In review</span> }</span>
            <span class="lay-pg-sbar">@for (s of f.steps; track $index) { <i [class]="'lay-pg-st-' + stepBuild(ctx, s)"></i> }@for (m of missing; track m) { <i class="lay-pg-st-gap"></i> }@if (!f.steps.length && !missing.length) { <i class="lay-pg-st-none"></i> }</span>
            <small class="lay-muted">{{ summary(f, missing) }}</small>
          </button>
          @if (flow()?.id === f.id) {
            <div class="lay-pg-fedit">
              <label class="lay-pg-inline">Name<input [ngModel]="f.title" (blur)="renameFlow(f, $any($event.target).value)" maxlength="60"></label>
              <ol class="lay-pg-steps">
                @for (s of f.steps; track $index; let i = $index; let last = $last) {
                  @if (i) { <li class="lay-pg-sconn" [class.lay-pg-miss]="linkMissing(f.steps[i - 1], s)"><mat-icon aria-hidden="true">south</mat-icon>{{ trigger(f.steps[i - 1], s) }}</li> }
                  <li class="lay-pg-srow"><span class="lay-pg-n">{{ i + 1 }}</span>
                    <span>@if (s.page) { <strong>{{ ctx.pageById().get(s.page)?.label }}</strong> } @else { <strong class="lay-pg-warntext">{{ s.name || 'Missing page' }}</strong> <small>no page</small> } <small class="lay-muted">{{ s.page ? s.name : '' }}</small></span>
                    <span class="lay-pg-sctl">@if (!s.page) { <button type="button" (click)="fillGap(f, i)" title="Add a page blank for this step" aria-label="Add a page blank"><mat-icon aria-hidden="true">add_box</mat-icon></button> }
                      <button type="button" (click)="moveStep(f, i)" [disabled]="i === 0" aria-label="Move up"><mat-icon aria-hidden="true">arrow_upward</mat-icon></button><button type="button" (click)="removeStep(f, i)" aria-label="Remove step"><mat-icon aria-hidden="true">close</mat-icon></button></span></li>
                }
              </ol>
              @if (!f.steps.length) { <p class="lay-muted small">No steps yet. Click “+ Step” on a page, or add a page blank below.</p> }
              @if (missing.length) {
                <div class="lay-pg-missing"><strong><mat-icon aria-hidden="true">warning</mat-icon>Stories with no page</strong>
                  @for (id of missing; track id) { <div class="lay-row"><span class="small"><b>{{ ctx.storyById().get(id)?.ref }}</b> {{ ctx.storyById().get(id)?.title }}</span><button type="button" class="lay-button ghost small lay-push" (click)="blankFor(f, id)"><mat-icon aria-hidden="true">add_box</mat-icon>Blank</button></div> }</div>
              }
              <div class="lay-row"><a class="lay-button ghost small" [href]="ctx.link('pages', 'flows', f.id)" (click)="ctx.go(ctx.link('pages', 'flows', f.id), $event)"><mat-icon aria-hidden="true">play_circle</mat-icon>Walk through</a>
                @if (!f.activity) { <button type="button" class="lay-link-button" (click)="deleteFlow(f)">Delete flow</button> }
                <button type="button" class="lay-button ghost small lay-push" (click)="flowId.set(null)">Done</button></div>
            </div>
          }
        </div>
      } @empty { <p class="lay-muted small">No flows yet. Add activities to the story map, or start a new flow.</p> }
    </aside>
  </div>`
})
export class PagesMapComponent {
  readonly ctx = inject(ProjectContext);
  readonly state = inject(PagesState);
  readonly buildLabel = buildLabel;
  readonly stepBuild = stepBuild;
  readonly vp = viewChild<ElementRef<HTMLElement>>('vp');
  readonly views: [MapView, string, string][] = [['desktop', 'desktop_windows', 'Desktop'], ['phone', 'mobile', 'Phone'], ['both', 'devices', 'Both']];
  readonly markers = [['plain', '#98a3bd'], ['on', '#2a7230'], ['sel', '#3047b9'], ['missing', '#e39b00'], ['dim', '#98a3bd']];
  readonly mod = /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl';
  readonly view = signal<MapView>('both');
  readonly tool = signal<'select' | 'hand'>('select');
  readonly space = signal(false);
  readonly cam = signal({ x: 0, y: 0, z: 0.5 });
  readonly msel = signal(new Set<string>());
  readonly selLink = signal<string | null>(null);
  readonly renaming = signal<string | null>(null);
  readonly flowId = signal<string | null>(null);
  readonly drag = signal<Drag | null>(null);
  // Places saved while the write is in flight, so moved pages don't jump back.
  readonly pending = signal<Record<string, Place>>({});

  readonly pages = computed(() => this.ctx.data()?.pages || []);
  readonly flows = computed(() => this.ctx.data()?.flows || []);
  readonly flow = computed(() => this.flows().find(flow => flow.id === this.flowId()) || null);
  readonly cell = computed(() => mapCell[this.view()]);
  readonly places = computed(() => autoPlaces(this.pages(), { ...(this.ctx.data()?.pageMap?.places || {}), ...this.pending() }));
  readonly thumb = computed(() => { const { w, h } = this.cell(), v = this.view(); const pw = v === 'both' ? 118 : w - 18; return { h: h - 18 - 24 - 20 - 12, pw, dw: v === 'both' ? w - 18 - 8 - pw : w - 18 }; });
  readonly grid = computed(() => { const g = 24 * this.cam().z; return `${g}px ${g}px`; });
  readonly zoomLabel = computed(() => `${Math.round(this.cam().z * 100)}%`);
  readonly linkTarget = computed(() => { const d = this.drag(); return d?.kind === 'link' ? d.over : null; });
  readonly box = computed(() => { const d = this.drag(); return d?.kind === 'box' ? { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) } : null; });
  readonly ghosts = computed(() => { const d = this.drag(); if (d?.kind !== 'move' || !d.moved) return []; return this.snap(d).list.map(([id, col, row, bad]) => { const [x, y] = this.cellXY(Math.max(0, col), Math.max(0, row)); return { id, x, y, bad }; }); });
  readonly temp = computed(() => { const d = this.drag(); if (d?.kind !== 'link') return null; const a = this.rect(d.from); const x1 = a.x + a.w, y1 = a.y + a.h / 2; return `M${x1},${y1} C${x1 + 80},${y1} ${d.x - 80},${d.y} ${d.x},${d.y}`; });

  constructor() {
    afterNextRender(() => this.fit(true));
    // Flows › "Edit this flow on the Map".
    const handed = this.state.mapFlow(); if (handed) { this.flowId.set(handed); this.state.mapFlow.set(null); }
    const keydown = (event: KeyboardEvent) => this.key(event);
    const keyup = (event: KeyboardEvent) => { if (event.key === ' ') this.space.set(false); };
    document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup);
    inject(DestroyRef).onDestroy(() => { document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); window.removeEventListener('pointermove', this.moveListener); });
  }

  build(page: Page) { return buildOf(this.ctx, page); }
  built(page: Page) { return this.build(page) === 'built'; }
  isBlank(page: Page) { return page.status === 'planned' && !page.inNav && !page.sections.length && !this.built(page); }
  personaOf(flow: Flow) { return flow.persona ? this.state.asName(flow.persona) : this.ctx.data()?.activities.find(entry => entry.id === flow.activity)?.persona || ''; }
  missingOf(flow: Flow) { return missingStories(this.ctx, flow); }
  summary(flow: Flow, missing: string[]) {
    const kinds = flow.steps.map(step => stepBuild(this.ctx, step));
    const counts: [number, string][] = [...(['built', 'specified', 'planned'] as const).map(key => [kinds.filter(kind => kind === key).length, key] as [number, string]),
      [kinds.filter(kind => kind === 'gap').length + missing.length, 'missing']];
    const parts = counts.filter(([count]) => count).map(([count, label]) => `${count} ${label}`);
    return parts.join(' · ') || 'No steps yet';
  }
  stepsOf(id: string) { const flow = this.flow(); return flow ? flow.steps.map((step, index) => step.page === id ? index + 1 : 0).filter(Boolean) : []; }
  cellXY(col: number, row: number): [number, number] { const { w, h } = this.cell(); return [col * (w + mapGap.x), row * (h + mapGap.y)]; }
  rect(id: string): Rect {
    const place = this.places().get(id) || { col: 0, row: 0 };
    let [x, y] = this.cellXY(place.col, place.row);
    const d = this.drag(); if (d?.kind === 'move' && d.moved && d.ids.has(id)) { x += d.dx; y += d.dy; }
    return { x, y, ...this.cell() };
  }
  dragging(id: string) { const d = this.drag(); return d?.kind === 'move' && d.moved && d.ids.has(id); }

  // ---- Links: spec links come from sections that lead somewhere; the rest are planned on the Map ----
  linkOf(from: string, to: string) { return this.ctx.pageById().get(from)?.links.find(link => link.to === to) || null; }
  isSpecLink(from: string, to: string) { return !!this.ctx.pageById().get(from)?.sections.some(section => section.leadsTo === to); }
  private flowPairs() {
    const flow = this.flow(); if (!flow) return [] as [string, string][];
    const pages = flow.steps.filter(step => step.page).map(step => step.page as string);
    return pages.slice(1).map((to, index) => [pages[index], to] as [string, string]).filter(([from, to]) => from !== to);
  }
  readonly drawn = computed<Drawn[]>(() => {
    const pages = this.pages(), ids = new Set(pages.map(page => page.id)), flow = this.flow(), pairs = this.flowPairs();
    const items: { from: string; to: string; label: string; missing: boolean }[] = [];
    for (const page of pages) for (const link of page.links) if (ids.has(link.to) && link.to !== page.id) items.push({ from: page.id, to: link.to, label: link.label, missing: false });
    for (const [from, to] of pairs) if (!items.some(item => item.from === from && item.to === to)) items.push({ from, to, label: 'No link yet', missing: true });
    const geo = items.map(item => {
      const a = this.rect(item.from), b = this.rect(item.to);
      const dir = b.x >= a.x + a.w ? 'r' : b.x + b.w <= a.x ? 'l' : b.y > a.y ? 'd' : 'u';
      return { item, a, b, sa: ({ r: 'r', l: 'l', d: 'b', u: 't' } as Record<string, string>)[dir], sb: ({ r: 'l', l: 'r', d: 't', u: 'b' } as Record<string, string>)[dir], oa: 0, ob: 0 };
    });
    // Links that share a side of a page are spread along it, ordered by where they go.
    const ports = new Map<string, { index: number; end: 'a' | 'b'; other: Rect }[]>();
    geo.forEach((g, index) => {
      for (const [key, end, other] of [[g.item.from + g.sa, 'a', g.b], [g.item.to + g.sb, 'b', g.a]] as [string, 'a' | 'b', Rect][]) { if (!ports.has(key)) ports.set(key, []); ports.get(key)!.push({ index, end, other }); }
    });
    for (const [key, list] of ports) {
      const side = key.slice(-1); list.sort((p, q) => side === 'r' || side === 'l' ? p.other.y - q.other.y : p.other.x - q.other.x);
      list.forEach((port, j) => { const offset = (j - (list.length - 1) / 2) * 30; if (port.end === 'a') geo[port.index].oa = offset; else geo[port.index].ob = offset; });
    }
    const point = (r: Rect, side: string, o: number): [number, number] => side === 'r' ? [r.x + r.w, r.y + r.h / 2 + o] : side === 'l' ? [r.x, r.y + r.h / 2 + o] : side === 'b' ? [r.x + r.w / 2 + o, r.y + r.h] : [r.x + r.w / 2 + o, r.y];
    const vec: Record<string, [number, number]> = { r: [1, 0], l: [-1, 0], b: [0, 1], t: [0, -1] };
    return geo.map(g => {
      const [x1, y1] = point(g.a, g.sa, g.oa), [x2, y2] = point(g.b, g.sb, g.ob);
      const k = Math.max(50, Math.hypot(x2 - x1, y2 - y1) / 2.6);
      const c1 = [x1 + vec[g.sa][0] * k, y1 + vec[g.sa][1] * k], c2 = [x2 + vec[g.sb][0] * k, y2 + vec[g.sb][1] * k];
      const on = !!flow && pairs.some(([from, to]) => from === g.item.from && to === g.item.to);
      const kind: Drawn['kind'] = g.item.missing ? 'missing' : on ? 'on' : flow ? 'dim' : '';
      return { key: `${g.item.from}>${g.item.to}`, from: g.item.from, to: g.item.to, label: g.item.label, d: `M${x1},${y1} C${c1} ${c2} ${x2},${y2}`,
        mx: (x1 + 3 * c1[0] + 3 * c2[0] + x2) / 8, my: (y1 + 3 * c1[1] + 3 * c2[1] + y2) / 8, kind, spec: this.isSpecLink(g.item.from, g.item.to) };
    });
  });

  // ---- Camera ----
  // Fit shows every page. The first view stays readable instead: never below 45%, starting from the top left.
  fit(readable = false) {
    const vp = this.vp()?.nativeElement; const pages = this.pages(); if (!vp || !pages.length) return;
    const rects = pages.map(page => this.rect(page.id));
    const minX = Math.min(...rects.map(r => r.x)), minY = Math.min(...rects.map(r => r.y)), maxX = Math.max(...rects.map(r => r.x + r.w)), maxY = Math.max(...rects.map(r => r.y + r.h));
    const top = 64, bottom = 40, side = 40, W = vp.clientWidth - side * 2, H = vp.clientHeight - top - bottom;
    const z = Math.min(1.1, Math.max(0.15, Math.min(W / (maxX - minX), H / (maxY - minY))));
    if (readable && z < 0.45) { this.cam.set({ z: 0.45, x: side - minX * 0.45, y: top - minY * 0.45 }); return; }
    this.cam.set({ z, x: side + (W - (maxX - minX) * z) / 2 - minX * z, y: top + (H - (maxY - minY) * z) / 2 - minY * z });
  }
  zoomAt(factor: number, cx: number, cy: number) { const c = this.cam(); const z = Math.min(2, Math.max(0.12, c.z * factor)); this.cam.set({ z, x: cx - (cx - c.x) * (z / c.z), y: cy - (cy - c.y) * (z / c.z) }); }
  zoomBy(factor: number) { const vp = this.vp()?.nativeElement; if (vp) this.zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2); }
  setView(view: MapView) { this.view.set(view); requestAnimationFrame(() => this.fit()); }
  wheel(event: WheelEvent) {
    event.preventDefault();
    const vp = this.vp()!.nativeElement.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey) this.zoomAt(Math.exp(-event.deltaY * 0.0018), event.clientX - vp.left, event.clientY - vp.top);
    else this.cam.update(c => ({ ...c, x: c.x - event.deltaX, y: c.y - event.deltaY }));
  }
  private world(event: { clientX: number; clientY: number }): [number, number] { const r = this.vp()!.nativeElement.getBoundingClientRect(), c = this.cam(); return [(event.clientX - r.left - c.x) / c.z, (event.clientY - r.top - c.y) / c.z]; }

  // ---- Pointer: pan, move, link and select ----
  private readonly moveListener = (event: PointerEvent) => this.move(event);
  down(event: PointerEvent) {
    const target = event.target as HTMLElement;
    // A blank's title and note drag the page until you click into them.
    const field = target.closest<HTMLElement>('.lay-pg-node input, .lay-pg-node textarea');
    if (field && document.activeElement === field) return;
    if (target.closest('.lay-pg-tools, .lay-pg-fbanner, .lay-pg-hint, button, select, .lay-pg-llabel input') || (target.closest('input, textarea') && !field)) return;
    const [wx, wy] = this.world(event);
    const handle = target.closest<HTMLElement>('[data-handle]'), node = target.closest<HTMLElement>('[data-node]'), link = target.closest<HTMLElement>('[data-link]');
    if (event.button === 1 || this.tool() === 'hand' || this.space()) { const c = this.cam(); this.drag.set({ kind: 'pan', sx: event.clientX, sy: event.clientY, cx: c.x, cy: c.y }); }
    else if (event.button !== 0) return;
    else if (handle) this.drag.set({ kind: 'link', from: handle.dataset['handle']!, x: wx, y: wy, over: null });
    else if (node) {
      const id = node.dataset['node']!;
      const next = new Set(this.msel());
      if (event.shiftKey) { if (next.has(id)) next.delete(id); else next.add(id); } else if (!next.has(id)) { next.clear(); next.add(id); }
      this.msel.set(next); this.selLink.set(null);
      this.drag.set({ kind: 'move', ids: new Set(next), sx: wx, sy: wy, dx: 0, dy: 0, moved: false, field });
    } else if (link) { this.selLink.set(link.dataset['link']!); this.msel.set(new Set()); return; }
    else { const base = event.shiftKey ? new Set(this.msel()) : new Set<string>(); this.msel.set(base); this.selLink.set(null); this.drag.set({ kind: 'box', x0: wx, y0: wy, x1: wx, y1: wy, base }); }
    event.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.addEventListener('pointermove', this.moveListener);
    window.addEventListener('pointerup', up => this.up(up), { once: true });
  }
  private move(event: PointerEvent) {
    const d = this.drag(); if (!d) return;
    const [wx, wy] = this.world(event);
    if (d.kind === 'pan') this.cam.update(c => ({ ...c, x: d.cx + event.clientX - d.sx, y: d.cy + event.clientY - d.sy }));
    else if (d.kind === 'link') { const over = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-node]')?.dataset['node'] || null; this.drag.set({ ...d, x: wx, y: wy, over: over !== d.from ? over : null }); }
    else if (d.kind === 'move') { const dx = wx - d.sx, dy = wy - d.sy; this.drag.set({ ...d, dx, dy, moved: d.moved || Math.hypot(dx, dy) * this.cam().z > 4 }); }
    else {
      const next = { ...d, x1: wx, y1: wy }; this.drag.set(next);
      const x = Math.min(next.x0, wx), y = Math.min(next.y0, wy), w = Math.abs(wx - next.x0), h = Math.abs(wy - next.y0);
      this.msel.set(new Set([...next.base, ...this.pages().filter(page => { const r = this.rect(page.id); return r.x < x + w && r.x + r.w > x && r.y < y + h && r.y + r.h > y; }).map(page => page.id)]));
    }
  }
  private up(event: PointerEvent) {
    window.removeEventListener('pointermove', this.moveListener);
    const d = this.drag();
    if (d?.kind === 'move' && d.moved) {
      const result = this.snap(d); this.drag.set(null);
      if (result.bad) { this.ctx.notice.set(''); this.ctx.error.set('That spot is taken, so the pages went back.'); return; }
      void this.savePlaces(Object.fromEntries(result.list.map(([id, col, row]) => [id, { col, row }])));
      return;
    }
    this.drag.set(null);
    if (d?.kind === 'link' && d.over) void this.addLink(d.from, d.over);
    if (d?.kind === 'move' && d.field && !event.shiftKey) d.field.focus();
  }
  private snap(d: Extract<Drag, { kind: 'move' }>) {
    const { w, h } = this.cell(); const places = this.places();
    const taken = new Set([...places].filter(([id]) => !d.ids.has(id)).map(([, place]) => `${place.col},${place.row}`));
    let bad = false;
    const list = [...d.ids].map(id => {
      const [x, y] = this.cellXY(places.get(id)!.col, places.get(id)!.row);
      const col = Math.round((x + d.dx) / (w + mapGap.x)), row = Math.round((y + d.dy) / (h + mapGap.y));
      const wrong = col < 0 || row < 0 || taken.has(`${col},${row}`); if (wrong) bad = true;
      return [id, col, row, wrong] as [string, number, number, boolean];
    });
    return { list, bad };
  }
  private key(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.lay-pg-drawer')) return;
    if (event.key === ' ') { this.space.set(true); event.preventDefault(); }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); void this.deleteSelection(); }
    else if (event.key === 'v' || event.key === 'h') this.tool.set(event.key === 'h' ? 'hand' : 'select');
    else if (event.key === 'Escape') { if (this.msel().size || this.selLink()) { this.msel.set(new Set()); this.selLink.set(null); } else this.flowId.set(null); }
  }
  dbl(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const label = target.closest<HTMLElement>('.lay-pg-llabel[data-link]'); if (label) { this.renaming.set(label.dataset['link']!); return; }
    const node = target.closest<HTMLElement>('[data-node]');
    if (node && !target.closest('input, textarea, select, button, [data-handle]')) this.openPage(node.dataset['node']!);
  }
  openPage(id: string) { this.ctx.go(this.ctx.link('pages', 'page', id)); }

  // ---- Writes ----
  private async savePlaces(moved: Record<string, Place>) {
    const places = { ...Object.fromEntries([...this.places()].map(([id, place]) => [id, place])), ...moved };
    this.pending.set(moved);
    const map = this.ctx.data()?.pageMap;
    await this.ctx.write(() => map ? this.ctx.change(map.id, { places }) : this.ctx.record('page_map', { places }));
    this.pending.set({});
  }
  private freeNear(col: number, row: number): Place {
    const taken = new Set([...this.places().values()].map(place => `${place.col},${place.row}`)); let best: [number, number, number] | null = null;
    for (let c = 0; c < 30; c++) for (let r = 0; r < 20; r++) { if (taken.has(`${c},${r}`)) continue; const d = (c - col) ** 2 + (r - row) ** 2; if (!best || d < best[0]) best = [d, c, r]; }
    return { col: best![1], row: best![2] };
  }
  private async addBlank(place: Place, fields: Partial<Page> = {}): Promise<Page | null> {
    let created: Page | null = null;
    const ok = await this.ctx.write(async () => {
      created = await this.ctx.record('page', { ...blankPage, label: 'New page', stories: [], ...fields }, null, 'Planned on the Map') as Page;
      const map = this.ctx.data()?.pageMap; const places = { ...Object.fromEntries(this.places()), [created.id]: place };
      await (map ? this.ctx.change(map.id, { places }) : this.ctx.record('page_map', { places }));
    });
    if (!ok || !created) return null;
    const page = created as Page;
    this.msel.set(new Set([page.id]));
    setTimeout(() => { const input = document.querySelector<HTMLInputElement>(`[data-title="${page.id}"]`); input?.focus(); input?.select(); }, 60);
    return page;
  }
  newBlank() {
    const vp = this.vp()?.nativeElement; if (!vp) return; const c = this.cam(), { w, h } = this.cell();
    const x = (vp.clientWidth / 2 - c.x) / c.z - w / 2, y = (vp.clientHeight / 2 - c.y) / c.z - h / 2;
    void this.addBlank(this.freeNear(x / (w + mapGap.x), y / (h + mapGap.y)));
  }
  saveTitle(page: Page, value: string) { const label = value.trim().slice(0, 30); if (label && label !== page.label) void this.ctx.write(() => this.ctx.change(page.id, { label }, page.revision, 'Named on the Map')); }
  saveNote(page: Page, value: string) { if (value !== page.notes) void this.ctx.write(() => this.ctx.change(page.id, { notes: value }, page.revision, 'Note on the Map')); }
  addStory(page: Page, id: string) { if (id) void this.ctx.write(() => this.ctx.change(page.id, { stories: [...page.stories, id] }, page.revision, `Now realises ${this.ctx.storyById().get(id)?.ref}`)); }
  async addLink(from: string, to: string) {
    const source = this.ctx.pageById().get(from), target = this.ctx.pageById().get(to); if (!source || !target) return;
    if (this.linkOf(from, to)) { this.ctx.notice.set(`${source.label} already links to ${target.label}.`); return; }
    const flow = this.flow(), last = flow?.steps.filter(step => step.page).slice(-1)[0];
    const ok = await this.ctx.write(async () => {
      await this.ctx.change(from, { links: [...source.links, { to, label: `Go to ${target.label}` }] }, source.revision, `Links to ${target.label}`);
      if (flow && last?.page === from) await this.ctx.change(flow.id, { steps: [...flow.steps, this.stepFor(flow, target)] }, flow.revision, `${target.label} added to the flow`);
    });
    if (ok) this.renaming.set(`${from}>${to}`);
  }
  // Enter saves and removes the input, which also blurs it: only the first of the two counts.
  rename(line: Drawn, value: string) {
    if (this.renaming() !== line.key) return;
    this.renaming.set(null);
    const source = this.ctx.pageById().get(line.from); const label = value.trim().slice(0, 60);
    if (!source || !label || label === line.label) return;
    void this.ctx.write(() => this.ctx.change(source.id, { links: source.links.map(link => link.to === line.to ? { ...link, label } : link) }, source.revision, `Link to ${this.state.name(line.to)} renamed`));
  }
  async deleteSelection() {
    const key = this.selLink();
    if (key) {
      const [from, to] = key.split('>');
      if (this.isSpecLink(from, to)) { this.ctx.error.set(`That link is in ${this.state.name(from)}’s spec: a section leads there. Change it in the spec${this.built(this.ctx.pageById().get(from)!) ? ' with a change request' : ''}.`); return; }
      const source = this.ctx.pageById().get(from); if (!source) return;
      this.selLink.set(null);
      await this.ctx.write(() => this.ctx.change(from, { links: source.links.filter(link => link.to !== to) }, source.revision, `No longer links to ${this.state.name(to)}`));
      return;
    }
    const pages = [...this.msel()].map(id => this.ctx.pageById().get(id)).filter((page): page is Page => !!page);
    const blanks = pages.filter(page => page.status === 'planned' && !page.inNav && !this.built(page)), kept = pages.filter(page => !blanks.includes(page));
    if (blanks.length) await this.ctx.write(async () => { for (const page of blanks) await this.ctx.delete(page.id); });
    this.msel.set(new Set(kept.map(page => page.id)));
    if (kept.length) this.ctx.error.set(`Only planned pages outside the navigation are deleted here. ${kept.map(page => page.label).join(', ')} ${kept.length === 1 ? 'is' : 'are'} specified, built or in the navigation.`);
  }

  // ---- Flows on the canvas ----
  toggleFlow(id: string) { this.flowId.set(this.flowId() === id ? null : id); this.msel.set(new Set()); }
  private stepFor(flow: Flow, page: Page): FlowStep {
    const activity = this.ctx.data()?.activities.find(entry => entry.id === flow.activity);
    const inActivity = new Set((activity?.steps || []).flatMap(step => step.stories));
    return { page: page.id, persona: flow.persona, story: page.stories.find(id => inActivity.has(id)) || page.stories[0] || null, name: page.label, trigger: '', why: '' };
  }
  addStep(page: Page) { const flow = this.flow(); if (flow) void this.ctx.write(() => this.ctx.change(flow.id, { steps: [...flow.steps, this.stepFor(flow, page)] }, flow.revision, `${page.label} added to the flow`), `${page.label} is step ${flow.steps.length + 1} of ${flow.title}.`); }
  removeStep(flow: Flow, index: number) { void this.ctx.write(() => this.ctx.change(flow.id, { steps: flow.steps.filter((_, i) => i !== index) }, flow.revision, 'Step removed')); }
  moveStep(flow: Flow, index: number) { const steps = [...flow.steps]; [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]]; void this.ctx.write(() => this.ctx.change(flow.id, { steps }, flow.revision, 'Steps reordered')); }
  renameFlow(flow: Flow, value: string) { const title = value.trim().slice(0, 60); if (title && title !== flow.title) void this.ctx.write(() => this.ctx.change(flow.id, { title }, flow.revision, 'Renamed')); }
  async newFlow() {
    let id = '';
    await this.ctx.write(async () => { id = (await this.ctx.record('flow', { title: 'New flow', persona: this.state.personas()[0]?.id || null, steps: [] }, null, 'Started on the Map') as Flow).id; });
    if (id) this.flowId.set(id);
  }
  deleteFlow(flow: Flow) { this.flowId.set(null); void this.ctx.write(() => this.ctx.delete(flow.id), `${flow.title} deleted.`); }
  private nextTo(flow: Flow, before: number): Place {
    const prior = flow.steps.slice(0, before).reverse().find(step => step.page);
    const place = prior ? this.places().get(prior.page!) : null;
    return this.freeNear(place ? place.col + 1 : 0, place ? place.row : 2);
  }
  async fillGap(flow: Flow, index: number) {
    const gap = flow.steps[index];
    const page = await this.addBlank(this.nextTo(flow, index), { label: (gap.name || 'New page').slice(0, 30), notes: gap.why, stories: gap.story ? [gap.story] : [] });
    const current = this.flows().find(entry => entry.id === flow.id);
    if (page && current) await this.ctx.write(() => this.ctx.change(current.id, { steps: current.steps.map((step, i) => i === index ? { ...step, page: page.id, why: '' } : step) }, current.revision, `${page.label} fills a gap`));
  }
  async blankFor(flow: Flow, storyId: string) {
    const story = this.ctx.storyById().get(storyId);
    const label = (story?.title || 'New page').replace(/^(\w+) (can |gets |confirms )?/, '').replace(/^./, c => c.toUpperCase()).slice(0, 30);
    const page = await this.addBlank(this.nextTo(flow, flow.steps.length), { label, stories: [storyId] });
    const current = this.flows().find(entry => entry.id === flow.id);
    if (page && current) await this.ctx.write(() => this.ctx.change(current.id, { steps: [...current.steps, { page: page.id, persona: current.persona, story: storyId, name: page.label, trigger: '', why: '' }] }, current.revision, `${page.label} added for ${story?.ref}`), `Page blank added for ${story?.ref}.`);
  }
  linkMissing(a: FlowStep, b: FlowStep) { return !!a.page && !!b.page && a.page !== b.page && !this.linkOf(a.page, b.page); }
  trigger(a: FlowStep, b: FlowStep) {
    if (a.page && b.page && a.page !== b.page) return this.linkOf(a.page, b.page)?.label || 'No link yet: draw one on the canvas';
    return a.trigger || (a.page && a.page === b.page ? 'On the same page' : '');
  }
}
