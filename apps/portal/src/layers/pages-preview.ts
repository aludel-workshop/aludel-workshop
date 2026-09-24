import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { Page, PageSection, ProjectContext } from './context';
import { PageRenderComponent } from './pages-render';
import { PagesState, SpecDraft } from './pages-model';

export interface Pick { type: 'sec' | 'content' | 'shell'; id: string; }
export interface Inventory { path: string; page: string | null; sections: { id: string; skeleton: boolean; box: Box }[]; }
interface Box { x: number; y: number; w: number; h: number; }
interface Outline { box: Box; label: string; icon: string; kind: string; }

// The page itself, as Spec (drawn from the spec) or Built (the running preview in a frame). Hovering outlines what is under
// the pointer and names it; clicking selects it. With editing on, text and images are content and change in place.
// Built talks to the bridge the scaffold puts in every app (src/aludel-bridge.ts), which answers only this portal.
@Component({
  selector: 'aludel-page-preview', standalone: true,
  imports: [MatIconModule, PageRenderComponent],
  template: `
  <div class="lay-pg-stage" #stage tabindex="0" role="region" [attr.aria-label]="page().label + ' preview'" (mouseover)="hoverSpec($event)" (mouseleave)="hover.set(null)" (click)="clickSpec($event)" (focusout)="blurContent($event)" (scroll)="measure()">
    <div class="lay-pg-frame" [class.lay-pg-framephone]="phone()" [class.lay-pg-editing]="editing()" #frame>
      @if (mode() === 'built') {
        <div class="lay-pg-url"><mat-icon aria-hidden="true">lock</mat-icon><span>{{ builtUrl() || 'No preview address' }}</span>@if (inventory(); as inv) { <small>{{ inv.sections.length }} sections found</small> }</div>
        @if (src(); as url) { <iframe [src]="url" [title]="page().label + ' in the running app'" #iframe (load)="framed()"></iframe> }
        @if (silent()) { <div class="lay-pg-silent"><mat-icon aria-hidden="true">cloud_off</mat-icon><strong>The preview didn’t answer</strong><span>It may not be built yet, or it was built before Pages could point into it. Update the preview to rebuild the app from its specs.</span></div> }
      } @else {
        <div class="lay-pg-specbar"><mat-icon aria-hidden="true">edit_document</mat-icon>{{ draft() ? 'Spec draft' : 'Spec · revision ' + page().revision }} · the project’s components and theme</div>
        <aludel-page-render [page]="page()" [draft]="draft()" [view]="view()" [viewer]="viewer()" [phone]="phone()" [editing]="editing()" />
      }
    </div>
    @if (hover(); as o) { <div class="lay-pg-ov" [class]="'lay-pg-ov lay-pg-ov-' + o.kind" [style.left.px]="o.box.x" [style.top.px]="o.box.y" [style.width.px]="o.box.w" [style.height.px]="o.box.h"><span class="lay-pg-tag" [class.lay-pg-below]="o.box.y < 22"><mat-icon aria-hidden="true">{{ o.icon }}</mat-icon>{{ o.label }}</span></div> }
    @if (chosen(); as o) { <div class="lay-pg-ov lay-pg-ov-sel" [class.lay-pg-ov-ct]="o.kind === 'ct'" [style.left.px]="o.box.x" [style.top.px]="o.box.y" [style.width.px]="o.box.w" [style.height.px]="o.box.h"><span class="lay-pg-tag" [class.lay-pg-below]="o.box.y < 22"><mat-icon aria-hidden="true">{{ o.icon }}</mat-icon>{{ o.label }}</span></div> }
  </div>`,
  host: { class: 'lay-pg-preview' }
})
export class PagePreviewComponent {
  readonly ctx = inject(ProjectContext);
  readonly state = inject(PagesState);
  private readonly sanitizer = inject(DomSanitizer);
  readonly page = input.required<Page>();
  readonly draft = input<SpecDraft | null>(null);
  readonly mode = input<'spec' | 'built'>('spec');
  readonly view = input('ready');
  readonly viewer = input('visitor');
  readonly phone = input(false);
  readonly editing = input(false);
  readonly selected = input<Pick | null>(null);
  readonly picked = output<Pick>();
  readonly content = output<{ key: string; value: string }>();
  readonly found = output<Inventory | null>();
  readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  readonly iframe = viewChild<ElementRef<HTMLIFrameElement>>('iframe');
  readonly hover = signal<Outline | null>(null);
  readonly chosen = signal<Outline | null>(null);
  readonly inventory = signal<Inventory | null>(null);
  readonly silent = signal(false);
  private builtHover: { id: string; box: Box } | null = null;
  private waiting: ReturnType<typeof setTimeout> | null = null;

  readonly sections = computed(() => (this.draft() || this.page()).sections);
  readonly builtUrl = computed(() => { const path = this.ctx.data()?.pagePaths?.[this.page().id], app = this.ctx.setup()?.urls?.app; return app && path ? app.replace(/\/$/, '') + path : ''; });
  // The frame's address changes only with the page, so moving around the app inside it isn't undone by a redraw.
  readonly src = computed(() => this.mode() === 'built' && this.builtUrl() ? this.sanitizer.bypassSecurityTrustResourceUrl(this.builtUrl()) : null);

  constructor() {
    const listener = (event: MessageEvent) => this.message(event);
    window.addEventListener('message', listener);
    const resize = () => this.measure();
    window.addEventListener('resize', resize);
    inject(DestroyRef).onDestroy(() => { window.removeEventListener('message', listener); window.removeEventListener('resize', resize); if (this.waiting) clearTimeout(this.waiting); });
    // Redraw the selection outline after anything that moves it.
    effect(() => { this.selected(); this.page(); this.draft(); this.view(); this.viewer(); this.phone(); this.editing(); this.mode(); this.inventory(); requestAnimationFrame(() => this.measure()); });
    effect(() => { if (this.mode() !== 'built') { this.inventory.set(null); this.silent.set(false); this.found.emit(null); } });
  }

  // ---- Spec: the DOM is ours ----
  private target(node: EventTarget | null): HTMLElement | null {
    if (!(node instanceof HTMLElement) || this.mode() !== 'spec') return null;
    if (this.editing()) { const content = node.closest<HTMLElement>('[data-ct]'); if (content) return content; }
    return node.closest<HTMLElement>('[data-sec]');
  }
  private outlineFor(element: HTMLElement): Outline | null {
    const stage = this.stage()?.nativeElement; if (!stage) return null;
    const r = element.getBoundingClientRect(), s = stage.getBoundingClientRect();
    const box = { x: r.left - s.left + stage.scrollLeft - 3, y: r.top - s.top + stage.scrollTop - 3, w: r.width + 6, h: r.height + 6 };
    if (element.dataset['ct']) { const [, field] = element.dataset['ct'].split(':'); return { box, label: field === 'image' ? 'Image' : field === 'description' ? 'Page description' : ({ title: 'Heading', body: 'Text', action: 'Button label' } as Record<string, string>)[field] || 'Text', icon: field === 'image' ? 'image' : 'text_fields', kind: 'ct' }; }
    return this.describe(element.dataset['sec'] || '', box);
  }
  private describe(id: string, box: Box, skeleton = false): Outline {
    if (id === '__shell') return { box, label: 'App shell · shared by every page', icon: 'dock_to_bottom', kind: 'sec' };
    if (id === '__blocks') return { box, label: `Page type blocks · add sections to specify it`, icon: 'dashboard', kind: 'sec' };
    if (id === '__state') return { box, label: 'State', icon: 'layers', kind: 'sec' };
    const s = this.sections().find(entry => entry.id === id);
    if (!s) return { box, label: 'Not in the spec', icon: 'help', kind: 'sec' };
    const parts = [s.name, this.state.name(s.component), ...s.stories.map(story => this.ctx.storyById().get(story)?.ref || '').filter(Boolean)];
    if (skeleton) parts.push('skeleton');
    return { box, label: parts.join(' · '), icon: 'view_agenda', kind: 'sec' };
  }
  hoverSpec(event: MouseEvent) {
    if (this.mode() !== 'spec') return;
    const element = this.target(event.target);
    const sel = this.selected();
    if (!element || (sel && ((sel.type === 'content' && element.dataset['ct'] === sel.id) || (sel.type !== 'content' && element.dataset['sec'] === sel.id)))) { this.hover.set(null); return; }
    this.hover.set(this.outlineFor(element));
  }
  clickSpec(event: MouseEvent) {
    const element = this.target(event.target); if (!element) return;
    event.preventDefault();
    if (element.dataset['ct']) {
      this.picked.emit({ type: 'content', id: element.dataset['ct'] });
      if (!element.dataset['ct'].endsWith(':image')) { element.contentEditable = 'plaintext-only'; element.focus(); }
    } else {
      const id = element.dataset['sec'] || '';
      this.picked.emit({ type: id === '__shell' ? 'shell' : 'sec', id });
    }
    this.hover.set(null);
  }
  blurContent(event: FocusEvent) {
    const element = event.target instanceof HTMLElement ? event.target : null;
    if (!element?.dataset['ct'] || element.contentEditable !== 'plaintext-only') return;
    element.contentEditable = 'false';
    this.content.emit({ key: element.dataset['ct'], value: (element.textContent || '').trim() });
  }
  measure() {
    const sel = this.selected(); if (!sel) { this.chosen.set(null); return; }
    if (this.mode() === 'built') {
      const found = this.inventory()?.sections.find(entry => entry.id === sel.id);
      this.chosen.set(found ? this.builtOutline(found.id, found.box, found.skeleton) : null);
      return;
    }
    const frame = this.stage()?.nativeElement; if (!frame) return;
    const element = frame.querySelector<HTMLElement>(sel.type === 'content' ? `[data-ct="${sel.id}"]` : `[data-sec="${sel.id}"]`);
    const outline = element ? this.outlineFor(element) : null;
    this.chosen.set(outline ? { ...outline, kind: sel.type === 'content' ? 'ct' : 'sel' } : null);
  }

  // ---- Built: the running app, through its bridge ----
  framed() {
    this.inventory.set(null); this.silent.set(false);
    this.send({ type: 'inspect', on: true });
    if (this.waiting) clearTimeout(this.waiting);
    this.waiting = setTimeout(() => { if (!this.inventory()) this.silent.set(true); }, 2500);
  }
  private send(message: Record<string, unknown>) {
    const origin = this.state.appOrigin(); const target = this.iframe()?.nativeElement.contentWindow;
    if (origin && target) target.postMessage({ aludel: 1, ...message }, origin);
  }
  private message(event: MessageEvent) {
    const frame = this.iframe()?.nativeElement;
    if (!frame || event.source !== frame.contentWindow || event.origin !== this.state.appOrigin() || event.data?.aludel !== 1) return;
    const data = event.data;
    if (data.type === 'ready') { this.send({ type: 'inspect', on: true }); return; }
    if (data.type === 'inventory') {
      const inventory: Inventory = { path: String(data.path || ''), page: data.page || null, sections: (Array.isArray(data.sections) ? data.sections : []).filter((entry: { id?: unknown }) => typeof entry?.id === 'string') };
      this.inventory.set(inventory); this.silent.set(false); this.found.emit(inventory);
      if (this.builtHover) { const again = inventory.sections.find(entry => entry.id === this.builtHover?.id); if (again) this.hover.set(this.builtOutline(again.id, again.box, again.skeleton)); }
      return;
    }
    if (data.type === 'hover') {
      this.builtHover = data.id ? { id: data.id, box: data.box } : null;
      const skeleton = this.inventory()?.sections.find(entry => entry.id === data.id)?.skeleton || false;
      this.hover.set(data.id && data.box && data.id !== this.selected()?.id ? this.builtOutline(data.id, data.box, skeleton) : null);
      return;
    }
    if (data.type === 'select' && typeof data.id === 'string') { this.picked.emit({ type: 'sec', id: data.id }); this.hover.set(null); }
  }
  private builtOutline(id: string, box: Box, skeleton: boolean): Outline {
    const stage = this.stage()?.nativeElement, frame = this.iframe()?.nativeElement;
    if (!stage || !frame) return this.describe(id, box, skeleton);
    const f = frame.getBoundingClientRect(), s = stage.getBoundingClientRect();
    return { ...this.describe(id, { x: f.left - s.left + stage.scrollLeft + box.x - 3, y: f.top - s.top + stage.scrollTop + box.y - 3, w: box.w + 6, h: box.h + 6 }, skeleton), kind: 'sec' };
  }
  sectionName(section: PageSection) { return section.name; }
}
