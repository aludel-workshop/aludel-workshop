// Placeholder page layouts. This file is copied verbatim into every generated app (aludel-web-v1), and the
// onboarding preview renders the same component, so what someone sees before building is what they get.
// Keep it dependency-free: no Material, no portal imports. Layouts come from config/page-types.json.
import { Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export interface PageBlock { t: string; w?: number; n?: number; }
// PAGES-UX-01: a section from the page's spec in Aludel. Each is marked so Aludel's Pages layer can point at it in a
// preview; keep data-aludel-section on it when you build the real UI (and drop data-aludel-skeleton then).
export interface PageSection { id: string; name: string; kind: string | null; region: string; title: string; body: string; action: string; leadsTo: string | null; }
// The placeholder each design-system component shows until it is built.
const kindBlock: Record<string, PageBlock> = { list: { t: 'list', n: 3 }, 'list-item': { t: 'list', n: 1 }, card: { t: 'tile' }, 'text-field': { t: 'fields', n: 2 }, chip: { t: 'search' },
  switch: { t: 'toggles', n: 2 }, button: { t: 'button' }, fab: { t: 'button' }, 'icon-button': { t: 'button' }, dialog: { t: 'text', n: 2 }, toolbar: { t: 'text', n: 1 } };

@Component({
  selector: 'page-blocks', standalone: true,
  imports: [NgTemplateOutlet],
  template: `
  @if (sections().length) {
    <div class="sections" [class.two]="hasSide()">
      @for (region of regions(); track region.name) {
        <div class="region">
          @for (section of region.items; track section.id) {
            <section class="section" [attr.data-aludel-section]="section.id" data-aludel-skeleton="" [attr.aria-label]="section.name">
              @if (section.title) { <h2>{{ section.title }}</h2> }
              @if (section.body) { <p>{{ section.body }}</p> }
              <div class="block" [class]="'block ' + section.block.t" aria-hidden="true"><ng-container *ngTemplateOutlet="cell; context: { $implicit: section.block }" /></div>
              @if (section.action) { <a class="action" [attr.href]="section.leadsTo">{{ section.action }}</a> }
            </section>
          }
        </div>
      }
    </div>
  } @else {
  <div class="blocks" [class.compact]="compact()" aria-hidden="true">
    @for (block of layout(); track $index) {
      <div class="block" [class]="'block ' + block.t" [style.grid-column]="'span ' + block.span"><ng-container *ngTemplateOutlet="cell; context: { $implicit: block }" /></div>
    }
  </div>
  }
  <ng-template #cell let-block>
        @switch (block.t) {
          @case ('stat') { <i class="line short"></i><b class="figure"></b> }
          @case ('chart') { <i class="line short"></i><div class="bars">@for (h of bars; track $index) { <span [style.height.%]="h"></span> }</div> }
          @case ('list') { @for (row of block.rows; track $index) { <div class="row"><span class="avatar"></span><div><i class="line"></i><i class="line short"></i></div></div> } }
          @case ('table') { <div class="thead"></div>@for (row of block.rows; track $index) { <div class="trow"><i class="line"></i><i class="line"></i><i class="line short"></i></div> } }
          @case ('composer') { <span class="avatar"></span><i class="line pill"></i> }
          @case ('post') { <div class="row"><span class="avatar"></span><div><i class="line short"></i><i class="line tiny"></i></div></div><i class="line"></i><i class="line"></i><div class="media wide"></div> }
          @case ('search') { <i class="line pill"></i><span class="chip"></span><span class="chip"></span> }
          @case ('tile') { <div class="media"></div><i class="line"></i><i class="line short"></i> }
          @case ('media') { <div class="media tall"></div> }
          @case ('text') { @for (row of block.rows; track $index) { <i class="line" [class.short]="$last"></i> } }
          @case ('chat') { <span class="bubble in"></span><span class="bubble out"></span><span class="bubble in wide"></span><span class="bubble out"></span><i class="line pill"></i> }
          @case ('fields') { @for (row of block.rows; track $index) { <i class="line short label"></i><span class="field"></span> } }
          @case ('button') { <span class="button"></span> }
          @case ('toggles') { @for (row of block.rows; track $index) { <div class="toggle-row"><div><i class="line"></i><i class="line tiny"></i></div><span class="toggle"></span></div> } }
        }
  </ng-template>`,
  styles: [`
    :host { display: block; --blk-fill: color-mix(in srgb, currentColor 10%, transparent); --blk-strong: color-mix(in srgb, currentColor 18%, transparent); }
    .blocks { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; }
    .blocks.compact .block { grid-column: span 12 !important; }
    .blocks.compact .block.stat, .blocks.compact .block.tile { grid-column: span 6 !important; }
    .block { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: var(--blk-radius, 12px); background: var(--blk-card, color-mix(in srgb, currentColor 4%, transparent)); border: 1px solid var(--blk-fill); min-width: 0; }
    .block.search, .block.text, .block.button, .block.media { background: transparent; border: 0; padding: 0; }
    .block.search { flex-direction: row; align-items: center; }
    .block.composer { flex-direction: row; align-items: center; }
    .line { display: block; height: 10px; border-radius: 6px; background: var(--blk-fill); width: 100%; }
    .line.short { width: 55%; } .line.tiny { width: 30%; height: 8px; } .line.label { width: 28%; height: 8px; }
    .line.pill { height: 36px; border-radius: 999px; flex: 1; }
    .figure { display: block; height: 26px; width: 60%; border-radius: 6px; background: var(--blk-accent, var(--blk-strong)); opacity: .55; }
    .bars { display: flex; align-items: flex-end; gap: 8px; height: 140px; }
    .bars span { flex: 1; border-radius: 6px 6px 2px 2px; background: var(--blk-accent, var(--blk-strong)); opacity: .45; }
    .row { display: flex; gap: 10px; align-items: center; } .row > div { flex: 1; display: grid; gap: 6px; }
    .avatar { flex: none; width: 34px; height: 34px; border-radius: 50%; background: var(--blk-strong); }
    .thead { height: 12px; border-radius: 4px; background: var(--blk-strong); }
    .trow { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; padding: 6px 0; border-top: 1px solid var(--blk-fill); }
    .chip { flex: none; width: 64px; height: 30px; border-radius: 999px; background: var(--blk-fill); }
    .media { height: 110px; border-radius: calc(var(--blk-radius, 12px) * .75); background: var(--blk-strong); }
    .media.wide { height: 150px; } .media.tall { height: 170px; }
    .bubble { display: block; height: 34px; width: 55%; border-radius: 16px; background: var(--blk-fill); }
    .bubble.out { align-self: flex-end; background: var(--blk-accent, var(--blk-strong)); opacity: .45; } .bubble.wide { width: 70%; height: 52px; }
    .field { display: block; height: 40px; border-radius: 8px; border: 1.5px solid var(--blk-strong); margin-bottom: 6px; }
    .button { display: block; width: 140px; height: 40px; border-radius: 999px; background: var(--blk-accent, var(--blk-strong)); opacity: .7; }
    .toggle-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--blk-fill); } .toggle-row > div { flex: 1; display: grid; gap: 6px; }
    .toggle-row:first-child { border-top: 0; }
    .toggle { flex: none; width: 38px; height: 22px; border-radius: 999px; background: var(--blk-strong); }
    .sections { display: grid; gap: 18px; }
    .sections.two { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); align-items: start; }
    .region { display: grid; gap: 18px; min-width: 0; }
    .section { display: grid; gap: 10px; }
    .section h2 { margin: 0; font-size: 1.2rem; }
    .section p { margin: 0; opacity: .8; }
    .action { justify-self: start; padding: 9px 20px; border-radius: 999px; background: var(--blk-accent, var(--blk-strong)); color: var(--blk-on-accent, inherit); text-decoration: none; font-weight: 500; }
    @media (max-width: 700px) { .sections.two { grid-template-columns: minmax(0, 1fr); } }
  `]
})
export class PageBlocksComponent {
  readonly blocks = input<PageBlock[]>([]);
  readonly compact = input(false);
  readonly bars = [45, 70, 55, 90, 65, 80, 50];
  readonly sections = input<PageSection[]>([]);
  readonly layout = computed(() => this.blocks().map(block => this.shape(block)));
  readonly hasSide = computed(() => this.sections().some(section => section.region === 'side'));
  readonly regions = computed(() => {
    const items = this.sections().map(section => ({ ...section, block: this.shape(kindBlock[section.kind || ''] || { t: 'text', n: 2 }) }));
    return this.hasSide() ? [{ name: 'main', items: items.filter(item => item.region !== 'side') }, { name: 'side', items: items.filter(item => item.region === 'side') }] : [{ name: 'main', items }];
  });
  private shape(block: PageBlock) { return { ...block, span: Math.min(12, Math.max(1, block.w || 12)), rows: Array.from({ length: block.n || 3 }) }; }
}
