import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LibraryEntry, ProjectContext, headingAnchor } from './context';
import { setupProgress } from './layer-nav';
import { renderMarkdown } from './markdown-layer';

// LAYER-KNOWLEDGE-01: a layer's Knowledge is its manual, laid out like a docs site. One sidebar holds Docs (overview,
// charter, methods, each editor tab) and then Information: the layer's spec as a tree, with the parts it shares grouped on a
// card per binding. Parts open as pages: what each is for, its shape, what it holds now (edited in the tab it names), and
// how it is shared. Docs and the spec are saved to the layer's repository at once, with every version kept. People bind
// parts of the tree, never facets: tick parts, add the layers they match, choose who leads.
interface Share { id: string; name: string; status: string; role: string }
interface InfoNode { key: string; title: string; intent: string; tab: string; doc: string | null; select: Clause[]; shape: Shape; count: number; shared: Share[]; children?: InfoNode[] }
interface Clause { kind: string; where?: { field: string; in?: unknown[]; notIn?: unknown[] } }
interface Shape { fields?: [string, string, string][]; format?: string; free?: boolean }
interface DocEntry { path: string; title: string; group: string | null; charter?: boolean; tab?: string; exists?: boolean; edits?: string[] }
interface CardNode { key: string; title: string; intent: string; path: string[] }
interface Participant { layer: string; name: string; icon: string; role: string; lead: boolean; nodes: CardNode[] }
interface Card { id: string; kind: 'binding' | 'proposal'; name: string; statement: string; status: 'live' | 'proposed'; lifecycle?: string; participants: Participant[]; effects?: string[] }
interface Site { layer: { key: string; name: string; icon: string; commit: string; tabs: Record<string, string> }; canEdit: boolean; docs: DocEntry[]; information: InfoNode[]; bindings: Card[]; layers: { key: string; name: string; icon: string }[] }
interface DocRead { path: string; commit: string; content: string; exists: boolean }
interface Version { commit: string; by: string; at: string; subject: string; saved: boolean }
interface Contents { total: number; entries: { ref: string; kind: string; title: string; revision: number; updatedAt: string | null }[]; referencedBy: { layer: string; name: string; count: number }[] }
interface BindingView extends Card { events?: { at: string; kind: string; detail: Record<string, unknown> }[]; pending?: { id: string; change: { kind: string; lifecycle?: string }; blocked: boolean }[]; blockedBy?: string[] }
interface DraftPart { layer: string; name: string; nodes: string[]; lead: boolean; copy: boolean; tree: InfoNode[] }
interface DiffLine { kind: 'same' | 'add' | 'del'; text: string }

const roleWords: Record<string, string> = { authority: 'Leads', replica: 'Keeps a copy', ceded: 'Hands over' };
const roleNote: Record<string, string> = { authority: 'Changes are made here; others follow.', replica: 'Read-only here, kept in step; propose changes to the lead.', ceded: 'Handed over; old entries point to the lead.' };
const docName = (path: string) => path.replace(/^knowledge\//, '').replace(/\.md$/, '');
const flat = (nodes: InfoNode[], path: string[] = []): (InfoNode & { path: string[] })[] => nodes.flatMap(node => [{ ...node, path }, ...flat(node.children || [], [...path, node.key])]);
const clauseText = (clause: Clause) => clause.where ? `${clause.kind.replaceAll('_', ' ')} where ${clause.where.field} ${clause.where.in ? 'is' : 'is not'} ${(clause.where.in || clause.where.notIn || []).join(', ')}` : clause.kind.replaceAll('_', ' ');

// A line diff (longest common subsequence), for comparing two versions of a doc.
function diff(a: string, b: string): DiffLine[] {
  const x = a.split('\n'), y = b.split('\n');
  if (x.length * y.length > 400000) return [...x.map(text => ({ kind: 'del' as const, text })), ...y.map(text => ({ kind: 'add' as const, text }))];
  const t = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) t[i][j] = x[i] === y[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { out.push({ kind: 'same', text: x[i] }); i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) out.push({ kind: 'del', text: x[i++] });
    else out.push({ kind: 'add', text: y[j++] });
  }
  while (i < x.length) out.push({ kind: 'del', text: x[i++] });
  while (j < y.length) out.push({ kind: 'add', text: y[j++] });
  return out;
}

// Long runs of unchanged lines fold to a marker, keeping three lines of context around each change.
function collapse(lines: DiffLine[]): DiffLine[] {
  const near = lines.map((_, i) => lines.slice(Math.max(0, i - 3), i + 4).some(line => line.kind !== 'same'));
  const out: DiffLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (near[i]) { out.push(lines[i]); continue; }
    let j = i; while (j < lines.length && !near[j]) j++;
    out.push({ kind: 'same', text: `… ${j - i} unchanged line${j - i === 1 ? '' : 's'}` }); i = j - 1;
  }
  return out;
}

@Component({
  selector: 'aludel-layer-knowledge', standalone: true, imports: [FormsModule, MatIconModule, NgTemplateOutlet],
  template: `
  <!-- One part of the tree; a ticked part brings its children, which show ticked and can't be unticked alone. -->
  <ng-template #tree let-nodes="nodes" let-depth="depth" let-inherit="inherit">
    @for (node of nodes; track node.key) {
      <div class="kn-nl" [class.active]="kind() === 'node' && key() === node.key">
        @if (node.children?.length) {
          <button type="button" class="kn-tw" (click)="toggle(node.key)" [attr.aria-expanded]="isOpen(node.key, depth)" [attr.aria-label]="(isOpen(node.key, depth) ? 'Collapse ' : 'Expand ') + node.title"><mat-icon aria-hidden="true">{{ isOpen(node.key, depth) ? 'expand_more' : 'chevron_right' }}</mat-icon></button>
        } @else { <span class="kn-tw" aria-hidden="true"></span> }
        @if (selecting()) { <input type="checkbox" [checked]="inherit || picked().has(node.key)" [disabled]="inherit" (change)="pick(node.key, $any($event.target).checked)" [attr.aria-label]="'Select ' + node.title + (node.children?.length ? ' and its parts' : '')"> }
        <a [href]="link('node', node.key)" (click)="nav($event, 'node', node.key)" [attr.aria-current]="kind() === 'node' && key() === node.key ? 'page' : null">{{ node.title }}</a>
        <small>{{ node.count }}</small>
      </div>
      @if (node.children?.length && isOpen(node.key, depth)) {
        <div class="kn-kids"><ng-container *ngTemplateOutlet="tree; context: { nodes: node.children, depth: depth + 1, inherit: inherit || picked().has(node.key) }" /></div>
      }
    }
  </ng-template>

  @if (site(); as s) {
  <div class="kn" [class.kn-open]="menu()">
    <button type="button" class="lay-button ghost kn-menu" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()"><mat-icon aria-hidden="true">format_list_bulleted</mat-icon>{{ s.layer.name }} knowledge</button>
    <aside class="kn-side" [attr.aria-label]="s.layer.name + ' knowledge'">
      <label class="kn-search"><mat-icon aria-hidden="true">search</mat-icon><span class="visually-hidden">Search {{ s.layer.name }} knowledge</span>
        <input type="search" [placeholder]="'Search ' + s.layer.name + ' knowledge'" [ngModel]="query()" (ngModelChange)="query.set($event)"></label>
      @if (query().trim()) {
        <ul class="kn-results" aria-label="Search results">
          @for (hit of results(); track hit.link) { <li><a [href]="hit.href" (click)="menu.set(false); ctx.go(hit.href, $event)">{{ hit.title }}<small>{{ hit.where }}</small></a></li> }
          @empty { <li class="lay-muted small">{{ query().trim().length > 1 && docHits() === null ? 'Searching…' : 'Nothing matches.' }}</li> }
        </ul>
      } @else {
        <h2 class="kn-sec">Docs</h2>
        <a class="kn-link" [href]="link()" (click)="nav($event)" [attr.aria-current]="kind() === 'overview' ? 'page' : null">Overview</a>
        @for (doc of looseDocs(); track doc.path) { <a class="kn-link" [href]="link('doc', docName(doc.path))" (click)="nav($event, 'doc', docName(doc.path))" [attr.aria-current]="isDoc(doc) ? 'page' : null">{{ doc.title }}</a> }
        @for (group of docGroups(); track group) {
          <button type="button" class="kn-group" (click)="toggle('g:' + group)" [attr.aria-expanded]="isOpen('g:' + group, 0)"><mat-icon aria-hidden="true">{{ isOpen('g:' + group, 0) ? 'expand_more' : 'chevron_right' }}</mat-icon>{{ group }}</button>
          @if (isOpen('g:' + group, 0)) {
            <div class="kn-kids">@for (doc of docsIn(group); track doc.path) {
              <a class="kn-link" [href]="link('doc', docName(doc.path))" (click)="nav($event, 'doc', docName(doc.path))" [attr.aria-current]="isDoc(doc) ? 'page' : null">{{ doc.title }}</a>
            }</div>
          }
        }
        <div class="kn-sec kn-sec-row"><a [href]="link('info')" (click)="nav($event, 'info')" [attr.aria-current]="kind() === 'info' ? 'page' : null">Information</a>
          @if (!selecting()) { <button type="button" class="lay-link-button" (click)="startSelect()"><mat-icon aria-hidden="true">checklist</mat-icon>Select</button> }</div>
        <ng-container *ngTemplateOutlet="tree; context: { nodes: localTree(), depth: 0, inherit: false }" />
        @for (card of s.bindings; track card.id) {
          <section class="kn-card" [class.kn-proposed]="card.status === 'proposed'" [attr.aria-label]="card.name">
            <a class="kn-card-h" [href]="link('binding', card.id)" (click)="nav($event, 'binding', card.id)" [attr.aria-current]="kind() === 'binding' && key() === card.id ? 'page' : null">
              <span class="kn-card-t"><mat-icon aria-hidden="true">link</mat-icon>{{ card.name }}</span>
              <span class="kn-card-w">@if (card.status === 'proposed') { <span class="lay-chip kn-chip-proposed">Proposed</span> }
                with {{ others(card) }} · @if (mine(card)?.lead) { <strong class="kn-lead"><mat-icon aria-hidden="true">star</mat-icon>leads</strong> } @else { {{ roleWords[mine(card)?.role || ''].toLowerCase() }} · {{ leadName(card) }} leads }</span>
            </a>
            <div class="kn-card-nodes"><ng-container *ngTemplateOutlet="tree; context: { nodes: cardTree(card), depth: 0, inherit: false }" /></div>
          </section>
        }
        @if (selecting()) {
          <div class="kn-selbar"><span>{{ picked().size }} selected</span>
            <button type="button" class="lay-button ghost" (click)="cancelSelect()">Cancel</button>
            <button type="button" class="lay-button" [disabled]="!picked().size" (click)="startPropose()"><mat-icon aria-hidden="true">add_link</mat-icon>Propose a binding</button></div>
        }
      }
    </aside>

    <div class="kn-read" (click)="follow($event)">
      @switch (kind()) {
        @case ('overview') {
          <h2 class="kn-title">{{ s.layer.name }}</h2>
          @if (purpose()) { <p class="kn-lead-text">{{ purpose() }}</p> }
          <div class="kn-meta"><span class="lay-chip lay-plain">at {{ s.layer.commit.slice(0, 7) }}</span>
            <span class="kn-actions"><a class="lay-button ghost" [href]="link('doc', 'charter')" (click)="nav($event, 'doc', 'charter')">Read the charter</a></span></div>
          <h3 id="kn-keeps">What {{ s.layer.name }} keeps</h3>
          <div class="kn-cards">@for (node of s.information; track node.key) {
            <a class="kn-tile" [href]="link('node', node.key)" (click)="nav($event, 'node', node.key)"><strong>{{ node.title }}<small>{{ node.count }}</small></strong><span>{{ node.intent }}</span></a>
          } @empty { <p class="lay-muted">{{ s.layer.name }} hasn't said what it keeps yet. @if (s.canEdit) { <a [href]="link('info')" (click)="nav($event, 'info')">Describe its information</a> } </p> }</div>
          <h3 id="kn-shared">Shared with</h3>
          <ng-container *ngTemplateOutlet="cards" />
          <h3 id="kn-start">Start here</h3>
          <ol class="kn-start"><li>Read the <a [href]="link('doc', 'charter')" (click)="nav($event, 'doc', 'charter')">charter</a> for what {{ s.layer.name }} owns and what it leaves to other layers.</li>
            <li>Look through <a [href]="link('info')" (click)="nav($event, 'info')">Information</a>: what it keeps, in what form, and what it shares.</li>
            @if (docsIn('Methods').length) { <li>Read the method for your task: @for (doc of docsIn('Methods'); track doc.path; let last = $last) { <a [href]="link('doc', docName(doc.path))" (click)="nav($event, 'doc', docName(doc.path))">{{ doc.title }}</a>@if (!last) {, } }.</li> }</ol>
        }

        @case ('doc') {
          @if (currentDoc(); as entry) {
            <nav class="kn-crumbs" aria-label="Breadcrumb"><a [href]="link()" (click)="nav($event)">{{ s.layer.name }} knowledge</a><mat-icon aria-hidden="true">chevron_right</mat-icon><span>{{ entry.group || 'Docs' }}</span></nav>
            <h2 class="kn-title">{{ entry.title }}</h2>
            <div class="kn-meta"><span class="lay-chip lay-plain mono">{{ entry.path }}</span>
              @if (versions()[0]; as last) { <span class="lay-muted small">{{ last.saved ? 'Saved by ' + last.by : 'From the template' }}, {{ when(last.at) }}</span> }
              <span class="kn-actions">
                @if (entry.tab) { <a class="lay-button ghost" [href]="ctx.link(layerKey(), entry.tab)" (click)="ctx.go(ctx.link(layerKey(), entry.tab), $event)"><mat-icon aria-hidden="true">open_in_new</mat-icon>Open the tab</a> }
                @if (versions().length > 1) { <button type="button" class="lay-button ghost" (click)="toggleHistory()" [attr.aria-expanded]="showHistory()"><mat-icon aria-hidden="true">history</mat-icon>History</button> }
                @if (s.canEdit && !editing()) { <button type="button" class="lay-button ghost" (click)="edit()"><mat-icon aria-hidden="true">edit</mat-icon>{{ doc()?.exists ? 'Edit' : 'Write it' }}</button> }
              </span></div>
            @if (entry.charter && progress(); as p) {
              <ul class="kn-checks" aria-label="Charter sections needed to activate">@for (section of p.sections; track section.key) {
                <li [class.done]="section.done"><mat-icon aria-hidden="true">{{ section.done ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>{{ section.label }}<span class="visually-hidden">{{ section.done ? ' written' : ' still needed' }}</span></li>
              }</ul>
            }
            @if (showHistory()) { <ng-container *ngTemplateOutlet="history" /> }
            @if (editing()) { <ng-container *ngTemplateOutlet="editor" /> }
            @else if (doc()?.exists) { <div class="kn-md" [innerHTML]="html(doc()!.content)"></div> }
            @else if (entry.tab) {
              <p class="lay-muted">No one has written about the {{ entry.title }} tab yet.</p>
            } @else { <p class="lay-muted">This document is empty.</p> }
            @if (entry.tab && entry.edits?.length) {
              <h3 id="kn-edits">What it edits</h3>
              <ul class="kn-plain">@for (node of nodesByKey(entry.edits!); track node.key) { <li><a [href]="link('node', node.key)" (click)="nav($event, 'node', node.key)">{{ node.title }}</a>: {{ node.intent }}</li> }</ul>
            }
          } @else { <p class="lay-muted">Document not found.</p> }
        }

        @case ('info') {
          <nav class="kn-crumbs" aria-label="Breadcrumb"><a [href]="link()" (click)="nav($event)">{{ s.layer.name }} knowledge</a><mat-icon aria-hidden="true">chevron_right</mat-icon><span>Information</span></nav>
          <h2 class="kn-title">Information</h2>
          <p class="kn-lead-text">What {{ s.layer.name }} keeps, as a spec. Each part says what it is for and what form it takes; its contents are edited in the tab it names.</p>
          <div class="kn-meta"><span class="lay-chip lay-plain mono">layer.json › information</span>
            <span class="kn-actions"><button type="button" class="lay-button ghost" (click)="startSelect()"><mat-icon aria-hidden="true">checklist</mat-icon>Select to bind</button>
              @if (s.canEdit) { <button type="button" class="lay-button ghost" (click)="newPart(null)"><mat-icon aria-hidden="true">add</mat-icon>Add a part</button> }</span></div>
          @if (partForm()) { <ng-container *ngTemplateOutlet="partEditor" /> }
          <h3 id="kn-local">Only in {{ s.layer.name }}</h3>
          <div class="kn-cards">@for (node of localTree(); track node.key) {
            <a class="kn-tile" [href]="link('node', node.key)" (click)="nav($event, 'node', node.key)"><strong>{{ node.title }}<small>{{ node.count }}</small></strong><span>{{ node.intent }}</span></a>
          } @empty { <p class="lay-muted">Nothing; everything is shared.</p> }</div>
          <h3 id="kn-shared">Shared</h3>
          <ng-container *ngTemplateOutlet="cards" />
        }

        @case ('node') {
          @if (currentNode(); as node) {
            <nav class="kn-crumbs" aria-label="Breadcrumb"><a [href]="link()" (click)="nav($event)">{{ s.layer.name }} knowledge</a><mat-icon aria-hidden="true">chevron_right</mat-icon>
              <a [href]="link('info')" (click)="nav($event, 'info')">Information</a>
              @for (step of ancestors(node); track step.key) { <mat-icon aria-hidden="true">chevron_right</mat-icon><a [href]="link('node', step.key)" (click)="nav($event, 'node', step.key)">{{ step.title }}</a> }</nav>
            <h2 class="kn-title">{{ node.title }}</h2>
            <p class="kn-lead-text">{{ node.intent }}</p>
            <div class="kn-meta">
              <a class="lay-chip lay-plain" [href]="ctx.link(layerKey(), node.tab)" (click)="ctx.go(ctx.link(layerKey(), node.tab), $event)"><mat-icon aria-hidden="true">edit_note</mat-icon>Edited in the {{ tabLabel(node.tab) }} tab</a>
              <span class="lay-chip lay-plain" title="What this part covers"><mat-icon aria-hidden="true">filter_list</mat-icon>{{ covers(node) }}</span>
              @for (share of node.shared; track share.id) { <a class="lay-chip" [class.kn-chip-live]="share.status === 'live'" [class.kn-chip-proposed]="share.status !== 'live'" [href]="link('binding', share.id)" (click)="nav($event, 'binding', share.id)"><mat-icon aria-hidden="true">{{ share.role === 'authority' ? 'star' : 'link' }}</mat-icon>{{ share.name }} · {{ roleWords[share.role].toLowerCase() }}</a> }
              <span class="kn-actions"><button type="button" class="lay-button ghost" (click)="bindNode(node.key)"><mat-icon aria-hidden="true">add_link</mat-icon>Bind…</button>
                @if (s.canEdit) { <button type="button" class="lay-button ghost" (click)="editPart(node)"><mat-icon aria-hidden="true">edit</mat-icon>Edit</button> }</span></div>
            @if (partForm()) { <ng-container *ngTemplateOutlet="partEditor" /> }
            <h3 id="kn-about">About</h3>
            @if (doc()?.exists) { <div class="kn-md" [innerHTML]="html(doc()!.content)"></div> } @else { <p class="lay-muted">No description yet.@if (s.canEdit) { Choose Edit to write one. }</p> }
            @if (node.children?.length) {
              <h3 id="kn-parts">Parts</h3>
              <div class="kn-cards">@for (child of node.children; track child.key) { <a class="kn-tile" [href]="link('node', child.key)" (click)="nav($event, 'node', child.key)"><strong>{{ child.title }}<small>{{ child.count }}</small></strong><span>{{ child.intent }}</span></a> }</div>
            }
            <h3 id="kn-shape">Shape</h3>
            @if (node.shape.format) { <p>Each item follows this format:</p><pre class="kn-fmt">{{ node.shape.format }}</pre> }
            @else if (node.shape.fields?.length) {
              <div class="kn-table"><table><thead><tr><th scope="col">Field</th><th scope="col">Type</th><th scope="col">Meaning</th></tr></thead>
                <tbody>@for (field of node.shape.fields; track field[0]) { <tr><td class="mono">{{ field[0] }}</td><td class="mono lay-muted">{{ field[1] }}</td><td>{{ field[2] }}</td></tr> }</tbody></table></div>
            } @else { <p class="lay-muted">Free text. No required format.</p> }
            <h3 id="kn-contents">Contents <small class="lay-muted">{{ node.count }}</small></h3>
            @if (contents(); as held) {
              @if (held.entries.length) {
                <div class="kn-table"><table><thead><tr><th scope="col">Entry</th><th scope="col">Kind</th><th scope="col">Revision</th><th scope="col">Updated</th></tr></thead>
                  <tbody>@for (entry of held.entries; track entry.ref) { <tr><td><a [href]="ctx.link(layerKey(), node.tab)" (click)="ctx.go(ctx.link(layerKey(), node.tab), $event)">{{ entry.title }}</a></td><td>{{ entry.kind.replaceAll('_', ' ') }}</td><td>r{{ entry.revision }}</td><td>{{ entry.updatedAt ? when(entry.updatedAt) : '' }}</td></tr> }</tbody></table></div>
                @if (held.total > held.entries.length) { <p class="lay-muted small">Showing the {{ held.entries.length }} most recent of {{ held.total }}.</p> }
              } @else { <p class="lay-muted">Nothing here yet.</p> }
              <p><a class="lay-button ghost" [href]="ctx.link(layerKey(), node.tab)" (click)="ctx.go(ctx.link(layerKey(), node.tab), $event)"><mat-icon aria-hidden="true">open_in_new</mat-icon>Edit in the {{ tabLabel(node.tab) }} tab</a></p>
            } @else { <p class="lay-muted">Loading…</p> }
            <h3 id="kn-sharing">Sharing</h3>
            @for (share of node.shared; track share.id) {
              <div class="kn-box"><span class="lay-chip" [class.kn-chip-live]="share.status === 'live'" [class.kn-chip-proposed]="share.status !== 'live'">{{ share.status === 'live' ? 'Live' : 'Proposed' }}</span>
                In <a [href]="link('binding', share.id)" (click)="nav($event, 'binding', share.id)">{{ share.name }}</a>. {{ s.layer.name }} {{ roleWords[share.role].toLowerCase() }}: {{ roleNote[share.role] }}</div>
            } @empty {
              @if (sharedParts(node).length) {
                <p>Its parts are shared separately:</p>
                <ul class="kn-plain">@for (part of sharedParts(node); track part.key) { <li><a [href]="link('node', part.key)" (click)="nav($event, 'node', part.key)">{{ part.title }}</a>: @for (share of part.shared; track share.id; let last = $last) { <a [href]="link('binding', share.id)" (click)="nav($event, 'binding', share.id)">{{ share.name }}</a>@if (!last) {, } }</li> }</ul>
              } @else { <p class="lay-muted">Not shared. Only {{ s.layer.name }} uses it. <button type="button" class="lay-link-button" (click)="bindNode(node.key)">Bind it with another layer…</button></p> }
            }
            @if (contents()?.referencedBy?.length) {
              <h3 id="kn-refby">Referenced by</h3>
              <p>@for (ref of contents()!.referencedBy; track ref.layer; let last = $last) { <a [href]="ctx.link(ref.layer, 'knowledge')" (click)="ctx.go(ctx.link(ref.layer, 'knowledge'), $event)">{{ ref.name }}</a> ({{ ref.count }})@if (!last) {, } }</p>
            }
          } @else { <p class="lay-muted">This part isn't in {{ s.layer.name }}'s information.</p> }
        }

        @case ('binding') {
          @if (binding(); as b) {
            <nav class="kn-crumbs" aria-label="Breadcrumb"><a [href]="link()" (click)="nav($event)">{{ s.layer.name }} knowledge</a><mat-icon aria-hidden="true">chevron_right</mat-icon><a [href]="link('info')" (click)="nav($event, 'info')">Information</a><mat-icon aria-hidden="true">chevron_right</mat-icon><span>{{ b.name }}</span></nav>
            <h2 class="kn-title">{{ b.name }}</h2>
            <p class="kn-lead-text">@for (p of b.participants; track p.layer; let last = $last) { {{ p.name }}@if (!last) { · } }</p>
            <div class="kn-meta"><span class="lay-chip" [class.kn-chip-live]="b.status === 'live'" [class.kn-chip-proposed]="b.status !== 'live'">{{ b.status === 'live' ? 'Live' : 'Proposed' }}</span>
              <span class="lay-chip lay-plain kn-lead"><mat-icon aria-hidden="true">star</mat-icon>{{ leadName(b) }} leads</span></div>
            @if (b.status === 'proposed' && decidable(b)) {
              <div class="kn-box kn-box-warn" role="region" aria-label="Decision"><p><strong>Waiting for your decision.</strong> Accepting applies everything under “What changes” in one step.</p>
                <div class="lay-row"><button type="button" class="lay-button" [disabled]="busy()" (click)="decide(b, 'accept')">Accept</button><button type="button" class="lay-button ghost" [disabled]="busy()" (click)="decide(b, 'dismiss')">Dismiss</button></div></div>
            } @else if (b.status === 'proposed') { <p class="lay-muted">Waiting for the project owner's decision.</p> }
            <h3 id="kn-what">What it binds</h3>
            @if (b.statement) { <p>{{ b.statement }}</p> }
            <div class="kn-parts">@for (p of b.participants; track p.layer) {
              <div class="kn-part" [class.kn-part-lead]="p.lead"><span class="lay-chip lay-plain"><mat-icon aria-hidden="true">{{ p.icon }}</mat-icon>{{ p.name }}</span>
                <div>@for (node of p.nodes; track node.key) { <a class="lay-chip lay-plain" [href]="ctx.link(p.layer, 'knowledge', 'node', node.key)" (click)="ctx.go(ctx.link(p.layer, 'knowledge', 'node', node.key), $event)">{{ node.title }}</a> }
                  <p class="lay-muted small">@for (node of p.nodes; track node.key) { {{ node.intent }} }</p></div>
                <div class="kn-role">@if (p.lead) { <mat-icon aria-hidden="true">star</mat-icon> }{{ roleWords[p.role] }}<small>{{ roleNote[p.role] }}</small></div></div>
            }</div>
            @if (b.effects?.length) { <h3 id="kn-changes">What changes</h3><ul class="kn-plain">@for (line of b.effects; track $index) { <li>{{ line }}</li> }</ul> }
            @if (b.events?.length) {
              <h3 id="kn-activity">Activity</h3>
              <div class="kn-table"><table><tbody>@for (event of b.events!.slice(0, 12); track $index) { <tr><td class="lay-muted">{{ when(event.at) }}</td><td>{{ eventText(event) }}</td></tr> }</tbody></table></div>
            }
            <p><a [href]="ctx.link('library', 'bindings')" (click)="ctx.go(ctx.link('library', 'bindings'), $event)">All bindings in the Library</a></p>
          } @else { <p class="lay-muted">Loading…</p> }
        }

        @case ('propose') {
          <nav class="kn-crumbs" aria-label="Breadcrumb"><a [href]="link()" (click)="nav($event)">{{ s.layer.name }} knowledge</a><mat-icon aria-hidden="true">chevron_right</mat-icon><a [href]="link('info')" (click)="nav($event, 'info')">Information</a><mat-icon aria-hidden="true">chevron_right</mat-icon><span>Propose a binding</span></nav>
          <h2 class="kn-title">Propose a binding</h2>
          <p class="kn-lead-text">Tick the information each layer keeps that is the same thing, add every layer it is in, and choose the one that leads.</p>
          @if (parts().length) {
            <div class="kn-grid" role="list" aria-label="Layers in this binding">
              @for (part of parts(); track part.layer; let i = $index) {
                <section class="kn-pcard" [class.kn-part-lead]="part.lead" role="listitem" [attr.aria-label]="part.name">
                  <header><strong>{{ part.name }}</strong>
                    <button type="button" class="kn-leadtoggle" [attr.aria-pressed]="part.lead" (click)="setLead(i)"><mat-icon aria-hidden="true">star</mat-icon>{{ part.lead ? 'Leads' : 'Make lead' }}</button>
                    @if (i > 0) { <button type="button" class="lay-link-button" (click)="removePart(i)" [attr.aria-label]="'Remove ' + part.name">Remove</button> }</header>
                  @if (!part.lead) { <label class="kn-copy"><input type="checkbox" [checked]="part.copy" (change)="setCopy(i, $any($event.target).checked)">Keep a local copy</label>
                    <p class="lay-muted small">{{ part.copy ? 'Stays in ' + part.name + ', read-only, kept in step.' : part.name + ' hands it over and points to the lead.' }}</p> }
                  <div class="kn-pick">
                    <ng-template #pickTree let-nodes="nodes" let-inherit="inherit">
                      @for (node of nodes; track node.key) {
                        <label class="kn-pickrow"><input type="checkbox" [checked]="inherit || part.nodes.includes(node.key)" [disabled]="inherit" (change)="pickPart(i, node.key, $any($event.target).checked)">
                          <span>{{ node.title }}@if (node.shared.length) { <small class="lay-muted"> · in {{ node.shared[0].name }}</small> }</span></label>
                        @if (node.children?.length) { <div class="kn-kids"><ng-container *ngTemplateOutlet="pickTree; context: { nodes: node.children, inherit: inherit || part.nodes.includes(node.key) }" /></div> }
                      }
                    </ng-template>
                    <ng-container *ngTemplateOutlet="pickTree; context: { nodes: part.tree, inherit: false }" />
                  </div>
                </section>
              }
              @if (addable().length) {
                <section class="kn-pcard kn-add" role="listitem" aria-label="Add a layer">
                  <label for="kn-add-layer"><mat-icon aria-hidden="true">add</mat-icon>Add a layer</label>
                  <select id="kn-add-layer" [ngModel]="''" (ngModelChange)="addPart($event)"><option value="">Choose a layer…</option>@for (layer of addable(); track layer.key) { <option [value]="layer.key">{{ layer.name }}</option> }</select>
                </section>
              }
            </div>
            <div class="kn-fields">
              <label>Name<input [ngModel]="bindName()" (ngModelChange)="bindName.set($event); refreshPreview()" placeholder="e.g. The people we design for"></label>
              <label>How the parts match<textarea rows="3" [ngModel]="bindStatement()" (ngModelChange)="bindStatement.set($event)" placeholder="Why these are the same information, and how the lead drives the others, though each layer keeps it in its own form."></textarea></label>
            </div>
            <h3 id="kn-changes">What changes if accepted</h3>
            @if (previewError()) { <p class="kn-box kn-box-warn" role="status">{{ previewError() }}</p> }
            @else if (previewLines().length) { <ul class="kn-plain" aria-live="polite">@for (line of previewLines(); track $index) { <li>{{ line }}</li> }</ul> }
            @else { <p class="lay-muted">Add another layer and tick its matching information.</p> }
            <div class="lay-row"><button type="button" class="lay-button" [disabled]="busy() || !!previewError() || !previewLines().length" (click)="submitProposal()">Propose</button>
              <button type="button" class="lay-button ghost" (click)="cancelPropose()">Cancel</button></div>
          } @else { <p>Select information first: choose <strong>Select</strong> next to Information in the sidebar.</p> }
        }
      }
    </div>

    <nav class="kn-outline" aria-label="On this page">@if (outline().length) { <strong>On this page</strong>@for (item of outline(); track item[0]) { <a [href]="'#' + item[0]" (click)="jump($event, item[0])">{{ item[1] }}</a> } }</nav>
  </div>

  <ng-template #cards>
    <div class="kn-cards">@for (card of s.bindings; track card.id) {
      <a class="kn-tile" [href]="link('binding', card.id)" (click)="nav($event, 'binding', card.id)"><strong><mat-icon aria-hidden="true">link</mat-icon>{{ card.name }}<span class="lay-chip" [class.kn-chip-live]="card.status === 'live'" [class.kn-chip-proposed]="card.status !== 'live'">{{ card.status === 'live' ? 'Live' : 'Proposed' }}</span></strong>
        <span>{{ partsOf(card) }} · {{ mine(card)?.lead ? 'leads' : roleWords[mine(card)?.role || ''].toLowerCase() }}<br>with {{ others(card) }}@if (!mine(card)?.lead) { · {{ leadName(card) }} leads }</span></a>
    } @empty { <p class="lay-muted">Nothing is shared yet. Select information and propose a binding.</p> }</div>
  </ng-template>

  <ng-template #editor>
    <div class="kn-editor"><label><span class="visually-hidden">Markdown</span><textarea [ngModel]="draft()" (ngModelChange)="draft.set($event)" rows="18" spellcheck="true"></textarea></label>
      <div class="kn-md kn-preview" aria-label="Preview" [innerHTML]="html(draft())"></div></div>
    <div class="lay-row"><button type="button" class="lay-button" [disabled]="busy() || !draft().trim()" (click)="saveDoc()">Save</button><button type="button" class="lay-button ghost" (click)="editing.set(false)">Cancel</button></div>
  </ng-template>

  <ng-template #history>
    <section class="kn-history" aria-label="History"><p class="lay-muted small">Choose two versions to compare.</p>
      <ul>@for (version of versions(); track version.commit) {
        <li><label><input type="checkbox" [checked]="compareSet().includes(version.commit)" (change)="toggleCompare(version.commit)">{{ when(version.at) }} · {{ version.saved ? version.by : 'template' }}<small class="lay-muted mono"> {{ version.commit.slice(0, 7) }}</small></label></li>
      }</ul>
      @if (compared(); as lines) {
        <div class="kn-diff" tabindex="0" role="region" aria-label="Changes between the two versions">@for (line of lines; track $index) { <div [class]="'kn-d-' + line.kind"><span aria-hidden="true">{{ line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' ' }}</span><span class="visually-hidden">{{ line.kind === 'add' ? 'added: ' : line.kind === 'del' ? 'removed: ' : '' }}</span>{{ line.text }}</div> }</div>
      }
    </section>
  </ng-template>

  <ng-template #partEditor>
    @if (partForm(); as f) {
      <form class="kn-box kn-form" (submit)="$event.preventDefault(); savePart()" [attr.aria-label]="f.key ? 'Edit ' + f.title : 'Add a part'">
        <label>Title<input name="title" [(ngModel)]="f.title"></label>
        <label>What it is for<input name="intent" [(ngModel)]="f.intent" placeholder="One line a stranger would understand"></label>
        @if (!f.key) { <label>Inside<select name="parent" [(ngModel)]="f.parent"><option [ngValue]="null">Top level</option>@for (node of allNodes(); track node.key) { <option [ngValue]="node.key">{{ node.title }}</option> }</select></label> }
        <label>Covers<select name="kind" [(ngModel)]="f.kind">@for (kind of outputKinds(); track kind) { <option [value]="kind">{{ kind.replaceAll('_', ' ') }}</option> }</select></label>
        <div class="kn-inline"><label>Only where<input name="field" [(ngModel)]="f.field" placeholder="field (e.g. folder)"></label><label>is<input name="values" [(ngModel)]="f.values" placeholder="values, comma separated"></label></div>
        <label>Edited in<select name="tab" [(ngModel)]="f.tab">@for (tab of tabKeys(); track tab) { <option [value]="tab">{{ tabLabel(tab) }}</option> }</select></label>
        <label>Required format (optional)<textarea name="format" rows="3" [(ngModel)]="f.format" placeholder="# {Name}&#10;&#10;## Needs"></textarea></label>
        <label>About (Markdown)<textarea name="about" rows="5" [(ngModel)]="f.about"></textarea></label>
        <div class="lay-row"><button type="submit" class="lay-button" [disabled]="busy() || !f.title.trim() || !f.intent.trim()">Save</button><button type="button" class="lay-button ghost" (click)="partForm.set(null)">Cancel</button>
          @if (f.key) { <button type="button" class="lay-link-button" (click)="removePartNode(f.key)">Remove this part</button> }</div>
      </form>
    }
  </ng-template>
  } @else { <p class="lay-muted">Loading…</p> }`
})
export class LayerKnowledgeComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly roleWords = roleWords; readonly roleNote = roleNote; readonly docName = docName;
  readonly site = signal<Site | null>(null);
  // A draft custom layer activates once its charter answers each section (CUSTOM-LAYER-01); Knowledge shows how far it is.
  readonly progress = computed(() => setupProgress(this.ctx.layerInstances().find(item => item.key === this.layerKey()) || null));
  readonly kind = computed(() => { const value = this.ctx.segments()[2]; return ['doc', 'info', 'node', 'binding', 'propose'].includes(value) ? value : 'overview'; });
  readonly key = computed(() => this.ctx.segments()[3] || '');
  readonly menu = signal(false); readonly query = signal(''); readonly busy = signal(false);
  private readonly openState = signal<Record<string, boolean>>({});
  readonly selecting = signal(false); readonly picked = signal<Set<string>>(new Set());
  readonly doc = signal<DocRead | null>(null); readonly editing = signal(false); readonly draft = signal('');
  readonly versions = signal<Version[]>([]); readonly showHistory = signal(false); readonly compareSet = signal<string[]>([]); readonly compared = signal<DiffLine[] | null>(null);
  readonly contents = signal<Contents | null>(null);
  readonly binding = signal<BindingView | null>(null);
  readonly parts = signal<DraftPart[]>([]); readonly bindName = signal(''); readonly bindStatement = signal('');
  readonly previewLines = signal<string[]>([]); readonly previewError = signal('');
  readonly partForm = signal<{ key: string | null; parent: string | null; title: string; intent: string; kind: string; field: string; values: string; tab: string; format: string; about: string } | null>(null);

  readonly allNodes = computed(() => flat(this.site()?.information || []));
  readonly currentNode = computed(() => this.allNodes().find(node => node.key === this.key()) || null);
  readonly currentDoc = computed(() => this.site()?.docs.find(doc => docName(doc.path) === this.key()) || null);
  readonly looseDocs = computed(() => (this.site()?.docs || []).filter(doc => !doc.group));
  readonly docGroups = computed(() => [...new Set((this.site()?.docs || []).map(doc => doc.group).filter((group): group is string => !!group))]);
  readonly purpose = computed(() => { const charter = this.charterText(); const section = /##\s*Purpose\s*\n+([\s\S]*?)(\n##|$)/.exec(charter)?.[1] || charter.replace(/^#.*\n+/, '').split(/\n\s*\n/)[0] || ''; return section.trim().replace(/\s+/g, ' ').slice(0, 400); });
  private readonly charterText = signal('');
  // Parts shared on a card leave the local tree; a part whose every child is shared leaves it too.
  readonly localTree = computed(() => {
    const top = new Set((this.site()?.bindings || []).flatMap(card => (this.mine(card)?.nodes || []).map(node => node.key)));
    const strip = (node: InfoNode): InfoNode | null => { if (top.has(node.key)) return null; if (!node.children) return node; const kids = node.children.map(strip).filter((item): item is InfoNode => !!item); return kids.length ? { ...node, children: kids } : null; };
    return (this.site()?.information || []).map(strip).filter((item): item is InfoNode => !!item);
  });
  readonly addable = computed(() => (this.site()?.layers || []).filter(layer => !this.parts().some(part => part.layer === layer.key)));
  readonly outline = computed((): [string, string][] => {
    const kind = this.kind(), node = this.currentNode(), b = this.binding();
    if (kind === 'overview') return [['kn-keeps', 'What it keeps'], ['kn-shared', 'Shared with'], ['kn-start', 'Start here']];
    if (kind === 'info') return [['kn-local', 'Only here'], ['kn-shared', 'Shared']];
    if (kind === 'node' && node) return [['kn-about', 'About'], ...(node.children?.length ? [['kn-parts', 'Parts'] as [string, string]] : []), ['kn-shape', 'Shape'], ['kn-contents', 'Contents'], ['kn-sharing', 'Sharing'], ...(this.contents()?.referencedBy?.length ? [['kn-refby', 'Referenced by'] as [string, string]] : [])];
    if (kind === 'binding' && b) return [['kn-what', 'What it binds'], ...(b.effects?.length ? [['kn-changes', 'What changes'] as [string, string]] : []), ...(b.events?.length ? [['kn-activity', 'Activity'] as [string, string]] : [])];
    return [];
  });
  // W-10: docs are found by the Library's search (this layer's Knowledge, body text included, opening at the matching
  // section); the information tree is filtered here, as navigation.
  readonly docHits = signal<LibraryEntry[] | null>(null);
  private docSeq = 0;
  private readonly docSearch = effect(onCleanup => {
    const q = this.query().trim(), key = this.layerKey();
    this.docHits.set(null);
    if (q.length < 2 || !key || !this.ctx.projectId()) return;
    const seq = ++this.docSeq;
    const timer = setTimeout(() => untracked(() => this.ctx.librarySearch({ q, layer: key, source: 'knowledge', limit: 20 })
      .then(result => { if (seq === this.docSeq) this.docHits.set(result.results); }, () => { if (seq === this.docSeq) this.docHits.set([]); })), 200);
    onCleanup(() => clearTimeout(timer));
  });
  // A link to a doc's section (#anchor) scrolls to that heading once the doc is shown.
  private readonly toSection = effect(() => {
    const anchor = this.ctx.fragment(), doc = this.doc();
    if (!anchor || !doc?.exists) return;
    setTimeout(() => {
      const heading = [...document.querySelectorAll<HTMLElement>('.kn-md h1, .kn-md h2, .kn-md h3, .kn-md h4, .kn-md h5, .kn-md h6')].find(element => headingAnchor(element.textContent || '') === anchor);
      if (!heading) return;
      heading.tabIndex = -1; heading.classList.add('kn-target'); heading.scrollIntoView({ block: 'start' }); heading.focus({ preventScroll: true });
    });
  });
  readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [];
    const docs = (this.docHits() || []).map(entry => ({ kind: 'doc', key: entry.ref, title: entry.title, where: [entry.heading, entry.excerpt].filter(Boolean).join(' · ') || 'Docs', link: entry.ref, href: this.ctx.entryHref(entry) }));
    const nodes = this.allNodes().filter(node => `${node.title} ${node.intent}`.toLowerCase().includes(q)).map(node => ({ kind: 'node', key: node.key, title: node.title, where: 'Information', link: `n:${node.key}`, href: this.link('node', node.key) }));
    return [...docs, ...nodes];
  });

  constructor() {
    effect(() => { const id = this.ctx.projectId(), key = this.layerKey(); if (id && key) void this.load(); });
    effect(() => {
      const kind = this.kind(), key = this.key(), s = this.site();
      if (!s) return;
      this.editing.set(false); this.showHistory.set(false); this.compareSet.set([]); this.compared.set(null); this.partForm.set(null);
      if (kind === 'doc') { const entry = this.currentDoc(); if (entry) void this.loadDoc(entry.path); }
      else if (kind === 'node') { const node = this.currentNode(); this.contents.set(null); if (node) { void this.loadContents(node.key); if (node.doc) void this.loadDoc(node.doc, false); else this.doc.set(null); } }
      else if (kind === 'binding') { this.binding.set(null); void this.loadBinding(key); }
      else if (kind === 'overview') { const charter = s.docs.find(doc => doc.charter); if (charter) void this.ctx.api<DocRead>(this.path(`knowledge/doc?path=${encodeURIComponent(charter.path)}`)).then(read => this.charterText.set(read.content)).catch(() => this.charterText.set('')); }
    });
  }

  private path(suffix: string) { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/${encodeURIComponent(this.layerKey())}/${suffix}`; }
  private project(suffix: string) { return `/api/projects/${encodeURIComponent(this.ctx.projectId())}/${suffix}`; }
  private report(error: unknown) { this.ctx.error.set(error instanceof Error ? error.message : String(error)); }
  async load() { try { this.site.set(await this.ctx.api<Site>(this.path('knowledge/site'))); } catch (error) { this.report(error); } }
  private async loadDoc(path: string, withHistory = true) {
    try {
      const [read, history] = await Promise.all([this.ctx.api<DocRead>(this.path(`knowledge/doc?path=${encodeURIComponent(path)}`)),
        withHistory ? this.ctx.api<{ versions: Version[] }>(this.path(`knowledge/history?path=${encodeURIComponent(path)}`)) : Promise.resolve({ versions: [] })]);
      this.doc.set(read); this.versions.set(history.versions); this.draft.set(read.content);
    } catch (error) { this.report(error); }
  }
  private async loadContents(node: string) { try { this.contents.set(await this.ctx.api<Contents>(this.path(`knowledge/contents?node=${encodeURIComponent(node)}`))); } catch (error) { this.report(error); } }
  private async loadBinding(id: string) { try { this.binding.set(await this.ctx.api<BindingView>(this.project(`knowledge/bindings/${encodeURIComponent(id)}`))); } catch (error) { this.report(error); } }

  link(kind?: string, key?: string) { return this.ctx.link(this.layerKey(), 'knowledge', ...(kind ? [kind] : []), ...(key ? [key] : [])); }
  nav(event: Event, kind?: string, key?: string) { this.menu.set(false); this.ctx.go(this.link(kind, key), event); }
  // Links inside rendered Markdown: `#node/x`, `#doc/x` and `#info` stay in Knowledge.
  follow(event: Event) {
    const anchor = (event.target as HTMLElement).closest?.('.kn-md a') as HTMLAnchorElement | null;
    const href = anchor?.getAttribute('href') || '';
    const match = /^#(doc|node|info|binding)(?:\/(.+))?$/.exec(href);
    if (match) this.nav(event, match[1], match[2]);
  }
  jump(event: Event, id: string) { event.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  html(markdown: string) { return renderMarkdown(markdown); }
  when(at: string) { const date = new Date(at); return isNaN(date.getTime()) ? at : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  isDoc(doc: DocEntry) { return this.kind() === 'doc' && docName(doc.path) === this.key(); }
  docsIn(group: string) { return (this.site()?.docs || []).filter(doc => doc.group === group); }
  isOpen(key: string, depth: number) { return this.openState()[key] ?? (depth === 0 || key.startsWith('g:')); }
  toggle(key: string) { const depth = key.startsWith('g:') || (this.site()?.information || []).some(node => node.key === key) ? 0 : 1; this.openState.update(state => ({ ...state, [key]: !this.isOpen(key, depth) })); }
  tabLabel(tab: string) { return this.site()?.layer.tabs[tab] || tab; }
  tabKeys() { return Object.keys(this.site()?.layer.tabs || {}); }
  covers(node: InfoNode) { return node.select.map(clauseText).join('; '); }
  ancestors(node: InfoNode & { path: string[] }) { return node.path.map(key => this.allNodes().find(item => item.key === key)!).filter(Boolean); }
  nodesByKey(keys: string[]) { return this.allNodes().filter(node => keys.includes(node.key)); }
  sharedParts(node: InfoNode) { return flat(node.children || []).filter(part => part.shared.length && !(this.ancestors(part).some(step => step.shared.length && step.key !== node.key))); }
  outputKinds() { return [...new Set(this.allNodes().flatMap(node => node.select.map(clause => clause.kind)))]; }
  mine(card: Card) { return card.participants.find(p => p.layer === this.layerKey()) || null; }
  others(card: Card) { return card.participants.filter(p => p.layer !== this.layerKey()).map(p => p.name).join(', '); }
  leadName(card: Card) { return card.participants.find(p => p.lead)?.name || ''; }
  partsOf(card: Card) { return (this.mine(card)?.nodes || []).map(node => node.title).join(', '); }
  // A card's nodes as the tree shows them: this layer's information under each top node it holds.
  cardTree(card: Card) { const keys = (this.mine(card)?.nodes || []).map(node => node.key); return this.allNodes().filter(node => keys.includes(node.key)); }
  decidable(b: BindingView) { return !!this.site()?.canEdit && (b.kind === 'proposal' || !!b.pending?.some(item => item.change.kind === 'lifecycle' && !item.blocked)); }
  eventText(event: { kind: string; detail: Record<string, unknown> }) {
    const words: Record<string, string> = { proposed: 'Proposed', 'change-proposed': 'Change proposed', 'change-accepted': 'Change accepted', 'change-dismissed': 'Change dismissed', refaceted: 'Renegotiated: a layer reshaped what it shares', applied: 'Applied a change automatically', settled: 'Work settled', raised: 'Work raised in the layers that have something to do' };
    return words[event.kind] || event.kind.replaceAll('-', ' ');
  }

  // ---- docs ----
  edit() { this.draft.set(this.doc()?.content || `# ${this.currentDoc()?.title || ''}\n\n`); this.editing.set(true); }
  async saveDoc() {
    const entry = this.currentDoc(), read = this.doc();
    if (!entry || !read) return;
    this.busy.set(true);
    const ok = await this.ctx.write(() => this.ctx.api(this.path('knowledge/doc'), 'PUT', { path: entry.path, content: this.draft(), base: read.commit }), 'Saved.');
    if (ok) { this.editing.set(false); await this.load(); await this.loadDoc(entry.path); }
    this.busy.set(false);
  }
  toggleHistory() { this.showHistory.update(value => !value); this.compareSet.set([]); this.compared.set(null); }
  async toggleCompare(commit: string) {
    const chosen = this.compareSet().includes(commit) ? this.compareSet().filter(item => item !== commit) : [...this.compareSet(), commit].slice(-2);
    this.compareSet.set(chosen); this.compared.set(null);
    if (chosen.length !== 2) return;
    const order = this.versions().map(version => version.commit);
    const [older, newer] = [...chosen].sort((a, b) => order.indexOf(b) - order.indexOf(a));
    const path = this.currentDoc()?.path || '';
    try {
      const [a, b] = await Promise.all([older, newer].map(at => this.ctx.api<DocRead>(this.path(`knowledge/doc?path=${encodeURIComponent(path)}&at=${at}`))));
      this.compared.set(collapse(diff(a.content, b.content)));
    } catch (error) { this.report(error); }
  }

  // ---- the spec ----
  private plain(nodes: InfoNode[]): unknown[] {
    return nodes.map(node => ({ key: node.key, title: node.title, intent: node.intent, select: node.select.length === 1 ? node.select[0] : node.select, tab: node.tab,
      ...(node.doc ? { doc: node.doc } : {}), ...(node.shape.format ? { shape: { format: node.shape.format } } : node.shape.free ? { shape: { free: true } } : {}),
      ...(node.children?.length ? { children: this.plain(node.children) } : {}) }));
  }
  newPart(parent: string | null) { const kinds = this.outputKinds(); this.partForm.set({ key: null, parent, title: '', intent: '', kind: kinds[0] || '', field: '', values: '', tab: this.tabKeys()[0] || '', format: '', about: '' }); }
  editPart(node: InfoNode) {
    const clause = node.select[0];
    this.partForm.set({ key: node.key, parent: null, title: node.title, intent: node.intent, kind: clause.kind, field: clause.where?.field || '', values: (clause.where?.in || []).join(', '), tab: node.tab, format: node.shape.format || '', about: this.doc()?.exists ? this.doc()!.content : '' });
  }
  async savePart() {
    const f = this.partForm(), s = this.site();
    if (!f || !s) return;
    const values = f.values.split(',').map(value => value.trim()).filter(Boolean);
    const select = f.field.trim() && values.length ? { kind: f.kind, where: { field: f.field.trim(), in: values } } : { kind: f.kind };
    const slug = f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'part';
    const keys = new Set(this.allNodes().map(node => node.key));
    let key = f.key || slug; for (let n = 2; !f.key && keys.has(key); n++) key = `${slug}-${n}`;
    const doc = f.about.trim() ? `knowledge/${key}.md` : undefined;
    const tree = this.plain(s.information) as Record<string, unknown>[];
    const next = { key, title: f.title.trim(), intent: f.intent.trim(), select, tab: f.tab, ...(doc ? { doc } : {}), ...(f.format.trim() ? { shape: { format: f.format } } : {}) };
    const place = (nodes: Record<string, unknown>[]): boolean => {
      for (const [i, node] of nodes.entries()) {
        if (f.key && node['key'] === f.key) { nodes[i] = { ...next, ...(node['children'] ? { children: node['children'] } : {}), ...(!doc && node['doc'] ? { doc: node['doc'] } : {}), ...(!f.format.trim() && (node['shape'] as Shape | undefined)?.free ? { shape: { free: true } } : {}) }; return true; }
        if (!f.key && node['key'] === f.parent) { node['children'] = [...((node['children'] as Record<string, unknown>[]) || []), next]; return true; }
        if (node['children'] && place(node['children'] as Record<string, unknown>[])) return true;
      }
      return false;
    };
    if (!f.key && !f.parent) tree.push(next); else if (!place(tree)) return;
    this.busy.set(true);
    const ok = await this.ctx.write(async () => {
      let base = s.layer.commit;
      if (doc && f.about.trim() !== (this.doc()?.content || '').trim()) base = (await this.ctx.api<{ commit: string }>(this.path('knowledge/doc'), 'PUT', { path: doc, content: f.about, base })).commit;
      await this.ctx.api(this.path('knowledge/information'), 'PUT', { information: tree, base });
    }, 'Saved. A task to compare this spec with the other layers was added to Work.');
    if (ok) { this.partForm.set(null); await this.load(); if (!f.key) { const notice = this.ctx.notice(); this.ctx.go(this.link('node', key)); this.ctx.notice.set(notice); } else if (doc) await this.loadDoc(doc, false); }
    this.busy.set(false);
  }
  async removePartNode(key: string) {
    const s = this.site(); if (!s) return;
    // A part without children is a leaf, so an emptied `children` goes too.
    const strip = (nodes: Record<string, unknown>[]): Record<string, unknown>[] => nodes.filter(node => node['key'] !== key).map(node => {
      if (!node['children']) return node;
      const children = strip(node['children'] as Record<string, unknown>[]), rest = { ...node };
      delete rest['children'];
      return children.length ? { ...rest, children } : rest;
    });
    this.busy.set(true);
    const ok = await this.ctx.write(() => this.ctx.api(this.path('knowledge/information'), 'PUT', { information: strip(this.plain(s.information) as Record<string, unknown>[]), base: s.layer.commit }), 'Removed.');
    if (ok) { this.partForm.set(null); await this.load(); const notice = this.ctx.notice(); this.ctx.go(this.link('info')); this.ctx.notice.set(notice); }
    this.busy.set(false);
  }

  // ---- binding from the tree ----
  startSelect() { this.selecting.set(true); this.picked.set(new Set()); this.menu.set(true); }
  cancelSelect() { this.selecting.set(false); this.picked.set(new Set()); }
  bindNode(key: string) { this.selecting.set(true); this.picked.set(new Set([key])); this.menu.set(true); this.ctx.notice.set('Selected. Tick more if you like, then choose Propose a binding.'); }
  pick(key: string, on: boolean) {
    const node = this.allNodes().find(item => item.key === key);
    const next = new Set(this.picked());
    if (on) { next.add(key); for (const child of flat(node?.children || [])) next.delete(child.key); } else next.delete(key);
    this.picked.set(next);
  }
  startPropose() {
    const s = this.site(); if (!s) return;
    this.parts.set([{ layer: s.layer.key, name: s.layer.name, nodes: [...this.picked()], lead: true, copy: true, tree: s.information }]);
    this.bindName.set(''); this.bindStatement.set(''); this.previewLines.set([]); this.previewError.set('');
    this.selecting.set(false); this.picked.set(new Set());
    this.ctx.go(this.link('propose'));
  }
  async addPart(key: string) {
    if (!key) return;
    try {
      const other = await this.ctx.api<Site>(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/layers/${encodeURIComponent(key)}/knowledge/site`);
      this.parts.update(parts => [...parts, { layer: key, name: other.layer.name, nodes: [], lead: false, copy: true, tree: other.information }]);
    } catch (error) { this.report(error); }
  }
  removePart(i: number) { this.parts.update(parts => { const next = parts.filter((_, at) => at !== i); if (!next.some(part => part.lead) && next.length) next[0] = { ...next[0], lead: true }; return next; }); void this.refreshPreview(); }
  setLead(i: number) { this.parts.update(parts => parts.map((part, at) => ({ ...part, lead: at === i }))); void this.refreshPreview(); }
  setCopy(i: number, copy: boolean) { this.parts.update(parts => parts.map((part, at) => at === i ? { ...part, copy } : part)); void this.refreshPreview(); }
  pickPart(i: number, key: string, on: boolean) {
    this.parts.update(parts => parts.map((part, at) => {
      if (at !== i) return part;
      const node = flat(part.tree).find(item => item.key === key);
      const below = new Set(flat(node?.children || []).map(child => child.key));
      return { ...part, nodes: on ? [...part.nodes.filter(item => !below.has(item)), key] : part.nodes.filter(item => item !== key) };
    }));
    void this.refreshPreview();
  }
  private input() { return { name: this.bindName().trim() || 'Untitled', statement: this.bindStatement(), participants: this.parts().filter(part => part.nodes.length).map(part => ({ layer: part.layer, nodes: part.nodes, lead: part.lead, copy: part.copy })) }; }
  private previewTick = 0;
  async refreshPreview() {
    const tick = ++this.previewTick, input = this.input();
    if (input.participants.length < 2 || !input.participants.some(part => part.lead)) { this.previewLines.set([]); this.previewError.set(input.participants.length >= 2 ? 'Choose the layer that leads among those with information ticked.' : ''); return; }
    try {
      const result = await this.ctx.api<{ effects: string[] }>(this.project('knowledge/preview'), 'POST', input);
      if (tick === this.previewTick) { this.previewLines.set(result.effects); this.previewError.set(''); }
    } catch (error) { if (tick === this.previewTick) { this.previewLines.set([]); this.previewError.set(error instanceof Error ? error.message : String(error)); } }
  }
  async submitProposal() {
    if (!this.bindName().trim()) { this.previewError.set('Name what is shared.'); return; }
    this.busy.set(true);
    let id = '';
    const ok = await this.ctx.write(async () => { id = (await this.ctx.api<{ id: string }>(this.project('knowledge/propose'), 'POST', this.input())).id; }, 'Proposed. It waits for the owner\'s decision, here or in Work.');
    this.busy.set(false);
    if (ok) { this.parts.set([]); await this.load(); const notice = this.ctx.notice(); this.ctx.go(this.link('binding', id)); this.ctx.notice.set(notice); }
  }
  cancelPropose() { this.parts.set([]); this.ctx.go(this.link('info')); }
  async decide(b: BindingView, decision: 'accept' | 'dismiss') {
    this.busy.set(true);
    const lifecycle = b.pending?.find(item => item.change.kind === 'lifecycle' && !item.blocked);
    const ok = await this.ctx.write(() => b.kind === 'proposal'
      ? this.ctx.api(this.project(`knowledge/bindings/${encodeURIComponent(b.id)}/decide`), 'POST', { decision })
      : this.ctx.api(this.project(`binding-changes/${encodeURIComponent(lifecycle!.id)}/decide`), 'POST', { decision }), decision === 'accept' ? 'Accepted. Work was raised for each layer that has something to do.' : 'Dismissed.');
    this.busy.set(false);
    if (!ok) return;
    await this.load();
    // Navigating clears the shell's notice, so it is set again on the page the decision lands on.
    const notice = this.ctx.notice();
    const live = this.site()?.bindings.find(card => card.kind === 'binding' && card.name === b.name && card.status === 'live');
    if (decision === 'accept' && live) this.ctx.go(this.link('binding', live.id)); else if (decision === 'accept') await this.loadBinding(b.id); else this.ctx.go(this.link('info'));
    this.ctx.notice.set(notice);
  }
}
