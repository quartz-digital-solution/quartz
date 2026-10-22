/* Tiny self-contained PDF document composer. No CDN, no fonts or private API dependency. */
(function(){
'use strict';
const W=595.28,H=841.89,L=43,R=552;
const E=new TextEncoder();
const QUARTZ_URL='https://quartzwebsolutions.com/';
const FOUNDER_URL='https://quartzwebsolutions.com/sabith-salah-kp/';
const INR=v=>'Rs. '+(Number(v||0)/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=v=>{if(!v)return '-';try{return new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'})}catch{return String(v)}};
function latin(text){return String(text??'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\u20B9/g,'Rs.').replace(/[^\x20-\x7E\xA0-\xFF\n]/g,'?')}
function quote(t){return latin(t).replace(/[\\()]/g,'\\$&').replace(/\n/g,' ')}
const fmt=n=>Number(n).toFixed(2);
function create(assets,records,mode){
 let pages=[],ops=[],annots=[],y=120;
 function raw(s){ops.push(s)}
 function fill(rgb){raw(rgb.map(n=>fmt(n)).join(' ')+' rg\n')}
 function stroke(rgb){raw(rgb.map(n=>fmt(n)).join(' ')+' RG\n')}
 function rect(x,top,w,h,c){fill(c);raw(`${fmt(x)} ${fmt(H-top-h)} ${fmt(w)} ${fmt(h)} re f\n`)}
 function line(x1,t1,x2,t2,c=[.86,.88,.9]){stroke(c);raw(`0.6 w ${fmt(x1)} ${fmt(H-t1)} m ${fmt(x2)} ${fmt(H-t2)} l S\n`)}
 function text(s,x,top,size=10,font=1,color=[.15,.17,.21]){fill(color);raw(`BT /F${font} ${fmt(size)} Tf 1 0 0 1 ${fmt(x)} ${fmt(H-top)} Tm (${quote(s)}) Tj ET\n`)}
 function image(name,x,top,w,h){raw(`q ${fmt(w)} 0 0 ${fmt(h)} ${fmt(x)} ${fmt(H-top-h)} cm /${name} Do Q\n`)}
 function addLink(x,top,w,h,url){annots.push({x1:x,y1:H-(top+h),x2:x+w,y2:H-top,url})}
 function pushPage(){pages.push({content:ops.join(''),annots:[...annots]});ops=[];annots=[]}
 function header(){
  rect(0,0,W,92,[.055,.065,.08]);rect(0,92,W,3,[.99,.14,.23]);
  // Align logo to the vertical centre of the two-line brand lockup.
  image('ImLogo',L,22,40,40);addLink(L,22,40,40,QUARTZ_URL);
  text('QUARTZ WEB SOLUTIONS',95,44,16,2,[1,1,1]);
  addLink(95,27,215,20,QUARTZ_URL);
  text('CLIENT RECORDS  /  CONFIDENTIAL DOCUMENT',95,58,8,1,[.76,.78,.81]);
  y=118;
 }
 function page(){if(ops.length)pushPage();header()}
 function fit(n=24){if(y+n>749)page()}
 function heading(t){fit(41);text(t.toUpperCase(),L,y+3,10,2,[.88,.12,.2]);y+=17;line(L,y,R,y);y+=16}
 function wrap(t,max=110){let lines=[];for(const para of latin(t||'-').split('\n')){let s='';for(const w of para.split(/\s+/)){if((s+' '+w).trim().length>max&&s){lines.push(s);s=w}else s=(s+' '+w).trim()}lines.push(s||' ')}return lines}
 function field(k,v,href){const lines=wrap(String(v||'-'),91);fit(21+lines.length*13);text(k.toUpperCase(),L,y,8,2,[.48,.52,.57]);y+=15;for(const l of lines){fit(15);text(l,L,y,10,1,href?[.07,.34,.62]:[.13,.16,.2]);if(href)addLink(L,y-12,Math.min(R-L,Math.max(45,l.length*5.7)),15,href);y+=14}y+=6}
 function payment(p){const lines=wrap((p.voided_at?'[VOIDED - excluded from total] ':'')+(p.note||'Payment entry'),72);fit(38+lines.length*11);text(date(p.paid_at),L,y,8,1,[.46,.49,.54]);text((p.amount_paise>=0?'+':'')+INR(p.amount_paise),380,y,10,2,p.amount_paise<0?[.8,.12,.2]:[.10,.46,.31]);y+=15;for(const l of lines){text(l,L+8,y,9,1);y+=12}text(p.manual_date?'Date entered by admin':'Date based on added time',L+8,y,8,3,[.52,.55,.59]);y+=20;line(L,y,R,y);y+=13}
 function directory(){
  page();text('CLIENT DIRECTORY',L,y+7,18,2,[.10,.12,.15]);y+=29;
  text('Summary register | '+records.length+' clients | payment history excluded',L,y,8,1,[.42,.46,.50]);y+=24;
  line(L,y,R,y);y+=14;
  records.forEach((c,index)=>{
   const rowH=66;
   fit(rowH);
   const top=y;
   text((index+1)+'.',L,top+3,11,2,[.87,.12,.2]);
   const bx=L+24;
   const name=latin(c.business_name||'Client').slice(0,53);
   text(name,bx,top+3,10,2,[.12,.16,.20]);
   if(c.website_url)addLink(bx,top-8,Math.min(name.length*5.8,R-bx-60),15,c.website_url);
   text('#'+String(c.id).padStart(5,'0'),R-49,top+3,8,2,[.40,.46,.52]);
   const who=[c.contact_name||'',(c.status||'').replace(/_/g,' ')].filter(Boolean).join('  |  ');
   text(who.slice(0,85),bx,top+18,8,1,[.43,.47,.51]);
   if(c.website_url){
     text(('Web: '+c.website_url).slice(0,92),bx,top+31,8,1,[.07,.34,.62]);
     addLink(bx,top+23,Math.min(R-bx,490),13,c.website_url);
   }
   const contact=[c.email?'Email: '+c.email:'',c.phone?'Phone: '+c.phone:''].filter(Boolean).join('    |    ');
   text(contact.slice(0,105),bx,top+44,7.4,1,[.42,.46,.50]);
   if(c.email){const label='Email: '+c.email;addLink(bx,top+35,Math.min(label.length*3.9,R-bx),12,'mailto:'+c.email)}
   if(c.phone){const sx=bx+(c.email?('Email: '+c.email+'    |    ').length*3.9:0);if(sx<R)addLink(sx,top+35,Math.min(120,R-sx),12,'tel:'+c.phone)}
   y+=rowH;line(L,y-7,R,y-7);
  });
 }
 // Compact one-column records keep normal client profiles, signature, and seal together on one page.
 function miniTitle(s){fit(27);y+=7;text(s.toUpperCase(),L,y,8,2,[.79,.12,.19]);y+=9;line(L,y,R,y);y+=11}
 function miniField(label,value,href){
   const at=L+118,lines=wrap(String(value??'').trim()||'-',76);fit(Math.max(18,lines.length*11+5));
   text(label.toUpperCase(),L,y,7.1,2,[.49,.52,.56]);
   for(let i=0;i<lines.length;i++){
     text(lines[i],at,y+i*11,8.8,1,href?[.06,.35,.62]:[.13,.16,.2]);
     if(href)addLink(at,y+i*11-9,Math.min(R-at,Math.max(30,lines[i].length*4.5)),12,href);
   }
   y+=Math.max(17,lines.length*11+3);
 }
 function miniPayment(p){
   const note=(p.voided_at?'VOIDED | ':'')+(p.note||'Payment');
   const lines=wrap(note,40);
   fit(Math.max(21,lines.length*11+6));
   text(date(p.paid_at),L,y,7.3,1,[.44,.47,.51]);
   for(let i=0;i<lines.length;i++)text(lines[i],L+153,y+i*11,8.2,1,[.17,.20,.24]);
   text((p.amount_paise>=0?'+':'')+INR(p.amount_paise),R-93,y,8.6,2,p.voided_at?[.58,.59,.60]:p.amount_paise<0?[.73,.15,.20]:[.12,.44,.30]);
   y+=Math.max(21,lines.length*11+5);
   line(L,y-5,R,y-5,[.90,.91,.92]);
 }
 function sign(){
  // Reserve a complete block so the signature, founder's name, and seal never split.
  const sigW=141;
  const sigH=sigW*(assets.signature.height/assets.signature.width);
  const sealW=82;
  const sealH=sealW*(assets.seal.height/assets.seal.width);
  const blockH=Math.max(sigH,sealH)+42;
  fit(blockH+16);
  y+=8;line(L,y,R,y,[.74,.77,.81]);y+=11;
  const top=y;
  image('ImSignature',L,top,sigW,sigH);
  addLink(L,top,sigW,sigH,FOUNDER_URL);
  image('ImSeal',R-sealW,top,sealW,sealH);
  addLink(R-sealW,top,sealW,sealH,QUARTZ_URL);
  y=top+Math.max(sigH,sealH)+12;
  text('Sabith Salah K P',L,y,9,2,[.13,.14,.16]);
  addLink(L,y-10,94,13,FOUNDER_URL);y+=14;
  text('Founder | Quartz Web Solutions',L,y,7.6,1,[.42,.44,.48]);
  addLink(L,y-9,144,12,QUARTZ_URL);y+=10;
 }
 function cover(count,sum){heading('Organization overview');field('Organization','Quartz Web Solutions');field('Clients recorded',String(count));field('Combined net payments',INR(sum));field('Prepared',date(new Date().toISOString()));field('Details','Individual client documents and payment history follow.');}
 function client(c){
  page();
  text('CLIENT #'+String(c.id).padStart(5,'0'),L,y,8,2,[.64,.68,.71]);y+=20;
  text(latin(c.business_name||'Client').slice(0,64),L,y,16,2,[.11,.13,.16]);y+=20;
  miniTitle('Business and contact');
  miniField('Business',c.business_name,c.website_url);
  miniField('Contact',c.contact_name);
  miniField('Website',c.website_url,c.website_url);
  miniField('Status',String(c.status||'').replace(/_/g,' ').toUpperCase());
  miniField('Email',c.email,c.email?'mailto:'+c.email:null);
  miniField('Phone',c.phone,c.phone?'tel:'+c.phone:null);
  if(c.whatsapp)miniField('WhatsApp',c.whatsapp,'https://wa.me/'+String(c.whatsapp).replace(/[^0-9]/g,''));
  if(c.description)miniField('Project / services',c.description);
  if(c.notes)miniField('Notes',c.notes);
  miniTitle('Financial summary');
  miniField('Net received',INR(c.balance_paise)+'  |  '+(c.payments?.length||0)+' payment entries');
  miniTitle('Payment history');
  if(!c.payments?.length){fit(18);text('No payments recorded.',L,y,8.6);y+=16}
  else for(const p of c.payments)miniPayment(p);
  if(c.access?.length){miniTitle('Website access');for(const a of c.access){miniField(a.label+' ID',a.login_id);if(!a.id_only)miniField('Password',a.password)}}
  miniTitle('Record information');
  miniField('Created / updated',date(c.created_at)+'  |  '+date(c.updated_at));
  sign();
 }
 if(mode==='directory'){directory()}
 else {
  if(records.length>1){page();cover(records.length,records.reduce((n,c)=>n+(+c.balance_paise||0),0))}else if(!records.length)page();
  for(const r of records)client(r);
  if(!records.length){heading('No client records');field('Export','No clients have been registered yet.')}
 }
 pushPage();
 for(let i=0;i<pages.length;i++){
    const number=`Page ${i+1} of ${pages.length}`;
    pages[i].content+=`0.65 0.67 0.70 rg\nBT /F1 8 Tf 1 0 0 1 ${fmt(L)} 36 Tm (quartzwebsolutions.com | Generated ${quote(new Date().toLocaleDateString('en-IN'))}) Tj ET\nBT /F1 8 Tf 1 0 0 1 493 36 Tm (${quote(number)}) Tj ET\n`;
    pages[i].annots.push({x1:L,y1:28,x2:205,y2:42,url:QUARTZ_URL});
 }
 return pdfBuild(pages,assets);
}
function pdfBuild(pageObjs,assets){
 const objs=[null];const add=v=>{objs.push(v);return objs.length-1};
 const cat=add(''),pagesRef=add(''),f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),f3=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
 function imageObj(asset){return add([`<< /Type /XObject /Subtype /Image /Width ${asset.width} /Height ${asset.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${asset.bytes.length} >>\nstream\n`,asset.bytes,'\nendstream'])}
 const logoRef=imageObj(assets.logo),sealRef=imageObj(assets.seal),sigRef=imageObj(assets.signature);
 const pageIds=[];
 for(const page of pageObjs){
   const annotRefs=[];
   for(const a of page.annots){
     annotRefs.push(add(`<< /Type /Annot /Subtype /Link /Rect [${fmt(a.x1)} ${fmt(a.y1)} ${fmt(a.x2)} ${fmt(a.y2)}] /Border [0 0 0] /A << /S /URI /URI (${quote(a.url)}) >> >>`));
   }
   const bs=E.encode(page.content);
   const stream=add([`<< /Length ${bs.length} >>\nstream\n`,bs,'\nendstream']);
   const annotsPart=annotRefs.length?` /Annots [${annotRefs.map(p=>p+' 0 R').join(' ')}]`:'';
   const p=add(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> /XObject << /ImLogo ${logoRef} 0 R /ImSeal ${sealRef} 0 R /ImSignature ${sigRef} 0 R >> >> /Contents ${stream} 0 R${annotsPart} >>`);
   pageIds.push(p)
 }
 objs[cat]=`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;
 objs[pagesRef]=`<< /Type /Pages /Kids [${pageIds.map(p=>p+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
 const out=[],offsets=[0];let length=0;function put(x){let b=x instanceof Uint8Array?x:E.encode(x);out.push(b);length+=b.length}
 put('%PDF-1.4\n%Quartz PDF\n');
 for(let i=1;i<objs.length;i++){offsets[i]=length;put(`${i} 0 obj\n`);const obj=objs[i];if(Array.isArray(obj))obj.forEach(put);else put(obj);put('\nendobj\n')}
 const xref=length;put(`xref\n0 ${objs.length}\n0000000000 65535 f \n`);for(let i=1;i<objs.length;i++)put(String(offsets[i]).padStart(10,'0')+' 00000 n \n');put(`trailer\n<< /Size ${objs.length} /Root ${cat} 0 R >>\nstartxref\n${xref}\n%%EOF`);
 return new Blob(out,{type:'application/pdf'});
}
function base64ToBytes(base64){const bin=atob(base64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return arr}
async function loadJpegAsset(url,bg='#ffffff',quality=.95){
 const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Could not load '+url));i.src=url});
 const c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;
 const ctx=c.getContext('2d',{alpha:false});ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0);
 const dataUrl=c.toDataURL('image/jpeg',quality);return {bytes:base64ToBytes(dataUrl.split(',')[1]),width:c.width,height:c.height}
}
async function getAssets(){
 const [logo,seal,signature]=await Promise.all([
   loadJpegAsset('/asset/img/logo/quartz-web-solutions-logo-transparent.png','#0e1115',0.96),
   loadJpegAsset('/asset/img/pdf/quartz-seal.png','#ffffff',0.96),
   loadJpegAsset('/asset/img/pdf/sabith-signature.png','#ffffff',0.97)
 ]);
 return {logo,seal,signature};
}
window.QuartzPdf={async download(records,filename='quartz-client-records.pdf',opts={}){
 const assets=await getAssets();const pdf=create(assets,records,opts.mode==='directory'?'directory':'client');
 const href=URL.createObjectURL(pdf),a=document.createElement('a');a.href=href;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),30000);return pdf;
}};
})();
