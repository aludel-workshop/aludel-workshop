import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ProjectContext } from './context';

// Layers above Platform show only this summary of code links (DEC-038): units, tests and whether anything is suspect.
@Component({
  selector: 'aludel-built-by', standalone: true, imports: [MatIconModule],
  template: `
  @if (summary(); as built) {
    <a class="lay-built-by" [href]="href()" (click)="ctx.go(href(), $event)">
      <mat-icon aria-hidden="true">code</mat-icon>
      <span>{{ built.units }} code {{ built.units === 1 ? 'unit' : 'units' }}{{ built.tests ? ' · ' + built.tests + (built.tests === 1 ? ' test' : ' tests') : ' · no tests' }}</span>
      <span class="lay-chip" [class.lay-ok]="!built.suspect" [class.lay-warn]="built.suspect">{{ built.suspect ? 'Suspect' : 'Current' }}</span>
    </a>
  } @else { <p class="lay-muted small">No code yet.</p> }`
})
export class BuiltByComponent {
  readonly ctx = inject(ProjectContext);
  readonly recordId = input.required<string>();
  readonly summary = computed(() => this.ctx.builtBy().get(this.recordId()) || null);
  readonly href = computed(() => this.ctx.link('platform', 'code', 'for', this.recordId()));
}
