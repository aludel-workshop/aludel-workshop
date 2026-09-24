import { Injectable, computed, signal } from '@angular/core';
import { PageType, ProjectSetup, Session } from '../onboarding-model';

// Shapes returned by GET /api/projects/:id/knowledge (server/knowledge.mjs view()).
export interface Scenario { given: string; when: string; then: string; }
export interface Resolved { question: string; answer: string; work: string; }
export interface RecordBase { id: string; kind: string; parentId: string | null; position: number; revision: number; updatedAt: string; }
export interface Revision { revision: number; author: string; rationale: string; workItemId: string | null; createdAt: string; }
export interface VisionSection extends RecordBase { key: string; title: string; body: string; items: string[]; }
export interface Persona extends RecordBase { name: string; role: string; note: string; }
export interface Phase extends RecordBase { key: string; label: string; goal: string; appetite: string; exit: string; current: boolean; target?: string | null; }
export interface Step extends RecordBase { title: string; stories: string[]; }
export interface Activity extends RecordBase { title: string; persona: string; pack: string | null; steps: Step[]; }
export interface Story extends RecordBase { number: number; ref: string; title: string; phase: string; why: string; acceptance: Scenario[]; edges: string[]; clarifications: string[]; services: string[]; resolved: Resolved[]; pack: string | null; template: boolean; status: string; pages: string[]; work: string[]; history: Revision[]; claim?: string | null; }
export interface Spec extends RecordBase { number: number; ref: string; title: string; phase: string; status: string; stories: string[]; problem: string; appetite: string; solution: string; rabbitHoles: string[]; noGos: string[]; requirements: string[]; entities: string[]; success: string[]; assumptions: string[]; clarifications: string[]; resolved: Resolved[]; }
export interface Research extends RecordBase { title: string; body: string; supports: string[]; }
export interface Doc extends RecordBase { title: string; template: string; body: string; form?: 'written' | 'generated'; generator?: string | null; briefRevision?: number | null; agents?: boolean; }
// ROADMAP-01 (DEC-042/043): the Brief, the Library's evidence records and the plan's projects.
export interface Claim extends RecordBase { section: string; text: string; note: string; history: Revision[]; }
export interface Source extends RecordBase { type: string; title: string; url: string; date: string | null; by: string; body: string; }
export interface Finding extends RecordBase { sourceId: string; type: string; text: string; data: [string, number][]; }
export interface Comment { by: string; text: string; at: string; }
export interface Insight extends RecordBase { text: string; strength: string; tags: string[]; findings: string[]; comments: Comment[]; }
export interface EvidenceLink extends RecordBase { insightId: string; recordId: string; direction: 'supports' | 'contradicts'; }
export interface Checkpoint { id: string; title: string; date: string | null; }
export interface PlanProject extends RecordBase { number: number; ref: string; title: string; summary: string; milestone: string; status: string; health: string | null; lead: string | null;
  start: string | null; target: string | null; deps: string[]; budget: number | null; stories: string[]; problem: string; solution: string; rabbitHoles: string[]; noGos: string[];
  requirements: string[]; clarifications: string[]; resolved: Resolved[]; checkpoints: Checkpoint[]; origin: string; spent: number; history: Revision[]; }
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
// Work › Agents (WORK-UX-01): a profile is who does the work; what an action allows lives on the action.
export interface ProfileLimits { itemOutput: number; batchTokens: number | null; monthlyTokens: number | null; }
export interface AgentProfile extends RecordBase { key: string | null; name: string; description: string; avatar: { seed: string; color: string }; model: string; effort: string; instructions: string;
  context: string[]; limits: ProfileLimits; active: boolean; history: Revision[]; }
export interface Pin { id: string; revision: number; key?: string; }
export interface InstructionPins { principles: Pin | null; project: Pin | null; role: Pin | null; action: Pin | null; profile: Pin | null; }
// Work › Roles: one role per layer, and the actions it performs, each with its own setup.
export interface Assignee { kind: 'person' | 'agent' | 'template'; id: string | null; label?: string; }
export interface WorkAction { id: string; recordId: string | null; revision: number; name: string; description: string; type: string; routine: string | null; assignee: Assignee | null;
  instructions: string; reads: string[]; changes: string[]; tools: string[]; asks: string; phases: string[]; checks: string[]; elevated: boolean; }
export interface Role { id: string | null; layer: string; name: string; blurb: string; instructions: string; revision: number; members: { id: string; lead: boolean }[]; actions: WorkAction[]; }
export interface PersonAvatar { seed?: string; backgroundColor?: string; skinColor?: string; hair?: string; hairColor?: string; eyes?: string; mouth?: string; accessories?: string; accessoriesProbability?: number; }
export interface Member { id: string; name: string; role: string; avatar: PersonAvatar | null; }
// Code links (LAY-07D)
export interface TraceLink { recordId: string; revision: number; currentRevision: number | null; kind: string; source: string; state: string; workRef: string | null; }
export interface CodeUnit { id: string; path: string; symbol: string; kind: string; line: number; reachable: boolean; lastCommit: string | null; calls: string[]; calledBy: string[]; state: string; links: TraceLink[]; }
export interface Service { key: string; label: string; icon: string; stories: string[]; }
export interface WorkTarget { id: string; kind: string; label: string; }
export type WorkStatus = 'backlog' | 'queued' | 'staged' | 'working' | 'needs' | 'review' | 'done';
export interface WorkCheck { text: string; source: { id: string; revision?: number | null } | null; verdict: 'accept' | 'reject' | null; note: string; by?: string | null; at?: string | null; }
export interface LogEntry { at: string; text: string; refs?: string[]; by?: { kind: string; id: string } | null; }
export interface RunState { phases?: string[]; phase?: number; activity?: string; startedAt?: string; finishedAt?: string; model?: string; provider?: string; batch?: string; profileId?: string;
  usage?: { input: number; output: number }; at?: string; done?: boolean; }
export interface WorkItem { id: string; number: number; ref: string; layer: string; type: string; action: string | null; title: string; state: string; status: WorkStatus; priority: string;
  assignee: Assignee | null; targets: WorkTarget[]; blocks: string[]; blockedBy: string[]; checks: WorkCheck[];
  question: { text: string; options: string[]; answer?: string; rationale?: string; answeredBy?: string; applied?: string[]; recommendation?: string; reasoning?: string } | null; documents: string[]; log: LogEntry[]; createdAt: string; updatedAt: string;
  profileId: string | null; instructions: InstructionPins | null; project: string | null; checkpoint: string | null;
  context: { reconcile?: { recordId: string; fromRevision: number; toRevision: number }; routine?: string; suggestion?: string; batch?: string; staged?: boolean; skip?: boolean;
    feedback?: { check: string; note: string; by: string; at: string }[]; run?: RunState } | null; }
export interface FieldChange { field: string; before: unknown; after: unknown; }
export interface WorkChange { recordId: string; revision: number; author: string; rationale: string | null; createdAt: string; kind: string | null; exists: boolean; fields: FieldChange[]; }
export interface Routine extends RecordBase { key: string | null; title: string; layer: string; type: string; cadence: string; documents: string[]; enabled: boolean; nextRunAt: string | null; lastRunAt: string | null; lastWorkId: string | null; history: Revision[]; }
export interface Knowledge {
  vision: Record<string, VisionSection>; personas: Persona[]; phases: Phase[]; activities: Activity[]; stories: Story[]; specs: Spec[];
  research: Research[]; docs: Doc[]; pages: Page[]; work: WorkItem[]; selectedPacks: string[];
  packs: Record<string, { label: string; summary: string; icon: string; stories: number; template: number }>;
  objects: DataObject[]; operations: DataOperation[]; access: AccessRule[]; services: Service[];
  profiles: AgentProfile[]; projectInstructions: (RecordBase & { body: string }) | null; workTypes: string[];
  roles: Role[]; members: Member[];
  code: { indexedAt: string | null; units: CodeUnit[] };
  routines: Routine[]; batches: Batch[];
  claims: Claim[]; briefRevision: number; sources: Source[]; findings: Finding[]; insights: Insight[]; evidence: EvidenceLink[]; projects: PlanProject[];
}
// Batches belong to one agent profile (WORK-UX-01); Go runs them.
export interface Batch { id: string; number: number; ref: string; state: string; limit: number; profileId: string | null; createdAt: string; startedAt: string | null; finishedAt: string | null;
  startedBy: string | null; note: string | null; items: string[]; usage: { input: number; output: number }; working: string | null; }
export interface Catalog { pageTypes: Record<string, PageType>; routeIcons: string[]; feels: Record<string, { label: string; summary: string; navigation: string; font: string; radius: number; surface: string; surfaceDark: string }>;
  stacks: { presets: Record<string, { label: string; layers?: Record<string, string> }> }; tools: Record<string, string>; botColors: string[]; efforts: string[]; }
// What a hover card shows for any referenced record (A3).
export interface RefInfo { id: string; kind: string; kindLabel: string; icon: string; layer: string; label: string; title: string; status: string | null; note: string; facts: [string, string][]; where: string; href: string; }

export const statusOrder = ['proposed', 'defined', 'designed', 'built', 'shipped'];
export const statusLabel: Record<string, string> = { proposed: 'Proposed', defined: 'Defined', designed: 'Designed', built: 'Built', shipped: 'Shipped' };
export const stateLabel: Record<string, string> = { suggested: 'Backlog', ready: 'Queued', claimed: 'Working', 'needs-input': 'Needs you', review: 'Ready for review', done: 'Done' };
export const workStatusLabel: Record<string, string> = { backlog: 'Backlog', queued: 'Queued', staged: 'Staged', working: 'Working', needs: 'Needs you', review: 'Ready for review', done: 'Done' };
// Jira's five priorities, highest first.
export const priorityOrder = ['highest', 'high', 'medium', 'low', 'lowest'];
export const priorityLabel: Record<string, string> = { highest: 'Highest', high: 'High', medium: 'Medium', low: 'Low', lowest: 'Lowest' };
// Icons chosen at runtime (record kinds, priorities), listed so tools/subset-icons.py keeps them in the font subset.
export const runtimeIcons = [{ icon: 'view_kanban' }, { icon: 'badge' }, { icon: 'group' }, { icon: 'event_repeat' }, { icon: 'shield' }, { icon: 'view_timeline' }, { icon: 'person' }, { icon: 'cancel' }, { icon: 'fact_check' }, { icon: 'insights' }, { icon: 'format_quote' }, { icon: 'deployed_code_history' }, { icon: 'local_library' }, { icon: 'help' }, { icon: 'report' }, { icon: 'check_circle' }, { icon: 'record_voice_over' }, { icon: 'ballot' }, { icon: 'image' }, { icon: 'link' }, { icon: 'storefront' }, { icon: 'visibility' }, { icon: 'query_stats' }, { icon: 'edit_note' }, { icon: 'bookmark' }, { icon: 'web' }, { icon: 'data_object' }, { icon: 'api' }, { icon: 'description' }, { icon: 'article' }, { icon: 'science' }, { icon: 'flag' }, { icon: 'shield_person' }, { icon: 'smart_toy' }, { icon: 'task_alt' }, { icon: 'menu_book' }, { icon: 'tune' }, { icon: 'code' }, { icon: 'keyboard_double_arrow_up' }, { icon: 'keyboard_arrow_up' }, { icon: 'drag_handle' }, { icon: 'keyboard_arrow_down' }, { icon: 'keyboard_double_arrow_down' }, { icon: 'lightbulb' }, { icon: 'palette' }, { icon: 'schema' }, { icon: 'dns' }, { icon: 'checklist' }];
export const priorityIcon: Record<string, string> = { highest: 'keyboard_double_arrow_up', high: 'keyboard_arrow_up', medium: 'drag_handle', low: 'keyboard_arrow_down', lowest: 'keyboard_double_arrow_down' };
// The Brief's sections, in Lean Canvas order (ROADMAP-01).
export const briefSections: { key: string; title: string; hint: string }[] = [
  { key: 'problem', title: 'Problem', hint: 'The top one to three problems, and what people do about them today.' },
  { key: 'customers', title: 'Customers', hint: 'Who has the problem. Mark the early adopters.' },
  { key: 'diagnosis', title: 'Diagnosis', hint: 'Why now, and the crux: what currently stops people.' },
  { key: 'value', title: 'Value proposition', hint: 'One sentence a customer would repeat, plus an “X for Y” concept.' },
  { key: 'approach', title: 'Approach', hint: 'What we will do, and what that rules out.' },
  { key: 'capabilities', title: 'Standout capabilities', hint: 'Three to five things that make it worth using.' },
  { key: 'outcomes', title: 'Outcomes and measures', hint: 'One product outcome (a customer behaviour) and how it is measured.' },
  { key: 'principles', title: 'Principles', hint: 'Non-negotiables. Every work item reads them.' },
  { key: 'business', title: 'Business model', hint: 'Channels, revenue, costs and unfair advantage. Optional; business will likely become its own layer.' }];
export const sectionTitle = (key: string) => briefSections.find(section => section.key === key)?.title || key;
export const projectStatusLabel: Record<string, string> = { backlog: 'Backlog', planned: 'Planned', progress: 'In progress', completed: 'Completed', canceled: 'Canceled' };
export const projectStatusIcon: Record<string, string> = { backlog: 'radio_button_unchecked', planned: 'circle', progress: 'clock_loader_40', completed: 'check_circle', canceled: 'cancel' };
export const healthLabel: Record<string, string> = { on: 'On track', risk: 'At risk', off: 'Off track' };
export const sourceTypeIcon: Record<string, string> = { interview: 'record_voice_over', observation: 'visibility', survey: 'ballot', link: 'link', article: 'article', competitor: 'storefront', screenshot: 'image', analytics: 'query_stats', note: 'edit_note' };
export const layerLabel: Record<string, string> = { product: 'Vision', library: 'Library', design: 'Design', pages: 'Pages', data: 'Data', platform: 'Platform', work: 'Work' };
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
  readonly workById = computed(() => new Map((this.data()?.work || []).map(item => [item.id, item])));
  readonly memberById = computed(() => new Map((this.data()?.members || []).map(member => [member.id, member])));
  readonly actionById = computed(() => new Map((this.data()?.roles || []).flatMap(role => role.actions.map(action => [action.id, action] as [string, WorkAction]))));
  readonly roleByLayer = computed(() => new Map((this.data()?.roles || []).map(role => [role.layer, role])));
  readonly claimById = computed(() => new Map((this.data()?.claims || []).map(claim => [claim.id, claim])));
  readonly insightById = computed(() => new Map((this.data()?.insights || []).map(insight => [insight.id, insight])));
  readonly findingById = computed(() => new Map((this.data()?.findings || []).map(finding => [finding.id, finding])));
  readonly sourceById = computed(() => new Map((this.data()?.sources || []).map(source => [source.id, source])));
  readonly projectById = computed(() => new Map((this.data()?.projects || []).map(project => [project.id, project])));
  readonly currentMilestone = computed(() => this.data()?.phases.find(phase => phase.current) || null);
  // Evidence (ROADMAP-01): what is attached to a record. A story also carries its problem's evidence ("via"), once.
  evidenceFor(id: string): (EvidenceLink & { via?: string })[] {
    const all = this.data()?.evidence || [];
    const own = all.filter(link => link.recordId === id);
    const claim = this.storyById().get(id)?.claim;
    if (!claim) return own;
    return [...own, ...all.filter(link => link.recordId === claim && !own.some(mine => mine.insightId === link.insightId)).map(link => ({ ...link, via: claim }))];
  }
  confidence(id: string) { const links = this.evidenceFor(id); return links.some(link => link.direction === 'contradicts') ? 'contradicted' : links.length ? 'supported' : 'assumed'; }
  usedIn(insightId: string) { return (this.data()?.evidence || []).filter(link => link.insightId === insightId); }
  // The evidence panel is one drawer for the whole project; any chip opens it on its record.
  readonly evidenceOpen = signal<string | null>(null);
  readonly me = computed(() => this.session()?.user?.id || '');
  readonly agentReady = computed(() => { const connection = this.setup()?.agentConnection; return Boolean(connection && connection.status !== 'rejected' && !connection.retired); });
  // A clock the Work pages read for live elapsed times; ticks only while something is running.
  readonly now = signal(Date.now());
  // The board's assignee filter: set from an assignee chip or a profile's "its work" link, kept while moving around Work.
  readonly boardFilter = signal<string | null>(null);
  whoName(assignee: Assignee | null | undefined) {
    if (!assignee) return 'Nobody';
    if (assignee.kind === 'person') return assignee.id === this.me() ? 'You' : this.memberById().get(assignee.id || '')?.name || assignee.label || 'Someone';
    if (assignee.kind === 'agent') return this.profileById().get(assignee.id || '')?.name || assignee.label || 'Agent';
    return assignee.label || 'Aludel template';
  }
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
    if (kind === 'brief_claim') return this.link('product', 'brief', id);
    if (kind === 'insight') return this.link('library', 'insight', id);
    if (kind === 'source') return this.link('library', 'source', id);
    if (kind === 'finding') return this.link('library', 'source', this.findingById().get(id)?.sourceId || '');
    if (kind === 'project') return this.link('work', 'projects', id);
    if (kind === 'phase') return this.link('work', 'projects');
    if (kind === 'activity') return this.link('product', 'map');
    if (kind === 'spec') return this.link('product', 'specs', id);
    if (kind === 'data_object') return this.link('data', 'objects', id);
    if (kind === 'data_operation') return this.link('data', 'api', id);
    if (kind === 'agent_profile') return this.link('work', 'agents', id);
    if (kind === 'work_item') return this.link('work', 'item', id);
    if (kind === 'role' || kind === 'work_action') return this.link('work', 'roles', id);
    if (kind === 'project_instructions') return this.link('work', 'agents');
    if (kind === 'doc') return this.link('product', 'docs', id);
    if (kind === 'research') return this.link('library', 'sources');
    if (kind === 'vision_section' || kind === 'persona') return this.link('product', 'brief');
    if (kind === 'access_rule') return this.link('data', 'access');
    if (kind === 'code_unit') return this.link('platform', 'code', id);
    return this.link('product', 'map', id);
  }

  // Everything a hover card shows about a referenced record, or null for an id that isn't in this project (A3).
  refInfo(id: string): RefInfo | null {
    const data = this.data(); if (!data || !id) return null;
    const info = (kind: string, kindLabel: string, icon: string, layer: string, label: string, title: string, rest: Partial<RefInfo> = {}): RefInfo =>
      ({ id, kind, kindLabel, icon, layer, label, title, status: null, note: '', facts: [], where: `${layerLabel[layer]}`, href: this.recordHref(kind, id), ...rest });
    const claim = this.claimById().get(id);
    if (claim) { const counts = this.evidenceFor(id); return info('brief_claim', sectionTitle(claim.section), 'fact_check', 'product', `${sectionTitle(claim.section)}: ${claim.text}`, claim.text, { where: `Vision › Brief › ${sectionTitle(claim.section)}`,
      status: { assumed: 'Assumed', supported: 'Supported', contradicted: 'Contradicted' }[this.confidence(id)], note: claim.note, facts: counts.length ? [['Evidence', `${counts.filter(link => link.direction === 'supports').length} for, ${counts.filter(link => link.direction === 'contradicts').length} against`]] : [] }); }
    const insight = this.insightById().get(id);
    if (insight) return info('insight', 'Insight', 'insights', 'library', insight.text, insight.text, { status: insight.strength, where: 'Library › Insights',
      facts: [['Findings', String(insight.findings.length)], ['Used', `${this.usedIn(id).length}×`], ...(insight.tags.length ? [['Tags', insight.tags.join(', ')] as [string, string]] : [])] });
    const finding = this.findingById().get(id);
    if (finding) return info('finding', 'Finding', 'format_quote', 'library', finding.text.slice(0, 80), finding.text, { where: `Library › ${this.sourceById().get(finding.sourceId)?.title || 'Source'}` });
    const source = this.sourceById().get(id);
    if (source) return info('source', 'Source', sourceTypeIcon[source.type] || 'article', 'library', source.title, source.title, { status: source.type, where: 'Library › Sources', note: source.body.slice(0, 200),
      facts: [['Findings', String(data.findings.filter(entry => entry.sourceId === id).length)], ...(source.date ? [['Date', source.date] as [string, string]] : [])] });
    const project = this.projectById().get(id);
    if (project) return info('project', 'Project', 'deployed_code_history', 'work', `${project.ref} ${project.title}`, project.title, { status: projectStatusLabel[project.status], where: 'Work › Projects', note: project.summary,
      facts: [['Milestone', phaseName(project.milestone)], ['Dates', project.start || project.target ? `${project.start || '…'} → ${project.target || '…'}` : 'None'], ['Lead', project.lead ? this.memberById().get(project.lead)?.name || 'Someone' : '—']] });
    const milestone = data.phases.find(phase => phase.id === id);
    if (milestone) return info('phase', 'Milestone', 'flag', 'work', milestone.label, milestone.label, { where: 'Work › Projects', note: milestone.goal, facts: milestone.target ? [['Target', milestone.target]] : [] });
    const activity = data.activities.find(entry => entry.id === id);
    if (activity) return info('activity', 'Activity', 'view_column', 'product', activity.title, activity.title, { where: 'Vision › Story map' });
    const persona = data.personas.find(entry => entry.id === id);
    if (persona) return info('persona', 'Persona', 'person', 'product', persona.name, persona.name, { where: 'Vision › Brief › Customers', note: persona.note, facts: persona.role ? [['Role', persona.role]] : [] });
    const story = this.storyById().get(id);
    if (story) return info('story', 'Story', 'bookmark', 'product', `${story.ref} ${story.title}`, story.title, { status: statusLabel[story.status], where: 'Vision › Story map',
      note: story.acceptance[0] ? `Given ${story.acceptance[0].given}, when ${story.acceptance[0].when}, then ${story.acceptance[0].then}.` : 'No acceptance yet.',
      facts: [['Phase', phaseName(story.phase)], ['Revision', String(story.revision)], ['Pages', story.pages.map(page => this.pageById().get(page)?.label).filter(Boolean).join(', ') || '—']] });
    const page = this.pageById().get(id);
    if (page) return info('page', 'Page', 'web', 'pages', `${page.label} page`, page.label, { status: page.status, where: 'Pages', note: page.description,
      facts: [['Type', this.catalog()?.pageTypes[page.pageType]?.label || page.pageType], ['Stories', page.stories.map(story => this.storyById().get(story)?.ref).filter(Boolean).join(', ') || '—']] });
    const object = this.objectById().get(id);
    if (object) return info('data_object', 'Object', 'data_object', 'data', `${object.name} object`, object.name, { status: dataStatusLabel[object.status], where: 'Data › Objects', note: object.description,
      facts: [['Fields', Object.keys(object.schema.properties || {}).join(', ') || 'none yet'], ['Contract', object.contract]] });
    const operation = this.operationById().get(id);
    if (operation) return info('data_operation', 'Operation', 'api', 'data', `${operation.method} ${operation.path}`, operation.operationId, { status: dataStatusLabel[operation.status], where: 'Data › API', note: operation.summary });
    const spec = data.specs.find(entry => entry.id === id);
    if (spec) return info('spec', 'Spec', 'description', 'product', `${spec.ref} ${spec.title}`, spec.title, { status: spec.status, where: 'Product › Specs', note: spec.problem.slice(0, 240),
      facts: [['Stories', spec.stories.map(story => this.storyById().get(story)?.ref).filter(Boolean).join(', ') || '—'], ['Appetite', spec.appetite || '—']] });
    const doc = data.docs.find(entry => entry.id === id);
    if (doc) return info('doc', 'Document', 'description', 'product', doc.title, doc.title, { where: 'Vision › Documents', status: doc.form === 'generated' ? 'Generated' : null, note: doc.body.replace(/\[\[[a-z]+-[a-z0-9]+\]\]|[#*_]/g, '').slice(0, 200) });
    const research = data.research.find(entry => entry.id === id);
    if (research) return info('research', 'Research', 'science', 'product', research.title, research.title, { where: 'Product › Research', note: research.body.slice(0, 200) });
    const vision = Object.values(data.vision).find(entry => entry.id === id);
    if (vision) return info('vision_section', 'Vision', 'flag', 'product', vision.title, vision.title, { where: 'Product › Vision', note: [vision.body, ...vision.items].filter(Boolean).join(' · ').slice(0, 240) });
    const rule = data.access.find(entry => entry.id === id);
    if (rule) return info('access_rule', 'Access rule', 'shield_person', 'data', rule.sentence, rule.sentence, { where: 'Data › Access', facts: [['Role', rule.role], ['Action', rule.action], ['Effect', rule.effect]] });
    const profile = this.profileById().get(id);
    if (profile) return info('agent_profile', 'Agent profile', 'smart_toy', 'work', profile.name, profile.name, { status: profile.active ? null : 'Deactivated', where: 'Work › Agents', note: profile.description,
      facts: [['Model', profile.model || 'Account default'], ['Effort', profile.effort], ['Revision', String(profile.revision)]] });
    const work = this.workById().get(id);
    if (work) return info('work_item', 'Work item', 'task_alt', 'work', `${work.ref} ${work.title}`, work.title, { status: workStatusLabel[work.status], where: 'Work',
      facts: [['Priority', priorityLabel[work.priority]], ['Assignee', this.whoName(work.assignee)], ...(work.blockedBy.length ? [['Blocked by', work.blockedBy.map(other => this.workById().get(other)?.ref).join(', ')] as [string, string]] : [])] });
    const role = data.roles.find(entry => entry.id === id);
    if (role) return info('role', 'Role instructions', 'menu_book', 'work', `${role.name} instructions`, `${role.name} instructions`, { where: 'Work › Roles', note: role.instructions, facts: [['Revision', String(role.revision)]] });
    const action = data.roles.flatMap(entry => entry.actions).find(entry => entry.recordId === id);
    if (action) return info('work_action', 'Action', 'tune', 'work', action.name, action.name, { where: 'Work › Roles', note: action.instructions || action.description, href: this.link('work', 'roles', action.id), facts: [['Revision', String(action.revision)]] });
    if (data.projectInstructions?.id === id) return info('project_instructions', 'Project instructions', 'menu_book', 'work', 'Project instructions', 'Project instructions', { where: 'Work › Agents', note: data.projectInstructions.body.slice(0, 240) });
    const unit = this.unitById().get(id);
    if (unit) return info('code_unit', 'Code unit', 'code', 'platform', unit.symbol, unit.symbol, { status: unitStateLabel[unit.state], where: 'Platform › Code', facts: [['Path', unit.path], ['Kind', unit.kind]] });
    return null;
  }
  recordLabel(id: string): [string, string, string] {
    const story = this.storyById().get(id); if (story) return [`${story.ref} ${story.title}`, this.recordHref('story', id), 'product'];
    const page = this.pageById().get(id); if (page) return [`${page.label} page`, this.recordHref('page', id), 'pages'];
    const object = this.objectById().get(id); if (object) return [`${object.name} object`, this.recordHref('data_object', id), 'data'];
    const operation = this.operationById().get(id); if (operation) return [`${operation.operationId} operation`, this.recordHref('data_operation', id), 'data'];
    const spec = this.data()?.specs.find(entry => entry.id === id); if (spec) return [`${spec.ref} ${spec.title}`, this.recordHref('spec', id), 'product'];
    return [id, this.link(), 'work'];
  }

  // LAY-04A: following a work item's target makes later edits to its targets count as that item's output.
  readonly workingOn = signal<{ id: string; ref: string; title: string; targets: string[] } | null>(null);
  workOn(item: WorkItem) { this.workingOn.set({ id: item.id, ref: item.ref, title: item.title, targets: item.targets.map(target => target.id) }); }
  private workFor(id: string) { const current = this.workingOn(); return current && current.targets.includes(id) ? current.id : null; }

  go(path: string, event?: Event) {
    event?.preventDefault();
    if (!path.startsWith('/p/')) { location.assign(path); return; }
    history.pushState({}, '', path);
    this.path.set(path);
    this.error.set(''); this.notice.set('');
    window.scrollTo(0, 0);
    setTimeout(() => document.querySelector<HTMLElement>('.lay-main h1')?.focus({ preventScroll: true }), 30);
  }

  // The Product layer lives at /vision (ROADMAP-01); callers keep naming it by its layer key.
  link(...parts: string[]) { if (parts[0] === 'product') parts = ['vision', ...parts.slice(1)]; return `/p/${encodeURIComponent(this.slug())}${parts.length ? '/' + parts.map(encodeURIComponent).join('/') : ''}`; }

  async api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(value.error || 'Something went wrong. Please try again.'), { status: response.status });
    return value as T;
  }

  // Evidence and documents write through here too.
  comment(insightId: string, text: string) { return this.api(`/api/projects/${encodeURIComponent(this.projectId())}/comments/${encodeURIComponent(insightId)}`, 'POST', { text }); }
  generate(generator: string, id = '') { return this.api<Doc>(`/api/projects/${encodeURIComponent(this.projectId())}/docs${id ? '/' + encodeURIComponent(id) : ''}`, 'POST', { generator }); }
  next(assignee: Assignee, count: number) { return this.api<{ added: string[] }>(`/api/projects/${encodeURIComponent(this.projectId())}/batches/next`, 'POST', { assignee, count }); }

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
    return this.api(`/api/projects/${encodeURIComponent(this.projectId())}/records/${encodeURIComponent(id)}`, 'PUT', { data, expectedRevision, rationale: rationale || null, workItemId: this.workFor(id) });
  }
  delete(id: string) { return this.api(`/api/projects/${encodeURIComponent(this.projectId())}/records/${encodeURIComponent(id)}`, 'DELETE'); }
  updateWork(id: string, body: unknown) { return this.api<WorkItem>(`/api/projects/${encodeURIComponent(this.projectId())}/work/${encodeURIComponent(id)}`, 'PUT', body); }
}

export const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
export const phaseName = (key: string) => ({ demo: 'Demo', mvp: 'MVP', later: 'Later' } as Record<string, string>)[key] || key;
