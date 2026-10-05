// Biome Design kit, revision r7 (AGENT-WORK-01 Pages review prototype; G3 in ../../work-record.md).
// What Design would publish for each revision: the tokens as CSS variables and each component as a custom element, in one
// framework-free file. Pages' mockups are plain HTML made of these tags, so they render anywhere this file loads (the
// portal, an Artifact, an agent's browser) with no app build. Drawn from Biome's recorded screens
// (docs/evidence/biome-review/initial-setup.png, populated-biome.png); illustrative, not extracted from Biome's code.
(() => {
  const KIT = { name: 'Biome Design', revision: 'r7' };
  const css = `
.bk-root{--bk-bg:#f6f6f0;--bk-ink:#1d3a2b;--bk-muted:#56655c;--bk-primary:#2f45b8;--bk-primary-ink:#fff;--bk-surface:#fff;--bk-soft:#eef2e8;
  --bk-line:#d9ddd3;--bk-accent:#5d9b3a;--bk-radius:24px;--bk-r-ctl:12px;--bk-shadow:0 18px 50px #1d3a2b14;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:var(--bk-ink);background:var(--bk-bg);min-height:100%;container-type:inline-size;position:relative;line-height:1.45}
.bk-root *{box-sizing:border-box}
bk-page{display:flex;flex-direction:column;min-height:100%;padding:24px 40px 28px}
bk-page>.bk-main{flex:1;display:grid;place-items:center;padding:28px 0}
bk-page>.bk-foot{text-align:center;font-size:12px;color:var(--bk-muted)}
bk-topbar{display:flex;align-items:center;gap:16px}
.bk-logo{font-weight:800;font-size:30px;letter-spacing:-1.4px;position:relative;padding-right:8px}
.bk-logo::after{content:"";position:absolute;right:0;top:6px;width:6px;height:6px;border-radius:50%;background:var(--bk-accent)}
bk-topbar .bk-tt{display:grid}bk-topbar .bk-tt b{font-size:17px}bk-topbar .bk-tt small{font-size:12px;color:var(--bk-muted)}
bk-topbar .bk-act{margin-left:auto}
bk-card{display:grid;gap:14px;width:100%;max-width:450px;background:var(--bk-surface);border:1px solid var(--bk-line);border-radius:var(--bk-radius);padding:40px 36px 36px;box-shadow:var(--bk-shadow)}
.bk-eyebrow{font-size:11px;letter-spacing:2.4px;font-weight:700;text-transform:uppercase;color:var(--bk-muted)}
.bk-h{font-size:30px;line-height:1.15;letter-spacing:-.8px;margin:0;font-weight:800}
bk-hero{display:grid;gap:18px;max-width:620px;text-align:center;justify-items:center}
bk-hero .bk-h{font-size:46px;letter-spacing:-1.6px}
bk-hero .bk-lede{font-size:18px;color:var(--bk-muted);margin:0}
bk-text{display:block;color:var(--bk-muted);font-size:15.5px}
bk-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:center}
bk-button{display:inline-block}bk-button[full]{display:block}
.bk-btn{font:inherit;font-weight:700;font-size:15.5px;border-radius:var(--bk-r-ctl);padding:12px 22px;border:1px solid transparent;cursor:pointer;transition:filter .15s,background .15s}
.bk-btn.filled{background:var(--bk-primary);color:var(--bk-primary-ink)}.bk-btn.filled:hover{filter:brightness(1.12)}
.bk-btn.outlined{background:var(--bk-surface);border-color:var(--bk-line);color:var(--bk-ink)}.bk-btn.outlined:hover{background:var(--bk-soft)}
.bk-btn.text{background:none;color:var(--bk-primary);padding:8px 6px}.bk-btn.text:hover{text-decoration:underline}
.bk-btn.full{width:100%}
.bk-btn:focus-visible{outline:3px solid #9fb0ff;outline-offset:2px}
bk-field{display:grid;gap:6px}
bk-field .bk-l{font-weight:700;font-size:14px}
bk-field input{font:inherit;font-size:15px;font-weight:600;color:var(--bk-ink);background:#fafaf6;border:1px solid #c9cdc3;border-radius:var(--bk-r-ctl);padding:12px 14px;width:100%}
bk-field input:focus{outline:3px solid #c5cdfb;border-color:var(--bk-primary)}
bk-field .bk-hint{font-size:12.5px;color:var(--bk-muted)}
bk-choice{display:block}
.bk-choice{display:flex;gap:14px;align-items:center;width:100%;background:var(--bk-soft);border:2px solid transparent;border-radius:14px;padding:14px 16px;text-align:left;font:inherit;color:inherit;cursor:pointer}
.bk-choice[aria-pressed="true"]{border-color:var(--bk-accent)}
.bk-choice .bk-ic{font-size:32px}.bk-choice b{display:block;font-size:16px}.bk-choice small{font-size:12.5px}
bk-steps{display:flex;gap:8px;align-items:center;font-size:12.5px;font-weight:700;color:var(--bk-muted)}
bk-steps .bk-dots{display:flex;gap:4px}bk-steps .bk-dots i{width:22px;height:5px;border-radius:3px;background:var(--bk-line)}bk-steps .bk-dots i.on{background:var(--bk-accent)}
bk-notice{display:flex;gap:10px;align-items:flex-start;background:#eef1fd;color:#25358c;border-radius:12px;padding:12px 14px;font-size:14px}
bk-link{display:block;text-align:center;font-size:14px;color:var(--bk-muted)}
bk-world{display:block;position:relative;height:100%;min-height:560px;overflow:hidden;background:#8fb06f}
.bk-tiles{position:absolute;inset:-40px -60px;display:grid;grid-template-columns:repeat(12,120px);grid-auto-rows:105px;transform:skewY(-8deg)}
.bk-tiles i{border:1px solid #7f9e62;background:#a3c27f;display:grid;place-items:center;font-style:normal;font-size:38px}
.bk-tiles i.w{background:#6fb3b8;border-color:#5ea1a6}.bk-tiles i.f{background:#77a463}.bk-tiles i.r{background:#bdb59c}
bk-world .bk-bar{position:absolute;left:24px;right:24px;top:24px;display:flex;gap:28px;align-items:center;background:#f6f6f0f0;border-radius:16px;padding:12px 20px}
bk-world .bk-bar .bk-act{margin-left:auto}
bk-world .bk-panel{position:absolute;left:24px;bottom:24px;background:#f6f6f0f0;border-radius:16px;padding:20px 22px;width:270px;display:grid;gap:8px}
bk-world .bk-panel .bk-h{font-size:19px;letter-spacing:-.3px}
bk-world .bk-panel div{display:flex;justify-content:space-between;font-size:14.5px}
@container (max-width:640px){
  bk-page{padding:18px 18px 22px} bk-card{padding:28px 22px 24px;border-radius:20px} .bk-h{font-size:26px}
  bk-hero .bk-h{font-size:34px} bk-hero .bk-lede{font-size:16px} .bk-logo{font-size:26px}
  bk-world .bk-bar{left:12px;right:12px;top:12px;gap:14px;padding:10px 14px} bk-world .bk-panel{left:12px;right:12px;width:auto;bottom:12px}
}`;
  if (!document.getElementById('bk-kit-css')) { const s = document.createElement('style'); s.id = 'bk-kit-css'; s.textContent = css; document.head.append(s); }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const btn = (label, variant = 'filled', go = '', extra = '') => `<button type="button" class="bk-btn ${variant} ${extra}"${go ? ` data-go="${esc(go)}"` : ''}>${esc(label)}</button>`;
  // Container elements keep their children: they render a frame and move the authored children into its body.
  const define = (tag, render) => customElements.get(tag) || customElements.define(tag, class extends HTMLElement {
    connectedCallback() { if (this._r) return; this._r = true; const kids = [...this.childNodes]; this.innerHTML = render(a => this.getAttribute(a), n => this.hasAttribute(n), this);
      const slot = this.querySelector('[data-slot]'); if (slot) { slot.removeAttribute('data-slot'); slot.append(...kids); } }
  });
  define('bk-page', a => `<div class="bk-main" data-slot></div>${a('footer') ? `<div class="bk-foot">${esc(a('footer'))}</div>` : ''}`);
  define('bk-topbar', a => `<span class="bk-logo">biome</span>${a('title') ? `<span class="bk-tt"><b>${esc(a('title'))}</b><small>${esc(a('subtitle'))}</small></span>` : ''}<span class="bk-act" data-slot></span>`);
  define('bk-card', a => `${a('eyebrow') ? `<div class="bk-eyebrow">${esc(a('eyebrow'))}</div>` : ''}${a('headline') ? `<h1 class="bk-h">${esc(a('headline')).replace(/\|/g, '<br>')}</h1>` : ''}<div data-slot style="display:grid;gap:14px"></div>`);
  define('bk-hero', a => `${a('eyebrow') ? `<div class="bk-eyebrow">${esc(a('eyebrow'))}</div>` : ''}<h1 class="bk-h">${esc(a('headline'))}</h1><p class="bk-lede">${esc(a('lede'))}</p><div data-slot style="display:grid;gap:12px;justify-items:center"></div>`);
  define('bk-text', (a, h, el) => esc(el.textContent));
  define('bk-row', () => '<div data-slot style="display:contents"></div>');
  define('bk-button', (a, h, el) => btn(el.textContent.trim(), a('variant') || 'filled', a('go'), h('full') ? 'full' : ''));
  define('bk-field', a => `<label style="display:grid;gap:6px"><span class="bk-l">${esc(a('label'))}</span><input type="${esc(a('type') || 'text')}" value="${esc(a('value'))}" placeholder="${esc(a('placeholder'))}" autocomplete="off"></label>${a('hint') ? `<span class="bk-hint">${esc(a('hint'))}</span>` : ''}`);
  define('bk-choice', (a, h) => `<button type="button" class="bk-choice" aria-pressed="${h('selected')}"><span class="bk-ic" aria-hidden="true">${esc(a('icon'))}</span><span><b>${esc(a('title'))}</b><small>${esc(a('meta'))}</small></span></button>`);
  define('bk-steps', a => { const n = +a('total') || 2, c = +a('current') || 1; return `<span class="bk-dots" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${i < c ? 'on' : ''}"></i>`).join('')}</span>Step ${c} of ${n}`; });
  define('bk-notice', (a, h, el) => `<span aria-hidden="true">${esc(a('icon') || 'ℹ️')}</span><span>${esc(el.textContent.trim())}</span>`);
  define('bk-link', (a, h, el) => `${esc(a('lead'))} ${btn(el.textContent.trim(), 'text', a('go'))}`);
  define('bk-world', a => {
    const icons = { 5: '🌳', 14: '🐇', 21: '🌳', 27: '🦌', 30: '🪨', 38: '🌳', 44: '🐇', 52: '🌳', 57: '🦊', 63: '🪨', 70: '🐇', 77: '🌳', 81: '🦌', 90: '🌳' };
    const tiles = Array.from({ length: 96 }, (_, i) => { const c = i % 12; const k = c === 3 || c === 4 ? 'w' : icons[i] === '🌳' ? 'f' : icons[i] === '🪨' ? 'r' : ''; return `<i class="${k}">${k === 'w' ? '' : icons[i] || ''}</i>`; }).join('');
    return `<div class="bk-tiles" aria-hidden="true">${tiles}</div><div class="bk-bar"><span class="bk-logo">biome</span><span style="display:grid"><b style="font-size:17px">${esc(a('name'))}</b><small style="font-size:12px;color:var(--bk-muted)">${esc(a('season'))} · Day 1</small></span><span class="bk-act">${btn('Settings', 'outlined')}</span></div>
      <div class="bk-panel"><div class="bk-eyebrow" style="display:block">Your world</div><h1 class="bk-h">Life in ${esc(a('name'))}</h1><div><span>🐇 Rabbit</span><b>12</b></div><div><span>🦌 Deer</span><b>6</b></div><div><span>🦊 Fox</span><b>2</b></div></div>`;
  });
  // Interaction the kit owns: a choice toggles within its group.
  document.addEventListener('click', e => { const c = e.target.closest('.bk-choice'); if (c) c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true'); });
  // The catalog Design's Components tab would show; each demo is the same element Pages uses.
  window.BIOME_KIT = { ...KIT, components: [
    ['bk-button', 'Button', 'Filled, outlined or text. go="page" makes it a link in a flow.', '<bk-row><bk-button>Create my world</bk-button><bk-button variant="outlined">Log in</bk-button><bk-button variant="text">Send it again</bk-button></bk-row>'],
    ['bk-field', 'Text field', 'Label, value, type, hint.', '<bk-field label="World name" value="My first biome" hint="You can rename it later"></bk-field>'],
    ['bk-choice', 'Choice', 'A selectable option with an icon.', '<bk-choice icon="🌳" title="Temperate woodland" meta="Rabbits, deer, and foxes · Spring" selected></bk-choice>'],
    ['bk-card', 'Card', 'Eyebrow, headline, then any content.', '<bk-card eyebrow="Your first biome" headline="A place for life|to begin."><bk-text>Start with a temperate world.</bk-text></bk-card>'],
    ['bk-steps', 'Steps', 'Progress through a short setup.', '<bk-steps current="1" total="2"></bk-steps>'],
    ['bk-notice', 'Notice', 'A short informational note.', '<bk-notice icon="✉️">We sent a link to your email.</bk-notice>'],
  ] };
})();
