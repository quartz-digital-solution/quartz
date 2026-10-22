'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const money=p=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format((Number(p)||0)/100);
const dt=s=>s?new Date(s).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}):'-';
const field=(k,v)=>`<div class="field"><small>${esc(k)}</small><strong>${esc(v||'-')}</strong></div>`;
let records=[];let reportScope='client';
const ref=id=>'#'+String(id).padStart(5,'0');
const safeUrl=v=>{try{const x=new URL(v);return ['https:','http:'].includes(x.protocol)?x.href:null}catch{return null}};
const link=(v,type)=>v?`<a href="${type}:${type==='mailto'?encodeURIComponent(v).replace(/%40/g,'@'):encodeURIComponent(v)}">${esc(v)}</a>`:'—';
function render(){
 const directory=reportScope==='all';
 $('#reportTitle').textContent=directory?'Client directory.':records[0]?.business_name||'Client record';
 $('#reportDesc').textContent=directory?'Numbered business directory · essential details only · no payment records or passwords.':'Client information and payment record shared by Quartz Web Solutions.';
 $('#clientCount').textContent=records.length;
 $('#totalCard').classList.toggle('hidden',directory);
 $('#grandTotal').textContent=directory?'—':money(records.reduce((a,c)=>a+(c.balance_paise||0),0));
 if(directory){
  $('#clients').innerHTML=`<div class="directory-list">${records.map((c,i)=>{const web=safeUrl(c.website_url);return `<article class="directory-row"><span class="directory-index">${i+1}.</span><div class="directory-info"><div class="directory-main"><strong>${web?`<a class="directory-name-link" href="${esc(web)}" target="_blank" rel="noopener noreferrer">${esc(c.business_name)}</a>`:esc(c.business_name)}</strong><span class="directory-id">${ref(c.id)}</span><span class="status ${esc(c.status)}">${esc((c.status||'').replace('_',' '))}</span></div><div class="directory-meta"><span>${esc(c.contact_name||'No contact')}</span>${web?`<a target="_blank" rel="noopener noreferrer" href="${esc(web)}">${esc(c.website_url)} ↗</a>`:''}${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:''}${c.phone?`<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`:''}</div></div></article>`}).join('')}</div>`;
 }else{
  $('#clients').innerHTML=records.map(c=>{const web=safeUrl(c.website_url),payments=c.payments||[],access=c.access||[];
   return `<article class="client"><div class="client-header"><div><span class="eyebrow">CLIENT ${ref(c.id)}</span><h2>${esc(c.business_name)}</h2><p>${esc(c.contact_name||'Contact not supplied')}</p></div><span class="status ${esc(c.status)}">${esc((c.status||'').replace('_',' '))}</span></div>
   <div class="details">${field('Contact person',c.contact_name)}${web?`<div class="field"><small>Website</small><a href="${esc(web)}" target="_blank" rel="noopener noreferrer">${esc(c.website_url)} ↗</a></div>`:field('Website',c.website_url)}<div class="field"><small>Email</small>${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:'—'}</div><div class="field"><small>Phone</small>${c.phone?`<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`:'—'}</div>${field('WhatsApp',c.whatsapp)}${field('Services / deliverables',c.description)}${field('Project notes',c.notes)}</div>
   ${access.length?`<div class="shared-access"><h3>Website access</h3>${access.map(a=>`<div class="shared-access-row"><strong>${esc(a.label)}</strong><span>${esc(a.login_id)}</span><span>${a.id_only?'ID only':esc(a.password)}</span></div>`).join('')}</div>`:''}
   <div class="payments"><div class="payments-head"><h2>Payment history</h2><strong>${money(c.balance_paise)}</strong></div><div class="history-scroll"><table class="history"><thead><tr><th>Payment date</th><th>Type</th><th>Note</th><th>Amount</th></tr></thead><tbody>${payments.length?payments.map(p=>`<tr><td>${dt(p.paid_at)} <button class="info" title="${p.manual_date?'Date entered manually':'Used time entry was added'}; added ${dt(p.created_at)}">!</button></td><td>${p.voided_at?'Voided':p.amount_paise>=0?'Credit':'Adjustment'}</td><td>${esc(p.note||'-')}${p.voided_at?' (VOIDED '+dt(p.voided_at)+')':''}</td><td class="${p.voided_at?'voided':p.amount_paise>=0?'positive':'negative'}">${p.amount_paise>=0?'+':''}${money(p.amount_paise)}</td></tr>`).join(''):'<tr><td colspan="4">No payments recorded.</td></tr>'}</tbody></table></div></div><div class="record-footer">Created: ${dt(c.created_at)} · Updated: ${dt(c.updated_at)}</div></article>`;
  }).join('');
 }
 $('#report').classList.remove('hidden');
}
$('#downloadPdf').addEventListener('click',async()=>{const b=$('#downloadPdf');b.disabled=true;try{await QuartzPdf.download(records,reportScope==='all'?'quartz-clients-directory.pdf':`quartz-client-${String(records[0].id).padStart(5,'0')}.pdf`,{mode:reportScope==='all'?'directory':'client'})}catch(e){alert('PDF could not be created: '+e.message)}finally{b.disabled=false}});
(async()=>{try{const token=location.pathname.match(/^\/share\/([a-zA-Z0-9_-]{32,100})\/?$/)?.[1];if(!token)throw Error('No valid share token provided.');const r=await fetch('/api/public/shared/'+token,{cache:'no-store',credentials:'omit'});const d=await r.json();if(!r.ok)throw Error(d.error||'Share link expired.');records=d.clients||[];reportScope=d.scope||'client';render()}catch(e){$('#failure').textContent=e.message;$('#failure').classList.remove('hidden')}finally{$('#loading').classList.add('hidden')}})();
