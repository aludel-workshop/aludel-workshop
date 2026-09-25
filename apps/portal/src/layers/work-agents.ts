import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AgentConnectionComponent } from '../agent-connection';
import { avatarCredits } from '../avatars';
import { AgentProfile, ProjectContext } from './context';
import { AvatarComponent, RefChipComponent, tokens } from './work-shared';

interface ModelList { provider: string; label: string; defaultModel: string; models: { id: string; label: string }[]; }
interface ProfileDraft { name: string; description: string; model: string; effort: string; instructions: string; context: string[]; itemOutput: number; batchTokens: number | null; monthlyTokens: number | null; attach: string; rationale: string; }

// Work › Agents (WORK-UX-01): agent profiles are who does the work: a robot, a model and effort, their own instructions and
// context, and usage limits. What each action allows is set on the action in Roles.
@Component({
  selector: 'aludel-work-agents', standalone: true, imports: [FormsModule, MatIconModule, MatTooltipModule, AgentConnectionComponent, AvatarComponent, RefChipComponent],
  template: `
  @if (profile(); as current) {
    <p class="lay-eyebrow"><a [href]="ctx.link('work', 'agents')" (click)="ctx.go(ctx.link('work', 'agents'), $event)">Agents</a> › {{ current.name }}</p>
    <form class="lay-card lay-profile" (ngSubmit)="save(current)" aria-labelledby="profile-name">
      <div class="lay-profile-head">
        <div class="lay-profile-pic">
          <button type="button" class="lay-pic-edit" (click)="editingLook.set(!editingLook())" [attr.aria-expanded]="editingLook()" aria-controls="profile-look" [attr.aria-label]="'Change ' + current.name + '\\'s robot'">
            <aludel-avatar [who]="{ kind: 'agent', id: current.id }" size="xl" /><span class="lay-pic-overlay" aria-hidden="true"><mat-icon>edit</mat-icon></span></button>
          @if (editingLook()) {
            <div class="lay-look" id="profile-look">
              <div class="lay-tones" role="radiogroup" aria-label="Colour">@for (color of ctx.catalog()?.botColors || []; track color; let index = $index) {
                <button type="button" role="radio" class="lay-tone" [style.--lay-metal]="color" [attr.aria-checked]="current.avatar.color === color" [attr.aria-label]="'Tone ' + (index + 1)" (click)="look(current, { color })"></button> }</div>
              <button type="button" class="lay-button ghost small" (click)="look(current, { seed: randomSeed() })"><mat-icon aria-hidden="true">casino</mat-icon>New robot</button>
              <small class="lay-credit">{{ credit.title }} by {{ credit.creator }}</small>
            </div>
          }
        </div>
        <div class="lay-profile-id">
          @if (editingName()) {
            <label class="visually-hidden" for="profile-name-input">Name</label><input id="profile-name-input" name="name" class="lay-name-input" [(ngModel)]="draft.name" maxlength="40">
            <label class="visually-hidden" for="profile-description">Description</label><input id="profile-description" name="description" [(ngModel)]="draft.description" maxlength="300" placeholder="What this profile is for">
          } @else {
            <h1 id="profile-name" tabindex="-1">{{ current.name }}@if (!current.active) { <span class="lay-chip lay-plain">Deactivated</span> }</h1>
            <p class="lay-muted">{{ current.description || 'No description yet.' }}</p>
          }
          <div class="lay-actionbar">
            <button type="button" class="lay-button ghost small" (click)="editingName.set(!editingName())"><mat-icon aria-hidden="true">edit</mat-icon>{{ editingName() ? 'Done editing' : 'Rename' }}</button>
            <button type="button" class="lay-button ghost small" (click)="assigned(current)"><mat-icon aria-hidden="true">filter_list</mat-icon>Assigned work · {{ openWork(current) }}</button>
            <button type="button" class="lay-button ghost small" (click)="setActive(current, !current.active)" [matTooltip]="current.active && defaultFor(current) ? defaultFor(current) + ' actions default to it; they wait until you choose someone else' : ''">
              <mat-icon aria-hidden="true">{{ current.active ? 'pause_circle' : 'play_circle' }}</mat-icon>{{ current.active ? 'Deactivate' : 'Activate' }}</button>
          </div>
        </div>
      </div>

      <div class="lay-two">
        <label>Model
          <select name="model" [(ngModel)]="draft.model">
            <option value="">Account default{{ models()?.defaultModel ? ' (' + models()?.defaultModel + ')' : '' }}</option>
            @for (model of models()?.models || []; track model.id) { <option [value]="model.id">{{ model.label }}</option> }
            @if (draft.model && !hasModel(draft.model)) { <option [value]="draft.model">{{ draft.model }}</option> }
          </select>
          <small class="lay-hint">{{ modelNote() }}</small></label>
        <fieldset class="lay-effort"><legend>Effort</legend>
          <div class="lay-seg3" role="radiogroup" aria-label="Effort">@for (level of ctx.catalog()?.efforts || []; track level) {
            <label [class.on]="draft.effort === level"><input type="radio" name="effort" [value]="level" [(ngModel)]="draft.effort">{{ level }}</label> }</div>
          <small class="lay-hint">How long the model thinks. Higher costs more; not every model uses it.</small></fieldset>
      </div>
      <label>Its own instructions (read last, after the action's)
        <textarea name="instructions" rows="4" [(ngModel)]="draft.instructions" [placeholder]="'Anything ' + current.name + ' should do differently from any other agent'"></textarea></label>
      <div><span class="lay-field-label">Always reads</span><p class="lay-hint">Records this profile reads whatever it's doing, on top of each action's and item's.</p>
        <div class="lay-refs">@for (id of draft.context; track id) { <span class="lay-token"><aludel-ref [id]="id" /><button type="button" (click)="draft.context = remove(draft.context, id)" [attr.aria-label]="'Stop reading ' + (ctx.refInfo(id)?.label || id)"><mat-icon aria-hidden="true">close</mat-icon></button></span> }</div>
        <div class="lay-inline-add"><label class="visually-hidden" for="profile-attach">Record to attach</label>
          <select id="profile-attach" name="attach" [(ngModel)]="draft.attach"><option value="">Attach a record…</option>@for (option of attachable(); track option.id) { <option [value]="option.id">{{ option.label }}</option> }</select>
          <button type="button" class="lay-button ghost small" [disabled]="!draft.attach" (click)="attach()">Attach</button></div></div>

      <fieldset class="lay-usage"><legend>Usage controls</legend>
        <p class="lay-hint">A run stops before the next item once a limit is reached; Go is refused while the month's budget is spent. Leave a field empty for no limit.</p>
        <div class="lay-three">
          <label>Output tokens per item<input type="number" name="itemOutput" min="500" max="20000" step="500" [(ngModel)]="draft.itemOutput" required><small class="lay-hint">A draft longer than this is cut off and fails.</small></label>
          <label>Tokens per batch run<input type="number" name="batchTokens" min="0" step="10000" [(ngModel)]="draft.batchTokens" placeholder="No limit"><small class="lay-hint">This run: {{ runUsage(current) }}</small></label>
          <label>Tokens per month<input type="number" name="monthlyTokens" min="0" step="100000" [(ngModel)]="draft.monthlyTokens" placeholder="No limit"><small class="lay-hint">This month: {{ monthUsage(current) }}</small></label>
        </div>
        <p class="lay-hint">Set a spend limit with your provider too; Aludel counts tokens, the provider bills them.</p>
      </fieldset>
      <div class="lay-row lay-wrap"><label class="visually-hidden" for="profile-why">Why this change</label><input id="profile-why" name="rationale" class="lay-grow" [(ngModel)]="draft.rationale" placeholder="Why this change (saved with the revision)">
        <button type="submit" class="lay-button">Save profile</button><span class="lay-muted small">Revision {{ current.revision }}. Running items keep the revision they started with.</span></div>
    </form>
  } @else {
    <div class="lay-grid lay-g2">
      <aludel-agent-connection class="lay-card" [projectId]="ctx.projectId()" [projectName]="ctx.setup()?.project?.name || ''" heading="Account" description="Agents run on your own Anthropic or OpenAI account: paste an API key. Every profile uses it." (changed)="ctx.reload()" />
      <form class="lay-card lay-form" (ngSubmit)="saveInstructions()" aria-labelledby="project-instructions"><h2 id="project-instructions">Project instructions</h2>
        <p class="lay-muted small">Everyone reads these first, then the role's, then the action's, then the profile's own. Exported to <code>docs/agents.md</code> so any coding tool reads the same rules.</p>
        <label class="visually-hidden" for="project-instructions-text">Project instructions</label><textarea id="project-instructions-text" name="projectInstructions" rows="5" [(ngModel)]="instructionsDraft"></textarea>
        <label class="visually-hidden" for="project-instructions-why">Why this change</label><input id="project-instructions-why" name="instructionsWhy" [(ngModel)]="instructionsWhy" placeholder="Why this change (saved with the revision)">
        <div class="lay-row lay-wrap"><button type="submit" class="lay-button small">Save</button><button type="button" class="lay-button ghost small" (click)="exportAgents()"><mat-icon aria-hidden="true">download</mat-icon>Export the agent guide</button></div></form>
    </div>
    <div class="lay-section-head lay-gap-top"><h2>Profiles</h2><span class="lay-muted small">Who does agent work. Roles decide which actions each one takes.</span></div>
    <div class="lay-profiles">
      @for (entry of profiles(); track entry.id) {
        <a class="lay-pcard" [class.lay-pcard-off]="!entry.active" [style.--lay-metal]="entry.avatar.color" [href]="ctx.link('work', 'agents', entry.id)" (click)="ctx.go(ctx.link('work', 'agents', entry.id), $event)">
          <span class="lay-pcard-top"><aludel-avatar [who]="{ kind: 'agent', id: entry.id }" size="lg" /><span><strong>{{ entry.name }}</strong><small>{{ entry.model || 'Account default' }} · {{ entry.effort }} effort</small></span></span>
          <span class="lay-muted small">{{ entry.description || 'No description yet.' }}</span>
          <span class="lay-pcard-foot">@if (!entry.active) { <span class="lay-chip lay-plain">Deactivated</span> } @if (entry.context.length) { <span class="lay-chip lay-plain">{{ entry.context.length }} always read</span> }
            <span class="lay-chip lay-plain">{{ defaultFor(entry) }} {{ defaultFor(entry) === 1 ? 'action' : 'actions' }}</span></span>
        </a>
      }
      <button type="button" class="lay-pcard lay-pcard-new" (click)="create()"><mat-icon aria-hidden="true">add</mat-icon>New profile</button>
    </div>
    <p class="lay-credit lay-gap-top">Robots: {{ credit.title }} by {{ credit.creator }}, {{ credit.license.toLowerCase() }}.</p>
  }`
})
export class WorkAgentsComponent {
  readonly ctx = inject(ProjectContext);
  readonly id = input<string | null>(null);
  readonly credit = avatarCredits.bot;
  readonly profiles = computed(() => this.ctx.data()?.profiles || []);
  readonly profile = computed(() => this.profiles().find(entry => entry.id === this.id()) || null);
  readonly models = signal<ModelList | null>(null);
  readonly modelError = signal('');
  readonly editingLook = signal(false);
  readonly editingName = signal(false);
  readonly attachable = computed(() => {
    const data = this.ctx.data(); if (!data) return [];
    const ids = [...data.claims.map(entry => entry.id), ...data.insights.map(entry => entry.id), ...data.projects.map(entry => entry.id), ...Object.values(data.vision).map(entry => entry.id), ...data.docs.map(entry => entry.id), ...data.research.map(entry => entry.id), ...data.specs.map(entry => entry.id),
      ...data.stories.map(entry => entry.id), ...data.pages.map(entry => entry.id), ...data.objects.map(entry => entry.id), ...data.access.map(entry => entry.id)];
    return ids.map(id => ({ id, label: `${this.ctx.refInfo(id)?.kindLabel}: ${this.ctx.refInfo(id)?.label}` })).filter(option => !this.draft.context.includes(option.id));
  });
  draft: ProfileDraft = this.blank();
  instructionsDraft = ''; instructionsWhy = '';
  private draftFor = '';
  private instructionsFor = -1;

  constructor() {
    effect(() => {
      const current = this.profile();
      const instructions = this.ctx.data()?.projectInstructions;
      untracked(() => {
        if (current && `${current.id}:${current.revision}` !== this.draftFor) {
          this.draftFor = `${current.id}:${current.revision}`; this.fill(current);
          // A profile just added opens ready to be named.
          if (current.revision === 1 && current.name === 'New profile') this.editingName.set(true);
        }
        if (instructions && instructions.revision !== this.instructionsFor) { this.instructionsFor = instructions.revision; this.instructionsDraft = instructions.body; this.instructionsWhy = ''; }
      });
    });
    // The model picker lists what the connected key can use (a free call to the provider).
    effect(() => {
      const ready = this.ctx.agentReady() && Boolean(this.profile());
      untracked(() => {
        if (!ready || this.models()) return;
        void this.ctx.api<ModelList>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/connections/agent/models`).then(value => this.models.set(value), error => this.modelError.set(error.message));
      });
    });
  }

  private blank(): ProfileDraft { return { name: '', description: '', model: '', effort: 'medium', instructions: '', context: [], itemOutput: 8000, batchTokens: 200000, monthlyTokens: 2000000, attach: '', rationale: '' }; }
  private fill(profile: AgentProfile) {
    this.draft = { name: profile.name, description: profile.description, model: profile.model, effort: profile.effort, instructions: profile.instructions, context: [...profile.context],
      itemOutput: profile.limits.itemOutput, batchTokens: profile.limits.batchTokens, monthlyTokens: profile.limits.monthlyTokens, attach: '', rationale: '' };
  }
  hasModel(id: string) { return (this.models()?.models || []).some(model => model.id === id); }
  modelNote() {
    if (!this.ctx.agentReady()) return 'Connect an account to list its models.';
    if (this.modelError()) return this.modelError();
    return this.models() ? `From your ${this.models()?.label} account.` : 'Loading models…';
  }
  remove(list: string[], id: string) { return list.filter(entry => entry !== id); }
  attach() { if (this.draft.attach) { this.draft.context = [...this.draft.context, this.draft.attach]; this.draft.attach = ''; } }
  randomSeed() { return `${Math.random().toString(36).slice(2, 10)}`; }
  openWork(profile: AgentProfile) { return (this.ctx.data()?.work || []).filter(item => item.assignee?.kind === 'agent' && item.assignee.id === profile.id && item.status !== 'done').length; }
  defaultFor(profile: AgentProfile) { return (this.ctx.data()?.roles || []).flatMap(role => role.actions).filter(action => action.assignee?.kind === 'agent' && action.assignee.id === profile.id).length; }
  // Tokens from runs recorded on work items, for the profile: this batch run (the latest) and this calendar month.
  private usage(profile: AgentProfile, filter: (run: { at?: string; batch?: string }) => boolean) {
    return (this.ctx.data()?.work || []).map(item => item.context?.run).filter(run => run?.profileId === profile.id && run.usage && filter(run))
      .reduce((sum, run) => sum + run!.usage!.input + run!.usage!.output, 0);
  }
  monthUsage(profile: AgentProfile) { const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0); return `${tokens(this.usage(profile, run => (run.at || '') >= start.toISOString()))} tokens`; }
  runUsage(profile: AgentProfile) {
    const batch = (this.ctx.data()?.batches || []).find(entry => entry.profileId === profile.id && entry.state !== 'draft');
    return batch ? `${tokens(this.usage(profile, run => run.batch === batch.id))} tokens in ${batch.ref}` : 'no runs yet';
  }
  assigned(profile: AgentProfile) { this.ctx.boardFilter.set(profile.id); this.ctx.go(this.ctx.link('work')); }
  look(profile: AgentProfile, change: { color?: string; seed?: string }) {
    void this.ctx.write(() => this.ctx.change(profile.id, { avatar: { ...profile.avatar, ...change } }, profile.revision, change.seed ? 'New robot' : 'New colour'));
  }
  setActive(profile: AgentProfile, active: boolean) {
    void this.ctx.write(() => this.ctx.change(profile.id, { active }, profile.revision, active ? 'Activated' : 'Deactivated'), active ? `${profile.name} can take work again.` : `${profile.name} is deactivated. It takes no new work.`);
  }
  save(profile: AgentProfile) {
    const number = (value: number | null) => value === null || (value as unknown) === '' ? null : Number(value);
    const data = { name: this.draft.name, description: this.draft.description, model: this.draft.model, effort: this.draft.effort, instructions: this.draft.instructions, context: this.draft.context,
      limits: { itemOutput: Number(this.draft.itemOutput), batchTokens: number(this.draft.batchTokens), monthlyTokens: number(this.draft.monthlyTokens) } };
    void this.ctx.write(() => this.ctx.change(profile.id, data, profile.revision, this.draft.rationale || 'Profile revised'), 'Profile saved. New runs use this revision.').then(saved => { if (saved) this.editingName.set(false); });
  }
  create() {
    const colors = this.ctx.catalog()?.botColors || [];
    const used = new Set(this.profiles().map(entry => entry.avatar.color));
    const color = colors.find(entry => !used.has(entry)) || colors[0];
    void this.ctx.write(async () => {
      const created = await this.ctx.record('agent_profile', { name: 'New profile', description: '', avatar: { seed: this.randomSeed(), color }, effort: 'medium' }, null, 'Added by you') as AgentProfile;
      this.ctx.go(this.ctx.link('work', 'agents', created.id));
    }, 'Profile added. Name it and choose what it reads.');
  }
  saveInstructions() {
    const record = this.ctx.data()?.projectInstructions; if (!record) return;
    void this.ctx.write(() => this.ctx.change(record.id, { body: this.instructionsDraft }, record.revision, this.instructionsWhy || 'Project instructions revised'), 'Saved. Export the agent guide to put them in the repository (docs/agents.md).');
  }
  exportAgents() { void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/agents/export`, 'POST', {}), 'docs/agents.md written to the workspace. The next build commits it.'); }
}
