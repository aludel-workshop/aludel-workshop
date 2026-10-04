// J6 (docs/design/journeys/work-record.md): walking a journey in the review preview advances the review. The preview is a
// different origin from the portal, so the portal can't read where the reviewer is. Instead the host adds one same-origin
// script to the preview's pages; it tells the portal frame which page is showing and when an action (a form post or a
// non-GET request that succeeded) happened, and nothing else: paths and methods, never page content, fields or responses.
// The app is not changed; the script is served from the reserved /__aludel/ path of review previews only.
export const walkPath = '/__aludel/walk.js';

export function walkScript(portalOrigins) {
  const origins = JSON.stringify([...new Set(portalOrigins)].filter(origin => /^https?:\/\/[^/]+$/.test(origin)));
  return `(() => {
  if (window.parent === window || window.__aludelWalk) return;
  window.__aludelWalk = true;
  const origins = ${origins};
  const post = message => { for (const origin of origins) { try { window.parent.postMessage({ aludelWalk: 1, ...message }, origin); } catch {} } };
  const where = () => location.pathname + location.search;
  let shown = null;
  const page = () => { const path = where(); if (path !== shown) { shown = path; post({ kind: 'page', path }); } };
  const action = (method, url) => {
    method = String(method || 'GET').toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
    let target; try { target = new URL(url, location.href); } catch { return; }
    if (target.origin !== location.origin) return;
    post({ kind: 'action', method, path: target.pathname, page: where() });
  };
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name];
    history[name] = function (...args) { const value = original.apply(this, args); page(); return value; };
  }
  addEventListener('popstate', page); addEventListener('hashchange', page);
  const fetched = window.fetch;
  if (fetched) window.fetch = function (input, init) {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const method = init && init.method || request && request.method || 'GET', url = request ? request.url : String(input);
    return fetched.apply(this, arguments).then(response => { if (response.ok) action(method, url); return response; });
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.addEventListener('load', () => { if (this.status >= 200 && this.status < 400) action(method, url); });
    return open.apply(this, arguments);
  };
  // A form that posts the classic way leaves the page; say so before it does.
  addEventListener('submit', event => setTimeout(() => {
    const form = event.target;
    if (form instanceof HTMLFormElement && !event.defaultPrevented) action(form.method, form.action || location.href);
  }), true);
  page();
})();
`;
}

// Adds the walk script to an HTML page: after <head> when there is one, else first.
export function injectWalk(html) {
  const tag = `<script src="${walkPath}"></script>`;
  if (html.includes(tag)) return html;
  const head = /<head(?:\s[^>]*)?>/i.exec(html);
  return head ? html.slice(0, head.index + head[0].length) + tag + html.slice(head.index + head[0].length) : tag + html;
}
