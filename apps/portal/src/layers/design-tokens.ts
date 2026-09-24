import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { contrastRatio, contrastText } from '../color';
import { Palette, Tokens, contrastPairs, cornerKeys, durationKeys, easingKeys, faceStacks, levelShadow, paletteOf, paletteTone, roleColor, standardTones, stateKeys } from '../design-tokens';
import { ProjectContext } from './context';
import { DesignState, ThemeScopeDirective } from './design-state';

interface TreeItem { tok: string; label: string; page: string; raw?: boolean; swatch?: string; strip?: string[]; value?: string; alias?: { text: string; color: string; role?: string; type?: string } }
interface TreeSection { tier: 'raw' | 'roles' | 'rules'; key: string; title: string; items: TreeItem[]; closed?: boolean }
interface Box { left: number; top: number; width: number; height: number; label: string; selected: boolean }

export const tokenPages = [
  { id: 'palettes', title: 'Palettes', tier: 'Raw values' }, { id: 'roles', title: 'Colour roles', tier: 'Roles' }, { id: 'type', title: 'Type', tier: 'Roles' },
  { id: 'shape', title: 'Corners and spacing', tier: 'Raw values' }, { id: 'elevation', title: 'Elevation', tier: 'Rules' }, { id: 'motion', title: 'Motion', tier: 'Rules' },
  { id: 'behaviour', title: 'Behaviour', tier: 'Rules' }, { id: 'icons', title: 'Icons', tier: 'Raw values' },
  { id: 'sample-browse', title: 'Sample · a list page', tier: 'Sample screen' }, { id: 'sample-form', title: 'Sample · a form page', tier: 'Sample screen' }];
// Where each kind of token is shown, for "isn't on this page".
const homePage: Record<string, string> = { palette: 'palettes', color: 'roles', face: 'type', type: 'type', corner: 'shape', space: 'shape', elevation: 'elevation', easing: 'motion', duration: 'motion', spring: 'motion', behaviour: 'behaviour', icons: 'icons' };
const typeName = (id: string) => id.replace('-', ' ').replace(/^./, c => c.toUpperCase());
const shortPalette = (key: string) => key === 'neutralVariant' ? 'n-variant' : key;
// Icons the preview shows (listed so tools/subset-icons.py keeps them in the font subset).
export const previewIcons = [{ icon: 'search' }, { icon: 'notifications' }, { icon: 'add' }, { icon: 'check' }, { icon: 'drag_indicator' }, { icon: 'play_arrow' }, { icon: 'push_pin' },
  { icon: 'arrow_back' }, { icon: 'share' }, { icon: 'favorite' }, { icon: 'more_vert' }, { icon: 'send' }, { icon: 'edit' }, { icon: 'close' }, { icon: 'light_mode' }, { icon: 'dark_mode' },
  { icon: 'mobile' }, { icon: 'desktop_windows' }, { icon: 'chevron_left' }, { icon: 'chevron_right' }, { icon: 'history' }, { icon: 'visibility_off' }, { icon: 'key' }, { icon: 'restart_alt' },
  { icon: 'edit_note' }, { icon: 'link' }, { icon: 'category' }, { icon: 'text_fields' }, { icon: 'save' }, { icon: 'undo' }, { icon: 'star' }, { icon: 'schedule' }, { icon: 'near_me' }];

@Component({
  selector: 'aludel-design-tokens', standalone: true,
  imports: [NgTemplateOutlet, FormsModule, DragDropModule, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule, ThemeScopeDirective],
  template: `
  @if (ds.tokens(); as t) {
  @if (ds.dirty()) {
    <div class="lay-ds-savebar" role="status"><mat-icon aria-hidden="true">edit_note</mat-icon><strong>Unsaved token changes</strong>
      <label class="visually-hidden" for="ds-note">What changed</label><input id="ds-note" [ngModel]="ds.note()" (ngModelChange)="ds.note.set($event)" placeholder="What changed? (shown in the history)" maxlength="300">
      <button type="button" class="lay-button ghost small" (click)="ds.discard()"><mat-icon aria-hidden="true">undo</mat-icon>Discard</button>
      <button type="button" class="lay-button small" (click)="ds.save()"><mat-icon aria-hidden="true">save</mat-icon>Save revision</button></div>
  }
  <div class="lay-ds-editor">
    <aside class="lay-ds-tree" aria-label="Token tree">
      <div class="lay-ds-treehead">
        <div class="lay-row"><strong>Tokens</strong><span class="lay-chip lay-l-design">r{{ ds.saved()?.revision }}</span><button type="button" class="lay-link-button lay-push small" (click)="historyOpen.set(true)"><mat-icon aria-hidden="true">history</mat-icon>History</button></div>
        <label class="lay-ds-find"><mat-icon aria-hidden="true">search</mat-icon><span class="visually-hidden">Find a token</span><input [ngModel]="filter()" (ngModelChange)="filter.set($event)" placeholder="Find a token"></label>
        <small class="lay-muted">{{ t.base }} · showing {{ ds.mode() }} values · W3C design tokens</small>
      </div>
      <div class="lay-ds-treebody">
        @for (section of sections(); track section.key; let first = $first) {
          @if (first || section.tier !== sections()[$index - 1].tier) {
            @if (!first) { <div class="lay-ds-divider"></div> }
            <p class="lay-ds-tier"><mat-icon aria-hidden="true">{{ tierIcon[section.tier] }}</mat-icon>{{ tierName[section.tier] }}</p>
            <p class="lay-ds-tiernote">{{ tierNote[section.tier] }}</p>
          }
          <details class="lay-ds-group" [attr.data-group]="section.key" [open]="isOpen(section)" (toggle)="setOpen(section, $event)">
            <summary><mat-icon aria-hidden="true" class="lay-ds-caret">chevron_right</mat-icon>{{ section.title }}<span class="lay-ds-n">{{ section.items.length }}</span></summary>
            @for (item of section.items; track item.tok) {
              <div class="lay-ds-tok" [class.lay-ds-raw]="item.raw" [class.lay-ds-sel]="selected() === item.tok" [class.lay-ds-hov]="hover() === item.tok" (mouseenter)="hoverTok(item)" (mouseleave)="unhover()" (click)="selectTok(item)">
                <button type="button" class="lay-ds-nm" (focus)="hoverTok(item)" (blur)="unhover()" (click)="$event.stopPropagation(); selectTok(item)" [attr.aria-pressed]="selected() === item.tok">{{ item.label }}</button>
                @if (item.strip) { <span class="lay-ds-strip" aria-hidden="true">@for (c of item.strip; track $index) { <i [style.background]="c"></i> }</span> }
                @if (item.value) { <span class="lay-ds-val">{{ item.value }}</span> }
                @if (item.alias; as a) { <button type="button" class="lay-ds-alias" (click)="$event.stopPropagation(); a.role ? openAlias($event, a.role) : openFace($event, a.type!)" [attr.aria-label]="'Change what ' + item.label + ' points at: ' + a.text">
                  @if (a.color) { <span class="lay-ds-sw" [style.background]="a.color"></span> } @else { <mat-icon aria-hidden="true">text_fields</mat-icon> }{{ a.text }}</button> }
              </div>
            }
          </details>
        }
      </div>
    </aside>

    <section class="lay-ds-preview" aria-label="Live preview">
      <div class="lay-ds-bar">
        <span class="lay-chip" [class.lay-l-design]="pageInfo().tier !== 'Sample screen'" [class.lay-l-pages]="pageInfo().tier === 'Sample screen'">{{ pageInfo().tier }}</span><strong>{{ pageInfo().title }}</strong>
        <div class="lay-ds-ctl">
          @switch (pageInfo().id) {
            @case ('elevation') {
              <label>Sitting on <select [ngModel]="base()" (ngModelChange)="base.set(+$event)">@for (e of t.elevation.slice(0, 4); track e.level) { <option [ngValue]="e.level">level {{ e.level }} · {{ short(e.fill) }}</option> }</select></label>
              <label>Shadows <select [ngModel]="t.elevationRule" (ngModelChange)="set(['elevationRule'], $event)"><option value="fixed">Fixed per level</option><option value="relative">Relative to what's below</option></select></label>
            }
            @case ('type') { <span>Selected slot: <strong>{{ activeSlot() }}</strong> · {{ typeName(slots()[activeSlot()]) }}</span> }
            @case ('palettes') { <span>AA contrast checks on</span> }
          }
        </div>
        <span class="lay-push"></span>
        <div class="lay-ds-seg" role="group" aria-label="Mode"><button type="button" [attr.aria-pressed]="ds.mode() === 'light'" (click)="ds.mode.set('light')"><mat-icon aria-hidden="true">light_mode</mat-icon>Light</button><button type="button" [attr.aria-pressed]="ds.mode() === 'dark'" (click)="ds.mode.set('dark')"><mat-icon aria-hidden="true">dark_mode</mat-icon>Dark</button></div>
        <div class="lay-ds-seg" role="group" aria-label="Width"><button type="button" [attr.aria-pressed]="ds.width() === 'phone'" (click)="ds.width.set('phone')" aria-label="Phone width"><mat-icon aria-hidden="true">mobile</mat-icon></button><button type="button" [attr.aria-pressed]="ds.width() === 'desktop'" (click)="ds.width.set('desktop')" aria-label="Desktop width"><mat-icon aria-hidden="true">desktop_windows</mat-icon></button></div>
      </div>
      <div class="lay-ds-stage" #stage (scroll)="refreshBoxes()">
        <div class="lay-ds-canvas" [class.lay-ds-phone]="ds.width() === 'phone'" [aludelTheme]="ds.vars()" #canvas>
          @switch (pageInfo().id) {
            @case ('palettes') {
              <h2 class="lay-ds-h" data-t="type.headline-small">Tonal palettes</h2>
              <p class="lay-ds-note">The colour raw values. Nothing in the app uses these directly: roles point at them. Click a box to edit it. Changing a seed colour regenerates its row.</p>
              @for (p of t.palettes; track p.key) {
                <div class="lay-ds-pal">
                  <div class="lay-ds-palname">{{ p.name }}<small>seed {{ p.seed }}</small></div>
                  <div class="lay-ds-boxes" [attr.data-t]="'palette.' + p.key">
                    @for (tone of standardTones; track tone) { <ng-container *ngTemplateOutlet="box; context: { p: p, tone: tone }" /> }
                  </div>
                  @if (extraTones(p.key).length) {
                    <div class="lay-ds-palname"><small>surface tones</small></div>
                    <div class="lay-ds-boxes lay-ds-sub" [attr.data-t]="'palette.' + p.key">@for (tone of extraTones(p.key); track tone) { <ng-container *ngTemplateOutlet="box; context: { p: p, tone: tone }" /> }</div>
                  }
                </div>
              }
              <p class="lay-ds-note lay-ds-small">Tones use Material's 0–100 scale (a tone is its lightness), because this project started from Material 3.</p>
            }
            @case ('roles') {
              <h2 class="lay-ds-h" data-t="type.headline-small">Colour roles</h2>
              <p class="lay-ds-note">Each role points at a palette tone, separately for light and dark. Click a role to point it somewhere else. Contrast is checked against its pair: WCAG AA, 4.5:1.</p>
              @for (family of roleFamilies; track family) {
                <p class="lay-ds-sec">{{ family }}</p>
                <div class="lay-ds-roles">@for (id of familyRoles(family); track id) { <ng-container *ngTemplateOutlet="roleTile; context: { id: id }" /> }</div>
              }
              <p class="lay-ds-sec">Surfaces</p>
              <div class="lay-ds-roles lay-ds-surfaces">@for (id of surfaceRoles; track id) { <ng-container *ngTemplateOutlet="roleTile; context: { id: id }" /> }</div>
              <p class="lay-ds-sec">Text, lines and inverse</p>
              <div class="lay-ds-roles">@for (id of ['on-surface', 'on-surface-variant', 'outline', 'outline-variant', 'inverse-surface', 'inverse-on-surface', 'inverse-primary']; track id) { <ng-container *ngTemplateOutlet="roleTile; context: { id: id }" /> }</div>
            }
            @case ('type') {
              <h2 class="lay-ds-h" data-t="type.headline-small">Type</h2>
              <p class="lay-ds-note">Two type faces (raw values) and fifteen type roles. Click a row to edit it.</p>
              <div class="lay-ds-faces" data-t="face.brand face.plain">
                @for (face of faceKeys; track face) {
                  <label>{{ face === 'brand' ? 'Brand face' : 'Plain face' }}<select [ngModel]="t.faces[face]" (ngModelChange)="setFace(face, $event)">
                    @for (stack of stacksWith(t.faces[face]); track stack) { <option [value]="stack">{{ stack.split(',')[0].replace(quotes, '') }}</option> }</select></label>
                }
              </div>
              <div class="lay-ds-typewrap">
                <div class="lay-ds-ladder">
                  @for (role of t.type; track role.id) {
                    <button type="button" class="lay-ds-lrow" [attr.data-t]="'type.' + role.id + ' face.' + role.face" (click)="toggleEdit('type', role.id)" (mouseenter)="tryRole.set(role.id)" (mouseleave)="tryRole.set(null)" [attr.aria-expanded]="editing() === 'type:' + role.id">
                      <span class="lay-ds-smp" [style.font]="'var(--mat-sys-' + role.id + ')'" [style.letter-spacing]="'var(--mat-sys-' + role.id + '-tracking)'">{{ typeName(role.id) }}</span>
                      <span class="lay-ds-meta">{{ role.face }} {{ role.size }}/{{ role.line }} · {{ role.weight }}</span></button>
                    @if (editing() === 'type:' + role.id) {
                      <div class="lay-ds-inl">
                        <label>Face<select [ngModel]="role.face" (ngModelChange)="editType(role.id, 'face', $event)"><option value="brand">Brand</option><option value="plain">Plain</option></select></label>
                        <label>Size · {{ role.size }}px<input type="range" min="8" max="96" step="1" [ngModel]="role.size" (ngModelChange)="editType(role.id, 'size', +$event)"></label>
                        <label>Line height · {{ role.line }}px<input type="range" min="10" max="110" step="1" [ngModel]="role.line" (ngModelChange)="editType(role.id, 'line', +$event)"></label>
                        <label>Weight · {{ role.weight }}<input type="range" min="100" max="900" step="100" [ngModel]="role.weight" (ngModelChange)="editType(role.id, 'weight', +$event)"></label>
                        <label>Letter spacing · {{ role.tracking }}px<input type="range" min="-2" max="2" step="0.05" [ngModel]="role.tracking" (ngModelChange)="editType(role.id, 'tracking', +$event)"></label>
                      </div>
                    }
                  }
                </div>
                <div>
                  <div class="lay-ds-pair">
                    @for (slot of slotKeys; track slot) {
                      <div class="lay-ds-slot" role="button" tabindex="0" [class.lay-ds-active]="activeSlot() === slot" [class.lay-ds-trying]="activeSlot() === slot && tryRole()" (click)="activeSlot.set(slot)" (keydown.enter)="activeSlot.set(slot)"
                        [attr.data-t]="'type.' + slotRole(slot)" [attr.aria-label]="slot + ' slot, ' + typeName(slotRole(slot))">
                        <span class="lay-ds-schip">{{ slot }} · {{ typeName(slotRole(slot)) }}{{ activeSlot() === slot && tryRole() ? ' (trying)' : '' }}</span>
                        <div [style.font]="'var(--mat-sys-' + slotRole(slot) + ')'" [style.letter-spacing]="'var(--mat-sys-' + slotRole(slot) + '-tracking)'">{{ sampleText[slot] }}</div>
                      </div>
                    }
                  </div>
                  <div class="lay-ds-rules"><div><strong>Pairing sample.</strong> Click a line to select its slot.</div><div><strong>Hover</strong> a type role (in the tree or the list) to try it in that slot.</div><div><strong>Click</strong> a role in the tree to place it there. The sample never changes tokens.</div></div>
                </div>
              </div>
            }
            @case ('shape') {
              <h2 class="lay-ds-h" data-t="type.headline-small">Corners and spacing</h2>
              <p class="lay-ds-note">Raw values. Click a corner to change it; every component that uses it follows.</p>
              <div class="lay-ds-shapes">
                @for (key of cornerKeys; track key) {
                  <button type="button" class="lay-ds-shape" [attr.data-t]="'corner.' + key" (click)="toggleEdit('corner', key)" [attr.aria-expanded]="editing() === 'corner:' + key"><i [style.border-radius.px]="t.corners[key] > 39 ? 39 : t.corners[key]"></i>{{ key }}<small>{{ t.corners[key] >= 999 ? 'full' : t.corners[key] + 'px' }}</small></button>
                }
              </div>
              @if (editingKey('corner'); as key) {
                <div class="lay-ds-inl lay-ds-narrow"><label>corner {{ key }} · {{ t.corners[key] >= 999 ? 'full' : t.corners[key] + 'px' }}<input type="range" min="0" max="48" step="1" [ngModel]="t.corners[key] > 48 ? 48 : t.corners[key]" (ngModelChange)="set(['corners', key], key === 'full' && +$event >= 40 ? 9999 : +$event)"></label>@if (key === 'full') { <small>Past 40 it becomes a pill (full).</small> }</div>
              }
              <p class="lay-ds-sec">In use</p>
              <div class="lay-ds-inuse">
                <button matButton="filled" data-t="corner.full color.primary type.label-large">Continue</button>
                <mat-chip-listbox aria-label="Sample chip"><mat-chip-option selected data-t="corner.small color.secondary-container">Nearby</mat-chip-option></mat-chip-listbox>
                <mat-form-field appearance="fill" data-t="corner.extra-small color.surface-container-highest" subscriptSizing="dynamic"><mat-label>Pick-up day</mat-label><input matInput value="Saturday"></mat-form-field>
                <button matFab aria-label="Add" data-t="corner.large color.primary-container elevation.level3"><mat-icon>add</mat-icon></button>
                <mat-card appearance="outlined" class="lay-ds-mini" data-t="corner.medium color.outline-variant"><mat-card-content>Card · corner medium</mat-card-content></mat-card>
                <div class="lay-ds-dialog lay-ds-mini" data-t="corner.extra-large color.surface-container-high elevation.level3">Dialog · corner extra-large</div>
              </div>
              <p class="lay-ds-sec">Spacing</p>
              @for (entry of spacing(); track entry[0]) {
                <div class="lay-ds-space" [attr.data-t]="'space.' + entry[0]"><label>space {{ entry[0] }}<input type="number" min="0" max="400" [ngModel]="entry[1]" (ngModelChange)="set(['spacing', entry[0]], +$event)"></label><i [style.width.px]="entry[1] * 4"></i></div>
              }
            }
            @case ('elevation') {
              <h2 class="lay-ds-h" data-t="type.headline-small">Elevation</h2>
              <p class="lay-ds-note">A rule: each level is a surface fill (a colour role) plus a shadow. Click a card to edit its level.</p>
              <div class="lay-ds-elev" [style.background]="'var(--mat-sys-' + t.elevation[base()].fill + ')'" [attr.data-t]="'elevation.level' + base() + ' color.' + t.elevation[base()].fill">
                @for (e of t.elevation; track e.level) {
                  @if (e.level > base() || e.level === 0 && base() === 0) {
                    <button type="button" class="lay-ds-ecard" [style.background]="'var(--mat-sys-' + e.fill + ')'" [style.box-shadow]="shadowOn(e.level)" [attr.data-t]="'elevation.level' + e.level + ' color.' + e.fill" (click)="toggleEdit('elev', '' + e.level)" [attr.aria-expanded]="editing() === 'elev:' + e.level">Level {{ e.level }}<small>{{ short(e.fill) }}</small></button>
                  }
                }
              </div>
              @if (editingKey('elev'); as key) {
                @let e = t.elevation[+key];
                <div class="lay-ds-inl">
                  <label>Level {{ e.level }} fill<select [ngModel]="e.fill" (ngModelChange)="set(['elevation', +key, 'fill'], $event)">@for (id of surfaceRoles; track id) { <option [value]="id">{{ id }}</option> }</select></label>
                  <label>Shadow offset · {{ e.y }}px<input type="range" min="0" max="24" [ngModel]="e.y" (ngModelChange)="set(['elevation', +key, 'y'], +$event)"></label>
                  <label>Blur · {{ e.blur }}px<input type="range" min="0" max="48" [ngModel]="e.blur" (ngModelChange)="set(['elevation', +key, 'blur'], +$event)"></label>
                  <label>Opacity · {{ e.opacity }}<input type="range" min="0" max="0.5" step="0.01" [ngModel]="e.opacity" (ngModelChange)="set(['elevation', +key, 'opacity'], +$event)"></label>
                </div>
              }
              <div class="lay-ds-rules"><div><strong>Sitting on</strong> sets the surface underneath (in the toolbar).</div><div><strong>Relative shadows:</strong> a card casts the shadow of how many levels it rises above what it sits on. With <em>fixed</em>, level 3 always casts shadow 3.</div></div>
            }
            @case ('motion') {
              <h2 class="lay-ds-h" data-t="type.headline-small">Motion</h2>
              <p class="lay-ds-note">Easing curves, durations and a spring. Drag a curve's handles. Pick a curve and a duration, then press Play.</p>
              <div class="lay-ds-motion">
                @for (key of easingKeys; track key) {
                  <div class="lay-ds-mcard" [attr.data-t]="'easing.' + key">
                    <div class="lay-row"><strong>{{ key.replace('-', ' ') }}</strong><button type="button" class="lay-push" [attr.aria-pressed]="easing() === key" [matButton]="easing() === key ? 'tonal' : 'text'" (click)="easing.set(key)">{{ easing() === key ? 'Selected' : 'Use' }}</button></div>
                    <svg viewBox="0 0 160 120" (pointermove)="dragHandle($event, key)" (pointerup)="handle.set(null)" (pointerleave)="handle.set(null)" [attr.aria-label]="key + ' easing curve'">
                      <line [attr.x1]="bx(0)" [attr.y1]="by(0)" [attr.x2]="bx(t.motion.easing[key][0])" [attr.y2]="by(t.motion.easing[key][1])" class="lay-ds-guide" />
                      <line [attr.x1]="bx(1)" [attr.y1]="by(1)" [attr.x2]="bx(t.motion.easing[key][2])" [attr.y2]="by(t.motion.easing[key][3])" class="lay-ds-guide" />
                      <path [attr.d]="curve(t.motion.easing[key])" class="lay-ds-curve" />
                      <circle [attr.cx]="bx(t.motion.easing[key][0])" [attr.cy]="by(t.motion.easing[key][1])" r="7" class="lay-ds-handle" (pointerdown)="grab($event, key, 0)" />
                      <circle [attr.cx]="bx(t.motion.easing[key][2])" [attr.cy]="by(t.motion.easing[key][3])" r="7" class="lay-ds-handle" (pointerdown)="grab($event, key, 1)" />
                    </svg>
                    <code>cubic-bezier({{ t.motion.easing[key].join(', ') }})</code>
                  </div>
                }
              </div>
              <div class="lay-ds-motion lay-ds-motion2">
                <div class="lay-ds-mcard" data-t="spring.spatial"><strong>Spring · spatial</strong>
                  <svg viewBox="0 0 160 120" aria-label="Spring response"><path [attr.d]="springPath()" class="lay-ds-curve" /><line x1="14" x2="146" [attr.y1]="by(0.8)" [attr.y2]="by(0.8)" class="lay-ds-guide" /></svg>
                  <label>Stiffness · {{ t.motion.spring.stiffness }}<input type="range" min="100" max="2000" step="50" [ngModel]="t.motion.spring.stiffness" (ngModelChange)="set(['motion', 'spring', 'stiffness'], +$event)"></label>
                  <label>Damping · {{ t.motion.spring.damping }}<input type="range" min="0.3" max="1" step="0.05" [ngModel]="t.motion.spring.damping" (ngModelChange)="set(['motion', 'spring', 'damping'], +$event)"></label>
                </div>
                <div class="lay-ds-mcard"><strong>Try it</strong>
                  <div class="lay-row lay-wrap">@for (key of durationKeys; track key) { <button type="button" [matButton]="duration() === key ? 'tonal' : 'outlined'" [attr.data-t]="'duration.' + key" (click)="duration.set(key)">{{ key }} · {{ t.motion.durations[key] }}ms</button> }</div>
                  @if (duration(); as key) { <label>{{ key }} duration · {{ t.motion.durations[key] }}ms<input type="range" min="50" max="1500" step="10" [ngModel]="t.motion.durations[key]" (ngModelChange)="set(['motion', 'durations', key], +$event)"></label> }
                  <div class="lay-ds-lane"><span class="lay-ds-dot" #dotE></span></div><div class="lay-ds-lane"><span class="lay-ds-dot lay-ds-dot2" #dotS></span></div>
                  <div class="lay-row"><button matButton="filled" type="button" (click)="play()"><mat-icon>play_arrow</mat-icon>Play</button><small>Top: {{ easing().replace('-', ' ') }}, {{ t.motion.durations[duration()] }}ms. Bottom: spring.</small></div>
                </div>
              </div>
            }
            @case ('behaviour') {
              <h2 class="lay-ds-h" data-t="type.headline-small">Behaviour</h2>
              <p class="lay-ds-note">Interaction rules the whole app follows. Each one uses tokens and states its rules, so every list, board and gallery behaves the same.</p>
              <div class="lay-ds-two">
                <div>
                  <p class="lay-ds-sec">Drag and drop · try it</p>
                  <div cdkDropList class="lay-ds-dnd" [class.lay-ds-line]="t.behaviours.drag.indicator === 'line'" (cdkDropListDropped)="drop($event)" role="list" aria-label="Reorderable sample list" data-t="behaviour.drag">
                    @for (item of dndItems(); track item; let i = $index) {
                      <div class="lay-ds-ditem" cdkDrag [cdkDragStartDelay]="{ touch: t.behaviours.drag.touchDelay, mouse: 0 }" role="listitem" tabindex="0" [class.lay-ds-held]="held() === i"
                        [style.--lift]="'var(--mat-sys-level' + t.behaviours.drag.lift + ')'" [style.--scale]="t.behaviours.drag.scale" (keydown)="dndKey($event, i)" [attr.aria-label]="item + ', position ' + (i + 1) + ' of ' + dndItems().length">
                        <mat-icon aria-hidden="true">drag_indicator</mat-icon>{{ item }}
                        <div *cdkDragPlaceholder class="lay-ds-ph"></div>
                      </div>
                    }
                  </div>
                  <p class="lay-ds-note lay-ds-small">Mouse or touch: drag a row (touch waits {{ t.behaviours.drag.touchDelay }}ms). Keyboard: focus a row, Space to lift, arrows to move, Space to drop, Esc to cancel.</p>
                  <p class="visually-hidden" aria-live="assertive">{{ announce() }}</p>
                </div>
                <div class="lay-ds-contract" data-t="behaviour.drag"><strong>Drag and drop contract</strong>
                  <label>Lift to <select [ngModel]="t.behaviours.drag.lift" (ngModelChange)="set(['behaviours', 'drag', 'lift'], +$event)">@for (n of [1, 2, 3, 4, 5]; track n) { <option [ngValue]="n">elevation level {{ n }}</option> }</select></label>
                  <label>Scale while held · {{ t.behaviours.drag.scale }}<input type="range" min="1" max="1.1" step="0.01" [ngModel]="t.behaviours.drag.scale" (ngModelChange)="set(['behaviours', 'drag', 'scale'], +$event)"></label>
                  <label>Touch hold · {{ t.behaviours.drag.touchDelay }}ms<input type="range" min="0" max="800" step="50" [ngModel]="t.behaviours.drag.touchDelay" (ngModelChange)="set(['behaviours', 'drag', 'touchDelay'], +$event)"></label>
                  <label>Drop target <select [ngModel]="t.behaviours.drag.indicator" (ngModelChange)="set(['behaviours', 'drag', 'indicator'], $event)"><option value="placeholder">Dashed placeholder</option><option value="line">Line in primary</option></select></label>
                  <ul><li>Keyboard alternative on every draggable list (Space, arrows, Esc).</li><li>Screen readers hear "Picked up", the new position, and "Dropped" or "Cancelled".</li><li>Dropping outside a target returns the item.</li></ul>
                </div>
              </div>
              <p class="lay-ds-sec">State layers</p>
              <p class="lay-ds-note">A tint of the content colour laid over a component in each interaction state.</p>
              <div class="lay-ds-two">
                <div class="lay-ds-states" data-t="behaviour.state-layers">@for (key of ['enabled'].concat(stateKeys); track key) { <span class="lay-ds-state" [style.--o]="key === 'enabled' ? 0 : 'var(--mat-sys-' + key + '-state-layer-opacity)'">{{ key }}</span> }</div>
                <div class="lay-ds-contract">@for (key of stateKeys; track key) { <label>{{ key }} · {{ t.behaviours.stateLayers[key] }}<input type="range" min="0" max="0.3" step="0.01" [ngModel]="t.behaviours.stateLayers[key]" (ngModelChange)="set(['behaviours', 'stateLayers', key], +$event)"></label> }</div>
              </div>
            }
            @case ('icons') {
              <h2 class="lay-ds-h" data-t="type.headline-small">Icons</h2>
              <p class="lay-ds-note">Material Symbols (rounded). The app's pages and components use these; the build adds only these to its icon font. Weight, fill and grade settings come later: they need a per-project icon font.</p>
              <div class="lay-ds-icons" data-t="icons.set">@for (icon of appIcons(); track icon) { <span class="lay-ds-ig"><mat-icon aria-hidden="true">{{ icon }}</mat-icon>{{ icon.replace('_', ' ') }}</span> }</div>
            }
            @case ('sample-browse') {
              <div class="lay-ds-app">
                <nav class="lay-ds-appnav" data-t="color.surface-container-low corner.large" aria-label="Sample navigation">
                  <div class="lay-row lay-ds-appbrand"><span class="lay-ds-mark" data-t="color.primary">{{ markText() }}</span><strong data-t="type.title-medium">{{ appName() }}</strong></div>
                  @for (page of navPages(); track page.label; let i = $index) { <a class="lay-ds-navitem" [class.lay-ds-on]="i === 0" [attr.data-t]="(i === 0 ? 'color.primary-container' : 'color.on-surface-variant') + ' corner.full type.label-large'"><mat-icon aria-hidden="true">{{ page.icon }}</mat-icon>{{ page.label }}</a> }
                </nav>
                <div>
                  <div class="lay-ds-top" data-t="type.title-large face.brand"><span>{{ navPages()[0]?.label || 'Home' }}</span><button matIconButton aria-label="Notifications" data-t="color.on-surface-variant corner.full"><mat-icon>notifications</mat-icon></button></div>
                  <mat-form-field appearance="fill" class="lay-ds-wide" subscriptSizing="dynamic" data-t="color.surface-container-highest corner.extra-small type.body-large"><mat-icon matPrefix>search</mat-icon><mat-label>Search</mat-label><input matInput></mat-form-field>
                  <mat-chip-listbox class="lay-ds-chips" aria-label="Filters" multiple data-t="corner.small type.label-large"><mat-chip-option selected data-t="color.secondary-container">All</mat-chip-option><mat-chip-option>Nearby</mat-chip-option><mat-chip-option>New</mat-chip-option></mat-chip-listbox>
                  <div class="lay-ds-cards">
                    @for (item of sampleItems(); track item.title) {
                      <mat-card appearance="raised" data-t="elevation.level1 color.surface-container-low corner.medium">
                        <div class="lay-ds-media" data-t="color.primary-container color.tertiary-container"><mat-icon aria-hidden="true">{{ item.icon }}</mat-icon></div>
                        <mat-card-header><mat-card-title data-t="type.title-medium">{{ item.title }}</mat-card-title><mat-card-subtitle data-t="type.body-medium color.on-surface-variant">{{ item.sub }}</mat-card-subtitle></mat-card-header>
                        <mat-card-actions align="end"><button matButton="text" data-t="color.primary">Details</button><button matButton="filled" data-t="color.primary corner.full">Open</button></mat-card-actions>
                      </mat-card>
                    }
                  </div>
                  <div class="lay-ds-fabrow"><button matExtendedFab data-t="color.primary-container elevation.level3 corner.large type.label-large"><mat-icon>add</mat-icon>New</button></div>
                  <nav class="lay-ds-phonebar" data-t="color.surface-container" aria-label="Sample tabs">@for (page of navPages().slice(0, 4); track page.label; let i = $index) { <span class="lay-ds-bi" [class.lay-ds-on]="i === 0"><span class="lay-ds-ind" [attr.data-t]="i === 0 ? 'color.primary-container corner.full' : null"><mat-icon aria-hidden="true">{{ page.icon }}</mat-icon></span>{{ page.label }}</span> }</nav>
                </div>
              </div>
            }
            @case ('sample-form') {
              <div class="lay-ds-two">
                <div>
                  <h2 class="lay-ds-h" data-t="type.headline-medium face.brand" [style.font]="'var(--mat-sys-headline-medium)'">Settings</h2>
                  <p data-t="type.body-large color.on-surface-variant" [style.font]="'var(--mat-sys-body-large)'" class="lay-ds-muted">Change how {{ appName() }} works for you.</p>
                  <mat-form-field appearance="fill" class="lay-ds-wide" data-t="color.surface-container-highest corner.extra-small"><mat-label>Display name</mat-label><input matInput value="Ada Lovelace"></mat-form-field>
                  <mat-form-field appearance="outline" class="lay-ds-wide" data-t="color.outline corner.extra-small"><mat-label>Email</mat-label><input matInput value="ada@example.com"><mat-hint>We never share it</mat-hint></mat-form-field>
                  <mat-form-field appearance="outline" class="lay-ds-wide" data-t="color.error"><mat-label>Phone</mat-label><input matInput value="123" [attr.aria-invalid]="true"><mat-hint class="lay-ds-err">Use a full number with an area code</mat-hint></mat-form-field>
                  <mat-slide-toggle [checked]="true" data-t="color.primary corner.full">Email me when someone replies</mat-slide-toggle>
                  <div class="lay-row lay-wrap lay-ds-gap"><button matButton="filled" data-t="color.primary corner.full type.label-large">Save</button><button matButton="outlined" data-t="color.outline corner.full">Cancel</button><button matButton="text" data-t="color.primary">Reset</button><button matButton="elevated" data-t="elevation.level1 color.surface-container-low">Preview</button></div>
                </div>
                <div>
                  <div class="lay-ds-dialog" data-t="color.surface-container-high corner.extra-large elevation.level3">
                    <h3 data-t="type.headline-small" [style.font]="'var(--mat-sys-headline-small)'">Discard changes?</h3>
                    <p data-t="type.body-medium color.on-surface-variant" [style.font]="'var(--mat-sys-body-medium)'">Your edits to this page will be lost.</p>
                    <div class="lay-row lay-ds-end"><button matButton="text">Keep editing</button><button matButton="text">Discard</button></div>
                  </div>
                  <div class="lay-ds-list" data-t="color.surface corner.medium">
                    @for (person of people; track person[0]) { <div class="lay-ds-li" data-t="type.body-large"><span class="lay-ds-av" data-t="color.primary-container corner.full">{{ person[0][0] }}</span><span><strong>{{ person[0] }}</strong><small data-t="type.body-medium color.on-surface-variant">{{ person[1] }}</small></span></div> }
                  </div>
                </div>
              </div>
            }
          }
        </div>
        @for (b of boxes(); track $index) { <span class="lay-ds-hl" [class.lay-ds-hlsel]="b.selected" [style.left.px]="b.left" [style.top.px]="b.top" [style.width.px]="b.width" [style.height.px]="b.height">@if (b.label) { <span>{{ b.label }}</span> }</span> }
      </div>
      @if (hint(); as h) { <div class="lay-ds-hint" role="status"><mat-icon aria-hidden="true">visibility_off</mat-icon><span><strong>{{ h.name }}</strong> isn't on this page.</span><button type="button" (click)="goPage(h.page)">Show on {{ pageTitle(h.page) }}</button></div> }
      <div class="lay-ds-foot">
        <button type="button" class="lay-button ghost small" (click)="goPage(pageIndex() - 1)" [disabled]="pageIndex() === 0"><mat-icon aria-hidden="true">chevron_left</mat-icon>{{ pageIndex() > 0 ? pages[pageIndex() - 1].title : 'Previous' }}</button>
        <span class="lay-push"></span>
        <div class="lay-ds-dots" role="group" aria-label="Preview pages">@for (p of pages; track p.id; let i = $index) { @if (i === 8) { <span class="lay-ds-dsep"></span> }<button type="button" [class.lay-ds-on]="i === pageIndex()" (click)="goPage(i)" [attr.aria-label]="p.title" [attr.aria-current]="i === pageIndex() ? 'page' : null" [title]="p.title"></button> }</div>
        <small class="lay-muted">{{ pageIndex() + 1 }} of {{ pages.length }}</small>
        <span class="lay-push"></span>
        <button type="button" class="lay-button ghost small" (click)="goPage(pageIndex() + 1)" [disabled]="pageIndex() === pages.length - 1">{{ pageIndex() < pages.length - 1 ? pages[pageIndex() + 1].title : 'Next' }}<mat-icon aria-hidden="true">chevron_right</mat-icon></button>
      </div>
    </section>
  </div>

  <ng-template #box let-p="p" let-tone="tone">
    <button type="button" class="lay-ds-box" [class.lay-ds-editing]="popover()?.kind === 'box' && popover()?.id === p.key + ':' + tone" [style.background]="toneColor(p, tone)" [style.color]="textOn(toneColor(p, tone))"
      [attr.data-t]="'palette.' + p.key" (click)="openBox($event, p.key, tone)" [attr.aria-label]="p.name + ' ' + tone + ', ' + toneColor(p, tone) + (tone === p.seedTone ? ', seed colour' : '')">
      {{ tone }}@if (tone === p.seedTone) { <span class="lay-ds-k">Seed</span> }@if (p.pins[tone]) { <mat-icon aria-hidden="true">push_pin</mat-icon> }</button>
  </ng-template>
  <ng-template #roleTile let-id="id">
    @if (roleRef(id); as ref) {
      <button type="button" class="lay-ds-role" [style.background]="ds.color(id)" [style.color]="pairColor(id)" [attr.data-t]="'color.' + id + ' palette.' + ref.palette" (click)="openAlias($event, id)">
        <span>{{ id }}</span><small><span>{{ shortPalette(ref.palette) }} {{ ref.tone }}</span>@if (contrastOf(id); as c) { <span>{{ c.toFixed(1) }}:1 {{ c >= 4.5 ? '✓' : '✗ AA' }}</span> }</small></button>
    }
  </ng-template>

  @if (popover(); as pop) {
    <div class="lay-ds-pop" [style.left.px]="pop.x" [style.top.px]="pop.y" role="dialog" [attr.aria-label]="popTitle()" (keydown.escape)="closePop()">
      <button type="button" class="lay-ds-popx" (click)="closePop()" aria-label="Close"><mat-icon aria-hidden="true">close</mat-icon></button>
      <strong>{{ popTitle() }}</strong>
      @switch (pop.kind) {
        @case ('box') {
          @if (boxInfo(); as b) {
            <div class="lay-row"><input type="color" [value]="b.hex" (input)="setTone(b, $any($event.target).value)" aria-label="Colour"><input class="lay-mono" [value]="b.hex" (change)="setTone(b, $any($event.target).value)" aria-label="Hex value" maxlength="7"></div>
            <small class="lay-muted">{{ b.seed ? 'Changing the seed colour regenerates every unpinned tone in this row.' : b.pinned ? 'Pinned: typed by hand, no longer generated.' : 'Generated from the seed. Editing it pins this tone.' }}</small>
            <small>On white <strong>{{ ratio(b.hex, '#ffffff') }}:1</strong> · on black <strong>{{ ratio(b.hex, '#000000') }}:1</strong></small>
            @if (b.users.length) { <small class="lay-muted">Used by {{ b.users.join(', ') }}</small> } @else { <small class="lay-muted">No role uses this tone.</small> }
            <div class="lay-row">@if (b.pinned) { <button type="button" class="lay-button ghost small" (click)="unpin(b)"><mat-icon aria-hidden="true">restart_alt</mat-icon>Unpin</button> }
              @if (!b.seed) { <button type="button" class="lay-button ghost small" (click)="makeSeed(b)"><mat-icon aria-hidden="true">key</mat-icon>Make seed</button> }</div>
          }
        }
        @case ('alias') {
          <small class="lay-muted">Points at <strong>{{ aliasText(pop.id) }}</strong> in {{ ds.mode() }} mode. Switch the preview's mode to set the other.</small>
          @for (p of t.palettes; track p.key) {
            <div class="lay-ds-pick"><span>{{ p.name }}</span><span class="lay-ds-pickrow">@for (tone of allTones(p.key); track tone) {
              <button type="button" [class.lay-ds-cur]="isAlias(pop.id, p.key, tone)" [style.background]="toneColor(p, tone)" [attr.aria-label]="p.name + ' ' + tone" [title]="p.name + ' ' + tone" (click)="setAlias(pop.id, p.key, tone)"></button> }</span></div>
          }
        }
        @case ('face') {
          <small class="lay-muted">Which type face this role uses. Size and weight are edited on the Type page.</small>
          <div class="lay-row">@for (face of faceKeys; track face) { <button type="button" class="lay-button small" [class.ghost]="faceOf(pop.id) !== face" (click)="editType(pop.id, 'face', face); closePop()">{{ face }} · {{ t.faces[face].split(',')[0] }}</button> }</div>
        }
      }
    </div>
  }

  @if (historyOpen()) {
    <div class="lay-scrim" (click)="historyOpen.set(false)"></div>
    <aside class="lay-drawer" aria-label="Token history">
      <button type="button" class="lay-drawer-close" (click)="historyOpen.set(false)" aria-label="Close"><mat-icon aria-hidden="true">close</mat-icon></button>
      <h2 class="lay-drawer-title">Token history</h2>
      <p class="lay-muted small">Every saved change is a revision of the whole token set.</p>
      @for (entry of ds.saved()?.history || []; track entry.revision) {
        <div class="lay-ds-rev" [class.lay-ds-cur]="entry.revision === ds.saved()?.revision"><span>r{{ entry.revision }}</span><div><strong>{{ entry.rationale }}</strong><small>{{ entry.author }} · {{ entry.createdAt.slice(0, 10) }}</small></div></div>
      }
    </aside>
  }
  }`
})
export class DesignTokensComponent {
  readonly ctx = inject(ProjectContext);
  readonly ds = inject(DesignState);
  readonly pages = tokenPages;
  readonly standardTones = standardTones; readonly cornerKeys = cornerKeys; readonly easingKeys = easingKeys; readonly durationKeys = durationKeys; readonly stateKeys = stateKeys;
  readonly faceKeys: ('brand' | 'plain')[] = ['brand', 'plain'];
  readonly slotKeys = ['label', 'headline', 'title', 'body'];
  readonly sampleText: Record<string, string> = { label: 'Nearby · 2 km away', headline: 'A weekend project, sorted', title: 'Lent by Priya · available Saturday', body: 'Comes with two batteries, a charger and a set of bits. Please return it charged; pick up from the porch after 6pm.' };
  readonly roleFamilies = ['primary', 'secondary', 'tertiary', 'error'];
  readonly surfaceRoles = ['surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest', 'surface', 'surface-dim', 'surface-bright'];
  readonly people = [['Priya Raman', 'Joined in March'], ['Marco Bianchi', 'Lent 3 times'], ['Aiyana Ross', 'New neighbour']];
  readonly tierName = { raw: 'Raw values', roles: 'Roles', rules: 'Rules' };
  readonly tierIcon = { raw: 'edit_note', roles: 'link', rules: 'category' };
  readonly tierNote = { raw: 'Typed-in values. Nothing in the app uses these directly.', roles: 'Point at raw values. The app uses these.', rules: 'Combine roles and values: elevation, motion, behaviour.' };
  readonly quotes = /'/g;
  readonly typeName = typeName; readonly shortPalette = shortPalette;

  readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');
  readonly dotE = viewChild<ElementRef<HTMLElement>>('dotE');
  readonly dotS = viewChild<ElementRef<HTMLElement>>('dotS');
  readonly filter = signal('');
  readonly hover = signal<string | null>(null);
  readonly selected = signal<string | null>(null);
  readonly boxes = signal<Box[]>([]);
  readonly hint = signal<{ name: string; page: number } | null>(null);
  readonly editing = signal('');
  readonly popover = signal<{ kind: 'box' | 'alias' | 'face'; id: string; x: number; y: number } | null>(null);
  readonly historyOpen = signal(false);
  readonly base = signal(0);
  readonly slots = signal<Record<string, string>>({ label: 'label-large', headline: 'headline-small', title: 'title-medium', body: 'body-medium' });
  readonly activeSlot = signal('title');
  readonly tryRole = signal<string | null>(null);
  readonly easing = signal('standard');
  readonly duration = signal('medium');
  readonly handle = signal<{ key: string; index: number } | null>(null);
  readonly dndItems = signal(['Cordless drill', 'Ladder (3 m)', 'Pressure washer', 'Tile cutter', 'Hedge trimmer']);
  readonly held = signal<number | null>(null);
  private heldFrom: string[] = [];
  readonly announce = signal('');
  private open = new Map<string, boolean>();

  readonly pageIndex = computed(() => Math.max(0, tokenPages.findIndex(page => page.id === this.ctx.segments()[2])));
  readonly pageInfo = computed(() => tokenPages[this.pageIndex()]);
  readonly sections = computed<TreeSection[]>(() => {
    const t = this.ds.tokens(); if (!t) return [];
    const mode = this.ds.mode();
    const alias = (id: string) => { const role = t.roles.find(entry => entry.id === id)!; const ref = mode === 'dark' ? role.dark : role.light; return { text: `${shortPalette(ref.palette)} ${ref.tone}`, color: roleColor(t, id, mode), role: id }; };
    const sections: TreeSection[] = [
      { tier: 'raw', key: 'palettes', title: 'Palettes', items: t.palettes.map(p => ({ tok: `palette.${p.key}`, label: p.name, page: 'palettes', raw: true, strip: [10, 30, 40, 60, 80, 90, 95].map(tone => paletteTone(p, tone)) })) },
      { tier: 'raw', key: 'faces', title: 'Type faces', items: this.faceKeys.map(face => ({ tok: `face.${face}`, label: face === 'brand' ? 'Brand' : 'Plain', page: 'type', raw: true, value: t.faces[face].split(',')[0].replace(/'/g, '') })) },
      { tier: 'raw', key: 'corners', title: 'Corners', closed: true, items: cornerKeys.map(key => ({ tok: `corner.${key}`, label: `corner ${key}`, page: 'shape', raw: true, value: t.corners[key] >= 999 ? 'full' : `${t.corners[key]}px` })) },
      { tier: 'raw', key: 'spacing', title: 'Spacing', closed: true, items: Object.entries(t.spacing).map(([key, value]) => ({ tok: `space.${key}`, label: `space ${key}`, page: 'shape', raw: true, value: `${value}px` })) },
      { tier: 'roles', key: 'colour', title: 'Colour', items: t.roles.map(role => ({ tok: `color.${role.id}`, label: role.id, page: 'roles', alias: alias(role.id) })) },
      { tier: 'roles', key: 'type', title: 'Type', closed: true, items: t.type.map(role => ({ tok: `type.${role.id}`, label: role.id, page: 'type', alias: { text: `${role.face} · ${role.size}`, color: '', type: role.id } })) },
      { tier: 'rules', key: 'elevation', title: 'Elevation', items: t.elevation.map(e => ({ tok: `elevation.level${e.level}`, label: `level ${e.level}`, page: 'elevation', value: `${this.short(e.fill)} + shadow` })) },
      { tier: 'rules', key: 'motion', title: 'Motion', closed: true, items: [...easingKeys.map(key => ({ tok: `easing.${key}`, label: `easing ${key.replace('emphasized', 'emph.')}`, page: 'motion', value: t.motion.easing[key].join(', ') })),
        ...durationKeys.map(key => ({ tok: `duration.${key}`, label: `duration ${key}`, page: 'motion', value: `${t.motion.durations[key]}ms` })),
        { tok: 'spring.spatial', label: 'spring', page: 'motion', value: `${t.motion.spring.stiffness} · ${t.motion.spring.damping}` }] },
      { tier: 'rules', key: 'behaviour', title: 'Behaviour', items: [{ tok: 'behaviour.drag', label: 'Drag and drop', page: 'behaviour', value: `lift ${t.behaviours.drag.lift}` },
        { tok: 'behaviour.state-layers', label: 'State layers', page: 'behaviour', value: `${t.behaviours.stateLayers['hover']} / ${t.behaviours.stateLayers['pressed']}` }] }
    ];
    const needle = this.filter().trim().toLowerCase();
    return needle ? sections.map(section => ({ ...section, items: section.items.filter(item => item.label.toLowerCase().includes(needle) || item.tok.includes(needle)) })).filter(section => section.items.length) : sections;
  });
  readonly spacing = computed(() => Object.entries(this.ds.tokens()?.spacing || {}));
  readonly appName = computed(() => this.ctx.data()?.brand?.find(asset => asset.key === 'name')?.text || this.ctx.setup()?.project?.name || 'App');
  readonly markText = computed(() => this.ctx.data()?.brand?.find(asset => asset.key === 'mark')?.mark?.text || this.appName().slice(0, 2).toUpperCase());
  readonly navPages = computed(() => { const pages = (this.ctx.data()?.pages || []).filter(page => page.inNav).slice(0, 5).map(page => ({ label: page.label, icon: page.icon })); return pages.length ? pages : [{ label: 'Home', icon: 'home' }, { label: 'Search', icon: 'search' }, { label: 'Profile', icon: 'person' }]; });
  readonly sampleItems = computed(() => { const icons = ['star', 'schedule', 'near_me']; const stories = (this.ctx.data()?.stories || []).slice(0, 3);
    return stories.length ? stories.map((story, i) => ({ title: story.title.length > 48 ? story.title.slice(0, 46) + '…' : story.title, sub: `${story.ref} · ${story.status}`, icon: icons[i] })) : ['First item', 'Second item', 'Third item'].map((title, i) => ({ title, sub: 'Supporting text', icon: icons[i] })); });
  readonly appIcons = computed(() => [...new Set([...(this.ctx.data()?.pages || []).map(page => page.icon), ...previewIcons.slice(0, 16).map(entry => entry.icon)])]);

  constructor() {
    // Keep the highlight boxes where the elements are when the canvas reflows: window size, mode, width or token changes.
    addEventListener('resize', () => this.refreshBoxes());
    effect(() => { this.ds.mode(); this.ds.width(); this.ds.vars(); this.pageIndex(); untracked(() => this.refreshBoxes()); });
  }

  // Sets one value in the draft by its path (templates can't hold arrow functions).
  set(path: (string | number)[], value: unknown) {
    this.ds.edit(t => { let node = t as unknown as Record<string | number, unknown>; for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>; node[path[path.length - 1]] = value; });
    this.refreshBoxes();
  }

  // ---- Navigation between preview pages (the URL keeps the page; no focus jump) ----
  goPage(index: number) {
    const target = tokenPages[Math.max(0, Math.min(tokenPages.length - 1, index))];
    const link = this.ctx.link('design', 'tokens', target.id);
    history.replaceState({}, '', link); this.ctx.path.set(link);
    this.editing.set(''); this.popover.set(null); this.tryRole.set(null); this.hint.set(null);
    this.stage()?.nativeElement.scrollTo({ top: 0 });
    this.refreshBoxes();
  }
  pageTitle(index: number) { return tokenPages[index]?.title || ''; }

  // ---- Tree: hover highlights, click selects (or places a type role in the selected slot) ----
  isOpen(section: TreeSection) { return this.filter() ? true : this.open.get(section.key) ?? !section.closed; }
  setOpen(section: TreeSection, event: Event) { if (!this.filter()) this.open.set(section.key, (event.target as HTMLDetailsElement).open); }
  hoverTok(item: TreeItem) { this.hover.set(item.tok); if (item.tok.startsWith('type.') && this.pageInfo().id === 'type') this.tryRole.set(item.tok.slice(5)); this.refreshBoxes(); }
  unhover() { this.hover.set(null); this.tryRole.set(null); this.refreshBoxes(); }
  selectTok(item: TreeItem) {
    if (item.tok.startsWith('type.') && this.pageInfo().id === 'type') { this.slots.update(slots => ({ ...slots, [this.activeSlot()]: item.tok.slice(5) })); this.tryRole.set(null); this.selected.set(item.tok); this.refreshBoxes(); return; }
    this.selected.set(this.selected() === item.tok ? null : item.tok);
    if (this.selected() && !this.matches(item.tok).length) this.goPage(tokenPages.findIndex(page => page.id === item.page));
    this.refreshBoxes();
  }
  private expand(tok: string) {
    const t = this.ds.tokens(); const set = new Set([tok]); if (!t) return set;
    if (tok.startsWith('palette.')) for (const role of t.roles) if ((this.ds.mode() === 'dark' ? role.dark : role.light).palette === tok.slice(8)) set.add(`color.${role.id}`);
    if (tok.startsWith('face.')) for (const role of t.type) if (role.face === tok.slice(5)) set.add(`type.${role.id}`);
    return set;
  }
  private matches(tok: string) {
    const canvas = this.canvas()?.nativeElement; if (!canvas) return [];
    const set = this.expand(tok);
    const all = [...canvas.querySelectorAll<HTMLElement>('[data-t]')].filter(element => (element.dataset['t'] || '').split(' ').some(value => set.has(value)));
    return all.filter(element => !all.some(other => other !== element && other.contains(element))).map(element => ({ element, label: (element.dataset['t'] || '').split(' ').find(value => set.has(value)) || tok }));
  }
  refreshBoxes() {
    setTimeout(() => {
      const stage = this.stage()?.nativeElement; if (!stage) return;
      const origin = stage.getBoundingClientRect();
      const place = (tok: string | null, selected: boolean) => {
        if (!tok) return [];
        const found = this.matches(tok);
        return found.map(({ element, label }) => { const r = element.getBoundingClientRect(); return { left: r.left - origin.left + stage.scrollLeft, top: r.top - origin.top + stage.scrollTop, width: r.width, height: r.height,
          label: found.length <= 14 ? label.replace(/^(color|type|palette|corner|elevation|face|space|easing|duration)\./, '') : '', selected }; });
      };
      this.boxes.set([...place(this.selected(), true), ...place(this.hover() !== this.selected() ? this.hover() : null, false)]);
      const tok = this.hover() || this.selected();
      if (tok && !this.matches(tok).length) {
        const page = tokenPages.findIndex(entry => entry.id === homePage[tok.split('.')[0]]);
        this.hint.set(page >= 0 && page !== this.pageIndex() ? { name: tok.split('.').slice(1).join('.'), page } : null);
      } else this.hint.set(null);
    });
  }

  // ---- Palettes ----
  toneColor(p: Palette, tone: number) { return paletteTone(p, tone); }
  textOn(hex: string) { return contrastText(hex); }
  ratio(a: string, b: string) { return contrastRatio(a, b).toFixed(1); }
  extraTones(key: string) { const t = this.ds.tokens(); if (!t) return []; return [...new Set(t.roles.flatMap(role => [role.light, role.dark]).filter(ref => ref.palette === key && !standardTones.includes(ref.tone)).map(ref => ref.tone))].sort((a, b) => a - b); }
  allTones(key: string) { return [...standardTones, ...this.extraTones(key)].sort((a, b) => a - b); }
  private place(event: Event) { const r = (event.currentTarget as HTMLElement).getBoundingClientRect(); return { x: Math.max(8, Math.min(innerWidth - 330, r.left)), y: r.bottom + 6 > innerHeight - 260 ? Math.max(8, r.top - 270) : r.bottom + 6 }; }
  openBox(event: Event, key: string, tone: number) { this.popover.set({ kind: 'box', id: `${key}:${tone}`, ...this.place(event) }); }
  openAlias(event: Event, role: string) { this.selected.set(`color.${role}`); this.popover.set({ kind: 'alias', id: role, ...this.place(event) }); this.refreshBoxes(); }
  openFace(event: Event, type: string) { this.popover.set({ kind: 'face', id: type, ...this.place(event) }); }
  closePop() { this.popover.set(null); }
  readonly popTitle = computed(() => { const pop = this.popover(); if (!pop) return ''; if (pop.kind === 'box') { const [key, tone] = pop.id.split(':'); return `${paletteOf(this.ds.tokens()!, key)?.name} ${tone}`; } return pop.kind === 'alias' ? `color.${pop.id}` : `type.${pop.id}`; });
  readonly boxInfo = computed(() => {
    const pop = this.popover(), t = this.ds.tokens(); if (!pop || pop.kind !== 'box' || !t) return null;
    const [key, toneText] = pop.id.split(':'); const tone = +toneText; const p = paletteOf(t, key)!;
    return { key, tone, hex: paletteTone(p, tone), seed: tone === p.seedTone, pinned: Boolean(p.pins[tone]),
      users: t.roles.filter(role => (role.light.palette === key && role.light.tone === tone) || (role.dark.palette === key && role.dark.tone === tone)).map(role => role.id) };
  });
  setTone(b: { key: string; tone: number; seed: boolean }, value: string) {
    const hex = String(value).trim().toLowerCase(); if (!/^#[0-9a-f]{6}$/.test(hex)) return;
    this.ds.edit(t => { const p = paletteOf(t, b.key)!; if (b.seed) p.seed = hex; else p.pins = { ...p.pins, [b.tone]: hex }; });
  }
  unpin(b: { key: string; tone: number }) { this.ds.edit(t => { const p = paletteOf(t, b.key)!; const pins = { ...p.pins }; delete pins[b.tone]; p.pins = pins; }); }
  makeSeed(b: { key: string; tone: number; hex: string }) { this.ds.edit(t => { const p = paletteOf(t, b.key)!; const pins = { ...p.pins }; delete pins[b.tone]; p.pins = pins; p.seed = b.hex; p.seedTone = b.tone; }); }

  // ---- Roles ----
  familyRoles(base: string) { return [base, `on-${base}`, `${base}-container`, `on-${base}-container`]; }
  roleRef(id: string) { const role = this.ds.tokens()?.roles.find(entry => entry.id === id); return role ? (this.ds.mode() === 'dark' ? role.dark : role.light) : null; }
  pairColor(id: string) { const t = this.ds.tokens()!; const pair = contrastPairs[id] || (id.startsWith('on-') ? id.slice(3) : null); return pair && t.roles.some(role => role.id === pair) ? this.ds.color(pair) : contrastText(this.ds.color(id)); }
  contrastOf(id: string) { const pair = contrastPairs[id]; return pair && this.ds.tokens()?.roles.some(role => role.id === pair) ? contrastRatio(this.ds.color(id), this.ds.color(pair)) : null; }
  aliasText(id: string) { const ref = this.roleRef(id); return ref ? `${paletteOf(this.ds.tokens()!, ref.palette)?.name} ${ref.tone}` : ''; }
  isAlias(id: string, palette: string, tone: number) { const ref = this.roleRef(id); return ref?.palette === palette && ref.tone === tone; }
  setAlias(id: string, palette: string, tone: number) { const mode = this.ds.mode(); this.ds.edit(t => { const role = t.roles.find(entry => entry.id === id)!; role[mode] = { palette, tone }; }); this.closePop(); this.refreshBoxes(); }
  short(role: string) { return role.replace('surface-container', 'container'); }

  // ---- Type ----
  stacksWith(current: string) { return faceStacks.includes(current) ? faceStacks : [current, ...faceStacks]; }
  setFace(face: 'brand' | 'plain', value: string) { this.ds.edit(t => t.faces[face] = value); }
  faceOf(id: string) { return this.ds.tokens()?.type.find(role => role.id === id)?.face; }
  editType(id: string, field: string, value: string | number) { this.ds.edit(t => { const role = t.type.find(entry => entry.id === id)!; (role as unknown as Record<string, string | number>)[field] = value; }); }
  slotRole(slot: string) { return this.activeSlot() === slot && this.tryRole() ? this.tryRole()! : this.slots()[slot]; }
  toggleEdit(kind: string, id: string) { this.editing.set(this.editing() === `${kind}:${id}` ? '' : `${kind}:${id}`); this.refreshBoxes(); }
  editingKey(kind: string) { const value = this.editing(); return value.startsWith(`${kind}:`) ? value.slice(kind.length + 1) : null; }

  // ---- Elevation and motion ----
  shadowOn(level: number) { return levelShadow(this.ds.tokens()!, level, this.base()); }
  bx(v: number) { return 14 + v * 132; }
  by(v: number) { return 106 - v * 92; }
  curve(a: number[]) { return `M${this.bx(0)},${this.by(0)} C${this.bx(a[0])},${this.by(a[1])} ${this.bx(a[2])},${this.by(a[3])} ${this.bx(1)},${this.by(1)}`; }
  grab(event: PointerEvent, key: string, index: number) { event.preventDefault(); (event.target as Element).closest('svg')?.setPointerCapture(event.pointerId); this.handle.set({ key, index }); }
  dragHandle(event: PointerEvent, key: string) {
    const handle = this.handle(); if (!handle || handle.key !== key) return;
    const svg = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = Math.min(1, Math.max(0, ((event.clientX - svg.left) * 160 / svg.width - 14) / 132));
    const y = Math.min(1.5, Math.max(-0.5, (106 - (event.clientY - svg.top) * 120 / svg.height) / 92));
    this.ds.edit(t => { const a = t.motion.easing[key]; a[handle.index * 2] = Math.round(x * 100) / 100; a[handle.index * 2 + 1] = Math.round(y * 100) / 100; });
  }
  private springAt(time: number) { const t = this.ds.tokens()!; const w = Math.sqrt(t.motion.spring.stiffness), z = t.motion.spring.damping;
    return z < 1 ? 1 - Math.exp(-z * w * time) * (Math.cos(w * Math.sqrt(1 - z * z) * time) + z / Math.sqrt(1 - z * z) * Math.sin(w * Math.sqrt(1 - z * z) * time)) : 1 - (1 + w * time) * Math.exp(-w * time); }
  private springLength() { const t = this.ds.tokens()!; return Math.min(2, 6 / (t.motion.spring.damping * Math.sqrt(t.motion.spring.stiffness))); }
  springPath() { const length = this.springLength(); return 'M' + Array.from({ length: 61 }, (_, i) => `${this.bx(i / 60)},${this.by(0.8 * this.springAt(length * i / 60))}`).join(' L'); }
  play() {
    const e = this.dotE()?.nativeElement, s = this.dotS()?.nativeElement, t = this.ds.tokens(); if (!e || !s || !t) return;
    const distance = (e.parentElement?.clientWidth || 300) - 44;
    e.style.transition = 'none'; e.style.transform = 'translateX(0)'; void e.offsetWidth;
    e.style.transition = `transform ${t.motion.durations[this.duration()]}ms cubic-bezier(${t.motion.easing[this.easing()].join(',')})`; e.style.transform = `translateX(${distance}px)`;
    const length = this.springLength(), start = performance.now();
    const step = (now: number) => { const time = Math.min((now - start) / 1000, length); s.style.transform = `translateX(${this.springAt(time) * distance}px)`; if (time < length) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // ---- Drag and drop (the Angular CDK the app would use) with its keyboard alternative ----
  drop(event: CdkDragDrop<string[]>) { const items = [...this.dndItems()]; moveItemInArray(items, event.previousIndex, event.currentIndex); this.dndItems.set(items); this.announce.set(`Dropped. Position ${event.currentIndex + 1} of ${items.length}.`); }
  dndKey(event: KeyboardEvent, index: number) {
    const items = this.dndItems();
    if (event.key === ' ') {
      event.preventDefault();
      if (this.held() === null) { this.heldFrom = [...items]; this.held.set(index); this.announce.set(`Picked up ${items[index]}. Position ${index + 1} of ${items.length}. Arrows to move, Space to drop, Escape to cancel.`); }
      else { this.announce.set(`Dropped ${items[index]}. Position ${index + 1} of ${items.length}.`); this.held.set(null); }
    } else if (this.held() !== null && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const to = Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))); if (to === index) return;
      const next = [...items]; moveItemInArray(next, index, to); this.dndItems.set(next); this.held.set(to);
      this.announce.set(`${next[to]}. Position ${to + 1} of ${next.length}.`);
      setTimeout(() => (document.querySelectorAll<HTMLElement>('.lay-ds-ditem')[to])?.focus());
    } else if (this.held() !== null && event.key === 'Escape') { this.dndItems.set(this.heldFrom); this.held.set(null); this.announce.set('Cancelled. Back where it was.'); }
  }
}
export type { Tokens };
