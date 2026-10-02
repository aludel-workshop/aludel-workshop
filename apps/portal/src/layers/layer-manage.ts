import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LayerFacetsComponent } from './layer-facets';
import { ProjectContext } from './context';
import { layerColourStyle, setupProgress } from './layer-nav';
import { contrastRatio } from '../color';
import iconSubset from '../icon-subset.json';

interface Connection { id: string; sourceKey: string; status: 'proposed' | 'active' | 'inactive'; mapping: string; instructions: string; reaction: string; question: string; answer: string; revision: number; sourceAvailable: boolean; reviewedAt: string | null }
interface Discovery { sourceKeys: string[]; workId: string; createdAt: string }
// Every icon the portal's font subset renders (the server validates against the same file). Colours are suggestions;
// any colour white text stays readable on is accepted. The palette must match layerColors in server/layer-registry.mjs.
const suggestedIcons = ['description', 'article', 'menu_book', 'auto_stories', 'science', 'school', 'lightbulb', 'insights', 'query_stats', 'bar_chart', 'campaign', 'forum', 'palette', 'draw', 'web', 'map', 'route', 'schema', 'database', 'api', 'code', 'terminal', 'rocket_launch', 'public', 'shield', 'group', 'star', 'flag', 'bookmark', 'target'];
// Layer-like icons first, then the rest of the subset.
export const pickerIcons: string[] = [...suggestedIcons.filter(icon => iconSubset.icons.includes(icon)), ...iconSubset.icons.filter((icon: string) => !suggestedIcons.includes(icon))];
export const pickerColours = ['#6b35c9', '#a8235a', '#1f4fb8', '#0b5d86', '#0f7465', '#2e7d32', '#8a5a00', '#b3401e', '#9c2f8f', '#475467'];

// CUSTOM-LAYER-01 Manage: how the layer exists in the project. A draft layer starts on Activate, a checklist over its
// Knowledge (the charter) and actions; identity itself is written in the Knowledge tab, not in a form here.
@Component({
  selector: 'aludel-layer-manage', standalone: true, imports: [FormsModule, MatIconModule, LayerFacetsComponent],
  template: `
  <div class="lay-mg">
    <nav class="lay-mg-side" [attr.aria-label]="name() + ' management'">
      @if (progress(); as p) {
        <a [href]="ctx.link(layerKey(),'manage','activate')" (click)="ctx.go(ctx.link(layerKey(),'manage','activate'),$event)" [class.active]="section() === 'activate'" [attr.aria-current]="section() === 'activate' ? 'page' : null">
          <span class="lay-mg-gauge" [style.--p]="(p.done / p.total * 100) + '%'" aria-hidden="true"></span>Activate<small>{{ p.done }}/{{ p.total }}</small><span class="visually-hidden">, {{ p.done }} of {{ p.total }} setup steps done</span></a>
      }
      <a [href]="ctx.link(layerKey(),'manage','settings')" (click)="ctx.go(ctx.link(layerKey(),'manage','settings'),$event)" [class.active]="section() === 'settings'" [attr.aria-current]="section() === 'settings' ? 'page' : null"><mat-icon aria-hidden="true">tune</mat-icon>Settings</a>
      <a [href]="ctx.link(layerKey(),'manage','connections')" (click)="ctx.go(ctx.link(layerKey(),'manage','connections'),$event)" [class.active]="section() === 'connections'" [attr.aria-current]="section() === 'connections' && !selectedConnection() ? 'page' : null"><mat-icon aria-hidden="true">link</mat-icon>Connections<small>{{ activeConnectionCount() }}/{{ neighbors().length }}</small></a>
      <a [href]="ctx.link(layerKey(),'manage','facets')" (click)="ctx.go(ctx.link(layerKey(),'manage','facets'),$event)" [class.active]="section() === 'facets'" [attr.aria-current]="section() === 'facets' ? 'page' : null"><mat-icon aria-hidden="true">category</mat-icon>Facets</a>
    </nav>
    <div class="lay-mg-body">
      @switch (section()) {
        @case ('activate') {
          @if (progress(); as p) {
            <h2 class="lay-tk-title">Activate {{ name() }}</h2>
            <p class="lay-muted">{{ name() }} is a draft, so other layers can't discover it or propose connections yet. Finish these steps, then activate it.</p>
            <div class="lay-mg-progress"><span class="lay-mg-gauge lay-mg-gauge-lg" [style.--p]="(p.done / p.total * 100) + '%'" aria-hidden="true"></span><span><strong>{{ p.done }} of {{ p.total }}</strong> steps done</span></div>
            <section class="lay-card lay-mg-card" aria-labelledby="mg-charter"><div class="lay-row lay-wrap"><h3 id="mg-charter">Write the charter</h3>
              <a class="lay-push" [href]="ctx.link(layerKey(),'knowledge','identity')" (click)="ctx.go(ctx.link(layerKey(),'knowledge','identity'),$event)">Open the charter in Knowledge</a></div>
              <p class="lay-muted small">The charter is {{ name() }}'s identity. Each section needs a sentence or two in your own words.</p>
              <ul class="lay-mg-checks">@for (item of p.sections; track item.key) {
                <li [class.done]="item.done"><mat-icon aria-hidden="true">{{ item.done ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>{{ item.label }}<span class="visually-hidden">{{ item.done ? ', done' : ', to do' }}</span></li>
              }</ul>
            </section>
            <section class="lay-card lay-mg-card" aria-labelledby="mg-actions"><div class="lay-row lay-wrap"><h3 id="mg-actions">Define an action</h3>
              <a class="lay-push" [href]="ctx.link(layerKey(),'tasks','actions')" (click)="ctx.go(ctx.link(layerKey(),'tasks','actions'),$event)">Open Tasks › Actions</a></div>
              <ul class="lay-mg-checks"><li [class.done]="p.action"><mat-icon aria-hidden="true">{{ p.action ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>At least one action this layer performs<span class="visually-hidden">{{ p.action ? ', done' : ', to do' }}</span></li></ul>
            </section>
            @if (canManage()) { <button type="button" class="lay-button" [disabled]="busy() || p.remaining > 0" (click)="activate()">Activate {{ name() }}</button>
              @if (p.remaining) { <p class="lay-muted small">{{ p.remaining }} {{ p.remaining === 1 ? 'step' : 'steps' }} left.</p> } }
          } @else { <h2 class="lay-tk-title">{{ name() }} is active</h2><p class="lay-muted">Other layers can discover it. Its charter lives in Knowledge.</p> }
        }
        @case ('facets') { <aludel-layer-facets [layerKey]="layerKey()" /> }
        @case ('connections') {
          @if (selectedConnection(); as connection) {
            <a class="lay-back" [href]="ctx.link(layerKey(),'manage','connections')" (click)="ctx.go(ctx.link(layerKey(),'manage','connections'),$event)"><mat-icon aria-hidden="true">arrow_back</mat-icon>Connections</a>
            <div class="lay-row lay-wrap"><h2 class="lay-tk-title">{{ layerName(connection.sourceKey) }} → {{ name() }}</h2><span class="lay-chip lay-plain">{{ connection.status }} · r{{ connection.revision }}</span></div>
            <p class="lay-muted">{{ name() }} owns this interpretation. {{ layerName(connection.sourceKey) }} owns its outputs.</p>
            @if (!connection.sourceAvailable) { <p class="lay-pa-warning">The source layer is no longer installed. The document remains readable.</p> }
            <div class="lay-pa-two"><section class="lay-card"><h3>Connection document</h3>
              <label class="lay-pa-field">How this layer uses the source <select [(ngModel)]="connectionMapping" [disabled]="!canManage()"><option value="reference-only">Reference only</option><option value="candidate-input">Candidate input</option>@if (layerKey() === 'pages') { <option value="flow-candidate">Flow candidate (existing policy)</option> }</select></label>
              <label class="lay-pa-field">Mapping instructions <textarea [(ngModel)]="connectionInstructions" rows="5" [readonly]="!canManage()"></textarea></label>
              <label class="lay-pa-field">On source change <textarea [(ngModel)]="connectionReaction" rows="3" [readonly]="!canManage()"></textarea></label>
              <label class="lay-pa-field">Question requiring judgment <textarea [(ngModel)]="connectionQuestion" rows="2" [readonly]="!canManage()"></textarea></label>
              <label class="lay-pa-field">Decision or answer <textarea [(ngModel)]="connectionAnswer" rows="2" [readonly]="!canManage()"></textarea></label>
              @if (canManage()) { <div class="lay-row lay-wrap"><button type="button" class="lay-button" (click)="saveConnection(connection)" [disabled]="busy()">Save document</button>
                @if (connection.status !== 'active') { <button type="button" class="lay-button ghost" (click)="reviewConnection(connection)" [disabled]="busy() || !connection.sourceAvailable || !connectionInstructions.trim()">Review and activate</button> }
                @else { <button type="button" class="lay-link-button" (click)="deactivateConnection(connection)" [disabled]="busy()">Deactivate</button> }
              </div> }
            </section><aside class="lay-card"><h3>Their view</h3>@if (reciprocal(); as peer) { <p>{{ layerName(connection.sourceKey) }} describes {{ name() }} as <strong>{{ peer.mapping }}</strong> ({{ peer.status }} · r{{ peer.revision }}).</p><p>{{ peer.instructions || 'No mapping instructions yet.' }}</p><a [href]="ctx.link(connection.sourceKey,'manage','connections',peer.id)" (click)="ctx.go(ctx.link(connection.sourceKey,'manage','connections',peer.id),$event)">Read their connection</a> } @else { <p class="lay-muted">The other layer has not written its receiving view yet.</p> }<h3>Review</h3><p>Activation records the owner's reviewed interpretation. Discovery Work may propose this document, but cannot activate it.</p><p class="lay-muted">{{ connection.reviewedAt ? 'Last activated ' + connection.reviewedAt.slice(0,10) : 'Awaiting review.' }}</p></aside></div>
          } @else {
            <h2 class="lay-tk-title">Connections</h2><p class="lay-muted">How {{ name() }} reads each installed neighbor. {{ name() }} owns these documents; discovery tasks propose them and you activate them.</p>
            <ul class="lay-mg-list">@for (layer of neighbors(); track layer.key) {
              <li><span class="lay-mg-list-main"><strong>{{ layer.name }} → {{ name() }}</strong><small>{{ connectionFor(layer.key) ? connectionFor(layer.key)!.status + ' · r' + connectionFor(layer.key)!.revision : 'No connection document yet' }}</small></span>
                @if (connectionFor(layer.key); as connection) { <a [href]="ctx.link(layerKey(),'manage','connections',connection.id)" (click)="ctx.go(ctx.link(layerKey(),'manage','connections',connection.id),$event)">Open</a> }
                @else if (discoveryWorkFor(layer.key); as workId) { <a [href]="ctx.link('work','item',workId)" (click)="ctx.go(ctx.link('work','item',workId),$event)">Open discovery task</a> }
                @else if (canManage()) { <button type="button" class="lay-link-button" (click)="draftConnection(layer.key)" [disabled]="busy()">Draft</button> }
              </li>
            } @empty { <li class="lay-muted">No neighboring layers. Add a layer from Home to begin discovery.</li> }</ul>
          }
        }
        @default {
          <h2 class="lay-tk-title">Settings</h2>
          <section class="lay-card lay-mg-card" aria-labelledby="mg-look"><h3 id="mg-look">Name, icon and colour</h3>
            <div class="lay-mg-preview" [style]="previewStyle()"><span class="lay-tile"><mat-icon aria-hidden="true">{{ icon() }}</mat-icon></span><strong>{{ nameDraft || name() }}</strong></div>
            <label class="lay-pa-field">Name <input [(ngModel)]="nameDraft" [readonly]="!canManage()" maxlength="60"></label>
            <fieldset class="lay-mg-icons"><legend>Icon</legend>
              <input class="lay-mg-icon-filter" type="search" placeholder="Search icons" aria-label="Search icons" [value]="iconFilter()" (input)="iconFilter.set($any($event.target).value)">
              <div class="lay-mg-icon-grid">@for (option of shownIcons(); track option) { <label [title]="option"><input type="radio" name="mg-icon" [value]="option" [checked]="icon() === option" (change)="iconDraft.set(option)" [disabled]="!canManage()"><mat-icon aria-hidden="true">{{ option }}</mat-icon><span class="visually-hidden">{{ option }}</span></label> } @empty { <p class="lay-muted small">No icon matches.</p> }</div>
            </fieldset>
            <fieldset class="lay-mg-colours"><legend>Colour</legend>
              <label><input type="radio" name="mg-colour" value="" [checked]="!colour()" (change)="colourDraft.set(null)" [disabled]="!canManage()"><span class="lay-mg-swatch lay-mg-default">Default</span></label>
              @for (option of colours; track option) { <label><input type="radio" name="mg-colour" [value]="option" [checked]="colour() === option" (change)="colourDraft.set(option)" [disabled]="!canManage()"><span class="lay-mg-swatch" [style.background]="option"></span><span class="visually-hidden">{{ option }}{{ takenBy(option) ? ', used by ' + takenBy(option) : '' }}</span></label> }
              <label class="lay-mg-custom" title="Custom colour"><input type="color" [value]="colour() || '#475467'" (input)="colourDraft.set($any($event.target).value)" [disabled]="!canManage()" aria-label="Custom colour"><span>Custom</span></label>
              @if (colour() && !readable()) { <p class="lay-mg-warning" role="alert">White text isn't readable on {{ colour() }} ({{ contrast() }}:1). Choose a darker colour.</p> }
            </fieldset>
            @if (canManage()) { <button type="button" class="lay-button" (click)="savePresentation()" [disabled]="busy() || !presentationDirty() || (!!colour() && !readable())">Save</button> }
          </section>

          @if (canManage()) {
            <section class="lay-card lay-mg-card lay-mg-danger" aria-labelledby="mg-remove"><h3 id="mg-remove">Remove from project</h3>
              <p class="lay-muted small">Takes {{ name() }} out of the sidebar. Its outputs, knowledge and history are kept, and you can add it back from Home.</p>
              <button type="button" class="lay-button danger" (click)="remove()" [disabled]="busy()">Remove {{ name() }}</button>
            </section>
          }
        }
      }
    </div>
  </div>`
})
export class LayerManageComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly iconFilter = signal('');
  readonly shownIcons = computed(() => { const term = this.iconFilter().trim().toLowerCase().replace(/\s+/g, '_'); return term ? pickerIcons.filter(icon => icon.includes(term)) : pickerIcons; });
  readonly colours = pickerColours;
  readonly layer = computed(() => this.ctx.layerInstances().find(item => item.key === this.layerKey()) || null);
  readonly name = computed(() => this.layer()?.name || this.layerKey());
  readonly isCustom = computed(() => this.layer()?.editorAdapter === 'markdown-editor');
  readonly progress = computed(() => setupProgress(this.layer()));
  readonly section = computed(() => this.ctx.segments()[2] || (this.progress() ? 'activate' : 'settings'));
  readonly canManage = computed(() => this.ctx.session()?.projects.find(project => project.id === this.ctx.projectId())?.role === 'owner');
  readonly busy = signal(false);

  // Connections
  readonly connections = signal<Connection[]>([]); readonly reciprocal = signal<Connection | null>(null); readonly discovery = signal<Discovery[]>([]);
  readonly neighbors = computed(() => this.ctx.layerInstances().filter(item => item.enabled && item.lifecycle === 'active' && item.key !== this.layerKey()));
  readonly activeConnectionCount = computed(() => this.connections().filter(item => item.status === 'active' && item.sourceAvailable).length);
  readonly selectedConnection = computed(() => this.section() === 'connections' ? this.connections().find(item => item.id === this.ctx.segments()[3]) || null : null);
  connectionMapping = 'reference-only'; connectionInstructions = ''; connectionReaction = ''; connectionQuestion = ''; connectionAnswer = '';
  private lastConnectionId = '';
  // Settings
  nameDraft = '';
  readonly iconDraft = signal<string | null>(null);
  readonly colourDraft = signal<string | null | undefined>(undefined);
  readonly icon = computed(() => this.iconDraft() || this.layer()?.icon || 'description');
  readonly colour = computed((): string | null => { const draft = this.colourDraft(); return draft === undefined ? this.layer()?.color || null : draft; });
  readonly previewStyle = computed(() => { const layer = this.layer(); if (!layer) return {}; const style = layerColourStyle({ ...layer, color: this.colour() }); return Object.keys(style).length ? style : {}; });
  private loadedName = '';

  constructor() {
    effect(() => { const id = this.ctx.projectId(), key = this.layerKey(); if (id && key) void Promise.all([this.loadConnections(), this.loadDiscovery()]); });
    effect(() => { const connection = this.selectedConnection(); if (connection) void this.loadReciprocal(connection.sourceKey); else this.reciprocal.set(null); });
    effect(() => { const connection = this.selectedConnection(); if (connection && connection.id !== this.lastConnectionId) { this.lastConnectionId = connection.id; this.prepareConnection(connection); } else if (!connection) this.lastConnectionId = ''; });
    effect(() => { const layer = this.layer(); if (!layer) return;
      const named = `${layer.key}:${layer.name}:${layer.icon}:${layer.color}`; if (named !== this.loadedName) { this.loadedName = named; this.nameDraft = layer.name; this.iconDraft.set(null); this.colourDraft.set(undefined); } });
  }

  private path(suffix: string) { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/${encodeURIComponent(this.layerKey())}/${suffix}`; }
  private definitionPath(suffix = '') { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layer-definitions/${encodeURIComponent(this.layerKey())}${suffix}`; }
  private report(error: unknown) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  layerName(key: string) { return this.ctx.layerInstances().find(layer => layer.key === key)?.name || key; }
  takenBy(colour: string) { return this.ctx.layerInstances().filter(layer => layer.enabled && layer.key !== this.layerKey() && layer.color === colour).map(layer => layer.name).join(', '); }

  // Connections
  private async loadConnections() { try { this.connections.set((await this.ctx.api<{ connections: Connection[] }>(this.path('connections'))).connections); } catch (error) { this.report(error); } }
  private async loadDiscovery() { try { this.discovery.set((await this.ctx.api<{ runs: Discovery[] }>(this.path('discovery'))).runs); } catch (error) { this.report(error); } }
  private async loadReciprocal(sourceKey: string) { try { const result = await this.ctx.api<{ connections: Connection[] }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/${encodeURIComponent(sourceKey)}/connections`); this.reciprocal.set(result.connections.find(item => item.sourceKey === this.layerKey()) || null); } catch { this.reciprocal.set(null); } }
  connectionFor(key: string) { return this.connections().find(item => item.sourceKey === key) || null; }
  discoveryWorkFor(key: string) { return this.discovery().find(run => run.sourceKeys.includes(key))?.workId || null; }
  private prepareConnection(c: Connection) { this.connectionMapping = c.mapping; this.connectionInstructions = c.instructions; this.connectionReaction = c.reaction; this.connectionQuestion = c.question; this.connectionAnswer = c.answer; }
  private connectionBody(c: Connection) { return { expectedRevision: c.revision, mapping: this.connectionMapping, instructions: this.connectionInstructions, reaction: this.connectionReaction, question: this.connectionQuestion, answer: this.connectionAnswer }; }
  async draftConnection(key: string) { this.busy.set(true); let id = ''; const ok = await this.ctx.write(async () => { const c = await this.ctx.api<Connection>(this.path('connections'), 'POST', { sourceKey: key }); id = c.id; }, 'Connection draft created.'); await this.loadConnections(); this.busy.set(false); if (ok && id) this.ctx.go(this.ctx.link(this.layerKey(), 'manage', 'connections', id)); }
  async saveConnection(c: Connection) { this.busy.set(true); await this.ctx.write(() => this.ctx.api(this.path(`connections/${c.id}`), 'PUT', this.connectionBody(c)), 'Connection document saved.'); await this.loadConnections(); this.busy.set(false); }
  async reviewConnection(c: Connection) { this.busy.set(true); await this.ctx.write(() => this.ctx.api(this.path(`connections/${c.id}`), 'PUT', { ...this.connectionBody(c), status: 'active' }), 'Connection reviewed and active.'); await this.loadConnections(); this.busy.set(false); }
  async deactivateConnection(c: Connection) { this.busy.set(true); await this.ctx.write(() => this.ctx.api(this.path(`connections/${c.id}`), 'PUT', { expectedRevision: c.revision, status: 'inactive' }), 'Connection deactivated.'); await this.loadConnections(); this.busy.set(false); }

  // Settings
  readonly contrast = computed(() => { const colour = this.colour(); return colour ? Math.round(contrastRatio(colour, '#ffffff') * 10) / 10 : 21; });
  readonly readable = computed(() => this.contrast() >= 4.5);
  presentationDirty() { const layer = this.layer(); return !!layer && (this.nameDraft.trim() !== layer.name || this.icon() !== layer.icon || this.colour() !== (layer.color || null)); }
  async savePresentation() {
    this.busy.set(true);
    await this.ctx.write(() => this.ctx.api(this.definitionPath('/presentation'), 'PUT', { name: this.nameDraft.trim(), icon: this.icon(), color: this.colour() }), 'Layer settings saved.');
    this.busy.set(false);
  }
  async activate() {
    this.busy.set(true);
    const ok = await this.ctx.write(() => this.ctx.api(this.definitionPath('/activate'), 'POST', {}), 'Layer activated. Discovery tasks are ready for review.');
    this.busy.set(false);
    if (ok) this.ctx.go(this.ctx.link(this.layerKey(), 'tasks'));
  }
  async remove() {
    if (!confirm(`Remove ${this.name()} from this project? Its outputs and history are kept.`)) return;
    this.busy.set(true);
    const ok = await this.ctx.write(() => this.ctx.setLayerPreference(this.layerKey(), { enabled: false }), `${this.name()} removed. Add it back from Home.`);
    this.busy.set(false);
    if (ok) this.ctx.go(this.ctx.link());
  }
}
