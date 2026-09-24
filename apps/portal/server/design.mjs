// The Design layer's records (DESIGN-UX-01, DEC-045): the token set, component contracts and brand assets.
// Validators here are called from knowledge.mjs (one per kind, as every kind has). The token maths is shared with the
// portal in src/design-tokens.js, so the preview and the generated app compute the same values.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { colorRoles, cornerKeys, defaultTokens, durationKeys, easingKeys, initials, markSvg, bannerSvg, roleColor, stateKeys, toDtcg, tokenVariables, typeRoles } from '../src/design-tokens.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const text = (value, max, label, required = false) => {
  const clean = String(value ?? '').trim();
  if (required && !clean) fail(`${label} is required.`);
  if (clean.length > max) fail(`${label} must be under ${max} characters.`);
  return clean;
};
const lines = (value, max, label) => (Array.isArray(value) ? value : []).map(item => text(item, max, label)).filter(Boolean);
const number = (value, min, max, label) => {
  const clean = Number(value);
  if (!Number.isFinite(clean) || clean < min || clean > max) fail(`${label} must be between ${min} and ${max}.`);
  return Math.round(clean * 1000) / 1000;
};
const hex = (value, label) => {
  const clean = String(value || '').trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(clean)) fail(`${label} must be a colour like #2e7d5b.`);
  return clean;
};
const slug = (value, label, example) => {
  const clean = text(value, 40, label, true);
  if (!/^[a-z][a-zA-Z0-9-]*$/.test(clean)) fail(`${label} “${clean}” should look like ${example}.`);
  return clean;
};
const stack = (value, label) => {
  const clean = text(value, 200, label, true);
  if (/[;{}<>]/.test(clean)) fail(`${label} is a list of font names, like Inter, Roboto, sans-serif.`);
  return clean;
};

// ---- Token set: one record per project, revisioned as a whole ----
export function cleanTokens(data) {
  const palettes = (Array.isArray(data.palettes) ? data.palettes : []).slice(0, 12).map(palette => {
    const pins = Object.fromEntries(Object.entries(palette?.pins && typeof palette.pins === 'object' ? palette.pins : {}).slice(0, 40)
      .map(([tone, value]) => [String(number(tone, 0, 100, 'A pinned tone')), hex(value, 'A pinned tone')]));
    return { key: slug(palette?.key, 'Palette key', 'primary'), name: text(palette?.name, 40, 'Palette name', true), seed: hex(palette?.seed, `${palette?.name || 'Palette'} seed`),
      seedTone: number(palette?.seedTone ?? 40, 1, 99, 'Seed tone'), pins };
  });
  if (!palettes.length) fail('A token set needs at least one palette.');
  if (new Set(palettes.map(palette => palette.key)).size !== palettes.length) fail('Two palettes share a key.');
  const paletteKeys = new Set(palettes.map(palette => palette.key));
  const ref = (value, label) => {
    if (!paletteKeys.has(value?.palette)) fail(`${label} points at a palette that doesn't exist.`);
    return { palette: value.palette, tone: number(value.tone, 0, 100, `${label} tone`) };
  };
  const roles = (Array.isArray(data.roles) ? data.roles : []).slice(0, 80).map(role => {
    const id = slug(role?.id, 'Colour role', 'primary-container');
    return { id, light: ref(role.light, `color.${id} (light)`), dark: ref(role.dark, `color.${id} (dark)`) };
  });
  if (new Set(roles.map(role => role.id)).size !== roles.length) fail('Two colour roles share a name.');
  const roleIds = new Set(roles.map(role => role.id));
  const faces = { brand: stack(data.faces?.brand, 'Brand type face'), plain: stack(data.faces?.plain, 'Plain type face') };
  const typeIds = new Set(typeRoles.map(([id]) => id));
  const type = (Array.isArray(data.type) ? data.type : []).map(entry => {
    if (!typeIds.has(entry?.id)) fail('Unknown type role.');
    if (!['brand', 'plain'].includes(entry.face)) fail(`type.${entry.id} uses the brand or plain face.`);
    return { id: entry.id, face: entry.face, size: number(entry.size, 6, 160, `type.${entry.id} size`), line: number(entry.line, 6, 200, `type.${entry.id} line height`),
      weight: Math.round(number(entry.weight, 100, 900, `type.${entry.id} weight`) / 100) * 100, tracking: number(entry.tracking, -5, 5, `type.${entry.id} letter spacing`) };
  });
  if (type.length !== typeIds.size || new Set(type.map(entry => entry.id)).size !== typeIds.size) fail('The token set needs each of the fifteen type roles once.');
  const corners = Object.fromEntries(cornerKeys.map(key => [key, number(data.corners?.[key], 0, 9999, `corner.${key}`)]));
  const spacing = Object.fromEntries(Object.entries(data.spacing && typeof data.spacing === 'object' ? data.spacing : {}).slice(0, 16)
    .map(([key, value]) => [slug(`s${key}`, 'Spacing step', '4').slice(1), number(value, 0, 400, `space.${key}`)]));
  const elevation = (Array.isArray(data.elevation) ? data.elevation : []).map(entry => {
    if (!roleIds.has(entry?.fill)) fail(`Elevation level ${entry?.level} fills with a colour role that doesn't exist.`);
    return { level: number(entry.level, 0, 5, 'Elevation level'), fill: entry.fill, y: number(entry.y, 0, 64, 'Shadow offset'), blur: number(entry.blur, 0, 128, 'Shadow blur'), opacity: number(entry.opacity, 0, 1, 'Shadow opacity') };
  }).sort((a, b) => a.level - b.level);
  if (elevation.map(entry => entry.level).join() !== '0,1,2,3,4,5') fail('Elevation has levels 0 to 5, once each.');
  if (!['fixed', 'relative'].includes(data.elevationRule || 'fixed')) fail('Shadows are fixed per level or relative to what is below.');
  const bezier = (value, label) => {
    if (!Array.isArray(value) || value.length !== 4) fail(`${label} is four numbers.`);
    return [number(value[0], 0, 1, label), number(value[1], -2, 3, label), number(value[2], 0, 1, label), number(value[3], -2, 3, label)];
  };
  const motion = {
    easing: Object.fromEntries(easingKeys.map(key => [key, bezier(data.motion?.easing?.[key], `easing.${key}`)])),
    durations: Object.fromEntries(durationKeys.map(key => [key, number(data.motion?.durations?.[key], 0, 5000, `duration.${key}`)])),
    spring: { stiffness: number(data.motion?.spring?.stiffness, 10, 10000, 'Spring stiffness'), damping: number(data.motion?.spring?.damping, 0.05, 2, 'Spring damping') }
  };
  const drag = data.behaviours?.drag || {};
  if (!['placeholder', 'line'].includes(drag.indicator || 'placeholder')) fail('The drop target is a placeholder or a line.');
  const behaviours = {
    drag: { lift: number(drag.lift ?? 3, 0, 5, 'Lift level'), scale: number(drag.scale ?? 1, 1, 1.2, 'Scale while held'), touchDelay: number(drag.touchDelay ?? 250, 0, 2000, 'Touch hold'), indicator: drag.indicator || 'placeholder' },
    stateLayers: Object.fromEntries(stateKeys.map(key => [key, number(data.behaviours?.stateLayers?.[key], 0, 1, `${key} state layer`)]))
  };
  return { base: text(data.base || 'Custom', 60, 'Base system'), palettes, roles, faces, type, corners, spacing, elevation, elevationRule: data.elevationRule || 'fixed', motion, behaviours,
    fromLook: Boolean(data.fromLook) };
}

// ---- Component contracts (stack-neutral) ----
export const componentGroups = ['Actions', 'Containment', 'Navigation', 'Selection', 'Text inputs', 'Lists', 'Feedback', 'Layouts', 'Other'];
const propKinds = ['variant', 'boolean', 'text', 'swap'];
// Preview renderers the portal has for the aludel-web-v1 stack (Angular Material components, themed by the tokens).
export const previewKinds = ['button', 'icon-button', 'fab', 'card', 'chip', 'switch', 'text-field', 'list', 'list-item', 'nav-list', 'nav-item', 'toolbar', 'nav-bar', 'dialog', 'scaffold', 'list-detail'];
const tokenPath = value => {
  const clean = text(value, 60, 'Token');
  if (!/^(color|type|corner|elevation|space|motion|state-layers|face|palette)(\.[a-z0-9-]+)*$/.test(clean)) fail(`“${clean}” isn't a token path like color.primary or type.label-large.`);
  return clean;
};
export function cleanComponent(data) {
  const group = text(data.group || 'Other', 40, 'Group');
  if (!componentGroups.includes(group)) fail(`Choose a group: ${componentGroups.join(', ')}.`);
  const props = (Array.isArray(data.props) ? data.props : []).slice(0, 16).map(prop => {
    if (!propKinds.includes(prop?.kind)) fail(`A property is a ${propKinds.join(', ')}.`);
    const key = text(prop.key, 40, 'Property name', true);
    if (!/^[a-z][a-zA-Z0-9]*$/.test(key)) fail(`Property “${key}” should look like leadingIcon.`);
    const options = prop.kind === 'variant' || prop.kind === 'swap' ? lines(prop.options, 40, 'Option').slice(0, 12) : [];
    if ((prop.kind === 'variant' || prop.kind === 'swap') && !options.length) fail(`“${key}” needs at least one option.`);
    const fallback = prop.kind === 'boolean' ? Boolean(prop.default) : text(prop.default ?? (options[0] || ''), 200, `${key} default`);
    if (options.length && !options.includes(fallback)) fail(`“${key}” defaults to one of its options.`);
    return { key, kind: prop.kind, options, default: fallback };
  });
  if (new Set(props.map(prop => prop.key)).size !== props.length) fail('Two properties share a name.');
  const slots = (Array.isArray(data.slots) ? data.slots : []).slice(0, 8).map(slot => {
    const min = Math.round(number(slot?.min ?? 0, 0, 50, 'Slot minimum'));
    const max = slot?.max === null || slot?.max === '' || slot?.max === undefined ? null : Math.round(number(slot.max, 1, 50, 'Slot maximum'));
    if (max !== null && max < min) fail(`Slot “${slot.name}” allows fewer than it needs.`);
    return { name: text(slot.name, 40, 'Slot name', true), accepts: (Array.isArray(slot.accepts) ? slot.accepts : []).map(String).filter(id => /^cmp-[a-z0-9]{6,12}$/.test(id)).slice(0, 12),
      anything: Boolean(slot.anything), min, max };
  });
  const anatomy = (Array.isArray(data.anatomy) ? data.anatomy : []).slice(0, 16).map(part => ({ part: text(part?.part, 40, 'Part', true),
    tokens: (Array.isArray(part.tokens) ? part.tokens : []).slice(0, 8).map(tokenPath), note: text(part.note, 160, 'Part note') }));
  const binding = data.binding && (data.binding.library || data.binding.selector) ? { library: text(data.binding.library, 60, 'Library', true), selector: text(data.binding.selector, 160, 'Selector', true),
    map: (Array.isArray(data.binding.map) ? data.binding.map : []).slice(0, 16).map(entry => ({ prop: text(entry?.prop, 40, 'Property', true), code: text(entry?.code, 200, 'Code', true) })) } : null;
  const preview = data.preview ? text(data.preview, 20, 'Preview') : null;
  if (preview && !previewKinds.includes(preview)) fail('Unknown preview.');
  return { name: text(data.name, 60, 'Component name', true), group, purpose: text(data.purpose, 300, 'Purpose'), note: text(data.note, 300, 'Note'), props, slots, anatomy,
    a11y: lines(data.a11y, 300, 'Accessibility note').slice(0, 12), binding, preview, origin: text(data.origin || 'You', 60, 'Origin') };
}
// needed (a name) → specified (a contract) → built (a binding to the stack).
export const componentStatus = component => component.binding ? 'built' : component.props.length || component.anatomy.length || component.slots.length ? 'specified' : 'needed';

// ---- Brand assets: starter examples, never required fields ----
export const brandTypes = ['image', 'text', 'mark', 'banner'];
export const brandKeys = ['name', 'tagline', 'description', 'mark'];
export function cleanBrandAsset(data, roleIds = null) {
  const type = data.type || 'text';
  if (!brandTypes.includes(type)) fail(`A brand asset is ${brandTypes.join(', ')}.`);
  const key = data.key ? text(data.key, 20, 'Key') : null;
  if (key && !brandKeys.includes(key)) fail('Unknown brand key.');
  if (key === 'mark' && type !== 'mark' && type !== 'image') fail('The app mark is a monogram or an image.');
  if (key && key !== 'mark' && type !== 'text') fail(`The app's ${key} is text.`);
  const role = (value, fallback) => { const clean = text(value || fallback, 40, 'Colour role'); if (roleIds && !roleIds.has(clean)) fail(`Colour role “${clean}” doesn't exist.`); return clean; };
  const assetId = type === 'image' ? (/^asset-[0-9a-f-]{36}$/.test(String(data.assetId || '')) ? data.assetId : fail('Upload an image for this asset.')) : null;
  return {
    name: text(data.name, 80, 'Asset name', true), type, key, text: type === 'text' ? text(data.text, 2000, 'Text', true) : '',
    assetId,
    mark: type === 'mark' ? { text: text(data.mark?.text, 3, 'Monogram', true), background: role(data.mark?.background, 'primary'), foreground: role(data.mark?.foreground, 'on-primary') } : null,
    banner: type === 'banner' ? { width: Math.round(number(data.banner?.width, 100, 4000, 'Width')), height: Math.round(number(data.banner?.height, 100, 4000, 'Height')),
      headline: text(data.banner?.headline, 120, 'Headline'), subline: text(data.banner?.subline, 160, 'Subline'), background: role(data.banner?.background, 'primary'), accent: role(data.banner?.accent, 'tertiary') } : null,
    notes: text(data.notes, 1000, 'Notes'), starter: Boolean(data.starter), template: data.template ? text(data.template, 40, 'Template') : null
  };
}
// Templates add stock assets you can change or delete (config/brand-templates.json).
export function loadBrandTemplates(configDirectory) {
  const templates = JSON.parse(readFileSync(join(configDirectory, 'brand-templates.json'), 'utf8')).templates;
  for (const [id, template] of Object.entries(templates)) for (const asset of template.assets) cleanBrandAsset({ ...asset, template: id });
  return templates;
}

// ---- Seeds ----
// What aludel-web-v1 provides: Angular Material components and the template's own. Keys join children and slots.
export const componentSeeds = [
  { key: 'button', name: 'Button', group: 'Actions', preview: 'button', purpose: 'Starts an action. One filled button per view for the main action.',
    props: [{ key: 'variant', kind: 'variant', options: ['Filled', 'Tonal', 'Outlined', 'Text', 'Elevated'], default: 'Filled' }, { key: 'label', kind: 'text', default: 'Continue' },
      { key: 'icon', kind: 'swap', options: ['none', 'add', 'check', 'send', 'arrow_forward'], default: 'none' }, { key: 'disabled', kind: 'boolean', default: false }],
    anatomy: [{ part: 'Container', tokens: ['color.primary', 'corner.full'] }, { part: 'Label', tokens: ['type.label-large', 'color.on-primary'] }, { part: 'State layer', tokens: ['state-layers'] }],
    a11y: ['Uses a native button; the label is its accessible name.', 'Icon-only actions use the Icon button instead.', 'Visible focus ring; at least 48px to tap.'],
    binding: { library: 'Angular Material 22', selector: 'button[matButton]', map: [{ prop: 'variant', code: 'matButton="filled | tonal | outlined | text | elevated"' }, { prop: 'icon', code: '<mat-icon> before the label' }, { prop: 'disabled', code: '[disabled]' }] } },
  { key: 'iconbutton', name: 'Icon button', group: 'Actions', preview: 'icon-button', purpose: 'A single icon action, like share or close.',
    props: [{ key: 'icon', kind: 'swap', options: ['share', 'close', 'favorite', 'more_vert'], default: 'share' }, { key: 'label', kind: 'text', default: 'Share' }],
    anatomy: [{ part: 'Container', tokens: ['corner.full'] }, { part: 'Icon', tokens: ['color.on-surface-variant'] }], a11y: ['Always has an accessible label.'],
    binding: { library: 'Angular Material 22', selector: 'button[matIconButton]', map: [{ prop: 'icon', code: '<mat-icon>' }, { prop: 'label', code: 'aria-label' }] } },
  { key: 'fab', name: 'Floating action button', group: 'Actions', preview: 'fab', purpose: 'The main action on a screen that has one.',
    props: [{ key: 'label', kind: 'text', default: 'Create' }, { key: 'icon', kind: 'swap', options: ['add', 'edit', 'send'], default: 'add' }, { key: 'extended', kind: 'boolean', default: true }],
    anatomy: [{ part: 'Container', tokens: ['color.primary-container', 'corner.large', 'elevation.level3'] }, { part: 'Icon and label', tokens: ['color.on-primary-container', 'type.label-large'] }],
    a11y: ['At most one per screen.'], binding: { library: 'Angular Material 22', selector: 'button[matFab] / button[matExtendedFab]', map: [{ prop: 'extended', code: 'matExtendedFab' }] } },
  { key: 'card', name: 'Card', group: 'Containment', preview: 'card', purpose: 'Groups the content and actions for one item.',
    props: [{ key: 'variant', kind: 'variant', options: ['Elevated', 'Filled', 'Outlined'], default: 'Elevated' }, { key: 'headline', kind: 'text', default: 'Card title' },
      { key: 'supporting', kind: 'text', default: 'Supporting text' }, { key: 'media', kind: 'boolean', default: true }],
    slots: [{ name: 'actions', accepts: ['button'], min: 0, max: 2 }],
    anatomy: [{ part: 'Container', tokens: ['color.surface-container-low', 'corner.medium', 'elevation.level1'] }, { part: 'Headline', tokens: ['type.title-medium'] },
      { part: 'Supporting text', tokens: ['type.body-medium', 'color.on-surface-variant'] }, { part: 'Actions', note: 'Up to two buttons, at the end' }],
    a11y: ['A card holding buttons is not itself one link.'], binding: { library: 'Angular Material 22', selector: 'mat-card', map: [{ prop: 'variant', code: 'appearance="raised | filled | outlined"' }, { prop: 'actions', code: '<mat-card-actions align="end">' }] } },
  { key: 'dialog', name: 'Dialog', group: 'Containment', preview: 'dialog', purpose: 'Asks for a decision before continuing.',
    props: [{ key: 'headline', kind: 'text', default: 'Discard draft?' }, { key: 'body', kind: 'text', default: 'Your changes will be lost.' }],
    slots: [{ name: 'actions', accepts: ['button'], min: 1, max: 2 }],
    anatomy: [{ part: 'Container', tokens: ['color.surface-container-high', 'corner.extra-large', 'elevation.level3'] }, { part: 'Headline', tokens: ['type.headline-small'] }, { part: 'Body', tokens: ['type.body-medium'] }],
    a11y: ['Focus moves into the dialog and returns when it closes.', 'Esc closes it.'], binding: { library: 'Angular Material 22', selector: 'MatDialog', map: [{ prop: 'headline', code: 'mat-dialog-title' }, { prop: 'actions', code: 'mat-dialog-actions' }] } },
  { key: 'chip', name: 'Chip', group: 'Selection', preview: 'chip', purpose: 'Filters a list or shows a choice.',
    props: [{ key: 'label', kind: 'text', default: 'Nearby' }, { key: 'selected', kind: 'boolean', default: true }],
    anatomy: [{ part: 'Container', tokens: ['corner.small', 'color.outline'] }, { part: 'Selected', tokens: ['color.secondary-container'] }, { part: 'Label', tokens: ['type.label-large'] }],
    a11y: ['Filter chips are toggle buttons.'], binding: { library: 'Angular Material 22', selector: 'mat-chip-option', map: [{ prop: 'selected', code: '[selected]' }] } },
  { key: 'switch', name: 'Switch', group: 'Selection', preview: 'switch', purpose: 'Turns one setting on or off straight away.',
    props: [{ key: 'label', kind: 'text', default: 'Email me updates' }, { key: 'on', kind: 'boolean', default: true }],
    anatomy: [{ part: 'Track', tokens: ['color.primary', 'corner.full'] }, { part: 'Handle', tokens: ['color.on-primary'] }], a11y: ['A switch with its label.'],
    binding: { library: 'Angular Material 22', selector: 'mat-slide-toggle', map: [{ prop: 'on', code: '[checked]' }] } },
  { key: 'textfield', name: 'Text field', group: 'Text inputs', preview: 'text-field', purpose: 'Lets people enter a value.',
    props: [{ key: 'variant', kind: 'variant', options: ['Filled', 'Outlined'], default: 'Filled' }, { key: 'label', kind: 'text', default: 'Email' }, { key: 'hint', kind: 'text', default: 'We never share it' },
      { key: 'error', kind: 'boolean', default: false }],
    anatomy: [{ part: 'Container', tokens: ['color.surface-container-highest', 'corner.extra-small'] }, { part: 'Label', tokens: ['type.body-small'] }, { part: 'Value', tokens: ['type.body-large'] }, { part: 'Error', tokens: ['color.error'] }],
    a11y: ['The label stays visible.', 'Errors say how to fix them.'], binding: { library: 'Angular Material 22', selector: 'mat-form-field + input[matInput]', map: [{ prop: 'variant', code: 'appearance="fill | outline"' }, { prop: 'error', code: '<mat-error>' }] } },
  { key: 'list', name: 'List', group: 'Lists', preview: 'list', purpose: 'A column of related rows.',
    slots: [{ name: 'items', accepts: ['listitem'], min: 1, max: null }], anatomy: [{ part: 'Container', tokens: ['color.surface'] }], a11y: ['A list of items; rows that act are buttons or links.'],
    binding: { library: 'Angular Material 22', selector: 'mat-list', map: [{ prop: 'items', code: '<mat-list-item>' }] } },
  { key: 'listitem', parent: 'list', name: 'List item', group: 'Lists', preview: 'list-item', purpose: 'One row in a list.',
    props: [{ key: 'headline', kind: 'text', default: 'Ada Lovelace' }, { key: 'supporting', kind: 'text', default: 'Joined in March' }, { key: 'leading', kind: 'variant', options: ['Avatar', 'Icon', 'None'], default: 'Avatar' }],
    anatomy: [{ part: 'Headline', tokens: ['type.body-large'] }, { part: 'Supporting text', tokens: ['type.body-medium', 'color.on-surface-variant'] }], a11y: ['One tab stop per row when rows act.'],
    binding: { library: 'Angular Material 22', selector: 'mat-list-item', map: [{ prop: 'headline', code: 'matListItemTitle' }, { prop: 'supporting', code: 'matListItemLine' }] } },
  { key: 'navlist', name: 'Nav list', group: 'Navigation', preview: 'nav-list', purpose: 'The side navigation on wide screens.',
    slots: [{ name: 'items', accepts: ['navitem'], min: 1, max: 7 }],
    anatomy: [{ part: 'Container', tokens: ['color.surface-container-low', 'corner.large'] }, { part: 'Items', note: 'One to seven, exactly one selected' }],
    a11y: ['A navigation landmark with a label.', 'The current page is marked.'], binding: { library: 'aludel-web-v1', selector: 'nav.nav (app shell)', map: [{ prop: 'items', code: 'one link per page record' }] } },
  { key: 'navitem', parent: 'navlist', name: 'Nav item', group: 'Navigation', preview: 'nav-item', purpose: 'One destination in the navigation.',
    props: [{ key: 'label', kind: 'text', default: 'Home' }, { key: 'icon', kind: 'swap', options: ['home', 'search', 'inventory_2', 'chat', 'person', 'settings'], default: 'home' },
      { key: 'badge', kind: 'text', default: '' }, { key: 'selected', kind: 'boolean', default: false }],
    anatomy: [{ part: 'Indicator', tokens: ['color.primary-container', 'corner.medium'] }, { part: 'Label', tokens: ['type.label-large'] }], a11y: ['A link; the selected one is the current page.'],
    binding: { library: 'aludel-web-v1', selector: 'nav.nav a', map: [{ prop: 'selected', code: 'class "active"' }] } },
  { key: 'toolbar', name: 'Top app bar', group: 'Navigation', preview: 'toolbar', purpose: 'The title and actions for the current page.',
    props: [{ key: 'title', kind: 'text', default: 'Page title' }, { key: 'back', kind: 'boolean', default: false }],
    slots: [{ name: 'actions', accepts: ['iconbutton'], min: 0, max: 3 }],
    anatomy: [{ part: 'Container', tokens: ['color.surface'] }, { part: 'Title', tokens: ['type.title-large'] }], a11y: ['The title is the page heading.'],
    binding: { library: 'aludel-web-v1', selector: 'header (app shell)', map: [{ prop: 'title', code: 'page label' }] } },
  { key: 'navbar', name: 'Navigation bar', group: 'Navigation', preview: 'nav-bar', purpose: 'Bottom tabs on phones, three to five.',
    slots: [{ name: 'items', accepts: ['navitem'], min: 3, max: 5 }],
    anatomy: [{ part: 'Container', tokens: ['color.surface-container'] }, { part: 'Indicator', tokens: ['color.primary-container', 'corner.full'] }], a11y: ['Links; one is the current page.'],
    binding: { library: 'aludel-web-v1', selector: 'nav.tabs (app shell, phones)', map: [{ prop: 'items', code: 'first five page records' }] } },
  { key: 'scaffold', name: 'Page scaffold', group: 'Layouts', preview: 'scaffold', purpose: 'Every page: navigation, header and content.',
    props: [{ key: 'navigation', kind: 'variant', options: ['Side', 'Top'], default: 'Side' }],
    slots: [{ name: 'navigation', accepts: ['navlist', 'navbar'], min: 1, max: 2 }, { name: 'content', anything: true, min: 1, max: null }],
    anatomy: [{ part: 'Regions', note: 'navigation · header · content' }], a11y: ['A skip link to the content.', 'One main landmark.'],
    binding: { library: 'aludel-web-v1', selector: 'app-root shell', map: [{ prop: 'navigation', code: 'Look & feel navigation (sidebar | top)' }] } }
];
function seedComponents(insert, update) {
  const ids = new Map();
  const made = [];
  for (const seed of componentSeeds) {
    const { key, parent, slots = [], ...rest } = seed;
    const record = insert('component', { ...rest, slots: [], origin: 'Aludel template' }, parent ? ids.get(parent) : null);
    ids.set(key, record.id); made.push([record, slots]);
  }
  for (const [record, slots] of made) if (slots.length) update(record.id, { slots: slots.map(slot => ({ ...slot, accepts: (slot.accepts || []).map(key => ids.get(key)).filter(Boolean) })) });
}

export function ensureDesign({ projectId, list, insert, update, once, db, catalogs }) {
  const setup = db.prepare(`SELECT p.name, p.description, p.accent_color, s.feel, s.design_notes FROM projects p JOIN project_setup s ON s.project_id = p.id WHERE p.id = ?`).get(projectId);
  if (!setup) return;
  const feel = catalogs.feels?.[setup.feel || 'sleek-saas'] || Object.values(catalogs.feels || {})[0] || {};
  if (!list(projectId, 'design_tokens').length) insert(projectId, 'design_tokens', { ...defaultTokens({ accent: setup.accent_color || feel.accent, font: feel.font, radius: feel.radius }), fromLook: true },
    { rationale: `Material 3 starting set from the Look & feel (${feel.label || 'default'})` });
  if (once(projectId, 'design-components-seeded') && !list(projectId, 'component').length) {
    seedComponents((kind, data, parentId) => insert(projectId, kind, data, { parentId, author: 'Aludel template', rationale: 'Provided by aludel-web-v1' }),
      (id, changes) => update(projectId, id, changes, { author: 'Aludel template', rationale: 'Slots accept the template components' }));
  }
  if (once(projectId, 'design-brand-seeded')) {
    const pitch = String(setup.description || '').trim();
    const starter = (data, note) => insert(projectId, 'brand_asset', { ...data, starter: true }, { author: 'Aludel', rationale: note });
    starter({ name: 'Product name', type: 'text', key: 'name', text: setup.name }, 'Starter: the app title');
    if (pitch) starter({ name: 'Tagline', type: 'text', key: 'tagline', text: pitch.split(/(?<=[.!?])\s/)[0].slice(0, 120) }, 'Starter: from the elevator pitch');
    if (pitch) starter({ name: 'Short description', type: 'text', key: 'description', text: pitch.slice(0, 300) }, 'Starter: from the elevator pitch');
    starter({ name: 'Logo mark', type: 'mark', key: 'mark', mark: { text: initials(setup.name), background: 'primary', foreground: 'on-primary' } }, 'Starter: a monogram in the primary colour');
    starter({ name: 'Social card', type: 'banner', banner: { width: 1200, height: 630, headline: setup.name, subline: pitch.slice(0, 90), background: 'primary', accent: 'tertiary' } }, 'Starter: shown when a link is shared');
  }
  if (once(projectId, 'design-docs-seeded')) {
    const notes = String(setup.design_notes || '').trim();
    insert(projectId, 'doc', { title: 'Design direction', template: 'Design direction', showsIn: ['design'], agents: true,
      body: `# Design direction\n\n## Feel\n\n${feel.label ? `${feel.label}: ${feel.summary}` : 'Not chosen yet.'}\n\n${notes ? `## Notes\n\n${notes}\n\n` : ''}## What to keep consistent\n\n- One filled button per view for the main action.\n- Each page opens with its title, then a one-line description.\n` },
      { author: 'Aludel', rationale: 'Starter: from the Look & feel' });
    insert(projectId, 'doc', { title: 'Accessibility baseline', template: 'Accessibility baseline', showsIn: ['design', 'pages'], agents: true,
      body: '# Accessibility baseline\n\n## Standard\n\nWCAG 2.2 AA. Text contrast at least 4.5:1; large text and interface parts at least 3:1. The Design layer checks colour roles against these.\n\n## Interaction\n\n- Everything works with a keyboard and shows a visible focus ring.\n- Touch targets are at least 48px.\n- Every drag has a keyboard alternative.\n- Motion respects "reduce motion".\n' },
      { author: 'Aludel', rationale: 'Starter: the default baseline' });
  }
  // Reference media from onboarding become Library sources (DESIGN-UX-01 D19); the uploads stay where the scaffold reads them.
  if (once(projectId, 'reference-media-to-library')) {
    for (const asset of db.prepare("SELECT id, kind, filename, notes FROM project_assets WHERE project_id = ? AND COALESCE(purpose, 'reference') = 'reference' ORDER BY created_at").all(projectId)) {
      insert(projectId, 'source', { type: asset.kind === 'image' ? 'screenshot' : 'note', title: asset.filename, body: asset.notes || '', assetId: asset.id }, { rationale: 'Reference media from onboarding (DESIGN-UX-01)' });
    }
  }
}

// While the token set still comes straight from the Look & feel, changing the Look & feel regenerates it.
export function syncTokensFromLook({ projectId, list, update, db, catalogs }) {
  const current = list(projectId, 'design_tokens')[0];
  if (!current?.fromLook) return;
  const setup = db.prepare('SELECT p.accent_color, s.feel FROM projects p JOIN project_setup s ON s.project_id = p.id WHERE p.id = ?').get(projectId);
  const feel = catalogs.feels?.[setup?.feel || 'sleek-saas'] || {};
  update(projectId, current.id, { ...defaultTokens({ accent: setup?.accent_color || feel.accent, font: feel.font, radius: feel.radius }), fromLook: true }, { rationale: 'Follows the Look & feel' });
}

// ---- Scaffold: the generated app's styles, token files and brand, all from the Design layer ----
const cssBlock = vars => Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`).join('\n');
export function tokenStyles(tokens, theme = 'system') {
  const pick = theme === 'light' ? (light) => light : theme === 'dark' ? (light, dark) => dark : (light, dark) => light === dark ? light : `light-dark(${light}, ${dark})`;
  return cssBlock(tokenVariables(tokens, theme === 'dark' ? 'dark' : 'light', pick));
}
export function brandView(design) {
  const assets = design?.brand || [];
  const byKey = key => assets.find(asset => asset.key === key);
  return { name: byKey('name')?.text || null, tagline: byKey('tagline')?.text || null, description: byKey('description')?.text || null, mark: byKey('mark') || null };
}
export function markFor(asset, tokens, size = 64) {
  const mark = asset?.mark || { text: '?', background: 'primary', foreground: 'on-primary' };
  return markSvg({ text: mark.text, background: roleColor(tokens, mark.background), foreground: roleColor(tokens, mark.foreground), size, font: tokens.faces.brand });
}
export function bannerFor(asset, tokens, markAsset) {
  const banner = asset.banner;
  const mark = markAsset?.mark || { text: '?', background: 'on-primary', foreground: 'primary' };
  const background = roleColor(tokens, banner.background);
  return bannerSvg({ width: banner.width, height: banner.height, background, accent: roleColor(tokens, banner.accent), foreground: roleColor(tokens, `on-${banner.background}`) || '#ffffff',
    markText: mark.text, markBackground: roleColor(tokens, `on-${banner.background}`), markForeground: background, headline: banner.headline, subline: banner.subline, font: tokens.faces.plain, brandFont: tokens.faces.brand });
}
const fileName = name => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'asset';
// Files the Design layer contributes to the generated repository.
export function designFiles(design, projectName) {
  const tokens = design.tokens;
  const brand = brandView(design);
  const files = {
    'design/tokens.json': `${JSON.stringify(toDtcg(tokens, projectName), null, 2)}\n`,
    'design/components.json': `${JSON.stringify({ $description: 'Component contracts from the Design layer. "binding" is how this stack builds each one.',
      components: (design.components || []).map(({ id, name, group, purpose, props, slots, anatomy, a11y, binding, parentId, status }) => ({ id, name, group, status, purpose, parent: parentId, props, slots, anatomy, a11y, binding })) }, null, 2)}\n`,
    'src/brand.ts': `// Generated by Aludel from the Design layer's brand assets. Change them there, or edit this file: the code is yours.\nexport const brand = ${JSON.stringify({
      name: brand.name || projectName, tagline: brand.tagline, description: brand.description, mark: brand.mark?.type === 'image' ? { image: '/brand/mark' } : { text: brand.mark?.mark?.text || initials(projectName) } }, null, 2)};\n`,
    'public/favicon.svg': brand.mark?.type === 'mark' || !brand.mark ? `${markFor(brand.mark, tokens, 64)}\n` : null
  };
  const markAsset = (design.brand || []).find(asset => asset.type === 'mark');
  for (const asset of (design.brand || []).filter(entry => entry.type === 'banner')) files[`public/brand/${fileName(asset.name)}.svg`] = `${bannerFor(asset, tokens, markAsset)}\n`;
  return Object.fromEntries(Object.entries(files).filter(([, value]) => value !== null));
}

// "Used in" for brand assets: where the workspace refers to them. The code is the owner's, so this is read, never declared.
export function brandUsage(workspace, assets) {
  const usage = Object.fromEntries(assets.map(asset => [asset.id, []]));
  if (!workspace || !existsSync(workspace)) return usage;
  const needles = assets.map(asset => [asset.id, [
    ...(asset.key && asset.key !== 'mark' ? [`brand.${asset.key}`] : []), ...(asset.key === 'mark' ? ['brand.mark', 'favicon.svg'] : []),
    ...(asset.type === 'banner' ? [`/brand/${fileName(asset.name)}.svg`] : [])]]);
  const walk = (directory, depth = 0) => {
    if (depth > 6) return;
    for (const name of readdirSync(directory)) {
      if (['node_modules', '.git', 'dist', 'design', 'public', 'data', 'backups'].includes(name)) continue;
      const path = join(directory, name);
      const info = statSync(path);
      if (info.isDirectory()) { walk(path, depth + 1); continue; }
      if (!/\.(ts|html|scss|css|mjs|js)$/.test(name) || info.size > 400000 || /(^|\/)src\/brand\.ts$/.test(relative(workspace, path))) continue;
      const lines = readFileSync(path, 'utf8').split('\n');
      for (const [id, words] of needles) lines.forEach((line, index) => { if (words.some(word => line.includes(word))) usage[id].push({ path: relative(workspace, path), line: index + 1 }); });
    }
  };
  walk(workspace);
  for (const id of Object.keys(usage)) usage[id] = usage[id].slice(0, 20);
  return usage;
}
export { colorRoles };
