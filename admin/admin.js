const $ = s => document.querySelector(s);
const state = { sites: [], current: null, folderFiles: [], logoFile: null };
const els = {
  loginView: $('#loginView'), appView: $('#appView'), loginForm: $('#loginForm'), loginId: $('#loginId'), loginError: $('#loginError'),
  sitesView: $('#sitesView'), editorView: $('#editorView'), siteList: $('#siteList'), emptyState: $('#emptyState'), searchInput: $('#searchInput'),
  totalCount: $('#totalCount'), liveCount: $('#liveCount'), siteForm: $('#siteForm'), saveToast: $('#saveToast'),
  sitesNavBtn: $('#sitesNavBtn'), newSiteBtn: $('#newSiteBtn'), busyOverlay: $('#busyOverlay'), busyText: $('#busyText')
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof Blob) ? {'content-type':'application/json'} : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function setBusy(on, text='Working…') {
  els.busyText.textContent = text;
  els.busyOverlay.classList.toggle('hidden', !on);
}

function showToast(text, error=false) {
  els.saveToast.textContent = text;
  els.saveToast.style.borderColor = error ? '#6c2934' : '#254e35';
  els.saveToast.classList.remove('hidden');
  setTimeout(() => els.saveToast.classList.add('hidden'), 2800);
}

function setNav(which) {
  els.sitesNavBtn.classList.toggle('active', which === 'sites');
  els.newSiteBtn.classList.toggle('active', which === 'add');
}

async function boot() {
  setBusy(true, 'Loading admin…');
  try {
    await api('/api/admin/me');
    showApp();
    await loadSites('', false);
  } catch {
    els.loginView.classList.remove('hidden');
    els.appView.classList.add('hidden');
  } finally {
    setBusy(false);
  }
}

els.loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  els.loginError.textContent = '';
  setBusy(true, 'Signing in…');
  try {
    await api('/api/admin/login', { method:'POST', body:JSON.stringify({ loginId: els.loginId.value.trim() }) });
    showApp();
    await loadSites('', false);
  } catch (e) {
    els.loginError.textContent = e.message;
  } finally {
    setBusy(false);
  }
});

function showApp(){
  els.loginView.classList.add('hidden');
  els.appView.classList.remove('hidden');
  showSites();
}

els.sitesNavBtn.onclick = () => showSites();
els.newSiteBtn.onclick = openNew;
$('#backBtn').onclick = () => showSites();
$('#refreshBtn').onclick = () => loadSites(els.searchInput.value);
$('#searchInput').addEventListener('input', debounce(() => loadSites(els.searchInput.value), 250));

async function loadSites(q='', showLoader=true) {
  if (showLoader) setBusy(true, 'Loading websites…');
  try {
    const data = await api('/api/sites' + (q ? `?q=${encodeURIComponent(q)}` : ''));
    state.sites = data.sites || [];
    renderSites();
  } finally {
    if (showLoader) setBusy(false);
  }
}

function siteLogoUrl(site) {
  if (!site.logo_path || !site.slug) return '';
  return `https://quartzwebsolutions.com/${encodeURIComponent(site.slug)}/${site.logo_path.split('/').map(encodeURIComponent).join('/')}?v=${encodeURIComponent(site.updated_at || '')}`;
}

function renderSites() {
  els.totalCount.textContent = state.sites.length;
  els.liveCount.textContent = state.sites.filter(s => s.status === 'published').length;
  els.siteList.innerHTML = '';
  els.emptyState.classList.toggle('hidden', state.sites.length > 0);

  for (const site of state.sites) {
    const card = document.createElement('article');
    card.className = 'site-card';
    const logo = siteLogoUrl(site);
    const location = [site.city, site.district].filter(Boolean).join(', ');
    const keyword = site.primary_keyword || site.category || 'SEO details not added';
    const updated = site.updated_at ? `Updated ${new Date(site.updated_at).toLocaleDateString()}` : '';
    card.innerHTML = `
      <div class="site-card-main">
        <div class="site-thumb">${logo ? `<img src="${logo}" alt="">` : esc((site.name || '?').slice(0,1).toUpperCase())}</div>
        <div class="site-copy">
          <strong>${esc(site.name)}</strong>
          <span class="url">quartzwebsolutions.com/${esc(site.slug)}/</span>
          <span class="meta">${esc(keyword)}${location ? ` · ${esc(location)}` : ''}</span>
        </div>
      </div>
      <div class="site-card-side">
        <div class="site-card-status">
          <span class="badge ${site.status === 'published' ? 'live' : 'draft'}">${site.status === 'published' ? 'PUBLISHED' : 'NOT PUBLISHED'}</span>
          <span class="updated">${esc(updated)}</span>
        </div>
        <div class="site-actions">
          ${site.status === 'published' ? `<a href="https://quartzwebsolutions.com/${encodeURIComponent(site.slug)}/" target="_blank" rel="noopener">Open</a>` : ''}
          <button class="manage" type="button" data-id="${site.id}">Manage →</button>
        </div>
      </div>`;
    card.querySelector('.manage').onclick = () => openEdit(site.id);
    els.siteList.appendChild(card);
  }
}

function showSites(){
  els.sitesView.classList.remove('hidden');
  els.editorView.classList.add('hidden');
  state.current = null;
  state.folderFiles = [];
  state.logoFile = null;
  setNav('sites');
}
function showEditor(mode='edit'){
  els.sitesView.classList.add('hidden');
  els.editorView.classList.remove('hidden');
  setNav(mode === 'new' ? 'add' : 'sites');
  scrollTo({top:0,behavior:'instant'});
}

function blankSite(){
  return {
    name:'',slug:'',status:'draft',logo_path:'',seo_title:'',seo_description:'',primary_keyword:'',keywords:[],category:'',business_type:'LocalBusiness',
    city:'',district:'',state:'Kerala',country_code:'IN',address:'',postal_code:'',phone:'',whatsapp:'',email:'',opening_hours:[],maps_url:'',
    instagram_url:'',facebook_url:'',youtube_url:'',business_description:'',services:[],
    index_html:'<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Business Website</title>\n</head>\n<body>\n  <main>\n    <h1>Business Name</h1>\n    <p>Add the real business content here.</p>\n  </main>\n</body>\n</html>'
  };
}

function openNew(){
  state.current = null;
  state.folderFiles = [];
  state.logoFile = null;
  fillForm(blankSite());
  $('#deleteBtn').classList.add('hidden');
  $('#openLiveBtn').classList.add('hidden');
  showEditor('new');
}

async function openEdit(id){
  setBusy(true, 'Loading website…');
  try {
    const data = await api(`/api/sites/${id}`);
    state.current = data.site;
    state.folderFiles = [];
    state.logoFile = null;
    fillForm(data.site);
    $('#deleteBtn').classList.remove('hidden');
    updateLiveLink();
    showEditor('edit');
  } catch (e) {
    showToast(e.message, true);
  } finally {
    setBusy(false);
  }
}

function fillForm(s){
  $('#siteName').value=s.name||'';
  $('#siteSlug').value=s.slug||'';
  $('#siteSlug').dataset.touched = s.slug ? '1' : '';
  $('#category').value=s.category||'';
  $('#businessType').value=s.business_type||'LocalBusiness';
  $('#services').value=(s.services||[]).join(', ');
  $('#city').value=s.city||'';
  $('#district').value=s.district||'';
  $('#state').value=s.state||'Kerala';
  $('#address').value=s.address||'';
  $('#postalCode').value=s.postal_code||'';
  $('#phone').value=s.phone||'';
  $('#whatsapp').value=s.whatsapp||'';
  $('#email').value=s.email||'';
  $('#openingHours').value=(s.opening_hours||[]).join('\n');
  $('#mapsUrl').value=s.maps_url||'';
  $('#instagramUrl').value=s.instagram_url||'';
  $('#facebookUrl').value=s.facebook_url||'';
  $('#youtubeUrl').value=s.youtube_url||'';
  $('#businessDescription').value=s.business_description||'';
  $('#primaryKeyword').value=s.primary_keyword||'';
  $('#keywords').value=(s.keywords||[]).join('\n');
  $('#seoTitle').value=s.seo_title||'';
  $('#seoDescription').value=s.seo_description||'';
  $('#indexHtml').value=s.index_html||'';
  $('#currentStatus').textContent = s.id ? (s.status==='published'?'Published':'Not published') : 'New site';
  $('#deployedAt').textContent=s.deployed_at?new Date(s.deployed_at).toLocaleString():'—';
  $('#folderStatus').textContent='';
  $('#logoFile').value='';
  $('#indexFile').value='';
  $('#folderFiles').value='';
  renderLogo(s.logo_path);
  updatePreviewUrl();
  updateSeoScore();
}

function getForm(status='published'){
  const name=$('#siteName').value.trim();
  const slug=slugify($('#siteSlug').value || name);
  return {
    name,slug,status,
    category:$('#category').value.trim(),business_type:$('#businessType').value,services:$('#services').value,
    city:$('#city').value.trim(),district:$('#district').value.trim(),state:$('#state').value.trim()||'Kerala',country_code:'IN',
    address:$('#address').value.trim(),postal_code:$('#postalCode').value.trim(),phone:$('#phone').value.trim(),whatsapp:$('#whatsapp').value.trim(),email:$('#email').value.trim(),
    opening_hours:$('#openingHours').value,maps_url:$('#mapsUrl').value.trim(),instagram_url:$('#instagramUrl').value.trim(),facebook_url:$('#facebookUrl').value.trim(),youtube_url:$('#youtubeUrl').value.trim(),
    business_description:$('#businessDescription').value.trim(),primary_keyword:$('#primaryKeyword').value.trim(),keywords:$('#keywords').value,
    seo_title:$('#seoTitle').value.trim(),seo_description:$('#seoDescription').value.trim(),index_html:$('#indexHtml').value,
    logo_path:state.current?.logo_path||''
  };
}

async function savePublished(){
  const payload=getForm('published');
  if(!payload.name||!payload.slug||!payload.index_html.trim()){
    showToast('Name, URL slug and index.html are required',true);
    return;
  }
  $('#siteSlug').value=payload.slug;
  setBusy(true, state.current?.id ? 'Updating & deploying…' : 'Deploying website…');
  try{
    let site;
    if(state.current?.id) site=(await api(`/api/sites/${state.current.id}`,{method:'PUT',body:JSON.stringify(payload)})).site;
    else site=(await api('/api/sites',{method:'POST',body:JSON.stringify(payload)})).site;

    state.current=site;
    if(state.logoFile){
      els.busyText.textContent='Uploading app icon…';
      await uploadLogo(site);
    }
    if(state.folderFiles.length){
      els.busyText.textContent='Syncing website files…';
      await uploadFolder(site);
    }
    if(state.logoFile || state.folderFiles.length) state.current=(await api(`/api/sites/${site.id}`)).site;
    else state.current=(await api(`/api/sites/${site.id}`)).site;

    fillForm(state.current);
    $('#deleteBtn').classList.remove('hidden');
    updateLiveLink();
    await loadSites(els.searchInput.value, false);
    showToast('Website deployed successfully');
  }catch(e){
    showToast(e.message,true);
  }finally{
    setBusy(false);
  }
}
$('#publishBtn').onclick = savePublished;

$('#deleteBtn').onclick=async()=>{
  if(!state.current?.id)return;
  if(!confirm(`Delete ${state.current.name}? This permanently removes the website record and all files stored for it on Quartz.`))return;
  setBusy(true, 'Deleting website & server files…');
  try{
    await api(`/api/sites/${state.current.id}`,{method:'DELETE'});
    showSites();
    await loadSites(els.searchInput.value, false);
    showToast('Website and stored server files deleted');
  }catch(e){
    showToast(e.message,true);
  }finally{
    setBusy(false);
  }
};

$('#indexFile').addEventListener('change', async e=>{
  const f=e.target.files?.[0];
  if(!f)return;
  $('#indexHtml').value=await f.text();
  updateSeoScore();
});

$('#folderFiles').addEventListener('change', async e=>{
  const files=[...(e.target.files||[])];
  state.folderFiles=[];
  if(!files.length)return;
  const roots=files.map(f=>f.webkitRelativePath||f.name);
  const firstRoot=roots[0].split('/')[0];
  for(const file of files){
    let path=(file.webkitRelativePath||file.name).replace(/^\/+/, '');
    if(firstRoot && path.startsWith(firstRoot+'/')) path=path.slice(firstRoot.length+1);
    if(!path)continue;
    if(path.toLowerCase()==='index.html') $('#indexHtml').value=await file.text();
    else state.folderFiles.push({file,path});
  }
  $('#folderStatus').textContent=`${files.length} files selected · ${state.folderFiles.length} assets will sync`;
  updateSeoScore();
});

$('#logoFile').addEventListener('change', async e=>{
  const original=e.target.files?.[0]||null;
  if(!original){ state.logoFile=null; return; }
  setBusy(true,'Preparing 1:1 app icon…');
  try{
    state.logoFile=await prepareSquareLogo(original);
    const url=URL.createObjectURL(state.logoFile);
    $('#logoPreview').innerHTML=`<img src="${url}" alt="Square logo preview">`;
    updateSeoScore();
  }catch(err){
    state.logoFile=null;
    e.target.value='';
    showToast('Could not process this image. Please choose PNG, JPG, WebP or another browser-supported image.',true);
  }finally{
    setBusy(false);
  }
});

async function prepareSquareLogo(file){
  const bitmap=await createImageBitmap(file);
  const source=Math.min(bitmap.width,bitmap.height);
  const sx=(bitmap.width-source)/2;
  const sy=(bitmap.height-source)/2;
  const canvas=document.createElement('canvas');
  canvas.width=512;
  canvas.height=512;
  const ctx=canvas.getContext('2d',{alpha:true});
  ctx.clearRect(0,0,512,512);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(bitmap,sx,sy,source,source,0,0,512,512);
  bitmap.close?.();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.92));
  if(!blob) throw new Error('Image conversion failed');
  return new File([blob],'quartz-logo.webp',{type:'image/webp'});
}

async function resizeSquareFile(file,size,name){
  const bitmap=await createImageBitmap(file);
  const canvas=document.createElement('canvas');
  canvas.width=size;
  canvas.height=size;
  const ctx=canvas.getContext('2d',{alpha:true});
  ctx.clearRect(0,0,size,size);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(bitmap,0,0,size,size);
  bitmap.close?.();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.92));
  if(!blob) throw new Error('Icon resize failed');
  return new File([blob],name,{type:'image/webp'});
}

async function uploadLogo(site){
  const path='quartz-logo.webp';
  const smallPath='quartz-logo-192.webp';
  const icon192=await resizeSquareFile(state.logoFile,192,smallPath);
  await uploadAsset(site.id,path,state.logoFile);
  await uploadAsset(site.id,smallPath,icon192);
  state.current.logo_path=path;
  await api(`/api/sites/${site.id}`,{method:'PUT',body:JSON.stringify({...getForm('published'),logo_path:path})});
  state.logoFile=null;
}

async function uploadFolder(site){
  let done=0;
  $('#folderStatus').textContent='Syncing website folder…';
  const desired=new Set(state.folderFiles.map(x=>x.path));
  if(state.current?.logo_path){ desired.add(state.current.logo_path); if(state.current.logo_path==='quartz-logo.webp') desired.add('quartz-logo-192.webp'); }
  try{
    const existing=(await api(`/api/sites/${site.id}/assets`)).assets||[];
    for(const asset of existing){
      if(!desired.has(asset.path)) await deleteAsset(site.id,asset.path);
    }
  }catch(e){ console.warn('Asset cleanup skipped',e); }

  $('#folderStatus').textContent=`Uploading 0/${state.folderFiles.length} assets…`;
  for(const item of state.folderFiles){
    await uploadAsset(site.id,item.path,item.file);
    done++;
    els.busyText.textContent=`Uploading website files ${done}/${state.folderFiles.length}…`;
    $('#folderStatus').textContent=`Uploading ${done}/${state.folderFiles.length} assets…`;
  }
  $('#folderStatus').textContent=`${done} assets synced · SEO, PWA and sitemap updated automatically`;
  state.folderFiles=[];
}

async function uploadAsset(id,path,file){
  const res=await fetch(`/api/sites/${id}/assets?path=${encodeURIComponent(path)}`,{method:'PUT',credentials:'same-origin',headers:{'content-type':file.type||mimeFromName(file.name)},body:file});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||`Asset upload failed: ${path}`);
  return data;
}
async function deleteAsset(id,path){
  const res=await fetch(`/api/sites/${id}/assets?path=${encodeURIComponent(path)}`,{method:'DELETE',credentials:'same-origin'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||`Asset delete failed: ${path}`);
  return data;
}

function renderLogo(path){
  const box=$('#logoPreview');
  if(!path||!state.current?.slug){box.textContent='No logo';return;}
  box.innerHTML=`<img src="https://quartzwebsolutions.com/${encodeURIComponent(state.current.slug)}/${path.split('/').map(encodeURIComponent).join('/')}?v=${Date.now()}" alt="Logo">`;
}
function updateLiveLink(){
  const a=$('#openLiveBtn');
  if(state.current?.slug&&state.current.status==='published'){
    a.href=`https://quartzwebsolutions.com/${state.current.slug}/`;
    a.classList.remove('hidden');
  } else a.classList.add('hidden');
}
function updatePreviewUrl(){
  const slug=slugify($('#siteSlug').value||$('#siteName').value);
  const a=$('#previewUrl');
  if(slug){a.textContent=`/${slug}/`;a.href=`https://quartzwebsolutions.com/${slug}/`;}
  else{a.textContent='—';a.removeAttribute('href');}
}
function updateSeoScore(){
  const vals={
    name:$('#siteName').value.trim(),slug:slugify($('#siteSlug').value||$('#siteName').value),primary:$('#primaryKeyword').value.trim(),keywords:$('#keywords').value.trim(),
    title:$('#seoTitle').value.trim(),description:$('#seoDescription').value.trim(),category:$('#category').value.trim(),type:$('#businessType').value,city:$('#city').value.trim(),
    address:$('#address').value.trim(),phone:$('#phone').value.trim(),hours:$('#openingHours').value.trim(),map:$('#mapsUrl').value.trim(),business:$('#businessDescription').value.trim(),
    html:$('#indexHtml').value.trim(),logo:!!(state.logoFile || state.current?.logo_path)
  };
  const checks=[
    ['Business name',!!vals.name],['URL slug',!!vals.slug],['Primary keyword',!!vals.primary],['Secondary keywords',!!vals.keywords],['SEO title',!!vals.title],['Meta description',!!vals.description],
    ['Category + schema type',!!vals.category&&!!vals.type],['City / location',!!vals.city],['Address / phone',!!vals.address&&!!vals.phone],['Opening hours / map',!!vals.hours&&!!vals.map],
    ['Business description',vals.business.length>60],['Logo / PWA icon',vals.logo],['index.html',vals.html.length>80]
  ];
  const score=Math.round(checks.filter(x=>x[1]).length/checks.length*100);
  $('#seoScore').textContent=score;
  $('#seoChecks').innerHTML=checks.map(([n,ok])=>`<span class="seo-check ${ok?'ok':''}">${ok?'✓':'○'} ${n}</span>`).join('');
  updatePreviewUrl();
}

['siteName','siteSlug','category','businessType','services','city','district','state','address','postalCode','phone','whatsapp','email','openingHours','mapsUrl','instagramUrl','facebookUrl','youtubeUrl','businessDescription','primaryKeyword','keywords','seoTitle','seoDescription','indexHtml'].forEach(id=>{
  $('#'+id).addEventListener('input',()=>{
    updateSeoScore();
    if(id==='siteName'&&!$('#siteSlug').dataset.touched){
      $('#siteSlug').value=slugify($('#siteName').value);
      updatePreviewUrl();
    }
  });
});
$('#siteSlug').addEventListener('input',()=>$('#siteSlug').dataset.touched='1');

function slugify(v){return String(v||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)}
function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
function mimeFromName(name){const e=(name.split('.').pop()||'').toLowerCase();return({css:'text/css',js:'application/javascript',html:'text/html',htm:'text/html',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',json:'application/json',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',ico:'image/x-icon'})[e]||'application/octet-stream'}
boot();
