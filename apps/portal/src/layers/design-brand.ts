import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BrandAsset, ProjectContext } from './context';
import { DesignState, ThemeScopeDirective } from './design-state';

const keyLabel: Record<string, string> = { name: "The app's name", tagline: "The app's tagline", description: "The app's description", mark: "The app's mark" };
export const brandIcons = [{ icon: 'mail' }, { icon: 'campaign' }, { icon: 'rocket_launch' }, { icon: 'upload' }, { icon: 'library_add' }, { icon: 'add_photo_alternate' }, { icon: 'title' }, { icon: 'download' }, { icon: 'code' }, { icon: 'verified' }, { icon: 'wallpaper' }, { icon: 'badge' }];

// Brand (DESIGN-UX-01 D17): starter assets already used in the app, never required fields. Where each is used is read from the code.
@Component({
  selector: 'aludel-design-brand', standalone: true,
  imports: [NgTemplateOutlet, FormsModule, MatIconModule, ThemeScopeDirective],
  template: `
  <div class="lay-row lay-wrap lay-ds-brandbar">
    <p class="lay-muted small lay-flat">Starter assets are already used in the app. Change them, delete them or add your own. Where each is used comes from the code.</p>
    <span class="lay-push"></span>
    <div class="lay-ds-menuwrap"><button type="button" class="lay-button ghost small" (click)="menu.set(menu() === 'templates' ? '' : 'templates')" [attr.aria-expanded]="menu() === 'templates'"><mat-icon aria-hidden="true">library_add</mat-icon>Add from a template</button>
      @if (menu() === 'templates') { <div class="lay-ds-menu">@for (entry of templates(); track entry[0]) { <button type="button" (click)="addTemplate(entry[0])"><mat-icon aria-hidden="true">{{ entry[1].icon }}</mat-icon><span><strong>{{ entry[1].label }}</strong><small>{{ entry[1].summary }} Adds {{ entry[1].assets }} stock assets you can change or delete.</small></span></button> }</div> }</div>
    <div class="lay-ds-menuwrap"><button type="button" class="lay-button small" (click)="menu.set(menu() === 'add' ? '' : 'add')" [attr.aria-expanded]="menu() === 'add'"><mat-icon aria-hidden="true">add</mat-icon>Add asset</button>
      @if (menu() === 'add') { <div class="lay-ds-menu">
        <label class="lay-ds-menuitem"><mat-icon aria-hidden="true">upload</mat-icon><span><strong>Upload an image</strong><small>PNG, JPEG or WebP, up to 8 MB.</small></span><input type="file" accept="image/png,image/jpeg,image/webp" class="visually-hidden" (change)="upload($event)"></label>
        <button type="button" (click)="addText()"><mat-icon aria-hidden="true">title</mat-icon><span><strong>Text</strong><small>A slogan, a bio, boilerplate.</small></span></button>
        <button type="button" (click)="addMark()"><mat-icon aria-hidden="true">badge</mat-icon><span><strong>Monogram mark</strong><small>Letters on a colour role.</small></span></button>
        <button type="button" (click)="addBanner()"><mat-icon aria-hidden="true">wallpaper</mat-icon><span><strong>Banner</strong><small>The mark, a headline and your colours at any size.</small></span></button>
      </div> }</div>
  </div>
  <div class="lay-ds-bgrid">
    @for (asset of assets(); track asset.id) {
      <a class="lay-ds-asset" [href]="ctx.link('design', 'brand', asset.id)" (click)="open(asset.id, $event)">
        <span class="lay-ds-pvw" [aludelTheme]="ds.vars()"><ng-container *ngTemplateOutlet="preview; context: { $implicit: asset, big: false }" /></span>
        <span class="lay-ds-inf"><strong>{{ asset.name }}</strong>
          <span class="lay-row lay-wrap"><span class="lay-chip lay-plain">{{ typeLabel[asset.type] }}</span>@if (asset.starter) { <span class="lay-chip lay-l-design">Starter</span> }@if (asset.key) { <span class="lay-chip lay-l-pages">{{ keyLabel[asset.key] }}</span> }</span>
          <small class="lay-muted">{{ usedCount(asset) }}</small></span></a>
    } @empty { <p class="lay-muted">No brand assets. Add one, or start from a template.</p> }
  </div>

  <ng-template #preview let-a let-big="big">
    @switch (a.type) {
      @case ('mark') { <img [src]="ds.svgUrl(ds.mark(a.mark, big ? 160 : 72))" [alt]="a.name"> }
      @case ('banner') { <img class="lay-ds-bannerimg" [src]="ds.svgUrl(ds.banner(a.banner, markAsset()?.mark))" [alt]="a.name"> }
      @case ('image') { <img class="lay-ds-upimg" [src]="ctx.uploadUrl(a.assetId)" [alt]="a.name"> }
      @default { <span class="lay-ds-btext" [class.lay-ds-big]="big" [style.font]="a.key === 'description' || a.text.length > 80 ? 'var(--mat-sys-body-large)' : 'var(--mat-sys-headline-small)'">{{ a.text }}</span> }
    }
  </ng-template>

  @if (selected(); as a) {
    <div class="lay-scrim" (click)="close()"></div>
    <aside class="lay-drawer lay-ds-drawer" aria-labelledby="ds-asset-title">
      <button type="button" class="lay-drawer-close" (click)="close()" aria-label="Close"><mat-icon aria-hidden="true">close</mat-icon></button>
      <div class="lay-row lay-wrap"><span class="lay-chip lay-plain">{{ typeLabel[a.type] }}</span>@if (a.starter) { <span class="lay-chip lay-l-design">Starter</span> }@if (a.template) { <span class="lay-chip lay-plain">from a template</span> }</div>
      <h2 class="lay-drawer-title" id="ds-asset-title">{{ a.name }}</h2>
      <div class="lay-ds-bigpvw" [aludelTheme]="ds.vars()"><ng-container *ngTemplateOutlet="preview; context: { $implicit: a, big: true }" /></div>
      @if (draft(); as d) {
        <form class="lay-ds-form" (ngSubmit)="save(a)">
          <label>Name<input name="name" [(ngModel)]="d.name" maxlength="80"></label>
          @switch (a.type) {
            @case ('text') { <label>Text<textarea name="text" rows="3" [(ngModel)]="d.text" maxlength="2000"></textarea></label> }
            @case ('mark') { <div class="lay-ds-grid3"><label>Letters<input name="mt" [(ngModel)]="d.markText" maxlength="3"></label>
              <label>Background<select name="mb" [(ngModel)]="d.markBackground">@for (r of roles(); track r) { <option [value]="r">{{ r }}</option> }</select></label>
              <label>Letters colour<select name="mf" [(ngModel)]="d.markForeground">@for (r of roles(); track r) { <option [value]="r">{{ r }}</option> }</select></label></div> }
            @case ('banner') { <div class="lay-ds-grid3"><label>Width<input name="bw" type="number" min="100" max="4000" [(ngModel)]="d.width"></label><label>Height<input name="bh" type="number" min="100" max="4000" [(ngModel)]="d.height"></label>
              <label>Background<select name="bb" [(ngModel)]="d.background">@for (r of fillRoles(); track r) { <option [value]="r">{{ r }}</option> }</select></label></div>
              <label>Headline<input name="bhl" [(ngModel)]="d.headline" maxlength="120"></label><label>Subline<input name="bsl" [(ngModel)]="d.subline" maxlength="160"></label> }
            @case ('image') { <label class="lay-button ghost small lay-ds-filebtn"><mat-icon aria-hidden="true">upload</mat-icon>Replace image<input type="file" accept="image/png,image/jpeg,image/webp" class="visually-hidden" (change)="replace(a, $event)"></label> }
          }
          <label>Used by the app as <select name="key" [(ngModel)]="d.key"><option value="">Nothing (an asset to use as you like)</option>@for (k of keysFor(a); track k) { <option [value]="k">{{ keyLabel[k] }}</option> }</select></label>
          <label>Notes<textarea name="notes" rows="2" [(ngModel)]="d.notes" maxlength="1000" placeholder="How to use it, clear space, where not to put it"></textarea></label>
          <div class="lay-row"><button type="submit" class="lay-button small">Save</button>
            @if (a.type === 'mark' || a.type === 'banner') { <a class="lay-button ghost small" [href]="download(a)" [download]="fileName(a) + '.svg'"><mat-icon aria-hidden="true">download</mat-icon>SVG</a> }
            @if (a.type === 'image') { <a class="lay-button ghost small" [href]="ctx.uploadUrl(a.assetId)" target="_blank" rel="noopener"><mat-icon aria-hidden="true">download</mat-icon>Open</a> }
            <button type="button" class="lay-link-button danger lay-push" (click)="remove(a)">Delete</button></div>
        </form>
      }
      @if (a.type === 'mark' || (a.type === 'image' && a.key === 'mark')) {
        <h3>In context</h3>
        <div class="lay-ds-ctx" [aludelTheme]="ds.vars()">
          <div class="lay-ds-ctxb"><small>App bar</small><div class="lay-ds-ctxarea lay-ds-ctxbar"><ng-container *ngTemplateOutlet="tiny; context: { $implicit: a, size: 28 }" /><strong>{{ appName() }}</strong></div></div>
          <div class="lay-ds-ctxb"><small>Browser tab</small><div class="lay-ds-ctxarea lay-ds-tab"><span><ng-container *ngTemplateOutlet="tiny; context: { $implicit: a, size: 16 }" />{{ appName() }}</span></div></div>
          <div class="lay-ds-ctxb"><small>Phone home screen</small><div class="lay-ds-ctxarea lay-ds-home"><span class="lay-ds-app1"></span><span class="lay-ds-app2"></span><span><ng-container *ngTemplateOutlet="tiny; context: { $implicit: a, size: 44 }" /><small>{{ appName() }}</small></span><span class="lay-ds-app3"></span></div></div>
        </div>
      }
      @if (a.type === 'banner') {
        <h3>In context</h3>
        <div class="lay-ds-ctxb"><small>Link preview</small><div class="lay-ds-link"><img [src]="ds.svgUrl(ds.banner(a.banner!, markAsset()?.mark))" alt=""><span><strong>{{ appName() }}</strong><small>{{ description() }}</small></span></div></div>
      }
      <h3>Used in <small class="lay-muted">from the code</small></h3>
      @for (use of usage(a); track use.path + use.line) { <div class="lay-ds-use"><mat-icon aria-hidden="true">code</mat-icon><code>{{ use.path }}:{{ use.line }}</code></div> }
      @empty { <p class="lay-muted small">{{ built() ? 'Nothing in the code refers to it yet.' : 'Build the app to see where it is used.' }}</p> }
      <h3>Revisions</h3>
      @for (entry of a.history; track entry.revision) { <div class="lay-ds-rev" [class.lay-ds-cur]="entry.revision === a.revision"><span>r{{ entry.revision }}</span><div><strong>{{ entry.rationale }}</strong><small>{{ entry.author }} · {{ entry.createdAt.slice(0, 10) }}</small></div></div> }
    </aside>
  }
  <ng-template #tiny let-a let-size="size">
    @if (a.type === 'image') { <img [src]="ctx.uploadUrl(a.assetId)" alt="" [style.width.px]="size" [style.height.px]="size" class="lay-ds-tinyimg"> }
    @else { <img [src]="ds.svgUrl(ds.mark(a.mark, size))" alt="" [style.width.px]="size" [style.height.px]="size"> }
  </ng-template>`,
  host: { class: 'lay-ds-brand' }
})
export class DesignBrandComponent {
  readonly ctx = inject(ProjectContext);
  readonly ds = inject(DesignState);
  readonly keyLabel = keyLabel;
  readonly typeLabel: Record<string, string> = { image: 'Image', text: 'Text', mark: 'Mark · SVG', banner: 'Banner · SVG' };
  readonly menu = signal('');
  readonly assets = computed(() => this.ctx.data()?.brand || []);
  readonly selected = computed(() => { const id = this.ctx.segments()[2]; return id ? this.assets().find(asset => asset.id === id) || null : null; });
  readonly markAsset = computed(() => this.assets().find(asset => asset.type === 'mark') || null);
  readonly appName = computed(() => this.assets().find(asset => asset.key === 'name')?.text || this.ctx.setup()?.project?.name || 'App');
  readonly description = computed(() => this.assets().find(asset => asset.key === 'description')?.text || '');
  readonly templates = computed(() => Object.entries(this.ctx.catalog()?.brandTemplates || {}));
  readonly roles = computed(() => (this.ds.tokens()?.roles || []).map(role => role.id));
  readonly fillRoles = computed(() => this.roles().filter(role => this.roles().includes(`on-${role}`)));
  readonly built = computed(() => Boolean(this.ctx.setup()?.completedSteps?.includes('build')));
  readonly draft = signal<{ name: string; text: string; key: string; notes: string; markText: string; markBackground: string; markForeground: string; width: number; height: number; headline: string; subline: string; background: string } | null>(null);
  private draftFor = '';

  constructor() {
    // Load the form when a different asset (or a new revision) opens, however it was opened.
    effect(() => { this.selected(); untracked(() => this.sync()); });
  }
  private sync() {
    const a = this.selected();
    if (a && `${a.id}:${a.revision}` !== this.draftFor) {
      this.draftFor = `${a.id}:${a.revision}`;
      this.draft.set({ name: a.name, text: a.text, key: a.key || '', notes: a.notes, markText: a.mark?.text || '', markBackground: a.mark?.background || 'primary', markForeground: a.mark?.foreground || 'on-primary',
        width: a.banner?.width || 1200, height: a.banner?.height || 630, headline: a.banner?.headline || '', subline: a.banner?.subline || '', background: a.banner?.background || 'primary' });
    }
    if (!a) { this.draftFor = ''; this.draft.set(null); }
  }
  open(id: string, event?: Event) { event?.preventDefault(); const link = this.ctx.link('design', 'brand', id); history.pushState({}, '', link); this.ctx.path.set(link); this.menu.set(''); this.sync(); }
  close() { const link = this.ctx.link('design', 'brand'); history.pushState({}, '', link); this.ctx.path.set(link); this.sync(); }
  keysFor(a: BrandAsset) { return a.type === 'text' ? ['name', 'tagline', 'description'] : a.type === 'mark' || a.type === 'image' ? ['mark'] : []; }
  usage(a: BrandAsset) { return this.ctx.data()?.brandUsage?.[a.id] || []; }
  usedCount(a: BrandAsset) { const n = this.usage(a).length; return n ? `Used in ${n} place${n === 1 ? '' : 's'}` : this.built() ? 'Not used in the code yet' : 'Used once the app is built'; }
  fileName(a: BrandAsset) { return a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'asset'; }
  download(a: BrandAsset) { return this.ds.svgUrl(a.type === 'mark' ? this.ds.mark(a.mark, 512) : this.ds.banner(a.banner!, this.markAsset()?.mark)); }

  private add(data: Record<string, unknown>, note: string) {
    this.menu.set('');
    void this.ctx.write(async () => { const made = await this.ctx.record('brand_asset', data, null, note) as { id: string }; this.open(made.id); }, 'Asset added.');
  }
  addText() { this.add({ name: 'New text', type: 'text', text: 'Write it here' }, 'Added'); }
  addMark() { this.add({ name: 'Mark', type: 'mark', mark: { text: this.appName().slice(0, 1).toUpperCase(), background: 'tertiary', foreground: 'on-tertiary' } }, 'Added'); }
  addBanner() { this.add({ name: 'Banner', type: 'banner', banner: { width: 1500, height: 500, headline: this.appName(), subline: '', background: 'primary', accent: 'tertiary' } }, 'Added'); }
  async upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    this.menu.set('');
    await this.ctx.write(async () => { const assetId = await this.ctx.upload(file, 'brand'); const made = await this.ctx.record('brand_asset', { name: file.name.replace(/\.[^.]+$/, ''), type: 'image', assetId }, null, 'Uploaded') as { id: string }; this.open(made.id); }, 'Image added.');
  }
  async replace(a: BrandAsset, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    await this.ctx.write(async () => { const assetId = await this.ctx.upload(file, 'brand'); await this.ctx.change(a.id, { assetId }, a.revision, 'Replaced the image'); }, 'Image replaced.');
  }
  addTemplate(id: string) { this.menu.set(''); void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/brand-templates/${encodeURIComponent(id)}`, 'POST'), 'Template assets added. Change or delete any of them.'); }
  save(a: BrandAsset) {
    const d = this.draft(); if (!d) return;
    const changes: Record<string, unknown> = { name: d.name, key: d.key || null, notes: d.notes };
    if (a.type === 'text') changes['text'] = d.text;
    if (a.type === 'mark') changes['mark'] = { text: d.markText, background: d.markBackground, foreground: d.markForeground };
    if (a.type === 'banner') changes['banner'] = { width: +d.width, height: +d.height, headline: d.headline, subline: d.subline, background: d.background, accent: a.banner?.accent || 'tertiary' };
    void this.ctx.write(async () => { await this.ctx.change(a.id, changes, a.revision, 'Edited'); this.sync(); }, 'Saved.');
  }
  remove(a: BrandAsset) {
    if (!confirm(`Delete ${a.name}?${a.key ? ' The app falls back to its default for this.' : ''}`)) return;
    void this.ctx.write(async () => { await this.ctx.delete(a.id); this.close(); }, `${a.name} deleted.`);
  }
}
