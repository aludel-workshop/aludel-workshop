import { ChangeDetectorRef, Component, OnDestroy, Pipe, PipeTransform, computed, inject, input, signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AgentConnectionComponent } from './agent-connection';
import { NgTemplateOutlet } from '@angular/common';
import { AgentConnection, Catalog, Feel, PageRoute, ProjectSetup, Session } from './onboarding-model';
import { ProtoSiteComponent } from './proto-site';

type Step = { id: string; label: string; optional: boolean };
// The order follows the owner's flow (DEC-032): nothing administrative before the idea exists.
const steps: Step[] = [
  { id: 'profile', label: 'Working style', optional: false },
  { id: 'idea', label: 'Your idea', optional: false },
  { id: 'account', label: 'Account', optional: false },
  { id: 'github', label: 'GitHub', optional: false },
  { id: 'agent', label: 'Agent', optional: true },
  { id: 'look', label: 'Look & feel', optional: true },
  { id: 'features', label: 'Functionality', optional: true },
  { id: 'pages', label: 'Pages', optional: true },
  { id: 'stack', label: 'Build', optional: false }
];
// From Look & feel onward, settings sit beside a live proto-site of the app.
const splitSteps = new Set(['look', 'pages', 'features', 'stack']);

// Only the project's own app origin (from the server's topology) is ever framed.
@Pipe({ name: 'safeUrl', standalone: true })
export class SafeUrlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);
  transform(value: string): SafeResourceUrl { return this.sanitizer.bypassSecurityTrustResourceUrl(value); }
}

@Component({
  selector: 'aludel-public', standalone: true,
  imports: [FormsModule, KeyValuePipe, NgTemplateOutlet, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, AgentConnectionComponent, ProtoSiteComponent, SafeUrlPipe],
  templateUrl: './public.html'
})
export class PublicComponent implements OnDestroy {
  // Zoneless: plain ngModel fields changed after an await need an explicit check; signals schedule their own.
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly initialSession = input.required<Session>();
  readonly steps = steps;
  readonly path = signal(location.pathname);
  readonly session = signal<Session | null>(null);
  readonly catalog = signal<Catalog | null>(null);
  readonly setup = signal<ProjectSetup | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly details = signal(false);
  readonly accountMode = signal<'sign-up' | 'sign-in' | 'owner'>('sign-up');
  readonly emailForm = signal(false);
  readonly segments = computed(() => this.path().split('/').filter(Boolean));
  readonly view = computed(() => {
    const [first, second, third] = this.segments();
    if (!first) return 'landing';
    if (first === 'login') return 'login';
    if (first === 'projects') return second ? 'project' : 'projects';
    if (first === 'start') {
      if (!second) return 'profile';
      if (second === 'idea' || second === 'account') return second;
      if (third === 'build') return 'stack';
      return third && steps.some(step => step.id === third) ? third : 'github';
    }
    return 'missing';
  });
  readonly projectId = computed(() => {
    const [first, second] = this.segments();
    return (first === 'start' && second && !['idea', 'account'].includes(second)) || (first === 'projects' && second) ? decodeURIComponent(second) : '';
  });
  readonly stepIndex = computed(() => steps.findIndex(step => step.id === this.view()));
  readonly isStep = computed(() => this.stepIndex() >= 0);
  readonly isSplit = computed(() => splitSteps.has(this.view()));
  readonly device = signal<'desktop' | 'mobile'>('desktop');
  // A desktop frame cannot fit a phone-width screen, so small screens always preview the phone layout.
  private readonly narrowQuery = typeof matchMedia === 'function' ? matchMedia('(max-width: 760px)') : null;
  readonly narrow = signal(this.narrowQuery?.matches ?? false);
  readonly previewDevice = computed(() => this.narrow() ? 'mobile' : this.device());
  readonly routes = signal<PageRoute[]>([]);
  readonly pagesSaved = signal<'saved' | 'saving' | 'unsaved'>('saved');
  readonly previewFeel = computed(() => this.catalog()?.feels[this.feelChoice()] || null);
  readonly feelChoice = signal('sleek-saas');
  readonly heroUrl = computed(() => this.setup()?.assets.find(asset => asset.kind === 'image')?.url || null);
  readonly describedCount = computed(() => this.routes().filter(page => page.description.trim()).length);
  private pagesTimer: ReturnType<typeof setTimeout> | null = null;
  readonly preferences = computed(() => this.setup()?.preferences || {});
  readonly profileEntries = computed(() => Object.entries(this.catalog()?.profiles || {}).map(([id, value]) => ({ id, ...value })));
  readonly feelEntries = computed(() => Object.entries(this.catalog()?.feels || {}).map(([id, value]) => ({ id, ...value })));
  readonly featureEntries = computed(() => Object.entries(this.catalog()?.features || {}).map(([id, value]) => ({ id, ...value })));
  readonly stackEntries = computed(() => Object.entries(this.catalog()?.stacks.presets || {}).map(([id, value]) => ({ id, ...value })));
  readonly preferenceEntries = computed(() => Object.entries(this.catalog()?.preferences || {}).map(([id, value]) => ({ id, ...value, options: Object.entries(value.values).map(([key, label]) => ({ key, label })) })));
  // Story ideas the person added themselves (stories without a pack).
  readonly customFeatures = computed(() => (this.setup()?.features.stories || []).filter(story => !story.pack));
  readonly pendingDelete = signal<{ id: string; label: string; stories: number } | null>(null);
  reassignTarget = '';
  // The latest edit of every page seen in this session, so undoing a delete keeps unsaved changes to that page.
  private readonly lastKnown = new Map<string, PageRoute>();
  readonly eligibleInstallations = computed(() => (this.setup()?.github.installations || []).filter(item => item.eligible));
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  // Draft fields bound with ngModel. Server state lives in signals.
  profile = '';
  appName = '';
  pitch = '';
  accountName = '';
  email = '';
  password = '';
  confirmPassword = '';
  ownerKey = '';
  navigation: 'sidebar' | 'top' = 'sidebar';
  feel = 'sleek-saas';
  theme: 'light' | 'dark' | 'system' = 'system';
  accent = '#3047b9';
  designNotes = '';
  uploadNotes = '';
  picks = new Set<string>();
  newFeatureTitle = '';
  newFeatureSummary = '';
  stackPreset = 'aludel-web-v1';
  stackOptions: Record<string, boolean> = {};
  repositoryName = '';
  repositoryPrivate = true;
  installationId = '';

  constructor() {
    const githubError = new URLSearchParams(location.search).get('github_error');
    if (githubError) { this.error.set(githubError); history.replaceState({}, '', location.pathname); }
    window.addEventListener('popstate', () => { this.path.set(location.pathname); void this.load(); });
    this.narrowQuery?.addEventListener('change', event => this.narrow.set(event.matches));
    queueMicrotask(() => { this.session.set(this.initialSession()); void this.load(); });
  }

  ngOnDestroy() { if (this.pollTimer) clearTimeout(this.pollTimer); if (this.pagesTimer) clearTimeout(this.pagesTimer); }

  go(path: string, event?: Event) {
    event?.preventDefault();
    if (this.pagesSaved() === 'unsaved' && this.projectId()) void this.savePages();
    if (path.startsWith('/#') || path.startsWith('/p/')) { location.assign(path); return; }
    history.pushState({}, '', path);
    this.path.set(path);
    this.error.set(''); this.notice.set('');
    // Each step opens at the detail level the working style asks for, whatever the previous step was toggled to.
    this.details.set(this.setup()?.preferences['setupDetail'] === 'detailed');
    window.scrollTo(0, 0);
    void this.load();
  }

  stepPath(stepId: string) {
    if (stepId === 'profile') return '/start';
    if (stepId === 'idea' || stepId === 'account') return `/start/${stepId}`;
    return `/start/${encodeURIComponent(this.projectId())}/${stepId}`;
  }

  stepState(step: Step, index: number) {
    if (index === this.stepIndex()) return 'current';
    const done = this.setup()?.completedSteps || [];
    if (index < 3 && (this.projectId() || index < this.stepIndex())) return 'done';
    return done.includes(step.id) ? 'done' : index < this.stepIndex() ? 'skipped' : 'upcoming';
  }

  canOpenStep(index: number) { return index < 3 ? !this.projectId() && index <= this.stepIndex() : Boolean(this.projectId()); }

  next() {
    const following = steps[this.stepIndex() + 1];
    if (following) this.go(this.stepPath(following.id));
  }

  private async api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(value.error || 'Something went wrong. Please try again.'), { status: response.status });
    return value as T;
  }

  private async run(work: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try { await work(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.busy.set(false); this.changeDetector.markForCheck(); }
  }

  private async refreshSession() { this.session.set(await this.api<Session>('/api/session')); }

  async load() {
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
    try {
      if (!this.catalog()) this.catalog.set(await this.api<Catalog>('/api/onboarding/catalog'));
      const session = this.session();
      const view = this.view();
      document.title = view === 'landing' ? 'Aludel · Turn ideas into working apps' : 'Aludel';
      if (['profile', 'idea', 'account'].includes(view)) {
        const draft = session?.draft;
        this.profile = draft?.profile || this.profile;
        this.appName = draft?.name || this.appName;
        this.pitch = draft?.pitch || this.pitch;
        if (view !== 'profile' && !draft?.profile) { this.go('/start'); return; }
        if (view === 'account' && !(draft?.name)) { this.go('/start/idea'); return; }
        if (session?.authenticated === false && view === 'account') this.accountMode.set('sign-up');
      }
      if ((view === 'projects' || this.projectId()) && !session?.authenticated) { this.go('/login'); return; }
      if (this.projectId()) {
        const setup = await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/setup`);
        this.applySetup(setup, true);
        if (view === 'stack' || view === 'project') this.pollPreview();
      } else this.setup.set(null);
      setTimeout(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }), 30);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally { this.changeDetector.markForCheck(); }
  }

  // Form drafts reset only when a page loads; saving one part (an upload, a feature) must not discard unsaved choices elsewhere.
  private applySetup(setup: ProjectSetup, resetDrafts = false) {
    this.setup.set(setup);
    if (!resetDrafts) return;
    this.feel = setup.design.feel || 'sleek-saas';
    this.feelChoice.set(this.feel);
    this.navigation = setup.design.navigation;
    this.routes.set(setup.pages.routes.map(page => ({ ...page })));
    this.pagesSaved.set('saved');
    this.theme = setup.design.theme;
    this.accent = setup.design.accent;
    this.designNotes = setup.design.notes;
    this.picks = new Set(setup.features.picks);
    this.stackPreset = setup.stack.preset || this.catalog()?.stacks.default || 'aludel-web-v1';
    this.stackOptions = { ...setup.stack.options };
    this.repositoryName ||= setup.project.slug;
    this.installationId ||= String(setup.github.installations.find(item => item.eligible)?.installation_id || '');
    this.details.set(setup.preferences['setupDetail'] === 'detailed');
  }

  // Working style and idea: stored as an anonymous draft until an account claims it.
  chooseProfile(id: string) { this.profile = id; }

  saveProfile() {
    return this.run(async () => {
      const value = await this.api<{ draft: Session['draft'] }>('/api/onboarding/draft', 'PUT', { profile: this.profile });
      this.session.update(session => session && { ...session, draft: value.draft });
      this.go('/start/idea');
    });
  }

  saveIdea() {
    return this.run(async () => {
      const value = await this.api<{ draft: Session['draft'] }>('/api/onboarding/draft', 'PUT', { name: this.appName, pitch: this.pitch });
      this.session.update(session => session && { ...session, draft: value.draft });
      this.go('/start/account');
    });
  }

  pitchHint() {
    if (this.profile === 'tinkerer') return 'One or two sentences you can build from. You will write the plan yourself.';
    if (this.profile === 'planner') return 'The purpose, not the requirements. You will shape the roadmap and details next.';
    return 'Say what it does and who it is for. Aludel fills in the details.';
  }

  // Account: sign-up and sign-in both continue the flow by claiming the draft on the server.
  submitAccount() {
    return this.run(async () => {
      const mode = this.accountMode();
      let result: { project?: { id: string } | null };
      if (mode === 'sign-up') {
        if (this.password !== this.confirmPassword) throw new Error('The passwords do not match.');
        result = await this.api('/api/accounts', 'POST', { name: this.accountName, email: this.email, password: this.password });
      } else if (mode === 'sign-in') {
        result = await this.api('/api/sign-in', 'POST', { email: this.email, password: this.password });
      } else {
        const session = this.session();
        result = await this.api(session?.setupRequired ? '/api/setup' : '/api/login', 'POST', { key: this.ownerKey });
      }
      this.password = ''; this.confirmPassword = ''; this.ownerKey = '';
      await this.refreshSession();
      if (result.project?.id) this.go(`/start/${encodeURIComponent(result.project.id)}/github`);
      else if (this.view() === 'login') this.afterLogin();
      else await this.claim();
    });
  }

  private async claim() {
    const result = await this.api<{ project: { id: string } }>('/api/onboarding/claim', 'POST', {});
    await this.refreshSession();
    this.go(`/start/${encodeURIComponent(result.project.id)}/github`);
  }

  continueSignedIn() { return this.run(() => this.claim()); }

  private afterLogin() {
    const session = this.session();
    if (session?.aludelMember && this.accountMode() === 'owner') location.assign('/#/the-machine/overview');
    else this.go('/projects');
  }

  signOut() {
    return this.run(async () => {
      await this.api('/api/logout', 'POST', {});
      await this.refreshSession();
      this.go('/');
    });
  }

  // Aludel never handles a GitHub password: this sends the person to github.com and back (OAuth with PKCE).
  signInWithGithub(returnPath: string) { location.assign(`/api/auth/github?return=${encodeURIComponent(returnPath)}`); }

  // GitHub: the identity belongs to the user; the repository belongs to the project.
  connectGithub() { location.assign(`/api/github/connect?return=${encodeURIComponent(this.stepPath('github'))}`); }
  installGithub() { location.assign(`/api/github/install?return=${encodeURIComponent(this.stepPath('github'))}`); }

  refreshInstallations() {
    return this.run(async () => {
      await this.api('/api/github/installations/refresh', 'POST', {});
      await this.load();
      this.notice.set('GitHub installations refreshed.');
    });
  }

  createRepository() {
    return this.run(async () => {
      this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/repository`, 'POST', {
        name: this.repositoryName, private: this.repositoryPrivate, installationId: Number(this.installationId),
        description: this.setup()?.direction?.summary.slice(0, 350) || ''
      }));
      const repository = this.setup()?.github.repository;
      this.notice.set(repository?.status === 'ready' ? 'Repository created and your first commit is on GitHub.' : 'The repository was created but the first push needs attention. Nothing will be created twice.');
    });
  }

  markAndNext(step: string) {
    return this.run(async () => {
      this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/steps/${step}`, 'POST', {}));
      this.next();
    });
  }

  agentChanged(connection: AgentConnection | null) {
    this.setup.update(setup => setup && { ...setup, agentConnection: connection });
  }

  // Look & feel.
  // A feel is a starting point: it sets accent, theme and desktop navigation, all of which stay editable.
  chooseFeel(id: string, feel: Feel) {
    this.feel = id;
    this.feelChoice.set(id);
    this.accent = feel.accent;
    this.theme = feel.theme;
    this.navigation = feel.navigation;
  }

  setNavigation(value: 'sidebar' | 'top') {
    this.navigation = value;
    if (this.view() === 'pages') this.schedulePagesSave();
  }

  feelStyle(feel: Feel) {
    return { '--feel-accent': feel.accent, '--feel-radius': `${Math.min(feel.radius, 18)}px`, '--feel-surface': feel.theme === 'dark' ? feel.surfaceDark : feel.surface, '--feel-font': feel.font } as Record<string, string>;
  }

  saveLook() {
    return this.run(async () => {
      this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/design`, 'PUT', { feel: this.feel, theme: this.theme, accent: this.accent, notes: this.designNotes, navigation: this.navigation }));
      this.next();
    });
  }

  upload(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'text/markdown', 'text/plain'];
    const type = file.type || (file.name.endsWith('.md') ? 'text/markdown' : '');
    if (!allowed.includes(type)) { this.error.set('Upload a PNG, JPEG or WebP image, or a Markdown or text document.'); return; }
    const reader = new FileReader();
    reader.onload = () => this.run(async () => {
      const dataUrl = String(reader.result).replace(/^data:[^;,]*/, `data:${type}`);
      this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/assets`, 'POST', { filename: file.name, dataUrl, notes: this.uploadNotes }));
      this.uploadNotes = ''; inputElement.value = '';
      this.notice.set(`${file.name} added.`);
    });
    reader.readAsDataURL(file);
  }

  removeAsset(id: string) {
    return this.run(async () => this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/assets/${encodeURIComponent(id)}`, 'DELETE')));
  }

  // Pages: edited directly in the proto-site and saved shortly after each change.
  routesChanged(routes: PageRoute[]) {
    for (const route of this.routes()) this.lastKnown.set(route.id, { ...route });
    this.routes.set(routes);
    this.schedulePagesSave();
  }

  private schedulePagesSave() {
    this.pagesSaved.set('unsaved');
    if (this.pagesTimer) clearTimeout(this.pagesTimer);
    this.pagesTimer = setTimeout(() => void this.savePages(), 700);
  }

  private async savePages(reassign: Record<string, string> = {}) {
    if (this.pagesTimer) { clearTimeout(this.pagesTimer); this.pagesTimer = null; }
    if (this.pendingDelete()) return;
    this.pagesSaved.set('saving');
    try {
      const setup = await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/pages`, 'PUT', { routes: this.routes(), navigation: this.navigation, reassign });
      this.setup.set(setup);
      this.pagesSaved.set('saved');
      this.error.set('');
    } catch (error) {
      this.pagesSaved.set('unsaved');
      const deleted = (this.setup()?.pages.routes || []).find(page => !this.routes().some(route => route.id === page.id) && page.stories?.length);
      if ((error as { status?: number }).status === 409 && deleted) {
        this.reassignTarget = this.routes()[0]?.id || '';
        this.pendingDelete.set({ id: deleted.id, label: deleted.label, stories: deleted.stories?.length || 0 });
      } else this.error.set(error instanceof Error ? error.message : String(error));
    } finally { this.changeDetector.markForCheck(); }
  }

  continueFromPages() {
    return this.run(async () => {
      await this.savePages();
      if (this.pagesSaved() !== 'saved') return;
      this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/steps/pages`, 'POST', {}));
      this.next();
    });
  }

  // Deleting a page that realises stories needs somewhere for them to go (knowledge-structures: Pages).
  confirmReassign() {
    const pending = this.pendingDelete();
    if (!pending || !this.reassignTarget) return;
    this.pendingDelete.set(null);
    void this.savePages({ [pending.id]: this.reassignTarget });
  }

  // Undo only the deletion: put that page back where it was and keep every other unsaved edit.
  keepPage() {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    const saved = this.setup()?.pages.routes || [];
    const savedPage = saved.find(route => route.id === pending?.id);
    const page = (pending && this.lastKnown.get(pending.id)) || savedPage;
    if (page) {
      const next = [...this.routes()];
      next.splice(Math.min(savedPage ? saved.indexOf(savedPage) : next.length, next.length), 0, { ...page });
      this.routes.set(next.slice(0, 5));
    }
    this.schedulePagesSave();
  }

  openProject(slug: string, event: Event) {
    event.preventDefault();
    location.assign(`/p/${encodeURIComponent(slug)}`);
  }

  templateCount(pack: { stories: { template?: boolean }[] }) { return pack.stories.filter(story => story.template).length; }
  phaseLabel(phase: string) { return ({ demo: 'Demo', mvp: 'MVP', later: 'Later' } as Record<string, string>)[phase] || phase; }

  pageTypeLabel(id: string) { return this.catalog()?.pageTypes[id]?.label || id; }

  // Features.
  togglePick(id: string) {
    const next = new Set(this.picks);
    if (next.has(id)) next.delete(id); else next.add(id);
    this.picks = next;
  }

  saveFeatures(advance = true) {
    return this.run(async () => {
      const custom = this.newFeatureTitle.trim() ? [{ title: this.newFeatureTitle, summary: this.newFeatureSummary }] : [];
      this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/features`, 'PUT', { picks: [...this.picks], custom }));
      this.newFeatureTitle = ''; this.newFeatureSummary = '';
      if (advance) this.next(); else this.notice.set('Story idea added.');
    });
  }

  removeFeature(id: string) {
    return this.run(async () => this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/features/${encodeURIComponent(id)}`, 'DELETE')));
  }

  // Stack.
  // The Build step's action saves the stack choice and builds from exactly what the proto-site shows.
  buildApp() {
    return this.run(async () => {
      await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/stack`, 'PUT', { preset: this.stackPreset, options: this.stackOptions });
      this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/skeleton`, 'POST', {}));
      this.pollPreview();
    });
  }

  optionEntries(id: string) { return Object.entries(this.catalog()?.stacks.presets[id]?.options || {}).map(([key, value]) => ({ key, ...value })); }
  layerEntries(id: string) { return Object.entries(this.catalog()?.stacks.presets[id]?.layers || {}).map(([layer, value]) => ({ layer, value })); }

  // Build and preview.
  private pollPreview() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    const status = this.setup()?.preview.status;
    if (!['building', 'starting'].includes(status || '')) return;
    this.pollTimer = setTimeout(async () => {
      try {
        const value = await this.api<{ preview: ProjectSetup['preview'] }>(`/api/projects/${encodeURIComponent(this.projectId())}/preview`);
        this.setup.update(setup => setup && { ...setup, preview: value.preview });
      } catch { /* The next load retries. */ }
      this.pollPreview();
    }, 1200);
  }

  previewLabel() {
    const status = this.setup()?.preview.status;
    if (status === 'building') return 'Building your app…';
    if (status === 'starting') return 'Starting your app…';
    if (status === 'running') return 'Your app is running';
    if (status === 'failed') return 'The build needs attention';
    if (status === 'stopped') return 'Built · starts when opened';
    return 'Not built yet';
  }

  // Working style can change at any time, as a whole profile or one preference at a time.
  switchProfile(profile: string) {
    return this.run(async () => {
      this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/preferences`, 'PUT', { profile }));
      this.notice.set(`Working style changed to ${this.catalog()?.profiles[profile]?.label}. Your individual changes were kept.`);
    });
  }

  setPreference(key: string, value: string) {
    return this.run(async () => {
      this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/preferences`, 'PUT', { overrides: { [key]: value } }));
      this.notice.set('Preference saved.');
    });
  }

  resetPreferences() {
    return this.run(async () => {
      this.applySetup(await this.api<ProjectSetup>(`/api/projects/${encodeURIComponent(this.projectId())}/preferences`, 'PUT', { resetOverrides: true }));
      this.notice.set('Preferences reset to the working style defaults.');
    });
  }

  isOverridden(key: string) { return key in (this.setup()?.overrides || {}); }
  profileLabel(id?: string | null) { return (id && this.catalog()?.profiles[id]?.label) || ''; }
  feelLabel(id?: string | null) { return (id && this.catalog()?.feels[id]?.label) || 'Not chosen'; }
  stackLabel(id?: string | null) { return (id && this.catalog()?.stacks.presets[id]?.label) || 'Not chosen'; }
  size(bytes: number) { return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`; }
}
