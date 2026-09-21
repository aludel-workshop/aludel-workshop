export const request = 'Let BorrowBox members reserve an available tool for pickup and return dates. Show unavailable dates and prevent overlapping reservations.';
export const initial = () => ({version:4, affected:2, evidenceMissing:false, previewMissing:false, state:'Blocked', revisions:[{id:1,text:request}], decision:0, scope:null, deferred:false, auth:[], attempts:[], artifacts:[], reviews:[], events:[], connector:'Not mapped', mapping:null, scenario:'Happy path', selected:null});
export const current = s => s.revisions.at(-1);
export const stale = (s,a) => a.revision !== current(s)?.id || a.decision !== s.decision;
export function act(s,type,value) {
 const rev = current(s); const last = s.attempts.at(-1);
 const requireState = (...states) => {if(!states.includes(s.state)) throw Error(`Cannot ${type} while ${s.state}`)};
 const newRevision = text => s.revisions.push({id:s.revisions.length+1,text});
 const queue = () => {s.mapping ||= 'LIN-42'; s.connector='Confirmed · version 7'; s.state='Queued'};
 switch(type) {
 case 'request': requireState('Draft'); if(!value?.trim()) throw Error('Enter a request'); newRevision(value); s.state='Blocked'; break;
 case 'edit': requireState('Blocked','Ready','Awaiting review','Completed'); if(!value?.trim()) throw Error('Enter an interpretation'); newRevision(value); s.state=s.scope?'Ready':'Blocked'; break;
 case 'decision': if(!['Confirm immediately','Require volunteer approval'].includes(value)) throw Error('Choose a policy'); if(['Running','Queued','Authorized','Cancelling','Cancellation uncertain','Awaiting decision'].includes(s.state)) throw Error('Resolve the active attempt first'); s.scope=value; s.decision++; s.deferred=false; if(rev) s.state='Ready'; break;
 case 'defer': requireState('Blocked'); s.deferred=true; break;
 case 'authorize': requireState('Ready','Failed','Cancelled','Continue ready'); if(!s.scope) throw Error('Decision required'); s.auth.push({id:s.auth.length+1,revision:rev.id,decision:s.decision,scope:'Build local preview'}); s.state='Authorized'; s.connector='Queue confirmation pending'; break;
 case 'map': requireState('Authorized'); if(s.scenario==='Connector conflict') {s.state='Needs reconciliation'; s.connector='Conflict: expected Ready v7; observed Cancelled v8'} else if(s.scenario==='Connector unavailable') s.connector='Write outcome unknown · operation op-BB-001 retained'; else queue(); break;
 case 'reconcile': requireState('Authorized','Needs reconciliation'); queue(); break;
 case 'start': requireState('Queued'); if(s.scenario==='Worker unavailable') throw Error('Worker has no heartbeat'); s.attempts.push({id:s.attempts.length+1,previousAttempt:s.attempts.at(-1)?.id??null,revision:rev.id,decision:s.decision,state:'Running'}); s.state='Running'; break;
 case 'worker': s.scenario='Happy path'; break;
 case 'finish': requireState('Running'); if(s.scenario==='Failure') {s.state='Failed'; last.state='Failed'} else if(s.scenario==='Blocked input') {s.state='Awaiting decision';last.state='Blocked';s.connector='Ineligible · input required'} else {last.state='Succeeded';s.state='Awaiting review';s.connector='Review · ineligible'; const id=s.artifacts.length+1;s.artifacts.push({id,revision:rev.id,decision:s.decision,attempt:last.id,scope:'Build local preview',policy:s.scope,text:rev.text,time:new Date().toISOString(),digest:`fixture-sha256-A${id}-r${rev.id}-q${s.decision}`});s.selected=id} break;
 case 'answer': requireState('Awaiting decision'); if(!value?.trim()) throw Error('Answer required'); s.inputAnswer=value;newRevision(rev.text + '\nClarification: ' + value);s.state='Continue ready';s.scenario='Happy path';break;
 case 'cancel': requireState('Authorized','Queued','Running','Awaiting decision','Needs reconciliation'); s.state='Cancelling';break;
 case 'uncertain': requireState('Cancelling');s.state='Cancellation uncertain';break;
 case 'confirmCancel': requireState('Cancelling','Cancellation uncertain');s.state='Cancelled';s.connector='Cancellation confirmed · ineligible';if(last && ['Running','Blocked'].includes(last.state))last.state='Cancelled';break;
 case 'accept': {requireState('Awaiting review');const a=s.artifacts.find(a=>a.id===s.selected);if(!a || stale(s,a) || s.evidenceMissing || s.previewMissing)throw Error('This artifact is stale');s.reviews.push({artifact:a.id,kind:'Accepted',digest:a.digest,revision:a.revision,decision:a.decision});s.state='Completed';break}
 case 'revision': {requireState('Awaiting review');if(!value?.trim())throw Error('Feedback required');s.reviews.push({artifact:s.selected,kind:'Revision requested',feedback:value});newRevision(rev.text + '\nRequested revision: ' + value);s.state='Ready';break}
 default: throw Error('Unknown action');
 }
 s.events.push({time:new Date().toISOString(),text:`${type} → ${s.state}`});return s;
}
