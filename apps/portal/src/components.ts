import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DownstreamRecord, SourceRecord } from './model';

/** Text is authoritative; color only reinforces state. */
@Component({ selector: 'machine-status', standalone: true, imports: [MatChipsModule], template: `<mat-chip [class]="tone">{{label}}</mat-chip>` })
export class StatusComponent {
  @Input() label = 'active';
  get tone() { return ['active', 'accepted', 'complete', 'current', 'answered'].includes(this.label) ? 'ready' : ['blocked', 'failed', 'stale'].includes(this.label) ? 'blocked' : 'optional'; }
}

/** Reusable repository-backed knowledge collection with an explicit empty result. */
@Component({
  selector: 'machine-record-list', standalone: true,
  imports: [FormsModule, MatButtonModule, MatIconModule, MatInputModule, MatFormFieldModule, StatusComponent],
  template: `
    <section class="record-collection" aria-labelledby="records-heading">
      <header class="section-heading"><div><h2 id="records-heading">Source records</h2><p>{{records.length}} shown</p></div></header>
      @if(searchable){<mat-form-field appearance="outline" class="search-field"><mat-label>Search records</mat-label><mat-icon matPrefix>subject</mat-icon><input matInput [ngModel]="query" (ngModelChange)="queryChange.emit($event)" (keyup.enter)="search.emit()"><button mat-icon-button matSuffix aria-label="Search" (click)="search.emit()"><mat-icon>arrow_forward</mat-icon></button></mat-form-field>}
      @if(!records.length){<div class="empty-state"><mat-icon>subject</mat-icon><p>No records match this search.</p></div>}
      <div class="record-rows">@for(record of records; track record.id){
        <a class="record-row" [href]="'#/' + projectSlug + '/knowledge/' + encode(record.id)">
          <span class="record-icon"><mat-icon>description</mat-icon></span>
          <span class="row-copy"><strong>{{record.title}}</strong><span>{{record.path}}</span></span>
          <machine-status [label]="record.status"/><mat-icon class="chevron">chevron_right</mat-icon>
        </a>
      }</div>
    </section>`
})
export class RecordListComponent {
  @Input() records: SourceRecord[] = [];
  @Input() projectSlug = 'the-machine';
  @Input() query = '';
  @Input() searchable = false;
  @Output() queryChange = new EventEmitter<string>();
  @Output() search = new EventEmitter<void>();
  encode(value: string) { return encodeURIComponent(value); }
}

/** Shows dependency currency separately from executable task status. */
@Component({
  selector: 'machine-dependency-list', standalone: true,
  imports: [MatButtonModule, MatIconModule, StatusComponent],
  template: `<div class="product-rows">@for(record of records;track record.id){<div class="work-record"><span class="record-icon"><mat-icon>{{record.kind==='build'?'deployed_code':'description'}}</mat-icon></span><span class="row-copy"><strong>{{record.title}}</strong><span>{{record.id}} · revision {{record.revision}} · {{record.dependency_count || 0}} dependencies</span>@if(record.stale_reason){<small>{{record.stale_reason}}</small>}</span><machine-status [label]="record.currency"/>@if(record.currency==='stale'){<button mat-stroked-button (click)="reassess.emit(record.id)">Reassess</button>}</div>}</div>`
})
export class DependencyListComponent {
  @Input() records: DownstreamRecord[] = [];
  @Output() reassess = new EventEmitter<string>();
}
