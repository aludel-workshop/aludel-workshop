import { Component, ElementRef, HostListener, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { ProjectContext } from './context';

interface MarkdownFile { id: string; path: string; revision: number; sha: string; updatedAt: string }
interface MarkdownDocument extends MarkdownFile { content: string }
interface MarkdownTree { folders: string[]; files: MarkdownFile[] }
interface OpenTab { id: string; path: string; doc: MarkdownDocument; draft: string; preview: boolean; stale: boolean }
interface TreeNode { path: string; name: string; file: MarkdownFile | null; children: TreeNode[] }
interface Row { kind: 'folder' | 'file' | 'input'; path: string; name: string; depth: number; file: MarkdownFile | null; expanded: boolean }
type Pending = { mode: 'create'; kind: 'file' | 'folder'; parent: string } | { mode: 'rename'; kind: 'file' | 'folder'; path: string; id: string | null };
interface Segment { t: string; c: string }
type View = 'edit' | 'split' | 'preview';

const name = (path: string) => path.split('/').at(-1) || path;
const parentOf = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
const join = (parent: string, child: string) => parent ? `${parent}/${child}` : child;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

// Codicon-like 16px outline icons, inlined so the portal's Material Symbols subset does not need rebuilding.
// Constants rather than a function: the Angular compiler must evaluate them statically inside the template.
const SVG = '<svg class="mde-icon" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
const I = {
  newFile: `${SVG}<path d="M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4.5M9.5 1.5 13 5v3.5M9.5 1.5V5H13"/><path d="M12 10.5v4M10 12.5h4"/></svg>`,
  newFolder: `${SVG}<path d="M8 13.5H2.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3.6l1.5 1.5h5.9a1 1 0 0 1 1 1V8"/><path d="M12 10v4.5M9.75 12.25h4.5"/></svg>`,
  folder: `${SVG}<path d="M1.5 4a1 1 0 0 1 1-1h3.6l1.5 1.5h5.9a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z"/></svg>`,
  refresh: `${SVG}<path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3"/></svg>`,
  collapse: `${SVG}<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M5.5 8h5"/></svg>`,
  chevron: `${SVG}<path d="m6 4 4 4-4 4"/></svg>`,
  close: `${SVG}<path d="m4 4 8 8M12 4l-8 8"/></svg>`,
  sidebar: `${SVG}<rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M6 2.5v11"/></svg>`,
  source: `${SVG}<path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5"/></svg>`,
  split: `${SVG}<rect x="1.5" y="2.5" width="13" height="11" rx="1"/><path d="M8 2.5v11M10 6h2.5M10 8.5h2.5"/></svg>`,
  eye: `${SVG}<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>`,
  markdown: `${SVG}<rect x="1" y="3.5" width="14" height="9" rx="1.5"/><path d="M3.5 10V6l2 2.25L7.5 6v4M11 6v4m-1.75-1.75L11 10l1.75-1.75"/></svg>`
};

// CUSTOM-LAYER-01 editor pass: an explorer tree, file tabs and a Markdown editor, composed like VS Code.
// The server contract is unchanged: folders are explicit, files end in .md and every save names its expected revision.
@Component({
  selector: 'aludel-markdown-layer', standalone: true,
  template: `
  <!-- The shell's layer bar carries the heading; this row keeps only the task control. -->
  <header class="mde-heading">
    <div class="mde-task-control">
      @if (domainActions().length && isActiveLayer()) {
        <label for="mde-task-action" class="visually-hidden">Work action</label>
        <select id="mde-task-action" [value]="chosenAction()?.key || ''" (change)="selectedAction.set($any($event.target).value)">
          @for (action of domainActions(); track action.key) { <option [value]="action.key">{{ action.title }}</option> }
        </select>
        <button type="button" class="lay-button" (click)="createTask()">Create task</button>
      } @else { <a class="lay-link-button" [href]="ctx.link(layerKey(),'tasks','actions')" (click)="ctx.go(ctx.link(layerKey(),'tasks','actions'),$event)">Define an action to create tasks</a> }
    </div>
  </header>
  <div class="mde" [class.mde-no-side]="!sidebar()" [style.--mde-side]="sideWidth() + 'px'">
    @if (sidebar()) {
    <aside class="mde-side" aria-label="Explorer">
      <div class="mde-side-head">
        <span>{{ layerName() }}</span>
        <div class="mde-side-actions">
          <button type="button" (click)="startCreate('file', '')" title="New file" aria-label="New file">${I.newFile}</button>
          <button type="button" (click)="startCreate('folder', '')" title="New folder" aria-label="New folder">${I.newFolder}</button>
          <button type="button" (click)="refresh()" title="Refresh" aria-label="Refresh explorer">${I.refresh}</button>
          <button type="button" (click)="collapseAll()" title="Collapse folders" aria-label="Collapse folders">${I.collapse}</button>
        </div>
      </div>
      <div class="mde-tree" [attr.role]="rows().length ? 'tree' : null" [attr.aria-label]="layerName() + ' files'" aria-describedby="mde-tree-keys" (keydown)="treeKey($event)"
        (contextmenu)="openMenu($event, null)" (dragover)="dragOver($event, '')" (drop)="drop($event, '')" [class.mde-drop-root]="dropTarget() === ''">
        @for (row of rows(); track row.kind + ':' + row.path) {
          @if (row.kind === 'input') {
            <div class="mde-row mde-row-input" [style.--depth]="row.depth" role="none">
              <span class="mde-twist"></span>
              @if (pendingKind() === 'folder') { <span class="mde-glyph">${I.folder}</span> } @else { <span class="mde-glyph mde-md">${I.markdown}</span> }
              <input #nameInput class="mde-name-input" [value]="row.name" [attr.aria-label]="pendingLabel()" [class.invalid]="inputError()"
                (keydown)="inputKey($event)" (blur)="blurPending($any($event.target).value)" (input)="inputError.set('')">
              @if (inputError()) { <p class="mde-input-error" role="alert">{{ inputError() }}</p> }
            </div>
          } @else {
            <div class="mde-row" role="treeitem" [style.--depth]="row.depth" [attr.aria-level]="row.depth + 1" [attr.aria-expanded]="row.kind === 'folder' ? row.expanded : null"
              [attr.aria-selected]="focusPath() === row.path" [attr.tabindex]="tabStop() === row.path ? 0 : -1" [attr.data-path]="row.path"
              [class.focused]="focusPath() === row.path" [class.active]="row.file?.id === activeId()" [class.drop]="dropTarget() === row.path"
              [title]="row.path" draggable="true" (dragstart)="dragStart($event, row)" (dragover)="dragOver($event, row.kind === 'folder' ? row.path : parentOf(row.path))"
              (drop)="drop($event, row.kind === 'folder' ? row.path : parentOf(row.path))" (dragend)="dropTarget.set(null)"
              (click)="rowClick(row)" (dblclick)="row.file && openFile(row.file, false)" (contextmenu)="openMenu($event, row)">
              @for (guide of guides(row.depth); track $index) { <span class="mde-guide" [style.--at]="guide"></span> }
              <span class="mde-twist">@if (row.kind === 'folder') { <span class="mde-chevron" [class.open]="row.expanded">${I.chevron}</span> }</span>
              @if (row.kind === 'file') { <span class="mde-glyph mde-md">${I.markdown}</span> }
              <span class="mde-label" [class.dirty]="row.file && isDirty(row.file.id)">{{ row.name }}</span>
              @if (row.file && isDirty(row.file.id)) { <span class="mde-dot" aria-label="Unsaved changes"></span> }
              @if (row.kind === 'folder') {
                <!-- Pointer shortcuts only; keyboard users reach the same commands through the context menu (Shift+F10). -->
                <span class="mde-row-actions" aria-hidden="true">
                  <span class="mde-new-file" (click)="startCreate('file', row.path); $event.stopPropagation()" title="New file in {{ row.name }}">${I.newFile}</span>
                  <span class="mde-new-folder" (click)="startCreate('folder', row.path); $event.stopPropagation()" title="New folder in {{ row.name }}">${I.newFolder}</span>
                </span>
              }
            </div>
          }
        }
        @if (!tree().files.length && !tree().folders.length && !pending()) {
          <div class="mde-tree-empty"><p>No files yet.</p><button type="button" class="lay-button" (click)="startCreate('file', '')">New Markdown file</button></div>
        }
      </div>
    </aside>
    <div class="mde-sash" role="separator" aria-orientation="vertical" aria-label="Resize explorer" tabindex="0" [attr.aria-valuenow]="sideWidth()" aria-valuemin="160" aria-valuemax="480"
      (pointerdown)="sashDown($event)" (keydown)="sashKey($event)"></div>
    }

    <section class="mde-main" aria-label="Editor">
      <p id="mde-tab-keys" class="visually-hidden">Left and right arrows switch files, Enter edits, Delete closes.</p>
      <p id="mde-tree-keys" class="visually-hidden">Arrows move and expand, Enter opens, F2 renames, Delete deletes, Shift F10 opens actions such as New File.</p>
      <div class="mde-tabs">
        <button type="button" class="mde-tool" (click)="toggleSidebar()" [title]="sidebar() ? 'Hide explorer' : 'Show explorer'" [attr.aria-label]="sidebar() ? 'Hide explorer' : 'Show explorer'" [attr.aria-pressed]="sidebar()">${I.sidebar}</button>
        <div class="mde-tablist" role="tablist" aria-label="Open files">
          @for (tab of tabs(); track tab.id) {
            <div class="mde-tab" role="tab" [attr.aria-selected]="tab.id === activeId()" [attr.tabindex]="tab.id === activeId() ? 0 : -1" [attr.data-tab]="tab.id" [title]="tab.path"
              [class.active]="tab.id === activeId()" [class.preview]="tab.preview" [class.dirty]="tab.draft !== tab.doc.content"
              (click)="activate(tab.id)" (dblclick)="pin(tab.id)" (auxclick)="$event.button === 1 && closeTab(tab.id)" (keydown)="tabKey($event, tab.id)" aria-describedby="mde-tab-keys">
              <span class="mde-glyph mde-md">${I.markdown}</span>
              <span class="mde-tab-name">{{ tabName(tab) }}</span>@if (tabHint(tab); as hint) { <small>{{ hint }}</small> }
              <!-- Pointer shortcut only; the focused tab closes with Delete, and aria-describedby says so. -->
              <span class="mde-tab-close" aria-hidden="true" title="Close" (click)="closeTab(tab.id); $event.stopPropagation()">
                <span class="mde-dot"></span><span class="mde-x">${I.close}</span></span>
            </div>
          }
        </div>
      </div>

      @if (active(); as tab) {
        <div class="mde-crumbs">
          <nav aria-label="File path"><ol>
            @for (part of tab.path.split('/'); track $index; let last = $last) { <li [class.file]="last">{{ part }}</li> }
          </ol></nav>
          <div class="mde-crumb-actions">
            <span class="mde-rev" [title]="'Saved revision ' + tab.doc.revision">r{{ tab.doc.revision }}</span>
            <div class="mde-views" role="group" aria-label="View">
              <button type="button" [class.on]="view() === 'edit'" [attr.aria-pressed]="view() === 'edit'" (click)="setView('edit')" title="Source" aria-label="Source">${I.source}</button>
              <button type="button" [class.on]="view() === 'split'" [attr.aria-pressed]="view() === 'split'" (click)="setView('split')" title="Preview to the side" aria-label="Preview to the side">${I.split}</button>
              <button type="button" [class.on]="view() === 'preview'" [attr.aria-pressed]="view() === 'preview'" (click)="setView('preview')" title="Preview" aria-label="Preview">${I.eye}</button>
            </div>
          </div>
        </div>
        @if (tab.stale) { <p class="mde-banner" role="status">This file changed since you opened it. Saving will be refused; copy your edits, then close and reopen the file.</p> }
        <div class="mde-body" [class.split]="view() === 'split'">
          @if (view() !== 'preview') {
            <div class="mde-scroll" #scroller (click)="focusEditor($event)">
              <div class="mde-code" [style.--gutter]="gutter() + 'ch'">
                <div class="mde-lines" aria-hidden="true">
                  @for (line of lines(); track $index) {
                    <div class="mde-line" [class.current]="$index === cursor().line"><span class="mde-ln">{{ $index + 1 }}</span><span class="mde-src">@for (seg of line; track $index) {<span [class]="seg.c">{{ seg.t }}</span>}&#8203;</span></div>
                  }
                </div>
                <textarea #editor class="mde-input" spellcheck="true" autocapitalize="off" [attr.aria-label]="tab.path + ' Markdown source'" aria-describedby="mde-keys"
                  [value]="tab.draft" (input)="edit($any($event.target).value)" (keydown)="editorKey($event)" (keyup)="trackCursor()" (click)="trackCursor()" (select)="trackCursor()"></textarea>
              </div>
            </div>
          }
          @if (view() !== 'edit') {
            <article class="mde-preview" [innerHTML]="rendered()" (click)="previewClick($event)" tabindex="0" aria-label="Rendered preview"></article>
          }
        </div>
        <p id="mde-keys" class="visually-hidden">Tab indents. Press Escape, then Tab, to leave the editor. Control or Command S saves.</p>
      } @else {
        <div class="mde-watermark">
          <span class="mde-watermark-mark">${I.markdown}</span>
          <dl>
            <div><dt>New file</dt><dd><button type="button" class="lay-link-button" (click)="startCreate('file', '')">Create a Markdown file</button></dd></div>
            <div><dt>Open</dt><dd>Click a file in the explorer</dd></div>
            <div><dt>Save</dt><dd><kbd>Ctrl</kbd> <kbd>S</kbd></dd></div>
            <div><dt>Rename</dt><dd><kbd>F2</kbd> in the explorer</dd></div>
          </dl>
        </div>
      }

      <footer class="mde-status">
        @if (active(); as tab) {
          <span [class.mde-unsaved]="tab.draft !== tab.doc.content">{{ busy() ? 'Saving…' : tab.draft !== tab.doc.content ? 'Unsaved changes' : 'Saved' }}</span>
          @if (activeWorkId()) { <span>Linked to {{ ctx.workingOn()?.ref }}</span> }
          <span class="mde-status-right">Ln {{ cursor().line + 1 }}, Col {{ cursor().col + 1 }}</span><span>{{ words() }} words</span><span>Markdown</span>
        } @else { <span>{{ tree().files.length }} {{ tree().files.length === 1 ? 'file' : 'files' }}</span> }
      </footer>
    </section>
  </div>

  @if (menu(); as m) {
    <div class="mde-menu" role="menu" [style.left.px]="m.x" [style.top.px]="m.y" (keydown)="menuKey($event)" (click)="$event.stopPropagation()">
      @if (!m.row || m.row.kind === 'folder') {
        <button type="button" role="menuitem" (click)="menuDo('new-file')">New File…</button>
        <button type="button" role="menuitem" (click)="menuDo('new-folder')">New Folder…</button>
      }
      @if (m.row?.file) { <button type="button" role="menuitem" (click)="menuDo('open')">Open</button> }
      @if (m.row) {
        <hr role="separator">
        <button type="button" role="menuitem" (click)="menuDo('rename')">Rename…<kbd>F2</kbd></button>
        <button type="button" role="menuitem" (click)="menuDo('delete')">Delete<kbd>Del</kbd></button>
        <hr role="separator">
        <button type="button" role="menuitem" (click)="menuDo('copy')">Copy Path</button>
      }
    </div>
  }`
})
export class MarkdownLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly layerName = computed(() => this.ctx.layerInstances().find(item => item.key === this.layerKey())?.name || this.layerKey());
  readonly domainActions = computed(() => this.ctx.layerInstances().find(item => item.key === this.layerKey())?.domainActions || []);
  readonly isActiveLayer = computed(() => this.ctx.layerInstances().find(item => item.key === this.layerKey())?.lifecycle === 'active');
  readonly selectedAction = signal('');
  readonly chosenAction = computed(() => this.domainActions().find(action => action.key === this.selectedAction()) || this.domainActions()[0] || null);
  readonly parentOf = parentOf;

  readonly tree = signal<MarkdownTree>({ folders: [], files: [] });
  readonly expanded = signal<Set<string>>(new Set());
  readonly focusPath = signal('');
  readonly pending = signal<Pending | null>(null);
  readonly inputError = signal('');
  readonly dropTarget = signal<string | null>(null);
  readonly menu = signal<{ x: number; y: number; row: Row | null } | null>(null);
  readonly tabs = signal<OpenTab[]>([]);
  readonly activeId = signal<string | null>(null);
  readonly view = signal<View>('edit');
  readonly sidebar = signal(true);
  readonly sideWidth = signal(248);
  readonly busy = signal(false);
  readonly cursor = signal({ line: 0, col: 0 });

  readonly active = computed(() => this.tabs().find(tab => tab.id === this.activeId()) || null);
  readonly lines = computed(() => highlight(this.active()?.draft ?? ''));
  readonly gutter = computed(() => Math.max(3, String(this.lines().length).length + 1));
  readonly rendered = computed(() => renderMarkdown(this.active()?.draft ?? ''));
  readonly words = computed(() => (this.active()?.draft.match(/\S+/g) || []).length);
  readonly tabStop = computed(() => { const rows = this.rows().filter(row => row.kind !== 'input'); return rows.find(row => row.path === this.focusPath())?.path ?? rows[0]?.path; });
  readonly pendingKind = computed(() => this.pending()?.kind);
  readonly pendingLabel = computed(() => { const p = this.pending(); return !p ? '' : p.mode === 'rename' ? `Rename ${p.path}` : `New ${p.kind} name in ${p.parent || 'the root'}`; });

  private readonly nodes = computed(() => {
    const root: TreeNode = { path: '', name: '', file: null, children: [] };
    const folders = new Map<string, TreeNode>([['', root]]);
    const folder = (path: string): TreeNode => {
      let node = folders.get(path);
      if (!node) { node = { path, name: name(path), file: null, children: [] }; folders.set(path, node); folder(parentOf(path)).children.push(node); }
      return node;
    };
    for (const path of this.tree().folders) folder(path);
    for (const file of this.tree().files) folder(parentOf(file.path)).children.push({ path: file.path, name: name(file.path), file, children: [] });
    const sort = (node: TreeNode) => { node.children.sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })); node.children.forEach(sort); };
    sort(root);
    return root;
  });
  // Visible rows, folders first, with the inline name box placed where the new entry will appear.
  readonly rows = computed(() => {
    const rows: Row[] = [], open = this.expanded(), pending = this.pending();
    const input = (parent: string, depth: number) => { if (pending?.mode === 'create' && pending.parent === parent) rows.push({ kind: 'input', path: `\u0000${parent}`, name: '', depth, file: null, expanded: false }); };
    const walk = (node: TreeNode, depth: number) => {
      input(node.path, depth);
      for (const child of node.children) {
        if (pending?.mode === 'rename' && pending.path === child.path) { rows.push({ kind: 'input', path: `\u0001${child.path}`, name: child.name, depth, file: child.file, expanded: false }); continue; }
        const isOpen = !child.file && open.has(child.path);
        rows.push({ kind: child.file ? 'file' : 'folder', path: child.path, name: child.name, depth, file: child.file, expanded: isOpen });
        if (isOpen) walk(child, depth + 1);
      }
    };
    walk(this.nodes(), 0);
    return rows;
  });

  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly base = computed(() => `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/${encodeURIComponent(this.layerKey())}/markdown`);
  private readonly storageKey = computed(() => `aludel.markdown-editor.${this.ctx.projectId()}.${this.layerKey()}`);
  private restored = '';
  private tabEscapes = false;
  private committing = false;

  constructor() {
    effect(() => { if (this.ctx.projectId() && this.layerKey()) untracked(() => void this.load()); });
    effect(() => { const input = this.nameInput()?.nativeElement; if (input) queueMicrotask(() => { input.focus(); const dot = input.value.toLowerCase().endsWith('.md') ? input.value.length - 3 : input.value.length; input.setSelectionRange(0, dot); }); });
    effect(() => { const state = { tabs: this.tabs().map(tab => tab.id), active: this.activeId(), expanded: [...this.expanded()], width: this.sideWidth(), view: this.view(), sidebar: this.sidebar() };
      if (this.restored === this.storageKey()) try { localStorage.setItem(this.storageKey(), JSON.stringify(state)); } catch { /* per-viewer convenience only */ } });
  }

  private call<T>(path: string, method = 'GET', body?: unknown): Promise<T> { return this.ctx.api<T>(`${this.base()}${path}`, method, body); }
  activeWorkId() { const item = this.ctx.workingOn(); return item && this.ctx.data()?.work.find(work => work.id === item.id)?.layer === this.layerKey() ? item.id : null; }
  isDirty(id: string) { const tab = this.tabs().find(entry => entry.id === id); return !!tab && tab.draft !== tab.doc.content; }
  guides(depth: number) { return Array.from({ length: depth }, (_, index) => index); }
  tabName(tab: OpenTab) { return name(tab.path); }
  // Two open files with one name show their folder, as VS Code does.
  tabHint(tab: OpenTab) { return this.tabs().some(other => other.id !== tab.id && name(other.path) === name(tab.path)) ? parentOf(tab.path) || '/' : ''; }

  private async load() {
    this.tabs.set([]); this.activeId.set(null); this.restored = '';
    let saved: { tabs?: string[]; active?: string; expanded?: string[]; width?: number; view?: View; sidebar?: boolean } = {};
    try { saved = JSON.parse(localStorage.getItem(this.storageKey()) || '{}'); } catch { saved = {}; }
    await this.refresh();
    const folders = this.tree().folders;
    this.expanded.set(new Set(saved.expanded ? saved.expanded.filter(path => folders.includes(path)) : folders.filter(path => !path.includes('/'))));
    if (saved.width) this.sideWidth.set(Math.min(480, Math.max(160, saved.width)));
    if (saved.view) this.view.set(saved.view);
    this.sidebar.set(saved.sidebar ?? true);
    for (const id of saved.tabs || []) { const file = this.tree().files.find(entry => entry.id === id); if (file) await this.openFile(file, false, false); }
    const active = saved.active && this.tabs().some(tab => tab.id === saved.active) ? saved.active : this.tabs()[0]?.id || null;
    this.activeId.set(active);
    this.restored = this.storageKey();
  }

  async refresh() {
    try { this.tree.set(await this.call<MarkdownTree>('/tree')); this.reconcileTabs(); }
    catch (error) { this.ctx.error.set(message(error)); }
  }
  // After moves or outside saves, keep open tabs on the same file id: follow its path, reload clean tabs, flag dirty ones.
  private reconcileTabs() {
    const files = new Map(this.tree().files.map(file => [file.id, file]));
    const reload: MarkdownFile[] = [];
    this.tabs.update(tabs => tabs.flatMap(tab => {
      const file = files.get(tab.id);
      if (!file) return tab.draft !== tab.doc.content ? [{ ...tab, stale: true }] : [];
      if (file.revision !== tab.doc.revision) { if (tab.draft === tab.doc.content) reload.push(file); else return [{ ...tab, path: file.path, stale: true }]; }
      return [{ ...tab, path: file.path, doc: { ...tab.doc, path: file.path } }];
    }));
    if (this.activeId() && !this.tabs().some(tab => tab.id === this.activeId())) this.activeId.set(this.tabs().at(-1)?.id || null);
    for (const file of reload) void this.reloadTab(file);
  }
  private async reloadTab(file: MarkdownFile) {
    try { const doc = await this.call<MarkdownDocument>(`/files/${encodeURIComponent(file.id)}`); this.tabs.update(tabs => tabs.map(tab => tab.id === doc.id ? { ...tab, doc, draft: doc.content, path: doc.path, stale: false } : tab)); }
    catch (error) { this.ctx.error.set(message(error)); }
  }

  // ---- Explorer ----
  rowClick(row: Row) {
    this.focusPath.set(row.path);
    if (row.kind === 'folder') this.toggleFolder(row.path);
    else if (row.file) void this.openFile(row.file, true);
  }
  toggleFolder(path: string, open?: boolean) {
    this.expanded.update(set => { const next = new Set(set); if (open ?? !next.has(path)) next.add(path); else next.delete(path); return next; });
  }
  collapseAll() { this.expanded.set(new Set()); }
  private expandTo(path: string) {
    this.expanded.update(set => { const next = new Set(set); let at = path; while (at) { next.add(at); at = parentOf(at); } return next; });
  }

  startCreate(kind: 'file' | 'folder', parent: string) {
    this.menu.set(null); this.inputError.set('');
    if (!this.sidebar()) this.sidebar.set(true);
    if (parent) this.expandTo(parent);
    this.pending.set({ mode: 'create', kind, parent });
  }
  startRename(row: Row) {
    if (row.kind === 'input') return;
    this.menu.set(null); this.inputError.set('');
    this.pending.set({ mode: 'rename', kind: row.kind, path: row.path, id: row.file?.id || null });
  }
  inputKey(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === 'Enter') { event.preventDefault(); void this.commitPending((event.target as HTMLInputElement).value, false); }
    else if (event.key === 'Escape') { event.preventDefault(); this.cancelPending(); }
  }
  private cancelPending(refocus = true) {
    const pending = this.pending(); this.pending.set(null); this.inputError.set('');
    if (!refocus) return;
    const path = pending?.mode === 'rename' ? pending.path : pending?.parent;
    if (path) this.focusRow(path); else this.focusTree();
  }
  // Clicking away keeps a valid name and quietly drops an empty or already-refused one, as VS Code does.
  blurPending(raw: string) {
    if (this.committing || !this.pending()) return;
    if (!raw.trim() || this.inputError()) { this.cancelPending(false); return; }
    void this.commitPending(raw, true);
  }
  // Enter commits and keeps the box open with the server's reason if the name is refused.
  async commitPending(raw: string, fromBlur: boolean) {
    const pending = this.pending(); if (!pending || this.committing) return;
    const value = raw.trim().replace(/^\/+|\/+$/g, '');
    if (!value) { this.cancelPending(!fromBlur); return; }
    this.committing = true;
    try {
      if (pending.mode === 'create') {
        let path = join(pending.parent, value);
        if (pending.kind === 'file' && !/\.md$/i.test(path)) path += '.md';
        await this.ensureFolders(parentOf(path));
        if (pending.kind === 'folder') { await this.call('/folders', 'POST', { path }); this.pending.set(null); await this.refresh(); this.expandTo(path); this.focusRow(path); }
        else { const file = await this.call<MarkdownDocument>('/files', 'POST', { path, content: '', workId: this.activeWorkId() }); this.pending.set(null); await this.refresh(); this.expandTo(parentOf(path)); this.focusPath.set(path); await this.openFile(file, false); }
      } else {
        let path = join(parentOf(pending.path), value);
        if (pending.kind === 'file' && !/\.md$/i.test(path)) path += '.md';
        if (path === pending.path) { this.cancelPending(!fromBlur); return; }
        await this.move(pending.kind, pending.path, pending.id, path);
        this.pending.set(null); this.focusRow(path);
      }
      this.inputError.set('');
    } catch (error) {
      if (fromBlur) { this.cancelPending(false); this.ctx.error.set(message(error)); }
      else this.inputError.set(message(error));
    } finally { this.committing = false; }
  }
  // A typed name like "notes/ideas/one.md" creates the missing folders first, as VS Code does.
  private async ensureFolders(path: string) {
    if (!path) return;
    const known = new Set(this.tree().folders); let at = '';
    for (const part of path.split('/')) { at = join(at, part); if (!known.has(at)) { await this.call('/folders', 'POST', { path: at }); known.add(at); } }
  }
  private async move(kind: 'file' | 'folder', from: string, id: string | null, to: string) {
    if (kind === 'file' && id) {
      const tab = this.tabs().find(entry => entry.id === id);
      const revision = tab?.doc.revision ?? this.tree().files.find(file => file.id === id)?.revision;
      await this.ensureFolders(parentOf(to));
      await this.call<MarkdownDocument>(`/files/${encodeURIComponent(id)}/move`, 'POST', { path: to, expectedRevision: revision, workId: this.activeWorkId() });
    } else {
      await this.ensureFolders(parentOf(to));
      await this.call('/folders', 'PUT', { from, to });
      this.expanded.update(set => new Set([...set].map(path => path === from || path.startsWith(from + '/') ? to + path.slice(from.length) : path)));
    }
    await this.refresh();
    this.expandTo(parentOf(to));
  }
  async deleteRow(row: Row) {
    this.menu.set(null);
    if (row.kind === 'file' && row.file) {
      const dirty = this.isDirty(row.file.id);
      if (!confirm(`Delete ${row.path}?${dirty ? ' Its unsaved changes will be lost.' : ''} Earlier revisions stay in the layer history.`)) return;
      const revision = this.tabs().find(tab => tab.id === row.file!.id)?.doc.revision ?? row.file.revision;
      try { await this.call(`/files/${encodeURIComponent(row.file.id)}?expectedRevision=${revision}`, 'DELETE'); this.dropTab(row.file.id); await this.refresh(); }
      catch (error) { this.ctx.error.set(message(error)); }
    } else if (row.kind === 'folder') {
      if (this.tree().files.some(file => file.path.startsWith(row.path + '/')) || this.tree().folders.some(path => path.startsWith(row.path + '/'))) {
        this.ctx.error.set(`${row.path} isn't empty. Move or delete what's inside it first.`); return;
      }
      if (!confirm(`Delete the empty folder ${row.path}?`)) return;
      try { await this.call(`/folders?path=${encodeURIComponent(row.path)}`, 'DELETE'); await this.refresh(); this.focusRow(parentOf(row.path)); }
      catch (error) { this.ctx.error.set(message(error)); }
    }
  }

  // Keyboard model of VS Code's explorer: arrows move and expand, Enter opens, F2 renames, Delete deletes.
  treeKey(event: KeyboardEvent) {
    const rows = this.rows().filter(row => row.kind !== 'input');
    if (!rows.length) return;
    const index = Math.max(0, rows.findIndex(row => row.path === this.focusPath()));
    const row = rows[index];
    const to = (next: Row | undefined) => { if (next) { event.preventDefault(); this.focusRow(next.path); } };
    switch (event.key) {
      case 'ArrowDown': return to(rows[index + 1]);
      case 'ArrowUp': return to(rows[index - 1]);
      case 'Home': return to(rows[0]);
      case 'End': return to(rows.at(-1));
      case 'ArrowRight': event.preventDefault(); if (row.kind === 'folder') { if (!row.expanded) this.toggleFolder(row.path, true); else to(rows[index + 1]?.depth > row.depth ? rows[index + 1] : undefined); } return;
      case 'ArrowLeft': event.preventDefault(); if (row.kind === 'folder' && row.expanded) this.toggleFolder(row.path, false); else if (parentOf(row.path)) this.focusRow(parentOf(row.path)); return;
      case 'Enter': event.preventDefault(); if (row.kind === 'folder') this.toggleFolder(row.path); else if (row.file) void this.openFile(row.file, false); return;
      case ' ': event.preventDefault(); if (row.file) void this.openFile(row.file, true, false); return;
      case 'F2': event.preventDefault(); this.startRename(row); return;
      case 'Delete': event.preventDefault(); void this.deleteRow(row); return;
      case 'ContextMenu': event.preventDefault(); this.openMenuAt(row); return;
      case 'F10': if (event.shiftKey) { event.preventDefault(); this.openMenuAt(row); } return;
    }
  }
  private focusRow(path: string) {
    this.focusPath.set(path);
    queueMicrotask(() => (this.host.nativeElement.querySelector(`.mde-row[data-path="${CSS.escape(path)}"]`) as HTMLElement | null)?.focus());
  }
  private focusTree() { queueMicrotask(() => (this.host.nativeElement.querySelector('.mde-row[tabindex="0"]') as HTMLElement | null)?.focus()); }

  // ---- Context menu ----
  openMenu(event: MouseEvent, row: Row | null) {
    event.preventDefault(); event.stopPropagation();
    if (row) this.focusPath.set(row.path);
    this.menu.set({ x: Math.min(event.clientX, window.innerWidth - 200), y: Math.min(event.clientY, window.innerHeight - 220), row });
    this.focusMenu();
  }
  private openMenuAt(row: Row) {
    const rect = this.host.nativeElement.querySelector(`.mde-row[data-path="${CSS.escape(row.path)}"]`)?.getBoundingClientRect();
    this.menu.set({ x: (rect?.left ?? 0) + 24, y: rect?.bottom ?? 0, row }); this.focusMenu();
  }
  private focusMenu() { queueMicrotask(() => (this.host.nativeElement.querySelector('.mde-menu button') as HTMLElement | null)?.focus()); }
  menuKey(event: KeyboardEvent) {
    const items = [...this.host.nativeElement.querySelectorAll('.mde-menu button')] as HTMLElement[];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
    else if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); const row = this.menu()?.row; this.menu.set(null); if (row) this.focusRow(row.path); }
  }
  menuDo(action: string) {
    const row = this.menu()?.row || null; this.menu.set(null);
    const parent = row ? (row.kind === 'folder' ? row.path : parentOf(row.path)) : '';
    if (action === 'new-file') this.startCreate('file', parent);
    else if (action === 'new-folder') this.startCreate('folder', parent);
    else if (action === 'open' && row?.file) void this.openFile(row.file, false);
    else if (action === 'rename' && row) this.startRename(row);
    else if (action === 'delete' && row) void this.deleteRow(row);
    else if (action === 'copy' && row) void navigator.clipboard?.writeText(row.path).then(() => this.ctx.notice.set(`Copied ${row.path}.`), () => this.ctx.error.set('The browser did not allow copying.'));
  }
  @HostListener('document:click') closeMenu() { if (this.menu()) this.menu.set(null); }
  @HostListener('window:blur') blurMenu() { this.closeMenu(); }

  // ---- Drag and drop moves ----
  private dragging: Row | null = null;
  dragStart(event: DragEvent, row: Row) { this.dragging = row; event.dataTransfer?.setData('text/plain', row.path); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'; }
  private canDrop(target: string) {
    const row = this.dragging; if (!row) return false;
    if (parentOf(row.path) === target) return false;
    return row.kind !== 'folder' || (target !== row.path && !target.startsWith(row.path + '/'));
  }
  dragOver(event: DragEvent, target: string) {
    event.stopPropagation();
    if (!this.canDrop(target)) { this.dropTarget.set(null); return; }
    event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; this.dropTarget.set(target);
  }
  async drop(event: DragEvent, target: string) {
    event.preventDefault(); event.stopPropagation();
    const row = this.dragging, allowed = this.canDrop(target); this.dragging = null; this.dropTarget.set(null);
    if (!row || !allowed || row.kind === 'input') return;
    const to = join(target, row.name);
    try { await this.move(row.kind, row.path, row.file?.id || null, to); this.focusRow(to); }
    catch (error) { this.ctx.error.set(message(error)); }
  }

  // ---- Tabs ----
  // A single click opens a preview tab that the next single click replaces; editing, double-clicking or Enter keeps it.
  private readonly opening = new Map<string, Promise<void>>();
  async openFile(file: MarkdownFile, preview: boolean, focus = true): Promise<void> {
    // A double-click sends several opens before the first read returns; later ones wait until its tab exists, then act on it.
    const inFlight = this.opening.get(file.id);
    if (inFlight) { await inFlight; if (this.tabs().some(tab => tab.id === file.id)) await this.openFile(file, preview, focus); return; }
    const existing = this.tabs().find(tab => tab.id === file.id);
    if (existing) { if (!preview && existing.preview) this.pin(file.id); this.switchTo(file.id); if (focus && !preview) this.focusEditor(); return; }
    const task = this.addTab(file, preview, focus);
    this.opening.set(file.id, task);
    try { await task; } finally { this.opening.delete(file.id); }
  }
  private async addTab(file: MarkdownFile, preview: boolean, focus: boolean) {
    try {
      const doc = await this.call<MarkdownDocument>(`/files/${encodeURIComponent(file.id)}`);
      const tab: OpenTab = { id: doc.id, path: doc.path, doc, draft: doc.content, preview, stale: false };
      this.tabs.update(tabs => {
        const replace = preview ? tabs.findIndex(entry => entry.preview && entry.draft === entry.doc.content) : -1;
        if (replace >= 0) return tabs.map((entry, index) => index === replace ? tab : entry);
        const at = tabs.findIndex(entry => entry.id === this.activeId());
        return at >= 0 ? [...tabs.slice(0, at + 1), tab, ...tabs.slice(at + 1)] : [...tabs, tab];
      });
      this.switchTo(doc.id);
      if (focus && !preview) this.focusEditor();
    } catch (error) { this.ctx.error.set(message(error)); }
  }
  activate(id: string) { this.switchTo(id); const tab = this.tabs().find(entry => entry.id === id); if (tab) { this.focusPath.set(tab.path); this.expandTo(parentOf(tab.path)); } }
  // Each tab keeps its own caret and scroll position, which the shared textarea would otherwise lose.
  private readonly places = new Map<string, { start: number; end: number; scroll: number }>();
  private switchTo(id: string) {
    const current = this.activeId(), editor = this.editor()?.nativeElement, box = this.scroller()?.nativeElement;
    if (current === id) return;
    if (current && editor) this.places.set(current, { start: editor.selectionStart, end: editor.selectionEnd, scroll: box?.scrollTop || 0 });
    this.activeId.set(id);
    setTimeout(() => {
      const place = this.places.get(id) || { start: 0, end: 0, scroll: 0 }, next = this.editor()?.nativeElement;
      if (next) next.setSelectionRange(place.start, place.end);
      const scroller = this.scroller()?.nativeElement; if (scroller) scroller.scrollTop = place.scroll;
      if (next) { const before = next.value.slice(0, place.start); this.cursor.set({ line: before.split('\n').length - 1, col: before.length - before.lastIndexOf('\n') - 1 }); }
    });
  }
  pin(id: string) { this.tabs.update(tabs => tabs.map(tab => tab.id === id ? { ...tab, preview: false } : tab)); }
  closeTab(id: string) {
    const tab = this.tabs().find(entry => entry.id === id); if (!tab) return;
    if (tab.draft !== tab.doc.content && !confirm(`${name(tab.path)} has unsaved changes. Close it and discard them?`)) return;
    this.dropTab(id);
  }
  private dropTab(id: string) {
    const tabs = this.tabs(), index = tabs.findIndex(tab => tab.id === id); if (index < 0) return;
    const next = tabs.filter(tab => tab.id !== id); this.tabs.set(next);
    this.places.delete(id);
    if (this.activeId() === id) { const fallback = next[Math.min(index, next.length - 1)]?.id; if (fallback) this.switchTo(fallback); else this.activeId.set(null); }
  }
  tabKey(event: KeyboardEvent, id: string) {
    const tabs = this.tabs(), index = tabs.findIndex(tab => tab.id === id);
    const go = (next: OpenTab | undefined) => { if (!next) return; event.preventDefault(); this.activate(next.id); queueMicrotask(() => (this.host.nativeElement.querySelector(`.mde-tab[data-tab="${CSS.escape(next.id)}"]`) as HTMLElement | null)?.focus()); };
    if (event.key === 'ArrowRight') go(tabs[index + 1]); else if (event.key === 'ArrowLeft') go(tabs[index - 1]);
    else if (event.key === 'Delete') { event.preventDefault(); this.closeTab(id); }
    else if (event.key === 'Enter') { event.preventDefault(); this.pin(id); this.focusEditor(); }
  }

  // ---- Editor ----
  setView(view: View) { this.view.set(view); if (view !== 'preview') this.focusEditor(); }
  toggleSidebar() { this.sidebar.update(open => !open); }
  focusEditor(event?: MouseEvent) {
    if (event && event.target !== event.currentTarget) return;
    queueMicrotask(() => { const editor = this.editor()?.nativeElement; if (!editor) return; editor.focus(); if (event) { editor.setSelectionRange(editor.value.length, editor.value.length); this.trackCursor(); } });
  }
  edit(value: string) {
    const id = this.activeId(); if (!id) return;
    this.tabs.update(tabs => tabs.map(tab => tab.id === id ? { ...tab, draft: value, preview: false } : tab));
    this.trackCursor();
  }
  trackCursor() {
    const editor = this.editor()?.nativeElement; if (!editor) return;
    const before = editor.value.slice(0, editor.selectionStart), line = before.split('\n').length - 1;
    this.cursor.set({ line, col: before.length - before.lastIndexOf('\n') - 1 });
    queueMicrotask(() => {
      const row = this.scroller()?.nativeElement.querySelectorAll('.mde-line')[line] as HTMLElement | undefined, box = this.scroller()?.nativeElement;
      if (!row || !box) return;
      const top = row.offsetTop, bottom = top + row.offsetHeight;
      if (top < box.scrollTop + 8) box.scrollTop = top - 8; else if (bottom > box.scrollTop + box.clientHeight - 8) box.scrollTop = bottom - box.clientHeight + 8;
    });
  }
  // Tab indents (Escape first lets Tab leave the editor), Enter continues a list, and Ctrl/Cmd+S saves.
  editorKey(event: KeyboardEvent) {
    const editor = event.target as HTMLTextAreaElement;
    if (event.key === 'Escape') { this.tabEscapes = true; return; }
    if (event.key === 'Tab' && !this.tabEscapes && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); this.indent(editor, event.shiftKey); return; }
    if (event.key !== 'Shift') this.tabEscapes = false;
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && editor.selectionStart === editor.selectionEnd) this.continueList(event, editor);
  }
  private insert(editor: HTMLTextAreaElement, text: string) {
    // execCommand keeps the browser's undo history; setRangeText is the fallback.
    if (!document.execCommand?.('insertText', false, text)) { editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, 'end'); this.edit(editor.value); }
  }
  private indent(editor: HTMLTextAreaElement, outdent: boolean) {
    const value = editor.value, start = value.lastIndexOf('\n', editor.selectionStart - 1) + 1;
    const endAt = value.indexOf('\n', Math.max(editor.selectionEnd - (editor.selectionEnd > editor.selectionStart && value[editor.selectionEnd - 1] === '\n' ? 1 : 0), start));
    const end = endAt < 0 ? value.length : endAt;
    if (!outdent && editor.selectionStart === editor.selectionEnd) { this.insert(editor, '  '); return; }
    const block = value.slice(start, end), lines = block.split('\n');
    const changed = lines.map(line => outdent ? line.replace(/^ {1,2}|^\t/, '') : '  ' + line).join('\n');
    editor.setSelectionRange(start, end); this.insert(editor, changed); editor.setSelectionRange(start, start + changed.length);
  }
  private continueList(event: KeyboardEvent, editor: HTMLTextAreaElement) {
    const value = editor.value, start = value.lastIndexOf('\n', editor.selectionStart - 1) + 1, line = value.slice(start, editor.selectionStart);
    const match = /^(\s*)([-*+]|(\d+)([.)]))(\s+)(\[[ xX]\]\s+)?/.exec(line); if (!match) return;
    event.preventDefault();
    if (line.length === match[0].length) { editor.setSelectionRange(start, editor.selectionStart); this.insert(editor, ''); return; }
    const marker = match[3] ? `${Number(match[3]) + 1}${match[4]}` : match[2];
    this.insert(editor, `\n${match[1]}${marker}${match[5]}${match[6] ? '[ ] ' : ''}`);
  }
  async save() {
    const tab = this.active(); if (!tab || tab.draft === tab.doc.content || this.busy()) return;
    this.busy.set(true);
    try {
      const saved = await this.call<MarkdownDocument>(`/files/${encodeURIComponent(tab.id)}`, 'PUT', { content: tab.draft, expectedRevision: tab.doc.revision, workId: this.activeWorkId() });
      this.tabs.update(tabs => tabs.map(entry => entry.id === saved.id ? { ...entry, doc: saved, path: saved.path, preview: false, stale: false } : entry));
      this.tree.update(tree => ({ ...tree, files: tree.files.map(file => file.id === saved.id ? { ...file, revision: saved.revision, sha: saved.sha, updatedAt: saved.updatedAt } : file) }));
    } catch (error) { this.ctx.error.set(message(error)); }
    finally { this.busy.set(false); }
  }
  @HostListener('document:keydown', ['$event']) globalKey(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && this.active()) { event.preventDefault(); void this.save(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b' && !event.shiftKey && !event.altKey) { event.preventDefault(); this.toggleSidebar(); }
    if (event.key === 'Escape' && this.menu()) this.menu.set(null);
  }
  @HostListener('window:beforeunload', ['$event']) unload(event: BeforeUnloadEvent) { if (this.tabs().some(tab => tab.draft !== tab.doc.content)) event.preventDefault(); }

  // Relative .md links in the preview open the linked file in a tab.
  previewClick(event: MouseEvent) {
    const link = (event.target as HTMLElement).closest('a'); const href = link?.getAttribute('href'); const tab = this.active();
    if (!href || !tab || href.startsWith('#')) return;
    if (/^(https?:|mailto:)/i.test(href)) { event.preventDefault(); window.open(href, '_blank', 'noopener'); return; }
    if (/^[a-z]+:|^\//i.test(href)) { event.preventDefault(); return; }
    const parts: string[] = []; for (const part of join(parentOf(tab.path), decodeURI(href.split('#')[0])).split('/')) { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); }
    const file = this.tree().files.find(entry => entry.path === parts.join('/'));
    event.preventDefault();
    if (file) void this.openFile(file, false, false); else this.ctx.error.set(`${parts.join('/')} is not in this layer.`);
  }

  // ---- Explorer width ----
  sashDown(event: PointerEvent) {
    const start = event.clientX, width = this.sideWidth(), target = event.target as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => this.sideWidth.set(Math.min(480, Math.max(160, width + next.clientX - start)));
    const up = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', up);
  }
  sashKey(event: KeyboardEvent) {
    const step = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0;
    if (step) { event.preventDefault(); this.sideWidth.update(width => Math.min(480, Math.max(160, width + step))); }
  }

  async createTask() {
    const action=this.chosenAction();if(!action||!this.isActiveLayer())return;
    const path = this.active()?.path || prompt('Which Markdown path should the task change?')?.trim();
    if (!path) return;
    const title = prompt('Describe the change', `${action.title}: ${path}`)?.trim(); if (!title) return;
    const tab = this.active();
    try {
      const item = await this.ctx.api<{ id: string }>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work`, 'POST',
        { action: `${this.layerKey()}.${action.key}`, layer: this.layerKey(), type: 'implement', title, context: { markdownPath: path, markdownFileId: tab?.id || null, markdownRevision: tab?.doc.revision || null } });
      await this.ctx.reload(); this.ctx.go(this.ctx.link('work', 'item', item.id));
    } catch (error) { this.ctx.error.set(message(error)); }
  }
}

// Source colouring for the editor. Colour only: the overlay must keep every glyph the same width as the textarea's.
function highlight(source: string): Segment[][] {
  let fence = '';
  return source.split('\n').map(line => {
    const open = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) { if (open && open[1][0] === fence[0] && open[1].length >= fence.length) fence = ''; return [{ t: line, c: open && !fence ? 'md-fence' : 'md-codeblock' }]; }
    if (open) { fence = open[1]; return [{ t: line, c: 'md-fence' }]; }
    let match = /^(#{1,6})(\s.*)?$/.exec(line);
    if (match) return [{ t: match[1], c: 'md-mark md-heading' }, ...inlineSegments(match[2] || '', 'md-heading')];
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return [{ t: line, c: 'md-mark' }];
    match = /^(\s*>+\s?)(.*)$/.exec(line);
    if (match) return [{ t: match[1], c: 'md-mark' }, ...inlineSegments(match[2], 'md-quote')];
    match = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s)?(.*)$/.exec(line);
    if (match) return [{ t: match[1], c: '' }, { t: match[2], c: 'md-list' }, { t: match[3] + (match[4] || ''), c: match[4] ? 'md-list' : '' }, ...inlineSegments(match[5], '')];
    if (/^\s*\|.*\|\s*$/.test(line)) return [{ t: line, c: 'md-table' }];
    return inlineSegments(line, '');
  });
}
function inlineSegments(text: string, base: string): Segment[] {
  const out: Segment[] = [], pattern = /(`+)(.+?)\1|(!?\[)([^\]]*)(\]\()([^)]*)(\))|(\*\*|__)(?=\S)(.+?)\8|(\*|_)(?=\S)(.+?)\10|(~~)(.+?)~~/g;
  let at = 0, match: RegExpExecArray | null;
  const push = (t: string, c: string) => { if (t) out.push({ t, c: [base, c].filter(Boolean).join(' ') }); };
  while ((match = pattern.exec(text))) {
    push(text.slice(at, match.index), '');
    if (match[1]) push(match[0], 'md-code');
    else if (match[3]) { push(match[3], 'md-mark'); push(match[4], 'md-link'); push(match[5], 'md-mark'); push(match[6], 'md-url'); push(match[7], 'md-mark'); }
    else if (match[8]) { push(match[8], 'md-mark'); push(match[9], 'md-strong'); push(match[8], 'md-mark'); }
    else if (match[10]) { push(match[10], 'md-mark'); push(match[11], 'md-em'); push(match[10], 'md-mark'); }
    else { push('~~', 'md-mark'); push(match[13], 'md-del'); push('~~', 'md-mark'); }
    at = match.index + match[0].length;
  }
  push(text.slice(at), '');
  return out.length ? out : [{ t: '', c: '' }];
}

// A small CommonMark subset for the preview. Everything is escaped first; Angular's sanitizer still checks the result.
function renderMarkdown(source: string): string {
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeUrl = (url: string) => /^(https?:|mailto:|#|\.{0,2}\/|[\w-][^:]*$)/i.test(url.trim()) ? url.trim() : '';
  const inline = (text: string): string => {
    const codes: string[] = [];
    let html = escape(text).replace(/(`+)(.+?)\1/g, (_, __, code) => `\u0000${codes.push(code) - 1}\u0000`);
    html = html.replace(/!\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g, (_, alt) => `<span class="md-img">${alt || 'image'}</span>`)
      .replace(/\[([^\]]+)\]\(([^)\s]*)[^)]*\)/g, (_, label, url) => { const href = safeUrl(url.replace(/&amp;/g, '&')); return href ? `<a href="${escape(href)}">${label}</a>` : label; })
      .replace(/(\*\*|__)(?=\S)(.+?)\1/g, '<strong>$2</strong>').replace(/(\*|_)(?=\S)(.+?)\1/g, '<em>$2</em>').replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/ {2,}$/gm, '<br>');
    return html.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${codes[Number(index)]}</code>`);
  };
  const lines = source.replace(/\r\n?/g, '\n').split('\n'), out: string[] = [];
  let index = 0;
  const isBlockStart = (line: string) => /^(#{1,6}\s|>|\s*([-*+]|\d+[.)])\s|\s*(`{3,}|~{3,})|\s*([-*_])(\s*\5){2,}\s*$|\s*\|)/.test(line);
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const fence = /^\s*(`{3,}|~{3,})\s*([\w-]*)/.exec(line);
    if (fence) {
      const body: string[] = []; index++;
      while (index < lines.length && !lines[index].trim().startsWith(fence[1])) body.push(lines[index++]);
      index++; out.push(`<pre><code>${escape(body.join('\n'))}</code></pre>`); continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) { out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); index++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); index++; continue; }
    if (/^\s*>/.test(line)) {
      const body: string[] = []; while (index < lines.length && /^\s*>/.test(lines[index])) body.push(lines[index++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(body.join('\n'))}</blockquote>`); continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1] || '')) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      const head = cells(line); index += 2; const body: string[][] = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) body.push(cells(lines[index++]));
      out.push(`<table><thead><tr>${head.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue;
    }
    const item = /^(\s*)([-*+]|\d+[.)])\s+/.exec(line);
    if (item) {
      const ordered = /\d/.test(item[2]), indent = item[1].length, items: string[] = [];
      while (index < lines.length) {
        const current = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[index]);
        if (current && current[1].length === indent && /\d/.test(current[2]) === ordered) { items.push(current[3]); index++; continue; }
        if (lines[index].trim() && (/^\s+/.exec(lines[index])?.[0].length || 0) > indent && items.length) { items[items.length - 1] += '\n' + lines[index].slice(indent + 2); index++; continue; }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map(text => {
        const [first, ...rest] = text.split('\n'), task = /^\[([ xX])\]\s+(.*)$/.exec(first);
        const head = task ? `<span class="md-check${task[1] !== ' ' ? ' done' : ''}">${task[1] !== ' ' ? '✓' : ''}</span>${inline(task[2])}` : inline(first);
        return `<li${task ? ' class="task"' : ''}>${head}${rest.length ? renderMarkdown(rest.join('\n')) : ''}</li>`;
      }).join('')}</${tag}>`);
      continue;
    }
    const para: string[] = [];
    while (index < lines.length && lines[index].trim() && (!para.length || !isBlockStart(lines[index]))) para.push(lines[index++]);
    out.push(`<p>${inline(para.join('\n'))}</p>`);
  }
  return out.join('');
}
