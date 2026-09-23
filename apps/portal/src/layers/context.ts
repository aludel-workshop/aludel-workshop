import { Injectable, computed, signal } from '@angular/core';
import { PageType, ProjectSetup, Session } from '../onboarding-model';

// Shapes returned by GET /api/projects/:id/knowledge (server/knowledge.mjs view()).
export interface Scenario { given: string; when: string; then: string; }
export interface RecordBase { id: string; kind: string; parentId: string | null; position: number; revision: number; updatedAt: string; }
export interface Revision { revision: number; author: string; rationale: string; workItemId: string | null; createdAt: string; }
export interface VisionSection extends RecordBase { key: string; title: string; body: string; items: string[]; }
export interface Persona extends RecordBase { name: string; role: string; note: string; }
export interface Phase extends RecordBase { key: string; label: string; goal: string; appetite: string; exit: string; current: boolean; }
export interface Step extends RecordBase { title: string; stories: string[]; }
export interface Activity extends RecordBase { title: string; persona: string; pack: string | null; steps: Step[]; }
export interface Story extends RecordBase { number: number; ref: string; title: string; phase: string; why: string; acceptance: Scenario[]; edges: string[]; clarifications: string[]; services: string[]; pack: string | null; template: boolean; status: string; pages: string[]; work: string[]; history: Revision[]; }
export interface Spec extends RecordBase { number: number; ref: string; title: string; phase: string; status: string; stories: string[]; problem: string; appetite: string; solution: string; rabbitHoles: string[]; noGos: string[]; requirements: string[]; entities: string[]; success: string[]; assumptions: string[]; clarifications: string[]; }
export interface Research extends RecordBase { title: string; body: string; supports: string[]; }
export interface Doc extends RecordBase { title: string; template: string; body: string; }
export interface Page extends RecordBase { label: string; icon: string; pageType: string; description: string; inNav: boolean; origin: string; stories: string[]; status: string; notes: string; history: Revision[]; }
// Data layer (LAY-07A): JSON Schema objects and OpenAPI-shaped operations; status is derived on the server.
export interface JsonSchema { type?: string | string[]; format?: string; description?: string; enum?: string[]; properties?: Record<string, JsonSchema>; required?: string[]; items?: JsonSchema; $ref?: string;
  maxLength?: number; minLength?: number; minimum?: number; maximum?: number; readOnly?: boolean; writeOnly?: boolean; }
export interface Relation { name: string; target: string; cardinality: 'one' | 'many'; owner: boolean; }
export interface DataObject extends RecordBase { name: string; description: string; schema: JsonSchema; relations: Relation[]; states: string[]; stories: string[]; specs: string[]; contract: string; origin: string; pack: string | null; template: boolean; status: string; history: Revision[]; }
export interface Parameter { name: string; in: string; required: boolean; schema: JsonSchema; description: string; }
export interface DataOperation extends RecordBase { operationId: string; summary: string; method: string; path: string; objectId: string | null; parameters: Parameter[]; request: JsonSchema | null;
  response: { status: string; description: string; schema: JsonSchema | null }; errors: { status: string; description: string }[]; roles: string[]; stories: string[]; contract: string; pack: string | null; template: boolean; status: string; history: Revision[]; }
export interface AccessRule extends RecordBase { role: string; objectId: string; action: string; effect: string; sentence: string; pack: string | null; }
// Work › Agents (LAY-07C)
export interface AgentProfile extends RecordBase { key: string | null; name: string; icon: string; role: string; workTypes: string[]; accountId: string | null; model: string; instructions: string; writes: string[]; approvalRequired: string[]; budget: number; history: Revision[]; }
export interface InstructionPins { principles: { id: string; revision: number } | null; project: { id: string; revision: number } | null; role: { id: string; revision: number }; guidance: string; }
// Code links (LAY-07D)
export interface TraceLink { recordId: string; revision: number; currentRevision: number | null; kind: string; source: string; state: string; workRef: string | null; }
export interface CodeUnit { id: string; path: string; symbol: string; kind: string; line: number; reachable: boolean; lastCommit: string | null; calls: string[]; calledBy: string[]; state: string; links: TraceLink[]; }
export interface Service { key: string; label: string; icon: string; stories: string[]; }
export interface WorkTarget { id: string; kind: string; label: string; }
export interface WorkItem { id: string; number: number; ref: string; layer: string; type: string; title: string; state: string; assignee: { kind: string; label: string } | null; targets: WorkTarget[];
  question: { text: string; options: string[]; answer?: string; rationale?: string; answeredBy?: string } | null; documents: string[]; log: { at: string; text: string }[]; createdAt: string; updatedAt: string;
  profileId: string | null; instructions: InstructionPins | null; context: { reconcile?: { recordId: string; fromRevision: number; toRevision: number } } | null; }
export interface Knowledge {
  vision: Record<string, VisionSection>; personas: Persona[]; phases: Phase[]; activities: Activity[]; stories: Story[]; specs: Spec[];
  research: Research[]; docs: Doc[]; pages: Page[]; work: WorkItem[]; selectedPacks: string[];
  packs: Record<string, { label: string; summary: string; icon: string; stories: number; template: number }>;
  objects: DataObject[]; operations: DataOperation[]; access: AccessRule[]; services: Service[];
  profiles: AgentProfile[]; projectInstructions: (RecordBase & { body: string }) | null; guidance: Record<string, string>; workTypes: string[];
  code: { indexedAt: string | null; units: CodeUnit[] };
}
export interface Catalog { pageTypes: Record<string, PageType>; routeIcons: string[]; feels: Record<string, { label: string; summary: string; navigation: string; font: string; radius: number; surface: string; surfaceDark: string }>;
  preferences: Record<string, { label: string; values: Record<string, string> }>; profiles: Record<string, { label: string; summary: string }>;
  stacks: { presets: Record<string, { label: string; layers?: Record<string, string> }> }; }
export interface Suggestion { key: string; layer: string; type: string; title: string; targets: WorkTarget[]; question?: { text: string; options: string[] }; documents: string[]; }

export const statusOrder = ['proposed', 'defined', 'designed', 'built', 'shipped'];
export const statusLabel: Record<string, string> = { proposed: 'Proposed', defined: 'Defined', designed: 'Designed', built: 'Built', shipped: 'Shipped' };
export const stateLabel: Record<string, string> = { suggested: 'Suggested', ready: 'Ready', claimed: 'In progress', 'needs-input': 'Needs you', review: 'In review', done: 'Done' };
export const layerLabel: Record<string, string> = { product: 'Product', design: 'Design', pages: 'Pages', data: 'Data', platform: 'Platform', work: 'Work' };
export const dataStatusLabel: Record<string, string> = { proposed: 'Proposed', contracted: 'Contracted', built: 'Built', shipped: 'Shipped' };
export const unitStateLabel: Record<string, string> = { healthy: 'Healthy', suspect: 'Suspect', untraced: 'Untraced', dead: 'Unused' };

// One project's state for every layer component. Layers never fetch on their own; they call api() then reload().
@Injectable()
export class ProjectContext {
  readonly session = signal<Session | null>(null);
  readonly setup = signal<ProjectSetup | null>(null);
  readonly data = signal<Knowledge | null>(null);
  readonly catalog = signal<Catalog | null>(null);
  readonly error = signal('');
  readonly notice = signal('');
  readonly path = signal(location.pathname);
  readonly segments = computed(() => this.path().split('/').filter(Boolean).slice(2).map(decodeURIComponent));
  readonly slug = computed(() => decodeURIComponent(this.path().split('/')[2] || ''));
  readonly projectId = computed(() => this.session()?.projects.find(project => project.slug === this.slug())?.id || '');
  readonly storyById = computed(() => new Map((this.data()?.stories || []).map(story => [story.id, story])));
  readonly pageById = computed(() => new Map((this.data()?.pages || []).map(page => [page.id, page])));
  readonly objectById = computed(() => new Map((this.data()?.objects || []).map(object => [object.id, object])));
  readonly operationById = computed(() => new Map((this.data()?.operations || []).map(operation => [operation.id, operation])));
  readonly profileById = computed(() => new Map((this.data()?.profiles || []).map(profile => [profile.id, profile])));
  readonly unitById = computed(() => new Map((this.data()?.code.units || []).map(unit => [unit.id, unit])));
  // "Built by" for any record: code units and tests linked to it, and whether any link is suspect (LAY-07D).
  readonly builtBy = computed(() => {
    const summary = new Map<string, { units: number; tests: number; suspect: boolean }>();
    for (const unit of this.data()?.code.units || []) for (const link of unit.links) {
      const entry = summary.get(link.recordId) || { units: 0, tests: 0, suspect: false };
      if (unit.kind === 'test') entry.tests++; else entry.units++;
      if (link.state === 'suspect') entry.suspect = true;
      summary.set(link.recordId, entry);
    }
    return summary;
  });
  readonly suspectUnits = computed(() => (this.data()?.code.units || []).filter(unit => unit.state === 'suspect'));

  // Where a record lives, for links from Work and Platform › Code.
  recordHref(kind: string, id: string) {
    if (kind === 'page') return this.link('pages', 'tree', id);
    if (kind === 'spec') return this.link('product', 'specs', id);
    if (kind === 'data_object') return this.link('data', 'objects', id);
    if (kind === 'data_operation') return this.link('data', 'api', id);
    if (kind === 'agent_profile') return this.link('work', 'agents', id);
    return this.link('product', 'map', id);
  }
  recordLabel(id: string): [string, string, string] {
    const story = this.storyById().get(id); if (story) return [`${story.ref} ${story.title}`, this.recordHref('story', id), 'product'];
    const page = this.pageById().get(id); if (page) return [`${page.label} page`, this.recordHref('page', id), 'pages'];
    const object = this.objectById().get(id); if (object) return [`${object.name} object`, this.recordHref('data_object', id), 'data'];
    const operation = this.operationById().get(id); if (operation) return [`${operation.operationId} operation`, this.recordHref('data_operation', id), 'data'];
    const spec = this.data()?.specs.find(entry => entry.id === id); if (spec) return [`${spec.ref} ${spec.title}`, this.recordHref('spec', id), 'product'];
    return [id, this.link(), 'work'];
  }

  // Gaps each layer knows about, shown as quiet suggestions until someone stages them (DEC-036).
  readonly suggestions = computed<Suggestion[]>(() => {
    const data = this.data(); if (!data) return [];
    const open = new Set(data.work.filter(item => item.state !== 'done').flatMap(item => item.targets.map(target => `${item.type}:${target.id}`)));
    const list: Suggestion[] = [];
    for (const story of data.stories) {
      if (!story.acceptance.length && !open.has(`define:${story.id}`)) list.push({ key: `define:${story.id}`, layer: 'product', type: 'define', title: `Write acceptance for “${story.title}”`, targets: [{ id: story.id, kind: 'story', label: story.title }], documents: [`Product › ${story.ref} acceptance`] });
      for (const text of story.clarifications) if (!open.has(`define:${story.id}`)) list.push({ key: `clarify:${story.id}:${text}`, layer: 'product', type: 'define', title: `Clarify: ${text}`, targets: [{ id: story.id, kind: 'story', label: story.title }], question: { text, options: [] }, documents: [`Product › ${story.ref} (clarified)`] });
    }
    for (const page of data.pages) {
      if (page.status !== 'designed' && page.stories.length && !open.has(`design:${page.id}`)) list.push({ key: `design:${page.id}`, layer: 'pages', type: 'design', title: `Design the ${page.label} page`, targets: [{ id: page.id, kind: 'page', label: `${page.label} page` }], documents: [`Pages › ${page.label} (designed revision)`] });
    }
    return list;
  });

  go(path: string, event?: Event) {
    event?.preventDefault();
    if (!path.startsWith('/p/')) { location.assign(path); return; }
    history.pushState({}, '', path);
    this.path.set(path);
    this.error.set(''); this.notice.set('');
    window.scrollTo(0, 0);
    setTimeout(() => document.querySelector<HTMLElement>('.lay-main h1')?.focus({ preventScroll: true }), 30);
  }

  link(...parts: string[]) { return `/p/${encodeURIComponent(this.slug())}${parts.length ? '/' + parts.map(encodeURIComponent).join('/') : ''}`; }

  async api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(value.error || 'Something went wrong. Please try again.'), { status: response.status });
    return value as T;
  }

  async reload() {
    const value = await this.api<{ setup: ProjectSetup; knowledge: Knowledge; catalog: Catalog }>(`/api/projects/${encodeURIComponent(this.projectId())}/knowledge`);
    this.setup.set(value.setup); this.data.set(value.knowledge); this.catalog.set(value.catalog);
  }

  // Every write goes through here: errors surface in the shell, success reloads the whole snapshot.
  async write(action: () => Promise<unknown>, success = '') {
    this.error.set(''); this.notice.set('');
    try { await action(); await this.reload(); if (success) this.notice.set(success); return true; }
    catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); return false; }
  }

  record(kind: string, data: unknown, parentId: string | null = null, rationale = '') {
    return this.api(`/api/projects/${encodeURIComponent(this.projectId())}/records`, 'POST', { kind, data, parentId, rationale: rationale || null });
  }
  change(id: string, data: unknown, expectedRevision?: number, rationale = '') {
    return this.api(`/api/projects/${encodeURIComponent(this.projectId())}/records/${encodeURIComponent(id)}`, 'PUT', { data, expectedRevision, rationale: rationale || null });
  }
  delete(id: string) { return this.api(`/api/projects/${encodeURIComponent(this.projectId())}/records/${encodeURIComponent(id)}`, 'DELETE'); }
  stage(suggestion: Suggestion, state: 'ready' | 'suggested' = 'ready') {
    return this.api<WorkItem>(`/api/projects/${encodeURIComponent(this.projectId())}/work`, 'POST', { layer: suggestion.layer, type: suggestion.type, title: suggestion.title, targets: suggestion.targets, documents: suggestion.documents, question: suggestion.question?.options.length ? suggestion.question : undefined, state });
  }
  updateWork(id: string, body: unknown) { return this.api<WorkItem>(`/api/projects/${encodeURIComponent(this.projectId())}/work/${encodeURIComponent(id)}`, 'PUT', body); }
}

export const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
export const phaseName = (key: string) => ({ demo: 'Demo', mvp: 'MVP', later: 'Later' } as Record<string, string>)[key] || key;
