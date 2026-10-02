import { ChangeDetectorRef, Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Session } from '../onboarding-model';
import { contrastText, readableAccent } from '../color';
import { DomSanitizer } from '@angular/platform-browser';
import { personAvatar } from '../avatars';
import { AvatarEditorComponent } from './avatar-editor';
import { PersonAvatar, ProjectContext, dataStatusLabel, phaseName, sectionTitle, statusLabel, unitStateLabel, workStatusLabel } from './context';
import { DesignLayerComponent } from './design';
import { PagesLayerComponent } from '../installed/pages/pages';
import { LayerFrameComponent } from './layer-frame';
import { DataLayerComponent } from './data';
import { CodeLayerComponent } from './code';
import { DeployLayerComponent } from './deploy';
import { ProductLayerComponent } from './product';
import { WorkLayerComponent } from './work';
import { HomeLayerComponent } from './home';
import { LibraryComponent } from './library';
import { EvidencePanelComponent } from './evidence';
import { MarkdownLayerComponent } from './markdown-layer';
import { LayerTasksComponent } from './layer-tasks';
import { LayerManageComponent } from './layer-manage';
import { LayerKnowledgeComponent } from './layer-knowledge';
import { activeOutputTab, layerColourStyle, layerOutputTabs, layerSpaces, legacyLayerPath, setupProgress } from './layer-nav';

// The rail can shrink to icons (CUSTOM-LAYER-01) so a layer's own sidebars don't stack beside a wide one.
function readRailPreference() { try { return localStorage.getItem('aludel.rail.min') === '1'; } catch { return false; } }

// ROADMAP-01 (DEC-043): Product is shown as Vision (URLs /vision/…; the internal layer key stays `product`), and each layer has one colour.
const localLayers = [{ id: 'product', icon: 'lightbulb', label: 'Vision' }, { id: 'design', icon: 'palette', label: 'Design' }, { id: 'pages', icon: 'web', label: 'Pages' }, { id: 'data', icon: 'schema', label: 'Data' }, { id: 'platform', icon: 'code', label: 'Code' }, { id: 'deploy', icon: 'rocket_launch', label: 'Deploy' }];

// LAY-02: every project's workspace at /p/<slug>/<layer>/<tab>/<id>. The layer comes first (DEC-036).
@Component({
  selector: 'aludel-project-shell', standalone: true,
  imports: [FormsModule, MatIconModule, LayerFrameComponent, AvatarEditorComponent, HomeLayerComponent, ProductLayerComponent, DesignLayerComponent, PagesLayerComponent, DataLayerComponent, CodeLayerComponent, DeployLayerComponent, WorkLayerComponent, LibraryComponent, EvidencePanelComponent, MarkdownLayerComponent, LayerTasksComponent, LayerKnowledgeComponent, LayerManageComponent],
  providers: [ProjectContext],
  template: `
  <a class="skip-link" href="#lay-main">Skip to content</a>
  <div class="lay-shell" [class.lay-rail-min]="railMin()">
    <aside class="lay-rail">
      <div class="lay-rail-top">
        <a class="lay-brand" href="/projects" title="Aludel"><mat-icon aria-hidden="true">deployed_code</mat-icon><span class="lay-nav-label">Aludel</span></a>
        <button type="button" class="lay-rail-toggle" (click)="toggleRail()" [attr.aria-label]="railMin() ? 'Expand sidebar' : 'Collapse sidebar'" [attr.aria-pressed]="railMin()" [title]="railMin() ? 'Expand sidebar' : 'Collapse sidebar'">
          @if (railMin()) { <mat-icon aria-hidden="true">chevron_right</mat-icon> } @else { <mat-icon aria-hidden="true">chevron_left</mat-icon> }</button>
      </div>
      @if (ctx.setup(); as setup) {
        <a class="lay-project" [href]="ctx.link()" (click)="ctx.go(ctx.link(), $event)" [title]="setup.project.name"><span class="lay-mark" [style.background]="markColor()" [style.color]="markText()" aria-hidden="true">{{ initials(setup.project.name) }}</span>
          <span class="lay-nav-label"><strong>{{ setup.project.name }}</strong>@if (currentPhase()) { <small>{{ currentPhase() }} milestone</small> } @else { <small>{{ activeLayerCount() }} layer apps</small> }</span></a>
      }
      <nav class="lay-nav" aria-label="Project navigation">
        <a class="lay-lc-home" [href]="ctx.link()" (click)="ctx.go(ctx.link(), $event)" [class.active]="layer() === 'home'" [attr.aria-current]="layer() === 'home' ? 'page' : null" title="Home"><span class="lay-tile"><mat-icon aria-hidden="true">home</mat-icon></span><span class="lay-nav-label">Home</span></a>
        <span class="lay-nav-divider" aria-hidden="true"></span>
        @for (item of visibleLayers(); track item.id) {
          <a [class]="'lay-lc-' + item.id" [style]="colourStyle(item.id)" [href]="ctx.link(item.id)" (click)="ctx.go(ctx.link(item.id), $event)" [class.active]="layer() === item.id" [attr.aria-current]="layer() === item.id ? 'page' : null" [title]="item.label">
            <span class="lay-tile"><mat-icon aria-hidden="true">{{ item.icon }}</mat-icon></span><span class="lay-nav-label">{{ item.label }}</span>
          </a>
        }
        <span class="lay-nav-divider" aria-hidden="true"></span>
        <a class="lay-lc-library" [href]="ctx.link('library')" (click)="ctx.go(ctx.link('library'), $event)" [class.active]="layer() === 'library'" [attr.aria-current]="layer() === 'library' ? 'page' : null" title="Library"><span class="lay-tile"><mat-icon aria-hidden="true">local_library</mat-icon></span><span class="lay-nav-label">Library</span></a>
        <a class="lay-lc-work" [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)" [class.active]="layer() === 'work'" [attr.aria-current]="layer() === 'work' ? 'page' : null" title="Work"><span class="lay-tile"><mat-icon aria-hidden="true">checklist</mat-icon></span><span class="lay-nav-label">Work</span>
          @if (needsYou().length) { <span class="lay-badge" [attr.aria-label]="needsYou().length + ' need you'">{{ needsYou().length }}</span> }
        </a>
      </nav>
      <div class="lay-spacer"></div>
      <nav class="lay-nav" aria-label="Utilities">
        <a class="lay-settings lay-lc-settings" [href]="ctx.link('settings')" (click)="ctx.go(ctx.link('settings'), $event)" [class.active]="layer() === 'settings'" [attr.aria-current]="layer() === 'settings' ? 'page' : null" title="Settings"><span class="lay-tile"><mat-icon aria-hidden="true">settings</mat-icon></span><span class="lay-nav-label">Settings</span></a>
      </nav>
      <div class="lay-account-wrap">
        <button type="button" class="lay-account" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-controls="lay-account-menu" [attr.aria-label]="'Account menu, ' + (user()?.name || 'you')">
          <img class="lay-av lay-av-md" [src]="myAvatar()" alt="" aria-hidden="true"><span class="lay-nav-label"><strong>{{ user()?.name }}</strong><small>{{ user()?.email || 'Owner access key' }}</small></span></button>
        @if (menu()) {
          <div class="lay-account-menu" id="lay-account-menu">
            <a [href]="ctx.link('account')" (click)="menu.set(false); ctx.go(ctx.link('account'), $event)"><mat-icon aria-hidden="true">person</mat-icon>Account</a>
            <a href="/projects"><mat-icon aria-hidden="true">swap_horiz</mat-icon>Your apps</a>
            <button type="button" (click)="signOut()"><mat-icon aria-hidden="true">logout</mat-icon>Sign out</button>
          </div>
        }
      </div>
    </aside>
    <div class="lay-body">
      <div class="lay-topbar">
        <div class="lay-search" role="search">
          <mat-icon aria-hidden="true">search</mat-icon>
          <label class="visually-hidden" for="lay-q">Search every layer</label>
          <input id="lay-q" type="search" [(ngModel)]="query" (ngModelChange)="q.set($event)" placeholder="Search stories, pages, data, code, work…" autocomplete="off">
          @if (q().trim()) {
            <div class="lay-results">
              @for (group of results(); track group.label) {
                <h3>{{ group.label }}</h3>
                @for (hit of group.hits; track hit.href) { <a [href]="hit.href" (click)="query = ''; q.set(''); ctx.go(hit.href, $event)"><span>{{ hit.text }}</span><small>{{ hit.sub }}</small></a> }
              } @empty { <p class="lay-muted">Nothing matches.</p> }
            </div>
          }
        </div>
      </div>
      <main [class]="'lay-main lay-lc-' + layerColour()" [style]="colourStyle(layer())" id="lay-main" tabindex="-1">
        @if (ctx.workingOn(); as current) {
          <div class="lay-working" role="status"><mat-icon aria-hidden="true">assignment</mat-icon><span>Working on <strong>{{ current.ref }}</strong>: edits to its targets are saved as its output.</span>
            <a [href]="ctx.link('work', 'item', current.id)" (click)="ctx.go(ctx.link('work', 'item', current.id), $event)">Back to {{ current.ref }}</a><button type="button" class="lay-link-button" (click)="ctx.workingOn.set(null)">Stop</button></div>
        }
        @if (ctx.error()) { <p class="error-message" role="alert">{{ ctx.error() }}</p> }
        @if (ctx.notice()) { <p class="success-message" role="status">{{ ctx.notice() }}</p> }
        @if (missing()) {
          <h1 tabindex="-1">Project not found</h1><p>You don't have access to this project, or it doesn't exist. <a href="/projects">Your apps</a></p>
        } @else if (ctx.data() && ctx.setup(); as ready) {
          @if (localLayer() && activeLocalLayer()) {
            <!-- CUSTOM-LAYER-01: one bar per layer. Output tabs scroll on the left; Tasks and Manage stay put on the right. The header is
                 compact (LAYER-KNOWLEDGE-01); what the layer is for is its Knowledge overview. -->
            <header class="lay-layer-head">
              <span class="lay-tile" aria-hidden="true"><mat-icon>{{ localLayer()?.icon }}</mat-icon></span>
              <h1 tabindex="-1" [attr.title]="localLayer()?.description">{{ localLayer()?.name }}@if (localLayer()?.lifecycle === 'draft') { <span class="lay-chip lay-plain lay-layer-draft">Draft</span> }</h1>
            </header>
            @if (setup(); as p) { @if (!(space() === 'manage' && (ctx.segments()[2] || 'activate') === 'activate')) {
              <div class="lay-draft-banner" role="status"><mat-icon aria-hidden="true">flag</mat-icon>
                <span><strong>{{ localLayer()?.name }} isn't active yet.</strong> Other layers can't see it until you finish setup: {{ p.done }} of {{ p.total }} steps done.</span>
                <a [href]="ctx.link(layer(), 'manage', 'activate')" (click)="ctx.go(ctx.link(layer(), 'manage', 'activate'), $event)">Finish setup</a></div>
            } }
            <nav class="lay-layer-bar" [attr.aria-label]="localLayer()?.name + ' views'">
              <div class="lay-layer-outputs">
                @for (tab of outputTabs(); track tab[0]) {
                  <a [href]="ctx.link(layer(), tab[0])" (click)="ctx.go(ctx.link(layer(), tab[0]), $event)" [class.active]="outputTab() === tab[0]" [attr.aria-current]="outputTab() === tab[0] ? 'page' : null">{{ tab[1] }}@if (ctx.dirtyTabs()[layer() + '/' + tab[0]]) { <span class="lay-layer-dirty" aria-label="unsaved changes"></span> }</a>
                }
              </div>
              <div class="lay-layer-fixed">
                <a [href]="ctx.link(layer(), 'tasks')" (click)="ctx.go(ctx.link(layer(), 'tasks'), $event)" [class.active]="space() === 'tasks'" [attr.aria-current]="space() === 'tasks' ? 'page' : null"><mat-icon aria-hidden="true">view_kanban</mat-icon>Tasks@if (layerNeedsYou()) { <span class="lay-layer-count" [attr.aria-label]="layerNeedsYou() + ' need you'">{{ layerNeedsYou() }}</span> }</a>
                <a [href]="ctx.link(layer(), 'knowledge')" (click)="ctx.go(ctx.link(layer(), 'knowledge'), $event)" [class.active]="space() === 'knowledge'" [attr.aria-current]="space() === 'knowledge' ? 'page' : null"><mat-icon aria-hidden="true">menu_book</mat-icon>Knowledge</a>
                <a [href]="ctx.link(layer(), 'manage')" (click)="ctx.go(ctx.link(layer(), 'manage'), $event)" [class.active]="space() === 'manage'" [attr.aria-current]="space() === 'manage' ? 'page' : null"><mat-icon aria-hidden="true">settings</mat-icon>Manage@if (setup(); as p) { <span class="lay-layer-count lay-layer-count-warn" [attr.aria-label]="p.remaining + ' setup steps left'">{{ p.remaining }}</span> }</a>
              </div>
            </nav>
          }
          @if (localLayer() && !activeLocalLayer()) { <p class="lay-eyebrow">Layer app</p><h1 tabindex="-1">{{ localLayer()?.name }} is not in this project</h1><p>Add it from Home when you need it.</p><a [href]="ctx.link()" (click)="ctx.go(ctx.link(), $event)">Go to Home</a> }
          @else if (space() === 'tasks') { <aludel-layer-tasks [layerKey]="layer()" /> }
          @else if (space() === 'knowledge') { <aludel-layer-knowledge [layerKey]="layer()" /> }
          @else if (space() === 'manage') { <aludel-layer-manage [layerKey]="layer()" /> }
          @else if (localLayer()?.frameUi) { <aludel-layer-frame [layerKey]="layer()" /> }
          @else { @switch (layer()) {
            @case ('product') { <aludel-product-layer /> }
            @case ('design') { <aludel-design-layer /> }
            @case ('pages') { <aludel-pages-layer /> }
            @case ('data') { <aludel-data-layer /> }
            @case ('platform') { <aludel-code-layer /> }
            @case ('deploy') { <aludel-deploy-layer /> }
            @case ('work') { <aludel-work-layer /> }
            @case ('library') { <aludel-library /> }
            @case ('settings') {
              <p class="lay-eyebrow">Settings</p><h1 tabindex="-1">{{ ctx.setup()?.project?.name }} settings</h1>
              <div class="lay-grid lay-g2"><section class="lay-card"><h2>Project</h2><dl class="lay-kv"><dt>Name</dt><dd>{{ ctx.setup()?.project?.name }}</dd><dt>Address</dt><dd><code>{{ ctx.setup()?.urls?.app }}</code></dd><dt>Members</dt><dd>You (owner)</dd></dl></section>
                <section class="lay-card"><h2>Work style</h2><p>New layers use this style to seed action defaults. Existing assignments stay as they are.</p>
                <label for="project-work-style">Style</label><select id="project-work-style" [value]="ctx.setup()?.workStyle || 'planner'" (change)="saveWorkStyle($event)">
                  <option value="dreamer">Dreamer</option><option value="planner">Planner</option><option value="tinkerer">Tinkerer</option></select>
                <p class="lay-muted">Set each action’s default assignee in its layer’s Operations tab. Work shows tasks and assignments across layers.</p></section></div>
            }
            @case ('account') {
              <p class="lay-eyebrow">Account</p><h1 tabindex="-1">{{ user()?.name }}</h1>
              <div class="lay-grid lay-g2"><section class="lay-card"><h2>Sign-in</h2><dl class="lay-kv"><dt>Email</dt><dd>{{ user()?.email || 'Owner access key' }}</dd><dt>GitHub</dt><dd>{{ ctx.setup()?.github?.connected ? ctx.setup()?.github?.login : 'Not connected' }}</dd></dl></section>
                <aludel-avatar-editor class="lay-wide" />
                <section class="lay-card"><h2>Your apps</h2><ul class="lay-list">@for (project of ctx.session()?.projects || []; track project.id) { <li><a class="lay-item" [href]="project.id === 'the-machine' ? '/#/the-machine/overview' : '/p/' + project.slug"><span class="lay-body-text"><strong>{{ project.name }}</strong><small>{{ project.role }}</small></span></a></li> }</ul></section></div>
            }
            @default { @if (localLayer()?.editorAdapter === 'markdown-editor') { <aludel-markdown-layer [layerKey]="layer()" /> } @else { <aludel-home-layer /> } }
          } }
        } @else { <p class="lay-muted">Loading…</p> }
        @if (ctx.data()) { <aludel-evidence-panel /> }
      </main>
    </div>
  </div>`
})
export class ProjectShellComponent implements OnInit {
  readonly ctx = inject(ProjectContext);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly initialSession = input.required<Session>();
  readonly visibleLayers = computed(() => this.ctx.layerInstances().filter(layer => layer.enabled)
    .map(layer => ({ id: layer.key, icon: layer.icon, label: layer.name })));
  readonly localLayer = computed(() => this.ctx.layerInstances().find(item => item.key === this.layer()) || null);
  readonly activeLocalLayer = computed(() => this.ctx.layerInstances().some(item => item.key === this.layer() && item.enabled));
  // A draft custom layer opens on Manage › Settings until it is described and activated.
  readonly space = computed(() => { const segment = this.ctx.segments()[1], layer = this.localLayer();
    if (!layer) return ''; if (layerSpaces.includes(segment)) return segment;
    return !segment && layer.lifecycle === 'draft' && !layer.builtIn ? 'manage' : ''; });
  readonly outputTabs = computed(() => layerOutputTabs(this.localLayer()));
  readonly outputTab = computed(() => this.space() ? '' : activeOutputTab(this.localLayer(), this.ctx.segments()[1]));
  readonly setup = computed(() => setupProgress(this.localLayer()));
  readonly layerNeedsYou = computed(() => this.needsYou().filter(item => item.layer === this.layer()).length);
  readonly railMin = signal(readRailPreference());
  toggleRail() { const next = !this.railMin(); this.railMin.set(next); try { localStorage.setItem('aludel.rail.min', next ? '1' : '0'); } catch { /* per-viewer convenience */ } }
  colourStyle(key: string) { return layerColourStyle(this.ctx.layerInstances().find(item => item.key === key) || null); }
  readonly menu = signal(false);
  readonly missing = signal(false);
  readonly q = signal('');
  query = '';
  // /vision/… is the Product layer; old /product/… links still open it. /code/… is the Platform layer (PLATFORM-UX-01);
  // old /platform/… links still open it, and its old operations tabs open Deploy.
  readonly layer = computed(() => {
    const [segment = 'home', tab] = this.ctx.segments();
    if (segment === 'vision') return 'product';
    if (segment === 'code') return 'platform';
    if (segment === 'platform' && ['environments', 'database', 'domains'].includes(tab)) return 'deploy';
    return segment;
  });
  readonly layerColour = computed(() => ['account'].includes(this.layer()) ? 'settings' : this.layer());
  readonly user = computed(() => this.ctx.session()?.user || null);
  readonly needsYou = computed(() => (this.ctx.data()?.work || []).filter(item => item.status === 'needs' || item.status === 'review'));
  private readonly sanitizer = inject(DomSanitizer);
  readonly myAvatar = computed(() => this.sanitizer.bypassSecurityTrustUrl(personAvatar(this.user()?.avatar as PersonAvatar | null, this.user()?.name || 'you')));
  readonly currentPhase = computed(() => this.ctx.layerInstances().some(layer => layer.key === 'product' && layer.enabled) ? this.ctx.data()?.phases.find(phase => phase.current)?.label || '' : '');
  readonly activeLayerCount = computed(() => this.ctx.layerInstances().filter(layer => layer.enabled).length);
  // Milestones replaced phases in the language (ROADMAP-01).
  readonly results = computed(() => {
    const term = this.q().trim().toLowerCase(); const data = this.ctx.data();
    if (!term || !data) return [];
    const groups = [
      { label: 'Brief', hits: data.claims.map(claim => ({ text: claim.text, sub: sectionTitle(claim.section), href: this.ctx.link('product', 'brief', claim.id) })) },
      { label: 'Library', hits: [...data.insights.map(insight => ({ text: insight.text, sub: 'Insight', href: this.ctx.link('library', 'insight', insight.id) })), ...data.sources.map(source => ({ text: source.title, sub: source.type, href: this.ctx.link('library', 'source', source.id) }))] },
      { label: 'Projects', hits: data.projects.map(project => ({ text: `${project.ref} ${project.title}`, sub: phaseName(project.milestone), href: this.ctx.link('work', 'projects', project.id) })) },
      { label: 'Story map', hits: data.stories.map(story => ({ text: `${story.ref} ${story.title}`, sub: statusLabel[story.status], href: this.ctx.link('product', 'map', story.id) })) },
      { label: 'Documents', hits: data.docs.map(doc => ({ text: doc.title, sub: doc.form === 'generated' ? 'Generated' : 'Written', href: this.ctx.link('product', 'docs', doc.id) })) },
      { label: 'Pages', hits: data.pages.map(page => ({ text: `${page.label} page`, sub: page.origin, href: this.ctx.link('pages', 'page', page.id) })) },
      { label: 'Data', hits: [...data.objects.map(object => ({ text: `${object.name} object`, sub: dataStatusLabel[object.status], href: this.ctx.link('data', 'objects', object.id) })),
        ...data.operations.map(op => ({ text: `${op.method} ${op.path}`, sub: `${op.operationId} · ${op.summary}`, href: this.ctx.link('data', 'api', op.id) }))] },
      { label: 'Code', hits: data.code.units.filter(unit => unit.kind !== 'const').map(unit => ({ text: unit.symbol, sub: `${unit.path} · ${unitStateLabel[unit.state]}`, href: this.ctx.link('platform', 'explorer', unit.id) })) },
      { label: 'Work', hits: data.work.map(item => ({ text: `${item.ref} ${item.title}`, sub: workStatusLabel[item.status], href: this.ctx.link('work', 'items', item.id) })) }
    ];
    const ownerByGroup: Record<string, string> = { Brief: 'product', Projects: 'product', 'Story map': 'product', Documents: 'product', Pages: 'pages', Data: 'data', Code: 'platform' };
    const active = new Set(this.ctx.layerInstances().filter(item => item.enabled).map(item => item.key));
    return groups.filter(group => !ownerByGroup[group.label] || active.has(ownerByGroup[group.label]))
      .map(group => ({ ...group, hits: group.hits.filter(hit => `${hit.text} ${hit.sub}`.toLowerCase().includes(term)).slice(0, 5) })).filter(group => group.hits.length);
  });

  constructor() {
    window.addEventListener('popstate', () => this.ctx.path.set(location.pathname));
    // Operations, Knowledge and Setup links from before the layer bar open their new places.
    effect(() => { const next = this.localLayer() ? legacyLayerPath(this.ctx.segments()) : null; if (next) { const path = this.ctx.link(...next); history.replaceState({}, '', path); this.ctx.path.set(path); } });
    effect(() => { if (this.ctx.segments()[0] === 'product') { const path = this.ctx.link(...this.ctx.segments()); history.replaceState({}, '', path); this.ctx.path.set(path); } });
    effect(() => { const layer = this.layer(); document.title = `${layer === 'home' ? 'Home' : layer === 'product' ? 'Vision' : layer.charAt(0).toUpperCase() + layer.slice(1)} · ${this.ctx.setup()?.project.name || 'Aludel'}`; });
  }

  async ngOnInit() {
    this.ctx.session.set(this.initialSession());
    if (!this.ctx.projectId()) { this.missing.set(true); return; }
    try { await this.ctx.reload(); } catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); if ((error as { status?: number }).status === 404) this.missing.set(true); }
    this.changeDetector.markForCheck();
  }

  readonly markColor = computed(() => readableAccent(this.ctx.setup()?.project.accent_color || '#3047b9', '#ffffff'));
  readonly markText = computed(() => contrastText(this.markColor()));

  saveWorkStyle(event: Event) {
    const workStyle = (event.target as HTMLSelectElement).value;
    void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work-style`, 'PUT', { workStyle }),
      'Work style saved. Existing assignments are unchanged.');
  }

  initials(name: string) { return name.split(/\s+/).map(word => word[0] || '').join('').slice(0, 2).toUpperCase(); }

  async signOut() {
    await fetch('/api/logout', { method: 'POST' });
    location.assign('/');
  }
}
