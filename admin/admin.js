'use strict';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const state={view:'overview',client:null,clients:[],enquiries:[],careers:[],enquiryTab:'new',busy:false,access:[],editingAccessId:null,revealedAccess:new Map()};
const fmtMoney=p=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format((Number(p)||0)/100);
const fmtDate=t=>t?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(t)):'—';
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayId=id=>'#'+String(id).padStart(5,'0');
const safeUrl=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}};
let toastTimeout;
function toast(text,bad=false){const e=$('#toast');e.textContent=text;e.classList.add('show');e.classList.toggle('bad',bad);clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>e.classList.remove('show'),6000)}
async function api(url,options={}){let r;try{r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}})}catch{throw Error('Network connection failed. Try again.')}let d=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401){$('#app').classList.add('hidden');$('#loginPage').classList.remove('hidden')}throw Error(d.error||`Server error (${r.status})`)}return d}
const payload=v=>({method:'POST',body:JSON.stringify(v)});
function setView(view){state.view=view;$$('.view').forEach(el=>el.classList.toggle('hidden',el.id!==view+'View'));$$('[data-view]').forEach(el=>el.classList.toggle('active',el.classList.contains('nav-item')&&el.dataset.view===view));$('#sidebar').classList.remove('open');if(view==='enquiries')loadEnquiries();if(view==='clients')loadClients();if(view==='careers')loadCareers();if(view==='overview')loadSummary();window.scrollTo({top:0,behavior:'instant'})}
async function loadSummary(){try{const d=await api('/api/admin/summary');$('#statClients').textContent=d.client_count;$('#statNew').textContent=d.new_enquiry_count;$('#statPayments').textContent=fmtMoney(d.net_total_paise);$('#statCareers').textContent=d.application_count||0;$('#careerCountBadge').textContent=d.new_application_count||0;$('#newCountBadge').textContent=d.new_enquiry_count}catch(e){toast(e.message,true)}}
async function loadEnquiries(){try{const d=await api('/api/admin/enquiries?status='+state.enquiryTab);state.enquiries=d.enquiries;renderEnquiries();loadSummaryBadge()}catch(e){toast(e.message,true)}}
async function loadSummaryBadge(){try{const d=await api('/api/admin/summary');$('#newCountBadge').textContent=d.new_enquiry_count;$('#careerCountBadge').textContent=d.new_application_count||0;}catch{}}
function renderEnquiries(){
 $('#markAllRead').classList.toggle('hidden',state.enquiryTab!=='new' || !state.enquiries.length);
 $$('[data-enquiry-tab]').forEach(x=>x.classList.toggle('selected',x.dataset.enquiryTab===state.enquiryTab));
 const parent=$('#enquiryList');if(!state.enquiries.length){parent.innerHTML=`<div class="inbox-empty">${state.enquiryTab==='new'?'No new enquiries. New submissions will appear here.':'No enquiries in read history yet.'}</div>`;return}
 parent.innerHTML=state.enquiries.map(e=>`<article class="enquiry-card"><div class="enquiry-top"><div><div class="eyebrow">${e.status==='new'?'NEW ENQUIRY':'ARCHIVED ENQUIRY'} #${e.id}</div><h2>${escapeHTML(e.name)}</h2><a href="mailto:${encodeURIComponent(e.email).replace(/%40/g,'@')}">${escapeHTML(e.email)}</a></div>${e.status==='new'?`<button class="primary" data-read="${e.id}">✓ Mark as read</button>`:''}</div><div class="enquiry-meta"><span><strong>Project:</strong> ${escapeHTML(e.project||'Not specified')}</span><span>${fmtDate(e.created_at)}</span>${e.read_at?`<span>Read: ${fmtDate(e.read_at)}</span>`:''}</div><div class="enquiry-body">${escapeHTML(e.message||'No project brief supplied.')}</div><div class="career-buttons" style="justify-content:space-between"><button class="text-btn" data-enquiry-client="${e.id}">+ Add to client directory</button><button class="tiny destructive" data-enquiry-delete="${e.id}" type="button">Delete forever</button></div></article>`).join('');
}
async function loadClients(){try{const d=await api('/api/admin/clients');state.clients=d.clients;renderClients()}catch(e){toast(e.message,true)}}
function renderClients(){const q=$('#clientSearch').value.toLowerCase().trim(),f=$('#statusFilter').value;const clients=state.clients.filter(c=>(f==='all'||c.status===f)&&[c.business_name,c.contact_name,c.website_url,c.email].some(t=>(t||'').toLowerCase().includes(q)));
 $('#noClients').classList.toggle('hidden',!!clients.length);$('#clientRows').innerHTML=clients.map(c=>{const web=safeUrl(c.website_url);return `<tr><td><span class="client-name">${escapeHTML(c.business_name)} <small class="subtle">${displayId(c.id)}</small></span><span class="subtle">${escapeHTML(c.contact_name||'No contact person')}</span></td><td>${web?`<a class="web-link" rel="noopener noreferrer" target="_blank" href="${escapeHTML(web)}" title="${escapeHTML(web)}">${escapeHTML(new URL(web).host)} ↗</a>`:'<span class="subtle">Not provided</span>'}</td><td><span class="status ${c.status}">${escapeHTML(c.status.replace('_',' '))}</span></td><td><span class="money ${c.balance_paise<0?'negative':''}">${fmtMoney(c.balance_paise)}</span></td><td><button class="text-btn" data-client="${c.id}">View ${c.payment_count} entries →</button></td><td><div class="actions"><button class="tiny" data-client="${c.id}">Open</button><button class="tiny" data-pdf="${c.id}">↓ PDF</button><button class="tiny" data-share="${c.id}">↗</button><button class="tiny destructive" data-client-delete="${c.id}">Delete</button></div></td></tr>`}).join('')}
async function openClient(id){try{const d=await api(`/api/admin/clients/${id}`);state.client=d.client;renderClient(d.client,d.payments);clearAccessForm();await loadAccess(id);setView('client')}catch(e){toast(e.message,true)}}
const fval=id=>$('#'+id).value;
function renderClient(c,payments){$('#clientNumber').textContent=displayId(c.id);$('#clientTitle').textContent=c.business_name;$('#clientSubtitle').textContent=c.contact_name?`Contact: ${c.contact_name}`:'No contact name entered';$('#clientBalance').textContent=fmtMoney(c.balance_paise);$('#paymentTotal').textContent=fmtMoney(c.balance_paise);$('#paymentCount').textContent=`(${payments.length})`;
 const m={businessName:'business_name',contactName:'contact_name',websiteUrl:'website_url',clientStatus:'status',clientEmail:'email',clientPhone:'phone',clientWhatsapp:'whatsapp',clientDescription:'description',clientNotes:'notes'};
 for(const [field,key]of Object.entries(m)) $('#'+field).value=c[key]||'';
 $('#clientDates').textContent=`Created ${fmtDate(c.created_at)} · Last updated ${fmtDate(c.updated_at)}`;
 $('#paymentHistory').innerHTML=payments.length?payments.map(p=>`<div class="history-item ${p.voided_at?'voided-payment':''}"><div class="history-date">${fmtDate(p.paid_at)} <button class="time-info" aria-label="Payment timestamp details" data-time-info="${p.id}" title="${p.manual_date?'Payment date entered manually':'Automatically used the time the payment was added'} · Record added: ${fmtDate(p.created_at)}">!</button></div><div class="history-note">${escapeHTML(p.note||'Payment entry')}<div class="subtle">Entry #${p.id}${p.voided_at?' · VOIDED '+fmtDate(p.voided_at)+' (excluded from total)':''}</div></div><div class="money ${p.amount_paise<0?'negative':''}">${p.amount_paise>0?'+':''}${fmtMoney(p.amount_paise)}</div>${p.voided_at?'<span class="subtle">Void</span>':`<button class="delete-entry" title="Void incorrect entry (retains audit history)" data-remove-payment="${p.id}">✕</button>`}</div>`).join(''):'<div class="history-empty">No payments yet. Your ledger will appear here after you add an entry.</div>'; }
function clientData(){return{business_name:fval('businessName'),contact_name:fval('contactName'),website_url:fval('websiteUrl'),status:fval('clientStatus'),email:fval('clientEmail'),phone:fval('clientPhone'),whatsapp:fval('clientWhatsapp'),description:fval('clientDescription'),notes:fval('clientNotes')}}
async function refreshClient(){if(!state.client)return;const d=await api('/api/admin/clients/'+state.client.id);state.client=d.client;renderClient(d.client,d.payments);await loadSummaryBadge()}
function accessConsent(){return new Promise(resolve=>{
 const modal=$('#shareChoice');modal.classList.remove('hidden');
 const finish=value=>{modal.classList.add('hidden');$('#shareChoiceNo').removeEventListener('click',no);$('#shareChoiceYes').removeEventListener('click',yes);$('#shareChoiceClose').removeEventListener('click',cancel);resolve(value)};
 const no=()=>finish(false),yes=()=>finish(true),cancel=()=>finish(null);
 $('#shareChoiceNo').addEventListener('click',no);$('#shareChoiceYes').addEventListener('click',yes);$('#shareChoiceClose').addEventListener('click',cancel);
 $('#shareChoiceNo').focus();
})}
async function share(scope,id){
 let include_credentials=false;
 if(scope==='client'){const choice=await accessConsent();if(choice===null)return;include_credentials=choice}
 else if(!confirm('Create a read-only, numbered all-client directory? This excludes passwords, private notes and financial information. Anyone with the link can see listed business and contact information. Continue?'))return;
 try{const d=await api('/api/admin/shares',payload({scope,client_id:id,include_credentials}));const link=d.url;try{await navigator.clipboard.writeText(link);toast('Link copied.'+(d.expires_at?' Credentials link expires in 24 hours.':'')+' Previous link revoked.\n'+link)}catch{window.prompt('Copy your read-only link:',link)}}catch(e){toast(e.message,true)}
}
async function revoke(scope,id){if(!confirm('Revoke the existing '+(scope==='all'?'all-clients':'client')+' share links?'))return;try{const d=await api('/api/admin/shares/revoke',payload({scope,client_id:id}));toast(`Revoked ${d.revoked} link(s).`)}catch(e){toast(e.message,true)}}
async function recordForPdf(id,include){const d=await api(`/api/admin/clients/${id}/pdf-data?include_credentials=${include?'true':'false'}`);return d.clients}
async function pdfOne(id){
 const choice=await accessConsent();if(choice===null)return;
 try{toast('Preparing client document...');await QuartzPdf.download(await recordForPdf(id,choice),`quartz-client-${String(id).padStart(5,'0')}.pdf`,{mode:'client'})}catch(e){toast(e.message,true)}
}
async function pdfAll(){try{toast('Preparing compact numbered client directory...');const d=await api('/api/admin/clients/full');await QuartzPdf.download(d.clients,'quartz-all-clients-directory.pdf',{mode:'directory'})}catch(e){toast(e.message,true)}}
async function loadAccess(id){
 state.revealedAccess.clear();
 try{const d=await api(`/api/admin/clients/${id}/access`);state.access=d.access||[];renderAccess()}
 catch(e){state.access=[];renderAccess();toast(e.message,true)}
}
const eyeOpenSvg='<svg class="access-eye-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const eyeClosedSvg='<svg class="access-eye-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A11.1 11.1 0 0 1 12 5c6.4 0 10 7 10 7a14.5 14.5 0 0 1-3.2 4.2M6.5 6.5C3.5 8.7 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.6 4.8-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function renderAccess(){
 const all=state.access||[];
 $('#accessList').innerHTML=all.length?all.map(a=>{
   const revealed=state.revealedAccess.has(a.id);
   const display=a.id_only?'':`<span class="access-secret" aria-live="polite">${revealed?escapeHTML(state.revealedAccess.get(a.id)):'••••••••'}</span><button class="access-eye-btn" type="button" data-access-reveal="${a.id}" title="${revealed?'Hide password':'Show password'}" aria-label="${revealed?'Hide password':'Show password'}" aria-pressed="${revealed?'true':'false'}">${revealed?eyeClosedSvg:eyeOpenSvg}</button>`;
   return `<div class="access-item"><div class="access-record-role"><strong>${escapeHTML(a.label)}</strong><small>${a.id_only?'ID only':'ID + Password'}</small></div><div class="access-record-account"><strong>${escapeHTML(a.login_id)}</strong>${a.id_only?'':`<div class="access-secret-row">${display}</div>`}</div><div class="access-buttons"><button class="tiny" type="button" data-access-edit="${a.id}">Edit</button><button class="tiny" type="button" data-access-remove="${a.id}">Remove</button></div></div>`;
 }).join(''):'<div class="access-empty">No accounts added yet. Add admin, staff or other website login details below.</div>';
}
function clearAccessForm(){$('#accessForm').reset();state.editingAccessId=null;$('#saveAccessBtn').textContent='+ Add access';$('#cancelAccessEdit').classList.add('hidden');$('#accessPassword').closest('label').classList.remove('hidden');$('#accessPassword').placeholder='Password'}
function editAccess(id){const a=state.access.find(x=>x.id===id);if(!a)return;state.editingAccessId=id;$('#accessRole').value=a.label;$('#accessLogin').value=a.login_id;$('#accessIdOnly').checked=a.id_only;$('#accessPassword').value='';$('#accessPassword').placeholder='Leave blank to keep current password';$('#accessPassword').closest('label').classList.toggle('hidden',a.id_only);$('#saveAccessBtn').textContent='Save access';$('#cancelAccessEdit').classList.remove('hidden');$('#accessRole').focus()}
function beginNewClient(prefill={}){$('#newClientForm').reset();$('#newContact').value=prefill.contact||'';$('#newEmail').value=prefill.email||'';$('#newDescription').value=prefill.description||'';$('#newBusiness').value=prefill.business||'';$('#clientModal').classList.remove('hidden');$('#newBusiness').focus()}
function closeNewClient(){$('#clientModal').classList.add('hidden')}
const roleNames={'remote-telecalling-executive':'Telecalling & Marketing Executive','remote-business-development-executive':'Business Development & Marketing Executive','remote-web-developer':'Web Developer'};
function confirmForever(label){
 return window.prompt('PERMANENT DELETE: '+label+'\n\nThis removes the record and associated stored data. This cannot be undone.\n\nType DELETE FOREVER to confirm:')==='DELETE FOREVER';
}
async function foreverDelete(type,id){
 const names={client:'client #'+id+' and all payments, access details and client-specific links',enquiry:'enquiry #'+id,application:'application #'+id+' and its stored CV'};
 if(!confirmForever(names[type]))return;
 const apiPath=type==='application'?'/api/admin/careers/'+id:type==='enquiry'?'/api/admin/enquiries/'+id:'/api/admin/clients/'+id;
 try{
  await api(apiPath,{method:'DELETE',body:JSON.stringify({confirm:'DELETE FOREVER'})});
  if(type==='client'){state.client=null;setView('clients')}
  else if(type==='enquiry')await loadEnquiries();
  else await loadCareers();
  loadSummaryBadge();toast('Permanently deleted from active records.');
 }catch(e){toast(e.message,true)}
}
async function loadCareers(){try{const r=await api('/api/admin/careers');state.careers=r.applications||[];renderCareers();loadSummaryBadge()}catch(e){toast(e.message,true)}}
function renderCareers(){
 const q=$('#careerSearch').value.toLowerCase().trim(),status=$('#careerFilter').value;
 const list=state.careers.filter(a=>(status==='all'||a.status===status)&&[a.name,a.email,a.role,a.state,a.district,a.country].some(x=>String(x||'').toLowerCase().includes(q)));
 const el=$('#careerList');
 if(!list.length){el.innerHTML='<div class="inbox-empty">No matching applications yet.</div>';return}
 el.innerHTML=list.map(a=>`<article class="career-item"><div class="career-head"><div><div class="career-meta"><span class="career-state ${escapeHTML(a.status)}">${escapeHTML(a.status)}</span><span>APPLICATION #${a.id} · ${fmtDate(a.created_at)}</span></div><h2>${escapeHTML(a.name)}</h2><p class="career-sub">${escapeHTML(roleNames[a.role]||a.role)}</p></div><div class="career-buttons"><button type="button" class="tiny" data-app-pdf="${a.id}">↓ Application PDF</button>${a.cv_filename?`<button type="button" class="tiny" data-app-cv="${a.id}">↓ CV</button>`:''}${a.status==='new'?`<button class="tiny" type="button" data-app-review="${a.id}">Mark reviewed</button>`:''}<button class="tiny destructive" type="button" data-app-delete="${a.id}">Delete forever</button></div></div><div class="career-details"><div><strong>Email</strong><span>${escapeHTML(a.email)}</span></div><div><strong>Telephone</strong><span>${escapeHTML(a.phone)}</span></div><div><strong>WhatsApp</strong><span>${escapeHTML(a.whatsapp)}</span></div><div><strong>Education</strong><span>${escapeHTML(a.education)}</span></div><div><strong>Location</strong><span>${escapeHTML([a.district,a.state,a.country,a.postal_code].filter(Boolean).join(', '))}</span></div><div><strong>CV file</strong><span>${escapeHTML(a.cv_filename||'Not attached')}</span></div><div style="grid-column:1/-1"><strong>Skills</strong><span>${escapeHTML(a.skills)}</span></div></div>${a.notes?`<div class="career-note"><strong>ADDITIONAL INFORMATION</strong>\n${escapeHTML(a.notes)}</div>`:''}</article>`).join('');
}
$('#refreshCareers').addEventListener('click',loadCareers);
$('#careerSearch').addEventListener('input',renderCareers);
$('#careerFilter').addEventListener('change',renderCareers);
$('#careerList').addEventListener('click',async e=>{
 const button=e.target.closest('button');if(!button)return;
 if(button.dataset.appDelete){await foreverDelete('application',+button.dataset.appDelete);return}
 if(button.dataset.appCv){window.location.href='/api/admin/careers/'+button.dataset.appCv+'/cv';return}
 if(button.dataset.appPdf){const row=state.careers.find(a=>a.id===+button.dataset.appPdf);if(!row)return;button.disabled=true;try{await QuartzPdf.downloadApplication(row,`quartz-career-application-${row.id}.pdf`);toast('Application PDF downloaded.')}catch(ex){toast(ex.message,true)}finally{button.disabled=false}return}
 if(button.dataset.appReview){button.disabled=true;try{await api('/api/admin/careers/'+button.dataset.appReview+'/reviewed',{method:'POST'});await loadCareers();toast('Application marked reviewed.')}catch(ex){toast(ex.message,true);button.disabled=false}}
});
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';const btn=$('#loginBtn');btn.disabled=true;try{await api('/api/admin/login',payload({loginId:fval('loginId'),password:fval('loginPassword')}));$('#loginPassword').value='';$('#loginPage').classList.add('hidden');$('#app').classList.remove('hidden');setView('overview');loadSummaryBadge()}catch(e){$('#loginError').textContent=e.message}finally{btn.disabled=false}});
$('#logoutBtn').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST'})}finally{location.reload()}});
$$('[data-view]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.view)));
$$('[data-action="new-client"]').forEach(el=>el.addEventListener('click',()=>beginNewClient()));
$('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$$('[data-enquiry-tab]').forEach(el=>el.addEventListener('click',()=>{state.enquiryTab=el.dataset.enquiryTab;loadEnquiries()}));
$('#refreshEnquiries').addEventListener('click',loadEnquiries);
$('#markAllRead').addEventListener('click',async()=>{if(!confirm('Mark all new enquiries as read and move them to history?'))return;try{const r=await api('/api/admin/enquiries/read-all',{method:'POST'});await loadEnquiries();toast(`${r.marked} enquiries moved to read history.`)}catch(e){toast(e.message,true)}});
$('#enquiryList').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.read){b.disabled=true;try{await api(`/api/admin/enquiries/${b.dataset.read}/read`,{method:'POST'});await loadEnquiries();toast('Moved to read history.')}catch(ex){toast(ex.message,true);b.disabled=false}}
 if(b.dataset.enquiryDelete){await foreverDelete('enquiry',+b.dataset.enquiryDelete);return}
 if(b.dataset.enquiryClient){const item=state.enquiries.find(x=>x.id===+b.dataset.enquiryClient);if(item)beginNewClient({contact:item.name,email:item.email,description:[item.project,item.message].filter(Boolean).join(' — ')});}});
$('#clientSearch').addEventListener('input',renderClients);$('#statusFilter').addEventListener('change',renderClients);
$('#clientRows').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.client)await openClient(+b.dataset.client);if(b.dataset.pdf)await pdfOne(+b.dataset.pdf);if(b.dataset.share)await share('client',+b.dataset.share);if(b.dataset.clientDelete)await foreverDelete('client',+b.dataset.clientDelete)});
$('#clientDeleteBtn').addEventListener('click',()=>state.client&&foreverDelete('client',state.client.id));
$('#backClients').addEventListener('click',()=>setView('clients'));
$('#clientForm').addEventListener('submit',async e=>{e.preventDefault();if(!state.client)return;const btn=$('#saveClientBtn');btn.disabled=true;try{await api('/api/admin/clients/'+state.client.id,{method:'PUT',body:JSON.stringify(clientData())});await refreshClient();toast('Client profile updated.')}catch(ex){toast(ex.message,true)}finally{btn.disabled=false}});
$('#paymentForm').addEventListener('submit',async e=>{e.preventDefault();if(!state.client)return;const btn=e.submitter;btn.disabled=true;const dt=fval('payDate');try{await api(`/api/admin/clients/${state.client.id}/payments`,payload({amount:fval('payAmount'),note:fval('payNote'),paid_at:dt?new Date(dt).toISOString():''}));$('#paymentForm').reset();await refreshClient();toast('Payment saved to history.')}catch(ex){toast(ex.message,true)}finally{btn.disabled=false}});
function normalizeBatch(input){return input.split(/[,\n]+/).map(x=>{const parts=x.split('|');if(parts.length>1){const d=(parts[1]||'').trim();if(d&&!/Z$|[+-]\d\d:?\d\d$/.test(d)){const local=d.length===10?d+'T00:00':d.replace(' ','T');const asDate=new Date(local);if(!Number.isNaN(+asDate))parts[1]=asDate.toISOString()}}return parts.join('|')}).join('\n')}
$('#importPayments').addEventListener('click',async()=>{if(!state.client)return;const input=fval('batchPayments').trim();if(!input){toast('Enter comma-separated payment amounts.',true);return}if(!confirm('Import all entries into this client’s payment history?'))return;try{const d=await api(`/api/admin/clients/${state.client.id}/payments/batch`,payload({entries:normalizeBatch(input)}));$('#batchPayments').value='';await refreshClient();toast(`${d.inserted} payment(s) added.`)}catch(ex){toast(ex.message,true)}});
$('#paymentHistory').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.timeInfo){toast(b.title);return}if(b.dataset.removePayment){if(!confirm('Void this payment? It stays visible in the audit history but no longer affects the total.'))return;try{await api(`/api/admin/clients/${state.client.id}/payments/${b.dataset.removePayment}`,{method:'DELETE'});await refreshClient();toast('Payment voided; audit record retained and total recalculated.')}catch(ex){toast(ex.message,true)}}});
$('#newClientForm').addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{const d=await api('/api/admin/clients',payload({business_name:fval('newBusiness'),contact_name:fval('newContact'),email:fval('newEmail'),description:fval('newDescription'),website_url:fval('newWebsite'),status:fval('newStatus')}));closeNewClient();toast('Client created. Add full details and payments.');await openClient(d.client.id)}catch(ex){toast(ex.message,true)}finally{btn.disabled=false}});
$('#closeModal').addEventListener('click',closeNewClient);$('#clientModal').addEventListener('click',e=>{if(e.target.id==='clientModal')closeNewClient()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNewClient()});
$('#clientPdfBtn').addEventListener('click',()=>state.client&&pdfOne(state.client.id));$('#clientShareBtn').addEventListener('click',()=>state.client&&share('client',state.client.id));$('#clientRevokeBtn').addEventListener('click',()=>state.client&&revoke('client',state.client.id));
$('#exportAllPdf').addEventListener('click',pdfAll);$('#exportCsv').addEventListener('click',()=>location.assign('/api/admin/export?format=csv'));$('#exportJson').addEventListener('click',()=>location.assign('/api/admin/export?format=json'));$('#shareAllBtn').addEventListener('click',()=>share('all'));$('#revokeAllBtn').addEventListener('click',()=>revoke('all'));
$('#accessIdOnly').addEventListener('change',()=>{$('#accessPassword').closest('label').classList.toggle('hidden',$('#accessIdOnly').checked);if($('#accessIdOnly').checked)$('#accessPassword').value=''});
$('#cancelAccessEdit').addEventListener('click',clearAccessForm);
$('#accessForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!state.client)return;const btn=$('#saveAccessBtn');btn.disabled=true;
 try{const id=state.client.id,item={label:fval('accessRole'),login_id:fval('accessLogin'),password:fval('accessPassword'),id_only:$('#accessIdOnly').checked};
  if(!item.id_only&&!item.password&&!state.editingAccessId){toast('Enter a password or select ID only.',true);return}
  if(state.editingAccessId)await api(`/api/admin/clients/${id}/access/${state.editingAccessId}`,{method:'PUT',body:JSON.stringify(item)});
  else await api(`/api/admin/clients/${id}/access`,payload(item));
  clearAccessForm();await loadAccess(id);toast('Client website access saved securely.')
 }catch(ex){toast(ex.message,true)}finally{btn.disabled=false}
});
$('#accessList').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||!state.client)return;
 if(b.dataset.accessReveal){
  const entryId=+b.dataset.accessReveal;
  if(state.revealedAccess.has(entryId)){state.revealedAccess.delete(entryId);renderAccess();return}
  b.disabled=true;
  try{
    const clientId=state.client.id;
    const result=await api(`/api/admin/clients/${clientId}/access/${entryId}/reveal`);
    if(state.client?.id===clientId && state.access.some(a=>a.id===entryId)){
      state.revealedAccess.set(entryId,result.password||'');renderAccess();
    }
  }catch(ex){toast(ex.message,true);b.disabled=false}
 }
 else if(b.dataset.accessEdit)editAccess(+b.dataset.accessEdit);
 else if(b.dataset.accessRemove){if(!confirm('Remove this saved client website login?'))return;try{await api(`/api/admin/clients/${state.client.id}/access/${b.dataset.accessRemove}`,{method:'DELETE'});clearAccessForm();await loadAccess(state.client.id);toast('Access record removed.')}catch(ex){toast(ex.message,true)}}
});
(async()=>{try{await api('/api/admin/me');$('#loginPage').classList.add('hidden');$('#app').classList.remove('hidden');setView('overview');loadSummaryBadge()}catch{$('#loginPage').classList.remove('hidden')}})();
