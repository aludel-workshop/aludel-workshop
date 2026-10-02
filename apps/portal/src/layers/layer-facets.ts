import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';

// Manage › Facets (LAYER-BINDINGS-01 R5): what this layer shares, as facets, and reshaping them. A binding contracts on whole
// facets, so sharing part of one means splitting it; a layer with no facets declares one over outputs it keeps. Every
// change is a refacet: Work in this layer, a reviewed change to its layer.json that the owner accepts or dismisses here.
type Clause = { kind: string; where?: { field: string; in?: unknown[]; notIn?: unknown[] } };
interface Facet { key: string; title: string; kinds: string[]; select: Clause[]; role: 'authority' | 'replica' | 'ceded' | null; binding: string | null;
  authority: { layer: string; facet: string; name: string } | null }
interface Roles { facets: Facet[]; outputs: string[]; entries: Record<string, string> }
interface Refacet { id: string; number: number; title: string; state: string; blockedBy: string[];
  change: { op: string; facet?: string; from?: string; into?: { key: string } };
  preflight: { records: { ref: string }[]; byKind: Record<string, number>; bindings: { binding: string; detached: string[] }[];
    follow: { layer: string; facet: string; refs: string[] }[]; references: { layer: string }[] } }
const keyOf = (title: string) => title.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const roleOptions = ['authority', 'replica', 'ceded'] as const;

@Component({
  selector: 'aludel-layer-facets', standalone: true, imports: [FormsModule, MatIconModule],
  template: `
  <h2 class="lay-tk-title">Facets</h2>
  <p class="lay-muted">What {{ name() }} can share with other layers. A binding contracts on whole facets: to share only part of one, split it. Each change is Work here, reviewed before {{ name() }}'s layer.json changes.</p>
  @if (roles(); as r) {
    <ul class="lay-fc-list">
      @for (f of r.facets; track f.key) {
        <li class="lay-card">
          <div class="lay-row lay-wrap"><strong>{{ f.title }}</strong><span class="lay-chip lay-plain">{{ f.key }}</span>
            <span class="lay-chip" [class.lay-plain]="!f.role">{{ roleText(f) }}</span><span class="lay-muted small">{{ count(f.key) }} entries</span>
            <span class="lay-push"></span>
            <button type="button" class="lay-button ghost small" (click)="open('split', f.key)" [attr.aria-expanded]="form() === 'split:' + f.key">Split</button>
            @if (r.facets.length > 1) { <button type="button" class="lay-button ghost small" (click)="open('merge', f.key)" [attr.aria-expanded]="form() === 'merge:' + f.key">Merge</button> }
            <button type="button" class="lay-link-button small" (click)="open('rename', f.key)" [attr.aria-expanded]="form() === 'rename:' + f.key">Rename</button></div>
          <p class="lay-muted small lay-flat">{{ holds(f) }}</p>
          @if (form() === 'split:' + f.key) {
            <form class="lay-fc-form" (ngSubmit)="split(f)" [attr.aria-label]="'Split ' + f.title">
              <label>New facet<input name="title" [(ngModel)]="title" maxlength="80" placeholder="e.g. Personas"></label>
              <fieldset><legend>Takes</legend>
                @for (c of f.select; track $index) { <label class="lay-fc-check"><input type="checkbox" [name]="'k' + $index" [(ngModel)]="picked[c.kind]">All {{ label(c.kind) }}{{ c.where ? ' it holds' : '' }}</label> }
                <label class="lay-fc-check"><input type="checkbox" name="narrow" [(ngModel)]="narrow">Only some, by one field</label>
                @if (narrow) { <div class="lay-row lay-wrap">
                  <label>Kind<select name="nk" [(ngModel)]="narrowKind">@for (c of f.select; track $index) { <option [value]="c.kind">{{ label(c.kind) }}</option> }</select></label>
                  <label>Field<input name="nf" [(ngModel)]="narrowField" placeholder="key"></label>
                  <label>Values (comma-separated)<input name="nv" [(ngModel)]="narrowValues" placeholder="name, mark"></label></div> }
              </fieldset>
              <label>Why<input name="why" [(ngModel)]="why" maxlength="400"></label>
              <div class="lay-row"><button type="submit" class="lay-button small" [disabled]="!title.trim()">Propose the split</button><button type="button" class="lay-link-button" (click)="form.set('')">Cancel</button></div>
            </form>
          } @else if (form() === 'merge:' + f.key) {
            <form class="lay-fc-form" (ngSubmit)="merge(f)" [attr.aria-label]="'Merge into ' + f.title">
              <label>Merge into {{ f.title }}<select name="from" [(ngModel)]="mergeFrom">@for (o of r.facets; track o.key) { @if (o.key !== f.key) { <option [value]="o.key">{{ o.title }}</option> } }</select></label>
              <label>Why<input name="why" [(ngModel)]="why" maxlength="400"></label>
              <div class="lay-row"><button type="submit" class="lay-button small" [disabled]="!mergeFrom">Propose the merge</button><button type="button" class="lay-link-button" (click)="form.set('')">Cancel</button></div>
            </form>
          } @else if (form() === 'rename:' + f.key) {
            <form class="lay-fc-form lay-row lay-wrap" (ngSubmit)="rename(f)" [attr.aria-label]="'Rename ' + f.title">
              <label>Title<input name="title" [(ngModel)]="title" maxlength="80"></label>
              <button type="submit" class="lay-button small" [disabled]="!title.trim()">Propose</button><button type="button" class="lay-link-button" (click)="form.set('')">Cancel</button>
            </form>
          }
        </li>
      } @empty { <li class="lay-muted">{{ name() }} shares nothing yet.</li> }
    </ul>
    @if (unshared().length) {
      <section class="lay-card"><div class="lay-row lay-wrap"><strong>Not in any facet</strong><span class="lay-muted small">{{ unshared().map(label).join(', ') }}</span><span class="lay-push"></span>
        <button type="button" class="lay-button ghost small" (click)="open('declare', '')" [attr.aria-expanded]="form() === 'declare:'">Declare a facet</button></div>
        @if (form() === 'declare:') {
          <form class="lay-fc-form" (ngSubmit)="declare()" aria-label="Declare a facet">
            <label>Facet<input name="title" [(ngModel)]="title" maxlength="80" placeholder="e.g. People"></label>
            <fieldset><legend>Holds</legend>@for (kind of unshared(); track kind) { <label class="lay-fc-check"><input type="checkbox" [name]="'d' + kind" [(ngModel)]="picked[kind]">{{ label(kind) }}</label> }</fieldset>
            <fieldset><legend>Can be, in a binding</legend>@for (role of roleOptions; track role) { <label class="lay-fc-check"><input type="checkbox" [name]="'r' + role" [(ngModel)]="roleChoice[role]">{{ roleWord[role] }}</label> }</fieldset>
            <label>Hints for discovery (comma-separated)<input name="hints" [(ngModel)]="hints" placeholder="personas"></label>
            <label>Why<input name="why" [(ngModel)]="why" maxlength="400"></label>
            <div class="lay-row"><button type="submit" class="lay-button small" [disabled]="!title.trim() || !pickedKinds().length">Propose the facet</button><button type="button" class="lay-link-button" (click)="form.set('')">Cancel</button></div>
          </form>
        }
      </section>
    }
    @if (pending().length) {
      <h3>Proposed changes</h3>
      <ul class="lay-fc-list">
        @for (p of pending(); track p.id) {
          <li class="lay-card" [attr.aria-label]="p.title">
            <a [href]="ctx.link('work', 'item', p.id)" (click)="ctx.go(ctx.link('work', 'item', p.id), $event)"><strong>{{ p.title }}</strong></a>
            <ul class="lay-fc-pre">
              <li>{{ moves(p) }}</li>
              @for (b of p.preflight.bindings; track b.binding) { <li>Held aside in a binding until every participant lets go: {{ b.detached.length }} {{ b.detached.length === 1 ? 'entry' : 'entries' }}.</li> }
              @for (f of p.preflight.follow; track f.layer + f.facet) { <li>{{ layerName(f.layer) }}'s {{ f.facet }} holds {{ f.refs.length }} of them and should be refaceted too.</li> }
              @if (p.preflight.references.length) { <li>{{ p.preflight.references.length }} references from other layers point into what moves.</li> }
            </ul>
            @if (p.blockedBy.length) { <p class="lay-muted small">Waits on other Work.</p> }
            @else if (canDecide()) { <div class="lay-row"><button type="button" class="lay-button small" (click)="decide(p, 'accept')">Accept</button>
              <button type="button" class="lay-button ghost small" (click)="decide(p, 'dismiss')">Dismiss</button></div> }
          </li>
        }
      </ul>
    }
  } @else { <p class="lay-muted">{{ error() || 'Loading facets…' }}</p> }`,
  styles: [`.lay-fc-list{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:8px}.lay-fc-list>li{display:flex;flex-direction:column;gap:6px}
    .lay-fc-form{display:flex;flex-direction:column;gap:8px;padding-top:8px}.lay-fc-form label{display:flex;flex-direction:column;gap:4px}.lay-fc-form fieldset{display:flex;flex-direction:column;gap:4px;border:0;padding:0;margin:0}
    .lay-fc-form .lay-fc-check{flex-direction:row;align-items:center;gap:8px}.lay-fc-pre{margin:0;padding-left:20px}`]
})
export class LayerFacetsComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly roles = signal<Roles | null>(null);
  readonly pending = signal<Refacet[]>([]);
  readonly error = signal('');
  readonly form = signal('');
  readonly roleOptions = roleOptions;
  readonly roleWord: Record<string, string> = { authority: 'The authority', replica: 'A copy that follows another layer', ceded: 'Ceded to another layer' };
  title = ''; why = ''; hints = ''; narrow = false; narrowKind = ''; narrowField = ''; narrowValues = ''; mergeFrom = '';
  picked: Record<string, boolean> = {};
  roleChoice: Record<string, boolean> = { authority: true, replica: true, ceded: true };
  readonly name = computed(() => this.ctx.layerInstances().find(layer => layer.key === this.layerKey())?.name || this.layerKey());
  readonly canDecide = computed(() => this.ctx.session()?.projects.find(project => project.id === this.ctx.projectId())?.role === 'owner');
  readonly unshared = computed(() => { const r = this.roles(); return r ? r.outputs.filter(kind => !r.facets.some(facet => facet.kinds.includes(kind))) : []; });
  private readonly load = effect(() => { this.ctx.data(); const key = this.layerKey(), project = this.ctx.projectId(); if (key && project) untracked(() => void this.refresh()); });

  private base() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}`; }
  async refresh() {
    try {
      const [roles, pending] = await Promise.all([this.ctx.api<Roles>(`${this.base()}/roles?layer=${encodeURIComponent(this.layerKey())}`),
        this.ctx.api<{ refacets: Refacet[] }>(`${this.base()}/layers/${encodeURIComponent(this.layerKey())}/refacets`)]);
      this.roles.set(roles); this.pending.set(pending.refacets); this.error.set('');
    } catch (error) { this.error.set(error instanceof Error ? error.message : String(error)); }
  }
  label = (kind: string) => kind.replaceAll('_', ' ');
  layerName(key: string) { return this.ctx.layerInstances().find(layer => layer.key === key)?.name || key; }
  count(facet: string) { return Object.values(this.roles()?.entries || {}).filter(key => key === facet).length; }
  roleText(f: Facet) { return !f.role ? 'Not shared' : f.role === 'authority' ? 'Authority' : f.role === 'replica' ? `Follows ${f.authority?.name}` : `Ceded to ${f.authority?.name}`; }
  holds(f: Facet) { return f.select.map(c => c.where ? `${this.label(c.kind)} where ${c.where.field} ${c.where.in ? 'is ' + c.where.in.join(', ') : 'is not ' + (c.where.notIn || []).join(', ')}` : `all ${this.label(c.kind)}`).join('; '); }
  pickedKinds() { return Object.entries(this.picked).filter(([, on]) => on).map(([kind]) => kind); }
  moves(p: Refacet) { const kinds = Object.entries(p.preflight.byKind).map(([kind, n]) => `${n} ${this.label(kind)}`); return kinds.length ? `Moves ${kinds.join(', ')}.` : 'Moves no records.'; }
  open(kind: string, facet: string) {
    const key = `${kind}:${facet}`; if (this.form() === key) { this.form.set(''); return; }
    const f = this.roles()?.facets.find(item => item.key === facet);
    this.title = kind === 'rename' ? f?.title || '' : ''; this.why = ''; this.hints = ''; this.narrow = false; this.picked = {};
    this.narrowKind = f?.select[0]?.kind || ''; this.narrowField = ''; this.narrowValues = ''; this.mergeFrom = '';
    this.roleChoice = { authority: true, replica: true, ceded: true }; this.form.set(key);
  }
  private propose(change: unknown, success: string) {
    return this.ctx.write(() => this.ctx.api(`${this.base()}/layers/${encodeURIComponent(this.layerKey())}/refacets`, 'POST', { change, rationale: this.why.trim() || null }), success)
      .then(ok => { if (ok) { this.form.set(''); void this.refresh(); } });
  }
  split(f: Facet) {
    const take: Clause[] = this.pickedKinds().filter(kind => f.select.some(c => c.kind === kind)).map(kind => ({ kind }));
    if (this.narrow && this.narrowKind && this.narrowField.trim()) take.push({ kind: this.narrowKind, where: { field: this.narrowField.trim(), in: this.narrowValues.split(',').map(value => value.trim()).filter(Boolean) } });
    return this.propose({ op: 'split', facet: f.key, into: { key: keyOf(this.title), title: this.title.trim(), take } }, `Proposed splitting ${f.title}. Review it below.`);
  }
  merge(f: Facet) { return this.propose({ op: 'merge', facet: f.key, from: this.mergeFrom }, `Proposed merging into ${f.title}.`); }
  rename(f: Facet) { return this.propose({ op: 'rename', facet: f.key, title: this.title.trim() }, `Proposed renaming ${f.title}.`); }
  declare() {
    const roles = roleOptions.filter(role => this.roleChoice[role]), hints = this.hints.split(',').map(hint => keyOf(hint)).filter(Boolean);
    return this.propose({ op: 'declare', into: { key: keyOf(this.title), title: this.title.trim(), take: this.pickedKinds().map(kind => ({ kind })), roles, ...(hints.length ? { hints } : {}) } },
      `Proposed the ${this.title.trim()} facet. Review it below.`);
  }
  decide(p: Refacet, decision: 'accept' | 'dismiss') {
    return this.ctx.write(() => this.ctx.api(`${this.base()}/refacets/${encodeURIComponent(p.id)}/decide`, 'POST', { decision }), decision === 'accept' ? 'Accepted. The layer is refaceted.' : 'Dismissed.')
      .then(() => this.refresh());
  }
}
