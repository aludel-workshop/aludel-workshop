export interface Decision {id:string; title:string; effect:string; blocking:boolean; icon:string; options:string[]; answer?:string; revision:number;}
export const decisions: Decision[] = [
 {id:'BB-D01', title:'Confirm reservations instantly or require approval?',effect:'Affects reservation implementation and checks.',blocking:true,icon:'balance',options:['Confirm instantly','Require volunteer approval'],revision:1},
 {id:'BB-D04',title:'Which pickup windows should members see?',effect:'Blocks pickup instructions.',blocking:true,icon:'calendar_month',options:['Weekday evenings and Saturday mornings','Saturday mornings only'],revision:1},
 {id:'BB-D03',title:'What should we call tool categories?',effect:'Optional · does not block work.',blocking:false,icon:'sell',options:['Everyday names: Garden, Repairs, Cleaning','Technical names: Horticulture, Maintenance, Sanitation'],revision:1}
];
export interface Work {id:string; title:string; state:string; reason:string;}
export function workFor(items:Decision[]):Work[] {
 const answered=(id:string)=>!!items.find(d=>d.id===id)?.answer;
 return [
 {id:'BB-001',title:'Reservation implementation',state:answered('BB-D01')?'Ready':'Blocked',reason:answered('BB-D01')?'Decision recorded. Execution still needs deliberate authorization.':'Needs the reservation confirmation decision.'},
 {id:'BB-003',title:'Reservation checks',state:'Waiting',reason:answered('BB-D01')?'Still waiting for reservation implementation evidence.':'Needs the confirmation decision and reservation implementation evidence.'},
 {id:'BB-004',title:'Pickup instructions',state:answered('BB-D04')?'Ready':'Blocked',reason:answered('BB-D04')?'Pickup windows decided. Execution still needs deliberate authorization.':'Needs the pickup windows decision.'},
 {id:'BB-002',title:'Improve catalog descriptions',state:'Ready',reason:'Independent of the open decisions. Execution still needs deliberate authorization.'}];
}
export function manyDecisions():Decision[] {return [...structuredClone(decisions),...Array.from({length:17},(_,i)=>({id:`BB-D${10+i}`,title:`Choose lending detail ${i+1}`,effect:'Optional · does not block work.',blocking:false,icon:'sell',options:['First option','Second option'],revision:1}))];}
