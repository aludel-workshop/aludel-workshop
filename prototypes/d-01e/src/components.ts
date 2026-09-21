import {Component,Input,Output,EventEmitter} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatChipsModule} from '@angular/material/chips';
import {Decision,Work} from './model';

/** Text remains authoritative; color is a redundant state cue. */
@Component({selector:'machine-status',standalone:true,imports:[MatChipsModule],template:`@if(variant === 'chip'){<mat-chip [class]="tone">{{label}}</mat-chip>}@else{<span class="status" [class]="tone">{{label}}</span>}`})
export class StatusComponent {
 @Input() label='Ready'; @Input() variant:'label'|'chip'='label';
 get tone(){return ['Blocking','Blocked'].includes(this.label)?'blocked':this.label==='Waiting'?'waiting':this.label==='Ready'||this.label==='Answered'?'ready':'optional';}
}

/** Summarize an open decision collection without turning one question into a hero. */
@Component({selector:'machine-decision-queue',standalone:true,imports:[MatButtonModule,MatIconModule,StatusComponent],template:`
<section class="decision-panel" aria-labelledby="queue-heading">
 <header class="queue-header"><div><h2 id="queue-heading">{{heading}}</h2>
 @if(availability==='known'){<p>{{items.length}} {{items.length===1?'open decision':'open'}} · {{blocking}} blocking · {{items.length-blocking}} optional</p>}
 @else {<p role="status">Decision count unavailable</p>}</div>
 @if(availability==='known' && items.length){<a mat-flat-button [href]="collectionHref">{{items.length>limit?'View all '+items.length+' decisions':'Review decisions'}}<mat-icon iconPositionEnd>arrow_forward</mat-icon></a>}
 @if(availability!=='known'){<button mat-stroked-button (click)="retry.emit()">Try again</button>}
 </header>
 @if(availability!=='known'){<p class="empty-state">Couldn’t refresh decisions. {{items.length?'Last known questions are shown below; their status may have changed.':'Try again to check what needs you.'}}</p>}
 @if(availability==='known' && !items.length){<p class="empty-state">No open decisions. You can still check work and previews.</p>}
 <div class="decision-rows">@for(item of items.slice(0,limit);track item.id){
 <a class="decision-row" [href]="detailHref(item.id)"><span class="decision-icon"><mat-icon>{{item.icon}}</mat-icon></span><span class="row-copy"><strong>{{item.title}}</strong><span>{{item.effect}}</span></span><machine-status [label]="availability!=='known'?'Unverified':item.blocking?'Blocking':'Optional'"/><mat-icon class="chevron">chevron_right</mat-icon></a>
 }</div>
 @if(items.length>limit){<p class="overflow-note">Showing {{limit}} of {{items.length}} {{availability==='known'?'open decisions':'last known questions'}}</p>}
</section>`})
export class DecisionQueueComponent {
 @Input() items:Decision[]=[]; @Input() limit=3; @Input() heading='Decisions needing you'; @Input() availability:'known'|'unknown'='known';
 @Input() collectionHref='#/borrowbox/decisions?filter=open'; @Input() returnTo='overview';
 @Output() retry=new EventEmitter<void>();
 get blocking(){return this.items.filter(d=>d.blocking).length;}
 detailHref(id:string){return `#/borrowbox/decisions/${id}?from=${encodeURIComponent(this.returnTo)}`;}
}

@Component({selector:'machine-work-summary',standalone:true,imports:[MatIconModule,StatusComponent],template:`<section class="work-section" aria-labelledby="work-heading"><div class="section-heading"><div><h2 id="work-heading">Work</h2><p>{{items.length}} tasks</p></div>@if(showLink){<a href="#/borrowbox/work">View work</a>}</div><div class="work-rows">@for(item of items;track item.id){<a class="work-row" [href]="'#/borrowbox/work/'+item.id"><span class="work-icon"><mat-icon>description</mat-icon></span><span>{{item.title}}</span><machine-status [label]="item.state"/></a>}</div></section>`})
export class WorkSummaryComponent { @Input() items:Work[]=[]; @Input() showLink=false; }

/** Evidence state owns no release/authorization control. */
@Component({selector:'machine-preview-summary',standalone:true,template:`<section class="preview-summary" aria-labelledby="preview-heading"><h2 id="preview-heading">Latest preview</h2>@if(state==='none'){<p>No preview yet.</p>}@else if(state==='unknown'){<p role="status">Preview availability is unknown. Refresh before reviewing.</p>}@else{<p>Candidate {{revision}} · awaiting review</p><p>Acceptance records a review; release requires a separate authorization.</p>}</section>`})
export class PreviewSummaryComponent {@Input() state:'none'|'unknown'|'candidate'='none';@Input() revision='r1';}
