import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';
import { setupProgress } from './layer-nav';

interface Doc { key: string; groupName: string; title: string; content?: string; revision: number }
interface Connection { id: string; sourceKey: string; revision: number }
const docGroups = ['Outputs', 'Methods', 'Routines', 'Connections', 'Resources'];

// CUSTOM-LAYER-01 Knowledge: the layer's own documents, starting with its charter (its identity). The same documents
// describe built-in and custom layers, and every save is a revision agents can cite.
@Component({
  selector: 'aludel-layer-knowledge', standalone: true, imports: [FormsModule, MatIconModule],
  template: `
  <div class="lay-mg">
    <nav class="lay-mg-side" [attr.aria-label]="name() + ' knowledge'">
      @if (charter(); as doc) {
        <a [href]="ctx.link(layerKey(),'knowledge',doc.key)" (click)="go(doc.key,$event)" [class.active]="docKey() === doc.key" [attr.aria-current]="docKey() === doc.key ? 'page' : null"><mat-icon aria-hidden="true">flag</mat-icon>Charter</a>
      }
      @for (group of groupsWithDocs(); track group) {
        <h3>{{ group }}</h3>
        @for (doc of docsByGroup(group); track doc.key) { <a class="lay-mg-doc" [href]="ctx.link(layerKey(),'knowledge',doc.key)" (click)="go(doc.key,$event)" [class.active]="docKey() === doc.key" [attr.aria-current]="docKey() === doc.key ? 'page' : null">{{ doc.title }}</a> }
        @if (group === 'Connections') { @for (connection of connections(); track connection.id) { <a class="lay-mg-doc" [href]="ctx.link(layerKey(),'manage','connections',connection.id)" (click)="ctx.go(ctx.link(layerKey(),'manage','connections',connection.id),$event)">{{ layerName(connection.sourceKey) }} → {{ name() }}</a> } }
      }
    </nav>
    <div class="lay-mg-body">
      @if (selectedDoc(); as doc) {
        <p class="lay-eyebrow">{{ doc.key === 'identity' ? 'Identity' : doc.groupName }} · r{{ doc.revision }}</p><h2 class="lay-tk-title">{{ doc.title }}</h2>
        @if (doc.key === 'identity') {
          <p class="lay-muted small">What {{ name() }} is for. Other layers and agents read it to understand {{ name() }}. Each suggested heading is a prompt; replace it with your own words and add sections as you need them. @if (active()) { Saving stages fresh neighbor discovery. }</p>
          @if (progress(); as p) {
            <ul class="lay-kn-sections" aria-label="Charter sections needed to activate">@for (section of p.sections; track section.key) {
              <li [class.done]="section.done"><mat-icon aria-hidden="true">{{ section.done ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>{{ section.label }}<span class="visually-hidden">{{ section.done ? ' written' : ' still needed' }}</span></li>
            }</ul>
          }
        } @else { <p class="lay-muted small">Agents working in {{ name() }} read the exact revision their task allows. Editing a document does not start an agent.</p> }
        <label class="visually-hidden" for="kn-doc">{{ doc.title }}</label>
        <textarea id="kn-doc" class="lay-kn-text" [ngModel]="docDraft()" (ngModelChange)="docDraft.set($event)" rows="22" [readonly]="!canManage()" spellcheck="true"></textarea>
        <div class="lay-row lay-wrap">
          @if (canManage()) { <button type="button" class="lay-button" (click)="saveDoc()" [disabled]="busy() || docDraft() === doc.content">Save new revision</button> }
          @if (doc.revision > 1) { <button type="button" class="lay-link-button" (click)="showPrevious(doc)">Read previous revision</button> }
        </div>
        @if (previousDoc(); as old) { <section class="lay-pa-history"><h3>Earlier r{{ old.revision }}</h3><pre class="lay-kn-old">{{ old.content }}</pre></section> }
      } @else { <p class="lay-muted">Loading…</p> }
    </div>
  </div>`
})
export class LayerKnowledgeComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly layer = computed(() => this.ctx.layerInstances().find(item => item.key === this.layerKey()) || null);
  readonly name = computed(() => this.layer()?.name || this.layerKey());
  readonly active = computed(() => this.layer()?.lifecycle === 'active');
  readonly progress = computed(() => setupProgress(this.layer()));
  readonly canManage = computed(() => this.ctx.session()?.projects.find(project => project.id === this.ctx.projectId())?.role === 'owner');
  readonly documents = signal<Doc[]>([]); readonly selectedDoc = signal<Doc | null>(null); readonly previousDoc = signal<Doc | null>(null); readonly docDraft = signal('');
  readonly connections = signal<Connection[]>([]);
  readonly busy = signal(false);
  readonly charter = computed(() => this.documents().find(doc => doc.key === 'identity') || null);
  readonly docKey = computed(() => this.ctx.segments()[2] || 'identity');
  readonly groupsWithDocs = computed(() => docGroups.filter(group => this.docsByGroup(group).length || (group === 'Connections' && this.connections().length)));

  constructor() {
    effect(() => { const id = this.ctx.projectId(), key = this.layerKey(); if (id && key) void Promise.all([this.loadDocs(), this.loadConnections()]); });
    effect(() => { const key = this.docKey(); if (key && this.ctx.projectId()) void this.loadDoc(key); });
  }
  private path(suffix: string) { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/${encodeURIComponent(this.layerKey())}/${suffix}`; }
  private report(error: unknown) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  go(key: string, event: Event) {
    if (this.selectedDoc() && this.docDraft() !== this.selectedDoc()!.content && !confirm('Discard unsaved changes to this document?')) { event.preventDefault(); return; }
    this.ctx.go(this.ctx.link(this.layerKey(), 'knowledge', key), event);
  }
  layerName(key: string) { return this.ctx.layerInstances().find(layer => layer.key === key)?.name || key; }
  docsByGroup(group: string) { return this.documents().filter(doc => doc.groupName === group.toLowerCase()); }
  private async loadDocs() { try { this.documents.set((await this.ctx.api<{ documents: Doc[] }>(this.path('documents'))).documents); } catch (error) { this.report(error); } }
  private async loadConnections() { try { this.connections.set((await this.ctx.api<{ connections: Connection[] }>(this.path('connections'))).connections); } catch { this.connections.set([]); } }
  private async loadDoc(key: string) {
    try { const doc = await this.ctx.api<Doc>(this.path(`documents/${encodeURIComponent(key)}`)); if (this.docKey() === key) { this.selectedDoc.set(doc); this.docDraft.set(doc.content || ''); this.previousDoc.set(null); } }
    catch (error) { this.report(error); }
  }
  async saveDoc() {
    const doc = this.selectedDoc(); if (!doc) return;
    this.busy.set(true);
    const ok = await this.ctx.write(() => this.ctx.api(this.path(`documents/${encodeURIComponent(doc.key)}`), 'PUT', { content: this.docDraft(), expectedRevision: doc.revision }),
      doc.key === 'identity' ? 'Charter saved as a new revision.' : 'Document saved as a new revision.');
    if (ok) { await this.loadDocs(); await this.loadDoc(doc.key); }
    this.busy.set(false);
  }
  async showPrevious(doc: Doc) { try { this.previousDoc.set(await this.ctx.api<Doc>(this.path(`documents/${encodeURIComponent(doc.key)}?revision=${doc.revision - 1}`))); } catch (error) { this.report(error); } }
}
