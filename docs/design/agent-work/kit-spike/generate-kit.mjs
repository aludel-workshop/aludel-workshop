// W-29 #1 kit fidelity spike (G3): generate a framework-free HTML kit from a project's Design records only.
// Usage: node generate-kit.mjs [design.json] [out.js]
// design.json is { tokens, components } as Design's getTokens and listComponents return them (the data fields).
// Without it, the spike uses the Aludel template seed with the sleek-saas Look, which is what this project's records are
// and, judging by its primary colour, what Biome started from. This is a spike: #4 builds the real generator.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const portal = join(here, '../../../../apps/portal');
const { defaultTokens, tokenVariables } = await import(join(portal, 'src/design-tokens.js'));
const { componentSeeds } = await import(join(portal, 'server/design.mjs'));

const [input, output = join(here, 'out/kit.js')] = process.argv.slice(2);
const design = input ? JSON.parse(readFileSync(input, 'utf8')) : {
  name: 'Aludel template (sleek-saas)',
  tokens: defaultTokens({ accent: '#3047b9', font: 'Inter, Roboto, system-ui, sans-serif', radius: 12 }),
  components: componentSeeds.map(({ key, ...rest }) => rest)
};

// Tokens: the same variables the generated app's styles carry (scaffold), so kit and app share one source.
const block = vars => Object.entries(vars).map(([name, value]) => `${name}:${value}`).join(';');
const light = tokenVariables(design.tokens, 'light', l => l);
const dark = tokenVariables(design.tokens, 'dark', (l, d) => d);
const tokenCss = `:root{${block(light)}}@media (prefers-color-scheme:dark){:root:not([data-theme=light]){${block(dark)}}}`;

// Booleans follow HTML: present means true. Only variant defaults apply to an element.
// Components: one custom element per contract. Its attributes are the contract's props; its look is drawn from the
// preview kind with the tokens its anatomy names. A contract whose preview kind the kit can't draw becomes a labelled
// placeholder, which is itself a finding: the contract doesn't say enough to draw it.
const slug = name => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const type = role => `font:var(--mat-sys-${role});letter-spacing:var(--mat-sys-${role}-tracking)`;
const v = name => `var(--mat-sys-${name})`;
const layer = `position:relative;overflow:hidden`;
const stateLayer = `.sl::after{content:"";position:absolute;inset:0;background:currentColor;opacity:0;transition:opacity 150ms;pointer-events:none}.sl:hover::after{opacity:.08}.sl:focus-visible::after,.sl:active::after{opacity:.1}`;
const focus = `:focus-visible{outline:3px solid ${v('primary')};outline-offset:2px}`;

// Each kind: css for its shadow root, and render(el) returning its inner HTML from the element's attributes.
const kinds = {
  button: {
    css: `button{${layer};${type('label-large')};border:0;border-radius:${v('corner-full')};height:40px;padding:0 24px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;width:100%}
      :host{display:inline-block}:host([full]){display:block}
      .filled{background:${v('primary')};color:${v('on-primary')}}.tonal{background:${v('secondary-container')};color:${v('on-secondary-container')}}
      .outlined{background:none;border:1px solid ${v('outline')};color:${v('primary')}}.text{background:none;color:${v('primary')};padding:0 12px}
      .elevated{background:${v('surface-container-low')};color:${v('primary')};box-shadow:${v('level1')}}
      button:disabled{background:color-mix(in srgb,${v('on-surface')} 12%,transparent);color:color-mix(in srgb,${v('on-surface')} 38%,transparent);border-color:transparent;box-shadow:none;cursor:default}`,
    render: a => `<button class="sl ${(a.variant || 'Filled').toLowerCase()}" ${a.disabled != null ? 'disabled' : ''}>${icon(a.icon)}<slot>${a.label || ''}</slot></button>`
  },
  'icon-button': {
    css: `button{${layer};width:40px;height:40px;border:0;border-radius:50%;background:none;color:${v('on-surface-variant')};cursor:pointer;display:grid;place-items:center}`,
    render: a => `<button class="sl" aria-label="${esc(a.label || a.icon)}">${icon(a.icon || 'more_vert')}</button>`
  },
  fab: {
    css: `button{${layer};${type('label-large')};border:0;border-radius:${v('corner-large')};min-width:56px;height:56px;padding:0 16px;display:inline-flex;align-items:center;gap:12px;background:${v('primary-container')};color:${v('on-primary-container')};box-shadow:${v('level3')};cursor:pointer}`,
    render: a => `<button class="sl" aria-label="${esc(a.label)}">${icon(a.icon || 'add')}${a.extended != null ? esc(a.label) : ''}</button>`
  },
  card: {
    css: `:host{display:block}.c{border-radius:${v('corner-medium')};padding:16px;display:grid;gap:8px}
      .elevated{background:${v('surface-container-low')};box-shadow:${v('level1')}}.filled{background:${v('surface-container-highest')}}.outlined{background:${v('surface')};border:1px solid ${v('outline-variant')}}
      h3{margin:0;${type('title-medium')};color:${v('on-surface')}}p{margin:0;${type('body-medium')};color:${v('on-surface-variant')}}
      .media{height:120px;border-radius:${v('corner-small')};background:${v('surface-container-high')}}.actions{display:flex;justify-content:flex-end;gap:8px}`,
    render: a => `<div class="c ${(a.variant || 'Elevated').toLowerCase()}">${a.media != null ? '<div class="media"></div>' : ''}${a.headline ? `<h3>${esc(a.headline)}</h3>` : ''}${a.supporting ? `<p>${esc(a.supporting)}</p>` : ''}<slot></slot><div class="actions"><slot name="actions"></slot></div></div>`
  },
  dialog: {
    css: `:host{display:block}.d{background:${v('surface-container-high')};border-radius:${v('corner-extra-large')};box-shadow:${v('level3')};padding:24px;display:grid;gap:16px;max-width:560px}
      h2{margin:0;${type('headline-small')};color:${v('on-surface')}}p{margin:0;${type('body-medium')};color:${v('on-surface-variant')}}.actions{display:flex;justify-content:flex-end;gap:8px}`,
    render: a => `<div class="d" role="dialog" aria-label="${esc(a.headline)}"><h2>${esc(a.headline)}</h2><p>${esc(a.body)}</p><slot></slot><div class="actions"><slot name="actions"></slot></div></div>`
  },
  chip: {
    css: `button{${layer};${type('label-large')};height:32px;padding:0 16px;border-radius:${v('corner-small')};border:1px solid ${v('outline')};background:none;color:${v('on-surface-variant')};cursor:pointer}
      button[aria-pressed=true]{background:${v('secondary-container')};color:${v('on-secondary-container')};border-color:transparent}`,
    render: a => `<button class="sl" aria-pressed="${a.selected != null}">${esc(a.label)}</button>`,
    toggles: 'selected'
  },
  switch: {
    css: `label{display:flex;gap:16px;align-items:center;${type('body-large')};color:${v('on-surface')};cursor:pointer}
      button{width:52px;height:32px;border-radius:16px;border:2px solid ${v('outline')};background:${v('surface-container-highest')};position:relative;cursor:pointer;padding:0}
      button::before{content:"";position:absolute;top:6px;left:6px;width:16px;height:16px;border-radius:50%;background:${v('outline')};transition:all 150ms}
      button[aria-checked=true]{background:${v('primary')};border-color:${v('primary')}}button[aria-checked=true]::before{left:22px;top:2px;width:24px;height:24px;background:${v('on-primary')}}`,
    render: a => `<label><button role="switch" aria-checked="${a.on != null}"></button>${esc(a.label)}</label>`,
    toggles: 'on'
  },
  'text-field': {
    css: `:host{display:block}label{display:grid;gap:4px}.l{${type('body-small')};color:${v('on-surface-variant')}}
      input{${type('body-large')};color:${v('on-surface')};padding:16px;border:0;border-bottom:1px solid ${v('on-surface-variant')};background:${v('surface-container-highest')};border-radius:${v('corner-extra-small')} ${v('corner-extra-small')} 0 0;width:100%;box-sizing:border-box}
      .outlined input{background:none;border:1px solid ${v('outline')};border-radius:${v('corner-extra-small')}}
      input:focus{outline:none;border-color:${v('primary')};box-shadow:inset 0 -2px 0 ${v('primary')}}.outlined input:focus{box-shadow:inset 0 0 0 1px ${v('primary')}}
      .h{${type('body-small')};color:${v('on-surface-variant')}}.err .h,.err .l{color:${v('error')}}.err input{border-color:${v('error')}}`,
    render: a => `<label class="${(a.variant || 'Filled').toLowerCase()} ${a.error != null ? 'err' : ''}"><span class="l">${esc(a.label)}</span><input value="${esc(a.value || '')}" placeholder="${esc(a.placeholder || '')}"><span class="h">${a.error != null ? 'Check this and try again' : esc(a.hint || '')}</span></label>`
  },
  list: {
    css: `:host{display:block;background:${v('surface')};padding:8px 0}`,
    render: () => `<div role="list"><slot></slot></div>`
  },
  'list-item': {
    css: `:host{display:block}.i{${layer};display:flex;gap:16px;align-items:center;padding:8px 16px;min-height:56px}
      .av{width:40px;height:40px;border-radius:50%;background:${v('primary-container')};color:${v('on-primary-container')};display:grid;place-items:center;${type('title-medium')}}
      b{display:block;${type('body-large')};color:${v('on-surface')}}small{${type('body-medium')};color:${v('on-surface-variant')}}`,
    render: a => `<div class="i" role="listitem">${a.leading === 'None' ? '' : `<span class="av">${a.leading === 'Icon' ? icon(a.icon || 'eco') : esc(String(a.headline || '?')[0])}</span>`}<span><b>${esc(a.headline)}</b><small>${esc(a.supporting)}</small></span></div>`
  },
  'nav-item': {
    css: `a{${layer};display:flex;gap:12px;align-items:center;height:56px;padding:0 16px;border-radius:${v('corner-full')};${type('label-large')};color:${v('on-surface-variant')};text-decoration:none}
      a[aria-current=page]{background:${v('secondary-container')};color:${v('on-secondary-container')}}`,
    render: a => `<a class="sl" href="${esc(a.href || '#')}" ${a.selected != null ? 'aria-current="page"' : ''}>${icon(a.icon || 'home')}${esc(a.label)}</a>`
  },
  'nav-list': {
    css: `nav{display:grid;gap:4px;padding:12px;background:${v('surface-container-low')};border-radius:${v('corner-large')}}`,
    render: a => `<nav aria-label="${esc(a.label || 'Main')}"><slot></slot></nav>`
  },
  'nav-bar': {
    css: `nav{display:flex;justify-content:space-around;background:${v('surface-container')};padding:12px 0}`,
    render: a => `<nav aria-label="${esc(a.label || 'Main')}"><slot></slot></nav>`
  },
  toolbar: {
    css: `header{display:flex;align-items:center;gap:8px;min-height:64px;padding:0 16px;background:${v('surface')}}h1{margin:0;${type('title-large')};color:${v('on-surface')};flex:1}`,
    render: a => `<header>${a.back != null ? icon('arrow_back') : ''}<slot name="leading"></slot><h1>${esc(a.title)}</h1><slot name="actions"></slot></header>`
  },
  scaffold: {
    css: `:host{display:grid;min-height:100vh;background:${v('surface')};color:${v('on-surface')};grid-template-columns:auto 1fr}:host([navigation=Top]){grid-template-columns:1fr;grid-template-rows:auto 1fr}
      main{min-width:0}`,
    render: () => `<slot name="navigation"></slot><main><slot></slot></main>`
  }
};
const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Icons: the contracts name Material Symbols; the spike draws a small glyph table rather than loading the font.
const glyphs = { add: '+', check: '✓', send: '➤', arrow_forward: '→', arrow_back: '←', share: '⇪', close: '✕', favorite: '♥', more_vert: '⋮', edit: '✎', home: '⌂', search: '⌕', settings: '⚙', person: '◉', chat: '✉', inventory_2: '▤', eco: '❦' };
const icon = name => !name || name === 'none' ? '' : `<span aria-hidden="true" style="font-size:18px;line-height:1">${glyphs[name] || '•'}</span>`;

const elements = design.components.map(component => {
  const tag = `kit-${slug(component.name)}`;
  const kind = kinds[component.preview];
  const defaults = Object.fromEntries((component.props || []).filter(p => p.kind === 'variant' && p.default).map(p => [p.key, String(p.default)]));
  // A contract's text and boolean defaults are demo content: the demos page sets them, a real element doesn't inherit them.
  const demo = Object.fromEntries((component.props || []).filter(p => p.kind !== 'variant' && p.default !== '' && p.default !== false && p.default != null).map(p => [p.key, p.default === true ? '' : String(p.default)]));
  return { tag, name: component.name, preview: component.preview || null, drawn: !!kind, props: (component.props || []).map(p => p.key), defaults, demo };
});

// The kit file: tokens, shared helpers and the element definitions, as one script any page can load.
const kindSource = Object.entries(kinds).map(([key, kind]) => `${JSON.stringify(key)}:{css:${JSON.stringify(kind.css.replace(/\s*\n\s*/g, ''))},render:${kind.render.toString()}${kind.toggles ? `,toggles:${JSON.stringify(kind.toggles)}` : ''}}`).join(',\n');
const kit = `// Generated by W-29's kit spike from ${design.name || 'a Design revision'}. Do not edit: change the Design records.
(() => {
const esc = ${esc.toString()};
const glyphs = ${JSON.stringify(glyphs)};
const icon = ${icon.toString()};
const shared = ${JSON.stringify(stateLayer + focus + ':host{font-family:var(--mat-sys-body-large-font)}')};
const kinds = {${kindSource}};
const elements = ${JSON.stringify(elements)};
const style = document.createElement('style');
style.textContent = ${JSON.stringify(tokenCss + `body{margin:0;background:var(--mat-sys-surface);color:var(--mat-sys-on-surface);font:var(--mat-sys-body-large)}`)};
document.head.append(style);
for (const spec of elements) {
  const kind = kinds[spec.preview];
  customElements.define(spec.tag, class extends HTMLElement {
    static observedAttributes = spec.props;
    connectedCallback() { this.paint(); }
    attributeChangedCallback() { if (this.shadowRoot) this.paint(); }
    paint() {
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const a = { ...spec.defaults };
      for (const attr of this.attributes) a[attr.name] = attr.value;
      root.innerHTML = kind ? '<style>' + shared + kind.css + '</style>' + kind.render(a)
        : '<div style="border:2px dashed #b3261e;padding:12px;font:13px system-ui;color:#b3261e">' + esc(spec.name) + ': no preview kind, so the kit cannot draw it</div><slot></slot>';
      if (kind?.toggles) root.querySelector('button').onclick = () => this.toggleAttribute(kind.toggles);
    }
  });
}
window.aludelKit = { elements };
})();
`;
writeFileSync(output, kit);
console.log(JSON.stringify({ output, elements: elements.map(e => `${e.tag}${e.drawn ? '' : ' (not drawn)'}`) }, null, 1));
