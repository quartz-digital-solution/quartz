/* Quartz vector exports: records the original Canvas2D artwork without changing its layout. */
(function(){'use strict';
const fmt=x=>Number(x).toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
const xml=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rgb=s=>{const h=String(s||'#000').replace('#','');return h.length===3?[...h].map(c=>parseInt(c+c,16)/255):[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)};
const pdfColor=s=>rgb(s).map(fmt).join(' ');
function round(x,y,w,h,r){
 r=Math.max(0,Math.min(Number(r)||0,w/2,h/2));const k=.5522847498;
 if(!r)return [['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']];
 return [['M',x+r,y],['L',x+w-r,y],['C',x+w-r+k*r,y,x+w,y+r-k*r,x+w,y+r],
 ['L',x+w,y+h-r],['C',x+w,y+h-r+k*r,x+w-r+k*r,y+h,x+w-r,y+h],
 ['L',x+r,y+h],['C',x+r-k*r,y+h,x,y+h-r+k*r,x,y+h-r],
 ['L',x,y+r],['C',x,y+r-k*r,x+r-k*r,y,x+r,y],['Z']];
}
function circle(x,y,r,a,b){
 const n=Math.max(1,Math.ceil(Math.abs(b-a)/(Math.PI/2))),d=(b-a)/n,steps=[['M',x+r*Math.cos(a),y+r*Math.sin(a)]];
 for(let j=0;j<n;j++){const t=a+j*d,u=t+d,q=4/3*Math.tan(d/4);
 const sx=x+r*Math.cos(t),sy=y+r*Math.sin(t),ex=x+r*Math.cos(u),ey=y+r*Math.sin(u);
 steps.push(['C',sx-q*r*Math.sin(t),sy+q*r*Math.cos(t),ex+q*r*Math.sin(u),ey-q*r*Math.cos(u),ex,ey])}
 return steps;
}
const svgPath=p=>p.map(v=>v[0]==='Z'?'Z':v[0]+' '+v.slice(1).map(fmt).join(' ')).join(' ');
function pdfPath(p,h){let s='';for(const v of p){
 if(v[0]==='M')s+=fmt(v[1])+' '+fmt(h-v[2])+' m\n';
 if(v[0]==='L')s+=fmt(v[1])+' '+fmt(h-v[2])+' l\n';
 if(v[0]==='C')s+=fmt(v[1])+' '+fmt(h-v[2])+' '+fmt(v[3])+' '+fmt(h-v[4])+' '+fmt(v[5])+' '+fmt(h-v[6])+' c\n';
 if(v[0]==='Z')s+='h\n';
}return s}
class Recorder{
 constructor(canvas){this.g=canvas.getContext('2d');this.ops=[];this.path=[];this.stack=[];
 this._fillStyle='#000000';this._strokeStyle='#000000';this._lineWidth=1;this._font='10px Arial';this._textAlign='start'}
 set fillStyle(v){this._fillStyle=v;this.g.fillStyle=v?.native||v}get fillStyle(){return this._fillStyle}
 set strokeStyle(v){this._strokeStyle=v;this.g.strokeStyle=v?.native||v}get strokeStyle(){return this._strokeStyle}
 set lineWidth(v){this._lineWidth=v;this.g.lineWidth=v}get lineWidth(){return this._lineWidth}
 set font(v){this._font=v;this.g.font=v}get font(){return this._font}
 set textAlign(v){this._textAlign=v;this.g.textAlign=v}get textAlign(){return this._textAlign}
 set imageSmoothingEnabled(v){this.g.imageSmoothingEnabled=v}
 set imageSmoothingQuality(v){this.g.imageSmoothingQuality=v}
 measureText(s){return this.g.measureText(s)}
 createLinearGradient(x1,y1,x2,y2){const native=this.g.createLinearGradient(x1,y1,x2,y2);
 return {kind:'gradient',native,x1,y1,x2,y2,stops:[],addColorStop(at,color){this.stops.push({at,color});native.addColorStop(at,color)}}}
 save(){this.g.save();this.stack.push([this._fillStyle,this._strokeStyle,this._lineWidth,this._font,this._textAlign]);this.ops.push({type:'save'})}
 restore(){this.g.restore();const p=this.stack.pop();if(p)[this._fillStyle,this._strokeStyle,this._lineWidth,this._font,this._textAlign]=p;this.ops.push({type:'restore'})}
 beginPath(){this.g.beginPath();this.path=[]}
 moveTo(x,y){this.g.moveTo(x,y);this.path.push(['M',x,y])}
 lineTo(x,y){this.g.lineTo(x,y);this.path.push(['L',x,y])}
 arc(x,y,r,a,b,ccw=false){this.g.arc(x,y,r,a,b,ccw);this.path.push(...circle(x,y,r,a,ccw&&b>a?b-2*Math.PI:b))}
 roundRect(x,y,w,h,r){this.g.roundRect(x,y,w,h,r);this.path.push(...round(x,y,w,h,Array.isArray(r)?r[0]:r))}
 fill(){this.g.fill();this.ops.push({type:'path',path:[...this.path],fill:this._fillStyle})}
 stroke(){this.g.stroke();this.ops.push({type:'path',path:[...this.path],stroke:this._strokeStyle,width:this._lineWidth})}
 clip(){this.g.clip();this.ops.push({type:'clip',path:[...this.path]})}
 fillRect(x,y,w,h){this.g.fillRect(x,y,w,h);this.ops.push({type:'path',path:round(x,y,w,h,0),fill:this._fillStyle})}
 drawImage(img,...args){this.g.drawImage(img,...args);
 const [x,y,w,h]=args.length===2?[...args,img.naturalWidth||img.width,img.naturalHeight||img.height]:args;
 this.ops.push({type:'image',img,x,y,w,h})}
 fillText(v,x,y){this.g.fillText(v,x,y);const txt=String(v);
 this.ops.push({type:'text',txt,x,y,font:this._font,color:this._fillStyle,align:this._textAlign,width:this.g.measureText(txt).width})}
}
const setup=canvas=>{const v=new Recorder(canvas);canvas._vector=v;return v};
function embeddedImage(img){
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth||img.width;canvas.height=img.naturalHeight||img.height;
 const g=canvas.getContext('2d');g.drawImage(img,0,0);
 const bytes=g.getImageData(0,0,canvas.width,canvas.height).data;let alpha=false;
 for(let i=3;i<bytes.length;i+=4)if(bytes[i]!==255){alpha=true;break}
 return canvas.toDataURL(alpha?'image/png':'image/jpeg',alpha?undefined:.98);
}
function toSVG(canvas){
 const v=canvas._vector,body=[],defs=[],stack=[],images=new Map(),gradients=new Map();let n=0;
 const paint=p=>{if(p?.kind!=='gradient')return xml(p||'#000');
 if(!gradients.has(p)){const id='g'+(++n);gradients.set(p,id);
 defs.push('<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="'+fmt(p.x1)+'" y1="'+fmt(p.y1)+'" x2="'+fmt(p.x2)+'" y2="'+fmt(p.y2)+'">'+p.stops.map(s=>'<stop offset="'+fmt(s.at*100)+'%" stop-color="'+xml(s.color)+'"/>').join('')+'</linearGradient>')}
 return 'url(#'+gradients.get(p)+')'};
 for(const op of v.ops){
  if(op.type==='save'){body.push('<g>');stack.push(0);continue}
  if(op.type==='restore'){let c=stack.pop()||0;while(c--)body.push('</g>');body.push('</g>');continue}
  if(op.type==='clip'){const id='clip'+(++n);defs.push('<clipPath id="'+id+'"><path d="'+svgPath(op.path)+'"/></clipPath>');body.push('<g clip-path="url(#'+id+')">');if(stack.length)stack[stack.length-1]++;continue}
  if(op.type==='path')body.push('<path d="'+svgPath(op.path)+'" fill="'+(op.fill?paint(op.fill):'none')+'"'+(op.stroke?' stroke="'+paint(op.stroke)+'" stroke-width="'+fmt(op.width)+'"':'')+'/>');
  if(op.type==='text'){const match=/([\d.]+)px/.exec(op.font),weight=/^(\d+)/.exec(op.font);
   const anchor=op.align==='center'?'middle':op.align==='right'||op.align==='end'?'end':'start';
   body.push('<text x="'+fmt(op.x)+'" y="'+fmt(op.y)+'" fill="'+paint(op.color)+'" font-family="Arial, sans-serif" font-size="'+(match?match[1]:10)+'" font-weight="'+(weight?weight[1]:400)+'" text-anchor="'+anchor+'">'+xml(op.txt)+'</text>')}
  if(op.type==='image'){if(!images.has(op.img))images.set(op.img,embeddedImage(op.img));
   body.push('<image x="'+fmt(op.x)+'" y="'+fmt(op.y)+'" width="'+fmt(op.w)+'" height="'+fmt(op.h)+'" href="'+images.get(op.img)+'"/>')}
 }
 while(stack.length){let c=stack.pop();while(c--)body.push('</g>');body.push('</g>')}
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+canvas.width+'" height="'+canvas.height+'" viewBox="0 0 '+canvas.width+' '+canvas.height+'"><defs>'+defs.join('')+'</defs>'+body.join('')+'</svg>';
}
const enc=new TextEncoder();
const from64=value=>{const s=atob(value),v=new Uint8Array(s.length);for(let i=0;i<s.length;i++)v[i]=s.charCodeAt(i);return v};
const zip=async bytes=>new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
async function pdfImage(img){
 const canvas=document.createElement('canvas'),w=canvas.width=img.naturalWidth||img.width,h=canvas.height=img.naturalHeight||img.height;
 const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
 const pixels=g.getImageData(0,0,w,h).data;let transparency=false;
 for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255){transparency=true;break}
 if(!transparency)return {w,h,image:from64(canvas.toDataURL('image/jpeg',.98).split(',')[1]),jpeg:true};
 if(!globalThis.CompressionStream)throw Error('Vector PDF image export needs an up-to-date browser.');
 const color=new Uint8Array(w*h*3),alpha=new Uint8Array(w*h);
 for(let i=0,j=0,p=0;i<pixels.length;i+=4,j+=3,p++){
 color[j]=pixels[i];color[j+1]=pixels[i+1];color[j+2]=pixels[i+2];alpha[p]=pixels[i+3]}
 const [image,mask]=await Promise.all([zip(color),zip(alpha)]);
 return {w,h,image,mask,jpeg:false};
}
function encodedText(value){
 const punctuation={'•':149,'’':146,'‘':145,'“':147,'”':148,'–':150,'—':151,'€':128};
 return Array.from(String(value)).map(c=>{const v=c.charCodeAt(0);return (v<=255?v:punctuation[c]||63).toString(16).padStart(2,'0')}).join('');
}
function fontInfo(font){const size=/([\d.]+)px/.exec(font),weight=/^(\d+)/.exec(font);return {size:Number(size?.[1]||10),bold:Number(weight?.[1]||400)>=600}}
async function toPDF(canvases,pageSizes){
 const objects=[null],add=v=>(objects.push(v),objects.length-1),reserve=()=>add('');
 const root=reserve(),pagesRoot=reserve();
 const normal=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const imageIds=new Map(),pages=[];
 for(const [pageIndex,canvas] of canvases.entries()){
  const h=canvas.height,w=canvas.width,pt=pageSizes[pageIndex],v=canvas._vector;
  if(!v)throw Error('Missing vector drawing data');
  const pics=new Map(),gradients=new Map(),imageResources=[],shadingResources=[];
  for(const op of v.ops){
   if(op.type==='image'){
    if(!imageIds.has(op.img)){
     const asset=await pdfImage(op.img);
     let mask=null;
     if(asset.mask)mask=add(['<< /Type /XObject /Subtype /Image /Width '+asset.w+' /Height '+asset.h+' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length '+asset.mask.length+' >>\nstream\n',asset.mask,'\nendstream']);
     const stream=add(['<< /Type /XObject /Subtype /Image /Width '+asset.w+' /Height '+asset.h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /'+(asset.jpeg?'DCTDecode':'FlateDecode')+' /Length '+asset.image.length+(mask?' /SMask '+mask+' 0 R':'')+' >>\nstream\n',asset.image,'\nendstream']);
     imageIds.set(op.img,stream);
    }
    if(!pics.has(op.img)){const name='Im'+(pics.size+1);pics.set(op.img,name);imageResources.push('/'+name+' '+imageIds.get(op.img)+' 0 R')}
   }
   if(op.type==='path'&&op.fill?.kind==='gradient'&&!gradients.has(op.fill)){
    const g=op.fill,stops=[...g.stops].sort((a,b)=>a.at-b.at),first=stops[0]?.color||'#000',last=stops.at(-1)?.color||first;
    const id=add('<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords ['+[g.x1,h-g.y1,g.x2,h-g.y2].map(fmt).join(' ')+'] /Function << /FunctionType 2 /Domain [0 1] /C0 ['+pdfColor(first)+'] /C1 ['+pdfColor(last)+'] /N 1 >> /Extend [true true] >>');
    const name='Sh'+(gradients.size+1);gradients.set(g,name);shadingResources.push('/'+name+' '+id+' 0 R');
   }
  }
  let content='q\n'+fmt(pt[0]/w)+' 0 0 '+fmt(pt[1]/h)+' 0 0 cm\n';
  for(const op of v.ops){
   if(op.type==='save'){content+='q\n';continue}
   if(op.type==='restore'){content+='Q\n';continue}
   if(op.type==='clip'){content+=pdfPath(op.path,h)+'W n\n';continue}
   if(op.type==='path'){
    if(op.fill?.kind==='gradient'){content+='q\n'+pdfPath(op.path,h)+'W n\n/'+gradients.get(op.fill)+' sh\nQ\n'}
    else if(op.fill)content+=pdfColor(op.fill)+' rg\n'+pdfPath(op.path,h)+'f\n';
    else if(op.stroke)content+=pdfColor(op.stroke)+' RG\n'+fmt(op.width)+' w\n'+pdfPath(op.path,h)+'S\n';
   }
   if(op.type==='image')content+='q\n'+fmt(op.w)+' 0 0 '+fmt(op.h)+' '+fmt(op.x)+' '+fmt(h-op.y-op.h)+' cm\n/'+pics.get(op.img)+' Do\nQ\n';
   if(op.type==='text'){
    const font=fontInfo(op.font),x=op.align==='center'?op.x-op.width/2:op.align==='right'||op.align==='end'?op.x-op.width:op.x;
    content+=pdfColor(op.color)+' rg\nBT /'+(font.bold?'FB':'FN')+' '+fmt(font.size)+' Tf 1 0 0 1 '+fmt(x)+' '+fmt(h-op.y)+' Tm <'+encodedText(op.txt)+'> Tj ET\n';
   }
  }
  content+='Q\n';const bytes=enc.encode(content);
  const stream=add(['<< /Length '+bytes.length+' >>\nstream\n',bytes,'endstream']);
  pages.push(add('<< /Type /Page /Parent '+pagesRoot+' 0 R /MediaBox [0 0 '+fmt(pt[0])+' '+fmt(pt[1])+'] /Resources << /Font << /FN '+normal+' 0 R /FB '+bold+' 0 R >> /XObject << '+imageResources.join(' ')+' >> /Shading << '+shadingResources.join(' ')+' >> >> /Contents '+stream+' 0 R >>'));
 }
 objects[root]='<< /Type /Catalog /Pages '+pagesRoot+' 0 R >>';
 objects[pagesRoot]='<< /Type /Pages /Kids ['+pages.map(id=>id+' 0 R').join(' ')+'] /Count '+pages.length+' >>';
 const chunks=[],offsets=[0];let length=0;
 const push=part=>{const b=part instanceof Uint8Array?part:enc.encode(part);chunks.push(b);length+=b.length};
 push('%PDF-1.4\n% Quartz Vector Export\n');
 for(let i=1;i<objects.length;i++){offsets[i]=length;push(i+' 0 obj\n');const v=objects[i];if(Array.isArray(v))v.forEach(push);else push(v);push('\nendobj\n')}
 const xref=length;push('xref\n0 '+objects.length+'\n0000000000 65535 f \n');
 for(let i=1;i<objects.length;i++)push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 push('trailer\n<< /Size '+objects.length+' /Root '+root+' 0 R >>\nstartxref\n'+xref+'\n%%EOF');
 return new Blob(chunks,{type:'application/pdf'});
}
window.QuartzVectorExport={setup,toSVG,toPDF};
})();
