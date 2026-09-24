import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Activity, Claim, Doc, ProjectContext, Scenario, Story, briefSections, lines, phaseName, stateLabel, statusLabel } from './context';
import { BuiltByComponent } from './built-by';
import { EvidenceChipComponent } from './evidence';
import { RefChipComponent } from './work-shared';

// A generated or written document's Markdown, as blocks of text and record mentions ([[id]]) the template renders as chips.
type Inline = { text?: string; ref?: string; strong?: boolean; em?: boolean };
type Block = { tag: 'h1' | 'h2' | 'p' | 'ul'; parts: Inline[]; items?: Inline[][] };
const inline = (value: string): Inline[] => value.split(/(\[\[[a-z]+-[a-z0-9]+\]\]|\*\*[^*]+\*\*|_[^_]+_)/).filter(Boolean).map(part =>
  part.startsWith('[[') ? { ref: part.slice(2, -2) } : part.startsWith('**') ? { text: part.slice(2, -2), strong: true } : /^_[^_]+_$/.test(part) ? { text: part.slice(1, -1), em: true } : { text: part });
export function markdownBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.split(/\n\s*\n/)) {
    const text = chunk.trim(); if (!text) continue;
    if (text.startsWith('# ')) blocks.push({ tag: 'h1', parts: inline(text.slice(2)) });
    else if (text.startsWith('## ')) blocks.push({ tag: 'h2', parts: inline(text.slice(3)) });
    else if (text.split('\n').every(line => line.trim().startsWith('- '))) blocks.push({ tag: 'ul', parts: [], items: text.split('\n').map(line => inline(line.trim().slice(2))) });
    else blocks.push({ tag: 'p', parts: inline(text.replace(/\n/g, ' ')) });
  }
  return blocks;
}

// Vision (ROADMAP-01, DEC-042/043): what we're building, for whom and why. The Brief (Lean Canvas order, one short claim
// at a time, each with its evidence), the story map, and documents about the product. Roadmap and specs moved to Work.
@Component({
  selector: 'aludel-product-layer', standalone: true,
  imports: [FormsModule, NgTemplateOutlet, MatIconModule, BuiltByComponent, EvidenceChipComponent, RefChipComponent],
  template: `
  <p class="lay-eyebrow lay-layer"><mat-icon aria-hidden="true">lightbulb</mat-icon>Vision</p>
  <h1 tabindex="-1">What we're building, and why</h1>
  <nav class="lay-tabs" aria-label="Vision sections">
    @for (entry of tabs; track entry[0]) { <a [href]="ctx.link('product', entry[0])" (click)="ctx.go(ctx.link('product', entry[0]), $event)" [class.active]="tab() === entry[0]" [attr.aria-current]="tab() === entry[0] ? 'page' : null"><mat-icon aria-hidden="true">{{ entry[2] }}</mat-icon>{{ entry[1] }}</a> }
  </nav>

  @switch (tab()) {
    @case ('map') {
      @if (columns().length) {
        <div class="lay-map-wrap" tabindex="0" role="region" aria-label="Story map">
          <div class="lay-storymap" [style.grid-template-columns]="'repeat(' + columns().length + ', 220px)'">
            @for (activity of data().activities; track activity.id; let index = $index) {
              <div class="lay-activity" [style.grid-column]="activityColumn(index)"><span>{{ activity.title }}@if (activity.persona) { <small> · {{ activity.persona }}</small> }</span>
                @if (activity.pack) { <span class="lay-pack">{{ activity.pack }} pack</span> }
                <aludel-evidence [id]="activity.id" />
                <button type="button" class="lay-icon-button" (click)="addStep(activity)" [attr.aria-label]="'Add a step to ' + activity.title"><mat-icon>add</mat-icon></button></div>
            }
            @for (column of columns(); track column.step.id) { <div class="lay-step">{{ column.step.title }}</div> }
            @for (phase of data().phases; track phase.id) {
              <div class="lay-band" [class.current]="phase.current"><span><aludel-ref [id]="phase.id" /> {{ phase.goal }}</span></div>
              @for (column of columns(); track column.step.id; let index = $index) {
                <div class="lay-cell" [style.grid-column]="index + 1">
                  @for (story of storiesIn(column.step.id, phase.key); track story.id) {
                    <div class="lay-story-card" [class.built]="story.status === 'built'" [class.active]="story.id === selectedId()">
                      <a [href]="ctx.link('product', 'map', story.id)" (click)="ctx.go(ctx.link('product', 'map', story.id), $event)">{{ story.title }}</a>
                      <span class="lay-meta"><span class="lay-dot" [style.background]="statusColor[story.status]"></span>{{ statusLabel[story.status] }}@if (story.template) { · template }@if (story.clarifications.length) { · <mat-icon class="lay-inline-icon" aria-label="has open clarifications">help</mat-icon> }</span>
                      <aludel-evidence [id]="story.id" /></div>
                  }
                  @if (adding() === column.step.id + ':' + phase.key) {
                    <form class="lay-add-story" (ngSubmit)="addStory(column.step.id, phase.key)"><label class="visually-hidden" [for]="'new-' + column.step.id + phase.key">New story</label>
                      <input [id]="'new-' + column.step.id + phase.key" name="newStory" [(ngModel)]="newStory" placeholder="Someone can…" maxlength="160"><button type="submit" class="lay-button small" [disabled]="!newStory.trim()">Add</button></form>
                  } @else {
                    <button type="button" class="lay-ghost" (click)="adding.set(column.step.id + ':' + phase.key); newStory = ''" [attr.aria-label]="'Add a ' + phase.label + ' story to ' + column.step.title"><mat-icon aria-hidden="true">add</mat-icon></button>
                  }
                </div>
              }
            }
          </div>
        </div>
      } @else { <div class="lay-card lay-quiet"><h2>No activities yet</h2><p class="lay-muted">A story map starts with the big things people do, left to right. Add one below or pick story packs.</p></div> }
      <form class="lay-row lay-add-activity" (ngSubmit)="addActivity()">
        <label class="visually-hidden" for="new-activity">New activity</label><input id="new-activity" name="newActivity" [(ngModel)]="newActivity" placeholder="New activity, e.g. “Give it back”" maxlength="60">
        <button type="submit" class="lay-button ghost small" [disabled]="!newActivity.trim()"><mat-icon aria-hidden="true">add</mat-icon>Add activity</button>
        <span class="lay-muted">Bands are milestones, set in Work › Projects. Status comes from connected work.</span>
      </form>
      @if (selected(); as story) {
        <aside class="lay-drawer" role="dialog" [attr.aria-labelledby]="'story-' + story.id" tabindex="-1">
          <a class="lay-close" [href]="ctx.link('product', 'map')" (click)="ctx.go(ctx.link('product', 'map'), $event)" aria-label="Close story"><mat-icon>close</mat-icon></a>
          <p class="lay-eyebrow">{{ locate(story) }} · {{ story.ref }}</p>
          <h2 [id]="'story-' + story.id" class="lay-drawer-title">{{ story.title }}</h2>
          <div class="lay-row lay-wrap"><span class="lay-phase" [class.current]="story.phase === currentPhase()">{{ phaseName(story.phase) }}</span><span class="lay-chip lay-plain">{{ statusLabel[story.status] }}</span>
            <aludel-evidence [id]="story.id" [always]="true" /><span class="lay-muted small">{{ story.pack ? story.pack + ' pack' : 'Yours' }}{{ story.template ? ' · template-built' : '' }}</span></div>
          <div class="lay-why"><span class="lay-muted small">Why</span>@if (story.claim) { <aludel-ref [id]="story.claim" /> } @else { <span class="lay-muted small">{{ story.why || 'Not linked to the Brief yet' }}</span> }</div>
          <form class="lay-form" (ngSubmit)="saveStory(story)">
            <label>Story<input name="title" [(ngModel)]="draft.title" maxlength="160"></label>
            <label>Milestone<select name="phase" [(ngModel)]="draft.phase">@for (phase of data().phases; track phase.id) { <option [value]="phase.key">{{ phase.label }}</option> }</select></label>
            <label>Why: the Brief claim it answers<select name="claim" [(ngModel)]="draft.claim"><option value="">None yet</option>
              @for (claim of whyClaims(); track claim.id) { <option [value]="claim.id">{{ claim.text }}</option> }</select></label>
            <fieldset><legend>Acceptance (Given / When / Then)</legend>
              @for (scenario of draft.acceptance; track $index; let i = $index) {
                <div class="lay-gwt-edit"><label>Given<input [name]="'g' + i" [(ngModel)]="scenario.given"></label><label>When<input [name]="'w' + i" [(ngModel)]="scenario.when"></label><label>Then<input [name]="'t' + i" [(ngModel)]="scenario.then"></label>
                  <button type="button" class="lay-link-button" (click)="draft.acceptance.splice(i, 1)">Remove scenario</button></div>
              }
              <button type="button" class="lay-button ghost small" (click)="draft.acceptance.push({ given: '', when: '', then: '' })"><mat-icon aria-hidden="true">add</mat-icon>Add scenario</button>
            </fieldset>
            <label>Edge cases (one per line)<textarea name="edges" rows="2" [(ngModel)]="draft.edges"></textarea></label>
            <label>Open clarifications (one per line)<textarea name="clarifications" rows="2" [(ngModel)]="draft.clarifications"></textarea></label>
            <label>Why this change (saved with the revision)<input name="rationale" [(ngModel)]="draft.rationale" maxlength="400"></label>
            <div class="lay-row"><button type="submit" class="lay-button">Save story</button><button type="button" class="lay-link-button danger" (click)="deleteStory(story)">Delete story</button></div>
          </form>
          <div class="lay-connected">
            <h3>Pages</h3>
            <div class="lay-refs">@for (pageId of story.pages; track pageId) { <aludel-ref [id]="pageId" /> } @empty { <p class="lay-muted">Not placed on a page yet.</p> }</div>
            <h3>Project</h3>
            <div class="lay-refs">@for (project of projectsFor(story); track project.id) { <aludel-ref [id]="project.id" /> } @empty { <p class="lay-muted">Not in a project yet.</p> }</div>
            @if (story.resolved.length) { <h3>Decided</h3><ul class="lay-plain-list small">@for (entry of story.resolved; track $index) { <li>{{ entry.question }} <strong>{{ entry.answer }}</strong> <span class="lay-muted">· {{ entry.work }}</span></li> }</ul> }
            <h3>Built by</h3>
            <aludel-built-by [recordId]="story.id" />
            <h3>Work</h3>
            <div class="lay-refs">@for (item of workFor(story); track item.id) { <aludel-ref [id]="item.id" /> } @empty { <p class="lay-muted">No work yet.</p> }</div>
            <h3>Why it is this way</h3>
            @if (story.history.length) { <div class="lay-history">@for (entry of story.history; track entry.revision) { <p>{{ entry.rationale }}<br><small>Revision {{ entry.revision }} · {{ entry.author }} · {{ entry.createdAt.slice(0, 10) }}</small></p> }</div> }
            @else { <p class="lay-muted">No recorded decisions yet.</p> }
          </div>
        </aside>
      }
    }

    @case ('docs') {
      @if (selectedDoc(); as doc) {
        <p class="lay-eyebrow"><a [href]="ctx.link('product', 'docs')" (click)="ctx.go(ctx.link('product', 'docs'), $event)">Documents</a> · {{ doc.form === 'generated' ? 'Generated' : 'Written' }}</p>
        <div class="lay-row lay-wrap lay-doc-head"><h2 class="lay-flat">{{ doc.title }}</h2>
          <label class="lay-switch lay-push"><input type="checkbox" [checked]="doc.agents" (change)="toggleAgents(doc, $any($event.target).checked)">Agents read this</label>
          @if (doc.form !== 'generated') { <button type="button" class="lay-button ghost small" (click)="editingDoc.set(!editingDoc())"><mat-icon aria-hidden="true">{{ editingDoc() ? 'visibility' : 'edit' }}</mat-icon>{{ editingDoc() ? 'Preview' : 'Edit' }}</button> }</div>
        @if (doc.form === 'generated') {
          @if (stale(doc)) { <div class="lay-stale" role="status"><mat-icon aria-hidden="true">update</mat-icon><span>Generated from Brief revision {{ doc.briefRevision }}. {{ stale(doc) }} Brief change{{ stale(doc) === 1 ? '' : 's' }} since.</span>
            <button type="button" class="lay-button small lay-push" (click)="regenerate(doc)"><mat-icon aria-hidden="true">autorenew</mat-icon>Regenerate</button></div> }
          @else { <div class="lay-fresh" role="status"><mat-icon aria-hidden="true">check_circle</mat-icon>Up to date with Brief revision {{ doc.briefRevision }}.</div> }
        }
        @if (editingDoc() && doc.form !== 'generated') {
          <form class="lay-card lay-form" (ngSubmit)="saveDoc(doc)"><label>Title<input name="title" [(ngModel)]="docDraft.title"></label>
            <label>Document (Markdown; mention a record with [[its id]])<textarea name="body" rows="18" [(ngModel)]="docDraft.body" class="lay-mono"></textarea></label>
            <div class="lay-row"><button type="submit" class="lay-button">Save</button><button type="button" class="lay-link-button danger" (click)="deleteRecord(doc.id, 'docs')">Delete document</button></div></form>
        } @else {
          <article class="lay-card lay-docbody">
            @for (block of blocks(); track $index) {
              @switch (block.tag) {
                @case ('h1') { <h2 class="lay-doc-h1"><ng-container *ngTemplateOutlet="parts; context: { $implicit: block.parts }" /></h2> }
                @case ('h2') { <h3 class="lay-doc-h2"><ng-container *ngTemplateOutlet="parts; context: { $implicit: block.parts }" /></h3> }
                @case ('ul') { <ul>@for (item of block.items; track $index) { <li><ng-container *ngTemplateOutlet="parts; context: { $implicit: item }" /></li> }</ul> }
                @default { <p><ng-container *ngTemplateOutlet="parts; context: { $implicit: block.parts }" /></p> }
              }
            } @empty { <p class="lay-muted">Empty. Edit it to write.</p> }
            @if (doc.form === 'generated') { <button type="button" class="lay-link-button danger" (click)="deleteRecord(doc.id, 'docs')">Delete document</button> }
          </article>
        }
      } @else {
        <div class="lay-row lay-wrap lay-gap-bottom"><span class="lay-muted">Narratives about the product. Generated ones stay tied to the Brief; written ones are yours.</span>
          <span class="lay-push lay-row lay-wrap"><button type="button" class="lay-button ghost small" (click)="generate('prfaq')"><mat-icon aria-hidden="true">auto_awesome</mat-icon>Generate PR/FAQ</button>
            <button type="button" class="lay-button ghost small" (click)="generate('onepager')"><mat-icon aria-hidden="true">auto_awesome</mat-icon>Generate one-pager</button></span></div>
        <div class="lay-doclist">
          @for (doc of visionDocs(); track doc.id) {
            <a class="lay-docrow" [href]="ctx.link('product', 'docs', doc.id)" (click)="ctx.go(ctx.link('product', 'docs', doc.id), $event)"><span class="lay-docicon"><mat-icon aria-hidden="true">{{ doc.form === 'generated' ? 'auto_awesome' : 'description' }}</mat-icon></span>
              <span class="lay-body-text"><strong>{{ doc.title }}</strong><small>{{ doc.form === 'generated' ? 'Generated from the Brief' : 'Written' }} · revision {{ doc.revision }}{{ doc.agents ? ' · agents read this' : '' }}</small></span>
              @if (stale(doc)) { <span class="lay-chip lay-warn"><mat-icon aria-hidden="true">update</mat-icon>{{ stale(doc) }} change{{ stale(doc) === 1 ? '' : 's' }}</span> }</a>
          } @empty { <p class="lay-muted">No documents yet.</p> }
        </div>
        <form class="lay-row lay-add-activity lay-gap-top" (ngSubmit)="createDoc()"><label class="visually-hidden" for="new-doc">New document title</label><input id="new-doc" name="newDoc" [(ngModel)]="newDoc" placeholder="New document, e.g. “Why we exist”" maxlength="120">
          <button type="submit" class="lay-button ghost small" [disabled]="!newDoc.trim()"><mat-icon aria-hidden="true">add</mat-icon>Write a document</button></form>
      }
    }

    @case ('moved') {
      <div class="lay-card lay-quiet"><h2>This moved</h2><p>Milestones, projects and project briefs (which were specs) are in <a [href]="ctx.link('work', 'projects')" (click)="ctx.go(ctx.link('work', 'projects'), $event)">Work › Projects</a>. Research is in the <a [href]="ctx.link('library')" (click)="ctx.go(ctx.link('library'), $event)">Library</a>.</p></div>
    }

    @default {
      <div class="lay-legend lay-gap-bottom" aria-label="Confidence">
        <span><mat-icon aria-hidden="true">help</mat-icon>Assumed <b>{{ confidenceCounts().assumed }}</b></span>
        <span class="lay-ev-sup-text"><mat-icon aria-hidden="true">check_circle</mat-icon>Supported <b>{{ confidenceCounts().supported }}</b></span>
        <span class="lay-ev-con-text"><mat-icon aria-hidden="true">report</mat-icon>Contradicted <b>{{ confidenceCounts().contradicted }}</b></span></div>
      <div class="lay-grid lay-g-side">
        <div class="lay-stackv">
          @for (section of sections; track section.key; let number = $index) {
            @if (section.key === 'business') {
              <details class="lay-card lay-quiet lay-brief-sec" [open]="claimsIn('business').length > 0"><summary><span class="lay-secnum">{{ number + 1 }}</span><strong>{{ section.title }}</strong><span class="lay-chip lay-plain">Optional</span></summary>
                <p class="lay-muted small">{{ section.hint }}</p>
                <ng-container *ngTemplateOutlet="claimList; context: { $implicit: section }" /></details>
            } @else {
              <section class="lay-card lay-brief-sec" [attr.aria-labelledby]="'brief-' + section.key">
                <div class="lay-row"><h2 [id]="'brief-' + section.key" class="lay-flat"><span class="lay-secnum">{{ number + 1 }}</span>{{ section.title }}</h2>
                  <button type="button" class="lay-button ghost small lay-push" (click)="draftSection(section.key, section.title)"><mat-icon aria-hidden="true">auto_awesome</mat-icon>Draft</button></div>
                <p class="lay-muted small">{{ section.hint }}</p>
                @if (section.key === 'customers') {
                  <div class="lay-row lay-wrap lay-personas-row"><span class="lay-muted small">Personas</span>
                    @for (persona of data().personas; track persona.id) { <span class="lay-persona-chip"><span class="lay-avatar lay-avatar-product" aria-hidden="true">{{ persona.name[0] }}</span>{{ persona.name }}{{ persona.role ? ' · ' + persona.role : '' }}
                      <button type="button" class="lay-icon-inline" (click)="deleteRecord(persona.id)" [attr.aria-label]="'Remove ' + persona.name"><mat-icon aria-hidden="true">close</mat-icon></button></span> }
                    <form class="lay-row lay-persona-form" (ngSubmit)="addPersona()"><label class="visually-hidden" for="persona-name">Persona name</label><input id="persona-name" name="pname" [(ngModel)]="persona.name" placeholder="Name" maxlength="60">
                      <label class="visually-hidden" for="persona-role">Persona role</label><input id="persona-role" name="prole" [(ngModel)]="persona.role" placeholder="Role" maxlength="60">
                      <button type="submit" class="lay-button ghost small" [disabled]="!persona.name.trim()"><mat-icon aria-hidden="true">add</mat-icon>Persona</button></form></div>
                }
                <ng-container *ngTemplateOutlet="claimList; context: { $implicit: section }" />
              </section>
            }
          }
        </div>
        <aside class="lay-stackv lay-sticky" aria-label="Riskiest assumptions">
          <section class="lay-card"><h2 class="lay-row"><mat-icon aria-hidden="true">crisis_alert</mat-icon>Riskiest assumptions</h2>
            <p class="lay-muted small">Unproven or contradicted claims in Problem, Customers, Diagnosis and Value. Test these before building much.</p>
            <ol class="lay-risk">
              @for (claim of risky(); track claim.id) { <li><div><p>{{ claim.text }}</p><div class="lay-row lay-wrap"><aludel-evidence [id]="claim.id" [claim]="true" />
                <button type="button" class="lay-button ghost small" (click)="testClaim(claim)"><mat-icon aria-hidden="true">science</mat-icon>Test this</button></div></div></li> }
              @empty { <li class="lay-muted">Nothing unproven.</li> }
            </ol>
          </section>
        </aside>
      </div>
    }
  }

  <ng-template #claimList let-section>
    <ul class="lay-claims">
      @for (claim of claimsIn(section.key); track claim.id) {
        <li class="lay-claim" [id]="'claim-' + claim.id" [class.lay-flash]="claim.id === focusClaim()">
          @if (editing() === claim.id) {
            <form class="lay-row lay-claim-edit" (ngSubmit)="saveClaim(claim)"><label class="visually-hidden" [for]="'edit-' + claim.id">Claim</label><input [id]="'edit-' + claim.id" name="text" [(ngModel)]="claimDraft" maxlength="400">
              <button type="submit" class="lay-button small">Save</button><button type="button" class="lay-link-button" (click)="editing.set('')">Cancel</button></form>
          } @else {
            <div class="lay-claim-text"><p [class.lay-statement]="section.key === 'value'">{{ claim.text }}</p>@if (claim.note) { <small>{{ claim.note }}</small> }
              @if (section.key === 'problem') { <div class="lay-refs lay-claim-stories">@for (story of storiesFor(claim); track story.id) { <aludel-ref [id]="story.id" [short]="true" /> } @empty { <small class="lay-none">No stories answer this yet</small> }</div> }</div>
            <span class="lay-claim-tools"><aludel-evidence [id]="claim.id" [claim]="section.key !== 'principles'" />
              <button type="button" class="lay-icon-inline" (click)="editClaim(claim)" [attr.aria-label]="'Edit: ' + claim.text"><mat-icon aria-hidden="true">edit</mat-icon></button>
              <button type="button" class="lay-icon-inline" (click)="deleteRecord(claim.id)" [attr.aria-label]="'Delete: ' + claim.text"><mat-icon aria-hidden="true">delete</mat-icon></button></span>
          }
        </li>
      }
    </ul>
    <form class="lay-row lay-claim-add" (ngSubmit)="addClaim(section.key)"><label class="visually-hidden" [for]="'add-' + section.key">Add to {{ section.title }}</label>
      <input [id]="'add-' + section.key" [name]="'add-' + section.key" [(ngModel)]="newClaims[section.key]" [placeholder]="section.key === 'principles' ? 'Add a principle…' : 'Add a claim…'" maxlength="400">
      <button type="submit" class="lay-button ghost small" [disabled]="!(newClaims[section.key] || '').trim()"><mat-icon aria-hidden="true">add</mat-icon>Add</button></form>
  </ng-template>
  <ng-template #parts let-parts>@for (part of parts; track $index) { @if (part.ref) { <aludel-ref [id]="part.ref" [short]="true" /> } @else if (part.strong) { <strong>{{ part.text }}</strong> } @else if (part.em) { <em>{{ part.text }}</em> } @else { {{ part.text }} } }</ng-template>`
})
export class ProductLayerComponent {
  readonly ctx = inject(ProjectContext);
  readonly tabs = [['brief', 'Brief', 'fact_check'], ['map', 'Story map', 'bookmark'], ['docs', 'Documents', 'description']];
  readonly sections = briefSections;
  readonly statusLabel = statusLabel;
  readonly stateLabel = stateLabel;
  readonly phaseName = phaseName;
  readonly statusColor: Record<string, string> = { proposed: '#c1c8d8', defined: '#8e9ad0', designed: '#d9708f', built: '#3047b9', shipped: '#146446' };
  readonly data = computed(() => this.ctx.data()!);
  // Old tabs: vision is the Brief; specs, roadmap and research moved (ROADMAP-01).
  readonly tab = computed(() => { const tab = this.ctx.segments()[1] || 'brief'; return tab === 'vision' ? 'brief' : ['specs', 'roadmap', 'research'].includes(tab) ? 'moved' : tab; });
  readonly selectedId = computed(() => this.tab() === 'map' ? this.ctx.segments()[2] || '' : '');
  readonly selected = computed(() => this.ctx.storyById().get(this.selectedId()) || null);
  // DESIGN-UX-01: documents live in the Library; Vision lists the ones that show here.
  readonly visionDocs = computed(() => this.data().docs.filter(doc => (doc.showsIn || ['product']).includes('product')));
  readonly selectedDoc = computed(() => this.tab() === 'docs' ? this.data().docs.find(doc => doc.id === this.ctx.segments()[2]) || null : null);
  readonly focusClaim = computed(() => this.tab() === 'brief' ? this.ctx.segments()[2] || '' : '');
  readonly blocks = computed(() => markdownBlocks(this.selectedDoc()?.body || ''));
  readonly currentPhase = computed(() => this.data().phases.find(phase => phase.current)?.key || 'demo');
  readonly columns = computed(() => this.data().activities.flatMap(activity => activity.steps.map(step => ({ activity, step }))));
  readonly whyClaims = computed(() => { const claims = this.data().claims; return [...claims.filter(claim => claim.section === 'problem'), ...claims.filter(claim => claim.section !== 'problem' && claim.section !== 'principles')]; });
  readonly risky = computed(() => this.data().claims.filter(claim => ['problem', 'customers', 'diagnosis', 'value'].includes(claim.section) && this.ctx.confidence(claim.id) !== 'supported')
    .sort((a, b) => (this.ctx.confidence(a.id) === 'contradicted' ? 0 : 1) - (this.ctx.confidence(b.id) === 'contradicted' ? 0 : 1) || this.sections.findIndex(section => section.key === a.section) - this.sections.findIndex(section => section.key === b.section)));
  readonly confidenceCounts = computed(() => { const counts = { assumed: 0, supported: 0, contradicted: 0 } as Record<string, number>; for (const claim of this.data().claims.filter(entry => entry.section !== 'principles')) counts[this.ctx.confidence(claim.id)]++; return counts; });
  readonly adding = signal('');
  readonly editing = signal('');
  readonly editingDoc = signal(false);
  private draftFor = '';
  private docDraftFor = '';
  newStory = ''; newActivity = ''; newDoc = ''; claimDraft = '';
  newClaims: Record<string, string> = {};
  draft = { title: '', phase: 'demo', claim: '', acceptance: [] as Scenario[], edges: '', clarifications: '', rationale: '' };
  persona = { name: '', role: '' };
  docDraft = { title: '', body: '' };

  constructor() { queueMicrotask(() => this.syncDrafts()); }
  ngDoCheck() { this.syncDrafts(); }
  // Drafts load when a record opens, never while someone is typing into them.
  private syncDrafts() {
    const story = this.selected();
    if (story && `${story.id}:${story.revision}` !== this.draftFor) {
      this.draftFor = `${story.id}:${story.revision}`;
      this.draft = { title: story.title, phase: story.phase, claim: story.claim || '', acceptance: story.acceptance.map(item => ({ ...item })), edges: story.edges.join('\n'), clarifications: story.clarifications.join('\n'), rationale: '' };
    }
    const doc = this.selectedDoc();
    if (doc && `${doc.id}:${doc.revision}` !== this.docDraftFor) { this.docDraftFor = `${doc.id}:${doc.revision}`; this.docDraft = { title: doc.title, body: doc.body }; if (!doc.body.trim() && doc.form !== 'generated') this.editingDoc.set(true); }
    if (this.focusClaim()) queueMicrotask(() => document.getElementById('claim-' + this.focusClaim())?.scrollIntoView({ block: 'center' }));
  }

  claimsIn(section: string) { return this.data().claims.filter(claim => claim.section === section); }
  storiesFor(claim: Claim) { return this.data().stories.filter(story => story.claim === claim.id); }
  stale(doc: Doc) { return doc.form === 'generated' ? Math.max(0, this.data().briefRevision - (doc.briefRevision || 0)) : 0; }
  activityColumn(index: number) {
    const before = this.data().activities.slice(0, index).reduce((sum, activity) => sum + Math.max(1, activity.steps.length), 0);
    return `${before + 1} / span ${Math.max(1, this.data().activities[index].steps.length)}`;
  }
  storiesIn(stepId: string, phase: string) { const step = this.columns().find(column => column.step.id === stepId)?.step; return (step?.stories || []).map(id => this.ctx.storyById().get(id)!).filter(story => story && story.phase === phase); }
  locate(story: Story) { const column = this.columns().find(item => item.step.id === story.parentId); return column ? `${column.activity.title} › ${column.step.title}` : 'Story'; }
  projectsFor(story: Story) { return this.data().projects.filter(project => project.stories.includes(story.id)); }
  workFor(story: Story) { return this.data().work.filter(item => item.targets.some(target => target.id === story.id)); }

  addClaim(section: string) {
    const text = (this.newClaims[section] || '').trim(); if (!text) return;
    void this.ctx.write(async () => { await this.ctx.record('brief_claim', { section, text }, null, 'Added to the Brief'); this.newClaims[section] = ''; }, 'Added. It is an assumption until evidence is attached.');
  }
  editClaim(claim: Claim) { this.editing.set(claim.id); this.claimDraft = claim.text; setTimeout(() => document.getElementById('edit-' + claim.id)?.focus()); }
  saveClaim(claim: Claim) {
    const text = this.claimDraft.trim(); if (!text) return;
    void this.ctx.write(async () => { await this.ctx.change(claim.id, { text }, claim.revision); this.editing.set(''); }, 'Saved. Generated documents now show a Brief change.');
  }
  // Draft and Test create ordinary work items for the Vision role's actions; nothing runs until someone takes them.
  draftSection(section: string, title: string) {
    void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work`, 'POST', { action: 'product.brief', title: `Draft Brief claims: ${title}`, targets: [], documents: [`Vision › Brief › ${title}`], state: 'suggested' }), `A “Change the Brief” item for ${title} is in the backlog.`);
  }
  testClaim(claim: Claim) {
    void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work`, 'POST', { action: 'product.research', title: `Test: ${claim.text}`.slice(0, 160), targets: [{ id: claim.id }], documents: ['Library › evidence for or against the claim'], state: 'suggested' }),
      'A research item to test it is in the backlog.');
  }
  addPersona() {
    void this.ctx.write(async () => { await this.ctx.record('persona', { name: this.persona.name, role: this.persona.role, note: '' }); this.persona = { name: '', role: '' }; }, 'Persona added.');
  }
  addActivity() {
    const title = this.newActivity.trim(); if (!title) return;
    void this.ctx.write(async () => { const activity = await this.ctx.record('activity', { title, persona: '' }) as Activity; await this.ctx.record('step', { title: 'First step' }, activity.id); this.newActivity = ''; }, `Added “${title}”. Rename its first step on the map.`);
  }
  addStep(activity: Activity) { void this.ctx.write(() => this.ctx.record('step', { title: `Step ${activity.steps.length + 1}` }, activity.id), 'Step added.'); }
  addStory(stepId: string, phase: string) {
    const title = this.newStory.trim(); if (!title) return;
    void this.ctx.write(async () => { await this.ctx.record('story', { title, phase }, stepId); this.adding.set(''); this.newStory = ''; }, 'Story added.');
  }
  saveStory(story: Story) {
    const data = { title: this.draft.title, phase: this.draft.phase, claim: this.draft.claim || null, acceptance: this.draft.acceptance, edges: lines(this.draft.edges), clarifications: lines(this.draft.clarifications) };
    void this.ctx.write(() => this.ctx.change(story.id, data, story.revision, this.draft.rationale), 'Story saved.');
  }
  deleteStory(story: Story) { void this.ctx.write(async () => { await this.ctx.delete(story.id); this.ctx.go(this.ctx.link('product', 'map')); }, 'Story deleted.'); }
  generate(generator: string) { void this.ctx.write(async () => { const doc = await this.ctx.generate(generator); this.ctx.go(this.ctx.link('product', 'docs', doc.id)); }, 'Generated from the Brief.'); }
  regenerate(doc: Doc) { void this.ctx.write(() => this.ctx.generate(doc.generator || '', doc.id), 'Regenerated from the latest Brief. The earlier version is kept as a revision.'); }
  toggleAgents(doc: Doc, agents: boolean) { void this.ctx.write(() => this.ctx.change(doc.id, { agents }, doc.revision), agents ? 'Agents now read this document.' : 'Agents no longer read this document.'); }
  createDoc() {
    const title = this.newDoc.trim(); if (!title) return;
    void this.ctx.write(async () => { const doc = await this.ctx.record('doc', { title, body: '' }) as { id: string }; this.newDoc = ''; this.editingDoc.set(true); this.ctx.go(this.ctx.link('product', 'docs', doc.id)); }, 'Document created.');
  }
  saveDoc(doc: Doc) { void this.ctx.write(async () => { await this.ctx.change(doc.id, { ...this.docDraft }, doc.revision); this.editingDoc.set(false); }, 'Document saved.'); }
  deleteRecord(id: string, backTo = '') { void this.ctx.write(async () => { await this.ctx.delete(id); if (backTo) this.ctx.go(this.ctx.link('product', backTo)); }, 'Deleted.'); }
}
