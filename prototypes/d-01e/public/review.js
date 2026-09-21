const frame=document.querySelector('#candidate');
const scenario=document.querySelector('#scenario');
const notes=document.querySelector('#notes');
const key='machine-outer-review-d01e';
notes.value=localStorage.getItem(key)||'';
function load(){
 const s=scenario.value;
 // Only this prototype's inner keys; never clear the entire origin.
 for(const k of Object.keys(sessionStorage))if(k.startsWith('machine-')||k.startsWith('answer-BB-'))sessionStorage.removeItem(k);
 const query=s==='decision'?'':s==='ready'?'?scenario=ready':'?scenario=candidate'+(['stale','unavailable'].includes(s)?'&review='+s:'');
 const route=s==='decision'?'/borrowbox/overview':s==='ready'?'/borrowbox/work':'/borrowbox/reviews/A1';
 const url='/'+query+'#'+route;
 frame.src='about:blank';requestAnimationFrame(()=>{frame.src=url;});
 document.querySelector('#separate').href=url;
}
document.querySelector('#reset').onclick=load;
const finish=document.createElement('button');finish.textContent='Simulate build completion';finish.title='After authorizing BB-001, deliver a simulated completed build.';finish.onclick=()=>frame.contentWindow.postMessage({type:'machine-demo:complete'},location.origin);document.querySelector('.toolbar').append(finish);
document.querySelector('#width').onchange=e=>{frame.style.width=e.target.value;};
document.querySelector('#save').onclick=()=>{localStorage.setItem(key,notes.value);document.querySelector('#saved').textContent='Notes saved in this browser.';};
notes.oninput=()=>localStorage.setItem(key,notes.value);
document.querySelector('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({candidate:'D-01E local working copy',scenario:scenario.value,feedback:notes.value,date:new Date().toISOString()},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='machine-d01e-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
load();
