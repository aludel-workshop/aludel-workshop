import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BuiltByComponent } from './built-by';
import { AccessRule, DataObject, DataOperation, JsonSchema, ProjectContext, dataStatusLabel, lines } from './context';

const fieldTypes = ['string', 'integer', 'number', 'boolean', 'array', 'object'];
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const effectLabel: Record<string, string> = { allow: 'Allowed', owner: 'Owner only', deny: 'Denied' };
const box = { width: 196, height: 128, gapX: 56, gapY: 44 };

// Data (LAY-07A, DEC-038): what the product knows and how it is asked for, written so any stack could build it.
// Objects are JSON Schema 2020-12, operations OpenAPI 3.1. How they are built lives in Platform.
@Component({
  selector: 'aludel-data-layer', standalone: true,
  imports: [FormsModule, MatIconModule, BuiltByComponent],
  template: `
  <p class="lay-eyebrow">Data · objects and contracts</p>
  <h1 tabindex="-1">What {{ ctx.setup()?.project?.name }} knows, and how it's asked for</h1>
  <p class="lay-lead">Written so any stack could build it. Objects are JSON Schema; operations are OpenAPI 3.1. How they're built lives in Platform.</p>
  <nav class="lay-tabs" aria-label="Data sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('data', entry[0])" (click)="ctx.go(ctx.link('data', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null">{{ entry[1] }}</a> }
  </nav>
  @switch (tab()) {
    @case ('api') {
      <div class="lay-api-grid">
        <nav class="lay-card lay-api-nav" aria-label="Operations">
          @for (group of groups(); track group.name) {
            <h3>{{ group.name }}</h3>
            @for (op of group.operations; track op.id) { <a [href]="ctx.link('data', 'api', op.id)" (click)="ctx.go(ctx.link('data', 'api', op.id), $event)" [class.active]="op.id === operation()?.id" [attr.aria-current]="op.id === operation()?.id ? 'page' : null"><span [class]="'lay-method lay-m-' + op.method">{{ op.method }}</span><span>{{ op.summary }}</span></a> }
          } @empty { <p class="lay-muted small">No operations yet.</p> }
          <a class="lay-button ghost small lay-gap-top" [href]="openApiHref()" target="_blank" rel="noopener"><mat-icon aria-hidden="true">download</mat-icon>openapi.json</a>
        </nav>
        @if (operation(); as op) {
          <article class="lay-card" aria-labelledby="op-title">
            <div class="lay-row lay-wrap"><h2 id="op-title" class="lay-flat">{{ op.summary }}</h2><span [class]="'lay-chip ' + statusClass(op.status)">{{ dataStatusLabel[op.status] }}</span><span class="lay-chip lay-plain">rev {{ op.revision }}</span></div>
            <p><span [class]="'lay-method lay-m-' + op.method">{{ op.method }}</span> <code>{{ op.path }}</code> <span class="lay-muted small">· operationId <code>{{ op.operationId }}</code></span></p>
            <dl class="lay-kv small">
              <dt>Acts on</dt><dd>@if (op.objectId && ctx.objectById().get(op.objectId); as object) { <a [href]="ctx.link('data', 'objects', object.id)" (click)="ctx.go(ctx.link('data', 'objects', object.id), $event)">{{ object.name }}</a> } @else { Nothing in particular }</dd>
              <dt>Who can call it</dt><dd>{{ op.roles.join(', ') || 'Not set' }} · <a [href]="ctx.link('data', 'access')" (click)="ctx.go(ctx.link('data', 'access'), $event)">Access</a></dd>
              <dt>Stories</dt><dd>@for (id of op.stories; track id) { <a [href]="ctx.link('product', 'map', id)" (click)="ctx.go(ctx.link('product', 'map', id), $event)">{{ ctx.storyById().get(id)?.ref }}</a>{{ $last ? '' : ', ' }} } @empty { None }</dd>
            </dl>
            <h3>Parameters</h3>
            @if (op.parameters.length) {
              <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Parameters"><table><thead><tr><th>Name</th><th>In</th><th>Type</th><th>Description</th></tr></thead><tbody>
                @for (param of op.parameters; track param.name) { <tr><td><code>{{ param.name }}</code>{{ param.required ? ' · required' : '' }}</td><td>{{ param.in }}</td><td>{{ typeOf(param.schema) }}</td><td class="small">{{ param.description }}</td></tr> }</tbody></table></div>
            } @else { <p class="lay-muted small">None</p> }
            <h3>Request body</h3>
            @if (op.request) { <p class="small">JSON: {{ fieldSummary(op.request) }}</p> } @else { <p class="lay-muted small">None</p> }
            <h3>Responses</h3>
            <ul class="small lay-plain-list"><li><span class="lay-chip lay-ok">{{ op.response.status }}</span> {{ op.response.description }}</li>
              @for (error of op.errors; track error.status) { <li><span class="lay-chip lay-bad">{{ error.status }}</span> {{ error.description }}</li> }</ul>
            <h3>Built by</h3><aludel-built-by [recordId]="op.id" />
            @if (op.contract !== 'accepted') {
              <form class="lay-form lay-gap-top" (ngSubmit)="accept(op.id, op.operationId)">
                <label>Why this change (saved with the revision)<input name="rationale" [(ngModel)]="rationale" maxlength="400"></label>
                <div class="lay-row lay-wrap"><button type="submit" class="lay-button small">Accept this contract</button>
                  @if (!op.template) { <button type="button" class="lay-link-button danger" (click)="remove(op.id, op.operationId)">Delete operation</button> }</div>
              </form>
            } @else {
              <p class="lay-muted small lay-gap-top">Contract accepted{{ op.template ? ' (the template is the contract)' : '' }}.
                @if (!op.template) { <button type="button" class="lay-link-button danger" (click)="remove(op.id, op.operationId)">Delete operation</button> }</p>
            }
          </article>
          <aside class="lay-api-example" aria-label="Example">
            <pre class="lay-code"><span class="lay-code-label">Example request</span>{{ exampleRequest(op) }}</pre>
            <pre class="lay-code"><span class="lay-code-label">Response {{ op.response.status }}</span>{{ op.response.schema ? json(example(op.response.schema)) : '(no body)' }}</pre>
            <p class="lay-muted small">Contract only: no environment here. The running preview is in Platform › Environments.</p>
          </aside>
        } @else { <p class="lay-muted">No operations yet. Add the first below.</p> }
      </div>
      <form class="lay-card lay-form lay-gap-top" (ngSubmit)="addOperation()" aria-labelledby="new-op"><h2 id="new-op">New operation</h2>
        <div class="lay-row lay-wrap lay-fields">
          <label>operationId<input name="operationId" [(ngModel)]="newOp.operationId" placeholder="listNearbyTools" class="lay-mono"></label>
          <label>Method<select name="method" [(ngModel)]="newOp.method">@for (method of methods; track method) { <option [value]="method">{{ method }}</option> }</select></label>
          <label>Path<input name="path" [(ngModel)]="newOp.path" placeholder="/tools" class="lay-mono"></label>
          <label>Object<select name="objectId" [(ngModel)]="newOp.objectId"><option value="">None</option>@for (object of objects(); track object.id) { <option [value]="object.id">{{ object.name }}</option> }</select></label>
        </div>
        <label>Summary<input name="summary" [(ngModel)]="newOp.summary" placeholder="Tools near me"></label>
        <button type="submit" class="lay-button small">Add operation</button>
      </form>
    }
    @case ('access') {
      <p class="lay-muted small">Each rule is a record with a revision. Agents read these sentences, and the Reviewer checks builds against them. <em>Owner only</em> means the record's owner (for example, your own account).</p>
      @if (accessRows().length) {
        <div class="lay-table-wrap" tabindex="0" role="region" aria-label="Access rules"><table><thead><tr><th>Object</th><th>Action</th>@for (role of roles(); track role) { <th>{{ role }}</th> }<th>Rule</th><th><span class="visually-hidden">Remove</span></th></tr></thead><tbody>
          @for (row of accessRows(); track row.key) {
            <tr><td><a [href]="ctx.link('data', 'objects', row.objectId)" (click)="ctx.go(ctx.link('data', 'objects', row.objectId), $event)">{{ ctx.objectById().get(row.objectId)?.name }}</a></td><td>{{ row.action }}</td>
              @for (role of roles(); track role) { <td>@if (row.cells[role]; as rule) { <span class="lay-chip" [class.lay-ok]="rule.effect === 'allow'" [class.lay-warn]="rule.effect === 'owner'" [class.lay-bad]="rule.effect === 'deny'">{{ effectLabel[rule.effect] }}</span> } @else { <span class="lay-muted">—</span> }</td> }
              <td class="small">@for (rule of row.rules; track rule.id) { <span class="lay-block">{{ rule.sentence }}</span> }</td>
              <td>@for (rule of row.rules; track rule.id) { <button type="button" class="lay-link-button danger" (click)="remove(rule.id, rule.sentence)" [attr.aria-label]="'Remove rule: ' + rule.sentence">Remove</button> }</td></tr>
          }</tbody></table></div>
      } @else { <p class="lay-muted">No access rules yet.</p> }
      <form class="lay-card lay-form lay-gap-top" (ngSubmit)="addRule()" aria-labelledby="new-rule"><h2 id="new-rule">New rule</h2>
        <div class="lay-row lay-wrap lay-fields">
          <label>Role<input name="role" [(ngModel)]="newRule.role" placeholder="member" class="lay-mono"></label>
          <label>Object<select name="objectId" [(ngModel)]="newRule.objectId"><option value="">Choose…</option>@for (object of objects(); track object.id) { <option [value]="object.id">{{ object.name }}</option> }</select></label>
          <label>Action<input name="action" [(ngModel)]="newRule.action" placeholder="read" class="lay-mono"></label>
          <label>Effect<select name="effect" [(ngModel)]="newRule.effect">@for (entry of effects; track entry[0]) { <option [value]="entry[0]">{{ entry[1] }}</option> }</select></label>
        </div>
        <label>Rule, as a sentence<input name="sentence" [(ngModel)]="newRule.sentence" placeholder="Only the lender can approve a request."></label>
        <button type="submit" class="lay-button small">Add rule</button>
      </form>
    }
    @default {
      @if (objects().length) {
        <div class="lay-er-wrap" tabindex="0" role="region" aria-label="Relationship map">
          <div class="lay-er" [style.width.px]="mapSize().width" [style.height.px]="mapSize().height">
            <svg [attr.width]="mapSize().width" [attr.height]="mapSize().height" aria-hidden="true">@for (edge of edges(); track edge.key) { <line [attr.x1]="edge.x1" [attr.y1]="edge.y1" [attr.x2]="edge.x2" [attr.y2]="edge.y2" /> }</svg>
            @for (entry of layout(); track entry.object.id) {
              <a class="lay-er-box" [class.proposed]="entry.object.status === 'proposed'" [class.active]="entry.object.id === object()?.id" [style.left.px]="entry.x" [style.top.px]="entry.y"
                [href]="ctx.link('data', 'objects', entry.object.id)" (click)="ctx.go(ctx.link('data', 'objects', entry.object.id), $event)" [attr.aria-current]="entry.object.id === object()?.id ? 'page' : null">
                <span class="lay-er-head"><span>{{ entry.object.name }}</span><small>{{ dataStatusLabel[entry.object.status] }}</small></span>
                <span class="lay-er-fields">@for (field of fields(entry.object).slice(0, 3); track field.name) { <span><span>{{ field.name }}</span><small>{{ field.type }}</small></span> }
                  @if (fields(entry.object).length > 3) { <small>+ {{ fields(entry.object).length - 3 }} more</small> }</span>
              </a>
            }
          </div>
        </div>
      }
      @if (object(); as current) {
        <div class="lay-grid lay-g-side lay-gap-top">
          <article class="lay-card" aria-labelledby="object-title">
            <div class="lay-row lay-wrap"><h2 id="object-title" class="lay-flat">{{ current.name }}</h2><span [class]="'lay-chip ' + statusClass(current.status)">{{ dataStatusLabel[current.status] }}</span><span class="lay-chip lay-plain">rev {{ current.revision }}</span></div>
            <p class="lay-muted small">{{ current.description || 'No description yet.' }} · origin: {{ current.origin }}</p>
            <div class="lay-table-wrap" tabindex="0" role="region" [attr.aria-label]="current.name + ' fields'"><table><thead><tr><th>Field</th><th>Type</th><th>Rules</th><th>Note</th><th><span class="visually-hidden">Remove</span></th></tr></thead><tbody>
              @for (field of fields(current); track field.name) { <tr><td><code>{{ field.name }}</code></td><td>{{ field.type }}</td><td class="small">{{ field.rules }}</td><td class="small">{{ field.note }}</td>
                <td>@if (!current.template) { <button type="button" class="lay-link-button danger" (click)="removeField(current, field.name)" [attr.aria-label]="'Remove field ' + field.name">Remove</button> }</td></tr> }
              @empty { <tr><td colspan="5" class="lay-muted">No fields yet.</td></tr> }</tbody></table></div>
            <h3>Relationships</h3>
            <ul class="small lay-plain-list">@for (relation of current.relations; track relation.name) { <li><code>{{ relation.name }}</code>: {{ relation.cardinality === 'one' ? 'one' : 'many' }} <a [href]="ctx.link('data', 'objects', relation.target)" (click)="ctx.go(ctx.link('data', 'objects', relation.target), $event)">{{ ctx.objectById().get(relation.target)?.name }}</a>{{ relation.owner ? ' (owns it)' : '' }}</li> }
              @for (other of incoming(current); track other.key) { <li><span class="lay-muted">{{ other.from }} → {{ other.name }}</span></li> }
              @if (!current.relations.length && !incoming(current).length) { <li class="lay-muted">None</li> }</ul>
            @if (current.states.length) { <h3>Lifecycle</h3><ul class="small lay-plain-list">@for (state of current.states; track state) { <li>{{ state }}</li> }</ul> }
            <details class="lay-gap-top"><summary>View as JSON Schema</summary><pre class="lay-code">{{ json(schemaDocument(current)) }}</pre></details>
            @if (!current.template) {
              <form class="lay-form lay-gap-top" (ngSubmit)="addField(current)" aria-labelledby="add-field"><h3 id="add-field">Add a field</h3>
                <div class="lay-row lay-wrap lay-fields">
                  <label>Name<input name="fieldName" [(ngModel)]="field.name" placeholder="startDate" class="lay-mono"></label>
                  <label>Type<select name="fieldType" [(ngModel)]="field.type">@for (type of fieldTypes; track type) { <option [value]="type">{{ type }}</option> }</select></label>
                  <label>Format<input name="fieldFormat" [(ngModel)]="field.format" placeholder="date"></label>
                </div>
                <label>Note<input name="fieldNote" [(ngModel)]="field.note"></label>
                <label class="lay-check"><input type="checkbox" name="fieldRequired" [(ngModel)]="field.required"> Required</label>
                <button type="submit" class="lay-button ghost small">Add field</button>
              </form>
              <form class="lay-form lay-gap-top" (ngSubmit)="addRelation(current)" aria-labelledby="add-relation"><h3 id="add-relation">Add a relationship</h3>
                <div class="lay-row lay-wrap lay-fields">
                  <label>Name<input name="relationName" [(ngModel)]="relation.name" placeholder="lender" class="lay-mono"></label>
                  <label>To<select name="relationTarget" [(ngModel)]="relation.target"><option value="">Choose…</option>@for (object of objects(); track object.id) { <option [value]="object.id">{{ object.name }}</option> }</select></label>
                  <label>How many<select name="relationCardinality" [(ngModel)]="relation.cardinality"><option value="one">One</option><option value="many">Many</option></select></label>
                </div>
                <label class="lay-check"><input type="checkbox" name="relationOwner" [(ngModel)]="relation.owner"> This object owns the other</label>
                <button type="submit" class="lay-button ghost small">Add relationship</button>
              </form>
            }
            <form class="lay-form lay-gap-top" (ngSubmit)="saveObject(current)" aria-labelledby="edit-object"><h3 id="edit-object">Description and lifecycle</h3>
              <label>Description<textarea name="description" rows="2" [(ngModel)]="objectDraft.description"></textarea></label>
              <label>Lifecycle states (one per line)<textarea name="states" rows="2" [(ngModel)]="objectDraft.states"></textarea></label>
              <label>Why this change (saved with the revision)<input name="rationale" [(ngModel)]="rationale" maxlength="400"></label>
              <div class="lay-row lay-wrap"><button type="submit" class="lay-button small">Save</button>
                @if (current.contract !== 'accepted') { <button type="button" class="lay-button ghost small" (click)="accept(current.id, current.name)">Accept this contract</button> }
                @if (!current.template) { <button type="button" class="lay-link-button danger" (click)="remove(current.id, current.name)">Delete object</button> }</div>
            </form>
          </article>
          <aside class="lay-card lay-connected" [attr.aria-label]="'Connected to ' + current.name">
            <h2>Connected</h2>
            <h3>Stories</h3>@for (id of current.stories; track id) { <a [href]="ctx.link('product', 'map', id)" (click)="ctx.go(ctx.link('product', 'map', id), $event)">{{ ctx.storyById().get(id)?.ref }} {{ ctx.storyById().get(id)?.title }}</a> } @empty { <p class="lay-muted small">None</p> }
            <h3>Specs</h3>@for (spec of specsFor(current); track spec.id) { <a [href]="ctx.link('product', 'specs', spec.id)" (click)="ctx.go(ctx.link('product', 'specs', spec.id), $event)">{{ spec.ref }} {{ spec.title }}</a> } @empty { <p class="lay-muted small">None</p> }
            <h3>Operations</h3>@for (op of operationsFor(current); track op.id) { <a [href]="ctx.link('data', 'api', op.id)" (click)="ctx.go(ctx.link('data', 'api', op.id), $event)"><span [class]="'lay-method lay-m-' + op.method">{{ op.method }}</span>{{ op.operationId }}</a> } @empty { <p class="lay-muted small">None yet</p> }
            <h3>Built by</h3><aludel-built-by [recordId]="current.id" />
            <h3>Why it is this way</h3>
            @if (current.history.length) { <div class="lay-history">@for (entry of current.history; track entry.revision) { <p>{{ entry.rationale }}<br><small>Revision {{ entry.revision }} · {{ entry.author }} · {{ entry.createdAt.slice(0, 10) }}</small></p> }</div> }
            @else { <p class="lay-muted small">No recorded decisions yet.</p> }
          </aside>
        </div>
      } @else { <p class="lay-muted">No objects yet. Story packs bring some; specs name more.</p> }
      <form class="lay-card lay-form lay-gap-top" (ngSubmit)="addObject()" aria-labelledby="new-object"><h2 id="new-object">New object</h2>
        <div class="lay-row lay-wrap lay-fields"><label>Name<input name="newName" [(ngModel)]="newObject.name" placeholder="BorrowRequest" class="lay-mono"></label>
          <label>Description<input name="newDescription" [(ngModel)]="newObject.description" placeholder="Someone asking to borrow a tool for some dates"></label></div>
        <button type="submit" class="lay-button small">Add object</button>
      </form>
    }
  }`
})
export class DataLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly tabs = [['objects', 'Objects'], ['api', 'API'], ['access', 'Access']];
  readonly dataStatusLabel = dataStatusLabel;
  readonly effectLabel = effectLabel;
  readonly effects = Object.entries(effectLabel);
  readonly fieldTypes = fieldTypes;
  readonly methods = methods;
  readonly tab = computed(() => this.ctx.segments()[1] || 'objects');
  readonly objects = computed(() => this.ctx.data()?.objects || []);
  readonly operations = computed(() => this.ctx.data()?.operations || []);
  readonly object = computed(() => this.tab() === 'objects' ? this.ctx.objectById().get(this.ctx.segments()[2]) || this.objects()[0] || null : null);
  readonly operation = computed(() => this.tab() === 'api' ? this.ctx.operationById().get(this.ctx.segments()[2]) || this.operations()[0] || null : null);
  readonly groups = computed(() => {
    const byGroup = new Map<string, DataOperation[]>();
    for (const op of this.operations()) { const name = (op.objectId && this.ctx.objectById().get(op.objectId)?.name) || 'General'; byGroup.set(name, [...(byGroup.get(name) || []), op]); }
    return [...byGroup.entries()].map(([name, operations]) => ({ name, operations }));
  });
  // A plain grid: four across, lines between related boxes. Good enough to read a dozen objects; a layout engine can come later.
  readonly layout = computed(() => this.objects().map((object, index) => ({ object, x: (index % 4) * (box.width + box.gapX) + 8, y: Math.floor(index / 4) * (box.height + box.gapY) + 8 })));
  readonly mapSize = computed(() => { const count = this.objects().length; return { width: Math.min(count, 4) * (box.width + box.gapX) - box.gapX + 16, height: Math.ceil(count / 4) * (box.height + box.gapY) - box.gapY + 16 }; });
  readonly edges = computed(() => {
    const at = new Map(this.layout().map(entry => [entry.object.id, entry]));
    return this.objects().flatMap(object => object.relations.filter(relation => at.has(relation.target)).map(relation => {
      const from = at.get(object.id)!; const to = at.get(relation.target)!;
      return { key: `${object.id}:${relation.name}`, x1: from.x + box.width / 2, y1: from.y + box.height / 2, x2: to.x + box.width / 2, y2: to.y + box.height / 2 };
    }));
  });
  readonly roles = computed(() => { const order = ['visitor', 'member', 'owner', 'admin']; return [...new Set((this.ctx.data()?.access || []).map(rule => rule.role))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b)); });
  readonly accessRows = computed(() => {
    const rows = new Map<string, { key: string; objectId: string; action: string; cells: Record<string, AccessRule>; rules: AccessRule[] }>();
    for (const rule of this.ctx.data()?.access || []) {
      const key = `${rule.objectId}:${rule.action}`;
      const row = rows.get(key) || { key, objectId: rule.objectId, action: rule.action, cells: {}, rules: [] };
      row.cells[rule.role] = rule; row.rules.push(rule); rows.set(key, row);
    }
    return [...rows.values()];
  });

  rationale = '';
  newObject = { name: '', description: '' };
  field = { name: '', type: 'string', format: '', note: '', required: false };
  relation = { name: '', target: '', cardinality: 'one', owner: false };
  newOp = { operationId: '', method: 'GET', path: '', objectId: '', summary: '' };
  newRule = { role: 'member', objectId: '', action: 'read', effect: 'allow', sentence: '' };
  objectDraft = { description: '', states: '' };
  private draftFor = '';

  ngDoCheck() {
    const current = this.object();
    if (current && `${current.id}:${current.revision}` !== this.draftFor) { this.draftFor = `${current.id}:${current.revision}`; this.objectDraft = { description: current.description, states: current.states.join('\n') }; this.rationale = ''; }
  }

  statusClass(status: string) { return status === 'built' || status === 'shipped' ? 'lay-ok' : status === 'contracted' ? 'lay-l-data' : 'lay-plain'; }
  typeOf(schema: JsonSchema | null | undefined): string {
    if (!schema) return '';
    if (schema.$ref) return this.ctx.objectById().get(schema.$ref)?.name || 'object';
    const type = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type || '';
    return type === 'array' ? `array of ${this.typeOf(schema.items)}` : type;
  }
  fields(object: DataObject) {
    return Object.entries(object.schema.properties || {}).map(([name, schema]) => ({ name, type: this.typeOf(schema),
      rules: [object.schema.required?.includes(name) ? 'required' : '', schema.format ? `format: ${schema.format}` : '', schema.maxLength ? `max ${schema.maxLength}` : '', schema.minLength ? `min ${schema.minLength}` : '',
        schema.enum?.length ? `one of: ${schema.enum.join(', ')}` : '', schema.readOnly ? 'read-only' : '', schema.writeOnly ? 'write-only' : ''].filter(Boolean).join(' · '), note: schema.description || '' }));
  }
  fieldSummary(schema: JsonSchema) { return Object.entries(schema.properties || {}).map(([name, value]) => `${name} (${this.typeOf(value)}${schema.required?.includes(name) ? ', required' : ''})`).join(', ') || this.typeOf(schema); }
  incoming(object: DataObject) { return this.objects().flatMap(other => other.relations.filter(relation => relation.target === object.id).map(relation => ({ key: `${other.id}:${relation.name}`, from: other.name, name: relation.name }))); }
  specsFor(object: DataObject) { return (this.ctx.data()?.specs || []).filter(spec => object.specs.includes(spec.id) || spec.entities.some(entity => entity.split(' (')[0].trim() === object.name)); }
  operationsFor(object: DataObject) { return this.operations().filter(op => op.objectId === object.id); }
  schemaDocument(object: DataObject) {
    const resolve = (node: unknown): unknown => JSON.parse(JSON.stringify(node), (key, value) => key === '$ref' ? `#/components/schemas/${this.ctx.objectById().get(value)?.name || value}` : value);
    return { $schema: 'https://json-schema.org/draft/2020-12/schema', title: object.name, ...(object.description ? { description: object.description } : {}), ...(resolve(object.schema) as object) };
  }
  // Illustrative values from the schema: enough to read the shape, never real data.
  example(schema: JsonSchema | null | undefined, depth = 0): unknown {
    if (!schema || depth > 4) return null;
    if (schema.$ref) { const object = this.ctx.objectById().get(schema.$ref); return object ? this.example(object.schema, depth + 1) : {}; }
    const type = Array.isArray(schema.type) ? schema.type.find(item => item !== 'null') : schema.type;
    if (schema.enum?.length) return schema.enum[0];
    if (type === 'object') return Object.fromEntries(Object.entries(schema.properties || {}).filter(([, value]) => !value.writeOnly || depth === 0).map(([name, value]) => [name, this.example(value, depth + 1)]));
    if (type === 'array') return [this.example(schema.items, depth + 1)];
    if (type === 'integer' || type === 'number') return 1;
    if (type === 'boolean') return true;
    return schema.format === 'email' ? 'sam@example.com' : schema.format === 'date-time' ? '2026-09-22T10:00:00Z' : schema.format === 'date' ? '2026-09-22' : schema.writeOnly ? '••••••••' : 'text';
  }
  exampleRequest(op: DataOperation) {
    const query = op.parameters.filter(param => param.in === 'query').map(param => `${param.name}=${String(this.example(param.schema))}`).join('&');
    const line = `${op.method} ${op.path.replace(/\{(\w+)\}/g, '5c1f')}${query ? `?${query}` : ''}`;
    return op.request ? `${line}\ncontent-type: application/json\n\n${this.json(this.example(op.request))}` : line;
  }
  json(value: unknown) { return JSON.stringify(value, null, 2); }
  openApiHref() { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/openapi.json`; }

  addObject() {
    void this.ctx.write(async () => {
      const created = await this.ctx.record('data_object', { name: this.newObject.name.trim(), description: this.newObject.description, schema: { type: 'object', properties: {} } }) as DataObject;
      this.newObject = { name: '', description: '' };
      this.ctx.go(this.ctx.link('data', 'objects', created.id));
    }, 'Object added. It is proposed until you accept its contract.');
  }
  addField(object: DataObject) {
    const name = this.field.name.trim();
    const property: JsonSchema = { type: this.field.type, ...(this.field.format.trim() ? { format: this.field.format.trim() } : {}), ...(this.field.note.trim() ? { description: this.field.note.trim() } : {}), ...(this.field.type === 'array' ? { items: { type: 'string' } } : {}) };
    const schema = { ...object.schema, properties: { ...object.schema.properties, [name]: property }, required: this.field.required ? [...(object.schema.required || []), name] : object.schema.required || [] };
    void this.ctx.write(async () => { await this.ctx.change(object.id, { schema }, object.revision, this.rationale || `Added the ${name} field`); this.field = { name: '', type: 'string', format: '', note: '', required: false }; }, `Added ${name}.`);
  }
  removeField(object: DataObject, name: string) {
    const properties = { ...object.schema.properties }; delete properties[name];
    void this.ctx.write(() => this.ctx.change(object.id, { schema: { ...object.schema, properties, required: (object.schema.required || []).filter(item => item !== name) } }, object.revision, this.rationale || `Removed the ${name} field`), `Removed ${name}.`);
  }
  addRelation(object: DataObject) {
    const relation = { name: this.relation.name.trim(), target: this.relation.target, cardinality: this.relation.cardinality, owner: this.relation.owner };
    void this.ctx.write(async () => { await this.ctx.change(object.id, { relations: [...object.relations, relation] }, object.revision, this.rationale || `Relates to ${this.ctx.objectById().get(relation.target)?.name || 'another object'}`); this.relation = { name: '', target: '', cardinality: 'one', owner: false }; }, 'Relationship added.');
  }
  saveObject(object: DataObject) { void this.ctx.write(() => this.ctx.change(object.id, { description: this.objectDraft.description, states: lines(this.objectDraft.states) }, object.revision, this.rationale), 'Saved.'); }
  accept(id: string, name: string) { void this.ctx.write(() => this.ctx.change(id, { contract: 'accepted' }, undefined, this.rationale || 'Contract accepted'), `The ${name} contract is accepted.`); }
  addOperation() {
    void this.ctx.write(async () => {
      const created = await this.ctx.record('data_operation', { ...this.newOp, operationId: this.newOp.operationId.trim(), path: this.newOp.path.trim(), objectId: this.newOp.objectId || null }) as DataOperation;
      this.newOp = { operationId: '', method: 'GET', path: '', objectId: '', summary: '' };
      this.ctx.go(this.ctx.link('data', 'api', created.id));
    }, 'Operation added. It is proposed until you accept its contract.');
  }
  addRule() { void this.ctx.write(async () => { await this.ctx.record('access_rule', this.newRule); this.newRule = { role: 'member', objectId: '', action: 'read', effect: 'allow', sentence: '' }; }, 'Rule added.'); }
  remove(id: string, label: string) { void this.ctx.write(async () => { await this.ctx.delete(id); if (this.tab() !== 'access') this.ctx.go(this.ctx.link('data', this.tab())); }, `Deleted ${label}.`); }
}
