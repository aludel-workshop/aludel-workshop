import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';

interface MarkdownFile { id: string; path: string; revision: number; sha: string; updatedAt: string }
interface MarkdownDocument extends MarkdownFile { content: string }
interface MarkdownTree { folders: string[]; files: MarkdownFile[] }

@Component({
  selector: 'aludel-markdown-layer', standalone: true, imports: [FormsModule, MatIconModule],
  template: `
  <header class="lay-md-heading"><div><p class="lay-eyebrow">{{ layerName() }} · output</p><h1 tabindex="-1">{{ layerName() }} editor</h1>
    <p class="lay-muted">Markdown files are this layer's output. Every saved version has an exact revision.</p></div>
    <button type="button" class="lay-button" (click)="createTask()">Create edit task</button></header>
  <div class="lay-md-workspace">
    <aside class="lay-md-tree" aria-label="Markdown file tree">
      <div class="lay-md-tree-title"><strong>Files</strong><button type="button" class="lay-icon-button" (click)="refresh()" aria-label="Refresh files"><mat-icon>refresh</mat-icon></button></div>
      <form class="lay-md-add" (submit)="createFolder($event)">
        <label for="md-folder">New folder</label><div><input id="md-folder" name="folder" [(ngModel)]="newFolder" placeholder="notes/research"><button type="submit" aria-label="Create folder">+</button></div>
      </form>
      <form class="lay-md-add" (submit)="createFile($event)">
        <label for="md-file">New Markdown file</label><div><input id="md-file" name="file" [(ngModel)]="newFile" placeholder="notes/idea.md"><button type="submit" aria-label="Create file">+</button></div>
      </form>
      <ul class="lay-md-list">
        @for (entry of treeEntries(); track entry.path) {
          @if (entry.file; as file) {
            <li><button type="button" class="lay-md-file" [style.padding-left.rem]=".4 + entry.depth * .85" [class.selected]="selected()?.id === file.id" [title]="file.path" (click)="open(file)">
              <mat-icon aria-hidden="true">description</mat-icon><span>{{ entry.label }}</span><small>r{{ file.revision }}</small></button></li>
          } @else {
            <li class="lay-md-folder" [style.padding-left.rem]=".4 + entry.depth * .85" [title]="entry.path"><mat-icon aria-hidden="true">folder</mat-icon><span>{{ entry.label }}</span><button type="button" (click)="renameFolder(entry.path)" [attr.aria-label]="'Rename ' + entry.path">Rename</button><button type="button" (click)="deleteFolder(entry.path)" [attr.aria-label]="'Delete ' + entry.path">Delete</button></li>
          }
        }
      </ul>
      @if (!tree().files.length) { <p class="lay-muted small">Create a .md file to begin.</p> }
    </aside>
    <section class="lay-md-editor" aria-label="Markdown editor">
      @if (selected(); as file) {
        <div class="lay-md-toolbar"><div><strong>{{ file.path }}</strong><small>Revision {{ file.revision }} · {{ dirty() ? 'Unsaved changes' : 'Saved' }}</small></div>
          <button type="button" class="lay-button" [disabled]="busy() || !dirty()" (click)="save()">Save</button>
          <button type="button" class="lay-link-button" (click)="renameFile()">Move / rename</button>
          <button type="button" class="lay-link-button" (click)="deleteFile()">Delete</button></div>
        <label class="visually-hidden" for="md-content">Markdown document</label>
        <textarea id="md-content" class="lay-md-textarea" spellcheck="true" [ngModel]="draft()" (ngModelChange)="draft.set($event)" aria-label="Markdown document"></textarea>
        <div class="lay-md-status"><span>{{ draft().length }} characters</span>
          @if (activeWorkId()) { <span>Edits can be linked to {{ ctx.workingOn()?.ref }}.</span> }
        </div>
      } @else { <div class="lay-md-empty"><mat-icon>description</mat-icon><h2>Select a Markdown file</h2><p>Create folders and files from the tree. Open a file here to edit it.</p></div> }
    </section>
  </div>`
})
export class MarkdownLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly layerName = computed(() => this.ctx.layerInstances().find(item => item.key === this.layerKey())?.name || this.layerKey());
  readonly tree = signal<MarkdownTree>({ folders: [], files: [] });
  readonly treeEntries = computed(() => [
    ...this.tree().folders.map(path => ({path,label:path.split('/').at(-1) || path,depth:path.split('/').length-1,file:null as MarkdownFile | null})),
    ...this.tree().files.map(file => ({path:file.path,label:file.path.split('/').at(-1) || file.path,depth:file.path.split('/').length-1,file}))
  ].sort((a,b)=>a.path.localeCompare(b.path)));
  readonly selected = signal<MarkdownDocument | null>(null);
  readonly draft = signal('');
  readonly dirty = computed(() => this.selected()?.content !== this.draft());
  readonly busy = signal(false);
  newFile = '';
  newFolder = '';
  private readonly base = computed(() => `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/${encodeURIComponent(this.layerKey())}/markdown`);
  constructor() { effect(() => { if (this.ctx.projectId() && this.layerKey()) void this.refresh(); }); }
  private async call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    return this.ctx.api<T>(`${this.base()}${path}`, method, body);
  }
  activeWorkId() { const item = this.ctx.workingOn(); return item && this.ctx.data()?.work.find(work => work.id === item.id)?.layer === this.layerKey() ? item.id : null; }
  async refresh() {
    try { this.tree.set(await this.call<MarkdownTree>('/tree')); }
    catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  }
  private proceed() { return !this.dirty() || confirm('Discard unsaved changes?'); }
  async open(file: MarkdownFile) {
    if (!this.proceed()) return;
    try { const document = await this.call<MarkdownDocument>(`/files/${encodeURIComponent(file.id)}`); this.selected.set(document); this.draft.set(document.content); this.ctx.error.set(''); }
    catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  }
  async createFile(event: Event) {
    event.preventDefault(); const path = this.newFile.trim(); if (!path) return;
    try { const file = await this.call<MarkdownDocument>('/files','POST',{ path, content: '', workId: this.activeWorkId() }); this.newFile=''; await this.refresh(); await this.open(file); this.ctx.notice.set(`${path} created.`); }
    catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  }
  async createFolder(event: Event) {
    event.preventDefault(); const path = this.newFolder.trim(); if (!path) return;
    try { await this.call('/folders','POST',{ path }); this.newFolder=''; await this.refresh(); this.ctx.notice.set(`${path} created.`); }
    catch (error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  }
  async save() {
    const file=this.selected(); if(!file || !this.dirty()) return; this.busy.set(true);
    try { const saved=await this.call<MarkdownDocument>(`/files/${encodeURIComponent(file.id)}`,'PUT',{ content:this.draft(), expectedRevision:file.revision, workId:this.activeWorkId() }); this.selected.set(saved); await this.refresh(); this.ctx.notice.set(`${saved.path} saved at revision ${saved.revision}.`); }
    catch(error) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
    finally { this.busy.set(false); }
  }
  async renameFile() {
    const file=this.selected(); if(!file || !this.proceed())return;
    const path=prompt('New relative Markdown path',file.path)?.trim(); if(!path || path===file.path)return;
    try { const moved=await this.call<MarkdownDocument>(`/files/${encodeURIComponent(file.id)}/move`,'POST',{path,expectedRevision:file.revision,workId:this.activeWorkId()});this.selected.set(moved);this.draft.set(moved.content);await this.refresh();this.ctx.notice.set('File moved.'); }
    catch(error){this.ctx.error.set(error instanceof Error?error.message:String(error));}
  }
  async renameFolder(from:string) {
    const to=prompt('New relative folder path',from)?.trim();if(!to||to===from||!this.proceed())return;
    try {await this.call('/folders','PUT',{from,to});this.selected.set(null);this.draft.set('');await this.refresh();this.ctx.notice.set('Folder moved.');}
    catch(error){this.ctx.error.set(error instanceof Error?error.message:String(error));}
  }
  async deleteFile() {
    const file=this.selected();if(!file||!confirm(`Delete ${file.path}?`))return;
    try {await this.call(`/files/${encodeURIComponent(file.id)}?expectedRevision=${file.revision}`,'DELETE');this.selected.set(null);this.draft.set('');await this.refresh();this.ctx.notice.set('File deleted.');}
    catch(error){this.ctx.error.set(error instanceof Error?error.message:String(error));}
  }
  async deleteFolder(path:string) {
    if(!confirm(`Delete empty folder ${path}?`))return;
    try {await this.call(`/folders?path=${encodeURIComponent(path)}`,'DELETE');await this.refresh();this.ctx.notice.set('Folder deleted.');}
    catch(error){this.ctx.error.set(error instanceof Error?error.message:String(error));}
  }
  async createTask() {
    const path=this.selected()?.path || prompt('Which Markdown path should the task change?')?.trim();
    if(!path)return;
    const title=prompt('Describe the change',`Edit ${path}`)?.trim();if(!title)return;
    try {const item=await this.ctx.api<{id:string}>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work`,'POST',
      {action:`${this.layerKey()}.edit`,layer:this.layerKey(),type:'implement',title,context:{markdownPath:path,markdownFileId:this.selected()?.id||null,markdownRevision:this.selected()?.revision||null}});
      await this.ctx.reload();this.ctx.go(this.ctx.link('work','item',item.id));}
    catch(error){this.ctx.error.set(error instanceof Error?error.message:String(error));}
  }
}
