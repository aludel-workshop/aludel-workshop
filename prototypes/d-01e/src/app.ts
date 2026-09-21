import {Component,inject,signal,computed,ChangeDetectorRef} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule,MatIconRegistry} from '@angular/material/icon';
import {MatRadioModule} from '@angular/material/radio';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatDialog,MatDialogModule,MatDialogRef} from '@angular/material/dialog';
import {DecisionQueueComponent,WorkSummaryComponent,PreviewSummaryComponent,StatusComponent} from './components';
import {Decision,decisions,workFor,manyDecisions} from './model';

@Component({selector:'discard-dialog',standalone:true,imports:[MatDialogModule,MatButtonModule],template:`<h2 mat-dialog-title>Discard this request draft?</h2><mat-dialog-content>Your unsaved request text will be removed from this browser.</mat-dialog-content><mat-dialog-actions align="end"><button mat-button [mat-dialog-close]="false" cdkFocusInitial>Keep writing</button><button mat-flat-button [mat-dialog-close]="true">Discard draft</button></mat-dialog-actions>`})
export class DiscardDialog {}

@Component({selector:'machine-app',standalone:true,imports:[FormsModule,MatButtonModule,MatIconModule,MatRadioModule,MatFormFieldModule,MatInputModule,MatDialogModule,DecisionQueueComponent,WorkSummaryComponent,PreviewSummaryComponent,StatusComponent],templateUrl:'./app.html'})
export class App {
 readonly dialog=inject(MatDialog);
 readonly changeDetector=inject(ChangeDetectorRef);
 items=signal<Decision[]>(structuredClone(decisions));
 route=signal(location.hash.slice(1)||'/borrowbox/overview');
 open=computed(()=>this.items().filter(d=>!d.answer).sort((a,b)=>Number(b.blocking)-Number(a.blocking)));
 run=signal<'idle'|'running'|'review'>('idle');
 work=computed(()=>workFor(this.items()).map(w=>w.id==='BB-001'&&this.run()!=='idle'?{...w,state:this.run()==='running'?'Running':this.reviewOutcome()==='accepted'?'Accepted':'Awaiting review',reason:'Simulated local attempt.'}:w));
 current=computed(()=>this.items().find(d=>d.id===this.route().split('?')[0].split('/')[3]));
 currentWork=computed(()=>this.work().find(d=>d.id===this.route().split('?')[0].split('/')[3]));
 page=computed(()=>this.route().split('?')[0].split('/')[2]||'projects');
 isDetail=computed(()=>!!this.route().split('?')[0].split('/')[3]);
 filter=computed(()=>new URLSearchParams(this.route().split('?')[1]).get('filter')||'open');
 availability=signal<'known'|'unknown'>('known');
 answer=''; message=signal(''); saved=signal(false); busy=signal(false); failure='none';
 requestText=sessionStorage.getItem('machine-request-draft')||'';
 requestSaved=signal(false); requestError=signal('');
 pickupDate='2026-10-15'; returnDate='2026-10-16';
 reservationMessage=signal(''); reservationTone=signal<'success'|'error'|''>('');
 reviewFeedback=sessionStorage.getItem('machine-review-feedback-a1')||'';
 reviewOutcome=signal<'open'|'accepted'|'revision'>((sessionStorage.getItem('machine-review-outcome-a1') as 'accepted'|'revision'|null)||'open');
 reviewScenario=new URLSearchParams(location.search).get('review')||'current';
 get candidateScenario(){return this.run()==='review';}
 private scroll=new Map<string,number>(); private lastRoute=this.route();
 constructor(){
  inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='machine-demo:complete'){this.finishDemo();}});
  try {const stored=sessionStorage.getItem('machine-decisions');if(stored)this.items.set(JSON.parse(stored));} catch {}
  const scenario=new URLSearchParams(location.search).get('scenario');
  if(['ready','candidate'].includes(scenario||'')){this.items.set(structuredClone(decisions).map(d=>d.id==='BB-D01'?{...d,answer:'Confirm instantly'}:d));}
  if(scenario==='candidate')this.run.set('review');
  if(scenario==='zero')this.items.set([]);if(scenario==='one')this.items.set(structuredClone(decisions.slice(0,1)));if(scenario==='many')this.items.set(manyDecisions());if(scenario==='unknown')this.availability.set('unknown');
  this.failure=new URLSearchParams(location.search).get('save')||'none';
  this.loadDraft();
  window.addEventListener('hashchange',()=>{
   this.scroll.set(this.lastRoute,window.scrollY);this.route.set(location.hash.slice(1)||'/borrowbox/overview');this.lastRoute=this.route();this.message.set('');this.saved.set(false);this.loadDraft();
   setTimeout(()=>{document.querySelector<HTMLElement>('main h1')?.focus({preventScroll:true});window.scrollTo(0,this.scroll.get(this.route())||0);},30);
  });
 }
 loadDraft(){const d=this.current();this.answer=d?(sessionStorage.getItem('answer-'+d.id)||d.answer||''):'';}
 draftAnswer(value:string){this.answer=value;const d=this.current();if(d)sessionStorage.setItem('answer-'+d.id,value);}
 returnHref(){const from=new URLSearchParams(this.route().split('?')[1]).get('from');return from==='overview'?'#/borrowbox/overview':`#/borrowbox/decisions?filter=${from==='all'?'all':'open'}`;}
 async saveAnswer(){
  const d=this.current();if(!d||!this.answer||this.busy()||this.availability()==='unknown')return;
  this.busy.set(true);this.message.set('');await new Promise(r=>setTimeout(r,350));this.busy.set(false);
  if(this.failure==='error'){this.message.set('Couldn’t save. Your answer is kept here. Try again.');return;}
  if(this.failure==='conflict'){this.message.set('This decision changed to revision 2 while you were answering. Your draft is kept. Review the current revision before saving.');return;}
  this.items.update(ds=>ds.map(x=>x.id===d.id?{...x,answer:this.answer,revision:x.revision+1}:x));
  sessionStorage.setItem('machine-decisions',JSON.stringify(this.items()));sessionStorage.removeItem('answer-'+d.id);this.saved.set(true);
  this.message.set('Answer saved. No work has started.');
 }
 refreshRevision(){const d=this.current();if(d)this.items.update(ds=>ds.map(x=>x.id===d.id?{...x,revision:2}:x));this.failure='none';this.message.set('Current revision loaded. Review your retained answer and save deliberately.');}
 retry(){this.availability.set('known');}
 requestDraft(value:string){this.requestText=value;sessionStorage.setItem('machine-request-draft',value);this.requestSaved.set(false);}
 saveRequest(){if(!this.requestText.trim())return;if(this.failure==='error'){this.requestError.set('Couldn’t save. Your draft is still here.');return;}sessionStorage.setItem('machine-request',this.requestText);sessionStorage.removeItem('machine-request-draft');this.requestSaved.set(true);this.requestError.set('');}
 discard(){this.dialog.open(DiscardDialog,{width:'440px',autoFocus:'first-tabbable',restoreFocus:true}).afterClosed().subscribe(ok=>{if(ok){this.requestDraft('');sessionStorage.removeItem('machine-request-draft');this.changeDetector.markForCheck();}});}
 reviewDraft(value:string){this.reviewFeedback=value;sessionStorage.setItem('machine-review-feedback-a1',value);}
 startTask(){if(this.currentWork()?.state==='Ready')this.run.set('running');}
 finishDemo(){if(this.run()==='running')this.run.set('review');}
 reserveTool(){
  const overlaps=this.pickupDate<='2026-10-12'&&this.returnDate>='2026-10-10';
  if(!this.pickupDate||!this.returnDate||this.returnDate<this.pickupDate){this.reservationTone.set('error');this.reservationMessage.set('Choose a return date on or after pickup. Your dates are kept.');return;}
  if(overlaps){this.reservationTone.set('error');this.reservationMessage.set('Those dates are unavailable. Your dates are kept so you can adjust them.');return;}
  this.reservationTone.set('success');this.reservationMessage.set('Reservation confirmed for pickup. This preview did not change project records.');
 }
 acceptCandidate(){
  if(this.reviewScenario==='stale'||this.reviewScenario==='unavailable')return;
  this.reviewOutcome.set('accepted');sessionStorage.setItem('machine-review-outcome-a1','accepted');
 }
 requestRevision(){
  if(!this.reviewFeedback.trim()){this.reservationTone.set('error');this.reservationMessage.set('Add feedback before requesting a revision.');document.querySelector<HTMLTextAreaElement>('#review-feedback')?.focus();return;}
  this.reviewOutcome.set('revision');sessionStorage.setItem('machine-review-outcome-a1','revision');
 }
}
