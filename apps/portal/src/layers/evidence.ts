import { Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';
import { RefChipComponent } from './work-shared';

// ROADMAP-01 (DEC-042/043): evidence attaches to records in every layer; one chip shows it and one panel holds it.
// The chip is an icon, a label and a number when there is more than one; with evidence both ways it splits into
// "supports | contradicts", icons and numbers only.
@Component({
  selector: 'aludel-evidence', standalone: true, imports: [MatIconModule],
  template: `
  @if (counts(); as c) {
    @if (c.sup && c.con) {
      <button type="button" class="lay-evsplit" (click)="open($event)" [attr.aria-label]="'Evidence: ' + c.sup + ' supporting, ' + c.con + ' contradicting'">
        <span class="lay-ev-s"><mat-icon aria-hidden="true">check_circle</mat-icon>{{ c.sup }}</span><span class="lay-ev-c"><mat-icon aria-hidden="true">report</mat-icon>{{ c.con }}</span></button>
    } @else if (c.con) {
      <button type="button" class="lay-evchip lay-evchip-con" (click)="open($event)"><mat-icon aria-hidden="true">report</mat-icon>Contradicted@if (c.con > 1) { <b>{{ c.con }}</b> }</button>
    } @else if (c.sup) {
      <button type="button" class="lay-evchip lay-evchip-sup" (click)="open($event)"><mat-icon aria-hidden="true">check_circle</mat-icon>Supported@if (c.sup > 1) { <b>{{ c.sup }}</b> }</button>
    } @else if (claim()) {
      <button type="button" class="lay-evchip" (click)="open($event)"><mat-icon aria-hidden="true">help</mat-icon>Assumed</button>
    } @else if (always()) {
      <button type="button" class="lay-evchip lay-evchip-add" (click)="open($event)"><mat-icon aria-hidden="true">add</mat-icon>Evidence</button>
    }
  }`
})
export class EvidenceChipComponent {
  private readonly ctx = inject(ProjectContext);
  readonly id = input.required<string>();
  // A Brief claim shows "Assumed" when nothing is attached; other records show nothing (or "+ Evidence" with always).
  readonly claim = input(false);
  readonly always = input(false);
  readonly counts = computed(() => { const links = this.ctx.evidenceFor(this.id()); const con = links.filter(link => link.direction === 'contradicts').length; return { sup: links.length - con, con }; });
  open(event: Event) { event.preventDefault(); event.stopPropagation(); this.ctx.evidenceOpen.set(this.id()); }
}

// One finding: a quote, a fact, a picture's caption, or a small table drawn as a bar chart (one series: one hue,
// values labelled, a hover tip per bar, and the table behind a disclosure).
@Component({
  selector: 'aludel-finding', standalone: true, imports: [MatIconModule, RefChipComponent],
  template: `
  @if (finding(); as f) {
    <div class="lay-finding"><mat-icon aria-hidden="true">{{ icons[f.type] || 'format_quote' }}</mat-icon>
      <div>
        @if (f.type === 'quote') { <q>{{ f.text }}</q> } @else { <span>{{ f.text }}</span> }
        @if (f.type === 'data' && f.data.length) {
          <figure class="lay-chart"><figcaption>{{ total() }} answers</figcaption>
            <div class="lay-bars" [style.grid-template-columns]="'repeat(' + f.data.length + ', minmax(0, 1fr))'">
              @for (row of f.data; track row[0]) {
                <div class="lay-bar-col" tabindex="0" [attr.aria-label]="row[0] + ': ' + row[1]"><span class="lay-bar-v">{{ row[1] }}</span><span class="lay-bar-b" [style.height.px]="(row[1] / max()) * 80"></span><span class="lay-bar-tip">{{ row[0] }}: {{ row[1] }}</span></div>
              }
            </div>
            <div class="lay-bar-x" aria-hidden="true" [style.grid-template-columns]="'repeat(' + f.data.length + ', minmax(0, 1fr))'">@for (row of f.data; track row[0]) { <span>{{ row[0] }}</span> }</div>
            <details><summary>Table</summary><table><tbody>@for (row of f.data; track row[0]) { <tr><td>{{ row[0] }}</td><td>{{ row[1] }}</td></tr> }</tbody></table></details>
          </figure>
        }
        @if (showSource()) { <span class="lay-finding-src"><aludel-ref [id]="f.sourceId" /></span> }
      </div>
    </div>
  }`
})
export class FindingComponent {
  private readonly ctx = inject(ProjectContext);
  readonly id = input.required<string>();
  readonly showSource = input(true);
  readonly icons: Record<string, string> = { quote: 'format_quote', fact: 'fact_check', data: 'bar_chart', image: 'image' };
  readonly finding = computed(() => this.ctx.findingById().get(this.id()) || null);
  readonly max = computed(() => Math.max(1, ...(this.finding()?.data || []).map(row => row[1])));
  readonly total = computed(() => (this.finding()?.data || []).reduce((sum, row) => sum + row[1], 0));
}

// The evidence panel: what supports or contradicts a record, grouped by where it comes from; attach or detach insights.
@Component({
  selector: 'aludel-evidence-panel', standalone: true, imports: [FormsModule, NgTemplateOutlet, MatIconModule, RefChipComponent, EvidenceChipComponent, FindingComponent],
  template: `
  @if (ctx.evidenceOpen(); as id) {
    <aside class="lay-drawer lay-evidence-drawer" role="dialog" aria-labelledby="lay-evidence-title" tabindex="-1">
      <button type="button" class="lay-close" (click)="close()" aria-label="Close evidence"><mat-icon>close</mat-icon></button>
      @if (info(); as r) {
        <p class="lay-eyebrow">{{ r.kindLabel }}</p>
        <h2 id="lay-evidence-title" class="lay-drawer-title">{{ r.title }}</h2>
        <p class="lay-row lay-wrap"><aludel-evidence [id]="id" [claim]="r.kind === 'brief_claim'" /><a [href]="r.href" (click)="close(); ctx.go(r.href, $event)">Open it</a></p>
        <h3>Evidence</h3>
        @if (via().length) {
          <p class="lay-ev-group"><mat-icon aria-hidden="true">fact_check</mat-icon>Through its problem <aludel-ref [id]="viaId()" [short]="true" /></p>
          @for (link of via(); track link.id) { <ng-container *ngTemplateOutlet="block; context: { $implicit: link, mine: false }" /> }
          <p class="lay-ev-group"><mat-icon aria-hidden="true">bookmark</mat-icon>On this story</p>
        }
        @for (link of own(); track link.id) { <ng-container *ngTemplateOutlet="block; context: { $implicit: link, mine: true }" /> }
        @empty { <p class="lay-muted">{{ via().length ? 'Nothing specific to this story.' : 'Nothing attached yet.' }}</p> }
        <form class="lay-attach" (ngSubmit)="attach(id)">
          <strong>Attach an insight</strong>
          <label>From the Library<select name="insight" [(ngModel)]="insight"><option value="">Choose an insight</option>@for (option of free(); track option.id) { <option [value]="option.id">{{ option.text }}</option> }</select></label>
          <div class="lay-row lay-wrap"><span class="lay-dirpick" role="group" aria-label="Direction">
            <button type="button" [attr.aria-pressed]="direction === 'supports'" (click)="direction = 'supports'">Supports</button><button type="button" [attr.aria-pressed]="direction === 'contradicts'" (click)="direction = 'contradicts'">Contradicts</button></span>
            <button type="submit" class="lay-button small" [disabled]="!insight">Attach</button>
            <a class="lay-push" [href]="ctx.link('library')" (click)="close(); ctx.go(ctx.link('library'), $event)">Library</a></div>
        </form>
      }
    </aside>
  }
  <ng-template #block let-link let-mine="mine">
    @if (ctx.insightById().get(link.insightId); as insight) {
      <article class="lay-insight" [class.lay-insight-contra]="link.direction === 'contradicts'">
        <header><aludel-ref [id]="insight.id" [short]="true" /><span [class]="'lay-chip ' + (link.direction === 'contradicts' ? 'lay-bad' : 'lay-ok')">{{ link.direction === 'contradicts' ? 'Contradicts' : 'Supports' }}</span>
          <span class="lay-strength" [attr.data-s]="insight.strength">{{ insight.strength }}</span>
          @if (mine) { <button type="button" class="lay-link-button lay-push" (click)="detach(link.id)" [attr.aria-label]="'Detach ' + insight.text">Detach</button> }</header>
        <h4>{{ insight.text }}</h4>
        @for (finding of insight.findings; track finding) { <aludel-finding [id]="finding" /> }
      </article>
    }
  </ng-template>`
})
export class EvidencePanelComponent {
  readonly ctx = inject(ProjectContext);
  insight = '';
  direction: 'supports' | 'contradicts' = 'supports';
  readonly info = computed(() => this.ctx.refInfo(this.ctx.evidenceOpen() || ''));
  readonly own = computed(() => this.ctx.evidenceFor(this.ctx.evidenceOpen() || '').filter(link => !link.via));
  readonly via = computed(() => this.ctx.evidenceFor(this.ctx.evidenceOpen() || '').filter(link => link.via));
  readonly viaId = computed(() => this.via()[0]?.via || '');
  readonly free = computed(() => { const taken = new Set(this.own().map(link => link.insightId)); return (this.ctx.data()?.insights || []).filter(insight => !taken.has(insight.id)); });
  close() { this.ctx.evidenceOpen.set(null); this.insight = ''; }
  constructor() { document.addEventListener('keydown', event => { if (event.key === 'Escape' && this.ctx.evidenceOpen()) this.close(); }); }
  attach(recordId: string) {
    const insightId = this.insight; if (!insightId) return;
    void this.ctx.write(async () => { await this.ctx.record('evidence_link', { insightId, recordId, direction: this.direction }); this.insight = ''; }, this.direction === 'contradicts' ? 'Attached: it contradicts this.' : 'Attached: it supports this.');
  }
  detach(linkId: string) { void this.ctx.write(() => this.ctx.delete(linkId), 'Detached.'); }
}
