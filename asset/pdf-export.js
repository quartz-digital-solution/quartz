/* Tiny self-contained PDF document composer. No CDN, no fonts or private API dependency. */
(function(){
'use strict';
const W=595.28,H=841.89,L=43,R=552;
const E=new TextEncoder();
const INR=v=>'Rs. '+(Number(v||0)/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=v=>{if(!v)return '-';try{return new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'})}catch{return String(v)}};
function latin(text){return String(text??'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\u20B9/g,'Rs.').replace(/[^\x20-\x7E\xA0-\xFF\n]/g,'?')}
function quote(t){return latin(t).replace(/[\\()]/g,'\\$&').replace(/\n/g,' ')}
const fmt=n=>Number(n).toFixed(2);
function create(images,records){
 let pages=[],ops=[],y=120;
 function raw(s){ops.push(s)}
 function fill(rgb){raw(rgb.map(n=>fmt(n)).join(' ')+' rg\n')}
 function stroke(rgb){raw(rgb.map(n=>fmt(n)).join(' ')+' RG\n')}
 function rect(x,top,w,h,c){fill(c);raw(`${fmt(x)} ${fmt(H-top-h)} ${fmt(w)} ${fmt(h)} re f\n`)}
 function line(x1,t1,x2,t2,c=[.86,.88,.9]){stroke(c);raw(`0.6 w ${fmt(x1)} ${fmt(H-t1)} m ${fmt(x2)} ${fmt(H-t2)} l S\n`)}
 function text(s,x,top,size=10,font=1,color=[.15,.17,.21]){fill(color);raw(`BT /F${font} ${fmt(size)} Tf 1 0 0 1 ${fmt(x)} ${fmt(H-top)} Tm (${quote(s)}) Tj ET\n`)}
 function header(){rect(0,0,W,92,[.055,.065,.08]);rect(0,92,W,3,[.99,.14,.23]);raw(`q 40 0 0 40 ${fmt(L)} ${fmt(H-67)} cm /Im1 Do Q\n`);text('QUARTZ WEB SOLUTIONS',95,37,16,2,[1,1,1]);text('CLIENT RECORDS  /  CONFIDENTIAL DOCUMENT',95,54,8,1,[.76,.78,.81]);y=118}
 function page(){if(ops.length)pages.push(ops.join(''));ops=[];header()}
 function fit(n=24){if(y+n>749)page()}
 function heading(t){fit(41);text(t.toUpperCase(),L,y+3,10,2,[.88,.12,.2]);y+=17;line(L,y,R,y);y+=16}
 function wrap(t,max=110){let lines=[];for(const para of latin(t||'-').split('\n')){let s='';for(const w of para.split(/\s+/)){if((s+' '+w).trim().length>max&&s){lines.push(s);s=w}else s=(s+' '+w).trim()}lines.push(s||' ')}return lines}
 function field(k,v){const lines=wrap(String(v||'-'),91);fit(21+lines.length*13);text(k.toUpperCase(),L,y,8,2,[.48,.52,.57]);y+=15;for(const l of lines){fit(15);text(l,L,y,10,1,[.13,.16,.2]);y+=14}y+=6}
 function payment(p){const lines=wrap((p.voided_at?'[VOIDED - excluded from total] ':'')+(p.note||'Payment entry'),72);fit(38+lines.length*11);text(date(p.paid_at),L,y,8,1,[.46,.49,.54]);text((p.amount_paise>=0?'+':'')+INR(p.amount_paise),380,y,10,2,p.amount_paise<0?[.8,.12,.2]:[.10,.46,.31]);y+=15;for(const l of lines){text(l,L+8,y,9,1);y+=12}text(p.manual_date?'Date entered by admin':'Date based on added time',L+8,y,8,3,[.52,.55,.59]);y+=20;line(L,y,R,y);y+=13}
 function sign(){fit(135);y+=10;line(L,y,R,y,[.74,.77,.81]);y+=24;text('VERIFIED RECORD',L,y,9,2,[.78,.13,.21]);y+=25;text('Sabith Salah K P',L,y,18,3,[.13,.14,.16]);y+=16;text('Founder | Quartz Web Solutions',L,y,9,1,[.42,.44,.48]);y+=15;text('Typed authorization; not a cryptographic digital signature.',L,y,7,1,[.57,.59,.62]);
  // Circular illustrative Quartz document seal, distinct from any physical company stamp.
  const cx=480,cy=H-(y-46);stroke([.84,.15,.23]);raw(`1.3 w ${fmt(cx+37)} ${fmt(cy)} m ${fmt(cx+37)} ${fmt(cy+20.43)} ${fmt(cx+20.43)} ${fmt(cy+37)} ${fmt(cx)} ${fmt(cy+37)} c ${fmt(cx-20.43)} ${fmt(cy+37)} ${fmt(cx-37)} ${fmt(cy+20.43)} ${fmt(cx-37)} ${fmt(cy)} c ${fmt(cx-37)} ${fmt(cy-20.43)} ${fmt(cx-20.43)} ${fmt(cy-37)} ${fmt(cx)} ${fmt(cy-37)} c ${fmt(cx+20.43)} ${fmt(cy-37)} ${fmt(cx+37)} ${fmt(cy-20.43)} ${fmt(cx+37)} ${fmt(cy)} c S\n`);
  text('QUARTZ',453,y-52,10,2,[.84,.15,.23]);text('RECORD',454,y-39,8,2,[.84,.15,.23]);text('VERIFIED',454,y-27,8,2,[.84,.15,.23]);y+=20;
 }
 function cover(count,sum){heading('Organization overview');field('Organization','Quartz Web Solutions');field('Clients recorded',String(count));field('Combined net payments',INR(sum));field('Prepared',date(new Date().toISOString()));field('Details','Individual client documents and payment history follow. This document reports recorded information, not independently verified bank settlement.');}
 function client(c){page();text('CLIENT #'+c.id,L,y,8,2,[.64,.68,.71]);y+=23;text(latin(c.business_name).slice(0,65),L,y,18,2,[.11,.13,.16]);y+=28;heading('Business and contact');field('Business',c.business_name);field('Contact person',c.contact_name||'-');field('Website',c.website_url||'-');field('Project status',String(c.status||'').replace(/_/g,' ').toUpperCase());field('Email',c.email);field('Phone',c.phone);field('WhatsApp',c.whatsapp);field('Work description',c.description);field('Notes',c.notes);heading('Financial summary');field('Net received (signed ledger)',INR(c.balance_paise));field('Payment entries',String(c.payments?.length||0));heading('Payment history');if(!c.payments?.length){fit(20);text('No payments recorded.',L,y,10);y+=25}else for(const p of c.payments)payment(p);heading('Record verification');field('Client created',date(c.created_at));field('Last updated',date(c.updated_at));sign();}
 if(records.length>1){page();cover(records.length,records.reduce((n,c)=>n+(+c.balance_paise||0),0))}else if(!records.length)page();
 for(const r of records)client(r);
 if(!records.length){heading('No client records');field('Export','No clients have been registered yet.')}
 pages.push(ops.join(''));
 for(let i=0;i<pages.length;i++){
    const number=`Page ${i+1} of ${pages.length}`;
    pages[i]+=`0.65 0.67 0.70 rg\nBT /F1 8 Tf 1 0 0 1 ${fmt(L)} 36 Tm (quartzwebsolutions.com | Generated ${quote(new Date().toLocaleDateString('en-IN'))}) Tj ET\nBT /F1 8 Tf 1 0 0 1 493 36 Tm (${quote(number)}) Tj ET\n`;
 }
 return pdfBuild(pages,images);
}
function pdfBuild(pageStreams,jpg){
 const objs=[null];const add=v=>{objs.push(v);return objs.length-1};
 const cat=add(''),pagesRef=add(''),f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),f3=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
 const imageRef=add([`<< /Type /XObject /Subtype /Image /Width 156 /Height 156 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,jpg,'\nendstream']);
 const pageIds=[];
 for(const content of pageStreams){const bs=E.encode(content);const stream=add([`<< /Length ${bs.length} >>\nstream\n`,bs,'\nendstream']);const p=add(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> /XObject << /Im1 ${imageRef} 0 R >> >> /Contents ${stream} 0 R >>`);pageIds.push(p)}
 objs[cat]=`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;
 objs[pagesRef]=`<< /Type /Pages /Kids [${pageIds.map(p=>p+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
 const out=[],offsets=[0];let length=0;function put(x){let b=x instanceof Uint8Array?x:E.encode(x);out.push(b);length+=b.length}
 put('%PDF-1.4\n%Quartz PDF\n');
 for(let i=1;i<objs.length;i++){offsets[i]=length;put(`${i} 0 obj\n`);const obj=objs[i];if(Array.isArray(obj))obj.forEach(put);else put(obj);put('\nendobj\n')}
 const xref=length;put(`xref\n0 ${objs.length}\n0000000000 65535 f \n`);for(let i=1;i<objs.length;i++)put(String(offsets[i]).padStart(10,'0')+' 00000 n \n');put(`trailer\n<< /Size ${objs.length} /Root ${cat} 0 R >>\nstartxref\n${xref}\n%%EOF`);
 return new Blob(out,{type:'application/pdf'});
}
async function getLogo(){const r=await fetch('/asset/img/logo/quartz-report.jpg',{cache:'force-cache'});if(!r.ok)throw Error('Quartz logo could not be loaded for PDF');return new Uint8Array(await r.arrayBuffer())}
window.QuartzPdf={async download(records,filename='quartz-client-records.pdf'){
 const jpg=await getLogo();const pdf=create(jpg,records);
 const href=URL.createObjectURL(pdf),a=document.createElement('a');a.href=href;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),30000);return pdf;
}};
})();
