import { Component, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { contrastText, readableAccent } from './color';
import { Feel, PageRoute, PageType } from './onboarding-model';
import { PageBlocksComponent } from './page-blocks';

// The onboarding's live "proto-site": the logged-in app as it will be generated, before anything is built.
// Colours, layout blocks and navigation use the same rules as the scaffold, so the preview is the skeleton.
@Component({
  selector: 'aludel-proto-site', standalone: true,
  imports: [FormsModule, NgTemplateOutlet, MatIconModule, CdkDropList, CdkDrag, PageBlocksComponent],
  template: `
  <div class="proto-frame" [class.mobile]="device() === 'mobile'" [style]="tokens()">
    <div class="proto-chrome" aria-hidden="true"><i></i><i></i><i></i><span>{{ address() }}</span></div>
    <div class="proto-app" [class]="'proto-app ' + layoutClass()">
      <header class="proto-header">
        <span class="proto-brand"><span class="proto-mark">{{ initials(appName()) }}</span><span class="proto-name">{{ appName() }}</span></span>
        @if (device() === 'desktop') { <ng-container *ngTemplateOutlet="navTemplate" /> }
        @if (showSignIn()) { <span class="proto-signin">Sign in</span> }
      </header>
      <main class="proto-main">
        @if (mode() === 'look') {
          <i class="proto-title-bar"></i><i class="proto-line"></i>
          <page-blocks [blocks]="blocksFor(sampleType())" [compact]="device() === 'mobile'"></page-blocks>
        } @else if (selected(); as page) {
          @if (isFirst(page) && heroUrl()) { <div class="proto-hero" [style.background-image]="'url(' + heroUrl() + ')'"></div> }
          <h2 class="proto-page-title">{{ page.label }}</h2>
          <label class="visually-hidden" [for]="'desc-' + page.id">Description of {{ page.label }}</label>
          <textarea class="proto-description" [id]="'desc-' + page.id" rows="2" maxlength="1000" [ngModel]="page.description"
            (ngModelChange)="update(page.id, { description: $event })" placeholder="Describe what people do on this page…"></textarea>
          <div class="proto-type">
            <label [for]="'type-' + page.id">Page type</label>
            <select [id]="'type-' + page.id" [ngModel]="page.pageType" (ngModelChange)="update(page.id, { pageType: $event })">
              @for (entry of typeEntries(); track entry.id) { <option [value]="entry.id">{{ entry.label }}</option> }
            </select>
            <span>{{ pageTypes()[page.pageType]?.summary }}</span>
          </div>
          <page-blocks [blocks]="blocksFor(page.pageType)" [compact]="device() === 'mobile'"></page-blocks>
        }
      </main>
      @if (device() === 'mobile') { <div class="proto-tabs"><ng-container *ngTemplateOutlet="navTemplate" /></div> }
    </div>
  </div>

  <ng-template #navTemplate>
    @if (mode() === 'look') {
      <nav class="proto-nav placeholder" aria-hidden="true">@for (item of placeholders(); track $index) { <span class="proto-pill" [class.active]="$first"></span> }</nav>
    } @else {
      <nav class="proto-nav" aria-label="Pages in your app" cdkDropList [cdkDropListOrientation]="orientation()" (cdkDropListDropped)="drop($event)">
        @for (page of routes(); track page.id; let index = $index) {
          <div class="proto-item" cdkDrag [cdkDragData]="page" [cdkDragDisabled]="editingId() === page.id" [class.active]="page.id === selectedId()">
            <button type="button" class="proto-link" (click)="choose(page.id)" [attr.aria-current]="page.id === selectedId() ? 'page' : null">
              <mat-icon aria-hidden="true">{{ page.icon }}</mat-icon><span>{{ page.label }}</span>
            </button>
            @if (page.id === selectedId()) {
              <button type="button" class="proto-edit" (click)="openEditor(page.id)" [attr.aria-expanded]="editingId() === page.id" [attr.aria-label]="'Edit ' + page.label"><mat-icon>edit</mat-icon></button>
            }
            @if (editingId() === page.id) {
              <div class="proto-editor" role="dialog" [attr.aria-label]="'Edit ' + page.label" (keydown.escape)="closeEditor()">
                <label [for]="'label-' + page.id">Name</label>
                <input [id]="'label-' + page.id" class="proto-label-input" maxlength="30" [ngModel]="page.label" (ngModelChange)="update(page.id, { label: $event })" (keydown.enter)="closeEditor()">
                <fieldset class="proto-icons"><legend>Icon</legend>
                  @for (icon of icons(); track icon) {
                    <label [class.selected]="page.icon === icon" [title]="icon"><input type="radio" [name]="'icon-' + page.id" [value]="icon" [checked]="page.icon === icon" (change)="update(page.id, { icon })"><mat-icon aria-hidden="true">{{ icon }}</mat-icon><span class="visually-hidden">{{ icon }}</span></label>
                  }
                </fieldset>
                <div class="proto-editor-actions">
                  <button type="button" (click)="move(index, -1)" [disabled]="index === 0">Move {{ orientation() === 'vertical' ? 'up' : 'left' }}</button>
                  <button type="button" (click)="move(index, 1)" [disabled]="index === routes().length - 1">Move {{ orientation() === 'vertical' ? 'down' : 'right' }}</button>
                  <button type="button" class="danger" (click)="remove(page.id)" [disabled]="routes().length === 1">Delete</button>
                  <button type="button" class="done" (click)="closeEditor()">Done</button>
                </div>
              </div>
            }
          </div>
        }
        @if (routes().length < 5) {
          <button type="button" class="proto-add" (click)="add()"><mat-icon aria-hidden="true">add</mat-icon><span>Add page</span></button>
        }
      </nav>
    }
  </ng-template>`,
  host: { class: 'proto-site' }
})
export class ProtoSiteComponent {
  private readonly element = inject(ElementRef<HTMLElement>);
  readonly feel = input.required<Feel>();
  readonly theme = input<'light' | 'dark' | 'system'>('system');
  readonly accent = input('#3047b9');
  readonly navigation = input<'sidebar' | 'top'>('sidebar');
  readonly device = input<'desktop' | 'mobile'>('desktop');
  readonly mode = input<'look' | 'pages'>('look');
  readonly routes = input<PageRoute[]>([]);
  readonly appName = input('Your app');
  readonly slug = input('your-app');
  readonly heroUrl = input<string | null>(null);
  readonly showSignIn = input(false);
  readonly pageTypes = input<Record<string, PageType>>({});
  readonly icons = input<string[]>([]);
  readonly routesChange = output<PageRoute[]>();
  readonly selectedId = signal('');
  readonly editingId = signal('');
  private readonly prefersDark = signal(typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);

  readonly selected = computed(() => this.routes().find(page => page.id === this.selectedId()) || this.routes()[0] || null);
  readonly placeholders = computed(() => Array.from({ length: Math.max(3, this.feel().seedRoutes.length) }));
  readonly sampleType = computed(() => this.feel().samplePage);
  readonly typeEntries = computed(() => Object.entries(this.pageTypes()).map(([id, value]) => ({ id, label: value.label })));
  // Namespaced: the portal's global stylesheet already owns .sidebar and .top.
  readonly layoutClass = computed(() => this.device() === 'mobile' ? 'nav-mobile' : `nav-${this.navigation()}`);
  readonly orientation = computed(() => this.device() === 'desktop' && this.navigation() === 'sidebar' ? 'vertical' : 'horizontal');
  readonly address = computed(() => `${this.slug()}.localhost`);
  readonly dark = computed(() => this.theme() === 'dark' || (this.theme() === 'system' && this.prefersDark()));
  readonly tokens = computed(() => {
    const feel = this.feel();
    const surface = this.dark() ? feel.surfaceDark : feel.surface;
    const primary = readableAccent(this.accent(), surface);
    return {
      '--p-surface': surface, '--p-ink': this.dark() ? '#eef0f6' : '#171a24', '--p-muted': this.dark() ? '#aab0c0' : '#5b6275',
      '--p-primary': primary, '--p-on-primary': contrastText(primary),
      '--p-container': `color-mix(in srgb, ${this.accent()} ${this.dark() ? '30%, #000' : '16%, #fff'})`,
      '--p-line': this.dark() ? '#ffffff1f' : '#0000001a', '--p-radius': `${feel.radius}px`, '--p-font': feel.font,
      '--blk-radius': `${Math.min(feel.radius, 20)}px`, '--blk-accent': primary, 'color-scheme': this.dark() ? 'dark' : 'light'
    } as Record<string, string>;
  });

  constructor() {
    // Keep a valid selection as pages are added, removed or reseeded.
    effect(() => {
      const routes = this.routes();
      if (routes.length && !routes.some(page => page.id === this.selectedId())) this.selectedId.set(routes[0].id);
    });
  }

  initials(name: string) { return name.split(/\s+/).map(word => word[0] || '').join('').slice(0, 2).toUpperCase() || 'A'; }
  blocksFor(type: string) { return this.pageTypes()[type]?.blocks || []; }
  isFirst(page: PageRoute) { return this.routes()[0]?.id === page.id; }

  choose(id: string) {
    if (this.editingId() && this.editingId() !== id) this.closeEditor();
    this.selectedId.set(id);
  }

  openEditor(id: string, selectText = false) {
    this.editingId.set(this.editingId() === id && !selectText ? '' : id);
    setTimeout(() => {
      const field = this.element.nativeElement.querySelector(`#label-${id}`) as HTMLInputElement | null;
      field?.focus(); if (selectText) field?.select();
    });
  }

  closeEditor() {
    const id = this.editingId();
    this.editingId.set('');
    // An emptied name falls back to something valid rather than blocking the save.
    const page = this.routes().find(item => item.id === id);
    if (page && !page.label.trim()) this.update(id, { label: 'Untitled' });
    setTimeout(() => (this.element.nativeElement.querySelector('.proto-item.active .proto-link') as HTMLElement | null)?.focus());
  }

  update(id: string, changes: Partial<PageRoute>) {
    this.routesChange.emit(this.routes().map(page => page.id === id ? { ...page, ...changes } : page));
  }

  add() {
    const names = new Set(this.routes().map(page => page.label.toLowerCase()));
    let label = 'New page';
    for (let index = 2; names.has(label.toLowerCase()); index++) label = `New page ${index}`;
    const page: PageRoute = { id: `page-${Math.random().toString(16).slice(2, 10)}`, label, icon: 'home', pageType: 'list', description: '' };
    this.routesChange.emit([...this.routes(), page]);
    this.selectedId.set(page.id);
    this.openEditor(page.id, true);
  }

  remove(id: string) {
    if (this.routes().length === 1) return;
    const index = this.routes().findIndex(page => page.id === id);
    const next = this.routes().filter(page => page.id !== id);
    this.editingId.set('');
    this.selectedId.set(next[Math.max(0, index - 1)].id);
    this.routesChange.emit(next);
  }

  move(index: number, offset: number) {
    const next = [...this.routes()];
    moveItemInArray(next, index, index + offset);
    this.routesChange.emit(next);
    setTimeout(() => (this.element.nativeElement.querySelector('.proto-editor .done') as HTMLElement | null)?.focus());
  }

  drop(event: CdkDragDrop<PageRoute[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const next = [...this.routes()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.routesChange.emit(next);
  }
}
