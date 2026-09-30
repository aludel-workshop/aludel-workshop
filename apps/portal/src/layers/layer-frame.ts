import { Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ProjectContext } from './context';

type Frame = { status: 'ready' | 'building' | 'failed' | 'none'; url?: string; error?: string; commit?: string };

// LAYER-BASE-01 B6: a layer's own views, built from its repository, in a sandboxed frame on the layers origin. This side
// carries the frame's messages: project reads, this layer's writes and navigation, with the person's session. The server
// refuses anything else a frame asks for (x-aludel-layer-frame). The frame is as tall as its content, and its viewport
// units follow this page's viewport, so the layer lays out and scrolls as it would in the portal.
@Component({
  selector: 'aludel-layer-frame', standalone: true,
  template: `
  @switch (frame()?.status) {
    @case ('ready') { <iframe #view class="lay-frame-view" [src]="src()" sandbox="allow-scripts allow-forms allow-same-origin" [title]="title()" [style.height.px]="height()"></iframe> }
    @case ('failed') { <p class="lay-banner-warn" role="alert">{{ title() }} could not be built from its repository: {{ frame()?.error }}</p> }
    @default { <p class="lay-muted" role="status">Preparing {{ title() }}…</p> }
  }`,
  host: { class: 'lay-frame-host' }
})
export class LayerFrameComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly frame = signal<Frame | null>(null);
  readonly height = signal(window.innerHeight);
  private readonly view = viewChild<ElementRef<HTMLIFrameElement>>('view');
  private readonly sanitizer = inject(DomSanitizer);
  // Only the URL the server returned for this layer's pinned build is framed.
  readonly src = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.frame()?.url || 'about:blank'));
  readonly title = computed(() => `${this.ctx.layerInstances().find(layer => layer.key === this.layerKey())?.name || this.layerKey()} views`);
  private poll: ReturnType<typeof setTimeout> | null = null;
  private readonly lastStatus = { notice: '', error: '' };
  private echoes = 0;
  private loaded = '';

  constructor() {
    effect(() => { const key = `${this.ctx.projectId()}/${this.layerKey()}`; untracked(() => { if (key !== this.loaded) { this.loaded = key; void this.load(); } }); });
    effect(() => { const path = this.ctx.path(); untracked(() => this.post({ type: 'route', path })); });
    // When the portal reloads the project for its own reasons, the frame reloads its copy too. A reload that follows the
    // frame's own write is not echoed back: the frame already reloaded, and a second reload would re-render under the person.
    effect(() => { this.ctx.data(); untracked(() => { if (this.echoes > 0) this.echoes--; else this.post({ type: 'refresh' }); }); });
    inject(DestroyRef).onDestroy(() => { if (this.poll) clearTimeout(this.poll); });
  }

  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}`; }
  private async load() {
    if (this.poll) clearTimeout(this.poll);
    if (!this.ctx.projectId()) return;
    const value = await this.ctx.api<Frame>(`${this.base()}/layers/${encodeURIComponent(this.layerKey())}/ui`).catch(error => ({ status: 'failed', error: error.message } as Frame));
    this.frame.set(value);
    if (value.status === 'building') this.poll = setTimeout(() => void this.load(), 1000);
  }
  // Messages go only to the origin this layer's views were served from, and only its messages are accepted: a frame that
  // navigated elsewhere receives nothing.
  private origin() { try { return new URL(this.frame()?.url || '').origin; } catch { return ''; } }
  private post(message: unknown) { const origin = this.origin(); if (origin) this.view()?.nativeElement.contentWindow?.postMessage(message, origin); }

  @HostListener('window:resize')
  resized() { this.post({ type: 'viewport', viewport: window.innerHeight }); }

  @HostListener('window:message', ['$event'])
  async message(event: MessageEvent) {
    const frame = this.view()?.nativeElement.contentWindow;
    if (!frame || event.source !== frame || event.origin !== this.origin()) return;
    const message = event.data || {};
    if (message.type === 'ready') this.post({ type: 'init', session: this.ctx.session(), path: this.ctx.path(), viewport: window.innerHeight });
    else if (message.type === 'height' && Number.isFinite(message.height)) this.height.set(Math.max(120, Math.min(message.height, 100000)));
    else if (message.type === 'navigate' && typeof message.path === 'string' && message.path.startsWith(`/p/${encodeURIComponent(this.ctx.slug())}`)) this.ctx.go(message.path);
    else if (message.type === 'status') {
      // The frame's notice and error mirror into the portal's chrome whenever the frame changes them, including clearing them.
      const notice = String(message.notice || '').slice(0, 500), error = String(message.error || '').slice(0, 500);
      if (notice !== this.lastStatus.notice) { this.lastStatus.notice = notice; this.ctx.notice.set(notice); }
      if (error !== this.lastStatus.error) { this.lastStatus.error = error; this.ctx.error.set(error); }
      const own = Object.fromEntries(Object.entries(message.dirty || {}).filter(([tab]) => tab.startsWith(`${this.layerKey()}/`)).map(([tab, dirty]) => [tab, Boolean(dirty)]));
      this.ctx.dirtyTabs.update(tabs => ({ ...Object.fromEntries(Object.entries(tabs).filter(([tab]) => !tab.startsWith(`${this.layerKey()}/`))), ...own }));
    } else if (message.type === 'asset' && typeof message.assetId === 'string') {
      const response = await fetch(this.ctx.uploadUrl(message.assetId), { headers: { 'x-aludel-layer-frame': this.layerKey() } }).catch(() => null);
      this.post({ type: 'asset', assetId: message.assetId, blob: response?.ok ? await response.blob() : null });
    } else if (message.type === 'api' && Number.isInteger(message.id) && typeof message.path === 'string') {
      const method = ['GET', 'POST', 'PUT', 'DELETE'].includes(message.method) ? message.method : 'GET';
      try {
        if (!message.path.startsWith(this.base() + '/')) throw new Error('A layer view can reach only this project.');
        const response = await fetch(message.path, { method, headers: { 'content-type': 'application/json', 'x-aludel-layer-frame': this.layerKey() },
          body: message.body === undefined || method === 'GET' ? undefined : JSON.stringify(message.body) });
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw Object.assign(new Error(value.error || 'Something went wrong. Please try again.'), { status: response.status });
        this.post({ type: 'result', id: message.id, ok: true, value });
        // Changes the layer makes also reach the rest of the portal (counts, other layers).
        if (method !== 'GET') { this.echoes++; void this.ctx.reload().catch(() => { this.echoes = Math.max(0, this.echoes - 1); }); }
      } catch (error) {
        this.post({ type: 'result', id: message.id, ok: false, error: error instanceof Error ? error.message : String(error), status: (error as { status?: number }).status });
      }
    }
  }
}
