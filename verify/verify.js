'use strict';
const qs=new URLSearchParams(location.search),token=qs.get('token');
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const panel=document.querySelector('#verifyPanel'),downloadRow=document.querySelector('#verifyDownloads');
let person=null,photoUrl='';
const id=e=>String(e.id).padStart(5,'0');
function showError(msg){panel.innerHTML=`<div class="mini">VERIFICATION NOT AVAILABLE</div><h2>${html(msg)}</h2><p>This link may have been revoked or the employee record removed. Request a new verification link from Quartz administration.</p>`;downloadRow.classList.add('hidden')}
async function init(){if(!token||!(/^[A-Za-z0-9_-]{32,100}$/).test(token)){showError('Invalid verification link.');return}
 try{const r=await fetch('/api/public/employees/'+encodeURIComponent(token),{cache:'no-store'}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Record is unavailable.');person=d.employee;photoUrl=person.photo?'/api/public/employees/'+encodeURIComponent(token)+'/photo':'';
 panel.innerHTML=`<div class="identity"><div class="portrait">${photoUrl?`<img alt="${html(person.name)} profile" src="${photoUrl}">`:'Q'}</div><div><div class="mini">AUTHENTIC QUARTZ DIRECTORY RECORD</div><h2>${html(person.name)}</h2><p class="role">${html(person.role)}</p><span class="state ${html(person.status)}">${person.status==='active'?'● ACTIVE TEAM MEMBER':person.status==='on_leave'?'● ON LEAVE':'● INACTIVE'}</span></div></div><div class="verify-grid"><div><label>Employee number</label><strong>#${id(person)}</strong></div><div><label>Department</label><strong>${html(person.department||'Quartz team')}</strong></div><div><label>Joining date</label><strong>${person.start_date?html(person.start_date):'Not listed'}</strong></div></div>`;
 downloadRow.classList.remove('hidden');
 }catch(e){showError(e.message)}}
async function getDocument(e,action){const b=document.querySelector('#'+e);b.disabled=true;try{await action(person,photoUrl)}catch(x){alert('Unable to generate document: '+x.message)}finally{b.disabled=false}}
document.querySelector('#verifyDoc').addEventListener('click',()=>getDocument('verifyDoc',(p,img)=>QuartzEmployeeDocs.documentPDF(p,img,true)));
document.querySelector('#verifyCard').addEventListener('click',()=>getDocument('verifyCard',(p,img)=>QuartzEmployeeDocs.idCardPDF(p,img,location.href)));
document.querySelector('#verifyBadge').addEventListener('click',()=>getDocument('verifyBadge',(p,img)=>QuartzEmployeeDocs.badgePNG(p,img)));
init();
