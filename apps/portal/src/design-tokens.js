// The Design layer's token set (DESIGN-UX-01, DEC-045). Shared by the portal (live preview) and the scaffold (generated
// styles), like color.js, so both compute the same values from the same record.
// Tiers: raw values (palettes, type faces, corners, spacing), roles (colour and type roles point at raw values) and
// rules (elevation, motion, behaviours combine roles and values).
import { contrastRatio } from './color.js';

// ---- Tonal palettes: tone is CIE L* (as Material's HCT tone is); hue and chroma come from the seed, reduced to stay in sRGB ----
const srgbToLinear = value => { const v = value / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const linearToSrgb = value => { const v = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055; return v * 255; };
const white = [0.95047, 1, 1.08883];
const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
const fInv = t => t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27);
export const hexChannels = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const toHex = channels => `#${channels.map(value => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`;
function hexToLch(hex) {
  const [r, g, b] = hexChannels(hex).map(srgbToLinear);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / white[0], y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / white[2];
  const L = 116 * f(y) - 16, A = 500 * (f(x) - f(y)), B = 200 * (f(y) - f(z));
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function lchToRgb(L, C, h) {
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const fy = (L + 16) / 116, x = fInv(fy + A / 500) * white[0], y = fInv(fy), z = fInv(fy - B / 200) * white[2];
  return [3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.204 * y + 1.057 * z].map(linearToSrgb);
}
const inGamut = channels => channels.every(value => value >= -0.5 && value <= 255.5);
export function toneOf(hex) { return hexToLch(hex)[0]; }
// The colour at a tone (0 black … 100 white) with the seed's hue, keeping as much of its chroma as sRGB allows.
export function toneFromSeed(seed, tone) {
  if (tone <= 0) return '#000000';
  if (tone >= 100) return '#ffffff';
  const [, chroma, hue] = hexToLch(seed);
  let low = 0, high = chroma;
  if (inGamut(lchToRgb(tone, high, hue))) return toHex(lchToRgb(tone, high, hue));
  for (let step = 0; step < 18; step++) { const mid = (low + high) / 2; if (inGamut(lchToRgb(tone, mid, hue))) low = mid; else high = mid; }
  return toHex(lchToRgb(tone, low, hue));
}
export const standardTones = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];
// A palette's colour at a tone: a pinned value, the seed itself at its tone, or generated.
export function paletteTone(palette, tone) {
  if (!palette) return '#ff00ff';
  if (palette.pins?.[tone]) return palette.pins[tone];
  if (tone === palette.seedTone) return palette.seed;
  return toneFromSeed(palette.seed, tone);
}
export const nearestTone = hex => standardTones.slice(1, -1).reduce((best, tone) => Math.abs(tone - toneOf(hex)) < Math.abs(best - toneOf(hex)) ? tone : best, 40);

// ---- Material 3 structure: role and type-role names Angular Material reads as --mat-sys-* ----
export const colorRoles = [
  ['primary', 'primary', 40, 80], ['on-primary', 'primary', 100, 20], ['primary-container', 'primary', 90, 30], ['on-primary-container', 'primary', 10, 90],
  ['secondary', 'secondary', 40, 80], ['on-secondary', 'secondary', 100, 20], ['secondary-container', 'secondary', 90, 30], ['on-secondary-container', 'secondary', 10, 90],
  ['tertiary', 'tertiary', 40, 80], ['on-tertiary', 'tertiary', 100, 20], ['tertiary-container', 'tertiary', 90, 30], ['on-tertiary-container', 'tertiary', 10, 90],
  ['error', 'error', 40, 80], ['on-error', 'error', 100, 20], ['error-container', 'error', 90, 30], ['on-error-container', 'error', 10, 90],
  ['surface', 'neutral', 98, 6], ['surface-dim', 'neutral', 87, 6], ['surface-bright', 'neutral', 98, 24],
  ['surface-container-lowest', 'neutral', 100, 4], ['surface-container-low', 'neutral', 96, 10], ['surface-container', 'neutral', 94, 12],
  ['surface-container-high', 'neutral', 92, 17], ['surface-container-highest', 'neutral', 90, 22],
  ['on-surface', 'neutral', 10, 90], ['on-surface-variant', 'neutralVariant', 30, 80], ['outline', 'neutralVariant', 50, 60], ['outline-variant', 'neutralVariant', 80, 30],
  ['inverse-surface', 'neutral', 20, 90], ['inverse-on-surface', 'neutral', 95, 20], ['inverse-primary', 'primary', 80, 40]
];
// Which role each role is read against, for the AA contrast check.
export const contrastPairs = { primary: 'on-primary', secondary: 'on-secondary', tertiary: 'on-tertiary', error: 'on-error', 'primary-container': 'on-primary-container',
  'secondary-container': 'on-secondary-container', 'tertiary-container': 'on-tertiary-container', 'error-container': 'on-error-container', surface: 'on-surface',
  'surface-container-lowest': 'on-surface', 'surface-container-low': 'on-surface', 'surface-container': 'on-surface', 'surface-container-high': 'on-surface',
  'surface-container-highest': 'on-surface', 'surface-dim': 'on-surface', 'surface-bright': 'on-surface', 'inverse-surface': 'inverse-on-surface' };
export const typeRoles = [
  ['display-large', 'brand', 57, 64, 400, -0.25], ['display-medium', 'brand', 45, 52, 400, 0], ['display-small', 'brand', 36, 44, 400, 0],
  ['headline-large', 'brand', 32, 40, 400, 0], ['headline-medium', 'brand', 28, 36, 400, 0], ['headline-small', 'brand', 24, 32, 400, 0],
  ['title-large', 'brand', 22, 28, 400, 0], ['title-medium', 'plain', 16, 24, 500, 0.15], ['title-small', 'plain', 14, 20, 500, 0.1],
  ['body-large', 'plain', 16, 24, 400, 0.5], ['body-medium', 'plain', 14, 20, 400, 0.25], ['body-small', 'plain', 12, 16, 400, 0.4],
  ['label-large', 'plain', 14, 20, 500, 0.1], ['label-medium', 'plain', 12, 16, 500, 0.5], ['label-small', 'plain', 11, 16, 500, 0.5]
];
export const cornerKeys = ['none', 'extra-small', 'small', 'medium', 'large', 'extra-large', 'full'];
export const easingKeys = ['standard', 'emphasized-decelerate', 'emphasized-accelerate'];
export const durationKeys = ['short', 'medium', 'long'];
export const stateKeys = ['hover', 'focus', 'pressed', 'dragged'];
// Font stacks a type face can be (web fonts are Platform's job later; these render everywhere).
export const faceStacks = ['Roboto, system-ui, sans-serif', 'Inter, Roboto, system-ui, sans-serif', "system-ui, -apple-system, 'Segoe UI', sans-serif",
  "Georgia, 'Times New Roman', serif", "'Iowan Old Style', 'Palatino Linotype', Palatino, serif", "'Trebuchet MS', Roboto, system-ui, sans-serif",
  "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif", "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif", "ui-monospace, 'Roboto Mono', Menlo, monospace"];

// A Material 3 starting set from the Look & feel: the accent seeds primary; secondary, tertiary and neutrals follow its hue.
export function defaultTokens({ accent = '#3047b9', font = 'Roboto, system-ui, sans-serif', radius = 12 } = {}) {
  const [, chroma, hue] = hexToLch(accent);
  const around = (turn, keepChroma) => toHex(lchToRgb(50, keepChroma, hue + turn)).replace(/^#?/, '#');
  const seedAt = (turn, keepChroma) => { const hex = around(turn, keepChroma); return inGamut(hexChannels(hex)) ? hex : toneFromSeed(hex, 50); };
  const r = Math.max(0, Number(radius) || 0);
  return {
    base: 'Material 3',
    palettes: [
      { key: 'primary', name: 'Primary', seed: accent, seedTone: nearestTone(accent), pins: {} },
      { key: 'secondary', name: 'Secondary', seed: seedAt(0, Math.min(chroma, 16)), seedTone: 50, pins: {} },
      { key: 'tertiary', name: 'Tertiary', seed: seedAt(Math.PI / 3, Math.min(chroma, 40)), seedTone: 50, pins: {} },
      { key: 'error', name: 'Error', seed: '#ba1a1a', seedTone: 40, pins: {} },
      { key: 'neutral', name: 'Neutral', seed: seedAt(0, Math.min(chroma, 5)), seedTone: 50, pins: {} },
      { key: 'neutralVariant', name: 'Neutral variant', seed: seedAt(0, Math.min(chroma, 9)), seedTone: 50, pins: {} }
    ],
    roles: colorRoles.map(([id, palette, light, dark]) => ({ id, light: { palette, tone: light }, dark: { palette, tone: dark } })),
    faces: { brand: font, plain: font },
    type: typeRoles.map(([id, face, size, line, weight, tracking]) => ({ id, face, size, line, weight, tracking })),
    corners: { none: 0, 'extra-small': Math.round(r / 3), small: Math.round(r * 2 / 3), medium: r, large: Math.round(r * 4 / 3), 'extra-large': Math.round(r * 7 / 3), full: 9999 },
    spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 },
    elevation: [[0, 'surface', 0, 0, 0], [1, 'surface-container-low', 1, 3, 0.15], [2, 'surface-container', 2, 6, 0.17], [3, 'surface-container-high', 4, 8, 0.19],
      [4, 'surface-container-high', 6, 10, 0.21], [5, 'surface-container-highest', 8, 12, 0.23]].map(([level, fill, y, blur, opacity]) => ({ level, fill, y, blur, opacity })),
    elevationRule: 'fixed',
    motion: { easing: { standard: [0.2, 0, 0, 1], 'emphasized-decelerate': [0.05, 0.7, 0.1, 1], 'emphasized-accelerate': [0.3, 0, 0.8, 0.15] },
      durations: { short: 150, medium: 300, long: 500 }, spring: { stiffness: 700, damping: 0.9 } },
    behaviours: { drag: { lift: 3, scale: 1.02, touchDelay: 250, indicator: 'placeholder' }, stateLayers: { hover: 0.08, focus: 0.1, pressed: 0.1, dragged: 0.16 } }
  };
}

// ---- Resolving roles and rules into values ----
export const paletteOf = (tokens, key) => tokens.palettes.find(palette => palette.key === key);
export function roleColor(tokens, id, mode = 'light') {
  const role = tokens.roles.find(entry => entry.id === id);
  if (!role) return '#ff00ff';
  const ref = mode === 'dark' ? role.dark : role.light;
  return paletteTone(paletteOf(tokens, ref.palette), ref.tone);
}
export const roleContrast = (tokens, id, mode = 'light') => contrastPairs[id] && tokens.roles.some(role => role.id === contrastPairs[id]) ? contrastRatio(roleColor(tokens, id, mode), roleColor(tokens, contrastPairs[id], mode)) : null;
export function shadow({ y, blur, opacity }) {
  if (!opacity) return 'none';
  return `0 ${y}px ${blur}px rgba(0, 0, 0, ${opacity}), 0 ${Math.max(1, Math.round(y / 2))}px ${Math.max(1, Math.round(blur / 3))}px rgba(0, 0, 0, ${Math.round(opacity * 70) / 100})`;
}
// A level's shadow on a given base level: relative rules cast the shadow of the difference.
export function levelShadow(tokens, level, base = 0) {
  const effective = tokens.elevationRule === 'relative' ? Math.max(0, level - base) : level;
  const entry = tokens.elevation.find(item => item.level === effective) || tokens.elevation[0];
  return shadow(entry);
}
const faceStack = (tokens, face) => tokens.faces[face] || tokens.faces.plain;
// Every CSS variable the token set defines for one mode: Angular Material's --mat-sys-* plus the app's own.
// `pick` lets the scaffold ask for light-dark() pairs instead of one mode.
export function tokenVariables(tokens, mode = 'light', pick = null) {
  const color = id => pick ? pick(roleColor(tokens, id, 'light'), roleColor(tokens, id, 'dark')) : roleColor(tokens, id, mode);
  const vars = {};
  for (const role of tokens.roles) vars[`--mat-sys-${role.id}`] = color(role.id);
  const has = id => tokens.roles.some(role => role.id === id);
  if (has('surface')) { vars['--mat-sys-background'] = color('surface'); vars['--mat-sys-surface-tint'] = has('primary') ? color('primary') : color('surface'); }
  if (has('on-surface')) vars['--mat-sys-on-background'] = color('on-surface');
  if (has('surface-container-highest')) vars['--mat-sys-surface-variant'] = color('surface-container-highest');
  vars['--mat-sys-shadow'] = '#000000'; vars['--mat-sys-scrim'] = '#000000';
  for (const type of tokens.type) {
    const font = faceStack(tokens, type.face);
    vars[`--mat-sys-${type.id}`] = `${type.weight} ${type.size}px / ${type.line}px ${font}`;
    vars[`--mat-sys-${type.id}-font`] = font; vars[`--mat-sys-${type.id}-size`] = `${type.size}px`; vars[`--mat-sys-${type.id}-line-height`] = `${type.line}px`;
    vars[`--mat-sys-${type.id}-weight`] = String(type.weight); vars[`--mat-sys-${type.id}-tracking`] = `${type.tracking}px`;
  }
  const c = tokens.corners;
  for (const key of cornerKeys) vars[`--mat-sys-corner-${key}`] = `${c[key]}px`;
  vars['--mat-sys-corner-extra-small-top'] = `${c['extra-small']}px ${c['extra-small']}px 0 0`;
  vars['--mat-sys-corner-large-top'] = `${c.large}px ${c.large}px 0 0`;
  vars['--mat-sys-corner-extra-large-top'] = `${c['extra-large']}px ${c['extra-large']}px 0 0`;
  vars['--mat-sys-corner-large-start'] = `${c.large}px 0 0 ${c.large}px`;
  vars['--mat-sys-corner-large-end'] = `0 ${c.large}px ${c.large}px 0`;
  for (const entry of tokens.elevation) vars[`--mat-sys-level${entry.level}`] = shadow(entry);
  for (const key of stateKeys) vars[`--mat-sys-${key}-state-layer-opacity`] = String(tokens.behaviours.stateLayers[key]);
  for (const key of easingKeys) vars[`--app-ease-${key}`] = `cubic-bezier(${tokens.motion.easing[key].join(', ')})`;
  for (const key of durationKeys) vars[`--app-duration-${key}`] = `${tokens.motion.durations[key]}ms`;
  for (const [key, value] of Object.entries(tokens.spacing)) vars[`--app-space-${key}`] = `${value}px`;
  vars['--app-radius'] = `${c.medium}px`; vars['--app-font'] = tokens.faces.plain; vars['--app-font-brand'] = tokens.faces.brand;
  return vars;
}

// ---- W3C design tokens (DTCG 2025.10): colour values in the Color module's object form; aliases in {curly} references ----
const dtcgColor = hex => ({ colorSpace: 'srgb', components: hexChannels(hex).map(value => Math.round(value / 255 * 10000) / 10000), alpha: 1, hex });
const px = value => ({ value, unit: 'px' });
export function toDtcg(tokens, name = 'App') {
  const palette = {};
  for (const entry of tokens.palettes) {
    const tones = [...new Set([...standardTones, ...tokens.roles.flatMap(role => [role.light, role.dark]).filter(ref => ref.palette === entry.key).map(ref => ref.tone)])].sort((a, b) => a - b);
    palette[entry.key] = { $description: `${entry.name}: seed ${entry.seed} at tone ${entry.seedTone}`, ...Object.fromEntries(tones.map(tone => [String(tone), { $type: 'color', $value: dtcgColor(paletteTone(entry, tone)),
      ...(entry.pins?.[tone] ? { $extensions: { 'org.aludel': { pinned: true } } } : {}) }])) };
  }
  const color = Object.fromEntries(tokens.roles.map(role => [role.id, { $type: 'color', $value: `{palette.${role.light.palette}.${role.light.tone}}`,
    $extensions: { 'org.aludel': { modes: { light: `{palette.${role.light.palette}.${role.light.tone}}`, dark: `{palette.${role.dark.palette}.${role.dark.tone}}` } } } }]));
  return {
    $description: `${name} design tokens, generated by Aludel from the Design layer (base: ${tokens.base}). Colour roles carry light and dark values in $extensions.org.aludel.modes.`,
    palette, color,
    font: { brand: { $type: 'fontFamily', $value: tokens.faces.brand.split(',').map(item => item.trim().replace(/^'|'$/g, '')) }, plain: { $type: 'fontFamily', $value: tokens.faces.plain.split(',').map(item => item.trim().replace(/^'|'$/g, '')) } },
    type: Object.fromEntries(tokens.type.map(type => [type.id, { $type: 'typography', $value: { fontFamily: `{font.${type.face}}`, fontSize: px(type.size), fontWeight: type.weight,
      lineHeight: Math.round(type.line / type.size * 1000) / 1000, letterSpacing: px(type.tracking) } }])),
    corner: Object.fromEntries(cornerKeys.map(key => [key, { $type: 'dimension', $value: px(tokens.corners[key]) }])),
    space: Object.fromEntries(Object.entries(tokens.spacing).map(([key, value]) => [key, { $type: 'dimension', $value: px(value) }])),
    elevation: Object.fromEntries(tokens.elevation.map(entry => [`level${entry.level}`, { $extensions: { 'org.aludel': { kind: 'elevation', rule: tokens.elevationRule } },
      fill: { $type: 'color', $value: `{color.${entry.fill}}` },
      shadow: { $type: 'shadow', $value: { color: { colorSpace: 'srgb', components: [0, 0, 0], alpha: entry.opacity }, offsetX: px(0), offsetY: px(entry.y), blur: px(entry.blur), spread: px(0) } } }])),
    motion: {
      easing: Object.fromEntries(easingKeys.map(key => [key, { $type: 'cubicBezier', $value: tokens.motion.easing[key] }])),
      duration: Object.fromEntries(durationKeys.map(key => [key, { $type: 'duration', $value: { value: tokens.motion.durations[key], unit: 'ms' } }])),
      spring: { $extensions: { 'org.aludel': { kind: 'spring', stiffness: tokens.motion.spring.stiffness, damping: tokens.motion.spring.damping } } }
    },
    behaviour: {
      stateLayer: Object.fromEntries(stateKeys.map(key => [key, { $type: 'number', $value: tokens.behaviours.stateLayers[key] }])),
      drag: { $extensions: { 'org.aludel': { kind: 'behaviour', ...tokens.behaviours.drag, lift: `{elevation.level${tokens.behaviours.drag.lift}}` } } }
    }
  };
}

// ---- Generated brand images: a monogram mark and banners, as SVG ----
const escapeXml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
export const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('') || '?';
export function markSvg({ text, background, foreground, radius = 0.24, size = 64, font = 'system-ui, sans-serif' }) {
  const r = Math.round(size * radius);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${escapeXml(background)}"/>`
    + `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="${escapeXml(font)}" font-weight="700" font-size="${Math.round(size * (String(text).length > 1 ? 0.4 : 0.52))}" fill="${escapeXml(foreground)}">${escapeXml(text)}</text></svg>`;
}
export function bannerSvg({ width, height, background, accent, foreground, markText, markBackground, markForeground, headline, subline = '', font = 'system-ui, sans-serif', brandFont = font }) {
  const m = Math.round(Math.min(height * 0.36, 140));
  const pad = Math.round(Math.min(width, height) * 0.12);
  const title = Math.round(Math.min(height * 0.13, width * 0.045));
  const sub = Math.round(title * 0.55);
  const top = Math.round(height / 2 - m / 2);
  const textX = pad + m + Math.round(pad / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${escapeXml(background)}"/><stop offset="1" stop-color="${escapeXml(accent)}"/></linearGradient></defs>`
    + `<rect width="${width}" height="${height}" fill="url(#g)"/>`
    + `<rect x="${pad}" y="${top}" width="${m}" height="${m}" rx="${Math.round(m * 0.24)}" fill="${escapeXml(markBackground)}"/>`
    + `<text x="${pad + m / 2}" y="${top + m / 2}" dominant-baseline="central" text-anchor="middle" font-family="${escapeXml(font)}" font-weight="700" font-size="${Math.round(m * 0.4)}" fill="${escapeXml(markForeground)}">${escapeXml(markText)}</text>`
    + `<text x="${textX}" y="${Math.round(height / 2 + (subline ? -sub * 0.4 : title * 0.35))}" font-family="${escapeXml(brandFont)}" font-weight="700" font-size="${title}" fill="${escapeXml(foreground)}">${escapeXml(headline)}</text>`
    + (subline ? `<text x="${textX}" y="${Math.round(height / 2 + sub * 1.6)}" font-family="${escapeXml(font)}" font-size="${sub}" fill="${escapeXml(foreground)}" fill-opacity="0.85">${escapeXml(subline)}</text>` : '')
    + '</svg>';
}
