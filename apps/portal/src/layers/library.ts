import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Finding, Insight, ProjectContext, Source, layerLabel, sourceTypeIcon } from './context';
import { FindingComponent } from './evidence';
import { RefChipComponent } from './work-shared';

type Segment = { text: string; finding?: Finding };
const layerOf: Record<string, string> = { brief_claim: 'product', persona: 'product', activity: 'product', story: 'product', page: 'pages', data_object: 'data', data_operation: 'data', project: 'work' };

// Library (ROADMAP-01, DEC-042/043): everything learned, as atomic research. Sources hold the raw material; findings are
// passages highlighted in them (or facts and data noted from them); insights interpret findings and are attached as
// evidence to records in every layer. A utility beside Settings, not a layer.
@Component({
  selector: 'aludel-library', standalone: true, imports: [FormsModule, MatIconModule, RefChipComponent, FindingComponent],
  template: `
  @switch (view()) {
    @case ('insight') {
      @if (insight(); as i) {
        <p class="lay-eyebrow lay-layer"><mat-icon aria-hidden="true">local_library</mat-icon><a [href]="ctx.link('library')" (click)="ctx.go(ctx.link('library'), $event)">Library</a> · Insight</p>
        <h1 class="visually-hidden" tabindex="-1">{{ i.text }}</h1>
        <label class="visually-hidden" for="insight-text">Insight</label>
        <input class="lay-insight-title" id="insight-text" [value]="i.text" (change)="saveInsight(i, { text: $any($event.target).value })" maxlength="300">
        <div class="lay-row lay-wrap lay-gap-bottom">
          <label class="lay-inline-label">Strength <select (change)="saveInsight(i, { strength: $any($event.target).value })">@for (level of strengths; track level) { <option [value]="level" [selected]="level === i.strength">{{ level }}</option> }</select></label>
          @for (tag of i.tags; track tag) { <span class="lay-itag">{{ tag }}<button type="button" (click)="saveInsight(i, { tags: i.tags.filter(entry => entry !== tag) })" [attr.aria-label]="'Remove tag ' + tag"><mat-icon aria-hidden="true">close</mat-icon></button></span> }
          <form class="lay-row" (ngSubmit)="addTag(i)"><label class="visually-hidden" for="new-tag">Add tag</label><input id="new-tag" name="tag" class="lay-tag-input" [(ngModel)]="newTag" placeholder="Add tag" maxlength="40"></form>
          <button type="button" class="lay-link-button danger lay-push" (click)="deleteInsight(i)">Delete insight</button>
        </div>
        <div class="lay-grid lay-g-side">
          <div class="lay-stackv">
            <section class="lay-card" aria-labelledby="findings-title"><h2 id="findings-title" class="lay-row"><mat-icon aria-hidden="true">format_quote</mat-icon>Findings <span class="lay-count">{{ i.findings.length }}</span></h2>
              @for (id of i.findings; track id) { <div class="lay-frow"><aludel-finding [id]="id" /><button type="button" class="lay-icon-inline" (click)="saveInsight(i, { findings: i.findings.filter(entry => entry !== id) })" [attr.aria-label]="'Remove this finding from the insight'"><mat-icon aria-hidden="true">link_off</mat-icon></button></div> }
              @empty { <p class="lay-muted">No findings yet. Add some below, or highlight a passage in a source.</p> }
              <details class="lay-gap-top"><summary class="lay-link-summary">Add findings</summary>
                <form class="lay-fpick" (ngSubmit)="addFindings(i)">
                  @for (finding of freeFindings(); track finding.id) { <label><input type="checkbox" [checked]="picked().has(finding.id)" (change)="pick(finding.id)"><span>{{ finding.text }} <small class="lay-muted">· {{ ctx.sourceById().get(finding.sourceId)?.title }}</small></span></label> }
                  @empty { <p class="lay-muted small">Every finding is already here.</p> }
                  <div class="lay-row"><button type="submit" class="lay-button small" [disabled]="!picked().size">Add selected</button>
                    <a class="lay-push" [href]="ctx.link('library', 'sources')" (click)="ctx.go(ctx.link('library', 'sources'), $event)">Or highlight in a source</a></div>
                </form></details>
            </section>
            <section class="lay-card" aria-labelledby="comments-title"><h2 id="comments-title" class="lay-row"><mat-icon aria-hidden="true">chat_bubble</mat-icon>Comments <span class="lay-count">{{ i.comments.length }}</span></h2>
              @for (comment of i.comments; track $index) { <div class="lay-icomment"><span class="lay-avatar" aria-hidden="true">{{ comment.by[0] }}</span><div><small><strong>{{ comment.by }}</strong> · {{ comment.at.slice(0, 10) }}</small><p>{{ comment.text }}</p></div></div> }
              <form class="lay-form" (ngSubmit)="comment(i)"><label class="visually-hidden" for="new-comment">Comment</label><textarea id="new-comment" name="comment" rows="2" [(ngModel)]="newComment" placeholder="Add a comment" maxlength="2000"></textarea>
                <button type="submit" class="lay-button small" [disabled]="!newComment.trim()">Comment</button></form>
            </section>
          </div>
          <aside class="lay-stackv lay-sticky" aria-label="Where it is used">
            <section class="lay-card"><h2 class="lay-row"><mat-icon aria-hidden="true">link</mat-icon>Used in <span class="lay-count">{{ ctx.usedIn(i.id).length }}</span></h2>
              <div class="lay-stackv lay-tight">@for (link of ctx.usedIn(i.id); track link.id) { <div class="lay-row lay-wrap"><aludel-ref [id]="link.recordId" />@if (link.direction === 'contradicts') { <span class="lay-chip lay-bad">Contradicts</span> }</div> }
                @empty { <p class="lay-muted small">Not used yet. Attach it from any record's evidence chip.</p> }</div>
            </section>
          </aside>
        </div>
      } @else { <h1 tabindex="-1">Insight not found</h1><p><a [href]="ctx.link('library')" (click)="ctx.go(ctx.link('library'), $event)">Back to the Library</a></p> }
    }

    @case ('source') {
      @if (source(); as s) {
        <p class="lay-eyebrow lay-layer"><mat-icon aria-hidden="true">local_library</mat-icon><a [href]="ctx.link('library', 'sources')" (click)="ctx.go(ctx.link('library', 'sources'), $event)">Library</a> · {{ s.type }}</p>
        <h1 tabindex="-1">{{ s.title }}</h1>
        <p class="lay-muted">{{ meta(s) }}@if (s.url) { · <a [href]="s.url" target="_blank" rel="noopener noreferrer">{{ s.url }}</a> }</p>
        <div class="lay-grid lay-g-side">
          <div class="lay-srcmain">
            @if (s.body.trim()) {
              <p class="lay-muted small">Select a passage to make it a finding. Highlighted passages are findings already.</p>
              <div class="lay-transcript" #transcript (mouseup)="selected()" (keyup)="selected()">
                @for (paragraph of paragraphs(); track $index) {
                  <p>@if (paragraph.speaker) { <span class="lay-speaker">{{ paragraph.speaker }}</span> }<span>@for (segment of paragraph.segments; track $index) { @if (segment.finding) { <mark [attr.title]="segment.finding.text">{{ segment.text }}</mark> } @else { {{ segment.text }} } }</span></p>
                }
              </div>
              @if (selection()) { <div class="lay-selpop" [style.top.px]="selection()!.top" [style.left.px]="selection()!.left"><button type="button" (mousedown)="$event.preventDefault()" (click)="startFinding(selection()!.text)"><mat-icon aria-hidden="true">format_ink_highlighter</mat-icon>Make finding</button></div> }
            } @else { <div class="lay-card lay-quiet"><p class="lay-muted">No text on this source. Add findings on the right: quotes, facts or data.</p></div> }
          </div>
          <aside class="lay-stackv lay-sticky" aria-label="Findings">
            <section class="lay-card"><h2>Findings <span class="lay-count">{{ sourceFindings().length }}</span></h2>
              <form class="lay-newfind" (ngSubmit)="saveFinding(s)">
                <label>Finding<textarea name="ftext" rows="3" [(ngModel)]="finding.text" placeholder="A quote, a fact, or what a chart shows" maxlength="2000"></textarea></label>
                <div class="lay-row lay-wrap"><label class="lay-inline-label">Type <select name="ftype" [(ngModel)]="finding.type"><option value="quote">Quote</option><option value="fact">Fact</option><option value="data">Data</option></select></label></div>
                @if (finding.type === 'data') { <label>Data (one “label, number” per line)<textarea name="fdata" rows="3" [(ngModel)]="finding.data" placeholder="10 min, 18"></textarea></label> }
                <label>Add to insight<select name="finsight" [(ngModel)]="finding.insight"><option value="">No insight yet</option>@for (option of ctx.data()?.insights || []; track option.id) { <option [value]="option.id">{{ option.text }}</option> }<option value="new">New insight…</option></select></label>
                @if (finding.insight === 'new') { <label>New insight<input name="fnew" [(ngModel)]="finding.newInsight" placeholder="What this tells us, in one sentence" maxlength="300"></label> }
                <button type="submit" class="lay-button small" [disabled]="!finding.text.trim()">Save finding</button>
              </form>
              @for (f of sourceFindings(); track f.id) { <div class="lay-frow lay-frow-stack"><aludel-finding [id]="f.id" [showSource]="false" />
                <span class="lay-refs">@for (i of insightsWith(f.id); track i.id) { <aludel-ref [id]="i.id" /> } @empty { <small class="lay-muted">Not in an insight yet</small> }
                  <button type="button" class="lay-icon-inline" (click)="remove(f.id)" aria-label="Delete this finding"><mat-icon aria-hidden="true">delete</mat-icon></button></span></div> }
            </section>
            <button type="button" class="lay-link-button danger" (click)="deleteSource(s)">Delete source and its findings</button>
          </aside>
        </div>
      } @else { <h1 tabindex="-1">Source not found</h1><p><a [href]="ctx.link('library', 'sources')" (click)="ctx.go(ctx.link('library', 'sources'), $event)">Back to sources</a></p> }
    }

    @default {
      <p class="lay-eyebrow lay-layer"><mat-icon aria-hidden="true">local_library</mat-icon>Library</p>
      <h1 tabindex="-1">Library</h1>
      <p class="lay-lead">What we've learned: sources, the findings in them, and the insights they support.</p>
      <nav class="lay-tabs" aria-label="Library sections">
        <a [href]="ctx.link('library')" (click)="ctx.go(ctx.link('library'), $event)" [class.active]="view() === 'insights'" [attr.aria-current]="view() === 'insights' ? 'page' : null"><mat-icon aria-hidden="true">insights</mat-icon>Insights</a>
        <a [href]="ctx.link('library', 'sources')" (click)="ctx.go(ctx.link('library', 'sources'), $event)" [class.active]="view() === 'sources'" [attr.aria-current]="view() === 'sources' ? 'page' : null"><mat-icon aria-hidden="true">article</mat-icon>Sources</a>
      </nav>
      @if (view() === 'sources') {
        <div class="lay-grid lay-g-side">
          <ul class="lay-list lay-card">
            @for (s of ctx.data()?.sources || []; track s.id) {
              <li><a class="lay-item" [href]="ctx.link('library', 'source', s.id)" (click)="ctx.go(ctx.link('library', 'source', s.id), $event)"><span class="lay-docicon lay-docicon-lib"><mat-icon aria-hidden="true">{{ icons[s.type] || 'article' }}</mat-icon></span>
                <span class="lay-body-text"><strong>{{ s.title }}</strong><small>{{ s.type }}{{ s.date ? ' · ' + s.date : '' }} · {{ findingCount(s.id) }} finding{{ findingCount(s.id) === 1 ? '' : 's' }}</small></span></a></li>
            } @empty { <li class="lay-muted lay-pad">No sources yet.</li> }
          </ul>
          <form class="lay-card lay-form" (ngSubmit)="addSource()"><h2>Add a source</h2>
            <label>Kind<select name="stype" [(ngModel)]="newSource.type">@for (entry of types; track entry) { <option [value]="entry">{{ entry }}</option> }</select></label>
            <label>Title<input name="stitle" [(ngModel)]="newSource.title" placeholder="Interview: Dana, lender" maxlength="160"></label>
            <label>Link (optional)<input name="surl" [(ngModel)]="newSource.url" placeholder="https://…" maxlength="1000"></label>
            <label>Date (optional)<input name="sdate" type="date" [(ngModel)]="newSource.date"></label>
            <label>Text (a transcript, notes or an article; optional)<textarea name="sbody" rows="6" [(ngModel)]="newSource.body" placeholder="Dana: I lent my drill to a neighbour in March…"></textarea></label>
            <p class="lay-muted small">Screenshots and files come later; for now, link to them.</p>
            <button type="submit" class="lay-button small" [disabled]="!newSource.title.trim()">Add source</button></form>
        </div>
      } @else {
        <div class="lay-toolbar">
          <label class="lay-search2"><mat-icon aria-hidden="true">search</mat-icon><span class="visually-hidden">Search insights and findings</span><input type="search" [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Search insights and findings"></label>
          <label>Used in<select [ngModel]="layer()" (ngModelChange)="layer.set($event)"><option value="">Any layer</option>@for (entry of layers; track entry) { <option [value]="entry">{{ layerLabel[entry] }}</option> }</select></label>
          <label>Tag<select [ngModel]="tag()" (ngModelChange)="tag.set($event)"><option value="">Any tag</option>@for (entry of tags(); track entry) { <option [value]="entry">{{ entry }}</option> }</select></label>
          <label>Sort<select [ngModel]="sort()" (ngModelChange)="sort.set($event)"><option value="used">Most used</option><option value="new">Newest</option><option value="strength">Strongest</option></select></label>
          <span class="lay-muted small">{{ insights().length }} of {{ (ctx.data()?.insights || []).length }}</span>
          <button type="button" class="lay-button small lay-push" (click)="newInsight()"><mat-icon aria-hidden="true">add</mat-icon>New insight</button>
        </div>
        <div class="lay-card lay-flush">
          @for (i of insights(); track i.id) {
            <a class="lay-insrow" [href]="ctx.link('library', 'insight', i.id)" (click)="ctx.go(ctx.link('library', 'insight', i.id), $event)"><strong>{{ i.text }}</strong>
              <span class="lay-meta3"><span><mat-icon aria-hidden="true">format_quote</mat-icon>{{ i.findings.length }} finding{{ i.findings.length === 1 ? '' : 's' }}</span>
                <span><mat-icon aria-hidden="true">link</mat-icon>used {{ ctx.usedIn(i.id).length }}×</span><span class="lay-strength" [attr.data-s]="i.strength">{{ i.strength }}</span>
                @if (i.comments.length) { <span><mat-icon aria-hidden="true">chat_bubble</mat-icon>{{ i.comments.length }}</span> }
                @for (entry of i.tags; track entry) { <span class="lay-itag">{{ entry }}</span> }</span></a>
          } @empty { <p class="lay-muted lay-pad">{{ (ctx.data()?.insights || []).length ? 'No insights match.' : 'No insights yet. Add a source, highlight what matters, and group findings into insights.' }}</p> }
        </div>
      }
    }
  }`
})
export class LibraryComponent {
  readonly ctx = inject(ProjectContext);
  readonly transcript = viewChild<ElementRef<HTMLElement>>('transcript');
  readonly layerLabel = layerLabel;
  readonly icons = sourceTypeIcon;
  readonly types = Object.keys(sourceTypeIcon);
  readonly strengths = ['weak', 'moderate', 'strong'];
  readonly layers = ['product', 'pages', 'data', 'work'];
  readonly view = computed(() => { const segment = this.ctx.segments()[1] || 'insights'; return ['insight', 'source', 'sources'].includes(segment) ? segment : 'insights'; });
  readonly insight = computed(() => this.view() === 'insight' ? this.ctx.insightById().get(this.ctx.segments()[2] || '') || null : null);
  readonly source = computed(() => this.view() === 'source' ? this.ctx.sourceById().get(this.ctx.segments()[2] || '') || null : null);
  readonly q = signal(''); readonly layer = signal(''); readonly tag = signal(''); readonly sort = signal('used');
  readonly tags = computed(() => [...new Set((this.ctx.data()?.insights || []).flatMap(insight => insight.tags))].sort());
  readonly insights = computed(() => {
    const term = this.q().trim().toLowerCase();
    const rank: Record<string, number> = { strong: 0, moderate: 1, weak: 2 };
    const list = (this.ctx.data()?.insights || []).filter(insight => {
      if (term && !(insight.text.toLowerCase().includes(term) || insight.tags.some(entry => entry.includes(term)) || insight.findings.some(id => this.ctx.findingById().get(id)?.text.toLowerCase().includes(term)))) return false;
      if (this.layer() && !this.ctx.usedIn(insight.id).some(link => layerOf[this.ctx.refInfo(link.recordId)?.kind || ''] === this.layer())) return false;
      return !this.tag() || insight.tags.includes(this.tag());
    });
    const sorts: Record<string, (a: Insight, b: Insight) => number> = { used: (a, b) => this.ctx.usedIn(b.id).length - this.ctx.usedIn(a.id).length, new: (a, b) => b.updatedAt.localeCompare(a.updatedAt), strength: (a, b) => rank[a.strength] - rank[b.strength] };
    return [...list].sort(sorts[this.sort()]);
  });
  readonly freeFindings = computed(() => (this.ctx.data()?.findings || []).filter(finding => !this.insight()?.findings.includes(finding.id)));
  readonly picked = signal(new Set<string>());
  readonly sourceFindings = computed(() => (this.ctx.data()?.findings || []).filter(finding => finding.sourceId === this.source()?.id));
  // Each paragraph (or "Name: words" line), split so existing findings show as highlights.
  readonly paragraphs = computed(() => {
    const quotes = this.sourceFindings().filter(finding => finding.type !== 'data');
    return (this.source()?.body || '').split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => {
      const match = /^([A-Z][\w .'-]{0,30}):\s+(.*)$/.exec(line);
      const text = match ? match[2] : line;
      let segments: Segment[] = [{ text }];
      for (const finding of quotes) segments = segments.flatMap(segment => {
        if (segment.finding) return [segment];
        const at = segment.text.indexOf(finding.text);
        return at < 0 ? [segment] : [{ text: segment.text.slice(0, at) }, { text: finding.text, finding }, { text: segment.text.slice(at + finding.text.length) }].filter(part => part.text);
      });
      return { speaker: match ? match[1] : '', segments };
    });
  });
  readonly selection = signal<{ text: string; top: number; left: number } | null>(null);
  newTag = ''; newComment = '';
  newSource = { type: 'interview', title: '', url: '', date: '', body: '' };
  finding = { text: '', type: 'quote', data: '', insight: '', newInsight: '' };

  meta(source: Source) { return [source.type, source.date, source.by].filter(Boolean).join(' · '); }
  findingCount(sourceId: string) { return (this.ctx.data()?.findings || []).filter(finding => finding.sourceId === sourceId).length; }
  insightsWith(findingId: string) { return (this.ctx.data()?.insights || []).filter(insight => insight.findings.includes(findingId)); }
  pick(id: string) { const next = new Set(this.picked()); if (next.has(id)) next.delete(id); else next.add(id); this.picked.set(next); }

  // A selection inside the transcript offers "Make finding" just above it.
  selected() {
    const box = this.transcript()?.nativeElement; const selection = window.getSelection();
    if (!box || !selection || selection.isCollapsed || !box.contains(selection.anchorNode) || !box.contains(selection.focusNode)) { this.selection.set(null); return; }
    const text = selection.toString().trim().replace(/\s+/g, ' ');
    if (text.length < 4) { this.selection.set(null); return; }
    const range = selection.getRangeAt(0).getBoundingClientRect(); const outer = box.getBoundingClientRect();
    this.selection.set({ text, top: range.top - outer.top + box.offsetTop - 44, left: range.left - outer.left + box.offsetLeft });
  }
  startFinding(text: string) { this.finding = { ...this.finding, text, type: 'quote' }; this.selection.set(null); window.getSelection()?.removeAllRanges(); setTimeout(() => document.querySelector<HTMLTextAreaElement>('.lay-newfind textarea')?.focus()); }

  saveFinding(source: Source) {
    const draft = this.finding; if (!draft.text.trim()) return;
    const data = draft.type === 'data' ? draft.data.split('\n').map(line => line.split(',')).filter(parts => parts.length >= 2).map(([label, value]) => [label.trim(), Number(value)]) : [];
    void this.ctx.write(async () => {
      const created = await this.ctx.record('finding', { sourceId: source.id, type: draft.type, text: draft.text.trim(), data }) as Finding;
      if (draft.insight === 'new' && draft.newInsight.trim()) await this.ctx.record('insight', { text: draft.newInsight.trim(), findings: [created.id] });
      else if (draft.insight && draft.insight !== 'new') { const insight = this.ctx.insightById().get(draft.insight); if (insight) await this.ctx.change(insight.id, { findings: [...insight.findings, created.id] }, insight.revision); }
      this.finding = { text: '', type: 'quote', data: '', insight: '', newInsight: '' };
    }, 'Finding saved.');
  }
  addSource() {
    const draft = this.newSource;
    void this.ctx.write(async () => { const created = await this.ctx.record('source', { ...draft, date: draft.date || null }) as Source; this.newSource = { type: 'interview', title: '', url: '', date: '', body: '' }; this.ctx.go(this.ctx.link('library', 'source', created.id)); }, 'Source added. Highlight what matters to make findings.');
  }
  saveInsight(insight: Insight, changes: Partial<Insight>) { void this.ctx.write(() => this.ctx.change(insight.id, changes, insight.revision), 'Saved.'); }
  addTag(insight: Insight) { const tag = this.newTag.trim().toLowerCase(); if (!tag) return; this.newTag = ''; if (!insight.tags.includes(tag)) this.saveInsight(insight, { tags: [...insight.tags, tag] }); }
  addFindings(insight: Insight) { const ids = [...this.picked()]; this.picked.set(new Set()); this.saveInsight(insight, { findings: [...insight.findings, ...ids] }); }
  comment(insight: Insight) { const text = this.newComment.trim(); if (!text) return; void this.ctx.write(async () => { await this.ctx.comment(insight.id, text); this.newComment = ''; }, 'Comment added.'); }
  newInsight() { void this.ctx.write(async () => { const created = await this.ctx.record('insight', { text: 'New insight' }) as Insight; this.ctx.go(this.ctx.link('library', 'insight', created.id)); setTimeout(() => (document.getElementById('insight-text') as HTMLInputElement | null)?.select(), 60); }, 'Insight created. Name it, then add findings.'); }
  deleteInsight(insight: Insight) { void this.ctx.write(async () => { await this.ctx.delete(insight.id); this.ctx.go(this.ctx.link('library')); }, 'Insight deleted; its evidence links went with it.'); }
  deleteSource(source: Source) { void this.ctx.write(async () => { await this.ctx.delete(source.id); this.ctx.go(this.ctx.link('library', 'sources')); }, 'Source deleted with its findings.'); }
  remove(id: string) { void this.ctx.write(() => this.ctx.delete(id), 'Finding deleted.'); }
}
