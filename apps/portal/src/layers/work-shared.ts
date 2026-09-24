import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { botAvatar, personAvatar } from '../avatars';
import { Assignee, Batch, ProjectContext, WorkItem, layerLabel, priorityIcon, priorityLabel } from './context';

// WORK-UX-01 shared pieces for the Work layer: every person and agent looks the same everywhere, every referenced record
// is a chip with a hover card, and every item is one card whether it sits in a batch or in the stack.

// Actions agents can run today (the runner's tasks); others need a person until LAY-05.
export const agentRunnable = (item: WorkItem) => item.action === 'product.define' || item.action === 'data.contract' || (item.action === 'product.clarify' && Boolean(item.question && !item.question.answer));
export const batchOf = (ctx: ProjectContext, item: WorkItem): Batch | null => (item.context?.batch && ctx.data()?.batches.find(batch => batch.id === item.context?.batch)) || null;
export const isRunning = (batch: Batch | null) => Boolean(batch && (batch.state === 'running' || batch.state === 'stopping'));
export const elapsed = (from: string | undefined, to: number) => {
  if (!from) return '';
  const seconds = Math.max(0, Math.round((to - Date.parse(from)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : minutes ? `${minutes}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`;
};
export const tokens = (count: number) => count >= 10000 ? `${Math.round(count / 1000)}k` : count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);

@Component({
  selector: 'aludel-avatar', standalone: true, imports: [MatIconModule],
  template: `@if (who()?.kind === 'template') { <span class="lay-av lay-av-template" [class]="'lay-av lay-av-template lay-av-' + size()" aria-hidden="true"><mat-icon>magic_button</mat-icon></span> }
    @else { <img [class]="'lay-av lay-av-' + size() + (who()?.kind === 'agent' ? ' lay-av-bot' : '')" [src]="src()" alt="" [attr.aria-hidden]="true"> }`
})
export class AvatarComponent {
  private readonly ctx = inject(ProjectContext);
  private readonly sanitizer = inject(DomSanitizer);
  readonly who = input<Assignee | null>(null);
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('sm');
  // Our own DiceBear SVG (options are validated on the server), so the data URI is trusted.
  readonly src = computed(() => {
    const who = this.who();
    if (who?.kind === 'agent') { const profile = this.ctx.profileById().get(who.id || ''); return this.sanitizer.bypassSecurityTrustUrl(botAvatar(profile?.avatar.seed || who.id || 'agent', profile?.avatar.color || '#4b6ea8')); }
    const member = this.ctx.memberById().get(who?.id || '');
    return this.sanitizer.bypassSecurityTrustUrl(personAvatar(member?.avatar, member?.name || who?.label || 'someone'));
  });
}

let cardCount = 0;
// A reference to any record, with the small card Confluence-style links show on hover or focus (A3).
@Component({
  selector: 'aludel-ref', standalone: true, imports: [MatIconModule],
  template: `@if (info(); as r) {
    <a [class]="'lay-ref lay-ref-' + r.layer" [href]="r.href" (click)="hide(); ctx.go(r.href, $event)" (mouseenter)="enter()" (mouseleave)="leave()" (focus)="show()" (blur)="leave()"
      [attr.aria-describedby]="shown() ? cardId : null" [attr.aria-label]="short() && shortLabel(r) !== r.label ? r.label : null"><mat-icon aria-hidden="true">{{ r.icon }}</mat-icon><span>{{ short() ? shortLabel(r) : r.label }}</span></a>
    @if (shown()) {
      <div class="lay-refcard" role="tooltip" [id]="cardId" [style.left.px]="position().left" [style.top.px]="position().top" (mouseenter)="enter()" (mouseleave)="leave()">
        <div class="lay-refcard-head"><span [class]="'lay-chip lay-l-' + r.layer"><mat-icon aria-hidden="true">{{ r.icon }}</mat-icon>{{ r.kindLabel }}</span>@if (r.status) { <span class="lay-chip lay-plain">{{ r.status }}</span> }</div>
        <strong>{{ r.title }}</strong>
        @if (r.note) { <p>{{ r.note }}</p> }
        @if (r.facts.length) { <dl>@for (fact of r.facts; track fact[0]) { <dt>{{ fact[0] }}</dt><dd>{{ fact[1] }}</dd> }</dl> }
        <div class="lay-refcard-foot"><span>{{ r.where }}</span><a [href]="r.href" (click)="hide(); ctx.go(r.href, $event)" tabindex="-1">Open<mat-icon aria-hidden="true">arrow_forward</mat-icon></a></div>
      </div>
    }
  } @else { <span class="lay-ref lay-ref-missing">{{ fallback() || 'Deleted record' }}</span> }`
})
export class RefChipComponent {
  readonly ctx = inject(ProjectContext);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly id = input.required<string>();
  readonly short = input(false);
  readonly fallback = input('');
  readonly info = computed(() => this.ctx.refInfo(this.id()));
  // A compact chip shows a handle, not the whole record (ROADMAP-01): an item, story or project's number, a Brief claim's
  // section, or the kind of record; the quick view has the rest.
  shortLabel(r: { kind: string; kindLabel: string; label: string }) {
    if (['work_item', 'story', 'project'].includes(r.kind)) return r.label.split(' ')[0];
    if (['brief_claim', 'insight', 'finding', 'source'].includes(r.kind)) return r.kindLabel;
    return r.label;
  }
  readonly shown = signal(false);
  readonly position = signal({ left: 0, top: 0 });
  readonly cardId = `lay-refcard-${++cardCount}`;
  private timer: ReturnType<typeof setTimeout> | null = null;
  enter() { this.clear(); if (!this.shown()) this.timer = setTimeout(() => this.show(), 280); }
  leave() { this.clear(); this.timer = setTimeout(() => this.hide(), 180); }
  show() {
    this.clear();
    const rect = (this.host.nativeElement.querySelector('a') as HTMLElement).getBoundingClientRect();
    const width = Math.min(320, innerWidth - 24);
    const below = rect.bottom + 6 + 220 < innerHeight;
    this.position.set({ left: Math.min(Math.max(12, rect.left), innerWidth - width - 12), top: below ? rect.bottom + 6 : Math.max(12, rect.top - 226) });
    this.shown.set(true);
  }
  hide() { this.clear(); this.shown.set(false); }
  private clear() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
}

// Split chip: the left half opens whoever it is; the right half changes it (A11). Locked while a batch runs.
@Component({
  selector: 'aludel-assignee', standalone: true, imports: [MatIconModule, MatMenuModule, MatTooltipModule, AvatarComponent],
  template: `
  <span class="lay-split" [class.lay-split-agent]="assignee()?.kind === 'agent'" [style.--lay-metal]="metal()" [class.lay-split-warn]="assignee()?.kind === 'agent' && !ctx.agentReady()">
    <a class="lay-split-who" [href]="whoHref()" (click)="openWho($event)" [attr.aria-label]="label() + ': ' + ctx.whoName(assignee())"><aludel-avatar [who]="assignee()" /><span>{{ ctx.whoName(assignee()) }}</span></a>
    @if (assignee()?.kind !== 'template') {
      <button type="button" class="lay-split-drop" [matMenuTriggerFor]="menu" [disabled]="!!locked()" [matTooltip]="locked() || ''" [attr.aria-label]="locked() ? 'Assignee locked: ' + locked() : 'Change ' + label().toLowerCase()">
        <mat-icon aria-hidden="true">{{ locked() ? 'lock' : 'expand_more' }}</mat-icon></button>
    }
  </span>
  <mat-menu #menu="matMenu" class="lay-menu" xPosition="before">
    <p class="lay-menu-head">People</p>
    @for (member of ctx.data()?.members || []; track member.id) {
      <button mat-menu-item type="button" (click)="changed.emit({ kind: 'person', id: member.id })"><aludel-avatar [who]="{ kind: 'person', id: member.id }" />
        <span>{{ member.id === ctx.me() ? 'You (' + member.name + ')' : member.name }}</span>@if (isCurrent('person', member.id)) { <mat-icon class="lay-menu-check" aria-label="current">check</mat-icon> }</button>
    }
    <p class="lay-menu-head">Agent profiles</p>
    @for (profile of activeProfiles(); track profile.id) {
      <button mat-menu-item type="button" [disabled]="!ctx.agentReady()" (click)="changed.emit({ kind: 'agent', id: profile.id })"><aludel-avatar [who]="{ kind: 'agent', id: profile.id }" />
        <span>{{ profile.name }}<small>{{ profile.model || 'Account default' }} · {{ profile.effort }} effort</small></span>@if (isCurrent('agent', profile.id)) { <mat-icon class="lay-menu-check" aria-label="current">check</mat-icon> }</button>
    }
    @if (!ctx.agentReady()) { <p class="lay-menu-note"><mat-icon aria-hidden="true">power_off</mat-icon>Connect an agent account to choose an agent.</p> }
    <a mat-menu-item [href]="ctx.link('work', 'agents')" (click)="ctx.go(ctx.link('work', 'agents'), $event)"><mat-icon aria-hidden="true">tune</mat-icon><span>Manage agent profiles</span></a>
  </mat-menu>`
})
export class AssigneeComponent {
  readonly ctx = inject(ProjectContext);
  readonly assignee = input<Assignee | null>(null);
  readonly locked = input<string | null>(null);
  readonly label = input('Assignee');
  readonly changed = output<Assignee>();
  readonly activeProfiles = computed(() => (this.ctx.data()?.profiles || []).filter(profile => profile.active));
  readonly metal = computed(() => { const who = this.assignee(); return who?.kind === 'agent' ? this.ctx.profileById().get(who.id || '')?.avatar.color || null : null; });
  isCurrent(kind: string, id: string) { return this.assignee()?.kind === kind && this.assignee()?.id === id; }
  whoHref() { const who = this.assignee(); return who?.kind === 'agent' ? this.ctx.link('work', 'agents', who.id || '') : this.ctx.link('work'); }
  // A person opens the board filtered to their work; an agent opens its profile.
  openWho(event: Event) { const who = this.assignee(); if (who?.kind === 'person') this.ctx.boardFilter.set(who.id); this.ctx.go(this.whoHref(), event); }
}

@Component({
  selector: 'aludel-priority', standalone: true, imports: [MatIconModule, MatTooltipModule],
  template: `<span [class]="'lay-prio lay-p-' + value()" role="img" [attr.aria-label]="label[value()] + ' priority'" [matTooltip]="label[value()] + ' priority'"><mat-icon aria-hidden="true">{{ icon[value()] }}</mat-icon></span>@if (text()) { <span class="lay-prio-text">{{ label[value()] }}</span> }`
})
export class PriorityComponent {
  readonly value = input('medium');
  readonly text = input(false);
  readonly label = priorityLabel;
  readonly icon = priorityIcon;
}

// "Engineer · Build stories": the role (from the layer) and the action, one chip, linking to the action in Roles.
@Component({
  selector: 'aludel-role-chip', standalone: true, imports: [MatIconModule],
  template: `<a [class]="'lay-rolechip lay-l-' + layer()" [href]="ctx.link('work', 'roles', action() || '')" (click)="ctx.go(ctx.link('work', 'roles', action() || ''), $event)" [attr.title]="title()">
    <mat-icon aria-hidden="true">{{ layerIcon[layer()] }}</mat-icon><span>{{ ctx.roleByLayer().get(layer())?.name }}</span>@if (actionName()) { <span class="lay-rolechip-act">· {{ actionName() }}</span> }</a>`
})
export class RoleChipComponent {
  readonly ctx = inject(ProjectContext);
  readonly layer = input.required<string>();
  readonly action = input<string | null>(null);
  readonly actionName = computed(() => this.ctx.actionById().get(this.action() || '')?.name || '');
  readonly title = computed(() => `${layerLabel[this.layer()]} layer role`);
  readonly layerIcon: Record<string, string> = { product: 'lightbulb', design: 'palette', pages: 'web', data: 'schema', platform: 'dns', work: 'checklist' };
}

// The one work card (B6–B9): title, then role · action and assignee, then one action on the right. With no primary action
// it shows the status; hovering or focusing the card swaps the status for a secondary action (always shown on touch).
@Component({
  selector: 'aludel-work-card', standalone: true, imports: [MatIconModule, MatTooltipModule, RefChipComponent, AssigneeComponent, PriorityComponent, RoleChipComponent],
  template: `
  @if (item(); as work) {
    <article class="lay-wc" [class.lay-wc-second]="!!parts().second" [class.lay-wc-skipped]="work.context?.skip" [class.lay-wc-blocked]="work.blockedBy.length" [attr.aria-label]="work.ref + ' ' + work.title">
      <div class="lay-wc-row">
        <div class="lay-wc-main">
          <div class="lay-wc-title"><aludel-priority [value]="work.priority" /><span class="lay-wc-ref">{{ work.ref }}</span>
            <a [href]="ctx.link('work', 'item', work.id)" (click)="ctx.go(ctx.link('work', 'item', work.id), $event)">{{ work.title }}</a></div>
          <div class="lay-wc-meta"><aludel-role-chip [layer]="work.layer" [action]="work.action" /><aludel-assignee [assignee]="work.assignee" [locked]="lock()" (changed)="reassign($event)" />
            @for (blocker of work.blockedBy; track blocker) { <span class="lay-blocked"><mat-icon aria-hidden="true">block</mat-icon>Blocked by</span><aludel-ref [id]="blocker" [short]="true" /> }</div>
        </div>
        <div class="lay-wc-act">
          @switch (parts().primary) {
            @case ('queue') { <button type="button" class="lay-button ghost small" (click)="update({ state: 'ready' }, work.ref + ' queued.')"><mat-icon aria-hidden="true">add</mat-icon>Queue</button> }
            @case ('stage') { <button type="button" class="lay-button small" (click)="update({ stage: true }, work.ref + ' staged.')" [disabled]="!!parts().disabled" [matTooltip]="parts().disabled || ''"><mat-icon aria-hidden="true">playlist_add</mat-icon>Stage</button> }
            @case ('done') { @if (parts().second) { <span class="lay-wc-sec"><button type="button" class="lay-button ghost small" (click)="update({ stage: false }, work.ref + ' unstaged.')">Unstage</button></span> }
              <button type="button" class="lay-button small" (click)="update({ state: 'done' }, work.ref + ' done.')"><mat-icon aria-hidden="true">check</mat-icon>Done</button> }
            @case ('answer') { <a class="lay-button small" [href]="ctx.link('work', 'item', work.id)" (click)="ctx.go(ctx.link('work', 'item', work.id), $event)"><mat-icon aria-hidden="true">help</mat-icon>Answer</a> }
            @case ('review') { <a class="lay-button small lay-button-ok" [href]="ctx.link('work', 'item', work.id)" (click)="ctx.go(ctx.link('work', 'item', work.id), $event)"><mat-icon aria-hidden="true">rate_review</mat-icon>Review</a> }
            @default {
              <span class="lay-wc-status" [class]="'lay-wc-status lay-wc-' + parts().tone">@if (parts().icon) { <mat-icon aria-hidden="true" [class.lay-spin]="parts().tone === 'working'">{{ parts().icon }}</mat-icon> }{{ parts().status }}</span>
              @switch (parts().second) {
                @case ('unstage') { <span class="lay-wc-sec"><button type="button" class="lay-button ghost small" (click)="update({ stage: false }, work.ref + ' unstaged.')">Unstage</button></span> }
                @case ('skip') { <span class="lay-wc-sec"><button type="button" class="lay-button ghost small" (click)="update({ skip: true }, work.ref + ' skipped for this run.')"><mat-icon aria-hidden="true">lock</mat-icon>Skip this run</button></span> }
                @case ('include') { <span class="lay-wc-sec"><button type="button" class="lay-button ghost small" (click)="update({ skip: false }, work.ref + ' is back in this run.')"><mat-icon aria-hidden="true">lock_open</mat-icon>Include</button></span> }
                @case ('stop') { <span class="lay-wc-sec"><button type="button" class="lay-button ghost small" (click)="update({ stop: true }, 'Stopping ' + work.ref + '.')"><mat-icon aria-hidden="true">stop_circle</mat-icon>Stop</button></span> }
              }
            }
          }
        </div>
      </div>
      @if (work.status === 'working' && work.context?.run; as run) {
        <div class="lay-wc-run">
          <div class="lay-bar" role="progressbar" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="work.ref + ' progress'"><i [style.width.%]="progress()"></i></div>
          <div class="lay-run-line"><span class="lay-run-act"><b>{{ run.phases?.[run.phase || 0] }}</b> · {{ run.activity }}…</span>
            <span class="lay-run-tick">{{ elapsedText() }}{{ run.model ? ' · ' + run.model : '' }}</span></div>
        </div>
      }
    </article>
  }`
})
export class WorkCardComponent {
  readonly ctx = inject(ProjectContext);
  readonly item = input.required<WorkItem>();
  readonly batch = computed(() => batchOf(this.ctx, this.item()));
  // Running batches lock their items in (B8); review and working items can't change hands either.
  readonly lock = computed(() => {
    const work = this.item();
    if (work.assignee?.kind === 'template' || work.status === 'done') return 'Done';
    if (work.status === 'working') return 'Working now';
    if (work.status === 'review') return 'Ready for review: accept it or send it back first';
    if (work.status === 'staged' && isRunning(this.batch())) return 'Locked in while its batch runs';
    return null;
  });
  readonly parts = computed<{ primary?: string; second?: string; status?: string; icon?: string; tone?: string; disabled?: string }>(() => {
    const work = this.item();
    const agent = work.assignee?.kind === 'agent';
    switch (work.status) {
      case 'backlog': return { primary: 'queue' };
      case 'queued':
        if (work.blockedBy.length) return { status: 'Blocked', icon: 'block', tone: 'blocked' };
        if (!work.assignee) return { primary: 'stage', disabled: 'Assign it to someone first' };
        if (agent && !agentRunnable(work)) return { primary: 'stage', disabled: `Agents can't run “${this.ctx.actionById().get(work.action || '')?.name || work.type}” yet. Assign it to a person.` };
        return { primary: 'stage' };
      case 'staged':
        if (!agent) return { primary: 'done', second: 'unstage' };
        if (isRunning(this.batch())) return work.context?.skip ? { status: 'Skipped this run', icon: 'lock', tone: 'skipped', second: 'include' } : { status: '', second: 'skip' };
        return { status: 'Staged', icon: 'playlist_add_check', tone: 'staged', second: 'unstage' };
      case 'working': return { status: 'Working', icon: 'progress_activity', tone: 'working', second: 'stop' };
      case 'needs': return { primary: 'answer' };
      case 'review': return { primary: 'review' };
      default: return { status: `Done${work.updatedAt ? ' · ' + new Date(work.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}`, icon: 'check_circle', tone: 'done' };
    }
  });
  readonly progress = computed(() => {
    const run = this.item().context?.run;
    const phases = run?.phases?.length || 1;
    return Math.round(Math.min(1, ((run?.phase || 0) + 0.5) / phases) * 100);
  });
  readonly elapsedText = computed(() => elapsed(this.item().context?.run?.startedAt, this.ctx.now()));
  update(body: unknown, success: string) { void this.ctx.write(() => this.ctx.updateWork(this.item().id, body), success); }
  reassign(assignee: Assignee) { this.update({ assignee }, `${this.item().ref} now goes to ${this.ctx.whoName(assignee)}.`); }
}
