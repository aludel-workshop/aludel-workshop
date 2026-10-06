import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';
import { LayerAccessComponent } from './layer-access';
import { LayerActionsComponent } from './layer-actions';
import { LayerRoutinesComponent } from './layer-routines';
import { WorkBoardComponent } from './work-board';
import { WorkCreateComponent } from './work-create';
import { pollLiveBatches } from './work-shared';

// CUSTOM-LAYER-01 Tasks: the Work layer's own pieces, scoped to one layer, so a task looks and behaves the same in both
// places. Board is Work's Kanban board filtered to this layer (W-8); Actions is the Work › Roles composition; Routines
// is a list with a page per routine. A left sidebar, like Manage's, picks the section so there is no second tab row.
@Component({
  selector: 'aludel-layer-tasks', standalone: true, imports: [MatIconModule, WorkBoardComponent, WorkCreateComponent, LayerAccessComponent, LayerActionsComponent, LayerRoutinesComponent],
  template: `
  <div class="lay-mg lay-tk">
    <nav class="lay-mg-side" [attr.aria-label]="name() + ' tasks'">
      @for (entry of sections(); track entry[0]) {
        <a [href]="ctx.link(layerKey(), 'tasks', entry[0])" (click)="ctx.go(ctx.link(layerKey(), 'tasks', entry[0]), $event)" [class.active]="active() === entry[0]"
          [attr.aria-current]="current() === entry[0] ? 'page' : null"><mat-icon aria-hidden="true">{{ entry[2] }}</mat-icon>{{ entry[1] }}<small>{{ counts()[entry[0]] }}</small></a>
      }
      <a class="lay-tk-work" [href]="ctx.link('work')" (click)="ctx.go(ctx.link('work'), $event)"><mat-icon aria-hidden="true">checklist</mat-icon>All work</a>
    </nav>
    <div class="lay-mg-body lay-tk-body">
      @switch (section()) {
        @case ('create') { <aludel-work-board [layer]="layerKey()" /><aludel-work-create [layer]="layerKey()" [preset]="ctx.segments()[3] || null" /> }
        @case ('access') { <aludel-layer-access [layerKey]="layerKey()" /> }
        @case ('actions') { <aludel-layer-actions [layerKey]="layerKey()" [focus]="ctx.segments()[3] || null" /> }
        @case ('routines') { <aludel-layer-routines [layerKey]="layerKey()" [routineId]="ctx.segments()[3] || null" /> }
        @default {
          @if (!work().length) { <p class="lay-muted small">No {{ name() }} tasks yet. Create one, @if (!layer()?.workScope) { start one from an <a [href]="ctx.link(layerKey(), 'tasks', 'actions')" (click)="ctx.go(ctx.link(layerKey(), 'tasks', 'actions'), $event)">action</a>, } or let a <a [href]="ctx.link(layerKey(), 'tasks', 'routines')" (click)="ctx.go(ctx.link(layerKey(), 'tasks', 'routines'), $event)">routine</a> stage them.</p> }
          <aludel-work-board [layer]="layerKey()" />
        }
      }
    </div>
  </div>`
})
export class LayerTasksComponent {
  readonly ctx = inject(ProjectContext);
  readonly layerKey = input.required<string>();
  readonly layer = computed(() => this.ctx.layerInstances().find(item => item.key === this.layerKey()) || null);
  // DEC-057: a layer-scoped layer shows Access (who reviews, where tasks go) instead of an action list.
  readonly sections = computed<[string, string, string][]>(() => [['board', 'Board', 'view_kanban'],
    this.layer()?.workScope ? ['access', 'Access', 'shield_person'] : ['actions', 'Actions', 'bolt'], ['routines', 'Routines', 'event_repeat']]);
  readonly name = computed(() => this.layer()?.name || this.layerKey());
  readonly section = computed(() => this.ctx.segments()[2] || 'board');
  // Create belongs to Board; a routine or action page keeps its section highlighted but is not that section's page.
  readonly active = computed(() => this.section() === 'create' ? 'board' : this.section());
  readonly current = computed(() => (this.ctx.segments()[3] || this.section() === 'create') ? '' : this.section());
  readonly work = computed(() => (this.ctx.data()?.work || []).filter(item => item.layer === this.layerKey()));
  readonly counts = computed<Record<string, number | string>>(() => ({
    board: this.work().filter(item => item.status !== 'done').length || '',
    access: '',
    actions: (this.ctx.data()?.layerActions || []).filter(action => action.layer === this.layerKey()).length || '',
    routines: (this.ctx.data()?.routines || []).filter(item => item.layer === this.layerKey()).length + 1
  }));
  constructor() { pollLiveBatches(this.ctx); }
}
