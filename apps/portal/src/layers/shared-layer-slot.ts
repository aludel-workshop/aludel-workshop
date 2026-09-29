import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectContext, Routine, workStatusLabel, layerLabel } from './context';
import { LayerActionSettingsComponent } from './layer-action-settings';

interface Doc { key: string; groupName: string; title: string; content?: string; revision: number; }
interface Connection { id: string; sourceKey: string; status: 'proposed' | 'active' | 'inactive'; mapping: string; instructions: string; reaction: string; question: string; answer: string; revision: number; sourceAvailable: boolean; reviewedAt: string | null; }
interface Discovery { sourceKeys: string[]; workId: string; createdAt: string; }

@Component({ selector: 'aludel-shared-layer-slot', standalone: true, imports: [FormsModule, LayerActionSettingsComponent], template: `
  <p class="lay-eyebrow">{{ name() }} · {{ slot() === 'knowledge' ? 'Knowledge' : 'Operations' }}</p>
  <h1 tabindex="-1">{{ name() }} {{ slot() === 'knowledge' ? 'knowledge' : 'operations' }}</h1>
  @if (slot() === 'knowledge') {
    <p class="lay-lead">Layer-owned output contracts, methods, routine instructions, connections and resources. Every saved edit creates a revision.</p>
    <div class="lay-pa-doc-layout">
      <nav class="lay-pa-tree" [attr.aria-label]="name() + ' knowledge tree'">
        @for (group of groups; track group) {
          <h2>{{ group }}</h2>
          @for (doc of docsByGroup(group); track doc.key) { <a [href]="ctx.link(layerKey(),'knowledge',doc.key)" (click)="ctx.go(ctx.link(layerKey(),'knowledge',doc.key),$event)" [class.active]="docKey() === doc.key" [attr.aria-current]="docKey() === doc.key ? 'page' : null">{{ doc.title }} <small>r{{ doc.revision }}</small></a> }
          @if (group === 'Connections') { @for (connection of connections(); track connection.id) { <a [href]="ctx.link(layerKey(),'operations','connections',connection.id)" (click)="ctx.go(ctx.link(layerKey(),'operations','connections',connection.id),$event)">{{ layerName(connection.sourceKey) }} → {{ name() }} <small>r{{ connection.revision }}</small></a> } }
        }
      </nav>
      <article class="lay-card lay-pa-doc-body">
        @if (selectedDoc(); as doc) { <span class="lay-eyebrow">{{ doc.groupName }} · {{ name() }} authority · r{{ doc.revision }}</span><h2>{{ doc.title }}</h2>
          <label class="lay-pa-field">Document <textarea [ngModel]="docDraft()" (ngModelChange)="docDraft.set($event)" rows="15" [readonly]="!canManage()"></textarea></label>
          @if (canManage()) { <button type="button" class="lay-button" (click)="saveDoc()" [disabled]="busy() || docDraft() === doc.content">Save new revision</button> }
          @if (doc.revision > 1) { <button type="button" class="lay-link-button" (click)="showPrevious(doc)">Read previous revision</button> }
          @if (previousDoc(); as old) { <section class="lay-pa-history"><h3>Earlier r{{ old.revision }}</h3><p>{{ old.content }}</p></section> }
        } @else { <p class="lay-muted">Select a document from the tree.</p> }
      </article>
      <aside class="lay-card lay-pa-context"><h2>Agent lookup</h2><ol><li>Work pins a task and its permitted layer scope.</li><li>The gateway lists documents and revisions.</li><li>An agent reads exact permitted revisions.</li><li>Candidate output returns through Work for review.</li></ol><p class="lay-muted">Editing a document does not start an agent.</p></aside>
    </div>
  } @else {
    <p class="lay-lead">Track {{ name() }} work, maintain routines and actions, and review connections with installed layers.</p>
    <nav class="lay-pa-subnav" [attr.aria-label]="name() + ' operations sections'">
      @for (item of [['board','Board'],['routines','Routines'],['actions','Actions'],['connections','Connections']]; track item[0]) { <a [href]="ctx.link(layerKey(),'operations',item[0])" (click)="ctx.go(ctx.link(layerKey(),'operations',item[0]),$event)" [class.active]="operation() === item[0]" [attr.aria-current]="operation() === item[0] ? 'page' : null">{{ item[1] }}</a> }
    </nav>
    @switch (operation()) {
      @case ('actions') { <aludel-layer-action-settings [layerKey]="layerKey()" /> }
      @case ('routines') {
        <div class="lay-row lay-wrap"><div><h2>{{ name() }} routines</h2><p class="lay-muted">Routines stage Work; each Work item still needs a deliberate Go.</p></div>@if (canManage()) { <button type="button" class="lay-button lay-push" (click)="newRoutine()" [disabled]="busy()">+ Routine</button> }</div>
        @if (selectedRoutine(); as routine) { <div class="lay-pa-two"><section class="lay-card"><h3>{{ routine.title }} · r{{ routine.revision }}</h3>
          <label class="lay-pa-field">Name <input [(ngModel)]="routineTitle" [disabled]="!canManage()"></label>
          <label class="lay-pa-field">Executor <select [(ngModel)]="routineExecutor" [disabled]="!canManage()"><option value="utility">Utility</option><option value="agent">Agent</option></select></label>
          <label class="lay-pa-field">Trigger <select [(ngModel)]="routineTrigger" [disabled]="!canManage()"><option value="manual">On demand</option><option value="schedule">Schedule</option><option value="output-change">Output changed</option></select></label>
          <label class="lay-pa-field">Cadence <select [(ngModel)]="routineCadence" [disabled]="!canManage()"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="before-release">Before release</option></select></label>
          <label class="lay-pa-field">Instruction document <select [(ngModel)]="routineInstructionDoc" [disabled]="!canManage()"><option value="">None</option>@for (doc of documents(); track doc.key) { <option [value]="doc.key">{{ doc.title }} · r{{ doc.revision }}</option> }</select></label>
          <label class="lay-pa-field">Allowed reads · one per line <textarea [(ngModel)]="routineReads" rows="3" [readonly]="!canManage()"></textarea></label>
          <label class="lay-pa-field">Capabilities · one per line <textarea [(ngModel)]="routineCapabilities" rows="3" [readonly]="!canManage()"></textarea></label>
          <label class="lay-pa-field">Allowed outputs · one per line <textarea [(ngModel)]="routineOutputs" rows="3" [readonly]="!canManage()"></textarea></label>
          @if (canManage()) { <button type="button" class="lay-button" (click)="saveRoutine(routine)" [disabled]="busy() || !routineTitle.trim()">Save definition</button> }
        </section><aside class="lay-card"><h3>History</h3><ul class="lay-list">@for (entry of routine.history; track entry.revision) { <li>r{{ entry.revision }} · {{ entry.rationale || 'Updated' }}</li> } @empty { <li>No revisions yet.</li> }</ul>
          @if (routine.lastWorkId) { <a [href]="ctx.link('work','item',routine.lastWorkId)" (click)="ctx.go(ctx.link('work','item',routine.lastWorkId),$event)">Open last Work item</a> }
        </aside></div> }

        <div class="lay-pa-table-wrap"><table><thead><tr><th>Routine</th><th>Trigger</th><th>Revision</th><th>Last Work</th><th>State</th></tr></thead><tbody>
          <tr><td><strong>Discover neighboring layers</strong></td><td>Installed layers change</td><td>Built in</td><td>@if (discovery()[0]; as run) { <a [href]="ctx.link('work','item',run.workId)" (click)="ctx.go(ctx.link('work','item',run.workId),$event)">Open staged Work</a> } @else { None yet }</td><td>Enabled</td></tr>
          @for (routine of routines(); track routine.id) { <tr><td><a [href]="ctx.link(layerKey(),'operations','routines',routine.id)" (click)="ctx.go(ctx.link(layerKey(),'operations','routines',routine.id),$event)">{{ routine.title }}</a></td><td>{{ routine.trigger || 'schedule' }}</td><td>r{{ routine.revision }}</td><td>@if (routine.lastWorkId) { <a [href]="ctx.link('work','item',routine.lastWorkId)" (click)="ctx.go(ctx.link('work','item',routine.lastWorkId),$event)">Open Work</a> } @else { Never }</td><td>{{ routine.enabled ? 'Enabled' : 'Paused' }}</td></tr> }
        </tbody></table></div>
      }
      @case ('connections') {
        @if (selectedConnection(); as connection) {
          <a [href]="ctx.link(layerKey(),'operations','connections')" (click)="ctx.go(ctx.link(layerKey(),'operations','connections'),$event)">← Connections</a>
          <h2>{{ layerName(connection.sourceKey) }} → {{ name() }} <span class="lay-chip lay-plain">{{ connection.status }} · r{{ connection.revision }}</span></h2>
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
          </section><aside class="lay-card"><h3>Review</h3><p>Activation records the owner's reviewed interpretation. Discovery Work may propose this document, but cannot activate it.</p><p class="lay-muted">{{ connection.reviewedAt ? 'Last activated ' + connection.reviewedAt.slice(0,10) : 'Awaiting review.' }}</p></aside></div>
        } @else {
          <h2>Connections</h2><p class="lay-muted">Each installed neighbor can inform this layer through a separate, receiving-owned policy. Discovery Work explores the relationship before review.</p>
          <div class="lay-pa-two">@for (layer of neighbors(); track layer.key) { <article class="lay-card"><h3>{{ layer.name }} → {{ name() }}</h3><p>{{ layer.description }}</p>
            @if (connectionFor(layer.key); as connection) { <p>{{ connection.status }} · r{{ connection.revision }}</p><a [href]="ctx.link(layerKey(),'operations','connections',connection.id)" (click)="ctx.go(ctx.link(layerKey(),'operations','connections',connection.id),$event)">Open document</a> }
            @else { <p class="lay-muted">Awaiting a reviewed connection document.</p>@if (discoveryWorkFor(layer.key); as workId) { <a [href]="ctx.link('work','item',workId)" (click)="ctx.go(ctx.link('work','item',workId),$event)">Open discovery Work</a> } @else if (canManage()) { <button type="button" class="lay-button ghost" (click)="draftConnection(layer.key)" [disabled]="busy()">Draft connection</button> } }
          </article> } @empty { <div class="lay-card"><h3>No neighboring layers</h3><p>Add a layer from Home to begin discovery.</p></div> }</div>
        }
      }
      @default {
        <div class="lay-row lay-wrap"><div><h2>{{ name() }} work</h2><p class="lay-muted">Tasks from routines and manual actions appear here.</p></div><a class="lay-push" [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'),$event)">Open global Work</a></div>
        <div class="lay-pa-work-grid"><section class="lay-pa-work-stack">
          @for (item of work(); track item.id) { <article class="lay-card"><div class="lay-row lay-wrap"><span class="lay-chip lay-plain">{{ item.context?.routine ? 'Routine work' : 'Layer work' }}</span><span class="lay-chip lay-plain">{{ workStatusLabel[item.status] || item.status }}</span></div><h3>{{ item.title }}</h3><p class="lay-muted">{{ item.ref }} · {{ item.type }}</p><a [href]="ctx.link('work','item',item.id)" (click)="ctx.go(ctx.link('work','item',item.id),$event)">Open in Work</a></article> }
          @empty { <div class="lay-card"><h3>No {{ name() }} work yet</h3><p>Tasks appear when a routine or action stages Work for this layer.</p></div> }
        </section><aside class="lay-pa-sidebar"><section class="lay-card"><h3>Routines</h3><p>Neighbor discovery and {{ routines().length }} project definitions</p><a [href]="ctx.link(layerKey(),'operations','routines')" (click)="ctx.go(ctx.link(layerKey(),'operations','routines'),$event)">Manage routines</a></section>
          <section class="lay-card"><h3>Connections</h3><p>{{ activeConnectionCount() }} active · {{ neighbors().length }} neighbors</p><a [href]="ctx.link(layerKey(),'operations','connections')" (click)="ctx.go(ctx.link(layerKey(),'operations','connections'),$event)">Review connections</a></section></aside></div>
      }
    }
  }` })
export class SharedLayerSlotComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly slot = input.required<string>();
  readonly groups = ['Outputs','Methods','Routines','Connections','Resources'];
  readonly name = computed(() => layerLabel[this.layerKey()] || this.ctx.layerInstances().find(layer => layer.key === this.layerKey())?.name || this.layerKey());
  readonly operation = computed(() => this.ctx.segments()[2] || 'board');
  readonly docKey = computed(() => this.ctx.segments()[2] || this.documents()[0]?.key || '');
  readonly documents = signal<Doc[]>([]); readonly selectedDoc = signal<Doc | null>(null); readonly previousDoc = signal<Doc | null>(null); readonly docDraft = signal('');
  readonly connections = signal<Connection[]>([]); readonly discovery = signal<Discovery[]>([]); readonly busy = signal(false);
  readonly routines = computed(() => (this.ctx.data()?.routines || []).filter(item => item.layer === this.layerKey()));
  readonly work = computed(() => (this.ctx.data()?.work || []).filter(item => item.layer === this.layerKey()));
  readonly neighbors = computed(() => this.ctx.layerInstances().filter(item => item.enabled && item.key !== this.layerKey()));
  readonly activeConnectionCount = computed(() => this.connections().filter(item => item.status === 'active' && item.sourceAvailable).length);
  readonly selectedRoutine = computed(() => this.routines().find(item => item.id === this.ctx.segments()[3]) || null);
  readonly selectedConnection = computed(() => this.connections().find(item => item.id === this.ctx.segments()[3]) || null);
  readonly canManage = computed(() => this.ctx.session()?.projects.find(project => project.id === this.ctx.projectId())?.role === 'owner');
  readonly workStatusLabel = workStatusLabel;
  connectionMapping = 'reference-only'; connectionInstructions = ''; connectionReaction = ''; connectionQuestion = ''; connectionAnswer = '';
  routineTitle=''; routineExecutor='utility'; routineTrigger='manual'; routineCadence='monthly'; routineInstructionDoc=''; routineReads=''; routineCapabilities=''; routineOutputs='';
  private lastConnectionId = ''; private lastRoutineId='';
  readonly refresh = effect(() => { const id = this.ctx.projectId(), key = this.layerKey(); if (id && key) void Promise.all([this.loadDocs(),this.loadConnections(),this.loadDiscovery()]); });
  readonly docRefresh = effect(() => { const key = this.slot() === 'knowledge' ? this.docKey() : ''; if (key) void this.loadDoc(key); });
  readonly routineRefresh = effect(() => {const routine=this.selectedRoutine();if(routine && routine.id!==this.lastRoutineId){this.lastRoutineId=routine.id;this.prepareRoutine(routine);}else if(!routine)this.lastRoutineId='';});
  readonly connectionRefresh = effect(() => { const connection = this.selectedConnection(); if (connection && connection.id !== this.lastConnectionId) { this.lastConnectionId=connection.id; this.prepareConnection(connection); } else if (!connection) this.lastConnectionId=''; });
  private path(suffix: string) { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/${encodeURIComponent(this.layerKey())}/${suffix}`; }
  private async loadDocs() { try { this.documents.set((await this.ctx.api<{documents:Doc[]}>(this.path('documents'))).documents); } catch(error) { this.ctx.error.set(String(error)); } }
  private async loadDoc(key:string) { try { const doc=await this.ctx.api<Doc>(this.path(`documents/${encodeURIComponent(key)}`)); if(this.docKey()===key){this.selectedDoc.set(doc);this.docDraft.set(doc.content||'');this.previousDoc.set(null);} } catch(error){this.ctx.error.set(String(error));} }
  private async loadConnections() { try { this.connections.set((await this.ctx.api<{connections:Connection[]}>(this.path('connections'))).connections); } catch(error){this.ctx.error.set(String(error));} }
  private async loadDiscovery() { try { this.discovery.set((await this.ctx.api<{runs:Discovery[]}>(this.path('discovery'))).runs); } catch(error){this.ctx.error.set(String(error));} }
  docsByGroup(group:string) { return this.documents().filter(doc => doc.groupName === group.toLowerCase()); }
  layerName(key:string) { return this.ctx.layerInstances().find(layer => layer.key === key)?.name || key; }
  connectionFor(key:string) { return this.connections().find(item => item.sourceKey === key) || null; }
  discoveryWorkFor(key:string) { return this.discovery().find(run => run.sourceKeys.includes(key))?.workId || null; }
  async saveDoc() { const doc=this.selectedDoc(); if(!doc)return;this.busy.set(true);const ok=await this.ctx.write(()=>this.ctx.api(this.path(`documents/${doc.key}`),'PUT',{content:this.docDraft(),expectedRevision:doc.revision}),'Document saved as a new revision.');if(ok){await this.loadDocs();await this.loadDoc(doc.key);}this.busy.set(false); }
  async showPrevious(doc:Doc) { try {this.previousDoc.set(await this.ctx.api<Doc>(this.path(`documents/${doc.key}?revision=${doc.revision-1}`)));}catch(error){this.ctx.error.set(String(error));} }
  async newRoutine() { this.busy.set(true);await this.ctx.write(()=>this.ctx.record('routine',{title:`New ${this.name()} routine`,layer:this.layerKey(),type:'audit',cadence:'monthly',documents:[],enabled:false,executor:'utility',trigger:'manual',instructionDoc:'routine-method',allowedReads:[],capabilities:[],outputKinds:[]}), 'Routine definition created.');this.busy.set(false); }
  private prepareRoutine(r:Routine) {this.routineTitle=r.title;this.routineExecutor=r.executor||'utility';this.routineTrigger=r.trigger||'manual';this.routineCadence=r.cadence;this.routineInstructionDoc=r.instructionDoc||'';this.routineReads=(r.allowedReads||[]).join('\n');this.routineCapabilities=(r.capabilities||[]).join('\n');this.routineOutputs=(r.outputKinds||[]).join('\n');}
  async saveRoutine(r:Routine) {this.busy.set(true);await this.ctx.write(()=>this.ctx.change(r.id,{title:this.routineTitle,executor:this.routineExecutor,trigger:this.routineTrigger,cadence:this.routineCadence,instructionDoc:this.routineInstructionDoc||null,allowedReads:this.routineReads.split('\n').map(v=>v.trim()).filter(Boolean),capabilities:this.routineCapabilities.split('\n').map(v=>v.trim()).filter(Boolean),outputKinds:this.routineOutputs.split('\n').map(v=>v.trim()).filter(Boolean)},r.revision,`Updated ${this.name()} routine definition`),'Routine saved as a new revision.');this.busy.set(false);}
  private prepareConnection(c:Connection) {this.connectionMapping=c.mapping;this.connectionInstructions=c.instructions;this.connectionReaction=c.reaction;this.connectionQuestion=c.question;this.connectionAnswer=c.answer;}
  private connectionBody(c:Connection) {return {expectedRevision:c.revision,mapping:this.connectionMapping,instructions:this.connectionInstructions,reaction:this.connectionReaction,question:this.connectionQuestion,answer:this.connectionAnswer};}
  async draftConnection(key:string) {this.busy.set(true);let id='';const ok=await this.ctx.write(async()=>{const c=await this.ctx.api<Connection>(this.path('connections'),'POST',{sourceKey:key});id=c.id;},'Connection draft created.');await this.loadConnections();this.busy.set(false);if(ok&&id)this.ctx.go(this.ctx.link(this.layerKey(),'operations','connections',id));}
  async saveConnection(c:Connection) {this.busy.set(true);await this.ctx.write(()=>this.ctx.api(this.path(`connections/${c.id}`),'PUT',this.connectionBody(c)),'Connection document saved.');await this.loadConnections();this.busy.set(false);}
  async reviewConnection(c:Connection) {this.busy.set(true);await this.ctx.write(()=>this.ctx.api(this.path(`connections/${c.id}`),'PUT',{...this.connectionBody(c),status:'active'}),'Connection reviewed and active.');await this.loadConnections();this.busy.set(false);}
  async deactivateConnection(c:Connection) {this.busy.set(true);await this.ctx.write(()=>this.ctx.api(this.path(`connections/${c.id}`),'PUT',{expectedRevision:c.revision,status:'inactive'}),'Connection deactivated.');await this.loadConnections();this.busy.set(false);}
}
