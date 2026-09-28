import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectContext, Routine, WorkItem, workStatusLabel } from './context';

interface LayerDocSummary { key: string; groupName: string; title: string; revision: number; updatedAt: string; }
interface LayerDoc extends LayerDocSummary { content: string; }
interface Connection { id: string; sourceKey: string; status: 'proposed' | 'active' | 'inactive'; mapping: string; instructions: string; reaction: string; question: string; answer: string; revision: number; sourceAvailable: boolean; reviewedBy: string | null; reviewedAt: string | null; }
interface RoutineRun { id: number; ranAt: string; trigger: string; workItemId: string | null; workTitle: string | null; workState: string | null; }

@Component({
  selector: 'aludel-pages-layer-app', standalone: true, imports: [FormsModule],
  template: `
    <p class="lay-eyebrow">Pages · {{ slot() === 'knowledge' ? 'Knowledge' : 'Operations' }}</p>
    <h1 tabindex="-1">{{ slot() === 'knowledge' ? 'Pages knowledge' : 'Pages operations' }}</h1>
    @if (slot() === 'knowledge') {
      <p class="lay-lead">Output contracts, design methods and routine instructions owned by Pages. Each saved edit creates a revision.</p>
      <div class="lay-pa-doc-layout">
        <nav class="lay-pa-tree" aria-label="Pages knowledge tree">
          @for (group of groups; track group) {
            <h2>{{ group }}</h2>
            @for (doc of docsByGroup(group); track doc.key) { <a [href]="ctx.link('pages','knowledge',doc.key)" (click)="ctx.go(ctx.link('pages','knowledge',doc.key),$event)" [class.active]="docKey() === doc.key" [attr.aria-current]="docKey() === doc.key ? 'page' : null">{{ doc.title }} <small>r{{ doc.revision }}</small></a> }
            @if (group === 'Connections') { @for (connection of connections(); track connection.id) { <a [href]="ctx.link('pages','operations','connections',connection.id)" (click)="ctx.go(ctx.link('pages','operations','connections',connection.id),$event)">{{ layerName(connection.sourceKey) }} → Pages <small>r{{ connection.revision }}</small></a> } }
          }
        </nav>
        <article class="lay-card lay-pa-doc-body">
          @if (selectedDoc(); as doc) {
            <span class="lay-eyebrow">{{ doc.groupName }} · Pages authority · r{{ doc.revision }}</span><h2>{{ doc.title }}</h2>
            <label class="lay-pa-field">Document <textarea [ngModel]="docDraft()" (ngModelChange)="docDraft.set($event)" rows="15" [readonly]="!canManage()"></textarea></label>
            @if (canManage()) { <button type="button" class="lay-button" (click)="saveDoc()" [disabled]="busy() || docDraft() === doc.content">Save new revision</button> }
            @if (doc.revision > 1) { <button type="button" class="lay-link-button" (click)="showPrevious(doc)">Read previous revision</button> }
            @if (previousDoc(); as old) { <section class="lay-pa-history"><h3>Earlier r{{ old.revision }}</h3><p>{{ old.content }}</p></section> }
          } @else { <p class="lay-muted">Select a document from the tree.</p> }
        </article>
        <aside class="lay-card lay-pa-context"><h2>Agent lookup</h2><ol><li>Work pins a task and its permitted layer scope.</li><li>The gateway lists Pages documents and revisions.</li><li>An agent reads exact permitted revisions.</li><li>Candidate output returns through Work for review.</li></ol><p class="lay-muted">No agent run is authorized by editing a document.</p></aside>
      </div>
    } @else {
      <p class="lay-lead">Track Pages work, maintain routines and review how neighboring outputs may inform Pages.</p>
      <nav class="lay-pa-subnav" aria-label="Pages operations sections">
        @for (item of [['board','Board'],['routines','Routines'],['connections','Connections']]; track item[0]) { <a [href]="ctx.link('pages','operations',item[0])" (click)="ctx.go(ctx.link('pages','operations',item[0]),$event)" [class.active]="operation() === item[0]" [attr.aria-current]="operation() === item[0] ? 'page' : null">{{ item[1] }}</a> }
      </nav>
      @switch (operation()) {
        @case ('routines') {
          @if (selectedRoutine(); as routine) {
            <div class="lay-row lay-wrap"><a [href]="ctx.link('pages','operations','routines')" (click)="ctx.go(ctx.link('pages','operations','routines'),$event)">← Routines</a><span class="lay-chip lay-plain">r{{ routine.revision }}</span></div>
            <h2>{{ routine.title }}</h2><p class="lay-muted">Changes affect future runs. Existing Work and revision history are retained.</p>
            <div class="lay-pa-two"><section class="lay-card"><h3>Definition</h3>
              <label class="lay-pa-field">Name <input [(ngModel)]="routineTitle" [disabled]="!canManage()"></label>
              <div class="lay-pa-two"><label class="lay-pa-field">Executor <select [(ngModel)]="routineExecutor" [disabled]="!canManage()"><option value="utility">Utility</option><option value="agent">Agent</option></select></label>
                <label class="lay-pa-field">Trigger <select [(ngModel)]="routineTrigger" [disabled]="!canManage()"><option value="manual">On demand</option><option value="schedule">Schedule</option><option value="output-change">Output changed</option></select></label></div>
              <label class="lay-pa-field">Cadence <select [(ngModel)]="routineCadence" [disabled]="!canManage()"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="before-release">Before release</option></select></label>
              <label class="lay-pa-field">Instruction document <select [(ngModel)]="routineInstructionDoc" [disabled]="!canManage()"><option value="">None</option>@for (doc of documents(); track doc.key) { <option [value]="doc.key">{{ doc.title }} · r{{ doc.revision }}</option> }</select></label>
              <label class="lay-pa-field">Allowed reads · one per line <textarea [(ngModel)]="routineReads" rows="3" [readonly]="!canManage()"></textarea></label>
              <label class="lay-pa-field">Capabilities · one per line <textarea [(ngModel)]="routineCapabilities" rows="3" [readonly]="!canManage()"></textarea></label>
              <label class="lay-pa-field">Allowed outputs · one per line <textarea [(ngModel)]="routineOutputs" rows="3" [readonly]="!canManage()"></textarea></label>
              @if (canManage()) { <button type="button" class="lay-button" (click)="saveRoutine(routine)" [disabled]="busy() || !routineTitle.trim()">Save definition</button> }
              <p class="lay-muted small">Execution is unavailable in this candidate packet. Editing a definition grants no new Work authority.</p>
            </section><aside class="lay-card"><h3>History</h3>
              <h4>Definition revisions</h4><ul class="lay-list">@for (entry of routine.history; track entry.revision) { <li class="lay-pa-history-row">r{{ entry.revision }} · {{ entry.rationale || 'Updated' }} · {{ entry.createdAt?.slice(0,10) }}</li> } @empty { <li class="lay-muted">No revisions yet.</li> }</ul>
              <h4>Runs and Work</h4><ul class="lay-list">@for (run of routineRuns(); track run.id) { <li class="lay-pa-history-row">{{ run.ranAt.slice(0,10) }} · {{ run.trigger }} · {{ run.workState || 'Recorded' }} @if (run.workItemId) { <a [href]="ctx.link('work','item',run.workItemId)" (click)="ctx.go(ctx.link('work','item',run.workItemId),$event)">Open Work item</a> }</li> } @empty { <li class="lay-muted">No runs for this routine.</li> }</ul>
            </aside></div>
          } @else {
            <div class="lay-row lay-wrap"><div><h2>Pages routines</h2><p class="lay-muted">Definitions are layer-owned; run attempts belong to Work.</p></div>@if (canManage()) { <button type="button" class="lay-button lay-push" (click)="newRoutine()" [disabled]="busy()">+ Routine</button> }</div>
            <div class="lay-pa-table-wrap"><table><thead><tr><th>Routine</th><th>Executor</th><th>Trigger</th><th>Revision</th><th>Last run</th><th>State</th></tr></thead><tbody>
              @for (routine of routines(); track routine.id) { <tr><td><a [href]="ctx.link('pages','operations','routines',routine.id)" (click)="ctx.go(ctx.link('pages','operations','routines',routine.id),$event)">{{ routine.title }}</a></td><td>{{ routine.executor || 'Utility' }}</td><td>{{ routine.trigger || 'schedule' }}</td><td>r{{ routine.revision }}</td><td>{{ routine.lastRunAt?.slice(0,10) || 'Never' }}</td><td>{{ routine.enabled ? 'Defined' : 'Paused' }}</td></tr> }
              @empty { <tr><td colspan="6" class="lay-muted">No Pages routines. Create a definition when there is a bounded check to perform.</td></tr> }
            </tbody></table></div><p class="lay-muted small">Run controls arrive with the LAT-05 execution and reconciliation kernel.</p>
          }
        }
        @case ('connections') {
          @if (selectedConnection(); as connection) {
            <a [href]="ctx.link('pages','operations','connections')" (click)="ctx.go(ctx.link('pages','operations','connections'),$event)">← Connections</a>
            <h2>{{ layerName(connection.sourceKey) }} → Pages <span class="lay-chip lay-plain">{{ connection.status }} · r{{ connection.revision }}</span></h2>
            <p class="lay-muted">Pages owns this interpretation. {{ layerName(connection.sourceKey) }} keeps authority over its outputs.</p>
            @if (!connection.sourceAvailable) { <p class="lay-pa-warning">The source layer is removed. This document is retained, but cannot be activated.</p> }
            <div class="lay-pa-two"><section class="lay-card"><h3>Connection document</h3>
              <label class="lay-pa-field">How Pages uses this output <select [(ngModel)]="connectionMapping" [disabled]="!canManage()"><option value="reference-only">Reference only</option><option value="flow-candidate">Candidate input to flows</option></select></label>
              <label class="lay-pa-field">Mapping instructions <textarea [(ngModel)]="connectionInstructions" rows="5" [readonly]="!canManage()"></textarea></label>
              <label class="lay-pa-field">On source change <textarea [(ngModel)]="connectionReaction" rows="3" [readonly]="!canManage()"></textarea></label>
              <label class="lay-pa-field">Question requiring judgment <textarea [(ngModel)]="connectionQuestion" rows="2" [readonly]="!canManage()"></textarea></label>
              <label class="lay-pa-field">Decision or answer <textarea [(ngModel)]="connectionAnswer" rows="2" [readonly]="!canManage()"></textarea></label>
              @if (canManage()) { <div class="lay-row lay-wrap"><button type="button" class="lay-button" (click)="saveConnection(connection)" [disabled]="busy()">Save document</button>
                @if (connection.status !== 'active') { <button type="button" class="lay-button ghost" (click)="reviewConnection(connection)" [disabled]="busy() || !connection.sourceAvailable">Review and activate</button> }
                @else { <button type="button" class="lay-link-button" (click)="deactivateConnection(connection)" [disabled]="busy()">Deactivate</button> }
              </div> }
            </section><aside class="lay-card"><h3>Review boundary</h3><p>An active document names a reviewed mapping at an exact revision. Future Pages routines may read it; this packet does not run a sync.</p><p class="lay-muted">{{ connection.reviewedAt ? 'Last activated ' + connection.reviewedAt.slice(0,10) : 'Awaiting review.' }}</p></aside></div>
          } @else {
            <h2>Connections</h2><p class="lay-muted">A neighboring app publishes outputs. Pages may draft an interpretation; no relationship is assumed when it is added.</p>
            <div class="lay-pa-two">@for (layer of neighbors(); track layer.key) { <article class="lay-card"><h3>{{ layer.name }} → Pages</h3><p>{{ layer.description }}</p>
                @if (connectionFor(layer.key); as existing) { <p>{{ existing.status }} · r{{ existing.revision }}</p><a [href]="ctx.link('pages','operations','connections',existing.id)" (click)="ctx.go(ctx.link('pages','operations','connections',existing.id),$event)">Open document</a> }
                @else if (canManage()) { <button type="button" class="lay-button ghost" (click)="draftConnection(layer.key)" [disabled]="busy()">Draft connection</button> }
              </article> } @empty { <div class="lay-card"><h3>No neighboring layers</h3><p>Pages can work alone. Add another layer from Home if the project needs one.</p><a [href]="ctx.link()" (click)="ctx.go(ctx.link(),$event)">Open Home catalog</a></div> }</div>
          }
        }
        @default {
          <div class="lay-row lay-wrap"><div><h2>Pages work</h2><p class="lay-muted">Layer tasks and routine runs also appear in global Work.</p></div><a class="lay-push" [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'),$event)">Open global Work</a></div>
          <div class="lay-pa-work-grid"><section class="lay-pa-work-stack">
            @for (item of work(); track item.id) { <article class="lay-card"><div class="lay-row lay-wrap"><span class="lay-chip lay-l-pages">{{ item.context?.routine ? 'Routine run' : 'Output task' }}</span><span class="lay-chip lay-plain">{{ workStatusLabel[item.status] || item.status }}</span></div><h3>{{ item.title }}</h3><p class="lay-muted">{{ item.ref }} · {{ item.type }}</p><a [href]="ctx.link('work','item',item.id)" (click)="ctx.go(ctx.link('work','item',item.id),$event)">Open in Work</a></article> }
            @empty { <div class="lay-card"><h3>No Pages work yet</h3><p>Tasks appear here when a Pages action or routine stages work. Start from Map, Pages or Flows.</p></div> }
          </section><aside class="lay-pa-sidebar"><section class="lay-card"><h3>Routines</h3><p>{{ routines().length }} definitions</p><a [href]="ctx.link('pages','operations','routines')" (click)="ctx.go(ctx.link('pages','operations','routines'),$event)">Manage routines</a></section>
            <section class="lay-card"><h3>Connections</h3><p>{{ activeConnectionCount() }} active · {{ neighbors().length }} neighbors</p><a [href]="ctx.link('pages','operations','connections')" (click)="ctx.go(ctx.link('pages','operations','connections'),$event)">Review connections</a></section></aside></div>
        }
      }
    }`
})
export class PagesLayerAppComponent implements OnInit {
  readonly ctx = inject(ProjectContext);
  readonly slot = input.required<string>();
  readonly groups = ['Outputs','Methods','Routines','Connections','Resources'];
  readonly documents = signal<LayerDocSummary[]>([]);
  readonly selectedDoc = signal<LayerDoc | null>(null);
  readonly previousDoc = signal<LayerDoc | null>(null);
  readonly docDraft = signal('');
  readonly connections = signal<Connection[]>([]);
  readonly routineRuns = signal<RoutineRun[]>([]);
  readonly busy = signal(false);
  readonly canManage = computed(() => this.ctx.session()?.projects.find(project => project.id === this.ctx.projectId())?.role === 'owner');
  readonly operation = computed(() => this.ctx.segments()[2] || 'board');
  readonly docKey = computed(() => this.ctx.segments()[2] || this.documents()[0]?.key || '');
  readonly routines = computed(() => (this.ctx.data()?.routines || []).filter(item => item.layer === 'pages'));
  readonly work = computed(() => (this.ctx.data()?.work || []).filter(item => item.layer === 'pages'));
  readonly neighbors = computed(() => this.ctx.layerInstances().filter(item => item.enabled && item.key !== 'pages'));
  readonly activeConnectionCount = computed(() => this.connections().filter(item => item.status === 'active' && item.sourceAvailable).length);
  readonly selectedRoutine = computed(() => this.routines().find(item => item.id === this.ctx.segments()[3]) || null);
  readonly selectedConnection = computed(() => this.connections().find(item => item.id === this.ctx.segments()[3]) || null);
  readonly workStatusLabel = workStatusLabel;
  routineTitle = ''; routineExecutor = 'utility'; routineTrigger = 'manual'; routineCadence = 'monthly'; routineInstructionDoc = '';
  routineReads = ''; routineCapabilities = ''; routineOutputs = '';
  connectionMapping = 'reference-only'; connectionInstructions = ''; connectionReaction = ''; connectionQuestion = ''; connectionAnswer = '';
  private lastRoutineId = ''; private lastConnectionId = '';
  constructor() {
    effect(() => { const key = this.slot() === 'knowledge' ? this.docKey() : ''; if (key) void this.loadDoc(key); });
    effect(() => { const routine = this.selectedRoutine(); if (routine && routine.id !== this.lastRoutineId) { this.lastRoutineId = routine.id; this.prepareRoutine(routine); void this.loadRuns(routine.id); } else if (!routine) this.lastRoutineId = ''; });
    effect(() => { const connection = this.selectedConnection(); if (connection && connection.id !== this.lastConnectionId) { this.lastConnectionId = connection.id; this.prepareConnection(connection); } else if (!connection) this.lastConnectionId = ''; });
  }
  async ngOnInit() { await Promise.all([this.loadDocs(), this.loadConnections()]); }
  private path(suffix: string) { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/pages/${suffix}`; }
  private async loadDocs() { try { this.documents.set((await this.ctx.api<{ documents: LayerDocSummary[] }>(this.path('documents'))).documents); } catch (error) { this.ctx.error.set(String(error)); } }
  private async loadDoc(key: string) { try { const doc = await this.ctx.api<LayerDoc>(this.path(`documents/${encodeURIComponent(key)}`)); if (this.docKey() === key) { this.selectedDoc.set(doc); this.docDraft.set(doc.content); this.previousDoc.set(null); } } catch (error) { this.ctx.error.set(String(error)); } }
  private async loadConnections() { try { this.connections.set((await this.ctx.api<{ connections: Connection[] }>(this.path('connections'))).connections); } catch (error) { this.ctx.error.set(String(error)); } }
  private async loadRuns(id: string) { try { this.routineRuns.set((await this.ctx.api<{ runs: RoutineRun[] }>(this.path(`routines/${encodeURIComponent(id)}/runs`))).runs); } catch { this.routineRuns.set([]); } }
  docsByGroup(group: string) { return this.documents().filter(doc => doc.groupName === group.toLowerCase()); }
  layerName(key: string) { return this.ctx.layerInstances().find(item => item.key === key)?.name || key; }
  connectionFor(key: string) { return this.connections().find(item => item.sourceKey === key) || null; }
  async saveDoc() { const doc = this.selectedDoc(); if (!doc) return; this.busy.set(true); const ok = await this.ctx.write(() => this.ctx.api(this.path(`documents/${doc.key}`),'PUT',{ content:this.docDraft(),expectedRevision:doc.revision }), 'Document saved as a new revision.'); if (ok) { await this.loadDocs(); await this.loadDoc(doc.key); } this.busy.set(false); }
  async showPrevious(doc: LayerDoc) { try { this.previousDoc.set(await this.ctx.api<LayerDoc>(this.path(`documents/${doc.key}?revision=${doc.revision-1}`))); } catch (error) { this.ctx.error.set(String(error)); } }
  private prepareRoutine(r: Routine) { this.routineTitle=r.title; this.routineExecutor=r.executor||'utility'; this.routineTrigger=r.trigger||'schedule'; this.routineCadence=r.cadence; this.routineInstructionDoc=r.instructionDoc||''; this.routineReads=(r.allowedReads||[]).join('\n'); this.routineCapabilities=(r.capabilities||[]).join('\n'); this.routineOutputs=(r.outputKinds||[]).join('\n'); }
  async newRoutine() { this.busy.set(true); let id=''; const ok=await this.ctx.write(async()=>{ const created=await this.ctx.record('routine',{title:'New Pages routine',layer:'pages',type:'audit',cadence:'monthly',documents:[],enabled:false,executor:'utility',trigger:'manual',instructionDoc:'routine-method',allowedReads:[],capabilities:[],outputKinds:[]}) as Routine; id=created.id; },'Routine definition created.'); this.busy.set(false); if(ok&&id)this.ctx.go(this.ctx.link('pages','operations','routines',id)); }
  async saveRoutine(r: Routine) { this.busy.set(true); await this.ctx.write(()=>this.ctx.change(r.id,{title:this.routineTitle,executor:this.routineExecutor,trigger:this.routineTrigger,cadence:this.routineCadence,instructionDoc:this.routineInstructionDoc||null,allowedReads:this.routineReads.split('\n').map(v=>v.trim()).filter(Boolean),capabilities:this.routineCapabilities.split('\n').map(v=>v.trim()).filter(Boolean),outputKinds:this.routineOutputs.split('\n').map(v=>v.trim()).filter(Boolean)},r.revision,'Updated Pages routine definition'),'Routine saved as a new revision.'); this.busy.set(false); }
  private prepareConnection(c: Connection) { this.connectionMapping=c.mapping; this.connectionInstructions=c.instructions; this.connectionReaction=c.reaction; this.connectionQuestion=c.question; this.connectionAnswer=c.answer; }
  private connectionBody(c: Connection) { return {expectedRevision:c.revision,mapping:this.connectionMapping,instructions:this.connectionInstructions,reaction:this.connectionReaction,question:this.connectionQuestion,answer:this.connectionAnswer}; }
  async draftConnection(key: string) { this.busy.set(true); let id=''; const ok=await this.ctx.write(async()=>{const c=await this.ctx.api<Connection>(this.path('connections'),'POST',{sourceKey:key});id=c.id;},'Connection draft created.'); await this.loadConnections(); this.busy.set(false); if(ok&&id)this.ctx.go(this.ctx.link('pages','operations','connections',id)); }
  async saveConnection(c: Connection) { this.busy.set(true); await this.ctx.write(()=>this.ctx.api(this.path(`connections/${c.id}`),'PUT',this.connectionBody(c)),'Connection document saved.'); await this.loadConnections(); this.busy.set(false); }
  async reviewConnection(c: Connection) { this.busy.set(true); await this.ctx.write(()=>this.ctx.api(this.path(`connections/${c.id}`),'PUT',{...this.connectionBody(c),status:'active'}),'Connection reviewed and active for future runs.'); await this.loadConnections(); this.busy.set(false); }
  async deactivateConnection(c: Connection) { this.busy.set(true); await this.ctx.write(()=>this.ctx.api(this.path(`connections/${c.id}`),'PUT',{expectedRevision:c.revision,status:'inactive'}),'Connection deactivated.'); await this.loadConnections(); this.busy.set(false); }
}
