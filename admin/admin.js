const $ = s => document.querySelector(s);
const state = { sites: [], current: null, folderFiles: [], logoFile: null, previewTimer: null };
const els = {
  loginView: $('#loginView'), appView: $('#appView'), loginForm: $('#loginForm'), loginId: $('#loginId'), loginError: $('#loginError'),
  sitesView: $('#sitesView'), editorView: $('#editorView'), siteList: $('#siteList'), emptyState: $('#emptyState'), searchInput: $('#searchInput'),
  totalCount: $('#totalCount'), liveCount: $('#liveCount'), draftCount: $('#draftCount'), siteForm: $('#siteForm'), saveToast: $('#saveToast')
};

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.body && !(options.body instanceof Blob) ? {'content-type':'application/json'} : {}), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function showToast(text, error=false) {
  els.saveToast.textContent = text;
  els.saveToast.style.borderColor = error ? '#6c2934' : '#254e35';
  els.saveToast.classList.remove('hidden');
  setTimeout(() => els.saveToast.classList.add('hidden'), 2800);
}

async function boot() {
  try { await api('/api/admin/me'); showApp(); await loadSites(); }
  catch { els.loginView.classList.remove('hidden'); els.appView.classList.add('hidden'); }
}

els.loginForm.addEventListener('submit', async e => {
  e.preventDefault(); els.loginError.textContent = '';
  try { await api('/api/admin/login', { method:'POST', body:JSON.stringify({ loginId: els.loginId.value.trim() }) }); showApp(); await loadSites(); }
  catch (e) { els.loginError.textContent = e.message; }
});

function showApp(){ els.loginView.classList.add('hidden'); els.appView.classList.remove('hidden'); }
$('#logoutBtn').onclick = async () => { await api('/api/admin/logout',{method:'POST'}).catch(()=>{}); location.reload(); };
$('#newSiteBtn').onclick = openNew;
$('#topNewSiteBtn').onclick = openNew;
$('#backBtn').onclick = () => showSites();
$('#refreshBtn').onclick = () => loadSites();
$('#searchInput').addEventListener('input', debounce(() => loadSites(els.searchInput.value), 250));

async function loadSites(q='') {
  const data = await api('/api/sites' + (q ? `?q=${encodeURIComponent(q)}` : ''));
  state.sites = data.sites || [];
  renderSites();
}

function renderSites() {
  els.totalCount.textContent = state.sites.length;
  els.liveCount.textContent = state.sites.filter(s=>s.status==='published').length;
  els.draftCount.textContent = state.sites.filter(s=>s.status!=='published').length;
  els.siteList.innerHTML = '';
  els.emptyState.classList.toggle('hidden', state.sites.length > 0);
  for (const site of state.sites) {
    const row = document.createElement('div'); row.className='site-row';
    row.innerHTML = `<div class="site-name"><strong>${esc(site.name)}</strong><span>/${esc(site.slug)}/</span></div><div class="site-meta">${esc(site.primary_keyword || site.category || 'No primary keyword')}</div><span class="badge ${site.status==='published'?'live':'draft'}">${site.status==='published'?'PUBLISHED':'DRAFT'}</span><div class="site-meta">${site.deployed_at ? new Date(site.deployed_at).toLocaleDateString() : 'Not deployed'}</div><div class="site-actions"><a href="https://quartzwebsolutions.com/${encodeURIComponent(site.slug)}/" target="_blank" rel="noopener">Open</a><button data-id="${site.id}">Manage</button></div>`;
    row.querySelector('button').onclick = () => openEdit(site.id);
    els.siteList.appendChild(row);
  }
}

function showSites(){ els.sitesView.classList.remove('hidden'); els.editorView.classList.add('hidden'); state.current=null; }
function showEditor(){ els.sitesView.classList.add('hidden'); els.editorView.classList.remove('hidden'); scrollTo({top:0,behavior:'instant'}); }

function blankSite(){ return { name:'',slug:'',status:'draft',logo_path:'',seo_title:'',seo_description:'',primary_keyword:'',keywords:[],category:'',business_type:'LocalBusiness',city:'',district:'',state:'Kerala',country_code:'IN',address:'',postal_code:'',phone:'',whatsapp:'',email:'',opening_hours:[],maps_url:'',latitude:'',longitude:'',price_range:'',instagram_url:'',facebook_url:'',youtube_url:'',business_description:'',services:[],index_html:'<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Business Website</title>\n</head>\n<body>\n  <main>\n    <h1>Business Name</h1>\n    <p>Add the real business content here.</p>\n  </main>\n</body>\n</html>' }; }
function openNew(){ state.current=null; state.folderFiles=[]; state.logoFile=null; fillForm(blankSite()); $('#deleteBtn').classList.add('hidden'); $('#openLiveBtn').classList.add('hidden'); showEditor(); }
async function openEdit(id){ const data=await api(`/api/sites/${id}`); state.current=data.site; state.folderFiles=[]; state.logoFile=null; fillForm(data.site); $('#deleteBtn').classList.remove('hidden'); updateLiveLink(); showEditor(); }

function fillForm(s){
  $('#siteName').value=s.name||''; $('#siteSlug').value=s.slug||''; $('#category').value=s.category||''; $('#businessType').value=s.business_type||'LocalBusiness'; $('#services').value=(s.services||[]).join(', '); $('#city').value=s.city||''; $('#district').value=s.district||''; $('#state').value=s.state||'Kerala'; $('#address').value=s.address||''; $('#postalCode').value=s.postal_code||''; $('#phone').value=s.phone||''; $('#whatsapp').value=s.whatsapp||''; $('#email').value=s.email||''; $('#openingHours').value=(s.opening_hours||[]).join('\n'); $('#mapsUrl').value=s.maps_url||''; $('#latitude').value=s.latitude??''; $('#longitude').value=s.longitude??''; $('#priceRange').value=s.price_range||''; $('#instagramUrl').value=s.instagram_url||''; $('#facebookUrl').value=s.facebook_url||''; $('#youtubeUrl').value=s.youtube_url||''; $('#businessDescription').value=s.business_description||''; $('#primaryKeyword').value=s.primary_keyword||''; $('#keywords').value=(s.keywords||[]).join('\n'); $('#seoTitle').value=s.seo_title||''; $('#seoDescription').value=s.seo_description||''; $('#indexHtml').value=s.index_html||'';
  $('#currentStatus').textContent = s.id ? (s.status==='published'?'Published':'Draft') : 'New site'; $('#deployedAt').textContent=s.deployed_at?new Date(s.deployed_at).toLocaleString():'—'; $('#folderStatus').textContent=''; $('#logoFile').value=''; $('#indexFile').value=''; $('#folderFiles').value='';
  renderLogo(s.logo_path); updatePreviewUrl(); updateSeoScore(); renderHtmlPreview();
}

function getForm(status){
  const name=$('#siteName').value.trim();
  const slug=slugify($('#siteSlug').value || name);
  return { name,slug,status,category:$('#category').value.trim(),business_type:$('#businessType').value,services:$('#services').value,city:$('#city').value.trim(),district:$('#district').value.trim(),state:$('#state').value.trim()||'Kerala',country_code:'IN',address:$('#address').value.trim(),postal_code:$('#postalCode').value.trim(),phone:$('#phone').value.trim(),whatsapp:$('#whatsapp').value.trim(),email:$('#email').value.trim(),opening_hours:$('#openingHours').value,maps_url:$('#mapsUrl').value.trim(),latitude:$('#latitude').value.trim(),longitude:$('#longitude').value.trim(),price_range:$('#priceRange').value.trim(),instagram_url:$('#instagramUrl').value.trim(),facebook_url:$('#facebookUrl').value.trim(),youtube_url:$('#youtubeUrl').value.trim(),business_description:$('#businessDescription').value.trim(),primary_keyword:$('#primaryKeyword').value.trim(),keywords:$('#keywords').value,seo_title:$('#seoTitle').value.trim(),seo_description:$('#seoDescription').value.trim(),index_html:$('#indexHtml').value,logo_path:state.current?.logo_path||'' };
}

async function save(status){
  const payload=getForm(status);
  if(!payload.name||!payload.slug||!payload.index_html.trim()){showToast('Name, URL slug and index.html are required',true);return;}
  $('#siteSlug').value=payload.slug;
  try{
    let site;
    if(state.current?.id){ site=(await api(`/api/sites/${state.current.id}`,{method:'PUT',body:JSON.stringify(payload)})).site; }
    else { site=(await api('/api/sites',{method:'POST',body:JSON.stringify(payload)})).site; }
    state.current=site;
    if(state.logoFile) await uploadLogo(site);
    if(state.folderFiles.length) await uploadFolder(site);
    if(state.logoFile || state.folderFiles.length) state.current=(await api(`/api/sites/${site.id}`)).site;
    fillForm(state.current); $('#deleteBtn').classList.remove('hidden'); updateLiveLink(); showToast(status==='published'?'Website deployed':'Draft saved'); await loadSites();
  }catch(e){showToast(e.message,true);}
}
$('#saveDraftBtn').onclick=()=>save('draft'); $('#publishBtn').onclick=()=>save('published');

$('#deleteBtn').onclick=async()=>{ if(!state.current?.id)return; if(!confirm(`Delete ${state.current.name}? This removes its stored assets too.`))return; try{await api(`/api/sites/${state.current.id}`,{method:'DELETE'});showToast('Website deleted');showSites();await loadSites();}catch(e){showToast(e.message,true);} };

$('#indexFile').addEventListener('change', async e=>{const f=e.target.files?.[0];if(!f)return;$('#indexHtml').value=await f.text();renderHtmlPreview();updateSeoScore();});
$('#folderFiles').addEventListener('change', async e=>{
  const files=[...(e.target.files||[])]; state.folderFiles=[];
  if(!files.length)return;
  const roots=files.map(f=>f.webkitRelativePath||f.name); const firstRoot=roots[0].split('/')[0];
  for(const file of files){ let path=(file.webkitRelativePath||file.name).replace(/^\/+/, ''); if(firstRoot && path.startsWith(firstRoot+'/')) path=path.slice(firstRoot.length+1); if(!path)continue; if(path.toLowerCase()==='index.html'){ $('#indexHtml').value=await file.text(); } else state.folderFiles.push({file,path}); }
  $('#folderStatus').textContent=`${files.length} files selected · ${state.folderFiles.length} assets will upload`; renderHtmlPreview(); updateSeoScore();
});
$('#logoFile').addEventListener('change',e=>{state.logoFile=e.target.files?.[0]||null;if(state.logoFile){const url=URL.createObjectURL(state.logoFile);$('#logoPreview').innerHTML=`<img src="${url}" alt="Logo preview">`;}});

async function uploadLogo(site){
  const ext=(state.logoFile.name.split('.').pop()||'webp').toLowerCase().replace(/[^a-z0-9]/g,''); const path=`quartz-logo.${ext}`;
  await uploadAsset(site.id,path,state.logoFile); state.current.logo_path=path;
  await api(`/api/sites/${site.id}`,{method:'PUT',body:JSON.stringify({...getForm(site.status),logo_path:path})}); state.logoFile=null;
}
async function uploadFolder(site){
  let done=0; $('#folderStatus').textContent=`Syncing website folder...`;
  const desired=new Set(state.folderFiles.map(x=>x.path));
  if(state.current?.logo_path) desired.add(state.current.logo_path);
  try{
    const existing=(await api(`/api/sites/${site.id}/assets`)).assets||[];
    for(const asset of existing){
      if(!desired.has(asset.path)) await deleteAsset(site.id,asset.path);
    }
  }catch(e){ console.warn('Asset cleanup skipped',e); }
  $('#folderStatus').textContent=`Uploading 0/${state.folderFiles.length} assets...`;
  for(const item of state.folderFiles){ await uploadAsset(site.id,item.path,item.file); done++; $('#folderStatus').textContent=`Uploading ${done}/${state.folderFiles.length} assets...`; }
  $('#folderStatus').textContent=`${done} assets synced · SEO/sitemap updated automatically`; state.folderFiles=[];
}
async function uploadAsset(id,path,file){ const res=await fetch(`/api/sites/${id}/assets?path=${encodeURIComponent(path)}`,{method:'PUT',credentials:'same-origin',headers:{'content-type':file.type||mimeFromName(file.name)},body:file});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`Asset upload failed: ${path}`);return data; }
async function deleteAsset(id,path){ const res=await fetch(`/api/sites/${id}/assets?path=${encodeURIComponent(path)}`,{method:'DELETE',credentials:'same-origin'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`Asset delete failed: ${path}`);return data; }

function renderLogo(path){const box=$('#logoPreview'); if(!path||!state.current?.slug){box.textContent='No logo';return;} box.innerHTML=`<img src="https://quartzwebsolutions.com/${encodeURIComponent(state.current.slug)}/${path.split('/').map(encodeURIComponent).join('/')}?v=${Date.now()}" alt="Logo">`;}
function updateLiveLink(){const a=$('#openLiveBtn');if(state.current?.slug&&state.current.status==='published'){a.href=`https://quartzwebsolutions.com/${state.current.slug}/`;a.classList.remove('hidden')}else a.classList.add('hidden');}
function updatePreviewUrl(){const slug=slugify($('#siteSlug').value||$('#siteName').value);const a=$('#previewUrl');if(slug){a.textContent=`/${slug}/`;a.href=`https://quartzwebsolutions.com/${slug}/`;}else{a.textContent='—';a.removeAttribute('href');}}
function autoSearchPhrases(){
  const name=$('#siteName').value.trim(), category=$('#category').value.trim(), city=$('#city').value.trim(), district=$('#district').value.trim(), services=$('#services').value.split(/[,\n]+/).map(x=>x.trim()).filter(Boolean), primary=$('#primaryKeyword').value.trim(), manual=$('#keywords').value.split(/[,\n]+/).map(x=>x.trim()).filter(Boolean);
  const out=new Set(); const add=v=>{v=String(v||'').replace(/\s+/g,' ').trim();if(v)out.add(v)};
  const simple=category.replace(/\b(store|shop|business|services?|company|centre|center)\b/gi,'').replace(/\s+/g,' ').trim();
  add(primary);manual.forEach(add);add(name);add(category);
  if(name&&city){add(`${name} ${city}`);add(`${name} in ${city}`)}
  if(name&&district)add(`${name} ${district}`);if(name&&category)add(`${name} ${category}`);if(name&&category&&city)add(`${name} ${category} ${city}`);
  if(category&&city){add(`${category} ${city}`);add(`${category} in ${city}`)} if(simple&&city){add(`${simple} ${city}`);add(`${city} ${simple}`)} if(category&&district)add(`${category} ${district}`);
  services.slice(0,12).forEach(x=>{add(x);if(city){add(`${x} ${city}`);add(`${x} in ${city}`)}if(name)add(`${name} ${x}`)});
  return [...out].slice(0,40);
}
function updateSeoScore(){const vals={name:$('#siteName').value.trim(),slug:slugify($('#siteSlug').value||$('#siteName').value),primary:$('#primaryKeyword').value.trim(),keywords:$('#keywords').value.trim(),title:$('#seoTitle').value.trim(),description:$('#seoDescription').value.trim(),category:$('#category').value.trim(),type:$('#businessType').value,city:$('#city').value.trim(),address:$('#address').value.trim(),phone:$('#phone').value.trim(),hours:$('#openingHours').value.trim(),map:$('#mapsUrl').value.trim(),business:$('#businessDescription').value.trim(),html:$('#indexHtml').value.trim()};const checks=[['Business name',!!vals.name],['URL slug',!!vals.slug],['Primary keyword or strong business/category data',!!vals.primary||(!!vals.name&&!!vals.category&&!!vals.city)],['Secondary keywords / services',!!vals.keywords||!!$('#services').value.trim()],['SEO title or automatic title data',!!vals.title||(!!vals.name&&!!vals.category)],['Meta description or business description',!!vals.description||vals.business.length>60],['Category + schema type',!!vals.category&&!!vals.type],['City / location',!!vals.city],['Address / phone',!!vals.address&&!!vals.phone],['Opening hours / map',!!vals.hours&&!!vals.map],['Business description',vals.business.length>60],['index.html',vals.html.length>80]];const score=Math.round(checks.filter(x=>x[1]).length/checks.length*100);$('#seoScore').textContent=score;$('#seoChecks').innerHTML=checks.map(([n,ok])=>`<span class="seo-check ${ok?'ok':''}">${ok?'✓':'○'} ${n}</span>`).join('');const phrases=autoSearchPhrases();const box=$('#autoSearchPhrases');if(box)box.innerHTML=`<strong>Automatic local search phrases</strong><span>${phrases.length?phrases.map(esc).join(' · '):'Add business name, category, city and services to generate search phrases.'}</span>`;updatePreviewUrl();}
function renderHtmlPreview(){clearTimeout(state.previewTimer);state.previewTimer=setTimeout(()=>{$('#htmlPreview').srcdoc=$('#indexHtml').value||'<p style="font-family:sans-serif;padding:20px">No HTML yet</p>';},250);}

['siteName','siteSlug','category','businessType','services','city','district','state','address','postalCode','phone','whatsapp','email','openingHours','mapsUrl','latitude','longitude','priceRange','instagramUrl','facebookUrl','youtubeUrl','businessDescription','primaryKeyword','keywords','seoTitle','seoDescription','indexHtml'].forEach(id=>$('#'+id).addEventListener('input',()=>{updateSeoScore();if(id==='indexHtml')renderHtmlPreview();if(id==='siteName'&&!$('#siteSlug').dataset.touched){$('#siteSlug').value=slugify($('#siteName').value);updatePreviewUrl();}}));
$('#siteSlug').addEventListener('input',()=>$('#siteSlug').dataset.touched='1');

function slugify(v){return String(v||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)}
function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
function mimeFromName(name){const e=(name.split('.').pop()||'').toLowerCase();return({css:'text/css',js:'application/javascript',html:'text/html',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',json:'application/json',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf'})[e]||'application/octet-stream'}
boot();
