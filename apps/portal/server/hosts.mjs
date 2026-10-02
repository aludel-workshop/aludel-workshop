// DEC-033: the portal lives at aludel.<base> and each project preview at <slug>.<base>.
// Nothing here assumes localhost: a hosted deployment sets the base domain, scheme and public port.
export const reservedSlugs = new Set(['aludel', 'www', 'api', 'admin', 'app', 'the-machine', 'localhost', 'mail', 'static', 'layers']);
const legacyPortalHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function hostTopology(environment = process.env, listenPort = 4310) {
  const baseDomain = String(environment.MACHINE_BASE_DOMAIN || 'localhost').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  const scheme = String(environment.MACHINE_PUBLIC_SCHEME || 'http').replace(/:.*$/, '');
  const portSetting = environment.MACHINE_PUBLIC_PORT ?? String(listenPort);
  const port = String(portSetting).trim();
  const origin = hostname => `${scheme}://${hostname}${port ? `:${port}` : ''}`;
  const portalHost = `aludel.${baseDomain}`;
  return {
    baseDomain,
    portalOrigin: origin(portalHost),
    // Every origin the portal answers on: its own host and the loopback names it also accepts (localhost, 127.0.0.1).
    // Layer frames must allow all of them as ancestors, or a portal opened at http://localhost:4310 can't show any layer.
    portalOrigins: [origin(portalHost), ...[...legacyPortalHosts].map(host => origin(host))],
    appOrigin: slug => origin(`${slug}.${baseDomain}`),
    // LAYER-BASE-01 B6: each layer instance's own views, served into a sandboxed frame from that instance's own origin.
    layerOrigin: label => origin(`${label}.layers.${baseDomain}`),
    layerOrigins: origin(`*.layers.${baseDomain}`),
    classify(hostHeader = '') {
      const host = String(hostHeader).toLowerCase().replace(/:\d+$/, '');
      if (host === portalHost || host === baseDomain || legacyPortalHosts.has(host)) return { kind: 'portal', host };
      const layer = new RegExp(`^(i-[0-9a-f]{32})\\.layers\\.${baseDomain.replace(/\./g, '\\.')}$`).exec(host);
      if (layer) return { kind: 'layers', label: layer[1], host };
      if (host.endsWith(`.${baseDomain}`)) {
        const label = host.slice(0, -(baseDomain.length + 1));
        if (/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(label) && !reservedSlugs.has(label)) return { kind: 'app', slug: label, host };
      }
      return { kind: 'unknown', host };
    },
    // Only redirect back to hosts this deployment serves as the portal (prevents open redirects).
    portalOriginFor(hostHeader) {
      const value = this.classify(hostHeader);
      if (value.kind !== 'portal') return origin(portalHost);
      const [, portPart] = /:(\d+)$/.exec(String(hostHeader)) || [];
      return `${scheme}://${value.host}${portPart ? `:${portPart}` : port ? `:${port}` : ''}`;
    }
  };
}

export function slugify(name) {
  const base = String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/g, '');
  return base || 'app';
}
