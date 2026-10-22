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
  page();
  text('CLIENT DIRECTORY',L,y+5,17,2,[.10,.12,.15]);y+=25;
  const prepared=date(new Date().toISOString());
  text(`${records.length} CLIENT${records.length===1?'':'S'}   |   PREPARED ${prepared.toUpperCase()}`,L,y,8,2,[.44,.48,.54]);
  y+=19;line(L,y,R,y,[.84,.87,.9]);y+=18;
  const rowW=R-L;
  records.forEach((c,index)=>{
   const rowH=77;fit(rowH+5);
   const top=y;
   if(index%2===0)rect(L,top-5,rowW,rowH,[.973,.977,.983]);
   const bx=L+37;
   text(String(index+1).padStart(2,'0')+'.',L+10,top+13,9,2,[.78,.15,.22]);
   const name=latin(c.business_name||'Client').slice(0,52);
   text(name,bx,top+13,10.8,2,[.13,.16,.2]);
   const website=c.website_url||'';
   if(website)addLink(bx,top+1,Math.min(name.length*6,R-bx-70),16,website);
   text('#'+String(c.id).padStart(5,'0'),R-54,top+13,8.5,2,[.30,.35,.42]);
   const who=latin(c.contact_name||'Contact not provided').slice(0,45);
   const status=latin(String(c.status||'active').replace(/_/g,' ')).toUpperCase();
   text(who,bx,top+28,8.2,1,[.38,.42,.48]);
   text(status,R-101,top+28,7.3,2,[.47,.49,.55]);
   if(website){
     const urltext=latin(website).slice(0,91);
     text(urltext,bx,top+44,8,1,[.07,.34,.62]);
     addLink(bx,top+34,Math.min((urltext.length+1)*4.2,R-bx),14,website);
   }
   const contactY=top+60;
   if(c.email){const email=latin(c.email).slice(0,52);text(email,bx,contactY,7.3,1,[.09,.36,.62]);addLink(bx,contactY-9,Math.min(email.length*3.9,285),12,'mailto:'+c.email)}
   if(c.phone){const ph=latin(c.phone).slice(0,28);text(ph,R-124,contactY,7.5,1,[.09,.36,.62]);addLink(R-124,contactY-9,112,12,'tel:'+c.phone)}
   y+=rowH;
   line(L,y-1,R,y-1,[.90,.91,.93]);
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
 function miniNotes(value){
  const list=String(value||'').split(/[,\n]+/).map(v=>v.trim()).filter(Boolean);
  if(!list.length)return;
  for(let i=0;i<list.length;i++){
    const lines=wrap(list[i],72);fit(lines.length*11+4);
    text((i+1)+'.',L+118,y,8.1,2,[.79,.13,.2]);
    for(const [j,l] of lines.entries())text(l,L+137,y+j*11,8.6,1,[.15,.17,.2]);
    y+=lines.length*11+4;
  }
  y+=3;
 }
 function miniPayment(p){
  const note=(p.voided_at?'VOIDED - ':'')+(p.note||'Payment');
  const lines=wrap(note,42);
  const rowH=Math.max(27,10+lines.length*12);
  fit(rowH);
  const top=y;
  text(date(p.paid_at),L+5,top+10,7.8,1,[.39,.43,.48]);
  for(let i=0;i<lines.length;i++)text(lines[i],L+160,top+10+i*11,8.2,1,[.13,.16,.20]);
  text((p.amount_paise>=0?'+':'')+INR(p.amount_paise),R-109,top+10,8.7,2,p.voided_at?[.58,.59,.60]:p.amount_paise<0?[.73,.15,.20]:[.12,.44,.30]);
  y+=rowH;line(L,y,R,y,[.88,.9,.92]);
 }
 function sign(){
  // Small original signature and seal share one reserved block on the same page.
  const sigW=98;
  const sigH=sigW*(assets.signature.height/assets.signature.width);
  const sealW=68;
  const sealH=sealW*(assets.seal.height/assets.seal.width);
  const blockH=Math.max(sigH,sealH)+44;
  fit(blockH+15);
  y+=11;line(L,y,R,y,[.81,.83,.87]);y+=13;
  const top=y;
  image('ImSignature',L+3,top+3,sigW,sigH);
  addLink(L+3,top+3,sigW,sigH,FOUNDER_URL);
  image('ImSeal',R-sealW-5,top+11,sealW,sealH);
  addLink(R-sealW-5,top+11,sealW,sealH,QUARTZ_URL);
  y=top+Math.max(sigH,sealH)+8;
  text('Sabith Salah K P',L+3,y,9,2,[.13,.14,.16]);
  addLink(L+3,y-10,94,13,FOUNDER_URL);y+=13;
  text('Founder | Quartz Web Solutions',L+3,y,7.5,1,[.42,.44,.48]);
  addLink(L+3,y-9,144,12,QUARTZ_URL);y+=10;
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
  if(c.notes){miniTitle('Project notes');miniNotes(c.notes);}
  miniTitle('Financial summary');
  fit(44);
  rect(L,y-4,R-L,35,[.971,.979,.982]);
  text('NET RECEIVED',L+10,y+9,7.5,2,[.40,.46,.52]);
  text(INR(c.balance_paise),L+134,y+10,11,2,[.12,.36,.29]);
  text(`${c.payments?.length||0} ENTRIES`,R-81,y+9,7.2,2,[.45,.49,.54]);
  y+=39;
  miniTitle('Payment history');
  fit(20);
  text('DATE & TIME',L+5,y+4,7,2,[.48,.52,.57]);
  text('DESCRIPTION',L+160,y+4,7,2,[.48,.52,.57]);
  text('AMOUNT',R-109,y+4,7,2,[.48,.52,.57]);
  y+=12;line(L,y,R,y,[.80,.83,.88]);
  if(!c.payments?.length){fit(22);text('No payments recorded.',L+5,y+16,8.3);y+=28}
  else for(const p of c.payments)miniPayment(p);
  if(c.access?.length){miniTitle('Website access');for(const a of c.access){miniField(a.label+' ID',a.login_id);if(!a.id_only)miniField('Password',a.password)}}
  miniTitle('Record information');
  fit(26);
  const detailsY=y;
  text('CREATED',L,detailsY,7.1,2,[.49,.52,.56]);
  text(date(c.created_at),L+66,detailsY,7.9,1,[.18,.20,.23]);
  text('UPDATED',L+275,detailsY,7.1,2,[.49,.52,.56]);
  text(date(c.updated_at),L+338,detailsY,7.9,1,[.18,.20,.23]);
  y+=20;
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
