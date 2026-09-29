import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectContext, Routine, WorkItem, workStatusLabel } from './context';

interface LayerDocSummary { key: string; groupName: string; title: string; revision: number; updatedAt: string; }
interface LayerDoc extends LayerDocSummary { content: string; }
interface Connection { id: string; sourceKey: string; status: 'proposed' | 'active' | 'inactive'; mapping: string; instructions: string; reaction: string; question: string; answer: string; revision: number; sourceAvailable: boolean; reviewedBy: string | null; reviewedAt: string | null; }
interface Gap { key: string; sourceId: string; status: string; workItemId: string | null; sourceRevision: number; policyRevision: number; reason: string | null; updatedAt: string; }
interface Reconciliation { coverage: string; policyRevision: number | null; gaps: Gap[]; lastReceipt: { createdAt: string } | null; }
interface RoutineRun { id: number; ranAt: string; trigger: string; workItemId: string | null; workTitle: string | null; workState: string | null; }
interface CodeObservation { id: string; repository_commit: string; source_path: string; blob_sha: string; marker: string; route: string; observed_at: string; }
interface CodeRelation { id: string; observation_id: string; status: 'proposed' | 'useful' | 'wrong'; rationale: string; revision: number; work_item_id: string | null; reviewed_at: string | null; route: string; source_path: string; repository_commit: string; }

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
              <p class="lay-muted small">The reviewed Vision → Pages coverage utility runs after relevant changes. Agent routines still require a compatible Work adapter and a deliberate Go.</p>
            </section><aside class="lay-card"><h3>History</h3>
              <h4>Definition revisions</h4><ul class="lay-list">@for (entry of routine.history; track entry.revision) { <li class="lay-pa-history-row">r{{ entry.revision }} · {{ entry.rationale || 'Updated' }} · {{ entry.createdAt?.slice(0,10) }}</li> } @empty { <li class="lay-muted">No revisions yet.</li> }</ul>
              <h4>Runs and Work</h4><ul class="lay-list">@for (run of routineRuns(); track run.id) { <li class="lay-pa-history-row">{{ run.ranAt.slice(0,10) }} · {{ run.trigger }} · {{ run.workState || 'Recorded' }} @if (run.workItemId) { <a [href]="ctx.link('work','item',run.workItemId)" (click)="ctx.go(ctx.link('work','item',run.workItemId),$event)">Open Work item</a> }</li> } @empty { <li class="lay-muted">No runs for this routine.</li> }</ul>
            </aside></div>
          } @else {
            <div class="lay-row lay-wrap"><div><h2>Pages routines</h2><p class="lay-muted">Definitions are layer-owned; run attempts belong to Work.</p></div>@if (canManage()) { <button type="button" class="lay-button lay-push" (click)="newRoutine()" [disabled]="busy()">+ Routine</button> }</div>
            <div class="lay-pa-table-wrap"><table><thead><tr><th>Routine</th><th>Executor</th><th>Trigger</th><th>Revision</th><th>Last run</th><th>State</th></tr></thead><tbody>
              @for (routine of routines(); track routine.id) { <tr><td><a [href]="ctx.link('pages','operations','routines',routine.id)" (click)="ctx.go(ctx.link('pages','operations','routines',routine.id),$event)">{{ routine.title }}</a></td><td>{{ routine.executor || 'Utility' }}</td><td>{{ routine.trigger || 'schedule' }}</td><td>r{{ routine.revision }}</td><td>{{ routine.lastRunAt?.slice(0,10) || 'Never' }}</td><td>{{ routine.enabled ? 'Defined' : 'Paused' }}</td></tr> }
              @empty { <tr><td colspan="6" class="lay-muted">No Pages routines. Create a definition when there is a bounded check to perform.</td></tr> }
            </tbody></table></div><p class="lay-muted small">Reviewed Vision → Pages coverage runs automatically after relevant changes. Agent routines remain unavailable.</p>
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
            </section><aside class="lay-card"><h3>Review and coverage</h3><p>An active document names a reviewed mapping at an exact revision. It stages Pages suggestions in Work; it cannot start an agent.</p><p class="lay-muted">{{ connection.reviewedAt ? 'Last activated ' + connection.reviewedAt.slice(0,10) : 'Awaiting review.' }}</p>
              @if (connection.sourceKey === 'product') {
                <p>Flow coverage: {{ reconciliation()?.coverage || 'Loading' }} @if (reconciliation()?.policyRevision) { · policy r{{ reconciliation()?.policyRevision }} }</p>
                @if (canManage() && reconciliation()?.coverage === 'active') { <button type="button" class="lay-button ghost" (click)="runCoverage()" [disabled]="busy()">Check coverage now</button> }
                <ul class="lay-list">@for (gap of reconciliation()?.gaps || []; track gap.key) { <li class="lay-pa-history-row"><strong>{{ gap.status }}</strong> · {{ gap.sourceId }} · source r{{ gap.sourceRevision }} @if (gap.workItemId) { <a [href]="ctx.link('work','item',gap.workItemId)" (click)="ctx.go(ctx.link('work','item',gap.workItemId),$event)">Open Work</a> }
                  @if (canManage() && ['open','pending-review','degraded'].includes(gap.status)) { <label class="lay-pa-field">Reason <input [ngModel]="gapReasons()[gap.key] || ''" (ngModelChange)="setGapReason(gap.key,$event)"></label><button type="button" class="lay-link-button" (click)="decideGap(gap,'exception')" [disabled]="busy() || !gapReasons()[gap.key]?.trim()">Keep as exception</button><button type="button" class="lay-link-button" (click)="decideGap(gap,'rejected')" [disabled]="busy() || !gapReasons()[gap.key]?.trim()">Reject relation</button> }
                  @if (canManage() && ['exception','rejected'].includes(gap.status)) { <button type="button" class="lay-link-button" (click)="decideGap(gap,'reopen')" [disabled]="busy()">Reopen</button> }
                </li> } @empty { <li class="lay-muted">No observed story-to-flow gaps.</li> }</ul>
              }
            </aside></div>
          } @else {
            <h2>Connections</h2><p class="lay-muted">A neighboring app publishes outputs. Pages may draft an interpretation; no relationship is assumed when it is added.</p>
            <div class="lay-pa-two">@for (layer of neighbors(); track layer.key) { <article class="lay-card"><h3>{{ layer.name }} → Pages</h3><p>{{ layer.description }}</p>
                @if (connectionFor(layer.key); as existing) { <p>{{ existing.status }} · r{{ existing.revision }}</p><a [href]="ctx.link('pages','operations','connections',existing.id)" (click)="ctx.go(ctx.link('pages','operations','connections',existing.id),$event)">Open document</a> }
                @else if (canManage()) { <button type="button" class="lay-button ghost" (click)="draftConnection(layer.key)" [disabled]="busy()">Draft connection</button> }
              </article> } @empty { <div class="lay-card"><h3>No neighboring layers</h3><p>Pages can work alone. Add another layer from Home if the project needs one.</p><a [href]="ctx.link()" (click)="ctx.go(ctx.link(),$event)">Open Home catalog</a></div> }</div>
            <section class="lay-card" aria-label="Code observations and Pages relations">
              <h3>Code observations → Pages candidates</h3>
              <p class="lay-muted">Code records what a committed screen contains. Pages separately decides whether that observation is useful for an intended flow. A useful relation can suggest Work; it cannot start an agent or create a flow.</p>
              @if (!codeInstalled()) { <p class="lay-pa-warning">Code is not installed. Earlier observations and relation decisions remain readable.</p> }
              @if (codeInstalled()) { <p><a [href]="ctx.link('platform','overview')" (click)="ctx.go(ctx.link('platform','overview'),$event)">Record a Code observation in Code</a></p> }
              @for (observation of codeObservations(); track observation.id) {
                <article class="lay-card"><h4>{{ observation.route }}</h4><p class="lay-muted small"><code>{{ observation.source_path }}</code> · commit <code>{{ observation.repository_commit.slice(0,8) }}</code> · blob <code>{{ observation.blob_sha.slice(0,8) }}</code></p>
                  <p class="small">Observed marker: <code>{{ observation.marker }}</code></p>
                  @if (canManage() && codeInstalled()) { <button type="button" class="lay-button ghost small" (click)="selectedObservationId.set(observation.id)">Propose Pages relation</button> }
                  @if (selectedObservationId() === observation.id) {
                    <label class="lay-pa-field">Why this Code observation may inform Pages <textarea [(ngModel)]="codeRelationDraft" rows="2"></textarea></label>
                    <button type="button" class="lay-button" (click)="proposeCodeRelation(observation.id)" [disabled]="busy() || !codeRelationDraft.trim()">Save proposed relation</button>
                  }
                  <ul class="lay-list">@for (relation of relationsFor(observation.id); track relation.id) {
                    <li class="lay-pa-history-row"><strong>{{ relation.status }}</strong> · r{{ relation.revision }} · {{ relation.rationale }}
                      @if (relation.work_item_id) { <a [href]="ctx.link('work','item',relation.work_item_id)" (click)="ctx.go(ctx.link('work','item',relation.work_item_id),$event)">Open Work item</a> }
                      @if (canManage() && relation.status === 'proposed') {
                        <label class="lay-pa-field">Review reason <input [ngModel]="codeReviewReasons()[relation.id] || ''" (ngModelChange)="setCodeReviewReason(relation.id,$event)"></label>
                        <div class="lay-row lay-wrap"><button type="button" class="lay-button ghost small" (click)="reviewCodeRelation(relation,'useful')" [disabled]="busy() || !codeInstalled() || !codeReviewReasons()[relation.id]?.trim()">Useful candidate</button>
                          <button type="button" class="lay-button ghost small" (click)="reviewCodeRelation(relation,'wrong')" [disabled]="busy() || !codeReviewReasons()[relation.id]?.trim()">Wrong relation</button></div>
                      }
                      @if (canManage() && codeInstalled() && relation.status === 'useful' && !relation.work_item_id) { <button type="button" class="lay-button ghost small" (click)="stageCodeRelation(relation)" [disabled]="busy()">Suggest Pages task in Work</button> }
                    </li>
                  } @empty { <li class="lay-muted">No Pages relation proposed for this observation.</li> }</ul>
                </article>
              } @empty { <p class="lay-muted">No Code observations recorded for this project.</p> }
            </section>
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
  readonly codeObservations = signal<CodeObservation[]>([]);
  readonly codeRelations = signal<CodeRelation[]>([]);
  readonly codeReviewReasons = signal<Record<string,string>>({});
  readonly selectedObservationId = signal('');
  readonly codeInstalled = computed(() => this.ctx.layerInstances().some(layer => layer.key === 'platform' && layer.enabled));
  readonly routineRuns = signal<RoutineRun[]>([]);
  readonly reconciliation = signal<Reconciliation | null>(null);
  readonly gapReasons = signal<Record<string,string>>({});
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
  codeRelationDraft = '';
  private lastRoutineId = ''; private lastConnectionId = '';
  constructor() {
    effect(() => { const key = this.slot() === 'knowledge' ? this.docKey() : ''; if (key) void this.loadDoc(key); });
    effect(() => { const routine = this.selectedRoutine(); if (routine && routine.id !== this.lastRoutineId) { this.lastRoutineId = routine.id; this.prepareRoutine(routine); void this.loadRuns(routine.id); } else if (!routine) this.lastRoutineId = ''; });
    effect(() => { const connection = this.selectedConnection(); if (connection && connection.id !== this.lastConnectionId) { this.lastConnectionId = connection.id; this.prepareConnection(connection); } else if (!connection) this.lastConnectionId = ''; });
  }
  async ngOnInit() { await Promise.all([this.loadDocs(), this.loadConnections(), this.loadReconciliation(), this.loadCodeObservations(), this.loadCodeRelations()]); }
  private path(suffix: string) { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/pages/${suffix}`; }
  private codePath() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/code/route-observations`; }
  private async loadDocs() { try { this.documents.set((await this.ctx.api<{ documents: LayerDocSummary[] }>(this.path('documents'))).documents); } catch (error) { this.ctx.error.set(String(error)); } }
  private async loadDoc(key: string) { try { const doc = await this.ctx.api<LayerDoc>(this.path(`documents/${encodeURIComponent(key)}`)); if (this.docKey() === key) { this.selectedDoc.set(doc); this.docDraft.set(doc.content); this.previousDoc.set(null); } } catch (error) { this.ctx.error.set(String(error)); } }
  private async loadConnections() { try { this.connections.set((await this.ctx.api<{ connections: Connection[] }>(this.path('connections'))).connections); } catch (error) { this.ctx.error.set(String(error)); } }
  private async loadReconciliation() { try { this.reconciliation.set(await this.ctx.api<Reconciliation>(this.path('reconciliation'))); } catch (error) { this.ctx.error.set(String(error)); } }
  private async loadCodeObservations() { try { this.codeObservations.set((await this.ctx.api<{ observations: CodeObservation[] }>(this.codePath())).observations); } catch (error) { this.ctx.error.set(String(error)); } }
  private async loadCodeRelations() { try { this.codeRelations.set((await this.ctx.api<{ relations: CodeRelation[] }>(this.path('code-relations'))).relations); } catch (error) { this.ctx.error.set(String(error)); } }
  private async loadRuns(id: string) { try { this.routineRuns.set((await this.ctx.api<{ runs: RoutineRun[] }>(this.path(`routines/${encodeURIComponent(id)}/runs`))).runs); } catch { this.routineRuns.set([]); } }
  docsByGroup(group: string) { return this.documents().filter(doc => doc.groupName === group.toLowerCase()); }
  layerName(key: string) { return this.ctx.layerInstances().find(item => item.key === key)?.name || key; }
  connectionFor(key: string) { return this.connections().find(item => item.sourceKey === key) || null; }
  relationsFor(observationId: string) { return this.codeRelations().filter(relation => relation.observation_id === observationId); }
  setCodeReviewReason(id: string, reason: string) { this.codeReviewReasons.update(current => ({ ...current, [id]: reason })); }
  async proposeCodeRelation(observationId: string) { this.busy.set(true); const ok = await this.ctx.write(() => this.ctx.api(this.path('code-relations'), 'POST',
    { observationId, rationale: this.codeRelationDraft.trim() }), 'Pages relation saved for review.');
    if (ok) { this.selectedObservationId.set(''); this.codeRelationDraft = ''; await this.loadCodeRelations(); } this.busy.set(false); }
  async reviewCodeRelation(relation: CodeRelation, verdict: 'useful' | 'wrong') { this.busy.set(true); const ok = await this.ctx.write(() => this.ctx.api(this.path(`code-relations/${relation.id}/review`), 'POST',
    { expectedRevision: relation.revision, verdict, reason: this.codeReviewReasons()[relation.id] || '' }), 'Pages relation review recorded.');
    if (ok) await this.loadCodeRelations(); this.busy.set(false); }
  async stageCodeRelation(relation: CodeRelation) { this.busy.set(true); const ok = await this.ctx.write(() => this.ctx.api(this.path(`code-relations/${relation.id}/stage`), 'POST', {}),
    'Pages suggestion added to Work.'); if (ok) await this.loadCodeRelations(); this.busy.set(false); }
  async saveDoc() { const doc = this.selectedDoc(); if (!doc) return; this.busy.set(true); const ok = await this.ctx.write(() => this.ctx.api(this.path(`documents/${doc.key}`),'PUT',{ content:this.docDraft(),expectedRevision:doc.revision }), 'Document saved as a new revision.'); if (ok) { await this.loadDocs(); await this.loadDoc(doc.key); } this.busy.set(false); }
  async showPrevious(doc: LayerDoc) { try { this.previousDoc.set(await this.ctx.api<LayerDoc>(this.path(`documents/${doc.key}?revision=${doc.revision-1}`))); } catch (error) { this.ctx.error.set(String(error)); } }
  private prepareRoutine(r: Routine) { this.routineTitle=r.title; this.routineExecutor=r.executor||'utility'; this.routineTrigger=r.trigger||'schedule'; this.routineCadence=r.cadence; this.routineInstructionDoc=r.instructionDoc||''; this.routineReads=(r.allowedReads||[]).join('\n'); this.routineCapabilities=(r.capabilities||[]).join('\n'); this.routineOutputs=(r.outputKinds||[]).join('\n'); }
  async newRoutine() { this.busy.set(true); let id=''; const ok=await this.ctx.write(async()=>{ const created=await this.ctx.record('routine',{title:'New Pages routine',layer:'pages',type:'audit',cadence:'monthly',documents:[],enabled:false,executor:'utility',trigger:'manual',instructionDoc:'routine-method',allowedReads:[],capabilities:[],outputKinds:[]}) as Routine; id=created.id; },'Routine definition created.'); this.busy.set(false); if(ok&&id)this.ctx.go(this.ctx.link('pages','operations','routines',id)); }
  async saveRoutine(r: Routine) { this.busy.set(true); await this.ctx.write(()=>this.ctx.change(r.id,{title:this.routineTitle,executor:this.routineExecutor,trigger:this.routineTrigger,cadence:this.routineCadence,instructionDoc:this.routineInstructionDoc||null,allowedReads:this.routineReads.split('\n').map(v=>v.trim()).filter(Boolean),capabilities:this.routineCapabilities.split('\n').map(v=>v.trim()).filter(Boolean),outputKinds:this.routineOutputs.split('\n').map(v=>v.trim()).filter(Boolean)},r.revision,'Updated Pages routine definition'),'Routine saved as a new revision.'); this.busy.set(false); }
  setGapReason(key: string, reason: string) { this.gapReasons.update(current => ({ ...current, [key]: reason })); }
  async runCoverage() { this.busy.set(true); await this.ctx.write(() => this.ctx.api(this.path('reconciliation/run'),'POST',{}), 'Pages coverage checked.'); await this.loadReconciliation(); this.busy.set(false); }
  async decideGap(gap: Gap, decision: 'exception' | 'rejected' | 'reopen') { this.busy.set(true); await this.ctx.write(() => this.ctx.api(this.path(`reconciliation/${encodeURIComponent(gap.key)}`),'POST',{ decision, reason: this.gapReasons()[gap.key] || '', expectedUpdatedAt: gap.updatedAt }), 'Gap decision recorded.'); await this.loadReconciliation(); this.busy.set(false); }
  private prepareConnection(c: Connection) { this.connectionMapping=c.mapping; this.connectionInstructions=c.instructions; this.connectionReaction=c.reaction; this.connectionQuestion=c.question; this.connectionAnswer=c.answer; }
  private connectionBody(c: Connection) { return {expectedRevision:c.revision,mapping:this.connectionMapping,instructions:this.connectionInstructions,reaction:this.connectionReaction,question:this.connectionQuestion,answer:this.connectionAnswer}; }
  async draftConnection(key: string) { this.busy.set(true); let id=''; const ok=await this.ctx.write(async()=>{const c=await this.ctx.api<Connection>(this.path('connections'),'POST',{sourceKey:key});id=c.id;},'Connection draft created.'); await this.loadConnections(); this.busy.set(false); if(ok&&id)this.ctx.go(this.ctx.link('pages','operations','connections',id)); }
  async saveConnection(c: Connection) { this.busy.set(true); await this.ctx.write(()=>this.ctx.api(this.path(`connections/${c.id}`),'PUT',this.connectionBody(c)),'Connection document saved.'); await Promise.all([this.loadConnections(), this.loadReconciliation()]); this.busy.set(false); }
  async reviewConnection(c: Connection) { this.busy.set(true); await this.ctx.write(()=>this.ctx.api(this.path(`connections/${c.id}`),'PUT',{...this.connectionBody(c),status:'active'}),'Connection reviewed and active for future runs.'); await Promise.all([this.loadConnections(), this.loadReconciliation()]); this.busy.set(false); }
  async deactivateConnection(c: Connection) { this.busy.set(true); await this.ctx.write(()=>this.ctx.api(this.path(`connections/${c.id}`),'PUT',{expectedRevision:c.revision,status:'inactive'}),'Connection deactivated.'); await Promise.all([this.loadConnections(), this.loadReconciliation()]); this.busy.set(false); }
}
