// Quartz CRM – Cloudflare Pages advanced-mode Worker. All private records live in D1.
const BASE = 'https://quartzwebsolutions.com';
const ADMIN = 'https://admin.quartzwebsolutions.com';
const encoder = new TextEncoder();
const reply = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: securityHeaders({ 'Content-Type': 'application/json; charset=utf-8', ...headers })
});
const error = (msg, status = 400) => reply({ ok:false, error:msg }, status);
const now = () => new Date().toISOString();
const norm = (s, n = 255) => String(s ?? '').trim().slice(0, n);
const hash = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const constantTimeEq = (a,b) => { a=String(a); b=String(b); let diff=a.length ^ b.length; for(let i=0;i<Math.max(a.length,b.length);i++) diff |= (a.charCodeAt(i)||0)^(b.charCodeAt(i)||0); return diff===0; };
const b64url = a => btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const cookie = (req, name) => (req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
// Enforce the actual decoded body size, not just the attacker-controlled Content-Length.
const jsonBody = async (req, maxBytes = 16384) => {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('Content-Type')||'')) throw new HttpProblem('Content-Type must be application/json',415);
  const stated=Number(req.headers.get('Content-Length')||0);
  if(!Number.isFinite(stated)||stated<0||stated>maxBytes) throw new HttpProblem('Request body too large',413);
  const reader=req.body?.getReader();
  if(!reader)throw new HttpProblem('Missing JSON body',400);
  const chunks=[];let total=0;
  try {
    while(true){const {value,done}=await reader.read();if(done)break;
      total+=value.byteLength;
      if(total>maxBytes){await reader.cancel();throw new HttpProblem('Request body too large',413);}
      chunks.push(value);
    }
  } catch(e){if(e instanceof HttpProblem)throw e;throw new HttpProblem('Unreadable request body',400);}
  const bytes=new Uint8Array(total);let cursor=0;
  for(const part of chunks){bytes.set(part,cursor);cursor+=part.byteLength;}
  try {const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!value||Array.isArray(value)||typeof value!=='object')throw Error();return value;}
  catch {throw new HttpProblem('Invalid JSON object',400)}
};
class HttpProblem extends Error { constructor(message,status=400){super(message);this.status=status;} }
const numId = s => (/^[1-9]\d{0,11}$/.test(s||'') ? Number(s) : 0);
const select = async (db, sql, ...params) => (await db.prepare(sql).bind(...params).all()).results||[];
const first = async (db, sql, ...params) => db.prepare(sql).bind(...params).first();
const exec = async (db, sql, ...params) => db.prepare(sql).bind(...params).run();

let schemaReady = false; let schemaInFlight = null;
async function schema(env) {
  if(schemaReady) return;
  if(schemaInFlight) return schemaInFlight;
  schemaInFlight = initializeSchema(env);
  try { await schemaInFlight; schemaReady = true; } finally { schemaInFlight = null; }
}
async function initializeSchema(env) {
  if (!env.DB) throw Error('Cloudflare D1 binding DB is missing.');
  // Each prepared statement runs separately: safe for D1, including existing deployments.
  const statements = [
    `CREATE TABLE IF NOT EXISTS enquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, project TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','read')), created_at TEXT NOT NULL, read_at TEXT, ip_hash TEXT NOT NULL DEFAULT '')`,
    `CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_enquiries_ip ON enquiries(ip_hash, created_at)`,
    `CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, business_name TEXT NOT NULL, contact_name TEXT NOT NULL DEFAULT '', website_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','maintenance','on_hold','closed')), email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', whatsapp TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT 'INR', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(business_name)`,
    `CREATE TABLE IF NOT EXISTS client_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, amount_paise INTEGER NOT NULL CHECK(amount_paise != 0), note TEXT NOT NULL DEFAULT '', paid_at TEXT NOT NULL, manual_date INTEGER NOT NULL DEFAULT 0 CHECK(manual_date IN (0,1)), created_at TEXT NOT NULL, voided_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_client ON client_payments(client_id, paid_at DESC, id DESC)`,
    `CREATE TABLE IF NOT EXISTS share_links (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE, scope TEXT NOT NULL CHECK(scope IN ('client','all')), client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE, created_at TEXT NOT NULL, revoked_at TEXT, include_credentials INTEGER NOT NULL DEFAULT 0, expires_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_share_active ON share_links(scope, client_id, revoked_at)`,
    `CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ip_hash TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(ip_hash, created_at)`,
    `CREATE TABLE IF NOT EXISTS admin_sessions (sid_hash TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS client_access (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, encrypted_data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_client_access_client ON client_access(client_id,id)`,
    `CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at)`
  ];
  for(const stmt of statements) await env.DB.prepare(stmt).run();
  // Forward-compatible migration of existing payment data, without deleting records.
  const cols=await select(env.DB,'PRAGMA table_info(client_payments)');
  if(!cols.some(c=>c.name==='voided_at')) await env.DB.prepare('ALTER TABLE client_payments ADD COLUMN voided_at TEXT').run();
  const shareCols=await select(env.DB,'PRAGMA table_info(share_links)');
  if(!shareCols.some(c=>c.name==='include_credentials')) await env.DB.prepare('ALTER TABLE share_links ADD COLUMN include_credentials INTEGER NOT NULL DEFAULT 0').run();
  if(!shareCols.some(c=>c.name==='expires_at')) await env.DB.prepare('ALTER TABLE share_links ADD COLUMN expires_at TEXT').run();
  // IDs issued from #00181 onwards. Never renumber an existing client or break foreign keys.
  await env.DB.prepare("INSERT INTO sqlite_sequence(name,seq) SELECT 'clients',180 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name='clients')").run();
  await env.DB.prepare("UPDATE sqlite_sequence SET seq=180 WHERE name='clients' AND seq<180").run();
}
async function hmac(value, secret) {
  const k=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(value))));
}
// Signed session cookies require a live D1 record, allowing immediate logout revocation.
const SESSION_SECONDS = 4 * 60 * 60;
const SESSION_COOKIE = '__Host-quartz_admin';
async function session(env) {
  const sid=b64url(crypto.getRandomValues(new Uint8Array(32)));
  const expires=Date.now()+SESSION_SECONDS*1000;
  const p=b64url(encoder.encode(JSON.stringify({exp:expires,role:'admin',sid})));
  await exec(env.DB,'INSERT INTO admin_sessions(sid_hash,created_at,expires_at) VALUES(?,?,?)',await hash(sid),now(),new Date(expires).toISOString());
  return p+'.'+await hmac(p,env.ADMIN_SESSION_SECRET);
}
async function sessionPayload(req,env) {
  if(!env.ADMIN_SESSION_SECRET||env.ADMIN_SESSION_SECRET.length<32||!env.DB) return null;
  const value=cookie(req,SESSION_COOKIE);
  if(value.length>1200) return null;
  const parts=value.split('.');
  if(parts.length!==2 || parts[0].length>600 || !constantTimeEq(parts[1],await hmac(parts[0],env.ADMIN_SESSION_SECRET))) return null;
  try {
    const raw=parts[0].replace(/-/g,'+').replace(/_/g,'/');
    const p=JSON.parse(atob(raw));
    if(p.role!=='admin'||typeof p.exp!=='number'||p.exp<=Date.now()||p.exp>Date.now()+SESSION_SECONDS*1000||!/^[a-zA-Z0-9_-]{43}$/.test(p.sid))return null;
    const row=await first(env.DB,'SELECT sid_hash FROM admin_sessions WHERE sid_hash=? AND expires_at>?',await hash(p.sid),now());
    return row?p:null;
  } catch {return null;}
}
const isAdmin = async (req,env) => Boolean(await sessionPayload(req,env));
async function revokeSession(req,env) {
  const payload=await sessionPayload(req,env);
  if(payload) await exec(env.DB,'DELETE FROM admin_sessions WHERE sid_hash=?',await hash(payload.sid));
}
const adminCookie=(value,maxAge)=>`${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Priority=High`;
const clientColumns = 'c.id,c.business_name,c.contact_name,c.website_url,c.status,c.email,c.phone,c.whatsapp,c.description,c.notes,c.currency,c.created_at,c.updated_at,COALESCE((SELECT SUM(p.amount_paise) FROM client_payments p WHERE p.client_id=c.id AND p.voided_at IS NULL),0) AS balance_paise,COALESCE((SELECT COUNT(*) FROM client_payments p WHERE p.client_id=c.id),0) AS payment_count';
async function getClients(db) { return select(db,`SELECT ${clientColumns} FROM clients c ORDER BY c.updated_at DESC,c.id DESC LIMIT 5000`); }
async function getClient(db,id) { return first(db,`SELECT ${clientColumns} FROM clients c WHERE c.id=?`,id); }
async function getClientsFull(db) {
  const clients=await getClients(db);
  const entries=await select(db,'SELECT id,client_id,amount_paise,note,paid_at,manual_date,created_at,voided_at FROM client_payments ORDER BY paid_at DESC,id DESC');
  const byClient=new Map();for(const p of entries){const a=byClient.get(p.client_id)||[];a.push(p);byClient.set(p.client_id,a)}
  return clients.map(c=>({...c,payments:byClient.get(c.id)||[]}));
}
// Public multi-client directories deliberately exclude financial, notes, access and payment data.
function directoryClient(c) {
  return {id:c.id,business_name:c.business_name,contact_name:c.contact_name,website_url:c.website_url,
    status:c.status,email:c.email,phone:c.phone,whatsapp:c.whatsapp,description:c.description};
}
function credentialData(b){
  const label=norm(b.label,80),login_id=norm(b.login_id,250),password=String(b.password??'');
  const id_only=b.id_only===true;
  if(!label||!login_id)throw new HttpProblem('Enter an access role and login ID.');
  if(password.length>500)throw new HttpProblem('Password is too long.');
  if(!id_only&&!password)throw new HttpProblem('Enter a password or select ID only.');
  return {label,login_id,password:id_only?'':password,id_only};
}
async function credentialKey(env){
  const s=env.CLIENT_CREDENTIALS_SECRET;
  if(!s||s.length<32)throw new HttpProblem('Set CLIENT_CREDENTIALS_SECRET (32+ random characters) as an encrypted Cloudflare secret before saving access details.',503);
  const raw=await crypto.subtle.digest('SHA-256',encoder.encode('quartz-client-credentials-v1:'+s));
  return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encryptCredential(env,value){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await credentialKey(env),encoder.encode(JSON.stringify(value)));
  return 'v1.'+b64url(iv)+'.'+b64url(new Uint8Array(cipher));
}
function decode64(t){const x=t.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(x+'='.repeat((4-x.length%4)%4)),c=>c.charCodeAt(0));}
async function decryptCredential(env,text){
  try {const [v,a,b]=text.split('.');if(v!=='v1'||!a||!b)throw Error('format');
    const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode64(a)},await credentialKey(env),decode64(b));
    return JSON.parse(new TextDecoder().decode(clear));
  }catch(e){if(e instanceof HttpProblem)throw e;throw new HttpProblem('Access details cannot be decrypted. Confirm CLIENT_CREDENTIALS_SECRET has not changed.',503)}
}
async function getAccess(db,env,id){
 const rows=await select(db,'SELECT id,encrypted_data,created_at,updated_at FROM client_access WHERE client_id=? ORDER BY id ASC',id);
 return Promise.all(rows.map(async r=>({id:r.id,...await decryptCredential(env,r.encrypted_data),created_at:r.created_at,updated_at:r.updated_at})));
}
const getDirectory = async db => (await getClients(db)).sort((a,b)=>a.id-b.id).map(directoryClient);
const getPayments = (db,id) => select(db,'SELECT id,client_id,amount_paise,note,paid_at,manual_date,created_at,voided_at FROM client_payments WHERE client_id=? ORDER BY paid_at DESC,id DESC',id);
function clientInput(b) {
  const status=['active','maintenance','on_hold','closed'].includes(b.status) ? b.status : 'active';
  const website_url=norm(b.website_url,600);
  if(website_url) {
    try {const u=new URL(website_url);if(!['http:','https:'].includes(u.protocol)||!u.hostname||u.username||u.password)throw Error();}
    catch {throw Error('Website must be a valid full http:// or https:// link without credentials.');}
  }
  if (norm(b.business_name,180).length < 2) throw Error('Business name is required.');
  return {business_name:norm(b.business_name,180),contact_name:norm(b.contact_name,180),website_url,status,email:norm(b.email,180),phone:norm(b.phone,60),whatsapp:norm(b.whatsapp,60),description:norm(b.description,2000),notes:norm(b.notes,4000),currency:'INR'};
}
function parseAmount(v) {
  const s=String(v??'').trim().replace(/[,₹\s]/g,'');
  if(!/^[+-]?\d{1,10}(?:\.\d{1,2})?$/.test(s)) throw Error('Enter a valid amount, e.g. 1500 or -1000.');
  const sign=s.startsWith('-')?-1:1; const [rupees, paise='']=s.replace(/^[+-]/,'').split('.');
  const val=sign*(Number(rupees)*100+Number(paise.padEnd(2,'0')));
  if(!Number.isSafeInteger(val)||val===0||Math.abs(val)>1e11) throw Error('Amount is out of allowed range.');
  return val;
}
function parseDate(v) {
  if(!v) return {paid_at:now(),manual_date:0};
  const d=new Date(v); if(Number.isNaN(+d)) throw Error('Invalid payment date/time.');
  if(+d>Date.now()+10*60*1000) throw Error('Payment date cannot be in the future.');
  return {paid_at:d.toISOString(),manual_date:1};
}
function payInput(b) {
  const amount_paise=parseAmount(b.amount);
  const d=parseDate(b.paid_at);
  return {amount_paise,...d,note:norm(b.note,500),created_at:now()};
}
async function createPayment(db,id,v) {
  const p=payInput(v);
  return exec(db,'INSERT INTO client_payments (client_id,amount_paise,note,paid_at,manual_date,created_at) VALUES (?,?,?,?,?,?)',id,p.amount_paise,p.note,p.paid_at,p.manual_date,p.created_at);
}
async function ipHash(req,env) {return hash((req.headers.get('CF-Connecting-IP')||'unknown')+'|'+(env.ADMIN_SESSION_SECRET||'quartz'))};
function securityHeaders(extra={}) {return {
  'Cache-Control':'private, no-store, max-age=0',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Cross-Origin-Resource-Policy':'same-origin',
  'X-Frame-Options':'DENY',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
  ...extra
};}
const ADMIN_CSP="default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; upgrade-insecure-requests";
const SHARE_CSP="default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; upgrade-insecure-requests";
const PUBLIC_CSP="default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; upgrade-insecure-requests";
function assetResponse(r,url,scope) {
  const h=new Headers(r.headers);
  h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy',scope==='public'?'strict-origin-when-cross-origin':'no-referrer');
  h.set('X-Frame-Options','DENY');h.set('Cross-Origin-Resource-Policy','same-origin');
  h.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  if(scope!=='public'){
    h.set('Cache-Control','private, no-store, max-age=0');
    h.set('X-Robots-Tag','noindex, nofollow, noarchive');
  }
  if((h.get('Content-Type')||'').includes('text/html') || url.pathname.endsWith('/') || url.pathname.endsWith('.html'))
    h.set('Content-Security-Policy',scope==='admin'?ADMIN_CSP:scope==='share'?SHARE_CSP:PUBLIC_CSP);
  return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});
}

async function verifyTurnstile(token,req,env,hostname) {
  if(!env.TURNSTILE_SECRET_KEY) return true;
  if(typeof token!=='string'||token.length<10||token.length>2048)return false;
  const body=new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token});
  const ip=req.headers.get('CF-Connecting-IP');if(ip)body.set('remoteip',ip);
  try {
    const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body,signal:AbortSignal.timeout(7000)});
    if(!r.ok)return false;
    const data=await r.json();
    return data.success===true && data.hostname===hostname;
  }catch{return false;}
}
async function publicApi(req,env,url) {
  if(url.pathname==='/api/public/config' && req.method==='GET')
    return reply({ok:true,turnstile_site_key:env.TURNSTILE_SITE_KEY&&env.TURNSTILE_SECRET_KEY?env.TURNSTILE_SITE_KEY:''},200,{'Cache-Control':'no-store'});
  if(url.pathname==='/api/enquiries' && req.method==='POST') {
    const origin=req.headers.get('Origin');
    if(origin!==BASE) return error('Origin not allowed',403);
    if(req.headers.get('Sec-Fetch-Site')==='cross-site')return error('Cross-site request blocked',403);
    const len=Number(req.headers.get('content-length')||0);
    if(len>16000) return error('Enquiry is too large',413);
    const b=await jsonBody(req);
    if(b.company_url) return reply({ok:true}); // honeypot
    if(!(await verifyTurnstile(b.turnstile_token,req,env,url.hostname)))return error('Verification failed. Please retry.',403);
    const name=norm(b.name,120),email=norm(b.email,180),project=norm(b.project,180),message=norm(b.message,3500);
    if(name.length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !(project||message)) return error('Please enter a name, valid email and project details.');
    await schema(env);
    const ip=await ipHash(req,env);
    const hit=await first(env.DB,'SELECT COUNT(*) AS n FROM enquiries WHERE ip_hash=? AND created_at>=?',ip,new Date(Date.now()-15*60000).toISOString());
    if(hit.n>=4) return error('Too many enquiries. Please try again later.',429);
    await exec(env.DB,'INSERT INTO enquiries (name,email,project,message,status,created_at,ip_hash) VALUES (?,?,?,?,?,?,?)',name,email,project,message,'new',now(),ip);
    return reply({ok:true,message:'Your enquiry has been received.'},201);
  }
  const m=url.pathname.match(/^\/api\/public\/shared\/([a-zA-Z0-9_-]{32,100})$/);
  if(m && req.method==='GET') {
    await schema(env);
    const link=await first(env.DB,'SELECT * FROM share_links WHERE token_hash=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)',await hash(m[1]),now());
    if(!link) return error('This link is invalid or has been revoked.',404);
    if(link.scope==='client') {
      const client=await getClient(env.DB,link.client_id);
      if(!client) return error('Client not found',404);
      return reply({ok:true,scope:'client',clients:[{...client,payments:await getPayments(env.DB,client.id),
        access:link.include_credentials ? await getAccess(env.DB,env,client.id) : []}]},200,securityHeaders());
    }
    return reply({ok:true,scope:'all',clients:await getDirectory(env.DB)},200,securityHeaders());
  }
  return error('Not found',404);
}
async function adminApi(req,env,url) {
  if(url.hostname!=='admin.quartzwebsolutions.com') return error('Not found',404);
  if(!['GET','POST','PUT','DELETE'].includes(req.method))return error('Method not allowed',405);
  if(req.headers.get('Sec-Fetch-Site')==='cross-site')return error('Cross-site request blocked',403);
  const origin=req.headers.get('Origin');
  if(origin&&origin!==ADMIN)return error('Invalid origin',403);
  if(req.method!=='GET'){
    const referer=req.headers.get('Referer');
    if(!origin && !(referer&&(()=>{try{return new URL(referer).origin===ADMIN}catch{return false}})()) && req.headers.get('Sec-Fetch-Site')!=='same-origin')return error('Request origin could not be verified',403);
  }
  if(url.pathname==='/api/admin/login' && req.method==='POST') {
    if(!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length<32 || !env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length<12) return error('Configure ADMIN_PASSWORD (12+ characters) and ADMIN_SESSION_SECRET (32+ characters) in Cloudflare secrets.',503);
    await schema(env);
    await exec(env.DB,'DELETE FROM admin_sessions WHERE expires_at<?',now());
    await exec(env.DB,'DELETE FROM login_attempts WHERE created_at<?',new Date(Date.now()-24*60*60000).toISOString());
    const ip=await ipHash(req,env), since=new Date(Date.now()-15*60000).toISOString();
    const prev=await first(env.DB,'SELECT COUNT(*) AS n FROM login_attempts WHERE ip_hash=? AND created_at>=?',ip,since);
    if(prev.n>=8) return error('Too many login attempts. Retry later.',429);
    const global=await first(env.DB,'SELECT COUNT(*) AS n FROM login_attempts WHERE created_at>=?',since);
    if(global.n>=150)return error('Login temporarily rate limited',429);
    const body=await jsonBody(req);
    const supplied=String(body.password||'');
    const valid=supplied.length<=256 && constantTimeEq(norm(body.loginId,120),env.ADMIN_LOGIN_ID||'quartex') && constantTimeEq(supplied,env.ADMIN_PASSWORD);
    if(!valid){await exec(env.DB,'INSERT INTO login_attempts(ip_hash,created_at) VALUES(?,?)',ip,now());return error('Invalid login credentials',401);}
    return reply({ok:true},200,{'Set-Cookie':adminCookie(await session(env),SESSION_SECONDS)});
  }
  if(url.pathname==='/api/admin/logout' && req.method==='POST') {
    await revokeSession(req,env);
    return reply({ok:true},200,{'Set-Cookie':adminCookie('',0)});
  }
  if(!(await isAdmin(req,env))) return error('Unauthorized',401);
  if(url.pathname==='/api/admin/me' && req.method==='GET') return reply({ok:true,loginId:env.ADMIN_LOGIN_ID||'quartex'});
  await schema(env);
  const db=env.DB, path=url.pathname;
  if(path==='/api/admin/summary' && req.method==='GET') {
    const [clients,enquiries]=await Promise.all([getClients(db),first(db,"SELECT COUNT(*) AS total,SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) AS unread FROM enquiries")]);
    return reply({ok:true,client_count:clients.length,net_total_paise:clients.reduce((v,c)=>v+c.balance_paise,0),enquiry_count:enquiries.total||0,new_enquiry_count:enquiries.unread||0});
  }
  if(path==='/api/admin/enquiries' && req.method==='GET') {
    const status=url.searchParams.get('status')==='read'?'read':'new';
    const rows=await select(db,'SELECT id,name,email,project,message,status,created_at,read_at FROM enquiries WHERE status=? ORDER BY created_at DESC LIMIT 1000',status);
    return reply({ok:true,enquiries:rows});
  }
  if(path==='/api/admin/enquiries/read-all' && req.method==='POST') {
    const t=now();const r=await exec(db,"UPDATE enquiries SET status='read',read_at=? WHERE status='new'",t);
    return reply({ok:true,marked:r.meta.changes||0});
  }
  const enquiry=path.match(/^\/api\/admin\/enquiries\/(\d+)\/read$/);
  if(enquiry && req.method==='POST') {const r=await exec(db,"UPDATE enquiries SET status='read',read_at=? WHERE id=? AND status='new'",now(),numId(enquiry[1]));return r.meta.changes?reply({ok:true}):error('New enquiry not found',404);}
  if(path==='/api/admin/clients' && req.method==='GET') return reply({ok:true,clients:await getClients(db)});
  if(path==='/api/admin/clients/full' && req.method==='GET') return reply({ok:true,clients:await getDirectory(db)});
  if(path==='/api/admin/clients' && req.method==='POST') {
    let c;try {c=clientInput(await jsonBody(req));} catch(e){return error(e.message)}
    const t=now(); const r=await first(db,'INSERT INTO clients (business_name,contact_name,website_url,status,email,phone,whatsapp,description,notes,currency,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id',c.business_name,c.contact_name,c.website_url,c.status,c.email,c.phone,c.whatsapp,c.description,c.notes,c.currency,t,t);
    return reply({ok:true,client:await getClient(db,r.id)},201);
  }
  const cm=path.match(/^\/api\/admin\/clients\/(\d+)$/);
  if(cm) {
    const id=numId(cm[1]); if(!id) return error('Invalid client id');
    if(req.method==='GET') {const c=await getClient(db,id);return c?reply({ok:true,client:c,payments:await getPayments(db,id)}):error('Client not found',404)}
    if(req.method==='PUT') {
      if(!(await getClient(db,id))) return error('Client not found',404);
      let c;try{c=clientInput(await jsonBody(req));}catch(e){return error(e.message)}
      await exec(db,'UPDATE clients SET business_name=?,contact_name=?,website_url=?,status=?,email=?,phone=?,whatsapp=?,description=?,notes=?,updated_at=? WHERE id=?',c.business_name,c.contact_name,c.website_url,c.status,c.email,c.phone,c.whatsapp,c.description,c.notes,now(),id);
      return reply({ok:true,client:await getClient(db,id)});
    }
  }
  // Credentials for a client's own website: separately encrypted at rest and admin-only.
  const am=path.match(/^\/api\/admin\/clients\/(\d+)\/access$/);
  if(am){
    const id=numId(am[1]);if(!(await getClient(db,id)))return error('Client not found',404);
    if(req.method==='GET')return reply({ok:true,access:await getAccess(db,env,id)});
    if(req.method==='POST'){
      const entry=credentialData(await jsonBody(req));const encrypted=await encryptCredential(env,entry);const t=now();
      await exec(db,'INSERT INTO client_access(client_id,encrypted_data,created_at,updated_at) VALUES(?,?,?,?)',id,encrypted,t,t);
      return reply({ok:true,access:await getAccess(db,env,id)},201);
    }
  }
  const aitem=path.match(/^\/api\/admin\/clients\/(\d+)\/access\/(\d+)$/);
  if(aitem){
    const id=numId(aitem[1]),entryId=numId(aitem[2]);
    if(req.method==='DELETE'){
      const r=await exec(db,'DELETE FROM client_access WHERE client_id=? AND id=?',id,entryId);
      return r.meta.changes?reply({ok:true}):error('Access record not found',404);
    }
    if(req.method==='PUT'){
      const entry=credentialData(await jsonBody(req));const encrypted=await encryptCredential(env,entry);
      const r=await exec(db,'UPDATE client_access SET encrypted_data=?,updated_at=? WHERE client_id=? AND id=?',encrypted,now(),id,entryId);
      return r.meta.changes?reply({ok:true}):error('Access record not found',404);
    }
  }
  const pm=path.match(/^\/api\/admin\/clients\/(\d+)\/payments$/);
  if(pm && req.method==='POST') {
    const id=numId(pm[1]);if(!(await getClient(db,id))) return error('Client not found',404);
    try{await createPayment(db,id,await jsonBody(req));}catch(e){return error(e.message)}
    await exec(db,'UPDATE clients SET updated_at=? WHERE id=?',now(),id);
    return reply({ok:true,client:await getClient(db,id),payments:await getPayments(db,id)},201);
  }
  const bm=path.match(/^\/api\/admin\/clients\/(\d+)\/payments\/batch$/);
  if(bm && req.method==='POST') {
    const id=numId(bm[1]);if(!(await getClient(db,id))) return error('Client not found',404);
    const b=await jsonBody(req);const lines=String(b.entries||'').split(/[,\n]+/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length || lines.length>300) return error('Enter 1 to 300 comma-separated payments.');
    let payments;
    try{payments=lines.map(x=>{const [amount,paid_at='',...rest]=x.split('|').map(x=>x.trim());return payInput({amount,paid_at,note:rest.join(' | ')})})}catch(e){return error(e.message)}
    const statements=payments.map(p=>db.prepare('INSERT INTO client_payments(client_id,amount_paise,note,paid_at,manual_date,created_at) VALUES(?,?,?,?,?,?)').bind(id,p.amount_paise,p.note,p.paid_at,p.manual_date,p.created_at));
    statements.push(db.prepare('UPDATE clients SET updated_at=? WHERE id=?').bind(now(),id));
    await db.batch(statements);
    return reply({ok:true,inserted:payments.length,client:await getClient(db,id),payments:await getPayments(db,id)},201);
  }
  const delpay=path.match(/^\/api\/admin\/clients\/(\d+)\/payments\/(\d+)$/);
  if(delpay && req.method==='DELETE') {
    const id=numId(delpay[1]);
    const r=await exec(db,'UPDATE client_payments SET voided_at=? WHERE id=? AND client_id=? AND voided_at IS NULL',now(),numId(delpay[2]),id);
    if(!r.meta.changes) return error('Active entry not found',404);
    await exec(db,'UPDATE clients SET updated_at=? WHERE id=?',now(),id);return reply({ok:true});
  }
  if(path==='/api/admin/shares' && req.method==='POST') {
    const b=await jsonBody(req), scope=b.scope==='all'?'all':'client',id=scope==='client'?numId(String(b.client_id)) : null;
    const include=scope==='client' && b.include_credentials===true ? 1 : 0;
    if(include)await credentialKey(env);
    if(scope==='client' && !(await getClient(db,id))) return error('Client not found',404);
    const token=b64url(crypto.getRandomValues(new Uint8Array(32))), token_hash=await hash(token);
    const expires_at=include?new Date(Date.now()+24*60*60*1000).toISOString():null;
    const stmts=[db.prepare('UPDATE share_links SET revoked_at=? WHERE scope=? AND revoked_at IS NULL AND '+(scope==='all'?'client_id IS NULL':'client_id=?')).bind(...(scope==='all'?[now(),scope]:[now(),scope,id])),db.prepare('INSERT INTO share_links(token_hash,scope,client_id,created_at,include_credentials,expires_at) VALUES(?,?,?,?,?,?)').bind(token_hash,scope,id,now(),include,expires_at)];
    await db.batch(stmts);
    return reply({ok:true,url:`${BASE}/share/${token}`,scope,expires_at});
  }
  if(path==='/api/admin/shares/revoke' && req.method==='POST') {
    const b=await jsonBody(req),scope=b.scope==='all'?'all':'client',id=numId(String(b.client_id));
    if(scope==='client' && !id) return error('Invalid client');
    const query=scope==='all'?'UPDATE share_links SET revoked_at=? WHERE scope=? AND client_id IS NULL AND revoked_at IS NULL':'UPDATE share_links SET revoked_at=? WHERE scope=? AND client_id=? AND revoked_at IS NULL';
    const r=await exec(db,query,...(scope==='all'?[now(),scope]:[now(),scope,id]));
    return reply({ok:true,revoked:r.meta.changes||0});
  }
  const accessExport=path.match(/^\/api\/admin\/clients\/(\d+)\/pdf-data$/);
  if(accessExport && req.method==='GET'){
    const id=numId(accessExport[1]),c=await getClient(db,id);if(!c)return error('Client not found',404);
    const include=url.searchParams.get('include_credentials')==='true';
    return reply({ok:true,clients:[{...c,payments:await getPayments(db,id),access:include?await getAccess(db,env,id):[]}]});
  }
  if(path==='/api/admin/export' && req.method==='GET') {
    const format=url.searchParams.get('format')||'json';
    if(!['json','csv'].includes(format)) return error('Invalid export type');
    const details=await getClientsFull(db);
    let content,type,filename;
    if(format==='json') { content=JSON.stringify({exported_at:now(),organization:'Quartz Web Solutions',clients:details},null,2);type='application/json';filename='quartz-clients-full-backup.json'; }
    else {
      const fields=['client_id','business_name','contact_name','website_url','status','email','phone','whatsapp','description','notes','balance_inr','payment_id','amount_inr','payment_note','payment_at','timestamp_type','entered_at','voided_at'];
      const escapeCSV=v=>{const value=String(v??'');const text= /^[\s\x00-\x1f]*[=+@-]/.test(value) && !/^[+-]?\d+(?:\.\d+)?$/.test(value.trim())?"'"+value:value;return '"'+text.replace(/"/g,'""')+'"';};
      const lines=[fields.map(escapeCSV).join(',')];
      for(const c of details){const prefix=[c.id,c.business_name,c.contact_name,c.website_url,c.status,c.email,c.phone,c.whatsapp,c.description,c.notes,(c.balance_paise/100).toFixed(2)];const payments=c.payments.length?c.payments:[null];for(const p of payments)lines.push([...prefix,p?.id||'',p?(p.amount_paise/100).toFixed(2):'',p?.note||'',p?.paid_at||'',p?(p.manual_date?'manual':'automatic'):'',p?.created_at||'',p?.voided_at||''].map(escapeCSV).join(','));}
      content='\ufeff'+lines.join('\r\n');type='text/csv; charset=utf-8';filename='quartz-clients-full-ledger.csv';
    }
    return new Response(content,{headers:securityHeaders({'Content-Type':type,'Content-Disposition':`attachment; filename="${filename}"`})});
  }
  return error('API route not found',404);
}

export default {async fetch(req,env) {
  const url=new URL(req.url);
  try {
    const adminHost=url.hostname==='admin.quartzwebsolutions.com';
    const mainHost=['quartzwebsolutions.com','www.quartzwebsolutions.com'].includes(url.hostname);
    if(url.hostname==='www.quartzwebsolutions.com'){url.hostname='quartzwebsolutions.com';return Response.redirect(url.toString(),301);}
    if(url.pathname.startsWith('/api/admin/')) return await adminApi(req,env,url);
    if(url.pathname.startsWith('/api/')) return mainHost ? await publicApi(req,env,url) : error('Not found',404);
    if(mainHost && url.pathname.startsWith('/admin')) return Response.redirect(ADMIN+'/',302);
    // The admin CSS/JS/html must not be served on the public hostname.
    if(mainHost && /^\/share\/[a-zA-Z0-9_-]{32,100}\/?$/.test(url.pathname)) {
      const page=await env.ASSETS.fetch(new Request(BASE+'/share/'));
      return new Response(page.body,{status:page.status,headers:securityHeaders({'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':SHARE_CSP})});
    }
    if(mainHost && url.pathname==='/businesses' || mainHost && url.pathname.startsWith('/businesses/')) return Response.redirect(BASE+'/',301);
    // Never let the public domain expose the private admin assets.
    if(adminHost){
      const reqUrl=new URL(req.url);if(reqUrl.pathname==='/')reqUrl.pathname='/admin/';
      // Admin assets are only delivered on admin hostname with a strict CSP.
      const r=await env.ASSETS.fetch(new Request(reqUrl,req));
      return assetResponse(r,reqUrl,'admin');
    }
    if(mainHost){
      if(url.pathname==='/sitemap.xml') {
        // Static Quartz marketing pages only; no customer-site publishing or SEO engine.
        const paths=['/','/sabith-salah-kp/','/services/website-development/','/services/web-app-development/','/services/ecommerce-development/','/services/ui-ux-design/','/services/seo-performance/','/services/website-for-shops/','/services/business-websites/','/services/local-seo-websites/','/locations/kerala/','/locations/malappuram/','/locations/calicut/'];
        return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(s=>`<url><loc>${BASE+s}</loc></url>`).join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=UTF-8','Cache-Control':'public,max-age=3600'}});
      }
      // Retire the old published per-client slugs and directory (do not intercept Quartz's own static routes).
      const r=await env.ASSETS.fetch(req);
      return assetResponse(r,url,url.pathname.startsWith('/share/')?'share':'public');
    }
    // Block alternate preview/default domains accessing these static assets.
    return error('Unknown hostname',404);
  } catch(e){if(e instanceof HttpProblem)return error(e.message,e.status);console.error('Quartz worker failure',e);return error('Server operation failed. Check D1 bindings and Cloudflare logs.',500);}
}};
