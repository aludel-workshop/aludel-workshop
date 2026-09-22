import { ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DependencyListComponent, RecordListComponent, StatusComponent } from './components';
import { AgentConnectionComponent } from './agent-connection';
import { Session } from './onboarding-model';
import { PublicComponent } from './public';
import { ProjectShellComponent } from './layers/shell';
import { Decision, DownstreamRecord, GitHubIntegration, Overview, OwnerRequest, ProductDirection, ProductFeature, ProductOutcome, ProductWorkspace, ProjectBrand, Proposal, RecordDetail, SourceRecord, WorkTask } from './model';

@Component({
  selector: 'machine-app', standalone: true,
  imports: [FormsModule, NgTemplateOutlet, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, DependencyListComponent, RecordListComponent, StatusComponent, AgentConnectionComponent, PublicComponent, ProjectShellComponent],
  templateUrl: './app.html'
})
export class App {
  private readonly changeDetector = inject(ChangeDetectorRef);
  authenticated = signal<boolean | null>(null);
  // Public pages (marketing, sign-in, onboarding, apps) use real paths; Aludel's own workspace keeps its hash routes until ONB-06.
  mode = signal<'loading' | 'public' | 'workspace' | 'project'>('loading');
  session = signal<Session | null>(null);
  setupRequired = signal(false);
  loading = signal(false);
  error = signal('');
  route = signal(location.hash.slice(1) || '/the-machine/overview');
  overview = signal<Overview | null>(null);
  brand = signal<ProjectBrand>({ id: 'the-machine', slug: 'the-machine', name: 'Aludel', description: 'The product that turns intent into reviewed software.', tagline: 'Turn ideas into what’s next.', accent_color: '#9a5d32', hero_image_path: '/brand/aludel-workshop.png', updated_at: '' });
  github = signal<GitHubIntegration | null>(null);
  records = signal<SourceRecord[]>([]);
  detail = signal<RecordDetail | null>(null);
  proposals = signal<Proposal[]>([]);
  proposal = signal<Proposal | null>(null);
  decisions = signal<Decision[]>([]);
  decision = signal<Decision | null>(null);
  downstream = signal<DownstreamRecord[]>([]);
  tasks = signal<WorkTask[]>([]);
  inbox = signal<OwnerRequest[]>([]);
  product = signal<ProductWorkspace | null>(null);
  productEditing = signal(false);
  selectedProductId = signal('');
  productMessage = signal('');
  productTitle = '';
  productSummary = '';
  productAudience = '';
  productOutcomes = '';
  productConstraints = '';
  productSuccess = '';
  productHorizon: 'now'|'next'|'later' = 'now';
  productStatus = 'proposed';
  productPriority = 1;
  productOutcomeId = '';
  productEvidence = '';
  intakeFilter = signal<'new'|'deferred'>('new');
  selectedIntakeId = signal('');
  showDone = signal(false);
  answers: Record<string, string> = {};
  searchQuery = '';
  requestText = '';
  requestSaved = signal(false);
  savedRequestId = '';
  importMessage = signal('');
  saveMessage = signal('');
  proposalTitle = '';
  proposalIntent = '';
  proposalAcceptance = '';
  proposalAssumptions = '';
  proposalExclusions = '';
  decisionAnswer = '';
  decisionRationale = '';
  selectedGithubInstallationId = '';
  repositoryName = 'app-builder';
  repositoryDescription = 'Aludel turns product intent into reviewed software.';
  repositoryPrivate = true;
  repositoryConfirmation = '';
  integrationMessage = signal('');
  brandMessage = signal('');
  brandName = 'Aludel';
  brandDescription = 'The product that turns intent into reviewed software.';
  brandTagline = 'Turn ideas into what’s next.';
  brandAccentColor = '#9a5d32';
  brandImageDataUrl = '';
  brandImagePreview = '/brand/aludel-workshop.png';
  page = computed(() => this.route().split('?')[0].split('/')[2] || 'projects');
  workView = computed(() => {
    if (this.page() !== 'work') return '';
    const segment = this.route().split('?')[0].split('/')[3] || '';
    return ['plan', 'operations', 'intake'].includes(segment) ? segment : 'overview';
  });
  workId = computed(() => {
    if (this.page() !== 'work') return '';
    const segments = this.route().split('?')[0].split('/');
    if (!segments[3] || ['plan', 'operations', 'intake'].includes(segments[3])) return '';
    return decodeURIComponent((segments[3] === 'item' ? segments.slice(4) : segments.slice(3)).join('/'));
  });
  productView = computed(() => this.page() === 'product' ? (this.route().split('?')[0].split('/')[3] || 'direction') : '');
  selectedOutcome = computed(() => this.product()?.outcomes.find(item => item.id === this.selectedProductId()) || null);
  selectedFeature = computed(() => this.product()?.features.find(item => item.id === this.selectedProductId()) || null);
  selectedTasks = computed(() => this.tasks().filter(task => task.id === this.workId()));
  filteredIntake = computed(() => this.inbox().filter(item => item.status === this.intakeFilter()));
  selectedIntake = computed(() => this.inbox().find(item => item.id === this.selectedIntakeId()) || this.filteredIntake()[0] || null);
  attentionTasks = computed(() => this.tasks().filter(task => ['submitted', 'awaiting-answer', 'failed', 'ready'].includes(task.state)).sort((a, b) => this.workRank(a) - this.workRank(b)).slice(0, 6));
  operationTasks = computed(() => this.tasks().filter(task => this.showDone() || !['cancelled'].includes(task.state)).sort((a, b) => this.workRank(a) - this.workRank(b)));
  completedTaskCount = computed(() => this.tasks().filter(task => ['submitted', 'cancelled'].includes(task.state)).length);
  runningTaskCount = computed(() => this.tasks().filter(task => task.state === 'running').length);
  queuedTaskCount = computed(() => this.tasks().filter(task => task.state === 'authorized').length);
  blockedTaskCount = computed(() => this.tasks().filter(task => task.state === 'ready' && task.input_status !== 'current').length);
  newIntakeCount = computed(() => this.inbox().filter(item => item.status === 'new').length);
  deferredIntakeCount = computed(() => this.inbox().filter(item => item.status === 'deferred').length);
  recordId = computed(() => this.page() === 'knowledge' ? decodeURIComponent(this.route().split('?')[0].split('/').slice(3).join('/')) : '');
  proposalId = computed(() => this.page() === 'proposals' ? decodeURIComponent(this.route().split('?')[0].split('/').slice(3).join('/')) : '');
  decisionId = computed(() => this.page() === 'decisions' ? decodeURIComponent(this.route().split('?')[0].split('/').slice(3).join('/')) : '');

  constructor() {
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');
    window.addEventListener('hashchange', () => {
      this.route.set(location.hash.slice(1) || '/the-machine/overview');
      this.error.set('');
      if (this.page() === 'request') { this.requestSaved.set(false); this.requestText = ''; this.savedRequestId = ''; }
      this.saveMessage.set('');
      this.productEditing.set(false); this.productMessage.set(''); this.selectedProductId.set('');
      void this.loadRoute();
      setTimeout(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }), 20);
    });
    void this.initialize();
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    const value = await response.json();
    if (response.status === 401 && path !== '/api/login') this.showPublic('/login');
    if (!response.ok) throw new Error(value.error || 'The request failed.');
    return value as T;
  }

  private async initialize() {
    try {
      const session = await this.request<Session>('/api/session');
      this.session.set(session);
      this.authenticated.set(session.authenticated);
      this.setupRequired.set(session.setupRequired);
      const workspaceRoute = location.pathname === '/' && location.hash.startsWith('#/');
      // /p/<slug>/… is a project's layered workspace (LAY-02); it needs a signed-in member.
      if (location.pathname.startsWith('/p/')) { if (session.authenticated) this.mode.set('project'); else this.showPublic('/login'); }
      else if (location.pathname !== '/') this.mode.set('public');
      else if (session.authenticated && session.aludelMember) {
        this.mode.set('workspace');
        await this.loadBrand(); await this.loadRoute();
      } else if (workspaceRoute) this.showPublic(session.authenticated ? '/projects' : '/login');
      else this.showPublic(session.authenticated ? '/projects' : '/');
    } catch (error) {
      this.session.set({ authenticated: false, user: null, setupRequired: false, aludelMember: false, githubSignIn: false, projects: [], draft: null });
      this.error.set(String(error)); this.showPublic('/');
    }
  }

  private showPublic(path: string) {
    if (location.pathname !== path) history.replaceState({}, '', path);
    this.authenticated.set(false);
    this.session.update(session => session ? { ...session, authenticated: path === '/projects' && session.authenticated } : session);
    this.mode.set('public');
  }

  async logout() {
    await this.request('/api/logout', { method: 'POST' });
    location.assign('/');
  }

  async loadRoute() {
    if (!this.authenticated()) return;
    this.loading.set(true); this.error.set('');
    try {
      if (this.page() === 'product') {
        const product = await this.request<ProductWorkspace>('/api/projects/the-machine/product');
        this.product.set(product);
        if (this.productView() === 'direction') this.setProductDraft(product.direction);
        else if (this.productView() === 'roadmap' && product.outcomes.length) this.selectProductRecord(product.outcomes[0]);
        else if (this.productView() === 'features' && product.features.length) this.selectProductRecord(product.features[0]);
      } else if (this.page() === 'knowledge' && this.recordId()) {
        this.detail.set(await this.request<RecordDetail>(`/api/records/${encodeURIComponent(this.recordId())}`));
      } else if (this.page() === 'knowledge') {
        await this.search();
      } else if (this.page() === 'proposals' && this.proposalId()) {
        const proposal = await this.request<Proposal>(`/api/proposals/${encodeURIComponent(this.proposalId())}`);
        this.proposal.set(proposal); this.setProposalDraft(proposal);
      } else if (this.page() === 'proposals') {
        this.proposals.set((await this.request<{ proposals: Proposal[] }>('/api/proposals')).proposals);
      } else if (this.page() === 'decisions' && this.decisionId()) {
        const decision = await this.request<Decision>(`/api/decisions/${encodeURIComponent(this.decisionId())}`);
        this.decision.set(decision); this.decisionAnswer = decision.answer || decision.recommendation || ''; this.decisionRationale = decision.rationale || '';
      } else if (this.page() === 'decisions') {
        this.decisions.set((await this.request<{ decisions: Decision[] }>('/api/decisions')).decisions);
      } else if (this.page() === 'work') {
        this.downstream.set((await this.request<{ records: DownstreamRecord[] }>('/api/dependents')).records);
        const work = await this.request<{ tasks: WorkTask[]; requests: OwnerRequest[] }>('/api/work');
        this.tasks.set(work.tasks); this.inbox.set(work.requests);
        if (!this.selectedIntakeId() && work.requests.length) this.selectedIntakeId.set(work.requests[0].id);
      } else {
        this.overview.set(await this.request<Overview>('/api/overview'));
        this.setBrand(this.overview()!.project);
        const integration = await this.request<GitHubIntegration>('/api/integrations/github');
        this.github.set(integration);
        if (!this.selectedGithubInstallationId) {
          this.selectedGithubInstallationId = String(integration.installations.find(item => item.eligible)?.installation_id || '');
        }
      }
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); this.changeDetector.markForCheck(); }
  }

  private setBrand(brand: ProjectBrand) {
    this.brand.set(brand);
    this.brandName = brand.name;
    this.brandDescription = brand.description;
    this.brandTagline = brand.tagline;
    this.brandAccentColor = brand.accent_color;
    this.brandImagePreview = brand.hero_image_path || '';
    document.title = `${brand.name} · Project workshop`;
  }

  private async loadBrand() {
    this.setBrand(await this.request<ProjectBrand>('/api/projects/the-machine/brand'));
  }

  chooseBrandImage(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      this.error.set('Choose a PNG, JPEG, or WebP image no larger than 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { this.brandImageDataUrl = String(reader.result); this.brandImagePreview = this.brandImageDataUrl; this.changeDetector.markForCheck(); };
    reader.readAsDataURL(file);
  }

  async saveBrand() {
    if (!this.brandName.trim() || this.loading()) return;
    this.loading.set(true); this.error.set(''); this.brandMessage.set('');
    try {
      const updated = await this.request<ProjectBrand>('/api/projects/the-machine/brand', { method: 'PUT', body: JSON.stringify({
        name: this.brandName, description: this.brandDescription, tagline: this.brandTagline,
        accentColor: this.brandAccentColor, heroImageDataUrl: this.brandImageDataUrl || undefined
      }) });
      this.brandImageDataUrl = '';
      this.setBrand(updated);
      this.brandMessage.set('Project brand saved. The shell now uses this project-owned identity.');
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  async workAction(task: WorkTask, action: string) {
    this.loading.set(true); this.error.set('');
    try {
      await this.request(`/api/work/${action}`, { method: 'POST', body: JSON.stringify({ id: task.id, expectedVersion: task.version, text: this.answers[task.id] }) });
      await this.loadRoute();
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  async triageRequest(item: OwnerRequest, status: 'new'|'deferred') {
    this.loading.set(true); this.error.set('');
    try {
      await this.request(`/api/requests/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ expectedStatus: item.status, status }) });
      await this.loadRoute();
      this.intakeFilter.set(status);
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  chooseIntakeFilter(status: 'new'|'deferred') {
    this.intakeFilter.set(status);
    this.selectedIntakeId.set(this.inbox().find(item => item.status === status)?.id || '');
  }

  workRank(task: WorkTask) {
    if (task.state === 'submitted') return 0;
    if (['failed', 'awaiting-answer', 'paused', 'cancelling'].includes(task.state)) return 1;
    if (task.state === 'running') return 2;
    if (task.state === 'authorized') return 3;
    if (task.state === 'ready' && task.input_status !== 'current') return 4;
    if (task.state === 'ready') return 5;
    return 6;
  }

  workLabel(task: WorkTask) {
    if (task.state === 'submitted') return 'Ready for review';
    if (task.state === 'failed') return 'Problem';
    if (task.state === 'awaiting-answer') return 'Question · waiting for you';
    if (task.state === 'paused') return 'Paused · ready to resume';
    if (task.state === 'running') return 'In progress';
    if (task.state === 'cancelling') return 'Stopping';
    if (task.state === 'authorized') return 'Not started · queued';
    if (task.state === 'ready' && task.input_status !== 'current') return 'Not started · blocked';
    if (task.state === 'ready') return 'Ready to authorize';
    return task.state;
  }

  workTone(task: WorkTask) {
    if (task.state === 'submitted') return 'review';
    if (['failed', 'awaiting-answer', 'paused', 'cancelling'].includes(task.state)) return 'problem';
    if (task.state === 'running') return 'active';
    if (task.state === 'ready' && task.input_status !== 'current') return 'blocked';
    return 'queued';
  }

  workActionLabel(task: WorkTask) {
    if (task.state === 'submitted') return 'Review result';
    if (['failed', 'awaiting-answer', 'paused', 'cancelling'].includes(task.state)) return 'Resolve';
    if (task.state === 'running') return 'View activity';
    if (task.state === 'authorized') return 'Open queued work';
    if (task.state === 'ready' && task.input_status !== 'current') return 'Review blocker';
    return 'Review scope';
  }

  async search() {
    const value = await this.request<{ records: SourceRecord[] }>(`/api/records?q=${encodeURIComponent(this.searchQuery)}`);
    this.records.set(value.records);
  }

  async reimport() {
    this.loading.set(true); this.importMessage.set('');
    try {
      const result = await this.request<{ documents_seen: number; revisions_created: number; unresolved_links: number }>('/api/imports', { method: 'POST' });
      this.importMessage.set(`Import complete: ${result.documents_seen} sources checked, ${result.revisions_created} new revisions, ${result.unresolved_links} unresolved links.`);
      this.overview.set(await this.request<Overview>('/api/overview'));
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  connectGithub() { location.assign('/api/integrations/github/connect'); }
  installGithub() { location.assign('/api/integrations/github/install'); }
  eligibleGithubInstallations(integration: GitHubIntegration) { return integration.installations.filter(item => item.eligible); }

  async refreshGithubInstallations() {
    this.loading.set(true); this.error.set(''); this.integrationMessage.set('');
    try {
      const integration = await this.request<GitHubIntegration>('/api/integrations/github/installations/refresh', { method: 'POST', body: '{}' });
      this.github.set(integration);
      this.selectedGithubInstallationId = String(integration.installations.find(item => item.eligible)?.installation_id || '');
      this.integrationMessage.set('GitHub installations refreshed.');
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  async createGithubRepository() {
    if (this.repositoryConfirmation !== this.repositoryName || this.loading()) return;
    this.loading.set(true); this.error.set(''); this.integrationMessage.set('');
    try {
      await this.request('/api/integrations/github/repository', { method: 'POST', body: JSON.stringify({
        name: this.repositoryName, description: this.repositoryDescription, private: this.repositoryPrivate,
        confirmName: this.repositoryConfirmation, installationId: Number(this.selectedGithubInstallationId)
      }) });
      this.github.set(await this.request<GitHubIntegration>('/api/integrations/github'));
      this.integrationMessage.set(this.github()?.repository?.status === 'ready'
        ? 'GitHub repository created. The initial commit is pushed and future work can use this binding.'
        : 'GitHub repository created, but local setup needs attention. No second remote will be created.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
      this.github.set(await this.request<GitHubIntegration>('/api/integrations/github'));
    } finally { this.loading.set(false); }
  }

  async finishGithubSetup() {
    this.loading.set(true); this.error.set(''); this.integrationMessage.set('');
    try {
      await this.request('/api/integrations/github/repository/finish', { method: 'POST', body: '{}' });
      this.github.set(await this.request<GitHubIntegration>('/api/integrations/github'));
      this.integrationMessage.set('Local Git setup finished and the initial commit is now on GitHub.');
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  async saveRequest() {
    if (!this.requestText.trim() || this.loading()) return;
    this.loading.set(true); this.error.set('');
    try {
      const saved = await this.request<{ id: string }>('/api/requests', { method: 'POST', body: JSON.stringify({ body: this.requestText }) });
      this.savedRequestId = saved.id;
      this.requestSaved.set(true);
      this.overview.set(await this.request<Overview>('/api/overview'));
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  async createProposal() {
    if (!this.savedRequestId) return;
    this.loading.set(true); this.error.set('');
    try {
      const proposal = await this.request<Proposal>('/api/proposals', { method: 'POST', body: JSON.stringify({ requestId: this.savedRequestId, title: this.requestText.split('\n')[0].slice(0, 90), intent: this.requestText, acceptance: [], assumptions: [], exclusions: [] }) });
      location.hash = `/the-machine/proposals/${encodeURIComponent(proposal.id)}`;
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  private setProposalDraft(proposal: Proposal) {
    this.proposalTitle = proposal.title; this.proposalIntent = proposal.intent;
    this.proposalAcceptance = (proposal.acceptance || []).join('\n'); this.proposalAssumptions = (proposal.assumptions || []).join('\n'); this.proposalExclusions = (proposal.exclusions || []).join('\n');
  }

  private lines(value: string) { return value.split('\n').map(item => item.trim()).filter(Boolean); }

  selectProductRecord(record: ProductDirection|ProductOutcome|ProductFeature) {
    this.selectedProductId.set(record.id); this.productEditing.set(false); this.setProductDraft(record);
  }

  startProductRecord(kind: 'outcome'|'feature') {
    this.selectedProductId.set(''); this.productEditing.set(true); this.productTitle = ''; this.productSummary = '';
    this.productStatus = 'proposed'; this.productHorizon = 'now'; this.productPriority = 1; this.productOutcomeId = ''; this.productEvidence = '';
    if (kind === 'outcome') this.productOutcomeId = '__outcome__';
  }

  setProductDraft(record: ProductDirection|ProductOutcome|ProductFeature) {
    this.productTitle = record.title; this.productSummary = record.summary;
    if (record.kind === 'direction') {
      this.productAudience = record.audience; this.productOutcomes = record.outcomes.join('\n');
      this.productConstraints = record.constraints.join('\n'); this.productSuccess = record.success.join('\n');
    } else if (record.kind === 'outcome') {
      this.productHorizon = record.horizon; this.productStatus = record.status; this.productPriority = record.priority; this.productOutcomeId = '__outcome__';
    } else {
      this.productStatus = record.status; this.productOutcomeId = record.outcome_id || ''; this.productEvidence = record.evidence.join('\n');
    }
  }

  productOutcomeTitle(id?: string|null) { return this.product()?.outcomes.find(item => item.id === id)?.title || 'No linked outcome'; }
  outcomesFor(horizon: 'now'|'next'|'later') { return this.product()?.outcomes.filter(item => item.horizon === horizon) || []; }

  async saveProduct(kind: 'direction'|'outcome'|'feature') {
    const current = kind === 'direction' ? this.product()?.direction : kind === 'outcome' ? this.selectedOutcome() : this.selectedFeature();
    this.loading.set(true); this.error.set(''); this.productMessage.set('');
    try {
      const body: Record<string, unknown> = { expectedRevision: current?.revision, title: this.productTitle, summary: this.productSummary };
      if (kind === 'direction') Object.assign(body, { audience: this.productAudience, outcomes: this.lines(this.productOutcomes), constraints: this.lines(this.productConstraints), success: this.lines(this.productSuccess) });
      else if (kind === 'outcome') Object.assign(body, { horizon: this.productHorizon, status: this.productStatus, priority: this.productPriority });
      else Object.assign(body, { status: this.productStatus, outcome_id: this.productOutcomeId || null, evidence: this.lines(this.productEvidence) });
      const path = `/api/projects/the-machine/product/${kind}${current ? `/${encodeURIComponent(current.id)}` : ''}`;
      const saved = await this.request<ProductDirection|ProductOutcome|ProductFeature>(path, { method: 'PUT', body: JSON.stringify(body) });
      const product = await this.request<ProductWorkspace>('/api/projects/the-machine/product'); this.product.set(product);
      const refreshed = kind === 'direction' ? product.direction : kind === 'outcome' ? product.outcomes.find(item => item.id === saved.id)! : product.features.find(item => item.id === saved.id)!;
      this.selectProductRecord(refreshed); this.productMessage.set((saved as ProductDirection & {unchanged?: boolean}).unchanged ? 'No changes to save.' : `Revision ${saved.revision} saved. No work was started.`);
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  async reviseProposal() {
    const proposal = this.proposal(); if (!proposal) return;
    this.loading.set(true); this.error.set(''); this.saveMessage.set('');
    try {
      const updated = await this.request<Proposal>(`/api/proposals/${encodeURIComponent(proposal.id)}/revisions`, { method: 'POST', body: JSON.stringify({ expectedRevision: proposal.revision, title: this.proposalTitle, intent: this.proposalIntent, acceptance: this.lines(this.proposalAcceptance), assumptions: this.lines(this.proposalAssumptions), exclusions: this.lines(this.proposalExclusions) }) });
      this.proposal.set(await this.request<Proposal>(`/api/proposals/${encodeURIComponent(updated.id)}`)); this.setProposalDraft(this.proposal()!);
      this.saveMessage.set(`Proposal revision ${updated.revision} saved. No work has started.`);
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  async answerCurrentDecision() {
    const decision = this.decision(); if (!decision || !this.decisionAnswer) return;
    this.loading.set(true); this.error.set(''); this.saveMessage.set('');
    try {
      const updated = await this.request<Decision>(`/api/decisions/${encodeURIComponent(decision.id)}/answer`, { method: 'POST', body: JSON.stringify({ expectedRevision: decision.revision, answer: this.decisionAnswer, rationale: this.decisionRationale }) });
      this.decision.set(updated);
      this.saveMessage.set(`Decision revision ${updated.revision} saved. ${updated.affected?.filter(item => item.currency === 'stale').length || 0} linked records need reassessment; unrelated work was unchanged.`);
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  async reloadDecision() {
    const decision = this.decision(); if (!decision) return;
    const current = await this.request<Decision>(`/api/decisions/${encodeURIComponent(decision.id)}`);
    this.decision.set(current);
    this.saveMessage.set(`Current revision ${current.revision} loaded. Your drafted answer and rationale are still here.`);
  }

  async reassess(id: string) {
    this.loading.set(true); this.error.set('');
    try {
      await this.request(`/api/dependents/${encodeURIComponent(id)}/reassess`, { method: 'POST' });
      this.downstream.set((await this.request<{ records: DownstreamRecord[] }>('/api/dependents')).records);
      if (this.decision()) this.decision.set(await this.request<Decision>(`/api/decisions/${encodeURIComponent(this.decision()!.id)}`));
      this.saveMessage.set(`${id} reassessed against current decision revisions. No execution started.`);
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.loading.set(false); }
  }

  format(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  heroBackground(path?: string | null) { return path ? `linear-gradient(90deg,rgba(13,18,28,.88),rgba(13,18,28,.18)),url('${path}')` : ''; }
  shortHash(value = '') { return value.slice(0, 12); }
  metadataEntries(value: Record<string, string>) { return Object.entries(value); }
}
