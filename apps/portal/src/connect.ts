import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Catalog, ConnectCheck, ConnectRepository, GitHubStatus, Session } from './onboarding-model';

// EX-02A: New project starts by asking whether there's code already. "Start a new app" continues to today's onboarding;
// "Connect an existing repository" is this path: working style, account (GitHub), repository, where the code is, layers,
// connect. Nothing about the app is assumed, and no project exists until the person connects. Choices live on the draft,
// so the GitHub sign-in round trip loses nothing.
const steps = [
  { id: 'new', label: 'Start' }, { id: 'style', label: 'Working style' }, { id: 'account', label: 'Account' },
  { id: 'repository', label: 'Repository' }, { id: 'code', label: 'Code' }, { id: 'layers', label: 'Layers' }, { id: 'finish', label: 'Connect' }
] as const;
type Step = typeof steps[number]['id'];
const pathOf = (step: Step) => step === 'new' ? '/new' : `/connect/${step}`;

@Component({
  selector: 'aludel-connect',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <nav class="pub-steps" aria-label="New project setup">
    <p class="pub-steps-compact">Step {{ index() + 1 }} of {{ steps.length }} · <strong>{{ steps[index()].label }}</strong></p>
    <ol>
      @for (item of steps; track item.id; let i = $index) {
        <li [class]="'pub-step ' + (i === index() ? 'current' : i < index() ? 'done' : 'upcoming')">
          @if (i < index() && reachable(item.id)) {
            <a [href]="pathOf(item.id)" (click)="open(item.id, $event)"><span class="pub-step-dot" aria-hidden="true">{{ i + 1 }}</span>{{ item.label }}</a>
          } @else {
            <span [attr.aria-current]="i === index() ? 'step' : null"><span class="pub-step-dot" aria-hidden="true">{{ i + 1 }}</span>{{ item.label }}</span>
          }
        </li>
      }
    </ol>
  </nav>
  <main id="main" class="pub-main">
    @if (error()) { <p class="error-message pub-alert" role="alert">{{ error() }}</p> }
    @switch (step()) {
      @case ('new') {
        <section aria-labelledby="new-heading">
          <p class="eyebrow">New project</p>
          <h1 id="new-heading" tabindex="-1">Do you have code already?</h1>
          <p class="pub-lead">Aludel can start a new app for you, or work with one you already have.</p>
          <fieldset class="pub-choice-grid pub-choice-two">
            <legend class="visually-hidden">How to start</legend>
            <label class="pub-choice" [class.selected]="start() === 'new'">
              <input type="radio" name="start" value="new" [checked]="start() === 'new'" (change)="start.set('new')">
              <mat-icon aria-hidden="true">auto_awesome</mat-icon>
              <strong>Start a new app</strong>
              <span>Describe your idea. Aludel sets up the repository, the design and a working skeleton.</span>
              <small>Working style, your idea, layers, look &amp; feel, pages and build.</small>
            </label>
            <label class="pub-choice" [class.selected]="start() === 'connect'">
              <input type="radio" name="start" value="connect" [checked]="start() === 'connect'" (change)="start.set('connect')">
              <mat-icon aria-hidden="true">link</mat-icon>
              <strong>Connect an existing repository</strong>
              <span>Bring an app that's already on GitHub. Aludel reads its code and works alongside it.</span>
              <small>Nothing about the app is assumed or generated. When you confirm, Aludel adds one folder, <code>.aludel/</code>.</small>
            </label>
          </fieldset>
          <div class="pub-actions pub-footer-actions">
            <button mat-flat-button type="button" (click)="chooseStart()" [disabled]="!start() || busy()">Continue<mat-icon iconPositionEnd aria-hidden="true">arrow_forward</mat-icon></button>
          </div>
        </section>
      }
      @case ('style') {
        <section aria-labelledby="style-heading">
          <p class="eyebrow">Step 2 · Working style</p>
          <h1 id="style-heading" tabindex="-1">How do you want to work?</h1>
          <p class="pub-lead">This sets how much Aludel does for you. It isn't permanent: you can switch styles or change single preferences later.</p>
          <fieldset class="pub-choice-grid">
            <legend class="visually-hidden">Working style</legend>
            @for (item of profiles(); track item.id) {
              <label class="pub-choice" [class.selected]="profile() === item.id">
                <input type="radio" name="profile" [value]="item.id" [checked]="profile() === item.id" (change)="profile.set(item.id)">
                <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
                <strong>{{ item.label }}</strong><span>{{ item.summary }}</span><small>{{ item.detail }}</small>
              </label>
            }
          </fieldset>
          <div class="pub-actions pub-footer-actions">
            <a mat-button href="/new" (click)="open('new', $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Back</a>
            <button mat-flat-button type="button" (click)="saveProfile()" [disabled]="!profile() || busy()">Continue<mat-icon iconPositionEnd aria-hidden="true">arrow_forward</mat-icon></button>
          </div>
        </section>
      }
      @case ('account') {
        <section class="pub-narrow" aria-labelledby="account-heading">
          <p class="eyebrow">Step 3 · Account</p>
          @if (!session()?.authenticated) {
            <h1 id="account-heading" tabindex="-1">Sign in with GitHub</h1>
            <p class="pub-lead">Your repository is on GitHub, so your Aludel account starts there too. Aludel sees only the repositories its GitHub app is installed on.</p>
            @if (session()?.githubSignIn) {
              <button mat-flat-button type="button" class="pub-github" (click)="go('/api/auth/github?return=' + encode('/connect/account'))"><mat-icon aria-hidden="true">code</mat-icon>Continue with GitHub</button>
              <p class="field-hint">You'll approve access on GitHub and come straight back. Aludel never sees your GitHub password.</p>
            } @else {
              <p>GitHub isn't set up on this Aludel yet, so connecting a repository isn't available. <a href="/login" (click)="nav('/login', $event)">Sign in</a> with an Aludel account, or start a new app instead.</p>
            }
          } @else {
            <h1 id="account-heading" tabindex="-1">Connect GitHub</h1>
            @if (github(); as gh) {
              @if (!gh.configured) {
                <p class="pub-lead">GitHub isn't set up on this Aludel yet. The operator needs to configure the Aludel GitHub App (see the portal README).</p>
              } @else if (!gh.connected) {
                <p class="pub-lead">Signed in as {{ session()?.user?.name }}. Connect the GitHub account your repository is on.</p>
                <button mat-flat-button type="button" (click)="go('/api/github/connect?return=' + encode('/connect/account'))"><mat-icon aria-hidden="true">link</mat-icon>Connect GitHub</button>
              } @else if (!eligible().length) {
                <p class="pub-lead">Connected as <strong>{{ gh.login }}</strong>. Install the Aludel app on the account or organization that owns the repository, with access to all repositories.</p>
                <div class="pub-actions"><button mat-flat-button type="button" (click)="go('/api/github/install?return=' + encode('/connect/account'))">Install the Aludel GitHub App</button>
                  <button mat-button type="button" (click)="refreshInstallations()" [disabled]="busy()">I've installed it, check again</button></div>
              } @else {
                <div class="pub-status-card ok"><mat-icon aria-hidden="true">check_circle</mat-icon><div><strong>Signed in as {{ gh.login }}</strong><span>The Aludel app is installed on {{ eligibleNames() }}.</span></div></div>
                <div class="pub-actions pub-footer-actions">
                  <a mat-button href="/connect/style" (click)="open('style', $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Back</a>
                  <button mat-flat-button type="button" (click)="open('repository')">Continue<mat-icon iconPositionEnd aria-hidden="true">arrow_forward</mat-icon></button>
                </div>
              }
            } @else { <p>Checking GitHub…</p> }
          }
        </section>
      }
      @case ('repository') {
        <section class="pub-narrow" aria-labelledby="repository-heading">
          <p class="eyebrow">Step 4 · Repository</p>
          <h1 id="repository-heading" tabindex="-1">Which repository?</h1>
          <p class="pub-lead">Repositories the Aludel app can reach on GitHub.</p>
          <div class="pub-chip-row" role="group" aria-label="GitHub account">
            @for (item of eligible(); track item.installation_id) {
              <button type="button" class="pub-chip" [attr.aria-pressed]="installationId() === item.installation_id" (click)="pickInstallation(item.installation_id)">{{ item.account_login }} <small>{{ item.target_type === 'User' ? 'Personal' : 'Organization' }}</small></button>
            }
          </div>
          <mat-form-field appearance="outline" class="wide-field"><mat-label>Search repositories</mat-label><input matInput name="repoSearch" [ngModel]="search()" (ngModelChange)="search.set($event)" autocomplete="off"></mat-form-field>
          @if (repositories(); as list) {
            <ul class="pub-repo-list" role="listbox" aria-label="Repositories">
              @for (repo of filtered(); track repo.name) {
                <li role="option" tabindex="0" [attr.aria-selected]="picked()?.name === repo.name" (click)="picked.set(repo)" (keydown.enter)="picked.set(repo)" (keydown.space)="$event.preventDefault(); picked.set(repo)">
                  <mat-icon aria-hidden="true">{{ repo.private ? 'lock' : 'public' }}</mat-icon>
                  <span><strong>{{ repo.owner }}/{{ repo.name }}</strong><small>{{ repo.private ? 'Private' : 'Public' }} · default branch {{ repo.defaultBranch }}{{ repo.updatedAt ? ' · updated ' + when(repo.updatedAt) : '' }}</small></span>
                  @if (picked()?.name === repo.name) { <mat-icon aria-hidden="true" class="pub-picked">check_circle</mat-icon> }
                </li>
              } @empty { <li class="pub-repo-empty">No repositories match.</li> }
            </ul>
          } @else { <p>Loading repositories…</p> }
          <p class="field-hint">Missing one? <a [href]="'/api/github/install?return=' + encode('/connect/repository')">Give the Aludel app access on GitHub</a>.</p>
          <div class="pub-actions pub-footer-actions">
            <a mat-button href="/connect/account" (click)="open('account', $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Back</a>
            <button mat-flat-button type="button" (click)="check()" [disabled]="!picked() || busy()">{{ busy() ? 'Checking…' : 'Check repository' }}<mat-icon iconPositionEnd aria-hidden="true">arrow_forward</mat-icon></button>
          </div>
        </section>
      }
      @case ('code') {
        <section class="pub-narrow" aria-labelledby="code-heading">
          <p class="eyebrow">Step 5 · Code</p>
          <h1 id="code-heading" tabindex="-1">Where is the code?</h1>
          @if (checked(); as found) {
            @if (found.blocked) {
              <p class="pub-lead">Aludel checked <strong>{{ found.repository.owner }}/{{ found.repository.name }}</strong> without changing anything.</p>
              <div class="pub-status-card warn"><mat-icon aria-hidden="true">error</mat-icon><div><strong>Default branch {{ found.blocked.branch }}</strong><span>{{ found.message }}</span></div></div>
            } @else {
              <p class="pub-lead">Aludel checked <strong>{{ found.repository.owner }}/{{ found.repository.name }}</strong> at <code>main</code> ({{ found.commit?.slice(0, 7) }}) without changing anything. {{ found.existing ? 'It already says where its code is.' : 'Pick the folders Code should read.' }}</p>
              <p class="pub-facts">
                <span><mat-icon aria-hidden="true" class="ok">check_circle</mat-icon>Default branch <code>main</code></span>
                <span><mat-icon aria-hidden="true">description</mat-icon>{{ found.files }} files</span>
                <span><mat-icon aria-hidden="true">{{ found.existing ? 'check_circle' : 'folder' }}</mat-icon>{{ found.existing ? 'Has .aludel/' : 'No .aludel/ yet' }}</span>
              </p>
              @if (!found.existing) {
                <fieldset class="pub-folder-list">
                  <legend class="visually-hidden">Folders with an app in them</legend>
                  @for (folder of found.folders || []; track folder.path) {
                    <label [class.nested]="!folder.root">
                      <input type="checkbox" [checked]="chosenFolders().includes(folder.path)" (change)="toggleFolder(folder.path)">
                      <span class="pub-folder-text"><code>{{ folder.root ? found.repository.name + ' (root)' : folder.path }}</code>
                        <small>{{ folderMeta(folder) }}</small></span>
                      @if (folder.suggested) { <span class="pub-tag good">Suggested</span> }
                      @if (folder.stack.length) { <span class="pub-tag">{{ folder.stack.join(' · ') }}</span> }
                    </label>
                  }
                </fieldset>
              }
              <h2 class="pub-subhead">Code reads</h2>
              <p class="pub-path-chips">@for (path of paths(); track path) { <code>{{ path }}</code> } @empty { <span class="field-hint">Nothing chosen yet.</span> }</p>
              @if (!found.existing) {
                <details class="pub-edit-paths" [open]="editing()" (toggle)="editing.set($any($event.target).open)">
                  <summary>Edit paths</summary>
                  <mat-form-field appearance="outline" class="wide-field"><mat-label>Paths Code reads, one per line</mat-label>
                    <textarea matInput rows="4" name="pathsText" [ngModel]="paths().join('\\n')" (ngModelChange)="editPaths($event)"></textarea></mat-form-field>
                </details>
              }
              @if (reads(); as r) {
                @if (r.over) { <div class="pub-status-card warn"><mat-icon aria-hidden="true">warning</mat-icon><div><span>These paths cover {{ r.reads }} source files. Code reads up to {{ r.limit }}. Choose narrower folders or edit the paths.</span></div></div> }
                @else if (!r.reads && paths().length) { <div class="pub-status-card warn"><mat-icon aria-hidden="true">info</mat-icon><div><span>No source files match. Code reads {{ found.readsLanguages }} for now.</span></div></div> }
                @else if (paths().length) { <div class="pub-status-card"><mat-icon aria-hidden="true">info</mat-icon><div><span>Code will read {{ r.reads }} files. {{ found.existing ? 'This comes from the repository\\'s .aludel/layer.json; change it there.' : 'This is saved in the repository, in .aludel/layer.json. Changing it later is reviewed like any other change.' }}</span></div></div> }
              }
            }
          } @else { <p class="pub-lead">Checking the repository…</p> }
          <div class="pub-actions pub-footer-actions">
            <a mat-button href="/connect/repository" (click)="open('repository', $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Back</a>
            <button mat-flat-button type="button" (click)="savePaths()" [disabled]="busy() || !codeReady()">Continue<mat-icon iconPositionEnd aria-hidden="true">arrow_forward</mat-icon></button>
          </div>
        </section>
      }
      @case ('layers') {
        <section class="pub-layer-selection" aria-labelledby="layers-heading">
          <p class="eyebrow">Step 6 · Layers</p>
          <h1 id="layers-heading" tabindex="-1">Which layers?</h1>
          <p class="pub-lead">Code reads the repository. The other layers start empty, and you fill them in as the project goes.</p>
          <div class="pub-layer-catalog">
            @for (item of catalog()?.layers || []; track item.key) {
              <label class="pub-layer-choice" [class.selected]="layers().includes(item.key)">
                <input type="checkbox" [checked]="layers().includes(item.key)" [disabled]="item.key === 'platform'" (change)="toggleLayer(item.key)">
                <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
                <span><small>{{ item.category }}</small><strong>{{ item.name }}</strong><span>{{ item.key === 'platform' ? 'Reads ' + codeWhere() + '.' : item.description + ' Starts empty.' }}</span></span>
              </label>
            }
          </div>
          <div class="pub-actions pub-footer-actions">
            <a mat-button href="/connect/code" (click)="open('code', $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Back</a>
            <button mat-flat-button type="button" (click)="saveLayers()" [disabled]="busy()">Continue<mat-icon iconPositionEnd aria-hidden="true">arrow_forward</mat-icon></button>
          </div>
        </section>
      }
      @case ('finish') {
        <section class="pub-narrow" aria-labelledby="finish-heading">
          @if (connected(); as done) {
            <p class="eyebrow">Connected</p>
            <h1 id="finish-heading" tabindex="-1">{{ done.name }} is connected</h1>
            <ul class="pub-progress">
              <li><mat-icon aria-hidden="true">check_circle</mat-icon>Cloned {{ checked()?.repository?.owner }}/{{ checked()?.repository?.name }}</li>
              @if (!checked()?.existing) { <li><mat-icon aria-hidden="true">check_circle</mat-icon>Added .aludel/ ({{ checked()?.adds?.length }} files) and {{ done.pushed ? 'pushed it to main on GitHub' : 'committed it on main' }}</li> }
              <li><mat-icon aria-hidden="true">check_circle</mat-icon>Code read {{ done.reads }} files</li>
            </ul>
            @if (!done.pushed) { <div class="pub-status-card warn"><mat-icon aria-hidden="true">warning</mat-icon><div><span>The push to GitHub needs another try; Code shows its sync state.</span></div></div> }
            <p class="field-hint">New commits on main on GitHub are picked up on their own. Work items in this project merge into it when you close them out.</p>
            <div class="pub-actions pub-footer-actions"><a mat-flat-button [href]="'/p/' + done.slug">Open {{ done.name }}<mat-icon iconPositionEnd aria-hidden="true">arrow_forward</mat-icon></a></div>
          } @else {
            <p class="eyebrow">Step 7 · Connect</p>
            <h1 id="finish-heading" tabindex="-1">Ready to connect</h1>
            <p class="pub-lead">Check what Aludel will do, then connect.</p>
            <mat-form-field appearance="outline" class="wide-field"><mat-label>Project name</mat-label><input matInput name="projectName" [ngModel]="projectName()" (ngModelChange)="projectName.set($event)" maxlength="60"><mat-hint>Suggested from the repository's name. You can rename it later.</mat-hint></mat-form-field>
            @if (checked(); as found) {
              <dl class="pub-connect-summary">
                <dt>Repository</dt><dd>{{ found.repository.owner }}/{{ found.repository.name }} · <code>main</code> · {{ found.commit?.slice(0, 7) }}</dd>
                <dt>Code reads</dt><dd><code>{{ paths().join(', ') }}</code></dd>
                <dt>Layers</dt><dd>{{ layerNames() }}</dd>
                <dt>Working style</dt><dd>{{ profileLabel() }}</dd>
              </dl>
              @if (found.existing) {
                <div class="pub-status-card ok"><mat-icon aria-hidden="true">check_circle</mat-icon><div><span>The repository already has .aludel/. Nothing is added or pushed.</span></div></div>
              } @else {
                <div class="pub-status-card"><mat-icon aria-hidden="true">commit</mat-icon><div><span>Aludel adds {{ found.adds?.length }} files in one commit and pushes it to <code>main</code> on GitHub. Nothing else in the repository changes.</span>
                  <details><summary>The {{ found.adds?.length }} files</summary><ul class="pub-file-list" tabindex="0" aria-label="Files Aludel adds">@for (path of found.adds || []; track path) { <li><code>{{ path }}</code></li> }</ul></details></div></div>
              }
            }
            <div class="pub-actions pub-footer-actions">
              <a mat-button href="/connect/layers" (click)="open('layers', $event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Back</a>
              <button mat-flat-button type="button" (click)="connect()" [disabled]="busy() || !projectName().trim() || !checked() || !!checked()?.blocked">{{ busy() ? 'Connecting…' : checked()?.existing ? 'Connect' : 'Connect and push' }}<mat-icon iconPositionEnd aria-hidden="true">arrow_forward</mat-icon></button>
            </div>
          }
        </section>
      }
    }
  </main>`
})
export class ConnectComponent {
  readonly session = input.required<Session | null>();
  readonly catalog = input.required<Catalog | null>();
  readonly step = input.required<Step>();
  // How the page moves between its own routes (history) and leaves for another page.
  readonly navigate = input.required<(path: string) => void | Promise<void>>();
  readonly steps = steps;
  readonly pathOf = pathOf;
  private readonly loaded = computed(() => this.session() !== null);
  readonly index = computed(() => Math.max(0, steps.findIndex(item => item.id === this.step())));
  readonly error = signal('');
  readonly busy = signal(false);
  readonly start = signal<'new' | 'connect' | null>(null);
  readonly profile = signal<string | null>(null);
  readonly github = signal<GitHubStatus | null>(null);
  readonly installationId = signal<number | null>(null);
  readonly repositories = signal<ConnectRepository[] | null>(null);
  readonly search = signal('');
  readonly picked = signal<ConnectRepository | null>(null);
  readonly checked = signal<ConnectCheck | null>(null);
  readonly chosenFolders = signal<string[]>([]);
  readonly paths = signal<string[]>([]);
  readonly editing = signal(false);
  readonly reads = signal<{ reads: number; limit: number; over: boolean } | null>(null);
  readonly layers = signal<string[]>([]);
  readonly projectName = signal('');
  readonly connected = signal<{ name: string; slug: string; reads: number; pushed: boolean } | null>(null);
  private countTimer: ReturnType<typeof setTimeout> | null = null;

  readonly profiles = computed(() => Object.entries(this.catalog()?.profiles || {}).map(([id, value]) => ({ id, ...value })));
  readonly eligible = computed(() => (this.github()?.installations || []).filter(item => item.eligible));
  readonly eligibleNames = computed(() => this.eligible().map(item => item.account_login).join(', '));
  readonly filtered = computed(() => (this.repositories() || []).filter(repo => repo.name.toLowerCase().includes(this.search().trim().toLowerCase())));
  readonly codeReady = computed(() => { const found = this.checked(), r = this.reads(); return Boolean(found && !found.blocked && this.paths().length && r && !r.over && r.reads > 0); });
  readonly codeWhere = computed(() => { const found = this.checked(); if (!found || found.existing) return 'the repository'; const named = this.chosenFolders().map(path => path || 'the repository root'); return named.length ? named.join(', ') : 'the chosen paths'; });
  readonly layerNames = computed(() => (this.catalog()?.layers || []).filter(item => this.layers().includes(item.key)).map(item => item.name).join(', '));
  readonly profileLabel = computed(() => this.catalog()?.profiles[this.profile() || '']?.label || '');

  constructor() {
    // Each step loads what it needs from the draft (and GitHub) when it opens.
    // Runs when the step changes (navigation refreshes the session first) and once the session has loaded; a session update
    // alone doesn't re-enter the step.
    effect(() => { const step = this.step(); if (!this.loaded()) return; untracked(() => void this.enter(step, this.session())); });
  }

  private async enter(step: Step, session: Session | null) {
    this.error.set('');
    const draft = session?.draft;
    if (draft?.start) this.start.set(draft.start);
    if (draft?.profile && !this.profile()) this.profile.set(draft.profile);
    if (step !== 'new' && step !== 'style' && draft?.start !== 'connect') { this.open('new'); return; }
    if (['account', 'repository', 'code', 'layers', 'finish'].includes(step) && !draft?.profile) { this.open('style'); return; }
    if (['repository', 'code', 'layers', 'finish'].includes(step) && !session?.authenticated) { this.open('account'); return; }
    try {
      if (step === 'account' && session?.authenticated) this.github.set(await this.api<GitHubStatus>('/api/github'));
      if (step === 'repository') {
        if (!this.github()) this.github.set(await this.api<GitHubStatus>('/api/github'));
        const first = draft?.connect?.installationId || this.eligible()[0]?.installation_id || null;
        if (!this.eligible().length) { this.open('account'); return; }
        if (this.installationId() !== first || !this.repositories()) await this.pickInstallation(first!, draft?.connect?.name);
      }
      if (['code', 'layers', 'finish'].includes(step)) {
        if (!draft?.connect?.name || !draft.connect.installationId) { this.open('repository'); return; }
        if (!this.checked()) await this.runCheck(draft.connect.installationId, draft.connect.name, draft.connect.paths);
      }
      if (step === 'layers' || step === 'finish') {
        const all = (this.catalog()?.layers || []).map(item => item.key);
        if (!this.layers().length) this.layers.set(draft?.layersSelected ? [...new Set(['platform', ...draft.layers])] : all.filter(key => key !== 'deploy'));
      }
      if (step === 'finish' && !this.projectName()) this.projectName.set(this.suggestName(this.checked()?.repository.name || ''));
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
  }

  open(step: Step, event?: Event) { event?.preventDefault(); this.navigate()(pathOf(step)); }
  nav(path: string, event?: Event) { event?.preventDefault(); this.navigate()(path); }
  go(url: string) { location.assign(url); }
  encode(value: string) { return encodeURIComponent(value); }
  reachable(step: Step) { return step === 'new' || step === 'style' || Boolean(this.session()?.authenticated); }
  when(iso: string) {
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
    return days < 1 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString();
  }
  folderMeta(folder: { root: boolean; manifests: string[]; files: number; dirs: string[] }) {
    return [folder.manifests.length ? folder.manifests.join(', ') : folder.root ? 'No app manifest here' : '', `${folder.files} files`, folder.dirs.length ? folder.dirs.map(dir => dir + '/').join(', ') : ''].filter(Boolean).join(' · ');
  }
  private suggestName(repo: string) { return repo.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()).slice(0, 60); }

  private async api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error || 'Something went wrong. Please try again.');
    return value as T;
  }
  private async run(work: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try { await work(); } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); } finally { this.busy.set(false); }
  }
  private saveDraft(change: Record<string, unknown>) { return this.api('/api/onboarding/draft', 'PUT', change); }

  chooseStart() {
    return this.run(async () => {
      await this.saveDraft({ start: this.start() });
      if (this.start() === 'new') this.navigate()('/start');
      else this.open('style');
    });
  }
  saveProfile() { return this.run(async () => { await this.saveDraft({ profile: this.profile() }); this.open('account'); }); }
  refreshInstallations() { return this.run(async () => { this.github.set(await this.api<GitHubStatus>('/api/github/installations/refresh', 'POST')); }); }

  async pickInstallation(id: number, keep?: string) {
    this.installationId.set(id); this.repositories.set(null);
    if (!keep) this.picked.set(null);
    try {
      const value = await this.api<{ repositories: ConnectRepository[] }>(`/api/onboarding/connect/repositories?installationId=${id}`);
      this.repositories.set(value.repositories);
      if (keep) this.picked.set(value.repositories.find(repo => repo.name === keep) || null);
    } catch (error) { this.repositories.set([]); this.error.set(error instanceof Error ? error.message : String(error)); }
  }

  check() {
    const repo = this.picked(), id = this.installationId();
    if (!repo || !id) return;
    return this.run(async () => { this.checked.set(null); await this.runCheck(id, repo.name); this.open('code'); });
  }
  private async runCheck(installationId: number, name: string, saved?: string[]) {
    const found = await this.api<ConnectCheck>('/api/onboarding/connect/check', 'POST', { installationId, name });
    this.checked.set(found);
    if (found.blocked) { this.paths.set([]); this.reads.set(null); return; }
    if (found.existing) { this.chosenFolders.set([]); this.paths.set(found.existing.units); await this.count(); return; }
    const suggested = (found.folders || []).filter(folder => folder.suggested);
    if (saved?.length) { this.paths.set(saved); this.chosenFolders.set((found.folders || []).filter(folder => folder.globs.every(glob => saved.includes(glob))).map(folder => folder.path)); }
    else { this.chosenFolders.set(suggested.map(folder => folder.path)); this.paths.set(suggested.flatMap(folder => folder.globs)); }
    await this.count();
  }
  toggleFolder(path: string) {
    const folders = this.checked()?.folders || [];
    const chosen = this.chosenFolders().includes(path) ? this.chosenFolders().filter(item => item !== path) : [...this.chosenFolders(), path];
    this.chosenFolders.set(folders.filter(folder => chosen.includes(folder.path)).map(folder => folder.path));
    this.paths.set(folders.filter(folder => chosen.includes(folder.path)).flatMap(folder => folder.globs));
    void this.count();
  }
  editPaths(text: string) {
    this.paths.set(text.split('\n').map(line => line.trim()).filter(Boolean));
    if (this.countTimer) clearTimeout(this.countTimer);
    this.countTimer = setTimeout(() => void this.count(), 400);
  }
  private async count() {
    if (!this.paths().length) { this.reads.set(null); return; }
    try { this.reads.set(await this.api('/api/onboarding/connect/count', 'POST', { paths: this.paths() })); }
    catch (error) { this.reads.set(null); this.error.set(error instanceof Error ? error.message : String(error)); }
  }
  savePaths() { return this.run(async () => { await this.saveDraft({ connect: { paths: this.paths() } }); this.open('layers'); }); }
  toggleLayer(key: string) { if (key === 'platform') return; this.layers.set(this.layers().includes(key) ? this.layers().filter(item => item !== key) : [...this.layers(), key]); }
  saveLayers() { return this.run(async () => { await this.saveDraft({ layers: [...new Set(['platform', ...this.layers()])] }); this.open('finish'); }); }
  connect() {
    return this.run(async () => {
      const value = await this.api<{ project: { name: string; slug: string }; reads: number; sync: { state?: string } | null }>('/api/onboarding/connect', 'POST', { name: this.projectName().trim(), paths: this.paths() });
      this.connected.set({ name: value.project.name, slug: value.project.slug, reads: value.reads, pushed: value.sync?.state === 'in-sync' });
    });
  }
}
