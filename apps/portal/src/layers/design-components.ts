import { Component, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DesignComponent, ProjectContext, PropSpec, lines } from './context';
import { DesignState, ThemeScopeDirective } from './design-state';

type Props = Record<string, string | boolean>;
interface Instance { props: Props; children: Props[] }
const appearance: Record<string, string> = { Filled: 'filled', Tonal: 'tonal', Outlined: 'outlined', Text: 'text', Elevated: 'elevated' };
const cardAppearance: Record<string, 'raised' | 'filled' | 'outlined'> = { Elevated: 'raised', Filled: 'filled', Outlined: 'outlined' };
const groups = ['Actions', 'Containment', 'Navigation', 'Selection', 'Text inputs', 'Lists', 'Feedback', 'Layouts', 'Other'];
const previewKinds = ['button', 'icon-button', 'fab', 'card', 'chip', 'switch', 'text-field', 'list', 'list-item', 'nav-list', 'nav-item', 'toolbar', 'nav-bar', 'dialog', 'scaffold'];
const statesFor = ['button', 'icon-button', 'fab'];
export const statusLabel: Record<string, string> = { needed: 'Needed', specified: 'Specified', built: 'Built' };
// Icons a contract can offer (kept in the font subset).
export const componentIcons = [{ icon: 'arrow_forward' }, { icon: 'close' }, { icon: 'more_vert' }, { icon: 'home' }, { icon: 'inventory_2' }, { icon: 'chat' }, { icon: 'person' }, { icon: 'settings' },
  { icon: 'widgets' }, { icon: 'pending' }, { icon: 'account_tree' }, { icon: 'add_link' }, { icon: 'delete' }, { icon: 'image' }];

// One component, rendered with the stack's real components (Angular Material and the aludel-web-v1 template) in the
// project's theme. Nested items are clickable so their own properties can be set.
@Component({
  selector: 'aludel-ds-render', standalone: true,
  imports: [NgTemplateOutlet, FormsModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatListModule, MatSlideToggleModule],
  template: `
  @let p = props();
  @switch (kind()) {
    @case ('button') { <ng-container *ngTemplateOutlet="button; context: { $implicit: p, state: state() }" /> }
    @case ('icon-button') { <span [class]="'lay-ds-st-' + state()"><button type="button" matIconButton [disabled]="state() === 'disabled'" [attr.aria-label]="p['label'] || p['icon']"><mat-icon>{{ p['icon'] }}</mat-icon></button></span> }
    @case ('fab') { <span [class]="'lay-ds-st-' + state()">@if (p['extended']) { <button type="button" matExtendedFab [disabled]="state() === 'disabled'"><mat-icon>{{ p['icon'] }}</mat-icon>{{ p['label'] }}</button> } @else { <button type="button" matFab [disabled]="state() === 'disabled'" [attr.aria-label]="p['label']"><mat-icon>{{ p['icon'] }}</mat-icon></button> }</span> }
    @case ('card') {
      <mat-card [appearance]="cardAppearance[$any(p['variant'])] || 'raised'" class="lay-ds-rcard">
        @if (p['media']) { <div class="lay-ds-media"><mat-icon aria-hidden="true">image</mat-icon></div> }
        <mat-card-header><mat-card-title>{{ p['headline'] }}</mat-card-title><mat-card-subtitle>{{ p['supporting'] }}</mat-card-subtitle></mat-card-header>
        <mat-card-actions align="end">@for (child of children(); track $index) { <span class="lay-ds-inst" [class.lay-ds-instsel]="selectedChild() === $index" (click)="pick($event, $index)" role="button" tabindex="0" (keydown.enter)="pick($event, $index)" [attr.aria-label]="'Select ' + child['label']"><ng-container *ngTemplateOutlet="button; context: { $implicit: child, state: 'enabled' }" /></span> }</mat-card-actions>
      </mat-card>
    }
    @case ('chip') { <mat-chip-listbox aria-label="Sample"><mat-chip-option [selected]="!!p['selected']" [disabled]="state() === 'disabled'">{{ p['label'] }}</mat-chip-option></mat-chip-listbox> }
    @case ('switch') { <mat-slide-toggle [checked]="!!p['on']" [disabled]="state() === 'disabled'">{{ p['label'] }}</mat-slide-toggle> }
    @case ('text-field') {
      <mat-form-field [appearance]="p['variant'] === 'Outlined' ? 'outline' : 'fill'" class="lay-ds-rfield">
        <mat-label>{{ p['label'] }}</mat-label><input matInput [formControl]="p['error'] ? invalid : valid" [attr.aria-label]="p['label']">
        @if (p['error']) { <mat-error>Check this and try again</mat-error> } @else { <mat-hint>{{ p['hint'] }}</mat-hint> }
      </mat-form-field>
    }
    @case ('list') {
      <mat-list class="lay-ds-rlist">@for (child of children(); track $index) {
        <mat-list-item class="lay-ds-inst" [class.lay-ds-instsel]="selectedChild() === $index" (click)="pick($event, $index)">
          @if (child['leading'] !== 'None') { <span matListItemAvatar class="lay-ds-av">{{ ('' + child['headline'])[0] }}</span> }
          <span matListItemTitle>{{ child['headline'] }}</span><span matListItemLine>{{ child['supporting'] }}</span></mat-list-item> }</mat-list>
    }
    @case ('list-item') {
      <mat-list class="lay-ds-rlist"><mat-list-item>@if (p['leading'] !== 'None') { <span matListItemAvatar class="lay-ds-av">{{ ('' + p['headline'])[0] }}</span> }<span matListItemTitle>{{ p['headline'] }}</span><span matListItemLine>{{ p['supporting'] }}</span></mat-list-item></mat-list>
    }
    @case ('nav-list') {
      <nav class="lay-ds-appnav lay-ds-rnav" aria-label="Sample navigation">@for (child of children(); track $index) {
        <span class="lay-ds-inst" [class.lay-ds-instsel]="selectedChild() === $index" (click)="pick($event, $index)" role="button" tabindex="0" (keydown.enter)="pick($event, $index)"><ng-container *ngTemplateOutlet="navitem; context: { $implicit: child }" /></span> }</nav>
    }
    @case ('nav-item') { <div class="lay-ds-appnav lay-ds-rnav"><ng-container *ngTemplateOutlet="navitem; context: { $implicit: p }" /></div> }
    @case ('toolbar') {
      <div class="lay-ds-top lay-ds-rtop">@if (p['back']) { <button type="button" matIconButton aria-label="Back"><mat-icon>arrow_back</mat-icon></button> }<span>{{ p['title'] }}</span>
        @for (child of children(); track $index) { <span class="lay-ds-inst" [class.lay-ds-instsel]="selectedChild() === $index" (click)="pick($event, $index)"><button type="button" matIconButton [attr.aria-label]="child['label']"><mat-icon>{{ child['icon'] }}</mat-icon></button></span> }</div>
    }
    @case ('nav-bar') {
      <nav class="lay-ds-phonebar lay-ds-rbar" aria-label="Sample tabs">@for (child of children(); track $index) {
        <span class="lay-ds-bi lay-ds-inst" [class.lay-ds-on]="!!child['selected']" [class.lay-ds-instsel]="selectedChild() === $index" (click)="pick($event, $index)"><span class="lay-ds-ind"><mat-icon aria-hidden="true">{{ child['icon'] }}</mat-icon></span>{{ child['label'] }}</span> }</nav>
    }
    @case ('dialog') {
      <div class="lay-ds-dialog lay-ds-rdialog"><h3 [style.font]="'var(--mat-sys-headline-small)'">{{ p['headline'] }}</h3><p [style.font]="'var(--mat-sys-body-medium)'">{{ p['body'] }}</p>
        <div class="lay-row lay-ds-end">@for (child of children(); track $index) { <span class="lay-ds-inst" [class.lay-ds-instsel]="selectedChild() === $index" (click)="pick($event, $index)"><ng-container *ngTemplateOutlet="button; context: { $implicit: child, state: 'enabled' }" /></span> }</div></div>
    }
    @case ('scaffold') {
      <div class="lay-ds-scaffold" [class.lay-ds-top-nav]="p['navigation'] === 'Top'"><div class="lay-ds-sc-nav">navigation</div><div class="lay-ds-sc-head">header</div><div class="lay-ds-sc-main">content</div></div>
    }
  }
  <ng-template #button let-b let-state="state">
    <span [class]="'lay-ds-st-' + state"><button type="button" [matButton]="$any(appearance[b['variant']] || 'filled')" [disabled]="state === 'disabled' || !!b['disabled']">@if (b['icon'] && b['icon'] !== 'none') { <mat-icon>{{ b['icon'] }}</mat-icon> }{{ b['label'] }}</button></span>
  </ng-template>
  <ng-template #navitem let-n>
    <a class="lay-ds-navitem" [class.lay-ds-on]="!!n['selected']"><mat-icon aria-hidden="true">{{ n['icon'] }}</mat-icon>{{ n['label'] }}@if (n['badge']) { <span class="lay-ds-badge">{{ n['badge'] }}</span> }</a>
  </ng-template>`,
  host: { class: 'lay-ds-render' }
})
export class ComponentRenderComponent {
  readonly kind = input.required<string>();
  readonly props = input.required<Props>();
  readonly children = input<Props[]>([]);
  readonly state = input('enabled');
  readonly selectedChild = input<number | null>(null);
  readonly childSelect = output<number>();
  readonly appearance = appearance; readonly cardAppearance = cardAppearance;
  readonly valid = new FormControl('ada@example.com');
  readonly invalid = new FormControl('ada@');
  constructor() { this.invalid.setErrors({ email: true }); this.invalid.markAsTouched(); }
  pick(event: Event, index: number) { event.stopPropagation(); event.preventDefault(); this.childSelect.emit(index); }
}

@Component({
  selector: 'aludel-design-components', standalone: true,
  imports: [FormsModule, MatIconModule, ThemeScopeDirective, ComponentRenderComponent],
  template: `
  @if (component(); as c) {
  <div class="lay-ds-editor lay-ds-three">
    <aside class="lay-ds-ctree" aria-label="Components">
      <div class="lay-ds-legend"><span><i class="lay-ds-stat lay-ds-built"></i>Built</span><span><i class="lay-ds-stat lay-ds-specified"></i>Specified</span><span><i class="lay-ds-stat lay-ds-needed"></i>Needed</span></div>
      @for (group of tree(); track group.name) {
        <p class="lay-ds-tier">{{ group.name }}</p>
        @for (entry of group.items; track entry.component.id) {
          <a class="lay-ds-ci" [class.lay-ds-child]="entry.depth > 0" [class.lay-ds-sel]="entry.component.id === c.id" [href]="ctx.link('design', 'components', entry.component.id)" (click)="select(entry.component.id, $event)" [attr.aria-current]="entry.component.id === c.id ? 'page' : null">
            <i [class]="'lay-ds-stat lay-ds-' + entry.component.status" [attr.aria-label]="statusLabel[entry.component.status]"></i>{{ entry.component.name }}</a>
        }
      }
      <form class="lay-ds-addc" (ngSubmit)="add()"><label class="visually-hidden" for="ds-newc">New component name</label><input id="ds-newc" name="newc" [(ngModel)]="newName" placeholder="e.g. Carousel (large)" maxlength="60">
        <button type="submit" class="lay-button ghost small" [disabled]="!newName.trim()"><mat-icon aria-hidden="true">add</mat-icon>Add</button></form>
    </aside>

    <section class="lay-ds-preview" aria-label="Component preview">
      <div class="lay-ds-bar"><strong>{{ c.name }}</strong><span [class]="'lay-chip lay-ds-chip-' + c.status">{{ statusLabel[c.status] }}</span><span class="lay-push"></span>
        @if (c.preview && c.status === 'built' && variantProp(c)) { <div class="lay-ds-seg" role="group" aria-label="Show"><button type="button" [attr.aria-pressed]="!grid()" (click)="grid.set(false)">One</button><button type="button" [attr.aria-pressed]="grid()" (click)="grid.set(true)">All variants</button></div> }
        <div class="lay-ds-seg" role="group" aria-label="Mode"><button type="button" [attr.aria-pressed]="ds.mode() === 'light'" (click)="ds.mode.set('light')" aria-label="Light"><mat-icon aria-hidden="true">light_mode</mat-icon></button><button type="button" [attr.aria-pressed]="ds.mode() === 'dark'" (click)="ds.mode.set('dark')" aria-label="Dark"><mat-icon aria-hidden="true">dark_mode</mat-icon></button></div>
      </div>
      <div class="lay-ds-cstage">
        <div class="lay-ds-canvas lay-ds-ccanvas" [aludelTheme]="ds.vars()">
          @if (c.status === 'built' && c.preview) {
            @if (grid() && variantProp(c); as vp) {
              <div class="lay-ds-vgrid" [style.grid-template-columns]="'auto repeat(' + gridStates(c).length + ', auto)'">
                <span></span>@for (s of gridStates(c); track s) { <span class="lay-ds-vh">{{ s }}</span> }
                @for (v of vp.options; track v) { <span class="lay-ds-vh">{{ v }}</span>@for (s of gridStates(c); track s) { <aludel-ds-render [kind]="c.preview" [props]="withProp(instance(c).props, vp.key, v)" [children]="instance(c).children" [state]="s" /> } }
              </div>
            } @else {
              <aludel-ds-render [kind]="c.preview" [props]="instance(c).props" [children]="instance(c).children" [state]="state()" [selectedChild]="child()" (childSelect)="child.set($event)" />
            }
          } @else if (c.status === 'needed') {
            <div class="lay-ds-placeholder"><div class="lay-ds-skel"><i></i><i></i><i></i></div><strong>{{ c.name }} isn't specified yet</strong><span>{{ c.purpose || 'Add what it is for, its properties and parts, and references for whoever designs it.' }}</span>
              <button type="button" class="lay-button small" (click)="startEdit(c)"><mat-icon aria-hidden="true">edit</mat-icon>Specify it</button></div>
          } @else {
            <div class="lay-ds-wireframe">@for (slot of c.slots; track slot.name) { <div><strong>{{ slot.name }}</strong><small>accepts {{ acceptsText(slot) }}</small></div> } @empty { @for (part of c.anatomy; track part.part) { <div><strong>{{ part.part }}</strong><small>{{ part.tokens.join(' · ') || part.note }}</small></div> } }</div>
            <p class="lay-ds-note lay-ds-small">Specified, not built: drawn from the contract. Building it becomes a work item.</p>
          }
        </div>
      </div>
      <div class="lay-ds-foot"><mat-icon aria-hidden="true">info</mat-icon><small>{{ c.status === 'built' ? (hasChildren(c) ? 'Click a nested item to set its own properties.' : 'Rendered with ' + (c.binding?.library || 'the stack') + ' in this project\\'s theme, including unsaved token changes.') : 'Not built yet.' }}</small></div>
    </section>

    <aside class="lay-ds-side" aria-label="Properties and contract">
      @if (editDraft(); as d) {
        <form class="lay-ds-form" (ngSubmit)="saveEdit(c)">
          <h2>Edit contract</h2>
          <label>Name<input name="name" [(ngModel)]="d.name" maxlength="60" required></label>
          <label>Group<select name="group" [(ngModel)]="d.group">@for (g of groups; track g) { <option [value]="g">{{ g }}</option> }</select></label>
          <label>Purpose<textarea name="purpose" rows="2" [(ngModel)]="d.purpose" maxlength="300"></textarea></label>
          <label>Properties <small>one per line: name, kind (variant, boolean, text, swap), options separated by |, default</small><textarea name="props" rows="5" class="lay-mono" [(ngModel)]="d.props" placeholder="variant, variant, Filled|Outlined, Filled"></textarea></label>
          <label>Slots <small>one per line: name, accepted components separated by | (or "anything"), min, max</small><textarea name="slots" rows="3" class="lay-mono" [(ngModel)]="d.slots" placeholder="items, Nav item, 1, 7"></textarea></label>
          <label>Anatomy <small>one per line: part, tokens separated by |, note</small><textarea name="anatomy" rows="4" class="lay-mono" [(ngModel)]="d.anatomy" placeholder="Container, color.primary|corner.full"></textarea></label>
          <label>Accessibility <small>one note per line</small><textarea name="a11y" rows="3" [(ngModel)]="d.a11y"></textarea></label>
          <fieldset class="lay-ds-fieldset"><legend>Built with (Platform)</legend>
            <label>Library<input name="library" [(ngModel)]="d.library" placeholder="Angular Material 22"></label>
            <label>Selector<input name="selector" [(ngModel)]="d.selector" placeholder="mat-card"></label>
            <label>Property map <small>one per line: property: code</small><textarea name="map" rows="3" class="lay-mono" [(ngModel)]="d.map"></textarea></label>
            <label>Preview<select name="preview" [(ngModel)]="d.preview"><option value="">None</option>@for (k of previewKinds; track k) { <option [value]="k">{{ k }}</option> }</select></label></fieldset>
          <label>What changed<input name="why" [(ngModel)]="d.why" placeholder="Shown in the revisions" maxlength="300"></label>
          <div class="lay-row"><button type="submit" class="lay-button small">Save revision</button><button type="button" class="lay-button ghost small" (click)="editDraft.set(null)">Cancel</button>
            <button type="button" class="lay-link-button danger lay-push" (click)="remove(c)">Delete</button></div>
        </form>
      } @else {
        @let sel = selectedContract(c);
        <div class="lay-ds-crumb">@if (parentOf(c); as parent) { <a [href]="ctx.link('design', 'components', parent.id)" (click)="select(parent.id, $event)">{{ parent.name }}</a><mat-icon aria-hidden="true">chevron_right</mat-icon> }
          @if (child() !== null) { <button type="button" class="lay-link-button" (click)="child.set(null)">{{ c.name }}</button><mat-icon aria-hidden="true">chevron_right</mat-icon><span>{{ sel.name }} {{ child()! + 1 }}</span> } @else { <span>{{ c.group }}</span> }</div>
        <h2 class="lay-ds-ctitle"><i [class]="'lay-ds-stat lay-ds-' + sel.status"></i>{{ sel.name }}@if (child() !== null) { <span class="lay-chip lay-plain">instance</span> }</h2>
        <p class="lay-muted small">{{ sel.purpose }}</p>
        @if (child() === null) { <button type="button" class="lay-button ghost small" (click)="startEdit(c)"><mat-icon aria-hidden="true">edit</mat-icon>{{ c.status === 'needed' ? 'Specify' : 'Edit contract' }}</button> }
        <h3>Properties <span class="lay-ds-n">{{ sel.props.length }}</span></h3>
        @for (prop of sel.props; track prop.key) {
          <div class="lay-ds-prop"><span>{{ prop.key }} <small class="lay-ds-kind">{{ prop.kind }}</small></span>
            @switch (prop.kind) {
              @case ('boolean') { <button type="button" class="lay-ds-toggle" [attr.aria-pressed]="!!value(c, prop)" (click)="setValue(c, prop, !value(c, prop))" [attr.aria-label]="prop.key"></button> }
              @case ('text') { <input [ngModel]="value(c, prop)" (ngModelChange)="setValue(c, prop, $event)" [attr.aria-label]="prop.key"> }
              @default {
                @if (optionsWith(prop, value(c, prop)).length <= 5) { <div class="lay-ds-pills">@for (o of optionsWith(prop, value(c, prop)); track o) { <button type="button" [attr.aria-pressed]="value(c, prop) === o" (click)="setValue(c, prop, o)">@if (prop.kind === 'swap' && o !== 'none') { <mat-icon aria-hidden="true">{{ o }}</mat-icon><span class="visually-hidden">{{ o }}</span> } @else { {{ o }} }</button> }</div> }
                @else { <select [ngModel]="value(c, prop)" (ngModelChange)="setValue(c, prop, $event)" [attr.aria-label]="prop.key">@for (o of optionsWith(prop, value(c, prop)); track o) { <option [value]="o">{{ o }}</option> }</select> }
              }
            }
          </div>
        } @empty { <p class="lay-muted small">None yet.</p> }
        @if (c.status === 'built' && statesFor.includes(c.preview || '') && child() === null) {
          <h3>State</h3><div class="lay-ds-pills">@for (s of ['enabled', 'hover', 'focus', 'pressed', 'disabled']; track s) { <button type="button" [attr.aria-pressed]="state() === s" (click)="state.set(s)">{{ s }}</button> }</div>
        }
        @if (child() === null && c.slots.length) {
          <h3>Slots</h3>
          @for (slot of c.slots; track slot.name) {
            <div class="lay-ds-slotbox"><div class="lay-row"><strong>{{ slot.name }}</strong><small class="lay-muted">accepts {{ acceptsText(slot) }} · {{ slot.min }}–{{ slot.max ?? 'any' }}</small></div>
              @if ($first && hasChildren(c)) { <div class="lay-ds-kids">@for (kid of instance(c).children; track $index) { <button type="button" class="lay-ds-kid" (click)="child.set($index)">{{ kid['label'] || kid['headline'] || 'Item ' + ($index + 1) }}</button> }
                @if (slot.max === null || instance(c).children.length < slot.max) { <button type="button" class="lay-button ghost small" (click)="addChild(c)"><mat-icon aria-hidden="true">add</mat-icon>{{ childContract(c)?.name || 'Item' }}</button> }
                @if (instance(c).children.length > slot.min) { <button type="button" class="lay-link-button small" (click)="removeChild(c)">Remove last</button> }</div> }
            </div>
          }
        }
        <details class="lay-ds-acc" [open]="c.status !== 'needed'"><summary><mat-icon aria-hidden="true">schema</mat-icon>Anatomy<span class="lay-ds-n">{{ sel.anatomy.length }}</span></summary>
          @for (part of sel.anatomy; track part.part) { <div class="lay-ds-anat"><strong>{{ part.part }}</strong><span>@for (tok of part.tokens; track tok) { <code class="lay-ds-tlink">@if (tok.startsWith('color.')) { <i [style.background]="ds.color(tok.slice(6))"></i> }{{ tok }}</code> }@if (part.note) { <small>{{ part.note }}</small> }</span></div> } @empty { <p class="lay-muted small">Not specified.</p> }</details>
        <details class="lay-ds-acc"><summary><mat-icon aria-hidden="true">accessibility_new</mat-icon>Accessibility<span class="lay-ds-n">{{ sel.a11y.length }}</span></summary>
          <ul>@for (note of sel.a11y; track note) { <li>{{ note }}</li> } @empty { <li class="lay-muted">Not specified.</li> }</ul></details>
        <details class="lay-ds-acc" [open]="refs(sel.id).length > 0"><summary><mat-icon aria-hidden="true">local_library</mat-icon>References<span class="lay-ds-n">{{ refs(sel.id).length }}</span></summary>
          @for (ref of refs(sel.id); track ref.link.id) {
            <div class="lay-ds-ref">
              @if (ref.image) { <span class="lay-ds-refimg"><img [src]="ref.image" alt="">@if (ref.region; as r) { <i [style.left.%]="r.x * 100" [style.top.%]="r.y * 100" [style.width.%]="r.w * 100" [style.height.%]="r.h * 100"></i> }</span> }
              @else { <span class="lay-ds-refimg lay-ds-refnone"><mat-icon aria-hidden="true">{{ ref.finding ? 'format_quote' : 'article' }}</mat-icon></span> }
              <span><a [href]="ctx.link('library', 'source', ref.sourceId)" (click)="ctx.go(ctx.link('library', 'source', ref.sourceId), $event)"><strong>{{ ref.title }}</strong></a>
                @if (ref.finding) { <small class="lay-ds-finding">“{{ ref.finding }}”</small> }
                <button type="button" class="lay-link-button small" (click)="unlink(ref.link.id)">Remove</button></span>
            </div>
          }
          <div class="lay-row lay-wrap"><label class="visually-hidden" for="ds-ref">Reference a Library source or finding</label>
            <select id="ds-ref" [(ngModel)]="refPick"><option value="">Reference a source or finding…</option>
              @for (s of ctx.data()?.sources || []; track s.id) { <option [value]="s.id">{{ s.title }}</option>@for (f of findingsOf(s.id); track f.id) { <option [value]="f.id">  “{{ f.text.slice(0, 60) }}”</option> } }</select>
            <button type="button" class="lay-button ghost small" [disabled]="!refPick" (click)="link(sel.id)"><mat-icon aria-hidden="true">add_link</mat-icon>Add</button></div>
          <small class="lay-muted">References go to whoever builds or changes this component, person or agent.</small></details>
        <details class="lay-ds-acc" open><summary><mat-icon aria-hidden="true">history</mat-icon>Revisions<span class="lay-ds-n">{{ sel.history.length }}</span></summary>
          @for (entry of sel.history; track entry.revision) { <div class="lay-ds-rev" [class.lay-ds-cur]="entry.revision === sel.revision"><span>r{{ entry.revision }}</span><div><strong>{{ entry.rationale }}</strong><small>{{ entry.author }} · {{ entry.createdAt.slice(0, 10) }}</small></div></div> }</details>
        <details class="lay-ds-acc"><summary><mat-icon aria-hidden="true">dns</mat-icon>Built with<span class="lay-ds-n">{{ sel.binding ? 'Platform' : '—' }}</span></summary>
          @if (sel.binding; as b) { <p class="small"><strong>{{ b.library }}</strong> · <code>{{ b.selector }}</code></p>
            <table class="lay-ds-map">@for (m of b.map; track m.prop) { <tr><td>{{ m.prop }}</td><td><code>{{ m.code }}</code></td></tr> }</table>
            <small class="lay-muted">How this stack builds the contract. The contract above doesn't depend on it.</small> }
          @else { <p class="lay-muted small">Not built. Once it is specified, building it becomes a work item.</p> }</details>
      }
    </aside>
  </div>
  }`
})
export class DesignComponentsComponent {
  readonly ctx = inject(ProjectContext);
  readonly ds = inject(DesignState);
  readonly statusLabel = statusLabel; readonly groups = groups; readonly previewKinds = previewKinds; readonly statesFor = statesFor;
  readonly grid = signal(false);
  readonly state = signal('enabled');
  readonly child = signal<number | null>(null);
  readonly instances = signal<Record<string, Instance>>({});
  readonly editDraft = signal<{ name: string; group: string; purpose: string; props: string; slots: string; anatomy: string; a11y: string; library: string; selector: string; map: string; preview: string; why: string } | null>(null);
  newName = '';
  refPick = '';

  readonly all = computed(() => this.ctx.data()?.components || []);
  readonly component = computed(() => { const id = this.ctx.segments()[2]; return this.all().find(entry => entry.id === id) || this.all()[0] || null; });
  readonly tree = computed(() => groups.map(name => {
    const items: { component: DesignComponent; depth: number }[] = [];
    const walk = (parent: DesignComponent, depth: number) => { items.push({ component: parent, depth }); for (const kid of this.all().filter(entry => entry.parentId === parent.id)) walk(kid, depth + 1); };
    for (const top of this.all().filter(entry => entry.group === name && !entry.parentId)) walk(top, 0);
    return { name, items };
  }).filter(group => group.items.length));

  select(id: string, event?: Event) { event?.preventDefault(); history.replaceState({}, '', this.ctx.link('design', 'components', id)); this.ctx.path.set(this.ctx.link('design', 'components', id)); this.child.set(null); this.state.set('enabled'); this.editDraft.set(null); this.grid.set(false); }
  parentOf(c: DesignComponent) { return c.parentId ? this.ctx.componentById().get(c.parentId) || null : null; }
  childContract(c: DesignComponent) { const id = c.slots[0]?.accepts[0]; return id ? this.ctx.componentById().get(id) || null : null; }
  hasChildren(c: DesignComponent) { return Boolean(this.childContract(c)) && ['card', 'nav-list', 'list', 'toolbar', 'nav-bar', 'dialog'].includes(c.preview || ''); }
  selectedContract(c: DesignComponent) { return this.child() !== null ? this.childContract(c) || c : c; }
  variantProp(c: DesignComponent) { return c.props.find(prop => prop.key === 'variant' && prop.kind === 'variant') || null; }
  gridStates(c: DesignComponent) { return statesFor.includes(c.preview || '') ? ['enabled', 'hover', 'focus', 'pressed', 'disabled'] : ['enabled', 'disabled']; }
  acceptsText(slot: { accepts: string[]; anything?: boolean }) { return slot.anything ? 'anything' : slot.accepts.map(id => this.ctx.componentById().get(id)?.name).filter(Boolean).join(' or ') || 'nothing yet'; }
  withProp(props: Props, key: string, value: string) { return { ...props, [key]: value }; }
  private defaults(c: DesignComponent | null): Props { return Object.fromEntries((c?.props || []).map(prop => [prop.key, prop.default])); }

  // Instances are preview-only: the contract's defaults, with children filled from the project's own pages where it fits.
  instance(c: DesignComponent): Instance {
    const existing = this.instances()[c.id];
    if (existing) return existing;
    const kid = this.childContract(c);
    const pages = (this.ctx.data()?.pages || []).filter(page => page.inNav);
    const count = Math.min(Math.max(c.slots[0]?.min || 0, { card: 2, dialog: 2, 'nav-list': 4, 'nav-bar': 4, list: 3, toolbar: 1 }[c.preview || ''] ?? 0), c.slots[0]?.max ?? 10);
    const names = ['Priya Raman', 'Marco Bianchi', 'Aiyana Ross', 'Sam Okafor'];
    const children = kid ? Array.from({ length: count }, (_, i) => {
      const base = this.defaults(kid);
      if (c.preview === 'nav-list' || c.preview === 'nav-bar') return { ...base, label: pages[i]?.label || ['Home', 'Search', 'Messages', 'Profile'][i] || `Page ${i + 1}`, icon: pages[i]?.icon || ['home', 'search', 'chat', 'person'][i] || 'home', selected: i === 0 };
      if (c.preview === 'list') return { ...base, headline: names[i % names.length] };
      if (c.preview === 'card' || c.preview === 'dialog') return { ...base, variant: i === count - 1 ? 'Filled' : 'Text', label: c.preview === 'dialog' ? ['Cancel', 'Confirm'][i] || 'OK' : ['Details', 'Open'][i] || 'More' };
      return base;
    }) : [];
    return { props: this.defaults(c), children };
  }
  private save(c: DesignComponent, next: Instance) { this.instances.update(all => ({ ...all, [c.id]: next })); }
  value(c: DesignComponent, prop: PropSpec) { const inst = this.instance(c); const index = this.child(); return index !== null ? inst.children[index]?.[prop.key] ?? prop.default : inst.props[prop.key] ?? prop.default; }
  setValue(c: DesignComponent, prop: PropSpec, value: string | boolean) {
    const inst = this.instance(c); const index = this.child();
    if (index === null) { this.save(c, { ...inst, props: { ...inst.props, [prop.key]: value } }); return; }
    // One selected destination at a time, as the contract says.
    const children = inst.children.map((kid, i) => i === index ? { ...kid, [prop.key]: value } : prop.key === 'selected' && value === true ? { ...kid, selected: false } : kid);
    this.save(c, { ...inst, children });
  }
  // An instance can hold a value from outside the contract's options (a page's own icon); show it rather than a blank.
  optionsWith(prop: PropSpec, current: string | boolean) { return typeof current === 'string' && current && !prop.options.includes(current) ? [current, ...prop.options] : prop.options; }
  addChild(c: DesignComponent) { const inst = this.instance(c); const kid = this.childContract(c); this.save(c, { ...inst, children: [...inst.children, { ...this.defaults(kid), label: 'New item', headline: 'New person', selected: false }] }); this.child.set(inst.children.length); }
  removeChild(c: DesignComponent) { const inst = this.instance(c); this.save(c, { ...inst, children: inst.children.slice(0, -1) }); this.child.set(null); }

  // ---- References (DESIGN-UX-01): Library sources and findings, straight onto the component ----
  refs(id: string) {
    const data = this.ctx.data(); if (!data) return [];
    return this.ctx.referencesFor(id).map(link => {
      const finding = data.findings.find(entry => entry.id === link.sourceRef);
      const source = data.sources.find(entry => entry.id === (finding ? finding.sourceId : link.sourceRef));
      const upload = source?.assetId ? data.uploads?.find(entry => entry.id === source.assetId) : null;
      return { link, sourceId: source?.id || '', title: source?.title || 'Source', finding: finding?.text || '', region: finding?.region || null, image: upload?.kind === 'image' ? upload.url : '' };
    });
  }
  findingsOf(sourceId: string) { return (this.ctx.data()?.findings || []).filter(finding => finding.sourceId === sourceId); }
  link(recordId: string) { const ref = this.refPick; void this.ctx.write(async () => { await this.ctx.record('evidence_link', { direction: 'references', sourceRef: ref, recordId }); this.refPick = ''; }, 'Referenced.'); }
  unlink(id: string) { void this.ctx.write(() => this.ctx.delete(id), 'Reference removed.'); }

  // ---- Contracts ----
  add() {
    const name = this.newName.trim(); if (!name) return;
    const group = this.component()?.group || 'Other';
    void this.ctx.write(async () => { const made = await this.ctx.record('component', { name, group }, null, 'Added as needed') as { id: string }; this.newName = ''; setTimeout(() => this.select(made.id)); }, `${name} added. It's needed until someone specifies it.`);
  }
  startEdit(c: DesignComponent) {
    const name = (id: string) => this.ctx.componentById().get(id)?.name || id;
    this.editDraft.set({ name: c.name, group: c.group, purpose: c.purpose, why: '',
      props: c.props.map(prop => [prop.key, prop.kind, prop.options.join('|'), String(prop.default)].join(', ')).join('\n'),
      slots: c.slots.map(slot => [slot.name, slot.anything ? 'anything' : slot.accepts.map(name).join('|'), slot.min, slot.max ?? ''].join(', ')).join('\n'),
      anatomy: c.anatomy.map(part => [part.part, part.tokens.join('|'), part.note].join(', ').replace(/, $/, '')).join('\n'),
      a11y: c.a11y.join('\n'), library: c.binding?.library || '', selector: c.binding?.selector || '', map: (c.binding?.map || []).map(entry => `${entry.prop}: ${entry.code}`).join('\n'), preview: c.preview || '' });
  }
  saveEdit(c: DesignComponent) {
    const d = this.editDraft(); if (!d) return;
    const byName = new Map(this.all().map(entry => [entry.name.toLowerCase(), entry.id]));
    const cells = (line: string) => line.split(',').map(cell => cell.trim());
    const props = lines(d.props).map(line => { const [key, kind, options = '', fallback = ''] = cells(line); const list = options ? options.split('|').map(item => item.trim()).filter(Boolean) : [];
      return { key, kind, options: list, default: kind === 'boolean' ? fallback === 'true' : fallback || list[0] || '' }; });
    const slots = lines(d.slots).map(line => { const [name, accepts = '', min = '0', max = ''] = cells(line); const anything = accepts.toLowerCase() === 'anything';
      return { name, anything, accepts: anything ? [] : accepts.split('|').map(item => byName.get(item.trim().toLowerCase())).filter(Boolean), min: Number(min) || 0, max: max === '' ? null : Number(max) }; });
    const anatomy = lines(d.anatomy).map(line => { const [part, tokens = '', ...note] = cells(line); return { part, tokens: tokens.split('|').map(item => item.trim()).filter(Boolean), note: note.join(', ') }; });
    const binding = d.library.trim() || d.selector.trim() ? { library: d.library, selector: d.selector, map: lines(d.map).map(line => { const at = line.indexOf(':'); return { prop: line.slice(0, at).trim(), code: line.slice(at + 1).trim() }; }).filter(entry => entry.prop && entry.code) } : null;
    void this.ctx.write(async () => { await this.ctx.change(c.id, { name: d.name, group: d.group, purpose: d.purpose, props, slots, anatomy, a11y: lines(d.a11y), binding, preview: d.preview || null }, c.revision, d.why.trim() || 'Contract changed'); this.editDraft.set(null); this.instances.update(all => { const next = { ...all }; delete next[c.id]; return next; }); }, 'Saved as a new revision.');
  }
  remove(c: DesignComponent) {
    if (!confirm(`Delete ${c.name}? Components that accept it will stop accepting it.`)) return;
    const next = this.all().find(entry => entry.id !== c.id);
    void this.ctx.write(async () => { await this.ctx.delete(c.id); this.editDraft.set(null); if (next) this.select(next.id); }, `${c.name} deleted.`);
  }
}
