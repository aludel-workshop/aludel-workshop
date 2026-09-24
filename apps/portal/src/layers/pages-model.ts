import { Injectable, computed, inject, signal } from '@angular/core';
import { Tokens, tokenVariables } from '../design-tokens';
import { DesignComponent, Flow, Page, PageSection, ProjectContext } from './context';

// PAGES-UX-01 (docs/design/pages-layer/work-record.md): what the Map, Pages and Flows tabs share.
export const pageStates = ['ready', 'empty', 'loading', 'error'];
export const stateName: Record<string, string> = { ready: 'Ready', empty: 'Empty', loading: 'Loading', error: 'Error' };
export type Build = 'planned' | 'specified' | 'built';
export const buildLabel: Record<Build, string> = { planned: 'Planned', specified: 'Specified', built: 'Built' };
export type Props = Record<string, string | boolean>;
export interface Place { col: number; row: number; }
export const newSectionId = () => `sec-${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
// A page blank added on the Map. Icon and page type are only defaults until someone specs it.
export const blankPage = { icon: 'article', pageType: 'detail', inNav: false, origin: 'You', status: 'planned', description: '', notes: '' };

// Cells on the Map grid are sized to what they show, so spacing stays even and nothing overlaps.
export type MapView = 'desktop' | 'phone' | 'both';
export const mapCell: Record<MapView, { w: number; h: number }> = { both: { w: 500, h: 318 }, desktop: { w: 420, h: 338 }, phone: { w: 200, h: 410 } };
export const mapGap = { x: 120, y: 90 };

// Pages without a saved place go in order: navigation pages along the top, sub-pages under their parent, the rest after.
export function autoPlaces(pages: Page[], saved: Record<string, Place>): Map<string, Place> {
  const places = new Map<string, Place>(), taken = new Set<string>();
  const take = (id: string, place: Place) => { places.set(id, place); taken.add(`${place.col},${place.row}`); };
  const free = (col: number, row: number): Place => { for (;;) { for (let r = row; r < row + 12; r++) if (!taken.has(`${col},${r}`)) return { col, row: r }; col++; } };
  for (const page of pages) { const place = saved[page.id]; if (place && !taken.has(`${place.col},${place.row}`)) take(page.id, place); }
  const nav = pages.filter(page => !page.parentId && page.inNav);
  nav.forEach((page, index) => { if (!places.has(page.id)) take(page.id, free(index, 0)); });
  let changed = true;
  while (changed) {
    changed = false;
    for (const page of pages.filter(entry => entry.parentId && !places.has(entry.id))) {
      const parent = places.get(page.parentId || '');
      if (parent) { take(page.id, free(parent.col, parent.row + 1)); changed = true; }
    }
  }
  const right = Math.max(-1, ...[...places.values()].map(place => place.col)) + 1;
  for (const page of pages) if (!places.has(page.id)) take(page.id, free(right, 0));
  return places;
}

export function isBuilt(ctx: ProjectContext, page: Page) { return Boolean(ctx.builtBy().get(page.id)?.units); }
export function buildOf(ctx: ProjectContext, page: Page): Build { return isBuilt(ctx, page) ? 'built' : page.status === 'designed' ? 'specified' : 'planned'; }
export function stepBuild(ctx: ProjectContext, step: { page: string | null }): Build | 'gap' { const page = step.page ? ctx.pageById().get(step.page) : null; return page ? buildOf(ctx, page) : 'gap'; }
// Stories in a flow's activity that no page realises yet.
export function missingStories(ctx: ProjectContext, flow: Flow) {
  const activity = ctx.data()?.activities.find(entry => entry.id === flow.activity);
  const placed = new Set((ctx.data()?.pages || []).flatMap(page => [...page.stories, ...page.sections.flatMap(section => section.stories)]));
  return (activity?.steps || []).flatMap(step => step.stories).filter(id => !placed.has(id));
}
// A preview instance of a component: the contract's defaults, with children where it has a slot.
export function sampleInstance(component: DesignComponent, all: DesignComponent[]): { props: Props; children: Props[] } {
  const defaults = (c: DesignComponent | undefined): Props => Object.fromEntries((c?.props || []).map(prop => [prop.key, prop.default]));
  const kid = all.find(entry => entry.id === component.slots[0]?.accepts[0]);
  const count = Math.min(Math.max(component.slots[0]?.min || 0, ({ card: 2, dialog: 2, 'nav-list': 3, 'nav-bar': 3, list: 3, toolbar: 1 } as Record<string, number>)[component.preview || ''] ?? 0), component.slots[0]?.max ?? 10);
  const names = ['Priya Raman', 'Marco Bianchi', 'Aiyana Ross'];
  const children = kid ? Array.from({ length: count }, (_, i) => {
    const base = defaults(kid);
    if (component.preview === 'list') return { ...base, headline: names[i % names.length] };
    if (component.preview === 'card' || component.preview === 'dialog') return { ...base, variant: i === count - 1 ? 'Filled' : 'Text', label: ['Details', 'Open'][i] || 'More' };
    return base;
  }) : [];
  return { props: defaults(component), children };
}
// What changed between two versions of a page's spec, as lines for a revision's rationale and a change request.
export function specDiff(before: SpecDraft, after: SpecDraft, name: (id: string | null) => string): string[] {
  const out: string[] = [];
  const old = new Map(before.sections.map(section => [section.id, section]));
  after.sections.forEach((section, index) => {
    const was = old.get(section.id);
    if (!was) { out.push(`Add section “${section.name}” (${name(section.component)})`); return; }
    const fields: string[] = [];
    if (was.name !== section.name) fields.push(`renamed from “${was.name}”`);
    if (was.component !== section.component) fields.push(`component ${name(was.component)} → ${name(section.component)}`);
    if (was.leadsTo !== section.leadsTo) fields.push(`leads to ${name(section.leadsTo)}`);
    if (was.audience !== section.audience) fields.push(`shown to ${name(section.audience)}`);
    if (was.state !== section.state) fields.push(`shown when ${stateName[section.state].toLowerCase()}`);
    if (was.region !== section.region) fields.push(section.region === 'side' ? 'moves to the side' : 'moves to the main column');
    if (was.phase !== section.phase) fields.push(section.phase ? `planned for ${section.phase.toUpperCase()}` : 'no longer deferred');
    if (was.stories.join() !== section.stories.join()) fields.push('stories changed');
    if (was.data.join() !== section.data.join()) fields.push('data changed');
    if (was.note !== section.note) fields.push('note changed');
    if (before.sections.findIndex(entry => entry.id === section.id) !== index && !fields.length) fields.push('moved');
    if (fields.length) out.push(`Change “${section.name}”: ${fields.join(', ')}`);
  });
  for (const section of before.sections) if (!after.sections.some(entry => entry.id === section.id)) out.push(`Remove section “${section.name}”`);
  if (before.pageType !== after.pageType) out.push(`Layout ${before.pageType} → ${after.pageType}`);
  for (const state of pageStates) if ((before.states[state] ?? null) !== (after.states[state] ?? null)) out.push(after.states[state] === undefined ? `${stateName[state]} state no longer specified` : `${stateName[state]} state: ${after.states[state] || 'specified'}`);
  return out;
}
export interface SpecDraft { sections: PageSection[]; states: Record<string, string>; pageType: string; }
export const specOf = (page: Page): SpecDraft => ({ sections: structuredClone(page.sections), states: { ...page.states }, pageType: page.pageType });

// State the Pages tabs share: who the pages are seen as, and the design tokens that theme the preview.
@Injectable()
export class PagesState {
  private readonly ctx = inject(ProjectContext);
  // A persona id from Vision, or 'visitor' for someone not signed in.
  readonly chosenAs = signal<string>('');
  // Handed between tabs: open a flow for editing on the Map, or a page with Edit content on or a change request ready.
  readonly mapFlow = signal<string | null>(null);
  readonly intent = signal<{ page: string; edit?: boolean; change?: { title: string; why: string } } | null>(null);
  readonly personas = computed(() => this.ctx.data()?.personas || []);
  readonly as = computed(() => this.chosenAs() || this.personas()[0]?.id || 'visitor');
  readonly vars = computed(() => { const tokens = this.ctx.data()?.tokens; return tokens ? tokenVariables(tokens as unknown as Tokens, 'light') : {}; });
  readonly appOrigin = computed(() => { try { return new URL(this.ctx.setup()?.urls?.app || '').origin; } catch { return ''; } });
  asName(id: string | null | undefined) { return !id || id === 'visitor' ? 'Not signed in' : this.personas().find(persona => persona.id === id)?.name || 'Someone'; }
  // The name of any record a spec points at, for labels and diffs.
  name(id: string | null) {
    if (!id) return 'none';
    return this.ctx.componentById().get(id)?.name || this.ctx.pageById().get(id)?.label || this.personas().find(persona => persona.id === id)?.name
      || this.ctx.objectById().get(id)?.name || this.ctx.operationById().get(id)?.operationId || this.ctx.storyById().get(id)?.ref || 'unknown';
  }
}
