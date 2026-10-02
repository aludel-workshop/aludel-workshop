// LAT-06 candidate inventory. These are layer-owned declarations, not grants from Work roles.
// Runtime admission remains explicitly gated until each adapter is wired to Work.
import { compileLayerActions, seedActionAssignee } from './layer-action-contract.mjs';

const seeds = (dreamer, planner, tinkerer) => ({ dreamer, planner, tinkerer });
const permissions = (reads, effect = 'submit-proposal', elevated = false, fileReads = []) =>
  ({ elevated, reads, fileReads, fileWrites: [], effects: [effect] });
const read = (layer, kind) => ({ layer, kind });
const action = (key, revision, title, purpose, result, adapter, reads, checks, initialAssignee, options = {}) =>
  ({ key, revision, title, purpose, result, adapter, permissions: permissions(reads, result.operation === 'report' ? 'submit-report' : result.operation === 'observe' ? 'record-observation' : 'submit-proposal', !!options.elevated, options.fileReads || []), checks, initialAssignee,
    requiredInputs: options.requiredInputs || [], optionalInputs: options.optionalInputs || [], reviewer: options.reviewer || 'project-owner',
    applicability: options.applicability || 'installed-layer', method: options.method || '' });

// Explicit disposition of the existing Vision/Pages actions. Unavailable means no
// new agent admission until its owning layer supplies a typed adapter; old runs keep
// their saved action IDs and revisions. Review decisions move to shared Work.
export const lat06LegacyInventory = Object.freeze({
  'product.define': { disposition: 'recreated', action: 'product.define' },
  'product.clarify': { disposition: 'recreated', action: 'product.clarify' },
  'product.brief': { disposition: 'recreated', action: 'product.brief' },
  'product.slice': { disposition: 'unavailable', reason: 'Milestone edits need a typed Vision adapter and scoped grant.' },
  'product.spec': { disposition: 'unavailable', reason: 'Spec writes need a typed Vision adapter and scoped grant.' },
  'product.research': { disposition: 'unavailable', reason: 'Library writes are cross-layer effects and need Library authority.' },
  'product.drift': { disposition: 'unavailable', reason: 'Code-to-story drift needs pinned Code evidence and a reviewed report adapter.' },
  'product.review': { disposition: 'retired', reason: 'Shared Work owns checked review and signed acceptance.' },
  'pages.design': { disposition: 'unavailable', action: 'pages.design', reason: 'Page proposal adapter and review grant are not registered.' },
  'pages.concept': { disposition: 'unavailable', reason: 'Concept selection needs a typed Pages candidate adapter and owner review.' },
  'pages.flows': { disposition: 'recreated', action: 'pages.flows' },
  'pages.a11y': { disposition: 'recreated', action: 'pages.a11y' },
  'pages.review': { disposition: 'retired', reason: 'Shared Work owns checked review and signed acceptance.' }
});

export const lat06LayerActions = [
  { key: 'product', outputs: ['brief_claim', 'story'], actions: [
    action('define', 1, 'Write story acceptance', 'Propose checkable scenarios for one Vision story.', { kind: 'story', operation: 'propose' }, 'vision_acceptance',
      [read('product', 'story')], ['Scenarios cover the story and can be checked in a preview'], seeds('agent', 'human', 'agent'), { requiredInputs: ['story'] }),
    action('clarify', 1, 'Draft decision options', 'Offer alternatives for an open Vision question without deciding it.', { owner: 'work', kind: 'report', operation: 'report' }, 'vision_clarification',
      [read('product', 'story')], ['Options differ materially and cite the open question'], seeds('agent', 'human', 'agent'), { requiredInputs: ['open-question'] }),
    action('brief', 1, 'Propose Brief claim', 'Propose a bounded Vision claim from project intent.', { kind: 'brief_claim', operation: 'propose' }, 'vision_brief',
      [read('product', 'brief_claim')], ['Claim has a stated basis and fits its Brief section'], seeds('human', 'human', 'human'), { elevated: true, optionalInputs: ['brief-claim'] })
  ] },
  { key: 'pages', outputs: ['page', 'flow'], actions: [
    action('flows', 1, 'Map a Pages flow', 'Propose a journey through existing Pages; a story is optional.', { kind: 'flow', operation: 'propose' }, 'pages_flow',
      [read('pages', 'page'), read('pages', 'flow'), read('product', 'story'), read('platform', 'code_unit')],
      ['Each step cites a current page', 'The intended journey is justified separately from any observed Code route'], seeds('agent', 'human', 'agent'),
      { optionalInputs: ['story', 'code-observation', 'page'], method: 'pages/flow-method' }),
    action('design', 1, 'Design a page', 'Draft a Pages page with its states and content.', { kind: 'page', operation: 'propose' }, 'pages_page',
      [read('pages', 'page'), read('product', 'story')], ['Purpose, states and content are reviewable'], seeds('human', 'human', 'human'), { optionalInputs: ['story', 'page'] }),
    action('a11y', 1, 'Audit Pages accessibility', 'Report observed accessibility issues without editing Pages.', { owner: 'work', kind: 'report', operation: 'report' }, 'pages_accessibility',
      [read('pages', 'page')], ['Each finding cites a page and observed evidence'], seeds('human', 'human', 'human'), { optionalInputs: ['page'] })
  ] },
  { key: 'platform', outputs: ['code_unit', 'code_route_observation'], actions: [
    action('observe_route', 1, 'Observe a Code route', 'Pin an existing route or screen slice as evidence for Pages review; observation does not assert intent.', { kind: 'code_route_observation', operation: 'observe' }, 'code_route_capture',
      [read('platform', 'code_unit')], ['Route and repository revision are exact', 'Observation and intended Pages flow remain separate'], seeds('human', 'human', 'human'),
      { requiredInputs: ['repository-commit', 'route-or-screen'], fileReads: ['src/**', 'app/**', 'apps/**'] })
  ] }
];

export const lat06Adapters = [
  { id: 'vision_acceptance', layer: 'product', owner: 'product', kind: 'story', operation: 'propose', performers: ['agent'] },
  { id: 'vision_clarification', layer: 'product', owner: 'work', kind: 'report', operation: 'report', performers: ['agent'] },
  { id: 'vision_brief', layer: 'product', owner: 'product', kind: 'brief_claim', operation: 'propose', performers: ['agent'] },
  { id: 'pages_flow', layer: 'pages', owner: 'pages', kind: 'flow', operation: 'propose', performers: ['agent'] },
  { id: 'pages_accessibility', layer: 'pages', owner: 'work', kind: 'report', operation: 'report', performers: ['agent'] },
  { id: 'code_route_capture', layer: 'platform', owner: 'platform', kind: 'code_route_observation', operation: 'observe', performers: ['human'] }
];

export const compiledLat06Actions = compileLayerActions(lat06LayerActions, { registeredAdapters: lat06Adapters });
export { seedActionAssignee };
