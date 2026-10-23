/* Quartz employee identification design system: entirely client-side, no third-party PDF service. */
(function(){'use strict';
const LOGO='/asset/img/logo/quartz-web-solutions-logo-transparent.png';
const COLORS={ink:'#101824',muted:'#627081',rose:'#e82e4b',light:'#f7f8fa',line:'#dce1e7',white:'#ffffff'};
const empCode=e=>String(e.id).padStart(5,'0');
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];}
function text(ctx,str,x,y,font,color='#101824',align='left'){ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(String(str||''),x,y);ctx.textAlign='left';}
function fit(ctx,str,max,width=600){str=String(str||'');let n=max;while(n>18){ctx.font=`800 ${n}px Arial, sans-serif`;if(ctx.measureText(str).width<=width)break;n-=2;}return `800 ${n}px Arial, sans-serif`}
function round(ctx,x,y,w,h,r,color){r=Math.max(0,Math.min(r,w/2,h/2));ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function stroke(ctx,x,y,w,h,r,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.stroke()}
function line(ctx,x,y,x2,y2,color='#dce1e7',width=2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
async function loadImage(src){if(!src)return null;return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;});}
async function images(e,photoURL){return {logo:await loadImage(LOGO),photo:await loadImage(photoURL)};}
function logo(ctx,img,x,y,size){if(img)ctx.drawImage(img,x,y,size,size);else{text(ctx,'Q',x,y+size*.84,`900 ${size}px Arial`,COLORS.rose)}}
function photo(ctx,img,x,y,size){ctx.save();ctx.beginPath();ctx.arc(x+size/2,y+size/2,size/2,0,Math.PI*2);ctx.clip();if(img){const sc=Math.max(size/img.width,size/img.height),iw=img.width*sc,ih=img.height*sc;ctx.drawImage(img,x+(size-iw)/2,y+(size-ih)/2,iw,ih)}else{ctx.fillStyle='#293543';ctx.fillRect(x,y,size,size);text(ctx,'Q',x+size/2,y+size*.73,`900 ${size*.68}px Arial`,'#f6bac4','center')}ctx.restore();ctx.beginPath();ctx.arc(x+size/2,y+size/2,size/2,0,Math.PI*2);ctx.strokeStyle='#e82e4b';ctx.lineWidth=Math.max(3,size*.018);ctx.stroke()}
function paragraph(ctx,str,x,y,maxwidth,fontsize=25,dy=37,color=COLORS.muted){
 ctx.font=`${fontsize}px Arial`;let current='';
 function output(){if(current){text(ctx,current,x,y,`${fontsize}px Arial`,color);y+=dy;current=''}}
 for(let word of String(str||'').split(/\s+/)){
  if(!word)continue;
  const candidate=(current+' '+word).trim();
  if(ctx.measureText(candidate).width<=maxwidth){current=candidate;continue}
  output();
  // Long verification URLs may not contain spaces. Wrap by character at the card boundary.
  for(const char of word){if(ctx.measureText(current+char).width>maxwidth)output();current+=char}
 }
 output();return y;
}
function fmtDate(raw){if(!raw)return 'Not recorded';const d=new Date(raw);return isNaN(+d)?String(raw):d.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});}
function caps(v){return (v||'').replace(/_/g,' ').replace(/\b[a-z]/g,c=>c.toUpperCase());}
function status(e){return e.status==='active'?'ACTIVE TEAM MEMBER':e.status==='on_leave'?'ON LEAVE':'INACTIVE RECORD';}
function save(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),15000)}
function basePortrait(w,h){let [c,g]=canvas(w,h);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.fillStyle='#fff';g.fillRect(0,0,w,h);return [c,g]}
async function badgePNG(e,photoURL){const i=await images(e,photoURL),[c,g]=canvas(1080,1080);
 const bg=g.createLinearGradient(0,0,1080,1080);bg.addColorStop(0,'#18202e');bg.addColorStop(1,'#080c14');g.fillStyle=bg;g.fillRect(0,0,1080,1080);
 g.strokeStyle='#323a48';g.lineWidth=2;g.beginPath();g.arc(950,130,430,0,Math.PI*2);g.stroke();g.beginPath();g.arc(80,980,520,0,Math.PI*2);g.stroke();round(g,0,0,1080,18,0,COLORS.rose);
 logo(g,i.logo,68,63,72);text(g,'QUARTZ WEB SOLUTIONS',154,109,'800 27px Arial','#ffffff');text(g,'OFFICIAL TEAM PROFILE',157,143,'600 16px Arial','#9da5b4');
 photo(g,i.photo,264,196,552);
 text(g,e.name,540,823,fit(g,e.name,54,920),'#fff','center');
 round(g,90,858,900,100,45,'#e82e4b');text(g,String(e.role||'TEAM MEMBER').toUpperCase(),540,923,fit(g,String(e.role||'TEAM MEMBER').toUpperCase(),36,830),'#fff','center');
 text(g,`EMPLOYEE #${empCode(e)}   •   ${status(e)}`,540,1009,'700 21px Arial','#bec4cf','center');
 return new Promise(resolve=>c.toBlob(b=>{if(b)save(b,`quartz-${empCode(e)}-profile-badge.png`);resolve()},'image/png'));
}
function doc(e,i,publicMode){let [c,g]=basePortrait(1240,1754);const w=1240;
 g.fillStyle=COLORS.ink;g.fillRect(0,0,w,248);g.fillStyle=COLORS.rose;g.fillRect(0,242,w,7);
 logo(g,i.logo,78,55,92);text(g,'QUARTZ',192,118,'900 52px Arial','#ffffff');text(g,'WEB SOLUTIONS',195,163,'600 23px Arial','#c3cad4');
 text(g,'EMPLOYEE VERIFICATION',1160,112,'700 24px Arial','#ffffff','right');text(g,'IDENTITY RECORD  /  '+empCode(e),1160,150,'500 21px Arial','#ccd3de','right');
 text(g,'TEAM IDENTIFICATION',76,323,'800 19px Arial',COLORS.rose);text(g,'Employee identity document',76,394,'800 51px Arial',COLORS.ink);
 line(g,78,430,1160,430);
 photo(g,i.photo,78,486,300);text(g,e.name,425,574,fit(g,e.name,47,715),COLORS.ink);text(g,e.role,425,629,fit(g,e.role,30,715),'#4e5c6d');
 round(g,425,668,400,57,29,e.status==='active'?'#e9f6ef':'#f1f2f4');text(g,status(e),450,707,'800 20px Arial',e.status==='active'?'#176746':'#586272');
 text(g,'EMPLOYEE NUMBER',78,855,'800 20px Arial',COLORS.muted);text(g,empCode(e),78,926,'900 55px Arial',COLORS.ink);
 text(g,'JOB TITLE',550,855,'800 20px Arial',COLORS.muted);g.font=fit(g,e.role,30,620);text(g,e.role,550,915,fit(g,e.role,30,620),COLORS.ink);
 line(g,78,957,1160,957);
 const fields=[['Department',e.department||'Not specified'],['Employment type',e.employment_type||'Not specified'],['Joined on',fmtDate(e.start_date)],['Work status',caps(e.status)]];
 if(!publicMode){fields.push(['Email address',e.email||'Not provided'],['Phone number',e.phone||'Not provided'],['WhatsApp',e.whatsapp||'Not provided'],['Location',e.location||'Not recorded'])}
 let yy=1017;for(const [k,v]of fields){if(yy>1470)break;text(g,k.toUpperCase(),78,yy,'800 19px Arial',COLORS.muted);text(g,String(v),425,yy,fit(g,String(v),24,710),COLORS.ink);line(g,78,yy+23,1160,yy+23,'#e9edf0');yy+=65}
 round(g,78,1515,1082,113,14,'#f1f4f7');text(g,'RECORD AUTHENTICITY',108,1553,'800 18px Arial',COLORS.rose);paragraph(g,'This document reflects the Quartz Web Solutions team record at the time of issue. Verify current status through an authorized verification link.',108,1582,980,21,29,'#465362');
 text(g,`ISSUED: ${fmtDate(new Date().toISOString())}`,78,1687,'700 18px Arial','#657180');text(g,'quartzwebsolutions.com',1160,1687,'700 21px Arial',COLORS.rose,'right');
 return c;
}
function idCardFront(e,i){let [c,g]=canvas(638,1010);const bg=g.createLinearGradient(0,0,638,1010);bg.addColorStop(0,'#192333');bg.addColorStop(1,'#090e17');g.fillStyle=bg;g.fillRect(0,0,638,1010);
 g.strokeStyle='#374353';g.lineWidth=2;g.beginPath();g.arc(600,70,350,0,Math.PI*2);g.stroke();g.beginPath();g.arc(35,940,400,0,Math.PI*2);g.stroke();g.fillStyle=COLORS.rose;g.fillRect(0,0,638,17);
 logo(g,i.logo,42,52,74);text(g,'QUARTZ',134,101,'900 34px Arial','#fff');text(g,'WEB SOLUTIONS',134,132,'600 17px Arial','#adb8c7');
 text(g,'OFFICIAL EMPLOYEE ID',319,215,'700 22px Arial','#eef1f6','center');photo(g,i.photo,166,265,306);
 text(g,e.name,319,665,fit(g,e.name,37,580),'#fff','center');
 round(g,44,699,550,78,26,COLORS.rose);text(g,String(e.role||'TEAM MEMBER').toUpperCase(),319,750,fit(g,String(e.role||'TEAM MEMBER').toUpperCase(),27,510),'#fff','center');
 text(g,'EMPLOYEE ID',319,830,'700 18px Arial','#abb4c2','center');text(g,empCode(e),319,886,'900 48px Arial','#fff','center');
 text(g,status(e),319,954,'700 16px Arial','#f2b4bf','center');return c;
}
function idCardBack(e,i,verifyURL){let [c,g]=canvas(638,1010);g.fillStyle='#fff';g.fillRect(0,0,638,1010);g.fillStyle=COLORS.ink;g.fillRect(0,0,638,210);logo(g,i.logo,42,64,72);text(g,'QUARTZ',133,107,'900 37px Arial','#fff');text(g,'WEB SOLUTIONS',135,137,'500 18px Arial','#c7ccd6');g.fillStyle=COLORS.rose;g.fillRect(0,210,638,8);
 text(g,'IDENTITY DETAILS',45,296,'800 23px Arial',COLORS.rose);
 const fields=[['NAME',e.name],['EMPLOYEE NUMBER',empCode(e)],['DESIGNATION',e.role],['JOINING DATE',fmtDate(e.start_date)],['STATUS',status(e)]];
 let y=330;for(const [k,v]of fields){text(g,k,46,y,'700 15px Arial',COLORS.muted);y+=30;y=paragraph(g,String(v),46,y,540,25,29,COLORS.ink)+8;line(g,46,y,590,y,'#e9ebed');y+=26}
 text(g,'PUBLIC VERIFICATION',46,858,'800 16px Arial',COLORS.rose);paragraph(g,verifyURL||'Verification link available from Quartz administration.',46,895,540,14,19,'#455366');
 text(g,'This is a company-issued ID, not a government ID.',319,972,'15px Arial',COLORS.muted,'center');return c;
}
function pdfBlob(canvases,sizes){const E=new TextEncoder(),chunks=[],positions=[],parts=[];let cursor=0;
 const append=arr=>{chunks.push(arr);cursor+=arr.byteLength};const ascii=v=>append(E.encode(v));
 const object=(id,fn)=>{positions[id]=cursor;ascii(`${id} 0 obj\n`);fn();ascii('\nendobj\n')};
 ascii('%PDF-1.4\n% Quartz employee identity\n');
 const pages=[];let ix=3;
 for(let n=0;n<canvases.length;n++){
  let c=canvases[n],pt=sizes[n],imgID=ix++,contentID=ix++,pageID=ix++;pages.push(pageID);
  const raw=atob(c.toDataURL('image/jpeg',.93).split(',')[1]),bytes=Uint8Array.from(raw,k=>k.charCodeAt(0));
  object(imgID,()=>{ascii(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);append(bytes);ascii('\nendstream')});
  const stream=`q\n${pt[0].toFixed(3)} 0 0 ${pt[1].toFixed(3)} 0 0 cm\n/Im1 Do\nQ\n`;
  object(contentID,()=>ascii(`<< /Length ${E.encode(stream).length} >>\nstream\n${stream}endstream`));
  object(pageID,()=>ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt[0].toFixed(3)} ${pt[1].toFixed(3)}] /Resources << /XObject << /Im1 ${imgID} 0 R >> >> /Contents ${contentID} 0 R >>`));
 }
 object(1,()=>ascii('<< /Type /Catalog /Pages 2 0 R >>'));
 object(2,()=>ascii(`<< /Type /Pages /Kids [${pages.map(x=>x+' 0 R').join(' ')}] /Count ${pages.length} >>`));
 const start=cursor;ascii(`xref\n0 ${ix}\n0000000000 65535 f \n`);for(let id=1;id<ix;id++)ascii(`${String(positions[id]).padStart(10,'0')} 00000 n \n`);
 ascii(`trailer\n<< /Size ${ix} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);
 return new Blob(chunks,{type:'application/pdf'});
}
async function documentPDF(e,photoURL,publicMode=false){const i=await images(e,photoURL),file=pdfBlob([doc(e,i,publicMode)],[[595.28,841.89]]);save(file,`quartz-${empCode(e)}-employee-verification.pdf`)}
async function idCardPDF(e,photoURL,verificationURL=''){const i=await images(e,photoURL),p=pdfBlob([idCardFront(e,i),idCardBack(e,i,verificationURL)],[[153.07,242.65],[153.07,242.65]]);save(p,`quartz-${empCode(e)}-print-id-card.pdf`)}
window.QuartzEmployeeDocs={badgePNG,documentPDF,idCardPDF};
})();
