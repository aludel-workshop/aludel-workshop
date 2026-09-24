import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BuiltByComponent } from './built-by';
import { Page, PageSection, ProjectContext, statusLabel } from './context';
import { PageChangeComponent } from './pages-change';
import { buildLabel, buildOf, isBuilt, newSectionId, pageStates, PagesState, specDiff, SpecDraft, specOf, stateName } from './pages-model';
import { Inventory, PagePreviewComponent, Pick } from './pages-preview';

// Pages › Pages (PAGES-UX-01): one page at a time. The outline and the canvas point at the same sections; the inspector says
// what the selection is and why. Before a page is built its spec is edited here directly; once built, layout and behaviour
// change through a change request that becomes Engineer work. Text and images are content and change in place either way.
@Component({
  selector: 'aludel-pages-page', standalone: true,
  imports: [FormsModule, MatIconModule, BuiltByComponent, PagePreviewComponent, PageChangeComponent],
  template: `
  @if (page(); as p) {
  <div class="lay-pg-ws">
    <aside class="lay-pg-left" aria-label="Pages and outline">
      <p class="lay-pg-phead"><mat-icon aria-hidden="true">account_tree</mat-icon>Pages</p>
      <nav class="lay-pg-plist" aria-label="Page tree">
        @for (entry of tree(); track entry.page.id) {
          <a [href]="ctx.link('pages', 'page', entry.page.id)" (click)="open(entry.page.id, $event)" class="lay-pg-pitem" [class.lay-pg-child]="entry.child" [class.lay-pg-on]="entry.page.id === p.id" [attr.aria-current]="entry.page.id === p.id ? 'page' : null">
            <mat-icon aria-hidden="true">{{ entry.page.icon }}</mat-icon><span>{{ entry.page.label }}</span><i [class]="'lay-pg-dot lay-pg-' + build(entry.page)" [attr.title]="buildLabel[build(entry.page)]"></i></a>
          @if (entry.divider) { <p class="lay-pg-sub">Not in the navigation</p> }
        }
      </nav>
      <p class="lay-pg-phead"><mat-icon aria-hidden="true">segment</mat-icon>On this page
        @if (draft()) { <span class="lay-chip lay-l-pages lay-push">Editing</span> }</p>
      <div class="lay-pg-outline">
        <button type="button" class="lay-pg-oitem" [class.lay-pg-on]="!selected()" (click)="select(null)"><mat-icon aria-hidden="true">web</mat-icon><span><strong>{{ p.label }}</strong> · {{ layoutName() }}</span></button>
        <button type="button" class="lay-pg-oitem" [class.lay-pg-on]="selected()?.id === '__shell'" (click)="select({ type: 'shell', id: '__shell' })"><mat-icon aria-hidden="true">dock_to_bottom</mat-icon><span>App shell</span><small class="lay-pg-tag">shared</small></button>
        @for (s of spec().sections; track s.id; let i = $index; let last = $last) {
          <div class="lay-pg-orow">
            <button type="button" class="lay-pg-oitem" [class.lay-pg-on]="selected()?.id === s.id" [class.lay-pg-deferred]="!!s.phase" (click)="select({ type: 'sec', id: s.id })">
              <mat-icon aria-hidden="true">{{ s.region === 'side' ? 'view_sidebar' : 'view_agenda' }}</mat-icon><span>{{ s.name }}</span>
              @if (s.state !== 'ready') { <small class="lay-pg-tag">{{ stateName[s.state] }}</small> }
              @if (s.audience) { <small class="lay-pg-tag">{{ state.asName(s.audience) }}</small> }
              @if (s.phase) { <small class="lay-pg-tag">{{ s.phase.toUpperCase() }}</small> }
              @if (sectionBuild(s); as b) { <small [class]="'lay-pg-tag lay-pg-b-' + b">{{ b === 'missing' ? 'not built' : 'skeleton' }}</small> }
            </button>
            @if (draft()) { <span class="lay-pg-octl"><button type="button" (click)="move(i, -1)" [disabled]="i === 0" [attr.aria-label]="'Move ' + s.name + ' up'"><mat-icon aria-hidden="true">arrow_upward</mat-icon></button><button type="button" (click)="move(i, 1)" [disabled]="last" [attr.aria-label]="'Move ' + s.name + ' down'"><mat-icon aria-hidden="true">arrow_downward</mat-icon></button><button type="button" (click)="removeSection(s)" [attr.aria-label]="'Remove ' + s.name"><mat-icon aria-hidden="true">close</mat-icon></button></span> }
          </div>
        } @empty { <p class="lay-muted small lay-pg-pad">No sections yet. {{ built() ? 'The build shows its page type’s blocks.' : 'Edit the spec to add them.' }}</p> }
        @if (draft()) {
          <form class="lay-pg-addsec" (ngSubmit)="addSection()">
            <label>Section name<input name="secname" [(ngModel)]="newName" placeholder="e.g. Results" maxlength="40"></label>
            <label>Component<select name="seccomp" [(ngModel)]="newComponent"><option value="">Choose…</option>@for (group of componentGroups(); track group.name) { <optgroup [label]="group.name">@for (c of group.items; track c.id) { <option [value]="c.id">{{ c.name }}{{ c.status === 'needed' ? ' (needed)' : '' }}</option> }</optgroup> }</select></label>
            <button type="submit" class="lay-button small" [disabled]="!newName.trim()"><mat-icon aria-hidden="true">add</mat-icon>Add section</button>
          </form>
        }
      </div>
    </aside>

    <section class="lay-pg-center" aria-label="Page preview">
      <div class="lay-pg-cbar">
        <div class="lay-pg-seg" role="group" aria-label="Show"><button type="button" [attr.aria-pressed]="mode() === 'spec'" (click)="mode.set('spec')"><mat-icon aria-hidden="true">edit_document</mat-icon>Spec</button><button type="button" [attr.aria-pressed]="mode() === 'built'" (click)="mode.set('built')" [disabled]="!!draft()"><mat-icon aria-hidden="true">deployed_code</mat-icon>Built</button></div>
        <div class="lay-pg-seg" role="group" aria-label="Width"><button type="button" [attr.aria-pressed]="!phone()" (click)="phone.set(false)" aria-label="Desktop"><mat-icon aria-hidden="true">desktop_windows</mat-icon></button><button type="button" [attr.aria-pressed]="phone()" (click)="phone.set(true)" aria-label="Phone"><mat-icon aria-hidden="true">mobile</mat-icon></button></div>
        <label class="lay-pg-lbl">State<select [ngModel]="view()" (ngModelChange)="view.set($event)" name="state">@for (key of states; track key) { <option [value]="key">{{ stateName[key] }}{{ stateSpecified(key) ? '' : ' (not specified)' }}</option> }</select></label>
        <label class="lay-pg-lbl">As<select [ngModel]="state.as()" (ngModelChange)="state.chosenAs.set($event)" name="as">
          <optgroup label="Personas · Vision">@for (persona of state.personas(); track persona.id) { <option [value]="persona.id">{{ persona.name }}{{ persona.role ? ' · ' + persona.role : '' }}</option> }</optgroup>
          <optgroup label="Everyone else"><option value="visitor">Not signed in</option></optgroup></select></label>
        <span class="lay-push"></span>
        @if (mode() === 'spec') { <button type="button" class="lay-pg-switch" [attr.aria-pressed]="editing()" (click)="toggleEditing()"><i></i>Edit content</button> }
        @else { <button type="button" class="lay-button ghost small" (click)="rebuild()" [disabled]="rebuilding()"><mat-icon aria-hidden="true">refresh</mat-icon>{{ rebuilding() ? 'Updating…' : 'Update preview' }}</button> }
      </div>
      <aludel-page-preview [page]="p" [draft]="draft()" [mode]="mode()" [view]="view()" [viewer]="state.as()" [phone]="phone()" [editing]="editing() && mode() === 'spec'" [selected]="selected()"
        (picked)="select($event)" (content)="saveContent($event.key, $event.value)" (found)="inventory.set($event)" />
      <div class="lay-pg-cfoot">
        @if (mode() === 'built') {
          @if (!inventory()) { <span class="lay-muted">Waiting for the preview…</span> }
          @else if (inventory()?.page !== p.id) { <span class="lay-pg-warn"><mat-icon aria-hidden="true">report</mat-icon>This page isn’t in the running app yet. Update the preview to rebuild it from the specs.</span> }
          @else if (missing().length) { <span class="lay-pg-warn"><mat-icon aria-hidden="true">difference</mat-icon>Not in this build: {{ missingNames() }}</span><button type="button" class="lay-link-button" (click)="openChange(null, { title: 'Build ' + p.label + ' to its spec', why: 'The build is missing: ' + missingNames() + '.' })">Request the build</button> }
          @else { <span class="lay-muted"><mat-icon aria-hidden="true" class="lay-pg-ok">check</mat-icon>Every section in the spec is on the page{{ skeletons() ? ' (' + skeletons() + ' still skeletons)' : '' }}.</span> }
        } @else if (draft()) {
          <span class="lay-pg-draftnote">{{ diff().length ? diff().length + (diff().length === 1 ? ' change' : ' changes') : 'No changes yet' }}</span>
          @if (!built()) { <input class="lay-pg-why" [(ngModel)]="why" name="why" placeholder="Why (saved with the revision)"> }
          <span class="lay-push"></span><button type="button" class="lay-button ghost small" (click)="discard()">Discard</button>
          @if (built()) { <button type="button" class="lay-button small" [disabled]="!diff().length" (click)="openChange(draft(), null)"><mat-icon aria-hidden="true">edit_note</mat-icon>Request this change</button> }
          @else { <button type="button" class="lay-button small" [disabled]="!diff().length" (click)="saveSpec()">Save spec</button> }
        } @else {
          <span class="lay-muted">{{ editing() ? 'Click text or an image to change it. Content saves straight away.' : 'Hover to see what each part is. Click to inspect it.' }}</span>
          <span class="lay-push lay-muted small">{{ built() ? 'Layout and behaviour change through a change request.' : 'Not built yet: edit the spec directly.' }}</span>
        }
      </div>
    </section>

    <aside class="lay-pg-right" aria-label="Inspector">
      @switch (selected()?.type) {
        @case ('shell') {
          <div class="lay-row"><span class="lay-chip lay-l-pages"><mat-icon aria-hidden="true">dock_to_bottom</mat-icon>Layout</span><span class="lay-chip lay-plain">Shared by every page</span></div>
          <h2>App shell</h2>
          <p class="small">The top bar on wide screens and the tab bar on phones. It comes from the navigation and the Page scaffold in Design.</p>
          <dl class="lay-pg-kv"><dt>Navigation</dt><dd>{{ navNames() }}</dd><dt>Scaffold</dt><dd><a [href]="ctx.link('design', 'components')" (click)="ctx.go(ctx.link('design', 'components'), $event)">Design › Components</a></dd></dl>
          <a class="lay-button ghost small" [href]="'/start/' + ctx.projectId() + '/pages'">Edit navigation</a>
        }
        @case ('content') {
          @if (contentField(); as f) {
            <div class="lay-row"><button type="button" class="lay-link-button" (click)="select(f.section ? { type: 'sec', id: f.section.id } : null)"><mat-icon aria-hidden="true">arrow_back</mat-icon>{{ f.section?.name || p.label }}</button><span class="lay-chip lay-pg-ctchip"><mat-icon aria-hidden="true">{{ f.field === 'image' ? 'image' : 'text_fields' }}</mat-icon>Content</span></div>
            <h2>{{ f.label }}</h2>
            @if (f.field === 'image') {
              <div class="lay-pg-images">
                <button type="button" [class.lay-pg-on]="!f.value" (click)="saveContent(f.key, '')"><mat-icon aria-hidden="true">hide_image</mat-icon>None</button>
                @for (asset of images(); track asset.id) { <button type="button" [class.lay-pg-on]="f.value === asset.id" (click)="saveContent(f.key, asset.id)"><img [src]="ctx.uploadUrl(asset.assetId)" alt="">{{ asset.name }}</button> }
              </div>
              <p class="lay-muted small">Images come from Design › Brand. <a [href]="ctx.link('design', 'brand')" (click)="ctx.go(ctx.link('design', 'brand'), $event)">Add one there</a>.</p>
            } @else {
              <label class="lay-form">Text<textarea rows="3" [ngModel]="f.value" (ngModelChange)="contentDraft = $event" (blur)="saveContent(f.key, contentDraft ?? f.value)" name="ct"></textarea></label>
            }
            <p class="lay-pg-callout"><mat-icon aria-hidden="true">bolt</mat-icon>Content saves straight away as a revision of the page. The running app picks it up the next time the preview updates; no code changes.</p>
            @if (f.section && built()) { <button type="button" class="lay-button ghost small" (click)="select({ type: 'sec', id: f.section.id }); openChange(null, { title: p.label + ': change ' + f.section.name })"><mat-icon aria-hidden="true">edit_note</mat-icon>Change what this part does</button> }
          }
        }
        @case ('sec') {
          @if (section(); as s) {
            <div class="lay-row"><button type="button" class="lay-link-button" (click)="select(null)"><mat-icon aria-hidden="true">arrow_back</mat-icon>{{ p.label }}</button><span class="lay-chip lay-l-pages"><mat-icon aria-hidden="true">view_agenda</mat-icon>Section</span>
              @if (sectionBuild(s); as b) { <span [class]="'lay-chip lay-pg-b-' + b">{{ b === 'missing' ? 'Not in this build' : 'Skeleton' }}</span> }</div>
            @if (draft()) {
              <form class="lay-form lay-pg-secform">
                <label>Name<input name="n" [ngModel]="s.name" (ngModelChange)="edit(s.id, { name: $event })" maxlength="40"></label>
                <label>Component<select name="c" [ngModel]="s.component || ''" (ngModelChange)="edit(s.id, { component: $event || null })"><option value="">None yet</option>@for (group of componentGroups(); track group.name) { <optgroup [label]="group.name">@for (c of group.items; track c.id) { <option [value]="c.id">{{ c.name }}</option> }</optgroup> }</select></label>
                <label>Shown when<select name="st" [ngModel]="s.state" (ngModelChange)="edit(s.id, { state: $event })">@for (key of states; track key) { <option [value]="key">{{ stateName[key] }}</option> }</select></label>
                <label>Shown to<select name="au" [ngModel]="s.audience || ''" (ngModelChange)="edit(s.id, { audience: $event || null })"><option value="">Everyone</option>@for (persona of state.personas(); track persona.id) { <option [value]="persona.id">{{ persona.name }}</option> }</select></label>
                <label>Leads to<select name="lt" [ngModel]="s.leadsTo || ''" (ngModelChange)="edit(s.id, { leadsTo: $event || null })"><option value="">Nowhere</option>@for (other of otherPages(); track other.id) { <option [value]="other.id">{{ other.label }}</option> }</select></label>
                <label>Where<select name="rg" [ngModel]="s.region" (ngModelChange)="edit(s.id, { region: $event })"><option value="main">Main column</option><option value="side">Side column</option></select></label>
                <label>Milestone<select name="ph" [ngModel]="s.phase || ''" (ngModelChange)="edit(s.id, { phase: $event || null })"><option value="">Now</option><option value="mvp">MVP</option><option value="later">Later</option></select></label>
                <label>Note for whoever builds it<textarea name="nt" rows="2" [ngModel]="s.note" (ngModelChange)="edit(s.id, { note: $event })"></textarea></label>
              </form>
              <h3>Stories</h3>
              @for (id of s.stories; track id) { <div class="lay-pg-story"><b>{{ ctx.storyById().get(id)?.ref }}</b><span>{{ ctx.storyById().get(id)?.title }}</span><button type="button" class="lay-link-button" (click)="edit(s.id, { stories: without(s.stories, id) })">Remove</button></div> }
              <label class="lay-pg-inline">Add a story<select #st (change)="st.value && edit(s.id, { stories: [...s.stories, st.value] }); st.value = ''"><option value="">Choose…</option>@for (story of ctx.data()?.stories || []; track story.id) { @if (!s.stories.includes(story.id)) { <option [value]="story.id">{{ story.ref }} {{ story.title }}</option> } }</select></label>
              <h3>Data it shows or changes</h3>
              @for (id of s.data; track id) { <div class="lay-pg-story"><b>{{ ctx.objectById().get(id) ? 'Object' : 'Operation' }}</b><span>{{ state.name(id) }}</span><button type="button" class="lay-link-button" (click)="edit(s.id, { data: without(s.data, id) })">Remove</button></div> }
              <label class="lay-pg-inline">Add data<select #dt (change)="dt.value && edit(s.id, { data: [...s.data, dt.value] }); dt.value = ''"><option value="">Choose…</option><optgroup label="Objects">@for (o of ctx.data()?.objects || []; track o.id) { <option [value]="o.id">{{ o.name }}</option> }</optgroup><optgroup label="Operations">@for (o of ctx.data()?.operations || []; track o.id) { <option [value]="o.id">{{ o.operationId }}</option> }</optgroup></select></label>
            } @else {
              <h2>{{ s.name }}</h2>
              <dl class="lay-pg-kv">
                <dt>Component</dt><dd>@if (s.component) { <a [href]="ctx.link('design', 'components', s.component)" (click)="ctx.go(ctx.link('design', 'components', s.component), $event)">{{ state.name(s.component) }}</a>@if (ctx.componentById().get(s.component)?.status === 'needed') { <span class="lay-chip lay-pg-b-missing">Needed in Design</span> } } @else { <span class="lay-muted">None yet</span> }</dd>
                <dt>Shown when</dt><dd>{{ stateName[s.state] }}</dd>
                <dt>Shown to</dt><dd>{{ s.audience ? state.asName(s.audience) : 'Everyone' }}</dd>
                @if (s.leadsTo) { <dt>Leads to</dt><dd><a [href]="ctx.link('pages', 'page', s.leadsTo)" (click)="open(s.leadsTo, $event)">{{ state.name(s.leadsTo) }}</a></dd> }
                @if (s.data.length) { <dt>Data</dt><dd>@for (id of s.data; track id) { <a class="lay-pg-ref" [href]="ctx.recordHref(ctx.objectById().get(id) ? 'data_object' : 'data_operation', id)" (click)="ctx.go(ctx.recordHref(ctx.objectById().get(id) ? 'data_object' : 'data_operation', id), $event)">{{ state.name(id) }}</a> }</dd> }
                <dt>Where</dt><dd>{{ s.region === 'side' ? 'Side column' : 'Main column' }}{{ s.phase ? ' · ' + s.phase.toUpperCase() : '' }}</dd>
              </dl>
              @if (s.note) { <p class="small">{{ s.note }}</p> }
              <h3>Stories</h3>
              @for (id of s.stories; track id) { <div class="lay-pg-story"><b>{{ ctx.storyById().get(id)?.ref }}</b><span>{{ ctx.storyById().get(id)?.title }}</span><span class="lay-chip lay-plain">{{ statusLabel[ctx.storyById().get(id)?.status || 'proposed'] }}</span></div> }
              @empty { <p class="lay-muted small">None linked.</p> }
              <h3>Content</h3>
              <div class="lay-pg-cts">@for (field of ['title', 'body', 'action', 'image']; track field) { <button type="button" (click)="editContent(s.id + ':' + field)"><mat-icon aria-hidden="true">{{ field === 'image' ? 'image' : 'text_fields' }}</mat-icon><span>{{ fieldName[field] }}</span><small>{{ field === 'image' ? (s.content.image ? state.name(s.content.image) : 'none') : $any(s.content)[field] || 'empty' }}</small></button> }</div>
            }
            <div class="lay-pg-actions">
              @if (built() && !draft()) { <button type="button" class="lay-button" (click)="openChange(null, { title: p.label + ': change ' + s.name })"><mat-icon aria-hidden="true">edit_note</mat-icon>Request a change</button>
                @if (sectionBuild(s) === 'missing') { <button type="button" class="lay-button ghost" (click)="openChange(null, { title: 'Build ' + s.name + ' on ' + p.label, why: s.name + ' is in the spec but not in the build.' })">Request the build</button> } }
              @if (!draft()) { <button type="button" class="lay-button ghost small" (click)="startEdit()"><mat-icon aria-hidden="true">edit</mat-icon>Edit spec</button> }
            </div>
          } @else { <p class="lay-muted">That part isn’t in {{ p.label }}’s spec.</p><button type="button" class="lay-link-button" (click)="select(null)">Back to the page</button> }
        }
        @default {
          <div class="lay-row lay-wrap"><span class="lay-chip lay-l-pages"><mat-icon aria-hidden="true">web</mat-icon>Page</span><span [class]="'lay-chip lay-pg-c-' + build(p)">{{ buildLabel[build(p)] }}</span>@if (p.status === 'designed') { <span class="lay-chip lay-plain">Spec accepted</span> }@if (p.inNav) { <span class="lay-chip lay-plain">In navigation</span> }</div>
          <h2>{{ p.label }}</h2>
          <label class="lay-form">What happens here<textarea rows="2" [ngModel]="p.description" (ngModelChange)="descriptionDraft = $event" (blur)="saveContent('__page:description', descriptionDraft ?? p.description)" name="desc" placeholder="Who comes here, and what they get done."></textarea></label>
          @if (p.notes) { <p class="small lay-muted">Note from the Map: {{ p.notes }}</p> }
          <dl class="lay-pg-kv">
            <dt>Layout</dt><dd>@if (draft()) { <select [ngModel]="spec().pageType" (ngModelChange)="setType($event)" name="type">@for (type of types(); track type.id) { <option [value]="type.id">{{ type.label }}</option> }</select> } @else { {{ layoutName() }} }</dd>
            <dt>Address</dt><dd class="lay-mono">{{ ctx.data()?.pagePaths?.[p.id] || '—' }}</dd>
            <dt>Origin</dt><dd>{{ p.origin }}</dd>
          </dl>
          <h3>Stories it realises</h3>
          @for (id of p.stories; track id) { <div class="lay-pg-story"><b>{{ ctx.storyById().get(id)?.ref }}</b><span>{{ ctx.storyById().get(id)?.title }}</span><button type="button" class="lay-link-button" (click)="unlink(p, id)" [attr.aria-label]="'Unlink ' + ctx.storyById().get(id)?.title">Unlink</button></div> }
          @empty { <p class="lay-muted small">None linked.</p> }
          <label class="lay-pg-inline">Link a story<select #pick (change)="link(p, pick.value); pick.value = ''"><option value="">Choose…</option>@for (story of unlinked(); track story.id) { <option [value]="story.id">{{ story.ref }} {{ story.title }}</option> }</select></label>
          <h3>States</h3>
          <table class="lay-pg-states"><thead><tr><th>State</th><th>Specified</th></tr></thead><tbody>
            @for (key of states; track key) { <tr [class.lay-pg-on]="view() === key"><td><button type="button" class="lay-link-button" (click)="view.set(key)">{{ stateName[key] }}</button></td>
              <td>@if (draft() && key !== 'ready') { <label class="lay-pg-statecheck"><input type="checkbox" [checked]="spec().states[key] !== undefined" (change)="toggleState(key)">@if (spec().states[key] !== undefined) { <input [ngModel]="spec().states[key]" (ngModelChange)="setState(key, $event)" [name]="'st-' + key" placeholder="What it shows"> }</label> }
                @else if (stateSpecified(key)) { <mat-icon aria-hidden="true" class="lay-pg-ok">check</mat-icon><span class="small">{{ spec().states[key] }}</span> } @else { <span class="lay-muted">—</span> }</td></tr> }
          </tbody></table>
          @if (unspecifiedStates().length && !draft()) { <button type="button" class="lay-link-button" (click)="askDesign('Specify the ' + unspecifiedStates().join(', ') + ' states of ' + p.label)"><mat-icon aria-hidden="true">add_task</mat-icon>Ask the Experience designer to specify {{ unspecifiedStates().join(', ') }}</button> }
          @if (dataUsed().length) { <h3>Data it uses</h3><div class="lay-row lay-wrap">@for (id of dataUsed(); track id) { <a class="lay-pg-ref" [href]="ctx.recordHref(ctx.objectById().get(id) ? 'data_object' : 'data_operation', id)" (click)="ctx.go(ctx.recordHref(ctx.objectById().get(id) ? 'data_object' : 'data_operation', id), $event)">{{ state.name(id) }}</a> }</div> }
          <h3>Leads to</h3>
          <div class="lay-row lay-wrap">@for (link of p.links; track link.to) { <a class="lay-pg-ref" [href]="ctx.link('pages', 'page', link.to)" (click)="open(link.to, $event)"><mat-icon aria-hidden="true">arrow_forward</mat-icon>{{ state.name(link.to) }} <small>{{ link.label }}</small></a> } @empty { <span class="lay-muted small">Nowhere yet. Draw links on the Map.</span> }</div>
          @if (flowsHere().length) { <h3>In flows</h3><div class="lay-row lay-wrap">@for (flow of flowsHere(); track flow.id) { <a class="lay-pg-ref" [href]="ctx.link('pages', 'flows', flow.id)" (click)="ctx.go(ctx.link('pages', 'flows', flow.id), $event)"><mat-icon aria-hidden="true">route</mat-icon>{{ flow.title }}</a> }</div> }
          @if (references().length) { <h3>References</h3><div class="lay-row lay-wrap">@for (ref of references(); track ref.id) { <a class="lay-pg-ref" [href]="ref.href" (click)="ctx.go(ref.href, $event)"><mat-icon aria-hidden="true">local_library</mat-icon>{{ ref.label }}</a> }</div> }
          <h3>Built by</h3>
          <aludel-built-by [recordId]="p.id" />
          <h3>Why it is this way</h3>
          @for (entry of history(); track entry.revision) { <p class="lay-pg-why-entry">{{ entry.rationale }}<br><small>Revision {{ entry.revision }} · {{ entry.author }} · {{ entry.createdAt.slice(0, 10) }}@if (entry.workItemId) { · {{ ctx.workById().get(entry.workItemId)?.ref }} }</small></p> }
          @empty { <p class="lay-muted small">No recorded decisions yet.</p> }
          <div class="lay-pg-actions">
            @if (!draft()) {
              <button type="button" class="lay-button" (click)="startEdit()"><mat-icon aria-hidden="true">edit</mat-icon>Edit spec</button>
              @if (built()) { <button type="button" class="lay-button ghost" (click)="openChange(null, null)"><mat-icon aria-hidden="true">edit_note</mat-icon>Request a change</button> }
              @if (p.status !== 'designed' && p.sections.length) { <button type="button" class="lay-button ghost" (click)="accept(p)"><mat-icon aria-hidden="true">verified</mat-icon>Accept spec</button> }
            }
            <p class="lay-muted small">{{ built() ? 'Built: layout and behaviour changes are drafted in the spec and go to Work as Engineer · implement.' : 'Not built yet: spec edits save directly. Accepting the spec marks its stories as designed.' }}</p>
          </div>
        }
      }
    </aside>
  </div>
  @if (change(); as c) { <aludel-page-change [page]="p" [draft]="c.draft" [summary]="c.draft ? diff() : []" [prefill]="c.prefill" (closed)="change.set(null)" (sent)="changeSent()" /> }
  } @else { <p class="lay-muted">No pages yet. Add a page blank on the Map.</p> }`
})
export class PagesPageComponent {
  readonly ctx = inject(ProjectContext);
  readonly state = inject(PagesState);
  readonly buildLabel = buildLabel;
  readonly stateName = stateName;
  readonly statusLabel = statusLabel;
  readonly states = pageStates;
  readonly fieldName: Record<string, string> = { title: 'Heading', body: 'Text', action: 'Button label', image: 'Image' };
  readonly pages = computed(() => this.ctx.data()?.pages || []);
  readonly page = computed(() => { const id = this.ctx.segments()[2]; return this.pages().find(page => page.id === id) || this.tree()[0]?.page || null; });
  readonly tree = computed(() => {
    const pages = this.pages(), nav = pages.filter(page => page.inNav && !page.parentId), rest = pages.filter(page => !page.inNav && !page.parentId);
    const withKids = (list: Page[]) => list.flatMap(page => [{ page, child: false, divider: false }, ...pages.filter(kid => kid.parentId === page.id).map(kid => ({ page: kid, child: true, divider: false }))]);
    const top = withKids(nav);
    if (top.length && rest.length) top[top.length - 1] = { ...top[top.length - 1], divider: true };
    return [...top, ...withKids(rest)];
  });
  readonly mode = signal<'spec' | 'built'>('spec');
  readonly view = signal('ready');
  readonly phone = signal(false);
  readonly editing = signal(false);
  readonly selected = signal<Pick | null>(null);
  readonly draft = signal<SpecDraft | null>(null);
  readonly inventory = signal<Inventory | null>(null);
  readonly change = signal<{ draft: SpecDraft | null; prefill: { title?: string; why?: string } | null } | null>(null);
  readonly rebuilding = signal(false);
  newName = ''; newComponent = ''; why = '';
  descriptionDraft: string | null = null; contentDraft: string | null = null;

  constructor() {
    // A different page starts clean.
    effect(() => { this.page()?.id; untracked(() => { this.selected.set(null); this.draft.set(null); this.inventory.set(null); this.descriptionDraft = null; }); });
    // Handed over from Flows: open with Edit content on, or with a change request ready.
    effect(() => { const intent = this.state.intent(), page = this.page(); if (!intent || !page || intent.page !== page.id) return;
      untracked(() => { this.state.intent.set(null); if (intent.edit) { this.mode.set('spec'); this.editing.set(true); } if (intent.change) this.openChange(null, intent.change); }); });
    // A section shown only in another state brings that state up when selected.
    effect(() => { const s = this.section(); if (s && s.state !== untracked(() => this.view())) this.view.set(s.state); });
  }

  readonly built = computed(() => { const page = this.page(); return page ? isBuilt(this.ctx, page) : false; });
  readonly spec = computed<SpecDraft>(() => this.draft() || (this.page() ? specOf(this.page()!) : { sections: [], states: {}, pageType: 'detail' }));
  readonly diff = computed(() => { const page = this.page(), draft = this.draft(); return page && draft ? specDiff(specOf(page), draft, id => this.state.name(id)) : []; });
  readonly section = computed(() => { const sel = this.selected(); return sel?.type === 'sec' ? this.spec().sections.find(entry => entry.id === sel.id) || null : null; });
  readonly layoutName = computed(() => this.ctx.catalog()?.pageTypes[this.spec().pageType]?.label || this.spec().pageType);
  readonly types = computed(() => Object.entries(this.ctx.catalog()?.pageTypes || {}).map(([id, value]) => ({ id, label: value.label })));
  readonly componentGroups = computed(() => {
    const all = (this.ctx.data()?.components || []).filter(c => c.group !== 'Navigation' && c.group !== 'Layouts');
    return [...new Set(all.map(c => c.group))].map(name => ({ name, items: all.filter(c => c.group === name) }));
  });
  readonly otherPages = computed(() => this.pages().filter(page => page.id !== this.page()?.id));
  readonly unlinked = computed(() => (this.ctx.data()?.stories || []).filter(story => !this.page()?.stories.includes(story.id)));
  readonly images = computed(() => (this.ctx.data()?.brand || []).filter(asset => asset.type === 'image' && asset.assetId));
  readonly flowsHere = computed(() => (this.ctx.data()?.flows || []).filter(flow => flow.steps.some(step => step.page === this.page()?.id)));
  readonly dataUsed = computed(() => [...new Set(this.spec().sections.flatMap(section => section.data))]);
  readonly history = computed(() => [...(this.page()?.history || [])].reverse());
  readonly references = computed(() => this.ctx.referencesFor(this.page()?.id || '').map(link => this.ctx.refInfo(link.sourceRef || '')).filter(info => !!info).map(info => info!));
  readonly navNames = computed(() => this.pages().filter(page => page.inNav && !page.parentId).map(page => page.label).join(' · '));
  readonly unspecifiedStates = computed(() => pageStates.filter(key => !this.stateSpecified(key)).map(key => stateName[key].toLowerCase()));
  // Built: sections of the Ready spec the running page doesn't have, and ones that are still generated skeletons.
  readonly missing = computed(() => { const inv = this.inventory(); if (!inv || inv.page !== this.page()?.id) return []; const found = new Set(inv.sections.map(entry => entry.id)); return this.spec().sections.filter(s => s.state === 'ready' && !found.has(s.id)); });
  readonly missingNames = computed(() => this.missing().map(s => s.name).join(', '));
  readonly skeletons = computed(() => this.inventory()?.sections.filter(entry => entry.skeleton).length || 0);
  readonly contentField = computed(() => {
    const sel = this.selected(); const page = this.page(); if (sel?.type !== 'content' || !page) return null;
    const [sectionId, field] = sel.id.split(':');
    if (sectionId === '__page') return { key: sel.id, field, label: 'Page description', value: page.description, section: null as PageSection | null };
    const section = this.spec().sections.find(entry => entry.id === sectionId) || null;
    const value = section ? String((section.content as unknown as Record<string, string | null>)[field] || '') : '';
    return { key: sel.id, field, label: `${section?.name || 'Section'} · ${this.fieldName[field] || field}`, value, section };
  });

  build(page: Page) { return buildOf(this.ctx, page); }
  stateSpecified(key: string) { return key === 'ready' || this.spec().states[key] !== undefined || this.spec().sections.some(section => section.state === key); }
  sectionBuild(s: PageSection): 'missing' | 'skeleton' | null {
    const inv = this.inventory(); if (!inv || inv.page !== this.page()?.id || this.mode() !== 'built') return null;
    const found = inv.sections.find(entry => entry.id === s.id);
    return found ? (found.skeleton ? 'skeleton' : null) : s.state === 'ready' ? 'missing' : null;
  }
  without(list: string[], id: string) { return list.filter(entry => entry !== id); }
  open(id: string, event?: Event) { this.ctx.go(this.ctx.link('pages', 'page', id), event); }
  select(pick: Pick | null) { this.selected.set(pick); this.contentDraft = null; }
  editContent(key: string) { this.editing.set(true); this.mode.set('spec'); this.select({ type: 'content', id: key }); }
  toggleEditing() { this.editing.update(value => !value); if (!this.editing() && this.selected()?.type === 'content') this.select(null); }

  // ---- The spec ----
  startEdit() { const page = this.page(); if (!page) return; this.mode.set('spec'); this.editing.set(false); this.draft.set(specOf(page)); this.why = ''; }
  discard() { this.draft.set(null); if (this.selected()?.type === 'sec' && !this.section()) this.select(null); }
  private mutate(change: (draft: SpecDraft) => void) { const current = this.draft(); if (!current) return; const next = structuredClone(current); change(next); this.draft.set(next); }
  edit(id: string, changes: Partial<PageSection>) { this.mutate(draft => { const s = draft.sections.find(entry => entry.id === id); if (s) Object.assign(s, changes); }); }
  setType(type: string) { this.mutate(draft => { draft.pageType = type; }); }
  toggleState(key: string) { this.mutate(draft => { if (draft.states[key] === undefined) draft.states[key] = ''; else delete draft.states[key]; }); }
  setState(key: string, value: string) { this.mutate(draft => { draft.states[key] = value; }); }
  addSection() {
    const name = this.newName.trim(); if (!name) return;
    const id = newSectionId();
    const view = this.view();
    this.mutate(draft => draft.sections.push({ id, name, component: this.newComponent || null, region: 'main', stories: [], data: [], leadsTo: null, audience: null, state: view, phase: null, note: '', content: { title: '', body: '', action: '', image: null } }));
    this.newName = ''; this.newComponent = '';
    this.select({ type: 'sec', id });
  }
  removeSection(s: PageSection) { this.mutate(draft => { draft.sections = draft.sections.filter(entry => entry.id !== s.id); }); if (this.selected()?.id === s.id) this.select(null); }
  move(index: number, by: number) { this.mutate(draft => { const [s] = draft.sections.splice(index, 1); draft.sections.splice(index + by, 0, s); }); }
  async saveSpec() {
    const page = this.page(), draft = this.draft(); if (!page || !draft) return;
    const rationale = this.why.trim() || this.diff().join('; ');
    const ok = await this.ctx.write(() => this.ctx.change(page.id, { sections: draft.sections, states: draft.states, pageType: draft.pageType }, page.revision, rationale), `${page.label}’s spec is saved as revision ${page.revision + 1}.`);
    if (ok) this.draft.set(null);
  }
  accept(page: Page) { void this.ctx.write(() => this.ctx.change(page.id, { status: 'designed' }, page.revision, 'Spec accepted'), `${page.label}’s spec is accepted. Its stories count as designed.`); }
  openChange(draft: SpecDraft | null, prefill: { title?: string; why?: string } | null) { this.change.set({ draft, prefill }); }
  changeSent() { const hadDraft = !!this.change()?.draft; this.change.set(null); if (hadDraft) this.draft.set(null); }

  // ---- Content: straight to the page record, and into an open draft so saving the draft keeps it ----
  async saveContent(key: string, value: string) {
    const page = this.page(); if (!page) return;
    this.descriptionDraft = null; this.contentDraft = null;
    const [sectionId, field] = key.split(':');
    if (sectionId === '__page') { if (value !== page.description) await this.ctx.write(() => this.ctx.change(page.id, { description: value }, page.revision, 'Content: page description')); return; }
    const setField = (sections: PageSection[]) => sections.map(s => s.id === sectionId ? { ...s, content: { ...s.content, [field]: field === 'image' ? value || null : value } } : s);
    const saved = page.sections.find(s => s.id === sectionId);
    this.mutate(draft => { draft.sections = setField(draft.sections); });
    if (!saved || String((saved.content as unknown as Record<string, string | null>)[field] || '') === value) return;
    await this.ctx.write(() => this.ctx.change(page.id, { sections: setField(page.sections) }, page.revision, `Content: ${saved.name} ${this.fieldName[field]?.toLowerCase() || field}`), 'Content saved.');
  }

  link(page: Page, storyId: string) { if (storyId) void this.ctx.write(() => this.ctx.change(page.id, { stories: [...page.stories, storyId] }, page.revision, `Now realises ${this.ctx.storyById().get(storyId)?.ref}`), 'Story linked.'); }
  unlink(page: Page, storyId: string) { void this.ctx.write(() => this.ctx.change(page.id, { stories: page.stories.filter(id => id !== storyId) }, page.revision, `No longer realises ${this.ctx.storyById().get(storyId)?.ref}`), 'Story unlinked.'); }
  askDesign(title: string) {
    const page = this.page(); if (!page) return;
    void this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/work`, 'POST', { action: 'pages.design', title, state: 'ready', targets: [{ id: page.id, label: `${page.label} page` }] }), 'Added to Work for the Experience designer.');
  }
  async rebuild() {
    this.rebuilding.set(true);
    const ok = await this.ctx.write(() => this.ctx.api(`/api/projects/${encodeURIComponent(this.ctx.projectId())}/skeleton`, 'POST'), 'The app is rebuilding from its specs. The preview reloads when it is ready.');
    this.rebuilding.set(false);
    if (ok) { const mode = this.mode(); this.mode.set('spec'); setTimeout(() => this.mode.set(mode), 50); }
  }
}
