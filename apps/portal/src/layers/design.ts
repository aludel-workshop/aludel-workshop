import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { contrastText, readableAccent } from '../color';
import { ProjectContext } from './context';

// Design: the design system (knowledge-structures.md › Design). Tokens are derived exactly as the scaffold derives them.
@Component({
  selector: 'aludel-design-layer', standalone: true,
  imports: [MatIconModule],
  template: `
  <p class="lay-eyebrow">Design · the design system</p>
  <h1 tabindex="-1">{{ ctx.setup()?.project?.name }}'s design system</h1>
  <nav class="lay-tabs" aria-label="Design sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('design', entry[0])" (click)="ctx.go(ctx.link('design', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }
  </nav>
  @switch (tab()) {
    @case ('components') {
      <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Components"><table><thead><tr><th>Component</th><th>Maturity</th><th>Source</th><th>Used on</th></tr></thead><tbody>
        @for (component of components(); track component.name) { <tr><td><strong>{{ component.name }}</strong><br><small class="lay-muted">{{ component.purpose }}</small></td><td><span class="lay-chip" [class.lay-ok]="component.maturity === 'Stable'" [class.lay-plain]="component.maturity !== 'Stable'">{{ component.maturity }}</span></td><td>{{ component.source }}</td><td>{{ component.usedOn }}</td></tr> }
      </tbody></table></div>
      <p class="lay-muted small">Each component carries a contract (purpose, anatomy, variants, states, accessibility) and matures proposed → incubating → stable → deprecated. New components arrive through design work.</p>
    }
    @case ('patterns') {
      <div class="lay-grid lay-g2">
        <section class="lay-card"><h2>Page types</h2><p class="lay-muted small">The archetypes both the page tree and the generated app use.</p>
          <ul class="lay-list">@for (type of pageTypes(); track type.id) { <li class="lay-item"><span class="lay-body-text"><strong>{{ type.label }}</strong><small>{{ type.summary }}</small></span></li> }</ul></section>
        <section class="lay-card"><h2>Navigation and interaction</h2><ul>
          <li>Desktop navigation: {{ ctx.setup()?.design?.navigation === 'top' ? 'top bar' : 'side bar' }}; phones: a bottom tab bar of up to five pages.</li>
          <li>Each page opens with its title, then a one-line description, then its content.</li>
          <li>Primary actions use the primary colour; destructive actions confirm in place.</li></ul></section>
      </div>
    }
    @case ('guidelines') {
      <div class="lay-grid lay-g2">
        <section class="lay-card"><h2>Design direction</h2><p class="lay-pre">{{ ctx.setup()?.design?.notes || 'No notes yet.' }}</p><a [href]="lookHref()">Edit direction and notes</a></section>
        <section class="lay-card"><h2>Accessibility baseline</h2><ul><li>WCAG 2.2 AA; body text at least 4.5:1 (the primary colour is derived to meet it).</li><li>Every action reachable by keyboard, with a visible focus ring.</li><li>Touch targets at least 44px.</li></ul></section>
        <section class="lay-card"><h2>Reference media</h2>
          @for (asset of ctx.setup()?.assets || []; track asset.id) { <p class="lay-row"><mat-icon aria-hidden="true">{{ asset.kind === 'image' ? 'image' : 'description' }}</mat-icon><span><strong>{{ asset.filename }}</strong><br><small class="lay-muted">{{ asset.notes || 'No usage note' }}</small></span></p> }
          @empty { <p class="lay-muted">None uploaded.</p> }</section>
      </div>
    }
    @case ('sources') {
      <div class="lay-grid lay-g2">
        <section class="lay-card"><h2>Sources</h2><dl class="lay-kv"><dt>Base system</dt><dd>Material Design 3 through Angular Material 22</dd><dt>Starting feel</dt><dd>{{ feel()?.label || 'Not chosen' }}</dd><dt>Token format</dt><dd>W3C Design Tokens (DTCG 2025.10)</dd></dl></section>
        <section class="lay-card"><h2>Deviations from the base</h2><div class="lay-table-wrap"><table><thead><tr><th>Change</th><th>Why</th></tr></thead><tbody>
          <tr><td>Primary colour derived from the accent</td><td>Keep the brand accent while meeting 4.5:1 contrast</td></tr>
          <tr><td>Corner radius {{ feel()?.radius }}px</td><td>{{ feel()?.label }} feel</td></tr></tbody></table></div></section>
      </div>
    }
    @default {
      <div class="lay-grid lay-g2">
        <section class="lay-card"><div class="lay-row"><h2 class="lay-flat">Feel</h2><a class="lay-push" [href]="lookHref()">Change look and feel</a></div>
          <p><strong>{{ feel()?.label || 'Not chosen yet' }}</strong>{{ feel() ? ': ' + feel()!.summary : '' }}</p>
          <dl class="lay-kv"><dt>Theme</dt><dd>{{ themeLabel() }}</dd><dt>Navigation</dt><dd>{{ ctx.setup()?.design?.navigation === 'top' ? 'Top bar' : 'Side bar' }} on desktop · tab bar on phones</dd></dl></section>
        <section class="lay-card"><h2>Colour</h2><div class="lay-swatches">
          @for (swatch of swatches(); track swatch.name) { <div class="lay-swatch"><i [style.background]="swatch.value"></i><span><strong>{{ swatch.value }}</strong><br>{{ swatch.name }}</span></div> }</div></section>
        <section class="lay-card lay-wide"><h2>Tokens</h2>
          <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Tokens"><table><thead><tr><th>Token</th><th>$type</th><th>$value</th><th>Note</th></tr></thead><tbody>
            @for (token of tokens(); track token.name) { <tr><td><code>{{ token.name }}</code></td><td>{{ token.type }}</td><td>@if (token.type === 'color') { <span class="lay-token-swatch" [style.background]="token.value"></span> }<code>{{ token.value }}</code></td><td class="small">{{ token.note }}</td></tr> }
          </tbody></table></div>
          <p class="lay-muted small">Stored in the W3C Design Tokens format so they can move to and from Figma, Penpot or Tokens Studio.</p></section>
      </div>
    }
  }`
})
export class DesignLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly tabs = [['foundations', 'Foundations'], ['components', 'Components'], ['patterns', 'Patterns'], ['guidelines', 'Guidelines'], ['sources', 'Sources & changes']];
  readonly tab = computed(() => this.ctx.segments()[1] || 'foundations');
  readonly feel = computed(() => { const key = this.ctx.setup()?.design?.feel; return key ? this.ctx.catalog()?.feels[key] || null : null; });
  readonly themeLabel = computed(() => ({ light: 'Light', dark: 'Dark', system: 'Matches the device' } as Record<string, string>)[this.ctx.setup()?.design?.theme || 'system']);
  readonly pageTypes = computed(() => Object.entries(this.ctx.catalog()?.pageTypes || {}).map(([id, value]) => ({ id, ...value })));
  readonly swatches = computed(() => {
    const feel = this.feel(); const accent = this.ctx.setup()?.design?.accent || '#3047b9';
    if (!feel) return [{ name: 'Accent', value: accent }];
    const primary = readableAccent(accent, feel.surface);
    return [{ name: 'Accent (brand)', value: accent }, { name: 'Primary · 4.5:1', value: primary }, { name: 'On primary', value: contrastText(primary) }, { name: 'Surface', value: feel.surface }, { name: 'Surface (dark)', value: feel.surfaceDark }];
  });
  readonly tokens = computed(() => {
    const feel = this.feel(); const accent = this.ctx.setup()?.design?.accent || '#3047b9';
    const surface = feel?.surface || '#ffffff';
    return [
      { name: 'color.accent', type: 'color', value: accent, note: 'Brand accent from Look & feel' },
      { name: 'color.primary', type: 'color', value: readableAccent(accent, surface), note: 'Derived from {color.accent} to reach 4.5:1 on the surface' },
      { name: 'color.surface', type: 'color', value: surface, note: 'Light theme' },
      { name: 'color.surface.dark', type: 'color', value: feel?.surfaceDark || '#111111', note: 'Dark theme' },
      { name: 'font.family.base', type: 'fontFamily', value: feel?.font || 'Roboto', note: feel?.label || '' },
      { name: 'radius.card', type: 'dimension', value: `${feel?.radius ?? 12}px`, note: 'Cards, sheets and navigation items' }
    ];
  });
  readonly components = computed(() => {
    const pages = this.ctx.data()?.pages || [];
    const auth = Boolean(this.ctx.setup()?.stack?.options?.['auth']);
    return [
      { name: 'Navigation', purpose: 'Side or top bar on desktop; tab bar on phones', maturity: 'Stable', source: 'aludel-web-v1', usedOn: 'Every page' },
      { name: 'Page blocks', purpose: 'Placeholder layouts per page type until a page is designed', maturity: 'Stable', source: 'aludel-web-v1', usedOn: `${pages.filter(page => page.status !== 'designed').length} pages` },
      { name: 'Buttons, fields, cards', purpose: 'Material 3 components themed by the tokens', maturity: 'Stable', source: 'Angular Material 22', usedOn: 'As needed' },
      ...(auth ? [{ name: 'Sign-in form', purpose: 'Sign up, sign in, sign out', maturity: 'Stable', source: 'aludel-web-v1', usedOn: 'Sign in' }] : [])
    ];
  });
  lookHref() { return `/start/${encodeURIComponent(this.ctx.projectId())}/look`; }
}
