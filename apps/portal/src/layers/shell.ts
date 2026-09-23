import { ChangeDetectorRef, Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Session } from '../onboarding-model';
import { contrastText, readableAccent } from '../color';
import { ProjectContext, dataStatusLabel, stateLabel, statusLabel, unitStateLabel } from './context';
import { DesignLayerComponent } from './design';
import { PagesLayerComponent } from './pages';
import { DataLayerComponent } from './data';
import { PlatformLayerComponent } from './platform';
import { ProductLayerComponent } from './product';
import { WorkLayerComponent } from './work';
import { HomeLayerComponent } from './home';

const layers = [{ id: 'home', icon: 'home', label: 'Home' }, { id: 'product', icon: 'lightbulb', label: 'Product' }, { id: 'design', icon: 'palette', label: 'Design' }, { id: 'pages', icon: 'web', label: 'Pages' }, { id: 'data', icon: 'schema', label: 'Data' }, { id: 'platform', icon: 'dns', label: 'Platform' }, { id: 'work', icon: 'checklist', label: 'Work' }];

// LAY-02: every project's workspace at /p/<slug>/<layer>/<tab>/<id>. The layer comes first (DEC-036).
@Component({
  selector: 'aludel-project-shell', standalone: true,
  imports: [FormsModule, MatIconModule, HomeLayerComponent, ProductLayerComponent, DesignLayerComponent, PagesLayerComponent, DataLayerComponent, PlatformLayerComponent, WorkLayerComponent],
  providers: [ProjectContext],
  template: `
  <a class="skip-link" href="#lay-main">Skip to content</a>
  <div class="lay-shell">
    <aside class="lay-rail">
      <a class="lay-brand" href="/projects"><mat-icon aria-hidden="true">deployed_code</mat-icon>Aludel</a>
      @if (ctx.setup(); as setup) {
        <a class="lay-project" [href]="ctx.link()" (click)="ctx.go(ctx.link(), $event)"><span class="lay-mark" [style.background]="markColor()" [style.color]="markText()" aria-hidden="true">{{ initials(setup.project.name) }}</span>
          <span><strong>{{ setup.project.name }}</strong><small>{{ profileLabel() }} · {{ currentPhase() }} phase</small></span></a>
      }
      <nav class="lay-nav" aria-label="Layers">
        @for (item of layers; track item.id) {
          <a [href]="item.id === 'home' ? ctx.link() : ctx.link(item.id)" (click)="ctx.go(item.id === 'home' ? ctx.link() : ctx.link(item.id), $event)" [class.active]="layer() === item.id" [attr.aria-current]="layer() === item.id ? 'page' : null">
            <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>{{ item.label }}
            @if (item.id === 'work' && needsYou().length) { <span class="lay-badge" [attr.aria-label]="needsYou().length + ' need you'">{{ needsYou().length }}</span> }
          </a>
        }
      </nav>
      <div class="lay-spacer"></div>
      <a class="lay-settings" [href]="ctx.link('settings')" (click)="ctx.go(ctx.link('settings'), $event)" [class.active]="layer() === 'settings'"><mat-icon aria-hidden="true">settings</mat-icon>Settings</a>
      <div class="lay-account-wrap">
        <button type="button" class="lay-account" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()" aria-controls="lay-account-menu" [attr.aria-label]="'Account menu, ' + (user()?.name || 'you')">
          <span class="lay-avatar" aria-hidden="true">{{ initials(user()?.name || 'You') }}</span><span><strong>{{ user()?.name }}</strong><small>{{ user()?.email || 'Owner access key' }}</small></span></button>
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
      <main class="lay-main" id="lay-main" tabindex="-1">
        @if (ctx.workingOn(); as current) {
          <div class="lay-working" role="status"><mat-icon aria-hidden="true">assignment</mat-icon><span>Working on <strong>{{ current.ref }}</strong>: edits to its targets are saved as its output.</span>
            <a [href]="ctx.link('work', 'item', current.id)" (click)="ctx.go(ctx.link('work', 'item', current.id), $event)">Back to {{ current.ref }}</a><button type="button" class="lay-link-button" (click)="ctx.workingOn.set(null)">Stop</button></div>
        }
        @if (ctx.error()) { <p class="error-message" role="alert">{{ ctx.error() }}</p> }
        @if (ctx.notice()) { <p class="success-message" role="status">{{ ctx.notice() }}</p> }
        @if (missing()) {
          <h1 tabindex="-1">Project not found</h1><p>You don't have access to this project, or it doesn't exist. <a href="/projects">Your apps</a></p>
        } @else if (ctx.data() && ctx.setup(); as ready) {
          @switch (layer()) {
            @case ('product') { <aludel-product-layer /> }
            @case ('design') { <aludel-design-layer /> }
            @case ('pages') { <aludel-pages-layer /> }
            @case ('data') { <aludel-data-layer /> }
            @case ('platform') { <aludel-platform-layer /> }
            @case ('work') { <aludel-work-layer /> }
            @case ('settings') {
              <p class="lay-eyebrow">Settings</p><h1 tabindex="-1">{{ ctx.setup()?.project?.name }} settings</h1>
              <div class="lay-grid lay-g2"><section class="lay-card"><h2>Project</h2><dl class="lay-kv"><dt>Name</dt><dd>{{ ctx.setup()?.project?.name }}</dd><dt>Address</dt><dd><code>{{ ctx.setup()?.urls?.app }}</code></dd><dt>Members</dt><dd>You (owner)</dd></dl></section>
                <section class="lay-card"><h2>Working style</h2><p>{{ profileLabel() }}. <a [href]="ctx.link('work', 'style')" (click)="ctx.go(ctx.link('work', 'style'), $event)">See and change what it automates</a></p></section></div>
            }
            @case ('account') {
              <p class="lay-eyebrow">Account</p><h1 tabindex="-1">{{ user()?.name }}</h1>
              <div class="lay-grid lay-g2"><section class="lay-card"><h2>Sign-in</h2><dl class="lay-kv"><dt>Email</dt><dd>{{ user()?.email || 'Owner access key' }}</dd><dt>GitHub</dt><dd>{{ ctx.setup()?.github?.connected ? ctx.setup()?.github?.login : 'Not connected' }}</dd></dl></section>
                <section class="lay-card"><h2>Your apps</h2><ul class="lay-list">@for (project of ctx.session()?.projects || []; track project.id) { <li><a class="lay-item" [href]="project.id === 'the-machine' ? '/#/the-machine/overview' : '/p/' + project.slug"><span class="lay-body-text"><strong>{{ project.name }}</strong><small>{{ project.role }}</small></span></a></li> }</ul></section></div>
            }
            @default { <aludel-home-layer /> }
          }
        } @else { <p class="lay-muted">Loading…</p> }
      </main>
    </div>
  </div>`
})
export class ProjectShellComponent implements OnInit {
  readonly ctx = inject(ProjectContext);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly initialSession = input.required<Session>();
  readonly layers = layers;
  readonly menu = signal(false);
  readonly missing = signal(false);
  readonly q = signal('');
  query = '';
  readonly layer = computed(() => this.ctx.segments()[0] || 'home');
  readonly user = computed(() => this.ctx.session()?.user || null);
  readonly needsYou = computed(() => (this.ctx.data()?.work || []).filter(item => ['needs-input', 'review'].includes(item.state)));
  readonly currentPhase = computed(() => this.ctx.data()?.phases.find(phase => phase.current)?.label || 'Demo');
  readonly profileLabel = computed(() => { const setup = this.ctx.setup(); return setup ? this.ctx.catalog()?.profiles[setup.profile]?.label || setup.profile : ''; });
  readonly results = computed(() => {
    const term = this.q().trim().toLowerCase(); const data = this.ctx.data();
    if (!term || !data) return [];
    const groups = [
      { label: 'Story map', hits: data.stories.map(story => ({ text: `${story.ref} ${story.title}`, sub: statusLabel[story.status], href: this.ctx.link('product', 'map', story.id) })) },
      { label: 'Specs', hits: data.specs.map(spec => ({ text: `${spec.ref} ${spec.title}`, sub: spec.status, href: this.ctx.link('product', 'specs', spec.id) })) },
      { label: 'Docs and research', hits: [...data.docs.map(doc => ({ text: doc.title, sub: doc.template, href: this.ctx.link('product', 'docs', doc.id) })), ...data.research.map(item => ({ text: item.title, sub: 'Research', href: this.ctx.link('product', 'research') }))] },
      { label: 'Pages', hits: data.pages.map(page => ({ text: `${page.label} page`, sub: page.origin, href: this.ctx.link('pages', 'tree', page.id) })) },
      { label: 'Data', hits: [...data.objects.map(object => ({ text: `${object.name} object`, sub: dataStatusLabel[object.status], href: this.ctx.link('data', 'objects', object.id) })),
        ...data.operations.map(op => ({ text: `${op.method} ${op.path}`, sub: `${op.operationId} · ${op.summary}`, href: this.ctx.link('data', 'api', op.id) }))] },
      { label: 'Code', hits: data.code.units.filter(unit => unit.kind !== 'const').map(unit => ({ text: unit.symbol, sub: `${unit.path} · ${unitStateLabel[unit.state]}`, href: this.ctx.link('platform', 'code', unit.id) })) },
      { label: 'Work', hits: data.work.map(item => ({ text: `${item.ref} ${item.title}`, sub: stateLabel[item.state], href: this.ctx.link('work', 'item', item.id) })) }
    ];
    return groups.map(group => ({ ...group, hits: group.hits.filter(hit => `${hit.text} ${hit.sub}`.toLowerCase().includes(term)).slice(0, 5) })).filter(group => group.hits.length);
  });

  constructor() {
    window.addEventListener('popstate', () => this.ctx.path.set(location.pathname));
    effect(() => { const layer = this.layer(); document.title = `${layer === 'home' ? 'Home' : layer.charAt(0).toUpperCase() + layer.slice(1)} · ${this.ctx.setup()?.project.name || 'Aludel'}`; });
  }

  async ngOnInit() {
    this.ctx.session.set(this.initialSession());
    if (!this.ctx.projectId()) { this.missing.set(true); return; }
    try { await this.ctx.reload(); } catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); if ((error as { status?: number }).status === 404) this.missing.set(true); }
    this.changeDetector.markForCheck();
  }

  readonly markColor = computed(() => readableAccent(this.ctx.setup()?.project.accent_color || '#3047b9', '#ffffff'));
  readonly markText = computed(() => contrastText(this.markColor()));

  initials(name: string) { return name.split(/\s+/).map(word => word[0] || '').join('').slice(0, 2).toUpperCase(); }

  async signOut() {
    await fetch('/api/logout', { method: 'POST' });
    location.assign('/');
  }
}
