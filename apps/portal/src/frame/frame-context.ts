// LAYER-BASE-01 B6: a layer's own views run in a sandboxed frame on a separate origin. They use the portal's own
// ProjectContext, with its network access, navigation and messages carried to the portal page over postMessage. The
// portal decides which of those calls a layer frame may make; the frame itself has no network and no portal session.
import { Injectable, effect, signal } from '@angular/core';
import { ProjectContext } from '../layers/context';

type Pending = { resolve: (value: unknown) => void; reject: (error: unknown) => void };

@Injectable()
export class FrameProjectContext extends ProjectContext {
  private readonly pending = new Map<number, Pending>();
  private readonly assets = signal<Record<string, string>>({});
  private readonly requested = new Set<string>();
  private nextCall = 1;
  readonly ready = signal(false);

  constructor() {
    super();
    window.addEventListener('message', event => {
      if (event.source !== window.parent) return;
      const message = event.data || {};
      if (message.type === 'init') {
        this.session.set(message.session);
        this.path.set(message.path);
        document.documentElement.style.setProperty('--aludel-vh', `${message.viewport}px`);
        void this.reload().then(() => this.ready.set(true));
      } else if (message.type === 'route') this.path.set(message.path);
      else if (message.type === 'viewport') document.documentElement.style.setProperty('--aludel-vh', `${message.viewport}px`);
      else if (message.type === 'refresh') void this.reload();
      else if (message.type === 'result') {
        const call = this.pending.get(message.id);
        if (!call) return;
        this.pending.delete(message.id);
        if (message.ok) call.resolve(message.value);
        else call.reject(Object.assign(new Error(message.error || 'Something went wrong. Please try again.'), { status: message.status }));
      } else if (message.type === 'asset') {
        this.assets.update(map => ({ ...map, [message.assetId]: message.blob ? URL.createObjectURL(message.blob) : '' }));
      }
    });
    // The portal shows notices, errors and unsaved-tab marks in its own chrome.
    effect(() => this.post({ type: 'status', notice: this.notice(), error: this.error(), dirty: this.dirtyTabs() }));
    new ResizeObserver(() => this.post({ type: 'height', height: Math.ceil(document.documentElement.getBoundingClientRect().height) })).observe(document.documentElement);
    this.post({ type: 'ready' });
  }

  private post(message: unknown) { window.parent.postMessage(message, '*'); }

  override async api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const id = this.nextCall++;
    const result = new Promise<unknown>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.post({ type: 'api', id, path, method, body });
    return result as Promise<T>;
  }

  override go(path: string, event?: Event) {
    event?.preventDefault();
    this.post({ type: 'navigate', path });
  }

  // Images come from the portal as blobs; the frame cannot reach the portal itself.
  override uploadUrl(assetId: string | null | undefined) {
    if (!assetId) return '';
    const known = this.assets()[assetId];
    if (known === undefined && !this.requested.has(assetId)) { this.requested.add(assetId); this.post({ type: 'asset', assetId }); }
    return known || '';
  }
}
