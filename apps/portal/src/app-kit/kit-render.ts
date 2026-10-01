import { Component, input, output } from '@angular/core';
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

// App-kit rendering (T03-DESIGN): draws one component of the app being built from its preview kind and properties, with
// the stack's real components (Angular Material and the aludel-web-v1 template). It knows no layer: whoever shows a kit
// (Design's editor, Pages' spec preview) passes the values in, and the theme comes from ThemeScopeDirective around it.
export type KitProps = Record<string, string | boolean>;
const appearance: Record<string, string> = { Filled: 'filled', Tonal: 'tonal', Outlined: 'outlined', Text: 'text', Elevated: 'elevated' };
const cardAppearance: Record<string, 'raised' | 'filled' | 'outlined'> = { Elevated: 'raised', Filled: 'filled', Outlined: 'outlined' };
// The preview kinds this renderer draws.
export const kitPreviewKinds = ['button', 'icon-button', 'fab', 'card', 'chip', 'switch', 'text-field', 'list', 'list-item', 'nav-list', 'nav-item', 'toolbar', 'nav-bar', 'dialog', 'scaffold'];

// Nested items are clickable so their own properties can be set.
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
  readonly props = input.required<KitProps>();
  readonly children = input<KitProps[]>([]);
  readonly state = input('enabled');
  readonly selectedChild = input<number | null>(null);
  readonly childSelect = output<number>();
  readonly appearance = appearance; readonly cardAppearance = cardAppearance;
  readonly valid = new FormControl('ada@example.com');
  readonly invalid = new FormControl('ada@');
  constructor() { this.invalid.setErrors({ email: true }); this.invalid.markAsTouched(); }
  pick(event: Event, index: number) { event.stopPropagation(); event.preventDefault(); this.childSelect.emit(index); }
}
